import { useEffect, useState, useSyncExternalStore } from 'react'
import { createBillingPreviewStore } from './client-billing-preview-store'
import { checkBillingPreview } from './client-billing-preview-gate'

/** Public source preview only. Service requests never consult this local gate. */
export function useBillingPreview(owner: string | null) {
  const [scope, setScope] = useState(() => ({ owner, store: createBillingPreviewStore(owner) }))
  if (scope.owner !== owner) setScope({ owner, store: createBillingPreviewStore(owner) })
  const snapshot = useSyncExternalStore(scope.store.subscribe, scope.store.getSnapshot)
  useEffect(() => {
    if (!scope.owner) return
    const boot = () => scope.store.dispatch({ kind: 'boot' }, Date.now(), crypto.randomUUID())
    const tick = () => { if (!document.hidden) scope.store.dispatch({ kind: 'tick' }, Date.now(), crypto.randomUUID()) }
    boot()
    const timer = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('pageshow', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick) }
  }, [scope])
  const check = () => {
    if (!owner) return 'allowed' as const
    if (scope.owner !== owner) return 'unavailable' as const
    return checkBillingPreview(scope.store)
  }
  return { ...snapshot, store: scope.store, check }
}
