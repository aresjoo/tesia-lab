// 규칙 백테스트 (원본 runBacktest, runBacktestCore).
// RSI 가 기준 아래였다가 반등한 날 사고, 손절과 익절, 25일 기한으로 판다.
import { idxToDate, mkPx } from './data';
import { rsi, sma } from './indicators';
import type { BtParams, EqPt, RunResult, Trade, YearStat } from './types';

/** runBacktest(params): params.px 로 자산 가격을 고른다 */
export function runBacktest(params: BtParams): RunResult {
  return runBacktestCore(params, mkPx(params && params.px));
}

/** runBacktestCore(params). 원본은 전역 PRICE 를 바꿔 끼우고, 여기서는 가격 배열을 받는다 */
export function runBacktestCore(params: BtParams, PRICE: number[]): RunResult {
  const sl = params.sl / 100;
  const tp = params.tp != null ? params.tp / 100 : null;
  const rsiTh = params.rsiTh;
  const trendFilter = params.trendFilter;
  const startI = params.startI != null ? params.startI : 61;
  const endI = params.endI != null ? params.endI : PRICE.length - 1;
  const fee = params.feeRate != null ? params.feeRate : 0.002;
  const dly = params.entryDelay || 0;
  const trades: Trade[] = [];
  const eq: EqPt[] = [{ i: startI, v: 1 }];
  let equity = 1;
  let inPos = false;
  let entryI = 0;
  let entryP = 0;
  for (let i = startI; i <= endI; i++) {
    const s20 = sma(PRICE, 20, i) as number;
    const s60 = sma(PRICE, 60, i) as number;
    if (!inPos) {
      const wasLow = rsi(PRICE, i - 1) < rsiTh;
      const bounce = PRICE[i] > PRICE[i - 1] * 1.005;
      const trendOk = !trendFilter || Math.abs(s20 - s60) / PRICE[i] > 0.03;
      if (wasLow && bounce && trendOk && i + dly <= endI) {
        inPos = true;
        entryI = i + dly;
        entryP = PRICE[i + dly];
      }
    } else if (i > entryI) {
      const chg = PRICE[i] / entryP - 1;
      let exit: string | null = null;
      let exitPnl = 0;
      if (chg <= sl) {
        exit = 'sl';
        exitPnl = params.fill === 'close' ? chg : sl; /* fill:'close' 는 조건에 닿은 날의 종가로 체결 */
      } else if (tp != null && chg >= tp) {
        exit = 'tp';
        exitPnl = params.fill === 'close' ? chg : tp;
      } else if (i - entryI >= 25) {
        exit = 'time';
        exitPnl = chg;
      }
      if (exit) {
        equity *= 1 + exitPnl - fee;
        trades.push({ entry: entryI, exit: i, pnl: exitPnl - fee, kind: exit });
        eq.push({ i, v: equity });
        inPos = false;
      } else eq.push({ i, v: equity * (1 + chg) }); /* 보유 중 평가액 */
    }
  }
  /* 관측이 끝날 때 들고 있던 포지션도 평가에 넣는다 */
  if (inPos && endI > entryI) {
    const openPnl = PRICE[endI] / entryP - 1;
    equity *= 1 + openPnl;
    eq.push({ i: endI, v: equity });
  }
  trades.forEach((t) => {
    const a = sma(PRICE, 20, t.entry) as number;
    const b = sma(PRICE, 60, t.entry) as number;
    t.lowVol = Math.abs(a - b) / PRICE[t.entry] < 0.03;
  });
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const gw = wins.reduce((a, t) => a + t.pnl, 0);
  const gl = losses.reduce((a, t) => a - t.pnl, 0);
  /* 최대 낙폭과 가장 긴 회복 기간 */
  let peak = 1;
  let peakI = startI;
  let mdd = 0;
  let mddStartI = startI;
  let mddEndI = startI;
  let curStart = startI;
  let underMax = 0;
  eq.forEach((e) => {
    if (e.v >= peak) {
      const dur = e.i - curStart;
      if (dur > underMax) underMax = dur;
      peak = e.v;
      curStart = e.i;
      peakI = e.i;
    }
    const dd = e.v / peak - 1;
    if (dd < mdd) {
      mdd = dd;
      mddStartI = peakI;
      mddEndI = e.i;
    }
  });
  const tailDur = endI - curStart;
  if (tailDur > underMax) underMax = tailDur;
  /* 연도별 */
  const byYear: Record<string, YearStat> = {};
  trades.forEach((t) => {
    const y = idxToDate(t.exit).getFullYear();
    if (!byYear[y]) byYear[y] = { prod: 1, pnl: 0, n: 0, w: 0 };
    byYear[y].prod = (byYear[y].prod as number) * (1 + t.pnl);
    byYear[y].n++;
    if (t.pnl > 0) byYear[y].w++;
  });
  Object.keys(byYear).forEach((y) => {
    byYear[y].pnl = (byYear[y].prod as number) - 1;
  });
  let worstYear: string | null = null;
  let bestYear: string | null = null;
  Object.keys(byYear).forEach((y) => {
    if (worstYear === null || byYear[y].pnl < byYear[worstYear].pnl) worstYear = y;
    if (bestYear === null || byYear[y].pnl > byYear[bestYear].pnl) bestYear = y;
  });
  const years = Math.max((endI - startI) / 365, 0.2);
  const n = trades.length;
  const mean = n ? trades.reduce((a, t) => a + t.pnl, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(trades.reduce((a, t) => a + Math.pow(t.pnl - mean, 2), 0) / (n - 1)) : 0;
  const dSd = losses.length > 1 ? Math.sqrt(losses.reduce((a, t) => a + t.pnl * t.pnl, 0) / losses.length) : Math.abs(sl);
  const cagr = (Math.pow(equity, 1 / years) - 1) * 100;
  const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(n / years) : 0;
  const sortino = dSd > 0 ? (mean / dSd) * Math.sqrt(n / years) : 0;
  const expoDays = trades.reduce((a, t) => a + (t.exit - t.entry), 0);
  const lowVolLosses = losses.filter((t) => t.lowVol).length;
  const eqNoFee = trades.reduce((a, t) => a * (1 + t.pnl + fee), 1);
  const wy = worstYear as string | null;
  const by = bestYear as string | null;
  return {
    params,
    trades,
    eq,
    ret: (equity - 1) * 100,
    mdd: mdd * 100,
    winRate: n ? (wins.length / n) * 100 : 0,
    n,
    pf: gl > 0 ? gw / gl : gw > 0 ? 9.9 : 0,
    byYear,
    worstYear: wy,
    bestYear: by,
    worstYearPnl: wy ? byYear[wy].pnl * 100 : 0,
    bestYearPnl: by ? byYear[by].pnl * 100 : 0,
    mddStartI,
    mddEndI,
    underwaterDays: underMax,
    cagr,
    sharpe,
    sortino,
    calmar: mdd < 0 ? cagr / Math.abs(mdd * 100) : 0,
    exposure: (expoDays / Math.max(endI - startI, 1)) * 100,
    tradeVol: sd * 100,
    avgHold: n ? expoDays / n : 0,
    lossCount: losses.length,
    lowVolLosses,
    lowVolLossShare: losses.length ? (lowVolLosses / losses.length) * 100 : 0,
    costImpact: (eqNoFee - equity) * 100,
  };
}
