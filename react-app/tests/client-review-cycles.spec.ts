import { expect, test, type Page } from '@playwright/test'
import { delegationParameters } from '../src/client-delegation-engine'

async function conversation(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('teth-client-experience')) return
    const turn = { id: 'turn', question: '비트코인 반등 전략', answer: '조건을 검토해보세요.', fullAnswer: '조건을 검토해보세요.', status: 'done', startedAt: 1, suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'cycles', homeDraft: '', sessions: [{ id: 'cycles', title: '경계 검수', idea: turn.question, draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
  })
  await page.goto('/')
}

test('답변 복사는 성공 이후 실패하면 완료 표시를 해제하고 재시도할 수 있다', async ({ page }) => {
  await conversation(page)
  await page.evaluate(() => {
    let calls = 0
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { if (++calls === 2) throw new DOMException('Blocked', 'NotAllowedError') } } })
  })
  const actions = page.locator('.client-answer-actions')
  await actions.getByRole('button', { name: '답변 복사', exact: true }).click()
  await actions.getByRole('button', { name: '답변 복사 완료', exact: true }).click()
  await expect(actions.getByRole('status')).toHaveText('복사 권한을 확인해주세요.')
  await expect(actions.getByRole('button', { name: '답변 복사', exact: true })).toBeVisible()
  await expect(actions.getByRole('button', { name: '답변 복사 완료', exact: true })).toHaveCount(0)
  await actions.getByRole('button', { name: '답변 복사', exact: true }).click()
  await expect(actions.getByRole('button', { name: '답변 복사 완료', exact: true })).toBeVisible()
  await expect(actions.getByRole('status')).toHaveText('답변 복사 완료')
  await expect(actions.locator('.answer-copy-error')).toHaveCount(0)
})

test('대화 저장 경고를 닫아도 저장 복구 후 새 실패는 다시 알린다', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key === 'teth-client-experience' && sessionStorage.getItem('block-experience') === '1') throw new DOMException('Blocked', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await conversation(page)
  const draft = page.locator('.g-composer textarea')
  await page.evaluate(() => sessionStorage.setItem('block-experience', '1'))
  await draft.fill('첫 실패 초안')
  await expect(page.locator('.client-global-notice')).toContainText('저장하지 못했습니다')
  await page.getByRole('button', { name: '알림 닫기' }).click()
  await expect(page.locator('.client-global-notice')).toHaveCount(0)
  await page.evaluate(() => sessionStorage.setItem('block-experience', '0'))
  await draft.fill('저장 복구한 초안')
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('teth-client-experience')!).sessions[0].draft)).toBe('저장 복구한 초안')
  await page.evaluate(() => sessionStorage.setItem('block-experience', '1'))
  await draft.fill('두 번째 실패 초안')
  await expect(page.locator('.client-global-notice')).toContainText('저장하지 못했습니다')
  await expect(draft).toHaveValue('두 번째 실패 초안')
})

test('단일 언어 창에서 화면을 줄여도 검색과 보이는 포커스를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.client-globe').click()
  const language = page.locator('#locale-language input')
  await language.fill('한국')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(language).toBeVisible()
  await expect(language).toBeFocused()
  await expect(page.locator('.client-locale-panel [role="tab"]')).toHaveCount(0)
  await expect(language).toHaveValue('한국')
  await page.setViewportSize({ width: 1440, height: 900 })
  await language.fill('Eng')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(language).toBeVisible()
  await expect(language).toBeFocused()
  await expect(language).toHaveValue('Eng')
  await expect(page.locator('#locale-language li button')).toHaveCount(1)
})

test('보존 위임 세션의 차트 주기를 바꾸면 원본 종가 표본과 주기 설명이 함께 바뀐다', async ({ page }) => {
  const answers = Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1 }]))
  const parameters = delegationParameters(answers)
  await page.addInitScript(({ answers, parameters }) => {
    // The current strategy action begins source intake; it cannot resurrect an
    // arbitrary old cache as a completed backtest. Test a valid saved workspace.
    const turn = { id: 'turn', question: '비트코인 반등 전략', answer: '조건을 검토해보세요.', fullAnswer: '조건을 검토해보세요.', status: 'done', startedAt: 1, suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'cycles', homeDraft: '', sessions: [{ id: 'cycles', title: '경계 검수', idea: turn.question, draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'delegation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
    sessionStorage.setItem('teth:client-delegation:cycles', JSON.stringify({ page: 'backtest', answers, questionIndex: 5, attempt: 1, workStep: 5, expert: false, chartInterval: '1D', parameters }))
  }, { answers, parameters })
  await page.goto('/')
  const toolbar = page.locator('.tf-chart-toolbar')
  await expect(toolbar).toContainText('일별 종가')
  const line = page.locator('.tf-source-price')
  const daily = Number(await line.getAttribute('data-points'))
  const originalPath = await line.getAttribute('d')
  const readout = await page.locator('.tf-source-readout').innerText()
  await expect(page.locator('.tf-ohlc')).toHaveCount(0)
  await page.getByRole('button', { name: '1W', exact: true }).click()
  await expect(toolbar).toContainText('주간 종가')
  const weekly = Number(await line.getAttribute('data-points'))
  expect(weekly).toBeLessThan(daily)
  await expect(line).not.toHaveAttribute('d', originalPath!)
  await page.getByRole('button', { name: '1M', exact: true }).click()
  await expect(toolbar).toContainText('월간 종가')
  expect(Number(await line.getAttribute('data-points'))).toBeLessThan(weekly)
  await page.getByRole('button', { name: '1D', exact: true }).click()
  await expect(toolbar).toContainText('일별 종가')
  expect(Number(await line.getAttribute('data-points'))).toBe(daily)
  await expect(line).toHaveAttribute('d', originalPath!)
  // Resolution changes do not invent a different final-day price.
  await expect(page.locator('.tf-source-readout')).toHaveText(readout, { useInnerText: true })
})
