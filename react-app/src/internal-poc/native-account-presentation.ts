import type { ClientTerminalStrategy } from '../client-terminal-view'
import type { ClientAgentFeedProps } from '../components/ClientAgentFeed'
import type { ClientStrategyActionsProps, ClientStrategyActionCallbacks } from '../components/ClientStrategyActions'
import type { PriceChartView } from '../chart/price-chart-view'
import { safeClientAccountHash, type ClientAccountLocation } from '../client-account-navigation'
import type { AccountAlertsFilter, AccountBotPresentation, AccountPeriodicPresentation, AccountPlanPresentation, AccountReviewPresentation, AccountViewTone } from '../client-account-presentation'
import type { NativeTerminalCompletedData, NativeTerminalDashboardData, NativeTerminalDashboardProps } from './native-terminal-view-presentation'
import type { ClientTradeLifecycleProps } from '../components/ClientTradeLifecycle'
import type { ClientEmailChangeRequest } from '../client-settings-email-presentation'
import type { ClientSecurityActions, ClientSecurityPresentation } from '../client-settings-security-presentation'
import type { ClientBillingActions, ClientBillingPresentation } from '../client-settings-billing-presentation'

/** React display input only, NOT a transport schema or execution/entitlement authority.
 * The authenticated caller binds every row/chart/public event to scope + identity.
 * All financial strings are supplied facts, never recomputed from preview records. */
export type NativeAccountField = { label: string; value: string; tone?: 'up' | 'dn' | 'zz' }
/** Display-only observed trade evidence, never an execution receipt or HTTP schema.
 * versionIdentity must equal the owning strategy's supplied version. Omitted
 * steps are not reconstructed; [] means an explicitly empty observed record. */
export type NativeAccountTradeLifecycle = {
  tradeId: string
  versionIdentity: string
  title: string
  regionLabel?: string
  steps: ClientTradeLifecycleProps['steps']
}
export type NativeAccountDocument = {
  presentation?: { kind: 'bot'; view: AccountBotPresentation } | { kind: 'review'; view: AccountReviewPresentation } | { kind: 'periodic'; view: AccountPeriodicPresentation }
  id: string
  kind: 'bot' | 'review' | 'periodic' | 'account'
  title: string
  sourceLabel: string
  strategyId?: string
  fields: readonly NativeAccountField[]
  sections: readonly { id: string; title: string; text?: string; fields?: readonly NativeAccountField[] }[]
  links?: readonly { label: string; target: ClientAccountLocation }[]
}
export type NativeAccountStrategy = {
  strategy: ClientTerminalStrategy
  accountId: string
  chart: PriceChartView | null
  contextStatus?: string
  /** Public observed explanations only. No private model reasoning or authority. */
  agent: Omit<ClientAgentFeedProps, 'strategyId' | 'onReconnect'>
  dashboard: readonly NativeAccountField[] | null
  /** Original terminal bodies consume explicit facts; legacy dashboard fields remain supplementary. */
  dashboardPresentation?: NativeTerminalDashboardData | null
  completedPresentation?: NativeTerminalCompletedData | null
  tradeLifecycles?: readonly NativeAccountTradeLifecycle[] | null
  terminalActions?: Pick<NativeTerminalDashboardProps, 'onOpenTrade' | 'onOpenPosition' | 'onOpenVersions'>
  versionHistory?: ClientStrategyActionsProps['versionHistory']
}
export type NativeAccountLedgerTab = 'pos' | 'open' | 'orders' | 'fills' | 'closed' | 'assets'
export type NativeAccountLedgerColumn = 'exchange' | 'strategy' | 'symbol' | 'side' | 'quantity' | 'entry' | 'current' | 'stop' | 'unrealized' | 'percent' | 'type' | 'price' | 'status' | 'rule' | 'date' | 'fee' | 'exit' | 'holding' | 'realized' | 'equity' | 'available' | 'used'
export type NativeAccountLedgerRow = {
  id: string
  accountId: string
  /** Assets are account-wide; every other row must identify its strategy. */
  strategyId?: string
  cells: Readonly<Partial<Record<NativeAccountLedgerColumn, string>>>
  tone?: 'up' | 'dn' | 'zz'
  /** Optional supplied account/review/periodic destination, never inferred from index. */
  target?: ClientAccountLocation
  /** Source asset-card labels, supplied verbatim. No account balance/count is derived. */
  asset?: {
    exchange: { name: string; color?: string; foreground?: string }
    strategyCountLabel?: string
    description?: string
  }
  /** Explicit observed trade identity, not an index, order permission or guessed fill ID. */
  trade?: { id: string; versionIdentity: string }
}
export type NativeAccountPlanData = {
  presentation?: AccountPlanPresentation
  title: string
  sourceLabel: string
  sections: Readonly<Record<'plan' | 'rebates' | 'alerts', readonly { id: string; title: string; text?: string; fields?: readonly NativeAccountField[] }[] | null>>
  links?: NativeAccountDocument['links']
  preferences?: readonly { id: string; label: string; checked: boolean; disabled?: boolean }[]
}
export type NativeAccountNotification = {
  id: string
  type: 'credit' | 'pos' | 'bot' | 'review' | 'rebate' | 'report' | 'bill'
  title: string
  body?: string
  timeLabel: string
  read: boolean
  /** Supplied display text and tone; never parsed from the title or recalculated. */
  move?: { label: string; tone: AccountViewTone }
  target?: ClientAccountLocation
}
/** In-memory navigation state, scoped to the authenticated account dataset. */
export type NativeAccountAlertsView = { scope: string; identity: string; filter: AccountAlertsFilter }
export type NativeAccountPresentation = {
  /** Optional independent, owner-bound market display supplier. Not order authority. */
  marketSource?: import('../client-terminal-market-source').TerminalMarketSource
  /** Supplied public profile labels; never inferred from authentication credentials. */
  profile?: { name: string; email?: string; handle?: string }
  security?: ClientSecurityPresentation
  billing?: ClientBillingPresentation
  /** Confirmed session/owner identity. Parent also passes current accountScope. */
  scope: string
  /** Change only when replacing the account dataset, not for ordinary row updates. */
  identity: string
  sourceLabel: string
  strategies: readonly NativeAccountStrategy[] | null
  /** null = not supplied; [] = confirmed empty for that pane. */
  ledger: Readonly<Record<NativeAccountLedgerTab, readonly NativeAccountLedgerRow[] | null>>
  accounts: readonly NativeAccountDocument[] | null
  documents?: readonly NativeAccountDocument[]
  plan?: NativeAccountPlanData
  notifications?: readonly NativeAccountNotification[] | null
  /** Caller-supplied balance/status wording, not a derived credit entitlement. */
  creditLabel?: string
  initialSelectedId?: string
  exchanges?: ClientStrategyActionsProps['exchanges']
  actions?: ClientStrategyActionCallbacks & {
    /** UI ports only. Host must use approved account operations and refresh the
     * supplied profile. Abort discards observation, not a server-side mutation. */
    onProfileName?: (value: string, signal: AbortSignal) => Promise<void>
    onProfileHandle?: (value: string, signal: AbortSignal) => Promise<void>
    onEmailChange?: ClientEmailChangeRequest
    security?: ClientSecurityActions
    billing?: ClientBillingActions
    /** Explicit supplied CTA identifiers; never interpreted as order authority. */
    onDocumentAction?: (documentId: string, actionId: string) => Promise<void>
    onPlanAction?: (actionId: string) => Promise<void>
    onReconnect?: (id: string) => Promise<void>
    onMessage?: (id: string, message: string) => Promise<void>
    onPreference?: (id: string, checked: boolean) => Promise<void>
    onConnect?: () => Promise<void>
    onRead?: (id: string) => Promise<void>
    onReadAll?: () => Promise<void>
  }
}

export const nativeAccountColumns: Record<NativeAccountLedgerTab, readonly NativeAccountLedgerColumn[]> = {
  pos: ['exchange', 'strategy', 'symbol', 'side', 'quantity', 'entry', 'current', 'stop', 'unrealized', 'percent'],
  open: ['exchange', 'strategy', 'symbol', 'side', 'type', 'price', 'quantity', 'status', 'rule'],
  orders: ['exchange', 'strategy', 'date', 'symbol', 'side', 'type', 'price', 'quantity', 'status'],
  fills: ['exchange', 'strategy', 'date', 'symbol', 'side', 'price', 'quantity', 'fee'],
  closed: ['exchange', 'strategy', 'symbol', 'side', 'entry', 'exit', 'holding', 'fee', 'realized'],
  assets: ['exchange', 'equity', 'available', 'used', 'unrealized'],
}

/** Source table alignment is determined by field meaning, never by parsing supplied text.
 * Its trailing rule-note column is also right-aligned, although not numeric. */
export const nativeAccountNumericColumns: ReadonlySet<NativeAccountLedgerColumn> = new Set([
  'quantity', 'entry', 'current', 'stop', 'unrealized', 'percent', 'price', 'fee', 'exit', 'holding', 'realized', 'equity', 'available', 'used', 'rule',
])

/** Display-route availability only, never an authorization or API lookup.
 * Plan tabs exist without account facts; record views require a matching supplied
 * record. Callers must bind the presentation to its current owner beforehand. */
export function accountLocationAvailable(data: NativeAccountPresentation | undefined, target: ClientAccountLocation): boolean {
  if (safeClientAccountHash(target) === null) return false
  if (target.kind === 'plan') return true
  return target.kind === 'bot' && !!data?.strategies?.some(item => item.strategy.id === target.id)
    || !!data?.documents?.some(document => document.kind === target.kind && document.id === target.id)
}

/** Structural presentation binding, not proof of server authorization/provenance. */
export function accountPresentationBound(data: NativeAccountPresentation | undefined, scope: string | null | undefined): data is NativeAccountPresentation {
  if (!scope || !data || data.scope !== scope || !data.identity || !data.sourceLabel) return false
  const unique = (ids: readonly string[]) => ids.every(id => id.trim().length > 0) && new Set(ids).size === ids.length
  if (!unique((data.strategies ?? []).map(item => item.strategy.id)) || !unique((data.accounts ?? []).map(item => item.id))) return false
  if (!unique((data.notifications ?? []).map(item => item.id))) return false
  const accounts = new Set((data.accounts ?? []).map(item => item.id))
  const strategies = new Map((data.strategies ?? []).map(item => [item.strategy.id, item]))
  if ([...strategies.values()].some(item => !item.accountId || data.accounts !== null && !accounts.has(item.accountId))) return false
  for (const [tab, rows] of Object.entries(data.ledger)) {
    if (!rows) continue
    if (!unique(rows.map(row => row.id))) return false
    if (rows.some(row => !row.accountId || data.accounts !== null && !accounts.has(row.accountId)
      || tab !== 'assets' && (!row.strategyId || !strategies.has(row.strategyId) || strategies.get(row.strategyId)!.accountId !== row.accountId))) return false
  }
  return unique((data.documents ?? []).map(document => `${document.kind}:${document.id}`))
    && (data.documents ?? []).every(document => (!document.strategyId || strategies.has(document.strategyId))
      && (!document.presentation || document.presentation.kind === document.kind && document.presentation.view.id === document.id))
}
