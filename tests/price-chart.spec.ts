import { expect, test, type Page } from '@playwright/test'
import { chartEma, containingBar, equalPriceViews, priceChartIssue, priceMarkerGroups, priceResolutionLabel, visiblePriceMarkers, type PriceChartView } from '../src/chart/price-chart-view'

import { base, fixture } from '../src/dev/chart-workspace-fixture'

async function mount(page: Page, view: PriceChartView | null = fixture) {
  await page.goto('/')
  await page.evaluate(async data => {
    const path = '/tests/fixtures/price-chart-host.tsx'
    const module = await import(/* @vite-ignore */ path)
    Object.assign(window, { priceChartHost: module.mount(data) })
  }, view)
}

test('표시 입력 경계: 순서·OHLC·시간·중복·페이지 상한 거절', () => {
  expect(priceChartIssue(fixture)).toBeNull()
  expect(equalPriceViews(fixture, structuredClone(fixture))).toBe(true)
  expect(equalPriceViews(fixture, { ...fixture, fills: [] })).toBe(false)
  expect([1, 60, 90, 7200, 86400].map(priceResolutionLabel)).toEqual(['1초', '1분', '90초', '2시간', '1일'])
  for (const patch of [
    { bars: [] }, { bars: [...fixture.bars].reverse() },
    { bars: [{ ...fixture.bars[0], high: 1 }] },
    { bars: [{ ...fixture.bars[0], time: Number.MAX_SAFE_INTEGER }] },
    { bars: [{ ...fixture.bars[0], close: NaN }] },
    { bars: [{ ...fixture.bars[0], volume: -1 }] },
    { bars: [fixture.bars[0], { ...fixture.bars[1], time: base + 30 }] },
    { fills: [fixture.fills[0], fixture.fills[0]] },
    { fills: [{ ...fixture.fills[0], time: Number.MAX_SAFE_INTEGER }] },
    { bars: Array(5001).fill(fixture.bars[0]) },
    { fills: Array(10001).fill(fixture.fills[0]) },
    { sourceLabel: '' }, { resolutionSeconds: 0 }, { pricePrecision: 13 }, { pricePrecision: -1 },
  ]) expect(priceChartIssue({ ...fixture, ...patch })).not.toBeNull()
})

test('체결은 실제 포함 봉에 배치하고 누락 구간을 미래 봉으로 대체하지 않는다', () => {
  expect(containingBar(fixture, base + 125)).toBe(2)
  expect(containingBar(fixture, base + 179)).toBe(2)
  expect(containingBar(fixture, base + 180)).toBe(3)
  expect(containingBar(fixture, base - 1)).toBeNull()
  expect(containingBar(fixture, base + 7200)).toBeNull()
  expect(containingBar({ ...fixture, bars: [fixture.bars[0], fixture.bars[3]] }, base + 125)).toBeNull()
  expect(chartEma(fixture.bars.slice(0, 2), 3)).toEqual([{ time: base, value: 102 }, { time: base + 60, value: 102.5 }])
  const groups = priceMarkerGroups({ ...fixture, fills: [...fixture.fills].reverse() })
  expect(groups.map(group => [group.time, group.side, group.fills.map(fill => fill.id)])).toEqual([[base + 120, 'BUY', ['buy-1', 'buy-2']], [base + 4500, 'SELL', ['sell-1']]])
  expect(visiblePriceMarkers(groups, base + 120)).toHaveLength(0)
  expect(visiblePriceMarkers(groups, base + 180)).toEqual([groups[0]])
  expect(visiblePriceMarkers(groups, base + 4500)).toEqual([groups[0]])
  expect(visiblePriceMarkers(groups, base + 4560)).toEqual(groups)
})

test('현재 토큰·320~1440px 정렬·키보드 조회·같은 봉 여러 체결 선택', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.locator('.cp-chart').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    const buttons = await page.locator('.cp-controls button').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height } }))
    expect(buttons.every(button => button.x >= 0 && button.right <= width && button.height >= 44)).toBe(true)
    for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) expect(buttons[i].x < buttons[j].right && buttons[i].right > buttons[j].x && buttons[i].y < buttons[j].bottom && buttons[i].bottom > buttons[j].y).toBe(false)
    if (width === 390) await page.screenshot({ path: info.outputPath('professional-chart-mobile.png') })
  }
  await page.locator('.cp-surface').focus()
  await page.keyboard.press('Home')
  await expect(page.locator('.cp-quote')).toContainText('102')
  await expect(page.locator('.cp-sr-only')).toContainText('종가 102')
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight')
  await expect(page.locator('.cp-fills button')).toHaveCount(2)
  await expect(page.locator('.cp-fills button').first()).toContainText('22:15:25')
  await expect(page.locator('.cp-fills button').nth(1)).toContainText('22:15:50')
  await page.locator('.cp-fills button').nth(1).click()
  await expect(page.locator('#selected-fill')).toHaveText('buy-2')
  const originalCanvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: 'EMA 20·50', exact: true }).click()
  await expect(page.getByRole('button', { name: 'EMA 20·50', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.cp-note')).toContainText('전략의 진입 신호가 아닙니다')
  await page.getByRole('button', { name: '로그', exact: true }).click()
  await page.getByRole('button', { name: '%', exact: true }).click()
  await page.getByRole('button', { name: '거래량', exact: true }).click()
  expect(await originalCanvas!.evaluate(el => el.isConnected)).toBe(true)
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText
    Object.assign(window, { exportedTexts: [] as string[] })
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
      if (!this.canvas.isConnected) (window as unknown as { exportedTexts: string[] }).exportedTexts.push(args[0])
      original.apply(this, args)
    }
  })
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '차트 이미지 저장', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('TETH-chart.png')
  expect(await page.evaluate(() => (window as unknown as { exportedTexts: string[] }).exportedTexts.join(''))).toContain(fixture.sourceLabel)
  await page.screenshot({ path: info.outputPath('professional-chart.png') })
  expect(await page.locator('.cp-chart').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(15, 16, 18)')
  expect(errors).toEqual([])
})

test('빈 데이터와 손상된 가격은 합성 SVG/캔들로 대체하지 않는다', async ({ page }) => {
  await mount(page, null)
  await expect(page.locator('.cp-chart').getByRole('status')).toContainText('기다리고')
  await expect(page.locator('.cp-chart canvas, .cp-chart svg')).toHaveCount(0)
  await page.evaluate(data => { (window as unknown as { priceChartHost: { render(view: PriceChartView): void } }).priceChartHost.render(data) }, { ...fixture, fills: [{ ...fixture.fills[0], time: base - 5 }] })
  await expect(page.locator('.cp-note')).toContainText('체결 1건은 마커로 표시하지 않았습니다')
})

test('빈 시리즈 재생과 같은 identity의 확장 결과는 전체 논리 범위를 유지한다', async ({ page }) => {
  await page.clock.install()
  await page.route('**/src/components/ClientProfessionalPriceChart.tsx*', async route => {
    const response = await route.fetch()
    const body = await response.text()
    expect(body).toContain('api.current = chart;')
    await route.fulfill({ response, body: body.replace('api.current = chart;', 'api.current = chart; window.__testPriceChart = chart;') })
  })
  await mount(page)
  const range = () => page.evaluate(() => (window as unknown as { __testPriceChart: { timeScale(): { getVisibleLogicalRange(): { from: number; to: number } } } }).__testPriceChart.timeScale().getVisibleLogicalRange())
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.fastForward(10_000)
  // LWCharts applies the requested logical range in its queued draw pass.
  await expect.poll(async () => (await range()).from).toBeLessThan(0)
  await expect.poll(async () => (await range()).to).toBeGreaterThanOrEqual(119)
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  const expanded = { ...fixture, bars: Array.from({ length: 5000 }, (_, i) => ({ ...fixture.bars[0], time: base + i * 60 })) }
  await page.evaluate(view => (window as unknown as { priceChartHost: { render(view: PriceChartView): void } }).priceChartHost.render(view), expanded)
  await expect.poll(async () => (await range()).to).toBeGreaterThanOrEqual(4999)
})

test('60초 결과 재생·Skip·지연된 타이머 경과 시간·모션 줄이기', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  const before = await page.locator('.cp-surface').boundingBox()
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.getByRole('progressbar')).toBeVisible()
  expect((await page.locator('.cp-surface').boundingBox())?.y).toBe(before?.y)
  expect(Number(await page.getByRole('progressbar').getAttribute('value'))).toBeLessThan(.1)
  await page.clock.fastForward(20_000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  await expect(page.locator('.cp-execution')).toContainText('BUY')
  await expect(page.locator('.cp-execution')).not.toContainText('SELL')
  await page.getByRole('button', { name: 'Skip · 결과 보기', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.locator('.cp-quote')).toContainText('221')
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.fastForward(61_000)
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  await expect(page.locator('.cp-sr-only')).toContainText('모션 줄이기 설정')
})

test('생성 실패를 복구하고 재생 중 언마운트 시 타이머와 차트를 해제한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.clock.install()
  await page.goto('/')
  await page.evaluate(() => {
    const original = document.createElement.bind(document)
    Object.defineProperty(document, 'createElement', { configurable: true, value: (name: string, options?: ElementCreationOptions) => {
      if (name === 'table' && document.querySelector('.cp-chart')) throw new Error('Test chart failure')
      return original(name, options)
    } })
  })
  await page.evaluate(async data => { const path = '/tests/fixtures/price-chart-host.tsx'; const module = await import(/* @vite-ignore */ path); Object.assign(window, { priceChartHost: module.mount(data) }) }, fixture)
  await expect(page.getByRole('alert')).toContainText('표시하지 못했습니다')
  await page.evaluate(() => { Reflect.deleteProperty(document, 'createElement') })
  await page.getByRole('button', { name: '차트 다시 표시' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.evaluate(() => { (window as unknown as { priceChartHost: { unmount(): void } }).priceChartHost.unmount() })
  await page.clock.fastForward(65_000)
  await expect(page.locator('.cp-chart')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('상한 5000봉·동일 봉 10000체결은 그룹화하고 상세 50건부터 펼친다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page, { ...fixture, bars: Array.from({ length: 5000 }, (_, index) => ({ ...fixture.bars[0], time: base + index * 60 })), fills: Array.from({ length: 10000 }, (_, index) => ({ ...fixture.fills[0], id: `fill-${index}`, tradeId: `trade-${index}`, time: base + 10 })) })
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await page.locator('.cp-surface').focus(); await page.keyboard.press('Home')
  await expect(page.locator('.cp-fills button')).toHaveCount(51)
  await page.getByRole('button', { name: '체결 더 보기 (50/10000)' }).click()
  await expect(page.locator('.cp-fills button')).toHaveCount(101)
  expect(errors).toEqual([])
})

test('작은 가격·긴 출처와 시장명·다른 결과 교체를 허용하고 오래된 재생을 종료한다', async ({ page }) => {
  await page.clock.install()
  await page.setViewportSize({ width: 320, height: 800 })
  await mount(page)
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  const replacement: PriceChartView = { ...fixture, identity: 'TEST_ONLY_OTHER_RESULT', market: 'LONGMARKETSYMBOLLONGMARKETSYMBOL / USDT', pricePrecision: 8, sourceLabel: '검증용'.repeat(60), bars: [{ time: base, open: .00000002, close: .00000003, low: .00000001, high: .00000004, volume: 0 }], fills: [] }
  await page.evaluate(data => { (window as unknown as { priceChartHost: { render(view: PriceChartView): void } }).priceChartHost.render(data) }, replacement)
  await expect(page.locator('.cp-quote')).toContainText('0.00000003')
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await page.clock.fastForward(65_000)
  await expect(page.locator('.cp-quote')).toContainText('0.00000003')
  expect(await page.locator('.cp-chart').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('부모가 같은 입력을 새 객체로 보내도 캔버스·재생을 유지하고 내용 변경은 반영한다', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  const original = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.getByRole('button', { name: '체결 순서 재생', exact: true }).click()
  await page.clock.fastForward(10_000)
  await page.evaluate(data => { (window as unknown as { priceChartHost: { render(view: PriceChartView): void } }).priceChartHost.render(data) }, structuredClone(fixture))
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'true')
  expect(await original!.evaluate(el => el.isConnected)).toBe(true)
  await page.clock.fastForward(5_000)
  expect(Number(await page.getByRole('progressbar').getAttribute('value'))).toBeGreaterThan(.24)
  await page.evaluate(data => { (window as unknown as { priceChartHost: { render(view: PriceChartView): void } }).priceChartHost.render(data) }, { ...fixture, bars: [fixture.bars[0]], fills: [] })
  await expect(page.locator('.cp-chart')).toHaveAttribute('data-replaying', 'false')
  await expect(page.locator('.cp-quote')).toContainText('102')
})
