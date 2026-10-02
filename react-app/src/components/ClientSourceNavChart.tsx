import { useId, useMemo } from 'react'
import { useClientPreferences } from '../client-preferences'
import { terminalReadText } from '../client-terminal-read-copy'
import { sourceTerminalDate } from '../client-terminal-source-fixture'

type Point = { i: number; v: number }
const width = 700, height = 150, areaFloor = 132, floor = 130

/** Source tfSS3Eq(eq,700,150,{dates:true}); values are equity multipliers.
 * A summary of the supplied source fixture, not an OHLC/live-service adapter.
 * Keep the original baseline/area/sampling. HTML dates stay readable at any width.
 */
function geometry(equity: readonly Point[]) {
  if (equity.length < 2) return null
  let min = Infinity, max = -Infinity, previous = -1
  for (const point of equity) {
    if (!point || !Number.isSafeInteger(point.i) || point.i < 0 || point.i < previous || !Number.isFinite(point.v)) return null
    min = Math.min(min, point.v); max = Math.max(max, point.v); previous = point.i
  }
  const first = equity[0], last = equity[equity.length - 1]
  const start = sourceTerminalDate(first.i), end = sourceTerminalDate(last.i)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !Number.isFinite(max - min)) return null
  if (max - min < 1e-9) max = min + 1e-9
  const span = Math.max(1e-9, max - min)
  const x = (index: number) => (index - first.i) / Math.max(1, last.i - first.i) * width
  const y = (value: number) => floor - (value - min) / span * 124
  const samples: string[] = [], step = Math.max(1, Math.floor(equity.length / 120))
  for (let index = 0; index < equity.length; index += step) {
    samples.push(`${x(equity[index].i).toFixed(1)},${y(equity[index].v).toFixed(1)}`)
  }
  // Use the supplied final index even for a repeated terminal observation.
  samples.push(`${x(last.i).toFixed(1)},${y(last.v).toFixed(1)}`)
  return { start, end, points: samples.join(' '), baseY: y(Math.min(Math.max(1, min), max)).toFixed(1), up: last.v >= 1 }
}

export function ClientSourceNavChart({ equity, label }: { equity: readonly Point[]; label: string }) {
  const { language } = useClientPreferences()
  const id = useId()
  const data = useMemo(() => geometry(equity), [equity])
  const formatter = useMemo(() => new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: 'short' }), [language])
  if (!data) return <div className="cst-nav-empty" role="status">{terminalReadText(language, 'emptyCurve')}</div>
  const month = (date: Date) => {
    if (language === 'ko') return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`
    const civil = new Date(0)
    civil.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
    return formatter.format(civil)
  }
  const color = data.up ? '#2fb98a' : '#ee766a'
  return <div className="cst-nav-chart" data-point-count={equity.length}>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".15" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <line className="base" x1="0" x2={width} y1={data.baseY} y2={data.baseY} vectorEffect="non-scaling-stroke" />
      <path className="area" fill={`url(#${id})`} d={`M${data.points.split(' ').join(' L')} L${width},${areaFloor} L0,${areaFloor} Z`} />
      <polyline className={`ln ${data.up ? 'up' : 'dn'}`} points={data.points} vectorEffect="non-scaling-stroke" />
    </svg>
    <div className="cst-nav-dates"><span>{month(data.start)}</span><span>{month(data.end)}</span></div>
  </div>
}
