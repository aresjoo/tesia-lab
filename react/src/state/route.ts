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
  /* 같은 주소를 다시 누르면 hashchange 가 나지 않으니 직접 알린다 (원본 tfNav 는 tfRoute 를 다시 부른다) */
  if (PORTED.some((re) => re.test(r))) {
    if (window.location.hash === r) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else window.location.hash = r;
  } else window.location.href = legacy(r);
}
/** 단추로 홈(이나 다른 대화)을 골랐다는 표시. 해시 화면에서 나올 때 뒤로가기와 가르는 데 쓴다 (state/back.ts) */
let homeIntent = false;
export const takeHomeIntent = () => {
  const v = homeIntent;
  homeIntent = false;
  return v;
};
export function goHome() {
  homeIntent = true;
  if (window.location.hash) history.pushState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** React 로 옮긴 경로. 여기 없는 경로는 같은 주소의 원본(HTML 판)을 연다. 화면을 옮길 때마다 한 줄씩 는다. */
const PORTED: RegExp[] = [
  /^$/,
  /^#?\/?$/,
  /^#\/share\/bt\//,
  /^#\/strategy\//,
  /^#\/insight(\/|$)/,
  /^#\/(review|periodic)(\/|$)/,
  /* 거래소 연결(원본에는 주소가 없어 새로 준 것), 설정, 이용 현황 */
  /^#\/brokers(\/[a-z]+)?$/,
  /^#\/settings(\/[a-z]+)?$/,
  /^#\/plan(\/(rebates|alerts))?$/,
];
