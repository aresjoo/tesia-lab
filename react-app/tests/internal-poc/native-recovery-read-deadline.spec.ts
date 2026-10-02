import { expect, test } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
const ready = fixture.snapshots.ready
const owner = 'session_recovery_deadline_0001'
const meta = (revision: string | null, version = '0.1.0') => ({ apiContractVersion: version, requestId: 'req_recovery_deadline_0001', traceId: 'trace_recovery_deadline_0001', resourceRevision: revision })

for (const pending of [false, true]) test(`대화 조회 만료 후 기록을 보존하며 명시 재확인한다 · pending=${pending}`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'))
  const command = pending ? JSON.stringify({ version: 1, kind: 'VALIDATE', sessionId: owner, sessionState: 'ANONYMOUS', idempotencyKey: 'read_timeout_validation_fixture_0001', conversationId: ready.conversationId, draftId: ready.draftId, ifMatch: '"deadline_conversation_fixture_0001"', body: { expectedConversationStateRevision: ready.conversationStateRevision, expectedConversationStateHash: ready.conversationStateHash } }) : null
  await page.addInitScript(({ id, owner, command }) => {
    sessionStorage.setItem('tesia.native.conversation', id)
    sessionStorage.setItem('tesia.native.conversation-session', owner)
    if (command) sessionStorage.setItem('tesia.native.pending-command', command)
  }, { id: ready.conversationId, owner, command })
  let reads = 0, writes = 0, release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/**', async route => {
    if (route.request().method() !== 'GET') { writes++; return route.abort() }
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"deadline_session_fixture_0001"' }, body: JSON.stringify({ meta: meta('1'), data: { sessionId: owner, state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta(null), data: { csrfToken: 'csrf_recovery_deadline_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
    if (path === `/api/v3/conversations/${ready.conversationId}`) {
      const current = ++reads
      if (current === 1) await gate
      // The first route is deliberately fulfilled after browser cancellation.
      await route.fulfill({ contentType: 'application/json', headers: { ETag: '"deadline_conversation_fixture_0001"' }, body: JSON.stringify({ meta: meta(ready.conversationStateRevision, '0.3.0'), data: ready }) }).catch(error => { if (current !== 1) throw error })
      return
    }
    return route.abort()
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect.poll(() => reads).toBe(1)
  await expect(page.locator('.client-session-restoring')).toBeVisible()
  await page.clock.runFor(29_999)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'loading')
  await page.clock.runFor(1)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(page.getByRole('alert')).toContainText('서버 상태를 삭제하지 않았습니다')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(command)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(ready.conversationId)
  expect(writes).toBe(0)
  await page.clock.resume()
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  release()
  if (pending) {
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(command)
  } else await expect(page.getByRole('alert')).toHaveCount(0)
  expect(reads).toBe(2)
  expect(writes).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
