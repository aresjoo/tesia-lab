// 전략 만들기 퍼널의 상태 모양 (원본 tfS(), S.tf) 과 그 위의 순수 규칙.
// 저장 키와 모양은 원본 그대로다: localStorage 'teth.state' = { v:1, savedAt, user:{name,email}, tf, sessions, ... } 의 tf.
// 대화 조각이 인테이크(tf.intake, tf.aiSpec)를 채우고, 백테스트 여정은 그 상태를 읽어 그린다.
import { MK_PX_CFG, PRICE0, TF_STOP, mkJ, mkRunCfg, type Cfg, type Params, type RunResult, type Strat } from './engine';
import { TFC_SCORE } from './tfc.data';

/** 인테이크 질문 하나의 답 (원본 t.intake.asset 등) */
export interface Pick {
  i?: number;
  label?: string;
}
export interface Intake {
  asset?: Pick;
  style?: Pick;
  stop?: Pick;
  period?: Pick;
  budget?: Pick;
  assetInfo?: { tv?: string | null };
}
/** 대화에서 AI 가 정한 규칙 (원본 tfAiStrategy 가 채운다) */
export interface AiSpec {
  sl: number;
  tp: number | null;
  rsiTh: number;
  tf?: boolean | number;
  fng?: number | null;
  name?: string | null;
  sess?: string | null;
}
/** 대화 흐름이 쓰는 검증 기록 (원본 t.cur) */
export interface TfCur {
  ret: number;
  mdd: number;
  n: number;
  winRate: number;
  p: Params;
  sig?: string;
  asset?: string;
  trades?: { entry: number; exit: number | null; pnl: number; kind: string | null }[];
}
/** 백테스트 화면이 기억하는 것 (원본 t.bt) */
export interface TfBt {
  id?: string | null;
  per?: number;
  amt?: number;
  done?: number;
  ret?: number;
  mdd?: number;
  fin?: number;
}
/** 이전 판 한 장 (원본 rvSnapNow) */
export interface BtVer {
  at: number;
  spec: RvSpec;
  rule: string;
  ai: AiSpec | Record<string, never>;
  pi?: number;
  per: number;
  amt: number;
  ret: number;
  mdd: number;
  n: number;
  bench: number;
  final: number;
}
export interface RvSpec {
  asset: string;
  depth: 'shallow' | 'mid' | 'deep';
  tp: number | null;
  sl: number;
  fng: number | null;
  trend: boolean;
  period: string;
  name: string | null;
  change?: string | null;
}
export interface TfApi {
  ex: string;
  last4: string | null;
  oauth?: boolean;
}
/** 실행 환경 활성화 상태 (원본 acS(), t.ac). 거래소 연결 조각의 것이라 여기서는 읽는 칸만 적는다. */
export interface AcState {
  route?: 'partner' | 'paid' | null;
  ex?: string | null;
  conn?: Record<string, { via: string; at: number; uid?: string }>;
  sub?: { st: string; since?: number; next?: number; until?: number; price?: number } | null;
  cards?: { id: string; last4: string; brand?: string; def?: boolean }[];
  kyc?: Record<string, unknown>;
  [k: string]: unknown;
}
/** 원본 S.tf */
export interface TfState {
  intake: Intake;
  qi: number;
  tries: unknown[];
  cur: TfCur | null;
  score: number;
  plan: string | null;
  cycle: string;
  ex: string | null;
  uid: string | null;
  api: TfApi | null;
  shared: boolean;
  followers: number;
  reward: number;
  fills: unknown[];
  strat: Record<string, unknown>[];
  ob: { st: string; ex: string | null; uid: string; err: string | null };
  aiSpec?: AiSpec | null;
  cloneFrom?: string | null;
  pendingP?: Params | null;
  bt?: TfBt;
  btVers?: BtVer[];
  btLast?: BtVer | null;
  stage?: string;
  workDone?: boolean;
  conn?: boolean;
  uidLinked?: boolean;
  payDone?: boolean;
  ac?: AcState | null;
  [k: string]: unknown;
}

/** tfS() 의 첫 모양 */
export function tfDefault(): TfState {
  return { intake: {}, qi: 0, tries: [], cur: null, score: 0, plan: null, cycle: 'year', ex: null, uid: null, api: null, shared: false, followers: 0, reward: 0, fills: [], strat: [], ob: { st: 'idle', ex: null, uid: '', err: null } };
}
/** 저장분을 tfS() 가 돌려주는 모양으로 채운다 (구버전 저장분의 ob 보충 포함) */
export function tfNormalize(t: Partial<TfState> | null | undefined): TfState {
  if (!t) return tfDefault();
  const o = t as TfState;
  if (!o.intake) o.intake = {};
  if (!o.ob) o.ob = { st: 'idle', ex: null, uid: '', err: null };
  if (!o.strat) o.strat = [];
  return o;
}

/** tfWon(n) */
export function tfWon(n: number): string {
  return '$' + Math.round((+n || 0) / 1000).toLocaleString();
}

/** tfParams(base): 인테이크 답을 백테스트 파라미터로 */
export function tfParams(t: TfState, base?: Partial<Params> | null): Params {
  const iv = t.intake;
  const style = (iv.style || {}).i != null ? (iv.style as Pick).i! : 1;
  const stop = (iv.stop || {}).i != null ? (iv.stop as Pick).i! : 1;
  const period = (iv.period || {}).i != null ? (iv.period as Pick).i! : 1;
  const p: Params = {
    sl: TF_STOP[stop],
    tp: style === 0 ? null : style === 1 ? 12 : 8,
    rsiTh: style === 0 ? 52 : style === 1 ? 44 : 38,
    trendFilter: style === 2,
    startI: period === 0 ? Math.max(61, PRICE0.length - 1 - 365) : period === 1 ? Math.max(61, PRICE0.length - 1 - 730) : 61,
    endI: PRICE0.length - 1,
    purpose: 'delegate',
  };
  if (base) Object.assign(p, base);
  return p;
}

/** tfScore(res): TETH 점수 0~100 */
export function tfScore(res: RunResult): number {
  const c = TFC_SCORE;
  const nz = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  let sc = nz(res.winRate, c.winLo, c.winHi) * c.wWin + nz(res.cagr as number, c.retLo, c.retHi) * c.wRet + nz(res.mdd, c.mddLo, c.mddHi) * c.wMdd + nz(res.tradeVol as number, c.volLo, c.volHi) * c.wVol;
  sc *= 100;
  if (res.n < 4) sc *= 0.65;
  if (res.n < 6) sc = Math.min(sc, 79);
  return Math.max(5, Math.min(99, Math.round(sc)));
}

const BT_MINE_ALIAS: Record<string, string> = { '나스닥 종합': '나스닥' };
/** btMineAsset() */
export function btMineAsset(t: TfState): string | null {
  let a = ((t.intake || {}).asset || {}).label || '';
  a = BT_MINE_ALIAS[a] || a;
  return MK_PX_CFG[a] ? a : null;
}
/** btMine(): 대화에서 정한 조건을 백테스트 화면이 쓰는 차트 규칙 전략으로 옮긴다 */
export function btMine(t: TfState, hasUser: boolean): Strat | null {
  if (!hasUser || !t.intake || !t.intake.asset) return null;
  const a = btMineAsset(t);
  if (!a) return null;
  const sp = t.aiSpec;
  const p = t.cloneFrom && t.pendingP ? t.pendingP : tfParams(t, sp ? { sl: sp.sl, tp: sp.tp, rsiTh: sp.rsiTh, trendFilter: !!sp.tf, fng: sp.fng } : null);
  const iv = t.intake;
  const st = ((iv.style || {}).label || '').replace(/으로$/, '');
  const sl = Math.abs(p.sl);
  const cfg: Cfg = { id: 'mine', kind: 'rule', asset: a, rsiTh: p.rsiTh, tp: p.tp, sl: p.sl, tf: p.trendFilter ? 1 : 0, fng: p.fng != null ? p.fng : null, startI: 61 };
  const sig = JSON.stringify(cfg) + '|' + (iv.period || {}).i + '|' + (t.cloneFrom || '') + '|' + (t.cloneFrom && p.startI != null ? p.startI : '');
  let h = 0;
  for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) >>> 0;
  const name = (t.cloneFrom ? t.cloneFrom + ' 님 전략, ' : '') + (sp && sp.name ? sp.name : a + ' 반등 매수');
  const one = mkJ(a, '이', '가') + ' 내려왔다가 다시 오르는 날 삽니다. ' + (p.tp != null ? '산 가격보다 ' + p.tp + '% 오르거나 ' : '산 가격보다 ') + sl + '% 내려가면, 또는 25일이 지나면 팝니다.' + (p.fng != null ? ' 공포 탐욕 지수가 ' + p.fng + ' 이하일 때만 삽니다.' : '');
  return { id: 'mine-' + h.toString(36), mine: true, kind: 'rule', mkt: /비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/.test(a) ? 'crypto' : 'stock', nick: name, name, one, asset: a, uni: null, cfg, ex: null, p, fw: 0, by: '', style: st };
}
/** btMineStale(): 지금 조건과 다른 결과인가. 대화에서 만든 결과(sig 있음)만 따진다 */
export function btMineStale(t: TfState, hasUser: boolean): boolean {
  const c = t.cur;
  if (!c || !c.sig) return false;
  const m = btMine(t, hasUser);
  return !m || m.id !== c.sig;
}

/** btMineDone(): 결과가 나오면 대화 흐름이 쓰는 검증 기록(t.cur)을 이 결과로 채운다. 점수 게이트는 없다 */
export function btMineDone(t: TfState, s: Strat, R: { eq: { i: number; v: number }[]; N: number; ret: number; mdd: number; wins: unknown[]; tr: { open?: number; e: number; x: number | null; pnl: number; why: string | null }[] }): void {
  if (!s || !s.mine || !R) return;
  const p = { ...(s.p as Params) };
  p.startI = R.eq[0].i;
  p.endI = R.eq[R.N - 1].i;
  p.px = s.asset;
  p.eng = 'mk';
  const done = R.tr.filter((x) => !x.open);
  t.cur = { ret: R.ret, mdd: R.mdd, n: done.length, winRate: done.length ? (R.wins.length / done.length) * 100 : 0, p, sig: s.id, asset: s.asset, trades: done.map((x) => ({ entry: x.e, exit: x.x, pnl: x.pnl / 100, kind: x.why })) };
  try {
    const sc = tfScore(mkRunCfg(s.cfg, p.startI));
    t.score = isFinite(sc) ? sc : 0;
  } catch {
    t.score = 0;
  }
  t.workDone = true;
  if (t.stage === 'verify' || t.stage === 'ready' || !t.stage) t.stage = 'connect';
}
