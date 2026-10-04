import { expect, test, type Page } from '@playwright/test'

// Real service router and native browser history/RAF. GET-only local harness;
// no authentication/provider completion and no RAF/time/scroll stubs.
async function boot(page: Page, baseURL: string | undefined) {
  if (!baseURL) throw new Error('Local origin required')
  const origin = new URL(baseURL).origin, errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    const scroll = window.scrollTo.bind(window)
    const calls: { route: string; y: number | undefined }[] = []
    Object.assign(window, { readingScrollCalls: calls })
    window.scrollTo = ((x: number | ScrollToOptions, y?: number) => {
      calls.push({ route: location.pathname, y: typeof x === 'number' ? y : x.top })
      if (typeof x === 'number') scroll(x, y ?? 0)
      else scroll(x)
    }) as typeof window.scrollTo
  })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(request.method()); return route.abort('blockedbyclient') }
    if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.abort('blockedbyclient')
    if (request.isNavigationRequest() && url.pathname === '/receipt-away') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Local document fixture</title><p>No application mounted.</p>' })
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/about/')
  await settle(page, 'about')
  return { errors, mutations }
}

async function settle(page: Page, name: string) {
  await expect(page.locator(`.client-info-${name}`)).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  await page.waitForTimeout(180)
}

async function restoredEntry(page: Page) {
  await page.evaluate(() => {
    history.replaceState({ ...history.state, foreignOwner: { marker: 29 } }, '')
    scrollTo({ top: 760, behavior: 'instant' })
  })
  await page.goto('/download/')
  await settle(page, 'download')
  await page.goBack()
  await settle(page, 'about')
  expect(await page.evaluate(() => scrollY)).toBe(760)
  expect(await page.evaluate(() => history.state.foreignOwner)).toEqual({ marker: 29 })
}

test('a restored full-document coordinate is consumed without erasing foreign state', async ({ page, baseURL }) => {
  const evidence = await boot(page, baseURL)
  await restoredEntry(page)
  expect(await page.evaluate(() => history.state.tethPublicDocumentPosition)).toBeUndefined()
  expect(evidence).toEqual({ errors: [], mutations: [] })
})

test('a later reload restores the new reading position exactly, not the first visit', async ({ page, baseURL }) => {
  const evidence = await boot(page, baseURL)
  await restoredEntry(page)
  await page.evaluate(() => scrollTo({ top: 1120, behavior: 'instant' }))
  await page.reload()
  await settle(page, 'about')
  expect(await page.evaluate(() => scrollY)).toBe(1120)
  expect(await page.evaluate(() => history.state.foreignOwner)).toEqual({ marker: 29 })
  expect(evidence).toEqual({ errors: [], mutations: [] })
})

test('denied reload storage never explicitly replays a consumed old coordinate', async ({ page, baseURL }) => {
  const evidence = await boot(page, baseURL)
  await restoredEntry(page)
  await page.evaluate(() => {
    sessionStorage.removeItem('tethPublicDocumentReload')
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tethPublicDocumentReload') throw new DOMException('Denied', 'SecurityError')
      return write.call(this, key, value)
    }
    scrollTo({ top: 1120, behavior: 'instant' })
  })
  await page.reload()
  await settle(page, 'about')
  // Exact UA restoration cannot be guaranteed when optional storage is denied.
  // The product must not issue an explicit stale Y1 restore over the UA result.
  const oldCalls = await page.evaluate(() => (window as unknown as { readingScrollCalls: { y?: number }[] }).readingScrollCalls.filter(call => call.y === 760))
  expect(oldCalls).toEqual([])
  expect(await page.evaluate(() => history.state.foreignOwner)).toEqual({ marker: 29 })
  expect(evidence).toEqual({ errors: [], mutations: [] })
})

test('Back from a non-app document retires both entry receipts before the next reload', async ({ page, baseURL }) => {
  const evidence = await boot(page, baseURL)
  await page.evaluate(() => scrollTo({ top: 760, behavior: 'instant' }))
  await page.goto('/receipt-away')
  await page.goBack()
  await settle(page, 'about')
  expect(await page.evaluate(() => scrollY)).toBe(760)
  expect(await page.evaluate(() => history.state.tethPublicDocumentPosition)).toBeUndefined()
  expect(await page.evaluate(() => sessionStorage.getItem('tethPublicDocumentReload'))).toBeNull()
  await page.evaluate(() => scrollTo({ top: 1120, behavior: 'instant' }))
  await page.reload()
  await settle(page, 'about')
  expect(await page.evaluate(() => scrollY)).toBe(1120)
  expect(evidence).toEqual({ errors: [], mutations: [] })
})

for (const mode of ['trusted-click', 'programmatic', 'programmatic-cpu-throttled'] as const) test(`${mode} public navigation never applies another route's reading coordinate`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 480 })
  const evidence = await boot(page, baseURL)
  await restoredEntry(page)
  const client = mode === 'programmatic-cpu-throttled' ? await page.context().newCDPSession(page) : null
  if (client) await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  if (mode === 'trusted-click') await page.locator('.client-info-about .hd a[href="/download/"]').click()
  else await page.evaluate(() => {
    history.pushState({ tethSite: true }, '', '/download/')
    window.dispatchEvent(new Event('teth:navigate'))
  })
  await settle(page, 'download')
  expect(await page.evaluate(() => scrollY)).toBe(0)
  const wrongCalls = await page.evaluate(() => (window as unknown as { readingScrollCalls: { route: string; y?: number }[] }).readingScrollCalls.filter(call => call.route === '/download/' && call.y === 760))
  expect(wrongCalls).toEqual([])
  expect(evidence).toEqual({ errors: [], mutations: [] })
  if (client) { await client.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await client.detach() }
})
