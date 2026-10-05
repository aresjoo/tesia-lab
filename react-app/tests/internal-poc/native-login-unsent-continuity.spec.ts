import { expect, test, type Page } from '@playwright/test'
import { TEST_ORIGIN } from '../test-origin'
import { openNativeAccountMenu } from './native-account-test-helpers'

// Real service controller/SDK, declared same-origin synthetic responses only.
// No provider navigation, real callback, SMTP, backend or issued login proof.
// Original private RED2 titles map here; the new filename is not the old key.
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off' })
test.setTimeout(30_000)
const anonymous = 'session_anonymous_000001', authenticated = 'session_authenticated_0001'
const anonEtag = '"etag_unsent_red_anon_007"', authEtag = '"etag_unsent_red_auth_001"'
const transaction = 'oidc_tx_fixture_000001', resultId = 'oauth_result_fixture_0001', challengeId = 'email_challenge_unsent_fixture_001'
const issuedAt = '2030-01-01T00:00:10Z', expiresAt = '2030-01-01T12:00:10Z'
const csrf = 'csrf_unsent_red_fixture_00001', ackCsrf = 'csrf_result_fixture_000001'
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_unsent_red_fixture_0001', traceId: 'trace_unsent_red_fixture_0001' })
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const composer = (page: Page) => page.locator('.client-home-content textarea')
const ackPath = `/api/v2/auth/google/results/${resultId}/acknowledgements`
const verifyPath = `/api/v9/auth/email/challenges/${challengeId}/verifications`
const draft = '전송하지 않은 투자 질문 BTC 손절 조건도 함께 검토해줘'

async function mount(page: Page) {
  const state = { owner: anonymous, issueCookie: true, freshResult: false, started: false, revoked: false,
    emailForeignHandoff: false, holdAck: undefined as (() => Promise<void>) | undefined,
    calls: [] as string[], external: [] as string[], unexpected: [] as string[], blocked: [] as string[],
    undeclaredMutations: [] as string[], errors: [] as string[], cookieSessionReads: 0 }
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1') })
  page.on('pageerror', error => state.errors.push(error.message))
  // One context-wide route owns the complete guard. No page-level LIFO override
  // can accidentally forward an unknown auth/business mutation to a backend.
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    const foreign = url.origin !== TEST_ORIGIN, mutation = !['GET', 'HEAD'].includes(request.method())
    const api = path === '/api' || path.startsWith('/api/'), label = `${request.method()} ${url.origin}${path}${url.search}`
    const reads = ['/api/v1/auth/session', '/api/v1/auth/csrf', '/api/v2/auth/google/results/current']
    const posts = ['/api/v2/auth/google/transactions', ackPath, '/api/v9/auth/email/challenges', verifyPath, '/api/v1/auth/logout']
    const declared = !foreign && !url.search && (request.method() === 'GET' && reads.includes(path)
      || request.method() === 'POST' && posts.includes(path))
    if (foreign) state.external.push(label)
    if (api && !declared) state.unexpected.push(label)
    if (mutation && !declared) state.undeclaredMutations.push(label)
    if (foreign || api && !declared || mutation && !declared) { state.blocked.push(label); return route.abort('blockedbyclient') }
    if (declared) {
      state.calls.push(`${request.method()} ${path}`)
      const signedIn = (await request.allHeaders()).cookie?.includes('teth_unsent_red_fixture=confirmed') ?? false
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: anonEtag }
      let data: unknown, version = '0.2.0', revision: string | null = '0', status = 200
      const session = { sessionId: authenticated, state: 'AUTHENTICATED', revision: '1', issuedAt, expiresAt }
      const installCookie = () => { if (state.issueCookie) headers['Set-Cookie'] = 'teth_unsent_red_fixture=confirmed; HttpOnly; SameSite=Lax; Path=/' }
      if (path === '/api/v1/auth/session') {
        version = '0.1.0'; revision = signedIn ? '1' : '7'
        if (state.revoked) return route.fulfill({ status: 401, headers, body: JSON.stringify({ meta: meta(version, null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.' } }) })
        if (signedIn) { state.cookieSessionReads++; headers.ETag = authEtag }
        data = signedIn ? session : { sessionId: state.owner, state: 'ANONYMOUS', revision,
          issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
      } else if (path === '/api/v1/auth/csrf') {
        version = '0.1.0'; revision = null; delete headers.ETag
        data = { csrfToken: csrf, expiresAt: '2030-01-02T00:00:00Z' }
      } else if (path === '/api/v2/auth/google/transactions') {
        expect(state.started).toBe(false); expect(request.postData()).toBeNull()
        expect(request.headers()['x-csrf-token']).toBe(csrf); expect(request.headers()['if-match']).toBe(anonEtag)
        expect(request.headers()['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{16,128}$/)
        state.started = true; status = 201
        data = { transactionId: transaction, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
          authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque' }
      } else if (path === '/api/v2/auth/google/results/current') {
        expect(state.started || state.freshResult).toBe(true)
        data = { resultId, transactionId: transaction, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:00:00Z',
          expiresAt: '2030-01-01T00:01:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: ackCsrf }
      } else if (path === ackPath) {
        expect(request.postData()).toBeNull(); expect(request.headers()['x-csrf-token']).toBe(ackCsrf)
        expect(request.headers()['if-match']).toBe(anonEtag)
        expect(request.headers()['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{16,128}$/)
        if (state.holdAck) await state.holdAck()
        installCookie(); revision = '1'
        data = { resultId, transactionId: transaction, session,
          handoffReservation: { transactionId: transaction, initiatingSessionId: anonymous, initiatingSessionRevision: '7',
            authenticatedSessionId: authenticated, state: 'RESERVED_FOR_CLAIM', expiresAt } }
      } else if (path === '/api/v9/auth/email/challenges') {
        expect(request.postDataJSON()).toEqual({ email: 'unsent-fixture@example.invalid' })
        expect(request.headers()['x-csrf-token']).toBe(csrf); expect(request.headers()['if-match']).toBe(anonEtag)
        version = '0.9.0'; revision = '7'; status = 201; headers.ETag = '"email_unsent_challenge_fixture_01"'
        data = { challengeId, initiatingSessionId: anonymous, initiatingSessionRevision: '7', initiatingSessionEtag: anonEtag,
          issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:05:00Z', resendAllowedAt: '2030-01-01T00:00:30Z', deliveryStatus: 'ACCEPTED' }
      } else if (path === verifyPath) {
        expect(request.postDataJSON()).toEqual({ code: '000123' }); expect(request.headers()['x-csrf-token']).toBe(csrf)
        expect(request.headers()['if-match']).toBe(anonEtag)
        version = '0.9.0'; revision = '1'; headers.ETag = authEtag; installCookie()
        data = { challengeId, challengeExpiresAt: '2030-01-01T00:05:00Z', session,
          handoffReservation: { challengeId, initiatingSessionId: state.emailForeignHandoff ? 'session_unrelated_owner_001' : anonymous,
            initiatingSessionRevision: '7', initiatingSessionEtag: anonEtag, authenticatedSessionId: authenticated, state: 'RESERVED_FOR_CLAIM', expiresAt } }
      } else {
        expect(path).toBe('/api/v1/auth/logout'); expect(signedIn).toBe(true)
        expect(request.headers()['x-csrf-token']).toBe(csrf); expect(request.headers()['if-match']).toBe(authEtag)
        state.revoked = true; version = '0.1.0'; revision = '2'; headers.ETag = '"etag_unsent_revoked_fixture_002"'
        data = { ...session, state: 'REVOKED', revision: '2' }
      }
      return route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    }
    if (request.method() === 'GET' && request.isNavigationRequest() && path === '/' && !url.search) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await composer(page).fill(draft); await expect(composer(page)).toHaveValue(draft)
  return state
}
async function openLogin(page: Page) {
  const login = page.getByRole('button', { name: '로그인', exact: true }).first()
  if (await login.isVisible()) await login.click()
  else await page.locator('.client-free-row button').click()
  await expect(panel(page)).toBeVisible()
}
async function start(page: Page) {
  await openLogin(page); await panel(page).getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect(panel(page).getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
  // Intentionally do not visit the provider. READY is a declared fixture.
  await expect(composer(page)).toHaveValue(draft)
}
async function ready(page: Page) {
  await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible()
  await expect(composer(page)).toHaveValue(draft)
}
async function acknowledge(page: Page) { await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click() }
async function success(page: Page, state: Awaited<ReturnType<typeof mount>>) {
  await expect(panel(page)).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveText('로그인을 확인했습니다.')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('alert')).toHaveCount(0); expect(state.cookieSessionReads).toBeGreaterThan(0)
}
async function guard(page: Page, state: Awaited<ReturnType<typeof mount>>, posts: string[]) {
  expect(state.external).toEqual([]); expect(state.unexpected).toEqual([]); expect(state.blocked).toEqual([])
  expect(state.undeclaredMutations).toEqual([]); expect(state.errors).toEqual([])
  expect(state.calls.filter(call => call.startsWith('POST '))).toEqual(posts.map(path => `POST ${path}`))
  expect(state.calls.some(call => /claim|approv|conversation|backtests|order/.test(call))).toBe(false)
  expect(page.context().serviceWorkers()).toHaveLength(0)
  expect(await page.evaluate(text => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(text), draft)).toBe(false)
}
for (const width of [1440, 390]) test(`Native Google synthetic START→READY→ACK preserves unsent home draft ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await mount(page); await page.screenshot({ path: info.outputPath('before-login.png') })
  await start(page); await ready(page); await acknowledge(page); await success(page, state)
  await expect(composer(page)).toHaveValue(draft); await expect(composer(page)).toBeEnabled()
  await guard(page, state, ['/api/v2/auth/google/transactions', ackPath])
  await page.screenshot({ path: info.outputPath('after-login-preserved.png') })
})
test('same-owner email verification preserves the unsent wording without claiming or sending it', async ({ page }) => {
  const state = await mount(page); await openLogin(page); await panel(page).getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  const form = page.getByRole('form', { name: '이메일 로그인', exact: true })
  await form.getByLabel('이메일 주소', { exact: true }).fill('unsent-fixture@example.invalid'); await form.getByRole('button', { name: '인증번호 요청', exact: true }).click()
  await form.getByLabel('6자리 인증번호', { exact: true }).fill('000123'); await form.getByRole('button', { name: '인증번호 확인', exact: true }).click()
  await success(page, state); await expect(composer(page)).toHaveValue(draft)
  await guard(page, state, ['/api/v9/auth/email/challenges', verifyPath])
})
test('an ACK without its authenticated cookie does not publish a login or move the unsent draft', async ({ page }) => {
  const state = await mount(page); state.issueCookie = false; await start(page); await ready(page); await acknowledge(page)
  await expect(panel(page).getByRole('alert')).toBeVisible(); await expect(composer(page)).toHaveValue(draft)
  await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
  expect(state.cookieSessionReads).toBe(0); await guard(page, state, ['/api/v2/auth/google/transactions', ackPath])
})
test('a returned result without observed anonymous precondition clears the old unsent wording', async ({ page }) => {
  const state = await mount(page); state.freshResult = true
  // Same-document return path: no fresh-page memory guarantee is invented.
  await page.evaluate(() => history.replaceState(null, '', '/auth/complete'))
  await openLogin(page); await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  await acknowledge(page); await success(page, state); await expect(composer(page)).toHaveValue('')
  await guard(page, state, [ackPath])
})
test('a foreign conversation owner cannot carry the unsent wording into a verified login', async ({ page }) => {
  const state = await mount(page)
  await page.evaluate(() => sessionStorage.setItem('tesia.native.conversation-session', 'session_unrelated_owner_001'))
  await start(page); await ready(page); await acknowledge(page); await success(page, state)
  await expect(composer(page)).toHaveValue(''); await guard(page, state, ['/api/v2/auth/google/transactions', ackPath])
})
test('a changed cookie owner before opening login does not start or confirm the old owner flow', async ({ page }) => {
  const state = await mount(page); state.owner = 'session_unrelated_owner_001'
  const login = page.getByRole('button', { name: '로그인', exact: true }).first()
  if (await login.isVisible()) await login.click(); else await page.locator('.client-free-row button').click()
  await expect(page.getByRole('alert')).toContainText('REQUEST_UNCONFIRMED'); await expect(panel(page)).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.session-binding')!))).toEqual({ sessionId: anonymous, sessionState: 'ANONYMOUS' })
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toHaveValue(draft)
  // Existing safeCode recovery keeps the observed ANON binding and CSRF;
  // ready is not proof of AUTH, and no provider flow or mutation has started.
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
  await guard(page, state, [])
})
test('session-only recovery clears the old wording even when an anonymous precondition exists', async ({ page }) => {
  const state = await mount(page); await start(page)
  await page.context().addCookies([{ name: 'teth_unsent_red_fixture', value: 'confirmed', url: TEST_ORIGIN, httpOnly: true, sameSite: 'Lax' }])
  await panel(page).getByRole('button', { name: '로그인 세션만 다시 확인', exact: true }).click()
  await expect(panel(page)).toHaveCount(0); await expect(composer(page)).toHaveValue('')
  await expect(page.getByRole('status').filter({ hasText: '공급자 인증·로그인 확정 응답·전략 인계는 미확인' })).toBeVisible()
  await guard(page, state, ['/api/v2/auth/google/transactions'])
})
test('foreign email handoff evidence cannot confirm login or relabel the unsent wording', async ({ page }) => {
  const state = await mount(page); state.emailForeignHandoff = true; await openLogin(page)
  await panel(page).getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  const form = page.getByRole('form', { name: '이메일 로그인', exact: true })
  await form.getByLabel('이메일 주소', { exact: true }).fill('unsent-fixture@example.invalid'); await form.getByRole('button', { name: '인증번호 요청', exact: true }).click()
  await form.getByLabel('6자리 인증번호', { exact: true }).fill('000123'); await form.getByRole('button', { name: '인증번호 확인', exact: true }).click()
  await expect(form.getByRole('alert')).toBeVisible(); await expect(composer(page)).toHaveValue(draft)
  await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
  await guard(page, state, ['/api/v9/auth/email/challenges', verifyPath])
})
test('closing and reopening the login does not send or overwrite the unsent wording', async ({ page }) => {
  const state = await mount(page); await start(page); const posts = state.calls.filter(call => call.startsWith('POST '))
  await page.keyboard.press('Escape'); await expect(panel(page)).toBeHidden(); await expect(composer(page)).toHaveValue(draft)
  await openLogin(page); await expect(composer(page)).toHaveValue(draft)
  expect(state.calls.filter(call => call.startsWith('POST '))).toEqual(posts)
  await guard(page, state, ['/api/v2/auth/google/transactions'])
})
test('duplicate confirmation keys cannot create another ACK or an automatic strategy request', async ({ page }) => {
  const state = await mount(page); await start(page); await ready(page)
  let release: () => void = () => undefined
  state.holdAck = () => new Promise<void>(resolve => { release = resolve })
  try {
    const confirm = panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })
    await confirm.focus(); await page.keyboard.press('Enter'); await expect.poll(() => state.calls.filter(call => call === `POST ${ackPath}`).length).toBe(1)
    await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await expect(composer(page)).toHaveValue(draft)
  } finally { release() }
  await success(page, state); await expect(composer(page)).toHaveValue(draft)
  await guard(page, state, ['/api/v2/auth/google/transactions', ackPath])
})
test('explicit logout clears preserved unsent wording rather than moving it to another account', async ({ page }) => {
  const state = await mount(page); await start(page); await ready(page); await acknowledge(page); await success(page, state)
  await expect(composer(page)).toHaveValue(draft)
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('heading', { name: '로그아웃 요청 확인', exact: true })).toBeVisible()
  expect(await page.locator('textarea').evaluateAll((nodes, text) => nodes.every(node => (node as HTMLTextAreaElement).value !== text), draft)).toBe(true)
  await expect.poll(() => state.calls.filter(call => call === 'POST /api/v1/auth/logout').length).toBe(1)
  await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.', exact: true })).toBeVisible()
  await guard(page, state, ['/api/v2/auth/google/transactions', ackPath, '/api/v1/auth/logout'])
})
test('full-page reload does not promise persistence of an in-memory unsent draft', async ({ page }) => {
  const state = await mount(page); await start(page); await page.keyboard.press('Escape'); await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(composer(page)).toHaveValue(''); await expect(panel(page)).toHaveCount(0)
  await guard(page, state, ['/api/v2/auth/google/transactions'])
})
