// 파생 상태 엔진. 원본 tfDerive(): 저장, 알림, 초기화 없이 계정 상태에서 화면이 읽을 값만 만든다.
// 정본: ux/spec/UX_STATE_MATRIX.md, ux/spec/QA_SCENARIOS.md
import { bcBalance, bcInit, bcMonthSpend, bcMonthVol, TFC, type TfState } from './state';

/** TF_EX_NAME */
export const TF_EX_NAME: Record<string, string> = { bitget: 'Bitget', binance: 'Binance', okx: 'OKX', bybit: 'Bybit', woox: 'WOO X', mexc: 'MEXC' };
/** tfExName(id) */
export const tfExName = (id: string | null | undefined) => (id && TF_EX_NAME[id]) || id || '';

/** 원본은 onclick 문자열을 들고 다닌다. 여기서는 같은 문자열을 열쇠로 두고 화면이 동작에 잇는다. */
export type Cta = { label: string; action: string };
export type StateKey = 'guest' | 'signed' | 'linked-zero' | 'linked-low' | 'linked-high' | 'plan-high-unlinked' | 'plan-low-unlinked' | 'plan-linked-zero' | 'plan-high-high' | 'plan-high-low' | 'plan-low-high' | 'plan-low-low';
export type Derived = ReturnType<typeof tfDerive>;

const W = (n: number) => '$' + Math.round(n / 1000).toLocaleString();

/** tfDerive(). loggedIn 은 S.user, now 는 Date.now(), ready 는 TF_STATE_READY&&TF_BOOTED */
export function tfDerive(t: TfState, loggedIn: boolean, now: number, ready = true) {
  const D = TFC.derive;
  const user = loggedIn;
  const b = bcInit(t);
  const uid = user && !!t.uidLinked;
  const api = user && !!(t.api && t.api.ex);
  const ex = t.api ? t.api.ex : (t.ob && t.ob.ex) || null;
  const plan = user && !!(b.cardOn || t.payDone);
  const fq = TFC.credit.freeQuota != null ? TFC.credit.freeQuota : 10;
  const freeUsed = user ? t.freeUsed || 0 : 0;
  const freeLeft = Math.max(0, fq - freeUsed);
  const unit = TFC.billing.AI_CALL_COST || 10;
  const usage = user ? bcMonthSpend(t, now) + freeUsed * unit : 0;
  const trade = user && uid ? bcMonthVol(t, now) : 0;
  const usageBand: 'high' | 'low' = usage >= D.USAGE_HIGH ? 'high' : 'low';
  const tradeBand: 'zero' | 'low' | 'high' = trade <= 0 ? 'zero' : trade < D.TRADE_HIGH ? 'low' : 'high';
  const bal = user ? bcBalance(t) : 0;
  const watch = user && b.mode === 'watch';
  const cps = (t.cp && t.cp.copies) || [];
  const owned = user ? (t.strat || []).length + (t.termClones || []).length + cps.filter((c) => c.status === 'active').length : 0;
  const draft = user && !!(t.cur && t.score >= TFC.score.pass);
  /* 분류 */
  let id: number | null = null;
  let key: StateKey = 'guest';
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
    const mm = ({ 'high/high': [8, 'plan-high-high'], 'high/low': [9, 'plan-high-low'], 'low/high': [10, 'plan-low-high'], 'low/low': [11, 'plan-low-low'] } as const)[`${usageBand}/${tradeBand}` as 'high/high' | 'high/low' | 'low/high' | 'low/low'];
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
  let line: string;
  if (!user) line = '';
  else if (plan) line = '플랜 ' + W(planFee) + (overage > 0 ? ' + 추가 사용 ' + W(overage) : '') + (commission > 0 ? ' - 상쇄 ' + W(Math.min(commission, gross)) : '') + ' = 청구 ' + W(due);
  else if (due > 0) line = '추가 사용 ' + W(overage) + (commission > 0 ? ' - 상쇄 ' + W(Math.min(commission, gross)) : '') + (freeKrw > 0 ? ' - 무료 혜택 ' + W(Math.min(freeKrw, Math.max(0, gross - Math.min(commission, gross)))) : '') + ' = 청구 ' + W(due);
  else line = '이번 달 청구 $0' + (commission > 0 ? ', 거래 혜택으로 상쇄' : '');
  const offsetWord = commission <= 0 ? '' : due === 0 ? '거래 혜택으로 전액 상쇄됐습니다' : '거래 혜택으로 일부 상쇄됐습니다';
  const display = !user ? '' : '이번 달 예상 청구 ' + W(due) + (offsetWord ? ', ' + offsetWord : '');
  let coverage: 'none' | 'blocked' | 'covered' | 'free' | 'partial' | 'postpaid';
  if (!user) coverage = 'none';
  else if (watch) coverage = 'blocked';
  else if (due === 0 && commission > 0) coverage = 'covered';
  else if (due === 0) coverage = 'free';
  else if (commission > 0) coverage = 'partial';
  else if (plan) coverage = 'postpaid';
  else coverage = freeLeft > 0 || bal > 0 ? 'partial' : 'blocked';
  /* 상태 문장, 줄이는 방법 */
  const exName = tfExName(ex) || '거래소';
  const ST: Record<StateKey, string> = {
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
  const exec: Cta = owned > 0 ? { label: '터미널 열기', action: "tfNav('#/trade')" } : draft ? { label: '이 전략 실행하기', action: "tfNav('#/strategy/connect')" } : { label: '공개 전략 골라보기', action: "tfShareHub('find')" };
  let pri: Cta | null = null;
  let sec: Cta | null = null;
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
  let interrupt: 'none' | 'block' | 'inline' | 'toast' = 'none';
  if (watch) interrupt = 'block';
  else if ((key === 'signed' && freeLeft === 0) || key === 'linked-low' || key === 'plan-high-unlinked' || key === 'plan-high-low') interrupt = 'inline';
  else if (key === 'plan-low-high') interrupt = 'toast';
  const actMsg = !user ? '로그인이 필요합니다' : uid && api ? exName + ' 연결됨' : uid ? '요금 연동 완료, 실행 연결 필요' : api ? '실행 연결 완료, 요금 연동은 선택' : '거래소 미연결';
  const live = user && api && (draft || owned > 0);
  const can = user && !watch && (freeLeft > 0 || plan || bal > 0);
  return {
    ready,
    stateId: id,
    stateKey: key,
    facts: { loggedIn: user, uid, api, ex, plan, usage, usageBand, trade, tradeBand, freeLeft, freeQuota: fq, balance: bal, watch, owned, draft },
    entitlement: { browse: true, chat: can, backtest: can, paper: user, live, follow: user && api },
    coverage,
    bill: { plan: planFee, overage, commission, free: freeKrw, due, offsetPct, line, display, offsetWord },
    primaryCTA: pri,
    secondaryCTA: sec,
    activation: { uid: uid ? 'done' : 'none', api: api ? 'done' : 'none', card: plan ? 'done' : 'none', message: actMsg, ex },
    statusLine,
    reduceHint,
    interrupt,
    terminalMode: (!user ? 'guest' : owned > 0 ? 'active' : 'inactive') as 'guest' | 'active' | 'inactive',
  };
}

/** tfEnt(): 자격 판정 단일 지점 (paid > trade > credit > free > free-out, 손님은 guest) */
export function tfEnt(t: TfState, loggedIn: boolean, now: number): { tier: 'low' | 'high'; why: string; label: string; bal: number | null; freeLeft?: number } {
  const C = TFC.credit;
  if (!loggedIn) return { tier: 'low', why: 'guest', label: '기본 분석', bal: null };
  if (t.payDone) return { tier: 'high', why: 'paid', label: 'PRO, 구독', bal: null };
  const tradeActive = !!t.tradeActiveUntil && now < t.tradeActiveUntil;
  if (t.uidLinked && tradeActive) return { tier: 'high', why: 'trade', label: 'PRO, 파트너 거래 활성', bal: null };
  if (t.uidLinked && t.creditBal >= C.costHigh) return { tier: 'high', why: 'credit', label: 'PRO 크레딧', bal: t.creditBal };
  const fq = C.freeQuota != null ? C.freeQuota : 10;
  if ((t.freeUsed || 0) < fq) return { tier: 'high', why: 'free', label: '무료 체험', bal: t.uidLinked ? t.creditBal : null, freeLeft: fq - (t.freeUsed || 0) };
  return { tier: 'low', why: 'free-out', label: '업그레이드 필요', bal: t.uidLinked ? t.creditBal : null };
}
