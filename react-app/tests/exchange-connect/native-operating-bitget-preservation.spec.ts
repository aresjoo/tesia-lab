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
async function mount(page: Page, baseURL: string | undefined, options: { enabled?: boolean; authenticated?: boolean; callback?: boolean; connected?: boolean; holdInitialCatalog?: boolean; holdConnections?: boolean; service?: boolean; transactionFailed?: boolean; allowed?: boolean } = {}) {
  if (!baseURL) throw new Error('LOOPBACK_REQUIRED')
  const origin = new URL(baseURL).origin
  const wire = { owner, connected: options.connected ?? false, allowed: options.allowed ?? true, reads: 0, starts: 0, cancels: 0,
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
      version = '0.1.0'; headers.ETag = '"operating_bitget_fixture_etag_001"'
      data = { sessionId: wire.owner, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-01T12:00:00Z' }
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
      data = { connections: wire.connected ? [{ ...linked, permissions: { ...linked.permissions, withdrawal: wire.invalidPermission } }, { ...linked, connectionId: 'connection_foreign_provider_001', exchangeId: 'bybit' }] : [] }
      if (wire.holdNextSnapshot || wire.holdSnapshotAtRead === wire.connectionReads) {
        wire.holdNextSnapshot = false; wire.snapshotHeld = true
        await new Promise<void>(resolve => { wire.releaseSnapshot = resolve })
      }
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
    const body = version === '0.1.0' ? { meta: { apiContractVersion: version, resourceRevision: path.endsWith('/session') ? '1' : null,
      requestId: 'req_operating_fixture_001', traceId: 'trace_operating_fixture_001' }, data } : { apiContractVersion: version, data }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
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
  // Navigation revoked callback intent before catalog completion. Background
  // account reads remain, but transaction observation/polling does not start.
  expect(wire.reads).toBe(0)
  await page.clock.fastForward(3_000)
  await expect(page).toHaveURL(/\/#\/settings$/)
  expect(wire.reads).toBe(0)
  expect(wire.starts).toBe(0); expect(wire.cancels).toBe(0); expect(wire.outbound).toEqual([])
})

test('verified Bitget account reaches the terminal and survives modal close without invented ledger facts', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('CONNECTED')
  const readAccount = () => act(page, `${control}.value.account`)
  const account = await readAccount()
  expect(account?.scope).toBe(owner)
  expect(account?.accounts?.map((item: { id: string }) => item.id)).toEqual([connectionId])
  expect(account?.accounts?.[0].fields.map((item: { value: string }) => item.value)).toContain('***0001')
  expect(account?.strategies).toBeNull()
  expect(Object.values(account?.ledger ?? {})).toEqual([null, null, null, null, null, null])
  await act(page, `${control}.value.broker.actions.onConnect('bitget')`)
  await expect(status(page)).toContainText('"connection"')
  await act(page, `${control}.value.connection.state.connectionList.onOpenTerminal()`)
  await expect(page).toHaveURL(/\/#\/trade$/)
  await expect(status(page)).not.toContainText('"connection"')
  expect(await readAccount()).toEqual(account)
  expect(wire.starts).toBe(0)
  await page.evaluate(async () => {
    const reactPath = (await (await fetch('/src/exchange-connect/use-exchange-connection.ts')).text()).match(/from "([^"]*\/react\.js[^"]*)"/)?.[1]
    if (!reactPath) throw new Error('Missing Vite React')
    const module = await import(/* @vite-ignore */reactPath), React = module.default ?? module
    const domPath = '/@id/react-dom/client', DOM = await import(/* @vite-ignore */domPath)
    const path = '/src/internal-poc/NativeTradingWorkspace.tsx'
    const { NativeTradingWorkspace } = await import(/* @vite-ignore */path)
    const value = Reflect.get(window, 'operatingControls').value
    const mount = document.createElement('div'); mount.id = 'terminal'; document.body.appendChild(mount)
    ;(DOM.createRoot ?? DOM.default.createRoot)(mount).render(React.createElement(NativeTradingWorkspace, {
      accountScope: value.scope, presentation: value.account, onReturn: () => {}, onNew: () => {},
    }))
  })
  const terminal = page.locator('#terminal')
  await terminal.locator('.ctt-selector-button').click()
  await expect(terminal.getByRole('button', { name: 'Bitget · ***0001', exact: true })).toBeVisible()
  await expect(terminal).not.toContainText('현재 환경에서는 거래소 계좌 조회와 연결을 지원하지 않습니다.')
  await terminal.getByRole('button', { name: 'Bitget · ***0001', exact: true }).click()
  await expect(terminal.locator('[data-native-account-document]')).toContainText('***0001')
  await expect(terminal.locator('[data-native-account-document]')).toContainText('출금 권한 없음')
  await act(page, `${control}.setAuthenticated(false)`)
  await expect(status(page)).toHaveText('{}')
  expect(wire.outbound).toEqual([]); expect(wire.cancels).toBe(0)
})

test('confirmed disconnect removes terminal metadata even when the subsequent list read fails', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('"account"')
  await act(page, `${control}.value.account.actions.onConnect()`)
  await expect(status(page)).toContainText('"connection"')
  wire.failConnections = true
  await act(page, `${control}.value.connection.state.connectionList.accounts[0].onDisconnect()`)
  expect(await act(page, `${control}.value.account.accounts`)).toEqual([])
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(wire.api.filter(item => item === `DELETE /api/v1/exchange-connections/${connectionId}`)).toHaveLength(1)
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('session recheck failure clears terminal metadata and rejects a captured account action', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('"account"')
  await act(page, `window.oldAccountConnect=${control}.value.account.actions.onConnect; ${control}.value.broker.actions.onConnect('bitget')`)
  await expect.poll(() => act(page, `${control}.value.connection.state.kind`)).toBe('complete')
  wire.owner = 'session_operating_replacement_fixture_001'
  await act(page, `${control}.value.connection.state.connectionList.onOpenTerminal()`)
  await expect(status(page)).not.toContainText('"account"')
  await expect(page).not.toHaveURL(/\/#\/trade$/)
  await act(page, 'window.oldAccountConnect().catch(()=>{})')
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('close during confirmed disconnect still refreshes the owner metadata after the delayed DELETE settles', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('CONNECTED')
  await act(page, `${control}.value.account.actions.onConnect()`)
  await expect(status(page)).toContainText('"connection"')
  wire.holdDisconnect = true
  await act(page, `void ${control}.value.connection.state.connectionList.accounts[0].onDisconnect()`)
  await expect.poll(() => wire.api.filter(item => item.startsWith('DELETE')).length).toBe(1)
  await act(page, `${control}.value.close()`)
  await expect(status(page)).not.toContainText('"connection"')
  wire.releaseDisconnect()
  await expect.poll(() => act(page, `${control}.value.account?.accounts`)).toEqual([])
  await expect(status(page)).not.toContainText('CONNECTED')
  await act(page, `${control}.value.broker.actions.onConnect('bitget')`)
  await expect.poll(() => act(page, `${control}.value.connection?.state.description`))
    .toBe('TETH의 연결 정보를 삭제했습니다. 거래소에서도 해당 API 키를 삭제해주세요.')
  await page.clock.fastForward(3_000)
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
  // The retained warning prevents automatic consent, not the customer's
  // explicit provider choice. The destination is fulfilled synthetically.
  await act(page, `${control}.value.connection.state.onChoose('bitget')`)
  await expect.poll(() => wire.starts).toBe(1)
  await expect(page).toHaveURL(pending.authorizationUrl)
  expect(wire.outbound).toEqual([pending.authorizationUrl])
})

test('navigation during initial connections read recovers account metadata without reopening or polling', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, holdConnections: true })
  await expect.poll(() => wire.api).toContain('GET /api/v1/exchange-connections/')
  await act(page, `history.pushState(null, '', '/#/trade'); window.dispatchEvent(new Event('teth:navigate'))`)
  wire.releaseConnections()
  await expect.poll(() => act(page, `${control}.value?.account?.accounts.map(x => x.id)`)).toEqual([connectionId])
  await expect(status(page)).toContainText('CONNECTED')
  await expect(status(page)).not.toContainText('"connection"')
  expect(wire.reads).toBe(0); expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('existing connection remains available when a different callback transaction fails', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, callback: true, transactionFailed: true })
  await expect(status(page)).toContainText('CONNECTED')
  await expect(status(page)).toContainText('연결을 완료하지 못했습니다.')
  await expect.poll(() => act(page, `${control}.value?.account?.accounts.map(x => x.id)`)).toEqual([connectionId])
  expect(wire.reads).toBe(1)
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('actual NativeServiceApp fallback displays the verified account and leaves financial data unknown', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, service: true })
  const app = page.locator('.client-service-app')
  await expect(app).toHaveAttribute('data-service-phase', 'ready')
  await app.locator('.ctt-selector-button').click()
  await expect(app.getByRole('button', { name: 'Bitget · ***0001', exact: true })).toBeVisible()
  await expect(app).not.toContainText('현재 환경에서는 거래소 계좌 조회와 연결을 지원하지 않습니다.')
  await app.getByRole('button', { name: 'Bitget · ***0001', exact: true }).click()
  await expect(app.locator('[data-native-account-document]')).toContainText('출금 권한 없음')
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('actual NativeServiceApp with a confirmed empty connection list does not invent an account or zero balance', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: false, service: true })
  const app = page.locator('.client-service-app')
  await expect(app).toHaveAttribute('data-service-phase', 'ready')
  await expect(app.locator('[data-native-ledger="pos"]')).toContainText('아직 공급된 계정 데이터가 없습니다.')
  await expect(app).not.toContainText('현재 환경에서는 거래소 계좌 조회와 연결을 지원하지 않습니다.')
  expect(await act(page, `${control}.value.account.accounts`)).toEqual([])
  expect(await act(page, `${control}.value.account.ledger.assets`)).toBeNull()
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('generated SDK refuses withdrawal permission and authoritative 401 clears cached terminal account', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('"account"')
  wire.denyConnections = true
  await act(page, `${control}.value.account.actions.onConnect()`)
  await expect(status(page)).not.toContainText('"account"')
  wire.denyConnections = false; wire.invalidPermission = true
  await act(page, `${control}.value.broker.actions.onConnect('bitget')`)
  await expect(status(page)).not.toContainText('"account"')
  await expect(status(page)).toContainText('"status":"error"')
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

test('unavailable initial catalog cannot revive account metadata on later navigation', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, allowed: false })
  await expect.poll(() => wire.api.filter(item => item.includes('/catalog')).length).toBeGreaterThan(0)
  await page.clock.fastForward(1_000)
  await act(page, `history.pushState(null, '', '/#/trade'); window.dispatchEvent(new Event('teth:navigate'))`)
  await page.clock.fastForward(2_000)
  await expect(status(page)).toHaveText('{}')
  expect(wire.api.filter(item => item === 'GET /api/v1/exchange-connections/')).toHaveLength(0)
  expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
})

for (const reenter of ['reopen', 'locale'] as const) {
  test(`confirmed DELETE invalidates a pre-commit account snapshot after ${reenter}`, async ({ page, baseURL }) => {
    const wire = await mount(page, baseURL, { enabled: true, connected: true })
    await expect(status(page)).toContainText('CONNECTED')
    await act(page, `${control}.value.account.actions.onConnect()`)
    wire.holdDisconnect = true
    await act(page, `void ${control}.value.connection.state.connectionList.accounts[0].onDisconnect()`)
    await expect.poll(() => wire.api.filter(item => item.startsWith('DELETE')).length).toBe(1)
    if (reenter === 'reopen') {
      // close's finite read is next; target the following controller read.
      wire.holdSnapshotAtRead = wire.connectionReads + 2
      await act(page, `${control}.value.close()`)
      await act(page, `void ${control}.value.broker.actions.onConnect('bitget')`)
    } else {
      wire.holdNextSnapshot = true
      await page.evaluate(async () => {
        const path = '/src/client-preferences.ts'
        const { setClientPreference } = await import(/* @vite-ignore */path)
        setClientPreference('language', 'en')
      })
    }
    await expect.poll(() => wire.snapshotHeld).toBe(true)
    wire.releaseDisconnect()
    await expect.poll(() => act(page, `${control}.value?.account?.accounts`)).toEqual([])
    wire.releaseSnapshot()
    await page.clock.fastForward(2_000)
    await expect.poll(() => act(page, `${control}.value?.account?.accounts`)).toEqual([])
    await expect(status(page)).not.toContainText('CONNECTED')
    expect(wire.starts).toBe(0); expect(wire.outbound).toEqual([])
    expect(wire.api.filter(item => item.startsWith('DELETE'))).toHaveLength(1)
  })
}

test('local-only disconnect retains the revocation warning and does not reopen a closed management view', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true })
  await expect(status(page)).toContainText('CONNECTED')
  await act(page, `${control}.value.account.actions.onConnect()`)
  await act(page, `${control}.value.connection.state.connectionList.accounts[0].onDisconnect()`)
  await expect.poll(() => act(page, `${control}.value.connection?.state.description`))
    .toBe('TETH의 연결 정보를 삭제했습니다. 거래소에서도 해당 API 키를 삭제해주세요.')
  await act(page, `${control}.value.close()`)
  // Keep the same-owner warning across closure without reopening on its own.
  await expect(status(page)).not.toContainText('"connection"')
  expect(wire.starts).toBe(0)
  expect(wire.outbound).toEqual([])
})

test('catalog gate still pending prevents navigation from reading connected account metadata', async ({ page, baseURL }) => {
  const wire = await mount(page, baseURL, { enabled: true, connected: true, allowed: false, holdInitialCatalog: true })
  await expect.poll(() => wire.api.some(item => item.includes('/catalog'))).toBe(true)
  await act(page, `history.pushState(null, '', '/#/trade'); window.dispatchEvent(new Event('teth:navigate'))`)
  await page.clock.fastForward(1_000)
  expect(wire.connectionReads).toBe(0)
  expect(await act(page, `${control}.value?.account`)).toBeUndefined()
  wire.releaseCatalog()
  await page.clock.fastForward(2_000)
  await expect(status(page)).toHaveText('{}')
  expect(wire.connectionReads).toBe(0); expect(wire.starts).toBe(0)
})
