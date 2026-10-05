import { expect, test, type Locator, type Page } from '@playwright/test'

const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', error => errors.push(error.message))
})
test.afterEach(({ page }) => { expect(pageErrors.get(page) ?? []).toEqual([]) })

async function frame(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function reachable(control: Locator) {
  return control.evaluate(element => {
    const box = element.getBoundingClientRect(), rail = element.closest('.ctt-rail')!.getBoundingClientRect()
    const viewport = window.visualViewport, top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? innerHeight)
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return { visible: box.top >= Math.max(top, rail.top) - 1 && box.bottom <= Math.min(bottom, rail.bottom) + 1 && box.left >= 0 && box.right <= innerWidth + 1,
      hit: hit === element || !!hit && element.contains(hit), box: box.toJSON(), rail: rail.toJSON(), scroll: scrollY }
  })
}

async function language(page: Page, value: string) {
  await page.evaluate(async value => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(/* @vite-ignore */ path)
    setClientPreference('language', value)
  }, value)
}

async function enlarge(page: Page, selector: string) {
  await page.locator(selector).evaluateAll(elements => {
    const sizes = elements.map(element => parseFloat(getComputedStyle(element).fontSize))
    elements.forEach((element, index) => (element as HTMLElement).style.setProperty('font-size', `${sizes[index] * 2}px`, 'important'))
  })
}

test('활성 전략 행은 낮아진 viewport에서도 전체 영역과 실제 hit를 유지한다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/account-terminal-preview.html?market=1')
  await page.locator('.ctt-selector-button').click()
  const row = page.locator('.tft-select').last()
  await row.focus()
  await expect(row).toBeFocused()
  await expect.poll(async () => (await reachable(row)).visible).toBe(true)
  await page.setViewportSize({ width: 1440, height: 480 })
  await frame(page)
  await info.attach('active-row-after-resize', { body: JSON.stringify(await reachable(row)), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('active-row-after-resize.png') })
  await expect(row).toBeFocused()
  await expect.poll(async () => (await reachable(row)).visible).toBe(true)
  expect((await reachable(row)).hit).toBe(true)
})

test('일반 스크롤 뒤 trigger 글자 크기 변경은 사용자의 페이지 위치를 되돌리지 않는다', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 480 })
  await page.goto('/account-terminal-preview.html?market=1')
  await page.locator('.ctt-selector-button').click()
  const row = page.locator('.tft-select').last()
  await row.focus()
  const requested = await page.evaluate(() => { window.scrollBy(0, 220); return scrollY })
  expect(requested).toBeGreaterThan(0)
  await frame(page)
  await enlarge(page, '.ctt-selector-button > b')
  await frame(page)
  await info.attach('trigger-size-scroll', { body: JSON.stringify({ requested, after: await page.evaluate(() => scrollY) }), contentType: 'application/json' })
  await expect(row).toBeFocused()
  expect(await page.evaluate(() => scrollY)).toBe(requested)
})

test('열린 검색의 동적 두배 글자는 trigger 높이가 달라져도 입력을 노출한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 480 })
  await page.goto('/account-terminal-preview.html?market=1')
  await language(page, 'fr')
  await page.locator('.ctt-selector-button').click()
  const search = page.locator('.tft-rf input')
  await expect(search).toBeFocused()
  await enlarge(page, '.ctm-header b,.ctm-header span,.ctm-header dt,.ctm-header dd,.ctt-selector-button > span,.ctt-selector-button > b,.tft-rf input')
  await expect.poll(async () => (await reachable(search)).visible).toBe(true)
  expect((await reachable(search)).hit).toBe(true)
})

test('실제 전략 자식 dialog는 폭 전환과 축소에도 초점·페이지 위치·원 trigger를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/terminal-focus-source.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }))
  await page.goto('/terminal-focus-source.html')
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh'
    const refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/components/ClientSourceTerminalWorkspace.tsx', domPath = '/@id/react-dom/client'
    const source = await (await fetch(path)).text(), reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React instance')
    const reactModule = await import(/* @vite-ignore */ reactPath), dom = await import(/* @vite-ignore */ domPath)
    const workspace = await import(/* @vite-ignore */ path), react = reactModule.default ?? reactModule
    ;(dom.createRoot ?? dom.default.createRoot)(document.getElementById('fixture')).render(react.createElement(workspace.default, { accountDataMode: 'source-preview', onNew: () => {}, onAsk: () => {} }))
  })
  await page.locator('.ctt-selector-button').click()
  const trigger = page.locator('[data-strategy-id="demo:d1"] .mn')
  await trigger.click()
  await page.getByRole('menuitem', { name: '이름 변경', exact: true }).click()
  const input = page.locator('.csa-dialog input')
  await expect(input).toBeFocused()
  const before = await page.evaluate(() => scrollY)
  await page.setViewportSize({ width: 844, height: 480 })
  await frame(page)
  await expect(input).toBeFocused()
  expect(await page.evaluate(() => scrollY)).toBe(before)
  await expect(page.locator('.ctt-rail')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect.poll(async () => (await reachable(trigger)).visible).toBe(true)
  expect((await reachable(trigger)).hit).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ctt-selector-button')).toBeFocused()
  await expect(page.locator('.ctt-rail')).toBeHidden()
})

for (const width of [320, 844, 1440]) for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) {
  test(`${locale} ${width}px 두배 글자 전략 목록은 Tab·축소·폭 전환 후 같은 활성 행에 도달한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/account-terminal-preview.html?market=1')
    await language(page, locale)
    await enlarge(page, '.ctt-selector-button > span,.ctt-selector-button > b,.tft-rh b,.tft-rh button,.tft-rf input,.tft-rf select,.tft-select .nm,.tft-select .st,.tft-select .sy,.tft-select .ver,.tft-select .cap,.tft-rfoot')
    await page.locator('.ctt-selector-button').click()
    const search = page.locator('.tft-rf input'), row = page.locator('.tft-select').last()
    await expect(search).toBeFocused()
    await search.fill('USDT')
    await expect(page.locator('.tft-select')).toHaveCount(2)
    for (let index = 0; index < 4; index++) await page.keyboard.press('Tab')
    await expect(row).toBeFocused()
    await page.setViewportSize({ width, height: 480 })
    await frame(page)
    await info.attach('active-expanded-row-before-assertion', { body: JSON.stringify(await reachable(row)), contentType: 'application/json' })
    await expect(row).toBeFocused()
    await expect.poll(async () => (await reachable(row)).visible).toBe(true)
    expect((await reachable(row)).hit).toBe(true)
    const node = await row.elementHandle()
    await page.setViewportSize({ width: width <= 960 ? 1440 : 844, height: 480 })
    await expect(row).toBeFocused()
    await expect.poll(async () => (await reachable(row)).visible).toBe(true)
    expect((await reachable(row)).hit).toBe(true)
    expect(await row.evaluate((element, previous) => element === previous, node)).toBe(true)
    await info.attach('active-expanded-row', { body: JSON.stringify(await reachable(row)), contentType: 'application/json' })
    await page.keyboard.press('Escape')
    await expect(page.locator('.ctt-selector-button')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(search).toHaveValue('USDT')
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page.locator('.ctt-rail')).not.toHaveAttribute('data-viewport-fallback', 'true')
  })
}

for (const width of [320, 844, 1440]) test(`${width}px 실제 종목 목록은 방향키·Home·End·PageDown·Tab 및 낮아진 화면에서 초점을 표시한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  // Reuse the existing explicit display fixture; no account, order or provider authority.
  await page.evaluate(async () => {
    const path = '/tests/fixtures/market-picker-harness.tsx'
    const { mountMarketPicker } = await import(/* @vite-ignore */ path)
    mountMarketPicker({ many: true })
  })
  await page.locator('.cmp-trigger').click()
  const rows = page.locator('.cmp-select')
  await expect(rows).toHaveCount(740)
  await rows.first().focus()
  await page.keyboard.press('ArrowDown'); await expect(rows.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowUp'); await expect(rows.first()).toBeFocused()
  await page.keyboard.press('End'); await expect(rows.last()).toBeFocused()
  await page.keyboard.press('Home'); await expect(rows.first()).toBeFocused()
  await page.keyboard.press('PageDown'); await expect(rows.first()).toBeFocused()
  await page.keyboard.press('End'); await expect(rows.last()).toBeFocused()
  await page.setViewportSize({ width, height: 480 })
  await frame(page)
  await expect(rows.last()).toBeFocused()
  const state = await rows.last().evaluate(element => {
    const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return { visible: box.top >= 0 && box.bottom <= innerHeight, hit: hit === element || !!hit && element.contains(hit), box: box.toJSON() }
  })
  await info.attach('market-active-row', { body: JSON.stringify(state), contentType: 'application/json' })
  expect(state.visible).toBe(true); expect(state.hit).toBe(true)
  await page.keyboard.press('Tab'); await expect(page.locator('.cmp-close')).toBeFocused()
  await page.keyboard.press('Escape'); await expect(page.locator('.cmp-trigger')).toBeFocused()
})
