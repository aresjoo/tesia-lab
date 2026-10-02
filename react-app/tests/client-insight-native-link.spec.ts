import { expect, test } from '@playwright/test'
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' }

// Playwright 1.62.x modifier-click regression: https://github.com/microsoft/playwright/issues/42142
// Do not alter browser flags or synthesize window.open to hide this failure.
// Automatically re-enable on a different tool version. The unmodified-browser
// app event contract is independently tested in client-insight-navigation.spec.ts.
test.fixme(/^1\.62\./.test(playwrightPackage.version), 'QA-015: native modifier-click popup is intermittent on Playwright 1.62.x; upstream #42142')

test('인사이트 제목 Ctrl·⌘ 클릭은 현재 목록을 바꾸지 않고 새 탭에서 기사를 연다', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', '데스크톱 브라우저의 Ctrl·⌘ 클릭 동작')
  await page.goto('/#/insight')
  const link = page.locator('.nfz-card').first()
  const href = await link.getAttribute('href')
  await page.bringToFront()
  const [article] = await Promise.all([
    context.waitForEvent('page', { timeout: 5000 }),
    link.locator('h4').click({ modifiers: ['ControlOrMeta'] }),
  ])
  await expect(page).toHaveURL(/#\/insight$/)
  await expect(page.locator('.nfz-open')).toBeVisible()
  await expect(article).toHaveURL(new URL(href!, page.url()).href)
  await expect(article.locator('.nfz-a h1')).toBeVisible()
  await article.close()
  await link.click()
  await expect(page.locator('.nfz-a h1')).toBeVisible()
  expect(context.pages()).toHaveLength(1)
})
