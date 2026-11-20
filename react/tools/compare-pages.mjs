// 독립 페이지(소개, 앱 다운로드, 약관)를 원본과 React 판에서 같은 크기, 같은 동작으로 찍어 나란히 붙이고 다른 픽셀 비율을 센다.
// tools/compare.mjs 와 같은 방식이고(Math.random=0, reducedMotion, 임계 24), 앱 화면이 아니라 문서 셋을 본다.
// 쓰는 법: node tools/compare-pages.mjs <원본 최상위 주소> <React 주소> <결과 폴더> [상태 이름...]
//   예) node tools/compare-pages.mjs http://127.0.0.1:8791/ http://127.0.0.1:5879/ /tmp/pages-out
//   배포 모양(react-about.html 식)을 견줄 때는 REACT_PREFIX=react- 를 준다.
// 긴 문서는 전체 높이로 찍고(full), 스크롤과 눌러서 가는 상태는 화면 크기로 찍는다.
// 픽셀 말고도 DOM 짜임(태그, id, class, 글, 링크가 가는 곳)을 줄 단위로 견줘 다른 줄 수를 같이 낸다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from '@playwright/test';

const [origArg, reactArg, outDir, ...only] = process.argv.slice(2);
if (!origArg || !reactArg || !outDir) throw new Error('node tools/compare-pages.mjs <원본 최상위> <React> <결과 폴더> [상태...]');
const slash = (u) => (u.endsWith('/') ? u : u + '/');
const orig = slash(origArg);
const react = slash(reactArg);
const prefix = process.env.REACT_PREFIX || '';
fs.mkdirSync(outDir, { recursive: true });

/** QR 그림은 바깥 서버(api.qrserver.com)가 주므로 두 쪽에 같은 고정 그림을 준다 (29x29 흑백 무늬) */
function fixedPng() {
  const n = 29;
  const raw = Buffer.alloc((n + 1) * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) raw[y * (n + 1) + 1 + x] = (x * 7 + y * 13 + ((x * y) % 5)) % 3 ? 0 : 255;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // 깊이 8, 회색(0)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const QR_PNG = fixedPng();

/**
 * Google Fonts 는 한 번만 받아 두 쪽에 같은 바이트를 준다. 문서마다 글자 범위 조각 수십 개를 받는데,
 * 부하가 높을 때 조각 하나가 실패하면 그 글자들만 대체 글꼴로 찍혀 한쪽만 글자마다 몇 픽셀씩 어긋난다.
 */
const fontCache = new Map();
async function cachedFont(route) {
  const url = route.request().url();
  if (!fontCache.has(url)) {
    fontCache.set(url, (async () => {
      for (let i = 0; i < 4; i++) {
        try {
          const r = await route.fetch();
          if (r.ok()) return { status: 200, headers: { 'content-type': r.headers()['content-type'] || 'application/octet-stream', 'access-control-allow-origin': '*' }, body: await r.body() };
        } catch (e) { /* 다시 받는다 */ }
      }
      return null;
    })());
  }
  const hit = await fontCache.get(url);
  if (hit) return route.fulfill(hit);
  fontCache.delete(url);
  return route.abort();
}

const click = (sel) => async (p) => { await p.click(sel); };
const seq = (...fs_) => async (p) => { for (const f of fs_) { await f(p); await p.waitForTimeout(350); } };
const scrollTo = (y) => async (p) => { await p.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); };
/** 부드럽게 굴러가는 스크롤이 멈출 때까지 기다린다 */
const settle = async (p) => {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const y = await p.evaluate(() => Math.round(window.scrollY));
    if (y === last) return;
    last = y;
    await p.waitForTimeout(150);
  }
};
/**
 * 웹 글꼴을 문서의 글자 전부에 대해 미리 불러 둔다. Noto Sans KR 은 글자 범위별 조각을 그 글자가 처음 그려질 때 받으므로,
 * 기다리지 않으면 한쪽만 대체 글꼴로 찍혀 글자마다 몇 픽셀씩 어긋난다.
 */
const fontsSettled = (p) => p.evaluate(async () => {
  const text = document.body.textContent || '';
  const fams = [...new Set([...document.fonts].map((f) => f.family.replace(/["']/g, '')))];
  await Promise.all(fams.flatMap((fam) => [300, 400, 500, 600, 700].map((w) => document.fonts.load(`${w} 16px "${fam}"`, text).catch(() => null))));
  await document.fonts.ready;
});
const key = (k) => async (p) => { await p.keyboard.press(k); };
const focus = (sel) => async (p) => { await p.focus(sel); };

/**
 * 상태: { n 이름, pg 문서, hash, act 동작, lang 언어, view 화면 크기로만 찍기, pc PC 에서만(모바일은 그 부품이 숨겨짐), motion 움직임 켜기, clock 가짜 시계로 흘릴 ms }
 */
const STATES = [
  // 소개
  { n: 'about', pg: 'about' },
  { n: 'about-scroll-1200', pg: 'about', act: scrollTo(1200), view: true },
  { n: 'about-pricing-link', pg: 'about', act: seq(click('.ab-acts .ab-link'), settle), view: true },
  { n: 'about-faq-first', pg: 'about', act: click('.ab-faq details:nth-of-type(1) summary'), view: true },
  { n: 'about-faq-all', pg: 'about', act: async (p) => { for (const s of await p.$$('.ab-faq summary')) await s.click(); } },
  { n: 'about-faq-toggle', pg: 'about', act: seq(click('.ab-faq details:nth-of-type(3) summary'), click('.ab-faq details:nth-of-type(7) summary'), click('.ab-faq details:nth-of-type(3) summary')), view: true },
  { n: 'about-help', pg: 'about', act: click('#teth-help'), view: true, pc: true },
  { n: 'about-footer-help', pg: 'about', act: seq(scrollTo(1e6), click('.gft-col button')), view: true, pc: true },
  { n: 'about-en', pg: 'about', lang: 'en' },
  { n: 'about-ja-top', pg: 'about', lang: 'ja', view: true },
  { n: 'about-fr-top', pg: 'about', lang: 'fr', view: true },
  // 앱 다운로드
  { n: 'download', pg: 'download' },
  { n: 'download-tab2', pg: 'download', act: click('#tabs button:nth-child(2)') },
  { n: 'download-tab3', pg: 'download', act: click('#tabs button:nth-child(3)') },
  { n: 'download-tab-back', pg: 'download', act: seq(click('#tabs button:nth-child(3)'), click('#tabs button:nth-child(1)')) },
  { n: 'download-key-left', pg: 'download', act: seq(focus('#tabs button:nth-child(1)'), key('ArrowLeft')) },
  { n: 'download-key-right2', pg: 'download', act: seq(focus('#tabs button:nth-child(1)'), key('ArrowRight'), key('ArrowRight')) },
  { n: 'download-auto-6s', pg: 'download', motion: true, clock: 6100 },
  { n: 'download-auto-13s', pg: 'download', motion: true, clock: 12200 },
  { n: 'download-auto-stop', pg: 'download', motion: true, act: click('#tabs button:nth-child(3)'), clock: 12200 },
  { n: 'download-en', pg: 'download', lang: 'en' },
  { n: 'download-zh-CN', pg: 'download', lang: 'zh-CN' },
  // 약관
  { n: 'policies', pg: 'policies' },
  { n: 'policies-privacy', pg: 'policies', hash: '#privacy' },
  { n: 'policies-terms', pg: 'policies', hash: '#terms' },
  { n: 'policies-technologies', pg: 'policies', hash: '#technologies' },
  { n: 'policies-faq', pg: 'policies', hash: '#faq' },
  { n: 'policies-bad-hash', pg: 'policies', hash: '#nope', view: true },
  { n: 'policies-click-terms', pg: 'policies', act: click('#tabs a[data-v=terms]') },
  { n: 'policies-card-link', pg: 'policies', act: click('.ov a.lnk[href="#technologies"]') },
  { n: 'policies-faq-link', pg: 'policies', hash: '#faq', act: click('.faqv a[href="#technologies"]'), view: true },
  { n: 'policies-toc-click', pg: 'policies', hash: '#privacy', act: seq(click('.view.on .toc a[data-t=p-secure]'), settle), view: true, pc: true },
  { n: 'policies-toc-last', pg: 'policies', hash: '#terms', act: seq(click('.view.on .toc a[data-t=t-about]'), settle), view: true, pc: true },
  { n: 'policies-spy-1400', pg: 'policies', hash: '#privacy', act: scrollTo(1400), view: true },
  { n: 'policies-spy-tech-500', pg: 'policies', hash: '#technologies', act: scrollTo(500), view: true },
  { n: 'policies-terms-inlink', pg: 'policies', hash: '#terms', act: seq(click('.docmain a[data-t=t-about]'), settle), view: true },
  { n: 'policies-back-reset', pg: 'policies', hash: '#privacy', act: seq(scrollTo(1400), scrollTo(0), click('#tabs a[data-v=faq]'), click('#tabs a[data-v=privacy]')), view: true },
  { n: 'policies-help', pg: 'policies', hash: '#faq', act: click('#teth-help'), view: true, pc: true },
  { n: 'policies-en', pg: 'policies', hash: '#terms', lang: 'en' },
];
const VIEWPORTS = [['d1440', 1440, 900], ['m390', 390, 844]];

const b = await chromium.launch();

/** DOM 짜임을 줄로 낸다: 태그#id.class [상태 속성] 과 글. 링크가 가는 곳은 두 판의 주소 모양 차이를 지운 이름(APP, ABOUT...)으로 바꿔 견준다. */
function dumpDom([origBase, reactBase, pre, isReact]) {
  const canon = (a) => {
    const raw = a.getAttribute('href') || '';
    if (raw.startsWith('#')) return raw;
    let u = a.href;
    const [body, hash = ''] = u.split('#');
    const h = hash ? '#' + hash : '';
    if (/policies\/teth-crs\.pdf$/.test(body)) return 'CRS';
    const base = isReact ? reactBase : origBase;
    if (!body.startsWith(base)) return u;
    const rest = body.slice(base.length);
    const map = isReact
      ? { '': 'APP', 'index.html': 'APP', [pre + '.html']: 'APP', 'react.html': 'APP', [pre + 'about.html']: 'ABOUT', [pre + 'download.html']: 'DOWNLOAD', [pre + 'policies.html']: 'POLICIES' }
      : { '': 'APP', 'index.html': 'APP', 'about/': 'ABOUT', 'download/': 'DOWNLOAD', 'policies/': 'POLICIES' };
    return rest in map ? map[rest] + h : u;
  };
  const KEEP = ['role', 'aria-selected', 'aria-current', 'aria-label', 'aria-hidden', 'tabindex', 'target', 'rel', 'alt', 'width', 'height', 'loading', 'viewBox', 'd', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'fill', 'stroke', 'type', 'data-i', 'data-v', 'data-t', 'data-toc', 'data-store'];
  const lines = [];
  const walk = (node, depth) => {
    if (node.nodeType === 3) {
      const t = node.data.replace(/\s+/g, ' ').trim();
      if (t) lines.push(' '.repeat(depth) + '"' + t + '"');
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'vite-error-overlay') return;
    if (node.id === 'root') return void [...node.childNodes].forEach((c) => walk(c, depth));
    let s = tag + (node.id ? '#' + node.id : '') + [...node.classList].sort().map((c) => '.' + c).join('');
    // 소개의 숨긴 별 배경 캔버스(#stars)는 원본 스크립트가 크기 속성을 넣지만 hidden 이라 그리지 않는다. React 판은 자리만 두므로 크기 속성은 견주지 않는다.
    for (const k of KEEP) if (node.hasAttribute(k) && !(node.id === 'stars' && (k === 'width' || k === 'height'))) s += ` ${k}=${node.getAttribute(k)}`;
    if (node.hasAttribute('hidden')) s += ' hidden';
    if (tag === 'details' && node.open) s += ' open';
    if (tag === 'a') s += ' ->' + canon(node);
    if (tag === 'img') s += ' src=' + node.src.replace(/^https?:\/\/[^/]+\//, '/').replace(/^.*\/assets\//, 'assets/');
    // 인라인 style 은 브라우저가 읽은 값으로 견준다(원본의 'margin-top:0' 과 React 가 넣는 '0px' 는 같은 값이다)
    if (node.getAttribute('style')) s += ' style=' + node.style.cssText;
    lines.push(' '.repeat(depth) + s);
    [...node.childNodes].forEach((c) => walk(c, depth + 1));
  };
  [...document.body.childNodes].forEach((c) => walk(c, 0));
  return { lines, lang: document.documentElement.lang, title: document.title, text: document.body.innerText, scrollY: Math.round(window.scrollY), height: document.documentElement.scrollHeight };
}

async function shot(isReact, vp, st) {
  const [, w, h] = vp;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: st.motion ? 'no-preference' : 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript((lang) => {
    Math.random = () => 0;
    try { if (lang) localStorage.setItem('tethLang', lang); } catch (e) { /* */ }
  }, st.lang || null);
  const p = await ctx.newPage();
  const errs = [];
  const qr = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)));
  await p.route('**/api.qrserver.com/**', (r) => { qr.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'image/png', body: QR_PNG }); });
  await p.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, cachedFont);
  p.on('requestfailed', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) errs.push('글꼴 못 받음 ' + r.url().slice(-40)); });
  if (st.clock) await p.clock.install();
  const url = isReact ? `${react}${prefix}${st.pg}.html${st.hash || ''}` : `${orig}${st.pg}/${st.hash || ''}`;
  await p.goto(url, { waitUntil: 'load', timeout: 120000 });
  await p.waitForSelector('footer.gft', { timeout: 60000 });
  await fontsSettled(p);
  if (!st.clock) {
    // 늦게 읽는 그림(loading=lazy)을 모두 불러 둔다: 끝까지 굴렸다가 맨 위로 돌아온다
    await p.evaluate(async () => {
      const step = window.innerHeight;
      // 자리마다 그림 두 장(rAF)을 기다린다: 화면에 들어온 것을 보는 관찰자(IntersectionObserver)가 그 자리에서 한 번은 돌게
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo({ top: y, behavior: 'instant' }); await frame(); await new Promise((r) => setTimeout(r, 40)); }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  await p.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }); })));
  await p.waitForTimeout(st.clock ? 300 : 1200);
  await p.addStyleTag({ content: '*{caret-color:transparent!important}' });
  if (st.act) {
    try { await st.act(p); } catch (e) { errs.push('동작 실패: ' + String(e).slice(0, 200)); }
  }
  if (st.clock) { await p.clock.runFor(st.clock); }
  await p.waitForTimeout(900);
  const dom = await p.evaluate(dumpDom, [orig, react, prefix, isReact]);
  // 부하가 높으면 줄여 그린 그림이나 글꼴이 늦게 자리 잡는다. 이어 찍은 두 장이 같아질 때까지 다시 찍는다.
  await fontsSettled(p);
  let buf = await p.screenshot({ fullPage: !st.view });
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(500);
    const again = await p.screenshot({ fullPage: !st.view });
    const same = again.equals(buf);
    buf = again;
    if (same) break;
  }
  await ctx.close();
  return { buf, errs: [...new Set(errs)], dom, qr };
}

const cmp = await b.newPage();
async function diff(a, c) {
  return cmp.evaluate(async ([A, C]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ic] = await Promise.all([load(A), load(C)]);
    const w = Math.max(ia.width, ic.width), h = Math.max(ia.height, ic.height);
    const cv = document.createElement('canvas'); cv.width = w * 2 + 12; cv.height = h;
    const x = cv.getContext('2d'); x.fillStyle = '#ff2d55'; x.fillRect(0, 0, cv.width, h); x.drawImage(ia, 0, 0); x.drawImage(ic, w + 12, 0);
    // 높이가 다르면 모자란 쪽은 서로 다른 색으로 채워 다른 픽셀로 센다
    if (ia.height < h) { x.fillStyle = '#00ff00'; x.fillRect(0, ia.height, w, h - ia.height); }
    const da = x.getImageData(0, 0, w, h).data, dc = x.getImageData(w + 12, 0, w, h).data;
    let n = 0; let minY = h, maxY = -1;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]) > 24) { n++; const y = Math.floor(i / 4 / w); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    return { ratio: n / (w * h), minY, maxY, ha: ia.height, hc: ic.height, png: cv.toDataURL('image/png').split(',')[1] };
  }, [a.toString('base64'), c.toString('base64')]);
}

/** 줄 단위로 다른 곳을 센다 (같은 자리 비교. 길이가 다르면 남는 줄도 센다) */
function domDiff(o, r) {
  const out = [];
  const n = Math.max(o.lines.length, r.lines.length);
  for (let i = 0; i < n; i++) if (o.lines[i] !== r.lines[i]) out.push(`${i + 1}\n  원본  ${o.lines[i] ?? '(없음)'}\n  React ${r.lines[i] ?? '(없음)'}`);
  for (const k of ['lang', 'title', 'scrollY', 'height', 'text']) if (o[k] !== r[k]) out.push(k === 'text' ? '보이는 글(innerText)이 다르다' : `${k}\n  원본  ${o[k]}\n  React ${r[k]}`);
  return out;
}

const rows = [];
for (const st of STATES) {
  if (only.length && !only.includes(st.n) && !only.includes(st.pg)) continue;
  for (const vp of VIEWPORTS) {
    if (st.pc && vp[1] <= 860) continue;
    const [o, r] = await Promise.all([shot(false, vp, st), shot(true, vp, st)]);
    const d = await diff(o.buf, r.buf);
    const name = `${st.n}-${vp[0]}`;
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(d.png, 'base64'));
    const dd = domDiff(o.dom, r.dom);
    if (o.qr.join('\n') !== r.qr.join('\n')) dd.push(`QR 주소\n  원본  ${o.qr.join(' ')}\n  React ${r.qr.join(' ')}`);
    const domFile = path.join(outDir, name + '.dom.txt');
    if (dd.length) fs.writeFileSync(domFile, dd.join('\n') + '\n');
    else fs.rmSync(domFile, { force: true });
    const line = `${name.padEnd(30)} 다른 픽셀 ${(d.ratio * 100).toFixed(3)}%${d.maxY >= 0 ? ` (y ${d.minY}~${d.maxY})` : ''} | 높이 ${d.ha}/${d.hc} | DOM 다른 줄 ${dd.length}/${o.dom.lines.length}${o.errs.length ? ' | 원본 오류 ' + o.errs.join(' / ') : ''}${r.errs.length ? ' | React 오류 ' + r.errs.join(' / ') : ''}`;
    console.log(line);
    rows.push(line);
  }
}
fs.writeFileSync(path.join(outDir, only.length ? 'result-part.txt' : 'result.txt'), rows.join('\n') + '\n');
await b.close();
