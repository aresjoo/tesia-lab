import { expect, test, type Page, type Route } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeJob, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'

test.use({ trace: 'off', video: 'off' })
const reportEnvelope = fixtures.sources[1].fixture as unknown as { meta: unknown; response: { meta: Record<string, unknown>; data: NativeReport } }
const report = reportEnvelope.response.data
const queued = (fixtures.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data
// Isolated result-display input only. This is never a forged v7 COMPLETED wire
// response and is not evidence of an actual completed source-bound backtest.
const displayJob = { ...queued, state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding }
const chart = fixtures.sources[0].fixture as unknown as { meta: Record<string, unknown>; binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']; manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>; window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'> }
const tradePages = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { meta: Record<string, unknown>; data: NativeTrades } }[] }).pages
const errors: Record<number, string> = { 401: 'AUTHENTICATION_REQUIRED', 403: 'FORBIDDEN' }

const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store', ETag: '"synthetic_boundary_etag_0001"' }, body: JSON.stringify(body) })
function chartBody(url: URL) {
  const segment = url.searchParams.get('segment') as 'IS' | 'OOS'
  const evaluation = report.nativeEnvelope.projection.segments.find(item => item.segment === segment)!
  const segmentBounds = { fromInclusive: evaluation.evaluationStartInclusive, toExclusive: evaluation.evaluationEndExclusive }
  const binding = { ...chart.binding, segment, backtestId: displayJob.backtestId, splitGroupId: displayJob.splitGroupId,
    strategyVersionId: displayJob.strategyVersionId, semanticHash: displayJob.semanticHash, resultContentHash: evaluation.resultContentHash }
  if (url.pathname.endsWith('chart-manifest')) return { meta: chart.meta, data: { ...chart.manifest, binding, sourcePolicy: chart.sourcePolicy, segmentBounds,
    series: chart.manifest.series.map(item => ({ ...item, availableRange: segmentBounds })) } }
  const requestedRange = { fromInclusive: url.searchParams.get('fromInclusive'), toExclusive: url.searchParams.get('toExclusive') }
  return { meta: chart.meta, data: { ...chart.window, binding, sourcePolicy: chart.sourcePolicy, resolution: url.searchParams.get('resolution'), aggregationPolicy: 'UTC_EPOCH_COMPLETE_OHLCV', requestedRange,
    bars: [], coverage: { status: 'UNAVAILABLE', coveredRanges: [], missingRanges: [requestedRange] } } }
}
function tradesBody(url: URL, empty = false) {
  const segment = url.searchParams.get('segment')
  const source = tradePages.find(item => item.name === (segment === 'IS' ? 'is-last' : 'oos-default'))!.response
  return { ...source, data: { ...source.data, limit: 100, ...(empty ? { trades: [] } : {}) } }
}
async function mount(page: Page) {
  await page.route('**/native-result-boundary-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><p>합성 결과 UI·실제 SDK 오류 경계 검수. 실제 서버 권위/공급자/실행 완료 증거 아님.</p><div id="boundary-root"></div></body></html>' }))
  await page.goto('/native-result-boundary-test.html')
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
    Object.assign(window, { resultBoundaryAudit: audit })
    for (const method of ['report', 'trades', 'chart']) {
      const original = api[method]
      api[method] = async (...args: unknown[]) => {
        const segment = method === 'trades' ? args[1] : method === 'chart' ? args[2] : ''
        try { const value = await original(...args); audit.push(`${method}:${segment}:RESOLVED`); return value }
        catch (error) { audit.push(`${method}:${segment}:${(error as { code?: string }).code ?? 'UNEXPECTED_ERROR'}`); throw error }
      }
    }
    // Real production API, real generated validators and real browser fetch;
    // only the server responses and initial display job are synthetic fixtures.
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('boundary-root')).render((react.createElement ?? react.default.createElement)(NativeServiceResult, { api, job }))
  }, displayJob)
}
const audit = (page: Page) => page.evaluate(() => (window as unknown as { resultBoundaryAudit: string[] }).resultBoundaryAudit)

for (const resource of ['report', 'trades', 'chart', 'chart-window'] as const) for (const status of [401, 403]) {
  test(`실제 SDK ${resource} ${status}는 합성 결과 UI의 검증된 데이터와 실패를 분리한다`, async ({ page }) => {
    const requests: string[] = []
    const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(error.name))
    await page.route('**/api/v{5,6}/**', route => {
      const url = new URL(route.request().url()); requests.push(url.pathname)
      const target = resource === 'report' ? url.pathname.endsWith('native-report') : resource === 'trades' ? url.pathname.endsWith('native-trades') : url.pathname.endsWith(resource === 'chart' ? 'chart-manifest' : 'chart-window')
      if (target) {
        const version = resource.startsWith('chart') ? '0.5.0' : '0.6.0'
        return reply(route, { meta: { ...reportEnvelope.response.meta, apiContractVersion: version }, error: { code: errors[status], message: resource.startsWith('chart') ? 'Result request failed.' : 'Native result request failed.' } }, status)
      }
      return reply(route, url.pathname.endsWith('native-report') ? reportEnvelope.response : url.pathname.endsWith('native-trades') ? tradesBody(url) : chartBody(url))
    })
    await mount(page)
    await expect.poll(() => audit(page)).toContain(`${resource === 'chart-window' ? 'chart' : resource}:${resource === 'report' ? '' : 'OOS'}:${errors[status]}`)
    if (resource === 'report') {
      await expect(page.getByRole('alert')).toContainText('검증된 보고서를 가져오지 못했습니다')
      await expect(page.getByRole('region', { name: '백테스트 결과' })).toHaveCount(0)
      expect(requests).toHaveLength(1)
    } else {
      const result = page.getByRole('region', { name: '백테스트 결과' })
      await expect(result).toContainText('합성 계약 fixture · 실제 시장 성과 아님')
      await expect(result).toContainText(resource === 'trades' ? '거래 내역을 확인하지 못했습니다.' : '차트 데이터를 확인하지 못했습니다.')
      if (resource === 'trades') await expect(result.getByText('evt_native_entry_oos_0001', { exact: true })).toHaveCount(0)
      else await expect(result.locator('.cp-chart')).toHaveCount(0)
    }
    await expect.poll(async () => (await audit(page)).length).toBe(resource === 'report' ? 1 : 3)
    const originalRequests = [...requests]
    const root = page.locator('.native-service-result'), originalRoot = await root.elementHandle()
    for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
      await page.evaluate(async language => {
        const path = '/src/client-preferences.ts'
        const { setClientPreference } = await import(/* @vite-ignore */ path)
        setClientPreference('language', language)
      }, language)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      if (language !== 'ko') {
        await expect(root.locator(':scope > h2')).not.toContainText(/[가-힣]/)
        for (const text of await root.locator('[role="alert"]').allTextContents()) expect(text).not.toMatch(/[가-힣]/)
      }
      expect(await root.evaluate((node, before) => node === before, originalRoot)).toBe(true)
      expect(requests).toEqual(originalRequests)
    }
    await originalRoot?.dispose()
    expect(pageErrors).toEqual([])
  })
}

test('SDK UNAVAILABLE 빈 차트와 빈 거래는 UI에서 허구 봉·거래로 채우지 않는다', async ({ page }) => {
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', async route => {
    const response = await route.fetch()
    const body = await response.text()
    expect(body).toContain('api.current = chart;')
    expect(body).toContain('const markerPlugin = createSeriesMarkers(')
    await route.fulfill({ response, body: body
      .replace('api.current = chart;', 'api.current = chart; window.__emptyResultChart = chart;')
      .replace('const markerPlugin = createSeriesMarkers(', 'const markerPlugin = window.__emptyResultMarkers = createSeriesMarkers(') })
  })
  await page.route('**/api/v{5,6}/**', route => {
    const url = new URL(route.request().url())
    return reply(route, url.pathname.endsWith('native-report') ? reportEnvelope.response : url.pathname.endsWith('native-trades') ? tradesBody(url, true) : chartBody(url))
  })
  await mount(page)
  const result = page.getByRole('region', { name: '백테스트 결과' })
  await expect(result).toContainText('표시할 가격 데이터가 없습니다.')
  await expect(result).toContainText('현재 0건')
  await expect(result.getByText('evt_native_entry_oos_0001', { exact: true })).toHaveCount(0)
  await expect(result).toContainText('누락 데이터 1구간')
  await expect(result.locator('.cp-surface canvas').first()).toBeVisible()
  await expect(result.locator('.cp-quote dd')).toHaveText(Array(6).fill('—'))
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__emptyResultChart').panes()
    .flatMap((pane: { getSeries(): { data(): unknown[] }[] }) => pane.getSeries())
    .reduce((count: number, series: { data(): unknown[] }) => count + series.data().length, 0))).toBe(0)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__emptyResultMarkers').markers().length)).toBe(0)
  await expect(result.getByRole('button', { name: '체결 순서 재생', exact: true })).toBeDisabled()
  await expect(result.getByRole('button', { name: '차트 이미지 저장', exact: true })).toBeDisabled()
  await expect.poll(() => audit(page)).toContain('chart:OOS:RESOLVED')
  await expect.poll(() => audit(page)).toContain('trades:OOS:RESOLVED')
})

test('IS 선택 뒤 늦은 OOS SDK 응답은 새 구간 차트와 거래를 덮어쓰지 않는다', async ({ page }) => {
  let release: () => void = () => undefined
  const held = new Promise<void>(resolve => { release = resolve })
  let heldCount = 0
  await page.route('**/api/v{5,6}/**', async route => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('segment') === 'OOS' && !url.pathname.endsWith('chart-window')) { heldCount++; await held }
    return reply(route, url.pathname.endsWith('native-report') ? reportEnvelope.response : url.pathname.endsWith('native-trades') ? tradesBody(url) : chartBody(url))
  })
  await mount(page)
  await expect.poll(() => heldCount).toBe(2)
  const result = page.getByRole('region', { name: '백테스트 결과' })
  await result.getByRole('button', { name: 'IS', exact: true }).click()
  await expect(result.getByText('evt_native_entry_is_0002', { exact: true })).toBeVisible()
  await expect(result).toContainText('SYNTHETIC_UI_FIXTURE · IS · contract-1m · contract · UNAVAILABLE')
  release()
  await expect.poll(() => audit(page)).toContain('chart:OOS:RESOLVED')
  await expect.poll(() => audit(page)).toContain('trades:OOS:RESOLVED')
  await expect(result.getByRole('button', { name: 'IS', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(result.getByText('evt_native_entry_is_0002', { exact: true })).toBeVisible()
  await expect(result.getByText('evt_native_entry_oos_0001', { exact: true })).toHaveCount(0)
  await expect(result).not.toContainText('SYNTHETIC_UI_FIXTURE · OOS · contract-1m · contract · UNAVAILABLE')
})
