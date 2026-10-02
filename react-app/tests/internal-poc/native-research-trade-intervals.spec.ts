import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
async function mount(page: Page, initialActive = true) {
  await page.route('**/trade-interval-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0f1012"><main id="fixture"></main></body></html>' }))
  await page.goto('/trade-interval-fixture.html')
  await page.evaluate(async initialActive => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable",sans-serif'
    const audit = { texts: [] as { text: string; color: string }[], rects: [] as number[][], observed: 0 }
    const fillText = CanvasRenderingContext2D.prototype.fillText, fillRect = CanvasRenderingContext2D.prototype.fillRect
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof fillText>) { if (/^(ENTRY|EXIT)-/.test(args[0])) audit.texts.push({ text: args[0], color: String(this.fillStyle) }); return fillText.apply(this, args) }
    CanvasRenderingContext2D.prototype.fillRect = function (...args: Parameters<typeof fillRect>) { if (this.canvas.hasAttribute('data-trade-interval-overlay')) audit.rects.push(args); return fillRect.apply(this, args) }
    const Base = ResizeObserver
    window.ResizeObserver = class extends Base {
      own = new Set<Element>()
      observe(target: Element, options?: ResizeObserverOptions) { if (target.hasAttribute('data-chart-mount') && !this.own.has(target)) { this.own.add(target); audit.observed++ }; super.observe(target, options) }
      disconnect() { audit.observed -= this.own.size; this.own.clear(); super.disconnect() }
    }
    const path = '/src/internal-poc/NativeResearchChartPreview.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('React path missing')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeResearchChartPreview } = await import(/* @vite-ignore */ path)
    const pref = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ pref)
    const start = 1726617600, bars = Array.from({ length: 63 }, (_, i) => ({ time: start + i * 60, open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i }))
    const fills = ['GAIN', 'LOSS', 'FLAT'].flatMap((name, index) => [
      { id: `entry-${index}`, time: start + (index * 20 + 1) * 60 + 5, barTime: start + (index * 20 + 1) * 60, price: 100 + index, side: 'BUY', label: `ENTRY-${name}` },
      { id: `exit-${index}`, time: start + (index * 20 + 15) * 60 + 5, barTime: start + (index * 20 + 15) * 60, price: 90 - index, side: 'SELL', label: `EXIT-${name}` },
    ])
    // Deliberately unrelated prices: the renderer must never infer the result.
    const seed = { versionIdentity: 'v-a', bars, fills, tradeIntervals: ['gain', 'loss', 'flat'].map((outcome, i) => ({ id: `trade-${i}`, versionIdentity: 'v-a', entryFillId: `entry-${i}`, exitFillId: `exit-${i}`, outcome, label: ['+7.125% supplied', '-2.500% supplied', '0.000% flat supplied'][i] })), sourceLabel: 'SUPPLIED TEST OBSERVATIONS', rangeLabel: '2024-09-18 UTC', pricePrecision: 3 }
    function Host() {
      const [data, setData] = react.useState(seed), [active, setActive] = react.useState(initialActive), [version, setVersion] = react.useState('v-a'), [owner, setOwner] = react.useState('owner-a')
      Object.assign(window, { intervalAudit: audit, intervalSeed: seed, intervalData: setData, intervalActive: setActive, intervalVersion: setVersion, intervalOwner: setOwner, intervalLanguage: (language: string) => setClientPreference('language', language) })
      return h('section', { className: 'client-restored-research' }, h('article', { className: 'g-doc g-adoc' }, h(NativeResearchChartPreview, { scopeId: owner, versionIdentity: version, active, prices: data })))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { intervalUnmount: () => root.unmount() }); root.render(h(Host))
  }, initialActive)
  await expect(page.locator('[data-native-research-charts]')).toHaveCount(1)
  if (initialActive) await expect(page.locator('[data-research-chart=prices] canvas').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test('원본 entry→exit 음영과 공급 결과에 맞는 청산 색상을 그린다', async ({ page }, info) => {
  await mount(page)
  await expect(page.locator('[data-trade-interval-overlay]')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'intervalAudit').rects.length)).toBeGreaterThan(2)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'intervalAudit').texts.some((row: { text: string; color: string }) => row.text === 'EXIT-GAIN' && row.color === '#4ec08d'))).toBe(true)
  for (const name of ['LOSS', 'FLAT']) await expect.poll(() => page.evaluate(name => Reflect.get(window, 'intervalAudit').texts.some((row: { text: string; color: string }) => row.text === `EXIT-${name}` && row.color === '#e0604b'), name)).toBe(true)
  await page.locator('[data-trade-interval-table] summary').click()
  await expect(page.locator('[data-trade-interval-table]')).toContainText('+7.125% supplied')
  await expect(page.locator('[data-trade-interval-table]')).toContainText('0.000% flat supplied')
  await expect(page.locator('[data-trade-interval-table]')).toContainText('2024-09-18 00:01:05 UTC')
  await page.screenshot({ path: info.outputPath('research-trade-intervals.png'), fullPage: true })
})

test('중복거래·fill재사용·구버전·역순·잘못된 봉시각·과다구간을 거절한다', async ({ page }) => {
  await mount(page)
  for (const kind of ['duplicate', 'reuse', 'stale', 'reverse', 'missing', 'wrongbar', 'outcome', 'oversized']) {
    await page.evaluate(kind => {
      const seed = Reflect.get(window, 'intervalSeed'), intervals = seed.tradeIntervals.map((item: object) => ({ ...item })), fills = seed.fills.map((item: object) => ({ ...item }))
      if (kind === 'duplicate') intervals[1].id = intervals[0].id
      if (kind === 'reuse') intervals[1].entryFillId = intervals[0].entryFillId
      if (kind === 'stale') intervals[0].versionIdentity = 'old'
      if (kind === 'reverse') [intervals[0].entryFillId, intervals[0].exitFillId] = [intervals[0].exitFillId, intervals[0].entryFillId]
      if (kind === 'missing') intervals[0].exitFillId = 'missing'
      if (kind === 'wrongbar') fills[0].time += 61
      if (kind === 'outcome') intervals[0].outcome = 'made-up'
      Reflect.get(window, 'intervalData')({ ...seed, fills, tradeIntervals: kind === 'oversized' ? Array.from({ length: 1001 }, () => intervals[0]) : intervals })
    }, kind)
    await expect(page.locator('.g-chartbox').first()).toHaveAttribute('data-chart-state', kind === 'oversized' ? 'oversized' : 'invalid')
    await expect(page.locator('[data-trade-interval-overlay]')).toHaveCount(0)
  }
})

test('미공급과 빈구간은 합성음영 없이 기존 fill을 유지하고 동일봉거래도 표시한다', async ({ page }) => {
  await mount(page)
  for (const supplied of [false, true]) {
    await page.evaluate(supplied => { const seed = Reflect.get(window, 'intervalSeed'); Reflect.get(window, 'intervalData')({ ...seed, tradeIntervals: supplied ? [] : undefined }) }, supplied)
    await expect(page.locator('.g-chartbox').first()).toHaveAttribute('data-chart-state', 'ready')
    await expect(page.locator('[data-trade-interval-overlay]')).toHaveCount(0)
    await expect(page.locator('[data-trade-interval-table]')).toHaveCount(supplied ? 1 : 0)
  }
  await page.evaluate(() => { const seed = Reflect.get(window, 'intervalSeed'); Reflect.get(window, 'intervalData')({ ...seed, tradeIntervals: [seed.tradeIntervals[0]], fills: [{ ...seed.fills[0] }, { ...seed.fills[1], barTime: seed.fills[0].barTime, time: seed.fills[0].time + 1 }] }) })
  await expect(page.locator('[data-trade-interval-overlay]')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'intervalAudit').rects.some((row: number[]) => row[2] === 2))).toBe(true)
})

test('7언어·320px·zoom/resize·hidden/reduced-motion에서도 단일canvas와 해제를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await mount(page)
  const layer = page.locator('[data-trade-interval-overlay]')
  await expect(layer).toHaveCount(1)
  await layer.evaluate(node => Reflect.set(window, 'intervalCanvas', node))
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(language => Reflect.get(window, 'intervalLanguage')(language), language)
    expect(await layer.evaluate(node => node === Reflect.get(window, 'intervalCanvas'))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false)
  }
  const before = await page.evaluate(() => Reflect.get(window, 'intervalAudit').rects.length)
  await page.setViewportSize({ width: 800, height: 740 })
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'intervalAudit').rects.length)).toBeGreaterThan(before)
  const plot = page.locator('[data-research-chart=prices]'); await plot.hover(); await page.mouse.wheel(0, -200)
  await page.evaluate(() => Reflect.get(window, 'intervalActive')(false))
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'intervalAudit').observed)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'intervalActive')(true)); await expect(layer).toBeVisible()
  expect(await layer.evaluate(node => node === Reflect.get(window, 'intervalCanvas'))).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'intervalVersion')('v-b'))
  await expect(page.locator('[data-trade-interval-overlay]')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'intervalUnmount')())
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'intervalAudit').observed)).toBe(0)
})

test('비활성 최초의 거래구간은 canvas와 관찰자를 만들지 않는다', async ({ page }) => {
  await mount(page, false)
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'intervalAudit').observed)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'intervalActive')(true))
  await expect(page.locator('[data-trade-interval-overlay]')).toBeVisible()
})

test('표시 중 음영 canvas 실패는 비밀오류 노출 없이 표를 보존한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await mount(page)
  await page.evaluate(() => {
    const get = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof get>) { if (this.hasAttribute('data-trade-interval-overlay')) throw new Error('PRIVATE_OVERLAY_FAILURE'); return get.apply(this, args) } as typeof get
  })
  // Both desktop and mobile must change the actual capped chart width.
  await page.setViewportSize({ width: 320, height: 720 })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('[data-trade-interval-overlay]')).toBeHidden()
  await page.locator('[data-trade-interval-table] summary').click()
  await expect(page.locator('[data-trade-interval-table]')).toContainText('0.000% flat supplied')
  expect(errors).toEqual([]); await expect(page.locator('body')).not.toContainText('PRIVATE_OVERLAY_FAILURE')
})

test('최대1000구간도 canvas1개·표50행이며 숨긴 후 resize와 zoom은 draw하지 않는다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const seed = Reflect.get(window, 'intervalSeed'), start = seed.bars[0].time
    const bars = Array.from({ length: 1000 }, (_, i) => ({ time: start + i * 60, open: 100, high: 102, low: 99, close: 101 }))
    const fills = bars.flatMap((bar, i) => [{ id: `en-${i}`, time: bar.time + 1, barTime: bar.time, price: 100, side: 'BUY' }, { id: `ex-${i}`, time: bar.time + 2, barTime: bar.time, price: 101, side: 'SELL' }])
    const tradeIntervals = bars.map((_, i) => ({ id: `pair-${i}`, versionIdentity: 'v-a', entryFillId: `en-${i}`, exitFillId: `ex-${i}`, outcome: 'gain', label: `supplied-${i}` }))
    Reflect.get(window, 'intervalData')({ ...seed, bars, fills, tradeIntervals })
  })
  await expect(page.locator('.g-chartbox').first()).toHaveAttribute('data-chart-state', 'ready')
  await expect(page.locator('[data-trade-interval-overlay]')).toHaveCount(1)
  await page.locator('[data-trade-interval-table] summary').click()
  await expect(page.locator('[data-trade-interval-table] tbody tr')).toHaveCount(50)
  const count = await page.locator('[data-research-chart=prices] *').count()
  expect(count).toBeLessThan(35)
  await page.evaluate(() => Reflect.get(window, 'intervalActive')(false))
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'intervalAudit').observed)).toBe(0)
  const before = await page.evaluate(() => Reflect.get(window, 'intervalAudit').rects.length)
  await page.setViewportSize({ width: 700, height: 700 }); await page.mouse.wheel(0, -200)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await page.evaluate(() => Reflect.get(window, 'intervalAudit').rects.length)).toBe(before)
  await page.evaluate(() => Reflect.get(window, 'intervalOwner')('owner-b'))
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'intervalActive')(true))
  await expect(page.locator('[data-trade-interval-overlay]')).toBeVisible()
})
