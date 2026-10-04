import { expect, test } from '@playwright/test'

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const

for (const surface of [
  { name: 'home', path: '/' },
  { name: 'document', path: '/about/' },
  { name: 'service', path: '/tests/fixtures/client-settings-plan.html?host=service' },
]) {
  test(`${surface.name} footer keeps all explanatory paragraphs when language changes`, async ({ page }) => {
    await page.goto(surface.path)
    const footer = page.locator('.client-site-footer')
    await expect(footer).toBeVisible()
    const originalFooter = await footer.elementHandle()
    for (const language of languages) {
      await page.evaluate(async value => {
        const path = '/src/client-preferences.ts'
        const preferences = await import(path)
        preferences.setClientPreference('language', value)
      }, language)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      // Three explanatory paragraphs plus copyright must survive every locale.
      // Menu translation alone is not evidence that the body was preserved.
      await expect(footer.locator('.gft-copy > p')).toHaveCount(4)
      await expect(footer.locator('.gft-copy > p').nth(0)).toContainText('TETH')
      await expect(footer.locator('.gft-copy > p').nth(1).locator('b')).not.toBeEmpty()
      await expect(footer.locator('.gft-copy > p').nth(2)).not.toBeEmpty()
      await expect(footer.locator('.gft-pw')).toContainText('Bitget')
      if (language !== 'ko') {
        await expect(footer.locator('.gft-copy')).not.toContainText(/[가-힣]/)
        await expect(footer.locator('.gft-pw')).not.toContainText('거래소')
      }
      expect(await originalFooter!.evaluate(el => el === document.querySelector('.client-site-footer'))).toBe(true)
      expect(await footer.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    }
  })
}
