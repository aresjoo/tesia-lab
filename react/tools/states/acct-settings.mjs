// 설정 화면(#/settings/<탭>)의 견줌 상태. 이름은 모두 st- 로 시작한다.
// 프리셋: 02 로그인만, 12 초대 회원 Bitget, 13 구독 회원 Bybit + 카드 2장 + 결제 내역, 14 두 곳 연결 + 2단계 인증 + 기기 2대, 15 구독 만료.
export default ({ click, seq, type, desktop }) => {
  /* 원본은 부팅 때 #/settings 주소를 열지 않는다(부팅 경로 목록에 settings 가 없어 홈에 머문다). 그래서 원본 쪽만 tfRoute() 를 한 번 불러 연다. */
  const ROUTE = { orig: 'tfRoute()' };
  const at = (preset, tab, o = {}) => ({ preset, hash: '#/settings' + (tab ? '/' + tab : ''), go: ROUTE, ...o });
  const wait = (ms) => async (p) => { await p.waitForTimeout(ms); };
  const bottom = async (p) => { await p.evaluate(() => { window.scrollTo(0, 1e6); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = 1e6; }); };
  /** 본문의 n번째 섹션, r번째 줄의 단추 */
  const row = (sec, r, extra = '.stg-b') => `#st-main .stg-sec:nth-of-type(${sec}) .stg-card > .stg-r:nth-child(${r}) ${extra}`;
  /** 메뉴의 탭 단추 (앱으로 돌아가기가 첫 단추) */
  const NI = { general: 2, account: 3, notify: 4, billing: 5, usage: 6, security: 7, brokers: 8, help: 9 };
  const ni = (k) => `.stg-nav > button:nth-of-type(${NI[k]})`;
  const ok = click('#st-dlg .bts .ok');
  const cfOk = click('#ac-cf-ok');
  /* 구독을 해지해 둔 상태(기간은 남음), 결제 내역 4건, 마지막 결제 실패 */
  const CX = "acS().sub={st:'cancelled',since:Date.now()-40*864e5,until:Date.now()+20*864e5,price:280}";
  const MORE = "acS().bill.push({id:'TQA0',st:'refunded',label:'TETH 구독',amt:280,at:Date.now()-70*864e5,brand:'Visa',last4:'4242'})";
  const FAIL = "acS().pay={st:'fail',at:Date.now()}";
  const card = (n) => seq(type('#sc-cn', n), type('#sc-ce', '1229'), type('#sc-cc', '123'), type('#sc-ch', 'KIM DOHYUN'), ok);
  const cardsDlg = seq(click(row(1, 3)), wait(100));
  return [
    /* ── 들어가기 ── */
    ['st-gen', null, null, at('13', 'general')],
    ['st-gen-en', null, 'en', at('13', 'general')],
    ['st-root', null, null, at('13', '')],
    ['st-guest', null, null, { hash: '#/settings/general', go: ROUTE }],
    ['st-plan-redir', null, null, { preset: '13', hash: '#/plan', ready: '#st-root' }],
    /* 회원은 톱니 줄이 숨는다: PC 는 접힌 사이드바의 프로필 단추, 모바일은 드로어의 내 정보 줄이 설정 메뉴를 연다 */
    ['st-enter-menu', desktop(seq(click('#g-person-row .g-ico-btn'), click('#gm-set-item')), seq(click('#g-hamburger'), click('#g-me-row'), click('#gm-set-item'))), null, { preset: '13' }],
    ['st-tab-click', desktop(click(ni('billing')), seq(click('.stg-mback'), click(ni('billing')))), null, at('13', 'general')],
    ['st-mlist-pick', desktop(null, click(ni('security'))), null, at('14', '')],
    ['st-mback', desktop(null, click('.stg-mback')), null, at('13', 'billing')],
    ['st-navhid', desktop(click('#st-tg'), null), null, at('13', 'account')],
    ['st-navhid-open', desktop(seq(click('#st-tg'), click('.stg-rl')), null), null, at('13', 'account')],
    /* 원본은 부팅 때 홈을 한 번 그려 두어 돌아온 홈에 첫 진입 연출이 없고, React 는 여기서 홈을 처음 그린다. 연출(1.9초)이 끝난 뒤에 찍는다 */
    ['st-back', seq(desktop(click('.stg-back'), seq(click('.stg-mback'), click('.stg-back'))), wait(2400)), null, at('13', 'general')],
    ['st-help', desktop(click(ni('help')), seq(click('.stg-mback'), click(ni('help')))), null, at('13', 'general')],
    ['st-lang', async (p) => { await p.selectOption('.stg-sel', 'en'); }, null, at('13', 'general')],
    /* ── 계정 ── */
    ['st-acct-02', null, null, at('02', 'account')],
    ['st-acct-12', null, null, at('12', 'account')],
    ['st-acct-13', null, null, at('13', 'account')],
    ['st-acct-14', null, null, at('14', 'account')],
    ['st-acct-14-bottom', bottom, null, at('14', 'account')],
    ['st-acct-15', null, null, at('15', 'account')],
    ['st-acct-en', null, 'en', at('14', 'account')],
    ['st-acct-name', click(row(1, 2)), null, at('13', 'account')],
    ['st-acct-name-err', seq(click(row(1, 2)), type('#st-name', 'a'), click(row(1, 2, '.stg-b.p'))), null, at('13', 'account')],
    ['st-acct-name-ok', seq(click(row(1, 2)), type('#st-name', '이서연'), click(row(1, 2, '.stg-b.p'))), null, at('13', 'account')],
    ['st-acct-hd', click(row(1, 3)), null, at('13', 'account')],
    ['st-acct-hd-err', seq(click(row(1, 3)), type('#st-hd', 'teth'), click(row(1, 3, '.stg-b.p'))), null, at('13', 'account')],
    ['st-acct-hd-ok', seq(click(row(1, 3)), type('#st-hd', 'dohyun_k'), click(row(1, 3, '.stg-b.p'))), null, at('13', 'account')],
    ['st-email', click(row(1, 4)), null, at('13', 'account')],
    ['st-email-err', seq(click(row(1, 4)), type('#st-em', 'abc'), ok), null, at('13', 'account')],
    ['st-email-same', seq(click(row(1, 4)), type('#st-em', 'demo@teth.ai'), ok), null, at('13', 'account')],
    ['st-email-code', seq(click(row(1, 4)), type('#st-em', 'new@teth.ai'), ok), null, at('13', 'account')],
    ['st-email-code-err', seq(click(row(1, 4)), type('#st-em', 'new@teth.ai'), ok, type('#st-ec', '000000'), ok), null, at('13', 'account')],
    ['st-email-done', seq(click(row(1, 4)), type('#st-em', 'new@teth.ai'), ok, type('#st-ec', '123456'), ok), null, at('13', 'account')],
    ['st-disc-cf', click(row(2, 1)), null, at('14', 'account')],
    ['st-disc-done', seq(click(row(2, 1)), cfOk), null, at('14', 'account')],
    ['st-logout-cf', click(row(3, 1)), null, at('13', 'account')],
    ['st-logout-done', seq(click(row(3, 1)), cfOk, wait(2400)), null, at('13', 'account')],
    ['st-delete-cf', click(row(4, 1)), null, at('13', 'account')],
    ['st-delete-cf2', seq(click(row(4, 1)), type('#ac-cf-in', '삭제'), cfOk), null, at('13', 'account')],
    /* 로그아웃 알림(2.2초) 뒤에 줄 서 있던 「계정을 삭제했습니다」 알림이 2.4초부터 4.6초까지 뜬다. 부하에 따라 찍는 때가 그 경계를 넘나들어, 알림이 다 지나간 뒤에 찍는다 */
    ['st-delete-done', seq(click(row(4, 1)), type('#ac-cf-in', '삭제'), cfOk, cfOk, wait(5400)), null, at('13', 'account')],
    /* ── 알림 ── */
    ['st-notify', null, null, at('13', 'notify')],
    ['st-notify-bottom', bottom, null, at('13', 'notify')],
    ['st-notify-tgl', seq(click(row(1, 1, '.stg-seg button:nth-child(1)')), click(row(1, 6, '.stg-seg button:nth-child(2)'))), null, at('13', 'notify')],
    /* ── 결제 ── */
    ['st-bill-02', null, null, at('02', 'billing')],
    ['st-bill-12', null, null, at('12', 'billing')],
    ['st-bill-13', null, null, at('13', 'billing')],
    ['st-bill-13-bottom', bottom, null, at('13', 'billing')],
    ['st-bill-14', null, null, at('14', 'billing')],
    ['st-bill-15', null, null, at('15', 'billing')],
    ['st-bill-en', null, 'en', at('13', 'billing')],
    ['st-bill-fail', null, null, at('15', 'billing', { tweak: FAIL })],
    ['st-bill-sub', click(row(1, 1)), null, at('13', 'billing')],
    ['st-bill-cancel-cf', seq(click(row(1, 1)), click('#st-dlg .bts .dg')), null, at('13', 'billing')],
    ['st-bill-cancel-done', seq(click(row(1, 1)), click('#st-dlg .bts .dg'), cfOk), null, at('13', 'billing')],
    ['st-bill-cx', null, null, at('13', 'billing', { tweak: CX })],
    ['st-bill-resume', click(row(1, 1)), null, at('13', 'billing', { tweak: CX })],
    ['st-bill-cards', cardsDlg, null, at('13', 'billing')],
    ['st-bill-card-def', seq(cardsDlg, click('#st-dlg .stg-r:nth-child(2) .stg-b:first-child')), null, at('13', 'billing')],
    ['st-bill-card-del-cf', seq(cardsDlg, click('#st-dlg .stg-r:nth-child(1) .stg-b')), null, at('13', 'billing')],
    ['st-bill-card-del-done', seq(cardsDlg, click('#st-dlg .stg-r:nth-child(1) .stg-b'), cfOk), null, at('13', 'billing')],
    ['st-bill-card-lock', seq(cardsDlg, click('#st-dlg .stg-r:nth-child(1) .stg-b')), null, at('14', 'billing')],
    ['st-bill-card-add', seq(cardsDlg, ok), null, at('13', 'billing')],
    ['st-bill-card-err', seq(cardsDlg, ok, ok), null, at('13', 'billing')],
    ['st-bill-card-exp-err', seq(cardsDlg, ok, type('#sc-cn', '4111111111111111'), type('#sc-ce', '1329'), ok), null, at('13', 'billing')],
    ['st-bill-card-deny', seq(cardsDlg, ok, card('0000111122223333')), null, at('13', 'billing')],
    ['st-bill-card-ok', seq(cardsDlg, ok, card('5555444433331111'), cardsDlg), null, at('13', 'billing')],
    ['st-bill-info', click(row(1, 4)), null, at('13', 'billing')],
    ['st-bill-info-err', seq(click(row(1, 4)), type('#st-be', 'x'), ok), null, at('13', 'billing')],
    ['st-bill-info-ok', seq(click(row(1, 4)), type('#st-be', 'pay@teth.ai'), ok), null, at('13', 'billing')],
    ['st-bill-rc', click('#st-main .stg-hr:nth-child(1)'), null, at('13', 'billing')],
    ['st-bill-rc-fail', click('#st-main .stg-hr:nth-child(2)'), null, at('13', 'billing')],
    ['st-bill-more', null, null, at('13', 'billing', { tweak: MORE })],
    ['st-bill-all', seq(click('.stg-lk'), bottom), null, at('13', 'billing', { tweak: MORE })],
    ['st-bill-rc-refund', seq(click('.stg-lk'), click('#st-main .stg-hr:nth-child(4)')), null, at('13', 'billing', { tweak: MORE })],
    /* ── 사용량과 AI 요금 줄 ── */
    ['st-use-02', null, null, at('02', 'usage')],
    ['st-use-12', null, null, at('12', 'usage')],
    ['st-use-13', null, null, at('13', 'usage')],
    ['st-use-14', null, null, at('14', 'usage')],
    ['st-use-04', null, null, at('04', 'usage')],
    ['st-use-06', null, null, at('06', 'usage')],
    ['st-use-08', null, null, at('08', 'usage')],
    ['st-use-10', null, null, at('10', 'usage')],
    ['st-bill-06', null, null, at('06', 'billing')],
    ['st-bill-08', null, null, at('08', 'billing')],
    ['st-bill-10', null, null, at('10', 'billing')],
    ['st-use-next', seq(click('#st-main .stg-b.p'), wait(600)), null, at('06', 'usage')],
    ['st-use-topup', seq(click('#st-main .stg-b.p'), wait(600)), null, at('08', 'usage')],
    ['st-use-topup-do', seq(click('#st-main .stg-b.p'), wait(600), click('.use-amt:nth-child(2)')), null, at('08', 'usage')],
    /* ── 보안 ── */
    ['st-sec-02', null, null, at('02', 'security')],
    ['st-sec-14', null, null, at('14', 'security')],
    ['st-sec-14-bottom', bottom, null, at('14', 'security')],
    ['st-sec-2fa-on', click('.stg-sw'), null, at('02', 'security')],
    ['st-sec-2fa-cf', click('.stg-sw'), null, at('14', 'security')],
    ['st-sec-2fa-off', seq(click('.stg-sw'), cfOk), null, at('14', 'security')],
    ['st-sec-pw', click(row(1, 1)), null, at('14', 'security')],
    ['st-sec-pw-err', seq(click(row(1, 1)), type('#st-p0', 'oldpassword'), type('#st-p1', 'short'), ok), null, at('14', 'security')],
    ['st-sec-pw-diff', seq(click(row(1, 1)), type('#st-p0', 'oldpassword'), type('#st-p1', 'newpassword!2026'), type('#st-p2', 'newpassword!2027'), ok), null, at('14', 'security')],
    ['st-sec-pw-ok', seq(click(row(1, 1)), type('#st-p0', 'oldpassword'), type('#st-p1', 'newpassword!2026'), type('#st-p2', 'newpassword!2026'), ok), null, at('02', 'security')],
    ['st-sec-outone', click(row(2, 2)), null, at('14', 'security')],
    ['st-sec-outall-cf', click(row(2, 3)), null, at('14', 'security')],
    ['st-sec-disc-cf', click(row(3, 2)), null, at('14', 'security')],
  ];
};
