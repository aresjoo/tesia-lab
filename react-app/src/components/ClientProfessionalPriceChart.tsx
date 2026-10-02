import { memo, useEffect, useLayoutEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, PriceScaleMode, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type MouseEventParams, type SeriesMarker, type Time, type UTCTimestamp } from 'lightweight-charts'
import { Camera, Maximize2 } from 'lucide-react'
import { chartEma, containingBar, equalPriceViews, priceChartIssue, priceMarkerGroups, visiblePriceMarkers, type PriceChartView, type PriceFill } from '../chart/price-chart-view'
import { useClientPreferences } from '../client-preferences'
import { professionalChartLocale } from '../client-professional-chart-locale'
import { chartMovingAverages, movingAveragePeriods, chartWindowVwap, priceChartStudies, studyLineData, type MovingAverageKey, type StudyPoint } from '../chart/price-chart-studies'
import { EXECUTION_DWELL_MS, PRICE_REPLAY_DURATION_MS, PRICE_REVEAL_DURATION_MS, priceExecutionTimeline } from '../chart/price-execution-timeline'
import { priceReplaySlice, type ProfessionalExternalReplay } from '../chart/price-replay-frame'
import { PriceDrawings } from '../chart/price-drawings'
import { ClientPriceDrawingTools, ClientPriceDrawingDetails } from './ClientPriceDrawingTools'
import '../client-professional-chart.css'

export type ProfessionalChartControl = { play(): boolean; skip(): void; selectFill(id: string): void }
export type ProfessionalReplayEnd = 'complete' | 'skip' | 'reduced'
export type ProfessionalRendererState = 'unavailable' | 'ready' | 'error'
type Props = { view: PriceChartView | null; continuityKey?: string; variant?: 'analysis' | 'market'; onFillSelect?: (fill: PriceFill) => void; autoReplay?: boolean; onReplayChange?: (playing: boolean, reason?: ProfessionalReplayEnd) => void; onRendererStateChange?: (state: ProfessionalRendererState) => void; controlRef?: Ref<ProfessionalChartControl>; showBarFills?: boolean; externalSkip?: boolean; externalReplay?: ProfessionalExternalReplay }
type Indicators = Record<MovingAverageKey, boolean> & { ema20: boolean; ema50: boolean; bb: boolean; vwap: boolean; rsi: boolean; volume: boolean }

// Extracted from the preserved ProfessionalPriceChart: panes, crosshair,
// price scales, EMA, screenshot and keyboard inspection. No fetch, fixture
// generator, job lifecycle, or trading permission exists in this renderer.
export const ClientProfessionalPriceChart = memo(function ClientProfessionalPriceChart({ view, continuityKey, ...props }: Props) {
  const { language } = useClientPreferences()
  const format = professionalChartLocale(language)
  const [snapshot, setSnapshot] = useState(view)
  const unchanged = equalPriceViews(snapshot, view)
  if (!unchanged) setSnapshot(view)
  const stableView = unchanged ? snapshot : view
  // The caller owns the bound series/job lifetime. Window hashes may change
  // inside that lifetime, but invalid data never enters a retained canvas.
  const preserveCanvas = Boolean(continuityKey)
  // Other display adapters may still supply mutable views. Revalidate here
  // even when an external replay frame retains the same object reference.
  const issue = view ? priceChartIssue(view, preserveCanvas)
    ?? (props.externalReplay && (props.variant === 'market' || !priceReplaySlice(view, props.externalReplay)) ? '체결 데이터를 확인할 수 없습니다.' : null) : null
  if (issue || !stableView) return <section className="cp-chart cp-empty" aria-label={format.t('chart')}><p role="status">{issue ? format.issue(issue) : format.t('waiting')}</p></section>
  return <PriceChart key={JSON.stringify([props.variant ?? 'analysis', ...(preserveCanvas ? ['continuous', continuityKey] : ['window', stableView.identity])])} view={stableView} preserveCanvas={preserveCanvas} {...props} />
})

function PriceChart({ view, preserveCanvas, variant = 'analysis', onFillSelect, autoReplay = false, onReplayChange, onRendererStateChange, controlRef, showBarFills = true, externalSkip = false, externalReplay }: Omit<Props, 'view' | 'continuityKey'> & { view: PriceChartView; preserveCanvas: boolean }) {
  const [drawings] = useState(() => new PriceDrawings())
  const drawingGesture = useRef<{ id: number; x: number; y: number } | null>(null)
  const drawingPointerOwned = useRef(false)
  const { language } = useClientPreferences()
  const format = professionalChartLocale(language)
  const { t, price, utc } = format
  const formatRef = useRef(format)
  // A marker page is an overlay update, not a new price window or chart instance.
  // Compare every price/provenance field; identity alone cannot hide changed prices.
  const [priceView, setPriceView] = useState(view)
  const container = useRef<HTMLDivElement>(null)
  const api = useRef<IChartApi | null>(null)
  const fitView = useRef<(() => void) | null>(null)
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const callback = useRef(onFillSelect)
  const replayCallback = useRef(onReplayChange)
  const rendererCallback = useRef(onRendererStateChange)
  const initialReplay = useRef(autoReplay && variant !== 'market' && !externalReplay)
  const externalRetired = useRef<string | null>(null)
  const externalPendingEnd = useRef<{ attemptId: string; reason: ProfessionalReplayEnd } | null>(null)
  const externalNotified = useRef<string | null>(null)
  const [retiredAttempt, setRetiredAttempt] = useState<string | null>(null)
  const updateExternalReplay = useRef<(() => void) | null>(null)
  const playback = useRef<{ start: () => void; skip: () => void } | null>(null)
  const controls = useRef<((scale: 'normal' | 'log' | 'percent', indicators: Indicators) => void) | null>(null)
  const updateFills = useRef<((next: PriceChartView) => void) | null>(null)
  const updatePrices = useRef<((next: PriceChartView, studies: ReturnType<typeof priceChartStudies>, vwap: StudyPoint[], averages: ReturnType<typeof chartMovingAverages>) => void) | null>(null)
  const updateLocale = useRef<((next: ReturnType<typeof professionalChartLocale>) => void) | null>(null)
  const viewport = useRef<ReturnType<IChartApi['timeScale']> extends { getVisibleLogicalRange(): infer R } ? R : never>(null)
  const renderedView = useRef(view)
  const inspectionMode = useRef<'pointer' | 'keyboard'>('pointer')
  const inspectionEpoch = useRef(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [scale, setScale] = useState<'normal' | 'log' | 'percent'>('normal')
  const [indicators, setIndicators] = useState<Indicators>({ ma7: variant === 'market', ma25: variant === 'market', ma99: variant === 'market', ema20: false, ema50: false, bb: false, vwap: false, rsi: false, volume: true })
  const hasVolume = view.bars.every(bar => bar.volume !== null)
  const { ema20, ema50, bb, rsi } = indicators
  const vwap = hasVolume && indicators.vwap
  const hasAverages = indicators.ma7 || indicators.ma25 || indicators.ma99
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [localReplay, setReplay] = useState<{ progress: number; fill: PriceFill | null } | null>(null)
  const externalSlice = externalReplay ? priceReplaySlice(view, externalReplay) : null
  const externalBound = externalReplay && externalReplay.attemptId !== retiredAttempt && externalReplay.frame.state !== 'complete'
  const externalActive = externalBound && !failed
  const replay = externalReplay ? externalActive && externalSlice ? { progress: externalReplay.frame.progress, fill: externalSlice.fill } : null : localReplay
  const drawingsEnabled = !failed && !replay && !externalSkip && view.bars.length > 0
  const [inspection, setInspection] = useState<number | 'reduced' | null>(null)
  if (!equalPriceViews({ ...priceView, fills: [] }, { ...view, fills: [] })) {
    // An old index must never announce a different bar after prices change.
    // Locale changes and marker-only pages are not price replacements.
    setPriceView(view); setSelected(null); setInspection(null)
  }
  const inspectedBar = typeof inspection === 'number' ? view.bars[inspection] : null
  const activeIndex = externalBound && externalSlice ? externalSlice.count - 1 : selected ?? view.bars.length - 1
  const bar = view.bars[Math.min(activeIndex, view.bars.length - 1)]
  const studies = useMemo(() => priceChartStudies(priceView.bars, priceView.resolutionSeconds), [priceView])
  const vwapPoints = useMemo(() => chartWindowVwap(priceView.bars, priceView.resolutionSeconds), [priceView])
  const averages = useMemo(() => chartMovingAverages(priceView.bars, priceView.resolutionSeconds), [priceView])
  const runtimeInput = useRef({ view: priceView, fills: view.fills, studies, vwapPoints, averages, externalReplay })
  useLayoutEffect(() => { runtimeInput.current = { view: priceView, fills: view.fills, studies, vwapPoints, averages, externalReplay } }, [priceView, view.fills, studies, vwapPoints, averages, externalReplay])
  const lifetimeView = preserveCanvas ? null : priceView
  const studyIndex = Math.min(activeIndex, view.bars.length - 1)
  const groups = useMemo(() => priceMarkerGroups(view), [view])
  const fillMap = useMemo(() => {
    const map = new Map<number, PriceFill[]>()
    const sourceOrder = new Map(view.fills.map((fill, index) => [fill.id, index]))
    groups.forEach(group => {
      const items = map.get(group.index)
      if (items) items.push(...group.fills)
      else map.set(group.index, [...group.fills])
    })
    // Grouping BUY/SELL markers must not reorder equal-time ledger events.
    map.forEach(items => items.sort((a, b) => a.time - b.time || sourceOrder.get(a.id)! - sourceOrder.get(b.id)!))
    return map
  }, [groups, view.fills])
  const fills = selected === null ? [] : fillMap.get(selected) ?? []
  const unplacedCount = useMemo(() => view.fills.length - [...fillMap.values()].reduce((count, items) => count + items.length, 0), [view.fills.length, fillMap])
  // Scope announcements to the same supplied, drawable fills as this replay.
  // Stable time sorting retains source order for ties and distinguishes two
  // executions even when their visible side, price and timestamp are identical.
  const hasExternalReplay = Boolean(externalReplay)
  const replayPositions = useMemo(() => new Map(view.fills
    .filter(fill => hasExternalReplay || containingBar(view, fill.time) !== null)
    .slice().sort((left, right) => left.time - right.time)
    .map((fill, index) => [fill.id, index + 1])), [view, hasExternalReplay])
  useLayoutEffect(() => { callback.current = onFillSelect }, [onFillSelect])
  useLayoutEffect(() => { replayCallback.current = onReplayChange }, [onReplayChange])
  useLayoutEffect(() => { rendererCallback.current = onRendererStateChange }, [onRendererStateChange])
  useLayoutEffect(() => {
    // Relabel the existing renderer, never rebuild its prices, viewport or replay.
    formatRef.current = format
    api.current?.applyOptions({ localization: { locale: format.locale, timeFormatter: (time: Time) => format.utc(Number(time)) } })
    updateLocale.current?.(format)
  }, [format])
  useImperativeHandle(controlRef, () => ({
    play: () => { if (externalReplay || variant === 'market' || !view.bars.length || !playback.current) return false; playback.current.start(); return true }, skip: () => { if (variant !== 'market') playback.current?.skip() },
    selectFill: id => {
      if (externalReplay && externalRetired.current !== externalReplay.attemptId) return
      if (!api.current || !series.current || !playback.current) return
      const fill = view.fills.find(item => item.id === id)
      if (!fill) return
      const index = containingBar(view, fill.time)
      if (index === null) return
      inspectionMode.current = 'keyboard'
      inspectionEpoch.current++
      setSelected(index)
      api.current?.timeScale().setVisibleLogicalRange({ from: index - 20, to: index + 20 })
      if (series.current) api.current?.setCrosshairPosition(fill.price, view.bars[index].time as UTCTimestamp, series.current)
    },
  }), [view, variant, externalReplay])

  useLayoutEffect(() => {
    let { view } = runtimeInput.current
    const hadExternalIntent = Boolean(runtimeInput.current.externalReplay || externalPendingEnd.current)
    const { studies, vwapPoints, averages } = runtimeInput.current
    view = { ...(lifetimeView ?? view), fills: runtimeInput.current.fills }
    const node = container.current
    if (!node) return
    if (renderedView.current !== view) { viewport.current = null; renderedView.current = view }
    const style = getComputedStyle(node)
    const palette = new Map<string, string>()
    const color = (name: string) => { if (!palette.has(name)) palette.set(name, style.getPropertyValue(name).trim()); return palette.get(name)! }
    let chart: IChartApi | undefined, observer: ResizeObserver | undefined
    let detachMotion = () => {}
    let pointerFrame = 0, resizeFrame = 0, replayTimer = 0, disposed = false, runtimeFailed = false
    const retireFailedRuntime = () => {
      runtimeFailed = true
      clearInterval(replayTimer)
      cancelAnimationFrame(pointerFrame); cancelAnimationFrame(resizeFrame)
      observer?.disconnect()
      detachMotion()
      api.current = null; series.current = null; updateLocale.current = null
      playback.current = null; controls.current = null; updateFills.current = null; updatePrices.current = null; fitView.current = null; updateExternalReplay.current = null
      viewport.current = null
      // Removal is also the fallback when clearing a broken series throws.
      // Retire this instance exactly once; retry always uses current props.
      chart?.remove(); chart = undefined
    }
    try {
      chart = createChart(node, {
        autoSize: false, width: node.clientWidth, height: node.clientHeight,
        layout: { background: { type: ColorType.Solid, color: color('--cp-bg') }, textColor: color('--cp-muted'), fontFamily: style.fontFamily, fontSize: 12, attributionLogo: true, panes: { separatorColor: color('--cp-line'), separatorHoverColor: color('--cp-muted') } },
        grid: { vertLines: { color: color('--cp-line') }, horzLines: { color: color('--cp-line') } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: color('--cp-muted'), style: LineStyle.Dashed, labelBackgroundColor: color('--cp-raised') }, horzLine: { color: color('--cp-muted'), style: LineStyle.Dashed, labelBackgroundColor: color('--cp-raised') } },
        rightPriceScale: { borderColor: color('--cp-line'), minimumWidth: 72 },
        timeScale: { borderColor: color('--cp-line'), timeVisible: true, secondsVisible: view.resolutionSeconds < 60, rightOffset: 3, minBarSpacing: .08, lockVisibleTimeRangeOnResize: true },
        localization: { locale: formatRef.current.locale, timeFormatter: (time: Time) => formatRef.current.utc(Number(time)) },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      })
      api.current = chart
      const metrics = document.createElement('canvas').getContext('2d')
      if (metrics) metrics.font = `12px ${style.fontFamily}`
      const textWidth = (value: string) => metrics?.measureText(value).width ?? value.length * 8
      const titleWidth = Math.max(...['EMA 20', 'EMA 50', 'BB 20·2 +', 'BB 20·2 −', 'VWAP'].map(textWidth))
      const markerTextWidth = (nextGroups: ReturnType<typeof priceMarkerGroups>) => Math.max(textWidth('SELL'), ...nextGroups.map(group => textWidth(group.fills.length === 1 ? group.side : `${group.side} ×${group.fills.length}`)))
      let markerWidth = markerTextWidth(priceMarkerGroups(view))
      let compact = node.clientWidth <= 480
      const fittedRange = () => {
        if (!view.bars.length) return { from: 0, to: 1 }
        // Reserve pixel space for real marker text and pane titles. Symmetric
        // bar-count padding shrinks on narrow screens and clips edge fills.
        const left = markerWidth / 2 + (compact ? 10 : 14), right = markerWidth / 2 + (compact ? 10 : titleWidth + 26)
        const plot = chart!.timeScale().width() || Math.max(1, node.clientWidth - 72)
        const reserve = Math.min(1, plot * .5 / (left + right))
        const usable = plot - reserve * (left + right)
        const span = Math.max(1, view.bars.length - 1)
        return { from: -Math.ceil(span * left * reserve / usable), to: view.bars.length - 1 + Math.ceil(span * right * reserve / usable) }
      }
      const fit = () => {
        chart?.timeScale().setVisibleLogicalRange(fittedRange())
      }
      fitView.current = fit
      const candles = chart.addSeries(CandlestickSeries, { upColor: color('--cp-up'), downColor: color('--cp-down'), borderUpColor: color('--cp-up'), borderDownColor: color('--cp-down'), wickUpColor: color('--cp-up'), wickDownColor: color('--cp-down'), priceLineStyle: LineStyle.Dashed, priceFormat: { type: 'price', precision: view.pricePrecision, minMove: 10 ** -view.pricePrecision } })
      series.current = candles
      candles.attachPrimitive(drawings)
      drawings.configure({ focus: () => node.focus({ preventScroll: true }), precision: view.pricePrecision, number: formatRef.current.price, color: color('--cp-muted'), activeColor: color('--cp-text') })
      const lastBar = view.bars.at(-1)
      if (lastBar) drawings.setKeyboardAnchor({ time: lastBar.time, price: lastBar.close })
      let candleData = view.bars.map(item => ({ ...item, time: item.time as UTCTimestamp }))
      candles.setData(candleData)
      const indicatorSeries: { api: ISeriesApi<'Line'>; title: string; data: (Omit<StudyPoint, 'time'> & { time: UTCTimestamp })[]; kind: MovingAverageKey | 'ema20' | 'ema50' | 'bb' | 'vwap' }[] = []
      let volumeSeries: ISeriesApi<'Histogram'> | undefined
      let rsiSeries: ISeriesApi<'Line'> | undefined
      const sizePanes = () => {
        const indicatorHeight = (rsiSeries ? 90 : 0) + (volumeSeries ? 80 : 0)
        // Pixel targets expressed as ratios avoid sequential setHeight calls
        // shrinking the other pane, including after a viewport resize.
        candles.getPane().setStretchFactor(Math.max(160, node.clientHeight - 30 - indicatorHeight))
        rsiSeries?.getPane().setStretchFactor(90)
        volumeSeries?.getPane().setStretchFactor(80)
      }
      let rsiData = studyLineData(studies.rsi).map(item => ({ ...item, time: item.time as UTCTimestamp }))
      let volumeData = view.bars.map(item => ({ time: item.time as UTCTimestamp, ...(item.volume === null ? {} : { value: item.volume, color: color(item.close >= item.open ? '--cp-volume-up' : '--cp-volume-down') }) }))
      for (const period of movingAveragePeriods) {
        const kind = `ma${period}` as const
        const line = chart.addSeries(LineSeries, { visible: false, color: color(`--cp-ma${period}`), lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, title: `MA ${period}` })
        const data = studyLineData(averages[kind], view.resolutionSeconds).map(item => ({ ...item, time: item.time as UTCTimestamp }))
        line.setData(data)
        indicatorSeries.push({ api: line, title: `MA ${period}`, data, kind })
      }
      for (const period of [20, 50]) {
        const line = chart.addSeries(LineSeries, { visible: false, color: color(period === 20 ? '--cp-accent' : '--cp-muted'), lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, title: `EMA ${period}`, priceFormat: { type: 'price', precision: view.pricePrecision, minMove: 10 ** -view.pricePrecision } })
        const data = chartEma(view.bars, period).map(item => ({ ...item, time: item.time as UTCTimestamp }))
        line.setData(data)
        indicatorSeries.push({ api: line, title: `EMA ${period}`, data, kind: period === 20 ? 'ema20' : 'ema50' })
      }
      for (const [name, points] of [['BB 20·2 +', studies.upper], ['BB 20·2 −', studies.lower]] as const) {
        const line = chart.addSeries(LineSeries, { visible: false, color: color('--cp-muted'), lineStyle: LineStyle.Dashed, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, title: name })
        const data = studyLineData(points).map(item => ({ ...item, time: item.time as UTCTimestamp }))
        line.setData(data); indicatorSeries.push({ api: line, title: name, data, kind: 'bb' })
      }
      const vwapLine = chart.addSeries(LineSeries, { visible: false, color: color('--cp-accent'), lineStyle: LineStyle.Dotted, lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, title: 'VWAP' })
      const vwapData = studyLineData(vwapPoints, view.resolutionSeconds).map(item => ({ ...item, time: item.time as UTCTimestamp }))
      vwapLine.setData(vwapData); indicatorSeries.push({ api: vwapLine, title: 'VWAP', data: vwapData, kind: 'vwap' })
      // Compact panes use the existing named toggles and study readouts, not
      // duplicate titles over the price plot. No price/indicator data is hidden.
      const placeTitles = () => indicatorSeries.forEach(item => item.api.applyOptions({ title: compact ? '' : item.title }))
      placeTitles()
      // Scope fixed price precision to price series. Applying a global price
      // formatter would incorrectly impose currency precision on volume axes.
      updateLocale.current = next => {
        const priceFormat = { type: 'custom' as const, minMove: 10 ** -view.pricePrecision, formatter: next.axisPrice(view.pricePrecision) }
        candles.applyOptions({ priceFormat })
        indicatorSeries.forEach(item => item.api.applyOptions({ priceFormat }))
        rsiSeries?.applyOptions({ priceFormat: { type: 'custom', minMove: .1, formatter: next.axisPrice(1) } })
      }
      updateLocale.current(formatRef.current)
      controls.current = (nextScale, nextIndicators) => {
        const volumeAvailable = view.bars.every(bar => bar.volume !== null)
        const showVolume = nextIndicators.volume && volumeAvailable, showRsi = nextIndicators.rsi
        candles.priceScale().applyOptions({ mode: nextScale === 'log' ? PriceScaleMode.Logarithmic : nextScale === 'percent' ? PriceScaleMode.Percentage : PriceScaleMode.Normal })
        indicatorSeries.forEach(item => item.api.applyOptions({ visible: nextIndicators[item.kind] && (item.kind !== 'vwap' || volumeAvailable) }))
        if (!showRsi && rsiSeries) { chart!.removeSeries(rsiSeries); rsiSeries = undefined }
        if (showRsi && !rsiSeries) {
          rsiSeries = chart!.addSeries(LineSeries, { color: color('--cp-accent'), title: 'RSI 14', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, priceFormat: { type: 'custom', minMove: .1, formatter: formatRef.current.axisPrice(1) }, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) }, chart!.panes().length)
          rsiSeries.setData(playing ? rsiData.slice(0, shown) : rsiData)
          for (const level of [30, 70]) rsiSeries.createPriceLine({ price: level, color: color('--cp-muted'), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' })
        }
        // On a fresh/retried chart create RSI first. moveTo cannot target a
        // pane widget that LWC has not painted yet in this layout commit.
        if (showVolume && !volumeSeries) {
          volumeSeries = chart!.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false }, chart!.panes().length)
          volumeSeries.setData(playing ? volumeData.slice(0, shown) : volumeData)
        } else if (!showVolume && volumeSeries) { chart!.removeSeries(volumeSeries); volumeSeries = undefined }
        // Always price → RSI → volume, including every toggle order.
        rsiSeries?.getPane().moveTo(1)
        sizePanes()
      }
      let markerFills = new Map<string, PriceFill[]>()
      let markers: SeriesMarker<UTCTimestamp>[] = []
      const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: 'top' })
      let orderedFills: PriceFill[] = []
      let shown = view.bars.length, playing = false
      let externallyPlaying = false
      let activeExternalAttempt: string | null = null
      let seenFills = 0, latest: PriceFill | null = null
      let replayStart = 0
      let executionTimeline = priceExecutionTimeline(view, orderedFills)
      let executionDelay = 0
      const executionDuration = () => Math.max(PRICE_REPLAY_DURATION_MS,
        (executionTimeline.at.at(-1) ?? -EXECUTION_DWELL_MS) + executionDelay + EXECUTION_DWELL_MS)
      updateFills.current = next => {
        if (disposed) return
        const nextGroups = priceMarkerGroups(next)
        // A later marker page changes label width, not the price window or
        // user's zoom. Cache for the next explicit fit/replay, never auto-fit.
        markerWidth = markerTextWidth(nextGroups)
        markerFills = new Map(nextGroups.map(group => [group.id, group.fills]))
        markers = nextGroups.map(({ time, id, side, fills: matches }) => ({ time: time as UTCTimestamp, id,
          position: side === 'BUY' ? 'belowBar' as const : 'aboveBar' as const,
          color: color(side === 'BUY' ? '--cp-up' : '--cp-down'),
          shape: side === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const,
          text: matches.length === 1 ? side : `${side} ×${matches.length}` }))
        // Stable sorting preserves the supplied page's execution order at the
        // same timestamp; opaque IDs carry no ENTRY/EXIT ordering authority.
        orderedFills = next.fills.filter(fill => containingBar(next, fill.time) !== null).slice().sort((a, b) => a.time - b.time)
        if (runtimeInput.current.externalReplay && externalRetired.current !== runtimeInput.current.externalReplay.attemptId && runtimeInput.current.externalReplay.frame.state !== 'complete') {
          // The external clock, not candle grouping or page arrival, controls
          // which executions are visible. Its layout apply runs below.
        } else if (playing) {
          const through = shown ? view.bars[shown - 1].time + view.resolutionSeconds : -Infinity
          markerPlugin.setMarkers(visiblePriceMarkers(markers, through))
          seenFills = 0
          while (seenFills < orderedFills.length && orderedFills[seenFills].time < through) seenFills++
          executionTimeline = priceExecutionTimeline(view, orderedFills, seenFills, Math.max(0, Date.now() - replayStart))
          executionDelay = 0
          // Replace the page, never merge old fills or celebrate newly loaded past events.
          latest = null
          setReplay(current => current ? { ...current, fill: null } : null)
        } else markerPlugin.setMarkers(markers)
      }
      const finish = (reason: ProfessionalReplayEnd) => {
        const external = runtimeInput.current.externalReplay
        const attemptId = external?.attemptId ?? activeExternalAttempt ?? externalPendingEnd.current?.attemptId
        if (attemptId && externalRetired.current === attemptId) return
        // Save terminal intent before the renderer can throw. Commit retirement
        // only after restoration succeeds; retry must finish, not restart.
        if (attemptId) externalPendingEnd.current = { attemptId, reason }
        clearInterval(replayTimer); playing = false
        externallyPlaying = false
        try {
          chart?.applyOptions({ handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: true, crosshair: { mode: CrosshairMode.Normal } })
          candles.setData(candleData); volumeSeries?.setData(volumeData); rsiSeries?.setData(rsiData)
          indicatorSeries.forEach(item => item.api.setData(item.data))
          markerPlugin.setMarkers(markers)
        } catch {
          retireFailedRuntime(); setFailed(true); setReplay(null); rendererCallback.current?.('error')
          return
        }
        if (attemptId) {
          externalRetired.current = attemptId; setRetiredAttempt(attemptId)
          externalPendingEnd.current = null
        }
        activeExternalAttempt = null
        shown = view.bars.length; setReplay(null); setSelected(null)
        setInspection(reason === 'reduced' ? 'reduced' : null)
        replayCallback.current?.(false, reason)
      }
      updateExternalReplay.current = () => {
        const external = runtimeInput.current.externalReplay
        if (!external) { if (externallyPlaying || externalPendingEnd.current) finish(externalPendingEnd.current?.reason ?? 'skip'); return }
        if (disposed || runtimeFailed || externalRetired.current === external.attemptId) return
        const supplied = { ...view, fills: runtimeInput.current.fills }
        const slice = priceReplaySlice(supplied, external)
        if (!slice) return // The component boundary rejects mismatched frames.
        // A new accepted attempt supersedes a failed restoration, not its
        // terminal reason. Retrying B must never finish or retire A instead.
        if (externalPendingEnd.current?.attemptId !== external.attemptId) externalPendingEnd.current = null
        try {
          if (externalPendingEnd.current?.attemptId === external.attemptId) { finish(externalPendingEnd.current.reason); return }
          if (external.frame.state === 'complete') { finish('complete'); return }
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish('reduced'); return }
          if (!externallyPlaying) {
            drawings.setEnabled(false)
            clearInterval(replayTimer)
            cancelAnimationFrame(pointerFrame)
            playing = true; externallyPlaying = true; shown = 0
            candles.setData([]); volumeSeries?.setData([]); rsiSeries?.setData([])
            indicatorSeries.forEach(item => item.api.setData([])); markerPlugin.setMarkers([])
            chart?.applyOptions({ handleScroll: false, handleScale: false, crosshair: { mode: CrosshairMode.Hidden } })
            setInspection(null); setSelected(null)
          }
          activeExternalAttempt = external.attemptId
          if (shown > slice.count) {
            candles.setData(candleData.slice(0, slice.count)); volumeSeries?.setData(volumeData.slice(0, slice.count)); rsiSeries?.setData(rsiData.slice(0, slice.count))
            indicatorSeries.forEach(item => item.api.setData(item.data.slice(0, slice.count)))
            shown = slice.count
          }
          while (shown < slice.count) {
            candles.update(candleData[shown]); volumeSeries?.update(volumeData[shown]); rsiSeries?.update(rsiData[shown])
            indicatorSeries.forEach(item => item.api.update(item.data[shown])); shown++
          }
          const visible = priceMarkerGroups({ ...supplied, fills: supplied.fills.filter(fill => fill.time <= external.frame.time) })
          markerPlugin.setMarkers(visible.map(({ time, id, side, fills: matches }) => ({ time: time as UTCTimestamp, id,
            position: side === 'BUY' ? 'belowBar' : 'aboveBar', color: color(side === 'BUY' ? '--cp-up' : '--cp-down'),
            shape: side === 'BUY' ? 'arrowUp' : 'arrowDown', text: matches.length === 1 ? side : `${side} ×${matches.length}` })))
          fit()
          if (externalNotified.current !== external.attemptId) {
            externalNotified.current = external.attemptId; replayCallback.current?.(true)
          }
        } catch {
          retireFailedRuntime(); setFailed(true); setReplay(null); rendererCallback.current?.('error')
        }
      }
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
      const motionChanged = () => { if (motion.matches && externallyPlaying) updateExternalReplay.current?.() }
      motion.addEventListener('change', motionChanged)
      detachMotion = () => motion.removeEventListener('change', motionChanged)
      playback.current = { skip: () => finish('skip'), start: () => {
        if (runtimeInput.current.externalReplay || variant === 'market' || playing || !view.bars.length) return
        inspectionMode.current = 'pointer'
        setInspection(null)
        cancelAnimationFrame(pointerFrame)
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish('reduced'); return }
        playing = true; shown = 0
        drawings.setEnabled(false)
        chart?.applyOptions({ handleScroll: false, handleScale: false, crosshair: { mode: CrosshairMode.Hidden } })
        const start = Date.now(); replayStart = start
        executionTimeline = priceExecutionTimeline(view, orderedFills)
        executionDelay = 0
        const replayRange = fittedRange()
        seenFills = 0; latest = null
        candles.setData([]); volumeSeries?.setData([]); rsiSeries?.setData([])
        indicatorSeries.forEach(item => item.api.setData([])); markerPlugin.setMarkers([])
        fit()
        setSelected(null); setReplay({ progress: 0, fill: null })
        replayCallback.current?.(true)
        const tick = () => {
          if (!playing || disposed) return
          const elapsed = Math.max(0, Date.now() - start)
          const progress = Math.min(1, elapsed / executionDuration())
          if (progress >= 1) { finish('complete'); return }
          if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish('reduced'); return }
          // Ordinary windows take a full minute; dense fills can extend their
          // explanation. A throttled tick past the deadline finishes without
          // replaying a backlog of obsolete toasts after returning to the tab.
          const reveal = Math.min(1, elapsed / PRICE_REVEAL_DURATION_MS)
          const count = Math.max(1, Math.floor(reveal * view.bars.length))
          const previousShown = shown
          while (shown < count) {
            candles.update(candleData[shown]); volumeSeries?.update(volumeData[shown]); rsiSeries?.update(rsiData[shown])
            indicatorSeries.forEach(item => item.api.update(item.data[shown])); shown++
          }
          // Empty-series resets and auto-scroll must not push early fills offscreen.
          // Locked replay range uses cached bounds; no layout read per tick.
          chart?.timeScale().setVisibleLogicalRange(replayRange)
          const through = view.bars[count - 1].time + view.resolutionSeconds
          const before = seenFills
          if (seenFills < orderedFills.length && orderedFills[seenFills].time < through
            && executionTimeline.at[seenFills] + executionDelay <= elapsed) {
            // A foreground stall must not collapse several due executions into
            // the last one. Shift their display schedule, not the market times.
            executionDelay += elapsed - (executionTimeline.at[seenFills] + executionDelay)
            latest = orderedFills[seenFills++]
          }
          // Markers follow the actual revealed bars, not the paced explanation.
          // A dense event queue must not hide an already revealed execution.
          if (before !== seenFills || previousShown !== shown) markerPlugin.setMarkers(visiblePriceMarkers(markers, through))
          setSelected(count - 1); setReplay({ progress: Math.min(1, elapsed / executionDuration()), fill: latest })
        }
        replayTimer = window.setInterval(tick, 100); tick()
      } }
      let indexes = new Map(view.bars.map((item, index) => [item.time, index]))
      const move = (event: MouseEventParams<Time>) => {
        if (disposed || runtimeFailed || playing || inspectionMode.current !== 'pointer') return
        drawings.move(event)
        if (typeof event.time !== 'number') return
        const index = indexes.get(event.time)
        if (index === undefined) return
        cancelAnimationFrame(pointerFrame)
        // Keyboard/ledger selection may happen after this event was queued.
        // Layout-generated crosshair events must not replace that explicit intent.
        const epoch = inspectionEpoch.current
        pointerFrame = requestAnimationFrame(() => { if (!disposed && !playing && inspectionMode.current === 'pointer' && epoch === inspectionEpoch.current) setSelected(index) })
      }
      const click = (event: MouseEventParams<Time>) => {
        if (disposed || runtimeFailed || playing || drawingPointerOwned.current) return
        if (drawings.click(event)) return
        inspectionMode.current = 'pointer'
        cancelAnimationFrame(pointerFrame)
        if (typeof event.time !== 'number') return
        const index = indexes.get(event.time)
        if (index !== undefined) setSelected(index)
        const matches = typeof event.hoveredObjectId === 'string' ? markerFills.get(event.hoveredObjectId) : undefined
        if (matches?.length === 1) callback.current?.(matches[0])
      }
      chart.subscribeCrosshairMove(move)
      chart.subscribeClick(click)
      if (viewport.current) chart.timeScale().setVisibleLogicalRange(viewport.current)
      else fit()
      // Hidden tab panels can mount at zero width. Fit once when first visible;
      // subsequent pane changes/resizes must preserve the user's zoom and pan.
      let fitWhenVisible = !viewport.current && node.clientWidth === 0
      updatePrices.current = (next, nextStudies, nextVwap, nextAverages) => {
        if (disposed || equalPriceViews({ ...view, fills: [] }, { ...next, fills: [] })) return
        // Retire the old single-window explanation before replacing its input.
        // The whole-period clock will be a separate explicit consumer of this port.
        const external = runtimeInput.current.externalReplay
        const keepExternal = external && externalRetired.current !== external.attemptId
        if (playing && !keepExternal) finish('skip')
        cancelAnimationFrame(pointerFrame)
        inspectionEpoch.current++
        inspectionMode.current = 'keyboard'
        chart?.clearCrosshairPosition()
        setSelected(null); setInspection(null); setReplay(null)
        view = { ...next, fills: runtimeInput.current.fills }
        markerWidth = markerTextWidth(priceMarkerGroups(view))
        renderedView.current = next; viewport.current = null
        shown = keepExternal ? 0 : next.bars.length; seenFills = 0; latest = null
        markerFills = new Map(); markers = []; orderedFills = []
        executionTimeline = priceExecutionTimeline(next, []); executionDelay = 0
        indexes = new Map(next.bars.map((item, index) => [item.time, index]))
        candleData = next.bars.map(item => ({ ...item, time: item.time as UTCTimestamp }))
        volumeData = next.bars.map(item => ({ time: item.time as UTCTimestamp, ...(item.volume === null ? {} : { value: item.volume, color: color(item.close >= item.open ? '--cp-volume-up' : '--cp-volume-down') }) }))
        rsiData = studyLineData(nextStudies.rsi).map(item => ({ ...item, time: item.time as UTCTimestamp }))
        const bbData = [nextStudies.upper, nextStudies.lower]
        let bbIndex = 0
        for (const item of indicatorSeries) {
          const points = item.kind === 'ma7' || item.kind === 'ma25' || item.kind === 'ma99' ? studyLineData(nextAverages[item.kind], next.resolutionSeconds)
            : item.kind === 'ema20' ? chartEma(next.bars, 20) : item.kind === 'ema50' ? chartEma(next.bars, 50)
            : item.kind === 'bb' ? studyLineData(bbData[bbIndex++]) : studyLineData(nextVwap, next.resolutionSeconds)
          item.data = points.map(point => ({ ...point, time: point.time as UTCTimestamp }))
        }
        try {
          markerPlugin.setMarkers([])
          candles.setData(keepExternal ? [] : candleData); volumeSeries?.setData(keepExternal ? [] : volumeData); rsiSeries?.setData(keepExternal ? [] : rsiData)
          indicatorSeries.forEach(item => item.api.setData(keepExternal ? [] : item.data))
          chart?.applyOptions({ timeScale: { secondsVisible: next.resolutionSeconds < 60 } })
          updateLocale.current?.(formatRef.current)
          fitWhenVisible = node.clientWidth === 0
          fit()
        } catch {
          // Never leave old prices beneath the new provenance after a renderer
          // failure. Retry creates a fresh instance from the current input.
          try {
            candles.setData([]); volumeSeries?.setData([]); rsiSeries?.setData([])
            indicatorSeries.forEach(item => item.api.setData([])); markerPlugin.setMarkers([])
          } catch { /* The failed renderer is removed below even if clearing fails. */ }
          retireFailedRuntime()
          setFailed(true); setReplay(null); rendererCallback.current?.('error'); if (!external) replayCallback.current?.(false)
        }
      }
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => {
          if (!disposed && !runtimeFailed && node.clientWidth > 0 && node.clientHeight > 0) {
            chart?.resize(node.clientWidth, node.clientHeight)
            const nextCompact = node.clientWidth <= 480
            if (nextCompact !== compact) { compact = nextCompact; placeTitles() }
            sizePanes()
            if (fitWhenVisible) { fitWhenVisible = false; fit() }
          }
        })
      })
      observer.observe(node)
      queueMicrotask(() => { if (!disposed && !runtimeFailed) {
        setFailed(false); setReplay(null); rendererCallback.current?.('ready')
        if (!initialReplay.current && !runtimeInput.current.externalReplay && !hadExternalIntent) replayCallback.current?.(false)
      } })
    } catch {
      // A partially initialized renderer cannot accept later locale/control updates.
      retireFailedRuntime()
      queueMicrotask(() => { if (!disposed) { setFailed(true); setReplay(null); rendererCallback.current?.('error'); if (!runtimeInput.current.externalReplay && !hadExternalIntent) replayCallback.current?.(false) } })
    }
    return () => { disposed = true; clearInterval(replayTimer); detachMotion(); playback.current = null; controls.current = null; updateFills.current = null; updatePrices.current = null; updateLocale.current = null; fitView.current = null; updateExternalReplay.current = null; cancelAnimationFrame(pointerFrame); cancelAnimationFrame(resizeFrame); observer?.disconnect(); if (chart) { viewport.current = chart.timeScale().getVisibleLogicalRange(); chart.remove() } api.current = null; series.current = null; rendererCallback.current?.('unavailable') }
  }, [lifetimeView, retry, variant, drawings])

  // StrictMode may retire the first layout runtime after its ready microtask.
  // Consume the one-shot intent only after the passive setup survives cleanup;
  // restarting on every renderer cleanup would replay retries/window changes.
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || !playback.current) return
      if (initialReplay.current) { initialReplay.current = false; playback.current.start() }
    })
    return () => { cancelled = true }
  }, [lifetimeView, retry])

  // Prices and their DOM provenance become observable in the same commit.
  // Setup must also precede these layout effects, including first mount/retry.
  useLayoutEffect(() => { updatePrices.current?.(priceView, studies, vwapPoints, averages) }, [priceView, studies, vwapPoints, averages, retry])
  useLayoutEffect(() => { controls.current?.(scale, indicators) }, [scale, indicators, priceView, retry])
  useLayoutEffect(() => { updateFills.current?.(view) }, [view, priceView, retry])
  useLayoutEffect(() => { updateExternalReplay.current?.() }, [externalReplay, view, priceView, retry])
  useLayoutEffect(() => {
    const changed = drawings.setScope(priceView.market)
    drawings.setDomain(priceView.bars, priceView.resolutionSeconds)
    const last = priceView.bars.at(-1), { pending, editing } = drawings.getSnapshot()
    // Price replacement resets the quote to the final candle. Keep the idle
    // keyboard cursor aligned without moving an active draft or endpoint edit.
    // Marker-only pages leave priceView stable and retain explicit inspection.
    if (last && (changed || (!pending && editing === null))) drawings.setKeyboardAnchor({ time: last.time, price: last.close })
  }, [drawings, priceView])
  useLayoutEffect(() => { drawings.setEnabled(drawingsEnabled && api.current !== null) }, [drawings, drawingsEnabled, retry, lifetimeView])
  useLayoutEffect(() => {
    if (!container.current) return
    const style = getComputedStyle(container.current)
    drawings.configure({ focus: () => container.current?.focus({ preventScroll: true }), precision: view.pricePrecision, number: format.price, color: style.getPropertyValue('--cp-muted').trim(), activeColor: style.getPropertyValue('--cp-text').trim() })
  }, [drawings, format, view.pricePrecision])

  const inspect = (index: number) => {
    if (!view.bars[index]) return
    inspectionMode.current = 'keyboard'
    inspectionEpoch.current++
    const next = view.bars[index]; setSelected(index)
    drawings.setKeyboardAnchor({ time: next.time, price: next.close })
    const range = api.current?.timeScale().getVisibleLogicalRange()
    if (range && (index < range.from || index > range.to)) {
      const span = Math.max(10, range.to - range.from)
      api.current?.timeScale().setVisibleLogicalRange({ from: index - span / 2, to: index + span / 2 })
    }
    if (series.current) api.current?.setCrosshairPosition(next.close, next.time as UTCTimestamp, series.current)
    setInspection(index)
  }
  const save = () => {
    if (replay || failed || !view.bars.length) return
    const chart = api.current?.takeScreenshot(true, false)
    if (!chart) return
    const canvas = document.createElement('canvas')
    canvas.width = chart.width
    const context = canvas.getContext('2d')
    if (!context) return
    const font = '14px sans-serif'
    context.font = font
    const lines: string[] = []
    for (const text of [`TETH · ${view.market} · ${format.resolution(view.resolutionSeconds)}`, view.sourceLabel, `${utc(view.bars[0].time)} — ${utc(view.bars.at(-1)!.time)} UTC · ${t('currentWindow')}`]) {
      let line = ''
      for (const character of text) {
        if (line && context.measureText(line + character).width > canvas.width - 24) { lines.push(line); line = '' }
        line += character
      }
      lines.push(line)
    }
    const heading = lines.length * 22 + 20
    canvas.height = chart.height + heading
    context.fillStyle = '#0f1012'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.font = font; context.fillStyle = '#e6e7ea'
    lines.forEach((line, index) => context.fillText(line, 12, 24 + index * 22))
    context.drawImage(chart, 0, heading)
    const link = document.createElement('a'); link.download = 'TETH-chart.png'; link.href = canvas.toDataURL('image/png'); link.click()
  }
  const keyboardInspectionAvailable = view.bars.length > 0 && !replay && !failed
  const chartBody = <>
    <header className="cp-toolbar">{variant !== 'market' && <div className="cp-chart-heading"><strong>{view.market}</strong><span>{t('display', { resolution: format.resolution(view.resolutionSeconds) })}</span></div>}<span className="cp-source" title={view.sourceLabel}>{view.sourceLabel}</span><button type="button" aria-label={t('fit')} disabled={failed} onClick={() => fitView.current?.()}><Maximize2 size={16} /></button><button type="button" aria-label={t('save')} disabled={failed || externalSkip || Boolean(replay) || !view.bars.length} onClick={save}><Camera size={16} /></button></header>
    <dl className="cp-quote" aria-label={t('candle')}><div><dt>UTC</dt><dd>{bar ? utc(bar.time) : '—'}</dd></div>{(['open', 'high', 'low', 'close', 'volume'] as const).map((key, i) => <div key={key}><dt>{['O', 'H', 'L', 'C', 'V'][i]}</dt><dd>{bar && bar[key] !== null ? price(bar[key]) : '—'}</dd></div>)}</dl>
    <div className="cp-controls"><div role="group" aria-label={t('scale')}>{(['normal', 'log', 'percent'] as const).map((mode, i) => <button key={mode} type="button" disabled={failed || externalSkip || Boolean(replay)} aria-pressed={scale === mode} onClick={() => setScale(mode)}>{[t('normal'), t('log'), '%'][i]}</button>)}</div>
      <div className="cp-ma-controls" role="group" aria-label={t('movingAverages')}>{movingAveragePeriods.map(period => {
        const key = `ma${period}` as const
        return <button key={key} data-average={key} type="button" disabled={failed || externalSkip || Boolean(replay)} aria-pressed={indicators[key]} onClick={() => setIndicators(current => ({ ...current, [key]: !current[key] }))}><i aria-hidden="true" />MA {period}</button>
      })}</div>
      {(['ema20', 'ema50', 'bb', 'vwap', 'rsi', 'volume'] as const).map((key, index) => <button key={key} type="button" disabled={failed || externalSkip || Boolean(replay) || (!hasVolume && (key === 'vwap' || key === 'volume'))} aria-pressed={indicators[key] && (hasVolume || (key !== 'vwap' && key !== 'volume'))} onClick={() => setIndicators(current => ({ ...current, [key]: !current[key] }))}>{['EMA 20', 'EMA 50', 'BB 20·2', 'VWAP', 'RSI 14', t('volume')][index]}</button>)}
      {!externalSkip && !externalReplay && variant !== 'market' && <button className="cp-playback" type="button" disabled={failed || !view.bars.length} onClick={() => replay ? playback.current?.skip() : playback.current?.start()}>{replay ? t('skip') : t('replay')}</button>}
    </div>
    {(hasAverages || rsi || bb || vwap) && <dl className="cp-studies" aria-label={t('studies')}>
      {movingAveragePeriods.map(period => {
        const key = `ma${period}` as const, value = averages[key][studyIndex]?.value
        return indicators[key] && <div key={key} data-average={key}><dt>MA {period}</dt><dd data-study={key}>{replay?.progress === 0 || value === undefined ? t('studyEmpty') : format.axisPrice(view.pricePrecision)(value)}</dd></div>
      })}
      {vwap && <div><dt>VWAP</dt><dd data-study="vwap">{replay?.progress === 0 || vwapPoints[studyIndex]?.value === undefined ? t('studyEmpty') : format.axisPrice(view.pricePrecision)(vwapPoints[studyIndex].value!)}</dd></div>}
      {rsi && <div><dt>RSI 14</dt><dd data-study="rsi">{replay?.progress === 0 || studies.rsi[studyIndex]?.value === undefined ? t('studyEmpty') : format.axisPrice(1)(studies.rsi[studyIndex].value!)}</dd></div>}
      {bb && <div><dt>BB 20·2</dt><dd data-study="bb">{replay?.progress === 0 || studies.lower[studyIndex]?.value === undefined ? t('studyEmpty') : `${format.axisPrice(view.pricePrecision)(studies.lower[studyIndex].value!)} / ${format.axisPrice(view.pricePrecision)(studies.upper[studyIndex].value!)}`}</dd></div>}
    </dl>}
    {!view.bars.length && <p className="cp-note" role="status">{format.issue('표시할 가격 데이터가 없습니다.')}</p>}
    <div className="cp-drawing-layout"><ClientPriceDrawingTools drawings={drawings}/><div className="cp-canvas">
    {replay && <div className="cp-replay"><progress max={1} value={replay.progress} aria-label={t('progress')} /><span>{t('replayNote')}</span>{replay.fill && <p key={replay.fill.id} className="cp-execution"><b>{replay.fill.side}</b><span>{price(replay.fill.price)}</span><small>{utc(replay.fill.time)} UTC</small></p>}</div>}
    <div className="cp-surface" ref={container} role="group" tabIndex={0} aria-label={t(keyboardInspectionAvailable ? 'keyboard' : 'chart')}
      onPointerDownCapture={event => {
        inspectionMode.current = 'pointer'
        const state = drawings.getSnapshot()
        drawingPointerOwned.current = state.enabled && (state.tool !== 'cursor' || state.editing !== null)
        drawingGesture.current = drawingPointerOwned.current && event.isPrimary && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null
      }}
      onPointerCancelCapture={() => { drawingGesture.current = null }}
      onPointerUpCapture={event => {
        const start = drawingGesture.current; drawingGesture.current = null
        if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 5) return
        // Native pointer completion avoids LWC's double-click suppression for
        // two quick, distant anchors. Coordinate conversion stays in LWC.
        const node = event.currentTarget, rect = node.getBoundingClientRect()
        if (!rect.width || !rect.height || !api.current) return
        const x = (event.clientX - rect.left) * node.clientWidth / rect.width - api.current.priceScale('left').width()
        const y = (event.clientY - rect.top) * node.clientHeight / rect.height
        if (drawings.placePoint(x, y)) node.focus({ preventScroll: true })
      }}
      onPointerMoveCapture={event => { if (event.pointerType !== 'mouse' || event.movementX !== 0 || event.movementY !== 0) inspectionMode.current = 'pointer' }}
      onKeyDown={event => {
      if (!event.defaultPrevented && drawings.key(event.nativeEvent)) { event.preventDefault(); event.stopPropagation(); return }
      if (!keyboardInspectionAvailable || event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
      const current = selected ?? view.bars.length - 1
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const step = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 10 : 1)
        inspect(event.key === 'Home' ? 0 : event.key === 'End' ? view.bars.length - 1 : Math.max(0, Math.min(view.bars.length - 1, current + step)))
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault(); fitView.current?.()
      } else if (event.key === 'Escape' && selected !== null) {
        event.preventDefault(); event.stopPropagation()
        inspectionMode.current = 'keyboard'; inspectionEpoch.current++
        api.current?.clearCrosshairPosition(); setSelected(null); setInspection(null)
      }
    }} />
    </div></div>
    <p className="cp-sr-only" role="status" aria-live="polite" aria-atomic="true">{replay?.fill && replayPositions.has(replay.fill.id)
      ? t('executionAnnouncement', { index: price(replayPositions.get(replay.fill.id)!), total: price(replayPositions.size), side: replay.fill.side, price: price(replay.fill.price), time: utc(replay.fill.time) })
      : inspection === 'reduced' ? t('reduced') : inspectedBar ? t('inspection', { time: utc(inspectedBar.time), open: price(inspectedBar.open), high: price(inspectedBar.high), low: price(inspectedBar.low), close: price(inspectedBar.close) }) : ''}</p>
    {failed && <div className="cp-failure" role="alert"><p>{t('failure')}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{t('retry')}</button></div>}
  </>
  return <section className={`cp-chart${variant === 'market' ? ' cp-market' : ''}`} aria-label={`${view.market} ${t('chart')}`} data-replaying={Boolean(replay)} data-studies={hasAverages || rsi || bb || vwap}>
    {variant === 'market' ? <div className="cp-market-body">{chartBody}</div> : chartBody}
    <ClientPriceDrawingDetails drawings={drawings} precision={view.pricePrecision}/>
    <footer className="cp-footer">{variant !== 'market' && <span>{t('legend')}</span>}<span>{t('count', { count: price(view.bars.length) })}</span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Lightweight Charts™</a></footer>
    {(ema20 || ema50) && <p className="cp-note">{t('emaNote')}</p>}
    {hasAverages && <p className="cp-note">{t('maNote')}</p>}
    {vwap && <p className="cp-note">{t('vwapNote')}</p>}
    {(rsi || bb) && <p className="cp-note">{t('studiesNote')}</p>}
    {unplacedCount > 0 && <p className="cp-note" role="status">{t('unplaced', { count: price(unplacedCount) })}</p>}
    {showBarFills && !replay && bar && fills.length > 0 && <FillRows key={bar.time} fills={fills} onSelect={onFillSelect} format={format} />}
  </section>
}

function FillRows({ fills, onSelect, format }: { fills: readonly PriceFill[]; onSelect?: Props['onFillSelect']; format: ReturnType<typeof professionalChartLocale> }) {
  const [limit, setLimit] = useState(50)
  return <div className="cp-fills" aria-label={format.t('fills')}>{fills.slice(0, limit).map(fill => <button type="button" key={fill.id} onClick={() => onSelect?.(fill)}><b>{fill.side}</b><span>{format.utc(fill.time)} UTC</span><span>{format.price(fill.price)}</span><small>{fill.tradeId}</small></button>)}{limit < fills.length && <button type="button" onClick={() => setLimit(value => value + 50)}>{format.t('more', { shown: format.price(limit), total: format.price(fills.length) })}</button>}</div>
}
