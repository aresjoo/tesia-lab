// AI 트레이딩의 계정 상태 모양. 원본의 S.tf (tfS, tfNFInit, bcInit, acS 가 채우는 값)을 그대로 옮겼다.
// 화면 없는 순수 층이다. 저장과 구독은 state/ 쪽이 맡는다.

/** 원본 teth-copy.js 의 TFC 가운데 이 조각이 읽는 값 */
export const TFC = {
  score: { wWin: 0.3, wRet: 0.28, wMdd: 0.27, wVol: 0.15, winLo: 35, winHi: 60, retLo: 0, retHi: 6, mddLo: -25, mddHi: -6, volLo: 9, volHi: 4, pass: 0, maxTries: 5 },
  credit: { version: 1, uidGrant: 1000, costHigh: 10, warnRatio: 0.8, activityDays: 30, freeQuota: 10 },
  billing: { WELCOME_CREDIT: 100, UID_CREDIT_CAP: 2000, CARD_CREDIT_MONTHLY: 3000, AI_CALL_COST: 10, THRESHOLD_WARN: 0.2, THRESHOLD_STOP: 0, GRACE_HOURS: 24 },
  /** tfDeriveCfg() 가 채우는 값 */
  derive: { USAGE_HIGH: 1500, TRADE_HIGH: 1500, PLAN_KRW: 280000, INCLUDED: 1000, UNIT_KRW: 10, KRW_PER_CREDIT: 25, WELCOME_KRW: 1000 },
};
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

/** tfS() + tfNFInit(): 빈 계정 상태 */
export function tfDefault(): TfState {
  return tfNFInit({
    intake: {}, qi: 0, tries: [], cur: null, score: 0, plan: null, cycle: 'year', ex: null, uid: null, api: null, shared: false, followers: 0, reward: 0, fills: [], strat: [],
  } as unknown as TfState);
}

/** tfS() + tfNFInit(): 예전에 저장한 상태에 빠진 칸을 채운다 (같은 객체를 고쳐 돌려준다) */
export function tfNFInit(t: TfState): TfState {
  if (!t.intake) t.intake = {};
  if (!Array.isArray(t.strat)) t.strat = [];
  if (!Array.isArray(t.fills)) t.fills = [];
  if (!t.ob) t.ob = { st: 'idle', ex: null, uid: '', err: null };
  if (t.creditBal == null) t.creditBal = 0;
  t.creditGrants = t.creditGrants || {};
  t.creditReqs = t.creditReqs || [];
  t.notifs = t.notifs || [];
  t.rebates = t.rebates || [];
  t.reviews = t.reviews || [];
  t.periodics = t.periodics || [];
  t.notifPrefs = t.notifPrefs || { pos: true, loss: true, review: true, rebate: true, watch: true, chW: true, chK: false, chT: false, chM: false };
  t.uidLinked = t.uidLinked || false;
  t.freeUsed = t.freeUsed || 0;
  t.creditSeen = t.creditSeen || {};
  t.notifKeys = t.notifKeys || {};
  t.reviewKeys = t.reviewKeys || {};
  t.fillLog = t.fillLog || [];
  return t;
}

/** bcInit(): 크레딧 원장. 없으면 빈 원장을 읽기 전용으로 돌려준다 (파생 계산은 저장하지 않는다) */
export function bcInit(t: TfState): Bill {
  const b = (t.bill || { v: 1 }) as Bill;
  return {
    ...b,
    ledger: Array.isArray(b.ledger) ? b.ledger : [],
    seen: b.seen || {},
    coupons: Array.isArray(b.coupons) ? b.coupons : [],
    events: Array.isArray(b.events) ? b.events : [],
    mode: b.mode || 'active',
    graceAt: b.graceAt === undefined ? null : b.graceAt,
    cardOn: b.cardOn === undefined ? false : b.cardOn,
    cycleAt: b.cycleAt === undefined ? null : b.cycleAt,
    cardFails: b.cardFails === undefined ? 0 : b.cardFails,
  };
}
/** bcBalance(): 잔액 = 원장 합산 */
export const bcBalance = (t: TfState) => bcInit(t).ledger.reduce((a, e) => a + (e.amt || 0), 0);
const cycleFrom = (b: Bill, now: number) => (b.cycleAt ? b.cycleAt - 30 * 864e5 : now - 30 * 864e5);
/** bcMonthVol(): 당월 거래량 충전 유입 */
export function bcMonthVol(t: TfState, now: number): number {
  const b = bcInit(t);
  const from = cycleFrom(b, now);
  return b.ledger.filter((e) => e.at >= from && e.reason === 'volume' && e.amt > 0).reduce((a, e) => a + e.amt, 0);
}
/** bcMonthSpend(): 당월 차감 합 (양수) */
export function bcMonthSpend(t: TfState, now: number): number {
  const b = bcInit(t);
  const from = cycleFrom(b, now);
  return -b.ledger.filter((e) => e.at >= from && e.amt < 0 && e.type === 'debit').reduce((a, e) => a + e.amt, 0);
}

/* ── 실행 환경 (원본 ac* 가운데 판정만. 연결 흐름 화면은 거래소 연결 조각이 옮긴다) ── */
/** AC_CFG.order 와 TF_BROKERS 의 conn:true 인 곳, 그리고 AC_EXTRA.gate */
const AC_EX_IDS = ['bitget', 'binance', 'okx', 'bybit', 'mexc', 'woox', 'gate'];
/** acEx(id) 가 있는지 */
export const acExOk = (id: string) => AC_EX_IDS.includes(id);
/** acS(): 예전 방식으로 연결해 둔 계정을 옮겨 온 conn */
export function acConn(t: TfState): Record<string, AcConn> {
  const conn: Record<string, AcConn> = { ...((t.ac && t.ac.conn) || {}) };
  if (t.api && t.api.ex && !conn[t.api.ex]) conn[t.api.ex] = { via: t.uidLinked ? 'partner' : t.payDone ? 'paid' : 'partner', at: 0, uid: t.uid || '' };
  return conn;
}
/** acSubOn() */
export function acSubOn(t: TfState, now: number): boolean {
  const sub = t.ac && t.ac.sub;
  return !!(sub && sub.st === 'active') || (!!t.payDone && !(sub && sub.st === 'cancelled' && (sub.until || 0) < now));
}
/** acConnList() */
export const acConnList = (t: TfState) => Object.keys(acConn(t)).filter(acExOk);
/** acConnOk(k) */
export function acConnOk(t: TfState, k: string, now: number): boolean {
  const c = acConn(t)[k];
  return !!c && acExOk(k) && (c.via === 'partner' || acSubOn(t, now));
}
/** acReady(ex): 실행 환경(연결된 거래소와 이용 방식)이 갖춰졌는가 */
export function acReady(t: TfState, ex: string | null, now: number): boolean {
  return ex ? acConnOk(t, ex, now) : acConnList(t).some((k) => acConnOk(t, k, now));
}
