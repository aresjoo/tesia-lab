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

console.log('styles:', styles.map((s) => s.length).join(', '), '| I18N keys:', Object.keys(I18N).length, '| templates:', TF_TPL_ACTS.length, '+', TF_TPL_ASSETS.length);
