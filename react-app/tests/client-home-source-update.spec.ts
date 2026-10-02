import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const termsCopy: Record<string, string> = JSON.parse(readFileSync('src/client-reference-copy.json', 'utf8')).I18N['home.terms']

// tesia-lab 42a0d81: explicit viewport policy replaces 9bf4427's <=860 one-column rule.
test('원본 42a0d81의 3·2·1열과 16·17·18px 라벨을 경계·짧은 화면에서 보존한다', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const gallery = page.locator('.client-home-gallery')
  await expect(gallery.locator('.g-tpl')).toHaveCount(55)
  for (const [width, height] of [[1440, 1000], [1101, 768], [1100, 768], [861, 768], [860, 768], [768, 1024], [601, 768], [600, 768], [390, 844], [320, 568], [844, 390], [600, 390]]) {
    await page.setViewportSize({ width, height })
    const columns = width <= 600 ? 1 : width <= 1100 ? 2 : 3
    const fontSize = width <= 600 ? '18px' : width <= 1100 ? '17px' : '16px'
    await expect.poll(() => gallery.locator('.g-tpls').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(columns)
    await expect(gallery.locator('.lb').first()).toHaveCSS('font-size', fontSize)
    await expect(gallery.locator('.lb').first()).toHaveCSS('left', '14px')
    await expect(gallery.locator('.lb').first()).toHaveCSS('bottom', '12px')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    if (width === 844) await gallery.locator('.g-tpl').first().scrollIntoViewIfNeeded()
    if (width === 1440 || width === 390 || width === 844) await page.screenshot({ path: info.outputPath(`home-source-${width}.png`) })
  }
  expect(errors).toEqual([])
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const) {
  test(`원본 501053b 약관 ${language}: 문장 공백·모바일 줄바꿈·경계 왕복·원문·내부 링크·키보드를 유지한다`, async ({ page }, info) => {
    await page.addInitScript(locale => localStorage.setItem('tethLang', locale), language)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const terms = page.locator('.client-home-terms')
    const source = termsCopy[language]
    const original = source.replace(/\{[TP]\}|\{\/\}/g, '')
    expect(source.split('{BR}')).toHaveLength(2)
    await expect(terms.locator('br.tbr')).toHaveCount(1)
    await expect(terms).not.toContainText('{BR}')
    for (const width of [320, 860, 861, 1440, 860, 861, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(terms.locator('br.tbr')).toHaveCSS('display', width <= 860 ? 'inline' : 'none')
      // Source gHome inserts one ASCII space before the responsive BR; the DOM
      // keeps it even when mobile rendering collapses it at the line boundary.
      expect(await terms.textContent()).toBe(original.replace('{BR}', ' '))
      expect(await terms.locator('br.tbr').evaluate(br => br.previousSibling?.textContent?.endsWith(' '))).toBe(true)
      expect(await terms.innerText()).toBe(original.replace('{BR}', width <= 860 ? '\n' : ' '))
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      await expect.poll(() => terms.evaluate(element => {
        const input = element.closest('.client-home-band')!.querySelector('.client-home-pill')!.getBoundingClientRect()
        const legal = element.getBoundingClientRect()
        return input.bottom <= legal.top + 1 && legal.left >= -1 && legal.right <= innerWidth + 1
      })).toBe(true)
      if ([320, 860, 861, 1440].includes(width)) {
        await terms.scrollIntoViewIfNeeded()
        await page.locator('.client-home-band').screenshot({ path: info.outputPath(`home-terms-${language}-${width}.png`) })
      }
    }
    const links = terms.getByRole('link')
    await expect(links).toHaveCount(2)
    await expect(links.nth(0)).toHaveAttribute('href', '/policies/#terms')
    await expect(links.nth(1)).toHaveAttribute('href', '/policies/#privacy')
    await links.nth(0).focus()
    await expect(links.nth(0)).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(links.nth(1)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/policies\/#privacy$/)
  })
}
