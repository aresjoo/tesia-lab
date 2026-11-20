// React 판을 빌드해 저장소 최상위에 올릴 모양으로 놓는다: react.html + react-build/ 와
// 독립 페이지 셋 react-about.html, react-download.html, react-policies.html.
// GitHub Pages 가 main 최상위를 그대로 내므로 https://<계정>.github.io/tesia-lab/react.html, .../react-about.html 로 열린다.
// 원본 index.html 과 assets/ 는 건드리지 않는다. 문서끼리는 같은 폴더의 상대 주소로 잇는다(src/core/config.ts 의 PAGES).
// 쓰는 법: node tools/publish.mjs [놓을 폴더]   (폴더를 안 주면 저장소 최상위. 시험할 때는 assets/ 가 보이는 다른 폴더를 준다)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(app, '..');
/** 빌드한 문서 이름 → 놓을 이름 */
const DOCS = { 'index.html': 'react.html', 'about.html': 'react-about.html', 'download.html': 'react-download.html', 'policies.html': 'react-policies.html' };
execSync('npm run build', { cwd: app, stdio: 'inherit' });
const dist = path.join(app, 'dist');
const out = path.join(root, 'react-build');
fs.mkdirSync(root, { recursive: true });
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(dist, 'react-build'), out, { recursive: true });
// CSS 안의 /assets/ 는 묶음 폴더 기준 상대 경로로 (react-build/ 의 한 칸 위가 저장소 최상위)
for (const f of fs.readdirSync(out)) {
  if (!f.endsWith('.css')) continue;
  const p = path.join(out, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/url\((['"]?)\/assets\//g, 'url($1../assets/'));
}
for (const [from, to] of Object.entries(DOCS)) fs.copyFileSync(path.join(dist, from), path.join(root, to));
console.log('올릴 파일:', Object.values(DOCS).join(' '), fs.readdirSync(out).map((f) => 'react-build/' + f).join(' '));
