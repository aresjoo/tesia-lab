import { memo, useId, useMemo, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { useClientPreferences } from '../client-preferences'
import { marketSourceHref } from '../client-market-response-presentation'
import { clientCoinIcon } from '../client-coin-icon'
import { marketPickerIcon, validMarketPickerRows } from '../client-market-picker'
import { coinFields, marketPeriods, metricKinds, quoteFields, ruleFields, validMarketMetric, type MarketPeriod, type MarketResource, type TerminalMarketMetric, type TerminalMarketPresentation } from '../client-terminal-market'
import { terminalMarketText } from '../client-terminal-market-copy'
import { ClientMarketPicker } from './ClientMarketPicker'
import '../client-terminal-market.css'

function ResourceState({ state }: { state?: 'loading' | 'error' | 'unavailable' }) {
  const { language } = useClientPreferences()
  return <p className="ctm-state" role="status">{terminalMarketText(language, state ?? 'unavailable')}</p>
}
function Provenance({ resource }: { resource: MarketResource<unknown> }) {
  return resource.state === 'ready' ? <p className="ctm-source">{resource.source} · {resource.observedAt}</p> : null
}

/** No polling, clock, price fallback, symbol substitution, or execution side effects. */
export function ClientTerminalMarketHeader({ symbol, market, presentation, menuHostRef, tools }: { symbol?: string; market?: string; presentation?: TerminalMarketPresentation; menuHostRef?: Ref<HTMLDivElement>; tools?: ReactNode }) {
  const { language } = useClientPreferences(), q = presentation?.quote
  const value = q?.state === 'ready' ? q.value : undefined
  const picker = presentation?.picker, rows = picker?.rows, selectedId = picker?.selectedId
  const selectedIcon = useMemo(() => {
    if (rows?.state !== 'ready' || !validMarketPickerRows(rows.value)) return undefined
    const row = rows.value.find(item => item.id === selectedId && item.symbol === symbol)
    return row ? marketPickerIcon(row.icon ?? clientCoinIcon(row.symbol) ?? undefined) : undefined
  }, [rows, selectedId, symbol])
  // The same supplied selection owns both icons. A stale or invalid catalogue
  // must not borrow another instrument's icon, and no third-party CDN is used.
  const icon = selectedIcon ?? (!picker ? symbol === 'BTC/USDT' ? '/client-template-assets/btc.svg' : symbol === 'ETH/USDT' ? '/client-template-assets/eth.svg' : undefined : undefined)
  const symbolLabel = <>{symbol && <span className="ctm-symbol-icon" aria-hidden="true">{symbol.charAt(0)}{icon && <img key={`${symbol}-${icon}`} src={icon} width="26" height="26" alt="" onError={event => { event.currentTarget.hidden = true }} />}</span>}<b>{symbol ?? '—'}</b>{market && <span>{market}</span>}</>
  return <section data-integrated-menu={menuHostRef != null} className="ctm-header" aria-label={terminalMarketText(language, 'market')}>
    <div className="ctm-quote-row">
      {menuHostRef && <div className="ctm-navigation" ref={menuHostRef} />}
      {presentation?.picker ? <ClientMarketPicker key={presentation.picker.identity} presentation={presentation.picker} symbol={symbol}>{symbolLabel}</ClientMarketPicker> : <div className="ctm-symbol">{symbolLabel}</div>}
      <div className={`ctm-price ${value?.tone ?? ''}`}><b>{value?.price ?? '—'}</b><span>{value?.change}</span></div>
      <div className="ctm-quote-scroll" tabIndex={0}><dl>{quoteFields.map(key => <div key={key}><dt>{terminalMarketText(language, key)}</dt><dd>{value?.values[key] ?? '—'}</dd></div>)}</dl></div>
    </div>
    {tools && <div className="ctm-tools">{tools}</div>}
    {q?.state === 'ready' ? <Provenance resource={q} /> : <ResourceState state={q?.state} />}
  </section>
}

function MarketInfo({ resource }: { resource?: TerminalMarketPresentation['info'] }) {
  const { language } = useClientPreferences()
  if (!resource || resource.state !== 'ready') return <ResourceState state={resource?.state} />
  const { value } = resource
  const rows = (keys: readonly (typeof coinFields[number] | typeof ruleFields[number])[]) => <dl className="ctm-info-rows">{keys.map(key => <div key={key}><dt>{terminalMarketText(language, key)}</dt><dd>{value.values[key] ?? '—'}</dd></div>)}</dl>
  const links = value.links.flatMap(link => { const href = marketSourceHref(link.url); return href ? [{ ...link, href }] : [] })
  return <div className="ctm-info"><h3>{value.name}</h3><div className="ctm-info-grid"><div>{rows(coinFields)}</div><div>
    {links.length > 0 && <><h4>{terminalMarketText(language, 'links')}</h4><div className="ctm-links">{links.map((link, index) => <a key={`${link.href}-${index}`} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<span aria-hidden="true">↗</span></a>)}</div></>}
    <h4>{terminalMarketText(language, 'rules')}</h4>{rows(ruleFields)}
  </div></div><Provenance resource={resource} /></div>
}

const lineColors = ['#ececec', '#aaa', '#777'], barColors = ['#595959', '#929292', '#b8b8b8']
const Metric = memo(function Metric({ metric }: { metric: TerminalMarketMetric }) {
  const { language } = useClientPreferences()
  const [showValues, setShowValues] = useState(false)
  const number = new Intl.NumberFormat(language, { maximumSignificantDigits: 15 })
  if (!validMarketMetric(metric)) return <ResourceState state="error" />
  const { points, series } = metric
  // Normalize before subtraction to avoid overflow for large finite inputs.
  const domains = (['left', 'right'] as const).map(axis => {
    const rows = series.filter(row => row.axis === axis), values = rows.flatMap(row => row.values.filter((v): v is number => v !== null))
    if (!values.length) return null
    const scale = Math.max(...values.map(Math.abs)) || 1
    const normalized = values.map(v => v / scale)
    let min = Math.min(...normalized), max = Math.max(...normalized)
    if (rows.some(row => row.kind === 'bar')) { min = Math.min(min, 0); max = Math.max(max, 0) }
    if (min === max) { min -= .05; max += .05 }
    return { axis, scale, min, max, unit: rows[0].unit }
  }).filter(value => value !== null)
  if (domains.some(domain => series.some(row => row.axis === domain.axis && row.unit !== domain.unit))) return <ResourceState state="error" />
  if (domains.some(d => !Number.isFinite(d.min * d.scale) || !Number.isFinite(d.max * d.scale))) return <ResourceState state="error" />
  const start = points[0].time, end = points.at(-1)!.time, duration = end - start
  if (!Number.isFinite(duration)) return <ResourceState state="error" />
  const x = (i: number) => points.length === 1 ? 260 : 12 + (points[i].time - start) / duration * 496
  const y = (v: number, axis: 'left' | 'right') => { const d = domains.find(item => item.axis === axis)!; return 155 - (v / d.scale - d.min) / (d.max - d.min) * 135 }
  const bars = series.filter(row => row.kind === 'bar'), barWidth = Math.min(14, 400 / points.length / Math.max(1, bars.length))
  return <>
    <div className="ctm-scale">{domains.map(d => <span key={d.axis}>{number.format(d.min * d.scale)} ~ {number.format(d.max * d.scale)} {d.unit}</span>)}</div>
    <svg className="ctm-metric-svg" viewBox="0 0 520 165" role="img" aria-label={terminalMarketText(language, metric.kind)}>
      {[20, 65, 110, 155].map(height => <line key={height} x1="12" x2="508" y1={height} y2={height} stroke="rgba(255,255,255,.08)" />)}
      {series.map((row, index) => {
        const color = (row.kind === 'bar' ? barColors : lineColors)[index]
        if (row.kind === 'bar') return <g key={index}>{row.values.map((v, i) => v === null ? null : <rect key={i} x={x(i) - bars.length * barWidth / 2 + bars.indexOf(row) * barWidth} y={Math.min(y(v, row.axis), y(0, row.axis))} width={barWidth * .9} height={Math.max(.5, Math.abs(y(v, row.axis) - y(0, row.axis)))} fill={color} />)}</g>
        let path = '', open = false
        row.values.forEach((v, i) => { if (v === null) { open = false; return }; path += `${open ? 'L' : 'M'}${x(i)},${y(v, row.axis)} `; open = true })
        return <g key={index}><path d={path} stroke={color} strokeWidth="1.6" fill="none" />{row.values.map((v, i) => v !== null && (points.length === 1 || (i === 0 || row.values[i - 1] === null) && (i === points.length - 1 || row.values[i + 1] === null)) ? <circle key={i} cx={x(i)} cy={y(v, row.axis)} r="2" fill={color} /> : null)}</g>
      })}
    </svg>
    <div className="ctm-time-range"><span>{points[0].label}</span><span>{points.length > 1 ? points.at(-1)!.label : ''}</span></div>
    <div className="ctm-legend">{series.map((row, index) => <span key={index}><i style={{ background: (row.kind === 'bar' ? barColors : lineColors)[index] }} />{row.label} {row.unit && `(${row.unit})`}</span>)}</div>
    <details className="ctm-values" onToggle={event => setShowValues(event.currentTarget.open)}><summary>{terminalMarketText(language, 'values')}</summary>{showValues && <div className="ctm-value-scroll" tabIndex={0}><table><caption>{terminalMarketText(language, metric.kind)}</caption><thead><tr><th scope="col">{terminalMarketText(language, 'time')}</th>{series.map((row, i) => <th scope="col" key={i}>{row.label} ({row.unit})</th>)}</tr></thead><tbody>{points.map((point, i) => <tr key={point.time}><th scope="row">{point.label}</th>{series.map((row, j) => <td key={j}>{row.values[i] === null ? '—' : number.format(row.values[i]!)}</td>)}</tr>)}</tbody></table></div>}</details>
  </>
})

const tabs = ['chart', 'info', 'data'] as const
export function ClientTerminalMarketPanels({ presentation, children }: { presentation?: TerminalMarketPresentation; children: ReactNode }) {
  const { language } = useClientPreferences(), id = useId()
  const [tab, setTab] = useState<typeof tabs[number]>('chart'), [period, setPeriod] = useState<MarketPeriod>('5m')
  const [dataVisited, setDataVisited] = useState(false)
  const selectTab = (next: typeof tabs[number]) => { if (next === 'data') setDataVisited(true); setTab(next) }
  const resource = presentation?.data?.[period]
  const data = resource?.state === 'ready' ? resource.value : undefined
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : -1
    if (next < 0) return
    event.preventDefault(); selectTab(tabs[next]); document.getElementById(`${id}-${tabs[next]}-tab`)?.focus()
  }
  return <div className="ctm-panels">
    <div className="ctm-tabs" role="tablist" aria-label={terminalMarketText(language, 'market')}>{tabs.map((key, index) => <button type="button" role="tab" id={`${id}-${key}-tab`} key={key} aria-selected={tab === key} aria-controls={`${id}-${key}-panel`} tabIndex={tab === key ? 0 : -1} onClick={() => selectTab(key)} onKeyDown={event => move(event, index)}>{terminalMarketText(language, key)}</button>)}</div>
    <section id={`${id}-chart-panel`} role="tabpanel" aria-labelledby={`${id}-chart-tab`} tabIndex={0} hidden={tab !== 'chart'} inert={tab !== 'chart'}>{children}</section>
    <section id={`${id}-info-panel`} className="ctm-pane" role="tabpanel" aria-labelledby={`${id}-info-tab`} hidden={tab !== 'info'} tabIndex={0}><MarketInfo resource={presentation?.info} /></section>
    <section id={`${id}-data-panel`} className="ctm-pane" role="tabpanel" aria-labelledby={`${id}-data-tab`} hidden={tab !== 'data'} tabIndex={0}>
      <div className="ctm-periods" role="group" aria-label={terminalMarketText(language, 'period')}>{marketPeriods.map(key => <button type="button" key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}>{new Intl.NumberFormat(language, { style: 'unit', unit: key.endsWith('m') ? 'minute' : key.endsWith('h') ? 'hour' : 'day', unitDisplay: 'short' }).format(parseInt(key))}</button>)}</div>
      {resource?.state === 'ready' && <Provenance resource={resource} />}
      <div className="ctm-data-grid">{dataVisited && metricKinds.map(kind => {
        const matches = data?.filter(item => item.kind === kind)
        return <section className="ctm-data-card" key={`${presentation?.binding.id}-${period}-${kind}`}><h4>{terminalMarketText(language, kind)}</h4>{matches?.length === 1 ? <Metric metric={matches[0]} /> : <ResourceState state={matches && matches.length > 1 ? 'error' : resource?.state === 'ready' ? 'unavailable' : resource?.state} />}</section>
      })}</div>
    </section>
  </div>
}
