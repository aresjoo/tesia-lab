import { installCompiledModuleResponse } from './fixtures/compiled-module-response'
import { expect, test, type Page } from '@playwright/test'
import { chartWindowVwap, priceChartStudies, studyLineData } from '../src/chart/price-chart-studies'
import type { PriceBar, PriceChartView } from '../src/chart/price-chart-view'
import { fixture } from '../src/dev/chart-workspace-fixture'

const bars = (closes: number[]): PriceBar[] => closes.map((close, i) => ({ time: 1700000000 + i * 60, open: close, high: close, low: close, close, volume: 10 }))
test('VWAP는 분수 거래량·0 거래량·결측·큰 값에서도 미래 봉 없이 HLC3 가중 평균을 표시한다', () => {
  const input = bars([10, 20, 30, 40, 50]).map((bar, i) => ({ ...bar, volume: [0, .1, .3, 0, .2][i] }))
  const before = structuredClone(input)
  const result = chartWindowVwap(input, 60)
  expect(result[0].value).toBeUndefined()
  expect(result[1].value).toBe(20)
  expect(result[2].value).toBeCloseTo(27.5, 10)
  expect(result[3].value).toBeCloseTo(27.5, 10)
  expect(result[4].value).toBeCloseTo(35, 10)
  for (let count = 1; count <= input.length; count++) expect(chartWindowVwap(input.slice(0, count), 60)).toEqual(result.slice(0, count))
  const gap = input.map((bar, i) => ({ ...bar, time: bar.time + (i >= 4 ? 60 : 0) }))
  const reset = chartWindowVwap(gap, 60)
  expect(reset[4].value).toBeCloseTo(50, 10)
  expect(studyLineData(reset, 60)[3]).toEqual({ ...reset[3], color: 'transparent' })
  expect(chartWindowVwap([{ ...input[1], high: 30, low: 10, close: 20 }], 60)[0].value).toBe(20)
  const extreme = bars(Array.from({ length: 5000 }, (_, i) => i % 2 ? 1.7e308 : 1e-9)).map((bar, i) => ({ ...bar, volume: i % 2 ? 1.7e308 : 1e-12 }))
  expect(chartWindowVwap(extreme, 60).every(point => Number.isFinite(point.value) && point.value! > 0)).toBe(true)
  const cancellation = bars([1e308, 1]).map((bar, i) => ({ ...bar, volume: i ? 1e308 : 1 }))
  expect(chartWindowVwap(cancellation, 60)[1].value).toBeCloseTo(2, 10)
  expect(chartWindowVwap([], 60)).toEqual([])
  expect(input).toEqual(before)
})
test('RSI는 14개 변화 이후 Wilder 평균이며 초기·평탄·결측을 가짜 값으로 채우지 않는다', () => {
  const input = bars(Array.from({ length: 16 }, (_, i) => i < 15 ? 10 + i : 23))
  const result = priceChartStudies(input, 60)
  expect(result.rsi.slice(0, 14).every(item => item.value === undefined)).toBe(true)
  expect(result.rsi[14].value).toBe(100)
  expect(result.rsi[15].value).toBeCloseTo(92.8571428571, 8)
  expect(priceChartStudies(bars(Array.from({ length: 30 }, (_, i) => 100 - i)), 60).rsi.at(-1)!.value).toBe(0)
  expect(priceChartStudies(bars(Array(30).fill(100)), 60).rsi.every(item => item.value === undefined)).toBe(true)
  const gap = [...input, ...bars(Array.from({ length: 15 }, (_, i) => 40 + i)).map(bar => ({ ...bar, time: bar.time + 3600 }))]
  const after = priceChartStudies(gap, 60).rsi.slice(16)
  expect(after.slice(0, 14).every(item => item.value === undefined)).toBe(true)
  expect(after[14].value).toBe(100)
})

test('BB20·2는 20종가 모집단 표준편차이며 미래값·누락 봉을 사용하지 않는다', () => {
  const input = bars(Array.from({ length: 40 }, (_, i) => i + 1))
  const before = structuredClone(input)
  const all = priceChartStudies(input, 60)
  expect(all.upper.slice(0, 19).every(item => item.value === undefined)).toBe(true)
  expect(all.upper[19].value).toBeCloseTo(10.5 + 2 * Math.sqrt(33.25), 10)
  expect(all.lower[19].value).toBeCloseTo(10.5 - 2 * Math.sqrt(33.25), 10)
  for (let count = 1; count <= input.length; count++) {
    const prefix = priceChartStudies(input.slice(0, count), 60)
    for (const key of ['rsi', 'upper', 'lower'] as const) expect(prefix[key]).toEqual(all[key].slice(0, count))
  }
  expect(input).toEqual(before)
  expect(priceChartStudies(bars(Array(20).fill(100)), 60).upper[19].value).toBe(100)
  const gap = input.map((bar, i) => ({ ...bar, time: bar.time + (i >= 20 ? 60 : 0) }))
  const g = priceChartStudies(gap, 60)
  expect(g.upper.slice(20, 39).every(item => item.value === undefined)).toBe(true)
  expect(g.upper[39].value).toBeDefined()
  expect(studyLineData(g.upper)[19]).toEqual({ ...g.upper[19], color: 'transparent' })
  expect(studyLineData(g.upper)[39]).toEqual(g.upper[39])
})

test('빈 입력과 큰 가격도 비유한 지표 값을 renderer에 전달하지 않는다', () => {
  expect(priceChartStudies([], 60)).toEqual({ rsi: [], upper: [], lower: [] })
  const output = priceChartStudies(bars(Array.from({ length: 5000 }, (_, i) => i % 2 ? 1.7e308 : 1e-9)), 60)
  for (const rows of Object.values(output)) {
    expect(rows).toHaveLength(5000)
    expect(rows.every(item => item.value === undefined || Number.isFinite(item.value))).toBe(true)
  }
})

async function mount(page: Page, view: PriceChartView = fixture) {
  await installCompiledModuleResponse(page, "/src/components/ClientProfessionalPriceChart.tsx", original => {
    const body = original;
    expect(body).toContain('api.current = chart;')
    return body.replace('api.current = chart;', `api.current = chart;
      window.__studiesChart = chart;
      window.__studySeriesTitles = new WeakMap();
      const originalAddStudySeries = chart.addSeries.bind(chart);
      chart.addSeries = (...args) => {
        const item = originalAddStudySeries(...args);
        window.__studySeriesTitles.set(item, item.options().title);
        return item;
      };`)
    }, ["api.current = chart;"])
  await page.goto('/')
  await page.evaluate(async view => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const module = await import(/* @vite-ignore */ path)
    Object.assign(window, { priceChartHost: module.mount(view) })
  }, view)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
}
const paneTitles = (page: Page) => page.evaluate(() => Reflect.get(window, '__studiesChart').panes().map((pane: { getSeries(): { options(): { title: string } }[] }) => pane.getSeries().map(series => series.options().title)))

test('EMA20·50과 VWAP를 독립적으로 바꿔도 기존 캔버스와 가격 범위는 유지된다', async ({ page }) => {
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const calls: string[] = []; page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) calls.push(r.url()) })
  // The canonical study name is recorded at construction. Responsive pane
  // labels may be blank, but must never hide a missing/wrong visible series.
  const visible = () => page.evaluate(() => Reflect.get(window, '__studiesChart').panes()[0].getSeries().filter((series: { options(): {visible: boolean} }) => series.options().visible).map((series: object) => Reflect.get(window, '__studySeriesTitles').get(series)))
  await page.evaluate(() => Reflect.get(window, '__studiesChart').timeScale().setVisibleLogicalRange({ from: 10, to: 40 }))
  await page.getByRole('button', { name: 'EMA 20', exact: true }).click()
  expect(await visible()).toEqual(['', 'EMA 20'])
  await page.getByRole('button', { name: 'EMA 50', exact: true }).click()
  expect(await visible()).toEqual(['', 'EMA 20', 'EMA 50'])
  await page.getByRole('button', { name: 'EMA 20', exact: true }).click()
  expect(await visible()).toEqual(['', 'EMA 50'])
  await page.getByRole('button', { name: 'VWAP', exact: true }).click()
  expect(await visible()).toEqual(['', 'EMA 50', 'VWAP'])
  await page.locator('.cp-surface').press('Home')
  await expect(page.locator('[data-study=vwap]')).toHaveText('101.00')
  await page.locator('.cp-surface').press('Shift+ArrowRight')
  const sample = fixture.bars.slice(0, 11)
  const expected = sample.reduce((sum, bar) => sum + (bar.high + bar.low + bar.close) / 3 * bar.volume, 0) / sample.reduce((sum, bar) => sum + bar.volume, 0)
  await expect(page.locator('[data-study=vwap]')).toHaveText(expected.toFixed(2))
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  expect(calls).toEqual([])
})

test('차트 단축키는 10봉·경계·맞춤·선택 해제를 지원하고 조합키와 IME는 가로채지 않는다', async ({ page }) => {
  await mount(page)
  const surface = page.locator('.cp-surface'), status = page.locator('.cp-sr-only')
  await surface.press('Home')
  await expect(status).toContainText('종가 102')
  await surface.press('Shift+ArrowRight'); await expect(status).toContainText('종가 112')
  await surface.press('Shift+ArrowLeft'); await expect(status).toContainText('종가 102')
  await surface.press('Shift+ArrowLeft'); await expect(status).toContainText('종가 102')
  await surface.press('End'); await surface.press('Shift+ArrowRight'); await expect(status).toContainText('종가 221')
  for (const key of ['Control+ArrowLeft', 'Meta+ArrowLeft', 'Alt+ArrowLeft']) {
    // Dispatch rather than invoke the browser's own history navigation shortcut.
    await surface.dispatchEvent('keydown', { key: 'ArrowLeft', ctrlKey: key.startsWith('Control'), metaKey: key.startsWith('Meta'), altKey: key.startsWith('Alt'), bubbles: true })
    await expect(status).toContainText('종가 221')
  }
  await surface.dispatchEvent('keydown', { key: 'Home', isComposing: true, bubbles: true })
  await surface.dispatchEvent('keydown', { key: 'Home', keyCode: 229, bubbles: true })
  await surface.evaluate(node => { const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }); event.preventDefault(); node.dispatchEvent(event) })
  await expect(status).toContainText('종가 221')
  await page.evaluate(() => Reflect.get(window, '__studiesChart').timeScale().setVisibleLogicalRange({ from: 20, to: 30 }))
  await surface.press('r')
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__studiesChart').timeScale().getVisibleLogicalRange().from)).toBeLessThan(0)
  await surface.press('Escape'); await expect(status).toBeEmpty()
  await page.waitForTimeout(100)
  await expect(status).toBeEmpty()
})

test('RSI·BB 토글은 같은 차트·줌을 유지하고 모든 순서에서 RSI와 거래량 pane을 분리한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const calls: string[] = []; page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) calls.push(r.url()) })
  await page.evaluate(() => Reflect.get(window, '__studiesChart').timeScale().setVisibleLogicalRange({ from: 0, to: 40 }))
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await page.getByRole('button', { name: 'BB 20·2', exact: true }).click()
  expect((await paneTitles(page))[1]).toEqual(['RSI 14'])
  expect(await paneTitles(page)).toHaveLength(3)
  for (const label of ['거래량', '거래량', 'RSI 14', '거래량', 'RSI 14', '거래량']) await page.getByRole('button', { name: label, exact: true }).click()
  expect((await paneTitles(page))[1]).toEqual(['RSI 14'])
  expect(await paneTitles(page)).toHaveLength(3)
  expect(await canvas!.evaluate(node => node.isConnected)).toBe(true)
  expect(await page.evaluate(() => Reflect.get(window, '__studiesChart').timeScale().getVisibleLogicalRange().to)).toBeCloseTo(40, 6)
  await page.locator('.cp-surface').press('Home')
  await expect(page.locator('[data-study=rsi]')).toHaveText('계산값 없음')
  await expect(page.locator('[data-study=bb]')).toHaveText('계산값 없음')
  await page.locator('.cp-surface').press('End')
  await expect(page.locator('[data-study=rsi]')).toHaveText('100.0')
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.locator('.cp-chart').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    await expect.poll(() => page.evaluate(() => Reflect.get(window, '__studiesChart').panes()[1].getHeight())).toBeGreaterThanOrEqual(85)
    const boxes = await page.locator('.cp-controls button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height } }))
    expect(boxes.every(r => r.x >= 0 && r.right <= width && r.height >= 44)).toBe(true)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxes[i].x < boxes[j].right && boxes[i].right > boxes[j].x && boxes[i].y < boxes[j].bottom && boxes[i].bottom > boxes[j].y).toBe(false)
    await page.screenshot({ path: info.outputPath(`indicators-${width}.png`) })
  }
  expect(calls).toEqual([]); expect(errors).toEqual([])
})

test('지표 재생은 공개된 봉까지만 진행하며 Skip 뒤 전체값과 pane을 복원한다', async ({ page }) => {
  const installedAt = new Date('2026-09-19T00:00:00Z')
  await page.clock.install({ time: installedAt })
  await mount(page)
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await page.getByRole('button', { name: 'BB 20·2', exact: true }).click()
  // The fixed target exceeds the test deadline and precedes the replay start.
  await page.clock.pauseAt(new Date(installedAt.getTime() + 300_000))
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.getByRole('button', { name: 'RSI 14', exact: true })).toBeDisabled()
  const data = () => page.evaluate(() => Reflect.get(window, '__studiesChart').panes().map((pane: { getSeries(): { data(): { time: number; value?: number }[] }[] }) => pane.getSeries().map(series => series.data())))
  expect((await data()).flat().every((rows: {time: number}[]) => rows.length <= 1)).toBe(true)
  await expect(page.locator('[data-study=rsi]')).toHaveText('계산값 없음')
  await page.clock.runFor(15000)
  const rows = (await data()).flat() as { time: number; value?: number }[][]
  // LWC data() returns value rows after incremental updates, excluding warmup.
  expect(rows.map(series => series.filter(item => item.value !== undefined || 'close' in item).length)).toEqual([30, 24, 6, 0, 30, 30, 11, 11, 30, 16, 30])
  expect(new Set(rows.filter(series => series.length).map(series => series.at(-1)?.time)).size).toBe(1)
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  expect((await data()).flat().map((series: {value?: number}[]) => series.filter(item => item.value !== undefined || 'close' in item).length)).toEqual([120, 114, 96, 22, 120, 120, 101, 101, 120, 106, 120])
  await expect(page.locator('[data-study=rsi]')).toHaveText('100.0')
  expect(await paneTitles(page)).toHaveLength(3)
})

test('결측 후 BB 선은 계산 불가 구간을 불투명한 직선으로 연결하지 않는다', async ({ page }, info) => {
  const view = { ...fixture, fills: [], bars: fixture.bars.map((bar, i) => ({ ...bar, time: bar.time + (i >= 60 ? 60 : 0) })) }
  await mount(page, view)
  await page.evaluate(times => {
    const chart = Reflect.get(window, '__studiesChart')
    const strokes: string[] = []; Reflect.set(window, '__gapStrokes', strokes)
    const paths = new WeakMap<CanvasRenderingContext2D, { x: number; y: number; spans: boolean }>()
    const proto = CanvasRenderingContext2D.prototype
    const begin = proto.beginPath, move = proto.moveTo, line = proto.lineTo, stroke = proto.stroke
    proto.beginPath = function () { paths.set(this, { x: NaN, y: NaN, spans: false }); begin.call(this) }
    proto.moveTo = function (x, y) { const p = paths.get(this); if (p) { p.x = x; p.y = y }; move.call(this, x, y) }
    proto.lineTo = function (x, y) {
      // Use this canvas's actual bitmap ratio, not window DPR. The library may
      // still use a 1x bitmap in a 3x mobile context. Resolve this paint's plot
      // coordinates too, since axis labels can change the available width.
      const ratio = this.canvas.width / this.canvas.clientWidth
      const left = chart.timeScale().timeToCoordinate(times[0]) * ratio
      const right = chart.timeScale().timeToCoordinate(times[1]) * ratio
      const p = paths.get(this)
      if (p) {
        if (Math.abs(p.x - left) < 2 && Math.abs(x - right) < 2 && Math.abs(p.y - y) > 2) p.spans = true; p.x = x; p.y = y
      }
      line.call(this, x, y)
    }
    proto.stroke = function (...args: Parameters<typeof stroke>) { if (paths.get(this)?.spans) strokes.push(String(this.strokeStyle)); stroke.apply(this, args) }
  }, [view.bars[59].time, view.bars[79].time])
  await page.getByRole('button', { name: 'BB 20·2', exact: true }).click()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__gapStrokes').length)).toBeGreaterThan(0)
  expect(await page.evaluate(() => Reflect.get(window, '__gapStrokes'))).toEqual(expect.arrayContaining(['rgba(0, 0, 0, 0)']))
  expect(await page.evaluate(() => Reflect.get(window, '__gapStrokes').every((style: string) => style === 'rgba(0, 0, 0, 0)'))).toBe(true)
  await page.screenshot({ path: info.outputPath('indicators-gap.png'), fullPage: true })
})
