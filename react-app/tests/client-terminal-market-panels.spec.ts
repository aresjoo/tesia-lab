import { expect, test } from '@playwright/test'
import { boundTerminalMarket, marketPeriods, validMarketMetric } from '../src/client-terminal-market'
import { terminalMarketCopy, terminalMarketText } from '../src/client-terminal-market-copy'
import { terminalMarketFixture } from '../src/dev/terminal-market-fixture'

const isExternalMarketRequest = (address: string) => /binance|coingecko|tradingview\.com/.test(new URL(address).hostname)

test('외부 시장 요청 검사는 로컬 거래소 아이콘 경로를 외부 공급자로 오인하지 않는다', () => {
  expect(isExternalMarketRequest('http://127.0.0.1:4490/client-broker-assets/app-binance.png')).toBe(false)
  for (const address of ['https://api.binance.com/api/v3/klines', 'https://api.coingecko.com/api/v3/coins', 'https://www.tradingview.com/chart']) {
    expect(isExternalMarketRequest(address)).toBe(true)
  }
})

test('시장 자료는 전략·종목·시장·거래소가 모두 일치할 때만 표시한다', () => {
  const binding = terminalMarketFixture.binding
  const strategy = { ...binding, name: 'test', version: 'v1', status: 'ready' as const, exchange: { id: binding.exchangeId, name: 'test', color: '#333' }, capitalLabel: '—' }
  expect(boundTerminalMarket(strategy, terminalMarketFixture)).toBe(terminalMarketFixture)
  for (const delta of [{ id: 'other' }, { symbol: 'ETH/USDT' }, { market: '현물' }, { exchange: { ...strategy.exchange, id: 'other' } }]) expect(boundTerminalMarket({ ...strategy, ...delta }, terminalMarketFixture)).toBeUndefined()
  expect(boundTerminalMarket(undefined, terminalMarketFixture)).toBeUndefined()
  const resource = terminalMarketFixture.data!['5m']!
  if (resource.state !== 'ready') throw new Error('fixture missing')
  const metric = resource.value[0]
  expect(validMarketMetric(metric)).toBe(true)
  expect(validMarketMetric({ ...metric, points: [...metric.points, metric.points[0]] })).toBe(false)
  expect(validMarketMetric({ ...metric, series: [{ ...metric.series[0], values: [NaN, 1, 2, 3] }] })).toBe(false)
  expect(validMarketMetric({ ...metric, series: [{ ...metric.series[0], values: [1] }] })).toBe(false)
  expect(validMarketMetric({ ...metric, series: [{ ...metric.series[0], values: [null, null, null, null] }] })).toBe(false)
  for (const values of Object.values(terminalMarketCopy)) expect(values.every(value => value.trim().length > 0)).toBe(true)
})

for (const width of [320, 844, 1440]) test(`${width}px 원본 시장3탭·9기간·정보표·8지표와 차트 수명을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (isExternalMarketRequest(request.url())) requests.push(request.url()) })
  await page.goto('/account-terminal-preview.html?market=1')
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible()
  const originalCanvas = await canvas.elementHandle()
  await expect(page.locator('.ctm-header')).toContainText('99,000.00 USDT')
  await expect(page.locator('.ctm-header')).toContainText('TEST ONLY')
  const tabs = page.locator('.ctm-tabs')
  await tabs.getByRole('tab', { name: '차트', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: '정보', exact: true })).toBeFocused()
  await expect(page.locator('.ctm-info h3')).toHaveText('Bitcoin')
  await expect(page.locator('.ctm-links a')).toHaveCount(1)
  await expect(page.locator('.ctm-info-rows>div')).toHaveCount(13)
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath(`info-${width}.png`) })
  await page.keyboard.press('End')
  await expect(tabs.getByRole('tab', { name: '데이터', exact: true })).toBeFocused()
  await expect(page.locator('.ctm-data-card')).toHaveCount(8)
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(8)
  const periods = page.locator('.ctm-periods button')
  await expect(periods).toHaveCount(9)
  const firstMetric = page.locator('.ctm-data-card').first()
  await expect(firstMetric.locator('path')).toHaveAttribute('stroke', '#ececec')
  await expect(page.locator('.ctm-data-card').nth(1).locator('rect').first()).toHaveAttribute('fill', '#595959')
  await expect(periods.first()).toHaveCSS('border-radius', '999px')
  await expect(periods.first()).toHaveCSS('box-shadow', 'rgb(154, 154, 154) 0px 0px 0px 1px inset')
  await expect(page.locator('.ctm-values table')).toHaveCount(0)
  const original = await firstMetric.locator('path').getAttribute('d')
  // Gap at the third sample must start a new segment, not draw across missing data.
  expect(original?.match(/M/g)).toHaveLength(2)
  for (let i = 0; i < marketPeriods.length; i++) {
    await periods.nth(i).click()
    await expect(periods.nth(i)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.ctm-pane:not([hidden])>.ctm-source')).toContainText(`TEST ONLY · ${marketPeriods[i]}`)
    await firstMetric.locator('summary').click()
    await expect(firstMetric.locator('tbody tr').first().locator('td')).toHaveText(String(10 + i))
    await expect(firstMetric.locator('tbody tr').nth(2).locator('td')).toHaveText('—')
    await firstMetric.locator('summary').click()
  }
  await page.screenshot({ path: info.outputPath(`data-${width}.png`) })
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'; const { setClientPreference } = await import(/* @vite-ignore */ path); setClientPreference('language', language)
    }, language)
    await expect(tabs.getByRole('tab').last()).toHaveText(terminalMarketText(language, 'data'))
    expect(await page.locator('.ctm-data-card').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true)
  }
  await tabs.getByRole('tab').first().click()
  await expect(canvas).toBeVisible()
  expect(await canvas.evaluate((node, original) => node === original, originalCanvas)).toBe(true)
  await page.locator('.cat-expand').click()
  expect(await canvas.evaluate((node, original) => node === original, originalCanvas)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.cat-expand')).toBeFocused()
  // Choosing a different strategy clears old market facts, never repurposes them.
  if (await page.locator('.ctt-main-tabs').isVisible()) await page.locator('.ctt-main-tabs [role=tab]').last().click()
  await page.locator('.ctt-selector-button').click()
  await page.locator('.tft-select').nth(1).click()
  await expect(page.locator('.ctm-header')).not.toContainText('99,000.00')
  await expect(page.locator('.ctm-header')).toContainText('ETH/USDT')
  expect(errors).toEqual([]); expect(requests).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('미공급 자료를 과거 가격으로 채우지 않고 기간 전환도 빈 상태로 유지한다', async ({ page }) => {
  await page.goto('/account-terminal-preview.html')
  await expect(page.locator('.ctm-price>b')).toHaveText('—')
  await page.locator('.ctm-tabs [role=tab]').last().click()
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(0)
  await expect(page.locator('.ctm-data-card .ctm-state')).toHaveCount(8)
  await page.locator('.ctm-periods button').nth(4).click()
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(0)
})

for (const state of ['loading', 'error', 'stale'] as const) test(`${state} 시장 상태에서 이전 관측과 차트를 혼합하지 않는다`, async ({ page }) => {
  await page.goto(`/account-terminal-preview.html?market=${state}`)
  const label = terminalMarketText('ko', state === 'stale' ? 'unavailable' : state)
  await expect(page.locator('.ctm-price>b')).toHaveText('—')
  await expect(page.locator('.ctm-header .ctm-state')).toHaveText(label)
  await page.locator('.ctm-tabs [role=tab]').nth(1).click()
  await expect(page.locator('.ctm-pane:not([hidden])>.ctm-state')).toHaveText(label)
  await expect(page.locator('.ctm-info')).toHaveCount(0)
  await page.locator('.ctm-tabs [role=tab]').last().click()
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(0)
  await expect(page.locator('.ctm-data-card .ctm-state').first()).toHaveText(label)
})

test('미공급 기간으로 바꾸면 이전 기간 수치를 재사용하지 않는다', async ({ page }) => {
  await page.goto('/account-terminal-preview.html?market=partial')
  await page.locator('.ctm-tabs [role=tab]').last().click()
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(8)
  await page.locator('.ctm-periods button').nth(4).click()
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(0)
  await expect(page.locator('.ctm-data-card .ctm-state').first()).toHaveText(terminalMarketText('ko', 'unavailable'))
  await page.locator('.ctm-periods button').first().click()
  await expect(page.locator('.ctm-metric-svg')).toHaveCount(8)
})

test('데스크톱의 좁은 슬롯과 프랑스어200%에서도 헤더·정보·탭이 잘리지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
  await page.goto('/account-terminal-preview.html?market=1')
  await page.locator('.account-terminal-preview').evaluate(element => { element.style.width = '340px' })
  await page.locator('.ctm-tabs [role=tab]').nth(1).click()
  await page.locator('.ctt-terminal').evaluate(element => {
    const nodes = [...element.querySelectorAll<HTMLElement>('.ctm-header b,.ctm-header span,.ctm-header dt,.ctm-header dd,.ctm-tabs button,.ctm-info h3,.ctm-info h4,.ctm-info dt,.ctm-info dd,.ctm-info a')]
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, i) => { node.style.fontSize = `${sizes[i] * 2}px` })
  })
  expect(await page.locator('.ctm-header,.ctm-info,.ctm-tabs').evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 1))).toBe(true)
  await page.locator('.ctm-tabs [role=tab]').nth(1).focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.ctm-tabs [role=tab]').nth(1)).toHaveCSS('outline-style', 'solid')
  await page.screenshot({ path: info.outputPath('market-fr-200-container340.png') })
  await page.locator('.ctm-info h3').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('market-fr-200-info340.png') })
})
