// 설정(st)의 화면 없는 부분. 원본 「설정 (st)」 구역과 그것을 덮어쓴 「sk-settings」 구역의 살아 있는 최종 규칙이다.
// 상태는 S.tf.st(사용자명, 알림, 2단계 인증, 비밀번호 바꾼 날, 기기)와 S.tf.ac(카드, 결제 내역, 구독, 청구 정보)에 있다.
import { AC_CFG, acAccess, acCardRead, acCharge, acConnList, acS, acSave, acSubOn, type CardErr } from './ac';
import { S, tfS, type AcBill, type AcCard } from './tf';

export type StTab = 'general' | 'account' | 'notify' | 'billing' | 'usage' | 'security';
/** ST_TABS: 탭 순서와 이름. usage 는 원본이 뒤에서 billing 다음에 끼워 넣는다 (아이콘은 화면 쪽에 있다) */
export const ST_TABS: [StTab, string][] = [
  ['general', '일반'],
  ['account', '계정'],
  ['notify', '알림'],
  ['billing', '결제'],
  ['usage', '사용량'],
  ['security', '보안'],
];
/** stRoute(h) 의 탭 고르기: 모르는 탭과 빈 탭은 general */
export const stTabOf = (t: string | null | undefined): StTab => (ST_TABS.some((x) => x[0] === t) ? (t as StTab) : 'general');

export type StDevice = { id: string; n: string; at: string; where: string };
export type St = { handle: string | null; notif: Record<string, string[]>; twofa: boolean; pwAt: number | null; devices?: StDevice[] };

/** stS(): 프리셋이 만든 설정 상태에 알림 값이 없어도 멈추지 않게 채운다 */
export function stS(): St {
  const t = tfS();
  if (!t.st) t.st = { handle: null, notif: {}, twofa: false, pwAt: null };
  const s = t.st as St;
  if (!s.notif) s.notif = {};
  return s;
}
/** stHandle(): 정한 사용자명이 없으면 이메일 앞부분에서 만든다 */
export function stHandle(): string {
  const s = stS();
  if (s.handle) return s.handle;
  const e = (S.user && S.user.email) || '';
  return (
    (e.split('@')[0] || 'teth_user')
      .replace(/[^a-z0-9_]/gi, '')
      .toLowerCase()
      .slice(0, 20) || 'teth_user'
  );
}
/** stDate(ms), skDate(ms) */
export function stDate(ms: number): string {
  const d = new Date(ms);
  return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
}
/** skDate(ms) */
export const skDate = stDate;
/** skDateK(ms) */
export function skDateK(ms: number): string {
  const d = new Date(ms);
  return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}
/** skExp(e): 카드 유효기간 */
export function skExp(e: string | null | undefined): string {
  const m = String(e || '').match(/([0-9]{2})[/]([0-9]{2})/);
  return m ? '20' + m[2] + '년 ' + +m[1] + '월 만료' : '만료 ' + (e || '');
}
/** stAccessTxt() */
export function stAccessTxt(): string {
  const acc = acAccess();
  const L = acConnList();
  return acc === 'paid' ? '구독 이용 중' : acc === 'partner' ? 'TETH 초대 계정 이용 중' : L.length ? '구독 종료' : '실행 환경 미연결';
}
/** skSecurity() 의 기기 이름: [기기, 브라우저] */
export function stDevice(ua: string): [string, string] {
  const dev = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : '이 기기';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '브라우저';
  return [dev, br];
}

/* ── 계정 ── */
/** stNameSave(): 오류 글자를 돌려준다. 없으면 저장한 것 (앱 상태의 회원 이름은 화면 쪽이 userPatch 로 맞춘다) */
export function stNameSave(raw: string): string | null {
  const v = (raw || '').trim();
  if (v.length < 2) return '이름은 2자 이상이어야 합니다';
  if (S.user) S.user.name = v;
  acSave();
  return null;
}
/** stHandleSave() */
export function stHandleSave(raw: string): string | null {
  const v = (raw || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(v)) return '영문 소문자, 숫자, 밑줄로 3자에서 20자까지 쓸 수 있습니다';
  if (/^(teth|admin|support)$/.test(v)) return '쓸 수 없는 사용자명입니다';
  stS().handle = v;
  acSave();
  return null;
}
/** stEmailSend(): 새 주소를 살핀다. 통과하면 { v } */
export function stEmailSend(raw: string): { err: string } | { v: string } {
  const v = (raw || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return { err: '이메일 주소를 확인해 주십시오' };
  if (v === ((S.user && S.user.email) || '').toLowerCase()) return { err: '지금 쓰는 주소와 같습니다' };
  return { v };
}
/** stEmailDone(): 확인 번호가 맞으면 이메일을 바꾼다 (000000 은 틀린 번호로 친다) */
export function stEmailDone(code: string, email: string): string | null {
  const c = (code || '').replace(/\D/g, '');
  if (c.length !== 6) return '6자리 번호를 입력해 주십시오';
  if (c === '000000') return '번호가 맞지 않습니다. 다시 확인해 주십시오';
  if (S.user) S.user.email = email;
  acSave();
  return null;
}
/** stDelete() 의 확인 창 목록 */
export function stDeleteList(): string[] {
  const t = tfS();
  const live = (t.strat || []).filter((x) => x.status === 'live').length;
  const cp = t.cp as { copies?: { status?: string }[] } | null | undefined;
  const cps = ((cp && cp.copies) || []).filter((c) => c.status === 'active').length;
  return ['만든 전략과 백테스트 기록', '복사해 실행 중인 전략' + (live + cps ? ' (' + (live + cps) + '개는 즉시 멈춥니다)' : ''), '거래소 연결과 결제 정보', '대화 기록'].concat(
    acSubOn() ? ['구독은 즉시 해지되며 남은 기간은 환불되지 않습니다'] : [],
  );
}

/* ── 알림 ── */
/** ST_NF: [키, 이름, 설명, 기본 채널]. 설명은 원본이 뒤에서 합니다체(NF_D)로 바꾼 것이다 */
export const ST_NF: [string, string, string, string[]][] = [
  ['fill', '체결', '전략의 주문이 체결되면 알립니다.', ['push', 'email']],
  ['state', '전략 상태', '전략이 중지되거나 오류가 발생하면 알립니다.', ['push', 'email']],
  ['risk', '손실 한도', '설정한 손실 한도에 도달하면 알립니다.', ['push', 'email']],
  ['copy', '복사한 전략', '원본 전략의 설정이 변경되면 알립니다.', ['push']],
  ['bill', '결제와 계정', '결제와 로그인 내역, 보안 설정 변경을 알립니다.', ['email']],
  ['news', '소식', '새 기능과 전략을 안내합니다.', []],
];
/** stNfOf(k) */
export function stNfOf(k: string): string[] {
  const n = stS().notif[k];
  if (n) return n;
  for (const x of ST_NF) if (x[0] === k) return x[3].slice();
  return [];
}
/** stNf(k, ch) */
export function stNf(k: string, ch: string) {
  const s = stS();
  const v = stNfOf(k).slice();
  const i = v.indexOf(ch);
  if (i >= 0) v.splice(i, 1);
  else v.push(ch);
  s.notif[k] = v;
  acSave();
}

/* ── 결제 ── */
/** 기본 카드 (skBilling, skSubDlg 의 def) */
export const stDefCard = (): AcCard | undefined => {
  const a = acS();
  return a.cards.filter((c) => c.def)[0] || a.cards[0];
};
/** stReceipt(id) 가 보여 줄 내역 */
export const stBillOf = (id: string): AcBill | undefined => acS().bill.filter((x) => x.id === id)[0];
/** stCardAdd(): 입력을 읽어 카드를 더한다. 오류면 { field, msg } */
export function stCardAdd(v: { cn: string; ce: string; cc: string; ch: string }): CardErr | null {
  const c = acCardRead(v);
  if ('field' in c) return c;
  if (!acCharge(c)) return { field: 'cn', msg: '이 카드는 등록되지 않았습니다. 다른 카드를 써 주십시오' };
  const a = acS();
  a.cards.push({ id: 'c' + Date.now().toString(36), last4: c.last4, brand: c.brand, exp: c.exp, name: c.name, def: !a.cards.length });
  acSave();
  return null;
}
/** stCardDef(id) */
export function stCardDef(id: string) {
  acS().cards.forEach((c) => {
    c.def = c.id === id;
  });
  acSave();
}
/** stCardDel(id) 의 갈래: 구독 결제에 쓰는 하나뿐인 카드는 지울 수 없다 */
export function stCardDelLocked(c: AcCard): boolean {
  const a = acS();
  return c.def && acSubOn() && a.cards.length < 2 && !(a.sub && a.sub.st === 'cancelled');
}
/** stCardDel(id) 의 실행부 */
export function stCardDelRun(id: string) {
  const a = acS();
  a.cards = a.cards.filter((x) => x.id !== id);
  if (a.cards.length && !a.cards.some((x) => x.def)) a.cards[0].def = true;
  acSave();
}
/** stSubCancel() 이 물을 것: 언제까지 쓸 수 있는지, 초대 계정이 함께 연결돼 있는지 */
export function stSubCancelInfo(): { until: number; part: boolean } {
  const a = acS();
  return { until: (a.sub && a.sub.next) || Date.now() + 30 * 864e5, part: acConnList().some((k) => a.conn[k].via === 'partner') };
}
/** stSubCancel() 의 실행부 */
export function stSubCancelRun(until: number) {
  const a = acS();
  a.sub = { st: 'cancelled', since: a.sub ? a.sub.since : undefined, until, price: (a.sub && a.sub.price) || AC_CFG.price };
  acSave();
}
/** stSubResume(): 카드가 없으면 false (카드부터 등록하게 한다) */
export function stSubResume(): boolean {
  const a = acS();
  if (!a.cards.length) return false;
  a.sub = { st: 'active', since: (a.sub && a.sub.since) || Date.now(), next: (a.sub && a.sub.until) || Date.now() + 30 * 864e5, price: AC_CFG.price };
  tfS().payDone = true;
  acSave();
  return true;
}
/** skBillDlg() 가 채워 둘 값 */
export function stBillTo(): { email: string; name: string; addr: string } {
  const bt = acS().billTo;
  return bt ? { email: bt.email || '', name: bt.name || '', addr: bt.addr || '' } : { email: (S.user && S.user.email) || '', name: (S.user && S.user.name) || '', addr: '' };
}
/** skBillSave() */
export function skBillSave(email: string, name: string, addr: string): string | null {
  const e = (email || '').trim();
  const n = (name || '').trim();
  const ad = (addr || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return '결제 이메일을 확인해 주십시오';
  if (!n) return '이름을 입력해 주십시오';
  acS().billTo = { email: e, name: n, addr: ad };
  acSave();
  return null;
}

/* ── 보안 ── */
/** stOutOne(id) */
export function stOutOne(id: string) {
  const s = stS();
  s.devices = (s.devices || []).filter((d) => d.id !== id);
  acSave();
}
/** stTwofa() 의 값 바꾸기 */
export function stTwofaSet(on: boolean) {
  stS().twofa = on;
  acSave();
}
/** stPwSave() */
export function stPwSave(a: string, b: string, c: string): string | null {
  if (!a) return '지금 비밀번호를 입력해 주십시오';
  if (b.length < 12 || !/\d/.test(b) || !/[^A-Za-z0-9]/.test(b)) return '새 비밀번호는 12자 이상이고 숫자와 특수문자가 있어야 합니다';
  if (b !== c) return '새 비밀번호가 서로 다릅니다';
  if (a === b) return '지금 비밀번호와 다른 것을 써 주십시오';
  stS().pwAt = Date.now();
  acSave();
  return null;
}
