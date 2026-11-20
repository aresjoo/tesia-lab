// 전략 위임 상태(S.tf)와 알림 조건, 답변 의견의 저장. 원본 STORE 의 'teth.state' 한 덩이를 그대로 쓴다.
// 이 판은 대화 기록을 따로 들고 있어(state/conv.ts), 여기서는 그 덩이에서 tf, alerts, fbLog 칸만 고쳐 쓴다.
import { tfDefault, type TfState } from '../core/tf/intake';
import { getState } from './store';

/** 원본 STORE 의 저장 키 */
export const TETH_STATE_KEY = 'teth.state';

type Snap = { v?: number; savedAt?: number; user?: { name: string; email: string }; tf?: TfState | null; alerts?: unknown[]; fbLog?: unknown[]; sessions?: unknown[]; [k: string]: unknown };
function read(): Snap {
  try {
    const p = JSON.parse(localStorage.getItem(TETH_STATE_KEY) || 'null');
    return p && typeof p === 'object' ? (p as Snap) : {};
  } catch {
    return {};
  }
}
function write(patch: Partial<Snap>) {
  const u = getState().user;
  if (!u) return; /* 원본 STORE.save 도 로그인 상태에서만 저장한다 */
  const cur = read();
  const next: Snap = { ...cur, ...patch, v: 1, savedAt: Date.now(), user: { name: u.name, email: (cur.user && cur.user.email) || '' } };
  if (!Array.isArray(next.sessions)) next.sessions = [];
  try {
    localStorage.setItem(TETH_STATE_KEY, JSON.stringify(next));
  } catch {
    /* 저장 못 해도 화면은 그대로 쓴다 */
  }
}

let tf: TfState | null = null;
/** 마지막으로 읽거나 쓴 저장분의 tf 글자. 다른 화면(백테스트 등)이 저장소에 쓴 것이나 로그아웃으로 지워진 것을 알아채 다시 읽는다 */
let seen: string | null = null;
/** tfS() */
export function tfS(): TfState {
  const saved = read().tf;
  const cur = JSON.stringify(saved ?? null);
  if (!tf || cur !== seen) {
    seen = cur;
    tf = saved && typeof saved === 'object' ? saved : tfDefault();
    /* 과거 저장분에 남은 결제 정보는 읽을 때 지운다 (원본 STORE.restore) */
    const pay = (tf as { pay?: Record<string, unknown> }).pay;
    if (pay) {
      delete pay.num;
      delete pay.exp;
      delete pay.nm;
    }
  }
  if (!tf.ob) tf.ob = { st: 'idle', ex: null, uid: '', err: null };
  return tf;
}
/** tfSave(). 다른 화면(원본)으로 넘어가기 직전에도 부르므로 미루지 않고 바로 쓴다 */
export function tfSave() {
  const t = tfS();
  write({ tf: t });
  if (getState().user) seen = JSON.stringify(t);
}
/** S.alerts 에 알림 조건 하나 (taiActDo 의 alert) */
export function pushAlert(a: { label: string; at: number; asset: string | null }) {
  const cur = read();
  write({ alerts: [...(Array.isArray(cur.alerts) ? cur.alerts : []), a].slice(-50) });
}
/** S.fbLog 에 답변 의견 하나 (taiFbPick) */
export function pushFeedback(f: { at: number; reason: string; q: string }) {
  const cur = read();
  write({ fbLog: [...(Array.isArray(cur.fbLog) ? cur.fbLog : []), f].slice(-50) });
}
/** 로그아웃: 저장된 상태를 지운다 (gLogout) */
export function tfClear() {
  tf = null;
  try {
    localStorage.removeItem(TETH_STATE_KEY);
  } catch {
    /* 무시 */
  }
}
