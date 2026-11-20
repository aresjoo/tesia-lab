// React 판을 빌드해 저장소 최상위에 올릴 모양으로 놓는다: react.html + react-build/.
// GitHub Pages 가 main 최상위를 그대로 내므로 https://<계정>.github.io/tesia-lab/react.html 로 열린다.
// 원본 index.html 과 assets/ 는 건드리지 않는다.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(app, '..');
execSync('npm run build', { cwd: app, stdio: 'inherit' });
const dist = path.join(app, 'dist');
const out = path.join(root, 'react-build');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(dist, 'react-build'), out, { recursive: true });
// CSS 안의 /assets/ 는 묶음 폴더 기준 상대 경로로 (react-build/ 의 한 칸 위가 저장소 최상위)
for (const f of fs.readdirSync(out)) {
  if (!f.endsWith('.css')) continue;
  const p = path.join(out, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/url\((['"]?)\/assets\//g, 'url($1../assets/'));
}
fs.copyFileSync(path.join(dist, 'index.html'), path.join(root, 'react.html'));
console.log('올릴 파일:', 'react.html', fs.readdirSync(out).map((f) => 'react-build/' + f).join(' '));
