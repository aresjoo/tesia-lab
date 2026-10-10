import { expect, test, type Page } from '@playwright/test'
import { catalogueCopyLocation, sharedHash } from '../src/client-shared-navigation'

const owner = 'copy-layout@example.test', id = 'layout-copy'

async function previewOwner(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(owner => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '배치 검수', email: owner }))
  }, owner)
}

test('카피 상세만 중복 Hub 흐름과 모바일 이중 여백을 제거하고 고지·44px 복귀 접근을 보존한다', async ({ page }, info) => {
  const mutations: string[] = []
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.method() + ' ' + request.url()) })
  await previewOwner(page)
  await page.goto('/')
  // The existing isolated source-preview controller supplies a record, not a
  // customer account, API connection, forced inspection result or success flag.
  await page.evaluate(async ({ owner, id }) => {
    const { createCatalogueCopyAccountController } = await import('/src/client-catalogue-copy-account.ts')
    const controller = createCatalogueCopyAccountController(owner)
    try {
      const started = await controller.start({ id, strategyId: 'd1', at: Date.UTC(2026, 8, 1), settings: { amount: 500, loss: -20, existing: 'copy', cap: 95 } })
      if (!started.ok) throw Error(started.error)
    } finally { controller.dispose() }
  }, { owner, id })

  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    await page.goto('/' + sharedHash(catalogueCopyLocation(id)))
    const root = page.locator('.catalogue-copy-management')
    const header = page.locator('.client-sharing-hub > .hub-header')
    const back = root.locator('.cq-back')
    const boundary = page.locator('.client-strategy-sharing > .ss3-boundary')
    await expect(root.locator('.cpp-nick')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(header).toHaveCSS('position', 'absolute')
    await expect(header).toHaveCSS('clip-path', 'inset(50%)')
    expect((await header.boundingBox())!.height).toBeLessThanOrEqual(1)
    await expect(boundary).toBeVisible()
    await expect(boundary).not.toHaveText('')
    if (width <= 390) {
      await expect(boundary).toHaveCSS('padding-left', '64px')
      await expect(boundary).toHaveCSS('padding-right', '18px')
      const textBounds = await boundary.evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element)
        const box = range.getBoundingClientRect(); return { left: box.left, right: box.right }
      })
      const menu = (await page.locator('.client-hamburger').boundingBox())!
      expect(textBounds.left).toBeGreaterThanOrEqual(menu.x + menu.width + 10)
      expect(textBounds.right).toBeLessThanOrEqual(width - 18)
    }
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    const title = (await root.locator('.cpp-nick').boundingBox())!
    expect(title.x).toBeCloseTo(width <= 390 ? 16 : 396, 1)
    expect(title.width).toBeCloseTo(width <= 390 ? width - 32 : 712, 1)
    // Final ares cpxView: desktop y114/mobile y98. The retained boundary and
    // approved 44px back (source height22) intentionally leave +26/+22px.
    if (width === 320) {
      // Do not squeeze a wrapped disclosure into a fixed-height box.
      expect(title.y).toBeCloseTo((await boundary.boundingBox())!.height + 76, 1)
    } else {
      expect(title.y).toBeCloseTo(width === 390 ? 120 : 140, 1)
      expect(title.y - (width === 390 ? 98 : 114)).toBeCloseTo(width === 390 ? 22 : 26, 1)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`copy-layout-${width}.png`) })

    // The visually clipped utility remains in native keyboard order. Only
    // focusing its return button reveals an overlay, never a new layout row.
    await back.focus()
    await page.keyboard.press('Shift+Tab')
    const utility = header.locator('button')
    await expect(utility).toBeFocused()
    await expect(header).toHaveCSS('position', 'fixed')
    expect((await utility.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await root.locator('.cpp-nick').boundingBox())!.y).toBeCloseTo(title.y, 1)
    await page.keyboard.press('Tab')
    await expect(back).toBeFocused()
    await expect(header).toHaveCSS('position', 'absolute')
    await utility.focus()
    await utility.click()
    await expect(root).toHaveCount(0)
  }
  expect(mutations).toEqual([])
})

test('같은 Hub의 기존 관리 목록은 64px 헤더와 desktop40/mobile18px 바깥 여백을 유지한다', async ({ page }) => {
  await previewOwner(page)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/#/share/library')
    await expect(page.locator('#research-title')).toHaveText('따라가는 중')
    await expect(page.locator('.client-strategy-sharing')).toBeVisible()
    await expect(page.locator('.catalogue-copy-management')).toHaveCount(0)
    await expect(page.locator('.client-sharing-hub > .hub-header')).toHaveCSS('position', 'sticky')
    expect((await page.locator('.client-sharing-hub > .hub-header').boundingBox())!.height).toBe(64)
    await expect(page.locator('.client-strategy-sharing')).toHaveCSS('padding-left', width === 390 ? '18px' : '40px')
    await expect(page.locator('.client-strategy-sharing')).toHaveCSS('padding-right', width === 390 ? '18px' : '40px')
  }
})
