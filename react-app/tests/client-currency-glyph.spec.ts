import { expect, test, type Page } from '@playwright/test'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

const amountSelector = '[data-strategy-id="user:1900"] .cap'
const parameters = delegationRecommendedParameters()
const evaluation = evaluateDelegation(parameters, 5000000)
const evaluated = { ...evaluation.result, score: evaluation.score }

async function previewCapital(page: Page, currency: 'BTC' | 'USD') {
  await page.addInitScript(({ value, parameters, evaluated }) => {
    localStorage.setItem('tethCurrency', value)
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '통화 글리프 검수', email: 'currency@example.test' }))
    // Explicit saved Mock display record. Main intentionally supplies no demo
    // strategies, and the unconnected assets pane must remain unavailable.
    sessionStorage.setItem('teth-client-user-strategies:currency%40example.test', JSON.stringify([{ sessionId: 'currency-saved-preview', record: {
      id: '1900', createdAt: 1900, name: '보존된 Mock 표시 전략', parameters, capital: 5000000,
      score: evaluated.score, ret: evaluated.ret, mdd: evaluated.mdd, n: evaluated.n, winRate: evaluated.winRate,
      status: 'off', environment: 'paper', asset: '비트코인', exchangeId: 'binance', exchangeName: 'Binance',
    } }]))
  }, { value: currency, parameters, evaluated })
  await page.goto('/#/trade')
  await expect(page.locator('.client-account-terminal')).toBeVisible()
  await page.locator('.ctt-selector-button').click()
  // The public asset pane intentionally requires an exchange connection. Use
  // the existing main-route preview capital consumer, not fabricated assets.
  await expect(page.locator(amountSelector)).toBeVisible()
  await expect(page.locator('.tft-rfoot')).toContainText('체험 모드 시뮬레이션')
  const assets = page.locator('.ctt-bottom-pane[data-tab-id="assets"]')
  await expect(assets).toHaveCount(1)
  await expect(assets.locator('.client-terminal-connection-empty')).toHaveCount(1)
  await expect(assets.locator('.tft-assets, table')).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
}

test('과거 BTC 표시 설정으로 진입해도 USD 운용자금과 기존 숫자 폰트를 유지한다', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await previewCapital(page, 'BTC')
  const amount = page.locator(amountSelector)
  await expect(amount).toContainText('$')
  await expect(amount).not.toContainText('₿')
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const document = await cdp.send('DOM.getDocument')
    const node = await cdp.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: amountSelector })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId })
    expect(fonts.some(font => font.postScriptName === 'NotoSans-Regular' && font.isCustomFont)).toBe(false)
    expect(fonts.some(font => font.postScriptName !== 'NotoSans-Regular' && font.isCustomFont && font.glyphCount > 1)).toBe(true)
  } finally { await cdp.detach() }
  const measured = await amount.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element)
    const style = getComputedStyle(element)
    return { lines: range.getClientRects().length, fontFamily: style.fontFamily, numeric: style.fontVariantNumeric }
  })
  expect(measured.lines).toBe(1)
  expect(measured.fontFamily).toContain('Noto Sans KR Variable')
  expect(measured.fontFamily).toContain('Noto Sans SC Variable')
  expect(measured.fontFamily).toContain('Geist Variable')
  expect(measured.numeric).toContain('tabular-nums')
  await page.locator('[data-strategy-id="user:1900"]').screenshot({ path: info.outputPath('main-preview-BTC-capital-glyph.png') })
  expect(errors).toEqual([])
})

test('메인 체험모드 USD 운용자금은 ₿ 전용 글꼴을 불필요하게 내려받지 않는다', async ({ page }, info) => {
  const symbolRequests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/client-fonts/noto-sans-btc.ttf')) symbolRequests.push(request.url()) })
  await previewCapital(page, 'USD')
  await expect(page.locator(amountSelector)).toContainText('$')
  await expect(page.locator('.teth-strategy-rail')).not.toContainText('₿')
  expect(symbolRequests).toEqual([])
  await page.locator('[data-strategy-id="user:1900"]').screenshot({ path: info.outputPath('main-preview-USD-capital-glyph.png') })
})
