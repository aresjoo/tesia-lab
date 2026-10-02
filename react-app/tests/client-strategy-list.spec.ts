import { expect, test } from '@playwright/test'
import { sourceSharedStrategies, type SharedStrategy } from '../src/client-shared-strategies'
import { strategyListPerformance } from '../src/client-strategy-list-performance'
import { sourceTerminalDate } from '../src/client-terminal-source-fixture'
import { sharedPercent } from '../src/client-shared-number-format'
import listCopy from '../src/client-strategy-list-copy.json' with { type: 'json' }
import { strategyListSpark } from '../src/client-strategy-list-spark'
import { catalogueStrategies } from '../src/client-catalogue'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueListPerformance } from '../src/client-catalogue-presentation'
async function catalogueRows() {
  const data = await loadCatalogueMarketData()
  return catalogueStrategies.map(s => ({ ...s, performance: catalogueListPerformance(s.fut ? runCatalogueFuturesPreview(s, data) : runCatalogueSpotPreview(s, data))! }))
}

test('원본 미니차트는 평탄구간·0 기준선·손실 구간과 둥근 모서리를 보존한다', () => {
  expect(strategyListSpark([])).toBeNull()
  expect(strategyListSpark([1, NaN])).toBeNull()
  expect(strategyListSpark([1, 1, 1])).toMatchObject({ flat: true, negative: false, baseline: 39 })
  expect(strategyListSpark([1, 2])).toMatchObject({ flat: false, negative: false, path: 'M1.0 73.0 L169.0 5.0' })
  const crossing = strategyListSpark([1, 1, 0, 2])!
  expect(crossing.negative).toBe(true)
  expect(crossing.baseline).toBe(39)
  expect(crossing.flatAtBase).toBe('M1.0 39.0 L57.0 39.0 ')
  expect(crossing.path).toContain('Q57.0 39.0')
  expect(crossing.path).toContain('Q113.0 73.0')
  expect(crossing.path).toMatch(/ L169.0 5.0$/)
})

const date = (i: number) => new Date(Date.UTC(2030, 0, 1 + i))
test('최종 원본 목록은 폐기된 hero와 합성 카운터 없이 곧바로 탐색을 시작한다', async ({ page }) => {
  await page.goto('/#/share')
  await expect(page.locator('.hub-header h1')).toHaveText('전략 복사')
  await expect(page.locator('.client-strategy-sharing > .tfbk-hero')).toHaveCount(0)
  await expect(page.locator('.client-sharing-counter')).toHaveCount(0)
  await expect(page.locator('.strategy-list-card').first()).toBeInViewport({ ratio: 1 })
})
function strategy(): SharedStrategy {
  const original = structuredClone(sourceSharedStrategies()[0])
  original.parameters = { ...original.parameters, startI: 0, endI: 30 }
  original.result.eq = Array.from({ length: 31 }, (_, i) => ({ i, v: 2 + i / 100 }))
  return original
}
test('30일 성과는 첫 잔고 대비 재기준화하며 전체기간 수익을 재명명하지 않는다', () => {
  const row = strategy(), before = structuredClone(row)
  row.result.ret = 999
  const result = strategyListPerformance(row, false, date)!
  expect(result.percent).toBeCloseTo(15)
  expect(result.values).toHaveLength(31); expect(result.values[0]).toBe(1)
  expect(result.start).toBe(0); expect(result.end).toBe(30)
  expect(row.result.eq).toEqual(before.result.eq)
})
test('서비스의 짧은 기간·누락·비일봉·날짜 실패·손상은 30일 성과를 만들지 않는다', () => {
  for (const mutate of [
    (s: SharedStrategy) => { s.parameters.endI = 29 },
    (s: SharedStrategy) => { s.result.eq.splice(5, 1) },
    (s: SharedStrategy) => { s.result.eq[0].v = 0 },
    (s: SharedStrategy) => { s.result.eq[4].v = NaN },
    (s: SharedStrategy) => { s.result.eq.reverse() },
  ]) { const row = strategy(); mutate(row); expect(strategyListPerformance(row, false, date)).toBeNull() }
  expect(strategyListPerformance(strategy(), false, i => new Date(i * 60_000))).toBeNull()
  expect(strategyListPerformance(strategy(), false, () => { throw Error('private') })).toBeNull()
})
test('명시 preview만 평탄 잔고를 이어 쓰며 실제 서비스에서는 합성하지 않는다', () => {
  const row = strategy(); row.result.eq = [{ i: 0, v: 2 }, { i: 30, v: 3 }]
  expect(strategyListPerformance(row, true, date)?.percent).toBe(50)
  expect(strategyListPerformance(row, false, date)).toBeNull()
  for (const item of sourceSharedStrategies()) expect(strategyListPerformance(item, true, sourceTerminalDate)?.values).toHaveLength(31)
})

for (const width of [320, 760, 1440]) test(`${width}px 최신 전략 목록은 한 카드 한 링크와 30일 성과를 표시한다`, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/#/share')
  const cards = page.locator('.strategy-list-card')
  const rows = await catalogueRows()
  await expect(cards).toHaveCount(10)
  const grid = page.locator('.strategy-list-grid')
  expect(await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width <= 640 ? 1 : 2)
  await expect(grid).toHaveCSS('column-gap', width <= 1100 ? '14px' : '18px')
  for (const [index, row] of rows.entries()) {
    if (index % 10 === 0) await page.getByRole('navigation', { name: '페이지', exact: true }).getByLabel(`${Math.floor(index / 10) + 1}페이지`, { exact: true }).click()
    const card = cards.filter({ has: page.getByRole('link', { name: row.name, exact: true }) })
    await expect(card.locator('button')).toHaveCount(0)
    await expect(card.locator('.skf-ret')).toContainText(sharedPercent(row.performance.percent, 'ko'))
    await expect(card).not.toContainText('TETH 점수')
    await expect(card.locator('.skf-fw')).toContainText(row.fw.toLocaleString('ko'))
  }
  const link = cards.first().getByRole('link'), name = await link.getAttribute('aria-label')
  await link.scrollIntoViewIfNeeded(); await link.focus(); await expect(link).toBeFocused()
  expect(await link.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath(`list-${width}.png`) })
  await page.keyboard.press('Enter')
  await expect(page.locator('.ss3-dtitle')).toHaveText(name!)
  await page.goBack()
  await expect(cards.first()).toBeVisible()
  await cards.first().getByRole('link').click({ position: { x: 12, y: 12 } })
  await expect(page.locator('.ss3-dtitle')).toHaveText(name!)
  await expect(page.locator('.shared-detail-profile')).toHaveCount(0)
  await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await expect(page.locator('.shared-detail-info')).toContainText(rows.find(row => row.name === name)!.by)
})

test('정렬 메뉴는 원본 세 항목이며 30일 표시값 순서·검색·기존 관리 진입을 보존한다', async ({ page }) => {
  await page.goto('/#/share')
  const cards = page.locator('.strategy-list-card'), sort = page.getByRole('combobox', { name: '정렬 기준', exact: true })
  const rows = await catalogueRows()
  await expect(page.locator('.strategy-list-grid')).toHaveAttribute('aria-busy', 'false')
  await expect(sort).toHaveValue('pick')
  await expect(sort.locator('option')).toHaveText(['추천순', '최근 30일 수익률순', '복사한 사람순'])
  const names = async () => {
    const result: (string | null)[] = []
    const pager = page.getByRole('navigation', { name: '페이지', exact: true })
    for (let number = 1; number <= 4; number++) {
      await pager.getByLabel(`${number}페이지`, { exact: true }).click()
      result.push(...await cards.getByRole('link').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))))
    }
    await pager.getByLabel('1페이지', { exact: true }).click()
    return result.slice(0, 31)
  }
  expect(await names()).toEqual(rows.map(row => row.name))
  await sort.selectOption('ret')
  expect(await names()).toEqual([...rows].sort((a,b) => b.performance.percent-a.performance.percent).map(row => row.name))
  await sort.selectOption('fw')
  expect(await names()).toEqual([...rows].sort((a,b) => b.fw-a.fw).map(row => row.name))
  await page.getByRole('searchbox', { name: '전략 검색' }).fill(rows[0].name)
  await expect(cards).toHaveCount(1)
  await expect(cards.getByRole('link')).toHaveAccessibleDescription(/최근 30일/)
  await page.evaluate(() => { location.hash = '#/share/library' }); await expect(page.locator('#research-title')).toHaveText('따라가는 중')
  await expect(cards).toHaveCount(0)
  await page.getByRole('button', { name: '전략 찾기', exact: true }).click()
  await expect(cards).toHaveCount(1)
  await cards.getByRole('link').focus(); await page.keyboard.press('Space')
  await expect(page.locator('.ss3-dtitle')).toBeVisible()
})
test('실제 공급 목록에 30일 자료가 없으면 전기간 성과나 preview로 채우지 않는다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { const path = '/tests/fixtures/sharing-service-harness.tsx'; (await import(path)).mountSharing(true) })
  const card = page.locator('#sharing-test-root .strategy-list-card').first()
  await expect(card).toBeVisible()
  await expect(card.locator('.skf-ret b')).toContainText('정보 미제공')
  await expect(card.getByRole('link')).toHaveAccessibleDescription(/정보 미제공/)
  await expect(card.locator('.skf-ret b')).not.toHaveClass(/positive|negative/)
  await expect(card.locator('.skf-perf svg')).toHaveCount(0)
  await expect(card).not.toContainText('12.3%')
  await card.getByRole('link').click()
  await expect(page.locator('#sharing-test-root [data-metric="ret"] b')).toHaveText('+12.3%')
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) test(`${language} 목록은 확대해도 카드·정렬 라벨이 겹치지 않고 원문과 입력 DOM을 보존한다`, async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 1100 })
  await page.goto('/#/share')
  const search = page.getByRole('searchbox'), original = await search.elementHandle()
  await page.evaluate(async language => {
    const path = '/src/client-preferences.ts'
    ;(await import(path)).setClientPreference('language', language)
    document.documentElement.style.zoom = '2'
    await document.fonts.ready
  }, language)
  await expect(page.locator('.strategy-list-sort option')).toHaveText([listCopy[language].recommended, listCopy[language].returns, listCopy[language].following])
  expect(await search.evaluate((node, old) => node === old, original)).toBe(true)
  const cards = page.locator('.strategy-list-card'), link = cards.first().getByRole('link')
  await expect(cards.locator('h3')).toHaveText(catalogueStrategies.slice(0, 10).map(row => row.name))
  for (const card of await cards.all()) {
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    const metrics = card.locator('.skf-ret'), chart = card.locator('.skf-perf svg')
    if (await chart.count()) {
      const a = (await metrics.boundingBox())!, b = (await chart.boundingBox())!
      expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1)
      expect(b.width).toBeGreaterThan(32)
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  await link.scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`list-${language}-zoom.png`) })
  await link.click()
  await expect(page.locator('.ss3-dtitle')).toHaveText(catalogueStrategies[0].name)
})

for (const width of [320, 641, 760]) for (const zoom of [1, 2]) test(`${width}px ${zoom}배 긴 숫자·원문 경계값은 차트를 압착하지 않고 결측과 0을 구분한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/')
  await page.evaluate(async zoom => {
    const prefs = '/src/client-preferences.ts', fixture = '/tests/fixtures/strategy-list-card-harness.tsx'
    ;(await import(prefs)).setClientPreference('language', 'fr')
    ;(await import(fixture)).mountListCards()
    document.documentElement.style.zoom = String(zoom)
    await document.fonts.ready
  }, zoom)
  const cards = page.locator('#list-card-test-root .strategy-list-card')
  await expect(cards).toHaveCount(4)
  for (const card of await cards.all()) {
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    const number = card.locator('.skf-ret b')
    expect(await number.evaluate(el => {
      const range = document.createRange()
      // Measure the visible text, not the hidden description's descendants
      // or the wrapper span's different inline-box top edge.
      range.selectNodeContents(el.querySelector('[aria-hidden="true"]') ?? el)
      return [...range.getClientRects()].length
    })).toBe(1)
    const chart = card.locator('.skf-perf svg')
    if (await chart.count()) expect((await chart.boundingBox())!.width).toBeGreaterThanOrEqual(64)
  }
  await expect(cards.last().locator('.skf-ret b')).toContainText('Information non fournie')
  await expect(cards.last().getByRole('link')).toHaveAccessibleDescription(/Information non fournie/)
  await expect(cards.last().locator('.skf-perf svg')).toHaveCount(0)
  await expect(cards.nth(2).locator('.skf-ret b')).toHaveText('+0,0%')
  await expect(cards.nth(2).locator('.skf-ret b')).not.toHaveClass(/positive|negative/)
  await page.screenshot({ path: info.outputPath(`card-boundary-${width}.png`) })
})
