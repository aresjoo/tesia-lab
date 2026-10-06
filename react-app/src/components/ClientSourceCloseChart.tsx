import { useEffect, useRef } from 'react'
import { ColorType, CrosshairMode, LineSeries, createChart, createSeriesMarkers, type UTCTimestamp } from 'lightweight-charts'
import { useClientPreferences } from '../client-preferences'
import { terminalChartLocaleText } from '../client-terminal-chart-locale-copy'

type Point = { time: number; value?: number }
type Mark = { id: string; time: number; side: 'BUY' | 'SELL' }
/** Source preview has closes only. Never invent candle wicks, opens or volume. */
export function ClientSourceCloseChart({ points, markers, label, presentation }: { points: readonly Point[]; markers: readonly Mark[]; label?: string; presentation?: { ariaLabel: string; interval: string; fit: string; note: string; locale: string } }) {
  const { language } = useClientPreferences()
  const t = (source: string) => terminalChartLocaleText(language, source)
  const host = useRef<HTMLDivElement>(null)
  const update = useRef<((items: readonly Mark[]) => void) | null>(null)
  const fit = useRef<(() => void) | null>(null)
  const localize = useRef<((locale: string) => void) | null>(null)
  const locale = presentation?.locale ?? (language === 'ko' ? 'ko-KR' : language)
  useEffect(() => {
    const el = host.current
    if (!el || !points.length) return
    const style = getComputedStyle(el)
    const color = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
    const chart = createChart(el, { width: el.clientWidth, height: 440, layout: { background: { type: ColorType.Solid, color: color('--g0', '#0f1012') }, textColor: color('--gt3', '#9aa0a6'), fontFamily: style.fontFamily },
      grid: { vertLines: { color: color('--gl', '#ffffff12') }, horzLines: { color: color('--gl', '#ffffff12') } },
      // The default 0.5px minimum cannot fit 1,335 closes on a phone.
      crosshair: { mode: CrosshairMode.Normal }, timeScale: { borderColor: color('--gl', '#ffffff12'), minBarSpacing: .02 }, rightPriceScale: { borderColor: color('--gl', '#ffffff12') },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false }, localization: { locale: 'ko-KR' },
    })
    const series = chart.addSeries(LineSeries, { color: color('--gb2', '#5b8af7'), lineWidth: 2, priceLineVisible: false })
    series.setData(points.map(point => ({ ...point, time: point.time as UTCTimestamp })))
    const plugin = createSeriesMarkers(series, [])
    let currentMarkers: readonly Mark[] = []
    const paintMarkers = () => {
      const last = { BUY: -Infinity, SELL: -Infinity }
      plugin.setMarkers(currentMarkers.map(mark => {
        const x = chart.timeScale().timeToCoordinate(mark.time as UTCTimestamp)
        const labelVisible = x !== null && x >= 0 && x <= el.clientWidth && x - last[mark.side] >= 48
        if (labelVisible) last[mark.side] = x
        // Keep every execution arrow. Only overlapping labels are suppressed;
        // zooming reveals them again without changing the underlying trades.
        return { id: mark.id, time: mark.time as UTCTimestamp, position: mark.side === 'BUY' ? 'belowBar' as const : 'aboveBar' as const, shape: mark.side === 'BUY' ? 'arrowUp' as const : 'arrowDown' as const, color: color(mark.side === 'BUY' ? '--gg' : '--gr', mark.side === 'BUY' ? '#56c486' : '#ee766a'), text: labelVisible ? mark.side : '' }
      }))
    }
    update.current = items => { currentMarkers = items; paintMarkers() }
    fit.current = () => chart.timeScale().fitContent()
    localize.current = locale => chart.applyOptions({ localization: { locale } })
    chart.timeScale().fitContent()
    chart.timeScale().subscribeVisibleLogicalRangeChange(paintMarkers)
    let frame = 0
    const resize = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { if (el.clientWidth) { chart.applyOptions({ width: el.clientWidth }); paintMarkers() } }) })
    resize.observe(el)
    return () => { cancelAnimationFrame(frame); resize.disconnect(); chart.timeScale().unsubscribeVisibleLogicalRangeChange(paintMarkers); plugin.detach(); update.current = null; fit.current = null; localize.current = null; chart.remove() }
  }, [points])
  useEffect(() => { update.current?.(markers) }, [markers, points])
  useEffect(() => { localize.current?.(locale) }, [locale, points])
  return <section className="cst-close-chart" aria-label={presentation?.ariaLabel ?? t('원본 합성 종가 차트')} data-first-time={points[0]?.time} data-last-time={points.at(-1)?.time} data-marker-count={markers.length}><header><b>{label ?? t('공통 합성 시계열')}</b><span>{presentation?.interval ?? t('1D · 원본 종가')}</span><button type="button" onClick={() => fit.current?.()}>{presentation?.fit ?? t('전체 구간')}</button></header><div ref={host} /><footer>{presentation?.note ?? t('원본 공통 합성 가격 · 실제 시세 아님 · OHLC·거래량 미제공')}</footer></section>
}
