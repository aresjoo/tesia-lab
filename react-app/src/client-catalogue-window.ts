/** Source mkSlice: mark-to-market window of the full run, NOT a restarted run.
 * Trades closed inside the window may have entered before it. Their complete
 * trade PnL is not the same thing as the window's equity return.
 */
import type { CatalogueSpotResult } from './client-catalogue-spot-engine'
import type { runCatalogueFuturesPreview } from './client-catalogue-futures-engine'

export function sliceCataloguePreview(full: CatalogueSpotResult | ReturnType<typeof runCatalogueFuturesPreview>, days: 7 | 30) {
  if (days !== 7 && days !== 30) throw Error('catalogue window: invalid period')
  const src = full.eq.slice(-(days + 1)), end = full.params.endI
  if (src.length !== days + 1 || src.at(-1)?.i !== end || !(src[0].v > 0)) throw Error('catalogue window: insufficient equity')
  const start = src[0].i, base = src[0].v
  if (src.some((e, i) => e.i !== start + i || !Number.isFinite(e.v) || e.v < 0)) throw Error('catalogue window: invalid equity')
  const eq = src.map(e => ({ i: e.i, v: e.v / base }))
  let peak = eq[0].v, mdd = 0
  for (const e of eq) { if (e.v > peak) peak = e.v; const dd = (e.v / peak - 1) * 100; if (dd < mdd) mdd = dd }
  const trades = full.trades.filter(t => t.exit > start), win = trades.filter(t => t.pnl > 0).length
  return {
    ...full, eq, ret: (eq.at(-1)!.v - 1) * 100, mdd, trades, n: trades.length, winRate: trades.length ? win / trades.length * 100 : 0,
    params: { startI: start, endI: end }, mddStartI: null, byYear: {},
    // mkSlice leaves these at whole-run values. A selected-window label would
    // misrepresent them; keep unavailable until a separately specified method.
    pf: null, worstYear: null, bestYear: null, worstYearPnl: null, bestYearPnl: null,
    mddEndI: null, underwaterDays: null, cagr: null, sharpe: null, calmar: null,
    exposure: null, tradeVol: null, avgHold: null, lossCount: null, costImpact: null,
    ...('fut' in full ? { liqN: null, fundPaid: null, feesPaid: null } : {}),
    // Decision context and ending positions deliberately stay from the full
    // run, as in the source. The envelope declares this different scope.
  }
}
