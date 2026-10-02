import { expect, test, type Page } from '@playwright/test'
import { marketChartText } from '../../src/client-market-chart-copy'

const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const mountSelector = '[data-chart-mount=prices]'
const flush = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
async function set(page: Page, key: string, value?: unknown) {
  await page.evaluate(({ key, value }) => Reflect.get(window, key)(value), { key, value })
}
async function moduleGate(page: Page, fail = false) {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  const requests: string[] = []
  await page.route(/\/node_modules\/\.vite(?:-e2e-\d+)?\/deps\/lightweight-charts\.js(?:\?|$)/, async route => {
    const url = new URL(route.request().url())
    if (url.searchParams.has('research_actual')) { await route.fallback(); return }
    requests.push(url.href)
    await pending
    if (fail) { await route.fulfill({ status: 503, contentType: 'text/plain', body: 'TEST_ONLY_MODULE_FAILURE' }); return }
    url.searchParams.set('research_actual', '1')
    const dependency = JSON.stringify(url.pathname + url.search)
    // Wrap only the real dependency API, never substitute the product module.
    await route.fulfill({ contentType: 'text/javascript', body: `
      import * as actual from ${dependency}; export * from ${dependency};
      export function createChart(...args) {
        const chart = actual.createChart(...args); window.researchLoadCharts.push(chart);
        const remove = chart.remove.bind(chart); chart.remove = () => { window.researchLoadRemoved++; return remove(); };
        return chart;
      }
    ` })
  })
  return { requests, release, settle: async () => {
    release()
    await page.evaluate(async url => { try { await import(/* @vite-ignore */ url) } catch { /* expected module failure only */ } }, requests[0])
    await flush(page)
  } }
}
async function mount(page: Page, supplied = true, active = true) {
  await page.route('**/research-chart-loading-host.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main></body></html>' }))
  await page.goto('/research-chart-loading-host.html')
  await page.evaluate(async ({ supplied, active }) => {
    const refresh = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refresh)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true, researchLoadCharts: [], researchLoadRemoved: 0 })
    const path = '/src/internal-poc/NativeResearchChartPreview.tsx'
    const source = await (await fetch(path)).text(), rp = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!rp) throw new Error('Missing React instance')
    const rm = await import(/* @vite-ignore */ rp), react = rm.default ?? rm, h = react.createElement
    const dp = '/@id/react-dom/client', dom = await import(/* @vite-ignore */ dp)
    const { NativeResearchChartPreview } = await import(/* @vite-ignore */ path)
    const preferencePath = '/src/client-preferences.ts', { setClientPreference } = await import(/* @vite-ignore */ preferencePath)
    const seed = { versionIdentity: 'version-a', bars: [{ time: 1726617600, open: 100, high: 104, low: 99, close: 102 }, { time: 1726617660, open: 102, high: 105, low: 101, close: 104 }], fills: [{ id: 'buy-a', time: 1726617601, barTime: 1726617600, price: 102, side: 'BUY', quantity: '0.003 BTC' }], sourceLabel: '공급 원문 가격', rangeLabel: '공급 원문 구간', pricePrecision: 2 }
    function Host() {
      const [owner, setOwner] = react.useState('owner-a'), [visible, setVisible] = react.useState(active), [prices, setPrices] = react.useState(supplied ? seed : null)
      const [draft, setDraft] = react.useState('보존할 대화 초안')
      Object.assign(window, { researchLoadActive: setVisible, researchLoadOwner: setOwner, researchLoadPrices: setPrices, researchLoadSeed: seed,
        researchLoadLocale: (value: string) => setClientPreference('language', value) })
      return h('section', { className: 'client-restored-research' }, h('input', { 'aria-label': '대화 초안', value: draft, onChange: (event: { target: { value: string } }) => setDraft(event.target.value) }),
        h(NativeResearchChartPreview, { scopeId: owner, versionIdentity: 'version-a', active: visible, prices }))
    }
    const root = (dom.createRoot ?? dom.default.createRoot)(document.getElementById('root'))
    Object.assign(window, { researchLoadUnmount: () => root.unmount() })
    root.render(h(react.StrictMode, null, h(Host)))
  }, { supplied, active })
  await expect(page.locator('[data-native-research-charts]')).toHaveCount(1)
  await flush(page)
}
const charts = (page: Page) => page.evaluate(() => Reflect.get(window, 'researchLoadCharts').length as number)

test('미공급 또는 첫 비활성 연구 문서는 LWC 모듈을 요청하지 않는다', async ({ page }) => {
  const gate = await moduleGate(page)
  try {
    await mount(page, false)
    await expect(page.locator('[data-chart-state=unavailable]')).toHaveCount(2)
    expect(gate.requests).toHaveLength(0)
    await set(page, 'researchLoadActive', false)
    await page.evaluate(() => Reflect.get(window, 'researchLoadPrices')(Reflect.get(window, 'researchLoadSeed')))
    await expect(page.locator('[data-chart-state=ready]')).toHaveCount(1)
    await flush(page)
    expect(gate.requests).toHaveLength(0); expect(await charts(page)).toBe(0)
  } finally { gate.release() }
})

test('지연 로딩 중 최신 데이터와 7언어를 보존하고 한 차트만 생성한다', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  const gate = await moduleGate(page)
  try {
    await mount(page)
    await expect.poll(() => gate.requests.length).toBe(1)
    const draft = page.getByRole('textbox', { name: '대화 초안' }); await draft.focus()
    for (const locale of locales) {
      await set(page, 'researchLoadLocale', locale)
      await expect(page.locator('[data-research-chart-load]')).toContainText(marketChartText(locale, 'rendererLoading'))
      await expect(draft).toBeFocused()
    }
    await page.evaluate(() => { const seed = Reflect.get(window, 'researchLoadSeed'); Reflect.get(window, 'researchLoadPrices')({ ...seed, bars: seed.bars.map((bar: Record<string, number>) => ({ ...bar, open: 201, high: 207, low: 200, close: 206 })) }) })
    await flush(page); expect(gate.requests).toHaveLength(1); expect(await charts(page)).toBe(0)
    await gate.settle()
    await expect(page.locator(`${mountSelector} canvas`).first()).toBeVisible()
    expect(await charts(page)).toBe(1)
    expect(await page.evaluate(() => Reflect.get(window, 'researchLoadCharts')[0].panes()[0].getSeries()[0].data().map((point: { close: number }) => point.close))).toEqual([206, 206])
    await expect(draft).toBeFocused(); await expect(draft).toHaveValue('보존할 대화 초안')
    expect(errors).toEqual([])
  } finally { gate.release() }
})

test('비활성 중 모듈 완료는 canvas0, 다시 열면 한 요청으로 생성하고 선택과 canvas를 유지한다', async ({ page }) => {
  const gate = await moduleGate(page)
  try {
    await mount(page); await expect.poll(() => gate.requests.length).toBe(1)
    await set(page, 'researchLoadActive', false); await flush(page); await gate.settle()
    expect(await charts(page)).toBe(0)
    await set(page, 'researchLoadActive', true)
    const canvas = page.locator(`${mountSelector} canvas`).first(); await expect(canvas).toBeVisible()
    const original = await canvas.elementHandle()
    await page.locator('[data-research-chart=prices]').focus(); await page.keyboard.press('End')
    await expect(page.locator('[data-chart-inspection=prices]')).toContainText('C 104')
    await set(page, 'researchLoadActive', false); await set(page, 'researchLoadLocale', 'en'); await set(page, 'researchLoadActive', true)
    await expect(canvas).toBeVisible(); expect(await canvas.evaluate((node, old) => node === old, original)).toBe(true)
    await expect(page.locator('[data-chart-inspection=prices]')).toContainText('C 104')
    expect(await charts(page)).toBe(1); expect(gate.requests).toHaveLength(1)
  } finally { gate.release() }
})

for (const retire of ['owner', 'unmount'] as const) test(`모듈 대기 중 ${retire} 퇴장 후 늦은 이전 차트 생성은 없다`, async ({ page }) => {
  const gate = await moduleGate(page), errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  try {
    await mount(page); await expect.poll(() => gate.requests.length).toBe(1)
    if (retire === 'owner') {
      await page.evaluate(() => { Reflect.get(window, 'researchLoadOwner')('owner-b'); Reflect.get(window, 'researchLoadPrices')(null) })
      await expect(page.locator('[data-chart-state=unavailable]')).toHaveCount(2)
    } else { await set(page, 'researchLoadUnmount'); await expect(page.locator('[data-native-research-charts]')).toHaveCount(0) }
    await flush(page); await gate.settle()
    expect(await charts(page)).toBe(0); await expect(page.locator('canvas')).toHaveCount(0); expect(errors).toEqual([])
  } finally { gate.release() }
})

test('모듈 실패도 공급 표와 초점을 유지하고 7언어의 명시 페이지 새로고침만 제공한다', async ({ page }) => {
  const gate = await moduleGate(page, true), errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  try {
    await mount(page); await expect.poll(() => gate.requests.length).toBe(1)
    const draft = page.getByRole('textbox', { name: '대화 초안' }); await draft.focus()
    await gate.settle(); await expect(page.locator('[data-research-chart-load]')).toHaveAttribute('data-research-chart-load', 'failed')
    for (const locale of locales) {
      await set(page, 'researchLoadLocale', locale)
      await expect(page.getByRole('alert')).toHaveText(marketChartText(locale, 'rendererFailed'))
      await expect(page.getByRole('button', { name: marketChartText(locale, 'rendererReload'), exact: true })).toBeVisible()
      await expect(draft).toBeFocused()
    }
    const details = page.locator('.g-chartbox').first().locator('details')
    await details.first().locator('summary').click(); await expect(details.first().locator('tbody tr')).toHaveCount(2)
    await details.nth(1).locator('summary').click(); await expect(details.nth(1)).toContainText('0.003 BTC')
    await expect(page.locator('.g-chartbox').first()).toContainText('공급 원문 가격')
    await expect(draft).toHaveValue('보존할 대화 초안'); expect(await charts(page)).toBe(0); expect(gate.requests).toHaveLength(1)
    let reloads = 0
    await page.route('**/research-chart-loading-host.html', async route => { reloads++; await route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body>명시 새로고침 도착</body></html>' }) })
    await flush(page); expect(reloads).toBe(0)
    await page.getByRole('button', { name: marketChartText('fr', 'rendererReload'), exact: true }).click()
    await expect(page.getByText('명시 새로고침 도착')).toBeVisible(); expect(reloads).toBe(1); expect(errors).toEqual([])
  } finally { gate.release() }
})
