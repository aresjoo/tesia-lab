import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { openNativeAccountMenu } from './native-account-test-helpers'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { nativeObservationCopy, nativeObservationNavigationErrors, type ObservationNavigationError } from '../../src/internal-poc/native-observation-copy'
import type { ClientLanguage } from '../../src/client-preferences'

test.use({ trace: 'off', video: 'off' })
test.setTimeout(25_000)
const ready = fixture.snapshots.ready
const ownerId = 'session_previous_fixture_0001'
const nextId = 'conversation_previous_fixture_0002'
const next = { ...ready, conversationId: nextId, draftId: 'draft_previous_fixture_0002',
  draftState: { ...ready.draftState, draftId: 'draft_previous_fixture_0002' } }
const key = 'tesia.native.previous-conversation'
const activeKey = 'tesia.native.conversation'
const ownerKey = 'tesia.native.conversation-session'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_previous_fixture_0001', traceId: 'trace_previous_fixture_0001', resourceRevision: revision })
async function setup(page: Page, previous: unknown = null, active = true) {
  // Synthetic responses through the published SDK, not real server authority.
  const controls = { sessionId: ownerId, revision: '1', etag: '"previous_session_etag_0001"', absent: false, reads: [] as string[], writes: [] as string[],
    failure: 0, failNetwork: false, hold: undefined as (() => Promise<void>) | undefined, replaceAfterRead: false, revisionAfterRead: false }
  await page.addInitScript(({ previous, active, id, owner, key, activeKey, ownerKey }) => {
    if (sessionStorage.getItem('previous-fixture-initialized')) return
    sessionStorage.setItem('previous-fixture-initialized', '1')
    if (previous !== null) sessionStorage.setItem(key, JSON.stringify(previous))
    if (active) { sessionStorage.setItem(activeKey, id); sessionStorage.setItem(ownerKey, owner) }
  }, { previous, active, id: ready.conversationId, owner: ownerId, key, activeKey, ownerKey })
  await page.route('**/api/v1/auth/session', route => controls.absent
    ? route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic absent session' } }) })
    : route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: controls.etag }, body: JSON.stringify({ meta: meta('0.1.0', controls.revision),
      data: { sessionId: controls.sessionId, state: 'AUTHENTICATED', revision: controls.revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null),
    data: { csrfToken: 'csrf_previous_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, create = request.method() === 'POST' && path === '/api/v3/conversations'
    if (request.method() === 'GET') {
      controls.reads.push(path)
      if (controls.hold) await controls.hold()
      if (controls.failNetwork) return route.abort('failed')
      if (controls.failure) return route.fulfill({ status: controls.failure, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.3.0', null), error: {
        code: controls.failure === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: 'Synthetic denied conversation' } }) })
      if (controls.replaceAfterRead) controls.sessionId = 'session_previous_other_owner_0002'
      if (controls.revisionAfterRead) { controls.revision = '2'; controls.etag = '"previous_session_etag_0002"' }
    } else controls.writes.push(path)
    const snapshot = create || path.includes(nextId) ? next : ready
    const data = path.endsWith('/messages') ? { ...fixture.documents.find(item => item.name === 'turn')!.value, conversation: snapshot } : snapshot
    return route.fulfill({ status: create ? 201 : 200, contentType: 'application/json', headers: { ETag: '"previous_conversation_etag_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', snapshot.conversationStateRevision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  if (active) await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  else await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return controls
}
const restore = (page: Page) => page.getByRole('button', { name: '이전 대화 서버에서 다시 확인', exact: true })
async function checkLocalizedError(page: Page, key: ObservationNavigationError) {
  const locations = await locators(page)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as ClientLanguage[]) {
    await page.evaluate(language => {
      localStorage.setItem('tethLang', language)
      window.dispatchEvent(new StorageEvent('storage', { key: 'tethLang', newValue: language, storageArea: localStorage }))
    }, language)
    await expect(page.getByRole('region', { name: nativeObservationCopy[language].previousLabel, exact: true })).toBeVisible()
    await expect(page.locator('.client-service-recovery [role="alert"]')).toHaveText(nativeObservationNavigationErrors[language][key])
    expect(await locators(page)).toEqual(locations)
  }
}
test('이전 대화 안내의 7언어 변경은 locator·조회·쓰기와 버튼 초점을 보존한다', async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  const navigation = page.locator('.client-service-recovery').filter({ has: restore(page) })
  const button = navigation.locator('button')
  await button.focus()
  const before = await locators(page), reads = controls.reads.length
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as ClientLanguage[]) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const preferences = await import(/* @vite-ignore */ path)
      preferences.setClientPreference('language', language)
    }, language)
    // The region locator must not depend on its previous localized label.
    await expect(page.locator('.client-service-recovery button')).toHaveText(nativeObservationCopy[language].previousAction)
    await expect(page.locator('.client-service-recovery button')).toBeFocused()
    await expect(page.locator('.client-service-recovery')).toContainText(nativeObservationCopy[language].previousNote)
    await expect(page.getByRole('region', { name: nativeObservationCopy[language].previousLabel, exact: true })).toBeVisible()
    expect(await locators(page)).toEqual(before)
    expect(controls.reads).toHaveLength(reads)
    expect(controls.writes).toHaveLength(0)
  }
})
async function reset(page: Page) {
  const compact = page.locator('.client-rail-new-row button')
  if (await compact.isVisible()) await compact.click()
  else {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger').click()
    await page.locator('.client-new-strategy').click()
  }
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  // Confirmation closes at the real reset callback. Leave any resulting
  // storage/owner failure notice intact for the caller's original assertions.
  await expect(page.getByRole('button', { name: '새 전략 시작', exact: true })).toHaveCount(0)
}
const locators = (page: Page) => page.evaluate(({ key, activeKey, ownerKey }) => [sessionStorage.getItem(key), sessionStorage.getItem(activeKey), sessionStorage.getItem(ownerKey)], { key, activeKey, ownerKey })

test('새 전략→홈→reload는 이전 GET 없이 단1 locator만 보존하고 명시 복귀만 현재 초안을 읽는다', async ({ page }) => {
  const controls = await setup(page)
  await reset(page)
  await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
  await expect(restore(page)).toBeVisible()
  const saved = await locators(page)
  expect(JSON.parse(saved[0]!)).toEqual({ sessionId: ownerId, conversationId: ready.conversationId })
  expect(saved.slice(1)).toEqual([null, null])
  const before = controls.reads.length
  await page.reload()
  await expect(restore(page)).toBeVisible()
  expect(controls.reads).toHaveLength(before)
  await restore(page).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  expect(controls.reads).toHaveLength(before + 1)
  expect(controls.writes).toHaveLength(0)
  expect(await locators(page)).toEqual([null, ready.conversationId, ownerId])
  await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
})

test('새 B 대화에서 A 복귀는 현재 초안만 읽고 최근1개 B locator로 교대한다', async ({ page }) => {
  const controls = await setup(page)
  await reset(page); await expect(restore(page)).toBeVisible()
  await page.locator('textarea').first().fill('새 B 전략 fixture')
  await page.locator('textarea').first().press('Enter')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  await expect(page.locator('.g-title')).toHaveText('새 B 전략 fixture')
  await page.locator('.g-title').click()
  await page.locator('.g-title-input').fill('B에만 속하는 사용자 제목')
  await page.locator('.g-title-input').press('Enter')
  expect((await locators(page))[1]).toBe(nextId)
  const posts = controls.writes.length
  await restore(page).click()
  await expect.poll(async () => (await locators(page))[1]).toBe(ready.conversationId)
  await expect(page.locator('.g-title')).toHaveText('새 전략')
  expect(JSON.parse((await locators(page))[0]!)).toEqual({ sessionId: ownerId, conversationId: nextId })
  await restore(page).click()
  await expect.poll(async () => (await locators(page))[1]).toBe(nextId)
  await expect(page.locator('.g-title')).toHaveText('새 전략')
  expect(controls.writes).toHaveLength(posts)
})

for (const failure of ['set', 'readback', 'remove'] as const) test(`새 전략 storage ${failure} 실패는 현재 화면과 원 세 locator를 보존한다`, async ({ page }) => {
  await setup(page, { sessionId: ownerId, conversationId: nextId })
  const before = await locators(page)
  await page.evaluate(({ key, activeKey, failure }) => {
    const set = Storage.prototype.setItem, get = Storage.prototype.getItem, remove = Storage.prototype.removeItem
    let armed = true, written = false
    Storage.prototype.setItem = function (name, value) {
      if (armed && name === key && failure === 'set') { armed = false; throw new Error('synthetic storage failure') }
      set.call(this, name, value); if (name === key) written = true
    }
    Storage.prototype.getItem = function (name) {
      if (armed && written && name === key && failure === 'readback') { armed = false; return 'synthetic-mismatch' }
      return get.call(this, name)
    }
    Storage.prototype.removeItem = function (name) {
      if (armed && name === activeKey && failure === 'remove') { armed = false; throw new Error('synthetic storage failure') }
      remove.call(this, name)
    }
  }, { key, activeKey, failure })
  await reset(page)
  await expect(page.getByText('대화 위치를 저장하지 못해 전환하지 않았습니다.', { exact: false })).toBeVisible()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  expect(await locators(page)).toEqual(before)
  await checkLocalizedError(page, 'write')
})

for (const previous of [ { sessionId: 'session_other_0002', conversationId: nextId }, { sessionId: ownerId, conversationId: nextId, semanticHash: 'a'.repeat(64) },
  { sessionId: ownerId, conversationId: '../forbidden' }, { sessionId: ownerId, conversationId: 'x'.repeat(600) } ]) test(`다른 owner 또는 손상 locator는 노출·자동 조회하지 않는다: ${JSON.stringify(previous).slice(0, 80)}`, async ({ page }) => {
  const controls = await setup(page, previous)
  await expect(restore(page)).toHaveCount(0)
  expect(controls.reads).toEqual([`/api/v3/conversations/${ready.conversationId}`])
  expect(controls.writes).toHaveLength(0)
})

for (const boundary of ['before', 'after', 'revision', 'absent'] as const) test(`복귀 ${boundary} session 변경은 이전 draft를 복원하지 않는다`, async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  if (boundary === 'before') controls.sessionId = 'session_previous_other_owner_0002'
  if (boundary === 'after') controls.replaceAfterRead = true
  if (boundary === 'revision') controls.revisionAfterRead = true
  if (boundary === 'absent') controls.absent = true
  const before = controls.reads.length
  await restore(page).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(restore(page)).toHaveCount(0)
  expect((await locators(page))[1]).toBe(ready.conversationId)
  expect(controls.reads).toHaveLength(before + (boundary === 'after' || boundary === 'revision' ? 1 : 0))
  expect(controls.writes).toHaveLength(0)
})

for (const failure of [403, 404, 0]) test(`복귀 GET ${failure || 'network'} 실패는 원 초안과 locator를 보존하고 명시 재시도한다`, async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  const before = await locators(page)
  controls.failure = failure; controls.failNetwork = failure === 0
  await restore(page).click()
  await expect(restore(page)).toBeEnabled()
  expect(await locators(page)).toEqual(before)
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  controls.failure = 0; controls.failNetwork = false
  await restore(page).click()
  await expect.poll(async () => (await locators(page))[1]).toBe(nextId)
  expect(controls.writes).toHaveLength(0)
})

test('중복 복귀와 세션 재확인은 진행 중 GET과 직렬화되어 서로 다른 화면에 응답을 적용하지 않는다', async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  let release: () => void = () => undefined
  controls.hold = () => new Promise<void>(resolve => { release = resolve })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent === '이전 대화 서버에서 다시 확인')!
    button.click(); button.click()
  })
  await expect.poll(() => controls.reads.length).toBe(2)
  await expect(restore(page)).toBeDisabled()
  // Refresh uses the same synchronous run guard, so this click is a no-op.
  controls.hold = undefined
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  release()
  await expect.poll(async () => (await locators(page))[1]).toBe(nextId)
  // Refresh is serialized by run: it cannot race a navigation in progress.
  expect(controls.reads).toHaveLength(2)
  expect(controls.writes).toHaveLength(0)
})

test('미확정 TURN journal 중 이전 대화 버튼은 비활성이고 원 bytes를 보존한다', async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  await page.route('**/api/v3/conversations/*/messages', route => route.abort('failed'))
  await page.locator('textarea').first().fill('명시 수정 fixture')
  await page.locator('textarea').first().press('Enter')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  const raw = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  await expect(restore(page)).toBeDisabled()
  await restore(page).evaluate(button => (button as HTMLButtonElement).click())
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(raw)
  expect(controls.reads).toHaveLength(1)
})

test('미확정 logout 중 이전 대화는 숨기고 원 locator는 다른 세션으로 전송하지 않는다', async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  const before = await locators(page)
  await page.route('**/api/v1/auth/logout', route => route.abort('failed'))
  await revealSourceNavigation(page)
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('heading', { name: '로그아웃 요청 확인', exact: true })).toBeVisible()
  await expect(restore(page)).toHaveCount(0)
  expect(await locators(page)).toEqual(before)
  expect(controls.reads).toHaveLength(1)
})

test('대화 GET이 거절되면서 session도 교체되면 이전 계정 화면을 무효화한다', async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  await page.route(`**/api/v3/conversations/${nextId}`, route => {
    controls.sessionId = 'session_previous_other_owner_0002'
    return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.3.0', null), error: { code: 'FORBIDDEN', message: 'Synthetic owner changed' } }) })
  })
  await restore(page).click()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toHaveCount(0)
  await expect(restore(page)).toHaveCount(0)
  expect((await locators(page))[1]).toBe(ready.conversationId)
})

for (const action of ['new', 'restore'] as const) test(`storage read 접근 실패 때 ${action} 전환은 현재 화면·세 locator를 유지한다`, async ({ page }) => {
  await setup(page, { sessionId: ownerId, conversationId: nextId })
  const before = await locators(page)
  await page.evaluate(key => {
    const get = Storage.prototype.getItem
    let armed = true
    Storage.prototype.getItem = function (name) {
      if (armed && name === key) { armed = false; throw new Error('synthetic read unavailable') }
      return get.call(this, name)
    }
  }, key)
  if (action === 'new') await reset(page)
  else await restore(page).click()
  await expect(page.getByText('대화 위치를 저장하지 못해 전환하지 않았습니다.', { exact: false })).toBeVisible()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  expect(await locators(page)).toEqual(before)
})

test('부분 저장 뒤 rollback도 막히면 화면 유지와 영속성 미확인을 명확히 구분한다', async ({ page }) => {
  await setup(page, { sessionId: ownerId, conversationId: nextId })
  await page.evaluate(({ key, activeKey }) => {
    const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem
    let writes = 0
    Storage.prototype.setItem = function (name, value) {
      if (name === key && ++writes > 1) throw new Error('synthetic rollback unavailable')
      set.call(this, name, value)
    }
    Storage.prototype.removeItem = function (name) {
      if (name === activeKey) throw new Error('synthetic partial mutation unavailable')
      remove.call(this, name)
    }
  }, { key, activeKey })
  await reset(page)
  await expect(page.getByText('저장소 복구를 확인하지 못해 화면 전환을 중단했습니다.', { exact: false })).toBeVisible()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  expect((await locators(page))[1]).toBe(ready.conversationId)
  await checkLocalizedError(page, 'rollback')
})

test('이전 위치 저장소 read 오류도 선택한 언어로 표시하고 자동 조회하지 않는다', async ({ page }) => {
  const controls = await setup(page, { sessionId: ownerId, conversationId: nextId })
  await page.evaluate(key => {
    const get = Storage.prototype.getItem
    let armed = true
    Storage.prototype.getItem = function (name) {
      if (armed && name === key) { armed = false; throw new Error('synthetic locator read failure') }
      return get.call(this, name)
    }
  }, key)
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.locator('.client-service-recovery [role="alert"]')).toHaveText(nativeObservationNavigationErrors.ko.read)
  const reads = controls.reads.length
  await checkLocalizedError(page, 'read')
  expect(controls.reads).toHaveLength(reads)
  expect(controls.writes).toHaveLength(0)
})
