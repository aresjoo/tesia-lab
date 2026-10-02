import { TEST_ORIGIN } from '../test-origin'
import { expect, test, type Page } from '@playwright/test'
import { RECORDED_PAPER_UI_STORAGE_KEY } from '../../src/internal-poc/recorded-paper-session-adapter'

const completeRecordedBacktest = async (page: Page) => {
  await page.goto('/internal-poc-fixture.html')
  await page.getByRole('button', { name: /지원 전략 예시 넣기/ }).click()
  await page.getByRole('button', { name: '보내기' }).click()
  await page.getByRole('button', { name: 'BTCUSDT', exact: true }).click()
  await page.getByRole('button', { name: 'RSI 14', exact: true }).click()
  await page.getByRole('button', { name: 'RSI(14)가 30 미만이면 롱', exact: true }).click()
  await page.getByRole('button', { name: '계약 검증' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: '승인하고 백테스트' }).click()
  await expect(page.getByRole('heading', { name: '실행 완료' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })).toBeVisible()
}

test('compiler-compatible recorded 흐름은 UI cursor만 복원하고 terminal 결과를 노출하지 않는다', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== TEST_ORIGIN) externalRequests.push(request.url())
  })

  await completeRecordedBacktest(page)

  const paper = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(paper.getByText('SYNTHETIC_RECORDED_MARKET_FIXTURE · UNVERIFIED · PRIVATE_ONLY')).toBeVisible()
  await expect(paper.getByText(/원본 artifact와 결속되지 않은 UI 상태 시연/)).toBeVisible()
  await expect(paper.getByText('exitRulesEvaluated=false')).toBeVisible()
  await expect(paper.getByText(/exit_stop, exit_take/)).toBeVisible()
  await paper.getByRole('button', { name: '기록 보기' }).click()
  await expect(paper.getByText('Checkpoint revision 1').first()).toBeVisible()
  await paper.getByRole('button', { name: '다음 기록 보기' }).click()
  await expect(paper.getByText('재시작 복원 · revision 2').first()).toBeVisible()
  await paper.getByRole('button', { name: '다음 기록 보기' }).click()
  await expect(paper.getByText('PAPER_RESULT_UNAVAILABLE')).toBeVisible()
  await expect(paper.getByText('COMPLETED_LOCAL_FIXTURE_ONLY', { exact: true })).toHaveCount(0)
  await expect(paper.getByLabel('Paper ledger 요약')).toHaveCount(0)
  expect(externalRequests).toEqual([])

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(hasHorizontalOverflow).toBe(false)

  await page.evaluate((key) => sessionStorage.setItem(key, JSON.stringify({
    version: 'paper-ui-cursor/1',
    requestedStrategy: {
      strategyVersionId: 'sv_fixture_00000001',
      semanticHash: '0'.repeat(64),
    },
    stage: 'RESTART_RESTORED',
  })), RECORDED_PAPER_UI_STORAGE_KEY)
  await page.reload()
  const failedPaper = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await expect(failedPaper.getByText('Paper 기록의 무결성을 확인하지 못했습니다.')).toBeVisible({ timeout: 15_000 })
  await expect(failedPaper.getByText('PAPER_RECORD_UNTRUSTED')).toBeVisible()
  await expect(failedPaper).not.toContainText('PAPER_UI_REQUESTED_STRATEGY_BINDING_MISMATCH')
  await failedPaper.getByRole('button', { name: '초기화 후 재시도' }).click()
  await expect(failedPaper.getByRole('button', { name: '기록 보기' })).toBeVisible()
})

test('source-bound artifact가 없는 recorded fallback은 exact 전략에서도 terminal로 승격하지 않는다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  const result = await page.evaluate(async () => {
    const {
      createRecordedPaperSessionAdapter,
      resetRecordedPaperSessionState,
    } = await import('/src/internal-poc/recorded-paper-session-adapter.ts')
    resetRecordedPaperSessionState()
    const adapter = await createRecordedPaperSessionAdapter()
    const strategy = {
      strategyVersionId: 'sv_fixture_00000001',
      semanticHash: '39cbfd0090218a159ae03ef11e9d686482a644772dab291b03b864658caf2e46',
    }
    let mismatchError: string | null = null
    try {
      await adapter.startSession({ ...strategy, semanticHash: '0'.repeat(64) }, { csrfToken: 'unused_fixture_token' })
    } catch (reason) {
      mismatchError = reason instanceof Error ? reason.message : 'UNKNOWN'
    }
    const first = await adapter.startSession(strategy, { csrfToken: 'unused_fixture_token' })
    const second = await adapter.refreshSession(first.snapshot!.sessionId, strategy)
    let error: string | null = null
    try {
      await adapter.refreshSession(second.snapshot!.sessionId, strategy)
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'UNKNOWN'
    }
    return { mismatchError, first: first.snapshot?.stage, second: second.snapshot?.stage, error }
  })
  expect(result).toEqual({
    mismatchError: 'PAPER_RECORDED_FIXTURE_STRATEGY_MISMATCH',
    first: 'CHECKPOINT_RECORDED',
    second: 'RESTART_RESTORED',
    error: 'PAPER_RECORDED_ARTIFACT_AUTHORITY_MISSING',
  })
})
