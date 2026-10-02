import { expect, test, type Page } from '@playwright/test'
import { TEST_ORIGIN } from '../test-origin'

// Explicit synthetic responses; actual NativeServiceApp, auth adapter and SDK.
// No provider/cookie authority, no raw mutation key or authorization URL logging.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test.setTimeout(30_000)
const owner = 'session_anonymous_000001'
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version, requestId: 'req_panel_fixture_000001', traceId: 'trace_panel_fixture_00001', resourceRevision: revision })
const etag = (revision: string) => `"etag_session_fixture_${revision.padStart(6, '0')}"`
async function setup(page: Page, provider: 'GOOGLE' | 'APPLE', lost = true, entry: 'native' | 'auth-complete' | 'authenticated-owner' = 'native') {
  const controls = { owner, state: 'ANONYMOUS', revision: '7', failSession: false, sessionReads: 0, starts: 0, acks: 0,
    ready: false, rejectReplay: false, transactionChanged: false, loseReplay: false, expireNextReplay: false,
    holdSession: undefined as (() => Promise<void>) | undefined, holdStart: undefined as (() => Promise<void>) | undefined }
  const keys: string[] = [], conditions: string[] = [], calls: string[] = []
  const prefix = provider === 'GOOGLE' ? '/api/v2/auth/google' : '/api/v4/auth/apple', version = provider === 'GOOGLE' ? '0.2.0' : '0.4.0'
  if (entry === 'authenticated-owner') {
    controls.owner = 'session_authenticated_0001'; controls.state = 'AUTHENTICATED'
    await page.addInitScript(() => {
      sessionStorage.setItem('tesia.native.conversation-session', 'session_anonymous_previous01')
      sessionStorage.setItem('tesia.native.conversation', 'conversation_previous_0001')
    })
  }
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    expect(new URL(request.url()).origin).toBe(TEST_ORIGIN)
    calls.push(`${request.method()} ${path}`)
    let data: unknown, status = 200, envelopeMeta = meta(version)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: etag(controls.revision) }
    if (path === '/api/v1/auth/session') {
      controls.sessionReads++
      if (controls.holdSession) await controls.holdSession()
      if (controls.failSession) return route.abort()
      if (controls.state === 'HANDOFF_BOUND') return route.fulfill({ status: 401, headers, body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' } }) })
      data = { sessionId: controls.owner, state: controls.state, revision: controls.revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
      envelopeMeta = meta('0.1.0', controls.revision); headers.ETag = etag(controls.revision)
    } else if (path === '/api/v1/auth/csrf') {
      data = { csrfToken: 'csrf_synthetic_panel_000001', expiresAt: '2030-01-01T12:01:10Z' }; envelopeMeta = meta('0.1.0', null); delete headers.ETag
    } else if (path === `${prefix}/transactions`) {
      controls.starts++; keys.push(request.headers()['idempotency-key']); conditions.push(request.headers()['if-match'])
      if (controls.expireNextReplay) {
        controls.expireNextReplay = false; controls.state = 'ANONYMOUS'; controls.revision = '9'
        return route.fulfill({ status: 410, headers, body: JSON.stringify({ meta: envelopeMeta, error: { code: 'AUTH_TRANSACTION_EXPIRED', message: 'Authentication request failed.' } }) })
      }
      if (controls.rejectReplay || controls.owner !== owner || controls.state === 'AUTHENTICATED') return route.fulfill({ status: 401, headers,
        body: JSON.stringify({ meta: envelopeMeta, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication request failed.' } }) })
      controls.state = 'HANDOFF_BOUND'; controls.revision = '8'
      if (controls.holdStart) await controls.holdStart()
      if (lost && controls.starts === 1 || controls.loseReplay) return route.abort()
      status = 201
      data = { transactionId: controls.transactionChanged ? 'oidc_tx_fixture_000002' : 'oidc_tx_fixture_000001', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
        authorizationRedirect: provider === 'GOOGLE' ? 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque'
          : `https://appleid.apple.com/auth/authorize?client_id=invalid.tesia.fixture&redirect_uri=https%3A%2F%2Finternal.tesia.invalid%2Fapi%2Fv4%2Fauth%2Fapple%2Fcallback&response_type=code&response_mode=form_post&state=${'B'.repeat(43)}&nonce=${'N'.repeat(43)}` }
    } else if (path === `${prefix}/results/current`) {
      if (!controls.ready) return route.fulfill({ status: 409, headers, body: JSON.stringify({ meta: envelopeMeta, error: { code: 'AUTH_RESULT_NOT_READY', message: 'Authentication request failed.' } }) })
      data = { resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', status: 'READY_FOR_ACK',
        issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:01:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_result_fixture_000001' }
    } else if (path.endsWith('/acknowledgements')) {
      controls.acks++; keys.push(request.headers()['idempotency-key']); return route.abort()
    } else return route.abort()
    return route.fulfill({ status, headers, body: JSON.stringify({ meta: envelopeMeta, data }) })
  })
  if (entry === 'auth-complete') {
    // Test the actual entry module at the callback pathname; Vite is not the
    // production HTML router. Keep this explicit synthetic HTML seam separate.
    const html = await (await page.request.get('/internal-poc.html')).text()
    await page.route(`${TEST_ORIGIN}/auth/complete`, route => route.fulfill({ contentType: 'text/html', body: html }))
  }
  await page.goto(entry === 'auth-complete' ? '/auth/complete' : '/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return { controls, keys, conditions, calls }
}

for (const entry of ['auth-complete', 'authenticated-owner'] as const) test(`${entry}: bootstrap already binds and opens the recovery panel without a header click`, async ({ page }) => {
  const { controls, calls } = await setup(page, 'GOOGLE', false, entry)
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).locator('summary', { hasText: '인증을 마치고 돌아오셨나요?' })).toBeVisible()
  expect(controls.starts).toBe(0); expect(controls.acks).toBe(0)
  expect(calls.some(call => call.startsWith('POST'))).toBe(false)
})
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const clickOpen = async (page: Page) => {
  const top = page.getByRole('button', { name: '로그인', exact: true }).first()
  if (await top.isVisible()) await top.click()
  else {
    const sidebar = page.getByRole('button', { name: '사이드바 로그인', exact: true })
    if (!await sidebar.isVisible()) await page.getByRole('button', { name: '메뉴', exact: true }).click()
    await sidebar.click()
  }
}
const open = async (page: Page) => { await clickOpen(page); await expect(panel(page)).toBeVisible() }
const resume = (page: Page) => panel(page).getByRole('button', { name: '이전 로그인 요청을 같은 키로 확인', exact: true })
const prepare = (page: Page, provider: 'GOOGLE' | 'APPLE') => panel(page).getByRole('button', { name: `${provider === 'GOOGLE' ? 'Google' : 'Apple'}로 계속하기`, exact: true })
const close = async (page: Page) => { await panel(page).getByRole('button', { name: '닫기', exact: true }).click(); await expect(panel(page)).toHaveCount(0) }
const recheck = async (page: Page, external = false) => {
  // Session recovery may also be initiated outside the modal (e.g. another
  // tab changes identity). Programmatic dispatch is only for that race test.
  if (external) {
    await page.getByRole('button', { name: '세션 다시 확인', exact: true, includeHidden: true }).evaluate((button: HTMLButtonElement) => button.click())
    return
  }
  const button = page.getByRole('button', { name: '세션 다시 확인', exact: true })
  if (!await button.isVisible()) await page.locator('.client-development-boundary summary').click()
  await button.click()
}

for (const provider of ['GOOGLE', 'APPLE'] as const) {
  test(`${provider}: lost START survives close/reopen; only explicit same-key replay`, async ({ page }) => {
    const evidence = await setup(page, provider)
    await open(page)
    await prepare(page, provider).click(); await expect(panel(page).getByRole('alert')).toContainText('응답을 확인하지 못했습니다')
    await close(page)
    const hidden = page.locator('.cs-native-login')
    await expect(hidden).toHaveAttribute('hidden', ''); await expect(hidden).toHaveAttribute('inert', '')
    await expect(hidden).toBeHidden()
    expect(await hidden.evaluate(element => element.contains(document.activeElement))).toBe(false)
    const reads = evidence.controls.sessionReads
    await open(page)
    expect(evidence.controls.sessionReads).toBe(reads)
    await expect(panel(page).getByRole('button', { name: /^(Google|Apple)로 계속하기$/ })).toHaveCount(0)
    await expect(panel(page).getByRole('link')).toHaveCount(0)
    expect(evidence.controls.starts).toBe(1)
    await resume(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
    await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
    expect(evidence.controls.starts).toBe(2); expect(new Set(evidence.keys).size).toBe(1)
    expect(evidence.conditions).toEqual([etag('7'), etag('7')]); expect(evidence.controls.acks).toBe(0)
    const values = await page.evaluate(() => Object.values({ ...sessionStorage }).join(' '))
    expect(values).not.toContain('csrf_'); expect(values).not.toContain('https://')
    expect(evidence.calls.some(call => /claim|approve|backtests/.test(call))).toBe(false)
  })
  test(`${provider}: confirmed redirect stays hidden until authoritative same-key response`, async ({ page }) => {
    const { controls } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    await expect(panel(page).getByRole('link')).toBeVisible(); await close(page)
    let release: () => void = () => undefined
    controls.holdStart = () => new Promise<void>(resolve => { release = resolve })
    await open(page); await expect(panel(page).getByRole('link')).toHaveCount(0); expect(controls.starts).toBe(1)
    await resume(page).click(); await expect.poll(() => controls.starts).toBe(2)
    await expect(panel(page).getByRole('link')).toHaveCount(0)
    controls.holdStart = undefined; release()
    await expect(panel(page).getByRole('link')).toBeVisible(); expect(controls.starts).toBe(2); expect(controls.acks).toBe(0)
  })
  for (const boundary of ['other-owner', 'authenticated', 'revoked'] as const) test(`${provider}: reopen ${boundary} never exposes old provider/redirect after server rejection`, async ({ page }) => {
    const { controls } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    await expect(panel(page).getByRole('link')).toBeVisible(); await close(page)
    if (boundary === 'other-owner') controls.owner = 'session_anonymous_other01'
    if (boundary === 'authenticated') controls.state = 'AUTHENTICATED'
    if (boundary === 'revoked') controls.rejectReplay = true
    await open(page); expect(controls.starts).toBe(1)
    await expect(panel(page).getByRole('link')).toHaveCount(0); await expect(panel(page).getByRole('button', { name: /^(Google|Apple)로 계속하기$/ })).toHaveCount(0)
    await resume(page).click(); await expect(panel(page).getByRole('alert')).toContainText('이전 로그인 요청을 확인하지 못했습니다')
    await expect(panel(page).getByRole('link')).toHaveCount(0); await expect(panel(page).getByRole('button', { name: /^(Google|Apple)로 계속하기$/ })).toHaveCount(0)
    expect(controls.starts).toBe(2); expect(controls.acks).toBe(0)
  })
  test(`${provider}: lost ACK retains the original key after close/reopen; no automatic acknowledgement`, async ({ page }) => {
    const { controls, keys } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    controls.ready = true
    await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
    await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
    await expect(panel(page).getByRole('alert')).toContainText('응답을 확인하지 못했습니다'); await close(page); await open(page)
    expect(controls.acks).toBe(1)
    await expect(resume(page)).toHaveCount(0)
    await panel(page).getByRole('button', { name: '같은 로그인 확정 요청으로 세션 재확인', exact: true }).click()
    await expect.poll(() => controls.acks).toBe(2); expect(keys[1]).toBe(keys[2]); expect(controls.starts).toBe(1)
  })
  test(`${provider}: unknown replay response stays redacted and retries the same key`, async ({ page }) => {
    const { controls, keys } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    await expect(panel(page).getByRole('link')).toBeVisible(); await close(page); await open(page)
    controls.loseReplay = true; await resume(page).click()
    await expect(panel(page).getByRole('alert')).toBeVisible(); await expect(panel(page).getByRole('link')).toHaveCount(0)
    controls.loseReplay = false; await resume(page).click()
    await expect(panel(page).getByRole('link')).toBeVisible(); expect(keys).toHaveLength(3); expect(new Set(keys).size).toBe(1)
  })
  test(`${provider}: a different transaction in replay cannot restore a stale link`, async ({ page }) => {
    const { controls } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    await expect(panel(page).getByRole('link')).toBeVisible(); await close(page); controls.transactionChanged = true; await open(page)
    await resume(page).click(); await expect(panel(page).getByRole('alert')).toBeVisible()
    await expect(panel(page).getByRole('link')).toHaveCount(0); expect(controls.starts).toBe(2)
  })
  test(`${provider}: session recovery removes a retained flow and ignores a late START response`, async ({ page }) => {
    const { controls } = await setup(page, provider, false)
    await open(page)
    let release: () => void = () => undefined
    controls.holdStart = () => new Promise<void>(resolve => { release = resolve })
    await prepare(page, provider).click(); await expect.poll(() => controls.starts).toBe(1)
    controls.owner = 'session_anonymous_other01'; controls.state = 'ANONYMOUS'
    await recheck(page, true)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    controls.holdStart = undefined; release()
    await expect(panel(page).getByRole('link')).toHaveCount(0)
    await expect(prepare(page, 'GOOGLE')).toBeEnabled(); await expect(prepare(page, 'APPLE')).toBeEnabled()
    expect(controls.acks).toBe(0); expect(controls.starts).toBe(1)
  })
  test(`${provider}: retained READY result needs an explicit bound result read before ACK is shown`, async ({ page }) => {
    const { controls } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    controls.ready = true; await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible()
    await close(page); await open(page)
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toHaveCount(0)
    await panel(page).getByRole('button', { name: '기존 인증 결과를 서버에서 다시 확인', exact: true }).click()
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible(); expect(controls.acks).toBe(0)
  })
  test(`${provider}: resume with no memory context never fetches CSRF or creates a START`, async ({ page }) => {
    const { calls } = await setup(page, provider), before = [...calls]
    const result = await page.evaluate(async ({ origin, provider }) => {
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      const auth = createNativeBrowserAuth()
      try { await auth.resumeStart(provider); return 'UNEXPECTED_SUCCESS' } catch (error) { return (error as { code: string }).code }
    }, { origin: TEST_ORIGIN, provider })
    expect(result).toBe('AUTH_RESTART_NOT_CONFIRMED'); expect(calls).toEqual(before)
  })
  test(`${provider}: server-expired replay retains the existing explicit fresh-session restart path`, async ({ page }) => {
    const { controls, keys, conditions } = await setup(page, provider)
    await open(page); await prepare(page, provider).click()
    await expect(panel(page).getByRole('alert')).toBeVisible(); await close(page); await open(page)
    controls.expireNextReplay = true; await resume(page).click()
    const restart = panel(page).getByRole('button', { name: '서버에서 종결을 확인한 로그인 다시 시작', exact: true })
    await expect(restart).toBeVisible(); await expect(resume(page)).toHaveCount(0)
    expect(keys).toHaveLength(2); expect(new Set(keys).size).toBe(1)
    await restart.click(); await expect(panel(page).getByRole('link')).toBeVisible()
    expect(keys).toHaveLength(3); expect(keys[2]).not.toBe(keys[1]); expect(conditions).toEqual([etag('7'), etag('7'), etag('9')])
  })
  test(`${provider}: failed explicit session recheck removes hidden flow and never restores stale links`, async ({ page }) => {
    const { controls } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    await expect(panel(page).getByRole('link')).toBeVisible(); await close(page)
    controls.failSession = true; await recheck(page)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
    await expect(page.locator('.cs-native-login')).toHaveCount(0); expect(controls.starts).toBe(1); expect(controls.acks).toBe(0)
  })
  test(`${provider}: a new owner after failed recheck gets a fresh login panel, not a context-free resume shell`, async ({ page }) => {
    const { controls } = await setup(page, provider, false)
    await open(page); await prepare(page, provider).click()
    await expect(panel(page).getByRole('link')).toBeVisible(); await close(page)
    controls.failSession = true; await recheck(page)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
    controls.failSession = false; controls.owner = 'session_anonymous_other01'; controls.state = 'ANONYMOUS'; controls.revision = '1'
    await recheck(page)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await open(page)
    await expect(prepare(page, 'GOOGLE')).toBeEnabled(); await expect(prepare(page, 'APPLE')).toBeEnabled()
    await expect(prepare(page, 'GOOGLE')).toBeVisible(); await expect(resume(page)).toHaveCount(0)
    await expect(panel(page).getByRole('link')).toHaveCount(0); expect(controls.starts).toBe(1); expect(controls.acks).toBe(0)
  })
}
