import { memo, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, PriceScaleMode, createChart, createSeriesMarkers, type IChartApi, type ISeriesApi, type MouseEventParams, type Time, type UTCTimestamp } from 'lightweight-charts'
import { Camera, Maximize2 } from 'lucide-react'
import { chartEma, containingBar, equalPriceViews, priceChartIssue, priceMarkerGroups, priceResolutionLabel, visiblePriceMarkers, type PriceChartView, type PriceFill } from '../chart/price-chart-view'
import '../client-professional-chart.css'

const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 12 })
const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
const price = (value: number) => numberFormat.format(value)
const utc = (time: number) => dateFormat.format(time * 1000)
export type ProfessionalChartControl = { play(): void; skip(): void; selectFill(id: string): void }
type Props = { view: PriceChartView | null; onFillSelect?: (fill: PriceFill) => void; autoReplay?: boolean; onReplayChange?: (playing: boolean) => void; controlRef?: Ref<ProfessionalChartControl>; showBarFills?: boolean; externalSkip?: boolean }

// Extracted from the preserved ProfessionalPriceChart: panes, crosshair,
// price scales, EMA, screenshot and keyboard inspection. No fetch, fixture
// generator, job lifecycle, or trading permission exists in this renderer.
export const ClientProfessionalPriceChart = memo(function ClientProfessionalPriceChart({ view, ...props }: Props) {
  const [snapshot, setSnapshot] = useState(view)
  const unchanged = equalPriceViews(snapshot, view)
  if (!unchanged) setSnapshot(view)
  const stableView = unchanged ? snapshot : view
  const issue = view ? priceChartIssue(view) : '검증된 가격 데이터를 기다리고 있습니다.'
  if (issue || !stableView) return <section className="cp-chart cp-empty" aria-label="백테스트 가격 차트"><p role="status">{issue}</p></section>
  return <PriceChart key={stableView.identity} view={stableView} {...props} />
})

function PriceChart({ view, onFillSelect, autoReplay = false, onReplayChange, controlRef, showBarFills = true, externalSkip = false }: Omit<Props, 'view'> & { view: PriceChartView }) {
  const container = useRef<HTMLDivElement>(null)
  const api = useRef<IChartApi | null>(null)
  const fitView = useRef<(() => void) | null>(null)
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const callback = useRef(onFillSelect)
  const replayCallback = useRef(onReplayChange)
  const initialReplay = useRef(autoReplay)
  const playback = useRef<{ start: () => void; skip: () => void } | null>(null)
  const controls = useRef<((scale: 'normal' | 'log' | 'percent', ema: boolean, volume: boolean) => void) | null>(null)
  const viewport = useRef<ReturnType<IChartApi['timeScale']> extends { getVisibleLogicalRange(): infer R } ? R : never>(null)
  const renderedView = useRef(view)
  const [selected, setSelected] = useState<number | null>(null)
  const [scale, setScale] = useState<'normal' | 'log' | 'percent'>('normal')
  const [ema, setEma] = useState(false)
  const [volume, setVolume] = useState(true)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [replay, setReplay] = useState<{ progress: number; fill: PriceFill | null } | null>(null)
  const [inspection, setInspection] = useState('')
  const bar = view.bars[Math.min(selected ?? view.bars.length - 1, view.bars.length - 1)]
  const groups = useMemo(() => priceMarkerGroups(view), [view])
  const fillMap = useMemo(() => {
    const map = new Map<number, PriceFill[]>()
    groups.forEach(group => {
      const items = map.get(group.index)
      if (items) items.push(...group.fills)
      else map.set(group.index, [...group.fills])
    })
    map.forEach(items => items.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id)))
    return map
  }, [groups])
  const fills = selected === null ? [] : fillMap.get(selected) ?? []
  const unplacedCount = useMemo(() => view.fills.length - [...fillMap.values()].reduce((count, items) => count + items.length, 0), [view.fills.length, fillMap])
  useEffect(() => { callback.current = onFillSelect }, [onFillSelect])
  useEffect(() => { replayCallback.current = onReplayChange }, [onReplayChange])
  useImperativeHandle(controlRef, () => ({
    play: () => playback.current?.start(), skip: () => playback.current?.skip(),
    selectFill: id => {
      const fill = view.fills.find(item => item.id === id)
      if (!fill) return
      const index = containingBar(view, fill.time)
      if (index === null) return
      setSelected(index)
      api.current?.timeScale().setVisibleLogicalRange({ from: index - 20, to: index + 20 })
      if (series.current) api.current?.setCrosshairPosition(fill.price, view.bars[index].time as UTCTimestamp, series.current)
    },
  }), [view])

  useEffect(() => {
    const node = container.current
    if (!node) return
    if (renderedView.current !== view) { viewport.current = null; renderedView.current = view }
    const style = getComputedStyle(node)
    const palette = new Map<string, string>()
    const color = (name: string) => { if (!palette.has(name)) palette.set(name, style.getPropertyValue(name).trim()); return palette.get(name)! }
    let chart: IChartApi | undefined, observer: ResizeObserver | undefined
    let pointerFrame = 0, resizeFrame = 0, replayTimer = 0, disposed = false
    try {
      chart = createChart(node, {
        autoSize: false, width: node.clientWidth, height: node.clientHeight,
        layout: { background: { type: ColorType.Solid, color: color('--cp-bg') }, textColor: color('--cp-muted'), fontFamily: style.fontFamily, fontSize: 12, attributionLogo: true, panes: { separatorColor: color('--cp-line'), separatorHoverColor: color('--cp-muted') } },
        grid: { vertLines: { color: color('--cp-line') }, horzLines: { color: color('--cp-line') } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: color('--cp-muted'), style: LineStyle.Dashed, labelBackgroundColor: color('--cp-raised') }, horzLine: { color: color('--cp-muted'), style: LineStyle.Dashed, labelBackgroundColor: color('--cp-raised') } },
        rightPriceScale: { borderColor: color('--cp-line'), minimumWidth: 72 },
        timeScale: { borderColor: color('--cp-line'), timeVisible: true, secondsVisible: view.resolutionSeconds < 60, rightOffset: 3, minBarSpacing: .08, lockVisibleTimeRangeOnResize: true },
        localization: { locale: 'ko-KR', timeFormatter: (time: Time) => utc(Number(time)) },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      })
      api.current = chart
      const fit = () => {
        const padding = Math.ceil(view.bars.length * 48 / Math.max(100, node.clientWidth - 168))
        chart?.timeScale().setVisibleLogicalRange({ from: -padding, to: view.bars.length - 1 + padding })
      }
      fitView.current = fit
      const candles = chart.addSeries(CandlestickSeries, { upColor: color('--cp-up'), downColor: color('--cp-down'), borderUpColor: color('--cp-up'), borderDownColor: color('--cp-down'), wickUpColor: color('--cp-up'), wickDownColor: color('--cp-down'), priceLineStyle: LineStyle.Dashed, priceFormat: { type: 'price', precision: view.pricePrecision, minMove: 10 ** -view.pricePrecision } })
      series.current = candles
      const candleData = view.bars.map(item => ({ ...item, time: item.time as UTCTimestamp }))
      candles.setData(candleData)
      const indicatorSeries: { api: ISeriesApi<'Line'>; data: { time: UTCTimestamp; value: number }[] }[] = []
      let volumeSeries: ISeriesApi<'Histogram'> | undefined
      const volumeData = view.bars.map(item => ({ time: item.time as UTCTimestamp, value: item.volume, color: color(item.close >= item.open ? '--cp-volume-up' : '--cp-volume-down') }))
      for (const period of [20, 50]) {
        const line = chart.addSeries(LineSeries, { visible: false, color: color(period === 20 ? '--cp-accent' : '--cp-muted'), lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, title: `EMA ${period}`, priceFormat: { type: 'price', precision: view.pricePrecision, minMove: 10 ** -view.pricePrecision } })
        const data = chartEma(view.bars, period).map(item => ({ ...item, time: item.time as UTCTimestamp }))
        line.setData(data)
        indicatorSeries.push({ api: line, data })
      }
      controls.current = (nextScale, showEma, showVolume) => {
        candles.priceScale().applyOptions({ mode: nextScale === 'log' ? PriceScaleMode.Logarithmic : nextScale === 'percent' ? PriceScaleMode.Percentage : PriceScaleMode.Normal })
        indicatorSeries.forEach(item => item.api.applyOptions({ visible: showEma }))
        if (showVolume && !volumeSeries) {
          volumeSeries = chart!.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false }, 1)
          volumeSeries.setData(volumeData); chart!.panes()[1]?.setHeight(80)
        } else if (!showVolume && volumeSeries) { chart!.removeSeries(volumeSeries); volumeSeries = undefined }
      }
      const markerFills = new Map(groups.map(group => [group.id, group.fills]))
      const markers = groups.map(({ time, id, side, fills: matches }) => ({ time: time as UTCTimestamp, id,
          position: side === 'BUY' ? 'belowBar' as const : 'aboveBar' as const,
          color: color(side === 'BUY' ? '--cp-up' : '--cp-down'),
          shape: side === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const,
          text: matches.length === 1 ? side : `${side} ×${matches.length}` }))
      const markerPlugin = createSeriesMarkers(candles, markers, { zOrder: 'top' })
      const orderedFills = view.fills.filter(fill => containingBar(view, fill.time) !== null).slice().sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
      let shown = view.bars.length, playing = false
      const finish = () => {
        clearInterval(replayTimer); playing = false
        chart?.applyOptions({ handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, handleScale: true, crosshair: { mode: CrosshairMode.Normal } })
        candles.setData(candleData); volumeSeries?.setData(volumeData)
        indicatorSeries.forEach(item => item.api.setData(item.data))
        markerPlugin.setMarkers(markers)
        shown = view.bars.length; setReplay(null); setSelected(null)
        replayCallback.current?.(false)
      }
      playback.current = { skip: finish, start: () => {
        if (playing) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); setInspection('모션 줄이기 설정에 따라 전체 결과를 바로 표시했습니다.'); return }
        playing = true; shown = 0
        chart?.applyOptions({ handleScroll: false, handleScale: false, crosshair: { mode: CrosshairMode.Hidden } })
        const start = Date.now()
        const padding = Math.ceil(view.bars.length * 48 / Math.max(100, node.clientWidth - 168))
        const replayRange = { from: -padding, to: view.bars.length - 1 + padding }
        let seenFills = 0, latest: PriceFill | null = null
        candles.setData([]); volumeSeries?.setData([])
        indicatorSeries.forEach(item => item.api.setData([])); markerPlugin.setMarkers([])
        fit()
        setSelected(null); setReplay({ progress: 0, fill: null })
        replayCallback.current?.(true)
        const tick = () => {
          if (!playing || disposed) return
          const progress = Math.min(1, Math.max(0, (Date.now() - start) / 60_000))
          if (progress >= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }
          const count = Math.max(1, Math.floor(progress * view.bars.length))
          while (shown < count) {
            candles.update(candleData[shown]); volumeSeries?.update(volumeData[shown])
            indicatorSeries.forEach(item => item.api.update(item.data[shown])); shown++
          }
          // Empty-series resets and auto-scroll must not push early fills offscreen.
          // Locked replay range uses cached bounds; no layout read per tick.
          chart?.timeScale().setVisibleLogicalRange(replayRange)
          const through = view.bars[count - 1].time + view.resolutionSeconds
          const before = seenFills
          while (seenFills < orderedFills.length && orderedFills[seenFills].time < through) latest = orderedFills[seenFills++]
          if (before !== seenFills) markerPlugin.setMarkers(visiblePriceMarkers(markers, through))
          setSelected(count - 1); setReplay({ progress, fill: latest })
        }
        replayTimer = window.setInterval(tick, 100); tick()
      } }
      const indexes = new Map(view.bars.map((item, index) => [item.time, index]))
      const move = (event: MouseEventParams<Time>) => {
        if (playing) return
        if (typeof event.time !== 'number') return
        const index = indexes.get(event.time)
        if (index === undefined) return
        cancelAnimationFrame(pointerFrame)
        pointerFrame = requestAnimationFrame(() => setSelected(index))
      }
      const click = (event: MouseEventParams<Time>) => {
        if (playing) return
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
      observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(() => { if (node.clientWidth > 0 && node.clientHeight > 0) chart?.resize(node.clientWidth, node.clientHeight) })
      })
      observer.observe(node)
      queueMicrotask(() => { if (!disposed) {
        setFailed(false); setReplay(null)
        if (initialReplay.current) { initialReplay.current = false; playback.current?.start() }
        else replayCallback.current?.(false)
      } })
    } catch {
      queueMicrotask(() => { if (!disposed) { setFailed(true); setReplay(null); replayCallback.current?.(false) } })
    }
    return () => { disposed = true; clearInterval(replayTimer); playback.current = null; controls.current = null; fitView.current = null; cancelAnimationFrame(pointerFrame); cancelAnimationFrame(resizeFrame); observer?.disconnect(); if (chart) { viewport.current = chart.timeScale().getVisibleLogicalRange(); chart.remove() } api.current = null; series.current = null }
  }, [view, groups, retry])

  useEffect(() => { controls.current?.(scale, ema, volume) }, [scale, ema, volume, view, fillMap, retry])

  const inspect = (index: number) => {
    const next = view.bars[index]; setSelected(index)
    const range = api.current?.timeScale().getVisibleLogicalRange()
    if (range && (index < range.from || index > range.to)) {
      const span = Math.max(10, range.to - range.from)
      api.current?.timeScale().setVisibleLogicalRange({ from: index - span / 2, to: index + span / 2 })
    }
    if (series.current) api.current?.setCrosshairPosition(next.close, next.time as UTCTimestamp, series.current)
    setInspection(`${utc(next.time)} UTC · 시가 ${price(next.open)} · 고가 ${price(next.high)} · 저가 ${price(next.low)} · 종가 ${price(next.close)}`)
  }
  const save = () => {
    if (replay || failed) return
    const chart = api.current?.takeScreenshot(true, false)
    if (!chart) return
    const canvas = document.createElement('canvas')
    canvas.width = chart.width
    const context = canvas.getContext('2d')
    if (!context) return
    const font = '14px sans-serif'
    context.font = font
    const lines: string[] = []
    for (const text of [`TETH · ${view.market} · ${priceResolutionLabel(view.resolutionSeconds)}`, view.sourceLabel, `${utc(view.bars[0].time)} — ${utc(view.bars.at(-1)!.time)} UTC · 현재 조회 화면`]) {
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
  return <section className="cp-chart" aria-label={`${view.market} 백테스트 가격 차트`} data-replaying={Boolean(replay)}>
    <header className="cp-toolbar"><strong>{view.market}</strong><span>{priceResolutionLabel(view.resolutionSeconds)} 표시</span><span className="cp-source">{view.sourceLabel}</span><button type="button" aria-label="차트 전체 맞춤" disabled={failed} onClick={() => fitView.current?.()}><Maximize2 size={16} /></button><button type="button" aria-label="차트 이미지 저장" disabled={failed || Boolean(replay)} onClick={save}><Camera size={16} /></button></header>
    <dl className="cp-quote" aria-label="조회 캔들"><div><dt>UTC</dt><dd>{utc(bar.time)}</dd></div>{(['open', 'high', 'low', 'close', 'volume'] as const).map((key, i) => <div key={key}><dt>{['O', 'H', 'L', 'C', 'V'][i]}</dt><dd>{price(bar[key])}</dd></div>)}</dl>
    <div className="cp-controls"><div role="group" aria-label="가격 눈금">{(['normal', 'log', 'percent'] as const).map((mode, i) => <button key={mode} type="button" disabled={Boolean(replay)} aria-pressed={scale === mode} onClick={() => setScale(mode)}>{['일반', '로그', '%'][i]}</button>)}</div><button type="button" disabled={Boolean(replay)} aria-pressed={ema} onClick={() => setEma(!ema)}>EMA 20·50</button><button type="button" disabled={Boolean(replay)} aria-pressed={volume} onClick={() => setVolume(!volume)}>거래량</button>{(!replay || !externalSkip) && <button type="button" disabled={failed} onClick={() => replay ? playback.current?.skip() : playback.current?.start()}>{replay ? 'Skip · 결과 보기' : '체결 순서 재생'}</button>}</div>
    <div className="cp-canvas">
    {replay && <div className="cp-replay"><progress max={1} value={replay.progress} aria-label="결과 설명 재생" /><span>완료된 결과 재생 · 지표 변경은 Skip 후 가능합니다</span>{replay.fill && <p key={replay.fill.id} className="cp-execution"><b>{replay.fill.side}</b><span>{price(replay.fill.price)}</span><small>{utc(replay.fill.time)} UTC</small></p>}</div>}
    <div className="cp-surface" ref={container} role="group" tabIndex={0} aria-label="가격 캔들 및 BUY·SELL 체결. 방향키로 캔들을 조회합니다." onKeyDown={event => {
      if (replay) return
      const current = selected ?? view.bars.length - 1
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        inspect(event.key === 'Home' ? 0 : event.key === 'End' ? view.bars.length - 1 : Math.max(0, Math.min(view.bars.length - 1, current + (event.key === 'ArrowLeft' ? -1 : 1))))
      }
    }} />
    </div>
    <p className="cp-sr-only" role="status" aria-atomic="true">{inspection}</p>
    {failed && <div className="cp-failure" role="alert"><p>차트를 표시하지 못했습니다. 데이터를 바꾸지 않고 다시 시도할 수 있습니다.</p><button type="button" onClick={() => setRetry(value => value + 1)}>차트 다시 표시</button></div>}
    <footer className="cp-footer"><span>BUY 매수 · SELL 매도</span><span>{view.bars.length.toLocaleString('ko-KR')}개 봉 · UTC</span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Lightweight Charts™</a></footer>
    {ema && <p className="cp-note">EMA는 현재 조회 구간의 종가로 계산한 보조선입니다. 전략의 진입 신호가 아닙니다.</p>}
    {unplacedCount > 0 && <p className="cp-note" role="status">현재 가격 봉에 연결할 수 없는 체결 {unplacedCount.toLocaleString('ko-KR')}건은 마커로 표시하지 않았습니다.</p>}
    {showBarFills && !replay && fills.length > 0 && <FillRows key={bar.time} fills={fills} onSelect={onFillSelect} />}
  </section>
}

function FillRows({ fills, onSelect }: { fills: readonly PriceFill[]; onSelect?: Props['onFillSelect'] }) {
  const [limit, setLimit] = useState(50)
  return <div className="cp-fills" aria-label="조회 구간 체결">{fills.slice(0, limit).map(fill => <button type="button" key={fill.id} onClick={() => onSelect?.(fill)}><b>{fill.side}</b><span>{utc(fill.time)} UTC</span><span>{price(fill.price)}</span><small>{fill.tradeId}</small></button>)}{limit < fills.length && <button type="button" onClick={() => setLimit(value => value + 50)}>체결 더 보기 ({limit}/{fills.length})</button>}</div>
}
