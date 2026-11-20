// 원본(HTML 판)과 React 판을 같은 크기, 같은 동작으로 찍어 나란히 붙이고 다른 픽셀 비율을 센다.
// 쓰는 법: node tools/compare.mjs <원본 주소> <React 주소> <결과 폴더> [상태 이름...]
// 무작위(인사말, 별)와 움직임은 두 쪽 모두 꺼서 같은 조건에서 견준다.
// 대화 상태(conv-*)는 AI 답과 시세를 tools/fixtures 의 고정 응답으로 두 쪽에 똑같이 주고, 시계를 멈춰 시각 글자를 맞춘다.
// 화면 크기 하나만 돌리려면 VP=d1440 또는 VP=m390 을 앞에 붙인다.
// 자리와 글자가 같은데 글자 가장자리만 다르게 찍히면 FLAT=1 을 붙여 본다(끝난 등장 움직임이 남긴 합성 층을 없애고 찍는다).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fix = (name) => fs.readFileSync(path.join(FIX, name), 'utf8');

const [orig, react, outDir, ...only] = process.argv.slice(2);
if (!orig || !react || !outDir) throw new Error('node tools/compare.mjs <원본> <React> <결과 폴더> [상태...]');
fs.mkdirSync(outDir, { recursive: true });

const click = (sel) => async (p) => { await p.click(sel); };
const seq = (...fs_) => async (p) => { for (const f of fs_) { await f(p); await p.waitForTimeout(350); } };
const type = (sel, text) => async (p) => { await p.fill(sel, text); };
const desktop = (f, g) => async (p) => ((p.viewportSize().width > 860 ? f : g) ? (p.viewportSize().width > 860 ? f : g)(p) : null);

/* ── 대화 상태에서 쓰는 동작 ── */
const wait = (ms) => async (p) => { await p.waitForTimeout(ms); };
const login = seq(click('#g-auth-btns .ga-login'), click('#au-start .au-btns .au-btn:first-child'), wait(3200));
/** 답이 다 들어올 때까지 기다린다: 보내기 단추가 「전송」으로 돌아오고, 뒤따르는 카드(질문 패널, 전략 카드, 빈 자리 줄이기)가 끝날 때까지 */
const settle = (tail = 2600) => async (p) => {
  for (let i = 0; i < 360; i++) {
    await p.waitForTimeout(500);
    const busy = await p.evaluate(() => { const b = document.getElementById('g-send-btn'); return !b || b.getAttribute('aria-label') !== '전송' || !!document.querySelector('.g-think,.g-status:not(.done)'); });
    if (!busy) break;
  }
  await p.waitForTimeout(tail);
};
const ask = (text) => seq(login, async (p) => { await p.fill('#g-home-in', text); await p.press('#g-home-in', 'Enter'); await p.waitForTimeout(1200); }, settle());
const sayMore = (text) => seq(async (p) => { await p.fill('#g-in', text); await p.press('#g-in', 'Enter'); await p.waitForTimeout(800); }, settle());
const dom = (js) => async (p) => { await p.evaluate(js); };
/* 모바일의 메뉴 단추는 아래로 내려가는 동안 숨는다(ham-hide). 숨어 있어도 열 수 있게 DOM 으로 누른다 */
const sideOpen = desktop(click('.g-brand-link'), seq(dom(() => { document.getElementById('g-hamburger').click(); }), wait(500)));
/** 질문 패널의 질문 넷에 첫 선택지로 답한다 */
const answerAll = seq(...[0, 1, 2, 3].map(() => click('#g-askdock .ska .ops .op')), wait(600), settle(3000));
const Q1 = '비트코인이 떨어졌을 때 사는 전략';
const Q2 = '비트코인 최근 흐름 정리해줘';
/** 이 조각이 채우는 저장 값(teth.state 의 tf)만 꺼낸다. 다른 화면이 쓰는 칸은 견주지 않는다 */
const tfProbe = (p) => p.evaluate(() => {
  try {
    const t = (JSON.parse(localStorage.getItem('teth.state') || 'null') || {}).tf || {};
    const o = {};
    for (const k of ['intake', 'qi', 'stage', 'tries', 'workDone', 'aiSpec', 'cur', 'score', 'cloneFrom', 'followId', 'pendingP']) o[k] = t[k] === undefined ? null : t[k];
    return JSON.stringify(o);
  } catch (e) { return 'ERR ' + e; }
});

/** 상태: [이름, 동작, 언어, 대화 옵션 { chat: 고정 응답 차례, net: 'ok'|'down'|'hang'|'err', probe }] */
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
  /* ── 대화와 전략 만들기 ── */
  ['conv-ask', ask(Q1), null, { chat: ['ask'] }],
  ['conv-ask-2', seq(ask(Q1), click('#g-askdock .ska .ops .op')), null, { chat: ['ask'] }],
  ['conv-ask-free', seq(ask(Q1), click('#g-askdock .ska .ops .op:last-child')), null, { chat: ['ask'] }],
  ['conv-ask-closed', seq(ask(Q1), click('#g-askdock .ska .hd .x')), null, { chat: ['ask'] }],
  ['conv-strategy', seq(ask(Q1), answerAll), null, { chat: ['ask', 'strategy'] }],
  ['conv-verify-back', seq(ask(Q1), answerAll, click('.tf-sum .tf-btn'), wait(1500), dom(() => { const e = document.querySelector('#g-sess-list .g-sess'); if (e) e.click(); }), wait(1500)), null, { chat: ['ask', 'strategy'], probe: tfProbe }],
  ['conv-market', ask(Q2), null, { chat: ['market'] }],
  ['conv-market-top', seq(ask(Q2), dom(() => { document.getElementById('g-scroll').scrollTop = 0; })), null, { chat: ['market'] }],
  ['conv-act-open', seq(ask(Q2), dom(() => { document.getElementById('g-scroll').scrollTop = 0; }), click('.g-act2 .hd'), click('.g-act2 .ar .arh:not([disabled])')), null, { chat: ['market'] }],
  ['conv-vote-down', seq(ask(Q2), click('.g-acts button[aria-label="별로입니다"]')), null, { chat: ['market'] }],
  ['conv-alert-saved', seq(ask(Q2), click('.g-nextcol .g-acbtn')), null, { chat: ['market'] }],
  ['conv-second', seq(ask(Q2), sayMore('이더리움도 같이 봐줘')), null, { chat: ['market', 'market'] }],
  ['conv-stopped', seq(login, async (p) => { await p.fill('#g-home-in', Q2); await p.press('#g-home-in', 'Enter'); await p.waitForSelector('#g-send-btn[aria-label="생성 중지"]', { timeout: 90000 }); await p.waitForTimeout(1500); }, click('#g-send-btn'), wait(1500)), null, { chat: ['market'], net: 'hang' }],
  ['conv-error', ask(Q2), null, { chat: ['market'], net: 'err' }],
  ['conv-offline', ask('오늘 시장 분위기 알려줘'), null, { net: 'down' }],
  ['conv-offline-script', ask(Q1), null, { net: 'down' }],
  ['conv-offline-pick1', seq(ask(Q1), click('#g-thread button.op'), wait(1800)), null, { net: 'down' }],
  ['conv-offline-pick2', seq(ask(Q1), click('#g-thread button.op'), wait(1800), click('#g-thread button.op'), wait(1800)), null, { net: 'down' }],
  ['conv-offline-skip', seq(ask(Q1), click('#g-thread button.x[data-skip]'), wait(1800)), null, { net: 'down' }],
  ['conv-next-click', seq(ask(Q2), click('#g-thread .g-nextq'), wait(800), settle()), null, { chat: ['market', 'market'] }],
  ['conv-error-retry', seq(ask(Q2), click('#g-thread button.rt'), wait(800), settle()), null, { chat: ['market'], net: 'err' }],
  ['conv-side', seq(ask(Q1), sideOpen), null, { chat: ['ask'] }],
  ['conv-rowmenu', seq(ask(Q1), sideOpen, click('#g-sess-list .g-sess-dots')), null, { chat: ['ask'] }],
  ['conv-rename-dlg', seq(ask(Q1), sideOpen, click('#g-sess-list .g-sess-dots'), click('#g-rowmenu button:nth-child(2)')), null, { chat: ['ask'] }],
  ['conv-delete-dlg', seq(ask(Q1), sideOpen, click('#g-sess-list .g-sess-dots'), click('#g-rowmenu button:nth-child(3)')), null, { chat: ['ask'] }],
  ['conv-pinned', seq(ask(Q1), sideOpen, click('#g-sess-list .g-sess-dots'), click('#g-rowmenu button:nth-child(1)')), null, { chat: ['ask'] }],
  ['conv-headmenu', seq(ask(Q1), click('#g-chead-dots')), null, { chat: ['ask'] }],
  ['conv-headmenu-rename', seq(ask(Q1), click('#g-chead-dots'), click('#g-sess-items .gsm-it')), null, { chat: ['ask'] }],
  ['conv-title-edit', seq(ask(Q1), dom(() => { const e = document.querySelector('.g-title-edit'); if (e) e.click(); })), null, { chat: ['ask'] }],
  ['conv-history', seq(ask(Q1), sideOpen, click('#g-side .g-util:not([id])'), wait(600)), null, { chat: ['ask'] }],
  ['conv-guest-pending', seq(async (p) => { await p.fill('#g-home-in', Q1); await p.press('#g-home-in', 'Enter'); await p.waitForTimeout(900); }, click('#au-start .au-btns .au-btn:first-child'), wait(3800), settle()), null, { chat: ['ask'] }],
  ['conv-guest-modal', async (p) => { await p.fill('#g-home-in', Q1); await p.press('#g-home-in', 'Enter'); await p.waitForTimeout(900); }, null, { chat: ['ask'] }],
  ['conv-uedit', seq(ask(Q2), dom(() => { document.getElementById('g-scroll').scrollTop = 0; }), dom(() => { document.querySelector('.g-uacts button[aria-label="수정"]').click(); })), null, { chat: ['market'] }],
  ['conv-newchat', seq(ask(Q1), dom(() => { document.querySelector('#g-side .g-new').click(); }), wait(900)), null, { chat: ['ask'] }],
  ['conv-logout', seq(ask(Q1), sideOpen, dom(() => { document.getElementById('gm-logout').click(); }), wait(1500)), null, { chat: ['ask'] }],
  ['conv-reload', seq(ask(Q1), wait(1500), async (p) => { await p.reload({ waitUntil: 'load' }); await p.waitForSelector('#g-in', { state: 'attached', timeout: 60000 }); await p.waitForTimeout(4500); await p.addStyleTag({ content: '#tf-devbtn,.qa2-panel{display:none!important} *{caret-color:transparent!important}' }); }), null, { chat: ['ask'] }],
];
const VIEWPORTS = [['d1440', 1440, 900], ['m390', 390, 844]].filter((v) => !process.env.VP || process.env.VP === v[0]);

/** 대화 상태의 망 흉내: AI 프록시, 시세, 차트 위젯을 두 쪽에 똑같이 준다 */
async function mockNet(ctx, o) {
  const net = o.net || 'ok';
  let n = 0;
  const seqs = o.chat || [];
  await ctx.route('**/api/ping', (r) => (net === 'down' ? r.abort() : r.fulfill({ json: { ok: true } })));
  await ctx.route('**/api/state**', (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ json: { ok: true } })));
  await ctx.route('**/api/chat', (r) => {
    if (net === 'down') return r.abort();
    if (net === 'err') return r.fulfill({ status: 500, body: '' });
    if (net === 'hang') return undefined; /* 답을 주지 않는다: 받는 중에 멈춘 상태를 만든다 */
    return r.fulfill({ status: 200, contentType: 'text/event-stream', body: fix('chat-' + seqs[Math.min(n++, seqs.length - 1)] + '.sse') });
  });
  await ctx.route('**/api/v3/klines**', (r) => r.fulfill({ contentType: 'application/json', body: fix('klines-btc-1d.json') }));
  await ctx.route('**/api/ohlc**', (r) => r.fulfill({ status: 500, body: '' }));
  await ctx.route('**/PROXY_URL**', (r) => r.abort());
  /* 차트 위젯은 빈 껍데기로: 바깥 iframe 은 견줌 대상이 아니다 */
  await ctx.route('https://s3.tradingview.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.TradingView={widget:function(){}};' }));
  /* React 판이 아직 옮기지 않은 화면으로 떠나려 하면 그 자리에 머문다 */
  await ctx.route('https://aresjoo.github.io/**', (r) => r.fulfill({ status: 204, body: '' }));
}

const b = await chromium.launch();
const rows = [];
async function shot(base, vp, st) {
  const [, w, h] = vp;
  const conv = st[3] || null;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1, ...(conv ? { timezoneId: 'Asia/Seoul' } : {}) });
  if (conv) await mockNet(ctx, conv);
  await ctx.addInitScript((lang) => {
    Math.random = () => 0;
    try { if (lang) localStorage.setItem('tethLang', lang); } catch (e) { /* */ }
  }, st[2] || null);
  const p = await ctx.newPage();
  if (conv) await p.clock.setFixedTime(new Date('2026-11-20T07:24:00Z')); /* 16:24 KST. 타이머는 그대로 흐른다 */
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(base, { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('#g-home-in', { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  // 원본에만 있는 시험용 QA 단추는 견줌에서 뺀다
  await p.addStyleTag({ content: '#tf-devbtn,.qa2-panel{display:none!important} *{caret-color:transparent!important}' });
  let skipped = false;
  if (st[1]) {
    try { const r = await st[1](p); if (r === null) skipped = true; } catch (e) { errs.push('동작 실패: ' + String(e).slice(0, 200)); }
    await p.waitForTimeout(900);
  }
  /* 진단용(FLAT=1): 끝난 등장 움직임이 남긴 합성 층을 없애고 찍는다. 자리와 글자가 같은데 픽셀만 다를 때 원인을 가린다 */
  if (process.env.FLAT) { await p.addStyleTag({ content: '#g-content *{animation:none!important}' }); await p.waitForTimeout(400); }
  const buf = skipped ? null : await p.screenshot();
  let probe = null;
  if (conv && conv.probe) { try { probe = await conv.probe(p); } catch (e) { probe = 'ERR ' + e; } }
  await ctx.close();
  return { buf, errs, probe };
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
    const [o, r] = await Promise.all([shot(orig, vp, st), shot(react, vp, st)]);
    if (!o.buf || !r.buf) continue;
    const d = await diff(o.buf, r.buf);
    const name = `${st[0]}-${vp[0]}`;
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(d.png, 'base64'));
    const store = o.probe == null && r.probe == null ? '' : o.probe === r.probe ? ' | 저장 값(tf) 같음' : ` | 저장 값(tf) 다름\n  원본 ${o.probe}\n  React ${r.probe}`;
    const line = `${name.padEnd(24)} 다른 픽셀 ${(d.ratio * 100).toFixed(3)}%${d.maxY >= 0 ? ` (y ${d.minY}~${d.maxY})` : ''}${store}${o.errs.length ? ' | 원본 오류 ' + o.errs.join(' / ') : ''}${r.errs.length ? ' | React 오류 ' + r.errs.join(' / ') : ''}`;
    console.log(line);
    rows.push(line);
  }
}
fs.writeFileSync(path.join(outDir, 'result.txt'), rows.join('\n') + '\n');
await b.close();
