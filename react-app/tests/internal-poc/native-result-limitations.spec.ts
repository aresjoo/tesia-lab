import { test, expect } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeReport } from '../../src/internal-poc/native-service-api'

test.beforeEach(async ({ page }) => {
  await page.route('**/native-result-display-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body>합성 결과 표시 시험</body></html>' }))
  await page.goto('/native-result-display-test.html')
  await page.evaluate(async data => {
    const refreshPath = '/@react-refresh'
    const runtime = (await import(/* @vite-ignore */ refreshPath)).default
    runtime.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const reactPath = '/@id/react', domPath = '/@id/react-dom/client', panelPath = '/src/internal-poc/NativeServiceResult.tsx'
    const react = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const { NativeServiceResult } = await import(/* @vite-ignore */ panelPath)
    const report = (data.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
    const api = { report: async () => report, trades: async () => ({ trades: [], nextCursor: 'synthetic_display_cursor' }),
      chart: async () => { throw new Error('SYNTHETIC_CHART_UNAVAILABLE') } }
    const root = document.createElement('div'); document.body.append(root)
    // Isolated display fixture, not SDK validation, actual source evidence or a backend journey.
    ;(dom.createRoot ?? dom.default.createRoot)(root).render((react.createElement ?? react.default.createElement)(NativeServiceResult, { api, job: { backtestId: report.binding.backtestId } }))
  }, fixtures)
})

test('non-causal execution, historical rules, minute drawdown and independent segments are visible without expanding details', async ({ page }) => {
  const limitations = page.getByRole('region', { name: '백테스트 계산 가정과 한계' })
  await expect(limitations.getByText(/비인과적 재실행 기준/)).toBeVisible()
  await expect(limitations.getByText(/같은 가격으로 체결할 수 있는지 검증한 결과가 아닙니다/)).toBeVisible()
  await expect(limitations.getByText(/과거 각 시점의 거래 규칙과 일치하는지는 검증하지 않았습니다/)).toBeVisible()
  await expect(limitations.getByText(/분 안에서 발생한 최대 낙폭은 검증하지 않았습니다/)).toBeVisible()
  await expect(limitations.getByText(/누적 운용 실적으로 합산하지 않습니다/)).toBeVisible()
  await expect(page.getByText('합성 계약 fixture · 실제 시장 성과 아님')).toBeVisible()
  await expect(page.getByText(/청산 검증 불가\(UNAVAILABLE\)/)).toBeVisible()
})

test('initial capital and final equity retain each segment server decimal bytes', async ({ page }) => {
  const report = (fixtures.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
  for (const [name, field] of [['초기 자본 (USDT)', 'initialCapital'], ['최종 자산 (USDT)', 'finalEquity']] as const) {
    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name, exact: true }) })
    await expect(row.getByRole('cell')).toHaveText(report.nativeEnvelope.projection.segments.map(segment => segment.metrics[field]))
  }
})

test('details retain exact server policies for both segments', async ({ page }) => {
  const report = (fixtures.sources[1].fixture as unknown as { response: { data: NativeReport } }).response.data
  const limitations = page.getByRole('region', { name: '백테스트 계산 가정과 한계' })
  await limitations.getByText('서버가 제공한 계산 정책').click()
  await expect(limitations.getByText(report.nativeEnvelope.projection.splitPolicy, { exact: true })).toBeVisible()
  for (const item of report.nativeEnvelope.projection.segments) {
    const entry = limitations.locator('dl').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${item.segment} 정책$`) }) })
    await expect(entry).toContainText(item.initialStatePolicy)
    await expect(entry).toContainText(item.limitations.executionPricePolicy)
    await expect(entry).toContainText(item.limitations.symbolRuleHistoricalAccuracy)
    await expect(entry).toContainText(item.limitations.maxDrawdownSampling)
    await expect(entry).toContainText('intraminuteDrawdownVerified=false')
  }
})

test('an empty page never claims the complete segment has no trades', async ({ page }) => {
  await expect(page.getByText('현재 페이지에는 거래가 없습니다.', { exact: false })).toBeVisible()
  await expect(page.getByText('이 구간에는 거래가 없습니다.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '다음 거래 페이지' })).toBeVisible()
})
