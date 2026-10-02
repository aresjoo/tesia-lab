import { useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useClientPreferences } from '../client-preferences'
import { sharingDetailCopy } from '../client-sharing-detail-copy'
import { sharedChartCopy, type SharedChartCopyKey } from '../client-shared-chart-copy'
import { sharedNumber, sharedPercent } from '../client-shared-number-format'
import '../client-shared-equity-chart.css'

export type ClientSharedEquityChartProps = {
  equity: readonly { i: number; v: number }[]
  indexToDate: (index: number) => Date
  replayKey: string
}
type Point = { i: number; v: number; date: string; month: string; civilDate: Date }

// Source 912c976: use the actual SVG transform, including letterboxing.
// A missing/singular matrix falls back to the existing rectangular mapping.
function transformPoint(element: SVGSVGElement, x: number, y: number, inverse = false): { x: number; y: number } | null {
  try {
    const matrix = element.getScreenCTM()
    if (!matrix) return null
    const inverted = matrix.inverse()
    if (!Number.isFinite(inverted.a)) return null
    const point = new DOMPoint(x, y).matrixTransform(inverse ? inverted : matrix)
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null
  } catch { return null }
}

/** Client source 501053b tfSS3Chart / tfSS3DD, not a native result adapter.
 * Reject an ambiguous timeline rather than sorting/filtering or inventing values.
 * The value is the supplied equity multiplier (1 = initial equity).
 */
function prepare(equity: ClientSharedEquityChartProps['equity'], indexToDate: ClientSharedEquityChartProps['indexToDate']) {
  if (!Array.isArray(equity) || equity.length < 2) return null
  const points: Point[] = []
  let min = Infinity, max = -Infinity, peakIndex = 0, previous = -1, flatBase = true
  try {
    for (const point of equity) {
      // Source terminal mark-to-market can repeat the final index. Preserve
      // those observations and reject only backwards time, never valid repeats.
      if (!point || !Number.isSafeInteger(point.i) || point.i < 0 || point.i < previous || !Number.isFinite(point.v) || !Number.isFinite((point.v - 1) * 100)) return null
      const date = indexToDate(point.i)
      if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null
      // The source supplies a civil day, not a timestamp to move between zones.
      // setUTCFullYear also preserves years 0–99 (Date.UTC remaps them to 1900s).
      const civilDate = new Date(0)
      civilDate.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
      if (!Number.isFinite(civilDate.getTime())) return null
      if (point.v > max) { max = point.v; peakIndex = points.length }
      min = Math.min(min, point.v); previous = point.i
      flatBase = flatBase && Math.abs(point.v - 1) < 1e-12
      points.push({ i: point.i, v: point.v, date: `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`, month: `${date.getFullYear()}.${date.getMonth() + 1}`, civilDate })
    }
  } catch { return null }
  // Source mkdChartHtml always includes initial equity in the displayed domain.
  // A flat baseline needs a nonzero viewport range, not invented observations.
  const domainMin = Math.min(min, 1), domainMax = Math.max(max, 1)
  const range = domainMax - domainMin
  if (!Number.isFinite(range)) return null
  const span = range || .02
  let peak = 1, minimumDrawdown = 0
  const drawdown = points.map(point => {
    peak = Math.max(peak, point.v)
    const v = (point.v / peak - 1) * 100
    minimumDrawdown = Math.min(minimumDrawdown, v)
    return { i: point.i, v }
  })
  if (drawdown.some(point => !Number.isFinite(point.v))) return null
  return { points, min: range ? domainMin : .99, span, peakIndex, flatBase, drawdown, minimumDrawdown: Math.min(-.01, minimumDrawdown) }
}
type Data = NonNullable<ReturnType<typeof prepare>>

function Drawing({ data, equity, replayKey }: { data: Data; equity: ClientSharedEquityChartProps['equity']; replayKey: string }) {
  const { language } = useClientPreferences()
  const c = (key: SharedChartCopyKey, values?: Record<string, string | number>) => sharedChartCopy(language, key, values)
  const percent = (value: number, digits: 0 | 1 | 2 = 2) => sharedPercent(value, language, digits)
  const dates = useMemo(() => ({
    day: new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }),
    month: new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: 'short' }),
  }), [language])
  const id = useId(), host = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), tip = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1216, height: 360 })
  const [selection, setSelection] = useState<{ source: typeof equity; index: number } | null>(null)
  const [tipPosition, setTipPosition] = useState({ left: 4, top: 2 })
  const { width: w, height: h } = size
  const { points, min, span, peakIndex, flatBase, drawdown, minimumDrawdown } = data
  const tickNumber = useMemo(() => new Intl.NumberFormat(language, {
    numberingSystem: 'latn', useGrouping: false, maximumSignificantDigits: 3,
    notation: span * 100 < .01 || span * 100 >= 10_000 ? 'scientific' : 'standard',
  }), [language, span])
  const first = points[0], last = points[points.length - 1]
  const selected = selection?.source === equity ? points[selection.index] : undefined
  const x = (index: number) => 56 + (index - first.i) / Math.max(1, last.i - first.i) * (w - 66)
  const y = (value: number) => 18 + (h - 52) - (value - min) / span * (h - 52)
  const gain = flatBase ? '#8b9096' : '#2ebd85', loss = flatBase ? '#8b9096' : '#f0566a'
  const up = last.v >= 1, color = up ? gain : loss
  const baselineY = y(1), split = Math.max(0, Math.min(1, (baselineY - 18) / (h - 52)))
  const sx = selected ? x(selected.i) : 0, sy = selected ? y(selected.v) : 0
  useLayoutEffect(() => {
    const element = svg.current
    if (!element) return
    const measure = () => {
      // Layout dimensions do not inherit a parent's transient scale animation.
      const width = element.clientWidth, height = element.clientHeight
      if (width > 66 && height > 52) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (!selected || !tip.current || !host.current || !svg.current) return
    const container = host.current, rect = container.getBoundingClientRect()
    const point = transformPoint(svg.current, sx, sy)
    // Absolute offsets and dimensions share the host's local CSS pixel space,
    // not transformed screen pixels (for example during a parent scale reveal).
    const px = point && rect.width > 0 ? (point.x - rect.left) * container.clientWidth / rect.width : sx
    const py = point && rect.height > 0 ? (point.y - rect.top) * container.clientHeight / rect.height : sy
    const width = tip.current.offsetWidth, height = tip.current.offsetHeight
    setTipPosition({ left: Math.max(4, Math.min(px - width / 2, container.clientWidth - width - 4)), top: Math.max(2, Math.min(py - height - 8, container.clientHeight - height - 2)) })
  }, [selected, sx, sy, w, h, language])
  const samples = useMemo(() => {
    const step = Math.max(1, Math.floor(points.length / 180))
    const indices: number[] = []
    for (let i = 0; i < points.length; i += step) indices.push(i)
    // Source includes the endpoint even when the last sampled index is identical.
    indices.push(points.length - 1)
    return indices
  }, [points])
  const line = samples.map(index => `${x(points[index].i).toFixed(1)},${y(points[index].v).toFixed(1)}`).join(' ')
  const ddPath = useMemo(() => {
    const step = Math.max(1, Math.floor(drawdown.length / 240)), sampled = drawdown.filter((_, i) => i % step === 0)
    if (sampled[sampled.length - 1] !== drawdown[drawdown.length - 1]) sampled.push(drawdown[drawdown.length - 1])
    return sampled.map((point, i) => `${i ? 'L' : 'M'}${((point.i - first.i) / Math.max(1, last.i - first.i) * w).toFixed(1)} ${Math.round(point.v / minimumDrawdown * 112) + 4}`).join(' ')
  }, [drawdown, first.i, last.i, w, minimumDrawdown])
  const select = (index: number) => setSelection(previous => previous?.source === equity && previous.index === index ? previous : { source: equity, index })
  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
    const index = selection?.source === equity ? selection.index : points.length - 1
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'ArrowRight' ? Math.min(points.length - 1, index + 1) : undefined
    if (event.key === 'Escape') { setSelection(null); return }
    if (next === undefined) return
    event.preventDefault(); select(next)
  }
  const peak = points[peakIndex], peakX = x(peak.i)
  return <div className="client-shared-equity-chart" data-replay-key={replayKey} data-point-count={points.length}>
    <div className="ss3-bigwrap" ref={host}>
      <svg className="ss3-chart anim" ref={svg} viewBox={`0 0 ${w} ${h}`} role="img" tabIndex={0} aria-label={sharingDetailCopy(language, '누적 수익 곡선')} aria-describedby={`${id}-help${selected ? ` ${id}-tip` : ''}`} onKeyDown={keyboard} onFocus={() => select(points.length - 1)} onBlur={() => setSelection(null)} onPointerLeave={() => { if (document.activeElement !== svg.current) setSelection(null) }} onPointerMove={event => {
        if (event.pointerType === 'touch') return
        const rect = event.currentTarget.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const mapped = transformPoint(event.currentTarget, event.clientX, event.clientY, true)
        const localX = mapped?.x ?? (event.clientX - rect.left) * w / rect.width
        if (localX < 56 || localX > w - 10) { setSelection(null); return }
        const target = first.i + (localX - 56) / (w - 66) * (last.i - first.i)
        // Full, non-uniform source indices; O(log n), not sampled/ordinal lookup.
        let low = 0, high = points.length - 1
        while (low < high) { const mid = Math.floor((low + high) / 2); if (points[mid].i < target) low = mid + 1; else high = mid }
        select(low > 0 && target - points[low - 1].i <= points[low].i - target ? low - 1 : low)
      }}>
        <defs>
          <linearGradient id={`${id}-line-gradient`} gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2={h - 34}>
            <stop offset="0" stopColor={gain} /><stop offset={split} stopColor={gain} /><stop offset={split} stopColor={loss} /><stop offset="1" stopColor={loss} />
          </linearGradient>
          <linearGradient id={`${id}-gradient`} gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2={h - 34}>
            <stop offset="0" stopColor={gain} stopOpacity=".30" /><stop offset={split} stopColor={gain} stopOpacity=".02" /><stop offset={split} stopColor={loss} stopOpacity=".02" /><stop offset="1" stopColor={loss} stopOpacity=".30" />
          </linearGradient>
          <clipPath id={`${id}-reveal`}><rect className="rvl" x="0" y="0" width={w} height={h} /></clipPath>
        </defs>
        {[0, 1, 2, 3, 4].map(tick => { const value = min + span * tick / 4, yy = y(value).toFixed(1); return <g className="equity-tick" key={tick} aria-hidden="true"><line x1="56" y1={yy} x2={w - 10} y2={yy} /><text x="4" y={Number(yy) + 4}>{tickNumber.format((value - 1) * 100)}%</text></g> })}
        <text x="56" y={h - 6}>{language === 'ko' ? first.month : dates.month.format(first.civilDate)}</text><text x={w - 12} y={h - 6} textAnchor="end">{language === 'ko' ? last.month : dates.month.format(last.civilDate)}</text>
        <line className="equity-baseline" x1="56" x2={w - 10} y1={baselineY} y2={baselineY} aria-hidden="true" />
        <g clipPath={`url(#${id}-reveal)`}><path className="equity-fill" fill={`url(#${id}-gradient)`} stroke="none" d={`M${line.split(' ').join(' L')} L${x(last.i).toFixed(1)},${baselineY.toFixed(1)} L56,${baselineY.toFixed(1)} Z`} /><polyline className={`ln ${up ? 'up' : 'dn'}`} style={{ stroke: `url(#${id}-line-gradient)` }} pathLength="1" points={line} /></g>
        <g className="mxlb" data-peak-index={peak.i}><circle cx={peakX.toFixed(1)} cy={y(peak.v).toFixed(1)} r="3" fill={peak.v >= 1 ? gain : loss} /><text x={peakX.toFixed(1)} y={y(peak.v) - 8} textAnchor={peakX > w - 90 ? 'end' : peakX < 116 ? 'start' : 'middle'} style={{ fill: peak.v >= 1 ? gain : loss }}>{percent((peak.v - 1) * 100, 1)}</text></g>
        <circle className="endc" cx={x(last.i).toFixed(1)} cy={y(last.v).toFixed(1)} r="4" fill={color} /><circle className="endp" cx={x(last.i).toFixed(1)} cy={y(last.v).toFixed(1)} r="4" fill="none" stroke={color} />
        {selected && <g className="xh" data-selected-index={selected.i} aria-hidden="true"><line className="xline" x1={sx} x2={sx} y1="18" y2={h - 26} /><circle className="xdot" cx={sx} cy={sy} r="3.5" /></g>}
      </svg>
      {selected && <div className="ss3-xtip" id={`${id}-tip`} ref={tip} role="tooltip" style={tipPosition}><small>{language === 'ko' ? selected.date : dates.day.format(selected.civilDate)}</small><b className={selected.v >= 1 ? 'up' : 'dn'}>{percent((selected.v - 1) * 100)}</b></div>}
    </div>
    <p className="shared-chart-sr" id={`${id}-help`}>{c('좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.')}</p>
    <div className="ss3-drawdown"><div className="ss3-ch"><b>{c('낙폭 곡선 (Drawdown)')}</b><span className="mt2">{c('고점 대비 하락률, 최저 {value}%', { value: sharedNumber(minimumDrawdown, language) })}</span></div>
      <svg className="ss3-dd anim" viewBox={`0 0 ${w} 120`} preserveAspectRatio="none" role="img" aria-label={c('낙폭 곡선')}><defs><clipPath id={`${id}-dd-reveal`}><rect className="rvl dly" x="0" y="0" width={w} height="120" /></clipPath></defs><g clipPath={`url(#${id}-dd-reveal)`}><path d={`${ddPath} L ${w} 0 L 0 0 Z`} fill="rgba(224,96,75,.14)" /><path className="dd-line" d={ddPath} fill="none" stroke="#e0604b" strokeWidth="1.6" vectorEffect="non-scaling-stroke" /></g></svg>
    </div>
  </div>
}

export function ClientSharedEquityChart({ equity, indexToDate, replayKey }: ClientSharedEquityChartProps) {
  const { language } = useClientPreferences()
  const data = useMemo(() => prepare(equity, indexToDate), [equity, indexToDate])
  return data ? <Drawing key={replayKey} data={data} equity={equity} replayKey={replayKey} /> : <div className="client-shared-equity-chart"><div className="ss3-empty" role="status">{sharedChartCopy(language, '차트 데이터가 없어요')}</div></div>
}
export default ClientSharedEquityChart
