// 크레딧 원장 (원본 「크레딧 과금 데이터 모델」과 「크레딧 엔진」 구역의 bc*). 화면 없는 순수 계산과 상태 규칙이다.
//   등급:  FREE --UID 연동--> UID --카드 등록--> CARD_UID,  FREE --카드 등록--> CARD --UID 연동--> CARD_UID
//   모드:  active --잔량이 경고선 아래--> grace --유예 시간 지나고 잔량 0--> watch, 충전이나 연동이나 결제가 오면 active
//   원장은 덧붙이기만 한다. 잔액은 줄의 합(bcBalance)이고, 고칠 때는 adjust 줄을 더한다.
import { L, tfNotify } from './nf';
import { TFC } from './tfc.data';
import { S, tfNFInit, tfSave } from './tf';

export type BcEntry = { id: string; at: number; type: string; reason: string; amt: number; ref: string | null };
export type BcCoupon = { id: string; kind: string; rate?: number; at: number; usedAt: number | null };
export type BcEv = { at: number; key: string; data: unknown };
export type BcMode = 'active' | 'grace' | 'watch';
/** 원본 S.tf.bill */
export type Bill = {
  v: number;
  /** {id,at,type,reason,amt,ref} */
  ledger: BcEntry[];
  /** 한 번만 처리하는 키: reqId, fid, 월 키, 쿠폰 키 */
  seen: Record<string, number>;
  coupons: BcCoupon[];
  events: BcEv[];
  mode: BcMode;
  graceAt: number | null;
  cardOn: boolean;
  /** 다음 월 결제 시각 */
  cycleAt: number | null;
  /** 결제 재시도 횟수 */
  cardFails: number;
  simPayFail?: boolean;
};
export type BcRate = { spot: number; futures: number };
export type BcCfg = {
  version?: number;
  WELCOME_CREDIT?: number;
  UID_CREDIT_CAP?: number;
  CARD_CREDIT_MONTHLY?: number;
  AI_CALL_COST?: number;
  THRESHOLD_WARN?: number;
  THRESHOLD_STOP?: number;
  VOLUME_TO_CREDIT_RATE?: Record<string, BcRate | undefined>;
  GRACE_HOURS?: number;
  CARD_PLAN_PRICE_USD?: number;
  DUNNING_RETRY_MAX?: number;
  DISCOUNT_RESCUE?: number;
  PROMO_AI_CREDIT_USD?: number;
};
export type BcTierK = 'CARD_UID' | 'CARD' | 'UID' | 'FREE';
export type BcBranchK = 'free.out' | 'card.out' | 'uid.novol' | 'carduid.out' | 'uid.heavy' | 'uid.small';
export type BcQuote = { gross: number; offset: number; net: number; coupon: string | null };

/** bcCfg(): 원본처럼 TFC.billing 그 값을 돌려준다 (tfDeriveCfg 가 여기에 bitget 요율을 더한다) */
export function bcCfg(): BcCfg {
  return ((TFC as unknown as { billing?: BcCfg }).billing || {}) as BcCfg;
}

/** bcInit() */
export function bcInit(): Bill {
  const t = tfNFInit() as { bill?: Partial<Bill> | null };
  if (!t.bill) t.bill = { v: 1 };
  const b = t.bill as Bill;
  if (!Array.isArray(b.ledger)) b.ledger = [];
  if (!b.seen) b.seen = {};
  if (!Array.isArray(b.coupons)) b.coupons = []; /* 받은 기록을 보는 데 쓴다 */
  if (!Array.isArray(b.events)) b.events = []; /* 경고, 전환, 복구 기록 */
  if (!b.mode) b.mode = 'active'; /* active | grace | watch */
  if (b.graceAt === undefined) b.graceAt = null;
  if (b.cardOn === undefined) b.cardOn = false;
  if (b.cycleAt === undefined) b.cycleAt = null;
  if (b.cardFails === undefined) b.cardFails = 0;
  return b;
}

/** bcTier() */
export function bcTier(): BcTierK {
  const t = tfNFInit();
  const b = bcInit();
  const uid = !!t.uidLinked;
  const card = !!b.cardOn;
  return card && uid ? 'CARD_UID' : card ? 'CARD' : uid ? 'UID' : 'FREE';
}
/** bcBalance() */
export function bcBalance(): number {
  return bcInit().ledger.reduce((a, e) => a + (e.amt || 0), 0);
}
/** bcAppend(type,reason,amt,ref,idemKey): idemKey 가 이미 있으면 덧붙이지 않고 false */
export function bcAppend(type: string, reason: string, amt: number, ref?: string | null, idemKey?: string | null): boolean {
  const b = bcInit();
  if (idemKey) {
    if (b.seen[idemKey]) return false;
    b.seen[idemKey] = Date.now();
  }
  b.ledger.push({ id: 'L' + Date.now() + Math.floor(Math.random() * 1e4), at: Date.now(), type, reason, amt, ref: ref || null });
  if (b.ledger.length > 2000) b.ledger = b.ledger.slice(-2000); /* 데모 상한 */
  return true;
}
/** bcEvent(key,data) */
export function bcEvent(key: string, data?: unknown) {
  const b = bcInit();
  b.events.push({ at: Date.now(), key, data: data || null });
  if (b.events.length > 500) b.events = b.events.slice(-500);
}

/** 이번 결제 주기의 시작 (bcMonth* 가 함께 쓰는 식) */
const cycleFrom = (b: Bill) => (b.cycleAt ? b.cycleAt - 30 * 864e5 : Date.now() - 30 * 864e5);
/** bcMonthInflow(): 이번 달 들어온 크레딧 합 */
export function bcMonthInflow(): number {
  const b = bcInit();
  const from = cycleFrom(b);
  return b.ledger.filter((e) => e.at >= from && e.amt > 0).reduce((a, e) => a + e.amt, 0);
}
/** bcMonthVol(): 이번 달 거래량 충전 */
export function bcMonthVol(): number {
  const b = bcInit();
  const from = cycleFrom(b);
  return b.ledger.filter((e) => e.at >= from && e.reason === 'volume' && e.amt > 0).reduce((a, e) => a + e.amt, 0);
}
/** bcMonthSpend(): 이번 달 차감 합 (양수) */
export function bcMonthSpend(): number {
  const b = bcInit();
  const from = cycleFrom(b);
  return -b.ledger.filter((e) => e.at >= from && e.amt < 0 && e.type === 'debit').reduce((a, e) => a + e.amt, 0);
}

/** bcEnsureWelcome(): 웰컴 크레딧 한 번 */
export function bcEnsureWelcome(): boolean {
  if (!S.user) return false;
  const cfg = bcCfg();
  const ok = bcAppend('grant', 'welcome', cfg.WELCOME_CREDIT || 0, null, 'welcome');
  if (ok) {
    bcEvent('welcome', { amt: cfg.WELCOME_CREDIT });
    bcAfterChange('welcome');
  }
  return ok;
}
/** bcVolumeCharge(fid,ex,market,notional): 거래량 충전은 UID 연동 등급만. 돌려주는 값은 충전한 크레딧 */
export function bcVolumeCharge(fid: string, ex: string, market: 'spot' | 'futures' | null | undefined, notional: number): number {
  if (!tfNFInit().uidLinked) return 0;
  const cfg = bcCfg();
  const tbl = cfg.VOLUME_TO_CREDIT_RATE || {};
  const row = tbl[ex];
  const rate = (row && row[market || 'spot']) || (tbl.binance && tbl.binance.spot) || 0;
  let credit = Math.round(notional * rate);
  if (credit <= 0) return 0;
  /* 상한은 이번 달 거래량 충전 누계 기준 */
  const used = bcMonthVol();
  const cap = cfg.UID_CREDIT_CAP || Infinity;
  let expire = 0;
  if (used + credit > cap) {
    expire = used + credit - cap;
    credit = Math.max(0, cap - used);
  }
  if (credit > 0) {
    if (!bcAppend('charge', 'volume', credit, fid, 'vol:' + fid)) return 0;
    if (expire > 0) bcEvent('cap-expire', { fid, expired: expire });
    bcAfterChange('volume'); /* 관망 복구도 여기서 */
  } else if (expire > 0 && bcAppend('charge', 'volume', 0, fid, 'vol:' + fid)) {
    bcEvent('cap-expire', { fid, expired: expire });
  }
  return credit;
}
/** bcAiDebit(reqId): 자유형 AI 사용 차감. 0 아래로 내려가지 않는다 */
export function bcAiDebit(reqId: string) {
  const cfg = bcCfg();
  const cost = cfg.AI_CALL_COST || 0;
  const bal = bcBalance();
  const amt = Math.min(cost, Math.max(0, bal));
  if (amt > 0) {
    if (!bcAppend('debit', 'ai', -amt, reqId, 'ai:' + reqId)) return;
  } else if (!bcAppend('debit', 'ai', 0, reqId, 'ai:' + reqId)) return;
  bcAfterChange('ai');
}
/** bcPromoCardUid(): 카드 등록과 UID 연동을 다 갖추면 한 번 */
export function bcPromoCardUid(): boolean {
  if (bcTier() !== 'CARD_UID') return false;
  const cfg = bcCfg();
  const ok = bcAppend('grant', 'promo', cfg.PROMO_AI_CREDIT_USD || 0, 'usd100', 'promo-carduid');
  if (ok) {
    bcEvent('promo-carduid', { amt: cfg.PROMO_AI_CREDIT_USD });
    bcAfterChange('promo');
  }
  return ok;
}
/** bcWarnBase(): 경고선의 바탕 = max(이번 달 총 유입, 웰컴) */
export function bcWarnBase(): number {
  const cfg = bcCfg();
  return Math.max(bcMonthInflow(), cfg.WELCOME_CREDIT || 1);
}
/** bcAfterChange(src): 경고선 판정과 모드 넘기기. 원본은 끝에 aiBar() 로 입력창 위 띠를 다시 그리는데, 여기는 tfSave() 의 알림으로 화면이 다시 그린다 */
export function bcAfterChange(src: string) {
  const b = bcInit();
  const cfg = bcCfg();
  const bal = bcBalance();
  const warnAt = bcWarnBase() * (cfg.THRESHOLD_WARN != null ? cfg.THRESHOLD_WARN : 0.2);
  const inflow = src !== 'ai'; /* 차감 말고는 다 들어오는 쪽 */
  if (b.mode === 'watch' && inflow && bal > 0) {
    /* 충전, 연동, 결제 즉시 다시 켠다. 잔액이 경고선 아래면 아래에서 grace 로 다시 들어간다 */
    b.mode = 'active';
    b.graceAt = null;
    bcEvent('recover', { from: 'watch', src, bal });
    bcRoute('recover');
  } else if (b.mode === 'grace' && bal > warnAt) {
    b.mode = 'active';
    b.graceAt = null;
    bcEvent('recover', { from: 'grace', src, bal });
    bcRoute('recover');
  }
  if (b.mode === 'active' && bal <= warnAt) {
    b.mode = 'grace';
    b.graceAt = Date.now(); /* 다시 들어와도 유예는 새로 */
    bcEvent('warn', { bal, warnAt: Math.round(warnAt), tier: bcTier(), src });
    bcRoute('warn');
  }
  bcTick();
  tfSave();
}
/** bcTick(): 시간이 지난 것을 본다. 경고 뒤 유예 시간이 지나고 잔량이 0 이하면 관망 */
export function bcTick() {
  const b = bcInit();
  const cfg = bcCfg();
  const bal = bcBalance();
  if (b.mode === 'grace' && bal <= (cfg.THRESHOLD_STOP || 0) && b.graceAt && Date.now() - b.graceAt >= (cfg.GRACE_HOURS || 24) * 36e5) {
    b.mode = 'watch';
    bcEvent('watch-enter', { bal, tier: bcTier() });
    bcRoute('watch');
    tfSave();
  }
}
/** bcBranch(): 크레딧이 떨어졌을 때 어느 안내로 보낼지 */
export function bcBranch(): BcBranchK {
  const tier = bcTier();
  const cfg = bcCfg();
  if (tier === 'FREE') return 'free.out';
  if (tier === 'CARD') return 'card.out';
  const v = bcMonthVol();
  const u = bcMonthSpend();
  if (v <= 0) return 'uid.novol'; /* 거래량 0 은 CARD_UID 도 같다 */
  if (tier === 'CARD_UID') return 'carduid.out';
  if (u >= (cfg.CARD_CREDIT_MONTHLY || 3000) * 0.5) return 'uid.heavy';
  return 'uid.small';
}
/** bcRoute(trigger): 안내 알림을 만든다 (하루에 한 번) */
export function bcRoute(trigger: string) {
  const day = Math.floor(Date.now() / 864e5);
  if (trigger === 'recover') {
    tfNotify('bill', 'bill.recover:' + day, L('bill.recover.t'), L('bill.recover.b'), null);
    return;
  }
  if (trigger === 'watch') tfNotify('bill', 'bill.watch:' + day, L('bill.watch.t'), L('bill.watch.b'), '#/plan');
  const br = bcBranch();
  tfNotify('bill', 'bill.' + br + ':' + day, L('bill.' + br + '.t'), L('bill.' + br + '.b'), '#/plan');
  if (br === 'uid.heavy') bcEvent('rescue-offer', { day }); /* 90% 할인 제안을 보였다는 기록 */
}
/** bcCouponGrant(kind) */
export function bcCouponGrant(kind?: string): BcCoupon {
  const b = bcInit();
  const c: BcCoupon = { id: 'C' + Date.now() + Math.floor(Math.random() * 1e3), kind: kind || 'rescue90', rate: bcCfg().DISCOUNT_RESCUE || 0.9, at: Date.now(), usedAt: null };
  b.coupons.push(c);
  bcEvent('coupon-grant', { id: c.id, kind: c.kind });
  tfSave();
  return c;
}
/** bcCardOn(on): 카드를 켜면 결제일을 30일 뒤로 잡는다 */
export function bcCardOn(on: boolean): boolean {
  const b = bcInit();
  b.cardOn = !!on;
  if (on) {
    if (!b.cycleAt) b.cycleAt = Date.now() + 30 * 864e5;
    bcEvent('card-on', {});
    bcAfterChange('card');
  } else {
    bcEvent('card-off', {});
    tfSave();
  }
  return b.cardOn;
}
/** bcCardCharged(cycleKey): 월 충전 (주기 키로 한 번만) */
export function bcCardCharged(cycleKey: string): boolean {
  const cfg = bcCfg();
  if (!bcAppend('charge', 'card', cfg.CARD_CREDIT_MONTHLY || 0, cycleKey, 'card:' + cycleKey)) return false;
  bcEvent('card-charged', { cycle: cycleKey });
  if (!tfNFInit().uidLinked) tfNotify('bill', 'bill.card.cross:' + cycleKey, L('bill.card.cross.t'), L('bill.card.cross.b'), '#/plan');
  bcAfterChange('card');
  return true;
}
/** bcBillQuote(): 이번 결제 견적. 거래량 충전만큼 상쇄하고, 낼 돈이 있을 때만 쿠폰을 쓴다 */
export function bcBillQuote(): BcQuote {
  const cfg = bcCfg();
  const offset = Math.min(1, bcMonthVol() / (cfg.CARD_CREDIT_MONTHLY || 1));
  const gross = cfg.CARD_PLAN_PRICE_USD || 0;
  let net = Math.max(0, gross * (1 - offset));
  const b = bcInit();
  let cp: BcCoupon | null = null;
  if (net > 0) {
    for (let i2 = 0; i2 < b.coupons.length; i2++) {
      if (!b.coupons[i2].usedAt) {
        cp = b.coupons[i2];
        break;
      }
    }
    if (cp) net = Math.max(0, net * (1 - (cp.rate || 0)));
  }
  return { gross, offset, net: Math.round(net * 100) / 100, coupon: cp ? cp.id : null };
}
/** bcPayAttempt(q): 시험용 스위치(simPayFail)가 켜져 있으면 결제가 실패한다 */
export function bcPayAttempt(_q?: BcQuote): boolean {
  return !bcInit().simPayFail;
}
/** bcCycleReset(cycleKey): 카드 충전분 가운데 쓰지 않고 남은 것을 비운다. 돌려주는 값은 비운 양 */
export function bcCycleReset(cycleKey: string): number {
  const b = bcInit();
  const from = cycleFrom(b);
  const cardIn = b.ledger.filter((e) => e.at >= from && e.reason === 'card' && e.amt > 0).reduce((a, e) => a + e.amt, 0);
  if (cardIn <= 0) return 0;
  const spend = bcMonthSpend();
  const vol = bcMonthVol();
  const cardUsed = Math.max(0, spend - vol);
  const remain = Math.min(bcBalance(), Math.max(0, cardIn - cardUsed));
  if (remain > 0 && bcAppend('reset', 'cycle', -remain, cycleKey, 'reset:' + cycleKey)) bcEvent('cycle-reset', { cycle: cycleKey, expired: remain });
  return remain;
}
/** bcCycleTick(): 결제일이 지났으면 한 주기를 처리한다. 처리했으면 true */
export function bcCycleTick(): boolean {
  const cfg = bcCfg();
  const b = bcInit();
  if (!b.cardOn || !b.cycleAt || Date.now() < b.cycleAt) return false;
  const cycleKey = 'cy' + b.cycleAt;
  const q = bcBillQuote();
  if (bcPayAttempt(q)) {
    bcEvent('card-bill', { cycle: cycleKey, gross: q.gross, offset: Math.round(q.offset * 100) / 100, net: q.net, coupon: q.coupon });
    if (q.coupon) {
      b.coupons.forEach((c2) => {
        if (c2.id === q.coupon) c2.usedAt = Date.now();
      });
      bcEvent('coupon-use', { id: q.coupon });
    }
    bcCycleReset(cycleKey);
    b.cycleAt = b.cycleAt + 30 * 864e5;
    b.cardFails = 0;
    bcCardCharged(cycleKey); /* 새 주기 충전, 연동 권유, 다시 켜기 */
    return true;
  }
  b.cardFails = (b.cardFails || 0) + 1;
  bcEvent('pay-fail', { cycle: cycleKey, tries: b.cardFails });
  if (b.cardFails >= (cfg.DUNNING_RETRY_MAX || 3) && b.mode !== 'watch') {
    b.mode = 'watch';
    b.graceAt = null; /* 결제가 안 돼 관망 */
    bcEvent('watch-enter', { reason: 'dunning', tries: b.cardFails });
    tfNotify('bill', 'bill.dunning:' + Math.floor(Date.now() / 864e5), L('bill.dunning.t'), L('bill.dunning.b'), '#/plan');
    bcRoute('watch');
  }
  tfSave();
  return false;
}
/** bcReconcile(): 하루 한 번 원장을 다시 맞춘다. 고친 합을 돌려주고, 오늘 이미 했으면 null */
export function bcReconcile(): number | null {
  const b = bcInit();
  const day = Math.floor(Date.now() / 864e5);
  if (b.seen['recon:' + day]) return null;
  b.seen['recon:' + day] = Date.now();
  let fixed = 0;
  /* 같은 fid 로 두 번 넘게 충전됐으면 넘친 만큼 고친다 */
  const byFid: Record<string, BcEntry[]> = {};
  b.ledger.forEach((e) => {
    if (e.reason === 'volume' && e.ref) (byFid[e.ref] = byFid[e.ref] || []).push(e);
  });
  Object.keys(byFid).forEach((f) => {
    const arr = byFid[f];
    if (arr.length > 1) {
      const dup = arr.slice(1).reduce((a, e) => a + (e.amt || 0), 0);
      if (dup !== 0 && bcAppend('adjust', 'recon-dupfid', -dup, f, 'adj:' + f)) fixed += -dup;
    }
  });
  /* 잔액이 0 아래면 고친다 */
  const bal = bcBalance();
  if (bal < 0 && bcAppend('adjust', 'recon-negbal', -bal, null, 'adjneg:' + day)) fixed += -bal;
  bcEvent('recon', { day, fixed, bal: bcBalance() });
  tfSave();
  return fixed;
}
/** bcBoot(): 로그인했을 때와 회원으로 다시 열 때 한 번 (원본 authSyncUI). 웰컴, 유예, 밀린 월 주기, 하루 맞춤을 한꺼번에 */
export function bcBoot() {
  if (!S.user) return;
  bcEnsureWelcome();
  bcTick();
  let guard = 0;
  while (bcCycleTick() && ++guard < 24) {
    /* 오래 안 들어온 동안 밀린 주기를 이어서 처리한다 */
  }
  bcReconcile();
}
