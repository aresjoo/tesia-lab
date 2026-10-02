import { useId, useState, type ReactNode } from 'react'
import type { ClientTerminalStrategy } from '../client-terminal-view'
import '../client-strategy-rail.css'
import { useClientPreferences } from '../client-preferences'
import { accountTerminalText } from '../client-account-terminal-copy'

export type ClientStrategyRailProps = {
  strategies: readonly ClientTerminalStrategy[] | null
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onMenu?: (id: string, trigger: HTMLElement) => void
  onReconnect?: (id: string) => void
  footer?: ReactNode
}

const statuses = {
  live: '●', off: 'Ⅱ', ready: '○', err: '⚠',
} as const

/** Source: 9bf4427 index.html tfTmRail. The owner supplies every financial label. */
export function ClientStrategyRail({ strategies, selectedId, onSelect, onNew, onMenu, onReconnect, footer }: ClientStrategyRailProps) {
  const heading = useId()
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof accountTerminalText>[1], values: Readonly<Record<string, string>> = {}) => accountTerminalText(language, key, values)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [exchange, setExchange] = useState('all')
  const normalizedQuery = query.trim().normalize('NFC').toLowerCase()
  const rows = (strategies ?? []).filter(item => (status === 'all' || status === item.status)
    && (exchange === 'all' || exchange === item.exchange.id)
    && `${item.name} ${item.symbol}`.normalize('NFC').toLowerCase().includes(normalizedQuery))
  const exchanges = new Map((strategies ?? []).map(item => [item.exchange.id, item.exchange.name]))

  return <section className="teth-strategy-rail" aria-labelledby={heading}>
    <div className="tft-rh"><b id={heading}>{t('strategies')}</b><span className="ct2">{strategies === null ? '—' : strategies.length}</span><button className="tft-new" type="button" onClick={onNew}>{t('newStrategy')}</button></div>
    <div className="tft-rf">
      <input type="search" aria-label={t('search')} placeholder={t('search')} value={query} onChange={event => setQuery(event.target.value)} />
      <div className="fr2">
        <select aria-label={t('statusFilter')} value={status} onChange={event => setStatus(event.target.value)}><option value="all">{t('allStatuses')}</option>{(Object.keys(statuses) as (keyof typeof statuses)[]).map(key => <option key={key} value={key}>{t(key)}</option>)}</select>
        <select aria-label={t('exchangeFilter')} value={exchange} onChange={event => setExchange(event.target.value)}><option value="all">{t('allExchanges')}</option>{exchange !== 'all' && !exchanges.has(exchange) && <option value={exchange}>{exchange}</option>}{[...exchanges].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      </div>
    </div>
    <div className="tft-rl">
      {strategies === null ? <div className="tft-empty" role="status"><b>{t('unavailable')}</b></div>
        : strategies.length === 0 ? <div className="tft-empty"><b>{t('empty')}</b><span>{t('emptyHint')}</span><button className="tft-new" type="button" onClick={onNew}>{t('create')}</button></div>
          : rows.length === 0 ? <div className="tft-empty" role="status"><b>{t('noMatch')}</b><span>{t('noMatchHint')}</span></div>
            : <ul className="tft-list" aria-label={t('list')}>{rows.map((item, index) => <li key={item.id} data-strategy-id={item.id} className={`tft-card st-${item.status}${selectedId === item.id ? ' on' : ''}`}>
              <span className="tft-description" id={`${heading}-strategy-${index}`}>{[
                t('exchangeValue', { value: item.exchange.name }), t('statusValue', { value: t(item.status) }), t('symbolValue', { value: item.symbol }), t('marketValue', { value: item.market }), t('versionValue', { value: item.version }), t('capitalValue', { value: item.capitalLabel }),
                ...(item.sharedCapital ? [t('sharedCapital')] : []),
                ...(item.pnlLabel !== undefined ? [`${item.pnlKind === 'validation' ? `${t('validation')} ` : ''}${t('pnlValue', { value: item.pnlLabel })}`] : []),
                ...(item.pnlPercentLabel !== undefined ? [`${item.pnlKind === 'validation' && item.pnlLabel === undefined ? `${t('validation')} ` : ''}${t('pnlPercentValue', { value: item.pnlPercentLabel })}`] : []),
              ].join(', ')}</span>
              <button className="tft-select" type="button" aria-label={t('selectName', { name: item.name })} aria-describedby={`${heading}-strategy-${index}`} aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
                <span className="r1"><span className="exb" title={item.exchange.name} style={{ background: item.exchange.color, color: item.exchange.foreground ?? 'var(--gt, #e3e3e3)' }}>{item.exchange.name.slice(0, 2).toUpperCase()}</span><span className="nm" title={item.name}>{item.name}</span><span className={`st st-${item.status}`}>{`${statuses[item.status]} ${t(item.status)}`}</span></span>
                <span className="r2"><span className="sy">{item.symbol}, {item.market}</span><span className="ver">{item.version}</span></span>
                <span className="r3"><span className="cap">{item.capitalLabel}{item.sharedCapital && <i title={t('sharedCapital')}>*</i>}</span>{(item.pnlLabel !== undefined || item.pnlPercentLabel !== undefined) && <span className={`pnl ${item.pnlTone ?? 'zz'}`}>{item.pnlKind === 'validation' && <small className="vl">{t('validation')} </small>}{item.pnlLabel}{item.pnlPercentLabel !== undefined && <small> {item.pnlPercentLabel}</small>}</span>}</span>
              </button>
              <button className="mn" type="button" aria-label={t('menuName', { name: item.name })} disabled={!onMenu} onClick={event => onMenu?.(item.id, event.currentTarget)}>⋯</button>
              {item.status === 'err' && item.error && <div className="r4">{item.error}{onReconnect && <button type="button" onClick={() => onReconnect(item.id)}>{t('reconnect')}</button>}</div>}
            </li>)}</ul>}
    </div>
    {footer !== undefined && footer !== null && <div className="tft-rfoot">{footer}</div>}
  </section>
}
