import { expect, test, type Page } from '@playwright/test'
import { finishSourceOfflineResearchPlan, restoreSavedDelegationWorkspace } from './fixtures/source-offline-research-entry'
import { billingPreviewStorageKey } from '../src/client-billing-preview-store'

const owner = 'billing-workspace@example.test', key = billingPreviewStorageKey(owner)
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-09-16T12:00:00Z') })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => {
    localStorage.setItem('tethLang', 'ko')
    if (!sessionStorage.getItem('teth-client-profile-preview')) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '작업 경계 검수', email: owner }))
  }, owner)
  await page.goto('/')
  await page.getByLabel('시장이나 전략에 대해 물어보세요', { exact: true }).fill('비트코인 과매도 반등 전략을 검증하고 싶어요')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await page.clock.fastForward(12_000)
}
async function billing(page: Page, kind: 'qa-watch' | 'qa-topup', id: string) {
  const result = await page.evaluate(async ({ owner, kind, id }) => {
    const path = '/src/client-billing-preview-store.ts'
    const { createBillingPreviewStore } = await import(/* @vite-ignore */ path)
    const result = createBillingPreviewStore(owner).dispatch({ kind }, Date.now(), id)
    // Ask the mounted hook to refresh through its normal visibility lifecycle.
    window.dispatchEvent(new Event('pageshow'))
    return result
  }, { owner, kind, id })
  expect(result.ok).toBe(true)
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).state.mode, key)).toBe(kind === 'qa-watch' ? 'watch' : 'active')
}
async function openPlan(page: Page) {
  await open(page)
  await finishSourceOfflineResearchPlan(page)
  await expect(page.getByRole('heading', { name: '연구 계획', exact: true })).toBeVisible()
}
const research = (page: Page) => page.evaluate(() => {
  const experience = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
  const current = experience.sessions.find((session: { id: string }) => session.id === experience.currentId)
  const scope = current.researchPlanTurnId === undefined ? current.id : `inline-plan:${JSON.stringify([current.id, current.researchPlanTurnId])}`
  return JSON.parse(sessionStorage.getItem(`teth-research-preview:restored:${scope}`) ?? 'null')
})
const delegation = (page: Page) => page.evaluate(() => {
  const experience = JSON.parse(sessionStorage.getItem('teth-client-experience')!)
  return JSON.parse(sessionStorage.getItem(`teth:client-delegation:${experience.currentId}`) ?? 'null')
})
function requestAudit(page: Page) {
  const requests: string[] = []
  page.on('request', request => { if (request.method() !== 'GET' || /\/api\//.test(request.url())) requests.push(request.url()) })
  return requests
}

test('관망중계획재열기·문서초안은보존하고새연구만막으며시작된95초작업은계속완료한다', async ({ page }) => {
  const requests = requestAudit(page)
  await openPlan(page)
  await billing(page, 'qa-watch', 'research-watch-before-start')
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await page.getByRole('button', { name: /연구 계획.*(?:확인|크게 보기)/ }).click()
  await expect(page.getByRole('heading', { name: '연구 계획', exact: true })).toBeVisible()
  const before = await research(page)
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '연구 시작', exact: true })).toBeVisible()
  await expect(page.locator('.rw-title')).not.toContainText('연구 진행 중')
  expect(await research(page)).toEqual(before)
  const question = page.getByLabel('연구 계획에 질문', { exact: true })
  await question.fill('이 문서 질문은 관망 중에도 지워지면 안 돼요')
  await page.getByRole('button', { name: '문서 질문 보내기', exact: true }).click()
  await expect(question).toHaveValue('이 문서 질문은 관망 중에도 지워지면 안 돼요')
  await expect(page.locator('.rw-user-message,.rw-answer')).toHaveCount(0)
  await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click()
  const comment = page.getByRole('textbox', { name: '진입 코멘트', exact: true })
  await comment.fill('진입 조건도 그대로 보존해주세요')
  await page.getByRole('button', { name: '적용', exact: true }).click()
  await expect(comment).toBeVisible()
  await expect(comment).toHaveValue('진입 조건도 그대로 보존해주세요')
  await expect(comment).toBeFocused()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await billing(page, 'qa-topup', 'research-recover')
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  await expect.poll(async () => (await research(page))?.status).toBe('playing')
  const startedAt = (await research(page)).clockStartedAt
  await billing(page, 'qa-watch', 'research-watch-after-start')
  await page.getByRole('button', { name: '대화로 돌아가기', exact: true }).click()
  await page.getByRole('button', { name: /연구 계획.*(?:확인|크게 보기)/ }).click()
  await expect(page.locator('.rw-title')).toContainText('연구 진행 중')
  await page.getByRole('tab', { name: '연구 계획', exact: true }).click()
  await expect(question).toHaveValue('이 문서 질문은 관망 중에도 지워지면 안 돼요')
  await page.getByRole('button', { name: '연구 과정 보기', exact: true }).click()
  expect((await research(page)).clockStartedAt).toBe(startedAt)
  await page.clock.fastForward(96_000)
  await expect.poll(async () => (await research(page))?.status).toBe('completed')
  await page.clock.fastForward(1_300)
  await expect(page.getByRole('heading', { name: '검증 무결성', exact: true })).toBeVisible()
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).state.mode, key)).toBe('watch')
  expect(requests).toEqual([])
})

test('저장된관망중위임계약복귀는허용하고검증시작·추천은상태보존하며기존검증타이머는완료한다', async ({ page }) => {
  const requests = requestAudit(page)
  await open(page)
  await restoreSavedDelegationWorkspace(page)
  await expect(page.getByRole('heading', { name: '어떤 자산으로 할까요?', exact: true })).toBeVisible()
  for (const name of ['비트코인', '중립적으로', '500만원', '최근 2년', '-5%까지']) await page.getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name: '전략 계약서', exact: true })).toBeVisible()
  await billing(page, 'qa-watch', 'delegation-watch-before-start')
  await page.locator('.client-delegation').getByRole('button', { name: '뒤로', exact: true }).click()
  await restoreSavedDelegationWorkspace(page)
  await expect(page.getByRole('heading', { name: '전략 계약서', exact: true })).toBeVisible()
  const contract = await delegation(page)
  await page.getByRole('button', { name: '전략 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '전략 계약서', exact: true })).toBeVisible()
  expect(await delegation(page)).toEqual(contract)
  await billing(page, 'qa-topup', 'delegation-recover')
  await page.getByRole('button', { name: '전략 검증 시작', exact: true }).click()
  await expect(page.getByRole('heading', { name: '검증 진행', exact: true })).toBeVisible()
  await billing(page, 'qa-watch', 'delegation-watch-during-work')
  await page.clock.fastForward(4_000)
  await expect(page.getByRole('heading', { name: '검증 결과', exact: true })).toBeVisible()
  const recommendation = page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true })
  await expect(recommendation).toBeVisible()
  const completed = await delegation(page)
  expect(completed.workStep).toBe(5)
  await recommendation.click()
  await expect(recommendation).toBeVisible()
  expect(await delegation(page)).toEqual(completed)
  await billing(page, 'qa-topup', 'recommend-recover')
  await recommendation.click()
  await page.clock.fastForward(4_000)
  await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toBeEnabled()
  expect((await delegation(page)).attempt).toBe(completed.attempt + 1)
  expect(requests).toEqual([])
})
