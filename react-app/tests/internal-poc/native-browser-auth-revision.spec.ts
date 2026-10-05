import { expect, test, type Page } from '@playwright/test'
import { TEST_ORIGIN } from '../test-origin'
import type { createNativeBrowserAuth } from '../../src/internal-poc/native-browser-auth'

// Generated SDK and real bounded cookie transport, synthetic envelopes only.
// No provider callback, real cookie, account, claim, or host authentication proof.
test.use({ serviceWorkers: 'block', trace: 'off', screenshot: 'off', video: 'off' })
type Provider = 'GOOGLE' | 'APPLE'
type AuthWindow = Window & { revisionAuth: ReturnType<typeof createNativeBrowserAuth> }
const authId = 'session_auth_scope_fixture_0001'
const resultId = 'oauth_result_fixture_0001'
const transactionId = 'oidc_tx_fixture_000001'
const etag = '"etag_auth_scope_fixture_0001"'
const sessionData = { sessionId: authId, state: 'AUTHENTICATED', revision: '1',
  issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' }
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version,
  requestId: 'req_scope_fixture_0001', traceId: 'trace_scope_fixture_01', resourceRevision: revision })

async function fixture(page: Page, provider: Provider, mismatch: boolean, ackLoss = false) {
  const path = provider === 'GOOGLE' ? '/api/v2/auth/google' : '/api/v4/auth/apple'
  const version = provider === 'GOOGLE' ? '0.2.0' : '0.4.0'
  const calls: string[] = [], blocked: string[] = [], ackKeys: string[] = []
  let mismatched = mismatch
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    const api = url.pathname === '/api' || url.pathname.startsWith('/api/')
    const allowedApi = !url.search && !url.hash && request.postData() === null
      && ((method === 'GET' && ['/api/v1/auth/session', '/api/v1/auth/csrf', `${path}/results/current`].includes(url.pathname))
        || (method === 'POST' && url.pathname === `${path}/results/${resultId}/acknowledgements`))
    if (url.origin !== TEST_ORIGIN || (api ? !allowedApi : method !== 'GET')) {
      blocked.push(`${method} ${url.origin === TEST_ORIGIN ? url.pathname : 'EXTERNAL'}`)
      await route.abort(); return
    }
    if (!api) {
      if (url.pathname === '/native-auth-revision-test') {
        await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>' })
      } else await route.continue()
      return
    }
    calls.push(`${method} ${url.pathname}`)
    expect(request.headers().authorization).toBeUndefined()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: etag }
    let data: unknown, responseMeta: unknown
    if (url.pathname === '/api/v1/auth/session') {
      data = sessionData; responseMeta = meta('0.1.0', mismatched ? '2' : '1')
    } else if (url.pathname === '/api/v1/auth/csrf') {
      data = { csrfToken: 'csrf_auth_scope_fixture_01', expiresAt: sessionData.expiresAt }
      responseMeta = meta('0.1.0', null)
      delete headers.ETag
    } else if (url.pathname.endsWith('/results/current')) {
      data = { resultId, transactionId, status: 'READY_FOR_ACK', issuedAt: '2030-01-01T00:00:00Z',
        expiresAt: '2030-01-01T00:01:00Z', transactionExpiresAt: '2030-01-01T00:10:00Z',
        acknowledgementCsrfToken: 'csrf_result_fixture_000001' }
      responseMeta = meta(version, '0')
    } else {
      ackKeys.push(request.headers()['idempotency-key'])
      if (ackLoss && ackKeys.length === 1) { await route.abort(); return }
      data = { resultId, transactionId, session: sessionData, handoffReservation: {
        transactionId, initiatingSessionId: 'session_anonymous_000001', initiatingSessionRevision: '7',
        authenticatedSessionId: authId, state: 'RESERVED_FOR_CLAIM', expiresAt: sessionData.expiresAt } }
      responseMeta = meta(version, '1')
    }
    await route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: responseMeta, data }) })
  })
  await page.goto('/native-auth-revision-test')
  await page.evaluate(async origin => {
    const { createNativeBrowserAuth } = await import(`${origin}/src/internal-poc/native-browser-auth.ts`)
    ;(window as AuthWindow).revisionAuth = createNativeBrowserAuth()
  }, TEST_ORIGIN)
  return { calls, blocked, ackKeys, setMatching: () => { mismatched = false } }
}

async function observe(page: Page, provider: Provider, method: 'recoverSession' | 'acknowledge') {
  return page.evaluate(async ({ provider, method }) => {
    const auth = (window as AuthWindow).revisionAuth
    try {
      const value = await auth[method](provider)
      return { accepted: true, code: null, verification: value.verification,
        expectedSession: value.sessionId === 'session_auth_scope_fixture_0001', csrfPresent: typeof value.csrfToken === 'string',
        canResumeAck: auth.canResumeAcknowledgement(), canResumeResult: auth.canResumeResult() }
    } catch (error) {
      return { accepted: false, code: (error as { code?: string }).code ?? null, verification: null,
        expectedSession: false, csrfPresent: false, canResumeAck: auth.canResumeAcknowledgement(), canResumeResult: auth.canResumeResult() }
    }
  }, { provider, method })
}

for (const provider of ['GOOGLE', 'APPLE'] as const) {
  test(`recoverSession:${provider}:meta1-data1`, async ({ page }) => {
    const state = await fixture(page, provider, false)
    expect(await observe(page, provider, 'recoverSession')).toMatchObject({ accepted: true,
      verification: 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED', expectedSession: true, csrfPresent: true })
    expect(state.calls).toEqual(['GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
    expect(state.blocked).toEqual([])
  })

  test(`recoverSession:${provider}:meta2-data1`, async ({ page }) => {
    const state = await fixture(page, provider, true)
    expect(await observe(page, provider, 'recoverSession')).toMatchObject({ accepted: false, code: 'AUTH_RESPONSE_UNCONFIRMED', csrfPresent: false })
    expect(state.calls).toEqual(['GET /api/v1/auth/session'])
    state.setMatching()
    expect(await observe(page, provider, 'recoverSession')).toMatchObject({ accepted: true,
      verification: 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED', expectedSession: true })
    expect(state.calls).toEqual(['GET /api/v1/auth/session', 'GET /api/v1/auth/session', 'GET /api/v1/auth/csrf'])
    expect(state.blocked).toEqual([])
  })

  test(`acknowledge:${provider}:meta1-data1`, async ({ page }) => {
    const state = await fixture(page, provider, false)
    await page.evaluate(provider => (window as AuthWindow).revisionAuth.readResult(provider), provider)
    expect(state.calls).toEqual([`GET ${provider === 'GOOGLE' ? '/api/v2/auth/google' : '/api/v4/auth/apple'}/results/current`])
    expect(await observe(page, provider, 'acknowledge')).toMatchObject({ accepted: true,
      verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP', expectedSession: true, csrfPresent: true })
    expect(state.ackKeys).toHaveLength(1)
    expect(state.calls.filter(call => call.endsWith('/csrf'))).toHaveLength(1)
    expect(state.blocked).toEqual([])
  })

  for (const ackLoss of [false, true]) test(`acknowledge:${provider}:meta2-data1:${ackLoss ? 'uncertain-ACK' : 'confirmed-ACK'}`, async ({ page }) => {
    const state = await fixture(page, provider, true, ackLoss)
    await page.evaluate(provider => (window as AuthWindow).revisionAuth.readResult(provider), provider)
    if (ackLoss) {
      expect(await observe(page, provider, 'acknowledge')).toMatchObject({ accepted: false, canResumeAck: true, canResumeResult: true })
      expect(state.calls.filter(call => call.endsWith('/session'))).toHaveLength(0)
    }
    expect(await observe(page, provider, 'acknowledge')).toMatchObject({ accepted: false,
      code: 'AUTH_RESPONSE_UNCONFIRMED', canResumeAck: true, canResumeResult: true, csrfPresent: false })
    expect(state.calls.filter(call => call.endsWith('/csrf'))).toHaveLength(0)
    expect(state.ackKeys).toHaveLength(ackLoss ? 2 : 1)
    state.setMatching()
    expect(await observe(page, provider, 'acknowledge')).toMatchObject({ accepted: true,
      verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP', expectedSession: true, csrfPresent: true })
    expect(state.ackKeys).toHaveLength(ackLoss ? 2 : 1)
    expect(new Set(state.ackKeys).size).toBe(1)
    expect(state.ackKeys.every(key => /^[A-Za-z0-9_-]{16,128}$/.test(key))).toBe(true)
    expect(state.calls.filter(call => call.endsWith('/results/current'))).toHaveLength(1)
    expect(state.calls.filter(call => call.endsWith('/session'))).toHaveLength(2)
    expect(state.calls.filter(call => call.endsWith('/csrf'))).toHaveLength(1)
    expect(state.calls.some(call => /transactions|callback|claim/.test(call))).toBe(false)
    expect(state.blocked).toEqual([])
  })
}

for (const mismatch of [false, true]) test(`BRS-existing:${mismatch ? 'meta2-data1' : 'meta1-data1'}`, async ({ page }) => {
  const state = await fixture(page, 'GOOGLE', mismatch)
  const result = await page.evaluate(async origin => {
    const { createBrowserSessionBootstrap } = await import(`${origin}/src/internal-poc/browser-session.ts`)
    try { await createBrowserSessionBootstrap()(); return { accepted: true, error: null } }
    catch (error) { return { accepted: false, error: (error as Error).message } }
  }, TEST_ORIGIN)
  expect(result).toEqual({ accepted: !mismatch, error: mismatch ? 'BROWSER_SESSION_UNCONFIRMED' : null })
  expect(state.calls).toEqual(['GET /api/v1/auth/session'])
  expect(state.blocked).toEqual([])
})
