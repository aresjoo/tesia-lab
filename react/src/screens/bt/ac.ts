// 실행 환경(거래소 연결) 상태를 읽는 창구. 원본 acS(), acEx, acReady 가운데 백테스트 여정이 읽는 것만 옮겼다.
// 연결 화면과 상태를 바꾸는 동작은 거래소 연결 조각의 것이다. 그 조각이 붙으면 이 파일은 그쪽 것으로 바꾼다.
import type { AcState } from '../../core/bt/tf';
import { tfS } from './tfState';

/** AC_CFG */
export const AC_CFG = { price: 280, cur: 'USD', order: ['bitget', 'binance', 'okx', 'bybit', 'mexc', 'woox', 'gate'] };
const AC_NAME: Record<string, string> = { bitget: 'Bitget', binance: 'Binance', okx: 'OKX', bybit: 'Bybit', mexc: 'MEXC', woox: 'WOO X', gate: 'Gate' };

type Conn = { via: string; at: number; uid?: string; kyc?: string };
export interface Ac extends AcState {
  conn: Record<string, Conn>;
}
/** acS(): 없으면 첫 모양을 만들고, 예전 방식으로 연결해 둔 계정을 옮겨 온다 */
export function acS(): Ac {
  const t = tfS();
  if (!t.ac) t.ac = { route: null, ex: null, has: null, g: 0, pay: { st: 'none' }, auth: { st: 'idle' }, uid: { st: 'none' }, conn: {}, cards: [], bill: [], sub: null };
  const a = t.ac as Ac & Record<string, unknown>;
  a.conn = a.conn || {};
  a.pay = a.pay || { st: 'none' };
  a.auth = a.auth || { st: 'idle' };
  a.uid = a.uid || { st: 'none' };
  a.kyc = a.kyc || { st: 'none' };
  a.cards = a.cards || [];
  a.bill = a.bill || [];
  if (t.api && t.api.ex && !a.conn[t.api.ex]) a.conn[t.api.ex] = { via: t.uidLinked ? 'partner' : t.payDone ? 'paid' : 'partner', at: Date.now(), uid: t.uid || '' };
  return a;
}
/** acEx(id): 연결할 수 있는 거래소인가 */
export const acEx = (id: string | null | undefined) => !!id && AC_CFG.order.indexOf(id) >= 0;
/** acName(id) */
export const acName = (id: string | null | undefined) => (id && AC_NAME[id]) || id || '';
/** acSubOn() */
export function acSubOn(): boolean {
  const a = acS();
  const sub = a.sub;
  return !!(sub && sub.st === 'active') || (!!tfS().payDone && !(sub && sub.st === 'cancelled' && (sub.until || 0) < Date.now()));
}
/** acAccess() */
export function acAccess(): 'paid' | 'partner' | 'none' {
  const a = acS();
  if (acSubOn()) return 'paid';
  for (const k in a.conn) if (a.conn[k].via === 'partner') return 'partner';
  return 'none';
}
/** acConnList() */
export const acConnList = () => Object.keys(acS().conn).filter((k) => acEx(k));
/** acConnOk(k) */
export function acConnOk(k: string): boolean {
  const c = acS().conn[k];
  return !!c && acEx(k) && (c.via === 'partner' || acSubOn());
}
/** acReady(ex) */
export const acReady = (ex: string | null) => (ex ? acConnOk(ex) : acConnList().some(acConnOk));
/** acUsd(n) */
export const acUsd = (n: number) => '$' + Number(n).toLocaleString();

/** acConfirmClose() */
export function acConfirmClose() {
  const w = document.getElementById('ac-cf');
  if (w) w.remove();
}
/** acConfirm(o): 확인 창. 원본처럼 body 끝에 붙는 떠 있는 상자다 (입력 확인 칸은 거래소 연결 조각의 것이라 뺐다) */
export function acConfirm(o: { title: string; body?: string; list?: string[]; ok?: string; no?: string; run: () => void }) {
  acConfirmClose();
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string) => {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const w = el('div', undefined, 'acx-cf');
  w.id = 'ac-cf';
  w.setAttribute('role', 'alertdialog');
  w.setAttribute('aria-modal', 'true');
  w.setAttribute('aria-label', o.title);
  const bx = el('div', undefined, 'bx');
  bx.append(el('h3', o.title));
  if (o.body) bx.append(el('p', o.body));
  if (o.list) {
    const ul = el('ul');
    o.list.forEach((x) => ul.append(el('li', x)));
    bx.append(ul);
  }
  const bts = el('div', undefined, 'bts');
  const no = el('button', o.no || '취소', 'no');
  no.type = 'button';
  no.onclick = acConfirmClose;
  const ok = el('button', o.ok || '확인', 'ok');
  ok.type = 'button';
  ok.id = 'ac-cf-ok';
  ok.onclick = () => {
    acConfirmClose();
    try {
      o.run();
    } catch {
      /* 무시 */
    }
  };
  bts.append(no, ok);
  bx.append(bts);
  w.append(bx);
  w.addEventListener('click', (e) => {
    if (e.target === w) acConfirmClose();
  });
  document.body.appendChild(w);
  try {
    no.focus();
  } catch {
    /* 무시 */
  }
}
/** stDate(ms) */
export const stDate = (ms: number) => {
  const d = new Date(ms);
  return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
};
