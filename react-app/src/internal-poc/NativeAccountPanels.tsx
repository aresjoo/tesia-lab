import { useId, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { clientTerminalText } from '../client-terminal-copy'
import { strategyActionsText } from '../client-strategy-actions-copy'
import { researchCopy } from '../client-research-copy'
import { ClientAccountAlerts } from '../components/ClientAccountActivity'
import type { AccountAlertsFilter } from '../client-account-presentation'
import { sourceAgentPresets, sourceProposalText } from '../client-source-proposal-copy'
import { safeClientAccountHash, readClientAccountLocation, type ClientAccountLocation } from '../client-account-navigation'
import { nativeAccountColumns, nativeAccountNumericColumns, type NativeAccountDocument, type NativeAccountField, type NativeAccountLedgerRow, type NativeAccountLedgerTab, type NativeAccountNotification } from './native-account-presentation'
import { nativeAccountText } from './native-account-presentation-copy'
import '../client-terminal-ledger.css'
import '../client-account-activity.css'

export function NativeAccountFields({ fields, dashboard = false }: { fields: readonly NativeAccountField[] | null; dashboard?: boolean }) {
  const { language } = useClientPreferences()
  if (fields === null) return <p className="cat-empty" role="status">{nativeAccountText(language, 'unavailable')}</p>
  if (dashboard) return <dl className="cst-matrix">{fields.map((field, index) => <div key={index}><dt>{field.label}</dt><dd className={field.tone}>{field.value}</dd></div>)}</dl>
  return <div className="nfx-rows">{fields.map((field, index) => <div key={index} className="nfx-row"><span className="nfx-rlb">{field.label}</span><b className={`nfx-rr ${field.tone ?? ''}`}>{field.value}</b></div>)}</div>
}

export function NativeAccountLedger({ tab, rows, sourceLabel, hasConnectedAccount, onSelect, onAccount, canAccount, onNavigate, canNavigate, onPause, canPause, onOpenTrade, canOpenTrade, onConnect }: {
  tab: NativeAccountLedgerTab
  rows: readonly NativeAccountLedgerRow[] | null
  sourceLabel: string
  hasConnectedAccount: boolean
  onSelect: (id: string) => void
  onAccount: (id: string) => void
  canAccount?: (id: string) => boolean
  onNavigate?: (location: ClientAccountLocation) => void
  canNavigate?: (location: ClientAccountLocation) => boolean
  onPause?: (row: NativeAccountLedgerRow) => void
  canPause?: (row: NativeAccountLedgerRow) => boolean
  onOpenTrade?: (row: NativeAccountLedgerRow, trigger: HTMLElement) => void
  canOpenTrade?: (row: NativeAccountLedgerRow) => boolean
  onConnect?: () => void
}) {
  const { language } = useClientPreferences()
  const title = clientTerminalText(language, tab)
  const columns = nativeAccountColumns[tab]
  const stopDescriptionId = useId()
  const reachable = (target: ClientAccountLocation | undefined) => !!target && !!onNavigate && safeClientAccountHash(target) !== null && (canNavigate?.(target) ?? true)
  return <div className="client-terminal-ledger" data-native-ledger={tab}>
    <p className="tft-tnote">{sourceLabel}{tab === 'assets' && ` · ${nativeAccountText(language, 'accountWide')}`}</p>
    {tab === 'pos' && <p id={stopDescriptionId} className="ledger-sr-only">{nativeAccountText(language, 'stopNotice')}</p>}
    {rows === null ? <div className="tft-empty"><p role="status">{nativeAccountText(language, hasConnectedAccount ? 'connectedUnavailable' : 'unavailable')}</p>{!hasConnectedAccount && onConnect && <button type="button" className="nfx-btn pri" onClick={onConnect}>{clientTerminalText(language, 'connectExchange')}</button>}</div>
      : rows.length === 0 ? <p className="tft-empty">{nativeAccountText(language, 'empty')}</p>
        : tab === 'assets' ? <div className="tft-assets">{rows.map(row => <article className="tft-asx num" key={row.id} data-record-id={row.id} aria-label={row.asset?.exchange.name ?? row.cells.exchange}>
          <div className="ah2">{row.asset?.exchange && <span className="exb" aria-hidden="true" style={{ backgroundColor: row.asset.exchange.color, color: row.asset.exchange.foreground }}>{row.asset.exchange.name.slice(0, 2).toUpperCase()}</span>}<b><button type="button" className="stlk" disabled={canAccount?.(row.accountId) === false} onClick={() => { if (canAccount?.(row.accountId) !== false) onAccount(row.accountId) }}>{row.asset?.exchange.name ?? row.cells.exchange ?? '—'}</button></b>{row.asset?.strategyCountLabel && <span className="mut">{row.asset.strategyCountLabel}</span>}</div>
          <div className="ag2" role="region" aria-label={`${row.asset?.exchange.name ?? row.cells.exchange ?? ''} · ${title}`} tabIndex={0}>{(['equity', 'available', 'used', 'unrealized'] as const).map(column => <span key={column}><small>{nativeAccountText(language, column)}</small><b className={column === 'unrealized' ? row.tone : undefined}>{row.cells[column] ?? '—'}</b></span>)}</div>
          {row.asset?.description && <div className="af2">{row.asset.description}</div>}
          {row.target && <div className="af2"><button type="button" className="nfx-btn out" disabled={!reachable(row.target)} onClick={() => { if (reachable(row.target)) onNavigate?.(row.target!) }}>{nativeAccountText(language, 'detail')}</button></div>}
        </article>)}</div>
        : <div className="tft-tblw" role="region" aria-label={title} tabIndex={0}><table className="tft-tbl" aria-label={title}>
          <thead><tr>{columns.map(column => <th scope="col" key={column} className={nativeAccountNumericColumns.has(column) ? 'r' : undefined}>{nativeAccountText(language, column)}</th>)}<th scope="col" className="r">{nativeAccountText(language, 'detail')}</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} data-record-id={row.id} className={tab === 'closed' && canOpenTrade?.(row) ? 'trade-row' : undefined} onClick={event => {
            if (tab !== 'closed' || !canOpenTrade?.(row) || (event.target as HTMLElement).closest('button,a,input,select')) return
            const trigger = event.currentTarget.querySelector<HTMLElement>('[data-ledger-trade]')
            if (trigger) onOpenTrade?.(row, trigger)
          }}>{columns.map(column => <td key={column} className={[nativeAccountNumericColumns.has(column) ? 'r' : '', ['unrealized', 'realized', 'percent'].includes(column) ? row.tone : ''].filter(Boolean).join(' ') || undefined}>
            {column === 'strategy' && row.strategyId ? <button type="button" className="stlk" onClick={event => { if (tab === 'closed' && canOpenTrade?.(row)) onOpenTrade?.(row, event.currentTarget); else onSelect(row.strategyId!) }}>{row.cells[column] ?? row.strategyId}</button>
              : column === 'exchange' ? <button type="button" className="stlk" disabled={canAccount?.(row.accountId) === false} onClick={() => { if (canAccount?.(row.accountId) !== false) onAccount(row.accountId) }}>{row.cells[column] ?? '—'}</button> : row.cells[column] ?? '—'}
          </td>)}<td className="r">{tab === 'pos' && <button type="button" className="tbtn" aria-label={`${row.cells.strategy ?? row.strategyId ?? ''} · ${strategyActionsText(language, 'headerStop')}`} title={nativeAccountText(language, 'stopNotice')} aria-describedby={stopDescriptionId} disabled={!onPause || !canPause?.(row)} onClick={() => { if (canPause?.(row)) onPause?.(row) }}>{strategyActionsText(language, 'headerStop')}</button>}
            {tab === 'closed' && row.trade && <button type="button" className="tbtn" data-ledger-trade={row.trade.id} aria-label={`${row.cells.strategy ?? row.strategyId ?? ''} · ${row.trade.id} · ${clientTerminalText(language, 'closed')} · ${nativeAccountText(language, 'detail')}`} disabled={!onOpenTrade || !canOpenTrade?.(row)} onClick={event => { if (canOpenTrade?.(row)) onOpenTrade?.(row, event.currentTarget) }}>{clientTerminalText(language, 'closed')} · {nativeAccountText(language, 'detail')}</button>}
            <button type="button" className="tbtn" disabled={!reachable(row.target)} onClick={() => { if (row.target && reachable(row.target)) onNavigate?.(row.target) }}>{nativeAccountText(language, 'detail')}</button></td></tr>)}</tbody>
        </table></div>}
  </div>
}

export function NativeAccountDocumentPanel({ document, onReturn, onNavigate, canNavigate, returnLabel }: {
  document: NativeAccountDocument | null
  onReturn: () => void
  onNavigate?: (location: ClientAccountLocation) => void
  canNavigate?: (location: ClientAccountLocation) => boolean
  returnLabel?: string
}) {
  const { language } = useClientPreferences()
  const reachable = (target: ClientAccountLocation) => !!onNavigate && safeClientAccountHash(target) !== null && canNavigate?.(target) !== false
  return <div className="client-main-account client-account-activity" data-native-account-document={document?.id ?? ''}>
    <div className="native-plan-return"><button type="button" className="nfx-btn out" onClick={onReturn}>{returnLabel ?? researchCopy(language, 'return')}</button></div>
    <section className="nfx-card"><h1 tabIndex={-1}>{document?.title ?? nativeAccountText(language, 'accounts')}</h1><p>{document?.sourceLabel}</p><NativeAccountFields fields={document?.fields ?? null} /></section>
    {document?.sections.map(section => <section className="nfx-card" key={section.id}><h2 className="nfx-sectit">{section.title}</h2>{section.text && <p>{section.text}</p>}{section.fields && <NativeAccountFields fields={section.fields} />}</section>)}
    {document?.links && <div className="nfx-cta">{document.links.map((link, index) => <button type="button" className="nfx-btn out" key={index} disabled={!reachable(link.target)} onClick={() => { if (reachable(link.target)) onNavigate?.(link.target) }}>{link.label}</button>)}</div>}
  </div>
}

/** Same composer surface as the source Agent pane, with no simulated reply. */
export function NativeAccountMessage({ onSend, pending }: { onSend?: (message: string) => Promise<void>; pending: boolean }) {
  const { language } = useClientPreferences()
  const [message, setMessage] = useState('')
  const send = async (value = message) => {
    if (!onSend || pending || !value.trim()) return
    setMessage(value)
    try { await onSend(value); setMessage('') } catch { /* Caller displays a redacted error; preserve the draft. */ }
  }
  return <div className="cst-composer tft-comp"><div className="chips">{sourceAgentPresets.map(preset => <button type="button" key={preset.key} disabled={!onSend || pending} onClick={() => void send(preset.request)}>{sourceProposalText(language, preset.key)}</button>)}</div><form onSubmit={event => { event.preventDefault(); void send() }}>
    <input value={message} maxLength={1000} aria-label={nativeAccountText(language, 'message')} placeholder={nativeAccountText(language, 'message')} disabled={!onSend || pending}
      onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.repeat)) event.preventDefault() }} />
    <button className="snd" type="submit" disabled={!onSend || pending || !message.trim()} aria-label={nativeAccountText(language, 'send')}>↵</button>
  </form></div>
}

export function NativeAccountAlerts({ notifications, pending, onRead, onReadAll, onNavigate, canNavigate, filter, onFilterChange }: {
  notifications: readonly NativeAccountNotification[] | null
  pending: boolean
  onRead?: (id: string) => Promise<void>
  onReadAll?: () => Promise<void>
  onNavigate?: (location: ClientAccountLocation) => void
  canNavigate?: (location: ClientAccountLocation) => boolean
  filter?: AccountAlertsFilter
  onFilterChange?: (filter: AccountAlertsFilter) => void
}) {
  const navigate = (hash: string) => {
    const next = readClientAccountLocation(hash)
    if (next && canNavigate?.(next) !== false) onNavigate?.(next)
  }
  return <div data-native-account-alerts><ClientAccountAlerts state={null} now={0} money={String}
    presentationActions={{ onNavigate: onNavigate ? navigate : undefined }}
    presentation={{ rows: notifications?.map(item => ({ ...item, move: item.move, route: item.target && canNavigate?.(item.target) !== false ? safeClientAccountHash(item.target) ?? undefined : undefined })) ?? null }} filter={filter} onFilterChange={onFilterChange}
    onRead={pending ? undefined : onRead} onReadAll={pending ? undefined : onReadAll}
    onNavigate={navigate} /></div>
}
