/** Browser snapshot display only, never a live quote or a personal execution. */
import { catalogueAssets, catalogueSourceSha, catalogueTitle, findCatalogueStrategy } from './client-catalogue'
import type { CatalogueMarketData } from './client-catalogue-market-data'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import { priceChartIssue, type PriceBar } from './chart/price-chart-view'

export type CatalogueMarketChart = {
  source: 'client-snapshot-preview'; sourceSha: string; strategyId: string; asset: string
  calendar: { start: string; asof: string }; dataVersion: { spot: string; futures: string }
  symbol: string; market: 'spot' | 'futures'; provenance: string
  bars: readonly PriceBar[]; closes: readonly { time: number; value?: number }[]
}

/** Axis/readout precision, not an exchange tick size. Keep small prices legible
 * without giving every large price eight trailing zeros; raw OHLC is unchanged. */
export function catalogueChartPrecision(bars: readonly PriceBar[]): number {
  const minimum = bars.reduce((min, bar) => Math.min(min, bar.low), Infinity)
  return Number.isFinite(minimum) && minimum > 0 ? Math.min(8, Math.max(2, 3 - Math.floor(Math.log10(minimum)))) : 2
}

/** Fixed-asset rule, otherwise first actual holding. No arbitrary BTC fallback,
 * guessed quote suffix for stocks, or candidate pick treated as a holding. */
export function catalogueChartAsset(value: CataloguePreviewResult): string | null {
  const open = value.result.state.open
  const asset = value.strategy.kind === 'rule' ? value.strategy.asset : (Array.isArray(open) ? open[0] : open)?.k
  return asset && catalogueAssets(value.strategy).includes(asset) ? asset : null
}

export function projectCatalogueMarketChart(strategyId: string, asset: string, data: CatalogueMarketData): CatalogueMarketChart {
  const strategy = findCatalogueStrategy(strategyId)
  if (!strategy || strategy.id !== strategyId || !catalogueAssets(strategy).includes(asset)) throw Error('catalogue chart unavailable')
  const start = Math.max(0, data.length - 5000), bars: PriceBar[] = [], closes: { time: number; value?: number }[] = []
  const future = strategy.fut ? data.future.sym[asset] : undefined
  if (strategy.fut && !future) throw Error('catalogue chart unavailable')
  for (let i = start; i < data.length; i++) {
    const time = data.startMs / 1000 + i * 86400
    if (future) bars.push({ time, open: future.o[i], high: future.h[i], low: future.l[i], close: future.c[i], volume: null })
    else closes.push({ time, ...(data.isOpen(asset, i) ? { value: data.prices(asset)[i] } : {}) })
  }
  return { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, strategyId, asset,
    calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v },
    symbol: future ? `${catalogueTitle(asset)}/USDT` : data.spot.meta[asset].sym,
    market: future ? 'futures' : 'spot', provenance: future ? data.future.src : data.spot.src.px, bars, closes }
}

export function validCatalogueMarketChart(value: CatalogueMarketChart, strategyId: string, asset: string): boolean {
  const strategy = findCatalogueStrategy(strategyId)
  if (!value || !strategy || !catalogueAssets(strategy).includes(asset) || value.source !== 'client-snapshot-preview'
    || value.sourceSha !== catalogueSourceSha || value.strategyId !== strategyId || value.asset !== asset
    || value.market !== (strategy.fut ? 'futures' : 'spot') || typeof value.symbol !== 'string' || !value.symbol || typeof value.provenance !== 'string' || !value.provenance
    || !value.dataVersion?.spot || !value.dataVersion?.futures || !value.calendar?.start || !value.calendar?.asof
    || !Array.isArray(value.bars) || !Array.isArray(value.closes)) return false
  const start = Date.parse(`${value.calendar.start}T00:00:00Z`) / 1000, end = Date.parse(`${value.calendar.asof}T00:00:00Z`) / 1000
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end
    || !/^\d{4}-\d{2}-\d{2}$/.test(value.calendar.start) || !/^\d{4}-\d{2}-\d{2}$/.test(value.calendar.asof)
    || new Date(start * 1000).toISOString().slice(0, 10) !== value.calendar.start || new Date(end * 1000).toISOString().slice(0, 10) !== value.calendar.asof) return false
  const times = strategy.fut ? value.bars : value.closes
  if (!times.length || times.length > 5000 || times.some(p => !p || typeof p !== 'object') || times[0].time < start || times.at(-1)!.time !== end
    || times.some((p, i) => !Number.isSafeInteger(p.time) || (p.time - start) % 86400 !== 0 || (i > 0 && p.time - times[i - 1].time !== 86400))) return false
  return strategy.fut ? !value.closes.length && value.bars.every(b => b.volume === null)
    && priceChartIssue({ identity: strategyId, market: value.symbol, sourceLabel: value.provenance, resolutionSeconds: 86400, pricePrecision: 8, bars: value.bars, fills: [] }) === null
    : !value.bars.length && value.closes.some(p => p.value !== undefined) && value.closes.every(p => p.value === undefined || Number.isFinite(p.value) && p.value > 0)
}
