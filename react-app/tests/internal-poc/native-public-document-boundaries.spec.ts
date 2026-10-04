import { expect, test, type Page } from '@playwright/test'

// Original 9fbff821 public documents use native document navigation. The
// candidate's FAQ/help links are integration affordances, not literal source
// help-widget markup. Test their real destinations without inventing source
// copy or replacing the original document's reading/history behavior.
// Exercise the actual service router, not a recreated public component.
// Direct document entry deliberately does not mount the conversation/API.
async function mount(page: Page, baseURL: string | undefined) {
  if (!baseURL) throw new Error('Local test origin required')
  const origin = new URL(baseURL).origin
  const errors: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) {
      mutations.push(`${request.method()} ${url.pathname}`)
      return route.abort('blockedbyclient')
    }
    if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.abort('blockedbyclient')
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/download/')
  await expect(page.locator('.client-info-download')).toBeVisible()
  await settleFonts(page)
  return { errors, mutations }
}

async function settleFonts(page: Page) {
  await page.evaluate(async () => {
    // New text can request a new font subset after a route's first render.
    // Wait for actual layout/font readiness, never a fixed network delay.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

async function openFaqFromDownload(page: Page) {
  const entry = page.getByRole('button', { name: '상담원에게 묻기', exact: true })
  await entry.click()
  const modal = page.locator('.client-modal-help .site-help-pop')
  await expect(modal.locator('.help-close')).toBeFocused()
  const returnY = await page.evaluate(() => window.scrollY)
  expect(returnY).toBeGreaterThan(100)
  await modal.locator('a[href="/about/#faq"]').click()
  await expect(page).toHaveURL(/\/about\/#faq$/)
  await expect(page.locator('#faq')).toBeVisible()
  await settleFonts(page)
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  await expect(page.locator('#site-main')).toBeFocused()
  return returnY
}

test('service download help FAQ lands on the requested section after font layout settles', async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 480 })
  const evidence = await mount(page, baseURL)
  await openFaqFromDownload(page)
  const bounds = await page.locator('#faq').evaluate(element => ({
    top: element.getBoundingClientRect().top,
    headerBottom: document.querySelector('.hd')!.getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
    scrollY,
    fonts: document.fonts.status,
  }))
  await info.attach('settled-faq-position', { body: JSON.stringify(bounds), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('faq-arrival.png') })
  expect.soft(bounds.top).toBeGreaterThanOrEqual(bounds.headerBottom)
  expect.soft(bounds.top, 'FAQ heading must be visible below the fixed header').toBeLessThan(bounds.viewportHeight - 44)
  expect(evidence.errors).toEqual([])
  expect(evidence.mutations).toEqual([])
})

test('service public browser Back restores the reading position instead of resetting to the top', async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 480 })
  const evidence = await mount(page, baseURL)
  const returnY = await openFaqFromDownload(page)
  await page.goBack()
  await expect(page).toHaveURL(/\/download\/$/)
  await settleFonts(page)
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
  const returnedY = await page.evaluate(() => scrollY)
  await info.attach('history-scroll-position', { body: JSON.stringify({ returnY, returnedY }), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('download-history-return.png') })
  expect.soft(Math.abs(returnedY - returnY), 'Back keeps the original document reading position').toBeLessThanOrEqual(2)
  expect(evidence.errors).toEqual([])
  expect(evidence.mutations).toEqual([])
})

for (const intent of ['wheel', 'keyboard'] as const) test(`service pending FAQ font alignment yields to trusted ${intent} input`, async ({ page, baseURL }, info) => {
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 320 : 1440, height: 480 })
  const evidence = await mount(page, baseURL)
  await page.getByRole('button', { name: '상담원에게 묻기', exact: true }).click()
  const modal = page.locator('.client-modal-help .site-help-pop')
  await expect(modal.locator('.help-close')).toBeFocused()
  let blockedFonts = 0
  let releaseFonts!: () => void
  const gate = new Promise<void>(resolve => { releaseFonts = resolve })
  // Hold actual local font responses, not document.fonts.ready or app state.
  // The untouched service renderer must abandon only its pending auto-align.
  await page.route('**/*.woff2*', async route => {
    blockedFonts++
    await gate
    await route.fallback()
  })
  try {
    await modal.locator('a[href="/about/#faq"]').click()
    await expect(page.locator('#faq')).toBeVisible()
    await expect(page.locator('#site-main')).toBeFocused()
    await expect.poll(() => blockedFonts).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.fonts.status)).toBe('loading')
    const beforeY = await page.evaluate(() => scrollY)
    await page.evaluate(() => {
      const state = window as typeof window & { publicDocumentScrollCalls?: number }
      state.publicDocumentScrollCalls = 0
      const scroll = window.scrollTo.bind(window)
      window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
        state.publicDocumentScrollCalls!++
        return scroll(...args)
      }) as typeof window.scrollTo
    })
    if (intent === 'wheel') {
      await page.mouse.move(160, 240)
      await page.mouse.wheel(0, -180)
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(beforeY)
    } else {
      await page.keyboard.press('Tab')
      await expect(page.locator('#site-main')).not.toBeFocused()
    }
    const ownedFocus = await page.evaluate(() => document.activeElement?.outerHTML)
    releaseFonts()
    await settleFonts(page)
    const after = await page.evaluate(() => ({
      scrollCalls: (window as typeof window & { publicDocumentScrollCalls?: number }).publicDocumentScrollCalls,
      focus: document.activeElement?.outerHTML,
      fontStatus: document.fonts.status,
    }))
    await info.attach('user-owned-font-settlement', { body: JSON.stringify({ intent, blockedFonts, beforeY, ...after }), contentType: 'application/json' })
    expect(after.fontStatus).toBe('loaded')
    expect(after.scrollCalls, 'No late programmatic realignment after user intent').toBe(0)
    expect(after.focus, 'Font completion must not steal user focus').toBe(ownedFocus)
    expect(evidence.errors).toEqual([])
    expect(evidence.mutations).toEqual([])
  } finally {
    releaseFonts()
  }
})
