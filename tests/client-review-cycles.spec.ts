import { expect, test, type Page } from '@playwright/test'

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
  await expect(actions.getByRole('status')).toHaveCount(0)
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

test('언어·통화 창에서 화면을 줄여도 검색 중인 열과 보이는 포커스를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.client-globe').click()
  const currency = page.locator('#locale-currency input')
  await currency.fill('KR')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(currency).toBeVisible()
  await expect(currency).toBeFocused()
  await expect(page.getByRole('tab', { name: '통화', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(currency).toHaveValue('KR')
  await page.setViewportSize({ width: 1440, height: 900 })
  const language = page.locator('#locale-language input')
  await language.fill('Eng')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(language).toBeVisible()
  await expect(language).toBeFocused()
  await expect(language).toHaveValue('Eng')
  await expect(page.getByRole('tab', { name: '언어', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('위임 차트 주기를 바꾸면 봉 개수·OHLC와 주기 설명이 함께 바뀐다', async ({ page }) => {
  await conversation(page)
  await page.evaluate(() => {
    sessionStorage.setItem('teth:client-delegation:cycles', JSON.stringify({ page: 'backtest', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1 }])), attempt: 1, workStep: 5, chartInterval: '1D' }))
  })
  await page.getByRole('button', { name: /^전략 맡기기/ }).click()
  const toolbar = page.locator('.tf-chart-toolbar')
  await expect(toolbar).toContainText('일봉 시뮬레이션')
  const daily = await page.locator('.tf-chart svg rect').count()
  const ohlc = page.locator('.tf-ohlc span')
  const dailyOhlc = await ohlc.allTextContents()
  await page.getByRole('button', { name: '1W', exact: true }).click()
  await expect(toolbar).toContainText('1W 시뮬레이션')
  const weekly = await page.locator('.tf-chart svg rect').count()
  expect(weekly).toBeLessThan(daily)
  await expect(ohlc).not.toHaveText(dailyOhlc)
  await page.getByRole('button', { name: '1M', exact: true }).click()
  await expect(toolbar).toContainText('1M 시뮬레이션')
  expect(await page.locator('.tf-chart svg rect').count()).toBeLessThan(weekly)
  await page.getByRole('button', { name: '1D', exact: true }).click()
  await expect(toolbar).toContainText('일봉 시뮬레이션')
  await expect(ohlc).toHaveText(dailyOhlc)
})
