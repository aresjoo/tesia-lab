import { expect, test, type Locator, type Page } from '@playwright/test'
import { TEST_ORIGIN } from '../test-origin'

// Actual service entry -> NativeServiceApp -> panel -> generated SDK. The only
// module seam sets the two compiled build-env reads, not props/controllers/SDK.
// All API responses are synthetic; no provider, email or issued login is tested.
test.use({ trace: 'off', video: 'off' })
test.setTimeout(30_000)
const owner = 'session_availability_fixture_0001'
const etag = '"etag_availability_fixture_0007"'
const csrf = 'csrf_availability_fixture_000001'
const storedApple = JSON.stringify({ provider: 'APPLE', sessionId: owner, revision: '7', etag })
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const google = (page: Page) => panel(page).getByRole('button', { name: /^Google로 계속하기/ })
const apple = (page: Page) => panel(page).getByRole('button', { name: /^Apple로 계속하기/ })
const email = (page: Page) => panel(page).getByRole('button', { name: /^이메일로 로그인/ })
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_availability_fixture_0001', traceId: 'trace_availability_fixture_0001' })

async function mount(page: Page, googleOnly: boolean, returned = false) {
  const state = { calls: [] as string[], external: 0, errors: [] as string[], envReads: 0, starts: [] as string[] }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ returned, storedApple }) => {
    localStorage.setItem('tethLang', 'ko')
    if (returned) sessionStorage.setItem('tesia.native.auth-claim-precondition', storedApple)
  }, { returned, storedApple })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.origin !== TEST_ORIGIN) { state.external++; return route.abort('blockedbyclient') }
    if (path === '/src/internal-poc/NativeServiceApp.tsx') {
      const response = await route.fetch(), source = await response.text()
      const reads = source.match(/import\.meta\.env\.VITE_TETH_AUTH_GOOGLE_ONLY/g) ?? []
      expect(reads, 'Both service availability bindings consume the build configuration').toHaveLength(2)
      state.envReads += reads.length
      return route.fulfill({ response, contentType: 'application/javascript',
        body: source.replaceAll('import.meta.env.VITE_TETH_AUTH_GOOGLE_ONLY', JSON.stringify(String(googleOnly))) })
    }
    if (path.startsWith('/api/')) {
      state.calls.push(`${request.method()} ${path}`)
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: etag }
      let data: unknown, responseMeta = meta('0.1.0', '7'), status = 200
      if (path === '/api/v1/auth/session' && request.method() === 'GET') {
        data = { sessionId: owner, state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
      } else if (path === '/api/v1/auth/csrf' && request.method() === 'GET') {
        data = { csrfToken: csrf, expiresAt: '2030-01-01T12:00:00Z' }; responseMeta = meta('0.1.0', null); delete headers.ETag
      } else if (/^\/api\/(v2\/auth\/google|v4\/auth\/apple)\/transactions$/.test(path)) {
        expect(request.method()).toBe('POST'); expect(request.postData()).toBeNull()
        expect(request.headers()['x-csrf-token']).toBe(csrf)
        expect(request.headers()['if-match']).toBe(etag)
        expect(request.headers()['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{16,128}$/)
        state.starts.push(path)
        const isGoogle = path.includes('/google/')
        status = 201; responseMeta = meta(isGoogle ? '0.2.0' : '0.4.0')
        data = { transactionId: 'oidc_tx_fixture_000001', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
          authorizationRedirect: isGoogle ? 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque'
            : `https://appleid.apple.com/auth/authorize?client_id=invalid.tesia.fixture&redirect_uri=https%3A%2F%2Finternal.tesia.invalid%2Fapi%2Fv4%2Fauth%2Fapple%2Fcallback&response_type=code&response_mode=form_post&state=${'B'.repeat(43)}&nonce=${'N'.repeat(43)}` }
      } else return route.abort('blockedbyclient')
      return route.fulfill({ status, headers, body: JSON.stringify({ meta: responseMeta, data }) })
    }
    if (request.isNavigationRequest() && ['/', '/auth/complete'].includes(path)) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto(returned ? '/auth/complete' : '/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  if (!returned) await page.getByRole('button', { name: '로그인', exact: true }).first().click()
  await expect(panel(page)).toBeVisible()
  expect(state.envReads).toBe(2)
  await expect(google(page)).toBeVisible(); await expect(apple(page)).toBeVisible(); await expect(email(page)).toBeVisible()
  await expect(google(page).locator('svg')).toHaveAttribute('viewBox', '0 0 48 48')
  await expect(apple(page).locator('svg')).toHaveAttribute('viewBox', '0 0 24 24')
  await expect(panel(page).locator('.au-free')).toBeVisible()
  return state
}

async function attemptUnavailable(control: Locator, page: Page) {
  // Pointer coordinates avoid Playwright's disabled-button actionability retry.
  await control.scrollIntoViewIfNeeded()
  const box = await control.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await control.evaluate(node => (node as HTMLButtonElement).click())
  if (await control.evaluate(node => !(node as HTMLButtonElement).disabled)) {
    await control.focus(); await expect(control).toBeFocused()
    await page.keyboard.press('Enter'); await page.keyboard.press('Space')
  }
}

test('source-layout login title and close control do not overlap at narrow widths', async ({ page }) => {
  const state = await mount(page, true)
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.evaluate(() => document.fonts.ready)
    const title = await panel(page).locator('.au-title').boundingBox()
    const close = await panel(page).locator('[data-native-auth-close]').boundingBox()
    expect(title).not.toBeNull(); expect(close).not.toBeNull()
    expect(title!.y >= close!.y + close!.height || title!.x + title!.width <= close!.x).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(state.starts).toEqual([]); expect(state.external).toBe(0)
})

test('Google-only service preserves all original choices and blocks unavailable pointer, keyboard and recovery requests', async ({ page }, info) => {
  const state = await mount(page, true, true)
  await expect(google(page)).toHaveAttribute('aria-disabled', 'false')
  await expect(apple(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(apple(page)).toContainText('준비 중')
  await expect(email(page)).toBeDisabled(); await expect(email(page)).toContainText('준비 중')
  const before = [...state.calls]
  await attemptUnavailable(apple(page), page); await attemptUnavailable(email(page), page)
  const recovery = panel(page).locator('.native-auth-recovery')
  await expect(recovery).toBeVisible()
  const appleRecovery = recovery.getByRole('button', { name: /Apple/ })
  await expect(appleRecovery).toHaveCount(2)
  for (const button of await appleRecovery.all()) { await expect(button).toBeDisabled(); await attemptUnavailable(button, page) }
  const googleRecovery = recovery.getByRole('button', { name: /Google/ })
  await expect(googleRecovery).toHaveCount(2)
  for (const button of await googleRecovery.all()) await expect(button).toBeEnabled()
  await expect(panel(page).locator('input[type="email"]')).toHaveCount(0)
  expect(state.calls).toEqual(before); expect(state.starts).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.auth-claim-precondition'))).toBe(storedApple)
  expect(state.external).toBe(0); expect(state.errors).toEqual([])
  await page.screenshot({ path: info.outputPath('service-unavailable-preserved.png') })
})

for (const choice of [{ googleOnly: true, provider: 'Google', path: '/api/v2/auth/google/transactions' },
  { googleOnly: false, provider: 'Apple', path: '/api/v4/auth/apple/transactions' }] as const) {
  test(`service googleOnly=${choice.googleOnly}: ${choice.provider} starts through the real SDK only after explicit activation`, async ({ page }, info) => {
    const state = await mount(page, choice.googleOnly)
    expect(state.starts).toEqual([])
    const button = choice.provider === 'Google' ? google(page) : apple(page)
    await expect(button).toHaveAttribute('aria-disabled', 'false')
    if (!choice.googleOnly) { await expect(email(page)).toBeEnabled(); await expect(panel(page).locator('.native-provider-availability')).toHaveCount(0) }
    await button.focus(); await page.keyboard.press('Enter')
    await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
    expect(state.starts).toEqual([choice.path])
    const before = [...state.calls]
    await attemptUnavailable(button, page)
    expect(state.calls).toEqual(before)
    expect(state.calls.filter(call => call.startsWith('POST '))).toEqual([`POST ${choice.path}`])
    expect(state.calls.some(call => /results|acknowledgements|claims|approvals/.test(call))).toBe(false)
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toHaveCount(0)
    expect(state.external).toBe(0); expect(state.errors).toEqual([])
    await page.screenshot({ path: info.outputPath('service-explicit-provider-start.png') })
  })
}

test('default service keeps the email form usable without silently creating a challenge', async ({ page }, info) => {
  const state = await mount(page, false)
  await expect(email(page)).toBeEnabled()
  const before = [...state.calls]
  await email(page).click()
  const input = panel(page).locator('input[type="email"]')
  await expect(input).toBeVisible(); await expect(input).toBeEnabled()
  await input.fill('availability-fixture@example.invalid')
  expect(state.calls).toEqual(before); expect(state.starts).toEqual([])
  expect(state.external).toBe(0); expect(state.errors).toEqual([])
  await page.screenshot({ path: info.outputPath('service-default-email-form.png') })
})
