import { expect, test } from '@playwright/test'
import { ConsultationV13Adapter } from '../../src/internal-poc/consultation-v13-adapter'
import { ConsultationV14Adapter } from '../../src/internal-poc/consultation-v14-adapter'
import { NativeConsultationV13Controller } from '../../src/internal-poc/native-consultation-v13-controller'
import { NativeConsultationSessionV14Controller } from '../../src/internal-poc/native-consultation-session-v14-controller'
import { TEST_ORIGIN } from '../test-origin'

const origin = 'https://service.example.test'
const conversationId = 'conversation_fixture_01', turnId = 'turn_fixture_000001'
const offer = { anonymousSessionId: 'session_anonymous_fixture_01', anonymousIfMatch: '"anonymous_etag_fixture_01"',
  targetSessionId: 'session_authenticated_fixture_01', conversationId }
const timestamp = '2026-10-08T00:00:00Z'
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const usage = { status: 'UNKNOWN', inputTokens: null, outputTokens: null }
const turn = { turnId, conversationId, clientMessageId: 'client_message_fixture_01', userText: '기존 질문', answerText: '실제 저장된 답변',
  state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }
const response = (version: string, data: unknown) => new Response(JSON.stringify({ apiContractVersion: version, data }), { headers })
const storage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}

test('API14 claim and exact refreshed AUTH restore server API13 history without create or cancel', async () => {
  const calls: string[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname
    calls.push(`${init?.method ?? 'GET'} ${path}`)
    if (path.endsWith('/claim')) return response('0.14.0', { anonymousSessionId: offer.anonymousSessionId, sessionId: offer.targetSessionId,
      state: 'AUTHENTICATED', revision: '8', mode: 'CONSULTATION_ONLY', grantScope: 'CONSULTATION_V13', oldSessionRevoked: true,
      claimedLegacyResourceCounts: { conversations: 0, messages: 0, drafts: 0, patches: 0, validations: 0, idempotencyRecords: 0 },
      claimedConsultationResourceCounts: { conversations: 1, turns: 1, events: 2, idempotencyRecords: 1 } })
    if (path.endsWith('/history')) return response('0.13.0', { conversationId, snapshotId: 'snapshot_fixture_0001', offset: 0, limit: 100,
      totalCount: 1, turns: [turn], nextCursor: null })
    if (path.endsWith(`/turns/${turnId}`)) return response('0.13.0', turn)
    throw new Error('unexpected fixture route')
  }
  const conversation = new NativeConsultationV13Controller(new ConsultationV13Adapter({ origin, fetch, csrfToken: () => 'csrf_fixture' }), { storage: storage() })
  conversation.bindOwner(JSON.stringify([offer.targetSessionId, 'AUTHENTICATED']))
  const controller = new NativeConsultationSessionV14Controller(new ConsultationV14Adapter({ origin, fetch, csrfToken: () => 'csrf_fixture' }), {
    storage: storage(), randomId: () => 'fixture_integration_01',
    currentSession: async () => ({ sessionId: offer.targetSessionId, state: 'AUTHENTICATED', revision: '7' }),
    refreshSession: async () => ({ sessionId: offer.targetSessionId, state: 'AUTHENTICATED', revision: '8' }),
    restoreConversation: async id => conversation.restoreConversation(id),
  })
  controller.offer(offer)
  expect(await controller.claim()).toBe(true)
  expect(conversation.getSnapshot()).toMatchObject({ availability: 'available', conversationId, busy: false })
  expect(conversation.getSnapshot().messages.map(message => message.text)).toEqual(['기존 질문', '실제 저장된 답변'])
  expect(calls).toEqual([`POST /api/v14/consultation/anonymous-sessions/${offer.anonymousSessionId}/claim`,
    `GET /api/v13/consultation/conversations/${conversationId}/history`, `GET /api/v13/consultation/turns/${turnId}`])
  conversation.detach(); controller.detach()
  expect(calls).toHaveLength(3)
})

test('a late claimed-history response cannot replace a newly bound conversation owner', async () => {
  let release!: () => void, started!: () => void
  const held = new Promise<void>(resolve => { release = resolve }), entered = new Promise<void>(resolve => { started = resolve })
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf_fixture', fetch: async () => {
    started(); await held
    return response('0.13.0', { conversationId, snapshotId: 'snapshot_fixture_0001', offset: 0, limit: 100, totalCount: 1, turns: [turn], nextCursor: null })
  } })
  const conversation = new NativeConsultationV13Controller(adapter, { storage: storage() })
  conversation.bindOwner(JSON.stringify([offer.targetSessionId, 'AUTHENTICATED']))
  const pending = conversation.restoreConversation(conversationId)
  await entered
  conversation.bindOwner(JSON.stringify(['session_foreign_fixture_01', 'AUTHENTICATED']))
  release()
  expect(await pending).toBe(false)
  expect(conversation.getSnapshot().messages).toEqual([])
  expect(conversation.getSnapshot().conversationId).toBeNull()
})

for (const scenario of ['pending-retain', 'existing-record', 'corrupt-record', 'corrupt-login-hint', 'storedhint-removefailure', 'metadata-conflict'] as const) {
test(`real React login ACK preserves the original flow: ${scenario}`, async ({ page }) => {
  const calls: string[] = [], unexpected: string[] = [], errors: string[] = []
  let signedIn = false, claimed = false, postedTurn = turn
  let authSessionReads = 0, metadataConflict = scenario === 'metadata-conflict'
  let expectedRetryKey: string | null = null
  let claimEntered = false, releaseClaim!: () => void
  const claimGate = new Promise<void>(resolve => { releaseClaim = resolve })
  const anon = offer.anonymousSessionId, target = offer.targetSessionId
  const anonEtag = offer.anonymousIfMatch, authEtag = () => claimed ? '"authenticated_etag_fixture_02"' : '"authenticated_etag_fixture_01"'
  const transactionId = 'oidc_tx_fixture_000001', resultId = 'oauth_result_fixture_0001'
  const csrf = 'csrf_browser_fixture_01', issuedAt = '2030-01-01T00:00:00Z', expiresAt = '2030-01-02T00:00:00Z'
  const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
    requestId: 'req_browser_fixture_01', traceId: 'trace_browser_fixture_01' })
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=await import('/@id/react'),DOM=await import('/@id/react-dom/client'),App=await import('/src/internal-poc/NativeServiceApp.tsx'),Router=await import('/src/components/SiteRouter.tsx');
const h=React.createElement??React.default.createElement,StrictMode=React.StrictMode??React.default.StrictMode;
(DOM.createRoot??DOM.default.createRoot)(document.getElementById('internal-poc-root')).render(h(StrictMode,null,h(Router.SiteRouter,{service:true},h(App.NativeServiceApp,{consultationEnabled:true}))));</script></body></html>`
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1') })
  page.on('pageerror', error => errors.push(error.message))
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (url.origin !== TEST_ORIGIN) { unexpected.push(`${method} ${url.href}`); return route.abort('blockedbyclient') }
    if (!path.startsWith('/api/')) {
      if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: html })
      return route.continue()
    }
    calls.push(`${method} ${path}`)
    const responseHeaders: Record<string, string> = { ...headers, ETag: anonEtag }
    const session = { sessionId: signedIn ? target : anon, state: signedIn ? 'AUTHENTICATED' : 'ANONYMOUS',
      revision: signedIn ? claimed ? '2' : '1' : '7', issuedAt, expiresAt }
    let data: unknown, version = '0.1.0', revision: string | null = session.revision, status = 200
    if (path === '/api/v1/auth/session' && method === 'GET') {
      data = session; responseHeaders.ETag = signedIn ? authEtag() : anonEtag
      if (signedIn) {
        authSessionReads++
        // The first AUTH GET is the existing verified Google ACK round trip;
        // subsequent GETs belong to the consultation claim observation.
        if (metadataConflict && authSessionReads >= 2) revision = '2'
      }
    }
    else if (path === '/api/v1/auth/csrf' && method === 'GET') { data = { csrfToken: csrf, expiresAt }; revision = null; delete responseHeaders.ETag }
    else if (path === '/api/v13/consultation/capabilities' && method === 'GET') {
      return route.fulfill({ headers: responseHeaders, body: JSON.stringify({ apiContractVersion: '0.13.0', data: {
        available: true, reason: null, maxTextChars: 16000, maxPageItems: 100, researchEvents: 'OBSERVATIONS_ONLY', executionAuthority: false } }) })
    } else if (path === '/api/v13/consultation/turns' && method === 'POST') {
      expect(signedIn).toBe(false)
      const body = request.postDataJSON()
      postedTurn = { ...turn, clientMessageId: body.clientMessageId, userText: body.text }
      return route.fulfill({ status: 202, headers: responseHeaders, body: JSON.stringify({ apiContractVersion: '0.13.0', data: postedTurn }) })
    } else if (path === `/api/v13/consultation/conversations/${conversationId}/history` && method === 'GET') {
      expect(signedIn && claimed).toBe(true)
      return route.fulfill({ headers: responseHeaders, body: JSON.stringify({ apiContractVersion: '0.13.0', data: {
        conversationId, snapshotId: 'snapshot_browser_fixture_01', offset: 0, limit: 100, totalCount: 1, turns: [postedTurn], nextCursor: null } }) })
    } else if (path === `/api/v13/consultation/turns/${turnId}` && method === 'GET') {
      return route.fulfill({ headers: responseHeaders, body: JSON.stringify({ apiContractVersion: '0.13.0', data: postedTurn }) })
    } else if (path === '/api/v2/auth/google/transactions' && method === 'POST') {
      version = '0.2.0'; revision = '0'; status = 201
      data = { transactionId, issuedAt, expiresAt: '2030-01-01T00:10:00Z',
        authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=fixture&response_type=code&state=opaque' }
    } else if (path === '/api/v2/auth/google/results/current' && method === 'GET') {
      version = '0.2.0'; revision = '0'
      data = { resultId, transactionId, status: 'READY_FOR_ACK', issuedAt, expiresAt: '2030-01-01T00:01:00Z',
        transactionExpiresAt: '2030-01-01T00:10:00Z', acknowledgementCsrfToken: 'csrf_ack_fixture_01' }
    } else if (path === `/api/v2/auth/google/results/${resultId}/acknowledgements` && method === 'POST') {
      signedIn = true; version = '0.2.0'; revision = '1'
      data = { resultId, transactionId, session: { ...session, sessionId: target, state: 'AUTHENTICATED', revision: '1' },
        handoffReservation: { transactionId, initiatingSessionId: anon, initiatingSessionRevision: '7', authenticatedSessionId: target,
          state: 'RESERVED_FOR_CLAIM', expiresAt } }
    } else if (path === `/api/v14/consultation/anonymous-sessions/${anon}/claim` && method === 'POST') {
      expect(signedIn).toBe(true); expect(claimed).toBe(false)
      expect(request.postDataJSON()).toEqual({ expectedSessionRevision: '1' })
      expect(request.headers()['if-match']).toBe(anonEtag)
      if (expectedRetryKey !== null) expect(request.headers()['idempotency-key']).toBe(expectedRetryKey)
      claimEntered = true
      await claimGate
      claimed = true
      return route.fulfill({ headers: responseHeaders, body: JSON.stringify({ apiContractVersion: '0.14.0', data: {
        anonymousSessionId: anon, sessionId: target, state: 'AUTHENTICATED', revision: '2', mode: 'CONSULTATION_ONLY',
        grantScope: 'CONSULTATION_V13', oldSessionRevoked: true,
        claimedLegacyResourceCounts: { conversations: 0, messages: 0, drafts: 0, patches: 0, validations: 0, idempotencyRecords: 0 },
        claimedConsultationResourceCounts: { conversations: 1, turns: 1, events: 2, idempotencyRecords: 1 } } }) })
    } else { unexpected.push(`${method} ${path}`); return route.abort('blockedbyclient') }
    return route.fulfill({ status, headers: responseHeaders, body: JSON.stringify({ meta: meta(version, revision), data }) })
  })
  await page.goto('/')
  const home = page.locator('#strategy-idea')
  await expect(home).toBeEnabled(); await home.fill('기존 질문'); await home.press('Enter')
  await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('실제 저장된 답변')
  const originalTitle = await page.locator('.g-title').innerText()
  await page.getByRole('button', { name: '로그인', exact: true }).first().click()
  const panel = page.getByRole('region', { name: '실제 계정 로그인', exact: true })
  await expect(panel).toBeVisible()
  await panel.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await panel.getByRole('button', { name: '돌아온 뒤 인증 결과 확인', exact: true }).click()
  await expect(panel.getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true })).toBeVisible({ timeout: 5_000 })
  const claimStorageKey = `tesia.native.consultation-v14.claim:${target}`
  const existingRaw = JSON.stringify({ version: 1, offer: { ...offer, anonymousSessionId: 'session_previous_fixture_01',
    conversationId: 'conversation_previous_01' }, idempotencyKey: 'claim_previous_fixture_01', expectedRevision: '1', committedRevision: null })
  if (scenario !== 'pending-retain' && scenario !== 'metadata-conflict') await page.evaluate(({ scenario, key, raw }) => {
    if (scenario === 'corrupt-login-hint') sessionStorage.setItem('tesia.native.consultation-login-intent', '{bad json')
    else if (scenario === 'storedhint-removefailure') {
      const remove = Storage.prototype.removeItem
      let fail = true
      Storage.prototype.removeItem = function (key) {
        if (this === sessionStorage && key === 'tesia.native.consultation-login-intent' && fail) {
          fail = false; throw new Error('fixture hint remove failure')
        }
        return remove.call(this, key)
      }
    }
    else sessionStorage.setItem(key, scenario === 'existing-record' ? raw : '{bad record')
  }, { scenario, key: claimStorageKey, raw: existingRaw })
  await panel.getByRole('button', { name: '로그인 확정 및 세션 확인', exact: true }).click()
  await expect(panel).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.session-binding')!))).toEqual({ sessionId: target, sessionState: 'AUTHENTICATED' })
  if (scenario === 'storedhint-removefailure' || scenario === 'metadata-conflict') {
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
    expect({ claimed, claimEntered }).toEqual({ claimed: false, claimEntered: false })
    await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('실제 저장된 답변')
    await expect(page.locator('.g-title')).toHaveText(originalTitle)
    await expect(page.locator('.g-composer textarea')).toBeDisabled()
    await expect(page.locator('.g-composer .g-send')).toBeDisabled()
    const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), claimStorageKey)
    expectedRetryKey = saved.idempotencyKey
    expect(saved).toMatchObject({ offer, expectedRevision: null, committedRevision: null, disposition: 'uncertain' })
    expect(calls.filter(call => call.startsWith('POST /api/v14/'))).toEqual([])
    metadataConflict = false; releaseClaim()
    await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
    await expect.poll(() => claimed).toBe(true)
    await expect(page.locator('.g-composer textarea')).toBeEnabled()
    await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('실제 저장된 답변')
    await expect(page.locator('.g-title')).toHaveText(originalTitle)
    expect(await page.evaluate(key => sessionStorage.getItem(key), claimStorageKey)).toBeNull()
  } else if (scenario === 'pending-retain') {
    await expect.poll(() => claimEntered).toBe(true)
    // History is deliberately held back: this is the same in-memory source
    // message, not a restoration response with coincidentally identical text.
    expect(calls.some(call => call.endsWith('/history'))).toBe(false)
    await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('실제 저장된 답변')
    await expect(page.locator('.g-title')).toHaveText(originalTitle)
    await expect(page.locator('.g-composer textarea')).toBeDisabled()
    await expect(page.locator('.g-composer .g-send')).toBeDisabled()
    await page.locator('.g-composer .g-send').evaluate((button: HTMLButtonElement) => button.click())
    expect(calls.filter(call => call.startsWith('POST /api/v13/'))).toEqual(['POST /api/v13/consultation/turns'])
    releaseClaim()
    await expect.poll(() => claimed).toBe(true)
    await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('실제 저장된 답변')
    await expect(page.locator('.g-composer textarea')).toBeEnabled()
    await expect(page.locator('.g-title')).toHaveText(originalTitle)
  } else {
    expect({ claimed, claimEntered }).toEqual({ claimed: false, claimEntered: false })
    expect(calls.some(call => call.endsWith('/history'))).toBe(false)
    if (scenario === 'existing-record') {
      expect(await page.evaluate(key => sessionStorage.getItem(key), claimStorageKey)).toBe(existingRaw)
      await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
      await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('실제 저장된 답변')
      await expect(page.locator('.g-title')).toHaveText(originalTitle)
      await expect(page.locator('.g-composer textarea')).toBeDisabled()
      await expect(page.locator('.g-composer .g-send')).toBeDisabled()
    } else {
      if (scenario === 'corrupt-record') {
        await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('실제 저장된 답변')
        await expect(page.locator('.g-title')).toHaveText(originalTitle)
        await expect(page.locator('.g-composer textarea')).toBeDisabled()
        await expect(page.locator('.g-composer .g-send')).toBeDisabled()
        await page.getByRole('button', { name: '이 로컬 요청 기록만 폐기', exact: true }).click()
        await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), claimStorageKey)).toBeNull()
        await expect(page.locator('#strategy-idea')).toBeEnabled()
      } else {
        await expect(page.locator('#strategy-idea')).toBeEnabled()
        expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.consultation-login-intent'))).toBeNull()
      }
    }
  }
  await expect(page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })).toHaveCount(0)
  expect(calls.filter(call => call.startsWith('POST '))).toEqual(['POST /api/v13/consultation/turns', 'POST /api/v2/auth/google/transactions',
    `POST /api/v2/auth/google/results/${resultId}/acknowledgements`, ...(['pending-retain', 'storedhint-removefailure', 'metadata-conflict'].includes(scenario) ? [`POST /api/v14/consultation/anonymous-sessions/${anon}/claim`] : [])])
  expect({ unexpected, errors }).toEqual({ unexpected: [], errors: [] })
})
}
