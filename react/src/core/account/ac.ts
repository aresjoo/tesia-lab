// 실행 환경 활성화(ac)의 상태 규칙. 원본 「실행 환경 활성화 (ac)」 구역의 화면 없는 부분.
// 한 가지 상태 모델을 거래소 연결 화면, 설정, 백테스트 뒤 실행 준비, AI 트레이딩 시작이 함께 쓴다.
import { TF_BROKERS, type Broker } from './brokers.data';
import { TFC } from './tfc.data';
import { S, tfS, tfSave, type Ac, type AcBill, type AcCard, type AcRoute } from './tf';

/** AC_CFG: 가격, 혜택, 지원 거래소는 여기 한곳 */
export const AC_CFG = {
  price: 280,
  cur: 'USD',
  /* TETH 초대로 가입한 계정의 거래 수수료 환급(%) */
  benefit: { binance: 20, okx: 20, bybit: 20, mexc: 20, bitget: 20, woox: 50, gate: 50 } as Record<string, number>,
  order: ['bitget', 'binance', 'okx', 'bybit', 'mexc', 'woox', 'gate'],
};
/** AC_PAID_MAX: 구독 하나로 연결할 수 있는 거래소 수 */
export const AC_PAID_MAX = 2;
/** AC_EXTRA */
export const AC_EXTRA: Record<string, Broker> = { gate: { id: 'gate', name: 'Gate', site: 'gate.com', conn: true, mono: 'G' } };

/** 흐름이 들고 다니는 문맥 (원본 AC_CTX): ex 고른 거래소, need 전략이 요구하는 거래소, name 전략 이름, after 끝난 뒤 할 일 */
export type AcAfter = { kind: 'terminal' | 'copy' | 'bt'; id?: string } | null | undefined;
export type AcBt = { name: string; ex: string; per: string; amt: string; ret: number; bench: number; mdd: number; n: number; eq: number[] };
export type AcCtx = { ex?: string | null; need?: string | null; name?: string | null; after?: AcAfter; bt?: AcBt | null; route?: AcRoute | null; page?: number; sheet?: number; list?: number };

/** 시험용 스위치 (원본 window.AC_QA): pay, auth, uid, kyc 를 'fail' 등으로 두면 그 단계가 실패한다 */
export const AC_QA: { pay?: string; auth?: string; uid?: string; kyc?: string } = {};
if (typeof window !== 'undefined') (window as unknown as { AC_QA: typeof AC_QA }).AC_QA = AC_QA;

/** acS() */
export function acS(): Ac {
  const t = tfS();
  if (!t.ac) t.ac = { route: null, ex: null, has: null, g: 0, pay: { st: 'none' }, auth: { st: 'idle' }, uid: { st: 'none' }, kyc: { st: 'none' }, conn: {}, cards: [], bill: [], sub: null };
  const a = t.ac;
  a.conn = a.conn || {};
  a.pay = a.pay || { st: 'none' };
  a.auth = a.auth || { st: 'idle' };
  a.uid = a.uid || { st: 'none' };
  a.kyc = a.kyc || { st: 'none' };
  a.cards = a.cards || [];
  a.bill = a.bill || [];
  /* 예전 방식으로 연결해 둔 계정을 옮겨 온다 */
  if (t.api && t.api.ex && !a.conn[t.api.ex]) a.conn[t.api.ex] = { via: t.uidLinked ? 'partner' : t.payDone ? 'paid' : 'partner', at: Date.now(), uid: t.uid || '' };
  return a;
}
/** acSave() */
export const acSave = () => tfSave();

/** acExs(): 지원하는 거래소만, 정한 순서로 */
export function acExs(): Broker[] {
  const o: Broker[] = [];
  AC_CFG.order.forEach((id) => {
    let f = false;
    for (const b of TF_BROKERS)
      if (b.id === id && b.conn) {
        o.push(b);
        f = true;
      }
    if (!f && AC_EXTRA[id]) o.push(AC_EXTRA[id]);
  });
  return o;
}
/** acEx(id) */
export function acEx(id: string | null | undefined): Broker | null {
  if (!id) return null;
  return acExs().find((b) => b.id === id) || null;
}
/** acName(id) */
export const acName = (id: string | null | undefined) => {
  const b = acEx(id);
  return b ? b.name : id || '';
};
/** acRef(id): TETH 초대 가입 주소 */
export function acRef(id: string | null | undefined): string {
  for (const e of TFC.exchanges as readonly { id: string; ref?: string }[]) if (e.id === id && e.ref) return e.ref;
  const b = acEx(id);
  return 'https://' + (b && b.site ? b.site : 'bitget.com');
}
/** acSubOn() */
export function acSubOn(): boolean {
  const a = acS();
  return !!(a.sub && a.sub.st === 'active') || (!!tfS().payDone && !(a.sub && a.sub.st === 'cancelled' && (a.sub.until || 0) < Date.now()));
}
/** acAccess() */
export function acAccess(): 'paid' | 'partner' | 'none' {
  const a = acS();
  if (acSubOn()) return 'paid';
  for (const k in a.conn) if (a.conn[k].via === 'partner') return 'partner';
  return 'none';
}
/** acConnList() */
export function acConnList(): string[] {
  const a = acS();
  const o: string[] = [];
  for (const k in a.conn) if (acEx(k)) o.push(k);
  return o;
}
/** acUsd(n) */
export const acUsd = (n: number) => '$' + Number(n).toLocaleString();
/** acConnOk(k) */
export function acConnOk(k: string): boolean {
  const c = acS().conn[k];
  return !!c && !!acEx(k) && (c.via === 'partner' || acSubOn());
}
/** acAuthOk(ex): 이미 연결해 둔 거래소는 승인을 다시 받지 않는다 */
export function acAuthOk(ex: string | null): boolean {
  const a = acS();
  return (a.auth.st === 'ok' && a.auth.ex === ex) || !!(ex && a.conn[ex]);
}
/** acPaidCount() */
export function acPaidCount(): number {
  const a = acS();
  let n = 0;
  for (const k in a.conn) if (a.conn[k].via === 'paid' && acEx(k)) n++;
  return n;
}
/** acPaidFull(): 구독 하나로 거래소 7곳 전부 연결한다. 한도 화면은 쓰지 않는다 (원본 px 구역이 false 로 덮었다) */
export const acPaidFull = () => false;
/** acKycOk(ex) */
export function acKycOk(ex: string): boolean {
  const a = acS();
  return a.kyc.st === 'ok' && a.kyc.ex === ex;
}
/** acReady(ex) */
export const acReady = (ex?: string | null) => (ex ? acConnOk(ex) : acConnList().some(acConnOk));
/** acRunOk(ex) */
export function acRunOk(ex: string): boolean {
  const a = acS();
  return !!(a.conn[ex] && a.conn[ex].kyc === 'ok');
}

export type AcStepK = 'done' | 'route' | 'pay' | 'ex' | 'limit' | 'auth' | 'acct' | 'guide' | 'uid' | 'commit';
/** acRouteNow() */
export function acRouteNow(): AcRoute | null {
  const a = acS();
  if (a.route === 'partner' && acSubOn() && a.ex && !a.conn[a.ex]) return 'partner'; /* 구독 회원이 한도 뒤 초대 계정으로 고른 경우 */
  return acSubOn() ? 'paid' : a.route || (acAccess() === 'partner' ? 'partner' : null);
}
/** acStep(): 지금 해야 할 한 가지 */
export function acStep(): AcStepK {
  const a = acS();
  const ex = a.ex;
  if (ex && acConnOk(ex)) return 'done';
  if (a.edit) return a.edit as AcStepK;
  const r = acRouteNow();
  if (!r) return 'route';
  if (r === 'paid') {
    if (!acSubOn() || a.more) return 'pay';
    if (!ex) return 'ex';
    if (!a.conn[ex] && acPaidFull()) return 'limit';
    if (!acAuthOk(ex)) return 'auth';
  } else {
    if (!ex) return 'ex';
    if (!a.has) return 'acct';
    if (a.has === 'no' && a.g < 2) return 'guide';
    if (!acAuthOk(ex)) return 'auth';
    if (a.uid.st !== 'ok' || a.uid.ex !== ex) return 'uid';
  }
  return 'commit';
}
/** acCommit(): 연결을 마친다. "더 연결하기" 상태도 푼다 */
export function acCommit() {
  const a = acS();
  const t = tfS();
  const ex = a.ex;
  const r = acRouteNow();
  if (!ex) return;
  a.conn[ex] = { via: r === 'paid' ? 'paid' : 'partner', at: Date.now(), uid: a.uid.ex === ex ? a.uid.v || '' : '', kyc: 'none' };
  t.api = { ex, last4: null, oauth: true };
  t.conn = true;
  if (a.conn[ex].via === 'partner') {
    t.uidLinked = true;
    t.uid = a.conn[ex].uid || '';
  }
  t.ob = { st: 'completed', ex, uid: a.conn[ex].uid || '', err: null };
  a.doneAt = Date.now();
  a.edit = null;
  if (a.adding) a.adding = 0;
  acSave();
}
/** pxCur(): 지금 단계. 다 갖췄으면 연결을 마치고 done */
export function pxCur(): AcStepK {
  let c = acStep();
  if (c === 'commit') {
    acCommit();
    c = 'done';
  }
  return c;
}

/** acOpen(ctx): 흐름에 들어설 때 고른 것을 정리한다 */
export function acOpen(ctx: AcCtx) {
  const a = acS();
  a.edit = null;
  a.routeSel = null;
  a.exSel = null;
  const want = ctx.need || ctx.ex || null;
  if (want && acEx(want) && a.ex !== want) {
    a.ex = want;
    a.has = null;
    a.g = 0;
    a.auth = { st: 'idle' };
    a.uid = { st: 'none' };
  }
  if (want && acEx(want)) a.doneAt = a.conn[want] ? a.doneAt : null;
  acSave();
}

/* ── 고르고 넘어가기 ── */
/** acExGo() (pxPickEx 가 a.exSel 을 넣고 부른다) */
export function acExGo(ctx: AcCtx | null, pick?: string) {
  const a = acS();
  if (pick) a.exSel = pick;
  const id = a.exSel || a.ex || (ctx && ctx.ex);
  if (!id) return;
  if (a.ex !== id) {
    a.has = null;
    a.g = 0;
    a.auth = { st: 'idle' };
    a.uid = { st: 'none' };
    a.kyc = { st: 'none' };
    a.doneAt = null;
  }
  a.ex = id;
  a.exSel = null;
  a.edit = null;
  acSave();
}
/** acHas(v) */
export function acHas(v: 'yes' | 'no') {
  const a = acS();
  a.has = v;
  a.g = 0;
  a.edit = null;
  acSave();
}
/** acGuideOpen(): 가입 화면을 열었다 */
export function acGuideOpen() {
  const a = acS();
  a.joined = 1;
  if (!a.has) a.has = 'no';
  acSave();
}
/** acGuide(n) */
export function acGuide(n: number) {
  const a = acS();
  a.g = n;
  if (n >= 1) a.joined = 1;
  if (!a.has) a.has = 'no';
  acSave();
}
/** acLimitAlt(k) */
export function acLimitAlt(k: 'partner' | 'more' | 'ex') {
  const a = acS();
  if (k === 'partner') {
    a.route = 'partner';
    a.has = null;
    a.g = 0;
    a.uid = { st: 'none' };
    a.kyc = { st: 'none' };
  } else if (k === 'more') {
    a.more = 1;
    a.pay = { st: 'none' };
    a.newCard = 0;
  } else a.ex = null;
  acSave();
}
/** acUidAlt(k) */
export function acUidAlt(k: 'new' | 'paid' | 'ex') {
  const a = acS();
  if (k === 'new') {
    a.has = 'no';
    a.g = 0;
    a.auth = { st: 'idle' };
    a.uid = { st: 'none' };
  } else if (k === 'paid') {
    a.route = 'paid';
    a.uid = { st: 'none' };
  } else {
    a.ex = null;
    a.has = null;
    a.auth = { st: 'idle' };
    a.uid = { st: 'none' };
  }
  acSave();
}
/** pxInviteRoute(): 구독 회원이 이 거래소만 TETH 초대 계정으로 */
export function pxInviteRoute() {
  const a = acS();
  a.route = 'partner';
  a.has = null;
  a.g = 0;
  a.auth = { st: 'idle' };
  a.uid = { st: 'none' };
  acSave();
}
/** pxSubRoute() */
export function pxSubRoute() {
  const a = acS();
  a.route = 'paid';
  a.has = null;
  a.g = 0;
  acSave();
}

/* ── 결제 ── */
export type CardIn = { n: string; last4: string; brand: string; exp: string; name: string };
export type CardErr = { field: 'cn' | 'ce' | 'cc' | 'ch'; msg: string };
/** acCardFmt(e) 의 글자 규칙 */
export const acCardFmt = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
/** acExpFmt(e) 의 글자 규칙 */
export const acExpFmt = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : d;
};
/** acCardRead(p): 입력을 읽어 카드나 첫 오류를 돌려준다 */
export function acCardRead(v: { cn: string; ce: string; cc: string; ch: string }): CardIn | CardErr {
  const n = v.cn.replace(/\D/g, '');
  const x = v.ce.replace(/\D/g, '');
  const c = v.cc.replace(/\D/g, '');
  const h = v.ch.trim();
  if (n.length < 15) return { field: 'cn', msg: '카드 번호를 끝까지 입력해 주십시오' };
  const mm = +x.slice(0, 2);
  if (x.length < 4 || mm < 1 || mm > 12) return { field: 'ce', msg: '유효기간을 월과 연도 순서로 입력해 주십시오' };
  if (c.length < 3) return { field: 'cc', msg: '보안 코드 3자리를 입력해 주십시오' };
  if (!h) return { field: 'ch', msg: '카드에 적힌 이름을 입력해 주십시오' };
  return { n, last4: n.slice(-4), brand: n.charAt(0) === '4' ? 'Visa' : n.charAt(0) === '5' ? 'Mastercard' : n.charAt(0) === '3' ? 'Amex' : '카드', exp: x.slice(0, 2) + '/' + x.slice(2), name: h };
}
/** acCharge(card): 0000 으로 시작하는 카드는 승인되지 않는다(데모) */
export const acCharge = (card: { n: string }) => !(card.n.slice(0, 4) === '0000' || AC_QA.pay === 'fail');
/** acBillAdd(st, card, amt, label) */
export function acBillAdd(st: string, card: { last4?: string; brand?: string } | null, amt: number, label?: string) {
  const row: AcBill = { id: 'T' + Date.now().toString(36).toUpperCase(), at: Date.now(), label: label || 'TETH 구독', amt, st, last4: card ? card.last4 || '' : '', brand: card ? card.brand || '' : '' };
  acS().bill.unshift(row);
}
/** 저장한 카드 가운데 기본 카드 */
export const acSavedCard = (): AcCard | undefined => {
  const a = acS();
  return a.cards.filter((c) => c.def)[0] || a.cards[0];
};
/** plPaid(card): 결제가 끝났다 */
export function plPaid(card: { last4?: string; brand?: string; name?: string }) {
  const a = acS();
  const t = tfS();
  a.pay = { st: 'ok', at: Date.now() };
  const nS = a.more && a.sub && a.sub.st === 'active' ? (a.sub.n || 1) + 1 : 1;
  a.more = 0;
  a.sub = { st: 'active', since: (a.sub && a.sub.since) || Date.now(), next: Date.now() + 30 * 864e5, price: AC_CFG.price, n: nS };
  t.payDone = true;
  t.cardOn = true;
  t.plan = 'paid';
  acBillAdd('paid', card, AC_CFG.price);
  if (!a.billTo) a.billTo = { email: (S.user && S.user.email) || '', name: card.name || '', addr: '' };
  acSave();
}
/** 결제 실패를 적는다 (plPay, plPaySaved, plApple 의 실패 갈래) */
export function plPayFail(card: { last4?: string; brand?: string }) {
  const a = acS();
  a.pay = { st: 'fail', at: Date.now() };
  acBillAdd('failed', card, AC_CFG.price);
  acSave();
}
/** 새 카드를 기본 카드로 저장한다 */
export function acCardKeep(c: CardIn | { last4: string; brand: string; exp: string; name: string }, idPrefix = 'c'): AcCard {
  const a = acS();
  const card: AcCard = { id: idPrefix + Date.now().toString(36), last4: c.last4, brand: c.brand, exp: c.exp, name: c.name, def: true };
  a.cards.forEach((x) => {
    x.def = false;
  });
  a.cards.unshift(card);
  return card;
}

/** acDisc(k) 의 실행부: 연결을 끊는다. 예전 방식 연결 기록(t.api)을 먼저 지운다 */
export function acDiscRun(k: string) {
  const t = tfS();
  if (t.api && t.api.ex === k) {
    t.api = null;
    t.conn = false;
    t.uidLinked = false;
  }
  const a = acS();
  delete a.conn[k];
  if (a.ex === k) {
    a.ex = null;
    a.auth = { st: 'idle' };
    a.uid = { st: 'none' };
    a.doneAt = null;
  }
  const L = Object.keys(a.conn).filter((x) => !!acEx(x));
  if (L.length) {
    t.api = { ex: L[0], last4: null, oauth: true };
    t.conn = true;
  } else {
    t.api = null;
    t.conn = false;
    t.uidLinked = false;
  }
  acSave();
}

/** plRebate(): 환급 문구 */
export function plRebate(): string {
  const B = AC_CFG.benefit;
  const g20: string[] = [];
  const g50: string[] = [];
  acExs().forEach((b) => {
    (B[b.id] >= 50 ? g50 : g20).push(b.name);
  });
  return g20.join(', ') + '는 거래 수수료의 20%, ' + g50.join('과 ') + '는 50%를 환급합니다.';
}

/* ── 하려던 일 하나를 기억한다 (tfIntentSet, tfIntentPeek, tfIntentClear). 인증이 끝나면 한 번만 꺼낸다 ── */
export type Intent = { kind: string; at?: number; [k: string]: unknown };
let INTENT: Intent | null = null;
export function tfIntentSet(o: Intent) {
  o.at = Date.now();
  INTENT = o;
  try {
    sessionStorage.setItem('teth.intent', JSON.stringify(o));
  } catch {
    /* 무시 */
  }
}
export function tfIntentPeek(): Intent | null {
  let o = INTENT;
  if (!o) {
    try {
      o = JSON.parse(sessionStorage.getItem('teth.intent') || 'null');
    } catch {
      /* 무시 */
    }
  }
  return o && Date.now() - (o.at || 0) < 1800000 ? o : null;
}
export function tfIntentClear() {
  INTENT = null;
  try {
    sessionStorage.removeItem('teth.intent');
  } catch {
    /* 무시 */
  }
}
