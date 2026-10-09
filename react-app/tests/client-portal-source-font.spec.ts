import { expect, test } from '@playwright/test'

// Literal ares 9fb --font prefix, with the separately approved SC fallback.
// Synthetic session GETs verify the real service entry's UI, not OAuth success.
const original = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo"'
const portal = `${original}, "Noto Sans SC Variable", "TETH Bitcoin Glyph", sans-serif`

for (const width of [320, 1440]) for (const native of [false, true]) {
  test(`${native ? 'service' : 'source'} ${width}px 로그인 portal은 원본 글꼴을 계승한다`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('LOCAL_ORIGIN_REQUIRED')
    const origin = new URL(baseURL).origin
    const audit = { mutations: [] as string[], external: [] as string[], errors: [] as string[] }
    page.on('pageerror', () => audit.errors.push('PAGE_ERROR'))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      localStorage.setItem('tethLang', 'ko')
      sessionStorage.setItem('teth-app-banner-dismissed', '1')
    })
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url())
      if (url.origin !== origin) { audit.external.push(request.method()); return route.abort('blockedbyclient') }
      if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(request.method()); return route.abort('blockedbyclient') }
      if (url.pathname.startsWith('/api/')) {
        const session = url.pathname === '/api/v1/auth/session'
        if (!session && url.pathname !== '/api/v1/auth/csrf') return route.abort('blockedbyclient')
        return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"portal_source_font_001"' } : {}, body: JSON.stringify({
          meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_portal_font_001', traceId: 'trace_portal_font_001' },
          data: session ? { sessionId: 'session_portal_font_001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
            : { csrfToken: 'csrf_portal_font_001', expiresAt: '2030-01-02T00:00:00Z' },
        }) })
      }
      if (native && request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
        await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
      return route.continue()
    })
    await page.goto('/')
    await expect(page.locator('.client-source-app')).toBeVisible()
    if (native) await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    const input = page.locator('#strategy-idea')
    const draft = '보존할 투자 아이디어\n거래 한도를 먼저 확인하고 싶습니다.'
    await input.fill(draft)
    await page.locator('.client-expand').click()
    const composer = page.locator('.client-composer-dialog[open]')
    await expect(composer).toBeVisible()
    await expect(composer).toHaveCSS('font-family', portal)
    await expect(composer.locator('textarea')).toHaveCSS('font-family', portal)
    await expect(composer.locator('textarea')).toHaveValue(draft)
    // Keep the approved Bitcoin-only fallback separate from installed ares fonts.
    await composer.evaluate(node => {
      const probe = document.createElement('span')
      probe.className = 'source-bitcoin-font-probe'
      probe.style.fontFamily = '"TETH Bitcoin Glyph"'
      probe.textContent = '₿'
      node.append(probe)
    })
    await page.evaluate(() => document.fonts.load('16px "TETH Bitcoin Glyph"', '₿'))
    // The original explicitly supplies this Korean webfont. A family string
    // alone must not pass while the browser silently uses an OS fallback.
    await composer.evaluate(node => {
      const probe = document.createElement('span')
      probe.className = 'source-hangul-font-probe'
      probe.textContent = '로그인 전략 확인'
      node.append(probe)
    })
    await page.evaluate(() => document.fonts.load('16px "Noto Sans KR"', '로그인 전략 확인'))
    expect(await page.evaluate(() => [...document.fonts].some(face => face.family.replaceAll('"', '').replaceAll("'", '') === 'Noto Sans KR' && face.status === 'loaded'))).toBe(true)
    expect(await page.evaluate(() => [...new Set([...document.fonts].filter(face => face.family.replaceAll('"', '').replaceAll("'", '') === 'Noto Sans KR').map(face => face.weight))].sort())).toEqual(['400', '500', '600', '700'])
    const cdp = await page.context().newCDPSession(page)
    try {
      await cdp.send('DOM.enable')
      await cdp.send('CSS.enable')
      const document = await cdp.send('DOM.getDocument')
      const node = await cdp.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '.source-bitcoin-font-probe' })
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId })
      expect(fonts.some(face => face.isCustomFont && face.postScriptName === 'NotoSans-Regular' && face.glyphCount === 1)).toBe(true)
      const hangul = await cdp.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '.source-hangul-font-probe' })
      const rendered = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: hangul.nodeId })
      expect(rendered.fonts.some(face => face.isCustomFont && face.postScriptName.startsWith('NotoSansKR-') && face.glyphCount > 0)).toBe(true)
    } finally { await cdp.detach() }
    await page.locator('.source-bitcoin-font-probe').evaluate(node => node.remove())
    await page.locator('.source-hangul-font-probe').evaluate(node => node.remove())
    await composer.locator('.client-expand').click()
    await expect(composer).toHaveCount(0)
    await expect(input).toHaveValue(draft)
    const login = page.locator('.client-auth-nav .client-login')
    if (await login.isVisible()) await login.click()
    else {
      await page.locator('.client-hamburger').click()
      await page.getByRole('button', { name: '사이드바 로그인', exact: true }).click()
    }
    const surface = page.locator(native ? '.native-auth-surface[open]' : '.ca-auth-veil')
    await expect(surface).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect(surface).toHaveCSS('font-family', portal)
    const title = surface.locator('.au-title')
    await expect(title).toHaveCSS('font-family', portal)
    await expect(surface.locator('.au-btn').first()).toHaveCSS('font-family', portal)
    expect(await surface.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath(`portal-${native ? 'service' : 'source'}-${width}.png`) })
    expect(audit).toEqual({ mutations: [], external: [], errors: [] })
  })
}
