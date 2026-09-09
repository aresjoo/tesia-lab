import { TEST_ORIGIN } from './test-origin'
import { expect, test } from '@playwright/test'

const openMockFlow = async (page: import('@playwright/test').Page) => {
  await page.goto('/#/mock-strategy-flow')
  await expect(page.getByRole('heading', { name: '어떤 매매를 해보고 싶나요?' })).toBeVisible()
}

test('자연어 아이디어부터 승인된 Mock 백테스트 결과까지 완주한다', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith(TEST_ORIGIN)) externalRequests.push(request.url())
  })
  await openMockFlow(page)
  await expect(page.locator('.msj-compose')).toHaveAttribute('data-state', 'empty')

  await page.getByRole('button', { name: '전략으로 정리' }).click()
  await expect(page.getByRole('alert')).toContainText('전략 아이디어를 한 문장 이상')

  await page.getByRole('button', { name: '예시 불러오기' }).click()
  await page.getByRole('button', { name: '전략으로 정리' }).click()
  await expect(page.getByRole('heading', { name: '말씀하신 내용을 이렇게 이해했어요.' })).toBeVisible()
  await expect(page.getByText('BTC 추세 전환 매수 · 변동성 방어')).toBeVisible()

  await page.getByRole('button', { name: '안전한 수정안 비교' }).click()
  await expect(page.getByRole('heading', { name: '의도는 유지하고 위험 조건을 명확히 했어요.' })).toBeVisible()
  await expect(page.locator('.msj-diff-list article')).toHaveCount(3)

  await page.getByRole('button', { name: '수정안 선택' }).click()
  const startButton = page.getByRole('button', { name: 'Mock 백테스트 시작' })
  await expect(startButton).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(startButton).toBeEnabled()
  await startButton.click()

  await expect(page.getByRole('heading', { name: '수익 가능성보다 약한 구간을 먼저 확인하세요.' })).toBeVisible()
  await expect(page.getByText('조건부 통과')).toBeVisible()
  await expect(page.getByText('+24.8%')).toBeVisible()
  await expect(page.getByRole('note', { name: '별도 합성 보고서 안내' })).toContainText('지금 만든 전략의 상세 결과가 아닙니다.')
  await expect(page.getByRole('link', { name: '별도 보고서 예시 보기' })).toHaveAttribute('href', '/reporting-demo.html')
  await expect(page.getByRole('button', { name: '실제 실행은 아직 잠김' })).toBeDisabled()
  expect(externalRequests).toEqual([])
})

test('Mock 생성 오류와 백테스트 오류를 재시도할 수 있다', async ({ page }) => {
  await openMockFlow(page)
  await page.getByRole('button', { name: '예시 불러오기' }).click()
  await page.getByRole('button', { name: 'Mock 오류 재현' }).click()
  await expect(page.getByRole('alert')).toContainText('Mock AI 응답을 불러오지 못했습니다.')

  await page.getByRole('button', { name: '전략으로 정리' }).click()
  await page.getByRole('button', { name: '안전한 수정안 비교' }).click()
  await page.getByRole('button', { name: '수정안 선택' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Mock 실패 1회 재현' }).click()

  await expect(page.getByRole('alert')).toContainText('Mock 시계열 처리 중 연결이 끊겼습니다.')
  await page.getByRole('button', { name: '같은 버전 재시도' }).click()
  await expect(page.getByRole('heading', { name: '수익 가능성보다 약한 구간을 먼저 확인하세요.' })).toBeVisible()
})

test('모바일에서 가로 넘침 없이 결과와 초기화 상태를 표시한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '모바일 프로젝트에서만 확인')
  await openMockFlow(page)
  await page.getByRole('button', { name: '예시 불러오기' }).click()
  await page.getByRole('button', { name: '전략으로 정리' }).click()
  await page.getByRole('button', { name: '안전한 수정안 비교' }).click()
  await page.getByRole('button', { name: '수정안 선택' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Mock 백테스트 시작' }).click()
  await expect(page.getByRole('heading', { name: '수익 가능성보다 약한 구간을 먼저 확인하세요.' })).toBeVisible()

  const viewport = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(viewport.width).toBeLessThanOrEqual(viewport.client)

  await page.getByRole('button', { name: '새 아이디어로 초기화' }).click()
  await expect(page.locator('.msj-compose')).toHaveAttribute('data-state', 'empty')
})
