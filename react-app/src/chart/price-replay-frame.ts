import type { PriceChartView } from './price-chart-view'

/** Display commands from ONE caller-owned replay clock, not an API contract.
 * The caller owns source verification, ordered paging, EOF and cancellation.
 * A progress value of one alone never declares the whole replay complete. */
export type ProfessionalExternalReplay = Readonly<{
  attemptId: string
  frame: Readonly<{
    attemptId: string
    viewIdentity: string
    time: number
    progress: number
    state: 'playing' | 'waiting' | 'complete'
    fillId: string | null
  }>
}>

export function priceReplaySlice(view: PriceChartView, replay: ProfessionalExternalReplay) {
  const frame = replay.frame
  if (!replay.attemptId || frame.attemptId !== replay.attemptId || frame.viewIdentity !== view.identity
    || !Number.isFinite(frame.time) || frame.time < 0 || frame.time > 253_402_300_799
    || !Number.isFinite(frame.progress) || frame.progress < 0 || frame.progress > 1
    || !['playing', 'waiting', 'complete'].includes(frame.state)) return null
  const fill = frame.fillId === null ? null : view.fills.find(item => item.id === frame.fillId)
  if (fill === undefined || fill && fill.time > frame.time) return null
  if (frame.state === 'complete' && (frame.progress !== 1
    || view.bars.some(bar => bar.time + view.resolutionSeconds > frame.time)
    || view.fills.some(item => item.time > frame.time))) return null
  let lo = 0, hi = view.bars.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (view.bars[mid].time <= frame.time) lo = mid + 1
    else hi = mid
  }
  return { count: lo, fill }
}
