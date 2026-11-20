// 엔진이 주고받는 값의 모양. 원본은 느슨한 객체라 선택 항목이 많다.

export type EqPt = { i: number; v: number };

/** 끝난 거래 한 건. 현물 원장, 선물 원장, 규칙 백테스트가 같은 모양을 나눠 쓴다 */
export type Trade = {
  id?: number;
  entry: number;
  exit: number;
  pnl: number;
  kind: string;
  asset?: string;
  ep?: number;
  xp?: number;
  units?: number;
  cost?: number;
  got?: number;
  fee?: number;
  w?: number;
  lowVol?: boolean;
  /* 선물 */
  fut?: number;
  side?: number;
  lev?: number;
  fund?: number;
};

/** 판단 기록 한 건. 종류(t)마다 붙는 값이 다르다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ev = { i: number; t: string; a?: string; why?: string; xi?: number; tid?: number; px?: number; units?: number; cost?: number; got?: number; fee?: number; pnl?: number; chg?: number; side?: number; lev?: number } & Record<string, any>;

export type YearStat = { pnl: number; n: number; w: number; prod?: number; base?: number };

/** 규칙 백테스트 입력 (runBacktest) */
export type BtParams = {
  sl: number;
  tp?: number | null;
  rsiTh: number;
  trendFilter?: boolean | number;
  startI?: number | null;
  endI?: number | null;
  feeRate?: number | null;
  entryDelay?: number;
  fill?: string;
  /** 자산 이름. 없으면 기준 자산 */
  px?: string | null;
  purpose?: string;
};

export type RunParams = { startI?: number | null; endI?: number | null; sl?: number; tp?: number | null; rsiTh?: number } & Partial<BtParams>;

/** 계산 결과 */
export type RunResult = {
  params: RunParams;
  trades: Trade[];
  eq: EqPt[];
  ret: number;
  mdd: number;
  winRate: number;
  n: number;
  pf: number;
  byYear: Record<string, YearStat>;
  worstYear: string | null;
  bestYear: string | null;
  worstYearPnl: number;
  bestYearPnl: number;
  mddStartI: number | null;
  mddEndI: number;
  underwaterDays: number;
  cagr: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  exposure: number;
  tradeVol: number;
  avgHold: number;
  lossCount: number;
  lowVolLosses: number;
  lowVolLossShare: number;
  costImpact: number;
  events?: Ev[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state?: Record<string, any>;
  fut?: number;
  liqN?: number;
  fundPaid?: number;
  feesPaid?: number;
};

/** 카탈로그 한 줄의 행동 값 (MK_CAT) */
export type CatCfg = {
  id: string;
  kind: 'agent' | 'rule' | 'mix';
  mkt: string;
  name: string;
  one: string;
  ex: string;
  fw: number;
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
  trail?: number;
  sl?: number;
  tp?: number;
  lev?: number;
  startI?: number;
  every?: number;
  look?: number;
  top?: number;
  gate?: number;
  ph?: number;
  volT?: number;
  minS?: number;
  rsiTh?: number;
  tf?: number;
  fng?: number;
  lo?: number;
  hi?: number;
  dip?: number;
  dir?: string;
  hold?: number;
  neutral?: number;
};

/** 목록과 상세가 쓰는 전략 한 줄 (tfRankSeeds 의 원소) */
export type Strat = {
  id: string;
  ord: number;
  kind: 'agent' | 'rule' | 'mix';
  mkt: string;
  nick: string;
  name: string;
  one: string;
  asset: string;
  uni: string | null;
  cfg: CatCfg;
  ex: string;
  p: null;
  fw: number;
  by: string;
  score: number;
  ret: number;
  mdd: number;
  n: number;
  r: RunResult;
};
