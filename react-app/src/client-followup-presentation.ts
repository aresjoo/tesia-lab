import type { MarketResponseBinding } from './client-market-response-presentation'

/** Local display input, not an API schema, inferred AI action or order intent. */
export type FollowupAction = { id: string; type: 'alert' | 'backtest' | 'delegate_trade' | 'auto_trade'; label: string; saved?: boolean }
export type FollowupQuestion = { id: string; label: string; text: string }
export type FollowupPresentation = {
  binding: MarketResponseBinding
  actions: readonly FollowupAction[]
  questions: readonly FollowupQuestion[]
  /** Explicit eligibility supplied by the host, not inferred from auth absence. */
  showFreeBadge: boolean
  restored?: boolean
}
export type FollowupSelection = { binding: MarketResponseBinding } & (
  | { kind: 'action'; item: FollowupAction }
  | { kind: 'question'; item: FollowupQuestion }
)
export type FollowupActions = {
  busy?: boolean
  /** ACK only after the existing host operation accepts this bound selection. */
  activate?: (selection: FollowupSelection, signal: AbortSignal) => boolean | Promise<boolean>
}
export type FollowupBlock = { id: string; kind: 'followups'; presentation: FollowupPresentation }

/** Local saved display data only. Invalid optional data cannot erase a conversation. */
export function readFollowupActions(value: unknown): FollowupAction[] | undefined {
  if (!Array.isArray(value) || value.length > 2) return undefined
  const result: FollowupAction[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
    const item = raw as Record<string, unknown>
    if (typeof item.id !== 'string' || !item.id.trim() || typeof item.label !== 'string' || !item.label.trim()
      || typeof item.type !== 'string' || !['alert', 'backtest', 'delegate_trade', 'auto_trade'].includes(item.type)
      || item.saved !== undefined && typeof item.saved !== 'boolean'
      || result.some(previous => previous.id === item.id)) return undefined
    result.push({ id: item.id, label: item.label, type: item.type as FollowupAction['type'], ...(item.type === 'alert' && item.saved === true ? { saved: true } : {}) })
  }
  return result
}
