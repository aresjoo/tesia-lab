import { revealSourceNavigation } from './fixtures/source-offline-research-entry'
// Explicit owner-bound Mock supplier tests for the common response branch.
// Fresh supplier-free source intake is covered by offline source journey specs.
import { installCommonResponseFixture } from './fixtures/client-common-response-fixture'
import { expect, test, type Page } from '@playwright/test'
import { marketQuestionText } from '../src/client-market-question-copy'
import type { ClientLanguage } from '../src/client-preferences'
import type { ClientSession } from '../src/client-experience-store'

// Legacy preview question data in the 412fd60 sk-ask dock presentation.
// These browser fixtures exercise local intake only, never native interpretation
// or a real financial/approval contract.
const owner = 'clarification-card@example.test'
const card = (page: Page) => page.locator('.gclw')
const composer = (page: Page) => page.locator('.g-composer textarea')
const directInput = (page: Page) => card(page).locator('.op.free input')
async function writeDraft(page: Page, value: string) {
  if (!await directInput(page).count()) await card(page).getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  await directInput(page).fill(value)
}
const skipLabel = '이 질문 건너뛰기 (추천값으로 진행)'
test('412fd60: 닫기는 추천값을 제출하지 않고 같은 입력 DOM과 초점으로 돌아간다', async ({ page }) => {
  const requests = await begin(page, 'BTC 반등 1시간봉')
  await writeDraft(page, '아직 보내지 않을 손절 조건')
  await page.clock.fastForward(500)
  const before = await read(page), node = await composer(page).elementHandle()
  await expect(composer(page)).toBeHidden()
  await expect(page.locator('.g-thread .gclw')).toHaveCount(0)
  await expect(page.locator('.client-question-dock .gclw')).toBeVisible()
  await card(page).getByRole('button', { name: '질문 카드 닫기', exact: true }).click()
  await expect(card(page)).toHaveCount(0)
  await expect(composer(page)).toBeVisible()
  await expect(composer(page)).toBeFocused()
  await expect(composer(page)).toHaveValue(before.draft)
  expect(await node!.evaluate(el => el === document.querySelector('.g-composer textarea'))).toBe(true)
  expect((await read(page)).turns).toEqual(before.turns)
  expect((await read(page)).risk).toBe('')
  expect(requests).toEqual([])
})

test('패널 직접 입력의 한글 조합 Enter와 반복키는 제출하지 않는다', async ({ page }) => {
  await begin(page, 'BTC 반등 1시간봉')
  await writeDraft(page, '손절 2.5%')
  const before = await read(page)
  await directInput(page).dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })
  await directInput(page).dispatchEvent('keydown', { key: 'Enter', repeat: true, bubbles: true })
  expect((await read(page)).turns).toEqual(before.turns)
  await expect(directInput(page)).toHaveValue('손절 2.5%')
  await directInput(page).press('Enter')
  await settle(page)
  expect((await read(page)).risk).toBe('−2.5%')
})
const read = (page: Page): Promise<ClientSession> => page.evaluate(() => {
  const state = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
  return state.sessions.find((session: { id: string }) => session.id === state.currentId)
})

async function begin(page: Page, idea: string) {
  const requests: string[] = []
  page.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url())
  })
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => {
    localStorage.setItem('tethLang', 'ko')
    if (!sessionStorage.getItem('teth-client-profile-preview')) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '확인 카드 검수', email: owner }))
  }, owner)
  await installCommonResponseFixture(page, owner)
  await page.goto('/')
  // Keep the 65ms stream tick deterministic, particularly between a card-only
  // answer being saved as running and the explicit reload/fastForward below.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await page.locator('#strategy-idea').fill(idea)
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await settle(page)
  return requests
}
async function settle(page: Page) {
  await page.clock.fastForward(15_000)
  await expect.poll(async () => (await read(page)).turns.at(-1)?.status).toBe('done')
}
async function question(page: Page, title: string, progress: string) {
  await expect(card(page)).toHaveCount(1)
  await expect(card(page).getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(card(page).locator('.pg')).toHaveText(progress.replace(/질문 (\d+) \/ (\d+)/, '$2개 중 $1'))
  await expect(page.locator('.g-chiprow .g-qchip')).toHaveCount(0)
}
async function choose(page: Page, label: string) {
  await card(page).getByRole('button', { name: label, exact: true }).click()
  await expect(card(page)).toHaveCount(0)
  await settle(page)
}

test('완전한 첫 입력은 확인 카드를 만들지 않고 명시한 조건을 그대로 계획에 넘긴다', async ({ page }) => {
  const idea = 'BTC 반등 1시간봉 손절 12%, 익절 2.5%'
  const requests = await begin(page, idea)
  expect(await read(page)).toMatchObject({ mode: 'dip', pair: 'BTC/USDT', timeframe: '1시간봉', risk: '−12%', takeProfit: '+2.5%', phase: 'plan' })
  await expect(card(page)).toHaveCount(0)
  await expect(page.locator('.g-umsg')).toHaveText(idea)
  await expect(page.getByRole('region', { name: '전략 계약서', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '과거로 돌려 보기', exact: true })).toBeVisible()
  expect((await read(page)).turns).toHaveLength(1)
  expect(requests).toEqual([])
})

test('부분 입력은 이미 채워진 자산·진입·손절·익절을 다시 묻지 않는다', async ({ page }) => {
  const requests = await begin(page, 'ETH 추세 손절 2%, 익절 8%')
  await question(page, '얼마나 자주 확인할까요?', '질문 1 / 1')
  await choose(page, '1시간마다')
  const session = await read(page)
  expect(session).toMatchObject({ mode: 'trend', pair: 'ETH/USDT', timeframe: '1시간봉', risk: '−2%', takeProfit: '+8%', phase: 'plan' })
  expect(session.turns.at(-1)).toMatchObject({ question: '1시간마다', requestText: '1시간' })
  await expect(card(page)).toHaveCount(0)
  expect(requests).toEqual([])
})

test('설명 재질문은 질문 수를 늘리지 않고 다섯 단계와 표시문구·해석값을 분리한다', async ({ page }) => {
  const requests = await begin(page, '전략을 만들어 주세요')
  await question(page, '진입 방식을 정해주세요', '질문 1 / 5')
  await expect(card(page)).toContainText('전략의 성격을 결정하는 질문이에요.')
  await expect(card(page).getByRole('button', { name: '내려왔을 때 반등 매수', exact: true })).toHaveAccessibleDescription('과매도 후 되돌림을 노려요. 거래가 적고 느긋해요.')
  for (let attempt = 0; attempt < 2; attempt++) {
    await choose(page, '차이를 더 알려주세요')
    await question(page, '진입 방식을 정해주세요', '질문 1 / 5')
    expect((await read(page)).turns.at(-1)).toMatchObject({ question: '차이를 더 알려주세요', requestText: '차이 설명' })
    await expect(page.locator('.g-amsg').last()).toContainText('반등 매수는 과매도 후 회복을 노립니다')
  }
  await choose(page, '내려왔을 때 반등 매수')
  await question(page, '어떤 자산으로 할까요?', '질문 2 / 5')
  await choose(page, 'AI 추천으로')
  expect((await read(page)).turns.at(-1)).toMatchObject({ question: 'AI 추천으로', requestText: '추천' })
  await question(page, '얼마나 자주 확인할까요?', '질문 3 / 5')
  await choose(page, '1시간마다')
  expect((await read(page)).turns.at(-1)).toMatchObject({ question: '1시간마다', requestText: '1시간' })
  await question(page, '한 번의 거래에서 얼마까지 잃어도 될까요?', '질문 4 / 5')
  await choose(page, '-3% (표준)')
  expect((await read(page)).turns.at(-1)).toMatchObject({ question: '-3% (표준)', requestText: '−3% (표준)' })
  await question(page, '수익은 어디서 확정할까요?', '질문 5 / 5')
  await choose(page, '익절 없이 진행')
  expect(await read(page)).toMatchObject({ mode: 'dip', pair: 'BTC/USDT', timeframe: '1시간봉', risk: '−3%', takeProfit: '미설정', phase: 'plan' })
  await expect(card(page)).toHaveCount(0)
  expect((await read(page)).turns).toHaveLength(8)
  expect(requests).toEqual([])
})

test('패널 직접 답변은 기존 초안을 사용하고 전송 즉시 이전 카드를 제거한다', async ({ page }) => {
  const requests = await begin(page, 'BTC 반등 1시간봉')
  await question(page, '한 번의 거래에서 얼마까지 잃어도 될까요?', '질문 1 / 2')
  await writeDraft(page, '손절 -2.5%로')
  await page.clock.fastForward(500)
  const before = await read(page)
  const staleOption = await card(page).getByRole('button', { name: '-5%', exact: true }).elementHandle()
  await expect(directInput(page)).toBeFocused()
  await expect(composer(page)).toHaveValue('손절 -2.5%로')
  await expect(card(page)).toHaveCount(1)
  expect((await read(page)).turns).toEqual(before.turns)
  expect((await read(page)).draft).toBe(before.draft)
  await directInput(page).press('Enter')
  await expect(card(page)).toHaveCount(0)
  // A retained, detached old option must not answer the following stage.
  await staleOption!.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  expect((await read(page)).turns).toHaveLength(before.turns.length + 1)
  await settle(page)
  await question(page, '수익은 어디서 확정할까요?', '질문 2 / 2')
  expect(await read(page)).toMatchObject({ risk: '−2.5%', takeProfit: '', draft: '' })
  expect(requests).toEqual([])
})

test('같은 카드 선택을 연속 클릭해도 답변과 다음 단계는 한 번만 생성한다', async ({ page }) => {
  const requests = await begin(page, 'BTC 반등')
  const before = await read(page)
  await card(page).getByRole('button', { name: '1시간마다', exact: true }).evaluate(node => {
    (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click()
  })
  await expect(card(page)).toHaveCount(0)
  expect((await read(page)).turns).toHaveLength(before.turns.length + 1)
  await settle(page)
  await question(page, '한 번의 거래에서 얼마까지 잃어도 될까요?', '질문 2 / 3')
  expect(await read(page)).toMatchObject({ timeframe: '1시간봉', risk: '', takeProfit: '' })
  expect(requests).toEqual([])
})

test('카드의 표시 라벨을 직접 입력해도 현재 질문에 답하며 익절 힌트 없이도 그대로 해석한다', async ({ page }) => {
  const requests = await begin(page, '전략을 만들어 주세요')
  const type = async (text: string) => {
    await writeDraft(page, text)
    await directInput(page).press('Enter')
    await expect(card(page)).toHaveCount(0)
    await settle(page)
    expect((await read(page)).turns.at(-1)?.question).toBe(text)
  }
  await type('차이를 더 알려주세요')
  await question(page, '진입 방식을 정해주세요', '질문 1 / 5')
  expect((await read(page)).mode).toBe('')
  await expect(page.locator('.g-amsg').last()).toContainText('반등 매수는 과매도 후 회복을 노립니다')
  await choose(page, '내려왔을 때 반등 매수')
  await type('AI 추천으로')
  expect(await read(page)).toMatchObject({ pair: 'BTC/USDT', timeframe: '', phase: 'timeframe' })
  await question(page, '얼마나 자주 확인할까요?', '질문 3 / 5')
  await type('AI 추천으로')
  expect(await read(page)).toMatchObject({ timeframe: '1시간봉', risk: '', phase: 'risk' })
  await type('-3% (표준)')
  expect(await read(page)).toMatchObject({ risk: '−3%', takeProfit: '', phase: 'take' })
  await question(page, '수익은 어디서 확정할까요?', '질문 5 / 5')
  await type('없이')
  expect(await read(page)).toMatchObject({ takeProfit: '미설정', phase: 'plan' })
  await expect(card(page)).toHaveCount(0)
  expect(requests).toEqual([])
})

test('설명 본문 없이 다음 질문만 있는 진행 중 턴은 새로고침 후 중단이 아닌 카드로 복원된다', async ({ page }) => {
  const requests = await begin(page, '전략을 만들어 주세요')
  await card(page).getByRole('button', { name: '내려왔을 때 반등 매수', exact: true }).click()
  const pending = await read(page)
  expect(pending.turns.at(-1)).toMatchObject({ status: 'running', fullAnswer: '', phase: 'pair' })
  expect(pending.turns.at(-1)!.suggestions.length).toBeGreaterThan(0)
  await expect(card(page)).toHaveCount(0)
  await page.reload()
  await settle(page)
  await question(page, '어떤 자산으로 할까요?', '질문 2 / 5')
  const restored = await read(page)
  expect(restored.id).toBe(pending.id)
  expect(restored.turns).toHaveLength(pending.turns.length)
  expect(restored.turns.at(-1)).toMatchObject({ id: pending.turns.at(-1)!.id, status: 'done', fullAnswer: '', phase: 'pair' })
  expect(restored.turns.at(-1)!.suggestions).toEqual(pending.turns.at(-1)!.suggestions)
  await expect(page.locator('.client-stopped')).toHaveCount(0)
  expect(requests).toEqual([])
})

test('건너뛰기 다섯 기본값은 사용자가 직접 쓴 문장과 구분되어 저장된다', async ({ page }) => {
  const requests = await begin(page, '전략을 만들어 주세요')
  const defaults = ['내려왔을 때 반등 매수', '추천', '추천', '−3% (표준)', '익절 +8% 설정']
  const labels = ['내려왔을 때 반등 매수', 'AI 추천으로', 'AI 추천으로', '-3% (표준)', '익절 +8% 설정'].map(label => `${skipLabel}: ${label}`)
  for (const [index, requestText] of defaults.entries()) {
    await expect(card(page).locator('.pg')).toHaveText(`5개 중 ${index + 1}`)
    await choose(page, skipLabel)
    expect((await read(page)).turns.at(-1)).toMatchObject({ question: labels[index], requestText })
  }
  const session = await read(page)
  expect(session).toMatchObject({ mode: 'dip', pair: 'BTC/USDT', timeframe: '1시간봉', risk: '−3%', takeProfit: '+8%', phase: 'plan' })
  await expect(page.locator('.g-umsg')).toHaveText(['전략을 만들어 주세요', ...labels])
  await expect(card(page)).toHaveCount(0)
  expect(requests).toEqual([])
})

test('확인 카드·진행 번호·표시/해석 문장·미전송 초안은 연구 기록 왕복과 새로고침 후 복원된다', async ({ page }) => {
  const requests = await begin(page, 'BTC 반등')
  await choose(page, '1시간마다')
  await question(page, '한 번의 거래에서 얼마까지 잃어도 될까요?', '질문 2 / 3')
  await writeDraft(page, '아직 결정하지 않은 손절 조건')
  await page.clock.fastForward(500)
  const before = await read(page), contents = await card(page).innerText()
  const history = page.locator('.client-sidebar').getByRole('button', { name: '연구 기록', exact: true })
  if (!await history.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await history.click()
  await expect(page.locator('#research-main')).toBeVisible()
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await expect(card(page)).toHaveCount(1)
  if (!await directInput(page).count()) await card(page).getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  expect(await card(page).innerText()).toBe(contents)
  await expect(composer(page)).toHaveValue(before.draft)
  await page.reload()
  await question(page, '한 번의 거래에서 얼마까지 잃어도 될까요?', '질문 2 / 3')
  if (!await directInput(page).count()) await card(page).getByRole('button', { name: '직접 답변 작성', exact: true }).click()
  expect(await card(page).innerText()).toBe(contents)
  await expect(composer(page)).toHaveValue(before.draft)
  const restored = await read(page)
  expect(restored.id).toBe(before.id)
  expect(restored.turns).toEqual(before.turns)
  expect(restored.turns.at(-1)).toMatchObject({ question: '1시간마다', requestText: '1시간' })
  expect(requests).toEqual([])
})

test('질문 카드의 7언어 조작부는 원문·조건·초안을 유지하며 바뀌고 선택 언어로 건너뛰기를 기록한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const requests = await begin(page, 'BTC 반등 1시간봉')
  await writeDraft(page, '보존할 직접 답변')
  await page.clock.fastForward(500)
  const before = await read(page)
  const node = await card(page).elementHandle()
  const languages = [
    ['ko', '직접 답변 작성', '질문', skipLabel],
    ['en', 'Write your own answer', 'Question', 'Skip this question (use the suggested value)'],
    ['ja', '自分で回答を入力', '質問', 'この質問をスキップ（推奨値を使用）'],
    ['zh-CN', '自行输入回答', '问题', '跳过此问题（使用建议值）'],
    ['zh-TW', '自行輸入回答', '問題', '跳過此問題（使用建議值）'],
    ['es', 'Escribe tu respuesta', 'Pregunta', 'Omitir esta pregunta (usar el valor sugerido)'],
    ['fr', 'Rédiger votre réponse', 'Question', 'Passer cette question (utiliser la valeur suggérée)'],
  ]
  for (const [language, , , skip] of languages) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(path)
      setClientPreference('language', language)
    }, language)
    await expect(directInput(page)).toHaveAccessibleName(marketQuestionText(language as ClientLanguage, 'direct'))
    await expect(card(page).locator('.pg')).toHaveText(marketQuestionText(language as ClientLanguage, 'page', { total: 2, current: 1 }))
    await expect(card(page).locator('.x')).toHaveAccessibleName(marketQuestionText(language as ClientLanguage, 'close'))
    await expect(card(page).locator('.skipb')).toHaveAccessibleName(skip)
    await expect(card(page).locator('h3')).toHaveText('한 번의 거래에서 얼마까지 잃어도 될까요?')
    await expect(composer(page)).toHaveValue(before.draft)
    expect(await node!.evaluate(element => element.isConnected)).toBe(true)
    expect((await read(page)).turns).toEqual(before.turns)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await card(page).locator('.skipb').click()
  await settle(page)
  expect((await read(page)).turns.at(-1)).toMatchObject({ question: `${languages.at(-1)![3]}: -3% (표준)`, requestText: '−3% (표준)' })
  await expect(composer(page)).toHaveValue(before.draft)
  expect(requests).toEqual([])
})

for (const width of [320, 1440]) for (const phase of ['risk', 'take'] as const) test(`${width}px ${phase} 질문 카드의 제목·설명·44px 버튼이 넘치지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  const requests = await begin(page, phase === 'risk' ? 'BTC 반등 1시간봉' : 'BTC 반등 1시간봉 손절 2%')
  await question(page, phase === 'risk' ? '한 번의 거래에서 얼마까지 잃어도 될까요?' : '수익은 어디서 확정할까요?', phase === 'risk' ? '질문 1 / 2' : '질문 1 / 1')
  await card(page).scrollIntoViewIfNeeded()
  await page.evaluate(() => document.fonts.ready)
  expect(await card(page).evaluate(node => {
    const style = getComputedStyle(node)
    return { background: style.backgroundColor, border: style.borderTopWidth, radius: style.borderTopLeftRadius }
  })).toEqual({ background: 'rgb(47, 47, 47)', border: '1px', radius: '20px' })
  for (const button of await card(page).getByRole('button').all()) {
    const box = await button.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
  expect(await card(page).evaluate(node => {
    const bounds = node.getBoundingClientRect()
    return bounds.left >= -1 && bounds.right <= innerWidth + 1
      && [...node.querySelectorAll<HTMLElement>('h3, .sub, button')].every(element => {
        const box = element.getBoundingClientRect()
        return box.left >= bounds.left - 1 && box.right <= bounds.right + 1 && element.scrollWidth <= element.clientWidth + 1
      })
  })).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`clarification-${phase}-${width}.png`), fullPage: false })
  expect(requests).toEqual([])
})
