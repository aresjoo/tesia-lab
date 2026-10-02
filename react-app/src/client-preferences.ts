import { useSyncExternalStore } from 'react'
import copy from './client-reference-copy.json'

export type ClientLanguage = keyof typeof copy.PH_ROT.list
export type ClientCopyKey = keyof typeof copy.I18N
type Preferences = { language: ClientLanguage; currency: string; storageError: boolean }
export const clientLanguages = copy.GLC_LANGS
// Historical preview conversion metadata, not selectable currencies or live FX.
// sourceMoney still needs the original KRW input basis until its data migrates.
export const clientCurrencies = copy.GLC_CURS
export const clientCopy = copy
const listeners = new Set<() => void>()
type PreferenceKey = 'language' | 'currency'
const pending = new Map<PreferenceKey, string>()
const storageKey = (key: PreferenceKey) => key === 'language' ? 'tethLang' : 'tethCurrency'
function readPreferences(): Preferences {
  try {
    const language = localStorage.getItem('tethLang')
    return {
      language: clientLanguages.some(item => item.c === language) ? language as ClientLanguage : 'ko',
      currency: 'USD',
      storageError: false,
    }
  } catch { return { language: 'ko', currency: 'USD', storageError: true } }
}
let snapshot = readPreferences()
function publish(next: Preferences) {
  snapshot = next
  document.documentElement.lang = next.language
  listeners.forEach(listener => listener())
}
document.documentElement.lang = snapshot.language
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function setClientPreference(key: PreferenceKey, value: string): boolean {
  // 02cebe3 R07: stale callers/storage cannot restore a removed currency choice.
  // Leave historical storage untouched; it is not the current display authority.
  if (key === 'currency') return value === 'USD'
  if (!clientLanguages.some(item => item.c === value)) return false
  pending.set(key, value)
  // Retry only this page's unsaved selections. Do not overwrite unrelated
  // preferences another tab may have changed with a stale full snapshot.
  for (const [field, selection] of pending) {
    try {
      localStorage.setItem(storageKey(field), selection)
      if (localStorage.getItem(storageKey(field)) === selection) pending.delete(field)
    } catch { /* Retain the unsaved choice and its visible warning. */ }
  }
  const storageError = pending.size > 0
  publish({ ...snapshot, language: value as ClientLanguage, storageError })
  return !storageError
}
const sync = (event: StorageEvent) => {
  if (event.key !== null && !['tethLang', 'tethCurrency'].includes(event.key)) return
  const next = readPreferences()
  for (const [field, selection] of pending) {
    if (!next.storageError && next[field] === selection) pending.delete(field)
    else if (field === 'language') next.language = selection as ClientLanguage
    else next.currency = selection
  }
  next.storageError ||= pending.size > 0
  publish(next)
}
window.addEventListener('storage', sync)
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener('storage', sync))
export function useClientPreferences() {
  const preferences = useSyncExternalStore(subscribe, () => snapshot)
  const t = (key: ClientCopyKey) => copy.I18N[key][preferences.language]
  return { ...preferences, t }
}

/** USD-valued preview inputs only. Never pass raw asset quantities or USDT reports. */
export function formatReferenceMoney(usd: number, _legacyCurrency: string, language: ClientLanguage = 'ko') {
  if (!Number.isFinite(usd)) return '–'
  const locale = clientLanguages.some(item => item.c === language) ? language : 'ko'
  const digits = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(usd) < 0.005 ? 0 : usd)
  return '$' + digits
}
