import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import { inlineInput } from '../src/client-inline-backtest'

const key = 'teth-client-experience', owner = 'retry@example.test', draft = '아직 보내지 않은 별도 질문'
function session(status: 'stopped' | 'failed' = 'stopped'): ClientSession {
  return { id: 'retry-session', title: '재요청 검수', renamed: true, idea: '원래 아이디어', draft, pair: 'BTC/USDT', mode: 'dip',
    timeframe: '', risk: '', takeProfit: '', phase: 'timeframe', researchStatus: '초안', workspace: 'conversation', tradingReady: false,
    updatedAt: 1700000001000, turns: [{ id: 'retry-turn', question: '원래 질문 그대로', requestText: '비트코인을 하루에 한 번 살래요',
      answer: '', fullAnswer: '아직 전달되지 않은 fixture 답변', status, phase: 'timeframe', suggestions: [],
      startedAt: 1700000000000, finishedAt: 1700000001000 }] }
}
async function setup(page: Page, initial = session()) {
  await page.clock.install({ time: new Date('2026-09-20T12:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ key, initial, owner }) => {
    if (sessionStorage.getItem('retry-seeded')) return
    sessionStorage.setItem('retry-seeded', 'true'); localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '재요청 검수', email: owner }))
    sessionStorage.setItem(key, JSON.stringify({ currentId: initial.id, sessions: [initial], homeDraft: '홈 초안', sharedFollows: [] }))
  }, { key, initial, owner })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
}
const card = (page: Page) => page.locator('.client-response-retry')
const button = (page: Page) => card(page).getByRole('button')
const saved = (page: Page): Promise<ClientSession> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)

for (const status of ['stopped', 'failed'] as const) test(`${status}: 원질문 새 요청을 한 번 저장하고 기존 실패·초안·컴포저를 보존한다`, async ({ page }, info) => {
  const writes: string[] = []; page.on('request', r => { if (r.method() === 'POST') writes.push(r.url()) })
  const initial = session(status)
  await setup(page, initial); await page.reload()
  await expect(button(page)).toHaveText(status === 'failed' ? '다시 시도' : /다시 생성/)
  if (status === 'failed') await expect(card(page)).toContainText('답변을 불러오지 못했습니다.')
  await page.screenshot({ path: info.outputPath('retry-before.png') })
  await page.locator('.g-composer textarea').evaluate(el => Reflect.set(window, 'retryComposer', el))
  await button(page).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(card(page)).toHaveCount(0)
  const result = await saved(page)
  expect(result.turns).toHaveLength(2); expect(result.turns[0]).toEqual(initial.turns[0])
  expect(result.turns[1]).toMatchObject({ question: initial.turns[0].question, requestText: initial.turns[0].requestText,
    retryOf: 'retry-turn', status: 'running', answer: '' })
  expect(result.draft).toBe(draft)
  expect(await page.locator('.g-composer textarea').evaluate(el => el === Reflect.get(window, 'retryComposer'))).toBe(true)
  await page.clock.fastForward(20000)
  expect((await saved(page)).turns[1].status).toBe('done')
  await page.reload(); expect((await saved(page)).turns[1].retryOf).toBe('retry-turn')
  expect(writes).toEqual([])
})

test('실패한 부분 답변은 전체 재생성이 아니라 기존 이어쓰기 경로를 유지한다', async ({ page }) => {
  const initial = session('failed'); initial.turns[0].answer = '이미 전달한 내용.'; initial.turns[0].fullAnswer = '이미 전달한 내용. 남은 fixture 내용.'
  await setup(page, initial)
  await expect(card(page)).toHaveCount(0)
  await page.getByRole('button', { name: '이어서 계속', exact: true }).click()
  expect((await saved(page)).turns[1].continuationOf).toBe('retry-turn')
  expect((await saved(page)).turns[0].status).toBe('failed')
  await page.reload(); expect((await saved(page)).turns[1].continuationOf).toBe('retry-turn')
})

for (const status of ['stopped', 'failed'] as const) test(`${status}: 저장된 재생 자료가 없으면 원기록을 보존하고 재요청을 만들지 않는다`, async ({ page }) => {
  const initial = session(status); initial.turns[0].fullAnswer = ''; initial.turns[0].suggestions = []
  const requests: string[] = []; page.on('request', request => { if (request.method() === 'POST') requests.push(request.url()) })
  await setup(page, initial)
  await expect(button(page)).toBeDisabled()
  await button(page).evaluate(el => (el as HTMLButtonElement).click())
  expect({ ...await saved(page), conversationViewport: undefined }).toEqual({ ...initial, conversationViewport: undefined })
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.reload()
  await expect(button(page)).toBeDisabled()
  expect({ ...await saved(page), conversationViewport: undefined }).toEqual({ ...initial, conversationViewport: undefined })
  expect(requests).toEqual([])
})

test('본문 없이 후속 선택지만 준비된 응답도 재생성과 새로고침에서 유실되지 않는다', async ({ page }) => {
  const initial = session('failed'); initial.turns[0].fullAnswer = ''; initial.turns[0].suggestions = ['1시간마다']
  await setup(page, initial)
  await expect(button(page)).toBeEnabled()
  await button(page).click()
  await page.clock.fastForward(3000)
  expect((await saved(page)).turns[1]).toMatchObject({ status: 'done', fullAnswer: '', answer: '', suggestions: ['1시간마다'], retryOf: 'retry-turn' })
  await page.reload()
  expect((await saved(page)).turns[1].retryOf).toBe('retry-turn')
  expect((await saved(page)).turns[0]).toEqual(initial.turns[0])
})

for (const partial of [false, true]) test(`실패한 과거검증 준비 응답 partial=${partial}는 입력과 재시도를 영구 잠그지 않는다`, async ({ page }) => {
  const initial = session('failed')
  Object.assign(initial, { phase: 'plan', timeframe: '1시간봉', risk: '-3%', takeProfit: '+8%' })
  initial.turns[0].inlineRequest = inlineInput(initial)
  expect(initial.turns[0].inlineRequest).toBeDefined()
  if (partial) { initial.turns[0].answer = '이미 전달한 내용.'; initial.turns[0].fullAnswer = '이미 전달한 내용. 이어지는 답변.' }
  await setup(page, initial)
  await expect(page.getByRole('button', { name: '응답 중지' })).toHaveCount(0)
  const retry = partial ? page.getByRole('button', { name: '이어서 계속', exact: true }) : button(page)
  await expect(retry).toBeEnabled()
  await retry.click()
  expect((await saved(page)).turns).toHaveLength(2)
  expect((await saved(page)).turns[1].inlineRequest).toEqual(initial.turns[0].inlineRequest)
  expect((await saved(page)).turns[0]).toEqual(initial.turns[0])
  await page.clock.fastForward(30000)
  const result = await saved(page)
  expect(result.inlineResults).toHaveLength(1)
  expect(result.inlineResults![0].turnId).toBe(result.turns[1].id)
  await page.reload()
  expect((await saved(page)).turns[0].status).toBe('failed')
  await expect(page.getByRole('button', { name: '응답 중지' })).toHaveCount(0)
})

for (const fault of ['denied', 'drop', 'readback'] as const) test(`${fault}: 저장 미확인에서 재요청 성공을 만들거나 초안을 지우지 않는다`, async ({ page }) => {
  await setup(page, session('failed'))
  await page.evaluate(({ key, fault }) => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem; let written = false
    Reflect.set(window, 'restoreRetryStorage', () => { Storage.prototype.getItem = get; Storage.prototype.setItem = set })
    Storage.prototype.setItem = function (name, value) {
      if (this === sessionStorage && name === key) {
        written = true
        if (fault === 'denied') throw new Error('TEST_ONLY_SECRET_DENIAL')
        if (fault === 'drop') return
      }
      set.call(this, name, value)
    }
    Storage.prototype.getItem = function (name) {
      if (fault === 'readback' && written && this === sessionStorage && name === key) throw new Error('TEST_ONLY_SECRET_READBACK')
      return get.call(this, name)
    }
  }, { key, fault })
  await button(page).click()
  await expect(card(page)).toBeVisible(); await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('body')).not.toContainText('TEST_ONLY_SECRET')
  if (fault === 'readback') await expect(button(page)).toBeDisabled()
  else await expect(button(page)).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'restoreRetryStorage')())
  if (fault === 'readback') await page.reload()
  else { expect((await saved(page)).turns).toHaveLength(1); await button(page).click() }
  expect((await saved(page)).turns).toHaveLength(2)
  expect((await saved(page)).turns[0]).toEqual(session('failed').turns[0])
})

test('원본 재요청의 키보드 수락 후 기존 컴포저로 초점을 잇는다', async ({ page }) => {
  await setup(page); await button(page).focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.g-composer textarea')).toBeFocused()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
})

for (const state of ['done', 'past', 'blank-question', 'partial'] as const) test(`${state}: 재생성 대상이 아니면 버튼을 만들지 않는다`, async ({ page }) => {
  const initial = session()
  if (state === 'done') initial.turns[0].status = 'done'
  if (state === 'partial') initial.turns[0].answer = '이미 답변이 있습니다.'
  if (state === 'blank-question') initial.turns[0].question = ' '
  if (state === 'past') initial.turns.push({ ...initial.turns[0], id: 'later', status: 'done', answer: '다음 답변' })
  await setup(page, initial); await expect(card(page)).toHaveCount(0)
})

test('잘못된 재요청 계보만 격리하며 실패 기록과 원문은 보존한다', async ({ page }) => {
  const initial = session('failed'); initial.turns.push({ ...initial.turns[0], id: 'retry-wrong', question: '다른 질문', retryOf: 'retry-turn', status: 'done' })
  await setup(page, initial)
  await expect(page.locator('.client-global-notice')).toContainText('복원하지 못했습니다')
  expect((await saved(page)).turns[1].retryOf).toBeUndefined()
  expect((await saved(page)).turns[1].question).toBe('다른 질문')
  expect((await saved(page)).turns[0]).toEqual(initial.turns[0])
})

test('store는 최신 실패·owner·질문·관측 결속을 검증하고 중복 수락을 거절한다', async ({ page }) => {
  await setup(page, session('failed'))
  const result = await page.evaluate(async ({ owner }) => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore(), binding = { scopeId: JSON.stringify([owner, 'retry-session']), messageId: 'retry-turn', observationId: 'retry-turn:failed' }
    const base = { binding, question: '원래 질문 그대로' }
    return [
      store.retryPreview('other', 'retry-turn', owner, base),
      store.retryPreview('retry-session', 'other', owner, base),
      store.retryPreview('retry-session', 'retry-turn', 'foreign', base),
      store.retryPreview('retry-session', 'retry-turn', owner, { ...base, question: '조작된 질문' }),
      store.retryPreview('retry-session', 'retry-turn', owner, { ...base, binding: { ...binding, observationId: 'stale' } }),
      store.retryPreview('retry-session', 'retry-turn', owner, base),
      store.retryPreview('retry-session', 'retry-turn', owner, base),
    ]
  }, { owner })
  expect(result).toEqual([false, false, false, false, false, true, false])
})

for (const scenario of ['pair-recommend', 'plan-change'] as const) test(`${scenario}: 재요청은 이미 해석한 원조건을 다음 단계의 입력으로 재해석하지 않는다`, async ({ page }) => {
  const initial = session(); initial.turns = []; initial.phase = scenario === 'pair-recommend' ? 'pair' : 'plan'
  initial.pair = scenario === 'pair-recommend' ? '' : 'BTC/USDT'
  initial.timeframe = scenario === 'pair-recommend' ? '' : '1시간봉'
  initial.risk = scenario === 'pair-recommend' ? '' : '−3%'
  initial.takeProfit = scenario === 'pair-recommend' ? '' : '+8%'
  await setup(page, initial)
  const result = await page.evaluate(async ({ owner, scenario }) => {
    const path = '/src/client-experience-store.ts'
    const { createClientExperienceStore } = await import(/* @vite-ignore */ path)
    const store = createClientExperienceStore()
    store.send(scenario === 'pair-recommend' ? '추천' : '손절 -5%로', 'suggestion')
    store.stop('retry-session')
    const before = structuredClone(store.getSnapshot().sessions[0]), turn = before.turns.at(-1)!
    const accepted = store.retryPreview('retry-session', turn.id, owner, {
      binding: { scopeId: JSON.stringify([owner, 'retry-session']), messageId: turn.id, observationId: `${turn.id}:stopped` }, question: turn.question,
    })
    return { accepted, before, after: store.getSnapshot().sessions[0] }
  }, { owner, scenario })
  expect(result.accepted).toBe(true)
  for (const field of ['pair', 'mode', 'timeframe', 'risk', 'takeProfit', 'phase', 'draft'] as const)
    expect(result.after[field], field).toEqual(result.before[field])
  const original = result.before.turns.at(-1)!, retried = result.after.turns.at(-1)!
  expect(retried.fullAnswer).toBe(original.fullAnswer)
  expect(retried.suggestions).toEqual(original.suggestions)
  expect(retried.inlineRequest).toEqual(original.inlineRequest)
  expect(result.after.turns[0]).toEqual(original)
})
