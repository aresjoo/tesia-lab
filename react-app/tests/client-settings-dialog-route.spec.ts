import { expect, test } from '@playwright/test'

for (const kind of ['email', 'security', 'billing'] as const) for (const settle of ['Resolve','Reject']) test(`${kind} modal retires on mobile list navigation and ignores late ${settle}`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const file = kind === 'email' ? 'identity' : kind
  const tab = kind === 'email' ? 'account' : kind
  await page.goto(`/tests/fixtures/client-settings-${file}.html#/settings/${tab}`)
  if (kind === 'email') await page.locator('[data-email-settings] button').click()
  else if (kind === 'security') await page.getByRole('switch', { name: '2단계 인증', exact: true }).click()
  else { await page.locator('[data-billing-methods] button').click(); await page.getByRole('dialog').getByRole('button', { name: '결제 수단 추가', exact: true }).click() }
  const dialog = page.locator('dialog')
  if (kind === 'email') await dialog.getByRole('textbox').fill('new@example.invalid')
  await dialog.getByRole('button').last().click()
  const calls = kind === 'email' ? 'emailCalls' : kind === 'security' ? 'securityCalls' : 'billingCalls'
  await expect.poll(() => page.evaluate(name => Reflect.get(window, name)().length, calls)).toBe(1)
  await page.evaluate(() => { location.hash = '#/settings' })
  await expect(dialog).toHaveCount(0, { timeout: 5000 })
  await expect.poll(() => page.evaluate(name => Reflect.get(window, name)()[0].aborted, calls)).toBe(true)
  const navigation = page.locator(`.stg-navigation [data-settings-tab="${tab}"]`)
  await expect(navigation).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
  await page.evaluate(({kind,settle}) => Reflect.get(window, `${kind}${settle}`)(), {kind,settle})
  await expect(dialog).toHaveCount(0)
  await expect(navigation).toBeFocused()
  await navigation.click()
  await expect(page.locator('.stg-main h1')).toBeFocused()
  await expect(page.locator('.stg-main').getByRole('status')).toHaveCount(0)
})
