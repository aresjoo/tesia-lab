/** Account-local public Mock billing preview, never payment or service authority.
 * State + notification intents commit as one sessionStorage envelope. No clock,
 * hydration action, fallback account, migration, rollback, reset or deletion.
 */
import { applyBillingPreviewAction, billingPreviewLimits, createBillingPreviewState,
  type BillingPreviewAction, type BillingPreviewNotification, type BillingPreviewState } from './client-billing-preview-state'

export type BillingPreviewStorage = Pick<Storage, 'getItem' | 'setItem'>
export type BillingPreviewStoredNotification = { id: string; at: number; read: boolean; intent: BillingPreviewNotification }
export type BillingPreviewStoreError = 'invalid-owner' | 'storage-unavailable' | 'read-failed' | 'invalid-state' | 'owner-mismatch'
  | 'write-failed' | 'readback-failed' | 'concurrent-change'
export type BillingPreviewStoreSnapshot = Readonly<{ state: BillingPreviewState | null; error: BillingPreviewStoreError | null;
  notifications: readonly BillingPreviewStoredNotification[] }>
export type BillingPreviewStoreResult = { ok: true; state: BillingPreviewState; notifications: BillingPreviewStoredNotification[]; changed: boolean }
  | { ok: false; state: BillingPreviewState | null; error: string; notifications: []; changed: false }
type Envelope = { v: 1; owner: string; state: BillingPreviewState; notifications: BillingPreviewStoredNotification[] }
const MAX_RAW = 2_000_000, MAX_SEEN = 20_000, MAX_NOTIFICATIONS = 100
const own = (value: object, key: string) => Object.hasOwn(value, key)
const dangerous = (key: string) => ['__proto__', 'constructor', 'prototype'].includes(key)
const object = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return (prototype === null || Object.getPrototypeOf(prototype) === null) && Object.keys(value).every(key => !dangerous(key))
}
const keys = (value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) => required.every(key => own(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
const text = (value: unknown, max = 240): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
  && value.trim() === value && Array.from(value).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value)
const time = (value: unknown): value is number => integer(value) && value >= 0 && value <= 8640000000000000
function ownerValid(owner: unknown): owner is string {
  if (!text(owner)) return false
  try { encodeURIComponent(owner); return true } catch { return false }
}
export function billingPreviewStorageKey(owner: string): string {
  if (!ownerValid(owner)) throw new RangeError('Invalid billing preview owner')
  return `teth-billing-preview:account:${encodeURIComponent(owner)}`
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function dataValid(value: unknown): boolean {
  return value === null || object(value) && Object.keys(value).length <= 16 && Object.entries(value).every(([key, item]) => text(key, 80)
    && (item === null || typeof item === 'boolean' || finite(item) || typeof item === 'string' && item.length <= 1024))
}
const eventFields: Record<string, readonly string[]> = {
  welcome: ['amt'], 'promo-carduid': ['amt'], 'cap-expire': ['fid', 'expired'], recover: ['from', 'src', 'bal'],
  warn: ['bal', 'warnAt', 'tier', 'src'], 'rescue-offer': ['day'], 'coupon-grant': ['id', 'kind'], 'card-on': [], 'card-off': [],
  'card-charged': ['cycle'], 'cycle-reset': ['cycle', 'expired'], 'card-bill': ['cycle', 'gross', 'offset', 'net', 'coupon'],
  'coupon-use': ['id'], 'pay-fail': ['cycle', 'tries'], recon: ['day', 'fixed', 'bal'],
}
function eventValid(value: unknown): boolean {
  if (!object(value) || !keys(value, ['at', 'key', 'data']) || !time(value.at) || !text(value.key)
    || !dataValid(value.data) || !object(value.data)) return false
  if (!Object.entries(value.data).every(([key, item]) => ['amt', 'expired', 'bal', 'warnAt', 'day', 'gross', 'offset', 'net', 'tries', 'fixed'].includes(key)
    ? finite(item) : key === 'coupon' ? item === null || text(item) : text(item, 512))) return false
  if (own(value.data, 'tier') && !['FREE', 'UID', 'CARD', 'CARD_UID'].includes(value.data.tier as string)) return false
  if (own(value.data, 'from') && !['watch', 'grace'].includes(value.data.from as string)) return false
  if (value.key === 'watch-enter') return keys(value.data, ['bal', 'tier']) || keys(value.data, ['reason', 'tries']) && value.data.reason === 'dunning'
  return own(eventFields, value.key) && keys(value.data, eventFields[value.key])
}
const seenKeyValid = (key: string) => text(key, 1024) && (['welcome', 'promo-carduid'].includes(key)
  || ['action:', 'notice:', 'vol:', 'ai:', 'card:', 'reset:', 'recon:', 'adj:', 'adjneg:', 'qa:'].some(prefix => key.startsWith(prefix) && key.length > prefix.length))
const reasonTypes: Record<string, readonly string[]> = { welcome: ['grant'], promo: ['grant'], volume: ['charge'], card: ['charge'], ai: ['debit'],
  cycle: ['reset'], 'recon-dupfid': ['adjust'], 'recon-negbal': ['adjust'], qa: ['charge', 'debit'] }
function stateValid(value: unknown, owner: string): value is BillingPreviewState {
  if (!object(value) || !keys(value, ['v', 'owner', 'uidLinked', 'ledger', 'seen', 'coupons', 'events', 'mode', 'graceAt', 'cardOn', 'cycleAt', 'cardFails', 'simPayFail'])
    || value.v !== 1 || value.owner !== owner || typeof value.uidLinked !== 'boolean' || typeof value.cardOn !== 'boolean' || typeof value.simPayFail !== 'boolean'
    || !['active', 'grace', 'watch'].includes(value.mode as string) || value.graceAt !== null && !integer(value.graceAt)
    || value.cycleAt !== null && !time(value.cycleAt) || !time(value.cardFails)
    || value.mode === 'active' && value.graceAt !== null || value.mode === 'grace' && value.graceAt === null
    || !Array.isArray(value.ledger) || value.ledger.length > billingPreviewLimits.ledger
    || !Array.isArray(value.events) || value.events.length > billingPreviewLimits.events
    || !Array.isArray(value.coupons) || value.coupons.length > billingPreviewLimits.coupons
    || !object(value.seen) || Object.keys(value.seen).length > MAX_SEEN
    || !Object.entries(value.seen).every(([key, at]) => seenKeyValid(key) && time(at))) return false
  const ids = new Set<string>()
  let at = -1, balance = 0
  for (const entry of value.ledger) {
    if (!object(entry) || !keys(entry, ['id', 'at', 'type', 'reason', 'amt', 'ref']) || !text(entry.id, 512) || ids.has(entry.id)
      || !time(entry.at) || entry.at < at || !text(entry.reason) || !own(reasonTypes, entry.reason)
      || !reasonTypes[entry.reason].includes(entry.type as string) || !finite(entry.amt) || entry.ref !== null && !text(entry.ref, 512)
      || ['grant', 'charge'].includes(entry.type as string) && entry.amt < 0 || ['debit', 'reset'].includes(entry.type as string) && entry.amt > 0) return false
    ids.add(entry.id); at = entry.at; balance += entry.amt
    if (!Number.isFinite(balance)) return false
  }
  ids.clear(); at = -1
  for (const coupon of value.coupons) {
    if (!object(coupon) || !keys(coupon, ['id', 'kind', 'rate', 'at', 'usedAt']) || !text(coupon.id) || ids.has(coupon.id) || !text(coupon.kind)
      || coupon.rate !== .9 || !time(coupon.at) || coupon.at < at || coupon.usedAt !== null && (!time(coupon.usedAt) || coupon.usedAt < coupon.at)) return false
    ids.add(coupon.id); at = coupon.at
  }
  at = -1
  for (const event of value.events) {
    if (!eventValid(event) || event.at < at) return false
    at = event.at
  }
  return true
}
const notificationBases = ['bill.recover', 'bill.watch', 'bill.free.out', 'bill.card.out', 'bill.uid.novol', 'bill.carduid.out',
  'bill.uid.heavy', 'bill.uid.small', 'bill.card.cross', 'bill.dunning']
function notificationValid(value: unknown, state: BillingPreviewState): value is BillingPreviewStoredNotification {
  if (!object(value) || !keys(value, ['id', 'at', 'read', 'intent']) || !text(value.id, 4096) || !time(value.at) || typeof value.read !== 'boolean') return false
  const intent = value.intent
  if (!object(intent) || !keys(intent, ['key', 'titleKey', 'bodyKey', 'link', 'data']) || !text(intent.key, 1024) || !dataValid(intent.data)) return false
  const base = notificationBases.find(candidate => intent.titleKey === `${candidate}.t` && intent.bodyKey === `${candidate}.b`)
  return !!base && intent.key.startsWith(`${base}:`) && intent.key.length > base.length + 1 && intent.link === (base === 'bill.recover' ? null : '#/plan')
    && own(state.seen, `notice:${intent.key}`) && state.seen[`notice:${intent.key}`] === value.at
}
function envelopeValid(value: unknown, owner: string): value is Envelope {
  if (!object(value) || !keys(value, ['v', 'owner', 'state', 'notifications']) || value.v !== 1 || value.owner !== owner
    || !stateValid(value.state, owner) || !Array.isArray(value.notifications) || value.notifications.length > MAX_NOTIFICATIONS) return false
  const ids = new Set<string>(), notices = new Set<string>()
  let at = -1
  for (const item of value.notifications) {
    if (!notificationValid(item, value.state) || ids.has(item.id) || notices.has(item.intent.key) || item.at < at) return false
    ids.add(item.id); notices.add(item.intent.key); at = item.at
  }
  return true
}
function actionValid(value: unknown): value is BillingPreviewAction {
  if (!object(value) || !text(value.kind)) return false
  if (['welcome', 'promo', 'tick', 'blocked', 'cycle', 'reconcile', 'boot', 'admit', 'qa-topup', 'qa-grace', 'qa-watch'].includes(value.kind)) return keys(value, ['kind'])
  switch (value.kind) {
    case 'debit': return keys(value, ['kind', 'reqId']) && text(value.reqId)
    case 'volume': return keys(value, ['kind', 'fid', 'exchange', 'notional'], ['market']) && text(value.fid) && text(value.exchange)
      && finite(value.notional) && value.notional >= 0 && (!own(value, 'market') || value.market === 'spot' || value.market === 'futures')
    case 'uid-link': return keys(value, ['kind', 'linked']) && typeof value.linked === 'boolean'
    case 'card-on': case 'qa-card': return keys(value, ['kind', 'on']) && typeof value.on === 'boolean'
    case 'card-charge': case 'reset': return keys(value, ['kind', 'cycleKey']) && text(value.cycleKey)
    case 'after-change': return keys(value, ['kind', 'source']) && text(value.source)
    case 'coupon': return keys(value, ['kind', 'couponId'], ['kindName']) && text(value.couponId) && (!own(value, 'kindName') || text(value.kindName))
    case 'qa-drain': return keys(value, ['kind', 'ratio']) && finite(value.ratio) && value.ratio >= 0 && value.ratio <= 1
    case 'qa-pay-fail': return keys(value, ['kind', 'fail']) && typeof value.fail === 'boolean'
    default: return false
  }
}

export function createBillingPreviewStore(owner: string | null, storage?: BillingPreviewStorage) {
  let snapshot: BillingPreviewStoreSnapshot = freeze({ state: null, error: null, notifications: [] })
  let decoded: { raw: string | null; envelope: Envelope } | null = null
  const listeners = new Set<() => void>()
  const emit = (next: BillingPreviewStoreSnapshot) => {
    if (snapshot.error === next.error && snapshot.state === next.state && snapshot.notifications === next.notifications) return
    snapshot = freeze(next)
    listeners.forEach(listener => { try { listener() } catch { /* A view subscriber cannot undo a persisted transaction. */ } })
  }
  const error = (code: BillingPreviewStoreError) => {
    // A retry after ANY persistence error must decode and validate again, even
    // when the bytes match a formerly valid value or a write may have succeeded.
    decoded = null
    emit({ ...snapshot, error: code }); return false as const
  }
  const failed = (code: string): BillingPreviewStoreResult => ({ ok: false, state: snapshot.state, notifications: [], changed: false, error: code })
  const read = (): { port: BillingPreviewStorage; key: string; raw: string | null; envelope: Envelope } | null => {
    if (!ownerValid(owner)) { if (owner !== null) error('invalid-owner'); return null }
    let port: BillingPreviewStorage
    try { port = storage ?? sessionStorage } catch { error('storage-unavailable'); return null }
    const key = billingPreviewStorageKey(owner)
    let raw: string | null
    try { raw = port.getItem(key) } catch { error('read-failed'); return null }
    // Always read the account key to notice other writers; only parsing and
    // validation of exactly unchanged, previously verified bytes are skipped.
    if (snapshot.error === null && decoded && decoded.raw === raw) return { port, key, raw, envelope: decoded.envelope }
    try {
      if (raw !== null && (typeof raw !== 'string' || raw.length > MAX_RAW || new TextEncoder().encode(raw).byteLength > MAX_RAW)) { error('invalid-state'); return null }
      const envelope: unknown = raw === null ? { v: 1, owner, state: createBillingPreviewState(owner), notifications: [] } : JSON.parse(raw)
      if (object(envelope) && typeof envelope.owner === 'string' && envelope.owner !== owner
        || object(envelope) && object(envelope.state) && typeof envelope.state.owner === 'string' && envelope.state.owner !== owner) { error('owner-mismatch'); return null }
      if (!envelopeValid(envelope, owner)) { error('invalid-state'); return null }
      decoded = { raw, envelope: freeze(envelope) }
      return { port, key, raw, envelope }
    } catch { error('invalid-state'); return null }
  }
  const publish = (value: Envelope) => emit({ state: value.state, notifications: value.notifications, error: null })
  const retry = (): boolean => {
    if (owner === null) return true
    const current = read()
    if (!current) return false
    publish(current.envelope); return true
  }
  const commit = (current: NonNullable<ReturnType<typeof read>>, envelope: Envelope): boolean => {
    let raw: string
    try {
      if (!envelopeValid(envelope, owner!)) return error('invalid-state')
      raw = JSON.stringify(envelope)
      if (raw.length > MAX_RAW || new TextEncoder().encode(raw).byteLength > MAX_RAW) return error('invalid-state')
    } catch { return error('invalid-state') }
    try { if (current.port.getItem(current.key) !== current.raw) return error('concurrent-change') }
    catch { return error('read-failed') }
    try { current.port.setItem(current.key, raw) } catch { return error('write-failed') }
    try { if (current.port.getItem(current.key) !== raw) return error('readback-failed') }
    catch { return error('readback-failed') }
    decoded = { raw, envelope: freeze(envelope) }
    publish(envelope); return true
  }
  const readable = () => owner !== null && snapshot.error === null
  const markRead = (id: string | null): boolean => {
    if (!readable() || id !== null && !text(id, 4096)) return false
    const current = read()
    if (!current) return false
    const notifications = current.envelope.notifications.map(item => !item.read && (id === null || item.id === id) ? { ...item, read: true } : item)
    if (notifications.every((item, index) => item === current.envelope.notifications[index])) { publish(current.envelope); return true }
    return commit(current, { ...current.envelope, notifications })
  }
  retry()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    retry, read: (id: string) => markRead(id), readAll: () => markRead(null),
    dispatch: (action: BillingPreviewAction, now: number, id: string): BillingPreviewStoreResult => {
      if (owner === null) return failed('owner-required')
      if (snapshot.error !== null) return failed('retry-required')
      try { if (!actionValid(action) || !ownerValid(id) || !time(now)) return failed('invalid-input') }
      catch { return failed('invalid-input') }
      const current = read()
      if (!current) return failed(snapshot.error ?? 'read-failed')
      // Prevent new actions from producing out-of-order persisted histories.
      const newest = Math.max(0, ...Object.values(current.envelope.state.seen), ...current.envelope.state.events.map(event => event.at), ...current.envelope.state.ledger.map(entry => entry.at))
      if (now < newest && !own(current.envelope.state.seen, `action:${id}`)) return failed('clock-skew')
      let result: ReturnType<typeof applyBillingPreviewAction>
      try { result = applyBillingPreviewAction(current.envelope.state, { owner, id, now, action }) }
      catch { return failed('invalid-input') }
      if (!result.ok) return failed(result.error)
      if (!result.changed) { publish(current.envelope); return { ok: true, state: snapshot.state!, notifications: [], changed: false } }
      const notices = result.notifications.map((intent, index) => ({ id: `billing:${encodeURIComponent(id)}:${index}`, at: now, read: false, intent }))
      const envelope: Envelope = { ...current.envelope, state: result.state, notifications: [...current.envelope.notifications, ...notices].slice(-MAX_NOTIFICATIONS) }
      if (!commit(current, envelope)) return failed(snapshot.error ?? 'write-failed')
      return { ok: true, state: snapshot.state!, notifications: notices, changed: true }
    },
  }
}
