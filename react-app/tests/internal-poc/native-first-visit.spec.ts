import { expect, test } from '@playwright/test'

// Synthetic HTTP fixtures through the unmodified session SDK and app.
// The separate installed-server journey supplies actual HTTP evidence.
test.use({ trace: 'off', video: 'off' })
const session = { sessionId: 'session_first_visit_fixture_0001', state: 'ANONYMOUS', revision: '1',
  issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
const meta = (revision: string | null) => ({ apiContractVersion: '0.1.0', requestId: 'request_first_visit_fixture', traceId: 'trace_first_visit_fixture', resourceRevision: revision })
const warning = '세션이 변경되어 이전 요청과 승인 표시를 무효화했습니다.'

for (const prior of ['fresh', 'binding', 'conversation', 'owner', 'journal'] as const) {
  test(`최초 세션 발급 ${prior}: 신규 방문 홈과 이전 소유자 무효화 안내를 구별한다`, async ({ page }) => {
    if (prior !== 'fresh') await page.addInitScript(prior => {
      if (prior === 'journal') {
        sessionStorage.setItem('tesia.native.pending-command', JSON.stringify({ version: 1, kind: 'CREATE_TURN',
          sessionId: 'session_prior_fixture_0001', sessionState: 'ANONYMOUS', idempotencyKey: 'first_visit_pending_fixture_0001',
          turnIdempotencyKey: 'first_visit_turn_fixture_0001', clientMessageId: 'client_message_first_visit_0001', message: '이전 미확정 질문' }))
        return
      }
      const keys = { binding: 'tesia.native.session-binding', conversation: 'tesia.native.conversation', owner: 'tesia.native.conversation-session' }
      sessionStorage.setItem(keys[prior], prior === 'binding' ? JSON.stringify({ sessionId: 'session_prior_fixture_0001', sessionState: 'AUTHENTICATED' }) : 'prior_locator_fixture_0001')
    }, prior)
    let issued = false, creates = 0, business = 0
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname
      const headers = { ETag: '"first_visit_session_fixture_0001"' }
      if (path === '/api/v1/anonymous-sessions') {
        creates++; issued = true
        return route.fulfill({ status: 201, contentType: 'application/json', headers, body: JSON.stringify({ meta: meta('1'), data: session }) })
      }
      if (path === '/api/v1/auth/session') return route.fulfill({ status: issued ? 200 : 401, contentType: 'application/json', headers,
        body: JSON.stringify(issued ? { meta: meta('1'), data: session } : { meta: meta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session absent.' } }) })
      if (path === '/api/v1/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta(null), data: { csrfToken: 'csrf_first_visit_fixture_0001', expiresAt: session.expiresAt } }) })
      business++
      return route.abort()
    })
    await page.goto('/internal-poc.html#/native-client')
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    expect(creates).toBe(1)
    expect(business).toBe(0)
    if (prior === 'fresh') {
      await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
      await expect(page.locator('#strategy-idea')).toBeVisible()
      await expect(page.locator('#strategy-idea')).toBeEnabled()
      await expect(page.getByRole('alert')).toHaveCount(0)
      await expect(page.getByText(warning, { exact: false })).toHaveCount(0)
      await page.locator('#strategy-idea').fill('첫 질문을 적는 중')
      expect(business).toBe(0)
      expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia.native.session-binding')!)))
        .toEqual({ sessionId: session.sessionId, sessionState: 'ANONYMOUS' })
      await page.reload()
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
      await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
      await expect(page.getByRole('alert')).toHaveCount(0)
      expect(creates).toBe(1)
      expect(business).toBe(0)
    } else {
      await expect(page.locator('.client-service-app')).not.toHaveClass(/view-landing/)
      await expect(page.getByRole('alert')).toContainText(warning)
      await expect(page.getByRole('button', { name: '이 전략 버전 승인', exact: true })).toHaveCount(0)
      expect(business).toBe(0)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
