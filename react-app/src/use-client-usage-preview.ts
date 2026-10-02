import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { billingPreviewBalance, billingPreviewMonthSpend, billingPreviewTier, type BillingPreviewState } from './client-billing-preview-state'
import { deriveUsagePreview, usagePresentationBound, usageTopupAmounts, type UsageDismissal, type UsagePresentation, type UsageTopupAmount } from './client-usage-presentation'

/** Separate source-preview UI state. No original billing ledger, payment or API. */
type UsageUiRecord = Readonly<{ v: 1; owner: string; revision: number; creditUsd: number; autoTopup: boolean; dismissedMonth: string | null }>
export type UsagePreviewSnapshot = Readonly<{ data: UsageUiRecord | null; error: 'owner' | 'storage' | 'corrupt' | 'conflict' | 'readback' | null }>
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
const ownerValid = (value: string | null): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 240
  && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
const monthValid = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(?:0?[1-9]|1[0-2])$/.test(value)
const timeValid = (value: number) => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000 - 30 * 864e5
export function clientUsagePreviewStorageKey(owner: string) {
  if (!ownerValid(owner)) throw new RangeError('USAGE_PREVIEW_OWNER_REQUIRED')
  return `teth-usage-ui:preview:${encodeURIComponent(owner)}`
}
function validRecord(value: unknown, owner: string): value is UsageUiRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>, fields = ['v', 'owner', 'revision', 'creditUsd', 'autoTopup', 'dismissedMonth']
  return Object.keys(row).length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(row, key))
    && row.v === 1 && row.owner === owner && typeof row.revision === 'number' && Number.isSafeInteger(row.revision) && row.revision >= 0
    && typeof row.creditUsd === 'number' && Number.isFinite(row.creditUsd) && row.creditUsd >= 0 && row.creditUsd <= Number.MAX_SAFE_INTEGER
    && typeof row.autoTopup === 'boolean' && (row.dismissedMonth === null || monthValid(row.dismissedMonth))
}

export function createClientUsagePreviewStore(owner: string | null, providedStorage?: StoragePort) {
  let snapshot: UsagePreviewSnapshot = Object.freeze({ data: null, error: null })
  const listeners = new Set<() => void>()
  const publish = (data: UsageUiRecord | null, error: UsagePreviewSnapshot['error']) => {
    if (snapshot.data === data && snapshot.error === error) return
    snapshot = Object.freeze({ data, error }); listeners.forEach(listener => { try { listener() } catch { /* A subscriber cannot undo a verified commit. */ } })
  }
  const failure = (error: NonNullable<UsagePreviewSnapshot['error']>) => { publish(snapshot.data, error); return false }
  function read(): { storage: StoragePort; key: string; raw: string | null; data: UsageUiRecord } | null {
    if (owner === null) return null
    if (!ownerValid(owner)) { failure('owner'); return null }
    try {
      const storage = providedStorage ?? window.sessionStorage, key = clientUsagePreviewStorageKey(owner), raw = storage.getItem(key)
      if (raw !== null && (typeof raw !== 'string' || raw.length > 4096)) { failure('corrupt'); return null }
      let value: unknown
      try { value = raw === null ? { v: 1, owner, revision: 0, creditUsd: 0, autoTopup: false, dismissedMonth: null } : JSON.parse(raw) }
      catch { failure('corrupt'); return null }
      if (!validRecord(value, owner)) { failure('corrupt'); return null }
      // Preserve reference identity when the same confirmed bytes are observed.
      const data = snapshot.data && JSON.stringify(snapshot.data) === JSON.stringify(value) ? snapshot.data : Object.freeze(value)
      return { storage, key, raw, data }
    } catch { failure('storage'); return null }
  }
  function retry() {
    if (owner === null) return true
    const current = read(); if (!current) return false
    publish(current.data, null); return true
  }
  function commit(change: (data: UsageUiRecord) => UsageUiRecord, isCurrent: () => boolean = () => true) {
    if (!owner || !isCurrent() || snapshot.error) return false
    const current = read(); if (!current || !isCurrent()) return false
    let next: UsageUiRecord, raw: string
    try {
      if (current.data.revision >= Number.MAX_SAFE_INTEGER) return failure('corrupt')
      next = { ...change(current.data), revision: current.data.revision + 1 }
      if (!validRecord(next, owner)) return failure('corrupt')
      raw = JSON.stringify(next)
      if (current.storage.getItem(current.key) !== current.raw) return failure('conflict')
      if (!isCurrent()) return false
      current.storage.setItem(current.key, raw)
    } catch { return failure('storage') }
    try {
      if (current.storage.getItem(current.key) !== raw) return failure('readback')
    } catch { return failure('readback') }
    if (!isCurrent()) return false
    publish(Object.freeze(next), null); return true
  }
  retry()
  return { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }, retry,
    topup: (amount: UsageTopupAmount, isCurrent?: () => boolean) => usageTopupAmounts.includes(amount) && commit(data => ({ ...data, creditUsd: data.creditUsd + amount }), isCurrent),
    automatic: (enabled: boolean, isCurrent?: () => boolean) => typeof enabled === 'boolean' && commit(data => ({ ...data, autoTopup: enabled }), isCurrent),
    dismiss: (month: string, isCurrent?: () => boolean) => monthValid(month) && commit(data => ({ ...data, dismissedMonth: month }), isCurrent),
  }
}

export function projectClientUsagePreview(owner: string | null, state: BillingPreviewState | null, now: number, snapshot: UsagePreviewSnapshot): UsagePresentation | null {
  if (!owner) return null
  const validNow = timeValid(now), date = validNow ? new Date(now) : null
  const month = date ? `${date.getFullYear()}-${date.getMonth() + 1}` : ''
  const unavailable: UsagePresentation = { source: 'unavailable', scope: owner, month, tier: null, pct: null, creditUsd: null, resetAt: null, autoTopup: null }
  if (!validNow || !state || state.owner !== owner || snapshot.error || !snapshot.data || snapshot.data.owner !== owner) return unavailable
  const resetAt = state.cycleAt !== null ? state.cycleAt + 30 * 864e5 : new Date(date!.getFullYear(), date!.getMonth() + 1, 1).getTime()
  try {
    return deriveUsagePreview({ scope: owner, month, tier: billingPreviewTier(state), usedUsd: billingPreviewMonthSpend(state, now),
      balanceUsd: billingPreviewBalance(state) + snapshot.data.creditUsd, resetAt, autoTopup: snapshot.data.autoTopup }) ?? unavailable
  } catch { return unavailable }
}

export function useClientUsagePreview({ owner, state, now }: { owner: string | null; state: BillingPreviewState | null; now: number }) {
  const [scope, setScope] = useState(() => ({ owner, store: createClientUsagePreviewStore(owner) }))
  if (scope.owner !== owner) setScope({ owner, store: createClientUsagePreviewStore(owner) })
  const snapshot = useSyncExternalStore(scope.store.subscribe, scope.store.getSnapshot)
  const presentation = projectClientUsagePreview(owner, state, now, snapshot)
  const active = useRef({ scope, presentation, mounted: false })
  useLayoutEffect(() => { active.current = { scope, presentation, mounted: true } })
  useLayoutEffect(() => () => { active.current.mounted = false }, [scope])
  const flight = useRef<object | null>(null)
  const isCurrent = () => active.current.mounted && active.current.scope === scope
    && usagePresentationBound(active.current.presentation, owner)
  const canTopup = () => isCurrent() && active.current.presentation?.tier === 'CARD_UID'
  const mutate = async (signal: AbortSignal, action: () => boolean) => {
    if (signal.aborted || !canTopup() || flight.current) throw new Error('USAGE_PREVIEW_UNAVAILABLE')
    const request = {}; flight.current = request
    try {
      await Promise.resolve()
      if (signal.aborted || !canTopup() || !action()) throw new Error('USAGE_PREVIEW_UNAVAILABLE')
    } finally { if (flight.current === request) flight.current = null }
  }
  return { presentation,
    getSupplementalCredit: () => scope.store.getSnapshot().error ? 0 : scope.store.getSnapshot().data?.creditUsd ?? 0,
    // Re-project after billing.check publishes an external credit change in the same click.
    getCurrentPresentation: (currentState: BillingPreviewState | null, currentNow: number) =>
      projectClientUsagePreview(owner, currentState, currentNow, scope.store.getSnapshot()),
    storageError: Boolean(snapshot.error),
    dismissed: snapshot.error || !snapshot.data?.dismissedMonth || snapshot.data.owner !== owner ? null : { scope: snapshot.data.owner, month: snapshot.data.dismissedMonth },
    onDismiss: (dismissal: UsageDismissal) => {
      if (isCurrent() && dismissal.scope === owner && dismissal.month === active.current.presentation?.month) scope.store.dismiss(dismissal.month, isCurrent)
    },
    onTopup: (amount: UsageTopupAmount, signal: AbortSignal) => mutate(signal, () => scope.store.topup(amount, () => !signal.aborted && canTopup())),
    onAutoTopup: (enabled: boolean, signal: AbortSignal) => mutate(signal, () => scope.store.automatic(enabled, () => !signal.aborted && canTopup())),
    retry: () => active.current.mounted && active.current.scope === scope && scope.store.retry(),
  }
}
