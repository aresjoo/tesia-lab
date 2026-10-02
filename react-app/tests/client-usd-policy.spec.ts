import { expect, test } from '@playwright/test'

// Client source 02cebe3 R07: language-only settings and USD-valued display.
// Actual asset units and old KRW preview inputs are deliberately not relabelled.
test('오래된 통화 선호·교차탭 변경은 USD 표시를 바꾸지 않는다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tethCurrency', 'KRW'))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const moneyPath = '/src/client-preview-money.ts'
    const prefs = await import(path)
    const { sourceMoney } = await import(moneyPath)
    const rejected = prefs.setClientPreference('currency', 'BTC')
    window.dispatchEvent(new StorageEvent('storage', { key: 'tethCurrency', newValue: 'BTC' }))
    return {
      rejected,
      displays: ['USD', 'KRW', 'BTC', 'USDC'].map(currency => prefs.formatReferenceMoney(5000, currency, 'ko')),
      legacy: sourceMoney(1390000, 'KRW', 'ko'),
      invalid: prefs.formatReferenceMoney(Number.NaN, 'USD'),
      french: prefs.formatReferenceMoney(1234.56, 'BTC', 'fr'),
      stored: localStorage.getItem('tethCurrency'),
    }
  })
  expect(result).toEqual({ rejected: false, displays: ['$5,000', '$5,000', '$5,000', '$5,000'], legacy: '$1,000', invalid: '–', french: '$1\u202f234,56', stored: 'KRW' })
})

test('언어 패널에는 단일 검색·7언어만 있고 변경 후 초안과 언어를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const composer = page.locator('#strategy-idea')
  await composer.fill('700만원, 0.5 BTC와 100 USDT는 내 원문입니다')
  await page.locator('.client-globe').click()
  const panel = page.locator('.client-locale-panel')
  await expect(panel).toHaveAccessibleName('언어')
  await expect(panel.getByRole('searchbox')).toHaveCount(1)
  await expect(panel.getByRole('tab')).toHaveCount(0)
  await expect(panel.locator('li')).toHaveCount(7)
  await expect(page.locator('#locale-currency')).toHaveCount(0)
  await panel.getByRole('searchbox').fill('en')
  await expect(panel.locator('li')).toHaveCount(1)
  await panel.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.client-globe')).toBeFocused()
  await expect(composer).toHaveValue('700만원, 0.5 BTC와 100 USDT는 내 원문입니다')
  await page.locator('.client-globe').click()
  await expect(panel.getByRole('searchbox')).toHaveValue('')
  await expect(panel.locator('li')).toHaveCount(7)
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('언어 저장 실패는 구 통화 이벤트로 숨겨지지 않고 같은 선택으로 재시도한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tethLang' && !sessionStorage.getItem('allow-language-write')) throw new DOMException('Blocked', 'QuotaExceededError')
      return write.call(this, key, value)
    }
  })
  await page.goto('/')
  await page.locator('.client-globe').click()
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('.locale-storage-error')).toBeVisible()
  await page.evaluate(() => {
    localStorage.setItem('tethCurrency', 'EUR')
    window.dispatchEvent(new StorageEvent('storage', { key: 'tethCurrency', newValue: 'EUR' }))
  })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.locale-storage-error')).toBeVisible()
  await page.evaluate(() => sessionStorage.setItem('allow-language-write', '1'))
  await page.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('.client-locale-panel')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('tethLang'))).toBe('en')
})

test('단일 언어 패널은 좁은 화면에서도 검색·목록·닫기와 초점을 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.locator('.client-globe').click()
  const panel = page.locator('.client-locale-panel')
  for (const width of [1440, 861, 860, 390, 320]) {
    await page.setViewportSize({ width, height: 640 })
    await expect(panel.getByRole('searchbox')).toHaveCount(1)
    await expect(panel.getByRole('searchbox')).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Français', exact: true })).toBeVisible()
    const box = await panel.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(360.1)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(640.1)
  }
  await panel.getByRole('searchbox').fill('not-a-language')
  await expect(panel.getByRole('status')).toHaveText('검색 결과가 없습니다.')
  await panel.focus()
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.client-locale-panel')))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
  await expect(page.locator('.client-hamburger')).toBeFocused()
})

test('모바일 키보드 크기의 가용높이와 저장 실패에도 언어 목록을 다시 선택할 수 있다', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    const write = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tethLang') throw new DOMException('Blocked', 'QuotaExceededError')
      return write.call(this, key, value)
    }
  })
  await page.goto('/')
  await page.locator('.client-globe').click()
  await page.getByRole('button', { name: 'Français', exact: true }).click()
  const panel = page.locator('.client-locale-panel')
  await expect(panel.locator('.locale-storage-error')).toBeVisible()
  // Model the browser API used by the component; no claim of a real OS keyboard.
  await page.setViewportSize({ width: 320, height: 640 })
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 260 })
    window.visualViewport!.dispatchEvent(new Event('resize'))
  })
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeLessThanOrEqual(260)
  await expect.poll(async () => (await panel.locator('ul').boundingBox())!.height).toBeGreaterThanOrEqual(48)
  const search = panel.getByRole('searchbox')
  await search.fill('English')
  await panel.getByRole('button', { name: 'English', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await panel.locator('.locale-storage-error').scrollIntoViewIfNeeded()
  await expect(panel.locator('.locale-storage-error')).toBeInViewport()
  await page.screenshot({ path: info.outputPath('language-compact-error.png') })
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('inert')
})
