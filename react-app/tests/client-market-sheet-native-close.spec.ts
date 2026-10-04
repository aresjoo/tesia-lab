import { expect, test } from '@playwright/test'

// Native dialog lifecycle, not an assertion of Android/WebKit device coverage.
for (const motion of ['reduce', 'no-preference'] as const)
for (const dismissal of ['escape', 'native-close'] as const) test(`programmatic sheet open → ${dismissal} releases native modality and React locks${motion === 'reduce' ? '' : ' without reduced motion'}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: motion })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '시트 검수', email: 'sheet-native@example.invalid' }))
  })
  await page.goto('/#/share')
  const trigger = page.getByRole('button', { name: /^시장: / })
  await expect(trigger).toBeVisible()
  const original = await page.evaluate(() => document.body.style.overflowY)
  // No pointer activation. Actual browser Escape remains unstubbed.
  await trigger.evaluate(node => node.click())
  const dialog = page.locator('dialog.client-sharing-sheet')
  await expect(dialog).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  if (dismissal === 'escape') await page.keyboard.press('Escape')
  else await dialog.evaluate(node => (node as HTMLDialogElement).close())
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe(original)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => document.body.style.overflowY)).toBe(original)
})

test('sheet heading pointer focus preserves reverse Tab order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '시트 검수', email: 'sheet-native@example.invalid' }))
  })
  await page.goto('/#/share')
  await page.getByRole('button', { name: /^시장: / }).click()
  const dialog = page.locator('dialog.client-sharing-sheet')
  await dialog.locator('.hd b').click()
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('option', { selected: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: '닫기', exact: true })).toBeFocused()
})
