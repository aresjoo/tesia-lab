import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { sourceTerminalDate, sourceTerminalPrices, type SourceTerminalEvaluation } from '../client-terminal-source-fixture'
import '../client-delegation-chart.css'

export type ClientDelegationChartProps = {
  asset: string
  evaluation: SourceTerminalEvaluation
  compact?: boolean
  interval?: string
  onIntervalChange?: (interval: string) => void
}
const dateLabel = (index: number) => {
  const d = sourceTerminalDate(index)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
const priceLabel = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

/** 42a0d81 tfMarkers: PRICE, not equity/OHLC. Coordinates refer to the supplied
 * evaluation window; markers use its actual completed trades, not sample events.
 * Weekly/monthly views take the LAST supplied daily close in each calendar bucket.
 * The faint daily trace retains the exact price location of intermediate trades.
 */
export function ClientDelegationChart({ asset, evaluation, compact = false, interval, onIntervalChange }: ClientDelegationChartProps) {
  const host = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(760)
  const [plotHeight, setPlotHeight] = useState(340)
  const [localInterval, setLocalInterval] = useState('1D')
  const selectedInterval = compact ? '1D' : interval ?? localInterval
  const resolution = ['1W', '1M'].includes(selectedInterval) ? selectedInterval : '1D'
  const [selection, setSelection] = useState<{ result: SourceTerminalEvaluation; index: number } | null>(null)
  const id = useId()
  useLayoutEffect(() => {
    const node = host.current
    if (!node) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === node && entry.contentRect.width > 0) setWidth(Math.max(180, Math.round(entry.contentRect.width)))
        if (entry.target === svgRef.current && entry.contentRect.height > 0) setPlotHeight(Math.max(100, Math.round(entry.contentRect.height)))
      }
    })
    observer.observe(node)
    if (svgRef.current) observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [evaluation])
  const height = compact ? 240 : plotHeight
  const { startI: start, endI: end } = evaluation.r.params
  const valid = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start && end < sourceTerminalPrices.length
  const graph = useMemo(() => {
    if (!valid) return null
    const indices = Array.from({ length: end - start + 1 }, (_, index) => index + start)
    const values = indices.map(index => sourceTerminalPrices[index])
    const min = Math.min(...values), max = Math.max(...values), padding = (max - min || Math.max(1, max * .01)) * .12
    const lo = min - padding, hi = max + padding
    const right = width - 78, bottom = height - 35
    const x = (index: number) => end === start ? (14 + right) / 2 : 14 + (index - start) / (end - start) * (right - 14)
    const y = (value: number) => bottom - (value - lo) / (hi - lo) * (bottom - 18)
    const buckets = new Map<string, number>()
    for (const index of indices) {
      const date = sourceTerminalDate(index)
      if (resolution === '1W') {
        date.setDate(date.getDate() - (date.getDay() + 6) % 7)
        buckets.set(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`, index)
      } else if (resolution === '1M') buckets.set(`${date.getFullYear()}-${date.getMonth()}`, index)
      else buckets.set(String(index), index)
    }
    const samples = [...buckets.values()]
    const path = (points: readonly number[]) => points.map((index, i) => `${i ? 'L' : 'M'}${x(index).toFixed(2)},${y(sourceTerminalPrices[index]).toFixed(2)}`).join(' ')
    // Three date labels on narrow screens, never duplicate dates for short windows.
    const tickCount = width < 600 ? 3 : 5
    const ticks = [...new Set(Array.from({ length: tickCount }, (_, index) => start + Math.round((end - start) * index / (tickCount - 1))))]
    return { indices, samples, path: path(samples), dailyPath: path(indices), x, y, lo, hi, right, bottom, ticks }
  }, [valid, start, end, resolution, width, height])
  const selected = graph ? Math.max(start, Math.min(end, selection?.result === evaluation ? selection.index : end)) : null
  const trades = useMemo(() => {
    const supplied = evaluation.r.trades.filter(trade => Number.isInteger(trade.entry) && Number.isInteger(trade.exit) && trade.entry >= start && trade.exit >= trade.entry && trade.exit <= end)
    // Original tfWorkRun stores cur.trades = res.trades.slice(-40) for tfMarkers.
    // Preserve that report density; the full work chart retains all trades.
    return compact ? supplied.slice(-40) : supplied
  }, [evaluation, start, end, compact])
  const selectedTrades = trades.filter(trade => trade.entry === selected || trade.exit === selected)
  const changeInterval = (next: string) => {
    if (onIntervalChange) onIntervalChange(next)
    else setLocalInterval(next)
  }
  return <div ref={host} className={`tf-chart client-delegation-source-chart${compact ? ' compact' : ''}`} data-source="client-synthetic-daily" data-start-index={valid ? start : undefined} data-end-index={valid ? end : undefined}>
    <div className="tf-chart-toolbar"><strong>{asset}</strong><span>{resolution === '1W' ? '주간 종가' : resolution === '1M' ? '월간 종가' : '일별 종가'} · 원본 합성 일봉</span>{!compact && <div className="tf-chart-intervals" aria-label="가격 표시 간격">{['1D', '1W', '1M'].map(value => <button key={value} type="button" aria-pressed={resolution === value} onClick={() => changeInterval(value)}>{value}</button>)}</div>}</div>
    {!graph || selected === null ? <p className="tf-source-empty">검증 구간을 표시할 수 없어요.</p> : <>
      <div className="tf-source-readout" id={`${id}-readout`}><time>{dateLabel(selected)}</time><span>종가 <b>{priceLabel(sourceTerminalPrices[selected])}</b></span><span className="tf-source-tradeinfo">{selectedTrades.map((trade, i) => <span key={i} className={trade.entry === selected ? 'u' : 'd'}>{trade.entry === selected ? '▲ 매수' : '▼ 매도'}{trade.exit === selected && ` · 거래 손익 ${trade.pnl >= 0 ? '+' : ''}${(trade.pnl * 100).toFixed(2)}%`}</span>)}</span></div>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} style={compact ? { height: 240 } : undefined} role="img" tabIndex={0} aria-label={`${asset} 과거 검증 구간 가격, 매수와 매도 지점`} aria-describedby={`${id}-summary ${id}-help ${id}-readout`} onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        const localX = (event.clientX - rect.left) / rect.width * width
        const index = start + Math.round(Math.max(0, Math.min(1, (localX - 14) / (graph.right - 14))) * (end - start))
        setSelection(previous => previous?.result === evaluation && previous.index === index ? previous : { result: evaluation, index })
      }} onKeyDown={event => {
        if (event.altKey || event.metaKey || event.ctrlKey) return
        const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -30, PageDown: 30 }
        if (!(event.key in steps) && event.key !== 'Home' && event.key !== 'End') return
        event.preventDefault()
        setSelection({ result: evaluation, index: event.key === 'Home' ? start : event.key === 'End' ? end : Math.max(start, Math.min(end, selected + steps[event.key])) })
      }}>
        <title>{asset} · 원본 합성 일봉 · 완료 거래 {trades.length}회</title>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = graph.hi - (graph.hi - graph.lo) * tick / 4, y = graph.y(value)
          return <g key={tick} aria-hidden="true"><line x1="14" x2={graph.right} y1={y} y2={y} stroke="rgba(255,255,255,.065)" /><text x={width - 7} y={y + 4} textAnchor="end" fill="#9aa0a6" fontSize="11">{Math.round(value).toLocaleString('en-US')}</text></g>
        })}
        <defs><clipPath id={`${id}-reveal`}><rect key={`${start}-${end}-${resolution}`} className="tf-source-reveal" x="12" y="0" width={graph.right - 10} height={height} style={{ '--reveal-width': `${graph.right - 10}px` } as CSSProperties} /></clipPath></defs>
        <g clipPath={`url(#${id}-reveal)`}>
          {resolution !== '1D' && <path className="tf-source-daily" d={graph.dailyPath} fill="none" stroke="rgba(143,178,255,.2)" strokeWidth="1" />}
          <path className="tf-source-price" data-points={graph.samples.length} d={graph.path} fill="none" stroke="rgba(143,178,255,.75)" strokeWidth="1.5" />
          {graph.samples.length === 1 && <circle cx={graph.x(graph.samples[0])} cy={graph.y(sourceTerminalPrices[graph.samples[0]])} r="2" fill="#8fb2ff" />}
        </g>
        {trades.flatMap((trade, ordinal) => (['entry', 'exit'] as const).map(side => {
          const index = trade[side], x = graph.x(index), y = graph.y(sourceTerminalPrices[index]), buy = side === 'entry'
          const delay = Math.max((index - start) / Math.max(1, end - start) * 1500, (ordinal + 1) / Math.max(1, trades.length) / 1.15 * 1800)
          return <path key={`${trade.entry}-${trade.exit}-${side}`} className="tf-source-marker" data-side={buy ? 'BUY' : 'SELL'} data-index={index} data-price={sourceTerminalPrices[index]} style={{ '--marker-delay': `${delay}ms` } as CSSProperties} d={buy ? `M${x},${y + 5}l-4.5,6h9Z` : `M${x},${y - 5}l-4.5,-6h9Z`} fill={buy ? '#56c486' : '#ee766a'}><title>{buy ? '매수' : '매도'} {dateLabel(index)} · 표시 종가 {priceLabel(sourceTerminalPrices[index])}{!buy && ` · ${trade.kind === 'sl' ? '손절' : trade.kind === 'tp' ? '익절' : '기간 청산'} · 거래 손익 ${(trade.pnl * 100).toFixed(2)}%`}</title></path>
        }))}
        {selection?.result === evaluation && <g className="tf-source-crosshair" aria-hidden="true"><line x1={graph.x(selected)} x2={graph.x(selected)} y1="14" y2={graph.bottom} stroke="rgba(196,199,197,.4)" strokeDasharray="3 4" /><circle cx={graph.x(selected)} cy={graph.y(sourceTerminalPrices[selected])} r="3" fill="#8fb2ff" stroke="#11151c" strokeWidth="1.5" /></g>}
        {graph.ticks.map((index, position) => <text className="tf-source-date" key={index} x={graph.x(index)} y={height - 10} textAnchor={position === 0 ? 'start' : position === graph.ticks.length - 1 ? 'end' : 'middle'} fill="#9aa0a6" fontSize="11">{dateLabel(index)}</text>)}
      </svg>
      <p className="tf-chart-caption">과거 검증 구간의 매수(▲)와 매도(▼) 지점{compact && evaluation.r.trades.length > 40 && <span>최근 40회 거래 표시</span>}{resolution !== '1D' && <span>옅은 선은 일별 종가</span>}</p>
      <p className="tf-source-sr" id={`${id}-summary`}>{dateLabel(start)}부터 {dateLabel(end)}까지 {end - start + 1}개 합성 일봉. 수익률 {evaluation.r.ret.toFixed(2)}%, 최대 낙폭 {evaluation.r.mdd.toFixed(2)}%, 완료 거래 {evaluation.r.n}회. 마커는 진입·청산일의 종가 위치이며 규칙상 체결 가격과 다를 수 있습니다. 실제 시장 데이터가 아닙니다.</p>
      <p className="tf-source-sr" id={`${id}-help`}>방향키로 하루씩, PageUp과 PageDown으로 30일씩, Home과 End로 구간 처음과 끝을 확인하세요.</p>
    </>}
  </div>
}
export default ClientDelegationChart
