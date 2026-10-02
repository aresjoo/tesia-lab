import { expect, test } from '@playwright/test'

// TEST ONLY values: deliberately flat before crossing the initial capital.
// No market/provider data or backtest engine output is replaced by this harness.
for (const initial of [1000, 950]) test(`초기 ${initial} 한 점·평평한 구간·손익 교차는 같은 canvas에서 안전하게 재생된다`, async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/common-profit-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#101010;color:#eee"><main id="fixture"></main></body></html>' }))
  await page.goto('/common-profit-test.html')
  await page.evaluate(async initial => {
    localStorage.setItem('tethLang', 'ko')
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const cp = '/src/components/ClientCommonBacktestChart.tsx', dp = '/@id/react-dom/client', css = '/src/client-common-backtest.css'
    const source = await (await fetch(cp)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ dp), component = await import(/* @vite-ignore */ cp)
    await import(/* @vite-ignore */ css)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    const result = { evaluation: { cap: 1000, L: { evs: [] } }, points: [initial, initial, 1100, 900, 1150, 850].map((value, index) => ({ i: 61 + index, value, benchmark: 1000 })) }
    function Fixture() {
      const [state, setState] = react.useState({ count: 1, ready: true })
      Object.assign(window, { profitUpdate: setState })
      return react.createElement('div', { className: 'client-common-bt', style: { padding: 16 } }, react.createElement(component.default, { result, ...state, selectedDay: null, onSelect: () => {} }))
    }
    root.render(react.createElement(Fixture))
  }, initial)
  const canvas = page.locator('.cbt-chart canvas').first()
  await expect(canvas).toBeVisible()
  await canvas.evaluate(node => Reflect.set(window, 'profitCanvas', node))
  const frames = () => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const reveal = async (count: number, ready = false) => {
    await page.evaluate(state => Reflect.get(window, 'profitUpdate')(state), { count, ready })
    await frames()
    expect(await canvas.evaluate(node => Reflect.get(window, 'profitCanvas') === node)).toBe(true)
    expect(errors).toEqual([])
  }
  const colors = () => page.locator('.cbt-chart canvas').evaluateAll(nodes => {
    let up = 0, down = 0
    for (const node of nodes) {
      const canvas = node as HTMLCanvasElement, context = canvas.getContext('2d')
      if (!context || !canvas.width || !canvas.height) continue
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 180) continue
        if (Math.abs(data[i] - 46) < 3 && Math.abs(data[i + 1] - 189) < 3 && Math.abs(data[i + 2] - 133) < 3) up++
        if (Math.abs(data[i] - 240) < 3 && Math.abs(data[i + 1] - 86) < 3 && Math.abs(data[i + 2] - 106) < 3) down++
      }
    }
    return { up, down }
  })
  await frames(); expect(errors).toEqual([])
  await reveal(2)
  if (initial < 1000) {
    await expect.poll(async () => (await colors()).down).toBeGreaterThan(10)
    expect((await colors()).up).toBe(0)
  }
  await reveal(6)
  await expect.poll(async () => (await colors()).up).toBeGreaterThan(10)
  await expect.poll(async () => (await colors()).down).toBeGreaterThan(10)
  await page.screenshot({ path: info.outputPath('profit-crossing.png') })
  // Reset and hidden-to-visible resizing must not recreate the chart or throw.
  await reveal(1, true)
  await page.locator('#fixture').evaluate(node => { node.style.display = 'none' })
  await frames(); await reveal(2)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.locator('#fixture').evaluate(node => { node.style.display = '' })
  await frames(); await reveal(6)
  await expect.poll(async () => (await colors()).down).toBeGreaterThan(10)
  expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('profit-320.png') })
})
