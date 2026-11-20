// 해시 경로. 원본과 같은 주소 체계(#/trade, #/share/..., #/settings/...)를 그대로 쓴다.
import { useSyncExternalStore } from 'react';
import { legacy } from '../core/config';

const sub = (f: () => void) => {
  window.addEventListener('hashchange', f);
  return () => window.removeEventListener('hashchange', f);
};
export const useHash = () => useSyncExternalStore(sub, () => window.location.hash);

/** tfNav(r) */
export function nav(r: string) {
  if (PORTED.some((re) => re.test(r))) window.location.hash = r;
  else window.location.href = legacy(r);
}
export function goHome() {
  if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** React 로 옮긴 경로. 여기 없는 경로는 같은 주소의 원본(HTML 판)을 연다. 화면을 옮길 때마다 한 줄씩 는다. */
const PORTED: RegExp[] = [/^$/, /^#?\/?$/, /^#\/share$/, /^#\/share\/(s|t|copy|c)\//];

/** 주소에서 화면을 고른다 (원본 tfRoute 의 전략 복사 갈래). 깨진 #/share/... 주소는 목록으로 */
export type Screen =
  | { k: 'home' }
  | { k: 'share' }
  | { k: 'detail'; ne: string; pd: string | null; tab: string | null; setup?: boolean }
  | { k: 'copy'; cid: string; tab: string };
export function parseHash(h: string): Screen {
  if (h === '#/share') return { k: 'share' };
  if (h.indexOf('#/share/') !== 0) return { k: 'home' };
  let m = h.match(/^#\/share\/s\/([^/]+)(?:\/(all|1y|2y|30d|7d))?(?:\/(ov|perf|trades|log|info))?$/);
  if (m) return { k: 'detail', ne: m[1], pd: m[2] || null, tab: m[3] || null };
  /* cpProfileRoute: 트레이더 프로필은 전략 상세와 같은 화면이다 */
  m = h.match(/^#\/share\/t\/([^/]+?)(?:\/(ov|pos|cal|bal|cop))?$/);
  if (m) return { k: 'detail', ne: m[1], pd: null, tab: 'ov' };
  /* cpSetupRoute: 상세를 그린 뒤 복사 창을 연다 */
  m = h.match(/^#\/share\/copy\/([^/]+)$/);
  if (m) return { k: 'detail', ne: m[1], pd: null, tab: 'ov', setup: true };
  m = h.match(/^#\/share\/c\/([^/]+?)(?:\/(pos|hist|share|bal|tx))?$/);
  if (m) return { k: 'copy', cid: m[1], tab: m[2] || 'pos' };
  return { k: 'share' };
}
/** 주소만 바꾼다 (history.replaceState). 같은 화면 안의 기간, 탭 전환은 기록을 쌓지 않는다 */
export function replaceHash(r: string) {
  history.replaceState(null, '', window.location.pathname + window.location.search + r);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
