// 대화와 AI 연결의 진행 (원본 gNew, gSend, taiMarket, act*, taiOhlc, 질문 패널, 전략 카드).
// 원본이 DOM 에 줄을 붙이던 자리에서 여기서는 대화의 항목(Item)을 고친다. 화면은 screens/conv 가 그 항목을 그린다.
import { readIdea } from '../core/tai/act';
import { gaugeUp, mainChange, ohlcContext, ohlcStepText, taiIndic, taiTline } from '../core/tai/market';
import { taiBuildSystem } from '../core/tai/prompt';
import { TAI_SRCNM, TAI_TFL, TAI_TFTV, taiAssetFrom, taiIsStratText, taiPredictQ, taiQKind, taiScope, taiStatusLabel, taiTfFrom, type Plan } from '../core/tai/scope';
import { NET, fetchOhlc, ohlcViaProxy, taiEnsure, taiPing, taiResolveProxy, taiStop, taiStream, type FailKind } from '../core/tai/stream';
import { beforeTags, parseTags, streamView, stripTags } from '../core/tai/tags';
import { aiOf, newSession, type Act, type ActData, type ActDetail, type ActStep, type AiState, type AskCfg, type AssetRef, type ChipCard, type ChipItem, type Item, type Ohlc, type Rich, type Session } from '../core/tai/types';
import { TF_QS, tfAiStrategy, tfResumeRoute, type StrategyTag } from '../core/tf/intake';
import { G, STORE, bump, convReset, fillInput, kept, viewReset, gHome, gScrollBottom, gSelect, gShowConv, gUserPin, hooks, isLive, nid, sync, taiBind, taiSpacerTrim, threadAdd, threadDrop, threadSwap } from './conv';
import { nav } from './route';
import { authHooks, getState, setState, toast } from './store';
import { pushAlert, pushFeedback, tfClear, tfS, tfSave } from './tf';

const delay = (ms: number, fn: () => void) => setTimeout(fn, ms);
type AiItem = Extract<Item, { k: 'ai' }>;
type ChartItem = Extract<Item, { k: 'chart' }>;

/** TAI 의 진행 쪽 값 (연결 쪽은 core/tai/stream 의 NET) */
export const TAI: { busy: boolean; busyAt: number; lastQ: string; lastPlan: Plan | null; tfCtx: string[] | null; mdSteps: Record<string, StepH>; cn: number; qn: number; offq: Record<string, () => void> } = {
  busy: false,
  busyAt: 0,
  lastQ: '',
  lastPlan: null,
  tfCtx: null,
  mdSteps: {},
  cn: 0,
  qn: 0,
  offq: {},
};
/** 지금 답을 만들거나 조사하는 중인가 (보내기를 막는 조건) */
export const taiBusy = () => !!NET.req || (TAI.busy && Date.now() - TAI.busyAt < 180000);
NET.onBusy = bump; /* taiBusySync: 보내기 단추와 중지 단추는 화면이 NET.req 와 TAI.busy 를 보고 고른다 */
export { taiStop };

const G_RM = (() => {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
})();
const kstNow = () => new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });

/* ══ 작업 타임라인 (act*) ══ */
export type Run = { id: string; sess: Session; data: ActData; timer?: ReturnType<typeof setInterval>; lastEvt: number };
export type StepH = { st: ActStep; done: (t?: string | null, d?: ActDetail | null, m?: string | null) => void; fail: (t?: string | null, d?: ActDetail | null, m?: string | null) => void; set: (t: string) => void };
/** 화면 쪽 상태: 펼침, 끝난 뒤의 고정 머리줄로 바꿨는지, 경과 초 글자 */
export const ACT: { n: number; live: Record<string, Run>; ui: Record<string, { open: boolean; fin: boolean; els: string }> } = { n: 0, live: {}, ui: {} };
const rich = (...parts: Rich): ActDetail => ({ k: 'rich', parts });

/** actStart(sess,label) */
function actStart(sess: Session, label: string): Run {
  ACT.n++;
  const id = 'act' + Date.now().toString(36) + ACT.n;
  const data: ActData = { id, label, status: 'running', t0: Date.now(), steps: [], tok: 0 };
  sess.acts = sess.acts || {};
  sess.acts[id] = data;
  const run: Run = { id, sess, data, lastEvt: Date.now() };
  ACT.ui[id] = { open: true, fin: false, els: '' };
  ACT.live[id] = run;
  threadAdd(sess, { k: 'act', id });
  run.timer = setInterval(() => actTick(run), 1000);
  actTick(run);
  return run;
}
/** actTick(run): 2초부터 경과 초를 머리줄에 적는다 */
function actTick(run: Run) {
  if (run.data.status !== 'running') {
    clearInterval(run.timer);
    return;
  }
  const s = Math.round((Date.now() - run.data.t0) / 1000);
  const ui = ACT.ui[run.id];
  if (ui && s >= 2 && ui.els !== s + '초') {
    ui.els = s + '초';
    bump();
  }
}
/** actStep(run,st) */
function actStep(run: Run, init: Partial<ActStep> & Pick<ActStep, 'kind' | 'title'>): StepH {
  const st: ActStep = { status: 'running', ...init, t0: Date.now() };
  run.lastEvt = Date.now();
  run.data.steps.push(st);
  if (isLive(run.sess)) {
    sync();
    gScrollBottom();
  } else bump();
  actTick(run);
  const fin = (ok: boolean, title?: string | null, detail?: ActDetail | null, mR?: string | null) => {
    st.status = ok ? 'done' : 'failed';
    if (title) st.title = title;
    if (detail != null) st.detail = detail;
    if (mR != null) st.mR = mR;
    st.ms = Date.now() - st.t0;
    bump();
    actTick(run);
    STORE.save();
  };
  return {
    st,
    done: (t2, d2, m2) => fin(true, t2, d2, m2),
    fail: (t2, d2, m2) => fin(false, t2, d2, m2),
    set: (t2) => {
      st.title = t2;
      bump();
    },
  };
}
/** actNote(run,text) */
const actNote = (run: Run, text: string) => actStep(run, { kind: 'note', title: text, status: 'done' });
/** actThink(run): 모델의 실제 생각 글이 흘러드는 줄 */
function actThink(run: Run) {
  const h = actStep(run, { kind: 'think', title: '생각하는 중', h: '생각을 정리하는 중', detail: { k: 'cot', text: '' }, open: true });
  let buf = '';
  return {
    push(d: string) {
      if (!d) return;
      if (!buf) d = String(d).replace(/^\s+/, '');
      buf = (buf + d).replace(/\n{3,}/g, '\n\n');
      h.st.think = buf;
      if (isLive(run.sess)) {
        sync();
        gScrollBottom();
      }
    },
    done() {
      if (h.st.status !== 'running') return;
      h.st.status = 'done';
      h.st.open = false;
      h.st.title = '생각 완료';
      h.st.mR = Math.max(1, Math.round((Date.now() - h.st.t0) / 1000)) + '초';
      h.st.ms = Date.now() - h.st.t0;
      h.st.detail = buf ? { k: 'cot', text: buf } : null;
      bump();
      STORE.save();
    },
    st: h.st,
  };
}
/** actFinish(run,mode,usage) */
function actFinish(run: Run, mode: 'done' | 'abort' | 'error', usage?: { out?: number } | null) {
  const d = run.data;
  if (d.status !== 'running') return;
  d.status = mode;
  d.ms = Date.now() - d.t0;
  if (usage && usage.out) d.tok = usage.out;
  d.steps.forEach((s) => {
    if (s.status === 'running') {
      s.status = 'failed';
      s.title = s.title + (mode === 'abort' ? ', 중단됨' : '');
    }
  });
  clearInterval(run.timer);
  delete ACT.live[run.id];
  run.sess.items.forEach((x) => {
    if (x.k === 'chart' && x.pip != null) x.pip = null; /* 중단되면 작게 띄운 차트를 제자리로 */
  });
  const ui = ACT.ui[run.id];
  if (ui) {
    /* 먼저 접히는 움직임을 보이고, 접힌 뒤에 고정 머리줄로 바꾼다 */
    ui.open = false;
    setTimeout(() => {
      ui.fin = true;
      bump();
    }, 260);
  }
  bump();
  STORE.save();
}
/** actToggle(id) */
export function actToggle(id: string) {
  const ui = ACT.ui[id];
  if (!ui) return;
  ui.open = !ui.open;
  bump();
}
/** actHydrate: 대화를 다시 열 때 저장된 기록을 접힌 요약으로 되살린다. 돌고 있는 작업은 그대로 잇는다 */
function actHydrate(sess: Session) {
  for (const list of [sess.items, sess.thread]) {
    for (const it of list.slice()) {
      if (it.k !== 'act') continue;
      const d = sess.acts && sess.acts[it.id];
      if (!d) {
        list.splice(list.indexOf(it), 1);
        continue;
      }
      const run = ACT.live[it.id];
      if (run && run.data === d && d.status === 'running') {
        ACT.ui[it.id] = { open: true, fin: false, els: (ACT.ui[it.id] && ACT.ui[it.id].els) || '' };
        continue;
      }
      if (d.status === 'running') {
        d.status = 'abort';
        d.steps.forEach((s) => {
          if (s.status === 'running') s.status = 'failed';
        });
      }
      ACT.ui[it.id] = { open: false, fin: true, els: '' };
    }
  }
}
hooks.onShowConv = (sess) => {
  actHydrate(sess);
  /* 화면에서만 바뀐 것은 처음 모습으로 (원본은 저장된 HTML 로 다시 그린다) */
  sess.items = sess.items.filter(kept);
  sess.items.forEach(viewReset);
  /* 받다가 끊긴 답은 빈 줄로 남는다 (원본도 저장된 빈 말풍선을 그대로 보여 준다) */
  sess.items.forEach((x) => {
    if (x.k === 'ai' && x.live && !ACT_STREAMING.has(x)) {
      x.live = null;
      x.fresh = false;
    }
  });
  /* 스크립트 질문 카드: 저장된 것이 줄에 없으면 다시 그린다 */
  const pc = sess.pendingChips;
  if (pc && !sess.items.some((x) => x.id === pc.id)) {
    sess.pendingChips = null;
    if (pc.step) gSetStep(sess, pc.step);
    gConvChips(sess, pc.items, pc.card || null, true);
  }
  /* 차트 위젯은 지금 대화의 차트만 다시 띄운다 */
  if (sess.ai && sess.ai.chart) {
    G.chart = sess.ai.chart;
    G.chartRev++;
  }
};
const ACT_STREAMING = new WeakSet<AiItem>();

/* ══ 대화 줄에 놓는 것들 ══ */
/** gConvUser(t) */
function gConvUser(sess: Session, t: string) {
  threadAdd(sess, { k: 'user', id: nid('u'), text: t });
}
/** gConvAI(html): 짧은 안내 글 */
function gConvAI(sess: Session, text: string) {
  threadAdd(sess, { k: 'ai', id: nid('a'), plain: text });
}
/** gThink(label,ms,fn): 점 세 개가 뛰는 잠깐의 확인 줄 */
function gThink(sess: Session, label: string, ms: number, fn: () => void) {
  const it = threadAdd(sess, { k: 'think', id: 'gth' + Date.now() + Math.floor(Math.random() * 1e4), label });
  delay(ms, () => {
    threadDrop(sess, it.id);
    if (G.cur === sess) fn();
  });
}
/** taiStatus(label): 로고가 뛰는 상태 줄. done(글) 이면 회색 한 줄로 남고, done() 이면 사라진다 */
function taiStatus(sess: Session, label: string) {
  const it = threadAdd(sess, { k: 'status', id: nid('gst'), label, done: false });
  return {
    done(txt?: string | null) {
      if (!txt) {
        threadDrop(sess, it.id);
        return;
      }
      threadSwap(sess, it.id, { k: 'status', id: it.id, label: txt, done: true });
    },
  };
}
const statusLine = (sess: Session, label: string) => threadAdd(sess, { k: 'status', id: nid('gst'), label, done: true });
/** taiNextClear(), taiActClear(): 후속 질문과 단추 줄을 모두 치운다 */
function taiNextClear(sess: Session) {
  const n = sess.items.length + sess.thread.length;
  sess.items = sess.items.filter((x) => x.k !== 'next' && x.k !== 'chip');
  sess.thread = sess.thread.filter((x) => x.k !== 'next' && x.k !== 'chip');
  if (n !== sess.items.length + sess.thread.length) sync();
}
/** taiNext(items,acts): 후속 질문과 실행 단추를 한 목록으로 */
function taiNext(sess: Session, items: string[], acts: Act[]) {
  items = items || [];
  acts = (acts || []).filter((a) => a && a.label && ['alert', 'backtest', 'delegate_trade', 'auto_trade'].includes(a.type)).slice(0, 2);
  if (!items.length && !acts.length) return;
  taiNextClear(sess);
  const rows: Extract<Item, { k: 'next' }>['rows'] = items.map((q) => ({ t: 'n' as const, q }));
  acts.forEach((a, i) => rows.splice(i, 0, { t: 'a', a }));
  threadAdd(sess, { k: 'next', id: nid('gnx'), rows, badge: true });
}
/** taiErrCard(q) */
function taiErrCard(sess: Session, q: string) {
  threadAdd(sess, { k: 'err', id: nid('ger'), q });
}
/** taiErrRetry(id) */
export function taiErrRetry(id: string) {
  const sess = G.cur;
  if (!sess) return;
  const it = sess.items.concat(sess.thread).find((x) => x.id === id);
  threadDrop(sess, id);
  if (it && it.k === 'err' && it.q) {
    NET.ok = true; /* 다시 시도는 실제 요청으로 */
    gSend(it.q);
  }
}
/** taiChipSend(b): 「다시 생성」, 「이어서 계속」 같은 단추 하나짜리 줄 */
export function chipGo(id: string) {
  const sess = G.cur;
  if (!sess) return;
  const it = sess.items.concat(sess.thread).find((x) => x.id === id);
  if (!it || it.k !== 'chip') return;
  if (it.go === 'share') {
    nav('#/share');
    return;
  }
  if (it.go === 'offretry') {
    /* taiOffRetry(id) */
    const f = TAI.offq[id];
    threadDrop(sess, id);
    if (!f) return;
    NET.ok = null;
    taiEnsure((ok) => {
      if (ok) f();
      else toast('아직 AI 서버에 연결되지 않습니다');
    });
    return;
  }
  threadDrop(sess, id);
  if (it.q) gSend(it.q);
}
/** 후속 질문 단추 (문서 위임 클릭) */
export function nextAsk(q: string) {
  if (q) gSend(q);
}
/** taiActDo(a,btn,col) */
export function taiActDo(itemId: string, idx: number) {
  const sess = G.cur;
  if (!sess) return;
  const it = sess.items.concat(sess.thread).find((x) => x.id === itemId);
  if (!it || it.k !== 'next') return;
  const row = it.rows[idx];
  if (!row || row.t !== 'a' || row.saved) return;
  const a = row.a;
  if (a.type === 'alert') {
    pushAlert({ label: a.label, at: Date.now(), asset: (G.chart && G.chart.label) || null });
    row.saved = true;
    bump();
    STORE.save();
    toast('알림 조건을 저장했습니다. 실시간 통지는 준비 중이라, 다음 접속 때 이 조건 기준으로 바로 점검해드리겠습니다');
    return;
  }
  threadDrop(sess, itemId);
  /* 매매 위임과 자동매매도 대화 안에서는 그 말을 AI 에게 보낸다 (tfStart 의 뒤쪽 덮어쓰기). AI 가 모르는 것만 묻는다 */
  gSend(a.label);
}
/** taiVote(b,v) */
export function taiVote(id: string, v: 1 | -1) {
  const sess = G.cur;
  if (!sess) return;
  const it = sess.items.concat(sess.thread).find((x) => x.id === id);
  if (!it || it.k !== 'ai') return;
  it.vote = v;
  bump();
  if (v > 0) {
    toast('좋았다니 다행입니다, 더 날카로워지겠습니다');
    return;
  }
  /* taiFeedback(): 별로입니다 > 이유 카드 */
  threadAdd(sess, { k: 'fb', id: nid('gfb'), etc: false });
}
/** taiFbEtc(id) */
export function taiFbEtc(id: string) {
  const sess = G.cur;
  const it = sess && sess.items.concat(sess.thread).find((x) => x.id === id);
  if (it && it.k === 'fb') {
    it.etc = true;
    bump();
  }
}
/** taiFbPick(id,btn) */
export function taiFbPick(id: string, reason: string) {
  const sess = G.cur;
  pushFeedback({ at: Date.now(), reason: reason.trim() || '미선택', q: TAI.lastQ || '' });
  if (sess) threadDrop(sess, id);
  toast('의견을 기록했습니다. TETH 개선에 사용됩니다.');
}
/** 카드 닫기 (의견 카드의 ×) */
export function cardClose(id: string) {
  if (G.cur) threadDrop(G.cur, id);
}
/** taiUEdit(b): 보낸 말을 입력창으로 되가져온다 */
export function taiUEdit(text: string) {
  fillInput(text, true);
}

/* ══ 차트 카드 ══ */
/** taiChartOpen(info) */
function taiChartOpen(sess: Session, info: { tv?: string; data?: string; label?: string }) {
  if (!info.tv) return;
  TAI.cn++;
  const cid = 'tvc' + TAI.cn;
  const chart = { tv: info.tv, data: info.data || 'none', label: info.label || info.tv, interval: 'D', cid };
  G.chart = chart;
  const ai = aiOf(sess);
  ai.chart = chart;
  ai.ohlc = null;
  ai.ohlcAt = 0;
  threadAdd(sess, { k: 'chart', id: nid('ch'), cid, label: chart.label });
}
/** taiChartRender(): 간격이나 범위가 바뀌면 위젯을 다시 띄운다 */
function taiChartRender() {
  G.chartRev++;
  bump();
}
const curChartItem = (sess: Session): ChartItem | null => {
  const c = G.chart;
  if (!c) return null;
  return (sess.items.concat(sess.thread).find((x) => x.k === 'chart' && x.cid === c.cid) as ChartItem | undefined) || null;
};
/** taiChartPx(j): 차트 카드 머리줄에 지금 가격과 등락 */
function taiChartPx(sess: Session, j: Ohlc) {
  const c = G.chart;
  const it = curChartItem(sess);
  if (!c || !j || !it) return;
  const m = mainChange(j, (j.meta && j.meta.iv) || aiOf(sess).tf || '1d', (c.data || '').indexOf('binance:') === 0);
  const prev = it.px ? it.px.last : null;
  it.px = { last: j.last, up: (m.chg || 0) >= 0, chg: m.chg, per: m.label, at: new Date().toTimeString().slice(0, 5), flash: prev != null && prev !== j.last ? (j.last > prev ? 'u' : 'd') : null };
  bump();
}
/** taiForecast(): 예측 질문이면 차트 아래에 위아래 시나리오를 그린다 */
function taiForecast(sess: Session) {
  const j = G.ohlc;
  const it = curChartItem(sess);
  if (!it || !j || !j.rows || j.rows.length < 10) return;
  if (j.meta && j.meta.iv !== '1d') return;
  it.fc = Date.now();
  sync();
}

/* ══ 시세 받기 ══ */
/** taiOhlc(cb,sess,run,ast,plan) */
function taiOhlc(cb: (ctx: string) => void, sess: Session, run: Run | null, ast: AssetRef | null, plan: Plan | null) {
  const ai = aiOf(sess);
  const c = ast || ai.chart;
  if (!c) {
    cb('');
    return;
  }
  const isCur = !ast || (!!ai.chart && ai.chart.data === c.data);
  G.ohlc = null;
  if (!plan) plan = { iv: ai.tf || '1d', n: 90, why: '기본' };
  if (plan.why === '기본' && ai.tf && ai.tf !== '1d') plan = { iv: ai.tf, n: 90, why: '차트' };
  const iv = plan.iv;
  const nq = plan.n;
  const p = c.data.split(':');
  const srcNm = p[0] === 'binance' ? '바이낸스' : '야후 파이낸스';
  const ivL = TAI_TFL[iv] || '일봉';
  const h = run ? actStep(run, { kind: 'fetch', title: (c.label || p.slice(1).join(':')) + ' ' + ivL + ' 시세 수신 중', h: '실시세를 확인하는 중' }) : null;
  const ctrl = 'AbortController' in window ? new AbortController() : null;
  if (ctrl) setTimeout(() => ctrl.abort(), 8000);
  fetchOhlc(c.data, iv, nq, ctrl && ctrl.signal)
    .then((j) => {
      /* 늦게 온 응답이 다른 대화나 다른 차트의 값을 덮지 않게 끝난 시점에 다시 본다 */
      const curNow = isCur && G.cur === sess && !!G.chart && G.chart.data === c.data;
      if (curNow) G.ohlc = j;
      if (isCur) {
        ai.ohlc = j;
        ai.ohlcAt = Date.now();
      }
      if (h) {
        const tx = ohlcStepText(c.label || '', j, iv, p[0], kstNow());
        h.done(tx.title, rich(...tx.detail), tx.mR);
      }
      if (curNow) taiChartPx(sess, j);
      if (curNow && run && G.cur === sess) {
        const m = mainChange(j, iv, p[0] === 'binance');
        const upx = (m.chg || 0) >= 0;
        threadAdd(sess, {
          k: 'px',
          id: nid('px'),
          as: c.label || '',
          pv: String(j.last),
          up: upx,
          chg: (upx ? '+' : '') + m.chg + '% ' + m.label,
          meta: (TAI_SRCNM[(j.meta && j.meta.src) || p[0]] || srcNm) + ', ' + kstNow() + ' KST, 분석 ' + (TAI_TFL[(j.meta && j.meta.iv) || iv] || '일봉') + ' 기준',
        });
      }
      cb(ohlcContext(c.label, j, iv, p[0]));
    })
    .catch(() => {
      /* 시세를 못 받아도 멈추지 않는다. 빠진 것은 완료 줄에 「실시세 없음」으로 남긴다 */
      if (run) run.data.missing = (run.data.missing || []).concat('실시세');
      if (h) h.done((c.label || '') + ' 실시세 없이 진행합니다');
      else if (c.data && c.data !== 'none' && G.cur === sess) statusLine(sess, '실시간 시세를 불러오지 못해 시세 없이 진행합니다');
      cb('');
    });
}
/** actProbeIv: 보조 봉 간격을 실제로 받아 한 줄로 적고 차트 간격도 바꾼다 */
function actProbeIv(run: Run, ai: AiState, iv: string, cb: () => void, ast: AssetRef | null) {
  const c = ast || ai.chart;
  if (!c || !c.data || c.data === 'none') {
    cb();
    return;
  }
  const isCur = !ast || (!!ai.chart && ai.chart.data === c.data);
  const ivL = TAI_TFL[iv] || iv;
  if (isCur && G.cur === run.sess && TAI_TFTV[iv] && ai.chart && !G_RM) {
    ai.chart.interval = TAI_TFTV[iv];
    taiChartRender();
  }
  const h = actStep(run, { kind: 'fetch', title: (c.label ? c.label + ' ' : '') + ivL + ' 흐름 확인 중', h: ivL + ' 흐름을 확인하는 중' });
  fetchOhlc(c.data, iv)
    .then((j) => {
      let up = 0;
      const rows = j.rows || [];
      for (let i = Math.max(1, rows.length - 10); i < rows.length; i++) if (rows[i][4] >= rows[i - 1][4]) up++;
      h.done((c.label ? c.label + ' ' : '') + ivL + ' 흐름 확인 완료', rich({ b: ivL }, ' ' + rows.length + '봉 실측. 최근 10봉 중 ', { b: up + '봉 상승' }, '(직전 봉 종가 대비), 직전 1봉 ' + j.chg1d + '%, 최근 7봉 ' + j.chg7d + '%. 현재가 ' + String(j.last) + '.'), rows.length + '봉');
      if (TAI.tfCtx) TAI.tfCtx.push(ivL + ' 최근10봉 중 ' + up + '봉 상승(전봉比), 직전봉 ' + j.chg1d + '%, 7봉 ' + j.chg7d + '%');
      cb();
    })
    .catch((err: unknown) => {
      h.fail(ivL + ' 흐름 확인 실패', rich('응답 오류 ' + String(err) + '. 기준 타임프레임 데이터로 계속합니다.'));
      cb();
    });
}
/** actMacro: 나스닥, 달러인덱스, 미 10년물을 실제로 받아 한 줄로. 코인이면 비트코인과 견준 세기까지 */
function actMacro(run: Run, coin: boolean, assetChg7: number | null, cb: (ctx: string) => void) {
  const syms = [['^IXIC', '나스닥'], ['DX-Y.NYB', '달러인덱스'], ['^TNX', '미 10년물']];
  const h = actStep(run, { kind: 'fetch', title: '매크로 환경 확인 중', h: '매크로 환경을 확인하는 중' });
  const t0 = Date.now();
  const total = syms.length + (coin ? 1 : 0);
  let done = 0;
  const res: ({ n: string; last: number; chg: number | null } | undefined)[] = [];
  const fails: string[] = [];
  let btc: Ohlc | null = null;
  const fin = () => {
    if (++done < total) return;
    const ok = res.filter((r): r is { n: string; last: number; chg: number | null } => !!r);
    const ms = Date.now() - t0;
    const rel = coin && btc && assetChg7 != null && btc.chg7d != null ? +(assetChg7 - btc.chg7d).toFixed(2) : null;
    if (!ok.length && rel == null) {
      h.fail('매크로 환경 확인 실패', rich('나스닥, 달러인덱스, 미 10년물 조회가 모두 실패했습니다. 매크로 없이 계속합니다.'));
      cb('');
      return;
    }
    const sign = (v: number | null) => ((v || 0) >= 0 ? '+' : '') + v;
    const line = ok.map((r) => r.n + ' ' + sign(r.chg) + '%').join(', ');
    const det: Rich = ['당일 실측: '];
    ok.forEach((r, i) => {
      if (i) det.push(', ');
      det.push({ b: r.n }, ' ' + r.last + ' (' + sign(r.chg) + '%)');
    });
    det.push('.');
    if (rel != null) det.push(' 비트코인 대비 7봉 상대강도 ', { b: (rel >= 0 ? '+' : '') + rel + '%p' }, '.');
    if (fails.length) det.push(' 조회 실패: ' + fails.join(', ') + '.');
    h.done('매크로 환경 확인 완료', rich(...det), ms + 'ms, ' + (ok.length + (rel != null ? 1 : 0)) + '종');
    const mline = line + (rel != null ? ', 비트코인 대비 7봉 상대강도 ' + (rel >= 0 ? '+' : '') + rel + '%p' : '');
    cb('\n[매크로 실측, 방금 수신] ' + mline + '.');
  };
  syms.forEach((s, i) => {
    ohlcViaProxy('yahoo', s[0], '1d')
      .then((j) => {
        res[i] = { n: s[1], last: j.last, chg: j.chg1d };
      })
      .catch(() => {
        fails.push(s[1]);
      })
      .then(fin, fin);
  });
  if (coin)
    ohlcViaProxy('binance', 'BTCUSDT', '1d')
      .then((j) => {
        btc = j;
      })
      .catch(() => {})
      .then(fin, fin);
}
/** actTfSweep: 1분, 15분, 1시간, 4시간을 차례로 실제로 받아 보고, 끝에 12개월로 넓혔다가 돌아온다 */
function actTfSweep(run: Run, ai: AiState, ast: AssetRef | null, cb: () => void) {
  const c = ast || ai.chart;
  TAI.tfCtx = [];
  if (!c || !c.data || c.data === 'none') {
    cb();
    return;
  }
  const isCur = !ast || (!!ai.chart && ai.chart.data === c.data);
  /* 도는 동안 차트를 오른쪽 아래에 작게 띄운다 (좁은 화면과 움직임 줄이기에서는 그대로 둔다) */
  let pip: ChartItem | null = null;
  if (isCur && ai.chart && G.cur === run.sess && window.innerWidth > 640 && !G_RM) {
    pip = curChartItem(run.sess);
    if (pip && pip.pip == null) {
      const host = document.getElementById(ai.chart.cid);
      const card = host && (host.closest('.g-chartcard') as HTMLElement | null);
      pip.pip = card ? card.offsetHeight : 0;
      sync();
    }
  }
  const fin = () => {
    if (pip) {
      pip.pip = null;
      bump();
    }
    cb();
  };
  let seq = ['1m', '15m', '1h', '4h'].filter((v) => v !== ai.tf);
  if (TAI.lastPlan && TAI.lastPlan.iv === '1w') seq = ['1d'];
  const got = G.ohlc && G.ohlc.meta ? G.ohlc.meta.iv : null;
  if (got) seq = seq.filter((v) => v !== got);
  let i = 0;
  const next = () => {
    if (run.data.status !== 'running') {
      fin();
      return;
    }
    if (i >= seq.length) {
      if (isCur && ai.chart && G.cur === run.sess) {
        ai.chart.interval = TAI_TFTV[ai.tf] || 'D';
        ai.chart.range = '12M';
        taiChartRender();
        const zh = actStep(run, { kind: 'chart', title: '차트를 12개월 범위로 전환 중', h: '차트 범위를 전환하는 중' });
        delay(1700, () => {
          if (ai.chart) {
            ai.chart.range = '3M';
            if (G.cur === run.sess) taiChartRender();
          }
          zh.done('차트 표시를 12개월 범위로 전환했습니다', rich('트레이딩뷰 위젯 표시 범위를 12개월로 전환했다가 3개월로 복귀했습니다. 장기 구조 판단은 수신한 일봉 데이터 기준으로 답변에서 다룹니다.'));
          fin();
        });
      } else fin();
      return;
    }
    const iv = seq[i++];
    const st = Date.now();
    actProbeIv(run, ai, iv, () => delay(Math.max(0, 700 - (Date.now() - st)), next), ast);
  };
  next();
}

/* ══ 전략 카드 (tfAiStrategy, tfVerifyGo) ══ */
/** tfAiStrategy(sp): AI 가 채운 전략 설계서를 카드 한 장으로. 인테이크 상태(S.tf)도 여기서 채운다 */
function tfAiStrategyCard(sess: Session, sp: StrategyTag) {
  const r = tfAiStrategy(sp);
  if ('noData' in r) {
    /* tfAiMsg */
    threadAdd(sess, { k: 'tfmsg', id: nid('tfm'), text: (r.noData || '이 자산') + '은 아직 백테스트할 가격 자료가 없습니다. 비트코인, 이더리움, 미국 대형주, 금, 나스닥 같은 자산으로 바꿔 보겠습니까?' });
    gScrollBottom();
    return;
  }
  const t = tfS();
  t.cloneFrom = null;
  t.followId = null;
  t.pendingP = null;
  t.cur = null;
  t.score = 0;
  t.workDone = false;
  t.aiSpec = r.spec;
  t.intake = r.intake;
  t.qi = TF_QS.length;
  t.stage = 'ready';
  tfSave();
  ACT.n++;
  threadAdd(sess, { k: 'tfsum', id: 'tfai' + Date.now().toString(36) + ACT.n, card: r.card });
  gScrollBottom();
  /* 만든 대화를 기억한다 (규칙 수정 대화가 같은 세션을 찾는다) */
  if (t.aiSpec && G.cur) {
    t.aiSpec.sess = G.cur.id;
    tfSave();
  }
}
/** tfVerifyGo(id): 카드를 완료 줄로 바꾸고 「과거로 돌려 보기」 화면으로 간다 */
export function tfVerifyGo(id: string) {
  const t = tfS();
  const sess = G.cur;
  if (sess && sess.items.concat(sess.thread).some((x) => x.id === id)) threadSwap(sess, id, { k: 'tfdone', id, asset: (t.intake.asset || { label: '' }).label || '' });
  t.stage = 'verify';
  t.tries = [];
  t.workDone = false;
  tfSave();
  STORE.flushNow();
  nav('#/share/bt/mine');
}
/** tfResume(): 완료 줄의 「이어서 보기」 */
export function tfResume() {
  STORE.flushNow();
  nav(tfResumeRoute(tfS().stage));
}

/* ══ 입력창 위 질문 패널 (sk-ask: skaCard, skaNav, skaPick, skaFree, skaNext, skaSend) ══ */
/** skaCard(cfg) */
function taiAskCard(sess: Session, cfg: AskCfg | null) {
  if (!cfg) return;
  let steps = cfg.steps && cfg.steps.length ? cfg.steps : cfg.options && cfg.options.length ? [{ title: cfg.title, multi: cfg.multi, options: cfg.options }] : null;
  if (!steps) return;
  steps = steps.slice(0, 4).filter((s) => s && s.options && s.options.length);
  if (!steps.length) return;
  if (G.mode !== 'conv' && G.mode !== 'activity') return;
  TAI.qn++;
  const id = 'gqc' + TAI.qn;
  /* 원본의 차례 그대로: 패널 틀을 먼저 놓고, 대화 줄에 한 줄을 넣고(아래 따라가기는 이때의 높이로 잰다), 그다음 패널을 채운다 */
  G.askDock = true;
  sync();
  threadAdd(sess, { k: 'asknote', id: id + '-n', n: steps.length, done: false });
  G.ask = { id, steps, idx: 0, picks: steps.map(() => []), free: steps.map(() => ''), freeOn: null };
  G.askDock = false;
  sync();
}
export function skaNav(dir: number) {
  const st = G.ask;
  if (!st) return;
  st.freeOn = null;
  st.idx = Math.max(0, Math.min(st.steps.length - 1, st.idx + dir));
  bump();
}
export function skaPick(i: number) {
  const st = G.ask;
  if (!st) return;
  const s = st.steps[st.idx];
  const p = st.picks[st.idx];
  if (s.multi) {
    const k = p.indexOf(i);
    if (k >= 0) p.splice(k, 1);
    else p.push(i);
    bump();
    return;
  }
  st.picks[st.idx] = [i];
  st.free[st.idx] = '';
  skaNext();
}
export function skaFreeOpen() {
  const st = G.ask;
  if (!st) return;
  st.freeOn = st.idx;
  bump();
}
export function skaFree(v: string) {
  const st = G.ask;
  if (!st) return;
  v = (v || '').trim();
  if (!v) {
    toast('답을 적어 주십시오');
    return;
  }
  st.free[st.idx] = v;
  st.picks[st.idx] = [];
  st.freeOn = null;
  skaNext();
}
export function skaNext() {
  const st = G.ask;
  if (!st) return;
  if (st.idx < st.steps.length - 1) {
    st.idx++;
    bump();
    return;
  }
  skaSend();
}
/** taiAskClose(id): 패널을 닫고 대화 줄의 한 줄 안내를 「질문에 답했습니다」로 */
export function taiAskClose() {
  const st = G.ask;
  if (!st) return;
  G.ask = null;
  for (const sx of G.sessions) {
    const n = sx.items.concat(sx.thread).find((x) => x.id === st.id + '-n');
    if (n && n.k === 'asknote') n.done = true;
  }
  sync();
  STORE.save();
}
/** taiAskSkip(id): 「AI가 알아서 판단」 */
export function taiAskSkip() {
  taiAskClose();
  gSend('세부 조건은 알아서 합리적으로 판단해서 바로 진행해줘');
}
function skaSend() {
  const st = G.ask;
  const sess = G.cur;
  if (!st || !sess) return;
  if (taiBusy()) {
    toast('이전 답변을 마무리하는 중입니다, 끝나면 다시 눌러 주십시오');
    bump();
    return;
  }
  const parts: string[] = [];
  const rows: { b: string; v: string }[] = [];
  for (let k = 0; k < st.steps.length; k++) {
    const ttl = (st.steps[k].title || '').replace(/[?？].*$/, '').trim();
    const vals = st.free[k] || st.picks[k].map((i) => st.steps[k].options[i].t).join(', ');
    if (!vals) continue;
    parts.push((ttl ? ttl + ': ' : '') + vals);
    rows.push({ b: ttl || '답', v: vals });
  }
  taiAskClose();
  if (!parts.length) {
    gSend('세부 조건은 알아서 합리적으로 판단해서 바로 진행해줘');
    return;
  }
  taiNextClear(sess);
  threadAdd(sess, { k: 'usum', id: nid('us'), rows });
  gUserPin();
  taiMarket(parts.join(' / ') + ' 기준으로 진행해줘', () => gConvAI(sess, '네트워크 연결을 확인한 뒤 다시 시도해 주십시오.'));
}

/* ══ 시장 질문 본체 (taiMarket) ══ */
function taiPushHist(sess: Session, t: string, acc: string) {
  const ai = aiOf(sess);
  ai.hist.push({ role: 'user', content: t });
  ai.hist.push({ role: 'assistant', content: acc });
  if (ai.hist.length > 24) ai.hist = ai.hist.slice(-24);
}
export function taiMarket(t: string, fallback?: () => void) {
  const sess = G.cur;
  if (!sess) return;
  void fallback; /* 원본은 사용량 문턱(tfAiGate)에 막혔을 때만 부른다. 그 문턱은 요금 화면 조각이 붙인다 */
  if (taiBusy()) {
    toast('이전 답변을 마무리하는 중입니다, 끝나면 바로 보내주십시오');
    return;
  }
  TAI.busy = true;
  TAI.busyAt = Date.now();
  bump();
  const ai = aiOf(sess);
  const conv = G.mode === 'conv';
  const tfReq = taiTfFrom(t);
  if (tfReq) {
    ai.tf = tfReq;
    if (ai.chart) {
      ai.chart.interval = TAI_TFTV[tfReq] || 'D';
      taiChartRender();
    }
  }
  /* 질문이 가리킨 자산이 지금 차트와 다르면 그 자산으로 시세를 받는다 */
  const mention = taiAssetFrom(t);
  let ast: AssetRef | null = mention && (!ai.chart || ai.chart.data !== mention.data) ? mention : null;
  const { isPred, qKind } = taiQKind(t, !!(ast || ai.chart));
  const plan = taiScope(t, tfReq);
  TAI.lastPlan = plan;
  const sys = taiBuildSystem({ conv, gStep: G.step, mirrorChart: G.chart, ai, strategy: sess.strategy, nowKst: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) });
  taiNextClear(sess);
  TAI.lastQ = t;
  let run = actStart(sess, taiStatusLabel(t, ai.chart ? ai.chart.label : null, isPred));
  /* 질문에서 자산이 잡히면 답을 기다리지 않고 차트를 먼저 연다 */
  if (mention && conv && G.cur === sess && (!ai.chart || ai.chart.data !== mention.data)) {
    taiChartOpen(sess, mention);
    ast = null;
  }
  let ansH: StepH | null = null;
  let lastUsage: { out?: number } | null = null;
  let seg = false;
  /* 생각 줄은 모델의 실제 생각 글이 올 때만 생긴다 (지어낸 대본은 원본에서도 뺐다) */
  let thinkH: ReturnType<typeof actThink> | null = null;
  const startThink = () => {
    if (thinkH || run.data.status !== 'running') return;
    thinkH = actThink(run);
  };
  /* 7초 넘게 조용하면 머리줄만 「결론을 정리하는 중」으로 */
  let brDone = false;
  run.lastEvt = Date.now();
  const brT = setInterval(() => {
    if (run.data.status !== 'running') {
      clearInterval(brT);
      return;
    }
    if (brDone || ansH || seg || !thinkH) return;
    if (thinkH.st.status !== 'running') return;
    if (Date.now() - (run.lastEvt || 0) < 7000) return;
    brDone = true;
    thinkH.st.h = '결론을 정리하는 중';
    bump();
  }, 1500);
  const pend: { s: StepH[]; f: StepH[]; o: (StepH | null)[] } = { s: [], f: [], o: [] };
  const add = <T extends Item>(it: T): T => {
    if (G.cur === sess) return threadAdd(sess, it);
    (conv ? sess.items : sess.thread).push(it);
    return it;
  };
  const fb = (kind: FailKind) => {
    TAI.busy = false;
    bump();
    actFinish(run, kind === 'abort' ? 'abort' : 'error');
    if (G.cur !== sess) return;
    if (kind === 'abort') {
      statusLine(sess, '여기서 멈췄습니다');
      if (TAI.lastQ) threadAdd(sess, { k: 'chip', id: nid('gnc'), label: '다시 생성', q: TAI.lastQ });
      delay(300, taiSpacerTrim);
      return;
    }
    taiErrCard(sess, t);
    delay(300, taiSpacerTrim);
  };
  const proceed = (ctx: string) => {
    /* 조사가 끝난 뒤에도 로그아웃했거나 대화가 지워졌으면 보내지 않는다 */
    if (!getState().user || G.sessions.indexOf(sess) < 0) {
      TAI.busy = false;
      bump();
      actFinish(run, 'abort');
      return;
    }
    const msgs = ai.hist.slice(-11).concat([{ role: 'user', content: t }]);
    let out: AiItem | null = null;
    let acc = '';
    let segAcc = '';
    let lastR = 0;
    let srchN = 0;
    const srcDom: string[] = [];
    let needBrk = false;
    let srcAll = 0;
    let fresOk = 0;
    let cmdH: StepH | null = null;
    let cmdN = 0;
    /* 말풍선은 글 조각마다 하나. 도구가 끼어들면 앞 말풍선을 확정해 닫는다 */
    const openOut = () => {
      segAcc = '';
      out = { k: 'ai', id: nid('am'), md: '', fresh: true, live: null };
      ACT_STREAMING.add(out);
      add(out);
    };
    const sealOut = () => {
      if (!out) return;
      out.md = stripTags(segAcc);
      out.live = null;
      out.fresh = false;
      out = null;
      bump();
    };
    NET.liteNext = qKind === 'lite';
    taiStream(
      sys + ctx,
      msgs,
      (delta) => {
        if (!out) {
          seg = false;
          if (thinkH) {
            thinkH.done();
            thinkH = null;
          }
          if (!ansH && run.data.status === 'running') ansH = actStep(run, { kind: 'ans', title: '답변 작성 중', h: '답변을 작성하는 중' });
          openOut();
        }
        run.lastEvt = Date.now();
        if (needBrk) {
          needBrk = false;
          if (acc && !/\s$/.test(acc) && delta.charAt(0) !== '\n') acc += '\n\n';
        }
        acc += delta;
        segAcc += delta;
        /* 확정된 줄은 줄바꿈 때만, 지금 쓰는 줄만 틈틈이 다시 그린다 */
        const nw = Date.now();
        if (out && (nw - lastR > 120 || delta.indexOf('\n') >= 0)) {
          lastR = nw;
          if (G.cur === sess) gScrollBottom();
          out.live = streamView(segAcc);
          out.fresh = false;
          if (G.cur === sess) sync();
        }
      },
      () => {
        const tg = parseTags(acc);
        TAI.busy = false;
        bump();
        if (thinkH) thinkH.done();
        if (ansH) ansH.done('답변 작성 완료', null, Math.max(1, Math.round((Date.now() - ansH.st.t0) / 1000)) + '초');
        actFinish(run, 'done', lastUsage);
        const live = G.cur === sess;
        if (tg.title && sess.title === '새 전략') sess.title = tg.title; /* AI 가 지은 대화 제목 */
        const clean = stripTags(acc);
        /* 다음 차례가 근거를 잃지 않게 도구 사용 기록을 대화 기억에만 덧붙인다 */
        taiPushHist(sess, t, clean + (srchN ? '\n\n[내부 도구 기록: 이 답변은 웹 검색 ' + srchN + '회를 실제 수행했고 참조 도메인은 ' + srcDom.join(', ') + '다. 사용자가 근거를 지적하면 검색 여부를 부정하지 말고 출처 연결 부족을 정정하라.]' : ''));
        let gauge = tg.gauge;
        if (gauge && !G.ohlc) gauge = null; /* 시세가 없으면 확률을 보이지 않는다 */
        const up = gaugeUp(gauge);
        const tl = taiTline(tg.tline, G.ohlc);
        const done = out as AiItem | null;
        if (done) {
          done.md = stripTags(segAcc);
          done.live = null;
          done.fresh = false;
          done.gauge = gauge && up != null ? { up, label: gauge.label || gauge.symbol || '', symbol: gauge.symbol || '', top: gauge.position !== 'bottom', anim: live } : null;
          done.tline = tl.length ? tl : null;
          done.src = srchN ? { n: srchN, all: srcAll, ok: fresOk } : null;
          done.acts = true;
        }
        sync();
        const info = tg.info;
        if (live && info && info.tv && (!ai.chart || ai.chart.tv !== info.tv)) {
          const stc = taiStatus(sess, '관련 차트를 불러오는 중');
          delay(900, () => {
            stc.done(null);
            if (G.cur === sess) taiChartOpen(sess, info);
          });
        }
        if (live && isPred && ai.ohlc && ai.ohlc.rows && ai.chart) delay(500, () => taiForecast(sess));
        if (tg.spec && live) {
          const spec = tg.spec as StrategyTag;
          sess.spec = spec;
          delay(info ? 1400 : 600, () => {
            if (G.cur === sess) tfAiStrategyCard(sess, spec);
          });
        }
        if (tg.order && live) {
          /* 예약 주문 카드(tfOrderCard)는 예약 주문 조각이 그린다. 받은 내용은 대화에 남겨 둔다 */
          sess.order = tg.order;
        } else if (tg.setup && conv && live) {
          /* 자동매매에 동의하면 전략 만들기로 바로 잇는다 */
          if (tg.setup.entryMode === 'dip' || tg.setup.entryMode === 'trend') sess.strategy.entryMode = tg.setup.entryMode;
          if (tg.setup.pair === 'BTC/USDT' || tg.setup.pair === 'ETH/USDT') sess.strategy.pair = tg.setup.pair;
          delay(info ? 1600 : 800, () => {
            if (G.mode === 'conv' && G.cur === sess) gSend('자동매매 전략 시작');
          });
        } else if (tg.ask && live) {
          const ask = tg.ask;
          delay(500, () => {
            if (G.cur === sess) taiAskCard(sess, ask);
          });
        } else if (live && ((tg.nexts && tg.nexts.length) || (tg.acts && tg.acts.length))) {
          delay(250, () => {
            if (G.cur === sess) taiNext(sess, (tg.nexts || []).slice(0, 3), (tg.acts || []).slice(0, 2));
          });
        }
        /* 전략을 찾아보려는 말이면 대화마다 한 번 공유 전략으로 가는 단추를 둔다 */
        if (live && conv && !tg.setup && !sess.ss3Chip && /전략[^.]{0,14}(추천|찾아|둘러|골라|어떤 게|뭐가|보여)|따라\s?(할|가|하고 싶)|카피\s?트레이딩|다른 사람[^.]{0,10}전략|잘 하는 사람|고수[^.]{0,8}(전략|따라)/.test(t)) {
          sess.ss3Chip = true;
          delay(700, () => {
            if (G.cur === sess) threadAdd(sess, { k: 'chip', id: nid('gnc'), label: '공유 전략 둘러보기', go: 'share' });
          });
        }
        if (live) delay(1600, taiSpacerTrim);
        STORE.save();
      },
      (kind) => {
        TAI.busy = false;
        bump();
        const cut = out as AiItem | null;
        if (!cut || (kind !== 'abort-partial' && kind !== 'error-partial')) {
          fb(kind);
          return;
        }
        /* 끊긴 데까지의 답은 남기고 이어가기를 준다 */
        actFinish(run, kind === 'abort-partial' ? 'abort' : 'error');
        const live = G.cur === sess;
        cut.md = beforeTags(segAcc);
        cut.live = null;
        cut.fresh = false;
        taiPushHist(sess, t, beforeTags(acc) + '\n\n[이 답변은 전송이 중단된 미완성 초안이며 결론과 출처 검증이 끝나지 않았다]');
        sync();
        if (live) {
          statusLine(sess, kind === 'abort-partial' ? '여기서 멈췄습니다' : '연결이 끊겨 답변이 중단되었습니다');
          threadAdd(sess, { k: 'chip', id: nid('gnc'), label: '이어서 계속', q: '방금 끊긴 답변을 이어서 계속 작성해줘' });
          delay(300, taiSpacerTrim);
        }
        STORE.save();
      },
      (meta) => {
        run.lastEvt = Date.now();
        if (meta.tok) run.data.tok = meta.tok;
        if (meta.usage) lastUsage = meta.usage;
        if (run.data.status !== 'running') return;
        if (meta.think) {
          if (!thinkH) startThink();
          if (thinkH) (thinkH as ReturnType<typeof actThink>).push(meta.think);
        }
        if (meta.tool) {
          /* 모델이 실제로 부른 도구 */
          needBrk = true;
          if (meta.tool.name === 'web_search') srchN++;
          if (!ansH && thinkH) {
            (thinkH as ReturnType<typeof actThink>).done();
            thinkH = null;
          }
          if (ansH) {
            /* 말하던 중에 도구를 쓰면 말풍선을 닫고, 그 아래 새 작업 묶음에서 잇는다 */
            ansH.done('작성 일시 중지, 자료 확인', null, Math.max(1, Math.round((Date.now() - ansH.st.t0) / 1000)) + '초');
            ansH = null;
            seg = true;
            sealOut();
            actFinish(run, 'done', null);
            run = actStart(sess, '자료를 더 확인하는 중');
          }
          if (meta.tool.name === 'market_data') {
            TAI.mdSteps[meta.tool.id || 'm' + Date.now()] = actStep(run, { kind: 'fetch', mdq: meta.tool.q || '', title: '시세 데이터 확인 중: ' + (meta.tool.q || ''), h: '시세 데이터를 확인하는 중' });
          } else if (meta.tool.name === 'web_search') {
            const q = meta.tool.q || '';
            pend.s.push(actStep(run, { kind: 'search', q, title: q ? '"' + q + '" 검색 중' : '웹 검색 중', h: '웹에서 검색하는 중' }));
          } else if (meta.tool.name === 'web_fetch') {
            const u = meta.tool.q || '';
            let dm = '';
            try {
              dm = new URL(u).hostname.replace(/^www\./, '');
            } catch {
              /* 주소가 아니면 그냥 출처로 적는다 */
            }
            pend.f.push(actStep(run, { kind: 'page', u, d: dm, title: (dm || '출처') + ' 페이지 여는 중', h: '페이지를 읽는 중' }));
          } else {
            const code = (meta.tool.q || '').replace(/\s+/g, ' ');
            /* 검색과 페이지를 부르는 배관 코드는 줄로 보이지 않는다 */
            if (/web_search\s*\(|web_fetch\s*\(/.test(code)) pend.o.push(null);
            else if (cmdH && run.data.steps.length && run.data.steps[run.data.steps.length - 1] === cmdH.st) {
              cmdN++;
              cmdH.st.status = 'running';
              cmdH.set('검색 결과를 정리하는 중 (' + cmdN + ')');
              pend.o.push(cmdH);
            } else {
              cmdN = 1;
              cmdH = actStep(run, { kind: 'cmd', title: '검색 결과를 정리하는 중', doneT: '검색 결과 정리 완료', failT: '결과 정리 실패', h: '검색 결과를 정리하는 중' });
              pend.o.push(cmdH);
            }
          }
        }
        if (meta.sres) {
          (meta.sres.results || []).forEach((r) => {
            try {
              const d = new URL(r.u).hostname.replace(/^www\./, '');
              if (srcDom.indexOf(d) < 0 && srcDom.length < 6) srcDom.push(d);
            } catch {
              /* 무시 */
            }
          });
          const hs = pend.s.shift();
          if (hs) {
            const qq = hs.st.q ? '"' + hs.st.q + '" ' : '웹 ';
            if (meta.sres.error) hs.fail(qq + '검색 실패');
            else {
              hs.done(qq + '검색 완료', meta.sres.results && meta.sres.results.length ? { k: 'srcs', rows: meta.sres.results } : null, meta.sres.n + '개 결과');
              srcAll += (meta.sres.results && meta.sres.results.length) || 0;
            }
          }
        }
        if (meta.fres) {
          const hf = pend.f.shift();
          if (hf) {
            if (meta.fres.error) hf.fail((hf.st.d || '출처') + ' 페이지 읽기 실패', rich(...(hf.st.u ? [hf.st.u, { br: true as const }] : []), '오류 코드: ' + String(meta.fres.error)));
            else {
              hf.done((hf.st.d || '출처') + ' 페이지 읽기 완료', hf.st.u ? rich({ a: hf.st.u }) : null);
              fresOk++;
            }
          }
        }
        if (meta.tres) {
          const ho = pend.o.shift();
          if (ho) {
            if (meta.tres.error) ho.fail(ho.st.failT || ho.st.title);
            else ho.done((ho.st.doneT || ho.st.title) + (ho === cmdH && cmdN > 1 ? ', ' + cmdN + '건' : ''));
          }
        }
        if (meta.mres) {
          const hm = TAI.mdSteps[meta.mres.id];
          if (hm) {
            delete TAI.mdSteps[meta.mres.id];
            if (meta.mres.ok) {
              const mm = meta.mres.meta || {};
              hm.done('시세 데이터 확인: ' + (hm.st.mdq || ''), null, (TAI_TFL[mm.iv || ''] || mm.iv || '') + ' ' + (mm.n || '') + '개, ' + (TAI_SRCNM[mm.src || ''] || mm.src || '') + (meta.mres.cached ? ', 재사용' : ''));
            } else hm.fail('시세 데이터 확인 실패: ' + (hm.st.mdq || ''), meta.mres.code ? rich('사유: ' + String(meta.mres.code) + '. 확보한 데이터로 계속합니다.') : null);
          }
        }
      },
    );
  };
  if (isPred) {
    const tgt = ast || ai.chart;
    const lb0 = tgt ? tgt.label : '자산';
    const shortT = t.replace(/\s+/g, ' ').slice(0, 40) + (t.length > 40 ? '…' : '');
    actNote(run, '"' + shortT + '" 판단에는 ' + lb0 + '의 현재가 위치, 매크로 환경, 타임프레임별 추세 확인이 필요합니다. 실시세부터 수신합니다.');
    /* 세 단계 조사: 자산 시세 > 매크로 > 여러 봉 간격 > 지표 계산 > 답변 */
    taiOhlc(
      (ctxA) => {
        const j0 = G.ohlc;
        const coin = !!tgt && (tgt.data || '').indexOf('binance:') === 0 && (tgt.data || '') !== 'binance:BTCUSDT';
        const chg7 = j0 && !(j0.meta && j0.meta.iv !== '1d') ? j0.chg7d : null;
        actMacro(run, coin, chg7, (ctxM) => {
          if (run.data.status !== 'running') return;
          actTfSweep(run, ai, ast, () => {
            const d = taiIndic(G.ohlc);
            if (d) {
              actStep(run, {
                kind: 'calc',
                status: 'done',
                title: '지표 계산 완료, RSI ' + d.rsi + ', 변동폭 ' + d.atrPct + '%',
                mR: '실계산',
                detail: rich(
                  '수신한 실데이터로 직접 계산했습니다. RSI(14, 단순 평균 방식) ',
                  { b: String(d.rsi) },
                  (d.rsi >= 70 ? ' (과열권)' : d.rsi <= 30 ? ' (과매도권)' : ' (중립)') + ', 일평균 변동폭(ATR14) ',
                  { b: d.atrPct + '%' },
                  ', 20일 이동평균 ' + d.ma20 + (d.ma50 ? ', 50일 이동평균 ' + d.ma50 : '') + ', 90일 레인지 위치 ',
                  { b: d.pos + '%' },
                  ', 최근 10봉 중 ' + d.up10 + '봉 상승, 스윙 밴드 ' + d.lo20 + '~' + d.hi20 + '.',
                ),
              });
              actNote(run, (d.last >= d.ma20 ? '가격이 20일선 위에 있어 ' : '가격이 20일선 아래라 ') + (d.rsi >= 60 ? '과열 여부를 함께 따져야 해서 상하방 시나리오를 모두 계산합니다.' : d.rsi <= 40 ? '지지선이 버티는지가 관건이라 하방 트리거부터 점검합니다.' : '추세와 모멘텀을 같이 놓고 시나리오를 계산합니다.'));
            }
            const tctx = TAI.tfCtx && TAI.tfCtx.length ? '\n[보조 타임프레임 실측, 방금 수신] ' + TAI.tfCtx.join(' / ') : '';
            const ictx = d ? '\n[실계산 지표, 방금 계산] RSI14(단순 평균) ' + d.rsi + ', 일평균 변동폭 ATR14 ' + d.atrPct + '%, 20봉 평균 ' + d.ma20 + (d.ma50 ? ', 50봉 평균 ' + d.ma50 : '') + ', 90봉 레인지 위치 ' + d.pos + '%, 스윙 밴드 ' + d.lo20 + '~' + d.hi20 : '';
            proceed(ctxA + ctxM + tctx + ictx);
          });
        });
      },
      sess,
      run,
      ast,
      plan,
    );
  } else if (ast || (ai.chart && ai.chart.data && ai.chart.data !== 'none')) {
    taiOhlc((ctx) => proceed(ctx), sess, run, ast, plan);
  } else if (taiPredictQ(t) || /어때|고민|분석|어떨|괜찮/.test(t)) {
    /* 시세 공급처가 없는 대상의 판단 질문: 매크로 한 줄을 보고 공개 정보로 조사한다 */
    actNote(run, '등록된 실시세 소스가 없는 대상입니다. 매크로 환경을 확인하고 공개 정보로 조사합니다.');
    actMacro(run, false, null, (ctxM) => proceed(ctxM || ''));
  } else proceed('');
}

/* ══ 스크립트 질문 카드 (프록시가 없을 때의 길: gConvInterpret, gAskMode, gAskPair, gAskTf, gAskRisk) ══ */
function gSetStep(sess: Session, st: string | null) {
  G.step = st;
  sess.step = st;
}
/** gClPg(): 「질문 M / N」 */
function gClPg(sess: Session): [number, number] {
  sess.clI = (sess.clI || 0) + 1;
  return [Math.min(sess.clI, sess.clN || sess.clI), sess.clN || sess.clI];
}
/** gConvChips(items,card) */
function gConvChips(sess: Session, items: ChipItem[], card: ChipCard | null, quiet?: boolean) {
  const id = 'gc' + Date.now();
  sess.pendingChips = { id, step: G.step, card, items };
  if (quiet) sess.items.push({ k: 'chips', id, items, card });
  else threadAdd(sess, { k: 'chips', id, items, card });
  STORE.save();
}
/** gClDropPending(): 어떤 길로 답했든 기다리던 질문 카드는 걷는다 */
function gClDropPending(sess: Session) {
  const pc = sess.pendingChips;
  if (!pc) return;
  sess.pendingChips = null;
  threadDrop(sess, pc.id);
  STORE.save();
}
/** gChipBind 의 누름 처리 */
export function chipPick(id: string, i: number) {
  const sess = G.cur;
  const pc = sess && sess.pendingChips;
  if (!sess || !pc || pc.id !== id) return;
  const it = pc.items[i];
  if (!it) return;
  sess.pendingChips = null;
  threadDrop(sess, id);
  if (it.act) gChipAct(sess, it.act, it.arg == null ? null : it.arg, it.label);
}
export function chipSkip(id: string) {
  const sess = G.cur;
  const pc = sess && sess.pendingChips;
  if (!sess || !pc || pc.id !== id) return;
  const card = pc.card;
  sess.pendingChips = null;
  threadDrop(sess, id);
  gConvAI(sess, '이 질문은 건너뛰고 추천값으로 진행하겠습니다.');
  if (card && card.skipAct) gChipAct(sess, card.skipAct, card.skipArg == null ? null : card.skipArg, null, true);
}
export function chipFree(id: string) {
  const sess = G.cur;
  const pc = sess && sess.pendingChips;
  if (!sess || !pc || pc.id !== id) return;
  if (pc.card && pc.card.freeHint) G.placeholder = pc.card.freeHint;
  fillInput(null, true); /* 카드는 그대로 둔다. 입력창에 적은 답도 같은 질문에 맞춰 읽는다 */
  toast('아래 입력창에 편하게 적어주십시오. 예를 들어 숫자만 적어도 알아듣습니다');
}
/** gChipAct(act,arg,label,silent) */
function gChipAct(sess: Session, act: string, arg: string | null, label: string | null, silent?: boolean) {
  const S = sess.strategy;
  if (['mode', 'pair', 'pair-reco', 'tf', 'tf-reco', 'risk', 'tp'].indexOf(act) >= 0) gClDropPending(sess);
  if (act === 'mode') {
    if (!silent && label) gConvUser(sess, label);
    S.entryMode = arg;
    delay(250, () => gNextAfterMode(sess));
    return;
  }
  if (act === 'mode-diff') {
    if (!silent) gConvUser(sess, '차이 설명');
    gConvAI(sess, '반등 매수는 과매도 후 회복을 노립니다, 거래가 적고 느립니다. 추세 진입은 상승 확인 후 따라갑니다, 거래가 잦고 빠릅니다.');
    delay(350, () => gAskMode(sess));
    return;
  }
  if (act === 'pair') {
    gPickPair(sess, arg || '', silent ? null : arg);
    return;
  }
  if (act === 'pair-reco') {
    if (!silent) gConvUser(sess, '추천');
    gConvAI(sess, '거래량과 데이터 안정성 기준으로 BTC/USDT를 권장합니다.');
    gPickPair(sess, 'BTC/USDT', null);
    return;
  }
  if (act === 'tf') {
    gPickTf(sess, arg || '', silent ? null : label);
    return;
  }
  if (act === 'tf-reco') {
    if (!silent) gConvUser(sess, '추천');
    gConvAI(sess, '반등형 조건에는 1시간봉이 균형점입니다.');
    gPickTf(sess, '1시간봉', null);
    return;
  }
  if (act === 'risk') {
    gPickRisk(sess, parseFloat(arg || '-3'), !!silent);
    return;
  }
  if (act === 'tp') {
    if (arg == null || arg === 'null') {
      if (!silent) gConvUser(sess, '익절 없이 진행');
      S.tpNum = null;
      S.tp = '미설정';
    } else {
      if (!silent) gConvUser(sess, '익절 +' + arg + '% 설정');
      S.tpNum = parseFloat(arg);
      S.tp = '+' + arg + '%';
    }
    delay(300, () => gMakePlan(sess));
  }
}
/** gConvInterpret(text) */
function gConvInterpret(sess: Session, text: string) {
  gThink(sess, '아이디어 확인 중', 800, () => {
    const S = sess.strategy;
    const r = readIdea(text);
    if (r.entryMode) S.entryMode = r.entryMode;
    if (r.pair) S.pair = r.pair; /* 문장에서 이미 말한 자산은 다시 묻지 않는다 */
    if (r.sl != null) S._slIntent = r.sl;
    if (r.tp != null) S._tpIntent = r.tp;
    sess.clN = (S.entryMode ? 0 : 1) + (S.pair ? 0 : 1) + 1 + (S._slIntent != null ? 0 : 1) + (S._tpIntent != null ? 0 : 1);
    sess.clI = 0;
    const ack = S.pair ? ' 대상은 ' + S.pair + '로 이해했습니다.' : '';
    const said: string[] = [];
    if (r.sl != null) said.push('손절 -' + S._slIntent + '%');
    if (r.tp != null) said.push('익절 +' + S._tpIntent + '%');
    const ack2 = said.length ? ' 말씀하신 ' + said.join('와 ') + '는 그대로 반영해두겠습니다.' : '';
    gConvAI(sess, '아이디어를 확인했습니다.' + ack + ack2 + ' 검증 가능한 조건으로 만들기 위해 몇 가지를 확인합니다.');
    delay(400, () => (S.entryMode ? gNextAfterMode(sess) : gAskMode(sess)));
  });
}
function gNextAfterMode(sess: Session) {
  if (G.cur !== sess) return;
  if (sess.strategy.pair) gPickPair(sess, sess.strategy.pair, null);
  else gAskPair(sess);
}
function gAskMode(sess: Session) {
  if (G.cur !== sess) return;
  gSetStep(sess, 'mode');
  gConvChips(
    sess,
    [
      { label: '내려왔을 때 반등 매수', desc: '과매도 후 되돌림을 노립니다. 거래가 적고 느긋합니다.', act: 'mode', arg: 'dip' },
      { label: '오르는 흐름에 진입', desc: '상승 확인 후 따라갑니다. 거래가 잦고 빠릅니다.', act: 'mode', arg: 'trend' },
      { label: '차이를 더 알려주십시오', desc: '두 방식의 차이를 설명해드립니다.', act: 'mode-diff' },
    ],
    { title: '진입 방식을 정해주십시오', sub: '전략의 성격을 결정하는 질문입니다.', pg: gClPg(sess), skipAct: 'mode', skipArg: 'dip', freeHint: '예: 반등 매수로' },
  );
}
function gAskPair(sess: Session) {
  if (G.cur !== sess) return;
  gSetStep(sess, 'pair');
  gConvChips(
    sess,
    [
      { label: 'BTC/USDT', desc: '유동성이 가장 깊어 검증 데이터가 안정적입니다.', act: 'pair', arg: 'BTC/USDT' },
      { label: 'ETH/USDT', desc: '변동성이 조금 더 커서 기회와 위험이 함께 커집니다.', act: 'pair', arg: 'ETH/USDT' },
      { label: 'AI 추천으로', desc: '거래량과 데이터 안정성 기준으로 골라드립니다.', act: 'pair-reco' },
    ],
    { title: '어떤 자산으로 하겠습니까?', sub: '검증과 실행의 대상이 되는 자산입니다.', pg: gClPg(sess), skipAct: 'pair-reco', freeHint: '예: 비트코인으로' },
  );
}
function gPickPair(sess: Session, pair: string, label: string | null) {
  if (G.cur !== sess) return;
  gClDropPending(sess);
  if (label) gConvUser(sess, label);
  const S = sess.strategy;
  S.pair = pair;
  const AKO: Record<string, string> = { 'BTC/USDT': '비트코인', 'ETH/USDT': '이더리움' };
  const nmBase = (AKO[pair] || pair.split('/')[0]) + (S.entryMode === 'trend' ? ' 따라타기' : ' 눌림목 줍기');
  let nm = nmBase;
  let dupK = 2;
  while (G.sessions.some((x) => x !== sess && x.title === nm)) nm = nmBase + ' ' + dupK++ + '호';
  S.name = nm;
  sess.title = nm;
  sess.sub = pair;
  bump();
  delay(350, () => gAskTf(sess));
}
function gAskTf(sess: Session) {
  if (G.cur !== sess) return;
  gSetStep(sess, 'tf');
  gConvChips(
    sess,
    [
      { label: '1시간마다', desc: '기회를 자주 잡지만 거래도 잦아집니다.', act: 'tf', arg: '1시간봉' },
      { label: '하루 1회', desc: '느긋하게 굵직한 흐름만 봅니다.', act: 'tf', arg: '일봉' },
      { label: 'AI 추천으로', desc: '진입 방식에 맞는 균형점을 골라드립니다.', act: 'tf-reco' },
    ],
    { title: '얼마나 자주 확인하겠습니까?', sub: '짧을수록 거래가 잦아집니다.', pg: gClPg(sess), skipAct: 'tf-reco', freeHint: '예: 1시간마다' },
  );
}
function gPickTf(sess: Session, tf: string, label: string | null) {
  if (G.cur !== sess) return;
  gClDropPending(sess);
  if (label) gConvUser(sess, label);
  const S = sess.strategy;
  S.tf = tf;
  S.entry = S.entryMode === 'trend' ? '20일 이동평균 상향 돌파 + 거래량 확인' : 'RSI 30 이하 과매도 후 20일 이동평균 회복';
  delay(350, () => gAskRisk(sess));
}
function gAskRisk(sess: Session) {
  if (G.cur !== sess) return;
  const S = sess.strategy;
  if (S._slIntent != null) {
    const s0 = -Math.abs(S._slIntent);
    gConvAI(sess, '손실 한도는 말씀하신 ' + s0 + '%로 설정합니다. 이 선에서 자동 손절합니다.');
    delay(450, () => gPickRisk(sess, s0, true));
    return;
  }
  gSetStep(sess, 'risk');
  gConvChips(
    sess,
    [
      { label: '-2%', desc: '보수적으로. 손실은 작지만 자주 잘릴 수 있습니다.', act: 'risk', arg: '-2' },
      { label: '-3% (표준)', desc: '대부분의 검증에서 균형이 좋았던 기본값입니다.', act: 'risk', arg: '-3' },
      { label: '-5%', desc: '여유를 주는 대신 한 번의 손실이 커집니다.', act: 'risk', arg: '-5' },
    ],
    { title: '한 번의 거래에서 얼마까지 잃어도 되겠습니까?', sub: '이 선에 닿으면 자동으로 손절합니다.', pg: gClPg(sess), skipAct: 'risk', skipArg: '-3', freeHint: '예: -3%' },
  );
}
function gPickRisk(sess: Session, sl: number, silent: boolean) {
  if (G.cur !== sess) return;
  gClDropPending(sess);
  if (!silent) gConvUser(sess, sl + '%');
  const S = sess.strategy;
  S.slNum = sl;
  S.sl = sl + '%';
  S.risk = sl === -2 ? '낮음' : sl === -3 ? '보통' : '다소 높음';
  gThink(sess, '전략 점검 중', 900, () => {
    if (S._tpIntent != null) {
      const tp0 = Math.abs(S._tpIntent);
      S.tpNum = tp0;
      S.tp = '+' + tp0 + '%';
      gConvAI(sess, '익절은 말씀하신 +' + tp0 + '%로 설정했습니다.');
      delay(350, () => gMakePlan(sess));
      return;
    }
    gSetStep(sess, 'tp');
    gConvChips(
      sess,
      [
        { label: '익절 +8% 설정', desc: '수익 확정 지점을 두고 낙폭을 관리합니다.', act: 'tp', arg: '8' },
        { label: '익절 없이 진행', desc: '추세를 끝까지 따라갑니다. 되돌림은 감수합니다.', act: 'tp', arg: null },
      ],
      { title: '수익은 어디서 확정하겠습니까?', sub: '확정 지점이 없으면 벌었다가 되돌려줄 수 있습니다.', pg: gClPg(sess), skipAct: 'tp', skipArg: '8', freeHint: '예: +8% 또는 없이' },
    );
  });
}
/** gMakePlan(): 질문이 끝났다. 이 뒤의 대화 안 검증(gBtRun)은 백테스트 조각이 잇는다 */
function gMakePlan(sess: Session) {
  if (G.cur !== sess) return;
  gSetStep(sess, null);
  gThink(sess, '조건 정리 중', 700, () => {
    gConvAI(sess, '조건을 정리했습니다. 화면 이동 없이 여기서 바로 과거 데이터로 검증하겠습니다.');
    STORE.save();
  });
}

/* ══ 보내기 (gNew, gSend) ══ */
/** taiOffline(t,retry): AI 가 정말 닿지 않을 때 사실대로 알리고 다시 보내기를 준다 */
function taiOffline(sess: Session, retry: () => void) {
  gConvAI(sess, '지금 AI 서버에 연결되지 않아 답을 드리지 못했습니다. 잠시 뒤 다시 보내 주십시오.');
  const id = 'goff' + Date.now();
  TAI.offq[id] = retry;
  /* 원본은 이 단추를 기록에 남기지 않는다(화면에만 붙인다). 여기서도 다시 열면 사라지게 저장 전에 뺀다 */
  threadAdd(sess, { k: 'chip', id, label: '다시 보내기', go: 'offretry' });
}
/**
 * gNew(preset): 홈에서 보낸 첫 말로 새 대화를 연다.
 * text 는 해석에 쓰는 글(템플릿 명령 포함), typed 는 사용자가 실제로 친 글(말풍선에는 이것만).
 */
export function gNew(text: string, typed: string) {
  const sx = newSession(Date.now(), typed || null);
  G.sessions.unshift(sx);
  G.cur = sx;
  taiBind(sx);
  STORE.save();
  gShowConv();
  gConvUser(sx, typed || text);
  /* 첫 말부터 실제 AI 와 대화한다. 프록시가 없을 때만 스크립트 질문 */
  taiEnsure((ok) => {
    if (G.cur !== sx) return;
    const go = () => {
      G.step = null;
      gUserPin();
      taiMarket(text, () => gConvInterpret(sx, text));
    };
    if (ok) go();
    else if (taiIsStratText(text)) gConvInterpret(sx, text);
    else taiOffline(sx, go);
  });
}
/** gSend(): 아래 입력창에서 보낸다. 보냈으면 true (입력창을 비운다) */
export function gSend(raw: string): boolean {
  const ok = gSendGo(raw);
  if (ok) fillInput('', false); /* 보냈으면 입력창을 비운다 */
  return ok;
}
function gSendGo(raw: string): boolean {
  if (taiBusy()) {
    toast('이전 답변을 마무리하는 중입니다, 끝나면 바로 보내주십시오');
    return false;
  }
  const t = (raw || '').trim();
  const sess = G.cur;
  if (!t || !sess) return false;
  if (G.mode === 'conv') {
    const S = sess.strategy;
    const st = G.step;
    gConvUser(sess, t);
    const check = (ms: number, fn: () => void) => gThink(sess, '확인 중', ms, fn);
    if (st === 'pair' && /이더|eth/i.test(t)) return (check(450, () => gPickPair(sess, 'ETH/USDT', null)), true);
    if (st === 'pair' && /비트|btc/i.test(t)) return (check(450, () => gPickPair(sess, 'BTC/USDT', null)), true);
    if (st === 'mode' && /반등|눌림|내려|떨어|저가/.test(t))
      return (
        check(450, () => {
          S.entryMode = 'dip';
          gNextAfterMode(sess);
        }),
        true
      );
    if (st === 'mode' && /추세|오르|돌파|따라/.test(t))
      return (
        check(450, () => {
          S.entryMode = 'trend';
          gNextAfterMode(sess);
        }),
        true
      );
    if (st === 'tf' && /1\s*시간|시간봉/.test(t)) return (check(450, () => gPickTf(sess, '1시간봉', null)), true);
    if (st === 'tf' && /하루|일봉|매일/.test(t)) return (check(450, () => gPickTf(sess, '일봉', null)), true);
    const m = t.match(/(\d+(?:\.\d+)?)\s*%?/);
    if ((st === 'risk' || st === 'tp') && m) {
      if (st === 'risk') {
        gClDropPending(sess);
        check(450, () => gPickRisk(sess, -Math.abs(parseFloat(m[1])), true));
        return true;
      }
      if (!/없|안 |스킵/.test(t)) {
        gClDropPending(sess);
        check(450, () => gChipAct(sess, 'tp', String(Math.abs(parseFloat(m[1]))), null, true));
        return true;
      }
    }
    if (st === 'tp' && /없|안 할|그냥 진행/.test(t)) {
      gClDropPending(sess);
      check(450, () => gChipAct(sess, 'tp', null, null, true));
      return true;
    }
    /* 기다리는 선택지의 글과 바로 맞춰 본다. 말로 답해도 같은 길로 간다 */
    const pcS = sess.pendingChips;
    if (pcS) {
      const baseL = (x: string) => x.replace(/\s*\(.*\)$/, '').trim();
      const hit = pcS.items.find((it) => {
        const bl = baseL(it.label);
        return !!bl && (t.indexOf(bl) >= 0 || bl.indexOf(t) >= 0);
      });
      if (hit) {
        sess.pendingChips = null;
        threadDrop(sess, pcS.id);
        gThink(sess, '확인 중', 400, () => {
          if (hit.act) gChipAct(sess, hit.act, hit.arg == null ? null : hit.arg, hit.label, true);
        });
        return true;
      }
    }
    const cannedC = () => {
      const pc2 = sess.pendingChips;
      if (pc2) {
        gConvAI(sess, '아래에서 골라주십시오. 원하는 답이 없으면 비슷하게 적어주셔도 됩니다.');
        if (!sess.items.some((x) => x.id === pc2.id)) {
          sess.pendingChips = null;
          if (pc2.step) gSetStep(sess, pc2.step);
          gConvChips(sess, pc2.items, null);
        }
      } else gConvAI(sess, '무슨 뜻인지 확실하지 않습니다. 예를 들어 "손절 -3%로", "비트코인으로", "반등 매수로"처럼 적어주시면 이어갈 수 있습니다.');
    };
    if (getState().user)
      taiEnsure((ok) => {
        if (ok) {
          gUserPin();
          taiMarket(t, cannedC);
        } else gThink(sess, '확인 중', 600, cannedC);
      });
    else gThink(sess, '확인 중', 600, cannedC);
    return true;
  }
  /* 연구 과정 화면에서 보낸 말: 문서 쪽 기록에 쌓는다 (그 화면의 답 표시는 연구 화면 조각이 붙인다) */
  sess.thread.push({ k: 'user', id: nid('u'), text: t });
  const think: Item = { k: 'think', id: nid('gth'), label: '' };
  sess.thread.push(think);
  STORE.save();
  const canned = () => {
    sess.thread = sess.thread.filter((x) => x !== think);
    sess.thread.push({ k: 'ai', id: nid('a'), plain: '아직 검증 결과가 없습니다. 연구를 먼저 시작하십시오.' });
    STORE.save();
  };
  if (getState().user)
    taiEnsure((ok) => {
      if (ok) taiMarket(t, canned);
      else delay(900, canned);
    });
  else delay(900, canned);
  return true;
}

/* ══ 시작, 로그인, 로그아웃 ══ */
/** gBoot 의 연결 쪽: 프록시 주소를 정하고 한 번 두드려 본다. 새로고침으로 돌아온 대화는 끝으로 내린다 */
export function taiBoot() {
  /* 원본은 프록시 주소를 알아낸 뒤에 마지막 대화를 다시 열고 맨 아래로 내린다. React 판은 대화를 먼저 그려 두므로
     그때와 글꼴이 다 들어온 때(줄 높이가 바뀐다)에 한 번씩 더 맨 아래를 맞춘다 */
  const again = () => {
    if (G.cur && G.mode === 'conv') gScrollBottom();
  };
  taiResolveProxy(() => {
    taiPing();
    again();
  });
  if (G.cur && G.mode === 'conv') gScrollBottom(true);
  try {
    document.fonts.ready.then(again).catch(() => {});
  } catch {
    /* 무시 */
  }
}
/* 새로고침으로 돌아온 대화: 끊긴 작업 기록을 접힌 요약으로 되살린다 */
if (G.cur) hooks.onShowConv?.(G.cur);

/** signupDone 의 뒤쪽: 보내려던 말이나 치다 만 글이 있으면 가입 직후 이어서 보낸다 */
authHooks.signedIn = () => {
  const pn = getState().pendingNew;
  if (pn != null) {
    setState({ pendingNew: null });
    delay(300, () => gNew(pn, pn));
    return;
  }
  const dr = G.homeDraft ? G.homeDraft() : null;
  if (dr) delay(300, () => gNew(dr.text, dr.typed));
};
/** gLogout 의 대화 쪽: 받던 답을 끊고, 메모리와 저장소에 남은 대화와 전략 상태를 지운다 */
authHooks.loggedOut = () => {
  try {
    if (NET.req && NET.req.ctrl) NET.req.ctrl.abort();
  } catch {
    /* 무시 */
  }
  NET.req = null;
  TAI.busy = false;
  tfClear();
  convReset();
};
export { gHome, gSelect };
