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
const tick = (ms) => async (p) => { await p.clock.runFor(ms); };
const desktop = (f, g) => async (p) => ((p.viewportSize().width > 860 ? f : g) ? (p.viewportSize().width > 860 ? f : g)(p) : null);

/** 상태: [이름, 동작, 언어, 조건]
 *  조건(선택, 조각이 더한 것): { preset, tweak, hash, go: { orig, react }, qa, ready, scroll }
 *   preset  원본 QA 패널의 계정 시나리오 id(TF_QA_PRESETS). 원본에서 그 상태를 만들어 저장 글자를 꺼낸 뒤 두 쪽에 똑같이 심는다.
 *   tweak   프리셋 뒤에 원본 안에서 돌릴 글자(JS). 상태를 더 고칠 때.
 *   hash    두 쪽 모두 이 주소로 바로 들어간다.
 *   go      한쪽에서만 먼저 하는 동작(원본에 주소가 없는 화면은 원본만 함수로 연다).
 *   qa      window.AC_QA 에 넣을 값(결제나 승인을 실패시키기).
 *   paused  true 면 화면이 뜬 뒤 타이머를 세운다. 동작에서 tick(ms) 로 시간을 밀어 「승인 중」 같은 기다림의 중간 모습을 두 쪽 같은 때에 찍는다.
 *   조건이 있으면 시계를 FIXED 로 고정하고, 원본의 로컬 상태 서버(:8799) 요청을 끊는다. */
const FIXED = new Date('2026-11-20T03:00:00Z');
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
// 조각별 상태는 tools/states/*.mjs 에 둔다 (default export 가 (도구) => 상태 배열)
const statesDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'states');
if (fs.existsSync(statesDir))
  for (const f of fs.readdirSync(statesDir).filter((x) => x.endsWith('.mjs')).sort()) STATES.push(...(await import(path.join(statesDir, f))).default({ click, seq, type, desktop, tick }));
const VIEWPORTS = [['d1440', 1440, 900], ['m390', 390, 844]];

const b = await chromium.launch();
const rows = [];
/** 프리셋의 저장 글자(원본 STORE.snapshot)를 원본에서 한 번 만들어 둔다 */
const seeds = new Map();
async function seedOf(o) {
  if (!o.preset) return null;
  const key = o.preset + '|' + (o.tweak || '');
  if (!seeds.has(key)) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route(/:8799\//, (r) => r.abort());
    const p = await ctx.newPage();
    await p.clock.setFixedTime(FIXED);
    await p.goto(orig, { waitUntil: 'load', timeout: 120000 });
    await p.waitForFunction(() => window.TF_STATE_READY && typeof window.tfQaPreset === 'function' && window.TFC, null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    const j = await p.evaluate(([id, tweak]) => { window.tfQaPreset(id); if (tweak) (0, eval)(tweak); window.tfSave(); return JSON.stringify(window.STORE.snapshot()); }, [o.preset, o.tweak || '']);
    await ctx.close();
    seeds.set(key, j);
  }
  return seeds.get(key);
}
async function shot(base, vp, st) {
  const [, w, h] = vp;
  const o = st[3] || null;
  const isOrig = base === orig;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  if (o) {
    await ctx.route(/:8799\//, (r) => r.abort());
    const seed = await seedOf(o);
    await ctx.addInitScript(([seed, qa]) => {
      try {
        if (seed && !sessionStorage.getItem('cmp.seeded')) {
          sessionStorage.setItem('cmp.seeded', '1');
          const v = JSON.parse(seed);
          localStorage.setItem('teth.state', seed);
          localStorage.setItem('teth.react.user', JSON.stringify(v.user));
          localStorage.setItem('teth.react.tf', JSON.stringify(v.tf));
        }
      } catch (e) { /* */ }
      if (qa) window.AC_QA = qa;
    }, [seed, o.qa || null]);
  }
  await ctx.addInitScript((lang) => {
    Math.random = () => 0;
    try { if (lang) localStorage.setItem('tethLang', lang); } catch (e) { /* */ }
  }, st[2] || null);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  if (o && o.paused) await p.clock.install({ time: FIXED });
  else if (o) await p.clock.setFixedTime(FIXED);
  /* hash 는 글자면 두 쪽 같은 주소, { orig, react } 면 쪽마다 다른 주소(원본에 주소가 없는 화면을 React 주소로 바로 열 때) */
  const hash = o && o.hash ? (typeof o.hash === 'string' ? o.hash : (isOrig ? o.hash.orig : o.hash.react) || '') : '';
  await p.goto(base + hash, { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector((o && o.ready) || (hash ? '#g-root' : '#g-home-in'), { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(2500);
  // 원본에만 있는 시험용 QA 단추는 견줌에서 뺀다
  await p.addStyleTag({ content: '#tf-devbtn,.qa2-panel{display:none!important} *{caret-color:transparent!important}' });
  let skipped = false;
  if (o && o.paused) await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 200);
  if (o && o.qa) await p.evaluate((qa) => { if (window.AC_QA && window.AC_QA !== qa) Object.assign(window.AC_QA, qa); else window.AC_QA = qa; }, o.qa);
  const pre = o && o.go && (isOrig ? o.go.orig : o.go.react);
  if (pre) {
    try { if (typeof pre === 'string') await p.evaluate(pre); else await pre(p); } catch (e) { errs.push('먼저 하는 동작 실패: ' + String(e).slice(0, 200)); }
    await p.waitForTimeout(700);
  }
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
    /* 부하가 높으면 화면이 제때 안 뜰 때가 있다. 한 번 더 해 보고, 그래도 안 되면 그 상태만 실패로 적고 넘어간다 */
    let o, r;
    for (let n = 0; n < 2 && !o; n++) {
      try { [o, r] = await Promise.all([shot(orig, vp, st), shot(react, vp, st)]); } catch (e) {
        o = r = undefined;
        if (n === 1) { const line = `${`${st[0]}-${vp[0]}`.padEnd(24)} 실패: ${String(e).split('\n')[0].slice(0, 160)}`; console.log(line); rows.push(line); }
      }
    }
    if (!o || !r) continue;
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
