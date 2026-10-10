import { expect, test } from '@playwright/test'
import { connectedAccountPresentation, observedAccountPresentation } from '../../src/exchange-connect/account-presentation'
import { accountPresentationBound } from '../../src/internal-poc/native-account-presentation'
import type { AccountResponse } from '../../src/internal-poc/contracts/generated/api-v0.17/types.js'
import type { ConnectionsResponse } from '../../src/internal-poc/contracts/generated/api-v0.12/types.js'

const connection: ConnectionsResponse['data']['connections'][number] = { connectionId: 'connection_account_read_001', exchangeId: 'bitget', connectedAt: '2030-01-01T00:00:00Z',
  status: 'connected', maskedAccountLabel: '***0001', permissionsVerified: true, permissions: { read: true, spotTrade: false, futuresTrade: false, withdrawal: false } }
const metadata = () => connectedAccountPresentation('owner', [connection], key => key, async () => {})
function observation(): AccountResponse {
  return { apiContractVersion: '0.17.0', data: { connectionId: connection.connectionId, exchangeId: 'bitget', accountMode: 'classic', observedAt: '2030-01-01T00:00:01Z',
    products: (['spot', 'USDT-FUTURES', 'USDC-FUTURES', 'COIN-FUTURES'] as const).map(product => ({ product,
      balances: { status: 'ok', reason: null, items: [] }, positions: { status: product === 'spot' ? 'not_applicable' : 'ok', reason: null, items: [] } })) } }
}
function balance(coin: string, value: string) { return { coin, balance: value, equity: value, available: value, frozen: null, locked: null, unrealizedPnl: null } }

test('balance rows preserve exact decimal strings and never sum coins or products', () => {
  const wire = observation()
  wire.data.products[0].balances.items = [balance('BTC', '0.000000000000000001'), balance('USDT', '9007199254740993.123456789012345678')]
  wire.data.products[1].balances.items = [balance('USDT', '7.000000000000000000')]
  const data = observedAccountPresentation(metadata(), [wire])
  expect(data.ledger.assets).toHaveLength(3)
  expect(data.ledger.assets?.map(row => row.cells.equity)).toEqual(['0.000000000000000001 BTC', '9007199254740993.123456789012345678 USDT', '7.000000000000000000 USDT'])
  expect(data.ledger.assets?.every(row => row.cells.used === '—' && row.cells.unrealized === '—')).toBe(true)
  expect(data.ledger.assets?.map(row => row.asset?.description)).toEqual(['spot · BTC', 'spot · USDT', 'USDT-FUTURES · USDT'])
  expect(accountPresentationBound(data, 'owner')).toBe(true)
})

test('provider positions retain exchange origin without guessed strategy, price or percent', () => {
  const wire = observation()
  wire.data.products[1].positions.items = [{ symbol: 'BTCUSDT', side: 'short', quantity: '0.000000000000000001', entryPrice: '98765.00000000000001', markPrice: null, unrealizedPnl: '-0.000000000000001', marginCoin: 'USDT' }]
  const data = observedAccountPresentation(metadata(), [wire]), row = data.ledger.pos![0]
  expect(row.origin).toBe('exchange'); expect(row.strategyId).toBeUndefined(); expect(row.trade).toBeUndefined()
  expect(row.cells).toMatchObject({ strategy: '—', quantity: '0.000000000000000001', entry: '98765.00000000000001', current: '—', unrealized: '-0.000000000000001 USDT', percent: '—' })
  expect(data.strategies).toBeNull(); expect(accountPresentationBound(data, 'owner')).toBe(true)
  for (const tab of ['orders', 'open', 'fills', 'closed'] as const) expect(data.ledger[tab]).toBeNull()
})

test('confirmed empty differs from unavailable and any partial failure invalidates its whole pane', () => {
  const wire = observation()
  expect(observedAccountPresentation(metadata(), [wire]).ledger).toMatchObject({ pos: [], assets: [] })
  wire.data.products[1].positions = { status: 'unavailable', reason: 'PROVIDER_FAILED', items: [] }
  wire.data.products[0].balances = { status: 'unavailable', reason: 'RATE_LIMITED', items: [] }
  expect(observedAccountPresentation(metadata(), [wire]).ledger).toMatchObject({ pos: null, assets: null })
  wire.data.products[2].balances.items = [balance('USDC', '1.00')]
  wire.data.products[2].positions.items = [{ symbol: 'ETHUSDC', side: 'long', quantity: '1', entryPrice: null, markPrice: null, unrealizedPnl: null, marginCoin: 'USDC' }]
  expect(observedAccountPresentation(metadata(), [wire]).ledger).toMatchObject({ assets: null, pos: null })
  expect(observedAccountPresentation(metadata(), []).ledger).toMatchObject({ pos: null, assets: null })
})

test('wallet balance and native locked funds cannot supply equity or total used', () => {
  const wire = observation()
  wire.data.products[0].balances.items = [{ ...balance('USDT', '100.00000001'), equity: null, frozen: '99.1234', locked: '12.1234', unrealizedPnl: '-50.0001' }]
  const data = observedAccountPresentation(metadata(), [wire])
  expect(data.ledger.assets?.[0].cells).toMatchObject({ equity: '—', used: '—', available: '100.00000001 USDT', unrealized: '-50.0001 USDT' })
})

test('unified balances do not duplicate futures-category balances and foreign snapshots are discarded', () => {
  const wire = observation(); wire.data.accountMode = 'uta'
  wire.data.products[0].product = 'unified'
  wire.data.products[0].balances.items = [balance('BTC', '0.1')]
  for (const product of wire.data.products.slice(1)) product.balances = { status: 'not_applicable', reason: null, items: [] }
  expect(observedAccountPresentation(metadata(), [wire]).ledger.assets).toHaveLength(1)
  wire.data.connectionId = 'connection_foreign_account_001'
  expect(observedAccountPresentation(metadata(), [wire]).ledger).toMatchObject({ pos: null, assets: null })
})
