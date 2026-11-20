// 전략 위임 흐름의 상태(원본 S.tf, tfS())와 AI 가 채운 전략 설계서를 카드 값으로 바꾸는 규칙(tfAiStrategy).
// 저장 모양은 원본 그대로다: localStorage 'teth.state' 의 tf 칸에 이 TfState 가 들어간다 (쓰기는 state/tf.ts).
// 백테스트 화면(#/share/bt/mine)이 같은 키에서 intake, aiSpec, stage 를 읽는다.
import { TAI_AST } from '../tai/scope';
import type { AssetRef } from '../tai/types';
import { BT_MINE_ALIAS, PX_ASSETS, TF_INTAKE_OPT } from './intake.data';

/** 인테이크 답 하나. i 는 선택지 번호, rec 는 AI 추천으로 채운 답 */
export type TfAnswer = { i: number; label: string; rec?: boolean };
export type TfIntake = { asset?: TfAnswer; assetInfo?: AssetRef | { label: string; tv: null; data: string }; style?: TfAnswer; budget?: TfAnswer; period?: TfAnswer; stop?: TfAnswer };
/** AI 설계서를 엔진 값으로 옮긴 것. rsiTh 는 사는 깊이(52 조금, 44 보통, 38 크게, 또는 사용자가 말한 RSI 숫자) */
export type TfAiSpec = { rsiTh: number; tp: number | null; sl: number; fng: number | null; tf: boolean; name: string | null; sess?: string };
export type TfStage = 'intake' | 'ready' | 'verify' | 'report' | 'connect' | 'pay' | 'done';
/** S.tf. 이 조각이 채우는 칸만 이름을 적고, 다른 화면이 쓰는 칸은 그대로 둔다 */
export type TfState = {
  intake: TfIntake;
  qi: number;
  tries: unknown[];
  cur: unknown;
  score: number;
  plan: unknown;
  cycle: string;
  ex: unknown;
  uid: unknown;
  api: unknown;
  shared: boolean;
  followers: number;
  reward: number;
  fills: unknown[];
  strat: unknown[];
  ob: { st: string; ex: unknown; uid: string; err: unknown };
  stage?: TfStage;
  workDone?: boolean;
  aiSpec?: TfAiSpec | null;
  cloneFrom?: unknown;
  followId?: unknown;
  pendingP?: unknown;
  [k: string]: unknown;
};

/** tfS() 의 처음 값 */
export function tfDefault(): TfState {
  return { intake: {}, qi: 0, tries: [], cur: null, score: 0, plan: null, cycle: 'year', ex: null, uid: null, api: null, shared: false, followers: 0, reward: 0, fills: [], strat: [], ob: { st: 'idle', ex: null, uid: '', err: null } };
}

export const TF_QS = ['asset', 'style', 'budget', 'period', 'stop'];
/** TF_AI_DEPTH */
export const TF_AI_DEPTH: Record<string, number> = { shallow: 52, mid: 44, deep: 38 };

/** tfAssetLookup(label) */
export function tfAssetLookup(label: string): AssetRef | { label: string; tv: null; data: string } {
  for (const [, a] of TAI_AST) if (a.label === label) return a;
  return { label, tv: null, data: 'none' };
}

/** [STRATEGY {...}] 태그의 내용 */
export type StrategyTag = { asset?: string; depth?: string; tp?: number | null; sl?: number | null; fng?: number | null; trend?: boolean; period?: string; name?: string; rsi?: number | null; skip?: unknown[] };
/** 대화에 놓이는 전략 카드의 값 */
export type TfCard = { title: string; asset: string; buy: string; sell: string; period: string; skip: string | null };

/**
 * tfAiStrategy(sp): 값을 여기서 다시 검사해(프롬프트를 믿지 않는다) 인테이크 상태와 카드 글을 만든다.
 * 가격 자료가 없는 자산이면 noData 에 그 이름을 돌려준다.
 */
export function tfAiStrategy(sp: StrategyTag | null): { noData: string } | { spec: TfAiSpec; intake: TfIntake; card: TfCard } {
  let a = String((sp && sp.asset) || '');
  a = BT_MINE_ALIAS[a] || a;
  if (!sp || !PX_ASSETS.includes(a)) return { noData: a };
  const num = (v: unknown, lo: number, hi: number) => {
    const n = Number(v);
    return isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 10) / 10)) : null;
  };
  /* 사용자가 RSI 숫자를 말했으면 깊이 대신 그 숫자를 기준값으로 쓴다 */
  const rsi = sp.rsi != null && isFinite(+sp.rsi) ? Math.max(5, Math.min(70, Math.round(+sp.rsi))) : null;
  const skip = Array.isArray(sp.skip)
    ? sp.skip
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const crypto = /비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/.test(a);
  const spec: TfAiSpec = {
    rsiTh: rsi != null ? rsi : TF_AI_DEPTH[sp.depth || ''] || 44,
    tp: sp.tp == null ? null : num(sp.tp, 1, 60),
    sl: -Math.abs(num(sp.sl, -15, -1) || 5),
    fng: crypto && sp.fng != null ? num(sp.fng, 5, 95) : null,
    tf: !!sp.trend,
    name: String(sp.name || '').slice(0, 14) || null,
  };
  if (spec.sl > -1) spec.sl = -1;
  if (spec.sl < -15) spec.sl = -15;
  const pi = sp.period === '2y' ? 1 : sp.period === 'all' ? 2 : 0;
  const PL = TF_INTAKE_OPT.period;
  const intake: TfIntake = {
    asset: { i: 0, label: a },
    assetInfo: tfAssetLookup(a),
    style: { i: 1, label: 'AI 설계' },
    budget: { i: 1, label: TF_INTAKE_OPT.budget[1][0] },
    period: { i: pi, label: PL[pi][0] },
    stop: { i: 0, label: spec.sl + '%까지' },
  };
  const dep = ({ 52: '조금 밀렸다가', 44: '적당히 밀렸다가', 38: '크게 밀렸다가' } as Record<number, string>)[spec.rsiTh] || '밀렸다가';
  const card: TfCard = {
    title: spec.name || a + ' 전략',
    asset: a,
    buy: (rsi != null ? 'RSI가 ' + rsi + ' 아래로 내려갔다가' : dep) + ' 하루 0.5% 넘게 반등한 날' + (spec.tf ? ', 방향이 뚜렷할 때만' : '') + (spec.fng != null ? ', 공포 탐욕 지수 ' + spec.fng + ' 이하일 때만' : ''),
    sell: (spec.tp != null ? '+' + spec.tp + '% 오르거나 ' : '') + spec.sl + '% 내리면, 또는 25일이 지나면',
    period: PL[pi][0],
    skip: skip.length ? skip.join(', ') : null,
  };
  return { spec, intake, card };
}

/** tfResume(): 카드의 「이어서 보기」가 가는 곳 */
export function tfResumeRoute(stage: TfStage | undefined): string {
  return stage === 'report' ? '#/strategy/report' : stage === 'connect' || stage === 'pay' ? '#/strategy/connect' : stage === 'done' ? '#/strategy/done' : '#/strategy/backtest';
}
