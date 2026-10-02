/**
 * Client source preview ONLY — aresjoo/tesia-lab 9bf4427, index.html.
 * PRICE, runBacktest, tfTmP, tfTmCalc and tfBotLogEvents are reproduced here.
 * These synthetic daily closes are shared by ALL preview symbols. They are not
 * OHLC, exchange fills, account balances or an implementation of our service API.
 * No network, storage, wall-clock freshness or order authority belongs here.
 */
export type SourceTerminalParameters = {
  sl: number
  tp: number | null
  rsiTh: number
  trendFilter: boolean
  startI?: number | null
  endI?: number | null
}
export type NormalizedSourceTerminalParameters = SourceTerminalParameters & { startI: number; endI: number }
export type SourceTerminalSeed = {
  id: string; name: string; exchangeId: string; asset: string; symbol: string
  market: string; version: string; status: 'live' | 'off' | 'ready' | 'err'
  capital: number; parameters: SourceTerminalParameters; error?: string
}
export type SourceTerminalTrade = { entry: number; exit: number; pnl: number; kind: 'sl' | 'tp' | 'time'; lowVol: boolean }
export type SourceTerminalEvent = {
  k: 'entry' | 'watch' | 'risk' | 'exit-sl' | 'exit-tp' | 'exit-time'
  tag: string; i: number; txt: string
}
type SourceYear = { prod: number; pnl: number; n: number; w: number }

export const sourceTerminalSeeds: readonly Readonly<SourceTerminalSeed>[] = Object.freeze([
  { id: 'd1', name: 'BTC 돌파 추종', exchangeId: 'binance', asset: '비트코인', symbol: 'BTC/USDT', market: '현물', capital: 14000000, version: 'v3.4', status: 'live', parameters: { sl: -5, tp: 10, rsiTh: 40, trendFilter: true, startI: 61, endI: null } },
  { id: 'd2', name: 'ETH 추세 추종', exchangeId: 'okx', asset: '이더리움', symbol: 'ETH/USDT', market: '현물', capital: 7000000, version: 'v2.1', status: 'off', parameters: { sl: -5, tp: 8, rsiTh: 46, trendFilter: true, startI: -730, endI: null } },
  { id: 'd3', name: 'SOL 되돌림', exchangeId: 'woox', asset: '솔라나', symbol: 'SOL/USDT', market: '현물', capital: 4000000, version: 'v1.3', status: 'live', parameters: { sl: -3, tp: 8, rsiTh: 38, trendFilter: false, startI: -365, endI: null } },
  { id: 'd4', name: 'BTC 평균회귀', exchangeId: 'okx', asset: '비트코인', symbol: 'BTC/USDT', market: '현물', capital: 28000000, version: 'v5.0', status: 'live', parameters: { sl: -8, tp: 10, rsiTh: 40, trendFilter: true, startI: 61, endI: null } },
  { id: 'd5', name: 'ARB 모멘텀', exchangeId: 'binance', asset: '아비트럼', symbol: 'ARB/USDT', market: '현물', capital: 7000000, version: 'v1.0', status: 'ready', parameters: { sl: -3, tp: 10, rsiTh: 38, trendFilter: false, startI: -365, endI: null } },
  { id: 'd6', name: 'LINK 분할 매집', exchangeId: 'woox', asset: '체인링크', symbol: 'LINK/USDT', market: '현물', capital: 7000000, version: 'v2.2', status: 'err', error: '거래소 API 응답 없음. 마지막 동기화 이후 주문이 전송되지 않았어요', parameters: { sl: -8, tp: 10, rsiTh: 46, trendFilter: false, startI: -548, endI: null } },
].map(seed => Object.freeze({ ...seed, parameters: Object.freeze(seed.parameters) })) as SourceTerminalSeed[])

function mulberry32(a: number) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
export const sourceTerminalPrices: readonly number[] = Object.freeze((() => {
  const rng = mulberry32(3), prices = [16500]
  const regimes = [[0, 365, .0016], [365, 660, .00003], [660, 1050, .0013], [1050, 1335, .0004]]
  for (let i = 1; i < 1335; i++) {
    let drift = .0005
    for (const regime of regimes) if (i >= regime[0] && i < regime[1]) drift = regime[2]
    const shock = (rng() - .5) * .036
    prices.push(Math.max(9000, prices[i - 1] * (1 + drift + shock)))
  }
  return prices
})())

export function sourceTerminalSma(i: number, n: number): number | null {
  if (i < n - 1) return null
  let sum = 0
  for (let k = i - n + 1; k <= i; k++) sum += sourceTerminalPrices[k]
  return sum / n
}
export function sourceTerminalRsi(i: number): number {
  const n = 14
  if (i < n) return 50
  let g = 0, l = 0
  for (let k = i - n + 1; k <= i; k++) {
    const d = sourceTerminalPrices[k] - sourceTerminalPrices[k - 1]
    if (d > 0) g += d
    else l -= d
  }
  if (l === 0) return 100
  return 100 - 100 / (1 + (g / n) / (l / n))
}
/** Same local calendar convention as the client, never a live timestamp. */
export function sourceTerminalDate(i: number): Date {
  const date = new Date(2023, 0, 2)
  date.setDate(date.getDate() + i)
  return date
}
export function normalizeSourceTerminalParameters(p: SourceTerminalParameters): NormalizedSourceTerminalParameters {
  const end = sourceTerminalPrices.length - 1
  return { sl: p.sl, tp: p.tp != null ? p.tp : null, rsiTh: p.rsiTh, trendFilter: !!p.trendFilter,
    startI: p.startI == null ? 61 : p.startI < 0 ? Math.max(61, end + p.startI) : p.startI,
    endI: p.endI != null ? p.endI : end }
}

function runSourceBacktest(params: NormalizedSourceTerminalParameters) {
  const PRICE = sourceTerminalPrices
  const sl = params.sl / 100, tp = params.tp != null ? params.tp / 100 : null
  const { rsiTh, trendFilter, startI, endI } = params
  const fee = .002
  const trades: SourceTerminalTrade[] = [], eq = [{ i: startI, v: 1 }]
  let equity = 1, inPos = false, entryI = 0, entryP = 0
  for (let i = startI; i <= endI; i++) {
    const s20 = sourceTerminalSma(i, 20) ?? 0, s60 = sourceTerminalSma(i, 60) ?? 0
    if (!inPos) {
      const wasLow = sourceTerminalRsi(i - 1) < rsiTh
      const bounce = PRICE[i] > PRICE[i - 1] * 1.005
      const trendOk = !trendFilter || Math.abs(s20 - s60) / PRICE[i] > .03
      if (wasLow && bounce && trendOk) { inPos = true; entryI = i; entryP = PRICE[i] }
    } else if (i > entryI) {
      const chg = PRICE[i] / entryP - 1
      let exit: SourceTerminalTrade['kind'] | null = null, exitPnl = 0
      if (chg <= sl) { exit = 'sl'; exitPnl = sl }
      else if (tp != null && chg >= tp) { exit = 'tp'; exitPnl = tp }
      else if (i - entryI >= 25) { exit = 'time'; exitPnl = chg }
      if (exit) {
        equity *= 1 + exitPnl - fee
        trades.push({ entry: entryI, exit: i, pnl: exitPnl - fee, kind: exit, lowVol: false })
        eq.push({ i, v: equity }); inPos = false
      } else eq.push({ i, v: equity * (1 + chg) })
    }
  }
  if (inPos && endI > entryI) { equity *= 1 + (PRICE[endI] / entryP - 1); eq.push({ i: endI, v: equity }) }
  trades.forEach(t => { t.lowVol = Math.abs((sourceTerminalSma(t.entry, 20) ?? 0) - (sourceTerminalSma(t.entry, 60) ?? 0)) / PRICE[t.entry] < .03 })
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl <= 0)
  const gw = wins.reduce((a, t) => a + t.pnl, 0), gl = losses.reduce((a, t) => a - t.pnl, 0)
  let peak = 1, peakI = startI, mdd = 0, mddStartI = startI, mddEndI = startI, curStart = startI, underMax = 0
  eq.forEach(e => {
    if (e.v >= peak) { const dur = e.i - curStart; if (dur > underMax) underMax = dur; peak = e.v; curStart = e.i; peakI = e.i }
    const dd = e.v / peak - 1
    if (dd < mdd) { mdd = dd; mddStartI = peakI; mddEndI = e.i }
  })
  const tailDur = endI - curStart
  if (tailDur > underMax) underMax = tailDur
  const byYear: Record<string, SourceYear> = {}
  trades.forEach(t => {
    const y = sourceTerminalDate(t.exit).getFullYear()
    if (!byYear[y]) byYear[y] = { prod: 1, pnl: 0, n: 0, w: 0 }
    byYear[y].prod *= 1 + t.pnl; byYear[y].n++; if (t.pnl > 0) byYear[y].w++
  })
  Object.keys(byYear).forEach(y => { byYear[y].pnl = byYear[y].prod - 1 })
  let worstYear: string | null = null, bestYear: string | null = null
  Object.keys(byYear).forEach(y => {
    if (worstYear === null || byYear[y].pnl < byYear[worstYear].pnl) worstYear = y
    if (bestYear === null || byYear[y].pnl > byYear[bestYear].pnl) bestYear = y
  })
  const years = Math.max((endI - startI) / 365, .2), n = trades.length
  const mean = n ? trades.reduce((a, t) => a + t.pnl, 0) / n : 0
  const sd = n > 1 ? Math.sqrt(trades.reduce((a, t) => a + Math.pow(t.pnl - mean, 2), 0) / (n - 1)) : 0
  const dSd = losses.length > 1 ? Math.sqrt(losses.reduce((a, t) => a + t.pnl * t.pnl, 0) / losses.length) : Math.abs(sl)
  const cagr = (Math.pow(equity, 1 / years) - 1) * 100
  const sharpe = sd > 0 ? mean / sd * Math.sqrt(n / years) : 0
  const sortino = dSd > 0 ? mean / dSd * Math.sqrt(n / years) : 0
  const expoDays = trades.reduce((a, t) => a + (t.exit - t.entry), 0)
  const lowVolLosses = losses.filter(t => t.lowVol).length
  const eqNoFee = trades.reduce((a, t) => a * (1 + t.pnl + fee), 1)
  return { params, trades, eq, ret: (equity - 1) * 100, mdd: mdd * 100,
    winRate: n ? wins.length / n * 100 : 0, n, pf: gl > 0 ? gw / gl : gw > 0 ? 9.9 : 0,
    byYear, worstYear, bestYear, worstYearPnl: worstYear ? byYear[worstYear].pnl * 100 : 0,
    bestYearPnl: bestYear ? byYear[bestYear].pnl * 100 : 0,
    mddStartI, mddEndI, underwaterDays: underMax, cagr, sharpe, sortino,
    calmar: mdd < 0 ? cagr / Math.abs(mdd * 100) : 0,
    exposure: expoDays / Math.max(endI - startI, 1) * 100, tradeVol: sd * 100,
    avgHold: n ? expoDays / n : 0, lossCount: losses.length, lowVolLosses,
    lowVolLossShare: losses.length ? lowVolLosses / losses.length * 100 : 0,
    costImpact: (eqNoFee - equity) * 100 }
}

function sourceTerminalEvents(p: NormalizedSourceTerminalParameters) {
  const PRICE = sourceTerminalPrices, { startI, endI } = p
  const sl = p.sl / 100, tp = p.tp != null ? p.tp / 100 : null
  const evs: SourceTerminalEvent[] = [], cnt = { watch: 0, entry: 0, exit: 0, risk: 0 }
  let inPos = false, entryI = 0, entryP = 0
  for (let i = startI; i <= endI; i++) {
    const s20 = sourceTerminalSma(i, 20) ?? 0, s60 = sourceTerminalSma(i, 60) ?? 0
    let ev: SourceTerminalEvent
    if (!inPos) {
      const rp = sourceTerminalRsi(i - 1), wasLow = rp < p.rsiTh, bounce = PRICE[i] > PRICE[i - 1] * 1.005
      const trendOk = !p.trendFilter || Math.abs(s20 - s60) / PRICE[i] > .03
      if (wasLow && bounce && trendOk) {
        inPos = true; entryI = i; entryP = PRICE[i]; cnt.entry++
        ev = { k: 'entry', tag: '진입', i, txt: '진입 조건 충족: 전봉 RSI ' + rp.toFixed(1) + ' < 임계 ' + p.rsiTh + ', 반등 +' + ((PRICE[i] / PRICE[i - 1] - 1) * 100).toFixed(2) + '%' + (p.trendFilter ? ', 추세 필터 통과' : '') }
      } else {
        cnt.watch++
        const why = !wasLow ? '전봉 RSI ' + rp.toFixed(1) + ' ≥ 임계 ' + p.rsiTh
          : !bounce ? '반등 미확인 (' + ((PRICE[i] / PRICE[i - 1] - 1) * 100).toFixed(2) + '% < +0.50%)' : '추세 필터 미충족 (이평 괴리 부족)'
        ev = { k: 'watch', tag: '관망', i, txt: '조건 미충족: ' + why }
      }
    } else if (i > entryI) {
      const chg = PRICE[i] / entryP - 1
      if (chg <= sl) { inPos = false; cnt.exit++; ev = { k: 'exit-sl', tag: '손절', i, txt: '손절선 ' + p.sl + '% 도달, 규칙대로 청산' } }
      else if (tp != null && chg >= tp) { inPos = false; cnt.exit++; ev = { k: 'exit-tp', tag: '익절', i, txt: '익절 목표 +' + p.tp + '% 도달, 규칙대로 청산' } }
      else if (i - entryI >= 25) { inPos = false; cnt.exit++; ev = { k: 'exit-time', tag: '기간 청산', i, txt: '보유 25봉 경과, 기간 청산 규칙 실행 (' + (chg >= 0 ? '+' : '') + (chg * 100).toFixed(1) + '%)' } }
      else { cnt.risk++; ev = { k: 'risk', tag: '보유 리스크', i, txt: '보유 중, 현재 ' + (chg >= 0 ? '+' : '') + (chg * 100).toFixed(1) + '%, 손절 규칙 ' + p.sl + '%' + (tp != null ? ', 익절 +' + p.tp + '%' : '') + ' 대기' } }
    } else { cnt.risk++; ev = { k: 'risk', tag: '보유 리스크', i, txt: '진입 체결 확인, 청산 규칙 감시 시작' } }
    evs.push(ev)
  }
  return { evs, cnt, bars: endI - startI + 1, last: { rsi: sourceTerminalRsi(endI),
    trendOk: !p.trendFilter || Math.abs((sourceTerminalSma(endI, 20) ?? 0) - (sourceTerminalSma(endI, 60) ?? 0)) / PRICE[endI] > .03, inPos } }
}

/** Pure, uncached source-preview evaluator; no shared mutable result objects. */
export function evaluateSourceTerminal(parameters: SourceTerminalParameters, capital: number) {
  const p = normalizeSourceTerminalParameters(parameters)
  // Bound caller input before indexing the finite source fixture; never silently
  // clamp an out-of-range request into a different evaluation window.
  if (!Number.isInteger(p.startI) || !Number.isInteger(p.endI) || p.startI < 61 || p.endI >= sourceTerminalPrices.length || p.endI < p.startI
    || !Number.isFinite(p.sl) || (p.tp !== null && !Number.isFinite(p.tp)) || !Number.isFinite(p.rsiTh)
    || !Number.isFinite(capital) || capital < 0) throw new RangeError('Invalid source terminal preview parameters')
  const r = runSourceBacktest(p), L = sourceTerminalEvents(p)
  let openI: number | null = null
  for (let k = L.evs.length - 1; k >= 0; k--) {
    const event = L.evs[k]
    if (event.k.startsWith('exit')) break
    if (event.k === 'entry') { openI = event.i; break }
  }
  if (!L.last.inPos) openI = null
  let capW = capital, feeEst = 0
  const trades = r.trades.map(tr => {
    feeEst += capW * .002
    const row = { entry: tr.entry, exit: tr.exit, pnl: tr.pnl, kind: tr.kind, krw: capW * tr.pnl, capB: capW }
    capW *= 1 + tr.pnl
    return row
  })
  const nav = capital * (1 + r.ret / 100), realized = capW - capital, unreal = nav - capW
  const ep = openI != null ? sourceTerminalPrices[openI] : 0, cp = sourceTerminalPrices[p.endI]
  const pos = openI != null ? { entryI: openI, entryP: ep, curP: cp, qty: capW / ep, chg: cp / ep - 1, krw: unreal,
    stopP: ep * (1 + p.sl / 100), tpP: p.tp != null ? ep * (1 + p.tp / 100) : null, bars: p.endI - openI } : null
  return { r, L, cap: capital, nav, pnl: nav - capital, pnlPct: r.ret, realized, unreal, feeEst, trades, pos }
}
export type SourceTerminalEvaluation = ReturnType<typeof evaluateSourceTerminal>
