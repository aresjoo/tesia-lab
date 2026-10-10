import { expect, test } from '@playwright/test'
import { createExchangeConnectionController, isTransientExchangeReadFailure } from '../../src/exchange-connect/controller'
import { ApiResponseError } from '../../src/internal-poc/contracts/generated/api-v0.1/client.js'
import { ApiV12Error } from '../../src/internal-poc/contracts/generated/api-v0.12/client.js'
import type { TransactionResponse } from '../../src/internal-poc/contracts/generated/api-v0.12/types.js'
import type { NativeConnectionPresentation } from '../../src/internal-poc/native-connection-presentation'

const id = 'transaction_pending_fixture_001', scope = 'session_pending_fixture_001'
const pending = { transactionId: id, exchangeId: 'bitget' as const, status: 'pending' as const, expiresAt: '2030-01-01T00:10:00Z', authorizationUrl: null, connectionId: null, failureCode: null }
const tick = async () => { for (let i = 0; i < 24; i++) await Promise.resolve() }
function fixture(automaticPolling = false) {
  let view!: NativeConnectionPresentation, reads = 0, cancels = 0, starts = 0, sessionOwner = scope
  let sessionError: unknown, cancelError: unknown, cancelHold: Promise<void> | undefined, releaseCancel!: () => void
  let serverStatus: TransactionResponse['data']['status'] = 'pending', cancelConflict = false
  const response = (status: TransactionResponse['data']['status'] = serverStatus): TransactionResponse => ({ apiContractVersion: '0.12.0', data: { ...pending, status } })
  let hold: Promise<TransactionResponse> | undefined
  let reject!: (error: unknown) => void, release!: (value: TransactionResponse) => void
  const controller = createExchangeConnectionController(scope, {
    client: {
      catalog: async () => ({ apiContractVersion: '0.12.0', data: { providers: (['bitget', 'bybit', 'gate', 'bingx', 'htx', 'mexc'] as const).map(exchangeId => ({ exchangeId, available: true, reason: null })) } }),
      connections: async () => ({ apiContractVersion: '0.12.0', data: { connections: [] } }),
      transaction: async () => { reads++; return hold ? await hold : response() },
      cancel: async () => { cancels++; if (cancelHold) await cancelHold; if (cancelError) throw cancelError; if (cancelConflict) { serverStatus = 'processing'; throw new ApiV12Error('TRANSACTION_REPLAYED', 409) } return { apiContractVersion: '0.12.0', data: { ...pending, status: 'cancelled' } } },
      start: async () => { starts++; throw new Error('UNEXPECTED_START') },
      disconnect: async () => { throw new Error('UNEXPECTED_DISCONNECT') },
    }, currentSession: async () => { if (sessionError) { const error = sessionError; sessionError = undefined; throw error } return { sessionId: sessionOwner, state: 'AUTHENTICATED' } }, csrf: async () => 'synthetic-csrf',
    automaticPolling, navigateToExchange: () => { throw new Error('UNEXPECTED_NAVIGATION') }, text: key => key, onChange: next => { view = next },
  })
  return { controller, view: () => view, counts: () => ({ reads, cancels, starts }),
    choose: (action: string) => view.state.kind === 'exchange' ? view.state.onChoose!(action) : Promise.resolve(),
    hold: () => { hold = new Promise((resolve, fail) => { release = resolve; reject = fail }) },
    release: (status: TransactionResponse['data']['status'] = 'pending') => { serverStatus = status; hold = undefined; release(response(status)) },
    reject: () => { hold = undefined; reject(new ApiV12Error('TRANSPORT_FAILED')) },
    sessionFailure: (error: unknown) => { sessionError = error },
    holdCancel: () => { cancelHold = new Promise(resolve => { releaseCancel = resolve }) },
    rejectCancel: () => { cancelError = new ApiV12Error('TRANSPORT_FAILED'); releaseCancel() },
    claimBeforeCancel: () => { cancelConflict = true },
    switchOwner: () => { sessionOwner = 'session_foreign_fixture_002' },
  }
}

test('cancel intent is handled once after in-flight observation rather than silently dropped', async () => {
  const f = fixture(); await f.controller.load(id)
  f.hold(); const refresh = f.choose('refresh'); await tick()
  const first = f.choose('cancel'), second = f.choose('cancel')
  expect(f.counts().cancels).toBe(0)
  f.release(); await Promise.all([refresh, first, second])
  expect(f.counts()).toEqual({ reads: 2, cancels: 1, starts: 0 })
  expect(f.controller.hasObservedTransaction(id)).toBe(false)
  f.controller.dispose()
})

for (const boundary of ['processing', 'owner', 'disposed'] as const) test(`queued cancel respects ${boundary} boundary`, async () => {
  const f = fixture(); await f.controller.load(id)
  f.hold(); const refresh = f.choose('refresh'); await tick()
  const cancel = f.choose('cancel')
  if (boundary === 'owner') f.switchOwner()
  if (boundary === 'disposed') f.controller.dispose()
  f.release(boundary === 'processing' ? 'processing' : 'pending')
  await Promise.all([refresh, cancel])
  expect(f.counts().cancels).toBe(0); expect(f.counts().starts).toBe(0)
  f.controller.dispose()
})

test('transient observation failure retains pending actions and explicit GET recovers without replacement', async () => {
  const f = fixture(); await f.controller.load(id)
  f.hold(); const refresh = f.choose('refresh'); await tick(); f.reject(); await refresh
  expect(f.view().status).toBe('ready'); expect(f.controller.hasObservedTransaction(id)).toBe(true)
  expect(f.view().state.description).toBe('pendingReadFailed')
  expect(f.view().state.id).toMatch(/^pending:/)
  await f.choose('refresh')
  expect(f.view().status).toBe('ready'); expect(f.controller.hasObservedTransaction(id)).toBe(true)
  expect(f.counts()).toEqual({ reads: 3, cancels: 0, starts: 0 })
  f.controller.dispose()
})

test('automatic transient poll failure retains pending and recovers by GET without START or DELETE', async () => {
  const f = fixture(true)
  try {
    await f.controller.load(id); f.hold()
    await expect.poll(() => f.counts().reads).toBe(2)
    f.reject()
    await expect.poll(() => f.view().state.description).toBe('pendingReadFailed')
    expect(f.view().status).toBe('ready')
    expect(f.view().state.id).toMatch(/^pending:/)
    await expect.poll(() => f.counts().reads).toBe(3)
    await expect.poll(() => f.view().state.description).toBe('pending')
    expect(f.view().status).toBe('ready')
    expect(f.counts()).toEqual({ reads: 3, cancels: 0, starts: 0 })
  } finally { f.controller.dispose() }
})

test('callback claim racing explicit cancel uses one DELETE then same transaction GET and protects processing', async () => {
  const f = fixture(); await f.controller.load(id); f.claimBeforeCancel()
  await f.choose('cancel')
  expect(f.counts()).toEqual({ reads: 2, cancels: 1, starts: 0 })
  expect(f.view().status).toBe('ready'); expect(f.view().state.id).toMatch(/^pending:/)
  expect(f.controller.hasObservedTransaction(id)).toBe(true)
  if (f.view().state.kind === 'exchange') expect(f.view().state.exchanges?.map(item => item.id)).toEqual(['refresh'])
  f.controller.dispose()
})

test('queued cancel loses callback claim safely and automatic processing observation continues', async () => {
  const f = fixture(true)
  try {
    await f.controller.load(id); f.hold()
    await expect.poll(() => f.counts().reads).toBe(2)
    const cancel = f.choose('cancel'); f.release('processing'); await cancel
    expect(f.counts().cancels).toBe(0)
    if (f.view().state.kind === 'exchange') expect(f.view().state.exchanges?.some(item => item.id === 'cancel')).toBe(false)
    await expect.poll(() => f.counts().reads).toBe(3)
    expect(f.controller.hasObservedTransaction(id)).toBe(true)
    expect(f.counts().starts).toBe(0)
  } finally { f.controller.dispose() }
})

// Direct class observation is separate from the SDK session operation: its
// existing wire manifest allows only401, so app gateway refusal covers503 wire.
test('Opus M1 direct controller session ApiResponseError503 preserves observed pending', async () => {
  const f = fixture(); await f.controller.load(id)
  f.sessionFailure(new ApiResponseError(503, { error: { code: 'INTERNAL_ERROR', message: 'Synthetic server unavailable' }, meta: {
    apiContractVersion: '0.1.0', resourceRevision: null, requestId: 'req_pending_fixture_001', traceId: 'trace_pending_fixture_001' } }))
  await f.choose('refresh')
  expect(f.view().status).toBe('ready'); expect(f.view().state.id).toMatch(/^pending:/)
  expect(f.view().state.description).toBe('pendingReadFailed')
  expect(f.controller.hasObservedTransaction(id)).toBe(true)
  await f.choose('refresh'); expect(f.counts()).toEqual({ reads: 2, cancels: 0, starts: 0 })
  f.controller.dispose()
})

test('Opus L8 cancel mutation double click coalesces despite first transport failure', async () => {
  const f = fixture(); await f.controller.load(id); f.holdCancel()
  const first = f.choose('cancel'); await tick()
  expect(f.counts().cancels).toBe(1)
  const second = f.choose('cancel'); f.rejectCancel(); await Promise.all([first, second])
  expect(f.counts().cancels).toBe(1)
  expect(f.controller.hasObservedTransaction(id)).toBe(true); expect(f.counts().starts).toBe(0)
  f.controller.dispose()
})

test('Opus L8 failed refresh after polling deadline keeps its failure notice', async () => {
  const original = Date.now, f = fixture(true)
  let now = original(); Date.now = () => now
  try {
    await f.controller.load(id); f.controller.stopPolling()
    // A fresh epoch load keeps the existing finite deadline; the timer is
    // cleared before synthetic wall time advances, avoiding a real5min wait.
    await f.controller.load(id); f.hold()
    const refresh = f.choose('refresh'); await tick(); now += 300_001
    f.reject(); await refresh
    expect(f.view().state.description).toBe('pendingReadFailed')
    expect(f.view().status).toBe('ready'); expect(f.counts().starts).toBe(0)
  } finally { f.controller.dispose(); Date.now = original }
})


test('Opus M1 invalid response status never gains transient authority', () => {
  for (const status of [429, 500, 502, 503, 504]) {
    expect(isTransientExchangeReadFailure(new ApiV12Error('INVALID_RESPONSE', status))).toBe(false)
  }
  expect(isTransientExchangeReadFailure(new Error('INVALID_ERROR_STATUS_POLICY'))).toBe(false)
  expect(isTransientExchangeReadFailure(new SyntaxError('Synthetic invalid JSON'))).toBe(false)
  expect(isTransientExchangeReadFailure(new ApiV12Error('PERMISSION_REJECTED', 403))).toBe(false)
})
