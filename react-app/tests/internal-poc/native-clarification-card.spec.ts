import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

// Recorded, generated-SDK-compatible wire fixtures exercise the real native
// controller. These are UI assertions, not live model or execution evidence.
test.use({ trace: 'off', video: 'off', screenshot: 'off' })
test.setTimeout(30_000)
const blocked = fixture.snapshots.blockedAfterReady, ready = fixture.snapshots.ready
const question = blocked.nextQuestion
const turn = fixture.documents.find(item => item.name === 'turn')!.value
const owner = 'session_clarification_fixture_0001'
const draft = '손절은 2%로 하고 기존 입력은 유지해줘'
const etag = '"clarification_conversation_etag_0005"'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version,
  requestId: 'req_clarification_fixture_0001', traceId: 'trace_clarification_fixture_0001', resourceRevision: revision })
const card = (page: Page) => page.locator('.gclw')
const composer = (page: Page) => page.locator('.g-composer textarea')

const directInput = (page: Page) => card(page).locator('.op.free input')
async function writeDraft(page: Page, value: string) {
  if (!await directInput(page).count()) await card(page).getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  await directInput(page).fill(value)
}
async function setup(page: Page, mode: 'blocked' | 'ready' | 'home' = 'blocked', holdTurn = false) {
  let releaseGate!: () => void
  const gate = new Promise<void>(resolve => { releaseGate = resolve })
  const state = {
    snapshot: mode === 'ready' ? ready : blocked,
    holdTurn,
    failTurn: false,
    gets: [] as string[],
    posts: [] as { path: string; body: Record<string, unknown>; key?: string; match?: string }[],
    unexpected: [] as string[],
    release: () => { state.holdTurn = false; releaseGate() },
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ mode, owner, id }) => {
    if (sessionStorage.getItem('clarification-fixture-initialized')) return
    sessionStorage.setItem('clarification-fixture-initialized', '1')
    if (mode !== 'home') {
      sessionStorage.setItem('tesia.native.conversation', id)
      sessionStorage.setItem('tesia.native.conversation-session', owner)
    }
  }, { mode, owner, id: blocked.conversationId })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json',
    headers: { ETag: '"clarification_session_etag_0001"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'),
      data: { sessionId: owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_clarification_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v3/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'GET' && path === `/api/v3/conversations/${blocked.conversationId}`) {
      state.gets.push(path)
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: etag },
        body: JSON.stringify({ meta: meta('0.3.0', state.snapshot.conversationStateRevision), data: state.snapshot }) })
    }
    if (request.method() === 'POST' && path === `/api/v3/conversations/${blocked.conversationId}/messages`) {
      state.posts.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'], match: request.headers()['if-match'] })
      if (state.holdTurn) await gate
      if (state.failTurn) return route.abort('failed')
      // The recorded response still asks the SAME question. Its continued
      // presence is authoritative; a client-side "consumed" flag cannot hide it.
      state.snapshot = blocked
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { ETag: etag },
        body: JSON.stringify({ meta: meta('0.3.0', blocked.conversationStateRevision), data: turn }) })
    }
    state.unexpected.push(`${request.method()} ${path}`)
    return route.abort('failed')
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return state
}

async function expectQuestion(page: Page) {
  await expect(card(page)).toHaveCount(1)
  await expect(card(page).getByRole('heading', { name: question.prompt, exact: true })).toBeVisible()
  await expect(card(page).locator('.op:not(.direct-trigger):not(.free) b')).toHaveText(question.options)
  await expect(card(page).locator('.op:not(.direct-trigger):not(.free)')).toHaveCount(question.options.length)
  await expect(card(page).locator('.op span, .sub, .pg, .skipb')).toHaveCount(0)
  await expect(page.locator('.g-chiprow').filter({ has: page.getByRole('button', { name: question.options[0], exact: true }) })).toHaveCount(0)
}

test('서버 질문 닫기는 TURN 없이 같은 초안·입력 DOM·포커스를 복원한다', async ({ page }) => {
  const state = await setup(page)
  await expectQuestion(page)
  await writeDraft(page, draft)
  const input = await composer(page).elementHandle()
  await expect(composer(page)).toBeHidden()
  await expect(page.locator('.client-question-dock .gclw')).toBeVisible()
  await card(page).getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  await expect(composer(page)).toBeVisible()
  await expect(composer(page)).toBeFocused()
  await expect(composer(page)).toHaveValue(draft)
  expect(await input!.evaluate(el => el === document.querySelector('.g-composer textarea'))).toBe(true)
  expect(state.posts).toEqual([])
  expect(state.unexpected).toEqual([])
  await page.reload()
  await expectQuestion(page)
  expect(state.posts).toEqual([])
})

test('GET와 reload는 서버 nextQuestion의 prompt/options를 그대로 복원하고 임의 설명·진행률·skip을 만들지 않는다', async ({ page }) => {
  const state = await setup(page)
  await expectQuestion(page)
  await expect(card(page).getByRole('button', { name: '직접 답변 작성', exact: true })).toBeEnabled()
  expect(state.posts).toEqual([])
  const reads = state.gets.length
  await page.reload()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expectQuestion(page)
  expect(state.gets.length).toBeGreaterThan(reads)
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

test('실제 option의 동시 연속 클릭은 정확한 TURN 1개만 보내고 pending 카드를 숨긴다', async ({ page }) => {
  const state = await setup(page, 'blocked', true)
  await expectQuestion(page)
  await writeDraft(page, draft)
  try {
    await card(page).locator('.gcl-options').evaluate(element => {
      const options = element.querySelectorAll<HTMLButtonElement>('button')
      options[0].click(); options[0].click(); options[1].click()
    })
    await expect.poll(() => state.posts.length).toBe(1)
    await expect(card(page)).toHaveCount(0)
    await expect(composer(page)).toBeDisabled()
    expect(state.posts[0]).toMatchObject({ path: `/api/v3/conversations/${blocked.conversationId}/messages`, match: etag,
      body: { message: question.options[0], expectedConversationStateRevision: blocked.conversationStateRevision,
        expectedConversationStateHash: blocked.conversationStateHash } })
    expect(Object.keys(state.posts[0].body).sort()).toEqual(['clientMessageId', 'expectedConversationStateHash', 'expectedConversationStateRevision', 'message'])
    expect(state.posts[0].body.clientMessageId).toEqual(expect.any(String))
    expect(state.posts[0].key).toEqual(expect.any(String))
    expect(state.posts[0].key!.length).toBeGreaterThan(0)
  } finally { state.release() }
  await expect(composer(page)).toBeEnabled()
  await expectQuestion(page)
  await expect(composer(page)).toHaveValue(draft)
  await expect(page.locator('.g-umsg')).toHaveText(question.options[0])
  expect(state.posts).toHaveLength(1); expect(state.unexpected).toEqual([])
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
})

test('직접 답변은 작성 중 초안을 유지하고 focus만 옮기며 클릭만으로 TURN을 만들지 않는다', async ({ page }) => {
  const state = await setup(page)
  await expectQuestion(page)
  await writeDraft(page, draft)
  const reads = state.gets.length
  await expect(directInput(page)).toBeFocused()
  await expect(composer(page)).toHaveValue(draft)
  await expectQuestion(page)
  expect(state.posts).toEqual([]); expect(state.gets).toHaveLength(reads)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
})

test('직접 쓴 답변 전송 중 카드는 숨기고 같은 서버 질문이 반환되면 다시 표시한다', async ({ page }) => {
  const state = await setup(page, 'blocked', true)
  await expectQuestion(page)
  try {
    await writeDraft(page, draft)
    await directInput(page).press('Enter')
    await expect.poll(() => state.posts.length).toBe(1)
    expect(state.posts[0].body.message).toBe(draft)
    await expect(card(page)).toHaveCount(0)
    await expect(composer(page)).toBeDisabled()
    await expect(page.locator('.g-umsg')).toHaveText(draft)
  } finally { state.release() }
  await expect(composer(page)).toBeEnabled()
  await expect(composer(page)).toHaveValue('')
  await expectQuestion(page)
  expect(await page.locator('.g-amsg').allTextContents()).not.toContain(question.prompt)
  expect(state.posts).toHaveLength(1); expect(state.unexpected).toEqual([])
})

test('TURN 응답 실패의 pending journal은 질문 카드를 disabled로 유지하며 구형 칩으로 돌아가지 않는다', async ({ page }) => {
  const state = await setup(page)
  await expectQuestion(page)
  state.failTurn = true
  await card(page).getByRole('button', { name: question.options[0], exact: true }).click()
  const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await expect(resume).toBeVisible()
  await expect(page.getByRole('alert').filter({ hasText: 'REQUEST_UNCONFIRMED' })).toBeVisible()
  await expectQuestion(page)
  await expect(composer(page)).toBeDisabled()
  for (const button of await card(page).locator('button:not(.x)').all()) await expect(button).toBeDisabled()
  await expect(card(page).getByRole('button', { name: '질문 카드 닫기' })).toBeEnabled()
  await expect(page.locator('.g-thread .g-chiprow')).toHaveCount(0)
  // The retained report has its own What-if choices, not conversation replies.
  // They must remain hidden and disabled while this TURN is unconfirmed.
  const reportChoices = page.locator('.native-research-workspace .g-chiprow')
  await expect(reportChoices).toHaveCount(1)
  await expect(reportChoices).not.toBeVisible()
  await expect(reportChoices.getByRole('button', { includeHidden: true })).toHaveCount(3)
  for (const button of await reportChoices.getByRole('button', { includeHidden: true }).all()) await expect(button).toBeDisabled()
  expect(state.posts).toHaveLength(1)
  const sent = state.posts[0]
  const pending = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(pending).not.toBeNull()
  expect(JSON.parse(pending!).kind).toBe('TURN')
  expect(JSON.parse(pending!).body.message).toBe(question.options[0])
  await card(page).locator('.op').first().evaluate(node => (node as HTMLButtonElement).click())
  expect(state.posts).toHaveLength(1)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBe(pending)

  state.failTurn = false
  await resume.click()
  await expect(composer(page)).toBeEnabled()
  await expectQuestion(page)
  await expect(card(page).getByRole('button', { name: question.options[0], exact: true })).toBeEnabled()
  expect(state.posts).toHaveLength(2)
  expect(state.posts[1]).toEqual(sent)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))).toBeNull()
  expect(state.unexpected).toEqual([])
})

for (const mode of ['ready', 'home'] as const) test(`${mode}: 서버 질문이 없으면 Mock 확인 질문을 대신 만들지 않는다`, async ({ page }) => {
  const state = await setup(page, mode)
  await expect(card(page)).toHaveCount(0)
  await expect(page.locator('.gcl-badge, .gcl')).toHaveCount(0)
  for (const option of question.options) await expect(page.getByRole('button', { name: option, exact: true })).toHaveCount(0)
  if (mode === 'ready') {
    expect(ready.nextQuestion).toBeNull()
    await expect(page.getByRole('region', { name: '전략 요약', exact: true })).toBeVisible()
  } else await expect(page.locator('#strategy-idea')).toBeEnabled()
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})

for (const width of [320, 1440]) test(`${width}px: 서버 질문 카드와 선택 버튼이 가로 경계를 넘지 않고 조작 크기를 유지한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const state = await setup(page)
  await expectQuestion(page)
  await card(page).scrollIntoViewIfNeeded()
  expect(await card(page).evaluate(node => {
    const style = getComputedStyle(node)
    return { background: style.backgroundColor, border: style.borderTopWidth, radius: style.borderTopLeftRadius }
  })).toEqual({ background: 'rgb(47, 47, 47)', border: '1px', radius: '20px' })
  const bounds = await card(page).boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(-1)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
  expect(bounds!.width).toBeLessThanOrEqual(821)
  for (const button of await card(page).getByRole('button').all()) {
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
    expect(box!.x).toBeGreaterThanOrEqual(bounds!.x - 1)
    expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  expect(state.posts).toEqual([]); expect(state.unexpected).toEqual([])
})
