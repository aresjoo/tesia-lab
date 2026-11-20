// 파생 상태 엔진 (원본 tfDeriveCfg, tfDerive). 저장도 알림도 하지 않는 순수 계산이다.
// 이용 현황, 터미널, 전략 복사, 거래소 연결 화면이 모두 이 결과만 읽는다. 화면에 안 쓰는 칸도 원본 그대로 낸다.
import { bcBalance, bcInit, bcMonthSpend, bcMonthVol, type BcRate } from './bc';
import { TFC } from './tfc.data';
import { S, tfNFInit } from './tf';

export type DeriveCfg = { USAGE_HIGH: number; TRADE_HIGH: number; PLAN_KRW: number; INCLUDED: number; UNIT_KRW: number; KRW_PER_CREDIT: number; WELCOME_KRW: number };

/** tfDeriveCfg(): 원본처럼 TFC.derive 를 처음 한 번 채우고, 거래량 요율표에 bitget 을 더한다 */
export function tfDeriveCfg(): DeriveCfg {
  const T = TFC as unknown as { derive?: DeriveCfg; billing?: { VOLUME_TO_CREDIT_RATE?: Record<string, BcRate | undefined> } };
  let d = T.derive;
  if (!d) d = T.derive = { USAGE_HIGH: 1500, TRADE_HIGH: 1500, PLAN_KRW: 280000, INCLUDED: 1000, UNIT_KRW: 10, KRW_PER_CREDIT: 25, WELCOME_KRW: 1000 };
  const r = T.billing && T.billing.VOLUME_TO_CREDIT_RATE;
  if (r && !r.bitget) r.bitget = { spot: 0.0004, futures: 0.0006 };
  return d;
}

/** TF_EX_NAME */
export const TF_EX_NAME: Record<string, string> = { bitget: 'Bitget', binance: 'Binance', okx: 'OKX', bybit: 'Bybit', woox: 'WOO X', mexc: 'MEXC' };
/** tfExName(id) */
export const tfExName = (id: string | null | undefined): string => (id && TF_EX_NAME[id]) || id || '';
/** tfWon(n): 원 단위 값을 달러 글자로 (천으로 나눠 반올림) */
export const tfWon = (n: number | string | null | undefined): string => '$' + Math.round((+(n as number) || 0) / 1000).toLocaleString();

export type DeriveKey =
  | 'guest'
  | 'signed'
  | 'linked-zero'
  | 'linked-low'
  | 'linked-high'
  | 'plan-high-unlinked'
  | 'plan-low-unlinked'
  | 'plan-linked-zero'
  | 'plan-high-high'
  | 'plan-high-low'
  | 'plan-low-high'
  | 'plan-low-low';
/** action 은 원본의 onclick 글자 그대로다 ("tfNav('#/trade')", "tfAcSheet('bitget')" ...). 화면이 풀어서 실행한다 */
export type DeriveCta = { label: string; action: string };
export type Derive = {
  ready: boolean;
  stateId: number | null;
  stateKey: DeriveKey;
  facts: {
    loggedIn: boolean;
    uid: boolean;
    api: boolean;
    ex: string | null;
    plan: boolean;
    usage: number;
    usageBand: 'high' | 'low';
    trade: number;
    tradeBand: 'zero' | 'low' | 'high';
    freeLeft: number;
    freeQuota: number;
    balance: number;
    watch: boolean;
    owned: number;
    draft: boolean;
  };
  entitlement: { browse: boolean; chat: boolean; backtest: boolean; paper: boolean; live: boolean; follow: boolean };
  coverage: 'none' | 'blocked' | 'covered' | 'free' | 'partial' | 'postpaid';
  bill: { plan: number; overage: number; commission: number; free: number; due: number; offsetPct: number; line: string; display: string; offsetWord: string };
  primaryCTA: DeriveCta | null;
  secondaryCTA: DeriveCta | null;
  activation: { uid: 'done' | 'none'; api: 'done' | 'none'; card: 'done' | 'none'; message: string; ex: string | null };
  statusLine: string;
  reduceHint: string | null;
  interrupt: 'none' | 'block' | 'inline' | 'toast';
  terminalMode: 'guest' | 'active' | 'inactive';
};

/** tfDerive() */
export function tfDerive(): Derive {
  const D = tfDeriveCfg();
  /* 원본은 저장 복원(TF_STATE_READY)과 부팅(TF_BOOTED)이 끝났는지 본다. 여기는 뜰 때 바로 읽으니 늘 참이다 */
  const ready = true;
  const user = !!S.user;
  const t = tfNFInit();
  const b = bcInit();
  const uid = user && !!t.uidLinked;
  const api = user && !!(t.api && t.api.ex);
  const ex = t.api ? t.api.ex : (t.ob && t.ob.ex) || null;
  const plan = user && !!(b.cardOn || t.payDone);
  const fq = TFC.credit && TFC.credit.freeQuota != null ? TFC.credit.freeQuota : 10;
  const freeUsed = user ? t.freeUsed || 0 : 0;
  const freeLeft = Math.max(0, fq - freeUsed);
  const unit = (TFC.billing && TFC.billing.AI_CALL_COST) || 10;
  const usage = user ? bcMonthSpend() + freeUsed * unit : 0;
  const trade = user && uid ? bcMonthVol() : 0;
  const usageBand = usage >= D.USAGE_HIGH ? 'high' : 'low';
  const tradeBand = trade <= 0 ? 'zero' : trade < D.TRADE_HIGH ? 'low' : 'high';
  const bal = user ? bcBalance() : 0;
  const watch = user && b.mode === 'watch';
  const cp = t.cp as { copies?: { status?: string }[] } | null | undefined;
  const cps = (cp && cp.copies) || [];
  const termClones = (t.termClones as unknown[] | undefined) || [];
  const owned = user ? (t.strat || []).length + termClones.length + cps.filter((c) => c.status === 'active').length : 0;
  const draft = user && !!(t.cur && t.score >= TFC.score.pass);
  /* 분류 */
  let id: number | null = null;
  let key: DeriveKey = 'guest';
  if (!user) {
    id = 1;
    key = 'guest';
  } else if (!plan) {
    if (!uid) {
      id = 2;
      key = 'signed';
    } else {
      id = { zero: 3, low: 4, high: 5 }[tradeBand];
      key = ({ zero: 'linked-zero', low: 'linked-low', high: 'linked-high' } as const)[tradeBand];
    }
  } else if (!uid) {
    id = usageBand === 'high' ? 6 : 7;
    key = usageBand === 'high' ? 'plan-high-unlinked' : 'plan-low-unlinked';
  } else if (tradeBand === 'zero') {
    id = null;
    key = 'plan-linked-zero';
  } else {
    const mm = (
      {
        'high/high': [8, 'plan-high-high'],
        'high/low': [9, 'plan-high-low'],
        'low/high': [10, 'plan-low-high'],
        'low/low': [11, 'plan-low-low'],
      } as const
    )[(usageBand + '/' + tradeBand) as 'high/high' | 'high/low' | 'low/high' | 'low/low'];
    id = mm[0];
    key = mm[1];
  }
  /* 청구: 월 청구 = max(0, 플랜료 + 초과 종량 - 커미션 크레딧 - 무료 크레딧) */
  const planFee = plan ? D.PLAN_KRW : 0;
  const overage = Math.max(0, usage - (plan ? D.INCLUDED : 0)) * D.UNIT_KRW;
  const commission = trade * D.KRW_PER_CREDIT;
  const freeKrw = user && !plan ? D.WELCOME_KRW : 0;
  const due = Math.max(0, planFee + overage - commission - freeKrw);
  const gross = planFee + overage;
  const offsetPct = gross > 0 ? Math.min(100, Math.round((Math.min(commission, gross) / gross) * 100)) : 0;
  const W = (n: number) => '$' + Math.round(n / 1000).toLocaleString();
  let line: string;
  if (!user) line = '';
  else if (plan) line = '플랜 ' + W(planFee) + (overage > 0 ? ' + 추가 사용 ' + W(overage) : '') + (commission > 0 ? ' - 상쇄 ' + W(Math.min(commission, gross)) : '') + ' = 청구 ' + W(due);
  else if (due > 0)
    line =
      '추가 사용 ' +
      W(overage) +
      (commission > 0 ? ' - 상쇄 ' + W(Math.min(commission, gross)) : '') +
      (freeKrw > 0 ? ' - 무료 혜택 ' + W(Math.min(freeKrw, Math.max(0, gross - Math.min(commission, gross)))) : '') +
      ' = 청구 ' +
      W(due);
  else line = '이번 달 청구 $0' + (commission > 0 ? ', 거래 혜택으로 상쇄' : '');
  const offsetWord = commission <= 0 ? '' : due === 0 ? '거래 혜택으로 전액 상쇄됐습니다' : '거래 혜택으로 일부 상쇄됐습니다';
  const display = !user ? '' : '이번 달 예상 청구 ' + W(due) + (offsetWord ? ', ' + offsetWord : '');
  let coverage: Derive['coverage'];
  if (!user) coverage = 'none';
  else if (watch) coverage = 'blocked';
  else if (due === 0 && commission > 0) coverage = 'covered';
  else if (due === 0) coverage = 'free';
  else if (commission > 0) coverage = 'partial';
  else if (plan) coverage = 'postpaid';
  else coverage = freeLeft > 0 || bal > 0 ? 'partial' : 'blocked';
  /* 상태 문장, 줄이는 방법 */
  const exName = tfExName(ex) || '거래소';
  const ST: Record<DeriveKey, string> = {
    guest: '',
    signed: '연결이나 결제 없이 만들고 검증할 수 있습니다',
    'linked-zero': exName + ' 연결이 끝났습니다. 첫 거래부터 이용료 상쇄가 시작됩니다',
    'linked-low': '거래 혜택으로 이용료 일부가 상쇄됐습니다. 부족분은 카드로 청구됩니다',
    'linked-high': '이번 달 이용료가 거래 혜택으로 충당됐습니다',
    'plan-high-unlinked': 'AI를 많이 쓰고 있습니다. 거래소를 연결하면 거래 혜택으로 이용료가 줄 수 있습니다',
    'plan-low-unlinked': '플랜을 정상 이용 중입니다',
    'plan-high-high': '거래 혜택이 플랜과 추가 사용료를 상쇄하고 있습니다',
    'plan-high-low': 'AI 사용이 많아 추가 사용료가 있습니다. 거래 혜택으로 일부 상쇄됐습니다',
    'plan-low-high': 'TETH가 이번 달 플랜 비용을 대신 냈습니다',
    'plan-low-low': '플랜에서 거래 혜택을 뺀 금액만 청구됩니다',
    'plan-linked-zero': '준비 완료입니다. 첫 거래부터 이용료 상쇄가 시작됩니다',
  };
  let statusLine = ST[key] || '';
  if (user && freeLeft === 0 && key === 'signed') statusLine = '무료로 쓸 수 있는 만큼 다 썼습니다. 거래소를 연결하거나 카드를 등록하면 계속 쓸 수 있습니다';
  else if (user && freeLeft <= 2 && key === 'signed') statusLine = '무료로 쓸 수 있는 분량이 곧 끝납니다. 중단 없이 쓰려면 거래소를 연결하거나 카드를 등록하십시오';
  if (watch) statusLine = 'AI 기능이 잠시 멈춰 있습니다. 카드 등록이나 거래소 연결 즉시 다시 켜집니다';
  let reduceHint: string | null = null;
  if (user && !uid) reduceHint = '거래소를 연결하면 거래 혜택으로 이용료가 상쇄됩니다';
  else if (user && !plan && due > 0) reduceHint = '카드를 등록하면 부족분이 자동으로 청구됩니다';
  /* CTA */
  const exec: DeriveCta =
    owned > 0 ? { label: '터미널 열기', action: "tfNav('#/trade')" } : draft ? { label: '이 전략 실행하기', action: "tfNav('#/strategy/connect')" } : { label: '공개 전략 골라보기', action: "tfShareHub('find')" };
  let pri: DeriveCta | null = null;
  let sec: DeriveCta | null = null;
  if (!user) {
    pri = { label: '무료로 시작', action: "authOpen('signup')" };
    sec = null;
  } else if (key === 'signed') {
    pri = exec;
    sec = { label: '직접 만들기', action: 'gHome()' };
  } else if (key === 'linked-zero' || key === 'plan-linked-zero') {
    pri = exec;
    sec = { label: '공개 전략 골라보기', action: "tfShareHub('find')" };
  } else if (key === 'plan-high-unlinked') {
    pri = { label: '거래소 연결', action: "tfAcSheet('bitget')" };
    sec = { label: '이용 현황 보기', action: "tfNav('#/plan')" };
  } else if (key === 'plan-low-unlinked') {
    pri = exec;
    sec = { label: '거래소 연결', action: "tfAcSheet('bitget')" };
  } else if (key === 'linked-low') {
    pri = exec;
    sec = { label: '카드 등록', action: "tfAcSheet('card')" };
  } else if (key === 'plan-high-low') {
    pri = exec;
    sec = { label: '이용 현황 보기', action: "tfNav('#/plan')" };
  } else {
    pri = exec;
    sec = null;
  }
  let interrupt: Derive['interrupt'] = 'none';
  if (watch) interrupt = 'block';
  else if ((key === 'signed' && freeLeft === 0) || key === 'linked-low' || key === 'plan-high-unlinked' || key === 'plan-high-low') interrupt = 'inline';
  else if (key === 'plan-low-high') interrupt = 'toast';
  const actMsg = !user ? '로그인이 필요합니다' : uid && api ? exName + ' 연결됨' : uid ? '요금 연동 완료, 실행 연결 필요' : api ? '실행 연결 완료, 요금 연동은 선택' : '거래소 미연결';
  return {
    ready,
    stateId: id,
    stateKey: key,
    facts: { loggedIn: user, uid, api, ex, plan, usage, usageBand, trade, tradeBand, freeLeft, freeQuota: fq, balance: bal, watch, owned, draft },
    entitlement: { browse: true, chat: user && !watch && (freeLeft > 0 || plan || bal > 0), backtest: user && !watch && (freeLeft > 0 || plan || bal > 0), paper: user, live: user && api && (draft || owned > 0), follow: user && api },
    coverage,
    bill: { plan: planFee, overage, commission, free: freeKrw, due, offsetPct, line, display, offsetWord },
    primaryCTA: pri,
    secondaryCTA: sec,
    activation: { uid: uid ? 'done' : 'none', api: api ? 'done' : 'none', card: plan ? 'done' : 'none', message: actMsg, ex },
    statusLine,
    reduceHint,
    interrupt,
    terminalMode: !user ? 'guest' : owned > 0 ? 'active' : 'inactive',
  };
}
