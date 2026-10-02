import { billingPreviewBalance, billingPreviewTier, type BillingPreviewState } from './client-billing-preview-state'
import { usageGate, usagePresentationBound, type UsagePresentation } from './client-usage-presentation'

export type MockUsageAdmission = 'allowed' | 'watch' | 'unavailable' | 'clock-skew'
export type MockUsageAdmissionInput = {
  owner: string | null
  ledger: MockUsageAdmission
  state: BillingPreviewState | null
  presentation: UsagePresentation | null
  supplementalCreditUsd: number
  storageError: boolean
}

/** Public Mock admission only. Preserve legacy rejection independently of the
 * displayed monthly percentage. The sole watch exception is an explicit local
 * top-up recovering exhausted CARD_UID credit; dunning never receives it.
 * No clock, mutation, receipt, network request or server entitlement is created. */
export function evaluateMockUsageAdmission(input: MockUsageAdmissionInput): MockUsageAdmission {
  const { owner, ledger, state, presentation, supplementalCreditUsd, storageError } = input
  if (ledger === 'clock-skew') return 'clock-skew'
  if (ledger === 'unavailable' || storageError || !['allowed', 'watch'].includes(ledger)
    || !Number.isFinite(supplementalCreditUsd) || supplementalCreditUsd < 0) return 'unavailable'
  if (owner === null) return ledger
  if (!owner.trim() || !state || state.owner !== owner || presentation?.source !== 'mock'
    || !usagePresentationBound(presentation, owner)) return 'unavailable'
  let balance: number
  try {
    balance = billingPreviewBalance(state)
    if (!Number.isFinite(balance) || billingPreviewTier(state) !== presentation.tier
      || !Number.isSafeInteger(state.cardFails) || state.cardFails < 0) return 'unavailable'
  } catch { return 'unavailable' }
  const quota = usageGate(presentation, owner, 'new')
  if (quota === 'unavailable') return 'unavailable'
  if (quota === 'block') return 'watch'
  if (ledger === 'allowed') return 'allowed'
  return state.mode === 'watch' && presentation.tier === 'CARD_UID' && supplementalCreditUsd > 0
    && balance <= 0 && state.cardFails < 3 ? 'allowed' : 'watch'
}
