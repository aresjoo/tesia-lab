import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { openNativeAccountMenu } from './native-account-test-helpers'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

// Actual native entry/components and immutable API0.9 SDK, synthetic routes.
// This is not mail delivery or HttpOnly cookie authority proof. The original
// Web47 test-first checkpoint was RED on the missing email entry/controller.

async function openSourceMenu(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page)
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
test.setTimeout(30_000)
const ready = conversationFixture.snapshots.ready
const ANON = 'session_email_ui_anon_fixture_0001', AUTH = 'session_email_ui_auth_fixture_0001'
const ANON_ETAG = '"email_ui_anon_etag_fixture_0001"', AUTH_ETAG = '"email_ui_auth_etag_fixture_0001"'
const CHALLENGE = 'email_challenge_ui_fixture_000001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_email_ui_fixture_000001', traceId: 'trace_email_ui_fixture_000001', resourceRevision: revision })
const sessionData = (sessionId: string, state: string, revision: string) => ({ sessionId, state, revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' })

async function setup(page: Page) {
  const state = { owner: ANON, authenticated: false, absent: false, revision: '7', csrf: '', csrfReads: 0,
    loseVerify: false, authAfterLoss: false, delivery: 'ACCEPTED', rejectClaim: false, claimed: false,
    loseCreate: false, loseClaim: false, changeAfterCsrf: false, authEtag: AUTH_ETAG,
    holdVerify: undefined as (() => Promise<void>) | undefined }
  const posts: { path: string; key: string; csrf: string; match: string; body: unknown }[] = []
  await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
  // Only this existing conversation locator is seeded in a synthetic test page.
  // No server conversation, approval or cookie is created by this fixture.
  await page.addInitScript(({ id, owner }) => {
    if (!sessionStorage.getItem('email-ui-fixture-initialized')) {
      sessionStorage.setItem('email-ui-fixture-initialized', '1')
      sessionStorage.setItem('tesia.native.conversation', id)
      sessionStorage.setItem('tesia.native.conversation-session', owner)
    }
  }, { id: ready.conversationId, owner: ANON })
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    expect(url.search).toBe(''); expect(request.headers().authorization).toBeUndefined()
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    const respond = (status: number, version: string, revision: string | null, data: unknown) => route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, revision), data }) })
    const reject = (status: number, version: string, code: string) => route.fulfill({ status, headers, body: JSON.stringify({ meta: meta(version, null), error: { code, message: 'Authentication request failed.' } }) })
    if (request.method() === 'POST') posts.push({ path, key: request.headers()['idempotency-key'], csrf: request.headers()['x-csrf-token'], match: request.headers()['if-match'], body: request.postDataJSON() })
    if (path === '/api/v1/auth/session') {
      if (state.absent) return reject(401, '0.1.0', 'AUTHENTICATION_REQUIRED')
      headers.ETag = state.authenticated ? state.authEtag : ANON_ETAG
      return respond(200, '0.1.0', state.revision, sessionData(state.owner, state.authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', state.revision))
    }
    if (path === '/api/v1/auth/csrf') {
      state.csrf = `csrf_email_ui_fixture_rotation_${++state.csrfReads}`
      if (state.changeAfterCsrf) state.authEtag = '"email_ui_auth_changed_etag_0001"'
      return respond(200, '0.1.0', null, { csrfToken: state.csrf, expiresAt: '2030-01-01T12:00:00Z' })
    }
    if (path.startsWith('/api/v3/conversations/') && request.method() === 'GET') {
      if (state.authenticated && !state.claimed) return reject(404, '0.3.0', 'NOT_FOUND')
      headers.ETag = '"email_ui_conversation_etag_fixture_0001"'
      return respond(200, '0.3.0', ready.conversationStateRevision, ready)
    }
    if (path === '/api/v9/auth/email/challenges') {
      if (state.owner !== ANON || state.authenticated) return reject(401, '0.9.0', 'AUTHENTICATION_REQUIRED')
      if (request.headers()['x-csrf-token'] !== state.csrf) return reject(403, '0.9.0', 'CSRF_INVALID')
      if (state.loseCreate && posts.filter(post => post.path === path).length === 1) return route.abort()
      headers.ETag = '"email_ui_challenge_etag_fixture_0001"'
      return respond(201, '0.9.0', '7', { challengeId: CHALLENGE, initiatingSessionId: ANON, initiatingSessionRevision: '7', initiatingSessionEtag: ANON_ETAG,
        issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T00:05:00Z', resendAllowedAt: '2030-01-01T00:00:30Z', deliveryStatus: state.delivery })
    }
    if (path === `/api/v9/auth/email/challenges/${CHALLENGE}/verifications`) {
      if (state.owner !== ANON || state.authenticated) return reject(401, '0.9.0', 'AUTHENTICATION_REQUIRED')
      if (request.headers()['x-csrf-token'] !== state.csrf) return reject(403, '0.9.0', 'CSRF_INVALID')
      if (request.headers()['if-match'] !== ANON_ETAG) return reject(412, '0.9.0', 'PRECONDITION_FAILED')
      if (state.holdVerify) await state.holdVerify()
      if (!state.loseVerify || state.authAfterLoss) { state.absent = false; state.owner = AUTH; state.authenticated = true; state.revision = '1' }
      if (state.loseVerify) return route.abort()
      headers.ETag = AUTH_ETAG
      return respond(200, '0.9.0', '1', { challengeId: CHALLENGE, challengeExpiresAt: '2030-01-01T00:05:00Z', session: sessionData(AUTH, 'AUTHENTICATED', '1'),
        handoffReservation: { challengeId: CHALLENGE, initiatingSessionId: ANON, initiatingSessionRevision: '7', initiatingSessionEtag: ANON_ETAG, authenticatedSessionId: AUTH,
          state: 'RESERVED_FOR_CLAIM', expiresAt: '2030-01-01T12:00:00Z' } })
    }
    if (path === `/api/v1/anonymous-sessions/${ANON}/claim`) {
      if (state.owner !== AUTH || !state.authenticated) return reject(401, '0.1.0', 'AUTHENTICATION_REQUIRED')
      if (state.rejectClaim || request.headers()['if-match'] !== ANON_ETAG) return reject(412, '0.1.0', 'PRECONDITION_FAILED')
      if (request.headers()['x-csrf-token'] !== state.csrf) return reject(403, '0.1.0', 'CSRF_INVALID')
      if (state.loseClaim && posts.filter(post => post.path === path).length === 1) return route.abort()
      state.revision = '2'; state.claimed = true; headers.ETag = AUTH_ETAG
      return respond(200, '0.1.0', '2', { sessionId: AUTH, state: 'AUTHENTICATED', revision: '2', oldSessionRevoked: true,
        claimedResourceCounts: { conversations: 1, messages: 1, drafts: 1, patches: 0, validations: 0, idempotencyRecords: 0 } })
    }
    if (path === '/api/v1/auth/logout') {
      state.absent = true; headers.ETag = '"email_ui_revoked_etag_fixture_0001"'
      return respond(200, '0.1.0', '2', sessionData(AUTH, 'REVOKED', '2'))
    }
    return route.abort()
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  return { state, posts }
}
const panel = (page: Page) => page.getByRole('region', { name: '실제 계정 로그인', exact: true })
const form = (page: Page) => page.getByRole('form', { name: '이메일 로그인', exact: true })
const claimButton = (page: Page) => page.getByRole('button', { name: '로그인 전 전략 연결', exact: true })
async function openEmail(page: Page) {
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  if (!await panel(page).isVisible()) {
    const top = page.getByRole('button', { name: '로그인', exact: true }).first()
    if (await top.isVisible()) await top.click()
    else {
      const side = page.getByRole('button', { name: '사이드바 로그인', exact: true })
      if (!await side.isVisible()) await openSourceMenu(page)
      await side.click()
    }
  }
  if (await form(page).isVisible()) return // The same retained email controller.
  // Explicit missing entry assertion: RED cannot be a false-positive rejection.
  await expect(panel(page).getByRole('button', { name: '이메일로 로그인', exact: true })).toBeVisible({ timeout: 2_000 })
  await panel(page).getByRole('button', { name: '이메일로 로그인', exact: true }).click()
  await expect(form(page)).toBeVisible()
}
async function requestCode(page: Page) {
  await form(page).getByLabel('이메일 주소', { exact: true }).fill('Test+tag@example.invalid')
  await form(page).getByRole('button', { name: '계속', exact: true }).click()
}
async function verifyCode(page: Page) {
  await form(page).getByLabel('6자리 인증번호', { exact: true }).fill('000123')
  await form(page).getByRole('button', { name: '계속', exact: true }).click()
}
async function noRawStorage(page: Page) {
  expect(await page.evaluate(() => /Test\+tag|example\.invalid|000123|csrf_email_ui|COOKIE_BOUND_SESSION_ROUND_TRIP/.test(JSON.stringify({ ...sessionStorage, ...localStorage })))).toBe(false)
}
test('설정에서 시작한 이메일 로그인은 검증된 AUTH 뒤 일반으로 복귀하며 전략 claim을 자동 실행하지 않는다', async ({ page }) => {
  const evidence = await setup(page)
  await page.evaluate(() => { location.hash = '#/settings/general' })
  await expect(panel(page)).toBeVisible()
  await expect(page.locator('.client-settings-page')).toHaveCount(0)
  await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(page.locator('.client-settings-page h1')).toHaveText('일반')
  await expect(panel(page)).toHaveCount(0)
  expect(evidence.posts.map(post => post.path)).toEqual(['/api/v9/auth/email/challenges', `/api/v9/auth/email/challenges/${CHALLENGE}/verifications`])
  if (await page.locator('.stg-mback').isVisible()) await page.locator('.stg-mback').click()
  await page.getByRole('button', { name: '앱으로 돌아가기', exact: true }).click()
  await expect(claimButton(page)).toBeEnabled()
  await noRawStorage(page)
})
test('연구 문서와 대화 왕복은 이메일 인증 controller·입력·미확정 요청을 유지한다', async ({ page }) => {
  const evidence = await setup(page)
  await openEmail(page)
  evidence.state.loseCreate = true
  await requestCode(page)
  await expect(form(page).getByRole('button', { name: '이메일 주소 수정', exact: true })).toBeDisabled()
  const before = evidence.posts.length
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '대화 문서', exact: true }).click()
  await openEmail(page)
  await expect(form(page)).toBeVisible()
  await expect(form(page).getByRole('button', { name: '이메일 주소 수정', exact: true })).toBeDisabled()
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await openEmail(page)
  await expect(form(page)).toBeVisible()
  expect(evidence.posts).toHaveLength(before)
  expect(await form(page).count()).toBe(1)
  await noRawStorage(page)
})

test('locator만 남은 reload에서는 같은 live ANON 확인 뒤 명시 재입력으로 새 요청을 시작한다', async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page)
  await expect(form(page).getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  await page.reload(); await openEmail(page)
  const count = evidence.posts.length, csrfReads = evidence.state.csrfReads
  await form(page).getByRole('button', { name: '이메일 주소 수정', exact: true }).click({ timeout: 2_000 })
  await expect(form(page).getByLabel('이메일 주소', { exact: true })).toHaveValue('')
  await expect(form(page).getByRole('status')).toContainText('새 인증번호 요청')
  expect(evidence.posts.length).toBe(count); expect(evidence.state.csrfReads).toBe(csrfReads)
  await requestCode(page)
  await expect(form(page).getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  const creates = evidence.posts.filter(post => post.path === '/api/v9/auth/email/challenges')
  expect(creates.length).toBe(2); expect(creates[1].key !== creates[0].key).toBe(true)
  expect(creates[1].csrf !== creates[0].csrf).toBe(true)
  await noRawStorage(page)
})
for (const changed of ['other-anon', 'revoked'] as const) test(`locator reload의 새 요청은 ${changed} 세션에서 시작하지 않는다`, async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page)
  await expect(form(page).getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  await page.reload(); await openEmail(page)
  if (changed === 'revoked') evidence.state.absent = true
  else evidence.state.owner = 'session_email_ui_other_fixture_001'
  const count = evidence.posts.length, csrfReads = evidence.state.csrfReads
  await form(page).getByRole('button', { name: '이메일 주소 수정', exact: true }).click({ timeout: 2_000 })
  await expect(form(page).getByRole('alert')).toBeVisible()
  await expect(form(page).getByLabel('이메일 주소', { exact: true })).toHaveCount(0)
  expect(evidence.posts.length).toBe(count); expect(evidence.state.csrfReads).toBe(csrfReads)
  await noRawStorage(page)
})
test('메모리에 미확정 원 요청이 있으면 주소 수정으로 새 요청을 만들 수 없다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseCreate = true
  await openEmail(page); await requestCode(page)
  await expect(form(page).getByRole('alert')).toBeVisible()
  await expect(form(page).getByRole('button', { name: '이메일 주소 수정', exact: true })).toBeDisabled()
  expect(evidence.posts.length).toBe(1)
})
for (const withJournal of [false, true]) test(`verify headers 전체 유실 후 revoked ANON reload는 새 익명 세션을 자동 발급하지 않는다: journal ${withJournal}`, async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true
  await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(form(page).getByRole('alert')).toBeVisible()
  if (withJournal) {
    await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
    await page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true }).fill('레버리지 3배')
    await page.getByRole('button', { name: '메시지 보내기', exact: true }).click()
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  }
  const locators = await page.evaluate(() => ({ email: sessionStorage.getItem('tesia.native.email-intent'),
    conversation: sessionStorage.getItem('tesia.native.conversation'), owner: sessionStorage.getItem('tesia.native.conversation-session'), journal: sessionStorage.getItem('tesia.native.pending-command') }))
  expect(locators.journal !== null).toBe(withJournal)
  evidence.state.absent = true
  await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  expect(evidence.posts.filter(post => post.path === '/api/v1/anonymous-sessions').length).toBe(0)
  await expect(page.getByText('새 익명 세션을 자동 발급하지 않았습니다.', { exact: false })).toBeVisible()
  expect(evidence.posts.length).toBe(withJournal ? 3 : 2)
  expect(await page.evaluate(() => ({ email: sessionStorage.getItem('tesia.native.email-intent'),
    conversation: sessionStorage.getItem('tesia.native.conversation'), owner: sessionStorage.getItem('tesia.native.conversation-session'), journal: sessionStorage.getItem('tesia.native.pending-command') }))).toEqual(locators)
  await noRawStorage(page)
})
test('AUTH cookie 복구 때 기존 ANON 전략 journal을 자동 폐기하거나 새 owner에 재전송하지 않는다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true; evidence.state.authAfterLoss = true
  await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(form(page).getByRole('alert')).toBeVisible()
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true }).fill('레버리지 3배')
  await page.getByRole('button', { name: '메시지 보내기', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal !== null).toBe(true)
  await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(page.getByText('이메일 복구 중 세션이 달라 이전 미확정 전략 요청을 보존했습니다.', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(journal)
  expect(evidence.posts.length).toBe(3)
  expect(evidence.posts.some(post => post.path === '/api/v1/anonymous-sessions' || post.path.endsWith('/claim'))).toBe(false)
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeDisabled()
  await expect(page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true })).toBeDisabled()
  await expect(claimButton(page)).toHaveCount(0)
  await expect(await openNativeAccountMenu(page)).toBeVisible({ timeout: 1_000 })
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.', exact: true })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(journal)
  expect(evidence.posts.filter(post => post.path === '/api/v1/auth/logout').length).toBe(1)
  await noRawStorage(page)
})
test('명시 이메일 검증과 기존 claim은 별개이며 원 anonymous ETag로만 전략을 연결한다', async ({ page }, testInfo) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page)
  await expect(form(page).getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  if (process.env.TETH_EMAIL_AUTH_PROOF_ROOT) {
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.screenshot({ path: `${process.env.TETH_EMAIL_AUTH_PROOF_ROOT}/email-code-${testInfo.project.name}.png`, fullPage: true })
  }
  await verifyCode(page)
  await expect(claimButton(page)).toBeEnabled()
  expect(evidence.posts).toHaveLength(2)
  await claimButton(page).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  const claim = evidence.posts.at(-1)!
  expect(claim.path).toBe(`/api/v1/anonymous-sessions/${ANON}/claim`)
  expect(claim.body).toEqual({ expectedSessionRevision: '7' })
  // The route checked the fresh digest at dispatch; post-claim GET rotates it.
  expect(claim.match === ANON_ETAG && Boolean(claim.csrf) && claim.csrf !== evidence.posts[1].csrf).toBe(true)
  expect(evidence.posts).toHaveLength(3)
  await noRawStorage(page)
})

for (const freshAuth of [false, true]) test(`verify 응답 유실 뒤 reload: ${freshAuth ? 'fresh AUTH의 미확인 handoff 명시 claim' : 'old ANON의 원문/CSRF 자동 재생 금지'}`, async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true; evidence.state.authAfterLoss = freshAuth
  await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(form(page).getByRole('alert')).toBeVisible()
  await page.reload(); await openEmail(page)
  expect(evidence.posts).toHaveLength(2)
  await noRawStorage(page)
  if (freshAuth) {
    await form(page).getByRole('button', { name: '같은 로그인 요청 확인', exact: true }).click()
    await expect(claimButton(page)).toBeEnabled()
    await expect(form(page).getByRole('status')).toContainText('현재 인증 세션만 확인')
    expect(evidence.posts).toHaveLength(2)
    await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
    await claimButton(page).click()
    await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
    expect(evidence.posts).toHaveLength(3)
  } else {
    await expect(claimButton(page)).toHaveCount(0)
    await expect(form(page).getByLabel('6자리 인증번호', { exact: true })).toHaveCount(0)
    expect(evidence.posts).toHaveLength(2)
  }
})

test('UNKNOWN 전달 뒤 숨김·재열기는 인증 성공·자동 발송·숨김 focus를 만들지 않는다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.delivery = 'UNKNOWN'
  await openEmail(page); await requestCode(page)
  await expect(form(page).getByRole('status')).toContainText(/확인|불명/)
  await expect(form(page)).not.toContainText('메일 발송 완료')
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await expect(form(page)).toBeHidden()
  expect(await page.locator('.cs-native-login').evaluate(element => element.contains(document.activeElement))).toBe(false)
  await openEmail(page)
  // Same-owner memory inputs may survive a close; persistence and authentication
  // authority may not. Logout and changed-owner cases assert the separate fence.
  expect(evidence.posts).toHaveLength(1)
  await expect(claimButton(page)).toHaveCount(0)
  await noRawStorage(page)
})

test('인증 offer 뒤 다른 owner가 관측되면 claim·재승인·백테스트를 전송하지 않는다', async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(claimButton(page)).toBeEnabled()
  evidence.state.owner = 'session_email_ui_other_fixture_01'
  await claimButton(page).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(claimButton(page)).toHaveCount(0)
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toBeVisible()
  expect(evidence.posts).toHaveLength(2)
  await noRawStorage(page)
})

test('이메일 로그인 뒤 logout은 이전 입력·claim offer를 숨기며 인증 POST를 재생하지 않는다', async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(claimButton(page)).toBeEnabled()
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('heading', { name: '로그아웃 응답을 확인했습니다.', exact: true })).toBeVisible()
  await expect(claimButton(page)).toHaveCount(0)
  await expect(form(page)).toHaveCount(0)
  expect(evidence.posts.filter(post => post.path.startsWith('/api/v9/'))).toHaveLength(2)
  expect(evidence.posts.some(post => /claim|approve|backtests/.test(post.path))).toBe(false)
  await noRawStorage(page)
})

test('원 ANON이 public GET401인 headers 전체 유실도 원 메모리 verify만 명시 재생한다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true
  await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(form(page).getByRole('alert')).toBeVisible()
  evidence.state.absent = true; evidence.state.loseVerify = false
  await form(page).getByRole('button', { name: '같은 로그인 요청 확인', exact: true }).click()
  await expect(claimButton(page)).toBeEnabled()
  expect(evidence.posts.length).toBe(3)
  expect(JSON.stringify(evidence.posts[1]) === JSON.stringify(evidence.posts[2])).toBe(true)
  await noRawStorage(page)
})

test('같은 페이지 AUTH header 수신·body 유실은 verify 재POST 없이 명시 세션 복구한다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseVerify = true; evidence.state.authAfterLoss = true
  await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(form(page).getByRole('alert')).toBeVisible()
  await form(page).getByRole('button', { name: '같은 로그인 요청 확인', exact: true }).click()
  await expect(claimButton(page)).toBeEnabled()
  expect(evidence.posts.length).toBe(2)
  await expect(page.locator('[data-native-auth-notice][role="status"]').filter({ hasText: '현재 인증 세션만 확인' })).toHaveCount(1)
})

test('create 유실 뒤 패널 닫기·재열기는 원 요청을 보존하고 명시 같은 key로만 재생한다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseCreate = true
  await openEmail(page); await requestCode(page); await expect(form(page).getByRole('alert')).toBeVisible()
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await openEmail(page)
  expect(evidence.posts.length).toBe(1)
  await form(page).getByRole('button', { name: '같은 로그인 요청 확인', exact: true }).click()
  await expect(form(page).getByLabel('6자리 인증번호', { exact: true })).toBeVisible()
  expect(evidence.posts.length).toBe(2)
  expect(JSON.stringify(evidence.posts[0]) === JSON.stringify(evidence.posts[1])).toBe(true)
  await noRawStorage(page)
})

test('미확정 claim 재생은 신규 preflight로 원 CSRF/key/context를 바꾸지 않는다', async ({ page }) => {
  const evidence = await setup(page); evidence.state.loseClaim = true
  await openEmail(page); await requestCode(page); await verifyCode(page)
  await claimButton(page).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  const reads = evidence.state.csrfReads
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  expect(evidence.posts.length).toBe(4)
  expect(JSON.stringify(evidence.posts[2]) === JSON.stringify(evidence.posts[3])).toBe(true)
  expect(evidence.state.csrfReads).toBe(reads + 1) // Only the normal post-claim refresh.
})

test('claim preflight 중 AUTH ETag 교체는 원 anonymous ETag 대체 없이 POST 전에 차단한다', async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page); await verifyCode(page)
  await expect(claimButton(page)).toBeEnabled()
  evidence.state.changeAfterCsrf = true
  await claimButton(page).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(claimButton(page)).toHaveCount(0)
  expect(evidence.posts.length).toBe(2)
})

test('미확정 전략 journal이 있으면 이메일 인증 dispatch를 시작하지 않는다', async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page)
  await form(page).getByLabel('6자리 인증번호', { exact: true }).fill('000123')
  await panel(page).getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('textbox', { name: 'TETH에게 물어보세요', exact: true }).fill('레버리지 3배')
  await page.getByRole('button', { name: '메시지 보내기', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  await openEmail(page)
  await expect(panel(page)).toContainText('진행 중이거나 미확정인 전략 요청을 먼저 확인해주세요.')
  await expect(form(page).locator('button[type="submit"]')).toBeDisabled()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command') !== null)).toBe(true)
  expect(evidence.posts.filter(post => post.path.endsWith('/verifications')).length).toBe(0)
})

test('이메일 인증 dispatch 도중에는 새 전략 mutation을 보내 journal을 겹치지 않는다', async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page)
  let release = () => {}
  evidence.state.holdVerify = () => new Promise<void>(resolve => { release = resolve })
  await verifyCode(page)
  await expect.poll(() => evidence.posts.filter(post => post.path.endsWith('/verifications')).length).toBe(1)
  try {
    await expect(page.locator('.g-composer textarea')).toBeDisabled()
    expect(evidence.posts.some(post => post.path.startsWith('/api/v3/'))).toBe(false)
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
  } finally { release() }
  await expect(claimButton(page)).toBeEnabled()
})

test('부모 세션 복구로 email owner epoch가 폐기되면 늦은 verify 응답을 승격하지 않는다', async ({ page }) => {
  const evidence = await setup(page); await openEmail(page); await requestCode(page)
  let release = () => {}
  evidence.state.holdVerify = () => new Promise<void>(resolve => { release = resolve })
  const response = page.waitForResponse(value => new URL(value.url()).pathname.endsWith('/verifications'))
  await verifyCode(page)
  await expect.poll(() => evidence.posts.filter(post => post.path.endsWith('/verifications')).length).toBe(1)
  try {
    evidence.state.owner = 'session_email_ui_other_fixture_01'
    // Auth is modal. Exercise an out-of-band owner recovery rather than
    // pretending a user can click through the dialog's inert background.
    await page.getByRole('button', { name: '세션 다시 확인', exact: true, includeHidden: true }).evaluate(node => (node as HTMLButtonElement).click())
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(form(page)).toHaveCount(0)
  } finally { release() }
  await response
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
  await expect(claimButton(page)).toHaveCount(0)
  expect(evidence.posts.length).toBe(2)
  await noRawStorage(page)
})
