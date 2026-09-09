import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
const copy = JSON.parse(readFileSync('src/client-public-copy.json', 'utf8')) as {
  about: Record<string, string[]>; download: Record<string, string[]>;
  pricing: { direct: { tag: string[] }; partner: { price: string[] } }
}

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
const plain = (value: string) => value.replace(/<br\s*\/?\s*>/g, '').replace(/<[^>]*>/g, '')
test('소개·다운로드가 원본 7언어와 가격 사전을 정확히 사용한다', async ({ page }) => {
  for (const [index, language] of languages.entries()) {
    await page.goto('/about/')
    await page.evaluate(value => { localStorage.setItem('tethLang', value); location.reload() }, language)
    await expect(page).toHaveTitle(copy.about.title[index])
    await expect(page.locator('h1')).toHaveText(plain(copy.about.h1[index]))
    await expect(page.locator('.plan').first()).toContainText(copy.pricing.direct.tag[index])
    await expect(page.locator('.plan').last()).toContainText(copy.pricing.partner.price[index])
    await page.goto('/download/')
    await expect(page).toHaveTitle(copy.download.title[index])
    await expect(page.locator('h1')).toHaveText(copy.download.h1[index])
    await expect(page.locator('.phone-caption')).toContainText(copy.download.s1f1[index])
    await expect(page.locator('.bar .fine a')).toHaveCount(2)
  }
})

test('공개 페이지에서 고른 언어를 이동 후 유지하고 긴 번역·가격이 넘치지 않는다', async ({ page }) => {
  await page.goto('/about/')
  await page.locator('.public-language-trigger').click()
  await page.getByRole('button', { name: 'Français', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.locator('h1')).toHaveText(plain(copy.about.h1[6]))
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/about/', '/download/']) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
      await expect(page.locator('h1')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect.poll(() => page.locator('.plan .price, .plan .tag, .plan .go, .txt h1').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => ({ text: element.textContent, width: element.clientWidth, scroll: element.scrollWidth })))).toEqual([])
    }
  }
})
