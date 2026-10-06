import { createHash } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'

// Independent fixed 9fb index.html:5289/5290 anchors. Final applyLang :26653
// changes text only. Restore document-opening behavior, not legal authority.
const policies = [
  { tab: 'terms', label: '서비스 약관', href: '/policies/#terms' },
  { tab: 'privacy', label: '개인정보처리방침', href: '/policies/#privacy' },
] as const
const serviceHtml = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import("/src/internal-poc/service-main.tsx");</script></body></html>'
async function storageHash(page: Page) {
  const snapshot = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))
  // Never attach storage values, session bindings, request bodies or headers.
  return createHash('sha256').update(snapshot).digest('hex')
}

for (const host of ['Main', 'Native service entry'] as const) for (const policy of policies) test(`${host} guest ${policy.tab}: source policy opens separate tab and preserves current draft`, async ({ page, context, baseURL }, info) => {
  if (!baseURL) throw new Error('Local origin required')
  const origin = new URL(baseURL).origin, width = info.project.name === 'desktop' ? 1440 : 320
  const audit = { errors: [] as string[], external: 0, mutations: 0, unexpectedApi: 0, sessionGets: 0, csrfGets: 0 }
  context.on('page', opened => opened.on('pageerror', error => audit.errors.push(error.message)))
  page.on('pageerror', error => audit.errors.push(error.message))
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== origin) { audit.external++; return route.abort('blockedbyclient') }
    if (!['GET', 'HEAD'].includes(request.method())) { audit.mutations++; return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/api/')) {
      if (host === 'Native service entry' && request.method() === 'GET') {
        // Same GET-only synthetic observations as native-initial-surface.
        // The real entry, NativeServiceApp and generated SDK remain untouched;
        // this does not prove actual backend/provider authentication.
        const meta = { apiContractVersion: '0.1.0', requestId: 'req_help_policy_fixture_0001', traceId: 'trace_help_policy_fixture_0001', resourceRevision: url.pathname.endsWith('/session') ? '1' : null }
        if (url.pathname === '/api/v1/auth/session') {
          audit.sessionGets++
          return route.fulfill({ contentType: 'application/json', headers: { ETag: '"help_policy_session_fixture_0001"' }, body: JSON.stringify({ meta, data: { sessionId: 'session_help_policy_fixture_0001', state: 'ANONYMOUS', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
        }
        if (url.pathname === '/api/v1/auth/csrf') {
          audit.csrfGets++
          return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta, data: { csrfToken: 'csrf_help_policy_fixture_0001', expiresAt: '2030-01-02T00:00:00Z' } }) })
        }
      }
      audit.unexpectedApi++; return route.abort('blockedbyclient')
    }
    // Reuse native-public-document-boundaries' real service-main HTML adapter
    // for initial / and popup document requests. No controlled shell fixture.
    if (host === 'Native service entry' && request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: serviceHtml })
    return route.continue()
  })
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // noopener popups first have an opaque about:blank; only seed our local origin.
  await context.addInitScript(localOrigin => { if (location.origin === localOrigin) { localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1') } }, origin)
  await page.goto('/')
  if (host === 'Native service entry') await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  else await expect(page.locator('.client-source-app:not(.client-service-app)')).toBeVisible()
  const input = page.locator('#strategy-idea'), draft = `Preserved policy draft: ${policy.tab}`
  await expect(input).toBeEnabled()
  await input.fill(draft)
  // Main persists ordinary draft edits after a source-defined 250ms debounce.
  // Observe its completed real write before comparing state across navigation.
  if (host === 'Main') await expect.poll(() => page.evaluate(expected => JSON.parse(sessionStorage.getItem('teth-client-experience') ?? '{}').homeDraft === expected, draft)).toBe(true)
  const inputNode = await input.elementHandle(), originalUrl = page.url(), beforeStorage = await storageHash(page)
  const beforeReads = { sessionGets: audit.sessionGets, csrfGets: audit.csrfGets }
  await page.locator(width === 320 ? '.client-hamburger' : '.client-rail-logo-row button').click()
  const trigger = page.locator('[data-sidebar-action="settings"]')
  await trigger.click()
  const menu = page.locator('.ca-menu-layer[data-surface-active="true"] .ca-settings')
  await expect(menu).toBeVisible()
  await menu.locator('[aria-controls="ca-sub-help"]').click()
  const link = menu.locator('#ca-sub-help').getByRole('link', { name: policy.label, exact: true })
  await expect(link).toHaveAttribute('href', policy.href)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(menu.locator('#ca-sub-help a[href="/about/"]')).not.toHaveAttribute('target')
  await expect(menu.locator('#ca-sub-help a[href="/about/"]')).not.toHaveAttribute('rel')
  const popupPromise = context.waitForEvent('page')
  await link.click()
  const popup = await popupPromise
  try {
    await popup.waitForURL(new URL(policy.href, originalUrl).href)
    await expect(popup.locator('.view.on')).toHaveAttribute('id', `v-${policy.tab}`)
    await expect(popup.locator('.view.on')).toHaveAttribute('lang', 'ko')
    expect(await popup.evaluate(() => window.opener === null)).toBe(true)
    expect(page.url()).toBe(originalUrl)
    // Original submenu stops propagation: policy links retain the current menu.
    // About still owns its existing onClose callback, unchanged by this patch.
    await expect(page.locator('.ca-menu-layer[data-surface-active="true"]')).toHaveCount(1)
    await expect(menu).toBeVisible()
    await expect(input).toBeVisible()
    await expect(input).toHaveValue(draft)
    expect(await input.evaluate((node, previous) => node === previous, inputNode)).toBe(true)
    // The retained modal menu still owns the normal background inert boundary.
    expect(await page.locator('.client-source-app').evaluate(node => !!node.closest('[inert]'))).toBe(true)
    await expect(link).toBeFocused()
    expect(await storageHash(page)).toBe(beforeStorage)
    expect({ sessionGets: audit.sessionGets, csrfGets: audit.csrfGets }).toEqual(beforeReads)
    if (host === 'Native service entry') {
      await expect(popup.locator('.client-service-app')).toHaveCount(0)
      await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
    }
  } finally { await popup.close() }
  await page.bringToFront()
  expect(context.pages()).toHaveLength(1)
  expect(page.url()).toBe(originalUrl)
  await expect(input).toHaveValue(draft)
  await expect(menu).toBeVisible()
  await expect(link).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu.locator('#ca-sub-help')).toHaveCount(0)
  await expect(menu.locator('[aria-controls="ca-sub-help"]')).toBeFocused()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ca-menu-layer')).toHaveCount(0)
  expect(await page.locator('.client-source-app').evaluate(node => !!node.closest('[inert],[hidden]'))).toBe(false)
  await expect(width === 320 ? page.locator('.client-hamburger') : trigger).toBeFocused()
  expect(audit.errors).toEqual([])
  expect({ external: audit.external, mutations: audit.mutations, unexpectedApi: audit.unexpectedApi }).toEqual({ external: 0, mutations: 0, unexpectedApi: 0 })
  if (host === 'Native service entry') { expect(audit.sessionGets).toBeGreaterThan(0); expect(audit.csrfGets).toBeGreaterThan(0) }
  else expect(beforeReads).toEqual({ sessionGets: 0, csrfGets: 0 })
  await info.attach('help-policy-link-boundary.json', { body: JSON.stringify({ host, tab: policy.tab, width, originalUrl, popupHref: policy.href, currentStorageUnchanged: true, inputNodePreserved: true, menuRetained: true, escapeCloseObserved: true, openerNull: true, audit }), contentType: 'application/json' })
})
