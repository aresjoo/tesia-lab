import { ApiV07Error } from './contracts/generated/api-v0.7/client'
import type { NativeJob } from './native-service-api'

type Clock = { set: (callback: () => void, delay: number) => number; clear: (timer: number) => void }
type Observation = { ok: true } | { ok: false; failure: unknown } | null
type Options = {
  read: () => Promise<NativeJob>
  isCurrent: () => boolean
  accept: (job: NativeJob) => void
  onFailure: (retrying: boolean) => void
  clock?: Clock
  random?: () => number
  visibility?: { hidden: () => boolean; subscribe: (listener: () => void) => () => void }
}
const terminal = (job: NativeJob) => ['COMPLETED', 'FAILED', 'INVALID'].includes(job.state)

/** GET observations only. Never resubmits a job or invents a server state.
 * One automatic read at a time; transient errors back off to at most 30s.
 * Invalid responses, authority and binding failures require explicit recovery.
 */
export function startNativeJobPolling({ read, isCurrent, accept, onFailure,
  clock = { set: (fn, delay) => window.setTimeout(fn, delay), clear: timer => window.clearTimeout(timer) },
  random = Math.random,
  visibility,
}: Options): { stop: () => void; refresh: () => Promise<Observation> } {
  let stopped = false, failures = 0, timer: number | undefined
  let automatic = true, hidden = visibility?.hidden() ?? false
  let inFlight: Promise<Observation> | null = null
  const current = () => !stopped && isCurrent()
  const schedule = (delay: number) => {
    if (!current()) return
    if (timer !== undefined) clock.clear(timer)
    timer = clock.set(() => { timer = undefined; void poll() }, hidden ? Math.max(30_000, delay) : delay)
  }
  const observe = async (): Promise<Observation> => {
    try {
      const job = await read()
      if (!current()) return null
      accept(job)
      failures = 0
      automatic = !terminal(job)
      if (automatic) schedule(1500)
      return { ok: true }
    } catch (failure) {
      if (!current()) return null
      const retrying = failure instanceof ApiV07Error && ['TRANSPORT_FAILED', 'INTERNAL_ERROR'].includes(failure.code)
      automatic = retrying
      onFailure(retrying)
      if (retrying) {
        failures = Math.min(failures + 1, 5)
        const sample = random()
        const jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) * 500 : 0
        const base = Math.min(30_000, 1500 * 2 ** failures)
        schedule(base === 30_000 ? base - jitter : base + jitter)
      }
      return { ok: false, failure }
    }
  }
  const poll = (): Promise<Observation> => {
    if (!current()) return Promise.resolve(null)
    if (inFlight) return inFlight
    if (timer !== undefined) { clock.clear(timer); timer = undefined }
    // Start on a microtask so even a synchronously throwing read is covered by
    // the same in-flight lease used by manual and automatic observations.
    const task = Promise.resolve().then(() => current() ? observe() : null)
    const settled = task.finally(() => { if (inFlight === settled) inFlight = null })
    inFlight = settled
    return settled
  }
  const unsubscribe = visibility?.subscribe(() => {
    const next = visibility.hidden()
    if (next === hidden) return
    hidden = next
    if (!current() || !automatic || inFlight) return
    // Hiding only slows GET observation; it does not cancel the server job.
    // Returning to a healthy job catches up once. Error backoff and explicit
    // recovery boundaries cannot be bypassed by repeatedly changing tabs.
    if (hidden) schedule(30_000)
    else if (failures === 0) void poll()
  })
  schedule(1500)
  return {
    stop: () => { stopped = true; if (timer !== undefined) clock.clear(timer); unsubscribe?.() },
    refresh: () => { if (!inFlight) failures = 0; return poll() },
  }
}
