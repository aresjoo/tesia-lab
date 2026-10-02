import { expect, test } from '@playwright/test'

for (const width of [320, 1440]) test(`공개 설정 고객지원 ${width}px도 닫기 후 보이는 원본 진입점과 초안을 보존한다`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '도움말 검수', email: 'help-preview@example.test' })))
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  await input.fill('고객지원 이후에 보낼 질문')
  let settings = page.locator('[data-sidebar-action="account"]')
  if (width <= 860) { await page.locator('.client-hamburger').click(); settings = page.locator('[data-sidebar-action="profile-settings"]') }
  await settings.click()
  await page.locator('.ca-settings').getByRole('button', { name: '고객지원', exact: true }).click()
  const popup = page.locator('.client-modal-help .site-help-pop')
  await expect(popup.locator('.help-close')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(width === 320 ? page.locator('.client-hamburger') : settings).toBeFocused()
  await expect(input).toHaveValue('고객지원 이후에 보낼 질문')
  expect(await page.locator('.client-source-app').evaluate(node => (node as HTMLElement).inert)).toBe(false)
})

test('키보드로 연 도움말은 내용으로 진입하고 포인터 열기는 기존 초점을 유지한다', async ({ page }) => {
  for (const [index, route] of ['/', '/about/', '/download/', '/policies/'].entries()) {
    await page.goto(route)
    if (['/about/', '/download/', '/policies/'].includes(route) && (page.viewportSize()?.width ?? 0) <= 760) {
      const inline = page.getByRole('button', { name: '상담원에게 묻기', exact: true })
      await inline.focus()
      await page.keyboard.press('Enter')
      await expect(page.locator('.client-modal-help .help-close')).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(inline).toBeFocused()
      continue
    }
    const trigger = page.locator('.site-help-trigger')
    const popup = page.locator('.site-help-pop')
    await trigger.focus()
    await page.keyboard.press(index % 2 ? 'Space' : 'Enter')
    await expect(popup.locator('.help-close')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(popup.locator('a').first()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(popup.locator('a').last()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await trigger.click()
    await expect(popup).toBeVisible()
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(popup).toHaveCount(0)
  }
})

test('모바일 메뉴 뒤의 비활성 도움말은 메뉴 Escape로 닫히지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const trigger = page.locator('.site-help-trigger')
  const popup = page.locator('.site-help-pop')
  const menu = page.locator('.client-hamburger')
  await trigger.click()
  await menu.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.client-sidebar.mobile-open')).toBeVisible()
  await expect(popup).toHaveCount(1)
  await expect(popup).not.toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-sidebar.mobile-open')).toHaveCount(0)
  await expect(menu).toBeFocused()
  await expect(popup).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(popup).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('모바일 메뉴 배경 클릭도 비활성 도움말을 닫지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const popup = page.locator('.site-help-pop')
  await page.locator('.site-help-trigger').click()
  await page.locator('.client-hamburger').focus()
  await page.keyboard.press('Enter')
  await expect(popup).toHaveCount(1)
  await expect(popup).not.toBeVisible()
  await page.locator('.client-drawer-scrim').click({ position: { x: 380, y: 400 } })
  await expect(page.locator('.client-sidebar.mobile-open')).toHaveCount(0)
  await expect(popup).toBeVisible()
  // Once visible, its own outside click still dismisses it normally.
  await page.locator('#strategy-idea').click()
  await expect(popup).toHaveCount(0)
  await expect(page.locator('#strategy-idea')).toBeFocused()
})

test('앞의 언어 설정창이 닫혀도 도움말과 설정 버튼 초점은 보존된다', async ({ page }) => {
  // Latest source hides floating support on all three public mobile routes.
  // Overlapping nonmodal support/language panels are a desktop affordance;
  // mobile inline/modal support and return focus are exercised above.
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/about/')
  const popup = page.locator('.site-help-pop')
  await page.locator('.site-help-trigger').click()
  const language = page.locator('.public-language-trigger')
  await language.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.client-preferences-layer')).toBeVisible()
  await expect(popup).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.client-preferences-layer')).toHaveCount(0)
  await expect(language).toBeFocused()
  await expect(popup).toBeVisible()
})

test('본문의 조합 Escape는 열린 도움말로 초점을 빼앗지 않는다', async ({ page }) => {
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  await input.fill('작성 중인 질문')
  await page.locator('.site-help-trigger').click()
  await input.focus()
  const cdp = await page.context().newCDPSession(page)
  try {
    // Chromium composition state, not a native OS input-method certification.
    await cdp.send('Input.imeSetComposition', { text: '가', selectionStart: 1, selectionEnd: 1 })
    const draft = await input.inputValue()
    await page.keyboard.press('Escape')
    await expect(page.locator('.site-help-pop')).toBeVisible()
    await expect(input).toBeFocused()
    await expect(input).toHaveValue(draft)
    await cdp.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 })
  } finally { await cdp.detach() }
  await page.keyboard.press('Escape')
  await expect(page.locator('.site-help-pop')).toHaveCount(0)
})
