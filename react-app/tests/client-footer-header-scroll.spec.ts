import { expect, test } from '@playwright/test'

for (const path of ['/', '/#/trade']) {
  test(`desktop ${path} header scrolls with its page instead of covering the footer`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(path)
    const nav = page.locator('.client-auth-nav')
    const globe = page.locator('.client-globe')
    await expect(nav.getByRole('button', { name: /로그인/ })).toBeInViewport()
    await expect(globe).toBeInViewport()
    const original = await nav.elementHandle()
    const footer = page.locator('.client-site-footer')
    await footer.locator('.gft-wm').scrollIntoViewIfNeeded()
    await expect(footer.locator('.gft-wm')).toBeInViewport()
    await expect.poll(() => nav.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0)
    await expect.poll(() => globe.evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0)
    // The menu is not removed or disabled; keyboard focus must reveal it again.
    await nav.getByRole('button', { name: /로그인/ }).focus()
    await expect(nav.getByRole('button', { name: /로그인/ })).toBeInViewport()
    expect(await original!.evaluate(el => el === document.querySelector('.client-auth-nav'))).toBe(true)
    await page.screenshot({ path: info.outputPath('desktop-header-return.png') })
  })
}
