import { expect, test, type Page } from '@playwright/test'
import { TEST_ORIGIN } from '../test-origin'

// Synthetic protocol fixtures only; no provider request, callback, real token or credential.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
type Mode = 'ok' | 'no-cookie' | 'wrong-session' | 'wrong-result' | 'wrong-transaction' | 'missing-cache' | 'declined' | 'expired' | 'not-ready' | 'overflow' | 'session-loss-once' | 'ack-loss-once' | 'ack-body-loss'
const ETAG = '"etag_session_fixture_000001"'
const AUTH_ETAG = '"etag_authenticated_fixture_000001"'
const anon = { sessionId: 'session_anonymous_000001', state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
const authenticated = { sessionId: 'session_authenticated_0001', state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:01:10Z', expiresAt: '2030-01-01T12:01:10Z' }
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version, requestId: 'req_auth_fixture_000001', traceId: 'trace_auth_fixture_0001', resourceRevision: revision })
async function fixture(page: Page, provider: 'GOOGLE' | 'APPLE', mode: Mode) {
  const calls: string[] = []
  let authenticatedReads = 0
  const ackKeys: string[] = []
  const version = provider === 'GOOGLE' ? '0.2.0' : '0.4.0'
  const path = provider === 'GOOGLE' ? '/api/v2/auth/google' : '/api/v4/auth/apple'
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url())
    calls.push(`${request.method()} ${url.pathname}`)
    expect(url.origin).toBe(TEST_ORIGIN)
    expect(url.search).toBe('')
    expect(request.postData()).toBeNull()
    expect(request.headers().authorization).toBeUndefined()
    let status = 200, data: unknown, responseMeta = meta(version)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: ETAG }
    if (url.pathname === '/api/v1/auth/session') {
      const hasCookie = request.headers().cookie?.includes('tesia_synthetic_auth=ready') ?? false
      if (hasCookie) authenticatedReads++
      if (mode === 'session-loss-once' && authenticatedReads === 1) { await route.abort(); return }
      data = hasCookie ? { ...authenticated, ...(mode === 'wrong-session' ? { sessionId: 'session_other_user_00001' } : {}) } : anon
      responseMeta = meta('0.1.0', hasCookie ? '1' : '7')
      headers.ETag = hasCookie ? AUTH_ETAG : ETAG
    } else if (url.pathname === '/api/v1/auth/csrf') {
      data = { csrfToken: 'csrf_synthetic_browser_000001', expiresAt: '2030-01-01T12:01:10Z' }; responseMeta = meta('0.1.0', null)
      delete headers.ETag
    } else if (url.pathname === `${path}/transactions`) {
      status = 201
      headers['Set-Cookie'] = 'tesia_synthetic_tx=ready; HttpOnly; SameSite=Lax; Path=/'
      data = { transactionId: 'oidc_tx_fixture_000001', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
        authorizationRedirect: provider === 'GOOGLE' ? 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque'
          : 'https://appleid.apple.com/auth/authorize?client_id=invalid.tesia.fixture&redirect_uri=https%3A%2F%2Finternal.tesia.invalid%2Fapi%2Fv4%2Fauth%2Fapple%2Fcallback&response_type=code&response_mode=form_post&state=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB&nonce=NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN' }
    } else if (url.pathname === `${path}/results/current`) {
      expect(request.headers().cookie).toContain('tesia_synthetic_tx=ready')
      if (mode === 'not-ready') {
        await route.fulfill({ status: 409, headers, body: JSON.stringify({ meta: responseMeta, error: { code: 'AUTH_RESULT_NOT_READY', message: 'Authentication request failed.' } }) }); return
      }
      data = { resultId: 'oauth_result_fixture_0001', transactionId: mode === 'wrong-transaction' ? 'oidc_tx_other_00000001' : 'oidc_tx_fixture_000001', status: 'READY_FOR_ACK',
        issuedAt: '2030-01-01T00:01:00Z', expiresAt: '2030-01-01T00:02:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_result_fixture_000001' }
      if (mode === 'declined') { const closed = data as Record<string, unknown>; closed.status = 'DECLINED'; closed.failureCode = 'OAUTH_ACCESS_DENIED'; delete closed.acknowledgementCsrfToken }
      if (mode === 'expired') { const expired = data as Record<string, unknown>; for (const field of ['issuedAt', 'expiresAt', 'transactionExpiresAt']) expired[field] = String(expired[field]).replace('2030-', '2020-') }
      if (mode === 'missing-cache') delete headers['Cache-Control']
      if (mode === 'overflow') { await route.fulfill({ status, headers, body: JSON.stringify({ padding: 'x'.repeat(65_537) }) }); return }
    } else if (url.pathname === `${path}/results/oauth_result_fixture_0001/acknowledgements`) {
      ackKeys.push(request.headers()['idempotency-key'])
      if (mode === 'ack-loss-once' && ackKeys.length === 1) { await route.abort(); return }
      responseMeta = meta(version, '1')
      data = { resultId: mode === 'wrong-result' ? 'oauth_result_other_0001' : 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', session: authenticated,
        handoffReservation: { transactionId: 'oidc_tx_fixture_000001', initiatingSessionId: anon.sessionId, initiatingSessionRevision: '7', authenticatedSessionId: authenticated.sessionId, state: 'RESERVED_FOR_CLAIM', expiresAt: authenticated.expiresAt } }
      if (mode !== 'no-cookie') headers['Set-Cookie'] = 'tesia_synthetic_auth=ready; HttpOnly; SameSite=Lax; Path=/'
      if (mode === 'ack-body-loss') { await route.fulfill({ status: 200, headers, body: '{"meta":' }); return }
    } else { await route.abort(); return }
    await route.fulfill({ status, headers, body: JSON.stringify({ meta: responseMeta, data }) })
  })
  await page.route('https://accounts.google.com/**', route => route.abort())
  await page.route('https://appleid.apple.com/**', route => route.abort())
  await page.route(`${TEST_ORIGIN}/native-auth-test`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="root"></main></body></html>' }))
  await page.goto('/native-auth-test')
  return { calls, authenticatedReads: () => authenticatedReads, ackKeys }
}
async function execute(page: Page, provider: 'GOOGLE' | 'APPLE') {
  return page.evaluate(async ({ origin, provider }) => {
    const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
    const auth = createNativeBrowserAuth()
    let stage = 'START'
    try {
      const start = await auth.start(provider)
      stage = 'RESULT'
      const result = await auth.readResult(provider)
      if (result.status !== 'READY_FOR_ACK') return { status: result.status }
      stage = 'ACK_SESSION'
      const confirmed = await auth.acknowledge(provider)
      // Return only non-sensitive assertions, not URLs, CSRF, cookies or envelopes.
      return { status: 'CONFIRMED', provider: confirmed.provider, sessionId: confirmed.sessionId, claimId: confirmed.claimIntent.initiatingSessionId,
        verification: confirmed.verification, sameOrigin: location.origin === origin, redirectKnown: typeof start.authorizationRedirect === 'string' }
    } catch (error) { return { status: 'REJECTED', stage, code: (error as { code?: string }).code } }
  }, { origin: TEST_ORIGIN, provider })
}
for (const provider of ['GOOGLE', 'APPLE'] as const) {
  test(`${provider}: hidden cookie ack must round-trip; no auto navigation, callback or claim`, async ({ page }) => {
    const evidence = await fixture(page, provider, 'ok')
    const result = await execute(page, provider)
    expect(result, JSON.stringify({ result, calls: evidence.calls })).toMatchObject({ status: 'CONFIRMED', provider, sessionId: authenticated.sessionId, claimId: anon.sessionId, verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP', sameOrigin: true })
    expect(evidence.authenticatedReads()).toBe(1)
    expect(evidence.calls).toHaveLength(7)
    expect(evidence.calls.some(path => /callback|claim/.test(path))).toBe(false)
    expect(await page.evaluate(() => {
      const saved = sessionStorage.getItem('tesia.native.auth-claim-precondition')!
      return { cookiesHidden: !document.cookie.includes('tesia_synthetic_'), local: localStorage.length, session: sessionStorage.length,
        secretFree: !saved.includes('csrf') && !saved.includes('cookie'), fields: Object.keys(JSON.parse(saved)).sort() }
    })).toEqual({ cookiesHidden: true, local: 0, session: 1, secretFree: true, fields: ['etag', 'provider', 'revision', 'sessionId'] })
  })
}
for (const mode of ['no-cookie', 'wrong-session', 'wrong-result', 'wrong-transaction', 'missing-cache', 'expired', 'not-ready', 'overflow'] as const) {
  test(`Google: ${mode} never becomes authenticated`, async ({ page }) => {
    await fixture(page, 'GOOGLE', mode)
    expect(await execute(page, 'GOOGLE')).toMatchObject({ status: 'REJECTED', stage: ['no-cookie', 'wrong-session', 'wrong-result'].includes(mode) ? 'ACK_SESSION' : 'RESULT' })
  })
}
test('terminal declined response is displayed without acknowledgement', async ({ page }) => {
  const evidence = await fixture(page, 'GOOGLE', 'declined')
  expect(await execute(page, 'GOOGLE')).toEqual({ status: 'DECLINED' })
  expect(evidence.calls.some(path => path.endsWith('/acknowledgements'))).toBe(false)
})
test('selected provider cannot change inside a transaction', async ({ page }) => {
  const evidence = await fixture(page, 'GOOGLE', 'ok')
  const code = await page.evaluate(async origin => {
    const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
    const auth = createNativeBrowserAuth(); await auth.start('GOOGLE')
    try { await auth.readResult('APPLE'); return 'ACCEPTED' } catch (error) { return (error as { code: string }).code }
  }, TEST_ORIGIN)
  expect(code).toBe('AUTH_PROVIDER_MISMATCH')
  expect(evidence.calls.some(path => path.includes('/apple/'))).toBe(false)
})

for (const mode of ['session-loss-once', 'ack-loss-once'] as const) {
  test(`${mode}: explicit recovery preserves acknowledgement identity`, async ({ page }) => {
    const evidence = await fixture(page, 'GOOGLE', mode)
    const result = await page.evaluate(async origin => {
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      const auth = createNativeBrowserAuth(); await auth.start('GOOGLE'); await auth.readResult('GOOGLE')
      let firstRejected = false
      try { await auth.acknowledge('GOOGLE') } catch { firstRejected = true }
      const recovered = await auth.acknowledge('GOOGLE')
      return { firstRejected, verification: recovered.verification }
    }, TEST_ORIGIN)
    expect(result).toEqual({ firstRejected: true, verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP' })
    expect(evidence.ackKeys).toHaveLength(mode === 'ack-loss-once' ? 2 : 1)
    expect(evidence.ackKeys.every(key => typeof key === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(key))).toBe(true)
    expect(new Set(evidence.ackKeys).size).toBe(1)
  })
}

for (const provider of ['GOOGLE', 'APPLE'] as const) {
  test(`${provider}: full-page return uses a new controller and real synthetic cookie jar`, async ({ page }) => {
    const evidence = await fixture(page, provider, 'ok')
    await page.evaluate(async ({ origin, provider }) => {
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      await createNativeBrowserAuth().start(provider)
    }, { origin: TEST_ORIGIN, provider })
    await page.reload()
    const verified = await page.evaluate(async ({ origin, provider }) => {
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      const auth = createNativeBrowserAuth()
      await auth.readResult(provider)
      const result = await auth.acknowledge(provider)
      return { verification: result.verification, claimEtag: result.claimIntent.initiatingSessionEtag, sessionEtag: result.sessionEtag }
    }, { origin: TEST_ORIGIN, provider })
    expect(verified).toEqual({ verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP', claimEtag: ETAG, sessionEtag: AUTH_ETAG })
    expect(evidence.authenticatedReads()).toBe(1)
    expect(evidence.calls.filter(path => path.endsWith('/transactions'))).toHaveLength(1)
  })
}

test('panel waits for explicit clicks and never claims the draft', async ({ page }) => {
  const evidence = await fixture(page, 'GOOGLE', 'ok')
  await page.evaluate(async origin => {
    const refresh = (await import(`${origin}/@react-refresh`)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => undefined, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
    const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
    const runtimePaths = await testClientReactRuntimePaths()
    const React = (await import(runtimePaths.reactPath)).default
    const { createRoot } = (await import(runtimePaths.rootPath)).default
    const { NativeLoginPanel } = await import(`${origin}/src/internal-poc/NativeLoginPanel.tsx`)
    createRoot(document.getElementById('root')!).render(React.createElement(NativeLoginPanel, { onAuthenticated: () => { document.body.dataset.authConfirmed = 'true' } }))
  }, TEST_ORIGIN)
  await expect(page.getByRole('heading', { name: '로그인 또는 회원가입' })).toBeVisible()
  expect(evidence.calls).toHaveLength(0)
  await page.getByRole('button', { name: 'Google로 계속하기' }).click()
  await expect(page.getByRole('link', { name: 'Google 인증 페이지로 직접 이동' })).toBeVisible()
  expect(page.url()).toBe(`${TEST_ORIGIN}/native-auth-test`)
  expect(evidence.calls).toHaveLength(3)
  await page.getByRole('button', { name: '돌아온 뒤 인증 결과 확인' }).click()
  await page.getByRole('button', { name: '로그인 확정 및 세션 확인' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-auth-confirmed', 'true')
  await expect(page.getByRole('status')).toContainText('전략 연결은 별도로 동의')
  expect(evidence.calls.some(path => /callback|claim/.test(path))).toBe(false)
})

for (const tamper of ['sessionId', 'revision', 'etag', 'missing', 'storage-unavailable'] as const) {
  test(`returned-page ${tamper}: login can confirm without inventing a claim precondition`, async ({ page }) => {
    await fixture(page, 'GOOGLE', 'ok')
    await page.evaluate(async ({ origin, tamper }) => {
      if (tamper === 'storage-unavailable') Storage.prototype.setItem = () => { throw new DOMException('Synthetic unavailable storage') }
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      await createNativeBrowserAuth().start('GOOGLE')
      const key = 'tesia.native.auth-claim-precondition'
      if (tamper === 'missing') sessionStorage.removeItem(key)
      else if (tamper !== 'storage-unavailable') {
        const saved = JSON.parse(sessionStorage.getItem(key)!)
        saved[tamper] = tamper === 'sessionId' ? 'session_unrelated_000001' : tamper === 'revision' ? '8' : 'not-an-observed-etag'
        sessionStorage.setItem(key, JSON.stringify(saved))
      }
    }, { origin: TEST_ORIGIN, tamper })
    await page.reload()
    const result = await page.evaluate(async origin => {
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      const auth = createNativeBrowserAuth(); await auth.readResult('GOOGLE')
      const result = await auth.acknowledge('GOOGLE')
      return { verified: result.verification, claimAvailable: result.claimIntent.initiatingSessionEtag !== undefined }
    }, TEST_ORIGIN)
    expect(result).toEqual({ verified: 'COOKIE_BOUND_SESSION_ROUND_TRIP', claimAvailable: false })
  })
}

for (const provider of ['GOOGLE', 'APPLE'] as const) test(`${provider}: ACK body loss reload offers only SESSION_CONFIRMED_HANDOFF_UNVERIFIED`, async ({ page }) => {
  const evidence = await fixture(page, provider, 'ack-body-loss')
  expect(await execute(page, provider)).toMatchObject({ status: 'REJECTED', stage: 'ACK_SESSION' })
  await page.reload()
  const result = await page.evaluate(async ({ origin, provider }) => {
    const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
    const recovered = await createNativeBrowserAuth().recoverSession(provider)
    return { verification: recovered.verification, id: recovered.sessionId, claimEtag: recovered.claimIntent?.initiatingSessionEtag,
      providerClaimed: 'provider' in recovered }
  }, { origin: TEST_ORIGIN, provider })
  expect(result).toEqual({ verification: 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED', id: authenticated.sessionId, claimEtag: ETAG, providerClaimed: false })
  expect(evidence.ackKeys).toHaveLength(1)
  expect(evidence.calls.filter(path => path.endsWith('/claim'))).toHaveLength(0)
})
