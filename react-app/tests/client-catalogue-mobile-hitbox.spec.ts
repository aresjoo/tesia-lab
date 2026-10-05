import { expect, test, type Page } from '@playwright/test'

type Host = 'mock' | 'native'
test.setTimeout(45_000)

async function setup(page: Page, host: Host, locale: 'ko' | 'fr') {
  const origin = `http://127.0.0.1:${process.env.TETH_E2E_PORT ?? 4175}`
  const audit = { errors: [] as string[], external: [] as string[], mutations: [] as string[], unexpectedAPI: [] as string[] }
  page.on('pageerror', error => audit.errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(language => {
    localStorage.setItem('tethLang', language)
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
  }, locale)
  await page.context().route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      if (host !== 'native' || request.method() !== 'GET' || !!url.search || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) { audit.unexpectedAPI.push(`${request.method()} ${url.pathname}${url.search}`); return route.abort('blockedbyclient') }
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_mobile_geometry_01"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_mobile_geometry_0001', traceId: 'trace_catalogue_mobile_geometry_0001' },
        data: session ? { sessionId: 'session_catalogue_mobile_geometry_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_catalogue_mobile_geometry_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (host === 'native' && request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    return route.continue()
  })
  return audit
}

async function barrier(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
}

async function sidebar(page: Page, index: number) {
  const sidebar = page.locator('.client-sidebar')
  if (!await sidebar.evaluate(n => n.classList.contains('mobile-open'))) {
    // Filling the low home composer can legitimately scroll its short page
    // and hide the header. A user scrolls up to reveal it, not a forced click.
    await page.mouse.move(page.viewportSize()!.width / 2, 100)
    await page.mouse.wheel(0, -10_000)
    await expect(page.locator('.client-hamburger')).not.toHaveClass(/client-hamburger-scroll-hidden/)
    await page.locator('.client-hamburger').click()
  }
  // Guest exploration actions are direct children, not the signed-in
  // research/history navigation, which intentionally does not mount.
  await sidebar.locator(':scope > .client-util').nth(index).click()
}

async function geometry(page: Page) {
  await barrier(page)
  return page.evaluate(() => {
    const box = (n: Element) => {
      const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, full: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        hit: !!hit && (n === hit || n.contains(hit)) }
    }
    const breadcrumb = document.querySelector('.client-shared-detail > .tfbk-bc button'), burger = document.querySelector('.client-hamburger')!
    const b = breadcrumb ? box(breadcrumb) : null, h = box(burger)
    const overlap = b ? Math.max(0, Math.min(b.right, h.right) - Math.max(b.x, h.x)) * Math.max(0, Math.min(b.bottom, h.bottom) - Math.max(b.y, h.y)) : 0
    const header = document.querySelector('.client-sharing-hub > .hub-header'), back = header?.querySelector('button')
    const auth = [...document.querySelectorAll('.client-auth-nav button')].map(box)
    return { burger: h, breadcrumb: b, overlap, auth, back: back ? box(back) : null, headerClip: header ? getComputedStyle(header).clipPath : null, overflow: document.documentElement.scrollWidth - innerWidth }
  })
}

for (const host of ['mock', 'native'] as const) for (const width of [320, 844]) for (const height of [360, 900]) for (const locale of ['ko', 'fr'] as const) {
  test(`${host} ${locale} ${width}x${height}: catalogue breadcrumb hitbox stays clear of menu and preserves keyboard/drawer routes`, async ({ page }, info) => {
    await page.setViewportSize({ width, height })
    const audit = await setup(page, host, locale)
    await page.goto('/')
    if (host === 'native') await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    const draft = '보존할 미전송 원문 ✨'
    await page.locator('#strategy-idea').fill(draft)
    await sidebar(page, 0); await expect(page.locator('.txh')).toBeVisible()
    const intro = await geometry(page)
    expect(intro.burger).toMatchObject({ full: true, hit: true })
    expect(intro.auth).toHaveLength(2); expect(intro.auth.every(n => n.full && n.hit)).toBe(true)
    await sidebar(page, 1); await expect(page.locator('.strategy-list-card').first()).toBeVisible()
    const back = page.locator('.client-sharing-hub > .hub-header button')
    await back.focus(); await expect(back).toBeFocused()
    const listFocused = await geometry(page)
    expect(listFocused.back).toMatchObject({ full: true, hit: true })
    expect(listFocused.back!.y).toBeGreaterThanOrEqual(60)
    expect(listFocused.auth.every(n => n.full && n.hit)).toBe(true)
    await back.press('Tab')
    await page.locator('.strategy-list-card').first().getByRole('link').click()
    await expect(page.locator('.client-shared-detail')).toBeVisible()
    const detail = await geometry(page)
    await info.attach('detail-hitbox', { body: JSON.stringify(detail), contentType: 'application/json' })
    await page.screenshot({ path: info.outputPath('detail-hitbox.png') })
    expect(detail.breadcrumb).toMatchObject({ full: true, hit: true })
    expect(detail.breadcrumb!.height).toBeGreaterThanOrEqual(44)
    expect(detail.burger.width).toBeGreaterThanOrEqual(44)
    expect(detail.burger.height).toBeGreaterThanOrEqual(44)
    expect(detail.overlap, 'The breadcrumb must not dispatch its top edge to the menu button').toBe(0)
    expect(detail.auth.every(n => n.full && n.hit)).toBe(true)
    expect(detail.overflow).toBeLessThanOrEqual(1)
    // Actual nonforce pointer at the breadcrumb's top-left inner edge. The
    // former 6px collision opened the drawer instead of returning to the list.
    const breadcrumb = page.locator('.client-shared-detail > .tfbk-bc button')
    await breadcrumb.click({ position: { x: 2, y: 2 } })
    await expect(page.locator('.strategy-filters[data-catalogue-list]')).toBeVisible()
    await expect(page.locator('.client-sidebar.mobile-open')).toHaveCount(0)
    await page.locator('.client-hamburger').click()
    const login = page.locator('.client-sidebar-bottom [data-sidebar-action="account"]')
    await login.click()
    await expect(page.locator(host === 'native' ? '.native-auth-surface[open]' : '.ca-auth')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator(host === 'native' ? '.native-auth-surface[open]' : '.ca-auth')).toHaveCount(0)
    await page.locator('.client-hamburger').click()
    const settings = page.locator('.client-sidebar-bottom [data-sidebar-action="settings"]')
    await settings.focus(); await expect(settings).toBeFocused(); await settings.press('Enter')
    await expect(page.locator('.ca-menu-layer[data-surface-active="true"] .ca-settings')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.ca-menu-layer[data-surface-active="true"]')).toHaveCount(0)
    await expect(page.locator('.client-sidebar.mobile-open')).toHaveCount(0)
    await page.locator('.client-hamburger').click()
    await page.locator('.client-drawer-brand button').last().click()
    await expect(page.locator('.client-sidebar.mobile-open')).toHaveCount(0)
    const homeReturn = page.locator('.client-sharing-hub > .hub-header button')
    await homeReturn.focus(); await expect(homeReturn).toBeFocused(); await barrier(page); await homeReturn.press('Enter')
    await expect(page.locator('#strategy-idea')).toHaveValue(draft)
    await info.attach('network-audit', { body: JSON.stringify(audit), contentType: 'application/json' })
    expect(audit).toEqual({ errors: [], external: [], mutations: [], unexpectedAPI: [] })
  })
}

test.use({ serviceWorkers: 'block' })
