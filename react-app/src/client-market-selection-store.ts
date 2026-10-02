export type MarketSelectionStorage = Pick<Storage, 'getItem' | 'setItem'>
type Saved = { v: 1; lastId: string | null; favorites: string[] }
type Snapshot = Saved & { manualId: string | null; storageError: boolean }
const empty = (): Saved => ({ v: 1, lastId: null, favorites: [] })
function decode(raw: string | null): Saved {
  if (!raw) return empty()
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw Error('invalid preferences')
  const v = value as Partial<Saved>
  if (v.v !== 1 || !(v.lastId === null || typeof v.lastId === 'string' && v.lastId.trim()) || !Array.isArray(v.favorites)
    || v.favorites.some(id => typeof id !== 'string' || !id.trim())) throw Error('invalid preferences')
  return { v: 1, lastId: v.lastId, favorites: [...new Set(v.favorites)] }
}
/** UI choices only. Caller keeps this store across page navigation; a new
 * browser lifetime starts in strategy-follow mode, with lastId as fallback. */
export function createMarketSelectionStore(scope: string, identity: string, suppliedStorage?: MarketSelectionStorage) {
  const key = `teth.market-selection:${JSON.stringify([scope, identity])}`
  const storage = () => suppliedStorage ?? localStorage
  let snapshot: Snapshot
  try { snapshot = { ...decode(storage().getItem(key)), manualId: null, storageError: false } }
  catch { snapshot = { ...empty(), manualId: null, storageError: true } }
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach(listener => listener())
  const favoriteEdits = new Map<string, boolean>()
  let selectedEdit: string | undefined
  const save = () => {
    let base: Saved = { v: 1, lastId: snapshot.lastId, favorites: snapshot.favorites }
    try { base = decode(storage().getItem(key)) } catch { /* Retry against the last readable snapshot. */ }
    const favorites = new Set(base.favorites)
    favoriteEdits.forEach((enabled, id) => { if (enabled) favorites.add(id); else favorites.delete(id) })
    const value: Saved = { v: 1, lastId: selectedEdit ?? base.lastId, favorites: [...favorites] }
    snapshot = { ...snapshot, ...value, storageError: true }
    try {
      const raw = JSON.stringify(value)
      storage().setItem(key, raw)
      if (storage().getItem(key) === raw) {
        snapshot = { ...snapshot, storageError: false }
        favoriteEdits.clear(); selectedEdit = undefined
      }
    } catch { /* Keep visible unsaved choices; never silently claim persistence. */ }
    emit(); return !snapshot.storageError
  }
  const sync = (event: StorageEvent) => {
    if (event.key !== null && event.key !== key || snapshot.storageError) return
    try { snapshot = { ...snapshot, ...decode(storage().getItem(key)) }; emit() } catch { snapshot = { ...snapshot, storageError: true }; emit() }
  }
  return {
    scope, identity,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', sync)
      return () => { listeners.delete(listener); if (!listeners.size && typeof window !== 'undefined') window.removeEventListener('storage', sync) }
    },
    select(id: string) { if (!id.trim()) return false; snapshot = { ...snapshot, manualId: id }; selectedEdit = id; return save() },
    follow() { if (snapshot.manualId !== null) { snapshot = { ...snapshot, manualId: null }; emit() } },
    favorite(id: string, enabled: boolean) {
      if (!id.trim()) return false
      favoriteEdits.set(id, enabled)
      return save()
    },
    retry: save,
  }
}
export type MarketSelectionStore = ReturnType<typeof createMarketSelectionStore>
