// AI 트레이딩의 계정 상태(S.tf) 보관과 구독. 계산은 core/trade 가 하고 여기는 담아 두고 알리기만 한다.
import { useSyncExternalStore } from 'react';
import { tfDefault, tfNFInit, type TfState } from '../../core/trade/state';

const KEY = 'teth.react.tf';

function load(): TfState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && typeof v === 'object') return tfNFInit(v as TfState);
  } catch {
    /* 저장분이 깨졌으면 빈 상태로 */
  }
  return tfDefault();
}

let tf: TfState = load();
/** window.TF_PREVIEW: 예시 전략 여섯으로 터미널을 미리 본다 (QA 상태에서만 켠다) */
let preview = (() => {
  try {
    return sessionStorage.getItem('teth.react.tfPreview') === '1';
  } catch {
    return false;
  }
})();
let rev = 0;
const subs = new Set<() => void>();
const emit = () => {
  rev++;
  subs.forEach((f) => f());
};
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** tfS() */
export const getTf = () => tf;
export const getPreview = () => preview;
/** 상태를 고친다. 원본처럼 그 자리에서 바꾸는 함수를 받아 사본에 적용하고 저장한다 (tfSave) */
export function updateTf(fn: (t: TfState) => void) {
  const next = JSON.parse(JSON.stringify(tf)) as TfState;
  fn(next);
  tf = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(tf));
  } catch {
    /* 저장 못 해도 화면은 그대로 쓴다 */
  }
  emit();
}
/** 계정 상태를 통째로 바꾼다 (QA 프리셋, 로그아웃) */
export function replaceTf(next: TfState | null) {
  tf = next ? tfNFInit(next) : tfDefault();
  try {
    localStorage.setItem(KEY, JSON.stringify(tf));
  } catch {
    /* 무시 */
  }
  emit();
}
export function setPreview(on: boolean) {
  preview = on;
  try {
    sessionStorage.setItem('teth.react.tfPreview', on ? '1' : '0');
  } catch {
    /* 무시 */
  }
  emit();
}
/** 저장 없는 화면 상태(TF_TM 등)가 바뀌었을 때 다시 그리게 한다 */
export const bump = emit;

export function useTf(): TfState {
  return useSyncExternalStore(subscribe, () => tf);
}
export function usePreview(): boolean {
  return useSyncExternalStore(subscribe, () => preview);
}
/** 화면 상태 변화까지 따라 그릴 때 */
export function useRev(): number {
  return useSyncExternalStore(subscribe, () => rev);
}
