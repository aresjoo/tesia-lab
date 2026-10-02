import type { BrokerInfo, BrokerReview, ClientBroker, BrokerFilter } from './client-broker-fixtures'

/** Owner-bound display inputs, not an API schema or exchange permission. */
export type BrokerConnectionState = 'SOON' | 'GUEST' | 'CONNECTED' | 'NEEDS_PLAN' | 'NEEDS_LINK'
export type BrokerPresentationItem = {
  broker: ClientBroker
  info?: BrokerInfo | null
  /** null/missing is unavailable; [] is a confirmed empty list. */
  /** Supplied newest-first when no ISO timestamp is available. */
  reviews?: readonly (BrokerReview & { publishedAt?: string })[] | null
  /** Explicit owner-verified display input: undefined unavailable, null confirmed absent. */
  ownReview?: BrokerReview | null
  connectionState?: BrokerConnectionState | null
  logoUrl?: string
  promotionBody?: string
  feeAsOfLabel?: string
}
export type BrokerServicePresentation = {
  scope: string
  identity: string
  catalog: readonly BrokerPresentationItem[] | null
  actions?: {
    onConnect?: (brokerId: string, state: BrokerConnectionState) => Promise<void>
    onOpenAccount?: (brokerId: string) => Promise<void>
    onSubscribe?: () => Promise<void>
    submitReview?: (brokerId: string, review: { rating: number; text: string }) => Promise<void>
  }
}
export function brokerPresentationBound(presentation: BrokerServicePresentation | undefined, accountScope: string | null | undefined): presentation is BrokerServicePresentation {
  return Boolean(accountScope && presentation?.scope === accountScope && presentation.identity)
}
export function safeBrokerLink(value: string | undefined): string | undefined {
  if (!value || !/^https:\/\//i.test(value)) return undefined
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined } catch { return undefined }
}
export function safeBrokerLogo(value: string | undefined): string | undefined {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && [...value].every(character=>character.charCodeAt(0)>=32)
    ? value : safeBrokerLink(value)
}
export function filterBrokerPresentation(items: readonly BrokerPresentationItem[], filter: BrokerFilter, sort: string): BrokerPresentationItem[] {
  return items.filter(({ broker: b }) => filter === 'all' || filter === 'ex' && b.tag === '거래소'
    || filter === 'stock' && b.tag === '증권사' || filter === 'broker' && b.tag === '브로커'
    || filter === 'conn' && b.conn || filter === 'soon' && !b.conn)
    .sort((a, b) => sort === 'rating' ? (b.broker.rating ?? -1) - (a.broker.rating ?? -1) || (b.broker.rvN ?? -1) - (a.broker.rvN ?? -1)
      : sort === 'reviews' ? (b.broker.rvN ?? -1) - (a.broker.rvN ?? -1) || (b.broker.rating ?? -1) - (a.broker.rating ?? -1)
        : sort === 'users' ? (b.broker.traderN ?? -1) - (a.broker.traderN ?? -1) || (b.broker.rating ?? -1) - (a.broker.rating ?? -1) : a.broker.ord - b.broker.ord)
}
