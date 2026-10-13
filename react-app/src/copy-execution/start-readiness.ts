import { ApiV18Error } from './fixtures/api-v0.18/client.js'
import type * as Wire from './fixtures/api-v0.18/types.js'
import { CopyControllerError } from './controller'

type Snapshot = Wire.DeepReadonly<Wire.CopySnapshot>
const transient = new Set(['ACCOUNT_FACTS_UNAVAILABLE', 'RUNTIME_UNAVAILABLE'])
const same = (a: Snapshot, b: Snapshot) => ['subscriptionId', 'connectionId', 'versionId', 'policyHash', 'environment', 'exchangeId', 'startMode', 'allocationUsdt', 'maxLossUsdt', 'maxPositionFraction'].every(key => a[key as keyof Snapshot] === b[key as keyof Snapshot])
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new CopyControllerError('ABORTED')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort()
  })
}

/** Reads readiness before a new start; never submits or replays a mutation. */
export async function waitForCopyStartReadiness(created: Snapshot, read: (signal: AbortSignal) => Promise<Snapshot>, signal: AbortSignal) {
  for (const pause of [0, 100, 250, 500]) {
    if (signal.aborted) throw new CopyControllerError('ABORTED')
    if (pause) await delay(pause, signal)
    let current: Snapshot
    try { current = await read(signal) }
    catch (error) {
      if (signal.aborted) throw new CopyControllerError('ABORTED')
      if (error instanceof ApiV18Error && error.status === 503 && error.code === 'EXECUTION_UNAVAILABLE') continue
      throw error
    }
    if (signal.aborted) throw new CopyControllerError('ABORTED')
    if (!same(created, current)) throw new CopyControllerError('COPY_BINDING_MISMATCH')
    if (created.revision !== current.revision) throw new CopyControllerError('REVISION_CONFLICT')
    if (current.execution.availability.start.available) return
    const reason = current.execution.availability.start.reason
    if (!reason || !transient.has(reason)) throw new CopyControllerError(reason ?? 'EXECUTION_UNAVAILABLE')
  }
  throw new CopyControllerError('EXECUTION_UNAVAILABLE')
}


/** Internal dispatch evidence only. SDK uncertainty alone does not prove a fetch attempt. */
export function createCopyMutationDispatchObserver(fetchPort: typeof fetch) {
  const watched = new Map<string, Set<{ dispatched: boolean }>>()
  const observedFetch: typeof fetch = (input, init) => {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
    if (method === 'POST' || method === 'PATCH') {
      const key = new Headers(init?.headers ?? request?.headers).get('Idempotency-Key')
      if (key) for (const value of watched.get(key) ?? []) value.dispatched = true
    }
    return fetchPort(input, init)
  }
  return Object.freeze({ fetch: observedFetch, watch(intentId: string) {
    const value = { dispatched: false }, group = watched.get(intentId) ?? new Set<{ dispatched: boolean }>()
    group.add(value); watched.set(intentId, group)
    return Object.freeze({ get dispatched() { return value.dispatched }, release() {
      group.delete(value); if (!group.size && watched.get(intentId) === group) watched.delete(intentId)
    } })
  } })
}
