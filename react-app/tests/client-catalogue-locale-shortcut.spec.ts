import { expect, test, type Page, type TestInfo } from '@playwright/test'

// Original 9fb final normal guest catalogue: desktop globe opens the retained
// seven-language panel (639, 5138, 26335); <=860 hides it (674), authenticated
// owners hide it (26863), and the final currency column/tabs stay hidden (6716).
// Private paired original observations are evidence, not a live test dependency.
const languages = [
  ['ko', '한국어'], ['en', 'English'], ['ja', '日本語'], ['zh-CN', '简体中文'],
  ['zh-TW', '繁體中文'], ['es', 'Español'], ['fr', 'Français'],
] as const
const draft = '언어 패널 왕복 뒤에도 남길 미전송 원문 ✨'
type Host = 'mock' | 'native'
test.setTimeout(45_000)

async function setup(page: Page, host: Host, authenticated = false) {
  const origin = `http://127.0.0.1:${process.env.TETH_E2E_PORT ?? 4175}`
  const audit = { errors: [] as string[], external: [] as string[], mutations: [] as string[], unexpectedAPI: [] as string[] }
  page.on('pageerror', error => audit.errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ host, authenticated }) => {
    localStorage.setItem('tethLang', 'ko')
    sessionStorage.setItem('teth-app-banner-dismissed', '1')
    if (host === 'mock' && authenticated) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: '언어 시험 계정', email: 'catalogue-locale@example.test' }))
  }, { host, authenticated })
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(`${request.method()} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (host === 'native' && request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    if (url.pathname.startsWith('/api/')) {
      if (host !== 'native' || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) { audit.unexpectedAPI.push(url.pathname); return route.abort('blockedbyclient') }
      const session = url.pathname.endsWith('/session')
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"catalogue_locale_shortcut_01"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_catalogue_locale_0001', traceId: 'trace_catalogue_locale_0001' },
        data: session ? { sessionId: authenticated ? 'session_catalogue_locale_auth_0001' : 'session_catalogue_locale_anon_0001', state: authenticated ? 'AUTHENTICATED' : 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_catalogue_locale_0001', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    return route.continue()
  })
  return audit
}

async function sidebar(page: Page, name: string) {
  const target = page.locator('.client-sidebar').getByRole('button', { name, exact: true })
  if (!await target.isVisible()) await page.locator(page.viewportSize()!.width <= 860 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  await target.click()
}

async function ready(page: Page, host: Host) {
  if (host === 'native') await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
}

async function geometry(page: Page, info: TestInfo) {
  const observed = await page.locator('.client-globe').evaluate(async n => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const r = n.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    const controls = [...document.querySelectorAll<HTMLElement>('.client-auth-nav :is(a,button),.client-sharing-hub>.hub-header button,.strategy-filters :is(button,select,input),.catalogue-source-header button,.client-shared-detail>.tfbk-bc button')]
      .filter(c => c.checkVisibility() && c.getBoundingClientRect().width > 1 && (!c.closest('.hub-header') || c.closest('.hub-header')!.getBoundingClientRect().width > 1))
    return { rect: r.toJSON(), hit: !!hit && (hit === n || n.contains(hit)), full: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      collisions: controls.filter(c => { const b = c.getBoundingClientRect(); return Math.min(b.right, r.right) > Math.max(b.x, r.x) && Math.min(b.bottom, r.bottom) > Math.max(b.y, r.y) }).map(c => c.textContent),
      overflow: document.documentElement.scrollWidth - innerWidth }
  })
  await info.attach('catalogue-globe-geometry', { body: JSON.stringify(observed), contentType: 'application/json' })
  expect(observed).toMatchObject({ full: true, hit: true, collisions: [] })
  expect(observed.rect.width).toBeGreaterThanOrEqual(44)
  expect(observed.rect.height).toBeGreaterThanOrEqual(44)
  expect(observed.overflow).toBeLessThanOrEqual(1)
}

for (const host of ['mock', 'native'] as const) for (const width of [320, 844, 861, 1440]) for (const surface of ['list', 'detail'] as const) {
  test(`${host} guest ${width}px ${surface}: 원본 언어 진입점·경로·미전송 초안을 보존한다`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const audit = await setup(page, host)
    await page.goto('/'); await ready(page, host)
    await page.locator('#strategy-idea').fill(draft)
    await sidebar(page, 'AI 트레이딩'); await expect(page.locator('.txh')).toBeVisible()
    await sidebar(page, '전략 복사'); await expect(page.locator('.strategy-list-card').first()).toBeVisible()
    if (surface === 'detail') {
      await page.locator('.strategy-list-card').first().getByRole('link').click()
      await expect(page.locator(host === 'native' ? '[data-public-catalogue] .client-shared-detail' : '.catalogue-source-header')).toBeVisible()
    }
    const href = page.url(), globe = page.locator('.client-globe')
    await expect(globe).toHaveCount(1)
    if (width <= 860) {
      await expect(globe).toBeHidden()
      await expect(globe).toHaveCSS('display', 'none')
      await expect(page.locator('.client-preferences-layer')).toHaveCount(0)
    } else {
      await expect(globe).toBeVisible(); await geometry(page, info)
      for (const dismissal of ['keyboard', 'outside'] as const) {
        if (dismissal === 'keyboard') { await globe.focus(); await expect(globe).toBeFocused(); await globe.press('Enter') } else await globe.click()
        const panel = page.locator('.client-locale-panel')
        await expect(panel).toBeVisible(); await expect(panel).toBeFocused()
        await expect(panel.locator('li button > span:first-child')).toHaveText(languages.map(([, label]) => label))
        await expect(page.locator('#locale-currency,#locale-tab-currency')).toHaveCount(0)
        expect(await panel.evaluate(n => { const r = n.getBoundingClientRect(); return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight })).toBe(true)
        if (dismissal === 'keyboard') await page.keyboard.press('Escape')
        else await page.locator('.client-preferences-layer').click({ position: { x: 72, y: 250 } })
        await expect(panel).toHaveCount(0)
        if (dismissal === 'keyboard') await expect(globe).toBeFocused()
        else {
          // Actual final original, existing Mock/Native home, and catalogue
          // all leave normal backdrop pointer dismissal at non-inert BODY.
          // Do not manufacture a new focus policy in the unchanged modal.
          expect(await page.evaluate(() => ({ bodyFocused: document.activeElement === document.body, inert: !!document.activeElement?.closest('[inert]') }))).toEqual({ bodyFocused: true, inert: false })
        }
        expect(page.url()).toBe(href)
      }
      // Literal seven-language choices, not expectations derived from the
      // implementation's translation/preference functions.
      for (const [language, label] of languages) {
        await globe.click()
        await page.locator('.client-locale-panel').getByRole('button', { name: label, exact: true }).click()
        await expect(page.locator('html')).toHaveAttribute('lang', language)
        await expect(page.locator('.client-locale-panel')).toHaveCount(0)
        await expect(globe).toBeFocused(); expect(page.url()).toBe(href)
      }
      await globe.click(); await page.locator('.client-locale-panel').getByRole('button', { name: '한국어', exact: true }).click()
      await expect(page.locator('.client-locale-panel')).toHaveCount(0)
    }
    expect(page.url()).toBe(href)
    await page.screenshot({ path: info.outputPath(`catalogue-globe-${host}-${width}-${surface}.png`) })
    // Existing route-return control restores the same input, without using
    // newConversation(), account completion, or automatic submission.
    const back = page.locator('.client-sharing-hub>.hub-header button')
    await back.focus(); await expect(back).toBeFocused(); await back.press('Enter')
    await expect(page.locator('.client-sharing-hub')).toHaveCount(0)
    await expect(page.locator('#strategy-idea')).toHaveValue(draft)
    expect(audit).toEqual({ errors: [], external: [], mutations: [], unexpectedAPI: [] })
  })
}

for (const host of ['mock', 'native'] as const) {
  test(`${host} authenticated owner: catalogue list/detail never mounts guest globe`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const audit = await setup(page, host, true)
    await page.goto('/#/share'); await ready(page, host)
    await expect(page.locator('.strategy-list-card').first()).toBeVisible()
    await expect(page.locator('.client-globe,.client-auth-nav')).toHaveCount(0)
    await page.locator('.strategy-list-card').first().getByRole('link').click()
    await expect(page.locator('.client-shared-detail')).toBeVisible()
    await expect(page.locator('.client-globe,.client-auth-nav')).toHaveCount(0)
    // The final guest sidebar has no history action. Use the existing explicit
    // authenticated UI fixture for this reachable normal history boundary.
    await sidebar(page, '연구 기록')
    await expect(page.locator('#research-main .g-hist')).toBeVisible()
    await expect(page.locator('.client-globe,.client-auth-nav')).toHaveCount(0)
    expect(audit).toEqual({ errors: [], external: [], mutations: [], unexpectedAPI: [] })
  })

  test(`${host} non-catalogue: guest known sections/views retain absent shortcut`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const audit = await setup(page, host)
    await page.goto('/#/share'); await ready(page, host)
    await expect(page.locator('.strategy-list-card').first()).toBeVisible()
    await expect(page.locator('.client-globe')).toBeVisible()
    for (const route of ['#/share/library', '#/share/publishing', '#/share/t/noel_b', '#/share/copy/noel_b', '#/share/bt/noel_b']) {
      await page.goto(`/${route}`); await ready(page, host)
      await expect(page.locator('.client-sharing-hub')).toBeVisible()
      await expect(page.locator('.client-globe')).toHaveCount(0)
    }
    expect(audit).toEqual({ errors: [], external: [], mutations: [], unexpectedAPI: [] })
  })
}
