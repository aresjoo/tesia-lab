import { expect, test } from '@playwright/test'
import { catalogueStrategies, catalogueSourceSha, catalogueTitle } from '../src/client-catalogue'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueIdentity, catalogueEquityWindow, catalogueOrders, catalogueDateReader, catalogueAnalysisRequest } from '../src/client-catalogue-presentation'
import { createCatalogueDisplayStore } from '../src/client-catalogue-display-store'
import { readCataloguePlanIntent } from '../src/client-catalogue-plan'
import { sharedHash } from '../src/client-shared-navigation'
import type { CataloguePreviewResult, CataloguePeriod } from '../src/client-catalogue-preview'
import { sharedPercent } from '../src/client-shared-number-format'

test.setTimeout(25_000)
async function envelope(id: string): Promise<CataloguePreviewResult> {
  const data = await loadCatalogueMarketData(), strategy = catalogueStrategies.find(s => s.id === id)!
  return { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, strategy, period: 'all', calculation: 'full-run', contextPeriod: 'selected',
    calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v },
    result: strategy.fut ? runCatalogueFuturesPreview(strategy, data) : runCatalogueSpotPreview(strategy, data) }
}

test('31종의 식별자·등록자·거래소는 분리되고 모든 주문은 계산 원장에 대응한다', async () => {
  for (const strategy of catalogueStrategies) {
    const identity = catalogueIdentity(strategy), value = await envelope(strategy.id), orders = catalogueOrders(value)
    expect(identity.nick).toBe(strategy.id); expect(identity.author).toBe(strategy.by)
    expect(identity.venue.logo).toBe(strategy.ex); expect(identity).not.toHaveProperty('parameters')
    expect(new Set(orders.map(order => order.id)).size).toBe(orders.length)
    for (const trade of value.result.trades) {
      expect(orders.find(order => order.id === `${trade.id}:entry`)).toMatchObject({ asset: trade.asset, date: trade.entry, price: trade.ep, units: Math.abs(trade.units) * 1000, amount: trade.cost * 1000 })
      expect(orders.find(order => order.id === `${trade.id}:exit`)).toMatchObject({ asset: trade.asset, date: trade.exit, price: trade.xp, amount: trade.got * 1000 })
    }
    for (const order of orders) {
      expect(order.signal === null || order.signal <= order.date).toBe(true)
      expect(Number.isFinite(order.price) && order.price > 0).toBe(true)
    }
    const request = catalogueAnalysisRequest(value)
    expect(request).toContain(JSON.stringify(strategy))
    expect(request).toContain(value.dataVersion.spot)
    if (strategy.fut) expect(request).not.toContain('RSI')
  }
})

test('개요 7·30·90·365일은 전기간의 표시창이며 날짜와 종료 거래 기준을 바꾸지 않는다', async () => {
  const value = await envelope('f1'), original = structuredClone(value)
  for (const days of [7, 30, 90, 365]) {
    const window = catalogueEquityWindow(value.result, days)!
    expect(window.eq).toHaveLength(days + 1)
    expect(window.eq[0].v).toBe(1)
    expect(window.ret).toBeCloseTo((value.result.eq.at(-1)!.v / value.result.eq.at(-(days + 1))!.v - 1) * 100, 12)
  }
  const full = catalogueEquityWindow(value.result, 0)!
  expect(full.eq).toBe(value.result.eq); expect(full.ret).toBe(value.result.ret)
  expect(value).toEqual(original)
  const date = catalogueDateReader(value.calendar)(value.result.params.endI)
  expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 9, 28])
  const zero = { ...value.result, eq: value.result.eq.map(p => ({ ...p, v: 0 })) }
  expect(catalogueEquityWindow(zero, 30)).toBeNull()
})

test('서비스에는 worker를 만들지 않고 구독 종료·상세 교체·재시도 후 늦은 응답을 버린다', async () => {
  const value = await envelope('f1')
  const calls: { id: string; period: CataloguePeriod; signal?: AbortSignal; resolve: (value: CataloguePreviewResult) => void; reject: (error: Error) => void }[] = []
  let made = 0, disposed = 0
  const factory = () => { made++; return { run: (id: string, period: CataloguePeriod, signal?: AbortSignal) => new Promise<CataloguePreviewResult>((resolve, reject) => calls.push({ id, period, signal, resolve, reject })), dispose: () => { disposed++ } } }
  const service = createCatalogueDisplayStore(false, 'owner', factory), unsubscribeService = service.subscribe(() => {})
  service.select('f1'); service.retry(); unsubscribeService(); expect(made).toBe(0)
  const store = createCatalogueDisplayStore(true, 'owner', factory), unsubscribe = store.subscribe(() => {})
  expect(made).toBe(1); store.select('f1'); const first = calls.at(-1)!
  store.select('f2'); expect(first.signal?.aborted).toBe(true)
  first.resolve(value); await Promise.resolve(); expect(store.getSnapshot().detail?.id).toBe('f2')
  calls.at(-1)!.reject(Error('private')); await Promise.resolve(); expect(store.getSnapshot().detail?.state).toBe('error')
  store.retry(); expect(disposed).toBe(1); expect(made).toBe(2)
  expect(store.getSnapshot().detail?.state).toBe('loading')
  const pending = calls.slice(); unsubscribe(); expect(disposed).toBe(2)
  const before = store.getSnapshot(); for (const call of pending) call.resolve(value)
  await Promise.resolve(); expect(store.getSnapshot()).toBe(before)
})

test('연결 플랜의 복귀 의도는 현재 계정·원본 세대·전략 ID가 모두 일치해야 한다', () => {
  const input = { owner: 'one', sourceSha: catalogueSourceSha, id: 'f1', returnHash: '#/share/s/f1/all/info' }
  expect(readCataloguePlanIntent(input, 'one')).toEqual(input)
  for (const bad of [{ ...input, owner: 'two' }, { ...input, sourceSha: 'old' }, { ...input, id: 'missing' }, { ...input, returnHash: '#/share/s/f2' }, { ...input, returnHash: 'https://example.test' }]) expect(readCataloguePlanIntent(bad, 'one')).toBeNull()
})

for (const width of [320, 1440]) test(`${width}px 실제 목록 첫10종→선물 상세→기간/정보/주문 동선`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 950 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/share')
  const cards = page.locator('.strategy-list-card')
  await expect(cards).toHaveCount(10)
  await expect(page.locator('.strategy-list-grid')).toHaveAttribute('aria-busy', 'false')
  await expect(cards.locator('h3')).toHaveText(catalogueStrategies.slice(0, 10).map(s => s.name))
  await cards.first().getByRole('link').click()
  const full = await envelope('f1')
  await expect(page.locator('.ss3-dtitle')).toHaveText(catalogueStrategies[0].name)
  await expect(page.locator('[data-catalogue-metric="ret"] b')).toHaveText(sharedPercent(catalogueEquityWindow(full.result, 30)!.ret, 'ko'))
  const n = await page.locator('[data-catalogue-metric="n"] b').innerText()
  for (const days of [7, 90, 365, 0]) {
    await page.getByLabel('기간 선택').selectOption(String(days))
    await expect(page.locator('[data-catalogue-metric="ret"] b')).toHaveText(sharedPercent(catalogueEquityWindow(full.result, days)!.ret, 'ko'))
    await expect(page.locator('[data-catalogue-metric="n"] b')).toHaveText(n)
    await expect(page.locator('.client-shared-equity-chart')).toHaveAttribute('data-point-count', String(days ? days + 1 : full.result.eq.length))
  }
  await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await expect(page.locator('.shared-detail-info')).toContainText('@noel_b')
  await expect(page.locator('.shared-detail-info')).toContainText('Binance')
  await expect(page.locator('.shared-detail-info')).not.toContainText('RSI')
  await expect(page.locator('.shared-detail-profile')).toHaveCount(0)
  await page.getByRole('tab', { name: '개요', exact: true }).click()
  const orders = catalogueOrders(full)
  await expect(page.locator('[data-catalogue-order]:visible')).toHaveCount(5)
  await page.getByRole('button', { name: '거래 내역', exact: true }).click()
  await expect(page.locator('[data-catalogue-order]:visible')).toHaveCount(Math.min(30, orders.length))
  await page.getByRole('button', { name: '개요로 돌아가기', exact: true }).first().click()
  await page.locator('.ss3-dtitle').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`catalogue-${width}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})

test('320px 7개 언어 KPI는 행 기준선을 맞추고 숫자를 분절하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 })
  await page.goto('/#/share/s/f1')
  await expect(page.locator('.catalogue-kpis')).toBeVisible()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    const metrics = await page.locator('.catalogue-kpis > div').evaluateAll(elements => elements.map(el => {
      const number = el.querySelector('b')!, range = document.createRange(); range.selectNodeContents(number)
      return { x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, baseline: number.getBoundingClientRect().y, lines: range.getClientRects().length }
    }))
    for (let i = 0; i < metrics.length - 1; i++) if (Math.abs(metrics[i].y - metrics[i + 1].y) < 1) expect(Math.abs(metrics[i].baseline - metrics[i + 1].baseline), language).toBeLessThan(1)
    expect(metrics.every(metric => metric.lines === 1), language).toBe(true)
  }
})

test('여러 전략의 같은 등록자·직접 주소·새로고침은 서로 다른 규칙과 결과를 유지한다', async ({ page }) => {
  const first = catalogueStrategies.find(s => catalogueStrategies.some(other => other.id !== s.id && other.by === s.by))!
  const second = catalogueStrategies.find(s => s.id !== first.id && s.by === first.by)!
  for (const row of [first, second]) {
    await page.goto(`/${sharedHash({ nick: row.id, period: 'all', detailTab: 'info' })}`)
    await expect(page.locator('.ss3-dtitle')).toHaveText(catalogueTitle(row.name))
    await expect(page.getByRole('tab', { name: '전략 정보', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.reload(); await expect(page.locator('.ss3-dtitle')).toHaveText(row.name)
  }
})

test('최신 전략 복사는 해당 거래소 플랜으로 연결되고 취소하면 같은 정보 탭에 돌아온다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '복사 검수', email: 'catalogue@example.test' })))
  await page.goto('/#/share/s/f1/all/info')
  await expect(page.locator('.ss3-dtitle')).toBeVisible()
  await page.locator('.shared-detail-actions .wbtn').click()
  await expect(page).toHaveURL(/#\/connect\/plan\?exchange=binance$/)
  expect(await page.evaluate(() => history.state.tethPlanCatalogue.id)).toBe('f1')
  await page.getByRole('button', { name: '뒤로', exact: true }).click()
  await expect(page).toHaveURL(/#\/share\/s\/f1\/all\/info$/)
  await expect(page.getByRole('tab', { name: '전략 정보', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('과거 별칭 관심 해제는 같은 ID만 제거하고 알 수 없는 저장 항목을 보존한다', async ({ page }) => {
  const name = catalogueStrategies[0].name
  const watchKey = 'teth-sharing-watch:account:alias-watch%40example.test'
  await page.addInitScript(({ name, watchKey }) => {
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '관심 전략 검수', email: 'alias-watch@example.test' }))
    sessionStorage.setItem(watchKey, JSON.stringify([name, '보존할-이전-전략']))
  }, { name, watchKey })
  await page.goto('/#/share/s/f1')
  const button = page.getByRole('button', { name: '즐겨찾기 해제', exact: true })
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await button.click()
  await expect(page.getByRole('button', { name: '즐겨찾기', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(await page.evaluate(watchKey => JSON.parse(sessionStorage.getItem(watchKey)!), watchKey)).toEqual(['보존할-이전-전략'])
})
