/** Normalized source-preview accounting. Never an execution ledger/SDK model. */
export const catalogueSpotFee = 0.001
export type CataloguePosition = { id: number; k: string; units: number; ei: number; ep: number; cost: number; fee: number; hi: number; w?: number }
export type CatalogueTrade = {
  id: number; entry: number; exit: number; asset: string; ep: number; xp: number
  units: number; cost: number; got: number; fee: number; pnl: number; kind: string; w?: number
  fut?: 1; side?: number; lev?: number; fund?: number
}
export type CatalogueEquity = { i: number; v: number }
export type CatalogueDecision = {
  i: number; t: 'enter' | 'exit' | 'pick' | 'unpick' | 'hold' | 'skip' | 'veto'; a?: string; why?: string
  xi?: number; tid?: number; px?: number; units?: number; got?: number; cost?: number; fee?: number; pnl?: number
  mom?: number; w?: number; rank?: number; skip?: { k: string; why: string }[]; cut?: boolean
  up?: number | null; of?: number | null; top?: { k: string; mom: number; above?: boolean }[]; held?: string[]
  rsi?: number; bounce?: number; fng?: number | null; chg?: number
  side?: number; lev?: number; ref?: number | null; n?: number; ep?: number; chg1?: number; fund?: number; liq?: number; reg?: number
  bot?: { k: string; mom: number }[]
  _pend?: 1; _drop?: 1
}

export function catalogueSpotLedger() {
  const ledger = {
    cash: 1, pos: [] as CataloguePosition[], trades: [] as CatalogueTrade[], fees: 0, seq: 0,
    value(price: (asset: string) => number) { let v = ledger.cash; for (const p of ledger.pos) v += p.units * price(p.k); return v },
    buy(asset: string, price: number, amount: number, index: number, weight?: number) {
      if (!(price > 0) || !Number.isFinite(price) || !Number.isFinite(amount)) throw Error('catalogue ledger: bad fill')
      amount = Math.min(amount, ledger.cash)
      if (amount <= 1e-9) return null
      const units = amount / (price * (1 + catalogueSpotFee)), fee = units * price * catalogueSpotFee
      ledger.cash -= amount; ledger.fees += fee
      const p: CataloguePosition = { id: ++ledger.seq, k: asset, units, ei: index, ep: price, cost: amount, fee, hi: price, w: weight }
      ledger.pos.push(p)
      return p
    },
    sell(p: CataloguePosition, price: number, index: number, reason: string) {
      if (!ledger.pos.includes(p)) throw Error('catalogue ledger: not held')
      if (!(price > 0) || !Number.isFinite(price)) throw Error('catalogue ledger: bad fill')
      const gross = p.units * price, fee = gross * catalogueSpotFee, got = gross - fee
      ledger.cash += got; ledger.fees += fee; ledger.pos = ledger.pos.filter(x => x !== p)
      const trade: CatalogueTrade = { id: p.id, entry: p.ei, exit: index, asset: p.k, ep: p.ep, xp: price, units: p.units, cost: p.cost, got, fee: p.fee + fee, pnl: got / p.cost - 1, kind: reason, w: p.w }
      ledger.trades.push(trade)
      return trade
    },
  }
  return ledger
}

export function catalogueStats(eq: CatalogueEquity[], ledger: { trades: CatalogueTrade[]; fees: number }, params: { startI: number; endI: number; sl?: number; tp?: number | null; rsiTh?: number }, invested: number, date: (index: number) => Date) {
  const { startI, endI } = params, trades = ledger.trades, equity = eq.length ? eq[eq.length - 1].v : 1
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl <= 0)
  const gw = wins.reduce((a, t) => a + (t.got - t.cost), 0), gl = losses.reduce((a, t) => a + (t.cost - t.got), 0)
  let peak = 1, peakI = startI, mdd = 0, mddStartI = startI, mddEndI = startI, curStart = startI, underMax = 0
  for (const e of eq) {
    if (e.v >= peak) { underMax = Math.max(underMax, e.i - curStart); peak = e.v; curStart = e.i; peakI = e.i }
    const dd = e.v / peak - 1
    if (dd < mdd) { mdd = dd; mddStartI = peakI; mddEndI = e.i }
  }
  underMax = Math.max(underMax, endI - curStart)
  const byYear: Record<string, { base: number; n: number; w: number; pnl: number }> = {}
  let prev = 1
  eq.forEach((e, j) => {
    const y = date(e.i).getUTCFullYear(), next = eq[j + 1]
    byYear[y] ??= { base: prev, n: 0, w: 0, pnl: 0 }
    if (!next || date(next.i).getUTCFullYear() !== y) { byYear[y].pnl = e.v / byYear[y].base - 1; prev = e.v }
  })
  for (const t of trades) { const year = byYear[date(t.exit).getUTCFullYear()]; if (year) { year.n++; if (t.pnl > 0) year.w++ } }
  let worstYear: string | null = null, bestYear: string | null = null
  for (const y of Object.keys(byYear)) {
    if (worstYear === null || byYear[y].pnl < byYear[worstYear].pnl) worstYear = y
    if (bestYear === null || byYear[y].pnl > byYear[bestYear].pnl) bestYear = y
  }
  const years = Math.max((endI - startI) / 365, 0.2), n = trades.length, mean = n ? trades.reduce((a, t) => a + t.pnl, 0) / n : 0
  const sd = n > 1 ? Math.sqrt(trades.reduce((a, t) => a + Math.pow(t.pnl - mean, 2), 0) / (n - 1)) : 0
  const cagr = (Math.pow(Math.max(equity, 0.01), 1 / years) - 1) * 100
  return {
    params, trades, eq, ret: (equity - 1) * 100, mdd: mdd * 100, winRate: n ? wins.length / n * 100 : 0, n, pf: gl > 0 ? gw / gl : gw > 0 ? 9.9 : 0,
    byYear, worstYear, bestYear, worstYearPnl: worstYear ? byYear[worstYear].pnl * 100 : 0, bestYearPnl: bestYear ? byYear[bestYear].pnl * 100 : 0,
    mddStartI, mddEndI, underwaterDays: underMax, cagr, sharpe: sd > 0 ? mean / sd * Math.sqrt(n / years) : 0, calmar: mdd < 0 ? cagr / Math.abs(mdd * 100) : 0,
    exposure: invested / Math.max(endI - startI + 1, 1) * 100, tradeVol: sd * 100,
    avgHold: n ? trades.reduce((a, t) => a + (t.exit - t.entry), 0) / n : 0, lossCount: losses.length, costImpact: ledger.fees * 100,
    // Source hardcodes these to 0 without computing them. Null prevents a UI
    // consumer from claiming a calculated zero. Do not synthesize the metric.
    sortino: null, lowVolLosses: null, lowVolLossShare: null,
  }
}
