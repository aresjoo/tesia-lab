import type { PriceBar } from './price-chart-view'

export type StudyPoint = { time: number; value?: number }

export const movingAveragePeriods = [7, 25, 99] as const
export type MovingAverageKey = `ma${typeof movingAveragePeriods[number]}`

/** Source MASimple studies: full contiguous close windows, not EMA or strategy
 * signals. Bounded by the renderer's 5,000 bars and max 99 observations. Scale
 * each window before summing so valid large prices cannot overflow, and small
 * prices recover immediately after a large observation leaves the window. */
export function chartSma(bars: readonly PriceBar[], period: typeof movingAveragePeriods[number], resolutionSeconds: number): StudyPoint[] {
  let start = 0
  return bars.map((bar, i) => {
    if (!i || bar.time - bars[i - 1].time !== resolutionSeconds) start = i
    if (i - start + 1 < period) return { time: bar.time }
    let scale = 0
    for (let j = i - period + 1; j <= i; j++) scale = Math.max(scale, bars[j].close)
    let sum = 0, correction = 0
    for (let j = i - period + 1; j <= i; j++) {
      const part = bars[j].close / scale - correction
      const next = sum + part
      correction = (next - sum) - part
      sum = next
    }
    const value = (sum / period) * scale
    return Number.isFinite(value) ? { time: bar.time, value } : { time: bar.time }
  })
}

export function chartMovingAverages(bars: readonly PriceBar[], resolutionSeconds: number): Record<MovingAverageKey, StudyPoint[]> {
  return { ma7: chartSma(bars, 7, resolutionSeconds), ma25: chartSma(bars, 25, resolutionSeconds), ma99: chartSma(bars, 99, resolutionSeconds) }
}

/** LWC skips whitespace when drawing a line. Its per-point color applies to
 * the outgoing segment: hide the segment from the last value before a gap,
 * rather than connecting across undefined warmup values or adding series. */
export function studyLineData(points: readonly StudyPoint[], resolutionSeconds?: number) {
  return points.map((point, i) => point.value !== undefined && i + 1 < points.length && (points[i + 1].value === undefined || (resolutionSeconds !== undefined && points[i + 1].time - point.time !== resolutionSeconds))
    ? { ...point, color: 'transparent' } : { ...point })
}

/** HLC3 VWAP anchored to the supplied contiguous price window, not a trading
 * session. Scale weights incrementally: fractional/large volumes must not
 * distort prices or overflow. No future bar participates in a prefix. */
export function chartWindowVwap(bars: readonly PriceBar[], resolutionSeconds: number): StudyPoint[] {
  let volumeScale = 0, weight = 0, average = 0
  return bars.map((bar, i) => {
    if (!i || bar.time - bars[i - 1].time !== resolutionSeconds || bar.volume === null) { volumeScale = 0; weight = 0; average = 0 }
    if (bar.volume !== null && bar.volume > 0) {
      if (bar.volume > volumeScale) { weight *= volumeScale / bar.volume; volumeScale = bar.volume }
      const added = bar.volume / volumeScale
      const nextWeight = weight + added
      const typical = bar.high / 3 + bar.low / 3 + bar.close / 3
      average = weight === 0 ? typical : average * (weight / nextWeight) + typical * (added / nextWeight)
      weight = nextWeight
    }
    return weight > 0 && Number.isFinite(average) ? { time: bar.time, value: average } : { time: bar.time }
  })
}

/** Window-local display studies, never strategy signals. No inferred bars or
 * pre-window history: restart warmup after a missing interval. Arrays stay
 * candle-aligned so replay never reveals future indicator values. */
export function priceChartStudies(bars: readonly PriceBar[], resolutionSeconds: number) {
  const rsi: StudyPoint[] = [], upper: StudyPoint[] = [], lower: StudyPoint[] = []
  let changes = 0, gain = 0, loss = 0
  let window: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]
    const continuous = i > 0 && bar.time - bars[i - 1].time === resolutionSeconds
    if (!continuous) { changes = 0; gain = 0; loss = 0; window = [] }
    let value: number | undefined
    if (continuous) {
      const delta = bar.close - bars[i - 1].close
      changes++
      const divisor = Math.min(changes, 14)
      gain += (Math.max(0, delta) - gain) / divisor
      loss += (Math.max(0, -delta) - loss) / divisor
      // Both zero is undefined, not an invented 50/100 reading.
      if (changes >= 14 && (gain > 0 || loss > 0)) {
        value = loss === 0 ? 100 : gain === 0 ? 0 : 100 - 100 / (1 + gain / loss)
      }
    }
    rsi.push(value === undefined ? { time: bar.time } : { time: bar.time, value })
    window.push(bar.close)
    if (window.length > 20) window.shift()
    let high: number | undefined, low: number | undefined
    if (window.length === 20) {
      // Scale before variance to avoid overflow from squaring large prices.
      const scale = Math.max(...window)
      const normalized = window.map(close => close / scale)
      const mean = normalized.reduce((sum, close) => sum + close, 0) / 20
      const spread = 2 * Math.sqrt(normalized.reduce((sum, close) => sum + (close - mean) ** 2, 0) / 20)
      const a = (mean + spread) * scale, b = (mean - spread) * scale
      if (Number.isFinite(a) && Number.isFinite(b)) { high = a; low = b }
    }
    upper.push(high === undefined ? { time: bar.time } : { time: bar.time, value: high })
    lower.push(low === undefined ? { time: bar.time } : { time: bar.time, value: low })
  }
  return { rsi, upper, lower }
}
