import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { realpathSync } from 'node:fs'
import { dirname } from 'node:path'
import react from '@vitejs/plugin-react'

const e2ePort = Number(process.env.TETH_E2E_PORT)
const parallelCache = Number.isInteger(e2ePort) && e2ePort >= 1024 && e2ePort <= 65535
  ? `node_modules/.vite-e2e-${e2ePort}` : 'node_modules/.vite'

export default defineConfig({
  cacheDir: parallelCache,
  plugins: [react()],
  // Linked dependency checkouts need their physical package directory for dev fonts.
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), dirname(realpathSync('node_modules/react'))] } },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        reportingDemo: 'reporting-demo.html',
      },
    },
  },
})
