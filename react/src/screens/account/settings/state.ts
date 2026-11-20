// 설정 화면의 화면 상태 (원본 전역 ST) 와 이동. 값을 바로 고치고 stRe() 로 다시 그린다.
import { tfBump } from '../../../core/account/tf';
import { goHome } from '../../../state/route';

/** 떠 있는 창 (원본 stDlg 로 띄우는 것들) */
export type StDlg =
  | { k: 'email' } /* stEmailDlg */
  | { k: 'receipt'; id: string } /* stReceipt */
  | { k: 'card' } /* stCardDlg */
  | { k: 'sub' } /* skSubDlg */
  | { k: 'cards' } /* skCardsDlg */
  | { k: 'bill' } /* skBillDlg */
  | { k: 'pw' } /* stPwDlg */
  | { k: 'topup' }; /* aiTopup */

/** ST: edit 고치는 줄, em 이메일 바꾸기 단계, allBill 결제 내역 전체 보기, navHid 메뉴 접힘, dlg 떠 있는 창 (tab, mList 는 주소에서 읽는다) */
export const ST: { edit: 'name' | 'handle' | null; em: { step: 0 | 1; v: string }; allBill: boolean; navHid: boolean; dlg: StDlg | null; dlgSeq: number } = {
  edit: null,
  em: { step: 0, v: '' },
  allBill: false,
  navHid: false,
  dlg: null,
  dlgSeq: 0,
};
/* 설정 메뉴 접기: 기억해 둔다 */
try {
  ST.navHid = localStorage.getItem('teth.stnav') === '0';
} catch {
  /* 무시 */
}

/** stRe() */
export const stRe = () => tfBump();

/** stRoute(h) 를 다시 돌릴 때(같은 주소로 stGo) 화면이 할 일: 고치던 줄을 닫고 맨 위로. Settings 가 걸어 둔다 */
export const stHooks: { reroute: (() => void) | null } = { reroute: null };

/** stGo(tab): 같은 주소면 hashchange 가 없어 직접 다시 연다 */
export function stGo(tab?: string) {
  const h = '#/settings/' + (tab || 'general');
  if (window.location.hash === h) {
    if (stHooks.reroute) stHooks.reroute();
    return;
  }
  window.location.hash = h;
}
/** stMList(): 모바일의 설정 목록으로 */
export function stMList() {
  const h = '#/settings';
  if (window.location.hash === h) {
    if (stHooks.reroute) stHooks.reroute();
    return;
  }
  window.location.hash = h;
}
/** 주소에서 해시를 지운다 (stBack, stLogout, stDelete 가 떠나기 전에 한다) */
export function stHashClear() {
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch {
    /* 무시 */
  }
}
/** stBack(): 앱으로 돌아가기 */
export function stBack() {
  stHashClear();
  goHome();
}
/** stNavToggle() */
export function stNavToggle() {
  ST.navHid = !ST.navHid;
  try {
    localStorage.setItem('teth.stnav', ST.navHid ? '0' : '1');
  } catch {
    /* 무시 */
  }
  stRe();
}
/** stEdit(k) */
export function stEdit(k: 'name' | 'handle' | null) {
  ST.edit = k;
  stRe();
}
/** stDlg(html, label): 떠 있던 창은 닫고 새로 띄운다 */
export function stDlg(d: StDlg) {
  ST.dlg = d;
  ST.dlgSeq++;
  stRe();
}
/** stDlgClose() */
export function stDlgClose() {
  if (!ST.dlg) return;
  ST.dlg = null;
  stRe();
}
/** stEmailDlg() */
export function stEmailDlg() {
  ST.em = { step: 0, v: '' };
  stDlg({ k: 'email' });
}
