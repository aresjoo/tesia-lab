import { useId, useMemo, useState, type CSSProperties } from 'react'
import { sourceTerminalDate, sourceTerminalPrices, type SourceTerminalEvaluation } from '../client-terminal-source-fixture'
import { useClientPreferences } from '../client-preferences'
import { sharedPerformanceCopy, type SharedPerformanceCopyKey } from '../client-shared-performance-copy'
import { sharedNumber, sharedSigned } from '../client-shared-number-format'
import { sourceRuleExitPrice } from '../client-terminal-source-ledger'
import type { SharingServicePresentation } from '../client-sharing-presentation'
import '../client-shared-performance.css'
import detailCopy from '../client-detail-skin-copy.json'
import type { CataloguePreviewResult } from '../client-catalogue-preview'
import { catalogueDateReader } from '../client-catalogue-presentation'

type Result = SourceTerminalEvaluation['r']
export type ClientSharedPerformanceProps = { result: Result; asset: string; servicePresentation?: SharingServicePresentation; catalogue?: never }
  | { catalogue: CataloguePreviewResult; result?: never; asset?: never; servicePresentation?: never }
const calendarDate = (index: number, indexToDate: (index: number) => Date) => {
  const date = indexToDate(index)
  // A source index denotes a civil day, not an instant to shift across zones.
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}
const holdingBands = [['≤2봉', 0, 2], ['3–5봉', 3, 5], ['6–10봉', 6, 10], ['11–24봉', 11, 24], ['25봉+', 25, 1e9]] as const

/** Source 501053b tfSS3CalHtml/HoldHtml/YearBars and detail's last 12 trades.
 * Supplied synthetic preview only: no account data, current prices or authority.
 * The parent keys this subtree when the strategy/evaluation period changes.
 */
export function ClientSharedPerformance({ result: legacyResult, asset, servicePresentation: service, catalogue }: ClientSharedPerformanceProps) {
  const { language } = useClientPreferences()
  const result = catalogue?.result ?? legacyResult!
  const catalogueDate = useMemo(() => catalogue ? catalogueDateReader(catalogue.calendar) : null, [catalogue])
  const indexToDate = catalogueDate ?? service?.indexToDate ?? sourceTerminalDate
  const signed = (value: number, digits: 0 | 1 | 2) => sharedSigned(value, language, digits)
  const s = (key: SharedPerformanceCopyKey, values?: Record<string, string | number>) => sharedPerformanceCopy(language, key, values)
  const formatters = useMemo(() => ({
    day: new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }),
    month: new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', year: 'numeric', month: 'long' }),
    weekday: new Intl.DateTimeFormat(language, { calendar: 'gregory', timeZone: 'UTC', weekday: 'short' }),
    price: new Intl.NumberFormat(language, { maximumFractionDigits: 0 }),
  }), [language])
  const dateLabel = (index: number) => {
    const date = calendarDate(index, indexToDate)
    return language === 'ko'
      ? `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')}`
      : formatters.day.format(date)
  }
  // The source price series has no quote-currency metadata. Localize grouping only.
  const priceLabel = (value: number) => !Number.isFinite(value) ? '-' : formatters.price.format(Math.round(value))
  const id = useId()
  const [monthOffset, setMonthOffset] = useState(0)
  const calendar = useMemo(() => {
    const days: Record<string, Record<number, number>> = {}
    const eq = result.eq ?? []
    let previous = eq[0]?.v
    for (let index = 1; index < eq.length; index++) {
      const date = indexToDate(eq[index].i)
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`
      const month = days[key] ?? (days[key] = {})
      const change = previous > 0 ? (eq[index].v / previous - 1) * 100 : NaN
      if (Number.isFinite(change)) month[date.getDate()] = (month[date.getDate()] ?? 0) + change
      previous = eq[index].v
    }
    return { days, months: Object.keys(days).sort() }
  }, [result, indexToDate])
  const monthIndex = Math.max(0, Math.min(calendar.months.length - 1, calendar.months.length - 1 + monthOffset))
  const monthKey = calendar.months[monthIndex]
  const [year, month] = monthKey ? monthKey.split('-').map(Number) : [0, 0]
  const monthDays = monthKey ? calendar.days[monthKey] : {}
  const dayCount = monthKey ? new Date(year, month + 1, 0).getDate() : 0
  const leading = monthKey ? new Date(year, month, 1).getDay() : 0
  let monthProduct = 1
  for (let day = 1; day <= dayCount; day++) if (monthDays[day] != null) monthProduct *= 1 + monthDays[day] / 100
  const monthTrades = useMemo(() => {
    if (!monthKey) return []
    const [selectedYear, selectedMonth] = monthKey.split('-').map(Number)
    return result.trades.filter(trade => {
      const date = indexToDate(trade.exit)
      return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth
    })
  }, [result, monthKey, indexToDate])
  const monthWins = monthTrades.filter(trade => trade.pnl > 0).length
  const { bands, maximumBand, averageHold, longestHold, years, maximumYear, recentTrades } = useMemo(() => {
    const bands = holdingBands.map(([label, from, until]) => {
      const trades = result.trades.filter(trade => trade.exit - trade.entry >= from && trade.exit - trade.entry <= until)
      const wins = trades.filter(trade => trade.pnl > 0).length
      return { label, wins, losses: trades.length - wins }
    })
    return {
      bands,
      maximumBand: Math.max(1, ...bands.map(band => band.wins + band.losses)),
      averageHold: result.trades.length ? result.trades.reduce((sum, trade) => sum + trade.exit - trade.entry, 0) / result.trades.length : 0,
      longestHold: result.trades.reduce((longest, trade) => Math.max(longest, trade.exit - trade.entry), 0),
      years: Object.keys(result.byYear ?? {}).sort(),
      maximumYear: Math.max(0, ...Object.values(result.byYear ?? {}).map(value => Math.abs(value.pnl))) || 1,
      recentTrades: legacyResult?.trades.slice(-12).reverse() ?? [],
    }
  }, [result, legacyResult])
  // Preserve the source's 1216×200 geometry. Local scrolling below this width
  // keeps the original 13px labels readable, without changing any values.
  const chartWidth = 1216, chartHeight = 200, mid = chartHeight / 2 - 6
  return <div className="client-shared-performance">
    <section className="tfbk-card" aria-label={s('월별 성과와 보유기간')}><div className="cin ss3-blk">
      {monthKey ? <>
        <div className="ss3-ch shared-calendar-heading">
          <h3 id={`${id}-month`}>
            <button type="button" className="cal-nav" aria-label={s('이전 월')} aria-disabled={monthIndex <= 0} onClick={() => { if (monthIndex > 0) setMonthOffset(monthIndex - 1 - (calendar.months.length - 1)) }}>‹</button>
            <span aria-live="polite">{language === 'ko' ? `${year}년 ${month + 1}월` : formatters.month.format(new Date(Date.UTC(year, month, 1)))}</span>
            <button type="button" className="cal-nav" aria-label={s('다음 월')} aria-disabled={monthIndex >= calendar.months.length - 1} onClick={() => { if (monthIndex < calendar.months.length - 1) setMonthOffset(monthIndex + 1 - (calendar.months.length - 1)) }}>›</button>
          </h3>
          <span className="mt2">{s(monthTrades.length > 0 ? '월 합산 {return}%, 체결 {count}회, 승률 {winRate}%' : '월 합산 {return}%, 체결 {count}회', { return: signed((monthProduct - 1) * 100, 1), count: monthTrades.length, winRate: monthTrades.length ? Math.round(monthWins / monthTrades.length * 100) : 0 })}, {s('검증 시뮬레이션')}</span>
        </div>
        <div className="cal-hd" aria-hidden="true">{Array.from({ length: 7 }, (_, day) => <span key={day}>{formatters.weekday.format(new Date(Date.UTC(2023, 0, 1 + day)))}</span>)}</div>
        <div className="cal-g" role="group" aria-labelledby={`${id}-month`}>
          {Array.from({ length: leading }, (_, index) => <span className="cal-c" key={`blank-${index}`} aria-hidden="true" />)}
          {Array.from({ length: dayCount }, (_, index) => {
            const day = index + 1, value = monthDays[day]
            const dayText = language === 'ko' ? `${year}년 ${month + 1}월 ${day}일` : formatters.day.format(new Date(Date.UTC(year, month, day)))
            const label = `${dayText}, ${value == null ? s('평가 기록 없음') : s('검증 수익 {return}%', { return: signed(value, 2) })}`
            return <span key={`${monthKey}-${day}`} className={`cal-c ${value == null ? 'off' : value >= .005 ? 'u' : value <= -.005 ? 'd' : 'z'}`}
              style={value == null ? undefined : { '--a': Number(Math.min(1, Math.abs(Number(value.toFixed(2))) / 12).toFixed(2)) } as CSSProperties}
              role="img" aria-label={label} tabIndex={value == null ? undefined : 0} title={value == null ? undefined : `${sharedNumber(value, language, 2)}%`}>
              <span aria-hidden="true">{day}{value != null && <i>{signed(value, 1)}%</i>}</span>
              {value != null && <span className="cal-tooltip" aria-hidden="true">{signed(value, 2)}%</span>}
            </span>
          })}
        </div>
        <p className="mt2 shared-calendar-note">{detailCopy[language].calendarNote}</p>
      </> : <p className="mt2">{s('표시할 기간 데이터가 없어요.')}</p>}
      {!catalogue && result.trades.length > 0 && <div className="shared-holding">
        <div className="ss3-ch shared-calendar-heading"><h3>{s('보유기간 분포')}</h3><span className="mt2">{s('평균 {average}봉, 최장 {longest}봉', { average: sharedNumber(averageHold, language), longest: longestHold })}</span></div>
        {bands.map(band => <div className="hold-r" key={band.label}>
          <span className="lb">{s(band.label)}</span><span className="bar" aria-hidden="true">
            {band.wins > 0 && <i className="w" style={{ width: `${band.wins / maximumBand * 100}%` }} />}
            {band.losses > 0 && <i className="l" style={{ width: `${band.losses / maximumBand * 100}%` }} />}
          </span><span className="ct num">{band.wins + band.losses ? s('익 {wins}, 손 {losses}', { wins: band.wins, losses: band.losses }) : '-'}</span>
        </div>)}
        <p className="mt2 shared-holding-legend"><span className="shared-holding-key"><i className="w" aria-hidden="true">■</i> {s('이익 청산')}</span>{' '}<span className="shared-holding-key"><i className="l" aria-hidden="true">■</i> {s('손실 청산')}</span></p>
      </div>}
    </div></section>
    {!catalogue && <section className="tfbk-card" aria-label={s('연도별 손익과 체결 이력')}><div className="cin ss3-blk">
      <div className="ss3-ch"><b>{s('연도별 손익, 체결 이력')}</b><span className="mt2">{s('최근 {count}건, 검증 시뮬레이션 체결', { count: recentTrades.length })}</span></div>
      {years.length > 0 && <div className="shared-year-scroll" role="region" aria-label={s('연도별 검증 손익')} tabIndex={0}>
        <svg className="ss3-bars shared-year-bars" viewBox={`0 0 ${chartWidth} 200`} style={{ minWidth: chartWidth }} role="img" aria-label={years.map(key => s('{year}년 {return}%', { year: key, return: signed(legacyResult!.byYear[key].pnl * 100, 0) })).join(', ')}>
          <line x1="12" y1={mid} x2={chartWidth - 12} y2={mid} />
          {years.map((key, index) => {
            const value = legacyResult!.byYear[key].pnl, height = Math.max(2, Math.abs(value) / maximumYear * (mid - 32))
            const x = 24 + index * ((chartWidth - 48) / years.length) + ((chartWidth - 48) / years.length - 48) / 2
            return <g key={key}><rect className={value >= 0 ? 'up' : 'dn'} x={x} y={value >= 0 ? mid - height : mid} width="48" height={height} rx="4" />
              <text x={x + 24} y="192" textAnchor="middle">{key}</text>
              <text className={value >= 0 ? 'up' : 'dn'} x={x + 24} y={value >= 0 ? mid - height - 8 : mid + height + 16} textAnchor="middle">{signed(value * 100, 0)}%</text>
            </g>
          })}
        </svg>
      </div>}
      <div className="shared-trades-scroll" role="region" aria-label={s('최근 검증 시뮬레이션 체결')} tabIndex={0}>
        <table className="ss3-tbl"><thead><tr>{(['진입일', '청산일', '보유', '자산', '구분', '진입가', '청산가', '손익률'] as const).map((label, index) => <th key={label} scope="col" className={index >= 5 ? 'shared-number' : undefined}>{s(label)}</th>)}</tr></thead>
          <tbody>{recentTrades.length ? recentTrades.map((trade, index) => <tr key={`${trade.entry}:${trade.exit}:${index}`}>
            <td>{dateLabel(trade.entry)}</td><td>{dateLabel(trade.exit)}</td><td>{s('{count}봉', { count: trade.exit - trade.entry })}</td><td>{asset}</td><td>{s(({ sl: '손절', tp: '익절', time: '기간 청산' } as const)[trade.kind])}</td>
            <td className="shared-number">{priceLabel(service ? service.entryPrice?.(trade.entry) ?? NaN : sourceTerminalPrices[trade.entry])}</td><td className="shared-number">{priceLabel(service ? service.exitPrice?.(trade) ?? NaN : sourceRuleExitPrice(legacyResult!.params, trade))}</td><td className={`shared-number ${trade.pnl >= 0 ? 'up' : 'dn'}`}>{signed(trade.pnl * 100, 2)}%</td>
          </tr>) : <tr><td colSpan={8} className="shared-no-trades">{s('이 기간에는 체결이 없어요')}</td></tr>}</tbody>
        </table>
      </div>
    </div></section>}
  </div>
}

export default ClientSharedPerformance
