import { expect, test, type Page } from '@playwright/test'

async function openResearchChart(page: Page) {
  await page.clock.install()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.locator('.client-home-content textarea').fill('비트코인 과매도 반등 전략을 검증하고 싶어요')
  await page.locator('.client-home-content textarea').press('Enter')
  await page.clock.fastForward(12_000)
  for (const choice of ['1시간', '−3% (표준)', '익절 +8% 설정']) {
    await page.getByRole('button', { name: choice, exact: true }).click()
    await page.clock.fastForward(12_000)
  }
  await page.getByRole('button', { name: /Research Plan.*연구 계획 확인/ }).click()
  await page.getByRole('button', { name: '연구 시작', exact: true }).click()
  await page.clock.fastForward(97_000)
  await page.getByRole('button', { name: '차트로 자세히 보기' }).click()
  await expect(page.locator('.ra-chart canvas').first()).toBeVisible()
}

test('연구 차트 크기 관찰은 알림 중 DOM을 다시 변경하지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeObserver = window.ResizeObserver
    const observations = { deliveries: 0, synchronousMutations: 0 }
    Object.assign(window, { researchResizeObservations: observations })
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          const chart = entries.find(entry => entry.target.matches('.ra-chart'))?.target
          if (!chart) { callback(entries, observer); return }
          observations.deliveries++
          const mutations = new MutationObserver(() => {})
          mutations.observe(chart, { attributes: true, childList: true, subtree: true })
          try { callback(entries, observer) }
          finally {
            observations.synchronousMutations += mutations.takeRecords().length
            mutations.disconnect()
          }
        })
      }
    }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openResearchChart(page)
  for (const width of [1440, 1024, 390, 768, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.locator('.ra-chart').evaluate(node => {
      const table = node.querySelector('table')!
      return Math.abs(table.getBoundingClientRect().width - node.clientWidth)
    })).toBeLessThanOrEqual(2)
  }
  const observations = await page.evaluate(() => (window as Window & {
    researchResizeObservations: { deliveries: number; synchronousMutations: number }
  }).researchResizeObservations)
  expect(observations.deliveries).toBeGreaterThan(1)
  expect(observations.synchronousMutations).toBe(0)
  expect(errors).toEqual([])
})

test('연구 차트는 모바일 숨김·복귀와 재생·종료 후에도 크기와 초안을 보존한다', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openResearchChart(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.ra-ledger > button').nth(2).click()
  for (const width of [320, 768, 390]) {
    await page.getByRole('button', { name: '대화 이어가기', exact: true }).click()
    await page.locator('#ra-question').fill('크기가 바뀌어도 보존할 질문')
    await page.setViewportSize({ width, height: 900 })
    await page.getByRole('button', { name: '차트·거래', exact: true }).click()
    await expect(page.locator('.ra-ledger > button').nth(2)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => page.locator('.ra-chart').evaluate(node => {
      const rect = node.querySelector('table')!.getBoundingClientRect()
      return Math.max(Math.abs(rect.width - node.clientWidth), Math.abs(rect.height - node.clientHeight))
    })).toBeLessThanOrEqual(2)
  }
  await page.getByRole('button', { name: '거래 재생', exact: true }).click()
  await page.clock.runFor(800)
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.getByRole('button', { name: '결과 재생 건너뛰기' }).click()
  await expect(page.locator('#ra-question')).toHaveValue('크기가 바뀌어도 보존할 질문')
  await page.setViewportSize({ width: 1200, height: 800 })
  await page.getByRole('button', { name: 'Final Report로 돌아가기' }).click()
  await page.clock.runFor(300)
  await expect(page.locator('.ra-chart canvas')).toHaveCount(0)
  await expect(page.getByLabel('Final Report에 질문')).toHaveValue('크기가 바뀌어도 보존할 질문')
  expect(errors).toEqual([])
})
