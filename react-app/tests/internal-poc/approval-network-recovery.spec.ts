import { expect, test } from '@playwright/test'
import { createFixtureRecoveryPayloads } from '../../src/internal-poc/fixture-adapter'
import { TEST_ORIGIN } from '../test-origin'

// Synthetic authenticated transport only. No real session values in artifacts.
test.use({ trace: 'off', video: 'off' })

const PROFILE = 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497'
const SNAPSHOT_KEY = 'tesia-internal-poc-client-snapshot-v1'
const ETAG = '"etag_fixture_recovery_0001"'
const meta = (revision: string | null = null) => ({
  apiContractVersion: '0.1.0', requestId: 'request_fixture_00000001',
  traceId: 'trace_fixture_00000001', resourceRevision: revision,
})

for (const step of ['CHALLENGE', 'APPROVE', 'SUBMIT'] as const) {
  for (const failure of ['TypeError', 'AbortError', '401'] as const) {
    test(`${step} ${failure}: 네트워크 오류는 승인 키를 보존하고 401은 재개를 차단한다`, async ({ page }) => {
      const payloads = await createFixtureRecoveryPayloads(PROFILE)
      const mutationPath = step === 'CHALLENGE'
        ? `/api/v1/strategy-drafts/${payloads.ids.draftId}/approval-challenges`
        : step === 'APPROVE'
          ? `/api/v1/strategy-drafts/${payloads.ids.draftId}/approve`
          : '/api/v1/backtests'
      const pending = {
        step, validationReceiptId: 'validation_receipt_fixture_0001',
        semanticHash: '39cbfd0090218a159ae03ef11e9d686482a644772dab291b03b864658caf2e46',
        challengeIfMatch: ETAG,
        challengeIdempotencyKey: 'idem_synthetic_challenge_0001',
        approveIdempotencyKey: 'idem_synthetic_approval_0001',
        submitIdempotencyKey: 'idem_synthetic_submission_0001',
        ...(step === 'CHALLENGE' ? {} : { challengeId: 'approval_challenge_fixture_0001', approveIfMatch: ETAG }),
        ...(step === 'SUBMIT' ? { strategyVersionId: 'strategy_version_fixture_0001' } : {}),
      }
      const snapshot = {
        conversationId: 'conversation_fixture_0001', draftId: payloads.ids.draftId,
        draftEtag: ETAG, draftRevision: '2', candidateState: 'READY_FOR_VALIDATION',
        draftState: payloads.draft, pendingWorkflow: pending,
      }
      await page.addInitScript(({ snapshot, key, mutationPath, failure }) => {
        sessionStorage.setItem(key, JSON.stringify(snapshot))
        const requests: { path: string; body: string | undefined; idempotencyKey: string | null; ifMatch: string | null }[] = []
        Object.defineProperty(window, '__approvalRecoveryRequests', { value: requests })
        const originalFetch = window.fetch.bind(window)
        window.fetch = async (input, init) => {
          const path = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin).pathname
          if (path === mutationPath && init?.method === 'POST') {
            const headers = new Headers(init.headers)
            requests.push({ path, body: typeof init.body === 'string' ? init.body : undefined,
              idempotencyKey: headers.get('Idempotency-Key'), ifMatch: headers.get('If-Match') })
            if (failure === 'TypeError') throw new TypeError('Synthetic network loss')
            if (failure === 'AbortError') throw new DOMException('Synthetic bounded timeout', 'AbortError')
          }
          return originalFetch(input, init)
        }
      }, { snapshot, key: SNAPSHOT_KEY, mutationPath, failure })
      await page.route('**/internal-poc.html', async route => {
        const response = await route.fetch()
        const body = (await response.text())
          .replace('<meta name="robots" content="noindex,nofollow" />', `<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="${PROFILE}" />`)
          .replace('<meta name="tesia-owner-local-service-url" content="" />', `<meta name="tesia-owner-local-service-url" content="${TEST_ORIGIN}" />`)
        await route.fulfill({ response, body })
      })
      await page.route('**/api/v1/**', async route => {
        const path = new URL(route.request().url()).pathname
        let data: unknown
        let revision: string | null = null
        let etag: string | undefined
        if (path === mutationPath && route.request().method() === 'POST') {
          expect(failure).toBe('401')
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({
            meta: meta(), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic revoked session.' },
          }) })
          return
        }
        if (path === '/api/v1/auth/session') {
          data = { sessionId: 'session_synthetic_owner_0001', state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          revision = '1'; etag = '"etag_synthetic_session_0001"'
        } else if (path === '/api/v1/me') data = { authenticated: true, principalDisplay: '합성 검수 사용자' }
        else if (path === '/api/v1/auth/csrf') data = { csrfToken: 'csrf_synthetic_test_only_0001', expiresAt: '2030-01-02T00:00:00Z' }
        else if (path === `/api/v1/strategy-drafts/${payloads.ids.draftId}`) { data = payloads.draft; revision = '2'; etag = ETAG }
        else throw new Error(`Unexpected synthetic route: ${path}`)
        await route.fulfill({ status: 200, contentType: 'application/json', headers: etag ? { ETag: etag } : {}, body: JSON.stringify({ meta: meta(revision), data }) })
      })
      await page.goto('/internal-poc.html#/client')
      const resume = page.getByRole('button', { name: '승인·백테스트 이어서', exact: true })
      await expect(resume).toBeEnabled()
      await resume.click()
      const readPending = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).pendingWorkflow, SNAPSHOT_KEY)
      const readRequests = () => page.evaluate(() => (window as Window & { __approvalRecoveryRequests: unknown[] }).__approvalRecoveryRequests)
      await expect.poll(async () => (await readRequests()).length).toBe(1)
      expect(await readPending()).toEqual(pending)
      if (failure === '401') {
        await expect(resume).toBeDisabled()
        await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true }).first()).toBeVisible()
      } else {
        await expect(page.getByText('OWNER_LOCAL_NETWORK_UNAVAILABLE', { exact: true })).toBeVisible()
        await expect(resume).toBeEnabled()
        await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toHaveCount(0)
        await resume.click()
        await expect.poll(async () => (await readRequests()).length).toBe(2)
        await expect(resume).toBeEnabled()
        const requests = await readRequests()
        expect(requests[1]).toEqual(requests[0])
        expect(await readPending()).toEqual(pending)
      }
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    })
  }
}
