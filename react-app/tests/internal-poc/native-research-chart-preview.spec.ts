import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
async function mount(page: Page, supplied = true, active = true, failCanvas = false) {
  await page.route('**/research-chart-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0f1012"><main id="fixture"></main></body></html>' }))
  await page.goto('/research-chart-fixture.html')
  await page.evaluate(async ({ supplied, active, failCanvas }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const font = '/node_modules/@fontsource-variable/noto-sans-kr/wght.css'; await import(/* @vite-ignore */ font)
    document.body.style.fontFamily = '"Noto Sans KR Variable", sans-serif'
    const audit = { observed: 0, observations: 0, disconnects: 0, text: [] as string[], opens: 0 }
    const BaseObserver = window.ResizeObserver
    window.ResizeObserver = class extends BaseObserver {
      own = new Set<Element>()
      observe(target: Element, options?: ResizeObserverOptions) { if (target.hasAttribute('data-chart-mount') && !this.own.has(target)) { this.own.add(target); audit.observed++; audit.observations++ }; super.observe(target, options) }
      unobserve(target: Element) { if (this.own.delete(target)) audit.observed--; super.unobserve(target) }
      disconnect() { audit.observed -= this.own.size; if (this.own.size) audit.disconnects++; this.own.clear(); super.disconnect() }
    }
    const fillText = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof fillText>) { if (args[0] === 'BUY' || args[0] === 'SELL') audit.text.push(args[0]); return fillText.apply(this, args) }
    if (failCanvas) HTMLCanvasElement.prototype.getContext = (() => { throw new Error('SECRET_CANVAS_INTERNAL_FAILURE') }) as typeof HTMLCanvasElement.prototype.getContext
    const path = '/src/internal-poc/NativeResearchChartPreview.tsx', source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeResearchChartPreview } = await import(/* @vite-ignore */ path)
    const pref = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ pref)
    const start = 1726617600
    const bars = Object.freeze(Array.from({ length: 63 }, (_, i) => Object.freeze({ time: start + i * 60, open: 100 + i / 10, high: 101 + i / 10, low: 99 + i / 10, close: 100.25 + i / 10 })))
    const seedPrices = { versionIdentity: 'version-a', bars, fills: [{ id: 'execution-buy', time: start + 65, barTime: start + 60, price: 100.125, side: 'BUY', quantity: '0.003125 BTC' }, { id: 'execution-sell', time: start + 1865, barTime: start + 1860, price: 104.375, side: 'SELL', quantity: '0.003125 BTC' }], holdout: { fromBarTime: start + 2400, toBarTime: start + 3720, label: '공급한 Holdout 구간' }, sourceLabel: '검증된 공급 가격', rangeLabel: '2024-09-18 00:00–01:02 UTC', currency: 'USDC', pricePrecision: 3 }
    const seedEquity = { versionIdentity: 'version-a', points: bars.map((bar, i) => ({ time: bar.time, value: 10000 + i * 0.125, valueLabel: `${10000 + i * 0.125} USDC` })), label: '공급한 자산 곡선', sourceLabel: '검증된 공급 성과', rangeLabel: '동일한 공급 구간', currency: 'USDC', valuePrecision: 3 }
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [version, setVersion] = react.useState('version-a'), [visible, setVisible] = react.useState(active)
      const [prices, setPrices] = react.useState(supplied ? seedPrices : null), [equity, setEquity] = react.useState(supplied ? seedEquity : null)
      Object.assign(window, { previewAudit: audit, previewOwner: setOwner, previewVersion: setVersion, previewActive: setVisible, previewPrices: setPrices, previewEquity: setEquity, previewSeedPrices: seedPrices, previewSeedEquity: seedEquity, previewLanguage: (language: string) => setClientPreference('language', language) })
      return h('section', { className: 'client-restored-research' }, h('article', { className: 'g-doc g-adoc' }, h(NativeResearchChartPreview, { scopeId: owner, versionIdentity: version, active: visible, prices, equity, onOpenAnalysis: () => { audit.opens++ } })))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture'))
    Object.assign(window, { previewUnmount: () => root.unmount() })
    root.render(h(Host))
  }, { supplied, active, failCanvas })
  await expect(page.locator('[data-native-research-charts]')).toHaveCount(1)
  await page.evaluate(() => document.fonts.ready)
  if (supplied && active && !failCanvas) await expect(page.locator('[data-research-chart=prices] canvas').first()).toBeVisible()
}

test('실제 LWC 캔들·가격위치 BUY SELL·holdout·자산곡선과 원문표를 렌더한다', async ({ page }, info) => {
  const errors: string[] = [], network: string[] = []
  page.on('pageerror', error => errors.push(error.message)); page.on('request', request => { if (/\/api\/|binance\.com|client-terminal-source-fixture/.test(request.url())) network.push(request.url()) })
  await mount(page)
  await expect(page.locator('.g-chartbox')).toHaveCount(2); await expect(page.locator('[data-research-chart=prices]')).toHaveAttribute('data-count', '63')
  await expect(page.locator('[data-research-chart=equity] canvas').first()).toBeVisible()
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'previewAudit').text.includes('BUY') && Reflect.get(window, 'previewAudit').text.includes('SELL'))).toBe(true)
  await expect(page.locator('[data-holdout-overlay]')).toBeVisible(); expect(await page.locator('[data-holdout-overlay]').evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(0)
  await page.locator('.g-chartbox').first().getByText('실제 체결 · 2', { exact: true }).click()
  const fillTable = page.locator('.g-chartbox').first().locator('details').last()
  await expect(fillTable).toContainText('2024-09-18 00:01:05 UTC'); await expect(fillTable).toContainText('100.125'); await expect(fillTable).toContainText('0.003125 BTC')
  await page.getByRole('button', { name: '전문 차트 열기' }).click(); expect(await page.evaluate(() => Reflect.get(window, 'previewAudit').opens)).toBe(1)
  expect(network).toEqual([]); expect(errors).toEqual([])
  await page.screenshot({ path: info.outputPath('research-lwc-prices-equity.png'), fullPage: true })
})

test('키보드 실제 OHLC와 자산값·페이지표는 계산이나 반올림 없이 표시한다', async ({ page }) => {
  await mount(page)
  const prices = page.locator('[data-research-chart=prices]')
  await prices.focus(); await page.keyboard.press('End'); await expect(page.locator('[data-chart-inspection=prices]')).toContainText('O 106.2 · H 107.2 · L 105.2 · C 106.45')
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await expect(page.locator('[data-chart-inspection=prices]')).toContainText('O 100.1 · H 101.1 · L 99.1 · C 100.35')
  await page.locator('.g-chartbox').first().getByText('관측값 표 보기 · 63', { exact: true }).click()
  const table = page.locator('.g-chartbox').first().locator('details').first()
  await expect(table.locator('tbody tr')).toHaveCount(50); await table.getByRole('button', { name: '다음', exact: true }).click(); await expect(table.locator('tbody tr')).toHaveCount(13); await expect(table).toContainText('106.45')
  await page.locator('[data-research-chart=equity]').focus(); await page.keyboard.press('End'); await expect(page.locator('[data-chart-inspection=equity]')).toContainText('10007.75 USDC'); await expect(page.locator('[data-chart-inspection=equity]')).not.toContainText('USDC USDC')
})

test('owner·버전 전환은 이전 canvas/선택을 폐기하고 늦은 구버전 payload를 거절한다', async ({ page }) => {
  await mount(page)
  await page.locator('[data-research-chart=prices] canvas').first().evaluate(node => Reflect.set(window, 'oldCanvas', node))
  await page.locator('[data-research-chart=prices]').focus(); await page.keyboard.press('End')
  await page.evaluate(() => Reflect.get(window, 'previewVersion')('version-b'))
  await expect(page.locator('[data-native-research-charts]')).toHaveAttribute('data-native-research-charts', 'version-b'); await expect(page.locator('[data-chart-state=stale]')).toHaveCount(2); await expect(page.locator('canvas')).toHaveCount(0)
  await page.evaluate(() => { Reflect.get(window, 'previewPrices')({ ...Reflect.get(window, 'previewSeedPrices'), versionIdentity: 'version-b' }); Reflect.get(window, 'previewEquity')({ ...Reflect.get(window, 'previewSeedEquity'), versionIdentity: 'version-b' }) })
  await expect(page.locator('[data-research-chart=prices] canvas').first()).toBeVisible(); expect(await page.locator('[data-research-chart=prices] canvas').first().evaluate(node => node === Reflect.get(window, 'oldCanvas'))).toBe(false); await expect(page.locator('[data-chart-inspection=prices]')).not.toContainText('106.45')
  await page.evaluate(() => Reflect.get(window, 'previewPrices')(Reflect.get(window, 'previewSeedPrices'))); await expect(page.locator('[data-chart-state=stale]')).toHaveCount(1); await expect(page.locator('[data-research-chart=prices]')).toHaveCount(0)
  await page.locator('[data-research-chart=equity] canvas').first().evaluate(node => Reflect.set(window, 'oldEquityCanvas', node)); await page.evaluate(() => Reflect.get(window, 'previewOwner')('owner-b')); await expect.poll(() => page.locator('[data-research-chart=equity] canvas').first().evaluate(node => node === Reflect.get(window, 'oldEquityCanvas'))).toBe(false)
})

test('비활성 최초에는 chart0, 탭·언어 왕복은 canvas보존·ResizeObserver 중단·해제', async ({ page }) => {
  await mount(page, true, false); await expect(page.locator('canvas')).toHaveCount(0); expect(await page.evaluate(() => Reflect.get(window, 'previewAudit').observed)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'previewActive')(true)); await expect(page.locator('[data-research-chart=prices] canvas').first()).toBeVisible(); await expect.poll(() => page.evaluate(() => Reflect.get(window, 'previewAudit').observed)).toBe(2)
  await page.locator('[data-research-chart=prices] canvas').first().evaluate(node => Reflect.set(window, 'sameCanvas', node))
  await page.evaluate(() => Reflect.get(window, 'previewActive')(false)); await expect(page.locator('[data-native-research-charts]')).toBeHidden(); await expect.poll(() => page.evaluate(() => Reflect.get(window, 'previewAudit').observed)).toBe(0)
  await page.evaluate(() => Reflect.get(window, 'previewLanguage')('fr')); await page.evaluate(() => Reflect.get(window, 'previewActive')(true)); await expect(page.locator('[data-research-chart=prices] canvas').first()).toBeVisible(); expect(await page.locator('[data-research-chart=prices] canvas').first().evaluate(node => node === Reflect.get(window, 'sameCanvas'))).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'previewUnmount')()); await expect(page.locator('canvas')).toHaveCount(0); await expect.poll(() => page.evaluate(() => Reflect.get(window, 'previewAudit').observed)).toBe(0)
})

test('미공급·확인된빈값·OHLC NaN·잘못된봉결속·밀리초/중복시각을 구별하고 실패를 숨기지 않는다', async ({ page }) => {
  await mount(page, false); await expect(page.locator('[data-chart-state=unavailable]')).toHaveCount(2); await expect(page.locator('canvas')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'previewPrices')({ ...Reflect.get(window, 'previewSeedPrices'), bars: [], fills: [], holdout: undefined })); await expect(page.locator('[data-chart-state=empty]')).toHaveCount(1)
  for (const kind of ['nan', 'ohlc', 'fill', 'milliseconds', 'duplicate']) {
    await page.evaluate(kind => {
      const seed = Reflect.get(window, 'previewSeedPrices'), bars = seed.bars.map((bar: Record<string, number>) => ({ ...bar }))
      if (kind === 'nan') bars[0].close = NaN
      if (kind === 'ohlc') bars[0].low = bars[0].high + 1
      if (kind === 'milliseconds') bars[0].time *= 1000
      if (kind === 'duplicate') bars[1].time = bars[0].time
      Reflect.get(window, 'previewPrices')({ ...seed, bars, fills: kind === 'fill' ? [{ ...seed.fills[0], barTime: 1726617601 }] : seed.fills })
    }, kind)
    await expect(page.locator('[data-chart-state=invalid]')).toHaveCount(1); await expect(page.locator('canvas')).toHaveCount(0)
  }
})

test('명시 상한을 넘는 가격·체결·자산 배열은 자르거나 집계하지 않고 전체 거절한다', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => { const seed = Reflect.get(window, 'previewSeedPrices'); Reflect.get(window, 'previewPrices')({ ...seed, bars: Array.from({ length: 1001 }, (_, i) => ({ time: 1726617600 + i * 60, open: 1, high: 2, low: 0, close: 1 })) }) })
  await expect(page.locator('[data-chart-state=oversized]')).toHaveCount(1); await expect(page.locator('[data-research-chart=prices]')).toHaveCount(0); await expect(page.locator('.g-chartbox').first()).toContainText('OHLC 1000 / BUY·SELL 2000')
  await page.evaluate(() => { const seed = Reflect.get(window, 'previewSeedPrices'); Reflect.get(window, 'previewPrices')({ ...seed, fills: Array.from({ length: 2001 }, (_, i) => ({ ...seed.fills[0], id: `f-${i}` })) }); Reflect.get(window, 'previewEquity')({ ...Reflect.get(window, 'previewSeedEquity'), points: Array.from({ length: 2001 }, (_, i) => ({ time: 1726617600 + i * 60, value: 1 })) }) })
  await expect(page.locator('[data-chart-state=oversized]')).toHaveCount(2); await expect(page.locator('canvas')).toHaveCount(0)
})

test('320px·7언어·실제표의 가로스크롤과 singlepoint를 검수한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 }); await mount(page)
  await page.locator('.g-chartbox').first().getByText('관측값 표 보기 · 63', { exact: true }).click()
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(language => Reflect.get(window, 'previewLanguage')(language), language)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), language).toBe(false)
    await expect(page.locator('[data-research-chart=prices] canvas').first()).toBeVisible()
  }
  await page.locator('.g-chartbox').first().locator('.rw-table-scroll').first().evaluate(node => { node.scrollLeft = 100 }); expect(await page.locator('.g-chartbox').first().locator('.rw-table-scroll').first().evaluate(node => node.scrollLeft)).toBeGreaterThan(0)
  await page.evaluate(() => { const seed = Reflect.get(window, 'previewSeedPrices'); Reflect.get(window, 'previewPrices')({ ...seed, bars: [seed.bars[0]], fills: [], holdout: undefined }); const eq = Reflect.get(window, 'previewSeedEquity'); Reflect.get(window, 'previewEquity')({ ...eq, points: [eq.points[0]] }) })
  await expect(page.locator('[data-research-chart=prices]')).toHaveAttribute('data-count', '1'); await expect(page.locator('[data-research-chart=equity]')).toHaveAttribute('data-count', '1'); await expect(page.getByRole('alert')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('research-chart-320-fr.png'), fullPage: true })
})

test('캔버스 초기화 실패는 안전한 오류와 실제표를 남기며 부분 canvas를 제거한다', async ({ page }) => {
  await mount(page, true, true, true)
  await expect(page.getByRole('alert')).toHaveCount(2); await expect(page.getByRole('alert').first()).toHaveText('차트를 표시하지 못했습니다. 관측값 표에서 확인해주세요.')
  await expect(page.locator('body')).not.toContainText('SECRET_CANVAS_INTERNAL_FAILURE'); await expect(page.locator('canvas')).toHaveCount(0)
  await page.locator('.g-chartbox').first().getByText('관측값 표 보기 · 63', { exact: true }).click(); await expect(page.locator('.g-chartbox').first().locator('details').first().locator('tbody tr')).toHaveCount(50)
  await expect(page.getByRole('button', { name: '전체 구간', exact: true }).first()).toBeDisabled()
  await page.getByRole('button', { name: '전문 차트 열기' }).click(); expect(await page.evaluate(() => Reflect.get(window, 'previewAudit').opens)).toBe(1)
  await page.evaluate(() => Reflect.get(window, 'previewUnmount')()); await expect(page.locator('canvas')).toHaveCount(0)
})
