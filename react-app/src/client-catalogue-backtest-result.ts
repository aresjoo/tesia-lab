/** Frozen catalogue rules + frozen price series, same btCompute requested-start calculation. */
import { catalogueAssets, catalogueSourceSha, findCatalogueStrategy, freezeCatalogueValue } from './client-catalogue'
import type { CatalogueMarketData } from './client-catalogue-market-data'
import { runCatalogueSpotPreview } from './client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from './client-catalogue-futures-engine'
import { catalogueJudgments } from './client-catalogue-judgments'
import type { CatalogueOrderRow } from './client-catalogue-presentation'
import { catalogueBacktestRunId, validCatalogueBacktestSelection, type CatalogueBacktestObservation, type CatalogueBacktestSelection } from './client-catalogue-backtest'

export function computeCatalogueBacktest(selection: CatalogueBacktestSelection, data: CatalogueMarketData): CatalogueBacktestObservation {
  if (!validCatalogueBacktestSelection(selection)) throw Error('catalogue backtest selection unavailable')
  const strategy = findCatalogueStrategy(selection.strategyId)!, end = data.length - 1
  const start = selection.period ? Math.max(strategy.startI, end - selection.period) : strategy.startI
  const result = strategy.fut ? runCatalogueFuturesPreview(strategy, data, start) : runCatalogueSpotPreview(strategy, data, start)
  const assets = catalogueAssets(strategy), prices = assets.map(asset => data.prices(asset)), first = result.eq[0].i
  const benchmark = result.eq.map(p => ({ i: p.i, v: prices.reduce((sum, price) => sum + price[p.i] / price[first], 0) / prices.length }))
  let peak = 0, benchmarkMdd = 0
  for (const p of benchmark) { peak = Math.max(peak, p.v); benchmarkMdd = Math.min(benchmarkMdd, (p.v / peak - 1) * 100) }
  const calendar = { start: data.spot.start, asof: data.spot.asof }, dataVersion = { spot: data.spot.v, futures: data.future.v }
  const calculation = selection.period ? 'restart-run' : 'full-run'
  const signals = new Map(result.events.filter(e => (e.t === 'enter' || e.t === 'exit') && e.tid != null && e.xi != null).map(e => [`${e.tid}:${e.t}:${e.xi}`, e.i]))
  const orders: CatalogueOrderRow[] = []
  for (const trade of result.trades) {
    orders.push({ id: `${trade.id}:entry`, positionId: trade.id, asset: trade.asset, action: 'entry', side: trade.side, date: trade.entry,
      signal: signals.get(`${trade.id}:enter:${trade.entry}`) ?? null, price: trade.ep, units: Math.abs(trade.units) * selection.amount, amount: trade.cost * selection.amount })
    orders.push({ id: `${trade.id}:exit`, positionId: trade.id, asset: trade.asset, action: 'exit', side: trade.side, date: trade.exit,
      signal: signals.get(`${trade.id}:exit:${trade.exit}`) ?? null, price: trade.xp, units: Math.abs(trade.units) * selection.amount, amount: trade.got * selection.amount, pnl: trade.pnl * 100 })
  }
  const open = result.state.open
  for (const p of Array.isArray(open) ? open : open ? [open] : []) orders.push({ id: `${p.tid}:entry`, positionId: p.tid, asset: p.k,
    action: 'entry', side: 'side' in p ? p.side : undefined, open: true, date: p.entry, signal: signals.get(`${p.tid}:enter:${p.entry}`) ?? null,
    price: p.ep, units: Math.abs(p.units) * selection.amount, amount: p.cost * selection.amount })
  orders.sort((a, b) => b.date - a.date || (a.action === b.action ? b.positionId - a.positionId : a.action === 'exit' ? 1 : -1))
  return freezeCatalogueValue({ ...selection, source: 'client-snapshot-preview', sourceSha: catalogueSourceSha,
    runId: catalogueBacktestRunId(selection, calendar, dataVersion), calendar, dataVersion, strategy, calculation, result,
    judgments: catalogueJudgments({ strategy, calendar, result, calculation }, data), benchmark,
    benchmarkReturn: (benchmark.at(-1)!.v - 1) * 100, benchmarkMdd, orders })
}

/** Source btPlan local visual replay pacing. Computation has already completed; not a service-job timer. */
export function catalogueBacktestReplay(value: CatalogueBacktestObservation) {
  const { result: r, strategy: s } = value, ai = s.kind === 'agent' || s.kind === 'mix' && s.gate > 0
  const first = r.eq[0].i, groups = new Map<number, typeof r.events>()
  for (const e of r.events) if (['enter', 'veto', 'skip', 'hold'].includes(e.t)) groups.set(e.i, [...(groups.get(e.i) ?? []), e])
  const important = new Set<number>()
  if (ai && r.trades.length >= 4) {
    const trades = [...r.trades].sort((a, b) => a.pnl - b.pnl)
    for (const trade of [trades[0], trades.at(-1)!]) for (const e of r.events) if (e.t === 'enter' && e.tid === trade.id) important.add(e.i)
  }
  const stops = [...groups.entries()].sort(([a], [b]) => a - b).map(([i, events]) => ({ i, events, j: i - first, kind: events.some(e => e.t === 'enter') ? 'buy' : events[0].t === 'hold' ? 'hold' : 'skip', dwell: 0, full: false }))
  let buy = false, skip = false, brief = 0
  const gap = Math.max(2, Math.round(r.eq.length / 110))
  for (const [index, stop] of stops.entries()) {
    if (stop.kind === 'hold') continue
    const skipped = stop.kind === 'skip', previous = stops[index - 1]
    if ((skipped ? !skip : !buy) || important.has(stop.i)) { stop.full = true; stop.dwell = ai ? 3200 : 2100; if (skipped) skip = true; else buy = true }
    else if (previous && previous.dwell > 0 && !previous.full && stop.j - previous.j <= gap && previous.kind === stop.kind) stop.dwell = 0
    else if (brief < 7) { stop.dwell = ai ? 420 : 320; brief++ }
  }
  const bar = Math.max(4.5, Math.min(14, 5200 / r.eq.length)), segments: { start: number; end: number; a: number; b: number; stop?: typeof stops[number] }[] = []
  let time = 700, previous = -1
  for (const stop of stops) {
    const end = stop.dwell ? stop.j - 1 : stop.j
    if (end > previous) { const duration = (end - previous) * bar; segments.push({ start: time, end: time + duration, a: previous, b: end }); time += duration; previous = end }
    if (stop.dwell) { segments.push({ start: time, end: time + stop.dwell, a: stop.j, b: stop.j, stop }); time += stop.dwell; previous = stop.j }
  }
  if (previous < r.eq.length - 1) { const duration = (r.eq.length - 1 - previous) * bar; segments.push({ start: time, end: time + duration, a: previous, b: r.eq.length - 1 }); time += duration }
  return { duration: time + 900, segments }
}
