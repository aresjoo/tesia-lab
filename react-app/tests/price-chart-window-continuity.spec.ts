import { expect, test, type Page } from '@playwright/test'
import { chartEma, type PriceChartView } from '../src/chart/price-chart-view'
import { chartWindowVwap, priceChartStudies, studyLineData } from '../src/chart/price-chart-studies'
import { professionalChartLocale } from '../src/client-professional-chart-locale'

// Pure display fixtures: these are not SDK-bound or actual backtest prices.
function windowView(index: number): PriceChartView {
  const resolutionSeconds = index === 1 ? 120 : 60
  const bars = Array.from({ length: 32 + index * 7 }, (_, i) => {
    const open = 1000 + index * 1000 + i * 3
    return { time: 1_700_000_000 + index * 20_000 + i * resolutionSeconds, open, high: open + 7, low: open - 4, close: open + (i % 3 ? 3 : -2), volume: 20 + index * 100 + i }
  })
  return {
    identity: `SYNTHETIC_WINDOW_${index}`, market: index === 1 ? 'ETH / USDT' : 'BTC / USDT',
    sourceLabel: `렌더러 검증용 합성 입력 ${index}`, resolutionSeconds, pricePrecision: index + 1, bars,
    fills: [
      { id: `buy-${index}`, tradeId: `trade-${index}`, time: bars[1].time + 2, price: bars[1].close, side: 'BUY' },
      { id: `sell-${index}`, tradeId: `trade-${index}`, time: bars.at(-1)!.time + 3, price: bars.at(-1)!.close, side: 'SELL' },
    ],
  }
}

async function mount(page: Page, view = windowView(0), continuityKey?: string, options: { autoReplay?: boolean; failInitial?: boolean; variant?: 'analysis' | 'market' } = {}) {
  // Read the actual Vite transform before browser evaluation instead of sending
  // a second proxy request during cold parallel boot. Only observation/fault
  // instrumentation changes; all source checks and renderer assertions remain.
  const response = await page.request.get('/src/components/ClientProfessionalPriceChart.tsx', { maxRetries: 0 })
  expect(response.ok()).toBe(true)
  let body = await response.text()
  expect(body).toContain('api.current = chart;')
  expect(body).toContain('const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: "top" });')
  body = body.replace('api.current = chart;', 'api.current = chart; window.__continuityProbe.register(chart);')
  body = body.replace('const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: "top" });', 'const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: "top" }); window.__continuityProbe.markers.push(markerPlugin);')
  expect(body).toContain('replayTimer = window.setInterval(tick, 100);')
  expect(body).toContain('clearInterval(replayTimer);')
  body = body.replace('replayTimer = window.setInterval(tick, 100);', 'replayTimer = window.setInterval(tick, 100); window.__continuityProbe.activeTimers.add(replayTimer);')
    .replaceAll('clearInterval(replayTimer);', 'window.__continuityProbe.activeTimers.delete(replayTimer); clearInterval(replayTimer);')
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', route => route.fulfill({ response, body }))
  await page.goto('/')
  await page.evaluate(async input => {
    const path = '/tests/fixtures/price-chart-continuity-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    Reflect.set(window, '__continuityHost', mount(input.view, input.continuityKey, input.options))
  }, { view, continuityKey, options })
  if (options.failInitial) await expect(page.locator('.cp-failure')).toBeVisible()
  else await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
}
async function replace(page: Page, view: PriceChartView, key?: string) {
  await page.evaluate(input => Reflect.get(window, '__continuityHost').render(input.view, input.key), { view, key })
  await expect(page.locator('.cp-source')).toHaveText(view.sourceLabel)
}
type SeriesRow = { time: number; open?: number; high?: number; low?: number; close?: number; value?: number }
type SeriesSnapshot = { title: string; paneTitle: string; color?: string; kind: string; visible: boolean; minMove: number; data: SeriesRow[]; submitted: SeriesRow[] }
const series = (page: Page): Promise<SeriesSnapshot[]> => page.evaluate(() => {
  const probe = Reflect.get(window, '__continuityProbe')
  return probe.charts.at(-1).panes().flatMap((pane: { getSeries(): { seriesType(): string; options(): { title: string; color?: string; visible: boolean; priceFormat: { minMove: number } }; data(): unknown[] }[] }) => pane.getSeries().map(item => ({ title: probe.seriesTitles.get(item), paneTitle: item.options().title, color: item.options().color, kind: item.seriesType(), visible: item.options().visible, minMove: item.options().priceFormat.minMove, data: item.data(), submitted: probe.setDataInputs.get(item) })))
})
const counts = (page: Page) => page.evaluate(() => { const probe = Reflect.get(window, '__continuityProbe'); return { created: probe.charts.length, removed: probe.removed } })
const markerRows = (page: Page) => page.evaluate(() => Reflect.get(window, '__continuityProbe').markers.at(-1).markers().map((row: { time: number; text: string }) => ({ time: row.time, text: row.text })))
const submittedRows = (rows: { time: number; value?: number }[]) => rows.map(({ time, value }) => value === undefined ? { time } : { time, value })

test('거래량 미제공 창은 0으로 표시하지 않고 동일 canvas에서 거래량 창으로 왕복한다', async ({ page }) => {
  const original = windowView(0), missing = { ...windowView(1), bars: windowView(1).bars.map(b => ({ ...b, volume: null })) }
  await mount(page, original, 'volume-preservation', { variant: 'market' })
  await page.getByRole('button', { name: 'VWAP', exact: true }).click()
  const start = await counts(page)
  await replace(page, missing)
  await expect(page.getByRole('button', { name: 'VWAP', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '거래량', exact: true })).toBeDisabled()
  await expect(page.locator('.cp-quote dd').last()).toHaveText('—')
  let rows = await series(page)
  expect(rows.filter(r => r.kind === 'Histogram')).toHaveLength(0)
  expect(rows.find(r => r.title === 'VWAP')?.visible).toBe(false)
  await replace(page, original)
  await expect(page.getByRole('button', { name: '거래량', exact: true })).toBeEnabled()
  rows = await series(page)
  expect(rows.filter(r => r.kind === 'Histogram')).toHaveLength(1)
  expect(rows.find(r => r.title === 'VWAP')?.visible).toBe(true)
  expect(await counts(page)).toEqual(start)
})

test('시장 variant는 자동·명령 재생을 모두 차단하고 기존 재생에서 전환해도 타이머를 남기지 않는다', async ({ page }) => {
  await mount(page, windowView(0), 'market-lifetime', { autoReplay: true, variant: 'market' })
  await expect(page.locator('.cp-playback,.cp-replay')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, '__continuityHost').play())).toBe(false)
  expect(await page.evaluate(() => Reflect.get(window, '__continuityProbe').activeTimers.size)).toBe(0)
  const before = await page.evaluate(() => Reflect.get(window, '__continuityHost').replayEvents.length)
  await page.evaluate(() => Reflect.get(window, '__continuityHost').skip())
  expect(await page.evaluate(() => Reflect.get(window, '__continuityHost').replayEvents.length)).toBe(before)
  await page.evaluate(() => Reflect.get(window, '__continuityHost').variant('analysis'))
  await expect(page.locator('.cp-replay')).toBeVisible()
  expect(await page.evaluate(() => Reflect.get(window, '__continuityProbe').activeTimers.size)).toBe(1)
  await page.evaluate(() => Reflect.get(window, '__continuityHost').variant('market'))
  await expect(page.locator('.cp-playback,.cp-replay')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, '__continuityProbe').activeTimers.size)).toBe(0)
  expect(await page.evaluate(() => Reflect.get(window, '__continuityHost').play())).toBe(false)
  await expectIndicatorButtons(page, ['거래량'])
})
// LWC data() excludes whitespace rows. Check those separately at the real
// setData boundary instead of expecting them to survive the library accessor.
const numericRows = (rows: { time: number; value?: number }[]) => rows.filter(row => row.value !== undefined).map(({ time, value }) => ({ time, value }))
const pluginCount = (page: Page) => page.evaluate(() => Reflect.get(window, '__continuityProbe').markers.length)

async function expectQuote(page: Page, view: PriceChartView, index = view.bars.length - 1, language: Parameters<typeof professionalChartLocale>[0] = 'ko') {
  const format = professionalChartLocale(language), bar = view.bars[index]
  await expect(page.locator('.cp-quote dd')).toHaveText([format.utc(bar.time), ...(['open', 'high', 'low', 'close', 'volume'] as const).map(key => format.price(bar[key]))])
}
async function expectIndicatorButtons(page: Page, active: string[]) {
  for (const name of ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14', '거래량']) {
    const button = page.getByRole('button', { name, exact: true })
    await expect(button).toHaveAttribute('aria-pressed', String(active.includes(name)))
    await expect(button).toBeEnabled()
  }
}

async function allIndicators(page: Page) {
  for (const label of ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14']) await page.getByRole('button', { name: label, exact: true }).click()
}
async function expectWindowData(page: Page, view: PriceChartView) {
  await expect.poll(async () => (await series(page)).find(row => row.kind === 'Candlestick')!.data.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }))).toEqual(view.bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })))
  const actual = await series(page)
  expect(numericRows(actual.find(row => row.kind === 'Histogram')!.data)).toEqual(view.bars.map(bar => ({ time: bar.time, value: bar.volume })))
  const studies = priceChartStudies(view.bars, view.resolutionSeconds)
  const expected = new Map([
    ['EMA 20', chartEma(view.bars, 20)], ['EMA 50', chartEma(view.bars, 50)],
    ['BB 20·2 +', studyLineData(studies.upper)], ['BB 20·2 −', studyLineData(studies.lower)],
    ['VWAP', studyLineData(chartWindowVwap(view.bars, view.resolutionSeconds), view.resolutionSeconds)], ['RSI 14', studyLineData(studies.rsi)],
  ])
  for (const [title, data] of expected) {
    const row = actual.find(item => item.title === title)!
    expect(row.visible, title).toBe(true)
    expect(numericRows(row.data), title).toEqual(numericRows(data))
    expect(submittedRows(row.submitted), `${title} setData including whitespace`).toEqual(submittedRows(data))
  }
  for (const row of actual.filter(row => row.kind === 'Candlestick' || row.kind === 'Line' && row.title !== 'RSI 14')) expect(row.minMove).toBe(10 ** -view.pricePrecision)
  expect(await markerRows(page)).toEqual(view.fills.length ? [{ time: view.bars[1].time, text: 'BUY' }, { time: view.bars.at(-1)!.time, text: 'SELL' }] : [])
  await expectQuote(page, view)
}

test('명시한 같은 continuity key의 세 가격창은 실제 chart/canvas를 유지하고 모든 시리즈·체결·출처를 교체한다', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, windowView(0), 'owner-a')
  await allIndicators(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const chart = await page.evaluateHandle(() => Reflect.get(window, '__continuityProbe').charts.at(-1))
  await expectWindowData(page, windowView(0))
  for (const index of [1, 2]) {
    await page.locator('.cp-surface').press('Home')
    await page.locator('.cp-surface').press('ArrowRight')
    await expect(page.locator('.cp-fills')).toContainText(`trade-${index - 1}`)
    await replace(page, windowView(index))
    await expectWindowData(page, windowView(index))
    expect(await chart.evaluate(value => value === Reflect.get(window, '__continuityProbe').charts.at(-1))).toBe(true)
    expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
    await expect(page.locator('.cp-fills')).toHaveCount(0)
    await expect(page.locator('.cp-sr-only')).toBeEmpty()
    await expect(page.locator('.cp-chart-heading strong')).toHaveText(windowView(index).market)
  }
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)
  expect(errors).toEqual([])
  await page.screenshot({ path: testInfo.outputPath('same-canvas-third-window.png'), fullPage: true })
})

test('빈 가격창도 명시적 continuity 범위에서는 같은 canvas를 비우고 유효 창으로 회복한다', async ({ page }) => {
  await mount(page, windowView(0), 'owner-a')
  await allIndicators(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const empty = { ...windowView(1), bars: [], fills: [] }
  await replace(page, empty)
  await expect(page.getByText('표시할 가격 데이터가 없습니다.', { exact: true })).toBeVisible()
  await expect.poll(async () => (await series(page)).map(row => row.data.length)).toEqual(Array(11).fill(0))
  expect(await markerRows(page)).toEqual([])
  await expectIndicatorButtons(page, ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14', '거래량'])
  await expect(page.locator('.cp-quote dd')).toHaveCount(6)
  for (const quote of await page.locator('.cp-quote dd').allTextContents()) expect(quote.trim()).toMatch(/^[–—−-]$/)
  await expect(page.getByRole('button', { name: '체결 순서 재생', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '차트 이미지 저장', exact: true })).toBeDisabled()
  await page.locator('.cp-surface').press('Home')
  await page.locator('.cp-surface').press('End')
  await expect(page.locator('.cp-fills')).toHaveCount(0)
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  await replace(page, windowView(2))
  await expectWindowData(page, windowView(2))
  await expectIndicatorButtons(page, ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14', '거래량'])
  await expect(page.getByText('표시할 가격 데이터가 없습니다.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '체결 순서 재생', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: '차트 이미지 저장', exact: true })).toBeEnabled()
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)
})

test('처음부터 빈창인 continuity renderer는 일부 지표 상태를 유지하며 가격창과 빈창을 왕복한다', async ({ page }) => {
  const empty = { ...windowView(0), bars: [], fills: [] }
  await mount(page, empty, 'owner-a')
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: 'EMA 50', exact: true }).click()
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await expectIndicatorButtons(page, ['EMA 50', 'RSI 14', '거래량'])
  for (const view of [windowView(1), { ...windowView(1), bars: [], fills: [] }, windowView(2)]) {
    await replace(page, view)
    await expectIndicatorButtons(page, ['EMA 50', 'RSI 14', '거래량'])
    const actual = await series(page)
    expect(actual.filter(row => row.visible).map(row => row.title)).toEqual(['', 'EMA 50', 'RSI 14', ''])
    if (!view.bars.length) {
      expect(actual.every(row => row.data.length === 0 && row.submitted.length === 0)).toBe(true)
      await expect(page.getByRole('button', { name: '체결 순서 재생', exact: true })).toBeDisabled()
    } else {
      expect(actual.find(row => row.kind === 'Candlestick')!.data).toHaveLength(view.bars.length)
      // Hidden study data must also be replaced, not retain another window.
      for (const row of actual.filter(row => !row.visible)) expect(row.submitted.map(point => point.time)).toEqual(view.bars.map(bar => bar.time))
      await expectQuote(page, view)
      await expect(page.getByRole('button', { name: '체결 순서 재생', exact: true })).toBeEnabled()
    }
    expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  }
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)
})

test('가격이 있는 무체결 창으로 교체하면 옛 marker와 선택을 지우고 plugin을 중복 등록하지 않는다', async ({ page }) => {
  await mount(page, windowView(0), 'owner-a')
  await allIndicators(page)
  await page.locator('.cp-surface').press('Home')
  await page.locator('.cp-surface').press('ArrowRight')
  await expect(page.locator('.cp-fills')).toContainText('trade-0')
  const next = { ...windowView(1), fills: [] }
  await replace(page, next)
  await expectWindowData(page, next)
  await expect(page.locator('.cp-fills')).toHaveCount(0)
  await page.locator('.cp-surface').press('Home')
  await page.locator('.cp-surface').press('ArrowRight')
  await expect(page.locator('.cp-fills')).toHaveCount(0)
  await replace(page, windowView(2))
  await expectWindowData(page, windowView(2))
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)
})

test('continuity owner 변경은 이전 실제 chart를 폐기하고 새 canvas를 만든다', async ({ page }) => {
  await mount(page, windowView(0), 'owner-a')
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  // Isolate key ownership: the complete supplied view is otherwise unchanged.
  await replace(page, windowView(0), 'owner-b')
  await expect.poll(() => counts(page)).toEqual({ created: 2, removed: [0] })
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(false)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
})

test('continuity 미제공 기본 동작은 identity 교체 시 재마운트하고 빈 입력을 기존대로 거절한다', async ({ page }) => {
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await replace(page, windowView(1))
  await expect.poll(() => counts(page)).toEqual({ created: 2, removed: [0] })
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(false)
  await page.evaluate(view => Reflect.get(window, '__continuityHost').render(view), { ...windowView(2), bars: [], fills: [] })
  await expect(page.locator('.cp-empty')).toContainText('표시할 가격 데이터가 없습니다.')
  await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
  expect(await counts(page)).toEqual({ created: 2, removed: [0, 1] })
})

test('언어와 동등 입력 재할당은 같은 chart·지표·조회 범위를 유지한다', async ({ page }) => {
  const view = windowView(0)
  await mount(page, view, 'owner-a')
  await allIndicators(page)
  const before = await series(page)
  await page.evaluate(() => Reflect.get(window, '__continuityProbe').charts.at(-1).timeScale().setVisibleLogicalRange({ from: 3, to: 20 }))
  for (const language of ['en', 'ja', 'ko']) {
    await page.evaluate(language => Reflect.get(window, '__continuityHost').language(language), language)
    await replace(page, structuredClone(view))
    expect(await series(page)).toEqual(before)
    const range = await page.evaluate(() => Reflect.get(window, '__continuityProbe').charts.at(-1).timeScale().getVisibleLogicalRange())
    expect(range.from).toBeCloseTo(3, 6)
    expect(range.to).toBeCloseTo(20, 6)
    for (const name of ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14']) await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)
})

test('좁은 surface는 중복 study pane title만 숨기고 원문 버튼·수치·series·색·줌을 유지하며 넓어지면 복구한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const view = windowView(2)
  await mount(page, view, 'owner-a')
  await allIndicators(page)
  await page.locator('.cp-surface').press('End')
  await expectWindowData(page, view)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const baseline = (await series(page)).map(row => ({ ...row, paneTitle: undefined }))
  const studies = priceChartStudies(view.bars, view.resolutionSeconds)
  const format = professionalChartLocale('ko')
  const expectedReadouts = [
    format.axisPrice(view.pricePrecision)(chartWindowVwap(view.bars, view.resolutionSeconds).at(-1)!.value!),
    format.axisPrice(1)(studies.rsi.at(-1)!.value!),
    `${format.axisPrice(view.pricePrecision)(studies.lower.at(-1)!.value!)} / ${format.axisPrice(view.pricePrecision)(studies.upper.at(-1)!.value!)}`,
  ]
  await page.evaluate(() => Reflect.get(window, '__continuityProbe').charts.at(-1).timeScale().setVisibleLogicalRange({ from: 3, to: 20 }))
  for (const scenario of [{ width: 390 }, { width: 320 }, { width: 1440, surfaceWidth: 480 }, { width: 1440, surfaceWidth: 481 }, { width: 1440 }]) {
    await page.setViewportSize({ width: scenario.width, height: 900 })
    await page.locator('.cp-surface').evaluate((node, width) => { (node as HTMLElement).style.width = width === undefined ? '' : `${width}px` }, scenario.surfaceWidth)
    const surfaceWidth = await page.locator('.cp-surface').evaluate(node => node.clientWidth)
    const narrow = surfaceWidth <= 480
    if (scenario.surfaceWidth !== undefined) expect(surfaceWidth).toBe(scenario.surfaceWidth)
    else expect(narrow).toBe(scenario.width <= 390)
    await expect.poll(async () => (await series(page)).filter(row => row.kind === 'Line' && row.title !== 'RSI 14').map(row => row.paneTitle)).toEqual(narrow ? Array(8).fill('') : ['MA 7', 'MA 25', 'MA 99', 'EMA 20', 'EMA 50', 'BB 20·2 +', 'BB 20·2 −', 'VWAP'])
    const actual = await series(page)
    expect(actual.map(row => ({ ...row, paneTitle: undefined }))).toEqual(baseline)
    expect(actual.find(row => row.title === 'RSI 14')!.paneTitle).toBe('RSI 14')
    const paneLabels = await page.evaluate(() => Reflect.get(window, '__continuityProbe').charts.at(-1).panes().map((pane: { getSeries(): { options(): { title: string } }[] }) => pane.getSeries().map(item => item.options().title)))
    expect(paneLabels).toHaveLength(3)
    expect(paneLabels[1]).toEqual(['RSI 14'])
    expect(paneLabels[2]).toEqual([''])
    await expectIndicatorButtons(page, ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14', '거래량'])
    await expect(page.locator('.cp-studies dt')).toHaveText(['VWAP', 'RSI 14', 'BB 20·2'])
    await expect(page.locator('.cp-studies dd')).toHaveText(expectedReadouts)
    const range = await page.evaluate(() => Reflect.get(window, '__continuityProbe').charts.at(-1).timeScale().getVisibleLogicalRange())
    expect(range.from).toBeCloseTo(3, 6)
    expect(range.to).toBeCloseTo(20, 6)
    expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`study-labels-${scenario.width}-${scenario.surfaceWidth ?? 'auto'}.png`), fullPage: true })
  }
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)
})

test('교체 전 대기 pointer는 새 가격창의 quote나 선택을 덮지 않는다', async ({ page }) => {
  const installedAt = new Date('2026-09-19T00:00:00Z')
  await page.clock.install({ time: installedAt })
  await mount(page, windowView(0), 'owner-a')
  await page.clock.pauseAt(new Date(installedAt.getTime() + 60_000))
  await page.evaluate(() => Reflect.get(window, '__continuityHost').pointer(3))
  await page.clock.runFor(100)
  await expectQuote(page, windowView(0), 3)
  const next = windowView(1)
  await page.evaluate(view => Reflect.get(window, '__continuityHost').queuePointerThenReplace(view), next)
  await page.clock.runFor(100)
  await expect(page.locator('.cp-source')).toHaveText(next.sourceLabel)
  await expectQuote(page, next)
  await expect(page.locator('.cp-fills')).toHaveCount(0)
  await expect(page.locator('.cp-sr-only')).toBeEmpty()
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)
})

async function expectFailedRendererIsInert(page: Page, view: PriceChartView, language: 'ko' | 'en' = 'ko') {
  const format = professionalChartLocale(language)
  await expect(page.getByRole('alert')).toContainText(format.t('failure'))
  await expect(page.getByRole('button', { name: format.t('retry'), exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: format.t('fit'), exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: format.t('save'), exact: true })).toBeDisabled()
  await expect(page.locator('.cp-controls button')).not.toHaveCount(0)
  for (const button of await page.locator('.cp-controls button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  await expect(page.locator('.cp-fills')).toHaveCount(0)
  await expect(page.locator('.cp-sr-only')).toBeEmpty()
  await expectQuote(page, view, view.bars.length - 1, language)
  // Failure retires the broken runtime, rather than merely trusting a probe's
  // remove bookkeeping. No stale plot canvas may remain behind the alert.
  await expect(page.locator('.cp-failure')).toBeVisible()
  await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
  // A removed chart is never queried through an invalid library API.
  const liveData = await page.evaluate(() => {
    const probe = Reflect.get(window, '__continuityProbe')
    return probe.charts.flatMap((chart: { panes(): { getSeries(): { data(): unknown[] }[] }[] }, index: number) => probe.removed.includes(index) ? [] : chart.panes().flatMap(pane => pane.getSeries().map(item => item.data().length)))
  })
  expect(liveData.every((length: number) => length === 0)).toBe(true)
  const liveMarkers = await page.evaluate(() => {
    const probe = Reflect.get(window, '__continuityProbe')
    return probe.removed.includes(probe.charts.length - 1) ? [] : probe.markers.at(-1).markers()
  })
  expect(liveMarkers).toEqual([])
  expect(await page.evaluate(() => Reflect.get(window, '__continuityHost').play())).toBe(false)
  await page.evaluate(id => Reflect.get(window, '__continuityHost').selectFill(id), view.fills[0].id)
  await page.locator('.cp-surface').press('Home')
  await expect(page.locator('.cp-fills')).toHaveCount(0)
  await expect(page.locator('.cp-sr-only')).toBeEmpty()
  await expectQuote(page, view, view.bars.length - 1, language)
}

test('가격창 교체 commit의 부모 layout 관찰에서 새 출처와 옛 candle이 섞이지 않는다', async ({ page }) => {
  await mount(page, windowView(0), 'owner-a')
  const empty = { ...windowView(2), identity: 'SYNTHETIC_EMPTY_WINDOW', bars: [], fills: [] }
  for (const view of [windowView(1), empty, windowView(2)]) {
    await replace(page, view)
    const commit = await page.evaluate(() => Reflect.get(window, '__continuityHost').layoutCommits.at(-1))
    expect(commit.identity).toBe(view.identity)
    expect(commit.source).toBe(view.sourceLabel)
    expect(commit.times).toEqual(view.bars.map(bar => bar.time))
    if (view.bars.length) {
      const format = professionalChartLocale('ko'), bar = view.bars.at(-1)!
      expect(commit.quotes).toEqual([format.utc(bar.time), ...(['open', 'high', 'low', 'close', 'volume'] as const).map(key => format.price(bar[key]))])
    } else expect(commit.quotes).toEqual(Array(6).fill('—'))
  }
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
})

for (const failInitial of [true, false]) {
  test(`자동재생 ${failInitial ? '최초 생성 실패' : '시작 후 창교체 실패'}의 명시 재시도는 일회 시작 의도만 보존한다`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.clock.install()
    await mount(page, windowView(0), 'owner-a', { autoReplay: true, failInitial })
    const starts = () => page.evaluate(() => Reflect.get(window, '__continuityHost').replayEvents.filter((event: { playing: boolean }) => event.playing).length)
    const timers = () => page.evaluate(() => Reflect.get(window, '__continuityProbe').activeTimers.size)
    if (!failInitial) {
      await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
      await expect.poll(starts).toBe(1)
      await expect.poll(timers).toBe(1)
      const next = windowView(1)
      await page.evaluate(view => {
        const host = Reflect.get(window, '__continuityHost')
        host.failNextWindow(view.bars[0].time)
        host.render(view)
      }, next)
    }
    await expect(page.locator('.cp-failure')).toBeVisible()
    await expect.poll(timers).toBe(0)
    await expect.poll(starts).toBe(failInitial ? 0 : 1)
    await page.getByRole('button', { name: '차트 다시 표시', exact: true }).click()
    await expect(page.locator('.cp-failure')).toHaveCount(0)
    await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
    await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', String(failInitial))
    await expect.poll(starts).toBe(1)
    await expect.poll(timers).toBe(failInitial ? 1 : 0)
    if (failInitial) await page.locator('.cp-playback').click()
    await expect.poll(timers).toBe(0)
    await page.evaluate(() => Reflect.get(window, '__continuityHost').language('en'))
    await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
    expect(await starts()).toBe(1)
    await page.evaluate(() => Reflect.get(window, '__continuityHost').unmount())
    expect(await timers()).toBe(0)
  })
}

for (const clearToo of [false, true]) {
  test(`동일 canvas 다음창 setData 실패${clearToo ? ' 및 정리 실패' : ''}는 오류로 닫고 현재 입력만 명시적으로 재시도한다`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await mount(page, windowView(0), 'owner-a')
    await allIndicators(page)
    const oldCanvases = await page.locator('.cp-surface canvas').elementHandles()
    expect(oldCanvases.length).toBeGreaterThan(0)
    await page.locator('.cp-surface').press('Home')
    await page.locator('.cp-surface').press('ArrowRight')
    await expect(page.locator('.cp-fills')).toContainText('trade-0')
    const failedView = windowView(1)
    await page.evaluate(input => Reflect.get(window, '__continuityHost').failNextWindow(input.time, input.clearToo), { time: failedView.bars[0].time, clearToo })
    await page.evaluate(view => Reflect.get(window, '__continuityHost').render(view), failedView)
    await expectFailedRendererIsInert(page, failedView)
    for (const canvas of oldCanvases) expect(await canvas.evaluate(node => node.isConnected)).toBe(false)
    expect(await page.evaluate(() => Reflect.get(window, '__continuityProbe').injectedFailures)).toEqual(clearToo ? ['window-setData', 'cleanup-setData'] : ['window-setData'])

    // Locale changes must not revive a broken runtime or a previous selection.
    await page.evaluate(() => Reflect.get(window, '__continuityHost').language('en'))
    await expectFailedRendererIsInert(page, failedView, 'en')
    const newest = windowView(2)
    await replace(page, newest)
    await expectFailedRendererIsInert(page, newest, 'en')
    await page.evaluate(() => Reflect.get(window, '__continuityHost').language('ko'))
    await page.getByRole('button', { name: '차트 다시 표시', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
    await expectWindowData(page, newest)
    await expectIndicatorButtons(page, ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14', '거래량'])
    await expect(page.getByRole('button', { name: '체결 순서 재생', exact: true })).toBeEnabled()
    expect(await counts(page)).toEqual({ created: 2, removed: [0] })
    expect(errors).toEqual([])
  })
}

test('단일창 설명 재생 중 가격창 교체는 옛 timer와 체결 안내를 폐기하고 자동으로 재시작하지 않는다', async ({ page }) => {
  // This tests retiring the existing single-window clock, not whole-period playback.
  const installedAt = new Date('2026-09-19T00:00:00Z')
  await page.clock.install({ time: installedAt })
  await mount(page, windowView(0), 'owner-a')
  await allIndicators(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.clock.pauseAt(new Date(installedAt.getTime() + 60_000))
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.runFor(5_000)
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await expect(page.locator('.cp-sr-only')).toContainText('조회된 체결')
  const next = windowView(1)
  await replace(page, next)
  await expectWindowData(page, next)
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  await expect(page.locator('.cp-sr-only')).toBeEmpty()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  const events = await page.evaluate(() => Reflect.get(window, '__continuityHost').replayEvents)
  expect(events.at(-1)).toEqual({ playing: false, reason: 'skip' })
  const data = await series(page)
  await page.clock.runFor(120_000)
  expect(await series(page)).toEqual(data)
  expect(await page.evaluate(() => Reflect.get(window, '__continuityHost').replayEvents)).toEqual(events)
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  await expect(page.locator('.cp-sr-only')).toBeEmpty()
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  expect(await counts(page)).toEqual({ created: 1, removed: [] })
  expect(await pluginCount(page)).toBe(1)

  // A later explicit action still uses the replacement window's own executions.
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.runFor(4_000)
  await expect(page.locator('.cp-execution span')).toHaveText(professionalChartLocale('ko').price(next.fills[0].price))
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expectWindowData(page, next)
})

for (const failure of ['ohlc', 'fills', 'source', 'empty-fills', 'empty-source'] as const) {
  test(`continuity의 빈창 허용이 ${failure} 검증을 우회하지 않는다`, async ({ page }) => {
    await mount(page, windowView(0), 'owner-a')
    const invalid = windowView(1)
    if (failure === 'ohlc') invalid.bars = invalid.bars.map((bar, index) => index ? bar : { ...bar, high: bar.low - 1 })
    if (failure.endsWith('fills')) invalid.fills = [invalid.fills[0], invalid.fills[0]]
    if (failure.endsWith('source')) invalid.sourceLabel = ''
    if (failure.startsWith('empty-')) invalid.bars = []
    await page.evaluate(view => Reflect.get(window, '__continuityHost').render(view), invalid)
    await expect(page.locator('.cp-empty')).toContainText(failure === 'ohlc' ? '가격 데이터의 순서와 범위를 확인할 수 없습니다.' : failure.endsWith('fills') ? '체결 데이터를 확인할 수 없습니다.' : '데이터 출처를 확인할 수 없습니다.')
    await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
    expect(await counts(page)).toEqual({ created: 1, removed: [0] })
  })
}
