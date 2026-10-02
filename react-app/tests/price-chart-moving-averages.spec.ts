import { expect, test, type Page } from '@playwright/test'
import { chartSma, movingAveragePeriods, studyLineData } from '../src/chart/price-chart-studies'
import { fixture } from '../src/dev/chart-workspace-fixture'
import { professionalChartLocale } from '../src/client-professional-chart-locale'
import type { ClientLanguage } from '../src/client-preferences'

for (const period of movingAveragePeriods) test(`MA${period}는 전체 준비기간·독립 산술 검산·시간 공백·미래 봉 불참을 보장한다`, () => {
  const before = structuredClone(fixture.bars)
  const values = chartSma(fixture.bars, period, 60)
  expect(values.slice(0, period - 1).every(point => point.value === undefined)).toBe(true)
  expect(values[period - 1].value).toBeCloseTo(102 + (period - 1) / 2, 10)
  expect(values.at(-1)!.value).toBeCloseTo(221 - (period - 1) / 2, 10)
  for (let i = period; i <= fixture.bars.length; i++) expect(chartSma(fixture.bars.slice(0, i), period, 60)).toEqual(values.slice(0, i))
  const gap = [...fixture.bars, ...fixture.bars.map(bar => ({ ...bar, time: bar.time + 121 * 60 }))]
  const reset = chartSma(gap, period, 60)
  expect(reset.slice(120, 120 + period - 1).every(point => point.value === undefined)).toBe(true)
  expect(reset[120 + period - 1].value).toBeCloseTo(values[period - 1].value!, 10)
  expect(studyLineData(reset, 60)[119]).toEqual({ ...reset[119], color: 'transparent' })
  const large = Array.from({ length: 5000 }, (_, i) => ({ ...fixture.bars[0], time: 1700000000 + i * 60, close: i < period ? 1.7e308 : 1e-12 }))
  const stable = chartSma(large, period, 60)
  expect(stable.slice(period - 1).every(point => Number.isFinite(point.value) && point.value! > 0)).toBe(true)
  expect(stable[period - 1].value).toBe(1.7e308)
  expect(stable[period * 2 - 1].value).toBe(1e-12)
  expect(chartSma([], period, 60)).toEqual([])
  expect(fixture.bars).toEqual(before)
})

async function mount(page: Page, variant: 'analysis' | 'market' = 'analysis') {
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', async route => {
    const response = await route.fetch(), body = await response.text()
    expect(body).toContain('api.current = chart;')
    await route.fulfill({ response, body: body.replace('api.current = chart;', `api.current = chart;
      window.__maChart = chart;
      window.__maSeries = new Map();
      const maAdd = chart.addSeries.bind(chart);
      chart.addSeries = (...args) => { const s = maAdd(...args); window.__maSeries.set(s.options().title, s); return s; };`) })
  })
  await page.goto('/')
  await page.evaluate(async ({ view, variant }) => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const module = await import(/* @vite-ignore */ path)
    Object.assign(window, { maHost: module.mount(view, 'ma-test-lifetime', variant) })
  }, { view: fixture, variant })
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
}

test('시장 MA 기본 표시·선택·7언어·기간 교체는 같은 renderer와 실제 봉의 평균을 유지한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, 'market')
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  const calls: string[] = []; page.on('request', req => { if (/\/api\/|binance|coingecko/.test(req.url())) calls.push(req.url()) })
  for (const [period, value] of [[7, 218], [25, 209], [99, 172]]) {
    await expect(page.getByRole('button', { name: `MA ${period}`, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(`[data-study=ma${period}]`)).toHaveText(value.toFixed(2))
    expect(await page.evaluate(period => Reflect.get(window, '__maSeries').get(`MA ${period}`).options().visible, period)).toBe(true)
  }
  const surface = page.locator('.cp-surface')
  await surface.press('Home')
  await expect(page.locator('[data-study=ma7]')).toHaveText('계산값 없음')
  await surface.press('Shift+ArrowRight')
  await expect(page.locator('[data-study=ma7]')).toHaveText('109.00')
  for (const language of ['ko','en','ja','zh-CN','zh-TW','es','fr'] as ClientLanguage[]) {
    await page.evaluate(async language => { const path = '/src/client-preferences.ts'; const m = await import(/* @vite-ignore */ path); m.setClientPreference('language', language); m.setClientPreference('currency', 'EUR') }, language)
    const format = professionalChartLocale(language)
    await expect(page.getByRole('group', { name: format.t('movingAverages'), exact: true })).toBeVisible()
    await expect(page.locator('[data-study=ma7]')).toHaveText(format.axisPrice(2)(109))
    await expect(page.locator('.cp-note')).toContainText(format.t('maNote'))
  }
  await page.getByRole('button', { name: 'MA 25', exact: true }).click()
  expect(await page.evaluate(() => Reflect.get(window, '__maSeries').get('MA 25').options().visible)).toBe(false)
  await expect(page.locator('[data-study=ma25]')).toHaveCount(0)
  // A replacement resolution supplies different actual candles, not relabelled 1m bars.
  const next = { ...fixture, identity: 'MA_SUPPLIED_4H', resolutionSeconds: 14400, fills: [], bars: fixture.bars.map((bar, i) => ({ ...bar, time: fixture.bars[0].time + i * 14400, open: bar.open * 2, high: bar.high * 2, low: bar.low * 2, close: bar.close * 2 })) }
  await page.evaluate(view => Reflect.get(window, 'maHost').render(view), next)
  await expect(page.locator('[data-study=ma7]')).toHaveText('436,00')
  await expect(page.locator('[data-study=ma99]')).toHaveText('344,00')
  await expect(page.getByRole('button', { name: 'MA 25', exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
  expect(calls).toEqual([]); expect(errors).toEqual([])
})

for (const end of ['skip', 'complete'] as const) test(`백테스트 MA 재생은 미래값 없이 캔들과 동기화되고 ${end} 후 전체로 복귀한다`, async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await mount(page)
  for (const period of movingAveragePeriods) await page.getByRole('button', { name: `MA ${period}`, exact: true }).click()
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.locator('[data-study=ma7]')).toHaveText('계산값 없음')
  await page.clock.runFor(15000)
  const observed = await page.evaluate(() => {
    const rows = Reflect.get(window, '__maSeries')
    return { candles: rows.get('').data(), ma7: rows.get('MA 7').data(), ma25: rows.get('MA 25').data(), ma99: rows.get('MA 99').data() }
  })
  const count = observed.candles.length
  expect(count).toBeGreaterThan(25); expect(count).toBeLessThan(99)
  // LWC's public data() omits whitespace warmup, unlike our candle-aligned input.
  for (const period of movingAveragePeriods) {
    const values = observed[`ma${period}`]
    expect(values).toHaveLength(Math.max(0, count - period + 1))
    if (values.length) expect(values.at(-1).time).toBe(observed.candles.at(-1).time)
  }
  await expect(page.locator('[data-study=ma7]')).toHaveText((102 + count - 1 - 3).toFixed(2))
  await expect(page.locator('[data-study=ma99]')).toHaveText('계산값 없음')
  await expect(page.getByRole('button', { name: 'MA 7', exact: true })).toBeDisabled()
  if (end === 'skip') await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  else await page.clock.runFor(60000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('[data-study=ma99]')).toHaveText('172.00')
  expect(await page.evaluate(() => Reflect.get(window, '__maSeries').get('MA 99').data().length)).toBe(22)
  expect(await canvas!.evaluate(node => node === document.querySelector('.cp-surface canvas'))).toBe(true)
})

for (const variant of ['analysis','market'] as const) test(`${variant} MA 조작부·숫자는 좁은320px 프랑스어 두배글자에서도 접근 가능하다`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await mount(page, variant)
  if (variant === 'analysis') for (const period of movingAveragePeriods) await page.getByRole('button', { name: `MA ${period}`, exact: true }).click()
  await page.evaluate(async () => { const path = '/src/client-preferences.ts'; const m = await import(/* @vite-ignore */ path); m.setClientPreference('language', 'fr') })
  await page.addStyleTag({ content: '.cp-chart {font-size:26px} .cp-studies,.cp-note {font-size:24px}' })
  await expect(page.getByRole('group', { name: 'Moyennes mobiles simples', exact: true })).toBeVisible()
  for (const node of await page.locator('.cp-ma-controls button, .cp-studies>div').all()) {
    // Market has the original horizontally scrollable tool/readout strips.
    await node.evaluate(el => el.scrollIntoView({ block: 'nearest', inline: 'center' }))
    expect(await node.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    const r = await node.boundingBox(); expect(r!.x).toBeGreaterThanOrEqual(0); expect(r!.x + r!.width).toBeLessThanOrEqual(320)
  }
  expect(await page.locator('.cp-chart').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('ma-mobile-fr200.png'), fullPage: true })
})
