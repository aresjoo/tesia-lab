import { expect, test, type Page } from '@playwright/test'
import { TEST_ORIGIN } from './test-origin'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const entry = {
  ko: ['화면을 불러오지 못했습니다. 다시 시도해주세요.', '다시 불러오기', 'TETH AI — 거래를 위한 AI'],
  en: ['The screen could not be loaded. Please try again.', 'Reload', 'TETH AI — AI for Trading'],
  ja: ['画面を読み込めませんでした。もう一度お試しください。', '再読み込み', 'TETH AI — 取引のためのAI'],
  'zh-CN': ['未能加载界面。请重试。', '重新加载', 'TETH AI — 为交易而生的 AI'],
  'zh-TW': ['未能載入畫面。請再試一次。', '重新載入', 'TETH AI — 為交易而生的 AI'],
  es: ['No se pudo cargar la pantalla. Inténtalo de nuevo.', 'Volver a cargar', 'TETH AI — IA para operar'],
  fr: ["L'écran n'a pas pu être chargé. Veuillez réessayer.", 'Recharger', "TETH AI — l'IA pour le trading"],
} as const
test.use({ trace: 'off', video: 'off' })

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const module = await import(path)
    module.setClientPreference('language', value)
  }, value)
}

test('bootstrap failure uses the stored locale without the React bundle', async ({ page }) => {
  await page.route('**/src/client-bootstrap.tsx*', route => route.abort('failed'))
  await page.addInitScript(() => localStorage.setItem('tethLang', sessionStorage.getItem('entry-test-language') ?? 'en'))
  for (const locale of ['en', ...locales.filter(value => value !== 'en')] as const) {
    await page.goto('/')
    await page.evaluate(locale => { sessionStorage.setItem('entry-test-language', locale); localStorage.setItem('tethLang', locale) }, locale)
    await page.reload()
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toHaveText(entry[locale][0])
    const label = await alert.innerText()
    expect(label.length).toBeGreaterThan(10)
    if (locale !== 'ko') expect(label).not.toMatch(/[가-힣]/)
    const retry = page.getByRole('button')
    await expect(retry).toHaveCount(1)
    await expect(retry).toHaveText(entry[locale][1])
    if (locale !== 'ko') expect(await retry.innerText()).not.toMatch(/[가-힣]/)
    // The retry is still a real reload; it does not initialize an auth client.
    await retry.click()
    await expect(alert).toHaveText(label)
  }
})

test('notice translations preserve Korean, request codes and unrecognized provider prose', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const modulePath = '/src/internal-poc/native-app-ui-copy.ts'
    const dataPath = '/src/internal-poc/native-app-ui-copy.json'
    const { nativeAppNotice } = await import(modulePath)
    const { default: copy } = await import(dataPath)
    const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
    const raw = ['User-authored 한국어 그대로', 'Provider: session expired', 'UNKNOWN_CODE · 서버 응답 원문', 'REQUEST_UNCONFIRMED · 서버의 자유로운 원문']
    return { entries: Object.entries(copy).map(([original]) => ({ original, values: locales.map(locale => nativeAppNotice(locale, original)) })),
      rawPreserved: locales.every(locale => raw.every(value => nativeAppNotice(locale, value) === value)),
      coded: locales.map(locale => nativeAppNotice(locale, 'NOT_READY · 서버가 아직 실행 준비를 마치지 못해 백테스트를 시작하지 못했습니다. 요청은 그대로 보관되어 있으며 자동으로 다시 시도하지 않으니, 준비가 끝난 뒤 같은 요청으로 재개해 주세요.')),
      validation: locales.map(locale => nativeAppNotice(locale, '전략 검증 실패: LIMIT_EXCEEDED, $&, UNKNOWN_FUTURE_CODE')) }
  })
  expect(result.entries).toHaveLength(43)
  for (const { original, values } of result.entries) {
    expect(values[0]).toBe(original)
    for (const value of values.slice(1)) { expect(value.length).toBeGreaterThan(0); expect(value).not.toMatch(/[가-힣]/) }
  }
  expect(result.rawPreserved).toBe(true)
  for (const value of result.coded) expect(value).toMatch(/^NOT_READY · /)
  for (const value of result.validation) expect(value).toContain('LIMIT_EXCEEDED, $&, UNKNOWN_FUTURE_CODE')
})

test('app title follows retained language without replacing the draft or moving focus', async ({ page }) => {
  await page.goto('/')
  const input = page.locator('textarea').first()
  await input.fill('keep my draft')
  await input.focus()
  for (const locale of ['en', ...locales.filter(value => value !== 'en')] as const) {
    await language(page, locale)
    await expect(page).toHaveTitle(entry[locale][2])
    if (locale !== 'ko') expect(await page.title()).not.toMatch(/[가-힣]/)
    await expect(input).toHaveValue('keep my draft')
    await expect(input).toBeFocused()
  }
  // Actual internal links, not synthetic navigation events. Public page
  // titles cannot overwrite the app title when its retained draft returns.
  await page.locator('.client-site-footer a[href="/about/"]').first().click()
  await expect(page.locator('.client-info-about')).toBeVisible()
  await page.locator('.client-info-about .ab-cta[href="/"]').click()
  await expect(page).toHaveTitle(entry.fr[2])
  await expect(input).toHaveValue('keep my draft')
})

test('actual Native service session failure updates seven locales without issuing a new request', async ({ page }) => {
  let requests = 0
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== TEST_ORIGIN) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) { requests++; return route.abort('failed') }
    if (route.request().isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  const alert = page.locator('.client-service-issue [role="alert"]')
  await expect(alert).toBeVisible()
  const before = requests
  for (const locale of ['en', ...locales.filter(value => value !== 'en')]) {
    await language(page, locale)
    if (locale !== 'ko') await expect(alert).not.toContainText(/[가-힣]/)
    else await expect(alert).toContainText('세션 또는 복구 저장소를 확인하지 못했습니다.')
    expect(requests).toBe(before)
  }
})
