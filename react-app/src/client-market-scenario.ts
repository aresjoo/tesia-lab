import { priceChartIssue, type PriceChartView } from './chart/price-chart-view'
import { marketBindingKey } from './client-market-response-presentation'
import type { MarketChartPresentation, MarketScenarioPresentation } from './client-market-chart-presentation'

export function boundMarketScenario(p: MarketChartPresentation): { scenario: MarketScenarioPresentation; view: PriceChartView } | null {
  const s = p.scenario, v = p.view
  if (!s || !v || p.state === 'unavailable' || !marketBindingKey(p.binding)
    || marketBindingKey(p.binding) !== marketBindingKey(s.binding)
    || s.seriesId !== p.seriesId || s.viewIdentity !== v.identity
    || s.asset !== p.asset || v.market !== p.asset
    || s.resolutionSeconds !== 86400 || p.resolutionSeconds !== 86400 || v.resolutionSeconds !== 86400
    || priceChartIssue(v) || v.bars.length < 10 || !s.basisLabel.trim()
    || ![s.upperPrice, s.lowerPrice].every(value => Number.isFinite(value) && value > 0)
    || !Number.isSafeInteger(s.horizonTime) || s.horizonTime > 253_402_300_799) return null
  const last = v.bars[v.bars.length - 1]
  if (s.lowerPrice > last.close || s.upperPrice < last.close || s.horizonTime < last.time + 86400) return null
  return { scenario: s, view: v }
}
