import { expect, test, type Page, type Route } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeJob, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'
import { nativeResultText } from '../../src/internal-poc/native-result-copy'

test.use({ trace: 'off', video: 'off' })
const reportEnvelope = fixtures.sources[1].fixture as unknown as { response: { meta: Record<string, unknown>; data: NativeReport } }
const report = reportEnvelope.response.data
const queued = (fixtures.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data
// Display-only projection input, never a v7 COMPLETED wire response or a claim
// of actual market performance. Browser fetch and generated SDK remain real.
const displayJob = { ...queued, state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding }
const fixture = fixtures.sources[0].fixture as unknown as { meta: Record<string, unknown>; binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']; manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>; window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'> }
const trades = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { meta: unknown; data: NativeTrades } }[] }).pages
const utc = (value: number) => new Date(value).toISOString().replace('.000Z', 'Z')
const start = '2025-01-01T00:15:00Z'
const next = utc((Math.floor(Date.parse(start) / 3_600_000) + 1000) * 3_600_000)
const end = '2025-07-01T00:00:00Z'
const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store', ETag: '"synthetic_chart_window_0001"' }, body: JSON.stringify(body) })
type Controls = { requests: URL[]; failNext: boolean; hash: string; supported: NativeChartWindow['resolution'][]; end: string; partial: boolean; hold?: (url: URL) => Promise<void> }
async function setup(page: Page, multipleSeries: boolean | 'mark-only' = false) {
  const controls: Controls = { requests: [], failNext: false, hash: fixture.manifest.manifestContentHash, supported: ['1m', '15m', '1h', '1d'], end, partial: false }
  // Observe the real compiled module before lazy rendering can outlive this
  // test. Do not fetch/dispose an APIResponse from a late route callback.
  const response = await page.request.get('/src/components/ClientProfessionalPriceChart.tsx', { maxRetries: 0 })
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type'] ?? '').toMatch(/^(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i)
  const body = await response.text()
  expect(body).toContain('api.current = chart;')
  expect(body).toContain('candles.attachPrimitive(drawings);')
  expect(body.split('api.current = chart;')).toHaveLength(2)
  expect(body.split('candles.attachPrimitive(drawings);')).toHaveLength(2)
  const compiledBody = body
    .replace('api.current = chart;', 'api.current = chart; window.__nativeNavigationChart = chart;')
    .replace('candles.attachPrimitive(drawings);', 'candles.attachPrimitive(drawings); window.__nativeNavigationDrawings = drawings;')
  const headers = { ...response.headers(), 'content-length': String(Buffer.byteLength(compiledBody)) }
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', route => route.fulfill({ response, headers, body: compiledBody }))
  await page.route('**/api/v{5,6}/**', async route => {
    const url = new URL(route.request().url()); controls.requests.push(url)
    if (url.pathname.endsWith('native-report')) return reply(route, reportEnvelope.response)
    const segment = url.searchParams.get('segment') as 'IS' | 'OOS'
    if (url.pathname.endsWith('native-trades')) {
      const source = trades.find(item => item.name === (segment === 'IS' ? 'is-last' : 'oos-default'))!.response
      return reply(route, { ...source, data: { ...source.data, limit: 100 } })
    }
    const evaluation = report.nativeEnvelope.projection.segments.find(item => item.segment === segment)!
    const segmentBounds = { fromInclusive: evaluation.evaluationStartInclusive, toExclusive: evaluation.evaluationEndExclusive }
    const binding = { ...fixture.binding, segment, backtestId: displayJob.backtestId, splitGroupId: displayJob.splitGroupId,
      strategyVersionId: displayJob.strategyVersionId, semanticHash: displayJob.semanticHash, resultContentHash: evaluation.resultContentHash }
    const series = (multipleSeries ? [
      { ...fixture.manifest.series[0], seriesId: 'contract-1m', priceKind: 'contract', nativeResolution: '1m' },
      { ...fixture.manifest.series[0], seriesId: 'contract-15m', priceKind: 'contract', nativeResolution: '15m' },
      { ...fixture.manifest.series[0], seriesId: 'mark-1m', priceKind: 'mark', nativeResolution: '1m' },
    ] : fixture.manifest.series).filter(item => multipleSeries !== 'mark-only' || item.priceKind === 'mark').map(item => ({ ...item, supportedResolutions: controls.supported.filter(resolution => item.nativeResolution !== '15m' || resolution !== '1m'), availableRange: segment === 'OOS' ? { fromInclusive: start, toExclusive: controls.end } : segmentBounds }))
    if (url.pathname.endsWith('chart-manifest')) return reply(route, { meta: fixture.meta, data: { ...fixture.manifest, binding, sourcePolicy: fixture.sourcePolicy, segmentBounds, manifestContentHash: controls.hash, series } })
    if (controls.hold) await controls.hold(url)
    if (controls.failNext) { controls.failNext = false; return route.abort('failed') }
    const requestedRange = { fromInclusive: url.searchParams.get('fromInclusive')!, toExclusive: url.searchParams.get('toExclusive')! }
    const resolution = url.searchParams.get('resolution')
    const selectedSeries = series.find(item => item.seriesId === url.searchParams.get('seriesId'))!
    const closeTime = utc(Date.parse(requestedRange.fromInclusive) + 60_000)
    // Test-only one-minute fixture relocation: original OHLCV bytes preserved,
    // not a production reaggregation or a fabricated market-performance source.
    const partial = controls.partial && resolution === '1m'
    const bars = partial ? [{ ...fixture.window.bars[0], openTime: requestedRange.fromInclusive, closeTime, availableAt: closeTime }] : []
    const coverage = partial ? { status: 'PARTIAL', coveredRanges: [{ fromInclusive: requestedRange.fromInclusive, toExclusive: closeTime }], missingRanges: [{ fromInclusive: closeTime, toExclusive: requestedRange.toExclusive }] }
      : { status: 'UNAVAILABLE', coveredRanges: [], missingRanges: [requestedRange] }
    // UNAVAILABLE is valid server coverage, including zero bars. Do not invent
    // prices to make navigation tests render an apparently complete chart.
    return reply(route, { meta: fixture.meta, data: { ...fixture.window, binding, sourcePolicy: fixture.sourcePolicy, manifestContentHash: url.searchParams.get('manifestContentHash'), resolution,
      seriesId: selectedSeries.seriesId, nativeResolution: selectedSeries.nativeResolution, priceKind: selectedSeries.priceKind,
      aggregationPolicy: resolution === selectedSeries.nativeResolution ? 'NATIVE_CONFIRMED' : 'UTC_EPOCH_COMPLETE_OHLCV', requestedRange,
      bars, coverage } })
  })
  await page.route('**/native-chart-navigation-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>합성 SDK 차트 탐색 검수 · 실제 실행 성과 아님</p><div id="chart-test-root"></div></body></html>' }))
  await page.goto('/native-chart-navigation-test.html')
  await page.evaluate(async job => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const reactPath = '/@id/react', domPath = '/@id/react-dom/client', apiPath = '/src/internal-poc/native-service-api.ts', panelPath = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const { createNativeServiceApi } = await import(/* @vite-ignore */ apiPath)
    const { NativeServiceResult } = await import(/* @vite-ignore */ panelPath)
    const api = createNativeServiceApi(), audit: string[] = []
    const original = api.chart
    api.chart = async (...args: unknown[]) => {
      try { const value = await original(...args); audit.push(`${args[2]}:${value.window.resolution}:${value.window.requestedRange.fromInclusive}`); return value }
      catch (error) { audit.push('REJECTED'); throw error }
    }
    Object.assign(window, { chartNavigationApi: api, chartNavigationAudit: audit })
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('chart-test-root')).render((react.createElement ?? react.default.createElement)(NativeServiceResult, { api, job }))
  }, displayJob)
  await expect(page.getByText(/표시 구간:/)).toContainText('해상도 1d')
  return controls
}
const windows = (controls: Controls) => controls.requests.filter(url => url.pathname.endsWith('chart-window'))
const displayed = (page: Page) => page.getByText(/표시 구간:/)
const hourly = async (page: Page) => { await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1h'); await expect(displayed(page)).toContainText(`~ ${next}, 해상도 1h`) }
// The adapter audit fires before React consumes the promise. Observe across
// two paint opportunities, not merely that pre-commit audit notification.
const settleChartView = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
const expectEmptyChart = async (page: Page) => {
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await expect(page.locator('.cp-quote dd')).toHaveText(Array(6).fill('—'))
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__nativeNavigationChart').panes()
    .flatMap((pane: { getSeries(): { data(): unknown[] }[] }) => pane.getSeries())
    .reduce((count: number, series: { data(): unknown[] }) => count + series.data().length, 0))).toBe(0)
  await expect(page.getByRole('button', { name: '체결 순서 재생', exact: true })).toBeDisabled()
}

test('검증된 같은 series의 가격창 왕복은 canvas를 유지하고 빈 공급과 실패를 구분한다', async ({ page }) => {
  const controls = await setup(page)
  controls.partial = true
  await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1m')
  await expect(displayed(page)).toContainText('해상도 1m')
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  expect(canvas).not.toBeNull()
  const firstQuote = await page.locator('.cp-quote dd').first().textContent()
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(page.locator('.cp-quote dd').first()).not.toHaveText(firstQuote!)
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  controls.failNext = true
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(page.locator('.ctt-chart').getByRole('alert')).toBeVisible()
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  controls.partial = false
  await page.getByRole('button', { name: '같은 차트 범위 다시 조회', exact: true }).click()
  await expect(page.getByText('표시할 가격 데이터가 없습니다.', { exact: true })).toBeVisible()
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  controls.partial = true
  await page.getByRole('button', { name: '이전 차트 범위' }).click()
  await expect(page.getByText('표시할 가격 데이터가 없습니다.', { exact: true })).toHaveCount(0)
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1h')
  await expect(displayed(page)).toContainText('해상도 1h')
  // Resolution is a view of the same verified series, not a new annotation owner.
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
})

const drawingItems = (page: Page) => page.evaluate(() => JSON.stringify(Reflect.get(window, '__nativeNavigationDrawings').getSnapshot().items))
async function drawHorizontal(page: Page) {
  await page.getByRole('button', { name: '수평선', exact: true }).click()
  await page.locator('.cp-surface').press('End')
  await page.locator('.cp-surface').press('Enter')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__nativeNavigationDrawings').getSnapshot().items.length)).toBe(1)
}

test('실제 결과의 시간봉 왕복은 도형·지표·축 선택을 유지하며 새 manifest에서는 폐기한다', async ({ page }) => {
  const controls = await setup(page)
  controls.partial = true
  const resolution = page.getByRole('combobox', { name: '차트 해상도' })
  await resolution.selectOption('1m')
  await expect(displayed(page)).toContainText('해상도 1m')
  await drawHorizontal(page)
  const original = await drawingItems(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: '로그', exact: true }).click()
  await page.getByRole('button', { name: 'EMA 20', exact: true }).click()
  await resolution.selectOption('1h')
  await expect(displayed(page)).toContainText('해상도 1h')
  // An empty server window must not resurrect prices, but local annotations survive.
  await expectEmptyChart(page)
  expect(await drawingItems(page)).toBe(original)
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  await expect(page.getByRole('button', { name: '로그', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'EMA 20', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await resolution.selectOption('1m')
  await expect(displayed(page)).toContainText('해상도 1m')
  expect(await drawingItems(page)).toBe(original)
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  const counts = controls.requests.length
  await page.getByRole('button', { name: '되돌리기', exact: true }).click()
  expect(await drawingItems(page)).toBe('[]')
  await page.getByRole('button', { name: '다시 실행', exact: true }).click()
  expect(await drawingItems(page)).toBe(original)
  expect(controls.requests).toHaveLength(counts)
  controls.hash = '6'.repeat(64)
  await resolution.selectOption('1h')
  await expect(displayed(page)).toContainText('해상도 1h')
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(false)
  expect(await drawingItems(page)).toBe('[]')
  await expect(page.getByRole('button', { name: '로그', exact: true })).toHaveAttribute('aria-pressed', 'false')
})

for (const boundary of ['series', 'segment'] as const) test(`도형은 다른 ${boundary}의 결과에 이월되지 않는다`, async ({ page }) => {
  const controls = await setup(page, true)
  controls.partial = true
  await page.getByRole('combobox', { name: '차트 데이터' }).selectOption('contract-1m')
  await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1m')
  await expect(displayed(page)).toContainText('해상도 1m')
  await drawHorizontal(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  if (boundary === 'series') {
    await page.getByRole('combobox', { name: '차트 데이터' }).selectOption('mark-1m')
    await expect(page.locator('.cp-source')).toContainText('mark-1m · mark')
  } else {
    await page.getByRole('button', { name: 'IS', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'IS 가격 차트', exact: true })).toBeVisible()
    await expect(displayed(page)).toContainText('해상도 1d')
  }
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(false)
  expect(await drawingItems(page)).toBe('[]')
})

test('렌더러 실패는 결과를 보존하되 재생 진입을 잠그고 로컬 재시도로만 복구한다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const controls = await setup(page)
  controls.partial = true
  await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1m')
  const replay = page.getByRole('button', { name: nativeResultText('ko', 'viewOnChart'), exact: true })
  await expect(replay).toHaveAttribute('aria-disabled', 'false')
  await page.evaluate(() => {
    const chart = Reflect.get(window, '__nativeNavigationChart')
    const candle = chart.panes()[0].getSeries()[0]
    const original = candle.setData.bind(candle)
    let fail = true
    candle.setData = (data: unknown[]) => {
      if (fail && data.length) { fail = false; throw new Error('TEST_ONLY_NATIVE_RENDERER_FAILURE') }
      original(data)
    }
  })
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(page.locator('.cp-failure')).toBeVisible()
  await expect(replay).toHaveAttribute('aria-disabled', 'true')
  const reads = controls.requests.length
  // aria-disabled blocks ordinary interaction. Also verify the handler guard
  // against a dispatched click without Playwright waiting for enablement.
  await replay.dispatchEvent('click')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(controls.requests).toHaveLength(reads)
  await page.getByRole('button', { name: '차트 다시 표시', exact: true }).click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(replay).toHaveAttribute('aria-disabled', 'false')
  expect(controls.requests).toHaveLength(reads)
  expect(errors).toEqual([])
})

test('manifest가 제공하는 데이터만 선택하고 1분·마크 가격·이전 다음 범위를 유지한다', async ({ page }) => {
  const controls = await setup(page, true)
  const series = page.getByRole('combobox', { name: '차트 데이터' }), resolution = page.getByRole('combobox', { name: '차트 해상도' })
  await expect(series).toHaveValue('contract-15m')
  await expect(series.locator('option')).toHaveText(['contract-1m', 'contract-15m', 'mark-1m'])
  await expect(resolution.locator('option')).toHaveText(['15m', '1h', '1d'])
  await series.selectOption('contract-1m')
  await expect(page.locator('.cp-source')).toContainText('contract-1m · contract')
  await resolution.selectOption('1m')
  await expect(displayed(page)).toContainText('해상도 1m')
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(displayed(page)).not.toContainText(`표시 구간: ${start}`)
  expect(windows(controls).at(-1)!.searchParams.get('seriesId')).toBe('contract-1m')
  await page.getByRole('button', { name: '이전 차트 범위' }).click()
  await expect(displayed(page)).toContainText(`표시 구간: ${start}`)
  await series.selectOption('contract-15m')
  await expect(displayed(page)).toContainText('해상도 15m')
  await expect(resolution.locator('option[value="1m"]')).toHaveCount(0)
  await series.selectOption('mark-1m')
  await expect(page.getByText(/이 차트의 캔들은 마크 가격/)).toBeVisible()
  await resolution.selectOption('1m')
  await expect(displayed(page)).toContainText('해상도 1m')
  expect(windows(controls).at(-1)!.searchParams.get('seriesId')).toBe('mark-1m')
  expect(windows(controls).every(url => url.searchParams.get('maxPoints') === '1000')).toBe(true)
  await expect(page.getByText(/현재 MMR 미검증/)).toBeVisible()
})

test('실패한 데이터 전환은 이전 출처를 보존하고 같은 데이터로 재시도한다', async ({ page }) => {
  const controls = await setup(page, true)
  controls.failNext = true
  await page.getByRole('combobox', { name: '차트 데이터' }).selectOption('mark-1m')
  await expect(page.locator('.ctt-chart').getByRole('alert')).toBeVisible()
  await expect(page.getByText('요청한 데이터: mark-1m · 해상도 1d', { exact: true })).toBeVisible()
  await expect(page.locator('.cp-source')).toContainText('contract-15m · contract')
  await expect(page.getByText(/이 차트의 캔들은 마크 가격/)).toHaveCount(0)
  const failed = windows(controls).at(-1)!.search
  const reads = controls.requests.length
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page.getByText(nativeResultText(language, 'requestedChartData', { series: 'mark-1m', resolution: '1d' }), { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: nativeResultText(language, 'retryChartData'), exact: true })).toBeVisible()
    await expect(page.locator('.ctt-chart > p').filter({ hasText: /contract-15m · contract/ })).toContainText(nativeResultText(language, 'liquidationUnavailableShort'))
  }
  expect(controls.requests).toHaveLength(reads)
  await page.getByRole('button', { name: '차트 다시 조회', exact: true }).click()
  await expect(page.locator('.cp-source')).toContainText('mark-1m · mark')
  expect(windows(controls).at(-1)!.search).toBe(failed)
})

test('명시 데이터 선택 실패의 새 조회는 갱신된 manifest를 받아도 같은 범위라고 표시하지 않는다', async ({ page }) => {
  const controls = await setup(page, true)
  controls.failNext = true
  await page.getByRole('combobox', { name: '차트 데이터' }).selectOption('mark-1m')
  await expect(page.locator('.ctt-chart').getByRole('alert')).toBeVisible()
  controls.hash = '6'.repeat(64); controls.end = '2025-02-01T00:00:00Z'
  await expect(page.getByRole('button', { name: '같은 차트 범위 다시 조회', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '차트 다시 조회', exact: true }).click()
  await expect(page.locator('.cp-source')).toContainText('mark-1m · mark')
  await expect(displayed(page)).toContainText(`~ ${controls.end}`)
  expect(windows(controls).at(-1)!.searchParams.get('manifestContentHash')).toBe(controls.hash)
})

test('단일 series manifest에서 없는 종류는 선택할 수 없다', async ({ page }) => {
  const controls = await setup(page)
  await expect(page.getByRole('combobox', { name: '차트 데이터' }).locator('option')).toHaveText(['contract-1m'])
  const before = windows(controls).length
  const failure = await page.evaluate(async data => {
    const api = Reflect.get(window, 'chartNavigationApi')
    try { await api.chart(data.job, data.report, 'OOS', { seriesId: 'mark-1m' }); return 'UNEXPECTED_SUCCESS' }
    catch (error) { return (error as Error).message }
  }, { job: displayJob, report })
  expect(failure).toBe('NATIVE_CHART_UNAVAILABLE')
  expect(windows(controls)).toHaveLength(before)
})

test('계약상 유효한 mark-only 목록은 명시 가격 종류로 열고 계약 봉을 만들지 않는다', async ({ page }) => {
  const controls = await setup(page, 'mark-only')
  await expect(page.getByRole('combobox', { name: '차트 데이터' })).toHaveValue('mark-1m')
  await expect(page.getByText(/이 차트의 캔들은 마크 가격/)).toBeVisible()
  expect(windows(controls).map(url => url.searchParams.get('seriesId'))).toEqual(['mark-1m'])
  await expect(page.getByRole('alert')).toHaveCount(0)
})

for (const outcome of ['pending', 'failed'] as const) test(`${outcome} 1분 요청 중 데이터 종류를 바꿔도 선택한 1분 주기를 보존한다`, async ({ page }) => {
  const controls = await setup(page, true)
  const series = page.getByRole('combobox', { name: '차트 데이터' }), resolution = page.getByRole('combobox', { name: '차트 해상도' })
  await series.selectOption('contract-1m')
  await expect(page.locator('.cp-source')).toContainText('contract-1m · contract')
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  if (outcome === 'pending') controls.hold = url => url.searchParams.get('seriesId') === 'contract-1m' ? held : Promise.resolve()
  else controls.failNext = true
  await resolution.selectOption('1m')
  await expect.poll(() => windows(controls).at(-1)!.searchParams.get('resolution')).toBe('1m')
  if (outcome === 'failed') await expect(page.locator('.ctt-chart').getByRole('alert')).toBeVisible()
  await series.selectOption('mark-1m')
  await expect(page.locator('.cp-source')).toContainText('mark-1m · mark')
  await expect(displayed(page)).toContainText('해상도 1m')
  const count = await page.evaluate(() => Reflect.get(window, 'chartNavigationAudit').length)
  release()
  if (outcome === 'pending') await expect.poll(() => page.evaluate(() => Reflect.get(window, 'chartNavigationAudit').length)).toBe(count + 1)
  await settleChartView(page)
  await expect(series).toHaveValue('mark-1m')
  await expect(resolution).toHaveValue('1m')
  await expect(page.locator('.cp-source')).toContainText('mark-1m · mark')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('명시 데이터 변경은 새 manifest를 받고 320px부터 긴 번역 컨트롤을 겹치지 않게 표시한다', async ({ page }, info) => {
  const controls = await setup(page, true)
  controls.hash = '6'.repeat(64)
  await page.getByRole('combobox', { name: '차트 데이터' }).selectOption('mark-1m')
  await expect(page.locator('.cp-source')).toContainText('mark-1m · mark')
  expect(windows(controls).at(-1)!.searchParams.get('manifestContentHash')).toBe(controls.hash)
  await page.addStyleTag({ url: '/node_modules/@fontsource-variable/noto-sans-kr/index.css' })
  await page.addStyleTag({ url: '/node_modules/@fontsource-variable/geist/index.css' })
  const reads = controls.requests.length
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
      await page.evaluate(async language => {
        const path = '/src/client-preferences.ts'
        const { setClientPreference } = await import(/* @vite-ignore */ path)
        setClientPreference('language', language)
      }, language)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      const toolbar = page.locator('.native-chart-toolbar')
      await toolbar.scrollIntoViewIfNeeded()
      const geometry = await toolbar.evaluate(node => {
        const bounds = node.getBoundingClientRect()
        const controls = [...node.querySelectorAll('select,button')].map(item => item.getBoundingClientRect())
        return { fits: node.scrollWidth <= node.clientWidth && controls.every(item => item.left >= bounds.left && item.right <= bounds.right + 1),
          touch: controls.every(item => item.height >= 44),
          overlap: controls.some((a, i) => controls.some((b, j) => i < j && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)) }
      })
      expect(geometry).toEqual({ fits: true, touch: true, overlap: false })
      await toolbar.locator('select').first().focus()
      await expect(toolbar.locator('select').first()).toBeFocused()
      if ((width === 320 && language === 'fr') || (width === 1440 && language === 'ko')) {
        await page.evaluate(() => document.fonts.ready)
        await toolbar.screenshot({ path: info.outputPath(`chart-toolbar-${width}-${language}.png`) })
      }
    }
  }
  expect(controls.requests).toHaveLength(reads)
})

test('기본 일봉 유지, 명시 시간봉의 UTC 1000봉 이전·다음·마지막 경계와 빈 coverage', async ({ page }) => {
  const controls = await setup(page)
  const previous = page.getByRole('button', { name: '이전 차트 범위' }), forward = page.getByRole('button', { name: '다음 차트 범위' })
  await expect(previous).toBeDisabled(); await expect(forward).toBeDisabled()
  await hourly(page)
  await expect(previous).toBeDisabled(); await expect(forward).toBeEnabled()
  const tradeRequests = controls.requests.filter(url => url.pathname.endsWith('native-trades')).length
  await forward.click(); await expect(displayed(page)).toContainText(`표시 구간: ${next}`)
  await previous.click(); await expect(displayed(page)).toContainText(`표시 구간: ${start}`)
  for (let i = 0; i < 4; i++) {
    const before = windows(controls).length
    await forward.click()
    await expect.poll(() => windows(controls).length).toBe(before + 1)
    await expect(previous).toBeEnabled()
  }
  await expect(displayed(page)).toContainText(`~ ${end}, 해상도 1h`)
  await expect(forward).toBeDisabled()
  expect(controls.requests.filter(url => url.pathname.endsWith('native-trades'))).toHaveLength(tradeRequests)
  for (const url of windows(controls)) {
    const resolution = url.searchParams.get('resolution')!, bucket = resolution === '1d' ? 86_400_000 : 3_600_000
    const from = Date.parse(url.searchParams.get('fromInclusive')!), to = Date.parse(url.searchParams.get('toExclusive')!)
    expect(from).toBeGreaterThanOrEqual(Date.parse(start)); expect(to).toBeLessThanOrEqual(Date.parse(end))
    expect(Math.floor((to - 1) / bucket) - Math.floor(from / bucket) + 1).toBeLessThanOrEqual(1000)
  }
  await expect(page.getByText('표시할 가격 데이터가 없습니다.')).toBeVisible()
  await expect(page.getByText(/누락 데이터 1구간/)).toBeVisible()
  await expectEmptyChart(page)
  await expect(page.getByText(/현재 MMR 미검증/)).toBeVisible()
})

test('다음 창 실패는 마지막 차트 보존, 재시도는 실패한 같은 범위만 조회한다', async ({ page }) => {
  const controls = await setup(page); await hourly(page)
  controls.failNext = true
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(page.locator('.ctt-chart').getByRole('alert')).toContainText('마지막으로 확인한 표시 구간')
  await expect(displayed(page)).toContainText(`표시 구간: ${start}`)
  await expect(page.getByText(/요청한 시작 시각:/)).toContainText(next)
  const failed = windows(controls).at(-1)!.search
  await page.getByRole('button', { name: '같은 차트 범위 다시 조회' }).click()
  await expect(displayed(page)).toContainText(`표시 구간: ${next}`)
  expect(windows(controls).at(-1)!.search).toBe(failed)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

for (const change of ['segment', 'resolution'] as const) for (const outcome of ['success', 'failure'] as const) test(`지연 이전 창 ${outcome} 응답은 ${change} 전환 후 차트를 덮어쓰지 않는다`, async ({ page }) => {
  const controls = await setup(page); await hourly(page)
  let release: () => void = () => undefined
  const held = new Promise<void>(resolve => { release = resolve })
  let holding = false
  controls.hold = async url => { if (!holding && url.searchParams.get('fromInclusive') === next) { holding = true; await held } }
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect.poll(() => holding).toBe(true)
  if (change === 'segment') await page.getByRole('button', { name: 'IS', exact: true }).click()
  else await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1d')
  await expect(displayed(page)).toContainText('해상도 1d')
  const confirmed = await displayed(page).textContent()
  const requestCount = controls.requests.length
  const auditLength = await page.evaluate(() => (window as unknown as { chartNavigationAudit: string[] }).chartNavigationAudit.length)
  controls.failNext = outcome === 'failure'
  release()
  await expect.poll(() => page.evaluate(() => (window as unknown as { chartNavigationAudit: string[] }).chartNavigationAudit.length)).toBe(auditLength + 1)
  expect(await page.evaluate(() => (window as unknown as { chartNavigationAudit: string[] }).chartNavigationAudit.at(-1))).toBe(outcome === 'failure' ? 'REJECTED' : `OOS:1h:${next}`)
  await settleChartView(page)
  await expect(displayed(page)).toHaveText(confirmed!)
  await expect(page.getByRole('button', { name: '이전 차트 범위' })).toBeDisabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(controls.requests).toHaveLength(requestCount)
})

for (const outcome of ['success', 'failure'] as const) test(`같은 OOS 창으로 왕복한 뒤 이전 ${outcome} 응답은 새 조회 상태를 바꾸지 않는다`, async ({ page }) => {
  const controls = await setup(page); await hourly(page)
  let release: () => void = () => undefined
  const held = new Promise<void>(resolve => { release = resolve })
  let holding = false
  controls.hold = async url => {
    if (!holding && url.searchParams.get('segment') === 'OOS' && url.searchParams.get('fromInclusive') === next) {
      holding = true; await held
    }
  }
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect.poll(() => holding).toBe(true)
  await page.getByRole('button', { name: 'IS', exact: true }).click()
  await expect(page.locator('.ctt-chart > h3')).toHaveText('IS 가격 차트')
  await expect(displayed(page)).toContainText('해상도 1d')
  await page.getByRole('button', { name: 'OOS', exact: true }).click()
  await expect(page.locator('.ctt-chart > h3')).toHaveText('OOS 가격 차트')
  await expect(displayed(page)).toContainText('해상도 1d')
  await hourly(page)
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(displayed(page)).toContainText(`표시 구간: ${next}`)
  const confirmed = await displayed(page).textContent()
  const requestCount = controls.requests.length
  const auditLength = await page.evaluate(() => (window as unknown as { chartNavigationAudit: string[] }).chartNavigationAudit.length)
  const chartRoot = await page.locator('.cp-chart').elementHandle()
  controls.failNext = outcome === 'failure'
  release()
  await expect.poll(() => page.evaluate(() => (window as unknown as { chartNavigationAudit: string[] }).chartNavigationAudit.length)).toBe(auditLength + 1)
  expect(await page.evaluate(() => (window as unknown as { chartNavigationAudit: string[] }).chartNavigationAudit.at(-1))).toBe(outcome === 'failure' ? 'REJECTED' : `OOS:1h:${next}`)
  await settleChartView(page)
  await expect(displayed(page)).toHaveText(confirmed!)
  await expect(page.getByRole('button', { name: 'OOS', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: '다음 차트 범위' })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(await page.locator('.cp-chart').evaluate((node, before) => node === before, chartRoot)).toBe(true)
  expect(controls.requests).toHaveLength(requestCount)
  await chartRoot?.dispose()
})

test('관측 manifest 변경은 오래된 탐색 요청을 보내지 않으며 명시 해상도 변경은 새 범위를 읽는다', async ({ page }) => {
  const controls = await setup(page); await hourly(page)
  const before = windows(controls).length
  controls.hash = '6'.repeat(64)
  controls.end = '2025-02-01T00:00:00Z'
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(page.locator('.ctt-chart').getByRole('alert')).toContainText('차트 데이터를 확인하지 못했습니다')
  expect(windows(controls)).toHaveLength(before)
  await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1d')
  await expect(displayed(page)).toContainText('해상도 1d')
  await expect(displayed(page)).toContainText(`~ ${controls.end}`)
  expect(windows(controls).at(-1)!.searchParams.get('manifestContentHash')).toBe(controls.hash)
})

test('API는 지원하지 않는 해상도와 manifest 범위 밖 시작 시각을 window GET 전에 거절한다', async ({ page }) => {
  const controls = await setup(page)
  controls.supported = ['1m', '15m', '1d']
  const before = windows(controls).length
  const results = await page.evaluate(async data => {
    const api = (window as unknown as { chartNavigationApi: { chart: (...args: unknown[]) => Promise<unknown> } }).chartNavigationApi
    const selections = [{ resolution: '1h' }, { resolution: '5m' }, { fromInclusive: '2025-01-01T00:00:00Z' }, { fromInclusive: '2025-07-01T00:00:00Z' }, { fromInclusive: 'invalid' }, { fromInclusive: '2025-02-31T00:00:00Z' }]
    return Promise.all(selections.map(async selection => { try { await api.chart(data.job, data.report, 'OOS', selection); return 'UNEXPECTED_SUCCESS' } catch (error) { return (error as Error).message } }))
  }, { job: displayJob, report })
  expect(results).toEqual(Array(6).fill('NATIVE_RESULT_BINDING_CONFLICT'))
  expect(windows(controls)).toHaveLength(before)
})

test('명시 native 1분 해상도는 서버 PARTIAL 봉만 표시하며 다음 빈 창에 봉을 이어붙이지 않는다', async ({ page }) => {
  const controls = await setup(page); controls.partial = true
  await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('1m')
  await expect(displayed(page)).toContainText('해상도 1m')
  await expect(page.locator('p').filter({ hasText: /^SYNTHETIC_UI_FIXTURE · OOS · contract-1m · contract · PARTIAL · liquidation=UNAVAILABLE · 청산 검증 불가$/ })).toBeVisible()
  await expect(page.getByText(/누락 데이터 1구간/)).toBeVisible()
  await expect(page.locator('.cp-chart')).toBeVisible()
  const requestCount = controls.requests.length
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await page.getByRole('button', { name: 'BB 20·2', exact: true }).click()
  await expect(page.locator('[data-study=rsi]')).toHaveText('계산값 없음')
  await expect(page.locator('[data-study=bb]')).toHaveText('계산값 없음')
  expect(controls.requests).toHaveLength(requestCount)
  controls.partial = false
  await page.getByRole('button', { name: '다음 차트 범위' }).click()
  await expect(page.getByText('SYNTHETIC_UI_FIXTURE · OOS · contract-1m · contract · UNAVAILABLE · liquidation=UNAVAILABLE · 청산 검증 불가', { exact: true })).toBeVisible()
  await expect(page.getByText('표시할 가격 데이터가 없습니다.')).toBeVisible()
  await expectEmptyChart(page)
})
