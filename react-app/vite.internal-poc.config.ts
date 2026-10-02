import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { CLIENT_HOME_ASSETS } from './src/client-home-gallery.ts'
import { CLIENT_PUBLIC_ASSETS } from './src/client-public-assets.ts'

// Explicit operator attestation, never inferred from the visitor's origin.
const ownerLocalOrigin = process.env.TETH_OWNER_LOCAL_SERVICE_URL ?? ''
const localBackendOrigin = process.env.TETH_LOCAL_BACKEND_URL ?? ''
const smokeProfileHash = process.env.TETH_STRUCTURAL_SMOKE_PROFILE_HASH ?? ''
if (smokeProfileHash && !/^[0-9a-f]{64}$/.test(smokeProfileHash)) throw new Error('Invalid structural smoke profile hash')
if (localBackendOrigin) {
  const url = new URL(localBackendOrigin)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash || url.origin !== localBackendOrigin) {
    throw new Error('TETH_LOCAL_BACKEND_URL must be an exact loopback HTTP origin')
  }
}
if (ownerLocalOrigin) {
  const url = new URL(ownerLocalOrigin)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash || url.origin !== ownerLocalOrigin) {
    throw new Error('TETH_OWNER_LOCAL_SERVICE_URL must be an exact http://127.0.0.1:port origin')
  }
}

export const createInternalPocConfig = ({ serviceOnly = false }: { serviceOnly?: boolean } = {}) => defineConfig({
  server: localBackendOrigin ? { host: '127.0.0.1', proxy: {
    '/api/': { target: localBackendOrigin, changeOrigin: false },
  } } : undefined,
  plugins: [react(), {
    name: 'native-service-entry',
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        if (!serviceOnly || !context.filename.endsWith('/internal-poc.html')) return html
        const script = '<script type="module" src="/src/internal-poc/main.tsx"></script>'
        if (html.split(script).length !== 2) throw new Error('SERVICE_ENTRY_TARGET_MISSING_OR_DUPLICATED')
        const title = '<title>TETH AI · 내부 전략 POC</title>'
        if (html.split(title).length !== 2) throw new Error('SERVICE_TITLE_TARGET_MISSING_OR_DUPLICATED')
        if (html.split('</head>').length !== 2) throw new Error('SERVICE_HEAD_TARGET_MISSING_OR_DUPLICATED')
        return html.replace(script, '<script type="module" src="/src/internal-poc/service-main.tsx"></script>')
          .replace(title, '<title>TETH AI — AI 트레이딩 에이전트</title>')
          .replace('</head>', '<meta name="theme-color" content="#0f1012" />\n    <meta name="application-name" content="TETH AI" />\n    <link rel="apple-touch-icon" href="/apple-touch-icon-f260167.png" />\n  </head>')
      },
    },
  }, {
    name: 'owner-local-client-asset-closure',
    // The approved server serves only assets explicitly referenced by this
    // HTML (and their CSS URLs). Register this entry's transitive chunks,
    // never the fixture entry, without widening the server's static allowlist.
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.filename.endsWith('/internal-poc.html')) return []
        if (smokeProfileHash) {
          if (html.includes('tesia-structural-smoke-profile-hash')) throw new Error('DUPLICATE_SMOKE_PROFILE_META')
          html = html.replace('</head>', `<meta name="tesia-structural-smoke-profile-hash" content="${smokeProfileHash}" /></head>`)
        }
        const optInTag = '<meta name="tesia-owner-local-service-url" content="" />'
        if (ownerLocalOrigin && html.split(optInTag).length !== 2) throw new Error('OWNER_LOCAL_META_TARGET_MISSING_OR_DUPLICATED')
        if (!context.bundle) return ownerLocalOrigin ? html.replace(optInTag, `<meta name="tesia-owner-local-service-url" content="${ownerLocalOrigin}" />`) : html
        const entry = Object.values(context.bundle).find(item => item.type === 'chunk' && item.isEntry && item.name === 'internalPoc')
        if (!entry || entry.type !== 'chunk') throw new Error('INTERNAL_CLIENT_ENTRY_MISSING')
        const seen = new Set<string>()
        const styles = new Set<string>()
        const visit = (name: string) => {
          if (seen.has(name)) return
          if (/fixture/i.test(name)) throw new Error('INTERNAL_CLIENT_FIXTURE_DEPENDENCY')
          const chunk = context.bundle![name]
          if (!chunk || chunk.type !== 'chunk') return
          seen.add(name)
          const metadata = (chunk as typeof chunk & { viteMetadata?: { importedCss: Set<string> } }).viteMetadata
          metadata?.importedCss.forEach(css => styles.add(css))
          ;[...chunk.imports, ...chunk.dynamicImports].forEach(visit)
        }
        visit(entry.fileName)
        // Vite emits Worker programs as JS assets outside the entry import
        // graph. Register them without fetching or executing them eagerly.
        const workerAssets = Object.values(context.bundle)
          .filter(item => item.type === 'asset' && item.fileName.endsWith('.js'))
          .map(item => item.fileName)
        if (workerAssets.some(name => /fixture/i.test(name))) throw new Error('INTERNAL_CLIENT_FIXTURE_DEPENDENCY')
        const tags = [
          // Vite already emits the entry's static imports and styles. These
          // links only register the full serving closure, including lazy CSS;
          // preloading them would eagerly fetch every deferred workspace.
          ...[...seen, ...styles, ...workerAssets].map(href => ({ tag: 'link', attrs: { rel: 'teth-static-asset', href: `/${href}` }, injectTo: 'head' as const })),
          { tag: 'link', attrs: { rel: 'preload', as: 'image', href: '/teth-logo-f260167.png' }, injectTo: 'head' as const },
          { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/favicon-f260167.png' }, injectTo: 'head' as const },
          // The approved static server registers explicit HTML link hrefs.
          // This non-fetch relation declares assets without preloading all
          // 50 offscreen logos and defeating gallery lazy loading.
          ...CLIENT_HOME_ASSETS.map(asset => ({ tag: 'link', attrs: { rel: 'teth-static-asset', href: asset.img }, injectTo: 'head' as const })),
          ...(serviceOnly ? CLIENT_PUBLIC_ASSETS.map(href => ({ tag: 'link', attrs: { rel: 'teth-static-asset', href }, injectTo: 'head' as const })) : []),
        ]
        return { html: ownerLocalOrigin ? html.replace(optInTag, `<meta name="tesia-owner-local-service-url" content="${ownerLocalOrigin}" />`) : html, tags }
      },
    },
  }],
  build: {
    outDir: serviceOnly ? 'dist-service' : 'dist-internal-poc',
    rollupOptions: {
      input: {
        internalPoc: 'internal-poc.html',
        ...(serviceOnly ? {} : { internalPocFixture: 'internal-poc-fixture.html' }),
      },
    },
  },
})

export default createInternalPocConfig()
