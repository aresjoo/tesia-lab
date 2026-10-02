import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'

// This exercises the existing, explicitly mock public transcript, not a provider.
const key = 'teth-client-experience', prompt = '방금 끊긴 답변을 이어서 계속 작성해줘'
const partial = '먼저 거래 조건을 확인했습니다.'
const remainder = ' 다음으로 손절 조건과 거래 간격을 확인합니다.'.repeat(8)
const draft = '입력 중이던 별도 질문'
const initial: ClientSession = {
  id: 'continued-preview', title: '부분 답변 보존', renamed: true, idea: '원래 아이디어', draft,
  pair: 'BTC/USDT', mode: 'dip', timeframe: '1시간봉', risk: '−3%', takeProfit: '+8%', phase: 'plan',
  researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: 1700000002000,
  turns: [{ id: 'interrupted-preview', question: '원래 질문', answer: partial, fullAnswer: partial + remainder,
    status: 'stopped', phase: 'plan', startedAt: 1700000000000, finishedAt: 1700000002000, suggestions: ['조건을 더 설명해줘'] }],
}
async function setup(page: Page, session = initial) {
  await page.clock.install({ time: new Date('2026-09-20T12:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ key, session }) => {
    if (sessionStorage.getItem('continuation-public-seeded')) return
    sessionStorage.setItem('continuation-public-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '이어쓰기 검수', email: 'continuation@example.test' }))
    sessionStorage.setItem(key, JSON.stringify({ currentId: session.id, sessions: [session], homeDraft: '홈의 초안', sharedFollows: [] }))
  }, { key, session })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
}
const saved = (page: Page): Promise<ClientSession> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
const button = (page: Page) => page.getByRole('button', { name: '이어서 계속', exact: true })

test('원본 버튼은 reload 후에도 같은 대화에서 새 preview 턴을 한 번만 만들고 부분답변·초안을 유지한다', async ({ page }, info) => {
  const writes: string[] = []; page.on('request', request => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(request.url()) })
  await setup(page)
  await page.reload()
  await expect(button(page)).toBeVisible()
  await page.locator('.g-composer textarea').evaluate(el => Reflect.set(window, 'continuationOriginalComposer', el))
  await button(page).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(button(page)).toHaveCount(0)
  const state = await saved(page)
  expect(state.turns).toHaveLength(2)
  expect(state.turns[0]).toEqual(initial.turns[0])
  expect(state.turns[1]).toMatchObject({ question: prompt, answer: '', fullAnswer: remainder, continuationOf: initial.turns[0].id, status: 'running' })
  expect(state.draft).toBe(draft)
  expect(await page.locator('.g-composer textarea').evaluate(el => el === Reflect.get(window, 'continuationOriginalComposer'))).toBe(true)
  await page.clock.fastForward(20000)
  await expect(page.getByRole('button', { name: '응답 중지', exact: true })).toHaveCount(0)
  expect((await saved(page)).turns[0].status).toBe('stopped')
  expect((await saved(page)).turns[1].status).toBe('done')
  expect((await saved(page)).turns[1].answer).toBe(remainder)
  await expect(page.locator('.g-amsg[data-source="service"]')).toHaveCount(0)
  await expect(page.locator('.g-amsg[data-source="mock"]')).toHaveCount(2)
  await page.screenshot({ path: info.outputPath('continued-public-preview.png') })
  expect(writes).toEqual([])
})

test('이어쓰기 중 다시 중지해도 새 부분답변·이전 미완성 상태·독립 초안을 보존한다', async ({ page }) => {
  await setup(page)
  await button(page).click()
  await page.clock.fastForward(2700)
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  await expect(button(page)).toBeVisible()
  const stopped = await saved(page)
  expect(stopped.turns).toHaveLength(2)
  expect(stopped.turns[1].answer.length).toBeGreaterThan(0)
  expect(stopped.turns[1].status).toBe('stopped')
  await page.reload()
  await button(page).click()
  const resumed = await saved(page)
  expect(resumed.turns).toHaveLength(3)
  expect(resumed.turns.slice(0, 2)).toEqual(stopped.turns)
  expect(resumed.turns[2].continuationOf).toBe(stopped.turns[1].id)
  expect(resumed.turns[2].fullAnswer).toBe(remainder.slice(stopped.turns[1].answer.length))
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
})

test('지원7언어 전환은 원문·초안을 바꾸지 않고 이어쓰기 요청은 원본 그대로 저장한다', async ({ page }) => {
  await setup(page)
  const labels = { en: 'Continue', ja: '続ける', 'zh-CN': '继续', 'zh-TW': '繼續', es: 'Continuar', fr: 'Continuer', ko: '이어서 계속' }
  for (const [language, label] of Object.entries(labels)) {
    await page.evaluate(language => localStorage.setItem('tethLang', language), language)
    await page.reload()
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
    expect((await saved(page)).turns[0].answer).toBe(partial)
  }
  await button(page).click()
  expect((await saved(page)).turns[1].question).toBe(prompt)
})

for (const fault of ['denied', 'readback'] as const) test(`${fault}: 저장 실패는 부분 답변을 잃지 않으며 수락 여부를 구분한다`, async ({ page }) => {
  await setup(page)
  const before = await saved(page)
  await page.evaluate(({ key, fault }) => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem
    let written = false
    Reflect.set(window, 'restoreContinuationStorage', () => { Storage.prototype.getItem = get; Storage.prototype.setItem = set })
    Storage.prototype.setItem = function (name, value) {
      if (this === sessionStorage && name === key && fault === 'denied') throw new Error('test storage denied')
      set.call(this, name, value)
      if (this === sessionStorage && name === key) written = true
    }
    Storage.prototype.getItem = function (name) { if (fault === 'readback' && written && this === sessionStorage && name === key) throw new Error('test readback'); return get.call(this, name) }
  }, { key, fault })
  await button(page).click()
  await expect(page.locator('.followup-notice')).toContainText('전달하지 못했습니다')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.getByText(partial, { exact: true })).toBeVisible()
  if (fault === 'readback') {
    await expect(button(page)).toBeDisabled()
    await expect(page.getByRole('alert').filter({ hasText: '새로고침' })).toBeVisible()
  } else await expect(button(page)).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'restoreContinuationStorage')())
  if (fault === 'denied') { expect(await saved(page)).toEqual(before); await button(page).click() }
  else await page.reload()
  expect((await saved(page)).turns).toHaveLength(2)
  expect((await saved(page)).turns[0]).toEqual(before.turns[0])
})

for (const state of ['empty', 'past', 'done'] as const) test(`${state}: 이어갈 최신 부분답변이 아니면 재개 버튼을 만들지 않는다`, async ({ page }) => {
  const session = structuredClone(initial)
  if (state === 'empty') session.turns[0].answer = ''
  if (state === 'done') { session.turns[0].status = 'done'; session.turns[0].answer = session.turns[0].fullAnswer }
  if (state === 'past') session.turns.push({ ...session.turns[0], id: 'later-turn', status: 'done', question: '다른 질문', answer: '나중 답변', fullAnswer: '나중 답변' })
  await setup(page, session)
  await expect(button(page)).toHaveCount(0)
})

for (const fullAnswer of ['', partial, '부분 답변과 다른 복원 데이터']) test(`복원 preview의 나머지가 없거나 불일치하면 영구 실패 버튼을 노출하지 않는다: ${fullAnswer}`, async ({ page }) => {
  const session = structuredClone(initial)
  session.turns[0].fullAnswer = fullAnswer
  await setup(page, session)
  await expect(button(page)).toHaveCount(0)
  await expect(page.getByText(partial, { exact: true })).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect((await saved(page)).turns[0]).toEqual(session.turns[0])
})

for (const predecessor of ['missing-turn', 'later-turn']) test(`잘못된 계보 ${predecessor}만 제거하고 복원한 원문은 보존한다`, async ({ page }) => {
  const session = structuredClone(initial)
  session.turns[0].continuationOf = predecessor
  session.turns.push({ ...initial.turns[0], id: 'later-turn', status: 'done', question: '후행 질문', answer: '후행 답변', fullAnswer: '후행 답변' })
  await setup(page, session)
  await expect(page.locator('.client-global-notice')).toContainText('복원하지 못했습니다')
  const state = await saved(page)
  expect(state.turns[0].continuationOf).toBeUndefined()
  expect(state.turns[0].answer).toBe(partial)
  expect(state.turns[1]).toEqual(session.turns[1])
  expect(state.draft).toBe(draft)
})

test('키보드 이어쓰기 수락 뒤 초점은 유지된 컴포저로 이어지고 초안은 지우지 않는다', async ({ page }) => {
  await setup(page)
  await button(page).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.g-composer textarea')).toBeFocused()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect((await saved(page)).turns).toHaveLength(2)
})
