import { createNativeChronologicalFillClient } from './native-chronological-fill-transport'
import { assertNativeFillPageBinding, assertNativeMarkerBinding, type NativeFillManifestBinding, type NativeMarkerBinding } from './native-chart-read-access'
import type { NativeChartManifest } from './native-service-api'

export type NativeChronologicalFillReaderInput = {
  /** Already SDK-validated, visible result identity. */
  manifest: NativeFillManifestBinding & Pick<NativeChartManifest, 'segmentBounds'>
  trades: NativeMarkerBinding
  ownerSignal: AbortSignal
  isCurrent: () => boolean
}

/** One replay attempt, explicit one-page reads, constant-size chain state.
 * Does not cache pages, renumber sourceOrdinal, infer trade profit, or attest
 * the original fill-set permutation. That last responsibility is server-side.
 */
export function createNativeChronologicalFillReader(input: NativeChronologicalFillReaderInput) {
  const { ownerSignal, isCurrent } = input
  const manifest = structuredClone({ binding: input.manifest.binding, manifestContentHash: input.manifest.manifestContentHash,
    sourcePolicy: input.manifest.sourcePolicy, segmentBounds: input.manifest.segmentBounds })
  const trades = structuredClone({ binding: input.trades.binding, tradeManifestContentHash: input.trades.tradeManifestContentHash,
    strategyAuthorityMapping: input.trades.strategyAuthorityMapping })
  assertNativeMarkerBinding(manifest, trades)
  const from = Date.parse(manifest.segmentBounds.fromInclusive), to = Date.parse(manifest.segmentBounds.toExclusive)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) throw Error('NATIVE_RESULT_BINDING_CONFLICT')
  const client = createNativeChronologicalFillClient(ownerSignal)
  let disposed = false, busy = false, eof = false, offset = 0
  let cursor: string | undefined, total: number | undefined
  let previous: { time: number; ordinal: number; ref: string } | undefined
  const dispose = () => {
    if (disposed) return
    disposed = true
    cursor = undefined; previous = undefined
    ownerSignal.removeEventListener('abort', dispose)
    client.dispose()
  }
  const assertCurrent = () => {
    if (!disposed && (ownerSignal.aborted || !isCurrent())) dispose()
    if (disposed) throw Error('NATIVE_REPLAY_DISPOSED')
  }
  ownerSignal.addEventListener('abort', dispose, { once: true })
  if (ownerSignal.aborted) dispose()
  return {
    async readNext() {
      assertCurrent()
      if (busy) throw Error('NATIVE_REPLAY_READ_BUSY')
      if (eof) return null
      busy = true
      try {
        const { body: { data } } = await client.read({ backtestId: manifest.binding.backtestId, segment: manifest.binding.segment,
          manifestContentHash: manifest.manifestContentHash, limit: 100, ...(cursor === undefined ? {} : { cursor }) })
        assertCurrent()
        assertNativeFillPageBinding(manifest, trades, data)
        const first = data.markers[0], firstTime = first && Date.parse(first.occurredAt)
        if (data.offset !== offset || total !== undefined && data.totalCount !== total
          || previous && (!first || first.fillRef === previous.ref || firstTime < previous.time
            || firstTime === previous.time && first.sourceOrdinal <= previous.ordinal)
          || data.markers.some(marker => {
            const at = Date.parse(marker.occurredAt)
            return at < from || at > to || at === to && marker.leg === 'ENTRY'
          })) throw Error('NATIVE_RESULT_BINDING_CONFLICT')
        // Atomic commit only after every local/cross-resource check succeeds.
        // A failed call keeps the exact cursor/offset for an explicit retry.
        const last = data.markers.at(-1)
        previous = last ? { time: Date.parse(last.occurredAt), ordinal: last.sourceOrdinal, ref: last.fillRef } : undefined
        total = data.totalCount; offset += data.markers.length
        cursor = data.nextCursor; eof = data.eof
        return data // SDK snapshot is deeply frozen; no private state aliases it.
      } catch (error) {
        assertCurrent()
        throw error
      } finally { busy = false }
    },
    dispose,
  }
}

export type NativeChronologicalFillReader = ReturnType<typeof createNativeChronologicalFillReader>
