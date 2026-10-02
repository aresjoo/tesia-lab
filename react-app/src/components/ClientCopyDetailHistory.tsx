import { Fragment, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { copyPreviewConfig, type CopyPreviewCalculation, type CopyPreviewCopy } from '../client-copy-preview-state'
import type { SharedStrategy } from '../client-shared-strategies'
import { sourceTerminalDate, sourceTerminalPrices } from '../client-terminal-source-fixture'
import { copyHistoryText, type CopyHistoryKey } from '../client-copy-history-copy'

export type ClientCopyDetailHistoryProps = {
  tab: 'hist' | 'share' | 'bal' | 'tx'
  copy: CopyPreviewCopy
  calculation: CopyPreviewCalculation
  source: SharedStrategy | null
  now: number
}
function HistoryTable({ title, headers, children }: { title: string; headers: CopyHistoryKey[]; children: ReactNode }) {
  const { language } = useClientPreferences()
  return <div className="cpx-tblw" data-period={headers[0] === 'period'} role="region" aria-label={title} tabIndex={0}>
    <table className="cpx-tbl"><caption className="sr-only">{title}</caption>
      <thead><tr>{headers.map(header => <th key={header} scope="col" title={header === 'ratio' ? copyHistoryText(language, 'ratioHint') : undefined}>{copyHistoryText(language, header)}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
}
function EmptyHistory() {
  const { language } = useClientPreferences()
  return <div className="cpp-empty"><b>{copyHistoryText(language, 'emptyTitle')}</b>{copyHistoryText(language, 'emptyBody')}</div>
}

/** Client b2ee991d cpxHist/cpxShare/cpxBal/cpxTx: synthetic source presentation.
 * Source prices and cost estimates deliberately retain the original simplifications.
 * Closed trades and funding duration use the settlement snapshot, never current time.
 */
export function ClientCopyDetailHistory({ tab, copy, calculation: d, source, now }: ClientCopyDetailHistoryProps) {
  const { language } = useClientPreferences()
  const h = (key: CopyHistoryKey, values?: Record<string, string | number>) => copyHistoryText(language, key, values)
  // Keep emphasis as React nodes, never HTML, and allow each language to order
  // its own sentence without changing calculation or the table's stable keys.
  const rich = (key: CopyHistoryKey, values: Record<string, ReactNode>) => h(key).split(/(\{\w+\})/g).map((part, i) =>
    <Fragment key={i}>{/^\{\w+\}$/.test(part) && Object.hasOwn(values, part.slice(1, -1)) ? values[part.slice(1, -1)] : part}</Fragment>)
  const number = (value: number, digits = 0) => Number.isFinite(value)
    ? new Intl.NumberFormat(language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value) : '—'
  const usd = (value: number, digits = 2) => `${number(value, digits)} USDT`
  const date = (value: number | Date, options?: Intl.DateTimeFormatOptions) => {
    const at = value instanceof Date ? value : new Date(value)
    return Number.isFinite(at.getTime()) ? new Intl.DateTimeFormat(language, { calendar: 'gregory', ...options }).format(at) : '—'
  }
  const startI = copy.simStartI ?? 0, endI = copy.flatI ?? Infinity
  const matchingSource = source?.nick === copy.nick ? source : null
  const trades = copy.status === 'closed' ? copy.closedTrades ?? [] : copy.flatTrades
    ?? (matchingSource?.result.trades ?? []).filter(trade => (trade.exit ?? trade.entry) >= startI && (trade.exit ?? trade.entry) <= endI)

  if (tab === 'hist') {
    const recent = trades.slice(-30).reverse()
    if (!recent.length) return <EmptyHistory />
    const wins = recent.filter(trade => trade.pnl > 0).length
    const sum = recent.reduce((total, trade) => total + trade.pnl, 0) * copy.amount
    const kinds: Record<string, CopyHistoryKey> = { sl: 'sl', tp: 'tp', time: 'timeExit' }
    return <>
      <div className="cpx-sumline">{rich('summary', { count: number(recent.length), wins: number(wins), sum: <b className={`num ${sum >= 0 ? 'u' : 'd'}`}>{usd(sum)}</b> })}</div>
      <HistoryTable title={h('hist')} headers={['pair', 'direction', 'entryPrice', 'exitPrice', 'pnl', 'return', 'reason', 'exitTime']}>
        {recent.map((trade, index) => {
          const entry = sourceTerminalPrices[trade.entry] || 0, exit = sourceTerminalPrices[trade.exit] || entry
          const trend = trade.pnl >= 0 ? 'u' : 'd'
          return <tr key={`${trade.entry}-${trade.exit}-${index}`}><td>{copy.pairs[0]}</td><td className="u">{h('long')}</td>
            <td className="num">{number(entry)}</td><td className="num">{number(exit)}</td>
            <td className={`num ${trend}`}>{usd(trade.pnl * copy.amount)}</td>
            <td className={`num ${trend}`}>{trade.pnl >= 0 ? '+' : ''}{number(trade.pnl * 100, 1)}%</td>
            <td>{h(kinds[trade.kind] ?? 'ruleExit')}</td><td className="num">{date(sourceTerminalDate(trade.exit ?? trade.entry), { month: 'numeric', day: 'numeric' })}</td>
          </tr>
        })}
      </HistoryTable>
    </>
  }

  if (tab === 'share') {
    const share = number(copyPreviewConfig.PROFIT_SHARE * 100)
    if (d.realized <= 0 && d.share <= 0) return <div className="cpp-empty"><b>{h('noShareTitle')}</b>
      {h('noShareBody', { share })}
      <span className="nx">{h('noShareHint')}</span></div>
    return <>
      <div className="cpp-ai">{h('shareSummary', { profit: usd(Math.max(0, d.realized)), share })}</div>
      <HistoryTable title={h('share')} headers={['period', 'realized', 'settled', 'pending', 'ratio', 'shareAmount']}>
        <tr><td><span>{date(copy.at)}</span>{' ~ '}<span>{copy.status === 'closed' ? date(copy.closedAt ?? copy.at) : h('present')}</span></td>
          <td className={`num ${d.realized >= 0 ? 'u' : 'd'}`}>{usd(d.realized)}</td><td className="num">{usd(d.share)}</td>
          <td className="num">{usd(0)}</td><td className="num">{share}%</td><td className="num">{usd(d.share)}</td></tr>
      </HistoryTable>
    </>
  }

  if (tab === 'bal') {
    const rows = copy.ledger.slice().reverse(), adds = copy.ledger.filter(entry => entry.type === 'add').length
    return <>
      {adds >= 3 && d.pnlPct < 0 && <div className="cpp-ai warn">{h('depositsWarning', { count: number(adds) })}</div>}
      <div className="cpx-sumline">{h('transfersSummary', { count: number(rows.length) })}</div>
      <HistoryTable title={h('bal')} headers={['at', 'type', 'amount', 'asset', 'direction']}>
        {rows.map((entry, index) => <tr key={`${entry.at}-${index}`}>
          <td className="num">{date(entry.at, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
          <td>{h(entry.type === 'add' ? 'deposit' : 'withdraw')}</td><td className={`num ${entry.type === 'add' ? 'u' : ''}`}>{entry.type === 'add' ? '+' : '-'}{usd(entry.amt)}</td>
          <td>USDT</td><td>{h(entry.type === 'add' ? 'toCopy' : 'toSpot')}</td>
        </tr>)}
      </HistoryTable>
    </>
  }

  const recent = trades.slice(-10)
  if (!matchingSource && !recent.length) return <EmptyHistory />
  const end = copy.status === 'closed' ? copy.closedAt ?? copy.at : now
  const days = Math.max(1, Math.round((end - copy.at) / 864e5)) + 30
  const funding = -(copy.amount * 0.0001 * Math.min(days, 45)), fee = recent.length * copy.amount * 0.002
  const rows: { at: Date; kind: CopyHistoryKey; pair: string; quantity: string; fee: string; change: string }[] = []
  for (const trade of recent) {
    rows.push({ at: sourceTerminalDate(trade.entry), kind: 'entry', pair: copy.pairs[0], quantity: usd(copy.amount * 0.4, 0), fee: usd(copy.amount * 0.001), change: `-${usd(copy.amount * 0.001)}` })
    rows.push({ at: sourceTerminalDate(trade.exit ?? trade.entry), kind: 'exit', pair: copy.pairs[0], quantity: usd(copy.amount * 0.4, 0), fee: usd(copy.amount * 0.001), change: `${trade.pnl >= 0 ? '+' : ''}${usd(trade.pnl * copy.amount)}` })
  }
  for (const entry of copy.ledger) rows.push({ at: new Date(entry.at), kind: entry.type === 'add' ? 'transferIn' : 'transferOut', pair: '-', quantity: usd(entry.amt, 0), fee: usd(0), change: `${entry.type === 'add' ? '+' : '-'}${usd(entry.amt)}` })
  rows.sort((a, b) => b.at.getTime() - a.at.getTime())
  return <>
    <div className="cpx-sumline">{rich('transactionsSummary', { fills: <b>{h('fillsCount', { count: number(recent.length * 2) })}</b>, fee: <b className="num">{usd(fee)}</b>, funding: <b className="num d">{usd(funding)}</b> })}</div>
    <div className="cpp-ai">{h('fundingHint')}</div>
    <details className="cpx-raw"><summary>{h('expand', { count: number(rows.length) })}</summary>
      <HistoryTable title={h('raw')} headers={['at', 'category', 'pair', 'quantity', 'fee', 'balanceChange']}>
        {rows.map((row, index) => <tr key={`${row.at.getTime()}-${index}`}><td className="num">{date(row.at)}</td><td>{h(row.kind)}</td><td>{row.pair}</td>
          <td className="num">{row.quantity}</td><td className="num">{row.fee}</td><td className="num">{row.change}</td></tr>)}
      </HistoryTable>
    </details>
  </>
}

export default ClientCopyDetailHistory
