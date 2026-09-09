import { expect, test } from '@playwright/test'

for (const surface of ['login', 'settings', 'feedback', 'profile'] as const) {
  test(`${surface} 배경 클릭 후 보이는 진입 버튼으로 포커스를 돌려준다`, async ({ page }) => {
    if (surface === 'profile') await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '검수 계정', email: 'review@example.test' })))
    // The phone feedback sheet occupies the full width; use its exposed tablet
    // backdrop for the mobile branch rather than clicking inside the sheet.
    if (surface === 'feedback' && (page.viewportSize()?.width ?? 0) <= 860) await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    const mobile = (page.viewportSize()?.width ?? 0) <= 860
    if (surface !== 'login') await page.locator(mobile ? '.client-hamburger' : '.client-rail-logo-row button').click()
    const trigger = surface === 'login' ? page.locator('.client-login') : page.locator(`[data-sidebar-action="${surface === 'profile' ? 'account' : 'settings'}"]`)
    await trigger.click()
    if (surface === 'feedback') await page.locator('.ca-settings').getByRole('button', { name: '의견 보내기', exact: true }).click()
    const layer = page.locator(surface === 'login' ? '.ca-auth-veil' : surface === 'feedback' ? '.ca-feedback-layer' : '.ca-menu-layer')
    await expect(layer).toBeVisible()
    // Genuine pointer events: dispatchEvent would skip browser focus defaults.
    await layer.click({ position: { x: 3, y: 3 } })
    await expect(layer).toHaveCount(0)
    const fallback = page.locator(mobile ? '.client-hamburger' : '[data-sidebar-action="settings"]')
    await expect(surface === 'feedback' || (mobile && surface !== 'login') ? fallback : trigger).toBeFocused()
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[hidden],[inert]')))).toBe(false)
    await expect.poll(() => page.evaluate(() => document.getElementById('root')?.inert)).toBe(false)
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  })
}

test('로그인 내부 포인터 조작은 입력 포커스와 기존 닫기 동작을 유지한다', async ({ page }) => {
  await page.goto('/')
  const trigger = page.locator('.client-login')
  await trigger.click()
  const field = page.locator('.ca-auth input[type="email"]')
  await field.click()
  await expect(field).toBeFocused()
  await field.fill('draft@example.test')
  await page.locator('.ca-auth .au-title').click()
  await expect(field).toBeVisible()
  await expect(field).toHaveValue('draft@example.test')
  await page.locator('.ca-auth .au-x').click()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})
