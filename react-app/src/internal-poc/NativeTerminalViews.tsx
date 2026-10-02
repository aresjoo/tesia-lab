import { useId, useMemo, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { nativeTerminalViewCopy, type NativeTerminalViewCopyKey } from './native-terminal-view-copy'
import type { NativeTerminalCompletedProps, NativeTerminalDashboardProps, NativeTerminalEquity, NativeTerminalPosition, NativeTerminalTrade, NativeTerminalTradeOpen, NativeTerminalValue } from './native-terminal-view-presentation'
import '../client-restored-research.css'
import '../client-source-terminal.css'

const chartWidth = 700, chartHeight = 150, chartBottom = 130, chartTop = 6
function useWords() { const { language } = useClientPreferences(); return (key: NativeTerminalViewCopyKey, values?: Readonly<Record<string, string>>) => nativeTerminalViewCopy(language, key, values) }
function Value({ value }: { value?: NativeTerminalValue }) { return <span className={`cst-value-part ${value?.tone ?? ''}`}>{value?.text ?? '—'}</span> }
function Pair({ first, second, separator = ' ' }: { first?: NativeTerminalValue; second?: NativeTerminalValue; separator?: string }) { return <><Value value={first} />{separator}<Value value={second} /></> }
function Matrix({ entries, compact = false }: { entries: readonly { id: string; label: string; value: ReactNode }[]; compact?: boolean }) {
  return <dl className={`cst-matrix${compact ? ' compact' : ''}`}>{entries.map(item => <div key={item.id} data-metric={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
}

/** Coordinates only. No returns, interpolation, dates or financial records are produced.
 * Min/max sampling keeps the supplied extrema with a bounded SVG vertex count.
 */
function geometry(equity: NativeTerminalEquity) {
  const points = equity.points
  if (!points.length) return null
  let min = Infinity, max = -Infinity, previousTime = -Infinity
  for (const point of points) {
    if (!point || !Number.isFinite(point.value) || !Number.isSafeInteger(point.time) || Math.abs(point.time) > 8.64e15 || point.time < previousTime) return null
    previousTime = point.time; min = Math.min(min, point.value); max = Math.max(max, point.value)
  }
  if (equity.baseline !== undefined) {
    if (!Number.isFinite(equity.baseline)) return null
    min = Math.min(min, equity.baseline); max = Math.max(max, equity.baseline)
  }
  const start = points[0].time, end = points[points.length - 1].time, range = max - min, duration = end - start
  if (!Number.isFinite(range) || !Number.isFinite(duration) || points.length > 1 && duration <= 0) return null
  const x = (time: number) => duration === 0 ? chartWidth / 2 : (time - start) / duration * chartWidth
  const y = (value: number) => range === 0 ? (chartBottom + chartTop) / 2 : chartBottom - (value - min) / range * (chartBottom - chartTop)
  const indices = new Set<number>([0, points.length - 1]), bucket = Math.max(1, Math.ceil(points.length / 240))
  for (let offset = 0; offset < points.length; offset += bucket) {
    let lo = offset, hi = offset
    for (let i = offset; i < Math.min(points.length, offset + bucket); i++) { if (points[i].value < points[lo].value) lo = i; if (points[i].value > points[hi].value) hi = i }
    indices.add(lo); indices.add(hi)
  }
  const sampled = [...indices].sort((a, b) => a - b)
  const line = sampled.map(index => `${x(points[index].time).toFixed(2)},${y(points[index].value).toFixed(2)}`).join(' ')
  return { x, y, start, end, line, sampledCount: sampled.length, baseline: equity.baseline === undefined ? undefined : y(equity.baseline) }
}
function NavChart({ equity }: { equity?: NativeTerminalEquity | null }) {
  const { language } = useClientPreferences(), t = useWords(), id = useId()
  const chart = useMemo(() => equity ? geometry(equity) : null, [equity])
  const [selection, setSelection] = useState<{ source: NativeTerminalEquity; index: number } | null>(null)
  const selected = equity && selection?.source === equity ? equity.points[selection.index] : undefined
  const formatDate = useMemo(() => new Intl.DateTimeFormat(language, { timeZone: 'UTC', calendar: 'gregory', year: 'numeric', month: '2-digit', day: '2-digit' }), [language])
  if (!equity || !chart) return <div className="cst-nav-empty" role="status">{t(!equity ? 'curveUnavailable' : equity.points.length ? 'curveInvalid' : 'emptyCurve')}</div>
  const color = equity.tone === 'up' ? '#2fb98a' : equity.tone === 'dn' ? '#ee766a' : '#9aa0a6'
  const nearest = (time: number) => {
    let left = 0, right = equity.points.length - 1
    while (left < right) { const mid = Math.floor((left + right) / 2); if (equity.points[mid].time < time) left = mid + 1; else right = mid }
    return left > 0 && time - equity.points[left - 1].time < equity.points[left].time - time ? left - 1 : left
  }
  const date = (point: typeof equity.points[number]) => point.timeLabel ?? `${formatDate.format(point.time)} UTC`
  return <div className="cst-nav-chart" data-point-count={equity.points.length} data-rendered-points={chart.sampledCount}>
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-labelledby={`${id}-title ${id}-description`} tabIndex={0}
      onFocus={() => { if (!selected) setSelection({ source: equity, index: 0 }) }}
      onBlur={() => setSelection(null)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const current = selection?.source === equity ? selection.index : 0
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? equity.points.length - 1 : Math.max(0, Math.min(equity.points.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)))
        setSelection({ source: equity, index })
      }}
      onPointerMove={event => {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (bounds.width <= 0) return
        const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
        setSelection({ source: equity, index: nearest(chart.start + ratio * (chart.end - chart.start)) })
      }} onPointerLeave={event => { if (document.activeElement !== event.currentTarget) setSelection(null) }}>
      <title id={`${id}-title`}>{t('navCurve')}</title><desc id={`${id}-description`}>{equity.description} {t('chartKeys')}</desc>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".15" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {chart.baseline !== undefined && <line className="base" x1="0" x2={chartWidth} y1={chart.baseline} y2={chart.baseline} vectorEffect="non-scaling-stroke" />}
      {equity.points.length > 1 ? <><path className="area" fill={`url(#${id}-fill)`} d={`M${chart.line.split(' ').join(' L')} L${chartWidth},132 L0,132 Z`} /><polyline className={`ln ${equity.tone ?? 'zz'}`} stroke={color} points={chart.line} vectorEffect="non-scaling-stroke" /></> : <circle data-observation="single" cx={chart.x(equity.points[0].time)} cy={chart.y(equity.points[0].value)} r="3.5" fill={color} />}
      {selected && <><line x1={chart.x(selected.time)} x2={chart.x(selected.time)} y1={chartTop} y2={chartBottom} stroke="var(--gt3)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" /><circle cx={chart.x(selected.time)} cy={chart.y(selected.value)} r="3.5" fill={color} /></>}
    </svg>
    <div className="cst-nav-dates" style={{ position: 'static', flexWrap: 'wrap' }}><span style={{ whiteSpace: 'normal', maxWidth: '100%', overflowWrap: 'anywhere' }}>{equity.startLabel ?? date(equity.points[0])}</span><span style={{ whiteSpace: 'normal', maxWidth: '100%', overflowWrap: 'anywhere' }}>{equity.endLabel ?? date(equity.points[equity.points.length - 1])}</span></div>
    <div className="g-note" aria-live="polite" aria-atomic="true" style={{ minHeight: '1.65em', overflowWrap: 'anywhere' }}>{selected ? `${date(selected)} · ${t('observedNav')} ${selected.valueLabel ?? String(selected.value)}` : '\u00a0'}</div>
  </div>
}

function Position({ position, onOpen }: { position?: NativeTerminalPosition; onOpen?: NativeTerminalDashboardProps['onOpenPosition'] }) {
  const t = useWords(), available = position?.state === 'available' ? position : undefined
  if (position?.state === 'empty') return <div className="cst-empty"><b>{t('noPosition')}</b>{position.description && <p>{position.description}</p>}</div>
  return <div className="cst-position" data-position-state={position?.state ?? 'unavailable'}>
    <div className="cst-position-head"><span className={available?.side === 'LONG' ? 'cst-long' : undefined}>{available?.side ?? '—'}</span><b>{available?.symbol ?? '—'}</b><span><Pair first={available?.pnl} second={available?.pnlPercent} /></span></div>
    <dl>{(['entryPrice', 'currentPrice', 'quantity', 'stopPrice', 'targetPrice', 'holding'] as const).map(key => <div key={key} data-metric={key}><dt>{t(key)}</dt><dd>{available?.[key] ?? '—'}</dd></div>)}</dl>
    {!available && <p className="g-note" role="status">{position?.description ?? t('positionUnavailable')}</p>}
    {available?.description && <p className="g-note">{available.description}</p>}
    <button type="button" className="cst-trade-details" disabled={!available || !onOpen} onClick={event => { if (available) onOpen?.(available.id, event.currentTarget) }}>{t('positionDetails')}</button>
  </div>
}

function RecentTrades({ trades, strategyName, onOpen, canOpen }: { trades?: readonly NativeTerminalTrade[] | null; strategyName: string; onOpen?: NativeTerminalTradeOpen; canOpen?: (tradeId: string) => boolean }) {
  const t = useWords()
  const rows = trades?.slice(0, 25)
  return <>{trades == null && <p className="g-note" role="status">{t('unavailable')}</p>}
    {rows?.length === 0 ? <p className="cst-empty">{t('noFills')}</p> : <div className="cst-table" tabIndex={0} role="region" aria-label={t('recentTradesLabel', { name: strategyName })}><table><thead><tr>{(['exitDate', 'type', 'entryPrice', 'exitPrice', 'holding', 'pnl'] as const).map((key, index) => <th scope="col" key={key} className={index >= 2 ? 'num' : undefined}>{t(key)}</th>)}</tr></thead><tbody>
      {rows ? rows.map(trade => <tr key={trade.id} data-trade-id={trade.id} onClick={event => {
        if (!onOpen || canOpen?.(trade.id) === false || !(event.target instanceof Element) || event.target.closest('button,a,input')) return
        const selection = window.getSelection()
        if (selection?.toString() && (event.currentTarget.contains(selection.anchorNode) || event.currentTarget.contains(selection.focusNode))) return
        const trigger = event.currentTarget.querySelector<HTMLButtonElement>('button')
        if (trigger) onOpen(trade.id, trigger)
      }}><td><button type="button" className="cst-trade-link" disabled={!onOpen || canOpen?.(trade.id) === false} aria-label={t('tradeDetails', { date: trade.exitDate })} onClick={event => onOpen?.(trade.id, event.currentTarget)}>{trade.exitDate}</button></td><td>{trade.exitReason}</td><td className="num">{trade.entryPrice ?? '—'}</td><td className="num">{trade.exitPrice ?? '—'}</td><td className="num">{trade.holding ?? '—'}</td><td className="num"><Value value={trade.pnl} /></td></tr>) : <tr>{Array.from({ length: 6 }, (_, index) => <td key={index}>—</td>)}</tr>}
    </tbody></table></div>}</>
}

export function NativeTerminalDashboard(props: NativeTerminalDashboardProps) {
  return <Dashboard key={JSON.stringify([props.scopeId, props.strategyId])} {...props} />
}
function Dashboard({ strategyId, strategyName, version, data, onOpenTrade, canOpenTrade, onOpenPosition, onOpenVersions }: NativeTerminalDashboardProps) {
  const t = useWords(), s = data?.summary, p = data?.performance
  return <div className="cst-dashboard" data-native-terminal-dashboard={strategyId}>
    {data?.sourceLabel && <p className="g-note">{data.sourceLabel}</p>}
    <Matrix entries={[
      { id: 'capital', label: t('capital'), value: <Value value={s?.capital} /> },
      { id: 'nav', label: s?.navLabel ?? t('nav'), value: <Value value={s?.nav} /> },
      { id: 'totalPnl', label: t('totalPnl'), value: <Pair first={s?.totalPnl} second={s?.totalPnlPercent} /> },
      { id: 'realized', label: t('realized'), value: <Pair first={s?.realized} second={s?.unrealized} separator=" / " /> },
      { id: 'feeCaption', label: s?.feeDescription ?? t('fee'), value: <Value value={s?.fees} /> },
    ]} />
    <section className="cst-nav"><h3>{t('navCurve')} {data?.equity?.rangeLabel && <small>{data.equity.rangeLabel}</small>}</h3><NavChart equity={data?.equity} /></section>
    <Matrix compact entries={[
      ...(['winRate', 'drawdown', 'profitFactor', 'sharpe', 'averageHolding', 'marketExposure', 'tradeCount'] as const).map(key => ({ id: key, label: t(key), value: <Value value={p?.[key]} /> })),
      { id: 'maxGainLoss', label: t('maxGainLoss'), value: <Pair first={p?.maxGain} second={p?.maxLoss} separator=" / " /> },
    ]} />
    <h3>{t('currentPosition')}</h3><Position position={data?.position} onOpen={onOpenPosition} />
    <h3>{t('recentTrades')} {data?.recentTrades != null && <small>{t('count', { count: String(Math.min(25, data.recentTrades.length)) })}</small>}</h3><RecentTrades strategyName={strategyName} trades={data?.recentTrades} onOpen={onOpenTrade} canOpen={canOpenTrade} />
    <button type="button" className="cst-versions" disabled={!onOpenVersions} onClick={event => onOpenVersions?.(event.currentTarget)}>{t('versionHistory', { version: version ?? '—' })}</button>
  </div>
}

export function NativeTerminalCompleted(props: NativeTerminalCompletedProps) {
  return <Completed key={JSON.stringify([props.scopeId, props.strategyId])} {...props} />
}
function Completed({ strategyId, data, onOpenTrade, canOpenTrade }: NativeTerminalCompletedProps) {
  const t = useWords(), trades = data?.trades?.slice(0, 12)
  return <div className="cst-completed" data-native-terminal-completed={strategyId}>
    <h3>{t('completed')} {data?.rangeLabel && <small>{data.rangeLabel}</small>}</h3>
    {data?.sourceLabel && <p className="g-note">{data.sourceLabel}</p>}
    {trades?.length === 0 ? <div className="cst-empty"><b>{t('noCompleted')}</b><p>{t('noCompletedHint')}</p></div> : (trades ?? [undefined]).map(trade => <article className="cst-completed-trade" key={trade?.id ?? 'unavailable'} data-trade-id={trade?.id}>
      <header><b>{trade?.side ?? '—'} · {trade?.symbol ?? '—'}</b><span><Pair first={trade?.pnl} second={trade?.pnlPercent} /></span></header>
      <Matrix compact entries={(['entry', 'exit', 'holding', 'fee'] as const).map((key, index) => ({ id: key, label: t(key), value: trade?.[(['entryPrice', 'exitPrice', 'holding', 'fee'] as const)[index]] ?? '—' }))} />
      <p><small>{t('whyEntered')}</small>{trade?.whyEntered ?? '—'}</p><p><small>{t('whyExited')}</small>{trade?.whyExited ?? '—'}</p>
      {(trade?.entryDate || trade?.exitDate) && <span className="cst-date">{trade?.entryDate ?? '—'} → {trade?.exitDate ?? '—'}</span>}
      <button type="button" className="cst-trade-details" disabled={!trade || !onOpenTrade || canOpenTrade?.(trade.id) === false} onClick={event => { if (trade) onOpenTrade?.(trade.id, event.currentTarget) }}>{t('fullDecision')}</button>
    </article>)}
    {trades == null && <p className="g-note" role="status">{t('unavailable')}</p>}
  </div>
}
