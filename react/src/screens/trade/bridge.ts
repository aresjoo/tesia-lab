// 다른 조각의 화면으로 넘어가는 문. 본 판에 옮겨진 화면은 그 진짜 함수를 부르고,
// 아직 옮기지 않은 화면(전략 복사)만 같은 주소의 원본(HTML 판)으로 보낸다(nav 가 PORTED 를 보고 가른다).
import { TFC } from '../../core/trade/state';
import { acStart as acStartFlow } from '../account/brokers/flow';
import { tfBackToChat as backToChat } from '../../state/back';
import { goHome, nav } from '../../state/route';
import { authOpen, getState, toast } from '../../state/store';
import { gNew, taiBusy } from '../../state/tai';
import { getTf } from './store';

export type AcAfter = { kind: 'terminal' } | { kind: 'copy'; id: string } | { kind: 'bt'; id: string };

/** acStart(ctx): 실행 환경이 이미 있으면 그대로 이어 가고, 없으면 거래소 연결 흐름(#/brokers)으로 */
export const acStart = (ctx: { ex?: string | null; need?: string | null; after?: AcAfter } = {}) => acStartFlow(ctx);
/** tfShareHub(tab): 전략 복사 목록 (전략 복사 조각, 아직 원본) */
export const tfShareHub = (_tab?: string) => nav('#/share');
/** tfBackToChat(): 주소를 지우고 보던 대화로, 없으면 홈 */
export const tfBackToChat = () => backToChat();
/** tfBrokersView(): 거래소 연결 */
export const tfBrokersView = () => nav('#/brokers');
/** cpDetailGo(id): 복사한 전략 상세 (전략 복사 조각, 아직 원본) */
export const cpDetailGo = (id: string) => nav('#/share/c/' + encodeURIComponent(id));
/** 백테스트 여정의 내 전략 */
export const btMineGo = () => nav('#/share/bt/mine');
/** tfIns2Ask(q): 늘 새 대화를 만들어 묻는다. 보던 대화는 사이드바에 그대로 둔다 */
export function tfIns2Ask(q: string) {
  if (!getState().user) {
    authOpen('login');
    return;
  }
  if (taiBusy()) {
    toast('이전 답변을 마무리하는 중입니다, 끝나면 다시 눌러주십시오');
    return;
  }
  goHome(true);
  gNew(q, q);
}
/** tfTmConnGo(): 거래소 연결하기. 검증을 통과한 초안이 있으면 연결 단계로, 아니면 거래소 연결 화면으로 */
export const tfTmConnGo = () => {
  const t = getTf();
  if (t.cur && t.score >= TFC.score.pass) nav('#/strategy/connect');
  else tfBrokersView();
};
