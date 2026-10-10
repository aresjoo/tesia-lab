import type { ConnectionsResponse } from '../internal-poc/contracts/generated/api-v0.12/types.js'
import type { NativeAccountPresentation } from '../internal-poc/native-account-presentation'
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
