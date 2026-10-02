import { expect, type Page } from '@playwright/test'

/** Follow the latest member settings route and open its explicit confirmation.
 * Callers still perform the final logout and assert actual SDK/controller effects.
 * A disabled logout is returned as-is, so busy-state assertions remain meaningful. */
export async function openNativeAccountMenu(page: Page) {
  await expect(page.locator('.client-service-app')).toBeVisible()
  const settings = page.locator('.client-settings-page')
  if (!await settings.isVisible()) {
    const trigger = page.locator('[data-sidebar-action="account"], [data-sidebar-action="profile-settings"]')
    if (!await trigger.isVisible()) await page.locator('.client-hamburger').click()
    await expect(trigger).toBeVisible()
    await trigger.click()
    await page.locator('.ca-settings [data-menu-action="settings"]').click()
  }
  await expect(settings).toBeVisible()
  if (!await settings.locator('a[href="#/settings/account"]').getAttribute('aria-current')) {
    if (!await settings.locator('a[href="#/settings/account"]').isVisible()) {
      const back = settings.locator('.stg-mback')
      if (await back.isVisible()) await back.click()
      else await settings.locator('.stg-tg').click()
    }
    await settings.locator('a[href="#/settings/account"]').click()
  }
  const confirmation = settings.locator('.stg-confirm')
  if (!await confirmation.isVisible()) {
    const trigger = settings.getByRole('button', { name: '로그아웃', exact: true })
    if (await trigger.isDisabled()) return trigger
    await trigger.click()
  }
  await expect(confirmation).toBeVisible()
  return confirmation.getByRole('button', { name: '로그아웃', exact: true })
}
