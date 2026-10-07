import { expect, test, type Page } from '@playwright/test'

// Integrated auth-FIX worktree, not public static 6ced/f2. Explicit anonymous
// GET fixtures only. Intro arrival owns no user-selected control or dialog.
test.use({ serviceWorkers: 'block' })
test.setTimeout(30_000)
const observations = new WeakMap<Page, { blocked: string[]; errors: string[]; ws: number; blockedLocalHmr: number; timeline: unknown[] }>()
test.afterEach(async ({ page }, info) => {
  const audit = observations.get(page)
  if (!audit) return
  await info.attach('focus-ownership', { contentType: 'application/json', body: JSON.stringify(audit) })
  expect(audit.blocked).toEqual([]); expect(audit.errors).toEqual([]); expect(audit.ws).toBe(0)
})

const preamble = `import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;`
async function setup(page: Page, baseURL: string | undefined, component = false, holdIntro = false) {
  if (!baseURL || new URL(baseURL).hostname !== '127.0.0.1') throw new Error('OWNED_LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  let reactPath = '', clientPath = ''
  if (component) {
    // Resolve the same versioned Vite dependency URLs as service-main. Importing
    // unversioned CJS wrappers creates a second React dispatcher in a browser.
    const response = await page.request.get(origin + '/src/internal-poc/service-main.tsx')
    if (!response.ok()) throw new Error('SERVICE_MODULE_UNAVAILABLE')
    const entry = await response.text()
    reactPath = entry.match(/["']([^"']+\/react\.js(?:\?v=[a-f0-9]+)?)["']/)?.[1] ?? ''
    clientPath = entry.match(/["']([^"']+\/react-dom_client\.js(?:\?v=[a-f0-9]+)?)["']/)?.[1] ?? ''
    if (!reactPath || !clientPath) throw new Error('EXACT_VITE_DEPENDENCIES_REQUIRED')
  }
  const audit = { blocked: [] as string[], errors: [] as string[], ws: 0, blockedLocalHmr: 0, timeline: [] as unknown[] }
  observations.set(page, audit)
  let releaseIntro!: () => void, releaseSession!: () => void
  const introGate = new Promise<void>(resolve => { releaseIntro = resolve })
  const sessionGate = new Promise<void>(resolve => { releaseSession = resolve })
  const state = { holdSession: false, sessionHeld: false, introHeld: false, sessionReads: 0 }
  page.on('pageerror', e => audit.errors.push(e.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => { localStorage.setItem('tethLang', 'en'); localStorage.setItem('tethCurrency', 'USD') })
  await page.context().routeWebSocket('**/*', ws => {
    // Vite alone attempts its loopback development HMR socket. Block it too,
    // but never report it as an application/provider connection or print query.
    const url = new URL(ws.url())
    if (url.host === new URL(origin).host && url.pathname === '/') audit.blockedLocalHmr++
    else audit.ws++
    ws.close()
  })
  await page.context().route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin !== origin || req.method() !== 'GET') { audit.blocked.push(`${req.method()} ${url.origin === origin ? url.pathname : 'EXTERNAL'}`); return route.abort() }
    if (holdIntro && url.pathname === '/src/components/ClientTradingIntro.tsx') { state.introHeld = true; await introGate }
    if (url.pathname.startsWith('/api/')) {
      if (url.search || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(url.pathname)) { audit.blocked.push(url.pathname); return route.abort() }
      const session = url.pathname.endsWith('/session')
      if (session) { state.sessionReads++; if (state.holdSession) { state.sessionHeld = true; await sessionGate } }
      return route.fulfill({ contentType: 'application/json', headers: session ? { ETag: '"focus_ownership_anonymous_01"' } : {}, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: session ? '1' : null, requestId: 'req_focus_ownership_01', traceId: 'trace_focus_ownership_01' },
        data: session ? { sessionId: 'session_focus_ownership_01', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'csrf_focus_ownership_01', expiresAt: '2030-01-02T00:00:00Z' },
      }) })
    }
    if (req.isNavigationRequest() && url.pathname === '/') {
      const body = component ? `<div class="client-auth-nav"><button id="button">Auth action</button><a id="anchor" href="#auth-option">Auth option</a></div><input id="input"><textarea id="textarea"></textarea><select id="select"><option>Choice</option></select><div id="editable" contenteditable="true">Editable</div><button id="route-button">Open introduction</button><a id="route-link" href="#trade">Introduction link</a><dialog id="dialog"><button id="dialog-control">Close dialog</button></dialog><div id="fixture-root"></div><script type="module">${preamble}const react=await import(${JSON.stringify(reactPath)});const React=react.default??react;const client=await import(${JSON.stringify(clientPath)});const createRoot=client.createRoot??client.default.createRoot;const {default:Intro}=await import('/src/components/ClientTradingIntro.tsx');const root=createRoot(document.getElementById('fixture-root'));window.mountIntro=key=>root.render(React.createElement(Intro,{key,onStart:()=>{}}));</script>`
        // Compiled lazy routes preload the intro CSS independently of JS. Keep
        // that real source styling available while this Vite module is held.
        : `<link rel="stylesheet" href="/src/client-trading-intro.css"><div id="internal-poc-root"></div><script type="module">${preamble}await import('/src/internal-poc/service-main.tsx');</script>`
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body>${body}</body></html>` })
    }
    return route.continue()
  })
  return { audit, state, releaseIntro, releaseSession }
}

async function componentFixture(page: Page, baseURL: string | undefined) {
  await setup(page, baseURL, true)
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'mountIntro'))).toBe('function')
}
async function mountIntro(page: Page, key: string) {
  const heading = page.locator('.txh-hero h1')
  const previousId = await heading.count() ? await heading.getAttribute('id') : null
  await page.evaluate(key => (Reflect.get(window, 'mountIntro') as (key: string) => void)(key), key)
  await expect(heading).toBeVisible()
  // A new key must have committed its own mount, not the prior heading.
  await expect(heading).toHaveAttribute('id', /-title$/)
  if (previousId !== null) await expect(heading).not.toHaveAttribute('id', previousId)
}

test('signup focus survives lazy intro arrival while session GET is held, then Escape returns to the same trigger', async ({ page, baseURL }) => {
  const { audit, state, releaseIntro, releaseSession } = await setup(page, baseURL, false, true)
  try {
    await page.goto('/')
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    await page.locator('.client-site-footer').getByRole('button', { name: 'AI Trading', exact: true }).click()
    await expect(page).toHaveURL(/#\/trade$/)
    await expect.poll(() => state.introHeld).toBe(true)
    const signup = page.locator('.client-auth-nav .client-signup'), node = await signup.elementHandle()
    state.holdSession = true
    await signup.click()
    await expect.poll(() => state.sessionHeld).toBe(true)
    await expect(signup).toBeFocused()
    releaseIntro()
    await expect(page.locator('.txh-hero h1')).toBeVisible()
    audit.timeline.push(await page.evaluate(() => ({ stage: 'intro-arrived-session-pending', active: document.activeElement?.className, modal: !!document.querySelector('dialog[open]') })))
    await expect(signup).toBeFocused()
    releaseSession()
    await expect(page.locator('.native-auth-surface')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.native-auth-surface')).toHaveCount(0)
    await expect(signup).toBeFocused()
    expect(await node!.evaluate(e => e === document.querySelector('.client-signup'))).toBe(true)
    expect(state.sessionReads).toBe(2)
  } finally { releaseIntro(); releaseSession() }
})

test('normal service route arrival still focuses the introduction H1', async ({ page, baseURL }) => {
  await setup(page, baseURL)
  await page.goto('/#/trade')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.txh-hero h1')).toBeFocused()
})

test('body arrival retains normal heading focus without global focus prevention', async ({ page, baseURL }) => {
  await componentFixture(page, baseURL)
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  await mountIntro(page, 'body')
  await expect(page.locator('.txh-hero h1')).toBeFocused()
  await page.locator('#input').focus()
  await expect(page.locator('#input')).toBeFocused()
})

test('live auth-row controls, keyboard auth option and editable controls keep selected focus across introduction mounts', async ({ page, baseURL }) => {
  await componentFixture(page, baseURL)
  for (const id of ['button', 'anchor', 'input', 'textarea', 'select', 'editable']) {
    if (id === 'anchor') { await page.locator('#button').focus(); await page.keyboard.press('Tab') }
    else await page.locator('#' + id).focus()
    await expect(page.locator('#' + id)).toBeFocused()
    await mountIntro(page, id)
    await expect(page.locator('#' + id)).toBeFocused()
  }
})

test('ordinary route buttons and links outside the auth row yield focus to the newly mounted introduction H1', async ({ page, baseURL }) => {
  await componentFixture(page, baseURL)
  for (const id of ['route-button', 'route-link']) {
    await page.locator('#' + id).focus()
    await expect(page.locator('#' + id)).toBeFocused()
    await mountIntro(page, id)
    await expect(page.locator('.txh-hero h1')).toBeFocused()
  }
})

test('warm service footer navigation by Enter and click restores route H1 rather than the retained footer trigger', async ({ page, baseURL }) => {
  const { audit } = await setup(page, baseURL)
  await page.goto('/#/trade')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.locator('.txh-hero h1')).toBeFocused()
  const footer = page.locator('.client-site-footer')
  const trigger = footer.getByRole('button', { name: 'AI Trading', exact: true })
  const node = await trigger.elementHandle()
  for (const activation of ['Enter', 'click']) {
    await footer.getByRole('button', { name: 'Create New Strategy', exact: true }).click()
    await expect(page.locator('.txh')).toHaveCount(0)
    if (activation === 'Enter') { await trigger.focus(); await page.keyboard.press('Enter') }
    else await trigger.click()
    await expect(page).toHaveURL(/#\/trade$/)
    await expect(page.locator('.txh-hero h1')).toBeFocused()
    expect(await node!.evaluate(e => e === document.querySelector('.gft-cols button'))).toBe(true)
    audit.timeline.push(await page.evaluate(activation => ({ activation, active: document.activeElement?.tagName, h1Focused: document.activeElement === document.querySelector('.txh-hero h1'), scrollTop: document.querySelector('.client-service-app')?.scrollTop }), activation))
  }
})

test('a native modal and its keyboard control retain focus when the introduction arrives', async ({ page, baseURL }) => {
  await componentFixture(page, baseURL)
  await page.locator('#button').focus()
  await page.locator('#dialog').evaluate((dialog: HTMLDialogElement) => dialog.showModal())
  await expect(page.locator('#dialog-control')).toBeFocused()
  await mountIntro(page, 'modal')
  await expect(page.locator('#dialog-control')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#dialog')).not.toBeVisible()
  await expect(page.locator('#button')).toBeFocused()
})
