// AI 트레이딩이 쓰는 규칙 엔진의 창구. 가격, 지표, 점수는 본 판의 계산 엔진(core/bt, 원본 글자 그대로)을 쓰고,
// 여기에는 이 조각만 쓰는 것(규칙형 백테스트 runBacktestCore, 봇 판단 기록 tfBotLogEvents, 날짜 글자)과 타입만 둔다.
// 엔진의 주인은 전략 복사 조각(core/engine)이다. 그쪽이 들어오면 아래 import 만 바꾼다.
import * as Gen from '../bt/engine.gen';
import { idxToDate, mkPx, PRICE0, rsi } from '../bt/engine';
import { tfScore as btScore } from '../bt/tf';
import type { RunResult } from '../bt/engine';
import type { RuleP } from './state';

export { idxToDate, mkPx, PRICE0, rsi };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const E = Gen as unknown as Record<string, any>;
/** sma(arr,n,i) */
export const sma: (arr: number[], n: number, i: number) => number | null = E.sma;

/** fmtDate(d) */
export const fmtDate = (d: Date) => d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0');

export type BtTrade = { entry: number; exit: number; pnl: number; kind: string; lowVol?: boolean };
export type BtParams = RuleP & { feeRate?: number | null; entryDelay?: number; fill?: string; purpose?: string };
export type BtResult = {
  params: BtParams; trades: BtTrade[]; eq: { i: number; v: number }[]; ret: number; mdd: number; winRate: number; n: number; pf: number;
  byYear: Record<string, { prod: number; pnl: number; n: number; w: number }>; worstYear: string | null; bestYear: string | null; worstYearPnl: number; bestYearPnl: number;
  mddStartI: number; mddEndI: number; underwaterDays: number; cagr: number; sharpe: number; sortino: number; calmar: number; exposure: number; tradeVol: number; avgHold: number;
  lossCount: number; lowVolLosses: number; lowVolLossShare: number; costImpact: number;
};

/** runBacktest(params): 원본은 전역 PRICE 를 잠깐 바꿔 끼운다(mkWithPx). 여기서는 가격 배열을 넘긴다.
    본 판의 생성 엔진(engine.gen.ts)의 runBacktest 는 원본 전역 S 를 건드려(S.btCount) 앱에서 부를 수 없어 이 TS 판을 쓴다 */
export function runBacktest(params: BtParams): BtResult {
  return runBacktestCore(params, mkPx(params && params.px));
}
/** runBacktestCore(params) */
export function runBacktestCore(params: BtParams, PRICE: number[]): BtResult {
  const sl = params.sl / 100;
  const tp = params.tp != null ? params.tp / 100 : null;
  const rsiTh = params.rsiTh;
  const trendFilter = params.trendFilter;
  const startI = params.startI != null ? params.startI : 61;
  const endI = params.endI != null ? params.endI : PRICE.length - 1;
  const fee = params.feeRate != null ? params.feeRate : 0.002;
  const dly = params.entryDelay || 0;
  const trades: BtTrade[] = [];
  const eq = [{ i: startI, v: 1 }];
  let equity = 1;
  let inPos = false;
  let entryI = 0;
  let entryP = 0;
  for (let i = startI; i <= endI; i++) {
    const s20 = sma(PRICE, 20, i);
    const s60 = sma(PRICE, 60, i);
    if (!inPos) {
      const wasLow = rsi(PRICE, i - 1) < rsiTh;
      const bounce = PRICE[i] > PRICE[i - 1] * 1.005;
      const trendOk = !trendFilter || Math.abs((s20 as number) - (s60 as number)) / PRICE[i] > 0.03;
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
        exitPnl = params.fill === 'close' ? chg : sl;
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
      } else eq.push({ i, v: equity * (1 + chg) });
    }
  }
  /* 관측 종료 시점의 미청산 포지션도 평가에 반영 */
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
  const byYear: BtResult['byYear'] = {};
  trades.forEach((t) => {
    const y = idxToDate(t.exit).getFullYear();
    if (!byYear[y]) byYear[y] = { prod: 1, pnl: 0, n: 0, w: 0 };
    byYear[y].prod *= 1 + t.pnl;
    byYear[y].n++;
    if (t.pnl > 0) byYear[y].w++;
  });
  Object.keys(byYear).forEach((y) => {
    byYear[y].pnl = byYear[y].prod - 1;
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
    params, trades, eq,
    ret: (equity - 1) * 100, mdd: mdd * 100,
    winRate: n ? (wins.length / n) * 100 : 0,
    n, pf: gl > 0 ? gw / gl : gw > 0 ? 9.9 : 0,
    byYear, worstYear: wy, bestYear: by,
    worstYearPnl: wy ? byYear[wy].pnl * 100 : 0,
    bestYearPnl: by ? byYear[by].pnl * 100 : 0,
    mddStartI, mddEndI, underwaterDays: underMax,
    cagr, sharpe, sortino,
    calmar: mdd < 0 ? cagr / Math.abs(mdd * 100) : 0,
    exposure: (expoDays / Math.max(endI - startI, 1)) * 100, tradeVol: sd * 100,
    avgHold: n ? expoDays / n : 0,
    lossCount: losses.length, lowVolLosses,
    lowVolLossShare: losses.length ? (lowVolLosses / losses.length) * 100 : 0,
    costImpact: (eqNoFee - equity) * 100,
  };
}

/** tfScore(res) */
export const tfScore = (res: { winRate: number; cagr: number; mdd: number; tradeVol: number; n: number }): number => btScore(res as unknown as RunResult);

export type LogEv = { k: 'entry' | 'watch' | 'exit-sl' | 'exit-tp' | 'exit-time' | 'risk'; tag: string; i: number; txt: string; entryI?: number };
/** tfBotLogEvents(p): 봉마다 규칙이 내린 판단. 원본은 mkWithPx 안에서 부른다 */
export function tfBotLogEvents(p: RuleP, PRICE: number[] = mkPx(p.px)) {
  const startI = p.startI != null ? p.startI : 61;
  const endI = p.endI != null ? p.endI : PRICE.length - 1;
  const sl = p.sl / 100;
  const tp = p.tp != null ? p.tp / 100 : null;
  const evs: LogEv[] = [];
  let inPos = false;
  let entryI = 0;
  let entryP = 0;
  const cnt = { watch: 0, entry: 0, exit: 0, risk: 0 };
  for (let i = startI; i <= endI; i++) {
    const s20 = sma(PRICE, 20, i) as number;
    const s60 = sma(PRICE, 60, i) as number;
    let ev: LogEv;
    if (!inPos) {
      const rp = rsi(PRICE, i - 1);
      const wasLow = rp < p.rsiTh;
      const bounce = PRICE[i] > PRICE[i - 1] * 1.005;
      const trendOk = !p.trendFilter || Math.abs(s20 - s60) / PRICE[i] > 0.03;
      if (wasLow && bounce && trendOk) {
        inPos = true;
        entryI = i;
        entryP = PRICE[i];
        cnt.entry++;
        ev = { k: 'entry', tag: '진입', i, txt: '진입 조건 충족: 전봉 RSI ' + rp.toFixed(1) + ' < 임계 ' + p.rsiTh + ', 반등 +' + ((PRICE[i] / PRICE[i - 1] - 1) * 100).toFixed(2) + '%' + (p.trendFilter ? ', 추세 필터 통과' : '') };
      } else {
        cnt.watch++;
        const why = !wasLow ? '전봉 RSI ' + rp.toFixed(1) + ' ≥ 임계 ' + p.rsiTh : !bounce ? '반등 미확인 (' + ((PRICE[i] / PRICE[i - 1] - 1) * 100).toFixed(2) + '% < +0.50%)' : '추세 필터 미충족 (이평 괴리 부족)';
        ev = { k: 'watch', tag: '관망', i, txt: '조건 미충족: ' + why };
      }
    } else if (i > entryI) {
      const chg = PRICE[i] / entryP - 1;
      if (chg <= sl) {
        inPos = false;
        cnt.exit++;
        ev = { k: 'exit-sl', tag: '손절', i, txt: '손절선 ' + p.sl + '% 도달, 규칙대로 청산' };
      } else if (tp != null && chg >= tp) {
        inPos = false;
        cnt.exit++;
        ev = { k: 'exit-tp', tag: '익절', i, txt: '익절 목표 +' + p.tp + '% 도달, 규칙대로 청산' };
      } else if (i - entryI >= 25) {
        inPos = false;
        cnt.exit++;
        ev = { k: 'exit-time', tag: '기간 청산', i, txt: '보유 25봉 경과, 기간 청산 규칙 실행 (' + (chg >= 0 ? '+' : '') + (chg * 100).toFixed(1) + '%)' };
      } else {
        cnt.risk++;
        ev = { k: 'risk', tag: '보유 리스크', i, txt: '보유 중, 현재 ' + (chg >= 0 ? '+' : '') + (chg * 100).toFixed(1) + '%, 손절 규칙 ' + p.sl + '%' + (tp != null ? ', 익절 +' + p.tp + '%' : '') + ' 대기' };
      }
    } else {
      cnt.risk++;
      ev = { k: 'risk', tag: '보유 리스크', i, txt: '진입 체결 확인, 청산 규칙 감시 시작' };
    }
    evs.push(ev);
  }
  const li = endI;
  const lr = rsi(PRICE, li);
  const ls20 = sma(PRICE, 20, li) as number;
  const ls60 = sma(PRICE, 60, li) as number;
  return { evs, cnt, bars: endI - startI + 1, last: { rsi: lr, trendOk: !p.trendFilter || Math.abs(ls20 - ls60) / PRICE[li] > 0.03, inPos } };
}
