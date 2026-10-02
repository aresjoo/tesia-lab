import { expect, test, type Page } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import type { FollowupAction } from '../src/client-followup-presentation'

const key = 'teth-client-experience'
const draft = '전송하지 않은 투자 질문은 유지'
const prompt = '이 조건을 다른 구간에서도 검증해줘'
const original: ClientSession = {
  id: 'source-followup-session', title: '후속 동선', renamed: true, idea: '원래 아이디어', draft,
  pair: 'BTC/USDT', mode: 'dip', timeframe: '1시간봉', risk: '−3%', takeProfit: '+8%', phase: 'plan',
  researchStatus: '초안', workspace: 'conversation', tradingReady: false, updatedAt: 1700000002000,
  turns: [{ id: 'source-followup-turn', question: '원래 질문', answer: '공급된 답변', fullAnswer: '공급된 답변',
    status: 'done', phase: 'plan', startedAt: 1700000000000, finishedAt: 1700000002000, suggestions: [prompt] }],
}
const action: FollowupAction = { id: 'source-action', type: 'backtest', label: '이 조건으로 백테스트해줘' }
async function setup(page: Page, actions: unknown = []) {
  await page.clock.install({ time: new Date('2026-09-20T12:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ key, original, actions }) => {
    if (sessionStorage.getItem('followup-public-seeded')) return
    sessionStorage.setItem('followup-public-seeded', 'true')
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '후속 검수', email: 'followup@example.test' }))
    const session = structuredClone(original)
    Reflect.set(session.turns[0], 'followupActions', actions)
    sessionStorage.setItem(key, JSON.stringify({ currentId: session.id, sessions: [session], homeDraft: '홈 초안', sharedFollows: [] }))
  }, { key, original, actions })
  await page.goto('/')
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
}
const saved = (page: Page): Promise<ClientSession> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).sessions[0], key)
const list = (page: Page) => page.locator('.client-followups')

test('기본 전략 맡기기도 화면 전환 없이 현재 입력창·이력을 유지한다', async ({ page }, info) => {
  await setup(page)
  const composer = await page.locator('.g-composer textarea').elementHandle(), url = page.url()
  await page.locator('.client-next-actions').getByRole('button', { name: /전략 맡기기/ }).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  const state = await saved(page)
  expect(state.workspace).toBe('conversation'); expect(state.turns).toHaveLength(2)
  expect(state.turns[1]).toMatchObject({ question: '전략 맡기기', status: 'running', answer: '' })
  expect(state.draft).toBe(draft); expect(state.turns[1].sourceIntake).toBeUndefined()
  expect(state.turns[0]).toMatchObject(original.turns[0])
  expect(page.url()).toBe(url)
  expect(await composer!.evaluate(el => el === document.querySelector('.g-composer textarea'))).toBe(true)
  await expect(page.locator('.tfw-hd')).toHaveCount(0)
  await expect(page.getByTestId('source-intake')).toHaveCount(0)
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('run-in-same-conversation.png') })
})

for (const type of ['default', 'delegate_trade', 'auto_trade'] as const) test(`${type}: 관망 중 새 요청은 보내지 않고 이용 가능해지면 같은 대화로 한 번만 보낸다`, async ({ page }) => {
  await setup(page, type === 'default' ? [] : [{ ...action, type, label: '전략 맡기기' }])
  const billing = async (kind: 'qa-watch' | 'qa-topup') => {
    const ok = await page.evaluate(async kind => {
      const path = '/src/client-billing-preview-store.ts'
      const { createBillingPreviewStore } = await import(/* @vite-ignore */ path)
      const result = createBillingPreviewStore('followup@example.test').dispatch({ kind }, Date.now(), `run-${kind}`)
      window.dispatchEvent(new Event('pageshow'))
      return result.ok
    }, kind)
    expect(ok).toBe(true)
  }
  const button = type === 'default' ? page.locator('.client-next-actions').getByRole('button', { name: /전략 맡기기/ }) : list(page).locator('.g-acbtn')
  await billing('qa-watch')
  const before = await saved(page)
  await button.click()
  expect(await saved(page)).toEqual(before)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await billing('qa-topup')
  await button.click()
  expect((await saved(page)).turns).toHaveLength(2)
  expect((await saved(page)).turns[1].question).toBe('전략 맡기기')
  expect((await saved(page)).workspace).toBe('conversation')
  await expect(page.getByTestId('source-intake')).toHaveCount(0)
})

for (const type of ['default', 'delegate_trade', 'auto_trade'] as const) test(`${type}: 등록 전략이 있어도 실행 요청은 관리 화면으로 새지 않는다`, async ({ page }) => {
  await setup(page, type === 'default' ? [] : [{ ...action, type, label: '전략 맡기기' }])
  const registration = await page.evaluate(async id => {
    const enginePath = '/src/client-delegation-engine.ts', storePath = '/src/client-user-strategy-store.ts'
    const { evaluateDelegation, delegationRecommendedParameters } = await import(/* @vite-ignore */ enginePath)
    const { createClientUserStrategyStore, clientUserStrategyKey } = await import(/* @vite-ignore */ storePath)
    const reference = evaluateDelegation(delegationRecommendedParameters(), 1)
    createClientUserStrategyStore('followup@example.test').register(id, {
      name: '기존 공개 체험 전략', parameters: reference.parameters, score: reference.score,
      ret: reference.result.ret, mdd: reference.result.mdd, n: reference.result.n,
      winRate: reference.result.winRate, environment: 'live', exchangeName: 'Binance', status: 'ready',
    }, Date.now())
    const key = clientUserStrategyKey('followup@example.test')
    return { key, bytes: sessionStorage.getItem(key) }
  }, original.id)
  expect(registration.bytes).not.toBeNull()
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  const url = page.url()
  const button = type === 'default' ? page.locator('.client-next-actions').getByRole('button', { name: /전략 맡기기/ }) : list(page).locator('.g-acbtn')
  await button.click()
  expect((await saved(page)).turns).toHaveLength(2)
  expect((await saved(page)).turns[1].question).toBe('전략 맡기기')
  expect((await saved(page)).workspace).toBe('conversation')
  expect(page.url()).toBe(url)
  expect(await page.evaluate(key => sessionStorage.getItem(key), registration.key)).toBe(registration.bytes)
  await expect(page.locator('.tfw-hd')).toHaveCount(0)
  await expect(page.getByTestId('source-intake')).toHaveCount(0)
})

test('메인 후속 질문은 한 번만 저장·전송하고 기존 답변과 입력창·초안을 보존한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await setup(page)
  await page.locator('.g-composer textarea').evaluate(el => Reflect.set(window, 'originalFollowupComposer', el))
  await list(page).getByRole('button', { name: prompt }).evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect(list(page)).toHaveCount(0)
  const state = await saved(page)
  expect(state.turns).toHaveLength(2)
  expect(state.turns[0]).toMatchObject({ question: '원래 질문', answer: '공급된 답변' })
  expect(state.turns[1].question).toBe(prompt)
  expect(state.draft).toBe(draft)
  expect(await page.locator('.g-composer textarea').evaluate(el => el === Reflect.get(window, 'originalFollowupComposer'))).toBe(true)
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect((await saved(page)).turns).toHaveLength(2)
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('public-followup-accepted.png') })
})

test('백테스트 행동은 연구 문서를 열지 않고 원본 label을 같은 대화의 새 요청으로 보낸다', async ({ page }) => {
  await setup(page, [action])
  await expect(list(page).locator('button')).toHaveCount(2)
  await expect(page.locator('.client-next-actions')).toHaveCount(0)
  await page.reload()
  await list(page).locator('.g-acbtn').click()
  const state = await saved(page)
  expect(state.workspace).toBe('conversation')
  expect(state.turns.at(-1)?.question).toBe(action.label)
  expect(state.draft).toBe(draft)
  await expect(page.locator('.client-restored-research')).toHaveCount(0)
})

test('조건 저장은 확인된 로컬 기록에만 표시하고 재방문에도 중복 저장하지 않는다', async ({ page }) => {
  await setup(page, [{ ...action, type: 'alert', label: '이 조건 저장하기' }])
  await list(page).locator('.g-acbtn').click()
  await expect(list(page).locator('.g-acbtn')).toHaveText('조건 저장됨 ✓무료, 즉시→')
  await expect(list(page).locator('.g-acbtn')).toBeDisabled()
  expect((await saved(page)).turns).toHaveLength(1)
  await page.reload()
  await expect(list(page).locator('.g-acbtn')).toBeDisabled()
  expect((await saved(page)).turns[0].followupActions?.[0].saved).toBe(true)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
})

for (const type of ['delegate_trade', 'auto_trade'] as const) test(`${type}은 원본 label을 대화에 보내며 고정5질문이나 주문을 만들지 않는다`, async ({ page }) => {
  const mutations: string[] = []
  page.on('request', req => { if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method())) mutations.push(req.url()) })
  await setup(page, [{ ...action, type, label: '전략 맡기기' }])
  const composer = await page.locator('.g-composer textarea').elementHandle(), url = page.url()
  await list(page).locator('.g-acbtn').evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  expect((await saved(page)).workspace).toBe('conversation')
  expect((await saved(page)).draft).toBe(draft)
  expect((await saved(page)).tradingReady).toBe(false)
  await expect(page.getByTestId('source-intake')).toHaveCount(0)
  expect((await saved(page)).turns).toHaveLength(2)
  expect((await saved(page)).turns[1]).toMatchObject({ question: '전략 맡기기', status: 'running', answer: '' })
  expect((await saved(page)).turns[1].sourceIntake).toBeUndefined()
  expect(page.url()).toBe(url)
  expect(await composer!.evaluate(el => el === document.querySelector('.g-composer textarea'))).toBe(true)
  await expect(page.locator('.tfw-hd')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(list(page)).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(page.locator('.g-umsg')).toHaveCount(2)
  await expect(list(page)).toHaveCount(0)
  await page.clock.fastForward(30_000)
  await expect.poll(async () => (await saved(page)).turns[1].status).toBe('done')
  await expect(page.getByTestId('source-intake')).toHaveCount(0)
  expect(mutations).toEqual([])
})

for (const type of ['question', 'alert', 'delegate_trade', 'auto_trade'] as const) test(`${type} 저장 거부는 목록·대화·초안을 유지하고 복구 후 한 번만 수락한다`, async ({ page }) => {
  await setup(page, type === 'question' ? [] : [{ ...action, type, label: type === 'alert' ? '이 조건 저장하기' : '전략 맡기기' }])
  const before = await saved(page)
  await page.evaluate(key => {
    const set = Storage.prototype.setItem
    Reflect.set(window, 'restoreFollowupStorage', () => { Storage.prototype.setItem = set })
    Storage.prototype.setItem = function (name, value) { if (this === sessionStorage && name === key) throw new Error('test denied'); set.call(this, name, value) }
  }, key)
  const button = list(page).locator(type === 'question' ? '.g-nextq' : '.g-acbtn')
  await button.click()
  await expect(list(page).locator('.followup-notice')).toContainText('전달하지 못했습니다')
  expect(await saved(page)).toEqual(before)
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await expect(button).toBeEnabled()
  await page.evaluate(() => Reflect.get(window, 'restoreFollowupStorage')())
  await button.click()
  expect((await saved(page)).turns).toHaveLength(type === 'alert' ? 1 : 2)
  if (type === 'alert') await expect(button).toBeDisabled()
  else await expect(list(page)).toHaveCount(0)
})

test('손상된 선택 행동은 제거하되 원문·후속 질문·초안은 복구한다', async ({ page }) => {
  await setup(page, [{ ...action, type: 'place_real_order' }])
  await expect(list(page).locator('.g-acbtn')).toHaveCount(0)
  await expect(list(page).getByRole('button', { name: prompt })).toBeVisible()
  await expect(page.getByText('공급된 답변', { exact: true })).toBeVisible()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
})

test('배열 type은 알려진 action 문자열로 강제 변환하지 않는다', async ({ page }) => {
  await setup(page, [{ ...action, type: ['alert'] }])
  await expect(page.locator('.client-global-notice')).toContainText('복원하지 못했습니다')
  expect((await saved(page)).turns[0].followupActions).toBeUndefined()
})

test('쓰기 후 읽기 실패는 즉시 새로고침 안내를 표시하고 중복 수락을 막는다', async ({ page }) => {
  await setup(page)
  await page.evaluate(key => {
    const set = Storage.prototype.setItem, get = Storage.prototype.getItem
    let written = false
    Reflect.set(window, 'restoreFollowupStorage', () => { Storage.prototype.setItem = set; Storage.prototype.getItem = get })
    Storage.prototype.setItem = function (name, value) { set.call(this, name, value); if (this === sessionStorage && name === key) written = true }
    Storage.prototype.getItem = function (name) { if (written && this === sessionStorage && name === key) throw new Error('test readback denied'); return get.call(this, name) }
  }, key)
  await list(page).locator('.g-nextq').click()
  await expect(page.getByRole('alert').filter({ hasText: '새로고침' })).toBeVisible()
  await expect(list(page).locator('.g-nextq')).toBeDisabled()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  await page.evaluate(() => Reflect.get(window, 'restoreFollowupStorage')())
  expect((await saved(page)).turns).toHaveLength(2)
  await page.reload()
  await expect(page.locator('.g-composer textarea')).toHaveValue(draft)
  expect((await saved(page)).turns).toHaveLength(2)
})
