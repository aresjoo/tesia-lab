import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { policyLabels } from '../src/client-policy-copy'

const copy = JSON.parse(readFileSync('src/client-public-copy.json', 'utf8')) as {
  about: Record<string, string[]>; download: Record<string, string[]>;
}
const reference = JSON.parse(readFileSync('src/client-reference-copy.json', 'utf8')) as {
  I18N: Record<string, Record<string, string>>;
}
const languages = [
  ['ko', '한국어', '본문으로 건너뛰기'], ['en', 'English', 'Skip to content'],
  ['ja', '日本語', '本文へスキップ'], ['zh-CN', '简体中文', '跳转到正文'],
  ['zh-TW', '繁體中文', '跳至正文'], ['es', 'Español', 'Saltar al contenido'],
  ['fr', 'Français', 'Aller au contenu'],
] as const

async function selectLanguage(page: Page, name: string) {
  await page.locator('.public-language-trigger').click()
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

for (const [index, [language, name, skip]] of languages.entries()) {
  test(`${language}: public skip accessible name and title follow live language selection`, async ({ page }) => {
    test.setTimeout(25_000)
    for (const route of ['about', 'download'] as const) {
      await page.goto(`/${route}/`)
      await selectLanguage(page, name)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page).toHaveTitle(copy[route].title[index])
      const link = page.locator('.site-skip')
      await expect(link).toHaveAccessibleName(skip)
      await expect(link).toHaveText(skip)
      await link.focus()
      await page.keyboard.press('Enter')
      await expect(page.locator('#site-main')).toBeFocused()
      await expect(page).toHaveURL(new RegExp(`/${route}/$`))
    }
  })

  test(`${language}: policy chrome translates without rewriting source legal content at 320px`, async ({ page }) => {
    test.setTimeout(25_000)
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto('/policies/#privacy')
    const originalPrivacy = await page.locator('#v-privacy').textContent()
    const originalTerms = await page.locator('#v-terms').textContent()
    await selectLanguage(page, name)
    const labels = policyLabels(language)
    const title = labels.title
    await expect(page).toHaveTitle(`${title} | TETH`)
    await expect(page.locator('.pg-h1')).toHaveText(title)
    await expect(page.locator('.hd .cta')).toHaveAccessibleName(labels.start)
    await expect(page.locator('.public-language-trigger')).toHaveAccessibleName(reference.I18N['glc.lang'][language])
    await expect(page.locator('.site-skip')).toHaveAccessibleName(skip)
    await page.locator('.site-skip').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#site-main')).toBeFocused()
    await expect(page).toHaveURL(/\/policies\/#privacy$/)
    const privacy = page.locator('.tabs a[data-v="privacy"]')
    const terms = page.locator('.tabs a[data-v="terms"]')
    await expect(privacy).toHaveAccessibleName(labels.privacy)
    await expect(terms).toHaveAccessibleName(labels.terms)
    await expect(privacy).toHaveAttribute('aria-current', 'page')
    await terms.click()
    await expect(page).toHaveURL(/\/policies\/#terms$/)
    await expect(terms).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('#v-terms')).toBeVisible()
    await expect(page.locator('#v-terms')).toHaveText(originalTerms ?? '')
    await page.goBack()
    await expect(privacy).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('#v-privacy')).toHaveText(originalPrivacy ?? '')
    await expect(page.locator('.tabs a[data-v="overview"]')).toHaveText(labels.overview)
    await expect(page.locator('.tabs a[data-v="technologies"]')).toHaveText(labels.technologies)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    await page.reload()
    await expect(page).toHaveTitle(`${title} | TETH`)
    await expect(page.locator('.site-skip')).toHaveAccessibleName(skip)
    await page.locator('.hd .cta').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('.client-public-page')).toHaveCount(0)
    await page.goBack()
    await expect(page.locator('#v-privacy')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', language)
  })
}
