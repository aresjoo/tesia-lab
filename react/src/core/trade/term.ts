// 터미널의 화면 없는 계산: 전략 목록(VM), 파생 숫자, 표기. 원본 「터미널 셸」 구역의 tfTm* 를 그대로 옮겼다.
import { tfExName } from '../account/derive';
import { mkPx, PRICE0, runBacktest, tfBotLogEvents, tfScore, idxToDate, type BtResult, type LogEv } from './engine';
import { TF_BUDGET, type RuleP, type Strat, type TermClone, type TfState } from './state';

/** TF_TERM_DEMO: 미리 보기의 예시 전략 여섯 */
export type DemoStrat = { id: string; name: string; ex: string; asset: string; sym: string; mkt: string; tv: string; cap: number; ver: string; status: string; errMsg?: string; p: RuleP };
export const TF_TERM_DEMO: DemoStrat[] = [
  { id: 'd1', name: 'BTC 돌파 추종', ex: 'binance', asset: '비트코인', sym: 'BTC/USDT', mkt: '현물', tv: 'BINANCE:BTCUSDT', cap: 14000000, ver: 'v3.4', status: 'live', p: { sl: -5, tp: 10, rsiTh: 40, trendFilter: true, startI: 61, endI: null } },
  { id: 'd2', name: 'ETH 추세 추종', ex: 'okx', asset: '이더리움', sym: 'ETH/USDT', mkt: '현물', tv: 'BINANCE:ETHUSDT', cap: 7000000, ver: 'v2.1', status: 'off', p: { sl: -5, tp: 8, rsiTh: 46, trendFilter: true, startI: -730, endI: null } },
  { id: 'd3', name: 'SOL 되돌림', ex: 'woox', asset: '솔라나', sym: 'SOL/USDT', mkt: '현물', tv: 'BINANCE:SOLUSDT', cap: 4000000, ver: 'v1.3', status: 'live', p: { sl: -3, tp: 8, rsiTh: 38, trendFilter: false, startI: -365, endI: null } },
  { id: 'd4', name: 'BTC 평균회귀', ex: 'okx', asset: '비트코인', sym: 'BTC/USDT', mkt: '현물', tv: 'BINANCE:BTCUSDT', cap: 28000000, ver: 'v5.0', status: 'live', p: { sl: -8, tp: 10, rsiTh: 40, trendFilter: true, startI: 61, endI: null } },
  { id: 'd5', name: 'ARB 모멘텀', ex: 'binance', asset: '아비트럼', sym: 'ARB/USDT', mkt: '현물', tv: 'BINANCE:ARBUSDT', cap: 7000000, ver: 'v1.0', status: 'ready', p: { sl: -3, tp: 10, rsiTh: 38, trendFilter: false, startI: -365, endI: null } },
  { id: 'd6', name: 'LINK 분할 매집', ex: 'woox', asset: '체인링크', sym: 'LINK/USDT', mkt: '현물', tv: 'BINANCE:LINKUSDT', cap: 7000000, ver: 'v2.2', status: 'err', errMsg: '거래소 API 응답 없음. 마지막 동기화 이후 주문이 전송되지 않았습니다', p: { sl: -8, tp: 10, rsiTh: 46, trendFilter: false, startI: -548, endI: null } },
];

/** TF_ASSET_TICKER */
const TF_ASSET_TICKER: Record<string, string> = { 비트코인: 'BTC', 이더리움: 'ETH', 솔라나: 'SOL', 나스닥: 'NASDAQ', 리플: 'XRP', 도지코인: 'DOGE', 아발란체: 'AVAX', 에이다: 'ADA', BTC: 'BTC', ETH: 'ETH', SOL: 'SOL' };
/** tfAssetTicker(a) */
export function tfAssetTicker(a: string | { label?: string; name?: string } | null | undefined): string {
  if (!a) return '';
  if (typeof a === 'object') a = a.label || a.name || '';
  return TF_ASSET_TICKER[a] || String(a).replace(/\/.*$/, '');
}
/** tfStratTitle(p,asset,opt): 자산 + 행동 (+ 통제 어휘) */
export function tfStratTitle(p: Partial<RuleP> | null | undefined, asset?: string | null, opt?: { long?: boolean }): string {
  p = p || {};
  opt = opt || {};
  const tk = tfAssetTicker(asset);
  const r = p.rsiTh != null ? p.rsiTh : 44;
  const beh = r <= 38 ? '급락 반등 매수' : r <= 41 ? '깊은 눌림 반등 매수' : '눌림목 반등 매수';
  const suf: string[] = [];
  if (p.trendFilter) suf.push('추세 구간');
  if (p.sl != null && p.sl >= -3) suf.push('보수형');
  else if (p.tp != null && p.tp >= 15) suf.push('공격형');
  else if (p.tp != null && p.tp <= 8) suf.push('짧은 익절');
  else if (p.sl != null && p.sl <= -8) suf.push('넓은 손절');
  if (opt.long && !suf.length) suf.push('장기');
  return (tk ? tk + ' ' : '') + beh + (suf.length ? ', ' + suf.join(', ') : '');
}
/** tfStratSub(p) */
export function tfStratSub(p: Partial<RuleP> | null | undefined): string {
  p = p || {};
  let s = 'RSI ' + (p.rsiTh != null ? p.rsiTh : 44) + ' 아래로 눌렸다가 반등하면 사고, +' + (p.tp != null ? p.tp : 10) + '%에 팔고 ' + (p.sl != null ? p.sl : -5) + '%면 멈춥니다.';
  if (p.trendFilter) s += ' 추세 구간에서만 삽니다.';
  return s;
}
/** TF_KIND_LABEL */
export const TF_KIND_LABEL: Record<string, string> = { agent: 'AI 판단', rule: '규칙', hybrid: '규칙', follow: '전략 복사' };

/** tfTmP(p): startI 음수는 끝에서 N봉. 깊은 복사 정규화 */
export function tfTmP(p: RuleP): RuleP & { startI: number; endI: number } {
  const end = PRICE0.length - 1;
  const s2 = p.startI == null ? 61 : p.startI < 0 ? Math.max(61, end + p.startI) : p.startI;
  return { sl: p.sl, tp: p.tp != null ? p.tp : null, rsiTh: p.rsiTh, trendFilter: !!p.trendFilter, startI: s2, endI: p.endI != null ? p.endI : end, px: p.px || null, eng: p.eng || null, fng: p.fng != null ? p.fng : null };
}
/** tfTmKey(p) */
export const tfTmKey = (p: RuleP) => [p.sl, p.tp, p.rsiTh, p.trendFilter ? 1 : 0, p.startI, p.endI, p.px || '', p.eng || '', p.fng != null ? p.fng : ''].join('|');

/** 터미널 한 줄(전략) */
export type TermRow = {
  key: string; src: 'demo' | 'user' | 'clone'; kind: string; ref: DemoStrat | Strat | TermClone; name: string; ver: string; status: string; errMsg?: string | null;
  ex: string | null; exL: string; asset: string; sym: string; mkt: string; tv: string; cap: number; capShared?: boolean; p: RuleP & { startI: number; endI: number }; at: number;
};

/** tfTmAll(): 미리 보기면 예시 여섯만, 아니면 소유 전략(직접 만든 것 + 복제)만 */
export function tfTmAll(t: TfState, preview: boolean, now: number = Date.now()): TermRow[] {
  const out: TermRow[] = [];
  if (preview) {
    TF_TERM_DEMO.forEach((d) => {
      const ov = (t.termDemo && t.termDemo[d.id]) || {};
      out.push({ key: 'demo:' + d.id, src: 'demo', kind: 'rule', ref: d, name: ov.name || d.name, ver: ov.ver || d.ver, status: ov.status || d.status, errMsg: ov.status ? null : d.errMsg, ex: d.ex, exL: tfExName(d.ex) || d.ex, asset: d.asset, sym: d.sym, mkt: d.mkt, tv: d.tv, cap: ov.cap != null ? ov.cap : d.cap, p: tfTmP(ov.p || d.p), at: 0 });
    });
    return out;
  }
  (t.strat || []).forEach((x) => {
    if (!x || !x.p) return;
    const info = t.intake && t.intake.assetInfo;
    const xa = x.asset || String(x.name || '').replace(/ 위임 전략$/, '');
    const xe = x.ex || (t.api ? t.api.ex : null);
    const pp = tfTmP(x.p);
    const auto = !x.name || / 위임 전략$/.test(x.name);
    const bi = t.intake && t.intake.budget && t.intake.budget.i != null ? t.intake.budget.i : 1;
    const t0 = x.tv || (info && info.tv) || 'BINANCE:BTCUSDT';
    const ex0 = x.ex || (t.api && t.api.ex);
    out.push({
      key: 'user:' + x.at, src: 'user', kind: x.kind || 'rule', ref: x, name: auto ? tfStratTitle(pp, xa) : x.name, ver: x.ver || 'v1.0',
      status: x.status === 'live' ? 'live' : x.status === 'ready' ? 'ready' : 'off',
      ex: xe, exL: tfExName(xe) || '연결 거래소', asset: xa, sym: tfAssetTicker(xa) + '/USDT', mkt: '현물',
      tv: ex0 === 'bitget' && /^BINANCE:/.test(t0) ? t0.replace(/^BINANCE:/, 'BITGET:') : t0,
      cap: x.cap != null ? x.cap : TF_BUDGET[bi], capShared: x.cap == null, p: pp, at: +x.at || now,
    });
  });
  (Array.isArray(t.termClones) ? t.termClones : []).forEach((cx) => {
    out.push({ key: 'clone:' + cx.id, src: 'clone', kind: cx.kind || 'rule', ref: cx, name: cx.name, ver: cx.ver, status: cx.status, ex: cx.ex, exL: tfExName(cx.ex) || cx.ex, asset: cx.asset, sym: cx.sym, mkt: cx.mkt, tv: cx.tv, cap: cx.cap, p: tfTmP(cx.p), at: cx.id });
  });
  return out;
}

/** TF_BROKERS 가운데 터미널이 읽는 값(이름). tfExOf2(ex).name */
export const tfExOf2Name = (ex: string | null | undefined) => tfExName(ex) || (ex ? String(ex).toUpperCase() : '미연결');

export type TermTrade = { entry: number; exit: number; pnl: number; kind: string; krw: number; capB: number };
export type TermPos = { entryI: number; entryP: number; curP: number; qty: number; chg: number; krw: number; stopP: number; tpP: number | null; bars: number };
export type TermFlat = { at: number; price?: number; pKey?: string; n?: number };
export type TermCalc = {
  r: BtResult; score: number; L: ReturnType<typeof tfBotLogEvents>; cap: number; nav: number; pnl: number; pnlPct: number; realized: number; unreal: number; feeEst: number;
  trades: TermTrade[]; pos: TermPos | null; flat: TermFlat | null;
};

/** TF_TM_C: 파생 캐시 (세션 한정, 정규화한 p 열쇠) */
const TF_TM_C: Record<string, { r: BtResult; score: number; L: ReturnType<typeof tfBotLogEvents>; openI: number | null }> = {};

/** tfTmCalc(s): 수수료는 엔진 pnl 에 이미 들어 있다. 실현과 미실현은 복리로 맞춘다 */
export function tfTmCalc(s: TermRow, t: TfState): TermCalc {
  const p = s.p;
  const ck = tfTmKey(p);
  let c = TF_TM_C[ck];
  if (!c) {
    /* 원본은 p.eng==='mk' 면 tfMkBt(전략 복사 조각의 mkRuleRun)를 쓴다. 그 엔진이 들어오기 전에는 규칙 엔진으로 계산한다 */
    const r = runBacktest(p);
    const L2 = tfBotLogEvents(p, mkPx(p.px));
    let openI: number | null = null;
    for (let k2 = L2.evs.length - 1; k2 >= 0; k2--) {
      const e2 = L2.evs[k2];
      if (!e2) continue;
      if (e2.k.indexOf('exit') === 0) break;
      if (e2.k === 'entry') {
        openI = e2.i;
        break;
      }
    }
    c = TF_TM_C[ck] = { r, score: tfScore(r), L: L2, openI: L2.last.inPos ? openI : null };
  }
  const r2 = c.r;
  const cap = s.cap;
  let capW = cap;
  let feeEst = 0;
  const tRows: TermTrade[] = [];
  r2.trades.forEach((tr) => {
    feeEst += capW * 0.002;
    const pk = capW * tr.pnl;
    tRows.push({ entry: tr.entry, exit: tr.exit, pnl: tr.pnl, kind: tr.kind, krw: pk, capB: capW });
    capW *= 1 + tr.pnl;
  });
  const nav = cap * (1 + r2.ret / 100);
  const realized = capW - cap;
  const unreal = nav - capW;
  let pos: TermPos | null = null;
  let fl: TermFlat | null = (t.termFlat && (t.termFlat[s.key] as TermFlat)) || null;
  if (fl && s.status === 'live') fl = null;
  if (c.openI != null && !fl) {
    const px = mkPx((s.p && s.p.px) || null);
    const ep = px[c.openI];
    const cp = px[p.endI];
    pos = { entryI: c.openI, entryP: ep, curP: cp, qty: capW / ep, chg: cp / ep - 1, krw: unreal, stopP: ep * (1 + p.sl / 100), tpP: p.tp != null ? ep * (1 + p.tp / 100) : null, bars: p.endI - c.openI };
  }
  return { r: r2, score: c.score, L: c.L, cap, nav, pnl: nav - cap, pnlPct: r2.ret, realized, unreal, feeEst, trades: tRows, pos, flat: fl };
}

/** tfTmWon(n): 안쪽 값은 예전 단위(천 배), 표시는 달러 */
export const tfTmWon = (n: number) => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n) / 1000).toLocaleString();
/** tfTmWonS(n): 부호를 늘 붙인다 */
export const tfTmWonS = (n: number) => (n >= 0 ? '+' : '-') + '$' + Math.round(Math.abs(n) / 1000).toLocaleString();
/** tfTmPct(n,d) */
export const tfTmPct = (n: number, d2?: number) => (n >= 0 ? '+' : '') + n.toFixed(d2 != null ? d2 : 1) + '%';
/** tfTmSign(n) */
export const tfTmSign = (n: number) => (n > 0 ? 'up' : n < 0 ? 'dn' : 'zz');
/** tfTmPx(n) */
export const tfTmPx = (n: number) => '$' + Math.round(n).toLocaleString();
/** TF_TM_ST: 상태 표기 (기호, 이름, class) */
export const TF_TM_ST: Record<string, [string, string, string]> = { live: ['●', '실행 중', 'live'], off: ['Ⅱ', '중지', 'off'], ready: ['○', '실행 전', 'ready'], err: ['⚠', '오류', 'err'] };
/** TF_TM_EVM */
export const TF_TM_EVM: Record<string, [string, string]> = { entry: ['조건 충족, 진입', 'en'], 'exit-tp': ['익절 청산', 'tp'], 'exit-sl': ['손절 청산', 'sl'], 'exit-time': ['기간 청산', 'tm'], watch: ['조건 미충족, 주문 없음', 'wa'], risk: ['리스크 규칙, 유지', 'ho'] };
/** TF_TM_OPM */
export const TF_TM_OPM: Record<string, [string, string]> = { STARTED: ['실행 시작', 'op'], RESUMED: ['재개', 'op'], PAUSED: ['일시정지', 'wa'], STRATEGY_UPDATED: ['전략 업데이트', 'up'], RENAMED: ['이름 변경', 'op'], CLONED: ['복제됨', 'op'], RECONNECTED: ['연결 복구', 'op'], CAP_UPDATED: ['운용 자금 변경', 'up'], FLATTENED: ['포지션 정리', 'sl'] };

/** tfTmDate(i): 'YYYY.MM.DD' */
export function tfTmDate(i: number): string {
  const d = idxToDate(i);
  return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}
/** tfTmAgo(at) */
export function tfTmAgo(at: number | null | undefined, now: number = Date.now()): string {
  if (!at) return '아직 없음';
  const d = Math.max(0, now - at);
  if (d < 60e3) return Math.floor(d / 1000) + '초 전';
  if (d < 36e5) return Math.floor(d / 60e3) + '분 전';
  if (d < 864e5) return Math.floor(d / 36e5) + '시간 전';
  return Math.floor(d / 864e5) + '일 전';
}
/** tfNFTime(at) */
export function tfNFTime(at: number, now: number = Date.now()): string {
  const d = now - at;
  if (d < 60e3) return '방금 전';
  if (d < 36e5) return Math.floor(d / 60e3) + '분 전';
  if (d < 864e5) return Math.floor(d / 36e5) + '시간 전';
  return new Date(at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}
/** tfTmPnl(s,c): 오늘 손익은 원본대로 비트코인 가격 줄의 마지막 두 봉으로 센다 */
export function tfTmPnl(s: TermRow, c: TermCalc): { today: number; total: number } {
  let today = 0;
  if (c.pos && s.status === 'live') {
    const e = s.p.endI;
    today = c.pos.qty * (PRICE0[e] - PRICE0[e - 1]);
  }
  return { today, total: c.pnl };
}

/* ── 터미널 글자 규칙 (원본 sk-term: SKT_EXACT, SKT_RE, skSym) ── */
/** skSym(t): 종목 이름을 기호로 */
const SK_SYM: [string, string][] = [['비트코인', 'BTC'], ['이더리움', 'ETH'], ['솔라나', 'SOL'], ['리플', 'XRP'], ['도지코인', 'DOGE'], ['에이다', 'ADA'], ['아발란체', 'AVAX'], ['비앤비', 'BNB']];
export function skSym(t: string): string {
  let u = t;
  SK_SYM.forEach((p) => {
    if (u.indexOf(p[0]) >= 0) u = u.split(p[0]).join(p[1]);
  });
  return u;
}
/** 'YYYY.MM.DD' → 'YYYY. M. D.' (SKT_RE 의 날짜 규칙) */
export const sktDate = (s: string) => s.replace(/(\d{4})\.(\d{2})\.(\d{2})/g, (_m, y: string, mo: string, d: string) => y + '. ' + +mo + '. ' + +d + '.');

export type { LogEv };
