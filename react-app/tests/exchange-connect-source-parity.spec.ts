import { expect, test, type Page } from '@playwright/test'

// The fixture component intentionally owns one fixed account scope. Matching
// it here exercises the real owner binding instead of bypassing that check.
const scope = 'session_exchange_fixture_0001'
const txid = 'tx_exchange_source_parity_000001'
const connid = 'conn_exchange_source_parity_0001'
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
const envelope = <T>(data: T) => ({ apiContractVersion: '0.12.0' as const, data })
const providerIds = ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'] as const
const sourceLabels = ['Bitget', 'Binance', 'OKX', 'Bybit', 'MEXC', 'WOO X', 'Gate'] as const
const sourceFont = '-apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans KR", "Apple SD Gothic Neo", "Noto Sans SC Variable", "TETH Bitcoin Glyph", sans-serif'
const catalog = envelope({ providers: providerIds.map(exchangeId => ({ exchangeId, available: exchangeId === 'bybit', reason: exchangeId === 'bybit' ? null : 'PROVIDER_UNAVAILABLE' })) })
const pending = envelope({ transactionId: txid, exchangeId: 'bybit' as const, status: 'processing' as const, expiresAt: '2030-01-01T00:05:00Z', authorizationUrl: null, connectionId: null, failureCode: null })
const connected = envelope({ ...pending.data, status: 'connected' as const, connectionId: connid })
const connection = { connectionId: connid, exchangeId: 'bybit' as const, maskedAccountLabel: '12****34', connectedAt: '2030-01-01T00:00:01Z', status: 'connected' as const, permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false }, permissionsVerified: false }

async function sessionRoutes(page: Page) {
  const meta = { apiContractVersion: '0.1.0', requestId: 'request_exchange_source_00001', traceId: 'trace_exchange_source_000001', resourceRevision: '1' }
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200, headers: { ...headers, ETag: '"exchange_source_session_0001"' }, body: JSON.stringify({ meta,
    data: { sessionId: scope, state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({ status: 200, headers, body: JSON.stringify({ meta: { ...meta, resourceRevision: null }, data: { csrfToken: 'csrf_exchange_source_only_001', expiresAt: '2030-01-02T00:00:00Z' } }) }))
}

test('source catalog remains visible while translated loading and unavailable feedback is explicit', async ({ page }) => {
  await sessionRoutes(page)
  let releaseCatalog: (() => void) | undefined
  const mutations: string[] = []
  await page.route('**/api/v1/exchange-connections/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`)
    if (path.endsWith('/catalog')) await new Promise<void>(resolve => { releaseCatalog = resolve })
    const body = path.endsWith('/catalog')
      ? envelope({ providers: catalog.data.providers.map(provider => ({ ...provider, available: false, reason: 'PROVIDER_NOT_CONFIGURED' })) })
      : envelope({ connections: [] })
    await route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.goto('/exchange-connect-fixture.html')
  await expect.poll(() => Boolean(releaseCatalog)).toBe(true)
  const shell = page.locator('.native-exchange-source-parity')
  const grid = shell.locator('.nsp-exchanges')
  await expect(grid.locator('button b')).toHaveText(sourceLabels)
  await expect(shell.getByRole('status')).toHaveText('확인 중...')
  for (const label of sourceLabels) await expect(grid.getByRole('button', { name: new RegExp(`^${label}`) })).toBeDisabled()
  releaseCatalog!()
  await expect(shell.getByRole('status')).toHaveText('아직 연결 정보가 제공되지 않았습니다.')
  await expect(grid.locator('button b')).toHaveText(sourceLabels)
  expect(mutations).toEqual([])
})

test('source 7-provider order is preserved while unsupported and non-source providers cannot start', async ({ page }) => {
  await sessionRoutes(page)
  const mutations: string[] = []
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`)
    const body = path.endsWith('/catalog') ? catalog : envelope({ connections: [] })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.goto('/exchange-connect-fixture.html')
  const grid = page.locator('.native-exchange-source-parity .nsp-exchanges')
  await expect(grid).toBeVisible()
  await expect(grid.locator('button b')).toHaveText(sourceLabels)
  await expect(grid.getByRole('button', { name: 'Bybit', exact: true })).toBeEnabled()
  for (const label of sourceLabels.filter(label => label !== 'Bybit')) await expect(grid.getByRole('button', { name: new RegExp(`^${label}`) })).toBeDisabled()
  await expect(grid.getByText('BingX', { exact: true })).toHaveCount(0)
  await expect(grid.getByText('HTX', { exact: true })).toHaveCount(0)
  await grid.getByRole('button', { name: /^OKX/ }).evaluate(button => (button as HTMLButtonElement).click())
  await expect(grid.getByRole('button', { name: /^OKX/ })).toHaveAttribute('data-provider-status', 'unsupported')
  await expect(page.locator('.native-exchange-source-parity')).toHaveAttribute('data-stage', 'exchange-selection')
  await expect.poll(() => mutations).toEqual([])
})

test('provider selection is local until the explicit source authorization CTA', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 })
  await sessionRoutes(page)
  const mutations: string[] = []
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`)
    const body = path.endsWith('/catalog') ? catalog : path.endsWith('/transactions') ? envelope({ ...pending.data, status: 'pending', authorizationUrl: 'https://www.bybit.com/oauth?client_id=fixture&state=fixture' }) : envelope({ connections: [] })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.route('https://www.bybit.com/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Exchange login fixture</title>' }))
  await page.goto('/exchange-connect-fixture.html')
  await expect.poll(() => page.locator('.nsp-exchanges').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3)
  await page.getByRole('button', { name: 'Bybit', exact: true }).click()
  const preflightHeading = page.getByRole('heading', { name: 'Bybit 연결' })
  await expect(preflightHeading).toBeVisible()
  await expect(preflightHeading).toBeFocused()
  await expect(page.getByText('잔고 조회', { exact: true })).toBeVisible()
  await expect(page.getByText('주문', { exact: true })).toBeVisible()
  await expect(page.getByText('출금', { exact: true })).toHaveCount(0)
  expect(mutations).toEqual([])
  await page.locator('.nsp-back').click()
  await expect(page.locator('.native-exchange-source-parity')).toHaveAttribute('data-stage', 'exchange-selection')
  await expect(page.locator('.nsp-back')).toBeFocused()
  expect(mutations).toEqual([])
  await page.getByRole('button', { name: 'Bybit', exact: true }).click()
  const authorize = page.getByRole('button', { name: 'Bybit에서 승인하기' })
  await authorize.evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click() })
  await expect.poll(() => mutations).toEqual(['POST /api/v1/exchange-connections/transactions'])
})

for (const width of [390, 1440]) test(`server-observed pending and complete retain source shell at ${width}px without mutation`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
  await sessionRoutes(page)
  let state: 'pending' | 'connected' = 'pending'
  const mutations: string[] = []
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`)
    const body = path.endsWith('/catalog') ? catalog : path.includes('/transactions/') ? (state === 'pending' ? pending : connected)
      : envelope({ connections: state === 'connected' ? [connection] : [] })
    return route.fulfill({ status: 200, headers, body: JSON.stringify(body) })
  })
  await page.route('**/auth/complete', async route => {
    const response = await route.fetch({ url: new URL('/exchange-connect-fixture.html', route.request().url()).href })
    await route.fulfill({ response })
  })
  await page.goto('/auth/complete#exchange-transaction=' + txid)
  const shell = page.locator('.native-exchange-source-parity')
  await expect(shell).toHaveAttribute('data-stage', 'exchange-pending')
  await expect(shell).toHaveCSS('font-family', sourceFont)
  await expect(page.getByRole('heading', { name: 'Bybit 연결 확인 중' })).toBeVisible()
  await expect(shell.locator('.nsp-lead')).toHaveAttribute('aria-hidden', 'true')
  await expect(shell.getByRole('status')).toHaveCount(1)
  await expect(shell.getByRole('status')).toHaveText('연결 결과를 확인하고 있습니다.')
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(mutations).toEqual([])

  state = 'connected'
  await page.getByRole('button', { name: '다시 확인' }).click()
  await expect(shell).toHaveAttribute('data-stage', 'exchange-complete')
  await expect(shell).toHaveCSS('font-family', sourceFont)
  await expect(page.getByRole('heading', { name: '거래소 연결', exact: true })).toBeVisible()
  await expect(page.getByText('12****34', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '다른 거래소 연결' })).toBeVisible()
  expect(mutations).toEqual([])
})
