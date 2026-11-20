// 숫자, 날짜, 이름 포맷. 원본 함수 이름 그대로.
import { MK_TK, SK_SYM } from './catalog.data';
import { idxToDate } from './data';

/** mkPct0(v,d): +1.2% */
export function mkPct0(v: number, d?: number): string {
  const n = d != null ? d : 1;
  const x = +v.toFixed(n);
  return (x > 0 ? '+' : '') + x.toFixed(n) + '%';
}
/** mkPct(v,d): 0 도 + 를 붙인다 */
export function mkPct(v: number, d?: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(d != null ? d : 1) + '%';
}
/** mkSign(v): 오르면 ' mk-up', 내리면 ' mk-dn' */
export function mkSign(v: number): string {
  const x = +v.toFixed(1);
  return x > 0 ? ' mk-up' : x < 0 ? ' mk-dn' : '';
}
/** mkPxFmt(v): 가격 자릿수 */
export function mkPxFmt(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return '-';
  const a = Math.abs(v);
  return a >= 1000 ? Math.round(v).toLocaleString() : a >= 100 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toFixed(4);
}
/** mkPxU(a,v): 지수는 포인트, 나머지는 달러 */
export function mkPxU(a: string, v: number): string {
  return a === '나스닥' || a === 'S&P 500' ? mkPxFmt(v) + '포인트' : '$' + mkPxFmt(v);
}
/** cpUsd(n,d): $1,234.00 */
export function cpUsd(n: number, d?: number): string {
  const dd = d != null ? d : 2;
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: dd, maximumFractionDigits: dd });
}
const p2 = (n: number) => String(n).padStart(2, '0');
/** mkDate(i): 2026.11.13 */
export function mkDate(i: number): string {
  const d = idxToDate(i);
  return d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate());
}
/** mkdDate(i): 2026-11-13 */
export function mkdDate(i: number): string {
  const d = idxToDate(i);
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}
/** mkMD(i): 11월 13일 */
export function mkMD(i: number): string {
  const d = idxToDate(i);
  return d.getMonth() + 1 + '월 ' + d.getDate() + '일';
}
/** mkTk(k): 자산 이름을 심볼로 */
export function mkTk(k: string): string {
  return MK_TK[k] || k;
}
/** skSym(t): 글 속 코인 이름을 심볼로 (비앤비 → BNB) */
export function skSym(t: string | null | undefined): string {
  return String(t == null ? '' : t).replace(/비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/g, (k) => SK_SYM[k]);
}
/** mkJ(w,a,b): 받침에 따라 조사 고르기 */
export function mkJ(w: string | number, a: string, b: string): string {
  const s = String(w);
  const c = s.charCodeAt(s.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return s + a;
  return s + ((c - 0xac00) % 28 ? a : b);
}
/** mkHash(str) */
export function mkHash(str: string): number {
  let h = 0;
  str = String(str);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
/** tfSSNe(n): 주소에 넣는 전략 식별자 */
export function tfSSNe(n: string): string {
  return encodeURIComponent(n).replace(/'/g, '%27').replace(/\\/g, '%5C');
}
