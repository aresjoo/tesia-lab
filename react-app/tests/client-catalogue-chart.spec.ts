import { expect, test, type Locator } from '@playwright/test'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { catalogueStrategies, catalogueSourceSha } from '../src/client-catalogue'
import { loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueChartSeries, catalogueChartTicks } from '../src/client-catalogue-chart'
import type { CataloguePreviewResult } from '../src/client-catalogue-preview'
import reference from './fixtures/catalogue-chart-runtime.json' with { type: 'json' }
import copy from '../src/client-catalogue-chart-copy.json' with { type: 'json' }
import common from '../src/client-catalogue-ui-copy.json' with { type: 'json' }
import { sharedPercent } from '../src/client-shared-number-format'

test.setTimeout(40_000)
// Dev module-worker transformation is harness readiness, not preview progress.
// Await its response once per worker before the 40s UI interaction/capture test;
// no data, result, account or rendering state is supplied by this preparation.
test.beforeAll(async ({ request }) => {
  const response = await request.get('/src/client-catalogue-worker.ts?worker_file&type=module')
  expect(response.ok()).toBe(true)
})
async function envelope(id = 'f1'): Promise<CataloguePreviewResult> {
  const data = await loadCatalogueMarketData(), strategy = catalogueStrategies.find(s => s.id === id)!
  return { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, strategy, period: 'all', calculation: 'full-run', contextPeriod: 'selected', calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v }, result: strategy.fut ? runCatalogueFuturesPreview(strategy, data) : runCatalogueSpotPreview(strategy, data) }
}

async function expectProfitPaint(chart: Locator, values: number[], flat: boolean, mode: 'ret' | 'pnl' | 'bal') {
  const base = mode === 'bal' ? 1000 : 0, ticks = catalogueChartTicks(Math.min(base, ...values), Math.max(base, ...values))
  const drawing = await chart.evaluate(element => {
    const svg = element.querySelector('svg')!, baseline = svg.querySelector('.catalogue-baseline')!, gradient = svg.querySelector('linearGradient[id$="-line"]')!, line = svg.querySelector('.catalogue-equity-line')!, fill = svg.querySelector('.catalogue-equity-fill')!
    return {
      baselineCount: svg.querySelectorAll('.catalogue-baseline').length,
      baseline: Number(baseline.getAttribute('y1')), left: Number(baseline.getAttribute('x1')), right: Number(baseline.getAttribute('x2')),
      top: Number(gradient.getAttribute('y1')), bottom: Number(gradient.getAttribute('y2')),
      stops: Array.from(gradient.querySelectorAll('stop'), stop => ({ color: stop.getAttribute('stop-color'), offset: Number(stop.getAttribute('offset')) })),
      opacity: Array.from(svg.querySelectorAll('linearGradient[id$="-fill"] stop'), stop => Number(stop.getAttribute('stop-opacity'))),
      path: line.getAttribute('d')!, area: fill.getAttribute('d'), fillDisplay: getComputedStyle(fill).display,
      stroke: getComputedStyle(line).stroke, gradientId: gradient.id,
    }
  })
  const neutral = flat && Math.abs(values[0] - base) < 1e-9, gain = neutral ? '#8b9096' : '#2ebd85', loss = neutral ? '#8b9096' : '#f0566a'
  expect(drawing.stops.map(s => s.color)).toEqual([gain, gain, loss, loss])
  expect(drawing.opacity).toEqual([.30, .02, .02, .30])
  expect(drawing.baselineCount).toBe(1)
  expect(drawing.baseline).toBeCloseTo(drawing.top + (1 - (base - ticks[0]) / (ticks.at(-1)! - ticks[0])) * (drawing.bottom - drawing.top), 5)
  expect(drawing.top + drawing.stops[1].offset * (drawing.bottom - drawing.top)).toBeCloseTo(drawing.baseline, 5)
  expect(drawing.stops[1].offset).toBe(drawing.stops[2].offset)
  expect(drawing.stroke).toContain(`#${drawing.gradientId}`)
  expect(drawing.fillDisplay).not.toBe('none')
  expect(drawing.area).toBe(`${drawing.path} L${drawing.right.toFixed(1)} ${drawing.baseline.toFixed(1)} L${drawing.left.toFixed(1)} ${drawing.baseline.toFixed(1)} Z`)
  // Read the cubic endpoints, not its control points: every observation is unchanged.
  const endpoints = [drawing.path.split(' C')[0].slice(1).split(' ').map(Number), ...drawing.path.split(' C').slice(1).map(segment => segment.split(' ').slice(-2).map(Number))]
  expect(endpoints).toHaveLength(values.length)
  // Preserve toBeCloseTo(..., 1)'s strict 0.05 tolerance for EVERY endpoint.
  // One aggregate assertion avoids thousands of trace steps consuming the
  // browser interaction budget during the full cold parallel run.
  const displaced = values.flatMap((value, index) => {
    const expected = drawing.top + (1 - (value - ticks[0]) / (ticks.at(-1)! - ticks[0])) * (drawing.bottom - drawing.top)
    return Math.abs(endpoints[index][1] - expected) < .05 ? [] : [{ index, actual: endpoints[index][1], expected }]
  })
  expect(displaced).toEqual([])
}

test('31종×5기간×3모드×2간격은 원본 최종 mkdSeries와 동일한 날짜·값을 보존한다', async () => {
  expect(reference.sha).toBe(catalogueSourceSha)
  expect(createHash('sha256').update(reference.code).digest('hex')).toBe(reference.codeSha256)
  const context = vm.createContext({ mkdDate: (index: number) => new Date(Date.UTC(2023, 0, 1 + index)).toISOString().slice(0, 10) })
  vm.runInContext(reference.code, context)
  for (const strategy of catalogueStrategies) {
    const value = await envelope(strategy.id), before = JSON.stringify(value)
    for (const days of [7, 30, 90, 365, 0]) for (const mode of ['ret', 'pnl', 'bal'] as const) for (const interval of ['day', 'month'] as const) {
      context.MKD = { eq: value.result.eq, per: days, tab: mode, gran: interval }
      const expected = vm.runInContext('mkdSeries()', context, { timeout: 1000 }) as { d: string; y: number }[]
      const series = catalogueChartSeries(value, days, mode, interval)!
      expect(series, `${strategy.id}/${days}/${mode}/${interval}, first=${value.result.eq[0]?.v}, window=${value.result.eq.at(-(days + 1))?.v}, length=${value.result.eq.length}`).not.toBeNull()
      expect(series.points).toHaveLength(expected.length)
      expect(series.points.map(p => p.date)).toEqual(Array.from(expected, p => p.d))
      expect(series.points.filter((p, i) => Math.abs(p.value - expected[i].y) >= 1e-8), `${strategy.id}/${days}/${mode}/${interval}`).toEqual([])
      const ys = expected.map(p => p.y), base = mode === 'bal' ? 1000 : 0
      context.lo = Math.min(base, ...ys); context.hi = Math.max(base, ...ys)
      // The original additive loop can produce -0; both render as the baseline.
      expect(catalogueChartTicks(context.lo, context.hi).map(v => v === 0 ? 0 : v)).toEqual(Array.from(vm.runInContext('mkdTicks(lo,hi,5)', context, { timeout: 1000 }), v => v === 0 ? 0 : v))
    }
    expect(JSON.stringify(value)).toBe(before)
  }
})

test('시작일·월말·윤일·전액 손실·전체 초기 수수료·잘못된 입력은 서로 혼동하지 않는다', async () => {
  const value = await envelope(), original = value.result
  value.calendar = { start: '2024-02-27', asof: '2024-03-05' }
  value.result = { ...original, params: { ...original.params, startI: 0, endI: 7 }, eq: [.99, 1, 1.1, 1.2, 1.3, 1.1, .5, 0].map((v, i) => ({ i, v })) }
  const whole = catalogueChartSeries(value, 0, 'bal', 'day')!
  expect(whole.points[0].value).toBe(990)
  expect(whole.points[2].date).toBe('2024-02-29')
  expect(whole.points.at(-1)?.value).toBe(0)
  const monthly = catalogueChartSeries(value, 7, 'ret', 'month')!
  expect(monthly.points.map(p => p.date)).toEqual(['2024-02-27', '2024-02-29', '2024-03-05'])
  expect(monthly.points[0].value).toBe(0); expect(monthly.points.at(-1)?.value).toBe(-100)
  value.result.eq = value.result.eq.map(p => ({ ...p, v: 0 }))
  expect(catalogueChartSeries(value, 7, 'ret', 'day')).toBeNull()
  for (const [min, max] of [[NaN, 1], [0, Infinity], [2, 1], [-1e308, 1e308]]) expect(catalogueChartTicks(min, max)).toEqual([])
  expect(catalogueChartTicks(1000, 1000)).toEqual([990, 1000, 1010])
})

for (const width of [320, 768, 1440]) for (const days of [30, 7, 90, 365, 0]) test(`${width}px ${days}일 원본 3모드·일월·키보드·터치·탭 복귀`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1100 }); await page.emulateMedia({ reducedMotion: 'reduce' }); page.setDefaultTimeout(12_000)
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/#/share/s/f1')
  const chart = page.locator('.catalogue-overview-chart'), svg = chart.locator('svg'), modes = page.getByRole('group', { name: '그래프 종류', exact: true })
  await expect(chart).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  const value = await envelope(), n = await page.locator('[data-catalogue-metric="n"] b').innerText()
    await page.getByLabel('기간 선택', { exact: true }).selectOption(String(days))
    for (const [mode, label] of [['ret', '수익률'], ['pnl', '수익금'], ['bal', '잔고']] as const) {
      await modes.getByRole('button', { name: label, exact: true }).click()
      await modes.getByRole('button', { name: label, exact: true }).press('Escape')
      await expect(modes.getByRole('tooltip')).toHaveCount(0)
      for (const [interval, label] of [['day', '일별'], ['month', '월별']] as const) {
        await page.getByRole('button', { name: label, exact: true }).click()
        const series = catalogueChartSeries(value, days, mode, interval)!
        await expect(chart).toHaveAttribute('data-point-count', String(series.points.length))
        await expectProfitPaint(chart, series.points.map(p => p.value), series.flat, mode)
        await svg.focus(); await svg.press('End')
        const last = series.points.at(-1)!
        const formatted = mode === 'ret' ? sharedPercent(last.value, 'ko') : new Intl.NumberFormat('ko', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 0, signDisplay: mode === 'pnl' ? 'exceptZero' : 'auto' }).format(last.value)
        await expect(chart.getByRole('tooltip')).toContainText(formatted)
        await expect(chart.locator('[data-selected-index]')).toHaveAttribute('data-selected-index', String(last.i))
        await svg.press('Home'); await expect(chart.locator('[data-selected-index]')).toHaveAttribute('data-selected-index', String(series.points[0].i))
        await svg.press('ArrowRight'); await expect(chart.locator('[data-selected-index]')).toHaveAttribute('data-selected-index', String(series.points[1].i))
        const bounds = await chart.getByRole('tooltip').boundingBox(), outer = await chart.boundingBox()
        expect(bounds!.x).toBeGreaterThanOrEqual(outer!.x - 1); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 1)
      }
    }
    await expect(page.locator('[data-catalogue-metric="n"] b')).toHaveText(n)
  await page.getByRole('tab', { name: '전략 정보', exact: true }).click()
  await page.getByRole('tab', { name: '개요', exact: true }).click()
  await expect(chart).toHaveAttribute('data-chart-mode', 'bal'); await expect(chart).toHaveAttribute('data-chart-interval', 'month')
  await svg.scrollIntoViewIfNeeded()
  const box = (await svg.boundingBox())!
  await svg.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: box.x + box.width - 2, clientY: box.y + box.height / 2 })
  await expect(chart.getByRole('tooltip')).toBeVisible()
  await svg.press('Escape'); await expect(chart.getByRole('tooltip')).toHaveCount(0)
  await page.locator('.catalogue-chart-hint').click()
  await svg.click({ position: { x: box.width / 2, y: box.height / 2 } })
  expect(Number(await chart.locator('[data-selected-index]').getAttribute('data-selected-index'))).toBeLessThan(value.result.params.endI)
  if (info.project.name === 'mobile') {
    const balance = modes.getByRole('button', { name: '잔고', exact: true })
    await balance.tap(); await expect(modes.getByRole('tooltip')).toBeVisible()
    await balance.tap(); await expect(modes.getByRole('tooltip')).toHaveCount(0)
    // An informational overlay must not consume the adjacent control's tap.
    await balance.tap(); await page.getByRole('button', { name: '일별', exact: true }).tap(); await expect(modes.getByRole('tooltip')).toHaveCount(0)
  }
  await expect(chart.locator('.catalogue-equity-line')).toHaveCSS('stroke', /url\(/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  if (days === 0) await page.locator('.catalogue-performance').screenshot({ path: info.outputPath(`overview-${width}.png`), animations: 'disabled' })
  expect(errors).toEqual([])
})

// The matrix above is split by period so cold full-suite contention does not
// combine thirty UI journeys and captures into a single 40s deadline. Keep the
// original sequential period switching and stable chart/metrics separately.
for (const width of [320, 768, 1440]) test(`${width}px 다섯기간 연속왕복은 차트·지표·모드·간격을 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 }); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/share/s/f1')
  const chart=page.locator('.catalogue-overview-chart'),value=await envelope()
  await expect(chart).toBeVisible()
  const metric=await page.locator('[data-catalogue-metric="n"] b').innerText()
  await page.getByRole('group',{name:'그래프 종류',exact:true}).getByRole('button',{name:'잔고',exact:true}).click()
  await page.getByRole('button',{name:'월별',exact:true}).click()
  for(const days of [30,7,90,365,0]){
    await page.getByLabel('기간 선택',{exact:true}).selectOption(String(days))
    await expect(chart).toHaveAttribute('data-point-count',String(catalogueChartSeries(value,days,'bal','month')!.points.length))
    await expect(chart).toHaveAttribute('data-chart-mode','bal');await expect(chart).toHaveAttribute('data-chart-interval','month')
    await expect(page.locator('[data-catalogue-metric="n"] b')).toHaveText(metric)
    const series=catalogueChartSeries(value,days,'bal','month')!
    await expectProfitPaint(chart,series.points.map(point=>point.value),series.flat,'bal')
  }
})

test('기준선 교차·평탄·시작 비용·손실종료·큰 잔고도 원본 값과 두색 구분을 보존한다', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/catalogue-paint-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#171717;color:#ececec"><main id="fixture"></main></body></html>' }))
  await page.goto('/catalogue-paint-test.html')
  await page.evaluate(async () => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const css = '/src/client-catalogue.css'; await import(/* @vite-ignore */ css)
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable",sans-serif'
    await document.fonts.load('12px "Noto Sans KR Variable"', '잔고 이 기간에는 변화가 없습니다')
    await document.fonts.ready
    const componentPath = '/src/components/ClientCatalogueChart.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(componentPath)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw Error('Missing Vite React instance')
    const rm = await import(/* @vite-ignore */ reactPath), react = rm.default ?? rm, dom = await import(/* @vite-ignore */ domPath), component = await import(/* @vite-ignore */ componentPath)
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { renderCataloguePaint: (value: CataloguePreviewResult, mode: 'ret' | 'pnl' | 'bal') => root.render(react.createElement('div', {}, ...[0, 1].map(key => react.createElement(component.ClientCatalogueChart, { key, value, days: 0, mode, interval: 'day' })))) })
  })
  const original = await envelope(), unchanged = JSON.stringify(original)
  for (const values of [[1, 1], [.9, .9], [1.1, 1.1], [1, 1.2, .8, 1.1], [1, 1.2, .8, .9], [1, 200, 50, 300]]) {
    const value = { ...original, calendar: { start: '2024-01-01', asof: '2024-01-04' }, result: { ...original.result, params: { ...original.result.params, startI: 0, endI: values.length - 1 }, eq: values.map((v, i) => ({ i, v })) } }
    for (const mode of ['ret', 'pnl', 'bal'] as const) {
      await page.evaluate(({ value, mode }) => (window as unknown as { renderCataloguePaint: (value: CataloguePreviewResult, mode: 'ret' | 'pnl' | 'bal') => void }).renderCataloguePaint(value, mode), { value, mode })
      const charts = page.locator('.catalogue-overview-chart'), chart = charts.first(), series = catalogueChartSeries(value, 0, mode, 'day')!
      await expect(charts).toHaveCount(2)
      await expect(chart).toHaveAttribute('data-chart-mode', mode)
      await expect.poll(() => chart.getAttribute('data-point-count')).toBe(String(values.length))
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(chart.locator('svg')).toHaveAttribute('viewBox', `0 0 ${width} ${width === 320 ? 236 : 280}`)
        await expectProfitPaint(chart, series.points.map(p => p.value), series.flat, mode)
        if (values.length === 4 && values[1] === 1.2) {
          await chart.locator('svg').focus(); await chart.locator('svg').press('Home'); await chart.locator('svg').press('ArrowRight')
          const selected = (await chart.locator('.catalogue-selected').boundingBox())!, tooltip = (await chart.getByRole('tooltip').boundingBox())!
          expect(tooltip.y + tooltip.height <= selected.y || tooltip.y >= selected.y + selected.height).toBe(true)
        }
      }
      const ids = await page.locator('svg [id]').evaluateAll(nodes => nodes.map(node => node.id))
      expect(new Set(ids).size).toBe(ids.length)
      await chart.locator('svg').focus(); await chart.locator('svg').press('End')
      await expect(chart.getByRole('tooltip')).toBeVisible()
      await expect(chart.getByRole('tooltip')).toHaveCSS('background-color', 'rgb(75, 82, 93)')
      if (values.length === 2 && values[0] === 1) {
        await expect(chart.locator('.catalogue-flat')).toBeVisible()
        await expect(chart.locator('.catalogue-flat')).toHaveCSS('left', `${await chart.locator('.catalogue-baseline').getAttribute('x1')}px`)
      }
    }
    await page.locator('.catalogue-overview-chart').first().screenshot({ path: info.outputPath(`profit-${values.join('_')}.png`) })
  }
  expect(JSON.stringify(original)).toBe(unchanged)
  expect(errors).toEqual([])
})

test('320px 7언어 조작부와 설명은 잘리지 않고 기간·모드 변경은 언어를 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1000 }); await page.goto('/#/share/s/f1')
  await expect(page.locator('.catalogue-overview-chart')).toBeVisible()
  for (const language of Object.keys(copy) as (keyof typeof copy)[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; (await import(path)).setClientPreference('language', language) }, language)
    const group = page.getByRole('group', { name: copy[language].chartType, exact: true })
    for (const label of [common[language].return, copy[language].profit, copy[language].balance]) {
      const button = group.getByRole('button', { name: label, exact: true })
      await button.focus(); await button.press('Enter')
      const tip = group.getByRole('tooltip'); await expect(tip).toBeVisible()
      const bounds = (await tip.boundingBox())!; expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(321)
      await button.press('Escape'); await expect(tip).toHaveCount(0)
    }
    await page.getByRole('button', { name: copy[language].monthly, exact: true }).click()
    await page.getByLabel(common[language].period, { exact: true }).selectOption('365')
    for (const button of await page.locator('.catalogue-chart-interval button').all()) {
      const lines = await button.evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); return r.getClientRects().length })
      expect(lines).toBe(1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
})

test('원본 0.9초 1회 펼침은 표시만 바꾸고 모션 감소에서는 즉시 전체를 보여준다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.goto('/#/share/s/f1')
  const rect = page.locator('.catalogue-overview-chart .rvl')
  await expect(rect).toBeAttached()
  const evidence = await rect.evaluate(el => {
    const animation = el.getAnimations()[0]
    if (!animation) throw Error('Missing reveal')
    const timing = animation.effect!.getTiming()
    animation.pause(); animation.currentTime = 450
    const midway = new DOMMatrix(getComputedStyle(el).transform).a
    animation.finish()
    return { duration: timing.duration, iterations: timing.iterations, midway, end: new DOMMatrix(getComputedStyle(el).transform).a }
  })
  expect(evidence.duration).toBe(900); expect(evidence.iterations).toBe(1)
  expect(evidence.midway).toBeGreaterThan(0); expect(evidence.midway).toBeLessThan(1); expect(evidence.end).toBe(1)
  const before = await page.locator('.catalogue-equity-line').getAttribute('d')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(rect).toHaveCSS('animation-name', 'none'); await expect(rect).toHaveCSS('transform', 'none')
  expect(await page.locator('.catalogue-equity-line').getAttribute('d')).toBe(before)
})
