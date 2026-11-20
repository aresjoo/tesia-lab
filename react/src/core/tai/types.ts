// 대화와 AI 연결의 자료 모양. 화면이 없는 층이라 Flutter 로 옮길 때 그대로 Dart 클래스가 된다.
// 원본은 대화 기록을 HTML 문자열(sx.convo)로 들고 있었다. 여기서는 같은 내용을 항목(Item) 목록으로 든다.

import type { TfCard } from '../tf/intake';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

/** TAI.chart */
export type ChartInfo = { tv: string; data: string; label: string; interval: string; cid: string; range?: string };
export type AssetRef = { tv: string; data: string; label: string };

/** /api/ohlc 와 taiBinDirect 가 돌려주는 시세 스냅샷. rows 는 [시각, 시가, 고가, 저가, 종가, 거래량] */
export type Ohlc = {
  last: number;
  chg1d: number | null;
  chg7d: number | null;
  chg30d: number | null;
  ivChg: number | null;
  hi90: number;
  lo90: number;
  closes30: number[];
  closesS?: [number, number][];
  rows: number[][];
  meta?: { src: string; iv: string; n: number; at: number; quality: string };
  base?: { chg: number | null; label: string };
  daily?: [string, number][];
};

/** taiAI(sx): 대화마다 따로 드는 AI 상태 */
export type AiState = { hist: ChatMsg[]; chart: ChartInfo | null; ohlc: Ohlc | null; ohlcAt: number; tf: string };

/* ── 작업 타임라인 (act*) ── */
/** 원본은 상세를 HTML 문자열로 들었다. 같은 내용을 조각으로 든다. */
export type Rich = (string | { b: string } | { br: true } | { a: string })[];
export type ActDetail = { k: 'rich'; parts: Rich } | { k: 'cot'; text: string } | { k: 'srcs'; rows: { t: string; u: string }[] };
export type ActStep = {
  kind: 'fetch' | 'think' | 'ans' | 'note' | 'calc' | 'chart' | 'search' | 'page' | 'cmd';
  title: string;
  /** 머리줄에 보일 진행 문구 */
  h?: string;
  status: 'running' | 'done' | 'failed';
  t0: number;
  ms?: number;
  /** 오른쪽 작은 글 (예: 90봉, 4초) */
  mR?: string | null;
  detail?: ActDetail | null;
  open?: boolean;
  /** 생각 줄에 지금까지 흘러든 글 */
  think?: string;
  q?: string;
  u?: string;
  d?: string;
  mdq?: string;
  doneT?: string;
  failT?: string;
};
export type ActData = { id: string; label: string; status: 'running' | 'done' | 'abort' | 'error'; t0: number; ms?: number; steps: ActStep[]; tok: number; missing?: string[] };

/* ── 답변 끝에 붙는 태그 ── */
export type AskStep = { title?: string; multi?: boolean; options: { t: string; d?: string }[] };
export type AskCfg = { steps?: AskStep[]; title?: string; multi?: boolean; options?: { t: string; d?: string }[] };
export type Gauge = { symbol?: string; label?: string; up: number | string; down: number | string; position?: string };
export type Act = { type: string; label: string; direction?: string };
export type TlineIn = { date?: string; title?: string; src?: string };
export type TlineItem = { d: string; t: string; src: string; px: number | null; chg: number | null; mapped: string | null };

/* ── 스크립트 질문 카드 (gConvChips) ── */
export type ChipItem = { label: string; desc?: string | null; act?: string | null; arg?: string | null };
export type ChipCard = { title: string; sub?: string | null; pg: [number, number]; skipAct?: string | null; skipArg?: string | null; freeHint?: string | null };

/* ── 대화 줄에 놓이는 항목 ── */
export type NextRow = { t: 'n'; q: string } | { t: 'a'; a: Act; saved?: boolean };
export type Item =
  | { k: 'user'; id: string; text: string }
  /** 질문 패널에 답한 요약 (g-usum) */
  | { k: 'usum'; id: string; rows: { b: string; v: string }[] }
  | {
      k: 'ai';
      id: string;
      /** gConvAI 의 짧은 안내 글 */
      plain?: string;
      /** 확정된 본문 (태그를 뗀 마크다운 원문) */
      md?: string;
      /** 받는 중: 확정된 줄들과 지금 쓰는 줄 */
      live?: { head: string; tail: string; h4: string | null } | null;
      /** 받는 중인데 아직 한 번도 그리지 않음 */
      fresh?: boolean;
      gauge?: { up: number; label: string; symbol: string; top: boolean; anim?: boolean } | null;
      tline?: TlineItem[] | null;
      src?: { n: number; all: number; ok: number } | null;
      acts?: boolean;
      vote?: 1 | -1;
    }
  | { k: 'act'; id: string }
  | { k: 'chart'; id: string; cid: string; label: string; px?: { last: number; up: boolean; chg: number | null; per: string; at: string; flash?: 'u' | 'd' | null } | null; fc?: number; pip?: number | null }
  | { k: 'px'; id: string; as: string; pv: string; up: boolean; chg: string; meta: string }
  | { k: 'status'; id: string; label: string; done: boolean }
  | { k: 'next'; id: string; rows: NextRow[]; badge: boolean }
  /** 단추 하나짜리 줄: 다시 생성, 이어서 계속, 다시 보내기, 공유 전략 둘러보기 */
  | { k: 'chip'; id: string; label: string; q?: string; go?: 'share' | 'offretry' }
  | { k: 'err'; id: string; q: string }
  | { k: 'asknote'; id: string; n: number; done: boolean }
  | { k: 'fb'; id: string; etc: boolean }
  | { k: 'think'; id: string; label: string }
  /** tfAiMsg 의 안내 글 */
  | { k: 'tfmsg'; id: string; text: string }
  /** 전략 카드 (tfAiStrategy) 와 그 완료 줄 (tfVerifyGo) */
  | { k: 'tfsum'; id: string; card: TfCard }
  | { k: 'tfdone'; id: string; asset: string }
  | { k: 'chips'; id: string; items: ChipItem[]; card: ChipCard | null };

export type Strategy = {
  name: string | null;
  pair: string | null;
  market: string;
  tf: string | null;
  entry: string | null;
  entryMode: string | null;
  exit: string;
  sl: string | null;
  tp: string | null;
  size: string;
  risk: string | null;
  slNum?: number | null;
  tpNum?: number | null;
  _slIntent?: number | null;
  _tpIntent?: number | null;
};

export type PendingChips = { id: string; step: string | null; card: ChipCard | null; items: ChipItem[] };

export type Session = {
  id: string;
  title: string;
  sub?: string;
  status: 'draft' | 'run' | 'stopped' | 'review' | 'done';
  strategy: Strategy;
  /** 대화 화면의 줄 (원본 sx.convo) */
  items: Item[];
  /** 문서와 연구 과정 화면에서 보낸 말 (원본 sx.thread) */
  thread: Item[];
  tabs: { id: string; title: string }[];
  acts: Record<string, ActData>;
  ai: AiState | null;
  rawIntent: string | null;
  step: string | null;
  pendingChips: PendingChips | null;
  clN?: number | null;
  clI?: number | null;
  pinned: boolean;
  live: boolean;
  ss3Chip?: boolean;
  /** AI 가 채운 전략 설계서와 예약 주문 (다음 조각이 받아 그린다) */
  spec?: unknown;
  order?: unknown;
};

/** newStrategy() */
export function newStrategy(): Strategy {
  return { name: null, pair: null, market: '현물, Binance', tf: null, entry: null, entryMode: null, exit: '익절 또는 손절 도달 시', sl: null, tp: null, size: '투자금의 100%', risk: null };
}
/** gNew 가 만드는 새 대화 */
export function newSession(now: number, typed: string | null): Session {
  return { id: 's' + now, title: '새 전략', status: 'draft', strategy: newStrategy(), items: [], thread: [], tabs: [{ id: '__act', title: '대화' }], acts: {}, ai: null, rawIntent: typed, step: null, pendingChips: null, pinned: false, live: false };
}
/** taiAI(sx) */
export function aiOf(sx: Session): AiState {
  if (!sx.ai) sx.ai = { hist: [], chart: null, ohlc: null, ohlcAt: 0, tf: '1d' };
  return sx.ai;
}
