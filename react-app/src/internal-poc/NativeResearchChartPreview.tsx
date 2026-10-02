import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { IChartApi, ISeriesApi, ISeriesMarkersPluginApi, MouseEventParams, Time, UTCTimestamp } from 'lightweight-charts'
import { useClientPreferences } from '../client-preferences'
import { marketChartText } from '../client-market-chart-copy'
import { researchChartCopy, type ResearchChartCopyKey } from './native-research-chart-copy'
import { RESEARCH_CHART_LIMITS, researchEquityState, researchPriceState, type NativeResearchChartPreviewProps, type ResearchEquityWindow, type ResearchPriceWindow } from './native-research-chart-presentation'
import '../client-restored-research.css'

type ChartLibrary = typeof import('lightweight-charts')
let chartLibrary: Promise<ChartLibrary> | undefined
// A rejected module URL cannot reliably be retried within this document. Keep
// the rejection cached too; only the explicit page reload offers recovery.
function loadChartLibrary() { return chartLibrary ??= import('lightweight-charts') }

function useWords() { const { language } = useClientPreferences(); return (key: ResearchChartCopyKey) => researchChartCopy(language, key) }
function utc(time: number) { return new Date(time * 1000).toISOString().replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC') }
function PagedTable({ headers, rows }: { headers: readonly ResearchChartCopyKey[]; rows: readonly { id: string; cells: readonly ReactNode[] }[] }) {
  const t = useWords(), [page, setPage] = useState(0)
  const count = Math.max(1, Math.ceil(rows.length / RESEARCH_CHART_LIMITS.tablePage)), current = Math.min(page, count - 1)
  return <><div className="rw-table-scroll" tabIndex={0} role="region" aria-label={t('dataTable')}><table className="g-table"><thead><tr>{headers.map(key => <th key={key} scope="col">{t(key)}</th>)}</tr></thead><tbody>{rows.slice(current * RESEARCH_CHART_LIMITS.tablePage, (current + 1) * RESEARCH_CHART_LIMITS.tablePage).map(row => <tr key={row.id}>{row.cells.map((cell, index) => <td className="num" style={{ whiteSpace: 'nowrap' }} key={index}>{cell}</td>)}</tr>)}</tbody></table></div>
    {count > 1 && <div className="rw-actions rw-compact"><button type="button" className="g-btn g-btn-t" disabled={current === 0} onClick={() => setPage(current - 1)}>{t('previous')}</button><span className="g-note">{current + 1} / {count}</span><button type="button" className="g-btn g-btn-t" disabled={current + 1 === count} onClick={() => setPage(current + 1)}>{t('next')}</button></div>}</>
}

type SurfaceProps = { active: boolean; onOpenAnalysis?: () => void } & ({ kind: 'prices'; data: ResearchPriceWindow } | { kind: 'equity'; data: ResearchEquityWindow })
type APIs = { chart: IChartApi; series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>; markers?: ISeriesMarkersPluginApi<Time>; fit?: () => void }
function Surface(props: SurfaceProps) {
  const { language } = useClientPreferences(), t = useWords(), id = useId()
  const container = useRef<HTMLDivElement>(null), holdoutOverlay = useRef<HTMLDivElement>(null), tradeOverlay = useRef<HTMLCanvasElement>(null), api = useRef<APIs | null>(null), renderedData = useRef<SurfaceProps['data'] | null>(null)
  const [failure, setFailure] = useState(false), [selected, setSelected] = useState<{ data: SurfaceProps['data']; index: number } | null>(null)
  const [hasActivated, setHasActivated] = useState(props.active)
  const [library, setLibrary] = useState<ChartLibrary | null>(null), [loadError, setLoadError] = useState(false)
  const current = useRef(props), locale = useRef(language)
  useEffect(() => { current.current = props; locale.current = language }, [props, language])
  useEffect(() => {
    if (!props.active || library || loadError) return
    let cancelled = false
    void loadChartLibrary().then(value => { if (!cancelled) setLibrary(value) }, () => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [props.active, library, loadError])
  const points = props.kind === 'prices' ? props.data.bars : props.data.points
  const selectionIndex = selected?.data === props.data ? selected.index : -1
  const selectedPoint = points[selectionIndex]
  const choose = useCallback((index: number) => {
    const snapshot = current.current
    if (!snapshot.active) return
    const observations = snapshot.kind === 'prices' ? snapshot.data.bars : snapshot.data.points
    const point = observations[index]
    if (!point) return
    setSelected({ data: snapshot.data, index })
    const value = 'close' in point ? point.close : point.value
    if (api.current) api.current.chart.setCrosshairPosition(value, point.time as UTCTimestamp, api.current.series)
  }, [])

  useEffect(() => {
    const element = container.current
    if (!props.active || !element || !library) return
    const { CandlestickSeries, ColorType, CrosshairMode, LineSeries, createChart, createSeriesMarkers } = library
    let resizeFrame = 0, disposed = false, overlayFailed = false
    let observer: ResizeObserver | undefined
    let creatingChart: IChartApi | undefined
    const source = props.data
    try {
      if (!api.current) {
        const style = getComputedStyle(element)
        const chart = createChart(element, {
          width: Math.max(1, element.clientWidth), height: props.kind === 'prices' ? 280 : 150, autoSize: false,
          layout: { background: { type: ColorType.Solid, color: '#0f1012' }, textColor: '#9aa0a6', fontFamily: style.fontFamily, fontSize: 11, attributionLogo: true },
          grid: { vertLines: { color: 'rgba(255,255,255,.035)' }, horzLines: { color: 'rgba(255,255,255,.055)' } },
          crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: 'rgba(255,255,255,.07)', minimumWidth: 56 },
          timeScale: { borderColor: 'rgba(255,255,255,.07)', timeVisible: true, secondsVisible: true, minBarSpacing: .1, lockVisibleTimeRangeOnResize: true },
          handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
          localization: { locale: locale.current, timeFormatter: (time: Time) => utc(Number(time)) },
        })
        creatingChart = chart
        const series = props.kind === 'prices'
          ? chart.addSeries(CandlestickSeries, { upColor: '#4ec08d', downColor: '#e0604b', borderVisible: false, wickUpColor: '#4ec08d', wickDownColor: '#e0604b', priceLineVisible: false })
          : chart.addSeries(LineSeries, { color: '#5b8af7', lineWidth: 2, priceLineVisible: false, crosshairMarkerVisible: true })
        api.current = { chart, series }
        series.priceScale().applyOptions({ scaleMargins: { top: .15, bottom: props.kind === 'prices' ? .22 : .12 } })
        if (props.kind === 'prices') api.current.markers = createSeriesMarkers(series, [], { zOrder: 'top', autoScale: true })
      }
      const { chart, series, markers } = api.current
      chart.applyOptions({ localization: { locale: locale.current } })
      if (renderedData.current !== source && props.kind === 'prices') {
        const precision = props.data.pricePrecision
        series.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
        ;(series as ISeriesApi<'Candlestick'>).setData(props.data.bars.map(bar => ({ ...bar, time: bar.time as UTCTimestamp })))
        // Sorting display markers is not an execution reorder; the accessible table
        // retains the producer's original order and exact execution timestamps.
        const pairedColors = new Map<string, string>()
        for (const interval of props.data.tradeIntervals ?? []) {
          pairedColors.set(interval.entryFillId, '#4ec08d')
          // Source parity: flat uses the non-positive exit color, but its
          // supplied textual outcome remains intact in the accessible table.
          pairedColors.set(interval.exitFillId, interval.outcome === 'gain' ? '#4ec08d' : '#e0604b')
        }
        markers?.setMarkers([...(props.data.fills ?? [])].sort((a, b) => a.barTime - b.barTime || a.time - b.time).map(fill => ({
          id: fill.id, time: fill.barTime as UTCTimestamp, price: fill.price,
          position: fill.side === 'BUY' ? 'atPriceBottom' : 'atPriceTop', shape: fill.side === 'BUY' ? 'arrowUp' : 'arrowDown',
          color: pairedColors.get(fill.id) ?? (fill.side === 'BUY' ? '#4ec08d' : '#e0604b'), text: fill.label ?? fill.side,
        })))
      } else if (renderedData.current !== source && props.kind === 'equity') {
        const precision = props.data.valuePrecision
        series.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } })
        ;(series as ISeriesApi<'Line'>).setData(props.data.points.map(point => ({ time: point.time as UTCTimestamp, value: point.value })))
      }
      const observationsCount = props.kind === 'prices' ? props.data.bars.length : props.data.points.length
      api.current.fit = () => {
        const padding = Math.max(2, observationsCount * 38 / Math.max(100, element.clientWidth - 90))
        chart.timeScale().setVisibleLogicalRange({ from: -padding, to: observationsCount - 1 + padding })
      }
      if (renderedData.current !== source) { api.current.fit(); renderedData.current = source }
      const fillById = new Map(props.kind === 'prices' ? props.data.fills?.map(fill => [fill.id, fill]) : [])
      const renderOverlays = () => {
        if (disposed || !current.current.active) return
        // One bounded canvas, not one DOM element per trade. No animation loop
        // or financial calculations: only supplied bar-time coordinate mapping.
        const canvas = tradeOverlay.current
        if (canvas && props.kind === 'prices' && !overlayFailed) try {
          const width = chart.timeScale().width(), height = 280 - chart.timeScale().height(), ratio = Math.min(2, window.devicePixelRatio || 1)
          const pixelWidth = Math.ceil(width * ratio), pixelHeight = Math.ceil(height * ratio)
          if (canvas.width !== pixelWidth) canvas.width = pixelWidth
          if (canvas.height !== pixelHeight) canvas.height = pixelHeight
          canvas.style.width = `${width}px`; canvas.style.height = `${height}px`
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas unavailable')
          context.setTransform(ratio, 0, 0, ratio, 0, 0)
          context.clearRect(0, 0, width, height)
          for (const interval of props.data.tradeIntervals ?? []) {
            const entry = fillById.get(interval.entryFillId), exit = fillById.get(interval.exitFillId)
            if (!entry || !exit) continue
            const from = chart.timeScale().timeToCoordinate(entry.barTime as UTCTimestamp), to = chart.timeScale().timeToCoordinate(exit.barTime as UTCTimestamp)
            if (from === null || to === null || to < 0 || from > width) continue
            const left = Math.max(0, from), right = Math.min(width, Math.max(from + 2, to))
            context.fillStyle = interval.outcome === 'gain' ? 'oklch(74% .12 155 / .08)' : 'oklch(68% .16 27 / .08)'
            context.fillRect(left, 0, Math.max(0, right - left), height)
          }
        } catch {
          // Range/resize callbacks run outside the setup try/catch. Preserve the
          // supplied table and contain a lost overlay context without raw errors.
          overlayFailed = true; canvas.hidden = true
          queueMicrotask(() => { if (!disposed) setFailure(true) })
        }
        const node = holdoutOverlay.current
        const holdout = props.kind === 'prices' ? props.data.holdout : undefined
        if (!node || !holdout) return
        const from = chart.timeScale().timeToCoordinate(holdout.fromBarTime as UTCTimestamp), to = chart.timeScale().timeToCoordinate(holdout.toBarTime as UTCTimestamp)
        if (from === null || to === null) { node.hidden = true; return }
        const width = chart.timeScale().width(), left = Math.max(0, Math.min(from, to)), right = Math.min(width, Math.max(from, to))
        node.hidden = right < left
        node.style.left = `${left}px`; node.style.width = `${Math.max(1, right - left)}px`
      }
      const crosshair = (event: MouseEventParams) => {
        if (disposed || !current.current.active || current.current.data !== source || typeof event.time !== 'number') return
        const observations = props.kind === 'prices' ? props.data.bars : props.data.points
        const index = observations.findIndex(point => point.time === event.time)
        if (index >= 0) setSelected(previous => previous?.data === source && previous.index === index ? previous : { data: source, index })
      }
      const resize = () => {
        if (disposed || resizeFrame) return
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0
          if (disposed || !current.current.active || element.clientWidth <= 0) return
          chart.resize(element.clientWidth, props.kind === 'prices' ? 280 : 150)
          renderOverlays()
        })
      }
      chart.subscribeCrosshairMove(crosshair); chart.timeScale().subscribeVisibleLogicalRangeChange(renderOverlays)
      observer = new ResizeObserver(resize); observer.observe(element)
      renderOverlays(); resize(); queueMicrotask(() => { if (!disposed) { setFailure(overlayFailed); setHasActivated(true) } })
      return () => {
        disposed = true; observer?.disconnect(); cancelAnimationFrame(resizeFrame)
        chart.unsubscribeCrosshairMove(crosshair); chart.timeScale().unsubscribeVisibleLogicalRangeChange(renderOverlays)
      }
    } catch {
      disposed = true; observer?.disconnect(); cancelAnimationFrame(resizeFrame)
      api.current?.markers?.detach(); (api.current?.chart ?? creatingChart)?.remove(); api.current = null; renderedData.current = null
      // This node is exclusively owned by the chart library, so a constructor
      // failure before createChart returns cannot leave a partial canvas behind.
      element.replaceChildren()
      let cancelled = false
      queueMicrotask(() => { if (!cancelled) setFailure(true) })
      return () => { cancelled = true }
    }
  }, [props.active, props.data, props.kind, library])
  useEffect(() => { if (props.active) api.current?.chart.applyOptions({ localization: { locale: language } }) }, [language, props.active])
  useEffect(() => () => { api.current?.markers?.detach(); api.current?.chart.remove(); api.current = null; renderedData.current = null }, [])

  const inspection = selectedPoint ? <><span>{utc(selectedPoint.time)}</span>{'open' in selectedPoint
    ? <span> O {selectedPoint.open} · H {selectedPoint.high} · L {selectedPoint.low} · C {selectedPoint.close}</span>
    : <span> · {selectedPoint.valueLabel ?? `${String(selectedPoint.value)}${props.data.currency ? ` ${props.data.currency}` : ''}`}</span>}</> : <span>—</span>
  const rows = useMemo(() => props.kind === 'prices' ? props.data.bars.map(bar => ({ id: String(bar.time), cells: [utc(bar.time), String(bar.open), String(bar.high), String(bar.low), String(bar.close)] }))
    : props.data.points.map(point => ({ id: String(point.time), cells: [utc(point.time), point.valueLabel ?? String(point.value)] })), [props.data, props.kind])
  const fills = props.kind === 'prices' ? props.data.fills : undefined
  const intervals = props.kind === 'prices' ? props.data.tradeIntervals : undefined
  const intervalRows = useMemo(() => {
    const byId = new Map(fills?.map(fill => [fill.id, fill]))
    return intervals?.map(interval => ({ id: interval.id, cells: [utc(byId.get(interval.entryFillId)!.time), utc(byId.get(interval.exitFillId)!.time), interval.label] })) ?? []
  }, [fills, intervals])
  return <>
    <p className="g-note" style={{ display: 'block', marginBottom: 6, overflowWrap: 'anywhere' }}>{props.data.sourceLabel} · {props.data.rangeLabel}{props.data.currency ? ` · ${props.data.currency}` : ''}</p>
    <div role="group" aria-label={t(props.kind)} aria-describedby={`${id}-instructions`}>
      <p id={`${id}-instructions`} className="g-note">{t('inspect')}</p>
      <div data-research-chart={props.kind} data-active={props.active} data-count={points.length}
        role={library ? 'img' : 'group'} aria-label={`${t(props.kind)} · ${props.data.sourceLabel} · ${props.data.rangeLabel}`} tabIndex={0}
        style={{ height: props.kind === 'prices' ? 280 : 150, position: 'relative', minWidth: 0, overflow: 'hidden' }}
        onFocus={() => { if (selectionIndex < 0) choose(0) }} onKeyDown={event => {
          if (!props.active || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          choose(event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, Math.max(0, selectionIndex) + (event.key === 'ArrowRight' ? 1 : -1))))
        }}>
        <div ref={container} data-chart-mount={props.kind} style={{ width: '100%', height: '100%' }} />
        {!library && <div data-research-chart-load={loadError ? 'failed' : 'loading'} aria-busy={!loadError} style={{ position: 'absolute', inset: 0, display: 'grid', alignContent: 'center', padding: 16 }}>
          <p className="g-note" role={loadError ? 'alert' : 'status'}>{marketChartText(language, loadError ? 'rendererFailed' : 'rendererLoading')}</p>
          {loadError && <button type="button" className="g-btn g-btn-t" onClick={() => window.location.reload()}>{marketChartText(language, 'rendererReload')}</button>}
        </div>}
        {!!intervals?.length && (props.active || hasActivated) && <canvas ref={tradeOverlay} hidden={failure} data-trade-interval-overlay aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 1 }} />}
        {props.kind === 'prices' && props.data.holdout && <div ref={holdoutOverlay} aria-hidden="true" data-holdout-overlay style={{ position: 'absolute', top: 0, bottom: 28, pointerEvents: 'none', zIndex: 2, background: 'rgba(91,138,247,.065)', borderInline: '1px dashed rgba(91,138,247,.35)' }} />}
      </div>
      {props.kind === 'prices' && props.data.holdout && <p className="g-note">{props.data.holdout.label} · {utc(props.data.holdout.fromBarTime)} → {utc(props.data.holdout.toBarTime)}</p>}
      <div className="g-note" aria-live="polite" aria-atomic="true" data-chart-inspection={props.kind} style={{ minHeight: 36, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{inspection}</div>
    </div>
    {failure && <p className="rw-input-error" role="alert">{t('failed')}</p>}
    <div className="rw-actions rw-compact"><button type="button" className="g-btn g-btn-t" disabled={!props.active || !library || failure} onClick={() => api.current?.fit?.()}>{t('fit')}</button><button type="button" className="g-btn g-btn-t" disabled={!selectedPoint} onClick={() => { setSelected(null); api.current?.chart.clearCrosshairPosition() }}>{t('reset')}</button>{props.kind === 'prices' && <button type="button" className="g-btn g-btn-t" disabled={!props.onOpenAnalysis} onClick={props.onOpenAnalysis}>{t('openAnalysis')}</button>}</div>
    <details><summary className="g-note" style={{ cursor: 'pointer', minHeight: 36, paddingBlock: 8 }}>{t('dataTable')} · {points.length}</summary><PagedTable key={props.data.rangeLabel} headers={props.kind === 'prices' ? ['time', 'open', 'high', 'low', 'close'] : ['time', 'value']} rows={rows} /></details>
    {props.kind === 'prices' && fills !== undefined && <details><summary className="g-note" style={{ cursor: 'pointer', minHeight: 36, paddingBlock: 8 }}>{t('fills')} · {fills.length}</summary><PagedTable headers={['time', 'side', 'price', 'quantity']} rows={fills.map(fill => ({ id: fill.id, cells: [utc(fill.time), fill.side, String(fill.price), fill.quantity ?? '—'] }))} /></details>}
    {intervals !== undefined && <details data-trade-interval-table><summary className="g-note" style={{ cursor: 'pointer', minHeight: 36, paddingBlock: 8 }}>{t('tradeIntervals')} · {intervals.length}</summary><PagedTable headers={['entry', 'exit', 'outcome']} rows={intervalRows} /></details>}
  </>
}

export function NativeResearchChartPreview(props: NativeResearchChartPreviewProps) {
  return <PreviewScope key={JSON.stringify([props.scopeId, props.versionIdentity])} {...props} />
}
function PreviewScope({ versionIdentity, active, prices, equity, onOpenAnalysis }: NativeResearchChartPreviewProps) {
  const t = useWords()
  const priceState = useMemo(() => researchPriceState(prices, versionIdentity), [prices, versionIdentity])
  const equityState = useMemo(() => researchEquityState(equity, versionIdentity), [equity, versionIdentity])
  return <div data-native-research-charts={versionIdentity} hidden={!active}>
    <section className="g-chartbox" data-chart-state={priceState}><div className="g-note">{t('prices')}</div>
      {priceState === 'ready' && prices ? <Surface kind="prices" data={prices} active={active} onOpenAnalysis={onOpenAnalysis} /> : <><div style={{ minHeight: 280, display: 'grid', alignContent: 'center' }}><p className="g-note" role="status">{t(priceState)}</p>{priceState === 'oversized' && <p className="g-note">{t('limit')} · OHLC {RESEARCH_CHART_LIMITS.bars} / BUY·SELL {RESEARCH_CHART_LIMITS.fills}</p>}</div><button type="button" className="g-btn g-btn-t" disabled={!onOpenAnalysis} onClick={onOpenAnalysis}>{t('openAnalysis')}</button></>}
    </section>
    <section className="g-chartbox" data-chart-state={equityState}><div className="g-note">{equityState === 'ready' ? equity?.label ?? t('equity') : t('equity')}</div>
      {equityState === 'ready' && equity ? <Surface kind="equity" data={equity} active={active} /> : <div style={{ minHeight: 110, display: 'grid', alignContent: 'center' }}><p className="g-note" role="status">{t(equityState)}</p>{equityState === 'oversized' && <p className="g-note">{t('limit')} · {RESEARCH_CHART_LIMITS.equity}</p>}</div>}
    </section>
  </div>
}
