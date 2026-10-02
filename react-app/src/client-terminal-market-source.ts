import { priceChartIssue, type PriceChartView } from './chart/price-chart-view'
import type { MarketPickerRow } from './client-market-picker'
import type { MarketSelectionStore } from './client-market-selection-store'
import type { MarketResource, TerminalMarketPresentation } from './client-terminal-market'

export type TerminalMarketInstrument = MarketPickerRow & { market: string; exchangeId: string }
/** Owner-supplied display input, NOT a new HTTP/execution contract. */
export type TerminalMarketObservation = {
  scope: string; identity: string; instrumentId: string
  chart: PriceChartView
  facts?: Pick<TerminalMarketPresentation, 'quote' | 'info' | 'data'>
}
export type TerminalMarketSource = {
  scope: string; identity: string
  catalog: MarketResource<readonly TerminalMarketInstrument[]>
  preferences: MarketSelectionStore
  /** Explicit adapter mapping; translated market labels are not instrument IDs. */
  strategyInstruments?: Readonly<Record<string, string>>
  load: (instrumentId: string, signal: AbortSignal) => Promise<TerminalMarketObservation>
}
export function boundTerminalMarketSource(source: TerminalMarketSource | undefined, scope?: string | null) {
  return source && !!scope?.trim() && source.scope === scope && !!source.identity.trim()
    && source.preferences.scope === scope && source.preferences.identity === source.identity ? source : undefined
}
export function validMarketObservation(value: TerminalMarketObservation, source: Pick<TerminalMarketSource, 'scope' | 'identity'>, instrument: TerminalMarketInstrument) {
  return value.scope === source.scope && value.identity === source.identity && value.instrumentId === instrument.id
    && value.chart.market === instrument.symbol && value.chart.fills.length === 0 && priceChartIssue(value.chart) === null
}
