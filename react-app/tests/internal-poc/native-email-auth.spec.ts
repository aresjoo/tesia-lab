import { expect, test, type Page } from '@playwright/test'

// The original Web47 test-first checkpoint was RED on the missing adapter.
// Current tests consume the immutable API0.9 package with synthetic transport,
// not actual cookie/mail delivery. Imports stay outside rejection catches.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test.setTimeout(30_000)
const ANON = 'session_email_anon_fixture_0001', AUTH = 'session_email_auth_fixture_0001'
const ANON_ETAG = '"email_anon_etag_fixture_0001"', AUTH_ETAG = '"email_auth_etag_fixture_0001"'
const CHALLENGE_ETAG = '"email_challenge_etag_fixture_0001"'
const CHALLENGE = 'email_challenge_fixture_00000001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_email_auth_fixture_001', traceId: 'trace_email_auth_fixture_001', resourceRevision: revision })
const session = (id: string, state: string, revision: string) => ({ sessionId: id, state, revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' })
type BrowserAdapter = { requestCode(email: string): Promise<unknown>; verifyCode(code: string): Promise<{ verification: string; sessionId: string; claimIntent: { initiatingSessionId: string; expectedSessionRevision: string; initiatingSessionEtag: string } }>; retryPending(): Promise<unknown>; recoverSession(): Promise<{ verification: string; claimIntent?: { initiatingSessionId: string; expectedSessionRevision: string; initiatingSessionEtag: string } }> }
type TestWindow = Window & { emailAuth: BrowserAdapter; emailAuthActive: boolean }

async function setup(page: Page) {
  const state = { owner: ANON, authenticated: false, csrfReads: 0, csrf: '', createCount: 0, verifyCount: 0,
    loseCreate: false, loseVerify: false, freshAuthAfterLoss: false, rejectCsrf: false,
    changedField: '', wrongAuthReadback: false, wrongAuthEtag: false, verificationField: '', delivery: 'ACCEPTED', createError: '', rejectCodeOnce: false,
    holdVerify: undefined as (() => Promise<void>) | undefined }
  const creates: { key: string; csrf: string; match: string; body: string }[] = [], verifies: typeof creates = []
  const posts: string[] = []
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(url.search).toBe('')
    expect(request.headers().authorization).toBeUndefined()
    if (request.method() === 'POST') posts.push(path)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const error = (status: number, code: string, version = '0.9.0') => route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, null), error: { code, message: 'Authentication request failed.' } }) })
    if (path === '/api/v1/auth/session') {
      headers.ETag = state.authenticated ? AUTH_ETAG : ANON_ETAG
      if (state.authenticated && state.wrongAuthEtag) headers.ETag = '"email_other_auth_etag_fixture_01"'
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta('0.1.0', state.authenticated ? '1' : '7'), data: session(state.wrongAuthReadback && state.authenticated ? 'session_email_other_fixture_001' : state.owner, state.authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', state.authenticated ? '1' : '7') }) })
    }
    if (path === '/api/v1/auth/csrf') {
      // Existing v1 semantics: GET rotates the digest; it cannot recover old CSRF.
      state.csrf = `csrf_email_fixture_rotation_${++state.csrfReads}`
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: state.csrf, expiresAt: '2030-01-01T12:00:00Z' } }) })
    }
    const observed = { key: request.headers()['idempotency-key'], csrf: request.headers()['x-csrf-token'], match: request.headers()['if-match'], body: request.postData() ?? '' }
    if (path === '/api/v9/auth/email/challenges') {
      state.createCount++; creates.push(observed)
      if (state.owner !== ANON || state.authenticated) return error(401, 'AUTHENTICATION_REQUIRED')
      if (observed.csrf !== state.csrf) return error(403, 'CSRF_INVALID')
      if (state.createError) return error(state.createError === 'MAIL_DISABLED' ? 503 : 429, state.createError)
      if (state.loseCreate && state.createCount === 1) return route.abort()
      const data: Record<string, unknown> = { challengeId: CHALLENGE, initiatingSessionId: ANON, initiatingSessionRevision: '7', initiatingSessionEtag: ANON_ETAG, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:05:00Z', resendAllowedAt: '2030-01-01T00:00:30Z', deliveryStatus: state.delivery }
      if (state.changedField === 'initiatingSessionId') data.initiatingSessionId = 'session_email_other_fixture_001'
      if (state.changedField === 'initiatingSessionRevision') data.initiatingSessionRevision = '8'
      if (state.changedField === 'initiatingSessionEtag') data.initiatingSessionEtag = '"email_other_etag_fixture_001"'
      headers.ETag = CHALLENGE_ETAG
      return route.fulfill({ status: 201, headers, body: JSON.stringify({ meta: meta('0.9.0', '7'), data }) })
    }
    if (path === `/api/v9/auth/email/challenges/${CHALLENGE}/verifications`) {
      state.verifyCount++; verifies.push(observed)
      if (state.holdVerify) await state.holdVerify()
      if (state.owner !== ANON || state.authenticated) return error(401, 'AUTHENTICATION_REQUIRED')
      if (state.rejectCsrf || observed.csrf !== state.csrf) return error(403, 'CSRF_INVALID')
      if (observed.match !== ANON_ETAG) return error(412, 'PRECONDITION_FAILED')
      if (state.rejectCodeOnce && state.verifyCount === 1) return error(400, 'CODE_INVALID')
      if (state.loseVerify && state.verifyCount === 1) {
        // Application-state fixture only, not actual Set-Cookie/body-loss evidence.
        if (state.freshAuthAfterLoss) { state.owner = AUTH; state.authenticated = true }
        return route.abort()
      }
      state.owner = AUTH; state.authenticated = true; headers.ETag = AUTH_ETAG
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: meta('0.9.0', '1'), data: {
        challengeId: CHALLENGE, challengeExpiresAt: state.verificationField === 'expiry' ? '2030-01-01T00:04:59Z' : '2030-01-01T00:05:00Z', session: session(AUTH, 'AUTHENTICATED', '1'),
        handoffReservation: { challengeId: CHALLENGE, initiatingSessionId: state.verificationField === 'id' ? 'session_email_other_fixture_001' : ANON,
          initiatingSessionRevision: state.verificationField === 'revision' ? '8' : '7', initiatingSessionEtag: ANON_ETAG, authenticatedSessionId: AUTH, state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:00:00Z' },
      } }) })
    }
    return route.abort()
  })
  await page.route('**/email-adapter-test', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><body>이메일 어댑터 합성 시험</body></html>' }))
  await page.goto('/email-adapter-test')
  return { state, creates, verifies, posts }
}
async function load(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/internal-poc/native-email-auth.ts'
    const { createNativeEmailAuth } = await import(/* @vite-ignore */ path)
    const scope = window as TestWindow
    scope.emailAuthActive = true
    scope.emailAuth = createNativeEmailAuth({ isCurrent: () => scope.emailAuthActive })
  })
}
const requestCode = (page: Page) => page.evaluate(() => (window as TestWindow).emailAuth.requestCode('Test+tag@example.invalid').then(() => 'received', () => 'rejected'))
const verifyCode = (page: Page) => page.evaluate(() => (window as TestWindow).emailAuth.verifyCode('000123').then(result => ({ verification: result.verification, sessionId: result.sessionId, claimIntent: result.claimIntent }), () => null))
const retry = (page: Page) => page.evaluate(() => (window as TestWindow).emailAuth.retryPending().then(() => true, () => false))
async function assertNoSecrets(page: Page) {
  const flags = await page.evaluate(() => {
    const text = JSON.stringify({ ...sessionStorage, ...localStorage })
    return { raw: /Test\+tag|example\.invalid|000123|csrf_email_fixture|COOKIE_BOUND_SESSION_ROUND_TRIP/.test(text), cookie: /Set-Cookie|HttpOnly/.test(text) }
  })
  expect(flags).toEqual({ raw: false, cookie: false })
}

test('email adapter 성공은 원 triple와 fresh AUTH를 대조하고 자동 claim 하지 않는다', async ({ page }) => {
  const evidence = await setup(page); await load(page)
  expect(await requestCode(page)).toBe('received')
  expect(evidence.posts).toHaveLength(1)
  const result = await verifyCode(page)
  expect(result).toEqual({ verification: 'EMAIL_CODE_COOKIE_BOUND_SESSION_ROUND_TRIP', sessionId: AUTH, claimIntent: { initiatingSessionId: ANON, expectedSessionRevision: '7', initiatingSessionEtag: ANON_ETAG } })
  expect(evidence.verifies[0].match === ANON_ETAG).toBe(true)
  expect(evidence.verifies[0].match === CHALLENGE_ETAG).toBe(false)
  expect(evidence.posts.every(path => path.startsWith('/api/v9/'))).toBe(true)
  await assertNoSecrets(page)
})

test('create 응답 유실은 원 메모리 body/key/CSRF 그대로 명시 재생한다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseCreate = true; await load(page)
  expect(await requestCode(page)).toBe('rejected')
  const before = evidence.state.csrfReads
  expect(await retry(page)).toBe(true)
  expect(evidence.creates).toHaveLength(2)
  expect(JSON.stringify(evidence.creates[0]) === JSON.stringify(evidence.creates[1])).toBe(true)
  expect(evidence.state.csrfReads).toBe(before)
  await assertNoSecrets(page)
})

test('oldANON verify 응답 유실은 fresh CSRF 없이 같은 페이지 intent만 재생한다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true; await load(page); await requestCode(page)
  expect(await verifyCode(page)).toBeNull()
  expect(evidence.state.authenticated).toBe(false)
  const before = evidence.state.csrfReads
  expect(await retry(page)).toBe(true)
  expect(evidence.verifies).toHaveLength(2)
  expect(JSON.stringify(evidence.verifies[0]) === JSON.stringify(evidence.verifies[1])).toBe(true)
  expect(evidence.state.csrfReads).toBe(before + 1) // Only fresh AUTH post-success CSRF.
  await assertNoSecrets(page)
})

test('oldANON reload는 locator만으로 원 CSRF/새 key를 재생성하지 않는다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true; await load(page); await requestCode(page); await verifyCode(page)
  const before = evidence.posts.length
  await page.reload(); await load(page)
  expect(await retry(page)).toBe(false)
  expect(evidence.posts).toHaveLength(before)
  await assertNoSecrets(page)
})

test('freshAUTH reload 복구는 handoff 미검증 offer이며 code replay·claim을 자동 실행하지 않는다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true; evidence.state.freshAuthAfterLoss = true
  await load(page); await requestCode(page); await verifyCode(page)
  await page.reload(); await load(page)
  const before = evidence.posts.length
  const recovery = await page.evaluate(() => (window as TestWindow).emailAuth.recoverSession().then(value => ({ verification: value.verification, claimIntent: value.claimIntent })))
  expect(recovery).toEqual({ verification: 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED', claimIntent: { initiatingSessionId: ANON, expectedSessionRevision: '7', initiatingSessionEtag: ANON_ETAG } })
  expect(evidence.posts).toHaveLength(before)
  await assertNoSecrets(page)
})

for (const field of ['initiatingSessionId', 'initiatingSessionRevision', 'initiatingSessionEtag']) test(`challenge ${field} 불일치는 원 관측값으로 덮어써 성공시키지 않는다`, async ({ page }) => {
  const evidence = await setup(page); evidence.state.changedField = field; await load(page)
  expect(await requestCode(page)).toBe('rejected')
  expect(evidence.state.verifyCount).toBe(0)
})

for (const mode of ['other-owner', 'csrf', 'wrong-auth-readback']) test(`verify ${mode} 반례는 인증 offer를 만들지 않는다`, async ({ page }) => {
  const evidence = await setup(page); await load(page); await requestCode(page)
  if (mode === 'other-owner') evidence.state.owner = 'session_email_other_fixture_001'
  if (mode === 'csrf') evidence.state.rejectCsrf = true
  if (mode === 'wrong-auth-readback') evidence.state.wrongAuthReadback = true
  expect(await verifyCode(page)).toBeNull()
  await assertNoSecrets(page)
})

for (const delivery of ['UNKNOWN', 'FAILED']) test(`${delivery} 전달 상태는 인증·자동 재전송 근거가 아니다`, async ({ page }) => {
  const evidence = await setup(page); evidence.state.delivery = delivery; await load(page)
  await requestCode(page)
  expect(evidence.state.createCount).toBe(1)
  expect(evidence.state.verifyCount).toBe(0)
  expect(evidence.posts).toHaveLength(1)
  await assertNoSecrets(page)
})

test('pending verify 중 owner epoch 폐기는 늦은 성공을 인증 offer로 내보내지 않는다', async ({ page }) => {
  const evidence = await setup(page); await load(page); await requestCode(page)
  let release = () => {}
  evidence.state.holdVerify = () => new Promise<void>(resolve => { release = resolve })
  const result = verifyCode(page)
  await expect.poll(() => evidence.state.verifyCount).toBe(1)
  await page.evaluate(() => { (window as TestWindow).emailAuthActive = false })
  release()
  expect(await result).toBeNull()
})

for (const field of ['id', 'revision', 'expiry', 'auth-etag']) test(`verification ${field} 결속 불일치는 AUTH offer를 만들지 않는다`, async ({ page }) => {
  const evidence = await setup(page); await load(page); await requestCode(page)
  if (field === 'auth-etag') evidence.state.wrongAuthEtag = true
  else evidence.state.verificationField = field
  expect(await verifyCode(page)).toBeNull()
})

test('선행 미확정 create는 주소 변경이나 중복 클릭으로 새 key를 발급하지 않는다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseCreate = true; await load(page)
  await requestCode(page)
  expect(await requestCode(page)).toBe('rejected')
  expect(evidence.posts.length).toBe(1)
  expect(await retry(page)).toBe(true)
  expect(evidence.creates.length).toBe(2)
  expect(evidence.creates[0].key === evidence.creates[1].key).toBe(true)
})

test('저장소 실패는 메모리 로그인은 허용하지만 원문을 다른 저장소에 우회 저장하지 않는다', async ({ page }) => {
  await setup(page); await load(page)
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('fixture storage unavailable') } })
  expect(await requestCode(page)).toBe('received')
  expect((await verifyCode(page))?.verification).toBe('EMAIL_CODE_COOKIE_BOUND_SESSION_ROUND_TRIP')
  await assertNoSecrets(page)
})

test('검증된 CODE_INVALID 뒤에는 사용자가 코드를 수정해 별도 의도를 명시할 수 있다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.rejectCodeOnce = true; await load(page); await requestCode(page)
  expect(await verifyCode(page)).toBeNull()
  expect(evidence.verifies.length).toBe(1)
  expect((await verifyCode(page))?.verification).toBe('EMAIL_CODE_COOKIE_BOUND_SESSION_ROUND_TRIP')
  expect(evidence.verifies.length).toBe(2)
  expect(evidence.verifies[0].key !== evidence.verifies[1].key).toBe(true)
})

for (const code of ['MAIL_DISABLED', 'RATE_LIMITED']) test(`${code} 확정 오류는 자동 재시도 없이 명시 새 요청을 허용한다`, async ({ page }) => {
  const evidence = await setup(page); evidence.state.createError = code; await load(page)
  expect(await requestCode(page)).toBe('rejected')
  expect(evidence.creates.length).toBe(1)
  evidence.state.createError = ''
  expect(await requestCode(page)).toBe('received')
  expect(evidence.creates.length).toBe(2)
  expect(evidence.creates[0].key !== evidence.creates[1].key).toBe(true)
})
