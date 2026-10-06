import { expect, test, type Page } from '@playwright/test'

// Independent literals from fixed tesia-lab 9fbff821 index.html:
// menu.glc:26390, glc.lang:26422, GLC_LANGS:26257–26264.
// Final R07:6716–6717 hides currency controls but keeps menu.glc on the
// guest globe (applyLang:26617 accessible name / 26662 hover label).
const original = [
  { language: 'ko', globe: '언어 및 통화', column: '언어', choice: '한국어' },
  { language: 'en', globe: 'Language & currency', column: 'Language', choice: 'English' },
  { language: 'ja', globe: '言語と通貨', column: '言語', choice: '日本語' },
  { language: 'zh-CN', globe: '语言与货币', column: '语言', choice: '简体中文' },
  { language: 'zh-TW', globe: '語言與貨幣', column: '語言', choice: '繁體中文' },
  { language: 'es', globe: 'Idioma y moneda', column: 'Idioma', choice: 'Español' },
  { language: 'fr', globe: 'Langue et devise', column: 'Langue', choice: 'Français' },
] as const

async function setLanguage(page: Page, language: typeof original[number]['language']) {
  // Reuse the existing copy-trading language harness: import the real setter
  // once after mount, then call that same module synchronously for selection.
  expect(await page.evaluate(language => {
    const setter = Reflect.get(window, 'setCopyTradingPreference') as typeof import('../src/client-preferences').setClientPreference | undefined
    return typeof setter === 'function' && setter('language', language)
  }, language)).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('lang', language)
}

for (const source of original) {
  test(`Main guest 1440px [${source.language}] ${source.language === 'ko' ? 'Korean 대표' : '원본'} globe 라벨·언어 전용 패널·닫기 초점`, async ({ page, baseURL }, info) => {
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
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      localStorage.setItem('tethLang', 'ko')
      sessionStorage.removeItem('teth-client-profile-preview')
      sessionStorage.setItem('teth-app-banner-dismissed', '1')
    })
    await page.goto('/')
    await expect(page.locator('.client-source-app')).toBeVisible()
    await expect(page.locator('.client-auth-nav')).toBeVisible()
    await expect(page.locator('#strategy-idea')).toBeVisible()
    await page.evaluate(async () => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      Reflect.set(window, 'setCopyTradingPreference', setClientPreference)
      await document.fonts.ready
    })
    await setLanguage(page, source.language)

    const globe = page.locator('.client-globe'), tooltip = globe.locator(':scope > span')
    await expect(globe).toHaveCount(1)
    await expect(globe).toBeVisible()
    await globe.hover()
    await expect(tooltip).toHaveCSS('opacity', '1')
    const observed = await globe.evaluate(node => ({ label: node.getAttribute('aria-label'), hover: node.querySelector(':scope > span')?.textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))
    await info.attach('original-globe-label', { body: JSON.stringify({ language: source.language, source, observed }), contentType: 'application/json' })
    // Soft, immediate comparisons keep the panel/closing checks executable
    // on the original RED, without waiting for a known wrong copy to change.
    expect.soft(observed.label, '원본 menu.glc 접근성 이름').toBe(source.globe)
    expect.soft(observed.hover, '원본 menu.glc hover 문구').toBe(source.globe)
    expect(observed.width).toBeGreaterThanOrEqual(44)
    expect(observed.height).toBeGreaterThanOrEqual(44)

    await globe.focus()
    await expect(globe).toBeFocused()
    await globe.press('Enter')
    const panel = page.locator('.client-locale-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toBeFocused()
    await expect(panel).toHaveAccessibleName(source.column)
    await expect(panel.getByRole('region', { name: source.column, exact: true })).toHaveCount(1)
    await expect(panel.locator('li button > span:first-child')).toHaveText(original.map(item => item.choice))
    await expect(panel.locator('li button[aria-pressed="true"] > span:first-child')).toHaveText(source.choice)
    await expect(page.locator('#locale-currency,#locale-tab-currency')).toHaveCount(0)
    await expect(panel.getByRole('tab')).toHaveCount(0)
    await expect(panel.getByRole('searchbox')).toHaveCount(1)
    const geometry = await panel.evaluate(node => {
      const box = node.getBoundingClientRect()
      return { withinViewport: box.x >= 0 && box.y >= 0 && box.right <= innerWidth && box.bottom <= innerHeight, overflow: document.documentElement.scrollWidth - innerWidth }
    })
    expect(geometry.withinViewport).toBe(true)
    expect(geometry.overflow).toBeLessThanOrEqual(0)
    await info.attach('original-language-panel', { body: JSON.stringify({ language: source.language, geometry }), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath(`original-globe-${source.language}.png`) })
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(globe).toBeFocused()
    expect(await page.locator('#root').getAttribute('inert')).toBeNull()
    expect(audit).toEqual({ pageErrors: [], external: [], mutations: [], api: [] })
  })
}
