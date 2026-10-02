import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { downloadText } from '../src/client-download-copy'
import { aboutText } from '../src/client-about-copy'
const copy = JSON.parse(readFileSync('src/client-public-copy.json', 'utf8')) as {
  about: Record<string, string[]>; download: Record<string, string[]>;
}

const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
test('소개·다운로드가 원본 7언어와 가격 사전을 정확히 사용한다', async ({ page }) => {
  for (const [index, language] of languages.entries()) {
    await page.goto('/about/')
    await page.evaluate(value => { localStorage.setItem('tethLang', value); location.reload() }, language)
    await expect(page).toHaveTitle(copy.about.title[index])
    await expect(page.locator('h1')).toHaveText(aboutText(language, '거래하는 사람을 위한 AI 트레이딩'))
    await expect(page.locator('#plans .pl-lb')).toHaveText(['TETH 초대 계정', 'TETH 구독'].map(text => aboutText(language, text)))
    await expect(page.locator('#plans .pl-price > span')).toHaveText(['0', '280'])
    await page.goto('/download/')
    await expect(page).toHaveTitle(copy.download.title[index])
    await expect(page.locator('h1')).toHaveText(downloadText(language, 'title'))
    await expect(page.locator('.slide.on>p')).toHaveText(downloadText(language, 'chatCaption'))
    await expect(page.locator('.client-site-footer .gft-col').last().locator('a')).toHaveCount(2)
  }
})

test('공개 페이지에서 고른 언어를 이동 후 유지하고 긴 번역·가격이 넘치지 않는다', async ({ page }) => {
  await page.goto('/about/')
  await page.locator('.public-language-trigger').click()
  await page.getByRole('button', { name: 'Français', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.locator('h1')).toHaveText(aboutText('fr', '거래하는 사람을 위한 AI 트레이딩'))
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/about/', '/download/']) {
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
      await expect(page.locator('h1')).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect.poll(() => page.locator('.pl-price, .pl-d, .pl-cta, .txt h1').evaluateAll(elements => elements.filter(element => element.scrollWidth > element.clientWidth + 1).map(element => ({ text: element.textContent, width: element.clientWidth, scroll: element.scrollWidth })))).toEqual([])
    }
  }
})
