import { expect, test, type Page } from '@playwright/test'
import type { PriceChartView } from '../src/chart/price-chart-view'
import { base, fixture } from '../src/dev/chart-workspace-fixture'
import { EXECUTION_DWELL_MS, priceExecutionTimeline } from '../src/chart/price-execution-timeline'
import { professionalChartLocale } from '../src/client-professional-chart-locale'

// Explicit renderer-only input, not a backend receipt or a strategy result.
const sameBar: PriceChartView = {
  ...fixture,
  fills: [
    { id: 'first-buy', tradeId: 'first-trade', time: base + 10, price: 101, side: 'BUY' },
    { id: 'second-sell', tradeId: 'first-trade', time: base + 20, price: 102, side: 'SELL' },
    { id: 'third-buy', tradeId: 'second-trade', time: base + 30, price: 103, side: 'BUY' },
  ],
}

async function mount(page: Page, input: PriceChartView = sameBar) {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.goto('/')
  await page.evaluate(async view => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const module = await import(/* @vite-ignore */ path)
    Object.assign(window, { priceChartHost: module.mount(view) })
  }, input)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
}

test('밀집 체결 일정은 최소60초·실제 봉 노출 이후·600ms 간격이며 원본 이벤트를 바꾸지 않는다', () => {
  const before = structuredClone(sameBar)
  const plan = priceExecutionTimeline(sameBar, sameBar.fills)
  expect(plan).toEqual({ at: [0, 600, 1200], duration: 60_000 })
  expect(sameBar).toEqual(before)
  const late = Array.from({ length: 100 }, (_, i) => ({ ...sameBar.fills[0], id: `late-${i}`, time: fixture.bars.at(-1)!.time + 10 }))
  const dense = priceExecutionTimeline({ ...fixture, fills: late }, late)
  expect(dense.at[0]).toBe(59_000)
  expect(dense.duration).toBe(119_000)
  expect(dense.at.every((time, i) => !i || time - dense.at[i - 1] === EXECUTION_DWELL_MS)).toBe(true)
  expect(priceExecutionTimeline(sameBar, sameBar.fills, 3, 15_000)).toEqual({ at: [], duration: 60_000 })
})

test('동일 봉의 BUY·SELL·BUY를 마지막 체결로 덮어쓰지 않고 읽을 수 있는 순서로 표시한다', async ({ page }) => {
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  const toast = page.locator('.cp-execution')
  await expect(toast.locator('b')).toHaveText('BUY')
  await expect(toast.locator('span')).toHaveText('101')
  await page.clock.runFor(500)
  await expect(toast.locator('span')).toHaveText('101')
  await page.clock.runFor(100)
  await expect(toast.locator('b')).toHaveText('SELL')
  await expect(toast.locator('span')).toHaveText('102')
  await page.clock.runFor(600)
  await expect(toast.locator('b')).toHaveText('BUY')
  await expect(toast.locator('span')).toHaveText('103')
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
})

test('체결 표시 대기 중 Skip하면 늦은 체결 효과 없이 같은 차트의 결과로 돌아온다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.locator('.cp-execution span')).toHaveText('101')
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await page.clock.runFor(2_000)
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-quote')).toContainText('221')
  await page.locator('.cp-surface').press('Home')
  await expect(page.locator('.cp-fills button')).toHaveCount(3)
  expect(errors).toEqual([])
})

test('마지막 봉에 밀집된100체결은60초에 잘리지 않고 마지막 효과 뒤 종료한다', async ({ page }) => {
  const dense: PriceChartView = { ...fixture, fills: Array.from({ length: 100 }, (_, i) => ({
    id: `dense-${String(i).padStart(3, '0')}`, tradeId: `trade-${i}`,
    time: fixture.bars.at(-1)!.time + 10, price: 1000 + i, side: i % 2 ? 'SELL' : 'BUY',
  })) }
  await mount(page, dense)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.fastForward(59_000)
  await expect(page.locator('.cp-execution span')).toHaveText('1,000')
  await page.clock.runFor(600)
  await expect(page.locator('.cp-execution span')).toHaveText('1,001')
  await page.clock.runFor(600)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution span')).toHaveText('1,002')
  for (let i = 3; i < 100; i++) {
    await page.clock.runFor(600)
    await expect(page.locator('.cp-execution span')).toHaveText((1000 + i).toLocaleString('ko-KR'))
  }
  await expect(page.locator('.cp-execution')).toHaveCount(1)
  await expect(page.locator('.cp-execution span')).toHaveText('1,099')
  await page.clock.runFor(500)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(100)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
})

test('동일 봉 대기 중 모션 줄이기를 켜면 이후 효과를 중단한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.locator('.cp-execution span')).toHaveText('101')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.runFor(100)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await page.clock.runFor(1_200)
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await expect(page.locator('.cp-sr-only')).toContainText('모션 줄이기 설정')
})

test('종료 전1200ms 타이머 지연은 중간 체결을 건너뛰지 않고 표시 시간을 보장한다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.locator('.cp-execution span')).toHaveText('101')
  await page.clock.fastForward(1_200)
  await expect(page.locator('.cp-execution span')).toHaveText('102')
  await page.clock.runFor(500)
  await expect(page.locator('.cp-execution span')).toHaveText('102')
  await page.clock.runFor(100)
  await expect(page.locator('.cp-execution span')).toHaveText('103')
})

test('동일 시각 체결은 식별자 사전순이 아닌 공급된 진입·청산 순서를 유지한다', async ({ page }) => {
  const tied = { ...sameBar, fills: sameBar.fills.map((fill, i) => ({ ...fill,
    id: ['z-entry', 'a-exit', 'm-entry'][i], time: base + 10,
  })) }
  await mount(page, tied)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.locator('.cp-execution b')).toHaveText('BUY')
  await expect(page.locator('.cp-execution span')).toHaveText('101')
  await page.clock.runFor(600)
  await expect(page.locator('.cp-execution b')).toHaveText('SELL')
  await expect(page.locator('.cp-execution span')).toHaveText('102')
  await page.clock.runFor(600)
  await expect(page.locator('.cp-execution span')).toHaveText('103')
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await page.locator('.cp-surface').press('Home')
  const rows = page.locator('.cp-fills button')
  await expect(rows).toHaveCount(3)
  expect(await rows.locator('b').allTextContents()).toEqual(['BUY', 'SELL', 'BUY'])
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const)
test(`${language}: 재생 체결은 같은 상태 노드로 안내하고 동일 값의 서로 다른 체결도 구분한다`, async ({ page }) => {
  const fills: PriceChartView['fills'] = [
    sameBar.fills[0], { ...sameBar.fills[0], id: 'second-identical-buy', tradeId: 'different-trade' },
    sameBar.fills[1], { ...sameBar.fills[0], id: 'out-of-window', time: base - 60 },
  ]
  await mount(page, { ...sameBar, fills })
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', language)
  }, language)
  const format = professionalChartLocale(language)
  const status = page.locator('.cp-sr-only[role="status"]')
  const original = await status.elementHandle()
  await expect(status).toHaveText('')
  await page.getByRole('button', { name: format.t('replay'), exact: true }).click()
  await expect(page.locator('.cp-execution span')).toHaveText('101')
  await expect(status).toContainText('1/3')
  await expect(status).toContainText('BUY')
  await expect(status).toContainText(format.utc(base + 10))
  await expect(status).toHaveAttribute('aria-live', 'polite')
  await expect(status).toHaveAttribute('aria-atomic', 'true')
  const first = await status.textContent()
  await page.clock.runFor(500)
  await expect(status).toHaveText(first!)
  await page.clock.runFor(100)
  await expect(status).toContainText('2/3')
  await expect(page.locator('.cp-execution span')).toHaveText('101')
  await page.clock.runFor(600)
  await expect(status).toContainText('3/3')
  await expect(status).toContainText('SELL')
  await expect(status).toContainText('102')
  expect(await status.evaluate((node, old) => node === old, original)).toBe(true)
  await page.getByRole('button', { name: format.t('skip'), exact: true }).click()
  await expect(status).toHaveText('')
  await page.clock.runFor(1_200)
  await expect(status).toHaveText('')
  await page.locator('.cp-surface').press('Home')
  await expect(status).toContainText(format.utc(base))
  expect(await status.evaluate((node, old) => node === old, original)).toBe(true)
})
