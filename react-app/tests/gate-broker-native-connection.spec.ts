import { expect, test, type Page } from '@playwright/test'

test.use({ trace: 'retain-on-failure', video: 'off' })
const scope = 'session_gate_native_owner_0001', transactionId = 'a'.repeat(32)
const connectionId = 'gate_connection_fixture_0001', prefix = '/api/v1/gate-broker-connections'
const callback = `/auth/complete#gate-broker-transaction=${transactionId}`
const clock = new Date('2030-01-01T00:01:00Z')
const authorizationUrl = 'https://www.gate.io/synthetic-broker/oauth/authorize?' + new URLSearchParams({
  response_type: 'code', client_id: 'synthetic-client', redirect_uri: 'https://teth.ai/api/v1/exchange-connections/callback/gate',
  scope: 'read_openid,read_account_status,create_apikey', state: 's'.repeat(32),
})

async function fixture(page: Page, baseURL: string | undefined) {
  if (!baseURL) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const wire = { calls: [] as string[], starts: 0, cancels: 0, gets: 0, session: 'AUTHENTICATED', denySession: false,
    status: 'TOKEN_RECEIVED', connected: false, holdGet: false, held: false, release: () => {},
    denyStart: false, outgoing: [] as string[], csrf: [] as string[] }
  await page.clock.install({ time: clock })
  await page.addInitScript(() => localStorage.setItem('tethLang', 'ko'))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname
    if (url.origin !== origin) {
      wire.outgoing.push(url.origin)
      return route.fulfill({ contentType: 'text/html', body: '<p>Synthetic consent</p>' })
    }
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html',
      body: '<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="fixture"></div></body></html>' })
    if (!path.startsWith('/api/')) return route.continue()
    wire.calls.push(`${request.method()} ${path}`)
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
    if (path === '/api/v1/auth/session' || path === '/api/v1/auth/csrf') {
      if (wire.denySession) return route.fulfill({ status: 401, headers, body: JSON.stringify({
        meta: { apiContractVersion: '0.1.0', resourceRevision: null, requestId: 'req_gate_native_0001', traceId: 'trace_gate_native_0001' },
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic missing session' } }) })
      const isSession = path.endsWith('/session')
      if (isSession) headers.ETag = '"gate_native_session_0001"'
      return route.fulfill({ headers, body: JSON.stringify({ meta: { apiContractVersion: '0.1.0',
        resourceRevision: isSession ? '1' : null, requestId: 'req_gate_native_0001', traceId: 'trace_gate_native_0001' },
        data: isSession ? { sessionId: scope, state: wire.session, revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
          : { csrfToken: 'synthetic_gate_native_csrf', expiresAt: '2030-01-01T12:00:00Z' } }) })
    }
    let data: unknown
    if (path === prefix && request.method() === 'GET') data = { connections: wire.connected
      ? [{ connectionId, exchangeId: 'gate', environment: 'production', status: 'CONNECTED' }] : [] }
    else if (path === prefix + '/transactions' && request.method() === 'POST') {
      wire.starts++; wire.csrf.push(request.headers()['x-csrf-token'])
      expect(request.postDataJSON()).toEqual({ apiContractVersion: '0.23.0', environment: 'production' })
      if (wire.denyStart) return route.fulfill({ status: 503, headers,
        body: JSON.stringify({ apiContractVersion: '0.23.0', error: { code: 'PROVIDER_UNAVAILABLE' } }) })
      data = { transactionId, exchangeId: 'gate', environment: 'production', status: 'AUTH_PENDING',
        authorizationUrl, expiresAtMs: clock.getTime() + 300_000 }
    } else if (path === `${prefix}/transactions/${transactionId}` && request.method() === 'GET') {
      wire.gets++
      if (wire.holdGet) { wire.held = true; await new Promise<void>(resolve => { wire.release = resolve }) }
      data = { transactionId, exchangeId: 'gate', environment: 'production', status: wire.status,
        connectionId: wire.status === 'CONNECTED' ? connectionId : null,
        reason: wire.status === 'HOLD' ? 'PROVIDER_OWNER_ATTEMPT_UNCERTAIN' : wire.status === 'FAILED_NO_RETRY' ? 'PROVIDER_FAILED' : null,
        reconciliationRequired: wire.status === 'HOLD' }
    } else if (path === `${prefix}/transactions/${transactionId}/cancel` && request.method() === 'POST') {
      wire.cancels++; wire.csrf.push(request.headers()['x-csrf-token'])
      expect(request.postDataJSON()).toEqual({ apiContractVersion: '0.23.0' })
      wire.status = 'CANCELLED'
      data = { transactionId, exchangeId: 'gate', environment: 'production', status: 'CANCELLED', connectionId: null, reason: null, reconciliationRequired: false }
    } else throw new Error(`Unexpected scoped API ${request.method()} ${path}`)
    return route.fulfill({ headers, body: JSON.stringify({ apiContractVersion: '0.23.0', data }) })
  })
  return wire
}

async function loadModules(page: Page) {
  await page.evaluate(async () => {
    const refreshPath = '/@react-refresh', refresh = (await import(/* @vite-ignore */ refreshPath)).default
    refresh.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const path = '/src/exchange-connect/use-gate-broker-connection.ts'
    const module = await import(/* @vite-ignore */ path)
    Reflect.set(window, 'gateModule', module)
  })
}
async function mountController(page: Page) {
  await page.goto('/gate-native-fixture')
  await loadModules(page)
  await page.evaluate(async ({ scope }) => {
    const gate = Reflect.get(window, 'gateModule')
    const clientPath = '/src/internal-poc/contracts/generated/api-v0.23/client.ts', apiPath = '/src/exchange-connect/gate-broker-api.ts'
    const sdk = await import(/* @vite-ignore */ clientPath), api = await import(/* @vite-ignore */ apiPath)
    Reflect.set(window, 'gateOwner', scope)
    Reflect.set(window, 'gateNavigations', [])
    const controller = gate.createGateBrokerConnectionController(scope, 'production', {
      api: api.createGateBrokerApi(new sdk.TesiaGateBrokerV23Client(api.createGateBrokerTransport())),
      currentSession: async () => ({ sessionId: Reflect.get(window, 'gateOwner'), state: 'AUTHENTICATED' }),
      csrf: async () => 'synthetic_gate_native_csrf', storage: sessionStorage,
      navigate: (url: string) => Reflect.get(window, 'gateNavigations').push(url),
      text: (key: string) => key, onChange: (value: unknown) => Reflect.set(window, 'gateSnapshot', value),
      automaticPolling: true,
    })
    Reflect.set(window, 'gateController', controller)
    await controller.load()
  }, { scope })
}
const action = (page: Page, method: string, argument?: string) => page.evaluate(async ({ method, argument }) => {
  await Reflect.get(window, 'gateController')[method](argument)
}, { method, argument })
const view = (page: Page) => page.evaluate(() => Reflect.get(window, 'gateSnapshot') ?? null)

test('single start preserves opaque intent, SDK CSRF and reload observes the same pending request', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  await mountController(page)
  await action(page, 'connect')
  expect(wire.starts).toBe(1); expect(wire.csrf).toEqual(['synthetic_gate_native_csrf'])
  const storage = await page.evaluate(() => sessionStorage.getItem('tesia.native.gate-broker-transaction'))
  for (const value of ['authorizationUrl', 'synthetic-client', 'synthetic_gate_native_csrf', 'access', 'refresh_token', 'state']) expect(storage).not.toContain(value)
  expect(JSON.parse(storage!).transactionId).toBe(transactionId)
  await action(page, 'connect')
  expect(wire.starts).toBe(1)
  await mountController(page)
  expect(wire.starts).toBe(1)
  const snapshot = await view(page)
  expect(snapshot.connected).toBe(false); expect(snapshot.connection.state.kind).toBe('exchange')
  expect(snapshot.connection.state.exchanges.map((item: { id: string }) => item.id)).toEqual(['refresh', 'cancel'])
  await page.clock.fastForward(20_000)
  expect(wire.gets).toBe(2)
})

test('cancel is single-flight and a late observation cannot restore cancelled state', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  await mountController(page); await action(page, 'connect')
  wire.holdGet = true
  const read = action(page, 'refresh')
  await expect.poll(() => wire.held).toBe(true)
  wire.holdGet = false
  await Promise.all([action(page, 'cancel'), action(page, 'cancel')])
  wire.release(); await read
  expect(wire.cancels).toBe(1)
  expect((await view(page)).requested).toBe(false)
  expect(await page.evaluate(() => sessionStorage.getItem('tesia.native.gate-broker-transaction'))).toBeNull()
  await action(page, 'connect')
  expect(wire.starts).toBe(2)
})

test('owner changes and retired controls reject late responses without a new start', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  await mountController(page); await action(page, 'connect')
  wire.holdGet = true
  const read = action(page, 'refresh')
  await expect.poll(() => wire.held).toBe(true)
  await page.evaluate(() => Reflect.set(window, 'gateOwner', 'session_gate_foreign_owner_0001'))
  wire.release(); await read
  expect(await view(page)).toBeNull()
  await action(page, 'connect'); expect(wire.starts).toBe(1)
  await action(page, 'dispose'); await action(page, 'connect'); expect(wire.starts).toBe(1)
})

test('failed start survives reload without automatic retry and HOLD is never connected', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  await mountController(page); wire.denyStart = true
  await action(page, 'connect'); await action(page, 'connect')
  await mountController(page); await action(page, 'connect')
  expect(wire.starts).toBe(1); expect((await view(page)).connected).toBe(false)
  await page.evaluate(() => sessionStorage.removeItem('tesia.native.gate-broker-transaction'))
  wire.denyStart = false; wire.status = 'HOLD'
  await mountController(page); await action(page, 'load', transactionId)
  const snapshot = await view(page)
  expect(snapshot.connected).toBe(false); expect(snapshot.connection.state.description).toBe('failed')
  expect(snapshot.connection.state.exchanges.map((item: { id: string }) => item.id)).toEqual(['refresh'])
  expect(wire.cancels).toBe(0)
})

test('polling is GET-only and bounded', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  wire.status = 'PROCESSING'
  await mountController(page); await action(page, 'connect'); await action(page, 'refresh')
  await page.clock.fastForward(301_000)
  const reads = wire.gets
  await page.clock.fastForward(20_000)
  expect(wire.gets).toBe(reads); expect(wire.starts).toBe(1); expect(wire.cancels).toBe(0)
})

test('real hook default and anonymous opt-in have no Gate I/O, and stale hook actions cannot switch owners', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  await page.goto('/gate-native-fixture'); await loadModules(page)
  await page.evaluate(async ({ scope }) => {
    const path = '/src/exchange-connect/use-gate-broker-connection.ts', source = await (await fetch(path)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('React source missing')
    const module = await import(/* @vite-ignore */ reactPath), React = module.default ?? module
    const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */ domPath)
    const gate = Reflect.get(window, 'gateModule')
    function Host() {
      const [owner, setOwner] = React.useState(scope), [authenticated, setAuthenticated] = React.useState(false), [enabled, setEnabled] = React.useState(false)
      const value = gate.useGateBrokerConnection(owner, authenticated, enabled)
      Reflect.set(window, 'gateHookControls', { setOwner, setAuthenticated, setEnabled, value })
      return React.createElement('output', { id: 'hook-status' }, JSON.stringify(value ?? null))
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(React.createElement(React.StrictMode, null, React.createElement(Host)))
  }, { scope })
  await expect(page.locator('#hook-status')).toHaveText('null')
  await page.evaluate(() => Reflect.get(window, 'gateHookControls').setEnabled(true))
  await page.clock.fastForward(3_000); expect(wire.calls).toEqual([])
  await page.evaluate(() => Reflect.get(window, 'gateHookControls').setAuthenticated(true))
  await expect.poll(() => wire.calls.filter(call => call === 'GET ' + prefix).length).toBeGreaterThan(0)
  await expect(page.locator('#hook-status')).not.toHaveText('null')
  await page.evaluate(() => {
    Reflect.set(window, 'staleGateAction', Reflect.get(window, 'gateHookControls').value.connect)
    Reflect.get(window, 'gateHookControls').setOwner('session_gate_foreign_owner_0001')
  })
  await expect(page.locator('#hook-status')).toHaveText('null')
  await page.evaluate(async () => { await Reflect.get(window, 'staleGateAction')() })
  expect(wire.starts).toBe(0)
})

test('Native callback uses current session only, restores pending UI and missing session never bootstraps', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  const mount = async () => {
    await page.goto(callback); await loadModules(page)
    await page.evaluate(async () => {
      const reactPath = '/@id/react', domPath = '/@id/react-dom/client', appPath = '/src/internal-poc/NativeServiceApp.tsx', routerPath = '/src/components/SiteRouter.tsx'
      const module = await import(/* @vite-ignore */ reactPath), React = module.default ?? module
      const DOM = await import(/* @vite-ignore */ domPath), App = await import(/* @vite-ignore */ appPath), Router = await import(/* @vite-ignore */ routerPath)
      ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(
        React.createElement(Router.SiteRouter, { service: true }, React.createElement(App.NativeServiceApp, { naturalLoginFlow: true })))
    })
  }
  await mount()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await expect(page.getByRole('heading', { name: 'Gate 연결 확인 중', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '다시 확인', exact: true })).toBeVisible()
  expect(wire.gets).toBe(1); expect(wire.starts).toBe(0)
  await expect(page.locator('body')).not.toContainText('TOKEN_RECEIVED')
  await page.reload(); await loadModules(page)
  wire.denySession = true
  await mount()
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'error')
  expect(wire.calls.filter(call => call.startsWith('POST '))).toEqual([])
})

test('Native original plan free Gate account authorize starts API23 and callback reload restores pending', async ({ page, baseURL }) => {
  test.setTimeout(30_000)
  const wire = await fixture(page, baseURL)
  const mount = async (path: string) => {
    await page.goto(path); await loadModules(page)
    await page.evaluate(async () => {
      const reactPath = '/@id/react', domPath = '/@id/react-dom/client', appPath = '/src/internal-poc/NativeServiceApp.tsx', routerPath = '/src/components/SiteRouter.tsx'
      const module = await import(/* @vite-ignore */ reactPath), React = module.default ?? module
      const DOM = await import(/* @vite-ignore */ domPath), App = await import(/* @vite-ignore */ appPath), Router = await import(/* @vite-ignore */ routerPath)
      ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(
        React.createElement(Router.SiteRouter, { service: true }, React.createElement(App.NativeServiceApp, { naturalLoginFlow: true })))
    })
    await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  }
  await mount('/')
  await page.getByRole('complementary', { name: 'TETH 메뉴', exact: true }).getByRole('button', { name: '거래소 연결', exact: true }).click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await page.getByRole('group', { name: '거래소', exact: true }).getByRole('button', { name: 'Gate', exact: true }).click()
  await page.getByRole('button', { name: '기존 초대 계정 연결', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Gate 연결', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gate에서 승인하기', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Gate에서 승인하기', exact: true }).click()
  await expect.poll(() => wire.starts).toBe(1)
  await expect.poll(() => wire.outgoing.length).toBe(1)
  expect(wire.calls.filter(call => call.includes('/exchange-connections/'))).toEqual([])
  await mount(callback)
  await expect(page.getByRole('heading', { name: 'Gate 연결 확인 중', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '연결 취소', exact: true }).click()
  await expect.poll(() => wire.cancels).toBe(1)
  await expect(page.getByRole('heading', { name: 'Gate 연결 확인 중', exact: true })).not.toBeVisible()
  expect(wire.csrf).toEqual(['synthetic_gate_native_csrf', 'synthetic_gate_native_csrf'])
})

test('Native disabled Gate port keeps the original approve button disabled without Gate I/O', async ({ page, baseURL }) => {
  const wire = await fixture(page, baseURL)
  await page.route('**/src/internal-poc/NativeServiceApp.tsx', async route => {
    const response = await route.fetch(), source = await response.text()
    const flag = 'import.meta.env.VITE_TETH_GATE_BROKER_ENABLED'
    expect(source.split(flag)).toHaveLength(2)
    await route.fulfill({ response, contentType: 'application/javascript', body: source.replace(flag, '"false"') })
  })
  await page.goto('/'); await loadModules(page)
  await page.evaluate(async () => {
    const reactPath = '/@id/react', domPath = '/@id/react-dom/client', appPath = '/src/internal-poc/NativeServiceApp.tsx', routerPath = '/src/components/SiteRouter.tsx'
    const module = await import(/* @vite-ignore */ reactPath), React = module.default ?? module
    const DOM = await import(/* @vite-ignore */ domPath), App = await import(/* @vite-ignore */ appPath), Router = await import(/* @vite-ignore */ routerPath)
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(
      React.createElement(Router.SiteRouter, { service: true }, React.createElement(App.NativeServiceApp, { naturalLoginFlow: true })))
  })
  await expect(page.locator('.client-service-app')).toHaveAttribute('data-service-phase', 'ready')
  await page.getByRole('complementary', { name: 'TETH 메뉴', exact: true }).getByRole('button', { name: '거래소 연결', exact: true }).click()
  await page.getByRole('button', { name: '무료로 시작하기', exact: true }).click()
  await page.getByRole('group', { name: '거래소', exact: true }).getByRole('button', { name: 'Gate', exact: true }).click()
  await page.getByRole('button', { name: '기존 초대 계정 연결', exact: true }).click()
  const button = page.getByRole('button', { name: 'Gate에서 승인하기', exact: true })
  await expect(button).toBeDisabled()
  await button.evaluate(node => (node as HTMLButtonElement).click())
  expect(wire.calls.filter(call => call.includes('/gate-broker-connections'))).toEqual([])
  expect(wire.starts).toBe(0); expect(wire.outgoing).toEqual([])
})
