import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', pdf: 'application/pdf', html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', json: 'application/json', txt: 'text/plain; charset=utf-8' };

/** 개발 서버에서 저장소 최상위의 자산 폴더(원본과 같이 쓰는 것)를 그대로 내준다. 사본을 만들지 않는다. */
function sharedAssets(): Plugin {
  return {
    name: 'teth-shared-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const u = decodeURIComponent((req.url || '').split('?')[0]);
        if (!/^\/(assets|policies|logos|data)\//.test(u)) return next();
        const f = path.join(repoRoot, u);
        if (!f.startsWith(repoRoot) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return next();
        res.setHeader('Content-Type', MIME[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(f).pipe(res);
      });
    },
  };
}

// 배포는 저장소 최상위의 react.html 한 장 + react-build/ 묶음이다 (tools/publish.mjs).
// 그래서 자산은 원본과 같은 assets/ 를 상대 경로로 쓰고, 묶음은 react-build/ 에 낸다.
export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react(), sharedAssets()],
  build: { assetsDir: 'react-build' },
  server: { host: '127.0.0.1', port: 5871, strictPort: true },
});
