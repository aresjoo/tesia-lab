import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Explicit operator attestation, never inferred from the visitor's origin.
const ownerLocalOrigin = process.env.TETH_OWNER_LOCAL_SERVICE_URL ?? ''
if (ownerLocalOrigin) {
  const url = new URL(ownerLocalOrigin)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash || url.origin !== ownerLocalOrigin) {
    throw new Error('TETH_OWNER_LOCAL_SERVICE_URL must be an exact http://127.0.0.1:port origin')
  }
}

export default defineConfig({
  plugins: [react(), {
    name: 'owner-local-client-asset-closure',
    // The approved server serves only assets explicitly referenced by this
    // HTML (and their CSS URLs). Register this entry's transitive chunks,
    // never the fixture entry, without widening the server's static allowlist.
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.bundle || !context.filename.endsWith('/internal-poc.html')) return []
        const optInTag = '<meta name="tesia-owner-local-service-url" content="" />'
        if (ownerLocalOrigin && html.split(optInTag).length !== 2) throw new Error('OWNER_LOCAL_META_TARGET_MISSING_OR_DUPLICATED')
        const entry = Object.values(context.bundle).find(item => item.type === 'chunk' && item.isEntry && item.name === 'internalPoc')
        if (!entry || entry.type !== 'chunk') return []
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
        const tags = [
          ...[...seen].map(href => ({ tag: 'link', attrs: { rel: 'modulepreload', href: `/${href}` }, injectTo: 'head' as const })),
          ...[...styles].map(href => ({ tag: 'link', attrs: { rel: 'preload', as: 'style', href: `/${href}` }, injectTo: 'head' as const })),
          { tag: 'link', attrs: { rel: 'preload', as: 'image', href: '/teth-logo.png' }, injectTo: 'head' as const },
          { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/favicon.png' }, injectTo: 'head' as const },
        ]
        return { html: ownerLocalOrigin ? html.replace(optInTag, `<meta name="tesia-owner-local-service-url" content="${ownerLocalOrigin}" />`) : html, tags }
      },
    },
  }],
  build: {
    outDir: 'dist-internal-poc',
    rollupOptions: {
      input: {
        internalPoc: 'internal-poc.html',
        internalPocFixture: 'internal-poc-fixture.html',
      },
    },
  },
})
