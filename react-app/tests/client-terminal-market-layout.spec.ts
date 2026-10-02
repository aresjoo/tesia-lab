import { expect, test, type Page } from '@playwright/test'

async function mount(page: Page) {
  await page.goto('/account-terminal-preview.html')
  await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-strategy-selector', 'true')
}
async function analysis(page: Page) {
  const tabs = page.locator('.ctt-main-tabs')
  if (await tabs.isVisible()) await tabs.getByRole('tab').last().click()
}
async function open(page: Page) {
  await analysis(page)
  await page.locator('.ctt-selector-button').click()
  await expect(page.locator('.ctt-rail')).toBeVisible()
  await expect(page.locator('.tft-rf input')).toBeFocused()
}

for (const width of [320, 844, 1440]) test(`8805 ${width}px 전략 선택은 원본 두 영역 배치·검색·키보드·canvas를 보존한다`, async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 960 }); await mount(page)
  const canvas = page.locator('canvas').first(), chart = await canvas.elementHandle()
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await expect(page.locator('.ctt-selector-button span')).toHaveText('전략 2개')
  await expect(page.locator('.ctt-main-tabs [role="tab"]')).toHaveText(['차트', '판단'])
  if (width > 960) {
    const market = await page.locator('.ctt-market').boundingBox(), detail = await page.locator('.ctt-detail').boundingBox()
    expect(detail!.x - (market!.x + market!.width)).toBe(6)
    expect(market!.width).toBeGreaterThan(width * .60)
    expect(await page.locator('.ctt-detail').evaluate(el => getComputedStyle(el).borderRadius)).toBe('16px')
  }
  await open(page)
  await page.screenshot({ path: info.outputPath(`selector-chart-${width}.png`) })
  const search = page.locator('.tft-rf input'), originalSearch = await search.elementHandle()
  await search.fill('BTC')
  await search.press('Escape')
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await page.keyboard.press('Enter')
  await expect(search).toHaveValue('BTC')
  expect(await search.evaluate((el, previous) => el === previous, originalSearch)).toBe(true)
  expect(await canvas.evaluate((el, previous) => el === previous, chart)).toBe(true)
  await search.fill('')
  const choices = page.locator('.tft-select'), selectedId = await page.locator('[data-strategy-id]').nth(1).getAttribute('data-strategy-id')
  await choices.nth(1).focus(); await page.keyboard.press('Enter')
  await expect(page.locator('.client-account-terminal')).toHaveAttribute('data-selected-strategy', selectedId!)
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await open(page)
  const rect = await page.locator('.ctt-rail').boundingBox(), anchor = await page.locator('.ctt-selector-button').boundingBox()
  expect(rect!.y).toBeGreaterThanOrEqual(anchor!.y + anchor!.height)
  expect(rect!.x).toBeGreaterThanOrEqual(0); expect(rect!.x + rect!.width).toBeLessThanOrEqual(width)
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(960)
  await page.screenshot({ path: info.outputPath(`selector-${width}.png`) })
  await search.press('Escape')
  await page.locator('.cat-expand').click()
  await open(page)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-modal')).toBeVisible()
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
  await open(page)
  await page.locator('.ctt-selector-button').focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-modal')).toBeVisible()
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-modal')).toBeHidden()
  await expect(page.locator('.cat-expand')).toBeFocused()
  expect(errors).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})

for (const width of [320, 844, 960, 961, 1440]) test(`17d ${width}px 차트·원장·판단 순서와 동일 DOM을 유지한다`, async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 960 }); await mount(page)
  const market = page.locator('.ctt-market'), ledger = page.locator('.ctt-bottom'), detail = page.locator('.ctt-detail')
  for (const region of [market, ledger, detail]) {
    await expect(region).toBeVisible()
    expect(await region.evaluate(el => !!el.closest('[inert]'))).toBe(false)
  }
  await expect(page.locator('.ctt-main-tabs')).toBeHidden()
  expect(await page.locator('.ctt-grid').evaluate(el => [...el.children].map(child => child.className))).toEqual(['ctt-market', 'ctt-bottom', 'ctt-detail'])
  if (width <= 960) {
    const chartBox = (await market.boundingBox())!, ledgerBox = (await ledger.boundingBox())!, detailBox = (await detail.boundingBox())!
    expect(chartBox.height).toBeGreaterThanOrEqual(576)
    expect(ledgerBox.y - chartBox.y - chartBox.height).toBeCloseTo(6, 0)
    expect(detailBox.y - ledgerBox.y - ledgerBox.height).toBeCloseTo(6, 0)
    expect(await page.locator('.ctt-bottom-pane[data-selected=true]').evaluate(el => getComputedStyle(el).maxHeight)).toBe('none')
    const tools = page.locator('.cp-controls')
    expect(await tools.evaluate(el => el.clientHeight)).toBeLessThanOrEqual(60)
    await tools.locator('button').last().focus()
    await expect(tools.locator('button').last()).toBeFocused()
    await expect.poll(() => tools.locator('button').last().evaluate(el => {
      const outer = el.closest('.cp-controls')!.getBoundingClientRect(), rect = el.getBoundingClientRect()
      return rect.left >= outer.left && rect.right <= outer.right + 1
    })).toBe(true)
  }
  const canvas = page.locator('canvas').first(), canvasNode = await canvas.elementHandle()
  await open(page)
  const input = page.locator('.tft-rf input'), inputNode = await input.elementHandle()
  await input.fill('BTC')
  await input.press('Escape')
  const tabs = page.locator('.ctt-bottom-tabs [role=tab]')
  const tabCount = await tabs.count()
  await tabs.last().click()
  const selected = await tabs.last().getAttribute('data-tab-id')
  for (const nextWidth of [1440, 320, width]) {
    await page.setViewportSize({ width: nextWidth, height: 960 })
    await expect(page.locator('.ctt-terminal')).toHaveAttribute('data-mobile', String(nextWidth <= 960))
    await expect(tabs).toHaveCount(tabCount)
    await expect(page.locator('.ctt-bottom-tabs [aria-selected=true]')).toHaveAttribute('data-tab-id', selected!)
    await expect(input).toHaveValue('BTC')
    expect(await input.evaluate((el, old) => el === old, inputNode)).toBe(true)
    expect(await canvas.evaluate((el, old) => el === old, canvasNode)).toBe(true)
  }
  await page.locator('.cat-expand').click()
  await expect(page.locator('.ctt-modal')).toBeVisible()
  for (const region of [market, ledger, detail]) await expect(region).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.cat-expand')).toBeFocused()
  expect(await canvas.evaluate((el, old) => el === old, canvasNode)).toBe(true)
  await expect(input).toHaveValue('BTC')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: info.outputPath(`stack-${width}.png`), fullPage: true })
  expect(errors).toEqual([])
})

test('8805 선택 목록 바깥 클릭·탭 이동은 초점을 빼앗지 않고 닫힌다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await mount(page)
  await open(page)
  const analysisTab = page.locator('.cat-tabs [role="tab"]').last()
  // Focus navigation, not a backdrop or a second modal.
  await analysisTab.focus()
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await expect(analysisTab).toBeFocused()
  await open(page)
  const scope = page.locator('.cat-scope select')
  await scope.click()
  await expect(page.locator('.ctt-rail')).toBeHidden()
  await expect(scope).toBeFocused()
})

for (const width of [320, 1440]) test(`8805 ${width}px 7언어·두배 글자·크기 변경에도 선택기가 잘리지 않는다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 960 }); await mount(page)
  await analysis(page)
  const trigger = page.locator('.ctt-selector-button')
  for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
    await page.evaluate(async language => {
      const path = '/src/client-preferences.ts'
      const { setClientPreference } = await import(/* @vite-ignore */ path)
      setClientPreference('language', language)
    }, language)
    await trigger.click()
    await expect(page.locator('.tft-rf input')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    expect(await trigger.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  }
  await page.evaluate(() => {
    const targets = [...document.querySelectorAll<HTMLElement>('.ctt-selector-button > span,.ctt-selector-button > b,.tft-rh b,.tft-rh button,.tft-rf input,.tft-rf select,.tft-select .nm,.tft-select .st,.tft-select .sy,.tft-select .ver,.tft-select .cap,.tft-rfoot')]
    const sizes = targets.map(el => parseFloat(getComputedStyle(el).fontSize) * 2)
    targets.forEach((el, i) => { el.style.fontSize = `${sizes[i]}px` })
  })
  await trigger.click()
  const box = await page.locator('.ctt-rail').boundingBox(), button = await trigger.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(button!.y + button!.height)
  expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(960)
  if (width === 320) {
    const arrow = await trigger.locator('svg').boundingBox(), name = await trigger.locator('b').boundingBox()
    expect(arrow!.x).toBeGreaterThanOrEqual(name!.x + name!.width)
    expect(arrow!.y + arrow!.height).toBeLessThanOrEqual(button!.y + button!.height)
  }
  await page.screenshot({ path: info.outputPath(`selector-expanded-${width}.png`) })
  await page.setViewportSize({ width: width === 320 ? 1440 : 320, height: 960 })
  await expect(page.locator('.tft-rf input')).toBeFocused()
  await expect(page.locator('.ctt-rail')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
})
