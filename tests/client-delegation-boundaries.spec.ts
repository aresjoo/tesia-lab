import { expect, test, type Page } from '@playwright/test'

async function seed(page: Page, connect = false, blocked = false) {
  await page.addInitScript(({ connect, blocked }) => {
    const id = 'delegation-boundaries'
    if (!sessionStorage.getItem('teth-client-experience')) {
      const turn = { id: 'turn', question: '반등 전략', answer: '계획', fullAnswer: '계획', startedAt: 1, status: 'done', suggestions: [], phase: 'plan' }
      sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: id, homeDraft: '', sessions: [{ id, title: '위임 경계 검수', idea: '비트코인 반등', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'delegation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
      if (connect) sessionStorage.setItem(`teth:client-delegation:${id}`, JSON.stringify({ page: 'connect', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1 }])), attempt: 1, workStep: 5, chartInterval: '1D' }))
    }
    if (blocked) {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('teth:client-delegation:') && !sessionStorage.getItem('allow-delegation-write')) throw new DOMException('Blocked', 'QuotaExceededError')
        return original.call(this, key, value)
      }
    }
  }, { connect, blocked })
}

for (const navigation of ['history', 'internal']) {
  test(`위임 가이드는 ${navigation} 공개 페이지 이동 시 닫히고 복귀 후 다시 열린다`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await seed(page, true)
    await page.goto('/download/')
    await page.locator('a.web-start').click()
    await page.getByRole('button', { name: '무료로 시작', exact: true }).click()
    await page.getByRole('button', { name: '추천 Binance', exact: true }).click()
    await page.getByRole('button', { name: '가입 완료했어요', exact: true }).click()
    const uid = page.getByLabel('Binance UID', { exact: true })
    await uid.fill('123456')
    await page.getByRole('button', { name: 'UID가 어디 있어요?' }).click()
    await expect(page.locator('dialog:modal')).toHaveCount(1)
    if (navigation === 'history') await page.goBack()
    else await page.evaluate(() => { history.pushState({}, '', '/download/'); window.dispatchEvent(new Event('teth:navigate')) })
    await expect(page).toHaveURL(/\/download\//)
    await expect(page.locator('dialog:modal')).toHaveCount(0)
    await page.locator('a.web-start').click()
    await expect(uid).toHaveValue('123456')
    await page.getByRole('button', { name: 'UID가 어디 있어요?' }).click()
    await expect(page.locator('dialog:modal')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'UID가 어디 있어요?' })).toBeFocused()
    expect(errors).toEqual([])
  })
}

test('위임 답변은 저장 실패 중 대화 왕복에도 유지되고 쓰기 복구 후 저장된다', async ({ page }) => {
  await seed(page, false, true)
  await page.goto('/')
  await page.getByRole('button', { name: '이더리움', exact: true }).click()
  await page.getByRole('button', { name: '안전하게', exact: true }).click()
  await page.locator('.client-delegation .bk').click()
  await page.getByRole('button', { name: /^전략 맡기기/ }).click()
  await expect(page.getByRole('heading', { name: '어느 정도 예산으로 시작할까요?' })).toBeVisible()
  await expect(page.locator('.tf-intake-done')).toHaveCount(2)
  await expect(page.locator('.tf-intake-done').first()).toContainText('이더리움')
  await expect(page.getByRole('status').filter({ hasText: '브라우저 저장에 실패했습니다' })).toBeVisible()
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const notice = await page.locator('.tf-storage-notice').boundingBox()
    expect(notice).not.toBeNull()
    if (width <= 860) {
      const menu = await page.locator('.client-hamburger').boundingBox()
      expect(menu).not.toBeNull()
      expect(notice!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height + 4)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  }
  await page.evaluate(() => sessionStorage.setItem('allow-delegation-write', '1'))
  await page.getByRole('button', { name: '500만원', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: '브라우저 저장에 실패했습니다' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '어느 기간의 시장으로 검증할까요?' })).toBeVisible()
  await expect(page.locator('.tf-intake-done')).toHaveCount(3)
})

test('위임 임시 보관은 연구별로 분리되며 허용 필드만 복원하고 삭제 후 남지 않는다', async ({ page }) => {
  await seed(page, false, true)
  await page.goto('/')
  await page.locator('.client-delegation .bk').click()
  const result = await page.evaluate(async () => {
    const fixturePath = '/src/client-delegation-fixtures.ts'
    const storePath = '/src/client-experience-store.ts'
    const fixture = await import(fixturePath)
    const { createClientExperienceStore } = await import(storePath)
    const id = 'delegation-boundaries'
    const snapshot = { page: 'backtest', answers: Object.fromEntries(['asset', 'style', 'budget', 'period', 'stop'].map(key => [key, { index: 1, label: '무시할 라벨', recommended: false }])), questionIndex: 5, attempt: 1, workStep: 2, workStartedAt: 1000, expert: true, chartInterval: '1W', unexpected: '무시할 추가 필드' }
    const saved = fixture.saveDelegationUi(id, snapshot)
    fixture.saveDelegationUi('other-delegation', { ...snapshot, chartInterval: '1M' })
    const restored = fixture.readDelegationUi(id)
    const removed = createClientExperienceStore().remove(id)
    return { saved, restored, removed, deleted: fixture.readDelegationUi(id) ?? null, other: fixture.readDelegationUi('other-delegation')?.chartInterval }
  })
  expect(result.saved).toBe(false)
  expect(result.restored).toMatchObject({ page: 'backtest', workStep: 2, workStartedAt: 1000, chartInterval: '1W', answers: { asset: { label: '이더리움' } } })
  expect(Object.keys(result.restored).sort()).toEqual(['answers', 'attempt', 'chartInterval', 'expert', 'page', 'questionIndex', 'workStartedAt', 'workStep'])
  expect(JSON.stringify(result.restored)).not.toContain('무시할')
  expect(result.removed).toBe(true)
  expect(result.deleted).toBeNull()
  expect(result.other).toBe('1M')
})
