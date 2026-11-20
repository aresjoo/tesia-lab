// AI 트레이딩이 읽는 계정 상태의 모양. 원본의 S.tf (tfS, tfNFInit, bcInit, acS 가 채우는 값)을 이 조각이 쓰는 칸까지 타입으로 적었다.
// 화면 없는 순수 층이다. 상태 값, 저장, 크레딧 원장(bc*), 실행 환경 판정(ac*)은 core/account 의 것을 쓴다.

/** 원본 teth-copy.js 의 TFC */
export { TFC } from '../account/tfc.data';
/** TFCOPY.dashTitle */
export const DASH_TITLE = 'AI 트레이딩';
/** TF_BUDGET */
export const TF_BUDGET = [1000000, 5000000, 10000000, 30000000];

export type RuleP = { sl: number; tp: number | null; rsiTh: number; trendFilter: boolean; startI: number | null; endI: number | null; px?: string | null; eng?: string | null; fng?: number | null };
export type TradeRec = { e: number; x: number; pnl: number; kind: string };
export type Fill = { side: 'b' | 's'; label: string; pnl: number; kind?: string; sim?: boolean; at: number; fid?: string; botId?: string };
export type Strat = {
  name: string; score: number; ret: number; mdd: number; n: number; winRate: number; p: RuleP; src?: string | null; fid?: number | string | null;
  status: string; at: number; asset?: string; ex?: string | null; tv?: string | null; cap?: number | null; env?: string; kind?: string; ver?: string; id?: string;
  hist?: { at: number; p: RuleP }[];
};
export type TermClone = { id: number; name: string; ver: string; status: string; ex: string; asset: string; sym: string; mkt: string; tv: string; cap: number; p: RuleP; kind?: string };
export type TermLogRow = { id: string; at: number; type: string; txt: string; ver?: string; extra?: Record<string, unknown> | null };
export type Notif = { id: string; type: string; key?: string; title: string; body: string; link?: string; at: number; read: boolean };
export type LedgerRow = { id: string; at: number; type: string; reason: string; amt: number; ref?: string | null };
export type Bill = { v: number; ledger: LedgerRow[]; seen: Record<string, number>; coupons: unknown[]; events: unknown[]; mode: 'active' | 'grace' | 'watch'; graceAt: number | null; cardOn: boolean; cycleAt: number | null; cardFails: number; simPayFail?: boolean };
export type AcConn = { via: 'partner' | 'paid'; at: number; uid?: string; kyc?: string };
export type AcState = { route: string | null; ex: string | null; conn: Record<string, AcConn>; sub: { st: string; until?: number; next?: number; price?: number; n?: number } | null; [k: string]: unknown };
export type CpCopy = { id: string; nick: string; status: string; amount: number; at: number; [k: string]: unknown };

/** 원본 S.tf */
export type TfState = {
  intake: { asset?: { i: number; label: string }; assetInfo?: { tv?: string; data?: string; label?: string } | null; style?: { i: number; label: string }; budget?: { i: number; label: string }; period?: { i: number; label: string }; stop?: { i: number; label: string } };
  qi: number;
  tries: unknown[];
  cur: { p: RuleP; ret: number; mdd: number; winRate?: number; n: number; trades?: TradeRec[]; [k: string]: unknown } | null;
  score: number;
  plan: string | null;
  cycle: string;
  ex: string | null;
  uid: string | null;
  api: { ex: string; last4?: string | null; oauth?: boolean } | null;
  shared: boolean;
  followers: number;
  reward: number;
  fills: Fill[];
  strat: Strat[];
  ob: { st: string | null; ex: string | null; uid: string; err: string | null };
  /* tfNFInit */
  creditBal: number;
  creditGrants: Record<string, number>;
  creditReqs: unknown[];
  notifs: Notif[];
  rebates: unknown[];
  reviews: { id: string; [k: string]: unknown }[];
  periodics: unknown[];
  notifPrefs: Record<string, boolean>;
  uidLinked: boolean;
  freeUsed: number;
  creditSeen: Record<string, unknown>;
  notifKeys: Record<string, unknown>;
  reviewKeys: Record<string, unknown>;
  fillLog: unknown[];
  /* 그 밖 */
  payDone?: boolean;
  conn?: boolean;
  stage?: string;
  tradeActiveUntil?: number;
  bill?: Bill | null;
  ac?: AcState | null;
  cp?: { copies: CpCopy[]; [k: string]: unknown } | null;
  follows?: unknown[];
  termClones?: TermClone[];
  termDemo?: Record<string, { name?: string; ver?: string; status?: string; cap?: number; p?: RuleP }>;
  termDel?: string[];
  termLog?: Record<string, TermLogRow[]>;
  termFlat?: Record<string, { at: number; n?: number }>;
  termEval?: Record<string, number>;
  termTalk?: Record<string, unknown[]>;
  od?: unknown[];
  [k: string]: unknown;
};
