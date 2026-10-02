import { expect, test } from '@playwright/test'

for (const width of [320, 901, 1440]) for (const language of ['ko', 'fr']) test(`settings ${width}px ${language} select grows for 200% text without clipping`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 700 })
  await page.goto('/tests/fixtures/client-settings-identity.html#/settings/general')
  const select = page.locator('.stg-sel')
  await select.selectOption(language)
  await expect(select).toHaveCSS('height', width <= 900 ? '44px' : '40px')
  await select.evaluate(el => { el.style.fontSize = '30px' })
  const size = await select.evaluate(el => {
    const style = getComputedStyle(el), rect = el.getBoundingClientRect()
    return { height: rect.height, required: parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom), width: rect.width, parent: el.parentElement!.getBoundingClientRect().width }
  })
  expect(size.height).toBeGreaterThanOrEqual(size.required)
  expect(size.width).toBeLessThanOrEqual(size.parent)
  await select.focus()
  await expect(select).toBeFocused()
  expect(await page.locator('.client-settings-page').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('settings-type-size.png') })
})
