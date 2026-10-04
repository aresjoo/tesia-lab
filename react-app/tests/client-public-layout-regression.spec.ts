import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, route: string) {
  await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
  await page.goto(`/${route}/`)
  await expect(page.locator('.client-public-page')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

async function doubleText(page: Page) {
  // Text-only accessibility simulation, not a claim of OS or browser zoom.
  // Snapshot all inherited sizes before changing any parent to avoid 4x text.
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>('.client-public-page, .client-public-page *')].filter(node => node instanceof HTMLElement)
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, index) => node.style.setProperty('font-size', `${sizes[index] * 2}px`, 'important'))
  })
}

for (const width of [320, 390, 768, 1024]) {
  test(`policy footer ${width} preserves final source gutters and summary link`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await open(page, 'policies')
    // Independent original site-footer.js final CSS values, not React exports.
    await expect(page.locator('.gft-in')).toHaveCSS('padding', width <= 600 ? '0px 20px 20px' : '0px 40px 28px')
    await expect(page.locator('.gft-crs')).toHaveCSS('text-decoration-line', 'underline')
    // Original policies main inherits zero from its page reset, not the
    // unrelated application main gutters and sticky-composer bottom reserve.
    await expect(page.locator('#site-main')).toHaveCSS('padding-left', '0px')
    await expect(page.locator('#site-main')).toHaveCSS('padding-right', '0px')
    await expect(page.locator('#site-main')).toHaveCSS('padding-bottom', '0px')
    const link = page.locator('.gft-col a[href="/download/"]')
    await link.focus()
    await expect(link).toBeFocused()
    const inset = await link.evaluate(node => {
      const r = node.getBoundingClientRect(), footer = node.closest('footer')!.getBoundingClientRect()
      return { left: r.left - footer.left, right: footer.right - r.right }
    })
    // The company column is second on a tablet, so its left edge need not be
    // the first grid track. Both edges must remain inside the source gutters.
    expect(inset.left).toBeGreaterThanOrEqual(width <= 600 ? 20 : 40)
    expect(inset.right).toBeGreaterThanOrEqual(width <= 600 ? 20 : 40)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/download\/$/)
  })

  test(`public header ${width} retains full CTA at 200 percent text`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ['about', 'download', 'policies']) {
      await open(page, route)
      if (route === 'about') await expect(page.locator('.ab-hero')).toHaveCSS('padding-top', '112px')
      if (route === 'download') await expect(page.locator('main.dl')).toHaveCSS('padding-top', width <= 900 ? '96px' : '128px')
      await doubleText(page)
      const cta = page.locator('.hd .cta')
      await cta.focus()
      await expect(cta).toBeFocused()
      const bounds = await cta.evaluate(node => {
        const r = node.getBoundingClientRect(), range = document.createRange()
        range.selectNodeContents(node)
        return { left: r.left, right: r.right, bottom: r.bottom, headerBottom: node.closest('header')!.getBoundingClientRect().bottom, width: innerWidth, text: [...range.getClientRects()].map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })), top: r.top }
      })
      await info.attach(`${route}-CTA-bounds`, { body: JSON.stringify(bounds), contentType: 'application/json' })
      expect.soft(bounds.left).toBeGreaterThanOrEqual(0)
      expect.soft(bounds.right).toBeLessThanOrEqual(width)
      expect.soft(bounds.bottom).toBeLessThanOrEqual(bounds.headerBottom + 1)
      for (const rect of bounds.text) {
        expect.soft(rect.left).toBeGreaterThanOrEqual(bounds.left - 1)
        expect.soft(rect.right).toBeLessThanOrEqual(Math.min(width, bounds.right) + 1)
        expect.soft(rect.top).toBeGreaterThanOrEqual(bounds.top - 1)
        expect.soft(rect.bottom).toBeLessThanOrEqual(bounds.bottom + 1)
      }
      const lead = page.locator(route === 'about' ? '.ab-hero > .pl-lb' : route === 'download' ? '.txt > .pl-lb' : '.pg-h1')
      await expect.poll(() => lead.evaluate(node => node.getBoundingClientRect().top - document.querySelector('.hd')!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0)
      await page.screenshot({ path: info.outputPath(`${route}-header-text-200.png`) })
    }
  })

  test(`download ${width} keyboard tabs retain source phone artwork at 200 percent text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, 'download')
    await doubleText(page)
    const tabs = page.locator('.download-tabs [role=tab]')
    await page.locator('.download-tabs').scrollIntoViewIfNeeded()
    await tabs.first().focus()
    for (const [key, index, screen] of [['ArrowRight', 1, 'report'], ['End', 2, 'live'], ['Home', 0, 'chat']] as const) {
      await page.keyboard.press(key)
      await expect(tabs.nth(index)).toBeFocused()
      await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true')
      const image = page.locator(`.slide.on[data-screen=${screen}] img`)
      await expect(image).toHaveAttribute('src', `/client-shots/dl-${screen}.webp`)
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth === 780 && node.naturalHeight === 1688)).toBe(true)
      const tabBox = await tabs.nth(index).boundingBox()
      expect(tabBox!.x).toBeGreaterThanOrEqual(0)
      expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(width)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

for (const width of [700, 701, 768, 1024, 1100, 1101]) test(`about source header navigation boundary ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await open(page, 'about')
  // Source about/index.html final max-width:1100 rule, not download's 900.
  await expect(page.locator('.hd nav')).toHaveCSS('display', width <= 1100 ? 'none' : 'flex')
  await expect(page.locator('.hd .cta')).toBeVisible()
})
