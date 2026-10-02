import { EXECUTION_DWELL_MS, PRICE_REPLAY_DURATION_MS } from '../chart/price-execution-timeline'

/** Display scheduling, not market/order semantics. The source reader must
 * verify chronological (time, sourceOrdinal) order and page continuity first. */
export type NativeReplayExecution = Readonly<{ id: string; time: number; sourceOrdinal: number }>
export type NativeReplayFrontier = Readonly<{
  /** Inclusive UTC-seconds limits supplied by the bounded coordinators.
   * A v0.5 marker page end is NOT a valid fillsThrough proof. */
  priceThrough: number
  fillsThrough: number
  priceEof: boolean
  fillsEof: boolean
  /** Earliest not-yet-presented execution, if one is known. The caller must
   * not claim fillsThrough past any unprovided execution. At most one event
   * is accepted per tick; the caller observes executionCount before advancing. */
  execution?: NativeReplayExecution
}>
export type NativePeriodReplayState = Readonly<{
  attemptId: string
  phase: 'idle' | 'playing' | 'waiting' | 'dwell' | 'paused' | 'complete' | 'stopped' | 'disposed'
  time: number
  progress: number
  waitingFor: 'price' | 'fills' | null
  execution: NativeReplayExecution | null
  executionCount: number
}>
export type NativePeriodReplayClockInput = Readonly<{
  attemptId: string
  from: number
  to: number
  ownerSignal: AbortSignal
  isCurrent: () => boolean
}>

const invalid = (): never => { throw new Error('NATIVE_REPLAY_CLOCK_INPUT_INVALID') }
const timeValid = (value: number) => Number.isFinite(value) && value >= 0 && value <= 253_402_300_799
const nowValid = (value: number) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER - EXECUTION_DWELL_MS

/** One attempt-wide clock, driven by ONE caller-owned monotonic timer. It does
 * not allocate timers, request data, cache windows/pages, restart per window,
 * interpolate missing prices, or treat a display end as job completion.
 * Data waits discard elapsed waiting time; each supplied execution receives
 * at least 600 ms of display time, extending the nominal 60-second price path.
 * Snapshot memory is constant regardless of period or execution count. */
export function createNativePeriodReplayClock(input: NativePeriodReplayClockInput) {
  const { attemptId, from, to, ownerSignal, isCurrent } = input
  if (typeof attemptId !== 'string' || !attemptId.trim() || !timeValid(from) || !timeValid(to) || from >= to) invalid()
  let state: NativePeriodReplayState = Object.freeze({ attemptId, phase: 'idle', time: from, progress: 0,
    waitingFor: null, execution: null, executionCount: 0 })
  let lastNow: number | null = null, holdUntil = 0
  let lastExecution: NativeReplayExecution | null = null
  let suspended: { phase: 'playing' | 'waiting' | 'dwell'; dwellRemaining: number } | null = null
  const publish = (next: NativePeriodReplayState) => {
    if (next.phase !== state.phase || next.time !== state.time || next.progress !== state.progress
      || next.waitingFor !== state.waitingFor || next.execution !== state.execution || next.executionCount !== state.executionCount) state = Object.freeze(next)
    return state
  }
  const dispose = () => {
    ownerSignal.removeEventListener('abort', dispose)
    if (state.phase !== 'disposed') publish({ ...state, phase: 'disposed', execution: null, waitingFor: null })
    lastExecution = null; suspended = null
  }
  const live = () => {
    if (state.phase !== 'disposed' && (ownerSignal.aborted || !isCurrent())) dispose()
    return !['disposed', 'stopped', 'complete'].includes(state.phase)
  }
  const checkNow = (now: number) => {
    if (!nowValid(now) || lastNow !== null && now < lastNow) invalid()
  }
  const validate = (frontier: NativeReplayFrontier) => {
    if (!frontier || typeof frontier !== 'object' || !timeValid(frontier.priceThrough) || !timeValid(frontier.fillsThrough)
      || frontier.priceThrough < state.time || frontier.priceThrough > to || frontier.fillsThrough < state.time || frontier.fillsThrough > to
      || typeof frontier.priceEof !== 'boolean' || typeof frontier.fillsEof !== 'boolean'
      || frontier.priceEof && frontier.priceThrough !== to || frontier.fillsEof && frontier.fillsThrough !== to) invalid()
    const value = frontier.execution
    if (value === undefined) return null
    if (!value || typeof value.id !== 'string' || !value.id.trim() || !timeValid(value.time) || value.time < from || value.time > to
      || !Number.isSafeInteger(value.sourceOrdinal) || value.sourceOrdinal < 0) return invalid()
    if (lastExecution) {
      if (value.time === lastExecution.time && value.sourceOrdinal === lastExecution.sourceOrdinal) {
        if (value.id !== lastExecution.id) invalid()
        return null // Same observation still in the caller's acknowledged slot.
      }
      if (value.time < lastExecution.time || value.time === lastExecution.time && value.sourceOrdinal < lastExecution.sourceOrdinal
        || value.id === lastExecution.id) invalid()
    }
    if (value.time < state.time) invalid()
    return Object.freeze({ id: value.id, time: value.time, sourceOrdinal: value.sourceOrdinal })
  }
  ownerSignal.addEventListener('abort', dispose, { once: true })
  live()
  return {
    getState() { live(); return state },
    /** Preflight for atomic composition: validate without starting/resuming
     * this clock or promoting a price window. Owner retirement still applies. */
    assertTickInput(now: number, frontier: NativeReplayFrontier) {
      if (!live()) return
      checkNow(now)
      validate(frontier)
    },
    start(now: number) {
      if (!live() || state.phase !== 'idle') return state
      checkNow(now)
      lastNow = now
      return publish({ ...state, phase: 'playing' })
    },
    tick(now: number, frontier: NativeReplayFrontier) {
      if (!live()) return state
      if (state.phase === 'paused') return state
      if (state.phase === 'idle') return invalid()
      checkNow(now)
      const execution = validate(frontier)
      let elapsed = now - lastNow!
      // Validation is atomic: invalid input cannot consume elapsed time.
      lastNow = now
      if (state.phase === 'dwell') {
        if (now < holdUntil) return state
        elapsed = now - holdUntil
      } else if (state.phase === 'waiting') elapsed = 0
      const target = Math.min(to, state.time + elapsed * (to - from) / PRICE_REPLAY_DURATION_MS)
      let time = Math.min(target, frontier.priceThrough, frontier.fillsThrough)
      if (execution && execution.time <= time) {
        time = execution.time
        lastExecution = execution; holdUntil = now + EXECUTION_DWELL_MS
        return publish({ ...state, phase: 'dwell', time, progress: (time - from) / (to - from),
          waitingFor: null, execution, executionCount: state.executionCount + 1 })
      }
      const waitingFor = time === frontier.priceThrough && !frontier.priceEof ? 'price'
        : time === frontier.fillsThrough && !frontier.fillsEof ? 'fills' : null
      const complete = time === to && frontier.priceEof && frontier.fillsEof
      return publish({ ...state, phase: complete ? 'complete' : waitingFor ? 'waiting' : 'playing', time,
        progress: (time - from) / (to - from), waitingFor, execution: null })
    },
    /** Read/renderer failures freeze the last frame, not a synthetic time
     * frontier. The coordinator resumes explicitly after a successful retry. */
    pause(now: number) {
      if (!live() || state.phase === 'paused') return state
      if (state.phase !== 'playing' && state.phase !== 'waiting' && state.phase !== 'dwell') return invalid()
      checkNow(now)
      suspended = { phase: state.phase, dwellRemaining: state.phase === 'dwell' ? Math.max(0, holdUntil - now) : 0 }
      lastNow = now
      return publish({ ...state, phase: 'paused' })
    },
    resume(now: number) {
      if (!live() || state.phase !== 'paused' || !suspended) return state
      checkNow(now)
      const saved = suspended
      suspended = null; lastNow = now
      if (saved.phase === 'dwell') holdUntil = now + saved.dwellRemaining
      return publish({ ...state, phase: saved.phase })
    },
    skip() {
      if (live()) {
        ownerSignal.removeEventListener('abort', dispose)
        publish({ ...state, phase: 'stopped', execution: null, waitingFor: null })
      }
      return state
    },
    dispose,
  }
}

export type NativePeriodReplayClock = ReturnType<typeof createNativePeriodReplayClock>
