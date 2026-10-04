import { expect, test, type Page } from '@playwright/test'

// Source 9fbff821 uses separate public documents. FAQ links in the React help
// widget are an integration affordance, not an invented original help action.
// Exercise both real entry points, never a reconstructed public component.
async function mount(page: Page, baseURL: string, service: boolean) {
  const origin = new URL(baseURL).origin
  const errors: string[] = [], forbidden: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method()) || url.origin !== origin || url.pathname.startsWith('/api/')) {
      forbidden.push(`${request.method()} ${url.pathname}`)
      return route.abort('blockedbyclient')
    }
    if (service && request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/download/')
  await expect(page.locator('.client-info-download')).toBeVisible()
  return { errors, forbidden }
}

async function settledLayout(page: Page) {
  await page.evaluate(async () => {
    const frames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await frames()
    await document.fonts.ready
    // The regression was a real 0.01ms CSS layout transition, not a slow font.
    // Wait for its completion before asserting the final destination, rather
    // than accepting the briefly correct position before the layout changes.
    await Promise.all(document.querySelector('#site-main')!.getAnimations({ subtree: true }).map(animation => animation.finished))
    await frames()
  })
}

for (const service of [false, true]) for (const width of [320, 390, 1440]) for (const motion of ['reduce', 'no-preference'] as const) {
  test(`${service ? 'service' : 'public'} FAQ return ${width} ${motion} preserves the section and document history`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Local origin required')
    await page.setViewportSize({ width, height: width === 320 ? 360 : width === 390 ? 844 : 900 })
    await page.emulateMedia({ reducedMotion: motion })
    const evidence = await mount(page, baseURL, service)
    await page.locator('.gft-col button').click()
    await expect(page.locator('.client-modal-help .help-close')).toBeFocused()
    const returnY = await page.evaluate(() => scrollY)
    await page.locator('.client-modal-help a[href="/about/#faq"]').click()
    await expect(page).toHaveURL(/\/about\/#faq$/)
    await expect(page.locator('#faq')).toBeVisible()
    await settledLayout(page)
    const bounds = await page.locator('#faq').evaluate(element => ({ top: element.getBoundingClientRect().top, header: document.querySelector('.hd')!.getBoundingClientRect().bottom, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth }))
    await info.attach('FAQ-final-layout', { body: JSON.stringify(bounds), contentType: 'application/json' })
    expect(bounds.top).toBeGreaterThanOrEqual(bounds.header)
    expect(bounds.top).toBeLessThan(bounds.height - 44)
    expect(Math.abs(bounds.top - 128)).toBeLessThanOrEqual(1)
    expect(bounds.overflow).toBe(false)
    await expect(page.locator('#site-main')).toBeFocused()
    await expect(page.locator('.client-modal-help')).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/\/download\/$/)
    await settledLayout(page)
    expect(Math.abs(await page.evaluate(() => scrollY) - returnY)).toBeLessThanOrEqual(2)
    await page.goForward()
    await expect(page).toHaveURL(/\/about\/#faq$/)
    await settledLayout(page)
    expect(Math.abs(await page.locator('#faq').evaluate(element => element.getBoundingClientRect().top) - 128)).toBeLessThanOrEqual(2)
    expect(evidence.errors).toEqual([])
    expect(evidence.forbidden).toEqual([])
  })
}
