/** 412fd60 mkAgentRun/mkHybridRun, isolated from DOM and mutable global PRICE.
 * Deterministic source-preview rules, not LLM decisions or service execution.
 * Decision day i and actual next open trading day xi are deliberately distinct.
 */
import { catalogueAssets, readCatalogueStrategy, type CatalogueSpotAgent, type CatalogueSpotMix, type CatalogueSpotRule, type CatalogueSpotStrategy } from './client-catalogue'
import type { CatalogueMarketData } from './client-catalogue-market-data'
import { catalogueSpotLedger, catalogueStats, type CatalogueDecision, type CatalogueEquity, type CataloguePosition } from './client-catalogue-ledger'

function sma(p: readonly number[], n: number, i: number) { let sum = 0; for (let k = i - n + 1; k <= i; k++) sum += p[k]; return sum / n }
function rsi(p: readonly number[], i: number) {
  if (i < 14) return 50
  let gain = 0, loss = 0
  for (let k = i - 13; k <= i; k++) { const d = p[k] - p[k - 1]; if (d > 0) gain += d; else loss -= d }
  return loss === 0 ? 100 : 100 - 100 / (1 + (gain / 14) / (loss / 14))
}
function volatility(p: readonly number[], i: number, n: number) {
  let sum = 0, square = 0
  for (let k = i - n + 1; k <= i; k++) { const r = p[k] / p[k - 1] - 1; sum += r; square += r * r }
  return Math.sqrt(Math.max(1e-12, square / n - (sum / n) * (sum / n)))
}
type Buy = { t: 'buy'; k: string; w: number; ev: CatalogueDecision }
type Sell = { t: 'sell'; k: string; p: CataloguePosition; why: string; ev: CatalogueDecision }

function runAgent(c: Readonly<CatalogueSpotAgent>, data: CatalogueMarketData, startI: number) {
  const assets = catalogueAssets(c), endI = data.length - 1, top = c.top
  const prices = new Map(assets.map(k => [k, data.prices(k)])), ledger = catalogueSpotLedger()
  const eq: CatalogueEquity[] = [], events: CatalogueDecision[] = []
  let current = startI, invested = 0, pending: (Buy | Sell)[] = []
  const price = (key: string) => prices.get(key)![current]
  const scan = (i: number) => {
    const rows = assets.map(k => { const p = prices.get(k)!, vol = volatility(p, i, 20), mom = p[i] / p[i - c.look] - 1; return { k, mom, vol, score: mom / (vol * Math.sqrt(c.look)), above: p[i] > sma(p, 60, i), px: p[i] } })
    const up = rows.filter(r => r.above).length
    rows.sort((a, b) => b.score - a.score)
    return { rows, up, of: assets.length, breadth: up / assets.length }
  }
  const selling = (p: CataloguePosition) => pending.some(o => o.t === 'sell' && o.p === p)
  const buying = (k: string) => pending.some(o => o.t === 'buy' && o.k === k)
  const queueExit = (p: CataloguePosition, i: number, why: string) => {
    if (selling(p)) return
    const ev: CatalogueDecision = { i, t: 'exit', a: p.k, why, _pend: 1 }
    events.push(ev); pending.push({ t: 'sell', k: p.k, p, why, ev })
  }
  for (let i = startI; i <= endI; i++) {
    current = i
    if (pending.length) {
      const keep: (Buy | Sell)[] = []
      for (const order of pending) if (order.t === 'sell') {
        if (!data.isOpen(order.p.k, i)) { keep.push(order); continue }
        const trade = ledger.sell(order.p, price(order.p.k), i, order.why), e = order.ev
        delete e._pend
        Object.assign(e, { xi: i, tid: trade.id, px: trade.xp, units: trade.units, got: trade.got, fee: trade.fee, pnl: trade.pnl * 100 })
      }
      const total = ledger.value(price)
      for (const order of pending) if (order.t === 'buy') {
        if (!data.isOpen(order.k, i)) { keep.push(order); continue }
        const p = ledger.buy(order.k, price(order.k), order.w * total, i, order.w), e = order.ev
        if (!p) { e._drop = 1; continue }
        delete e._pend
        Object.assign(e, { xi: i, tid: p.id, px: price(order.k), units: p.units, cost: p.cost, fee: p.fee, w: p.cost / total })
      }
      pending = keep
    }
    for (const p of ledger.pos) if (data.isOpen(p.k, i) && price(p.k) > p.hi) p.hi = price(p.k)
    for (const p of [...ledger.pos]) if (i > p.ei && data.isOpen(p.k, i) && price(p.k) <= p.hi * (1 - c.trail / 100)) queueExit(p, i, 'trail')
    if ((i - startI) % c.every === 0) {
      const s = scan(i), weak = s.breadth < c.gate, rank = new Map(s.rows.map((r, q) => [r.k, q]))
      for (const p of [...ledger.pos]) {
        if (!data.isOpen(p.k, i) || selling(p)) continue
        const r = s.rows[rank.get(p.k)!]
        if (i > p.ei && (r.score < 0 || !r.above)) queueExit(p, i, 'weak')
        else if (i > p.ei && rank.get(p.k)! > top + 1) queueExit(p, i, 'rot')
      }
      const candidates = s.rows.filter(r => r.above && r.score >= c.minS && data.isOpen(r.k, i) && !ledger.pos.some(p => p.k === r.k) && !buying(r.k))
      const top3 = s.rows.slice(0, 3).map(r => ({ k: r.k, mom: r.mom * 100, above: r.above }))
      const held = () => ledger.pos.filter(p => !selling(p)).map(p => p.k)
      const effectiveCount = () => ledger.pos.filter(p => !selling(p)).length + pending.filter(o => o.t === 'buy').length
      if (weak) events.push({ i, t: 'skip', why: 'gate', up: s.up, of: s.of, top: top3, held: held() })
      else if (effectiveCount() >= top) events.push({ i, t: 'hold', up: s.up, of: s.of, top: top3, held: held() })
      else if (!candidates.length) events.push({ i, t: 'skip', why: 'none', up: s.up, of: s.of, top: top3, held: held() })
      else while (effectiveCount() < top && candidates.length) {
        const r = candidates.shift()!, w = Math.max(0.1, Math.min(1 / top, (1 / top) * c.volT / r.vol)), rk = rank.get(r.k)!
        const skip = s.rows.slice(0, rk).map(sr => ({ k: sr.k, why: ledger.pos.some(p => p.k === sr.k) ? 'held' : !sr.above ? 'below' : 'weak' }))
        const ev: CatalogueDecision = { i, t: 'enter', a: r.k, mom: r.mom * 100, w, rank: rk + 1, skip, cut: w < 1 / top - 1e-9, up: s.up, of: s.of, top: top3, _pend: 1 }
        events.push(ev); pending.push({ t: 'buy', k: r.k, w, ev })
      }
    }
    const value = ledger.value(price); eq.push({ i, v: value }); invested += (value - ledger.cash) / value
  }
  current = endI
  const now = scan(endI), total = ledger.value(price)
  return {
    ...catalogueStats(eq, ledger, { startI, endI }, invested, i => data.date(i)),
    events: events.filter(e => !e._pend && !e._drop),
    state: {
      asOf: endI, cash: ledger.cash / total,
      open: ledger.pos.map(p => { const v = price(p.k); return { k: p.k, tid: p.id, entry: p.ei, ep: p.ep, units: p.units, cost: p.cost, px: v, chg: (v / p.ep - 1) * 100, w: p.units * v / total, hi: p.hi, stop: p.hi * (1 - c.trail / 100) } }),
      scan: {
        up: now.up, of: now.of, weak: now.breadth < c.gate, top: now.rows.slice(0, 4).map(x => ({ k: x.k, mom: x.mom * 100, above: x.above })),
        rows: now.rows.map((x, q) => ({ k: x.k, rank: q + 1, mom: x.mom * 100, above: x.above, ok: x.above && x.score >= c.minS, held: ledger.pos.some(p => p.k === x.k) })),
      },
      lastEval: startI + Math.floor((endI - startI) / c.every) * c.every,
      nextEval: startI + (Math.floor((endI - startI) / c.every) + 1) * c.every,
    },
  }
}

function runHybrid(c: Readonly<CatalogueSpotRule | CatalogueSpotMix>, data: CatalogueMarketData, startI: number) {
  const fixed = c.kind === 'rule' ? c.asset : null, assets = catalogueAssets(c), endI = data.length - 1, every = c.kind === 'rule' ? 1 : c.every
  const prices = new Map(assets.map(k => [k, data.prices(k)])), ledger = catalogueSpotLedger()
  const upCount = (i: number) => assets.filter(k => { const p = prices.get(k)!; return p[i] > sma(p, 60, i) }).length
  const condition = (p: readonly number[], i: number) => {
    const rv = rsi(p, i - 1), bounce = (p[i] / p[i - 1] - 1) * 100, gap = Math.abs(sma(p, 20, i) - sma(p, 60, i)) / p[i] * 100, up = upCount(i), fear = data.fear(i)
    return { i, rsi: rv, rsiOk: rv < c.rsiTh, bounce, bounceOk: bounce > 0.5, gap, trendOk: c.kind !== 'rule' || !c.tf || gap > 3,
      fng: fear, fngOk: c.kind !== 'rule' || c.fng == null || (fear !== null && fear <= c.fng), up, of: assets.length, mktOk: c.kind === 'rule' || !c.gate || up / assets.length >= c.gate }
  }
  let pick = fixed, current = startI, topAt: number | null = null, lastTop: { k: string; mom: number }[] | null = null, invested = 0, pending: Buy | Sell | null = null
  const price = (key: string) => prices.get(key)![current], eq: CatalogueEquity[] = [], events: CatalogueDecision[] = []
  for (let i = startI; i <= endI; i++) {
    current = i
    if (pending && data.isOpen(pending.k, i)) {
      const e = pending.ev; delete e._pend; e.xi = i
      if (pending.t === 'buy') {
        const p = ledger.buy(pending.k, price(pending.k), ledger.cash, i, 1)
        if (p) Object.assign(e, { tid: p.id, px: price(pending.k), units: p.units, cost: p.cost, fee: p.fee })
        else e._drop = 1
      } else {
        const t = ledger.sell(pending.p, price(pending.p.k), i, pending.why)
        Object.assign(e, { tid: t.id, px: t.xp, units: t.units, got: t.got, fee: t.fee, chg: (t.xp / pending.p.ep - 1) * 100, pnl: t.pnl * 100 })
      }
      pending = null
    }
    const p = ledger.pos[0] ?? null
    if (c.kind === 'mix' && !p && !pending && (i - startI) % every === 0) {
      const rows = assets.map(k => { const px = prices.get(k)!; return { k, mom: px[i] / px[i - c.look] - 1, above: px[i] > sma(px, 60, i) } }).filter(r => r.above).sort((a, b) => b.mom - a.mom)
      topAt = i; lastTop = rows.slice(0, 3).map(r => ({ k: r.k, mom: r.mom * 100 }))
      if (!rows.length) { if (pick !== null) events.push({ i, t: 'unpick' }); pick = null }
      else if (pick !== rows[0].k) { pick = rows[0].k; events.push({ i, t: 'pick', a: pick, mom: rows[0].mom * 100, top: lastTop }) }
    }
    if (!p && !pending && pick !== null && data.isOpen(pick, i)) {
      const q = condition(prices.get(pick)!, i)
      if (q.rsiOk && q.bounceOk && q.trendOk && q.fngOk) {
        if (!q.mktOk) events.push({ i, t: 'veto', a: pick, up: q.up, of: assets.length, rsi: q.rsi, bounce: q.bounce })
        else {
          const ev: CatalogueDecision = { i, t: 'enter', a: pick, rsi: q.rsi, bounce: q.bounce, fng: q.fng, up: q.up, of: assets.length, _pend: 1 }
          events.push(ev); pending = { t: 'buy', k: pick, w: 1, ev }
        }
      }
    } else if (p && !pending && i > p.ei && data.isOpen(p.k, i)) {
      const chg = (price(p.k) / p.ep - 1) * 100, why = chg <= c.sl ? 'sl' : c.tp !== null && chg >= c.tp ? 'tp' : i - p.ei >= 25 ? 'time' : null
      if (why) {
        const ev: CatalogueDecision = { i, t: 'exit', a: p.k, why, _pend: 1 }
        events.push(ev); pending = { t: 'sell', k: p.k, p, why, ev }
      }
    }
    const value = ledger.value(price); eq.push({ i, v: value }); invested += (value - ledger.cash) / value
  }
  current = endI
  const p = ledger.pos[0] ?? null
  return {
    ...catalogueStats(eq, ledger, { startI, endI, sl: c.sl, tp: c.tp, rsiTh: c.rsiTh }, invested, i => data.date(i)),
    events: events.filter(e => !e._pend && !e._drop),
    state: {
      asOf: endI, pick, top: lastTop, topAt,
      open: p ? { k: p.k, tid: p.id, entry: p.ei, ep: p.ep, units: p.units, cost: p.cost, px: price(p.k), chg: (price(p.k) / p.ep - 1) * 100, held: endI - p.ei } : null,
      cond: pick !== null ? condition(prices.get(pick)!, endI) : null,
      lastEval: startI + Math.floor((endI - startI) / every) * every, nextEval: startI + (Math.floor((endI - startI) / every) + 1) * every,
    },
  }
}

export function runCatalogueSpotPreview(config: Readonly<CatalogueSpotStrategy>, data: CatalogueMarketData, requestedStart?: number) {
  const checked = readCatalogueStrategy(config)
  if (checked.fut) throw Error('catalogue spot: futures not accepted')
  if (requestedStart !== undefined && (!Number.isSafeInteger(requestedStart) || requestedStart < 0)) throw Error('catalogue spot: invalid start')
  const start = requestedStart ?? checked.startI
  const startI = Math.max(61, checked.kind === 'rule' ? 0 : checked.look + 1, start)
  if (startI >= data.length || (checked.kind !== 'rule' && checked.look >= data.length - 1)) throw Error('catalogue spot: insufficient range')
  return checked.kind === 'agent' ? runAgent(checked, data, startI) : runHybrid(checked, data, startI)
}
export type CatalogueSpotResult = ReturnType<typeof runCatalogueSpotPreview>
