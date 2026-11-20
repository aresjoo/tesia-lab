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

/* ── 인사이트, 거래복기, 정기 보고 (조각 -ins) ──
   넷째 칸 opts: { hash: 바로 들어갈 주소, seed: 계정 상태(tools/fixtures/ins-seed-*.json, 원본이 localStorage 'teth.state' 에 두는 꼴),
   wait: 기다릴 선택자, clock: 고정할 시각 }. 맞춤 글 주소는 발행 날짜가 들어 있어 시각을 고정해야 만료되지 않는다. */
const INS_NOW = '2026-11-20T03:00:00Z';
const seedOf = (k) => fs.readFileSync(new URL(`./fixtures/ins-seed-${k}.json`, import.meta.url), 'utf8');
const scrollTo = (y) => async (p) => { await p.evaluate((y) => { window.scrollTo(0, y); const s = document.getElementById('g-scroll'); if (s) s.scrollTop = y; }, y); };
const ins = (hash, seed, wait = '.nfz-page') => ({ hash, seed: seed ? seedOf(seed) : null, wait, clock: INS_NOW });
const nfx = (hash, seed, wait = '.nfx-page') => ({ hash, seed: seed ? seedOf(seed) : null, wait, clock: INS_NOW });
const google = seq(click('#au-start .au-btns .au-btn:first-child'), async (p) => { await p.waitForTimeout(3200); });
const ART = '#/insight/btc-liquidity-rotation';
const RV = '#/review/rv1791162000000-';
STATES.push(
  // 손님: 목록
  ['ins-home', null, null, ins('#/insight')],
  ['ins-home-s1', scrollTo(900), null, ins('#/insight')],
  ['ins-home-s2', scrollTo(1800), null, ins('#/insight')],
  ['ins-home-s3', scrollTo(2800), null, ins('#/insight')],
  ['ins-home-end', scrollTo(1e6), null, ins('#/insight')],
  ['ins-tag', null, null, ins('#/insight/t/bitcoin')],
  ['ins-tag-end', scrollTo(1e6), null, ins('#/insight/t/bitcoin')],
  ['ins-tag-empty', null, null, ins('#/insight/t/nothing')],
  ['ins-home-en', null, 'en', ins('#/insight')],
  // 손님: 글 상세와 게이트
  ['ins-view', null, null, ins(ART)],
  ['ins-view-s1', scrollTo(800), null, ins(ART)],
  ['ins-view-s2', scrollTo(1500), null, ins(ART)],
  ['ins-view-s3', scrollTo(2300), null, ins(ART)],
  ['ins-view-end', scrollTo(1e6), null, ins(ART)],
  ['ins-view-share', click('.nfz-meta .ib'), null, ins(ART)],
  ['ins-view-share-off', seq(click('.nfz-meta .ib'), click('.nfz-a h1')), null, ins(ART)],
  ['ins-view-gate-signup', click('.nfz-gate .b1'), null, ins(ART)],
  ['ins-view-gate-login', click('.nfz-gate .lg a'), null, ins(ART)],
  ['ins-view-asset-guest', click('.nfz-ast'), null, ins(ART)],
  ['ins-view2', null, null, ins('#/insight/jpy-carry-tension')],
  ['ins-view3-s2', scrollTo(1500), null, ins('#/insight/bitcoin-miner-cashflow')],
  // 손님: 눌러서 들어가기
  ['ins-click-card', seq(click('.nfz-bigc')), null, ins('#/insight')],
  ['ins-click-topic', seq(click('.nfz-topics .tp:nth-child(2)')), null, ins('#/insight')],
  ['ins-click-back', seq(click('.nfz-back')), null, ins(ART)],
  ['ins-click-tag', seq(click('.nfz-tags .tg')), null, ins(ART)],
  ['ins-click-next', seq(click('.nfz-nc')), null, ins(ART)],
  ['ins-from-menu', desktop(seq(click('#g-gear-btn'), click('#g-setmenu .gm-item:nth-of-type(2)')), null)],
  ['ins-from-footer', seq(scrollTo(1e6), click('.gft >> text="인사이트"'))],
  ['ins-from-footer-member', seq(scrollTo(1e6), click('.gft >> text="인사이트"')), null, { seed: seedOf('B'), clock: INS_NOW }],
  ['ins-p-guest', null, null, ins('#/insight/p/a-20261120')],
  // 게이트에서 로그인하면 그 글로 돌아온다 (TF_INS_RESUME)
  ['ins-gate-resume', seq(scrollTo(1500), click('.nfz-gate .lg a'), google), null, ins(ART)],
  ['ins-gate-resume-signup', seq(click('.nfz-gate .b1'), click('#au-start .au-btns .au-btn:first-child'), async (p) => { await p.waitForTimeout(1500); }), null, ins(ART)],
  ['ins-top-login', seq(click('#g-auth-btns .ga-login'), google), null, ins(ART)],
  // 회원: 목록, 글, 상호작용
  ['ins-m-home', null, null, ins('#/insight', 'A0')],
  ['ins-m-home-fy', scrollTo(900), null, ins('#/insight', 'A')],
  ['ins-m-home-fy-b', scrollTo(900), null, ins('#/insight', 'B')],
  ['ins-m-view', null, null, ins(ART, 'B')],
  ['ins-m-view-s2', scrollTo(1500), null, ins(ART, 'B')],
  ['ins-m-view-s3', scrollTo(2300), null, ins(ART, 'B')],
  ['ins-m-view-s4', scrollTo(3100), null, ins(ART, 'B')],
  ['ins-m-view-end', scrollTo(1e6), null, ins(ART, 'B')],
  ['ins-m-view-fb', click('.nfz-fbb[data-v="2"]'), null, ins(ART, 'B')],
  /* 복사 표시는 1.4초(공유 창)와 1.6초(아래 줄) 뒤에 사라진다. 누른 뒤 더 기다리지 않고 찍고, 사라진 뒤는 따로 찍는다 */
  ['ins-m-view-copy', click('.nfz-social button[aria-label="링크 복사"]'), null, ins(ART, 'B')],
  ['ins-m-view-copy-after', seq(click('.nfz-social button[aria-label="링크 복사"]'), async (p) => { await p.waitForTimeout(1900); }), null, ins(ART, 'B')],
  ['ins-m-view-share-copy', async (p) => { await p.click('.nfz-meta .ib'); await p.waitForTimeout(350); await p.click('.nfz-shpop button:first-child'); }, null, ins(ART, 'B')],
  ['ins-m-view-share-copy-after', seq(click('.nfz-meta .ib'), click('.nfz-shpop button:first-child'), async (p) => { await p.waitForTimeout(1900); }), null, ins(ART, 'B')],
  ['ins-m-asset-dlg', click('.nfz-ast'), null, ins(ART, 'B')],
  ['ins-m-asset-typed', seq(click('.nfz-ast'), type('#nfz-astq', '최근 급등 구간의 지지선도 같이 봐줘')), null, ins(ART, 'B')],
  ['ins-m-asset-cancel', seq(click('.nfz-ast'), click('.ss3-dlg .obtn')), null, ins(ART, 'B')],
  ['ins-m-asset-esc', seq(click('.nfz-ast'), async (p) => { await p.keyboard.press('Escape'); }), null, ins(ART, 'B')],
  ['ins-m-logout', async (p) => {
    if (p.viewportSize().width <= 860) { await p.click('#g-hamburger'); await p.waitForTimeout(350); }
    await p.click(p.viewportSize().width <= 860 ? '#g-me-row' : '#g-person-row .g-ico-btn');
    await p.waitForTimeout(350);
    await p.click('#gm-logout');
  }, null, ins(ART, 'B')],
  // 회원: 맞춤 글과 이메일 미리보기
  ['ins-p-a', null, null, ins('#/insight/p/a-20261120', 'A')],
  ['ins-p-b', null, null, ins('#/insight/p/b-20261120', 'B')],
  ['ins-p-b-s1', scrollTo(900), null, ins('#/insight/p/b-20261120', 'B')],
  ['ins-p-b-end', scrollTo(1e6), null, ins('#/insight/p/b-20261120', 'B')],
  ['ins-p-c', null, null, ins('#/insight/p/c-20261120', 'C')],
  ['ins-p-stale', null, null, ins('#/insight/p/b-20261120', 'C')],
  ['ins-p-expired', null, null, ins('#/insight/p/b-20261101', 'B')],
  ['ins-p-none', null, null, ins('#/insight/p/a-20261120', 'A0')],
  ['ins-p-click-fy', seq(click('.nfz-fycard')), null, ins('#/insight', 'B')],
  ['ins-email', null, null, ins('#/insight/email', 'B')],
  ['ins-email-c', null, null, ins('#/insight/email', 'C')],
  ['ins-email-click', seq(click('.nfz-mailgate button')), null, ins('#/insight/email', 'B')],
  // 거래복기
  ['review-win', null, null, nfx(RV + '0', 'B')],
  ['review-loss', null, null, nfx(RV + '1', 'B')],
  ['review-time', null, null, nfx(RV + '2', 'B')],
  ['review-nopd', null, null, nfx(RV + '3', 'B')],
  ['review-end', scrollTo(1e6), null, nfx(RV + '1', 'B')],
  ['review-to-periodic', seq(click('.nfx-chead .nfx-btn')), null, nfx(RV + '1', 'B')],
  ['review-guest', null, null, nfx(RV + '0', null, '#g-home-in')],
  ['review-bare', null, null, nfx('#/review', 'B', '#g-home-in')],
  // 정기 보고
  ['periodic-week', null, null, nfx('#/periodic/W:2026-11-15', 'B')],
  ['periodic-month', null, null, nfx('#/periodic/M:2026-10-31', 'B')],
  ['periodic-end', scrollTo(1e6), null, nfx('#/periodic/W:2026-11-15', 'B')],
  ['periodic-empty', null, null, nfx('#/periodic/W:2026-11-15', 'D')],
  ['periodic-click-row', seq(click('.nfx-row.lk')), null, nfx('#/periodic/W:2026-11-15', 'B')],
  ['periodic-side-open', desktop(click('.g-brand-link'), click('#g-hamburger')), null, nfx('#/periodic/W:2026-11-15', 'B')],
);
const VIEWPORTS = [['d1440', 1440, 900], ['m390', 390, 844]];

const b = await chromium.launch();
const rows = [];
async function shot(base, vp, st) {
  const [, w, h] = vp;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const opt = st[3] || {};
  await ctx.addInitScript(([lang, seed]) => {
    Math.random = () => 0;
    try { if (lang) localStorage.setItem('tethLang', lang); } catch (e) { /* */ }
    /* 계정 상태: 원본은 'teth.state' 로 로그인과 상태를 되살리고, React 판은 로그인을 'teth.react.user' 에 둔다. 첫 방문에만 심는다 */
    try { if (seed && !sessionStorage.getItem('cmpSeeded')) { sessionStorage.setItem('cmpSeeded', '1'); localStorage.setItem('teth.state', seed); localStorage.setItem('teth.react.user', JSON.stringify({ name: JSON.parse(seed).user.name })); } } catch (e) { /* */ }
  }, [st[2] || null, opt.seed || null]);
  const p = await ctx.newPage();
  if (opt.clock) await p.clock.setFixedTime(new Date(opt.clock));
  /* 떠 있지 않은 로컬 대화 서버와 바깥 주소 조회는 두 쪽 다 바로 끊는다 (응답에 따라 달라지지 않게) */
  if (opt.hash) await p.route(/localhost:8799|raw\.githubusercontent\.com/, (r) => r.abort());
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.goto(base + (opt.hash || ''), { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector(opt.wait || '#g-home-in', { timeout: 60000 });
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
  if (only.length && !only.some((o) => (o.endsWith('*') ? st[0].startsWith(o.slice(0, -1)) : o === st[0]))) continue;
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
