import { useEffect, useId, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi, ISeriesMarkersPluginApi, Time, SeriesMarker, MouseEventParams } from 'lightweight-charts'
import { commonDate, type commonPreviewResult } from '../client-common-backtest-preview'
import { useClientPreferences } from '../client-preferences'
import { commonBacktestText } from '../client-common-backtest-copy'

type Result = ReturnType<typeof commonPreviewResult>
type Chart = { chart: IChartApi; strategy: ISeriesApi<'Baseline'>; benchmark: ISeriesApi<'Line'>; markers: ISeriesMarkersPluginApi<Time>; count: number; ready: boolean }

/** One chart instance per result/language. Reveal existing points incrementally;
 * no price fetches, recomputation or chart construction on animation ticks. */
export default function ClientCommonBacktestChart({ result, count, ready, selectedDay, onSelect }: { result: Result; count: number; ready: boolean; selectedDay: number | null; onSelect: (index: number) => void }) {
  const { language } = useClientPreferences()
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<Chart | null>(null)
  const pin = useRef<SVGSVGElement>(null)
  const refreshPin = useRef<() => void>(() => {})
  // LWC can emit a non-pointer crosshair move after setCrosshairPosition.
  // Preserve keyboard intent synchronously until the user switches modality.
  const keyboardCursor = useRef<number | null>(null)
  const [inspected, setInspected] = useState<number | null>(null)
  const [keyboardDay, setKeyboardDay] = useState<number | null>(null)
  const hintId = useId()
  const interactive = !ready && count >= result.points.length
  const t = (key: Parameters<typeof commonBacktestText>[1]) => commonBacktestText(language, key)
  const [failure, setFailure] = useState(false)
  const [loaded, setLoaded] = useState(0)
  useEffect(() => {
    keyboardCursor.current = null
    const element = host.current
    if (!element) return
    let cancelled = false
    let dispose: (() => void) | undefined
    void import('lightweight-charts').then(({ createChart, ColorType, BaselineSeries, LineSeries, LineStyle, createSeriesMarkers }) => {
      if (cancelled) return
      const style = getComputedStyle(element)
      const chart = createChart(element, {
        width: element.clientWidth, height: 320,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9a9a9a', fontFamily: style.fontFamily, fontSize: 13 },
        grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,.045)' } },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: .12, bottom: .12 } },
        // This is a full-period overview, not a horizontally panned terminal.
        // Keep the same dates visible when its responsive container shrinks.
        timeScale: { borderVisible: false, minBarSpacing: .01, lockVisibleTimeRangeOnResize: true, shiftVisibleRangeOnNewBar: false },
        handleScroll: false, handleScale: false, localization: { locale: language },
      })
      dispose = () => chart.remove()
      // Source f43: compare each observation with initial capital, not the
      // last result or first visible point. LWC splits crossing segments.
      const strategy = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: result.evaluation.cap },
        topLineColor: '#2ebd85', bottomLineColor: '#f0566a',
        topFillColor1: 'rgba(46,189,133,.16)', topFillColor2: 'rgba(46,189,133,0)',
        bottomFillColor1: 'rgba(240,86,106,0)', bottomFillColor2: 'rgba(240,86,106,.16)',
        // Use pane-relative fill: a single point or flat segment has no price
        // span, making LWC 5.2.1's series-relative gradient divide by zero.
        relativeGradient: false, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      })
      strategy.createPriceLine({ price: result.evaluation.cap, color: 'rgba(255,255,255,.6)', lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false })
      const benchmark = chart.addSeries(LineSeries, { color: '#9a9a9a', lineStyle: LineStyle.Dotted, lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      const markers = createSeriesMarkers(strategy, [])
      const instance: Chart = { chart, strategy, benchmark, markers, count: 0, ready: false }
      api.current = instance
      let frame: number | undefined
      const resize = new ResizeObserver(() => {
        if (element.clientWidth > 0) {
          chart.applyOptions({ width: element.clientWidth })
          if (frame !== undefined) cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => {
            // applyOptions schedules LWC layout. Its timeScale width is still
            // zero until that paint, even when the DOM is already measurable.
            // Never compute the full-period padding from that stale width.
            if (instance.count > 0 && chart.timeScale().width() > 0) {
              const edge = result.points.length * 8 / chart.timeScale().width()
              chart.timeScale().setVisibleLogicalRange({ from: -edge, to: result.points.length - 1 + edge })
            }
            refreshPin.current()
          })
        }
      })
      resize.observe(element)
      dispose = () => { resize.disconnect(); if (frame !== undefined) cancelAnimationFrame(frame); markers.detach(); chart.remove(); if (api.current === instance) api.current = null }
      setLoaded(value => value + 1)
    }).catch(() => { dispose?.(); dispose = undefined; if (!cancelled) setFailure(true) })
    return () => { cancelled = true; dispose?.() }
  }, [result, language])
  useEffect(() => {
    const instance = api.current
    if (!instance) return
    const { points, evaluation } = result
    const size = ready ? 1 : Math.max(1, Math.min(points.length, count))
    const data = points.slice(0, size)
    if (instance.count > size || instance.ready !== ready || instance.count === 0) {
      instance.strategy.setData(data.map(point => ({ time: commonDate(point.i), value: point.value })))
      instance.benchmark.setData((ready ? points : data).map(point => ({ time: commonDate(point.i), value: point.benchmark })))
    } else {
      for (let i = instance.count; i < size; i++) {
        const point = points[i]
        instance.strategy.update({ time: commonDate(point.i), value: point.value })
        instance.benchmark.update({ time: commonDate(point.i), value: point.benchmark })
      }
    }
    const end = data.at(-1)!.i
    const marks: SeriesMarker<Time>[] = ready ? [] : evaluation.L.evs.filter(event => event.i <= end && (event.k === 'entry' || event.k.startsWith('exit'))).map(event => ({
      time: commonDate(event.i), position: event.k === 'entry' ? 'belowBar' : 'aboveBar', shape: event.k === 'entry' ? 'arrowUp' : 'arrowDown',
      color: '#cdcdcd', text: '',
    }))
    instance.markers.setMarkers(marks)
    // Direct revision runs mount without the ready screen's full benchmark.
    // New bars must reveal inside the same full-period domain, not scroll the
    // first days out of view. Establish it after data exists, also on late load.
    if (host.current?.clientWidth && instance.chart.timeScale().width() > 0) {
      const edge = points.length * 8 / instance.chart.timeScale().width()
      instance.chart.timeScale().setVisibleLogicalRange({ from: -edge, to: points.length - 1 + edge })
    }
    instance.count = size; instance.ready = ready
  }, [result, count, ready, loaded])
  useEffect(() => {
    const instance = api.current
    if (!instance || !interactive) return
    const index = (event: MouseEventParams) => {
      const logical = event.logical, position = event.point
      if (logical === undefined || !position || position.x < 0 || position.y < 0 || position.y >= 320 - instance.chart.timeScale().height()) return null
      const offset = Math.round(logical)
      return offset < 0 || offset >= result.points.length ? null : result.points[offset].i
    }
    // Keep the inspected day while moving from the plot to its action below.
    // The enclosing chart owns leave/blur, not the canvas crosshair callback.
    const hover = (event: MouseEventParams) => { const day = index(event); if (day !== null) setInspected(day) }
    const click = (event: MouseEventParams) => { const day = index(event); if (day !== null) onSelect(day) }
    instance.chart.subscribeCrosshairMove(hover); instance.chart.subscribeClick(click)
    return () => {
      if (api.current !== instance) return
      instance.chart.unsubscribeCrosshairMove(hover); instance.chart.unsubscribeClick(click)
    }
  }, [result, interactive, loaded, onSelect])
  useEffect(() => {
    const instance = api.current
    const draw = () => {
      const node = pin.current
      if (node) node.style.visibility = 'hidden'
      if (!instance || !node || !interactive || selectedDay === null) return
      const point = result.points.find(point => point.i === selectedDay)
      if (!point) return
      const x = instance.chart.timeScale().timeToCoordinate(commonDate(point.i))
      const y = instance.strategy.priceToCoordinate(point.value)
      if (x === null || y === null) return
      node.setAttribute('viewBox', `0 0 ${host.current?.clientWidth ?? 0} 320`)
      const line = node.querySelector('line')!, dot = node.querySelector('circle')!
      line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x)); line.setAttribute('y2', String(320 - instance.chart.timeScale().height()))
      dot.setAttribute('cx', String(x)); dot.setAttribute('cy', String(y))
      node.querySelector('text')?.setAttribute('x', String(Math.max(48, Math.min((host.current?.clientWidth ?? 96) - 48, x))))
      node.style.visibility = 'visible'
    }
    refreshPin.current = draw
    // Series updates and resize paint before pin coordinates are sampled.
    const frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); refreshPin.current = () => {} }
  }, [selectedDay, result, interactive, loaded])
  const shown = interactive ? result.points.find(point => point.i === (inspected ?? selectedDay)) : undefined
  const announced = interactive && keyboardDay !== null ? result.points.find(point => point.i === keyboardDay) : undefined
  const money = (value: number) => new Intl.NumberFormat(language, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
  return <div className="cbt-chart" data-point-count={ready ? 1 : count} data-selected-date={interactive && selectedDay !== null ? commonDate(selectedDay) : undefined}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { keyboardCursor.current = null; setInspected(null); setKeyboardDay(null); api.current?.chart.clearCrosshairPosition() } }}
    onPointerLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setInspected(null) }}>
    <div className="cbt-chart-plot" role="group" aria-label={t('chart')} aria-describedby={interactive ? hintId : undefined} tabIndex={interactive ? 0 : -1}
      onPointerMove={() => { keyboardCursor.current = null }} onPointerDown={() => { keyboardCursor.current = null }} onKeyDown={event => {
      if (!interactive || event.altKey || event.ctrlKey || event.metaKey) return
      const current = result.points.findIndex(point => point.i === (keyboardCursor.current ?? inspected ?? selectedDay))
      const offset = current < 0 ? result.points.length - 1 : current
      if (event.key === 'Enter') { event.preventDefault(); onSelect(result.points[offset].i); return }
      let next: number
      if (event.key === 'ArrowLeft') next = Math.max(0, offset - 1)
      else if (event.key === 'ArrowRight') next = Math.min(result.points.length - 1, offset + 1)
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = result.points.length - 1
      else if (event.key === 'Escape') { event.preventDefault(); keyboardCursor.current = null; setInspected(null); setKeyboardDay(null); api.current?.chart.clearCrosshairPosition(); return }
      else return
      event.preventDefault(); keyboardCursor.current = result.points[next].i; setKeyboardDay(result.points[next].i); setInspected(result.points[next].i)
      const instance = api.current
      // A hidden mobile chart can receive keys before LWC's first visible
      // paint establishes a price range. Its synthetic crosshair API throws
      // on that empty range. The textual date selection remains immediate.
      if (instance?.chart.timeScale().getVisibleRange() && instance.strategy.priceToCoordinate(result.points[next].value) !== null) {
        instance.chart.setCrosshairPosition(result.points[next].value, commonDate(result.points[next].i), instance.strategy)
      }
    }}>
      <div ref={host} />
      {interactive && selectedDay !== null && <svg ref={pin} className="cbt-chart-pin" style={{ visibility: 'hidden' }} aria-hidden="true"><line y1="22" /><circle r="4" /><text y="14" textAnchor="middle">{commonDate(selectedDay)}</text></svg>}
    </div>
    <span className="cbt-chart-sr" id={hintId}>{t('chartKeys')}</span>
    <span className="cbt-chart-sr" role="status">{announced ? `${commonDate(announced.i)} · ${t('chartBalance')} ${money(announced.value)} · ${t('benchmark')} ${money(announced.benchmark)}` : ''}</span>
    {shown && <div className="cbt-chart-readout"><time dateTime={commonDate(shown.i)}>{commonDate(shown.i)}</time><span>{t('chartBalance')} <b>{money(shown.value)}</b></span><span>{t('benchmark')} <b>{money(shown.benchmark)}</b></span><button type="button" onClick={() => onSelect(shown.i)}>{t('openDecision')}</button></div>}
    {failure && <p role="status">{commonBacktestText(language, 'chartError')}</p>}
  </div>
}
