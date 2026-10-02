import { planExchanges, type PlanExchange } from './client-connection-plan'

export const CONNECTION_STATUS_SOURCE_SHA = '9fbff821df62cad11d026022fc7628c7fcebc431'
export type ConnectionStatusSource = 'mock' | 'service'
/** Observed display labels only, not credentials, entitlements or an order schema. */
export type ConnectionStatusRecord = {
  id: string; exchange: PlanExchange; route: 'partner' | 'paid'
  maskedAccountLabel?: string; eligibility: 'eligible' | 'expired' | 'unknown'
}
export type ConnectionStatusState =
  | { kind: 'authorization_result'; exchange: PlanExchange; authorization: 'idle' | 'pending' | 'failed' | 'cancelled'; invitationRouteAvailable?: boolean }
  | { kind: 'invitation_verifying'; exchange: PlanExchange; maskedAccountLabel?: string; accountChecked?: boolean }
  | { kind: 'not_invited'; exchange: PlanExchange }
  | { kind: 'connected_done'; connection: ConnectionStatusRecord; strategyName?: string; continuation?: 'copy' | 'backtest' | 'terminal' }
  | { kind: 'strategy_start_after_connection'; connection: ConnectionStatusRecord; strategyName: string; amountLabel: string; feeLabel: string }
  | { kind: 'connected_list'; connections: readonly ConnectionStatusRecord[] }
  | { kind: 'subscription_expired'; connection: ConnectionStatusRecord }
  | { kind: 'disconnect_confirmation'; connection: ConnectionStatusRecord }
  | { kind: 'kyc_before_start'; connection: ConnectionStatusRecord; kyc: 'none' | 'running' | 'review' | 'error' | 'verified' | 'failed' }
  | { kind: 'eligible_my_exchange_filter'; connections: readonly ConnectionStatusRecord[]; selected: 'all' | 'off' | PlanExchange; empty?: boolean }
export type ConnectionStatusAction = 'authorize' | 'invitationRoute' | 'newAccount' | 'subscribe' | 'chooseExchange'
  | 'continue' | 'addExchange' | 'startLive' | 'startPaper' | 'startLater' | 'terminal' | 'disconnect'
  | 'openKyc' | 'refresh' | 'filter' | 'help'
export type ConnectionStatusRequest = {
  scope: string; identity: string; source: ConnectionStatusSource; action: ConnectionStatusAction
  exchange?: PlanExchange; connectionId?: string; selection?: 'all' | 'off' | PlanExchange
}
export type ConnectionStatusPresentation = {
  scope: string
  /** The supplying owner changes this identity when an observation is replaced. */
  identity: string
  source: ConnectionStatusSource
  state: ConnectionStatusState
  actions?: Partial<Record<ConnectionStatusAction, (request: ConnectionStatusRequest, signal: AbortSignal) => Promise<void>>>
}
const label = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 255
  && [...value].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
const exchange = (value: unknown): value is PlanExchange => planExchanges.some(([id]) => id === value)
const masked = (value: unknown) => value === undefined || typeof value === 'string' && /^\d{2}[•*]{4}\d{2}$/.test(value)
function record(value: ConnectionStatusRecord): boolean {
  return !!value && label(value.id) && exchange(value.exchange) && ['partner', 'paid'].includes(value.route)
    && ['eligible', 'expired', 'unknown'].includes(value.eligibility) && masked(value.maskedAccountLabel)
}
function records(values: readonly ConnectionStatusRecord[]): boolean {
  return Array.isArray(values) && values.length <= 7 && values.every(record)
    && new Set(values.map(item => item.id)).size === values.length
    && new Set(values.map(item => item.exchange)).size === values.length
}
export function boundConnectionStatus(presentation: ConnectionStatusPresentation | undefined, scope: string | null,
  source: ConnectionStatusSource): ConnectionStatusPresentation | undefined {
  if (!presentation || !label(scope) || presentation.scope !== scope || !label(presentation.identity)
    || !['mock', 'service'].includes(source) || presentation.source !== source) return undefined
  const state = presentation.state
  if (!state || typeof state !== 'object') return undefined
  switch (state.kind) {
    case 'authorization_result':
      if (!exchange(state.exchange) || !['idle', 'pending', 'failed', 'cancelled'].includes(state.authorization)
        || state.invitationRouteAvailable !== undefined && typeof state.invitationRouteAvailable !== 'boolean') return undefined
      break
    case 'invitation_verifying':
      if (!exchange(state.exchange) || !masked(state.maskedAccountLabel)
        || state.accountChecked !== undefined && typeof state.accountChecked !== 'boolean') return undefined
      break
    case 'not_invited': if (!exchange(state.exchange)) return undefined; break
    case 'connected_list': if (!records(state.connections)) return undefined; break
    case 'eligible_my_exchange_filter':
      if (!records(state.connections) || !['all', 'off'].includes(state.selected) && !exchange(state.selected)
        || state.empty !== undefined && typeof state.empty !== 'boolean') return undefined
      break
    case 'connected_done':
      if (!record(state.connection) || state.connection.eligibility !== 'eligible'
        || state.strategyName !== undefined && !label(state.strategyName)
        || state.continuation !== undefined && !['copy', 'backtest', 'terminal'].includes(state.continuation)) return undefined
      break
    case 'strategy_start_after_connection':
      if (!record(state.connection) || state.connection.eligibility !== 'eligible'
        || ![state.strategyName, state.amountLabel, state.feeLabel].every(label)) return undefined
      break
    case 'subscription_expired':
      if (!record(state.connection) || state.connection.eligibility !== 'expired' || state.connection.route !== 'paid') return undefined
      break
    case 'disconnect_confirmation': if (!record(state.connection)) return undefined; break
    case 'kyc_before_start':
      if (!record(state.connection) || state.connection.eligibility !== 'eligible'
        || !['none', 'running', 'review', 'error', 'verified', 'failed'].includes(state.kyc)) return undefined
      break
    default: return undefined
  }
  return presentation
}
