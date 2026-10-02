import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { createCatalogueCopyAccountController } from './client-catalogue-copy-account'
import { readCatalogueCopyAccount, type CatalogueCopyStorage } from './client-catalogue-copy-store'

type Controller = ReturnType<typeof createCatalogueCopyAccountController>
export type CatalogueCopyInspection = Awaited<ReturnType<Controller['inspect']>>

/** Subscriptions own the controller/worker. Strict Effects can unsubscribe and
 * resubscribe without reusing a disposed controller; rendering never starts a worker. */
export function createCatalogueCopyViewStore(owner: string | null, storage?: CatalogueCopyStorage, factory = createCatalogueCopyAccountController) {
  let controller: Controller | null = null, disconnect: (() => void) | undefined
  let epoch = 0
  let observedRaw: string | null | undefined
  let snapshot: ReturnType<Controller['getSnapshot']> & { epoch: number } = { ...(owner ? readCatalogueCopyAccount(owner, storage) : { state: null, error: null, raw: undefined }), busy: false, actionError: null, epoch }
  const listeners = new Set<() => void>()
  const observeWaiting = () => {
    const captured = controller, raw = snapshot.raw
    if (!captured || !listeners.size || snapshot.error || snapshot.busy || raw === observedRaw
      || !snapshot.state?.copies.some(entry => entry.record.status === 'active' && entry.stopMode === 'wait')) return
    observedRaw = raw
    // No interval: immutable source data needs one observation per committed
    // ledger revision. Yield so subscription setup and Strict cleanup finish.
    queueMicrotask(() => {
      if (controller !== captured || !listeners.size || snapshot.raw !== raw || snapshot.busy || snapshot.error) {
        if (controller === captured && observedRaw === raw) observedRaw = undefined
        return
      }
      void captured.reconcileWaiting(Date.now())
    })
  }
  const emit = () => { if (controller) snapshot = { ...controller.getSnapshot(), epoch }; listeners.forEach(listener => listener()); observeWaiting() }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (owner && !controller) { epoch++; observedRaw = undefined; controller = factory(owner, storage); disconnect = controller.subscribe(emit); emit() }
      return () => { listeners.delete(listener); if (!listeners.size) { disconnect?.(); disconnect = undefined; controller?.dispose(); controller = null } }
    },
    inspect(id: string, signal: AbortSignal, detail = false) { return controller ? controller.inspect(id, signal, detail) : Promise.reject(Error('catalogue copy unavailable')) },
    market(strategyId: string, asset: string, signal: AbortSignal) { return controller ? controller.market(strategyId, asset, signal) : Promise.reject(Error('catalogue chart unavailable')) },
    retry() { observedRaw = undefined; controller?.retry() },
    adjust(...args: Parameters<Controller['adjust']>) { return controller?.adjust(...args) ?? Promise.resolve({ ok: false as const, error: 'cancelled' as const }) },
    stop(...args: Parameters<Controller['stop']>) { return controller?.stop(...args) ?? Promise.resolve({ ok: false as const, error: 'cancelled' as const }) },
    flatten(...args: Parameters<Controller['flatten']>) { return controller?.flatten(...args) ?? Promise.resolve({ ok: false as const, error: 'cancelled' as const }) },
  }
}

export function useCatalogueCopyAccount(owner: string | null) {
  const store = useMemo(() => createCatalogueCopyViewStore(owner), [owner])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return useMemo(() => ({ ...snapshot, store, owner }), [snapshot, store, owner])
}
export type CatalogueCopyView = ReturnType<typeof useCatalogueCopyAccount>

export function useCatalogueCopyInspection(account: CatalogueCopyView, id: string, detail = false) {
  const { store, raw, error, owner, epoch } = account
  const [attempt, setAttempt] = useState(0)
  const key = useMemo(() => ({ owner, raw, error, id, attempt, epoch, detail }), [owner, raw, error, id, attempt, epoch, detail])
  const [result, setResult] = useState<{ key: typeof key; state: 'ready' | 'error'; data?: CatalogueCopyInspection } | null>(null)
  useEffect(() => {
    if (!owner || !id || error || !epoch) return
    const request = new AbortController()
    void store.inspect(id, request.signal, detail).then(data => { if (!request.signal.aborted) setResult({ key, state: 'ready', data }) },
      () => { if (!request.signal.aborted) setResult({ key, state: 'error' }) })
    return () => request.abort()
  }, [store, owner, raw, error, id, key, epoch, detail])
  return { state: error ? 'error' as const : result?.key === key ? result.state : 'loading' as const,
    data: !error && result?.key === key ? result.data : undefined,
    retry: () => { store.retry(); setAttempt(n => n + 1) } }
}
