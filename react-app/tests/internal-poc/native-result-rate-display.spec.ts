import { expect, test } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeReport } from '../../src/internal-poc/native-service-api'
import { displayOnlyRates } from './fixtures/display-only-rates'
import { nativeResultText } from '../../src/internal-poc/native-result-copy'

// Display-only boundary fixtures. These modified metrics are NOT accepted SDK
// reports or market results. Receipt/hash rejection is tested in benchmark.spec.
for (const width of [320, 1440]) for (const unsupported of [false, true]) test(`결과 비율의 정밀도와 원문 표시 ${width}px unsupported=${unsupported}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  const calls: string[] = []
  await page.route('**/api/**', route => { calls.push(route.request().url()); return route.abort() })
  await page.route('**/native-rate-display.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0f1012;color:#e3e3e3"><div id="root"></div></body></html>' }))
  await page.goto('/native-rate-display.html')
  await page.evaluate(async ({ data, rates, unsupported }) => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const fontPath = '/node_modules/@fontsource-variable/noto-sans-kr/index.css'
    await import(/* @vite-ignore */ fontPath)
    const reactPath = '/@id/react', domPath = '/@id/react-dom/client', viewPath = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const { NativeServiceResult } = await import(/* @vite-ignore */ viewPath)
    const report = (data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    report.nativeEnvelope.projection.segments.forEach((segment, index) => {
      Object.assign(segment.metrics, rates[index])
    })
    // Deliberately unsupported display input; the canonical API forbids exponents.
    if (unsupported) report.nativeEnvelope.projection.segments[0].metrics.netReturnRate = '1E-8'
    const api = { report: async () => report, trades: async () => { throw new Error('DISPLAY_ONLY') }, chart: async () => { throw new Error('DISPLAY_ONLY') } }
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('root')).render((react.createElement ?? react.default.createElement)(NativeServiceResult, { api, job: { backtestId: report.binding.backtestId } }))
  }, { data: fixtures, rates: displayOnlyRates, unsupported })
  const table = page.getByRole('table').first()
  const row = (name: string) => table.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) }).getByRole('cell')
  await expect(row('수익률')).toHaveText([unsupported ? '표시 범위 밖의 값, 원문 비율에서 확인' : '−0.01% 초과 · 0% 미만', '1.23%'])
  await expect(row('매수·보유 수익률')).toHaveText(['<0.01%', '1.24%'])
  await expect(row('MDD')).toHaveText(['0.00%', '0.00%'])
  const comparison = page.getByRole('region', { name: 'IS/OOS 비교 표', exact: true })
  await expect(comparison).toHaveAttribute('tabindex', '0')
  await comparison.focus()
  await page.keyboard.press('ArrowRight')
  await expect(comparison).toBeFocused()
  await expect(comparison).toHaveCSS('outline-width', '2px')
  const raw = page.locator('.native-metric-raw')
  await raw.locator('summary').click()
  for (const value of [unsupported ? '1E-8' : '-0.00000001', '0.00000001', '0.01234999999999999999', '0.01235']) {
    await expect(raw.getByRole('cell', { name: value, exact: true })).toBeVisible()
  }
  expect(calls).toEqual([])
  await expect.poll(() => page.locator('.native-service-result').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await expect(raw.locator('caption')).toContainText('×100 = %')
  await raw.locator('summary').focus()
  await page.keyboard.press('Tab')
  await expect(raw.getByRole('region', { name: '원문 비율 표' })).toBeFocused()
  await expect(raw.getByRole('region', { name: '원문 비율 표' })).toHaveCSS('outline-width', '2px')
  await expect(page.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeVisible()
  await page.locator('.native-service-result').screenshot({ path: info.outputPath(`display-only-metric-rates-${width}-${unsupported}.png`) })
  const originalRaw = await raw.locator('td').allTextContents()
  const originalTable = await table.elementHandle()
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await expect(row(nativeResultText(language, 'metricNetReturn'))).toHaveText([nativeResultText(language, unsupported ? 'rateOutOfRange' : 'tinyNegative'), '1.23%'])
    await expect(row(nativeResultText(language, 'metricBuyAndHold'))).toHaveText(['<0.01%', '1.24%'])
    expect(await raw.locator('td').allTextContents()).toEqual(originalRaw)
    expect(await table.evaluate((node, before) => node === before, originalTable)).toBe(true)
    await expect(raw.locator('[role="region"]')).toBeFocused()
    expect(calls).toEqual([])
  }
  await originalTable?.dispose()
})
