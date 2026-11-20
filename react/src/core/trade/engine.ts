// 규칙 엔진(백테스트). 원본 「backtest engine」 구역을 그대로 옮겼다.
// 엔진의 주인은 전략 복사 조각(core/engine)이다. 그쪽이 들어오면 이 파일은 그쪽 것을 다시 내보내는 한 줄로 바꾼다.
// 가격은 원본과 같은 파일(data/px-daily.js → window.TETH_PX)을 그대로 싣는다.
import { TFC, type RuleP } from './state';

type TethPx = { v: string; asof: string; px: Record<string, number[]>; fng?: number[] };
const TETH_PX: TethPx | null = (typeof window !== 'undefined' && (window as unknown as { TETH_PX?: TethPx }).TETH_PX) || null;

/** mulberry32(a) */
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRICE0: 비트코인 일봉. 실제 시세 파일이 없을 때만 씨앗 데이터 */
export const PRICE0: number[] = (() => {
  if (TETH_PX && TETH_PX.px && TETH_PX.px['비트코인']) return TETH_PX.px['비트코인'].slice();
  const rng = mulberry32(3);
  const p = [16500];
  const regimes = [
    [0, 365, 0.0016],
    [365, 660, 0.00003],
    [660, 1050, 0.0013],
    [1050, 1335, 0.0004],
  ];
  for (let i = 1; i < 1335; i++) {
    let drift = 0.0005;
    for (let r = 0; r < regimes.length; r++) if (i >= regimes[r][0] && i < regimes[r][1]) drift = regimes[r][2];
    const shock = (rng() - 0.5) * 0.036;
    p.push(Math.max(9000, p[i - 1] * (1 + drift + shock)));
  }
  return p;
})();

/** MK_PX_CFG: 실제 일봉이 없는 자산의 씨앗 */
const MK_PX_CFG: Record<string, number[]> = { 비트코인: [799688, 34120, 0.07], 이더리움: [173287, 1730, 0.06], 테슬라: [700351, 94.56, 0.075], 금: [38266, 1982, 0.018], 나스닥: [463868, 13680, 0.024], 'S&P 500': [313180, 3696, 0.023], 도지코인: [343292, 0.09424, 0.07], 엔비디아: [477311, 16.31, 0.07], 리플: [252221, 0.4109, 0.055], 솔라나: [769198, 28.53, 0.075], 애플: [321947, 118.4, 0.032], 에이다: [113, 0.3221, 0.085], 아발란체: [523, 10.94, 0.09], 비앤비: [179, 275.8, 0.055], 마이크로소프트: [303, 295.8, 0.032], 아마존: [141, 105.1, 0.04], 메타: [226, 148.4, 0.045], 알파벳: [168, 105.2, 0.038], 에이엠디: [162, 77.19, 0.065] };
const MK_ASOF = TETH_PX ? TETH_PX.asof.split('-').map(Number) : [2026, 9, 28];
const MK_DATA_V = TETH_PX ? TETH_PX.v : '2026-09-28.1';
const MK_PXC: Record<string, number[]> = {};

/** mkPx(key): 자산의 일봉 배열 */
export function mkPx(key?: string | null): number[] {
  if (!key) return PRICE0;
  if (TETH_PX && TETH_PX.px && TETH_PX.px[key]) return TETH_PX.px[key];
  const c = MK_PX_CFG[key];
  if (!c) return PRICE0;
  const ck = key + '|' + c.join('/') + '|' + PRICE0.length + '|' + MK_DATA_V;
  if (MK_PXC[ck]) return MK_PXC[ck];
  const rng = mulberry32(c[0]);
  const p0 = c[1];
  const vol = c[2];
  const N = PRICE0.length;
  const p = [p0];
  let i = 1;
  while (i < N) {
    const len = 90 + Math.floor(rng() * 240);
    const drift = (rng() * 2.6 - 0.7) * 0.001;
    for (let k = 0; k < len && i < N; k++, i++) {
      let sh = (rng() - 0.5) * vol;
      if (rng() < 0.014) sh += (rng() - 0.66) * vol * 3.2;
      p.push(Math.max(p0 * 0.18, p[i - 1] * (1 + drift + sh)));
    }
  }
  return (MK_PXC[ck] = p);
}

/** sma(arr,n,i) */
export function sma(arr: number[], n: number, i: number): number | null {
  if (i < n - 1) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
}
/** rsi(arr,i): 14봉 단순 */
export function rsi(arr: number[], i: number): number {
  const n = 14;
  if (i < n) return 50;
  let g = 0;
  let l = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const d = arr[k] - arr[k - 1];
    if (d > 0) g += d;
    else l -= d;
  }
  if (l === 0) return 100;
  return 100 - 100 / (1 + g / n / (l / n));
}

let MK_D0: Date | null = null;
/** idxToDate(i): 가격 배열의 칸 번호를 날짜로 */
export function idxToDate(i: number): Date {
  if (!MK_D0) {
    MK_D0 = new Date(MK_ASOF[0], MK_ASOF[1] - 1, MK_ASOF[2]);
    MK_D0.setDate(MK_D0.getDate() - (PRICE0.length - 1));
  }
  const t = new Date(MK_D0.getTime());
  t.setDate(t.getDate() + i);
  return t;
}
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

/** runBacktest(params): 원본은 전역 PRICE 를 잠깐 바꿔 끼운다(mkWithPx). 여기서는 가격 배열을 넘긴다 */
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
export function tfScore(res: { winRate: number; cagr: number; mdd: number; tradeVol: number; n: number }): number {
  const c = TFC.score;
  const nz = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  let sc = nz(res.winRate, c.winLo, c.winHi) * c.wWin + nz(res.cagr, c.retLo, c.retHi) * c.wRet + nz(res.mdd, c.mddLo, c.mddHi) * c.wMdd + nz(res.tradeVol, c.volLo, c.volHi) * c.wVol;
  sc *= 100;
  if (res.n < 4) sc *= 0.65;
  if (res.n < 6) sc = Math.min(sc, 79);
  return Math.max(5, Math.min(99, Math.round(sc)));
}

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
