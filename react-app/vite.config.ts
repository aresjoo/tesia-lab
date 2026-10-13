import { defineConfig, searchForWorkspaceRoot } from 'vite'
import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import react from '@vitejs/plugin-react'

const e2ePort = Number(process.env.TETH_E2E_PORT)
const parallelCache = Number.isInteger(e2ePort) && e2ePort >= 1024 && e2ePort <= 65535
  ? `node_modules/.vite-e2e-${e2ePort}` : 'node_modules/.vite'

export default defineConfig({
  cacheDir: parallelCache,
  plugins: [react(), {
    name: 'local-evaluated-strategy-catalogue',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VITE_LOCAL_STRATEGY_CATALOGUE !== 'true') return
      const artifact = resolve(import.meta.dirname, '../../side-projects/teth-arena/evidence/strategy-discovery/catalogue/catalogue.json')
      server.middlewares.use(async (request, response, next) => {
        const url = request.url?.split('?')[0]
        const minimum = url === '/__teth/execution-minimum'
        const discovered = url === '/__teth/discovered-strategies.json' && process.env.VITE_LOCAL_STRATEGY_DISCOVERY === 'true'
        if (url !== '/__local/strategy-catalogue.json' && !discovered && !minimum) { next(); return }
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        const host = request.headers.host?.replace(/:\d+$/, '')
        const remote = request.socket.remoteAddress
        if (!['localhost', '127.0.0.1', '[::1]'].includes(host ?? '') || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote ?? '')) { response.statusCode = 403; response.end('{"error":"local_only"}'); return }
        if (request.method !== 'GET') { response.statusCode = 405; response.setHeader('Allow', 'GET'); response.end('{"error":"method_not_allowed"}'); return }
        try {
          if (minimum) {
            const quote = await fetch('http://127.0.0.1:4185/minimum', { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8000) })
            if (!quote.body || !quote.headers.get('content-type')?.includes('application/json')) throw Error('Minimum unavailable')
            const reader = quote.body.getReader(); const parts: Uint8Array[] = []; let size = 0
            try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 262144) throw Error('Minimum too large'); parts.push(part.value) } } finally { await reader.cancel().catch(() => undefined) }
            response.statusCode = quote.status; response.end(Buffer.concat(parts)); return
          }
          response.end(await readFile(discovered ? resolve(import.meta.dirname, '../../side-projects/teth-arena/.cache/strategy-discovery-bitget/catalogue-provenance-corrected.json') : artifact)) }
        catch { response.statusCode = 503; response.end('{"error":"catalogue_unavailable"}') }
      })
    },
  }],
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
