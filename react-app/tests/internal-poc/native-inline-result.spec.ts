import { expect, test, type Page } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'
import { formatResultRatePercent } from '../../src/internal-poc/native-result-number-format'
import { nativeResultText } from '../../src/internal-poc/native-result-copy'
import { nativeInlineResultCopy } from '../../src/internal-poc/native-inline-result-copy'
import { nativeWorkflowText } from '../../src/internal-poc/native-workflow-copy'
import type { ClientLanguage } from '../../src/client-preferences'

/** Display seam only: real shell/result/portal with controlled read promises.
 * The fixture is SYNTHETIC_CONTRACT_FIXTURE, not actual market performance or
 * SDK/API/owner authority evidence. Owner replacement explicitly unmounts the
 * old subtree; NativeServiceApp's session binding has separate acceptance.
 */
const reportFixture = (fixtures.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
const card = (page: Page) => page.getByTestId('native-inline-result')
const composer = (page: Page) => page.locator('.g-composer textarea')
const calls = (page: Page) => page.evaluate(() => Reflect.get(window, 'inlineResultCalls') as { report: number; trades: number; chart: number; markers: number; send: number })
const settle = (page: Page, index: number, failure = false) => page.evaluate(({ index, failure }) => Reflect.get(window, 'settleInlineReport')(index, failure), { index, failure })
const change = (page: Page, patch: { owner?: string; jobId?: string; previous?: boolean; visible?: boolean; editDisabled?: boolean }) => page.evaluate(patch => Reflect.get(window, 'changeInlineResult')(patch), patch)
const language = (page: Page, value: ClientLanguage) => page.evaluate(value => Reflect.get(window, 'setInlineResultLanguage')(value), value)

async function mount(page: Page) {
  const requests: string[] = [], errors: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method())) requests.push(request.url())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/native-inline-result-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="inline-result-root"></div></body></html>' }))
  await page.goto('/native-inline-result-test.html')
  await page.evaluate(async data => {
    const refreshPath = '/@react-refresh'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const shellPath = '/src/internal-poc/ClientServiceExperience.tsx'
    const source = await (await fetch(shellPath)).text()
    const reactPath = source.match(/from "([^"\n]*\/react\.js[^"\n]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ reactPath), react = reactModule.default ?? reactModule, h = react.createElement
    const domPath = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ domPath)
    const { ClientServiceExperience } = await import(/* @vite-ignore */ shellPath)
    const resultPath = '/src/internal-poc/NativeServiceResult.tsx'
    const { NativeServiceResult } = await import(/* @vite-ignore */ resultPath)
    const preferencesPath = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ preferencesPath)
    Reflect.set(window, 'setInlineResultLanguage', (value: ClientLanguage) => setClientPreference('language', value))
    const report = (data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    const chart = data.sources[0].fixture as unknown as { manifest: NativeChartManifest; window: NativeChartWindow }
    const trades = (data.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages
    const calls = { report: 0, trades: 0, chart: 0, markers: 0, send: 0 }
    const modes = { chart: 'ready', trades: 'ready' }
    const detailPending: { resolve: () => void; reject: () => void }[] = []
    const pending: { resolve: () => void; reject: () => void }[] = []
    const api = {
      report: (job: { backtestId: string }) => {
        calls.report++
        return new Promise((resolve, reject) => pending.push({
          resolve: () => resolve({ ...report, binding: { ...report.binding, backtestId: job.backtestId } }),
          reject: () => reject(new Error('SYNTHETIC_DISPLAY_READ_FAILURE')),
        }))
      },
      trades: async (_report: unknown, segment: string) => {
        calls.trades++
        if (modes.trades === 'fail') throw new Error('SYNTHETIC_TRADE_DISPLAY_FAILURE')
        return trades.find(row => row.name === (segment === 'OOS' ? 'oos-default' : 'is-last'))!.response.data
      },
      chart: async (_job: unknown, _report: unknown, segment: string) => {
        calls.chart++
        if (modes.chart === 'hold') await new Promise<void>((resolve, reject) => detailPending.push({ resolve, reject: () => reject(new Error('SYNTHETIC_CHART_DISPLAY_FAILURE')) }))
        if (modes.chart === 'fail') throw new Error('SYNTHETIC_CHART_DISPLAY_FAILURE')
        return { manifest: chart.manifest, window: chart.window,
          navigation: { supportedResolutions: ['1m'], availableRange: chart.window.requestedRange, previousFromInclusive: null, nextFromInclusive: null },
          view: { identity: `inline-display-${segment}`, market: 'BTC/USDT', resolutionSeconds: 60, pricePrecision: 3,
            sourceLabel: 'SYNTHETIC_CONTRACT_FIXTURE · 인라인 표시 검수', fills: [],
            bars: chart.window.bars.map(bar => ({ time: Date.parse(bar.openTime) / 1000, open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), volume: Number(bar.volume) })) },
        }
      },
      markers: async () => { calls.markers++; throw new Error('Summary navigation must not request markers') },
    }
    type View = { owner: string; jobId: string; input: string; previous: boolean; visible: boolean; editDisabled?: boolean }
    function Host() {
      const [composerRequest, requestComposer] = react.useState(undefined as object | undefined)
      const [view, setView] = react.useState({ owner: 'owner-a', jobId: report.binding.backtestId, input: '작성 중인 질문', previous: false, visible: true } as View)
      const job = react.useMemo(() => ({ backtestId: view.jobId, strategyVersionId: 'sv-inline-display', state: 'COMPLETED' }), [view.jobId])
      Object.assign(window, { changeInlineResult: (patch: Partial<View>) => setView((current: View) => ({ ...current, ...patch })) })
      return h(ClientServiceExperience, {
        accountScope: view.owner, composerRequest,
        state: { phase: 'ready', sessionState: 'AUTHENTICATED', messages: [{ id: 'user-1', role: 'user', text: '서버 전략의 결과를 확인해주세요.' }],
          input: view.input, inputDisabled: false, busy: false, source: 'service', recovery: null, quickReplies: [],
          workflow: null, outcome: h('p', { 'data-inline-job-status': true }, '백테스트 완료'), issue: null,
          onInput: (input: string) => setView((current: View) => ({ ...current, input })), onSend: async () => { calls.send++ }, onReset: () => {}, onRecover: undefined, onLogout: undefined },
        strategyDocument: { identity: `${view.owner}:conversation:draft`, content: h('p', null, '서버 전략 초안') },
        analysis: view.visible ? h(NativeServiceResult, { key: `${view.owner}:${view.jobId}`, api, job, embedded: true, previous: view.previous,
          onEditDraft: () => { setView((current: View) => ({ ...current, previous: true })); requestComposer({}) }, editDisabled: view.editDisabled }) : null,
      })
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('inline-result-root'))
    Object.assign(window, { inlineResultCalls: calls, inlineDetailModes: modes,
      settleInlineReport: (index: number, failure: boolean) => failure ? pending[index].reject() : pending[index].resolve(),
      settleInlineDetail: (index: number, failure: boolean) => failure ? detailPending[index].reject() : detailPending[index].resolve(),
      unmountInlineResult: () => root.unmount() })
    root.render(h(Host))
  }, fixtures)
  await expect.poll(() => calls(page)).toEqual({ report: 1, trades: 0, chart: 0, markers: 0, send: 0 })
  await expect(card(page)).toBeVisible()
  return { requests, errors }
}

for (const width of [320, 1440]) for (const surface of ['summary', 'report'] as const) test(`${width}px ${surface} 결과 조건 수정은 같은 대화·차트·미전송 문장을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  const { requests, errors } = await mount(page)
  await expect(page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true })).toHaveCount(0)
  await settle(page, 0)
  await expectMetrics(page)
  await composer(page).fill('직접 바꿀 조건을 작성 중입니다')
  await composer(page).evaluate(node => Reflect.set(window, 'editOriginalComposer', node))
  await page.locator('.cp-chart').evaluate(node => Reflect.set(window, 'editOriginalChart', node))
  if (surface === 'report') await page.locator('.g-chead [data-report-document-control]').click()
  const container = surface === 'report' ? page.getByTestId('native-report-document') : card(page)
  for (const locale of locales) {
    await language(page, locale)
    const action = container.locator('[data-native-edit-draft]')
    await expect(action).toBeVisible()
    expect(await action.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    if (locale === 'fr') await container.locator('.nir-actions, .nrd-actions').screenshot({ path: info.outputPath(`edit-action-${surface}-${width}-fr.png`) })
  }
  await language(page, 'ko')
  await container.locator('.nir-actions, .nrd-actions').screenshot({ path: info.outputPath(`edit-action-${surface}-${width}-ko.png`) })
  const reportTop = await page.locator('.g-scroll').evaluate(node => node.scrollTop)
  await container.getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await expect(page.locator('.g-tab').filter({ hasText: /^대화$/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(composer(page)).toBeFocused()
  const inputBox = await composer(page).boundingBox()
  expect(inputBox!.y).toBeGreaterThanOrEqual(0)
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(960)
  await expect(composer(page)).toHaveValue('직접 바꿀 조건을 작성 중입니다')
  await expect(card(page)).toHaveAttribute('data-previous', 'true')
  await expect(page.locator('[data-native-edit-draft]')).toHaveCount(0)
  expect(await composer(page).evaluate(node => node === Reflect.get(window, 'editOriginalComposer'))).toBe(true)
  expect(await page.locator('.cp-chart').evaluate(node => node === Reflect.get(window, 'editOriginalChart'))).toBe(true)
  expect(await calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  expect(requests).toEqual([]); expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath(`edit-${surface}-${width}.png`) })
  // Locale updates cannot reconsume a completed presentation command.
  await page.locator('.g-chead [data-report-document-control]').click()
  if (surface === 'report') await expect.poll(() => page.locator('.g-scroll').evaluate(node => node.scrollTop)).toBe(reportTop)
  await language(page, 'fr')
  await expect(page.locator('.g-chead [data-report-document-control]')).toHaveAttribute('aria-pressed', 'true')
  await expect(composer(page)).not.toBeFocused()
})

test('짧은 모바일 화면에서도 조건 수정 후 같은 입력창이 가려지지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await mount(page); await settle(page, 0)
  await card(page).getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await expect(composer(page)).toBeFocused()
  const rect = await composer(page).boundingBox()
  expect(rect!.y).toBeGreaterThanOrEqual(0)
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(568)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('조건 수정 버튼에서 누르고 있던 Enter는 복귀 후 미전송 문장을 자동 전송하지 않는다', async ({ page }) => {
  await mount(page)
  await settle(page, 0)
  const action = card(page).getByRole('button', { name: '조건을 직접 수정할게요', exact: true })
  await expect(action).toBeEnabled()
  await action.focus()
  await page.keyboard.down('Enter')
  await expect(composer(page)).toBeFocused()
  await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  expect((await calls(page)).send).toBe(0)
  await expect(composer(page)).toHaveValue('작성 중인 질문')
  await page.keyboard.press('Enter')
  expect((await calls(page)).send).toBe(1)
})

for (const surface of ['summary', 'report'] as const) test(`${surface} 조건 수정 요청 대기와 일반 실패 뒤 같은 버튼의 키보드 초점을 유지한다`, async ({ page }) => {
  await mount(page); await settle(page, 0)
  if (surface === 'report') await page.locator('.g-chead [data-report-document-control]').click()
  const container = surface === 'summary' ? card(page) : page.getByTestId('native-report-document')
  const action = container.locator('[data-native-edit-draft]')
  await expect(action).toBeEnabled()
  await action.focus()
  await change(page, { editDisabled: true })
  await expect(action).toBeDisabled()
  await expect(action).toBeFocused()
  await page.keyboard.press('Enter'); await page.keyboard.press('Space')
  await expect(card(page)).toHaveAttribute('data-previous', 'false')
  await change(page, { editDisabled: false })
  await expect(action).toBeEnabled()
  await expect(action).toBeFocused()
  expect((await calls(page)).send).toBe(0)
})

async function backToChat(page: Page) {
  const tab = page.locator('[data-analysis-tab="chat"]')
  if (await tab.isVisible()) await tab.click()
  else await composer(page).focus()
  await expect(card(page)).toBeVisible()
}

async function refreshReport(page: Page) {
  const tab = page.locator('[data-analysis-tab="analysis"]')
  if (await tab.isVisible()) await tab.click()
  const segments = page.locator('.ctt-main-tabs').getByRole('tab', { name: '실행 구간', exact: true })
  if (await segments.isVisible()) await segments.click()
  await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
}

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const rateFields = ['netReturnRate', 'maxDrawdownRate', 'winRate'] as const
async function expectMetrics(page: Page, locale: ClientLanguage = 'ko') {
  await expect(card(page)).toHaveAttribute('data-state', 'ready')
  await expect(card(page)).toHaveAttribute('data-native-evidence', 'SYNTHETIC_CONTRACT_FIXTURE')
  for (const segment of reportFixture.nativeEnvelope.projection.segments) {
    const section = card(page).locator(`[data-native-segment="${segment.segment}"]`)
    await expect(section).toHaveAttribute('aria-label', nativeInlineResultCopy[locale][segment.segment])
    for (const field of rateFields) await expect(section.locator(`[data-native-metric="${field}"]`)).toHaveText(
      formatResultRatePercent(segment.metrics[field], nativeResultText(locale, 'tinyNegative'))!,
    )
    await expect(section.locator('[data-native-metric="tradeCount"]')).toHaveText(String(segment.summary.tradeCount))
    await expect(section).toContainText(segment.evaluationStartInclusive)
    await expect(section).toContainText(segment.evaluationEndExclusive)
  }
  await expect(card(page).getByTestId('native-inline-evidence')).toHaveText(nativeResultText(locale, 'syntheticNotice'))
  await expect(card(page).getByTestId('native-inline-limitations')).toHaveText(nativeResultText(locale, 'limitationHeadline'))
  await expect(card(page)).not.toContainText(/TETH SCORE|80점|실행 기준 통과|추천 설정/)
}

for (const width of [320, 1440]) test(`${width}px 동일 대화 요약의 7언어·원값·기존 분석 왕복은 단일 조회와 초안을 유지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  const { requests, errors } = await mount(page)
  await expect(card(page)).toHaveAttribute('data-state', 'loading')
  await expect(card(page).locator('[data-native-metric], [data-native-raw]')).toHaveCount(0)
  await expect(card(page)).not.toHaveAttribute('data-native-evidence')
  await composer(page).fill('다음 결과 질문을 위한 미전송 초안')
  await composer(page).evaluate(element => Reflect.set(window, 'inlineOriginalComposer', element))
  await settle(page, 0)
  await expectMetrics(page)
  await expect(composer(page)).toBeFocused()
  await expect.poll(() => calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  await expect(page.locator('.native-service-result')).toHaveCount(1)
  await expect(page.locator('.cp-chart')).toHaveCount(1)
  await page.locator('.cp-chart canvas').first().evaluate(element => Reflect.set(window, 'inlineOriginalCanvas', element))
  const raw = card(page).getByTestId('native-inline-raw-rates')
  await raw.locator(':scope > summary').click()
  const originalRaw = reportFixture.nativeEnvelope.projection.segments.flatMap(segment => rateFields.map(field => segment.metrics[field]))
  for (const locale of locales) {
    await language(page, locale)
    await expectMetrics(page, locale)
    await expect(card(page).getByRole('heading', { level: 3 })).toHaveText(nativeInlineResultCopy[locale].title)
    await expect(raw).toHaveAttribute('open', '')
    await expect(raw.locator('[data-native-raw]')).toHaveText(originalRaw)
    const cta = card(page).getByRole('button', { name: nativeInlineResultCopy[locale].open, exact: true })
    await expect(cta).toBeVisible()
    for (const control of await card(page).locator('button, summary').all()) {
      expect(await control.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    }
    expect(await card(page).evaluate(element => {
      const box = element.getBoundingClientRect()
      return box.left >= -1 && box.right <= innerWidth + 1 && element.scrollWidth <= element.clientWidth + 1
    })).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    if (width === 320) {
      const menu = await page.locator('.client-hamburger').boundingBox()
      const tab = await page.locator('[data-analysis-tab="chat"]').boundingBox()
      expect(menu).not.toBeNull(); expect(tab).not.toBeNull()
      expect(tab!.x).toBeGreaterThanOrEqual(menu!.x + menu!.width)
    }
    expect(await card(page).locator('.nir-kpis').evaluateAll(grids => grids.every(grid => {
      const cells = [...grid.children].map(cell => ({ cell: cell.getBoundingClientRect(), value: cell.querySelector('dd')!.getBoundingClientRect() }))
      return cells.every((item, index) => cells.slice(index + 1).every(next => Math.abs(item.cell.top - next.cell.top) > 1 || Math.abs(item.value.bottom - next.value.bottom) <= 1))
    }))).toBe(true)
    expect(await calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  }
  await raw.locator(':scope > summary').click()
  await card(page).getByRole('heading', { level: 3 }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath(`native-inline-result-fr-${width}.png`), fullPage: false })
  await card(page).getByRole('button', { name: nativeInlineResultCopy.fr.open, exact: true }).click()
  await expect(page.locator('.native-analysis-result')).toBeFocused()
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  if (width === 320) await expect(page.locator('[data-analysis-tab="analysis"]')).toHaveAttribute('aria-selected', 'true')
  await backToChat(page)
  await expect(composer(page)).toHaveValue('다음 결과 질문을 위한 미전송 초안')
  expect(await composer(page).evaluate(element => element === Reflect.get(window, 'inlineOriginalComposer'))).toBe(true)
  expect(await page.locator('.cp-chart canvas').first().evaluate(element => element === Reflect.get(window, 'inlineOriginalCanvas'))).toBe(true)
  expect(await calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('재조회 대기는 이전 수치를 제거하고 거절 뒤에도 기존 오류·재시도로만 복구한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await settle(page, 0); await expectMetrics(page)
  await expect.poll(() => calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  await composer(page).fill('보고서 재조회 중에도 보존할 초안')
  await refreshReport(page)
  await backToChat(page)
  await composer(page).focus()
  await expect(card(page)).toHaveAttribute('data-state', 'loading')
  await expect(card(page).locator('[data-native-metric], [data-native-raw]')).toHaveCount(0)
  await expect(card(page)).not.toHaveAttribute('data-native-evidence')
  for (const locale of locales) {
    await language(page, locale)
    await expect(card(page).getByRole('status')).toHaveText(nativeResultText(locale, 'verifyingReport'))
  }
  await settle(page, 1, true)
  for (const locale of locales) {
    await language(page, locale)
    await expect(card(page)).toHaveAttribute('data-state', 'error')
    await expect(card(page).getByRole('alert')).toHaveText(nativeResultText(locale, 'reportFetchFailed'))
    await expect(card(page).locator('[data-native-metric], [data-native-raw]')).toHaveCount(0)
  }
  await expect(composer(page)).toBeFocused()
  await expect(composer(page)).toHaveValue('보고서 재조회 중에도 보존할 초안')
  expect(await calls(page)).toEqual({ report: 2, trades: 1, chart: 1, markers: 0, send: 0 })
  await language(page, 'ko')
  await card(page).getByRole('button', { name: '리포트와 차트 보기', exact: true }).click()
  await page.getByRole('button', { name: '보고서 다시 조회', exact: true }).click()
  await backToChat(page)
  await composer(page).focus()
  await settle(page, 2); await expectMetrics(page)
  await expect(composer(page)).toBeFocused()
  await expect.poll(() => calls(page)).toEqual({ report: 3, trades: 2, chart: 2, markers: 0, send: 0 })
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('job와 owner subtree 교체는 이전 수치·늦은 응답을 새 대화 요약에 섞지 않는다', async ({ page }) => {
  const { requests, errors } = await mount(page)
  await change(page, { jobId: 'backtest-inline-next' })
  await expect.poll(async () => (await calls(page)).report).toBe(2)
  await settle(page, 0)
  await expect(card(page)).toHaveAttribute('data-backtest-id', 'backtest-inline-next')
  await expect(card(page)).toHaveAttribute('data-state', 'loading')
  await expect(card(page).locator('[data-native-metric]')).toHaveCount(0)
  expect(await calls(page)).toEqual({ report: 2, trades: 0, chart: 0, markers: 0, send: 0 })
  await settle(page, 1); await expectMetrics(page)
  await expect.poll(async () => (await calls(page)).chart).toBe(1)
  await change(page, { owner: 'owner-b', jobId: 'backtest-owner-b' })
  await expect.poll(async () => (await calls(page)).report).toBe(3)
  await expect(card(page)).toHaveAttribute('data-state', 'loading')
  await expect(card(page).locator('[data-native-metric]')).toHaveCount(0)
  await change(page, { owner: 'owner-c', jobId: 'backtest-owner-c' })
  await expect.poll(async () => (await calls(page)).report).toBe(4)
  await settle(page, 2, true)
  await expect(card(page)).toHaveAttribute('data-backtest-id', 'backtest-owner-c')
  await expect(card(page)).toHaveAttribute('data-state', 'loading')
  await expect(card(page).getByRole('alert')).toHaveCount(0)
  await settle(page, 3); await expectMetrics(page)
  await expect(card(page)).toHaveCount(1)
  await expect.poll(() => calls(page)).toEqual({ report: 4, trades: 2, chart: 2, markers: 0, send: 0 })
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

test('이전 승인 결과 표시는 원 결과 식별자·서버 수치를 유지하며 재조회나 새 승인을 만들지 않는다', async ({ page }) => {
  const { requests, errors } = await mount(page)
  await settle(page, 0); await expectMetrics(page)
  await expect.poll(async () => (await calls(page)).chart).toBe(1)
  const before = await calls(page)
  await change(page, { previous: true })
  await expect(card(page)).toHaveAttribute('data-previous', 'true')
  await expect(card(page)).toHaveAttribute('data-backtest-id', reportFixture.binding.backtestId)
  await expect(card(page).locator('.nir-previous')).toContainText(nativeWorkflowText('ko', 'priorResult'))
  await expect(card(page).locator('.nir-previous code')).toHaveText('sv-inline-display')
  await expectMetrics(page)
  await language(page, 'fr')
  await expect(card(page).locator('.nir-previous')).toContainText(nativeWorkflowText('fr', 'priorResult'))
  await expectMetrics(page, 'fr')
  expect(await calls(page)).toEqual(before)
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

for (const failure of ['chart', 'trades'] as const) test(`보고서 확인 뒤 ${failure} 상세 조회 실패는 요약 수치를 유지하고 별도 상태로 알린다`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await page.evaluate(failure => {
    Reflect.get(window, 'inlineDetailModes')[failure] = failure === 'chart' ? 'hold' : 'fail'
  }, failure)
  await settle(page, 0)
  await expectMetrics(page)
  await expect.poll(() => calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  const detail = card(page).getByTestId('native-inline-detail-status')
  await expect(card(page).locator('[data-native-edit-draft]')).toBeEnabled()
  if (failure === 'chart') {
    await expect(detail).toHaveAttribute('role', 'status')
    await expect(detail).toHaveText(nativeInlineResultCopy.ko.detailLoading)
    await page.evaluate(() => Reflect.get(window, 'settleInlineDetail')(0, true))
  }
  for (const locale of locales) {
    await language(page, locale)
    await expect(detail).toHaveAttribute('role', 'alert')
    await expect(detail).toHaveText(nativeInlineResultCopy[locale].detailError)
    await expectMetrics(page, locale)
  }
  expect(await calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  expect(requests).toEqual([])
  expect(errors).toEqual([])
})

for (const width of [950, 1440]) test(`${width}px 차트가 숨겨진 지표 탭에서도 상세 조회 실패를 공지한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  const { requests, errors } = await mount(page)
  await page.evaluate(() => { Reflect.get(window, 'inlineDetailModes').chart = 'hold' })
  await settle(page, 0); await expectMetrics(page)
  await expect.poll(() => calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  await card(page).getByRole('button', { name: nativeInlineResultCopy.ko.open }).click()
  await page.locator('.ctt-main-tabs').getByRole('tab', { name: '검증 지표', exact: true }).click()
  await expect(page.locator('[data-terminal-panel="chart"]')).toHaveAttribute('inert', '')
  await page.evaluate(() => Reflect.get(window, 'settleInlineDetail')(0, true))
  const notice = page.getByTestId('native-result-detail-status')
  await expect(notice).toBeVisible()
  await expect(notice).toHaveAttribute('role', 'alert')
  await expect(notice).toHaveText(nativeInlineResultCopy.ko.detailError)
  await expect(page.locator('.ctt-main-tabs').getByRole('tab', { name: '검증 지표', exact: true })).toBeFocused()
  await page.screenshot({ path: info.outputPath(`native-detail-error-${width}.png`) })
  await backToChat(page); await expectMetrics(page)
  expect(await calls(page)).toEqual({ report: 1, trades: 1, chart: 1, markers: 0, send: 0 })
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('요약의 상태 알림은 원 결과 패널이 숨겨진 좁은 대화에서만 활성화된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 })
  const { requests, errors } = await mount(page)
  await expect(card(page).locator('[role="status"], [role="alert"]')).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 960 })
  await expect(card(page).getByRole('status')).toHaveText(nativeResultText('ko', 'verifyingReport'))
  await settle(page, 0, true)
  await expect(card(page).getByRole('alert')).toHaveText(nativeResultText('ko', 'reportFetchFailed'))
  await card(page).getByRole('button', { name: nativeInlineResultCopy.ko.open }).click()
  await expect(card(page).locator('[role="status"], [role="alert"]')).toHaveCount(0)
  await expect(page.locator('.native-service-result').getByRole('alert')).toBeVisible()
  await backToChat(page)
  await expect(card(page).getByRole('alert')).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 960 })
  await expect(card(page).locator('[role="status"], [role="alert"]')).toHaveCount(0)
  expect(await calls(page)).toEqual({ report: 1, trades: 0, chart: 0, markers: 0, send: 0 })
  expect(requests).toEqual([]); expect(errors).toEqual([])
})

test('결과 열기와 동시에 결과가 제거되면 이후 탭 선택의 포커스를 가로채지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 960 })
  const { requests, errors } = await mount(page)
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('.nir-open')!.click()
    Reflect.get(window, 'changeInlineResult')({ visible: false })
  })
  await expect(card(page)).toHaveCount(0)
  await change(page, { visible: true })
  await expect(card(page)).toBeVisible()
  const analysis = page.locator('[data-analysis-tab="analysis"]')
  await analysis.click()
  await expect(analysis).toBeFocused()
  await expect(page.locator('.native-analysis-result')).not.toBeFocused()
  expect(await calls(page)).toEqual({ report: 2, trades: 0, chart: 0, markers: 0, send: 0 })
  expect(requests).toEqual([]); expect(errors).toEqual([])
})
