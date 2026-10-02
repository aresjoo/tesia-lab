import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { catalogueTitle } from '../client-catalogue'
import type { CatalogueOrderRow } from '../client-catalogue-presentation'
import { useClientPreferences } from '../client-preferences'
import { sharedPercent } from '../client-shared-number-format'
import copy from '../client-catalogue-ui-copy.json'
import orderCopy from '../client-catalogue-orders-copy.json'

const Chevron = ({ back = false }: { back?: boolean }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}/></svg>

/** mkOrdersSec/mkTradesTab: five recent orders, then a dedicated 30/50 view.
 * One shared table prevents differences between preview and full history. */
export function ClientCatalogueOrders({ rows, date, amount = 1000, full = false, onOpen, onBack, openRef, headingRef }: {
  rows: readonly CatalogueOrderRow[]; date: (index: number) => string; amount?: number; full?: boolean
  onOpen: () => void; onBack: () => void
  openRef?: RefObject<HTMLButtonElement | null>; headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  const { language } = useClientPreferences(), text = copy[language], words = orderCopy[language]
  const basis = text.basis.replace('$1,000', `$${new Intl.NumberFormat('en-US').format(Number.isFinite(amount) && amount>0 ? amount : 1000)}`)
  const [limit, setLimit] = useState(30)
  const table = useRef<HTMLTableElement>(null), revealIndex = useRef<number | null>(null)
  useLayoutEffect(() => {
    const index = revealIndex.current
    if (index === null) return
    revealIndex.current = null
    const row = table.current?.tBodies[0]?.rows[index]
    row?.focus({ preventScroll: true })
    row?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [limit])
  const number = (value: number, digits = 2) => new Intl.NumberFormat(language, { maximumFractionDigits: digits }).format(value)
  const back = <button type="button" className="catalogue-orders-link" onClick={onBack}><Chevron back/>{words.back}</button>
  return <section className={`catalogue-orders${full ? ' catalogue-orders-full' : ''}`} aria-label={text.orders}>
    {full && back}
    <div className="ss3-ch"><h3 ref={headingRef} tabIndex={full ? -1 : undefined}>{full ? text.orders : <button className="catalogue-orders-link" type="button" ref={openRef} onClick={onOpen}>{text.orders}<Chevron/></button>}</h3><span className="mt2">{words.count.replace('{count}', number(rows.length, 0))} · {basis}</span></div>
    <div className="shared-trades-scroll" role="region" aria-label={`${text.orders} · ${basis}`} tabIndex={0}>
      <table ref={table} className="ss3-tbl"><thead><tr>{[text.target, words.type, text.signal, text.fill, text.price, text.units, text.amount].map((label, index) => <th key={label} scope="col" className={index >= 4 ? 'shared-number' : undefined}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice(0, full ? limit : 5).map(order => <tr key={order.id} data-catalogue-order={order.id} tabIndex={full ? -1 : undefined}>
          <td><span className="catalogue-order-sign" aria-hidden="true">{order.action === 'entry' ? '+' : '−'}</span>{catalogueTitle(order.asset)}</td>
          <td>{order.side ? `${order.side > 0 ? text.long : text.short} ` : ''}{text[order.action]}{order.open && <small>{words.open}</small>}</td>
          <td>{order.signal === null ? '—' : date(order.signal)}</td><td>{date(order.date)}</td>
          <td className="shared-number">{number(order.price, 6)}</td><td className="shared-number">{number(order.units, 8)}</td>
          <td className="shared-number">${number(order.amount)}{order.pnl !== undefined && <small className={order.pnl < 0 ? 'catalogue-loss' : 'catalogue-gain'}>{sharedPercent(order.pnl, language)}</small>}</td>
        </tr>)}{rows.length === 0 && <tr><td colSpan={7} className="catalogue-orders-empty">{words.empty}</td></tr>}</tbody>
      </table>
    </div>
    {full && limit < rows.length && <button className="shared-detail-analysis" type="button" onClick={() => { revealIndex.current = limit; setLimit(count => count + 50) }}>{words.older}</button>}
    {full && back}
  </section>
}
