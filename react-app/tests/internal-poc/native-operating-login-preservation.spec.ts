import { expect, test, type Page } from '@playwright/test'

// Synthetic same-origin SDK envelopes and an intercepted vendor document only.
// No live provider, credential, cookie, claim, exchange account or order is used.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const owner = 'session_natural_anonymous_001', authenticated = 'session_natural_authenticated_001'
const transactionId = 'oidc_tx_natural_fixture_001', resultId = 'oauth_result_natural_fixture_001'
const etag = '"etag_natural_fixture_001"', resultEtag = '"etag_natural_result_fixture_001"'
const expiresAt = '2030-01-01T00:10:00Z', marker = { provider: 'GOOGLE', transactionId, expiresAt }
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision, requestId: 'req_natural_fixture_001', traceId: 'trace_natural_fixture_001' })
type Options = { entry?: string; marker?: unknown; wrongTransaction?: boolean; wrongHandoff?: boolean; holdResult?: boolean; blockReturnStorage?: boolean; naturalFlow?: boolean; returnOnly?: boolean; authenticatedSession?: boolean; holdSession?: boolean; recoveryBlocked?: string; resultNotFound?: boolean; loseFirstAck?: boolean; loseFirstResult?: boolean }
async function mount(page: Page, baseURL: string | undefined, options: Options = {}) {
  if (!baseURL) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const state = { calls: [] as string[], startKeys: [] as string[], ackKeys: [] as string[], resultReads: 0, starts: 0, acks: 0, auth: options.authenticatedSession ?? false, external: 0, releaseResult: () => {}, releaseSession: () => {} }
  const resultBarrier = options.holdResult ? new Promise<void>(resolve => { state.releaseResult = resolve }) : Promise.resolve()
  const sessionBarrier = options.holdSession ? new Promise<void>(resolve => { state.releaseSession = resolve }) : Promise.resolve()
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:00Z'))
  await page.addInitScript(({ value, blocked }) => {
    localStorage.setItem('tethLang', 'ko')
    if (value !== undefined) {
      sessionStorage.setItem('tesia.native.auth-return', JSON.stringify(value))
      sessionStorage.setItem('tesia.native.auth-claim-precondition', JSON.stringify({ provider: 'GOOGLE', sessionId: 'session_natural_anonymous_001', revision: '1', etag: '"etag_natural_fixture_001"' }))
    }
    const original = Storage.prototype.setItem
    let blocking = blocked
    Storage.prototype.setItem = function (key, value) {
      if (blocking && key === 'tesia.native.auth-return') throw new DOMException('Synthetic storage refusal', 'SecurityError')
      return original.call(this, key, value)
    }
    Object.assign(window, { allowReturnStorage: () => { blocking = false } })
  }, { value: options.marker, blocked: options.blockReturnStorage ?? false })
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.origin !== origin) {
      expect(request.isNavigationRequest()).toBe(true)
      expect(url.origin).toBe('https://accounts.google.com')
      state.external++
      return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic Google consent</h1>' })
    }
    if (!path.startsWith('/api/')) {
      if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' })
      return route.continue()
    }
    state.calls.push(`${request.method()} ${path}`)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: etag }
    let data: unknown, version = '0.1.0', revision: string | null = '1', status = 200
    const session = (auth: boolean) => ({ sessionId: auth ? authenticated : owner, state: auth ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' })
    if (path === '/api/v1/auth/session') { await sessionBarrier; data = session(state.auth) }
    else if (path === '/api/v1/auth/csrf') { data = { csrfToken: 'csrf_natural_fixture_001', expiresAt }; revision = null; delete headers.ETag }
    else if (path === '/api/v2/auth/google/transactions') {
      state.starts++; state.startKeys.push(request.headers()['idempotency-key']); status = 201; version = '0.2.0'; revision = '0'
      expect(request.postData()).toBeNull(); expect(request.headers()['if-match']).toBe(etag)
      data = { transactionId, issuedAt: '2030-01-01T00:00:00Z', expiresAt, authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?state=fixture' }
    } else if (path === '/api/v2/auth/google/results/current') {
      state.resultReads++
      if (options.loseFirstResult && state.resultReads === 1) return route.abort('failed')
      if (options.resultNotFound) return route.fulfill({ status: 404, headers, body: JSON.stringify({ meta: meta('0.2.0', null), error: { code: 'NOT_FOUND', message: 'Synthetic missing provider result' } }) })
      await resultBarrier; version = '0.2.0'; revision = '0'; headers.ETag = resultEtag
      data = { resultId, transactionId: options.wrongTransaction ? 'oidc_tx_foreign_fixture_001' : transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:00:30Z', expiresAt: '2030-01-01T00:01:30Z', transactionExpiresAt: expiresAt, acknowledgementCsrfToken: 'csrf_natural_result_fixture_001' }
    } else if (path === `/api/v2/auth/google/results/${resultId}/acknowledgements`) {
      state.acks++; state.ackKeys.push(request.headers()['idempotency-key'])
      expect(request.headers()['if-match']).toBe(resultEtag); expect(request.headers()['x-csrf-token']).toBe('csrf_natural_result_fixture_001'); expect(request.postData()).toBeNull()
      if (options.loseFirstAck && state.acks === 1) return route.abort('failed')
      state.auth = true; version = '0.2.0'
      data = { resultId, transactionId, session: session(true), handoffReservation: { transactionId, initiatingSessionId: options.wrongHandoff ? 'session_foreign_anonymous_001' : owner, initiatingSessionRevision: '1', authenticatedSessionId: authenticated, state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:00:00Z' } }
    } else throw new Error(`Unexpected synthetic API: ${request.method()} ${path}`)
    return route.fulfill({ status, headers, body: JSON.stringify({ data, meta: meta(version, revision) }) })
  })
  await page.goto(options.entry ?? '/natural-login-fixture')
  await page.evaluate(async ({ naturalFlow, returnOnly, recoveryBlocked }) => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/internal-poc/NativeLoginPanel.tsx'
    const source = await (await fetch(componentPath)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const reactModule = await import(/* @vite-ignore */ reactPath), react = reactModule.default ?? reactModule
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath)
    const { NativeLoginPanel } = await import(/* @vite-ignore */ componentPath)
    const authPath = '/src/internal-poc/native-browser-auth.ts'
    const { createNativeBrowserAuth } = await import(/* @vite-ignore */ authPath)
    const recoveryAuth = createNativeBrowserAuth()
    let current = true
    const counters = { adopted: 0, recovered: 0 }
    const evidence = { rechecks: 0 }
    function Harness() {
      const [hidden, setHidden] = react.useState(false)
      Object.assign(window, { operatingLogin: { hide: () => { current = false; setHidden(true) }, retire: () => { current = false }, counters, evidence } })
      return react.createElement(NativeLoginPanel, { naturalFlow, returnOnly, recoveryBlocked, sourceLayout: true, hidden, isCurrent: () => current, intent: 'signup',
        onRecheckSession: async () => {
          if (!current) return
          evidence.rechecks++
          await recoveryAuth.recoverSession('GOOGLE')
          if (current) counters.recovered++
        },
        onAuthenticated: () => { counters.adopted++ }, onSessionRecovered: () => { counters.recovered++ }, onEmailAuthenticated: () => {}, onClose: () => setHidden(true) })
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(react.StrictMode, null, react.createElement(Harness)))
  }, { naturalFlow: options.naturalFlow ?? true, returnOnly: options.returnOnly ?? false, recoveryBlocked: options.recoveryBlocked })
  const counts = () => page.evaluate(() => (window as unknown as { operatingLogin: { counters: { adopted: number; recovered: number } } }).operatingLogin.counters)
  return { state, counts }
}

test('natural Google initiation redirects once while manual Apple email and signup intent remain', async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL)
  await expect(page.locator('[data-native-auth-intent="signup"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apple로 계속하기', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '이메일로 로그인', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect(page).toHaveURL('https://accounts.google.com/o/oauth2/v2/auth?state=fixture')
  expect(state.starts).toBe(1); expect(state.external).toBe(1); expect(state.acks).toBe(0)
  await page.unrouteAll({ behavior: 'wait' })
  const manual = await mount(page, baseURL, { naturalFlow: false })
  await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Google 인증 페이지로 직접 이동', exact: true })).toBeVisible()
  expect(manual.state.starts).toBe(1); expect(manual.state.external).toBe(0)
})

test('exact tab return under StrictMode performs one result ACK and cookie session round trip', async ({ page, baseURL }) => {
  const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', marker })
  await expect.poll(async () => (await counts()).adopted).toBe(1)
  expect(state.calls).toEqual(['GET /api/v2/auth/google/results/current', `POST /api/v2/auth/google/results/${resultId}/acknowledgements`, 'GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
  expect(state.starts).toBe(0); expect(state.acks).toBe(1)
  expect((await counts()).recovered).toBe(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.auth-return'))).toBeNull()
  await expect(page).toHaveURL(`${baseURL}/`)
})

test('stale missing injected or mismatched tab state cannot ACK or adopt', async ({ page, baseURL }) => {
  for (const options of [
    { marker: undefined }, { marker: { ...marker, expiresAt: '2000-01-01T00:00:00Z' } },
    { marker, entry: '/auth/complete?state=injected' }, { marker, wrongTransaction: true },
  ]) {
    await page.unrouteAll({ behavior: 'wait' })
    await page.goto('about:blank')
    const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', ...options })
    await expect(page.locator('.native-provider-login')).toHaveCount(1)
    if ('wrongTransaction' in options) await expect(page.getByRole('alert')).toContainText('로그인하지 못했습니다')
    else {
      // A completed post-render task flushes StrictMode effects without relying
      // on a fixed sleep as negative evidence.
      await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)))
      expect(state.calls).toEqual([])
    }
    expect(state.acks).toBe(0); expect((await counts()).adopted).toBe(0)
    await page.evaluate(() => sessionStorage.clear())
  }
})

test('retired result cannot automatically ACK and explicit retry keeps the same transaction', async ({ page, baseURL }) => {
  const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', marker, holdResult: true })
  await expect.poll(() => state.calls.length).toBe(1)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  state.releaseResult()
  await expect(page.getByRole('button', { name: '로그인 계속하기', exact: true })).toBeEnabled()
  await expect(page.locator('.native-provider-login')).toHaveAttribute('aria-busy', 'false')
  expect(state.acks).toBe(0); expect((await counts()).adopted).toBe(0)
  await page.getByRole('button', { name: '로그인 계속하기', exact: true }).click()
  await expect.poll(async () => (await counts()).adopted).toBe(1)
  expect(state.acks).toBe(1); expect(state.starts).toBe(0)
})

test('one storage failure blocks navigation and explicit retry replays the original START key', async ({ page, baseURL }) => {
  const { state } = await mount(page, baseURL, { blockReturnStorage: true })
  await page.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('로그인하지 못했습니다')
  expect(state.starts).toBe(1); expect(state.external).toBe(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.auth-return'))).toBeNull()
  await page.evaluate(() => (window as unknown as { allowReturnStorage: () => void }).allowReturnStorage())
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page).toHaveURL('https://accounts.google.com/o/oauth2/v2/auth?state=fixture')
  expect(state.starts).toBe(2); expect(new Set(state.startKeys).size).toBe(1)
  expect(state.external).toBe(1); expect(state.acks).toBe(0)
})

test('known owner handoff conflict is fail closed across retry and seven-language natural copy', async ({ page, baseURL }) => {
  const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', marker, wrongHandoff: true })
  await expect(page.getByRole('alert')).toContainText('로그인하지 못했습니다')
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('로그인하지 못했습니다')
  expect(await counts()).toEqual({ adopted: 0, recovered: 0 })
  expect(state.acks).toBe(1); expect(state.starts).toBe(0)
  expect(state.calls.filter(call => call === 'GET /api/v1/auth/session')).toEqual([])
  const copy = await page.evaluate(async () => {
    const path = '/src/internal-poc/native-auth-ui-copy.ts'
    const { nativeAuthUiCopy } = await import(/* @vite-ignore */ path)
    return ['naturalHome', 'naturalBusy', 'naturalFailure', 'naturalRetry', 'naturalContinue'].map(key => nativeAuthUiCopy[key])
  })
  for (const translations of copy) { expect(translations).toHaveLength(7); expect(translations.every((value: string) => value.length > 0)).toBe(true) }
})

test('delta lost or expired return locator exposes explicit session-only recheck without an impossible retry', async ({ browser, baseURL }) => {
  for (const markerValue of [undefined, { ...marker, expiresAt: '2000-01-01T00:00:00Z' }]) {
    const context = await browser.newContext(), page = await context.newPage()
    try {
      const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', marker: markerValue, returnOnly: true, authenticatedSession: true })
      await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '로그인 계속하기', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0)
      expect(state.calls).toEqual([])
      await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
      await expect.poll(async () => (await counts()).recovered).toBe(1)
      expect(state.calls).toEqual(['GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
      expect((await counts()).adopted).toBe(0); expect(state.acks).toBe(0); expect(state.starts).toBe(0)
    } finally { await context.close() }
  }
})

test('delta retired lost-locator session recheck cannot adopt its eventual response', async ({ page, baseURL }) => {
  const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', returnOnly: true, authenticatedSession: true, holdSession: true })
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect.poll(() => state.calls.length).toBe(1)
  await page.evaluate(() => (window as unknown as { operatingLogin: { hide: () => void } }).operatingLogin.hide())
  state.releaseSession()
  await expect.poll(() => state.calls.length).toBe(2)
  // The SDK's completed fresh read is not authority for a retired host scope.
  await page.evaluate(() => new Promise<void>(resolve => setTimeout(resolve, 0)))
  expect(await counts()).toEqual({ adopted: 0, recovered: 0 })
  expect(state.acks).toBe(0); expect(state.starts).toBe(0)
})

test('review delta valid locator blocked recovery or pre-ACK failure still offers explicit session-only recheck', async ({ browser, baseURL }) => {
  for (const scenario of [{ recoveryBlocked: '미확정 기록 보존' }, { resultNotFound: true }]) {
    const context = await browser.newContext(), page = await context.newPage()
    try {
      const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', marker, returnOnly: true, authenticatedSession: true, ...scenario })
      if ('resultNotFound' in scenario) await expect(page.getByRole('alert')).toContainText('로그인하지 못했습니다')
      const recheck = page.getByRole('button', { name: '세션 다시 확인', exact: true })
      await expect(recheck).toBeEnabled()
      await expect(page.getByRole('button', { name: '로그인 계속하기', exact: true })).toHaveCount(0)
      if ('resultNotFound' in scenario) await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled()
      else await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toHaveCount(0)
      const before = state.calls.slice()
      expect(before).toEqual('resultNotFound' in scenario ? ['GET /api/v2/auth/google/results/current'] : [])
      await recheck.click()
      await expect.poll(async () => (await counts()).recovered).toBe(1)
      expect(state.calls.slice(before.length)).toEqual(['GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
      expect((await counts()).adopted).toBe(0); expect(state.acks).toBe(0); expect(state.starts).toBe(0)
      expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.auth-return')!))).toEqual(marker)
    } finally { await context.close() }
  }
})

test('review delta resumed exact ACK clears return intent after accepted adoption without a new START', async ({ page, baseURL }) => {
  const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', marker, returnOnly: true, loseFirstAck: true })
  await expect(page.getByRole('alert')).toContainText('로그인하지 못했습니다')
  await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect.poll(async () => (await counts()).adopted).toBe(1)
  expect(state.acks).toBe(2); expect(new Set(state.ackKeys).size).toBe(1); expect(state.starts).toBe(0)
  expect((await counts()).recovered).toBe(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.auth-return'))).toBeNull()
})

test('transient delta exact locator result-read failure keeps bound retry and then ACKs once without START', async ({ page, baseURL }) => {
  const { state, counts } = await mount(page, baseURL, { entry: '/auth/complete', marker, returnOnly: true, loseFirstResult: true })
  await expect(page.getByRole('alert')).toContainText('로그인하지 못했습니다')
  await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect.poll(async () => (await counts()).adopted).toBe(1)
  expect(state.resultReads).toBe(2); expect(state.acks).toBe(1); expect(state.starts).toBe(0)
  expect((await counts()).recovered).toBe(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.auth-return'))).toBeNull()
})
