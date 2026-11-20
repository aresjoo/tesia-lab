// 퍼널 상태(tfS)를 브라우저 저장소와 앱 상태에 잇는다. 모양과 규칙은 core/bt/tf.ts, core/bt/tfStore.ts.
import { tfS as acctTfS, tfSave as acctTfSave } from '../../core/account/tf';
import { tfNormalize, type TfState } from '../../core/bt/tf';
import { tfIntentClear, tfIntentPeek } from '../../core/account/ac';
import { getState } from '../../state/store';

/** tfS(): 앱에 하나뿐인 전략 상태(core/account/tf.ts 의 S.tf)를 이 조각의 모양으로 본다. 손님 것은 저장되지 않는다. */
export function tfS(): TfState {
  return tfNormalize(acctTfS() as unknown as TfState);
}
/** 예전에는 조각마다 따로 읽어 화면에 들어올 때 다시 읽었다. 이제 상태가 하나라 할 일이 없다 */
export function tfRefresh(): void {}
/** tfSave(): 원본 STORE.save 는 700ms 뒤에 쓰지만 여기서는 바로 쓴다(새로고침 때 잃지 않게) */
export function tfSave(): void {
  acctTfSave();
}
/** tfTrack(name,props): 수집 연결 전의 줄 세우기 (원본과 같은 window.TF_EVQ) */
export function tfTrack(n: string, p: Record<string, unknown> = {}): void {
  try {
    const w = window as unknown as { TF_EVQ?: unknown[] };
    const q = (w.TF_EVQ = w.TF_EVQ || []);
    q.push({ n, p, t: Date.now() });
    if (q.length > 200) q.shift();
  } catch {
    /* 무시 */
  }
}

/* 하려던 일 하나를 기억한다 (원본 tfIntentSet, tfIntentPeek, tfIntentClear): 앱에 한 벌, core/account/ac.ts 것을 쓴다 */
export { tfIntentClear, tfIntentPeek, tfIntentSet, type Intent } from '../../core/account/ac';

/** tfIntentRun() 가운데 백테스트로 돌아가는 가지: 인증이 끝나면 한 번만 꺼내 그 자리로 간다. 다른 종류(copy, start, settings)는 그 화면을 맡은 조각이 잇는다 */
export function tfIntentRun(): boolean {
  const o = tfIntentPeek();
  if (!o || !getState().user || o.kind !== 'bt') return false;
  tfIntentClear();
  window.location.hash = '#/share/bt/' + String(o.id);
  return true;
}
