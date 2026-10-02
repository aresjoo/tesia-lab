import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { catalogueChartPath, catalogueChartSeries, catalogueChartTicks, type CatalogueChartMode, type CatalogueChartInterval, type CatalogueChartInput } from '../client-catalogue-chart'
import { useClientPreferences } from '../client-preferences'
import { sharedPercent } from '../client-shared-number-format'
import { sharedChartCopy } from '../client-shared-chart-copy'
import copy from '../client-catalogue-chart-copy.json'
import catalogueCopy from '../client-catalogue-ui-copy.json'
import '../client-shared-equity-chart.css'

export function ClientCatalogueChartControls({ days, mode, interval, onDays, onMode, onInterval }: {
  days: number; mode: CatalogueChartMode; interval: CatalogueChartInterval
  onDays: (days: number) => void; onMode: (mode: CatalogueChartMode) => void; onInterval: (interval: CatalogueChartInterval) => void
}) {
  const { language } = useClientPreferences(), text = copy[language], common = catalogueCopy[language], id = useId()
  const [help, setHelp] = useState<CatalogueChartMode | null>(null)
  const modes = useRef<HTMLDivElement>(null), touchHelp = useRef<boolean | null>(null)
  useEffect(() => {
    if (!help) return
    const closeOutside = (event: globalThis.PointerEvent) => { if (event.target instanceof Node && !modes.current?.contains(event.target)) setHelp(null) }
    document.addEventListener('pointerdown', closeOutside, true)
    return () => document.removeEventListener('pointerdown', closeOutside, true)
  }, [help])
  const options = [['ret', common.return, text.returnHint], ['pnl', text.profit, text.profitHint], ['bal', text.balance, text.balanceHint]] as const
  return <>
    <div className="catalogue-chart-controls">
      <div ref={modes} className="catalogue-chart-modes" role="group" aria-label={text.chartType} onKeyDown={event => { if (event.key === 'Escape') { setHelp(null); event.stopPropagation() } }} onPointerLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setHelp(null) }}>
        {options.map(([key, label, hint]) => <button key={key} type="button" aria-label={label} aria-pressed={mode === key} aria-describedby={help === key ? `${id}-${key}` : undefined} onPointerDown={event => { touchHelp.current = event.pointerType === 'touch' ? help === key : null }} onClick={() => { onMode(key); if (touchHelp.current !== null) setHelp(touchHelp.current ? null : key); touchHelp.current = null }} onFocus={() => setHelp(key)} onBlur={() => setHelp(null)} onPointerEnter={event => { if (event.pointerType !== 'touch') setHelp(key) }}>
          {label}<i aria-hidden="true">i</i>{help === key && <span role="tooltip" id={`${id}-${key}`} className="catalogue-control-tip"><strong>{label}</strong>{hint}</span>}
        </button>)}
      </div>
      <div className="catalogue-chart-right">
        <div className="catalogue-chart-interval" role="group" aria-label={text.interval}>
          {(['day', 'month'] as const).map(key => <button type="button" key={key} aria-pressed={interval === key} onClick={() => onInterval(key)}>{key === 'day' ? text.daily : text.monthly}</button>)}
        </div>
        <select aria-label={common.period} value={days} onChange={event => onDays(Number(event.target.value))}>{([7, 30, 90, 365, 0] as const).map(day => <option value={day} key={day}>{day === 0 ? common.all : common[String(day) as '7' | '30' | '90' | '365']}</option>)}</select>
      </div>
    </div>
    <p className="catalogue-chart-hint">{mode === 'ret' ? '' : days ? text.basisHint : text.wholeHint}</p>
  </>
}

type Series = NonNullable<ReturnType<typeof catalogueChartSeries>>
function Drawing({ series, mode, interval, days, amount }: { series: Series; mode: CatalogueChartMode; interval: CatalogueChartInterval; days: number; amount: number }) {
  const { language } = useClientPreferences(), id = useId(), host = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), tip = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800), [selected, setSelected] = useState<number | null>(null), [tipPosition, setTipPosition] = useState({ left: 0, top: 0 })
  const text = copy[language], common = catalogueCopy[language], label = mode === 'ret' ? common.return : mode === 'pnl' ? text.profit : text.balance
  const formatValue = (value: number) => mode === 'ret' ? sharedPercent(value, language) : new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0, minimumFractionDigits: 0, signDisplay: mode === 'pnl' ? 'exceptZero' : 'auto' }).format(value)
  const geometry = useMemo(() => {
    const points = series.points, values = points.map(p => p.value), base = mode === 'bal' ? amount : 0
    const ticks = catalogueChartTicks(Math.min(base, ...values), Math.max(base, ...values))
    if (ticks.length < 2) return null
    const min = ticks[0], max = ticks.at(-1)!, span = max - min, mobile = width < 560, height = mobile ? 236 : 280
    const digits = series.flat ? 0 : span < 4 ? 2 : span < 20 ? 1 : 0
    const tickText = ticks.map(value => mode === 'ret' ? sharedPercent(value, language, digits as 0 | 1 | 2) : new Intl.NumberFormat(language, { notation: Math.abs(value) >= 1e7 ? 'compact' : 'standard', maximumFractionDigits: 0 }).format(value))
    // The source's fixed 46/54px gutter clips large balances and some locales.
    const left = Math.min(width * .42, Math.max(mobile ? 46 : 54, ...tickText.map(t => [...t].length * 6.5 + 12))), right = width - 6, top = 24, bottom = height - 32
    const coordinates = points.map((p, index) => ({ x: left + index / (points.length - 1) * (right - left), y: top + (1 - (p.value - min) / span) * (bottom - top) }))
    const markers = [values.indexOf(Math.max(...values)), values.indexOf(Math.min(...values))].map((index, order) => {
      const point = coordinates[index], x = Math.max(left + 52, Math.min(right - 52, point.x))
      let y = point.y + (order === 0 ? -11 : 19)
      if (y < 14) y = point.y + 19
      if (y > bottom - 4) y = point.y - 11
      return { index, x, y, label: order === 0 ? 'Max' : 'Min' }
    }).filter((m, index, both) => m.index > 0 && both[0].index !== both[1].index && (index === 0 || Math.abs(m.x - both[0].x) >= 110 || Math.abs(m.y - both[0].y) >= 24))
    const dates = Array.from({ length: Math.min(mobile ? 4 : 5, points.length) }, (_, k) => k)
    const baseline = top + (1 - (base - min) / span) * (bottom - top)
    const split = Math.max(0, Math.min(1, (baseline - top) / (bottom - top)))
    const flatBase = series.flat && Math.abs(values[0] - base) < 1e-9
    const gain = flatBase ? '#8b9096' : '#2ebd85', loss = flatBase ? '#8b9096' : '#f0566a'
    const path = catalogueChartPath(coordinates, top, bottom)
    const area = `${path} L${right.toFixed(1)} ${baseline.toFixed(1)} L${left.toFixed(1)} ${baseline.toFixed(1)} Z`
    return { ticks, tickText, min, span, height, left, right, top, bottom, base, baseline, split, gain, loss, coordinates, markers, dates, path, area }
  }, [series, width, mode, language, amount])
  useLayoutEffect(() => {
    const element = host.current
    if (!element) return
    const measure = () => { if (element.clientWidth > 100) setWidth(previous => previous === element.clientWidth ? previous : element.clientWidth) }
    measure(); const observer = new ResizeObserver(measure); observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const point = selected === null ? null : series.points[selected]
  useLayoutEffect(() => {
    if (selected === null || !geometry || !tip.current || !host.current) return
    const at = geometry.coordinates[selected], element = tip.current, container = host.current
    const above = at.y - element.offsetHeight - 14
    const preferredTop = above >= 2 ? above : at.y + 14
    setTipPosition({ left: Math.max(4, Math.min(at.x - element.offsetWidth / 2, container.clientWidth - element.offsetWidth - 4)), top: Math.max(2, Math.min(preferredTop, geometry.height - element.offsetHeight - 2)) })
  }, [selected, geometry, language])
  const selectAt = (event: PointerEvent<SVGSVGElement>) => {
    if (!geometry) return
    const box = event.currentTarget.getBoundingClientRect()
    if (!box.width) return
    const x = (event.clientX - box.left) / box.width * width
    setSelected(Math.max(0, Math.min(series.points.length - 1, Math.round((x - geometry.left) / (geometry.right - geometry.left) * (series.points.length - 1)))))
  }
  return <div ref={host} className="client-shared-equity-chart catalogue-overview-chart" data-point-count={series.points.length} data-chart-mode={mode} data-chart-interval={interval}>
    {geometry ? <>
      <svg ref={svg} className="catalogue-overview-svg anim" viewBox={`0 0 ${width} ${geometry.height}`} style={{ height: geometry.height }} role="img" tabIndex={0} aria-label={label} aria-describedby={`${id}-help${point ? ` ${id}-tip` : ''}`} onFocus={() => setSelected(series.points.length - 1)} onBlur={() => setSelected(null)} onPointerDown={event => { event.currentTarget.focus({ preventScroll: true }); selectAt(event) }} onPointerMove={event => { if (event.pointerType !== 'touch') selectAt(event) }} onPointerLeave={() => { if (document.activeElement !== svg.current) setSelected(null) }} onKeyDown={event => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { setSelected(null); return }
        const index = selected ?? series.points.length - 1
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? series.points.length - 1 : event.key === 'ArrowLeft' ? Math.max(0, index - 1) : event.key === 'ArrowRight' ? Math.min(series.points.length - 1, index + 1) : null
        if (next !== null) { event.preventDefault(); setSelected(next) }
      }}>
        {geometry.ticks.map((tick, index) => { const y = geometry.top + (1 - (tick - geometry.min) / geometry.span) * (geometry.bottom - geometry.top); return <g key={index} aria-hidden="true">{tick !== geometry.base && <line x1={geometry.left} x2={geometry.right} y1={y} y2={y}/>}<text x={geometry.left - 10} y={y + 4} textAnchor="end">{geometry.tickText[index]}</text></g> })}
        <line className="catalogue-baseline" x1={geometry.left} x2={geometry.right} y1={geometry.baseline} y2={geometry.baseline} aria-hidden="true"/>
        {geometry.dates.map((k, _, all) => { const index = Math.round(k * (series.points.length - 1) / (all.length - 1)), date = series.points[index].date; return <text key={k} x={geometry.coordinates[index].x} y={geometry.height - 8} textAnchor={k === 0 ? 'start' : k === all.length - 1 ? 'end' : 'middle'}>{(interval === 'month' || !days || days > 200 ? date.slice(2, 7) : date.slice(5)).replace('-', '.')}</text> })}
        <defs>
          <clipPath id={`${id}-reveal`}><rect className="rvl" width={width} height={geometry.height} style={{ animationDuration: '.9s', animationDelay: '0s', animationTimingFunction: 'cubic-bezier(.4,0,.2,1)' }}/></clipPath>
          <linearGradient id={`${id}-line`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={geometry.top} y2={geometry.bottom}>
            <stop offset="0" stopColor={geometry.gain}/><stop offset={geometry.split} stopColor={geometry.gain}/>
            <stop offset={geometry.split} stopColor={geometry.loss}/><stop offset="1" stopColor={geometry.loss}/>
          </linearGradient>
          <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={geometry.top} y2={geometry.bottom}>
            <stop offset="0" stopColor={geometry.gain} stopOpacity=".30"/><stop offset={geometry.split} stopColor={geometry.gain} stopOpacity=".02"/>
            <stop offset={geometry.split} stopColor={geometry.loss} stopOpacity=".02"/><stop offset="1" stopColor={geometry.loss} stopOpacity=".30"/>
          </linearGradient>
        </defs>
        <g clipPath={`url(#${id}-reveal)`}>
          <path className="catalogue-equity-fill" d={geometry.area} fill={`url(#${id}-fill)`}/>
          <path className="catalogue-equity-line" d={geometry.path} stroke={`url(#${id}-line)`}/>
        </g>
        <g className="catalogue-extrema" opacity={point ? .28 : 1}>{geometry.markers.map(m => <g key={m.label}><circle cx={geometry.coordinates[m.index].x} cy={geometry.coordinates[m.index].y} r="3.4"/><text x={m.x} y={m.y} textAnchor="middle">{m.label} {formatValue(series.points[m.index].value)}</text></g>)}</g>
        {selected !== null && <g data-selected-index={series.points[selected].i} aria-hidden="true"><line className="catalogue-crosshair" x1={geometry.coordinates[selected].x} x2={geometry.coordinates[selected].x} y1={geometry.top} y2={geometry.bottom}/><circle className="catalogue-selected" cx={geometry.coordinates[selected].x} cy={geometry.coordinates[selected].y} r="5"/></g>}
      </svg>
      {point && <div ref={tip} role="tooltip" id={`${id}-tip`} className="catalogue-value-tip" style={tipPosition}><span>{(interval === 'month' && selected !== 0 ? point.date.slice(0, 7) : point.date).replaceAll('-', '.')}</span><b>{label} {formatValue(point.value)}</b></div>}
      {series.flat && <p className="catalogue-flat" style={{ left: geometry.left }}>{text.flat.replace('{metric}', label)}</p>}
    </> : <p role="status">{sharedChartCopy(language, '차트 데이터가 없어요')}</p>}
    <p id={`${id}-help`} className="shared-chart-sr">{sharedChartCopy(language, '좌우 방향키로 각 관측일, Home과 End로 처음과 끝을 확인하세요. Escape로 상세 표시를 닫습니다.')}</p>
  </div>
}

export function ClientCatalogueChart({ value, days, mode, interval, amount = 1000 }: { value: CatalogueChartInput; days: number; mode: CatalogueChartMode; interval: CatalogueChartInterval; amount?: number }) {
  const { language } = useClientPreferences()
  const series = useMemo(() => catalogueChartSeries(value, days, mode, interval, amount), [value, days, mode, interval, amount])
  return series ? <Drawing key={`${value.strategy.id}:${days}:${mode}:${interval}:${amount}`} series={series} mode={mode} interval={interval} days={days} amount={amount}/> : <p role="status">{sharedChartCopy(language, '차트 데이터가 없어요')}</p>
}
