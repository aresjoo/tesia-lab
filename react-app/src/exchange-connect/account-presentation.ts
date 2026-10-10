import type { ConnectionsResponse } from '../internal-poc/contracts/generated/api-v0.12/types.js'
import type { AccountResponse, DeepReadonly } from '../internal-poc/contracts/generated/api-v0.17/types.js'
import type { NativeAccountLedgerRow, NativeAccountPresentation } from '../internal-poc/native-account-presentation'
import type { ExchangeCopyKey } from './copy'

/** Display only, after generated SDK validation and current-session confirmation.
 * API12 supplies connection metadata, not balances, positions or strategies.
 * Missing financial panes remain null rather than claiming an empty account. */
export function connectedAccountPresentation(scope: string, connections: ConnectionsResponse['data']['connections'],
  text: (key: ExchangeCopyKey) => string, onConnect: () => Promise<void>): NativeAccountPresentation {
  const accounts = connections.filter(item => item.exchangeId === 'bitget' && item.status === 'connected')
  return {
    scope, identity: `bitget-account:${scope}`, sourceLabel: accounts.length ? text('connected') : text('intro'),
    accounts: accounts.map(item => ({
      id: item.connectionId, kind: 'account', title: `Bitget · ${item.maskedAccountLabel}`, sourceLabel: text('connected'),
      fields: [
        { label: text('exchange'), value: 'Bitget' },
        { label: text('account'), value: item.maskedAccountLabel },
        { label: text('access'), value: item.permissionsVerified
          ? [text('read'), ...(item.permissions.spotTrade ? [text('spot')] : []), ...(item.permissions.futuresTrade ? [text('futures')] : [])].join(' · ')
          : text('permissions') },
        { label: text('withdrawLabel'), value: item.permissionsVerified ? text('withdrawal') : text('unverifiedWithdrawal') },
      ], sections: [],
    })),
    strategies: null,
    ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null },
    actions: { onConnect },
  }
}

/** Validated, current-owner observations only. Different coins/products remain
 * separate rows. Missing values and unavailable products are never made zero. */
export function observedAccountPresentation(metadata: NativeAccountPresentation,
  snapshots: readonly DeepReadonly<AccountResponse>[]): NativeAccountPresentation {
  const accounts = new Set((metadata.accounts ?? []).map(item => item.id))
  const observed = snapshots.filter(item => accounts.has(item.data.connectionId))
  const assets: NativeAccountLedgerRow[] = [], positions: NativeAccountLedgerRow[] = []
  let balancesConfirmed = observed.length > 0, positionsConfirmed = observed.length > 0
  const amount = (value: string | null, coin: string | null) => value === null ? '—' : coin ? `${value} ${coin}` : value
  for (const { data } of observed) for (const product of data.products) {
    if (product.balances.status === 'unavailable') balancesConfirmed = false
    if (product.positions.status === 'unavailable') positionsConfirmed = false
    for (const [index, balance] of product.balances.items.entries()) assets.push({
      id: `${data.connectionId}:${product.product}:balance:${balance.coin}:${index}`, accountId: data.connectionId, origin: 'exchange',
      cells: { exchange: 'Bitget', equity: amount(balance.equity, balance.coin),
        available: amount(balance.available, balance.coin), used: '—',
        unrealized: amount(balance.unrealizedPnl, balance.coin) },
      asset: { exchange: { name: 'Bitget' }, description: `${product.product} · ${balance.coin}` },
    })
    for (const [index, position] of product.positions.items.entries()) positions.push({
      id: `${data.connectionId}:${product.product}:position:${position.symbol}:${position.side}:${index}`,
      accountId: data.connectionId, origin: 'exchange',
      cells: { exchange: 'Bitget', strategy: '—', symbol: position.symbol, side: position.side.toUpperCase(),
        quantity: position.quantity, entry: amount(position.entryPrice, null), current: amount(position.markPrice, null),
        stop: '—', unrealized: amount(position.unrealizedPnl, position.marginCoin), percent: '—' },
    })
  }
  // A pane cannot imply a complete account observation when any applicable
  // section/account is unavailable, even if another product supplied rows.
  if (observed.length !== accounts.size) { balancesConfirmed = false; positionsConfirmed = false }
  return { ...metadata, ledger: { ...metadata.ledger,
    assets: balancesConfirmed ? assets : null,
    pos: positionsConfirmed ? positions : null } }
}

/** Finite advisory only; stored connection/permissions remain separate facts. */
export function accountObservationFailure(snapshots: readonly DeepReadonly<AccountResponse>[]): AccountResponse['data']['products'][number]['balances']['reason'] | undefined {
  const reasons = new Set(snapshots.flatMap(({ data }) => data.products.flatMap(product =>
    [product.balances, product.positions].filter(section => section.status === 'unavailable').map(section => section.reason))))
  return (['PERMISSION_REJECTED', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE', 'PROVIDER_FAILED'] as const).find(reason => reasons.has(reason))
}
