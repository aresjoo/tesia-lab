import type { CataloguePreviewResult } from './client-catalogue-preview'
import { catalogueDateReader, catalogueEquityWindow } from './client-catalogue-presentation'

export type CatalogueChartMode = 'ret' | 'pnl' | 'bal'
export type CatalogueChartInterval = 'day' | 'month'
export type CatalogueChartPoint = { i: number; date: string; value: number }
export type CatalogueChartInput = Pick<CataloguePreviewResult, 'strategy' | 'calendar' | 'result'>

/** 412fd60 final mkdSeries: a display window, never a new backtest.
 * Monthly keeps the first boundary and each month's LAST observation.
 * Dollar views use the explicit preview amount (default $1,000), not the user's account. */
export function catalogueChartSeries(value: CatalogueChartInput, days: number, mode: CatalogueChartMode, interval: CatalogueChartInterval, amount = 1000) {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const window = catalogueEquityWindow(value.result, days)
  if (!window || window.eq.length < 2) return null
  const readDate = catalogueDateReader(value.calendar)
  const daily: CatalogueChartPoint[] = []
  for (const point of window.eq) {
    const date = readDate(point.i)
    if (!Number.isFinite(date.getTime())) return null
    const label = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const observed = mode === 'ret' ? (point.v - 1) * 100 : mode === 'pnl' ? (point.v - 1) * amount : point.v * amount
    if (!Number.isFinite(observed)) return null
    daily.push({ i: point.i, date: label, value: observed })
  }
  const lastByMonth = new Map<string, CatalogueChartPoint>()
  if (interval === 'month') for (const point of daily) lastByMonth.set(point.date.slice(0, 7), point)
  const points = interval === 'day' ? daily : [daily[0], ...Array.from(lastByMonth.values()).filter(p => p !== daily[0])]
  return { points, flat: window.eq.every(p => Math.abs(p.v - window.eq[0].v) < 1e-12) }
}

/** Source mkdTicks with a bounded loop and explicit invalid-domain guard. */
export function catalogueChartTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min || !Number.isFinite(max - min)) return []
  if (!(max - min > 1e-9 * Math.max(1, Math.abs(min)))) {
    const pad = Math.abs(min) >= 100 ? Math.max(10, Math.round(Math.abs(min) * .01)) : 1
    return [min - pad, min, min + pad].filter(Number.isFinite)
  }
  const span = max - min, unit = 10 ** Math.floor(Math.log10(span / 5)), error = span / 5 / unit
  const step = unit * (error < 1.5 ? 1 : error < 3 ? 2 : error < 7 ? 5 : 10)
  if (!(step > 0) || !Number.isFinite(step)) return []
  const low = Math.floor(min / step) * step, high = Math.ceil(max / step) * step
  const count = Math.round((high - low) / step) + 1
  if (!Number.isFinite(low) || !Number.isFinite(high) || count < 2 || count > 20) return []
  const ticks = Array.from({ length: count }, (_, index) => Number((low + step * index).toFixed(6)))
  return ticks.every((v, i) => Number.isFinite(v) && (!i || v > ticks[i - 1])) ? ticks : []
}

/** Source Catmull-Rom drawing, bounded to the plot. Values/tooltips always
 * remain the actual samples; the curve does not create new observations. */
export function catalogueChartPath(points: readonly { x: number; y: number }[], top: number, bottom: number) {
  if (points.length < 2) return ''
  const clamp = (value: number) => Math.max(top, Math.min(bottom, value)).toFixed(1)
  let path = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[Math.max(0, index - 1)], p1 = points[index], p2 = points[index + 1], p3 = points[Math.min(points.length - 1, index + 2)]
    path += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${clamp(p1.y + (p2.y - p0.y) / 6)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${clamp(p2.y - (p3.y - p1.y) / 6)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return path
}
