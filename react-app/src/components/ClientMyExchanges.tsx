import { useClientPreferences } from '../client-preferences'
import { isMyExchangeId, selectedMyExchanges, type MyExchange, type MyExchangeFilter } from '../client-my-exchanges'
import copy from '../client-my-exchanges-copy.json'
import { ClientSharingDropdown } from './ClientSharingDropdown'
import '../client-my-exchanges.css'

function Icons({ exchanges }: { exchanges: readonly MyExchange[] }) {
  return <span className="myex-ic" aria-hidden="true">{exchanges.slice(0, 3).map(exchange => <img key={exchange.id} src={exchange.logo} alt="" width={16} height={16} />)}</span>
}

/** Source sk-myex: one connection toggles; several open a choice list. */
export function ClientMyExchanges({ exchanges, value, open, onOpenChange, onSelect }: {
  exchanges: readonly MyExchange[]; value: MyExchangeFilter; open: boolean
  onOpenChange: (open: boolean) => void; onSelect: (value: MyExchangeFilter) => void
}) {
  const { language } = useClientPreferences(), t = copy[language]
  if (!exchanges.length) return null
  const selected = selectedMyExchanges(value, exchanges)
  const icons = <Icons exchanges={value ? selected : exchanges} />
  const label = value && value !== 'all' ? t.only.replace('{name}', selected[0]?.name ?? '') : t.label
  return <span className={`myex-w${value ? ' on' : ''}`}>
    {exchanges.length === 1 ? <button type="button" className="myex" aria-pressed={Boolean(value)} onClick={() => { onOpenChange(false); onSelect(value ? '' : 'all') }}>
      {icons}<span>{label}</span>
    </button> : <ClientSharingDropdown label={t.label} value={value} open={open} active={Boolean(value)}
      triggerContent={<span className="myex-content">{icons}<span>{label}</span></span>}
      options={[
        { value: 'all', label: t.all, icon: <Icons exchanges={exchanges} /> },
        ...exchanges.map(exchange => ({ value: exchange.id, label: t.only.replace('{name}', exchange.name), icon: <Icons exchanges={[exchange]} /> })),
        { value: '', label: t.off },
      ]} onOpenChange={onOpenChange} onSelect={next => { if (next === '' || next === 'all' || isMyExchangeId(next) && exchanges.some(exchange => exchange.id === next)) onSelect(next) }} />}
  </span>
}

export function ClientMyExchangeResult({ selected, count, onReset }: { selected: readonly MyExchange[]; count: number; onReset: () => void }) {
  const { language } = useClientPreferences(), t = copy[language]
  if (!selected.length) return null
  const message = (count ? t.note : t.empty).replace('{names}', selected.map(exchange => exchange.name).join(', ')).replace('{count}', count.toLocaleString(language))
  return count ? <p className="myex-note" role="status">{message}</p> : <div className="myex-empty"><p role="status">{message}</p><button type="button" className="pl-link" onClick={onReset}>{t.reset}</button></div>
}
