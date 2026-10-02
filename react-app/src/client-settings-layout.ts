import { useSyncExternalStore } from 'react'

// Client 66af72c: device-only layout preference, never account/server state.
const key = 'teth.stnav'
type Layout = { collapsed: boolean; storageError: boolean }
const listeners = new Set<() => void>()
function read(): { layout: Layout; value: string | null } {
  try {
    const value = localStorage.getItem(key)
    return { layout: { collapsed: value === '0', storageError: false }, value }
  } catch { return { layout: { collapsed: false, storageError: true }, value: null } }
}
let snapshot = read().layout
let pending: boolean | null = null
function publish(next: Layout) {
  if (next.collapsed === snapshot.collapsed && next.storageError === snapshot.storageError) return
  snapshot = next
  listeners.forEach(listener => listener())
}
export function setSettingsNavigationCollapsed(collapsed: boolean) {
  pending = collapsed
  try {
    const value = collapsed ? '0' : '1'
    localStorage.setItem(key, value)
    if (localStorage.getItem(key) === value) pending = null
  } catch { /* The current view stays usable; retry never writes other preferences. */ }
  publish({ collapsed, storageError: pending !== null })
}
const sync = (event: StorageEvent) => {
  if (event.key !== null && event.key !== key) return
  try { if (event.storageArea !== null && event.storageArea !== localStorage) return }
  catch { publish({ ...snapshot, storageError: true }); return }
  const { layout: next, value } = read()
  if (next.storageError) { publish({ ...snapshot, storageError: true }); return }
  if (pending !== null) {
    if (value === (pending ? '0' : '1')) pending = null
    else next.collapsed = pending
  }
  next.storageError = pending !== null
  publish(next)
}
window.addEventListener('storage', sync)
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener('storage', sync))
const desktop = window.matchMedia('(min-width:901px)')
const subscribeViewport = (listener: () => void) => {
  desktop.addEventListener('change', listener)
  return () => desktop.removeEventListener('change', listener)
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function useSettingsLayout() {
  const layout = useSyncExternalStore(subscribe, () => snapshot)
  const wide = useSyncExternalStore(subscribeViewport, () => desktop.matches)
  return { ...layout, wide, hidden: wide && layout.collapsed }
}
