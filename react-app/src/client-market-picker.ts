import { clientCoinIcon } from './client-coin-icon'
import type { MarketResource } from './client-terminal-market'
import copy from './client-market-picker-copy.json' with { type: 'json' }

export const marketCategories = ['all', 'us', 'kr', 'hk', 'cmd', 'pre', 'ai', 'defi', 'l1', 'l2', 'meme'] as const
export type MarketCategory = typeof marketCategories[number]
export type MarketSort = 'symbol' | 'price' | 'change' | 'volume'
/** Supplied display catalogue, not exchangeInfo, an order registry, or an HTTP contract. */
export type MarketPickerRow = {
  id: string; symbol: string; name?: string; searchAliases?: readonly string[]
  categories: readonly Exclude<MarketCategory, 'all'>[]
  icon?: string
  price: number | null; change: number | null; volume: number | null
}
export type MarketPickerPresentation = {
  /** Owner/dataset boundary. Changing it discards the open dialog and its filters. */
  identity: string
  rows: MarketResource<readonly MarketPickerRow[]>
  selectedId: string | null
  favorites: readonly string[]
  onFavorite: (id: string, favorite: boolean) => void
  /** Read-only market inspection. Must not edit or approve a strategy. */
  onSelect: (id: string) => void
}
export function marketPickerText(language: string, key: keyof typeof copy.ko) {
  return (copy[language as keyof typeof copy] ?? copy.en)[key]
}
const sortDirections: Record<string, readonly [string, string]> = {
  ko: ['오름차순', '내림차순'], en: ['Ascending', 'Descending'], ja: ['昇順', '降順'],
  'zh-CN': ['升序', '降序'], 'zh-TW': ['升冪', '降冪'], es: ['Ascendente', 'Descendente'], fr: ['Croissant', 'Décroissant'],
}
export function marketPickerSortLabel(language: string, descending: boolean) { return (sortDirections[language] ?? sortDirections.en)[descending ? 1 : 0] }
export function validMarketPickerRows(rows: readonly MarketPickerRow[]) {
  const ids = new Set<string>()
  return rows.every(row => {
    if (!row.id.trim() || !row.symbol.trim() || ids.has(row.id)) return false
    ids.add(row.id)
    return row.categories.every(category => marketCategories.includes(category))
      && [row.price, row.change, row.volume].every(value => value === null || Number.isFinite(value))
      && (row.price === null || row.price > 0) && (row.volume === null || row.volume >= 0)
  })
}
export function filterMarketPickerRows(rows: readonly MarketPickerRow[], query: string, category: MarketCategory, favorites: readonly string[], favoriteOnly: boolean, sort: MarketSort, descending: boolean) {
  const q = query.trim().normalize('NFKC').toLocaleUpperCase('en-US'), favoriteIds = new Set(favorites)
  return rows.filter(row => (!favoriteOnly || favoriteIds.has(row.id)) && (category === 'all' || row.categories.includes(category))
    && (!q || [row.symbol, row.name ?? '', ...row.searchAliases ?? []].some(value => value.normalize('NFKC').toLocaleUpperCase('en-US').includes(q))))
    .sort((a, b) => {
      const av = a[sort], bv = b[sort]
      // Missing values are always last, never coerced to a zero price or return.
      if (av === null || bv === null) return av === bv ? a.id.localeCompare(b.id) : av === null ? 1 : -1
      const result = av < bv ? -1 : av > bv ? 1 : 0
      return (descending ? -result : result) || a.id.localeCompare(b.id)
    })
}
/** Keep display icons local. Do not leak the user's selection to third-party CDNs. */
export function marketPickerIcon(value?: string) {
  if (value?.startsWith('/assets/coins/')) {
    try {
      const file = decodeURIComponent(value.slice('/assets/coins/'.length))
      if (!/\.(?:svg|png|jpg)$/.test(file)) return undefined
      return clientCoinIcon(file.replace(/\.(?:svg|png|jpg)$/, '')) ?? undefined
    } catch { return undefined }
  }
  return value && /^\/(?:client-template-assets|client-market-assets)\/[\p{L}\p{N}_-]+\.(?:svg|png|webp|jpg)$/u.test(value) ? value : undefined
}
