import { expect, test } from '@playwright/test'
import { accountPresentationBound, type NativeAccountPresentation, type NativeAccountLedgerRow, type NativeAccountLedgerTab } from '../../src/internal-poc/native-account-presentation'

function presentation(tab: NativeAccountLedgerTab, row: NativeAccountLedgerRow): NativeAccountPresentation {
  return { scope: 'owner', identity: 'observed-account', sourceLabel: 'Bitget', strategies: null,
    accounts: [{ id: 'connection', kind: 'account', title: 'Bitget', sourceLabel: 'Bitget', fields: [], sections: [] }],
    ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null, [tab]: [row] } }
}
const exchangeRow: NativeAccountLedgerRow = { id: 'observed-position', accountId: 'connection', origin: 'exchange', cells: { strategy: '—', quantity: '0.000000000000000001' } }

test('exchange positions and assets bind to a supplied owner account without inventing a strategy', () => {
  for (const tab of ['pos', 'assets'] as const) expect(accountPresentationBound(presentation(tab, exchangeRow), 'owner')).toBe(true)
  expect(accountPresentationBound(presentation('pos', exchangeRow), 'another-owner')).toBe(false)
  expect(accountPresentationBound(presentation('pos', { ...exchangeRow, accountId: 'foreign-connection' }), 'owner')).toBe(false)
  expect(accountPresentationBound({ ...presentation('pos', exchangeRow), accounts: null }, 'owner')).toBe(false)
})

test('exchange origin cannot bypass strategy bindings for orders or claim a TETH trade', () => {
  for (const tab of ['open', 'orders', 'fills', 'closed'] as const) expect(accountPresentationBound(presentation(tab, exchangeRow), 'owner')).toBe(false)
  expect(accountPresentationBound(presentation('pos', { ...exchangeRow, strategyId: 'invented' }), 'owner')).toBe(false)
  expect(accountPresentationBound(presentation('pos', { ...exchangeRow, trade: { id: 'invented', versionIdentity: 'invented' } }), 'owner')).toBe(false)
  const ordinaryRow = { ...exchangeRow, origin: undefined }
  expect(accountPresentationBound(presentation('pos', ordinaryRow), 'owner')).toBe(false)
})
