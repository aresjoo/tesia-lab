import { expect, test, type Page } from '@playwright/test'
import { openNativeAccountMenu } from './native-account-test-helpers'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

test.use({ trace: 'off', video: 'off' })
test.setTimeout(25_000)
const ready = fixture.snapshots.ready, ownerId = 'session_composer_fixture_0001'
const text = '레버리지 3배'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_composer_fixture_0001', traceId: 'trace_composer_fixture_0001', resourceRevision: revision })
async function setup(page: Page, home = false) {
  // Synthetic wire, real SDK. No text storage or server authority is supplied.
  const controls = { owner: ownerId, state: 'AUTHENTICATED', revision: '1', failSession: false, failDraft: false, posts: 0, reads: 0,
    afterDraftOwner: '', hold: undefined as (() => Promise<void>) | undefined, changedDraft: false }
  await page.addInitScript(({ home, owner, id }) => {
    if (sessionStorage.getItem('composer-fixture-initialized')) return
    sessionStorage.setItem('composer-fixture-initialized', '1')
    if (!home) { sessionStorage.setItem('tesia.native.conversation', id); sessionStorage.setItem('tesia.native.conversation-session', owner) }
  }, { home, owner: ownerId, id: ready.conversationId })
  await page.route('**/api/v1/auth/session', route => {
    if (controls.failSession) return route.abort('failed')
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: `"composer_session_etag_000${controls.revision}"` }, body: JSON.stringify({ meta: meta('0.1.0', controls.revision),
      data: { sessionId: controls.owner, state: controls.state, revision: controls.revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
  })
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null),
    data: { csrfToken: 'csrf_composer_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', async route => {
    if (route.request().method() !== 'GET') { controls.posts++; return route.abort('failed') }
    controls.reads++
    if (controls.hold) await controls.hold()
    if (controls.failDraft) return route.abort('failed')
    if (controls.afterDraftOwner) controls.owner = controls.afterDraftOwner
    const data = controls.changedDraft ? { ...ready, conversationStateRevision: '5', conversationStateHash: 'a'.repeat(64), draftRevision: '3', projectionHash: 'b'.repeat(64), semanticHash: 'c'.repeat(64),
      draftState: { ...ready.draftState, revision: 3, projectionHash: 'b'.repeat(64), projection: { ...ready.draftState.projection, execution: { ...ready.draftState.projection.execution, leverage: 3 } } } } : ready
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"composer_conversation_etag_0004"' }, body: JSON.stringify({ meta: meta('0.3.0', data.conversationStateRevision), data }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return controls
}
const input = (page: Page) => page.locator('textarea').first()
const recover = (page: Page) => page.getByRole('button', { name: '세션 다시 확인', exact: true })
const phase = (page: Page, value: string) => expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', value)
const storage = (page: Page) => page.evaluate(() => Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index)!).map(key => [key, sessionStorage.getItem(key)])))
async function recoverAfterLocalFailure(page: Page, controls: { posts: number }) {
  if (!await recover(page).isVisible()) {
    // Healthy source UI deliberately has no unconditional recovery button.
    // Exercise the real pre-dispatch journal failure instead: no request was
    // sent, and this remains an unsent draft, not an uncertain TURN journal.
    const before = await storage(page), draft = await input(page).inputValue(), posts = controls.posts
    expect(draft).not.toBe('')
    expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      let failures = 0
      Storage.prototype.setItem = function (key, value) {
        if (this === sessionStorage && key === 'tesia.native.pending-command' && failures === 0) {
          failures++
          throw new DOMException('Explicit composer journal write fixture', 'QuotaExceededError')
        }
        return original.call(this, key, value)
      }
      Reflect.set(window, '__restoreComposerStorage', () => { Storage.prototype.setItem = original; return failures })
    })
    let failures: number
    try {
      await input(page).press('Enter')
      await expect(recover(page)).toBeVisible()
      await expect(input(page)).toHaveValue(draft)
      expect(controls.posts).toBe(posts)
      expect(await storage(page)).toEqual(before)
      expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
    } finally {
      failures = await page.evaluate(() => {
        const count = Reflect.get(window, '__restoreComposerStorage')()
        Reflect.deleteProperty(window, '__restoreComposerStorage')
        return count
      })
    }
    expect(failures).toBe(1)
  }
  await recover(page).click()
}

test('전송 전 기록 실패 뒤 같은 세션·대화 재확인은 미전송 문장을 보존하고 POST/storage text0이다', async ({ page }) => {
  const controls = await setup(page), before = await storage(page)
  await input(page).fill(text)
  await recoverAfterLocalFailure(page, controls)
  await phase(page, 'ready')
  await expect(input(page)).toHaveValue(text)
  expect(await storage(page)).toEqual(before)
  expect(controls.posts).toBe(0)
})

for (const failure of ['session', 'draft'] as const) test(`전송 전 기록 실패와 ${failure} 네트워크 오류 뒤 원 메모리 입력은 숨겨 보관하고 동일 owner 복구 후 돌아온다`, async ({ page }) => {
  const controls = await setup(page), before = await storage(page)
  await input(page).fill(text)
  controls.failSession = failure === 'session'; controls.failDraft = failure === 'draft'
  await recoverAfterLocalFailure(page, controls)
  await phase(page, 'error')
  await expect(input(page)).toHaveValue('')
  await expect(page.getByText('전송하지 않은 입력은 이 화면의 메모리에 임시 보관했습니다.', { exact: false })).toBeVisible()
  controls.failSession = false; controls.failDraft = false
  await recover(page).click()
  await phase(page, 'ready')
  await expect(input(page)).toHaveValue(text)
  expect(await storage(page)).toEqual(before)
  expect(controls.posts).toBe(0)
})

for (const boundary of ['owner-before', 'state-before', 'owner-after'] as const) test(`전송 전 기록 실패 뒤 ${boundary} 변경은 원 미전송 문장을 노출하지 않는다`, async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text)
  if (boundary === 'owner-before') controls.owner = 'session_composer_other_owner_0002'
  if (boundary === 'state-before') controls.state = 'ANONYMOUS'
  if (boundary === 'owner-after') controls.afterDraftOwner = 'session_composer_other_owner_0002'
  await recoverAfterLocalFailure(page, controls)
  await phase(page, boundary === 'owner-after' ? 'error' : 'ready')
  await expect(input(page)).toHaveValue('')
  expect(controls.posts).toBe(0)
  expect(JSON.stringify(await storage(page))).not.toContain(text)
})

test('전송 전 기록 실패 뒤 서버 현재 초안 revision이 바뀌어도 입력은 미전송 상태로만 복원한다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text); controls.changedDraft = true
  await recoverAfterLocalFailure(page, controls); await phase(page, 'ready')
  await expect(input(page)).toHaveValue(text)
  await expect(page.getByText('BTCUSDT · 15m · 3배', { exact: true })).toBeVisible()
  expect(controls.posts).toBe(0)
  await expect(page.getByText(/^승인 버전:/)).toHaveCount(0)
})

test('전송 전 기록 실패 후 페이지 reload는 메모리 문장의 영속 복구를 약속하지 않으며 서버 초안만 복원한다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text); controls.failSession = true
  await recoverAfterLocalFailure(page, controls); await phase(page, 'error')
  controls.failSession = false
  await page.reload(); await phase(page, 'ready')
  await expect(input(page)).toHaveValue('')
  expect(controls.posts).toBe(0)
  expect(JSON.stringify(await storage(page))).not.toContain(text)
})

test('새 전략으로 명시 전환한 뒤 이전 대화 복귀는 미전송 문장을 옮기지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text)
  await revealSourceNavigation(page)
  if (await page.getByRole('button', { name: '새 전략', exact: true }).isVisible()) await page.getByRole('button', { name: '새 전략', exact: true }).click()
  else { await page.getByRole('button', { name: '메뉴', exact: true }).click(); await page.getByRole('button', { name: '＋ 새 전략', exact: true }).click() }
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('.client-service-app')).toHaveClass(/view-landing/)
  // Explicit reset dismisses its confirmation. Returning to a server draft
  // must not depend on a second, nonexistent dismissal action.
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await page.getByRole('button', { name: '이전 대화 서버에서 다시 확인', exact: true }).click()
  await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  await expect(input(page)).toHaveValue('')
  expect(controls.posts).toBe(0)
})

test('전송 전 기록 실패 후 복구 중 중립 화면은 이전 입력을 노출하지 않고 제거된 입력의 늦은 이벤트를 무시한다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text)
  const original = await input(page).elementHandle()
  expect(original).not.toBeNull()
  let release: () => void = () => undefined
  controls.hold = () => new Promise<void>(resolve => { release = resolve })
  await recoverAfterLocalFailure(page, controls)
  await expect.poll(() => controls.reads).toBe(2)
  try {
    await expect(input(page)).toHaveCount(0)
    expect(await original!.evaluate(element => element.isConnected)).toBe(false)
    // A queued event on the removed textarea must not alter the retained
    // same-owner buffer or expose an editable input before recovery finishes.
    await original!.evaluate(element => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
      setter.call(element, '새로 작성한 문장')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(input(page)).toHaveCount(0)
    expect(JSON.stringify(await storage(page))).not.toContain(text)
    expect(JSON.stringify(await storage(page))).not.toContain('새로 작성한 문장')
    expect(controls.posts).toBe(0)
  } finally { release() }
  await phase(page, 'ready')
  await expect(input(page)).toHaveValue(text)
  await expect(input(page)).toBeEnabled()
  expect(controls.reads).toBe(2)
  expect(controls.posts).toBe(0)
})

test('이미 보낸 미확정 TURN은 미전송 편집값으로 재분류하거나 journal을 덮지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text); await input(page).press('Enter')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  const raw = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  await recover(page).click(); await phase(page, 'ready')
  await expect(input(page)).toHaveValue('')
  await expect(input(page)).toBeDisabled()
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(raw)
  expect(controls.posts).toBe(1)
})

test('로그아웃의 명시 경계에서 원 미전송 입력은 새 계정용으로 복원하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text)
  await page.route('**/api/v1/auth/logout', route => route.abort('failed'))
  await revealSourceNavigation(page)
  await (await openNativeAccountMenu(page)).click()
  await expect(page.getByRole('heading', { name: '로그아웃 요청 확인', exact: true })).toBeVisible()
  await recover(page).click(); await phase(page, 'ready')
  await expect(input(page)).toHaveValue('')
  await expect(page.getByText('전송하지 않은 입력은 이 화면의 메모리에 임시 보관했습니다.', { exact: false })).toHaveCount(0)
  expect(JSON.stringify(await storage(page))).not.toContain(text)
  expect(controls.posts).toBe(0)
})

test('전송 전 기록 실패 뒤 복구 대상 conversation이 달라지면 이전 문장은 새 초안에 옮기지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await input(page).fill(text)
  const differentId = 'conversation_composer_other_draft_0002'
  await page.evaluate(id => sessionStorage.setItem('tesia.native.conversation', id), differentId)
  await page.route(`**/api/v3/conversations/${differentId}`, route => route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: '"composer_other_conversation_etag_0004"' },
    body: JSON.stringify({ meta: meta('0.3.0', ready.conversationStateRevision), data: { ...ready, conversationId: differentId } }) }))
  await recoverAfterLocalFailure(page, controls); await phase(page, 'ready')
  await expect(input(page)).toHaveValue('')
  expect(controls.posts).toBe(0)
  expect(JSON.stringify(await storage(page))).not.toContain(text)
})
