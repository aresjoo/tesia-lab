import { expect, test } from '@playwright/test'

test('v0.6 recorded 보고서는 정확한 구간, 비용, MMR 제한을 함께 표시한다', async ({ page }, testInfo) => {
  await page.goto('/reporting-demo.html')

  await expect(page.getByText('시연 전용 · MOCK FIXTURE', { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('source-disclosure')).toContainText('실제 730일 백테스트 결과나 투자 성과가 아닙니다.')
  await expect(page.getByRole('heading', { level: 1, name: 'RSI 과매도 회귀 (시연용)' })).toBeVisible()

  await expect(page.getByText('2024-08-27T00:15:00Z', { exact: true })).toBeVisible()
  await expect(page.getByText('2026-04-03T00:15:00Z', { exact: true })).toHaveCount(2)
  await expect(page.getByText('2026-08-27T00:15:00Z', { exact: true })).toBeVisible()
  await expect(page.getByText('56,064개', { exact: true })).toBeVisible()
  await expect(page.getByText('14,016개', { exact: true })).toBeVisible()

  await expect(page.getByTestId('metric-return')).toContainText('+8.40%')
  await expect(page.getByTestId('metric-return')).toContainText('+1.20%')
  await expect(page.getByTestId('metric-return')).toContainText('-7.20%p')
  await expect(page.getByTestId('metric-maximumDrawdown')).toContainText('5.20%')
  await expect(page.getByTestId('metric-maximumDrawdown')).toContainText('8.40%')
  await expect(page.getByTestId('metric-maximumDrawdown')).toContainText('+3.20%p')
  await expect(page.getByTestId('metric-return').locator('[data-impact]')).toHaveAttribute('data-impact', 'ADVERSE')
  await expect(page.getByTestId('metric-maximumDrawdown').locator('[data-impact]')).toHaveAttribute('data-impact', 'ADVERSE')
  await expect(page.getByTestId('metric-return').getByText('악화', { exact: true })).toBeVisible()
  await expect(page.getByTestId('metric-maximumDrawdown').getByText('악화', { exact: true })).toBeVisible()
  await expect(page.getByText('순수익률과 최대 낙폭은 관측 기간, 승률은 적은 거래 수의 영향을 받으므로 방향 참고용 비교이며, 거래 수는 차이를 계산하지 않습니다.', { exact: false })).toBeVisible()
  await expect(page.getByText('차이는 방향 참고용 비교값일 뿐 두 구간을 합친 성과나 인과 효과가 아닙니다.', { exact: false })).toBeVisible()
  await expect(page.getByTestId('metric-maximumDrawdown').getByText('5.20%', { exact: true })).toBeVisible()
  await expect(page.getByTestId('metric-maximumDrawdown').getByText('8.40%', { exact: true })).toBeVisible()
  const absoluteMetrics = page.getByRole('table', { name: '표본 내외 절대 총합 지표' })
  await expect(absoluteMetrics.getByRole('columnheader')).toHaveCount(3)
  await expect(absoluteMetrics).not.toContainText('OOS − IS')
  await expect(page.getByTestId('metric-tradeCount').locator('td')).toHaveCount(2)

  const costs = page.getByRole('table', { name: '표본 내외 비용 비교' })
  await expect(costs).toContainText('수수료')
  await expect(costs).toContainText('불리한 슬리피지')
  await expect(costs).toContainText('Funding 현금흐름')
  await expect(costs).toContainText('4.065')
  await expect(costs).toContainText('3.84')
  await expect(costs).toContainText('1.95')
  await expect(costs.locator('[role="columnheader"]')).toHaveCount(3)
  await expect(costs).not.toContainText('OOS − IS')
  await expect(costs).not.toContainText('-1.963')
  await expect(costs).not.toContainText('-1.89')
  await expect(costs).not.toContainText('+0.07')
  expect(await costs.getByRole('row').nth(1).evaluate((row) => (
    getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length
  ))).toBe(testInfo.project.name === 'mobile' ? 2 : 3)
  const costMarkup = await costs.evaluate((element) => element.outerHTML)
  expect(costMarkup).not.toContain('OOS − IS')
  expect(costMarkup).not.toContain('difference')
  await expect(page.getByText('+0.05%', { exact: true })).toHaveCount(2)

  const limitation = page.getByTestId('liquidation-limitation')
  await expect(limitation).toContainText('currentMmrVerified')
  await expect(limitation).toContainText('false')
  await expect(limitation).toContainText('liquidationCheckStatus')
  await expect(limitation).toContainText('UNAVAILABLE')
  await expect(limitation).toContainText('CURRENT_MMR_NOT_VERIFIED')
  await expect(limitation).toContainText('현재 Binance MMR과 과거 leverage bracket을 사용하거나 검증했다고 주장하지 않습니다.')

  await expect(page.getByRole('heading', { name: '구간별 검증 근거' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '거래 목록도 구간별로 분리' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'IS · 표본 내 거래 내역' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'OOS · 표본 외 거래 내역' })).toBeVisible()
  await expect(page.getByText('합산 성과가 아닙니다.', { exact: false })).toBeVisible()

  const markup = await page.locator('body').evaluate((element) => element.outerHTML)
  for (const forbidden of [
    'liquidationPrice',
    'liquidationDistance',
    'liquidationOccurred',
    'liquidationInvalid',
    '청산가',
    '청산 거리',
    '청산 발생',
    '청산 무효',
    'ACTUAL VERIFIED',
  ]) {
    expect(markup).not.toContain(forbidden)
  }
})

test('보고서 모바일 구조는 문서 가로 오버플로 없이 독립 비교 문맥을 보존한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 프로젝트 전용')
  await page.goto('/reporting-demo.html')

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  await expect(page.getByTestId('metric-return').locator('td').nth(0)).toHaveAttribute('data-label', 'IS · 표본 내')
  await expect(page.getByTestId('metric-return').locator('td').nth(1)).toHaveAttribute('data-label', 'OOS · 표본 외')
  expect(await page.getByRole('table', { name: '표본 내외 비용 비교' }).getByRole('row').nth(1).evaluate((row) => (
    getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length
  ))).toBe(2)
  expect(await page.getByTestId('metric-tradeCount').evaluate((row) => (
    getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean).length
  ))).toBe(2)
  await expect(page.getByText('MOCK FIXTURE', { exact: true })).toBeVisible()
})

for (const scenario of [
  { state: 'loading', text: '백테스트 artifact를 검증하고 있습니다.' },
  { state: 'empty', text: '표시할 백테스트 결과가 없습니다.' },
  { state: 'error', text: '결과 화면을 불러오지 못했습니다.' },
  { state: 'invalid', text: '결과가 표시 계약을 통과하지 못했습니다.' },
]) {
  test(scenario.state + ' 상태에서도 MOCK 경계와 안전한 안내를 표시한다', async ({ page }) => {
    await page.goto('/reporting-demo.html?state=' + scenario.state)
    await expect(page.getByText('시연 전용 · MOCK FIXTURE')).toBeVisible()
    await expect(page.getByText(scenario.text)).toBeVisible()
    await expect(page.getByText('ACTUAL VERIFIED')).toHaveCount(0)
  })
}

test('키보드 사용자는 본문 건너뛰기 링크와 명명된 표를 사용할 수 있다', async ({ page }) => {
  await page.goto('/reporting-demo.html')
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: '본문으로 건너뛰기' })
  await expect(skipLink).toBeFocused()
  await expect(page.getByRole('table', { name: '표본 내외 비교 가능 비율 지표' })).toBeVisible()
  await expect(page.getByRole('table', { name: '표본 내외 절대 총합 지표' })).toBeVisible()
  await expect(page.getByRole('table', { name: '표본 내외 비용 비교' })).toBeVisible()
})
