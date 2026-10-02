import { useId, useMemo } from 'react'
import { commonMonths, commonYears } from '../client-common-months'
import { commonBacktestText } from '../client-common-backtest-copy'
import { commonMonthsShortText } from '../client-common-months-copy'
import { useClientPreferences } from '../client-preferences'

export default function ClientCommonMonths({ points, capital }: { points: readonly { i: number; value: number }[]; capital: number }) {
  const { language } = useClientPreferences()
  const id = useId()
  const months = useMemo(() => commonMonths(points, capital), [points, capital])
  const full = months.filter(month => !month.partial)
  const years = useMemo(() => commonYears(months), [months])
  const t = (key: Parameters<typeof commonBacktestText>[1]) => commonBacktestText(language, key)
  const pct = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: 'exceptZero' })
  const zeroPct = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 })
  const dateLabel = new Intl.DateTimeFormat(language, { month: 'short' })
  const fullDateLabel = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric' })
  const value = (n: number) => Math.abs(n) >= .05 ? pct.format(n / 100) : zeroPct.format(0)
  const tone = (n: number) => n >= .05 ? 'up' : n <= -.05 ? 'down' : ''
  const short = commonMonthsShortText(language)
  // The display branch follows the source; compound the existing observations
  // without altering commonMonths or rounding the underlying monthly values.
  const total = (months.reduce((growth, month) => growth * (1 + month.returnPct / 100), 1) - 1) * 100
  if (full.length === 0) return <section className="cbt-evidence cbt-monthly" role="region" aria-labelledby={id}>
    <header><h3 id={id}>{t('months')}</h3></header>
    {months.length > 0 ? <p className="cbt-month-short">{short.before}<b className={tone(total)}>{pct.format(total / 100)}</b>{short.after}</p> : <p>{t('noMonth')}</p>}
  </section>
  return <section className="cbt-evidence cbt-monthly" role="region" aria-labelledby={id}>
    <header><h3 id={id}>{t('months')}</h3><span>{full.length < 3 ? short.partial : t('monthSummary').replace('{total}', full.length.toLocaleString(language)).replace('{up}', full.filter(month => month.returnPct >= .05).length.toLocaleString(language))}</span></header>
    <div className="cbt-month-scroll" role="group" aria-labelledby={id} tabIndex={0}>
      <table className="cbt-month-table" aria-labelledby={id}>
        <thead><tr><th scope="col">{t('year')}</th>{Array.from({ length: 12 }, (_, index) => <th scope="col" key={index}>{dateLabel.format(new Date(2024, index, 1))}</th>)}<th scope="col">{t('annual')}</th></tr></thead>
        <tbody>{years.map(year => <tr key={year.year}><th scope="row">{year.year}</th>{Array.from({ length: 12 }, (_, index) => {
          const key = `${year.year}-${String(index + 1).padStart(2, '0')}`, month = year.months.find(month => month.month === key)
          const label = fullDateLabel.format(new Date(Number(year.year), index, 1))
          return <td key={key} data-month={key} data-partial={month?.partial} className={!month ? 'empty' : month.returnPct >= .05 ? 'up' : month.returnPct <= -.05 ? 'down' : ''}
            aria-label={`${label}: ${month ? `${value(month.returnPct)}${month.partial ? `, ${t('partial')}` : ''}` : t('noMonth')}`}>
            {month ? <>{value(month.returnPct)}{month.partial && <small>{t('partial')}</small>}</> : '—'}
          </td>
        })}<td className="cbt-month-annual" data-year={year.year} data-partial={year.partial}>{value(year.returnPct)}{year.partial && <small>{t('partial')}</small>}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="cbt-month-cards">{years.map(year => <section key={year.year} aria-labelledby={`${id}-${year.year}`}>
      <header><h4 id={`${id}-${year.year}`}>{year.year}</h4><span className={tone(year.returnPct)} data-year={year.year} data-partial={year.partial} aria-label={`${t('annual')}: ${value(year.returnPct)}${year.partial ? `, ${t('partial')}` : ''}`}>{value(year.returnPct)}{year.partial && <small>{t('partial')}</small>}</span></header>
      <dl>{Array.from({ length: 12 }, (_, index) => {
        const key = `${year.year}-${String(index + 1).padStart(2, '0')}`, month = year.months.find(item => item.month === key)
        const label = fullDateLabel.format(new Date(Number(year.year), index, 1))
        return <div key={key} data-month={key} data-partial={month?.partial} className={month ? tone(month.returnPct) : 'empty'}>
          <dt>{dateLabel.format(new Date(Number(year.year), index, 1))}</dt>
          <dd aria-label={`${label}: ${month ? `${value(month.returnPct)}${month.partial ? `, ${t('partial')}` : ''}` : t('noMonth')}`}>{month ? <>{value(month.returnPct)}{month.partial && <small>{t('partial')}</small>}</> : '—'}</dd>
        </div>
      })}</dl>
    </section>)}</div>
  </section>
}
