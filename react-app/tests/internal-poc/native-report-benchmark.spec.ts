import { expect, test, type Page } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeJob, NativeReport } from '../../src/internal-poc/native-service-api'
import { displayOnlyRates } from './fixtures/display-only-rates'

test.use({ trace: 'off', screenshot: 'off', video: 'off' })
const envelope = (fixtures.sources[1].fixture as unknown as { response: { meta: unknown; data: NativeReport } }).response
const report = envelope.data
const queued = (fixtures.sources[3].fixture as unknown as { cases: { response: { data: NativeJob } }[] }).cases[0].response.data
// Presentation input only. Never a fabricated accepted v7 COMPLETED response.
const displayJob = { ...queued, state: 'COMPLETED', resultAvailable: true, nativeReportBinding: report.binding }
async function mount(page: Page, mode: 'original' | 'missing' | 'null' | 'error-once' | 'precise' = 'original') {
  let reports = 0
  const calls: string[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    calls.push(`${route.request().method()} ${path}`)
    expect(route.request().method()).toBe('GET')
    if (!path.endsWith('/native-report')) return route.abort()
    reports++
    if (mode === 'error-once' && reports === 1) return route.abort()
    const body = structuredClone(envelope)
    const metrics = body.data.nativeEnvelope.projection.segments[0].metrics as unknown as Record<string, unknown>
    if (mode === 'missing') delete metrics.buyAndHoldReturnRate
    if (mode === 'null') metrics.buyAndHoldReturnRate = null
    if (mode === 'precise') {
      // Tampered payload: the original receipt/hash must reject changed metrics.
      body.data.nativeEnvelope.projection.segments.forEach((segment, index) => {
        Object.assign(segment.metrics, displayOnlyRates[index])
      })
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body) })
  })
  await page.route('**/native-report-benchmark-test.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="background:#0f1012;color:#e3e3e3"><p>합성 계약 원본 표시 시험, 실제 성과 증거 아님</p><div id="root"></div></body></html>' }))
  await page.goto('/native-report-benchmark-test.html')
  await page.evaluate(async job => {
    const refreshPath = '/@react-refresh', runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const fontPath = '/node_modules/@fontsource-variable/noto-sans-kr/index.css'
    await import(/* @vite-ignore */ fontPath)
    const reactPath = '/@id/react', domPath = '/@id/react-dom/client', apiPath = '/src/internal-poc/native-service-api.ts', viewPath = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const { createNativeServiceApi } = await import(/* @vite-ignore */ apiPath), { NativeServiceResult } = await import(/* @vite-ignore */ viewPath)
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('root')).render((react.createElement ?? react.default.createElement)(NativeServiceResult, { api: createNativeServiceApi(), job }))
  }, displayJob)
  return calls
}
const benchmark = (page: Page) => page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: '매수·보유 수익률', exact: true }) })
// Independent golden for the frozen report: ratios 0.01 and 0.02.
const displayed = ['1.00%', '2.00%']
test('verified report connects original server benchmark to IS/OOS without a new delta or outcome claim', async ({ page }) => {
  expect(report.nativeEnvelope.projection.segments.map(item => item.metrics.buyAndHoldReturnRate)).toEqual(['0.01', '0.02'])
  const calls = await mount(page)
  await expect(benchmark(page).getByRole('cell')).toHaveText(displayed)
  await expect(page.getByRole('table').first().getByRole('columnheader')).toHaveText(['지표', 'IS', 'OOS'])
  await expect(page.getByText('합성 계약 fixture · 실제 시장 성과 아님', { exact: true })).toBeVisible()
  await expect(page.getByText(/누적 운용 실적으로 합산하지 않습니다/)).toBeVisible()
  await expect(page.getByText(/청산 검증 불가\(UNAVAILABLE\)/)).toBeVisible()
  await expect(page.getByRole('rowheader', { name: /초과 수익|알파|차이/ })).toHaveCount(0)
  expect(calls.some(call => call.startsWith('POST'))).toBe(false)
})
for (const mode of ['missing', 'null'] as const) test(`${mode} required benchmark: SDK rejects report, no fabricated zero or partial success`, async ({ page }) => {
  await mount(page, mode)
  await expect(page.getByText('검증된 보고서를 가져오지 못했습니다. 미확인 수치는 표시하지 않습니다.', { exact: true })).toBeVisible()
  await expect(benchmark(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
})
test('report network failure then explicit retry restores server benchmark', async ({ page }) => {
  await mount(page, 'error-once')
  await expect(page.getByRole('button', { name: '보고서 다시 조회', exact: true })).toBeVisible()
  await expect(benchmark(page)).toHaveCount(0)
  await page.getByRole('button', { name: '보고서 다시 조회', exact: true }).click()
  await expect(benchmark(page).getByRole('cell')).toHaveText(displayed)
})

test('수정된 지표는 원본 해시와 불일치하므로 SDK에서 거절한다', async ({ page }) => {
  await mount(page, 'precise')
  await expect(page.getByText('검증된 보고서를 가져오지 못했습니다. 미확인 수치는 표시하지 않습니다.', { exact: true })).toBeVisible()
  await expect(page.locator('.native-metric-raw')).toHaveCount(0)
})

test('검증된 보고서의 원비율을 추가 요청 없이 펼치고 접는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const calls = await mount(page)
  await expect(benchmark(page).getByRole('cell')).toHaveText(displayed)
  const raw = page.locator('.native-metric-raw')
  await expect(raw.locator('table')).not.toBeVisible()
  await raw.locator('summary').click()
  for (const [name, field] of [['수익률', 'netReturnRate'], ['매수·보유 수익률', 'buyAndHoldReturnRate'], ['MDD', 'maxDrawdownRate'], ['승률', 'winRate']] as const) {
    await expect(raw.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) }).getByRole('cell')).toHaveText(report.nativeEnvelope.projection.segments.map(item => item.metrics[field]))
  }
  const reads = [...calls]
  await raw.locator('summary').press('Enter')
  await expect(raw.locator('table')).not.toBeVisible()
  await raw.locator('summary').press('Enter')
  await expect(raw.locator('table')).toBeVisible()
  expect(calls).toEqual(reads)
  await expect.poll(() => page.locator('.native-service-result').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
  await page.evaluate(() => document.fonts.ready)
  await expect(raw.getByRole('region', { name: '원문 비율 표' })).toHaveAttribute('tabindex', '0')
  await page.locator('.native-service-result').screenshot({ path: info.outputPath('sdk-fixture-metric-rates-320.png') })
})
