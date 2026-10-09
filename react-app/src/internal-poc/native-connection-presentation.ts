/** UI inputs only. No HTTP schema, payment receipt, entitlement or order authority.
 * The owner supplies every stage after observing its existing service contract.
 * Resolving an action never advances this component to another stage by itself. */
export type ConnectionAction = () => Promise<void>
export type ConnectionRow = { id: string; label: string; value: string }
export type ConnectionGuide = { title: string; steps: readonly string[]; note?: string; url?: string }
export type ConnectionChoice = { id: string; title: string; description?: string; price?: string; badge?: string; actionLabel?: string }
export type ConnectionVerificationStatus = 'waiting' | 'checking' | 'verified'
export type ConnectionVerification = {
  exchangeId: string
  /** Already-masked display value supplied by an observed host response. */
  maskedAccountLabel?: string
  account: ConnectionVerificationStatus
  invitation: ConnectionVerificationStatus
}
export type ConnectionListAccount = {
  id: string
  exchangeId: string
  /** Already-masked display value supplied by an observed host response. */
  maskedAccountLabel?: string
  /** Omit when the host has not established the account's plan/eligibility. */
  access?: 'invitation' | 'subscription' | 'subscription-ended'
  onDisconnect?: ConnectionAction
}
export type ConnectionList = {
  accounts: readonly [ConnectionListAccount, ...ConnectionListAccount[]]
  onOpenTerminal?: ConnectionAction
  onAddExchange?: ConnectionAction
}
type Stage<K extends string> = { id: string; kind: K; title?: string; description?: string; onBack?: ConnectionAction }
export type NativeConnectionStage =
  | Stage<'method'> & { choices: readonly ConnectionChoice[] | null; onChoose?: (id: string) => Promise<void> }
  | Stage<'plan'> & { choices: readonly ConnectionChoice[] | null; selectedId?: string; onChoose?: (id: string) => Promise<void>; onContinue?: ConnectionAction }
  | Stage<'payment'> & { rows: readonly ConnectionRow[]; disclosure?: string; onCheckout?: ConnectionAction }
  | Stage<'payment-confirm'> & { rows: readonly ConnectionRow[]; confirmLabel?: string; onConfirm?: ConnectionAction }
  | Stage<'exchange'> & { exchanges: readonly ConnectionChoice[] | null; onChoose?: (id: string) => Promise<void>; verification?: ConnectionVerification }
  | Stage<'partner'> & { exchangeName: string; registrationUrl?: string; guide?: ConnectionGuide; onJoined?: ConnectionAction }
  | Stage<'uid'> & { exchangeId: string; exchangeName: string; guide?: ConnectionGuide; onVerify?: (uid: string) => Promise<void> }
  | Stage<'api'> & { exchangeId: string; exchangeName: string; guide?: ConnectionGuide; disclosure?: string; permissions: readonly { id: string; label: string; requested: boolean | null }[]; requiresPassphrase?: boolean; onConnect?: (credentials: { apiKey: string; secretKey: string; passphrase?: string }) => Promise<void> }
  | Stage<'complete'> & { description: string; rows: readonly ConnectionRow[]; actions: readonly { id: string; label: string; primary?: boolean; onRun?: ConnectionAction }[]; connectionList?: ConnectionList }
export type NativeConnectionPresentation = {
  scope: string
  /** Stable onboarding identity; replace it when switching strategy/account. */
  identity: string
  status: 'ready' | 'loading' | 'unavailable' | 'error'
  /** A new id retires old drafts and in-flight UI feedback, even for the same kind. */
  state: NativeConnectionStage
  sourceLabel?: string
}
export function connectionPresentationBound(value: NativeConnectionPresentation | undefined, scope: string | null | undefined): value is NativeConnectionPresentation {
  return Boolean(scope && value?.scope === scope && value.identity.trim() && value.state.id.trim())
}
export function connectionSafeUrl(value: string | undefined) {
  if (!value) return null
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null } catch { return null }
}
