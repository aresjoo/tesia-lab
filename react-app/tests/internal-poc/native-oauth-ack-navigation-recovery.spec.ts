import { expect, test, type Page } from '@playwright/test'

// Actual NativeServiceApp + browser controller + generated SDK. Every API
// response and cookie is a synthetic loopback fixture, not provider/TLS proof.
test.use({ serviceWorkers: 'block', trace: 'off', screenshot: 'off', video: 'off' })
test.setTimeout(45_000)
const oldOwner = 'session_ack_navigation_old_0001'
const authOwner = 'session_ack_navigation_auth_0001'
const resultId = 'oauth_result_ack_navigation_0001'
const transactionId = 'oidc_tx_ack_navigation_0001'
const oldEtag = '"etag_ack_navigation_old_007"'
const authEtag = '"etag_ack_navigation_auth_001"'
const resultEtag = '"etag_ack_navigation_result_000"'
const ackCsrf = 'csrf_ack_navigation_result_fixture_01'
const ackPath = `/api/v2/auth/google/results/${resultId}/acknowledgements`
const bindingKey = 'tesia.native.session-binding'
const preconditionKey = 'tesia.native.auth-claim-precondition'
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; await import('/src/internal-poc/service-main.tsx');</script></body></html>`
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version,
  resourceRevision: revision, requestId: 'req_ack_navigation_fixture_01', traceId: 'trace_ack_navigation_fixture_01' })

test('Native lost ACK → route departure → explicit return reuses the same request and validates session before adoption', async ({ page, baseURL }, info) => {
  if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') throw Error('OWNED_LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const state = { calls: [] as string[], blocked: [] as string[], errors: [] as string[], ackKeys: [] as string[],
    sessionReads: 0, resultReads: 0, authenticatedReads: 0, csrfReads: 0, blockedDevHmrAttempts: 0, held: false }
  let releaseSession!: () => void
  const gate = new Promise<void>(resolve => { releaseSession = resolve })
  const oldBinding = JSON.stringify({ sessionId: oldOwner, sessionState: 'ANONYMOUS' })
  const oldPrecondition = JSON.stringify({ provider: 'GOOGLE', sessionId: oldOwner, revision: '7', etag: oldEtag })
  const authenticated = { sessionId: authOwner, state: 'AUTHENTICATED', revision: '1',
    issuedAt: '2030-01-01T00:01:10Z', expiresAt: '2030-01-01T12:01:10Z' }
  page.on('pageerror', error => state.errors.push(error.message))
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:15Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.context().routeWebSocket('**/*', socket => {
    const url = new URL(socket.url())
    if (url.origin === origin.replace('http:', 'ws:') && url.pathname === '/' && [...url.searchParams.keys()].every(key => key === 'token')) state.blockedDevHmrAttempts++
    else state.blocked.push('NON_HMR_WS')
    socket.close()
  })
  await page.addInitScript(({ bindingKey, preconditionKey, oldBinding, oldPrecondition }) => {
    localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem(bindingKey, oldBinding); sessionStorage.setItem(preconditionKey, oldPrecondition)
  }, { bindingKey, preconditionKey, oldBinding, oldPrecondition })
  await page.context().route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    if (url.origin !== origin) { state.blocked.push('EXTERNAL'); return route.abort('blockedbyclient') }
    if (path !== '/api' && !path.startsWith('/api/')) {
      if (method !== 'GET') { state.blocked.push('NON_FIXTURE_MUTATION'); return route.abort('blockedbyclient') }
      if (req.isNavigationRequest() && ['/', '/auth/complete'].includes(path) && !url.search) return route.fulfill({ contentType: 'text/html', body: html })
      return route.continue()
    }
    const allowed = !url.search && req.postData() === null && (method === 'GET'
      && ['/api/v1/auth/session', '/api/v1/auth/csrf', '/api/v2/auth/google/results/current'].includes(path)
      || method === 'POST' && path === ackPath)
    if (!allowed) { state.blocked.push(`${method} ${path}`); return route.abort('blockedbyclient') }
    state.calls.push(`${method} ${path}`)
    expect(req.headers().authorization).toBeUndefined()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const respond = (version: string, revision: string | null, data: unknown) => route.fulfill({ headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    // This browser context contains only the synthetic cookie issued below.
    const signedIn = (await req.allHeaders()).cookie?.includes('teth_ack_navigation_fixture=confirmed') ?? false
    if (path === '/api/v1/auth/session') {
      state.sessionReads++
      if (!signedIn) return route.fulfill({ status: 401, headers, body: JSON.stringify({ meta: meta('0.1.0', null),
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session absence.' } }) })
      state.authenticatedReads++; state.held = true; await gate
      headers.ETag = authEtag
      return respond('0.1.0', '1', authenticated)
    }
    if (path === '/api/v1/auth/csrf') {
      expect(signedIn).toBe(true); state.csrfReads++
      return respond('0.1.0', null, { csrfToken: 'csrf_ack_navigation_session_fixture_01', expiresAt: authenticated.expiresAt })
    }
    if (path.endsWith('/results/current')) {
      state.resultReads++; headers.ETag = resultEtag
      return respond('0.2.0', '0', { resultId, transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:01:00Z',
        expiresAt: '2030-01-01T00:02:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: ackCsrf })
    }
    expect(req.headers()['x-csrf-token']).toBe(ackCsrf); expect(req.headers()['if-match']).toBe(resultEtag)
    const key = req.headers()['idempotency-key']; expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/); state.ackKeys.push(key)
    if (state.ackKeys.length === 1) return route.abort('failed')
    expect(state.ackKeys).toHaveLength(2); expect(key).toBe(state.ackKeys[0])
    headers.ETag = authEtag; headers['Set-Cookie'] = 'teth_ack_navigation_fixture=confirmed; HttpOnly; SameSite=Lax; Path=/'
    return respond('0.2.0', '1', { resultId, transactionId, session: authenticated, handoffReservation: {
      transactionId, initiatingSessionId: oldOwner, initiatingSessionRevision: '7', authenticatedSessionId: authOwner,
      state: 'RESERVED_FOR_CLAIM', expiresAt: authenticated.expiresAt } })
  })
  try {
    await page.goto(`${origin}/auth/complete`)
    await expect(panel(page)).toBeVisible()
    expect(state.calls).toEqual(['GET /api/v1/auth/session'])
    await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
    await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
    await expect(panel(page).getByRole('alert')).toBeVisible()
    await expect(panel(page)).toHaveAttribute('aria-busy', 'false')
    expect(state.ackKeys).toHaveLength(1)
    const retained = await panel(page).elementHandle()
    const beforeDeparture = [...state.calls]
    const storageBeforeDeparture = await page.evaluate(({ bindingKey, preconditionKey }) => ({
      binding: sessionStorage.getItem(bindingKey), precondition: sessionStorage.getItem(preconditionKey),
      pending: sessionStorage.getItem('tesia.native.pending-command') }), { bindingKey, preconditionKey })
    expect(storageBeforeDeparture).toEqual({ binding: oldBinding, precondition: oldPrecondition, pending: null })
    // Same-document browser navigation; the auth controls are never invoked by
    // synthetic DOM clicks. The Native host observes its real route event.
    await page.evaluate(() => { history.pushState(null, '', '/auth/complete#/trade'); window.dispatchEvent(new Event('teth:navigate')) })
    await expect(page.getByRole('dialog', { name: '로그인', exact: true })).toBeHidden()
    const cta = page.getByRole('region', { name: 'AI가 스스로 판단해 거래합니다', exact: true }).getByRole('button', { name: '시작하기', exact: true })
    await cta.click()
    await expect(page.getByRole('button', { name: '로그인 반환 화면으로 돌아가기', exact: true })).toBeVisible()
    expect(state.calls).toEqual(beforeDeparture)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: '로그인', exact: true })).toBeHidden(); await expect(cta).toBeFocused()
    await cta.click(); await page.getByRole('button', { name: '로그인 반환 화면으로 돌아가기', exact: true }).click()
    await expect(page).toHaveURL(/\/auth\/complete$/)
    await expect(panel(page)).toBeVisible(); await expect(panel(page)).toHaveAttribute('aria-busy', 'false')
    await expect(panel(page).getByRole('button', { name: '닫기', exact: true })).toBeFocused()
    expect(await retained!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
    expect(state.calls).toEqual(beforeDeparture)
    // Route recovery retains the ready panel's confirmation control. Unlike
    // the standalone reopen harness, it does not increment its resume token.
    const replay = panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })
    await expect(replay).toBeEnabled(); await replay.click()
    await expect.poll(() => state.held).toBe(true)
    await expect(panel(page)).toHaveAttribute('aria-busy', 'true')
    await expect(replay).toBeDisabled()
    await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
    expect(await page.evaluate(key => sessionStorage.getItem(key), bindingKey)).toBe(oldBinding)
    expect(state.csrfReads).toBe(0); expect(state.ackKeys).toHaveLength(2)
    releaseSession()
    await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveText('로그인을 확인했습니다.')
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(panel(page)).toHaveCount(0)
    expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), bindingKey))!)).toEqual({ sessionId: authOwner, sessionState: 'AUTHENTICATED' })
    expect(state.ackKeys).toHaveLength(2); expect(new Set(state.ackKeys).size).toBe(1)
    expect(state.resultReads).toBe(1); expect(state.authenticatedReads).toBeGreaterThan(0); expect(state.csrfReads).toBeGreaterThan(0)
    expect(state.calls.filter(call => call.startsWith('POST '))).toEqual([`POST ${ackPath}`, `POST ${ackPath}`])
    expect(state.calls.some(call => /anonymous-sessions|transactions|claim|conversations|backtests|orders/.test(call))).toBe(false)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
    expect(state.blocked).toEqual([]); expect(state.errors).toEqual([])
  } finally {
    releaseSession()
    info.annotations.push({ type: 'SYNTHETIC_ACK_ROUTE_RECOVERY', description: JSON.stringify({ ...state,
      actualProvider: false, actualTls: false, actualLogin: false, apiForwarded: 0, connectedWebSockets: 0 }) })
  }
})
