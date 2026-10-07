import { expect, test, type Page } from '@playwright/test'

// Mounted Native host/controller/generated SDK. API envelopes and storage
// faults are synthetic loopback fixtures, never provider/login/release proof.
test.use({ serviceWorkers: 'block', trace: 'off', screenshot: 'off', video: 'off' })
test.setTimeout(45_000)
const bindingKey = 'tesia.native.session-binding'
const preconditionKey = 'tesia.native.auth-claim-precondition'
const journalKey = 'tesia.native.pending-command'
const oldId = 'session_recovery_low_old_0001'
const authId = 'session_recovery_low_auth_0001'
const resultId = 'oauth_result_recovery_low_0001'
const transactionId = 'oidc_tx_recovery_low_0001'
const oldEtag = '"etag_recovery_low_old_007"'
const authEtag = '"etag_recovery_low_auth_001"'
const resultEtag = '"etag_recovery_low_result_000"'
const ackPath = `/api/v2/auth/google/results/${resultId}/acknowledgements`
const oldBinding = JSON.stringify({ sessionId: oldId, sessionState: 'ANONYMOUS' })
const oldPrecondition = JSON.stringify({ provider: 'GOOGLE', sessionId: oldId, revision: '7', etag: oldEtag })
const journal = JSON.stringify({ version: 1, kind: 'CREATE_TURN', sessionId: oldId, sessionState: 'ANONYMOUS',
  idempotencyKey: 'create_recovery_low_fixture_01', turnIdempotencyKey: 'turn_recovery_low_fixture_01',
  clientMessageId: 'message_recovery_low_fixture_01', message: '보존할 미확정 원문' })
const blockedNotice = '미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.'
// Frozen pre-existing approved copy, not imported from the product adapter.
const expectedBlockedNotice = {
  ko: blockedNotice,
  en: 'The unconfirmed strategy request record was preserved. This record is not cleared and is not automatically linked to a new login session.',
  ja: '未確定の戦略リクエスト記録を保持しました。この記録を消去したり、新しいログインセッションに自動的に連携したりはしません。',
  'zh-CN': '已保留未确认的策略请求记录。该记录不会被清除，也不会自动关联到新的登录会话。',
  'zh-TW': '已保留未確認的策略請求紀錄。該紀錄不會被清除，也不會自動連結到新的登入工作階段。',
  es: 'Se conservó el registro de la solicitud de estrategia sin confirmar. Este registro no se borra ni se vincula automáticamente a una nueva sesión de inicio de sesión.',
  fr: "L'enregistrement de la requête de stratégie non confirmée a été conservé. Il n'est ni effacé ni lié automatiquement à une nouvelle session de connexion.",
} as const
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; await import('/src/internal-poc/service-main.tsx');</script></body></html>`
const panel = (page: Page) => page.locator('.native-auth-surface .cs-native-login')
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_recovery_low_fixture_01', traceId: 'trace_recovery_low_fixture_01' })
const authenticated = { sessionId: authId, state: 'AUTHENTICATED', revision: '1',
  issuedAt: '2030-01-01T00:01:10Z', expiresAt: '2030-01-01T12:01:10Z' }
type State = { calls: string[]; blocked: string[]; errors: string[]; ackKeys: string[]; sessionReads: number;
  csrfReads: number; resultReads: number; authenticated: boolean; failSessionRead: number | null;
  mismatchSessionRead: number | null; failNextCsrf: boolean; normal: boolean; startKeys: string[];
  holdNextSession: boolean; held: boolean; blockedDevHmrAttempts: number; release: () => void }
const observations = new WeakMap<Page, State>()

test.afterEach(async ({ page }, info) => {
  const state = observations.get(page)
  if (!state) return
  state.release()
  info.annotations.push({ type: 'SYNTHETIC_AUTH_STORAGE_PANEL', description: JSON.stringify({ ...state,
    release: undefined, providerCalls: 0, apiForwarded: 0, connectedWebSockets: 0, actualLogin: false }) })
  expect(state.blocked).toEqual([])
  expect(state.errors).toEqual([])
  expect(state.calls.some(call => /anonymous-sessions|claim|conversations|backtests|orders/.test(call))).toBe(false)
  expect(state.calls.filter(call => call === 'POST /api/v2/auth/google/transactions')).toHaveLength(state.normal ? 1 : 0)
})

async function mount(page: Page, baseURL: string | undefined, withJournal = false, normal = false) {
  if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1' || new URL(baseURL).port !== '4770') throw Error('OWNED_LOOPBACK_4770_REQUIRED')
  const origin = new URL(baseURL).origin
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const state: State = { calls: [], blocked: [], errors: [], ackKeys: [], sessionReads: 0, csrfReads: 0,
    resultReads: 0, authenticated: false, failSessionRead: null, mismatchSessionRead: null, failNextCsrf: false,
    normal, startKeys: [], holdNextSession: false, held: false,
    blockedDevHmrAttempts: 0, release }
  observations.set(page, state)
  page.on('pageerror', error => state.errors.push(error.message))
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:15Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.context().routeWebSocket('**/*', socket => {
    const url = new URL(socket.url())
    if (url.origin === origin.replace('http:', 'ws:') && url.pathname === '/' && [...url.searchParams.keys()].every(key => key === 'token')) state.blockedDevHmrAttempts++
    else state.blocked.push('NON_HMR_WS')
    socket.close()
  })
  await page.addInitScript(({ bindingKey, preconditionKey, oldBinding, oldPrecondition, journalKey, journal, withJournal }) => {
    localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1')
    sessionStorage.setItem(bindingKey, oldBinding); sessionStorage.setItem(preconditionKey, oldPrecondition)
    if (withJournal) sessionStorage.setItem(journalKey, journal)
  }, { bindingKey, preconditionKey, oldBinding, oldPrecondition, journalKey, journal, withJournal })
  await page.context().route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    if (url.origin !== origin) { state.blocked.push('EXTERNAL'); return route.abort('blockedbyclient') }
    if (path !== '/api' && !path.startsWith('/api/')) {
      if (method !== 'GET') { state.blocked.push('NON_FIXTURE_MUTATION'); return route.abort('blockedbyclient') }
      if (req.isNavigationRequest() && path === (normal ? '/' : '/auth/complete') && !url.search) return route.fulfill({ contentType: 'text/html', body: html })
      return route.continue()
    }
    const allowed = !url.search && req.postData() === null && (method === 'GET'
      && ['/api/v1/auth/session', '/api/v1/auth/csrf', '/api/v2/auth/google/results/current'].includes(path)
      || method === 'POST' && (path === ackPath && !withJournal || path === '/api/v2/auth/google/transactions' && normal))
    if (!allowed) { state.blocked.push(`${method} ${path}`); return route.abort('blockedbyclient') }
    state.calls.push(`${method} ${path}`)
    expect(req.headers().authorization).toBeUndefined()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const respond = (version: string, revision: string | null, data: unknown) => route.fulfill({ headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    if (path === '/api/v1/auth/session') {
      state.sessionReads++
      if (state.sessionReads === state.failSessionRead) return route.fulfill({ status: 500, headers, body: JSON.stringify({ meta: meta('0.1.0', null),
        error: { code: 'INTERNAL_ERROR', message: 'Synthetic follow-up session read failure.' } }) })
      if (!state.authenticated && normal) {
        headers.ETag = oldEtag
        return respond('0.1.0', '7', { ...authenticated, sessionId: oldId, state: 'ANONYMOUS', revision: '7' })
      }
      if (!state.authenticated) return route.fulfill({ status: 401, headers, body: JSON.stringify({ meta: meta('0.1.0', null),
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic absent session.' } }) })
      if (state.holdNextSession) { state.holdNextSession = false; state.held = true; await gate }
      headers.ETag = authEtag; return respond('0.1.0', state.sessionReads === state.mismatchSessionRead ? '2' : '1', authenticated)
    }
    if (path === '/api/v1/auth/csrf') {
      expect(state.authenticated || normal).toBe(true); state.csrfReads++
      if (state.failNextCsrf) {
        state.failNextCsrf = false
        return route.fulfill({ status: 500, headers, body: JSON.stringify({ meta: meta('0.1.0', null),
          error: { code: 'INTERNAL_ERROR', message: 'Synthetic follow-up CSRF read failure.' } }) })
      }
      return respond('0.1.0', null, { csrfToken: 'csrf_recovery_low_session_fixture_01', expiresAt: authenticated.expiresAt })
    }
    if (path === '/api/v2/auth/google/transactions') {
      expect(state.startKeys).toEqual([])
      expect(req.headers()['x-csrf-token']).toBe('csrf_recovery_low_session_fixture_01')
      expect(req.headers()['if-match']).toBe(oldEtag)
      const key = req.headers()['idempotency-key']; expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/)
      state.startKeys.push(key)
      return route.fulfill({ status: 201, headers, body: JSON.stringify({ meta: meta('0.2.0', '0'), data: {
        transactionId, issuedAt: '2030-01-01T00:01:00Z', expiresAt: '2030-01-01T00:10:00Z',
        authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque' } }) })
    }
    if (path.endsWith('/results/current')) {
      state.resultReads++; headers.ETag = resultEtag
      return respond('0.2.0', '0', { resultId, transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:01:00Z',
        expiresAt: '2030-01-01T00:02:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_recovery_low_result_fixture_01' })
    }
    expect(req.headers()['x-csrf-token']).toBe('csrf_recovery_low_result_fixture_01')
    expect(req.headers()['if-match']).toBe(resultEtag)
    const key = req.headers()['idempotency-key']; expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/)
    state.ackKeys.push(key); state.authenticated = true; headers.ETag = authEtag
    return respond('0.2.0', '1', { resultId, transactionId, session: authenticated, handoffReservation: {
      transactionId, initiatingSessionId: oldId, initiatingSessionRevision: '7', authenticatedSessionId: authId,
      state: 'RESERVED_FOR_CLAIM', expiresAt: authenticated.expiresAt } })
  })
  await page.goto(`${origin}${normal ? '/' : '/auth/complete'}`)
  if (normal) await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  else {
    await expect(panel(page)).toBeVisible()
    expect(state.calls).toEqual(['GET /api/v1/auth/session'])
  }
  return state
}

async function expectOldStorage(page: Page, expectedJournal: string | null = null) {
  expect(await page.evaluate(({ bindingKey, preconditionKey, journalKey }) => ({ binding: sessionStorage.getItem(bindingKey),
    precondition: sessionStorage.getItem(preconditionKey), journal: sessionStorage.getItem(journalKey) }),
  { bindingKey, preconditionKey, journalKey })).toEqual({ binding: oldBinding, precondition: oldPrecondition, journal: expectedJournal })
}

for (const fault of ['setItem throws', 'readback mismatch'] as const) {
  test(`return ACK storage ${fault} keeps the controller and permits explicit same-request recovery`, async ({ page, baseURL }, info) => {
    const state = await mount(page, baseURL)
    await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
    const confirm = panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })
    await expect(confirm).toBeEnabled()
    const originalPanel = await panel(page).elementHandle()
    await page.evaluate(({ bindingKey, authId, fault }) => {
      const original = Storage.prototype.setItem
      let armed = true
      const injected = { attempts: 0 }
      Object.assign(window, { __nativeAuthStorageFault: injected })
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === bindingKey && value.includes(authId) && armed) {
          armed = false; injected.attempts++
          if (fault === 'setItem throws') throw new DOMException('Synthetic storage write failure.', 'QuotaExceededError')
          return // Deliberately preserve old bytes so the real readback guard rejects.
        }
        return original.call(this, key, value)
      }
    }, { bindingKey, authId, fault })
    await confirm.click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __nativeAuthStorageFault: { attempts: number } }).__nativeAuthStorageFault.attempts),
      { message: 'Await the targeted storage write, not the return page initial error phase.' }).toBe(1)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
    expect(await page.evaluate(() => (window as unknown as { __nativeAuthStorageFault: { attempts: number } }).__nativeAuthStorageFault.attempts)).toBe(1)
    await expectOldStorage(page)
    await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
    expect(state.ackKeys).toHaveLength(1)
    const firstKey = state.ackKeys[0], callsAfterFailure = [...state.calls]
    expect(await originalPanel!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
    await expect(panel(page)).toBeVisible(); await expect(confirm).toBeEnabled()
    expect(state.calls).toEqual(callsAfterFailure)
    state.holdNextSession = true
    await confirm.click()
    try {
      await expect.poll(() => state.held, { timeout: 3_000, message: 'Explicit retry must reach session validation instead of an epoch dead-end.' }).toBe(true)
      await expect(confirm).toBeDisabled(); await expect(panel(page)).toHaveAttribute('aria-busy', 'true')
      await expectOldStorage(page)
      expect(state.csrfReads).toBe(1)
      expect(state.ackKeys).toEqual([firstKey]); expect(state.resultReads).toBe(1)
      expect(await originalPanel!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
    } finally { state.release() }
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveText('로그인을 확인했습니다.')
    expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), bindingKey))!)).toEqual({ sessionId: authId, sessionState: 'AUTHENTICATED' })
    expect(state.ackKeys).toEqual([firstKey]); expect(state.resultReads).toBe(1); expect(state.csrfReads).toBe(2)
    expect(state.calls.filter(call => call.startsWith('POST '))).toEqual([`POST ${ackPath}`])
    info.annotations.push({ type: 'ONE_SHOT_STORAGE_FAILURE_RECOVERY', description: JSON.stringify({ fault, keyCount: state.ackKeys.length, sameController: true }) })
  })
}

for (const failure of ['second GET 500', 'second GET revision mismatch', 'CSRF 500'] as const) {
test(`return recheck ${failure} retains visible recovery and focus before an explicit retry`, async ({ page, baseURL }) => {
  const state = await mount(page, baseURL)
  const originalPanel = await panel(page).elementHandle()
  const recheck = panel(page).getByRole('button', { name: '세션 다시 확인', exact: true })
  state.authenticated = true
  if (failure === 'second GET 500') state.failSessionRead = 3
  else if (failure === 'second GET revision mismatch') state.mismatchSessionRead = 3
  else state.failNextCsrf = true
  await recheck.click()
  await expect.poll(() => state.sessionReads).toBe(3)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expectOldStorage(page)
  expect(state.csrfReads).toBe(failure === 'CSRF 500' ? 1 : 0); expect(state.ackKeys).toEqual([])
  expect(await originalPanel!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
  await expect(panel(page)).toBeVisible()
  await expect(panel(page)).toHaveAttribute('aria-busy', 'false')
  expect(await panel(page).evaluate(element => element.contains(document.activeElement))).toBe(true)
  await expect(recheck).toBeEnabled()
  const callsBeforeRetry = ['GET /api/v1/auth/session', 'GET /api/v1/auth/session', 'GET /api/v1/auth/session',
    ...(failure === 'CSRF 500' ? ['GET /api/v1/auth/csrf'] : [])]
  expect(state.calls).toEqual(callsBeforeRetry)
  await recheck.click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), bindingKey))!)).toEqual({ sessionId: authId, sessionState: 'AUTHENTICATED' })
  expect(state.sessionReads).toBe(5); expect(state.csrfReads).toBe(failure === 'CSRF 500' ? 2 : 1); expect(state.ackKeys).toEqual([])
  expect(state.calls).toEqual([...callsBeforeRetry, 'GET /api/v1/auth/session', 'GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
})
}

for (const fault of ['setItem throws', 'readback mismatch'] as const) {
  test(`normal login storage ${fault} never shows confirmed status and explicitly retries with the unsent input intact`, async ({ page, baseURL }) => {
    const state = await mount(page, baseURL, false, true)
    const draft = '전송하지 않은 투자 질문 BTC 손절 조건도 함께 검토해줘'
    const composer = page.locator('.client-home-content textarea')
    await composer.fill(draft)
    await page.getByRole('button', { name: '로그인', exact: true }).first().click()
    await expect(panel(page)).toBeVisible()
    await panel(page).getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
    await panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
    const confirm = panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })
    await expect(confirm).toBeEnabled()
    const originalPanel = await panel(page).elementHandle()
    await page.evaluate(({ bindingKey, authId, fault }) => {
      const original = Storage.prototype.setItem
      let armed = true
      const injected = { attempts: 0 }
      Object.assign(window, { __nativeAuthStorageFault: injected })
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === bindingKey && value.includes(authId) && armed) {
          armed = false; injected.attempts++
          if (fault === 'setItem throws') throw new DOMException('Synthetic storage write failure.', 'QuotaExceededError')
          return
        }
        return original.call(this, key, value)
      }
    }, { bindingKey, authId, fault })
    await confirm.click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __nativeAuthStorageFault: { attempts: number } }).__nativeAuthStorageFault.attempts)).toBe(1)
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
    expect(await page.evaluate(() => (window as unknown as { __nativeAuthStorageFault: { attempts: number } }).__nativeAuthStorageFault.attempts)).toBe(1)
    await expectOldStorage(page)
    await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: '브라우저 세션의 로그인을 확인했습니다.' })).toHaveCount(0)
    await expect(panel(page)).toBeVisible(); await expect(confirm).toBeEnabled()
    expect(await originalPanel!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
    const firstKey = state.ackKeys[0]
    expect(state.ackKeys).toHaveLength(1); expect(state.startKeys).toHaveLength(1)
    if (fault === 'readback mismatch') {
      const callsBeforeClose = [...state.calls]
      await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
      await expect(panel(page)).toBeHidden()
      if (await page.getByRole('button', { name: '로그인', exact: true }).count() === 0) {
        await page.getByRole('button', { name: '메뉴', exact: true }).click()
      }
      await page.getByRole('button', { name: '로그인', exact: true }).first().click()
      await expect(panel(page)).toBeVisible()
      expect(state.calls).toEqual(callsBeforeClose)
      expect(await originalPanel!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
      await panel(page).getByRole('button', { name: '같은 로그인 확정 요청으로 세션 재확인', exact: true }).click()
    } else await confirm.click()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.getByRole('status').filter({ hasText: '로그인을 확인했습니다.' })).toHaveText('로그인을 확인했습니다.')
    await expect(composer).toHaveValue(draft)
    expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), bindingKey))!)).toEqual({ sessionId: authId, sessionState: 'AUTHENTICATED' })
    expect(state.ackKeys).toEqual([firstKey]); expect(state.startKeys).toHaveLength(1); expect(state.resultReads).toBe(1)
    expect(state.calls.filter(call => call.startsWith('POST '))).toEqual(['POST /api/v2/auth/google/transactions', `POST ${ackPath}`])
    expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBeNull()
  })
}

test('pending recoveryBlocked alert uses the existing seven-language display copy without changing journal or blocked authority', async ({ page, baseURL }, info) => {
  const state = await mount(page, baseURL, true)
  const originalPanel = await panel(page).elementHandle()
  const observations = []
  for (const [locale, expected] of Object.entries(expectedBlockedNotice)) {
    await page.evaluate(async locale => { const path = '/src/client-preferences.ts'; const preferences = await import(path); preferences.setClientPreference('language', locale) }, locale)
    await expect.soft(panel(page).getByRole('alert'), locale).toHaveText(expected, { timeout: 1_000 })
    await expect(panel(page).getByRole('alert')).toBeVisible()
    await expect(page.locator('.client-service-issue p').first()).toHaveText(expected)
    const recoveryButtons = panel(page).locator('.native-auth-recovery button')
    await expect(recoveryButtons).toHaveCount(4)
    for (const button of await recoveryButtons.all()) await expect(button).toBeDisabled()
    await expect(panel(page).getByRole('button').last()).toBeEnabled()
    await expectOldStorage(page, journal)
    expect(state.calls).toEqual(['GET /api/v1/auth/session'])
    expect(await originalPanel!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
    observations.push({ locale, displayed: await panel(page).getByRole('alert').innerText(), expected })
  }
  info.annotations.push({ type: 'PENDING_FIXED_COPY_SEVEN_LOCALES', description: JSON.stringify(observations) })
})
