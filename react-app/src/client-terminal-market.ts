import type { ClientTerminalStrategy } from './client-terminal-view'
import type { MarketPickerPresentation } from './client-market-picker'

/** Caller-owned display values, NOT an HTTP schema or an execution contract.
 * Historical chart bars must never be relabelled as a current market snapshot. */
export type MarketResource<T> = { state: 'ready'; value: T; source: string; observedAt: string }
  | { state: 'loading' | 'error' | 'unavailable' }
export const marketPeriods = ['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'] as const
export type MarketPeriod = typeof marketPeriods[number]
export const quoteFields = ['mark', 'index', 'funding', 'high', 'low', 'volume', 'notional'] as const
export const coinFields = ['rank', 'cap', 'diluted', 'share', 'coinVolume', 'volumeCap', 'circulating', 'maximum', 'supply'] as const
export const ruleFields = ['tick', 'minQuantity', 'minNotional', 'listed'] as const
export const metricKinds = ['oi', 'accounts', 'positions', 'globalRatio', 'taker', 'basis', 'fundingHistory', 'supplyRatio'] as const
export type TerminalMarketMetric = {
  kind: typeof metricKinds[number]
  /** Bounded display series, already selected/aggregated by the owner. */
  points: readonly { time: number; label: string }[]
  series: readonly { label: string; unit: string; axis: 'left' | 'right'; kind: 'line' | 'bar'; values: readonly (number | null)[] }[]
}
export type TerminalMarketPresentation = {
  binding: Pick<ClientTerminalStrategy, 'id' | 'symbol' | 'market'> & { exchangeId: string }
  picker?: MarketPickerPresentation
  quote?: MarketResource<{ price: string; change: string; tone: 'up' | 'down' | 'neutral'; values: Partial<Record<typeof quoteFields[number], string>> }>
  info?: MarketResource<{ name: string; values: Partial<Record<typeof coinFields[number] | typeof ruleFields[number], string>>; links: readonly { label: string; url: string }[] }>
  data?: Partial<Record<MarketPeriod, MarketResource<readonly TerminalMarketMetric[]>>>
}
export function boundTerminalMarket(strategy: ClientTerminalStrategy | undefined, presentation: TerminalMarketPresentation | undefined) {
  const b = presentation?.binding
  return strategy && b && strategy.id.trim() && b.id === strategy.id && b.symbol === strategy.symbol
    && b.market === strategy.market && b.exchangeId === strategy.exchange.id ? presentation : undefined
}
export function validMarketMetric(metric: TerminalMarketMetric) {
  return metric.points.length > 0 && metric.points.length <= 500 && metric.series.length > 0 && metric.series.length <= 3
    && metric.points.every((point, index, points) => Number.isFinite(point.time) && (!index || point.time > points[index - 1].time))
    && metric.series.every(series => series.values.length === metric.points.length && series.values.some(value => value !== null)
      && series.values.every(value => value === null || Number.isFinite(value)))
}
