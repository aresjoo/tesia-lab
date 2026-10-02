import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page, compact = false) {
  await page.route('**/delegation-chart-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0b0c0e"><div class="client-delegation" style="padding:14px;box-sizing:border-box"><div class="tfw-chart" id="fixture"></div></div></body></html>' }))
  await page.goto('/delegation-chart-test.html')
  await page.evaluate(async compact => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const componentPath = '/src/components/ClientDelegationChart.tsx', domPath = '/@id/react-dom/client', dataPath = '/src/client-terminal-source-fixture.ts'
    const source = await (await fetch(componentPath)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ reactPath), dm = await import(/* @vite-ignore */ domPath), component = await import(/* @vite-ignore */ componentPath), data = await import(/* @vite-ignore */ dataPath)
    for (const path of ['/node_modules/@fontsource-variable/geist/index.css', '/node_modules/@fontsource-variable/noto-sans-kr/index.css', '/src/client-delegation.css']) await import(/* @vite-ignore */ path)
    const react = rm.default ?? rm, seed = data.sourceTerminalSeeds[0]
    const state = { compact, evaluation: data.evaluateSourceTerminal(seed.parameters, seed.capital), interval: undefined as undefined | string }
    const root = (dm.createRoot ?? dm.default.createRoot)(document.getElementById('fixture'))
    const render = () => { document.getElementById('fixture')!.style.height = state.compact ? 'auto' : ''; root.render(react.createElement(component.ClientDelegationChart, { asset: '비트코인', ...state })) }
    Object.assign(window, { chartState: state, chartData: data, patchChart: (patch: object) => { Object.assign(state, patch); render() }, unmountChart: () => root.unmount() })
    render()
  }, compact)
  await expect(page.locator('.tf-source-price')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}
async function model(page: Page) { return page.evaluate(() => Reflect.get(window, 'chartState').evaluation) }

test('평가 구간의 모든 합성 일봉과 모든 실제 완료거래 진입/청산을 표시한다', async ({ page }) => {
  await mount(page)
  const evaluation = await model(page), { startI, endI } = evaluation.r.params
  await expect(page.locator('.client-delegation-source-chart')).toHaveAttribute('data-start-index', String(startI))
  await expect(page.locator('.tf-source-price')).toHaveAttribute('data-points', String(endI - startI + 1))
  await expect(page.locator('.tf-source-marker')).toHaveCount(evaluation.r.trades.length * 2)
  const expected = await page.evaluate(() => {
    const state = Reflect.get(window, 'chartState'), data = Reflect.get(window, 'chartData')
    return state.evaluation.r.trades.flatMap((trade: { entry: number; exit: number }) => [{ side: 'BUY', index: trade.entry, price: data.sourceTerminalPrices[trade.entry] }, { side: 'SELL', index: trade.exit, price: data.sourceTerminalPrices[trade.exit] }])
  })
  expect(await page.locator('.tf-source-marker').evaluateAll(nodes => nodes.map(node => ({ side: node.getAttribute('data-side'), index: Number(node.getAttribute('data-index')), price: Number(node.getAttribute('data-price')) })))).toEqual(expected)
  await expect(page.locator('.tf-chart-toolbar')).toContainText('원본 합성 일봉')
  await expect(page.locator('.tf-ohlc, svg > rect, .tf-candle, .tf-volume')).toHaveCount(0)
  await expect(page.locator('.tf-source-sr').first()).toContainText(`완료 거래 ${evaluation.r.n}회`)
})

test('주/월은 달력 마지막 공급 종가를 집계하며 마커 날짜와 원래 종가는 바뀌지 않는다', async ({ page }) => {
  await mount(page)
  const markers = await page.locator('.tf-source-marker').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-index')))
  for (const interval of ['1W', '1M', '1D']) {
    await page.getByRole('button', { name: interval, exact: true }).click()
    await expect(page.getByRole('button', { name: interval, exact: true })).toHaveAttribute('aria-pressed', 'true')
    const expectedCount = await page.evaluate(interval => {
      const { evaluation } = Reflect.get(window, 'chartState'), data = Reflect.get(window, 'chartData'), keys = new Set()
      for (let i = evaluation.r.params.startI; i <= evaluation.r.params.endI; i++) {
        const date = data.sourceTerminalDate(i)
        if (interval === '1W') date.setDate(date.getDate() - (date.getDay() + 6) % 7)
        keys.add(interval === '1D' ? i : interval === '1W' ? date.toDateString() : `${date.getFullYear()}-${date.getMonth()}`)
      }
      return keys.size
    }, interval)
    await expect(page.locator('.tf-source-price')).toHaveAttribute('data-points', String(expectedCount))
    expect(await page.locator('.tf-source-marker').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-index')))).toEqual(markers)
    // The extra weekly/monthly legend changes available plot height. Compare
    // source prices in CURRENT coordinates, not stale daily-view pixel geometry.
    if (interval !== '1D') {
      const expectedPath = await page.evaluate(() => {
        const { evaluation } = Reflect.get(window, 'chartState'), data = Reflect.get(window, 'chartData'), { startI, endI } = evaluation.r.params
        const indices = Array.from({ length: endI - startI + 1 }, (_, i) => startI + i), values = indices.map(i => data.sourceTerminalPrices[i])
        const min = Math.min(...values), max = Math.max(...values), padding = (max - min) * .12, lo = min - padding, hi = max + padding
        const box = document.querySelector('svg')!.viewBox.baseVal, right = box.width - 78, bottom = box.height - 35
        return indices.map((i, n) => `${n ? 'L' : 'M'}${(14 + (i - startI) / (endI - startI) * (right - 14)).toFixed(2)},${(bottom - (data.sourceTerminalPrices[i] - lo) / (hi - lo) * (bottom - 18)).toFixed(2)}`).join(' ')
      })
      await expect(page.locator('.tf-source-daily')).toHaveAttribute('d', expectedPath)
      expect(await page.locator('.tf-source-price').getAttribute('d')).not.toEqual(expectedPath)
    }
  }
})

test('보고서 compact도 같은 종가와 전체 거래를 사용하고 240px을 유지한다', async ({ page }) => {
  await mount(page, true)
  const evaluation = await model(page)
  await expect(page.locator('.tf-source-marker')).toHaveCount(evaluation.r.trades.length * 2)
  await expect(page.locator('.tf-source-price')).toHaveAttribute('data-points', String(evaluation.r.params.endI - evaluation.r.params.startI + 1))
  await expect(page.getByRole('button')).toHaveCount(0)
  expect((await page.locator('svg').boundingBox())!.height).toBe(240)
  await expect(page.locator('.tf-chart-caption')).toHaveText('과거 검증 구간의 매수(▲)와 매도(▼) 지점')
})

test('키보드·포인터는 실제 날짜와 종가를 조회하며 새 평가에 이전 선택을 남기지 않는다', async ({ page }) => {
  await mount(page)
  const svg = page.getByRole('img')
  await svg.focus(); await page.keyboard.press('Home')
  const expectedFirst = await page.evaluate(() => {
    const { evaluation } = Reflect.get(window, 'chartState'), data = Reflect.get(window, 'chartData'), i = evaluation.r.params.startI
    return data.sourceTerminalPrices[i].toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  })
  await expect(page.locator('.tf-source-readout b')).toHaveText(expectedFirst)
  await page.keyboard.press('End'); await page.keyboard.press('ArrowLeft')
  const text = await page.locator('.tf-source-readout').innerText()
  await page.keyboard.press('ArrowRight'); expect(await page.locator('.tf-source-readout').innerText()).not.toEqual(text)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'chartData')
    Reflect.get(window, 'patchChart')({ evaluation: data.evaluateSourceTerminal({ ...data.sourceTerminalSeeds[0].parameters, startI: 100, endI: 200 }, 1000) })
  })
  await expect(page.locator('.tf-source-price')).toHaveAttribute('data-points', '101')
  const expectedLast = await page.evaluate(() => Reflect.get(window, 'chartData').sourceTerminalPrices[200].toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }))
  await expect(page.locator('.tf-source-readout b')).toHaveText(expectedLast)
  await expect(page.locator('.tf-source-crosshair')).toHaveCount(0)
})

test('거래 없는 한 봉·유효하지 않은 구간에 가짜 거래나 NaN 좌표를 만들지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'chartData')
    Reflect.get(window, 'patchChart')({ evaluation: data.evaluateSourceTerminal({ ...data.sourceTerminalSeeds[0].parameters, startI: 100, endI: 100 }, 1000) })
  })
  await expect(page.locator('.tf-source-price')).toHaveAttribute('data-points', '1')
  await expect(page.locator('.tf-source-marker')).toHaveCount(0)
  await expect(page.locator('.tf-source-date')).toHaveCount(1)
  expect(await page.locator('svg').innerHTML()).not.toMatch(/NaN|Infinity/)
  await page.evaluate(() => {
    const { evaluation } = Reflect.get(window, 'chartState')
    Reflect.get(window, 'patchChart')({ evaluation: { ...evaluation, r: { ...evaluation.r, params: { ...evaluation.r.params, startI: -1 } } } })
  })
  await expect(page.getByText('검증 구간을 표시할 수 없어요.')).toBeVisible()
  await expect(page.locator('svg')).toHaveCount(0)
})

for (const width of [320, 390, 1280]) test(`${width}px 축·헤더·캡션이 잘리거나 겹치지 않고 글자는 11px 이상이다`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); await mount(page)
  await page.getByRole('button', { name: '1M', exact: true }).click()
  await page.waitForTimeout(200)
  const layout = await page.evaluate(() => {
    const host = document.querySelector('.client-delegation-source-chart')!, svg = host.querySelector('svg')!, caption = host.querySelector('.tf-chart-caption')!
    const dates = [...host.querySelectorAll('.tf-source-date')].map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height } })
    const s = svg.getBoundingClientRect(), h = host.getBoundingClientRect(), c = caption.getBoundingClientRect()
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, dates, svg: { bottom: s.bottom, top: s.top }, host: { bottom: h.bottom, left: h.left, right: h.right }, caption: { top: c.top, bottom: c.bottom } }
  })
  expect(layout.overflow).toBeLessThanOrEqual(1)
  for (const date of layout.dates) { expect(date.left).toBeGreaterThanOrEqual(layout.host.left - 1); expect(date.right).toBeLessThanOrEqual(layout.host.right + 1); expect(date.height).toBeGreaterThanOrEqual(10); expect(date.bottom).toBeLessThanOrEqual(layout.caption.top + 1) }
  for (let i = 1; i < layout.dates.length; i++) expect(layout.dates[i].left).toBeGreaterThan(layout.dates[i - 1].right)
  expect(layout.caption.bottom).toBeLessThanOrEqual(layout.host.bottom + 1)
  await page.waitForTimeout(1900)
  await page.screenshot({ path: testInfo.outputPath(`chart-${width}.png`) })
})

test('모션 최소화에서 곡선과 마커는 즉시 표시되고 언마운트 후 오류가 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  expect(await page.locator('.tf-source-reveal').evaluate(node => getComputedStyle(node).animationName)).toBe('none')
  expect(await page.locator('.tf-source-marker').first().evaluate(node => getComputedStyle(node).opacity)).toBe('1')
  await page.evaluate(() => Reflect.get(window, 'unmountChart')())
  await page.setViewportSize({ width: 600, height: 700 })
  expect(errors).toEqual([])
})

test('거래일과 거래 없는 날을 조회해도 차트 높이와 축 위치는 흔들리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await mount(page)
  const svg = page.getByRole('img'), evaluation = await model(page)
  await svg.focus(); await page.keyboard.press('Home')
  await page.waitForTimeout(100)
  const before = await svg.boundingBox()
  const distance = evaluation.r.trades[0].exit - evaluation.r.params.startI
  for (let i = 0; i < distance; i++) await page.keyboard.press('ArrowRight')
  await expect(page.locator('.tf-source-tradeinfo')).toContainText('매도')
  await page.waitForTimeout(100)
  const after = await svg.boundingBox()
  expect(after!.y).toBeCloseTo(before!.y, 0)
  expect(after!.height).toBeCloseTo(before!.height, 0)
})

test('모션은 가격선 길이가 아닌 시간축을 따라 공개하고 원본 거래별 등장시점을 유지한다', async ({ page }) => {
  await mount(page)
  const evaluation = await model(page)
  const progression = await page.locator('.tf-source-reveal').evaluate(node => {
    const animation = node.getAnimations()[0]
    if (!animation) throw new Error('Missing time-axis animation')
    animation.pause(); animation.currentTime = 750
    return { actual: parseFloat(getComputedStyle(node).width), full: Number(node.getAttribute('width')) }
  })
  expect(progression.actual).toBeCloseTo(progression.full / 2, 0)
  const expectedDelays = evaluation.r.trades.flatMap((trade: { entry: number; exit: number }, ordinal: number) => [trade.entry, trade.exit].map(index => Math.max((index - evaluation.r.params.startI) / (evaluation.r.params.endI - evaluation.r.params.startI) * 1500, (ordinal + 1) / evaluation.r.trades.length / 1.15 * 1800)))
  const delays = await page.locator('.tf-source-marker').evaluateAll(nodes => nodes.map(node => parseFloat((node as SVGElement).style.getPropertyValue('--marker-delay'))))
  expect(delays).toEqual(expectedDelays)
})

test('고밀도 보고서는 원본 최근40거래, 전체 검증 차트는 전체 계산 거래를 표시한다', async ({ page }) => {
  await mount(page, true)
  await page.evaluate(() => {
    const data = Reflect.get(window, 'chartData')
    Reflect.get(window, 'patchChart')({ evaluation: data.evaluateSourceTerminal({ sl: -1, tp: 1, rsiTh: 100, trendFilter: false, startI: 61, endI: 1334 }, 1000) })
  })
  const evaluation = await model(page)
  expect(evaluation.r.trades.length).toBeGreaterThan(40)
  await expect(page.locator('.tf-source-marker')).toHaveCount(80)
  await expect(page.locator('.tf-source-marker').first()).toHaveAttribute('data-index', String(evaluation.r.trades.at(-40).entry))
  await expect(page.locator('.tf-chart-caption')).toContainText('최근 40회 거래 표시')
  await page.evaluate(() => Reflect.get(window, 'patchChart')({ compact: false }))
  await expect(page.locator('.tf-source-marker')).toHaveCount(evaluation.r.trades.length * 2)
  await expect(page.locator('.tf-source-marker').first()).toHaveAttribute('data-index', String(evaluation.r.trades[0].entry))
})
