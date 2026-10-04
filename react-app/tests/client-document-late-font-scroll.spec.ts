import { expect, test } from '@playwright/test'

test('late real fonts do not reset reading movement without wheel or key events', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let blocked = 0
  await page.route('**/*.woff2*', async route => {
    blocked++
    await gate
    await route.fallback()
  })
  try {
    await page.goto('/about/#faq', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#site-main')).toBeFocused()
    await expect.poll(() => blocked).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.fonts.status)).toBe('loading')
    const before = await page.evaluate(() => {
      const before = scrollY
      // Use instant movement so the source's CSS smooth scrolling cannot defer
      // the fixture itself until after the font completion being measured.
      window.scrollTo({ top: Math.max(100, before - 400), behavior: 'instant' })
      const selected = scrollY
      const scroll = window.scrollTo.bind(window)
      Reflect.set(window, '__lateFontScrollCalls', 0)
      window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
        Reflect.set(window, '__lateFontScrollCalls', Reflect.get(window, '__lateFontScrollCalls') + 1)
        return scroll(...args)
      }) as typeof window.scrollTo
      // Explicit scroll-only fixture for browser/find/assistive movements.
      // No claim of operating-system or screen-reader execution is made.
      return { before, selected }
    })
    expect(before.before - before.selected).toBeGreaterThan(100)
    release()
    await page.evaluate(async () => {
      await document.fonts.ready
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })
    const after = await page.evaluate(() => ({ calls: Reflect.get(window, '__lateFontScrollCalls'), y: scrollY, fonts: document.fonts.status }))
    await info.attach('real-font-scroll', { body: JSON.stringify({ before, after, blocked }), contentType: 'application/json' })
    expect(after.fonts).toBe('loaded')
    expect(after.calls).toBe(0)
  } finally { release() }
})
