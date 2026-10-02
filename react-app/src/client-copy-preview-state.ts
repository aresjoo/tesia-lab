/** aresjoo/tesia-lab 621cbed (cpCalc updated in f209bdf): copy preview engine.
 * Synthetic, owner-scoped UI preview ONLY. No service balances, financial contract,
 * execution authority, storage, transport, timers or implicit clock reads.
 * Original simplifications (initial-amount PnL, equity-last-close, 40% reserve)
 * are deliberately retained; these are not accounting rules for a real service.
 */
import type { SharedStrategy } from './client-shared-strategies'

export const copyPreviewConfig = Object.freeze({ PROFIT_SHARE: 0.1, LOSS_GUARD: -0.2, MIN_COPY_USDT: 50 })
export type CopyPreviewCalculation = {
  inv: number; pnlPct: number; total: number; realized: number; unreal: number
  share: number; net: number; est: number; avail: number; posOpen: boolean; closedN: number
}
export type CopyPreviewLedgerEntry = { at: number; type: 'add' | 'out'; amt: number }
export type CopyPreviewRealizedBasis = {
  model: 'equity-last-close-v1'; startEquity: number; lastClosedEquity: number | null; lastClosedIndex: number | null
}
export type CopyPreviewCopy = {
  id: string; nick: string; mode: 'ratio'; amount: number; pairs: string[]
  simStartI: number | null; at: number; status: 'active' | 'closed'
  adv: { marginMode: 'follow'; lev: 'follow'; slip: 'sys'; maxMarginPct: 95; maxPosX: 5 }
  ledger: CopyPreviewLedgerEntry[]; flatI?: number; flatSnapshot?: CopyPreviewCalculation
  flatTrades?: SharedStrategy['result']['trades']; closedTrades?: SharedStrategy['result']['trades']
  closedAt?: number; settle?: CopyPreviewCalculation & { back: number }
  realizedBasis?: CopyPreviewRealizedBasis
}
export type CopyPreviewState = { v: 1; owner: string; spot: number; copies: CopyPreviewCopy[] }
export type CopyPreviewError = 'owner-mismatch' | 'invalid-input' | 'source-unavailable' | 'own-strategy'
  | 'minimum-amount' | 'insufficient-spot' | 'invalid-pairs' | 'duplicate-active' | 'duplicate-id'
  | 'copy-unavailable' | 'inactive-copy' | 'insufficient-available' | 'loss-confirmation-required' | 'no-open-position'
export type CopyPreviewActionResult = { ok: true; state: CopyPreviewState; copy?: CopyPreviewCopy }
  | { ok: false; state: CopyPreviewState; error: CopyPreviewError; message: string }
type CopyAction = { owner: string; id: string; at: number }
export type StartCopyPreviewInput = CopyAction & { amount: number; pairs: readonly string[]; mode: 'ratio' }
export type AdjustCopyPreviewInput = CopyAction & { amount: number; direction: 'add' | 'out'; confirmLoss?: boolean }
const errors: Record<CopyPreviewError, string> = {
  'owner-mismatch': '현재 계정의 카피 상태를 다시 확인해주세요.',
  'invalid-input': '입력을 확인해주세요.', 'source-unavailable': '카피 원본 데이터를 확인할 수 없어요.',
  'own-strategy': '내 전략은 카피할 수 없어요.', 'minimum-amount': '최소 50 USDT부터 시작할 수 있어요.',
  'insufficient-spot': '스팟 잔고보다 커요.', 'invalid-pairs': '따라갈 페어를 최소 1개 선택해주세요.',
  'duplicate-active': '이미 이 트레이더를 카피하고 있어요.', 'duplicate-id': '카피 식별자를 다시 확인해주세요.',
  'copy-unavailable': '카피를 찾을 수 없어요.', 'inactive-copy': '진행 중인 카피가 아니에요.',
  'insufficient-available': '출금 가능 금액을 넘었어요.', 'loss-confirmation-required': '잠깐, 손실 구간이에요.',
  'no-open-position': '지금 열려 있는 카피 포지션이 없어요.',
}
const fail = (state: CopyPreviewState, error: CopyPreviewError): CopyPreviewActionResult => ({ ok: false, state, error, message: errors[error] })
const validAt = (at: number) => Number.isFinite(at) && at >= 0
const owned = (state: CopyPreviewState, owner: string) => Boolean(owner.trim()) && state.owner === owner

export function createCopyPreviewState(owner: string): CopyPreviewState {
  if (!owner.trim()) throw new RangeError('카피 미리보기 소유자가 필요해요.')
  return { v: 1, owner, spot: 1000, copies: [] }
}
export function copyPreviewPairs(source: SharedStrategy | null): string[] {
  if (!source) return []
  const pairs: Record<string, string> = { 비트코인: 'BTC/USDT', 이더리움: 'ETH/USDT', 나스닥: 'NAS100/USDT' }
  return [...new Set([pairs[source.asset] ?? source.asset, 'ETH/USDT', 'SOL/USDT'])]
}
function usableSource(source: SharedStrategy | null): source is SharedStrategy {
  if (!source?.result || source.result.eq.length < 32) return false
  const { eq, trades } = source.result
  return eq.every((point, index) => Number.isFinite(point.i) && Number.isFinite(point.v) && point.v > 0
    // The source appends a final close at the same index as its last observation.
    && (index === 0 || point.i >= eq[index - 1].i))
    && trades.every(trade => Number.isFinite(trade.exit ?? trade.entry) && Number.isFinite(trade.pnl))
}

// Preserve the source's latest-index close and reverse observation lookup (also
// when the final equity observations share an index). This is preview metadata,
// not evidence of actual executions or a financial accounting contract.
function equityRealizedBasis(startEquity: number, eq: SharedStrategy['result']['eq'], closed: SharedStrategy['result']['trades']): CopyPreviewRealizedBasis {
  const lastX = closed.reduce((last, trade) => Math.max(last, trade.exit ?? trade.entry), -1)
  return { model: 'equity-last-close-v1', startEquity,
    lastClosedIndex: lastX >= 0 ? lastX : null,
    lastClosedEquity: lastX >= 0 ? (equityAtOrBefore(eq, lastX)?.v ?? startEquity) : null }
}
function equityAtOrBefore(eq: SharedStrategy['result']['eq'], index: number) {
  for (let i = eq.length - 1; i >= 0; i--) if (eq[i].i <= index) return eq[i]
}
function copyWindow(copy: CopyPreviewCopy, source: SharedStrategy) {
  const { eq, trades } = source.result, startI = copy.simStartI ?? eq[eq.length - 31].i
  const e0 = eq.find(point => point.i >= startI) ?? eq[0]
  const e1 = copy.flatI === undefined ? eq[eq.length - 1] : equityAtOrBefore(eq, copy.flatI)
  const closed = trades.filter(trade => (trade.exit ?? trade.entry) >= startI
    && (copy.flatI === undefined || (trade.exit ?? trade.entry) <= copy.flatI))
  return { e0, e1, closed, basis: equityRealizedBasis(e0.v, eq, closed) }
}

export function calculateCopyPreview(copy: CopyPreviewCopy, source: SharedStrategy | null): CopyPreviewCalculation | null {
  // Closed details and cards consume the SAME fixed snapshot, even without a source.
  if (copy.status === 'closed') return copy.settle ? { ...copy.settle } : null
  const inv = copy.ledger.reduce((sum, entry) => sum + (entry.type === 'add' ? entry.amt : -entry.amt), 0)
  if (!Number.isFinite(inv)) return null
  if (copy.flatSnapshot) {
    const fixed = copy.flatSnapshot
    return { ...fixed, inv, est: inv + fixed.net, avail: Math.max(0, inv + fixed.net) }
  }
  if (!usableSource(source) || source.nick !== copy.nick || !Number.isFinite(copy.amount) || copy.amount <= 0) return null
  const { e0, e1, closed, basis } = copyWindow(copy, source)
  if (!e1) return null
  const pnlPct = e1.v / e0.v - 1, total = copy.amount * pnlPct
  const realized = copy.flatI !== undefined ? total
    : basis.lastClosedEquity === null ? 0 : copy.amount * (basis.lastClosedEquity / basis.startEquity - 1)
  const unreal = total - realized, share = Math.max(0, realized) * copyPreviewConfig.PROFIT_SHARE
  const net = total - share, posOpen = Math.abs(unreal) > copy.amount * 0.002, est = inv + net
  const result = { inv, pnlPct, total, realized, unreal, share, net, est,
    avail: Math.max(0, est - (posOpen ? copy.amount * 0.4 : 0)), posOpen, closedN: closed.length }
  return Object.values(result).every(value => typeof value === 'boolean' || Number.isFinite(value)) ? result : null
}

function snapshotTrades(copy: CopyPreviewCopy, source: SharedStrategy | null): SharedStrategy['result']['trades'] {
  if (copy.flatTrades) return copy.flatTrades.map(trade => ({ ...trade }))
  if (!source || source.nick !== copy.nick) return []
  const startI = copy.simStartI ?? source.result.eq[source.result.eq.length - 31]?.i ?? 0
  const endI = copy.flatI ?? source.result.eq[source.result.eq.length - 1]?.i ?? 0
  return source.result.trades.filter(trade => (trade.exit ?? trade.entry) >= startI && (trade.exit ?? trade.entry) <= endI)
    .map(trade => ({ ...trade }))
}

function replaceCopy(state: CopyPreviewState, copy: CopyPreviewCopy, spot = state.spot): CopyPreviewActionResult {
  if (!Number.isFinite(spot) || spot < 0) return fail(state, 'invalid-input')
  return { ok: true, state: { ...state, spot, copies: state.copies.map(item => item.id === copy.id ? copy : item) }, copy }
}
function actionCopy(state: CopyPreviewState, input: CopyAction): CopyPreviewCopy | CopyPreviewActionResult {
  if (!owned(state, input.owner)) return fail(state, 'owner-mismatch')
  if (!validAt(input.at)) return fail(state, 'invalid-input')
  const copy = state.copies.find(item => item.id === input.id)
  if (!copy) return fail(state, 'copy-unavailable')
  if (copy.status !== 'active') return fail(state, 'inactive-copy')
  if (input.at < (copy.ledger[copy.ledger.length - 1]?.at ?? copy.at)) return fail(state, 'invalid-input')
  return copy
}
export function startCopyPreview(state: CopyPreviewState, input: StartCopyPreviewInput, source: SharedStrategy | null): CopyPreviewActionResult {
  if (!owned(state, input.owner)) return fail(state, 'owner-mismatch')
  if (!input.id.trim() || !validAt(input.at) || input.mode !== 'ratio' || !Number.isFinite(input.amount)) return fail(state, 'invalid-input')
  if (!usableSource(source)) return fail(state, 'source-unavailable')
  if (source.me) return fail(state, 'own-strategy')
  if (input.amount < copyPreviewConfig.MIN_COPY_USDT) return fail(state, 'minimum-amount')
  if (input.amount > state.spot) return fail(state, 'insufficient-spot')
  if (!input.pairs.length || input.pairs.some(pair => !copyPreviewPairs(source).includes(pair))
    || new Set(input.pairs).size !== input.pairs.length) return fail(state, 'invalid-pairs')
  if (state.copies.some(copy => copy.id === input.id)) return fail(state, 'duplicate-id')
  if (state.copies.some(copy => copy.nick === source.nick && copy.status === 'active')) return fail(state, 'duplicate-active')
  const copy: CopyPreviewCopy = { id: input.id, nick: source.nick, mode: 'ratio', amount: input.amount, pairs: [...input.pairs],
    simStartI: source.result.eq[source.result.eq.length - 31].i,
    adv: { marginMode: 'follow', lev: 'follow', slip: 'sys', maxMarginPct: 95, maxPosX: 5 },
    at: input.at, status: 'active', ledger: [{ at: input.at, type: 'add', amt: input.amount }] }
  const spot = state.spot - input.amount
  if (!Number.isFinite(spot) || spot < 0) return fail(state, 'invalid-input')
  return { ok: true, state: { ...state, spot, copies: [...state.copies, copy] }, copy }
}
export function adjustCopyPreview(state: CopyPreviewState, input: AdjustCopyPreviewInput, source: SharedStrategy | null): CopyPreviewActionResult {
  const copy = actionCopy(state, input)
  if ('ok' in copy) return copy
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !['add', 'out'].includes(input.direction)) return fail(state, 'invalid-input')
  const d = calculateCopyPreview(copy, source)
  if (!d) return fail(state, 'source-unavailable')
  if (input.direction === 'add' && input.amount > state.spot) return fail(state, 'insufficient-spot')
  if (input.direction === 'out' && input.amount > d.avail + 1e-9) return fail(state, 'insufficient-available')
  // 0.8 / 1 - 1 is slightly above -0.2 in binary floating point.
  if (input.direction === 'add' && d.pnlPct <= copyPreviewConfig.LOSS_GUARD + Number.EPSILON && input.confirmLoss !== true) return fail(state, 'loss-confirmation-required')
  return replaceCopy(state, { ...copy, ledger: [...copy.ledger, { at: input.at, type: input.direction, amt: input.amount }] },
    state.spot + (input.direction === 'add' ? -input.amount : input.amount))
}
export function flattenCopyPreview(state: CopyPreviewState, input: CopyAction, source: SharedStrategy | null): CopyPreviewActionResult {
  const copy = actionCopy(state, input)
  if ('ok' in copy) return copy
  if (!usableSource(source) || source.nick !== copy.nick) return fail(state, 'source-unavailable')
  const d = calculateCopyPreview(copy, source)
  if (!d) return fail(state, 'source-unavailable')
  if (!d.posOpen || copy.flatI !== undefined) return fail(state, 'no-open-position')
  const flattened = { ...copy, flatI: source.result.eq[source.result.eq.length - 1].i }
  const fixed = calculateCopyPreview(flattened, source)
  if (!fixed) return fail(state, 'source-unavailable')
  return replaceCopy(state, { ...flattened, flatSnapshot: fixed, flatTrades: snapshotTrades(flattened, source) })
}
export function closeCopyPreview(state: CopyPreviewState, input: CopyAction, source: SharedStrategy | null): CopyPreviewActionResult {
  const copy = actionCopy(state, input)
  if ('ok' in copy) return copy
  const d = calculateCopyPreview(copy, source)
  if (!d) return fail(state, 'source-unavailable')
  const back = Math.max(0, d.est)
  let realizedBasis: CopyPreviewRealizedBasis | undefined
  if (copy.flatI === undefined) {
    if (!usableSource(source) || source.nick !== copy.nick) return fail(state, 'source-unavailable')
    realizedBasis = copyWindow(copy, source).basis
  }
  const unknownLegacyTrades = copy.flatI !== undefined && copy.flatTrades === undefined
  const closedTrades = unknownLegacyTrades ? undefined : snapshotTrades(copy, source)
  if (closedTrades && closedTrades.length !== d.closedN) return fail(state, 'source-unavailable')
  // Legacy flat snapshots can outlive their source and predate trade snapshots.
  // Preserve the known fixed settlement; missing trades are not an empty history.
  return replaceCopy(state, { ...copy, status: 'closed', closedAt: input.at,
    ...(closedTrades ? { closedTrades } : {}),
    ...(realizedBasis ? { realizedBasis } : {}),
    settle: { ...d, posOpen: false, avail: 0, back }, ledger: [...copy.ledger, { at: input.at, type: 'out', amt: back }] }, state.spot + back)
}
export function topUpCopyPreview(state: CopyPreviewState, owner: string): CopyPreviewActionResult {
  if (!owned(state, owner)) return fail(state, 'owner-mismatch')
  const spot = state.spot + 1000
  return Number.isFinite(spot) ? { ok: true, state: { ...state, spot } } : fail(state, 'invalid-input')
}
export function copyPreviewDashboard(state: CopyPreviewState, sources: readonly SharedStrategy[]) {
  const rows = [...state.copies].reverse().map(copy => ({ copy, calculation: calculateCopyPreview(copy, sources.find(row => row.nick === copy.nick) ?? null) }))
  const active = rows.filter(row => row.copy.status === 'active')
  const sum = { est: 0, avail: 0, net: 0, unreal: 0, realized: 0, share: 0 }
  for (const row of active) if (row.calculation) {
    for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += row.calculation[key]
  }
  // Never silently portray missing-source active balances as zero.
  return { rows, active, sum: active.some(row => !row.calculation) ? null : sum }
}
