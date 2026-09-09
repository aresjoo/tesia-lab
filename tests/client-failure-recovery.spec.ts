import { expect, test, type Page, type Locator } from '@playwright/test'

async function menu(page: Page) {
  await page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
}

async function seed(page: Page) {
  await page.addInitScript(() => {
    const turn = { id: 'turn', question: '비트코인 반등 전략', answer: '조건을 검토해보세요.', fullAnswer: '조건을 검토해보세요.', status: 'done', startedAt: 1, suggestions: [], phase: 'plan' }
    sessionStorage.setItem('teth-client-experience', JSON.stringify({ currentId: 'recovery', sessions: [{ id: 'recovery', title: '입력 복구 검수', idea: turn.question, draft: '계속 작성할 초안', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'conversation', researchStatus: '초안', turns: [turn], updatedAt: 1 }] }))
  })
  await page.goto('/')
}

async function composingEscape(field: Locator) {
  await field.dispatchEvent('compositionstart', { data: '가' })
  await field.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true, bubbles: true, cancelable: true })
  // Let global and React event handlers settle before checking preservation.
  await field.page().evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

test('공개 페이지 로드 실패는 대화를 언마운트하지 않고 저장 실패 중 초안도 복구한다', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('test storage unavailable') } })
  await page.locator('.client-home-content textarea').fill('저장되지 않아도 돌아와야 할 초안')
  await page.route('**/src/components/ClientPublicPages.tsx*', route => route.abort('failed'))
  await menu(page)
  await page.locator('.client-sidebar .client-drawer-links').getByRole('link', { name: 'TETH 정보', exact: true }).click()
  await expect(page.locator('.site-page-recovery')).toBeVisible()
  await expect(page.locator('.client-home-content textarea')).toHaveCount(1)
  await page.getByRole('link', { name: '대화로 돌아가기', exact: true }).click()
  await expect(page.locator('.client-home-content textarea')).toHaveValue('저장되지 않아도 돌아와야 할 초안')
  await expect(page.locator('.client-home-content textarea')).toBeVisible()
  await expect(page.locator('.client-source-main')).toBeFocused()
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[hidden],[inert]')))).toBe(false)
})

test('공개 페이지 직접 진입 실패는 복구 화면을 제공하고 새로고침 후 정상 진입한다', async ({ page }) => {
  await page.route('**/src/components/ClientPublicPages.tsx*', route => route.abort('failed'))
  await page.goto('/download/')
  await expect(page.getByRole('heading', { name: '페이지를 불러오지 못했습니다', exact: true })).toBeVisible()
  await expect(page.locator('.site-page-recovery')).toBeFocused()
  await page.unroute('**/src/components/ClientPublicPages.tsx*')
  await page.getByRole('button', { name: '페이지 새로고침', exact: true }).click()
  await expect(page.locator('.client-info-download')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

test('느린 공개 페이지에서 대화로 복귀하면 늦은 로드가 화면이나 초안을 덮지 않는다', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route('**/src/components/ClientPublicPages.tsx*', async route => { await gate; await route.continue() })
  await page.goto('/')
  await page.locator('.client-home-content textarea').fill('느린 로드 중에도 유지')
  await menu(page)
  await page.locator('.client-sidebar .client-drawer-links').getByRole('link', { name: 'TETH 정보', exact: true }).click()
  await expect(page.locator('.site-page-loading')).toBeVisible()
  await page.getByRole('link', { name: '대화로 돌아가기', exact: true }).click()
  const loaded = page.waitForResponse(response => response.url().includes('/src/components/ClientPublicPages.tsx'))
  release()
  await loaded
  await expect(page.locator('.client-home-content textarea')).toHaveValue('느린 로드 중에도 유지')
  await expect(page.locator('.client-home-content textarea')).toBeVisible()
  await expect(page.locator('.client-info-about')).toHaveCount(0)
  await expect(page.locator('.client-source-main')).toBeFocused()
})

for (const failure of [true, false]) {
  test(`도움말 ${failure ? '실패' : '지연'} 중에도 닫기와 입력 잠금 해제가 가능하다`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route('**/src/components/ClientPublicPages.tsx*', async route => { if (failure) await route.abort('failed'); else { await gate; await route.continue() } })
    await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '로컬 검수', email: 'review@example.test' })))
    await seed(page)
    await menu(page)
    await page.locator('[data-sidebar-action="settings"]').click()
    await page.getByRole('button', { name: '고객지원', exact: true }).click()
    const panel = page.locator(failure ? '.site-page-recovery' : '.site-page-loading')
    await expect(panel).toBeVisible()
    await expect(panel).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '대화로 돌아가기', exact: true })).toBeFocused()
    if (failure) {
      await page.setViewportSize({ width: 320, height: 180 })
      expect(await panel.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0)
      await panel.locator('h2').scrollIntoViewIfNeeded()
      await expect(panel.locator('h2')).toBeInViewport()
      await page.setViewportSize({ width: 390, height: 844 })
      await page.locator('.client-load-layer').click({ position: { x: 3, y: 3 } })
    } else await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => document.getElementById('root')?.inert)).toBe(false)
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await expect(page.locator((page.viewportSize()?.width ?? 0) <= 860 ? '.client-hamburger' : '.client-sidebar-bottom [data-sidebar-action="settings"]')).toBeFocused()
    if (!failure) {
      const loaded = page.waitForResponse(response => response.url().includes('/src/components/ClientPublicPages.tsx'))
      release()
      await loaded
    }
    await expect(page.locator('.g-composer textarea')).toHaveValue('계속 작성할 초안')
    await page.locator('.g-composer textarea').fill('복귀 후 편집 가능')
    expect(errors).toEqual([])
  })
}

test('로그인 입력의 조합 취소는 창을 닫지 않고 일반 Escape는 닫는다', async ({ page }) => {
  await page.goto('/')
  await page.locator('.client-login').click()
  const field = page.locator('.ca-auth input[type="email"]')
  await field.fill('draft@example.test')
  await composingEscape(field)
  await expect(field).toBeVisible()
  await expect(field).toHaveValue('draft@example.test')
  await field.dispatchEvent('compositionend')
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-auth')).toHaveCount(0)
})

test('언어 검색의 조합 취소는 패널과 검색어를 보존한다', async ({ page }) => {
  await page.goto('/about/')
  await page.locator('.public-language-trigger').click()
  const field = page.locator('#locale-language input')
  await field.fill('한국')
  await composingEscape(field)
  await expect(field).toBeVisible()
  await expect(field).toHaveValue('한국')
  await field.dispatchEvent('compositionend')
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
})

test('대화 메뉴 제목의 조합 취소는 편집을 끝내거나 제목을 바꾸지 않는다', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: '대화 메뉴', exact: true }).click()
  await page.getByRole('button', { name: '이름 변경', exact: true }).click()
  const field = page.getByRole('textbox', { name: '전략 이름', exact: true })
  await field.fill('아직 작성 중인 제목')
  await composingEscape(field)
  await expect(field).toBeVisible()
  await expect(field).toHaveValue('아직 작성 중인 제목')
  await field.dispatchEvent('compositionend')
  await page.keyboard.press('Escape')
  await expect(page.locator('.g-title')).toHaveText('입력 복구 검수')
})

test('연구 코멘트의 조합 취소는 초안을 보존하고 일반 Escape 이후에도 다시 편집한다', async ({ page }) => {
  await seed(page)
  await page.getByRole('button', { name: /Research Plan.*연구 계획/ }).click()
  await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click()
  const field = page.getByRole('textbox', { name: '진입 코멘트', exact: true })
  await field.fill('하락 후 반등 확인')
  await composingEscape(field)
  await expect(field).toBeVisible()
  await expect(field).toHaveValue('하락 후 반등 확인')
  await field.dispatchEvent('compositionend')
  await page.keyboard.press('Escape')
  await expect(field).toHaveCount(0)
  await page.getByRole('button', { name: '진입 수정 요청', exact: true }).click()
  await expect(field).toHaveValue('하락 후 반등 확인')
})
