import { expect, test, type Page } from '@playwright/test'
import { commonDate } from '../src/client-common-backtest-preview'

const first = 61, last = 260, middle = 160
async function mount(page: Page) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const imports: string[] = []; page.on('request', request => { if (request.url().includes('lightweight-charts')) imports.push(request.url()) })
  // Keep the real canvas/API. Capture its crosshair subscriber so a non-pointer
  // callback can be interleaved deterministically between keyboard events.
  await page.route(/\/(?:node_modules\/)?\.vite(?:-e2e-\d+)?\/deps\/lightweight-charts\.js(?:\?|$)/, async route => {
    const response = await route.fetch(), original = await response.text()
    const body = original.replace('return createChartEx(container, new HorzScaleBehaviorTime(), HorzScaleBehaviorTime._internal_applyDefaults(options));', `
      const chart = createChartEx(container, new HorzScaleBehaviorTime(), HorzScaleBehaviorTime._internal_applyDefaults(options));
      const subscribe = chart.subscribeCrosshairMove.bind(chart);
      chart.subscribeCrosshairMove = handler => { window.emitNonPointerCrosshair = handler; window.chartCrosshairGeneration = (window.chartCrosshairGeneration ?? 0) + 1; return subscribe(handler); };
      return chart;
    `)
    if (body === original) throw new Error('Real Lightweight Charts entry changed')
    await route.fulfill({ response, body })
  })
  await page.route('**/common-chart-keyboard.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#000;color:#eee;margin:0;font-family:sans-serif;--gt:#eee"><main class="client-common-bt" style="box-sizing:border-box"><div id="fixture"></div><button id="outside">차트 밖</button></main></body></html>' }))
  await page.goto('/common-chart-keyboard.html')
  await page.evaluate(async ({ first, last }) => {
    localStorage.setItem('tethLang', 'ko')
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCommonBacktestChart.tsx', dp = '/@id/react-dom/client', bp = '/src/client-common-backtest-preview.ts', ip = '/src/client-inline-backtest.ts', css = '/src/client-common-backtest.css'
    const transformed = await (await fetch(cp)).text(), rp = transformed.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ rp), react = reactModule.default ?? reactModule, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    const preview = await import(/* @vite-ignore */ bp), intake = await import(/* @vite-ignore */ ip)
    await import(/* @vite-ignore */ css)
    const input = intake.decodeInlineInput({ pair: 'BTC/USDT', timeframe: '일봉', parameters: { sl: -3, tp: 8, rsiTh: 44, trendFilter: false, startI: first, endI: last } })
    const initial = preview.commonPreviewResult({ state: { turnId: 'chart', period: 0, amount: 1000 }, input })
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    function Host() {
      const [result, setResult] = react.useState(initial), [selected, setSelected] = react.useState(null)
      const select = react.useCallback((day: number) => setSelected(day), [])
      Reflect.set(window, 'replaceChartResult', () => { setResult(preview.commonPreviewResult({ state: { turnId: 'chart-next', period: 0, amount: 3000 }, input })); setSelected(null) })
      return react.createElement(component.default, { result, count: result.points.length, ready: false, selectedDay: selected, onSelect: select })
    }
    root.render(react.createElement(react.StrictMode, null, react.createElement(Host)))
  }, { first, last })
  const plot = page.locator('.cbt-chart-plot'), chart = page.locator('.cbt-chart')
  await expect(plot.locator('canvas').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'emitNonPointerCrosshair')), { message: JSON.stringify(imports), timeout: 1000 }).toBe('function')
  return { chart, plot, status: chart.locator('[role=status]'), errors }
}
async function hoverCallback(page: Page) {
  await page.evaluate(offset => Reflect.get(window, 'emitNonPointerCrosshair')({ logical: offset, point: { x: 100, y: 100 } }), middle - first)
  await expect(page.locator('.cbt-chart-readout time')).toHaveText(commonDate(middle))
}

test('Home·End·방향키→비포인터 crosshair→Enter는 키보드 목적지와 핀을 보존한다', async ({ page }) => {
  const { chart, plot, status, errors } = await mount(page)
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const [key, destination] of [['Home', first], ['End', last]] as const) {
      await plot.focus(); await page.keyboard.press(key)
      await expect(status).toContainText(commonDate(destination))
      await hoverCallback(page)
      await page.keyboard.press('Enter')
      await expect(chart).toHaveAttribute('data-selected-date', commonDate(destination))
      const pin = chart.locator('.cbt-chart-pin circle')
      await expect.poll(async () => {
        const x = Number(await pin.getAttribute('cx')), width = await plot.evaluate(node => node.clientWidth)
        return key === 'Home' ? x >= 0 && x < width * .2 : x > width * .7 && x <= width
      }).toBe(true)
    }
  }
  await page.keyboard.press('Home'); await hoverCallback(page); await page.keyboard.press('ArrowRight'); await hoverCallback(page); await page.keyboard.press('Enter')
  await expect(chart).toHaveAttribute('data-selected-date', commonDate(first + 1))
  await page.keyboard.press('End'); await hoverCallback(page); await page.keyboard.press('ArrowLeft'); await hoverCallback(page); await page.keyboard.press('Enter')
  await expect(chart).toHaveAttribute('data-selected-date', commonDate(last - 1))
  expect(errors).toEqual([])
})

test('실제 포인터 이동은 선택 소유권을 넘기되 키보드 ARIA 안내를 재발화하지 않는다', async ({ page }) => {
  const { chart, plot, status, errors } = await mount(page)
  await plot.focus(); await page.keyboard.press('Home')
  const announcement = await status.textContent()
  await plot.scrollIntoViewIfNeeded()
  const box = (await plot.boundingBox())!
  await page.mouse.move(box.x + box.width * .45, box.y + 100)
  const readout = chart.locator('.cbt-chart-readout time')
  await expect(readout).not.toHaveText(commonDate(first))
  const pointerDay = await readout.textContent()
  await expect(status).toHaveText(announcement!)
  await page.keyboard.press('Enter')
  await expect(chart).toHaveAttribute('data-selected-date', pointerDay!)
  await page.locator('#outside').focus()
  await expect(status).toBeEmpty()
  expect(errors).toEqual([])
})

test('Escape·외부 blur·결과 교체는 이전 키보드 cursor를 해제한다', async ({ page }) => {
  const { chart, plot, status, errors } = await mount(page)
  await plot.focus(); await page.keyboard.press('Home'); await page.keyboard.press('Escape')
  await expect(status).toBeEmpty()
  await page.keyboard.press('Enter')
  await expect(chart).toHaveAttribute('data-selected-date', commonDate(last))
  await page.keyboard.press('Home'); await page.locator('#outside').focus()
  await expect(status).toBeEmpty()
  await plot.focus(); await page.keyboard.press('Enter')
  await expect(chart).toHaveAttribute('data-selected-date', commonDate(last))
  await page.keyboard.press('Home')
  const generation = await page.evaluate(() => Reflect.get(window, 'chartCrosshairGeneration'))
  await page.evaluate(() => Reflect.get(window, 'replaceChartResult')())
  await expect(chart).not.toHaveAttribute('data-selected-date', /./)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'chartCrosshairGeneration'))).toBeGreaterThan(generation)
  // Existing inspected state is separate from the keyboard cursor. A newly
  // observed crosshair on the new chart must no longer lose to the old cursor.
  await hoverCallback(page)
  await plot.focus(); await page.keyboard.press('Enter')
  await expect(chart).toHaveAttribute('data-selected-date', commonDate(middle))
  expect(errors).toEqual([])
})
