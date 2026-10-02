import { expect, test, type Page } from '@playwright/test'
import { fixture } from '../src/dev/chart-workspace-fixture'

// Canvas glyph bounds, not simulated DOM labels. Test-only display fixtures.
async function mount(page: Page, width: number, grouped: boolean, markerOnly = false, nextWindow = false, retry = false) {
  await page.setViewportSize({ width, height: 1000 })
  // Read one real compiled module before navigation. A late route callback
  // must not fetch a response which can be disposed during context teardown.
  const response = await page.request.get('/src/components/ClientProfessionalPriceChart.tsx', { maxRetries: 0 })
  if (response.status() !== 200) throw new Error(`TEST_MARKER_CHART_HTTP_${response.status()}`)
  if (!/^(?:application|text)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(response.headers()['content-type'] ?? '')) throw new Error('TEST_MARKER_CHART_JAVASCRIPT_REQUIRED')
  const body = await response.text()
  expect(body).toContain('api.current = chart;')
  if (body.split('api.current = chart;').length !== 2) throw new Error('TEST_MARKER_CHART_SINGLE_SEAM_REQUIRED')
  const compiledBody = body.replace('api.current = chart;', 'api.current = chart; window.__markerChart = chart;')
  const headers = { ...response.headers(), 'content-length': String(Buffer.byteLength(compiledBody)) }
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', route => route.fulfill({ response, headers, body: compiledBody }))
  await page.addInitScript(() => {
    const labels = new Map<HTMLCanvasElement, Map<string, { left: number; right: number; top: number; bottom: number }>>()
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (/^(BUY|SELL|EMA 20|EMA 50|BB 20·2|VWAP)/.test(text)) {
        const metrics = this.measureText(text), transform = this.getTransform()
        const first = transform.transformPoint({ x: x - metrics.actualBoundingBoxLeft - 4, y: y - metrics.actualBoundingBoxAscent - 3 })
        const last = transform.transformPoint({ x: x + metrics.actualBoundingBoxRight + 4, y: y + metrics.actualBoundingBoxDescent + 3 })
        if (!labels.has(this.canvas)) labels.set(this.canvas, new Map())
        labels.get(this.canvas)!.set(text.trim(), { left: first.x, right: last.x, top: first.y, bottom: last.y })
      }
      if (maxWidth === undefined) original.call(this, text, x, y)
      else original.call(this, text, x, y, maxWidth)
    }
    Reflect.set(window, '__markerGlyphs', () => [...labels].filter(([canvas]) => canvas.isConnected && canvas.closest('.cp-surface')).flatMap(([canvas, values]) => {
      const rect = canvas.getBoundingClientRect(), scaleX = rect.width / canvas.width, scaleY = rect.height / canvas.height
      return [...values].filter(([, bounds]) => rect.width > 0 && rect.height > 0 && bounds.right > 0 && bounds.left < canvas.width && bounds.bottom > 0 && bounds.top < canvas.height).map(([text, bounds]) => ({ text, left: rect.left + bounds.left * scaleX, right: rect.left + bounds.right * scaleX,
        top: rect.top + bounds.top * scaleY, bottom: rect.top + bounds.bottom * scaleY }))
    }))
  })
  await page.goto('/')
  // The public bootstrap imports mobile main padding asynchronously. Mounting
  // before that stylesheet arrives fits a 320px plot which later becomes 288px.
  await expect(page.locator('#tesia-main')).toBeVisible()
  const last = fixture.bars.at(-1)!
  const view = { ...fixture, fills: [
    { id: 'first-buy', tradeId: 'trade', time: fixture.bars[0].time, price: fixture.bars[0].close, side: 'BUY' as const },
    ...Array.from({ length: markerOnly || nextWindow ? 1200 : grouped ? 12 : 1 }, (_, index) => ({ id: `last-sell-${index}`, tradeId: `trade-${index}`, time: last.time, price: last.close, side: 'SELL' as const })),
  ] }
  await page.evaluate(async view => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const { mount } = await import(/* @vite-ignore */ path)
    // Resolve the font actually used for both marker measurement and paint.
    await document.fonts.load('12px "Geist Variable"', 'BUY SELL ×1200')
    await document.fonts.ready
    Reflect.set(window, '__markerHost', mount(view, 'marker-layout-test'))
  }, markerOnly || nextWindow ? { ...view, fills: [] } : view)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  for (const name of ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP']) await page.getByRole('button', { name, exact: true }).click()
  if (markerOnly || nextWindow) {
    const next = nextWindow ? { ...view, identity: 'SYNTHETIC_NEXT_FIT_WINDOW', bars: view.bars.map(bar => ({ ...bar, time: bar.time + 604800 })), fills: view.fills.map(fill => ({ ...fill, time: fill.time + 604800 })) } : view
    if (retry) {
      await page.evaluate(() => {
        const candle = Reflect.get(window, '__markerChart').panes()[0].getSeries()[0]
        const setData = candle.setData.bind(candle)
        let fail = true
        candle.setData = (data: unknown[]) => {
          if (fail && data.length) { fail = false; throw new Error('TEST_ONLY_RETRY_MARKER_WIDTH') }
          setData(data)
        }
      })
      await page.evaluate(view => Reflect.get(window, '__markerHost').render(view), { ...next, fills: [] })
      await expect(page.locator('.cp-failure')).toBeVisible()
    }
    await page.evaluate(view => Reflect.get(window, '__markerHost').render(view), next)
    if (retry) await page.getByRole('button', { name: '차트 다시 표시', exact: true }).click()
    await expect.poll(async () => (await page.evaluate(() => Reflect.get(window, '__markerGlyphs')()) as { text: string }[]).some(row => row.text === 'SELL ×1200')).toBe(true)
  }
  if (!nextWindow) await page.getByRole('button', { name: '차트 전체 맞춤', exact: true }).click()
  await page.locator('.cp-surface').scrollIntoViewIfNeeded()
}

for (const width of [320, 390, 768, 1440]) for (const mode of ['single', 'grouped', 'marker-only', 'next-window', 'retry'] as const) {
  const grouped = mode !== 'single', markerOnly = mode === 'marker-only', retry = mode === 'retry', nextWindow = mode === 'next-window' || retry
  test(`${width}px ${retry ? 'retry 최신 마커' : nextWindow ? 'next-window 자동 맞춤' : markerOnly ? 'marker-only 교체' : grouped ? '묶음' : '단일'} 체결 맞춤은 양끝 BUY/SELL을 지표 이름과 겹치지 않게 표시한다`, async ({ page }, info) => {
    await mount(page, width, grouped, markerOnly, nextWindow, retry)
    type Glyph = { text: string; left: number; right: number; top: number; bottom: number }
    const glyphs = () => page.evaluate<Glyph[]>(() => Reflect.get(window, '__markerGlyphs')())
    const sellText = markerOnly || nextWindow ? 'SELL ×1200' : grouped ? 'SELL ×12' : 'SELL'
    await expect.poll(async () => (await glyphs()).some(row => row.text === sellText)).toBe(true)
    // Compact chart retains original toggles/readouts instead of allocating a
    // second copy of their labels inside the limited price plot.
    const compact = width <= 480
    await expect.poll(async () => new Set((await glyphs()).filter(row => /^(EMA|BB|VWAP)/.test(row.text)).map(row => row.text)).size).toBe(compact ? 0 : 5)
    for (const name of ['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP']) await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-study=vwap]')).not.toBeEmpty()
    await expect(page.locator('[data-study=bb]')).not.toBeEmpty()
    await info.attach('glyph-bounds', { body: JSON.stringify(await glyphs()), contentType: 'application/json' })
    if (!compact) await expect.poll(async () => {
      const rows = await glyphs(), sell = rows.find(row => row.text === sellText)!
      return Math.min(...rows.filter(row => /^(EMA|BB|VWAP)/.test(row.text)).map(row => row.left - sell.right))
    }, { message: 'SELL과 우측 지표명 사이에 8 CSS px의 읽기 간격' }).toBeGreaterThanOrEqual(8)
    // Capture actual paint bounds, DOM position and chart layout in one browser
    // task; a previous surface/plot sample must not be paired with a later paint.
    const observation = await page.evaluate(count => {
      const scale = Reflect.get(window, '__markerChart').timeScale()
      return { surface: document.querySelector('.cp-surface')!.getBoundingClientRect().toJSON(),
        glyphs: Reflect.get(window, '__markerGlyphs')() as Glyph[],
        layout: { plot: scale.width(), fraction: (scale.logicalToCoordinate(count - 1) - scale.logicalToCoordinate(0)) / scale.width() } }
    }, fixture.bars.length)
    const { surface, layout } = observation
    const buy = observation.glyphs.find(row => row.text === 'BUY')!
    expect(buy.left).toBeGreaterThanOrEqual(surface!.x + 4)
    expect(layout.fraction, '실제 캔들이 plot의 절반 가까이를 사용해야 한다').toBeGreaterThanOrEqual(.48)
    expect(observation.glyphs.find(row => row.text === sellText)!.right).toBeLessThanOrEqual(surface!.x + layout.plot - 4)
    await page.screenshot({ path: info.outputPath('marker-clearance.png'), fullPage: true })
  })
}
