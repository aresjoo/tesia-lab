import { expect, test } from '@playwright/test'

for (const width of [320, 390, 1440]) test(`settings ${width}px keeps the final source back icon and host return`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 500 ? 844 : 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/tests/fixtures/client-settings-plan.html?host=service#/settings')

  const settings = page.locator('.client-settings-page')
  const navigation = settings.locator('.stg-navigation')
  const back = navigation.locator('.stg-back')
  const backIcon = back.locator('svg')
  await expect(settings).toBeVisible()
  await expect(navigation).toBeVisible()
  if (width <= 900) {
    await expect(settings.locator('.stg-main')).toBeHidden()
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(0)
  }

  await expect(backIcon).toHaveAttribute('width', '16')
  await expect(backIcon).toHaveAttribute('height', '16')
  await expect(backIcon).toHaveAttribute('stroke-width', '2')
  await expect(backIcon.locator('path')).toHaveAttribute('d', 'M19 12H5M11 6l-6 6 6 6')
  await expect(backIcon).toHaveCSS('width', '20px')
  await expect(backIcon).toHaveCSS('height', '20px')

  const unchangedTabIcon = navigation.locator('.stg-ni svg').first()
  await expect(unchangedTabIcon).toHaveAttribute('width', '17')
  await expect(unchangedTabIcon).toHaveAttribute('height', '17')
  await expect(unchangedTabIcon).toHaveAttribute('stroke-width', '1.7')

  await back.click()
  await expect(settings).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
})
