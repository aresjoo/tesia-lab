import { expect, test } from '@playwright/test'

type FocusRecord = { event: string; target: string; active: string; time: number; caller?: string }
declare global { interface Window { __helpInitialFocus: FocusRecord[] } }

for (const route of ['/about/', '/download/', '/policies/']) {
  for (const mode of ['early-programmatic', 'keyboard', 'pointer'] as const) test(`${route} ${mode} help intent survives initial document alignment`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.addInitScript(({ early }) => {
      window.__helpInitialFocus = []
      const label = (target: EventTarget | null) => target instanceof HTMLElement ? target.id || target.className || target.tagName : ''
      const record = (event: string, target: EventTarget | null, caller?: string) => {
        window.__helpInitialFocus.push({ event, target: label(target), active: label(document.activeElement), time: performance.now(), caller })
      }
      for (const kind of ['focusin', 'keydown', 'pointerdown', 'click']) window.addEventListener(kind, event => {
        record(kind + (event instanceof KeyboardEvent ? `:${event.key}` : ''), event.target)
      }, true)
      const nativeFocus = HTMLElement.prototype.focus
      HTMLElement.prototype.focus = function (...args) {
        record('focus-call', this, new Error().stack?.split('\n')[2])
        return nativeFocus.apply(this, args)
      }
      if (early) {
        // Same programmatic focus as Locator.focus, deterministically placed
        // after the actual React DOM commit but before its native alignment RAF.
        // No timer, requestAnimationFrame, event trust or React state is replaced.
        const observer = new MutationObserver(() => {
          const trigger = document.querySelector<HTMLButtonElement>('.site-help-trigger')
          if (!trigger) return
          observer.disconnect()
          trigger.focus()
          record('early-programmatic-focus', trigger)
        })
        observer.observe(document, { childList: true, subtree: true })
      }
    }, { early: mode === 'early-programmatic' })
    await page.goto(route)
    const trigger = page.locator('.site-help-trigger')
    const close = page.locator('.site-help-pop .help-close')
    await expect(trigger).toBeVisible()
    try {
      if (mode === 'early-programmatic') {
        // Observe the real alignment callback; waiting here exposes rather than
        // masks an already-selected trigger being overwritten by main.focus.
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        await page.keyboard.press('Enter')
        expect(await page.evaluate(() => window.__helpInitialFocus.some(event => event.event === 'keydown:Enter' && event.target === 'site-help-trigger'))).toBe(true)
        await expect(close).toBeFocused()
      } else if (mode === 'keyboard') {
        // Native Tab navigation, no Locator.focus or synthetic KeyboardEvent.
        for (let step = 0; step < 90 && !(await trigger.evaluate(node => node === document.activeElement)); step++) await page.keyboard.press('Tab')
        await expect(trigger).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(close).toBeFocused()
      } else {
        await trigger.click()
        await expect(close).toBeVisible()
        await expect(trigger).toBeFocused()
      }
      await page.keyboard.press('Escape')
      await expect(page.locator('.site-help-pop')).toHaveCount(0)
      await expect(trigger).toBeFocused()
    } finally {
      await info.attach('help-initial-focus-events', { body: JSON.stringify(await page.evaluate(() => window.__helpInitialFocus)), contentType: 'application/json' })
    }
  })
}
