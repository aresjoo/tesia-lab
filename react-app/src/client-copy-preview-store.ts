/** Owner-local session preview persistence only; never a wallet or service API.
 * A failed restore keeps its original bytes and reports the failure separately.
 * No guest state, migration, automatic write, network or implicit clock access.
 */
import { createCopyPreviewState, copyPreviewConfig, type CopyPreviewState } from './client-copy-preview-state'

export type CopyPreviewStorage = Pick<Storage, 'getItem' | 'setItem'>
export type CopyPreviewStoreError = 'owner-required' | 'invalid-owner' | 'invalid-state' | 'owner-mismatch'
  | 'storage-unavailable' | 'read-failed' | 'write-failed' | 'readback-failed'
export type CopyPreviewSaveResult = { ok: true; error: null } | { ok: false; error: CopyPreviewStoreError }
const messages: Record<CopyPreviewStoreError, string> = {
  'owner-required': '로그인 후 카피 미리보기를 이용해주세요.',
  'invalid-owner': '현재 계정 정보를 다시 확인해주세요.',
  'invalid-state': '카피 미리보기의 저장 상태를 확인할 수 없어 변경을 멈췄어요. 기존 기록은 보존되어 있어요.',
  'owner-mismatch': '저장된 카피 미리보기의 계정이 일치하지 않아요.',
  'storage-unavailable': '이 브라우저에서 카피 미리보기를 저장할 수 없어요.',
  'read-failed': '카피 미리보기를 불러오지 못했어요. 다시 시도해주세요.',
  'write-failed': '카피 미리보기를 저장하지 못했어요. 다시 시도해주세요.',
  'readback-failed': '카피 미리보기의 저장 결과를 확인하지 못했어요. 다시 불러와 확인해주세요.',
}
export const copyPreviewStoreErrorMessage = (error: CopyPreviewStoreError): string => messages[error]
// Bounds apply only to local preview serialization, not shared financial contracts.
const MAX_BYTES = 2_000_000, MAX_COPIES = 100, MAX_LEDGER = 1000
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown, max = 320): value is string => typeof value === 'string' && value.length > 0 && value.length <= max
  && value.trim() === value && Array.from(value).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
const time = (value: unknown): value is number => finite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
const index = (value: unknown): value is number => time(value) && Number.isSafeInteger(value)
const keys = (value: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key))
const close = (a: number, b: number) => Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
const ownerValid = (owner: unknown): owner is string => {
  if (!text(owner)) return false
  try { encodeURIComponent(owner); return true } catch { return false }
}
export function copyPreviewStorageKey(owner: string): string {
  if (!ownerValid(owner)) throw new RangeError('Invalid copy preview owner')
  return `teth-copy-preview:account:${encodeURIComponent(owner)}`
}

const calculationKeys = ['inv', 'pnlPct', 'total', 'realized', 'unreal', 'share', 'net', 'est', 'avail', 'posOpen', 'closedN']
function validCalculation(value: unknown, amount: number, settled: boolean): value is Record<string, number | boolean> {
  if (!record(value) || !keys(value, settled ? [...calculationKeys, 'back'] : calculationKeys)
    || calculationKeys.filter(key => key !== 'posOpen').some(key => !finite(value[key]))
    || value.posOpen !== false || !index(value.closedN)) return false
  const d = value as Record<string, number>
  if (!close(d.total, amount * d.pnlPct) || !close(d.total, d.realized + d.unreal)
    || !close(d.share, Math.max(0, d.realized) * copyPreviewConfig.PROFIT_SHARE)
    || !close(d.net, d.total - d.share) || !close(d.est, d.inv + d.net) || d.avail < 0) return false
  return settled ? finite(d.back) && d.back >= 0 && close(d.back, Math.max(0, d.est)) && d.avail === 0
    : d.unreal === 0 && close(d.realized, d.total) && close(d.avail, Math.max(0, d.est))
}

function validTrades(value: unknown, count: number, start: unknown, end?: unknown): boolean {
  if (!Array.isArray(value) || value.length > MAX_LEDGER || value.length !== count) return false
  let previousExit = -1
  return value.every(trade => {
    if (!record(trade) || !keys(trade, ['entry', 'exit', 'pnl', 'kind', 'lowVol'])
      || !index(trade.entry) || !index(trade.exit) || trade.exit < trade.entry || trade.exit < previousExit
      || finite(start) && trade.exit < start || finite(end) && trade.exit > end
      || !finite(trade.pnl) || !['sl', 'tp', 'time'].includes(trade.kind as string) || typeof trade.lowVol !== 'boolean') return false
    previousExit = trade.exit
    return true
  })
}

function validCopy(value: unknown): boolean {
  if (!record(value) || !keys(value, ['id', 'nick', 'mode', 'amount', 'pairs', 'simStartI', 'at', 'status', 'adv', 'ledger'], ['flatI', 'flatSnapshot', 'flatTrades', 'closedAt', 'settle', 'closedTrades', 'realizedBasis'])
    || !text(value.id) || !text(value.nick) || value.mode !== 'ratio' || !finite(value.amount) || value.amount < copyPreviewConfig.MIN_COPY_USDT
    || !Array.isArray(value.pairs) || value.pairs.length < 1 || value.pairs.length > 3 || !value.pairs.every(pair => text(pair))
    || new Set(value.pairs).size !== value.pairs.length || (value.simStartI !== null && !index(value.simStartI))
    || !time(value.at) || !['active', 'closed'].includes(value.status as string)) return false
  const adv = value.adv
  if (!record(adv) || !keys(adv, ['marginMode', 'lev', 'slip', 'maxMarginPct', 'maxPosX'])
    || adv.marginMode !== 'follow' || adv.lev !== 'follow' || adv.slip !== 'sys' || adv.maxMarginPct !== 95 || adv.maxPosX !== 5) return false
  if (!Array.isArray(value.ledger) || !value.ledger.length || value.ledger.length > MAX_LEDGER) return false
  let at = value.at, inv = 0, beforeLast = 0
  const investmentHistory: number[] = []
  for (let i = 0; i < value.ledger.length; i++) {
    const entry = value.ledger[i], finalSettlement = value.status === 'closed' && i === value.ledger.length - 1
    if (!record(entry) || !keys(entry, ['at', 'type', 'amt']) || !time(entry.at) || entry.at < at
      || !['add', 'out'].includes(entry.type as string) || !finite(entry.amt) || entry.amt < 0 || (!finalSettlement && entry.amt === 0)) return false
    if (i === 0 && (entry.at !== value.at || entry.type !== 'add' || entry.amt !== value.amount)) return false
    beforeLast = inv
    inv += entry.type === 'add' ? entry.amt : -entry.amt
    if (!Number.isFinite(inv)) return false
    if (!finalSettlement) investmentHistory.push(inv)
    at = entry.at
  }
  const hasFlat = Object.hasOwn(value, 'flatI'), hasSnapshot = Object.hasOwn(value, 'flatSnapshot')
  const hasBasis = Object.hasOwn(value, 'realizedBasis')
  if (hasBasis && (hasFlat || value.status !== 'closed')) return false
  if (hasFlat !== hasSnapshot || hasFlat && (!index(value.flatI)
    || value.simStartI !== null && value.flatI < (value.simStartI as number)
    || !validCalculation(value.flatSnapshot, value.amount, false))) return false
  if (hasFlat && !investmentHistory.some(amount => close(amount, (value.flatSnapshot as Record<string, number>).inv))) return false
  if (Object.hasOwn(value, 'flatTrades') && (!hasFlat
    || !validTrades(value.flatTrades, (value.flatSnapshot as Record<string, number>).closedN, value.simStartI, value.flatI))) return false
  if (value.status === 'active') return !Object.hasOwn(value, 'closedAt') && !Object.hasOwn(value, 'settle') && !Object.hasOwn(value, 'closedTrades')
  if (value.ledger.length < 2 || !time(value.closedAt) || value.closedAt !== at || !validCalculation(value.settle, value.amount, true)) return false
  const settle = value.settle, final = value.ledger[value.ledger.length - 1]
  if (final.type !== 'out' || !close(final.amt, settle.back as number) || !close(beforeLast, settle.inv as number)) return false
  if (Object.hasOwn(value, 'closedTrades') && !validTrades(value.closedTrades, settle.closedN as number, value.simStartI, value.flatI)) return false
  if (hasBasis) {
    const basis = value.realizedBasis
    // Local consistency only, not provenance or tamper-proof execution evidence.
    // Bind the declared close index to the persisted trades, not just the ratio.
    if (!record(basis) || !keys(basis, ['model', 'startEquity', 'lastClosedEquity', 'lastClosedIndex'])
      || basis.model !== 'equity-last-close-v1' || !finite(basis.startEquity) || basis.startEquity <= 0
      || !Array.isArray(value.closedTrades)
      || (settle.closedN === 0 ? basis.lastClosedEquity !== null : !finite(basis.lastClosedEquity) || basis.lastClosedEquity <= 0)) return false
    const lastClosedIndex = value.closedTrades.length ? value.closedTrades.reduce((last, trade) => Math.max(last, trade.exit), -1) : null
    if (basis.lastClosedIndex !== lastClosedIndex) return false
    const realized = basis.lastClosedEquity === null ? 0 : value.amount * ((basis.lastClosedEquity as number) / basis.startEquity - 1)
    if (!close(settle.realized as number, realized)) return false
  } else if (!hasFlat && Array.isArray(value.closedTrades)
    && !close(settle.realized as number, value.amount * value.closedTrades.reduce((sum, trade) => sum + trade.pnl, 0))) return false
  if (hasFlat) {
    const snapshot = value.flatSnapshot as Record<string, unknown>
    for (const key of ['pnlPct', 'total', 'realized', 'unreal', 'share', 'net', 'closedN']) if (snapshot[key] !== settle[key]) return false
    if (Object.hasOwn(value, 'flatTrades') && Object.hasOwn(value, 'closedTrades')
      && JSON.stringify(value.flatTrades) !== JSON.stringify(value.closedTrades)) return false
  }
  return true
}

function validState(value: unknown, owner: string): value is CopyPreviewState {
  if (!record(value) || !keys(value, ['v', 'owner', 'spot', 'copies']) || value.v !== 1 || value.owner !== owner
    || !finite(value.spot) || value.spot < 0 || !Array.isArray(value.copies) || value.copies.length > MAX_COPIES) return false
  const ids = new Set<string>(), active = new Set<string>()
  for (const copy of value.copies) {
    if (!validCopy(copy) || ids.has(copy.id) || copy.status === 'active' && active.has(copy.nick)) return false
    ids.add(copy.id)
    if (copy.status === 'active') active.add(copy.nick)
  }
  return true
}

export function readCopyPreviewState(owner: string | null, storage?: CopyPreviewStorage): { state: CopyPreviewState | null; error: CopyPreviewStoreError | null } {
  if (owner === null) return { state: null, error: 'owner-required' }
  if (!ownerValid(owner)) return { state: null, error: 'invalid-owner' }
  const fresh = createCopyPreviewState(owner)
  let port: CopyPreviewStorage
  try { port = storage ?? sessionStorage } catch { return { state: fresh, error: 'storage-unavailable' } }
  let raw: string | null
  try { raw = port.getItem(copyPreviewStorageKey(owner)) } catch { return { state: fresh, error: 'read-failed' } }
  if (raw === null) return { state: fresh, error: null }
  try {
    if (typeof raw !== 'string' || raw.length > MAX_BYTES) return { state: fresh, error: 'invalid-state' }
    const value: unknown = JSON.parse(raw)
    if (record(value) && typeof value.owner === 'string' && value.owner !== owner) return { state: fresh, error: 'owner-mismatch' }
    return validState(value, owner) ? { state: value, error: null } : { state: fresh, error: 'invalid-state' }
  } catch { return { state: fresh, error: 'invalid-state' } }
}

type CopyPreviewListener = (error: CopyPreviewStoreError | null) => void
const listeners = new WeakMap<CopyPreviewStorage, Map<string, Set<CopyPreviewListener>>>()

/** Same-document invalidation only. No polling, cross-account payload or service authority. */
export function subscribeCopyPreview(owner: string, listener: CopyPreviewListener, storage?: CopyPreviewStorage): () => void {
  let port: CopyPreviewStorage
  try { port = storage ?? sessionStorage } catch { return () => {} }
  let owners = listeners.get(port)
  if (!owners) { owners = new Map(); listeners.set(port, owners) }
  let set = owners.get(owner)
  if (!set) { set = new Set(); owners.set(owner, set) }
  set.add(listener)
  return () => { set.delete(listener); if (!set.size) owners.delete(owner) }
}

function notifyCopyPreview(port: CopyPreviewStorage, owner: string, error: CopyPreviewStoreError | null) {
  for (const listener of [...listeners.get(port)?.get(owner) ?? []]) {
    // A presentation subscriber cannot turn a verified write into a failed one.
    try { listener(error) } catch { /* Other readers must still be invalidated. */ }
  }
}

export function saveCopyPreviewState(state: CopyPreviewState, storage?: CopyPreviewStorage): CopyPreviewSaveResult {
  let raw: string, key: string
  try {
    if (!record(state) || !ownerValid(state.owner)) return { ok: false, error: 'invalid-owner' }
    if (!validState(state, state.owner)) return { ok: false, error: 'invalid-state' }
    raw = JSON.stringify(state)
    if (raw.length > MAX_BYTES || !validState(JSON.parse(raw), state.owner)) return { ok: false, error: 'invalid-state' }
    key = copyPreviewStorageKey(state.owner)
  } catch { return { ok: false, error: 'invalid-state' } }
  let port: CopyPreviewStorage
  try { port = storage ?? sessionStorage } catch { return { ok: false, error: 'storage-unavailable' } }
  const fail = (error: CopyPreviewStoreError): CopyPreviewSaveResult => { notifyCopyPreview(port, state.owner, error); return { ok: false, error } }
  try { port.setItem(key, raw) } catch { return fail('write-failed') }
  try { if (port.getItem(key) !== raw) return fail('readback-failed') }
  catch { return fail('readback-failed') }
  notifyCopyPreview(port, state.owner, null)
  return { ok: true, error: null }
}
