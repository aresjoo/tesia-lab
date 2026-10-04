import { expect, test, type Locator, type Page } from '@playwright/test'
import { sourceSidebarNavigationLabel } from '../../src/client-shell-copy'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'

// Source 9fbff821: AI 9 / examples 2 / steps 3 / safety 4 and shared footer.
// Mount the service entry, not Main's preview renderer. Only session/CSRF GET
// responses are synthetic; no OAuth, provider, strategy execution or order runs.
// Service researchOnly disclosures are intentionally not replaced by the
// source preview's claims about available automated trading or actual returns.
test.setTimeout(60_000)

async function mount(page: Page, baseURL: string | undefined, path: string) {
  if (!baseURL) throw new Error('A local Playwright baseURL is required')
  const origin = new URL(baseURL).origin
  const mutations: string[] = [], errors: string[] = []
  let authenticated = false
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    localStorage.setItem('tethCurrency', 'USD')
  })
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
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"source_parity_anonymous_001"' } : {},
        body: JSON.stringify({ meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null,
          requestId: 'req_source_parity_0001', traceId: 'trace_source_parity_0001' }, data: session
          ? { sessionId: 'session_source_parity_0001', state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_source_parity_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
    }
    if (request.isNavigationRequest() && url.pathname === '/') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
        <div id="internal-poc-root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    }
    return route.continue()
  })
  await page.goto(path)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.evaluate(() => document.fonts.ready)
  return { mutations, errors, setSessionAuthenticated: (value: boolean) => { authenticated = value } }
}

async function hittable(locator: Locator) {
  await expect(locator).toBeVisible()
  await expect(locator).toBeInViewport()
  await expect.poll(() => locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return Boolean(hit && (hit === element || element.contains(hit)))
  })).toBe(true)
}

// Real wheel scrolling catches clipped/overflow:hidden parents that a forced
// scrollTop or scrollIntoView would conceal. Never mutate presentation to pass.
async function wheelTo(page: Page, target: Locator) {
  const size = page.viewportSize()!
  await page.mouse.move(size.width * 0.7, size.height * 0.72)
  await expect.poll(async () => {
    const visible = await target.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const clip = document.elementFromPoint(rect.x + rect.width / 2, Math.max(1, Math.min(innerHeight - 1, rect.y + rect.height / 2)))
      return rect.top >= 0 && rect.bottom <= innerHeight && Boolean(clip && (clip === element || element.contains(clip)))
    })
    if (!visible) {
      const box = await target.boundingBox()
      await page.mouse.wheel(0, box && box.y < 0 ? -350 : 350)
    }
    return visible
  }, { timeout: 20_000, intervals: [100, 150, 200] }).toBe(true)
  await expect(target).toBeInViewport()
}

for (const width of [390, 768, 1440]) {
  test(`${width}px service trading direct hash keeps all lower sections and reachable footer`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const evidence = await mount(page, baseURL, '/#/trade')
    const intro = page.locator('.txh')
    await expect(intro).toBeVisible()
    await expect(page.locator('.native-auth-surface')).toHaveCount(0)
    await expect(page.locator('.client-account-terminal')).toHaveCount(0)
    await expect(intro.locator('.txh-ai-cols li')).toHaveCount(9)
    await expect(intro.locator('.txh-ai-col h3')).toHaveText(['뉴스 확인', '시장 분석', '판단 정리'])
    await expect(intro.locator('.txh-card')).toHaveCount(2)
    await expect(intro.locator('.txh-step')).toHaveCount(3)
    await expect(intro.locator('.txh-step b')).toHaveText(['대화로 정하기', '과거 시장에서 확인', '거래소 연결'])
    await expect(intro.locator('.txh-safe li')).toHaveCount(4)
    await expect(intro.locator('.txh-safe li b')).toHaveText(['연결 권한', '전략 예산', '손실 한도', '거래 중지'])
    await expect(intro.locator('.txh-sub')).toContainText('자동 실행은 준비 중')
    await expect(intro.locator('.txh-example-note')).toContainText('실제 자산, 수익률, 거래 기록이 아닙니다')
    await expect(intro.locator('.txh-now')).toContainText('가정 수익률')
    await expect(intro.locator('video')).toHaveCount(0)
    await hittable(page.locator('.client-auth-nav .client-login'))
    await hittable(page.locator('.client-auth-nav .client-signup'))
    await page.screenshot({ path: info.outputPath(`native-trading-${width}-top.png`) })

    for (const selector of ['.txh-ai-col h3', '.txh-example-note', '.txh-step b', '.txh-safe h2']) {
      await wheelTo(page, intro.locator(selector).first())
    }
    const bottomStart = intro.locator('.txh-safe .txh-cta')
    await wheelTo(page, bottomStart)
    await hittable(bottomStart)
    await bottomStart.click()
    await expect(page.locator('.native-auth-surface')).toBeVisible()
    await page.locator('.native-auth-surface .au-x').click()
    await expect(page.locator('.native-auth-surface')).toHaveCount(0)
    await expect(page).toHaveURL(/#\/trade$/)
    await expect(intro.locator('.txh-ai-cols li')).toHaveCount(9)

    const footer = page.locator('.client-site-footer')
    await expect(footer).toHaveCount(1)
    await wheelTo(page, footer.locator('.gft-wm'))
    await expect(footer.locator('.gft-wm')).toBeInViewport()
    await page.screenshot({ path: info.outputPath(`native-trading-${width}-footer.png`) })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(evidence.mutations).toEqual([])
    expect(evidence.errors).toEqual([])
  })

  test(`${width}px service sidebar entry, both top account actions and reload retain trading context`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 })
    const evidence = await mount(page, baseURL, '/')
    const trading = page.locator('.client-sidebar').getByRole('button', { name: sourceSidebarNavigationLabel('ko', 'trading'), exact: true })
    if (!await trading.isVisible()) {
      await revealSourceNavigation(page)
      await page.locator('.client-hamburger').click()
    }
    await trading.click()
    await expect(page.locator('.txh')).toBeVisible()
    await expect(page).toHaveURL(/#\/trade$/)
    for (const selector of ['.client-login', '.client-signup']) {
      const action = page.locator(`.client-auth-nav ${selector}`)
      await hittable(action)
      const rect = await action.boundingBox()
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width)
      expect(rect!.y).toBeLessThan(160)
      await action.click()
      await expect(page.locator('.native-auth-surface')).toBeVisible()
      await page.locator('.native-auth-surface .au-x').click()
      await expect(page.locator('.native-auth-surface')).toHaveCount(0)
      await expect(page.locator('.txh')).toBeVisible()
      await expect(page).toHaveURL(/#\/trade$/)
      await hittable(action)
    }
    await page.reload()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.locator('.txh-ai-cols li')).toHaveCount(9)
    await hittable(page.locator('.client-auth-nav .client-login'))
    await hittable(page.locator('.client-auth-nav .client-signup'))
    expect(evidence.mutations).toEqual([])
    expect(evidence.errors).toEqual([])
  })

  test(`${width}px authenticated fixture reload removes guest scroll/footer/auth styles without inventing account data`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 })
    const evidence = await mount(page, baseURL, '/#/trade')
    await expect(page.locator('.txh')).toBeVisible()
    await expect(page.locator('.client-site-footer')).toHaveCount(1)
    // Explicit fixture replacement, not a claim of successful real OAuth.
    evidence.setSessionAuthenticated(true)
    await page.reload()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.locator('.native-trading-workspace')).toBeVisible()
    await expect(page.locator('.native-trading-workspace')).toHaveAttribute('data-account-identity', '')
    await expect(page.locator('.txh, .client-auth-nav, .client-site-footer')).toHaveCount(0)
    await expect(page.locator('.client-service-app')).not.toHaveClass(/has-trading-intro|has-site-footer/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    evidence.setSessionAuthenticated(false)
    await page.reload()
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await expect(page.locator('.native-trading-workspace')).toHaveCount(0)
    await expect(page.locator('.txh')).toBeVisible()
    await expect(page.locator('.client-site-footer')).toHaveCount(1)
    await hittable(page.locator('.client-auth-nav .client-login'))
    expect(evidence.mutations).toEqual([])
    expect(evidence.errors).toEqual([])
  })
}
