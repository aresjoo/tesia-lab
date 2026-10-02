import { expect, test, type Locator, type Page } from '@playwright/test'
import { openLegacySourceConsumer } from './fixtures/legacy-source-entry'

async function compositionEscape(page: Page, input: Locator, dialog: Locator) {
  await input.fill('작성 중인 내용')
  await input.focus()
  const cdp = await page.context().newCDPSession(page)
  try {
    // Chromium composition state; this is not a native OS IME compatibility test.
    await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 })
    const value = await input.inputValue()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await expect(input).toBeFocused()
    await expect(input).toHaveValue(value)
    await expect(page.locator('dialog[open]')).toHaveCount(1)
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 })
  } finally { await cdp.detach() }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수자', email: 'review@example.test' })))
})

test('인사이트 조합 Escape는 질문을 보존하고 일반 Escape는 닫는다', async ({ page }) => {
  await page.goto('/#/insight/bitcoin-miner-cashflow')
  const trigger = page.locator('.nfz-ast').first()
  await trigger.click()
  const dialog = page.locator('.nfz-dialog')
  await compositionEscape(page, page.getByLabel('추가로 궁금한 점'), dialog)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('현재 Main 밖의 호환 리뷰 조합 Escape는 폐기 확인을 열지 않고 일반 Escape는 확인 후 복귀한다', async ({ page }) => {
  await openLegacySourceConsumer(page)
  await page.getByRole('button', { name: 'Binance 자세히', exact: true }).click()
  await page.getByRole('tab', { name: '리뷰', exact: true }).click()
  await page.getByRole('button', { name: '리뷰 남기기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Binance에 대해 다른 사람들과 의견 나누기', exact: true })
  const input = page.getByLabel('리뷰 내용')
  await compositionEscape(page, input, dialog)
  const draft = await input.inputValue()
  await page.keyboard.press('Escape')
  const confirm = page.getByRole('dialog', { name: '작성 중인 리뷰를 지울까요?', exact: true })
  await expect(confirm).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirm).toHaveCount(0)
  await expect(input).toBeFocused()
  await expect(input).toHaveValue(draft)
})

test('연구 이름 조합 Escape는 초안을 보존하고 일반 Escape는 저장 없이 복귀한다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: null, homeDraft: '', sessions: [{ id: 'ime-row', title: '기존 연구', renamed: true, idea: '추세 전략', draft: '', pair: 'BTC/USDT', mode: 'trend', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', phase: 'plan', workspace: 'conversation', tradingReady: false, researchStatus: '초안', updatedAt: Date.now(), turns: [] }] })))
  await page.goto('/')
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  const trigger = page.getByRole('button', { name: '기존 연구 관리', exact: true })
  await trigger.click()
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  const dialog = page.getByRole('dialog', { name: '연구 이름 변경', exact: true })
  await compositionEscape(page, page.getByLabel('연구 이름', { exact: true }), dialog)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await expect(page.locator('.client-session-row').first()).toContainText('기존 연구')
})
