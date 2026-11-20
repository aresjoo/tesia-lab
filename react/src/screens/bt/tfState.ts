// 퍼널 상태(tfS)를 브라우저 저장소와 앱 상태에 잇는다. 모양과 규칙은 core/bt/tf.ts, core/bt/tfStore.ts.
import { tfDefault, type TfState } from '../../core/bt/tf';
import { TF_STORE_KEY, snapParse, snapWithTf, tfFromSnap } from '../../core/bt/tfStore';
import { getState } from '../../state/store';

let cache: TfState | null = null;
let cacheFor: string | null = null;
/** 마지막으로 읽거나 쓴 저장분의 tf 글자. 다른 조각(대화)이 저장소에 직접 쓴 것을 알아챈다 */
let seen: string | null = null;
const tfText = (raw: string | null) => {
  const p = snapParse(raw);
  return p ? JSON.stringify(p.tf || null) : null;
};

const read = () => {
  try {
    return localStorage.getItem(TF_STORE_KEY);
  } catch {
    return null;
  }
};

/** tfS(): 로그인한 사람의 퍼널 상태. 손님에게는 빈 상태를 준다(저장하지 않는다). */
export function tfS(): TfState {
  const u = getState().user;
  const who = u ? u.name : null;
  if (!cache || cacheFor !== who) {
    cacheFor = who;
    const raw = u ? read() : null;
    seen = tfText(raw);
    cache = u ? tfFromSnap(snapParse(raw)) : tfDefault();
  }
  return cache;
}
/** 화면에 들어올 때 부른다: 저장소의 tf 가 내가 아는 것과 다르면(대화 조각이 인테이크를 채웠으면) 다시 읽는다 */
export function tfRefresh(): void {
  if (!getState().user || !cache) return;
  if (tfText(read()) !== seen) cache = null;
}
/** tfSave(): 원본 STORE.save 는 700ms 뒤에 쓰지만 여기서는 바로 쓴다(새로고침 때 잃지 않게) */
export function tfSave(): void {
  const u = getState().user;
  if (!u || !cache) return;
  try {
    const next = snapWithTf(snapParse(read()), u, cache, Date.now());
    localStorage.setItem(TF_STORE_KEY, JSON.stringify(next));
    seen = JSON.stringify(next.tf || null);
  } catch {
    /* 저장 못 해도 화면은 그대로 쓴다 */
  }
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

/* 하려던 일 하나를 기억한다 (원본 tfIntentSet, tfIntentPeek, tfIntentClear) */
export interface Intent {
  kind: string;
  id?: string;
  from?: string;
  at?: number;
}
export function tfIntentSet(o: Intent): void {
  o.at = Date.now();
  try {
    sessionStorage.setItem('teth.intent', JSON.stringify(o));
  } catch {
    /* 무시 */
  }
}
export function tfIntentPeek(): Intent | null {
  let o: Intent | null = null;
  try {
    o = JSON.parse(sessionStorage.getItem('teth.intent') || 'null');
  } catch {
    /* 무시 */
  }
  return o && Date.now() - (o.at || 0) < 1800000 ? o : null;
}
export function tfIntentClear(): void {
  try {
    sessionStorage.removeItem('teth.intent');
  } catch {
    /* 무시 */
  }
}

/** tfIntentRun() 가운데 백테스트로 돌아가는 가지: 인증이 끝나면 한 번만 꺼내 그 자리로 간다. 다른 종류(copy, start, settings)는 그 화면을 맡은 조각이 잇는다 */
export function tfIntentRun(): boolean {
  const o = tfIntentPeek();
  if (!o || !getState().user || o.kind !== 'bt') return false;
  tfIntentClear();
  window.location.hash = '#/share/bt/' + o.id;
  return true;
}
