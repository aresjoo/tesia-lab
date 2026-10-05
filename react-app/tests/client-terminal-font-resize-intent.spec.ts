import { expect, test, type Locator, type Page } from '@playwright/test'

const fonts = '.ctt-selector-button > span,.ctt-selector-button > b,.tft-rh b,.tft-rh button,.tft-rf input,.tft-rf select,.tft-select .nm,.tft-select .st,.tft-select .sy,.tft-select .ver,.tft-select .cap,.tft-rfoot'
const rowFonts = '.tft-select .nm,.tft-select .st,.tft-select .sy,.tft-select .ver,.tft-select .cap'
const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', error => messages.push(error.message))
  // Vite prevents the default window error for ResizeObserver notifications,
  // so pageerror alone cannot detect a delivery-cycle regression.
  await page.addInitScript(() => {
    const messages: string[] = []
    Object.assign(window, { terminalFontResizeErrors: messages })
    window.addEventListener('error', event => messages.push(event.message))
  })
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { terminalFontResizeErrors: string[] }).terminalFontResizeErrors)).toEqual([])
})

async function frame(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function state(row: Locator) {
  return row.evaluate(element => {
    const rail = element.closest<HTMLElement>('.ctt-rail')!, box = element.getBoundingClientRect(), bounds = rail.getBoundingClientRect()
    const viewport = window.visualViewport, top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? innerHeight)
    const anchor = document.querySelector('.ctt-selector-button')!.parentElement!.getBoundingClientRect()
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return { focused: document.activeElement === element, fallback: rail.dataset.viewportFallback, position: getComputedStyle(rail).position,
      normalHeight: Math.min((bottom - top) * .7, 640, bottom - anchor.bottom - 12), box: box.toJSON(), rail: bounds.toJSON(), scroll: scrollY,
      visible: box.top >= Math.max(top, bounds.top + rail.clientTop) - 1 && box.bottom <= Math.min(bottom, bounds.top + rail.clientTop + rail.clientHeight) + 1,
      hit: hit === element || !!hit && element.contains(hit) }
  })
}

for (const locale of ['ko', 'en', 'fr']) for (const mode of ['all', 'row-only']) {
  test(`${locale} ${mode} 동일 활성 행 200%→100%는 필요한 고정 배치만 해제한다`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 480 })
    await page.goto('/account-terminal-preview.html?market=1')
    await page.evaluate(async locale => {
      const path = '/src/client-preferences.ts'
      ;(await import(/* @vite-ignore */ path)).setClientPreference('language', locale)
    }, locale)
    await page.locator(fonts).evaluateAll(elements => elements.forEach(element => {
      const node = element as HTMLElement
      node.dataset.fontResizeOriginal = getComputedStyle(node).fontSize
      node.style.setProperty('font-size', `${parseFloat(node.dataset.fontResizeOriginal) * 2}px`, 'important')
    }))
    await page.locator('.ctt-selector-button').click()
    await page.locator('.tft-rf input').fill('USDT')
    for (let index = 0; index < 4; index++) await page.keyboard.press('Tab')
    const row = page.locator('.tft-select').last(), node = await row.elementHandle()
    await expect(row).toBeFocused()
    await expect(page.locator('.ctt-rail')).toHaveAttribute('data-viewport-fallback', 'true')
    const expanded = await state(row)
    expect(expanded.box.height + 2).toBeGreaterThan(expanded.normalHeight)
    expect(expanded.visible && expanded.hit).toBe(true)
    await page.locator(mode === 'all' ? fonts : rowFonts).evaluateAll(elements => elements.forEach(element => {
      const node = element as HTMLElement
      node.style.setProperty('font-size', node.dataset.fontResizeOriginal!, 'important')
    }))
    await frame(page)
    const restored = await state(row)
    await info.attach('font-resize-intent', { body: JSON.stringify({ expanded, restored }), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('font-restored.png') })
    expect(restored.box.height + 2).toBeLessThanOrEqual(restored.normalHeight)
    await expect(page.locator('.ctt-rail')).toHaveAttribute('data-viewport-fallback', 'false')
    for (let index = 0; index < 8; index++) {
      await frame(page)
      const current = await state(row)
      expect(current.fallback).toBe('false')
      expect(current.position).toBe('absolute')
      expect(current.focused && current.visible && current.hit).toBe(true)
      expect(await row.evaluate((element, previous) => element === previous, node)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(page.locator('.ctt-selector-button')).toBeFocused()
    await expect(page.locator('.ctt-rail')).not.toHaveAttribute('data-viewport-fallback', /.+/)
  })
}

for (const width of [320, 844, 1440]) test(`${width}px 사용자의 wheel 이후 trigger 글자 변경은 배경 위치를 보존한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 480 })
  await page.goto('/account-terminal-preview.html?market=1')
  await page.locator('.ctt-selector-button').click()
  const row = page.locator('.tft-select').last()
  await row.focus()
  await page.mouse.move(3, 300)
  await page.mouse.wheel(0, width <= 960 ? -160 : 160)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  await frame(page)
  const requested = await page.evaluate(() => scrollY)
  await page.locator('.ctt-selector-button > b').evaluate(element => {
    const node = element as HTMLElement
    node.dataset.fontResizeOriginal = getComputedStyle(node).fontSize
    node.style.fontSize = `${parseFloat(node.dataset.fontResizeOriginal) * 2}px`
  })
  await frame(page)
  const after = await page.evaluate(() => scrollY)
  await info.attach('wheel-trigger-font-intent', { body: JSON.stringify({ requested, after, active: await state(row) }), contentType: 'application/json' })
  expect(after).toBe(requested)
  await expect(row).toBeFocused()
})
