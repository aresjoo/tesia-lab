import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowUp, ChevronLeft, ChevronRight, Crosshair, Maximize2, MessageSquare, Play, X } from 'lucide-react'
import { ColorType, CrosshairMode, HistogramSeries, LineSeries, LineType, createChart, createSeriesMarkers, type IChartApi, type ISeriesMarkersPluginApi, type LogicalRange, type Time, type UTCTimestamp } from 'lightweight-charts'
import { ClientLogo } from './ClientChrome'
import { researchPercent as pct } from '../client-research-fixtures'
import { RESEARCH_LAST_BAR, researchBarLabel, researchExitLabel, researchIndex, researchPriceAt, researchTime, researchVersion, type ResearchAnalysisView, type ResearchVersion } from '../client-research-analysis'
import '../client-research-analysis.css'

type Props = {
  version: ResearchVersion
  originTitle: string
  view: ResearchAnalysisView
  onViewChange: (view: ResearchAnalysisView) => void
  onClose: () => void
  draft: string
  onDraftChange: (text: string) => void
  thread: ReactNode
  onAsk: (question: string, reference: string) => void
}

export function ClientResearchAnalysis({ version, originTitle, view, onViewChange, onClose, draft, onDraftChange, thread, onAsk }: Props) {
  const result = researchVersion(version)
  const container = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const markerApi = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const root = useRef<HTMLElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const threadEnd = useRef<HTMLDivElement>(null)
  const currentView = useRef(view)
  const viewCallback = useRef(onViewChange)
  const selectionCallback = useRef<(index: number) => void>(() => {})
  const [selected, setSelected] = useState<number | null>(view.selected)
  const [mode, setMode] = useState<'price' | 'equity'>('price')
  const [mobilePanel, setMobilePanel] = useState<'chart' | 'chat'>('chart')
  const [playing, setPlaying] = useState(() => !view.replaySeen && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [progress, setProgress] = useState(0)
  const [execution, setExecution] = useState<number | null>(null)
  const [quote, setQuote] = useState<{ index: number; value: number } | null>(null)
  const [chartFailed, setChartFailed] = useState(false)
  const selectedTrade = selected === null ? null : result.trades[selected]
  const reference = selectedTrade ? `Backtest v${version + 1} · 거래 ${selected! + 1} · ${researchBarLabel(selectedTrade.entry)} 매수 → ${researchBarLabel(selectedTrade.exit)} 매도 · ${pct(selectedTrade.pnl * 100)}` : ''
  useLayoutEffect(() => { viewCallback.current = onViewChange }, [onViewChange])
  const updateView = (patch: Partial<ResearchAnalysisView>) => {
    currentView.current = { ...currentView.current, ...patch }
    viewCallback.current(currentView.current)
  }
  const finishReplay = () => { setPlaying(false); setExecution(null); updateView({ replaySeen: true }) }
  const chooseTrade = (index: number) => {
    const trade = result.trades[index]
    if (!trade) return
    setSelected(index); updateView({ selected: index })
    chart.current?.timeScale().setVisibleRange({ from: researchTime(Math.max(0, trade.entry - 28)) as UTCTimestamp, to: researchTime(Math.min(RESEARCH_LAST_BAR, trade.exit + 28)) as UTCTimestamp })
  }
  useLayoutEffect(() => { selectionCallback.current = chooseTrade })
  useEffect(() => {
    root.current?.focus({ preventScroll: true })
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => { if (media.matches) { setPlaying(false); currentView.current = { ...currentView.current, replaySeen: true }; viewCallback.current(currentView.current) } }
    media.addEventListener('change', reduce)
    return () => media.removeEventListener('change', reduce)
  }, [])
  useLayoutEffect(() => {
    if (!field.current) return
    field.current.style.height = 'auto'
    field.current.style.height = `${Math.min(132, Math.max(40, field.current.scrollHeight))}px`
  }, [draft, mobilePanel, playing])

  useEffect(() => {
    const node = container.current
    if (!node) return
    const style = getComputedStyle(node)
    const color = (token: string) => style.getPropertyValue(token).trim()
    const text = color('--gt2'), up = color('--gg'), down = color('--gr'), accent = color('--gb2')
    const formatTime = (time: Time) => researchBarLabel(researchIndex(Number(time)))
    let disposed = false, frame = 0, readyFrame = 0, resizeFrame = 0
    let observer: ResizeObserver | null = null
    let removeChart = () => {}
    let detachRange = () => {}
    const cleanup = () => {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(readyFrame); cancelAnimationFrame(resizeFrame)
      observer?.disconnect()
      detachRange(); removeChart(); chart.current = null; markerApi.current = null
    }
    try {
      let width = node.clientWidth, height = node.clientHeight
      const api = createChart(node, {
        autoSize: false, width, height,
        layout: { background: { type: ColorType.Solid, color: color('--g0') }, textColor: text, fontFamily: style.fontFamily, fontSize: 12, attributionLogo: true, panes: { separatorColor: color('--gl'), separatorHoverColor: color('--g3'), enableResize: false } },
        grid: { vertLines: { color: color('--gl') }, horzLines: { color: color('--gl') } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { visible: !playing, labelVisible: !playing, color: text, labelBackgroundColor: color('--g3') }, horzLine: { visible: !playing, labelVisible: !playing, color: text, labelBackgroundColor: color('--g3') } },
        rightPriceScale: { borderColor: color('--gl'), minimumWidth: 65 },
        timeScale: { borderColor: color('--gl'), rightOffset: 5, minBarSpacing: .1, lockVisibleTimeRangeOnResize: true, tickMarkFormatter: formatTime },
        localization: { locale: 'ko-KR', timeFormatter: formatTime },
        handleScroll: playing ? false : { vertTouchDrag: false }, handleScale: !playing,
      })
      removeChart = () => api.remove()
      // autoSize repaints synchronously inside ResizeObserver delivery. Defer
      // canvas/layout writes to the next frame so nested canvas observers can
      // finish delivery without a resize loop. Keep the last size while hidden.
      observer = new ResizeObserver(() => {
        if (disposed || resizeFrame) return
        resizeFrame = requestAnimationFrame(() => {
          resizeFrame = 0
          if (disposed) return
          const nextWidth = node.clientWidth, nextHeight = node.clientHeight
          if (nextWidth <= 0 || nextHeight <= 0 || (nextWidth === width && nextHeight === height)) return
          width = nextWidth; height = nextHeight
          api.resize(width, height)
        })
      })
      observer.observe(node)
      readyFrame = requestAnimationFrame(() => setChartFailed(false))
      chart.current = api
      const series = api.addSeries(LineSeries, {
        color: mode === 'price' ? color('--gt') : accent, lineWidth: 2,
        lineType: mode === 'equity' ? LineType.WithSteps : LineType.Simple,
        priceLineVisible: false, lastValueVisible: true,
        crosshairMarkerVisible: !playing,
        priceFormat: mode === 'equity' ? { type: 'percent', precision: 1, minMove: .1 } : { type: 'price', precision: 2, minMove: .01 },
      })
      const pnl = api.addSeries(HistogramSeries, { priceFormat: { type: 'percent', precision: 1, minMove: .1 }, priceLineVisible: false, lastValueVisible: false }, 1)
      api.panes()[1]?.setHeight(84)
      const exits = new Map<number, number>(result.trades.map((trade, index) => [trade.exit, index]))
      const equity = new Map<number, number>(result.eq.map(point => [point.i, (point.v - 1) * 100]))
      let eqValue = 0
      const data = Array.from({ length: RESEARCH_LAST_BAR + 1 }, (_, index) => {
        if (equity.has(index)) eqValue = equity.get(index)!
        const value = mode === 'equity' ? eqValue : researchPriceAt.get(index)
        return value === undefined ? { time: researchTime(index) as UTCTimestamp } : { time: researchTime(index) as UTCTimestamp, value }
      })
      const histogram = data.map((point, index) => {
        const tradeIndex = exits.get(index)
        const trade = tradeIndex === undefined ? null : result.trades[tradeIndex]
        return trade ? { time: point.time, value: trade.pnl * 100, color: trade.pnl >= 0 ? up : down } : { time: point.time }
      })
      if (playing) {
        const prices = data.flatMap(point => point.value === undefined ? [] : [point.value])
        const profits = [0, ...result.trades.map(trade => trade.pnl * 100)]
        series.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: Math.min(...prices), maxValue: Math.max(...prices) } }) })
        pnl.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: Math.min(...profits), maxValue: Math.max(...profits) } }) })
      }
      const markers = result.trades.flatMap((trade, index) => [
        { time: researchTime(trade.entry) as UTCTimestamp, position: 'belowBar' as const, color: up, shape: 'arrowUp' as const, id: `trade-${index}`, text: 'BUY' },
        { time: researchTime(trade.exit) as UTCTimestamp, position: 'aboveBar' as const, color: trade.pnl >= 0 ? up : down, shape: 'arrowDown' as const, id: `trade-${index}`, text: 'SELL' },
      ]).sort((a, b) => a.time - b.time)
      const marker = createSeriesMarkers(series, [], { zOrder: 'top' })
      removeChart = () => { marker.detach(); api.remove() }
      markerApi.current = marker
      const paintMarkers = (end = RESEARCH_LAST_BAR) => {
        const lastLabel = { aboveBar: -Infinity, belowBar: -Infinity }
        marker.setMarkers(markers.filter(item => item.time <= researchTime(end)).map(item => {
          const x = api.timeScale().timeToCoordinate(item.time)
          const visible = x !== null && x >= 0 && x - lastLabel[item.position] >= 44
          if (visible) lastLabel[item.position] = x
          return { ...item, text: visible ? item.text : '' }
        }))
      }
      let lastPaint = 0, lastExecution = -1
      const start = performance.now()
      let hydrated = false
      const onRange = (range: LogicalRange | null) => {
        if (!hydrated || playing || !range || node.clientWidth <= 0 || !Number.isFinite(range.from) || !Number.isFinite(range.to) || range.to <= range.from) return
        paintMarkers()
        currentView.current = { ...currentView.current, range: { from: range.from, to: range.to } }
        viewCallback.current(currentView.current)
      }
      const showThrough = (end: number) => {
        // Keep every ordinal slot, including unseen bars, so playback cannot
        // compress the remaining range into a single future whitespace point.
        series.setData(data.map((point, index) => index <= end ? point : { time: point.time }))
        pnl.setData(histogram.map((point, index) => index <= end ? point : { time: point.time }))
        paintMarkers(end)
      }
      if (!playing) {
        series.setData(data); pnl.setData(histogram)
        if (currentView.current.range) api.timeScale().setVisibleLogicalRange(currentView.current.range)
        else api.timeScale().fitContent()
        paintMarkers()
        currentView.current = { ...currentView.current, replaySeen: true }
        viewCallback.current(currentView.current)
        hydrated = true
      } else {
        // Fixed client-source result playback, never a backtest execution clock.
        currentView.current = { ...currentView.current, replaySeen: true }
        viewCallback.current(currentView.current)
        showThrough(0)
        api.timeScale().setVisibleRange({ from: researchTime(0) as UTCTimestamp, to: researchTime(RESEARCH_LAST_BAR) as UTCTimestamp })
        const draw = (now: number) => {
          if (disposed) return
          if (now - lastPaint >= 80 && !document.hidden) {
            lastPaint = now
            const ratio = Math.min(1, (now - start) / 16000)
            const end = Math.floor(RESEARCH_LAST_BAR * ratio)
            showThrough(end)
            api.timeScale().setVisibleRange({ from: researchTime(0) as UTCTimestamp, to: researchTime(RESEARCH_LAST_BAR) as UTCTimestamp })
            setProgress(Math.floor(ratio * 100))
            let index = -1
            result.trades.forEach((trade, tradeIndex) => { if (trade.exit <= end) index = tradeIndex })
            if (index !== lastExecution) { lastExecution = index; setExecution(index >= 0 ? index : null) }
            if (ratio >= 1) {
              currentView.current = { ...currentView.current, replaySeen: true }
              viewCallback.current(currentView.current); setPlaying(false); setExecution(null)
              return
            }
          }
          frame = requestAnimationFrame(draw)
        }
        frame = requestAnimationFrame(draw)
      }
      api.timeScale().subscribeVisibleLogicalRangeChange(onRange)
      detachRange = () => api.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      api.subscribeClick(event => {
        if (playing) return
        const id = event.hoveredObjectId
        if (typeof id === 'string' && /^trade-\d+$/.test(id)) selectionCallback.current(Number(id.slice(6)))
      })
      api.subscribeCrosshairMove(event => {
        if (playing) return
        if (event.time === undefined) { setQuote(null); return }
        const point = event.seriesData.get(series)
        if (point && 'value' in point) setQuote({ index: researchIndex(Number(event.time)), value: point.value })
      })
      return cleanup
    } catch {
      // Series/marker initialization can fail after createChart has already
      // installed observers. Dispose that partial chart before showing recovery.
      cleanup(); node.replaceChildren()
      const failureFrame = requestAnimationFrame(() => { setChartFailed(true); setPlaying(false) })
      return () => cancelAnimationFrame(failureFrame)
    }
  }, [version, result, mode, playing])

  const submit = () => {
    if (!draft.trim()) return
    onAsk(draft, reference)
    requestAnimationFrame(() => threadEnd.current?.scrollIntoView({ block: 'nearest' }))
  }
  return <section ref={root} tabIndex={-1} className={`ra-analysis ${playing ? 'is-replaying' : ''}`} data-panel={mobilePanel} data-version={version + 1} aria-label={`Backtest v${version + 1} 차트 분석`}
    onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing && !(event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); if (playing) finishReplay(); else onClose() } }}>
    <header className="ra-header">
      <button type="button" className="g-btn-t ra-return" onClick={onClose}><ArrowLeft size={16} /><span>{originTitle}로 돌아가기</span></button>
      <span className="ra-identity">Backtest v{version + 1}<small>BTC/USDT · Research</small></span>
      {playing ? <button type="button" className="g-btn-s g-btn" onClick={finishReplay} aria-label="결과 재생 건너뛰기">Skip</button> : <button type="button" className="g-btn-t" onClick={() => { setMode('price'); setQuote(null); setProgress(0); setPlaying(true) }}><Play size={14} />거래 재생</button>}
    </header>
    {playing && <div className="ra-replay-progress" role="progressbar" aria-label="결과 재생" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{ transform: `scaleX(${progress / 100})` }} /></div>}
    <nav className="ra-mobile-nav" aria-label="분석 화면 선택"><button type="button" aria-pressed={mobilePanel === 'chart'} onClick={() => setMobilePanel('chart')}>차트·거래</button><button type="button" aria-pressed={mobilePanel === 'chat'} onClick={() => setMobilePanel('chat')}>대화 이어가기</button></nav>
    <div className="ra-layout">
      <div className="ra-market">
        <div className="ra-toolbar"><div role="group" aria-label="차트 표시"><button type="button" aria-pressed={mode === 'price'} disabled={playing} onClick={() => { setMode('price'); setQuote(null) }}>가격</button><button type="button" aria-pressed={mode === 'equity'} disabled={playing} onClick={() => { setMode('equity'); setQuote(null) }}>자산 곡선</button></div><span className="ra-quote">{quote ? <>{researchBarLabel(quote.index)} <b>{mode === 'price' ? `$${quote.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : pct(quote.value)}</b></> : '가격 표본 · 봉 번호 기준'}</span><button type="button" aria-label="전체 구간 보기" disabled={playing} onClick={() => chart.current?.timeScale().fitContent()}><Maximize2 size={15} /></button></div>
        <div className="ra-chart-shell">
          <div ref={container} className="ra-chart" role="img" aria-hidden={chartFailed || undefined} aria-label={`Backtest v${version + 1} ${mode === 'price' ? '가격 표본과 거래 시점' : '자산 곡선'} 및 거래 손익 차트`} />
          <span className="ra-pnl-label">거래 손익 (%)</span>
          {playing && execution !== null && <div key={execution} className={`ra-execution ${result.trades[execution].pnl < 0 ? 'loss' : ''}`} data-component="executionToast"><span>SELL · 거래 {execution + 1}</span><strong>{pct(result.trades[execution].pnl * 100)}</strong><small>{researchExitLabel(result.trades[execution].kind)}</small></div>}
          {chartFailed && <div className="ra-chart-failure" role="alert">차트를 표시하지 못했습니다. 아래 거래 기록과 문서로 확인할 수 있습니다.</div>}
        </div>
        <div className="ra-caption"><span><i />BUY 매수 <i className="sell" />SELL 매도</span><span>문서와 동일한 가격 표본 · OHLC/거래량 미제공</span></div>
        <div className="ra-results">
          <dl className="ra-metrics">{[['수익률', pct(result.ret)], ['최대 낙폭', pct(result.mdd)], ['승률', `${result.winRate.toFixed(1)}%`], ['거래', `${result.n}회`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={label === '수익률' ? 'up' : label === '최대 낙폭' ? 'down' : ''}>{value}</dd></div>)}</dl>
          <div className="ra-ledger-heading"><h3>거래 기록 <span>{result.n}</span></h3><div><button type="button" aria-label="이전 거래" disabled={selected === null || selected === 0} onClick={() => chooseTrade(selected! - 1)}><ChevronLeft size={16} /></button><button type="button" aria-label="다음 거래" disabled={selected === result.trades.length - 1} onClick={() => chooseTrade(selected === null ? 0 : selected + 1)}><ChevronRight size={16} /></button></div></div>
          {selectedTrade && <button className="ra-discuss" type="button" onClick={() => { setMobilePanel('chat'); requestAnimationFrame(() => field.current?.focus()) }}><MessageSquare size={14} />거래 {selected! + 1}에 질문하기<ArrowUp size={14} /></button>}
          <div className="ra-ledger" role="group" aria-label="거래 선택"><div className="ra-ledger-labels"><span>거래</span><span>매수 지점</span><span>매도 지점</span><span>청산 사유</span><span>손익</span></div>{result.trades.map((trade, index) => <button type="button" key={`${trade.entry}-${index}`} aria-pressed={selected === index} onClick={() => chooseTrade(index)} aria-label={`거래 ${index + 1}, ${researchBarLabel(trade.entry)} 매수, ${researchBarLabel(trade.exit)} 매도, ${researchExitLabel(trade.kind)}, ${pct(trade.pnl * 100)}`}><span>{String(index + 1).padStart(2, '0')}</span><span>{researchBarLabel(trade.entry)}</span><span>{researchBarLabel(trade.exit)}</span><span>{researchExitLabel(trade.kind)}</span><strong className={trade.pnl >= 0 ? 'up' : 'down'}>{pct(trade.pnl * 100)}</strong></button>)}</div>
        </div>
      </div>
      <aside className="ra-conversation" aria-label="연구 대화 이어가기">
        <div className="ra-conversation-heading"><ClientLogo /><strong>TETH</strong><span>{originTitle}</span></div>
        <div className="ra-thread" tabIndex={0} role="region" aria-label={`${originTitle} 대화 기록`}><p className="ra-thread-intro">문서를 읽으며 나누던 대화가 이어집니다. 거래를 선택해 함께 확인하세요.</p>{thread}<div ref={threadEnd} /></div>
        <div className="ra-compose-area">{selectedTrade && <div className="ra-reference"><Crosshair size={14} /><span>거래 {selected! + 1} · {researchExitLabel(selectedTrade.kind)} · {pct(selectedTrade.pnl * 100)}</span><button type="button" aria-label="거래 참고대상 해제" onClick={() => { setSelected(null); updateView({ selected: null }) }}><X size={14} /></button></div>}
          <form className="ra-composer" onSubmit={event => { event.preventDefault(); submit() }}><label className="ra-sr" htmlFor="ra-question">{originTitle}에 질문</label><textarea ref={field} id="ra-question" rows={2} value={draft} placeholder="이 결과에 대해 이어서 물어보세요" onChange={event => onDraftChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit() } }} /><button type="submit" disabled={!draft.trim()} aria-label="차트 질문 보내기"><ArrowUp size={17} /></button></form>
        </div>
      </aside>
    </div>
  </section>
}
