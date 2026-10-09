import { expect, test, type Page } from '@playwright/test'

const scope = 'session_exchange_fixture_0001'
const transactionId = 'tx_exchange_locale_000001'
const connectionId = 'conn_exchange_locale_0001'
const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
const envelope = <T>(data: T) => ({ apiContractVersion: '0.12.0' as const, data })

async function installSessionRoutes(page: Page) {
  const meta = {
    apiContractVersion: '0.1.0',
    requestId: 'request_exchange_locale_001',
    traceId: 'trace_exchange_locale_0001',
    resourceRevision: '1',
  }
  await page.route('**/api/v1/auth/session', route => route.fulfill({
    status: 200,
    headers: { ...headers, ETag: '"exchange_locale_session_etag"' },
    body: JSON.stringify({
      meta,
      data: {
        sessionId: scope,
        state: 'AUTHENTICATED',
        revision: '1',
        issuedAt: '2030-01-01T00:00:00Z',
        expiresAt: '2030-01-02T00:00:00Z',
      },
    }),
  }))
  await page.route('**/api/v1/auth/csrf', route => route.fulfill({
    status: 200,
    headers,
    body: JSON.stringify({
      meta: { ...meta, resourceRevision: null },
      data: {
        csrfToken: 'csrf_exchange_locale_fixture_001',
        expiresAt: '2030-01-02T00:00:00Z',
      },
    }),
  }))
}

async function flushLocaleEffects(page: Page) {
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)))
  }))
}

test('소비한 callback locator는 터미널 이동 뒤 언어·locale 동기화에도 route를 덮거나 재조회하지 않는다', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tethLang', 'ko')
    const original = window.history.replaceState.bind(window.history)
    const calls: string[] = []
    Object.defineProperty(window, '__exchangeCallbackReplaceStateCalls', { value: calls })
    window.history.replaceState = (state, unused, url) => {
      calls.push(String(url))
      return original(state, unused, url)
    }
  })
  await installSessionRoutes(page)

  let transactionReads = 0
  const mutations: string[] = []
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() !== 'GET') mutations.push(`${request.method()} ${path}`)
    if (path === `/api/v1/exchange-connections/transactions/${transactionId}`) transactionReads++
    const data = path.endsWith('/catalog')
      ? { providers: ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'].map(exchangeId => ({
          exchangeId,
          available: exchangeId === 'bybit',
          reason: exchangeId === 'bybit' ? null : 'PROVIDER_UNAVAILABLE',
        })) }
      : path.includes('/transactions/')
        ? {
            transactionId,
            exchangeId: 'bybit',
            status: 'connected',
            expiresAt: '2030-01-01T00:05:00Z',
            authorizationUrl: null,
            connectionId,
            failureCode: null,
          }
        : { connections: [{
            connectionId,
            exchangeId: 'bybit',
            maskedAccountLabel: '12****34',
            connectedAt: '2030-01-01T00:00:01Z',
            status: 'connected',
            permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false },
            permissionsVerified: false,
          }] }
    return route.fulfill({ status: 200, headers, body: JSON.stringify(envelope(data)) })
  })
  await page.route('**/auth/complete', async route => {
    const fixture = new URL('/exchange-connect-fixture.html?service=true', route.request().url()).href
    await route.fulfill({ response: await route.fetch({ url: fixture }) })
  })

  await page.goto(`/auth/complete#exchange-transaction=${transactionId}`)
  await expect(page.locator('[data-stage=exchange-connection-list]')).toBeVisible()
  await expect(page.getByText('12****34', { exact: true })).toBeVisible()
  await expect.poll(() => transactionReads).toBe(1)
  await page.getByRole('button', { name: '터미널 열기', exact: true }).click()
  await expect(page).toHaveURL(/\/#\/trade$/)

  await page.evaluate(async () => {
    const { setClientPreference } = await import('/src/client-preferences.ts')
    setClientPreference('language', 'en')
  })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await flushLocaleEffects(page)
  await expect(page).toHaveURL(/\/#\/trade$/)
  expect(transactionReads).toBe(1)

  await page.evaluate(() => {
    localStorage.setItem('tethLang', 'ko')
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'tethLang',
      newValue: 'ko',
      storageArea: localStorage,
    }))
  })
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  await flushLocaleEffects(page)

  await expect(page).toHaveURL(/\/#\/trade$/)
  expect(transactionReads).toBe(1)
  expect(mutations).toEqual([])
  expect(await page.evaluate(() => (
    window as typeof window & { __exchangeCallbackReplaceStateCalls: string[] }
  ).__exchangeCallbackReplaceStateCalls)).toEqual(['/auth/complete'])
})
