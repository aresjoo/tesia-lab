import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'

// This is an improvement to an obstruction also observed in source 9fb, not
// evidence that every fixed-header overlap was introduced by the React port.
// Exercise the actual Native service entry with anonymous session/CSRF fixtures.
// No provider authentication, API mutation, or production service is exercised.
test.setTimeout(45_000)

type Case = { width: number; language: string; view: 'home' | 'trade'; banner: boolean }
const cases: Case[] = []
for (const width of [320, 390]) for (const language of ['ko', 'fr'])
  for (const view of ['home', 'trade'] as const) for (const banner of [true, false])
    cases.push({ width, language, view, banner })
for (const language of ['en', 'es']) cases.push({ width: 320, language, view: 'home', banner: true })

async function mount(page: Page, baseURL: string | undefined, c: Case) {
  if (!baseURL) throw new Error('A local baseURL is required')
  const origin = new URL(baseURL).origin
  const audit = { errors: [] as string[], mutations: [] as string[], external: [] as string[], unexpectedApi: [] as string[] }
  page.on('pageerror', error => audit.errors.push(error.message))
  await page.setViewportSize({ width: c.width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(({ language, banner }) => {
    localStorage.setItem('tethLang', language)
    localStorage.setItem('tethCurrency', 'USD')
    if (!banner) sessionStorage.setItem('teth-app-banner-dismissed', '1')
  }, c)
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external.push(url.origin); return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations.push(request.method() + ' ' + url.pathname); return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/api/')) {
      const session = url.pathname === '/api/v1/auth/session'
      if (!session && url.pathname !== '/api/v1/auth/csrf') { audit.unexpectedApi.push(url.pathname); return route.abort('blockedbyclient') }
      const meta = { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_footer_occlusion_fixture_0001', traceId: 'trace_footer_occlusion_fixture_0001' }
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"footer_occlusion_anonymous_001"' } : {}, body: JSON.stringify({ meta, data: session
        ? { sessionId: 'session_footer_occlusion_fixture_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
        : { csrfToken: 'csrf_footer_occlusion_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
    }
    if (request.isNavigationRequest() && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/src/internal-poc/service-main.tsx");</script></body></html>' })
    return route.continue()
  })
  await page.goto(c.view === 'trade' ? '/#/trade' : '/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.client-site-footer')).toHaveAttribute('lang', c.language)
  await page.evaluate(() => document.fonts.ready)
  return audit
}

async function centerHit(locator: Locator) {
  return locator.evaluate(element => {
    const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return { receives: Boolean(hit && (hit === element || element.contains(hit))), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, hit: hit ? { tag: hit.tagName, className: typeof hit.className === 'string' ? hit.className : '', text: hit.textContent?.trim().slice(0, 80) } : null }
  })
}

async function evidence(page: Page, info: TestInfo, name: string) {
  const measured = await page.evaluate(() => {
    const root = document.querySelector('.client-source-app')!
    const measure = (selector: string) => [...document.querySelectorAll(selector)].map(el => {
      const r = el.getBoundingClientRect()
      return { className: el.className, rect: { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }, position: getComputedStyle(el).position }
    })
    return { scrollTop: root.scrollTop, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight, auth: measure('.client-auth-nav,.client-login,.client-signup'), banner: measure('.client-app-banner'), footer: measure('.client-site-footer .gft-cols button,.client-site-footer .gft-cols a'), active: document.activeElement?.textContent?.trim().slice(0, 80) }
  })
  await info.attach(name, { body: JSON.stringify(measured, null, 2), contentType: 'application/json' })
}

for (const c of cases) test(`${c.width}px ${c.language} banner-${c.banner ? 'open' : 'closed'} ${c.view}: footer clears account controls and keyboard restores them`, async ({ page, baseURL }, info) => {
  info.annotations.push({ type: 'source-origin-improvement', description: 'Source 9fb also obstructs footer controls; preserve copy, nodes and handlers while improving finite-page scrolling.' })
  const audit = await mount(page, baseURL, c)
  const shell = page.locator('.client-source-app.has-site-footer'), nav = page.locator('.client-auth-nav')
  const login = nav.locator('.client-login'), signup = nav.locator('.client-signup'), banner = page.locator('.client-app-banner')
  const originalNav = await nav.elementHandle(), originalLogin = await login.elementHandle(), originalSignup = await signup.elementHandle()
  const initialNav = await nav.boundingBox(), initialLogin = await login.boundingBox(), initialSignup = await signup.boundingBox()
  expect(initialNav!.y).toBe(c.banner ? 72 : 8)
  expect(initialLogin!.height).toBe(44)
  expect(initialSignup!.height).toBe(44)
  await expect(login.locator('.client-auth-pill')).toHaveCSS('height', '36px')
  await expect(signup.locator('.client-auth-pill')).toHaveCSS('height', '36px')
  await expect(banner).toHaveCount(c.banner ? 1 : 0)
  if (c.banner) { expect((await banner.boundingBox())!.y).toBe(0); expect((await banner.boundingBox())!.height).toBe(64) }
  await evidence(page, info, 'initial-geometry')

  const links = page.locator('.client-site-footer .gft-cols').locator('button,a')
  // Match the confirmed counterexample: first product link at y20 places the
  // second French/Spanish link at approximately y64..108 behind old login.
  await links.first().evaluate(element => {
    const sc = element.closest('.client-source-app')!
    sc.scrollTop += element.getBoundingClientRect().top - 20
  })
  await evidence(page, info, 'footer-before-assertions')
  await expect.poll(() => nav.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0)
  if (c.banner) await expect.poll(() => banner.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0)
  const globe = page.locator('.client-globe')
  if (await globe.isVisible()) expect(await globe.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(0)
  await expect.poll(async () => (await centerHit(links.nth(1))).receives).toBe(true)

  // A real Tab enters the formerly obscured control; no presentation override.
  await links.first().evaluate(element => (element as HTMLElement).focus({ preventScroll: true }))
  await page.keyboard.press('Tab')
  await expect(links.nth(1)).toBeFocused()
  await expect.poll(async () => (await centerHit(links.nth(1))).receives).toBe(true)
  const social = page.locator('.client-site-footer .gft-follow button').first()
  await social.evaluate(element => { const sc = element.closest('.client-source-app')!; sc.scrollTop += element.getBoundingClientRect().top - 140 })
  expect((await centerHit(social)).receives).toBe(true)
  await expect(page.locator('.client-site-footer .gft-follow button:disabled')).toHaveCount(4)

  // Offscreen is not removed/disabled: focus reveals the existing login again.
  await login.focus()
  await expect(login).toBeFocused()
  await expect(login).toBeInViewport({ ratio: 1 })
  await expect.poll(() => shell.evaluate(element => element.scrollTop)).toBe(0)
  expect(await originalNav!.evaluate(element => element === document.querySelector('.client-auth-nav'))).toBe(true)
  expect(await originalLogin!.evaluate(element => element === document.querySelector('.client-auth-nav .client-login'))).toBe(true)
  expect(await originalSignup!.evaluate(element => element === document.querySelector('.client-auth-nav .client-signup'))).toBe(true)
  expect(await nav.boundingBox()).toEqual(initialNav)
  expect(await login.boundingBox()).toEqual(initialLogin)
  expect(await signup.boundingBox()).toEqual(initialSignup)
  await signup.click()
  await expect(page.locator('.native-auth-surface')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.native-auth-surface')).toHaveCount(0)
  await expect(signup).toBeFocused()
  expect(await originalSignup!.evaluate(element => element === document.querySelector('.client-auth-nav .client-signup'))).toBe(true)
  await evidence(page, info, 'restored-geometry')
  await page.screenshot({ path: info.outputPath('restored-header.png') })
  expect(audit).toEqual({ errors: [], mutations: [], external: [], unexpectedApi: [] })
})
