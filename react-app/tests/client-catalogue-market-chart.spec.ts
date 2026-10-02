import { expect, test } from '@playwright/test'
import { catalogueAssets, catalogueStrategies } from '../src/client-catalogue'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { catalogueChartPrecision, projectCatalogueMarketChart, validCatalogueMarketChart } from '../src/client-catalogue-market-chart'
import { createCataloguePreviewClient, type CatalogueWorkerReply } from '../src/client-catalogue-preview'
import { priceChartIssue } from '../src/chart/price-chart-view'
import { chartWindowVwap } from '../src/chart/price-chart-studies'

test('31전략 전 종목의 원본 OHLC·종가·휴장일·출처를 그대로 투영하며 거래량을 만들지 않는다', async () => {
  const data = await loadCatalogueMarketData()
  for (const strategy of catalogueStrategies) for (const asset of catalogueAssets(strategy)) {
    const chart = projectCatalogueMarketChart(strategy.id, asset, data)
    expect(validCatalogueMarketChart(chart, strategy.id, asset)).toBe(true)
    if (strategy.fut) {
      const original = data.future.sym[asset]
      expect(chart.bars.map(b => [b.open, b.high, b.low, b.close])).toEqual(original.o.map((o, i) => [o, original.h[i], original.l[i], original.c[i]]))
      expect(chart.bars.every(b => b.volume === null)).toBe(true)
      expect(chart.closes).toEqual([])
    } else {
      expect(chart.closes.map(p => p.value)).toEqual(data.prices(asset).map((p, i) => data.isOpen(asset, i) ? p : undefined))
      expect(chart.bars).toEqual([])
      expect(chart.symbol).toBe(data.spot.meta[asset].sym)
    }
    const points = strategy.fut ? chart.bars : chart.closes
    expect(points[0].time).toBe(data.startMs / 1000)
    expect(points.at(-1)!.time).toBe(data.date(data.length - 1).getTime() / 1000)
    expect(validCatalogueMarketChart({ ...chart, strategyId: 'wrong' }, strategy.id, asset)).toBe(false)
    expect(validCatalogueMarketChart({ ...chart, sourceSha: 'wrong' }, strategy.id, asset)).toBe(false)
  }
  expect(() => projectCatalogueMarketChart('f1', 'not-in-strategy', data)).toThrow()
})

test('거래량 미제공 null과 실제 0을 구분하고 VWAP를 결측에서 끊는다', () => {
  const bars = [10, 20, 30, 40].map((p, i) => ({ time: 1700000000 + 60 * i, open: p, high: p, low: p, close: p, volume: [10, null, 0, 20][i] }))
  const view = { identity: 'test', sourceLabel: 'test input', market: 'test', resolutionSeconds: 60, pricePrecision: 2, fills: [], bars }
  expect(priceChartIssue(view)).toBeNull()
  expect(chartWindowVwap(bars, 60).map(p => p.value)).toEqual([10, undefined, undefined, 40])
  expect(catalogueChartPrecision([{ ...bars[0], low: 200 }])).toBe(2)
  expect(catalogueChartPrecision([{ ...bars[0], low: .04 }])).toBe(5)
  expect(catalogueChartPrecision([{ ...bars[0], low: .00000001 }])).toBe(8)
  for (const volume of [undefined, NaN, Infinity, -1]) expect(priceChartIssue({ ...view, bars: [{ ...bars[0], volume: volume as number }] })).not.toBeNull()
})

test('가격 worker 응답은 다른 종목·전략·깨진 시계열을 거절하고 취소 응답을 버린다', async () => {
  const data = await loadCatalogueMarketData(), s = catalogueStrategies.find(s => s.fut)!, asset = catalogueAssets(s)[0]
  const value = projectCatalogueMarketChart(s.id, asset, data)
  for (const change of [{ asset: 'wrong' }, { strategyId: 'wrong' }, { bars: [null] }, { bars: value.bars.slice().reverse() }, { market: 'spot' }, { calendar: { start: '2025-02-31', asof: data.spot.asof } }]) {
    const fake = { onmessage: null as null | ((event: MessageEvent<CatalogueWorkerReply>) => void), onerror: null, onmessageerror: null, postMessage() {}, terminate() {} }
    const client = createCataloguePreviewClient(() => fake)
    const promise = client.market(s.id, asset), rejected = expect(promise).rejects.toThrow('preview unavailable')
    fake.onmessage?.({ data: { kind: 'market-result', requestId: 1, value: { ...value, ...change } } } as MessageEvent<CatalogueWorkerReply>)
    await rejected; client.dispose()
  }
})

test('실제 Worker의 가격 조회는 선택한 원본 종목에 결속되고 잘못된 종목 후 복구한다', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const { createCataloguePreviewClient } = await import('/src/client-catalogue-preview.ts')
    const { catalogueAssets, findCatalogueStrategy } = await import('/src/client-catalogue.ts')
    const client = createCataloguePreviewClient(), asset = catalogueAssets(findCatalogueStrategy('f7')!)[0]
    try {
      const abort = new AbortController(), cancelled = client.market('f7', asset, abort.signal).catch((e: Error) => e.name)
      abort.abort()
      const invalid = await client.market('f7', 'missing').catch((e: Error) => e.message)
      const value = await client.market('f7', asset)
      return { cancelled: await cancelled, invalid, asset: value.asset, expected: asset, count: value.bars.length, volume: value.bars.every((b: { volume: unknown }) => b.volume === null), emptyCloses: value.closes.length }
    } finally { client.dispose() }
  })
  expect(result).toMatchObject({ cancelled: 'AbortError', invalid: 'catalogue preview unavailable', asset: result.expected, volume: true, emptyCloses: 0 })
  expect(result.count).toBeGreaterThan(730)
})
