// 지표. 원본 함수 이름 그대로.

/** sma(arr,n,i) */
export function sma(arr: number[], n: number, i: number): number | null {
  if (i < n - 1) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += arr[k];
  return s / n;
}
/** rsi(arr,i): 14봉 */
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
/** mkVol(P,i,n), fuVol(C,i,n): 하루 수익률의 표준편차 */
export function mkVol(P: number[], i: number, n: number): number {
  let s = 0;
  let q = 0;
  for (let k = i - n + 1; k <= i; k++) {
    const r = P[k] / P[k - 1] - 1;
    s += r;
    q += r * r;
  }
  const m = s / n;
  return Math.sqrt(Math.max(1e-12, q / n - m * m));
}
/** fuMax(A,a,b) */
export function fuMax(A: number[], a: number, b: number): number {
  let m = -Infinity;
  for (let k = a; k <= b; k++) if (A[k] > m) m = A[k];
  return m;
}
/** fuMin(A,a,b) */
export function fuMin(A: number[], a: number, b: number): number {
  let m = Infinity;
  for (let k = a; k <= b; k++) if (A[k] < m) m = A[k];
  return m;
}
/** fuSma(A,n,i) */
export function fuSma(A: number[], n: number, i: number): number {
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += A[k];
  return s / n;
}
