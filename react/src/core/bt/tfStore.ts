// 퍼널 상태를 저장하고 읽는 모양 (원본 STORE.snapshot, STORE.restore 가운데 tf 에 관한 것).
// 원본과 같은 저장 키, 같은 모양이다: localStorage['teth.state'] = { v:1, savedAt, user:{name,email}, tf, sessions, ... }
import { tfNormalize, type TfState } from './tf';

export const TF_STORE_KEY = 'teth.state';

export interface TethSnapshot {
  v: number;
  savedAt?: number;
  user?: { name: string; email?: string };
  tf?: TfState | null;
  sessions?: unknown[];
  [k: string]: unknown;
}

export function snapParse(raw: string | null): TethSnapshot | null {
  try {
    const p = JSON.parse(raw || 'null');
    return p && p.v ? (p as TethSnapshot) : null;
  } catch {
    return null;
  }
}
/** 저장분에서 tf 를 꺼낸다 (결제 민감정보는 원본처럼 읽을 때 지운다) */
export function tfFromSnap(p: TethSnapshot | null): TfState {
  const t = tfNormalize(p && p.tf ? p.tf : null);
  const pay = t.pay as Record<string, unknown> | undefined;
  if (pay) {
    delete pay.num;
    delete pay.exp;
    delete pay.nm;
  }
  return t;
}
/** tf 를 끼워 넣은 새 저장분. 다른 칸(대화 기록 등)은 그대로 둔다 */
export function snapWithTf(prev: TethSnapshot | null, user: { name: string; email?: string }, tf: TfState, now: number): TethSnapshot {
  const base: TethSnapshot = prev || { v: 1, sessions: [] };
  return { ...base, v: 1, savedAt: now, user: { name: user.name, email: (prev && prev.user && prev.user.email) || user.email || '' }, tf: JSON.parse(JSON.stringify(tf)) };
}
