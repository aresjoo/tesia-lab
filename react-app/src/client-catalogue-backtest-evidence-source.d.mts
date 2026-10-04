import type { CatalogueBacktestObservation } from './client-catalogue-backtest'
import type { CatalogueMarketData } from './client-catalogue-market-data'
import type { CatalogueEvidenceDecision } from './client-catalogue-backtest-evidence-types'
import { catalogueUniverses } from './client-catalogue'
/** Exact source display projection; caller validates and recursively freezes output. */
export function projectSourceBacktestDecisions(value: Omit<CatalogueBacktestObservation, 'evidence'>,
  data: { spot: CatalogueMarketData['spot']; future: CatalogueMarketData['future']; universes: typeof catalogueUniverses }
): readonly CatalogueEvidenceDecision[]
