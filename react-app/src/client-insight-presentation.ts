import type { InsightSection } from './client-insight-fixtures'

/** Read-only React presentation input, NOT an API/schema or a news producer.
 * A service adapter must supply publication metadata and approved media explicitly.
 * Array order is editorial order; the UI does not invent freshness or popularity. */
export type InsightPresentationArticle = {
  slug: string
  title: string
  sub: string
  cat: string
  authorName: string | null
  authorAvatarUrl?: string
  publishedAt: string | null
  art?: { heroUrl: string; wideUrl: string; alt?: string }
  placement?: 'featured' | 'secondary' | 'standard'
  trendingRank?: number
  tags: string[]
  assets: string[][]
  body: InsightSection[]
  /** Public canonical article URL. Missing means sharing is unavailable. */
  shareUrl?: string
}

export type InsightPresentationData = {
  /** Caller-owned identity; change on owner/feed replacement to clear transient UI. */
  identity: string
  articles: readonly InsightPresentationArticle[]
  heading: string
  subheading: string
  periodLabel?: string
  curators?: readonly { name: string; avatarUrl?: string }[]
  curatorLabel?: string
  figureUrls?: Readonly<Record<string, string>>
  assetUrls?: Readonly<Record<string, string>>
  personalized?: readonly InsightPersonalizedPresentation[]
  currentPersonalizedToken?: string
}

/** The caller supplies lifecycle state. No client clock or trading/account
 * heuristics may produce personalization, expiry, or an apparent new analysis. */
export type InsightPersonalizedPresentation = {
  token: string
  state: 'available' | 'expired' | 'superseded'
  article: InsightPresentationArticle
  chips: readonly string[]
  publicationLabel?: string
  expiryLabel?: string
  availabilityMessage?: string
  latestToken?: string
  question: string
  ctaLabel: string
  email?: { senderLabel: string; sections: InsightSection[] }
}

/** No script/data URLs or embedded credentials from supplied content. Local SVG
 * illustrations are separately created from the source-owned static catalog. */
export function insightMediaUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}

export function insightShareUrl(value: string | undefined): string | undefined {
  const url = insightMediaUrl(value)
  return url && !url.startsWith('/') ? url : undefined
}
