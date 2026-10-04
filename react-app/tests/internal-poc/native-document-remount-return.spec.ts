import { expect, test, type Page } from '@playwright/test'

// Actual service-main/SiteRouter; only anonymous GET session/CSRF are synthetic.
// Source 9fb uses ordinary document anchors (index.html:5137, site-footer.js).
// React retains the service app but unmounts public documents on return home.
// This checks equivalent browser reading continuity, not real authentication.
async function boot(page: Page, baseURL: string | undefined, entry: string) {
  if (!baseURL) throw new Error('Local origin required')
  const origin = new URL(baseURL).origin, mutations: string[] = [], errors: string[] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(request.method()); return route.abort('blockedbyclient') }
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) {
      if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"document_remount_00001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_document_remount_0001', traceId: 'trace_document_remount_0001' },
        data: session ? { sessionId: 'session_document_remount_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_document_remount_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto(entry)
  return { mutations, errors }
}

async function expectReading(page: Page, top: number) {
  await settle(page)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(top, 0)
  // A later browser restoration must not undo the router's remount alignment.
  await page.waitForTimeout(180)
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(top, 0)
}

test('separate visits to one URL retain distinct reading positions through Back and Forward', async ({ page, baseURL }) => {
  const evidence = await boot(page, baseURL, '/about/')
  await expect(page.locator('.client-info-about')).toBeVisible()
  await settle(page)
  await page.evaluate(() => scrollTo({ top: 480, behavior: 'instant' }))
  const firstKey = await page.evaluate(() => history.state.tethPublicDocumentEntry)
  await page.locator('.client-public-page .brand[href="/"]').click()
  await prepareHome(page)
  await page.locator('.client-service-app .client-site-footer a[href="/about/"]').first().click()
  await expect(page.locator('.client-info-about')).toBeVisible()
  await settle(page)
  await page.evaluate(() => scrollTo({ top: 920, behavior: 'instant' }))
  const secondKey = await page.evaluate(() => history.state.tethPublicDocumentEntry)
  expect(secondKey).not.toBe(firstKey)
  const length = await page.evaluate(() => history.length)
  // Source header navigation is intentionally hidden on mobile. Use the real
  // visible footer, recording its reading position after Playwright scrolls it
  // into view so that normal click preparation is not mistaken for a jump.
  const sameUrl = page.locator('.client-info-about .client-site-footer a[href="/about/"]')
  await sameUrl.click({ trial: true })
  await settle(page)
  const noOpPosition = await page.evaluate(() => scrollY)
  await sameUrl.click()
  expect(await page.evaluate(() => history.length)).toBe(length)
  await expectReading(page, noOpPosition)
  await page.evaluate(() => scrollTo({ top: 920, behavior: 'instant' }))
  await page.locator('.client-public-page .brand[href="/"]').click()
  await page.goBack()
  await expectReading(page, 920)
  await page.goBack()
  await verifyHome(page)
  await page.goBack()
  await expectReading(page, 480)
  await page.goForward()
  await verifyHome(page)
  await page.goForward()
  await expectReading(page, 920)
  expect(evidence.mutations).toEqual([])
  expect(evidence.errors).toEqual([])
})

test('unavailable history identity generation does not break public navigation', async ({ page, baseURL }) => {
  // Narrowly emulate a non-secure preview without replacing history or its
  // native restoration. This is not an authentication or crypto fallback.
  await page.addInitScript(() => Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }))
  const evidence = await boot(page, baseURL, '/about/')
  await expect(page.locator('.client-info-about')).toBeVisible()
  await page.locator('.client-info-about .client-site-footer a[href="/download/"]').click()
  await expect(page.locator('.client-info-download')).toBeVisible()
  await page.goBack()
  await expect(page.locator('.client-info-about')).toBeVisible()
  expect(evidence.errors).toEqual([])
  expect(evidence.mutations).toEqual([])
})

test('app entry and app Back preserve foreign history state without document metadata', async ({ page, baseURL }) => {
  const appState = { foreignApp: { selection: ['unchanged'] }, marker: 23 }
  await page.addInitScript(value => history.replaceState(value, ''), appState)
  const evidence = await boot(page, baseURL, '/')
  await prepareHome(page)
  expect(await page.evaluate(() => history.state)).toEqual(appState)
  await page.locator('.client-service-app .client-site-footer a[href="/about/"]').first().click()
  await expect(page.locator('.client-info-about')).toBeVisible()
  await page.goBack()
  await verifyHome(page)
  expect(await page.evaluate(() => history.state)).toEqual(appState)
  await page.goForward()
  await expect(page.locator('.client-info-about')).toBeVisible()
  await page.locator('.client-public-page .brand[href="/"]').click()
  await verifyHome(page)
  expect(await page.evaluate(() => history.state)).toEqual({ tethSite: true })
  expect(evidence.errors).toEqual([])
  expect(evidence.mutations).toEqual([])
})

test('fresh document navigation never consumes a matching reload coordinate receipt', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    const entry = 'entry_fresh_public_document'
    history.replaceState({ tethPublicDocumentEntry: entry, foreignOwner: 'preserved' }, '')
    sessionStorage.setItem('tethPublicDocumentReload', JSON.stringify({ entry, x: 0, y: 1900, savedAt: Date.now() }))
  })
  const evidence = await boot(page, baseURL, '/about/')
  await expect(page.locator('.client-info-about')).toBeVisible()
  await settle(page)
  await expectReading(page, 0)
  expect(await page.evaluate(() => history.state.foreignOwner)).toBe('preserved')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tethPublicDocumentReload')!).y)).toBe(1900)
  expect(evidence.errors).toEqual([])
  expect(evidence.mutations).toEqual([])
})

for (const kind of ['stale', 'foreign', 'malformed', 'disabled'] as const) test(`reload ignores ${kind} coordinate storage without breaking the document`, async ({ page, baseURL }) => {
  await page.addInitScript(kind => {
    if ((performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type !== 'reload') return
    if (kind === 'disabled') {
      Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Fixture storage disabled', 'SecurityError') } })
      return
    }
    const receipt = { entry: history.state?.tethPublicDocumentEntry, x: 0, y: 1900, savedAt: Date.now() }
    if (kind === 'stale') receipt.savedAt -= 120_000
    if (kind === 'foreign') receipt.entry = 'another_public_document_entry'
    sessionStorage.setItem('tethPublicDocumentReload', kind === 'malformed' ? '{not-json' : JSON.stringify(receipt))
  }, kind)
  const evidence = await boot(page, baseURL, '/about/')
  await expect(page.locator('.client-info-about')).toBeVisible()
  await settle(page)
  await page.evaluate(() => {
    history.replaceState({ ...history.state, foreignOwner: 'preserved' }, '')
    scrollTo({ top: 400, behavior: 'instant' })
  })
  await expectReading(page, 400)
  await page.reload()
  await expect(page.locator('.client-info-about')).toBeVisible()
  await settle(page)
  // Native restoration may still restore 400; a rejected receipt must never
  // send the reader to its unrelated 1900px coordinate or break rendering.
  expect(await page.evaluate(() => scrollY)).toBeLessThan(1000)
  expect(await page.evaluate(() => history.state.foreignOwner)).toBe('preserved')
  expect(evidence.errors).toEqual([])
  expect(evidence.mutations).toEqual([])
})

test('native fragment entries retain independent identity and positions', async ({ page, baseURL }, info) => {
  const evidence = await boot(page, baseURL, '/about/')
  await expect(page.locator('.client-info-about')).toBeVisible()
  await settle(page)
  await page.evaluate(() => scrollTo({ top: 760, behavior: 'instant' }))
  const initial = await page.evaluate(() => history.state.tethPublicDocumentEntry)
  await page.evaluate(() => { location.hash = 'pricing' })
  await expect(page).toHaveURL(/#pricing$/)
  await settle(page)
  const pricing = await page.evaluate(() => history.state.tethPublicDocumentEntry)
  await page.evaluate(() => scrollTo({ top: 1200, behavior: 'instant' }))
  await page.evaluate(() => { location.hash = 'faq' })
  await expect(page).toHaveURL(/#faq$/)
  await settle(page)
  const faq = await page.evaluate(() => history.state.tethPublicDocumentEntry)
  await info.attach('native-fragment-identities', { body: JSON.stringify({ initial, pricing, faq }), contentType: 'application/json' })
  expect(new Set([initial, pricing, faq]).size).toBe(3)
  await page.evaluate(() => scrollTo({ top: 1800, behavior: 'instant' }))
  await page.locator('.client-public-page .brand[href="/"]').click()
  await prepareHome(page)
  await page.goBack()
  await expectReading(page, 1800)
  await page.goBack()
  await expectReading(page, 1200)
  await page.goBack()
  await expectReading(page, 760)
  await page.goForward()
  await expectReading(page, 1200)
  await page.goForward()
  await expectReading(page, 1800)
  expect(evidence.mutations).toEqual([])
  expect(evidence.errors).toEqual([])
})

test('router metadata preserves existing object state through StrictMode and remount history', async ({ page, baseURL }) => {
  await page.addInitScript(() => history.replaceState({ foreignOwner: { selected: ['kept'] }, marker: 7 }, ''))
  const evidence = await boot(page, baseURL, '/download/')
  await expect(page.locator('.client-info-download')).toBeVisible()
  await settle(page)
  const first = await page.evaluate(() => history.state)
  expect(first).toMatchObject({ foreignOwner: { selected: ['kept'] }, marker: 7, tethPublicDocumentEntry: expect.any(String) })
  await page.evaluate(() => {
    history.replaceState({ ...history.state, lateOwner: 'retained' }, '')
    scrollTo({ top: 680, behavior: 'instant' })
  })
  await page.locator('.client-public-page .brand[href="/"]').click()
  await prepareHome(page)
  await page.goBack()
  await expectReading(page, 680)
  expect(await page.evaluate(() => history.state)).toEqual({ ...first, lateOwner: 'retained' })
  expect(await page.evaluate(() => history.scrollRestoration)).toBe('auto')
  expect(await page.locator('#site-main').evaluate(element => element === document.activeElement)).toBe(true)
  await page.mouse.wheel(0, 200)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(700)
  const afterUser = await page.evaluate(() => scrollY)
  await page.waitForTimeout(180)
  expect(await page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(afterUser)
  expect(evidence.mutations).toEqual([])
  expect(evidence.errors).toEqual([])
})

async function settle(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

const draft = '정보 페이지를 읽고 돌아와도 이 초안과 선택은 유지합니다.'
async function prepareHome(page: Page) {
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.locator('#strategy-idea').fill(draft)
  await page.locator('.g-tpl[data-k="acts"][data-id="auto"]').click()
  await expect(page.locator('.g-tpl[data-id="auto"]')).toHaveAttribute('aria-pressed', 'true')
}
async function verifyHome(page: Page) {
  await expect(page.locator('#strategy-idea')).toHaveValue(draft)
  await expect(page.locator('.g-tpl[data-id="auto"]')).toHaveAttribute('aria-pressed', 'true')
}

for (const width of [320, 390, 1440]) for (const document of ['about', 'download', 'policies'] as const) {
  for (const entry of ['app-link', 'direct-url'] as const) test(`${width}px ${document} ${entry} remount Back preserves document reading and service state`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height: 480 })
    const href = `/${document}/${document === 'policies' ? '#privacy' : ''}`
    const evidence = await boot(page, baseURL, entry === 'app-link' ? '/' : href)
    if (entry === 'app-link') {
      await prepareHome(page)
      // Footer links are available at all breakpoints and keep their real hrefs.
      const link = page.locator('.client-service-app .client-site-footer').locator(`a[href="${href}"]`).first()
      await link.click()
    }
    await expect(page).toHaveURL(new RegExp(`/${document}/${document === 'policies' ? '#privacy' : ''}$`))
    await expect(page.locator(`.client-info-${document}`)).toBeVisible()
    await settle(page)
    // Record a genuine document scroll; no history/router/store monkey patch.
    await page.evaluate(() => window.scrollTo({ top: 760, behavior: 'instant' }))
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200)
    const before = await page.evaluate(() => scrollY)
    await page.locator('.client-public-page .brand[href="/"]').click()
    await expect(page.locator('.client-public-page')).toHaveCount(0)
    if (entry === 'app-link') await verifyHome(page)
    else await prepareHome(page)
    await page.goBack()
    await expect(page.locator(`.client-info-${document}`)).toBeVisible()
    await settle(page)
    const after = await page.evaluate(() => scrollY)
    await info.attach('document-remount-position', { body: JSON.stringify({ width, document, entry, before, after }), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('document-remount-back.png') })
    expect.soft(Math.abs(after - before), 'A remounted document must keep its browser Back reading position').toBeLessThanOrEqual(2)
    if (document === 'policies') await expect(page.locator('.ptab[data-v="privacy"], [data-v="privacy"][aria-current="page"]')).toHaveCount(1)
    await page.goForward()
    await expect(page.locator('.client-public-page')).toHaveCount(0)
    await verifyHome(page)
    expect(evidence.mutations).toEqual([])
    expect(evidence.errors).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}
