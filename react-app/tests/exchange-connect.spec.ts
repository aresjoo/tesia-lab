import { expect, test, type Page } from '@playwright/test'
import { createExchangeConnectionController, readExchangeTransactionLocator, type ExchangeControllerPorts } from '../src/exchange-connect/controller'
import { TesiaExchangeConnectionsV12Client } from '../src/internal-poc/contracts/generated/api-v0.12/client'
import type { NativeConnectionPresentation } from '../src/internal-poc/native-connection-presentation'

const scope = 'session_exchange_fixture_0001'
const txid = 'tx_exchange_fixture_00000001'
const connid = 'conn_exchange_fixture_000001'
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
const envelope = <T>(data: T) => ({ apiContractVersion: '0.12.0' as const, data })
const catalog = envelope({ providers: ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'].map(exchangeId => ({ exchangeId, available: exchangeId === 'bybit', reason: exchangeId === 'bybit' ? null : 'PROVIDER_UNAVAILABLE' })) })
const pending = envelope({ transactionId: txid, exchangeId: 'bybit', status: 'pending', expiresAt: '2030-01-01T00:05:00Z', authorizationUrl: 'https://www.bybit.com/oauth?client_id=fixture&state=fixture', connectionId: null, failureCode: null })
const connected = envelope({ ...pending.data, authorizationUrl: null, status: 'connected', connectionId: connid })
const connection = { connectionId: connid, exchangeId: 'bybit', maskedAccountLabel: '12****34', connectedAt: '2030-01-01T00:00:01Z', status: 'connected', permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false }, permissionsVerified: false }

async function sessionRoutes(page: Page) {
  const meta = { apiContractVersion: '0.1.0', requestId: 'request_exchange_fixture_00001', traceId: 'trace_exchange_fixture_000001', resourceRevision: '1' }
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, headers: { ...headers, ETag: '"exchange_session_etag_00001"' }, body: JSON.stringify({ meta,
    data: { sessionId: scope, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: { ...meta, resourceRevision: null }, data: { csrfToken: 'csrf_exchange_fixture_only_001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
}

test('실제 생성 SDK로 거래소 로그인 이동·중복 클릭·브라우저 비밀값 미보관', async ({ page }) => {
  await sessionRoutes(page)
  let starts = 0
  const requests: string[] = []
  await page.route('**/api/v1/exchange-connections/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    requests.push(request.method() + ' ' + path)
    let body: unknown = catalog
    if (path.endsWith('/transactions')) {
      starts++
      expect(request.postDataJSON()).toEqual({ exchangeId: 'bybit' })
      expect(request.headers()['x-csrf-token']).toBe('csrf_exchange_fixture_only_001')
      body = pending
    } else if (path.endsWith('/exchange-connections/')) body = envelope({ connections: [] })
    await route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.route('https://www.bybit.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Exchange login fixture</title>' }))
  await page.goto('/exchange-connect-fixture.html')
  const choose = page.getByRole('button', { name: 'Bybit', exact: true })
  await expect(choose).toBeVisible()
  await choose.click()
  const authorize = page.getByRole('button', { name: 'Bybit에서 승인하기' })
  await authorize.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect(page).toHaveURL(/^https:\/\/www\.bybit\.com\/oauth\?/)
  expect(starts).toBe(1)
  expect(requests.some(path => /order|withdraw/i.test(path))).toBe(false)
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  expect(JSON.stringify(storage)).not.toMatch(/apiKey|secretKey|passphrase|accessToken/i)
})

test('거래소 복귀 뒤 서버 결과를 확인하며 로컬 해제와 재연결을 제공', async ({ page }) => {
  await sessionRoutes(page)
  let active = true, deletes = 0
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    let body: unknown = catalog
    if (path.includes('/transactions/')) body = connected
    else if (request.method() === 'DELETE') { active = false; deletes++; body = envelope({ connectionId: connid, status: 'disconnected', revocation: 'local_only' }) }
    else if (path.endsWith('/exchange-connections/')) body = envelope({ connections: active ? [connection] : [] })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.route('**/auth/complete', async route => {
    const response = await route.fetch({ url: new URL('/exchange-connect-fixture.html', route.request().url()).href })
    await route.fulfill({ response })
  })
  await page.goto('/auth/complete#exchange-transaction=' + txid)
  await expect(page.getByRole('heading', { name: '거래소 연결', exact: true })).toBeVisible()
  await expect(page.getByText('12****34', { exact: true })).toBeVisible()
  await expect(page.getByText('요청하지 않음 · 실제 권한 확인 전', { exact: true })).toBeVisible()
  await expect(page.getByText('출금 권한 없음', { exact: true })).toHaveCount(0)
  expect(page.url()).not.toContain(txid)
  await page.getByRole('button', { name: 'Bybit · 연결 해제' }).click()
  await expect(page.getByRole('button', { name: 'Bybit', exact: true })).toBeVisible()
  await expect(page.getByText('TETH의 연결 정보를 삭제했습니다. 거래소에서도 해당 API 키를 삭제해주세요.', { exact: true })).toBeVisible()
  expect(deletes).toBe(1)
})

for (const status of ['failed', 'expired'] as const) {
  test(`Bitget ${status} 복귀는 성공하지 않고 거래소 키 정리를 안내`, async ({ page }) => {
    await sessionRoutes(page)
    await page.route('**/api/v1/exchange-connections/**', route => {
      const path = new URL(route.request().url()).pathname
      const body = path.endsWith('/catalog') ? catalog : envelope({ ...pending.data,
        exchangeId: 'bitget', status, authorizationUrl: null,
        failureCode: status === 'failed' ? 'PROVIDER_FAILED' : null })
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
    })
    await page.route('**/auth/complete', async route => {
      const response = await route.fetch({ url: new URL('/exchange-connect-fixture.html', route.request().url()).href })
      await route.fulfill({ response })
    })
    await page.goto('/auth/complete#exchange-transaction=' + txid)
    await expect(page.getByText('이번 연결 시도에서 TETH용 API 키가 생성되었다면 거래소에서 해당 키를 삭제해주세요.', { exact: false })).toBeVisible()
    await expect(page.getByRole('heading', { name: '거래소 계정 연결 완료' })).toHaveCount(0)
  })
}

test('알 수 없는 비밀 필드와 잘못된 외부 인증 주소는 성공 화면으로 표시하지 않음', async ({ page }) => {
  await sessionRoutes(page)
  await page.route('**/api/v1/exchange-connections/**', route => {
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/catalog') ? catalog : path.endsWith('/transactions')
      ? { ...pending, data: { ...pending.data, authorizationUrl: 'https://attacker.example/login', apiKey: 'never-accept-secret' } }
      : envelope({ connections: [] })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.goto('/exchange-connect-fixture.html')
  await page.getByRole('button', { name: 'Bybit', exact: true }).click()
  await page.getByRole('button', { name: 'Bybit에서 승인하기' }).click()
  await expect(page.getByText('연결을 완료하지 못했습니다. 다시 시도해주세요.')).toBeVisible()
  expect(page.url()).toContain('/exchange-connect-fixture.html')
  await expect(page.getByRole('heading', { name: '거래소 계정 연결 완료' })).toHaveCount(0)
})

test('허용 목록 밖 외부 인증 주소만으로도 이동을 거부함', async ({ page }) => {
  await sessionRoutes(page)
  await page.route('**/api/v1/exchange-connections/**', route => {
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/catalog') ? catalog : path.endsWith('/transactions')
      ? envelope({ ...pending.data, authorizationUrl: 'https://attacker.example/login' })
      : envelope({ connections: [] })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.goto('/exchange-connect-fixture.html')
  await page.getByRole('button', { name: 'Bybit', exact: true }).click()
  await page.getByRole('button', { name: 'Bybit에서 승인하기' }).click()
  await expect(page.getByText('연결을 완료하지 못했습니다. 다시 시도해주세요.')).toBeVisible()
  expect(page.url()).toContain('/exchange-connect-fixture.html')
  await expect(page.getByRole('heading', { name: '거래소 연결', exact: true })).toHaveCount(0)
})

test('미등록 거래소는 선택할 수 없고 발급되지 않은 키를 요구하지 않음', async ({ page }) => {
  await sessionRoutes(page)
  let mutations = 0
  await page.route('**/api/v1/exchange-connections/**', route => {
    if (route.request().method() !== 'GET') mutations++
    return route.fulfill({ status: 200, headers,
      body: JSON.stringify(new URL(route.request().url()).pathname.endsWith('/catalog') ? envelope({ providers: catalog.data.providers.map(provider => ({ ...provider, available: false, reason: 'PROVIDER_NOT_CONFIGURED' })) }) : envelope({ connections: [] })) })
  })
  await page.goto('/exchange-connect-fixture.html')
  const sourceProviders = ['Bitget', 'Binance', 'OKX', 'Bybit', 'MEXC', 'WOO X', 'Gate']
  for (const provider of sourceProviders) await expect(page.getByRole('button', { name: new RegExp(`^${provider}`) })).toBeDisabled()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('실제 NativeServiceApp 명시 공급은 동일 로그인 세션으로 거래소 화면과 인증 시작을 연결', async ({ page }) => {
  await sessionRoutes(page)
  let starts = 0
  await page.route('**/api/v1/exchange-connections/**', route => {
    const path = new URL(route.request().url()).pathname
    const body = path.endsWith('/catalog') ? catalog : path.endsWith('/transactions')
      ? (starts++, pending) : envelope({ connections: [] })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.route('https://www.bybit.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Exchange login fixture</title>' }))
  await page.goto('/exchange-connect-fixture.html?service=true')
  await expect(page.getByRole('button', { name: 'Bybit', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Bybit', exact: true }).click()
  await page.getByRole('button', { name: 'Bybit에서 승인하기' }).click()
  await expect(page).toHaveURL(/^https:\/\/www\.bybit\.com\/oauth\?/)
  expect(starts).toBe(1)
})

test('실제 NativeServiceApp 기본 진입은 거래소 API를 호출하지 않음', async ({ page }) => {
  await sessionRoutes(page)
  let reads = 0, exchangeRequests = 0
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/auth/session') reads++
    if (path.startsWith('/api/v1/exchange-connections')) exchangeRequests++
  })
  await page.goto('/internal-poc.html#/native-client')
  await expect(page.locator('textarea').first()).toBeVisible()
  await expect.poll(() => reads).toBeGreaterThan(0)
  expect(exchangeRequests).toBe(0)
})

test('세션이 바뀌거나 화면이 닫힌 뒤 늦게 도착한 응답은 다른 계정으로 전달하지 않음', async () => {
  let presentation: NativeConnectionPresentation | undefined
  let session = scope, starts = 0, redirects = 0
  let release: (() => void) | undefined
  const client = new TesiaExchangeConnectionsV12Client({ request: async request => {
    let body: unknown = catalog
    if (request.path.endsWith('/transactions')) {
      starts++; await new Promise<void>(resolve => { release = resolve }); body = pending
    } else if (request.path.endsWith('/exchange-connections/')) body = envelope({ connections: [] })
    return { status: 200, headers: Object.entries(headers), body: JSON.stringify(body) }
  } })
  const ports: ExchangeControllerPorts = { client, currentSession: async () => ({ sessionId: session, state: 'AUTHENTICATED' }), csrf: async () => 'csrf_exchange_fixture_only_001', navigateToExchange: () => { redirects++ }, text: key => key, onChange: value => { presentation = value } }
  const controller = createExchangeConnectionController(scope, ports)
  await controller.load()
  const state = presentation!.state
  if (state.kind !== 'exchange') throw Error('Wrong stage')
  const call = state.onChoose!('bybit')
  await expect.poll(() => starts).toBe(1)
  session = 'session_different_owner_0001'
  release!(); await call
  expect(redirects).toBe(0)
  session = scope
  const second = state.onChoose!('bybit')
  await expect.poll(() => starts).toBe(2)
  controller.dispose(); release!(); await second
  expect(redirects).toBe(0)
})

test('복귀 locator는 정확한 경로·키·문법만 인식하며 인증 증거로 취급하지 않음', () => {
  expect(readExchangeTransactionLocator('https://teth.ai/auth/complete#exchange-transaction=' + txid)).toBe(txid)
  for (const value of ['https://teth.ai/#exchange-transaction=' + txid, 'https://teth.ai/auth/complete?owner=other#exchange-transaction=' + txid, 'https://teth.ai/auth/complete#exchange-transaction=' + txid + '&secret=x']) expect(readExchangeTransactionLocator(value)).toBeNull()
})

for (const retirement of ['session-change', 'dispose'] as const) {
  test(`지연 CSRF 이후 ${retirement}는 생성 SDK의 인증 시작 요청을 보내지 않는다`, async () => {
    let presentation: NativeConnectionPresentation | undefined
    let session = scope, csrfReads = 0, starts = 0, redirects = 0
    let release: (() => void) | undefined
    const client = new TesiaExchangeConnectionsV12Client({ request: async request => {
      if (request.method === 'POST') starts++
      const body = request.path.endsWith('/catalog') ? catalog : envelope({ connections: [] })
      return { status: 200, headers: Object.entries(headers), body: JSON.stringify(body) }
    } })
    const controller = createExchangeConnectionController(scope, {
      client, currentSession: async () => ({ sessionId: session, state: 'AUTHENTICATED' }),
      csrf: async () => { csrfReads++; await new Promise<void>(resolve => { release = resolve }); return 'csrf_exchange_fixture_only_001' },
      navigateToExchange: () => { redirects++ }, text: key => key,
      onChange: value => { presentation = value },
    })
    await controller.load()
    const state = presentation!.state
    if (state.kind !== 'exchange') throw Error('Wrong stage')
    const request = state.onChoose!('bybit')
    await expect.poll(() => csrfReads).toBe(1)
    if (retirement === 'session-change') session = 'session_different_owner_0001'
    else controller.dispose()
    release!(); await request
    expect(starts).toBe(0)
    expect(redirects).toBe(0)
    controller.dispose()
  })
}

test('StrictMode pending 복귀는 같은 거래소 시도만 한 번 취소하고 연결 완료를 합성하지 않는다', async ({ page }) => {
  await sessionRoutes(page)
  let deletes = 0
  const mutationPaths: string[] = []
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutationPaths.push(request.method() + ' ' + path)
    let body: unknown = path.endsWith('/catalog') ? catalog : envelope({ connections: [] })
    if (path.includes('/transactions/')) {
      body = pending
      if (request.method() === 'DELETE') {
        deletes++
        expect(path).toBe('/api/v1/exchange-connections/transactions/' + txid)
        expect(request.headers()['x-csrf-token']).toBe('csrf_exchange_fixture_only_001')
        expect(request.postData()).toBeNull()
        body = envelope({ ...pending.data, status: 'cancelled', authorizationUrl: null })
      }
    }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.route('**/auth/complete', async route => {
    const response = await route.fetch({ url: new URL('/exchange-connect-fixture.html', route.request().url()).href })
    await route.fulfill({ response })
  })
  await page.goto('/auth/complete#exchange-transaction=' + txid)
  await expect(page.getByRole('heading', { name: 'Bybit 연결 확인 중' })).toBeVisible()
  const cancel = page.getByRole('button', { name: '연결 취소', exact: true })
  await expect(cancel).toBeVisible()
  await cancel.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect(page.getByRole('button', { name: 'Bybit', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '거래소 계정 연결 완료' })).toHaveCount(0)
  expect(deletes).toBe(1)
  expect(mutationPaths).toEqual(['DELETE /api/v1/exchange-connections/transactions/' + txid])
  expect(page.url()).not.toContain(txid)
})

const cleanupHint = '이번 연결 시도에서 TETH용 API 키가 생성되었다면 거래소에서 해당 키를 삭제해주세요.'
const cleanupProviderUrls = {
  bitget: 'https://www.bitget.com/account/oauth?client_id=fixture&state=fixture',
  bingx: 'https://bingx.com/broker/oauth?client_id=fixture&state=fixture',
  htx: 'https://www.huobi.com/en-us/broker/empower?client_id=fixture&state=fixture',
} as const

for (const exchangeId of ['bitget', 'bingx', 'htx'] as const) {
  test(`${exchangeId} 직접 취소는 동일 시도 DELETE 한 번과 거래소 키 정리 안내를 보존`, async ({ page }) => {
    await sessionRoutes(page)
    const mutations: string[] = []
    await page.route('**/api/v1/exchange-connections/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname
      let body: unknown = catalog
      if (path.includes('/transactions/')) {
        const cancelled = request.method() === 'DELETE'
        body = envelope({ ...pending.data, exchangeId, status: cancelled ? 'cancelled' : 'pending',
          authorizationUrl: cancelled ? null : cleanupProviderUrls[exchangeId] })
        if (cancelled) {
          mutations.push(request.method() + ' ' + path)
          expect(path).toBe('/api/v1/exchange-connections/transactions/' + txid)
          expect(request.headers()['x-csrf-token']).toBe('csrf_exchange_fixture_only_001')
          expect(request.postData()).toBeNull()
        }
      }
      return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
    })
    await page.route('**/auth/complete', async route => {
      const response = await route.fetch({ url: new URL('/exchange-connect-fixture.html', route.request().url()).href })
      await route.fulfill({ response })
    })
    await page.goto('/auth/complete#exchange-transaction=' + txid)
    await page.getByRole('button', { name: '연결 취소', exact: true }).click()
    await expect(page.getByText(cleanupHint, { exact: false })).toBeVisible()
    await expect(page.getByRole('heading', { name: '거래소 계정 연결 완료' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Bybit', exact: true })).toBeVisible()
    expect(mutations).toEqual(['DELETE /api/v1/exchange-connections/transactions/' + txid])
    expect(page.url()).not.toContain(txid)
  })
}

test('BingX·HTX 실패·만료 재확인은 연결 성공 없이 동일한 거래소 키 정리를 안내', async ({ page }) => {
  await sessionRoutes(page)
  let exchangeId: 'bingx' | 'htx' = 'bingx', status: 'failed' | 'expired' = 'failed'
  const mutations: string[] = [], observedIds: string[] = []
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutations.push(request.method() + ' ' + path)
    if (path.includes('/transactions/')) observedIds.push(path)
    const body = path.endsWith('/catalog') ? catalog : envelope({ ...pending.data,
      exchangeId, status, authorizationUrl: null, failureCode: status === 'failed' ? 'PROVIDER_FAILED' : null })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.route('**/auth/complete', async route => {
    const response = await route.fetch({ url: new URL('/exchange-connect-fixture.html', route.request().url()).href })
    await route.fulfill({ response })
  })
  for (const provider of ['bingx', 'htx'] as const) for (const terminal of ['failed', 'expired'] as const) {
    exchangeId = provider; status = terminal
    // Each provider/status is a separate OAuth return with a fresh document.
    await page.goto('about:blank')
    await page.goto('/auth/complete#exchange-transaction=' + txid)
    await expect(page.getByText(cleanupHint, { exact: false })).toBeVisible()
    await expect(page.getByText('연결을 완료하지 못했습니다. 다시 시도해주세요.', { exact: false })).toBeVisible()
    await expect(page.getByRole('heading', { name: '거래소 계정 연결 완료' })).toHaveCount(0)
    expect(page.url()).not.toContain(txid)
  }
  expect(observedIds.length).toBeGreaterThanOrEqual(4)
  expect(observedIds.every(path => path === '/api/v1/exchange-connections/transactions/' + txid)).toBe(true)
  expect(mutations).toEqual([])
})
