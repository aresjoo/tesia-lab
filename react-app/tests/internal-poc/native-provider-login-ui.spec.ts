import { expect, test, type Page } from '@playwright/test'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import sourceCopy from '../../src/client-reference-copy.json' with { type: 'json' }
import { TEST_ORIGIN } from '../test-origin'
import { nativeAuthUiText } from '../../src/internal-poc/native-auth-ui-copy'

// Actual native UI/controller/SDK with explicit synthetic protocol responses.
// No external provider navigation, real callback, credential or issued session.
test.use({ trace: 'off', video: 'off' })
test.setTimeout(30_000)
type Provider = 'GOOGLE' | 'APPLE'
const owner = 'session_anonymous_000001', ready = conversationFixture.snapshots.ready
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const providerButton = (page: Page, provider: Provider) => panel(page).getByRole('button', { name: `${provider === 'GOOGLE' ? 'Google' : 'Apple'}로 계속하기`, exact: true })
const other = (provider: Provider): Provider => provider === 'GOOGLE' ? 'APPLE' : 'GOOGLE'
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_provider_ui_fixture_0001', traceId: 'trace_provider_ui_fixture_0001' })
const sessionEtag = '"etag_provider_ui_session_0007"'

async function setup(page: Page, returned = false) {
  const state = { failSession: 0, failCsrf: 0, loseStart: 0, holdStart: undefined as (() => Promise<void>) | undefined,
    calls: [] as string[], starts: [] as { provider: Provider; key: string; condition: string }[], results: 0, acks: 0, external: 0, resultReady: false }
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ owner, id }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { owner, id: ready.conversationId })
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(url.origin).toBe(TEST_ORIGIN)
    state.calls.push(`${request.method()} ${path}`)
    const provider: Provider = path.includes('/apple/') ? 'APPLE' : 'GOOGLE'
    const version = provider === 'GOOGLE' ? '0.2.0' : '0.4.0'
    let data: unknown, status = 200, responseMeta = meta(version)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: sessionEtag }
    if (path === '/api/v1/auth/session') {
      if (state.failSession > 0) { state.failSession--; return route.abort('failed') }
      data = { sessionId: owner, state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
      responseMeta = meta('0.1.0', '7')
    } else if (path === '/api/v1/auth/csrf') {
      if (state.failCsrf > 0) { state.failCsrf--; return route.abort('failed') }
      data = { csrfToken: 'csrf_provider_ui_fixture_000001', expiresAt: '2030-01-01T12:01:10Z' }; responseMeta = meta('0.1.0', null); delete headers.ETag
    } else if (path.startsWith('/api/v3/') && request.method() === 'GET') {
      data = ready; responseMeta = meta('0.3.0', ready.conversationStateRevision)
      headers.ETag = '"etag_provider_ui_conversation_0004"'
    } else if (/\/auth\/(google|apple)\/transactions$/.test(path)) {
      expect(request.method()).toBe('POST'); expect(request.postData()).toBeNull()
      state.starts.push({ provider, key: request.headers()['idempotency-key'], condition: request.headers()['if-match'] })
      if (state.holdStart) await state.holdStart()
      if (state.loseStart > 0) { state.loseStart--; return route.abort('failed') }
      status = 201
      data = { transactionId: 'oidc_tx_fixture_000001', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
        authorizationRedirect: provider === 'GOOGLE' ? 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque'
          : `https://appleid.apple.com/auth/authorize?client_id=invalid.tesia.fixture&redirect_uri=https%3A%2F%2Finternal.tesia.invalid%2Fapi%2Fv4%2Fauth%2Fapple%2Fcallback&response_type=code&response_mode=form_post&state=${'B'.repeat(43)}&nonce=${'N'.repeat(43)}` }
    } else if (path.endsWith('/results/current')) {
      state.results++
      if (!state.resultReady) return route.fulfill({ status: 409, headers, body: JSON.stringify({ meta: responseMeta, error: { code: 'AUTH_RESULT_NOT_READY', message: 'Authentication request failed.' } }) })
      data = { resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:01:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_result_fixture_000001' }
    } else {
      if (path.endsWith('/acknowledgements')) state.acks++
      return route.abort('failed')
    }
    return route.fulfill({ status, headers, body: JSON.stringify({ meta: responseMeta, data }) })
  })
  for (const origin of ['https://accounts.google.com/**', 'https://appleid.apple.com/**']) await page.route(origin, route => { state.external++; return route.abort('failed') })
  if (returned) {
    // Vite does not own production callback routing. Serve the unchanged native
    // entry HTML at its callback pathname only for this explicit fixture seam.
    const html = await (await page.request.get('/internal-poc.html')).text()
    await page.route(`${TEST_ORIGIN}/auth/complete`, route => route.fulfill({ contentType: 'text/html', body: html }))
  }
  await page.goto(returned ? '/auth/complete' : '/internal-poc.html#/native-client')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  if (returned) { await expect(panel(page)).toBeVisible(); return state }
  const login = page.getByRole('button', { name: '로그인', exact: true }).first()
  if (await login.isVisible()) await login.click()
  else {
    const sidebar = page.getByRole('button', { name: '사이드바 로그인', exact: true })
    if (!await sidebar.isVisible()) await page.getByRole('button', { name: '메뉴', exact: true }).click()
    await sidebar.click()
  }
  await expect(panel(page)).toBeVisible()
  return state
}

async function forceDisabled(page: Page, provider: Provider) {
  const button = providerButton(page, provider)
  await expect(button).toHaveAttribute('aria-disabled', 'true')
  await button.click({ force: true })
  await button.evaluate(node => (node as HTMLButtonElement).click())
  await button.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Space')
}

for (const provider of ['GOOGLE', 'APPLE'] as const) {
  test(`${provider}: 진행 중 다른 공급자·이중 클릭은 추가 START를 만들지 않고 초점도 빼앗지 않는다`, async ({ page }) => {
    const state = await setup(page)
    let release!: () => void
    state.holdStart = () => new Promise<void>(resolve => { release = resolve })
    await providerButton(page, provider).focus(); await page.keyboard.press('Enter')
    await expect.poll(() => state.starts.length).toBe(1)
    const before = [...state.calls]
    await forceDisabled(page, other(provider))
    await providerButton(page, provider).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
    expect(state.calls).toEqual(before)
    release()
    await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
    await expect(providerButton(page, other(provider))).toBeFocused()
    expect(state.starts).toHaveLength(1); expect(state.starts[0].provider).toBe(provider)
    expect(state.acks).toBe(0); expect(state.external).toBe(0)
    await expect(page.getByRole('button', { name: '전략 검증', exact: true })).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(ready.conversationId)
  })

  for (const failure of ['session', 'csrf'] as const) test(`${provider}: 최초 ${failure} GET 실패 뒤 공급자를 고정하고 같은 버튼으로만 시작을 재시도한다`, async ({ page }) => {
    const state = await setup(page)
    if (failure === 'session') state.failSession = 1; else state.failCsrf = 1
    await providerButton(page, provider).click()
    await expect(panel(page).getByRole('alert')).toContainText('로그인 성공으로 처리하지 않았습니다')
    await expect(providerButton(page, provider)).toBeEnabled()
    const before = [...state.calls]
    await forceDisabled(page, other(provider))
    expect(state.calls).toEqual(before); expect(state.starts).toHaveLength(0)
    await providerButton(page, provider).click()
    await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
    expect(state.starts).toHaveLength(1); expect(state.starts[0].provider).toBe(provider)
    // No START context/key exists before the failed initial GET. This checks
    // provider preservation, not an invented earlier idempotency identity.
    expect(state.starts[0].condition).toBe(sessionEtag)
    expect(state.acks).toBe(0); expect(state.external).toBe(0)
  })

  test(`${provider}: START 응답 유실은 같은 버튼·키·조건으로 재시도하며 redirect 뒤 START를 막는다`, async ({ page }) => {
    const state = await setup(page); state.loseStart = 1
    await providerButton(page, provider).click()
    await expect(panel(page).getByRole('alert')).toContainText('응답을 확인하지 못했습니다')
    await expect(providerButton(page, provider)).toBeEnabled()
    const before = [...state.calls]
    await forceDisabled(page, other(provider)); expect(state.calls).toEqual(before)
    await providerButton(page, provider).click()
    await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
    expect(state.starts).toHaveLength(2)
    expect(state.starts[0]).toEqual(state.starts[1])
    expect(state.starts[0].key).toMatch(/^[A-Za-z0-9_-]{16,128}$/)
    const after = [...state.calls]
    await forceDisabled(page, provider); await forceDisabled(page, other(provider))
    expect(state.calls).toEqual(after)
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toHaveCount(0)
    expect(state.acks).toBe(0); expect(state.external).toBe(0)
  })

  test(`${provider}: 명시 결과 확인만 READY를 표시하고 버튼 클릭을 로그인 확정·전략 승인으로 취급하지 않는다`, async ({ page }) => {
    const state = await setup(page)
    await providerButton(page, provider).click()
    await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
    expect(state.results).toBe(0)
    await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
    await expect(panel(page).getByRole('alert')).toContainText('아직 인증 결과가 준비되지 않았습니다')
    state.resultReady = true
    await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible()
    const before = [...state.calls]
    await forceDisabled(page, provider); await forceDisabled(page, other(provider))
    expect(state.calls).toEqual(before)
    expect(state.calls.some(call => /claim|approve|backtests/.test(call))).toBe(false)
    expect(state.acks).toBe(0); expect(state.external).toBe(0)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation-session'))).toBe(owner)
  })

  test(`${provider}: 새 반환 페이지에서 기존 결과 GET만 확인하고 START나 ACK를 자동 실행하지 않는다`, async ({ page }) => {
    const state = await setup(page, true); state.resultReady = true
    await expect(panel(page).locator('.native-auth-recovery')).toHaveAttribute('open', '')
    expect(state.starts).toHaveLength(0); expect(state.results).toBe(0); expect(state.acks).toBe(0)
    const label = provider === 'GOOGLE' ? 'Google' : 'Apple'
    await panel(page).getByRole('button', { name: `${label} 인증 결과 확인`, exact: true }).click()
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible()
    expect(state.results).toBe(1); expect(state.starts).toHaveLength(0); expect(state.acks).toBe(0)
    const resultCalls = state.calls.filter(call => call.endsWith('/results/current'))
    expect(resultCalls).toEqual([`GET /api/${provider === 'GOOGLE' ? 'v2/auth/google' : 'v4/auth/apple'}/results/current`])
    await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
    await expect(panel(page).getByRole('alert')).toContainText('로그인 성공으로 처리하지 않았습니다')
    expect(state.acks).toBe(1); expect(state.starts).toHaveLength(0); expect(state.external).toBe(0)
    expect(state.calls.some(call => /claim|approve|backtests/.test(call))).toBe(false)
  })
}

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) for (const width of [320, 1440]) test(`${language} ${width}px 첫 화면의 원본 공급자 버튼·SVG·글자·키보드 배치를 확인한다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 })
  const state = await setup(page)
  await page.evaluate(async language => {
    const modulePath = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ modulePath)
    setClientPreference('language', language)
  }, language)
  const localizedPanel = page.getByRole('region', { name: nativeAuthUiText(language, 'authSection'), exact: true })
  await expect(localizedPanel.getByRole('heading', { name: sourceCopy.I18N['auth.title'][language], exact: true })).toBeVisible()
  await expect(localizedPanel.locator('.au-sub').first()).toHaveText(sourceCopy.I18N['auth.sub'][language].replace(/<br\s*\/?\s*>/gi, ''))
  await expect(localizedPanel.locator('select')).toHaveCount(0)
  const google = localizedPanel.getByRole('button', { name: sourceCopy.I18N['auth.google'][language], exact: true }), apple = localizedPanel.getByRole('button', { name: sourceCopy.I18N['auth.apple'][language], exact: true })
  await expect(google).toBeEnabled(); await expect(apple).toBeEnabled()
  await expect(google).toHaveClass(/au-btn/); await expect(apple).toHaveClass(/au-btn/)
  await expect(google.locator('svg')).toHaveAttribute('viewBox', '0 0 48 48')
  await expect(google.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  expect(await google.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('fill')))).toEqual(['#EA4335', '#4285F4', '#FBBC05', '#34A853'])
  await expect(apple.locator('svg')).toHaveAttribute('viewBox', '0 0 24 24')
  await expect(apple.locator('svg')).toHaveAttribute('fill', 'currentColor')
  await expect(apple.locator('path')).toHaveCount(1)
  await google.focus(); await page.keyboard.press('Tab'); await expect(apple).toBeFocused()
  await page.keyboard.press('Shift+Tab'); await expect(google).toBeFocused()
  await page.evaluate(() => document.fonts.ready)
  await google.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const rects = { google: await google.boundingBox(), apple: await apple.boundingBox(), panel: await localizedPanel.boundingBox() }
  expect(rects.google).not.toBeNull(); expect(rects.apple).not.toBeNull()
  expect(rects.google!.height).toBeGreaterThanOrEqual(44); expect(rects.apple!.height).toBeGreaterThanOrEqual(44)
  expect(Math.abs(rects.google!.x - rects.apple!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(rects.google!.width - rects.apple!.width)).toBeLessThanOrEqual(1)
  expect(rects.google!.y + rects.google!.height).toBeLessThan(rects.apple!.y)
  expect(rects.google!.x).toBeGreaterThanOrEqual(0)
  expect(rects.google!.x + rects.google!.width).toBeLessThanOrEqual(width + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await testInfo.attach(`native-provider-layout-${language}-${width}.json`, { body: JSON.stringify(rects, null, 2), contentType: 'application/json' })
  await page.screenshot({ path: testInfo.outputPath(`native-provider-login-${language}-${width}.png`), fullPage: true })
  expect(state.starts).toHaveLength(0); expect(state.acks).toBe(0); expect(state.external).toBe(0)
})
