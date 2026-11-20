// 잔고 그래프와 작은 가격 그래프의 자리 계산 (원본 btGeo, btPath, btMarkList, btMini, btGoSpark 의 숫자 부분).
import { mkdTicks } from './engine';
import type { BtR, DecKind } from './compute';

export interface Geo {
  W: number;
  H: number;
  pl: number;
  pr: number;
  pt: number;
  pb: number;
  T: number[];
  X: (j: number) => number;
  Y: (v: number) => number;
  mob: boolean;
}
/** btGeo(): 그래프 상자의 폭(hostW)과 창 높이로 축을 잡는다 */
export function btGeo(R: BtR, amt: number, hostW: number | null, innerH: number): Geo {
  const W = Math.max(300, Math.round(hostW != null ? hostW : 900));
  const mob = W < 560;
  const H = mob ? 240 : Math.max(300, Math.min(372, Math.round(innerH * 0.41)));
  const pl = mob ? 46 : 64;
  const pr = mob ? 8 : 18;
  const pt = 26;
  const pb = 40;
  const vs = R.eq.map((p) => p.v).concat(R.bench);
  const mn = Math.min.apply(null, vs.concat(1)) * amt;
  const mx = Math.max.apply(null, vs.concat(1)) * amt;
  const T = mkdTicks(mn, mx, 5);
  const lo = T[0];
  const hi = T[T.length - 1];
  const X = (j: number) => pl + (Math.max(0, j) / Math.max(1, R.N - 1)) * (W - pl - pr);
  const Y = (v: number) => pt + (1 - (v * amt - lo) / (hi - lo)) * (H - pt - pb);
  return { W, H, pl, pr, pt, pb, T, X, Y, mob };
}
/** btV(j): j=-1 은 첫날의 거래가 반영되기 전 */
export const btV = (R: BtR, j: number) => (j < 0 ? 1 : R.eq[j].v);
/** btPath(arr,G) */
export function btPath(arr: number[], G: Geo): string {
  let d = '';
  arr.forEach((v, j) => {
    d += (j ? ' L' : 'M') + G.X(j).toFixed(1) + ' ' + G.Y(v).toFixed(1);
  });
  return d;
}
export interface Mark {
  k: DecKind;
  side?: number;
  j: number;
  j2: number;
  ix: number;
  ix2: number;
  n: number;
  pnl?: number;
  t: string;
}
/** btMarkList(group): 그래프 위의 표시. 돌리는 동안에는 판단 하나가 표시 하나. 끝난 뒤에는 가까이 붙은 보류와 같은 날의 매수를 묶는다 */
export function btMarkList(R: BtR, G: Geo, group: boolean): Mark[] {
  const out: Mark[] = [];
  let last: Mark | null = null;
  let lastB: Mark | null = null;
  R.D.forEach((d) => {
    if (d.k === 'pick' || d.k === 'hold') return;
    if (group && d.k === 'skip' && last && G.X(d.j) - G.X(last.j2) < 12) {
      last.n++;
      last.j2 = d.j;
      last.ix2 = d.ix;
      return;
    }
    if (d.k === 'buy' && lastB && lastB.j === d.j) {
      lastB.n++;
      lastB.t += ', ' + d.tk;
      return;
    }
    const m: Mark = { k: d.k, side: d.side, j: d.j, j2: d.j, ix: d.ix, ix2: d.ix, n: 1, pnl: d.pnl, t: (d.tk ? d.tk + ' ' : '') + d.tag };
    out.push(m);
    if (d.k === 'skip') last = m;
    else if (d.k === 'buy') {
      last = null;
      lastB = m;
    }
  });
  return out;
}

export type MiniMark = [number, string, string];
export type MiniLine = [number, string, string];
export interface MiniGeo {
  W: number;
  H: number;
  pl: number;
  pr: number;
  pt: number;
  pb: number;
  lo: number;
  hi: number;
  mn: number;
  mx: number;
  pad: number;
  d: string;
  X: (i: number) => number;
  Y: (p: number) => number;
}
/** btMini 의 자리: 종목 하나의 가격 선 */
export function btMiniGeo(P: number[], T: number, i1: number, i2: number, lines: MiniLine[]): MiniGeo {
  const lo = Math.max(0, i1);
  const hi = Math.min(T, i2);
  const W = 400;
  const H = 176;
  const pl = 6;
  const pr = 78;
  const pt = 22;
  const pb = 26;
  const v: number[] = [];
  for (let i = lo; i <= hi; i++) v.push(P[i]);
  const ex = v.concat(lines.map((l) => l[0]));
  let mn = Math.min.apply(null, ex);
  let mx = Math.max.apply(null, ex);
  const pad = (mx - mn) * 0.12 || 1;
  mn -= pad;
  mx += pad;
  const X = (i: number) => pl + ((i - lo) / Math.max(1, hi - lo)) * (W - pl - pr);
  const Y = (p: number) => pt + (1 - (p - mn) / (mx - mn)) * (H - pt - pb);
  let d = '';
  v.forEach((p, k) => {
    d += (k ? ' L' : 'M') + X(lo + k).toFixed(1) + ' ' + Y(p).toFixed(1);
  });
  return { W, H, pl, pr, pt, pb, lo, hi, mn, mx, pad, d, X, Y };
}

/** btGoSpark 의 자리: 실행 준비 화면 왼쪽의 작은 잔고 선 */
export function btSparkGeo(R: BtR) {
  const W = 300;
  const H = 96;
  const p = 6;
  const vs = R.eq.map((x) => x.v);
  const all = vs.concat(R.bench, [1]);
  const mn = Math.min.apply(null, all);
  const mx = Math.max.apply(null, all);
  const X = (j: number) => p + (j / Math.max(1, R.N - 1)) * (W - 2 * p);
  const Y = (v: number) => p + (1 - (v - mn) / (mx - mn || 1)) * (H - 2 * p);
  let d = '';
  let b = '';
  vs.forEach((v, j) => {
    d += (j ? ' L' : 'M') + X(j).toFixed(1) + ' ' + Y(v).toFixed(1);
  });
  R.bench.forEach((v, j) => {
    b += (j ? ' L' : 'M') + X(j).toFixed(1) + ' ' + Y(v).toFixed(1);
  });
  return { W, H, p, vs, d, b, X, Y };
}

/** 월별 수익률을 연도 x 월 표로 (원본 skbMonthTable 이 그려진 막대에서 다시 읽어 만드는 표) */
export interface MonCell {
  p: string;
  part: boolean;
}
export function btMonthTable(labels: { pct: string; y: number; m: number; part: boolean }[]) {
  const Y: Record<number, Record<number, MonCell>> = {};
  const order: number[] = [];
  labels.forEach((x) => {
    if (!Y[x.y]) {
      Y[x.y] = {};
      order.push(x.y);
    }
    Y[x.y][x.m] = { p: x.pct, part: x.part };
  });
  const all: MonCell[] = [];
  let full = 0;
  order.forEach((y) => {
    Object.keys(Y[y]).forEach((m) => {
      all.push(Y[y][+m]);
      if (!Y[y][+m].part) full++;
    });
  });
  const yrSum = (y: number) => {
    const k = Object.keys(Y[y]);
    if (!k.length) return '';
    const g = k.reduce((a, m) => {
      const v = parseFloat(Y[y][+m].p);
      return isFinite(v) ? a * (1 + v / 100) : a;
    }, 1);
    const r = (g - 1) * 100;
    return (r > 0 ? '+' : '') + r.toFixed(1) + '%';
  };
  const g0 = all.reduce((a, c) => {
    const v = parseFloat(c.p);
    return isFinite(v) ? a * (1 + v / 100) : a;
  }, 1);
  return { Y, order, full, yrSum, r0: (g0 - 1) * 100 };
}
