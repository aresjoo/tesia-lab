import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import { openNativeAccountMenu } from './native-account-test-helpers'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import nativeFixture from './fixtures/native-service-contracts.json' with { type: 'json' }


// Fixed source9fb keeps Insights in the real account menu, outside the sidebar IA.
// Consume actual source controls; never replace service state, handlers or ports.
async function sourceInsightEntry(page: Page) {
  // Guest drawer order is login→settings; the desktop rail reverses it.
  // Choose the settings action itself, never the anonymous login action.
  const settings = page.locator('[data-sidebar-action="settings"]')
  const trigger = await settings.count() ? settings : page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]').first()
  if (!await trigger.isVisible()) {
    await revealSourceNavigation(page)
    await page.locator('.client-hamburger:visible, .client-rail-logo-row button:visible').first().click()
  }
  await trigger.click()
  const entry = page.locator('.ca-settings [data-menu-action="insight"]')
  await expect(entry).toBeVisible()
  return entry
}

async function openSourceMenu(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 860) await revealSourceNavigation(page)
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
}

test.use({ trace: 'off', video: 'off' })
test.setTimeout(20_000)
const ready = conversationFixture.snapshots.ready
const approval = { ...conversationFixture.documents.find(item => item.name === 'approval')!.value, strategyVersionId: 'sv_v03_11111111111111111111111111111111' }
const queued = nativeFixture.sources[3].fixture.cases![0].response
const sessionId = 'session_new_strategy_fixture_0001'
const nextId = 'conversation_new_strategy_fixture_0002'
const nextDraft = 'draft_new_strategy_fixture_0002'
const nextSnapshot = { ...conversationFixture.snapshots.blockedAfterReady, conversationId: nextId, draftId: nextDraft,
  draftState: { ...conversationFixture.snapshots.blockedAfterReady.draftState, draftId: nextDraft } }
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_new_strategy_fixture_0001', traceId: 'trace_new_strategy_fixture_0001', resourceRevision: revision })
async function setup(page: Page, withJob = false) {
  const controls = { holdJob: undefined as (() => Promise<void>) | undefined, jobReads: 0, creates: [] as string[], turns: [] as string[],
    failCreate: false, failTurn: false, submits: 0, otherWrites: 0 }
  // Synthetic SDK/browser responses only, not real authority or source data.
  await page.addInitScript(({ id, owner }) => {
    if (!sessionStorage.getItem('new-strategy-fixture-initialized')) {
      sessionStorage.setItem('new-strategy-fixture-initialized', '1')
      sessionStorage.setItem('tesia.native.conversation', id)
      sessionStorage.setItem('tesia.native.conversation-session', owner)
    }
  }, { id: ready.conversationId, owner: sessionId })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"new_strategy_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
    data: { sessionId, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_new_strategy_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname, create = request.method() === 'POST' && path === '/api/v3/conversations', turn = path.endsWith('/messages')
    if (create) { controls.creates.push(request.headers()['idempotency-key']); if (controls.failCreate) return route.abort('failed') }
    else if (turn) { controls.turns.push(request.headers()['idempotency-key']); if (controls.failTurn) return route.abort('failed') }
    else if (request.method() !== 'GET') { controls.otherWrites++; return route.abort('failed') }
    const snapshot = create || path.includes(nextId) ? nextSnapshot : ready
    return route.fulfill({ status: create ? 201 : 200, contentType: 'application/json', headers: { ETag: `"new_strategy_conversation_etag_000${snapshot.conversationStateRevision}"` }, body: JSON.stringify({ meta: meta('0.3.0', snapshot.conversationStateRevision),
      data: turn ? { ...conversationFixture.documents.find(item => item.name === 'turn')!.value, conversation: snapshot } : snapshot }) })
  })
  await page.route('**/api/v8/**', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"new_strategy_history_etag_0004"', 'cache-control': 'no-store' }, body: JSON.stringify({ meta: meta('0.8.0', '4'),
    data: { conversationId: ready.conversationId, snapshotRevision: '4', limit: 50, rows: [{ approval, job: withJob ? { ...queued.data, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash } : null }] } }) }))
  await page.route('**/api/v7/**', async route => {
    if (route.request().method() === 'POST') { controls.submits++; return route.abort('failed') }
    controls.jobReads++
    if (controls.holdJob) await controls.holdJob()
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"new_strategy_job_etag_0001"', 'cache-control': 'no-store' }, body: JSON.stringify({ ...queued,
      data: { ...queued.data, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash } }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await page.getByRole('button', { name: '이 대화의 실행 이력', exact: true }).click()
  await page.getByRole('button', { name: withJob ? '작업 보기' : '이 승인 버전 선택', exact: true }).click()
  await expect(page.getByText(`승인 버전: ${approval.strategyVersionId}`, { exact: true })).toBeVisible()
  return controls
}
const openConfirmation = async (page: Page) => {
  if (await page.getByRole('button', { name: '새 전략', exact: true }).isVisible()) await page.getByRole('button', { name: '새 전략', exact: true }).click()
  else {
    await openSourceMenu(page)
    await page.locator('.client-new-strategy').click()
  }
  await expect(page.getByRole('button', { name: '새 전략 시작', exact: true })).toBeVisible()
}

test('새 전략 전환 후 늦은 원 job poll이 홈에 결과/진행을 되살리지 않는다', async ({ page }) => {
  const controls = await setup(page, true)
  let release: () => void = () => undefined
  controls.holdJob = () => new Promise<void>(resolve => { release = resolve })
  await expect.poll(() => controls.jobReads).toBeGreaterThan(0)
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
  release()
  await expect(page.getByRole('region', { name: '백테스트 진행', exact: true })).toHaveCount(0)
  await expect(page.locator('textarea').first()).toBeEnabled()
  expect(controls.submits + controls.otherWrites + controls.creates.length + controls.turns.length).toBe(0)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBeNull()
})

test('같은 event에서 submit과 새 전략 확인이 겹쳐도 현재 초안과 미확정 journal을 보존한다', async ({ page }) => {
  const controls = await setup(page)
  await openConfirmation(page)
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
    buttons.find(button => button.textContent === '과거 데이터 백테스트 시작')!.click()
    buttons.find(button => button.textContent === '새 전략 시작')!.click()
  })
  await expect.poll(() => controls.submits).toBe(1)
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  await expect(page.locator('textarea').first()).toBeDisabled()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(ready.conversationId)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).not.toBeNull()
  expect(controls.creates).toHaveLength(0)
})

test('미확정 실행 때문에 새 전략 전환이 거절되면 연구 기록 화면과 기존 행을 유지한다', async ({ page }) => {
  const controls = await setup(page)
  await page.getByRole('button', { name: '과거 데이터 백테스트 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
  const entry = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  if (!await entry.isVisible()) await openSourceMenu(page)
  await entry.click()
  const scope = page.locator('.native-history-scope')
  await expect(scope).toBeVisible()
  const pending = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(scope).toBeVisible()
  await expect(page.locator('#research-main').getByRole('alert')).toContainText('확인하지 못한 요청을 먼저 재개하거나 이력에서 확인해주세요.')
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(pending)
  expect(controls.submits).toBe(1)
  expect(controls.creates).toHaveLength(0)
})

for (const failure of ['owner', 'storage'] as const) test(`새 전략 ${failure} 확인 실패도 열린 기록 화면과 기존 대화를 보존한다`, async ({ page }) => {
  const controls = await setup(page)
  const entry = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  if (!await entry.isVisible()) await openSourceMenu(page)
  await entry.click()
  await expect(page.locator('.native-history-scope')).toBeVisible()
  if (failure === 'owner') await page.route('**/api/v1/auth/session', route => route.abort('failed'))
  else await page.evaluate(() => {
    const remove = Storage.prototype.removeItem
    Storage.prototype.removeItem = function(key) {
      if (this === sessionStorage && key === 'tesia.native.conversation') throw new DOMException('Fixture denied', 'SecurityError')
      return remove.call(this, key)
    }
  })
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('#research-main').getByRole('alert')).toBeVisible()
  if (failure === 'storage') await expect(page.locator('[role="alert"]').filter({ hasText: '대화 위치를 저장하지 못해' })).toHaveCount(1)
  await expect(page.locator('.native-history-scope')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(ready.conversationId)
  expect(controls.submits + controls.otherWrites + controls.creates.length + controls.turns.length).toBe(0)
})

for (const activation of ['pointer', 'assistive'] as const) test(`새 전략 확인 중 ${activation}로 다른 화면으로 이동하면 늦은 성공이 그 화면을 닫지 않는다`, async ({ page }) => {
  const controls = await setup(page)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let reads = 0
  await page.route('**/api/v1/auth/session', async route => { reads++; await gate; await route.fallback() })
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  try {
    await expect.poll(() => reads).toBe(1)
    const entry = await sourceInsightEntry(page)
    if (activation === 'assistive') await entry.evaluate(element => (element as HTMLButtonElement).click())
    else await entry.click()
    await expect(page.locator('.client-insights[data-source="UNAVAILABLE"]')).toBeVisible()
    release()
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBeNull()
    await expect(page.locator('.client-insights[data-source="UNAVAILABLE"]')).toBeVisible()
    expect(controls.creates).toHaveLength(0)
  } finally { release() }
})

test('대화가 없는 홈에서 연 연구 기록도 새 전략으로 돌아오며 서버 대화를 생성하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('.landing-hero')).toBeVisible()
  const entry = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  if (!await entry.isVisible()) await openSourceMenu(page)
  await entry.click()
  await expect(page.locator('#research-main')).toBeVisible()
  const start = page.getByRole('button', { name: '새 전략', exact: true })
  if (await start.isVisible()) await start.click()
  else { await openSourceMenu(page); await page.locator('.client-new-strategy').click() }
  await expect(page.locator('#research-main')).toHaveCount(0)
  await expect(page.locator('.landing-hero')).toBeVisible()
  expect(controls.creates).toHaveLength(0)
})

test('전환 대기 중 후속 키 입력이 있어도 완료된 대화의 템플릿을 다음 질문에 섞지 않는다', async ({ page }) => {
  await setup(page)
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await page.locator('#strategy-idea').fill('원본 선택을 유지하는 전략')
  await page.locator('#strategy-idea').press('Enter')
  await expect(page.locator('.g-composer textarea')).toBeEnabled()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let reads = 0
  await page.route('**/api/v1/auth/session', async route => { reads++; await gate; await route.fallback() })
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  try {
    await expect.poll(() => reads).toBe(1)
    await page.locator('#tesia-main').press('Tab')
    release()
    await expect(gallery).toBeVisible()
    await expect(gallery.locator('[aria-pressed="true"]')).toHaveCount(0)
    await expect(page.locator('.client-template-selection .tchip')).toHaveCount(0)
  } finally { release() }
})

for (const failure of ['none', 'create', 'turn'] as const) test(`동일 로그인 새 대화 ${failure}: 명시 입력만 생성하고 reload는 원 create/turn key를 재개한다`, async ({ page }) => {
  const controls = await setup(page)
  await openConfirmation(page)
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('textarea').first()).toBeEnabled()
  expect(controls.creates).toHaveLength(0)
  controls.failCreate = failure === 'create'; controls.failTurn = failure === 'turn'
  await page.locator('textarea').first().fill('새 전략 fixture')
  await page.locator('textarea').first().press('Enter')
  if (failure !== 'none') {
    // Pending journal controls can already be visible while CREATE/TURN is
    // still running. Only enabled recovery observes the completed failure;
    // reloading sooner races the original in-flight TURN, not an auto retry.
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
    expect(controls.creates).toHaveLength(1)
    expect(controls.turns).toHaveLength(failure === 'turn' ? 1 : 0)
    const before = controls.creates.length + controls.turns.length
    await page.reload()
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeEnabled()
    expect(controls.creates.length + controls.turns.length).toBe(before)
    controls.failCreate = false; controls.failTurn = false
    await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  }
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
  expect(new Set(controls.creates).size).toBe(1)
  expect(new Set(controls.turns).size).toBe(1)
  expect(controls.creates).toHaveLength(failure === 'create' ? 2 : 1)
  expect(controls.turns).toHaveLength(failure === 'turn' ? 2 : 1)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation'))).toBe(nextId)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.conversation-session'))).toBe(sessionId)
  expect(controls.submits + controls.otherWrites).toBe(0)
})

test('미확정 logout 뒤 열린 새 전략 확인 버튼으로 새 대화를 시작하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await openConfirmation(page)
  await page.route('**/api/v1/auth/logout', route => route.abort('failed'))
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('heading', { name: '로그아웃 요청 확인', exact: true })).toBeVisible()
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-logout'))).toBe(journal)
  expect(controls.creates).toHaveLength(0)
})
