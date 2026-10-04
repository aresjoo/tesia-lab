import { expect, test } from '@playwright/test'

// Source 9fbff821 help-widget.js:24 inherits the surrounding font stack;
// it does not truncate the application's CJK fallback at Korean. This runs
// the actual service entry, with synthetic session/CSRF GET responses only.
// CSS fallback is the portable requirement. CDP below is separate Chromium
// rendering evidence for these shipped zh-CN/zh-TW strings on this platform,
// not a claim about every glyph or every OS font fallback implementation.
for (const language of ['zh-CN', 'zh-TW'] as const) {
  test(`service ${language} help retains the bundled CJK font fallback after fonts settle`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Local test origin required')
    const origin = new URL(baseURL).origin
    const mutations: string[] = [], failedFonts: string[] = [], errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('requestfailed', request => { if (request.resourceType() === 'font') failedFonts.push(new URL(request.url()).pathname) })
    await page.setViewportSize({ width: 390, height: 640 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(language => localStorage.setItem('tethLang', language), language)
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
      if (url.origin !== origin) return route.abort('blockedbyclient')
      if (url.pathname.startsWith('/api/')) {
        if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
        const session = url.pathname.endsWith('/session')
        return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"help_font_anonymous_001"' } : {}, body: JSON.stringify({
          meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_help_font_0001', traceId: 'trace_help_font_0001' },
          data: session ? { sessionId: 'session_help_font_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
            : { csrfToken: 'csrf_help_font_0001', expiresAt: '2030-01-02T00:00:00Z' },
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
    await page.locator('.site-help-trigger:visible').click()
    const panel = page.locator('.site-help-pop')
    await expect(panel).toBeVisible()
    // Wait for the fonts actually selected by the displayed content; do not
    // add arbitrary delays or force a diagnostic font into the product DOM.
    await page.evaluate(() => document.fonts.ready)
    const style = await panel.evaluate(element => ({ family: getComputedStyle(element).fontFamily, text: element.textContent, status: document.fonts.status }))
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument')
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.site-help-pop' })
    const rendered = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    await info.attach('settled-font-evidence', { body: JSON.stringify({ language, ...style, rendered, failedFonts }, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath(`help-${language}-settled-fonts.png`) })
    expect(style.status).toBe('loaded')
    expect.soft(style.family, 'help must not discard the shipped SC fallback').toContain('Noto Sans SC Variable')
    expect.soft(rendered.fonts.some(font => font.isCustomFont && /Noto Sans SC/.test(font.familyName) && font.glyphCount > 0), 'these displayed Chinese strings use the bundled SC font, not OS-dependent fallback').toBe(true)
    expect(failedFonts).toEqual([])
    expect(errors).toEqual([]); expect(mutations).toEqual([])
    await cdp.detach()
  })
}
