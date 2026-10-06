import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// Frozen translation of approved9fb Korean semantics. This is not read from the
// current product dictionary, nor evidence of provider capabilities/legal GO.
const golden = JSON.parse(readFileSync(new URL('./fixtures/approved-footer-locales.json', import.meta.url), 'utf8')) as Record<string, { intro: string; tagline: string; consent: string; allRightsReserved: string }>
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const routes = ['/', '/about/', '/download/', '/policies/#terms', '/policies/#privacy'] as const

for (const language of languages) test(`footer all visible routes: approved ${language} semantics, brand, retained locale and no overflow`, async ({ page, context, baseURL }, info) => {
  if (!baseURL) throw Error('Local origin required')
  const origin = new URL(baseURL).origin
  const audit = { errors: [] as string[], external: 0, mutations: 0, api: 0 }
  page.on('pageerror', error => audit.errors.push(error.message))
  await context.routeWebSocket(/.*/, socket => socket.close())
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external++; return route.abort() }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations++; return route.abort() }
    if (url.pathname.startsWith('/api/')) { audit.api++; return route.abort() }
    return route.continue()
  })
  await context.addInitScript(({ language, origin }) => {
    if (location.origin !== origin) return
    localStorage.setItem('tethLang', language)
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
  }, { language, origin })
  await page.setViewportSize({ width: info.project.name === 'desktop' ? 1440 : 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const approved = golden[language]
  const paragraphs = [approved.intro, approved.tagline, approved.consent, `© 2026 TETH AI. ${approved.allRightsReserved}.`]
  for (const route of routes) {
    await page.goto(route)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    const footer = page.locator('.client-site-footer')
    await expect(footer).toHaveCount(1)
    await expect(footer).toHaveAttribute('lang', language)
    await expect(footer.locator('.gft-copy > p')).toHaveText(paragraphs)
    await expect(footer.locator('.gft-pw')).toHaveText('Powered by Bitget')
    await expect(footer.locator('.gft-pw > span')).toHaveAttribute('lang', 'en')
    await footer.scrollIntoViewIfNeeded()
    expect(await footer.evaluate(node => {
      const body = node.querySelector<HTMLElement>('.gft-copy')!
      const rect = body.getBoundingClientRect()
      return rect.width > 0 && rect.left >= -1 && rect.right <= innerWidth + 1 && body.scrollWidth <= body.clientWidth + 1
    })).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe(language)
    if (route === '/' && language === 'fr') await page.screenshot({ path: info.outputPath('footer-fr.png'), fullPage: true, animations: 'disabled' })
  }
  expect(audit).toEqual({ errors: [], external: 0, mutations: 0, api: 0 })
  await info.attach('footer-locale-boundary.json', { body: JSON.stringify({ language, routes, approvedKoreanSource: '9fbff821', translationOnly: true, actualProviderVerified: false, audit }), contentType: 'application/json' })
})

test('footer language changes in the current React tree without translating user content', async ({ page, context }) => {
  await context.routeWebSocket(/.*/, socket => socket.close())
  await page.goto('/')
  await page.addScriptTag({ type: 'module', content: 'import { setClientPreference } from "/src/client-preferences.ts"; window.footerLocaleSet = language => setClientPreference("language", language);' })
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { footerLocaleSet?: unknown }).footerLocaleSet)).toBe('function')
  for (const language of [...languages.slice(1), 'ko']) {
    expect(await page.evaluate(language => (window as unknown as { footerLocaleSet: (language: string) => boolean }).footerLocaleSet(language), language)).toBe(true)
    await expect(page.locator('.client-site-footer')).toHaveAttribute('lang', language)
    await expect(page.locator('.gft-copy > p').nth(0)).toHaveText(golden[language].intro)
    await expect(page.locator('.gft-pw')).toHaveText('Powered by Bitget')
  }
})
