import { expect, test, type Page } from '@playwright/test'
import { fixture } from '../src/dev/chart-workspace-fixture'
import type { PriceChartView } from '../src/chart/price-chart-view'

// Renderer-only supplied inputs. Completion here ends the current display
// window, not a server job or an explanation of the full backtest period.
const dense: PriceChartView = { ...fixture, fills: Array.from({ length: 100 }, (_, i) => ({
  id: `old-${i}`, tradeId: `old-trade-${i}`, time: fixture.bars.at(-1)!.time + 10,
  price: 1000 + i, side: i % 2 ? 'SELL' : 'BUY',
})) }

async function mount(page: Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await page.evaluate(async view => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const module = await import(/* @vite-ignore */ path)
    Object.assign(window, { priceChartHost: module.mount(view) })
  }, dense)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.fastForward(59_000)
  await expect(page.locator('.cp-execution span')).toHaveText('1,000')
  return { errors, canvas }
}

for (const empty of [false, true]) test(`80초 밀집 재생의 ${empty ? '빈' : '과거 체결'} 마커 페이지 교체는 이전 효과를 폐기하고 같은 canvas 결과로 돌아온다`, async ({ page }) => {
  const { errors, canvas } = await mount(page)
  await page.clock.runFor(21_000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution span')).toHaveText('1,035')
  const replacement: PriceChartView = { ...dense, fills: empty ? [] : [
    { id: 'new-first', tradeId: 'new-trade', time: fixture.bars[0].time + 10, price: 9001, side: 'BUY' },
    { id: 'new-last', tradeId: 'new-trade', time: fixture.bars.at(-1)!.time + 20, price: 9002, side: 'SELL' },
  ] }
  // Price identity, OHLC and metadata are unchanged: this is only an overlay.
  await page.evaluate(view => {
    const prices: string[] = []
    const observer = new MutationObserver(() => {
      const price = document.querySelector('.cp-execution span')?.textContent
      if (price) prices.push(price)
    })
    observer.observe(document.querySelector('.cp-chart')!, { childList: true, subtree: true, characterData: true })
    Object.assign(window, { overlayReplayPrices: prices, stopOverlayReplayObserver: () => observer.disconnect() })
    Reflect.get(window, 'priceChartHost').render(view)
  }, replacement)
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  const duringReplacement = await page.evaluate(() => Reflect.get(window, 'overlayReplayPrices'))
  expect(duringReplacement).not.toContain('9,001')
  expect(duringReplacement).not.toContain('9,002')
  await page.evaluate(() => { Reflect.get(window, 'overlayReplayPrices').length = 0 })
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  await page.clock.runFor(99)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(1)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.locator('.cp-quote')).toContainText('221')
  await page.clock.runFor(60_000)
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'overlayReplayPrices'))).toEqual([])
  await page.locator('.cp-surface').press('End')
  await expect(page.locator('.cp-fills button')).toHaveCount(empty ? 0 : 1)
  if (!empty) {
    await expect(page.locator('.cp-fills button')).toContainText('9,002')
    await page.locator('.cp-fills button').click()
    await expect(page.locator('#selected-fill')).toHaveText('new-last')
  }
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'stopOverlayReplayObserver')())
  expect(errors).toEqual([])
})

test('밀집 연장 중1200ms 정체 전후 진행률은 감소하지 않고 다음 체결의600ms 간격을 보존한다', async ({ page }) => {
  const { errors, canvas } = await mount(page)
  await page.clock.runFor(21_000)
  const progress = () => page.getByRole('progressbar').getAttribute('value').then(Number)
  const before = await progress()
  expect(before).toBeGreaterThan(.6)
  expect(before).toBeLessThan(1)
  await page.clock.fastForward(1_200)
  await expect(page.locator('.cp-execution span')).toHaveText('1,036')
  const after = await progress()
  expect(after).toBeGreaterThanOrEqual(before)
  await page.clock.runFor(500)
  await expect(page.locator('.cp-execution span')).toHaveText('1,036')
  expect(await progress()).toBeGreaterThanOrEqual(after)
  await page.clock.runFor(100)
  await expect(page.locator('.cp-execution span')).toHaveText('1,037')
  expect(await progress()).toBeGreaterThanOrEqual(after)
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  expect(errors).toEqual([])
})
