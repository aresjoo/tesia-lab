import { expect, test, type Page } from '@playwright/test'
import { TEST_ORIGIN } from '../test-origin'

// Synthetic SDK/UI contract tests. No real provider, email transport or server authority claim.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const anon = { sessionId: 'session_anonymous_000001', state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
const etag = (revision: string) => `"etag_session_fixture_${revision.padStart(6, '0')}"`
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version, requestId: 'req_auth_fixture_000001', traceId: 'trace_auth_fixture_0001', resourceRevision: revision })
type Mode = 'declined' | 'failed' | 'expired' | 'local-expired' | 'unknown-start' | 'unknown-ack' | 'wrong-owner' | 'authenticated' | 'handoff' | 'swap-on-csrf' | 'revision-on-csrf' | 'etag-on-csrf' | 'csrf-loss' | 'new-start-loss' | 'malformed-expiry'
async function fixture(page: Page, provider: 'GOOGLE' | 'APPLE', mode: Mode) {
  let starts = 0, terminalObserved = false, csrfReads = 0, sessions = 0
  const keys: string[] = [], conditions: string[] = [], csrfValues: string[] = [], calls: string[] = []
  const version = provider === 'GOOGLE' ? '0.2.0' : '0.4.0'
  const path = provider === 'GOOGLE' ? '/api/v2/auth/google' : '/api/v4/auth/apple'
  await page.route('**/api/**', async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname
    calls.push(`${request.method()} ${pathname}`)
    expect(new URL(request.url()).origin).toBe(TEST_ORIGIN)
    expect(request.postData()).toBeNull()
    let status = 200, data: unknown, envelopeMeta = meta(version)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: etag('7') }
    if (pathname === '/api/v1/auth/session') {
      sessions++
      let current = { ...anon, revision: terminalObserved ? '9' : '7' }
      if (terminalObserved && mode === 'wrong-owner' || terminalObserved && mode === 'swap-on-csrf' && csrfReads > 1) current.sessionId = 'session_anonymous_other01'
      if (terminalObserved && mode === 'authenticated') current = { ...current, state: 'AUTHENTICATED', sessionId: 'session_authenticated_0001' }
      if (terminalObserved && mode === 'handoff') current.state = 'HANDOFF_BOUND'
      if (terminalObserved && mode === 'revision-on-csrf' && csrfReads > 1) current.revision = '10'
      data = current; envelopeMeta = meta('0.1.0', current.revision); headers.ETag = etag(current.revision)
      if (terminalObserved && mode === 'etag-on-csrf' && csrfReads > 1) headers.ETag = etag('10')
    } else if (pathname === '/api/v1/auth/csrf') {
      csrfReads++
      if (mode === 'csrf-loss' && csrfReads === 2) { await route.abort(); return }
      data = { csrfToken: `csrf_synthetic_browser_${csrfReads.toString().padStart(6, '0')}`, expiresAt: '2030-01-01T12:01:10Z' }
      envelopeMeta = meta('0.1.0', null); delete headers.ETag
    } else if (pathname === `${path}/transactions`) {
      starts++; keys.push(request.headers()['idempotency-key']); conditions.push(request.headers()['if-match']); csrfValues.push(request.headers()['x-csrf-token'])
      if (mode === 'unknown-start' && starts === 1 || mode === 'new-start-loss' && starts === 2) { await route.abort(); return }
      status = 201
      data = { transactionId: starts > 1 && mode !== 'unknown-start' ? 'oidc_tx_fixture_000002' : 'oidc_tx_fixture_000001', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:10:00Z',
        authorizationRedirect: provider === 'GOOGLE' ? 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque'
          : 'https://appleid.apple.com/auth/authorize?client_id=invalid.tesia.fixture&redirect_uri=https%3A%2F%2Finternal.tesia.invalid%2Fapi%2Fv4%2Fauth%2Fapple%2Fcallback&response_type=code&response_mode=form_post&state=BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB&nonce=NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN' }
    } else if (pathname === `${path}/results/current`) {
      if (mode === 'expired' || mode === 'malformed-expiry') {
        terminalObserved = true
        await route.fulfill({ status: 410, headers, body: JSON.stringify({ meta: envelopeMeta, error: { code: 'AUTH_RESULT_EXPIRED', message: mode === 'malformed-expiry' ? '' : 'Authentication request failed.' } }) }); return
      }
      const isReady = mode === 'unknown-ack' || mode === 'local-expired'
      terminalObserved = !isReady
      data = { resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', status: isReady ? 'READY_FOR_ACK' : mode === 'failed' ? 'FAILED' : 'DECLINED', issuedAt: '2030-01-01T00:01:00Z', expiresAt: '2030-01-01T00:02:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z',
        ...(isReady ? { acknowledgementCsrfToken: 'csrf_result_fixture_000001' } : { failureCode: mode === 'failed' ? 'OAUTH_PROVIDER_ERROR' : 'OAUTH_ACCESS_DENIED' }) }
      if (mode === 'local-expired') for (const key of ['issuedAt', 'expiresAt', 'transactionExpiresAt']) (data as Record<string, string>)[key] = String((data as Record<string, string>)[key]).replace('2030-', '2020-')
    } else if (pathname.endsWith('/acknowledgements') && mode === 'unknown-ack') { await route.abort(); return }
    else { await route.abort(); return }
    await route.fulfill({ status, headers, body: JSON.stringify({ meta: envelopeMeta, data }) })
  })
  await page.route(`${TEST_ORIGIN}/native-login-restart-test`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="root"></main></body></html>' }))
  await page.goto('/native-login-restart-test')
  return { calls, keys, conditions, csrfValues, sessions: () => sessions }
}
async function moduleFlow(page: Page, provider: 'GOOGLE' | 'APPLE', mode: Mode) {
  return page.evaluate(async ({ origin, provider, mode }) => {
    const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
    const auth = createNativeBrowserAuth()
    const code = async (operation: () => Promise<unknown>) => { try { await operation(); return 'OK' } catch (error) { return (error as { code?: string }).code } }
    await code(() => auth.start(provider))
    if (mode !== 'unknown-start') await code(() => auth.readResult(provider))
    if (mode === 'unknown-ack') await code(() => auth.acknowledge(provider))
    const before = auth.canRestart(), restart = await code(() => auth.restart(provider)), after = auth.canRestart()
    if (mode === 'unknown-start' || mode === 'new-start-loss') await code(() => auth.start(provider))
    const saved = JSON.parse(sessionStorage.getItem('tesia.native.auth-claim-precondition')!)
    return { before, restart, after, savedRevision: saved.revision, savedEtag: saved.etag, savedKeys: Object.keys(saved).sort() }
  }, { origin: TEST_ORIGIN, provider, mode })
}
for (const provider of ['GOOGLE', 'APPLE'] as const) {
  for (const mode of ['declined', 'failed', 'expired'] as const) test(`${provider} ${mode}: explicit restart binds fresh anonymous revision and fresh key`, async ({ page }) => {
    const evidence = await fixture(page, provider, mode)
    expect(await moduleFlow(page, provider, mode)).toMatchObject({ before: true, restart: 'OK', after: false, savedRevision: '9', savedEtag: etag('9'), savedKeys: ['etag', 'provider', 'revision', 'sessionId'] })
    expect(evidence.keys).toHaveLength(2); expect(evidence.keys[0]).not.toBe(evidence.keys[1])
    expect(evidence.conditions).toEqual([etag('7'), etag('9')]); expect(evidence.csrfValues[0]).not.toBe(evidence.csrfValues[1])
    expect(evidence.calls.some(call => /acknowledgements|claim/.test(call))).toBe(false)
  })
  for (const mode of ['unknown-start', 'unknown-ack', 'local-expired', 'malformed-expiry'] as const) test(`${provider} ${mode}: no new key from ambiguity or local expiry`, async ({ page }) => {
    const evidence = await fixture(page, provider, mode)
    expect(await moduleFlow(page, provider, mode)).toMatchObject({ before: false, restart: 'AUTH_RESTART_NOT_CONFIRMED', after: false })
    expect(new Set(evidence.keys).size).toBe(1)
    expect(evidence.keys.length).toBe(mode === 'unknown-start' ? 2 : 1)
  })
  for (const mode of ['wrong-owner', 'authenticated', 'handoff', 'swap-on-csrf', 'revision-on-csrf', 'etag-on-csrf', 'csrf-loss'] as const) test(`${provider} ${mode}: terminal receipt cannot bypass present session`, async ({ page }) => {
    const evidence = await fixture(page, provider, mode)
    const result = await moduleFlow(page, provider, mode)
    expect(result.before).toBe(true); expect(result.restart).not.toBe('OK'); expect(result.savedRevision).toBe('7')
    expect(evidence.keys).toHaveLength(1)
  })
  test(`${provider} lost replacement start: same new key retry, original key never reused`, async ({ page }) => {
    const evidence = await fixture(page, provider, 'new-start-loss')
    expect(await moduleFlow(page, provider, 'new-start-loss')).toMatchObject({ before: true, restart: 'AUTH_RESPONSE_UNCONFIRMED', after: false })
    expect(evidence.keys).toHaveLength(3); expect(evidence.keys[0]).not.toBe(evidence.keys[1]); expect(evidence.keys[1]).toBe(evidence.keys[2])
    expect(evidence.conditions).toEqual([etag('7'), etag('9'), etag('9')])
  })
  test(`${provider} UI terminal status exposes explicit restart; double click creates one replacement`, async ({ page }) => {
    const evidence = await fixture(page, provider, 'declined')
    await page.evaluate(async origin => {
      const refresh = (await import(`${origin}/@react-refresh`)).default
      refresh.injectIntoGlobalHook(window)
      Object.assign(window, { $RefreshReg$: () => undefined, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
      const runtimeHelperPath = '/tests/fixtures/client-react-runtime.ts'
      const { testClientReactRuntimePaths } = await import(/* @vite-ignore */ runtimeHelperPath)
      const runtimePaths = await testClientReactRuntimePaths()
      const React = (await import(runtimePaths.reactPath)).default, { createRoot } = (await import(runtimePaths.rootPath)).default
      const { NativeLoginPanel } = await import(`${origin}/src/internal-poc/NativeLoginPanel.tsx`)
      createRoot(document.getElementById('root')!).render(React.createElement(NativeLoginPanel, { onAuthenticated: () => { throw new Error('NO_AUTO_AUTH') }, onSessionRecovered: () => {} }))
    }, TEST_ORIGIN)
    const label = provider === 'GOOGLE' ? 'Google' : 'Apple'
    await page.getByRole('button', { name: `${label}로 계속하기`, exact: true }).click()
    await expect(page.getByRole('link', { name: /인증 페이지로 직접 이동/ })).toBeVisible()
    await page.getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
    const restart = page.getByRole('button', { name: `${label} 로그인 다시 시작`, exact: true })
    await expect(restart).toBeVisible(); expect(evidence.keys).toHaveLength(1)
    await expect(page.getByRole('link', { name: /인증 페이지로 직접 이동/ })).toHaveCount(0)
    await restart.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
    await expect(page.getByText('새 로그인 요청을 만들었습니다.', { exact: false })).toBeVisible()
    expect(evidence.keys).toHaveLength(2)
    await expect(restart).toHaveCount(0)
  })
  for (const saved of ['observed', 'missing', 'other-provider', 'other-owner'] as const) test(`${provider} returned page ${saved}: terminal GET and same observed anonymous locator are required`, async ({ page }) => {
    const evidence = await fixture(page, provider, 'declined')
    await page.evaluate(async ({ origin, provider, saved }) => {
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      const auth = createNativeBrowserAuth(); await auth.start(provider); await auth.readResult(provider)
      const key = 'tesia.native.auth-claim-precondition', value = JSON.parse(sessionStorage.getItem(key)!)
      if (saved === 'missing') sessionStorage.removeItem(key)
      if (saved === 'other-provider') { value.provider = provider === 'GOOGLE' ? 'APPLE' : 'GOOGLE'; sessionStorage.setItem(key, JSON.stringify(value)) }
      if (saved === 'other-owner') { value.sessionId = 'session_other_anonymous01'; sessionStorage.setItem(key, JSON.stringify(value)) }
    }, { origin: TEST_ORIGIN, provider, saved })
    await page.reload()
    expect(evidence.keys).toHaveLength(1)
    const result = await page.evaluate(async ({ origin, provider }) => {
      const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
      const auth = createNativeBrowserAuth(), before = auth.canRestart()
      await auth.readResult(provider)
      try { await auth.restart(provider); return { before, status: 'OK' } } catch (error) { return { before, status: (error as { code: string }).code } }
    }, { origin: TEST_ORIGIN, provider })
    expect(result.before).toBe(false)
    expect(result.status).toBe(saved === 'observed' ? 'OK' : 'AUTH_BINDING_CONFLICT')
    expect(evidence.keys).toHaveLength(saved === 'observed' ? 2 : 1)
  })
}
