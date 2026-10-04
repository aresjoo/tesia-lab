import { expect, test } from '@playwright/test'

// Real service entry with a deliberately delayed, explicit session HTTP fixture.
// This checks presentation transitions, not successful OAuth or account data.
for (const width of [320, 1440]) for (const authenticated of [false, true]) {
  test(`${width}px delayed ${authenticated ? 'member' : 'guest'} bootstrap settles the correct trading chrome`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Local baseURL required')
    await page.setViewportSize({ width, height: 480 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const origin = new URL(baseURL).origin
    const mutations: string[] = [], errors: string[] = []
    let releaseSession!: () => void
    const gate = new Promise<void>(resolve => { releaseSession = resolve })
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => localStorage.setItem('tethLang', 'fr'))
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      if (!['GET', 'HEAD'].includes(request.method())) {
        mutations.push(`${request.method()} ${url.pathname}`)
        return route.abort('blockedbyclient')
      }
      if (url.origin !== origin) return route.abort('blockedbyclient')
      if (url.pathname.startsWith('/api/')) {
        if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
        const session = url.pathname.endsWith('/session')
        if (session) await gate
        return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"bootstrap_boundary_001"' } : {}, body: JSON.stringify({
          meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_bootstrap_boundary_001', traceId: 'trace_bootstrap_boundary_001' },
          data: session ? { sessionId: 'session_bootstrap_boundary_001', state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
            : { csrfToken: 'csrf_bootstrap_boundary_001', expiresAt: '2030-01-02T00:00:00Z' },
        }) })
      }
      if (request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
      return route.continue()
    })
    try {
      await page.goto('/#/trade')
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'loading')
      await expect(page.locator('.native-trading-workspace')).toHaveCount(0)
      await expect(page.locator('dialog[open]')).toHaveCount(0)
      releaseSession()
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
      await page.evaluate(() => document.fonts.ready)
      if (authenticated) {
        await expect(page.locator('.native-trading-workspace')).toBeVisible()
        await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', '')
        await expect(page.locator('.txh, .client-auth-nav, .client-site-footer')).toHaveCount(0)
        await expect(page.locator('.client-service-app')).not.toHaveClass(/has-trading-intro|has-site-footer/)
      } else {
        await expect(page.locator('.txh')).toBeVisible()
        await expect(page.locator('.client-service-app')).toHaveClass(/has-trading-intro/)
        await expect(page.locator('.client-site-footer')).toHaveCount(1)
        for (const selector of ['.client-login', '.client-signup']) {
          const button = page.locator(`.client-auth-nav ${selector}`)
          await expect(button).toBeInViewport()
          await expect.poll(() => button.evaluate(element => {
            const rect = element.getBoundingClientRect()
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            return Boolean(hit && (hit === element || element.contains(hit)))
          })).toBe(true)
          await button.click()
          await expect(page.locator('.native-auth-surface')).toBeVisible()
          await page.keyboard.press('Escape')
          await expect(page.locator('dialog[open]')).toHaveCount(0)
          await expect(page).toHaveURL(/#\/trade$/)
          await expect(button).toBeFocused()
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
      await page.screenshot({ path: info.outputPath(`bootstrap-${width}-${authenticated}.png`) })
      expect(mutations).toEqual([])
      expect(errors).toEqual([])
    } finally { releaseSession() }
  })
}
