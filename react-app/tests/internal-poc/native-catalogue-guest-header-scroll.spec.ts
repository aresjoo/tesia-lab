import { expect, test, type Page } from '@playwright/test'

async function frameBarrier(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))))
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.native-strategies > .hub-header')!
    const box = (n: Element) => {
      const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom,
        full: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
        hit: !!hit && (hit === n || n.contains(hit)) }
    }
    return { header: box(header), clip: getComputedStyle(header).clipPath,
      back: box(header.querySelector('button')!), breadcrumb: box(document.querySelector('.client-shared-detail > .tfbk-bc button')!),
      auth: [...document.querySelectorAll('.client-auth-nav button')].map(box),
      topIsHeader: document.elementFromPoint(innerWidth / 2, 10)?.closest('.hub-header') === header,
      scrollTop: document.querySelector('.tesia-shell')!.scrollTop, overflow: document.documentElement.scrollWidth - innerWidth }
  })
}

for (const width of [320, 844, 861, 1440]) test(`native guest ${width}px: normal wheel preserves catalogue header and auth flow`, async ({ page }, info) => {
  const errors: string[] = [], external: string[] = [], mutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width, height: 900 })
  const origin = `http://127.0.0.1:${process.env.TETH_E2E_PORT ?? 4175}`
  // Actual service renderer, anonymous protocol fixtures only. No external
  // provider request, authentication completion, market/result producer or mutation.
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { external.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (!['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) return route.abort('blockedbyclient')
    const session = url.pathname.endsWith('/session')
    return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_scroll_001"' } : {}, body: JSON.stringify({
      meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_scroll_0001', traceId: 'trace_catalogue_scroll_0001' },
      data: session ? { sessionId: 'session_catalogue_scroll_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_catalogue_scroll_0001', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
  })
  await page.goto('/#/share')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.locator('[data-public-catalogue] .strategy-list-link').first().click()
  await expect(page.locator('.client-shared-detail')).toBeVisible()
  await frameBarrier(page)
  const initial = await geometry(page)
  await info.attach('initial-geometry', { body: JSON.stringify(initial), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('native-header-initial.png') })
  expect(initial.header.y).toBe(60)
  expect(initial.header.height).toBe(64)
  expect(initial.clip).toBe('none')
  expect(initial.breadcrumb.y).toBeGreaterThanOrEqual(initial.header.bottom)
  expect(initial.breadcrumb).toMatchObject({ full: true, hit: true })
  expect(initial.back).toMatchObject({ full: true, hit: true })
  expect(initial.auth).toHaveLength(2)
  expect(initial.auth.every(n => n.full && n.hit)).toBe(true)
  expect(initial.overflow).toBeLessThanOrEqual(1)
  // Open/cancel each genuine native auth surface; no provider selection.
  for (const selector of ['.client-login', '.client-signup']) {
    const button = page.locator(`.client-auth-nav ${selector}`), href = page.url()
    await button.focus(); await expect(button).toBeFocused(); await button.press('Enter')
    await expect(page.getByRole('region', { name: '실제 계정 로그인', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.native-auth-surface[open]')).toHaveCount(0)
    await expect(button).toBeFocused()
    expect(page.url()).toBe(href)
  }
  await page.mouse.move(width / 2, 450)
  await page.mouse.wheel(0, 280)
  await expect.poll(async () => (await geometry(page)).scrollTop).toBe(280)
  await frameBarrier(page)
  const scrolled = await geometry(page)
  await info.attach('normal-wheel-geometry', { body: JSON.stringify(scrolled), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('native-header-wheel280.png') })
  expect(scrolled.header.y).toBe(width >= 861 ? 0 : 60)
  expect(scrolled.header.height).toBe(64)
  expect(scrolled.clip).toBe('none')
  expect(scrolled.back).toMatchObject({ full: true, hit: true })
  expect(scrolled.overflow).toBeLessThanOrEqual(1)
  if (width >= 861) {
    expect(scrolled.topIsHeader, 'No detail/CTA fragment may peek above the desktop sticky header').toBe(true)
    expect(scrolled.auth.every(n => n.bottom < 0)).toBe(true)
  } else {
    expect(scrolled.auth.every(n => n.full && n.hit)).toBe(true)
  }
  const back = page.locator('.native-strategies > .hub-header button')
  await back.focus(); await expect(back).toBeFocused(); await frameBarrier(page)
  expect((await geometry(page)).back).toMatchObject({ full: true, hit: true })
  await back.press('Enter')
  await expect(page.locator('.client-sharing-hub')).toHaveCount(0)
  await expect(page.locator('.landing-hero h1')).toBeVisible()
  await expect(page.locator('.client-auth-nav .client-login')).toBeVisible()
  await expect(page.locator('.client-auth-nav .client-signup')).toBeVisible()
  await info.attach('network-and-window-errors', { body: JSON.stringify({ external, mutations, errors }), contentType: 'application/json' })
  expect(external).toEqual([]); expect(mutations).toEqual([]); expect(errors).toEqual([])
})
