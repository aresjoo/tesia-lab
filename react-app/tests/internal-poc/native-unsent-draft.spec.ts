import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { composeTemplatePrompt } from '../../src/client-home-gallery'


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

test.use({ trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(30_000)
const ready = fixture.snapshots.ready
const owner = 'session_unsent_fixture_0001'
const journalKey = 'tesia.native.pending-command'
const draft = '레버리지 3배로 바꾸고 위험을 다시 확인해줘'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_unsent_fixture_0001', traceId: 'trace_unsent_fixture_0001', resourceRevision: revision })
async function setup(page: Page, home: boolean, createSucceeds = false, authenticated = true, quickReplies = false) {
  const snapshot = quickReplies ? fixture.snapshots.blockedAfterReady : ready
  const writes: { path: string; key: string | undefined }[] = []
  await page.addInitScript(({ home, owner, id }) => {
    if (!home) { sessionStorage.setItem('tesia.native.conversation', id); sessionStorage.setItem('tesia.native.conversation-session', owner) }
  }, { home, owner, id: ready.conversationId })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"unsent_session_etag_0001"' }, body: JSON.stringify({
    meta: meta('0.1.0', '1'), data: { sessionId: owner, state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
    meta: meta('0.1.0', null), data: { csrfToken: 'csrf_unsent_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v3/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') {
      writes.push({ path, key: request.headers()['idempotency-key'] })
      if (!createSucceeds || path !== '/api/v3/conversations') return route.abort('failed')
    }
    return route.fulfill({ status: request.method() === 'POST' ? 201 : 200, contentType: 'application/json', headers: { ETag: '"unsent_conversation_etag_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', snapshot.conversationStateRevision), data: snapshot }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  if (!home && !quickReplies) {
    const close = page.getByRole('button', { name: '질문 카드 닫기', exact: true })
    if (await close.isVisible()) await close.click()
    await expect(page.locator('.g-composer textarea')).toBeVisible()
  }
  return writes
}

async function breakJournal(page: Page, mode: 'set' | 'readback' | 'second-write') {
  await page.evaluate(({ mode, key }) => {
    const set = Storage.prototype.setItem, get = Storage.prototype.getItem
    let count = 0, armed = false
    Object.defineProperty(window, '__restoreUnsentJournalFixture', { value: () => { Storage.prototype.setItem = set; Storage.prototype.getItem = get }, configurable: true })
    Storage.prototype.setItem = function (name, value) {
      if (name === key) {
        count++
        if (mode === 'set' || (mode === 'second-write' && count >= 2)) throw new DOMException('Synthetic denied write', 'SecurityError')
        set.call(this, name, value)
        if (mode === 'readback') armed = true
        return
      }
      return set.call(this, name, value)
    }
    Storage.prototype.getItem = function (name) {
      if (name === key && armed) throw new DOMException('Synthetic denied readback', 'SecurityError')
      return get.call(this, name)
    }
  }, { mode, key: journalKey })
}
async function restoreJournal(page: Page) {
  await page.evaluate(() => (window as unknown as Window & { __restoreUnsentJournalFixture: () => void }).__restoreUnsentJournalFixture())
}
const input = (page: Page) => page.locator('textarea').first()
async function fillSourceDraft(page: Page, value: string) {
  if (await input(page).isVisible()) { await input(page).fill(value); return }
  // The source question card and hidden composer share the same controlled draft.
  const card = page.locator('.client-question-panel .client-market-question')
  await card.locator('.direct-trigger').click()
  await card.locator('.op.free input').fill(value)
  await expect(input(page)).toHaveValue(value)
}


test('홈 질문 전송 대기 중 대화로 이어지며 템플릿 조작과 합성된 journal 변경을 막는다', async ({ page }) => {
  await setup(page, true)
  let release = () => {}
  const held = new Promise<void>(resolve => { release = resolve })
  const sent: string[] = []
  await page.route('**/api/v3/conversations', async route => {
    sent.push(route.request().method())
    await held
    await route.abort('failed')
  })
  const gallery = page.locator('.client-home-gallery')
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await input(page).fill(draft)
  await input(page).press('Enter')
  await expect.poll(() => sent.length).toBe(1)
  try {
    await expect(input(page)).toBeDisabled()
    // The submitted question now enters the conversation immediately. Home
    // controls are unmounted, not editable behind the pending request.
    await expect(gallery).toHaveCount(0)
    await expect(page.locator('.client-template-selection')).toHaveCount(0)
    await expect(page.locator('.g-umsg')).toHaveText(draft)
    await expect(page.locator('.g-act2:not(.fin)')).toHaveCount(1)
    await expect(page.locator('.g-act2.fin')).toHaveCount(0)
    const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), journalKey)
    expect(saved.message).toBe(composeTemplatePrompt({ acts: ['auto'], assets: [] }, draft))
    expect(sent).toEqual(['POST'])
  } finally { release() }
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
})

for (const source of ['quick-reply', 'composer'] as const) for (const identical of [false, true]) {
  test(`${source} 성공은 ${identical ? '같은' : '다른'} 문구의 작성란을 출처에 맞게 보존하거나 비운다`, async ({ page }) => {
    await setup(page, false, false, true, true)
    const reply = fixture.snapshots.blockedAfterReady.nextQuestion.options[0]
    const typed = identical ? reply : draft
    const sent: string[] = []
    await page.route('**/api/v3/conversations/*/messages', route => {
      sent.push(route.request().postDataJSON().message)
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"unsent_conversation_etag_0005"' }, body: JSON.stringify({
        meta: meta('0.3.0', fixture.snapshots.blockedAfterReady.conversationStateRevision), data: fixture.documents.find(item => item.name === 'turn')!.value,
      }) })
    })
    await fillSourceDraft(page, typed)
    if (source === 'quick-reply') await page.getByRole('button', { name: reply, exact: true }).click()
    else {
      await page.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
      await input(page).press('Enter')
    }
    await expect.poll(() => sent.length).toBe(1)
    await expect(page.locator('.g-umsg')).toContainText(source === 'quick-reply' ? reply : typed)
    await expect(input(page)).toBeEnabled()
    await expect(input(page)).toHaveValue(source === 'quick-reply' ? typed : '')
    expect(sent).toEqual([source === 'quick-reply' ? reply : typed])
    expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBeNull()
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
  })
}

for (const failure of ['set', 'readback'] as const) {
  test(`작성 중 초안과 다른 빠른 답변의 journal ${failure} 실패는 초안을 덮어쓰지 않는다`, async ({ page }) => {
    const writes = await setup(page, false, false, true, true)
    const reply = fixture.snapshots.blockedAfterReady.nextQuestion.options[0]
    await fillSourceDraft(page, draft)
    await breakJournal(page, failure)
    await page.getByRole('button', { name: reply, exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: '이번 질문을 서버로 전송하지 않았습니다' })).toBeVisible()
    await expect(input(page)).toHaveValue(draft)
    await expect(input(page)).toBeEnabled()
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
    await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
    expect(writes).toEqual([])
    await restoreJournal(page)
    const saved = await page.evaluate(key => sessionStorage.getItem(key), journalKey)
    if (failure === 'set') expect(saved).toBeNull()
    else expect(JSON.parse(saved!).body.message).toBe(reply)
  })

  test(`템플릿 없는 기존 질문의 journal ${failure} 실패는 검증 결과와 승인 확인 선택도 보존한다`, async ({ page }) => {
    const writes = await setup(page, false)
    const approvalRequests: string[] = []
    await page.route('**/api/v3/strategy-drafts/**', route => {
      const path = new URL(route.request().url()).pathname
      approvalRequests.push(path)
      const challenge = path.endsWith('/approval-challenges')
      return route.fulfill({ status: challenge ? 201 : 200, contentType: 'application/json', headers: { ETag: '"unsent_conversation_etag_0004"' }, body: JSON.stringify({
        meta: meta('0.3.0', ready.conversationStateRevision), data: challenge ? fixture.approvalAuthority.challenge : fixture.approvalAuthority.receipt,
      }) })
    })
    await page.getByRole('button', { name: '전략 검증', exact: true }).click()
    await page.getByRole('button', { name: '승인 내용 확인', exact: true }).click()
    const acknowledgement = page.getByRole('checkbox')
    await acknowledgement.check()
    await expect(page.getByRole('button', { name: '이 전략 버전 승인', exact: true })).toBeEnabled()
    const before = [...approvalRequests]
    expect(before).toHaveLength(2)
    await input(page).fill(draft)
    await breakJournal(page, failure)
    await input(page).press('Enter')
    await expect(page.getByRole('alert')).toContainText('이번 질문을 서버로 전송하지 않았습니다')
    await expect(input(page)).toHaveValue(draft)
    await expect(acknowledgement).toBeChecked()
    await expect(page.getByText(/^검증 완료 · 만료:/)).toBeVisible()
    await expect(page.getByRole('button', { name: '이 전략 버전 승인', exact: true })).toBeEnabled()
    await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
    expect(approvalRequests).toEqual(before)
    expect(writes).toEqual([])
  })
}

for (const recovery of ['recover', 'reload'] as const) {
  test(`readback 실패 후 ${recovery}는 남은 journal을 보수적으로 복원하고 자동 전송하지 않는다`, async ({ page }) => {
    const writes = await setup(page, false, false, true, true)
    const reply = fixture.snapshots.blockedAfterReady.nextQuestion.options[0]
    await fillSourceDraft(page, draft)
    await breakJournal(page, 'readback')
    await page.getByRole('button', { name: reply, exact: true }).click()
    await expect(input(page)).toHaveValue(draft)
    await expect(page.getByRole('alert').filter({ hasText: '이번 질문을 서버로 전송하지 않았습니다' })).toBeVisible()
    await restoreJournal(page)
    const saved = await page.evaluate(key => sessionStorage.getItem(key), journalKey)
    if (recovery === 'reload') await page.reload()
    else await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: '확인하지 못한 요청이 있습니다' })).toBeVisible()
    await expect(input(page)).toHaveValue('')
    await expect(input(page)).toBeDisabled()
    expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBe(saved)
    expect(writes).toEqual([])
  })
}

for (const home of [true, false]) for (const failure of ['set', 'readback'] as const) {
  test(`${home ? '첫 질문' : '기존 대화'} journal ${failure} 실패는 미전송 입력을 보존하고 전송 전 실패로 구분한다`, async ({ page }) => {
    const writes = await setup(page, home)
    await input(page).fill(draft)
    await breakJournal(page, failure)
    await input(page).press('Enter')
    await expect(page.getByRole('alert')).toContainText('이번 질문을 서버로 전송하지 않았습니다')
    await expect(page.getByRole('alert')).not.toContainText('REQUEST_UNCONFIRMED')
    await expect(input(page)).toHaveValue(draft)
    await expect(input(page)).toBeEnabled()
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
    expect(writes).toEqual([])
    await restoreJournal(page)
    const saved = await page.evaluate(key => sessionStorage.getItem(key), journalKey)
    // A failed readback can still leave bytes. Never claim or force their deletion.
    expect(saved === null).toBe(failure === 'set')
    await input(page).press('Enter')
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
    await expect(input(page)).toHaveValue('')
    expect(writes).toHaveLength(1)
    const pending = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), journalKey)
    expect(pending.kind === 'CREATE_TURN' ? pending.message : pending.body.message).toBe(draft)
  })
}

test('네트워크 전송 후 실패는 입력으로 되돌리지 않고 기존 동일 요청만 재개한다', async ({ page }) => {
  const writes = await setup(page, false)
  await input(page).fill(draft); await input(page).press('Enter')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('REQUEST_UNCONFIRMED')
  await expect(page.getByRole('alert')).not.toContainText('서버로 전송하지 않았습니다')
  await expect(input(page)).toHaveValue('')
  await expect(input(page)).toBeDisabled()
  const original = await page.evaluate(key => sessionStorage.getItem(key), journalKey)
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[1]).toEqual(writes[0])
  expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBe(original)
})

test('서버 대화 생성 뒤 후속 journal 실패는 이미 보낸 CREATE를 미전송으로 잘못 표시하지 않는다', async ({ page }) => {
  const writes = await setup(page, true, true)
  await input(page).fill(draft)
  await breakJournal(page, 'second-write')
  await input(page).press('Enter')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('REQUEST_UNCONFIRMED')
  await expect(page.getByRole('alert')).not.toContainText('서버로 전송하지 않았습니다')
  await expect(input(page)).toHaveValue('')
  expect(writes).toHaveLength(1)
  expect(writes[0].path).toBe('/api/v3/conversations')
  await restoreJournal(page)
  const pending = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), journalKey)
  expect(pending.kind).toBe('CREATE_TURN')
  expect(pending.message).toBe(draft)
})

for (const failure of ['set', 'readback'] as const) for (const recover of [false, true]) {
test(`첫 질문 ${failure} 실패 뒤 ${recover ? '세션 확인 후' : '직접'} 재전송은 원문과 선택 칩을 보존한다`, async ({ page }) => {
  const writes = await setup(page, true)
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await input(page).fill(draft)
  await breakJournal(page, failure)
  await input(page).press('Enter')
  const combined = composeTemplatePrompt({ acts: ['auto'], assets: ['btc'] }, draft)
  await expect(page.getByRole('alert')).toContainText('이번 질문을 서버로 전송하지 않았습니다')
  await expect(input(page)).toHaveValue(draft)
  await expect(gallery).toBeVisible()
  await expect(page.getByRole('button', { name: 'AI가 대신 거래 선택 해제', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'BTC 선택 해제', exact: true })).toBeVisible()
  expect(writes).toEqual([])
  await restoreJournal(page)
  const stored = await page.evaluate(key => sessionStorage.getItem(key), journalKey)
  if (recover && failure === 'set') await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  // Failed readback may already have saved the command. Session recovery
  // must retain that exact request and offer explicit same-key continuation.
  if (recover && failure === 'readback') {
    await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
    await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
    expect(writes).toEqual([])
    expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBe(stored)
    await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
    await expect.poll(() => writes.length).toBe(1)
    const pending = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), journalKey)
    expect(pending.message).toBe(combined)
    expect(pending.idempotencyKey).toBe(JSON.parse(stored!).idempotencyKey)
    expect(writes[0].key).toBe(pending.idempotencyKey)
    await expect(page.locator('.g-umsg')).toHaveText(combined)
    return
  }
  await expect(gallery).toBeVisible()
  await expect(input(page)).toHaveValue(draft)
  await expect(gallery.locator('[aria-pressed="true"]')).toHaveCount(2)
  expect(writes).toEqual([])
  await input(page).press('Enter')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  const pending = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), journalKey)
  expect(pending.message).toBe(combined)
  if (stored) expect(pending.idempotencyKey).not.toBe(JSON.parse(stored).idempotencyKey)
  expect(writes[0].key).toBe(pending.idempotencyKey)
  await expect(page.locator('.g-umsg')).toHaveText(draft)
  expect(writes).toHaveLength(1)
})
}

test('readback 실패 뒤 reload는 저장된 정확한 합성 요청만 명시적으로 재개한다', async ({ page }) => {
  const writes = await setup(page, true)
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'BTC', exact: true }).click()
  await input(page).fill(draft)
  await breakJournal(page, 'readback')
  await input(page).press('Enter')
  await expect(page.getByRole('alert')).toContainText('저장소에 이번 요청이 남아 있을 수')
  await restoreJournal(page)
  const stored = await page.evaluate(key => sessionStorage.getItem(key), journalKey)
  expect(writes).toEqual([])
  await page.reload()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  expect(writes).toEqual([])
  expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBe(stored)
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  expect(writes[0].key).toBe(JSON.parse(stored!).idempotencyKey)
  await expect(page.locator('.g-umsg')).toHaveText(composeTemplatePrompt({ acts: [], assets: ['btc'] }, draft))
})

test('세션 변경 경고는 미전송 홈 오류로 축소하지 않고 기존 복구 화면을 유지한다', async ({ page }) => {
  const writes = await setup(page, true)
  await input(page).fill(draft)
  await breakJournal(page, 'set')
  await input(page).press('Enter')
  await expect(page.getByRole('alert')).toContainText('서버로 전송하지 않았습니다')
  await restoreJournal(page)
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"unsent_session_etag_0002"' }, body: JSON.stringify({
    meta: meta('0.1.0', '1'), data: { sessionId: 'session_changed_fixture_0002', state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.getByRole('button', { name: '세션 다시 확인', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('세션이 변경되어')
  await expect(page.locator('.client-service-app')).toHaveClass(/view-briefing/)
  await expect(page.locator('.client-home-input-issue')).toHaveCount(0)
  await expect(input(page)).toHaveValue('')
  expect(writes).toEqual([])
})

for (const viewport of [{ width: 320, height: 720 }, { width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test(`미전송 오류 ${viewport.width}px는 같은 홈 입력 DOM과 공백·줄바꿈·선택 칩을 유지한다`, async ({ page }, info) => {
    await page.setViewportSize(viewport)
    const writes = await setup(page, true)
    const raw = `  ${draft}\n첫 진입은 천천히 확인할게요.  `
    await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'BTC', exact: true }).click()
    await input(page).fill(raw)
    const node = await input(page).elementHandle()
    await breakJournal(page, 'set')
    await input(page).press('Enter')
    await expect(page.getByRole('alert')).toContainText('서버로 전송하지 않았습니다')
    await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
    await expect(input(page)).toHaveValue(raw)
    expect(await node!.evaluate(element => element === document.querySelector('textarea'))).toBe(true)
    await expect(page.getByRole('button', { name: 'BTC 선택 해제', exact: true })).toBeVisible()
    await expect(page.locator('.g-umsg')).toHaveCount(0)
    expect(writes).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.locator('.client-home-input-issue').scrollIntoViewIfNeeded()
    const issue = await page.locator('.client-home-input-issue').boundingBox()
    const editor = await input(page).boundingBox()
    const pill = await page.locator('.client-home-pill').boundingBox()
    expect(issue!.y + issue!.height).toBeLessThanOrEqual(editor!.y)
    expect(Math.abs(issue!.x - pill!.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(issue!.width - pill!.width)).toBeLessThanOrEqual(1)
    const recover = page.getByRole('button', { name: '세션 다시 확인', exact: true })
    expect((await recover.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await recover.focus()
    await expect(recover).toBeFocused()
    await page.screenshot({ path: info.outputPath(`intake-error-${viewport.width}.png`) })
    // Short landscape uses the source's scrollable layout, not a fixed panel
    // that traps the editor below the viewport.
    await input(page).scrollIntoViewIfNeeded()
    await expect(input(page)).toBeInViewport()
    await input(page).click()
    await expect(input(page)).toBeFocused()
    await expect(input(page)).toHaveValue(raw)
    if (viewport.height < 500) await page.screenshot({ path: info.outputPath('intake-error-landscape-editor.png') })
  })
}

test('문장 없이 선택 칩만 보낸 요청도 전송 전 실패 뒤 그대로 재전송된다', async ({ page }) => {
  const writes = await setup(page, true)
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'BTC', exact: true }).click()
  await breakJournal(page, 'set')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('서버로 전송하지 않았습니다')
  await expect(input(page)).toHaveValue('')
  await expect(page.getByRole('button', { name: 'BTC 선택 해제', exact: true })).toBeVisible()
  expect(writes).toEqual([])
  await restoreJournal(page)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  const pending = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), journalKey)
  expect(pending.message).toBe(composeTemplatePrompt({ acts: [], assets: ['btc'] }))
  expect(writes).toHaveLength(1)
})

test('로그인 패널만 열었다 닫으면 미전송 원문과 선택을 바꾸거나 자동 전송하지 않는다', async ({ page }) => {
  const writes = await setup(page, true, false, false)
  await page.getByRole('region', { name: '투자 템플릿' }).getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await input(page).fill(draft)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  const login = page.getByRole('region', { name: '실제 계정 로그인', exact: true })
  await expect(login).toBeVisible()
  await login.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('region', { name: '투자 템플릿' })).toBeVisible()
  await expect(input(page)).toHaveValue(draft)
  await expect(page.getByRole('button', { name: 'AI가 대신 거래 선택 해제' })).toBeVisible()
  expect(writes).toEqual([])
  expect(await page.evaluate(key => sessionStorage.getItem(key), journalKey)).toBeNull()
})

for (const surface of ['home', 'insights'] as const) test(`${surface} 로그인은 현재 화면 위에 열리고 배경·초안·닫기 초점을 보존한다`, async ({ page }) => {
  const writes = await setup(page, true, false, false)
  await input(page).fill(draft)
  if (surface === 'insights') {
    await (await sourceInsightEntry(page)).click()
    await expect(page.locator('.client-insights')).toBeVisible()
  }
  let trigger = page.getByRole('button', { name: '로그인', exact: true }).first()
  if (!await trigger.isVisible()) {
    trigger = page.getByRole('button', { name: '사이드바 로그인', exact: true })
    if (!await trigger.isVisible()) await openSourceMenu(page)
  }
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '로그인', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('region', { name: '실제 계정 로그인', exact: true })).toBeVisible()
  await expect(page.locator(surface === 'home' ? '.landing-hero' : '.client-insights')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect(writes).toEqual([])
  if (surface === 'insights') await page.locator('.client-insights').getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(input(page)).toHaveValue(draft)
})

test('거래소 메뉴는 원본 화면을 열고 현재 질문과 실행 이력을 유지한다', async ({ page }) => {
  const writes = await setup(page, true)
  const historyRequests: string[] = []
  page.on('request', request => { if (request.url().includes('/history')) historyRequests.push(request.url()) })
  await input(page).fill(draft)
  // Navigation restores the source UI, not an account-connection operation.
  for (const label of [sourceSidebarNavigationLabel('ko', 'brokers')]) {
    const item = page.locator('.client-sidebar').getByRole('button', { name: label, exact: true })
    if (!await item.isVisible()) await openSourceMenu(page)
    await item.click()
    await expect(page.locator('.native-brokers .bk2-card')).toHaveCount(21)
    await page.locator('.native-brokers').getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
    await expect(input(page)).toHaveValue(draft)
  }
  expect(writes).toEqual([])
  expect(historyRequests).toEqual([])
})
