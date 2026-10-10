import { expect, test, type Page } from '@playwright/test'
import { revealSourceNavigation } from '../fixtures/source-offline-research-entry'

// Actual service-main entry and native host; intercepted synthetic SDK HTTP.
// Run with Google-only=true, canary=true, genericExchange=false, consultation=false.
// No real login, provider, account, private key, order or deployment is used.
test.setTimeout(30_000)
const owner = 'session_operating_wiring_fixture_001', tx = 'transaction_operating_wiring_001', connectionId = 'connection_operating_wiring_001'
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, resourceRevision: revision,
  requestId: 'req_operating_wiring_001', traceId: 'trace_operating_wiring_001' })
async function mount(page: Page, baseURL: string | undefined, options: { authenticated?: boolean; callback?: boolean; pendingCallback?: boolean } = {}) {
  if (!baseURL) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const wire = { calls: [] as string[], external: [] as string[], starts: 0, authStarts: 0, connected: Boolean(options.callback && !options.pendingCallback) }
  await page.clock.setFixedTime(new Date('2030-01-01T00:01:00Z'))
  await page.addInitScript(() => { localStorage.setItem('tethLang', 'ko'); sessionStorage.setItem('teth-app-banner-dismissed', '1') })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.origin !== origin) {
      wire.external.push(url.href)
      return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic provider destination</h1>' })
    }
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
      <div id="internal-poc-root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/internal-poc/service-main.tsx');</script></body></html>` })
    if (!path.startsWith('/api/')) return route.continue()
    wire.calls.push(`${request.method()} ${path}`)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    let body: unknown, status = 200
    if (path === '/api/v1/auth/session') {
      headers.ETag = '"etag_operating_wiring_001"'
      body = { meta: meta('0.1.0', '1'), data: { sessionId: owner, state: options.authenticated === false ? 'ANONYMOUS' : 'AUTHENTICATED',
        revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' } }
    } else if (path === '/api/v1/auth/csrf') body = { meta: meta('0.1.0', null), data: { csrfToken: 'csrf_operating_wiring_001', expiresAt: '2030-01-01T12:00:00Z' } }
    else if (path === '/api/v2/auth/google/transactions' && request.method() === 'POST') {
      wire.authStarts++; status = 201; headers.ETag = '"etag_operating_wiring_001"'
      body = { meta: meta('0.2.0', '0'), data: { transactionId: 'oidc_tx_operating_wiring_001', issuedAt: '2030-01-01T00:00:00Z',
        expiresAt: '2030-01-01T00:10:00Z', authorizationRedirect: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic' } }
    } else {
      let data: unknown
      if (path === '/api/v1/exchange-connections/catalog') data = { providers: ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'].map(exchangeId => ({ exchangeId,
        available: exchangeId === 'bitget', reason: exchangeId === 'bitget' ? null : 'PROVIDER_UNAVAILABLE' })) }
      else if (path === '/api/v1/exchange-connections/') data = { connections: wire.connected ? [{ connectionId, exchangeId: 'bitget', status: 'connected',
        maskedAccountLabel: '***0001', connectedAt: '2030-01-01T00:01:00Z', permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false }, permissionsVerified: true }] : [] }
      else if (path === `/api/v1/exchange-connections/transactions/${tx}`) data = { transactionId: tx, exchangeId: 'bitget', status: wire.connected ? 'connected' : 'pending',
        expiresAt: '2030-01-01T00:10:00Z', authorizationUrl: null, connectionId: wire.connected ? connectionId : null, failureCode: null }
      else if (path === '/api/v1/exchange-connections/transactions' && request.method() === 'POST') {
        wire.starts++; expect(request.postDataJSON()).toEqual({ exchangeId: 'bitget' })
        data = { transactionId: tx, exchangeId: 'bitget', status: 'pending', expiresAt: '2030-01-01T00:10:00Z',
          authorizationUrl: 'https://www.bitget.com/account/oauth?state=synthetic', connectionId: null, failureCode: null }
      } else throw new Error(`Unexpected synthetic API: ${request.method()} ${path}`)
      body = { apiContractVersion: '0.12.0', data }
    }
    return route.fulfill({ status, headers, body: JSON.stringify(body) })
  })
  await page.goto(options.callback ? `/auth/complete#exchange-transaction=${tx}` : '/')
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  return wire
}
async function browse(page: Page) {
  const entry = page.locator('.client-sidebar').getByRole('button', { name: '거래소 연결', exact: true })
  if (!await entry.isVisible()) { await revealSourceNavigation(page); await page.locator('.client-hamburger').click() }
  await entry.click()
}

test('service-main Google-only natural login initiates once without Apple email exchange or consultation', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { authenticated: false })
  await page.locator('.client-auth-nav .client-login').click()
  const dialog = page.locator('dialog.native-auth-surface')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Apple로 계속하기 준비 중', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: '이메일로 로그인 준비 중', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Google로 계속하기', exact: true }).click()
  await expect(page).toHaveURL('https://accounts.google.com/o/oauth2/v2/auth?state=synthetic')
  expect(wire.authStarts).toBe(1); expect(wire.starts).toBe(0)
  expect(wire.calls.some(call => /apple|email|conversations|exchange-connections/.test(call))).toBe(false)
})

test('authenticated native plan binds the current Bitget-only producer to authorize once', async ({ page, baseURL }, info) => {
  const wire = await mount(page, baseURL)
  await expect.poll(() => wire.calls.filter(call => call.endsWith('/exchange-connections/')).length).toBeGreaterThan(0)
  await browse(page)
  const plan = page.getByTestId('connection-plan')
  await plan.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await plan.getByRole('button', { name: 'Bitget', exact: true }).click()
  await plan.getByRole('button', { name: '기존 초대 계정 연결', exact: true }).click()
  const authorize = plan.getByRole('button', { name: 'Bitget에서 승인하기', exact: true })
  await info.attach('native-plan-binding', { contentType: 'application/json', body: JSON.stringify({ calls: wire.calls,
    enabled: await authorize.isEnabled(), plan: await plan.innerText() }) })
  await expect(authorize).toBeEnabled()
  await authorize.click()
  await expect(page).toHaveURL('https://www.bitget.com/account/oauth?state=synthetic')
  expect(wire.starts).toBe(1); expect(wire.authStarts).toBe(0)
})

test('Bitget callback has no Google panel and native close then current connection reopen reaches management', async ({ page, baseURL }, info) => {
  const wire = await mount(page, baseURL, { callback: true, pendingCallback: true })
  await expect(page.locator('.native-connection-onboarding')).toBeVisible()
  await expect(page.locator('.native-connection-onboarding').getByRole('heading', { name: 'Bitget 연결 확인 중', exact: true })).toBeVisible()
  await expect(page.locator('dialog.native-auth-surface')).toHaveCount(0)
  await page.locator('.native-connection-onboarding .nsp-back').click()
  await expect(page.locator('.native-connection-onboarding')).toHaveCount(0)
  wire.connected = true
  await browse(page)
  const plan = page.getByTestId('connection-plan')
  await plan.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await plan.getByRole('button', { name: 'Bitget', exact: true }).click()
  await plan.getByRole('button', { name: '기존 초대 계정 연결', exact: true }).click()
  await plan.getByRole('button', { name: 'Bitget에서 승인하기', exact: true }).click()
  await info.attach('native-reopen-binding', { contentType: 'application/json', body: JSON.stringify({ calls: wire.calls,
    plan: await page.getByTestId('connection-plan').count(), management: await page.locator('.native-connection-onboarding').count() }) })
  await expect(page.locator('.native-connection-onboarding')).toBeVisible()
  await expect(page.locator('.native-connection-onboarding').getByRole('heading', { name: '거래소 연결', exact: true })).toBeVisible()
  expect(wire.starts).toBe(0); expect(wire.authStarts).toBe(0); expect(wire.external).toEqual([])
})
