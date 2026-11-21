// 원본(HTML 판)과 React 판을 같은 크기, 같은 동작으로 찍어 나란히 붙이고 다른 픽셀 비율을 센다.
// 전략 복사 조각의 견줌 (본 판 compare.mjs 에 전략 복사 상태를 더한 사본).
// 쓰는 법: node tools/compare-share.mjs <원본 주소> <React 주소> <결과 폴더> [상태 이름...]  (이름 끝에 * 를 붙이면 그 글자로 시작하는 상태 전부)
// 무작위(인사말, 별)와 움직임은 두 쪽 모두 꺼서 같은 조건에서 견준다.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const [orig, react, outDir, ...only] = process.argv.slice(2);
if (!orig || !react || !outDir) throw new Error('node tools/compare.mjs <원본> <React> <결과 폴더> [상태...]');
fs.mkdirSync(outDir, { recursive: true });

const click = (sel) => async (p) => { await p.click(sel); };
const seq = (...fs_) => async (p) => { for (const f of fs_) { await f(p); await p.waitForTimeout(350); } };
const type = (sel, text) => async (p) => { await p.fill(sel, text); };
const desktop = (f, g, pass) => async (p) => { const fn = p.viewportSize().width > 860 ? f : g; return fn ? fn(p) : pass ? undefined : null; };
const clickText = (sel, text) => async (p) => { await p.locator(sel, { hasText: text }).first().click(); };
const select = (sel, v) => async (p) => { await p.selectOption(sel, v); };
const scrollEnd = async (p) => { await p.evaluate(() => { window.scrollTo(0, 1e6); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = 1e6; }); };
const scrollY = (y) => async (p) => { await p.evaluate((yy) => { window.scrollTo(0, yy); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = yy; }, y); };
const login = seq(click('#g-auth-btns .ga-login'), click('#au-start .au-btns .au-btn:first-child'), async (p) => { await p.waitForTimeout(3200); });
const clickIfShown = (sel) => async (p) => { const e = p.locator(sel).first(); if (await e.isVisible()) await e.click(); };
const hashGo = (h) => async (p) => { await p.evaluate((hh) => { window.location.hash = hh; }, h); await p.waitForSelector('.mk-detail .mk-dbody, .mk3-grid', { timeout: 30000 }); await p.waitForTimeout(900); };
const hover = (sel) => async (p) => { await p.hover(sel); };
/** 그래프 위 한 점을 가리킨다 (가로 비율) */
const chartAt = (fx) => async (p) => { const b = await p.locator('#mkd-chart svg').boundingBox(); await p.mouse.move(b.x + b.width * fx, b.y + b.height / 2); };
/** 사이드바 「전략 복사」를 눌러 들어간다 (모바일은 메뉴를 먼저 연다) */
const enterShare = seq(desktop(null, click('#g-hamburger'), true), click('#g-tf-share-btn'), async (p) => { await p.waitForSelector('.mk3-grid', { timeout: 30000 }); });
/** 원본은 목록에 해시 주소가 없다. 원본만 눌러서 들어가고 React 는 주소로 바로 연다 */
const enterShareO = async (p) => { if (await p.$('.mk3-grid')) return; await enterShare(p); /* 누른 단추에 남은 마우스와 초점을 치운다 */ await p.mouse.move(700, 4); await p.evaluate(() => document.activeElement && document.activeElement.blur()); };

/* 복사 흐름 씨앗: 회원, 거래소 연결, 복사 여섯 건 */
const CPSEED = JSON.parse(fs.readFileSync(new URL('./compare-copy-seed.json', import.meta.url), 'utf8'));
const CPS = { seedO: CPSEED.o, seedR: CPSEED.r };
const CPID = Object.fromEntries(CPSEED.r['teth.state'].tf.cp.copies.map((c, i) => [['f1', 'd1', 'r1', 'h1', 'f2', 'f8'][i], c.id]));
/* 거래소 둘을 연결한 씨앗 (「내 거래소」 작은 목록) */
const twoEx = (kv) => { const o = JSON.parse(JSON.stringify(kv)); o['teth.state'].tf.ac.conn.okx = { via: 'partner', at: 1794276000000, uid: '77120011', kyc: 'ok' }; return o; };
const CPS2 = { seedO: twoEx(CPSEED.o), seedR: twoEx(CPSEED.r) };
/* 본인 확인이 안 끝난 거래소 씨앗 (복사 시작 때 본인 확인 창) */
const kycNone = (kv) => { const o = JSON.parse(JSON.stringify(kv)); o['teth.state'].tf.ac.conn.bitget.kyc = 'none'; return o; };
const CPK = { seedO: kycNone(CPSEED.o), seedR: kycNone(CPSEED.r) };
const wait = (ms) => async (p) => { await p.waitForTimeout(ms); };

/** 상태: [이름, 동작, 언어] */
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
  /* ── 전략 복사 ── 넷째 칸: { hash(두 쪽 모두), hashR(React 만), tall(긴 화면을 통째로), y(스크롤 위치), seedO/seedR(시작 전 저장소 값) } */
  ['share-hub', enterShare],
  ['share-hub-hash', enterShareO, null, { hashR: '#/share' }],
  ['share-hub-tall', enterShare, null, { tall: true }],
  ['share-hub-en', enterShare, 'en'],
  ['share-kind-agent', seq(enterShare, clickText('.mk3-seg button', 'AI 판단'))],
  ['share-kind-rule', seq(enterShare, clickText('.mk3-seg button', '차트 규칙')), null, { tall: true }],
  ['share-kind-mix', seq(enterShare, clickText('.mk3-seg button', '혼합 전략'))],
  ['share-sort-ret', seq(enterShare, select('.skf-sort select', 'ret')), null, { tall: true }],
  ['share-sort-fw', seq(enterShare, select('.skf-sort select', 'fw'))],
  ['share-mkt-menu', seq(enterShare, click('.tfbk-drop'))],
  ['share-mkt-stock', seq(enterShare, click('.tfbk-drop'), desktop(clickText('.tfbk-menu .mi', '미국 주식'), clickText('#tfbk-sheetw .it', '미국 주식'))), null, { tall: true }],
  ['share-search', seq(enterShare, clickIfShown('.mk-search-toggle'), type('#ss3-q', 'BTC'))],
  ['share-search-none', seq(enterShare, clickIfShown('.mk-search-toggle'), type('#ss3-q', '없는전략'))],
  ['share-page2', seq(enterShare, scrollEnd, click('.mk-pager .mk-pg[aria-label="2페이지"]')), null, { tall: true }],
  ['share-page2-view', seq(enterShare, scrollEnd, click('.mk-pager .mk-pg[aria-label="2페이지"]'))],
  ['share-page4-next', seq(enterShare, scrollEnd, click('.mk-pager .mk-pg[aria-label="3페이지"]'), scrollEnd, click('.mk-pager .mk-pg[aria-label="다음 페이지"]')), null, { tall: true }],
  ['share-hub-authed', seq(login, enterShare)],
  /* 회원이고 거래소가 연결된 상태의 목록 (씨앗은 아래 복사 흐름과 같다) */
  ['share-hub-conn', enterShare, null, CPS],
  /* 「내 거래소」 거르기: 하나 연결이면 켜고 끄기, 둘이면 작은 목록 */
  ['share-myex-on', seq(enterShare, click('.myex')), null, { tall: true, ...CPS }],
  ['share-myex-off', seq(enterShare, click('.myex'), click('.myex')), null, CPS],
  ['share-myex-on-p2', seq(enterShare, click('.myex'), scrollEnd, click('.mk-pager .mk-pg[aria-label="2페이지"]')), null, CPS],
  ['share-myex-agent', seq(enterShare, click('.myex'), clickText('.mk3-seg button', 'AI 판단')), null, CPS],
  ['share-myex-empty', seq(enterShare, click('.myex'), click('.tfbk-drop'), desktop(clickText('.tfbk-menu .mi', '미국 주식'), clickText('#tfbk-sheetw .it', '미국 주식'))), null, CPS],
  ['share-myex-none', seq(enterShare, click('.myex'), click('.tfbk-drop'), desktop(clickText('.tfbk-menu .mi', '지수와 금'), clickText('#tfbk-sheetw .it', '지수와 금'))), null, CPS],
  ['share-myex-none-all', seq(enterShare, click('.myex'), click('.tfbk-drop'), desktop(clickText('.tfbk-menu .mi', '지수와 금'), clickText('#tfbk-sheetw .it', '지수와 금')), click('.myex-empty .pl-link')), null, CPS],
  ['share-myex2', enterShare, null, CPS2],
  ['share-myex2-menu', seq(enterShare, click('.myex')), null, CPS2],
  ['share-myex2-okx', seq(enterShare, click('.myex'), clickText('.myex-m button', 'OKX만')), null, CPS2],
  ['share-myex2-okx-menu', seq(enterShare, click('.myex'), clickText('.myex-m button', 'OKX만'), click('.myex')), null, CPS2],
  ['share-help', seq(enterShare, scrollEnd, click('.mk-help .pl-link'))],
  /* 전략 상세: 주소로 바로, 목록에서 눌러서, 탭과 그래프 조작, 달력, 더 보기, 즐겨찾기 */
  ['detail-f1', null, null, { hash: '#/share/s/f1' }],
  ['detail-f1-tall', null, null, { hash: '#/share/s/f1', tall: true }],
  ['detail-d1-tall', null, null, { hash: '#/share/s/d1', tall: true }],
  ['detail-r1-tall', null, null, { hash: '#/share/s/r1/1y', tall: true }],
  ['detail-h1-tall', null, null, { hash: '#/share/s/h1', tall: true }],
  ['detail-f7-tall', null, null, { hash: '#/share/s/f7', tall: true }],
  ['detail-click', seq(enterShare, click('.mk3-grid .mk-card:nth-child(1)'), async (p) => { await p.waitForSelector('.mk-dbody'); })],
  ['detail-click-p2', seq(enterShare, scrollEnd, click('.mk-pager .mk-pg[aria-label="2페이지"]'), click('.mk3-grid .mk-card:nth-child(3)'), async (p) => { await p.waitForSelector('.mk-dbody'); })],
  ['detail-back-hub', seq(enterShare, click('.mk3-grid .mk-card:nth-child(2)'), async (p) => { await p.waitForSelector('.mk-dbody'); }, click('.tfbk-bc .lk'))],
  ['detail-info', seq(click('.mk-dtabs .mk-tab:nth-child(2)')), null, { hash: '#/share/s/f1' }],
  ['detail-info-hash', null, null, { hash: '#/share/s/d3/all/info' }],
  ['detail-info-back', seq(click('.mk-dtabs .mk-tab:nth-child(2)'), click('.mk-dtabs .mk-tab:nth-child(1)')), null, { hash: '#/share/s/h2' }],
  ['detail-pnl', seq(click('.mkd-pill:nth-child(2)')), null, { hash: '#/share/s/f1' }],
  ['detail-bal-month', seq(click('.mkd-pill:nth-child(3)'), click('.mkd-seg button:nth-child(2)')), null, { hash: '#/share/s/d1' }],
  ['detail-per-all', seq(select('.mkd-per', '0')), null, { hash: '#/share/s/f2' }],
  ['detail-per-7', seq(select('.mkd-per', '7')), null, { hash: '#/share/s/r3' }],
  ['detail-per-365-month', seq(select('.mkd-per', '365'), click('.mkd-seg button:nth-child(2)')), null, { hash: '#/share/s/h3' }],
  ['detail-chart-hover', seq(chartAt(0.62)), null, { hash: '#/share/s/f1' }],
  ['detail-chart-hover-edge', seq(click('.mkd-pill:nth-child(2)'), chartAt(0.99)), null, { hash: '#/share/s/d2' }],
  ['detail-term-tip', seq(hover('.mk3-kpis .mkd-term')), null, { hash: '#/share/s/f1' }],
  ['detail-cal-prev', seq(click('.cal-nav:first-child'), click('.cal-nav:first-child')), null, { hash: '#/share/s/f1', y: 500 }],
  ['detail-menu', seq(click('#mk-menu-b')), null, { hash: '#/share/s/f1' }],
  ['detail-fav-guest', seq(click('.mkd-fav')), null, { hash: '#/share/s/f1' }],
  ['detail-copy-guest', seq(click('.mk-pri')), null, { hash: '#/share/s/f1' }],
  ['detail-bt-guest', seq(click('.mk3-bt2')), null, { hash: '#/share/s/f1' }],
  ['detail-authed', seq(login, hashGo('#/share/s/f1'))],
  ['detail-fav-authed', seq(login, hashGo('#/share/s/d1'), click('.mkd-fav'), click('#mk-menu-b'))],
  ['detail-en', null, 'en', { hash: '#/share/s/f1' }],
  ['detail-bad', null, null, { hash: '#/share/s/nope' }],
  ['detail-t-route', null, null, { hash: '#/share/t/f3' }],
  /* 판단 기록, 용어 풀이, 거래 내역 */
  ['detail-chat-more', seq(click('.mkc-more')), null, { hash: '#/share/s/f1', tall: true }],
  /* 먼저 내려 놓고 누른다. 누른 뒤에 스크롤하면 모바일 메뉴 단추의 숨김이 스크롤 순서에 따라 갈린다 */
  ['detail-gloss', seq(scrollY(900), click('.mkc-list .mkg')), null, { hash: '#/share/s/f1' }],
  ['detail-gloss-d1', seq(scrollY(1000), click('.mkc-list li:nth-child(2) .mkg')), null, { hash: '#/share/s/d1' }],
  ['detail-trades', seq(click('.mko-go')), null, { hash: '#/share/s/f1' }],
  ['detail-trades-hash-tall', null, null, { hash: '#/share/s/h1/all/trades', tall: true }],
  ['detail-trades-more', seq(click('.mko-more')), null, { hash: '#/share/s/d1/all/trades', tall: true }],
  ['detail-trades-back', seq(select('.mkd-per', '90'), click('.mkd-pill:nth-child(3)'), click('.mko-go'), click('.mko-back')), null, { hash: '#/share/s/r2' }],
  /* ── 복사 흐름 ── 회원이고 주문 권한 거래소가 연결된 상태를 씨앗으로 심는다 (tools/compare-copy-seed.json). 복사 여섯 건: f1 진행 중(추가 한 번), d1 진행 중(추가와 회수), r1 포지션만 정리, h1 중단, f2 원본 청산 대기, f8 직접 관리 */
  ['copy-sheet', seq(click('.mk-pri')), null, { hash: '#/share/s/f1', ...CPS }],
  ['copy-sheet-amt', seq(click('.mk-pri'), type('#cps-amt', '700')), null, { hash: '#/share/s/f1', ...CPS }],
  ['copy-sheet-min-err', seq(click('.mk-pri'), type('#cps-amt', '100')), null, { hash: '#/share/s/f1', ...CPS }],
  ['copy-sheet-over-err', seq(click('.mk-pri'), type('#cps-amt', '99999')), null, { hash: '#/share/s/f1', ...CPS }],
  ['copy-sheet-max-loss30', seq(click('.mk-pri'), click('#mk-follow .mx'), clickText('#mk-follow .skc-pills button', '30%')), null, { hash: '#/share/s/f1', ...CPS }],
  ['copy-sheet-more', seq(click('.mk-pri'), type('#cps-amt', '800'), click('#skc-more-b'), clickText('#mk-f-ex button', '현재 포지션부터'), type('#mk-f-cap', '60'), async (p) => { await p.evaluate(() => { const b = document.querySelector('#mk-follow .skc-body'); if (b) b.scrollTop = 1e6; }); }), null, { hash: '#/share/s/f1', ...CPS }],
  ['copy-sheet-agent', seq(click('.mk-pri')), null, { hash: '#/share/s/d2', ...CPS }],
  /* 원본은 첫 화면이 복사 주소일 때 설정 창이 뜨다 말다 한다(부팅 재라우팅과 겨룸). 그래서 앱 안에서 주소로 옮겨 견준다 */
  ['copy-sheet-route', seq(hashGo('#/share/copy/h2')), null, CPS],
  ['copy-guest-route', null, null, { hash: '#/share/copy/f1' }],
  /* 거래소 연결로 잇기: 거래소 없는 회원은 거래소 연결 화면으로, 본인 확인이 안 끝났으면 확인 창을 거쳐 시작, 다 갖췄으면 바로 시작해 터미널로 */
  /* copy-kyc-done, copy-start-done 은 끝에 터미널(#/trade)이 나온다. 복사한 전략이 판단 패널, 차트 종목, 시세 출처 줄, 포지션 표에 보인다(screens/trade/term/Copy.tsx). 차트는 TradingView 실물이라 범례 배지와 오류 창이 때때로 다르게 찍힌다 */
  ['copy-noex-connect', seq(login, hashGo('#/share/s/f1'), click('.mk-pri'))],
  ['copy-kyc-gate', seq(click('.mk-pri'), type('#cps-amt', '700'), click('#cps-cta')), null, { hash: '#/share/s/f1', ...CPK }],
  ['copy-kyc-done', seq(click('.mk-pri'), type('#cps-amt', '700'), click('#cps-cta'), wait(2600)), null, { hash: '#/share/s/f1', ...CPK }],
  ['copy-start-done', seq(click('.mk-pri'), type('#cps-amt', '700'), click('#cps-cta')), null, { hash: '#/share/s/f1', ...CPS }],
  ['copy-c-f1', null, null, { hash: '#/share/c/' + CPID.f1, tall: true, ...CPS }],
  ['copy-c-f1-view', null, null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-f1-bal', null, null, { hash: '#/share/c/' + CPID.f1 + '/bal', tall: true, ...CPS }],
  ['copy-c-f1-amt-open', seq(click('.cq-amt summary')), null, { hash: '#/share/c/' + CPID.f1, tall: true, ...CPS }],
  ['copy-c-d1', null, null, { hash: '#/share/c/' + CPID.d1, tall: true, ...CPS }],
  ['copy-c-d1-bal-click', seq(clickText('.cq-tabs button', '예산 내역')), null, { hash: '#/share/c/' + CPID.d1, tall: true, ...CPS }],
  ['copy-c-r1', null, null, { hash: '#/share/c/' + CPID.r1, tall: true, ...CPS }],
  ['copy-c-h1-closed', null, null, { hash: '#/share/c/' + CPID.h1, tall: true, ...CPS }],
  ['copy-c-h1-trade-open', seq(click('.cq-det:nth-child(1) summary'), click('.cq-det:nth-child(3) summary')), null, { hash: '#/share/c/' + CPID.h1, tall: true, ...CPS }],
  ['copy-c-h1-bal', null, null, { hash: '#/share/c/' + CPID.h1 + '/bal', tall: true, ...CPS }],
  ['copy-c-f2-wait', null, null, { hash: '#/share/c/' + CPID.f2, tall: true, ...CPS }],
  ['copy-c-f8-manual', null, null, { hash: '#/share/c/' + CPID.f8, tall: true, ...CPS }],
  ['copy-c-old-tab', null, null, { hash: '#/share/c/' + CPID.f1 + '/hist', ...CPS }],
  ['copy-c-adj', seq(click('.cq-acts .cq-cta')), null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-adj-amt', seq(click('.cq-acts .cq-cta'), type('#cpa-amt', '120')), null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-adj-over', seq(click('.cq-acts .cq-cta'), type('#cpa-amt', '99999')), null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-adj-out', seq(click('.cq-acts .cq-cta'), clickText('.cpa-tgl button', '회수'), click('.cps-in .mx')), null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-adj-agent', seq(click('.cq-acts .cq-cta')), null, { hash: '#/share/c/' + CPID.d1, ...CPS }],
  ['copy-c-adj-done', seq(click('.cq-acts .cq-cta'), type('#cpa-amt', '120'), click('#cpa-go')), null, { hash: '#/share/c/' + CPID.f1, tall: true, ...CPS }],
  ['copy-c-out-done', seq(click('.cq-acts .cq-cta'), clickText('.cpa-tgl button', '회수'), type('#cpa-amt', '80'), click('#cpa-go')), null, { hash: '#/share/c/' + CPID.d1, tall: true, ...CPS }],
  ['copy-c-edit', seq(clickText('.cq-acts .pl-link', '설정')), null, { hash: '#/share/c/' + CPID.d1, ...CPS }],
  ['copy-c-stop', seq(clickText('.cq-acts .pl-link', '복사 중단')), null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-stop-nopos', seq(clickText('.cq-acts .pl-link', '복사 중단')), null, { hash: '#/share/c/' + CPID.r1, ...CPS }],
  ['copy-c-stop-wait-done', seq(clickText('.cq-acts .pl-link', '복사 중단'), clickText('.mk-stop-o', '원본 청산 대기')), null, { hash: '#/share/c/' + CPID.f1, tall: true, ...CPS }],
  ['copy-c-stop-manual-done', seq(clickText('.cq-acts .pl-link', '복사 중단'), clickText('.mk-stop-o', '직접 관리')), null, { hash: '#/share/c/' + CPID.f1, tall: true, ...CPS }],
  ['copy-c-flat', seq(click('.cq-sh .cq-gray')), null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-flat-wind', seq(click('.cq-acts .cq-cta')), null, { hash: '#/share/c/' + CPID.f2, ...CPS }],
  ['copy-c-flat-done', seq(click('.cq-sh .cq-gray'), click('#ss3-dlgw .ss3-dbtn')), null, { hash: '#/share/c/' + CPID.f1, tall: true, ...CPS }],
  ['copy-c-help', seq(click('.cq-help .pl-link')), null, { hash: '#/share/c/' + CPID.f1, ...CPS }],
  ['copy-c-en', null, 'en', { hash: '#/share/c/' + CPID.f1, tall: true, ...CPS }],
];
const VIEWPORTS = [['d1440', 1440, 900], ['m390', 390, 844]];

const b = await chromium.launch();
const rows = [];
async function shot(base, vp, st) {
  const [, w, h] = vp;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript((lang) => {
    Math.random = () => 0;
    try { if (lang) localStorage.setItem('tethLang', lang); } catch (e) { /* */ }
  }, st[2] || null);
  const o = st[3] || {};
  const isR = base === react;
  const seed = isR ? o.seedR : o.seedO;
  if (seed) await ctx.addInitScript((kv) => { try { for (const k in kv) localStorage.setItem(k, typeof kv[k] === 'string' ? kv[k] : JSON.stringify(kv[k])); } catch (e) { /* */ } }, seed);
  const p = await ctx.newPage();
  /* 날짜에 따라 달라지는 값은 두 쪽을 같은 시각에 묶는다 (타이머는 그대로 흐른다) */
  await p.clock.setFixedTime(new Date('2026-11-20T03:00:00Z'));
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const hash = (isR && o.hashR) || o.hash || '';
  await p.goto(base + hash, { waitUntil: 'load', timeout: 120000 });
  if (!hash) await p.waitForSelector('#g-home-in', { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(hash ? 3200 : 2500);
  // 원본에만 있는 시험용 QA 단추는 견줌에서 뺀다
  await p.addStyleTag({ content: '#tf-devbtn,.qa2-panel{display:none!important} *{caret-color:transparent!important}' });
  let skipped = false;
  if (st[1]) {
    try { const r = await st[1](p); if (r === null) skipped = true; } catch (e) { errs.push('동작 실패: ' + String(e).slice(0, 200)); }
    await p.waitForTimeout(900);
  }
  if (o.y != null) { await scrollY(o.y)(p); await p.waitForTimeout(500); }
  /* 긴 화면: 창을 내용 높이만큼 늘려 통째로 찍는다 (모바일은 안쪽 칸이 스크롤이라 fullPage 로는 안 잡힌다) */
  if (o.tall && !skipped) {
    const hh = await p.evaluate(() => { const s = document.getElementById('g-scroll'); return Math.max(document.documentElement.scrollHeight, s ? s.scrollHeight + s.getBoundingClientRect().top : 0); });
    await p.setViewportSize({ width: w, height: Math.min(12000, Math.max(h, hh)) });
    await p.waitForTimeout(700);
    const h2 = await p.evaluate(() => { const s = document.getElementById('g-scroll'); return Math.max(document.documentElement.scrollHeight, s ? s.scrollHeight + s.getBoundingClientRect().top : 0); });
    if (h2 > hh) { await p.setViewportSize({ width: w, height: Math.min(12000, h2) }); await p.waitForTimeout(500); }
    await scrollY(0)(p);
    /* 원본은 창 크기가 바뀌면 그래프를 다시 그리고 0.3초 뒤에 글자를 고친다(sk-detail). 통째 찍기도 창 크기를 한 번 바꾸므로, 한 번 헛찍어 그 다시 그림을 먼저 끝내 둔다 */
    await p.waitForTimeout(1600);
    await p.screenshot({ fullPage: true });
    await p.waitForTimeout(1200);
  }
  const buf = skipped ? null : await p.screenshot({ fullPage: !!o.tall });
  await ctx.close();
  return { buf, errs };
}

const cmp = await b.newPage();
async function diff(a, c) {
  return cmp.evaluate(async ([A, C]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ic] = await Promise.all([load(A), load(C)]);
    const w = ia.width, h = Math.max(ia.height, ic.height);
    const cv = document.createElement('canvas'); cv.width = w * 2 + 12; cv.height = h;
    const x = cv.getContext('2d'); x.fillStyle = '#ff2d55'; x.fillRect(0, 0, cv.width, h); x.drawImage(ia, 0, 0); x.drawImage(ic, w + 12, 0);
    const da = x.getImageData(0, 0, w, h).data, dc = x.getImageData(w + 12, 0, w, h).data;
    let n = 0; let minY = h, maxY = -1;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]) > 24) { n++; const y = Math.floor(i / 4 / w); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return { ratio: n / (w * h), minY, maxY, hA: ia.height, hC: ic.height, png: cv.toDataURL('image/png').split(',')[1] };
  }, [a.toString('base64'), c.toString('base64')]);
}

for (const st of STATES) {
  if (only.length && !only.some((n) => n === st[0] || (n.endsWith('*') && st[0].startsWith(n.slice(0, -1))))) continue;
  for (const vp of VIEWPORTS) {
    const [o, r] = await Promise.all([shot(orig, vp, st), shot(react, vp, st)]);
    if (!o.buf || !r.buf) continue;
    const d = await diff(o.buf, r.buf);
    const name = `${st[0]}-${vp[0]}`;
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(d.png, 'base64'));
    const line = `${name.padEnd(24)} 다른 픽셀 ${(d.ratio * 100).toFixed(3)}%${d.maxY >= 0 ? ` (y ${d.minY}~${d.maxY})` : ''}${d.hA !== d.hC ? ` | 높이 다름 ${d.hA} / ${d.hC}` : ''}${o.errs.length ? ' | 원본 오류 ' + o.errs.join(' / ') : ''}${r.errs.length ? ' | React 오류 ' + r.errs.join(' / ') : ''}`;
    console.log(line);
    rows.push(line);
  }
}
fs.writeFileSync(path.join(outDir, 'result.txt'), rows.join('\n') + '\n');
await b.close();
