import { expect, test } from '@playwright/test'

const locales = [
  ['ko', '한국어', '시작하기'], ['en', 'English', 'Get started'], ['ja', '日本語', '始める'],
  ['zh-CN', '简体中文', '开始使用'], ['zh-TW', '繁體中文', '開始使用'],
  ['es', 'Español', 'Comenzar'], ['fr', 'Français', 'Commencer'],
] as const

for (const [language, name, start] of locales) {
  test(`${language} introduction translates the final Korean editorial meaning and preserves signup`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/#/trade')
    const intro = page.locator('.txh')
    await expect(intro).toHaveAttribute('lang', language)
    await expect(intro.locator('.txh-cta')).toHaveText([start, start])
    await expect(intro.locator('.txh-ai-col li')).toHaveCount(9)
    await expect(intro.locator('.txh-card')).toHaveCount(2)
    await expect(intro.locator('.txh-step')).toHaveCount(3)
    await expect(intro.locator('.txh-safe li')).toHaveCount(4)
    if (language !== 'ko') expect(await intro.innerText()).not.toMatch(/[가-힣]/)
    for (const index of [0, 1]) {
      const button = intro.locator('.txh-cta').nth(index)
      await expect(button).toHaveAttribute('lang', language)
      await button.click()
      await expect(page.locator('.ca-auth')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.locator('.ca-auth')).toHaveCount(0)
      await expect(button).toBeFocused()
      await expect(page).toHaveURL(/#\/trade$/)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })

  test(`${language} public pages update mounted content and translate every policy section`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/about/')
    const about = page.locator('.client-info-about')
    await about.locator('.public-language-trigger').click()
    await page.locator('#locale-language li button').filter({ hasText: name }).click()
    await expect(page.locator('.client-locale-panel')).toHaveCount(0)
    await expect(about).toHaveAttribute('lang', language)
    if (language !== 'ko') expect(await about.locator('main').innerText()).not.toMatch(/[가-힣]/)
    await about.locator('.client-site-footer a[href="/policies/#terms"]').click()
    const policy = page.locator('.client-info-policies')
    await expect(policy).toHaveAttribute('lang', language)
    for (const section of ['overview', 'privacy', 'terms', 'technologies', 'faq']) {
      await policy.locator(`.tabs a[data-v="${section}"]`).click()
      const content = policy.locator(`#v-${section}`)
      await expect(content).toBeVisible()
      await expect(content).toHaveAttribute('lang', language)
      expect((await content.innerText()).trim().length).toBeGreaterThan(50)
      if (language !== 'ko') expect(await content.innerText()).not.toMatch(/[가-힣]/)
    }
    // Change language on the already mounted policy route, not only before
    // navigation, so retained lazy content cannot keep its old language.
    await policy.locator('.public-language-trigger').click()
    await page.locator('#locale-language li button').filter({ hasText: language === 'ko' ? 'English' : '한국어' }).click()
    await expect(policy.locator('#v-faq')).toHaveAttribute('lang', language === 'ko' ? 'en' : 'ko')
    await policy.locator('.public-language-trigger').click()
    await page.locator('#locale-language li button').filter({ hasText: name }).click()
    await expect(policy.locator('#v-faq')).toHaveAttribute('lang', language)
    if (language !== 'ko') expect(await policy.locator('#v-faq').innerText()).not.toMatch(/[가-힣]/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}
