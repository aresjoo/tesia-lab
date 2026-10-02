import type { Transport } from './contracts/generated/api-v0.7/client'
import type { NativeJob, NativeReport, NativeTrades, NativeChartManifest, NativeChartWindowSelection } from './native-service-api'
import { createNativeChartReadAccess, type NativeChartJobBinding, type NativeChartReportBinding, type NativeMarkerBinding } from './native-chart-read-access'
import { createNativeChronologicalFillReader, type NativeChronologicalFillReader } from './native-chronological-fill-reader'

export type NativeReplayReaderInput = {
  job: NativeJob
  report: NativeReport
  trades: NativeTrades
  segment: 'IS' | 'OOS'
  expectedManifestContentHash?: string
  transport: Transport & { abort(): void }
  ownerSignal: AbortSignal
  isCurrent: () => boolean
}

/** One visual replay attempt. The transport must belong to this reader alone:
 * disposing it never cancels manual result reads or a server backtest job.
 * No completed window/page cache; the controller owns its bounded two slots.
 */
export function createNativeReplayChartReader(input: NativeReplayReaderInput) {
  const job: NativeChartJobBinding = {
    backtestId: input.job.backtestId, strategyVersionId: input.job.strategyVersionId,
    semanticHash: input.job.semanticHash, splitGroupId: input.job.splitGroupId,
  }
  const report: NativeChartReportBinding = structuredClone({ binding: input.report.binding, nativeEnvelope: input.report.nativeEnvelope })
  // Do not retain the caller's complete trades page or mutable request objects.
  const trades: NativeMarkerBinding = structuredClone({ binding: input.trades.binding,
    strategyAuthorityMapping: input.trades.strategyAuthorityMapping, tradeManifestContentHash: input.trades.tradeManifestContentHash })
  const { segment, expectedManifestContentHash, transport, ownerSignal, isCurrent } = input
  const retirement = new AbortController()
  let disposed = false, windowBusy = false, markerBusy = false, chronologicalBusy = false
  let chronological: NativeChronologicalFillReader | undefined
  let snapshot: NativeChartManifest | undefined
  let pendingManifest: Promise<NativeChartManifest> | undefined
  const dispose = () => {
    if (disposed) return
    disposed = true
    snapshot = undefined; pendingManifest = undefined
    ownerSignal.removeEventListener('abort', dispose)
    chronological?.dispose(); chronological = undefined
    transport.abort()
    retirement.abort()
  }
  const isActive = () => {
    if (!disposed && (ownerSignal.aborted || !isCurrent())) dispose()
    return !disposed
  }
  const assertCurrent = () => {
    if (!isActive()) throw new Error('NATIVE_REPLAY_DISPOSED')
  }
  const access = createNativeChartReadAccess({ async request(request) {
    assertCurrent()
    try {
      const response = await transport.request(request)
      assertCurrent()
      return response
    } catch (error) {
      assertCurrent()
      throw error
    }
  } })
  const manifest = async () => {
    assertCurrent()
    if (snapshot) return snapshot
    if (!pendingManifest) {
      const request = access.manifest(job, report, segment).then(value => {
        assertCurrent()
        // A presentation is bound to the already-visible chart. Reject a new
        // snapshot before requesting either its windows or its marker pages.
        if (expectedManifestContentHash !== undefined && value.manifestContentHash !== expectedManifestContentHash) {
          throw new Error('NATIVE_RESULT_BINDING_CONFLICT')
        }
        snapshot = structuredClone(value)
        return snapshot
      })
      pendingManifest = request
      // A rejected read is not cached. No implicit retry: only a later explicit
      // call can try again. Both simultaneous readers share the same outcome.
      void request.finally(() => { if (pendingManifest === request) pendingManifest = undefined }).catch(() => undefined)
    }
    return pendingManifest
  }
  ownerSignal.addEventListener('abort', dispose, { once: true })
  if (ownerSignal.aborted) dispose()
  return {
    // Completion can stop the animation clock before the renderer restores.
    // Retirement remains observable without a timer or another network read.
    retirementSignal: retirement.signal,
    // Buffered playback can finish without another GET. Its consumer must
    // still observe owner retirement; this probe never reads or caches data.
    isActive,
    async readWindow(selection: NativeChartWindowSelection = {}) {
      assertCurrent()
      if (windowBusy) throw new Error('NATIVE_REPLAY_READ_BUSY')
      windowBusy = true
      try {
        const request = { ...selection }
        const verified = await manifest()
        assertCurrent()
        const result = await access.window(job, report, segment, verified, request)
        assertCurrent()
        // No returned object aliases the private manifest/navigation arrays.
        return structuredClone(result)
      } catch (error) {
        assertCurrent()
        throw error
      } finally { windowBusy = false }
    },
    async readMarkers(cursor?: string) {
      assertCurrent()
      if (markerBusy) throw new Error('NATIVE_REPLAY_READ_BUSY')
      markerBusy = true
      try {
        const verified = await manifest()
        assertCurrent()
        const result = await access.markers(verified, trades, cursor)
        assertCurrent()
        return result
      } catch (error) {
        // Timeout/protocol failures stay errors unless this reader was actually
        // disposed. The SDK's TRANSPORT_FAILED code alone is not cancellation.
        assertCurrent()
        throw error
      } finally { markerBusy = false }
    },
    async readChronologicalMarkers() {
      assertCurrent()
      if (chronologicalBusy) throw new Error('NATIVE_REPLAY_READ_BUSY')
      chronologicalBusy = true
      try {
        const verified = await manifest()
        assertCurrent()
        chronological ??= createNativeChronologicalFillReader({ manifest: verified, trades, ownerSignal, isCurrent })
        const result = await chronological.readNext()
        assertCurrent()
        return result
      } catch (error) {
        assertCurrent()
        throw error
      } finally { chronologicalBusy = false }
    },
    dispose,
  }
}

export type NativeReplayChartReader = ReturnType<typeof createNativeReplayChartReader>
