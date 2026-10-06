import { expect, test, type Page } from '@playwright/test'

// Real Native host + generated SDK, declared synthetic GET/ACK envelopes only.
// No actual provider, cookie authentication, claim, bootstrap or service GO.
test.use({ serviceWorkers: 'block', trace: 'off', video: 'off', screenshot: 'off' })
const bindingKey = 'tesia.native.session-binding'
const journalKey = 'tesia.native.pending-command'
const sessionId = 'session_revision_fixture_0001'
const authId = 'session_return_auth_fixture_01'
const resultId = 'oauth_result_fixture_0001'
const transactionId = 'oidc_tx_fixture_000001'
const meta = (version = '0.1.0', revision: string | null = null) => ({ apiContractVersion: version,
  requestId: 'req_recovery_fixture_0001', traceId: 'trace_recovery_fixture_01', resourceRevision: revision })
const data = (id: string, state: 'ANONYMOUS' | 'AUTHENTICATED') => ({ sessionId: id, state, revision: '1',
  issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' })
const journal = JSON.stringify({ version: 1, kind: 'CREATE_TURN', sessionId, sessionState: 'ANONYMOUS',
  idempotencyKey: 'create_recovery_fixture_01', turnIdempotencyKey: 'turn_recovery_fixture_01',
  clientMessageId: 'message_recovery_fixture_01', message: '보존할 미확정 원문' })
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; await import('/src/internal-poc/service-main.tsx');</script></body></html>`
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
type Observation = { calls: string[]; blocked: string[]; errors: string[]; mode: 'absent' | 'same' | 'foreign' | 'ack'; ackKeys: string[] }
const observations = new WeakMap<Page, Observation>()
test.afterEach(async ({ page }, info) => {
  const state = observations.get(page)
  if (!state) return
  info.annotations.push({ type: 'SYNTHETIC_RETURN_RECOVERY', description: JSON.stringify(state) })
  expect(state.blocked).toEqual([])
  expect(state.errors).toEqual([])
})
async function mount(page: Page, baseURL: string | undefined, withJournal = false, mode: Observation['mode'] = 'absent') {
  if (!baseURL || !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const state: Observation = { calls: [], blocked: [], errors: [], mode, ackKeys: [] }
  observations.set(page, state)
  page.on('pageerror', error => state.errors.push(error.message))
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ withJournal, journal, journalKey }) => {
    localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1')
    if (withJournal) sessionStorage.setItem(journalKey, journal)
  }, { withJournal, journal, journalKey })
  await page.context().route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    if (url.origin !== origin) { state.blocked.push('EXTERNAL'); return route.abort('blockedbyclient') }
    if (!path.startsWith('/api/')) {
      if (method !== 'GET') { state.blocked.push('UNDECLARED_MUTATION'); return route.abort('blockedbyclient') }
      if (req.isNavigationRequest() && ['/', '/auth/complete'].includes(path)) return route.fulfill({ contentType: 'text/html', body: html })
      return route.continue()
    }
    const ackPath = `/api/v2/auth/google/results/${resultId}/acknowledgements`
    const allowed = !url.search && req.postData() === null && ((method === 'GET' && ['/api/v1/auth/session', '/api/v1/auth/csrf', '/api/v2/auth/google/results/current'].includes(path))
      || (method === 'POST' && path === ackPath && !withJournal))
    if (!allowed) { state.blocked.push(`${method} ${path}`); return route.abort('blockedbyclient') }
    state.calls.push(`${method} ${path}`)
    expect(req.headers().authorization).toBeUndefined()
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (path === '/api/v1/auth/session') {
      if (state.mode === 'absent') return route.fulfill({ status: 401, headers, body: JSON.stringify({ meta: meta(), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session absence.' } }) })
      const owner = state.mode === 'same' ? data(sessionId, 'ANONYMOUS') : data(authId, 'AUTHENTICATED')
      return route.fulfill({ headers: { ...headers, ETag: '"etag_recovery_fixture_01"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: owner }) })
    }
    if (path === '/api/v1/auth/csrf') return route.fulfill({ headers, body: JSON.stringify({ meta: meta(), data: { csrfToken: 'csrf_recovery_fixture_01', expiresAt: '2030-01-01T12:00:00Z' } }) })
    if (path.endsWith('/results/current')) return route.fulfill({ headers: { ...headers, ETag: '"etag_result_recovery_01"' }, body: JSON.stringify({ meta: meta('0.2.0', '0'), data: {
      resultId, transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:01:00Z',
      transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_result_recovery_01' } }) })
    expect(req.headers()['x-csrf-token']).toBe('csrf_result_recovery_01')
    expect(req.headers()['if-match']).toBe('"etag_result_recovery_01"')
    state.ackKeys.push(req.headers()['idempotency-key']); state.mode = 'ack'
    return route.fulfill({ headers: { ...headers, ETag: '"etag_recovery_fixture_01"' }, body: JSON.stringify({ meta: meta('0.2.0', '1'), data: {
      resultId, transactionId, session: data(authId, 'AUTHENTICATED'), handoffReservation: { transactionId, initiatingSessionId: sessionId,
        initiatingSessionRevision: '1', authenticatedSessionId: authId, state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:00:00Z' } } }) })
  })
  await page.goto(`${origin}/auth/complete`)
  return state
}

test('pending return visibly blocks result and ACK, but exact original session GET restores same-key recovery', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, true)
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true })).toBeDisabled()
  await expect(panel(page).getByRole('alert').filter({ hasText: '미확정 전략 요청 기록을 보존했습니다.' })).toBeVisible()
  expect(state.calls).toEqual(['GET /api/v1/auth/session'])
  state.mode = 'same'
  await panel(page).getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBe(journal)
  expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), bindingKey))!)).toEqual({ sessionId, sessionState: 'ANONYMOUS' })
  expect(state.calls).toEqual(['GET /api/v1/auth/session', 'GET /api/v1/auth/session', 'GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
})

test('foreign return preserves pending journal across same-document departure and recovers only the exact original owner', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL, true, 'foreign')
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true })).toBeDisabled()
  expect(await page.evaluate(key => sessionStorage.getItem(key), bindingKey)).toBeNull()
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await page.evaluate(() => { history.pushState(null, '', '/'); window.dispatchEvent(new Event('teth:navigate')) })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBe(journal)
  expect(await page.evaluate(key => sessionStorage.getItem(key), bindingKey)).toBeNull()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '로그인 반환 화면으로 돌아가기', exact: true }).click()
  await expect(panel(page)).toBeVisible()
  state.mode = 'same'
  await panel(page).getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBe(journal)
  expect(state.calls.every(call => call.startsWith('GET '))).toBe(true)
})

test('return path departure login CTA exposes explicit fixed-return recovery without starting authentication', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL)
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await page.evaluate(() => { history.pushState(null, '', '/auth/complete#/trade'); window.dispatchEvent(new Event('teth:navigate')) })
  const cta = page.getByRole('region', { name: 'AI가 스스로 판단해 거래합니다', exact: true }).getByRole('button', { name: '시작하기', exact: true })
  await cta.click()
  await expect(page.getByRole('button', { name: '로그인 반환 화면으로 돌아가기', exact: true })).toBeVisible()
  expect(state.calls).toEqual(['GET /api/v1/auth/session'])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '로그인', exact: true })).toBeHidden()
  await expect(cta).toBeFocused()
  await cta.click()
  await page.getByRole('button', { name: '로그인 반환 화면으로 돌아가기', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/complete$/)
  await expect(panel(page)).toBeVisible()
  const returnedFocus = await page.evaluate(() => ({ tag: document.activeElement?.tagName,
    inPanel: Boolean(document.activeElement?.closest('.cs-native-login')), text: document.activeElement?.textContent }))
  test.info().annotations.push({ type: 'FIXED_RETURN_FOCUS', description: JSON.stringify(returnedFocus) })
  await expect(panel(page).getByRole('button', { name: '닫기', exact: true })).toBeFocused()
  expect(state.calls).toEqual(['GET /api/v1/auth/session'])
})

test('synthetic result and ACK are actually accepted by mounted Native host, with no implicit claim', async ({ page, baseURL }) => {
  const state = await mount(page, baseURL)
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible()
  const retainedPanel = await panel(page).elementHandle()
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await page.evaluate(() => { history.pushState(null, '', '/auth/complete#/trade'); window.dispatchEvent(new Event('teth:navigate')) })
  await page.getByRole('region', { name: 'AI가 스스로 판단해 거래합니다', exact: true }).getByRole('button', { name: '시작하기', exact: true }).click()
  await page.getByRole('button', { name: '로그인 반환 화면으로 돌아가기', exact: true }).click()
  await expect(panel(page)).toBeVisible()
  expect(await retainedPanel!.evaluate(element => element === document.querySelector('.native-auth-surface .cs-native-login'))).toBe(true)
  await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible()
  expect(state.calls).toEqual(['GET /api/v1/auth/session', 'GET /api/v2/auth/google/results/current'])
  let releaseSessionRead!: () => void
  const sessionGate = new Promise<void>(resolve => { releaseSessionRead = resolve })
  await page.route('**/api/v1/auth/session', async route => {
    await sessionGate
    await route.fallback()
  })
  const sessionRead = page.waitForRequest(request => request.url().endsWith('/api/v1/auth/session') && request.method() === 'GET')
  await panel(page).getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await sessionRead
  try {
    await expect(panel(page).getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true })).toBeDisabled()
    await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeDisabled()
    await expect(panel(page).getByRole('button', { name: '로그인 세션만 다시 확인', exact: true })).toBeDisabled()
    expect(state.ackKeys).toEqual([])
  } finally { releaseSessionRead() }
  await expect(panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeEnabled()
  await panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  expect(JSON.parse((await page.evaluate(key => sessionStorage.getItem(key), bindingKey))!)).toEqual({ sessionId: authId, sessionState: 'AUTHENTICATED' })
  await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toHaveCount(0)
  expect(state.ackKeys).toHaveLength(1)
  expect(state.ackKeys[0]).toBeTruthy()
  expect(state.calls.filter(call => call.startsWith('POST '))).toEqual([`POST /api/v2/auth/google/results/${resultId}/acknowledgements`])
  expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBeNull()
})
