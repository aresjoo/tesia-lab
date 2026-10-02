/** Optional display classification, not an API schema or execution authority.
 * Never infer service classification from titles, tickers or rule parameters. */
export type StrategyKind = 'agent' | 'rule' | 'mix'
export type StrategyMarket = 'crypto' | 'stock' | 'index' | 'multi'
export type StrategyClassification = { kind?: StrategyKind; market?: StrategyMarket }
export type StrategyKindFilter = 'all' | StrategyKind
export type StrategyMarketFilter = 'all' | StrategyMarket

export function matchesStrategyClassification(row: StrategyClassification, kind: StrategyKindFilter, market: StrategyMarketFilter) {
  return (kind === 'all' || row.kind === kind) && (market === 'all' || row.market === market)
}
