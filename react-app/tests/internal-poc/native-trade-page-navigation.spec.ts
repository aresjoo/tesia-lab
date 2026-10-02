import { expect, test, type Page, type Route } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeJob, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const envelope = (fixtures.sources[1].fixture as unknown as { response: { meta: unknown; data: NativeReport } }).response
const report = envelope.data
const queued = (fixtures.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data
// Display-only prop, not a v7 COMPLETED response or actual backtest evidence.
const job = { ...queued, state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding }
const chart = fixtures.sources[0].fixture as unknown as { meta: unknown; binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']; manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>; window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'> }
const pages = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { meta: unknown; data: NativeTrades } }[] }).pages
const cursor = (number: number) => `synthetic_trade_cursor_${String(number).padStart(6, '0')}`
const reply = (route: Route, data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(data) })
async function setup(page: Page, initialFailure = '') {
  const controls = { requests: [] as URL[], fail: initialFailure, empty: false, total: 3, hold: null as null | (() => Promise<void>) }
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); controls.requests.push(url)
    expect(route.request().method()).toBe('GET')
    if (url.pathname.endsWith('native-report')) return reply(route, envelope)
    const segment = url.searchParams.get('segment') as 'IS' | 'OOS'
    if (url.pathname.endsWith('native-trades')) {
      const held = controls.hold, failure = controls.fail
      if (held) await held()
      if (failure === 'network') return route.abort()
      if (['401', '403', '409', '500'].includes(failure)) return reply(route, { meta: envelope.meta, error: {
        code: ({ '401': 'AUTHENTICATION_REQUIRED', '403': 'FORBIDDEN', '409': 'CURSOR_INVALID', '500': 'INTERNAL_ERROR' } as Record<string, string>)[failure], message: 'Native result request failed.' } }, Number(failure))
      const number = url.searchParams.has('cursor') ? Number(url.searchParams.get('cursor')!.slice(-6)) : 1
      expect(url.searchParams.get('limit')).toBe('100')
      const source = pages.find(item => item.name === (segment === 'IS' ? 'is-first' : 'oos-default'))!.response
      const data = structuredClone(source.data)
      data.limit = 100; delete data.nextCursor
      if (number < controls.total) data.nextCursor = cursor(number + 1)
      data.trades = controls.empty ? [] : data.trades.map(trade => ({ ...trade, entryFillRef: `evt_synthetic_${segment.toLowerCase()}_${number}` }))
      if (failure === 'binding') data.binding.resultContentHash = 'e'.repeat(64)
      return reply(route, { ...source, data })
    }
    const evaluation = report.nativeEnvelope.projection.segments.find(item => item.segment === segment)!
    const bounds = { fromInclusive: evaluation.evaluationStartInclusive, toExclusive: evaluation.evaluationEndExclusive }
    const binding = { ...chart.binding, segment, backtestId: job.backtestId, splitGroupId: job.splitGroupId, strategyVersionId: job.strategyVersionId,
      semanticHash: job.semanticHash, resultContentHash: evaluation.resultContentHash }
    if (url.pathname.endsWith('chart-manifest')) return reply(route, { meta: chart.meta, data: { ...chart.manifest, binding, sourcePolicy: chart.sourcePolicy,
      segmentBounds: bounds, series: chart.manifest.series.map(item => ({ ...item, availableRange: bounds })) } })
    if (url.pathname.endsWith('chart-window')) {
      const requestedRange = { fromInclusive: url.searchParams.get('fromInclusive'), toExclusive: url.searchParams.get('toExclusive') }
      return reply(route, { meta: chart.meta, data: { ...chart.window, binding, sourcePolicy: chart.sourcePolicy, resolution: url.searchParams.get('resolution'),
        aggregationPolicy: 'UTC_EPOCH_COMPLETE_OHLCV', requestedRange, bars: [], coverage: { status: 'UNAVAILABLE', coveredRanges: [], missingRanges: [requestedRange] } } })
    }
    if (url.pathname.endsWith('fill-markers')) return reply(route, { meta: chart.meta, data: { binding, sourcePolicy: chart.sourcePolicy,
      manifestContentHash: chart.manifest.manifestContentHash, tradeManifestContentHash: pages[0].response.data.tradeManifestContentHash,
      limit: 100, markers: [], nextCursor: 'synthetic_marker_cursor_separate', pageContentHash: '9'.repeat(64) } })
    return route.abort()
  })
  await page.route('**/native-trade-navigation-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>합성 SDK/UI cursor 탐색 시험, 실제 성과 아님</p><div id="root"></div></body></html>' }))
  await page.goto('/native-trade-navigation-test.html')
  await page.evaluate(async job => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const reactPath = '/@id/react', domPath = '/@id/react-dom/client', apiPath = '/src/internal-poc/native-service-api.ts', panelPath = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const { createNativeServiceApi } = await import(/* @vite-ignore */ apiPath), { NativeServiceResult } = await import(/* @vite-ignore */ panelPath)
    const api = createNativeServiceApi(), original = api.trades, audit: string[] = []
    api.trades = async (...args: Parameters<typeof original>) => {
      try { const value = await original(...args); audit.push('RESOLVED'); return value }
      catch (failure) { audit.push('REJECTED'); throw failure }
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('root'))
    const render = (nextJob: typeof job) => root.render((react.createElement ?? react.default.createElement)(NativeServiceResult, { api, job: nextJob }))
    Object.assign(window, { tradeAudit: audit, replaceDisplayJob: () => render({ ...job, backtestId: 'backtest_other_synthetic_0002' }) })
    render(job)
  }, job)
  if (!initialFailure) await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
  return controls
}
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const tradeAlert = (page: Page) => page.locator('.ctt-bottom-pane[data-tab-id="trades"]').getByRole('alert')
const trades = (controls: Awaited<ReturnType<typeof setup>>) => controls.requests.filter(url => url.pathname.endsWith('native-trades'))
const settled = (page: Page) => page.evaluate(() => (window as unknown as { tradeAudit: string[] }).tradeAudit.length)
const flush = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
async function next(page: Page, number = 2) { await button(page, '다음 거래 페이지').click(); await expect(page.getByText('evt_synthetic_oos_' + number, { exact: true })).toBeVisible() }

test('next/previous/first always GET original opaque positions and label only current page', async ({ page }) => {
  const controls = await setup(page)
  await expect(button(page, '첫 거래 페이지')).toBeDisabled(); await expect(button(page, '이전 거래 페이지')).toBeDisabled()
  await next(page); await next(page, 3)
  await expect(button(page, '다음 거래 페이지')).toHaveCount(0)
  await button(page, '이전 거래 페이지').click(); await expect(page.getByText('evt_synthetic_oos_2', { exact: true })).toBeVisible()
  await button(page, '첫 거래 페이지').click(); await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
  expect(trades(controls).map(url => url.searchParams.get('cursor'))).toEqual([null, cursor(2), cursor(3), cursor(2), null])
  await expect(page.getByText('1페이지 · 현재 1건 (전체 건수는 위 요약 기준)', { exact: true })).toBeVisible()
})
for (const failure of ['network', '409', '500', 'binding']) test(`${failure}: failed previous keeps original rows and retries the same target, not next`, async ({ page }) => {
  const controls = await setup(page); await next(page); await next(page, 3)
  controls.fail = failure
  await button(page, '이전 거래 페이지').click()
  await expect(tradeAlert(page)).toContainText('요청한 거래 페이지를 확인하지 못했습니다.')
  await expect(page.getByTestId('native-result-detail-status')).toContainText('보고서 수치는 유지합니다.')
  await expect(page.getByText('evt_synthetic_oos_3', { exact: true })).toBeVisible()
  controls.fail = ''
  await button(page, '같은 거래 페이지 다시 조회').click()
  await expect(page.getByText('evt_synthetic_oos_2', { exact: true })).toBeVisible()
  expect(trades(controls).slice(-2).map(url => url.searchParams.get('cursor'))).toEqual([cursor(2), cursor(2)])
})
for (const failure of ['401', '403']) test(`${failure}: prior trade rows and markers removed; explicit same-page recovery`, async ({ page }) => {
  const controls = await setup(page); await next(page)
  await button(page, '체결 마커 조회').click()
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true })).toContainText('1페이지 ·')
  controls.fail = failure
  await button(page, '이전 거래 페이지').click()
  await expect(tradeAlert(page)).toContainText('거래 내역을 확인하지 못했습니다.')
  await expect(page.getByText(/^evt_synthetic_oos_/, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: '체결 마커 조회', exact: true })).not.toContainText('1페이지 ·')
  controls.fail = ''
  await button(page, '같은 거래 페이지 다시 조회').click()
  await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
})
test('initial error retries no cursor; empty page stays empty but navigable', async ({ page }) => {
  const controls = await setup(page, '500')
  await expect(tradeAlert(page)).toContainText('거래 내역을 확인하지 못했습니다.')
  controls.fail = ''; controls.empty = true
  await button(page, '같은 거래 페이지 다시 조회').click()
  await expect(page.getByText('현재 페이지에는 거래가 없습니다. 전체 구간의 거래 수는 위 요약을 확인해주세요.', { exact: true })).toBeVisible()
  await button(page, '다음 거래 페이지').click()
  await expect(page.getByText('2페이지 · 현재 0건 (전체 건수는 위 요약 기준)', { exact: true })).toBeVisible()
  await button(page, '이전 거래 페이지').click()
  await expect(page.getByText('1페이지 · 현재 0건 (전체 건수는 위 요약 기준)', { exact: true })).toBeVisible()
})
test('same-tick repeated next click sends only one GET and preserves visible old page while pending', async ({ page }) => {
  const controls = await setup(page)
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve })
  controls.hold = () => held
  await button(page, '다음 거래 페이지').evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click() })
  await expect.poll(() => trades(controls).length).toBe(2)
  await expect(button(page, '다음 거래 페이지')).toBeDisabled()
  await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
  release(); await expect(page.getByText('evt_synthetic_oos_2', { exact: true })).toBeVisible()
  expect(trades(controls)).toHaveLength(2)
})
for (const action of ['segment', 'refresh', 'job'] as const) test(`${action}: late old next-page response cannot restore rows or navigation state`, async ({ page }) => {
  const controls = await setup(page)
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve })
  controls.hold = () => held
  await button(page, '다음 거래 페이지').click(); await expect.poll(() => trades(controls).length).toBe(2)
  controls.hold = null
  if (action === 'segment') await button(page, 'IS').click()
  if (action === 'refresh') await button(page, '결과 상세 다시 조회').click()
  if (action === 'job') await page.evaluate(() => (window as unknown as { replaceDisplayJob: () => void }).replaceDisplayJob())
  if (action !== 'job') await expect(page.getByText(`evt_synthetic_${action === 'segment' ? 'is' : 'oos'}_1`, { exact: true })).toBeVisible()
  else await expect(page.locator('.native-service-result').getByRole('alert')).toContainText('검증된 보고서를 가져오지 못했습니다.')
  const count = await settled(page)
  release(); await expect.poll(() => settled(page)).toBe(count + 1); await flush(page)
  await expect(page.getByText('evt_synthetic_oos_2', { exact: true })).toHaveCount(0)
  if (action !== 'job') { await expect(button(page, '이전 거래 페이지')).toBeDisabled(); await expect(button(page, '첫 거래 페이지')).toBeDisabled() }
})
test('segment roundtrip resets history; marker cursor is never a trade cursor', async ({ page }) => {
  const controls = await setup(page); await next(page)
  await button(page, '체결 마커 조회').click()
  await expect(button(page, '다음 체결 마커 페이지')).toBeEnabled()
  await button(page, '이전 거래 페이지').click(); await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
  await button(page, 'IS').click(); await expect(page.getByText('evt_synthetic_is_1', { exact: true })).toBeVisible()
  await button(page, 'OOS').click(); await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
  expect(trades(controls).map(url => url.searchParams.get('cursor'))).toEqual([null, cursor(2), null, null, null])
})
test('bounded previous history allows 53 trade pages, retains 50 previous cursors and restarts from first', async ({ page }) => {
  test.setTimeout(60_000)
  const controls = await setup(page); controls.total = 53
  for (let number = 2; number <= 50; number++) await next(page, number)
  await expect(button(page, '다음 거래 페이지')).toBeEnabled()
  for (let number = 51; number <= 53; number++) await next(page, number)
  await expect(button(page, '다음 거래 페이지')).toHaveCount(0)
  const historyNotice = page.getByText(/이전 이동 위치는 최근 50개까지만 기억하지만 다음 페이지는 계속 볼 수 있습니다/)
  await expect(historyNotice).toBeVisible()
  await expect(page.getByText(/^evt_synthetic_oos_/, { exact: true })).toHaveCount(1)
  for (let number = 52; number >= 3; number--) {
    await button(page, '이전 거래 페이지').click()
    await expect(page.getByText(`evt_synthetic_oos_${number}`, { exact: true })).toBeVisible()
  }
  await expect(button(page, '이전 거래 페이지')).toBeDisabled()
  await expect(button(page, '다음 거래 페이지')).toBeEnabled()
  await expect(historyNotice).toBeVisible()
  await button(page, '첫 거래 페이지').click(); await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
  await expect(historyNotice).toHaveCount(0)
  await next(page)
  expect(trades(controls).map(url => url.searchParams.get('cursor'))).toEqual([
    null, ...Array.from({ length: 52 }, (_, index) => cursor(index + 2)),
    ...Array.from({ length: 50 }, (_, index) => cursor(52 - index)), null, cursor(2),
  ])
})
test('trimmed trade history keeps page 53 on failure and retries exactly the previous opaque cursor', async ({ page }) => {
  test.setTimeout(60_000)
  const controls = await setup(page); controls.total = 60
  for (let number = 2; number <= 50; number++) await next(page, number)
  await expect(button(page, '다음 거래 페이지')).toBeEnabled()
  for (let number = 51; number <= 53; number++) await next(page, number)
  controls.fail = '500'
  await button(page, '이전 거래 페이지').click()
  await expect(tradeAlert(page)).toContainText('요청한 거래 페이지를 확인하지 못했습니다.')
  await expect(page.getByText('evt_synthetic_oos_53', { exact: true })).toBeVisible()
  await expect(page.getByText(/^evt_synthetic_oos_/, { exact: true })).toHaveCount(1)
  await expect(page.getByText(/이전 이동 위치는 최근 50개까지만 기억하지만 다음 페이지는 계속 볼 수 있습니다/)).toBeVisible()
  controls.fail = ''
  await button(page, '같은 거래 페이지 다시 조회').click()
  await expect(page.getByText('evt_synthetic_oos_52', { exact: true })).toBeVisible()
  expect(trades(controls).slice(-2).map(url => url.searchParams.get('cursor'))).toEqual([cursor(52), cursor(52)])
  await button(page, '이전 거래 페이지').click()
  await expect(page.getByText('evt_synthetic_oos_51', { exact: true })).toBeVisible()
  await next(page, 52)
  await button(page, '첫 거래 페이지').click()
  await expect(page.getByText('evt_synthetic_oos_1', { exact: true })).toBeVisible()
  await expect(button(page, '이전 거래 페이지')).toBeDisabled()
  expect(trades(controls).slice(-3).map(url => url.searchParams.get('cursor'))).toEqual([cursor(51), cursor(52), null])
})
