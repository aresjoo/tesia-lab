import type { PriceChartView } from './chart/price-chart-view'
import { marketBindingKey, type MarketResponseBinding } from './client-market-response-presentation'

/** Display-only inputs. The caller supplies already bound observations, not
 * a browser fetch URL, synthetic prices or permission to execute a strategy. */
export type MarketChartPresentation = {
  binding: MarketResponseBinding
  seriesId: string
  asset: string
  assetLabel: string
  resolutionSeconds: number
  availableResolutions: readonly number[]
  state: 'loading' | 'ready' | 'error' | 'unavailable'
  view: PriceChartView | null
  scenario?: MarketScenarioPresentation
}
/** Explicit display scenario, never an inferred forecast or executable signal. */
export type MarketScenarioPresentation = {
  binding: MarketResponseBinding
  seriesId: string
  viewIdentity: string
  asset: string
  resolutionSeconds: number
  upperPrice: number
  lowerPrice: number
  horizonTime: number
  basisLabel: string
  restored?: boolean
}
export type MarketChartRequest = {
  binding: MarketResponseBinding; seriesId: string; asset: string; resolutionSeconds: number
}
export type MarketChartActions = {
  request?: (request: MarketChartRequest, signal: AbortSignal) => boolean | Promise<boolean>
}
export type MarketChartBlock = { id: string; kind: 'market-chart'; presentation: MarketChartPresentation }

/** Observation revisions update data without throwing away the user's canvas. */
export function marketChartLifetime(p: MarketChartPresentation): string | null {
  return marketBindingKey(p.binding) && p.seriesId.trim()
    ? JSON.stringify([p.binding.scopeId, p.binding.messageId, p.seriesId]) : null
}
