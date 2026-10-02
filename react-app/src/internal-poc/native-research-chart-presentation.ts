/** Bounded frontend chart inputs. NOT an API schema, backtest or order contract.
 * Both datasets identify their strategy version so a delayed prior response cannot
 * be displayed under a newer document. Numeric values are already producer-owned
 * observations; the renderer performs only chart coordinate projection.
 */
export const RESEARCH_CHART_LIMITS = Object.freeze({ bars: 1000, fills: 2000, tradeIntervals: 1000, equity: 2000, tablePage: 50 })
/** All chart times below are UTC Unix SECONDS (not NAV dashboard milliseconds). */
export type ResearchPriceBar = { time: number; open: number; high: number; low: number; close: number }
export type ResearchExecutionPoint = {
  id: string; time: number; barTime: number; price: number; side: 'BUY' | 'SELL'; quantity?: string; label?: string
}
/** Explicit producer pairing/outcome, never inferred from price, side or label.
 * Each fill belongs to at most one displayed pair in this bounded window.
 * A partial or out-of-window pair must be omitted, not rebound to another bar.
 */
export type ResearchTradeInterval = {
  id: string; versionIdentity: string; entryFillId: string; exitFillId: string
  outcome: 'gain' | 'loss' | 'flat'; label: string
}
export type ResearchPriceWindow = {
  versionIdentity: string
  bars: readonly ResearchPriceBar[]
  fills?: readonly ResearchExecutionPoint[]
  tradeIntervals?: readonly ResearchTradeInterval[]
  /** Explicit window-local bound to existing supplied bars; no inferred holdout. */
  holdout?: { fromBarTime: number; toBarTime: number; label: string }
  sourceLabel: string; rangeLabel: string; currency?: string
  pricePrecision: number
}
export type ResearchEquityPoint = { time: number; value: number; valueLabel?: string }
export type ResearchEquityWindow = {
  versionIdentity: string; points: readonly ResearchEquityPoint[]
  label: string; sourceLabel: string; rangeLabel: string; currency?: string; valuePrecision: number
}
export type NativeResearchChartPreviewProps = {
  scopeId: string; versionIdentity: string; active: boolean
  prices?: ResearchPriceWindow | null; equity?: ResearchEquityWindow | null
  onOpenAnalysis?: () => void
}
export type ResearchChartInputState = 'ready' | 'unavailable' | 'empty' | 'invalid' | 'oversized' | 'stale'
const validTime = (time: number) => Number.isSafeInteger(time) && time >= -62135596800 && time <= 253402300799
const validPrecision = (precision: number) => Number.isInteger(precision) && precision >= 0 && precision <= 12
export function researchPriceState(data: ResearchPriceWindow | null | undefined, version: string): ResearchChartInputState {
  if (!data) return 'unavailable'
  if (data.versionIdentity !== version) return 'stale'
  if (!Array.isArray(data.bars) || data.fills !== undefined && !Array.isArray(data.fills)
    || data.tradeIntervals !== undefined && !Array.isArray(data.tradeIntervals) || !validPrecision(data.pricePrecision)) return 'invalid'
  if (data.bars.length > RESEARCH_CHART_LIMITS.bars || (data.fills?.length ?? 0) > RESEARCH_CHART_LIMITS.fills
    || (data.tradeIntervals?.length ?? 0) > RESEARCH_CHART_LIMITS.tradeIntervals) return 'oversized'
  let previous = -Infinity
  const times = new Set<number>()
  for (const bar of data.bars) {
    if (!bar || !validTime(bar.time) || bar.time <= previous || ![bar.open, bar.high, bar.low, bar.close].every(Number.isFinite)
      || bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close, bar.high)) return 'invalid'
    previous = bar.time; times.add(bar.time)
  }
  const ids = new Set<string>()
  for (const fill of data.fills ?? []) {
    if (!fill || !fill.id || ids.has(fill.id) || !validTime(fill.time) || !times.has(fill.barTime) || fill.time < fill.barTime
      || !Number.isFinite(fill.price) || fill.side !== 'BUY' && fill.side !== 'SELL') return 'invalid'
    ids.add(fill.id)
  }
  const fillById = new Map(data.fills?.map(fill => [fill.id, fill]))
  const nextBar = new Map(data.bars.slice(0, -1).map((bar, index) => [bar.time, data.bars[index + 1].time]))
  const intervalIds = new Set<string>(), pairedFills = new Set<string>()
  for (const interval of data.tradeIntervals ?? []) {
    if (!interval || typeof interval.id !== 'string' || !interval.id.trim() || intervalIds.has(interval.id)
      || interval.versionIdentity !== version || !['gain', 'loss', 'flat'].includes(interval.outcome)
      || typeof interval.label !== 'string' || !interval.label.trim()) return 'invalid'
    const entry = fillById.get(interval.entryFillId), exit = fillById.get(interval.exitFillId)
    if (!entry || !exit || entry.id === exit.id || pairedFills.has(entry.id) || pairedFills.has(exit.id)
      || entry.time > exit.time || entry.barTime > exit.barTime
      || entry.time >= (nextBar.get(entry.barTime) ?? Infinity) || exit.time >= (nextBar.get(exit.barTime) ?? Infinity)) return 'invalid'
    intervalIds.add(interval.id); pairedFills.add(entry.id); pairedFills.add(exit.id)
  }
  if (data.holdout && (!times.has(data.holdout.fromBarTime) || !times.has(data.holdout.toBarTime) || data.holdout.fromBarTime > data.holdout.toBarTime)) return 'invalid'
  return data.bars.length ? 'ready' : 'empty'
}
export function researchEquityState(data: ResearchEquityWindow | null | undefined, version: string): ResearchChartInputState {
  if (!data) return 'unavailable'
  if (data.versionIdentity !== version) return 'stale'
  if (!Array.isArray(data.points) || !validPrecision(data.valuePrecision)) return 'invalid'
  if (data.points.length > RESEARCH_CHART_LIMITS.equity) return 'oversized'
  let previous = -Infinity
  for (const point of data.points) {
    if (!point || !validTime(point.time) || point.time <= previous || !Number.isFinite(point.value)) return 'invalid'
    previous = point.time
  }
  return data.points.length ? 'ready' : 'empty'
}
