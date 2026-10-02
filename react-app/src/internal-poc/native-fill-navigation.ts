import type { NativeChartWindow } from './native-service-api'

/** Read-only viewport hint, not a fill/price/contract validator. The native
 * chart adapter still owns manifest binding and its 1,000-bucket ceiling. */
export function nativeFillChartTarget(time: string, available: NativeChartWindow['requestedRange'], window: Pick<NativeChartWindow, 'requestedRange' | 'resolution'>):
  { kind: 'visible' } | { kind: 'request'; fromInclusive: string } | { kind: 'unavailable' } {
  const point = Date.parse(time), start = Date.parse(available.fromInclusive), end = Date.parse(available.toExclusive)
  const step = { '1m': 60_000, '15m': 900_000, '1h': 3_600_000, '1d': 86_400_000 }[window.resolution]
  if (![point, start, end].every(Number.isFinite) || !step || point < start || point >= end) return { kind: 'unavailable' }
  if (point >= Date.parse(window.requestedRange.fromInclusive) && point < Date.parse(window.requestedRange.toExclusive)) return { kind: 'visible' }
  // Twenty preceding buckets retain price context, clamped to the actual
  // intersection of series availability and segment bounds supplied by API.
  const from = Math.max(start, (Math.floor(point / step) - 20) * step)
  return { kind: 'request', fromInclusive: new Date(from).toISOString().replace('.000Z', 'Z') }
}
