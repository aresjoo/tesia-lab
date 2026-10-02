import { priceChartIssue, type PriceChartView, type PriceFill } from '../chart/price-chart-view'
import type { ProfessionalExternalReplay } from '../chart/price-replay-frame'
import { createNativePeriodReplayClock, type NativePeriodReplayState } from './native-period-replay-clock'
import { createNativeReplayPriceWindows, type NativeReplayPriceWindow, type NativeReplayPriceWindowsInput } from './native-replay-price-windows'

/** Verified lane DISPLAY input, not a wire schema. The chronological reader
 * owns binding, strict page-chain ordering, completeness and EOF verification.
 * Never derive through/eof from the legacy v0.5 ordinal marker page. */
export type NativeReplayDisplayFill = Readonly<PriceFill & { sourceOrdinal: number }>
export type NativeReplayExternalHold = 'FILL_READ_FAILED' | 'RENDER_FAILED'
export type NativeReplayFillFrame = Readonly<{
  through: number
  eof: boolean
  next?: NativeReplayDisplayFill
  /** One bounded display page, not the whole execution history. */
  markers: readonly NativeReplayDisplayFill[]
}>
export type NativePeriodReplayPaint = Readonly<{
  window: NativeReplayPriceWindow
  view: PriceChartView
  replay: ProfessionalExternalReplay | null
}>
export type NativePeriodReplayControllerState = Readonly<{
  status: 'idle' | 'loading' | 'playing' | 'waiting' | 'error' | 'complete' | 'stopped' | 'disposed'
  clock: NativePeriodReplayState
  paint: NativePeriodReplayPaint | null
  failure: 'READ_FAILED' | 'IDENTITY_CONFLICT' | 'DISPLAY_INVALID' | NativeReplayExternalHold | null
  retryPending: boolean
}>

/** Atomic price-window/frame composition. One caller-owned ticker calls step;
 * async reads never advance the clock, promote a window or publish a frame.
 * Does not create a timer, synthetic fill, source proof, or a network adapter.
 * The caller advances its fill lane only after observing executionCount. */
export function createNativePeriodReplayController(input: NativeReplayPriceWindowsInput & {
  attemptId: string
  /** Verified manifest segment, not a fabricated extension of price coverage.
   * Executions can precede/follow the selected series' available price range. */
  segmentRange?: Readonly<{ fromInclusive: string; toExclusive: string }>
}) {
  const range = { ...(input.segmentRange ?? input.identity.availableRange) }
  const explicitRange = input.segmentRange !== undefined
  const from = Date.parse(range.fromInclusive) / 1000
  const to = Date.parse(range.toExclusive) / 1000
  const canonical = (value: string) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace('.000Z', 'Z') === value
  if (!canonical(range.fromInclusive) || !canonical(range.toExclusive)
    || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from >= to
    || Date.parse(input.identity.availableRange.fromInclusive) / 1000 < from
    || Date.parse(input.identity.availableRange.toExclusive) / 1000 > to) {
    try { input.reader.dispose() } catch { /* Keep the original invalid input. */ }
    throw Error('NATIVE_REPLAY_PRICE_IDENTITY_INVALID')
  }
  let readerDisposed = false
  const disposeReader = () => {
    if (readerDisposed) return
    readerDisposed = true
    input.reader.dispose()
  }
  const { clock, prices } = (() => {
    let createdClock: ReturnType<typeof createNativePeriodReplayClock> | undefined
    try {
      createdClock = createNativePeriodReplayClock({ ...input, from, to })
      const prices = createNativeReplayPriceWindows({ ...input, reader: {
        readWindow: selection => input.reader.readWindow(selection), dispose: disposeReader,
      } })
      return { clock: createdClock, prices }
    } catch (error) {
      createdClock?.dispose()
      try { disposeReader() } catch { /* Preserve the constructor failure. */ }
      throw error
    }
  })()
  let started = false, retired = false
  let retryDisplay = false, lastStepNow: number | null = null
  let displayInvalid = false
  // Internal read recovery is independent of the currently displayed external
  // failure. Releasing a renderer/fill hold cannot erase an unfinished retry.
  let priceFailure: 'READ_FAILED' | 'IDENTITY_CONFLICT' | null = null
  const externalHolds = new Set<NativeReplayExternalHold>() // At most two causes.
  const externalFailure = () => externalHolds.values().next().value ?? null
  let activeFill: Readonly<PriceFill> | null = null
  let lastPresented: NativeReplayDisplayFill | null = null
  let state: NativePeriodReplayControllerState = Object.freeze({ status: 'idle', clock: clock.getState(), paint: null, failure: null, retryPending: false })
  const publish = (status: NativePeriodReplayControllerState['status'], paint = state.paint,
    failure: NativePeriodReplayControllerState['failure'] = null) => {
    const nextClock = clock.getState()
    const retryPending = status === 'error' && (failure === 'READ_FAILED' || failure === 'IDENTITY_CONFLICT') && prices.getState().pending !== null
    if (state.status !== status || state.clock !== nextClock || state.paint !== paint || state.failure !== failure || state.retryPending !== retryPending) {
      state = Object.freeze({ status, clock: nextClock, paint, failure, retryPending })
    }
    return state
  }
  const dispose = () => {
    if (retired && state.status === 'disposed') return
    retired = true
    input.ownerSignal.removeEventListener('abort', dispose)
    activeFill = null; lastPresented = null; externalHolds.clear()
    try { prices.dispose() } finally { clock.dispose(); publish('disposed', null) }
  }
  const live = () => {
    if (input.ownerSignal.aborted || !input.isCurrent()) dispose()
    return !retired && state.status !== 'complete'
  }
  const copyFill = (fill: Readonly<PriceFill>): Readonly<PriceFill> => Object.freeze({
    id: fill.id, tradeId: fill.tradeId, time: fill.time, price: fill.price, side: fill.side,
  })
  const sameFill = (a: NativeReplayDisplayFill, b: NativeReplayDisplayFill) => a.id === b.id && a.time === b.time
    && a.sourceOrdinal === b.sourceOrdinal && a.tradeId === b.tradeId && a.price === b.price && a.side === b.side
  const conflicts = (a: NativeReplayDisplayFill, b: NativeReplayDisplayFill) => (a.id === b.id
    || a.time === b.time && a.sourceOrdinal === b.sourceOrdinal) && !sameFill(a, b)
  input.ownerSignal.addEventListener('abort', dispose, { once: true })
  live()
  return {
    getState() { live(); return state },
    start() {
      if (!live() || started) return
      started = true
      publish(externalHolds.size ? 'error' : 'loading', state.paint, externalFailure())
      // No await in the display driver: the first window may be ready while
      // prefetch is pending. The controller owns/catches read failures.
      void prices.start()
    },
    step(now: number, fills: NativeReplayFillFrame) {
      if (!live()) return state
      if (!started) throw new Error('NATIVE_REPLAY_NOT_STARTED')
      if (externalHolds.size || displayInvalid && !retryDisplay) return state
      try {
        let prepared = prices.getState()
        if (prepared.status === 'disposed') { dispose(); return state }
        if (prepared.failure) {
          priceFailure = prepared.failure.code
          if (clock.getState().phase !== 'idle') clock.pause(now)
          return publish('error', state.paint, prepared.failure.code)
        }
        // Starting a retry clears the price reader's failure before it succeeds.
        // Preserve the clock/frame until the explicit retry has actually settled.
        if (priceFailure && prepared.pending) return publish('error', state.paint, priceFailure)
        if (!prepared.current) return publish('loading')
        if (explicitRange && (prepared.current.manifest.segmentBounds.fromInclusive !== range.fromInclusive
          || prepared.current.manifest.segmentBounds.toExclusive !== range.toExclusive)) {
          throw new Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
        }
        // Only display fields are copied. SDK/source provenance stays in the
        // bounded lane, never inferred from these floating-point prices.
        if (!fills || !Array.isArray(fills.markers) || fills.markers.length > 100
          || priceChartIssue({ ...prepared.current.view, bars: [], fills: fills.markers }, true)
          || fills.next && priceChartIssue({ ...prepared.current.view, bars: [], fills: [fills.next] }, true)
          || fills.markers.some((fill, index, page) => !Number.isSafeInteger(fill.sourceOrdinal) || fill.sourceOrdinal < 0
            || index > 0 && (fill.time < page[index - 1].time
              || fill.time === page[index - 1].time && fill.sourceOrdinal <= page[index - 1].sourceOrdinal))
          || fills.next && fills.markers.some(fill => conflicts(fill, fills.next!))
          || lastPresented && [...fills.markers, ...(fills.next ? [fills.next] : [])].some(fill => conflicts(fill, lastPresented!))) {
          throw new Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
        }
        const execution = fills.next && { id: fills.next.id, time: fills.next.time, sourceOrdinal: fills.next.sourceOrdinal }
        clock.assertTickInput(now, { priceThrough: prepared.priceQueryEof ? to : Date.parse(prepared.current.window.requestedRange.toExclusive) / 1000,
          priceEof: prepared.priceQueryEof, fillsThrough: fills.through, fillsEof: fills.eof, execution })
        const prior = clock.getState()
        if (prior.phase === 'idle') clock.start(now)
        else if (prior.phase === 'paused') clock.resume(now)
        // Reissue the SAME target after a pending window arrives. Only one
        // promotion per step, and do not allocate promises while a read is held.
        // An active execution keeps its current canvas window for the full dwell.
        if (!prepared.pending && clock.getState().phase !== 'dwell') {
          void prices.advanceTo(Math.max(clock.getState().time, Date.parse(input.identity.availableRange.fromInclusive) / 1000))
          prepared = prices.getState()
        }
        const current = prepared.current!
        if (explicitRange && (current.manifest.segmentBounds.fromInclusive !== range.fromInclusive
          || current.manifest.segmentBounds.toExclusive !== range.toExclusive)) throw new Error('NATIVE_REPLAY_FILL_DISPLAY_INVALID')
        // EOF proves there are no further price windows, not that a late fill
        // belongs to the last candle. Keep the real bars and gap notice intact.
        const priceThrough = prepared.priceQueryEof ? to : Date.parse(current.window.requestedRange.toExclusive) / 1000
        const next = clock.tick(now, {
          priceThrough,
          priceEof: prepared.priceQueryEof,
          fillsThrough: fills.through, fillsEof: fills.eof,
          // [from, to) boundary fills belong to the NEXT window. Wait at that
          // exact time, promote on the next step, then accept/display the event.
          // A terminal segmentEnd fill is different: preserve its gap notice.
          execution: execution?.time === priceThrough && !prepared.priceQueryEof ? undefined : execution,
        })
        lastStepNow = now; retryDisplay = false; displayInvalid = false; priceFailure = null
        if (next.executionCount !== prior.executionCount) {
          activeFill = copyFill(fills.next!)
          lastPresented = Object.freeze({ ...activeFill, sourceOrdinal: fills.next!.sourceOrdinal })
        }
        if (!next.execution) activeFill = null
        const visible: Readonly<PriceFill>[] = fills.markers.filter(fill => fill.time < next.time
          || fill.time === next.time && lastPresented?.time === next.time && fill.sourceOrdinal <= lastPresented.sourceOrdinal)
        if (activeFill && !visible.some(fill => fill.id === activeFill!.id)) visible.push(activeFill)
        const status = next.phase === 'complete' ? 'complete' : next.phase === 'waiting' ? 'waiting' : 'playing'
        const previous = state.paint, frame = previous?.replay?.frame
        const sameView = previous?.window === current
          && visible.length === previous.view.fills.length && visible.every((fill, index) => {
            const old = previous.view.fills[index]
            return fill.id === old.id && fill.tradeId === old.tradeId && fill.time === old.time && fill.price === old.price && fill.side === old.side
          })
        if (sameView && frame?.time === next.time && frame.progress === next.progress
          && frame.state === status && frame.fillId === (next.execution?.id ?? null)) return publish(status, previous)
        // Clock-only updates are new frames, not new price/marker data. Keep
        // the frozen view so renderer validation and study memos stay bounded
        // to actual window/fill changes rather than every 80ms tick.
        const view: PriceChartView = sameView ? previous.view
          : Object.freeze({ ...current.view, fills: Object.freeze(visible.map(copyFill)) })
        const replay: ProfessionalExternalReplay = Object.freeze({ attemptId: next.attemptId, frame: Object.freeze({
          attemptId: next.attemptId, viewIdentity: view.identity, time: next.time, progress: next.progress,
          state: status,
          fillId: next.execution?.id ?? null,
        }) })
        return publish(status,
          Object.freeze({ window: current, view, replay }))
      } catch (error) {
        if (!(error instanceof Error) || !['NATIVE_REPLAY_FILL_DISPLAY_INVALID', 'NATIVE_REPLAY_CLOCK_INPUT_INVALID'].includes(error.message)) throw error
        // An invalid display input must not keep accumulating elapsed time.
        // Freeze at the last accepted frame, then require explicit revalidation.
        if (clock.getState().phase !== 'idle' && lastStepNow !== null) clock.pause(lastStepNow)
        retryDisplay = false; displayInvalid = true
        return publish('error', state.paint, 'DISPLAY_INVALID')
      }
    },
    /** The only way a failed price read is retried. No clock time is advanced
     * by completion; a subsequent step resumes with zero catch-up elapsed. */
    async retry(): Promise<NativePeriodReplayControllerState> {
      if (live() && started && !externalHolds.size) {
        if (displayInvalid) retryDisplay = true
        priceFailure = prices.getState().failure?.code ?? priceFailure
        // A bad display frame and a failed prefetch can coexist. Revalidating
        // the former must not make the latter permanently unreachable.
        if (priceFailure || !displayInvalid) {
          await prices.retry()
        }
      }
      live()
      return state
    },
    /** External data/renderer failures stop this same clock. Repeated holds
     * cannot consume dwell, and releasing one cause cannot release another. */
    suspend(now: number, reason: NativeReplayExternalHold) {
      if (!live()) return state
      if (reason !== 'FILL_READ_FAILED' && reason !== 'RENDER_FAILED') throw Error('NATIVE_REPLAY_HOLD_INVALID')
      externalHolds.add(reason)
      if (clock.getState().phase !== 'idle') {
        try { clock.pause(now) } catch (error) {
          if (!(error instanceof Error) || error.message !== 'NATIVE_REPLAY_CLOCK_INPUT_INVALID') throw error
          // A renderer callback must never reopen replay because its timestamp
          // is missing or from another clock. Freeze at the last accepted tick;
          // this conservatively preserves dwell instead of advancing the frame.
          if (lastStepNow !== null) clock.pause(lastStepNow)
        }
      }
      return publish('error', state.paint, externalFailure())
    },
    /** Caller releases only its recovered cause. No elapsed time or frame is
     * consumed here; the next explicit step performs clock.resume(now). */
    resume(reason: NativeReplayExternalHold) {
      if (!live() || !externalHolds.has(reason)) return state
      externalHolds.delete(reason)
      if (externalHolds.size) return publish('error', state.paint, externalFailure())
      const prepared = prices.getState()
      if (prepared.status === 'disposed') { dispose(); return state }
      // Reads can settle while an external hold prevents step(). Reflect the
      // latest failure, but retain the retry latch until its read has settled.
      priceFailure = prepared.failure?.code ?? (prepared.pending ? priceFailure : null)
      if (displayInvalid) return publish('error', state.paint, 'DISPLAY_INVALID')
      if (priceFailure) return publish('error', state.paint, priceFailure)
      return publish(!started ? 'idle' : state.paint ? 'waiting' : 'loading')
    },
    skip() {
      if (!live()) return state
      retired = true
      input.ownerSignal.removeEventListener('abort', dispose)
      activeFill = null; lastPresented = null; externalHolds.clear()
      try { prices.dispose() } finally {
        clock.skip()
        publish('stopped', state.paint && Object.freeze({ ...state.paint, replay: null }))
      }
      return state
    },
    dispose,
  }
}

export type NativePeriodReplayController = ReturnType<typeof createNativePeriodReplayController>
