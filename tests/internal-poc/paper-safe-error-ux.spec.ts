import { expect, test } from '@playwright/test'

test('Paper 오류 projector는 raw 오류와 민감 문자열을 반환하지 않는다', async ({ page }) => {
  await page.goto('/internal-poc-fixture.html')
  const projected = await page.evaluate(async () => {
    const {
      describePaperCatalogIssue,
      describePaperExecutionFailure,
      describePaperSessionIssue,
    } = await import('/src/internal-poc/paper-service-status.ts')
    return {
      network: describePaperSessionIssue(new TypeError(
        'Failed to fetch https://owner.invalid/private?csrf=csrf_secret&cookie=session_secret',
      )),
      unknown: describePaperSessionIssue(new Error(
        'postgres://owner:password@private-db/internal response cookie=session_secret',
      )),
      catalog: describePaperCatalogIssue(new Error(
        'CATALOG_TEMPORARILY_UNAVAILABLE csrf_secret https://owner.invalid',
      )),
      execution: describePaperExecutionFailure(),
    }
  })

  expect(projected).toEqual({
    network: {
      title: 'Owner-local 서비스에 연결할 수 없습니다.',
      description: '연결이 끊겼거나 응답을 확인하지 못했습니다. 실행 결과를 추측하지 않습니다.',
      diagnosticCode: 'PAPER_CONNECTION_UNAVAILABLE',
    },
    unknown: {
      title: 'Paper 기록 상태를 확인하지 못했습니다.',
      description: '예상하지 못한 응답으로 현재 결과를 표시하지 않습니다.',
      diagnosticCode: 'PAPER_OPERATION_UNAVAILABLE',
    },
    catalog: {
      title: 'Artifact 목록을 불러오지 못했습니다.',
      description: '목록 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      diagnosticCode: 'PAPER_CATALOG_UNAVAILABLE',
    },
    execution: {
      title: 'Owner-local Paper 실행이 완료되지 않았습니다.',
      description: '엔진이 실패 상태를 반환했습니다. 내부 실패 정보는 화면에 표시하지 않습니다.',
      diagnosticCode: 'PAPER_EXECUTION_UNAVAILABLE',
    },
  })
  expect(JSON.stringify(projected)).not.toMatch(/owner\.invalid|csrf_secret|session_secret|private-db|password/)
})

test('Paper 오류 복구 버튼은 모바일에서 44px 이상이며 키보드 focus를 받는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 })
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

  const paper = page.getByRole('region', { name: '재시작 뒤에도 같은 기록 상태를 읽습니다.' })
  await paper.getByRole('button', { name: '기록 보기' }).click()
  await paper.getByRole('button', { name: '다음 기록 보기' }).click()
  await paper.getByRole('button', { name: '다음 기록 보기' }).click()
  const retry = paper.getByRole('button', { name: '초기화 후 재시도' })
  await expect(retry).toBeVisible()
  const box = await retry.boundingBox()
  expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(box?.width).toBeGreaterThanOrEqual(44)
  await retry.focus()
  await expect(retry).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
})
