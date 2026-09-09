import { useId, useLayoutEffect, useRef, useState } from 'react'
import { CLIENT_RESEARCH_FIXTURE as FIXTURE, researchPercent as pct } from '../client-research-fixtures'

const low = Math.min(...FIXTURE.prices.map(p => p[1]))
const high = Math.max(...FIXTURE.prices.map(p => p[1]))

// Prices include irregularly spaced trade points. Search in the plotted time
// coordinate, not in the array's ordinal position.
function nearestPrice(time: number) {
  let left = 0, right = FIXTURE.prices.length - 1
  while (left < right) {
    const middle = Math.floor((left + right) / 2)
    if (FIXTURE.prices[middle][0] < time) left = middle + 1
    else right = middle
  }
  return left > 0 && time - FIXTURE.prices[left - 1][0] <= FIXTURE.prices[left][0] - time ? left - 1 : left
}

/** Source fixture visualization only. Resize changes geometry, never trades or results. */
export function ClientResearchChart({ version, equity = false }: { version: 0 | 1; equity?: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(764)
  const [hover, setHover] = useState<number | null>(null)
  const [selection, setSelection] = useState(0)
  const helpId = useId()
  const focused = useRef(false)
  function selectPrice(index: number) { setSelection(index); setHover(index) }
  useLayoutEffect(() => {
    const node = viewport.current
    if (!node) return
    const measure = () => { if (node.clientWidth > 0) setWidth(node.clientWidth) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const res = FIXTURE.versions[version]
  const height = equity ? Math.max(96, Math.round(width * .13)) : Math.max(220, Math.round(width * .32))
  const plotBottom = height - 24
  const x = (i: number) => 4 + i / (FIXTURE.priceCount - 1) * (width - 8)
  const y = (p: number) => 22 + (1 - (p - low) / (high - low)) * (plotBottom - 44)
  const eqY = (v: number) => 8 + (1 - (v - .85) / .3) * (height - 16)
  const path = FIXTURE.prices.map(([i, p], j) => `${j ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p).toFixed(1)}`).join(' ')
  let previous = 1
  const equityPath = `M4 ${eqY(1)} ` + res.eq.map(e => {
    const step = `L${x(e.i).toFixed(1)} ${eqY(previous).toFixed(1)} L${x(e.i).toFixed(1)} ${eqY(e.v).toFixed(1)}`
    previous = e.v
    return step
  }).join(' ') + ` L${width - 4} ${eqY(previous).toFixed(1)}`
  const current = hover === null ? null : FIXTURE.prices[hover]
  const selected = current ?? FIXTURE.prices[selection]
  const priceLabel = `${selected[0] + 1}번째 봉, $${selected[1].toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  const tradeLabel = res.trades.flatMap(t => [
    ...(t.entry === selected[0] ? ['BUY 매수'] : []),
    ...(t.exit === selected[0] ? [`SELL 매도, 거래 손익 ${pct(t.pnl * 100)}`] : []),
    ...(t.entry < selected[0] && selected[0] < t.exit ? ['포지션 보유 중'] : []),
  ]).join(', ')
  return <div className={`g-chartbox ${equity ? 'rw-equity' : 'rw-price'}`}>
    <div className="g-note">{equity ? '자산 곡선' : '가격, 거래 시점, Holdout 봉인 구간'}</div>
    {!equity && <span id={helpId} className="rw-chart-help">방향키로 표시된 가격 지점을 이동합니다. PageUp과 PageDown은 10개 지점, Home과 End는 처음과 끝으로 이동합니다. 가격 표본 간 봉 간격은 일정하지 않습니다.</span>}
    <div ref={viewport} className="rw-chart-viewport">
      <svg viewBox={`0 0 ${width} ${height}`} role={equity ? 'img' : 'slider'} aria-label={equity ? `Backtest v${version + 1} 자산 곡선` : `Backtest v${version + 1} 가격과 매수·매도 시점`}
        tabIndex={equity ? undefined : 0} aria-valuemin={equity ? undefined : 1} aria-valuemax={equity ? undefined : FIXTURE.priceCount}
        aria-describedby={equity ? undefined : helpId}
        aria-valuenow={equity ? undefined : selected[0] + 1} aria-valuetext={equity ? undefined : [priceLabel, tradeLabel, selected[0] >= 910 ? 'Holdout 봉인 구간' : '연구 구간'].filter(Boolean).join(', ')}
        onFocus={() => { if (!equity) { focused.current = true; setHover(selection) } }}
        onBlur={() => { focused.current = false; setHover(null) }}
        onKeyDown={e => {
          if (equity) return
          const steps: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }
          if (!(e.key in steps) && e.key !== 'Home' && e.key !== 'End') return
          e.preventDefault()
          selectPrice(Math.max(0, Math.min(FIXTURE.prices.length - 1, e.key === 'Home' ? 0 : e.key === 'End' ? FIXTURE.prices.length - 1 : selection + steps[e.key])))
        }}
        onPointerLeave={() => { if (!focused.current) setHover(null) }} onPointerMove={e => {
          if (equity) return
          const rect = e.currentTarget.getBoundingClientRect()
          const fraction = ((e.clientX - rect.left) / rect.width * width - 4) / (width - 8)
          selectPrice(nearestPrice(Math.max(0, Math.min(1, fraction)) * (FIXTURE.priceCount - 1)))
        }}>
        {equity ? <>
          <line x1="4" x2={width - 4} y1={eqY(1)} y2={eqY(1)} className="rw-chart-grid" strokeDasharray="3 5" />
          <text x="4" y="14">시작 자산</text>
          <path d={`${equityPath} L${width - 4} ${height} L4 ${height} Z`} fill="rgba(91,138,247,.09)" />
          <path d={equityPath} fill="none" stroke="#5b8af7" strokeWidth="1.8" />
          <circle cx={width - 4} cy={eqY(previous)} r="3.5" fill="#5b8af7" />
        </> : <>
          {[0, 364, 730, 1095].map((i, j) => <g key={i}>
            <line x1={x(i)} x2={x(i)} y1="0" y2={plotBottom} className="rw-chart-grid" />
            <text x={Math.min(x(i), width - 32)} y={height - 6}>{2023 + j}</text>
          </g>)}
          <rect x={x(910)} y="0" width={width - 4 - x(910)} height={plotBottom} fill="rgba(91,138,247,.07)" />
          <line x1={x(910)} x2={x(910)} y1="0" y2={plotBottom} stroke="rgba(91,138,247,.55)" strokeDasharray="5 4" />
          <text x={Math.min(x(910) + 7, width - 62)} y="14">HOLDOUT</text>
          {res.trades.map(t => <rect key={t.entry} x={x(t.entry)} y="0" width={Math.max(2, x(t.exit) - x(t.entry))} height={plotBottom} fill={t.pnl > 0 ? 'rgba(78,192,141,.08)' : 'rgba(224,96,75,.08)'} />)}
          <path d={path} fill="none" stroke="#b9bdc6" strokeWidth="1.6" strokeLinejoin="round" />
          {res.trades.map(t => {
            const entry = FIXTURE.prices.find(p => p[0] === t.entry)![1]
            const exit = FIXTURE.prices.find(p => p[0] === t.exit)![1]
            return <g key={t.entry}>
              <path d={`M${x(t.entry)} ${y(entry) + 7} l4.5 8 h-9Z`} fill="#4ec08d"><title>BUY · {pct(t.pnl * 100)}</title></path>
              <path d={`M${x(t.exit)} ${y(exit) - 7} l4.5 -8 h-9Z`} fill={t.pnl > 0 ? '#4ec08d' : '#e0604b'}><title>SELL · {pct(t.pnl * 100)}</title></path>
            </g>
          })}
          {current && <>
            <line x1={x(current[0])} x2={x(current[0])} y1="0" y2={plotBottom} stroke="#767d8c" strokeDasharray="3 4" />
            <circle cx={x(current[0])} cy={y(current[1])} r="4" fill="#c5cad3" />
            <rect x="0" y="0" width="76" height="20" rx="4" fill="var(--g0)" />
            <text className="rw-chart-value" x="4" y="14">${current[1].toLocaleString('en-US', { maximumFractionDigits: 0 })}</text>
          </>}
        </>}
      </svg>
    </div>
  </div>
}
