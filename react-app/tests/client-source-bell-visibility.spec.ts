import { expect, test } from '@playwright/test'

// Source26088 is the last public-shell override. Native supplied and archived
// base-document bell consumers retain independent geometry/operation specs.
test('회원의 원본 홈·전략 목록·새 대화에는 추가 알림종이 없다', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: 'Source bell', email: 'source-bell@example.test' })))
  await page.goto('/')
  await expect(page.locator('.client-home-content')).toBeVisible()
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  await page.goto('/#/share')
  await expect(page.locator('.strategy-list-card')).toHaveCount(10)
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  await page.goto('/')
  await page.locator('#strategy-idea').fill('비트코인 반등 전략')
  await page.getByRole('button', { name: '대화 시작', exact: true }).click()
  await expect(page.locator('.g-urow')).toBeVisible()
  await expect(page.locator('.client-account-utility')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '대화 메뉴', exact: true })).toBeVisible()
})
