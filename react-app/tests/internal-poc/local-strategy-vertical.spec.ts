import { TEST_ORIGIN } from '../test-origin'
import { expect, test, type Page } from '@playwright/test'
import {
  createFixtureRecoveryPayloads,
  FIXTURE_REPLAY_AUDIT_KEY,
  FIXTURE_RESPONSE_LOSS_KEY,
} from '../../src/internal-poc/fixture-adapter'

const BACKEND_PROFILE_HASH = 'ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497'
const SHORTHAND_IDEA = 'BTC 15분 RSI 30 아래면 100 USDT 롱, 손절 2%, 익절 5%, 레버리지 2배'
const RSI_PERIOD_REPLY = 'RSI 14'
const RSI_ENTRY_REPLY = 'RSI(14)가 30 미만이면 롱'
const SMA_ENTRY_REPLY = 'SMA20이 SMA60을 상향 돌파하면 롱'

const responseMeta = (revision: string | null = null) => ({
  apiContractVersion: '0.1.0',
  requestId: 'request_fixture_00000001',
  traceId: 'trace_fixture_00000001',
  resourceRevision: revision,
})

type MalformedLogout = 'revision' | 'timestamp' | 'same-etag' | 'weak-etag'

const assertMalformedLogoutKeepsClientState = async (page: Page, malformed: MalformedLogout) => {
  let sessionCreated = false
  const currentSession = {
    sessionId: 'session_owner_local_synthetic_0003', state: 'ANONYMOUS', revision: '1',
    issuedAt: '2030-01-01T00:00:00.000001Z', expiresAt: '2030-01-02T00:00:00.000001Z',
  }
  const currentEtag = '"owner_local_session_revision_0001"'
  const nextEtag = '"owner_local_session_revision_0002"'
  const ok = (data: unknown, revision: string | null = null) => JSON.stringify({ meta: responseMeta(revision), data })
  await page.route('**/internal-poc.html', async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html
        .replace('<meta name="robots" content="noindex,nofollow" />', `<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="${BACKEND_PROFILE_HASH}" />`)
        .replace('<meta name="tesia-owner-local-service-url" content="" />', `<meta name="tesia-owner-local-service-url" content="${TEST_ORIGIN}" />`),
    })
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === '/api/v1/auth/session' && request.method() === 'GET') {
      if (!sessionCreated) {
        await route.fulfill({
          status: 401, contentType: 'application/json',
          body: JSON.stringify({ meta: responseMeta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session unavailable.' } }),
        })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: currentEtag }, body: ok(currentSession, '1') })
      return
    }
    if (pathname === '/api/v1/anonymous-sessions' && request.method() === 'POST') {
      sessionCreated = true
      await route.fulfill({ status: 201, contentType: 'application/json', headers: { ETag: currentEtag }, body: ok(currentSession, '1') })
      return
    }
    if (pathname === '/api/v1/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ authenticated: false }) })
      return
    }
    if (pathname === '/api/v1/auth/csrf') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ csrfToken: 'synthetic_csrf_not_rendered_0003', expiresAt: '2030-01-01T12:00:00Z' }) })
      return
    }
    if (pathname === '/api/v1/auth/logout' && request.method() === 'POST') {
      const revised = {
        ...currentSession,
        state: 'REVOKED',
        revision: malformed === 'revision' ? '1' : '2',
        issuedAt: malformed === 'timestamp' ? '2030-01-01T00:00:00.000002Z' : currentSession.issuedAt,
      }
      const etag = malformed === 'same-etag' ? currentEtag : malformed === 'weak-etag' ? `W/${nextEtag}` : nextEtag
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: etag }, body: ok(revised, revised.revision) })
      return
    }
    await route.abort('blockedbyclient')
  })

  await page.goto('/internal-poc.html')
  await expect(page.getByRole('heading', { name: '전략 대화' })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('tesia-internal-poc-client-snapshot-v1', '{"sentinel":"retained"}'))
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '전략 대화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))).toBe('{"sentinel":"retained"}')
  await expect(page.locator('body')).not.toContainText('synthetic_csrf_not_rendered_0003')
}

const completeShorthandConversation = async (page: Page) => {
  await page.getByRole('button', { name: /지원 전략 예시 넣기/ }).click()
  const composer = page.getByLabel('전략 아이디어 또는 수정 요청')
  await expect(composer).toHaveValue(SHORTHAND_IDEA)
  await page.getByRole('button', { name: '보내기' }).click()

  await expect(page.getByText('거래할 심볼을 알려 주세요.')).toBeVisible()
  await expect(page.getByText('전략 완성을 위해 추가 확인이 필요합니다: 거래쌍 확인')).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeDisabled()
  await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()

  await expect(page.getByText('사용할 지표와 기간을 알려 주세요.')).toBeVisible()
  await expect(page.getByText('전략 완성을 위해 추가 확인이 필요합니다: 지표와 기간 확인')).toBeVisible()
  await page.getByRole('button', { name: RSI_PERIOD_REPLY, exact: true }).click()

  await expect(page.getByText('RSI 또는 SMA 교차 중 어떤 진입 조건을 사용할까요?')).toBeVisible()
  await expect(page.getByText('진입 조건 미정')).toBeVisible()
  await expect(page.getByText('전략 완성을 위해 추가 확인이 필요합니다: 진입 조건 확인')).toBeVisible()
  await page.getByRole('button', { name: RSI_ENTRY_REPLY, exact: true }).click()

  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
  await expect(page.getByText('BTCUSDT · 15m')).toBeVisible()
  await expect(page.getByText('RSI(14) < 30')).toBeVisible()
  await expect(page.getByText('100 USDT · fixed_notional')).toBeVisible()
  await expect(page.getByText('2× · isolated · one_way')).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeEnabled()
  return composer
}

test('복구 저장소 쓰기 실패는 성공한 대화를 실패나 반복 요청으로 바꾸지 않는다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tesia-internal-poc-client-snapshot-v1') throw new DOMException('Blocked', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.goto('/internal-poc-fixture.html')
  await completeShorthandConversation(page)
  await expect(page.getByTestId('local-recovery-storage-warning')).toBeVisible()
  await expect(page.getByRole('button', { name: '같은 요청 다시 확인', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '계약 검증', exact: true }).click()
  await expect(page.getByText('Validator 통과', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('최초 승인 키 저장 실패에서는 서버 변경과 입력 잠금 없이 멈춘다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await completeShorthandConversation(page)
  await page.getByRole('button', { name: '계약 검증', exact: true }).click()
  await page.getByRole('checkbox').check()
  const before = await page.evaluate(key => sessionStorage.getItem(key), FIXTURE_REPLAY_AUDIT_KEY)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.defineProperty(window, '__restoreTethTestStorage', { value: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tesia-internal-poc-client-snapshot-v1') throw new DOMException('Blocked', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.getByRole('button', { name: '승인하고 백테스트', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('아직 승인 요청을 보내지 않았습니다.')
  expect(await page.evaluate(key => sessionStorage.getItem(key), FIXTURE_REPLAY_AUDIT_KEY)).toBe(before)
  await expect(page.getByLabel('전략 아이디어 또는 수정 요청')).toBeEnabled()
  await expect(page.getByRole('button', { name: '승인·백테스트 이어서' })).toHaveCount(0)
  await page.evaluate(() => (window as Window & { __restoreTethTestStorage: () => void }).__restoreTethTestStorage())
  await page.getByRole('button', { name: '승인하고 백테스트', exact: true }).click()
  await expect(page.getByRole('heading', { name: '실행 완료' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('local-recovery-storage-warning')).toHaveCount(0)
})

for (const blockedStep of ['APPROVE', 'SUBMIT']) test(`승인 ${blockedStep} 저장 실패는 다음 mutation을 차단하고 메모리의 동일 요청으로 재개한다`, async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await completeShorthandConversation(page)
  await page.getByRole('button', { name: '계약 검증', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.evaluate(step => {
    const original = Storage.prototype.setItem
    Object.defineProperty(window, '__restoreTethTestStorage', { value: () => { Storage.prototype.setItem = original } })
    Object.defineProperty(window, '__tethTestPending', { value: null, writable: true })
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tesia-internal-poc-client-snapshot-v1' && JSON.parse(value).pendingWorkflow?.step === step) {
        (window as Window & { __tethTestPending: unknown }).__tethTestPending = JSON.parse(value).pendingWorkflow
        throw new DOMException('Blocked', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }
  }, blockedStep)
  await page.getByRole('button', { name: '승인하고 백테스트', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('LOCAL_RECOVERY_STORAGE_UNAVAILABLE')
  const audit = await page.evaluate(() => ({
    server: JSON.parse(sessionStorage.getItem('tesia-internal-poc-fixture-server-v1')!),
    pending: (window as Window & { __tethTestPending: { step: string; challengeId: string } }).__tethTestPending,
  }))
  expect(audit.pending).toMatchObject({ step: blockedStep, challengeId: 'approval_challenge_fixture_0001' })
  expect(audit.server.approved).toBe(blockedStep === 'SUBMIT')
  await expect(page.getByRole('heading', { name: '실행 완료' })).toHaveCount(0)
  await page.getByRole('button', { name: '승인·백테스트 이어서' }).click()
  expect(await page.evaluate(() => ({
    server: JSON.parse(sessionStorage.getItem('tesia-internal-poc-fixture-server-v1')!),
    pending: (window as Window & { __tethTestPending: unknown }).__tethTestPending,
  }))).toEqual(audit)
  await page.evaluate(() => (window as Window & { __restoreTethTestStorage: () => void }).__restoreTethTestStorage())
  await page.getByRole('button', { name: '승인·백테스트 이어서' }).click()
  await expect(page.getByRole('heading', { name: '실행 완료' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('local-recovery-storage-warning')).toHaveCount(0)
})

test('복구 저장소 삭제 실패 시 새 흐름이 이전 대화를 지우거나 새로고침하지 않는다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await completeShorthandConversation(page)
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem
    Storage.prototype.removeItem = function (key) {
      if (key === 'tesia-internal-poc-client-snapshot-v1') throw new DOMException('Blocked', 'SecurityError')
      return original.call(this, key)
    }
  })
  await page.getByRole('button', { name: '새 흐름', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('현재 대화는 유지됩니다.')
  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
})

test('URL query로 fixture를 요청해도 실제 API 모드는 fail-closed한다', async ({ page }) => {
  await page.goto('/internal-poc.html?adapter=fixture')

  await expect(page.getByRole('heading', { name: '내부 서비스 설정을 검증하지 못했습니다.' })).toBeVisible()
  await expect(page.getByText('STRUCTURAL_SMOKE_PROFILE_AUTHORITY_MISSING')).toBeVisible()
  await expect(page.getByText('Mock fixture', { exact: true })).toHaveCount(0)
})

test('owner-local bootstrap 연결 차단은 세션 생성이나 결과 추측 없이 재시도 UX로 닫힌다', async ({ page }) => {
  let createCalls = 0
  await page.route('**/internal-poc.html', async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html
        .replace('<meta name="robots" content="noindex,nofollow" />', `<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="${BACKEND_PROFILE_HASH}" />`)
        .replace('<meta name="tesia-owner-local-service-url" content="" />', `<meta name="tesia-owner-local-service-url" content="${TEST_ORIGIN}" />`),
    })
  })
  await page.route('**/api/v1/auth/session', (route) => route.abort('blockedbyclient'))
  await page.route('**/api/v1/anonymous-sessions', (route) => {
    createCalls += 1
    return route.abort('blockedbyclient')
  })

  await page.goto('/internal-poc.html')

  await expect(page.getByRole('heading', { name: '세션을 안전하게 확인하지 못했습니다.' })).toBeVisible()
  await expect(page.getByText('브라우저와 owner-local 서비스의 세션 왕복을 확인할 수 없어 화면을 열지 않았습니다.')).toBeVisible()
  await expect(page.getByText('BROWSER_SESSION_UNCONFIRMED')).toBeVisible()
  await expect(page.getByRole('button', { name: '세션 다시 확인' })).toBeVisible()
  expect(createCalls).toBe(0)
})

test('backend가 확정한 profile hash를 meta로 주입하면 same-origin 실제 API adapter가 열린다', async ({ page }) => {
  await page.route('**/internal-poc.html', async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html.replace(
        '<meta name="robots" content="noindex,nofollow" />',
        '<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="ef6bc3100d735654f2b933fee9ac6dd71883ab6bec07385f29b1412d87e96497" />',
      ),
    })
  })
  await page.route('**/api/v1/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', requestId: 'request_local_0001', traceId: 'trace_local_0001', resourceRevision: null },
      data: { authenticated: true, principalDisplay: '로컬 POC 사용자' },
    }),
  }))
  await page.route('**/api/v1/auth/csrf', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', requestId: 'request_local_0002', traceId: 'trace_local_0001', resourceRevision: null },
      data: { csrfToken: 'csrf_local_token_00000001', expiresAt: '2026-09-05T12:00:00Z' },
    }),
  }))

  await page.goto('/internal-poc.html')

  await expect(page.getByText('실제 엔진 실행·합성 시장 데이터', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: '전략 대화' })).toBeVisible()
})

test('명시 owner-local loopback만 익명 bootstrap을 열고, 성공한 logout만 화면 상태를 닫는다', async ({ page }) => {
  let sessionCreated = false
  let logoutSeen = false
  let apiCalls = 0
  const sessionData = (state: 'ANONYMOUS' | 'REVOKED', revision: string) => ({
    sessionId: 'session_owner_local_synthetic_0001', state, revision,
    issuedAt: '2030-01-01T00:00:00.000001Z', expiresAt: '2030-01-02T00:00:00.000001Z',
  })
  const authRequired = () => ({
    meta: responseMeta(null),
    error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic owner-local session is unavailable.' },
  })
  const ok = (data: unknown, revision: string | null = null) => JSON.stringify({ meta: responseMeta(revision), data })

  await page.route('**/internal-poc.html', async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html
        .replace(
          '<meta name="robots" content="noindex,nofollow" />',
          `<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="${BACKEND_PROFILE_HASH}" />`,
        )
        .replace(
          '<meta name="tesia-owner-local-service-url" content="" />',
          `<meta name="tesia-owner-local-service-url" content="${TEST_ORIGIN}" />`,
        ),
    })
  })
  await page.route('**/api/v1/**', async (route) => {
    apiCalls += 1
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/auth/session' && request.method() === 'GET') {
      if (!sessionCreated) {
        await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(authRequired()) })
        return
      }
      await route.fulfill({
        status: 200, contentType: 'application/json', headers: { ETag: '"owner_local_session_revision_0001"' },
        body: ok(sessionData('ANONYMOUS', '1'), '1'),
      })
      return
    }
    if (url.pathname === '/api/v1/anonymous-sessions' && request.method() === 'POST') {
      sessionCreated = true
      await route.fulfill({
        status: 201, contentType: 'application/json', headers: { ETag: '"owner_local_session_revision_0001"' },
        body: ok(sessionData('ANONYMOUS', '1'), '1'),
      })
      return
    }
    if (url.pathname === '/api/v1/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ authenticated: false }) })
      return
    }
    if (url.pathname === '/api/v1/auth/csrf') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: ok({ csrfToken: 'synthetic_csrf_must_not_be_rendered', expiresAt: '2030-01-01T12:00:00Z' }),
      })
      return
    }
    if (url.pathname === '/api/v1/auth/logout' && request.method() === 'POST') {
      const headers = request.headers()
      logoutSeen = headers['x-csrf-token'] !== undefined
        && headers['if-match'] === '"owner_local_session_revision_0001"'
        && headers['idempotency-key'] !== undefined
      await route.fulfill({
        status: 200, contentType: 'application/json', headers: { ETag: '"owner_local_session_revision_0002"' },
        body: ok(sessionData('REVOKED', '2'), '2'),
      })
      return
    }
    await route.abort('blockedbyclient')
  })

  await page.goto('/internal-poc.html')
  await expect(page.getByText('owner-local session', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '전략 대화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toHaveCount(0)
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.' })).toBeVisible()
  expect(sessionCreated).toBe(true)
  expect(logoutSeen).toBe(true)
  expect(apiCalls).toBeGreaterThanOrEqual(6)
  await expect(page.locator('body')).not.toContainText('synthetic_csrf_must_not_be_rendered')
})

test('localhost 설정은 API 요청 없이 fail-closed한다', async ({ page }) => {
  let apiCalls = 0
  await page.route('**/internal-poc.html', async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html
        .replace('<meta name="robots" content="noindex,nofollow" />', `<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="${BACKEND_PROFILE_HASH}" />`)
        .replace('<meta name="tesia-owner-local-service-url" content="" />', `<meta name="tesia-owner-local-service-url" content="${TEST_ORIGIN.replace('127.0.0.1', 'localhost')}" />`),
    })
  })
  await page.route('**/api/v1/**', async (route) => { apiCalls += 1; await route.abort('blockedbyclient') })
  await page.goto('/internal-poc.html')
  await expect(page.getByText('OWNER_LOCAL_SERVICE_URL_INVALID')).toBeVisible()
  expect(apiCalls).toBe(0)
})

test('logout 403은 snapshot과 현재 화면을 지우거나 성공으로 표시하지 않는다', async ({ page }) => {
  let sessionCreated = false
  const sessionData = {
    sessionId: 'session_owner_local_synthetic_0002', state: 'ANONYMOUS', revision: '1',
    issuedAt: '2030-01-01T00:00:00.000001Z', expiresAt: '2030-01-02T00:00:00.000001Z',
  }
  const ok = (data: unknown, revision: string | null = null) => JSON.stringify({ meta: responseMeta(revision), data })
  await page.route('**/internal-poc.html', async (route) => {
    const response = await route.fetch()
    const html = await response.text()
    await route.fulfill({
      response,
      body: html
        .replace('<meta name="robots" content="noindex,nofollow" />', `<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="${BACKEND_PROFILE_HASH}" />`)
        .replace('<meta name="tesia-owner-local-service-url" content="" />', `<meta name="tesia-owner-local-service-url" content="${TEST_ORIGIN}" />`),
    })
  })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname === '/api/v1/auth/session' && request.method() === 'GET') {
      if (!sessionCreated) {
        await route.fulfill({
          status: 401, contentType: 'application/json',
          body: JSON.stringify({ meta: responseMeta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session unavailable.' } }),
        })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"owner_local_session_revision_0001"' }, body: ok(sessionData, '1') })
      return
    }
    if (pathname === '/api/v1/anonymous-sessions' && request.method() === 'POST') {
      sessionCreated = true
      await route.fulfill({ status: 201, contentType: 'application/json', headers: { ETag: '"owner_local_session_revision_0001"' }, body: ok(sessionData, '1') })
      return
    }
    if (pathname === '/api/v1/me') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ authenticated: false }) })
      return
    }
    if (pathname === '/api/v1/auth/csrf') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: ok({ csrfToken: 'synthetic_csrf_not_rendered_0002', expiresAt: '2030-01-01T12:00:00Z' }) })
      return
    }
    if (pathname === '/api/v1/auth/logout' && request.method() === 'POST') {
      await route.fulfill({
        status: 403, contentType: 'application/json',
        body: JSON.stringify({ meta: responseMeta('1'), error: { code: 'CSRF_INVALID', message: 'Synthetic logout refusal.' } }),
      })
      return
    }
    await route.abort('blockedbyclient')
  })

  await page.goto('/internal-poc.html')
  await expect(page.getByRole('heading', { name: '전략 대화' })).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('tesia-internal-poc-client-snapshot-v1', '{"sentinel":"retained"}'))
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '전략 대화' })).toBeVisible()
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))).toBe('{"sentinel":"retained"}')
  await expect(page.locator('body')).not.toContainText('synthetic_csrf_not_rendered_0002')
})

for (const malformed of ['revision', 'timestamp', 'same-etag', 'weak-etag'] as const) {
  test(`logout REVOKED ${malformed} 조작 응답은 성공으로 표시하거나 상태를 지우지 않는다`, async ({ page }) => {
    await assertMalformedLogoutKeepsClientState(page, malformed)
  })
}

test('한국어 전략 대화부터 승인, 합성 백테스트, report와 trades까지 연결된다', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== TEST_ORIGIN) externalRequests.push(request.url())
  })

  await page.goto('/internal-poc-fixture.html')
  await expect(page.getByText('Mock fixture', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('SYNTHETIC_UI_FIXTURE · UNVERIFIED · PRIVATE_ONLY')).toBeVisible()
  await expect(page.getByText('BTCUSDT', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('15m', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('RSI', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('SMA', { exact: true }).first()).toBeVisible()

  const composer = await completeShorthandConversation(page)
  await expect(page.getByRole('heading', { name: '이번 변경' })).toBeVisible()

  await composer.fill('RSI 28로 바꿔줘')
  await page.getByRole('button', { name: '보내기' }).click()
  await expect(page.getByText('RSI(14) < 28')).toBeVisible()

  await page.getByRole('button', { name: '계약 검증' }).click()
  await expect(page.getByText('Validator 통과')).toBeVisible()
  await page.getByRole('checkbox').check()

  await composer.fill('RSI 28로 다시 확정해줘')
  await page.getByRole('button', { name: '보내기' }).click()
  await expect(page.getByText('Validator 통과')).toHaveCount(0)
  await expect(page.getByRole('checkbox')).toHaveCount(0)

  await page.getByRole('button', { name: '계약 검증' }).click()
  await expect(page.getByText('Validator 통과')).toBeVisible()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '승인하고 백테스트' }).click()

  await expect(page.getByRole('heading', { name: '실행 완료' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toBeVisible()
  await expect(page.getByText('IS 3 · OOS 2')).toBeVisible()
  await expect(page.getByRole('heading', { name: '체결 목록' })).toBeVisible()
  await expect(page.getByText('TAKE_PROFIT')).toBeVisible()
  await expect(page.getByText('STOP_LOSS')).toBeVisible()
  expect(externalRequests).toEqual([])
})

test('backend의 exact quick reply 두 개를 추가 합성 없이 표시한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await page.getByRole('button', { name: /지원 전략 예시 넣기/ }).click()
  await page.getByRole('button', { name: '보내기' }).click()
  await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()
  await page.getByRole('button', { name: RSI_PERIOD_REPLY, exact: true }).click()

  await expect(page.getByText('RSI 또는 SMA 교차 중 어떤 진입 조건을 사용할까요?')).toBeVisible()
  await expect(page.getByRole('button', { name: RSI_ENTRY_REPLY, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: SMA_ENTRY_REPLY, exact: true })).toBeVisible()
  await expect(page.locator('[aria-label="진입 조건 확인"] button')).toHaveCount(2)
})

test('SMA 선택은 미인식 입력을 거부한 뒤 cross_above 전략으로만 READY가 된다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await page.getByRole('button', { name: /지원 전략 예시 넣기/ }).click()
  const composer = page.getByLabel('전략 아이디어 또는 수정 요청')
  await page.getByRole('button', { name: '보내기' }).click()
  await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()
  await page.getByRole('button', { name: RSI_PERIOD_REPLY, exact: true }).click()

  const stateBeforeUnknown = await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-fixture-server-v1'))
  await composer.fill('아무 조건이나 적용해줘')
  await page.getByRole('button', { name: '보내기' }).click()
  await expect(page.getByText('FIXTURE_UNRECOGNIZED_STRATEGY_REPLY')).toBeVisible()
  const stateAfterUnknown = await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-fixture-server-v1'))
  expect(stateAfterUnknown).toBe(stateBeforeUnknown)
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeDisabled()
  await expect(page.getByRole('button', { name: SMA_ENTRY_REPLY, exact: true })).toBeVisible()

  await page.getByRole('button', { name: SMA_ENTRY_REPLY, exact: true }).click()
  await expect(page.getByRole('heading', { name: 'BTC SMA 교차' })).toBeVisible()
  await expect(page.getByText('SMA(20) ↑교차 SMA(60)')).toBeVisible()
  await expect(page.getByText('feature.sma20 → {"type":"sma","period":20}')).toBeVisible()
  await expect(page.getByText('feature.sma60 → {"type":"sma","period":60}')).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeEnabled()
})

test('직접 입력한 RSI 21과 원문 임계값 25를 option과 최종 AST까지 유지한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  const composer = page.getByLabel('전략 아이디어 또는 수정 요청')
  await composer.fill(SHORTHAND_IDEA.replace('RSI 30', 'RSI 25'))
  await page.getByRole('button', { name: '보내기' }).click()
  await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()

  await composer.fill('RSI 21')
  await page.getByRole('button', { name: '보내기' }).click()
  const rsi21Entry = 'RSI(21)가 25 미만이면 롱'
  await expect(page.getByRole('button', { name: rsi21Entry, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: RSI_ENTRY_REPLY, exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: rsi21Entry, exact: true }).click()

  await expect(page.getByText('RSI(21) < 25')).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeEnabled()
})

test('비정규 RSI 임계값 0·100·007·500은 상태 전이 없이 거부한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  const composer = page.getByLabel('전략 아이디어 또는 수정 요청')
  for (const threshold of ['0', '100', '007', '500']) {
    await composer.fill(SHORTHAND_IDEA.replace('RSI 30', `RSI ${threshold}`))
    await page.getByRole('button', { name: '보내기' }).click()
    await expect(page.getByText('FIXTURE_UNSUPPORTED_RSI_THRESHOLD')).toBeVisible()
    const fixtureState = await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia-internal-poc-fixture-server-v1') ?? '{}'))
    expect(fixtureState.conversationStage).toBe(0)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))).toBeNull()
  }
})

test('stage 1·2·3 reload 뒤 저장된 다음 질문에서 대화를 계속한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await page.getByRole('button', { name: /지원 전략 예시 넣기/ }).click()
  await page.getByRole('button', { name: '보내기' }).click()

  await page.reload()
  await expect(page.getByRole('button', { name: 'BTCUSDT', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()

  await page.reload()
  await expect(page.getByRole('button', { name: RSI_PERIOD_REPLY, exact: true })).toBeVisible()
  await page.getByRole('button', { name: RSI_PERIOD_REPLY, exact: true }).click()

  await page.reload()
  await expect(page.getByRole('button', { name: RSI_ENTRY_REPLY, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: SMA_ENTRY_REPLY, exact: true })).toBeVisible()
  await page.getByRole('button', { name: RSI_ENTRY_REPLY, exact: true }).click()

  await expect(page.getByText('RSI(14) < 30')).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeEnabled()
})

test('stale READY snapshot도 서버의 partial Draft를 읽은 뒤 검증 불가 상태로 복구한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await page.evaluate(() => {
    sessionStorage.setItem('tesia-internal-poc-fixture-server-v1', JSON.stringify({
      draftRevision: 4,
      rsiPeriod: 14,
      rsiThreshold: '30',
      entryOperator: 'lt',
      conversationStage: 4,
      conversationCreated: true,
      approved: false,
      backtestPoll: 0,
    }))
    sessionStorage.setItem('tesia-internal-poc-client-snapshot-v1', JSON.stringify({
      conversationId: 'conversation_fixture_0001',
      draftId: 'draft_fixture_00000001',
      draftEtag: '"etag_draft_fixture_00000004"',
      draftRevision: '4',
      candidateState: 'READY_FOR_VALIDATION',
      nextQuestion: null,
    }))
  })

  await page.reload()
  await expect(page.getByText('진행 상태를 안전하게 복구했습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeDisabled()
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')!).candidateState)).toBe('INCOMPLETE')
})

test('legacy INCOMPLETE snapshot도 새 SDK로 partial Draft를 복구한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await page.evaluate(() => {
    sessionStorage.setItem('tesia-internal-poc-fixture-server-v1', JSON.stringify({
      draftRevision: 2,
      rsiPeriod: 14,
      rsiThreshold: '30',
      entryOperator: 'lt',
      conversationStage: 2,
      conversationCreated: true,
      approved: false,
      backtestPoll: 0,
    }))
    sessionStorage.setItem('tesia-internal-poc-client-snapshot-v1', JSON.stringify({
      conversationId: 'conversation_fixture_0001',
      draftId: 'draft_fixture_00000001',
      draftEtag: '"etag_draft_fixture_00000002"',
      draftRevision: '2',
      candidateState: 'INCOMPLETE',
      nextQuestion: {
        kind: 'CANDIDATE_MISSING_PATH',
        questionId: 'q_features',
        targetPath: '/features',
        reasonCode: 'MISSING_REQUIRED_FIELD',
        prompt: '사용할 지표와 기간을 알려 주세요.',
        options: ['RSI 14', '다시 설명'],
      },
    }))
  })

  await page.reload()
  await expect(page.getByText('진행 상태를 안전하게 복구했습니다.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '신뢰 입력 없이 실행하지 않았습니다.' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeDisabled()
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')!).candidateState)).toBe('INCOMPLETE')
})

test('READY draft reload와 승인 응답 유실을 같은 idempotency key로 재개한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  await completeShorthandConversation(page)

  await page.reload()
  await expect(page.getByText('진행 상태를 안전하게 복구했습니다.')).toBeVisible()
  await expect(page.getByRole('button', { name: '계약 검증' })).toBeEnabled()
  await page.getByRole('button', { name: '계약 검증' }).click()
  await page.getByRole('checkbox').check()
  await page.evaluate((key) => sessionStorage.setItem(key, 'createApprovalChallenge'), FIXTURE_RESPONSE_LOSS_KEY)
  await page.getByRole('button', { name: '승인하고 백테스트' }).click()

  await expect(page.getByText('FIXTURE_RESPONSE_LOST_AFTER_COMMIT')).toBeVisible()
  await expect(page.getByLabel('전략 아이디어 또는 수정 요청')).toBeDisabled()
  const pendingBeforeReload = await page.evaluate(() => {
    const raw = sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')
    return raw === null ? null : JSON.parse(raw).pendingWorkflow
  })
  expect(pendingBeforeReload).toMatchObject({
    step: 'CHALLENGE',
    validationReceiptId: 'validation_receipt_fixture_0001',
    semanticHash: '39cbfd0090218a159ae03ef11e9d686482a644772dab291b03b864658caf2e46',
  })

  await page.getByRole('button', { name: '새 흐름', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('아직 결과를 확인하지 못한 요청')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')!).pendingWorkflow)).toEqual(pendingBeforeReload)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
  await expect(page.getByText('중단된 승인 흐름이 있습니다.')).toBeVisible()
  const pendingAfterReload = await page.evaluate(() => {
    const raw = sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')
    return raw === null ? null : JSON.parse(raw).pendingWorkflow
  })
  expect(pendingAfterReload).toEqual(pendingBeforeReload)

  await page.getByRole('button', { name: '승인·백테스트 이어서' }).click()
  await expect(page.getByRole('heading', { name: '실행 완료' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toBeVisible()
  const replayAudit = await page.evaluate((key) => {
    const raw = sessionStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  }, FIXTURE_REPLAY_AUDIT_KEY)
  expect(replayAudit).toMatchObject({
    operation: 'createApprovalChallenge',
    idempotencyKey: pendingBeforeReload.challengeIdempotencyKey,
    ifMatch: pendingBeforeReload.challengeIfMatch,
    replayed: true,
  })
  const finalSnapshot = await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))
  expect(finalSnapshot).not.toContain('pendingWorkflow')
})

test('완료 job은 수동 reload 뒤 server meta와 식별자로 신뢰 결과를 복구한다', async ({ page }, info) => {
  const payloads = await createFixtureRecoveryPayloads(BACKEND_PROFILE_HASH)
  let injectVerifierAuthority = false
  let resultRequests = 0
  let tamper: 'none' | 'manifest' | 'trades' | 'network' | 'unauthorized' = 'none'
  let releaseManifest: (() => void) | undefined
  let manifestGate: Promise<void> | undefined

  await page.route('**/internal-poc.html*', async (route) => {
    const response = await route.fetch()
    const verifier = payloads.trustedVerifierAuthority
    const verifierMeta = injectVerifierAuthority
      ? [
          `<meta name="tesia-report-verifier-name" content="${verifier.verifierPin.name}" />`,
          `<meta name="tesia-report-verifier-version" content="${verifier.verifierPin.version}" />`,
          `<meta name="tesia-report-verifier-commit-sha" content="${verifier.verifierPin.commitSha}" />`,
          `<meta name="tesia-report-trust-anchor-hash" content="${verifier.trustAnchorContentHash}" />`,
          `<meta name="tesia-report-receipt-content-hash" content="${verifier.expectedReceiptContentHash}" />`,
          `<meta name="tesia-report-subject-content-hash" content="${verifier.expectedSubjectContentHash}" />`,
        ].join('')
      : ''
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        '<meta name="robots" content="noindex,nofollow" />',
        `<meta name="robots" content="noindex,nofollow" /><meta name="tesia-structural-smoke-profile-hash" content="${BACKEND_PROFILE_HASH}" />${verifierMeta}`,
      ),
    })
  })

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let data: unknown
    let etag: string | undefined
    let resourceRevision: string | null = null
    if (url.pathname === '/api/v1/me') {
      data = { authenticated: true, principalDisplay: '로컬 POC 사용자' }
    } else if (url.pathname === '/api/v1/auth/csrf') {
      data = { csrfToken: 'csrf_fixture_token_00000001', expiresAt: '2026-09-05T12:00:00Z' }
    } else if (url.pathname === `/api/v1/strategy-drafts/${payloads.ids.draftId}`) {
      data = payloads.draft
      etag = '"etag_fixture_recovery_0001"'
      resourceRevision = '2'
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}`) {
      data = payloads.job
      etag = '"etag_backtest_fixture_0007"'
      resourceRevision = payloads.job.revision
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}/report`) {
      resultRequests += 1
      if (tamper === 'network') { await route.abort('failed'); return }
      data = payloads.report
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}/manifest`) {
      resultRequests += 1
      if (manifestGate) await manifestGate
      if (tamper === 'unauthorized') {
        await route.fulfill({ status: 401, contentType: 'application/json',
          body: JSON.stringify({ meta: responseMeta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic unauthorized result.' } }) })
        return
      }
      data = tamper === 'manifest'
        ? {
            ...payloads.manifest,
            segments: [
              { ...payloads.manifest.segments[0], tradeManifestContentHash: 'd'.repeat(64) },
              payloads.manifest.segments[1],
            ],
          }
        : payloads.manifest
    } else if (url.pathname === `/api/v1/backtests/${payloads.ids.backtestId}/trades`) {
      resultRequests += 1
      const requestedOos = url.searchParams.get('segment') === 'OOS'
      data = tamper === 'trades'
        ? (requestedOos ? payloads.trades.IS : payloads.trades.OOS)
        : (requestedOos ? payloads.trades.OOS : payloads.trades.IS)
    } else {
      await route.abort('blockedbyclient')
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      ...(etag === undefined ? {} : { headers: { ETag: etag } }),
      body: JSON.stringify({ meta: responseMeta(resourceRevision), data }),
    })
  })

  await page.goto('/internal-poc.html')
  await page.evaluate(({ draftId, backtestId }) => {
    sessionStorage.setItem('tesia-internal-poc-client-snapshot-v1', JSON.stringify({
      conversationId: 'conversation_fixture_0001',
      draftId,
      draftEtag: 'etag_draft_fixture_00000002',
      draftRevision: '2',
      backtestId,
    }))
  }, payloads.ids)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))).not.toBeNull()
  await page.reload()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1'))).not.toBeNull()
  await expect(page.getByRole('heading', { name: '결과 신뢰 바인딩이 없어 표시를 중단했습니다.' })).toBeVisible()
  expect(resultRequests).toBe(0)

  injectVerifierAuthority = true
  await page.getByRole('button', { name: '신뢰값 다시 불러오기' }).click()

  await expect(page.getByText('진행 상태를 안전하게 복구했습니다.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toBeVisible()
  await expect(page.getByText('IS 3 · OOS 2')).toBeVisible()
  expect(resultRequests).toBe(4)

  tamper = 'network'
  await page.reload()
  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
  await expect(page.getByRole('button', { name: '결과 다시 불러오기', exact: true })).toBeVisible()
  const recoveryPanel = page.getByRole('region', { name: '백테스트 결과 조회' })
  await recoveryPanel.scrollIntoViewIfNeeded()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('body')).toHaveCSS('font-family', /Noto Sans KR Variable/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await recoveryPanel.screenshot({ path: info.outputPath('result-recovery.png') })
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tesia-internal-poc-client-snapshot-v1')!).backtestId)).toBe(payloads.ids.backtestId)
  manifestGate = new Promise<void>(resolve => { releaseManifest = resolve })
  const requestsBeforeRetry = resultRequests
  await page.getByRole('button', { name: '결과 다시 불러오기', exact: true }).click()
  await expect.poll(() => resultRequests).toBe(requestsBeforeRetry + 4)
  const loadingButton = page.getByRole('button', { name: '결과 확인 중', exact: true })
  await expect(loadingButton).toBeDisabled()
  await loadingButton.evaluate(button => { for (let i = 0; i < 5; i++) (button as HTMLButtonElement).click() })
  expect(resultRequests).toBe(requestsBeforeRetry + 4)
  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
  releaseManifest?.()
  manifestGate = undefined
  await expect(page.getByRole('button', { name: '결과 다시 불러오기', exact: true })).toBeEnabled()
  tamper = 'none'
  await page.getByRole('button', { name: '결과 다시 불러오기', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toBeVisible()

  tamper = 'manifest'
  await page.reload()
  await expect(page.getByText('CROSS_RESOURCE_BACKTEST_BINDING_MISMATCH')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toHaveCount(0)

  tamper = 'trades'
  await page.reload()
  await expect(page.getByText('CROSS_RESOURCE_BACKTEST_BINDING_MISMATCH')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toHaveCount(0)
  tamper = 'none'
  await page.getByRole('button', { name: '결과 다시 불러오기', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toBeVisible()

  tamper = 'unauthorized'
  await page.reload()
  await expect(page.getByRole('button', { name: '세션 다시 확인', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '결과 다시 불러오기', exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'BTC RSI 되돌림' })).toBeVisible()
  tamper = 'network'
  await page.goto('/internal-poc.html#/client')
  await page.reload() // Presentation is selected at document boot, not hashchange.
  const clientRecovery = page.getByRole('region', { name: '백테스트 결과 조회' })
  await expect(clientRecovery.getByRole('button', { name: '결과 다시 불러오기', exact: true })).toBeVisible()
  await clientRecovery.scrollIntoViewIfNeeded()
  await page.evaluate(() => document.fonts.ready)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await clientRecovery.screenshot({ path: info.outputPath('client-result-recovery.png') })
  tamper = 'none'
  await clientRecovery.getByRole('button', { name: '결과 다시 불러오기', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'IS와 OOS를 분리해 봅니다.' })).toBeVisible()
})
