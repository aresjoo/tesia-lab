import { expect, test, type Page } from '@playwright/test'

// Real service entry, NativeServiceApp, browser auth controller and generated
// validators. Every API response/cookie here is a declared synthetic fixture.
// Original private RED2 remains unchanged; this new file is not its exact key.
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(30_000)
const oldOwner = 'session_oauth_return_old_0001', anonOwner = 'session_oauth_return_new_0001'
const authOwner = 'session_oauth_return_auth_0001', resultId = 'oauth_result_return_fixture_0001'
const transactionId = 'oidc_tx_return_fixture_0001'
const oldEtag = '"etag_oauth_return_old_007"', anonEtag = '"etag_oauth_return_new_001"'
const authEtag = '"etag_oauth_return_auth_001"', resultEtag = '"etag_oauth_return_result_001"'
const csrf = 'csrf_oauth_return_fixture_0001', ackCsrf = 'csrf_oauth_result_fixture_0001'
const sessionCookie = 'teth_oauth_return_session_fixture', transactionCookie = 'teth_oauth_return_transaction_fixture'
const anonymous = { sessionId: anonOwner, state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
const authenticated = { sessionId: authOwner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:01:10Z', expiresAt: '2030-01-01T12:01:10Z' }
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_return_fixture_0001', traceId: 'trace_return_fixture_0001' })
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const ackPath = `/api/v2/auth/google/results/${resultId}/acknowledgements`
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; await import('/src/internal-poc/service-main.tsx');</script></body></html>`
type Scenario = {
  entry?: '/' | '/auth/complete' | '/auth/complete?state=unexpected' | '/auth/complete#unexpected'
  initial?: '401' | 'ANONYMOUS' | 'AUTHENTICATED' | 'MALFORMED' | '500'
  stored?: 'pending' | 'logout' | 'email'
  missingResult?: boolean
  cookieMismatch?: boolean
  loseAck?: boolean
}
type State = { calls: string[]; blocked: string[]; creates: number; results: number; acks: number;
  authenticatedReads: number; csrfReads: number; keys: string[]; errors: string[]; recheckRace: boolean; recheckReads: number }
const observations = new WeakMap<Page, State>()
test.afterEach(async ({ page }, testInfo) => {
  const state = observations.get(page)
  if (!state) return
  testInfo.annotations.push({ type: 'SYNTHETIC_RETURN_ENTRY_ONLY', description: JSON.stringify(state) })
  expect(state.blocked, 'No undeclared/external API or mutation may escape the one context guard').toEqual([])
  expect(state.errors).toEqual([])
})

async function mount(page: Page, baseURL: string | undefined, scenario: Scenario = {}) {
  if (!baseURL) throw new Error('EXPLICIT_LOOPBACK_BASE_URL_REQUIRED')
  const origin = new URL(baseURL).origin
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('LOOPBACK_ONLY')
  const state: State = { calls: [], blocked: [], creates: 0, results: 0, acks: 0, authenticatedReads: 0, csrfReads: 0, keys: [], errors: [], recheckRace: false, recheckReads: 0 }
  observations.set(page, state)
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:15Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  page.on('pageerror', error => state.errors.push(error.message))
  await page.context().addCookies([
    { name: sessionCookie, value: scenario.initial === 'AUTHENTICATED' ? 'authenticated-fixture' : scenario.initial === 'ANONYMOUS' ? 'new-anonymous-fixture' : 'handoff-bound-fixture', url: origin, httpOnly: true, sameSite: 'Lax' },
    { name: transactionCookie, value: 'same-transaction-fixture', url: origin, httpOnly: true, sameSite: 'Lax' },
  ])
  const pending = JSON.stringify({ version: 1, kind: 'CREATE_TURN', sessionId: oldOwner, sessionState: 'ANONYMOUS',
    idempotencyKey: 'return_pending_create_fixture_01', turnIdempotencyKey: 'return_pending_turn_fixture_01', clientMessageId: 'client_message_return_pending_001', message: '미확정 연구 요청은 그대로 보존' })
  const logout = JSON.stringify({ version: 1, kind: 'LOGOUT', sessionId: authOwner, sessionState: 'AUTHENTICATED',
    idempotencyKey: 'return_pending_logout_fixture_01', ifMatch: authEtag, expectedSessionRevision: '1' })
  const email = JSON.stringify({ version: 1, kind: 'VERIFY', idempotencyKey: 'return_email_verify_fixture_001',
    initiatingSessionId: oldOwner, expectedSessionRevision: '7', initiatingSessionEtag: oldEtag, challengeId: 'email_challenge_return_fixture_001' })
  await page.addInitScript(({ oldOwner, oldEtag, stored, pending, logout, email }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem('tesia.native.session-binding', JSON.stringify({ sessionId: oldOwner, sessionState: 'ANONYMOUS' }))
    sessionStorage.setItem('tesia.native.auth-claim-precondition', JSON.stringify({ provider: 'GOOGLE', sessionId: oldOwner, revision: '7', etag: oldEtag }))
    if (stored === 'pending') sessionStorage.setItem('tesia.native.pending-command', pending)
    if (stored === 'logout') sessionStorage.setItem('tesia.native.pending-logout', logout)
    if (stored === 'email') sessionStorage.setItem('tesia.native.email-intent', email)
  }, { oldOwner, oldEtag, stored: scenario.stored, pending, logout, email })
  // All decisions live at context level; no page-route LIFO bypass exists.
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
    if (url.origin !== origin) { state.blocked.push('EXTERNAL'); return route.abort('blockedbyclient') }
    const api = path === '/api' || path.startsWith('/api/')
    if (!api) {
      if (method !== 'GET') { state.blocked.push('NON_FIXTURE_MUTATION'); return route.abort('blockedbyclient') }
      if (request.isNavigationRequest() && ['/', '/auth/complete'].includes(path)) return route.fulfill({ contentType: 'text/html', body: html })
      return route.continue()
    }
    const declared = !url.search && (method === 'GET' && ['/api/v1/auth/session', '/api/v1/auth/csrf', '/api/v2/auth/google/results/current'].includes(path)
      || method === 'POST' && ['/api/v1/anonymous-sessions', ackPath].includes(path))
    if (!declared) { state.blocked.push('UNDECLARED_API'); return route.abort('blockedbyclient') }
    state.calls.push(`${method} ${path}`)
    const cookie = (await request.allHeaders()).cookie ?? '' // Only explicitly seeded fixture cookies.
    const isAuth = cookie.includes(`${sessionCookie}=authenticated-fixture`), isAnon = cookie.includes(`${sessionCookie}=new-anonymous-fixture`)
    const hasTransaction = cookie.includes(`${transactionCookie}=same-transaction-fixture`)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const respond = (status: number, version: string, revision: string | null, data: unknown) => route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    const reject = (status: number, version: string, code: string) => route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, null), error: { code, message: 'Synthetic authentication fixture response.' } }) })
    if (path === '/api/v1/auth/session') {
      if (state.recheckRace && state.recheckReads < 2) {
        state.recheckReads++
        if (state.recheckReads === 2) return reject(401, '0.1.0', 'AUTHENTICATION_REQUIRED')
        headers.ETag = oldEtag
        return respond(200, '0.1.0', '7', { ...anonymous, sessionId: oldOwner, revision: '7' })
      }
      if (scenario.initial === 'MALFORMED') return route.fulfill({ status: 401, headers, body: '{}' })
      if (scenario.initial === '500') return reject(500, '0.1.0', 'INTERNAL_ERROR')
      if (!isAuth && !isAnon) return reject(401, '0.1.0', 'AUTHENTICATION_REQUIRED')
      if (isAuth) state.authenticatedReads++
      headers.ETag = isAuth ? authEtag : anonEtag
      return respond(200, '0.1.0', '1', isAuth ? authenticated : anonymous)
    }
    if (path === '/api/v1/anonymous-sessions') {
      state.creates++; expect(request.postData()).toBeNull(); expect(request.headers()['idempotency-key']).toBeTruthy()
      headers.ETag = anonEtag; headers['Set-Cookie'] = `${sessionCookie}=new-anonymous-fixture; HttpOnly; SameSite=Lax; Path=/`
      return respond(201, '0.1.0', '1', anonymous)
    }
    if (path === '/api/v1/auth/csrf') {
      state.csrfReads++
      if (!isAuth && !isAnon) return reject(401, '0.1.0', 'AUTHENTICATION_REQUIRED')
      return respond(200, '0.1.0', null, { csrfToken: csrf, expiresAt: authenticated.expiresAt })
    }
    if (path.endsWith('/results/current')) {
      state.results++; expect(hasTransaction).toBe(true)
      if (scenario.missingResult) return reject(404, '0.2.0', 'NOT_FOUND')
      headers.ETag = resultEtag
      return respond(200, '0.2.0', '0', { resultId, transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:01:00Z',
        expiresAt: '2030-01-01T00:02:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: ackCsrf })
    }
    state.acks++; expect(hasTransaction).toBe(true); expect(request.postData()).toBeNull()
    expect(request.headers()['x-csrf-token']).toBe(ackCsrf); expect(request.headers()['if-match']).toBe(resultEtag)
    expect(request.headers()['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{16,128}$/); state.keys.push(request.headers()['idempotency-key'])
    if (scenario.loseAck && state.acks === 1) return route.abort('failed')
    headers.ETag = authEtag
    if (!scenario.cookieMismatch) headers['Set-Cookie'] = `${sessionCookie}=authenticated-fixture; HttpOnly; SameSite=Lax; Path=/`
    return respond(200, '0.2.0', '1', { resultId, transactionId, session: authenticated,
      handoffReservation: { transactionId, initiatingSessionId: oldOwner, initiatingSessionRevision: '7', authenticatedSessionId: authOwner, state: 'RESERVED_FOR_CLAIM', expiresAt: authenticated.expiresAt } })
  })
  await page.goto(`${origin}${scenario.entry ?? '/auth/complete'}`)
  return { state, pending, logout, email }
}

for (const width of [1440, 390]) test(`return HANDOFF 401 ${width}: no replacement owner before or after explicit result ACK AUTH cookie verification`, async ({ page, baseURL }) => {
  await page.setViewportSize({ width, height: 900 })
  const { state } = await mount(page, baseURL)
  await expect(panel(page)).toBeVisible()
  expect(state.calls).toEqual(['GET /api/v1/auth/session'])
  expect(state.creates).toBe(0); expect(state.results).toBe(0); expect(state.acks).toBe(0)
  await expect(panel(page).getByRole('button', { name: 'Google로 계속하기', exact: true })).toHaveCount(1)
  await expect(panel(page).getByRole('button', { name: 'Apple로 계속하기', exact: true })).toHaveCount(1)
  await expect(panel(page).getByRole('button', { name: /이메일/ })).toHaveCount(1)
  await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible()
  expect(state.acks).toBe(0)
  await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveText('로그인을 확인했습니다.')
  expect(state.creates).toBe(0); expect(state.results).toBe(1); expect(state.acks).toBe(1)
  expect(state.authenticatedReads).toBeGreaterThan(0); expect(state.csrfReads).toBeGreaterThan(0)
  expect(state.calls.filter(call => call.startsWith('POST'))).toEqual([`POST ${ackPath}`])
  await expect(panel(page)).toHaveCount(0)
})

test('normal first visit still performs one exact anonymous bootstrap and cookie readback', async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { entry: '/' })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  expect(state.creates).toBe(1)
  expect(state.calls.slice(0, 4)).toEqual(['GET /api/v1/auth/session', 'POST /api/v1/anonymous-sessions', 'GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
  expect(state.acks).toBe(0); expect(state.results).toBe(0)
})

for (const initial of ['ANONYMOUS', 'AUTHENTICATED'] as const) test(`return 200 ${initial}: original bound-session recovery still uses session and CSRF without creation`, async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { initial })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(panel(page)).toBeVisible()
  expect(state.creates).toBe(0); expect(state.csrfReads).toBeGreaterThan(0); expect(state.results).toBe(0); expect(state.acks).toBe(0)
})

for (const initial of ['MALFORMED', '500'] as const) test(`return ${initial}: unvalidated failure never authorizes recovery or anonymous creation`, async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { initial })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(panel(page)).toHaveCount(0)
  expect(state.calls).toEqual(['GET /api/v1/auth/session']); expect(state.creates).toBe(0)
})

for (const entry of ['/auth/complete?state=unexpected', '/auth/complete#unexpected'] as const) test(`return malformed location ${entry}: no anonymous replacement or return command`, async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { entry })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(panel(page)).toHaveCount(0)
  expect(state.creates).toBe(0); expect(state.results).toBe(0); expect(state.acks).toBe(0)
  expect(state.calls.filter(call => call.startsWith('POST'))).toEqual([])
})

test('return missing transaction result stays unprivileged and never falls back to first-visit bootstrap', async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { missingResult: true })
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toHaveCount(0)
  expect(state.creates).toBe(0); expect(state.acks).toBe(0)
})

test('return ACK body without matching authenticated cookie never shows success or creates a new owner', async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { cookieMismatch: true })
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
  expect(state.creates).toBe(0); expect(state.acks).toBe(1)
})

test('return uncertain ACK survives recheck GET200 then GET401 with the same explicit ACK key and no replacement owner', async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { loseAck: true })
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
  await expect(panel(page).getByRole('alert')).toBeVisible()
  expect(state.keys).toHaveLength(1)
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await expect(panel(page)).toHaveCount(0)
  state.recheckRace = true
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(panel(page)).toBeVisible()
  expect(state.recheckReads).toBe(2)
  expect(state.creates).toBe(0); expect(state.acks).toBe(1)
  await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveText('로그인을 확인했습니다.')
  expect(state.keys).toHaveLength(2); expect(state.keys[1]).toBe(state.keys[0])
  expect(state.creates).toBe(0); expect(state.results).toBe(1); expect(state.acks).toBe(2)
  expect(state.calls.filter(call => call.startsWith('POST'))).toEqual([`POST ${ackPath}`, `POST ${ackPath}`])
})

for (const stored of ['pending', 'logout', 'email'] as const) test(`return ${stored}: preserve exact existing recovery bytes and dispatch no automatic mutation`, async ({ page, baseURL }) => {
  const { state, pending, logout, email } = await mount(page, baseURL, { stored })
  if (stored === 'pending') await expect(panel(page)).toBeVisible()
  else await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  const key = stored === 'pending' ? 'tesia.native.pending-command' : stored === 'logout' ? 'tesia.native.pending-logout' : 'tesia.native.email-intent'
  const expected = stored === 'pending' ? pending : stored === 'logout' ? logout : email
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(expected)
  if (stored === 'pending') {
    await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).evaluate(node => (node as HTMLButtonElement).click())
    await panel(page).getByRole('button', { name: 'Google 로그인 세션만 다시 확인', exact: true }).evaluate(node => (node as HTMLButtonElement).click())
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBe(expected)
    await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
  }
  if (stored !== 'pending') await expect(panel(page)).toHaveCount(0)
  expect(state.creates).toBe(0); expect(state.results).toBe(0); expect(state.acks).toBe(0)
  expect(state.calls.filter(call => call.startsWith('POST'))).toEqual([])
})
