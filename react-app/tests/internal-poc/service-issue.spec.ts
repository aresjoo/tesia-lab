import { expect, test } from '@playwright/test'
import { ApiResponseError } from '../../src/internal-poc/contracts/generated/api-v0.1/client'
import { describeServiceIssue } from '../../src/internal-poc/service-status'
import { FIXTURE_RESPONSE_LOSS_KEY } from '../../src/internal-poc/fixture-adapter'

const SENTINEL = 'synthetic_private_detail_do_not_display'

for (const [status, expectedCode] of [
  [401, 'SESSION_REAUTH_REQUIRED'],
  [403, 'REQUEST_FORBIDDEN'],
  [409, 'REQUEST_STATE_CONFLICT'],
  [412, 'REQUEST_STATE_CONFLICT'],
  [429, 'REQUEST_RATE_LIMITED'],
  [500, 'SERVER_RESPONSE_UNCONFIRMED'],
  [503, 'SERVER_RESPONSE_UNCONFIRMED'],
] as const) test(`상태 ${status} 안내는 서버 원문을 숨기고 실행 여부를 단정하지 않는다`, () => {
  // Display projector only, not an assertion that every status is in the wire contract.
  const result = describeServiceIssue(new ApiResponseError(status, {
    meta: { apiContractVersion: '0.1.0', requestId: SENTINEL, traceId: SENTINEL, resourceRevision: null },
    error: { code: 'INTERNAL_ERROR', message: SENTINEL, field: SENTINEL },
  }), 'TEST_OPERATION_FAILED')
  expect(result.diagnosticCode).toBe(expectedCode)
  expect(result.requiresSessionRecovery).toBe(status === 401)
  expect(JSON.stringify(result)).not.toContain(SENTINEL)
  expect(result.description).not.toContain('실행하지 않았습니다')
  expect(result.title).not.toContain('설정')
})

test('로컬 저장 장애는 세션 만료나 API 설정 실패로 분류하지 않는다', () => {
  const result = describeServiceIssue(new Error('LOCAL_RECOVERY_STORAGE_UNAVAILABLE'), 'TEST_OPERATION_FAILED')
  expect(result).toMatchObject({ title: '진행 정보 저장 실패', requiresSessionRecovery: false, diagnosticCode: 'LOCAL_RECOVERY_STORAGE_UNAVAILABLE' })
  expect(result.description).toContain('승인 재개 정보')
})

test('미매핑 HTTP 상태도 SDK 진단코드만 남기고 서버 원문을 표시하지 않는다', () => {
  for (const status of [400, 404, 422]) {
    const result = describeServiceIssue(new ApiResponseError(status, {
      meta: { apiContractVersion: '0.1.0', requestId: SENTINEL, traceId: SENTINEL, resourceRevision: null },
      error: { code: 'INTERNAL_ERROR', message: SENTINEL.toUpperCase(), field: SENTINEL },
    }), 'TEST_OPERATION_FAILED')
    expect(result.diagnosticCode).toBe('INTERNAL_ERROR')
    expect(result.requiresSessionRecovery).toBe(false)
    expect(JSON.stringify(result).toLowerCase()).not.toContain(SENTINEL)
  }
})

test('원본 대화에서 승인 재개 중 메시지 수정은 잠그고 복사는 유지한다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html#/client')
  await page.locator('#strategy-idea').fill('BTC 15분 RSI 30 아래면 100 USDT 롱, 손절 2%, 익절 5%, 레버리지 2배')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  for (const reply of ['BTCUSDT', 'RSI 14', 'RSI(14)가 30 미만이면 롱']) {
    await page.getByRole('button', { name: reply, exact: true }).click()
  }
  await expect(page.getByRole('button', { name: '메시지 수정', exact: true }).first()).toBeEnabled()
  await page.getByRole('button', { name: '계약 검증', exact: true }).click()
  await page.getByRole('checkbox').check()
  await page.evaluate(key => sessionStorage.setItem(key, 'createApprovalChallenge'), FIXTURE_RESPONSE_LOSS_KEY)
  await page.getByRole('button', { name: '승인하고 백테스트', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('FIXTURE_RESPONSE_LOST_AFTER_COMMIT')
  await expect(page.locator('.g-composer textarea')).toBeDisabled()
  const edits = page.getByRole('button', { name: '메시지 수정', exact: true })
  await expect(edits).toHaveCount(4)
  for (const edit of await edits.all()) await expect(edit).toBeDisabled()
  await expect(page.getByRole('button', { name: '메시지 복사', exact: true }).first()).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
