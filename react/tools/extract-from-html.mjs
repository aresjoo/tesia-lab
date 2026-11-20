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

// 2-1. 전략 복사: 카탈로그와 가격 설정(계산 층), 화면 문구 표
const cat = {};
for (const k of ['MK_PX_CFG', 'MK_UNI', 'MK_CAT', 'MK_ALIAS', 'MK_EX', 'MK_KIND', 'MK_TK', 'SK_SYM', 'MK_USHAPE', 'MK_CRYPTO']) cat[k] = evalLit(scripts, k);
fs.mkdirSync(path.join(out, 'core/engine'), { recursive: true });
fs.writeFileSync(
  path.join(out, 'core/engine/catalog.data.ts'),
  banner +
    `import type { CatCfg } from './types';\n` +
    ts('MK_PX_CFG', 'Record<string, [number, number, number]>', cat.MK_PX_CFG) +
    ts('MK_UNI', 'Record<string, { label: string; list: string[] }>', cat.MK_UNI) +
    `/** 이름의 코인은 실행 중에 심볼로 바뀐다 (catalog.ts 의 skSym) */\n` +
    ts('MK_CAT_RAW', 'CatCfg[]', cat.MK_CAT) +
    ts('MK_ALIAS', 'Record<string, string>', cat.MK_ALIAS) +
    ts('MK_EX', '[string, string][]', cat.MK_EX) +
    ts('MK_KIND', 'Record<string, string>', cat.MK_KIND) +
    ts('MK_TK', 'Record<string, string>', cat.MK_TK) +
    ts('SK_SYM', 'Record<string, string>', cat.SK_SYM) +
    ts('MK_USHAPE', 'Record<string, string>', cat.MK_USHAPE) +
    ts('MK_CRYPTO', 'Record<string, number>', cat.MK_CRYPTO),
);
const sh = {};
for (const k of ['MK_GLOSS', 'MK_TIP', 'MK_VOICE', 'MK_WHY', 'FU_WHY', 'MK_WHY_P', 'FU_WHY_P', 'MK_PER_L', 'CPX_KIND', 'CPP_PAIR', 'MK_STOP_L']) sh[k] = evalLit(scripts, k);
fs.writeFileSync(
  path.join(out, 'core/share.data.ts'),
  banner +
    Object.keys(sh)
      .map((k) => ts(k, k === 'MK_VOICE' ? 'Record<string, Record<string, string>>' : 'Record<string, string>', sh[k]))
      .join(''),
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

// 6. 백테스트 여정이 쓰는 계산 엔진과 카탈로그 (원본 함수와 표를 글자 그대로 꺼낸다)
// 전략 복사 조각이 core/engine 에 TS 로 옮기면 그쪽으로 모은다. 그때까지 원본과 숫자가 한 자리도 어긋나지 않게 그대로 쓴다.
const big = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).sort((a, b) => b.length - a.length)[0];
/** 최상위 선언(function NAME / var NAME) 한 덩어리. 같은 이름이 여럿이면 마지막 것(원본에서 이기는 것). */
function declText(src, name) {
  const re = new RegExp(`^(?:function\\s+${name.replace(/\$/g, '\\$')}\\s*\\(|var\\s+${name.replace(/\$/g, '\\$')}\\s*[=;,])`, 'gm');
  let m, last = null;
  while ((m = re.exec(src))) last = m;
  if (!last) throw new Error(`${name} 선언을 찾지 못했다`);
  const fn = last[0].startsWith('function');
  let depth = 0, q = null;
  for (let i = last.index; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i) - 1; continue; }
    if (ch === '/') { // 정규식 리터럴
      let k = i - 1; while (k >= 0 && /\s/.test(src[k])) k--;
      if (k < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(src[k]) || /\breturn$|\btypeof$/.test(src.slice(Math.max(0, k - 6), k + 1))) {
        let j = i + 1, cls = false;
        for (; j < src.length; j++) { const c = src[j]; if (c === '\\') { j++; continue; } if (c === '[') cls = true; else if (c === ']') cls = false; else if ((c === '/' && !cls) || c === '\n') break; }
        if (src[j] === '/') { i = j; continue; }
      }
    }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') { depth--; if (fn && depth === 0 && ch === '}') return src.slice(last.index, i + 1); }
    else if (!fn && depth === 0 && ch === ';') return src.slice(last.index, i + 1);
  }
  throw new Error(`${name} 의 끝을 찾지 못했다`);
}
const ENGINE = [
  // 가격과 지표
  'mulberry32', 'PRICE', 'PRICE0', 'mkPx', 'mkWithPx', 'mkPxFmt', 'sma', 'rsi', 'RUNSTATS', 'runBacktest', 'runBacktestCore',
  // 카탈로그 엔진 (현물)
  'MK_FEE', 'mkVol', 'mkLedger', 'mkCheckIn', 'mkStatsOf', 'mkAgentRun', 'mkRuleRun', 'mkOpen', 'mkFng', 'mkHybridRun',
  // 선물
  'MK_FUT_FEE', 'fuD', 'fuSma', 'fuMax', 'fuMin', 'fuVol', 'fuFng', 'fuLedger', 'mkFutRun',
  'fuIs', 'fuSd', 'FU_WHY', 'FU_WHY_P', 'fuSig', 'fuOuts', 'fuNeed', 'fuAiTxt', 'fuInst',
  // 카탈로그와 이름, 표기
  'MK_PX_CFG', 'MK_UNI', 'MK_CAT', 'MK_KIND', 'MK_TK', 'mkTk', 'MK_ALIAS', 'MK_ASOF', 'idxToDate', 'mkMD', 'mkUni', 'mkScope', 'mkJ', 'mkPct0', 'mkSign', 'mkRunCfg',
  'mkDate', 'mkdTicks', 'mkAssetKo', 'mkHook', 'mkOne', 'MK_CRYPTO', 'mkInst', 'mkInstList', 'MK_WHY', 'MK_WHY_P', 'MK_GLOSS', 'MK_GLOSS_K', 'mkPolite', 'TF_STOP', 'TF_BUDGET',
  // 백테스트 여정의 모델 지시문 (글자 그대로)
  'BT_SYS_J', 'BT_SYS_R',
];
{
  const body = ENGINE.map((n) => declText(big, n)).join('\n')
    .replace(/\(window\.MK_PX_CFG\|\|\{\}\)/g, 'MK_PX_CFG')
    .replace(/\(window\.MK_DATA_V\|\|''\)/g, 'MK_DATA_V');
  const extra = ['MK_DATA_V'];
  fs.mkdirSync(path.join(out, 'core/bt'), { recursive: true });
  fs.writeFileSync(
    path.join(out, 'core/bt/engine.gen.ts'),
    '// @ts-nocheck\n' + banner +
      '/* 원본 큰 스크립트의 계산 엔진과 카탈로그를 글자 그대로 꺼낸 것이다. 가격 자료는 data/px-daily.js, data/fut-daily.js 가 window 에 싣는다. */\n' +
      '/* eslint-disable */\n' +
      body + '\n' +
      `export { ${ENGINE.concat(extra).join(', ')} };\n`,
  );
}
// teth-copy.js 의 점수 산식 설정
{
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'teth-copy.js'), 'utf8'), { window: w });
  fs.writeFileSync(path.join(out, 'core/bt/tfc.data.ts'), banner + ts('TFC_SCORE', 'Record<string, number>', w.TFC.score));
}

// 4. 인사이트 (글 목록과 본문, 저자, 태그 한국어 이름). 본문은 원본 TF_INS2 그대로다.
{
  const TF_INS2 = evalLit(scripts, 'TF_INS2');
  const TF_INS2_AUTH = evalLit(scripts, 'TF_INS2_AUTH');
  const INS_TAG_KO = evalLit(scripts, 'INS_TAG_KO');
  fs.mkdirSync(path.join(out, 'core/insight'), { recursive: true });
  fs.writeFileSync(
    path.join(out, 'core/insight/insight.data.ts'),
    banner +
      `export type InsSec = { h?: string; ps?: string[]; q?: string; fig?: { t: string; cap: string } };\n` +
      `export type InsPost = { slug: string; au: string; lv: number; cat: string; art: string; min: number; read: number; trend: number; tags: string[]; assets?: [string, string, string, string][]; title: string; sub: string; body: InsSec[] };\n` +
      `export type InsAuthor = { nm: string; ro: string; skin: string; hair: string; hairD: string; top: string };\n` +
      ts('TF_INS2', 'InsPost[]', TF_INS2) +
      ts('TF_INS2_AUTH', 'Record<string, InsAuthor>', TF_INS2_AUTH) +
      ts('INS_TAG_KO', 'Record<string, string>', INS_TAG_KO),
  );
  console.log('insight posts:', TF_INS2.length, '| authors:', Object.keys(TF_INS2_AUTH).length, '| tags:', Object.keys(INS_TAG_KO).length);
}

// 4. AI 지침 글 (taiSystem, taiConvSystem, taiMarketRules): 함수 본문을 그대로 돌려 글자를 꺼낸다
/** `function NAME(` 부터 짝이 맞는 닫는 중괄호까지 */
function funcSrc(src, name) {
  const m = new RegExp(`(?:^|\\n)function\\s+${name}\\s*\\(`).exec(src);
  if (!m) throw new Error(`function ${name} 을 찾지 못했다`);
  let i = src.indexOf('{', m.index);
  const start = m.index;
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
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`function ${name} 의 끝을 찾지 못했다`);
}
const promptCtx = vm.createContext({ TAI: { chart: null }, gStep: null });
vm.runInContext(['taiSystem', 'taiConvSystem', 'taiMarketRules'].map((n) => funcSrc(scripts, n)).join('\n'), promptCtx);
const convStep = {};
for (const k of ['mode', 'pair', 'tf', 'risk', 'tp']) convStep[k] = vm.runInContext(`gStep=${JSON.stringify(k)}; taiConvSystem()`, promptCtx);
fs.mkdirSync(path.join(out, 'core/tai'), { recursive: true });
fs.writeFileSync(
  path.join(out, 'core/tai/prompt.data.ts'),
  banner +
    ts('TAI_SYSTEM', 'string', vm.runInContext('taiSystem(null)', promptCtx)) +
    ts('TAI_CONV_FREE', 'string', vm.runInContext('gStep=null; taiConvSystem()', promptCtx)) +
    ts('TAI_CONV_STEP', 'Record<string, string>', convStep) +
    ts('TAI_MARKET_RULES', 'string', vm.runInContext('taiMarketRules()', promptCtx)),
);

// 5. 전략 카드가 쓰는 표: 인테이크 선택지(teth-copy.js 의 TFCOPY.intakeOpt)와 백테스트 가격 자료가 있는 자산 이름(data/px-daily.js)
const copyCtx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'teth-copy.js'), 'utf8'), copyCtx);
const pxCtx = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(root, 'data/px-daily.js'), 'utf8'), pxCtx);
fs.mkdirSync(path.join(out, 'core/tf'), { recursive: true });
fs.writeFileSync(
  path.join(out, 'core/tf/intake.data.ts'),
  banner +
    ts('TF_INTAKE_OPT', 'Record<string, [string, string][]>', JSON.parse(JSON.stringify(copyCtx.window.TFCOPY.intakeOpt))) +
    ts('TF_INTAKE_Q', 'Record<string, { t: string; d: string }>', JSON.parse(JSON.stringify(copyCtx.window.TFCOPY.intakeQ))) +
    ts('PX_ASSETS', 'string[]', Object.keys(pxCtx.window.TETH_PX.px)) +
    ts('BT_MINE_ALIAS', 'Record<string, string>', evalLit(scripts, 'BT_MINE_ALIAS')),
);

// (6) 탭과 문서 이름의 한글 표기 (G_LBL)
fs.writeFileSync(path.join(out, 'core/tai/labels.data.ts'), '// 생성 파일: tools/extract-from-html.mjs. 손으로 고치지 않는다.\n' + ts('G_LBL', 'Record<string, string>', evalLit(scripts, 'G_LBL')));

// 4. 거래소 연결과 설정과 이용 현황 조각(-acct): 거래소 표와 teth-copy.js 의 TFC
const TF_BROKERS = evalLit(scripts, 'TF_BROKERS');
const tfcBox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'teth-copy.js'), 'utf8'), tfcBox);
fs.mkdirSync(path.join(out, 'core/account'), { recursive: true });
fs.writeFileSync(
  path.join(out, 'core/account/brokers.data.ts'),
  banner +
    `export type Broker = { id: string; name: string; ord?: number; tag?: string; assets?: string; conn?: boolean; site?: string; mono?: string; [k: string]: unknown };\n` +
    ts('TF_BROKERS', 'Broker[]', TF_BROKERS),
);
fs.writeFileSync(
  path.join(out, 'core/account/tfc.data.ts'),
  banner + `/* 원본 teth-copy.js 의 window.TFC 그대로 */\n` + `export const TFC = ${JSON.stringify(tfcBox.window.TFC, null, 1)} as const;\n`,
);

console.log('styles:', styles.map((s) => s.length).join(', '), '| I18N keys:', Object.keys(I18N).length, '| templates:', TF_TPL_ACTS.length, '+', TF_TPL_ASSETS.length, '| pages:', pageCss.join(' '), '| PI:', Object.entries(pagePi).map(([k, v]) => k + ' ' + Object.keys(v).length).join(', '));
