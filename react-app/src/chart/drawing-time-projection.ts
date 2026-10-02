import type { Logical, UTCTimestamp } from 'lightweight-charts'

type DrawingTimeScale = {
  timeToCoordinate(time: UTCTimestamp): number | null
  timeToIndex(time: UTCTimestamp): number | null
  logicalToCoordinate(index: Logical): number | null
}
const validTime = (time: number) => Number.isSafeInteger(time) && time >= 0 && time <= 253_402_300_799
const finite = (value: number | null): value is number => value !== null && Number.isFinite(value)

/** Projects a user annotation, never a candle or an execution. Cache the bounded
 * time domain once per data update; pointer/repaint work is O(log n), not O(n).
 * Inside gaps the two observed coordinates bound the annotation. Outside the
 * supplied window only its declared interval defines the display extension. */
export function createDrawingTimeProjection(bars: readonly { time: number }[], resolutionSeconds: number) {
  const times = bars.map(bar => bar.time)
  const validDomain = times.length > 0 && times.length <= 5000 && Number.isSafeInteger(resolutionSeconds) && resolutionSeconds > 0
    && times.every((time, index) => validTime(time) && (index === 0 || time - times[index - 1] >= resolutionSeconds))
  return (time: number, scale: DrawingTimeScale): number | null => {
    if (!validDomain || !validTime(time)) return null
    let lo = 0, hi = times.length
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (times[mid] < time) lo = mid + 1; else hi = mid }
    if (times[lo] === time) {
      const x = scale.timeToCoordinate(time as UTCTimestamp)
      return finite(x) ? x : null
    }
    if (lo > 0 && lo < times.length) {
      const left = times[lo - 1], right = times[lo]
      const x0 = scale.timeToCoordinate(left as UTCTimestamp), x1 = scale.timeToCoordinate(right as UTCTimestamp)
      if (!finite(x0) || !finite(x1)) return null
      const x = x0 + (x1 - x0) * ((time - left) / (right - left))
      return Number.isFinite(x) ? x : null
    }
    const edge = lo === 0 ? times[0] : times[times.length - 1]
    const index = scale.timeToIndex(edge as UTCTimestamp)
    if (!finite(index)) return null
    const x = scale.logicalToCoordinate((index + (time - edge) / resolutionSeconds) as Logical)
    return finite(x) ? x : null
  }
}
