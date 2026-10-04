import { expect, test } from '@playwright/test'

test('충분한 desktop 공간과 일반 스크롤은 전략 선택기가 위치를 빼앗지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/account-terminal-preview.html?market=1')
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  const before = await page.evaluate(() => scrollY)
  await page.locator('.ctt-selector-button').click()
  await expect(page.locator('.tft-rf input')).toBeFocused()
  expect(await page.evaluate(() => scrollY)).toBe(before)
  const requested = await page.evaluate(() => { window.scrollBy(0, 80); return scrollY })
  expect(requested).toBeGreaterThan(before)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await page.evaluate(() => scrollY)).toBe(requested)
  await page.locator('.tft-rf input').press('Escape')
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
})

test('전략 선택기의 자식 dialog는 짧아진 viewport에서도 초점과 스크롤을 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/account-terminal-preview.html?market=1')
  await page.locator('.ctt-selector-button').click()
  await expect(page.locator('.tft-rf input')).toBeFocused()
  await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>('.ctt-rail')!
    const child = document.createElement('dialog')
    child.id = 'terminal-owned-child-probe'
    child.dataset.terminalRailOwner = rail.id
    const button = document.createElement('button')
    button.textContent = '닫기'
    child.append(button)
    document.body.append(child)
    child.showModal()
    button.focus({ preventScroll: true })
  })
  const before = await page.evaluate(() => scrollY)
  await page.setViewportSize({ width: 1440, height: 480 })
  await expect(page.locator('#terminal-owned-child-probe button')).toBeFocused()
  await expect(page.locator('.ctt-rail')).toBeVisible()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  expect(await page.evaluate(() => scrollY)).toBe(before)
  await page.evaluate(() => {
    const child = document.querySelector<HTMLDialogElement>('#terminal-owned-child-probe')!
    child.close()
    child.remove()
  })
})

test('짧은 desktop에서 확대된 전략 검색은 실제 viewport 안에 초점을 표시한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 480 })
  await page.goto('/account-terminal-preview.html?market=1')
  await expect(page.locator('.cp-surface canvas').first()).toBeVisible()
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', 'fr')
  })
  await page.locator('.ctt-terminal').evaluate(element => {
    const targets = [...element.querySelectorAll<HTMLElement>('.ctm-header b,.ctm-header span,.ctm-header dt,.ctm-header dd,.ctt-selector-button>span,.ctt-selector-button>b,.tft-rf input')]
    const sizes = targets.map(target => parseFloat(getComputedStyle(target).fontSize))
    targets.forEach((target, index) => { target.style.fontSize = `${sizes[index] * 2}px` })
  })
  const canvas = await page.locator('.cp-surface canvas').first().elementHandle()
  await page.locator('.ctt-selector-button').click()
  const search = page.locator('.tft-rf input')
  await expect(search).toBeFocused()
  await expect.poll(() => search.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    return bounds.y >= 0 && bounds.bottom <= innerHeight && hit === element
  })).toBe(true)
  const rail = (await page.locator('.ctt-rail').boundingBox())!
  expect(rail.y + rail.height).toBeLessThanOrEqual(480)
  await search.fill('ETH')
  await search.press('Escape')
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.locator('.ctt-selector-button').click()
  await expect(search).toHaveValue('ETH')
  await page.setViewportSize({ width: 1440, height: 480 })
  await expect(search).toBeFocused()
  await expect.poll(() => search.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return bounds.y >= 0 && bounds.bottom <= innerHeight
  })).toBe(true)
  await search.press('Escape')
  await page.locator('.cat-expand').click()
  await page.locator('.ctt-selector-button').click()
  await expect(search).toBeFocused()
  await expect.poll(() => search.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return bounds.y >= 0 && bounds.bottom <= innerHeight
  })).toBe(true)
  await search.press('Escape')
  await page.keyboard.press('Escape')
  await expect(page.locator('.cat-expand')).toBeFocused()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
  expect(await canvas!.evaluate(element => element.isConnected)).toBe(true)
})
