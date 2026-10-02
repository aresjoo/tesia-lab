import type { NativeReplayChartReader } from './native-replay-chart-reader'
import type { NativeReplayDisplayFill, NativeReplayFillFrame } from './native-period-replay-controller'
import type { NativePeriodReplayState } from './native-period-replay-clock'

type Page = NonNullable<Awaited<ReturnType<NativeReplayChartReader['readChronologicalMarkers']>>>
type Acknowledgement = Pick<NativePeriodReplayState, 'attemptId' | 'executionCount' | 'execution'>
export type NativeReplayFillLaneState = Readonly<{
  status: 'idle' | 'loading' | 'ready' | 'error' | 'disposed'
  consumed: number
  total: number | null
  needsPage: boolean
  frame: NativeReplayFillFrame
  failure: 'READ_FAILED' | 'DISPLAY_INVALID' | null
}>
export type NativeReplayFillLaneInput = {
  attemptId: string
  from: number
  to: number
  /** Exclusive attempt reader. Pages are already SDK/cross-resource verified
   * and deeply frozen. No raw HTTP or fabricated page may enter this port. */
  reader: Pick<NativeReplayChartReader, 'readChronologicalMarkers' | 'dispose'>
  ownerSignal: AbortSignal
  isCurrent: () => boolean
}

/** Bounded DISPLAY lane, not a schema, execution authority or price/PnL engine.
 * One displayed page + its projection, plus at most one failed candidate page
 * and the last active marker. It never requests the next page until every
 * current execution is acknowledged. A failed projection cannot evict the
 * original fields backing the still-visible page.
 */
export function createNativeReplayFillLane(input: NativeReplayFillLaneInput) {
  const { attemptId, from, to, reader, ownerSignal, isCurrent } = input
  if (!attemptId.trim() || !Number.isSafeInteger(from) || !Number.isSafeInteger(to)
    || from < 0 || from >= to || to > 253_402_300_799) throw Error('NATIVE_REPLAY_FILL_IDENTITY_INVALID')
  let started = false, disposed = false, consumed = 0, total: number | null = null
  let page: Page | null = null, index = 0
  let candidatePage: Page | null = null
  let activeMarker: Page['markers'][number] | null = null
  let last: Acknowledgement['execution'] = null
  let failure: NativeReplayFillLaneState['failure'] = null
  let operation: Promise<void> | null = null, retire: (() => void) | null = null
  let frame: NativeReplayFillFrame = Object.freeze({ through: from, eof: false, markers: Object.freeze([]) })
  let snapshot: NativeReplayFillLaneState | undefined
  const state = (): NativeReplayFillLaneState => {
    const status = disposed ? 'disposed' : failure ? 'error' : operation ? 'loading' : started ? 'ready' : 'idle'
    const needsPage = !disposed && !frame.eof && frame.next === undefined
    if (!snapshot || snapshot.status !== status || snapshot.consumed !== consumed || snapshot.total !== total
      || snapshot.needsPage !== needsPage || snapshot.frame !== frame || snapshot.failure !== failure) {
      snapshot = Object.freeze({ status, consumed, total, needsPage, frame, failure })
    }
    return snapshot
  }
  const dispose = () => {
    if (disposed) return
    disposed = true; page = null; candidatePage = null; activeMarker = null; last = null; operation = null; failure = null
    frame = Object.freeze({ through: frame.through, eof: frame.eof, markers: Object.freeze([]) })
    retire?.(); retire = null
    ownerSignal.removeEventListener('abort', dispose)
    reader.dispose()
  }
  const live = () => {
    if (!disposed && (ownerSignal.aborted || !isCurrent())) dispose()
    return !disposed
  }
  const project = (value: Page) => {
    // These are display/lane ownership checks, not another wire validator.
    if (value.offset !== consumed || value.markers.length > 100 || total !== null && value.totalCount !== total) {
      throw Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
    }
    const markers: readonly NativeReplayDisplayFill[] = Object.freeze(value.markers.map(marker => {
      const time = Date.parse(marker.occurredAt) / 1000, price = Number(marker.price)
      if (!Number.isSafeInteger(time) || time < from || time > to || !Number.isFinite(price) || price <= 0) {
        throw Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
      }
      return Object.freeze({ id: marker.fillRef, tradeId: `${marker.tradeEntryFillRef} / ${marker.tradeExitFillRef}`,
        time, price, side: marker.side, sourceOrdinal: marker.sourceOrdinal })
    }))
    if (!value.eof && !markers.length) throw Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
    const through = value.eof ? to : markers[markers.length - 1].time
    if (through < frame.through) throw Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
    page = value; candidatePage = null; index = 0; total = value.totalCount
    frame = Object.freeze({ through, eof: value.eof, markers, ...(markers[0] ? { next: markers[0] } : {}) })
  }
  const load = (): Promise<void> => {
    if (!live() || operation) return operation ?? Promise.resolve()
    failure = null
    const retired = new Promise<void>(resolve => { retire = resolve })
    const raw = Promise.resolve().then(async () => {
      if (!live()) return
      try {
        const value = await reader.readChronologicalMarkers()
        if (!live()) return
        if (value === null) throw Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
        // Keep the consumed reader result if numeric display conversion fails;
        // retry must not silently request/skip the following wire page.
        candidatePage = value
        project(value)
      } catch (error) {
        if (!live()) return
        if (error instanceof Error && error.message === 'NATIVE_REPLAY_DISPOSED') { dispose(); return }
        failure = error instanceof Error && error.message === 'NATIVE_REPLAY_FILL_DISPLAY_INVALID' ? 'DISPLAY_INVALID' : 'READ_FAILED'
      } finally { if (!disposed) { operation = null; retire = null } }
    })
    operation = Promise.race([raw, retired])
    return operation
  }
  ownerSignal.addEventListener('abort', dispose, { once: true })
  live()
  return {
    getState() { live(); return state() },
    async start() {
      if (live() && !started) { started = true; await load() }
      else await operation
      return state()
    },
    async advance() {
      if (live() && started && !failure && state().needsPage) await load()
      return state()
    },
    async retry() {
      if (live() && started && failure) {
        if (failure === 'DISPLAY_INVALID') {
          // No network retry for an already-consumed but undisplayable page.
          try { if (!candidatePage) throw Error(); project(candidatePage); failure = null } catch { /* Keep the exact failure/frame. */ }
        } else await load()
      }
      return state()
    },
    acknowledge(observation: Acknowledgement) {
      if (!live()) return state()
      const incoming = observation.execution
      const matches = (expected: Acknowledgement['execution']) => incoming === null ? expected === null
        : expected !== null && incoming.id === expected.id && incoming.time === expected.time && incoming.sourceOrdinal === expected.sourceOrdinal
      if (observation.attemptId !== attemptId || !Number.isSafeInteger(observation.executionCount)
        || observation.executionCount < consumed || observation.executionCount > consumed + 1) throw Error('NATIVE_REPLAY_FILL_ACK_INVALID')
      if (observation.executionCount === consumed) {
        if (incoming !== null && !matches(last)) throw Error('NATIVE_REPLAY_FILL_ACK_INVALID')
        return state()
      }
      if (failure || operation || !frame.next || !matches(frame.next)) throw Error('NATIVE_REPLAY_FILL_ACK_INVALID')
      last = Object.freeze({ id: frame.next.id, time: frame.next.time, sourceOrdinal: frame.next.sourceOrdinal })
      activeMarker = page?.markers[index] ?? null
      consumed++; index++
      frame = Object.freeze({ through: frame.through, eof: frame.eof, markers: frame.markers,
        ...(frame.markers[index] ? { next: frame.markers[index] } : {}) })
      return state()
    },
    /** Bounded original fields for a selected on-screen fill; no PnL inference. */
    findMarker(fillRef: string) {
      if (!live()) return null
      return activeMarker?.fillRef === fillRef ? activeMarker : page?.markers.find(marker => marker.fillRef === fillRef) ?? null
    },
    dispose,
  }
}

export type NativeReplayFillLane = ReturnType<typeof createNativeReplayFillLane>
