import { expect, test } from '@playwright/test'

// Independent literals from fixed tesia-lab 9fbff821 download/index.html:
// static KO CTA:93, PI.login:132, PIDX>0 replacement:175–185.
// This deliberately does not import the product's translation dictionaries.
const original = [
  { language: 'ko', cta: '시작하기' },
  { language: 'en', cta: 'Log in' },
  { language: 'ja', cta: 'ログイン' },
  { language: 'zh-CN', cta: '登录' },
  { language: 'zh-TW', cta: '登入' },
  { language: 'es', cta: 'Iniciar sesión' },
  { language: 'fr', cta: 'Se connecter' },
] as const

// Source logo:90, Apple SVG:103, CSS store>svg:35. Mobile CSS:59–69
// changes the store grid, not the SVG's 28px dimensions. The initially
// drafted mobile-24 oracle was corrected from this independent source.
const sourceArtwork = {
  brandWidth: 22,
  appleFill: 'rgb(236, 236, 236)',
  viewBox: '0 0 24 24',
  applePath: 'M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.93-2.13-1.67-.17-3.26.98-4.1.98-.85 0-2.16-.96-3.55-.93-1.82.03-3.5 1.06-4.44 2.69-1.9 3.29-.49 8.16 1.36 10.83.9 1.3 1.98 2.77 3.39 2.72 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.29-2.64 1.04-1.52 1.47-2.99 1.49-3.06-.03-.02-2.86-1.1-2.9-4.34zM14.34 4.56c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z',
} as const

for (const source of original) for (const width of [1440, 320]) {
  test(`Download header [${source.language}] ${width}px ${source.language === 'en' && width === 1440 ? 'English 대표' : '원본'} CTA·brand·Apple SVG·geometry`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Local test origin required')
    const origin = new URL(baseURL).origin
    const audit = { pageErrors: [] as string[], external: [] as string[], mutations: [] as string[], api: [] as string[] }
    page.on('pageerror', error => audit.pageErrors.push(error.message))
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== origin) { audit.external.push(request.method()); return route.abort('blockedbyclient') }
      if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(request.method()); return route.abort('blockedbyclient') }
      if (url.pathname.startsWith('/api/')) { audit.api.push(url.pathname); return route.abort('blockedbyclient') }
      return route.continue()
    })
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      localStorage.setItem('tethLang', 'ko')
      sessionStorage.removeItem('teth-client-profile-preview')
      sessionStorage.setItem('teth-app-banner-dismissed', '1')
    })
    await page.goto('/download/')
    const root = page.locator('.client-info-download'), header = root.locator('header.hd')
    await expect(header).toBeVisible()
    // Reuse the existing language-sync harness: import the real module once,
    // then synchronously call its stable setter, not fabricated storage events.
    await page.evaluate(async () => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      Reflect.set(window, 'setCopyTradingPreference', setClientPreference)
      await document.fonts.ready
    })
    expect(await page.evaluate(language => {
      const setter = Reflect.get(window, 'setCopyTradingPreference') as typeof import('../src/client-preferences').setClientPreference | undefined
      return typeof setter === 'function' && setter('language', language)
    }, source.language)).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('lang', source.language)
    await page.evaluate(() => document.fonts.ready)

    const brand = header.locator('a.brand'), cta = header.locator('a.cta')
    const apple = root.locator('#store-ios > svg')
    const google = root.locator('#store-android > svg')
    await expect(brand).toBeVisible()
    await expect(cta).toBeVisible()
    await expect(apple).toHaveCount(1)
    await expect(brand).toHaveAttribute('href', '/')
    await expect(cta).toHaveAttribute('href', '/')
    await expect(apple).toHaveAttribute('viewBox', sourceArtwork.viewBox)
    await expect(apple).toHaveAttribute('aria-hidden', 'true')
    await expect(apple.locator('path')).toHaveAttribute('d', sourceArtwork.applePath)
    const observed = {
      cta: await cta.innerText(),
      brand: await brand.locator('img').evaluate(node => {
        const image = node as HTMLImageElement, box = image.getBoundingClientRect()
        return { width: box.width, height: box.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight }
      }),
      apple: await apple.evaluate(node => {
        const box = node.getBoundingClientRect()
        return { width: box.width, height: box.height, fill: getComputedStyle(node.querySelector('path')!).fill }
      }),
      google: await google.evaluate(node => {
        const box = node.getBoundingClientRect()
        return { width: box.width, height: box.height }
      }),
      geometry: await header.evaluate(node => {
        const box = node.getBoundingClientRect(), brand = node.querySelector('a.brand')!, cta = node.querySelector('a.cta')!
        const brandBox = brand.getBoundingClientRect(), ctaBox = cta.getBoundingClientRect()
        const range = document.createRange(); range.selectNodeContents(cta)
        const text = range.getBoundingClientRect()
        const inViewport = (rect: DOMRect) => rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
        const hit = document.elementFromPoint(ctaBox.x + ctaBox.width / 2, ctaBox.y + ctaBox.height / 2)
        return {
          headerInViewport: inViewport(box), brandInViewport: inViewport(brandBox), ctaInViewport: inViewport(ctaBox),
          ctaHeight: ctaBox.height, textFits: text.left >= ctaBox.left && text.right <= ctaBox.right && text.top >= ctaBox.top && text.bottom <= ctaBox.bottom,
          controlsDoNotOverlap: brandBox.right <= ctaBox.left,
          ctaHit: hit !== null && cta.contains(hit),
          overflow: document.documentElement.scrollWidth - innerWidth,
          visibleNav: getComputedStyle(node.querySelector('nav')!).display !== 'none',
        }
      }),
    }
    await info.attach('original-download-header', { body: JSON.stringify({ language: source.language, width, source, sourceArtwork, observed }), contentType: 'application/json' })
    // Immediate soft checks keep independent geometry/navigation coverage on RED.
    expect.soft(observed.cta, '원본 static KO / PI.login non-KO CTA').toBe(source.cta)
    expect.soft(observed.brand.width, '원본 22px 로고 실제 너비').toBe(sourceArtwork.brandWidth)
    expect.soft(observed.apple.fill, '원본 Apple path 실제 색상').toBe(sourceArtwork.appleFill)
    expect(observed.brand.naturalWidth).toBeGreaterThan(0)
    expect(observed.brand.height).toBeCloseTo(observed.brand.width * observed.brand.naturalHeight / observed.brand.naturalWidth, 1)
    expect(observed.apple.width).toBe(28)
    expect(observed.apple.height).toBe(28)
    expect(observed.google).toEqual({ width: 28, height: 28 })
    expect(observed.geometry).toEqual({
      headerInViewport: true, brandInViewport: true, ctaInViewport: true, ctaHeight: expect.any(Number),
      textFits: true, controlsDoNotOverlap: true, ctaHit: true, overflow: 0, visibleNav: width > 900,
    })
    expect(observed.geometry.ctaHeight).toBeGreaterThanOrEqual(44)
    await cta.focus()
    await expect(cta).toBeFocused()
    await cta.press('Enter')
    await expect(page).toHaveURL(`${baseURL}/`)
    await expect(page.locator('.client-source-app')).toBeVisible()
    await expect(page.locator('#strategy-idea')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', source.language)
    expect(audit).toEqual({ pageErrors: [], external: [], mutations: [], api: [] })
  })
}
