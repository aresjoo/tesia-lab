import { installCompiledModuleResponse } from '../fixtures/compiled-module-response'
import { expect, test, type Page, type Route } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeFillMarkers, NativeJob, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'
import { professionalChartLocale } from '../../src/client-professional-chart-locale'
import { nativeResultNavigationText, nativeResultText } from '../../src/internal-poc/native-result-copy'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? [], 'The fixture host and product must not throw uncaught browser errors').toEqual([])
})
const envelope = (fixtures.sources[1].fixture as unknown as { response: { meta: unknown; data: NativeReport } }).response
const report = envelope.data
const queued = (fixtures.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data
// A display-only job prop, never an accepted v7 COMPLETED wire response.
const displayJob = { ...queued, state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding }
const fixture = fixtures.sources[0].fixture as unknown as { meta: unknown; binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']; manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>; window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'> }
const tradePages = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { meta: unknown; data: NativeTrades } }[] }).pages
const cursor = 'synthetic_marker_cursor_000001'
const utc = (time: number) => new Date(time).toISOString().replace('.000Z', 'Z')
const reply = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) })
type Mode = 'ok' | 'navigation' | 'empty' | 'outside' | 'gap' | 'manifest' | 'trade-hash' | 'job' | 'run' | 'source' | 'segment' | 'leg' | 'duplicate' | '401' | '403' | '404' | '409' | '500'
async function setup(page: Page, mode: Mode = 'ok', split = false, documentShell = false, markerPageCount = 2, markSeries = false) {
  // Test server cursors are opaque to the consumer; never page arithmetic there.
  const serverCursors = Array.from({ length: markerPageCount - 1 }, (_, i) => i === 0 ? cursor : `synthetic_marker_cursor_${String(i + 1).padStart(6, '0')}`)
  const controls = { requests: [] as URL[], mode, failNext: false, tradeMismatch: false, tradeNext: false, tradeStatus: null as 401 | 403 | null, holdTrade: null as null | (() => Promise<void>), hold: null as null | (() => Promise<void>), holdChart: null as null | (() => Promise<void>), failChart: false, chartStatus: null as 401 | 403 | null }
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); controls.requests.push(url)
    expect(route.request().method()).toBe('GET')
    if (url.pathname.endsWith('native-report')) return reply(route, envelope)
    const segment = url.searchParams.get('segment') as 'IS' | 'OOS'
    const trades = tradePages.find(item => item.name === (segment === 'IS' ? 'is-last' : 'oos-default'))!.response
    if (url.pathname.endsWith('native-trades') && controls.holdTrade) await controls.holdTrade()
    if (url.pathname.endsWith('native-trades') && controls.tradeStatus) return reply(route, { meta: trades.meta, error: { code: controls.tradeStatus === 401 ? 'AUTHENTICATION_REQUIRED' : 'FORBIDDEN', message: 'Native result request failed.' } }, controls.tradeStatus)
    if (url.pathname.endsWith('native-trades')) return reply(route, { ...trades, data: { ...trades.data, limit: 100, ...(controls.tradeNext ? { nextCursor: 'synthetic_next_trades_0001' } : {}),
      trades: controls.tradeMismatch ? trades.data.trades.map(trade => ({ ...trade, exitFillRef: 'evt_synthetic_other_exit_0001' })) : trades.data.trades } })
    const evaluation = report.nativeEnvelope.projection.segments.find(item => item.segment === segment)!
    const bounds = { fromInclusive: evaluation.evaluationStartInclusive, toExclusive: evaluation.evaluationEndExclusive }
    const binding = { ...fixture.binding, segment, backtestId: displayJob.backtestId, splitGroupId: displayJob.splitGroupId,
      strategyVersionId: displayJob.strategyVersionId, semanticHash: displayJob.semanticHash, resultContentHash: evaluation.resultContentHash }
    if (url.pathname.endsWith('chart-manifest')) return reply(route, { meta: fixture.meta, data: { ...fixture.manifest, binding, sourcePolicy: fixture.sourcePolicy, segmentBounds: bounds,
      series: [{ seriesId: 'contract-1m', priceKind: 'contract', nativeResolution: '1m', supportedResolutions: ['1m', '15m'], availableRange: bounds }, ...(markSeries ? [{ seriesId: 'mark-1m', priceKind: 'mark', nativeResolution: '1m', supportedResolutions: ['1m', '15m'], availableRange: bounds }] : [])] } })
    if (url.pathname.endsWith('chart-window')) {
      if (controls.holdChart) await controls.holdChart()
      if (controls.chartStatus) return reply(route, { meta: fixture.meta, error: { code: controls.chartStatus === 401 ? 'AUTHENTICATION_REQUIRED' : 'FORBIDDEN', message: 'Result request failed.' } }, controls.chartStatus)
      if (controls.failChart) return route.abort()
      const requestedRange = { fromInclusive: url.searchParams.get('fromInclusive')!, toExclusive: url.searchParams.get('toExclusive')! }
      const first = Date.parse(requestedRange.fromInclusive), resolution = url.searchParams.get('resolution')!, step = resolution === '1m' ? 60_000 : 900_000
      // Synthetic relocation/LOD display fixture, not market data production.
      const bars = controls.mode === 'navigation'
        ? Array.from({ length: 1000 }, (_, i) => ({ ...fixture.window.bars[0], openTime: utc(first + i * step), closeTime: utc(first + (i + 1) * step), availableAt: utc(first + (i + 1) * step), sourceEventCount: step / 60_000 }))
        : fixture.window.bars.map((bar, i) => ({ ...bar, openTime: utc(first + i * 2 * step), closeTime: utc(first + (i * 2 + 1) * step), availableAt: utc(first + (i * 2 + 1) * step), sourceEventCount: step / 60_000 }))
      return reply(route, { meta: fixture.meta, data: { ...fixture.window, binding, sourcePolicy: fixture.sourcePolicy, resolution,
        seriesId: url.searchParams.get('seriesId'), priceKind: url.searchParams.get('seriesId') === 'mark-1m' ? 'mark' : 'contract', nativeResolution: '1m', aggregationPolicy: resolution === '1m' ? 'NATIVE_CONFIRMED' : 'UTC_EPOCH_COMPLETE_OHLCV',
        requestedRange, bars, coverage: controls.mode === 'navigation' ? { status: 'COMPLETE', coveredRanges: [requestedRange], missingRanges: [] } : { status: 'PARTIAL', coveredRanges: bars.map(bar => ({ fromInclusive: bar.openTime, toExclusive: bar.closeTime })),
          missingRanges: [{ fromInclusive: bars[0].closeTime, toExclusive: bars[1].openTime }, { fromInclusive: bars[1].closeTime, toExclusive: requestedRange.toExclusive }] } } })
    }
    if (!url.pathname.endsWith('fill-markers')) return route.abort()
    if (controls.hold) await controls.hold()
    if (controls.failNext) { controls.failNext = false; return route.abort() }
    expect(url.searchParams.get('limit')).toBe('100')
    expect(url.searchParams.get('manifestContentHash')).toBe(fixture.manifest.manifestContentHash)
    const codes = { '401': 'AUTHENTICATION_REQUIRED', '403': 'FORBIDDEN', '404': 'NOT_FOUND', '409': 'NOT_READY', '500': 'INTERNAL_ERROR' }
    if (controls.mode in codes) return reply(route, { meta: fixture.meta, error: { code: codes[controls.mode as keyof typeof codes], message: 'Result request failed.' } }, Number(controls.mode))
    const second = url.searchParams.get('cursor') !== null
    const serverPage = second ? serverCursors.indexOf(url.searchParams.get('cursor')!) + 2 : 1
    if (second) expect(serverCursors).toContain(url.searchParams.get('cursor'))
    const trade = trades.data.trades[0], start = Date.parse(bounds.fromInclusive)
    const marker: NativeFillMarkers['markers'][number] = { fillRef: second ? trade.exitFillRef : trade.entryFillRef, tradeEntryFillRef: trade.entryFillRef, tradeExitFillRef: trade.exitFillRef,
      leg: second ? 'EXIT' : 'ENTRY', occurredAt: utc(start + (controls.mode === 'navigation' ? 172800000 : controls.mode === 'outside' ? 86400000 : controls.mode === 'gap' ? 60000 : second ? 120000 : 0)), side: second ? 'SELL' : 'BUY', price: second ? trade.exitPrice : trade.entryPrice,
      executionPriceSourceRef: 'evt_candle_fixture_0001', fillContentHash: '8'.repeat(64) }
    const data: NativeFillMarkers = { binding, manifestContentHash: fixture.manifest.manifestContentHash, tradeManifestContentHash: trades.data.tradeManifestContentHash,
      limit: 100, markers: controls.mode === 'empty' ? [] : [marker], ...(serverPage < markerPageCount ? { nextCursor: serverCursors[serverPage - 1] } : {}), sourcePolicy: structuredClone(fixture.sourcePolicy), pageContentHash: (second ? 'a' : '9').repeat(64) }
    // The document seam serves both legs of the same source fixture trade on
    // its first bounded page. Neither their prices nor refs come from OHLC.
    // The original one-marker/pagination fixtures remain unchanged elsewhere.
    if (documentShell && !second && controls.mode !== 'empty') data.markers.push({ ...marker,
      fillRef: trade.exitFillRef, leg: 'EXIT', side: 'SELL', price: trade.exitPrice,
      occurredAt: utc(start + 120000), fillContentHash: 'a'.repeat(64),
    })
    if (controls.mode === 'manifest') data.manifestContentHash = 'b'.repeat(64)
    if (controls.mode === 'trade-hash') data.tradeManifestContentHash = 'b'.repeat(64)
    if (controls.mode === 'job') data.binding.backtestId = 'backtest_other_fixture_0001'
    if (controls.mode === 'run') data.binding.runId = 'run_wrong_fixture_0001'
    if (controls.mode === 'source') data.sourcePolicy.sourceProvenance = { source: 'RECORDED_DEV_FIXTURE', verification: 'UNVERIFIED', rights: 'PRIVATE_ONLY' }
    if (controls.mode === 'segment') data.binding.segment = segment === 'OOS' ? 'IS' : 'OOS'
    if (controls.mode === 'leg') data.markers[0].fillRef = trade.exitFillRef
    if (controls.mode === 'duplicate') data.markers.push({ ...marker })
    return reply(route, { meta: fixture.meta, data })
  })
  await page.route('**/native-fill-markers-test.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>합성 SDK/UI 체결 표시 시험</title></head><body>${documentShell ? '' : '<p>합성 SDK/UI 체결 표시 시험, 실제 실행 성과 아님</p>'}<div id="root"></div></body></html>` }))
  await page.goto('/native-fill-markers-test.html')
  await page.evaluate(async ({ job, split, documentShell }) => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const shellPath = '/src/internal-poc/ClientServiceExperience.tsx'
    // A hook-bearing host must share the exact Vite React instance used by the
    // product. /@id/react is sufficient for the old createElement-only seam,
    // but its dispatcher is not necessarily the shell renderer's dispatcher.
    const shellSource = documentShell ? await (await fetch(shellPath)).text() : null
    const reactPath = documentShell ? shellSource?.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1] : '/@id/react'
    if (!reactPath) throw new Error('Missing Vite React instance for document replay host')
    const domPath = '/@id/react-dom/client', apiPath = '/src/internal-poc/native-service-api.ts', panelPath = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const { createNativeServiceApi } = await import(/* @vite-ignore */ apiPath), { NativeServiceResult } = await import(/* @vite-ignore */ panelPath)
    const api = createNativeServiceApi(), markerAudit: string[] = [], original = api.markers
    api.markers = async (...args: Parameters<typeof original>) => {
      try { const value = await original(...args); markerAudit.push('RESOLVED'); return value }
      catch (failure) { markerAudit.push('REJECTED'); throw failure }
    }
    Object.assign(window, { markerAudit })
    const h = react.createElement ?? react.default.createElement
    let element = h(NativeServiceResult, { api, job, embedded: split || documentShell })
    if (documentShell) {
      const { ClientServiceExperience } = await import(/* @vite-ignore */ shellPath)
      const preferencesPath = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ preferencesPath)
      Reflect.set(window, 'setReplayDocumentLanguage', (language: string) => setClientPreference('language', language))
      const useState = react.useState ?? react.default.useState
      const analysis = element
      const sent: string[] = []
      Reflect.set(window, 'documentReplaySent', sent)
      function DocumentHost() {
        const [input, setInput] = useState('재생 후에도 보존할 문서 질문')
        return h(ClientServiceExperience, {
          accountScope: 'sdk-document-replay-fixture', analysisIdentity: `sdk-document:${job.backtestId}`,
          state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'sdk-document-question', role: 'user', text: '검증 보고서의 체결 순서를 확인해주세요.' }],
            input, inputDisabled: false, busy: false, source: 'service', recovery: null, quickReplies: [], workflow: null,
            outcome: h('p', null, '백테스트 완료'), issue: null, onInput: setInput,
            onSend: async (value: string) => { sent.push(value) }, onReset: () => {}, onRecover: undefined, onLogout: undefined },
          strategyDocument: { identity: 'sdk-document-replay-draft', content: h('p', null, '합성 계약 fixture 전략 문서') },
          analysis,
        })
      }
      document.getElementById('root')!.style.height = '100dvh'
      element = h(DocumentHost)
    } else if (split) {
      const layoutPath = '/src/internal-poc/NativeAnalysisLayout.tsx'
      const { NativeAnalysisLayout } = await import(/* @vite-ignore */ layoutPath)
      document.getElementById('root')!.style.height = '100dvh'
      element = h(NativeAnalysisLayout, { analysis: element }, h('label', null, '표시 격리용 입력', h('textarea', { 'aria-label': '표시 격리용 입력' })))
    }
    const fixtureRoot = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('root'))
    Reflect.set(window, 'unmountNativeFixture', () => fixtureRoot.unmount())
    Reflect.set(window, 'replaceNativeFixtureBinding', (kind: 'api' | 'job' | 'original') => {
      fixtureRoot.render(h(NativeServiceResult, { api: kind === 'api' ? { ...api } : api, job: kind === 'job' ? { ...job } : job }))
    })
    fixtureRoot.render(element)
  }, { job: displayJob, split, documentShell })
  await expect(page.getByRole('button', { name: '체결 마커 조회', exact: true, includeHidden: split || documentShell })).toBeEnabled()
  return controls
}
const region = (page: Page) => page.getByRole('region', { name: '체결 마커 조회', exact: true })
const markerRequests = (controls: Awaited<ReturnType<typeof setup>>) => controls.requests.filter(url => url.pathname.endsWith('fill-markers'))
const load = (page: Page) => page.getByRole('button', { name: '체결 마커 조회', exact: true }).click()

for (const segment of ['OOS', 'IS'] as const) test(`native 거래 상세 ${segment}는 원본 상세창에 서버 수치를 그대로 표시하고 추가 조회하지 않는다`, async ({ page }, info) => {
  const controls = await setup(page)
  await page.addStyleTag({ url: '/node_modules/@fontsource-variable/noto-sans-kr/index.css' })
  await page.addStyleTag({ url: '/node_modules/@fontsource-variable/geist/index.css' })
  await page.evaluate(() => document.fonts.ready)
  if (segment === 'IS') await page.getByRole('button', { name: 'IS', exact: true }).click()
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await page.getByRole('tab', { name: '거래 내역', exact: true }).click()
  const trade = tradePages.find(item => item.name === (segment === 'IS' ? 'is-last' : 'oos-default'))!.response.data.trades[0]
  const trigger = page.getByRole('button', { name: `거래 상세 · ${trade.entryFillRef}`, exact: true })
  await expect(trigger).toBeVisible()
  const requests = controls.requests.length
  await trigger.focus(); await trigger.press('Enter')
  const detail = page.getByRole('dialog', { name: '백테스트 거래 상세', exact: true })
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('region', { name: '체결 가격과 손익 명세', exact: true })).toBeVisible()
  await expect(detail.locator('li')).toHaveCount(3)
  await expect(detail.locator('.lc-heading b')).toHaveText(['진입가', '종료 체결가', '순손익'])
  await expect(detail.locator('.v2')).toHaveText([trade.entryPrice, trade.exitPrice, `${trade.netPnl} USDT`])
  await expect(detail).toContainText('종료 체결')
  await expect(detail).not.toContainText('청산 체결')
  await expect(detail.locator('li').nth(2)).toContainText(`총손익: ${trade.grossPnl} USDT\n수수료: ${trade.fees} USDT\n펀딩: ${trade.funding} USDT`)
  for (const value of [trade.entryFillRef, trade.exitFillRef, trade.quantity, trade.entryPrice, trade.exitPrice, trade.grossPnl, trade.fees, trade.funding, trade.netPnl, trade.exitReason]) await expect(detail).toContainText(value)
  await expect(detail).not.toContainText('판단 기록')
  await expect(detail).not.toContainText('주문 생성')
  expect(controls.requests).toHaveLength(requests)
  await detail.screenshot({ path: info.outputPath('native-trade-detail.png') })
  await page.keyboard.press('Escape')
  await expect(detail).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: '백테스트 터미널', exact: true })).toBeVisible()
  await expect(trigger).toBeFocused()
  expect(controls.requests).toHaveLength(requests)
})

test('native 거래 상세 언어 변경은 원금액·통화·참조와 열린 초점을 보존한다', async ({ page }, info) => {
  const controls = await setup(page)
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await page.getByRole('tab', { name: '거래 내역', exact: true }).click()
  const trade = tradePages.find(item => item.name === 'oos-default')!.response.data.trades[0]
  await page.getByRole('button', { name: `거래 상세 · ${trade.entryFillRef}`, exact: true }).click()
  const requests = controls.requests.length
  const detail = page.locator('dialog.client-trade-lifecycle')
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
      setClientPreference('currency', 'KRW')
    }, language)
    await expect(detail).toHaveAccessibleName(nativeResultText(language, 'tradeDetailTitle'))
    await expect(detail.getByRole('region')).toHaveAccessibleName(nativeResultText(language, 'tradeDetailRegion'))
    await expect(detail.locator('.dx')).toBeFocused()
    await expect(detail.locator('.v2')).toHaveText([trade.entryPrice, trade.exitPrice, `${trade.netPnl} USDT`])
    await expect(detail.locator('li').nth(2)).toContainText(`${nativeResultText(language, 'tradeFunding')}: ${trade.funding} USDT`)
    expect(await detail.locator('.din').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  }
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 640 })
    expect(await detail.locator('.din').evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
  }
  expect(controls.requests).toHaveLength(requests)
  await page.evaluate(() => Reflect.get(window, 'unmountNativeFixture')())
  await expect(detail).toHaveCount(0)
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})

for (const kind of ['api', 'job'] as const) test(`native 거래 상세는 같은 ID의 ${kind} 교체 중 이전 보고 상세를 남기지 않는다`, async ({ page }) => {
  const controls = await setup(page)
  const trade = tradePages.find(item => item.name === 'oos-default')!.response.data.trades[0]
  await page.getByRole('button', { name: `거래 상세 · ${trade.entryFillRef}`, exact: true }).click()
  const detail = page.locator('dialog.client-trade-lifecycle')
  await expect(detail).toBeVisible()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  controls.holdTrade = () => held
  const reads = controls.requests.filter(url => url.pathname.endsWith('native-trades')).length
  try {
    await page.evaluate(kind => Reflect.get(window, 'replaceNativeFixtureBinding')(kind), kind)
    await expect.poll(() => controls.requests.filter(url => url.pathname.endsWith('native-trades')).length).toBeGreaterThan(reads)
    await expect(detail).toHaveCount(0)
    await page.evaluate(() => Reflect.get(window, 'replaceNativeFixtureBinding')('original'))
    await expect.poll(() => controls.requests.filter(url => url.pathname.endsWith('native-trades')).length).toBeGreaterThan(reads + 1)
    await expect(detail).toHaveCount(0)
  } finally { release() }
  await expect(page.getByRole('button', { name: `거래 상세 · ${trade.entryFillRef}`, exact: true })).toBeEnabled()
  await expect(detail).toHaveCount(0)
})

for (const status of [401, 403] as const) test(`native 거래 상세는 독립된 차트의 ${status} 응답에도 검증된 거래를 유지한다`, async ({ page }) => {
  const controls = await setup(page, 'navigation')
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  controls.holdChart = () => held; controls.chartStatus = status
  const trade = tradePages.find(item => item.name === 'oos-default')!.response.data.trades[0]
  await page.getByRole('button', { name: '다음 차트 범위', exact: true }).click()
  await page.getByRole('button', { name: `거래 상세 · ${trade.entryFillRef}`, exact: true }).click()
  const detail = page.locator('dialog.client-trade-lifecycle')
  await expect(detail).toBeVisible()
  release()
  await expect(page.locator('.ctt-chart').getByRole('alert', { includeHidden: true })).toHaveCount(1)
  await expect(detail).toBeVisible()
  await expect(detail.locator('.v2').last()).toHaveText(`${trade.netPnl} USDT`)
})

for (const status of [401, 403] as const) test(`native 거래 상세는 페이지 재조회 시작에 닫히고 ${status} 뒤 재등장하지 않는다`, async ({ page }) => {
  const controls = await setup(page)
  controls.tradeNext = true
  // A segment selection obtains the test server's next-page cursor normally.
  await page.getByRole('button', { name: 'IS', exact: true }).click()
  await expect(page.getByRole('button', { name: '다음 거래 페이지', exact: true })).toBeVisible()
  const trade = tradePages.find(item => item.name === 'is-last')!.response.data.trades[0]
  const trigger = page.getByRole('button', { name: `거래 상세 · ${trade.entryFillRef}`, exact: true })
  await trigger.click()
  const detail = page.locator('dialog.client-trade-lifecycle')
  await expect(detail).toBeVisible()
  controls.tradeStatus = status
  // Programmatic owner/controller invalidation while a modal is open. This
  // is not presented as a user clicking an inert background through the modal.
  await page.getByRole('button', { name: '다음 거래 페이지', exact: true, includeHidden: true }).evaluate((button: HTMLButtonElement) => button.click())
  await expect(detail).toHaveCount(0)
  await expect(page.locator('.ctt-bottom-pane').getByRole('alert')).toBeVisible()
  await expect(trigger).toHaveCount(0)
  controls.tradeStatus = null
  await page.getByRole('button', { name: '같은 거래 페이지 다시 조회', exact: true }).click()
  await expect(trigger).toBeVisible()
  await expect(detail).toHaveCount(0)
})

for (const status of [401, 403] as const) test(`거래 페이지 ${status}는 이전 체결의 가격 공백 안내도 제거한다`, async ({ page }) => {
  const controls = await setup(page, 'gap')
  controls.tradeNext = true
  await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  await expect(page.getByRole('button', { name: '다음 거래 페이지', exact: true })).toBeEnabled()
  await load(page)
  await page.locator('.native-trade-times button').click()
  await expect(region(page)).toContainText('해당 시각의 가격 봉이 없어')
  controls.tradeStatus = status
  await page.getByRole('button', { name: '다음 거래 페이지', exact: true }).click()
  await expect(page.locator('.ctt-bottom-pane').getByRole('alert')).toBeVisible()
  await expect(region(page)).not.toContainText('해당 시각의 가격 봉이 없어')
  await expect(page.locator('.native-trade-times button')).toHaveCount(0)
})

test('양방향 선택 교대는 이전 체결의 눌림 상태를 남기지 않는다', async ({ page }) => {
  await setup(page); await load(page)
  const action = page.locator('.native-trade-times button')
  await action.click()
  await expect(action).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.cp-surface')).toBeFocused()
  await page.locator('.cp-fills button').click()
  await expect(page.locator('tr[aria-current=true]')).toBeFocused()
  await expect(action).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.native-fill-inspector button[aria-pressed=true]')).toHaveCount(0)
})

for (const status of [401, 403] as const) test(`체결 이동의 ${status} 뒤 제거된 버튼의 초점을 차트 재시도로 복구한다`, async ({ page }) => {
  const controls = await setup(page, 'navigation'); await load(page)
  await expect(region(page)).toContainText('1페이지')
  controls.chartStatus = status
  await page.locator('.native-trade-times button').click()
  await expect(page.locator('.ctt-chart').getByRole('alert')).toBeVisible()
  await expect(page.locator('.native-trade-times button')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '같은 차트 범위 다시 조회', exact: true })).toBeFocused()
})

test('늦은 체결 권한 실패는 이후 다른 곳으로 옮긴 초점을 가져오지 않는다', async ({ page }) => {
  const controls = await setup(page, 'navigation'); await load(page)
  await expect(region(page)).toContainText('1페이지')
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  controls.holdChart = () => held; controls.chartStatus = 403
  await page.locator('.native-trade-times button').click()
  const destination = page.getByRole('button', { name: '터미널에서 보기', exact: true })
  await destination.focus()
  release()
  await expect(page.locator('.ctt-chart').getByRole('alert')).toBeVisible()
  await expect(destination).toBeFocused()
})


test('renderer 실패 중 체결 이동만 잠그고 검증된 거래 상세와 조회 결과를 보존한다', async ({ page }) => {
  await installCompiledModuleResponse(page, "/src/components/ClientProfessionalPriceChart.tsx", original => {
    const body = original;
    expect(body).toContain('api.current = chart;')
    return body.replace('api.current = chart;', 'api.current = chart; window.__fillFailureChart = chart;')
    }, ["api.current = chart;"])
  const controls = await setup(page, 'navigation')
  await load(page)
  const markerMoves = page.locator('.native-fill-inspector button')
  const ledgerMoves = page.locator('.native-trade-times button')
  await expect(markerMoves).toHaveCount(1)
  await expect(ledgerMoves).toHaveCount(1)
  await expect(markerMoves).toBeEnabled()
  await expect(ledgerMoves).toBeEnabled()
  const ledger = await page.locator('.ctt-bottom-pane table').textContent()
  await page.evaluate(() => {
    const chart = Reflect.get(window, '__fillFailureChart')
    const candle = chart.panes()[0].getSeries()[0], setData = candle.setData.bind(candle)
    const initialTime = candle.data()[0].time
    let fail = true
    candle.setData = (data: { time: unknown }[]) => {
      if (fail && data.length && data[0].time !== initialTime) { fail = false; throw new Error('TEST_ONLY_FILL_NAV_RENDERER_FAILURE') }
      setData(data)
    }
  })
  // A fill-directed price lookup preserves the already validated marker page.
  // Manual next-window navigation intentionally clears it and tests another path.
  await ledgerMoves.click()
  await expect(page.locator('.cp-failure')).toBeVisible()
  await expect(markerMoves).toBeDisabled()
  await expect(ledgerMoves).toBeDisabled()
  await expect(page.locator('.native-trade-detail-trigger').first()).toBeEnabled()
  expect(await page.locator('.ctt-bottom-pane table').textContent()).toBe(ledger)
  const reads = controls.requests.length
  // Programmatic stale clicks must also leave focus and network untouched.
  const retry = page.getByRole('button', { name: '차트 다시 표시', exact: true })
  await retry.focus()
  await markerMoves.dispatchEvent('click')
  await ledgerMoves.dispatchEvent('click')
  await expect(retry).toBeFocused()
  expect(controls.requests).toHaveLength(reads)
  await retry.click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(markerMoves).toBeEnabled()
  await expect(ledgerMoves).toBeEnabled()
  expect(controls.requests).toHaveLength(reads)
})

for (const leg of ['BUY', 'SELL'] as const) test(`차트 ${leg} 선택은 같은 실제 SDK 거래 행으로 이동하고 추가 조회하지 않는다`, async ({ page }, info) => {
  const controls = await setup(page)
  // The isolated SDK host does not execute the app's font entry point.
  await page.addStyleTag({ url: '/node_modules/@fontsource-variable/noto-sans-kr/index.css' })
  await page.addStyleTag({ url: '/node_modules/@fontsource-variable/geist/index.css' })
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await load(page)
  if (leg === 'SELL') await page.getByRole('button', { name: '다음 체결 마커 페이지', exact: true }).click()
  await expect(region(page)).toContainText(leg === 'BUY' ? '1페이지' : '2페이지')
  await page.locator('.cp-surface').press(leg === 'BUY' ? 'Home' : 'End')
  const fill = page.locator('.cp-fills button').filter({ hasText: leg })
  await expect(fill).toBeVisible()
  const requests = controls.requests.length
  await fill.focus()
  await fill.press('Enter')
  const row = page.locator('tr[aria-current=true]')
  await expect(row).toHaveCount(1)
  await expect(row).toBeFocused()
  await expect(row).toContainText('선택된 거래')
  await expect(row.locator('td').nth(1)).toHaveCSS('white-space', 'nowrap')
  await expect(page.locator('.ctt-bottom-pane th').first()).toHaveCSS('white-space', 'nowrap')
  await expect(row).toContainText(tradePages.find(item => item.name === 'oos-default')!.response.data.trades[0].entryFillRef)
  expect(controls.requests).toHaveLength(requests)
  await page.getByRole('dialog', { name: '백테스트 터미널', exact: true }).screenshot({ path: info.outputPath(`fill-to-ledger-${leg}.png`) })
  if (info.project.name === 'mobile') {
    const chartTab = page.getByRole('tab', { name: '가격 차트', exact: true })
    await expect(chartTab).toHaveAttribute('tabindex', '0')
    await chartTab.focus(); await chartTab.press('Enter')
    await expect(chartTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.cp-surface')).toBeVisible()
    await page.locator('.cp-fills button').filter({ hasText: leg }).click()
    await expect(row).toBeFocused()
  }
  // Existing reverse navigation still returns to the same mounted chart.
  await row.locator('.native-trade-times button').click()
  await expect(page.locator('.cp-surface')).toBeFocused()
  await expect(page.locator('tr[aria-current=true]')).toHaveCount(0)
  expect(controls.requests).toHaveLength(requests)
})

test('거래 참조 쌍이 다르면 현재 페이지 안내로 이동하며 자동 탐색하지 않는다', async ({ page }) => {
  const controls = await setup(page)
  controls.tradeMismatch = true
  await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  await expect(page.getByRole('button', { name: '체결 마커 조회', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await load(page)
  await expect(region(page)).toContainText('1페이지')
  await page.locator('.cp-surface').press('Home')
  const requests = controls.requests.length
  await page.locator('.cp-fills button').click()
  await expect(page.locator('.native-trade-selection-notice')).toBeFocused()
  await expect(page.locator('.native-trade-selection-notice')).toContainText('현재 1페이지')
  await expect(page.locator('tr[aria-current=true]')).toHaveCount(0)
  expect(controls.requests).toHaveLength(requests)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page.locator('.native-trade-selection-notice')).toContainText(nativeResultNavigationText(language, 'tradeNotOnPage', { page: 1 }))
    await expect(page.locator('.native-trade-selection-notice')).toBeFocused()
    expect(controls.requests).toHaveLength(requests)
  }
})

test('거래 선택의 언어 변경은 행과 초점을 보존하고 7언어 문구만 바꾼다', async ({ page }) => {
  const controls = await setup(page)
  await load(page)
  await expect(region(page)).toContainText('1페이지')
  await page.locator('.cp-surface').press('Home')
  await page.locator('.cp-fills button').click()
  const row = page.locator('tr[aria-current=true]')
  await expect(row).toBeFocused()
  const requests = controls.requests.length
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(row).toContainText(nativeResultNavigationText(language, 'selectedTrade'))
    await expect(row).toBeFocused()
    expect(controls.requests).toHaveLength(requests)
  }
})

test('체결 페이지 재조회 대기와 인증 실패 후 이전 선택이 살아나지 않는다', async ({ page }) => {
  const controls = await setup(page)
  await load(page)
  await expect(region(page)).toContainText('1페이지')
  await page.locator('.cp-surface').press('Home')
  await page.locator('.cp-fills button').click()
  await expect(page.locator('tr[aria-current=true]')).toBeFocused()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  controls.hold = () => held
  await page.getByRole('button', { name: '첫 체결 마커 페이지 다시 조회', exact: true }).click()
  await expect(page.locator('tr[aria-current=true]')).toHaveCount(0)
  const requests = controls.requests.length
  await page.locator('.cp-fills button').click()
  await expect(page.locator('tr[aria-current=true]')).toHaveCount(0)
  expect(controls.requests).toHaveLength(requests)
  controls.mode = '401'; release()
  await expect(region(page).getByRole('alert')).toBeVisible()
  await expect(page.locator('.cp-fills button')).toHaveCount(0)
  await expect(page.locator('tr[aria-current=true]')).toHaveCount(0)
})

for (const status of [401, 403] as const) test(`체결 시점 이동의 차트 ${status}는 이전 가격과 마커를 제거하고 재조회는 가능하다`, async ({ page }) => {
  const controls = await setup(page, 'navigation'); await load(page)
  await expect(region(page)).toContainText('1페이지 ·')
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  controls.chartStatus = status
  await page.locator('.native-trade-times').getByRole('button', { name: /^진입 시점/ }).click()
  await expect(page.locator('.ctt-chart').getByRole('alert')).toBeVisible()
  await expect(page.locator('.cp-chart')).toHaveCount(0)
  await expect(page.locator('.native-fill-inspector')).toHaveCount(0)
  controls.chartStatus = null
  await page.getByRole('button', { name: '같은 차트 범위 다시 조회' }).click()
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  await expect(region(page)).toContainText('아직 조회하지 않았습니다.')
  await load(page)
  await expect(region(page)).toContainText('1페이지 ·')
  await expect(page.getByRole('button', { name: '이전 체결 마커 페이지' })).toBeDisabled()
})

test('이전 체결 페이지 실패는 현재 페이지를 보존하고 재시도는 첫 cursor를 새로 조회한다', async ({ page }) => {
  const controls = await setup(page); await load(page)
  const previous = page.getByRole('button', { name: '이전 체결 마커 페이지' })
  await expect(previous).toBeDisabled()
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  await page.getByRole('button', { name: '다음 체결 마커 페이지' }).click()
  await expect(region(page)).toContainText('2페이지 ·')
  controls.failNext = true
  await previous.click()
  await expect(region(page).getByRole('alert')).toBeVisible()
  await expect(region(page)).toContainText('2페이지 ·')
  await page.getByRole('button', { name: '같은 체결 마커 페이지 다시 조회' }).click()
  await expect(region(page)).toContainText('1페이지 ·')
  await expect(previous).toBeDisabled()
  expect(markerRequests(controls).map(url => url.searchParams.get('cursor'))).toEqual([null, cursor, null, null])
  expect(await canvas!.evaluate(node => node.isConnected && node === document.querySelector('.cp-chart canvas'))).toBe(true)
})

test('50개 이전 위치 한도에서도 다음 조회는 계속하고 첫 페이지에서 다시 시작한다', async ({ page }) => {
  const controls = await setup(page, 'ok', false, false, 53); await load(page)
  const forward = page.getByRole('button', { name: '다음 체결 마커 페이지' }), previous = page.getByRole('button', { name: '이전 체결 마커 페이지' })
  for (let number = 2; number <= 53; number++) {
    await forward.click()
    await expect(region(page)).toContainText(`${number}페이지 ·`)
  }
  await expect(forward).toHaveCount(0)
  await expect(region(page)).toContainText('최근 50개')
  for (let number = 52; number >= 3; number--) {
    await previous.click()
    await expect(region(page)).toContainText(`${number}페이지 ·`)
  }
  await expect(previous).toBeDisabled()
  await expect(forward).toBeEnabled()
  await page.getByRole('button', { name: '첫 체결 마커 페이지 다시 조회' }).click()
  await expect(region(page)).toContainText('1페이지 ·')
  await expect(region(page)).not.toContainText('최근 50개')
  expect(markerRequests(controls)).toHaveLength(104)
  expect(markerRequests(controls).at(-1)!.searchParams.has('cursor')).toBe(false)
})

test('마크 가격으로 바꿔도 BUY SELL 원본 체결 가격을 보존하고 이전 조회 위치는 초기화한다', async ({ page }) => {
  const controls = await setup(page, 'ok', false, false, 2, true); await load(page)
  await page.getByRole('button', { name: '다음 체결 마커 페이지' }).click()
  await expect(region(page)).toContainText('2페이지 ·')
  await page.getByRole('combobox', { name: '차트 데이터' }).selectOption('mark-1m')
  await expect(page.getByText(/이 차트의 캔들은 마크 가격/)).toBeVisible()
  await expect(region(page)).toContainText('아직 조회하지 않았습니다.')
  await load(page)
  await expect(region(page)).toContainText('1페이지 ·')
  await expect(page.getByRole('button', { name: '이전 체결 마커 페이지' })).toBeDisabled()
  await page.locator('.native-fill-inspector summary').click()
  const trade = tradePages.find(item => item.name === 'oos-default')!.response.data.trades[0]
  await expect(page.locator('.native-fill-inspector button')).toContainText(trade.entryPrice)
  await page.getByRole('button', { name: '다음 체결 마커 페이지' }).click()
  await expect(page.locator('.native-fill-inspector button')).toContainText(trade.exitPrice)
  expect(markerRequests(controls).every(url => !url.searchParams.has('seriesId'))).toBe(true)
})

test('조회된 거래 진입 시점은 추가 요청 없이 기존 가격 차트의 실제 체결을 선택한다', async ({ page }) => {
  const controls = await setup(page)
  await load(page)
  const action = page.locator('.native-trade-times').getByRole('button', { name: /^진입 시점/ })
  await expect(action).toBeVisible()
  const requests = controls.requests.map(url => url.href)
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  await action.click()
  await expect(page.locator('.cp-surface')).toBeFocused()
  await expect(action).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.native-fill-inspector summary').click()
  const selected = page.locator('.native-fill-inspector button[aria-pressed=true]')
  await expect(selected).toHaveCount(1)
  await expect(selected).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(selected).not.toHaveCSS('box-shadow', 'none')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('evt_native_entry_oos_0001')
  expect(controls.requests.map(url => url.href)).toEqual(requests)
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, previous) => node === previous, canvas)).toBe(true)
})
test('체결 시점이 표시 창 밖이면 동일 manifest의 최대1000봉 한 창만 조회한다', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const controls = await setup(page, 'navigation')
  await page.evaluate(async () => {
    const skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */ skin)
    await document.fonts.ready
  })
  await load(page)
  await expect(region(page)).toContainText('현재 표시 범위 0개')
  await page.locator('.native-trade-times').getByRole('button', { name: /^진입 시점/ }).click()
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('evt_native_entry_oos_0001')
  await expect(page.locator('.cp-surface')).toBeFocused()
  await expect(page.locator('.cp-surface')).toBeInViewport({ ratio: .5 })
  const windows = controls.requests.filter(url => url.pathname.endsWith('chart-window'))
  expect(windows).toHaveLength(2)
  expect(windows[1].searchParams.get('fromInclusive')).toBe('2025-01-02T23:40:00Z')
  expect(windows[1].searchParams.get('resolution')).toBe('1m')
  expect(windows[1].searchParams.get('maxPoints')).toBe('1000')
  expect(markerRequests(controls)).toHaveLength(1)
  expect(controls.requests.filter(url => url.pathname.endsWith('native-trades'))).toHaveLength(1)
  await page.locator('.cp-chart').screenshot({ path: info.outputPath('native-fill-chart-navigation.png') })
})
test('가격 봉이 없는 시점은 원래 마커를 보존하되 다른 캔들로 끼워맞추지 않는다', async ({ page }) => {
  const controls = await setup(page, 'gap')
  await load(page)
  const requests = controls.requests.length
  await page.locator('.native-trade-times').getByRole('button', { name: /^진입 시점/ }).click()
  await expect(region(page)).toContainText('해당 시각의 가격 봉이 없어 표시할 수 없습니다.')
  expect(controls.requests.length).toBe(requests)
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toHaveCount(0)
})
test('체결 이동 중 다른 조작으로 옮긴 초점을 늦은 가격 응답이 빼앗지 않는다', async ({ page }) => {
  const controls = await setup(page, 'navigation')
  await load(page)
  let release!: () => void
  controls.holdChart = () => new Promise<void>(resolve => { release = resolve })
  await page.locator('.native-trade-times').getByRole('button', { name: /^진입 시점/ }).click()
  await expect.poll(() => Boolean(release)).toBe(true)
  const other = page.getByRole('button', { name: '로그', exact: true })
  await other.focus()
  release()
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('evt_native_entry_oos_0001')
  await expect(other).toBeFocused()
  expect(markerRequests(controls)).toHaveLength(1)
})
test('체결 이동의 가격 조회 실패는 마지막 가격 창과 원래 체결 페이지를 보존한다', async ({ page }) => {
  const controls = await setup(page, 'navigation')
  await load(page)
  const canvas = await page.locator('.cp-chart canvas').first().elementHandle()
  controls.failChart = true
  await page.locator('.native-trade-times').getByRole('button', { name: /^진입 시점/ }).click()
  await expect(page.locator('.ctt-chart').getByRole('alert')).toContainText('차트 데이터를 확인하지 못했습니다.')
  await expect(region(page)).toContainText('1페이지')
  await expect(page.locator('.native-trade-times').getByRole('button', { name: /^진입 시점/ })).toBeDisabled()
  expect(await page.locator('.cp-chart canvas').first().evaluate((node, previous) => node === previous, canvas)).toBe(true)
  expect(markerRequests(controls)).toHaveLength(1)
  controls.failChart = false
  await page.getByRole('button', { name: '같은 차트 범위 다시 조회', exact: true }).click()
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('evt_native_entry_oos_0001')
  await expect(page.locator('.cp-surface')).toBeFocused()
  await expect(page.locator('.native-trade-times button')).toHaveAttribute('aria-pressed', 'true')
  expect(markerRequests(controls)).toHaveLength(1)
  expect(controls.requests.filter(url => url.pathname.endsWith('chart-window'))).toHaveLength(3)
})
for (const interaction of ['text', 'wheel'] as const) test(`체결 이동 응답 대기 중 ${interaction} 조작을 차트 자동 초점·스크롤로 덮어쓰지 않는다`, async ({ page }) => {
  const controls = await setup(page, 'navigation')
  await load(page)
  let release!: () => void
  controls.holdChart = () => new Promise<void>(resolve => { release = resolve })
  await page.locator('.native-trade-times button').click()
  await expect.poll(() => Boolean(release)).toBe(true)
  if (interaction === 'text') await page.locator('body > p').click()
  else await page.mouse.wheel(0, -400)
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  release()
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('evt_native_entry_oos_0001')
  await expect(page.locator('.cp-surface')).not.toBeFocused()
  expect(markerRequests(controls)).toHaveLength(1)
})
test('분할 탭에서도 원 SDK 보고서·가격·체결 검증과 단일 canvas를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const controls = await setup(page, 'ok', true)
  await page.getByRole('textbox', { name: '표시 격리용 입력' }).fill('현재 입력 유지')
  const tabs = page.getByRole('tablist', { name: '대화와 결과 보기' })
  await tabs.getByRole('tab', { name: '차트·분석', exact: true }).click()
  await load(page)
  await expect(region(page)).toContainText('1페이지 ·')
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('BUY')
  await page.locator('.cp-chart canvas').first().evaluate(node => Reflect.set(window, 'splitSdkCanvas', node))
  const reads = controls.requests.map(url => url.href)
  await tabs.getByRole('tab', { name: '대화', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '표시 격리용 입력' })).toHaveValue('현재 입력 유지')
  await tabs.getByRole('tab', { name: '차트·분석', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'splitSdkCanvas') === document.querySelector('.cp-chart canvas'))).toBe(true)
  expect(controls.requests.map(url => url.href)).toEqual(reads)
  await expect(page.locator('.cp-chart')).toHaveCount(1)
})
test('explicit marker page uses original fill time/price/ref in unchanged chart, partial page is not total', async ({ page }) => {
  const controls = await setup(page)
  expect(markerRequests(controls)).toHaveLength(0)
  await expect(region(page)).toContainText('거래가 없다는 뜻이 아닙니다.')
  await load(page)
  await expect(region(page)).toContainText('1페이지 · 조회한 체결 마커 1개 중 현재 표시 범위 1개')
  await expect(region(page)).toContainText('전체 체결 누계가 아닙니다.')
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('evt_native_entry_oos_0001')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('BUY')
  await expect(page.locator('.cp-footer')).toContainText('2개 봉')
  await page.getByRole('button', { name: '다음 체결 마커 페이지' }).click()
  await expect(region(page)).toContainText('2페이지 · 조회한 체결 마커 1개')
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('End')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('SELL')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('99')
  await expect(page.getByRole('button', { name: '다음 체결 마커 페이지' })).toHaveCount(0)
  expect(markerRequests(controls)).toHaveLength(2)
})
for (const mode of ['empty', 'outside', 'gap'] as const) test(`${mode}: no invented fill or nearest-candle interpolation`, async ({ page }) => {
  await setup(page, mode); await load(page)
  await expect(region(page)).toContainText('1페이지')
  if (mode === 'empty') await expect(region(page)).toContainText('현재 마커 페이지에는 체결이 없습니다.')
  if (mode === 'outside') await expect(region(page)).toContainText('현재 표시 범위 0개')
  if (mode === 'gap') await expect(page.getByText('현재 가격 봉에 연결할 수 없는 체결 1건은 마커로 표시하지 않았습니다.', { exact: true })).toBeVisible()
  await expect(page.locator('.cp-footer')).toContainText('2개 봉')
})
for (const mode of ['manifest', 'trade-hash', 'job', 'run', 'source', 'segment', 'leg', 'duplicate', '401', '403', '404', '409', '500'] as const) test(`${mode}: bound SDK failure never supplies chart fills`, async ({ page }) => {
  await setup(page, mode); await load(page)
  await expect(region(page).getByRole('alert')).toContainText('체결 마커를 확인하지 못했습니다.')
  await expect(region(page)).not.toContainText('1페이지 ·')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toHaveCount(0)
  await expect(page.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeVisible()
})
test('next-page response loss retains known page and retries same opaque cursor', async ({ page }) => {
  const controls = await setup(page); await load(page)
  await expect(region(page)).toContainText('1페이지 ·')
  controls.failNext = true
  await page.getByRole('button', { name: '다음 체결 마커 페이지' }).click()
  await expect(region(page).getByRole('alert')).toContainText('마지막으로 확인한 한 페이지만 표시합니다.')
  await expect(region(page)).toContainText('1페이지 ·')
  await page.getByRole('button', { name: '같은 체결 마커 페이지 다시 조회' }).click()
  await expect(region(page)).toContainText('2페이지 ·')
  expect(markerRequests(controls).slice(1).map(url => url.searchParams.get('cursor'))).toEqual([cursor, cursor])
})
for (const action of ['segment', 'resolution', 'window', 'series'] as const) test(`${action} change isolates delayed old marker page and clears loaded-page claim`, async ({ page }) => {
  const controls = await setup(page, 'ok', false, false, 2, action === 'series')
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  controls.hold = () => held
  await load(page)
  await expect.poll(() => markerRequests(controls).length).toBe(1)
  if (action === 'segment') await page.getByRole('button', { name: 'IS', exact: true }).click()
  if (action === 'resolution') await page.getByRole('combobox', { name: '차트 해상도' }).selectOption('15m')
  if (action === 'window') await page.getByRole('button', { name: '다음 차트 범위', exact: true }).click()
  if (action === 'series') await page.getByRole('combobox', { name: '차트 데이터' }).selectOption('mark-1m')
  await expect(page.getByRole('button', { name: '체결 마커 조회', exact: true })).toBeEnabled()
  release(); controls.hold = null
  // Wait for the real SDK promise to settle before the negative DOM assertion.
  await expect.poll(() => page.evaluate(() => (window as unknown as { markerAudit: string[] }).markerAudit.length)).toBe(1)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(region(page)).toContainText('아직 조회하지 않았습니다.')
  await expect(region(page)).not.toContainText('1페이지 ·')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toHaveCount(0)
})
for (const status of ['401', '403'] as const) test(`loaded page then ${status}: old fills are removed without altering prices`, async ({ page }) => {
  const controls = await setup(page); await load(page)
  await expect(region(page)).toContainText('1페이지 ·')
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toBeVisible()
  controls.mode = status
  await page.getByRole('button', { name: '다음 체결 마커 페이지' }).click()
  await expect(region(page).getByRole('alert')).toBeVisible()
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toHaveCount(0)
  await expect(region(page)).not.toContainText('1페이지 ·')
  await expect(page.locator('.cp-footer')).toContainText('2개 봉')
})
test('same-tick repeated marker click sends one bounded GET', async ({ page }) => {
  const controls = await setup(page)
  await page.getByRole('button', { name: '체결 마커 조회', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(region(page)).toContainText('1페이지 ·')
  expect(markerRequests(controls)).toHaveLength(1)
})

for (const finish of ['skip', 'complete'] as const) test(`전체 창 결과 재생 ${finish}: 7언어 변경에도 실제 SDK 결속·진행률과100개 한도 GET을 보존한다`, async ({ page }) => {
  await page.clock.install()
  const controls = await setup(page)
  const before = controls.requests.length
  await expect(page.getByRole('button', { name: '차트로 결과 보기', exact: true })).toHaveAttribute('aria-disabled', 'false')
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await expect(page.locator('.cp-execution')).toContainText('100')
  await expect(page.getByRole('dialog')).toContainText('현재 표시 범위 1개 · 전체 체결 아님')
  await page.clock.runFor(12_000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  const canvas = page.locator('.cp-chart canvas').first(), sameCanvas = await canvas.elementHandle()
  const progress = page.locator('.cp-replay progress')
  const reads = controls.requests.map(url => url.href)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko']) {
    const previous = await progress.evaluate(node => (node as HTMLProgressElement).value)
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
    expect(await progress.evaluate(node => (node as HTMLProgressElement).value)).toBeGreaterThanOrEqual(previous)
    expect(await canvas.evaluate((node, original) => node === original, sameCanvas)).toBe(true)
    expect(controls.requests.map(url => url.href)).toEqual(reads)
    await page.clock.runFor(2_000)
  }
  if (finish === 'skip') await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  else await page.clock.runFor(60_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await canvas.evaluate((node, original) => node === original, sameCanvas)).toBe(true)
  await sameCanvas?.dispose()
  expect(controls.requests.length).toBe(before + 1)
  expect(markerRequests(controls)).toHaveLength(1)
  expect(markerRequests(controls)[0].searchParams.has('cursor')).toBe(false)
  await page.getByRole('group', { name: /가격 캔들 및 BUY/ }).press('Home')
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toContainText('evt_native_entry_oos_0001')
})

for (const mode of ['manifest', 'trade-hash', 'job', 'run', 'source', 'segment', '401', '403'] as const) test(`${mode}: 결과 재생 진입도 SDK 거절을 우회하거나 실패 결과를 재생하지 않는다`, async ({ page }) => {
  const controls = await setup(page, mode)
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(region(page).getByRole('alert')).toBeVisible()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  expect(markerRequests(controls)).toHaveLength(1)
  expect(await page.evaluate(() => Reflect.get(window, 'markerAudit'))).toEqual(['REJECTED'])
})

for (const mode of ['empty', 'outside', 'gap'] as const) test(`${mode}: 결과 재생에 없는 체결을 만들지 않는다`, async ({ page }) => {
  await page.clock.install()
  const controls = await setup(page, mode)
  await page.getByRole('button', { name: '차트로 결과 보기', exact: true }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(59_000)
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await page.clock.runFor(1_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(markerRequests(controls)).toHaveLength(1)
})

// Document-shell coverage still crosses createNativeServiceApi and generated
// SDK HTTP validation. Synthetic relocation/host props are NOT actual service
// execution, accepted completed-job wire data, owner authority or performance.
const replayDocument = (page: Page) => page.getByTestId('native-report-document')
const documentReplayAction = (page: Page) => replayDocument(page).getByRole('button', { name: '체결 순서 재생', exact: true })
const replayDialog = (page: Page) => page.locator('dialog.ctt-modal[open]')

async function openReplayDocument(page: Page) {
  const chat = page.locator('[data-analysis-tab="chat"]')
  if (await chat.isVisible()) await chat.click()
  await page.locator('.g-tabs').getByRole('button', { name: '백테스트 결과', exact: true }).click()
  await expect(replayDocument(page)).toBeVisible()
  await expect(replayDocument(page)).toHaveAttribute('data-state', 'ready')
  await expect(documentReplayAction(page)).toBeEnabled()
  await expect(documentReplayAction(page)).toHaveClass(/nrd-replay/)
}

async function rememberReplayDocument(page: Page) {
  await page.locator('.cp-chart canvas').first().evaluate(element => Reflect.set(window, 'reportReplayCanvas', element))
  await page.locator('.g-composer textarea').evaluate(element => Reflect.set(window, 'reportReplayComposer', element))
  await replayDocument(page).evaluate(element => Reflect.set(window, 'reportReplayDocument', element))
}

async function expectDocumentReplayReturn(page: Page) {
  // No helper reopens the document: the original navigation callback must do
  // the restoration itself, including the narrow conversation pane and focus.
  await expect(replayDialog(page)).toHaveCount(0)
  await expect(replayDocument(page)).toBeVisible()
  await expect(page.locator('.native-analysis-conversation')).toBeVisible()
  await expect(documentReplayAction(page)).toBeFocused()
  await expect(documentReplayAction(page)).toBeEnabled()
  await expect(page.locator('.ctt-terminal[data-embedded="true"]')).toHaveAttribute('data-panel', 'chart')
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await expect(page.locator('.g-composer textarea')).toHaveValue('재생 후에도 보존할 문서 질문')
  expect(await page.locator('.cp-chart canvas').first().evaluate(element => element === Reflect.get(window, 'reportReplayCanvas'))).toBe(true)
  expect(await replayDocument(page).evaluate(element => element === Reflect.get(window, 'reportReplayDocument'))).toBe(true)
  expect(await page.locator('.g-composer textarea').evaluate(element => element === Reflect.get(window, 'reportReplayComposer'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'documentReplaySent'))).toEqual([])
}

async function expectPresentationIdentityLocked(page: Page) {
  const dialog = replayDialog(page)
  await expect(dialog.getByRole('button', { name: '결과 상세 다시 조회', exact: true, includeHidden: true })).toBeDisabled()
  await expect(dialog.getByRole('combobox', { name: '차트 해상도', exact: true, includeHidden: true })).toBeDisabled()
  for (const selector of ['[data-native-controls="segments"] button', '.native-chart-toolbar button',
    '[data-native-controls="trade-pages"] button', '[data-native-controls="fill-markers"] button']) {
    const controls = dialog.locator(selector)
    expect(await controls.count()).toBeGreaterThan(0)
    for (const control of await controls.all()) await expect(control).toBeDisabled()
  }
}

test('데스크톱 전체창 재생은 안내 높이까지 반영해 차트 하단을 화면 안에 둔다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  await setup(page, 'ok', false, true)
  await openReplayDocument(page)
  await documentReplayAction(page).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.screenshot({ path: info.outputPath('native-replay-height.png'), fullPage: true, animations: 'disabled' })
  const geometry = await page.evaluate(() => {
    const properties = ['display', 'position', 'height', 'min-height', 'max-height', 'padding', 'margin',
      'box-sizing', 'gap', 'row-gap', 'flex-wrap', 'grid-template-rows', 'font', 'line-height', '--cp-replay-reserve']
    const selectors = ['.ctt-modal[open]', '.ctt-header', '.ctt-context', '.ctt-notice', '.ctt-market', '.ctt-chart',
      '.cp-chart', '.cp-toolbar', '.cp-controls', '.cp-controls button', '.cp-drawing-layout', '.cp-drawing-tools',
      '.cp-replay', '.cp-replay > span', '.cp-execution', '.cp-surface', '.cp-footer']
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      regions: Object.fromEntries(selectors.map(selector => [selector, Array.from(document.querySelectorAll(selector), node => {
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node)
        return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom },
          styles: Object.fromEntries(properties.map(property => [property, style.getPropertyValue(property)])) }
      })])) }
  })
  await info.attach('native-replay-geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' })
  const footer = await page.locator('.cp-footer').boundingBox()
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(1080)
  await expect(replayDialog(page).getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toBeInViewport()
})

for (const width of [320, 390, 940, 1440]) test(`${width}px 실제 SDK 체결 재생 안내는 봉 영역을 가리지 않고 장문·확대·Skip에도 단일 차트를 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 740 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await documentReplayAction(page).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(100)
  // Settle the finite dialog FLIP before comparing physical rectangles;
  // Playwright's virtual interval clock does not advance the WAAPI timeline.
  await page.screenshot({ path: info.outputPath(`replay-layout-${width}-entered.png`), fullPage: true, animations: 'disabled' })
  const reads = controls.requests.map(url => url.href)
  const surface = page.locator('.cp-surface')
  const height = await surface.evaluate(element => element.getBoundingClientRect().height)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(language => Reflect.get(window, 'setReplayDocumentLanguage')(language), language)
    await expect(page.locator('.cp-replay > span')).toHaveText(professionalChartLocale(language).t('replayNote'))
    const scale = await page.addStyleTag({ content: '.cp-replay { font-size: 24px !important; }' })
    const geometry = await page.locator('.cp-replay').evaluate(element => {
      const chart = element.closest('.cp-chart')!, surface = chart.querySelector('.cp-surface')!
      const note = element.getBoundingClientRect(), plot = surface.getBoundingClientRect(), bounds = chart.getBoundingClientRect()
      return { separate: note.bottom <= plot.top, contained: note.left >= bounds.left && note.right <= bounds.right,
        textFits: element.scrollWidth <= element.clientWidth, height: plot.height }
    })
    await page.screenshot({ path: info.outputPath(`replay-layout-${width}-${language}-200.png`), fullPage: true, animations: 'disabled' })
    expect(geometry, 'Replay explanations must never cover the candle canvas').toEqual({ separate: true, contained: true, textFits: true, height })
    await scale.evaluate(element => element.remove())
  }
  await page.evaluate(() => Reflect.get(window, 'setReplayDocumentLanguage')('ko'))
  await page.clock.runFor(59_800)
  await expect(page.locator('.cp-execution b')).toHaveText('SELL')
  await page.screenshot({ path: info.outputPath(`replay-layout-${width}-final.png`), fullPage: true, animations: 'disabled' })
  expect(await page.locator('.cp-replay').evaluate(element => element.getBoundingClientRect().bottom <= element.closest('.cp-chart')!.querySelector('.cp-surface')!.getBoundingClientRect().top)).toBe(true)
  await surface.scrollIntoViewIfNeeded()
  await expect(replayDialog(page).getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toBeInViewport()
  await replayDialog(page).getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expectDocumentReplayReturn(page)
  expect(controls.requests.map(url => url.href)).toEqual(reads)
  expect(markerRequests(controls)).toHaveLength(1)
})

test('문서 기본 차트 버튼은 실제 SDK marker GET이나 모달 재생을 시작하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  const reads = controls.requests.map(url => url.href)
  await replayDocument(page).locator('.nrd-primary').click()
  await expect(page.locator('.native-analysis-result')).toBeFocused()
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(replayDialog(page)).toHaveCount(0)
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  expect(markerRequests(controls)).toHaveLength(0)
  expect(controls.requests.map(url => url.href)).toEqual(reads)
  expect(await page.locator('.cp-chart canvas').first().evaluate(element => element === Reflect.get(window, 'reportReplayCanvas'))).toBe(true)
  await openReplayDocument(page)
  await expect(page.locator('.g-composer textarea')).toHaveValue('재생 후에도 보존할 문서 질문')
})

for (const finish of ['skip', 'complete'] as const) test(`문서 명시 재생 ${finish}는 중복 클릭 GET1과 동일 canvas를 지키고 원문서 CTA로 돌아온다`, async ({ page }, info) => {
  await page.setViewportSize({ width: finish === 'skip' ? 320 : 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  const controls = await setup(page, 'ok', false, true)
  // Keep the 60-second replay under explicit virtual-time control; screenshots
  // and protocol assertions must not advance its last readable SELL beat.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await openReplayDocument(page); await rememberReplayDocument(page)
  const reads = controls.requests.map(url => url.href)
  await documentReplayAction(page).focus()
  await documentReplayAction(page).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() })
  await expect(replayDialog(page)).toBeVisible()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await expect(page.locator('.cp-execution')).toContainText('100')
  await page.screenshot({ path: info.outputPath(`document-replay-${finish}.png`), fullPage: true })
  await expectPresentationIdentityLocked(page)
  expect(markerRequests(controls)).toHaveLength(1)
  expect(markerRequests(controls)[0].searchParams.get('limit')).toBe('100')
  expect(markerRequests(controls)[0].searchParams.has('cursor')).toBe(false)
  // Both legs are exact SDK-validated source fixtures. The final candle must
  // get its own readable beat before natural completion, not a fabricated fill.
  await expect(replayDialog(page).locator('.native-fill-inspector')).toContainText('BUY')
  await expect(replayDialog(page).locator('.native-fill-inspector')).toContainText('SELL')
  await expect(replayDialog(page).locator('.native-fill-inspector')).toContainText('evt_native_exit_oos_0001')
  await page.clock.runFor(12_000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  expect(await page.locator('.cp-replay progress').evaluate(element => (element as HTMLProgressElement).value)).toBeGreaterThan(0)
  if (finish === 'skip') await replayDialog(page).getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  else {
    await page.clock.runFor(47_000)
    await expect(page.locator('.cp-execution')).toContainText('SELL')
    await page.clock.runFor(1_000)
  }
  await expectDocumentReplayReturn(page)
  // Virtual replay time does not necessarily advance the browser's WAAPI
  // timeline. Finish finite FLIP motion before inspecting the resting layout.
  await page.screenshot({ path: info.outputPath(`document-return-${finish}.png`), fullPage: true, animations: 'disabled' })
  if (finish === 'complete') {
    await replayDocument(page).locator('.nrd-primary').click()
    const openTerminal = page.getByRole('button', { name: '터미널에서 보기', exact: true })
    await openTerminal.click()
    await expect(replayDialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(replayDialog(page)).toHaveCount(0)
    await expect(page.locator('.native-analysis-layout')).toHaveAttribute('data-pane', 'analysis')
    await expect(openTerminal).toBeFocused()
    await expect(documentReplayAction(page)).not.toBeFocused()
  }
  expect(controls.requests.filter(url => !url.pathname.endsWith('fill-markers')).map(url => url.href)).toEqual(reads)
  expect(markerRequests(controls)).toHaveLength(1)
  expect(await page.evaluate(() => Reflect.get(window, 'markerAudit'))).toEqual(['RESOLVED'])
  await expect(page.locator('.cp-chart')).toHaveCount(1)
})

for (const mode of ['manifest', '401'] as const) test(`문서 재생 ${mode} SDK 거절은 재생·toast를 만들지 않고 닫으면 원문서로 돌아온다`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const controls = await setup(page, mode, false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  const reads = controls.requests.map(url => url.href)
  await documentReplayAction(page).click()
  await expect(replayDialog(page)).toBeVisible()
  await expect(replayDialog(page).locator('[data-native-controls="fill-markers"]').getByRole('alert')).toContainText('체결 마커를 확인하지 못했습니다.')
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await expect(page.locator('[aria-label="조회 구간 체결"]')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'markerAudit'))).toEqual(['REJECTED'])
  expect(markerRequests(controls)).toHaveLength(1)
  await replayDialog(page).locator('[data-terminal-close]').click()
  await expectDocumentReplayReturn(page)
  expect(controls.requests.filter(url => !url.pathname.endsWith('fill-markers')).map(url => url.href)).toEqual(reads)
})

test('문서 재생 reduced motion은 확인된 marker GET1 후 즉시 결과와 호출 초점으로 돌아온다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  const reads = controls.requests.map(url => url.href)
  await documentReplayAction(page).click()
  await expect.poll(() => markerRequests(controls).length).toBe(1)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'markerAudit'))).toEqual(['RESOLVED'])
  await expectDocumentReplayReturn(page)
  expect(controls.requests.filter(url => !url.pathname.endsWith('fill-markers')).map(url => url.href)).toEqual(reads)
  await expect(page.locator('.native-service-result')).not.toHaveAttribute('data-presentation', 'true')
  const notice = page.getByTestId('native-report-replay-notice')
  await expect(notice).toBeVisible()
  await expect(notice).toHaveAttribute('role', 'status')
  await page.screenshot({ path: info.outputPath('reduced-notice-320.png'), fullPage: true, animations: 'disabled' })
  expect(await notice.evaluate(element => {
    const composer = element.closest('.client-lab-conversation')!.querySelector<HTMLElement>('.g-composer-wrap')!
    return element.getBoundingClientRect().bottom <= composer.getBoundingClientRect().top - parseFloat(getComputedStyle(composer, '::before').height) + 1
  }), 'The returned explanation must be above the composer fade').toBe(true)
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(language => Reflect.get(window, 'setReplayDocumentLanguage')(language), language)
    await expect(notice).toHaveText(professionalChartLocale(language).t('reduced'))
    expect(await notice.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  expect(markerRequests(controls)).toHaveLength(1)
  await page.evaluate(() => Reflect.get(window, 'setReplayDocumentLanguage')('ko'))
  // An ordinary subsequent replay must remove the previous reason, including
  // a marker failure. This is a presentation notice, never a job status.
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  controls.mode = '401'
  await documentReplayAction(page).click()
  await expect(replayDialog(page).locator('[data-native-controls="fill-markers"]').getByRole('alert')).toBeVisible()
  await page.keyboard.press('Escape')
  await expectDocumentReplayReturn(page)
  await expect(notice).toHaveText('')
})

test('넓은 화면은 감소 안내의 live region을 중복하지 않고 인라인 새 재생에서 옛 안내를 지운다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  await documentReplayAction(page).click()
  await expectDocumentReplayReturn(page)
  const notice = page.getByTestId('native-report-replay-notice')
  await expect(notice).toHaveText(professionalChartLocale('ko').t('reduced'))
  await expect.soft(notice).not.toHaveAttribute('role', 'status')
  await expect(page.locator('.cp-sr-only')).toHaveText(professionalChartLocale('ko').t('reduced'))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('.cp-chart').getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(notice).toHaveText('')
  await page.locator('.cp-chart').getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(notice).toHaveText('')
  expect(markerRequests(controls)).toHaveLength(1)
})

test('인라인 감소 설정 재시도도 옛 문서 안내를 지우며 조회나 재생을 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  await documentReplayAction(page).click()
  await expectDocumentReplayReturn(page)
  const notice = page.getByTestId('native-report-replay-notice')
  await expect(notice).toHaveText(professionalChartLocale('ko').t('reduced'))
  const reads = controls.requests.map(url => url.href)
  await page.locator('.cp-chart').getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(notice).toHaveText('')
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-sr-only')).toHaveText(professionalChartLocale('ko').t('reduced'))
  expect(controls.requests.map(url => url.href)).toEqual(reads)
})

test('문서 재생 도중 모션 감소로 바꾸면 복귀한 문서에만 사유를 남긴다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  const notice = page.getByTestId('native-report-replay-notice')
  await expect(notice).toHaveText('')
  await documentReplayAction(page).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.clock.runFor(10_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.runFor(100)
  await expectDocumentReplayReturn(page)
  await expect(notice).toBeVisible()
  await expect(notice).toHaveText(professionalChartLocale('ko').t('reduced'))
  expect(markerRequests(controls)).toHaveLength(1)
  await expect(page.locator('.cp-execution')).toHaveCount(0)
})

test('문서 재생 종료 시각이 지난 지연 tick은 감소 설정이 켜져도 건너뜀 안내를 만들지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.clock.install()
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000))
  await documentReplayAction(page).click()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.fastForward(61_000)
  await expectDocumentReplayReturn(page)
  await expect(page.getByTestId('native-report-replay-notice')).toHaveText('')
  expect(markerRequests(controls)).toHaveLength(1)
})

for (const action of ['replay', 'trades'] as const) test(`문서 ${action} 포인터가 버튼을 포커스하지 않아도 닫기는 실제 호출 CTA로 복귀한다`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page)
  const trigger = action === 'replay' ? documentReplayAction(page) : replayDocument(page).getByRole('button', { name: 'OOS 거래 내역', exact: true })
  await page.locator('.g-composer textarea').focus()
  await trigger.evaluate(button => (button as HTMLButtonElement).click())
  await expect(replayDialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(replayDialog(page)).toHaveCount(0)
  await expect(replayDocument(page)).toBeVisible()
  await expect(trigger).toBeFocused()
  expect(markerRequests(controls).length).toBe(action === 'replay' ? 1 : 0)
})

test('문서 재생 loading Skip 뒤 늦은 정상 marker 응답은 재생·모달·초점을 다시 열지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const controls = await setup(page, 'ok', false, true)
  await openReplayDocument(page); await rememberReplayDocument(page)
  const reads = controls.requests.map(url => url.href)
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  controls.hold = () => held
  await documentReplayAction(page).click()
  await expect.poll(() => markerRequests(controls).length).toBe(1)
  await expect(replayDialog(page).getByRole('button', { name: 'Skip · 결과 보기', exact: true })).toBeVisible()
  await expect(replayDialog(page).locator('.cp-controls').getByRole('button', { name: '체결 순서 재생', exact: true })).toHaveCount(0)
  for (const button of await replayDialog(page).locator('.cp-controls button').all()) await expect(button).toBeDisabled()
  await expectPresentationIdentityLocked(page)
  await replayDialog(page).getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expectDocumentReplayReturn(page)
  const input = page.locator('.g-composer textarea')
  await input.focus()
  release(); controls.hold = null
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'markerAudit'))).toEqual(['RESOLVED'])
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('재생 후에도 보존할 문서 질문')
  await expect(replayDocument(page)).toBeVisible()
  await expect(replayDialog(page)).toHaveCount(0)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-execution')).toHaveCount(0)
  await expect(page.locator('.native-fill-inspector')).toHaveCount(0)
  await expect(documentReplayAction(page)).toBeEnabled()
  expect(controls.requests.filter(url => !url.pathname.endsWith('fill-markers')).map(url => url.href)).toEqual(reads)
  expect(markerRequests(controls)).toHaveLength(1)
})
