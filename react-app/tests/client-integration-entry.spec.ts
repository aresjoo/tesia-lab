import { expect, test } from '@playwright/test'
import { RECORDED_BACKTEST_REPORT_FIXTURE } from '../src/reporting/backtest-report.fixture'
import { adaptPublicRecordedFixture, createMockReportState } from '../src/reporting/mock-report-boundary'
import type { RecordedBacktestFixture } from '../src/reporting/backtest-report.types'

test('원본 진입은 구 퍼널 코드나 실제 API를 요청하지 않는다', async ({ page }) => {
  const requests: string[] = []
  const errors: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.locator('.conversation-cosmos')).toHaveCSS('position', 'absolute')
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon-f260167.png')
  expect(requests).not.toContain('/src/main.tsx')
  expect(requests).not.toContain('/src/components/SignalCanvas.tsx')
  expect(requests).not.toContain('/src/dev/chart-workspace-preview.tsx')
  expect(requests).not.toContain('/src/dev/chart-workspace-fixture.ts')
  expect(requests.filter(path => path.startsWith('/api/'))).toEqual([])
  expect(errors).toEqual([])
})

for (const path of ['/?legacy-fixture=1', '/#/mock-strategy-flow', '/?legacy-fixture=1#/mock-strategy-flow']) {
  test(`이전 진입 주소 ${path}에서도 원본 React 앱을 연다`, async ({ page }) => {
    const requests: string[] = []
    const errors: string[] = []
    page.on('request', request => requests.push(new URL(request.url()).pathname))
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(path)
    await expect(page.locator('.client-source-app')).toBeVisible()
    await expect(page.locator('.tesia-header,.msj-compose')).toHaveCount(0)
    expect(requests).toContain('/src/client-bootstrap.tsx')
    expect(requests).not.toContain('/src/main.tsx')
    expect(requests.filter(path => path.startsWith('/api/'))).toEqual([])
    expect(errors).toEqual([])
  })
}

test('명시적인 개발용 차트 검수 진입점은 보존한다', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  await page.goto('/?chart-workspace-preview=1&legacy-fixture=1#/mock-strategy-flow')
  await expect(page.getByRole('heading', { name: '차트 작업 공간 검수' })).toBeVisible()
  await expect(page.locator('.client-source-app')).toHaveCount(0)
  expect(requests).toContain('/src/dev/chart-workspace-preview.tsx')
  expect(requests).not.toContain('/src/main.tsx')
  expect(requests.filter(path => path.startsWith('/api/'))).toEqual([])
})

test('진입 청크 로드 실패를 안내하고 새로 불러오면 원본 앱으로 복구한다', async ({ page }) => {
  await page.route(/\/src\/client-bootstrap\.tsx(?:\?.*)?$/, route => route.abort(), { times: 1 })
  await page.goto('/')
  await expect(page.getByRole('alert')).toHaveText('화면을 불러오지 못했습니다. 다시 시도해주세요.')
  await expect(page.locator('.client-source-app')).toHaveCount(0)
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click()
  await expect(page.locator('.client-source-app')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('production의 이전 주소와 개발용 query도 원본 앱만 연다', async ({ page }) => {
  const previewUrl = process.env.TETH_ENTRY_PREVIEW_URL
  test.skip(!previewUrl, '별도 production build preview URL을 지정한 검수에서 실행한다')
  const requests: string[] = []
  const errors: string[] = []
  page.on('request', request => requests.push(new URL(request.url()).pathname))
  page.on('pageerror', error => errors.push(error.message))
  for (const path of ['/?legacy-fixture=1', '/#/mock-strategy-flow', '/?chart-workspace-preview=1&legacy-fixture=1#/mock-strategy-flow']) {
    await page.goto(new URL(path, previewUrl!).href)
    await expect(page.locator('.client-source-app')).toBeVisible()
    await expect(page.locator('.tesia-header,.msj-compose,.bw-preview')).toHaveCount(0)
  }
  expect(requests.filter(path => path.startsWith('/api/'))).toEqual([])
  expect(errors).toEqual([])
})

// Preserve the current reporting safety boundaries independently of the
// removed funnel's synthetic approval/backtest journey.
const cloneReportFixture = (): RecordedBacktestFixture => structuredClone(RECORDED_BACKTEST_REPORT_FIXTURE)

test('공개 보고서는 ACTUAL 출처 위조를 fail-closed 한다', () => {
  const forged = cloneReportFixture()
  ;(forged.provenance as { source: string }).source = 'ACTUAL_GENERATED'
  expect(() => adaptPublicRecordedFixture(forged)).toThrow('REPORT_PUBLIC_BOUNDARY_VIOLATION')
  expect(createMockReportState(forged).status).toBe('INVALID')
})

test('공개 보고서는 알 수 없는 입력과 artifact URL 주입을 거부한다', () => {
  for (const query of ['?state=ready', '?state=', '?state', '?artifactUrl=https://example.com/result.json', '?state=loading&state=empty']) {
    expect(createMockReportState(cloneReportFixture(), query).status).toBe('ERROR')
  }
})

test('보고서 독립 진입의 주입 시도는 안전한 오류 상태를 표시한다', async ({ page }) => {
  await page.goto('/reporting-demo.html?artifactUrl=https://example.com/result.json')
  await expect(page.getByText('결과 화면을 불러오지 못했습니다.')).toBeVisible()
  await expect(page.getByText('허용되지 않은 보고서 입력을 안전하게 차단했습니다.')).toBeVisible()
  await expect(page.getByText('ACTUAL VERIFIED')).toHaveCount(0)
})
