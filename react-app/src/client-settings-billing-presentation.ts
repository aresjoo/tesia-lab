/** Owner-bound display projection only, not a billing API/schema or entitlement.
 * All money/date/status strings come from the approved host. null means unknown;
 * [] means a confirmed empty list. No card PAN, CVC, token or provider secret. */
export type ClientBillingInformation = { email: string; name: string; address: string }
export type ClientBillingInvoice = {
  id: string
  label: string
  dateLabel: string
  amountLabel: string
  statusLabel: string
  kind: 'paid' | 'failed' | 'refunded'
  paymentMethodLabel?: string
  /** Historical recipient on this invoice, never borrowed from current profile. */
  recipient?: string
}
export type ClientBillingMethod = {
  id: string
  brand: string
  last4: string
  expiryLabel: string
  isDefault: boolean
  /** Host-confirmed capability, not inferred from number of cards/subscription. */
  removable: boolean
  removalHint?: string
}
/** Confirmed, localized consequence text supplied by the authenticated host.
 * No estimated dates, pricing, trade effects or entitlement are inferred here. */
export type ClientSubscriptionConfirmation = {
  title: string
  description: string
  consequences: readonly string[]
  confirmLabel: string
}
export type ClientBillingSubscription = { warning?: string } & (
  | { state: 'active'; amountLabel: string; description: string; cancellation?: { summary: string; confirmation: ClientSubscriptionConfirmation } }
  | { state: 'ending'; amountLabel: string; description: string; resumption?: { kind: 'resume' | 'add-method'; confirmation: ClientSubscriptionConfirmation } }
  | { state: 'expired'; description: string }
  | { state: 'invited'; feeLabel: string; description: string }
  | { state: 'none'; description: string }
)
export type ClientBillingPresentation = {
  sourceLabel: string
  /** Latest settings projection. If supplied, replaces the legacy plan overview.
   * State is observed from the host, never derived from a date/local payment flag. */
  subscription?: ClientBillingSubscription
  invoices: readonly ClientBillingInvoice[] | null
  information: ClientBillingInformation | null
  methods: readonly ClientBillingMethod[] | null
}
/** Explicit UI ports only; actual provider/SDK integration remains pending.
 * addMethod starts approved provider-owned collection; this app never receives
 * raw card details. Resolving acknowledges a request, not payment success.
 * Abort discards observation and never guarantees cancellation at the server. */
export type ClientBillingActions = {
  subscription?: (action: 'cancel' | 'resume', signal: AbortSignal) => Promise<void>
  updateInformation?: (information: ClientBillingInformation, signal: AbortSignal) => Promise<void>
  addMethod?: (signal: AbortSignal) => Promise<void>
  makeDefault?: (id: string, signal: AbortSignal) => Promise<void>
  removeMethod?: (id: string, signal: AbortSignal) => Promise<void>
}
