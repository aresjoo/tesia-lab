import type { CatalogueEvidenceDecision } from './client-catalogue-backtest-evidence-types'

export type CatalogueBacktestMarker = {
  k: CatalogueEvidenceDecision['k']; side?: number; j: number; j2: number; ix: number; ix2: number
  n: number; pnl?: number; title: string; decisionIndices: number[]
}
/** Exact source btMarkList grouping: same-day buys; nearby skips until the next buy.
 * Group members retain their own decision identity; a date is not an event identity.
 */
export function catalogueBacktestMarkers(decisions: readonly CatalogueEvidenceDecision[], grouped: boolean, x: (j: number) => number): CatalogueBacktestMarker[] {
  const markers: CatalogueBacktestMarker[] = []
  let lastSkip: CatalogueBacktestMarker | null = null, lastBuy: CatalogueBacktestMarker | null = null
  for (const d of decisions) {
    if (d.k === 'pick' || d.k === 'hold') continue
    if (grouped && d.k === 'skip' && lastSkip && x(d.j) - x(lastSkip.j2) < 12) {
      lastSkip.n++; lastSkip.j2 = d.j; lastSkip.ix2 = d.ix; lastSkip.decisionIndices.push(d.ix); continue
    }
    if (d.k === 'buy' && lastBuy && lastBuy.j === d.j) {
      lastBuy.n++; lastBuy.title += `, ${d.tk}`; lastBuy.decisionIndices.push(d.ix); continue
    }
    const marker: CatalogueBacktestMarker = { k: d.k, side: d.side, j: d.j, j2: d.j, ix: d.ix, ix2: d.ix, n: 1, pnl: d.pnl, title: `${d.tk ? `${d.tk} ` : ''}${d.tag}`, decisionIndices: [d.ix] }
    markers.push(marker)
    if (d.k === 'skip') lastSkip = marker
    else if (d.k === 'buy') { lastSkip = null; lastBuy = marker }
  }
  return markers
}
