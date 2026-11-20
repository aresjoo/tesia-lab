// 원장: 현금과 포지션, 체결과 비용을 한 곳에서 센다. 세 판단 방식(AI 판단, 차트 규칙, 혼합)이 같은 원장을 쓴다.
import { idxToDate } from './data';
import type { EqPt, RunParams, RunResult, Trade, YearStat } from './types';

/** 현물 수수료 (체결 금액 비율) */
export const MK_FEE = 0.001;
/** 선물 수수료, 미끄러짐, 유지 증거금 비율 */
export const MK_FUT_FEE = 0.00055;
export const MK_FUT_SLIP = 0.0005;
export const MK_FUT_MMR = 0.005;

export type Pos = { id: number; k: string; units: number; ei: number; ep: number; cost: number; fee: number; hi: number; w?: number };
export type Ledger = {
  cash: number;
  pos: Pos[];
  trades: Trade[];
  fees: number;
  seq: number;
  value(px: (k: string) => number): number;
  buy(k: string, price: number, amount: number, i: number, meta?: { w?: number }): Pos | null;
  sell(p: Pos, price: number, i: number, why: string): Trade;
};

/** mkLedger(): 현물 원장. 시작 자산은 1 */
export function mkLedger(): Ledger {
  const L: Ledger = {
    cash: 1,
    pos: [],
    trades: [],
    fees: 0,
    seq: 0,
    value(px) {
      let v = L.cash;
      L.pos.forEach((p) => {
        v += p.units * px(p.k);
      });
      return v;
    },
    buy(k, price, amount, i, meta) {
      if (!(price > 0) || !isFinite(price) || !isFinite(amount)) throw new Error('ledger: bad fill');
      amount = Math.min(amount, L.cash);
      if (amount <= 1e-9) return null;
      const units = amount / (price * (1 + MK_FEE));
      const fee = units * price * MK_FEE;
      L.cash -= amount;
      L.fees += fee;
      const p: Pos = { id: ++L.seq, k, units, ei: i, ep: price, cost: amount, fee, hi: price, w: meta && meta.w };
      L.pos.push(p);
      return p;
    },
    sell(p, price, i, why) {
      if (L.pos.indexOf(p) < 0) throw new Error('ledger: not held');
      if (!(price > 0) || !isFinite(price)) throw new Error('ledger: bad fill');
      const gross = p.units * price;
      const fee = gross * MK_FEE;
      const got = gross - fee;
      L.cash += got;
      L.fees += fee;
      L.pos = L.pos.filter((x) => x !== p);
      const t: Trade = { id: p.id, entry: p.ei, exit: i, asset: p.k, ep: p.ep, xp: price, units: p.units, cost: p.cost, got, fee: p.fee + fee, pnl: got / p.cost - 1, kind: why, w: p.w };
      L.trades.push(t);
      return t;
    },
  };
  return L;
}

export type FutPos = { id: number; k: string; side: number; lev: number; units: number; ep: number; margin: number; cost: number; fee: number; fund: number; ei: number; best: number; w?: number };
export type FutLedger = {
  cash: number;
  pos: FutPos[];
  trades: Trade[];
  fees: number;
  fund: number;
  seq: number;
  liq: number;
  eqOf(p: FutPos, price: number): number;
  value(px: (k: string) => number): number;
  open(k: string, side: number, amount: number, lev: number, price: number, i: number, meta?: { w?: number }): FutPos | null;
  liqPx(p: FutPos): number;
  close(p: FutPos, price: number, i: number, why: string, raw?: boolean): Trade;
};

/** fuLedger(): 선물 원장. 증거금, 펀딩비, 강제 청산을 센다 */
export function fuLedger(): FutLedger {
  const L: FutLedger = {
    cash: 1,
    pos: [],
    trades: [],
    fees: 0,
    fund: 0,
    seq: 0,
    liq: 0,
    eqOf(p, price) {
      return p.margin + p.side * p.units * (price - p.ep) - p.fund;
    },
    value(px) {
      let v = L.cash;
      L.pos.forEach((p) => {
        v += Math.max(0, L.eqOf(p, px(p.k)));
      });
      return v;
    },
    open(k, side, amount, lev, price, i, meta) {
      amount = Math.min(amount, L.cash);
      if (!(amount > 1e-9) || !(price > 0)) return null;
      const fill = price * (1 + side * MK_FUT_SLIP);
      const fee = (amount * lev * MK_FUT_FEE) / (1 + lev * MK_FUT_FEE);
      const margin = amount - fee;
      const units = (margin * lev) / fill;
      L.cash -= amount;
      L.fees += fee;
      const p: FutPos = { id: ++L.seq, k, side, lev, units, ep: fill, margin, cost: amount, fee, fund: 0, ei: i, best: fill, w: meta && meta.w };
      L.pos.push(p);
      return p;
    },
    /* 강제 청산 가격: 증거금에서 손익과 펀딩비를 빼고 남은 돈이 유지 증거금(체결 금액의 0.5%)과 같아지는 가격 */
    liqPx(p) {
      return p.ep - (p.side * (p.margin - p.fund - MK_FUT_MMR * p.units * p.ep)) / p.units;
    },
    close(p, price, i, why, raw) {
      const fill = raw ? price : price * (1 - p.side * MK_FUT_SLIP);
      const fee = p.units * fill * MK_FUT_FEE;
      const got = why === 'liq' ? 0 : Math.max(0, L.eqOf(p, fill) - fee);
      L.cash += got;
      L.fees += fee;
      L.fund += p.fund;
      if (why === 'liq') L.liq++;
      L.pos = L.pos.filter((x) => x !== p);
      const t: Trade = { id: p.id, fut: 1, entry: p.ei, exit: i, asset: p.k, side: p.side, lev: p.lev, ep: p.ep, xp: fill, units: p.side * p.units, cost: p.cost, got, fee: p.fee + fee, fund: p.fund, pnl: got / p.cost - 1, kind: why, w: p.w };
      L.trades.push(t);
      return t;
    },
  };
  return L;
}

/** mkStatsOf(eq,L,params,startI,endI,invested): 자산 곡선과 원장에서 성과 지표를 낸다 */
export function mkStatsOf(eq: EqPt[], L: { trades: Trade[]; fees: number }, params: RunParams, startI: number, endI: number, invested: number): RunResult {
  const trades = L.trades;
  const equity = eq.length ? eq[eq.length - 1].v : 1;
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const gw = wins.reduce((a, t) => a + ((t.got as number) - (t.cost as number)), 0);
  const gl = losses.reduce((a, t) => a + ((t.cost as number) - (t.got as number)), 0);
  let peak = 1;
  let peakI = startI;
  let mdd = 0;
  let mddStartI = startI;
  let mddEndI = startI;
  let curStart = startI;
  let underMax = 0;
  eq.forEach((e) => {
    if (e.v >= peak) {
      const d = e.i - curStart;
      if (d > underMax) underMax = d;
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
  /* 연도별 손익은 자산 곡선에서 구한다(연도를 넘는 보유의 평가 손익 포함) */
  const tail = endI - curStart;
  if (tail > underMax) underMax = tail;
  const byYear: Record<string, YearStat> = {};
  let prev = 1;
  eq.forEach((e, j) => {
    const y = idxToDate(e.i).getFullYear();
    const nx = eq[j + 1];
    if (!byYear[y]) byYear[y] = { base: prev, n: 0, w: 0, pnl: 0 };
    if (!nx || idxToDate(nx.i).getFullYear() !== y) {
      byYear[y].pnl = e.v / (byYear[y].base as number) - 1;
      prev = e.v;
    }
  });
  trades.forEach((t) => {
    const y = idxToDate(t.exit).getFullYear();
    if (byYear[y]) {
      byYear[y].n++;
      if (t.pnl > 0) byYear[y].w++;
    }
  });
  let worstYear: string | null = null;
  let bestYear: string | null = null;
  Object.keys(byYear).forEach((y) => {
    if (worstYear === null || byYear[y].pnl < byYear[worstYear].pnl) worstYear = y;
    if (bestYear === null || byYear[y].pnl > byYear[bestYear].pnl) bestYear = y;
  });
  const wy = worstYear as string | null;
  const by = bestYear as string | null;
  const years = Math.max((endI - startI) / 365, 0.2);
  const n = trades.length;
  const mean = n ? trades.reduce((a, t) => a + t.pnl, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(trades.reduce((a, t) => a + Math.pow(t.pnl - mean, 2), 0) / (n - 1)) : 0;
  const cagr = (Math.pow(Math.max(equity, 0.01), 1 / years) - 1) * 100;
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
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(n / years) : 0,
    sortino: 0,
    calmar: mdd < 0 ? cagr / Math.abs(mdd * 100) : 0,
    exposure: (invested / Math.max(endI - startI + 1, 1)) * 100,
    tradeVol: sd * 100,
    avgHold: n ? trades.reduce((a, t) => a + (t.exit - t.entry), 0) / n : 0,
    lossCount: losses.length,
    lowVolLosses: 0,
    lowVolLossShare: 0,
    costImpact: L.fees * 100,
  };
}
