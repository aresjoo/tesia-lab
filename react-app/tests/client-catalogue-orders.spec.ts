import { expect, test } from '@playwright/test'
import { readSharedLocation, sharedHash } from '../src/client-shared-navigation'
import { catalogueStrategies, catalogueSourceSha } from '../src/client-catalogue'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueOrders } from '../src/client-catalogue-presentation'
import copy from '../src/client-catalogue-orders-copy.json' with { type: 'json' }
import common from '../src/client-catalogue-ui-copy.json' with { type: 'json' }

test.setTimeout(30_000)
test('원본 거래내역 주소는 이름·기간을 보존하며 카피/작성자 주소와 섞이지 않는다', () => {
  for (const nick of ['d1', "사용자 ' 이름", 'a/b']) for (const period of ['all', '1y', '2y'] as const) {
    expect(readSharedLocation(sharedHash({ nick, period, detailTab: 'trades' }))).toEqual({ nick, period, detailTab: 'trades' })
  }
  expect(readSharedLocation('#/share/s/d1/all/unknown')).toEqual({ period: 'all' })
  expect(readSharedLocation('#/share/c/record/hist')).toMatchObject({ view: 'copy-detail', copyTab: 'hist' })
})

test('31종 주문 표시의 보유상태·실현손익은 실제 원장과 일치하고 진입행에는 손익을 만들지 않는다', async () => {
  const data = await loadCatalogueMarketData()
  for (const strategy of catalogueStrategies) {
    const result = strategy.fut ? runCatalogueFuturesPreview(strategy, data) : runCatalogueSpotPreview(strategy, data)
    const rows = catalogueOrders({ source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, strategy, period: 'all', calculation: 'full-run', contextPeriod: 'selected', calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v }, result })
    for (const trade of result.trades) {
      expect(rows.find(row => row.id === `${trade.id}:exit`)?.pnl).toBe(trade.pnl * 100)
      expect(rows.find(row => row.id === `${trade.id}:entry`)?.open).toBeUndefined()
    }
    expect(rows.filter(row => row.action === 'entry').every(row => row.pnl === undefined)).toBe(true)
    const open = result.state.open
    expect(rows.filter(row => row.open).map(row => row.positionId).sort()).toEqual((Array.isArray(open) ? open : open ? [open] : []).map(row => row.tid).sort())
  }
})

for (const width of [320, 1440]) test(`${width}px 최근5개→전체30개→50개추가→뒤로가기에서 차트·달력·읽던위치 보존`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' }); page.setDefaultTimeout(12_000)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/share/s/d1')
  await expect(page.locator('.catalogue-performance')).toBeVisible()
  await page.getByLabel('기간 선택', { exact: true }).selectOption('90')
  await page.getByRole('button', { name: '수익금', exact: true }).click()
  await page.getByRole('button', { name: '월별', exact: true }).click()
  await page.getByRole('button', { name: '이전 월', exact: true }).click()
  const month = await page.locator('.shared-calendar-heading h3 span').first().innerText()
  const chartBefore = await page.locator('.catalogue-equity-line').getAttribute('d')
  const open = page.getByRole('button', { name: '거래 내역', exact: true })
  await open.scrollIntoViewIfNeeded()
  const originalY = (await open.boundingBox())!.y
  const initialRows = await page.locator('[data-catalogue-order]:visible').evaluateAll(rows => rows.map(row => row.textContent))
  expect(initialRows).toHaveLength(5)
  await open.click(); await expect(page).toHaveURL(/\/d1\/all\/trades$/)
  const full = page.locator('.catalogue-orders-full')
  await expect(full.locator('[data-catalogue-order]')).toHaveCount(30)
  await expect(full.getByRole('heading', { name: '거래 내역', exact: true })).toBeFocused()
  const upperBack = full.getByRole('button', { name: '개요로 돌아가기', exact: true }).first()
  await expect(upperBack).toBeInViewport({ ratio: 1 })
  expect(await upperBack.evaluate(el => {
    const box = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
  })).toBe(true)
  expect(await full.locator('[data-catalogue-order]').evaluateAll(rows => rows.slice(0, 5).map(row => row.textContent))).toEqual(initialRows)
  await page.getByRole('button', { name: '이전 거래 더 보기', exact: true }).click()
  await expect(full.locator('[data-catalogue-order]')).toHaveCount(80)
  await full.getByRole('heading').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`orders-${width}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.goBack()
  await expect(open).toBeFocused()
  expect(Math.abs((await open.boundingBox())!.y - originalY)).toBeLessThan(3)
  await expect(page.getByLabel('기간 선택', { exact: true })).toHaveValue('90')
  await expect(page.getByRole('button', { name: '수익금', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '월별', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.shared-calendar-heading h3 span').first()).toHaveText(month)
  expect(await page.locator('.catalogue-equity-line').getAttribute('d')).toBe(chartBefore)
  await page.goForward(); await expect(full.locator('[data-catalogue-order]')).toHaveCount(30)
  await full.getByRole('button', { name: '개요로 돌아가기', exact: true }).first().click()
  await expect(open).toBeVisible(); await expect(page).toHaveURL(/#\/share\/s\/d1$/)
  // A second visit must capture the current position, not the previous visit.
  await open.evaluate(el => el.scrollIntoView({ block: 'start' }))
  const nextY = (await open.boundingBox())!.y
  await open.click(); await expect(full.locator('[data-catalogue-order]')).toHaveCount(30)
  await upperBack.click(); await expect(open).toBeFocused()
  expect(Math.abs((await open.boundingBox())!.y - nextY)).toBeLessThan(3)
  expect(errors).toEqual([])
})

test('직접주소·새로고침·정보탭 경유 복귀는 외부 페이지로 뒤로 가지 않는다', async ({ page }) => {
  await page.goto('/#/share/s/d1/all/trades'); await expect(page.locator('.catalogue-orders-full')).toBeVisible()
  await page.reload(); await expect(page.locator('.catalogue-orders-full [data-catalogue-order]')).toHaveCount(30)
  await page.getByRole('button', { name: '개요로 돌아가기', exact: true }).first().click()
  await expect(page.locator('.catalogue-performance')).toBeVisible()
  await page.getByRole('button', { name: '거래 내역', exact: true }).click()
  await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await page.goBack(); await expect(page.locator('.catalogue-orders-full')).toBeVisible()
  await page.getByRole('button', { name: '개요로 돌아가기', exact: true }).first().click()
  await expect(page.locator('.catalogue-performance')).toBeVisible()
  await expect(page.getByRole('tab', { name: '개요', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('더 보기 후 새로 추가된 첫 주문에 초점을 두며 마지막 묶음에서도 잃지 않는다', async ({ page }) => {
  await page.goto('/#/share/s/d1/all/trades')
  const full = page.locator('.catalogue-orders-full'), rows = full.locator('[data-catalogue-order]')
  await expect(rows).toHaveCount(30)
  const more = full.getByRole('button', { name: '이전 거래 더 보기', exact: true })
  for (const [previous, next] of [[30, 80], [80, 130], [130, 159]]) {
    await more.focus(); await more.press('Enter')
    await expect(rows).toHaveCount(next)
    await expect(rows.nth(previous)).toBeFocused()
    await expect(rows.nth(previous)).toBeInViewport()
  }
  await expect(more).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(full.getByRole('button', { name: '개요로 돌아가기', exact: true }).last()).toBeFocused()
})

test('7언어 전체 주문 화면은 같은 날짜·수량·손익을 유지하며 320px에서 표만 가로로 스크롤한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('/#/share/s/d1/all/trades')
  const full = page.locator('.catalogue-orders-full'); await expect(full).toBeVisible()
  const keys = await full.locator('[data-catalogue-order]').evaluateAll(rows => rows.map(row => row.getAttribute('data-catalogue-order')))
  for (const language of Object.keys(copy) as (keyof typeof copy)[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    await expect(full.getByRole('button', { name: copy[language].back, exact: true })).toHaveCount(2)
    await expect(full.getByRole('heading')).toHaveText(common[language].orders)
    expect(await full.locator('[data-catalogue-order]').evaluateAll(rows => rows.map(row => row.getAttribute('data-catalogue-order')))).toEqual(keys)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const scroll = full.locator('.shared-trades-scroll'); await scroll.evaluate(el => { el.scrollLeft = el.scrollWidth })
    expect(await scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  }
})
