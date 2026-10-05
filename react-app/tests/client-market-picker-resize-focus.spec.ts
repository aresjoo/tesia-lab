import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

async function frame(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function mount(page: Page, language = 'ko') {
  await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
  await page.goto('/')
  await page.evaluate(async () => {
    const path = '/tests/fixtures/market-picker-harness.tsx'
    const { mountMarketPicker } = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'pickerHarness', mountMarketPicker({ many: true }))
  })
  await page.locator('.cmp-trigger').click()
  await expect(page.locator('.cmp-select')).toHaveCount(740)
}

async function reachable(control: Locator) {
  return control.evaluate(element => {
    const box = element.getBoundingClientRect(), dialog = element.closest('.cmp-dialog')!.getBoundingClientRect()
    const viewport = window.visualViewport, top = viewport?.offsetTop ?? 0, bottom = top + (viewport?.height ?? innerHeight)
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    const list = element.closest('.cmp-dialog')!.querySelector('.cmp-rows')!
    return { visible: box.top >= Math.max(top, dialog.top) - 1 && box.bottom <= Math.min(bottom, dialog.bottom) + 1 && box.left >= 0 && box.right <= innerWidth + 1,
      hit: hit === element || !!hit && element.contains(hit), box: box.toJSON(), dialog: dialog.toJSON(),
      listOverflow: getComputedStyle(list).overflowY, listScroll: list.scrollTop, dialogScroll: element.closest('.cmp-dialog')!.scrollTop, pageScroll: scrollY }
  })
}

async function evidence(control: Locator, page: Page, info: TestInfo) {
  await info.attach('market-active-row-after-resize', { body: JSON.stringify(await reachable(control)), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('market-active-row-after-resize.png') })
}

for (const width of [320, 844, 1440]) test(`${width}px 실제740종목 End 뒤 900→480 높이 변경은 같은 활성 행을 노출한다`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await mount(page)
  const rows = page.locator('.cmp-select'), active = rows.last()
  await rows.first().focus()
  await page.keyboard.press('ArrowDown'); await expect(rows.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowUp'); await expect(rows.first()).toBeFocused()
  await page.keyboard.press('End'); await expect(active).toBeFocused()
  await page.keyboard.press('Home'); await expect(rows.first()).toBeFocused()
  await page.keyboard.press('PageDown'); await expect(rows.first()).toBeFocused()
  await page.keyboard.press('End'); await expect(active).toBeFocused()
  expect((await reachable(active)).visible).toBe(true)
  const node = await active.elementHandle()
  await page.setViewportSize({ width, height: 480 })
  await frame(page)
  await evidence(active, page, info)
  await expect(active).toBeFocused()
  expect(await active.evaluate((element, previous) => element === previous, node)).toBe(true)
  expect((await reachable(active)).visible).toBe(true)
  expect((await reachable(active)).hit).toBe(true)
  await page.setViewportSize({ width, height: 900 })
  await frame(page)
  await expect(active).toBeFocused()
  expect((await reachable(active)).visible).toBe(true)
  expect((await reachable(active)).hit).toBe(true)
  await page.keyboard.press('Tab'); await expect(page.locator('.cmp-close')).toBeFocused()
  await page.keyboard.press('Escape'); await expect(page.locator('.cmp-trigger')).toBeFocused()
  await expect(page.getByTestId('count')).toHaveText('0')
})

for (const language of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']) for (const width of [320, 844, 1440]) {
  test(`${language} ${width}px 두배 글자 마지막 별은 높이·폭 전환 뒤 같은 초점을 표시한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await mount(page, language)
    await page.locator('.cmp-dialog h2,.cmp-dialog p,.cmp-dialog button,.cmp-dialog input,.cmp-dialog small').evaluateAll(elements => {
      const sizes = elements.map(element => parseFloat(getComputedStyle(element).fontSize))
      elements.forEach((element, index) => (element as HTMLElement).style.setProperty('font-size', `${sizes[index] * 2}px`, 'important'))
    })
    const active = page.locator('.cmp-star').last()
    await page.locator('.cmp-star').first().focus()
    await page.keyboard.press('End')
    await expect(active).toBeFocused()
    const node = await active.elementHandle()
    await page.setViewportSize({ width, height: 480 })
    await frame(page)
    await evidence(active, page, info)
    await expect(active).toBeFocused()
    expect((await reachable(active)).visible).toBe(true)
    expect((await reachable(active)).hit).toBe(true)
    await page.setViewportSize({ width: width <= 960 ? 1440 : 844, height: 480 })
    await frame(page)
    await expect(active).toBeFocused()
    expect(await active.evaluate((element, previous) => element === previous, node)).toBe(true)
    expect((await reachable(active)).visible).toBe(true)
    expect((await reachable(active)).hit).toBe(true)
    await expect(page.getByTestId('count')).toHaveText('0')
  })
}

test('화면 배치 갱신은 새 버튼·입력 초점과 후속 pointer·wheel의 스크롤 의도를 보존한다', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 480 })
  await mount(page)
  const active = page.locator('.cmp-select').last()
  const search = page.getByRole('searchbox'), close = page.locator('.cmp-close')
  for (const selector of ['.cmp-search input', '.cmp-close']) {
    await active.focus()
    const before = await page.locator('.cmp-dialog').evaluate(dialog => {
      window.dispatchEvent(new Event('resize'))
      dialog.querySelector<HTMLElement>('.cmp-search input')?.focus({ preventScroll: true })
      return dialog.scrollTop
    })
    await page.locator(selector).evaluate(node => (node as HTMLElement).focus({ preventScroll: true }))
    await frame(page)
    await expect(selector === '.cmp-close' ? close : search).toBeFocused()
    expect(await page.locator('.cmp-dialog').evaluate(dialog => dialog.scrollTop)).toBe(before)
  }
  for (const event of ['pointerdown', 'wheel']) {
    await active.focus()
    const requested = await page.locator('.cmp-dialog').evaluate((dialog, event) => {
      window.dispatchEvent(new Event('resize'))
      dialog.dispatchEvent(new Event(event, { bubbles: true }))
      dialog.scrollTop = 0
      return dialog.scrollTop
    }, event)
    await frame(page)
    await expect(active).toBeFocused()
    expect(await page.locator('.cmp-dialog').evaluate(dialog => dialog.scrollTop)).toBe(requested)
  }
})

test('일반 목록·시트 스크롤과 visualViewport scroll은 활성 행으로 되돌리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 900 })
  await mount(page)
  const active = page.locator('.cmp-select').last()
  for (const height of [900, 480]) {
    await page.setViewportSize({ width: 844, height })
    await frame(page)
    await active.focus()
    const requested = await page.evaluate(() => {
      const dialog = document.querySelector('.cmp-dialog')!, list = document.querySelector('.cmp-rows')!
      dialog.scrollTop = 0; list.scrollTop = 0
      window.visualViewport?.dispatchEvent(new Event('scroll'))
      return { dialog: dialog.scrollTop, list: list.scrollTop, page: scrollY }
    })
    await frame(page)
    await expect(active).toBeFocused()
    expect(await page.evaluate(() => ({ dialog: document.querySelector('.cmp-dialog')!.scrollTop, list: document.querySelector('.cmp-rows')!.scrollTop, page: scrollY }))).toEqual(requested)
  }
})

test('예약된 resize는 새 owned child dialog의 초점·부모 스크롤을 침범하지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 480 })
  await mount(page)
  await page.locator('.cmp-select').last().focus()
  const before = await page.locator('.cmp-dialog').evaluate(dialog => {
    window.dispatchEvent(new Event('resize'))
    const child = document.createElement('dialog'), button = document.createElement('button')
    child.id = 'picker-owned-child'; button.textContent = 'Owned child action'; child.append(button); dialog.append(child)
    child.showModal(); button.focus()
    return dialog.scrollTop
  })
  await frame(page)
  await expect(page.locator('#picker-owned-child button')).toBeFocused()
  expect(await page.locator('.cmp-dialog').evaluate(dialog => dialog.scrollTop)).toBe(before)
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#picker-owned-child')!.close())
})

test('닫힌 선택기의 예약된 resize는 부모 복귀와 이후 외부 초점을 되돌리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 480 })
  await mount(page)
  await page.locator('.cmp-select').last().focus()
  await page.locator('.cmp-dialog').evaluate(dialog => {
    window.dispatchEvent(new Event('resize'))
    dialog.querySelector<HTMLButtonElement>('.cmp-close')!.click()
  })
  await frame(page)
  await expect(page.locator('.cmp-dialog')).toHaveCount(0)
  await expect(page.locator('.cmp-trigger')).toBeFocused()
  await page.getByRole('button', { name: 'Outside action' }).focus()
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await frame(page)
  await expect(page.getByRole('button', { name: 'Outside action' })).toBeFocused()
  await expect(page.getByTestId('count')).toHaveText('0')
})
