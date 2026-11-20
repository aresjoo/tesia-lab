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

console.log('styles:', styles.map((s) => s.length).join(', '), '| I18N keys:', Object.keys(I18N).length, '| templates:', TF_TPL_ACTS.length, '+', TF_TPL_ASSETS.length, '| catalog:', cat.MK_CAT.length, '| voice:', Object.keys(sh.MK_VOICE).length);
