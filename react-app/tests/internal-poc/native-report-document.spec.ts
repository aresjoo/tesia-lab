import { expect, test, type Page } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'
import type { ClientLanguage } from '../../src/client-preferences'
import { formatResultRatePercent } from '../../src/internal-poc/native-result-number-format'
import { nativeResultText } from '../../src/internal-poc/native-result-copy'
import { nativeInlineResultCopy } from '../../src/internal-poc/native-inline-result-copy'
import { nativeShellText } from '../../src/internal-poc/native-shell-copy'

// Integrated display seam: actual shell/layout/result controller, controlled
// report API promises, one chart. SYNTHETIC_CONTRACT_FIXTURE is not performance,
// SDK/API authorization, owner binding or real execution acceptance evidence.
// The host explicitly keys owner/job replacement; NativeServiceApp owns that
// binding in production and is tested independently.
const report = (fixtures.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
const oosTrades = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages.find(page => page.name === 'oos-default')!.response.data.trades
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const rateFields = ['netReturnRate', 'buyAndHoldReturnRate', 'maxDrawdownRate', 'winRate'] as const
const doc = (page: Page) => page.getByTestId('native-report-document')
const composer = (page: Page) => page.locator('.g-composer textarea')
const counts = (page: Page) => page.evaluate(() => Reflect.get(window, 'reportDocumentCalls') as { report: number; chart: number; trades: number; markers: number; send: string[] })
const resolveReport = (page: Page, index: number, fail = false) => page.evaluate(({ index, fail }) => Reflect.get(window, 'resolveDocumentReport')(index, fail), { index, fail })
const change = (page: Page, patch: { owner?: string; jobId?: string; visible?: boolean }) => page.evaluate(patch => Reflect.get(window, 'changeDocumentHost')(patch), patch)
const language = (page: Page, locale: ClientLanguage) => page.evaluate(locale => Reflect.get(window, 'setDocumentLanguage')(locale), locale)

async function mount(page: Page) {
  const requests: string[] = [], errors: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) requests.push(request.url()) })
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/native-report-document-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="document-root"></div></body></html>' }))
  await page.goto('/native-report-document-test.html')
  await page.evaluate(async data => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const shellPath = '/src/internal-poc/ClientServiceExperience.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(shellPath)).text()
    const reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ reactPath), react = reactModule.default ?? reactModule, h = react.createElement
    const dom = await import(/* @vite-ignore */ domPath), { ClientServiceExperience } = await import(/* @vite-ignore */ shellPath)
    const resultPath = '/src/internal-poc/NativeServiceResult.tsx', { NativeServiceResult } = await import(/* @vite-ignore */ resultPath)
    const preferencesPath = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ preferencesPath)
    Reflect.set(window, 'setDocumentLanguage', (locale: ClientLanguage) => setClientPreference('language', locale))
    const report = (data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    const chart = data.sources[0].fixture as unknown as { manifest: NativeChartManifest; window: NativeChartWindow }
    const trades = (data.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages
    const calls = { report: 0, chart: 0, trades: 0, markers: 0, send: [] as string[] }
    const modes = { chart: 'ready', trades: 'ready' }
    const pending: { resolve: () => void; reject: () => void }[] = []
    const pendingTrades: (() => void)[] = []
    const api = {
      report: (job: { backtestId: string }) => {
        calls.report++
        return new Promise((resolve, reject) => pending.push({
          resolve: () => resolve({ ...report, binding: { ...report.binding, backtestId: job.backtestId } }),
          reject: () => reject(new Error('SYNTHETIC_DOCUMENT_REPORT_FAILURE')),
        }))
      },
      trades: async (_report: unknown, segment: string) => {
        calls.trades++
        if (modes.trades === 'fail') throw new Error('SYNTHETIC_DOCUMENT_TRADES_FAILURE')
        const response = trades.find(row => row.name === (segment === 'OOS' ? 'oos-default' : 'is-last'))!.response.data
        if (modes.trades === 'pending') return new Promise(resolve => pendingTrades.push(() => resolve(response)))
        return response
      },
      chart: async (_job: unknown, _report: unknown, segment: string) => {
        calls.chart++
        if (modes.chart === 'fail') throw new Error('SYNTHETIC_DOCUMENT_CHART_FAILURE')
        return { manifest: chart.manifest, window: chart.window,
          navigation: { supportedResolutions: ['1m'], availableRange: chart.window.requestedRange, previousFromInclusive: null, nextFromInclusive: null },
          view: { identity: `document-display-${segment}`, market: 'BTC/USDT', resolutionSeconds: 60, pricePrecision: 3,
            sourceLabel: 'SYNTHETIC_CONTRACT_FIXTURE · 보고서 문서 검수', fills: [],
            bars: chart.window.bars.map(bar => ({ time: Date.parse(bar.openTime) / 1000, open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), volume: Number(bar.volume) })) },
        }
      },
      markers: async () => { calls.markers++; throw new Error('Document navigation must not query fill markers') },
    }
    type View = { owner: string; jobId: string; input: string; visible: boolean }
    function Host() {
      const [view, setView] = react.useState({ owner: 'owner-a', jobId: report.binding.backtestId, input: '보고서 질문 초안', visible: true } as View)
      const job = react.useMemo(() => ({ backtestId: view.jobId, strategyVersionId: 'sv-document-display', state: 'COMPLETED' }), [view.jobId])
      Object.assign(window, { changeDocumentHost: (patch: Partial<View>) => setView((current: View) => ({ ...current, ...patch })) })
      return h(ClientServiceExperience, {
        accountScope: view.owner, analysisIdentity: view.visible ? `${view.owner}:${view.jobId}` : undefined,
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'user-document', role: 'user', text: '서버 검증 보고서를 확인해주세요.' }],
          input: view.input, inputDisabled: false, busy: false, source: 'service', recovery: null, quickReplies: [], workflow: null,
          outcome: h('p', { 'data-document-outcome': true }, '백테스트 완료'), issue: null,
          onInput: (input: string) => setView((current: View) => ({ ...current, input })),
          onSend: async (value: string) => { calls.send.push(value) }, onReset: () => {}, onRecover: undefined, onLogout: undefined },
        strategyDocument: { identity: `${view.owner}:conversation:draft`, content: h('p', { 'data-native-document-draft': true }, '서버 전략 초안 원문') },
        analysis: view.visible ? h(NativeServiceResult, { key: `${view.owner}:${view.jobId}`, api, job, embedded: true }) : null,
      })
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('document-root'))
    Object.assign(window, { reportDocumentCalls: calls, reportDocumentModes: modes,
      resolveDocumentTrades: (index: number) => pendingTrades[index](),
      resolveDocumentReport: (index: number, fail: boolean) => fail ? pending[index].reject() : pending[index].resolve() })
    root.render(h(Host))
  }, fixtures)
  await expect.poll(() => counts(page)).toEqual({ report: 1, trades: 0, chart: 0, markers: 0, send: [] })
  await expect(page.locator('.g-tabs').getByRole('button', { name: '백테스트 결과', exact: true })).toBeVisible()
  return { requests, errors }
}

async function showConversationPane(page: Page) {
  const tab = page.locator('[data-analysis-tab="chat"]')
  if (await tab.isVisible()) await tab.click()
}
async function openDocument(page: Page, locale: ClientLanguage = 'ko') {
  await showConversationPane(page)
  await page.locator('.g-tabs').getByRole('button', { name: nativeResultText(locale, 'resultTitle'), exact: true }).click()
  await expect(doc(page)).toBeVisible()
}
async function expectMetrics(page: Page, locale: ClientLanguage = 'ko') {
  await expect(doc(page)).toHaveAttribute('data-state', 'ready')
  await expect(doc(page)).toHaveAttribute('data-native-evidence', 'SYNTHETIC_CONTRACT_FIXTURE')
  for (const segment of report.nativeEnvelope.projection.segments) {
    const section = doc(page).locator(`.nrd-segment[data-native-segment="${segment.segment}"]`)
    await expect(section).toHaveAttribute('aria-label', nativeInlineResultCopy[locale][segment.segment])
    await expect(section.locator('.nrd-period')).toHaveText(nativeResultText(locale, 'periodUtc') + nativeResultText(locale, 'periodRange', { from: segment.evaluationStartInclusive, to: segment.evaluationEndExclusive }))
    await expect(section.locator('time')).toHaveText([segment.evaluationStartInclusive, segment.evaluationEndExclusive])
    for (const field of rateFields) await expect(section.locator(`[data-native-metric="${field}"]`)).toHaveText(formatResultRatePercent(segment.metrics[field], nativeResultText(locale, 'tinyNegative'))!)
    await expect(section.locator('[data-native-metric="tradeCount"]')).toHaveText(String(segment.summary.tradeCount))
    await expect(section.locator('[data-native-metric="netPnl"]')).toHaveText(segment.summary.netPnl)
  }
  await expect(doc(page).getByTestId('native-report-document-evidence')).toHaveText(nativeResultText(locale, 'syntheticNotice'))
  await expect(doc(page)).not.toContainText(/TETH SCORE|80점|실행 기준 통과|추천 설정/)
}

for (const width of [320, 1100, 1440]) test(`${width}px 보고서·초안·대화·차트 왕복은 단일 DOM/조회와 7언어 원값을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  const { requests, errors } = await mount(page)
  await composer(page).fill('보존할 문서 질문')
  await composer(page).evaluate(element => Reflect.set(window, 'documentComposerNode', element))
  await openDocument(page)
  await expect(doc(page)).toHaveAttribute('data-state', 'loading')
  await expect(doc(page).locator('[data-native-metric], [data-native-raw]')).toHaveCount(0)
  await resolveReport(page, 0); await expectMetrics(page)
  await expect.poll(() => counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await expect(page.locator('.native-service-result')).toHaveCount(1)
  await expect(page.locator('.cp-chart')).toHaveCount(1)
  await page.locator('.cp-chart canvas').first().evaluate(element => Reflect.set(window, 'documentCanvasNode', element))
  await doc(page).evaluate(element => Reflect.set(window, 'documentReportNode', element))
  await expect(doc(page).locator('canvas')).toHaveCount(0)
  const raw = doc(page).getByTestId('native-report-document-raw-rates')
  const values = doc(page).getByTestId('native-report-document-values')
  await raw.locator(':scope > summary').click(); await values.locator(':scope > summary').click()
  const savedScroll = await page.locator('.g-scroll').evaluate(element => { element.scrollTop = 220; return element.scrollTop })
  await page.locator('.g-tabs').getByRole('button', { name: nativeShellText('ko', 'strategyDraft'), exact: true }).click()
  await openDocument(page)
  await expect.poll(() => page.locator('.g-scroll').evaluate(element => element.scrollTop)).toBe(savedScroll)
  const binding = doc(page).getByTestId('native-report-document-binding')
  await binding.locator(':scope > summary').click()
  for (const locale of locales) {
    await language(page, locale); await expectMetrics(page, locale)
    await expect(binding.locator('dt')).toHaveText(['bindingJob', 'bindingReportHash', 'bindingProjectionHash', 'bindingTerminalSealHash'].map(key => nativeResultText(locale, key as Parameters<typeof nativeResultText>[1])))
    for (const [key, value] of Object.entries(report.binding)) await expect(binding.locator(`[data-native-binding="${key}"]`)).toHaveText(String(value))
    await expect(page.locator('.g-tabs').getByRole('button', { name: nativeResultText(locale, 'resultTitle'), exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.locator('[data-report-document-control].g-tab').evaluate(element => {
      const selected = element.getBoundingClientRect(), tabs = element.parentElement!.getBoundingClientRect()
      return selected.left >= tabs.left - 1 && selected.right <= tabs.right + 1
    }), { message: `${locale}: selected result tab remains inside its scroller` }).toBe(true)
    for (const segment of report.nativeEnvelope.projection.segments) {
      for (const field of rateFields) await expect(raw.locator(`[data-native-raw="${field}"][data-native-segment="${segment.segment}"]`)).toHaveText(segment.metrics[field])
      for (const [field, value] of Object.entries({ initialCapital: segment.metrics.initialCapital, finalEquity: segment.metrics.finalEquity,
        tradeCount: segment.summary.tradeCount, netPnl: segment.summary.netPnl, ...segment.costs })) {
        if (field === 'slippagePolicy') continue
        await expect(values.locator(`[data-native-row="${field}"] [data-native-segment="${segment.segment}"]`)).toHaveText(String(value))
      }
    }
    const controls = doc(page).locator('button, summary')
    for (const control of await controls.all()) if (await control.isVisible()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    const geometry = await doc(page).evaluate(element => {
      const box = element.getBoundingClientRect()
      return { fits: box.left >= -1 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1,
        left: box.left, right: box.right, width: element.clientWidth, scrollWidth: element.scrollWidth,
        overflowing: Array.from(element.querySelectorAll<HTMLElement>('*')).filter(child => child.clientWidth > 0 && child.getClientRects().length && !child.closest('.nrd-table-scroll') && child.scrollWidth > child.clientWidth + 1).slice(0, 12).map(child => ({ tag: child.tagName, class: child.className, width: child.clientWidth, scrollWidth: child.scrollWidth, text: child.textContent?.slice(0, 70) })),
        outside: Array.from(element.querySelectorAll('*')).filter(child => !child.closest('.nrd-table-scroll') && child.getBoundingClientRect().right > box.right + 1).slice(0, 5).map(child => ({ tag: child.tagName, class: child.className, right: child.getBoundingClientRect().right, text: child.textContent?.slice(0, 60) })) }
    })
    expect(geometry, `${locale}: ${JSON.stringify(geometry)}`).toMatchObject({ fits: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await raw.locator(':scope > summary').click(); await values.locator(':scope > summary').click()
  await binding.locator(':scope > summary').click()
  await doc(page).getByRole('heading', { level: 3 }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`native-report-document-fr-${width}.png`), fullPage: false })
  await language(page, 'ko')
  await page.locator('.g-tabs').getByRole('button', { name: nativeShellText('ko', 'strategyDraft'), exact: true }).click()
  await expect(page.locator('[data-native-document-draft]')).toBeVisible()
  await expect(doc(page)).not.toBeVisible()
  const artifact = page.locator('.g-aux .g-art').filter({ hasText: '백테스트 결과' })
  await expect(artifact).toHaveCount(1)
  if (await artifact.isVisible()) await artifact.click(); else await openDocument(page)
  await expect(doc(page)).toBeVisible()
  expect(await doc(page).evaluate(element => element === Reflect.get(window, 'documentReportNode'))).toBe(true)
  await doc(page).locator('.nrd-primary').click()
  await expect(page.locator('.native-analysis-result')).toBeFocused()
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  await openDocument(page)
  await expect(composer(page)).toHaveValue('보존할 문서 질문')
  expect(await composer(page).evaluate(element => element === Reflect.get(window, 'documentComposerNode'))).toBe(true)
  expect(await page.locator('.cp-chart canvas').first().evaluate(element => element === Reflect.get(window, 'documentCanvasNode'))).toBe(true)
  expect(await counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await composer(page).press('Enter')
  await expect(doc(page)).not.toBeVisible()
  await expect(page.locator('.g-doc:not([hidden]) .g-thread')).toBeVisible()
  await expect.poll(async () => (await counts(page)).send).toEqual(['보존할 문서 질문'])
  expect(await counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: ['보존할 문서 질문'] })
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('재조회 loading/error 문서는 이전 수치를 제거하고 문서 재시도로 단일 reader만 복구한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await composer(page).fill('재조회 중 보존할 질문')
  await doc(page).locator('.nrd-primary').click()
  const segments = page.locator('.ctt-main-tabs').getByRole('tab', { name: '실행 구간', exact: true })
  if (await segments.isVisible()) await segments.click()
  await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  await openDocument(page)
  await expect(doc(page)).toHaveAttribute('data-state', 'loading')
  await expect(doc(page).locator('[data-native-metric], [data-native-raw]')).toHaveCount(0)
  await expect(doc(page)).not.toHaveAttribute('data-native-evidence')
  await resolveReport(page, 1, true)
  for (const locale of locales) {
    await language(page, locale)
    await expect(doc(page)).toHaveAttribute('data-state', 'error')
    await expect(doc(page)).toContainText(nativeResultText(locale, 'reportFetchFailed'))
    await expect(doc(page).locator('[data-native-metric], [data-native-raw]')).toHaveCount(0)
  }
  await language(page, 'ko')
  await doc(page).getByRole('button', { name: '보고서 다시 조회', exact: true }).click()
  await expect.poll(async () => (await counts(page)).report).toBe(3)
  await expect.poll(() => doc(page).evaluate(element => element === document.activeElement || element.contains(document.activeElement))).toBe(true)
  await resolveReport(page, 2); await expectMetrics(page)
  await expect.poll(() => counts(page)).toEqual({ report: 3, trades: 2, chart: 2, markers: 0, send: [] })
  await expect(composer(page)).toHaveValue('재조회 중 보존할 질문')
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('report는 성공하고 상세 조회만 실패하면 원지표와 상세 오류를 함께 보존한다', async ({ page }) => {
  const { requests, errors } = await mount(page)
  await page.evaluate(() => { Reflect.get(window, 'reportDocumentModes').chart = 'fail' })
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await expect(doc(page).getByTestId('native-report-document-detail-status')).toHaveText(nativeInlineResultCopy.ko.detailError)
  expect(await counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await page.evaluate(() => { Reflect.get(window, 'reportDocumentModes').chart = 'ready' })
  await doc(page).getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  await expect(doc(page)).toHaveAttribute('data-state', 'loading')
  await expect(doc(page).locator('[data-native-metric]')).toHaveCount(0)
  await expect.poll(() => doc(page).evaluate(element => element === document.activeElement || element.contains(document.activeElement))).toBe(true)
  await resolveReport(page, 1); await expectMetrics(page)
  await expect(doc(page).getByTestId('native-report-document-detail-status')).toHaveCount(0)
  expect(await counts(page)).toEqual({ report: 2, trades: 2, chart: 2, markers: 0, send: [] })
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('job/owner 문서 교체와 분석 제거는 늦은 보고서를 새 문서로 노출하지 않는다', async ({ page }) => {
  const { requests, errors } = await mount(page)
  await openDocument(page)
  await change(page, { jobId: 'document-job-next' })
  await expect.poll(async () => (await counts(page)).report).toBe(2)
  await resolveReport(page, 0)
  await openDocument(page)
  await expect(doc(page)).toHaveAttribute('data-backtest-id', 'document-job-next')
  await expect(doc(page)).toHaveAttribute('data-state', 'loading')
  await expect(doc(page).locator('[data-native-metric]')).toHaveCount(0)
  await change(page, { owner: 'owner-b', jobId: 'document-owner-b' })
  await expect.poll(async () => (await counts(page)).report).toBe(3)
  await resolveReport(page, 1)
  await openDocument(page)
  await expect(doc(page)).toHaveAttribute('data-backtest-id', 'document-owner-b')
  await expect(doc(page)).toHaveAttribute('data-state', 'loading')
  await expect(doc(page).locator('[data-native-metric]')).toHaveCount(0)
  await resolveReport(page, 2); await expectMetrics(page)
  await expect.poll(() => counts(page)).toEqual({ report: 3, trades: 1, chart: 1, markers: 0, send: [] })
  await doc(page).locator('.nrd-primary').focus()
  await change(page, { visible: false })
  await expect(doc(page)).toHaveCount(0)
  await expect(page.locator('.g-tabs').getByRole('button', { name: '백테스트 결과', exact: true })).toHaveCount(0)
  await expect(composer(page)).toBeVisible()
  await expect(page.locator('.g-tabs button').first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.g-tabs button').first()).toBeFocused()
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('선택 문서 교체는 잃은 초점만 복구하고 다른 입력창의 초점은 빼앗지 않는다', async ({ page }) => {
  const { requests, errors } = await mount(page)
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await doc(page).locator('.nrd-primary').focus()
  await change(page, { jobId: 'document-replacement' })
  await expect(page.locator('[data-report-document-control].g-tab')).toBeFocused()
  await expect(doc(page)).toHaveAttribute('data-backtest-id', 'document-replacement')
  await expect(doc(page).locator('[data-native-metric]')).toHaveCount(0)
  await resolveReport(page, 1); await expectMetrics(page)
  await composer(page).fill('초점과 초안을 보존')
  await change(page, { jobId: 'document-replacement-again' })
  await expect.poll(async () => (await counts(page)).report).toBe(3)
  await expect(composer(page)).toBeFocused()
  await expect(composer(page)).toHaveValue('초점과 초안을 보존')
  await change(page, { visible: false })
  await expect(composer(page)).toBeFocused()
  await resolveReport(page, 2)
  await expect(doc(page)).toHaveCount(0)
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

const tradeDialog = (page: Page) => page.locator('dialog.ctt-modal[open]')
const tradePane = (page: Page) => tradeDialog(page).locator('.ctt-bottom-pane[data-tab-id="trades"]')

async function openDocumentTrades(page: Page, locale: ClientLanguage = 'ko', segment: 'IS' | 'OOS' = 'OOS') {
  await openDocument(page, locale)
  const action = doc(page).getByRole('button', { name: nativeResultText(locale, 'segmentTradesTitle', { segment }), exact: true })
  await expect(action).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(action).toBeEnabled()
  await action.focus()
  await page.keyboard.press('Enter')
  await expect(tradeDialog(page)).toHaveCount(1)
  await expect(tradeDialog(page)).toBeVisible()
  await expect(tradePane(page)).toHaveAttribute('data-selected', 'true')
  await expect(tradePane(page)).toBeVisible()
  await expect(tradePane(page)).toBeFocused()
}

async function expectTradeSourceValues(page: Page, locale: ClientLanguage = 'ko') {
  const pane = tradePane(page)
  await expect(pane).toHaveAttribute('aria-label', nativeResultText(locale, 'tradesTab'))
  await expect(pane.getByRole('heading', { name: nativeResultText(locale, 'segmentTradesTitle', { segment: 'OOS' }), exact: true })).toBeVisible()
  await expect(pane.locator('tbody tr')).toHaveCount(oosTrades.length)
  for (const [index, trade] of oosTrades.entries()) {
    const cells = pane.locator('tbody tr').nth(index).locator('td')
    const values = [trade.entryFillRef, trade.entryPrice, trade.exitPrice, trade.quantity, trade.fees, trade.funding, trade.netPnl, trade.exitReason]
    for (const [column, value] of values.entries()) await expect(column === 0 ? cells.nth(column).locator('[data-native-entry-fill]') : cells.nth(column)).toHaveText(value)
    await expect(cells.first().getByRole('button')).toHaveAccessibleName(`${nativeResultText(locale, 'tradeDetail')} · ${trade.entryFillRef}`)
  }
}

async function expectDocumentTradeReturn(page: Page, locale: ClientLanguage, originalPanel = 'chart') {
  // No openDocument/showConversationPane here: Escape must restore the actual
  // originating document and CTA, not rely on this test to repair navigation.
  await expect(tradeDialog(page)).toHaveCount(0)
  await expect(page.locator('.native-analysis-conversation')).toBeVisible()
  await expect(doc(page)).toBeVisible()
  await expect(page.locator('[data-report-document-control].g-tab')).toHaveAttribute('aria-pressed', 'true')
  const chatTab = page.locator('[data-analysis-tab="chat"]')
  if (await chatTab.isVisible()) await expect(chatTab).toHaveAttribute('aria-selected', 'true')
  await expect(doc(page).getByRole('button', { name: nativeResultText(locale, 'segmentTradesTitle', { segment: 'OOS' }), exact: true })).toBeFocused()
  const action = doc(page).getByRole('button', { name: nativeResultText(locale, 'segmentTradesTitle', { segment: 'OOS' }), exact: true })
  const clearOfFade = await action.evaluate(element => {
    const composer = element.closest('.client-lab-conversation')!.querySelector<HTMLElement>('.g-composer-wrap')!
    const fadeHeight = parseFloat(getComputedStyle(composer, '::before').height)
    return element.getBoundingClientRect().bottom <= composer.getBoundingClientRect().top - fadeHeight + 1
  })
  expect(clearOfFade, 'returned keyboard action remains above the original composer fade').toBe(true)
  await expect(page.locator('.ctt-terminal[data-embedded="true"]')).toHaveAttribute('data-panel', originalPanel)
  expect(await doc(page).evaluate(element => element === Reflect.get(window, 'documentTradeDocument'))).toBe(true)
  expect(await page.locator('.cp-chart canvas').first().evaluate(element => element === Reflect.get(window, 'documentTradeCanvas'))).toBe(true)
  expect(await counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
}

for (const width of [320, 939, 1100, 1440]) test(`${width}px 문서 거래 내역은 기존 거래 패널만 열고 언어·닫기·재열기에도 조회와 DOM을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  const { requests, errors } = await mount(page)
  await composer(page).fill('거래 내역 왕복 후에도 남는 질문')
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await expect.poll(() => counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await expect(page.locator('.ctt-terminal[data-embedded="true"]')).toHaveAttribute('data-panel', 'chart')
  await doc(page).evaluate(element => Reflect.set(window, 'documentTradeDocument', element))
  await page.locator('.cp-chart canvas').first().evaluate(element => Reflect.set(window, 'documentTradeCanvas', element))
  await composer(page).evaluate(element => Reflect.set(window, 'documentTradeComposer', element))
  await page.locator('.ctt-bottom-pane[data-tab-id="trades"] tbody tr').first().evaluate(element => Reflect.set(window, 'documentTradeRow', element))
  for (const locale of ['ko', 'en', 'ja'] as const) {
    await language(page, locale)
    await openDocumentTrades(page, locale)
    await expectTradeSourceValues(page, locale)
    if (locale === 'ko') await page.screenshot({ path: info.outputPath(`native-report-document-trades-${width}.png`), fullPage: false })
    expect(await tradePane(page).locator('tbody tr').first().evaluate(element => element === Reflect.get(window, 'documentTradeRow'))).toBe(true)
    expect(await page.locator('.cp-chart canvas').first().evaluate(element => element === Reflect.get(window, 'documentTradeCanvas'))).toBe(true)
    await expect(page.locator('.cp-chart')).toHaveCount(1)
    await expect(page.locator('.native-service-result')).toHaveCount(1)
    expect(await counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
    await page.keyboard.press('Escape')
    await expectDocumentTradeReturn(page, locale)
    if (locale === 'ko') await page.screenshot({ path: info.outputPath(`native-report-document-return-${width}.png`), fullPage: false })
    await expect(composer(page)).toHaveValue('거래 내역 왕복 후에도 남는 질문')
    expect(await composer(page).evaluate(element => element === Reflect.get(window, 'documentTradeComposer'))).toBe(true)
    await expectMetrics(page, locale)
  }
  // A preference update while the existing dialog is open changes labels only.
  await openDocumentTrades(page, 'ja')
  await language(page, 'fr')
  await expectTradeSourceValues(page, 'fr')
  await expect(tradePane(page)).toBeFocused()
  expect(await counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await page.keyboard.press('Escape')
  await expectDocumentTradeReturn(page, 'fr')
  await expect(composer(page)).toHaveValue('거래 내역 왕복 후에도 남는 질문')
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('문서 거래 모달 왕복은 사용자가 선택했던 검증 지표·실행 구간 패널도 그대로 복원한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await composer(page).fill('다른 분석 패널에서도 보존할 질문')
  await expect.poll(() => counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await doc(page).evaluate(element => Reflect.set(window, 'documentTradeDocument', element))
  await page.locator('.cp-chart canvas').first().evaluate(element => Reflect.set(window, 'documentTradeCanvas', element))
  for (const [panel, label] of [['detail', 'panelMetrics'], ['strategies', 'panelSegments']] as const) {
    // Choose the original embedded panel through its real tabs, not a control
    // replacement. The document modal must not reset this choice to chart.
    await doc(page).locator('.nrd-primary').click()
    await page.locator('.ctt-main-tabs').getByRole('tab', { name: nativeResultText('ko', label), exact: true }).click()
    await expect(page.locator('.ctt-terminal[data-embedded="true"]')).toHaveAttribute('data-panel', panel)
    await openDocumentTrades(page)
    await expectTradeSourceValues(page)
    await page.keyboard.press('Escape')
    await expectDocumentTradeReturn(page, 'ko', panel)
    await expect(composer(page)).toHaveValue('다른 분석 패널에서도 보존할 질문')
  }
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('넓은 화면의 분석 선택 이력이 있어도 거래 창 안에서 폭을 줄인 뒤 원래 보고서로 복귀한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  const { requests, errors } = await mount(page)
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await doc(page).locator('.nrd-primary').click()
  await expect(page.locator('.native-analysis-layout')).toHaveAttribute('data-pane', 'analysis')
  await expect(page.locator('.native-analysis-layout')).toHaveAttribute('data-narrow', 'false')
  await doc(page).evaluate(element => Reflect.set(window, 'documentTradeDocument', element))
  await page.locator('.cp-chart canvas').first().evaluate(element => Reflect.set(window, 'documentTradeCanvas', element))
  await openDocumentTrades(page)
  await page.setViewportSize({ width: 320, height: 960 })
  await expect(page.locator('.native-analysis-layout')).toHaveAttribute('data-narrow', 'true')
  await expect(tradePane(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expectDocumentTradeReturn(page, 'ko')
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('문서 거래 버튼은 현재 IS 구간을 명시하고 같은 구간의 기존 거래를 연다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await doc(page).locator('.nrd-primary').click()
  await page.locator('.ctt-main-tabs').getByRole('tab', { name: nativeResultText('ko', 'panelSegments'), exact: true }).click()
  await page.locator('[data-native-controls="segments"]').getByRole('button', { name: 'IS', exact: true }).click()
  await expect.poll(() => counts(page)).toEqual({ report: 1, trades: 2, chart: 2, markers: 0, send: [] })
  await openDocument(page)
  await expect(doc(page).getByRole('button', { name: 'OOS 거래 내역', exact: true })).toHaveCount(0)
  await openDocumentTrades(page, 'ko', 'IS')
  await expect(tradePane(page).getByRole('heading')).toHaveText(nativeResultText('ko', 'segmentTradesTitle', { segment: 'IS' }))
  const source = (fixtures.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages.find(row => row.name === 'is-last')!.response.data
  await expect(tradePane(page).locator('tbody tr')).toHaveCount(source.trades.length)
  for (const [index, trade] of source.trades.entries()) await expect(tradePane(page).locator('tbody tr').nth(index).locator('[data-native-entry-fill]')).toHaveText(trade.entryFillRef)
  await page.keyboard.press('Escape')
  await expect(doc(page)).toBeVisible()
  await expect(doc(page).getByRole('button', { name: 'IS 거래 내역', exact: true })).toBeFocused()
  await expect(page.locator('.ctt-terminal[data-embedded="true"]')).toHaveAttribute('data-panel', 'strategies')
  expect(await counts(page)).toEqual({ report: 1, trades: 2, chart: 2, markers: 0, send: [] })
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('거래 창 안의 같은 보고서 재조회로 호출 버튼이 사라져도 닫으면 그 문서에 초점이 복귀한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await resolveReport(page, 0); await openDocumentTrades(page)
  await doc(page).evaluate(element => Reflect.set(window, 'documentRetryReturnArticle', element))
  await tradeDialog(page).locator('.ctt-main-tabs').getByRole('tab', { name: nativeResultText('ko', 'panelSegments'), exact: true }).click()
  await tradeDialog(page).getByRole('button', { name: nativeResultText('ko', 'reloadResultDetail'), exact: true }).click()
  await expect.poll(() => counts(page)).toEqual({ report: 2, trades: 1, chart: 1, markers: 0, send: [] })
  await expect(doc(page)).toHaveAttribute('data-state', 'loading')
  await expect(doc(page).getByRole('button', { name: 'OOS 거래 내역', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(tradeDialog(page)).toHaveCount(0)
  await expect(doc(page)).toBeVisible()
  await expect(doc(page)).toBeFocused()
  expect(await doc(page).evaluate(element => element === Reflect.get(window, 'documentRetryReturnArticle'))).toBe(true)
  await resolveReport(page, 1, true)
  await expect(doc(page)).toHaveAttribute('data-state', 'error')
  await expect(doc(page)).toBeFocused()
  await expect(doc(page).getByRole('button', { name: nativeResultText('ko', 'retryReport'), exact: true })).toBeVisible()
  expect(await counts(page)).toEqual({ report: 2, trades: 1, chart: 1, markers: 0, send: [] })
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('문서 거래 내역은 상세 실패의 오류와 같은 거래 페이지 재시도를 숨기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await composer(page).fill('거래 조회 실패 중 보존할 질문')
  await page.evaluate(() => { Reflect.get(window, 'reportDocumentModes').trades = 'fail' })
  await resolveReport(page, 0); await openDocument(page); await expectMetrics(page)
  await expect(doc(page).getByTestId('native-report-document-detail-status')).toHaveText(nativeInlineResultCopy.ko.detailError)
  await expect.poll(() => counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await page.locator('.cp-chart canvas').first().evaluate(element => Reflect.set(window, 'documentTradeFailureCanvas', element))
  await openDocumentTrades(page)
  await expect(tradePane(page).getByRole('alert')).toHaveText(nativeResultText('ko', 'tradesError'))
  await expect(tradePane(page).locator('tbody tr')).toHaveCount(0)
  const retry = tradePane(page).getByRole('button', { name: nativeResultText('ko', 'retryTradePage'), exact: true })
  await expect(retry).toBeVisible()
  await expect(retry).toBeEnabled()
  expect(await counts(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: [] })
  await page.evaluate(() => { Reflect.get(window, 'reportDocumentModes').trades = 'ready' })
  await retry.focus(); await page.keyboard.press('Enter')
  await expectTradeSourceValues(page)
  await expect(tradePane(page).getByRole('alert')).toHaveCount(0)
  await expect.poll(() => counts(page)).toEqual({ report: 1, trades: 2, chart: 1, markers: 0, send: [] })
  expect(await page.locator('.cp-chart canvas').first().evaluate(element => element === Reflect.get(window, 'documentTradeFailureCanvas'))).toBe(true)
  await page.keyboard.press('Escape')
  await openDocument(page)
  await expectMetrics(page)
  await expect(doc(page).getByTestId('native-report-document-detail-status')).toHaveCount(0)
  await expect(composer(page)).toHaveValue('거래 조회 실패 중 보존할 질문')
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('열린 문서 거래 패널의 owner/job 교체는 이전 행과 늦은 거래 응답을 새 결과에 남기지 않는다', async ({ page }) => {
  const { requests, errors } = await mount(page)
  await resolveReport(page, 0); await openDocumentTrades(page); await expectTradeSourceValues(page)
  await tradePane(page).locator('tbody tr').first().evaluate(element => Reflect.set(window, 'documentOldOwnerTradeRow', element))
  await page.evaluate(() => { Reflect.get(window, 'reportDocumentModes').trades = 'pending' })
  await change(page, { jobId: 'document-trades-next-job' })
  await expect(tradeDialog(page)).toHaveCount(0)
  await expect.poll(async () => (await counts(page)).report).toBe(2)
  await openDocument(page)
  await expect(doc(page)).toHaveAttribute('data-backtest-id', 'document-trades-next-job')
  await expect(doc(page).getByRole('button', { name: 'OOS 거래 내역', exact: true })).toHaveCount(0)
  await resolveReport(page, 1)
  await expect.poll(() => counts(page)).toEqual({ report: 2, trades: 2, chart: 2, markers: 0, send: [] })
  await openDocumentTrades(page)
  await expect(tradePane(page).locator('tbody tr')).toHaveCount(0)
  await expect(tradePane(page).getByRole('status')).toHaveText(nativeResultText('ko', 'tradesLoading'))
  await change(page, { owner: 'owner-b', jobId: 'document-trades-owner-b' })
  await expect(tradeDialog(page)).toHaveCount(0)
  await expect.poll(async () => (await counts(page)).report).toBe(3)
  await page.evaluate(() => Reflect.get(window, 'resolveDocumentTrades')(0))
  await openDocument(page)
  await expect(doc(page)).toHaveAttribute('data-backtest-id', 'document-trades-owner-b')
  await expect(doc(page)).toHaveAttribute('data-state', 'loading')
  await expect(doc(page).locator('[data-native-metric]')).toHaveCount(0)
  await expect(page.locator('.ctt-bottom-pane[data-tab-id="trades"] tbody tr')).toHaveCount(0)
  expect(await page.evaluate(() => (Reflect.get(window, 'documentOldOwnerTradeRow') as HTMLElement).isConnected)).toBe(false)
  await page.evaluate(() => { Reflect.get(window, 'reportDocumentModes').trades = 'ready' })
  await resolveReport(page, 2); await openDocumentTrades(page); await expectTradeSourceValues(page)
  expect(await tradePane(page).locator('tbody tr').first().evaluate(element => element === Reflect.get(window, 'documentOldOwnerTradeRow'))).toBe(false)
  await expect(page.locator('.native-service-result')).toHaveAttribute('data-native-report', 'document-trades-owner-b')
  await expect(page.locator('.native-service-result')).toHaveCount(1)
  await expect.poll(() => counts(page)).toEqual({ report: 3, trades: 3, chart: 3, markers: 0, send: [] })
  await page.keyboard.press('Escape')
  await expect(tradeDialog(page)).toHaveCount(0)
  expect(requests).toEqual([]); expect(errors).toEqual([])
})
