import { installCompiledModuleResponse } from './fixtures/compiled-module-response'
import { expect, test, type Page } from '@playwright/test'
import { createDrawingTimeProjection } from '../src/chart/drawing-time-projection'
import { fixture } from '../src/dev/chart-workspace-fixture'
import type { PriceChartView } from '../src/chart/price-chart-view'

test('도형 시간축은 관측 사이 비율·양쪽 창밖·한 봉·잘못된 입력을 구별한다', () => {
  const bars = [{ time: 120 }, { time: 180 }, { time: 420 }], before = structuredClone(bars)
  // Other series may add a logical offset. Never assume candle index === global index.
  const indexes = new Map([[120, 5], [180, 6], [420, 7]])
  const scale = { timeToCoordinate: (t: number) => indexes.has(t) ? indexes.get(t)! * 10 : null, timeToIndex: (t: number) => indexes.get(t) ?? null, logicalToCoordinate: (n: number) => n * 10 }
  const project = createDrawingTimeProjection(bars, 60)
  for (const [time, x] of [[120, 50], [150, 55], [180, 60], [300, 65], [420, 70], [60, 40], [480, 80]]) expect(project(time, scale)).toBe(x)
  expect(bars).toEqual(before)
  bars[0].time = 0 // The projection owns a copied domain, not mutable adapter rows.
  expect(project(150, scale)).toBe(55)
  const one = createDrawingTimeProjection([{ time: 180 }], 60)
  expect(one(120, scale)).toBe(50); expect(one(240, scale)).toBe(70)
  expect(project(150, { ...scale, timeToCoordinate: () => null })).toBeNull()
  expect(project(480, { ...scale, timeToIndex: () => null })).toBeNull()
  expect(project(480, { ...scale, logicalToCoordinate: () => Infinity })).toBeNull()
  for (const time of [-1, .5, NaN, Infinity, 253_402_300_800]) expect(project(time, scale)).toBeNull()
  for (const rows of [[], [{ time: 120 }, { time: 120 }], [{ time: 180 }, { time: 120 }], [{ time: -1 }], [{ time: NaN }], Array.from({ length: 5001 }, (_, i) => ({ time: i * 60 }))]) expect(createDrawingTimeProjection(rows, 60)(150, scale)).toBeNull()
  for (const step of [0, -1, .5, Infinity, NaN]) expect(createDrawingTimeProjection(before, step)(150, scale)).toBeNull()
})

async function mount(page: Page) {
  await installCompiledModuleResponse(page, "/src/components/ClientProfessionalPriceChart.tsx", original => {
    const body = original;
    expect(body).toContain('candles.attachPrimitive(drawings);')
    return body.replace('candles.attachPrimitive(drawings);', 'candles.attachPrimitive(drawings); window.__drawingProjectionProbe = { drawings, candles, chart };')
    }, ["candles.attachPrimitive(drawings);"])
  await page.goto('/')
  await page.evaluate(async view => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    Reflect.set(window, '__drawingProjectionHost', (await import(/* @vite-ignore */ path)).mount(view, 'projection-owner'))
  }, fixture)
  await expect(page.getByRole('button', { name: '추세선', exact: true })).toBeEnabled()
}
async function update(page: Page, view: PriceChartView) {
  await page.evaluate(view => Reflect.get(window, '__drawingProjectionHost').render(view), view)
  await expect(page.locator('.cp-source')).toHaveText(view.sourceLabel)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__drawingProjectionProbe').candles.data().length)).toBe(view.bars.length)
}
const frame = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
const items = (page: Page) => page.evaluate(() => JSON.stringify(Reflect.get(window, '__drawingProjectionProbe').drawings.getSnapshot().items))
const canvases = (page: Page) => page.locator('.cp-surface canvas').evaluateAll(nodes => nodes.map(node => (node as HTMLCanvasElement).toDataURL()).join('|'))
async function geometry(page: Page) {
  return page.evaluate(() => {
    const { drawings, candles, chart } = Reflect.get(window, '__drawingProjectionProbe')
    const lines: { from: [number, number]; to: [number, number] }[] = []
    let from: [number, number] = [0, 0]
    const noop = () => {}
    const ctx = { save: noop, restore: noop, beginPath: noop, rect: noop, clip: noop, setLineDash: noop, fillRect: noop, stroke: noop, fillText: noop, arc: noop, measureText: () => ({ width: 120 }), moveTo: (x: number, y: number) => { from = [x, y] }, lineTo: (x: number, y: number) => lines.push({ from, to: [x, y] }) }
    drawings.updateAllViews()
    const width = chart.timeScale().width(), height = candles.getPane().getHeight()
    drawings.paneViews()[0].renderer().draw({ useMediaCoordinateSpace: (draw: (scope: unknown) => void) => draw({ context: ctx, mediaSize: { width, height } }) })
    return { lines, width, height }
  })
}

test('양끝이 창밖인 선도 실제 canvas에 남고 빈창·주기변경·확대·재생 후 원 앵커를 보존한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.evaluate(({ a, b }) => {
    const { drawings } = Reflect.get(window, '__drawingProjectionProbe')
    drawings.choose('trend'); drawings.place(a); drawings.place(b)
  }, { a: { time: fixture.bars[5].time, price: 145 }, b: { time: fixture.bars[115].time, price: 175 } })
  const original = await items(page)
  const windowView = { ...fixture, identity: 'middle', sourceLabel: 'TEST_ONLY_MIDDLE_WINDOW', bars: fixture.bars.slice(30, 90) }
  await update(page, windowView)
  let projected = await geometry(page)
  expect(projected.lines).toHaveLength(1)
  expect(projected.lines[0].from[0]).toBeLessThan(0)
  expect(projected.lines[0].to[0]).toBeGreaterThan(projected.width)
  await frame(page)
  const visible = await canvases(page)
  await page.evaluate(() => Reflect.get(window, '__drawingProjectionProbe').drawings.toggleHidden())
  await frame(page)
  expect(await canvases(page)).not.toBe(visible)
  await page.evaluate(() => Reflect.get(window, '__drawingProjectionProbe').drawings.toggleHidden())
  await update(page, { ...windowView, identity: 'empty', sourceLabel: 'TEST_ONLY_EMPTY', bars: [] })
  expect((await geometry(page)).lines).toHaveLength(0)
  expect(await items(page)).toBe(original)
  const aggregated = { ...fixture, identity: 'two-minute', sourceLabel: 'TEST_ONLY_2M', resolutionSeconds: 120, bars: fixture.bars.filter((_, index) => index % 2 === 0) }
  await update(page, aggregated)
  projected = await geometry(page)
  expect(projected.lines).toHaveLength(1)
  expect(projected.lines[0].from[0]).toBeGreaterThan(0)
  expect(projected.lines[0].to[0]).toBeLessThan(projected.width)
  for (const name of ['로그', '%']) { await page.getByRole('button', { name, exact: true }).click(); expect((await geometry(page)).lines).toHaveLength(1) }
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await frame(page)
    expect((await geometry(page)).lines).toHaveLength(1)
    expect(await items(page)).toBe(original)
    await page.screenshot({ path: info.outputPath(`drawing-projection-${width}.png`) })
  }
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  expect((await geometry(page)).lines).toHaveLength(0)
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  expect((await geometry(page)).lines).toHaveLength(1)
  expect(await items(page)).toBe(original)
  expect(await canvas!.evaluate(el => el.isConnected)).toBe(true)
  const data = await page.evaluate(() => Reflect.get(window, '__drawingProjectionProbe').candles.data())
  expect(data.map((row: { time: number }) => row.time)).toEqual(aggregated.bars.map(row => row.time))
  expect(errors).toEqual([])
})

test('주기변경 후6종 시간도형을 읽고 같은 선택의 끝점을 수정·되돌린다', async ({ page }) => {
  await mount(page)
  await page.evaluate(({ a, b }) => {
    const { drawings } = Reflect.get(window, '__drawingProjectionProbe')
    for (const tool of ['trend', 'ray', 'vertical', 'rectangle', 'fibonacci', 'measure']) { drawings.choose(tool); drawings.place(a); if (tool !== 'vertical') drawings.place(b) }
  }, { a: { time: fixture.bars[5].time, price: 145 }, b: { time: fixture.bars[115].time, price: 175 } })
  const original = await items(page)
  await update(page, { ...fixture, sourceLabel: 'TEST_ONLY_4M', resolutionSeconds: 240, bars: fixture.bars.filter((_, index) => index % 4 === 0) })
  expect((await geometry(page)).lines).toHaveLength(15)
  await page.getByRole('button', { name: '끝점 변경', exact: true }).click()
  const surface = page.locator('.cp-surface'); await surface.press('Home'); await surface.press('Enter')
  expect(await items(page)).not.toBe(original)
  await page.getByRole('button', { name: '되돌리기', exact: true }).click()
  expect(await items(page)).toBe(original)
  expect((await geometry(page)).lines).toHaveLength(15)
})

test('교체한 가격창의 새 키보드 도형은 화면의 마지막 봉에서 시작하고 체결만 갱신되면 선택을 보존한다', async ({ page }) => {
  await mount(page)
  const next = { ...fixture, identity: 'shifted', sourceLabel: 'TEST_ONLY_SHIFTED', bars: fixture.bars.map(bar => ({ ...bar, time: bar.time + 86400, open: bar.open + 1000, high: bar.high + 1000, low: bar.low + 1000, close: bar.close + 1000 })) }
  await update(page, next)
  const surface = page.locator('.cp-surface')
  await page.getByRole('button', { name: '수평선', exact: true }).click(); await surface.press('Enter')
  expect(JSON.parse(await items(page))[0].a).toEqual({ time: next.bars.at(-1)!.time, price: next.bars.at(-1)!.close })
  await surface.press('Home'); await surface.press('ArrowRight')
  await update(page, { ...next, sourceLabel: next.sourceLabel, bars: next.bars.map(bar => ({ ...bar })), fills: [] })
  await page.getByRole('button', { name: '수평선', exact: true }).click(); await surface.press('Enter')
  expect(JSON.parse(await items(page))[1].a).toEqual({ time: next.bars[1].time, price: next.bars[1].close })
})

test('시간봉 교체는 그리는 중인 선과 편집 중인 끝점의 원 앵커를 움직이지 않는다', async ({ page }) => {
  await mount(page)
  const surface = page.locator('.cp-surface')
  const a = { time: fixture.bars[5].time, price: fixture.bars[5].close }
  const b = { time: fixture.bars[25].time, price: fixture.bars[25].close }
  await page.evaluate(({ a, b }) => {
    const { drawings } = Reflect.get(window, '__drawingProjectionProbe')
    drawings.choose('trend'); drawings.setKeyboardAnchor(a); drawings.place(a); drawings.setKeyboardAnchor(b)
  }, { a, b })
  const twoMinute = { ...fixture, identity: 'draft-two-minute', sourceLabel: 'TEST_ONLY_DRAFT_2M', resolutionSeconds: 120, bars: fixture.bars.filter((_, index) => index % 2 === 0) }
  await update(page, twoMinute)
  expect(await page.evaluate(() => Reflect.get(window, '__drawingProjectionProbe').drawings.getSnapshot().pending)).toBe(true)
  await surface.press('Enter')
  const completed = JSON.parse(await items(page))
  expect(completed).toHaveLength(1)
  expect(completed[0].a).toEqual(a)
  expect(completed[0].b).toEqual(b)
  const c = { time: fixture.bars[45].time, price: fixture.bars[45].close }
  await page.getByRole('button', { name: '끝점 변경', exact: true }).click()
  await page.evaluate(c => Reflect.get(window, '__drawingProjectionProbe').drawings.setKeyboardAnchor(c), c)
  await update(page, { ...fixture, identity: 'edit-four-minute', sourceLabel: 'TEST_ONLY_EDIT_4M', resolutionSeconds: 240, bars: fixture.bars.filter((_, index) => index % 4 === 0) })
  expect(await page.evaluate(() => Reflect.get(window, '__drawingProjectionProbe').drawings.getSnapshot().editing)).toBe('b')
  await surface.press('Enter')
  const edited = JSON.parse(await items(page))
  expect(edited[0].a).toEqual(a)
  expect(edited[0].b).toEqual(c)
  await page.getByRole('button', { name: '되돌리기', exact: true }).click()
  expect(JSON.parse(await items(page))).toEqual(completed)
  await update(page, fixture)
  expect(JSON.parse(await items(page))).toEqual(completed)
})
