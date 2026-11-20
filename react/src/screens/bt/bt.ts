// 백테스트 화면의 상태와 동작 (원본 전역 BT 와 bt* 함수의 동작 부분).
// 원본은 id 로 DOM 을 직접 고치지만, 여기서는 같은 값을 상태에 두고 부품이 그린다.
import { useSyncExternalStore } from 'react';
import { BT_SYS_J, BT_SYS_R, PRICE0, mkHook, mkPct0, mkSign, mkTk } from '../../core/bt/engine';
import { btFactsAt, btJKey, btReadFacts, btReadKey } from '../../core/bt/ai';
import {
  BT_PER,
  btAi,
  btChkTxt,
  btCompute,
  btCount,
  btDecList,
  btDefFilt,
  btGate,
  btHolding,
  btLatest,
  btPerL,
  btRowAt,
  btTradeOf,
  btUsd,
  btYMD,
  tfSS3Rid,
  type BtR,
  type Dec,
  type Stop,
} from '../../core/bt/compute';
import { btMineDone, type TfState } from '../../core/bt/tf';
import type { Strat } from '../../core/bt/engine';
import { nav } from '../../state/route';
import { authOpen, getState } from '../../state/store';
import { acEx, acReady } from './ac';
import { btAiCall } from './tai';
import { tfIntentSet, tfS, tfSave, tfTrack } from './tfState';
import { tfBackToChat } from '../../state/back';

export type Phase = 'ready' | 'run' | 'result';
export type Sel = { t: 'd' | 'e'; ix: number; j: number } | { t: 't'; id: number; j: number };
export interface StepView {
  cls: string;
  ic: '' | 'ok' | 'run';
  evd: string;
}
export interface BtState {
  id: string | null;
  s: Strat | null;
  per: number;
  amt: number;
  phase: Phase;
  R: BtR | null;
  sel: Sel | null;
  filt: string | null;
  trf: string;
  grp: { a: number; b: number } | null;
  ordN: number;
  decN: number;
  sort: string;
  /* 아래는 원본이 DOM 에 직접 써 두던 값 */
  /** 그래프를 다시 재고 그릴 때마다 오른다 (btChartDraw) */
  draw: number;
  /** 범례의 시작 금액: 화면을 처음 그릴 때의 금액이 남는다 (원본 btPage 가 한 번만 그린다) */
  legAmt: number;
  /** 범례의 비교 수익률 */
  legBench: string;
  cap: { k: string; v: string; p: string; sg: string };
  head: { dot: string; date: string; state: string; last: string };
  /** 판단 패널: init 이 오르면 처음 모양으로 */
  panel: { init: number; rest: boolean; sum: 0 | 1 | 2; st: Stop | null; stage: number; dataSt: boolean };
  /** 오른쪽 칸을 다시 그릴 때마다 오른다 (접힘 상태가 처음으로 돌아간다) */
  rail: number;
  steps: Record<string, StepView>;
  feed: Dec[];
  feedShown: boolean;
  /** 커서와 지나온 날 (btCursor). null 이면 그린 그대로 */
  vj: number | null;
  marksJ: number;
  ddJ: number;
  pulseJ: number | null;
  cur: boolean;
  pj: { hidden: boolean; cls: string; label: string; text: string };
  /** 모델 답이 바뀔 때마다 오른다 */
  ai: number;
  /** 같은 주소로 다시 들어가라는 표시 (규칙을 되돌린 뒤) */
  route: number;
}

const st0 = (): BtState => ({
  id: null,
  s: null,
  per: 365,
  amt: 1000,
  phase: 'ready',
  R: null,
  sel: null,
  filt: null,
  trf: 'all',
  grp: null,
  ordN: 8,
  decN: 8,
  sort: 'new',
  draw: 0,
  legAmt: 1000,
  legBench: '',
  cap: { k: '', v: '', p: '', sg: '' },
  head: { dot: 'idle', date: '', state: '', last: '' },
  panel: { init: 0, rest: false, sum: 0, st: null, stage: -1, dataSt: false },
  rail: 0,
  steps: {},
  feed: [],
  feedShown: false,
  vj: null,
  marksJ: -1,
  ddJ: -1,
  pulseJ: null,
  cur: false,
  pj: { hidden: true, cls: 'pj', label: 'TETH의 판단', text: '' },
  ai: 0,
  route: 0,
});

/** 원본 var BT */
export let BT: BtState = st0();
const subs = new Set<() => void>();
function set(p: Partial<BtState>) {
  BT = { ...BT, ...p };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export function useBt<T>(sel: (s: BtState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(BT));
}

/** 백테스트 화면이 붙어 있는가 (원본의 $('bt-root') 확인) */
let MOUNTED = false;
export const btMounted = (v: boolean) => {
  MOUNTED = v;
  if (!v) btStop();
};

/* 재생하는 동안만 쓰는 값 (원본 BT.raf, t0, ph, j, stg, fed, seg, pause, pt, lastSt) */
const RUN = { raf: 0, t0: 0, ph: -1, j: -2, stg: -1, fed: 0, seg: 0, pause: 0, pt: 0, lastSt: null as Stop | null };
/** 모델 답의 기억 (원본 BT_AI) */
export interface JState {
  st: 'load' | 'ok' | 'fail';
  t: string;
  err?: string;
  q: ((J: JState) => void)[];
}
export interface ReadState {
  st: 'load' | 'ok' | 'fail';
  t?: string;
  err?: string;
}
export const BT_AI: { J: Record<string, JState>; R: Record<string, ReadState>; ty: number; wt: number } = { J: {}, R: {}, ty: 0, wt: 0 };
export const BT_PAGE = 12;

const ctx = () => ({ id: BT.id, s: BT.s as Strat, per: BT.per, amt: BT.amt });
const reduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/* ── 준비 ── */
/** btSub() */
export const btSub = (per: number, amt: number) => btPerL(per) + ', ' + btUsd(amt) + '로 시작';
/** btCap(k,v,p,sg) */
const cap = (k: string, v: string, p = '', sg = '') => ({ k, v, p, sg });

/** btReady() */
export function btReady() {
  btStop();
  const s = BT.s as Strat;
  const R = btCompute({ s, per: BT.per, amt: BT.amt });
  set({
    phase: 'ready',
    sel: null,
    grp: null,
    trf: 'all',
    R,
    filt: btDefFilt(s),
    cur: false,
    draw: BT.draw + 1,
    legBench: '' /* 비교 수익률은 결과에서만 */,
    cap: cap('시작 금액', btUsd(BT.amt)),
    head: { dot: 'idle', date: '', state: btAi(s) ? '다시 돌리는 동안 ' + (s.kind === 'agent' ? 'AI가 판단할 때마다' : '기회가 생길 때마다') + ' 확인 과정이 여기에 보입니다' : '다시 돌리는 동안 사는 조건이 맞을 때마다 여기에 보입니다', last: '' },
    panel: { init: BT.panel.init + 1, rest: false, sum: 0, st: null, stage: -1, dataSt: false },
    pj: { hidden: true, cls: 'pj', label: 'TETH의 판단', text: '' },
    rail: BT.rail + 1,
    vj: null,
    marksJ: -1,
    ddJ: -1,
    pulseJ: null,
  });
}
/** btSaveSet() */
function btSaveSet() {
  try {
    const t = tfS();
    t.bt = t.bt || {};
    t.bt.per = BT.per;
    t.bt.amt = BT.amt;
    t.bt.id = BT.id;
    t.bt.done = 0;
    tfSave();
  } catch {
    /* 무시 */
  }
}
/** btSetPer(v) */
export function btSetPer(v: number) {
  set({ per: v });
  btSaveSet();
  btReady();
}
/** btSetAmt(v) */
export function btSetAmt(v: number) {
  set({ amt: v });
  btSaveSet();
  btReady();
}

/* ── 다시 돌리기 ── */
function step(id: string, st: string, evd?: string) {
  const cur = BT.steps[id] || { cls: '', ic: '', evd: '' };
  const next: StepView = { cls: st, ic: cur.cls !== st ? (st === 'ok' ? 'ok' : st === 'run' ? 'run' : cur.ic) : cur.ic, evd: evd != null ? evd : cur.evd };
  if (next.cls === cur.cls && next.ic === cur.ic && next.evd === cur.evd) return;
  set({ steps: { ...BT.steps, [id]: next } });
}
function head(dot: string, date: string, state: string, last: string) {
  const h = BT.head;
  if (h.dot === dot && h.date === date && h.state === state && h.last === last) return;
  set({ head: { dot, date, state, last } });
}
/** btFeed(j,decided): 끝난 판단의 짧은 기록. 새것이 위로, 다섯 줄까지 */
function feed(j: number, decided: boolean) {
  const R = BT.R as BtR;
  const add: Dec[] = [];
  while (RUN.fed < R.D.length) {
    const d = R.D[RUN.fed];
    if (d.j > j) break;
    if (d.j === j && !decided) break;
    RUN.fed++;
    if (d.k === 'pick' || d.k === 'hold') continue;
    add.unshift(d);
  }
  if (!add.length) return;
  set({ feed: add.concat(BT.feed).slice(0, 5), feedShown: true });
}
/** btLastTxt(): 패널은 살지 말지의 판단을 담는다. 매도는 기록 줄에 남는다 */
function lastTxt() {
  const st = RUN.lastSt;
  return st ? ((BT.s as Strat).kind === 'agent' ? '마지막 재평가 ' : '마지막 매수 판단 ') + btYMD((BT.R as BtR).eq[st.j].i) : '';
}
/** btPanelFill(st,stage): st 는 기회가 생긴 날, stage 는 0 발견, 1 확인, 2 결정 */
function panelFill(st: Stop, stage: number, rest: boolean) {
  RUN.lastSt = st;
  set({ panel: { ...BT.panel, st, stage, rest, sum: 0, dataSt: true } });
  /* 대표 판단에 닿으면 모델의 문장을 보여 준다 */
  try {
    if (BT.phase === 'run' && st && st.full && stage === 2 && !st.jShown && btAi(BT.s as Strat)) btJShow(st);
  } catch {
    /* 무시 */
  }
}

/** btStart() */
export function btStart() {
  RUN.pause = 0;
  btJStop();
  if (!BT.R) set({ R: btCompute({ s: BT.s as Strat, per: BT.per, amt: BT.amt }) });
  RUN.ph = -1;
  RUN.j = -2;
  RUN.fed = 0;
  RUN.seg = 0;
  RUN.stg = -1;
  RUN.lastSt = null;
  const steps: Record<string, StepView> = {};
  set({
    phase: 'run',
    sel: null,
    grp: null,
    steps,
    feed: [],
    feedShown: false,
    rail: BT.rail + 1,
    draw: BT.draw + 1,
    head: { dot: 'idle', date: '', state: '', last: '' },
    panel: { init: BT.panel.init + 1, rest: false, sum: 0, st: null, stage: -1, dataSt: false },
    pj: { hidden: true, cls: 'pj', label: 'TETH의 판단', text: '' },
    vj: null,
    marksJ: -1,
    ddJ: -1,
    pulseJ: null,
  });
  if (reduced()) {
    btFinish();
    afterStart();
    return;
  }
  if (window.innerWidth <= 900) {
    const c = document.querySelector('.bt-cap');
    try {
      if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      /* 무시 */
    }
  }
  RUN.t0 = performance.now();
  RUN.raf = requestAnimationFrame(btTick);
  tfTrack('bt_start', { id: BT.id, per: BT.per });
  try {
    if (BT.phase === 'run') btJPrefetch();
  } catch {
    /* 무시 */
  }
  afterStart();
}
/** 모바일 백테스트: 돌려 보기를 누르면 검증 화면(맨 위)으로 (PC 제외) */
function afterStart() {
  if (window.innerWidth <= 768) scrollTop();
}
function scrollTop() {
  const sc = document.getElementById('g-scroll');
  if (sc) sc.scrollTop = 0;
}
/** btStop() */
export function btStop() {
  if (RUN.raf) cancelAnimationFrame(RUN.raf);
  RUN.raf = 0;
}

/** btTick(now) */
function btTick(now: number) {
  if (BT.phase !== 'run' || !MOUNTED) {
    RUN.raf = 0;
    return;
  }
  /* 모델의 판단 문장을 기다리거나 보여 주는 동안에는 시계가 멈춘다 */
  if (RUN.pause) {
    RUN.t0 += now - (RUN.pt || now);
    RUN.pt = now;
    RUN.raf = requestAnimationFrame(btTick);
    return;
  }
  RUN.pt = now;
  const e = now - RUN.t0;
  const R = BT.R as BtR;
  const s = BT.s as Strat;
  const t1 = R.prepMs;
  const t2 = t1 + R.runMs;
  const t3 = t2 + R.wrapMs;
  if (e < t1) {
    if (RUN.ph < 0) {
      RUN.ph = 0;
      step('prep', 'run');
      set({ cap: cap('시작 금액', btUsd(BT.amt)), vj: -1 });
    }
    const k = e / t1;
    const tot = R.list.length * R.N;
    const ix = Math.min(R.list.length - 1, Math.floor(k * R.list.length));
    step('prep', 'run', Math.floor(tot * k).toLocaleString() + '개');
    head('', '', mkTk(R.list[ix]) + '의 하루 가격을 불러오는 중', '');
  } else if (e < t2) {
    if (RUN.ph < 1) {
      RUN.ph = 1;
      step('prep', 'ok', R.list.length + '종목, 가격 ' + (R.list.length * R.N).toLocaleString() + '개');
      step('run', 'run');
      step('chk', 'run');
      set({ cur: true });
    }
    const te = e - t1;
    const sg = R.seg;
    while (RUN.seg < sg.length - 1 && te >= sg[RUN.seg].t1) RUN.seg++;
    const g = sg[RUN.seg];
    let j: number;
    let stage = -1;
    if (g.k === 'go') {
      const p = Math.max(0, Math.min(1, (te - g.t0) / Math.max(1, g.t1 - g.t0)));
      j = Math.round(g.a + (g.b - g.a) * p);
    } else {
      const gs = g.st as Stop;
      j = g.j;
      const q = te - g.t0;
      const tt = gs.t as number[];
      stage = !gs.full ? 2 : q < tt[0] ? 0 : q < tt[0] + tt[1] ? 1 : 2;
    }
    j = Math.max(-1, Math.min(R.N - 1, j));
    if (j !== RUN.j || stage !== RUN.stg) {
      RUN.j = j;
      RUN.stg = stage;
      const dec = stage < 0 || stage >= 2;
      const vj = dec ? j : j - 1; /* 결정이 나기 전에는 잔고도 선도 표시도 전날에 머문다 */
      feed(j, dec);
      const c = btCount(R, s, j, dec);
      const v = vj < 0 ? 1 : R.eq[vj].v;
      const dj = Math.max(0, j);
      set({ vj, marksJ: vj, ddJ: vj, cap: cap(btYMD(R.eq[dj].i) + ' 잔고', btUsd(BT.amt * v), mkPct0((v - 1) * 100, 1), mkSign((v - 1) * 100)) });
      step('run', 'run', (dj + 1).toLocaleString() + ' / ' + R.N.toLocaleString() + '일');
      step('chk', 'run', btChkTxt(R, s, c));
      if (stage >= 0) {
        const gs = g.st as Stop;
        set({ pulseJ: stage < 2 ? vj : null });
        head('', btYMD(R.eq[j].i), stage === 0 ? (s.kind === 'agent' ? 'AI가 종목을 다시 비교했습니다' : btGate(s) ? '기회를 찾았습니다' : '사는 조건이 맞았습니다') : stage === 1 ? 'AI가 그날의 시장을 확인합니다' : gs.kind === 'skip' && gs.ds[0].tk ? gs.ds[0].tk + ' 매수 보류' : (gs.ds[0].p2 as [string, string])[0], '');
        panelFill(gs, stage, false);
      } else {
        set({ pulseJ: null });
        const ls = btLatest(R, j);
        if (ls && ls !== RUN.lastSt) panelFill(ls, 2, true);
        else if (!BT.panel.rest) set({ panel: { ...BT.panel, rest: true } });
        const h = btHolding(R, s, R.eq[dj].i);
        head('', btYMD(R.eq[dj].i), h.length ? h.join(', ') + ' 보유 중' : '조건이 맞기를 기다리는 중', lastTxt());
      }
    }
  } else if (e < t3) {
    if (RUN.ph < 2) {
      RUN.ph = 2;
      btEndReplay();
      step('wrap', 'run');
      set({ panel: { ...BT.panel, rest: false, sum: 1, dataSt: false } });
      head('', btYMD(R.eq[R.N - 1].i), R.N.toLocaleString() + '일을 다 돌렸습니다. 결과를 정리하는 중', '');
    }
  } else {
    step('wrap', 'ok');
    btFinish();
    return;
  }
  RUN.raf = requestAnimationFrame(btTick);
}
/** btEndReplay() */
function btEndReplay() {
  const R = BT.R as BtR;
  const s = BT.s as Strat;
  const j = R.N - 1;
  RUN.j = j;
  RUN.stg = -1;
  feed(j, true);
  const c = btCount(R, s, j, true);
  const v = R.eq[j].v;
  set({ pulseJ: null, vj: j, marksJ: j, ddJ: j, cur: false, cap: cap(btYMD(R.eq[j].i) + ' 잔고', btUsd(BT.amt * v), mkPct0((v - 1) * 100, 1), mkSign((v - 1) * 100)) });
  step('run', 'ok', R.N.toLocaleString() + '일');
  step('chk', 'ok', btChkTxt(R, s, c));
}

/* ── 결과 ── */
/** btFinish() */
export function btFinish() {
  RUN.pause = 0;
  btJStop();
  btStop();
  const s = BT.s as Strat;
  const R = BT.R as BtR;
  RUN.j = R.N - 1;
  RUN.stg = -1;
  if (!MOUNTED) {
    set({ phase: 'result', filt: BT.filt || btDefFilt(s) });
    return;
  }
  set({
    phase: 'result',
    filt: BT.filt || btDefFilt(s),
    cur: false,
    cap: cap(btYMD(R.eq[R.N - 1].i) + ' 잔고', btUsd(R.final), mkPct0(R.ret, 1), mkSign(R.ret)),
    panel: { ...BT.panel, rest: false, sum: 2, dataSt: false },
    head: { dot: 'done', date: '', state: R.N.toLocaleString() + '일을 다시 돌렸습니다. 숫자나 그래프의 표시를 누르면 근거가 열립니다.', last: '' },
    rail: BT.rail + 1,
    draw: BT.draw + 1,
    vj: null,
    marksJ: R.N,
    ddJ: R.N - 1,
    pulseJ: null,
    pj: { ...BT.pj, hidden: true },
    legBench: mkPct0(R.benchRet, 1),
  });
  /* 자리가 잡힌 뒤의 폭으로 다시 잰다 */
  requestAnimationFrame(() => {
    if (BT.phase === 'result' && document.getElementById('bt-chart')) set({ draw: BT.draw + 1 });
  });
  try {
    const t = tfS();
    t.bt = t.bt || {};
    t.bt.id = BT.id;
    t.bt.per = BT.per;
    t.bt.amt = BT.amt;
    t.bt.done = 1;
    t.bt.ret = R.ret;
    t.bt.mdd = R.mdd;
    t.bt.fin = R.final;
    tfSave();
    tfTrack('bt_done', { id: BT.id, ret: R.ret });
  } catch {
    /* 무시 */
  }
  if (s && s.mine) {
    btMineDone(tfS(), s, R);
    tfSave();
  }
  try {
    btReadLoad();
  } catch {
    /* 무시 */
  }
}
/** btJump(k): 요약 칸의 숫자를 누르면 그 근거로 */
export function btJump(k: string) {
  if (BT.phase !== 'result') return;
  const into = (id: string) => {
    const t = document.getElementById(id);
    try {
      if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      /* 무시 */
    }
  };
  if (k === 'win' || k === 'loss' || k === 'tr') {
    set({ trf: k === 'tr' ? 'all' : k, ordN: 8 });
    into('bt-trs');
    return;
  }
  set({ filt: k, decN: BT_PAGE, grp: null, sel: BT.sel && BT.sel.t !== 't' ? null : BT.sel });
  into('bt-dec');
}
/** btMarkClick(ix,ix2): 그래프의 표시를 누르면 그 판단의 근거로 간다. 묶인 보류는 보류만 모아 그 묶음을 짚어 보여 준다 */
export function btMarkClick(ix: number, ix2: number) {
  if (BT.phase !== 'result') return;
  const R = BT.R as BtR;
  const s = BT.s as Strat;
  const d = R.D[ix];
  if (!d) return;
  const grp = ix2 > ix ? { a: ix, b: ix2 } : null;
  let filt = BT.filt as string;
  if (grp) filt = 'skip';
  else if (btRowAt(btDecList(R, s, filt, BT.sort), d) < 0) filt = d.k === 'sell' ? 'all' : btDefFilt(s);
  const L = btDecList(R, s, filt, BT.sort);
  let at = btRowAt(L, d);
  if (grp) at = Math.max(at, btRowAt(L, R.D[ix2]));
  let decN = BT.decN;
  if (at >= decN) decN = at + 3;
  const row = L[btRowAt(L, d)];
  const sel: Sel = row && row.ev ? { t: 'e', ix: row.ev.ix, j: d.j } : { t: 'd', ix, j: d.j };
  set({ grp, filt, decN, sel });
  requestAnimationFrame(() => {
    const el = document.querySelector('.bt-row.on');
    try {
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch {
      /* 무시 */
    }
  });
}
/** btSort(v) */
export const btSort = (v: string) => set({ sort: v, decN: BT_PAGE, sel: null });
/** btFilt(k) */
export const btFilt = (k: string) => set({ filt: k, decN: BT_PAGE, grp: null, sel: BT.sel && BT.sel.t !== 't' ? null : BT.sel });
/** btTrFilt(k) */
export const btTrFilt = (k: string) => set({ trf: k, ordN: 8, sel: BT.sel && BT.sel.t === 't' ? null : BT.sel });
/** btSelDec(ix) */
export function btSelDec(ix: number) {
  const d = (BT.R as BtR).D[ix];
  set({ sel: BT.sel && BT.sel.t === 'd' && BT.sel.ix === ix ? null : { t: 'd', ix, j: d.j } });
}
/** btSelEv(ix) */
export function btSelEv(ix: number) {
  const E = (BT.R as BtR).EV[ix];
  set({ sel: BT.sel && BT.sel.t === 'e' && BT.sel.ix === ix ? null : { t: 'e', ix, j: E.j } });
}
/** btSelTr(id) */
export function btSelTr(id: number) {
  const R = BT.R as BtR;
  const t = btTradeOf(R, id);
  if (!t) return;
  set({ sel: BT.sel && BT.sel.t === 't' && BT.sel.id === id ? null : { t: 't', id, j: Math.max(0, Math.min(R.N - 1, t.e - R.i0)) } });
}
export const btMoreDec = (n: number) => set({ decN: n });
export const btMoreTr = () => set({ ordN: BT.ordN + 12 });
/** 창 크기가 바뀌면 그래프를 다시 잰다 (원본의 resize 리스너) */
export function btRedraw() {
  if (BT.phase !== 'run' && document.getElementById('bt-chart')) set({ draw: BT.draw + 1 });
}

/* ── 모델의 판단 문장과 결과 해석 ── */
/** btJudge(d,cb) */
export function btJudge(d: Dec, cb?: (J: JState) => void): JState {
  const R = BT.R as BtR;
  const k = btJKey(ctx(), d);
  let J = BT_AI.J[k];
  if (J && J.st === 'ok') {
    if (cb) cb(J);
    return J;
  }
  if (J && J.st === 'load') {
    if (cb) J.q.push(cb);
    return J;
  }
  const J2: JState = (BT_AI.J[k] = { st: 'load', t: '', q: cb ? [cb] : [] });
  J = J2;
  btAiCall({ system: BT_SYS_J, user: JSON.stringify(btFactsAt(ctx(), R, d)), timeout: 20000 }, (err, t) => {
    if (err) {
      J2.st = 'fail';
      J2.err = err;
    } else {
      J2.st = 'ok';
      J2.t = (t as string).replace(/\n+/g, ' ');
    }
    const q = J2.q;
    J2.q = [];
    q.forEach((f) => {
      try {
        f(J2);
      } catch {
        /* 무시 */
      }
    });
    set({ ai: BT.ai + 1 });
  });
  return J;
}
/** btJRetry(ix) */
export function btJRetry(ix: number) {
  const d = (BT.R as BtR).D[ix];
  if (!d) return;
  delete BT_AI.J[btJKey(ctx(), d)];
  btJudge(d);
  set({ ai: BT.ai + 1 });
}
/** btJStop() */
function btJStop() {
  if (BT_AI.ty) {
    clearInterval(BT_AI.ty);
    BT_AI.ty = 0;
  }
  if (BT_AI.wt) {
    clearTimeout(BT_AI.wt);
    BT_AI.wt = 0;
  }
}
/** btJType(text,after): 흐른 시간으로 글자 수를 정한다(탭이 가려져 타이머가 느려져도 제때 끝난다) */
function btJType(text: string, label: string, after: () => void) {
  btJStop();
  set({ pj: { hidden: false, cls: 'pj on', label, text: '' } });
  const t0 = performance.now();
  const per = Math.max(9, Math.min(22, 2600 / text.length));
  BT_AI.ty = window.setInterval(() => {
    const i = Math.min(text.length, Math.floor((performance.now() - t0) / per));
    set({ pj: { ...BT.pj, text: text.slice(0, i) } });
    if (i >= text.length) {
      clearInterval(BT_AI.ty);
      BT_AI.ty = 0;
      BT_AI.wt = window.setTimeout(
        () => {
          BT_AI.wt = 0;
          after();
        },
        Math.min(2400, 1000 + text.length * 8),
      );
    }
  }, 30);
}
/** btJShow(st): 대표 판단에 닿으면 시계를 멈추고, 모델의 문장이 다 나온 뒤에 다시 간다. 기다림은 실제 호출이 걸린 시간이다 */
function btJShow(st: Stop) {
  const d = st.ds.filter((x) => x.k === 'buy')[0] || st.ds[0];
  if (!d || st.jShown) return;
  st.jShown = 1;
  RUN.pause = 1;
  set({ pj: { hidden: false, cls: 'pj wait', label: BT.pj.label, text: '그날까지의 값으로 판단을 정리하고 있습니다' } });
  requestAnimationFrame(() => {
    try {
      const sc = document.getElementById('g-scroll');
      const p = document.getElementById('bt-panel');
      const pr = p && p.getBoundingClientRect();
      if (sc && pr && pr.bottom > window.innerHeight - 12) sc.scrollBy({ top: pr.bottom - window.innerHeight + 28, behavior: 'smooth' });
    } catch {
      /* 무시 */
    }
  });
  btJudge(d, (J) => {
    if (BT.phase !== 'run') return;
    const t = J.st === 'ok' ? J.t : d.act + '. ' + d.say + '.';
    d.jt = J.st === 'ok' ? J.t : null;
    btJType(t, J.st === 'ok' ? 'TETH의 판단' : '계산된 근거 (판단 문장은 결과 화면에서 다시 불러올 수 있습니다)', () => {
      RUN.pause = 0;
      set({ pj: { ...BT.pj, cls: 'pj on rest' } });
    });
  });
}
/** btJPrefetch() */
function btJPrefetch() {
  ((BT.R as BtR).stops || []).forEach((st) => {
    if (!st.full) return;
    const d = st.ds.filter((x) => x.k === 'buy')[0] || st.ds[0];
    if (d) btJudge(d);
  });
}
/** btReadLoad(force): 결과 해석은 계산된 숫자만 넘겨 모델이 쓴다 */
export function btReadLoad(force?: boolean) {
  const R = BT.R as BtR;
  const k = btReadKey(ctx(), R);
  const X0 = BT_AI.R[k];
  if (X0 && X0.st === 'ok' && !force) return;
  if (X0 && X0.st === 'load' && !force) return;
  const X: ReadState = (BT_AI.R[k] = { st: 'load' });
  set({ ai: BT.ai + 1 });
  btAiCall({ system: BT_SYS_R, user: JSON.stringify(btReadFacts(ctx(), R)), timeout: 40000 }, (err, t) => {
    if (err) {
      X.st = 'fail';
      X.err = err;
    } else {
      X.st = 'ok';
      X.t = t;
    }
    set({ ai: BT.ai + 1 });
  });
}
/** 지금 결과의 해석 상태 (btReadHtml 이 읽는 것) */
export const btReadNow = (): ReadState => (BT.R ? BT_AI.R[btReadKey(ctx(), BT.R)] : null) || { st: 'load' };

/* ── 들어오고 나가기 ── */
/** btNe() */
export const btNe = () => tfSS3Rid(BT.s as Strat);
/** btGoTo(st) */
export const btGoTo = (st: string) => {
  window.location.hash = '#/share/bt/' + btNe() + (st ? '/' + st : '');
};
/** 지금 화면의 주소를 지우고 그 전략을 만든 대화로 돌아간다 (원본 tfBackToChat) */
export function backToChat() {
  tfBackToChat();
}
/** btOpen(ne): 전략 상세의 「백테스트」 단추가 부른다. 손님이면 가입 창을 열고 하려던 일을 기억한다 */
export function btOpen(ne: string) {
  if (!getState().user) {
    authOpen('signup');
    tfIntentSet({ kind: 'bt', id: ne, from: window.location.hash });
    tfTrack('bt_guest_gate', { id: ne });
    return;
  }
  window.location.hash = '#/share/bt/' + ne;
}
/** btBack() */
export function btBack() {
  /* 모바일: 결과에서 뒤로 가기는 설정 화면으로 (PC 제외) */
  if (window.innerWidth <= 768 && BT.phase === 'result') {
    try {
      btReady();
    } catch {
      /* 무시 */
    }
    scrollTop();
    return;
  }
  if (BT.phase === 'run') {
    btStop();
    btReady();
    return;
  }
  if (BT.s && BT.s.mine) {
    backToChat();
    return;
  }
  const ne = BT.s ? tfSS3Rid(BT.s) : '';
  if (history.length > 1) history.back();
  else nav('#/share/s/' + ne);
}
/**
 * btUse(): 이 전략 실행하기.
 * 실행 자격(거래소 연결)이 있으면 금액 정하기나 실행 준비로, 없으면 연결과 플랜 화면으로 간다(그 화면들은 거래소 연결 조각의 것이라 아직 원본을 연다).
 */
export function btUse() {
  const s = BT.s as Strat;
  const user = getState().user;
  if (!user) {
    authOpen('signup');
    tfIntentSet({ kind: 'bt', id: btNe() + '/go' });
    return;
  }
  const need = s && s.ex && acEx(s.ex) ? s.ex : null;
  if (!s.mine && acReady(need)) {
    tfTrack('bt_use', { id: BT.id, skip: 1 });
    nav('#/share/copy/' + btNe()); /* cpSetupGo */
    return;
  }
  if (!acReady(need)) {
    /* 실행 자격이 없으면 플랜 화면 (원본 acStart 가 여는 plView) */
    nav('#/plan');
    return;
  }
  tfTrack('bt_use', { id: BT.id });
  btGoTo('go');
}

/** 전략을 바꿔 들어올 때 (btRoute 의 상태 맞추기). 다른 전략이면 처음부터, 같은 전략이면 그대로 둔다 */
export function btEnter(s: Strat, t: TfState) {
  const tb = t.bt || {};
  if (BT.id !== s.id) {
    btStop();
    let per = BT.per;
    let amt = BT.amt;
    if (tb.id === s.id) {
      if (tb.per != null) per = tb.per;
      if (tb.amt) amt = tb.amt;
    } else if (s.mine) {
      const pi = ((t.intake || {}).period || {}).i;
      per = pi === 0 ? 365 : pi === 1 ? 730 : pi === 2 ? 0 : 365;
      if (t.cloneFrom && s.p && s.p.startI != null) {
        const span = PRICE0.length - 1 - s.p.startI;
        let best = 0;
        let bd = 1e9;
        BT_PER.forEach((o) => {
          const d = Math.abs((o[0] || PRICE0.length) - span);
          if (d < bd) {
            bd = d;
            best = o[0];
          }
        });
        per = best;
      }
    }
    set({ id: s.id, s, R: null, phase: 'ready', sel: null, grp: null, filt: null, trf: 'all', decN: 8, ordN: 8, per, amt });
  }
  set({ s });
}
/** 같은 주소로 다시 들어간다 */
export const btReroute = () => set({ route: BT.route + 1 });
/** btView(): 화면을 처음 그릴 때. 이미 돌려 본 전략이면 결과로, 아니면 준비로 */
export function btView() {
  const t = tfS().bt || {};
  set({ legAmt: BT.amt, legBench: BT.R && BT.phase === 'result' ? mkPct0(BT.R.benchRet, 1) : '' });
  if (t.id === BT.id && t.done) {
    if (!BT.R) set({ R: btCompute({ s: BT.s as Strat, per: BT.per, amt: BT.amt }) });
    if (!BT.panel.init) set({ panel: { ...BT.panel, init: 1 } });
    btFinish();
  } else btReady();
}
/** 실행 준비 화면이 쓰는 계산 (btGoView 의 if(!BT.R) btCompute()) */
export function btEnsureR() {
  if (!BT.R) set({ R: btCompute({ s: BT.s as Strat, per: BT.per, amt: BT.amt }) });
}
export { mkHook };
