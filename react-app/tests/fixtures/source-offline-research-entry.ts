import { expect, type Page } from '@playwright/test'
import type { ClientSession } from '../../src/client-experience-store'
import { evaluateDelegation } from '../../src/client-delegation-engine'

const key = 'teth-client-experience'
const read = (page: Page): Promise<ClientSession> => page.evaluate(key => {
  const state = JSON.parse(sessionStorage.getItem(key)!)
  return state.sessions.find((session: { id: string }) => session.id === state.currentId)
}, key)
export async function settleOfflineResponse(page: Page) {
  await page.clock.fastForward(20_000)
  await page.clock.fastForward(2_000)
}

/** Use source scroll-up and its keyboard-focus reveal, without a forced click or changing presentation. */
export async function revealSourceNavigation(page: Page) {
  await page.locator('.client-source-app,.client-source-main,.g-scroll,.rw-scroll,.client-delegation,#research-main').evaluateAll(nodes => {
    for (const node of nodes) {
      node.scrollTop = 0
      node.dispatchEvent(new Event('scroll'))
    }
  })
  await page.locator('.client-hamburger').focus()
  await expect(page.locator('.client-hamburger')).not.toHaveClass(/client-hamburger-scroll-hidden/)
}

/** Fresh source 9fb intake, computed failure/recommendation, explicit TP12, pass report. No saved success seed. */
export async function finishSourceOfflineResearchPlan(page: Page) {
  for (const name of ['1시간마다', '-3% (표준)', '익절 +8% 설정']) {
    await page.getByRole('button', { name, exact: true }).click()
    await settleOfflineResponse(page)
  }
  const firstSession = await read(page), first = firstSession.inlineResults![0]
  expect(firstSession.inlineResults).toHaveLength(1)
  expect(first.parameters.tp).toBe(8)
  expect(evaluateDelegation(first.parameters, 5_000_000).score).toBeLessThan(80)
  await expect(page.getByRole('button', { name: '연구 계획서 크게 보기', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '추천 설정으로 다시 검증', exact: true }).click()
  await settleOfflineResponse(page)
  const recommended = await read(page)
  expect(recommended.inlineResults).toHaveLength(2)
  expect(recommended.inlineResults![0]).toEqual(first)
  expect(recommended.inlineResults![1].parameters.tp).toBe(8)
  expect(evaluateDelegation(recommended.inlineResults![1].parameters, 5_000_000).score).toBeLessThan(80)
  await expect(page.getByRole('button', { name: '연구 계획서 크게 보기', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: '조건을 직접 수정할게요', exact: true }).click()
  await settleOfflineResponse(page)
  await page.locator('.g-composer textarea').fill('익절 12%')
  await page.getByRole('button', { name: '메시지 보내기', exact: true }).click()
  await settleOfflineResponse(page)
  const passed = await read(page), record = passed.inlineResults!.at(-1)!
  expect(passed.inlineResults).toHaveLength(3)
  expect(passed.inlineResults!.slice(0, 2)).toEqual(recommended.inlineResults)
  expect(record.parameters.tp).toBe(12)
  expect(evaluateDelegation(record.parameters, 5_000_000).score).toBeGreaterThanOrEqual(80)
  expect(passed.turns.at(-1)?.backtestFlow).toBeUndefined()
  await page.getByRole('button', { name: '연구 계획서 크게 보기', exact: true }).click()
  await expect(page.getByRole('heading', { name: '연구 계획', exact: true })).toBeVisible()
  expect((await read(page)).researchPlanTurnId).toBe(record.turnId)
  return record
}

/** Compatibility lifecycle fixture only: reopen the same saved delegation, without claiming fresh source intake. */
export async function restoreSavedDelegationWorkspace(page: Page) {
  await page.addInitScript(() => {
    const restored = sessionStorage.getItem('test:restored-delegation-workspace')
    if (restored) {
      sessionStorage.setItem('teth-client-experience', restored)
      sessionStorage.removeItem('test:restored-delegation-workspace')
    }
  })
  await page.evaluate(key => {
    const state = JSON.parse(sessionStorage.getItem(key)!)
    const session = state.sessions.find((item: { id: string }) => item.id === state.currentId)
    session.workspace = 'delegation'
    sessionStorage.setItem('test:restored-delegation-workspace', JSON.stringify(state))
  }, key)
  await page.reload()
}
