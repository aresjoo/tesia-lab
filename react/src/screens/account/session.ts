// 앱 상태의 회원과 core 의 S.user, S.tf 를 잇는다. 로그인 뒤 하려던 일(tfIntentRun)도 여기서 이어 간다.
import { tfIntentClear, tfIntentPeek, type AcCtx } from '../../core/account/ac';
import { bcBoot } from '../../core/account/bc';
import { tfSetUser } from '../../core/account/tf';
import { goHome, nav } from '../../state/route';
import { getState, userHooks } from '../../state/store';
import { acStart } from './brokers/flow';

const mine = () => /^#\/(brokers|settings|plan)(\/|$)/.test(window.location.hash);

tfSetUser(getState().user, true);
bcBoot(); /* authSyncUI(): 회원이면 웰컴, 유예, 월 사이클, 일 재대사를 한 번에 */
userHooks.push((u) => {
  tfSetUser(u ? { name: u.name, email: u.email || '' } : null);
  if (!u) {
    /* gLogout(): 로그아웃하면 홈으로 */
    if (mine()) goHome();
    return;
  }
  bcBoot();
  /* 하려던 일로 돌아간다 (원본은 인증 뒤 320ms 에 tfIntentRun) */
  if (getState().pendingNew == null && tfIntentPeek()) setTimeout(tfIntentRun, 320);
});

/** tfIntentRun(): 이 조각이 아는 일(start, settings)만 꺼낸다. 나머지(bt, copy)는 그 조각이 꺼낸다. */
export function tfIntentRun(): boolean {
  const o = tfIntentPeek();
  if (!o || !getState().user) return false;
  if (o.kind === 'start') {
    tfIntentClear();
    acStart(o as unknown as AcCtx);
    return true;
  }
  if (o.kind === 'settings') {
    tfIntentClear();
    nav('#/settings/general');
    return true;
  }
  return false;
}
