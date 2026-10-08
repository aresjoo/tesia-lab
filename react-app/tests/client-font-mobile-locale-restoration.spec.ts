import { expect, test, type Page } from '@playwright/test'

const widths = [320, 390, 640, 860, 861, 1440] as const
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const originalFont = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif'

test.use({ serviceWorkers: 'block' })

async function openSettings(page: Page, width: number) {
  let trigger = page.locator('[data-sidebar-action="account"],[data-sidebar-action="profile-settings"]')
  if (width <= 860) {
    await page.locator('.client-hamburger').click()
    trigger = page.locator('[data-sidebar-action="profile-settings"]')
  }
  await expect(trigger).toBeVisible()
  await trigger.click()
  const settings = page.locator('.ca-settings [data-menu-action="settings"]')
  await expect(settings).toBeVisible()
  await settings.click()
  await expect(page.locator('.client-settings-page h1')).toBeVisible()
}

for (const width of widths) test(`${width}px 원본 글꼴과 모바일 설정 언어 경로를 보존한다`, async ({ page, baseURL }, info) => {
  if (!baseURL) throw new Error('Local test origin required')
  const origin = new URL(baseURL).origin
  const audit = { errors: [] as string[], external: [] as string[], mutations: [] as string[], api: [] as string[] }
  page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (url.origin !== origin) { audit.external.push(method); return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(method)) { audit.mutations.push(method); return route.abort('blockedbyclient') }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) { audit.api.push(method); return route.abort('blockedbyclient') }
    return route.continue()
  })
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
  })
  await page.goto('/')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)

  const shell = page.locator('.tesia-shell.conversation-surface')
  await expect(shell).toHaveCSS('font-family', originalFont)
  const heading = page.locator('.client-hero-title')
  await expect(heading).toHaveCSS('font-family', originalFont)

  const globe = page.locator('.client-globe')
  await expect(globe).toHaveCount(1)
  if (width <= 860) await expect(globe).toBeHidden()
  else {
    await expect(globe).toBeVisible()
    const hitArea = await globe.boundingBox()
    expect(hitArea?.width).toBeGreaterThanOrEqual(44)
    expect(hitArea?.height).toBeGreaterThanOrEqual(44)
    await expect(globe.locator('svg')).toHaveAttribute('width', '20')
    await expect(globe.locator('svg')).toHaveAttribute('height', '20')
  }

  await page.evaluate(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '언어 경로 검수', email: 'locale@example.test' })))
  await page.reload()
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.locator('.client-globe')).toHaveCount(0)
  const input = page.locator('#strategy-idea')
  await input.fill('언어를 바꿔도 보존할 질문')
  const inputNode = await input.elementHandle()
  await openSettings(page, width)
  const surface = page.locator('.client-settings-page')
  const select = surface.getByRole('combobox')
  await expect(select).toBeVisible()
  await expect(select.locator('option')).toHaveCount(languages.length)
  expect(await select.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(languages)
  for (const language of languages) {
    await select.selectOption(language)
    await expect(select).toHaveValue(language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe(language)
    expect(await surface.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  }

  if (width <= 900) await surface.locator('.stg-mback').click()
  await surface.locator('.stg-back').click()
  await expect(input).toBeVisible()
  await expect(input).toHaveValue('언어를 바꿔도 보존할 질문')
  expect(await input.evaluate((node, original) => node === original, inputNode)).toBe(true)
  expect(audit).toEqual({ errors: [], external: [], mutations: [], api: [] })
  expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true)
  await info.attach('font-mobile-locale-restoration', { body: JSON.stringify({ width, font: originalFont, languages, originalMobileGlobeHidden: width <= 860, audit }), contentType: 'application/json' })
})
