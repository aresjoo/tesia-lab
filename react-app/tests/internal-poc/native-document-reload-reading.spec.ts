import { expect, test, type Page } from '@playwright/test'

// Source 9fbff821 ordinary document navigation retains native scroll restoration.
// Independent source probe: about/download, reload and full-document Back, all
// preserved scrollY=760 at 1440x480. This is not the SPA remount boundary.
// Actual service-main is loaded; no account/market/result fixture is supplied.
async function boot(page: Page, baseURL: string | undefined, document: string) {
  if (!baseURL) throw new Error('Local origin required')
  const origin = new URL(baseURL).origin
  const mutations: string[] = [], errors: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(request.method()); return route.abort('blockedbyclient') }
    if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.abort('blockedbyclient')
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto(`/${document}/`)
  return { mutations, errors }
}

async function settle(page: Page, document: string) {
  await expect(page.locator(`.client-info-${document}`)).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  // Detect late alignment overwriting native restoration; do not patch router,
  // history, scrollRestoration, bfcache or add synthetic navigation events.
  await page.waitForTimeout(250)
}

for (const width of [390, 1440]) for (const document of ['about', 'download']) {
  for (const action of ['reload', 'full-document-back']) test(`${width}px ${document} ${action} retains browser reading position`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height: 480 })
    const evidence = await boot(page, baseURL, document)
    await settle(page, document)
    await page.evaluate(() => scrollTo({ top: 760, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(760)
    await page.waitForTimeout(100)
    const before = await page.evaluate(() => scrollY)
    if (action === 'reload') await page.reload()
    else {
      // An address-bar navigation creates a new Document. It must not be
      // replaced by an intercepted InternalLink or synthetic popstate.
      const other = document === 'about' ? 'download' : 'about'
      await page.goto(`/${other}/`)
      await settle(page, other)
      await page.goBack()
    }
    await settle(page, document)
    const after = await page.evaluate(() => scrollY)
    await info.attach('document-reload-reading', { body: JSON.stringify({ width, document, action, before, after }), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('document-reading-return.png') })
    expect(evidence.errors).toEqual([])
    expect(evidence.mutations).toEqual([])
    expect(await page.evaluate(() => history.scrollRestoration)).toBe('auto')
    expect(Math.abs(after - before), 'Native reload/full-document Back must preserve the original reading position').toBeLessThanOrEqual(2)
  })
}
