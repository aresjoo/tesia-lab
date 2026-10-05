import { expect, test, type Locator, type Page } from '@playwright/test'

// Service renderer only. Session/CSRF are explicit fixtures; all business
// mutations and external requests are blocked. This does not test real OAuth.
test.setTimeout(60_000)
test.use({ serviceWorkers: 'block' })
async function mount(page: Page, baseURL: string | undefined, path: string) {
  if (!baseURL) throw new Error('Local baseURL required')
  const origin = new URL(baseURL).origin, mutations: string[] = [], errors: string[] = [], external: string[] = [], unexpectedApi: string[] = [], blocked: string[] = [], fixtures: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); localStorage.setItem('tethCurrency', 'USD') })
  await page.context().route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    const label = `${request.method()} ${url.origin}${url.pathname}`
    const foreign = url.origin !== origin, mutation = !['GET', 'HEAD'].includes(request.method())
    if (foreign) external.push(label)
    if (mutation) mutations.push(label)
    if (foreign || mutation) { blocked.push(label); return route.abort('blockedbyclient') }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      if (request.method() !== 'GET' || url.search || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) {
        unexpectedApi.push(label); blocked.push(label); return route.abort('blockedbyclient')
      }
      fixtures.push(`${request.method()} ${url.pathname}`)
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"source_parity_anonymous_001"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_source_parity_0001', traceId: 'trace_source_parity_0001' },
        data: session ? { sessionId: 'session_source_parity_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_source_parity_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    return route.fallback()
  })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin || request.method() !== 'GET' || !request.isNavigationRequest() || url.pathname !== '/') return route.fallback()
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
  })
  await page.goto(path)
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.evaluate(() => document.fonts.ready)
  return { mutations, errors, external, unexpectedApi, blocked, fixtures }
}

async function wheelTo(page: Page, target: Locator) {
  const viewport = page.viewportSize()!
  await page.mouse.move(viewport.width * .7, viewport.height * .72)
  await expect.poll(async () => {
    const box = await target.boundingBox()
    if (!box) return false
    if (box.y >= 120 && box.y + box.height <= viewport.height - 10) return true
    await page.mouse.wheel(0, box.y < 120 ? -280 : 280)
    return false
  }, { timeout: 20_000, intervals: [100, 150, 200] }).toBe(true)
}

async function hit(locator: Locator) {
  await expect(locator).toBeInViewport()
  await expect.poll(() => locator.evaluate(element => {
    const box = element.getBoundingClientRect(), current = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    return Boolean(current && (element === current || element.contains(current)))
  })).toBe(true)
}

async function settledScroll(shell: Locator) {
  let previous = -1, stable = 0
  await expect.poll(async () => {
    const current = await shell.evaluate(element => element.scrollTop)
    stable = current === previous ? stable + 1 : 0
    previous = current
    return stable
  }, { intervals: [100], timeout: 5000 }).toBeGreaterThanOrEqual(3)
  return previous
}

for (const width of [390, 860, 861, 1440]) {
  test(`${width}px footer round trip resets shared scroll to the destination hero`, async ({ page, baseURL }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const evidence = await mount(page, baseURL, '/')
    const shell = page.locator('.client-service-app')
    const footer = page.locator('.client-site-footer')
    await wheelTo(page, footer.getByRole('button', { name: 'AI 트레이딩', exact: true }))
    expect(await shell.evaluate(element => element.scrollTop)).toBeGreaterThan(100)
    await footer.getByRole('button', { name: 'AI 트레이딩', exact: true }).click()
    await expect(page).toHaveURL(/#\/trade$/)
    await expect(page.locator('.txh-hero h1')).toBeInViewport()
    await expect.poll(() => shell.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(1)
    await hit(page.locator('.client-auth-nav .client-login'))
    await wheelTo(page, footer.getByRole('button', { name: '새 전략 만들기', exact: true }))
    expect(await shell.evaluate(element => element.scrollTop)).toBeGreaterThan(100)
    await footer.getByRole('button', { name: '새 전략 만들기', exact: true }).click()
    await expect(page.locator('.txh')).toHaveCount(0)
    await expect(page.locator('.landing-hero h1')).toBeInViewport()
    await expect.poll(() => shell.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: info.outputPath(`footer-round-trip-${width}.png`) })
    expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
    await info.attach('http-guard', { body: JSON.stringify(evidence), contentType: 'application/json' })
    expect(evidence.external).toEqual([]); expect(evidence.unexpectedApi).toEqual([]); expect(evidence.blocked).toEqual([])
  })

  test(`${width}px lower signup cancellation restores trigger focus and mid-scroll header controls stay usable`, async ({ page, baseURL }, info) => {
    // Historical title/key retained for failure binding. Desktop auth is
    // page-owned: original mid-scroll absence and natural hero return stay exact.
    await page.setViewportSize({ width, height: 900 })
    const evidence = await mount(page, baseURL, '/#/trade')
    const shell = page.locator('.client-service-app')
    await wheelTo(page, page.locator('.txh-ai-col h3').first())
    if (width >= 861) {
      // 원본 9fbff821의 desktop 인증 행은 page-owned absolute입니다.
      // 실제 wheel 원본/서비스 대조에서도 본문과 함께 화면 밖으로 이동합니다.
      await expect(page.locator('.client-auth-nav .client-login')).not.toBeInViewport()
      await expect(page.locator('.client-auth-nav .client-signup')).not.toBeInViewport()
      await info.attach('source-page-owned-auth', { contentType: 'application/json', body: JSON.stringify({
        source: 'synthetic-session-real-service-renderer', shellScroll: await shell.evaluate(element => element.scrollTop),
        login: await page.locator('.client-login').boundingBox(), signup: await page.locator('.client-signup').boundingBox(),
      }) })
      await wheelTo(page, page.locator('.txh-hero h1'))
    }
    await hit(page.locator('.client-auth-nav .client-login'))
    await hit(page.locator('.client-auth-nav .client-signup'))
    const login = await page.locator('.client-login').boundingBox(), signup = await page.locator('.client-signup').boundingBox()
    expect(login!.x + login!.width).toBeLessThanOrEqual(signup!.x + 1)
    await page.screenshot({ path: info.outputPath(`mid-scroll-auth-${width}.png`) })
    const trigger = page.locator('.txh-safe .txh-cta')
    await wheelTo(page, trigger)
    for (const close of ['escape', 'button']) {
      await trigger.click({ trial: true })
      await hit(trigger)
      const scroll = await settledScroll(shell)
      const before = await trigger.boundingBox()
      await trigger.click()
      await expect(page.locator('.native-auth-surface')).toBeVisible()
      const during = await shell.evaluate(element => ({ scroll: element.scrollTop, height: element.scrollHeight, width: element.clientWidth }))
      if (close === 'escape') await page.keyboard.press('Escape')
      else await page.locator('.native-auth-surface .au-x').click()
      await expect(page.locator('.native-auth-surface')).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await hit(trigger)
      const after = await settledScroll(shell)
      await info.attach(`${close}-scroll-geometry`, { contentType: 'application/json', body: JSON.stringify({ scroll, before, during, after, triggerAfter: await trigger.boundingBox() }) })
      expect(Math.abs(after - scroll), JSON.stringify({ close, scroll, before, during, after, triggerAfter: await trigger.boundingBox() })).toBeLessThanOrEqual(2)
      await expect(page).toHaveURL(/#\/trade$/)
    }
    expect(evidence.mutations).toEqual([]); expect(evidence.errors).toEqual([])
    await info.attach('http-guard', { body: JSON.stringify(evidence), contentType: 'application/json' })
    expect(evidence.external).toEqual([]); expect(evidence.unexpectedApi).toEqual([]); expect(evidence.blocked).toEqual([])
  })
}
