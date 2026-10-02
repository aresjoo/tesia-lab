/** Account-bound local preview preferences. Never persists service authority,
 * credentials, balances, quotas, or fabricated execution/notification records. */
import { createSourceAccountEventState, readAllSourceNotifications, readSourceNotification, setSourceNotificationPreference, type SourceAccountEventState, type SourceNotificationPreferenceKey, type SourceNotificationPreferences } from './client-account-event-state'

export const CLIENT_ACCOUNT_PREFERENCES_KEY = 'teth-client-account-preferences'
export const clientAccountPreferencesKey = (owner: string) => `${CLIENT_ACCOUNT_PREFERENCES_KEY}:${encodeURIComponent(owner)}`
type Snapshot = { state: SourceAccountEventState; storageError: boolean }
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
const keys: readonly SourceNotificationPreferenceKey[] = ['pos', 'loss', 'review', 'rebate', 'watch', 'chW', 'chK', 'chT', 'chM']

export function createClientAccountEventStore(owner: string | null, storage?: StoragePort) {
  let snapshot: Snapshot = { state: createSourceAccountEventState(), storageError: false }
  const listeners = new Set<() => void>()
  const port = () => storage ?? sessionStorage
  let loaded = !owner
  const pending = new Map<SourceNotificationPreferenceKey, boolean>()
  const emit = (next: Snapshot) => { if (next !== snapshot) { snapshot = next; listeners.forEach(listener => listener()) } }
  const restore = () => {
    if (!owner) return true
    try {
      const raw = port().getItem(clientAccountPreferencesKey(owner)) ?? port().getItem(CLIENT_ACCOUNT_PREFERENCES_KEY)
      const record: unknown = raw === null ? null : JSON.parse(raw)
      if (record && typeof record === 'object' && 'owner' in record && record.owner === owner) {
        const prefs = 'prefs' in record ? record.prefs : null
        if (!prefs || typeof prefs !== 'object' || !keys.every(key => key in prefs && typeof Reflect.get(prefs, key) === 'boolean')) throw new TypeError('Invalid preview preferences')
        // Only these booleans cross the persistence boundary. chW is always on.
        const clean = Object.fromEntries(keys.map(key => [key, key === 'chW' || Reflect.get(prefs, key)])) as SourceNotificationPreferences
        let next = createSourceAccountEventState({ ...snapshot.state, notifPrefs: clean })
        for (const [key, value] of pending) next = setSourceNotificationPreference(next, key, value)
        emit({ ...snapshot, state: next })
      }
      loaded = true
      return true
    } catch { emit({ ...snapshot, storageError: true }); return false }
  }
  restore()
  const save = () => {
    if (!owner) return
    // Recover unread preferences before saving; merge only explicit user edits.
    if (!loaded && !restore()) return
    try {
      port().setItem(clientAccountPreferencesKey(owner), JSON.stringify({ owner, prefs: snapshot.state.notifPrefs }))
      pending.clear()
      if (snapshot.storageError) emit({ ...snapshot, storageError: false })
    } catch { if (!snapshot.storageError) emit({ ...snapshot, storageError: true }) }
  }
  const update = (next: SourceAccountEventState) => { if (next !== snapshot.state) emit({ ...snapshot, state: next }) }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    preference: (key: SourceNotificationPreferenceKey, value: boolean) => {
      if (!owner) return
      pending.set(key, value)
      update(setSourceNotificationPreference(snapshot.state, key, value)); save()
    },
    read: (id: string) => { if (owner) update(readSourceNotification(snapshot.state, id)) },
    readAll: () => { if (owner) update(readAllSourceNotifications(snapshot.state)) },
    retrySave: save,
  }
}
