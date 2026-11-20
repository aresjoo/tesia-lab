// 앱 전체 상태 한 곳. 원본의 전역(S.user, GLC, G.mode)과 열림 닫힘 class 토글을 값으로 옮겼다.
import { useSyncExternalStore } from 'react';
import { isCur, isLang } from '../core/i18n';

export type AuthMode = 'login' | 'signup';
export type User = { name: string } | null;

export type AppState = {
  user: User;
  lang: string;
  cur: string;
  /** 데스크톱 사이드바 접힘 */
  sideCollapsed: boolean;
  /** 모바일 드로어 열림 */
  sideMobileOpen: boolean;
  banner: boolean;
  auth: { open: boolean; mode: AuthMode; seq: number };
  glcOpen: boolean;
  setMenu: { open: boolean; left?: number; bottom?: number };
  fbOpen: boolean;
  helpOpen: boolean;
  toast: { text: string; show: boolean };
  /** 손님이 보내려던 말. 가입이 끝나면 이어서 쓴다. */
  pendingNew: string | null;
  /** 지금 화면 (원본 G.mode): home, tfintro, tfdash, nfbot ... */
  mode: string;
};

const ls = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string | null) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* 저장 못 해도 화면은 그대로 쓴다 */
    }
  },
};
const ss = {
  get(k: string) {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      /* 무시 */
    }
  },
};

function readUser(): User {
  try {
    const v = JSON.parse(ls.get('teth.react.user') || 'null');
    return v && typeof v.name === 'string' ? { name: v.name } : null;
  } catch {
    return null;
  }
}

const savedLang = ls.get('tethLang');
const savedCur = ls.get('tethCurrency');

let state: AppState = {
  user: readUser(),
  lang: isLang(savedLang) ? savedLang : 'ko',
  cur: isCur(savedCur) ? savedCur : 'USD',
  sideCollapsed: true,
  sideMobileOpen: false,
  banner: !ss.get('tethBannerHide'),
  auth: { open: false, mode: 'signup', seq: 0 },
  glcOpen: false,
  setMenu: { open: false },
  fbOpen: false,
  helpOpen: false,
  toast: { text: '', show: false },
  pendingNew: null,
  mode: 'home',
};

const subs = new Set<() => void>();
export const getState = () => state;
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

/* ── 동작 (원본 전역 함수 이름을 주석에 적는다) ── */

/** toast(m): 떠 있는 동안 온 말은 셋까지 줄 세워 차례로 */
const toastQ: string[] = [];
let toastT: ReturnType<typeof setTimeout> | undefined;
export function toast(m: string) {
  if (state.toast.show) {
    if (toastQ.length < 3 && state.toast.text !== m) toastQ.push(m);
    return;
  }
  setState({ toast: { text: m, show: true } });
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    setState((s) => ({ toast: { ...s.toast, show: false } }));
    const next = toastQ.shift();
    if (next) setTimeout(() => toast(next), 240);
  }, 2200);
}

/** authOpen(mode) */
export function authOpen(mode: AuthMode = 'signup') {
  setState((s) => ({ auth: { open: true, mode, seq: s.auth.seq + 1 }, setMenu: { open: false } }));
}
export const authClose = () => setState((s) => ({ auth: { ...s.auth, open: false } }));

/** signupDone() */
export function signIn(name: string) {
  ls.set('teth.react.user', JSON.stringify({ name }));
  const login = state.auth.mode === 'login';
  setState((s) => ({ user: { name }, auth: { ...s.auth, open: false } }));
  toast(login ? '다시 만나서 반갑습니다' : '계정 준비 완료, 시장은 기다려주지 않습니다');
}
/** gLogout() */
export function logout() {
  ls.set('teth.react.user', null);
  setState({ user: null, pendingNew: null, setMenu: { open: false } });
  toast('로그아웃 완료, 다음에 또 만납니다');
}

export function setLang(c: string) {
  ls.set('tethLang', c);
  setState({ lang: c, glcOpen: false });
}
export function setCur(c: string) {
  ls.set('tethCurrency', c);
  setState({ cur: c, glcOpen: false });
}

/** tethBannerClose(): 이 탭 세션 동안만 숨김 */
export function bannerClose() {
  ss.set('tethBannerHide', '1');
  setState({ banner: false });
}

/** gSideToggle() */
export function sideToggle() {
  if (window.innerWidth <= 860) {
    if (state.sideMobileOpen) {
      setState({ sideMobileOpen: false });
      setTimeout(() => setState({ sideCollapsed: true }), 260);
    } else setState({ sideCollapsed: false, sideMobileOpen: true });
    return;
  }
  setState((s) => ({ sideCollapsed: !s.sideCollapsed }));
}
/** gSideMobClose() */
export function sideMobClose() {
  if (state.sideMobileOpen && window.innerWidth <= 860) sideToggle();
}
