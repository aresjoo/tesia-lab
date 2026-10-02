import { installCompiledModuleResponse } from './fixtures/compiled-module-response'
import { expect, test, type Page } from '@playwright/test'
import type { PriceChartView } from '../src/chart/price-chart-view'
import type { ProfessionalExternalReplay } from '../src/chart/price-replay-frame'
import { professionalChartLocale } from '../src/client-professional-chart-locale'
import { chartWindowVwap, priceChartStudies } from '../src/chart/price-chart-studies'
import { createNativePeriodReplayClock, type NativePeriodReplayState } from '../src/internal-poc/native-period-replay-clock'
import { harness as periodHarness, base as periodBase, flush as flushPeriod } from './internal-poc/helpers/native-period-replay-harness'

// Explicit display frames, not a producer, paging implementation or real results.
const start = 1_700_000_000
function view(index = 0): PriceChartView {
  const bars = Array.from({ length: 30 }, (_, i) => ({ time: start + index * 6000 + i * 60,
    open: 100 + index * 200 + i, close: 102 + index * 200 + i,
    high: 105 + index * 200 + i, low: 99 + index * 200 + i, volume: i + 1 }))
  return { identity: `external-window-${index}`, sourceLabel: `시계 포트 합성 창 ${index}`, market: 'BTC / USDT', resolutionSeconds: 60, pricePrecision: 2, bars,
    fills: [{ id: `first-${index}`, tradeId: `trade-${index}`, time: bars[1].time + 2, price: bars[1].close, side: 'BUY' },
      { id: `second-${index}`, tradeId: `trade-${index}`, time: bars[1].time + 30, price: bars[1].close + 1, side: 'BUY' }] }
}
function frame(data: PriceChartView, time: number, progress = .2, fillId: string | null = null, state: ProfessionalExternalReplay['frame']['state'] = 'playing'): ProfessionalExternalReplay {
  return { attemptId: 'attempt-a', frame: { attemptId: 'attempt-a', viewIdentity: data.identity, time, progress, fillId, state } }
}
async function mount(page: Page, data = view(), externalReplay = frame(data, start - 1), autoReplay = true, strict = false) {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await installCompiledModuleResponse(page, "/src/components/ClientProfessionalPriceChart.tsx", original => {
    let body = original;
    expect(body).toContain('api.current = chart;')
    body = body.replace('api.current = chart;', 'api.current = chart; window.__continuityProbe.register(chart);')
    expect(body).toContain('const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: "top" });')
    body = body.replace('const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: "top" });', 'const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: "top" }); window.__continuityProbe.markers.push(markerPlugin);')
    body = body.replace('replayTimer = window.setInterval(tick, 100);', 'replayTimer = window.setInterval(tick, 100); window.__continuityProbe.activeTimers.add(replayTimer);')
      .replaceAll('clearInterval(replayTimer);', 'window.__continuityProbe.activeTimers.delete(replayTimer); clearInterval(replayTimer);')
    return body
    }, ["api.current = chart;","const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: \"top\" });",{"text":"clearInterval(replayTimer);","all":true},"replayTimer = window.setInterval(tick, 100);"])
  await page.goto('/')
  await page.evaluate(async input => {
    const path = '/tests/fixtures/price-chart-continuity-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    Reflect.set(window, '__continuityHost', mount(input.data, 'owner-series-lifetime', { externalReplay: input.externalReplay, autoReplay: input.autoReplay, strict: input.strict }))
  }, { data, externalReplay, autoReplay, strict })
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
}
async function apply(page: Page, data: PriceChartView, externalReplay?: ProfessionalExternalReplay) {
  await page.evaluate(input => Reflect.get(window, '__continuityHost').frame(input.data, input.externalReplay), { data, externalReplay })
}
const snapshot = (page: Page) => page.evaluate(() => {
  const probe = Reflect.get(window, '__continuityProbe'), host = Reflect.get(window, '__continuityHost')
  return { charts: probe.charts.length, removed: probe.removed, timers: probe.activeTimers.size, events: host.replayEvents,
    rows: probe.charts.at(-1).panes().flatMap((pane: { getSeries(): { seriesType(): string; data(): unknown[] }[] }) => pane.getSeries().map(item => ({ kind: item.seriesType(), data: item.data() }))),
    markers: probe.markers.at(-1).markers(), commits: host.layoutCommits }
})

test('MA는 외부 재생 시계·새 가격창·Skip에 맞춰 준비구간과 수치를 같은 canvas에서 갱신한다', async ({ page }) => {
  const data = view()
  await mount(page, data)
  await apply(page, data)
  for (const period of [7,25,99]) await page.getByRole('button', { name: `MA ${period}`, exact: true }).click()
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const makeFrame = (next: PriceChartView, index: number) => {
    const f = frame(next, next.bars[index].time, .4)
    return { attemptId: 'attempt-ma', frame: { ...f.frame, attemptId: 'attempt-ma' } }
  }
  await apply(page, data, makeFrame(data, 10))
  await expect(page.locator('[data-study=ma7]')).toHaveText('109.00')
  await expect(page.locator('[data-study=ma25]')).toHaveText('계산값 없음')
  const points = () => page.evaluate(() => {
    const p = Reflect.get(window, '__continuityProbe')
    return p.charts.at(-1).panes()[0].getSeries().filter((s: object) => /^MA /.test(p.seriesTitles.get(s))).map((s: {data(): unknown[]}) => ({ name: p.seriesTitles.get(s), data: s.data() }))
  })
  expect((await points()).map((s: {data: unknown[]}) => s.data.length)).toEqual([5,0,0])
  const next = view(1)
  await apply(page, next, makeFrame(next, 2))
  for (const period of [7,25,99]) await expect(page.locator(`[data-study=ma${period}]`)).toHaveText('계산값 없음')
  expect((await points()).every((s: {data: unknown[]}) => !s.data.length)).toBe(true)
  await apply(page, next, makeFrame(next, 24))
  await expect(page.locator('[data-study=ma7]')).toHaveText('323.00')
  await expect(page.locator('[data-study=ma25]')).toHaveText('314.00')
  await apply(page, next)
  await expect(page.locator('[data-study=ma7]')).toHaveText('328.00')
  await expect(page.locator('[data-study=ma25]')).toHaveText('319.00')
  expect((await snapshot(page)).timers).toBe(0)
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
})

test('차트 단축키 안내는 재생·대기·실패 중 숨기고 탐색 복구 시 현재 언어로 되돌린다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, start, .1))
  const surface = page.locator('.cp-surface')
  const canvas = await surface.locator('canvas').first().elementHandle()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
    await page.evaluate(value => Reflect.get(window, '__continuityHost').language(value), language)
    await expect(surface).toHaveAccessibleName(professionalChartLocale(language).t('chart'))
    await surface.press('Home')
    await expect(page.locator('.cp-replay')).toBeVisible()
  }
  await apply(page, data, frame(data, start, .1, null, 'waiting'))
  await expect(surface).toHaveAccessibleName(professionalChartLocale('fr').t('chart'))
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  await apply(page, data)
  await expect(surface).toHaveAccessibleName(professionalChartLocale('fr').t('keyboard'))
  await surface.press('Home')
  await expect(page.locator('.cp-sr-only')).not.toHaveText('')
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextWindow(time), view(1).bars[0].time)
  await apply(page, view(1))
  await expect(page.locator('.cp-failure')).toBeVisible()
  await expect(surface).toHaveAccessibleName(professionalChartLocale('fr').t('chart'))
  await page.locator('.cp-failure button').click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(surface).toHaveAccessibleName(professionalChartLocale('fr').t('keyboard'))
})

test('가격창 controller와 전체시계의 원자 paint가 실제 canvas를 유지하며 두 창의 BUY SELL을 순서대로 표시한다', async ({ page }) => {
  const h = periodHarness(2000)
  const buy = { id: 'whole-entry', tradeId: 'whole-trade', time: periodBase + 10, price: 102, side: 'BUY' as const, sourceOrdinal: 0 }
  const sell = { id: 'whole-exit', tradeId: 'whole-trade', time: periodBase + 60_000, price: 108, side: 'SELL' as const, sourceOrdinal: 1 }
  const input = { ...h.empty, next: buy, markers: [buy, sell] }
  h.controller.start(); await flushPeriod()
  let state = h.controller.step(0, input)
  await mount(page, state.paint!.view, state.paint!.replay!)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  state = h.controller.step(100, input)
  await apply(page, state.paint!.view, state.paint!.replay!)
  expect((await snapshot(page)).markers.map((marker: { text: string }) => marker.text)).toEqual(['BUY'])
  const next = { ...input, next: sell }
  state = h.controller.step(699, next)
  expect(state.paint!.replay!.frame.fillId).toBe(buy.id)
  h.controller.step(700, next)
  state = h.controller.step(31_000, next)
  await apply(page, state.paint!.view, state.paint!.replay!)
  expect(state.clock.waitingFor).toBe('price')
  state = h.controller.step(31_001, next)
  await apply(page, state.paint!.view, state.paint!.replay!)
  state = h.controller.step(31_006, next)
  await apply(page, state.paint!.view, state.paint!.replay!)
  expect(state.paint!.replay!.frame.fillId).toBe(sell.id)
  expect((await snapshot(page)).markers.map((marker: { text: string }) => marker.text)).toEqual(['SELL'])
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  expect((await snapshot(page)).timers).toBe(0)
  const finishedLane = { ...h.empty, markers: [buy, sell] }
  h.controller.step(31_606, finishedLane)
  state = h.controller.step(61_606, finishedLane)
  await apply(page, state.paint!.view, state.paint!.replay!)
  expect(state.status).toBe('complete')
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: false, reason: 'complete' }])
  h.controller.dispose()
})

test('전체기간 clock의 체결dwell·EOF대기를 실제renderer에 공급해 같은canvas와 내부timer0을 유지한다', async ({ page }) => {
  const data = view(), end = data.bars.at(-1)!.time + 60, owner = new AbortController()
  const clock = createNativePeriodReplayClock({ attemptId: 'attempt-a', from: start, to: end, ownerSignal: owner.signal, isCurrent: () => true })
  const visual = (value: NativePeriodReplayState) => frame(data, value.time, value.progress, value.execution?.id ?? null,
    value.phase === 'complete' ? 'complete' : value.phase === 'waiting' ? 'waiting' : 'playing')
  const frontier = { priceThrough: end, fillsThrough: end, priceEof: true, fillsEof: true }
  clock.start(0)
  await mount(page, data, visual(clock.getState()))
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const first = { id: data.fills[0].id, time: data.fills[0].time, sourceOrdinal: 5 }
  const second = { id: data.fills[1].id, time: data.fills[1].time, sourceOrdinal: 6 }
  await apply(page, data, visual(clock.tick(2300, { ...frontier, execution: first })))
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  expect((await snapshot(page)).markers).toHaveLength(1)
  await apply(page, data, visual(clock.tick(2899, { ...frontier, execution: second })))
  expect(clock.getState().execution?.id).toBe(first.id)
  expect((await snapshot(page)).markers).toHaveLength(1)
  clock.tick(2900, { ...frontier, execution: second })
  await apply(page, data, visual(clock.tick(4000, { ...frontier, execution: second })))
  expect(clock.getState().execution?.id).toBe(second.id)
  expect((await snapshot(page)).markers[0].text).toBe('BUY ×2')
  await apply(page, data, visual(clock.tick(4599, frontier)))
  expect(clock.getState().phase).toBe('dwell')
  clock.tick(4600, frontier)
  await apply(page, data, visual(clock.tick(70000, { ...frontier, fillsEof: false })))
  expect(clock.getState().phase).toBe('waiting')
  await expect(page.locator('.cp-replay')).toBeVisible()
  await apply(page, data, visual(clock.tick(71000, frontier)))
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: false, reason: 'complete' }])
  expect((await snapshot(page)).timers).toBe(0)
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  clock.dispose()
})

test('외부 시계는 내부 타이머 없이 같은 canvas의 세 창·빈창·DOM을 함께 전개한다', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-playback')).toHaveCount(0)
  for (const button of await page.locator('.cp-controls button').all()) await expect(button).toBeDisabled()
  await expect(page.locator('.cp-toolbar button').last()).toBeDisabled()
  expect((await snapshot(page)).rows.every(row => row.data.length === 0)).toBe(true)
  await expect(page.locator('.cp-quote dd')).toHaveText(Array(6).fill('—'))
  expect(await page.evaluate(() => Reflect.get(window, '__continuityHost').play())).toBe(false)
  for (const index of [0, 1, 2]) {
    const data = view(index)
    await apply(page, data, frame(data, data.bars[1].time + 2, .2 + index * .2, data.fills[0].id))
    const actual = await snapshot(page)
    expect(actual.rows.filter(row => row.kind === 'Candlestick' || row.kind === 'Histogram').every(row => row.data.length === 2)).toBe(true)
    expect(actual.markers).toHaveLength(1)
    expect(actual.markers[0].text).toBe('BUY') // Future same-candle fill is NOT included yet.
    await expect(page.locator('.cp-execution')).toContainText('BUY')
    await expect(page.locator('.cp-source')).toHaveText(data.sourceLabel)
    expect(actual.commits.at(-1).times).toEqual(data.bars.slice(0, 2).map(bar => bar.time))
    expect(actual.commits.at(-1).quotes[0]).toBe(professionalChartLocale('ko').utc(data.bars[1].time))
    expect(actual.timers).toBe(0)
    expect(actual.events).toEqual([{ playing: true }])
    expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
    if (index === 1) await page.screenshot({ path: testInfo.outputPath('external-second-window.png'), fullPage: true })
    const empty = { ...data, identity: `${data.identity}-gap`, bars: [], fills: [] }
    await apply(page, empty, frame(empty, data.bars[1].time + 3, .2 + index * .2, null, 'waiting'))
    expect((await snapshot(page)).rows.every(row => row.data.length === 0)).toBe(true)
    await expect(page.locator('.cp-quote dd')).toHaveText(Array(6).fill('—'))
  }
  expect((await snapshot(page)).charts).toBe(1)
  expect(errors).toEqual([])
})

test('대기·전체진행률1·언어변경은 종료가 아니며 명시 complete만 조작을 복원한다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, data.bars[1].time + 2, 1, data.fills[0].id, 'waiting'))
  await page.clock.install()
  await page.clock.fastForward(120_000)
  await page.evaluate(() => Reflect.get(window, '__continuityHost').language('en'))
  await expect(page.locator('.cp-replay')).toBeVisible()
  expect((await snapshot(page)).events).toEqual([{ playing: true }])
  expect((await snapshot(page)).timers).toBe(0)
  await apply(page, data, frame(data, data.bars.at(-1)!.time + 60, 1, null, 'complete'))
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: false, reason: 'complete' }])
  await apply(page, data, frame(data, data.bars.at(-1)!.time + 60, 1, null, 'complete'))
  expect((await snapshot(page)).events).toHaveLength(2)
  await apply(page, data)
  await expect(page.locator('.cp-playback')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'EMA 20', exact: true })).toBeEnabled()
})

test('Skip 뒤 같은 시도의 늦은 frame은 다시 재생하지 않고 새 시도는 명시적으로 시작한다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, data.bars[1].time + 2))
  await page.evaluate(() => Reflect.get(window, '__continuityHost').skip())
  await apply(page, data, frame(data, data.bars[4].time, .4))
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).rows.find(row => row.kind === 'Candlestick')!.data).toHaveLength(30)
  const initial = frame(data, data.bars[0].time, 0)
  const next = { ...initial, attemptId: 'attempt-b', frame: { ...initial.frame, attemptId: 'attempt-b' } }
  await apply(page, data, next)
  await expect(page.locator('.cp-replay')).toBeVisible()
  expect((await snapshot(page)).timers).toBe(0)
})

test('가격 공백의 실제 체결은 위치를 위조하지 않고 설명과 접근성 안내에 남는다', async ({ page }) => {
  const data = view()
  data.fills = [{ ...data.fills[0], id: 'gap-fill', time: start + 4000 }]
  await mount(page, data, frame(data, start + 4000, .6, 'gap-fill'))
  expect((await snapshot(page)).markers).toHaveLength(0)
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await expect(page.locator('.cp-sr-only')).toContainText('BUY')
})

test('다른 시도·창·미래체결·NaN·조기완료 frame을 새 가격 아래 표시하지 않는다', async ({ page }) => {
  const data = view()
  await mount(page, data)
  for (const change of [ { attemptId: 'wrong' }, { viewIdentity: 'wrong' }, { time: Number.NaN },
    { fillId: data.fills[1].id }, { state: 'complete' as const, progress: 1 } ]) {
    const invalid = frame(data, start)
    Object.assign(invalid.frame, change)
    await apply(page, data, invalid)
    await expect(page.locator('.cp-surface')).toHaveCount(0)
    await expect(page.locator('.cp-empty')).toBeVisible()
    await apply(page, data, frame(data, start))
    await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  }
})

test('실행 중 감소모션을 적용하면 같은 bounded 창을 복원하고 재생을 재개하지 않는다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, start, .1))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // No new data/frame arrives while the external clock is waiting.
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).events.at(-1)).toEqual({ playing: false, reason: 'reduced' })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await apply(page, data, frame(data, start + 2, .12))
  await expect(page.locator('.cp-replay')).toHaveCount(0)
})

test('StrictMode·resize·동등 frame에도 시계 시작은 한 번이며 모든 시리즈는 표시 경계를 지킨다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, data.bars[20].time, .4), true, true)
  const initial = await snapshot(page)
  expect(initial.events).toEqual([{ playing: true }])
  expect(initial.charts - initial.removed.length).toBe(1)
  for (const row of initial.rows) expect(row.data.length).toBeLessThanOrEqual(21)
  await apply(page, structuredClone(data), frame(data, data.bars[20].time, .4))
  await page.setViewportSize({ width: 500, height: 700 })
  expect((await snapshot(page)).events).toEqual([{ playing: true }])
  expect((await snapshot(page)).timers).toBe(0)
  await page.evaluate(() => Reflect.get(window, '__continuityHost').unmount())
  expect(await page.evaluate(() => Reflect.get(window, '__continuityProbe').activeTimers.size)).toBe(0)
  await expect(page.locator('.cp-chart')).toHaveCount(0)
})

test('외부 frame 그리기 실패는 오래된 canvas를 제거하고 명시 재시도에서 현재 frame만 복구한다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, start, .1))
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextFrame(time), data.bars[1].time)
  await apply(page, data, frame(data, data.bars[2].time, .2))
  await expect(page.locator('.cp-failure')).toBeVisible()
  await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  await expect(page.locator('.cp-quote dd').first()).toHaveText(professionalChartLocale('ko').utc(data.bars[2].time))
  await page.locator('.cp-failure button').click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(page.locator('.cp-replay')).toBeVisible()
  expect((await snapshot(page)).rows.find(row => row.kind === 'Candlestick')!.data).toHaveLength(3)
  expect((await snapshot(page)).events).toEqual([{ playing: true }])
  expect((await snapshot(page)).timers).toBe(0)
})

for (const reason of ['complete', 'skip'] as const) test(`외부 ${reason} 복원 실패 재시도는 종료 의도를 보존하고 통지를 한 번만 보낸다`, async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, start, .1))
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextWindow(time), start)
  if (reason === 'complete') await apply(page, data, frame(data, data.bars.at(-1)!.time + 60, 1, null, 'complete'))
  else await page.evaluate(() => Reflect.get(window, '__continuityHost').skip())
  await expect(page.locator('.cp-failure')).toBeVisible()
  await page.locator('.cp-failure button').click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: false, reason }])
  await page.evaluate(() => { Reflect.get(window, '__continuityHost').skip(); Reflect.get(window, '__continuityHost').skip() })
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: false, reason }])
})

test('실행 중 외부 frame 제거의 복원 실패도 같은 재시도 경계로 처리한다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, start, .1))
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextWindow(time), start)
  await apply(page, data)
  await expect(page.locator('.cp-failure')).toBeVisible()
  await page.locator('.cp-failure button').click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: false, reason: 'skip' }])
})

test('활성 VWAP·RSI·BB와 오류 상태의 숫자도 외부 frame의 봉에 맞춰 표시한다', async ({ page }) => {
  const data = view(), format = professionalChartLocale('ko')
  await mount(page, data)
  await apply(page, data)
  for (const name of ['EMA 20', 'EMA 50', 'VWAP', 'RSI 14', 'BB 20·2']) await page.getByRole('button', { name, exact: true }).click()
  const studies = priceChartStudies(data.bars, 60), vwap = chartWindowVwap(data.bars, 60)
  const valuesAt = async (index: number) => {
    await expect(page.locator('[data-study="vwap"]')).toHaveText(format.axisPrice(2)(vwap[index].value!))
    await expect(page.locator('[data-study="rsi"]')).toHaveText(format.axisPrice(1)(studies.rsi[index].value!))
    await expect(page.locator('[data-study="bb"]')).toHaveText(`${format.axisPrice(2)(studies.lower[index].value!)} / ${format.axisPrice(2)(studies.upper[index].value!)}`)
    await expect(page.locator('.cp-quote dd').first()).toHaveText(format.utc(data.bars[index].time))
  }
  const first = frame(data, data.bars[20].time, .4)
  const external = { attemptId: 'attempt-b', frame: { ...first.frame, attemptId: 'attempt-b' } }
  await apply(page, data, external)
  await valuesAt(20)
  expect((await snapshot(page)).rows.every(row => row.data.length <= 21)).toBe(true)
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextFrame(time), data.bars[21].time)
  await apply(page, data, { ...external, frame: { ...external.frame, time: data.bars[22].time, progress: .5 } })
  await expect(page.locator('.cp-failure')).toBeVisible()
  await valuesAt(22)
})

test('실패한 A 종료 의도는 새 B 재생의 제거·늦은 frame에 적용되지 않는다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, start, .1))
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextWindow(time), start)
  await apply(page, data, frame(data, data.bars.at(-1)!.time + 60, 1, null, 'complete'))
  await expect(page.locator('.cp-failure')).toBeVisible()
  const initial = frame(data, start, .1)
  const next = { attemptId: 'attempt-b', frame: { ...initial.frame, attemptId: 'attempt-b' } }
  await apply(page, data, next)
  await page.locator('.cp-failure button').click()
  await expect(page.locator('.cp-replay')).toBeVisible()
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: true }])
  await apply(page, data)
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: true }, { playing: false, reason: 'skip' }])
  await apply(page, data, { ...next, frame: { ...next.frame, time: start + 120, progress: .2 } })
  await expect(page.locator('.cp-replay')).toHaveCount(0)
  expect((await snapshot(page)).events).toHaveLength(3)
  expect((await snapshot(page)).rows.find(row => row.kind === 'Candlestick')!.data).toHaveLength(30)
})

test('제거 복원 실패 뒤 재시도 초기화까지 실패해도 종료 통지는 성공 복원 뒤 한 번이다', async ({ page }) => {
  const data = view()
  await mount(page, data, frame(data, start, .1))
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextWindow(time), start)
  await apply(page, data)
  await expect(page.locator('.cp-failure')).toBeVisible()
  await page.evaluate(time => Reflect.get(window, '__continuityHost').failNextMount(time), start)
  await page.locator('.cp-failure button').click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__continuityProbe').injectedFailures.length)).toBe(2)
  await expect(page.locator('.cp-failure')).toBeVisible()
  await expect(page.locator('.cp-surface canvas')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, '__continuityHost').replayEvents)).toEqual([{ playing: true }])
  await page.locator('.cp-failure button').click()
  await expect(page.locator('.cp-failure')).toHaveCount(0)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  expect((await snapshot(page)).rows.find(row => row.kind === 'Candlestick')!.data).toHaveLength(30)
  expect((await snapshot(page)).events).toEqual([{ playing: true }, { playing: false, reason: 'skip' }])
})
