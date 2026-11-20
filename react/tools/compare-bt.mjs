// 원본(HTML 판)과 React 판을 같은 크기, 같은 동작으로 찍어 나란히 붙이고 다른 픽셀 비율을 센다.
// 쓰는 법: node tools/compare.mjs <원본 주소> <React 주소> <결과 폴더> [상태 이름...]
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
const desktop = (f, g) => async (p) => ((p.viewportSize().width > 860 ? f : g) ? (p.viewportSize().width > 860 ? f : g)(p) : null);

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
];

/* ── 백테스트 여정과 전략 만들기 퍼널 (#/share/bt/…, #/strategy/…) ──
   넷째 칸: { hash 진입 주소, tf 퍼널 상태(회원으로 넣는다), guest 손님, wait 기다릴 선택자, ai 'ok'|'fail' 모델 응답 } */
const ev = (js) => async (p) => { await p.evaluate(js); };
const BT_GO = click('.bt-set .bt-cta');
const btScroll = (y) => ev(`document.getElementById('g-scroll').scrollTop=${y}`);
const BT_ROW = ev(`document.querySelector('#bt-dl .bt-rb').click()`);
const BT_TR = ev(`document.querySelector('#bt-tl .bt-rb').click()`);
const BT_INTO = (sel) => ev(`document.querySelector('${sel}').scrollIntoView({block:'start'})`);
const TF_MINE = { intake: { asset: { i: 0, label: '비트코인' }, style: { i: 1, label: '균형으로' }, stop: { i: 1, label: '-8%' }, period: { i: 0, label: '최근 1년' }, budget: { i: 1, label: '100만원' } }, qi: 5, tries: [], cur: null, score: 0, plan: null, cycle: 'year', ex: null, uid: null, api: null, shared: false, followers: 0, reward: 0, fills: [], strat: [], ob: { st: 'idle', ex: null, uid: '', err: null }, aiSpec: { sl: -8, tp: 20, rsiTh: 40, tf: false, fng: null, name: null }, stage: 'verify', workDone: false };
const TF_CONN = { ...TF_MINE, api: { ex: 'bitget', last4: null, oauth: true }, conn: true, uidLinked: true, uid: '8812345601', ac: { route: 'partner', ex: 'bitget', has: 'yes', g: 0, pay: { st: 'none' }, auth: { st: 'ok', ex: 'bitget' }, uid: { st: 'ok', ex: 'bitget', v: '8812345601' }, conn: { bitget: { via: 'partner', at: 1, uid: '8812345601', kyc: 'ok' } }, cards: [], bill: [], sub: null } };
const TF_VER = { at: 1794000000000, spec: { asset: '비트코인', depth: 'mid', tp: 12, sl: -8, fng: null, trend: false, period: '1y', name: null }, rule: '사는 때: 비트코인이 적당히 밀렸다가 하루 0.5% 넘게 반등한 날. 파는 때: 산 가격보다 12% 오르거나 8% 내리면, 또는 25일이 지나면', ai: { sl: -8, tp: 12, rsiTh: 44, tf: false, fng: null, name: null }, pi: 0, per: 365, amt: 1000, ret: -21.3, mdd: -36.2, n: 14, bench: -28.4, final: 787 };
const BT_PAUSE = async (p) => { await p.clock.pauseAt(new Date(Date.now() + 60000)); };
const BT_RUN = (ms) => async (p) => { await p.clock.runFor(ms); };
const bt = (id, o = {}) => ({ hash: '#/share/bt/' + id, tf: null, wait: '#bt-root', ...o });
STATES.push(
  ['bt-ready', null, null, bt('r1')],
  ['bt-ready-amt', seq(click('.bt-f:nth-of-type(2) .bt-seg button:nth-child(3)'), click('.bt-f .bt-seg button:nth-child(4)')), null, bt('r1')],
  ['bt-gloss', seq(ev(`document.querySelectorAll('.bt-fold').forEach(function(d){d.open=true})`), click('.bt-dl .mkg')), null, bt('r1')],
  ['bt-result', BT_GO, null, bt('r1')],
  ['bt-result-ai', BT_GO, null, bt('r1', { ai: 'ok' })],
  ['bt-row-open', seq(BT_GO, BT_ROW, BT_INTO('#bt-dec')), null, bt('r1')],
  ['bt-trade-open', seq(BT_GO, BT_TR, BT_INTO('#bt-trs')), null, bt('r1')],
  ['bt-months', seq(BT_GO, btScroll(1e6)), null, bt('r1')],
  ['bt-tech-open', seq(BT_GO, ev(`document.querySelector('.bt-tech').open=true`), btScroll(1e6)), null, bt('r1')],
  ['bt-all-period', seq(click('.bt-f .bt-seg button:nth-child(4)'), BT_GO, BT_INTO('#bt-dec')), null, bt('r1')],
  ['bt-sort-big', seq(click('.bt-f .bt-seg button:nth-child(4)'), BT_GO, ev(`var s=document.querySelector('.bt-sort select'); s.value='big'; s.dispatchEvent(new Event('change',{bubbles:true}))`), BT_INTO('#bt-dec')), null, bt('r1')],
  ['bt-chip-win', seq(BT_GO, ev(`document.querySelectorAll('.bt-chips button')[1].click()`), BT_INTO('#bt-trs')), null, bt('r1')],
  ['bt-mark-click', seq(BT_GO, ev(`document.querySelector('#bt-mk .bt-m').dispatchEvent(new MouseEvent('click',{bubbles:true}))`)), null, bt('r1')],
  ['bt-hover', seq(BT_GO, async (p) => { const b = await p.locator('#bt-chart').boundingBox(); await p.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.5); }), null, bt('r1')],
  ['bt-agent-ready', null, null, bt('d1')],
  ['bt-agent-result', BT_GO, null, bt('d1', { ai: 'ok' })],
  ['bt-agent-row', seq(BT_GO, BT_ROW, BT_INTO('#bt-dec')), null, bt('d1', { ai: 'ok' })],
  ['bt-agent-more', seq(BT_GO, ev(`document.querySelector('.bt-s4 .k-all').click()`), ev(`document.querySelector('#bt-dl .bt-more').click()`), btScroll(1400)), null, bt('d1')],
  ['bt-mix-result', BT_GO, null, bt('h2', { ai: 'ok' })],
  ['bt-mix-skip-row', seq(BT_GO, ev(`document.querySelector('.bt-s4 .k-skip').click()`), BT_ROW, BT_INTO('#bt-dec')), null, bt('h2')],
  ['bt-fut-ready', null, null, bt('f1')],
  ['bt-fut-result', BT_GO, null, bt('f1')],
  ['bt-fut-trade', seq(BT_GO, BT_TR, BT_INTO('#bt-trs')), null, bt('f1')],
  ['bt-fut-agent', BT_GO, null, bt('f7', { ai: 'ok' })],
  ['bt-fut-agent-row', seq(BT_GO, BT_ROW, BT_INTO('#bt-dec')), null, bt('f7')],
  ['bt-mine-ready', null, null, bt('mine', { tf: TF_MINE })],
  ['bt-mine-result', BT_GO, null, bt('mine', { tf: TF_MINE })],
  ['bt-mine-go', null, null, bt('mine/go', { tf: TF_CONN })],
  ['bt-mine-compare', seq(BT_GO, ev(`document.querySelector('.rv-det').open=true`)), null, bt('mine', { tf: { ...TF_MINE, btVers: [TF_VER] } })],
  ['bt-mine-prev', seq(BT_GO, click('.rv-cmp-acts .rv-prev:last-child')), null, bt('mine', { tf: { ...TF_MINE, btVers: [TF_VER] } })],
  ['strategy-done', seq(BT_GO, ev(`location.hash='#/strategy/done'`), async (p) => { await p.waitForSelector('.tf-donec', { timeout: 20000 }); }), null, bt('mine', { tf: { ...TF_CONN, api: { ex: 'bitget', last4: '7f3a' } } })],
  ['bt-short-period', seq(click('.bt-f .bt-seg button:nth-child(1)'), BT_GO, btScroll(1e6)), null, bt('r1')],
  ['bt-fut-mix', seq(BT_GO, BT_ROW, BT_INTO('#bt-dec')), null, bt('f5', { ai: 'ok' })],
  /* 다시 돌리는 중의 한 장면: 시계를 멈추고 같은 만큼만 흘려 두 쪽을 같은 때에 세운다 */
  ['bt-run-rule', seq(BT_PAUSE, BT_GO, BT_RUN(4200)), null, bt('r1', { motion: true, clock: true })],
  ['bt-back-ready', seq(BT_GO, click('.bt-hd .bk')), null, bt('r1')],
  ['bt-result-en', BT_GO, 'en', bt('r1')],
  ['bt-guest-mine', null, null, { hash: '#/share/bt/mine', guest: true, wait: '#g-home-in' }],
  ['strategy-backtest', null, null, { hash: '#/strategy/backtest', tf: TF_MINE, wait: '#bt-root' }],
);
const VIEWPORTS = [['d1440', 1440, 900], ['m390', 390, 844]];

const b = await chromium.launch();
const rows = [];
async function shot(base, vp, st) {
  const [, w, h] = vp;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: st[3] && st[3].motion ? 'no-preference' : 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript((lang) => {
    Math.random = () => 0;
    try { if (lang) localStorage.setItem('tethLang', lang); } catch (e) { /* */ }
  }, st[2] || null);
  const o = st[3] || null;
  if (o) {
    /* 회원 상태: 원본의 저장 키(teth.state)와 React 판의 사용자 키에 같은 값을 넣는다. 한 번만 넣어 화면이 고친 값은 남긴다 */
    if (!o.guest) await ctx.addInitScript((tf) => {
      try {
        if (sessionStorage.getItem('__seed')) return;
        sessionStorage.setItem('__seed', '1');
        localStorage.setItem('teth.state', JSON.stringify({ v: 1, savedAt: 1, user: { name: '김도현', email: 'demo@teth.ai' }, tf, sessions: [] }));
        localStorage.setItem('teth.react.user', JSON.stringify({ name: '김도현' }));
      } catch (e) { /* */ }
    }, o.tf || null);
    /* 모델 프록시와 상태 서버: 두 쪽에 같은 고정 응답 */
    const AI_TXT = '이날 가격은 60일 평균 가격보다 4.2% 아래였고 하루 만에 0.9% 반등했습니다.\n기회 가운데 조건이 맞은 날에만 진입했고 나머지 기간은 기다렸습니다.\n거래 수가 적어 한두 번의 결과가 전체 수익률을 크게 바꿉니다.';
    await ctx.route(/\/api\/|raw\.githubusercontent\.com|workers\.dev/, (r) => {
      const u = r.request().url();
      if (o.ai === 'ok' && /\/api\/ping/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' });
      if (o.ai === 'ok' && /\/api\/chat/.test(u)) {
        if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } });
        return r.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: 'data:' + JSON.stringify({ text: AI_TXT }) + '\ndata:{"done":true}\n' });
      }
      return r.abort();
    });
  }
  const p = await ctx.newPage();
  if (o && o.clock) await p.clock.install();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(base + ((o && o.hash) || ''), { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector((o && o.wait) || '#g-home-in', { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  // 원본에만 있는 시험용 QA 단추는 견줌에서 뺀다
  await p.addStyleTag({ content: '#tf-devbtn,.qa2-panel{display:none!important} *{caret-color:transparent!important}' });
  let skipped = false;
  if (st[1]) {
    try { const r = await st[1](p); if (r === null) skipped = true; } catch (e) { errs.push('동작 실패: ' + String(e).slice(0, 200)); }
    await p.waitForTimeout(900);
  }
  const buf = skipped ? null : await p.screenshot();
  await ctx.close();
  return { buf, errs };
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
    const line = `${name.padEnd(24)} 다른 픽셀 ${(d.ratio * 100).toFixed(3)}%${d.maxY >= 0 ? ` (y ${d.minY}~${d.maxY})` : ''}${o.errs.length ? ' | 원본 오류 ' + o.errs.join(' / ') : ''}${r.errs.length ? ' | React 오류 ' + r.errs.join(' / ') : ''}`;
    console.log(line);
    rows.push(line);
  }
}
fs.writeFileSync(path.join(outDir, 'result.txt'), rows.join('\n') + '\n');
await b.close();
