// 시세에서 계산하는 것들: 바이낸스 봉을 스냅샷으로, 파생 지표, 사건 타임라인의 가격 붙이기, 방향 확률 다듬기.
import { TAI_SRCNM, TAI_TFL, taiIvDesc } from './scope';
import type { Gauge, Ohlc, Rich, TlineIn, TlineItem } from './types';

/** taiBinDirect 의 계산 부분: 바이낸스 klines 응답을 스냅샷으로 */
export function binSnapshot(k: unknown[][], iv: string, now: number): Ohlc {
  const rows = k.map((x) => [x[0] as number, +(x[1] as string), +(x[2] as string), +(x[3] as string), +(x[4] as string), +(x[5] as string)]);
  const closes = rows.map((x) => x[4]);
  const last = closes[closes.length - 1];
  const pct = (m: number) => {
    const p = closes[closes.length - 1 - m];
    return p ? +((last / p - 1) * 100).toFixed(2) : null;
  };
  const sN = Math.min(30, rows.length);
  const samp: number[][] = [];
  for (let i = 0; i < sN; i++) samp.push(rows[Math.min(rows.length - 1, Math.round((i * (rows.length - 1)) / Math.max(1, sN - 1)))]);
  return {
    last: +last.toPrecision(6),
    chg1d: pct(1),
    chg7d: pct(7),
    chg30d: pct(30),
    ivChg: pct(1),
    hi90: +Math.max(...rows.map((x) => x[2])).toPrecision(6),
    lo90: +Math.min(...rows.map((x) => x[3])).toPrecision(6),
    closes30: closes.slice(-30).map((v) => +v.toPrecision(5)),
    closesS: samp.map((r) => [r[0], +r[4].toPrecision(6)] as [number, number]),
    rows: rows.slice(-300).map((x) => [x[0], +x[1].toPrecision(6), +x[2].toPrecision(6), +x[3].toPrecision(6), +x[4].toPrecision(6), +(x[5] || 0).toPrecision(4)]),
    meta: { src: 'binance', iv, n: rows.length, at: now, quality: 'complete' },
  };
}
/** taiBinDirect 의 attach: 일봉으로 24시간 기준선과 일봉 30개를 붙인다 */
export function binAttachDaily(out: Ohlc, k: unknown[][]) {
  const dr = k.map((x) => [x[0] as number, +(x[4] as string)]);
  const dl = dr[dr.length - 1][1];
  const dp = dr.length > 1 ? dr[dr.length - 2][1] : 0;
  out.base = { chg: dp ? +((dl / dp - 1) * 100).toFixed(2) : null, label: '24H' };
  out.daily = dr.slice(-30).map((x) => [new Date(x[0]).toISOString().slice(0, 10), +x[1].toPrecision(6)] as [string, number]);
}

export type Indic = { last: number; rsi: number; ma20: number; ma50: number | null; atrPct: number; hi20: number; lo20: number; pos: number; up10: number; vd: number | null };
/** taiIndic(): 받은 봉으로 직접 계산한 지표 */
export function taiIndic(j: Ohlc | null): Indic | null {
  if (!j || !j.rows || j.rows.length < 30) return null;
  const rows = j.rows;
  const cl = rows.map((r) => r[4]);
  const n = cl.length;
  const last = cl[n - 1];
  let i: number;
  const ma = (p: number) => {
    let s = 0;
    for (let q = n - p; q < n; q++) s += cl[q];
    return s / p;
  };
  const ma20 = ma(20);
  const ma50 = n >= 50 ? ma(50) : null;
  let g = 0;
  let l = 0;
  for (i = n - 14; i < n; i++) {
    const d = cl[i] - cl[i - 1];
    if (d > 0) g += d;
    else l -= d;
  }
  const rsi = l === 0 ? 100 : Math.round(100 - 100 / (1 + g / l));
  let atr = 0;
  for (i = n - 14; i < n; i++) atr += Math.max(rows[i][2] - rows[i][3], Math.abs(rows[i][2] - cl[i - 1]), Math.abs(rows[i][3] - cl[i - 1]));
  const atrPct = +((atr / 14 / last) * 100).toFixed(2);
  let hi20 = -1e18;
  let lo20 = 1e18;
  for (i = n - 20; i < n; i++) {
    hi20 = Math.max(hi20, rows[i][2]);
    lo20 = Math.min(lo20, rows[i][3]);
  }
  const pos = j.hi90 > j.lo90 ? Math.round(((last - j.lo90) / (j.hi90 - j.lo90)) * 100) : 50;
  let up = 0;
  for (i = n - 10; i < n; i++) if (cl[i] >= cl[i - 1]) up++;
  let vd: number | null = null;
  if (rows[0].length > 5 && rows[n - 1][5] > 0) {
    let v5 = 0;
    let v20 = 0;
    for (i = n - 5; i < n; i++) v5 += rows[i][5];
    for (i = n - 20; i < n; i++) v20 += rows[i][5];
    if (v20 > 0) vd = Math.round((v5 / 5 / (v20 / 20) - 1) * 100);
  }
  return { last, rsi, ma20: +ma20.toPrecision(5), ma50: ma50 ? +ma50.toPrecision(5) : null, atrPct, hi20: +hi20.toPrecision(5), lo20: +lo20.toPrecision(5), pos, up10: up, vd };
}

/** taiTline(list): 사건(날짜, 제목, 출처)에 받은 일봉의 종가와 등락을 붙인다. 가격은 모델이 아니라 여기서 계산한다 */
export function taiTline(list: TlineIn[] | null, j: Ohlc | null): TlineItem[] {
  if (!Array.isArray(list) || !list.length) return [];
  let dArr: [string, number][] | null = null;
  if (j && Array.isArray(j.daily) && j.daily.length > 2) dArr = j.daily;
  else if (j && j.rows && j.rows.length > 5 && (!j.meta || j.meta.iv === '1d')) dArr = j.rows.map((r) => [new Date(r[0]).toISOString().slice(0, 10), r[4]] as [string, number]);
  const idxByDate: Record<string, number> = {};
  if (dArr) dArr.forEach((r, i) => (idxByDate[r[0]] = i));
  const out: TlineItem[] = [];
  for (const e of list.slice(0, 4)) {
    if (!e || !e.date || !e.title) continue;
    const d = String(e.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const src = e.src ? String(e.src).replace(/^https?:\/\//, '').split('/')[0].slice(0, 40) : '';
    let px: number | null = null;
    let chg: number | null = null;
    let mapped: string | null = null;
    if (dArr) {
      let i: number | undefined = idxByDate[d];
      if (i == null) {
        for (let k = 0; k < dArr.length; k++) {
          if (dArr[k][0] > d) {
            i = k;
            mapped = dArr[k][0].slice(5).replace('-', '.');
            break;
          }
        }
      }
      if (i != null && i > 0) {
        px = dArr[i][1];
        chg = +((dArr[i][1] / dArr[i - 1][1] - 1) * 100).toFixed(2);
      }
    }
    out.push({ d, t: String(e.title).slice(0, 80), src, px, chg, mapped });
  }
  return out;
}

/** taiGauge(g): 합이 100 이 되게 다듬는다. 숫자가 아니면 null */
export function gaugeUp(g: Gauge | null): number | null {
  if (!g || g.up == null || g.down == null) return null;
  if (!isFinite(+g.up) || !isFinite(+g.down)) return null;
  return Math.max(0, Math.min(100, Math.round(+g.up || 0)));
}

/** taiOhlc 가 타임라인 줄에 적는 제목과 상세, 그리고 모델에 넘기는 시세 글 */
export function ohlcStepText(label: string, j: Ohlc, iv: string, srcKey: string, kst: string) {
  const srcNm = srcKey === 'binance' ? '바이낸스' : '야후 파이낸스';
  const mIv = (j.meta && j.meta.iv) || iv;
  const mN = (j.meta && j.meta.n) || (j.rows ? j.rows.length : 0);
  const mSrc = TAI_SRCNM[(j.meta && j.meta.src) || srcKey] || srcNm;
  const title = label + ' 시세 확인, ' + mSrc + ', ' + kst + ' KST, ' + (TAI_TFL[mIv] || mIv) + ' ' + mN + '개';
  const detail: Rich = [
    { b: label },
    ' ' + (TAI_TFL[mIv] || mIv) + ' ' + mN + '봉 수신(' + taiIvDesc(mIv, mN) + '). 현재가 ',
    { b: String(j.last) },
    (j.base && j.base.chg != null ? ', ' + j.base.label + ' ' + j.base.chg + '%' : '') +
      ', 직전 봉 대비 ' +
      (j.ivChg != null ? j.ivChg : j.chg1d) +
      '%. 관측범위 최고 ' +
      String(j.hi90) +
      ' / 최저 ' +
      String(j.lo90) +
      '.' +
      (j.meta && j.meta.quality === 'adjusted' ? ' (요청 간격과 다른 실간격으로 제공됨)' : ''),
  ];
  return { title, detail, mR: mN + '봉', mSrc };
}
export function ohlcContext(label: string, j: Ohlc, iv: string, srcKey: string): string {
  const mIv2 = (j.meta && j.meta.iv) || iv;
  const mN2 = (j.meta && j.meta.n) || 90;
  return (
    '\n[' + label + ' 실시세 스냅샷: ' + (TAI_TFL[mIv2] || mIv2) + ' ' + mN2 + '개(' + taiIvDesc(mIv2, mN2) + '), 공급처 ' + (TAI_SRCNM[(j.meta && j.meta.src) || srcKey] || '') + ', 방금 수신]' +
    ' 현재가 ' + j.last +
    (j.base && j.base.chg != null ? ', ' + j.base.label + ' ' + j.base.chg + '%' : '') +
    ', 직전 봉 대비 ' + (j.ivChg != null ? j.ivChg : j.chg1d) + '%' +
    ', 관측범위(' + taiIvDesc(mIv2, mN2) + ') 최고 ' + j.hi90 + ' 최저 ' + j.lo90 +
    ', 구간 균등 종가 샘플(과거→현재): ' + (j.closesS && j.closesS.length ? j.closesS.map((s) => s[1]).join(', ') : j.closes30.join(', ')) +
    '. 이 스냅샷의 관측 구간을 벗어난 기간의 수치를 단정하지 말 것. 예측이나 전망 질문에는 이 데이터를 근거로 마크다운으로 구조화된 깊이 있는 분석을 작성한다: "### 현재 위치" 섹션(핵심 수치 **볼드**), "### 상방 시나리오"와 "### 하방 시나리오"(트리거 가격과 목표 레벨, 불릿), 지표 요약은 | 표 |, "### 리스크와 대응"(현실적 제안). 확정적 단정과 수익 보장은 피한다.'
  );
}
/** 시세 머리 카드와 차트 머리줄이 쓰는 등락과 그 기준 이름 */
export function mainChange(j: Ohlc, iv: string, coin: boolean): { chg: number | null; label: string } {
  if (j.base && j.base.chg != null) return { chg: j.base.chg, label: j.base.label };
  return { chg: j.chg1d, label: iv !== '1d' ? '직전봉' : coin ? '24H' : '전일比' };
}
