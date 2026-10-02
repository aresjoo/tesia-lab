/** 412fd60 mkFutRun/fuLedger preview port. Not a venue liquidation model.
 * Source assumptions: daily Bybit snapshot, fee .055%, slip .05%, fixed MMR .5%.
 * Do not apply these constants to approved service/production execution.
 */
import { catalogueAssets, readCatalogueStrategy, type CatalogueFutureAgent, type CatalogueFutureMix, type CatalogueFutureRule } from './client-catalogue'
import type { CatalogueMarketData, CatalogueFutureSeries } from './client-catalogue-market-data'
import { catalogueStats, type CatalogueDecision, type CatalogueEquity, type CatalogueTrade } from './client-catalogue-ledger'

type Config = Readonly<CatalogueFutureAgent | CatalogueFutureMix | CatalogueFutureRule>
type Position = { id: number; k: string; side: number; lev: number; units: number; ep: number; margin: number; cost: number; fee: number; fund: number; ei: number; best: number; w: number }
const feeRate = 0.00055, slippage = 0.0005, maintenance = 0.005
function ledger() {
  const l = {
    cash: 1, pos: [] as Position[], trades: [] as CatalogueTrade[], fees: 0, fund: 0, seq: 0, liq: 0,
    equity(p: Position, price: number) { return p.margin + p.side * p.units * (price - p.ep) - p.fund },
    value(price: (k: string) => number) { let v = l.cash; for (const p of l.pos) v += Math.max(0, l.equity(p, price(p.k))); return v },
    open(k: string, side: number, amount: number, lev: number, price: number, i: number, w: number) {
      amount = Math.min(amount, l.cash)
      if (!(amount > 1e-9) || !(price > 0)) return null
      const fill = price * (1 + side * slippage), fee = amount * lev * feeRate / (1 + lev * feeRate), margin = amount - fee, units = margin * lev / fill
      l.cash -= amount; l.fees += fee
      const p: Position = { id: ++l.seq, k, side, lev, units, ep: fill, margin, cost: amount, fee, fund: 0, ei: i, best: fill, w }
      l.pos.push(p)
      return p
    },
    liquidation(p: Position) { return p.ep - p.side * (p.margin - p.fund - maintenance * p.units * p.ep) / p.units },
    close(p: Position, price: number, i: number, why: string, raw = false) {
      if (!l.pos.includes(p)) throw Error('catalogue futures: position not held')
      const fill = raw ? price : price * (1 - p.side * slippage), fee = p.units * fill * feeRate, got = why === 'liq' ? 0 : Math.max(0, l.equity(p, fill) - fee)
      l.cash += got; l.fees += fee; l.fund += p.fund; if (why === 'liq') l.liq++
      l.pos = l.pos.filter(x => x !== p)
      const t: CatalogueTrade = { id: p.id, fut: 1, entry: p.ei, exit: i, asset: p.k, side: p.side, lev: p.lev, ep: p.ep, xp: fill, units: p.side * p.units, cost: p.cost, got, fee: p.fee + fee, fund: p.fund, pnl: got / p.cost - 1, kind: why, w: p.w }
      l.trades.push(t)
      return t
    },
  }
  return l
}
const average = (p: readonly number[], n: number, i: number) => { let sum = 0; for (let k = i - n + 1; k <= i; k++) sum += p[k]; return sum / n }
const maximum = (p: readonly number[], from: number, to: number) => { let v = -Infinity; for (let i = from; i <= to; i++) if (p[i] > v) v = p[i]; return v }
const minimum = (p: readonly number[], from: number, to: number) => { let v = Infinity; for (let i = from; i <= to; i++) if (p[i] < v) v = p[i]; return v }
function volatility(p: readonly number[], i: number) { let sum = 0, square = 0; for (let k = i - 19; k <= i; k++) { const r = p[k] / p[k - 1] - 1; sum += r; square += r * r } return Math.sqrt(Math.max(1e-12, square / 20 - Math.pow(sum / 20, 2))) }
type Pending = { t: 'close'; p: Position; why: string; ev: CatalogueDecision } | { t: 'open'; k: string; side: number; w: number; ev: CatalogueDecision }

export function runCatalogueFuturesPreview(config: Config, data: CatalogueMarketData, requestedStart?: number) {
  const checked = readCatalogueStrategy(config)
  if (!checked.fut) throw Error('catalogue futures: spot not accepted')
  const c = checked, assets = catalogueAssets(c), series = new Map<string, CatalogueFutureSeries>()
  for (const k of assets) {
    if (!Object.hasOwn(data.future.sym, k)) throw Error('catalogue futures: missing asset')
    series.set(k, data.future.sym[k])
  }
  if (requestedStart !== undefined && (!Number.isSafeInteger(requestedStart) || requestedStart < 0)) throw Error('catalogue futures: invalid start')
  const n = 'n' in c ? c.n : 0, look = 'look' in c ? c.look : 0, reg = 'reg' in c ? c.reg ?? 0 : 0, slow = 'slow' in c ? c.slow : 0
  const startI = Math.max(61, n + 2, look + 2, reg + 2, slow + 2, requestedStart ?? c.startI), endI = data.length - 1
  if (startI > endI) throw Error('catalogue futures: insufficient range')
  const lev = c.lev, l = ledger(), eq: CatalogueEquity[] = [], events: CatalogueDecision[] = []
  let pending: Pending[] = [], current = startI, invested = 0
  const px = (k: string) => series.get(k)!.c[current], top = c.kind === 'agent' ? c.top : 1, every = c.kind === 'rule' ? 1 : c.every
  let pickL: string | null = c.kind === 'rule' ? c.asset : null, pickS = pickL, regime = c.kind === 'rule' ? 2 : 0
  let lastTop: { up: number; of: number; top: { k: string; mom: number }[]; bot: { k: string; mom: number }[] } | null = null
  const queueClose = (p: Position, why: string, i: number) => {
    if (pending.some(o => o.t === 'close' && o.p === p)) return
    const ev: CatalogueDecision = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why, _pend: 1 }
    events.push(ev); pending.push({ t: 'close', p, why, ev })
  }
  const queueOpen = (k: string, side: number, w: number, i: number, extra: Partial<CatalogueDecision>) => {
    const ev: CatalogueDecision = { i, t: 'enter', a: k, side, lev, _pend: 1, ...extra }
    events.push(ev); pending.push({ t: 'open', k, side, w, ev })
  }
  const fillExit = (e: CatalogueDecision, t: CatalogueTrade) => {
    delete e._pend
    Object.assign(e, { xi: t.exit, tid: t.id, px: t.xp, units: Math.abs(t.units), got: t.got, fee: t.fee, fund: t.fund, ep: t.ep, chg: t.side! * (t.xp / t.ep - 1) * 100, pnl: t.pnl * 100 })
  }
  const signal = (k: string, i: number) => {
    if (c.kind === 'agent') return 0
    const d = series.get(k)!, close = d.c
    let s = 0
    if (c.mode === 'brk') {
      if (close[i] > maximum(d.h, i - c.n, i - 1)) s = 1
      else if (close[i] < minimum(d.l, i - c.n, i - 1)) s = -1
    } else if (c.mode === 'ma') {
      const f0 = average(close, c.fast, i), s0 = average(close, c.slow, i), f1 = average(close, c.fast, i - 1), s1 = average(close, c.slow, i - 1)
      if (f0 > s0 && f1 <= s1) s = 1
      else if (f0 < s0 && f1 >= s1) s = -1
    } else if (c.mode === 'fg') {
      const fear = data.fear(i), change = close[i] / close[i - 1] - 1
      if (fear !== null && fear <= c.lo && change > 0.005) s = 1
      else if (fear !== null && fear >= c.hi && change < -0.005) s = -1
    } else {
      const change = close[i] / close[i - 1] - 1, down = close[i] / maximum(d.h, i - c.n, i) - 1, up = close[i] / minimum(d.l, i - c.n, i) - 1
      if (down <= -c.dip / 100 && change > 0.005) s = 1
      else if (up >= c.dip / 100 && change < -0.005) s = -1
    }
    if (s && reg) { const m = average(close, reg, i); if (s > 0 && close[i] < m) s = 0; if (s < 0 && close[i] > m) s = 0 }
    if ((s > 0 && c.dir === 'short') || (s < 0 && c.dir === 'long')) s = 0
    return s
  }
  const scan = (i: number) => {
    const rows = assets.map(k => { const close = series.get(k)!.c, mom = close[i] / close[i - look] - 1, vol = volatility(close, i); return { k, mom, vol, score: mom / (vol * Math.sqrt(look)), above: close[i] > average(close, 60, i) } })
    const up = rows.filter(r => r.above).length
    rows.sort((a, b) => b.score - a.score)
    return { rows, up, of: assets.length, breadth: up / assets.length }
  }
  for (let i = startI; i <= endI; i++) {
    current = i
    // 1. Orders determined at the previous close: close, then open at today's open.
    if (pending.length) {
      const openPrice = (k: string) => series.get(k)!.o[i]
      for (const o of pending) {
        if (o.t !== 'close') continue
        if (!l.pos.includes(o.p)) { o.ev._drop = 1; continue }
        const price = openPrice(o.p.k), liquidation = l.liquidation(o.p), gapLiq = o.p.side > 0 ? price <= liquidation : price >= liquidation
        if (gapLiq) o.ev.why = 'liq'
        fillExit(o.ev, l.close(o.p, price, i, gapLiq ? 'liq' : o.why, gapLiq))
      }
      let total = l.cash
      for (const p of l.pos) total += Math.max(0, l.equity(p, openPrice(p.k)))
      for (const o of pending) if (o.t === 'open') {
        const p = l.open(o.k, o.side, o.w * total, lev, openPrice(o.k), i, o.w), e = o.ev
        if (!p) { e._drop = 1; continue }
        delete e._pend
        Object.assign(e, { xi: i, tid: p.id, px: p.ep, units: p.units, cost: p.cost, fee: p.fee, liq: l.liquidation(p) })
      }
      pending = []
    }
    // 2. Gaps precede intraday stops; if SL and TP both hit, source chooses SL.
    for (const p of [...l.pos]) {
      const d = series.get(p.k)!, open = d.o[i], high = d.h[i], low = d.l[i], fresh = p.ei === i
      const liq = l.liquidation(p), stop = c.sl ? p.ep * (1 - p.side * c.sl / 100) : null, trail = c.trail && !fresh ? p.best * (1 - p.side * c.trail / 100) : null, tp = c.tp ? p.ep * (1 + p.side * c.tp / 100) : null
      const s0 = stop === null ? trail : trail === null ? stop : p.side > 0 ? Math.max(stop, trail) : Math.min(stop, trail)
      const hit = (x: number) => p.side > 0 ? low <= x : high >= x, gap = (x: number) => p.side > 0 ? open <= x : open >= x
      const exit = (why: string, ref: number, price: number, raw = false) => { const e: CatalogueDecision = { i, t: 'exit', a: p.k, side: p.side, lev: p.lev, why, ref }; events.push(e); fillExit(e, l.close(p, price, i, why, raw)) }
      if (!fresh && gap(liq)) { exit('liq', liq, open, true); continue }
      if (!fresh && tp !== null && (p.side > 0 ? open >= tp : open <= tp)) { exit('tp', tp, open, true); continue }
      if (s0 !== null && (p.side > 0 ? s0 > liq : s0 < liq) && hit(s0)) { exit(trail !== null && s0 === trail ? 'trail' : 'sl', s0, !fresh && gap(s0) ? open : s0); continue }
      if (hit(liq)) { exit('liq', liq, liq, true); continue }
      if (tp !== null && (p.side > 0 ? high >= tp : low <= tp)) { exit('tp', tp, !fresh && (p.side > 0 ? open >= tp : open <= tp) ? open : tp, true); continue }
    }
    // 3. Positive funding is paid by longs/received by shorts, in basis points.
    for (const p of l.pos) {
      const d = series.get(p.k)!; p.fund += p.side * p.units * d.c[i] * d.f[i] / 1e4
      if (p.side > 0 ? d.c[i] > p.best : d.c[i] < p.best) p.best = d.c[i]
    }
    // 4. Closing prices determine tomorrow's orders; phase uses calendar index.
    const held = (k: string) => l.pos.find(p => p.k === k)
    if (c.kind === 'agent') {
      if ((i + (c.ph ?? 0)) % every === 0) {
        const s = scan(i), rank = new Map(s.rows.map((r, q) => [r.k, q])), count = s.rows.length
        const marketRegime = c.neutral ? 2 : s.breadth >= c.gate ? 1 : s.breadth <= 1 - c.gate ? -1 : 0
        let wantL = marketRegime === 1 || marketRegime === 2 ? s.rows.slice(0, top).filter(r => c.neutral || (r.above && r.score > 0)) : []
        let wantS = marketRegime === -1 || marketRegime === 2 ? s.rows.slice(count - top).filter(r => c.neutral || (!r.above && r.score < 0)) : []
        if (c.dir === 'long') wantS = []; if (c.dir === 'short') wantL = []
        const top3 = s.rows.slice(0, 3).map(r => ({ k: r.k, mom: r.mom * 100 })), bot3 = s.rows.slice(count - 3).reverse().map(r => ({ k: r.k, mom: r.mom * 100 }))
        const want = new Map<string, number>(); for (const r of wantL) want.set(r.k, 1); for (const r of wantS) want.set(r.k, -1)
        for (const p of [...l.pos]) if (want.get(p.k) !== p.side) queueClose(p, want.get(p.k) ? 'flip' : marketRegime === 0 ? 'rest' : 'rot', i)
        const slots = (c.neutral ? 2 : 1) * top
        let fresh = 0
        for (const [r, side] of [...wantL.map(r => [r, 1] as const), ...wantS.map(r => [r, -1] as const)]) {
          const h = held(r.k); if (h && h.side === side) continue
          fresh++; queueOpen(r.k, side, 1 / slots, i, { mom: r.mom * 100, rank: side > 0 ? rank.get(r.k)! + 1 : count - rank.get(r.k)!, up: s.up, of: s.of, top: top3, bot: bot3, w: 1 / slots })
        }
        if (!fresh) events.push({ i, t: wantL.length + wantS.length ? 'hold' : 'skip', why: marketRegime === 0 ? 'gate' : 'none', up: s.up, of: s.of, top: top3, bot: bot3, held: l.pos.map(p => p.k) })
      }
    } else {
      if (c.kind === 'mix' && (i + (c.ph ?? 0)) % every === 0 && !l.pos.length) {
        const s = scan(i), count = s.rows.length, a = s.rows[0], b = s.rows[count - 1]
        regime = s.breadth >= c.gate ? 1 : s.breadth <= 1 - c.gate ? -1 : 0
        lastTop = { up: s.up, of: s.of, top: s.rows.slice(0, 3).map(r => ({ k: r.k, mom: r.mom * 100 })), bot: s.rows.slice(count - 3).reverse().map(r => ({ k: r.k, mom: r.mom * 100 })) }
        const nextL = regime > 0 ? a.k : null, nextS = regime < 0 ? b.k : null
        if (nextL !== pickL || nextS !== pickS) {
          pickL = nextL; pickS = nextS
          events.push(nextL || nextS ? { i, t: 'pick', a: (nextL || nextS)!, side: nextL ? 1 : -1, mom: (nextL ? a : b).mom * 100, up: s.up, of: s.of, top: lastTop.top, bot: lastTop.bot } : { i, t: 'unpick', up: s.up, of: s.of })
        }
      }
      const p = l.pos[0] ?? null
      if (p && !pending.length) {
        const d = series.get(p.k)!, sig = signal(p.k, i)
        let out: string | null = null
        if ('exitN' in c && c.exitN && (p.side > 0 ? d.c[i] < minimum(d.l, i - c.exitN, i - 1) : d.c[i] > maximum(d.h, i - c.exitN, i - 1))) out = 'chan'
        else if (c.hold && i - p.ei >= c.hold) out = 'time'
        if (sig && sig !== p.side && (c.kind !== 'mix' || regime === sig || regime === 2)) {
          queueClose(p, 'flip', i); queueOpen(p.k, sig, 1, i, { n: 'n' in c ? c.n : undefined, ref: sig > 0 ? maximum(d.h, i - (n || 1), i - 1) : minimum(d.l, i - (n || 1), i - 1), fng: data.fear(i), up: lastTop && lastTop.up, of: lastTop && lastTop.of })
        } else if (out) queueClose(p, out, i)
      } else if (!p && !pending.length) {
        const candidates = c.kind === 'mix' ? [pickL, pickS].filter((k): k is string => k !== null) : [c.asset]
        for (const k of candidates) {
          if (pending.length) break
          const d = series.get(k)!, sig = signal(k, i); if (!sig) continue
          if (c.kind === 'mix' && !((k === pickL && sig > 0) || (k === pickS && sig < 0))) { events.push({ i, t: 'veto', a: k, side: sig, up: lastTop && lastTop.up, of: lastTop && lastTop.of, reg: regime }); continue }
          queueOpen(k, sig, 1, i, { n: 'n' in c ? c.n : undefined, ref: c.mode === 'brk' ? sig > 0 ? maximum(d.h, i - c.n, i - 1) : minimum(d.l, i - c.n, i - 1) : null, chg1: (d.c[i] / d.c[i - 1] - 1) * 100, fng: data.fear(i), up: lastTop && lastTop.up, of: lastTop && lastTop.of })
        }
      }
    }
    const value = l.value(px); eq.push({ i, v: value }); invested += value > 0 ? (value - l.cash) / value : 0
    if (value <= 1e-6) { for (let z = i + 1; z <= endI; z++) eq.push({ i: z, v: 0 }); break }
  }
  current = endI
  const total = l.value(px), open = l.pos.map(p => {
    const v = px(p.k)
    return { held: endI - p.ei, k: p.k, tid: p.id, side: p.side, lev: p.lev, entry: p.ei, ep: p.ep, units: p.side * p.units, cost: p.cost, px: v, chg: p.side * (v / p.ep - 1) * 100, pnl: (Math.max(0, l.equity(p, v)) / p.cost - 1) * 100, liq: l.liquidation(p), w: total > 0 ? Math.max(0, l.equity(p, v)) / total : 0, fut: 1 as const }
  })
  return {
    ...catalogueStats(eq, l, { startI, endI }, invested, i => data.date(i)),
    events: events.filter(e => !e._pend && !e._drop), fut: 1 as const, liqN: l.liq,
    fundPaid: l.fund + l.pos.reduce((a, p) => a + p.fund, 0), feesPaid: l.fees,
    state: { asOf: endI, fut: 1 as const, cash: total > 0 ? l.cash / total : 1, pickL, pickS, regime, top: lastTop, open: c.kind === 'agent' ? open : open[0] ?? null },
  }
}
