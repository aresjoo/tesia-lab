// AI 사용량과 과금 상태 (원본 「sk-usage」 구역의 화면 없는 부분).
// 입력 셋(이용 방식, 이번 달 AI 사용량, 거래 크레딧)과 공식 하나.
import { AC_CFG, acS, acSubOn } from './ac';
import { bcAfterChange, bcAppend, bcBalance, bcInit, bcMonthInflow, bcMonthSpend, bcTier, type Bill } from './bc';
import { tfS, tfSave } from './tf';

/* ── AI 사용량 ── */
/** AI_SUB_USD: 구독에 든 AI 사용량(달러 상당, 화면에는 보이지 않는다) */
export const AI_SUB_USD = 200;
export type AiTier = 'FREE' | 'UID' | 'CARD' | 'CARD_UID';
/** aiTier() */
export function aiTier(): AiTier {
  try {
    return bcTier();
  } catch {
    return 'FREE';
  }
}
export type AiMeter = { tier: AiTier; used: number; allow: number; pct: number; bal: number; reset: number };
/** aiMeter() */
export function aiMeter(): AiMeter {
  const tier = aiTier();
  let used = 0;
  let bal = 0;
  try {
    used = bcMonthSpend();
    bal = bcBalance();
  } catch {
    /* 무시 */
  }
  let allow: number;
  if (tier === 'FREE' || tier === 'UID') allow = used + Math.max(0, bal); /* 무료분과 거래 크레딧은 원장 잔액이 덮는 만큼 */
  else allow = AI_SUB_USD + (tier === 'CARD_UID' ? Math.max(0, bal) : 0); /* 구독 포함분, 둘 다면 거래 크레딧이 더해진다 */
  const pct = allow > 0 ? Math.min(100, Math.round((used / allow) * 100)) : used > 0 ? 100 : 0;
  let b: Bill | null = null;
  try {
    b = bcInit();
  } catch {
    /* 무시 */
  }
  let reset: number;
  if (b && b.cycleAt) reset = b.cycleAt + 30 * 864e5;
  else {
    const d = new Date();
    reset = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }
  try {
    const sub = acS().sub;
    if (acSubOn() && sub && sub.next) reset = sub.next; /* 구독이면 결제일과 같은 날 초기화 */
  } catch {
    /* 무시 */
  }
  return { tier, used, allow, pct, bal, reset };
}
/** aiBill(): 이번 달 청구 */
export function aiBill(): { gross: number; credit: number; extra: number; total: number } {
  const m = aiMeter();
  let gross = 0;
  let credit = 0;
  let extra = 0;
  try {
    const sub = acS().sub;
    gross = acSubOn() ? (sub && sub.price) || AC_CFG.price : 0;
  } catch {
    /* 무시 */
  }
  try {
    if (m.tier === 'CARD_UID' || m.tier === 'UID') credit = Math.min(gross, bcMonthInflow());
  } catch {
    /* 무시 */
  }
  if (m.tier === 'CARD' || m.tier === 'CARD_UID') extra = Math.max(0, m.used - AI_SUB_USD - (m.tier === 'CARD_UID' ? Math.max(0, m.bal) : 0));
  return { gross, credit, extra, total: Math.max(0, gross - credit + extra) };
}
/** aiNext(): 상태별 다음 행동. UID 만이면 카드 등록, 구독만이면 초대 계정 연결, 둘 다면 크레딧 추가, 무료면 이용 방식 고르기.
 *  go 는 화면이 풀어 쓴다: card = 결제 탭에서 카드 추가 창, brokers = 거래소 연결, topup = 크레딧 추가 창 */
export function aiNext(): { label: string; go: 'card' | 'brokers' | 'topup' } {
  const t = aiTier();
  if (t === 'UID') return { label: '카드 등록', go: 'card' };
  if (t === 'CARD') return { label: '초대 계정 연결', go: 'brokers' };
  if (t === 'CARD_UID') return { label: '크레딧 추가', go: 'topup' };
  return { label: '이용 방식 고르기', go: 'brokers' };
}
/** aiAuto() */
export function aiAuto(): boolean {
  try {
    return !!tfS().aiAutoTop;
  } catch {
    return false;
  }
}
/** aiAutoSet(on) */
export function aiAutoSet(on: boolean) {
  tfS().aiAutoTop = !!on;
  tfSave();
}
/** aiTopupDo(v) 의 원장 부분: 충전한 만큼 적고 상태(관망, 유예)를 다시 가린다 */
export function aiTopupDo(v: number) {
  try {
    bcAppend('grant', 'topup', +v, null, 'topup' + Date.now());
    bcAfterChange('topup');
  } catch {
    /* 무시 */
  }
  tfSave();
}
