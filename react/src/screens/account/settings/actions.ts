// 설정 화면의 동작: 저장, 확인 창을 거치는 일(로그아웃, 계정 삭제, 카드 삭제, 구독 해지 ...), 사용량의 다음 행동.
import { acS } from '../../../core/account/ac';
import { aiNext, aiTopupDo as aiTopupLedger } from '../../../core/account/ai';
import {
  skBillSave as coreBillSave,
  stCardAdd as coreCardAdd,
  stCardDef as coreCardDef,
  stCardDelLocked,
  stCardDelRun,
  stDate,
  stDeleteList,
  stEmailDone as coreEmailDone,
  stEmailSend as coreEmailSend,
  stHandleSave as coreHandleSave,
  stNameSave as coreNameSave,
  stNf as coreNf,
  stOutOne as coreOutOne,
  stPwSave as corePwSave,
  stS,
  stSubCancelInfo,
  stSubCancelRun,
  stSubResume as coreSubResume,
  stTwofaSet,
} from '../../../core/account/settings';
import type { CardErr } from '../../../core/account/ac';
import { S } from '../../../core/account/tf';
import { nav } from '../../../state/route';
import { logout, toast, userPatch } from '../../../state/store';
import { acDisc } from '../brokers/flow';
import { acConfirm } from '../confirm';
import { ST, stDlg, stDlgClose, stGo, stHashClear, stRe } from './state';

/** tfBrokersView(): 거래소 연결 화면으로 */
export const stBrokers = () => nav('#/brokers');
/** acDisc(k): 끊은 뒤 설정을 다시 그린다 */
export const stDisc = (k: string) => acDisc(k, stRe);

/* ── 계정 ── */
/** stNameSave(): 오류가 있으면 그 글자 */
export function stNameSave(raw: string): string | null {
  const er = coreNameSave(raw);
  if (er) return er;
  userPatch({ name: raw.trim() }); /* authSyncUI, gSideRender */
  ST.edit = null;
  stRe();
  toast('이름을 바꿨습니다');
  return null;
}
/** stHandleSave() */
export function stHandleSave(raw: string): string | null {
  const er = coreHandleSave(raw);
  if (er) return er;
  ST.edit = null;
  stRe();
  toast('사용자명을 바꿨습니다');
  return null;
}
/** stEmailSend() */
export function stEmailSend(raw: string): string | null {
  const r = coreEmailSend(raw);
  if ('err' in r) return r.err;
  ST.em = { step: 1, v: r.v };
  stDlg({ k: 'email' });
  return null;
}
/** stEmailDone() */
export function stEmailDone(code: string): string | null {
  const er = coreEmailDone(code, ST.em.v);
  if (er) return er;
  userPatch({ email: ST.em.v }); /* authSyncUI */
  stDlgClose();
  stRe();
  toast('이메일을 바꿨습니다');
  return null;
}
/** stLogout() */
export function stLogout() {
  acConfirm({
    title: '로그아웃하시겠습니까?',
    body: '돌아가는 전략은 계속 실행됩니다. 이 기기에서만 로그아웃합니다.',
    ok: '로그아웃',
    run: () => {
      stHashClear();
      logout();
    },
  });
}
/** stDelete(): 두 번 묻는다 */
export function stDelete() {
  acConfirm({
    title: '계정을 삭제하시겠습니까?',
    body: '삭제하면 되돌릴 수 없습니다. 아래 내용이 모두 지워집니다.',
    list: stDeleteList(),
    type: '삭제',
    ok: '계정 삭제',
    danger: 1,
    run: () => {
      acConfirm({
        title: '마지막 확인입니다',
        body: ((S.user && S.user.email) || '') + ' 계정을 지금 삭제합니다. 거래소에 있는 자산과 열린 포지션은 거래소에 그대로 남습니다.',
        ok: '영구 삭제',
        danger: 1,
        run: () => {
          stHashClear();
          logout(); /* gLogout(): S.tf 와 저장분을 지운다 */
          toast('계정을 삭제했습니다');
        },
      });
    },
  });
}

/* ── 알림 ── */
/** stNf(k, ch) */
export function stNf(k: string, ch: string) {
  coreNf(k, ch);
  stRe();
}

/* ── 결제 ── */
/** stCardDlg() */
export const stCardDlg = () => stDlg({ k: 'card' });
/** stCardAdd() */
export function stCardAdd(v: { cn: string; ce: string; cc: string; ch: string }): CardErr | null {
  const er = coreCardAdd(v);
  if (er) return er;
  stDlgClose();
  stRe();
  toast('결제 수단을 추가했습니다');
  return null;
}
/** skCardDef(id): 기본 카드를 바꾸고 창을 다시 그린다 */
export function skCardDef(id: string) {
  coreCardDef(id);
  stDlg({ k: 'cards' });
}
/** stCardDel(id) */
export function stCardDel(id: string) {
  const a = acS();
  const c = a.cards.filter((x) => x.id === id)[0];
  if (!c) return;
  if (stCardDelLocked(c)) {
    acConfirm({ title: '이 카드는 지금 삭제할 수 없습니다', body: '구독 결제에 쓰는 유일한 카드입니다. 다른 카드를 먼저 추가하거나 구독을 해지해 주십시오.', ok: '카드 추가', run: stCardDlg });
    return;
  }
  acConfirm({
    title: c.brand + ' •••• ' + c.last4 + ' 카드를 삭제하시겠습니까?',
    body: '삭제한 카드로는 더 결제되지 않습니다.',
    ok: '삭제',
    danger: 1,
    run: () => {
      stCardDelRun(id);
      stRe();
      toast('카드를 삭제했습니다');
    },
  });
}
/** stSubCancel() */
export function stSubCancel() {
  const { until, part } = stSubCancelInfo();
  acConfirm({
    title: '구독을 해지하시겠습니까?',
    body: stDate(until) + ' 까지는 지금처럼 쓸 수 있습니다.',
    list: ['그 뒤에는 결제되지 않습니다', part ? 'TETH 초대 계정이 연결되어 있어 해지 뒤에도 이용료 없이 계속 쓸 수 있습니다' : '그 뒤에는 돌아가는 전략이 새 주문을 내지 않습니다. 열린 포지션은 거래소에 그대로 남습니다'],
    ok: '구독 해지',
    danger: 1,
    run: () => {
      stSubCancelRun(until);
      stRe();
      toast('구독을 해지했습니다');
    },
  });
}
/** stSubResume() */
export function stSubResume() {
  if (!coreSubResume()) {
    acConfirm({ title: '결제 수단이 필요합니다', body: '구독을 다시 시작하려면 카드를 먼저 등록해 주십시오.', ok: '카드 추가', run: stCardDlg });
    return;
  }
  stRe();
  toast('구독을 다시 시작했습니다');
}
/** skBillSave() */
export function skBillSave(email: string, name: string, addr: string): string | null {
  const er = coreBillSave(email, name, addr);
  if (er) return er;
  stDlgClose();
  stRe();
  toast('청구 정보를 저장했습니다');
  return null;
}

/* ── 보안 ── */
/** stOutOne(id) */
export function stOutOne(id: string) {
  coreOutOne(id);
  stRe();
  toast('그 기기에서 로그아웃했습니다');
}
/** stTwofa(): 끌 때만 한 번 더 묻는다 */
export function stTwofa() {
  if (stS().twofa) {
    acConfirm({
      title: '2단계 인증을 끄시겠습니까?',
      body: '비밀번호만으로 로그인하게 됩니다.',
      ok: '끄기',
      danger: 1,
      run: () => {
        stTwofaSet(false);
        stRe();
      },
    });
  } else {
    stTwofaSet(true);
    stRe();
    toast('2단계 인증을 켰습니다');
  }
}
/** stOutAll() */
export function stOutAll() {
  acConfirm({ title: '다른 기기를 모두 로그아웃하시겠습니까?', body: '이 기기는 그대로 로그인되어 있습니다. 돌아가는 전략에는 영향이 없습니다.', ok: '모두 로그아웃', run: () => toast('다른 기기를 모두 로그아웃했습니다') });
}
/** stPwSave() */
export function stPwSave(a: string, b: string, c: string): string | null {
  const er = corePwSave(a, b, c);
  if (er) return er;
  stDlgClose();
  stRe();
  toast('비밀번호를 바꿨습니다');
  return null;
}

/* ── 사용량 ── */
/** aiTopup(): 결제 탭으로 가서 크레딧 추가 창을 연다 */
export function aiTopup() {
  stGo('billing');
  setTimeout(() => stDlg({ k: 'topup' }), 300);
}
/** aiNext().go 를 푼다 */
export function aiNextGo() {
  const nx = aiNext();
  if (nx.go === 'card') {
    stGo('billing');
    setTimeout(stCardDlg, 300);
  } else if (nx.go === 'topup') aiTopup();
  else stBrokers();
}
/** aiTopupDo(v) */
export function aiTopupDo(v: number) {
  aiTopupLedger(v);
  stDlgClose();
  toast('$' + v + '를 충전했습니다');
  stRe();
}
