// 전략 복사 화면의 상태. 저장은 원본과 같은 자리, 같은 모양이다: localStorage['teth.state'].tf 의 ss, watch, cp, api, ac 칸.
// 앱에 하나뿐인 전략 상태(core/account/tf.ts 의 tfS(), tfSave())를 읽고 쓰는 얇은 층이다. 저장하지 않는 것(검색어, 열린 복사 창)만 여기 따로 든다.
import { useSyncExternalStore } from 'react';
import type { Copy } from '../core/copy';
import { acConnList, acConnOk } from '../core/account/ac';
import { tfS, tfSave, tfSubscribe, tfVersion, type Tf } from '../core/account/tf';
import { getState } from './store';

export type ShareSS = { sort: string; dir: string; kind: string; asset: string; page: number; pgSig?: string; pd: string; tab?: string; v?: number; risk?: string };
export type ShareState = {
  /** 목록 조작 값 (t.ss) */
  ss: ShareSS;
  /** 검색어 (TF_SS_Q). 저장하지 않는다 */
  q: string;
  /** 즐겨찾기한 전략 이름 (t.watch) */
  watch: string[];
  /** 전략 복사 계정 (t.cp). 데모 잔고 $1000 에서 시작 */
  cp: { v: number; spot: number; copies: Copy[] };
  /** 주문 권한까지 연결된 거래소 (t.api.ex). 거래소 연결 화면(#/brokers)이 채운다. 없으면 복사 창 대신 연결로 간다 */
  apiEx: string | null;
  /** 「내 거래소」 알약에 쓰는 연결한 거래소 (tfMyExConn) */
  myExConn: string[];
  /** 「내 거래소」 거르기 (tfMyExGet): '' 꺼짐, 'all' 연결한 거래소 전체, 아니면 거래소 하나. localStorage['teth.myex'] */
  myEx: string;
  /** 복사 설정 창이 열린 전략 id (cpSetupGo). 저장하지 않는다 */
  follow: string | null;
};

/* 앱이 뜰 때의 회원으로 S.tf 를 읽고 로그인과 로그아웃을 따라가는 일은 screens/account/session.ts 한 곳이 한다 (main.tsx 가 맨 먼저 읽는다) */

/** tfSSState() + mkSortKey(t): 옛 저장분(v 가 3 이 아님)은 목록 조작 값을 처음으로 되돌린다 */
function tfSSState(t: Tf): ShareSS {
  const ss = ((t.ss as ShareSS | undefined) || (t.ss = { tab: 'find', sort: 'ret', asset: 'all' })) as ShareSS;
  if (ss.v !== 3) Object.assign(ss, { v: 3, sort: 'pick', dir: 'desc', kind: 'all', asset: 'all', risk: 'all', pd: 'all' });
  if (!{ pick: 1, ret: 1, fw: 1, win: 1 }[ss.sort]) ss.sort = 'pick';
  return ss;
}
/** cpState() */
function cpState(t: Tf): ShareState['cp'] {
  let cp = t.cp as ShareState['cp'] | null | undefined;
  if (!cp) cp = t.cp = { v: 1, spot: 1000, copies: [] }; /* 데모 스팟 잔고 $1000 시드 */
  if (!Array.isArray(cp.copies)) cp.copies = [];
  if (cp.spot == null) cp.spot = 1000;
  return cp;
}
/** tfMyExConn(): 회원이고 쓸 수 있게 연결한 거래소 */
function myExConn(): string[] {
  if (!getState().user) return [];
  return acConnList().filter((k) => acConnOk(k));
}

const MYEX_KEY = 'teth.myex';
const lsGet = (k: string): string => {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
};
const local: { q: string; follow: string | null; myex: string } = { q: '', follow: null, myex: lsGet(MYEX_KEY) };
/** tfMyExGet() */
function myExGet(conn: string[]): string {
  if (!conn.length) return '';
  let v = local.myex;
  if (v && v !== 'all' && conn.indexOf(v) < 0) v = 'all';
  return v;
}
/** tfMyExIds() */
export function myExIds(s: ShareState): string[] {
  return !s.myEx ? [] : s.myEx === 'all' ? s.myExConn : [s.myEx];
}
/** tfMyExSet(v): 켠 상태는 이 브라우저에 기억. 1쪽으로 */
export function myExSet(v: string) {
  try {
    if (v) localStorage.setItem(MYEX_KEY, v);
    else localStorage.removeItem(MYEX_KEY);
  } catch {
    /* 무시 */
  }
  local.myex = v;
  setSS({ page: 1 });
}
let snap: ShareState | null = null;
let snapVer = -1;
function build(): ShareState {
  const t = tfS();
  const ss = tfSSState(t);
  const api = t.api as { ex?: string } | null;
  const apiEx = (api && api.ex) || null;
  const conn = myExConn();
  return {
    ss: { ...ss, dir: ss.dir || 'desc', kind: ss.kind || 'all', asset: ss.asset || 'all', page: ss.page || 1, pd: ss.pd || 'all' },
    q: local.q,
    watch: Array.isArray(t.watch) ? (t.watch as string[]) : [],
    cp: cpState(t),
    apiEx,
    myExConn: conn,
    myEx: myExGet(conn),
    follow: local.follow,
  };
}
export const getShare = (): ShareState => {
  const v = tfVersion();
  if (!snap || snapVer !== v) {
    snap = build();
    snapVer = v;
  }
  return snap;
};

const subs = new Set<() => void>();
/** 고친 값을 S.tf 에 옮겨 적고 tfSave() 한다 (회원일 때만 저장된다). 검색어와 복사 창은 저장하지 않는다 */
export function setShare(patch: Partial<ShareState> | ((s: ShareState) => Partial<ShareState>)) {
  const p = typeof patch === 'function' ? patch(getShare()) : patch;
  if ('q' in p) local.q = p.q || '';
  if ('follow' in p) local.follow = p.follow ?? null;
  const t = tfS();
  let dirty = false;
  if (p.ss) {
    t.ss = { ...tfSSState(t), ...p.ss };
    dirty = true;
  }
  if (p.watch) {
    t.watch = p.watch;
    dirty = true;
  }
  if (p.cp) {
    t.cp = p.cp;
    dirty = true;
  }
  snap = null;
  if (dirty) tfSave();
  subs.forEach((f) => f());
}
export function setSS(patch: Partial<ShareSS>) {
  setShare((s) => ({ ss: { ...s.ss, ...patch } }));
}
const subscribe = (f: () => void) => {
  subs.add(f);
  const un = tfSubscribe(f);
  return () => {
    subs.delete(f);
    un();
  };
};
export function useShare<T>(sel: (s: ShareState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(getShare()));
}
