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
async function mount(page: Page, baseURL: string | undefined, options: { enabled?: boolean; authenticated?: boolean; callback?: boolean; connected?: boolean; holdInitialCatalog?: boolean; holdConnections?: boolean; service?: boolean; transactionFailed?: boolean; allowed?: boolean; holdAccount?: boolean } = {}) {
  if (!baseURL) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const wire = { owner, revision: '1', sessionState: 'AUTHENTICATED', failNextSession: 0, denySession: false, holdNextSession: false, sessionHeld: false, releaseSession: () => {}, churnRevision: false, churnBinding: false, permissionsVerified: true, unavailableBalances: false, unavailablePositions: false,
    accountValue: '9007199254740993.000000000000000001', accountReads: 0, accountError: 0, holdNextAccount: options.holdAccount ?? false, accountHeld: false, releaseAccount: () => {}, connected: options.connected ?? false, allowed: options.allowed ?? true, reads: 0, starts: 0, cancels: 0,
    api: [] as string[], outbound: [] as string[], bodies: [] as unknown[], held: false, failConnections: false, denyConnections: false, holdDisconnect: false, invalidPermission: false, transactionFailed: options.transactionFailed ?? false,
    holdNextSnapshot: false, holdSnapshotAtRead: 0, connectionReads: 0, snapshotHeld: false, releaseSnapshot: () => {},
    release: () => {}, releaseCatalog: () => {}, releaseConnections: () => {}, releaseDisconnect: () => {} }
  const initialCatalog = options.holdInitialCatalog ? new Promise<void>(resolve => { wire.releaseCatalog = resolve }) : Promise.resolve()
  const connectionsBarrier = options.holdConnections ? new Promise<void>(resolve => { wire.releaseConnections = resolve }) : Promise.resolve()
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
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="fixture"></div></body></html>' })
    if (!path.startsWith('/api/')) return route.continue()
    wire.api.push(`${request.method()} ${path}`)
    let data: unknown
    let version = '0.12.0'
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    if (path === '/api/v1/auth/session') {
      if (wire.holdNextSession) {
        wire.holdNextSession = false; wire.sessionHeld = true
        await new Promise<void>(resolve => { wire.releaseSession = resolve })
      }
      if (wire.failNextSession > 0) { wire.failNextSession--; return route.abort('failed') }
      if (wire.denySession) return route.fulfill({ status: 401, headers, body: JSON.stringify({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session refusal' }, meta: {
        apiContractVersion: '0.1.0', resourceRevision: null, requestId: 'req_operating_fixture_001', traceId: 'trace_operating_fixture_001' } }) })
      version = '0.1.0'; headers.ETag = '"operating_bitget_fixture_etag_001"'
      data = { sessionId: wire.owner, state: wire.sessionState, revision: wire.revision, issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' }
    } else if (path === '/api/v1/auth/csrf') {
      version = '0.1.0'; data = { csrfToken: 'csrf_operating_fixture_001', expiresAt: '2030-01-01T12:00:00Z' }
    } else if (path === '/api/v1/exchange-connections/catalog') {
      await initialCatalog
      data = { providers: ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'].map(exchangeId => ({ exchangeId,
        available: exchangeId !== 'bitget' || wire.allowed, reason: exchangeId !== 'bitget' || wire.allowed ? null : 'PROVIDER_UNAVAILABLE' })) }
    }
    else if (path === '/api/v1/exchange-connections/' && request.method() === 'GET') {
      wire.connectionReads++
      await connectionsBarrier
      if (wire.failConnections) return route.abort('failed')
      if (wire.denyConnections) return route.fulfill({ status: 401, headers, body: JSON.stringify({ apiContractVersion: '0.12.0', error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic authentication refusal' } }) })
      data = { connections: wire.connected ? [{ ...linked, permissionsVerified: wire.permissionsVerified,
        connectedAt: wire.churnBinding ? new Date(Date.UTC(2030, 0, 1, 0, 1, wire.connectionReads)).toISOString() : linked.connectedAt,
        permissions: { ...linked.permissions, withdrawal: wire.invalidPermission } }, { ...linked, connectionId: 'connection_foreign_provider_001', exchangeId: 'bybit' }] : [] }
      if (wire.holdNextSnapshot || wire.holdSnapshotAtRead === wire.connectionReads) {
        wire.holdNextSnapshot = false; wire.snapshotHeld = true
        await new Promise<void>(resolve => { wire.releaseSnapshot = resolve })
      }
    } else if (path === `/api/v1/exchange-connections/${connectionId}/account` && request.method() === 'GET') {
      wire.accountReads++
      if (wire.churnRevision) wire.revision = String(Number(wire.revision) + 1)
      const value = wire.accountValue
      version = '0.17.0'
      if (wire.holdNextAccount) {
        wire.holdNextAccount = false; wire.accountHeld = true
        await new Promise<void>(resolve => { wire.releaseAccount = resolve })
      }
      if (wire.accountError) return route.fulfill({ status: wire.accountError, headers, body: JSON.stringify({ apiContractVersion: version, error: {
        code: ({ 401: 'AUTHENTICATION_REQUIRED', 403: 'PERMISSION_REJECTED', 404: 'NOT_FOUND', 429: 'RATE_LIMITED', 502: 'PROVIDER_FAILED' } as Record<number, string>)[wire.accountError], message: 'Synthetic account refusal' } }) }).catch(() => undefined)
      data = { connectionId, exchangeId: 'bitget', observedAt: '2030-01-01T00:01:01Z', accountMode: 'classic',
        products: ['spot', 'USDT-FUTURES', 'USDC-FUTURES', 'COIN-FUTURES'].map(product => ({ product,
          balances: wire.unavailableBalances && product === 'USDC-FUTURES' ? { status: 'unavailable', reason: 'PROVIDER_FAILED', items: [] }
            : { status: 'ok', reason: null, items: product === 'spot' ? [{ coin: 'BTC', equity: value, balance: value, available: value, frozen: null, locked: null, unrealizedPnl: null }] : [] },
          positions: wire.unavailablePositions && product === 'USDC-FUTURES' ? { status: 'unavailable', reason: 'RATE_LIMITED', items: [] }
            : { status: product === 'spot' ? 'not_applicable' : 'ok', reason: null, items: product === 'USDT-FUTURES' ? [{ symbol: 'BTCUSDT', side: 'short', quantity: '0.000000000000000001', entryPrice: '98765.000000001', markPrice: null, unrealizedPnl: '-0.000000000000001', marginCoin: 'USDT' }] : [] } })) }
    } else if (path === `/api/v1/exchange-connections/${connectionId}` && request.method() === 'DELETE') {
      if (wire.holdDisconnect) await new Promise<void>(resolve => { wire.releaseDisconnect = resolve })
      wire.connected = false; data = { connectionId, status: 'disconnected', revocation: 'local_only' }
    }
    else if (path === '/api/v1/exchange-connections/transactions' && request.method() === 'POST') {
      wire.starts++; wire.bodies.push(request.postDataJSON()); data = pending
    } else if (path === `/api/v1/exchange-connections/transactions/${transactionId}` && request.method() === 'GET') {
      wire.reads++
      if (wire.held) await new Promise<void>(resolve => { wire.release = resolve })
      data = wire.transactionFailed ? { ...pending, status: 'failed', authorizationUrl: null, failureCode: 'PROVIDER_FAILED' }
        : wire.connected ? { ...pending, status: 'connected', authorizationUrl: null, connectionId } : { ...pending, authorizationUrl: null }
    } else if (path === `/api/v1/exchange-connections/transactions/${transactionId}` && request.method() === 'DELETE') {
      wire.cancels++; data = { ...pending, status: 'cancelled', authorizationUrl: null }
    } else throw new Error(`Unexpected synthetic API: ${request.method()} ${path}`)
    const body = version === '0.1.0' ? { meta: { apiContractVersion: version, resourceRevision: path.endsWith('/session') ? wire.revision : null,
      requestId: 'req_operating_fixture_001', traceId: 'trace_operating_fixture_001' }, data } : { apiContractVersion: version, data }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) }).catch(() => undefined)
  })
  await page.goto(options.callback ? `/auth/complete#exchange-transaction=${transactionId}` : options.service ? '/#/trade' : '/operating-bitget-fixture')
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
    const appPath = '/src/internal-poc/NativeServiceApp.tsx', routerPath = '/src/components/SiteRouter.tsx'
    const App = options.service ? await import(/* @vite-ignore */appPath) : undefined
    const Router = options.service ? await import(/* @vite-ignore */routerPath) : undefined
    function Host() {
      const [scope, setScope] = React.useState('session_operating_bitget_fixture_001')
      const [enabled, setEnabled] = React.useState(options.enabled)
      const [authenticated, setAuthenticated] = React.useState(options.authenticated ?? true)
      const value = useBitgetCanaryPresentation(scope, authenticated, enabled)
      Reflect.set(window, 'operatingControls', { setScope, setEnabled, setAuthenticated, value })
      return React.createElement(React.Fragment, null,
        React.createElement('output', { id: 'status', hidden: true }, JSON.stringify({ scope: value?.scope,
          broker: value?.broker, connection: value?.connection, account: value?.account })),
        App && Router ? React.createElement(Router.SiteRouter, { service: true }, React.createElement(App.NativeServiceApp,
          { naturalLoginFlow: true, bitgetCanaryEnabled: true })) : null)
    }
    ;(DOM.createRoot ?? DOM.default.createRoot)(document.getElementById('fixture')).render(React.createElement(React.StrictMode, null, React.createElement(Host)))
  }, options)
  return wire
}
const act = (page: Page, expression: string) => page.evaluate(expression)
const status = (page: Page) => page.locator('#status')
const control = '(window.operatingControls)'

test('validated account GET fills coin rows and exchange positions without starting OAuth', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('9007199254740993.000000000000000001 BTC')
  expect(await act(page, `${control}.value.account.ledger.pos[0]`)).toMatchObject({ origin: 'exchange', cells: { strategy: '—', current: '—', quantity: '0.000000000000000001' } })
  expect(await act(page, `${control}.value.account.strategies`)).toBeNull()
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('actual NativeServiceApp displays observed balances and positions in its existing panes', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, service: true })
  const app = page.locator('.client-service-app')
  await expect(app).toHaveAttribute('data-service-phase', 'ready')
  await expect(app.locator('[data-native-ledger="pos"]')).toContainText('BTCUSDT')
  await expect(app.locator('[data-native-ledger="pos"]')).toContainText('0.000000000000000001')
  await app.locator('.ctt-bottom-tabs [data-tab-id="assets"]').click()
  await expect(app.locator('[data-native-ledger="assets"]')).toContainText(`${wire.accountValue} BTC`)
  await expect(app.locator('[data-native-ledger="assets"]')).toContainText('spot · BTC')
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('exchange positions stay out of a selected TETH strategy and remain visible in account-wide scope', async ({ page, baseURL }) => {
  await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('9007199254740993.000000000000000001 BTC')
  await page.evaluate(async () => {
    const path = '/src/internal-poc/NativeTradingWorkspace.tsx', source = await (await fetch(path)).text()
    const reactPath = source.match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const module = await import(/* @vite-ignore */reactPath), React = module.default ?? module
    const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */domPath)
    const { NativeTradingWorkspace } = await import(/* @vite-ignore */path)
    const supplied = Reflect.get(window, 'operatingControls').value.account
    const fixture = document.createElement('div'); fixture.id = 'strategy-filter-fixture'; document.body.append(fixture)
    const presentation = { ...supplied, strategies: [{ accountId: supplied.accounts[0].id,
      strategy: { id: 'supplied-teth-strategy', name: 'Supplied TETH strategy', symbol: 'ETHUSDT', market: 'USDT', version: 'v1', status: 'off', exchange: { id: 'bitget', name: 'Bitget', color: '#26282c' }, capitalLabel: '—', pnlLabel: '—' },
      chart: null, agent: { events: [], sourceLabel: 'Supplied fixture' }, dashboard: null }], initialSelectedId: 'supplied-teth-strategy' }
    ;(DOM.createRoot ?? DOM.default.createRoot)(fixture).render(React.createElement(NativeTradingWorkspace, { accountScope: supplied.scope, presentation, onReturn: () => {}, onNew: () => {} }))
  })
  const workspace = page.locator('#strategy-filter-fixture')
  await expect(workspace.locator('.cat-scope select')).toHaveValue('current')
  await expect(workspace.locator('[data-native-ledger="pos"]')).not.toContainText('BTCUSDT')
  await workspace.locator('.cat-scope select').selectOption('all')
  await expect(workspace.locator('[data-native-ledger="pos"]')).toContainText('BTCUSDT')
  await workspace.locator('.cat-scope select').selectOption('current')
  await expect(workspace.locator('[data-native-ledger="pos"]')).not.toContainText('BTCUSDT')
})

test('disabled and anonymous hooks cannot initiate account reads', async ({ page, baseURL }) => {
  for (const options of [{ enabled: false, authenticated: true }, { enabled: true, authenticated: false }]) {
    const wire = await mount(page, baseURL, { ...options, connected: true })
    await page.clock.runFor(30_000)
    expect(wire.accountReads).toBe(0); expect(wire.api).toEqual([]); expect(wire.starts).toBe(0)
  }
})

test('refresh waits fifteen seconds after completion and never overlaps provider reads', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdAccount: true })
  await expect.poll(() => wire.accountHeld).toBe(true)
  await page.clock.runFor(16_000)
  expect(wire.accountReads).toBe(1)
  wire.releaseAccount()
  await expect(status(page)).toContainText(wire.accountValue)
  await page.clock.runFor(14_000)
  expect(wire.accountReads).toBe(1)
  await page.clock.runFor(1_100)
  await expect.poll(() => wire.accountReads).toBe(2)
  expect(wire.starts).toBe(0)
})

test('whole getter failure clears financial facts and preserves connection metadata', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.accountError = 502
  await page.clock.runFor(15_100)
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.accounts[0].id`)).toBe(connectionId)
  wire.accountError = 0; wire.accountValue = '7.0001'
  await page.clock.runFor(15_100)
  await expect(status(page)).toContainText('7.0001 BTC')
})

test('account 401 clears the presentation and stops background retries', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.accountError = 401
  await page.clock.runFor(15_100)
  await expect.poll(() => act(page, `${control}.value.account`)).toBeUndefined()
  const reads = wire.accountReads
  await page.clock.runFor(60_000)
  expect(wire.accountReads).toBe(reads)
})

test('logout aborts the in-flight snapshot and its late completion cannot restore account facts', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdAccount: true })
  await expect.poll(() => wire.accountHeld).toBe(true)
  await act(page, `${control}.setAuthenticated(false)`)
  await expect(status(page)).toHaveText('{}')
  wire.releaseAccount(); await page.clock.runFor(30_000)
  await expect(status(page)).toHaveText('{}')
  expect(wire.starts).toBe(0)
})

test('session revision change discards the old snapshot and recovers with a newly bound read', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdAccount: true })
  await expect.poll(() => wire.accountHeld).toBe(true)
  wire.revision = '2'; wire.accountValue = '2.000000000000000002'; wire.releaseAccount()
  await expect(status(page)).toContainText('2.000000000000000002 BTC')
  await expect(status(page)).not.toContainText('9007199254740993.000000000000000001')
  expect(wire.accountReads).toBe(2)
  await page.clock.runFor(15_100)
  await expect.poll(() => wire.accountReads).toBe(3)
})

for (const change of ['owner', 'locale'] as const) test(`${change} change discards old response even when the new response arrives first`, async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdAccount: true })
  await expect.poll(() => wire.accountHeld).toBe(true)
  wire.accountValue = '2.000000000000000001'
  if (change === 'owner') { wire.owner = 'session_account_read_replacement_001'; await act(page, `${control}.setScope('${wire.owner}')`) }
  else await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language', 'en') })
  await expect(status(page)).toContainText('2.000000000000000001 BTC')
  wire.releaseAccount(); await page.clock.runFor(100)
  await expect(status(page)).not.toContainText('9007199254740993.000000000000000001')
  expect(wire.starts).toBe(0)
})

test('confirmed disconnect invalidates a held financial read before it can refill the ledger', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdAccount: true })
  await expect.poll(() => wire.accountHeld).toBe(true)
  await act(page, `${control}.value.account.actions.onConnect()`)
  await expect(status(page)).toContainText('"connection"')
  await act(page, `${control}.value.connection.state.connectionList.accounts[0].onDisconnect()`)
  await expect.poll(() => act(page, `${control}.value.account.accounts`)).toEqual([])
  wire.releaseAccount(); await page.clock.runFor(100)
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.ledger.pos`)).toBeNull()
  expect(wire.starts).toBe(0)
})

test('external connection removal discovered after provider I/O discards its balances', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdAccount: true })
  await expect.poll(() => wire.accountHeld).toBe(true)
  wire.connected = false; wire.releaseAccount()
  await expect.poll(() => act(page, `${control}.value.account.accounts`)).toEqual([])
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(wire.starts).toBe(0)
})

test('mixed successful and unavailable products never imply a complete financial pane', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.unavailableBalances = true; wire.unavailablePositions = true
  await page.clock.runFor(15_100)
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.ledger.pos`)).toBeNull()
  expect(await act(page, `${control}.value.account.accounts[0].id`)).toBe(connectionId)
})

test('transient session transport failure preserves metadata, clears facts and recovers without OAuth', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.failNextSession = 1; wire.accountValue = '3.000000000000000003'
  await page.clock.runFor(15_100)
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.accounts[0].id`)).toBe(connectionId)
  expect(wire.accountReads).toBe(1)
  await page.clock.runFor(15_100)
  await expect(status(page)).toContainText('3.000000000000000003 BTC')
  expect(wire.accountReads).toBe(2); expect(wire.starts).toBe(0)
})

test('repeated transient failures back off fifteen, thirty and sixty seconds without overlapping reads', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.failNextSession = 3
  await page.clock.runFor(15_100)
  await expect.poll(() => wire.failNextSession).toBe(2)
  await page.clock.runFor(15_100)
  await expect.poll(() => wire.failNextSession).toBe(1)
  await page.clock.runFor(29_000)
  expect(wire.failNextSession).toBe(1)
  await page.clock.runFor(1_200)
  await expect.poll(() => wire.failNextSession).toBe(0)
  await page.clock.runFor(59_000)
  expect(wire.accountReads).toBe(1)
  await page.clock.runFor(1_200)
  await expect.poll(() => wire.accountReads).toBe(2)
  await expect(status(page)).toContainText(wire.accountValue)
  expect(wire.starts).toBe(0)
})

test('an absent authenticated session is authoritative and stops financial retry', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.sessionState = 'ANONYMOUS'; await page.clock.runFor(15_100)
  await expect.poll(() => act(page, `${control}.value.account`)).toBeUndefined()
  await page.clock.runFor(60_000)
  expect(wire.accountReads).toBe(1)
})

test('session 401 discards account presentation and cannot restart after background navigation', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.denySession = true; await page.clock.runFor(15_100)
  await expect.poll(() => act(page, `${control}.value.account`)).toBeUndefined()
  await page.evaluate(() => window.dispatchEvent(new Event('teth:navigate')))
  await page.clock.runFor(60_000)
  expect(await act(page, `${control}.value.account`)).toBeUndefined()
  expect(wire.accountReads).toBe(1)
})

test('navigation plus failed metadata refresh clears old facts and recovers the financial timer', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.failConnections = true
  await page.evaluate(() => window.dispatchEvent(new Event('teth:navigate')))
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.accounts[0].id`)).toBe(connectionId)
  await expect.poll(() => wire.connectionReads).toBeGreaterThanOrEqual(3)
  wire.failConnections = false; wire.accountValue = '4.000000000000000004'
  await page.clock.runFor(15_100)
  await expect(status(page)).toContainText('4.000000000000000004 BTC')
  expect(wire.starts).toBe(0)
})

test('a recovery timer from the previous owner cannot restore that owner’s observations', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.failNextSession = 1; await page.clock.runFor(15_100)
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  wire.owner = 'session_account_recovery_replacement_001'; wire.accountValue = '5.000000000000000005'
  await act(page, `${control}.setScope('${wire.owner}')`)
  await expect(status(page)).toContainText('5.000000000000000005 BTC')
  await page.clock.runFor(15_100)
  await expect(status(page)).not.toContainText('9007199254740993.000000000000000001')
  expect(await act(page, `${control}.value.scope`)).toBe(wire.owner)
})

for (const code of [403, 404]) test(`account ${code} revalidates authoritative connection metadata`, async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  const before = wire.connectionReads
  wire.accountError = code
  if (code === 404) wire.connected = false
  await page.clock.runFor(15_100)
  await expect.poll(() => wire.connectionReads).toBeGreaterThan(before)
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.accounts.length`)).toBe(code === 404 ? 0 : 1)
})

test('hidden tabs discard observations and stop polling, visibility resumes a fresh owner-bound read', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  const reads = wire.accountReads
  await page.clock.runFor(60_000)
  expect(wire.accountReads).toBe(reads)
  wire.accountValue = '6.000000000000000006'
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')) })
  await expect(status(page)).toContainText('6.000000000000000006 BTC')
  expect(wire.accountReads).toBe(reads + 1); expect(wire.starts).toBe(0)
})

for (const change of ['enabled', 'locale'] as const) test(`displayed financial facts are cleared across ${change} retirement before held session confirmation`, async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.holdNextSession = true
  if (change === 'enabled') {
    await act(page, `${control}.setEnabled(false)`)
    await expect(status(page)).toHaveText('{}')
    await act(page, `${control}.setEnabled(true)`)
  } else await page.evaluate(async () => { const path = '/src/client-preferences.ts'; (await import(/* @vite-ignore */path)).setClientPreference('language', 'en') })
  await expect.poll(() => wire.sessionHeld).toBe(true)
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.ledger.pos`)).toBeNull()
  expect(await act(page, `${control}.value.account.accounts[0].id`)).toBe(connectionId)
  wire.accountValue = '8.000000000000000008'; wire.releaseSession()
  await expect(status(page)).toContainText('8.000000000000000008 BTC')
  expect(wire.starts).toBe(0)
})

for (const churn of ['revision', 'binding'] as const) test(`continuous ${churn} churn allows one immediate rebind then bounded fifteen thirty sixty second retries`, async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdAccount: true })
  await expect.poll(() => wire.accountHeld).toBe(true)
  if (churn === 'revision') wire.churnRevision = true
  else wire.churnBinding = true
  if (churn === 'revision') wire.revision = '2'
  wire.releaseAccount()
  await expect.poll(() => wire.accountReads).toBeGreaterThanOrEqual(2)
  await page.clock.runFor(1000)
  expect(wire.accountReads).toBe(2)
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  await page.clock.runFor(13_000)
  expect(wire.accountReads).toBe(2)
  await page.clock.runFor(2_100)
  await expect.poll(() => wire.accountReads).toBe(3)
  await page.clock.runFor(29_000)
  expect(wire.accountReads).toBe(3)
  await page.clock.runFor(1_200)
  await expect.poll(() => wire.accountReads).toBe(4)
  await page.clock.runFor(59_000)
  expect(wire.accountReads).toBe(4)
  wire.churnRevision = false; wire.churnBinding = false; wire.accountValue = '9.000000000000000009'
  await page.clock.runFor(1_200)
  if (churn === 'binding') {
    // Restoring a stable tuple is one final mismatch; it retains the capped
    // delay instead of allowing another immediate provider-facing read.
    await expect.poll(() => wire.accountReads).toBe(5)
    await page.clock.runFor(60_100)
  }
  await expect(status(page)).toContainText('9.000000000000000009 BTC')
  const reads = wire.accountReads
  await page.clock.runFor(14_000)
  expect(wire.accountReads).toBe(reads)
  await page.clock.runFor(1_100)
  await expect.poll(() => wire.accountReads).toBe(reads + 1)
  expect(wire.starts).toBe(0)
})

test('a new financial refresh immediately clears older facts while the session query is held', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.holdNextSession = true; wire.revision = '2'
  await page.clock.runFor(15_100)
  await expect.poll(() => wire.sessionHeld).toBe(true)
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.ledger.pos`)).toBeNull()
  expect(wire.accountReads).toBe(1)
  wire.accountValue = '10.00000000000000001'; wire.releaseSession()
  await expect(status(page)).toContainText('10.00000000000000001 BTC')
})

test('an unverified connection keeps metadata without any account getter or OAuth retry', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdConnections: true })
  wire.permissionsVerified = false; wire.releaseConnections()
  await expect.poll(() => act(page, `${control}.value?.account?.accounts?.[0]?.id`)).toBe(connectionId)
  await page.clock.runFor(60_000)
  expect(wire.accountReads).toBe(0)
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(wire.starts).toBe(0)
})
