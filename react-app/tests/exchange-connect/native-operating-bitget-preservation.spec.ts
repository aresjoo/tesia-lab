import { expect, test, type Page } from '@playwright/test'

// Real hook/controller/generated SDK, synthetic HTTP only. No vendor request,
// credentials, login, provider authorization or order is performed.
test.use({ trace: 'retain-on-failure', video: 'off' })
test.setTimeout(30_000)
const owner = 'session_operating_bitget_fixture_001', transactionId = 'transaction_operating_bitget_001', connectionId = 'connection_operating_bitget_001'
const pending = { transactionId, exchangeId: 'bitget', status: 'pending', expiresAt: '2030-01-01T00:10:00Z',
  authorizationUrl: 'https://www.bitget.com/account/oauth?state=synthetic', connectionId: null, failureCode: null }
const linked = { connectionId, exchangeId: 'bitget', status: 'connected', maskedAccountLabel: '***0001',
  connectedAt: '2030-01-01T00:01:00Z', permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false }, permissionsVerified: true }
async function mount(page: Page, baseURL: string | undefined, options: { enabled?: boolean; authenticated?: boolean; callback?: boolean; connected?: boolean; holdInitialCatalog?: boolean } = {}) {
  if (!baseURL) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const wire = { owner, connected: options.connected ?? false, allowed: true, reads: 0, starts: 0, cancels: 0,
    api: [] as string[], outbound: [] as string[], bodies: [] as unknown[], held: false, release: () => {}, releaseCatalog: () => {} }
  const initialCatalog = options.holdInitialCatalog ? new Promise<void>(resolve => { wire.releaseCatalog = resolve }) : Promise.resolve()
  page.on('pageerror', error => { throw error })
  await page.clock.install({ time: new Date('2030-01-01T00:01:00Z') })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.origin !== origin) {
      wire.outbound.push(url.href)
      // Fulfilled locally before reaching any real provider.
      return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic consent destination</h1>' })
    }
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="fixture"></div></body></html>' })
    if (!path.startsWith('/api/')) return route.continue()
    wire.api.push(`${request.method()} ${path}`)
    let data: unknown
    let version = '0.12.0'
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (path === '/api/v1/auth/session') {
      version = '0.1.0'; headers.ETag = '"operating_bitget_fixture_etag_001"'
      data = { sessionId: wire.owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' }
    } else if (path === '/api/v1/auth/csrf') {
      version = '0.1.0'; data = { csrfToken: 'csrf_operating_fixture_001', expiresAt: '2030-01-01T12:00:00Z' }
    } else if (path === '/api/v1/exchange-connections/catalog') {
      await initialCatalog
      data = { providers: ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'].map(exchangeId => ({ exchangeId,
        available: exchangeId !== 'bitget' || wire.allowed, reason: exchangeId !== 'bitget' || wire.allowed ? null : 'PROVIDER_UNAVAILABLE' })) }
    }
    else if (path === '/api/v1/exchange-connections/' && request.method() === 'GET') data = { connections: wire.connected
      ? [linked, { ...linked, connectionId: 'connection_foreign_provider_001', exchangeId: 'bybit' }] : [] }
    else if (path === '/api/v1/exchange-connections/transactions' && request.method() === 'POST') {
      wire.starts++; wire.bodies.push(request.postDataJSON()); data = pending
    } else if (path === `/api/v1/exchange-connections/transactions/${transactionId}` && request.method() === 'GET') {
      wire.reads++
      if (wire.held) await new Promise<void>(resolve => { wire.release = resolve })
      data = wire.connected ? { ...pending, status: 'connected', authorizationUrl: null, connectionId } : { ...pending, authorizationUrl: null }
    } else if (path === `/api/v1/exchange-connections/transactions/${transactionId}` && request.method() === 'DELETE') {
      wire.cancels++; data = { ...pending, status: 'cancelled', authorizationUrl: null }
    } else throw new Error(`Unexpected synthetic API: ${request.method()} ${path}`)
    const body = version === '0.1.0' ? { meta: { apiContractVersion: version, resourceRevision: path.endsWith('/session') ? '1' : null,
      requestId: 'req_operating_fixture_001', traceId: 'trace_operating_fixture_001' }, data } : { apiContractVersion: version, data }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.goto(options.callback ? `/auth/complete#exchange-transaction=${transactionId}` : '/operating-bitget-fixture')
  await page.evaluate(async options => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/exchange-connect/use-exchange-connection.ts', source = await (await fetch(path)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const module = await import(/* @vite-ignore */reactPath), React = module.default ?? module
    const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */domPath)
    const { useBitgetCanaryPresentation } = await import(/* @vite-ignore */path)
    function Host() {
      const [scope, setScope] = React.useState('session_operating_bitget_fixture_001')
      const [enabled, setEnabled] = React.useState(options.enabled)
      const [authenticated, setAuthenticated] = React.useState(options.authenticated ?? true)
      const value = useBitgetCanaryPresentation(scope, authenticated, enabled)
      Reflect.set(window, 'operatingControls', { setScope, setEnabled, setAuthenticated, value })
      return React.createElement('output', { id: 'status' }, JSON.stringify({ scope: value?.scope,
        broker: value?.broker, connection: value?.connection }))
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(React.createElement(React.StrictMode, null, React.createElement(Host)))
  }, options)
  return wire
}
const act = (page: Page, expression: string) => page.evaluate(expression)
const status = (page: Page) => page.locator('#status')
const control = '(window.operatingControls)'

test('default disabled and anonymous opt-in do not read or start API12', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL)
  await expect(status(page)).toHaveText('{}')
  await act(page, `${control}.setAuthenticated(false); ${control}.setEnabled(true)`)
  await page.clock.fastForward(3_000)
  await expect(status(page)).toHaveText('{}')
  expect(wire.api).toEqual([]); expect(wire.outbound).toEqual([])
})

test('owner-filtered Bitget-only action double click sends one unchanged START', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true })
  await expect.poll(() => wire.api.join('\n')).toContain('/exchange-connections/catalog')
  await expect(status(page)).toContainText('NEEDS_LINK')
  expect(await act(page, `${control}.value.broker.catalog.filter(x=>x.broker.id!=='bitget').every(x=>x.connectionState==='SOON' && x.broker.rating===null && !x.broker.fees)`)).toBe(true)
  await act(page, `${control}.value.broker.actions.onConnect('bybit').catch(()=>{})`)
  expect(wire.starts).toBe(0)
  await act(page, `void ${control}.value.broker.actions.onConnect('bitget'); void ${control}.value.broker.actions.onConnect('bitget')`)
  await expect.poll(() => wire.starts).toBe(1)
  await expect(page).toHaveURL(pending.authorizationUrl)
  expect(wire.bodies).toEqual([{ exchangeId: 'bitget' }]); expect(wire.outbound).toEqual([pending.authorizationUrl])
})

test('close retires in-flight callback result and captured cancel; no later polling', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, callback: true })
  await expect(status(page)).toContainText('pending:')
  wire.held = true
  await page.clock.fastForward(1_000)
  await expect.poll(() => wire.reads).toBe(2)
  await act(page, `window.oldCancel=${control}.value.connection.state.onChoose; ${control}.value.close()`)
  wire.connected = true; wire.release()
  await expect(status(page)).not.toContainText('"connection"')
  await act(page, 'window.oldCancel("cancel")')
  await page.clock.fastForward(5_000)
  expect(wire.reads).toBe(2); expect(wire.starts).toBe(0); expect(wire.cancels).toBe(0)
})

test('explicit cancel sends one DELETE and stops automatic polling', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, callback: true })
  await expect(status(page)).toContainText('pending:')
  await act(page, `void ${control}.value.connection.state.onChoose('cancel'); void ${control}.value.connection.state.onChoose('cancel')`)
  await expect.poll(() => wire.cancels).toBe(1)
  await expect(status(page)).toContainText('exchanges:')
  await page.clock.fastForward(5_000)
  expect(wire.reads).toBe(1); expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('cookie owner replacement stops transaction read and stale owner actions', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, callback: true })
  await expect(status(page)).toContainText('pending:')
  await act(page, `window.oldConnect=${control}.value.broker.actions.onConnect`)
  wire.owner = 'session_operating_replacement_fixture_001'
  await page.clock.fastForward(1_000)
  await expect(status(page)).toContainText('retired:')
  await act(page, `${control}.setScope('session_operating_replacement_fixture_001')`)
  await expect(status(page)).toContainText('session_operating_replacement_fixture_001')
  await act(page, 'window.oldConnect("bitget").catch(()=>{})')
  await page.clock.fastForward(3_000)
  expect(wire.reads).toBe(1); expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('same-owner reopen rechecks current connections and preserves management without START', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('CONNECTED')
  await act(page, `${control}.value.broker.actions.onConnect('bitget')`)
  await expect(status(page)).toContainText('"connection"')
  expect(await act(page, `${control}.value.connection.state.connectionList.accounts.map(x=>x.exchangeId)`)).toEqual(['bitget'])
  await act(page, `${control}.value.close()`)
  await expect(status(page)).not.toContainText('"connection"')
  await act(page, `${control}.value.broker.actions.onConnect('bitget')`)
  await expect(status(page)).toContainText('"connection"')
  expect(wire.api.filter(path => path === 'GET /api/v1/exchange-connections/').length).toBeGreaterThanOrEqual(3)
  expect(wire.starts).toBe(0); expect(wire.cancels).toBe(0); expect(wire.outbound).toEqual([])
})

test('initial catalog navigation close preserves the later owner-bound Bitget producer without reopening', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdInitialCatalog: true })
  await expect.poll(() => wire.api.join('\n')).toContain('GET /api/v1/exchange-connections/catalog')
  await expect(status(page)).toHaveText('{}')
  await act(page, `history.pushState(null, '', '/other-operating-route'); window.dispatchEvent(new Event('teth:navigate'))`)
  wire.releaseCatalog()
  await expect(status(page)).toContainText('CONNECTED')
  await expect(status(page)).toContainText(owner)
  await expect(status(page)).not.toContainText('"connection"')
  // A new explicit same-owner action must still reach the current connection.
  await act(page, `${control}.value.broker.actions.onConnect('bitget')`)
  await expect(status(page)).toContainText('"connection"')
  expect(await act(page, `${control}.value.connection.state.connectionList.accounts.map(x=>x.exchangeId)`)).toEqual(['bitget'])
  expect(wire.starts).toBe(0); expect(wire.cancels).toBe(0); expect(wire.outbound).toEqual([])
})

test('initial callback catalog completion preserves a later settings route and owner-bound broker entry', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, callback: true, connected: true, holdInitialCatalog: true })
  await expect.poll(() => wire.api.join('\n')).toContain('GET /api/v1/exchange-connections/catalog')
  await expect(status(page)).toHaveText('{}')
  await act(page, `history.pushState(null, '', '/#/settings'); window.dispatchEvent(new Event('teth:navigate'))`)
  await expect(page).toHaveURL(/\/#\/settings$/)
  wire.releaseCatalog()
  await expect(status(page)).toContainText('CONNECTED')
  await expect(status(page)).toContainText(`bitget-canary:${owner}`)
  await expect(status(page)).not.toContainText('"connection"')
  await expect(page).toHaveURL(/\/#\/settings$/)
  // The callback was observed in the background, but navigation revoked its
  // visible-entry intent: no route replacement, authorize, cancel or polling.
  expect(wire.reads).toBe(1)
  await page.clock.fastForward(3_000)
  await expect(page).toHaveURL(/\/#\/settings$/)
  expect(wire.reads).toBe(1)
  expect(wire.starts).toBe(0); expect(wire.cancels).toBe(0); expect(wire.outbound).toEqual([])
})
