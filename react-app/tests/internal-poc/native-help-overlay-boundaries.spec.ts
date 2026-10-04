import { expect, test, type Locator, type Page } from '@playwright/test'
import footerCopy from '../../src/client-site-footer-copy.json' with { type: 'json' }

// Source 9fbff821 index.html:19075 delegates to the original help-widget.js.
// Keep source artwork/copy; assert accessible geometry on the actual service
// entry. Only session/CSRF GETs are fixtures, never provider authentication.
const languages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'] as const
const viewports = [{ width: 320, height: 320 }, { width: 390, height: 480 }, { width: 1440, height: 420 }]

async function mount(page: Page, baseURL: string | undefined, language: string) {
  if (!baseURL) throw new Error('Local test origin required')
  const origin = new URL(baseURL).origin
  const mutations: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(language => { localStorage.setItem('tethLang', language); localStorage.setItem('tethCurrency', 'USD') }, language)
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.origin !== origin) return route.abort('blockedbyclient')
    if (url.pathname.startsWith('/api/')) {
      if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"overlay_anonymous_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_overlay_boundary_0001', traceId: 'trace_overlay_boundary_0001' },
        data: session ? { sessionId: 'session_overlay_boundary_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_overlay_boundary_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  await page.goto('/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.evaluate(() => document.fonts.ready)
  return { mutations, errors }
}

async function geometry(panel: Locator) {
  return panel.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }
  })
}

async function assertContained(panel: Locator) {
  const value = await geometry(panel)
  expect.soft(value.top, 'panel top remains reachable').toBeGreaterThanOrEqual(0)
  expect.soft(value.left).toBeGreaterThanOrEqual(0)
  expect.soft(value.right).toBeLessThanOrEqual(value.viewportWidth)
  expect.soft(value.bottom).toBeLessThanOrEqual(value.viewportHeight)
  expect.soft(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth + 1)
}

async function assertHittable(control: Locator) {
  await expect(control).toBeInViewport()
  expect.soft(await control.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return target === element || Boolean(target && element.contains(target))
  }), 'close control is not covered by the header or its floating trigger').toBe(true)
}

for (const viewport of viewports) for (const language of languages) {
  test(`${viewport.width}x${viewport.height} ${language} service floating help and modal help stay reachable`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport)
    const evidence = await mount(page, baseURL, language)
    const entry = page.locator('.site-help-trigger:visible')
    await expect(entry).toBeVisible()
    await entry.focus(); await page.keyboard.press('Enter')
    const panel = page.locator('.site-help-pop')
    await expect(panel).toBeVisible()
    await expect(panel.locator('.help-close')).toBeFocused()
    await info.attach('floating-help-geometry', { body: JSON.stringify(await geometry(panel)), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('floating-help.png') })
    await assertContained(panel)
    const links = panel.locator('a')
    await links.last().focus()
    await expect(links.last()).toBeInViewport()
    await panel.locator('.help-close').focus()
    await assertHittable(panel.locator('.help-close'))
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(entry).toBeFocused()
    // The source-positioned popup can cover its own FAB. Keyboard exit must
    // close it before returning focus so that the trigger is visibly usable.
    await page.keyboard.press('Enter')
    await expect(panel).toBeVisible()
    await links.last().focus(); await page.keyboard.press('Tab')
    await expect(panel).toHaveCount(0)
    await expect(entry).toBeFocused()
    await assertHittable(entry)
    // Trading introduction includes the source shared footer for guests;
    // the unauthenticated conversation home deliberately does not.
    await page.evaluate(() => { window.location.hash = '/trade' })
    await expect(page.locator('.txh')).toBeVisible()
    // Footer help is a modal variant with focus trapping and return-focus.
    const footerEntry = page.locator('.client-site-footer').getByRole('button', { name: footerCopy[language].sections.help.items[0], exact: true })
    await expect(footerEntry).toBeVisible()
    await footerEntry.click()
    const modal = page.locator('.client-modal-help .site-help-pop')
    await expect(modal).toHaveAttribute('aria-modal', 'true')
    await expect(modal.locator('.help-close')).toBeFocused()
    await assertHittable(modal.locator('.help-close'))
    await assertContained(modal)
    await page.keyboard.press('Shift+Tab')
    await expect(modal.locator('a').last()).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(modal.locator('.help-close')).toBeFocused()
    await modal.locator('.help-close').click()
    await expect(modal).toHaveCount(0)
    await expect(footerEntry).toBeFocused()
    expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
  })

  test(`${viewport.width}x${viewport.height} ${language} service login closes and restores focus without clipping`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport)
    const evidence = await mount(page, baseURL, language)
    const entry = page.locator('.client-login:visible')
    await entry.click()
    const panel = page.locator('.native-auth-surface')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveAttribute('open', '')
    await info.attach('login-geometry', { body: JSON.stringify(await geometry(panel)), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('login.png') })
    await assertContained(panel)
    const close = panel.locator('[data-native-auth-close]')
    await expect(close).toBeFocused()
    const buttons = panel.locator('button:visible')
    await buttons.last().focus()
    await expect(buttons.last()).toBeInViewport()
    await page.keyboard.press('Tab')
    // Native dialog may pass through browser chrome (activeElement=body)
    // before wrapping. It must never focus the inert product underneath.
    expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest('.native-auth-surface')))).toBe(true)
    // The scrollable dialog itself is also a Chromium tab stop. Audit a full
    // cycle without assuming that its native tab order is a custom JS trap.
    let reachedClose = await close.evaluate(element => element === document.activeElement)
    for (let step = 0; step < 5 && !reachedClose; step++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest('.native-auth-surface')))).toBe(true)
      reachedClose = await close.evaluate(element => element === document.activeElement)
    }
    expect(reachedClose).toBe(true)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(entry).toBeFocused()
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await entry.click(); await expect(panel).toBeVisible(); await close.click()
    await expect(panel).toHaveCount(0); await expect(entry).toBeFocused()
    expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
  })
}
