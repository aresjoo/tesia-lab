import { expect, test } from '@playwright/test'

test.setTimeout(30_000)

for (const width of [320, 760, 761, 1440]) test(`${width}px latest source intro keeps copy, sans hierarchy and white action`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/trade')
  const root = page.locator('.txh'), heading = root.locator('h1'), action = root.locator('.txh-hero .txh-cta')
  await expect(heading).toHaveText('AI가 스스로 판단해 거래합니다')
  await expect(root.locator('.txh-sub')).toHaveText('거래소 계정을 한 번 승인으로 연결하면 전략이 그 계정에서 직접 주문합니다.')
  await expect(heading).toHaveCSS('font-weight', '400')
  await expect(heading).toHaveCSS('font-size', width <= 760 ? '32px' : '48px')
  expect(await heading.evaluate(el => getComputedStyle(el).fontFamily)).not.toMatch(/Serif|Myeongjo|Batang/)
  await expect(root).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(root.locator('.txh-hero')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(action).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(action).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(action).toHaveCSS('font-weight', '500')
  await expect(action).toHaveCSS('height', '48px')
  await expect(root.locator('.txh-ai-cols li')).toHaveCount(9)
  await expect(root.locator('.txh-floor img')).toHaveAttribute('src', /tiles/)
  await expect(root.locator('.txh-note').first()).toHaveText('영원히 무료, 카드 등록 필요없음')
  await expect(root.locator('.txh-example-note')).toContainText('실제 거래 기록이 아닙니다')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.screenshot({ path: info.outputPath('source-intro.png') })
  await action.click()
  await expect(page.getByTestId('connection-plan')).toBeVisible()
  await expect(page.locator('.ca-auth')).toHaveCount(0)
})

for (const width of [390, 1440]) test(`${width}px main shell and open rail inherit black without changing composer`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  const shell = page.locator('.tesia-shell.client-source-app')
  await expect(shell).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(page.locator('.client-source-main')).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  const input = page.locator('#strategy-idea')
  await input.fill('배경을 바꿔도 남는 초안')
  await page.locator(width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  const rail = page.locator('.client-sidebar.mobile-open')
  await expect(rail).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(rail).toHaveCSS('border-right-width', '1px')
  await expect(rail).toHaveCSS('border-right-color', 'rgba(255, 255, 255, 0.1)')
  await expect(input).toHaveValue('배경을 바꿔도 남는 초안')
})

test('intro retains guest navigation, dismissal, help and header clearance', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/trade')
  const banner = page.locator('.client-app-banner'), nav = page.locator('.client-auth-nav')
  await expect(banner).toBeVisible()
  await expect(nav).toBeVisible()
  await expect(page.locator('.site-help')).toBeVisible()
  const clear = async () => {
    const header = await nav.boundingBox(), title = await page.locator('.txh-eyebrow').boundingBox()
    expect(title!.y).toBeGreaterThan(header!.y + header!.height + 12)
  }
  await clear()
  await banner.getByRole('button').click()
  await expect(banner).toHaveCount(0)
  await clear()
  await nav.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.locator('.ca-auth')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-auth')).toHaveCount(0)
  await expect(nav.getByRole('button', { name: '로그인', exact: true })).toBeFocused()
  await expect(page.locator('.txh')).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(nav.getByRole('link', { name: 'TETH 정보', exact: true })).toBeVisible()
  await expect(page.locator('.client-globe')).toBeVisible()
})

for (const width of [390, 1440]) test(`${width}px intro header prevents scrolled content from painting behind fixed account actions`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/#/trade')
  await page.locator('.txh-card').first().scrollIntoViewIfNeeded()
  const header = page.locator('.txh-route-heading')
  await expect(header).toHaveCSS('position', 'sticky')
  await expect(header).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  const h = await header.boundingBox(), nav = await page.locator('.client-auth-nav').boundingBox()
  expect(h!.y).toBeCloseTo(0, 0)
  expect(h!.y + h!.height).toBeGreaterThanOrEqual(nav!.y + nav!.height)
  expect(await header.evaluate(el => {
    const r = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.bottom - 2))
  })).toBe(true)
})

for (const width of [320, 390, 761, 861, 1440]) test(`${width}px short French intro keeps actual numbers and actions readable at 200%`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 480 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/trade')
  await expect(page.locator('.txh h1')).toBeVisible()
  await page.evaluate(async () => {
    const path = '/src/client-preferences.ts'
    const { setClientPreference } = await import(path)
    setClientPreference('language', 'fr')
  })
  for (const zoom of [1, 2]) {
    await page.locator('.txh').evaluate((el, value) => { (el as HTMLElement).style.zoom = String(value) }, zoom)
    // Container-query typography settles after the zoom-triggered layout pass.
    // Assert the rendered state, not a mixture of old type and new column widths.
    await expect.poll(() => page.locator('.txh').evaluate(el => {
      const hero = el.querySelector('.txh-hero')!.getBoundingClientRect()
      const action = el.querySelector('.txh-hero .txh-cta')!.getBoundingClientRect()
      return {
        heroContainsAction: action.top >= hero.top && action.bottom <= hero.bottom,
        overflowing: [...el.querySelectorAll('.txh-stat dd,.txh-cta')].filter(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1).map(node => ({text:node.textContent,width:[node.clientWidth,node.scrollWidth],height:[node.clientHeight,node.scrollHeight],font:getComputedStyle(node).fontFamily,size:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight})),
      }
    })).toEqual({ heroContainsAction: true, overflowing: [] })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const last = page.locator('.txh-safe .txh-cta')
    await last.scrollIntoViewIfNeeded()
    expect(await last.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) })).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('short-enlarged-intro.png') })
})
