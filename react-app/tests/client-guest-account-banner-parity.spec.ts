import { expect, test } from '@playwright/test'

// Actual service-main consumes a declared anonymous SDK fixture. Hash navigation
// does not inject a profile, presentation producer, React state or auth authority.
test.use({ serviceWorkers: 'block' })

for (const fragment of ['#/plan', '#/trade/bot/probe1', '#/review/probe1', '#/periodic/probe1']) {
  test(`Native fresh account ${fragment} 320px: 표시 중인 앱 배너 아래 인증 진입을 보존한다`, async ({ page, baseURL }, info) => {
    if (!baseURL) throw new Error('Local test origin required')
    const origin = new URL(baseURL).origin
    const audit = { external: [] as string[], mutations: [] as string[], unexpectedApi: [] as string[], fixtures: [] as string[] }
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.context().route('**/*', async route => {
      const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
      const foreign = url.origin !== origin, mutation = !['GET', 'HEAD'].includes(method), api = path === '/api' || path.startsWith('/api/')
      const fixture = !foreign && method === 'GET' && !url.search && ['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)
      if (foreign) audit.external.push(`${method} ${url.origin}${path}`)
      if (mutation) audit.mutations.push(`${method} ${path}`)
      if (api && !fixture) audit.unexpectedApi.push(`${method} ${path}`)
      if (foreign || mutation || api && !fixture) return route.abort('blockedbyclient')
      if (fixture) {
        const session = path.endsWith('/session')
        audit.fixtures.push(path)
        return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store', ...(session ? { ETag: '"etag_account_scope_fixture_0007"' } : {}) },
          body: JSON.stringify({ meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '7' : null, requestId: 'req_account_scope_fixture_0001', traceId: 'trace_account_scope_fixture_0001' },
            data: session ? { sessionId: 'session_account_scope_fixture_0001', state: 'ANONYMOUS', revision: '7', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
              : { csrfToken: ['csrf', 'account', 'scope', 'fixture', '0001'].join('_'), expiresAt: '2030-01-01T12:00:00Z' } }) })
      }
      if (request.isNavigationRequest() && path === '/guest-account-banner-native.html') {
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/src/internal-poc/service-main.tsx");</script></body></html>' })
      }
      return route.fallback()
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 900 })
    await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
    await page.clock.setFixedTime(new Date('2030-01-01T00:00:30Z'))
    try {
      await page.goto('/guest-account-banner-native.html')
      const shell = page.locator('.client-service-app'), banner = page.locator('.client-app-banner')
      await expect(shell).toHaveAttribute('data-service-phase', 'ready')
      expect(await page.evaluate(() => sessionStorage.getItem('teth-app-banner-dismissed'))).toBeNull()
      await expect(banner).toBeVisible()
      await page.evaluate(hash => { location.hash = hash }, fragment)
      await expect(page.locator('.native-service-plan')).toBeVisible()
      await expect(shell).toHaveAttribute('data-service-phase', 'ready')
      await expect(shell).toHaveClass(/\bview-landing\b/)
      await expect(banner).toBeVisible()
      expect(page.url()).toBe(origin + '/guest-account-banner-native.html' + fragment)
      await page.evaluate(async () => {
        await document.fonts.ready
        for (let frame = 0; frame < 3; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      })
      const geometry = await page.evaluate(() => {
        const measure = (node: Element) => {
          const box = node.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          return { visible: node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }), x: box.x, y: box.y, right: box.right, bottom: box.bottom, hit: hit === node || !!hit && node.contains(hit) }
        }
        const auth = [...document.querySelectorAll('.client-auth-nav .client-login,.client-auth-nav .client-signup')].map(measure)
        const targets = [...document.querySelectorAll('.native-service-plan :is(h1,h2,.nfx-bc),.native-plan-return button,.native-service-plan .nfx-cta button')].filter(node => node.checkVisibility()).map(measure)
        const collisions = auth.filter(a => a.visible).flatMap(a => targets.filter(b => Math.min(a.right, b.right) > Math.max(a.x, b.x) && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y)).map(b => [a, b]))
        return { auth, collisions, globe: [...document.querySelectorAll('.client-globe')].map(measure), overflow: document.documentElement.scrollWidth - innerWidth }
      })
      await info.attach('native-account-banner-geometry', { body: JSON.stringify(geometry), contentType: 'application/json' })
      await page.screenshot({ path: info.outputPath('native-account-banner.png') })
      expect.soft(geometry.auth.map(control => control.visible), '기존 로그인·무료 시작 모두 표시').toEqual([true, true])
      expect.soft(geometry.auth.map(control => control.hit), '표시 중인 배너가 인증 버튼 중앙을 가리지 않는다').toEqual([true, true])
      expect.soft(geometry.collisions, '계정 제목·복귀 도구와 인증 조작부가 겹치지 않는다').toEqual([])
      expect.soft(geometry.globe.map(control => control.visible), '기존 mobile 언어 숨김 정책').toEqual([false])
      expect.soft(geometry.overflow).toBeLessThanOrEqual(1)
      expect(page.url()).toBe(origin + '/guest-account-banner-native.html' + fragment)
    } finally {
      await info.attach('native-account-banner-network', { body: JSON.stringify({ ...audit, errors }), contentType: 'application/json' })
      expect(audit.external).toEqual([])
      expect(audit.mutations).toEqual([])
      expect(audit.unexpectedApi).toEqual([])
      expect(errors).toEqual([])
      expect(new Set(audit.fixtures)).toEqual(new Set(['/api/v1/auth/session', '/api/v1/auth/csrf']))
      expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true)
    }
  })
}
