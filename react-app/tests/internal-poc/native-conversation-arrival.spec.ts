import { expect, test, type Page } from '@playwright/test'
import fixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }
import { composeTemplatePrompt } from '../../src/client-home-gallery'

// Delayed synthetic wire responses through the real native controller/SDK.
// These assertions concern arrival continuity, not a live model or execution.
test.use({ trace: 'off', video: 'off' })
const question = '비트코인 조건을 확인해줘'
const ready = fixture.snapshots.ready
const turn = fixture.documents.find(item => item.name === 'turn')!.value
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'req_arrival_fixture_0001', traceId: 'trace_arrival_fixture_0001', resourceRevision: revision })
async function setup(page: Page, motion: 'reduce' | 'no-preference' = 'reduce') {
  let releaseCreate!: () => void, releaseTurn!: () => void
  const createGate = new Promise<void>(resolve => { releaseCreate = resolve })
  const turnGate = new Promise<void>(resolve => { releaseTurn = resolve })
  const state = { holdCreate: true, holdTurn: true, failTurn: false, releaseCreate, releaseTurn,
    posts: [] as { path: string; key?: string; body: unknown }[] }
  await page.emulateMedia({ reducedMotion: motion })
  await page.route('**/api/v1/auth/session', route => route.fulfill({ contentType: 'application/json', headers: { ETag: '"arrival_session_etag_0001"' }, body: JSON.stringify({
    meta: meta('0.1.0', '1'), data: { sessionId: 'session_arrival_fixture_0001', state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null),
    data: { csrfToken: 'csrf_arrival_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' },
  }) }))
  await page.route('**/api/v3/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'POST') state.posts.push({ path, key: request.headers()['idempotency-key'], body: request.postDataJSON() })
    if (request.method() === 'POST' && path === '/api/v3/conversations' && state.holdCreate) await createGate
    if (path.endsWith('/messages')) {
      if (state.holdTurn) await turnGate
      if (state.failTurn) return route.abort('failed')
    }
    return route.fulfill({ status: request.method() === 'POST' && path === '/api/v3/conversations' ? 201 : 200,
      contentType: 'application/json', headers: { ETag: '"arrival_conversation_etag_0004"' },
      body: JSON.stringify({ meta: meta('0.3.0', '4'), data: path.endsWith('/messages') ? turn : ready }) })
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('#strategy-idea')).toBeEnabled()
  return state
}

async function observeArrivalMotion(page: Page) {
  await page.addInitScript(() => {
    const original = Element.prototype.animate
    const calls: { frames: Keyframe[]; duration: number | string | undefined; width: number; height: number }[] = []
    const animations: Animation[] = []
    Reflect.set(window, 'nativeArrivalMotions', calls)
    Reflect.set(window, 'nativeArrivalAnimations', animations)
    Element.prototype.animate = function (frames, options) {
      const rect = this.getBoundingClientRect()
      const animation = original.call(this, frames, options)
      if (this.matches('.g-composer')) {
        const observation = { frames: animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : [],
          duration: typeof options === 'number' ? options : options?.duration, width: rect.width, height: rect.height }
        // StrictMode synchronously disposes its first effect before paint. It
        // is not a second user-visible transition; retain the live setup only.
        queueMicrotask(() => {
          if (animation.playState === 'idle') return
          calls.push(observation)
          animations.push(animation)
        })
      }
      return animation
    }
  })
}

test('서비스 첫 질문도 기존 입력창의 위치에서 대화로 이어지며 CREATE·TURN이나 첫 문서 도착에 재생하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await observeArrivalMotion(page)
  const state = await setup(page, 'no-preference')
  await page.locator('#strategy-idea').fill(question)
  const before = await page.locator('.client-home-pill').boundingBox()
  await page.locator('#strategy-idea').press('Enter')
  try {
    await expect.poll(() => state.posts.length).toBe(1)
    await expect(page.getByText('요청을 보냈습니다. 응답이 도착하면 이 대화에 이어집니다.', { exact: true })).toBeVisible()
    await expect(page.locator('.client-session-loading')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions').length)).toBe(1)
    const motion = await page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions')[0])
    expect(motion.duration).toBe(340)
    expect(motion.frames[0].transform).toContain('translate(')
    const scale = motion.frames[0].transform.match(/scale\(([^,]+), ([^)]+)\)/)
    expect(Number(scale[1]) * motion.width).toBeCloseTo(before!.width, 0)
    expect(Number(scale[2]) * motion.height).toBeCloseTo(before!.height, 0)
    await expect(page.locator('.g-umsg')).toHaveText(question)
    state.releaseCreate()
    await expect.poll(() => state.posts.length).toBe(2)
    await expect(page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true })).toBeVisible()
    state.releaseTurn()
    await expect(page.locator('.g-composer textarea')).toBeEnabled()
    await expect(page.getByText('요청을 보냈습니다. 응답이 도착하면 이 대화에 이어집니다.', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions').length)).toBe(1)
    expect(state.posts).toHaveLength(2)
  } finally { state.releaseCreate(); state.releaseTurn() }
})

test('첫 질문의 dock 이동은 입력 상호작용 즉시 취소한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await observeArrivalMotion(page)
  const state = await setup(page, 'no-preference')
  await page.locator('#strategy-idea').fill(question)
  await page.locator('#strategy-idea').press('Enter')
  try {
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'nativeArrivalAnimations').length)).toBe(1)
    await page.evaluate(() => Reflect.get(window, 'nativeArrivalAnimations')[0].pause())
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'nativeArrivalAnimations')[0].playState)).toBe('paused')
    await page.locator('.g-composer').dispatchEvent('pointerdown')
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'nativeArrivalAnimations')[0].playState)).toBe('idle')
  } finally { state.releaseCreate(); state.releaseTurn() }
})

for (const mode of ['reduced', 'mobile', 'fullscreen'] as const) {
  test(`첫 질문의 ${mode} 환경에는 큰 입력창 이동을 추가하지 않는다`, async ({ page }) => {
    await page.setViewportSize({ width: mode === 'mobile' ? 390 : 1440, height: 1000 })
    await observeArrivalMotion(page)
    const state = await setup(page, mode === 'reduced' ? 'reduce' : 'no-preference')
    await page.locator('#strategy-idea').fill(question)
    if (mode === 'fullscreen') {
      await page.locator('#strategy-idea').fill(`${question}\n추가 조건을 함께 확인해줘`)
      await page.locator('.client-home-pill').getByRole('button', { name: /전체.*화면|크게/ }).click()
      await expect(page.locator('.client-home-pill.is-fullscreen')).toBeVisible()
    }
    await page.locator('#strategy-idea').press('Enter')
    state.releaseCreate(); state.releaseTurn()
    await expect(page.locator('.g-composer textarea')).toBeEnabled()
    expect(await page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions').length)).toBe(0)
    expect(state.posts).toHaveLength(2)
  })
}

test('첫 CREATE·TURN을 기다리는 동안 질문과 대화 UI를 유지하고 첫 문서 도착에 재마운트하지 않는다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const state = await setup(page)
  await page.locator('#strategy-idea').fill(question)
  await page.locator('#strategy-idea').press('Enter')
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(page.locator('.g-umsg')).toHaveText(question)
  await expect(page.locator('.g-act2:not(.fin)')).toHaveCount(1)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
  await expect(page.locator('.g-act2.fin')).toHaveCount(0)
  await expect(page.locator('#strategy-idea')).toHaveCount(0)
  await page.locator('.g-composer textarea').evaluate(node => Reflect.set(window, 'arrivalComposer', node))
  await page.locator('.g-umsg').evaluate(node => Reflect.set(window, 'arrivalQuestion', node))
  state.releaseCreate()
  await expect.poll(() => state.posts.length).toBe(2)
  await expect(page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.evaluate(() => document.querySelector('.g-composer textarea') === Reflect.get(window, 'arrivalComposer'))).toBe(true)
  expect(await page.evaluate(() => document.querySelector('.g-umsg') === Reflect.get(window, 'arrivalQuestion'))).toBe(true)
  await expect(page.locator('.g-act2.fin')).toHaveCount(0)
  state.releaseTurn()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  await expect(page.locator('.g-umsg')).toHaveText(question)
  await expect(page.locator('.g-composer textarea')).toBeEnabled()
  expect(state.posts).toHaveLength(2)
  expect(errors).toEqual([])
})

test('두 번째 새 대화도 첫 서버 문서 결속에서 입력창과 질문 DOM을 다시 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await observeArrivalMotion(page)
  const state = await setup(page, 'no-preference')
  state.releaseCreate(); state.releaseTurn()
  await page.locator('#strategy-idea').fill(question)
  await page.locator('#strategy-idea').press('Enter')
  await expect(page.locator('.g-composer textarea')).toBeEnabled()
  await page.getByRole('button', { name: '새 전략', exact: true }).click()
  await page.getByRole('button', { name: '새 전략 시작', exact: true }).click()
  await expect(page.locator('#strategy-idea')).toBeEnabled()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/v3/conversations', async route => {
    await gate
    return route.fulfill({ status: 201, contentType: 'application/json', headers: { ETag: '"arrival_second_etag_0004"' },
      body: JSON.stringify({ meta: meta('0.3.0', '4'), data: { ...ready, conversationId: 'conversation_arrival_second_0001' } }) })
  })
  // Fail the next turn after CREATE: only first document arrival is under
  // test, not a fabricated completion with the previous conversation ID.
  await page.route('**/api/v3/conversations/conversation_arrival_second_0001/messages', route => route.abort('failed'))
  await page.locator('#strategy-idea').fill('새 대화의 두 번째 아이디어')
  await page.locator('#strategy-idea').press('Enter')
  try {
    await expect(page.locator('.g-umsg')).toHaveText('새 대화의 두 번째 아이디어')
    await page.locator('.g-composer textarea').evaluate(element => Reflect.set(window, 'secondArrivalComposer', element))
    await page.locator('.g-umsg').evaluate(element => Reflect.set(window, 'secondArrivalQuestion', element))
    release()
    await expect(page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.querySelector('.g-composer textarea') === Reflect.get(window, 'secondArrivalComposer'))).toBe(true)
    expect(await page.evaluate(() => document.querySelector('.g-umsg') === Reflect.get(window, 'secondArrivalQuestion'))).toBe(true)
    expect(await page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions').length)).toBe(2)
  } finally { release() }
})

test('실제 대화 셸도 동작 줄이기·화면 폭 왕복에서 입력 높이와 미전송 초안을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const state = await setup(page)
  state.releaseCreate(); state.releaseTurn()
  await page.locator('#strategy-idea').fill(question)
  await page.locator('#strategy-idea').press('Enter')
  const input = page.locator('.g-composer textarea'), pill = page.locator('.g-composer')
  await expect(input).toBeEnabled()
  await expect.poll(() => state.posts.length).toBe(2)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  await expect(input).toBeVisible()
  await expect(input).toHaveCSS('height', '21px')
  await expect(pill).not.toHaveClass(/multi/)
  const draft = '서버로 보내지 않은 첫 조건\n아직 비교 중인 두 번째 조건\n다음에 검증할 세 번째 조건'
  await input.fill(draft)
  for (const width of [860, 861, 320, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(input).toHaveValue(draft)
    await expect.poll(() => input.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await input.fill('')
  await expect(input).toHaveCSS('height', '21px')
  await expect(pill).not.toHaveClass(/multi/)
  expect(state.posts).toHaveLength(2)
})

test('최초 journal 저장 실패는 질문을 보낸 말풍선이나 완료 기록으로 바꾸지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await observeArrivalMotion(page)
  const state = await setup(page, 'no-preference')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tesia.native.pending-command') throw new DOMException('fixture write blocked', 'SecurityError')
      original.call(this, key, value)
    }
  })
  await page.locator('#strategy-idea').fill(question)
  await page.locator('#strategy-idea').press('Enter')
  await expect(page.getByRole('alert')).toContainText('서버로 전송하지 않았습니다')
  await expect(page.getByRole('textbox').first()).toHaveValue(question)
  await expect(page.locator('.g-umsg')).toHaveCount(0)
  await expect(page.locator('.g-act2.fin')).toHaveCount(0)
  expect(state.posts).toHaveLength(0)
  expect(await page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions').length)).toBe(0)
})

test('선택 조건은 wire에 보존하고 사용자 원문은 CREATE·TURN·정상 응답과 편집에 유지한다', async ({ page }) => {
  const state = await setup(page)
  const raw = '하락 뒤 반등할 때 살래요\n조건은 같이 정해주세요'
  const combined = composeTemplatePrompt({ acts: ['auto'], assets: ['btc'] }, raw)
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await page.locator('#strategy-idea').fill(raw)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect.poll(() => state.posts.length).toBe(1)
  await expect(page.locator('.g-umsg')).toHaveText(raw)
  await page.locator('.g-umsg').evaluate(node => Reflect.set(window, 'rawArrivalQuestion', node))
  state.releaseCreate()
  await expect.poll(() => state.posts.length).toBe(2)
  expect(state.posts[1].body).toMatchObject({ message: combined })
  await expect(page.locator('.g-umsg')).toHaveText(raw)
  state.releaseTurn()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  await expect(page.locator('.g-umsg')).toHaveText(raw)
  expect(await page.evaluate(() => document.querySelector('.g-umsg') === Reflect.get(window, 'rawArrivalQuestion'))).toBe(true)
  await page.getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  await page.locator('.g-uacts button').first().click()
  await expect(page.locator('.g-composer textarea')).toHaveValue(raw)
  // A later message must never reuse the first message's display metadata.
  await page.locator('.g-composer textarea').fill('손절은 2%로 해주세요')
  await page.locator('.g-composer textarea').press('Enter')
  await expect.poll(() => state.posts.length).toBe(3)
  expect(state.posts[2].body).toMatchObject({ message: '손절은 2%로 해주세요' })
  await expect(page.locator('.g-umsg')).toHaveText([raw, '손절은 2%로 해주세요'])
})

test('reload 복구는 표시 원문을 추측하지 않고 기존 journal의 정확한 요청으로 재개한다', async ({ page }) => {
  const state = await setup(page)
  state.holdCreate = false; state.holdTurn = false; state.failTurn = true
  const raw = '손실은 작게'
  const combined = composeTemplatePrompt({ acts: ['auto'], assets: ['btc'] }, raw)
  const gallery = page.getByRole('region', { name: '투자 템플릿' })
  await gallery.getByRole('button', { name: 'AI가 대신 거래', exact: true }).click()
  await gallery.getByRole('button', { name: 'BTC', exact: true }).click()
  await page.locator('#strategy-idea').fill(raw)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  await expect(page.locator('.g-umsg')).toHaveText(raw)
  const original = state.posts[1]
  const journal = await page.evaluate(() => sessionStorage.getItem('tesia.native.pending-command'))
  expect(journal).not.toContain('displayText')
  expect(original.body).toMatchObject({ message: combined })
  await page.reload()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  expect(state.posts).toHaveLength(2)
  state.failTurn = false
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  await expect(page.locator('.g-umsg')).toHaveText(combined)
  expect(state.posts[2]).toEqual(original)
})

test('실패·reload·명시 재시도는 원 질문 하나를 표시하고 성공 응답 전 완료를 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await observeArrivalMotion(page)
  const state = await setup(page, 'no-preference')
  state.holdCreate = false; state.holdTurn = false; state.failTurn = true
  await page.locator('#strategy-idea').fill(question)
  await page.locator('#strategy-idea').press('Enter')
  await expect(page.locator('.client-service-delivery')).toContainText('응답을 확인하지 못했습니다')
  await expect(page.locator('.g-umsg')).toHaveText(question)
  expect(await page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions').length)).toBe(1)
  const original = state.posts[1]
  await page.reload()
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toBeVisible()
  await expect(page.locator('.g-act2.fin')).toHaveCount(0)
  state.holdTurn = true
  const retry = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await retry.evaluate(element => Reflect.set(window, 'arrivalRecoveryButton', element))
  await retry.focus()
  await retry.press('Enter')
  await expect.poll(() => state.posts.length).toBe(3)
  await expect(retry).toBeVisible()
  await expect(retry).toBeDisabled()
  expect(await retry.evaluate(element => element === Reflect.get(window, 'arrivalRecoveryButton'))).toBe(true)
  await expect(page.locator('.g-umsg')).toHaveText(question)
  await expect(page.locator('.g-act2.fin')).toHaveCount(0)
  state.releaseTurn()
  await expect(page.locator('.client-service-delivery')).toBeVisible()
  await expect(retry).toBeEnabled()
  expect(await retry.evaluate(element => element === Reflect.get(window, 'arrivalRecoveryButton'))).toBe(true)
  expect(state.posts[2]).toEqual(original)
  state.failTurn = false
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(page.locator('.g-act2.fin')).toHaveCount(1)
  await expect(page.locator('.client-service-delivery')).toHaveCount(0)
  await expect(page.locator('.g-umsg')).toHaveText(question)
  expect(state.posts[3]).toEqual(original)
  expect(await page.evaluate(() => Reflect.get(window, 'nativeArrivalMotions').length)).toBe(0)
})
