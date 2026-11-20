// AI 트레이딩 터미널 견줌. 원본(HTML 판)과 React 판을 같은 크기, 같은 동작으로 찍어 나란히 붙이고 다른 픽셀 비율을 센다.
// 쓰는 법: node tools/compare-term.mjs <원본 주소> <React 주소> <결과 폴더> [상태 이름...]
// 무작위(인사말, 별)와 움직임은 두 쪽 모두 꺼서 같은 조건에서 견준다.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { mktFixture } from './mkt-fixture.mjs';

const [orig, react, outDir, ...only] = process.argv.slice(2);
if (!orig || !react || !outDir) throw new Error('node tools/compare-term.mjs <원본> <React> <결과 폴더> [상태...]');
fs.mkdirSync(outDir, { recursive: true });

const click = (sel) => async (p) => { await p.click(sel); };
const seq = (...fs_) => async (p) => { for (const f of fs_) { await f(p); await p.waitForTimeout(350); } };
const type = (sel, text) => async (p) => { await p.fill(sel, text); };
const desktop = (f, g) => async (p) => ((p.viewportSize().width > 860 ? f : g) ? (p.viewportSize().width > 860 ? f : g)(p) : null);

/** 계정 상태를 맞춰 견줄 때의 고정 시각 (두 쪽의 Date.now 를 같게 둔다) */
const T0 = Date.parse('2026-11-20T03:00:00Z');
/** 터미널이 부르는 바깥 주소(시세, 차트 위젯)는 두 쪽 모두 같은 고정 응답으로 막는다 */
const NET = [/tradingview\.com/, /binance\.com/, /coingecko\.com/, /bitget\.com\/api/, /cdn\.jsdelivr\.net/];
/** 바깥에서 받는 코인 아이콘(로컬 목록에 없는 종목)도 같은 그림 하나로 돌려준다 */
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#3b6cf6"/><path d="M9 16h14M16 9v14" stroke="#fff" stroke-width="3"/></svg>';
/** 회원 화면: 원본의 로그인 단추(Google)로 들어간 뒤 사이드바의 AI 트레이딩을 누른다 */
const login = seq(click('#g-auth-btns .ga-login'), click('#au-start .au-btns .au-btn:first-child'), async (p) => { await p.waitForTimeout(3200); });
const sideTrade = desktop(click('#g-tf-dash-btn'), seq(click('#g-hamburger'), click('#g-tf-dash-btn')));
const scrollTo = (y) => async (p) => { await p.evaluate((yy) => { window.scrollTo(0, yy); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = yy; }, y); };
/** 터미널 상태. 원본에서 계정 상태를 만든 뒤 #/trade 로 들어간다 */
const TW = '#nfxh-wrap';
const term = (name, pre, act, lang) => [name, act || null, lang || null, { hash: '#/trade', pre, wait: TW, mkt: !/-offline$/.test(name) }];
const P_EMPTY = "qaAcct('uid')";
const P_USER = "tfQaPreset('08');tfQaOverlay('strat')";
const P_PV = "qaAcct('uid');window.TF_PREVIEW=true";
const btab = (n) => click('.tft-btabs button:nth-child(' + n + ')');
/** 하단 탭: PC 는 탭 줄, 모바일은 가로로 미는 탭 줄. 모바일은 구역 탭 없이 차트, 하단, 판단 순서로 쌓인다 */
const pane = (k) => desktop(click('.tft-botbar .nfxh-tab[data-k=' + k + ']'), click('.m2-only .nfxh-tab[data-k=' + k + ']'));
const brainTop = async () => {};
const bscroll = (y) => async (p) => { await p.evaluate((yy) => { const e = document.getElementById('tft-bbody'); if (e) e.scrollTop = yy; }, y); };
/** 전략 상세 #/trade/bot/<id>: 주소는 원본에서 만든 전략의 at 로 정한다 */
const bot = (name, pre, act) => [name, act || null, null, { hashJs: "'#/trade/bot/'+S.tf.strat[0].at", pre, wait: '.nfxb-hero' }];
const BOT = [
  bot('bot-live', P_USER),
  bot('bot-live-s700', P_USER, scrollTo(700)),
  bot('bot-live-end', P_USER, scrollTo(1e6)),
  bot('bot-fills', P_USER, click('#nfxl-host .nfxh-fchip:nth-of-type(2)')),
  bot('bot-pause', P_USER, click('.nfxb-actions .dng')),
  bot('bot-env', P_USER, click('.nfxb-actions .sec')),
  bot('bot-edit', P_USER, click('.nfxb-actions .out')),
  bot('bot-edit-run', P_USER, seq(click('.nfxb-actions .out'), async (p) => { await p.selectOption('#tfbe-sl', '-8'); }, click('#tfbe-run'))),
  bot('bot-edit-dirty', P_USER, seq(click('.nfxb-actions .out'), click('#tfbe-run'), async (p) => { await p.selectOption('#tfbe-rsi', '40'); })),
  bot('bot-edit-apply', P_USER, seq(click('.nfxb-actions .out'), async (p) => { await p.selectOption('#tfbe-tp', '15'); }, click('#tfbe-run'), click('#tfbe-apply'))),
  bot('bot-back', P_USER, click('.nfx-bc .lk')),
  ['bot-guest', null, null, { hash: '#/trade/bot/123', wait: '#g-home-in' }],
  ['bot-missing', null, null, { hashJs: "'#/trade/bot/999'", pre: P_USER, wait: TW, toastReset: true }],
];
const TERM = [
  term('term-empty', P_EMPTY),
  term('term-empty-end', P_EMPTY, scrollTo(1e6)),
  term('term-empty-pane-assets', P_EMPTY, pane('assets')),
  term('term-empty-s700', P_EMPTY, desktop(null, scrollTo(700))),
  term('term-user', P_USER),
  term('term-user-offline', P_USER),
  term('term-user-offline-rule', P_USER, desktop(null, click('.tb-rfeed details:first-child summary'))),
  term('term-user-mkt-data-1d', P_USER, seq(click('.mkt-tabs button:nth-child(3)'), click('#mkt-data .mkx-per button:last-child'))),
  term('term-user-mktpick-pick', P_USER, seq(click('#mkh .mkh-sym'), click('#mkp-rows .mkp-r:nth-child(3)'))),
  term('term-user-mktpick-q', P_USER, seq(click('#mkh .mkh-sym'), type('#mkp-q', 'eth'))),
  term('term-user-end', P_USER, scrollTo(1e6)),
  term('term-user-en', P_USER, null, 'en'),
  term('term-user-s700', P_USER, desktop(null, scrollTo(700))),
  term('term-user-s1400', P_USER, desktop(null, scrollTo(1400))),
  term('term-user-dash', P_USER, seq(brainTop, btab(2))),
  term('term-user-dash-s600', P_USER, seq(brainTop, btab(2), bscroll(600))),
  term('term-user-done', P_USER, seq(brainTop, btab(3))),
  term('term-user-rule-open', P_USER, seq(brainTop, click('.tb-rfeed details:first-child summary'))),
  term('term-user-fold', P_USER, seq(brainTop, click('.tm-fold'))),
  term('term-user-act', P_USER, seq(brainTop, click('.tft-fsec .ffc:nth-of-type(2)'))),
  term('term-user-chip', P_USER, seq(brainTop, click('.tft-comp .chips button:nth-child(3)'))),
  term('term-user-chip1', P_USER, seq(brainTop, click('.tft-comp .chips button:nth-child(1)'))),
  term('term-user-diff', P_USER, seq(brainTop, type('#tft-say', '손절을 -3%로 바꿔줘'), async (p) => { await p.press('#tft-say', 'Enter'); })),
  term('term-user-quick', P_USER, seq(brainTop, click('.tm-manage button:nth-of-type(1)'))),
  term('term-user-rail', P_USER, seq(brainTop, click('.mks-btn'))),
  term('term-user-menu', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn')), null)),
  term('term-user-rename', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu button:nth-child(2)')), null)),
  term('term-user-rename-err', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu button:nth-child(2)'), type('#tft-rn', ''), click('.ss3-cp .wbtn')), null)),
  term('term-user-cloneex', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu button:nth-child(4)')), null)),
  term('term-user-delete', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu .del')), null)),
  term('term-user-ver', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu button:nth-child(6)')), null)),
  term('term-user-halt', P_USER, desktop(click('.tm-c2 .tm-halt'), click('#tm-mhead .tm-halt'))),
  term('term-user-halt-go', P_USER, seq(desktop(click('.tm-c2 .tm-halt'), click('#tm-mhead .tm-halt')), click('.ss3-cp .ss3-dbtn'))),
  term('term-user-pause', P_USER, desktop(click('.tm-c2 .tft-halt, .tm-c2 .tft-go'), null)),
  term('term-user-drawer', P_USER, desktop(null, click('#tm-mhead .tm-mttl'))),
  term('term-user-pane-open', P_USER, pane('open')),
  term('term-user-pane-orders', P_USER, pane('orders')),
  term('term-user-pane-fills', P_USER, pane('fills')),
  term('term-user-pane-closed', P_USER, pane('closed')),
  term('term-user-pane-assets', P_USER, pane('assets')),
  term('term-user-trade-dlg', P_USER, seq(pane('closed'), click('#tft-p-closed tbody tr:first-child td:nth-child(5)'))),
  term('term-user-scope-all', P_USER, desktop(async (p) => { await p.selectOption('#tft-scope', 'all'); }, null)),
  term('term-user-mktpick', P_USER, click('#mkh .mkh-sym')),
  term('term-user-mkt-info', P_USER, click('.mkt-tabs button:nth-child(2)')),
  term('term-user-mkt-data', P_USER, click('.mkt-tabs button:nth-child(3)')),
  /* 둘째 묶음: 끝까지 가는 동작 */
  term('term-user-help', P_USER, desktop(click('.tm-help'), null)),
  term('term-user-diff-apply', P_USER, seq(type('#tft-say', '손절을 -3%로 바꿔줘'), async (p) => { await p.press('#tft-say', 'Enter'); }, click('.tft-diff .ap'))),
  term('term-user-diff-resume', P_USER, seq(type('#tft-say', '손절을 -3%로 바꿔줘'), async (p) => { await p.press('#tft-say', 'Enter'); }, click('.tft-diff .ap'), click('.tft-applied button'))),
  term('term-user-diff-cancel', P_USER, seq(type('#tft-say', '익절을 +15%로 바꿔줘'), async (p) => { await p.press('#tft-say', 'Enter'); }, click('.tft-diff .rej'))),
  term('term-user-say-cap', P_USER, seq(type('#tft-say', '예산 8,000달러로 바꿔줘'), async (p) => { await p.press('#tft-say', 'Enter'); })),
  term('term-user-say-unk', P_USER, seq(type('#tft-say', '레버리지 3배로 바꿔줘'), async (p) => { await p.press('#tft-say', 'Enter'); })),
  term('term-user-clone', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu button:nth-child(3)'), click('.mks-btn')), null)),
  term('term-user-cloneex-go', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu button:nth-child(4)'), click('.ss3-cp .ss3-radio:nth-of-type(2)'), click('.mks-btn')), null)),
  term('term-user-rename-go', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu button:nth-child(2)'), type('#tft-rn', '새 이름 전략'), click('.ss3-cp .wbtn')), null)),
  term('term-user-delete-stop', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu .del'), click('.ss3-cp .wbtn')), null)),
  term('term-user-delete-go', P_USER, desktop(seq(click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu .del'), click('.ss3-cp .wbtn'), click('.mks-btn'), click('.tft-card .mn'), click('#tft-menu .del'), click('.ss3-cp .ss3-dbtn')), null)),
  term('term-user-pause-resume', P_USER, desktop(seq(click('.tm-c2 .tft-halt'), click('.tm-c2 .tft-go')), null)),
  term('term-user-dash-trade', P_USER, seq(btab(2), click('#tft-bbody .tft-tbl tbody tr:first-child'))),
  term('term-user-done-trade', P_USER, seq(btab(3), click('#tft-bbody .tft-ct .dt2'))),
  term('term-user-dash-ver', P_USER, seq(btab(2), click('#tft-bbody .tft-vh a'))),
  term('term-user-more', P_USER, click('#tft-bbody .tft-more')),
  term('term-user-rail-filter', P_USER, desktop(seq(click('.mks-btn'), async (p) => { await p.selectOption('.tft-rf .fr2 select:first-child', 'off'); }), null)),
  term('term-user-rail-search', P_USER, desktop(seq(click('.mks-btn'), type('.tft-rf input', 'btc')), null)),
  term('term-pv-chip', P_PV, click('.tft-comp .chips button:nth-child(1)')),
  term('term-pv-dash-s600', P_PV, seq(btab(2), bscroll(600))),
  term('term-pv-sel2-dash', P_PV, desktop(seq(click('.mks-btn'), click('.tft-card:nth-child(2)'), btab(2)), null)),
  term('term-pv-sel4-pane-pos', P_PV, desktop(seq(click('.mks-btn'), click('.tft-card:nth-child(4)'), async (p) => { await p.selectOption('#tft-scope', 'all'); }, pane('open')), null)),
  term('term-order-wait', P_USER + ";qaOrder('wait')", pane('open')),
  /* 알림 구역은 숨겨 둔 종 단추로만 열린다. 원본은 딥링크 값으로, React 판은 같은 값을 씨앗으로 연다 */
  ...[['term-user-alerts', null], ['term-user-alerts-chip', click('#nfxh-alerts .nfxh-fchip:nth-child(3)')], ['term-user-alerts-readall', click('#nfxh-alerts .nfxu-later')]].map(([n, act]) => { const st = term(n, P_USER + ";window.TF_NFH_OPEN='alerts'", act); st[3].tmSeed = { nfh: 'alerts' }; return st; }),
  term('term-pv', P_PV),
  term('term-pv-end', P_PV, scrollTo(1e6)),
  term('term-pv-s700', P_PV, desktop(null, scrollTo(700))),
  term('term-pv-s1400', P_PV, desktop(null, scrollTo(1400))),
  term('term-pv-rail', P_PV, seq(brainTop, click('.mks-btn'))),
  term('term-pv-sel2', P_PV, desktop(seq(click('.mks-btn'), click('.tft-card:nth-child(2)')), seq(click('#tm-mhead .tm-mttl'), click('.tm-ditem:nth-child(2)')))),
  term('term-pv-sel3', P_PV, desktop(seq(click('.mks-btn'), click('.tft-card:nth-child(3)')), seq(click('#tm-mhead .tm-mttl'), click('.tm-ditem:nth-child(3)')))),
  term('term-pv-sel4', P_PV, desktop(seq(click('.mks-btn'), click('.tft-card:nth-child(4)')), seq(click('#tm-mhead .tm-mttl'), click('.tm-ditem:nth-child(4)')))),
  term('term-pv-sel5', P_PV, desktop(seq(click('.mks-btn'), click('.tft-card:nth-child(5)')), seq(click('#tm-mhead .tm-mttl'), click('.tm-ditem:nth-child(5)')))),
  term('term-pv-sel6', P_PV, desktop(seq(click('.mks-btn'), click('.tft-card:nth-child(6)')), seq(click('#tm-mhead .tm-mttl'), click('.tm-ditem:nth-child(6)')))),
  term('term-pv-dash', P_PV, seq(brainTop, btab(2))),
  term('term-pv-done', P_PV, seq(brainTop, btab(3))),
  term('term-pv-pane-closed', P_PV, pane('closed')),
  term('term-pv-pane-assets', P_PV, pane('assets')),
  term('term-pv-scope-all', P_PV, desktop(async (p) => { await p.selectOption('#tft-scope', 'all'); }, null)),
  term('term-pv-close', P_PV, click('.tm-preview button')),
];
/** 상태: [이름, 동작, 언어, 옵션]
 *  옵션: hash(그 주소로 바로 들어간다), pre(원본에서 실행해 계정 상태를 만드는 JS. 만든 상태 S.user, S.tf 를 React 판에 그대로 넣는다),
 *        wait(화면이 떴는지 볼 선택자), now(고정 시각) */
const STATES = [
  ['home', null],
  ['home-footer', async (p) => { await p.evaluate(() => { window.scrollTo(0, 1e6); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = 1e6; }); }],
  ['side-open', desktop(click('.g-brand-link'), click('#g-hamburger'))],
  ['globe', desktop(click('#g-globe'), null)],
  ['globe-cur', desktop(seq(click('#g-globe'), async (p) => { await p.evaluate(() => document.getElementById('glc-tab-c').click()); }), null)],
  ['setmenu', desktop(click('#g-gear-btn'), seq(click('#g-hamburger'), click('#g-gear-btn')))],
  ['setmenu-help', desktop(seq(click('#g-gear-btn'), click('#g-setmenu .gm-item[role=button]')), null)],
  ['feedback', desktop(seq(click('#g-gear-btn'), click('#g-setmenu .gm-item:nth-of-type(4)')), null)],
  ['auth-signup', click('#g-auth-btns .ga-signup')],
  ['auth-login', click('#g-auth-btns .ga-login')],
  ['auth-email-err', seq(click('#g-auth-btns .ga-signup'), type('#au-email', 'abc'), click('#au-start .au-btn.primary'))],
  ['auth-pwnew', seq(click('#g-auth-btns .ga-signup'), type('#au-email', 'demo@teth.ai'), click('#au-start .au-btn.primary'), type('#au-pwnew-in', 'abcdefgh1234'))],
  ['auth-code', seq(click('#g-auth-btns .ga-login'), type('#au-email', 'demo@teth.ai'), click('#au-start .au-btn.primary'))],
  ['auth-age', seq(click('#g-auth-btns .ga-signup'), click('#au-start .au-btns .au-btn:first-child'))],
  ['tpl-picked', seq(click('.g-tpl[data-id=auto]'), click('.g-tpl[data-id=btc]'))],
  ['typed', type('#g-home-in', '비트코인이 떨어졌을 때 사는 전략')],
  ['plus', click('#g-pill .plus')],
  ['help', click('#teth-help')],
  ['authed', seq(click('#g-auth-btns .ga-login'), click('#au-start .au-btns .au-btn:first-child'), async (p) => { await p.waitForTimeout(3200); })],
  ['authed-side', seq(click('#g-auth-btns .ga-login'), click('#au-start .au-btns .au-btn:first-child'), async (p) => { await p.waitForTimeout(3200); }, desktop(click('.g-brand-link'), click('#g-hamburger')))],
  ['home-en', null, 'en'],
  ['home-ja', null, 'ja'],
  /* ── AI 트레이딩 (#/trade) ── */
  ['trade-guest', null, null, { hash: '#/trade', wait: '.txh' }],
  ['trade-guest-click', sideTrade, null, { wait2: '.txh' }],
  ['trade-guest-s700', scrollTo(700), null, { hash: '#/trade', wait: '.txh' }],
  ['trade-guest-s1500', scrollTo(1500), null, { hash: '#/trade', wait: '.txh' }],
  ['trade-guest-s2400', scrollTo(2400), null, { hash: '#/trade', wait: '.txh' }],
  ['trade-guest-end', scrollTo(1e6), null, { hash: '#/trade', wait: '.txh' }],
  ['trade-guest-en', null, 'en', { hash: '#/trade', wait: '.txh' }],
  ['trade-guest-cta', click('.txh-hero .txh-cta'), null, { hash: '#/trade', wait: '.txh' }],
  ['trade-member-click', seq(login, sideTrade), null, { wait2: '.txh' }],
  ['trade-free', null, null, { hash: '#/trade', pre: "qaAcct('free')", wait: '.txh' }],
  ['trade-free-end', scrollTo(1e6), null, { hash: '#/trade', pre: "qaAcct('free')", wait: '.txh' }],
  ['trade-sub', null, null, { hash: '#/trade', pre: "tfQaPreset('06')", wait: '.txh' }],
  /* ── 터미널 (활성 상태) ── */
  ...TERM,
  ...BOT,
];
const VIEWPORTS = [['d1440', 1440, 900], ['m390', 390, 844]];

const b = await chromium.launch();
const rows = [];
async function shot(base, vp, st, inject) {
  const [, w, h] = vp;
  const o = st[3] || {};
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript(({ lang, inj }) => {
    Math.random = () => 0;
    try { if (lang) localStorage.setItem('tethLang', lang); } catch (e) { /* */ }
    /* 원본에서 만든 계정 상태를 React 판에 그대로 넣는다 (원본과 같은 저장 키 teth.state 의 tf 칸) */
    try { if (inj && !sessionStorage.getItem('cmpInj')) { sessionStorage.setItem('cmpInj', '1'); if (inj.user) localStorage.setItem('teth.react.user', inj.user); const u = inj.user ? JSON.parse(inj.user) : null; localStorage.setItem('teth.state', JSON.stringify({ v: 1, savedAt: Date.now(), user: u ? { name: u.name, email: u.email || '' } : undefined, tf: JSON.parse(inj.tf), sessions: [] })); sessionStorage.setItem('teth.react.tfPreview', inj.preview ? '1' : '0'); if (inj.tm) sessionStorage.setItem('teth.react.tm', inj.tm); } } catch (e) { /* */ }
  }, { lang: st[2] || null, inj: inject || null });
  /* 시세 주소: mkt 옵션이면 고정 응답을 돌려주고, 아니면 막는다. 차트 위젯은 늘 막는다 */
  for (const re of NET) await ctx.route(re, (r) => {
    const j = o.mkt ? mktFixture(r.request().url(), o.now || T0) : null;
    if (o.mkt && /cdn\.jsdelivr\.net\/npm\/cryptocurrency-icons/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: ICON });
    return j ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(j) }) : r.abort();
  });
  const p = await ctx.newPage();
  if (o.pre || o.now) await p.clock.setFixedTime(o.now || T0);
  const errs = [];
  p.on('pageerror', (e) => { const m = String(e).slice(0, 160); if (!/ChartStorage/.test(m)) errs.push(m); });
  let state = null;
  if (o.pre && !inject) {
    /* 원본: 홈에서 계정 상태를 만들고 그 주소로 간다 */
    await p.goto(base, { waitUntil: 'load', timeout: 120000 });
    await p.waitForSelector('#g-home-in', { timeout: 60000 });
    await p.waitForTimeout(1500);
    await p.evaluate(o.pre);
    await p.waitForTimeout(400);
    state = await p.evaluate(() => ({ user: S.user ? JSON.stringify({ name: S.user.name }) : null, tf: JSON.stringify(S.tf), preview: !!window.TF_PREVIEW, tm: typeof TF_TM === 'object' ? JSON.stringify({ sel: TF_TM.sel, tab: TF_TM.tab, scope: TF_TM.scope, fmode: TF_TM.fmode || 'all' }) : null }));
    if (o.tmSeed && state.tm) state.tm = JSON.stringify({ ...JSON.parse(state.tm), ...o.tmSeed });
    if (o.hashJs) state.hash = await p.evaluate(o.hashJs);
    /* 원본에서 계정 상태를 만들 때 뜬 시험용 토스트가 줄을 서 있으면, 이 화면의 토스트가 그 뒤로 밀려 늦게 뜬다.
       React 판은 상태를 넣어 뜨므로 그 줄이 없다. 토스트를 보는 상태는 줄을 비우고 같은 출발점에서 견준다 */
    if (o.toastReset) await p.evaluate(() => { const t = document.getElementById('toast'); if (t) { t._q = []; clearTimeout(t._h); t.classList.remove('show'); } });
    const h0 = o.hash || state.hash;
    if (h0) await p.evaluate((hh) => { if (location.hash === hh) tfRoute(); else location.hash = hh; }, h0);
  } else await p.goto(base + (o.hash || (inject && inject.hash) || ''), { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector(o.wait || '#g-home-in', { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  /* 원본에서 계정 상태를 만들 때 뜬 토스트는 사라진 뒤에도 글자가 남아 화면 밖에 합성 층을 하나 만든다.
     그 층 때문에 뒤에 뜨는 드로어의 글자 렌더링(가장자리 처리)이 달라지므로, 숨은 토스트의 글자를 비운다 */
  if (o.pre && !inject) await p.evaluate(() => { const t = document.getElementById('toast'); if (t && !t.classList.contains('show')) t.textContent = ''; });
  // 원본에만 있는 시험용 QA 단추는 견줌에서 뺀다
  await p.addStyleTag({ content: '#tf-devbtn,.qa2-panel{display:none!important} *{caret-color:transparent!important}' });
  let skipped = false;
  if (st[1]) {
    try { const r = await st[1](p); if (r === null) skipped = true; } catch (e) { errs.push('동작 실패: ' + String(e).slice(0, 200)); }
    if (o.wait2) { try { await p.waitForSelector(o.wait2, { timeout: 30000 }); } catch (e) { errs.push('화면이 뜨지 않음: ' + o.wait2); } await p.waitForTimeout(1200); }
    await p.waitForTimeout(900);
  }
  /* 판단 기록 묶음의 날짜 범위: 원본은 뒤에서 도는 두 함수(tbRuleLog 120ms, 날짜 글자 바꾸기 300ms)의 순서에 따라
     연도가 떼어지기도 남기도 한다(기계 부하와 시세 응답 시각에 따라 실행마다 바뀐다). 원본이 뜻한 모양(연도 뗌)으로 맞춘 뒤 찍는다 */
  if (!skipped) await p.evaluate(() => { document.querySelectorAll('.tb-rfeed .tb-ft').forEach((e) => { const t = e.textContent || ''; if (/~/.test(t) && /\d{4}\. /.test(t)) e.textContent = t.replace(/\d{4}\. /g, ''); }); });
  const buf = skipped ? null : await p.screenshot();
  await ctx.close();
  return { buf, errs, state };
}

const cmp = await b.newPage();
async function diff(a, c) {
  return cmp.evaluate(async ([A, C]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ic] = await Promise.all([load(A), load(C)]);
    const w = ia.width, h = ia.height;
    const cv = document.createElement('canvas'); cv.width = w * 2 + 12; cv.height = h;
    const x = cv.getContext('2d'); x.fillStyle = '#ff2d55'; x.fillRect(0, 0, cv.width, h); x.drawImage(ia, 0, 0); x.drawImage(ic, w + 12, 0);
    const da = x.getImageData(0, 0, w, h).data, dc = x.getImageData(w + 12, 0, w, h).data;
    let n = 0; let minY = h, maxY = -1;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]) > 24) { n++; const y = Math.floor(i / 4 / w); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return { ratio: n / (w * h), minY, maxY, png: cv.toDataURL('image/png').split(',')[1] };
  }, [a.toString('base64'), c.toString('base64')]);
}

for (const st of STATES) {
  if (only.length && !only.includes(st[0])) continue;
  for (const vp of VIEWPORTS) {
    let o, r;
    if (st[3] && st[3].pre) { o = await shot(orig, vp, st); r = await shot(react, vp, st, o.state); }
    else [o, r] = await Promise.all([shot(orig, vp, st), shot(react, vp, st)]);
    if (!o.buf || !r.buf) continue;
    const d = await diff(o.buf, r.buf);
    const name = `${st[0]}-${vp[0]}`;
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(d.png, 'base64'));
    const line = `${name.padEnd(24)} 다른 픽셀 ${(d.ratio * 100).toFixed(3)}%${d.maxY >= 0 ? ` (y ${d.minY}~${d.maxY})` : ''}${o.errs.length ? ' | 원본 오류 ' + o.errs.join(' / ') : ''}${r.errs.length ? ' | React 오류 ' + r.errs.join(' / ') : ''}`;
    console.log(line);
    rows.push(line);
  }
}
fs.writeFileSync(path.join(outDir, 'result.txt'), rows.join('\n') + '\n');
await b.close();
