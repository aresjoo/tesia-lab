import { containingBar, type PriceChartView, type PriceFill } from './price-chart-view'

export const PRICE_REPLAY_DURATION_MS = 60_000
export const PRICE_REVEAL_DURATION_MS = 59_000
export const EXECUTION_DWELL_MS = 600

/** Display scheduling only. Fills remain supplied events, not orders/signals.
 * One bounded array and one caller-owned timer; never a timer per fill. Dense
 * bars extend the explanation rather than silently replacing earlier fills.
 * A new overlay page starts after the already revealed range, without replaying
 * past fills. Equal timestamps retain the supplied page's execution ordering. */
export function priceExecutionTimeline(view: PriceChartView, ordered: readonly PriceFill[], first = 0, elapsed = 0) {
  const at: number[] = []
  let previous = elapsed - EXECUTION_DWELL_MS
  for (let i = first; i < ordered.length; i++) {
    const index = containingBar(view, ordered[i].time)
    if (index === null) continue
    const revealAt = index === 0 ? 0 : (index + 1) * PRICE_REVEAL_DURATION_MS / view.bars.length
    const time = Math.max(elapsed, revealAt, previous + EXECUTION_DWELL_MS)
    at[i] = time
    previous = time
  }
  return { at, duration: Math.max(PRICE_REPLAY_DURATION_MS, previous + EXECUTION_DWELL_MS) }
}
