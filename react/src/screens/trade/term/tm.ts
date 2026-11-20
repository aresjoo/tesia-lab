// 터미널의 화면 상태(TF_TM)와 동작. 원본 tfTm* 가운데 상태를 고치는 것들을 옮겼다.
// 계정 상태(S.tf)는 store 의 updateTf 로만 고친다. 원본이 s.ref 를 그 자리에서 고치던 것은 사본에서 같은 줄을 찾아 고친다.
import { tfDerive } from '../../../core/account/derive';
import { tfNotify } from '../../../core/account/nf';
import type { SayResult, TmCand } from '../../../core/trade/say';
import { TFC, type RuleP, type Strat, type TermClone, type TfState } from '../../../core/trade/state';
import { tfTmAll, tfTmCalc, tfTmKey, tfTmPct, tfTmPx, tfTmWon, type TermCalc, type TermRow } from '../../../core/trade/term';
import { nav } from '../../../state/route';
import { getState, toast } from '../../../state/store';
import { bump, getPreview, getTf, updateTf } from '../store';

export type BrainTab = 'agent' | 'dash' | 'done';
export type Prop = SayResult | { kind: 'applied'; nv: string; key: string } | null;

/** TF_TM */
export const TF_TM = {
  sel: null as string | null,
  tab: 'agent' as BrainTab,
  scope: 'cur' as 'cur' | 'all',
  q: '',
  fst: 'all',
  fex: 'all',
  feedN: 14,
  exp: {} as Record<string, boolean>,
  fmode: 'all' as 'all' | 'act',
  pvBase: 0,
  pvEval: {} as Record<string, number>,
  /* 아래는 원본이 DOM class 로 들고 있던 것 */
  /** 모바일 구역 (nfxh-wrap 의 mt-<k>) */
  mt: 'chart',
  /** 하단에서 켜진 pane */
  pane: 'pos',
  /** 판단 패널 머리의 전략 목록이 열렸는지 (rail-open) */
  railOpen: false,
  /** #tft-prop 에 띄운 답이나 변경안 */
  prop: null as Prop,
  /** TF_TM_CAND */
  cand: null as TmCand | null,
  /** TF_TM_LASTQ */
  lastQ: '',
  /** NF_TAB */
  nfTab: 'all',
  /** window.TF_NFH_OPEN: 터미널이 뜬 뒤 열 하단 구역 (알림 딥링크) */
  nfh: null as string | null,
};
/* QA 용: 원본에서 고른 전략과 탭을 같은 모양으로 넘겨받는다 (tools/compare.mjs) */
try {
  const seed = JSON.parse(sessionStorage.getItem('teth.react.tm') || 'null');
  if (seed && typeof seed === 'object') Object.assign(TF_TM, seed);
} catch {
  /* 무시 */
}
export function setTm(patch: Partial<typeof TF_TM>) {
  Object.assign(TF_TM, patch);
  bump();
}

export const all = (): TermRow[] => tfTmAll(getTf(), getPreview());
/** tfTmOf(key) */
export const tfTmOf = (key: string | null): TermRow | null => (key ? all().find((s) => s.key === key) || null : null);
export const calc = (s: TermRow): TermCalc => tfTmCalc(s, getTf());

/** tfTmInert(): 미리 보기에서는 조작하지 못한다 */
export function tfTmInert(): boolean {
  if (!getPreview()) return false;
  toast('미리 보기에서는 조작할 수 없습니다');
  return true;
}

/** 사본 안에서 그 전략의 저장된 줄을 찾는다 (원본의 s.ref) */
function refIn(t: TfState, s: TermRow): Strat | TermClone | null {
  if (s.src === 'user') return (t.strat || []).find((x) => 'user:' + x.at === s.key) || null;
  if (s.src === 'clone') return (t.termClones || []).find((x) => 'clone:' + x.id === s.key) || null;
  return null;
}
type DemoOv = { name?: string; ver?: string; status?: string; cap?: number; p?: RuleP; verHist?: unknown[] };
function demoOv(t: TfState, s: TermRow): DemoOv {
  t.termDemo = t.termDemo || {};
  const id = (s.ref as { id: string }).id;
  return (t.termDemo[id] = t.termDemo[id] || {}) as DemoOv;
}

/** tfTmLogAdd(key,type,txt,extra): 운영 기록. 전략마다 최근 서른 */
function logAdd(t: TfState, key: string, type: string, txt: string, ver?: string, extra?: Record<string, unknown> | null) {
  t.termLog = t.termLog || {};
  if (!Array.isArray(t.termLog[key])) t.termLog[key] = [];
  const lg = t.termLog[key];
  lg.push({ id: Date.now() + '' + Math.floor(Math.random() * 999), at: Date.now(), type, txt, ver, extra: extra || null });
  if (lg.length > 30) lg.shift();
}
/** tfTmEvalMark(key) */
function evalMark(t: TfState, key: string) {
  if (getPreview()) {
    TF_TM.pvEval[key] = Date.now();
    return;
  }
  t.termEval = t.termEval || {};
  t.termEval[key] = Date.now();
}
/** tfTmEvalAt(s) */
export function tfTmEvalAt(s: TermRow): number | null {
  if (s.src === 'demo') return TF_TM.pvEval[s.key] || TF_TM.pvBase || null;
  const t = getTf();
  return (t.termEval && t.termEval[s.key]) || null;
}
/** tfTmEvalTick() 의 한 걸음: 실행 중 전략의 평가 시각을 찍는다. init 이면 아직 없는 것만 */
export function evalStep(init: boolean) {
  const live = all().filter((s) => s.status === 'live' && !(init && tfTmEvalAt(s)));
  if (!live.length) {
    bump();
    return;
  }
  if (getPreview()) {
    live.forEach((s) => (TF_TM.pvEval[s.key] = Date.now()));
    bump();
    return;
  }
  updateTf((t) => live.forEach((s) => evalMark(t, s.key)));
}

/** tfNFCanRun(): 거래소 연결을 마쳐야 실행할 수 있다 */
export function tfNFCanRun(t: TfState): boolean {
  if (t.conn) return true;
  toast('거래소 연결을 먼저 완료해야 실행할 수 있습니다');
  if (t.cur && t.score >= TFC.score.pass) setTimeout(() => nav('#/strategy/connect'), 0);
  return false;
}
/** tfBotCtl(botId,act,silent=true): 터미널 안에서의 상태 전환 */
export function botCtl(t: TfState, b: Strat, act: 'pause' | 'resume' | 'start') {
  const botId = String(b.at);
  if (act === 'pause') {
    b.status = 'off';
    tfNotify('bot', 'bp:' + botId + ':' + Date.now(), b.name + ' 을 중지했습니다', '새 진입이 차단됩니다. 언제든 재개할 수 있습니다.', '#/trade/bot/' + botId);
  } else if (act === 'resume') {
    if (b.env !== 'paper' && !tfNFCanRun(t)) return;
    b.status = 'live';
    tfNotify('bot', 'br:' + botId + ':' + Date.now(), b.name + ' 을 재개했습니다', '', '#/trade/bot/' + botId);
  } else {
    if (!tfNFCanRun(t)) return;
    b.status = 'live';
    b.env = b.env || 'live';
    tfNotify('bot', 'bs:' + botId, b.name + ' 실행 시작 (' + (b.env === 'paper' ? '가상' : '라이브 시뮬레이션') + ')', '체결이 발생하면 알림과 복기 리포트가 도착합니다.', '#/trade/bot/' + botId);
    toast('전략이 시작됐습니다');
  }
}

/** tfTmSetStatus(key,ns,reason): 상태 전환 공통 함수 (알림과 운영 기록) */
export function tfTmSetStatus(key: string, ns: 'live' | 'off', reason?: string): boolean {
  if (tfTmInert()) return false;
  const s = tfTmOf(key);
  if (!s) return false;
  const os = s.status;
  if (os === ns) return false;
  if (ns === 'live' && os === 'err') {
    toast('연결 오류 상태입니다. 먼저 다시 연결해주십시오');
    return false;
  }
  if (ns === 'live' && s.src !== 'user') {
    const sc0 = calc(s).score;
    if (sc0 < TFC.score.pass) {
      toast('재검증 점수 ' + sc0 + '점, 실행 기준(' + TFC.score.pass + '점) 미달입니다. 전략을 수정해 기준을 넘겨주십시오');
      return false;
    }
  }
  let ok = true;
  updateTf((t) => {
    if (s.src === 'user') {
      const b = refIn(t, s) as Strat | null;
      if (!b) {
        ok = false;
        return;
      }
      botCtl(t, b, ns === 'live' ? (os === 'ready' ? 'start' : 'resume') : 'pause');
      if (b.status !== ns) {
        ok = false; /* 연결 가드로 전환이 안 됐으면 기록하지 않는다 */
        return;
      }
    } else if (s.src === 'demo') demoOv(t, s).status = ns;
    else {
      const r = refIn(t, s);
      if (r) r.status = ns;
    }
    if (ns === 'live') {
      if (t.termFlat) delete t.termFlat[key];
      evalMark(t, key);
    }
    const evT = ns === 'live' ? (os === 'ready' ? 'STARTED' : 'RESUMED') : 'PAUSED';
    logAdd(t, key, evT, ns === 'live' ? (os === 'ready' ? '전략 실행을 시작했습니다' : '전략 실행을 재개했습니다') : '전략 실행을 중지했습니다' + (reason ? '. ' + reason : ''), s.ver);
  });
  return ok;
}

/** tfTmReconnect(key) */
export function tfTmReconnect(key: string) {
  const s = tfTmOf(key);
  if (!s) return;
  toast('연결을 다시 시도하는 중…');
  setTimeout(() => {
    updateTf((t) => {
      if (s.src === 'demo') demoOv(t, s).status = 'off';
      else if (s.src === 'clone') {
        const r = refIn(t, s);
        if (r) r.status = 'off';
      }
      logAdd(t, key, 'RECONNECTED', '거래소 연결을 복구했습니다. 전략은 중지 상태로 대기합니다. 확인 후 재개하십시오.', s.ver);
    });
    toast('연결이 복구됐습니다. 전략은 중지 상태입니다');
  }, 900);
}

/** tfTmSelect(key) */
export function tfTmSelect(key: string) {
  if (TF_TM.sel === key) return;
  setTm({ sel: key, exp: {}, feedN: 14, railOpen: false });
}

/** tfTmRenameGo(key): 이름을 바꾼다. 비어 있으면 false */
export function tfTmRenameGo(key: string, value: string): boolean {
  const s = tfTmOf(key);
  if (!s) return false;
  const nm = value.trim();
  if (!nm) {
    toast('이름을 입력해주십시오');
    return false;
  }
  updateTf((t) => {
    if (s.src === 'demo') demoOv(t, s).name = nm;
    else {
      const r = refIn(t, s);
      if (r) r.name = nm;
    }
    logAdd(t, key, 'RENAMED', '전략 이름을 "' + nm + '"(으)로 변경했습니다', s.ver);
  });
  toast('이름을 변경했습니다');
  return true;
}
const gEsc = (t: string) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** tfTmClone(key,ex): 실행 전 상태의 사본을 만든다 */
export function tfTmClone(key: string, ex: string | null, exName?: string) {
  const s = tfTmOf(key);
  if (!s) return;
  const id = Date.now();
  updateTf((t) => {
    if (!Array.isArray(t.termClones)) t.termClones = [];
    t.termClones.push({ id, name: s.name + (ex ? ' (' + exName + ')' : ' 사본'), ex: ex || (s.ex as string), asset: s.asset, sym: s.sym, mkt: s.mkt, tv: s.tv, cap: s.cap, ver: 'v1.0', status: 'ready', p: JSON.parse(JSON.stringify(s.p)), verHist: [] } as TermClone);
    logAdd(t, 'clone:' + id, 'CLONED', '"' + s.name + '" ' + gEsc(s.ver) + '에서 복제됨, 실행 전 상태로 대기', 'v1.0');
  });
  toast('전략을 복제했습니다. 실행 전 상태입니다');
  setTm({ sel: 'clone:' + id });
}
/** tfTmDeleteGo(key) */
export function tfTmDeleteGo(key: string) {
  const s = tfTmOf(key);
  if (!s) return;
  if (TF_TM.sel === key) TF_TM.sel = null;
  updateTf((t) => {
    if (s.src === 'demo') {
      if (!Array.isArray(t.termDel)) t.termDel = [];
      t.termDel.push((s.ref as { id: string }).id);
    } else if (s.src === 'clone') t.termClones = (t.termClones || []).filter((x) => 'clone:' + x.id !== key);
    else t.strat = (t.strat || []).filter((x) => 'user:' + x.at !== key);
    if (t.termLog) delete t.termLog[key];
  });
  toast('전략을 삭제했습니다');
}

/** 예산 변경 (tfTmSayQ 의 예산 가지) */
export function capUpdate(key: string, n: number) {
  const s = tfTmOf(key);
  if (!s) return;
  const old = s.cap;
  updateTf((t) => {
    if (s.src === 'demo') demoOv(t, s).cap = n;
    else {
      const r = refIn(t, s);
      if (r) r.cap = n;
    }
    logAdd(t, key, 'CAP_UPDATED', '운용 예산을 ' + tfTmWon(old) + '에서 ' + tfTmWon(n) + '으로 바꿨습니다', s.ver);
  });
}

/** tfTmApply(): 변경안을 새 버전으로 적용한다. 실행 중이면 멈춘다(자동 재개 없음) */
export function tfTmApply() {
  const cd = TF_TM.cand;
  if (!cd) return;
  const s = tfTmOf(cd.key);
  if (!s || s.key !== TF_TM.sel || s.ver !== cd.baseVer || tfTmKey(s.p) !== cd.pKey) {
    toast('전략 상태가 바뀌어 변경안이 무효화됐습니다. 다시 요청해주십시오');
    setTm({ cand: null, prop: null });
    return;
  }
  const nv = 'v' + (Math.round((parseFloat(s.ver.replace('v', '')) || 1) * 10 + 1) / 10).toFixed(1);
  const diffTxt = '손절 ' + cd.p2.sl + '%, ' + (cd.p2.tp != null ? '익절 +' + cd.p2.tp + '%' : '익절 없음') + ', RSI ' + cd.p2.rsiTh + ', 추세필터 ' + (cd.p2.trendFilter ? 'ON' : 'OFF');
  const wasLive = s.status === 'live';
  const vh = { at: Date.now(), from: s.ver, to: nv, by: '사용자 (자연어 요청)', diff: diffTxt, p: JSON.parse(JSON.stringify(cd.p2)) };
  updateTf((t) => {
    if (s.src === 'user') {
      const b = refIn(t, s) as (Strat & { verHist?: unknown[] }) | null;
      if (!b) return;
      b.p = { sl: cd.p2.sl, tp: cd.p2.tp, rsiTh: cd.p2.rsiTh, trendFilter: cd.p2.trendFilter, startI: cd.p2.startI, endI: cd.p2.endI };
      b.score = cd.sc2;
      b.ret = cd.r2.ret;
      b.mdd = cd.r2.mdd;
      b.n = cd.r2.n;
      b.winRate = cd.r2.winRate;
      b.ver = nv;
      b.verHist = b.verHist || [];
      b.verHist.push(vh);
      if (wasLive) b.status = 'off';
      tfNotify('bot', 'tmup:' + b.at + ':' + Date.now(), b.name + ' 전략을 ' + nv + '로 업데이트했습니다', wasLive ? '적용을 위해 중지됐습니다. 재개하면 새 설정으로 실행됩니다.' : '다음 실행부터 적용됩니다.', '#/trade');
    } else if (s.src === 'demo') {
      const ov = demoOv(t, s);
      ov.p = JSON.parse(JSON.stringify(cd.p2));
      ov.ver = nv;
      ov.verHist = ov.verHist || [];
      ov.verHist.push(vh);
      if (wasLive) ov.status = 'off';
    } else {
      const r = refIn(t, s) as (TermClone & { verHist?: unknown[] }) | null;
      if (!r) return;
      r.p = JSON.parse(JSON.stringify(cd.p2));
      r.ver = nv;
      r.verHist = r.verHist || [];
      r.verHist.push(vh);
      if (wasLive) r.status = 'off';
    }
    logAdd(t, cd.key, 'STRATEGY_UPDATED', '전략이 업데이트되었습니다. ' + s.ver + ' → ' + nv, nv, { diff: '변경: ' + diffTxt + ', 변경 주체: 사용자' });
    if (wasLive) logAdd(t, cd.key, 'PAUSED', '전략 실행을 중지했습니다. 설정 적용을 위한 중지입니다 (자동 재개 없음)', nv);
  });
  toast('전략이 ' + nv + '로 업데이트됐습니다' + (wasLive ? ' (중지됨)' : ''));
  setTm({ cand: null, prop: wasLive ? { kind: 'applied', nv, key: cd.key } : null });
}

/** tfTmHaltGo(): 모든 소유 전략을 멈추고 포지션 정리를 표시한다 */
export function tfTmHaltGo() {
  if (tfTmInert()) return;
  let n = 0;
  let f = 0;
  all().forEach((s) => {
    if (s.status !== 'live') return;
    const c = calc(s);
    if (tfTmSetStatus(s.key, 'off', '긴급 정지')) n++;
    if (c.pos) {
      const pos = c.pos;
      updateTf((t) => {
        t.termFlat = t.termFlat || {};
        (t.termFlat as Record<string, unknown>)[s.key] = { at: Date.now(), price: pos.curP, pKey: tfTmKey(s.p) };
        logAdd(t, s.key, 'FLATTENED', '긴급 정지로 포지션을 정리했습니다 (시뮬레이션), 청산가 ' + tfTmPx(pos.curP) + ', ' + tfTmPct(pos.chg * 100, 1), s.ver);
      });
      f++;
    }
  });
  /* 복사한 전략(cpCalc, cpClose)은 전략 복사 조각의 원장이다. 그쪽이 들어오면 여기서 같이 닫는다 */
  toast(n ? '전략 ' + n + '개를 멈췄습니다' + (f ? ', 포지션 ' + f + '개 정리' : '') : '실행 중인 전략이 없습니다');
}

/** tfNFGoAlerts(): 종 단추. 터미널이면 알림 구역을 열고, 아니면 터미널로 가서 연다 */
export function tfNFGoAlerts() {
  if (getState().mode === 'tfdash') {
    setTm({ mt: 'alerts', pane: 'alerts' });
    return;
  }
  TF_TM.nfh = 'alerts';
  nav('#/trade');
}
/** 알림을 읽음으로 (tfNotifReadAll, tfNotifGo) */
export function tfNotifReadAll() {
  updateTf((t) => t.notifs.forEach((n) => (n.read = true)));
}
export function tfNotifGo(id: string) {
  const n = getTf().notifs.find((x) => x.id === id);
  if (!n) return;
  updateTf((t) => {
    const m = t.notifs.find((x) => x.id === id);
    if (m) m.read = true;
  });
  if (n.link) nav(n.link);
}
/** tfIntroNeed() */
export const tfIntroNeed = () => tfDerive().terminalMode === 'inactive';
