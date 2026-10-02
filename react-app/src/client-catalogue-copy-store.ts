/** Session-local SOURCE PREVIEW only. Never a wallet, SDK or entitlement store.
 * Legacy copy-v1 bytes are not read, adopted, overwritten or removed.
 */
import { freezeCatalogueValue } from './client-catalogue'
import { readCatalogueCopyRecord, type CatalogueCopyRecord } from './client-catalogue-copy'

export type CatalogueCopyEntry = {
  record: CatalogueCopyRecord
  stopMode?: 'wait' | 'manual'
  settlement?: { at: number; back: number; net: number; share: number }
}
export type CatalogueCopyAccount = {
  v: 1; model: 'catalogue-account-preview'; owner: string; revision: number
  /** Source cpState starts with $1000; explicit cpTopupDo adds $1000. */
  topups: number; spot: number; copies: CatalogueCopyEntry[]
}
export type CatalogueCopyStorage = Pick<Storage, 'getItem' | 'setItem'>
export type CatalogueCopyStorageError = 'invalid-owner' | 'invalid-state' | 'storage-unavailable' | 'read-failed' | 'write-failed' | 'readback-failed' | 'conflict' | 'uncertain'
export type CatalogueCopyRead = { state: Readonly<CatalogueCopyAccount> | null; error: CatalogueCopyStorageError | null; raw: string | null | undefined }
const MAX_BYTES = 2_000_000
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const integer = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v >= 0
const fields = (v: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k))
const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
export function catalogueCopyStorageKey(owner: string) {
  if (typeof owner !== 'string' || !owner || owner.length > 320 || owner.trim() !== owner || Array.from(owner).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw Error('invalid-owner')
  return `teth-catalogue-copy-preview:account:${encodeURIComponent(owner)}`
}
export function createCatalogueCopyAccount(owner: string): Readonly<CatalogueCopyAccount> {
  catalogueCopyStorageKey(owner)
  return freezeCatalogueValue({ v: 1, model: 'catalogue-account-preview', owner, revision: 0, topups: 0, spot: 1000, copies: [] })
}

/** Structural and cash-transfer consistency, NOT proof of market accounting. */
export function validateCatalogueCopyAccount(input: unknown, owner: string): Readonly<CatalogueCopyAccount> {
  catalogueCopyStorageKey(owner)
  const fail = (): never => { throw Error('invalid-state') }
  if (!object(input) || !fields(input, ['v', 'model', 'owner', 'revision', 'topups', 'spot', 'copies']) || input.v !== 1 || input.model !== 'catalogue-account-preview'
    || input.owner !== owner || !integer(input.revision) || !integer(input.topups) || input.topups > 1_000_000 || !finite(input.spot) || input.spot < 0
    || !Array.isArray(input.copies) || input.copies.length > 100) return fail()
  const ids = new Set<string>(), active = new Set<string>()
  let netDeposits = 0
  for (const entry of input.copies) {
    if (!object(entry) || !fields(entry, ['record'], ['stopMode', 'settlement'])) return fail()
    let c: Readonly<CatalogueCopyRecord>
    try { c = readCatalogueCopyRecord(entry.record, owner) } catch { return fail() }
    if (ids.has(c.id) || c.status === 'active' && active.has(c.binding.strategyId)) return fail()
    ids.add(c.id); if (c.status === 'active') active.add(c.binding.strategyId)
    if (Object.hasOwn(entry, 'stopMode') !== (c.stopI !== undefined) || entry.stopMode !== undefined && !['wait', 'manual'].includes(String(entry.stopMode))) return fail()
    if ((c.status === 'closed') !== Object.hasOwn(entry, 'settlement')) return fail()
    if (c.status === 'closed') {
      const s = entry.settlement, last = c.ledger.at(-1)!
      if (!object(s) || !fields(s, ['at', 'back', 'net', 'share']) || !integer(s.at) || !finite(s.back) || s.back < 0 || !finite(s.net) || !finite(s.share) || s.share < 0
        || c.ledger.length < 2 || last.type !== 'out' || last.i !== c.endI || last.at !== s.at || last.amount !== s.back) return fail()
      const invested = c.ledger.slice(0, -1).reduce((sum, e) => sum + (e.type === 'add' ? e.amount : -e.amount), 0)
      if (!close(s.back, Math.max(0, invested + s.net))) return fail()
    }
    netDeposits += c.ledger.reduce((sum, e) => sum + (e.type === 'add' ? e.amount : -e.amount), 0)
  }
  if (!close(input.spot, 1000 + input.topups * 1000 - netDeposits)) return fail()
  return freezeCatalogueValue(structuredClone(input) as CatalogueCopyAccount)
}

type Listener = () => void
const channels = new WeakMap<CatalogueCopyStorage, Map<string, { uncertain: boolean; listeners: Set<Listener> }>>()
function channel(port: CatalogueCopyStorage, owner: string) {
  let owners = channels.get(port)
  if (!owners) { owners = new Map(); channels.set(port, owners) }
  let entry = owners.get(owner)
  if (!entry) { entry = { uncertain: false, listeners: new Set() }; owners.set(owner, entry) }
  return entry
}
function notify(port: CatalogueCopyStorage, owner: string) {
  for (const listener of [...channel(port, owner).listeners]) try { listener() } catch { /* One view cannot veto a verified write. */ }
}
export function subscribeCatalogueCopyAccount(owner: string, listener: Listener, port: CatalogueCopyStorage) {
  catalogueCopyStorageKey(owner)
  const entry = channel(port, owner); entry.listeners.add(listener)
  return () => { entry.listeners.delete(listener) }
}
function read(owner: string, port: CatalogueCopyStorage, ignoreUncertain: boolean): CatalogueCopyRead {
  let key: string
  try { key = catalogueCopyStorageKey(owner) } catch { return { state: null, error: 'invalid-owner', raw: undefined } }
  if (!ignoreUncertain && channel(port, owner).uncertain) return { state: null, error: 'uncertain', raw: undefined }
  let raw: string | null
  try { raw = port.getItem(key) } catch { return { state: null, error: 'read-failed', raw: undefined } }
  try {
    if (raw !== null && (typeof raw !== 'string' || raw.length > MAX_BYTES || new TextEncoder().encode(raw).byteLength > MAX_BYTES)) throw Error('size')
    return { state: raw === null ? createCatalogueCopyAccount(owner) : validateCatalogueCopyAccount(JSON.parse(raw), owner), error: null, raw }
  } catch { return { state: null, error: 'invalid-state', raw } }
}
export function readCatalogueCopyAccount(owner: string, storage?: CatalogueCopyStorage): CatalogueCopyRead {
  try { return read(owner, storage ?? sessionStorage, false) } catch { return { state: null, error: 'storage-unavailable', raw: undefined } }
}
/** Explicit fresh read only: no repeat mutation, deletion or reset. */
export function retryCatalogueCopyAccount(owner: string, storage?: CatalogueCopyStorage): CatalogueCopyRead {
  let port: CatalogueCopyStorage
  try { port = storage ?? sessionStorage } catch { return { state: null, error: 'storage-unavailable', raw: undefined } }
  const result = read(owner, port, true)
  // A failed explicit re-read invalidates other mounted readers too. Restoring
  // bytes outside the store must not silently turn their old values current.
  channel(port, owner).uncertain = Boolean(result.error)
  notify(port, owner)
  return result
}

function appendOnly(before: Readonly<CatalogueCopyAccount>, next: Readonly<CatalogueCopyAccount>) {
  if (next.topups < before.topups || next.topups > before.topups + 1 || next.copies.length < before.copies.length || next.copies.length > before.copies.length + 1) return false
  for (const [index, old] of before.copies.entries()) {
    const current = next.copies[index], a = old.record, b = current.record
    if (a.status === 'closed') { if (JSON.stringify(old) !== JSON.stringify(current)) return false; continue }
    for (const key of ['model', 'owner', 'id', 'binding', 'startI', 'settings'] as const) if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false
    if (a.stopI !== undefined && a.stopI !== b.stopI || b.ledger.length < a.ledger.length || b.ledger.length > a.ledger.length + 1
      || a.ledger.some((e, i) => JSON.stringify(e) !== JSON.stringify(b.ledger[i]))
      || b.flats.length < a.flats.length || b.flats.length > a.flats.length + 1 || a.flats.some((i, k) => i !== b.flats[k])
      || b.status === 'closed' && b.ledger.length !== a.ledger.length + 1) return false
  }
  if (next.copies.length > before.copies.length) {
    const added = next.copies.at(-1)!.record
    if (added.status !== 'active' || added.stopI !== undefined || added.flats.length || added.ledger.length !== 1) return false
  }
  return true
}

/** Compare-before-write for same-session callers; not a cross-process CAS.
 * Re-read after async calculation. Failed writes may have persisted: quarantine
 * all same-port/owner readers until an explicit successful retry read.
 */
export function saveCatalogueCopyAccount(next: CatalogueCopyAccount, expected: CatalogueCopyRead, storage?: CatalogueCopyStorage): { ok: true } | { ok: false; error: CatalogueCopyStorageError } {
  const fail = (error: CatalogueCopyStorageError) => ({ ok: false as const, error })
  let value: Readonly<CatalogueCopyAccount>, raw: string, key: string
  try {
    if (expected.error || !expected.state || expected.raw === undefined || expected.state.owner !== next.owner
      || expected.raw !== null && (typeof expected.raw !== 'string' || expected.raw.length > MAX_BYTES)) return fail('conflict')
    const before = expected.raw === null ? createCatalogueCopyAccount(next.owner) : validateCatalogueCopyAccount(JSON.parse(expected.raw), next.owner)
    if (JSON.stringify(before) !== JSON.stringify(expected.state) || next.revision !== before.revision + 1) return fail('conflict')
    value = validateCatalogueCopyAccount(next, next.owner); key = catalogueCopyStorageKey(value.owner)
    if (!appendOnly(before, value)) return fail('invalid-state')
    raw = JSON.stringify(value)
    if (raw.length > MAX_BYTES || new TextEncoder().encode(raw).byteLength > MAX_BYTES) return fail('invalid-state')
  } catch { return fail('invalid-state') }
  let port: CatalogueCopyStorage
  try { port = storage ?? sessionStorage } catch { return fail('storage-unavailable') }
  const state = channel(port, value.owner)
  if (state.uncertain) return fail('uncertain')
  try { if (port.getItem(key) !== expected.raw) return fail('conflict') } catch { return fail('read-failed') }
  const uncertain = (error: CatalogueCopyStorageError) => { state.uncertain = true; notify(port, value.owner); return fail(error) }
  try { port.setItem(key, raw) } catch { return uncertain('write-failed') }
  try { if (port.getItem(key) !== raw) return uncertain('readback-failed') } catch { return uncertain('readback-failed') }
  notify(port, value.owner)
  return { ok: true }
}
