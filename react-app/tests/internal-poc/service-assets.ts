import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import type { Page } from '@playwright/test'

/** Test-only candidate assets over the unchanged real owner-local HTTP API.
 * No proxy, API interception, cookie copying, server writes or authority inputs.
 */
export async function useCandidateServiceAssets(page: Page, serviceUrl: string) {
  const directory = process.env.TETH_CLIENT_SERVICE_ASSETS
  if (!directory) return
  const origin = new URL(serviceUrl).origin
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error('TEST_ASSET_ORIGIN_INVALID')
  const root = resolve(directory)
  const mime: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml' }
  await page.route(`${origin}/**`, async route => {
    const path = new URL(route.request().url()).pathname
    if (path.startsWith('/api/')) { await route.continue(); return }
    if (path === '/internal-poc.html') {
      const response = await route.fetch()
      if (response.status() !== 200) throw new Error('TEST_SERVICE_DOCUMENT_UNAVAILABLE')
      const original = await response.text()
      // Retain only the actual server-issued profile hash, never invent trust.
      const profile = original.match(/<meta name="tesia-structural-smoke-profile-hash" content="[a-f0-9]{64}"\s*\/?>/g)
      if (profile?.length !== 1) throw new Error('TEST_SERVICE_PROFILE_MISSING')
      const html = await readFile(resolve(root, 'internal-poc.html'), 'utf8')
      if (!html.includes(`name="tesia-owner-local-service-url" content="${origin}"`)) throw new Error('TEST_ASSET_ATTESTATION_MISMATCH')
      await route.fulfill({ response, body: html.replace('</head>', `${profile[0]}</head>`) })
      return
    }
    const file = resolve(root, `.${decodeURIComponent(path)}`)
    const contentType = mime[extname(file)]
    if (!file.startsWith(root + sep) || !contentType) { await route.abort(); return }
    try { await route.fulfill({ status: 200, contentType, body: await readFile(file) }) }
    catch { await route.abort() }
  })
}
