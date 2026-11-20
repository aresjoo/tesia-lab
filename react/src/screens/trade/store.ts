// AI 트레이딩이 읽는 계정 상태(S.tf)의 창구. 상태는 앱 전체에 하나뿐인 core/account/tf.ts 의 것을 쓴다
// (localStorage 'teth.state' 의 tf 칸). 여기는 그 값을 이 조각의 타입으로 보여 주고, 미리 보기 켬 끔만 따로 담는다.
import { useSyncExternalStore } from 'react';
import { S, tfBump, tfNFInit, tfSave, tfSubscribe, tfVersion, type Tf } from '../../core/account/tf';
import type { TfState } from '../../core/trade/state';

/** tfS() + tfNFInit(): 예전 저장분에 빠진 칸을 채운 그 자리의 상태 */
function cur(): TfState {
  const t = tfNFInit();
  if (!t.intake) t.intake = {};
  if (!Array.isArray(t.strat)) t.strat = [];
  if (!Array.isArray(t.fills)) t.fills = [];
  return t as unknown as TfState;
}

/** window.TF_PREVIEW: 예시 전략 여섯으로 터미널을 미리 본다 (QA 상태에서만 켠다) */
let preview = (() => {
  try {
    return sessionStorage.getItem('teth.react.tfPreview') === '1';
  } catch {
    return false;
  }
})();
/** 저장 없는 화면 상태(TF_TM 등)가 바뀐 횟수. 계정 상태 판(tfVersion)과 더해 다시 그릴 때를 잡는다 */
let rev = 0;
const revNow = () => tfVersion() * 1000003 + rev;

/** tfS() */
export const getTf = cur;
export const getPreview = () => preview;
/** 원본처럼 그 자리에서 고치고 저장한다 (tfSave) */
export function updateTf(fn: (t: TfState) => void) {
  fn(cur());
  tfSave();
}
/** 계정 상태를 통째로 바꾼다 (QA 프리셋) */
export function replaceTf(next: TfState | null) {
  S.tf = next ? (next as unknown as Tf) : null;
  cur();
  tfSave();
}
export function setPreview(on: boolean) {
  preview = on;
  try {
    sessionStorage.setItem('teth.react.tfPreview', on ? '1' : '0');
  } catch {
    /* 무시 */
  }
  bump();
}
/** 저장 없는 화면 상태가 바뀌었을 때 다시 그리게 한다 */
export function bump() {
  rev++;
  tfBump();
}

/** 상태는 그 자리에서 고치므로 판 번호로 다시 그릴 때를 알고, 값은 지금 것을 돌려준다 */
export function useTf(): TfState {
  useSyncExternalStore(tfSubscribe, tfVersion);
  return cur();
}
export function usePreview(): boolean {
  return useSyncExternalStore(tfSubscribe, () => preview);
}
/** 화면 상태 변화까지 따라 그릴 때 */
export function useRev(): number {
  return useSyncExternalStore(tfSubscribe, revNow);
}
