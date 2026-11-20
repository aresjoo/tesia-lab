// 가격 데이터 창구. 원본과 같은 파일(data/px-daily.js, data/fut-daily.js)이 window 에 올려 둔 값을 읽는다.
// 화면 없는 순수 로직이라 나중에 Dart 로 옮길 때는 이 파일만 JSON 읽기로 바꾸면 된다.

import { MK_PX_CFG } from './catalog.data';

export type PxData = {
  v: string;
  start: string;
  asof: string;
  px: Record<string, number[]>;
  /** 자산별 거래일 표시. '1' 이면 그날 거래가 있었다 */
  open?: Record<string, string>;
  /** 공포 탐욕 지수 */
  fng?: (number | null)[];
};
export type FutSym = { o: number[]; h: number[]; l: number[]; c: number[]; f: number[] };
export type FutData = { v: string; asof: string; sym: Record<string, FutSym> };

const g = globalThis as unknown as { TETH_PX?: PxData; TETH_FUT?: FutData };
export const TETH_PX: PxData | undefined = g.TETH_PX;
export const TETH_FUT: FutData | undefined = g.TETH_FUT;

/** mulberry32(a): 씨앗으로 정해지는 난수 */
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRICE: 기준 자산(비트코인) 일봉. 실제 데이터가 없을 때만 씨앗 데이터 */
function basePrice(): number[] {
  if (TETH_PX && TETH_PX.px && TETH_PX.px['비트코인']) return TETH_PX.px['비트코인'].slice();
  const rng = mulberry32(3);
  const p = [16500];
  const regimes: [number, number, number][] = [
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
}
export const PRICE0: number[] = basePrice();

/** 데이터 기준일(마지막 봉의 날짜)과 세대 */
export const MK_ASOF: number[] = TETH_PX ? TETH_PX.asof.split('-').map(Number) : [2026, 9, 28];
export const MK_DATA_V: string = TETH_PX ? TETH_PX.v : '2026-09-28.1';
export const MK_GEN0 = { asof: [2026, 9, 28], len: 1335 };

const MK_PXC: Record<string, number[]> = {};
/** mkPx(key): 자산의 일봉 종가 배열 */
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

/** mkOpen(k,i): 그 자산이 그날 거래됐는가 */
export function mkOpen(k: string, i: number): boolean {
  const o = TETH_PX && TETH_PX.open && TETH_PX.open[k];
  return !o || o.charCodeAt(i) === 49;
}
/** mkFng(i), fuFng(i): 그날의 공포 탐욕 지수 */
export function mkFng(i: number): number | null {
  const f = TETH_PX && TETH_PX.fng;
  return f && f[i] != null ? (f[i] as number) : null;
}
/** fuD(k): 선물 일봉(o,h,l,c)과 펀딩비(f) */
export function fuD(k: string): FutSym {
  const d = TETH_FUT && TETH_FUT.sym && TETH_FUT.sym[k];
  if (!d) throw new Error('fut data: ' + k);
  return d;
}

let D0: Date | null = null;
/** idxToDate(i): 봉 번호의 날짜 */
export function idxToDate(i: number): Date {
  if (!D0) {
    D0 = new Date(MK_ASOF[0], MK_ASOF[1] - 1, MK_ASOF[2]);
    D0.setDate(D0.getDate() - (PRICE0.length - 1));
  }
  const t = new Date(D0.getTime());
  t.setDate(t.getDate() + i);
  return t;
}
