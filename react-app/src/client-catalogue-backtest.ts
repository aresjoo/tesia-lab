/** Local source backtest display port. It grants no service/order/credential authority. */
import { catalogueAssets, catalogueSourceSha, findCatalogueStrategy, freezeCatalogueValue, type CatalogueStrategy } from './client-catalogue'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import type { CatalogueJudgment } from './client-catalogue-judgments'
import type { CatalogueOrderRow } from './client-catalogue-presentation'
import type { CatalogueBacktestEvidence, CatalogueEvidenceDecision } from './client-catalogue-backtest-evidence-types'

export const catalogueBacktestPeriods = [90, 365, 730, 0] as const
export const catalogueBacktestAmounts = [500, 1000, 3000, 10000] as const
export type CatalogueBacktestPeriod = typeof catalogueBacktestPeriods[number]
export type CatalogueBacktestAmount = typeof catalogueBacktestAmounts[number]
export type CatalogueBacktestSelection = { owner: string; strategyId: string; period: CatalogueBacktestPeriod; amount: CatalogueBacktestAmount }
export type CatalogueBacktestObservation = CatalogueBacktestSelection & {
  source: 'client-snapshot-preview'; sourceSha: string; runId: string
  calendar: CataloguePreviewResult['calendar']; dataVersion: CataloguePreviewResult['dataVersion']
  strategy: Readonly<CatalogueStrategy>; calculation: 'restart-run' | 'full-run'
  result: CataloguePreviewResult['result']; judgments: readonly CatalogueJudgment[]
  benchmark: readonly { i: number; v: number }[]; benchmarkReturn: number; benchmarkMdd: number
  orders: readonly CatalogueOrderRow[]
  evidence: CatalogueBacktestEvidence
}
export type CatalogueBacktestUseBinding = {
  source: 'client-snapshot-preview'; sourceSha: string; owner: string; strategyId: string; runId: string
  calendar: CataloguePreviewResult['calendar']; dataVersion: CataloguePreviewResult['dataVersion']
  period: CatalogueBacktestPeriod; amount: CatalogueBacktestAmount; configuration: Readonly<CatalogueStrategy>
  result: { ret: number; mdd: number; winRate: number; n: number; benchmarkReturn: number; equity: readonly { i: number; v: number }[] }
}
export type CatalogueBacktestRequest = { kind: 'run'; requestId: number; selection: CatalogueBacktestSelection } | { kind: 'cancel'; requestId: number }
export type CatalogueBacktestReply = { kind: 'result'; requestId: number; value: CatalogueBacktestObservation } | { kind: 'error'; requestId: number }
type WorkerPort = Pick<Worker, 'postMessage' | 'terminate'> & {
  onmessage: ((event: MessageEvent<CatalogueBacktestReply>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}
const fail = () => Error('백테스트 자료를 확인하지 못했습니다. 기존 조건은 그대로 있습니다.')
const cancelled = () => new DOMException('catalogue backtest cancelled', 'AbortError')
export function validCatalogueBacktestSelection(value: unknown): value is CatalogueBacktestSelection {
  try {
  if (!value || typeof value !== 'object') return false
  const v = value as CatalogueBacktestSelection
  return typeof v.owner === 'string' && v.owner.trim() === v.owner && v.owner.length > 0 && v.owner.length <= 320
    && typeof v.strategyId === 'string' && findCatalogueStrategy(v.strategyId)?.id === v.strategyId
    && catalogueBacktestPeriods.includes(v.period) && catalogueBacktestAmounts.includes(v.amount)
  } catch { return false }
}
export function catalogueBacktestRunId(selection: CatalogueBacktestSelection, calendar: CataloguePreviewResult['calendar'], dataVersion: CataloguePreviewResult['dataVersion']) {
  return JSON.stringify([catalogueSourceSha, selection.owner, selection.strategyId, selection.period, selection.amount, calendar.start, calendar.asof, dataVersion.spot, dataVersion.futures])
}
/** Same indicator warmup as the immutable spot/futures engines; requested period is still passed verbatim. */
export function catalogueBacktestEffectiveStart(strategy: Readonly<CatalogueStrategy>, end:number, period:CatalogueBacktestPeriod) {
  const requested=period?Math.max(strategy.startI,end-period):strategy.startI
  return strategy.fut ? Math.max(61,'n' in strategy?strategy.n:0,'look' in strategy?strategy.look+2:0,'reg' in strategy?(strategy.reg??0)+2:0,'slow' in strategy?strategy.slow+2:0,requested, 'n' in strategy?strategy.n+2:0) : Math.max(61,strategy.kind==='rule'?0:strategy.look+1,requested)
}
/** Bounded display-only validation. Raw events stay in result, not duplicated per row.
 * Source prices are shared once per catalogue asset, up to 32 * 10,000 values.
 * The existing result owner/source/configuration gate runs before this check.
 */
function validEvidence(v: CatalogueBacktestObservation, end: number): boolean {
  const evidence = v.evidence, assets = catalogueAssets(v.strategy), events = v.result.events
  const text = (x: unknown): x is string => typeof x === 'string' && x.length <= 8192
  const number = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e15
  const positive = (x: unknown): x is number => number(x) && x > 0
  const nullable = (x: unknown) => x === null || number(x)
  const index = (x: unknown, max = end): x is number => Number.isSafeInteger(x) && Number(x) >= 0 && Number(x) <= max
  const side = (x: unknown) => x === undefined || x === 1 || x === -1
  const pair = (x: unknown) => Array.isArray(x) && x.length === 2 && x.every(text)
  const ups = (x: unknown) => x == null || Array.isArray(x) && x.length <= assets.length && new Set(x).size === x.length && x.every(a => typeof a === 'string' && assets.includes(a))
  if (!evidence || evidence.source !== v.source || evidence.sourceSha !== v.sourceSha || evidence.runId !== v.runId
    || !Array.isArray(events) || events.length > 200000 || !Array.isArray(evidence.decisions) || evidence.decisions.length > events.length
    || !Array.isArray(evidence.dailyGroups) || evidence.dailyGroups.length > end + 1
    || !evidence.prices || evidence.prices.source !== 'client-snapshot-close' || evidence.prices.calendarStartIndex !== 0
    || assets.length > 32 || !Array.isArray(evidence.prices.series) || evidence.prices.series.length !== assets.length) return false
  for (const [i, series] of evidence.prices.series.entries()) {
    if (!series || series.asset !== assets[i] || !Array.isArray(series.values) || series.values.length !== end + 1
      || series.values.some((p: unknown) => !number(p) || p <= 0)) return false
  }
  // Display formatters call numeric methods directly. Preserve the source's nullable
  // metrics, but reject malformed worker values before they reach those formatters.
  if (![v.result.pf, v.result.cagr, v.result.exposure, v.result.costImpact, v.result.avgHold].every(nullable)
    || !(v.result.underwaterDays === null || index(v.result.underwaterDays))) return false
  if (!Array.isArray(v.result.trades) || v.result.trades.length > 200000 || v.result.trades.some(t =>
    !index(t.id, 200000) || t.id === 0 || !assets.includes(t.asset) || !index(t.entry) || !index(t.exit)
    || t.entry < v.result.eq[0].i || t.exit < t.entry || !side(t.side)
    || !positive(t.ep) || !positive(t.xp) || !positive(t.cost) || !number(t.got) || t.got < 0 || !number(t.pnl)
    || t.lev !== undefined && !positive(t.lev))) return false
  const trades = new Map(v.result.trades.map(t => [t.id, { asset: t.asset, entry: t.entry, exit: t.exit, side: t.side }]))
  if (trades.size !== v.result.trades.length) return false
  const open = v.result.state.open
  for (const p of Array.isArray(open) ? open : open ? [open] : []) {
    if (!index(p.tid, 200000) || p.tid === 0 || trades.has(p.tid) || !assets.includes(p.k)
      || !index(p.entry) || p.entry < v.result.eq[0].i || !side('side' in p ? p.side : undefined)
      || !positive(p.ep) || !positive(p.px) || !positive(p.cost)
      || (v.strategy.fut ? !('pnl' in p) || !number(p.pnl) : !number(p.chg))
      || 'pnl' in p && !number(p.pnl) || 'lev' in p && !positive(p.lev)) return false
    trades.set(p.tid, { asset: p.k, entry: p.entry, exit: -1, side: 'side' in p ? p.side : undefined })
  }
  const kinds = { enter: 'buy', exit: 'sell', veto: 'skip', skip: 'skip', hold: 'hold', pick: 'pick' } as const
  const groups = new Map<number, CatalogueEvidenceDecision[]>()
  let ix = 0
  for (const [eventIndex, event] of events.entries()) {
    if (!event || !index(event.i) || event.i < v.result.eq[0].i || event.a !== undefined && !assets.includes(event.a)) return false
    if (event.t === 'unpick') continue
    if (!Object.hasOwn(kinds, event.t)) return false
    const d = evidence.decisions[ix]
    if (!d || d.runId !== v.runId || d.ix !== ix || d.eventIndex !== eventIndex || d.i !== event.i
      || d.j !== Math.max(0, Math.min(v.result.eq.length - 1, event.i - v.result.eq[0].i))
      || d.k !== kinds[event.t] || d.a !== event.a || d.tid !== event.tid || d.side !== event.side || !side(d.side)
      || d.pnl !== (event.t === 'exit' ? event.pnl : undefined) || d.pnl !== undefined && !number(d.pnl)
      || ['tag', 'title', 'cmp', 'why', 'tk', 'act', 'say'].some(k => !text(d[k as keyof CatalogueEvidenceDecision]))
      || !Array.isArray(d.facts) || d.facts.length > 32 || !d.facts.every(pair)
      || [d.p0, d.p1, d.p2].some(p => p != null && !pair(p)) || !ups(d.ups)
      || d.chain !== undefined && d.chain !== 0 && d.chain !== 1
      || d.out !== null && (!d.out || !text(d.out.t) || !number(d.out.v) || d.out.mute !== undefined && d.out.mute !== 1)
      || Object.hasOwn(d, 'e')) return false
    // Source btCompute/fuBtDec always provide these fields for the daily
    // decision chain. A non-gated strategy may intentionally have p1:null.
    if (['buy', 'skip', 'hold'].includes(d.k) && (!pair(d.p0) || !pair(d.p2) || !Object.hasOwn(d, 'p1') || d.p1 === undefined)) return false
    if (d.tid !== undefined) {
      const t = trades.get(d.tid)
      if (!index(d.tid, 200000) || !t || t.asset !== d.a || t.side !== d.side
        || !index(event.xi) || event.xi < event.i || event.xi !== (event.t === 'exit' ? t.exit : t.entry)) return false
    }
    if (['enter', 'exit'].includes(event.t) && d.tid === undefined) return false
    if (v.strategy.kind === 'agent' && ['buy', 'skip', 'hold'].includes(d.k)) {
      const rows = groups.get(d.j)
      if (rows) rows.push(d); else groups.set(d.j, [d])
    }
    ix++
  }
  if (ix !== evidence.decisions.length || groups.size !== evidence.dailyGroups.length) return false
  let groupIndex = 0
  for (const [j, rows] of groups) {
    const g = evidence.dailyGroups[groupIndex], first = rows[0], buys = rows.filter(d => d.k === 'buy')
    const kind = buys.length ? 'buy' : first.k
    if (!g || g.runId !== v.runId || g.ix !== groupIndex || g.i !== first.i || g.j !== j || g.k !== kind || g.out !== kind
      || !Array.isArray(g.decisionIndices) || g.decisionIndices.length !== rows.length || g.decisionIndices.some((id: number, i: number) => id !== rows[i].ix)
      || ![g.tag, g.title, g.cmp, g.why].every(text)
      || g.tag !== (buys.length ? '매수' : first.tag) || g.title !== (buys.length ? buys.map(d => d.tk).join(', ') : first.title)
      || g.cmp !== (buys.length === 1 ? buys[0].cmp : buys.length ? buys.map(d => d.tk + ' ' + d.cmp).join(' / ') : first.cmp)
      || g.why !== first.why || JSON.stringify(g.ups) !== JSON.stringify(first.ups)) return false
    groupIndex++
  }
  return true
}
export function validCatalogueBacktestObservation(value: unknown, selection: CatalogueBacktestSelection): value is CatalogueBacktestObservation {
  try {
    if (!value || typeof value !== 'object' || !validCatalogueBacktestSelection(selection)) return false
    const v = value as CatalogueBacktestObservation, strategy = findCatalogueStrategy(selection.strategyId)!
    if (v.source !== 'client-snapshot-preview' || v.sourceSha !== catalogueSourceSha || Object.entries(selection).some(([key, expected]) => v[key as keyof CatalogueBacktestSelection] !== expected)
      || JSON.stringify(v.strategy) !== JSON.stringify(strategy) || !v.calendar || !v.dataVersion || ![v.calendar.start,v.calendar.asof].every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d+'T00:00:00Z').toISOString().slice(0,10) === d) || ![v.dataVersion.spot,v.dataVersion.futures].every(d => typeof d === 'string' && d.length>0 && d.length<=160)
      || v.runId !== catalogueBacktestRunId(selection, v.calendar, v.dataVersion)) return false
    const startMs = Date.parse(v.calendar.start + 'T00:00:00Z'), endMs = Date.parse(v.calendar.asof + 'T00:00:00Z'), end = (endMs - startMs) / 86400000
    if (!Number.isSafeInteger(end) || end < 62 || end >= 10000 || v.calculation !== (selection.period ? 'restart-run' : 'full-run')) return false
    const start = catalogueBacktestEffectiveStart(strategy,end,selection.period), r = v.result
    if (!r || r.params.startI !== start || r.params.endI !== end || r.eq.length !== end - start + 1
      || r.eq.some((p, i) => p.i !== start + i || !Number.isFinite(p.v) || p.v < 0)
      || ![r.ret, r.mdd, r.winRate, r.n, v.benchmarkReturn, v.benchmarkMdd].every(Number.isFinite)
      || Math.abs(r.ret - (r.eq.at(-1)!.v - 1) * 100) > 1e-7 || r.n !== r.trades.length
      || r.winRate < 0 || r.winRate > 100 || r.mdd > 0 || v.benchmarkMdd > 0
      || v.benchmark.length !== r.eq.length || v.benchmark.some((p, i) => p.i !== r.eq[i].i || !Number.isFinite(p.v) || p.v <= 0)
      || Math.abs(v.benchmarkReturn - (v.benchmark.at(-1)!.v - 1) * 100) > 1e-7
      || !Array.isArray(v.judgments) || v.judgments.some(j => !Number.isSafeInteger(j.i) || j.i<strategy.startI || j.i>end || !['intro','now','buy','sell','skip','wait','hold','pick'].includes(j.k) || typeof j.t!=='string' || typeof j.title!=='string')
      || !Array.isArray(v.orders) || v.orders.some(o => typeof o.id!=='string' || !Number.isSafeInteger(o.positionId) || !['entry','exit'].includes(o.action) || typeof o.asset!=='string' || !Number.isSafeInteger(o.date) || o.date<start || o.date>end || ![o.price,o.units,o.amount].every(n => Number.isFinite(n) && n>=0) || o.price<=0)) return false
    return validEvidence(v, end)
  } catch { return false }
}
export function catalogueBacktestUseBinding(value: CatalogueBacktestObservation): Readonly<CatalogueBacktestUseBinding> {
  if (!validCatalogueBacktestObservation(value, {owner:value.owner,strategyId:value.strategyId,period:value.period,amount:value.amount})) throw fail()
  return Object.freeze({ source: value.source, sourceSha: value.sourceSha, owner: value.owner, strategyId: value.strategyId, runId: value.runId,
    calendar: Object.freeze({ ...value.calendar }), dataVersion: Object.freeze({ ...value.dataVersion }), period: value.period, amount: value.amount,
    configuration: Object.freeze({ ...value.strategy }), result: Object.freeze({ ret: value.result.ret, mdd: value.result.mdd, winRate: value.result.winRate, n: value.result.n,
      benchmarkReturn: value.benchmarkReturn, equity: Object.freeze(value.result.eq.map(p => Object.freeze({ ...p }))) }) })
}
export function createCatalogueBacktestClient(factory: () => WorkerPort = () => new Worker(new URL('./client-catalogue-backtest-worker.ts', import.meta.url), { type: 'module' })) {
  let worker: WorkerPort | null = null, retired = false, sequence = 0
  const pending = new Map<number, { selection: CatalogueBacktestSelection; resolve: (v: CatalogueBacktestObservation) => void; reject: (e: Error) => void; cleanup: () => void; timer: ReturnType<typeof setTimeout> }>()
  const settle = (id: number, value?: CatalogueBacktestObservation, error?: Error) => {
    const request = pending.get(id); if (!request) return
    pending.delete(id); request.cleanup(); clearTimeout(request.timer)
    if (error) request.reject(error); else request.resolve(freezeCatalogueValue(value!))
  }
  const stop = (error: Error) => {
    const old = worker; worker = null
    if (old) { old.onmessage = null; old.onerror = null; old.onmessageerror = null; try { old.terminate() } catch { /* retired port */ } }
    for (const id of [...pending.keys()]) settle(id, undefined, error)
  }
  const ensure = () => {
    if (worker) return worker
    const created = factory(); if (!created || typeof created.postMessage !== 'function' || typeof created.terminate !== 'function') throw fail(); worker = created
    created.onmessage = event => {
      if (worker !== created) return
      const reply = event.data
      if (!reply || !Number.isSafeInteger(reply.requestId)) { stop(fail()); return }
      const request = pending.get(reply.requestId); if (!request) return
      if (reply.kind === 'result' && validCatalogueBacktestObservation(reply.value, request.selection)) settle(reply.requestId, reply.value)
      else if (reply.kind === 'error') settle(reply.requestId, undefined, fail())
      else stop(fail())
    }
    created.onerror = event => { event.preventDefault(); if (worker === created) stop(fail()) }
    created.onmessageerror = () => { if (worker === created) stop(fail()) }
    return created
  }
  return {
    run(selection: CatalogueBacktestSelection, signal?: AbortSignal): Promise<CatalogueBacktestObservation> {
      if (retired || signal?.aborted) return Promise.reject(cancelled())
      if (!validCatalogueBacktestSelection(selection) || pending.size >= 16) return Promise.reject(fail())
      let target: WorkerPort
      try { target = ensure() } catch { return Promise.reject(fail()) }
      const requestId = ++sequence, copy = { ...selection }
      return new Promise((resolve, reject) => {
        const onAbort = () => { settle(requestId, undefined, cancelled()); try { target.postMessage({ kind: 'cancel', requestId } satisfies CatalogueBacktestRequest) } catch { /* retired */ } }
        const timer = setTimeout(() => { if (worker === target) stop(fail()) }, 30000)
        pending.set(requestId, { selection: copy, resolve, reject, cleanup: () => signal?.removeEventListener('abort', onAbort), timer })
        signal?.addEventListener('abort', onAbort, { once: true })
        if (signal?.aborted) { onAbort(); return }
        try { target.postMessage({ kind: 'run', requestId, selection: copy } satisfies CatalogueBacktestRequest) }
        catch { if (worker === target) stop(fail()) }
      })
    },
    dispose() { if (retired) return; retired = true; stop(cancelled()) },
  }
}
