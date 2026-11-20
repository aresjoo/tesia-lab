// 해시 화면(백테스트, 인사이트, 트레이딩 ...)과 대화 사이를 잇는다 (원본 tfPageMode, tfNFView 의 G.cur=null 과 tfBackToChat).
import { G, gHome, gSelect } from './conv';
import { goHome, takeHomeIntent } from './route';

/** 해시 화면으로 들어오기 전에 보던 대화 (원본 TF_SS_PREV, TF_INS_PREV) */
let prev: string | null = null;

const pick = () => (prev && G.sessions.find((s) => s.id === prev)) || G.sessions[0] || null;

/** 해시 화면에 들어왔다: 보던 대화를 기억하고 닫는다 */
export function routedEnter() {
  takeHomeIntent();
  if (G.cur) prev = G.cur.id;
  if (G.cur || G.mode !== 'home') gHome();
}

/** 해시 화면에서 나왔다. 브라우저 뒤로가기로 나왔으면 보던 대화로 돌아간다 (원본 tfRoute 의 tfBackToChat). 단추로 홈이나 다른 대화를 골랐으면 그대로 둔다 */
export function routedLeave() {
  if (takeHomeIntent()) return;
  const sx = pick();
  prev = null;
  if (sx) gSelect(sx.id);
}

/** tfBackToChat(): 주소를 지우고 보던 대화(없으면 가장 최근 대화)로. 대화가 없으면 홈 */
export function tfBackToChat() {
  const sx = pick();
  prev = null;
  if (window.location.hash) goHome();
  if (sx) gSelect(sx.id);
  else gHome();
}
