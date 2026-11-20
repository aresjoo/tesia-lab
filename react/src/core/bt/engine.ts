// 계산 엔진과 카탈로그의 타입 붙인 창구.
// 몸통(engine.gen.ts)은 원본 함수를 글자 그대로 꺼낸 생성 파일이다. 전략 복사 조각이 core/engine 에 TS 로 옮기면 이 파일의 import 만 바꾼다.
import * as Gen from './engine.gen';

/* 생성 파일은 타입 검사를 하지 않으니, 여기서 이름마다 타입을 붙여 내보낸다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const E = Gen as unknown as Record<string, any>;

export type Kind = 'agent' | 'rule' | 'mix';

/** MK_CAT 한 줄이자 엔진 설정 (원본 cfg) */
export interface Cfg {
  id: string;
  kind: Kind;
  mkt?: string;
  name?: string;
  one?: string;
  ex?: string;
  fw?: number;
  by?: string;
  asset?: string;
  uni?: string;
  inst?: string;
  fut?: number;
  mode?: string;
  fast?: number;
  slow?: number;
  n?: number;
  exitN?: number;
  reg?: number;
  lev?: number;
  rsiTh?: number;
  tp?: number | null;
  sl?: number;
  tf?: number;
  fng?: number | null;
  gate?: number;
  every?: number;
  look?: number;
  top?: number;
  trail?: number;
  volT?: number;
  minS?: number;
  startI?: number;
  ph?: number;
}

/** tfParams 가 만드는 대화 전략의 파라미터 */
export interface Params {
  sl: number;
  tp: number | null;
  rsiTh: number;
  trendFilter: boolean;
  startI: number;
  endI: number;
  purpose?: string;
  fng?: number | null;
  px?: string;
  eng?: string;
}

/** 전략 한 줄 (원본 tfSSRows 의 줄, btMine 의 결과) */
export interface Strat {
  id: string;
  kind: Kind;
  mkt?: string;
  nick: string;
  name?: string;
  title?: string;
  desc?: string;
  one?: string;
  asset: string;
  uni: string | null;
  cfg: Cfg;
  ex: string | null;
  p: Params | null;
  fw: number;
  by: string;
  mine?: boolean;
  me?: boolean;
  style?: string;
}

export interface Rank {
  k: string;
  mom: number;
}
/** 엔진이 남기는 사건 한 줄 */
export interface EngEvent {
  t: 'enter' | 'exit' | 'veto' | 'skip' | 'pick' | 'hold' | 'unpick';
  i: number;
  a?: string;
  tid?: number;
  px?: number;
  ep?: number;
  pnl?: number;
  why?: string;
  up?: number;
  of?: number;
  mom?: number;
  rank?: number;
  w?: number;
  bounce?: number;
  rsi?: number;
  fng?: number | null;
  top?: Rank[];
  bot?: Rank[];
  held?: string[];
  side?: number;
  lev?: number;
  liq?: number;
  ref?: number;
  reg?: number;
  chg1?: number;
  fund?: number;
  cost?: number;
}
export interface EngTrade {
  id: number;
  asset: string;
  entry: number;
  exit: number;
  ep: number;
  xp: number;
  pnl: number;
  kind: string;
  cost: number;
  got: number;
  fee: number;
  side?: number;
  lev?: number;
  fund?: number;
}
export interface EngOpen {
  tid: number;
  k: string;
  entry: number;
  ep: number;
  px: number;
  pnl?: number;
  chg: number;
  cost: number;
  side?: number;
  lev?: number;
}
export interface RunResult {
  eq: { i: number; v: number }[];
  events?: EngEvent[];
  trades?: EngTrade[];
  state?: { open?: EngOpen | EngOpen[] | null };
  ret: number;
  mdd: number;
  n: number;
  winRate: number;
  mddStartI: number;
  mddEndI: number;
  exposure?: number;
  avgHold?: number;
  pf?: number;
  cagr?: number;
  costImpact?: number;
  underwaterDays?: number;
  liqN?: number;
  fundPaid?: number;
  tradeVol?: number;
}

export const MK_CAT: Cfg[] = E.MK_CAT;
export const MK_UNI: Record<string, { label: string; list: string[] }> = E.MK_UNI;
export const MK_PX_CFG: Record<string, number[]> = E.MK_PX_CFG;
export const MK_KIND: Record<Kind, string> = E.MK_KIND;
export const MK_ALIAS: Record<string, string> = E.MK_ALIAS;
export const MK_CRYPTO: Record<string, number> = E.MK_CRYPTO;
export const MK_WHY: Record<string, string> = E.MK_WHY;
export const MK_WHY_P: Record<string, string> = E.MK_WHY_P;
export const FU_WHY: Record<string, string> = E.FU_WHY;
export const FU_WHY_P: Record<string, string> = E.FU_WHY_P;
export const MK_GLOSS: Record<string, string> = E.MK_GLOSS;
export const MK_GLOSS_K: string[] = E.MK_GLOSS_K;
export const TF_STOP: number[] = E.TF_STOP;
export const TF_BUDGET: number[] = E.TF_BUDGET;
export const PRICE0: number[] = E.PRICE0;

export const mkRunCfg: (c: Cfg, startI?: number | null) => RunResult = E.mkRunCfg;
export const mkPx: (key?: string | null) => number[] = E.mkPx;
export const rsi: (p: number[], i: number) => number = E.rsi;
export const mkPxFmt: (v: number | null | undefined) => string = E.mkPxFmt;
export const mkdTicks: (a: number, b: number, n: number) => number[] = E.mkdTicks;
export const idxToDate: (i: number) => Date = E.idxToDate;
export const mkDate: (i: number) => string = E.mkDate;
export const mkMD: (i: number) => string = E.mkMD;
export const mkTk: (k: string) => string = E.mkTk;
export const mkUni: (s: { uni?: string | null; asset?: string }) => { label: string; list: string[] } = E.mkUni;
export const mkScope: (s: Strat) => string = E.mkScope;
export const mkJ: (w: string, a: string, b: string) => string = E.mkJ;
export const mkPct0: (v: number, d?: number) => string = E.mkPct0;
export const mkSign: (v: number) => string = E.mkSign;
export const mkHook: (s: Strat) => string = E.mkHook;
export const mkOne: (s: Strat) => string = E.mkOne;
export const mkInstList: (s: Strat) => string[] = E.mkInstList;
export const mkPolite: (x: string) => string = E.mkPolite;
export const fuIs: (s: Strat | null | undefined) => boolean = E.fuIs;
export const fuSd: (v: number) => string = E.fuSd;
export const fuNeed: (c: Cfg, n: number) => { L: number; S: number } = E.fuNeed;
export const fuSig: (c: Cfg) => string = E.fuSig;
export const fuOuts: (c: Cfg) => string[] = E.fuOuts;
export const fuAiTxt: (s: Strat) => string = E.fuAiTxt;

/** 선물 종목의 종가 (원본 TETH_FUT.sym[k].c) */
export function futClose(k: string): number[] | null {
  const f = (globalThis as { TETH_FUT?: { sym: Record<string, { c: number[] }> } }).TETH_FUT;
  return f && f.sym[k] ? f.sym[k].c : null;
}
/** 공포 탐욕 지수 (원본 TETH_PX.fng) */
export function fngSeries(): (number | null)[] | null {
  const p = (globalThis as { TETH_PX?: { fng?: (number | null)[] } }).TETH_PX;
  return (p && p.fng) || null;
}
/** 모델에게 주는 지시문: 판단 문장, 결과 해석 */
export const BT_SYS_J: string = E.BT_SYS_J;
export const BT_SYS_R: string = E.BT_SYS_R;
