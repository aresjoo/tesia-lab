import { expect, test } from '@playwright/test'

for (const kind of ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const) test(`initial ${kind} intent survives StrictMode effect replay without forced focus or scroll`, async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.addInitScript(kind => {
    const observer = new MutationObserver(() => {
      const main = document.querySelector<HTMLElement>('#site-main')
      if (!main || document.documentElement.scrollHeight < 1200) return
      observer.disconnect()
      // Explicit event-boundary fixture, not a claim of trusted wheel input.
      // Native RAF, layout and React scheduling remain unmodified.
      window.dispatchEvent(new Event(kind))
      window.scrollTo({ top: 400, behavior: 'instant' })
      Reflect.set(window, '__initialDocumentIntent', { kind, top: scrollY, active: document.activeElement?.id })
    })
    observer.observe(document, { childList: true, subtree: true })
  }, kind)
  await page.goto('/about/')
  await expect(page.locator('#site-main')).toBeVisible()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const initial = await page.evaluate(() => Reflect.get(window, '__initialDocumentIntent'))
  await info.attach('initial-intent', { body: JSON.stringify(initial), contentType: 'application/json' })
  expect(initial).toMatchObject({ kind, top: 400 })
  expect(await page.evaluate(() => scrollY)).toBe(400)
  await expect(page.locator('#site-main')).not.toBeFocused()
})
