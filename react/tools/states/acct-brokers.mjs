// 거래소 연결 화면(#/brokers)의 견줌 상태. 원본에는 이 화면의 주소가 없어 원본 쪽만 tfBrokersView() 로 연다.
export default ({ click, seq, type, desktop, tick }) => {
  /** 두 쪽 모두 거래소 연결로 들어간다 (원본은 함수, React 는 새로 준 주소) */
  const B = (o = {}) => ({ ...o, go: { orig: o.ex ? `acPageView('${o.ex}')` : 'tfBrokersView()', react: `location.hash='#/brokers${o.ex ? '/' + o.ex : ''}'` } });
  const bottom = async (p) => { await p.evaluate(() => { window.scrollTo(0, 1e6); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = 1e6; }); };
  const ex = (id) => click(`.px-exs button:has(img[src*="app-${id}."])`);
  const free = click('.pl-cta-hi');
  const paid = click('.pl-card:not(.pl-hi):not(.pl-bt) .pl-cta');
  const have = click('.px-links .acx-have');
  const authGo = click('#ac-go');
  const card = (n) => seq(type('#ac-cn', n), type('#ac-ce', '1229'), type('#ac-cc', '123'), type('#ac-ch', 'KIM DOHYUN'));
  const menu = desktop(seq(click('#g-gear-btn'), click('#g-setmenu .gm-item:nth-of-type(3)')), seq(click('#g-hamburger'), click('#g-gear-btn'), click('#g-setmenu .gm-item:nth-of-type(3)')));
  /* 회원은 톱니 대신 프로필 줄이 메뉴를 연다 */
  const menuIn = desktop(seq(click('#g-person-row .g-ico-btn'), click('#g-setmenu .gm-item:nth-of-type(3)')), seq(click('#g-hamburger'), click('#g-me-row'), click('#g-setmenu .gm-item:nth-of-type(3)')));
  const P = { paused: true };
  const K = (qa) => ({ preset: '12', paused: true, qa: qa || undefined, go: { orig: "acRunGate('bitget',function(){})", react: "acRunGate('bitget',function(){})" } });
  /* 타이머를 세운 상태는 먼저 400ms 를 민다: 원본은 홈을 떠난 뒤 300ms 간격 점검으로 앱 배너 자리(has-banner)를 뺀다 */
  const out = [
    /* 손님 */
    ['bk-guest', null, null, B()],
    ['bk-guest-bottom', bottom, null, B()],
    ['bk-guest-en', null, 'en', B()],
    ['bk-guest-pick', free, null, B()],
    ['bk-guest-menu', menu, null, {}],
    ['bk-guest-footer', seq(bottom, click('.gft-col:first-child button:nth-of-type(4)')), null, {}],
    /* React 판은 새로 준 주소로 바로 들어온 때 (원본은 같은 화면을 함수로 연다) */
    ['bk-guest-direct', null, null, { hash: { react: '#/brokers' }, go: { orig: 'tfBrokersView()' } }],
    ['bk-12-direct', null, null, { preset: '12', hash: { react: '#/brokers' }, go: { orig: 'tfBrokersView()' } }],
    ['bk-12-direct-okx', null, null, { preset: '12', hash: { react: '#/brokers/okx' }, go: { orig: "acPageView('okx')" } }],
    /* 로그인만 한 회원: 플랜 화면에서 고른다 */
    ['bk-02', null, null, B({ preset: '02' })],
    ['bk-02-menu', menuIn, null, { preset: '02' }],
    ['bk-02-free-ex', free, null, B({ preset: '02' })],
    ['bk-02-free-ex-en', free, 'en', B({ preset: '02' })],
    ['bk-02-acct', seq(free, ex('bitget')), null, B({ preset: '02' })],
    ['bk-02-acct-back', seq(free, ex('okx'), click('.pl-back')), null, B({ preset: '02' })],
    ['bk-02-joined', seq(free, ex('bitget'), click('a.px-cta'), async (p) => { await p.bringToFront(); await p.waitForTimeout(400); }), null, B({ preset: '02' })],
    ['bk-02-auth', seq(free, ex('bitget'), have), null, B({ preset: '02' })],
    ['bk-02-auth-dlg', seq(free, ex('bitget'), have, authGo), null, B({ preset: '02' })],
    ['bk-02-auth-cancel', seq(free, ex('bitget'), have, authGo, click('#ac-auth .no')), null, B({ preset: '02' })],
    ['bk-02-auth-busy', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(300)), null, B({ preset: '02', ...P })],
    ['bk-02-uid-run0', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(1350)), null, B({ preset: '02', ...P })],
    ['bk-02-uid-run1', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(1350), tick(850)), null, B({ preset: '02', ...P })],
    ['bk-02-done', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(1350), tick(850), tick(950)), null, B({ preset: '02', ...P })],
    ['bk-02-done-more', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(1350), tick(850), tick(950), click('.px-links .pl-link')), null, B({ preset: '02', ...P })],
    ['bk-02-auth-fail', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(1350)), null, B({ preset: '02', qa: { auth: 'fail' }, ...P })],
    ['bk-02-uid-fail', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(1350), tick(850), tick(950)), null, B({ preset: '02', qa: { uid: 'fail' }, ...P })],
    ['bk-02-uid-fail-paid', seq(free, ex('bitget'), have, authGo, click('#ac-auth-ok'), tick(1350), tick(850), tick(950), click('.px-col .px-ch:nth-child(2)'), tick(50)), null, B({ preset: '02', qa: { uid: 'fail' }, ...P })],
    /* 구독: 플랜 구성(결제) */
    ['bk-02-co', paid, null, B({ preset: '02' })],
    ['bk-02-co-bottom', seq(paid, bottom), null, B({ preset: '02' })],
    ['bk-02-co-en', paid, 'en', B({ preset: '02' })],
    ['bk-02-co-err', seq(paid, click('#ac-go')), null, B({ preset: '02' })],
    ['bk-02-co-err-exp', seq(paid, type('#ac-cn', '4242424242424242'), type('#ac-ce', '13'), click('#ac-go')), null, B({ preset: '02' })],
    ['bk-02-co-typed', seq(paid, card('4242424242424242')), null, B({ preset: '02' })],
    ['bk-02-co-busy', seq(paid, card('4242424242424242'), click('#ac-go'), tick(300)), null, B({ preset: '02', ...P })],
    ['bk-02-co-busy-bottom', seq(paid, card('4242424242424242'), bottom, tick(300), click('#ac-go'), tick(300)), null, B({ preset: '02', ...P })],
    ['bk-02-co-fail', seq(paid, card('0000111122223333'), click('#ac-go'), tick(1550)), null, B({ preset: '02', ...P })],
    ['bk-02-co-paid', seq(paid, card('4242424242424242'), click('#ac-go'), tick(1550)), null, B({ preset: '02', ...P })],
    ['bk-02-co-paid-auth', seq(paid, card('5555444433331111'), click('#ac-go'), tick(1550), ex('binance')), null, B({ preset: '02', ...P })],
    ['bk-02-co-apple', seq(paid, click('.pl-apple'), tick(300)), null, B({ preset: '02', ...P })],
    ['bk-02-co-back', seq(paid, click('.pl-back')), null, B({ preset: '02' })],
    ['bk-02-acct-paidlink', seq(free, ex('bybit'), click('.px-links .pl-link:last-child')), null, B({ preset: '02' })],
    /* 이미 연결한 회원: 목록 */
    ['bk-12-list', null, null, B({ preset: '12' })],
    ['bk-12-list-en', null, 'en', B({ preset: '12' })],
    ['bk-12-menu', menuIn, null, { preset: '12' }],
    ['bk-12-disc', click('.px-list .pl-link'), null, B({ preset: '12' })],
    ['bk-12-disc-ok', seq(click('.px-list .pl-link'), click('#ac-cf-ok')), null, B({ preset: '12' })],
    ['bk-12-disc-no', seq(click('.px-list .pl-link'), click('#ac-cf .no')), null, B({ preset: '12' })],
    ['bk-12-add', click('.px-links .pl-link'), null, B({ preset: '12' })],
    ['bk-12-add-okx', seq(click('.px-links .pl-link'), ex('okx')), null, B({ preset: '12' })],
    ['bk-12-okx', null, null, B({ preset: '12', ex: 'okx' })],
    ['bk-13-list', null, null, B({ preset: '13' })],
    ['bk-13-add-auth', seq(click('.px-links .pl-link'), ex('binance')), null, B({ preset: '13' })],
    ['bk-13-add-invite', seq(click('.px-links .pl-link'), ex('binance'), click('.px-sm .pl-link')), null, B({ preset: '13' })],
    ['bk-14-list', null, null, B({ preset: '14' })],
    /* 구독이 끝난 회원: 저장한 카드로 다시 결제 */
    ['bk-15', null, null, B({ preset: '15' })],
    ['bk-15-newcard', click('.pl-saved .pl-link'), null, B({ preset: '15' })],
    ['bk-15-pay', seq(click('#ac-go'), tick(1550)), null, B({ preset: '15', ...P })],
    ['bk-15-pay-fail', seq(click('#ac-go'), tick(1550)), null, B({ preset: '15', qa: { pay: 'fail' }, ...P })],
    /* 본인 확인 관문(acRunGate): 전략 시작 직전에 뜨는 창. 홈에서 같은 함수를 불러 견준다 */
    ['bk-kyc-run', null, null, K()],
    ['bk-kyc-ok', tick(800), null, K()],
    ['bk-kyc-ok-closed', seq(tick(800), tick(600)), null, K()],
    ['bk-kyc-fail', tick(800), null, K({ kyc: 'fail' })],
    ['bk-kyc-fail-again', seq(tick(800), click('#ac-kyc .pl-link'), tick(200)), null, K({ kyc: 'fail' })],
    ['bk-kyc-review', tick(800), null, K({ kyc: 'review' })],
    ['bk-kyc-err', tick(800), null, K({ kyc: 'err' })],
  ];
  return out.map((st) => (st[3] && st[3].paused ? [st[0], st[1] ? seq(tick(400), st[1]) : tick(400), st[2], st[3]] : st));
};
