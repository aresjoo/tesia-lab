import { expect, test } from '@playwright/test'
import { createExchangeConnectionController } from '../src/exchange-connect/controller'
import { TesiaExchangeConnectionsV12Client } from '../src/internal-poc/contracts/generated/api-v0.12/client'
import type { NativeConnectionPresentation } from '../src/internal-poc/native-connection-presentation'

const scope = 'session_terminal_fixture_0001'
const connectionId = 'connection_terminal_fixture_01'
const headers = [['Cache-Control', 'no-store'], ['Content-Type', 'application/json']] as [string, string][]
const envelope = (data: unknown) => JSON.stringify({ apiContractVersion: '0.12.0', data })

function harness(withTerminal = true) {
  let presentation: NativeConnectionPresentation | undefined
  let session = scope, active = true, terminalCalls = 0, csrfReads = 0, sessionFailure = false, connectionFailure = false
  const requests: string[] = []
  const client = new TesiaExchangeConnectionsV12Client({ request: async request => {
    requests.push(`${request.method} ${request.path}`)
    let data: unknown
    if (request.path.endsWith('/catalog')) data = { providers: ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'].map(exchangeId => ({
      exchangeId, available: exchangeId === 'bitget', reason: exchangeId === 'bitget' ? null : 'PROVIDER_UNAVAILABLE',
    })) }
    else if (request.method === 'DELETE') {
      active = false
      data = { connectionId, status: 'disconnected', revocation: 'local_only' }
    } else {
      if (connectionFailure) throw Error('Temporary connection read failure')
      data = { connections: active ? [{ connectionId, exchangeId: 'bitget', maskedAccountLabel: '12****34',
      connectedAt: '2030-01-01T00:00:00Z', status: 'connected', permissionsVerified: false,
      permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false } }] : [] }
    }
    return { status: 200, headers, body: envelope(data) }
  } })
  const controller = createExchangeConnectionController(scope, { client,
    currentSession: async () => { if (sessionFailure) throw Error('Temporary session read failure'); return { sessionId: session, state: 'AUTHENTICATED' } },
    csrf: async () => { csrfReads++; return 'csrf_terminal_fixture_001' },
    navigateToExchange: () => { throw Error('Unexpected external navigation') },
    onOpenTerminal: withTerminal ? () => { terminalCalls++ } : undefined,
    text: key => key, onChange: value => { presentation = value },
  })
  return { controller, requests,
    get state() { if (!presentation) throw Error('No presentation'); return presentation.state },
    get terminalCalls() { return terminalCalls }, get csrfReads() { return csrfReads },
    changeSession() { session = 'session_other_owner_fixture_01' },
    failSession() { sessionFailure = true },
    failConnectionReads() { connectionFailure = true },
  }
}

test('서버 연결 목록을 원본 완료 동선에 공급하고 초대·구독·권한은 합성하지 않는다', async () => {
  const h = harness()
  await h.controller.load()
  const state = h.state
  if (state.kind !== 'complete' || !state.connectionList) throw Error('No connection list')
  expect(state.connectionList.accounts).toHaveLength(1)
  expect(state.connectionList.accounts[0]).toMatchObject({ id: connectionId, exchangeId: 'bitget', maskedAccountLabel: '12****34' })
  expect(state.connectionList.accounts[0]).not.toHaveProperty('access')
  expect(state.rows.find(row => row.id.endsWith(':permissions'))?.value).toBe('permissions')
  const before = [...h.requests]
  await Promise.all([state.connectionList.onOpenTerminal!(), state.connectionList.onOpenTerminal!()])
  expect(h.terminalCalls).toBe(1)
  expect(h.requests).toEqual(before)
  expect(h.csrfReads).toBe(0)
  await state.connectionList.onAddExchange!()
  expect(h.state.kind).toBe('exchange')
  expect(h.requests).toEqual(before)
  h.controller.dispose()
})

for (const retirement of ['session', 'disposed'] as const) test(`이전 완료 콜백은 ${retirement} 이후 터미널을 열지 않는다`, async () => {
  const h = harness()
  await h.controller.load()
  const state = h.state
  if (state.kind !== 'complete') throw Error('Wrong state')
  if (retirement === 'session') h.changeSession(); else h.controller.dispose()
  await state.connectionList!.onOpenTerminal!()
  expect(h.terminalCalls).toBe(0)
  expect(h.requests.every(request => request.startsWith('GET '))).toBe(true)
  h.controller.dispose()
})

test('원본 목록 해제는 기존 CSRF·중복방지·local-only 안내를 재사용한다', async () => {
  const h = harness()
  await h.controller.load()
  const state = h.state
  if (state.kind !== 'complete') throw Error('Wrong state')
  const disconnect = state.connectionList!.accounts[0].onDisconnect!
  await Promise.all([disconnect(), disconnect()])
  expect(h.requests.filter(request => request.startsWith('DELETE '))).toHaveLength(1)
  expect(h.csrfReads).toBe(1)
  expect(h.state.kind).toBe('exchange')
  expect(h.state.description).toBe('localRemoved')
  await disconnect()
  expect(h.requests.filter(request => request.startsWith('DELETE '))).toHaveLength(1)
  h.controller.dispose()
})

test('터미널 호스트가 없으면 완료 상태도 터미널 콜백을 만들지 않는다', async () => {
  const h = harness(false)
  await h.controller.load()
  if (h.state.kind !== 'complete') throw Error('Wrong state')
  expect(h.state.connectionList?.onOpenTerminal).toBeUndefined()
  expect(h.terminalCalls).toBe(0)
  h.controller.dispose()
})

test('서버 해제 성공 후 목록 조회가 실패해도 해제한 행이나 재DELETE 권한은 남기지 않는다', async () => {
  const h = harness()
  await h.controller.load()
  const state = h.state
  if (state.kind !== 'complete') throw Error('Wrong state')
  const disconnect = state.connectionList!.accounts[0].onDisconnect!
  h.failConnectionReads()
  await disconnect()
  expect(h.state.kind).toBe('exchange')
  expect(h.state.description).toContain('localRemoved')
  expect(h.requests.filter(request => request.startsWith('DELETE '))).toHaveLength(1)
  await disconnect()
  expect(h.requests.filter(request => request.startsWith('DELETE '))).toHaveLength(1)
  h.controller.dispose()
})

test('일시적 세션 확인 실패는 확인했던 연결 목록을 미연결 화면으로 바꾸지 않는다', async () => {
  const h = harness()
  await h.controller.load()
  const state = h.state
  if (state.kind !== 'complete') throw Error('Wrong state')
  h.failSession()
  await state.connectionList!.onOpenTerminal!()
  expect(h.terminalCalls).toBe(0)
  expect(h.state.kind).toBe('complete')
  expect(h.state.description).toBe('failed')
  expect(h.requests.every(request => request.startsWith('GET '))).toBe(true)
  h.controller.dispose()
})

test('이전 소유자의 추가 연결 콜백은 원본 목록을 다시 열지 않는다', async () => {
  const h = harness()
  await h.controller.load()
  const state = h.state
  if (state.kind !== 'complete') throw Error('Wrong state')
  h.changeSession()
  await state.connectionList!.onAddExchange!()
  expect(h.state.kind).toBe('exchange')
  if (h.state.kind !== 'exchange') throw Error('Wrong state')
  expect(h.state.exchanges).toBeNull()
  expect(h.requests.every(request => request.startsWith('GET '))).toBe(true)
  h.controller.dispose()
})

test('실제 React hook은 원본 완료 목록에서 내부 터미널로 이동하며 거래 요청을 보내지 않는다', async ({ page }) => {
  const mutations: string[] = []
  const jsonHeaders = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
  const meta = { apiContractVersion: '0.1.0', requestId: 'request_terminal_fixture_001', traceId: 'trace_terminal_fixture_0001', resourceRevision: '1' }
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 200,
    headers: { ...jsonHeaders, ETag: '"terminal_session_fixture_etag"' }, body: JSON.stringify({ meta,
      data: { sessionId: 'session_exchange_fixture_0001', state: 'AUTHENTICATED', revision: '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) }))
  await page.route('**/api/v1/exchange-connections/**', route => {
    const request = route.request()
    if (request.method() !== 'GET') mutations.push(request.method() + ' ' + new URL(request.url()).pathname)
    const data = new URL(request.url()).pathname.endsWith('/catalog')
      ? { providers: ['bybit', 'bitget', 'bingx', 'gate', 'mexc', 'htx'].map(exchangeId => ({ exchangeId, available: exchangeId === 'bitget', reason: exchangeId === 'bitget' ? null : 'PROVIDER_UNAVAILABLE' })) }
      : { connections: [{ connectionId, exchangeId: 'bitget', maskedAccountLabel: '12****34', connectedAt: '2030-01-01T00:00:00Z', status: 'connected', permissionsVerified: false, permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false } }] }
    return route.fulfill({ status: 200, headers: jsonHeaders, body: envelope(data) })
  })
  await page.goto('/exchange-connect-fixture.html')
  await expect(page.locator('[data-stage=exchange-connection-list]')).toBeVisible()
  await expect(page.getByText('12****34', { exact: true })).toBeVisible()
  await expect(page.locator('.nsp-plan')).toHaveCount(0)
  await page.getByRole('button', { name: '터미널 열기', exact: true }).click()
  await expect(page).toHaveURL(/\/#\/trade$/)
  expect(mutations).toEqual([])
})
