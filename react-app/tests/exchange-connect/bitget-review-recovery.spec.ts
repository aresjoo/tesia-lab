import { expect, test, type Page } from '@playwright/test'
import { accountObservationFailure } from '../../src/exchange-connect/account-presentation'
import type { AccountResponse } from '../../src/internal-poc/contracts/generated/api-v0.17/types.js'

// Real hook/controller/generated SDK, synthetic HTTP only. No vendor request,
// credentials, login, provider authorization or order is performed.
test.use({ trace: 'retain-on-failure', video: 'off' })
test.setTimeout(30_000)
const owner = 'session_operating_bitget_fixture_001', transactionId = 'transaction_operating_bitget_001', connectionId = 'connection_operating_bitget_001'
const pending = { transactionId, exchangeId: 'bitget', status: 'pending', expiresAt: '2030-01-01T00:10:00Z',
  authorizationUrl: 'https://www.bitget.com/account/oauth?state=synthetic', connectionId: null, failureCode: null }
const linked = { connectionId, exchangeId: 'bitget', status: 'connected', maskedAccountLabel: '***0001',
  connectedAt: '2030-01-01T00:01:00Z', permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false }, permissionsVerified: true }
async function mount(page: Page, baseURL: string | undefined, options: { enabled?: boolean; authenticated?: boolean; callback?: boolean; connected?: boolean; holdInitialCatalog?: boolean; holdConnections?: boolean; service?: boolean; workspace?: boolean; transactionFailed?: boolean; allowed?: boolean; holdAccount?: boolean; initialSessionFails?: number; cooldownMs?: number; denied?: boolean; initialGatewayCount?: number; sessionHtml?: boolean; sessionMalformed?: boolean } = {}) {
  if (!baseURL) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const wire = { owner, revision: '1', sessionState: 'AUTHENTICATED', failNextSession: options.initialSessionFails ?? 0, denySession: options.denied ?? false, sessionGatewayCount: options.initialGatewayCount ?? 0, sessionHtml: options.sessionHtml ?? false, sessionMalformed: options.sessionMalformed ?? false, transactionHtml: false, transactionMalformed: false, holdNextSession: false, sessionHeld: false, releaseSession: () => {}, churnRevision: false, churnBinding: false, permissionsVerified: true, unavailableBalances: false, unavailablePositions: false, sectionReason: 'PROVIDER_FAILED',
    accountValue: '9007199254740993.000000000000000001', accountReads: 0, accountError: 0, cooldownMs: options.cooldownMs ?? 0, serverNowMs: 0, lastAccountStart: -5_000, rateLimited: 0, holdNextAccount: options.holdAccount ?? false, accountHeld: false, releaseAccount: () => {}, connected: options.connected ?? false, allowed: options.allowed ?? true, reads: 0, starts: 0, cancels: 0,
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
      if (wire.sessionMalformed) return route.fulfill({ status: 200, headers, body: '{bad json' })
      if (wire.sessionGatewayCount > 0) {
        wire.sessionGatewayCount--
        return route.fulfill({ status: 503, headers: { ...headers, 'Content-Type': wire.sessionHtml ? 'text/html' : 'application/json' },
          body: wire.sessionHtml ? '<html>Gateway unavailable</html>' : JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Synthetic server unavailable' }, meta: { apiContractVersion: '0.1.0', resourceRevision: null, requestId: 'req_operating_fixture_001', traceId: 'trace_operating_fixture_001' } }) })
      }
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
      if (wire.cooldownMs && wire.serverNowMs < wire.lastAccountStart + wire.cooldownMs) {
        wire.rateLimited++
        return route.fulfill({ status: 429, headers, body: JSON.stringify({ apiContractVersion: '0.17.0', error: { code: 'RATE_LIMITED', message: 'Synthetic admission cooldown' } }) })
      }
      wire.lastAccountStart = wire.serverNowMs
      if (wire.churnRevision) wire.revision = String(Number(wire.revision) + 1)
      const value = wire.accountValue
      version = '0.17.0'
      if (wire.holdNextAccount) {
        wire.holdNextAccount = false; wire.accountHeld = true
        await new Promise<void>(resolve => { wire.releaseAccount = resolve })
      }
      if (wire.accountError) return route.fulfill({ status: wire.accountError, headers, body: JSON.stringify({ apiContractVersion: version, error: {
        code: ({ 401: 'AUTHENTICATION_REQUIRED', 403: 'PERMISSION_REJECTED', 422: 'PERMISSION_REJECTED', 404: 'NOT_FOUND', 429: 'RATE_LIMITED', 502: 'PROVIDER_FAILED' } as Record<number, string>)[wire.accountError], message: 'Synthetic account refusal' } }) }).catch(() => undefined)
      data = { connectionId, exchangeId: 'bitget', observedAt: '2030-01-01T00:01:01Z', accountMode: 'classic',
        products: ['spot', 'USDT-FUTURES', 'USDC-FUTURES', 'COIN-FUTURES'].map(product => ({ product,
          balances: wire.unavailableBalances && product === 'USDC-FUTURES' ? { status: 'unavailable', reason: wire.sectionReason, items: [] }
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
      if (wire.transactionHtml) { wire.transactionHtml = false; return route.fulfill({ status: 503, headers: { ...headers, 'Content-Type': 'text/html' }, body: '<html>Gateway unavailable</html>' }) }
      if (wire.transactionMalformed) return route.fulfill({ status: 200, headers, body: '{bad json' })
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
    const workspacePath = '/src/internal-poc/NativeTradingWorkspace.tsx'
    const Workspace = options.workspace ? await import(/* @vite-ignore */workspacePath) : undefined
    function Host() {
      const [scope, setScope] = React.useState('session_operating_bitget_fixture_001')
      const [enabled, setEnabled] = React.useState(options.enabled)
      const [authenticated, setAuthenticated] = React.useState(options.authenticated ?? true)
      const value = useBitgetCanaryPresentation(scope, authenticated, enabled)
      Reflect.set(window, 'operatingControls', { setScope, setEnabled, setAuthenticated, value })
      return React.createElement(React.Fragment, null,
        React.createElement('output', { id: 'status', hidden: true }, JSON.stringify({ scope: value?.scope,
          broker: value?.broker, connection: value?.connection, account: value?.account })),
        Workspace ? React.createElement(Workspace.NativeTradingWorkspace,
          { accountScope: scope, presentation: value?.account, onReturn: () => {}, onNew: () => {} }) : null,
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



// Synthetic server monotonic time and browser elapsed timers advance together;
// this is admission pacing, not UTC synchronisation or a provider clock claim.
test('initial transient session read recovers through bounded GETs without consent', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, initialSessionFails: 2 })
  await expect.poll(() => wire.failNextSession).toBe(0)
  await page.clock.runFor(1_100)
  await expect(status(page)).toContainText(wire.accountValue)
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('persistent initial transport failure exhausts finite retries and never starts OAuth', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, initialSessionFails: 100 })
  await expect.poll(() => wire.api.filter(item => item.endsWith('/auth/session')).length).toBeGreaterThanOrEqual(2)
  await expect.poll(() => wire.failNextSession).toBe(98)
  for (const [delay, remaining] of [[1_100, 97], [2_100, 96], [4_100, 95]]) {
    await page.clock.runFor(delay)
    await expect.poll(() => wire.failNextSession).toBe(remaining)
  }
  const reads = wire.api.length
  await page.clock.runFor(180_000)
  expect(wire.api.length).toBe(reads)
  expect(wire.accountReads).toBe(0); expect(wire.starts).toBe(0)
  expect(await act(page, `${control}.value`)).toBeUndefined()
})

test('definitive initial authentication and unavailable catalog stay closed', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, denied: true })
  await expect.poll(() => wire.api.length).toBeGreaterThanOrEqual(2)
  const reads = wire.api.length
  await page.clock.runFor(180_000)
  expect(wire.api.length).toBe(reads); expect(wire.accountReads).toBe(0)
  expect(await act(page, `${control}.value`)).toBeUndefined()
  wire.denySession = false; wire.allowed = false
  await act(page, `${control}.setEnabled(false)`); await act(page, `${control}.setEnabled(true)`)
  await expect.poll(() => wire.api.some(item => item.endsWith('/catalog'))).toBe(true)
  const catalogReads = wire.api.length
  await page.clock.runFor(180_000)
  expect(wire.api.length).toBe(catalogReads); expect(wire.starts).toBe(0)
  expect(await act(page, `${control}.value`)).toBeUndefined()
})

test('navigation invalidates immediately then paces next account read past five second admission', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, cooldownMs: 5_000 })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.serverNowMs = 1_000; await page.clock.runFor(1_000)
  await page.evaluate(() => window.dispatchEvent(new Event('teth:navigate')))
  await expect.poll(() => act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  await expect.poll(() => wire.connectionReads).toBeGreaterThan(2)
  expect(wire.accountReads).toBe(1)
  wire.serverNowMs = 6_100; await page.clock.runFor(5_100)
  await expect(status(page)).toContainText(wire.accountValue)
  expect(wire.accountReads).toBe(2); expect(wire.rateLimited).toBe(0)
  expect(wire.starts).toBe(0)
})

test('API17 permission advisory retains stored connection after metadata confirmation and clears on owner change', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  const metadataReads = wire.connectionReads; wire.accountError = 403
  await page.clock.runFor(15_100)
  await expect(status(page)).toContainText('계정 데이터 조회가 거부되었습니다')
  await expect.poll(() => wire.connectionReads).toBeGreaterThan(metadataReads)
  expect(await act(page, `${control}.value.account.accounts[0].id`)).toBe(connectionId)
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(wire.starts).toBe(0)
  wire.accountError = 0; wire.holdNextAccount = true
  wire.owner = 'session_other_verified_fixture_002'
  await act(page, `${control}.setScope('session_other_verified_fixture_002')`)
  await expect.poll(() => act(page, `${control}.value?.scope`)).toBe(wire.owner)
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.sourceLabel`)).not.toContain('거부되었습니다')
  wire.releaseAccount()
})

test('API17 rate rejection uses paced recovery and never requests new authorization', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.accountError = 429; await page.clock.runFor(15_100)
  await expect(status(page)).toContainText('계정 데이터 조회가 잠시 제한되었습니다')
  const reads = wire.accountReads; wire.accountError = 0
  await page.clock.runFor(5_100)
  await expect(status(page)).toContainText(wire.accountValue)
  expect(wire.accountReads).toBe(reads + 1); expect(wire.starts).toBe(0)
  expect(await act(page, `${control}.value.account.sourceLabel`)).not.toContain('제한되었습니다')
})

test('validated unsupported product reason supplies neutral advisory without inventing empty facts', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText(wire.accountValue)
  wire.unavailableBalances = true; wire.sectionReason = 'PROVIDER_UNAVAILABLE'
  await page.clock.runFor(15_100)
  await expect(status(page)).toContainText('일부 계정 데이터를 조회할 수 없습니다')
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(await act(page, `${control}.value.account.ledger.pos`)).not.toBeNull()
  expect(wire.starts).toBe(0)
})

test('exhausted initial transient burst recovers on visible return after service health returns', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, initialSessionFails: 100 })
  await expect.poll(() => wire.failNextSession).toBe(98)
  for (const [delay, remaining] of [[1_100, 97], [2_100, 96], [4_100, 95]]) {
    await page.clock.runFor(delay)
    await expect.poll(() => wire.failNextSession).toBe(remaining)
  }
  const reads = wire.api.length; await page.clock.runFor(60_000)
  expect(wire.api.length).toBe(reads); expect(await act(page, `${control}.value`)).toBeUndefined()
  wire.failNextSession = 0
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(status(page)).toContainText(wire.accountValue)
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('section advisory uses finite priority without mutating validated observations', () => {
  const observation: AccountResponse = { apiContractVersion: '0.17.0', data: {
    connectionId, exchangeId: 'bitget', observedAt: '2030-01-01T00:01:01Z', accountMode: 'classic',
    products: (['spot', 'USDT-FUTURES', 'USDC-FUTURES', 'COIN-FUTURES'] as const).map(product => ({ product,
      balances: { status: 'ok', reason: null, items: [] }, positions: { status: product === 'spot' ? 'not_applicable' : 'ok', reason: null, items: [] } })) } }
  expect(accountObservationFailure([observation])).toBeUndefined()
  const products = observation.data.products
  products[1].balances = { status: 'unavailable', reason: 'PROVIDER_FAILED', items: [] }
  products[2].balances = { status: 'unavailable', reason: 'PROVIDER_UNAVAILABLE', items: [] }
  products[3].positions = { status: 'unavailable', reason: 'RATE_LIMITED', items: [] }
  const before = JSON.stringify(observation)
  expect(accountObservationFailure([observation])).toBe('RATE_LIMITED')
  expect(JSON.stringify(observation)).toBe(before)
  products[0].balances = { status: 'unavailable', reason: 'PERMISSION_REJECTED', items: [] }
  expect(accountObservationFailure([observation])).toBe('PERMISSION_REJECTED')
})

for (const source of ['session-json', 'exchange-html'] as const) test(`Opus M1 actual SDK ${source}503 retains pending and GET recovery`, async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, callback: true })
  await expect.poll(() => wire.reads).toBe(1)
  if (source === 'session-json') wire.sessionGatewayCount = 1
  else wire.transactionHtml = true
  await page.clock.runFor(1_100)
  await expect.poll(() => act(page, `${control}.value?.connection?.state.id`)).toMatch(/^pending:/)
  await expect(status(page)).toContainText('연결 상태를 확인하지 못했습니다')
  await page.clock.runFor(1_100)
  await expect.poll(() => act(page, `${control}.value?.connection?.state.description`)).toBe('연결 결과를 확인하고 있습니다.')
  expect(wire.starts).toBe(0); expect(wire.cancels).toBe(0); expect(wire.outbound).toEqual([])
})

test('Opus M1 initial HTML503 uses actual session transport bounded recovery', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, initialGatewayCount: 2, sessionHtml: true })
  await expect.poll(() => wire.sessionGatewayCount).toBe(0)
  await page.clock.runFor(1_100)
  await expect(status(page)).toContainText(wire.accountValue)
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('Opus M1 malformed session JSON200 stays definitive even on visible return', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, sessionMalformed: true })
  await expect.poll(() => wire.api.length).toBeGreaterThanOrEqual(2)
  await page.clock.runFor(8_000); const reads = wire.api.length
  wire.sessionMalformed = false
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.clock.runFor(10_000)
  expect(wire.api.length).toBe(reads); expect(wire.accountReads).toBe(0); expect(wire.starts).toBe(0)
  expect(await act(page, `${control}.value`)).toBeUndefined()
})


test('Opus M1 transport opt-in is exact path GET status and leaves mutations and schemas strict', async ({ page, baseURL }) => {
  await mount(page, baseURL, { enabled: false })
  const results = await page.evaluate(async () => {
    const adapterPath = '/src/internal-poc/api-adapter.ts', exchangePath = '/src/exchange-connect/transport.ts'
    const { SameOriginApiTransport } = await import(/* @vite-ignore */ adapterPath)
    const { createExchangeConnectionsTransport } = await import(/* @vite-ignore */ exchangePath)
    const original = window.fetch
    let parsed = 0, status = 503, contentType = 'application/json', body = '{}'
    window.fetch = async input => {
      const response = new Response(body, { status, headers: { 'Content-Type': contentType } })
      Object.defineProperty(response, 'url', { value: new URL(String(input), window.location.origin).href })
      const json = response.json.bind(response)
      response.json = async () => { parsed++; return json() }
      return response
    }
    const normal = new SameOriginApiTransport(), recovery = new SameOriginApiTransport({ recoverSessionGatewayFailures: true })
    const invoke = async (transport: InstanceType<typeof SameOriginApiTransport>, path: string, method = 'GET') => {
      parsed = 0
      try { await transport.request(path, { method, headers: {} }); return { name: 'returned', parsed } }
      catch (error) { return { name: error instanceof Error ? error.name : 'unknown', parsed } }
    }
    try {
      const gateways = []
      for (status of [429, 500, 502, 503, 504]) gateways.push(await invoke(recovery, '/api/v1/auth/session'))
      status = 503
      const untouched = [await invoke(normal, '/api/v1/auth/session'), await invoke(recovery, '/api/v1/auth/session', 'POST'),
        await invoke(recovery, '/api/v1/auth/csrf'), await invoke(recovery, '/api/v1/auth/session?extra=1')]
      status = 401; const unauthorized = await invoke(recovery, '/api/v1/auth/session')
      status = 200; body = '{bad JSON'; const malformed = await invoke(recovery, '/api/v1/auth/session')
      status = 503; contentType = 'text/html'; body = '<html>Gateway unavailable</html>'
      const defaultHtml = await invoke(normal, '/api/v1/auth/session')
      const exchange = createExchangeConnectionsTransport()
      const exchangeGet = [], mutation = []
      for (status of [502, 503, 504]) {
        try { await exchange.request({ method: 'GET', path: '/api/v1/exchange-connections/catalog', headers: {} }); exchangeGet.push('returned') }
        catch (error) { exchangeGet.push(error instanceof Error ? error.name : 'unknown') }
      }
      status = 503
      for (const method of ['POST', 'DELETE'] as const) {
        const response = await exchange.request({ method, path: '/api/v1/exchange-connections/transactions/transaction_fixture_001', headers: {} })
        mutation.push({ status: response.status, body: response.body })
      }
      contentType = 'application/json'; body = '{bad JSON'
      const invalidJson = await exchange.request({ method: 'GET', path: '/api/v1/exchange-connections/catalog', headers: {} })
      return { gateways, untouched, unauthorized, malformed, defaultHtml, exchangeGet, mutation, invalidJson: { status: invalidJson.status, body: invalidJson.body } }
    } finally { window.fetch = original }
  })
  expect(results.gateways).toEqual(Array.from({ length: 5 }, () => ({ name: 'TypeError', parsed: 0 })))
  expect(results.untouched).toEqual(Array.from({ length: 4 }, () => ({ name: 'returned', parsed: 1 })))
  expect(results.unauthorized).toEqual({ name: 'returned', parsed: 1 })
  expect(results.malformed).toEqual({ name: 'SyntaxError', parsed: 1 })
  expect(results.defaultHtml).toEqual({ name: 'Error', parsed: 0 })
  expect(results.exchangeGet).toEqual(['TypeError', 'TypeError', 'TypeError'])
  expect(results.mutation).toEqual(Array.from({ length: 2 }, () => ({ status: 503, body: '<html>Gateway unavailable</html>' })))
  expect(results.invalidJson).toEqual({ status: 503, body: '{bad JSON' })
})
