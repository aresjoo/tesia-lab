import { expect, test } from '@playwright/test'

for (const broken of ['applied', 'pending'] as const) test(`${broken} 손상 복원은 자동 저장하지 않고 명시 재검증 후에만 기록을 교체한다`, async ({ page }, testInfo) => {
  const id = `recover-${broken}`
  const p = { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: 1334 }
  const stored = JSON.stringify({ page: 'report', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1 }])), attempt: 1, workStep: 5, chartInterval: '1D', parameters: broken === 'applied' ? { ...p, endI: 999999 } : p, ...(broken === 'pending' ? { pendingParameters: { ...p, endI: 999999 } } : {}) })
  await page.addInitScript(({ id, stored }) => {
    if (sessionStorage.getItem('teth-client-experience')) return
    const turn = { id: 'turn', question: '반등 전략', answer: '계획', fullAnswer: '계획', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '손상 복구 검수', idea: '비트코인 반등', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'delegation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
    sessionStorage.setItem(`teth:client-delegation:${id}`, stored)
  }, { id, stored })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 320, height: 740 })
  await page.clock.install()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '전략 계약서', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('기존 기록은 보존')
  const notice = await page.getByRole('alert').boundingBox(), menu = await page.locator('.client-hamburger').boundingBox()
  expect(notice!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height + 4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  if (broken === 'pending') {
    await expect(page.locator('.tf-sum')).toContainText('추세 필터')
    await expect(page.locator('.tf-sum')).toContainText('2023. 3. 4.')
  }
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: testInfo.outputPath(`recovery-${broken}-320.png`), fullPage: true })
  await page.locator('.tf-sum').scrollIntoViewIfNeeded()
  for (const value of await page.locator('.tf-sum .r .v').all()) {
    const box = await value.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  }
  await page.screenshot({ path: testInfo.outputPath(`recovery-${broken}-contract-320.png`) })
  await page.clock.fastForward(10000)
  const raw = () => page.evaluate(id => sessionStorage.getItem(`teth:client-delegation:${id}`), id)
  expect(await raw()).toBe(stored)
  await page.reload()
  await expect(page.getByRole('button', { name: '전략 검증 시작', exact: true })).toBeVisible()
  expect(await raw()).toBe(stored)
  await page.getByRole('button', { name: '전략 검증 시작', exact: true }).click()
  await page.clock.fastForward(10000)
  await expect(page.getByRole('heading', { name: '검증 결과', exact: true })).toBeVisible()
  const updated = JSON.parse((await raw())!)
  expect(updated.parameters.endI).toBe(1334)
  expect(updated.pendingParameters).toBeUndefined()
  expect(updated.recoveryRequired).toBeUndefined()
  if (broken === 'pending') {
    expect(updated.parameters).toEqual(p)
    await expect(page.getByRole('button', { name: '리포트 보기', exact: true })).toBeVisible()
  }
  expect(errors).toEqual([])
})
