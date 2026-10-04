import { expect, test, type Page } from '@playwright/test'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { TEST_ORIGIN } from '../test-origin'

// Exercise the real service entry, controller, login panel and generated SDK.
// Same-origin synthetic contracts and an HttpOnly fixture cookie are explicit
// test seams; these cases do not claim a live Google account or TLS acceptance.
test.use({ trace: 'off', video: 'off' })
test.setTimeout(30_000)
const anonymous = 'session_anonymous_000001', authenticated = 'session_authenticated_0001'
const ready = conversationFixture.snapshots.ready
const anonymousEtag = '"etag_login_success_anon_007"'
const successNotice = '로그인을 확인했습니다.'
const strategyNotice = '로그인을 확인했습니다. 로그인 전 전략은 아직 연결하거나 승인하지 않았습니다.'
const newConversationId = 'conversation_login_success_new_0002'
const newDraftId = 'draft_login_success_new_0002'
const newReady = { ...ready, conversationId: newConversationId, draftId: newDraftId,
  draftState: { ...ready.draftState, draftId: newDraftId } }
const turnFixture = conversationFixture.documents.find(item => item.name === 'turn')!.value
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const meta = (version: string, revision: string | null = '0') => ({ apiContractVersion: version,
  resourceRevision: revision, requestId: 'req_login_success_fixture_01', traceId: 'trace_login_success_fixture_01' })

type Scenario = { strategy: boolean; savedOwner?: string; precondition?: boolean; cookie?: boolean; newQuestion?: boolean }

async function mount(page: Page, scenario: Scenario) {
  let releaseCreate!: () => void
  const createGate = new Promise<void>(resolve => { releaseCreate = resolve })
  const state = { calls: [] as string[], external: 0, cookieSessionReads: 0, releaseCreate }
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:15Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ anonymous, id, etag, scenario }) => {
    if (scenario.strategy) {
      sessionStorage.setItem('tesia.native.conversation', id)
      sessionStorage.setItem('tesia.native.conversation-session', scenario.savedOwner ?? anonymous)
    }
    if (scenario.precondition !== false) sessionStorage.setItem('tesia.native.auth-claim-precondition',
      JSON.stringify({ provider: 'GOOGLE', sessionId: anonymous, revision: '7', etag }))
  }, { anonymous, id: ready.conversationId, etag: anonymousEtag, scenario })
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(url.origin).toBe(TEST_ORIGIN)
    state.calls.push(`${request.method()} ${path}`)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: anonymousEtag }
    const signedIn = (await request.allHeaders()).cookie?.includes('teth_login_success_fixture=confirmed') ?? false
    let data: unknown, version = '0.2.0', revision: string | null = '0', status = 200
    if (path === '/api/v1/auth/session') {
      version = '0.1.0'; revision = signedIn ? '1' : '7'
      if (signedIn) { state.cookieSessionReads++; headers.ETag = '"etag_login_success_auth_001"' }
      data = { sessionId: signedIn ? authenticated : anonymous, state: signedIn ? 'AUTHENTICATED' : 'ANONYMOUS', revision,
        issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
    } else if (path === '/api/v1/auth/csrf') {
      version = '0.1.0'; revision = null; delete headers.ETag
      data = { csrfToken: 'csrf_login_success_fixture_01', expiresAt: '2030-01-01T12:00:00Z' }
    } else if (path === `/api/v3/conversations/${ready.conversationId}` && request.method() === 'GET') {
      version = '0.3.0'; revision = ready.conversationStateRevision; data = ready
      headers.ETag = '"etag_login_success_conversation_04"'
    } else if (scenario.newQuestion && path === '/api/v3/conversations' && request.method() === 'POST') {
      expect(signedIn).toBe(true); expect(request.postDataJSON()).toEqual({})
      expect(request.headers()['x-csrf-token']).toBe('csrf_login_success_fixture_01')
      expect(request.headers()['idempotency-key']).toBeTruthy()
      await createGate
      status = 201; version = '0.3.0'; revision = newReady.conversationStateRevision; data = newReady
      headers.ETag = '"etag_login_success_new_conversation_04"'
    } else if (scenario.newQuestion && path === `/api/v3/conversations/${newConversationId}/messages` && request.method() === 'POST') {
      expect(signedIn).toBe(true)
      const body = request.postDataJSON()
      expect(body.message).toBe('새 로그인 세션으로 전략 조건을 확인해줘')
      expect(body.expectedConversationStateRevision).toBe(newReady.conversationStateRevision)
      expect(request.headers()['if-match']).toBe('"etag_login_success_new_conversation_04"')
      version = '0.3.0'; revision = newReady.conversationStateRevision
      data = { ...turnFixture, conversation: newReady }
      headers.ETag = '"etag_login_success_new_conversation_04"'
    } else if (scenario.newQuestion && path === `/api/v3/conversations/${newConversationId}` && request.method() === 'GET') {
      expect(signedIn).toBe(true)
      version = '0.3.0'; revision = newReady.conversationStateRevision; data = newReady
      headers.ETag = '"etag_login_success_new_conversation_04"'
    } else if (path === '/api/v2/auth/google/results/current' && request.method() === 'GET') {
      data = { resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001', status: 'READY_FOR_ACK',
        issuedAt: '2030-01-01T00:01:00Z', expiresAt: '2030-01-01T00:02:00Z',
        transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_result_fixture_000001' }
    } else if (path === '/api/v2/auth/google/results/oauth_result_fixture_0001/acknowledgements') {
      expect(request.method()).toBe('POST'); expect(request.postData()).toBeNull()
      expect(request.headers()['x-csrf-token']).toBe('csrf_result_fixture_000001')
      if (scenario.cookie !== false) headers['Set-Cookie'] = 'teth_login_success_fixture=confirmed; HttpOnly; SameSite=Lax; Path=/'
      revision = '1'
      data = { resultId: 'oauth_result_fixture_0001', transactionId: 'oidc_tx_fixture_000001',
        session: { sessionId: authenticated, state: 'AUTHENTICATED', revision: '1',
          issuedAt: '2030-01-01T00:01:10Z', expiresAt: '2030-01-01T12:01:10Z' },
        handoffReservation: { transactionId: 'oidc_tx_fixture_000001', initiatingSessionId: anonymous,
          initiatingSessionRevision: '7', authenticatedSessionId: authenticated, state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:01:10Z' } }
    } else return route.abort('failed')
    return route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
  })
  for (const origin of ['https://accounts.google.com/**', 'https://appleid.apple.com/**']) {
    await page.route(origin, route => { state.external++; return route.abort('failed') })
  }
  await page.route(`${TEST_ORIGIN}/auth/complete`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <body><div id="internal-poc-root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/src/internal-poc/service-main.tsx');</script></body></html>` }))
  await page.goto('/auth/complete')
  await expect(panel(page)).toBeVisible()
  return state
}

async function acknowledge(page: Page, state: Awaited<ReturnType<typeof mount>>) {
  await panel(page).getByRole('button', { name: 'Google 인증 결과 확인', exact: true }).click()
  const confirm = panel(page).getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })
  await expect(confirm).toBeVisible()
  expect(state.calls.filter(call => call.endsWith('/acknowledgements'))).toEqual([])
  await confirm.click()
  await expect.poll(() => state.calls.filter(call => call.endsWith('/acknowledgements')).length).toBe(1)
}

function expectNoBusinessMutation(state: Awaited<ReturnType<typeof mount>>) {
  expect(state.calls.filter(call => /\/claim|\/approv|\/orders|exchange-connections/.test(call))).toEqual([])
  expect(state.calls.filter(call => call.startsWith('POST ') && !call.endsWith('/acknowledgements'))).toEqual([])
  expect(state.external).toBe(0)
}

async function expectHealthySuccess(page: Page, notice: string) {
  await expect(page.getByRole('status').filter({ hasText: notice })).toHaveText(notice)
  await expect(panel(page)).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '요청 상태 확인', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /세션 다시 확인/ })).toHaveCount(0)
}

test('이전 전략 없이 precondition만 있는 Google ACK 성공은 정상 안내만 표시하고 빈 전략 연결을 제안하지 않는다', async ({ page }) => {
  const state = await mount(page, { strategy: false })
  await acknowledge(page, state)
  await expectHealthySuccess(page, successNotice)
  await expect(page.getByRole('region', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
  expect(state.cookieSessionReads).toBeGreaterThan(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBeNull()
  expectNoBusinessMutation(state)
})

test('같은 owner의 이전 전략은 정상 로그인 안내와 별도 명시 연결 선택만 제공하며 자동 연결하지 않는다', async ({ page }) => {
  const state = await mount(page, { strategy: true })
  await acknowledge(page, state)
  await expectHealthySuccess(page, strategyNotice)
  await expect(page.getByRole('region', { name: '로그인 전 전략 연결', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toBeEnabled()
  expect(state.cookieSessionReads).toBeGreaterThan(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(ready.conversationId)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.auth-claim-precondition'))).toContain(anonymous)
  expectNoBusinessMutation(state)
})

test('다른 owner의 저장 전략 locator는 실제 Google ACK 성공 후에도 연결 제안으로 승격하지 않는다', async ({ page }) => {
  const state = await mount(page, { strategy: true, savedOwner: 'session_unrelated_000001' })
  await acknowledge(page, state)
  await expectHealthySuccess(page, successNotice)
  await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
  expect(state.calls.filter(call => call.includes('/api/v3/'))).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation-session'))).toBe('session_unrelated_000001')
  expectNoBusinessMutation(state)
})

test('이전 전략의 anonymous precondition이 없으면 인증 성공과 별개로 전략 연결은 fail closed다', async ({ page }) => {
  const state = await mount(page, { strategy: true, precondition: false })
  await acknowledge(page, state)
  await expect.poll(() => state.cookieSessionReads).toBeGreaterThan(0)
  await expectHealthySuccess(page, '현재 인증 세션은 확인했지만 로그인 전 세션의 사전조건을 복구하지 못해 전략 연결을 차단했습니다. 인증 세션 ETag로 대체하지 않습니다.')
  await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: strategyNotice })).toHaveCount(0)
  expectNoBusinessMutation(state)
})

test('ACK body만 있고 authenticated cookie session이 없으면 정상 안내 대신 인증 실패 복구를 유지한다', async ({ page }) => {
  const state = await mount(page, { strategy: true, cookie: false })
  await acknowledge(page, state)
  await expect(panel(page).getByRole('alert')).toBeVisible()
  await expect(panel(page)).toBeVisible()
  await expect(panel(page).getByRole('button', { name: '로그인 세션만 다시 확인', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: successNotice })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
  expect(state.cookieSessionReads).toBe(0)
  expectNoBusinessMutation(state)
})

for (const strategy of [false, true]) test(`이전 전략 ${strategy ? '있음: 연결을 건너뛰고' : '없음:'} ACK 뒤 명시 새 질문을 보내면 로그인 안내와 이전 연결 제안을 종료한다`, async ({ page }) => {
  const state = await mount(page, { strategy, newQuestion: true })
  await acknowledge(page, state)
  await expectHealthySuccess(page, strategy ? strategyNotice : successNotice)
  if (strategy) await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toBeVisible()
  // An unclaimed prior strategy keeps the ordinary conversation composer;
  // without a prior strategy the same explicit action uses the home composer.
  const composer = page.locator('textarea:visible').first()
  await expect(composer).toBeEnabled()
  await composer.fill('새 로그인 세션으로 전략 조건을 확인해줘')
  await composer.press('Enter')
  try {
    await expect.poll(() => state.calls.filter(call => call === 'POST /api/v3/conversations').length).toBe(1)
    // A successfully journaled user command ends the transient sign-in notice
    // even while its CREATE response is outstanding.
    await expect(page.locator('[data-native-auth-notice]')).toHaveCount(0)
    state.releaseCreate()
    await expect.poll(() => state.calls.filter(call => call === `POST /api/v3/conversations/${newConversationId}/messages`).length).toBe(1)
    await expect(page.locator('.g-composer textarea')).toBeEnabled()
    await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
    await expect(page.getByRole('region', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('[data-native-auth-notice]')).toHaveCount(0)
    const recheck = page.getByRole('button', { name: '세션 다시 확인', exact: true })
    await expect(recheck).toHaveCount(0)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(newConversationId)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation-session'))).toBe(authenticated)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
    // The new document must have an accessible research surface; the stale
    // login offer must not retain its presentation blocking state.
    await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
    await expect(page.locator('.native-research-plan')).toBeVisible()
    await expect(page.locator('.native-research-plan')).toContainText('BTCUSDT')
    expect(state.calls.filter(call => /\/claim|\/approv|\/orders|exchange-connections/.test(call))).toEqual([])
    expect(state.calls.filter(call => call.startsWith('POST '))).toEqual([
      'POST /api/v2/auth/google/results/oauth_result_fixture_0001/acknowledgements',
      'POST /api/v3/conversations', `POST /api/v3/conversations/${newConversationId}/messages`,
    ])
    expect(state.external).toBe(0)
  } finally { state.releaseCreate() }
})
