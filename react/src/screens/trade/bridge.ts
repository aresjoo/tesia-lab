// 다른 조각의 화면으로 넘어가는 문. 그 화면이 React 로 옮겨지면 이 파일의 함수만 바꾸면 된다.
// 지금은 같은 주소의 원본(HTML 판)을 열거나, 주소가 없는 화면은 가장 가까운 원본 주소로 보낸다.
import { legacy } from '../../core/config';
import { acReady, TFC } from '../../core/trade/state';
import { goHome, nav } from '../../state/route';
import { authOpen, getState, setState } from '../../state/store';
import { getTf } from './store';

export type AcAfter = { kind: 'terminal' } | { kind: 'copy'; id: string } | { kind: 'bt'; id: string };

/** acStart(ctx): 실행 환경이 이미 있으면 그대로 이어 가고, 없으면 거래소 연결 창을 띄운다 (창은 거래소 연결 조각) */
export function acStart(ctx: { ex?: string | null; need?: string | null; after?: AcAfter } = {}) {
  if (!getState().user) {
    authOpen('signup');
    return;
  }
  if (acReady(getTf(), ctx.need || ctx.ex || null, Date.now())) {
    nav('#/trade');
    return;
  }
  window.location.href = legacy('#/trade');
}
/** tfShareHub(tab): 전략 복사 목록 (전략 복사 조각) */
export const tfShareHub = (_tab?: string) => nav('#/share');
/** tfBackToChat(): 새 전략 만들기는 채팅 홈에서 시작한다 */
export const tfBackToChat = () => goHome();
/** tfBrokersView(): 거래소 연결 (거래소 연결 조각). 원본에 주소가 따로 없어 AI 트레이딩 원본을 연다 */
export const tfBrokersView = () => {
  window.location.href = legacy('#/trade');
};
/** cpDetailGo(id): 복사한 전략 상세 (전략 복사 조각) */
export const cpDetailGo = (id: string) => nav('#/share/c/' + encodeURIComponent(id));
/** 백테스트 여정의 내 전략 (백테스트 조각) */
export const btMineGo = () => nav('#/share/bt/mine');
/** tfIns2Ask(q): 새 대화로 질문을 보낸다 (대화 조각). 대화 화면이 React 로 오기 전에는 질문을 들고 홈으로 간다 */
export const tfIns2Ask = (q: string) => {
  if (!getState().user) {
    authOpen('login');
    return;
  }
  setState({ pendingNew: q });
  goHome();
};
/** tfTmConnGo(): 거래소 연결하기. 검증을 통과한 초안이 있으면 연결 단계로, 아니면 거래소 연결 화면으로 */
export const tfTmConnGo = () => {
  const t = getTf();
  if (t.cur && t.score >= TFC.score.pass) nav('#/strategy/connect');
  else tfBrokersView();
};
