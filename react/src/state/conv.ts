// 대화 목록과 지금 열린 대화 (원본 G.sessions, G.cur, G.mode), 저장(STORE 의 localStorage 쪽), 아래 따라가기 스크롤.
// 원본은 DOM 을 바로 고쳤다. 여기서는 값을 고치고 sync() 로 화면을 그 자리에서 다시 그린다(스크롤 계산이 바로 뒤따르기 때문).
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { aiOf, type AskStep, type ChartInfo, type Item, type Ohlc, type Session } from '../core/tai/types';
import { goHome } from './route';
import { getState, sideMobClose, toast } from './store';

export type Mode = 'home' | 'conv' | 'activity' | 'history';
/** 입력창 위 질문 패널의 상태 (원본 TAI.qcfg[id]) */
export type AskState = { id: string; steps: AskStep[]; idx: number; picks: number[][]; free: string[]; freeOn: number | null };

export const G: {
  sessions: Session[];
  cur: Session | null;
  mode: Mode;
  /** 사용자가 위로 올려 읽는 중이면 false (아래 따라가기를 멈춘다) */
  stick: boolean | undefined;
  autoAt: number;
  /** 보낸 말을 화면 위로 올리려고 대화 끝에 두는 빈 자리 높이. 없으면 null */
  spacer: number | null;
  newmsg: boolean;
  ask: AskState | null;
  /** 질문 패널이 들어갈 빈 틀만 먼저 놓인 상태 (원본 skaDock 직후) */
  askDock: boolean;
  /** 스크립트 질문의 지금 단계 (원본 gStep) */
  step: string | null;
  /** 입력창에 채워 넣을 글과 안내문 */
  fill: { text: string | null; focus: boolean; seq: number } | null;
  /** 홈 입력창에 치다 만 글 (로그인하면 이어 보낸다. 원본 AUTH.draft) */
  homeDraft: (() => { text: string; typed: string } | null) | null;
  placeholder: string | null;
  /** 홈 입력창이 아래로 떨어지는 동안 진짜 입력창을 가린다 */
  dropFly: boolean;
  /** 차트와 시세의 화면용 거울 (원본 TAI.chart, TAI.ohlc) */
  chart: ChartInfo | null;
  ohlc: Ohlc | null;
  /** 차트 위젯을 다시 그리라는 표시 */
  chartRev: number;
} = { sessions: [], cur: null, mode: 'home', stick: undefined, autoAt: 0, spacer: null, newmsg: false, ask: null, askDock: false, step: null, fill: null, homeDraft: null, placeholder: null, dropFly: false, chart: null, ohlc: null, chartRev: 0 };

let ver = 0;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
/** 값이 바뀌었다고 알린다 (다음 틱에 그려도 되는 곳) */
export function bump() {
  ver++;
  subs.forEach((f) => f());
}
/** 값이 바뀌었고 화면이 지금 바로 따라와야 한다 (바로 뒤에 높이를 재는 곳) */
export function sync() {
  try {
    flushSync(bump);
  } catch {
    bump();
  }
}
export function useConv(): number {
  return useSyncExternalStore(subscribe, () => ver);
}

let idSeq = 0;
export const nid = (p: string) => p + Date.now().toString(36) + ++idSeq;

/* ── 저장 (STORE). 서버 파일 저장은 뒤에 붙인다 ── */
const KEY = 'teth.react.sessions';
/**
 * 원본은 대화 기록을 처음 넣은 HTML 로 들고 있어서, 화면에서만 바뀐 것(투표 표시, 차트 머리줄의 가격, 저장된 알림 단추,
 * 「질문에 답했습니다」로 바뀐 안내 줄)은 대화를 다시 열면 처음 모습으로 돌아간다. 같은 것을 여기서 되돌린다.
 */
export function viewReset(it: Item) {
  if (it.k === 'ai') {
    delete it.vote;
    if (it.gauge) it.gauge.anim = false;
  } else if (it.k === 'chart') {
    it.px = null;
    delete it.fc;
    it.pip = null;
  } else if (it.k === 'asknote') it.done = false;
  else if (it.k === 'next')
    it.rows.forEach((r) => {
      if (r.t === 'a') delete r.saved;
    });
}
/** 기록에 남지 않는 줄: 「다시 보내기」 단추는 원본도 화면에만 붙인다 */
export const kept = (it: Item) => !(it.k === 'chip' && it.go === 'offretry');
/** 저장할 때도 같은 것을 뺀다 */
function cleanItem(it: Item): Item {
  const c: Item = it.k === 'next' ? { ...it, rows: it.rows.map((r) => ({ ...r })) } : it.k === 'ai' && it.gauge ? { ...it, gauge: { ...it.gauge } } : { ...it };
  viewReset(c);
  if (c.k === 'ai') {
    delete c.live;
    delete c.fresh;
  }
  return c;
}
let saveT: ReturnType<typeof setTimeout> | undefined;
export const STORE = {
  /** STORE.save(): 0.7초 모아서 쓴다 */
  save() {
    if (!getState().user) return;
    clearTimeout(saveT);
    saveT = setTimeout(STORE.flushNow, 700);
  },
  snapshot() {
    return {
      v: 1,
      savedAt: Date.now(),
      lastSid: (G.cur && G.cur.id) || null,
      sessions: G.sessions.slice(0, 20).map((sx) => ({ ...sx, items: sx.items.filter(kept).map(cleanItem), thread: sx.thread.filter(kept).map(cleanItem) })),
    };
  },
  flushNow(): boolean {
    clearTimeout(saveT);
    if (!getState().user) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(STORE.snapshot()));
      return true;
    } catch {
      return false;
    }
  },
  /** STORE.restore(p) */
  load(): string | null {
    if (!getState().user) return null;
    let p: { v?: number; lastSid?: string | null; sessions?: Session[] } | null = null;
    try {
      p = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      p = null;
    }
    if (!p || !p.v) return null;
    (p.sessions || []).forEach((sx) => {
      if (sx.status === 'run') sx.status = 'stopped';
      sx.tabs = sx.tabs || [{ id: '__act', title: '대화' }];
      sx.items = sx.items || [];
      sx.thread = sx.thread || [];
      sx.acts = sx.acts || {};
      G.sessions.push(sx);
    });
    return p.lastSid || null;
  },
  clear() {
    clearTimeout(saveT);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* 무시 */
    }
  },
};
/* 다른 화면(원본)으로 넘어가기 전에 모아 둔 저장을 마친다 */
window.addEventListener('pagehide', () => {
  if (saveT) STORE.flushNow();
});

/* ── 아래 따라가기 (gScrollRef, gScrollAttach, gScrollBottom, gUserPin, taiSpacerTrim) ── */
const $ = (id: string) => document.getElementById(id);
function gScrollRef(s: HTMLElement): number {
  const sp = $('g-spacer');
  return sp && sp.parentNode ? sp.offsetTop : s.scrollHeight;
}
const tracked = new WeakSet<HTMLElement>();
const lastST = new WeakMap<HTMLElement, number>();
function gScrollAttach(s: HTMLElement) {
  if (tracked.has(s)) return;
  tracked.add(s);
  s.addEventListener(
    'scroll',
    () => {
      const st = s.scrollTop;
      const prev = lastST.get(s);
      lastST.set(s, st);
      if (Date.now() - G.autoAt < 140) return; /* 프로그램이 움직인 스크롤은 의도로 보지 않는다 */
      if (G.mode !== 'conv' && G.mode !== 'activity') return;
      const gap = gScrollRef(s) - st - s.clientHeight;
      if (prev != null && st < prev - 2 && gap > 60) G.stick = false;
      else if (gap < 40) {
        G.stick = true;
        if (G.newmsg) {
          G.newmsg = false;
          bump();
        }
      }
    },
    { passive: true },
  );
  /* gBoot: 바닥 근처면 「새 응답 보기」를 숨긴다 */
  s.addEventListener('scroll', () => {
    if (s.scrollHeight - s.scrollTop - s.clientHeight < 60 && G.newmsg) {
      G.newmsg = false;
      bump();
    }
  });
}
/** gScrollBottom(force) */
export function gScrollBottom(force?: boolean) {
  const s = $('g-scroll');
  if (!s) return;
  gScrollAttach(s);
  if (force) G.stick = true;
  if (G.stick !== false) {
    const top = Math.max(0, gScrollRef(s) - s.clientHeight + 24);
    if (Math.abs(s.scrollTop - top) > 1) {
      G.autoAt = Date.now();
      s.scrollTop = top;
    }
    if (G.newmsg) {
      G.newmsg = false;
      sync();
    }
  } else if (!G.newmsg && (G.mode === 'conv' || G.mode === 'activity')) {
    G.newmsg = true;
    sync();
  }
}
const reduced = () => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
/** gUserPin(): 보낸 말을 화면 위로 올리고 아래에 답이 들어올 자리를 둔다 */
export function gUserPin() {
  const th = $('g-thread');
  const s = $('g-scroll');
  if (!th || !s) return;
  G.spacer = Math.max(0, s.clientHeight - 170);
  sync();
  const rows = th.querySelectorAll<HTMLElement>('.g-urow,.g-usum');
  const last = rows[rows.length - 1];
  if (last) {
    const top = Math.max(0, last.offsetTop - 10);
    if (reduced()) s.scrollTop = top;
    else s.scrollTo({ top, behavior: 'smooth' });
  }
}
/** taiSpacerTrim(): 답이 끝나면 남는 빈 자리를 줄인다 */
export function taiSpacerTrim() {
  const s = $('g-scroll');
  const sp = $('g-spacer');
  if (!s || !sp || !sp.parentNode || G.spacer == null) return;
  const cur = G.spacer;
  if (cur <= 0) return;
  const th = sp.parentNode as HTMLElement;
  const rows = th.querySelectorAll<HTMLElement>('.g-urow,.g-usum');
  const last = rows[rows.length - 1];
  const anchor = last ? last.offsetTop : sp.offsetTop;
  const need = s.clientHeight - (sp.offsetTop - anchor) - 24;
  G.spacer = Math.max(0, Math.min(cur, need));
  sync();
}
/** gContent 가 화면을 갈 때마다 하던 것: 스크롤을 맨 위로 */
function resetScroll() {
  const s = $('g-scroll');
  if (s) s.scrollTop = 0;
  try {
    window.scrollTo(0, 0);
  } catch {
    /* 무시 */
  }
}

/* ── 대화 줄 ── */
/** 지금 화면이 이 대화의 대화 줄을 보여 주는가 */
export const isLive = (sx: Session) => G.cur === sx && G.mode === 'conv';
/** gThreadAdd / taiThreadAdd: 대화 화면이면 대화 줄에, 아니면 문서 쪽 기록에 놓는다 */
export function threadAdd<T extends Item>(sx: Session, it: T): T {
  if (G.mode === 'conv' || G.cur !== sx) sx.items.push(it);
  else sx.thread.push(it);
  if (G.cur === sx) {
    sync();
    gScrollBottom();
  }
  STORE.save();
  return it;
}
/** taiRecFix(id,null): 기록에서 항목 하나를 뺀다 */
export function threadDrop(sx: Session, id: string) {
  const n = sx.items.length + sx.thread.length;
  sx.items = sx.items.filter((x) => x.id !== id);
  sx.thread = sx.thread.filter((x) => x.id !== id);
  if (n !== sx.items.length + sx.thread.length) {
    sync();
    STORE.save();
  }
}
/** 같은 자리에서 다른 항목으로 바꾼다 (outerHTML 교체) */
export function threadSwap(sx: Session, id: string, it: Item) {
  for (const list of [sx.items, sx.thread]) {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list[i] = it;
  }
  sync();
  STORE.save();
}

/* ── 화면 고르기 ── */
/** taiBind(sx): 차트와 시세 거울을 이 대화 것으로 */
export function taiBind(sx: Session | null) {
  const ai = sx ? aiOf(sx) : null;
  G.chart = ai ? ai.chart : null;
  G.ohlc = ai ? ai.ohlc : null;
}
type Hooks = { onShowConv?: (sx: Session) => void; onLeave?: () => void };
export const hooks: Hooks = {};

/** gShowConv() */
export function gShowConv() {
  const sx = G.cur;
  if (!sx) return;
  G.mode = 'conv';
  G.spacer = null;
  G.newmsg = false;
  G.step = sx.step || null;
  sideMobClose();
  hooks.onShowConv?.(sx);
  sync();
  resetScroll();
  gScrollBottom(true);
}
/** gShowActivity(): 「대화」 탭을 누르면 연구 과정 화면으로 간다 */
export function gShowActivity() {
  const sx = G.cur;
  if (!sx) return;
  G.mode = 'activity';
  if (sx.tabs.length && sx.tabs[0].id === '__act') sx.tabs[0].title = 'Activity';
  G.spacer = null;
  sideMobClose();
  sync();
  resetScroll();
}
/** gSelect(id) */
export function gSelect(id: string) {
  const sx = G.sessions.find((s) => s.id === id);
  if (!sx) return;
  if (window.location.hash) goHome();
  G.cur = sx;
  taiBind(sx);
  sx.tabs = sx.tabs || [{ id: '__act', title: '대화' }];
  if (sx.status === 'draft') gShowConv();
  else gShowActivity();
}
/** gHome() */
export function gHome() {
  G.cur = null;
  G.mode = 'home';
  G.chart = null;
  G.ohlc = null;
  G.spacer = null;
  G.newmsg = false;
  hooks.onLeave?.();
  sync();
  resetScroll();
  sideMobClose();
}
/** gHistory() */
export function gHistory() {
  if (window.location.hash) goHome();
  G.cur = null;
  G.mode = 'history';
  G.spacer = null;
  G.newmsg = false;
  sync();
  resetScroll();
  sideMobClose();
}

/* ── 사이드바 세션 줄의 ⋮ 메뉴와 머리줄 ⋮ 메뉴 ── */
/** gRowPin(id) */
export function gRowPin(id: string) {
  const sx = G.sessions.find((s) => s.id === id);
  if (!sx) return;
  sx.pinned = !sx.pinned;
  bump();
  STORE.flushNow();
}
/** gRowRenameGo(id), gTitleEdit 의 저장 */
export function gRename(id: string, v: string) {
  const sx = G.sessions.find((s) => s.id === id);
  v = v.trim();
  if (!sx || !v) return;
  sx.title = v;
  bump();
  STORE.flushNow();
}
/** gSessRenameGo(): 머리줄 ⋮ 메뉴의 이름 바꾸기. 전략 이름도 함께 바꾼다 */
export function gSessRenameGo(v: string) {
  const sx = G.cur;
  v = (v || '').trim();
  if (!sx || !v) return false;
  v = v.replace(/[<>]/g, '');
  sx.title = v;
  if (sx.strategy) sx.strategy.name = v;
  bump();
  STORE.save();
  toast('이름을 바꿨습니다');
  return true;
}
/** gRowDeleteGo(id) */
export function gRowDeleteGo(id: string) {
  const sx = G.sessions.find((s) => s.id === id);
  if (!sx) return;
  const wasCur = G.cur === sx;
  G.sessions = G.sessions.filter((s) => s.id !== id);
  STORE.flushNow();
  toast('삭제했습니다');
  if (wasCur) gHome();
  else bump();
}
/** gSessDelete() 의 두 번째 누름 */
export function gSessDeleteGo() {
  const sx = G.cur;
  if (!sx) return;
  G.sessions = G.sessions.filter((x) => x !== sx);
  STORE.save();
  toast('전략을 삭제했습니다');
  gHome();
}

/** gLogout 의 대화 쪽: 메모리에 남은 대화도 지운다 */
export function convReset() {
  G.sessions = [];
  G.cur = null;
  G.ask = null;
  G.step = null;
  STORE.clear();
  gHome();
}

/* 시작: 저장된 대화를 읽고, 마지막에 보던 대화로 돌아간다 (gBoot) */
const lastSid = STORE.load();
if (lastSid && !window.location.hash.replace(/^#\/?$/, '')) {
  const sx = G.sessions.find((x) => x.id === lastSid);
  if (sx) {
    G.cur = sx;
    taiBind(sx);
    G.mode = sx.status === 'draft' ? 'conv' : 'activity';
    G.step = sx.step || null;
  }
}
/** 입력창의 글을 바꾸거나(text) 그대로 두고(null) 포커스를 준다 */
export function fillInput(text: string | null, focus: boolean) {
  G.fill = { text, focus, seq: (G.fill ? G.fill.seq : 0) + 1 };
  bump();
}
