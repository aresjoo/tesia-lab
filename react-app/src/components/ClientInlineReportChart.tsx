import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusinessDay, MouseEventParams, SeriesMarker, Time } from 'lightweight-charts'
import { useClientPreferences, type ClientLanguage } from '../client-preferences'
import { sourceTerminalDate, sourceTerminalPrices, type SourceTerminalEvaluation } from '../client-terminal-source-fixture'
import { sourceRuleExitPrice } from '../client-terminal-source-ledger'
import '../client-inline-report-chart.css'

type Props = { evaluation: SourceTerminalEvaluation; asset: string }
const invalidCopy: Record<ClientLanguage, string> = { ko: '차트 데이터를 확인할 수 없습니다.', en: 'Chart data is unavailable.', ja: 'チャートデータを確認できません。', 'zh-CN': '无法确认图表数据。', 'zh-TW': '無法確認圖表資料。', es: 'Los datos del gráfico no están disponibles.', fr: 'Les données du graphique sont indisponibles.' }
const copy: Record<ClientLanguage, { chart: string; note: string; trades: string; close: string; fill: string; empty: string; unavailable: string; loading: string; sl: string; tp: string; time: string }> = {
  ko: { chart: '검증 구간 종가와 체결 시점', note: '공통 합성 종가 · 실제 시세 아님. ▲ BUY / ▼ SELL은 최근 40개 완료 거래의 시점입니다. 종가와 규칙 체결가는 다를 수 있습니다.', trades: '완료 거래 상세', close: '당일 종가', fill: '합성 규칙 체결가', empty: '완료된 거래가 없습니다.', unavailable: '차트를 표시할 수 없습니다. 아래 거래 상세를 확인하세요.', loading: '차트 불러오는 중', sl: '손절', tp: '익절', time: '기간 종료' },
  en: { chart: 'Closes and executions in the evaluation window', note: 'Shared synthetic closes, not market prices. ▲ BUY / ▼ SELL mark the latest 40 completed trades. Closes may differ from rule-based fills.', trades: 'Completed trade details', close: 'Daily close', fill: 'Synthetic rule-based fill', empty: 'No completed trades.', unavailable: 'Chart unavailable. See trade details below.', loading: 'Loading chart', sl: 'Stop loss', tp: 'Take profit', time: 'Time exit' },
  ja: { chart: '検証期間の終値と約定時点', note: '共通の合成終値であり、実際の相場ではありません。▲ BUY / ▼ SELLは直近40件の完了取引です。終値とルール上の約定価格は異なる場合があります。', trades: '完了取引の詳細', close: '当日の終値', fill: '合成ルール上の約定価格', empty: '完了した取引はありません。', unavailable: 'チャートを表示できません。以下の取引詳細をご確認ください。', loading: 'チャート読み込み中', sl: '損切り', tp: '利確', time: '期間終了' },
  'zh-CN': { chart: '验证区间收盘价与成交时点', note: '共用合成收盘价，非实际行情。▲ BUY / ▼ SELL表示最近40笔已完成交易。收盘价可能不同于规则成交价。', trades: '已完成交易详情', close: '当日收盘价', fill: '合成规则成交价', empty: '暂无已完成交易。', unavailable: '无法显示图表，请查看下方交易详情。', loading: '正在加载图表', sl: '止损', tp: '止盈', time: '到期退出' },
  'zh-TW': { chart: '驗證區間收盤價與成交時點', note: '共用合成收盤價，非實際行情。▲ BUY / ▼ SELL表示最近40筆已完成交易。收盤價可能不同於規則成交價。', trades: '已完成交易詳情', close: '當日收盤價', fill: '合成規則成交價', empty: '暫無已完成交易。', unavailable: '無法顯示圖表，請查看下方交易詳情。', loading: '正在載入圖表', sl: '停損', tp: '停利', time: '到期退出' },
  es: { chart: 'Cierres y ejecuciones del período evaluado', note: 'Cierres sintéticos compartidos, no cotizaciones reales. ▲ BUY / ▼ SELL señalan las últimas 40 operaciones cerradas. El cierre puede diferir del precio de ejecución por reglas.', trades: 'Detalles de operaciones cerradas', close: 'Cierre diario', fill: 'Ejecución sintética por reglas', empty: 'No hay operaciones cerradas.', unavailable: 'Gráfico no disponible. Consulta los detalles abajo.', loading: 'Cargando gráfico', sl: 'Stop loss', tp: 'Toma de ganancias', time: 'Salida por plazo' },
  fr: { chart: 'Clôtures et exécutions sur la période évaluée', note: 'Clôtures synthétiques partagées, pas des cours réels. ▲ BUY / ▼ SELL indiquent les 40 dernières opérations clôturées. La clôture peut différer du prix d’exécution selon les règles.', trades: 'Détails des opérations clôturées', close: 'Clôture du jour', fill: 'Exécution synthétique selon les règles', empty: 'Aucune opération clôturée.', unavailable: 'Graphique indisponible. Consultez les détails ci-dessous.', loading: 'Chargement du graphique', sl: 'Stop loss', tp: 'Prise de bénéfices', time: 'Sortie à échéance' },
}

function calendar(index: number): BusinessDay {
  const date = sourceTerminalDate(index)
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}
function dayText(day: BusinessDay): string {
  return `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`
}

/** Source gLwMount presentation only: one shared synthetic close series, never
 * market data, OHLC, account fills or execution authority. Open positions are
 * deliberately excluded. SL/TP fills use the engine rule, not the exit close. */
function project(evaluation: SourceTerminalEvaluation) {
  const { startI, endI } = evaluation.r.params
  if (!Number.isSafeInteger(startI) || !Number.isSafeInteger(endI) || startI < 0 || endI < startI || endI >= sourceTerminalPrices.length) return null
  const points = sourceTerminalPrices.slice(startI, endI + 1).map((value, offset) => ({ time: calendar(startI + offset), value: +value.toFixed(2) }))
  const trades = evaluation.trades.slice(-40)
  if (trades.some(trade => !Number.isSafeInteger(trade.entry) || !Number.isSafeInteger(trade.exit) || trade.entry < startI || trade.exit < trade.entry || trade.exit > endI || !['sl', 'tp', 'time'].includes(trade.kind))) return null
  try {
    const completed = trades.map(trade => ({ ...trade, entryDay: dayText(calendar(trade.entry)), exitDay: dayText(calendar(trade.exit)), fill: sourceRuleExitPrice(evaluation.r.params, trade) }))
    if (completed.some(trade => !Number.isFinite(trade.fill))) return null
    const marks = completed.flatMap((trade, n) => [
      { id: `${n}:BUY`, index: trade.entry, side: 'BUY' as const, fill: sourceTerminalPrices[trade.entry], kind: null },
      { id: `${n}:SELL`, index: trade.exit, side: 'SELL' as const, fill: trade.fill, kind: trade.kind },
    ]).sort((a, b) => a.index - b.index)
    return { points, trades: completed, marks, startI, endI, totalTrades: evaluation.trades.length }
  } catch { return null }
}

export default function ClientInlineReportChart({ evaluation, asset }: Props) {
  const { language } = useClientPreferences()
  const text = copy[language]
  const data = useMemo(() => project(evaluation), [evaluation])
  const host = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState<{ data: typeof data; language: ClientLanguage; status: 'ready' | 'error' } | null>(null)
  const [hover, setHover] = useState<{ data: typeof data; index: number } | null>(null)
  const price = useMemo(() => new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [language])
  const status = !data ? 'error' : loaded?.data === data && loaded.language === language ? loaded.status : 'loading'
  const hovered = hover?.data === data ? data?.marks.filter(mark => mark.index === hover.index) ?? [] : []

  useEffect(() => {
    const element = host.current
    if (!element || !data) return
    let cancelled = false
    let dispose: (() => void) | undefined
    // Bundled local dependency: no CDN script or market-data request.
    void import('lightweight-charts').then(({ createChart, ColorType, CrosshairMode, LineSeries, createSeriesMarkers }) => {
      if (cancelled) return
      const style = getComputedStyle(element)
      const color = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
      const chart = createChart(element, {
        width: element.clientWidth, height: 230,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: color('--gt3', '#848a94'), fontSize: 10, fontFamily: style.fontFamily },
        grid: { vertLines: { color: color('--gl', '#ffffff0a') }, horzLines: { color: color('--gl', '#ffffff0a') } },
        rightPriceScale: { borderColor: color('--gl2', '#ffffff1a') },
        timeScale: { borderColor: color('--gl2', '#ffffff1a'), minBarSpacing: .02 },
        crosshair: { mode: CrosshairMode.Normal }, handleScroll: false, handleScale: false,
        localization: { locale: language },
      })
      // Set cleanup immediately, including when series/plugin creation throws.
      dispose = () => chart.remove()
      const series = chart.addSeries(LineSeries, { color: '#8fb2ff', lineWidth: 2, priceLineVisible: false })
      series.setData(data.points)
      const markers = (): SeriesMarker<Time>[] => {
        const lastLabel = { BUY: -Infinity, SELL: -Infinity }
        const plotWidth = Math.max(1, element.clientWidth - 75)
        return data.marks.map(mark => {
          const x = (mark.index - data.startI) / Math.max(1, data.endI - data.startI) * plotWidth
          // Keep every arrow. Only thin colliding text labels; exact fills remain
          // available by crosshair and in the keyboard/touch trade list.
          const show = x - lastLabel[mark.side] >= 36
          if (show) lastLabel[mark.side] = x
          return { id: mark.id, time: calendar(mark.index), position: mark.side === 'BUY' ? 'belowBar' : 'aboveBar',
            shape: mark.side === 'BUY' ? 'arrowUp' : 'arrowDown', color: mark.side === 'BUY' ? '#56c486' : '#ee766a', text: show ? mark.side : '' }
        })
      }
      const plugin = createSeriesMarkers(series, markers())
      const byDay = new Map(data.marks.map(mark => [dayText(calendar(mark.index)), mark.index]))
      const onHover = (event: MouseEventParams) => {
        const time = event.time
        const key = typeof time === 'object' ? dayText(time) : typeof time === 'string' ? time : ''
        const index = event.point && event.point.x >= 0 && event.point.x <= element.clientWidth && event.point.y >= 0 && event.point.y <= 230 ? byDay.get(key) : undefined
        setHover(index === undefined ? null : { data, index })
      }
      chart.subscribeCrosshairMove(onHover)
      chart.timeScale().fitContent()
      const resize = new ResizeObserver(() => {
        if (cancelled || element.clientWidth <= 0) return
        chart.applyOptions({ width: element.clientWidth })
        plugin.setMarkers(markers())
        chart.timeScale().fitContent()
      })
      dispose = () => { resize.disconnect(); chart.unsubscribeCrosshairMove(onHover); plugin.detach(); chart.remove() }
      resize.observe(element)
      setLoaded({ data, language, status: 'ready' })
    }).catch(() => {
      dispose?.()
      dispose = undefined
      if (!cancelled) setLoaded({ data, language, status: 'error' })
    })
    return () => { cancelled = true; dispose?.() }
  }, [data, language])

  return <section className="client-inline-report-chart" aria-label={`${asset} · ${text.chart}`} data-testid="inline-report-chart" data-status={status}
    data-point-count={data?.points.length ?? 0} data-marker-count={data?.marks.length ?? 0} data-trade-count={data?.trades.length ?? 0}
    data-total-trade-count={data?.totalTrades ?? 0} data-start-index={data?.startI} data-end-index={data?.endI}>
    <div className="circ-stage">
      <div className="circ-canvas" ref={host} role="img" aria-label={`${asset} · ${text.chart}`} data-testid="inline-report-chart-canvas" />
      {status !== 'ready' && <p className="circ-status" role="status">{status === 'loading' ? text.loading : data ? text.unavailable : invalidCopy[language]}</p>}
      {hovered.length > 0 && <div className="circ-tooltip" data-testid="inline-report-chart-tooltip">
        <b>{dayText(calendar(hovered[0].index))}</b>
        <span>{text.close}: {price.format(sourceTerminalPrices[hovered[0].index])}</span>
        {hovered.map(mark => <span key={mark.id} className={mark.side === 'BUY' ? 'circ-buy' : 'circ-sell'}>{mark.side}{mark.kind ? ` · ${text[mark.kind]}` : ''}<br />{text.fill}: {price.format(mark.fill)}</span>)}
      </div>}
    </div>
    {data && <p className="circ-note">{text.note.replace('40', String(data.trades.length))}</p>}
    {data && <details className="circ-trades" data-testid="inline-report-chart-trades">
      <summary>{text.trades} · {data.trades.length} / {data.totalTrades}</summary>
      {data.trades.length === 0 ? <p>{text.empty}</p> : <ol>
        {data.trades.slice().reverse().map((trade, index) => <li key={`${trade.entry}:${trade.exit}:${index}`} data-entry-index={trade.entry} data-exit-index={trade.exit}>
          <details>
            <summary><span className="circ-buy">BUY {trade.entryDay}</span><span className="circ-sell">SELL {trade.exitDay} · {text[trade.kind]}</span></summary>
            <dl>
              <div><dt>BUY · {text.close}</dt><dd>{price.format(sourceTerminalPrices[trade.entry])}</dd></div>
              <div><dt>BUY · {text.fill}</dt><dd data-testid="inline-report-entry-fill">{price.format(sourceTerminalPrices[trade.entry])}</dd></div>
              <div><dt>SELL · {text.close}</dt><dd data-testid="inline-report-exit-close">{price.format(sourceTerminalPrices[trade.exit])}</dd></div>
              <div><dt>SELL · {text.fill}</dt><dd data-testid="inline-report-exit-fill">{price.format(trade.fill)}</dd></div>
            </dl>
          </details>
        </li>)}
      </ol>}
    </details>}
  </section>
}
