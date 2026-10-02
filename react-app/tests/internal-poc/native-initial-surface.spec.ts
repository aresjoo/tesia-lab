import { expect, test } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
const ready = fixture.snapshots.ready
const session = { sessionId: 'session_initial_surface_fixture_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
const meta = (revision: string | null, version = '0.1.0') => ({ apiContractVersion: version, requestId: 'req_initial_surface_fixture', traceId: 'trace_initial_surface_fixture', resourceRevision: revision })

for (const prior of ['fresh', 'conversation', 'logout', 'journal', 'email'] as const) test(`초기 ${prior}: 세션 확인은 질문 전송 연출이 아니며 원래 입력 동선을 유지한다`, async ({ page }) => {
  // Freeze only this synthetic waiting-state test, not the production deadline.
  // Slow CI assertions must not race the real bootstrap's five-second abort.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'))
  if (prior === 'email') await page.addInitScript(() => sessionStorage.setItem('tesia.native.email-intent', '{}'))
  if (prior === 'journal') await page.addInitScript(owner => {
    sessionStorage.setItem('tesia.native.pending-command', JSON.stringify({ version: 1, kind: 'CREATE_TURN', sessionId: owner, sessionState: 'ANONYMOUS', idempotencyKey: 'initial_surface_pending_fixture_0001', turnIdempotencyKey: 'initial_surface_turn_fixture_0001', clientMessageId: 'client_message_initial_surface_0001', message: '미확정 전략 질문' }))
  }, session.sessionId)
  if (prior === 'logout') await page.addInitScript(owner => {
    sessionStorage.setItem('tesia.native.pending-logout', JSON.stringify({ version: 1, kind: 'LOGOUT', sessionId: owner, sessionState: 'ANONYMOUS', idempotencyKey: 'initial_surface_logout_fixture_0001', ifMatch: '"initial_surface_session_fixture_0001"', expectedSessionRevision: '1' }))
  }, session.sessionId)
  if (prior === 'conversation') await page.addInitScript(({ id, owner }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
  }, { id: ready.conversationId, owner: session.sessionId })
  let release: () => void = () => undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  let issued = prior !== 'fresh' && prior !== 'email', reads = 0, creates = 0, business = 0
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const headers = { ETag: '"initial_surface_session_fixture_0001"' }
    if (path === '/api/v1/auth/session') {
      reads++
      await gate
      return route.fulfill({ status: issued ? 200 : 401, contentType: 'application/json', headers, body: JSON.stringify(issued ? { meta: meta('1'), data: session } : { meta: meta(null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session absent.' } }) })
    }
    if (path === '/api/v1/anonymous-sessions') {
      creates++; issued = true
      return route.fulfill({ status: 201, contentType: 'application/json', headers, body: JSON.stringify({ meta: meta('1'), data: session }) })
    }
    if (path === '/api/v1/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta(null), data: { csrfToken: 'csrf_initial_surface_fixture_0001', expiresAt: session.expiresAt } }) })
    if (prior === 'conversation' && path === `/api/v3/conversations/${ready.conversationId}` && route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"initial_surface_conversation_fixture_0001"' }, body: JSON.stringify({ meta: meta(ready.conversationStateRevision, '0.3.0'), data: ready }) })
    business++
    return route.abort()
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect.poll(() => reads).toBe(1)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'loading')
  await expect(page.getByText('요청을 보냈습니다. 응답이 도착하면 이 대화에 이어집니다.', { exact: true })).toHaveCount(0)
  await expect(page.locator('.client-session-loading')).toBeVisible()
  await expect(page.locator('.client-lab-conversation')).toHaveCount(0)
  const input = page.locator('#strategy-idea')
  if (prior === 'fresh') {
    await expect(input).toBeVisible()
    await expect(input).toBeDisabled()
    await expect(page.locator('.client-session-loading').locator('xpath=ancestor::*[@aria-busy="true"]')).toHaveCount(0)
    const original = await input.elementHandle()
    const menu = page.locator('.client-hamburger')
    if (await menu.isVisible()) await menu.click()
    else await page.locator('.client-rail-logo-row button').click()
    await page.getByRole('button', { name: 'TETH AI 홈', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await original!.evaluate(node => node.isConnected)).toBe(true)
  } else {
    await expect(input).toHaveCount(0)
    await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toHaveCount(0)
  }
  expect(creates + business).toBe(0)
  const original = prior === 'fresh' ? await input.elementHandle() : null
  release()
  await page.clock.resume()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', prior === 'email' ? 'error' : 'ready')
  await expect(page.locator('.client-session-loading')).toHaveCount(0)
  if (prior === 'fresh') {
    await expect(input).toBeEnabled()
    expect(await original!.evaluate(node => node.isConnected)).toBe(true)
    expect(creates).toBe(1)
  } else if (prior === 'conversation') {
    await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
    expect(creates).toBe(0)
  } else if (prior === 'logout') {
    await expect(page.getByRole('region', { name: '로그아웃 요청', exact: true })).toBeVisible()
    expect(creates).toBe(0)
  } else {
    await expect(page.getByRole('alert')).toBeVisible()
    if (prior === 'journal') await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
    else await expect(page.getByRole('alert')).toContainText('새 익명 세션을 자동 발급하지 않았습니다')
    expect(creates).toBe(0)
  }
  expect(business).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('첫 연결 실패와 명시적 재확인은 원본 홈 입력을 대화 화면으로 바꾸지 않는다', async ({ page }) => {
  let fail = true, creates = 0
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/session') return fail ? route.abort('failed') : route.fulfill({ contentType: 'application/json', headers: { ETag: '"initial_surface_session_fixture_0001"' }, body: JSON.stringify({ meta: meta('1'), data: session }) })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta(null), data: { csrfToken: 'csrf_initial_surface_fixture_0001', expiresAt: session.expiresAt } }) })
    creates++
    return route.abort()
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  const input = page.locator('#strategy-idea')
  await expect(input).toBeVisible()
  await expect(input).toBeDisabled()
  await expect(page.locator('.client-lab-conversation')).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('세션 또는 복구 저장소를 확인하지 못했습니다')
  const menu = page.locator('.client-hamburger')
  if (await menu.isVisible()) await menu.click()
  else await page.locator('.client-rail-logo-row button').click()
  await page.getByRole('button', { name: 'TETH AI 홈', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('세션 또는 복구 저장소를 확인하지 못했습니다')
  const original = await input.elementHandle()
  fail = false
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(input).toBeEnabled()
  expect(await original!.evaluate(node => node.isConnected)).toBe(true)
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(creates).toBe(0)
})
