import { expect, test } from '@playwright/test'

const sourceFont = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo", "Noto Sans SC Variable", "TETH Bitcoin Glyph", sans-serif'

test('소개와 고객지원은 원본 public font stack을 함께 계승한다', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('LOCAL_ORIGIN_REQUIRED')
  const origin = new URL(baseURL).origin
  const audit = { mutations: [] as string[], external: [] as string[], errors: [] as string[] }

  page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/*', route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) {
      audit.external.push(request.method())
      return route.abort('blockedbyclient')
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      audit.mutations.push(request.method())
      return route.abort('blockedbyclient')
    }
    return route.continue()
  })

  await page.goto('/about/')
  await page.evaluate(() => document.fonts.ready)

  const about = page.locator('.client-info-about')
  await expect(about).toBeVisible()
  await expect(about).toHaveCSS('font-family', sourceFont)

  const help = page.locator('.client-info-about > .site-help')
  if (await help.isVisible()) {
    await expect(help).toHaveCSS('font-family', sourceFont)
    await help.locator('.site-help-trigger').click()
    await expect(help.locator('.site-help-pop')).toHaveCSS('font-family', sourceFont)
  } else {
    // Source mobile behavior intentionally hides the public-page floating help.
    await expect(help).toBeHidden()
    expect(await help.evaluate(node => getComputedStyle(node).fontFamily)).toBe(sourceFont)
  }

  expect(audit).toEqual({ mutations: [], external: [], errors: [] })
})
