/** Source sharing UI choices only. No account, publication, or trade authority. */
import { myExchangeIds, type MyExchangeFilter } from './client-my-exchanges'
import type { StrategyKindFilter, StrategyMarketFilter } from './client-strategy-classification'
export type SharingPreferences = {
  tab: 'find' | 'follow' | 'mine'
  sort: 'pick' | 'ret' | 'score' | 'mdd' | 'winrate' | 'fw'
  dir: 'asc' | 'desc'
  asset: 'all' | '비트코인' | '이더리움' | '나스닥'
  /** Absent in legacy storage. The current toolbar treats absence as all. */
  kind?: StrategyKindFilter
  market?: StrategyMarketFilter
  myExchange?: MyExchangeFilter
  /** Source pagination only; absent saved preferences remain on page one. */
  page?: number
}
export type SharingPreferenceSnapshot = {
  readonly preferences: Readonly<SharingPreferences>
  readonly query: string
  readonly storageError: boolean
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const defaults: Readonly<SharingPreferences> = Object.freeze({ tab: 'find', sort: 'pick', dir: 'desc', asset: 'all' })
const legacyFields = ['tab', 'sort', 'dir', 'asset'] as const
const fields = [...legacyFields, 'kind', 'market', 'myExchange', 'page'] as const
const allowed: { [K in keyof SharingPreferences]-?: readonly SharingPreferences[K][] } = {
  tab: ['find', 'follow', 'mine'], sort: ['pick', 'ret', 'score', 'mdd', 'winrate', 'fw'],
  dir: ['asc', 'desc'], asset: ['all', '비트코인', '이더리움', '나스닥'],
  myExchange: ['', 'all', ...myExchangeIds],
  page: Array.from({ length: 10 }, (_, index) => index + 1),
  kind: ['all', 'agent', 'rule', 'mix'], market: ['all', 'crypto', 'stock', 'index', 'multi'],
}

function ownerKey(owner: unknown): string | null {
  if (typeof owner !== 'string' || !owner.length || owner.length > 320 || owner.trim() !== owner
    || Array.from(owner).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null
  try { return `teth-sharing-preferences:account:${encodeURIComponent(owner)}` }
  catch { return null }
}

function validField(key: keyof SharingPreferences, value: unknown) {
  return (allowed[key] as readonly unknown[]).includes(value)
}

function decode(raw: string | null): SharingPreferences {
  if (raw === null) return { ...defaults }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !legacyFields.every(key => Object.hasOwn(value, key))
    || !fields.every(key => !Object.hasOwn(value, key) || validField(key, Reflect.get(value, key)))) throw new Error('Invalid sharing preferences')
  return Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, Reflect.get(value, key)])) as SharingPreferences
}

function patchValue(value: unknown): Partial<SharingPreferences> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  try {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return null
    const keys = Reflect.ownKeys(value)
    if (!keys.every(key => typeof key === 'string' && fields.includes(key as keyof SharingPreferences)
      && 'value' in Object.getOwnPropertyDescriptor(value, key)!
      && validField(key as keyof SharingPreferences, Reflect.get(value, key)))) return null
    return { ...value }
  } catch { return null }
}

export function createClientSharingPreferencesStore(owner: string | null, storage?: StoragePort) {
  const guest = owner === null, key = ownerKey(owner), validOwner = guest || key !== null
  const port = () => storage ?? localStorage
  let loaded = guest, dirty: Partial<SharingPreferences> = {}, pendingClear = false
  let resetBeforeRecovery = false
  let snapshot: SharingPreferenceSnapshot = Object.freeze({ preferences: defaults, query: '', storageError: !validOwner })
  const listeners = new Set<() => void>()
  const emit = (preferences: Readonly<SharingPreferences>, query: string, storageError: boolean) => {
    const samePreferences = fields.every(field => preferences[field] === snapshot.preferences[field])
    if (samePreferences && query === snapshot.query && storageError === snapshot.storageError) return
    snapshot = Object.freeze({ preferences: samePreferences ? snapshot.preferences : Object.freeze({ ...preferences }), query, storageError })
    for (const listener of [...listeners]) {
      try { listener() } catch { /* A view subscriber cannot block persistence or another subscriber. */ }
    }
  }
  if (key) {
    try { emit(decode(port().getItem(key)), '', false); loaded = true }
    catch { emit(defaults, '', true) }
  }
  const save = (preferences: SharingPreferences): boolean => {
    if (guest) { dirty = {}; emit(preferences, snapshot.query, false); return true }
    if (!key || !loaded) { emit(preferences, snapshot.query, true); return false }
    try {
      port().setItem(key, JSON.stringify(preferences))
      dirty = {}; resetBeforeRecovery = false
      emit(preferences, snapshot.query, false)
      return true
    } catch { emit(preferences, snapshot.query, true); return false }
  }
  const clear = (): boolean => {
    if (!validOwner) return false
    dirty = {}; pendingClear = !guest; resetBeforeRecovery = false
    if (guest) { emit(defaults, '', false); return true }
    try {
      port().removeItem(key!)
      loaded = true; pendingClear = false
      emit(defaults, '', false)
      return true
    } catch { emit(defaults, '', true); return false }
  }
  return {
    getSnapshot: (): SharingPreferenceSnapshot => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    update(patch: Partial<SharingPreferences>): boolean {
      const clean = patchValue(patch)
      if (!validOwner || !clean) return false
      if (!Object.keys(clean).length) return true
      // A new explicit choice after failed clear supersedes deletion, while
      // retaining the user's reset of the other fields in any recovery merge.
      if (pendingClear) resetBeforeRecovery = true
      dirty = { ...(pendingClear ? defaults : dirty), ...clean }; pendingClear = false
      return save({ ...snapshot.preferences, ...clean })
    },
    setQuery(query: string): void {
      if (typeof query === 'string') emit(snapshot.preferences, query, snapshot.storageError)
    },
    retrySave(): boolean {
      if (!validOwner) return false
      if (pendingClear) return clear()
      if (guest) return true
      if (!snapshot.storageError && !Object.keys(dirty).length) return true
      // Re-read before recovering an unread/corrupt store. Only explicit edits
      // may override the newly observed saved preference; query never persists.
      if (!loaded) {
        try {
          const saved = decode(port().getItem(key!))
          const recovered = { ...(resetBeforeRecovery ? defaults : saved), ...dirty }
          loaded = true
          if (!Object.keys(dirty).length) { emit(recovered, snapshot.query, false); return true }
          return save(recovered)
        } catch { emit(snapshot.preferences, snapshot.query, true); return false }
      }
      return save({ ...snapshot.preferences })
    },
    clear,
  }
}
