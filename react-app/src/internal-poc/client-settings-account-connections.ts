import { planExchanges, type PlanExchange } from '../client-connection-plan'
import { connectionPresentationBound, type ConnectionAction, type NativeConnectionPresentation } from './native-connection-presentation'

export type ClientSettingsAccountConnection = {
  id: string
  exchange: PlanExchange
  exchangeLabel: string
  maskedAccountLabel?: string
  access?: 'invitation' | 'subscription' | 'subscription-ended'
  onDisconnect?: ConnectionAction
}

/** Private presentation for the settings surface. It carries observed display
 * facts and callbacks only; it does not grant exchange or execution authority. */
export type ClientSettingsAccountConnectionsPresentation = {
  scope: string
  identity: string
  revision: string
  accounts: readonly ClientSettingsAccountConnection[]
}

export function settingsAccountConnectionOwner(scope: string, identity: string) {
  return JSON.stringify([scope, identity])
}

const accountAccesses = new Set(['invitation', 'subscription', 'subscription-ended'])
function safeMaskedAccountLabel(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string' && value.length <= 64
    && ![...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    && /[•*]/.test(value)
}

export function projectSettingsAccountConnections(
  value: NativeConnectionPresentation | undefined,
  scope: string | null | undefined,
): ClientSettingsAccountConnectionsPresentation | undefined {
  if (!connectionPresentationBound(value, scope) || value.status !== 'ready' || value.state.kind !== 'complete') return undefined
  const list = value.state.connectionList
  if (!list || !Array.isArray(list.accounts) || !list.accounts.length) return undefined
  const ids = new Set<string>()
  const accounts: ClientSettingsAccountConnection[] = []
  for (const account of list.accounts) {
    const exchange = planExchanges.find(([id]) => id === account?.exchangeId)
    if (!account || typeof account.id !== 'string' || !account.id.trim() || ids.has(account.id) || !exchange
      || !safeMaskedAccountLabel(account.maskedAccountLabel)
      || account.access !== undefined && !accountAccesses.has(account.access)
      || account.onDisconnect !== undefined && typeof account.onDisconnect !== 'function') return undefined
    ids.add(account.id)
    accounts.push({
      id: account.id,
      exchange: exchange[0],
      exchangeLabel: exchange[1],
      ...(account.maskedAccountLabel === undefined ? {} : { maskedAccountLabel: account.maskedAccountLabel }),
      ...(account.access === undefined ? {} : { access: account.access }),
      ...(account.onDisconnect === undefined ? {} : { onDisconnect: account.onDisconnect }),
    })
  }
  return { scope: value.scope, identity: value.identity, revision: value.state.id, accounts }
}
