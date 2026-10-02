import type { createBillingPreviewStore } from './client-billing-preview-store'

/** Source preview only. Real requests use server-owned admission, never this gate. */
export function checkBillingPreview(store: ReturnType<typeof createBillingPreviewStore>): 'allowed' | 'watch' | 'unavailable' | 'clock-skew' {
  const result = store.dispatch({ kind: 'admit' }, Date.now(), crypto.randomUUID())
  if (!result.ok) return result.error === 'clock-skew' ? 'clock-skew' : 'unavailable'
  if (result.state.mode === 'watch') {
    return 'watch'
  }
  // The original mock path does not debit real AI calls or use its old free-out gate.
  return 'allowed'
}
