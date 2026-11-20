// 거래소 연결 화면의 흐름: 플랜 화면(pl), 플랜 구성(결제), 플랜 뒤 화면(px)을 오가는 동작과 기다림(타이머).
// 상태 규칙은 core/account/ac.ts 에 있고, 여기는 원본의 「어느 화면을 그릴지」와 setTimeout 연출을 옮긴 곳이다.
import {
  AC_CFG,
  AC_QA,
  acAccess,
  acCardKeep,
  acCardRead,
  acCharge,
  acConnList,
  acConnOk,
  acDiscRun,
  acEx,
  acExGo,
  acGuide,
  acGuideOpen,
  acHas,
  acLimitAlt,
  acName,
  acOpen,
  acReady,
  acRouteNow,
  acS,
  acSave,
  acSavedCard,
  acStep,
  acSubOn,
  acUidAlt,
  plPaid,
  plPayFail,
  pxCur,
  pxInviteRoute,
  pxSubRoute,
  tfIntentSet,
  type AcAfter,
  type AcCtx,
  type CardErr,
} from '../../../core/account/ac';
import { mkHash, S, tfBump, type AcRoute } from '../../../core/account/tf';
import { nav } from '../../../state/route';
import { authOpen, getState, toast } from '../../../state/store';
import { acConfirm } from '../confirm';
import { followOpen } from '../../share/copyActions';

/** 지금 그릴 화면. view: plan=플랜 두 카드(plView), checkout=플랜 구성(plCheckout), page=플랜 뒤 화면(acPageView) */
export const PL: {
  view: 'plan' | 'checkout' | 'page';
  /** 원본 PL.ctx 와 AC_CTX */
  ctx: AcCtx;
  /** 연결된 거래소 목록을 보일지 (원본 AC_CTX.list) */
  list: boolean;
  /** gContent 를 부른 횟수: 바뀌면 맨 위로 올린다 */
  seq: number;
  /** acStart 가 화면을 정해 두고 #/brokers 로 들어온 때: 화면이 뜨면서 다시 정하지 않는다 */
  entered: boolean;
} = { view: 'plan', ctx: {}, list: false, seq: 0, entered: false };

/** 기다리는 중인 것과 입력 오류 (원본은 DOM 을 바로 고쳤다) */
export const UI: {
  /** 단추가 돌고 있는 일: pay=결제 승인 중, apple=Apple Pay 승인 중, auth=승인 중 */
  busy: null | 'pay' | 'apple' | 'auth';
  /** 승인 창(#ac-auth) 열림 */
  auth: boolean;
  /** 초대 계정 확인 두 줄의 진행: 0 계정 확인 중, 1 초대 계정 확인 중 */
  uidPhase: 0 | 1;
  /** 카드 입력 */
  card: { cn: string; ce: string; cc: string; ch: string; save: boolean };
  err: Partial<Record<CardErr['field'], string>>;
  /** 오류가 난 칸에 초점을 줄 때마다 는다 */
  focus: { field: CardErr['field'] | null; n: number };
} = { busy: null, auth: false, uidPhase: 0, card: { cn: '', ce: '', cc: '', ch: '', save: true }, err: {}, focus: { field: null, n: 0 } };

let AC_RUN = 0;
const onBrokers = () => /^#\/brokers(\/|$)/.test(window.location.hash);

/** acRe(): 흐름을 다시 그린다. 기다리던 일은 버린다 */
export function acRe() {
  AC_RUN++;
  UI.busy = null;
  UI.uidPhase = 0;
  pxCur(); /* 다 갖췄으면 여기서 연결을 마친다 (원본은 그리는 중에 acCommit) */
  tfBump();
}
function show(view: typeof PL.view) {
  PL.view = view;
  PL.seq++;
  UI.busy = null;
  UI.uidPhase = 0;
  tfBump();
}

/** plView(ctx): 플랜 화면 */
export function plView(ctx?: AcCtx) {
  PL.ctx = ctx || {};
  PL.list = false;
  show('plan');
}
/** plCheckout(ctx): 플랜 구성(구독 결제) */
export function plCheckout(ctx?: AcCtx, keepCard = false) {
  PL.ctx = ctx || PL.ctx || {};
  const a = acS();
  const fixed = PL.ctx.need && acEx(PL.ctx.need) ? PL.ctx.need : null;
  if (!fixed) a.exSel = a.exSel || a.ex || AC_CFG.order[0];
  if (!keepCard) {
    UI.card = { cn: '', ce: '', cc: '', ch: '', save: true };
    UI.err = {};
  }
  show('checkout');
}
/** acPageView(ex): 거래소 연결 화면. 검정 바탕 한 열 */
export function acPageView(ex?: string | null) {
  if (!S.user) {
    plView({ ex: ex || null });
    return;
  }
  const a = acS();
  if (!acRouteNow() && !acConnList().length) {
    plView({ ex: ex || null });
    return;
  }
  PL.ctx = { ex: ex || null, page: 1 };
  acOpen(PL.ctx);
  const L = acConnList();
  const OK = L.filter(acConnOk);
  /* 구독이 끝난 계정만 남았으면 그 거래소로 다시 이어 간다 */
  if (!ex && L.length && !OK.length && !a.adding) {
    a.ex = L[0];
    a.route = 'paid';
    a.pay = a.pay.st === 'fail' ? a.pay : { st: 'none' };
    acSave();
  }
  /* 하다 만 다른 거래소 연결은 이 화면을 다시 열 때 들고 오지 않는다 */
  if (!ex && L.length && a.ex && !a.conn[a.ex] && !a.adding) {
    a.ex = null;
    a.has = null;
    a.auth = { st: 'idle' };
    a.uid = { st: 'none' };
    acSave();
  }
  /* "거래소 더 연결하기"를 누른 뒤(adding)에는 목록이 아니라 거래소 선택으로 */
  PL.list = !!(OK.length && !a.adding && (!a.ex || acConnOk(a.ex)));
  PL.ctx.list = PL.list ? 1 : 0;
  pxCur();
  show('page');
  if (acStep() === 'uid') acUidRun();
}
/** acSheetOpen(ctx): 활성화 창 대신 같은 화면 */
function acSheetOpen(ctx: AcCtx) {
  ctx.sheet = 0;
  acOpen(ctx);
  PL.ctx = ctx;
  ctx.page = 1;
  PL.list = false;
  pxCur();
  show('page');
  if (acStep() === 'uid') acUidRun();
}
/** acStart(ctx): 들어오는 길. 필요한 것이 이미 다 있으면 화면을 띄우지 않고 그대로 이어 간다. 이용 자격이 없으면 플랜 화면 */
export function acStart(ctx?: AcCtx) {
  ctx = ctx || {};
  const go = () => {
    PL.entered = true;
    if (!onBrokers()) nav('#/brokers');
  };
  if (ctx.route && S.user) {
    acS().route = ctx.route;
    acSave();
  }
  if (!S.user) {
    plView(ctx);
    go();
    return;
  }
  if (acReady(ctx.need || ctx.ex || null)) {
    acAfter(ctx.after);
    return;
  }
  if (!acRouteNow()) {
    plView(ctx);
    go();
    return;
  }
  if (ctx.route === 'paid' && !acSubOn()) {
    plCheckout(ctx);
    go();
    return;
  }
  acSheetOpen(ctx);
  go();
}
/** acAfter(af): 끝난 뒤 할 일 */
export function acAfter(af: AcAfter) {
  if (!af || af.kind === 'terminal') {
    nav('#/trade');
    return;
  }
  if (af.kind === 'copy') {
    /* 원본처럼 그 자리에서 복사 설정 창(mkFollowSheet)을 연다 */
    followOpen(af.id || '');
    return;
  }
  if (af.kind === 'bt') {
    nav('#/share/bt/' + af.id + '/go');
    return;
  }
  nav('#/trade');
}
/** acGoTerminal() */
export function acGoTerminal() {
  AC_RUN++;
  UI.auth = false;
  nav('#/trade');
}
/** acSheetDone(): 완료 단추. 창이든 화면이든 같은 길 */
export function acSheetDone() {
  const af = PL.ctx.after;
  PL.ctx = {};
  acAfter(af);
}

/** plPick(route): 플랜 화면에서 방식을 골랐다 */
export function plPick(route: AcRoute) {
  const ctx = PL.ctx || {};
  if (!getState().user) {
    authOpen('signup');
    tfIntentSet({ kind: 'start', route, ex: ctx.ex || null, need: ctx.need || null, name: ctx.name || null, after: ctx.after || null, bt: ctx.bt || null });
    return;
  }
  const a = acS();
  a.route = route;
  a.routeSel = null;
  a.edit = null;
  a.has = null;
  a.g = 0;
  acSave();
  if (route === 'paid' && !acSubOn()) {
    plCheckout(ctx);
    return;
  }
  acPageView(ctx.need || ctx.ex || null);
}

/* ── 플랜 구성(결제) ── */
/** acErr(id, msg) */
function cardErr(e: CardErr) {
  UI.err = { [e.field]: e.msg };
  UI.focus = { field: e.field, n: UI.focus.n + 1 };
  tfBump();
}
/** 카드 칸에 글자를 넣는다 (acCardFmt, acExpFmt 는 화면이 글자를 다듬어 넘긴다). 그 칸의 오류는 지운다 */
export function cardInput(k: 'cn' | 'ce' | 'cc' | 'ch', v: string) {
  UI.card = { ...UI.card, [k]: v };
  if (UI.err[k]) UI.err = { ...UI.err, [k]: '' };
  tfBump();
}
export function cardSave(v: boolean) {
  UI.card = { ...UI.card, save: v };
  tfBump();
}
/** plAfterPay(): 결제 뒤에는 고른 거래소로 승인 단계로 간다 */
function plAfterPay() {
  const a = acS();
  const ctx = PL.ctx || {};
  const ex = ctx.need && acEx(ctx.need) ? ctx.need : null;
  a.newCard = 0;
  a.exSel = null;
  a.ex = ex;
  if (!ex) {
    a.auth = { st: 'idle' };
    a.adding = acConnList().length ? 1 : 0;
  }
  acSave();
  acPageView(ex);
}
function paidDone(card: { last4?: string; brand?: string; name?: string }) {
  plPaid(card);
  toast('결제가 완료되었습니다');
  plAfterPay();
}
/** plPay(): 새 카드로 결제 */
export function plPay() {
  const c = acCardRead(UI.card);
  UI.err = {};
  if ('field' in c) {
    cardErr(c);
    return;
  }
  const my = ++AC_RUN;
  UI.busy = 'pay';
  tfBump();
  const save = UI.card.save;
  setTimeout(() => {
    if (my !== AC_RUN) return;
    if (!acCharge(c)) {
      plPayFail(c);
      UI.card = { ...UI.card, cc: '' }; /* 원본은 다시 그리며 번호, 유효기간, 이름만 되살린다 */
      plCheckout(undefined, true);
      return;
    }
    const card = save ? acCardKeep(c) : { id: 'c' + Date.now().toString(36), last4: c.last4, brand: c.brand, exp: c.exp, name: c.name, def: true };
    paidDone(card);
  }, 1500);
}
/** plPaySaved(): 저장한 카드로 결제 */
export function plPaySaved() {
  const sv = acSavedCard();
  if (!sv) return;
  const my = ++AC_RUN;
  UI.busy = 'pay';
  tfBump();
  setTimeout(() => {
    if (my !== AC_RUN) return;
    if (AC_QA.pay === 'fail') {
      plPayFail(sv);
      plCheckout();
      return;
    }
    paidDone(sv);
  }, 1500);
}
/** plApple() */
export function plApple() {
  const my = ++AC_RUN;
  UI.busy = 'apple';
  tfBump();
  setTimeout(() => {
    if (my !== AC_RUN) return;
    if (AC_QA.pay === 'fail') {
      plPayFail({ brand: 'Apple Pay', last4: '' });
      plCheckout();
      return;
    }
    paidDone(acCardKeep({ last4: '', brand: 'Apple Pay', exp: '', name: '' }, 'ap'));
  }, 1400);
}
/** 「다른 결제 수단 사용」 */
export function plNewCard() {
  acS().newCard = 1;
  plCheckout();
}

/* ── 플랜 뒤 화면(px) ── */
/** pxBack(k) */
export function pxBack(k: string) {
  const a = acS();
  if (k === 'plan') {
    if (acConnList().length) {
      a.ex = null;
      a.adding = 0;
      a.edit = null;
      acSave();
      acPageView();
    } else plView(PL.ctx);
    return;
  }
  if (k === 'ex') {
    a.edit = 'ex';
    a.exSel = a.ex;
    acSave();
    acRe();
    return;
  }
  if (k === 'acct') {
    a.has = null;
    a.g = 0;
    a.edit = null;
    acSave();
    acRe();
  }
  /* 'result' 는 백테스트 실행 준비 화면에서만 쓴다 (백테스트 조각) */
}
/** pxPickEx(id): 타일을 누르면 바로 다음 화면 */
export function pxPickEx(id: string) {
  acExGo(PL.ctx, id);
  acRe();
}
/** pxJoined(): 가입 화면을 열었다 */
export function pxJoined() {
  acGuideOpen();
  setTimeout(acRe, 50);
}
export function pxHas() {
  acHas('yes');
  acRe();
}
export function pxGuide(n: number) {
  acGuide(n);
  acRe();
}
/** pxPaidRoute(): 지금 쓰는 거래소 계정을 구독으로 연결: 결제 → 같은 거래소 승인 */
export function pxPaidRoute() {
  const a = acS();
  const ex = a.ex;
  a.route = 'paid';
  a.has = null;
  a.g = 0;
  acSave();
  plCheckout({ ...PL.ctx, need: ex });
}
export function pxInvite() {
  pxInviteRoute();
  acRe();
}
export function pxSub() {
  pxSubRoute();
  acRe();
}
export function pxUidAlt(k: 'new' | 'paid' | 'ex') {
  acUidAlt(k);
  acRe();
}
export function pxLimitAlt(k: 'partner' | 'more' | 'ex') {
  acLimitAlt(k);
  acRe();
}
/** acAddMore(): 거래소 더 연결하기 */
export function acAddMore() {
  const a = acS();
  a.ex = null;
  a.adding = 1;
  a.has = null;
  a.auth = { st: 'idle' };
  a.uid = { st: 'none' };
  a.kyc = { st: 'none' };
  a.doneAt = null;
  a.edit = null;
  acSave();
  acPageView();
}
/** acDisc(k): 연결 끊기. 되돌리기 어려운 일이라 한 번 더 묻는다 */
export function acDisc(k: string, after?: () => void) {
  acConfirm({
    title: acName(k) + ' 연결을 끊으시겠습니까?',
    body: '이 거래소에서 돌아가는 전략은 새 주문을 내지 않습니다. 열려 있는 포지션은 거래소에 그대로 남습니다.',
    ok: '연결 끊기',
    danger: 1,
    run: () => {
      acDiscRun(k);
      toast(acName(k) + ' 연결을 끊었습니다');
      if (getState().mode === 'tfbrokers') acPageView();
      else if (after) after();
    },
  });
}

/* ── 연결 승인 (거래소 화면 흉내) ── */
/** acAuthOpen() */
export function acAuthOpen() {
  const a = acS();
  if (!acEx(a.ex)) return;
  a.auth = { st: 'pending', ex: a.ex };
  acSave();
  UI.auth = true;
  UI.busy = null;
  tfBump();
}
/** acAuthNo() */
export function acAuthNo() {
  const a = acS();
  a.auth = { st: 'cancel', ex: a.ex };
  acSave();
  UI.auth = false;
  acRe();
}
/** acAuthYes() */
export function acAuthYes() {
  const a = acS();
  const my = ++AC_RUN;
  UI.busy = 'auth';
  tfBump();
  setTimeout(() => {
    UI.auth = false;
    if (my !== AC_RUN) {
      tfBump();
      return;
    }
    const bad = AC_QA.auth === 'fail';
    a.auth = bad ? { st: 'fail', ex: a.ex } : { st: 'ok', ex: a.ex, at: Date.now(), uid: String(30000000 + (mkHash(((S.user && S.user.email) || 'u') + a.ex) % 60000000)) };
    acSave();
    acRe();
    if (!bad && acStep() === 'uid') acUidRun();
  }, 1300);
}
/** acUidRun(): 승인으로 받은 계정 번호가 TETH 초대로 만든 계정인지 본다 */
export function acUidRun() {
  const a = acS();
  const my = ++AC_RUN;
  setTimeout(() => {
    if (my !== AC_RUN) return;
    UI.uidPhase = 1;
    tfBump();
    setTimeout(() => {
      if (my !== AC_RUN) return;
      const bad = a.has !== 'no' && AC_QA.uid === 'fail';
      a.uid = bad ? { st: 'fail', ex: a.ex, v: a.auth.uid } : { st: 'ok', ex: a.ex, v: a.auth.uid };
      acSave();
      acRe();
    }, 900);
  }, 800);
}
/** 화면을 떠날 때: 기다리던 일을 버린다 (원본 acSheetClose 의 AC_RUN++) */
export function acLeave() {
  AC_RUN++;
  UI.busy = null;
  UI.auth = false;
}
export { acAccess };
