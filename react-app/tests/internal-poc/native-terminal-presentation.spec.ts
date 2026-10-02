import { expect, test, type Page } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow, NativeReport, NativeTrades } from '../../src/internal-poc/native-service-api'
import { nativeResultText } from '../../src/internal-poc/native-result-copy'
import { clientTerminalText } from '../../src/client-terminal-copy'

// Display composition only. Generated binding/HTTP acceptance is covered by
// native-service-api/chart-window/fill-marker suites; this is not a live run.
async function mount(page: Page, analysis = false) {
  await page.route('**/native-terminal-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="terminal-test-root"></div></body></html>' }))
  await page.goto('/native-terminal-test.html')
  await page.evaluate(async ({ data, analysis }) => {
    const refresh = '/@react-refresh', rp = '/@id/react', dp = '/@id/react-dom/client', cp = '/src/internal-poc/NativeServiceResult.tsx'
    const runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const react = await import(/* @vite-ignore */ rp), dom = await import(/* @vite-ignore */ dp)
    const { NativeServiceResult } = await import(/* @vite-ignore */ cp)
    // Match the real entrypoint's fonts and client token context for visual QA.
    const skin = '/src/internal-poc/ClientServiceExperience.tsx'
    await import(/* @vite-ignore */ skin)
    const report = (data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    const chart = data.sources[0].fixture as unknown as { manifest: NativeChartManifest; window: NativeChartWindow }
    const trades = (data.sources[2].fixture as unknown as { pages: { name: string; response: { data: NativeTrades } }[] }).pages
    const calls = { report: 0, trades: 0, chart: 0 }
    Object.assign(window, { terminalCalls: calls })
    const api = {
      report: async () => {
        calls.report++
        if (calls.report > 1 && Reflect.get(window, 'delayTerminalReport')) return new Promise((resolve, reject) => {
          Object.assign(window, { resolveTerminalReport: () => resolve(report), rejectTerminalReport: () => reject(new Error('DISPLAY_REVALIDATION_FAILURE')) })
        })
        return report
      },
      trades: async (_report: unknown, segment: string) => { calls.trades++; return trades.find(p => p.name === (segment === 'OOS' ? 'oos-default' : 'is-last'))!.response.data },
      chart: async (_job: unknown, _report: unknown, segment: string) => {
        calls.chart++
        return { manifest: chart.manifest, window: chart.window,
          navigation: { supportedResolutions: ['1m'], availableRange: chart.window.requestedRange, previousFromInclusive: null, nextFromInclusive: null },
          view: { identity: `display-only-terminal-${segment}`, market: 'BTC/USDT', resolutionSeconds: 60, pricePrecision: 3,
            sourceLabel: 'SYNTHETIC_CONTRACT_FIXTURE · 레이아웃 검수', fills: [],
            bars: chart.window.bars.map(bar => ({ time: Date.parse(bar.openTime) / 1000, open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), volume: Number(bar.volume) })) },
        }
      },
    }
    // Use the same optimized React instance as the Vite-compiled components.
    const source = await (await fetch(cp)).text()
    const reactImport = source.match(/from "([^"\n]*\/react\.js\?[^"\n]*)"/)?.[1]
    if (analysis && !reactImport) throw new Error('ANALYSIS_DISPLAY_TEST_REACT_IMPORT_MISSING')
    const React = analysis ? (await import(/* @vite-ignore */ reactImport!)).default : react.default ?? react, h = React.createElement
    const job = { backtestId: report.binding.backtestId }
    let element = h(NativeServiceResult, { api, job })
    if (analysis) {
      const layoutPath = '/src/internal-poc/NativeAnalysisLayout.tsx', chatPath = '/src/components/ClientConversation.tsx'
      const { NativeAnalysisLayout } = await import(/* @vite-ignore */ layoutPath)
      const { ClientConversation } = await import(/* @vite-ignore */ chatPath)
      document.getElementById('terminal-test-root')!.style.height = '100dvh'
      document.body.style.margin = '0'
      function Harness() {
        const [value, setValue] = React.useState(''), [answer, setAnswer] = React.useState(''), [visible, setVisible] = React.useState(true)
        Object.assign(window, { removeAnalysis: () => setVisible(false), restoreAnalysis: () => setVisible(true), finishAnalysisTurn: () => setAnswer('응답 완료') })
        return h(NativeAnalysisLayout, { analysis: visible ? h(NativeServiceResult, { api, job, embedded: true }) : null },
          h(ClientConversation, { value, onChange: setValue, onSend: () => { setValue(''); setAnswer('요청 진행 중') }, onStop: () => {},
            busy: false, inputLabel: '분석 대화 입력', sendLabel: '분석 메시지 전송', initialTitle: '전략 분석', artifact: h('p', null, '원본 문서 영역'), showResearchTeam: false }, h('p', { 'data-analysis-answer': true }, answer)))
      }
      element = h(Harness)
    }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('terminal-test-root')).render(element)
  }, { data: fixtures, analysis })
  if (analysis) {
    await expect(page.locator('.cp-chart canvas').first()).toBeAttached()
    await page.evaluate(() => document.fonts.ready)
    return
  }
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test('분석 분할: 언어 변경 시 모바일 탭의 접근성 이름도 함께 바뀐다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await mount(page, true)
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'en')
  })
  await expect(page.locator('.native-analysis-tabs [data-analysis-tab="chat"]')).toHaveText('Chat')
  await expect(page.locator('.native-analysis-tabs')).not.toHaveAttribute('aria-label', '대화와 결과 보기')
})

const analysisLocales = [
  { code: 'ko', chat: '대화', analysis: '차트·분석', region: '차트와 분석', view: '대화와 결과 보기' },
  { code: 'en', chat: 'Chat', analysis: 'Chart & analysis', region: 'Chart and analysis', view: 'Chat and result view' },
  { code: 'ja', chat: '会話', analysis: 'チャート・分析', region: 'チャートと分析', view: '会話と結果の表示' },
  { code: 'zh-CN', chat: '对话', analysis: '图表与分析', region: '图表与分析', view: '对话与结果视图' },
  { code: 'zh-TW', chat: '對話', analysis: '圖表與分析', region: '圖表與分析', view: '對話與結果檢視' },
  { code: 'es', chat: 'Conversación', analysis: 'Gráfico y análisis', region: 'Gráfico y análisis', view: 'Vista de conversación y resultados' },
  { code: 'fr', chat: 'Conversation', analysis: 'Graphique et analyse', region: 'Graphique et analyse', view: 'Affichage de la conversation et des résultats' },
] as const

for (const mode of ['prevented', 'ime229']) test(`분석 탭 ${mode}: 이미 처리한 키와 IME229 입력을 다시 처리하지 않는다`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, true)
  const tab = page.locator('[data-analysis-tab="chat"]')
  await tab.focus()
  if (mode === 'prevented') await tab.evaluate(element => {
      element.addEventListener('keydown', event => event.preventDefault(), { once: true })
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    })
  else await tab.dispatchEvent('keydown', { key: 'ArrowRight', keyCode: 229 })
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  await expect(tab).toBeFocused()
  for (const flags of [{ keyCode: 229 }, { isComposing: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
    await tab.dispatchEvent('keydown', { key: 'ArrowRight', ...flags })
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(tab).toBeFocused()
  }
  await tab.press('ArrowRight')
  await expect(page.locator('[data-analysis-tab="analysis"]')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual({ report: 1, trades: 1, chart: 1 })
})

for (const width of [390, 1440]) test(`인라인 결과 ${width}px 재조회는 진행 안내로 초점을 이어주고 완료 뒤 복구한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await mount(page, true)
  if (width < 940) await page.locator('[data-analysis-tab="analysis"]').click()
  const segments = page.locator('.ctt-main-tabs').getByRole('tab', { name: '실행 구간', exact: true })
  if (await segments.isVisible()) await segments.click()
  await page.evaluate(() => Reflect.set(window, 'delayTerminalReport', true))
  const reload = page.getByRole('button', { name: '결과 상세 다시 조회', exact: true })
  await reload.focus()
  await reload.press('Enter')
  const loading = page.getByText('서버 보고서와 무결성 확인 중', { exact: true }).locator('..')
  await expect(loading).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'resolveTerminalReport')())
  await expect(page.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeFocused()
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual({ report: 2, trades: 2, chart: 2 })
})

test('인라인 결과 재조회 중 대화로 이동한 초점을 늦은 응답이 빼앗지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, true)
  await page.locator('[data-analysis-tab="analysis"]').click()
  await page.locator('.ctt-main-tabs').getByRole('tab', { name: '실행 구간', exact: true }).click()
  await page.evaluate(() => Reflect.set(window, 'delayTerminalReport', true))
  await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  await page.locator('[data-analysis-tab="chat"]').click()
  const input = page.getByRole('textbox', { name: '분석 대화 입력', exact: true })
  await input.fill('조회 중에도 대화 초안 유지')
  await page.evaluate(() => Reflect.get(window, 'resolveTerminalReport')())
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('조회 중에도 대화 초안 유지')
  await expect(page.locator('[data-analysis-tab="chat"]')).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'terminalCalls').chart)).toBe(2)
})

test('인라인 결과 조회 실패 뒤 재시도는 초점을 유지하며 대화 초안도 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page, true)
  const input = page.getByRole('textbox', { name: '분석 대화 입력', exact: true })
  await input.fill('다음 질문 초안')
  const segments = page.locator('.ctt-main-tabs').getByRole('tab', { name: '실행 구간', exact: true })
  if (await segments.isVisible()) await segments.click()
  await page.evaluate(() => Reflect.set(window, 'delayTerminalReport', true))
  await page.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  const loading = page.getByText('서버 보고서와 무결성 확인 중', { exact: true }).locator('..')
  await expect(loading).toBeFocused()
  await page.evaluate(() => Reflect.get(window, 'rejectTerminalReport')())
  const retry = page.getByRole('button', { name: '보고서 다시 조회', exact: true })
  await retry.focus()
  await retry.press('Enter')
  await expect(loading).toBeFocused()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'terminalCalls').report)).toBe(3)
  await page.evaluate(() => Reflect.get(window, 'resolveTerminalReport')())
  await expect(page.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeFocused()
  await expect(input).toHaveValue('다음 질문 초안')
})

test('분석 분할의 확대 후 래퍼 초점은 다음 Tab에서 대화 내부로 이어진다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, true)
  await page.locator('[data-analysis-tab="chat"]').focus()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('.native-analysis-conversation')).toBeFocused()
  await page.keyboard.press('Tab')
  expect(await page.locator('.native-analysis-conversation').evaluate(element => element.contains(document.activeElement))).toBe(true)
})

test('결과 도구의 언어 변경은 제목과 터미널 닫기 접근성 이름에도 반영된다', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'en')
  })
  await expect(page.locator('.native-service-result > h2')).not.toHaveText('백테스트 결과')
  await expect(page.locator('.ctt-header > button')).not.toHaveAttribute('aria-label', '터미널 닫기')
})

for (const width of [320, 1440]) test(`결과 전체 ${width}px: 7언어 전환은 열린 상세·서버 원값·터미널과 조회 횟수를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  await mount(page)
  for (const selector of ['.ctt-notice details summary', '.native-metric-raw summary', '.ctt-rail details summary']) await page.locator(selector).click()
  const cells = page.locator('.ctt-notice dd, .ctt-rail dd, .native-metric-scroll td, .ctt-bottom-pane td:not(.native-trade-times)')
  // The first trade cell also contains localized controls. Only its marked
  // entry reference is server data; those labels must follow the UI language.
  const rawValues = await cells.evaluateAll(nodes => nodes.map(node => node.querySelector('[data-native-entry-fill]')?.textContent ?? node.textContent ?? ''))
  const headers = await page.locator('.ctt-terminal th').elementHandles()
  const details = await page.locator('.ctt-terminal details').elementHandles()
  const canvas = page.locator('.cp-chart canvas').first(), originalCanvas = await canvas.elementHandle()
  const calls = await page.evaluate(() => Reflect.get(window, 'terminalCalls'))
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  const dialog = page.locator('.ctt-modal'), originalDialog = await dialog.elementHandle()
  const close = page.locator('.ctt-header > button')
  for (const item of analysisLocales) {
    await page.evaluate(async code => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', code)
    }, item.code)
    await expect(page.locator('html')).toHaveAttribute('lang', item.code)
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAccessibleName(nativeResultText(item.code, 'terminalTitle'))
    await expect(close).toBeFocused()
    await expect(close).toHaveAccessibleName(clientTerminalText(item.code, 'closeTerminal'))
    const sourceReport = (fixtures.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    await expect(page.locator('.native-metric-scroll').first().locator('tbody > tr').first().locator('td')).toHaveText(sourceReport.nativeEnvelope.projection.segments.map(segment =>
      nativeResultText(item.code, 'periodRange', { from: segment.evaluationStartInclusive, to: segment.evaluationEndExclusive })))
    const nativeButtons = page.locator('.native-chart-toolbar div > button, .ctt-rail div[aria-label] button, .ctt-bottom-pane div[aria-label] button, .ctt-chart section[aria-label] > button')
    for (const button of await nativeButtons.all()) {
      await expect(button).toHaveCSS('border-radius', '6px')
      await expect(button).toHaveCSS('min-height', '44px')
    }
    if (width <= 960) for (const tab of await page.locator('.ctt-main-tabs [role="tab"]').all()) {
      const bounds = await tab.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
      expect(await tab.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    }
    if (item.code !== 'ko') {
      await expect(page.locator('.native-service-result > h2')).not.toContainText(/[가-힣]/)
      await expect(close).not.toHaveAttribute('aria-label', /[가-힣]/)
      await expect(page.locator('.ctt-main-tabs')).not.toHaveAttribute('aria-label', /[가-힣]/)
      for (const label of await page.locator('.ctt-terminal th').allTextContents()) expect(label).not.toMatch(/[가-힣]/)
    }
    // UTC endpoint hints are presentation, not the original server values.
    const currentValues = await cells.evaluateAll(nodes => nodes.map(node => node.querySelector('[data-native-entry-fill]')?.textContent ?? node.textContent ?? ''))
    const dates = (value: string) => value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g)
    expect(currentValues.map(value => dates(value)?.length === 2 ? dates(value) : value)).toEqual(rawValues.map(value => dates(value)?.length === 2 ? dates(value) : value))
    const sameHeaders = await page.locator('.ctt-terminal th').evaluateAll((nodes, originals) => nodes.every((node, index) => node === originals[index]), headers)
    expect(sameHeaders).toBe(true)
    for (const node of details) expect(await node.evaluate(element => element instanceof HTMLDetailsElement && element.isConnected && element.open)).toBe(true)
    expect(await canvas.evaluate((node, original) => node === original, originalCanvas)).toBe(true)
    expect(await dialog.evaluate((node, original) => node === original, originalDialog)).toBe(true)
    expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual(calls)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath(`native-result-locale-fr-${width}.png`) })
  await close.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('.native-service-result > button').nth(1)).toBeFocused()
  expect(await canvas.evaluate((node, original) => node === original, originalCanvas)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual(calls)
  for (const node of [...headers, ...details, originalCanvas, originalDialog]) await node?.dispose()
})

for (const width of [320, 939, 940, 1440]) test(`분석 분할 ${width}px: 7언어 탭·영역 이름과 차트·초안·키보드 연속성을 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 })
  await mount(page, true)
  const narrow = width < 940
  const root = page.locator('.native-analysis-layout')
  // This display harness has no outer sidebar/padding. Verify the actual
  // container boundary, rather than silently assuming viewport = container.
  await expect.poll(() => root.evaluate(node => node.clientWidth)).toBe(width)
  await expect(root).toHaveAttribute('data-narrow', String(narrow))
  // The same editor is intentionally hidden while the result pane is active.
  const input = page.getByRole('textbox', { name: '분석 대화 입력', includeHidden: true })
  await input.fill('차트를 보며 이어가는 미전송 원문')
  await input.evaluate(node => node.setSelectionRange(2, 5))
  const originalInput = await input.elementHandle()
  const canvas = page.locator('.cp-chart canvas').first(), originalCanvas = await canvas.elementHandle()
  const tabs = page.locator('.native-analysis-tabs'), analysisTab = tabs.locator('[data-analysis-tab="analysis"]')
  if (narrow) await analysisTab.click()
  const calls = await page.evaluate(() => Reflect.get(window, 'terminalCalls'))
  for (const item of analysisLocales) {
    // Keep the actual dynamic import and setter task in the page. Returning a
    // pending promise through CDP can lose its protocol lifetime during GC.
    await page.evaluate(language => {
      const path = '/src/client-preferences.ts'
      const state: { settled: boolean; error?: unknown } = { settled: false }
      const task = import(/* @vite-ignore */ path).then(({ setClientPreference }) => {
        setClientPreference('language', language)
      }).catch(error => { state.error = error }).finally(() => { state.settled = true })
      Reflect.set(window, 'nativeTerminalLocaleChange', { state, task })
    }, item.code)
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'nativeTerminalLocaleChange').state.settled)).toBe(true)
    await page.evaluate(() => {
      const { state } = Reflect.get(window, 'nativeTerminalLocaleChange')
      Reflect.deleteProperty(window, 'nativeTerminalLocaleChange')
      if ('error' in state) throw state.error
    })
    if (narrow) {
      await expect(tabs).toHaveAccessibleName(item.view)
      await expect(analysisTab).toHaveAccessibleName(item.analysis)
      await expect(analysisTab).toHaveAttribute('aria-selected', 'true')
      await expect(analysisTab).toBeFocused()
      await expect(page.locator('.native-analysis-result')).toHaveAccessibleName(item.analysis)
      await expect(page.locator('.native-analysis-result')).not.toHaveAttribute('aria-label')
      for (const tab of await tabs.getByRole('tab').all()) {
        expect(await tab.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
        const box = await tab.boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      }
      await analysisTab.press('Home')
      await expect(tabs.getByRole('tab', { name: item.chat, exact: true })).toBeFocused()
      await expect(page.locator('.native-analysis-conversation')).toHaveAccessibleName(item.chat)
      await expect(input).toBeVisible()
      await page.keyboard.press('End')
      await expect(analysisTab).toBeFocused()
    } else {
      await expect(tabs).toHaveCount(0)
      await expect(page.locator('.native-analysis-result')).toHaveAccessibleName(item.region)
      await expect(input).toBeFocused()
    }
    await expect(canvas).toBeVisible()
    await expect(input).toHaveValue('차트를 보며 이어가는 미전송 원문')
    expect(await input.evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([2, 5])
    expect(await input.evaluate((node, old) => node === old, originalInput)).toBe(true)
    expect(await canvas.evaluate((node, old) => node === old, originalCanvas)).toBe(true)
    expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual(calls)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath(`analysis-locale-fr-${width}.png`) })
  if (narrow) {
    await analysisTab.press('Home')
    await page.screenshot({ path: info.outputPath(`analysis-chat-locale-fr-${width}.png`) })
  }
  const copyShape = await page.evaluate(async () => {
    const path = '/src/internal-poc/native-analysis-copy.ts', sharedPath = '/src/client-conversation-copy.ts'
    const { nativeAnalysisCopy } = await import(/* @vite-ignore */ path)
    const { conversationCopy } = await import(/* @vite-ignore */ sharedPath)
    return {
      sameChat: nativeAnalysisCopy.chat === conversationCopy.chat,
      columns: Object.values(nativeAnalysisCopy).map(value => (value as string[]).length),
      valid: Object.values(nativeAnalysisCopy).every(value => (value as string[]).every((text, index) => text.trim().length > 0 && (index === 0 || !/[가-힣]/.test(text)))),
    }
  })
  expect(copyShape).toEqual({ sameChat: true, columns: [7, 7, 7, 7], valid: true })
  await originalInput?.dispose(); await originalCanvas?.dispose()
})

test('분석 분할: 왼쪽 결과·오른쪽 원본 대화와 입력창은 940–1440px에서 겹치지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page, true)
  for (const width of [1440, 1100, 940]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.native-analysis-layout')).toHaveAttribute('data-narrow', 'false')
    const a = await page.locator('.native-analysis-result').boundingBox(), c = await page.locator('.native-analysis-conversation').boundingBox()
    expect(a!.x + a!.width).toBeLessThanOrEqual(c!.x + 1)
    await expect(page.getByRole('textbox', { name: '분석 대화 입력' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath(`analysis-split-${width}.png`) })
  }
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual({ report: 1, trades: 1, chart: 1 })
})

test('분석 분할: 좁은 화면 탭 왕복에도 대화·입력·차트 DOM과 데이터 요청은 유지된다', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, true)
  const input = page.getByRole('textbox', { name: '분석 대화 입력' })
  await input.fill('차트를 보면서 이어 쓸 초안')
  await page.locator('.cp-chart canvas').first().evaluate(node => Reflect.set(window, 'analysisCanvas', node))
  const tabs = page.getByRole('tablist', { name: '대화와 결과 보기' })
  await tabs.getByRole('tab', { name: '대화', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: '차트·분석', exact: true })).toBeFocused()
  await expect(page.locator('.cp-chart canvas').first()).toBeVisible()
  // At first reveal, the chart should already match the explicit fit action.
  // Compare only the plot canvas (not cursor/focus chrome or text).
  const plot = page.locator('.cp-surface canvas').first()
  await expect.poll(async () => (await plot.boundingBox())?.width ?? 0).toBeGreaterThan(100)
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const fitted = await plot.screenshot()
  await page.getByRole('button', { name: '차트 전체 맞춤', exact: true }).click()
  await expect.poll(async () => (await plot.screenshot()).equals(fitted)).toBe(true)
  await tabs.getByRole('tab', { name: '차트·분석', exact: true }).focus()
  await page.screenshot({ path: info.outputPath('analysis-mobile-chart.png') })
  await page.keyboard.press('Home')
  await expect(input).toHaveValue('차트를 보면서 이어 쓸 초안')
  await input.press('Enter')
  await expect(page.locator('[data-analysis-answer]')).toHaveText('요청 진행 중')
  await tabs.getByRole('tab', { name: '차트·분석', exact: true }).click()
  await page.evaluate(() => Reflect.get(window, 'finishAnalysisTurn')())
  await tabs.getByRole('tab', { name: '대화', exact: true }).click()
  await expect(page.locator('[data-analysis-answer]')).toHaveText('응답 완료')
  expect(await page.evaluate(() => Reflect.get(window, 'analysisCanvas') === document.querySelector('.cp-chart canvas'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual({ report: 1, trades: 1, chart: 1 })
  await expect(page.locator('.g-composer textarea')).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('analysis-mobile-chat.png') })
})

test('분석 분할: 화면 크기 변경과 결과 제거에도 초점을 보이는 내용으로 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mount(page, true)
  const tab = page.getByRole('tab', { name: '차트·분석', exact: true })
  await tab.click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('.native-analysis-result')).toBeFocused()
  await page.setViewportSize({ width: 320, height: 568 })
  await expect(page.locator('.native-analysis-result')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.evaluate(() => Reflect.get(window, 'removeAnalysis')())
  await expect(page.locator('.g-title')).toBeFocused()
  await expect(page.locator('.g-composer textarea')).toBeVisible()
  await expect(page.locator('.cp-chart')).toHaveCount(0)
  const input = page.getByRole('textbox', { name: '분석 대화 입력' })
  await input.fill('결과가 다시 도착해도 이어 쓰기')
  await page.evaluate(() => Reflect.get(window, 'restoreAnalysis')())
  await expect(input).toBeVisible()
  await expect(input).toBeFocused()
  await expect(input).toHaveValue('결과가 다시 도착해도 이어 쓰기')
  await expect(page.getByRole('tab', { name: '대화', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('백테스트 터미널 열기·닫기는 차트 DOM과 조회 횟수를 그대로 보존한다', async ({ page }) => {
  await mount(page)
  await page.locator('.cp-chart canvas').first().evaluate(canvas => Reflect.set(window, 'terminalCanvas', canvas))
  const calls = await page.evaluate(() => Reflect.get(window, 'terminalCalls'))
  const open = page.getByRole('button', { name: '터미널에서 보기', exact: true })
  await open.click()
  const dialog = page.getByRole('dialog', { name: '백테스트 터미널', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/MMR 미검증/)).toBeVisible()
  await expect(dialog.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.querySelector('.cp-chart canvas') === Reflect.get(window, 'terminalCanvas'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual(calls)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '백테스트 터미널' })).toHaveCount(0)
  await expect(open).toBeFocused()
  expect(await page.evaluate(() => document.querySelector('.cp-chart canvas') === Reflect.get(window, 'terminalCanvas'))).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual(calls)
})

test('터미널에서도 기존 IS/OOS 전환만 데이터 조회를 바꾸고 실시간 주문을 합성하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '백테스트 터미널', exact: true })
  await dialog.getByRole('button', { name: 'IS', exact: true }).click()
  await expect(dialog.getByRole('heading', { name: 'IS 가격 차트', exact: true })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'IS 거래 내역', exact: true })).toBeVisible()
  await expect(dialog.getByText(/계정 전체 전략이나 실시간 포지션 목록이 아닙니다/)).toBeVisible()
  await expect(dialog.getByRole('textbox')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual({ report: 1, trades: 2, chart: 2 })
})

test('320·390·844·1440px 결과 터미널에서 페이지 가로 넘침과 차트 복제가 없다', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page)
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  for (const [width, height] of [[320,568],[390,844],[844,390],[1440,1000]]) {
    await page.setViewportSize({ width, height })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await expect(page.locator('.cp-chart')).toHaveCount(1)
    await page.screenshot({ path: info.outputPath(`native-terminal-${width}.png`) })
  }
  expect(await page.evaluate(() => Reflect.get(window, 'terminalCalls'))).toEqual({ report: 1, trades: 1, chart: 1 })
})

test('열린 터미널에서 재조회 지연·실패·재시도에도 화면과 키보드 초점을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await mount(page)
  await page.evaluate(() => Reflect.set(window, 'delayTerminalReport', true))
  await page.getByRole('button', { name: '터미널에서 보기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '백테스트 터미널', exact: true })
  await dialog.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  await expect(dialog.getByText('서버 보고서와 무결성 확인 중', { exact: true })).toBeVisible()
  const loading = dialog.getByText('서버 보고서와 무결성 확인 중', { exact: true }).locator('..')
  await expect(loading).toBeFocused()
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await expect(dialog.locator('.cp-chart')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'rejectTerminalReport')())
  await expect(dialog.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: '보고서 다시 조회', exact: true }).locator('../..')).toBeFocused()
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await dialog.getByRole('button', { name: '보고서 다시 조회', exact: true }).click()
  await expect(loading).toBeFocused()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'terminalCalls').report)).toBe(3)
  await page.evaluate(() => Reflect.get(window, 'resolveTerminalReport')())
  await expect(dialog.locator('.cp-chart canvas').first()).toBeVisible()
  await expect(dialog.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeFocused()
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true)
  // A later successful read must not take focus from a control the user chose.
  await dialog.getByRole('button', { name: '결과 상세 다시 조회', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'terminalCalls').report)).toBe(4)
  const close = dialog.getByRole('button', { name: '터미널 닫기', exact: true })
  await close.focus()
  await page.evaluate(() => Reflect.get(window, 'resolveTerminalReport')())
  await expect(dialog.locator('.cp-chart canvas').first()).toBeVisible()
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '터미널에서 보기', exact: true })).toBeFocused()
})
