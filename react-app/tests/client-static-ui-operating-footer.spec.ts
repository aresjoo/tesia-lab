import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// The user explicitly approved the source 9fb footer for the deployed test UI.
// Keep the oracle independent of the edited file and preserve all other locales.
const operatingBytes = execFileSync('git', ['show', '845e58fed9f0acacf2b76d8538a99d7e0c456485:src/client-site-footer-copy.json'], { encoding: 'utf8' })
const operating = JSON.parse(operatingBytes).ko
const paragraphs = [operating.body.intro, operating.body.tagline, operating.body.consent, `© 2026 TETH AI. ${operating.allRightsReserved}.`]
const serviceHtml = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/src/internal-poc/service-main.tsx");</script></body></html>'
const surfaces = [
  { host: 'Main', path: '/' },
  { host: 'Native service entry', path: '/' },
  { host: 'About', path: '/about/' },
  { host: 'Download', path: '/download/' },
  { host: 'Terms', path: '/policies/#terms' },
  { host: 'Privacy', path: '/policies/#privacy' },
] as const

for (const surface of surfaces) test(`operating footer ${surface.host}: approved original release copy`, async ({ page, context, baseURL }, info) => {
  if (!baseURL) throw new Error('Local origin required')
  // Whole-file equality also protects the other six languages and every menu.
  expect(readFileSync(new URL('../src/client-site-footer-copy.json', import.meta.url), 'utf8')).toBe(operatingBytes)
  const origin = new URL(baseURL).origin
  const native = surface.host === 'Native service entry'
  const width = info.project.name === 'desktop' ? 1440 : 320
  const audit = { external: 0, mutations: 0, unexpectedApi: 0, websocket: 0, blockedLocalHmr: [] as { origin: string; path: string; queryKeys: string[] }[], sessionGets: 0, csrfGets: 0, errors: [] as string[] }
  page.on('pageerror', error => audit.errors.push(error.message))
  // vite/dist/client/client.mjs:864/872/882 opens the own-origin root with
  // ?token= for primary/direct vite-hmr connections. Keep both blocked, but
  // distinguish development transport from service/external WebSockets.
  const viteClient = readFileSync(new URL('../node_modules/vite/dist/client/client.mjs', import.meta.url), 'utf8')
  expect(viteClient).toContain('new WebSocket(`${socketProtocol}://${socketHost}?token=${wsToken}`, "vite-hmr")')
  expect(viteClient).toContain('new WebSocket(`${socketProtocol}://${directSocketHost}?token=${wsToken}`, "vite-hmr")')
  await context.routeWebSocket(/.*/, socket => {
    const url = new URL(socket.url()), queryKeys = [...url.searchParams.keys()]
    const httpOrigin = url.origin.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')
    if (httpOrigin === origin && url.pathname === '/' && queryKeys.length === 1 && queryKeys[0] === 'token') {
      // Never record token/query values, only the exact safe origin/path.
      audit.blockedLocalHmr.push({ origin: url.origin, path: url.pathname, queryKeys })
    } else audit.websocket++
    socket.close()
  })
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external++; return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations++; return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/api/')) {
      if (native && request.method() === 'GET') {
        // Anonymous GET-only presentation fixture; no actual login/provider.
        const meta = { apiContractVersion: '0.1.0', requestId: 'req_operating_footer_fixture_0001', traceId: 'trace_operating_footer_fixture_0001', resourceRevision: url.pathname.endsWith('/session') ? '1' : null }
        if (url.pathname === '/api/v1/auth/session') {
          audit.sessionGets++
          return route.fulfill({ contentType: 'application/json', headers: { ETag: '"operating_footer_session_fixture_0001"' }, body: JSON.stringify({ meta, data: { sessionId: 'session_operating_footer_fixture_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
        }
        if (url.pathname === '/api/v1/auth/csrf') {
          audit.csrfGets++
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta, data: { csrfToken: 'csrf_operating_footer_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
        }
      }
      audit.unexpectedApi++; return route.abort('blockedbyclient')
    }
    if (native && request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: serviceHtml })
    return route.continue()
  })
  await context.addInitScript(localOrigin => {
    if (location.origin !== localOrigin) return
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
  }, origin)
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(surface.path)
  if (native) await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  if (surface.host === 'Main') await expect(page.locator('.client-source-app:not(.client-service-app)')).toBeVisible()
  if (surface.host === 'Main' || native) {
    const scrollport = page.locator('.client-source-app.has-site-footer')
    await expect(scrollport).toHaveCSS('overflow-y', 'auto')
    await expect(scrollport).toHaveCSS('scrollbar-width', 'none')
    expect(await scrollport.evaluate(node => getComputedStyle(node, '::-webkit-scrollbar').display)).toBe('none')
    await page.locator('.client-home-content h1').hover()
    await page.mouse.wheel(0, 420)
    await expect.poll(() => scrollport.evaluate(node => node.scrollTop)).toBeGreaterThan(0)
  }
  if (surface.host === 'Terms' || surface.host === 'Privacy') await expect(page.locator('.view.on')).toHaveAttribute('id', surface.host === 'Terms' ? 'v-terms' : 'v-privacy')
  const footer = page.locator('.client-site-footer')
  await expect(footer).toHaveCount(1)
  await expect(footer.locator('.gft-copy > p')).toHaveText(paragraphs)
  await expect(footer.locator('.gft-copy > p').nth(1).locator('b')).toHaveText(operating.body.tagline)
  await expect(footer.locator('.gft-copy > p.dim')).toHaveCount(2)
  await expect(footer).toHaveAttribute('aria-label', operating.siteInfo)
  await footer.locator('.gft-copy').scrollIntoViewIfNeeded()
  await expect(footer.locator('.gft-copy > p').last()).toBeInViewport()
  expect(await footer.locator('.gft-copy').evaluate(node => {
    const box = node.getBoundingClientRect()
    return box.width > 0 && box.left >= 0 && box.right <= innerWidth && node.scrollWidth <= node.clientWidth + 1
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await info.attach('blocked-websocket-classification.json', { body: JSON.stringify({ blockedLocalHmr: audit.blockedLocalHmr, nonHmrWebSockets: audit.websocket }), contentType: 'application/json' })
  expect(audit.errors).toEqual([])
  expect({ external: audit.external, mutations: audit.mutations, unexpectedApi: audit.unexpectedApi, websocket: audit.websocket }).toEqual({ external: 0, mutations: 0, unexpectedApi: 0, websocket: 0 })
  if (native) { expect(audit.sessionGets).toBeGreaterThan(0); expect(audit.csrfGets).toBeGreaterThan(0) }
  else expect({ sessionGets: audit.sessionGets, csrfGets: audit.csrfGets }).toEqual({ sessionGets: 0, csrfGets: 0 })
  if (native && width === 320) await page.screenshot({ path: info.outputPath('operating-footer-native-320.png') })
  await info.attach('operating-footer-boundary.json', { body: JSON.stringify({ host: surface.host, width, approvedCopyReference: '845e58f', originalClientSource: '9fbff821', wholeFooterFileExact: true, actualProviderVerified: false, audit }), contentType: 'application/json' })
})
