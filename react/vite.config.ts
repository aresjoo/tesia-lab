import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 를 상대 경로로 두어 GitHub Pages 의 하위 폴더에서도 그대로 열린다.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5871, strictPort: true },
  preview: { host: '127.0.0.1', port: 5872, strictPort: true },
});
