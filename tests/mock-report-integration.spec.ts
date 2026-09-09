import { TEST_ORIGIN } from './test-origin'
import { expect, test } from '@playwright/test'
import { RECORDED_BACKTEST_REPORT_FIXTURE } from '../src/reporting/backtest-report.fixture'
import { adaptPublicRecordedFixture, createMockReportState } from '../src/reporting/mock-report-boundary'
import type { RecordedBacktestFixture } from '../src/reporting/backtest-report.types'

const cloneFixture = (): RecordedBacktestFixture => structuredClone(RECORDED_BACKTEST_REPORT_FIXTURE)

test('공개 Mock 경계는 ACTUAL 출처 위조를 fail-closed 한다', () => {
  const forged = cloneFixture()
  ;(forged.provenance as { source: string }).source = 'ACTUAL_GENERATED'
  expect(() => adaptPublicRecordedFixture(forged)).toThrow('REPORT_PUBLIC_BOUNDARY_VIOLATION')
  expect(createMockReportState(forged).status).toBe('INVALID')
})

test('알 수 없는 URL 입력과 artifact URL 주입을 거부한다', () => {
  expect(createMockReportState(cloneFixture(), '?state=ready').status).toBe('ERROR')
  expect(createMockReportState(cloneFixture(), '?state=').status).toBe('ERROR')
  expect(createMockReportState(cloneFixture(), '?state').status).toBe('ERROR')
  expect(createMockReportState(cloneFixture(), '?artifactUrl=https://example.com/result.json').status).toBe('ERROR')
  expect(createMockReportState(cloneFixture(), '?state=loading&state=empty').status).toBe('ERROR')
})

test('자연어 Mock 결과에서 recorded 보고서로 외부 요청 없이 이동한다', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith(TEST_ORIGIN)) externalRequests.push(request.url())
  })

  await page.goto('/#/mock-strategy-flow')
  await page.getByRole('button', { name: '예시 불러오기' }).click()
  await page.getByRole('button', { name: '전략으로 정리' }).click()
  await page.getByRole('button', { name: '안전한 수정안 비교' }).click()
  await page.getByRole('button', { name: '수정안 선택' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Mock 백테스트 시작' }).click()

  const reportLink = page.getByRole('link', { name: '별도 보고서 예시 보기' })
  await expect(reportLink).toBeVisible()
  await expect(page.getByText('RSI 과매도 회귀 · 15분봉 · 30일 고정 fixture')).toBeVisible()
  await reportLink.click()

  await expect(page).toHaveURL(/\/reporting-demo\.html$/)
  await expect(page.getByRole('heading', { level: 1, name: 'RSI 과매도 회귀 (시연용)' })).toBeVisible()
  await expect(page.getByText('시연 전용 · MOCK FIXTURE', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('ACTUAL VERIFIED', { exact: true })).toHaveCount(0)
  expect(externalRequests).toEqual([])
})

test('보고서 build entry의 주입 시도는 안전한 오류 상태를 표시한다', async ({ page }) => {
  await page.goto('/reporting-demo.html?artifactUrl=https://example.com/result.json')
  await expect(page.getByText('결과 화면을 불러오지 못했습니다.')).toBeVisible()
  await expect(page.getByText('허용되지 않은 보고서 입력을 안전하게 차단했습니다.')).toBeVisible()
  await expect(page.getByText('ACTUAL VERIFIED')).toHaveCount(0)
})
