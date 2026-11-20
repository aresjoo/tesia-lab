// 원본 index.html(정본)에서 CSS 와 데이터 표를 그대로 꺼내 React 판의 생성 파일을 만든다.
// 원본이 바뀌면 `node tools/extract-from-html.mjs` 한 번으로 다시 맞춘다.
// 생성 파일(src/styles/*.css, src/core/*.data.ts)은 손으로 고치지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.resolve(here, '../src');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/^﻿/, '');

// 1. <style> 세 덩어리
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
if (styles.length !== 3) throw new Error(`style 블록이 ${styles.length}개다 (3개여야 한다)`);
const fixUrl = (css) => css.replace(/url\((['"]?)assets\//g, 'url($1/assets/');
const banner = '/* 생성 파일: tools/extract-from-html.mjs 가 원본 index.html 에서 그대로 꺼낸다. 손으로 고치지 않는다. */\n';
fs.writeFileSync(path.join(out, 'styles/logo.css'), banner + fixUrl(styles[0]));
fs.writeFileSync(path.join(out, 'styles/app.css'), banner + fixUrl(styles[1]));
fs.writeFileSync(path.join(out, 'styles/rd.css'), banner + fixUrl(styles[2]));

// 2. 인라인 스크립트 전체(데이터 표를 찾는 곳)
const scripts = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

/** `var NAME=` 뒤의 리터럴(객체나 배열)을 괄호 짝으로 잘라 온다. */
function literal(src, name) {
  const m = new RegExp(`(?:^|\\n)\\s*var\\s+${name}\\s*=\\s*`).exec(src);
  if (!m) throw new Error(`${name} 을 찾지 못했다`);
  let i = m.index + m[0].length;
  const start = i;
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2) + 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${name} 의 끝을 찾지 못했다`);
}
const evalLit = (src, name) => vm.runInNewContext(`(${literal(src, name)})`);
const ts = (name, type, value) => `export const ${name}: ${type} = ${JSON.stringify(value, null, 1)};\n`;

const I18N = evalLit(scripts, 'I18N');
const GREETS_ALL = evalLit(scripts, 'GREETS_ALL');
const PH_ROT = evalLit(scripts, 'PH_ROT');
const GLC_LANGS = evalLit(scripts, 'GLC_LANGS');
const GLC_CURS = evalLit(scripts, 'GLC_CURS');
const TF_TPL_ACTS = evalLit(scripts, 'TF_TPL_ACTS');
const TF_TPL_ASSETS = evalLit(scripts, 'TF_TPL_ASSETS');

fs.writeFileSync(
  path.join(out, 'core/i18n.data.ts'),
  banner +
    `export type Dict = Record<string, Record<string, string>>;\n` +
    ts('I18N', 'Dict', I18N) +
    ts('GREETS_ALL', 'Record<string, { h: string; s?: string }[]>', GREETS_ALL) +
    ts('PH_ROT', '{ prefix: Record<string, string>; prefixM: Record<string, string>; list: Record<string, string[]> }', PH_ROT) +
    ts('GLC_LANGS', '{ c: string; n: string }[]', GLC_LANGS) +
    ts('GLC_CURS', '{ c: string; s: string; r: number }[]', GLC_CURS),
);
fs.writeFileSync(
  path.join(out, 'core/templates.data.ts'),
  banner +
    `export type TplAct = { id: string; lb: string; brand?: number; q0: string; q: string; frag: string; frag0: string; more: string; bdg?: string };\n` +
    `export type TplAsset = { id: string; lb: string; img: string; bg: string; inv?: number; bdg?: string };\n` +
    ts('TF_TPL_ACTS', 'TplAct[]', TF_TPL_ACTS) +
    ts('TF_TPL_ASSETS', 'TplAsset[]', TF_TPL_ASSETS),
);

// 3. 푸터와 고객지원 버튼의 CSS (각 스크립트 안의 문자열)
const footerJs = fs.readFileSync(path.join(root, 'site-footer.js'), 'utf8');
fs.writeFileSync(path.join(out, 'styles/footer.css'), banner + evalLit(footerJs.replace(/var CSS\s*=\s*/, 'var CSS=[') .replace(/";\n\s*var WM/, '"];\n  var WM'), 'CSS')[0]);
const helpJs = fs.readFileSync(path.join(root, 'help-widget.js'), 'utf8');
const helpCss = /var css = ''\+([\s\S]*?);\n\s*var st =/.exec(helpJs);
if (!helpCss) throw new Error('help-widget.js 의 css 를 찾지 못했다');
fs.writeFileSync(path.join(out, 'styles/help.css'), banner + vm.runInNewContext(`''+${helpCss[1].replace(/\/\*[\s\S]*?\*\//g, '')}`));

// 4. 독립 페이지(소개, 앱 다운로드, 약관). 저마다 자기 CSS 를 가진 문서라 앱 CSS 와 섞지 않고 src/pages/<이름>/ 에 따로 꺼낸다.
//    문구 표(PI)는 원본이 실제로 쓰는 키(data-i 가 붙은 요소와 스크립트가 PI.<키> 로 읽는 것)만 꺼낸다.
const PAGE_NAMES = ['about', 'download', 'policies'];
const pageBanner = (name) => `/* 생성 파일: tools/extract-from-html.mjs 가 원본 ${name}/index.html 의 <style> 에서 그대로 꺼낸다. 손으로 고치지 않는다. */\n`;
const pagePi = {};
let pageLangs = null;
const pageCss = [];
for (const name of PAGE_NAMES) {
  const doc = fs.readFileSync(path.join(root, name, 'index.html'), 'utf8').replace(/^﻿/, '');
  const dir = path.join(out, 'pages', name);
  fs.mkdirSync(dir, { recursive: true });
  // <style> 은 문서 순서대로: 첫 덩어리는 page.css, id 가 있으면 그 id 가 파일 이름이다(소개의 sk-sub)
  [...doc.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)].forEach((m, i) => {
    const id = /\bid="([^"]+)"/.exec(m[1]);
    const file = `${id ? id[1] : i ? 'page' + (i + 1) : 'page'}.css`;
    fs.writeFileSync(path.join(dir, file), pageBanner(name) + m[2]);
    pageCss.push(`${name}/${file}`);
  });
  const js = [...doc.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
  if (!/\bvar\s+PI\s*=/.test(js)) continue; // 약관 문서는 문구 표가 없다(한국어 한 가지)
  const PI = evalLit(js, 'PI');
  const langs = evalLit(js, 'PLANGS');
  if (pageLangs && pageLangs.join() !== langs.join()) throw new Error(`${name} 의 PLANGS 가 다른 페이지와 다르다`);
  pageLangs = langs;
  const keys = new Set([...doc.matchAll(/\bdata-i="([^"]+)"/g)].map((m) => m[1]));
  for (const m of js.matchAll(/\bPI\.(\w+)/g)) keys.add(m[1]);
  pagePi[name] = Object.fromEntries([...keys].filter((k) => PI[k]).map((k) => [k, PI[k]]));
}
fs.mkdirSync(path.join(out, 'core/pages'), { recursive: true });
fs.writeFileSync(
  path.join(out, 'core/pages/pi.data.ts'),
  '/* 생성 파일: tools/extract-from-html.mjs 가 원본 about/index.html, download/index.html 의 PI 표에서 그대로 꺼낸다. 손으로 고치지 않는다. */\n' +
    `/** 값 순서는 PAGE_LANGS 와 같다 */\nexport type PageText = Record<string, string[]>;\n` +
    ts('PAGE_LANGS', 'string[]', pageLangs) +
    Object.keys(pagePi).map((name) => ts(`${name.toUpperCase()}_PI`, 'PageText', pagePi[name])).join(''),
);

// 5. site-config.js (스토어 주소, 요금제 표, SNS 주소)
const siteCfgBox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'site-config.js'), 'utf8'), siteCfgBox);
fs.writeFileSync(
  path.join(out, 'core/siteConfig.data.ts'),
  '/* 생성 파일: tools/extract-from-html.mjs 가 원본 site-config.js 의 TETH_CONFIG 를 그대로 꺼낸다. 손으로 고치지 않는다. */\n' +
    `export type SitePlan = { id: string; name: string; price: string; tagline: string; features: string[]; cta: string; highlight: boolean };\n` +
    ts('TETH_CONFIG', '{ appUrl: string; iosStoreUrl: string; androidStoreUrl: string; zendeskKey: string; social: Record<string, string>; aiProxy: string; pricing: SitePlan[] }', siteCfgBox.window.TETH_CONFIG),
);

console.log('styles:', styles.map((s) => s.length).join(', '), '| I18N keys:', Object.keys(I18N).length, '| templates:', TF_TPL_ACTS.length, '+', TF_TPL_ASSETS.length, '| pages:', pageCss.join(' '), '| PI:', Object.entries(pagePi).map(([k, v]) => k + ' ' + Object.keys(v).length).join(', '));
