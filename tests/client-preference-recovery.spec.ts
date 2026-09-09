import { expect, test } from '@playwright/test'

test('언어 저장 실패는 통화 저장 성공으로 숨겨지지 않으며 다음 선택에서 함께 재시도된다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function(key, value) {
      if (key === 'tethLang' && !sessionStorage.getItem('allow-language-write')) throw new DOMException('Blocked', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page.goto('/')
  await page.locator('.client-globe').click()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('.locale-storage-error')).toBeVisible()
  await page.getByRole('button', { name: 'KRW', exact: true }).click()
  await expect(page.locator('.client-locale-panel')).toBeVisible()
  await expect(page.locator('.locale-storage-error')).toBeVisible()
  // An unrelated tab's currency update must not erase our unsaved language.
  await page.evaluate(() => { localStorage.setItem('tethCurrency', 'EUR'); window.dispatchEvent(new StorageEvent('storage', { key: 'tethCurrency', newValue: 'EUR' })) })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'EUR', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.locale-storage-error')).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('allow-language-write', '1'))
  await page.getByRole('button', { name: 'USD', exact: true }).click()
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  expect(await page.evaluate(() => ({ language: localStorage.getItem('tethLang'), currency: localStorage.getItem('tethCurrency') }))).toEqual({ language: 'en', currency: 'USD' })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
