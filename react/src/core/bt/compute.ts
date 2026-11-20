// 백테스트 여정의 계산 (원본 bt 1/4): 고른 기간으로 엔진을 돌리고 화면이 쓰는 값을 한 번에 만든다.
// 수치는 모두 카탈로그 엔진(mkRunCfg)이 고른 기간으로 실제 계산한 값이다.
import {
  FU_WHY,
  MK_ALIAS,
  MK_CAT,
  MK_UNI,
  MK_WHY,
  MK_WHY_P,
  PRICE0,
  fuAiTxt,
  fuNeed,
  fuOuts,
  fuSd,
  fuSig,
  futClose,
  idxToDate,
  mkDate,
  mkPct0,
  mkPx,
  mkPxFmt,
  mkRunCfg,
  mkTk,
  mkUni,
  type Cfg,
  type EngEvent,
  type EngOpen,
  type RunResult,
  type Strat,
} from './engine';
import { btMine, type TfState } from './tf';

export type Pair = [string, string];
export type DecKind = 'pick' | 'buy' | 'sell' | 'skip' | 'hold';
/** 판단 하나 (원본 R.D 의 한 줄) */
export interface Dec {
  k: DecKind;
  tag: string;
  title: string;
  cmp?: string;
  why?: string;
  facts: Pair[];
  p0?: Pair;
  p1?: Pair | null;
  p2?: Pair;
  ups?: string[] | null;
  chain?: number;
  pnl?: number;
  side?: number;
  e: EngEvent;
  i: number;
  j: number;
  a?: string;
  tk: string;
  tid?: number;
  ix: number;
  /** btPlain 이 붙이는 쉬운 말 */
  act?: string;
  say?: string;
  out?: { t: string; v: number; mute?: number } | null;
  jt?: string | null;
}
/** AI 판단 전략의 재평가 하루 (원본 R.EV) */
export interface EvDay {
  j: number;
  i: number;
  ds: Dec[];
  ix: number;
  out: string;
  tag: string;
  title: string;
  cmp?: string;
  why?: string;
  ups?: string[] | null;
  k: DecKind;
}
export interface Tr {
  id: number;
  a: string;
  e: number;
  x: number | null;
  ep: number;
  xp: number;
  pnl: number;
  why: string | null;
  cost: number;
  got: number | null;
  fee: number | null;
  days: number;
  open?: number;
  side?: number;
  lev?: number;
  fund?: number;
}
export interface Stop {
  j: number;
  ds: Dec[];
  sk?: boolean;
  hold?: boolean;
  kind?: 'buy' | 'hold' | 'skip';
  full?: number;
  t?: number[];
  dw?: number;
  jShown?: number;
}
export interface Seg {
  k: 'go' | 'stop';
  a: number;
  b: number;
  j: number;
  st: Stop | null;
  t0: number;
  t1: number;
}
export interface Month {
  k: number;
  y: number;
  m: number;
  base: number;
  last: number;
  d0: number;
  d1: number;
  dim: number;
  ret: number;
  part: boolean;
}
export interface DD {
  v: number;
  a: number;
  b: number;
}
/** 원본 BT.R */
export interface BtR {
  r: RunResult;
  eq: { i: number; v: number }[];
  i0: number;
  N: number;
  T: number;
  bench: number[];
  benchMdd: number;
  mon: Month[];
  dd: DD[];
  cnt: Record<string, number>;
  D: Dec[];
  EV: EvDay[];
  tr: Tr[];
  wins: Tr[];
  loss: Tr[];
  avgW: number;
  avgL: number;
  rec: number | null;
  list: string[];
  px: number[][];
  nBuy: number;
  nSkip: number;
  nHold: number;
  nOpp: number;
  ret: number;
  mdd: number;
  n: number;
  win: number;
  benchRet: number;
  final: number;
  benchFinal: number;
  seg: Seg[];
  runMs: number;
  prepMs: number;
  wrapMs: number;
  stops: Stop[];
}
/** 원본 BT 의 계산에 드는 칸 */
export interface BtCtx {
  s: Strat;
  per: number;
  amt: number;
}

export const BT_PER: [number, string][] = [
  [90, '최근 3개월'],
  [365, '최근 1년'],
  [730, '최근 2년'],
  [0, '전체 기간'],
];
export const BT_AMT = [500, 1000, 3000, 10000];

/* ── 표기 ── */
/** btUsd(v,d) */
export function btUsd(v: number, d?: number): string {
  return (v < 0 ? '-' : '') + '$' + (d ? Math.abs(v).toFixed(d) : Math.round(Math.abs(v)).toLocaleString());
}
/** btUsdS(v) */
export function btUsdS(v: number): string {
  const r = Math.round(v);
  return (r > 0 ? '+' : r < 0 ? '-' : '') + '$' + Math.abs(r).toLocaleString();
}
/** btPx(v): 토큰화 상품도 거래소에서는 USDT 로 사고판다 */
export const btPx = (v: number) => '$' + mkPxFmt(v);
/** btPerL() */
export function btPerL(per: number): string {
  for (const p of BT_PER) if (p[0] === per) return p[1];
  return '전체 기간';
}
/** btYMD(i) */
export const btYMD = (i: number) => mkDate(i);
/** btGate(s) */
export const btGate = (s: Strat) => s.kind === 'mix' && (s.cfg.gate || 0) > 0;
/** btAi(s) */
export const btAi = (s: Strat) => btGate(s) || s.kind === 'agent';
/** btNeed(s) */
export const btNeed = (s: Strat) => Math.ceil((s.cfg.gate || 0) * mkUni(s).list.length);
/** btOppL(s) */
export const btOppL = (s: Strat) => (s.kind === 'agent' ? 'AI 재평가' : btGate(s) ? '기회' : '조건 충족');
/** btSkipL(s) */
export const btSkipL = (s: Strat) => (s.kind === 'agent' ? '쉬어 감' : 'AI 보류');
/** btDefFilt(s) */
export const btDefFilt = (s: Strat) => (btAi(s) ? 'opp' : 'all');
export const isFut = (s: Strat | null | undefined) => !!(s && s.cfg && s.cfg.fut);

/* ── 전략 찾기 (원본 tfSSFind 가운데 백테스트가 쓰는 길) ── */
/** tfSSNe(n) */
export const tfSSNe = (n: string) => encodeURIComponent(n).replace(/'/g, '%27').replace(/\\/g, '%5C');
/** tfSS3Rid(s) */
export const tfSS3Rid = (s: Strat) => (s.mine ? 'mine' : s.me ? 'me' : tfSSNe(s.id || s.nick));
/** tfRankSeeds() 의 한 줄. 성과(r, score)는 백테스트 화면이 쓰지 않아 여기서는 돌리지 않는다. */
function seedOf(c: Cfg): Strat {
  return { id: c.id, kind: c.kind, mkt: c.mkt, nick: c.name || '', name: c.name, one: c.one, asset: c.kind === 'rule' ? (c.asset as string) : MK_UNI[c.uni as string].label, uni: c.uni || null, cfg: c, ex: c.ex || null, p: null, fw: c.fw || 0, by: c.by || '' };
}
/** tfSSFind(nick): 카탈로그 전략이나 대화로 만든 내 전략. 공유한 내 전략(me)은 cfg 가 없어 백테스트 대상이 아니다. */
export function tfSSFind(nick: string, t: TfState, hasUser: boolean): Strat | null {
  if (nick === 'mine') return btMine(t, hasUser);
  if (nick === 'me') return null;
  const id = MK_ALIAS[nick] || null;
  for (const c of MK_CAT) if (c.id === nick || c.name === nick || (id && c.id === id)) return seedOf(c);
  return null;
}

/* ── 전략의 규칙과 백테스트 조건을 쉬운 말로 (준비 화면) ── */
/** fuBtRules(s) */
export function fuBtRules(s: Strat): Pair[] {
  const c = s.cfg;
  const o: Pair[] = [];
  if (c.kind !== 'rule') o.push([c.kind === 'agent' ? 'AI 판단' : '방향과 종목', (c.kind === 'mix' ? 'AI가 ' : '') + fuAiTxt(s)]);
  if (c.kind !== 'agent') o.push(['진입', fuSig(c) + (c.reg ? '. 롱은 ' + c.reg + '일 평균 위, 숏은 아래에서만' : '')]);
  o.push(['청산', fuOuts(c).join('. ') || '재평가 때 방향이나 순위가 바뀌면 닫습니다']);
  o.push(['레버리지', (c.lev || 0) > 1 ? c.lev + '배, 손실은 넣은 증거금까지' : '1배']);
  return o;
}
/** btRules(s) (선물이면 fuBtRules) */
export function btRules(s: Strat): Pair[] {
  if (isFut(s)) return fuBtRules(s);
  const c = s.cfg;
  const u = mkUni(s);
  const n = u.list.length;
  const o: Pair[] = [];
  if (s.kind === 'agent') {
    o.push(['종목 고르기', 'AI가 ' + c.every + '일마다 ' + u.label + '을 비교해 최대 ' + c.top + '종목']);
    o.push(['쉬는 때', '오름세 종목이 ' + n + '개 중 ' + btNeed(s) + '개 미만이면 새로 사지 않음']);
    o.push(['파는 때', '든 뒤 가장 높았던 가격에서 ' + c.trail + '% 밀리면']);
  } else {
    if (s.kind === 'mix') o.push(['종목 고르기', 'AI가 ' + c.every + '일마다 ' + u.label + ' 중 가장 강한 하나']);
    o.push(['사는 때', '되돌림 점수가 ' + c.rsiTh + ' 아래로 내려간 뒤 하루 만에 0.5% 넘게 다시 오르면' + (c.tf ? ', 오름세일 때만' : '') + (c.fng != null ? ', 공포 탐욕 지수가 ' + c.fng + ' 이하일 때만' : '')]);
    if (btGate(s)) o.push(['AI 확인', '조건이 맞아도 오름세 종목이 ' + n + '개 중 ' + btNeed(s) + '개 미만이면 사지 않음']);
    o.push(['파는 때', (c.tp != null ? '+' + c.tp + '% 오르거나 ' : '') + c.sl + '% 내리면, 또는 25일이 지나면']);
  }
  return o;
}
/** btTerms() (선물이면 fuBtTerms) */
export function btTerms(s: Strat): Pair[] {
  const many = mkUni(s).list.length > 1;
  if (isFut(s))
    return [
      ['판단 시점', '하루 한 번, UTC 0시 종가로 정하고 다음 날 시가에 체결'],
      ['비용', '수수료 0.055%, 미끄러짐 0.05%, 펀딩비는 실제 기록'],
      ['장중 위험', '그날 고가와 저가로 손절과 강제 청산을 확인'],
      ['비교 대상', many ? '같은 종목을 똑같이 나눠 현물로 그냥 들고 있었을 때' : '같은 종목을 현물로 그냥 들고 있었을 때'],
    ];
  return [
    ['판단 시점', '하루 한 번, 그날 마지막 가격으로'],
    ['비용', '살 때와 팔 때마다 수수료 0.1%'],
    ['비교 대상', many ? '같은 종목을 똑같이 나눠 그냥 들고 있었을 때' : '같은 종목을 그냥 들고 있었을 때'],
  ];
}
/** btUps(list,px,i): 그날 오름세로 센 종목(엔진과 같은 기준: 가격이 60일 평균보다 위) */
export function btUps(list: string[], px: number[][], i: number): string[] {
  const o: string[] = [];
  list.forEach((k, q) => {
    const P = px[q];
    if (i < 60) return;
    let a = 0;
    for (let z = i - 59; z <= i; z++) a += P[z];
    if (P[i] > a / 60) o.push(k);
  });
  return o;
}

/* ── 선물 전략의 판단 기록 (원본 fuBtSig, fuBtDec) ── */
function fuBtSig(c: Cfg, e: EngEvent, tk: string): Pair {
  const up = (e.side || 0) > 0;
  if (c.mode === 'brk') return [tk + ' ' + c.n + '일 ' + (up ? '최고가 돌파' : '최저가 이탈'), e.ref ? '기준 $' + mkPxFmt(e.ref) + '를 종가로 ' + (up ? '넘었습니다' : '벗어났습니다') : ''];
  if (c.mode === 'ma') return [tk + ' 평균선 ' + (up ? '위로' : '아래로') + ' 교차', c.fast + '일 평균이 ' + c.slow + '일 평균을 ' + (up ? '넘었습니다' : '밑돌았습니다')];
  if (c.mode === 'dip') return [tk + (up ? ' 밀린 뒤 반등' : ' 오른 뒤 꺾임'), '하루 ' + mkPct0(e.chg1 || 0, 1)];
  if (c.mode === 'fg') return [tk + (up ? ' 공포 구간 반등' : ' 과열 구간 꺾임'), '공포 탐욕 지수 ' + (e.fng != null ? e.fng : '-')];
  return [tk, ''];
}
type DecDraft = Omit<Dec, 'e' | 'i' | 'j' | 'a' | 'tk' | 'tid' | 'ix'>;
function fuBtDec(s: Strat, e: EngEvent, x: { n8: number; upsOf: (e: EngEvent) => string[] | null }): DecDraft | null {
  const c = s.cfg;
  const tk = e.a ? mkTk(e.a) : '';
  const side = e.side || 0;
  const sd = e.side ? fuSd(e.side) : '';
  const q = fuNeed(c, x.n8);
  const lv = (e.lev || 0) > 1 ? e.lev + '배' : '1배';
  const top = e.top || [];
  const bot = e.bot || [];
  const held = e.held || [];
  const brd: Pair | null = e.up != null ? ['오름세 ' + e.up + ' / ' + e.of + '개', side > 0 ? '롱 기준 ' + q.L + '개 이상' : '숏 기준 ' + q.S + '개 이하'] : null;
  const tops = () => (top.length ? '강한 쪽 ' + mkTk(top[0].k) + ' ' + mkPct0(top[0].mom, 0) + ', 약한 쪽 ' + (bot[0] ? mkTk(bot[0].k) + ' ' + mkPct0(bot[0].mom, 0) : '-') : '');
  const liq = (e.liq || 0) > 0 && isFinite(e.liq as number) ? btPx(e.liq as number) : '없음';
  if (e.t === 'unpick') return null;
  if (e.t === 'pick')
    return {
      k: 'pick',
      tag: '선정',
      title: tk + ' ' + sd + ' 후보',
      side: e.side,
      cmp: '오름세 ' + e.up + ' / ' + e.of + ', ' + c.look + '일 ' + mkPct0(e.mom as number, 1),
      why: 'AI가 시장 방향을 ' + sd + '으로 보고 ' + (side > 0 ? '가장 강한' : '가장 약한') + ' 종목을 골랐습니다',
      facts: [
        ['오름세 종목', e.of + '개 중 ' + e.up + '개'],
        ['강한 쪽', top.map((t) => mkTk(t.k) + ' ' + mkPct0(t.mom, 0)).join(', ')],
        ['약한 쪽', bot.map((t) => mkTk(t.k) + ' ' + mkPct0(t.mom, 0)).join(', ')],
      ],
    };
  if (e.t === 'veto') {
    const sg = fuBtSig(c, e, tk);
    const reg = e.reg || 0;
    return {
      k: 'skip',
      tag: '보류',
      title: tk + ' ' + sd,
      side: e.side,
      chain: 1,
      cmp: 'AI가 본 방향과 반대',
      why: sd + ' 신호가 나왔지만 AI가 본 시장 방향과 달라 진입하지 않았습니다',
      p0: sg,
      p1: ['오름세 ' + e.up + ' / ' + e.of + '개', 'AI가 본 방향은 ' + (reg > 0 ? '롱' : reg < 0 ? '숏' : '쉼')],
      p2: ['보류', '방향이 달라 진입하지 않았습니다'],
      ups: x.upsOf(e),
      facts: [
        ['규칙 신호', sd + ', ' + sg[0]],
        ['AI가 본 방향', reg > 0 ? '롱' : reg < 0 ? '숏' : '쉼'],
        ['오름세 종목', e.of + '개 중 ' + e.up + '개'],
      ],
    };
  }
  if (e.t === 'skip')
    return {
      k: 'skip',
      tag: '쉬어 감',
      title: '새로 진입하지 않음',
      cmp: '오름세 ' + e.up + ' / ' + e.of + ', 방향 애매',
      why: '오름세 종목이 ' + e.of + '개 중 ' + e.up + '개라 롱도 숏도 기준에 못 미쳤습니다',
      p0: [x.n8 + '종목 비교', tops()],
      p1: ['오름세 ' + e.up + ' / ' + e.of + '개', '롱 ' + q.L + '개 이상, 숏 ' + q.S + '개 이하'],
      p2: ['새로 진입하지 않음', '방향이 애매해 쉬었습니다'],
      ups: x.upsOf(e),
      facts: ([['오름세 종목', e.of + '개 중 ' + e.up + '개'], ['기준', '롱은 ' + q.L + '개 이상, 숏은 ' + q.S + '개 이하']] as Pair[]).concat(held.length ? [['들고 있던 포지션', held.map(mkTk).join(', ')]] : []),
    };
  if (e.t === 'hold')
    return {
      k: 'hold',
      tag: '유지',
      title: '그대로 유지',
      cmp: held.map(mkTk).join(', ') + ' 유지',
      why: '든 포지션이 여전히 조건에 맞아 그대로 뒀습니다',
      p0: [x.n8 + '종목 비교', tops()],
      p1: ['오름세 ' + e.up + ' / ' + e.of + '개', '방향 유지'],
      p2: ['그대로 유지', '포지션을 바꾸지 않았습니다'],
      ups: x.upsOf(e),
      facts: [
        ['들고 있던 포지션', held.map(mkTk).join(', ')],
        ['오름세 종목', e.of + '개 중 ' + e.up + '개'],
      ],
    };
  if (e.t === 'enter') {
    if (c.kind === 'agent')
      return {
        k: 'buy',
        tag: sd + ' 진입',
        title: tk,
        side: e.side,
        cmp: (side > 0 ? '강한 쪽 ' : '약한 쪽 ') + e.rank + '위, ' + c.look + '일 ' + mkPct0(e.mom as number, 1),
        why: 'AI가 시장 방향을 ' + sd + '으로 보고 ' + (side > 0 ? '강한' : '약한') + ' 쪽 ' + e.rank + '번째 종목에 진입했습니다',
        p0: [x.n8 + '종목 비교', tops()],
        p1: brd,
        p2: [tk + ' ' + sd + ' 진입', lv + ', 다음 날 시가'],
        ups: x.upsOf(e),
        facts: [
          ['진입 가격', btPx(e.px as number)],
          ['비중', Math.round((e.w || 0) * 100) + '%'],
          ['방향과 배수', sd + ' ' + lv],
          ['강제 청산 가격', liq],
          ['순위', (side > 0 ? '강한 쪽 ' : '약한 쪽 ') + e.rank + '위, ' + c.look + '일 ' + mkPct0(e.mom as number, 1)],
          ['오름세 종목', e.of + '개 중 ' + e.up + '개'],
        ],
      };
    const s1 = fuBtSig(c, e, tk);
    const mix = c.kind === 'mix';
    return {
      k: 'buy',
      tag: sd + ' 진입',
      title: tk,
      side: e.side,
      chain: mix ? 1 : 0,
      cmp: s1[0].replace(tk + ' ', ''),
      why: s1[0] + '. ' + s1[1],
      p0: s1,
      p1: mix ? brd : null,
      p2: [tk + ' ' + sd + ' 진입', lv + ', 다음 날 시가'],
      ups: mix ? x.upsOf(e) : null,
      facts: ([['신호', s1[0] + (s1[1] ? ', ' + s1[1] : '')]] as Pair[])
        .concat(mix && e.up != null ? [['오름세 종목', e.of + '개 중 ' + e.up + '개']] : [])
        .concat([
          ['진입 가격', btPx(e.px as number)],
          ['방향과 배수', sd + ' ' + lv],
          ['강제 청산 가격', liq],
        ]),
    };
  }
  return {
    k: 'sell',
    tag: sd + ' 청산',
    title: tk,
    side: e.side,
    pnl: e.pnl,
    cmp: FU_WHY[e.why as string] || '',
    why: FU_WHY[e.why as string] || '',
    facts: [
      ['청산 가격', btPx(e.px as number)],
      ['진입 가격', btPx(e.ep as number)],
      ['이 거래의 손익', mkPct0(e.pnl as number, 1) + ', 넣은 돈 기준'],
      ['청산한 이유', FU_WHY[e.why as string] || ''],
      ['낸 펀딩비', mkPct0((-(e.fund || 0) / (e.cost || 1)) * 100, 1)],
    ],
  };
}

/* ── 계산 ── */
/** btCompute(): 고른 기간으로 엔진을 돌리고, 화면이 쓰는 값을 한 번에 만든다 (끝에 btPlan, btPlain 까지) */
export function btCompute(B: BtCtx): BtR {
  const s = B.s;
  const c = s.cfg;
  const T = PRICE0.length - 1;
  const min = c.startI != null ? c.startI : 61;
  const st = B.per ? Math.max(min, T - B.per) : min;
  const r = mkRunCfg(c, st);
  const eq = r.eq;
  const i0 = eq[0].i;
  const N = eq.length;
  const list = mkUni(s).list;
  const px = list.map((k) => mkPx(k));
  const bench = eq.map((p) => {
    let a = 0;
    px.forEach((P) => {
      a += P[p.i] / P[i0];
    });
    return a / px.length;
  });
  let bpk = 0;
  let bmd = 0;
  bench.forEach((v) => {
    if (v > bpk) bpk = v;
    const d = v / bpk - 1;
    if (d < bmd) bmd = d;
  });
  const mon: Month[] = [];
  let cur: Month | null = null;
  eq.forEach((p, j) => {
    const d = idxToDate(p.i);
    const k = d.getFullYear() * 12 + d.getMonth();
    if (!cur || cur.k !== k) {
      if (cur) mon.push(cur);
      cur = { k, y: d.getFullYear(), m: d.getMonth() + 1, base: j ? eq[j - 1].v : 1, last: p.v, d0: d.getDate(), d1: d.getDate(), dim: new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), ret: 0, part: false };
    }
    cur.last = p.v;
    cur.d1 = d.getDate();
  });
  if (cur) mon.push(cur);
  mon.forEach((m) => {
    m.ret = (m.last / m.base - 1) * 100;
    m.part = m.d0 > 1 || m.d1 < m.dim;
  });
  /* 그날까지의 가장 나빴던 구간(재생하는 동안 자라난다) */
  const dd: DD[] = [];
  let pk = eq[0].v;
  let pkJ = 0;
  let best: DD = { v: 0, a: 0, b: 0 };
  eq.forEach((p, j) => {
    if (p.v >= pk) {
      pk = p.v;
      pkJ = j;
    }
    const d = p.v / pk - 1;
    if (d < best.v) best = { v: d, a: pkJ, b: j };
    dd.push(best);
  });
  const ev = r.events || [];
  const cnt: Record<string, number> = { enter: 0, exit: 0, veto: 0, skip: 0, pick: 0, hold: 0, unpick: 0 };
  ev.forEach((e) => {
    if (cnt[e.t] != null) cnt[e.t]++;
  });
  const look = c.look as number;
  const D: Dec[] = [];
  const gate = btGate(s);
  const need = btNeed(s);
  const n8 = list.length;
  const agent = s.kind === 'agent';
  const lastPick: Record<string, EngEvent> = {};
  const upsOf = (e: EngEvent) => {
    const u = btUps(list, px, e.i);
    return u.length === e.up ? u : null;
  };
  const brd = (e: EngEvent): Pair => ['오름세 ' + e.up + ' / ' + e.of + '개', '기준 ' + need + '개 이상'];
  const md = (i: number) => {
    const d = idxToDate(i);
    return String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  };
  const momAt = (k: string, i: number) => {
    const P = px[list.indexOf(k)];
    return P && i - look >= 0 ? (P[i] / P[i - look] - 1) * 100 : 0;
  };
  const pkTxt = (p: EngEvent) => 'AI가 ' + md(p.i) + '에 고른 종목, 그날 ' + look + '일 상승률 ' + mkPct0(p.mom as number, 1);
  const pkFacts = (p: EngEvent, e: EngEvent): Pair[] => [
    ['AI가 고른 날', btYMD(p.i) + ', 오름세 종목 중 ' + look + '일 상승률 1위 ' + mkPct0(p.mom as number, 1)],
    ['이날의 ' + look + '일 상승률', mkPct0(momAt(e.a as string, e.i), 1)],
  ];
  const top1 = (e: EngEvent) => {
    const t = (e.top || [])[0];
    return t ? '점수 1위 ' + mkTk(t.k) + ', ' + look + '일 ' + mkPct0(t.mom, 1) : '';
  };
  const push = (d0: DecDraft, e: EngEvent) => {
    const d = d0 as Dec;
    d.e = e;
    d.i = e.i;
    d.j = Math.max(0, Math.min(N - 1, e.i - i0));
    d.a = e.a;
    d.tk = e.a ? mkTk(e.a) : '';
    d.tid = e.tid;
    d.ix = D.length;
    D.push(d);
    return d;
  };
  ev.forEach((e) => {
    const tk = e.a ? mkTk(e.a) : '';
    const held = e.held || [];
    if (c.fut) {
      const fd = fuBtDec(s, e, { n8, upsOf });
      if (fd) push(fd, e);
      return;
    }
    if (e.t === 'pick') {
      lastPick[e.a as string] = e;
      push({ k: 'pick', tag: '선정', title: tk, cmp: '오름세 종목 중 ' + look + '일 상승률 1위 ' + mkPct0(e.mom as number, 1), why: '오름세 종목 중 최근 ' + look + '일 상승률이 ' + mkPct0(e.mom as number, 1) + '로 가장 높았습니다', facts: (e.top || []).slice(0, 3).map((x, q): Pair => [q + 1 + '위', mkTk(x.k) + ' ' + mkPct0(x.mom, 0)]) }, e);
      return;
    }
    if (e.t === 'enter') {
      if (agent) {
        push(
          {
            k: 'buy',
            tag: '매수',
            title: tk,
            cmp: '흔들림까지 본 순위 ' + (e.rank || 1) + '위, ' + look + '일 ' + mkPct0(e.mom as number, 1),
            why: '가격 흔들림까지 고려한 순위에서 ' + (e.rank || 1) + '번째였습니다. 최근 ' + look + '일 상승률은 ' + mkPct0(e.mom as number, 1) + '입니다',
            p0: [n8 + '종목 비교', top1(e)],
            p1: brd(e),
            p2: [tk + ' 매수', '새로 담았습니다'],
            ups: e.of ? upsOf(e) : null,
            facts: [
              ['산 가격', btPx(e.px as number)],
              ['비중', Math.round((e.w || 0) * 100) + '%'],
              ['순위', (e.rank || 1) + '위, 상승률을 가격 흔들림으로 나눈 점수 기준'],
              ['최근 ' + look + '일 상승률', mkPct0(e.mom as number, 1)],
              ['오름세 종목', e.of + '개 중 ' + e.up + '개, 기준 ' + need + '개 이상'],
            ],
          },
          e,
        );
        return;
      }
      const pk2 = lastPick[e.a as string];
      const pkT = pk2 ? pkTxt(pk2) : '떨어진 뒤 다시 올랐습니다';
      push(
        {
          k: 'buy',
          tag: '매수',
          title: tk,
          chain: gate ? 1 : 0,
          cmp: gate ? '오름세 ' + e.up + ' / ' + e.of + ', 기준 ' + need : '하루 반등 ' + mkPct0(e.bounce as number, 1),
          why: gate ? '오름세 종목이 ' + e.of + '개 중 ' + e.up + '개라 샀습니다' : '떨어진 뒤 하루 만에 ' + mkPct0(e.bounce as number, 1) + ' 다시 올랐습니다',
          p0: [tk + ' 하루 반등 ' + mkPct0(e.bounce as number, 1), pkT],
          p1: gate && e.of ? brd(e) : null,
          p2: [tk + ' 매수', gate ? '기준을 넘어 샀습니다' : '조건이 맞아 샀습니다'],
          ups: gate && e.of ? upsOf(e) : null,
          facts: (pk2 ? pkFacts(pk2, e) : [])
            .concat([
              ['하루 반등', mkPct0(e.bounce as number, 1) + ', 기준 0.5% 넘게'],
              ['되돌림 점수', Math.round(e.rsi as number) + ', 기준 ' + c.rsiTh + ' 아래'],
            ])
            .concat(gate && e.of ? [['오름세 종목', e.of + '개 중 ' + e.up + '개, 기준 ' + need + '개 이상']] : [])
            .concat(c.fng != null && e.fng != null ? [['공포 탐욕 지수', e.fng + ', 기준 ' + c.fng + ' 이하']] : [])
            .concat([['산 가격', btPx(e.px as number)]]),
        },
        e,
      );
      return;
    }
    if (e.t === 'exit') {
      const why = MK_WHY[e.why as string] || '';
      push({ k: 'sell', tag: '매도', title: tk, pnl: e.pnl, cmp: why, why, facts: [['판 가격', btPx(e.px as number)], ['이 거래의 손익', mkPct0(e.pnl as number, 1)], ['판 이유', why]] }, e);
      return;
    }
    if (e.t === 'veto') {
      const pk3 = lastPick[e.a as string];
      push(
        {
          k: 'skip',
          tag: '보류',
          title: tk,
          chain: 1,
          cmp: '오름세 ' + e.up + ' / ' + e.of + ', 기준 ' + need,
          why: '오름세 종목이 ' + e.of + '개 중 ' + e.up + '개뿐이라 사지 않았습니다',
          p0: [tk + ' 하루 반등 ' + mkPct0(e.bounce as number, 1), pk3 ? pkTxt(pk3) : '떨어진 뒤 다시 올랐습니다'],
          p1: brd(e),
          p2: ['보류', '기준에 못 미쳐 사지 않았습니다'],
          ups: upsOf(e),
          facts: (pk3 ? pkFacts(pk3, e) : []).concat([
            ['하루 반등', mkPct0(e.bounce as number, 1) + ', 기준 0.5% 넘게'],
            ['되돌림 점수', Math.round(e.rsi as number) + ', 기준 ' + c.rsiTh + ' 아래'],
            ['오름세 종목', e.of + '개 중 ' + e.up + '개, 기준 ' + need + '개 이상'],
          ]),
        },
        e,
      );
      return;
    }
    if (e.t === 'skip') {
      const weak = e.why === 'gate';
      push(
        {
          k: 'skip',
          tag: '쉬어 감',
          title: '새로 사지 않음',
          cmp: weak ? '오름세 ' + e.up + ' / ' + e.of + ', 기준 ' + need : '살 만한 종목 없음',
          why: weak ? '오름세 종목이 ' + e.of + '개 중 ' + e.up + '개뿐이라 시장이 약하다고 봤습니다' : '오름세이면서 충분히 강한 종목이 없었습니다',
          p0: [n8 + '종목 비교', top1(e)],
          p1: weak ? brd(e) : ['살 만한 종목 0개', '오름세이고 충분히 강해야 합니다'],
          p2: ['새로 사지 않음', weak ? '시장이 약해 쉬었습니다' : '살 종목이 없어 쉬었습니다'],
          ups: upsOf(e),
          facts: ([['오름세 종목', e.of + '개 중 ' + e.up + '개, 기준 ' + need + '개 이상'], ['쉬어 간 이유', weak ? '오름세 종목이 기준보다 적었습니다' : '오름세이면서 충분히 강한 종목이 없었습니다']] as Pair[]).concat(held.length ? [['들고 있던 종목', held.map(mkTk).join(', ')]] : []),
        },
        e,
      );
      return;
    }
    if (e.t === 'hold') {
      push(
        {
          k: 'hold',
          tag: '유지',
          title: '그대로 유지',
          cmp: held.map(mkTk).join(', ') + ' 보유',
          why: '이미 ' + held.length + '종목을 들고 있어 그대로 뒀습니다',
          p0: [n8 + '종목 비교', top1(e)],
          p1: ['빈자리 0개', '이미 ' + held.length + '종목 보유 중'],
          p2: ['그대로 유지', '보유 종목을 그대로 유지했습니다'],
          ups: upsOf(e),
          facts: [
            ['들고 있던 종목', held.map(mkTk).join(', ')],
            ['오름세 종목', e.of + '개 중 ' + e.up + '개, 기준 ' + need + '개 이상'],
          ],
        },
        e,
      );
    }
  });
  /* AI 판단 전략: 재평가 한 번이 한 줄. 그날 산 종목, 유지, 쉬어 감을 결과로 적는다 */
  const EV: EvDay[] = [];
  if (agent) {
    const byD: Record<number, EvDay> = {};
    D.forEach((d) => {
      if (d.k !== 'buy' && d.k !== 'skip' && d.k !== 'hold') return;
      if (!byD[d.j]) {
        byD[d.j] = { j: d.j, i: d.i, ds: [] } as unknown as EvDay;
        EV.push(byD[d.j]);
      }
      byD[d.j].ds.push(d);
    });
    EV.forEach((E, q) => {
      const b = E.ds.filter((d) => d.k === 'buy');
      const f = E.ds[0];
      E.ix = q;
      E.out = b.length ? 'buy' : f.k;
      E.tag = b.length ? '매수' : f.tag;
      E.title = b.length ? b.map((d) => d.tk).join(', ') : f.title;
      E.cmp = b.length === 1 ? b[0].cmp : b.length ? b.map((d) => d.tk + ' ' + d.cmp).join(' / ') : f.cmp;
      E.why = f.why;
      E.ups = f.ups;
      E.k = b.length ? 'buy' : f.k;
    });
  }
  const so = r.state && r.state.open;
  const op: EngOpen[] = so ? (Array.isArray(so) ? so : [so]) : [];
  const tr: Tr[] = (r.trades || []).map((t) => ({ id: t.id, a: t.asset, e: t.entry, x: t.exit, ep: t.ep, xp: t.xp, pnl: t.pnl * 100, why: t.kind, cost: t.cost, got: t.got, fee: t.fee, days: t.exit - t.entry, side: t.side, lev: t.lev, fund: t.fund }));
  op.forEach((o) => {
    tr.push({ id: o.tid, a: o.k, e: o.entry, x: null, ep: o.ep, xp: o.px, pnl: o.pnl != null ? o.pnl : o.chg, why: null, cost: o.cost, got: null, fee: null, days: T - o.entry, open: 1, side: o.side, lev: o.lev });
  });
  tr.sort((a, b) => b.e - a.e);
  const wins = tr.filter((t) => !t.open && t.pnl > 0);
  const loss = tr.filter((t) => !t.open && t.pnl <= 0);
  const avg = (a: Tr[]) => (a.length ? a.reduce((x, t) => x + t.pnl, 0) / a.length : 0);
  let rec: number | null = null;
  const a0 = Math.max(0, r.mddStartI - i0);
  for (let q = Math.max(0, r.mddEndI - i0); q < N; q++) {
    if (eq[q].v >= eq[a0].v) {
      rec = eq[q].i;
      break;
    }
  }
  const nK = (k: DecKind) => D.filter((d) => d.k === k).length;
  const R: BtR = {
    r,
    eq,
    i0,
    N,
    T,
    bench,
    benchMdd: bmd * 100,
    mon,
    dd,
    cnt,
    D,
    EV,
    tr,
    wins,
    loss,
    avgW: avg(wins),
    avgL: avg(loss),
    rec,
    list,
    px,
    nBuy: nK('buy'),
    nSkip: nK('skip'),
    nHold: nK('hold'),
    nOpp: agent ? EV.length : nK('buy') + nK('skip'),
    ret: r.ret,
    mdd: r.mdd,
    n: r.n,
    win: r.winRate,
    benchRet: (bench[N - 1] - 1) * 100,
    final: B.amt * eq[N - 1].v,
    benchFinal: B.amt * bench[N - 1],
    seg: [],
    runMs: 0,
    prepMs: 700,
    wrapMs: 900,
    stops: [],
  };
  btPlan(R, s);
  try {
    btPlain(R, s);
  } catch {
    /* 쉬운 말을 못 만들어도 계산 결과는 그대로 쓴다 */
  }
  return R;
}

/**
 * btPlan(): 재생 계획. 걸리는 시간은 정해 두지 않는다.
 * 아무 일 없는 날은 일정한 속도로 지나간다. 처음 나오는 매수와 처음 나오는 보류는 단계마다 읽을 시간을 주고,
 * 그 뒤의 판단은 완성된 모습으로 짧게 보여 준다. 날짜가 기회의 날에 닿는 것과 결정이 나는 것은 다른 일이다
 */
export function btPlan(R: BtR, s: Strat): void {
  const stops: Stop[] = [];
  const by: Record<number, Stop> = {};
  R.D.forEach((d) => {
    if (d.k !== 'buy' && d.k !== 'skip' && d.k !== 'hold') return;
    if (!by[d.j]) {
      by[d.j] = { j: d.j, ds: [] };
      stops.push(by[d.j]);
    }
    by[d.j].ds.push(d);
  });
  stops.sort((a, b) => a.j - b.j);
  const ai = btAi(s);
  let seenBuy = 0;
  let seenSkip = 0;
  let nBrief = 0;
  const gap = Math.max(2, Math.round(R.N / 110));
  const imp: Record<number, number> = {};
  if (ai) {
    const cl = R.tr
      .filter((t) => !t.open)
      .slice()
      .sort((a, b) => a.pnl - b.pnl);
    if (cl.length >= 4)
      [cl[0], cl[cl.length - 1]].forEach((t) => {
        R.D.forEach((d) => {
          if (d.k === 'buy' && d.tid === t.id) imp[d.j] = 1;
        });
      });
  }
  stops.forEach((st, ix) => {
    const hasBuy = st.ds.some((d) => d.k === 'buy');
    const hold = !hasBuy && st.ds[0].k === 'hold';
    const sk = !hasBuy && !hold;
    const prev = stops[ix - 1];
    st.sk = sk;
    st.hold = hold;
    st.kind = hasBuy ? 'buy' : hold ? 'hold' : 'skip';
    if (hold) {
      st.dw = 0;
      return;
    }
    if ((sk ? !seenSkip : !seenBuy) || imp[st.j]) {
      st.full = 1;
      st.t = ai ? [900, 1000, 1300] : [900, 0, 1200];
      st.dw = st.t[0] + st.t[1] + st.t[2];
      if (sk) seenSkip = 1;
      else seenBuy = 1;
    } else if (prev && (prev.dw as number) > 0 && !prev.full && st.j - prev.j <= gap && prev.sk === sk) {
      st.dw = 0;
    } else if (nBrief < 7) {
      st.dw = ai ? 420 : 320;
      nBrief++;
    } else st.dw = 0;
  });
  const bar = Math.max(4.5, Math.min(14, 5200 / R.N)); /* 지나가는 날의 속도: 그래프가 자라는 것이 보일 만큼 */
  const seg: Seg[] = [];
  let t = 0;
  let pj = -1;
  /* 기회가 있는 날에는 멈춤 구간만 들어간다. 지나가는 구간은 그 전날까지 */
  stops.forEach((st) => {
    const dw = st.dw as number;
    const to = dw > 0 ? st.j - 1 : st.j;
    if (to > pj) {
      const dt = (to - pj) * bar;
      seg.push({ k: 'go', a: pj, b: to, j: 0, st: null, t0: t, t1: t + dt });
      t += dt;
      pj = to;
    }
    if (dw > 0) {
      seg.push({ k: 'stop', a: 0, b: 0, j: st.j, st, t0: t, t1: t + dw });
      t += dw;
      pj = st.j;
    }
  });
  if (pj < R.N - 1) {
    const d2 = (R.N - 1 - pj) * bar;
    seg.push({ k: 'go', a: pj, b: R.N - 1, j: 0, st: null, t0: t, t1: t + d2 });
    t += d2;
  }
  R.seg = seg;
  R.runMs = t;
  R.prepMs = 700;
  R.wrapMs = 900;
  R.stops = stops;
}

/** 종목의 가격 선 (선물이면 선물 종가) */
export function seriesOf(s: Strat, k: string): number[] {
  return (s.cfg.fut && futClose(k)) || mkPx(k);
}

/** btPlain(): 쉬운 말. 무엇을 봤고, 무엇을 했고, 그 뒤 어떻게 됐나 */
export function btPlain(R: BtR, s: Strat): void {
  const c = s.cfg;
  const fut = !!c.fut;
  const n = R.list.length;
  const T = R.T;
  const trOf = (id: number) => R.tr.find((x) => x.id === id) || null;
  R.D.forEach((d) => {
    const e = d.e || ({} as EngEvent);
    const tk = d.tk;
    const sd = d.side ? (d.side > 0 ? '롱' : '숏') : '';
    d.act = d.k === 'buy' ? tk + ' ' + (fut ? sd + ' 진입' : '매수') : d.k === 'sell' ? tk + ' ' + (fut ? sd + ' 청산' : '매도') : d.k === 'pick' ? tk + (fut ? ' ' + sd + ' 후보' : ' 선정') : d.k === 'hold' ? '보유 유지' : tk ? tk + ' 보류' : '쉬어 감';
    if (fut) {
      d.say = String(d.why || '').replace(/어요\.?$/, '습니다');
    } else if (d.k === 'buy') {
      d.say = s.kind === 'agent' ? n + '종목을 비교한 순위에서 ' + (e.rank || 1) + '번째로 강해 자산의 ' + Math.round((e.w || 0) * 100) + '%로 매수했습니다' : btGate(s) && e.of ? e.of + '종목 중 ' + e.up + '종목이 오름세여서 반등 신호를 받아들였습니다' : '밀린 뒤 하루 ' + mkPct0(e.bounce || 0, 1) + ' 반등해 조건이 맞았습니다';
    } else if (d.k === 'skip' && d.tk) {
      d.say = '반등 신호는 나왔지만 ' + e.of + '종목 중 ' + e.up + '종목만 오름세여서 기다렸습니다';
    } else if (d.k === 'skip') {
      d.say = e.why === 'gate' ? '오름세 종목이 ' + e.of + '개 중 ' + e.up + '개뿐이라 새로 사지 않았습니다' : '기준을 넘는 종목이 없어 새로 사지 않았습니다';
    } else if (d.k === 'hold') {
      d.say = '보유 종목이 여전히 상위권이라 바꾸지 않았습니다';
    } else if (d.k === 'pick') {
      d.say = '최근 ' + c.look + '일 동안 가장 강해 거래 대상으로 골랐습니다';
    } else if (d.k === 'sell') {
      d.say = (MK_WHY_P[e.why as string] || '').replace(/다$/, '습니다').replace(/했습니다습니다$/, '했습니다').replace(/닿았습니다습니다$/, '닿았습니다');
    }
    d.out = null;
    if (d.k === 'buy' && d.tid != null) {
      const t = trOf(d.tid);
      if (t) d.out = t.open ? { t: '보유 중', v: t.pnl } : { t: t.days + '일 뒤 ' + (fut ? '청산' : '매도'), v: t.pnl };
    } else if (d.k === 'sell' && d.pnl != null) d.out = { t: '이 거래', v: d.pnl };
    else if (d.k === 'skip' && d.a) {
      const P = seriesOf(s, d.a);
      const q = Math.min(T, d.i + 25);
      if (q > d.i) d.out = { t: '그 뒤 ' + (q - d.i) + '일', v: (P[q] / P[d.i] - 1) * 100, mute: 1 };
    }
  });
}

/* ── 화면이 읽는 요약 ── */
/** btSteps() */
export function btSteps(s: Strat): Pair[] {
  return [
    ['prep', '가격 자료 준비'],
    ['run', '하루씩 다시 돌리기'],
    ['chk', s.kind === 'agent' ? 'AI 판단 되짚기' : btGate(s) ? '기회마다 AI 확인' : s.kind === 'mix' ? 'AI 종목 선정과 조건 확인' : '사는 조건 확인'],
    ['wrap', '결과 정리'],
  ];
}
/** btCols() */
export function btCols(s: Strat): string[] {
  return s.kind === 'agent' ? ['AI 재평가', '시장 확인', '결정'] : btGate(s) ? ['기회 발견', 'AI 확인', '결정'] : ['조건 충족', '결정'];
}
export type SumCell = [string, Pair[], string];
/** btSumCells() (선물이면 fuSumCells): 다 돌린 뒤 칸이 요약이 된다 */
export function btSumCells(R: BtR, s: Strat): SumCell[] {
  const need = btNeed(s);
  const w = R.wins.length;
  const l = R.loss.length;
  const days = R.N.toLocaleString() + '일 동안';
  if (isFut(s)) {
    const nL = R.D.filter((d) => d.k === 'buy' && (d.side || 0) > 0).length;
    const nS = R.nBuy - nL;
    if (s.kind === 'agent') return [['AI 재평가', [[R.nOpp + '번', 'opp']], days], ['시장 확인', [['쉬어 감 ' + R.nSkip + '번', 'skip']], '유지 ' + R.nHold + '번'], ['결정', [['진입 ' + R.nBuy + '번', 'buy']], '롱 ' + nL + '번, 숏 ' + nS + '번']];
    if (btGate(s)) return [['기회 발견', [[R.nOpp + '번', 'opp']], days], ['AI 확인', [[R.nOpp + '번 모두', 'opp']], 'AI가 본 방향과 같은 신호만'], ['결정', [['진입 ' + R.nBuy + '번', 'buy'], ['보류 ' + R.nSkip + '번', 'skip']], '롱 ' + nL + '번, 숏 ' + nS + '번']];
    return [['조건 충족', [[R.nBuy + '번', 'buy']], '롱 ' + nL + '번, 숏 ' + nS + '번'], ['결정', [['이긴 거래 ' + w + '번', 'win'], ['진 거래 ' + l + '번', 'loss']], '진입 ' + R.nBuy + '번']];
  }
  if (s.kind === 'agent') return [['AI 재평가', [[R.nOpp + '번', 'opp']], days], ['시장 확인', [['쉬어 감 ' + R.nSkip + '번', 'skip']], '유지 ' + R.nHold + '번'], ['결정', [['종목 매수 ' + R.nBuy + '번', 'buy']], '끝난 거래 ' + (w + l) + '번']];
  if (btGate(s)) return [['기회 발견', [[R.nOpp + '번', 'opp']], days], ['AI 확인', [[R.nOpp + '번 모두', 'opp']], '기준: 오름세 ' + need + '개 이상'], ['결정', [['매수 ' + R.nBuy + '번', 'buy'], ['보류 ' + R.nSkip + '번', 'skip']], '끝난 거래 ' + (w + l) + '번']];
  return [['조건 충족', [[R.nBuy + '번', 'buy']], days], ['결정', [['이긴 거래 ' + w + '번', 'win'], ['진 거래 ' + l + '번', 'loss']], '매수 ' + R.nBuy + '번']];
}
/** btCount(j,decided): 그날까지 공개된 판단만 센다 */
export function btCount(R: BtR, s: Strat, j: number, decided: boolean) {
  let o = 0;
  let b = 0;
  let sk = 0;
  let hd = 0;
  let cl = 0;
  const days: Record<number, number> = {};
  R.D.forEach((d) => {
    if (d.j > j || (d.j === j && !decided)) return;
    if (d.k === 'sell') {
      cl++;
      return;
    }
    if (d.k === 'buy') {
      b++;
      days[d.j] = 1;
      o++;
    } else if (d.k === 'skip') {
      sk++;
      days[d.j] = 1;
      o++;
    } else if (d.k === 'hold') {
      hd++;
      days[d.j] = 1;
    }
  });
  return { o: s.kind === 'agent' ? Object.keys(days).length : o, b, s: sk, h: hd, c: cl };
}
/** btHolding(i) (선물이면 방향을 붙인다) */
export function btHolding(R: BtR, s: Strat, i: number): string[] {
  const h: string[] = [];
  const fut = isFut(s);
  R.tr.forEach((t) => {
    if (t.e <= i && (t.x == null || t.x > i)) h.push(mkTk(t.a) + (fut ? ' ' + fuSd(t.side as number) : ''));
  });
  return h;
}
/** btChkTxt(c) */
export function btChkTxt(R: BtR, s: Strat, c: { o: number; b: number; s: number }): string {
  return s.kind === 'agent' ? '재평가 ' + c.o + '번, 매수 ' + c.b + '번, 쉬어 감 ' + c.s + '번' : btGate(s) ? '기회 ' + c.o + '번, 매수 ' + c.b + '번, 보류 ' + c.s + '번' : s.kind === 'mix' ? '선정 ' + R.cnt.pick + '번, 매수 ' + c.b + '번' : '조건 충족 ' + c.b + '번';
}
/** btLatest(j): 그날까지 공개된 판단 중 가장 최근 것 */
export function btLatest(R: BtR, j: number): Stop | null {
  let o: Stop | null = null;
  for (const st of R.stops) {
    if (st.j > j) break;
    o = st;
  }
  return o;
}
/** btWinTxt() */
export function btWinTxt(R: BtR): string {
  const n = R.wins.length + R.loss.length;
  return n ? n + '번 중 ' + R.wins.length + '번' : '아직 없음';
}
/** btMonthsSum() */
export function btMonthsSum(R: BtR): string {
  const m = R.mon.filter((x) => !x.part);
  const u = m.filter((x) => x.ret >= 0.05).length;
  return m.length ? '온전한 ' + m.length + '개월 중 ' + u + '개월이 올랐습니다' : '';
}
/** btSum4(): 판단 기록 위의 요약 칸 */
export function btSum4(R: BtR, s: Strat): [string, string, number][] {
  const fut = isFut(s);
  const ai = btAi(s);
  const o: [string, string, number][] = [];
  if (ai) o.push(['opp', s.kind === 'agent' ? '다시 비교한 날' : '검토한 기회', R.nOpp]);
  o.push(['buy', fut ? '진입' : '매수', R.nBuy]);
  if (ai) o.push(['skip', s.kind === 'agent' ? '쉬어 감' : '보류', R.nSkip]);
  o.push(['sell', fut ? '청산' : '매도', R.cnt.exit]);
  return o;
}
export interface DecRow {
  d?: Dec;
  ev?: EvDay;
}
/** btDecList(f): 근거 목록에 나올 줄. AI 판단 전략의 "재평가"는 하루가 한 줄 */
export function btDecList(R: BtR, s: Strat, f: string, sort: string): DecRow[] {
  let L: DecRow[];
  if (f === 'opp') L = s.kind === 'agent' ? R.EV.map((E) => ({ ev: E })) : R.D.filter((d) => d.k === 'buy' || d.k === 'skip').map((d) => ({ d }));
  else L = R.D.filter((d) => (f === 'all' ? d.k !== 'pick' || s.kind === 'mix' : d.k === f)).map((d) => ({ d }));
  const key = (x: DecRow) => ((x.d || x.ev) as Dec | EvDay).i;
  const imp = (x: DecRow) => {
    const d = x.d;
    return d && d.out && !d.out.mute ? Math.abs(d.out.v) : d && d.pnl != null ? Math.abs(d.pnl) : -1;
  };
  if (sort === 'old') L.sort((a, b) => key(a) - key(b));
  else if (sort === 'big') L.sort((a, b) => imp(b) - imp(a) || key(b) - key(a));
  else L.sort((a, b) => key(b) - key(a));
  return L;
}
/** btRowAt(L,d) */
export function btRowAt(L: DecRow[], d: Dec): number {
  for (let i = 0; i < L.length; i++) {
    if (L[i].d === d) return i;
    const ev = L[i].ev;
    if (ev && ev.j === d.j) return i;
  }
  return -1;
}
/** btTrList() */
export function btTrList(R: BtR, f: string): Tr[] {
  return R.tr.filter((t) => (f === 'win' ? !t.open && t.pnl > 0 : f === 'loss' ? !t.open && t.pnl <= 0 : true));
}
/** btTradeOf(tid) */
export const btTradeOf = (R: BtR, tid: number) => R.tr.find((x) => x.id === tid) || null;
/** btNear(j): 그래프에서 가까운 판단 */
export function btNear(R: BtR, j: number): Dec | null {
  const tol = Math.max(1, Math.round(R.N / 140));
  let best: Dec | null = null;
  R.D.forEach((d) => {
    if (d.k === 'pick' || d.k === 'hold') return;
    const q = Math.abs(d.j - j);
    if (q <= tol && (!best || q < Math.abs(best.j - j))) best = d;
  });
  return best;
}
