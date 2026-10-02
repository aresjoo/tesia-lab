/** Display facts only. Not a market API, probability model or trading authority.
 * The caller binds each observation to its current owner/conversation/answer.
 * Financial labels are supplied verbatim: no price joins or inferred changes. */
export type MarketResponseBinding = { scopeId: string; messageId: string; observationId: string }
export type MarketSource = { id: string; title: string; url: string; description?: string }
export type MarketPricePresentation = {
  binding: MarketResponseBinding; asset: string; priceLabel: string; changeLabel: string;
  changeBasis: string; tone: 'up' | 'down' | 'neutral'; sourceLabel: string;
  observedAtLabel: string; intervalLabel: string
}
export type MarketTimelinePresentation = {
  binding: MarketResponseBinding;
  events: readonly { id: string; dateLabel: string; title: string; sourceLabel?: string;
    sourceUrl?: string; mappedTradingDateLabel?: string; priceLabel?: string;
    changeLabel?: string; tone?: 'up' | 'down' | 'neutral' }[]
  /** True only when the supplied badges actually use observed daily prices. */
  observedDaily: boolean
}
export type MarketEvidencePresentation = {
  binding: MarketResponseBinding; searches: number; results: number; pagesRead: number;
  sources: readonly MarketSource[]
}
export type MarketDirectionPresentation = {
  binding: MarketResponseBinding; asset: string; symbol?: string; up: number; down: number;
  sourceLabel: string; observedAtLabel: string;
  /** Explicit observation binding, not statistical calibration or accuracy. */
  hasMarketObservation: boolean;
  restored?: boolean
}
export type MarketResponseBlock =
  | { id: string; kind: 'market-price'; presentation: MarketPricePresentation }
  | { id: string; kind: 'market-timeline'; presentation: MarketTimelinePresentation }
  | { id: string; kind: 'market-evidence'; presentation: MarketEvidencePresentation }
  | { id: string; kind: 'market-direction'; presentation: MarketDirectionPresentation }

export function marketBindingKey(binding: MarketResponseBinding): string | null {
  return binding && [binding.scopeId, binding.messageId, binding.observationId].every(value => typeof value === 'string' && value.trim())
    ? JSON.stringify([binding.scopeId, binding.messageId, binding.observationId]) : null
}
export function marketSourceHref(value: string): string | null {
  if (typeof value !== 'string' || value !== value.trim() || Array.from(value).some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) || !/^https?:\/\//i.test(value)) return null
  try { const url = new URL(value); return !url.username && !url.password && ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null }
}
