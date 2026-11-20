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

// 4. 백테스트 여정이 쓰는 계산 엔진과 카탈로그 (원본 함수와 표를 글자 그대로 꺼낸다)
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

console.log('styles:', styles.map((s) => s.length).join(', '), '| I18N keys:', Object.keys(I18N).length, '| templates:', TF_TPL_ACTS.length, '+', TF_TPL_ASSETS.length);
