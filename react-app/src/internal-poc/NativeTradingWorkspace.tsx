import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ClientAccountTerminal, type ClientAccountTerminalControl } from '../components/ClientAccountTerminal'
import { ClientTerminalConnectionEmpty } from '../components/ClientTerminalConnectionEmpty'
import { ClientAgentFeed } from '../components/ClientAgentFeed'
import { ClientAccountBell } from '../components/ClientAccountBell'
import { ClientStrategyActions, type ClientStrategyActionCallbacks } from '../components/ClientStrategyActions'
import { ClientTradeLifecycle } from '../components/ClientTradeLifecycle'
import { useClientPreferences } from '../client-preferences'
import { researchCopy } from '../client-research-copy'
import { clientTerminalText } from '../client-terminal-copy'
import { strategyActionsText } from '../client-strategy-actions-copy'
import { accountActivityText } from '../client-account-activity-copy'
import type { ClientAccountLocation } from '../client-account-navigation'
import { accountLocationAvailable, accountPresentationBound, type NativeAccountPresentation, type NativeAccountLedgerTab, type NativeAccountLedgerRow, type NativeAccountStrategy, type NativeAccountAlertsView } from './native-account-presentation'
import type { AccountAlertsFilter } from '../client-account-presentation'
import { NativeAccountAlerts, NativeAccountDocumentPanel, NativeAccountFields, NativeAccountLedger, NativeAccountMessage } from './NativeAccountPanels'
import { nativeAccountText } from './native-account-presentation-copy'
import { NativeTerminalCompleted, NativeTerminalDashboard } from './NativeTerminalViews'
import '../client-restored-research.css'
import '../client-source-terminal.css'

/** Only one explicit, current-version record for a displayed trade is usable.
 * Duplicate identifiers are ambiguous even if only one has the current version. */
function tradeLifecycle(item: NativeAccountStrategy | undefined, tradeId: string, rows?: readonly NativeAccountLedgerRow[] | null) {
  if (!item || !tradeId || !item.strategy.version) return undefined
  if (!displayedTrade(item, tradeId, rows)) return undefined
  const records = item.tradeLifecycles?.filter(record => record.tradeId === tradeId) ?? []
  if (records.length !== 1) return undefined
  const record = records[0]
  if (record.versionIdentity !== item.strategy.version || typeof record.title !== 'string' || !record.title.trim()
    || record.regionLabel !== undefined && typeof record.regionLabel !== 'string'
    || !Array.isArray(record.steps) || record.steps.some(step => !step || typeof step.title !== 'string' || !step.title.trim()
      || typeof step.value !== 'string' || typeof step.description !== 'string')) return undefined
  return record
}

function observedLedgerTrade(item: NativeAccountStrategy, tradeId: string, rows?: readonly NativeAccountLedgerRow[] | null) {
  const records = rows?.filter(row => row.strategyId === item.strategy.id && row.trade?.id === tradeId) ?? []
  return records.length === 1 && records[0].accountId === item.accountId && records[0].trade?.versionIdentity === item.strategy.version ? records[0] : undefined
}
function displayedTrade(item: NativeAccountStrategy, tradeId: string, rows?: readonly NativeAccountLedgerRow[] | null) {
  return !!observedLedgerTrade(item, tradeId, rows) || item.dashboardPresentation?.recentTrades?.some(trade => trade.id === tradeId)
    || item.completedPresentation?.trades?.some(trade => trade.id === tradeId)
}

/** Original terminal presentation, without the source-preview fixture producer.
 * Null is unavailable account data, not a confirmed empty account. Paper run
 * summaries and approval receipts cannot establish exchange connection rights. */
export function NativeTradingWorkspace(props: { onReturn: () => void; onNew: () => void; onBrowseExchanges?: () => void; accountScope?: string | null; presentation?: NativeAccountPresentation; onNavigate?: (location: ClientAccountLocation) => void; alertsRequest?: number; alertsView?: NativeAccountAlertsView; onAlertsViewChange?: (view: NativeAccountAlertsView) => void }) {
  const data = accountPresentationBound(props.presentation, props.accountScope) ? props.presentation : undefined
  return <AccountScope key={JSON.stringify([props.accountScope, data?.identity])} {...props} presentation={data} />
}

function AccountScope({ onReturn, onNew, onBrowseExchanges, presentation: data, onNavigate, alertsRequest, alertsView, onAlertsViewChange }: { onReturn: () => void; onNew: () => void; onBrowseExchanges?: () => void; presentation?: NativeAccountPresentation; onNavigate?: (location: ClientAccountLocation) => void; alertsRequest?: number; alertsView?: NativeAccountAlertsView; onAlertsViewChange?: (view: NativeAccountAlertsView) => void }) {
  const { language } = useClientPreferences()
  const root = useRef<HTMLDivElement>(null)
  const control = useRef<ClientAccountTerminalControl>(null)
  const [menu, setMenu] = useState<{ id: string; trigger: HTMLElement; initialView?: 'versions' } | null>(null)
  const [lifecycle, setLifecycle] = useState<{ strategyId: string; tradeId: string; fingerprint: string; trigger: HTMLElement; ledgerRow?: { id: string; fingerprint: string } } | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [localAlertsFilter, setLocalAlertsFilter] = useState<AccountAlertsFilter>('all')
  const alertsFilter = data && alertsView?.scope === data.scope && alertsView.identity === data.identity ? alertsView.filter : localAlertsFilter
  const changeAlertsFilter = (filter: AccountAlertsFilter) => {
    setLocalAlertsFilter(filter)
    if (data) onAlertsViewChange?.({ scope: data.scope, identity: data.identity, filter })
  }
  const accountTrigger = useRef<HTMLElement | null>(null)
  const previousBottom = useRef('pos')
  const showBottom = useCallback((id: string) => {
    if (id !== 'account') { previousBottom.current = id; setAccountId(null) }
    control.current?.showBottom(id)
  }, [])
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const locks = useRef(new Set<string>())
  const [feedback, setFeedback] = useState<'failed' | 'accepted' | null>(null)
  const alive = useRef(false)
  const current = useRef(data)
  useLayoutEffect(() => { current.current = data }, [data])
  useEffect(() => { alive.current = true; return () => { alive.current = false; current.current = undefined } }, [])
  useLayoutEffect(() => {
    // A late lazy mount must not take focus from a newer account-menu action.
    const active = document.activeElement
    if (active instanceof HTMLElement && active.closest('[data-sidebar-action], .client-source-overlays, .client-locale-panel')) return
    const heading = root.current?.querySelector('h1')
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
  }, [])
  useEffect(() => {
    let active = true
    if (alertsRequest !== undefined && Number.isSafeInteger(alertsRequest) && alertsRequest > 0) queueMicrotask(() => {
      if (active && alive.current) showBottom('alerts')
    })
    return () => { active = false }
  }, [alertsRequest, showBottom])
  const run = useCallback(async (key: string, action: (() => Promise<void>) | undefined) => {
    if (!action || !data || current.current !== data || locks.current.has(key)) throw new Error('ACCOUNT_ACTION_UNAVAILABLE')
    locks.current.add(key); setPending(new Set(locks.current)); setFeedback(null)
    try { await action(); if (alive.current && current.current?.identity === data.identity) setFeedback('accepted') }
    catch { if (alive.current && current.current?.identity === data.identity) setFeedback('failed'); throw new Error('ACCOUNT_ACTION_FAILED') }
    finally { locks.current.delete(key); if (alive.current) setPending(new Set(locks.current)) }
  }, [data])
  const canAccount = useCallback((id: string) => !!data?.accounts?.some(account => account.id === id), [data])
  const openAccount = useCallback((id: string) => {
    if (!alive.current || current.current !== data || !canAccount(id)) return
    // The terminal also supports keyboard tab changes. Read its committed view
    // selection, not just the last pointer click, before opening a utility pane.
    const selected = root.current?.querySelector<HTMLElement>('.ctt-bottom-pane[data-selected="true"]')?.dataset.tabId
    if (selected && selected !== 'account') previousBottom.current = selected
    accountTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setAccountId(id)
    setMenu(null)
    showBottom('account')
  }, [data, canAccount, showBottom])
  useEffect(() => {
    let active = true
    if (accountId !== null && !canAccount(accountId)) queueMicrotask(() => {
      if (!active || !alive.current || current.current !== data) return
      setAccountId(null)
      showBottom(previousBottom.current)
    })
    return () => { active = false }
  }, [accountId, canAccount, data, showBottom])
  const leaveAccount = () => {
    setAccountId(null)
    showBottom(previousBottom.current)
    queueMicrotask(() => { const node = accountTrigger.current; if (node?.isConnected && node.getClientRects().length && !node.closest('[hidden],[inert]')) node.focus({ preventScroll: true }) })
  }
  const canNavigate = useCallback((location: ClientAccountLocation) => !!onNavigate && accountLocationAvailable(data, location), [data, onNavigate])
  const navigate = useCallback((location: ClientAccountLocation) => {
    if (alive.current && current.current === data && canNavigate(location)) onNavigate?.(location)
  }, [data, canNavigate, onNavigate])
  const openTrade = useCallback((strategyId: string, tradeId: string, trigger: HTMLElement, ledgerRow?: NativeAccountLedgerRow) => {
    if (!data || current.current !== data) return
    const item = data.strategies?.find(candidate => candidate.strategy.id === strategyId)
    const record = tradeLifecycle(item, tradeId, data.ledger.closed)
    if (record) {
      setMenu(null)
      setLifecycle({ strategyId, tradeId, fingerprint: JSON.stringify(record), trigger, ...(ledgerRow ? { ledgerRow: { id: ledgerRow.id, fingerprint: JSON.stringify(ledgerRow) } } : {}) })
    } else if (item?.terminalActions?.onOpenTrade) {
      const key = JSON.stringify(['trade', strategyId, tradeId])
      if (locks.current.has(key)) return
      locks.current.add(key); setPending(new Set(locks.current)); setFeedback(null)
      const failed = () => {
        const latest = current.current
        const latestItem = latest?.strategies?.find(candidate => candidate.strategy.id === strategyId)
        if (alive.current && latest?.scope === data.scope && latest.identity === data.identity && latestItem
          && latestItem.strategy.version === item.strategy.version && displayedTrade(latestItem, tradeId, latest?.ledger.closed)
          && (!ledgerRow || JSON.stringify(observedLedgerTrade(latestItem, tradeId, latest?.ledger.closed)) === JSON.stringify(ledgerRow))
          && latestItem.terminalActions?.onOpenTrade === item.terminalActions?.onOpenTrade) setFeedback('failed')
      }
      const settled = () => { locks.current.delete(key); if (alive.current) setPending(new Set(locks.current)) }
      // Preserve an existing external navigation port. Its optional async failure
      // must not leak provider errors or become an unhandled rejection.
      try { void Promise.resolve(item.terminalActions.onOpenTrade(tradeId, trigger)).catch(failed).finally(settled) }
      catch { failed(); settled() }
    } else setFeedback('failed')
  }, [data])
  const lifecycleItem = lifecycle ? data?.strategies?.find(item => item.strategy.id === lifecycle.strategyId) : undefined
  const lifecycleRecord = lifecycle ? tradeLifecycle(lifecycleItem, lifecycle.tradeId, data?.ledger.closed) : undefined
  const lifecycleRow = lifecycle && lifecycleItem ? observedLedgerTrade(lifecycleItem, lifecycle.tradeId, data?.ledger.closed) : undefined
  const lifecycleValid = !!lifecycleRecord && JSON.stringify(lifecycleRecord) === lifecycle?.fingerprint
    && (!lifecycle?.ledgerRow || lifecycleRow?.id === lifecycle.ledgerRow.id && JSON.stringify(lifecycleRow) === lifecycle.ledgerRow.fingerprint)
  const currentRow = (tab: NativeAccountLedgerTab, row: NativeAccountLedgerRow) => {
    if (!data || !row.strategyId) return undefined
    const rows = data.ledger[tab]?.filter(candidate => candidate.id === row.id)
    if (rows?.length !== 1 || rows[0] !== row) return undefined
    return data.strategies?.find(item => item.strategy.id === row.strategyId && item.accountId === row.accountId)
  }
  const canPause = (row: NativeAccountLedgerRow) => {
    const item = currentRow('pos', row)
    return !!item && item.strategy.status === 'live' && !!data?.actions?.onStatus && !locks.current.has(item.strategy.id)
  }
  const canOpenLedgerTrade = (row: NativeAccountLedgerRow) => {
    const item = currentRow('closed', row)
    return !!item && !!row.trade?.id && observedLedgerTrade(item, row.trade.id, data?.ledger.closed) === row
      && !locks.current.has(JSON.stringify(['trade', item.strategy.id, row.trade.id]))
      && (!!item.terminalActions?.onOpenTrade || !!tradeLifecycle(item, row.trade.id, data?.ledger.closed))
  }
  const connect = data?.actions?.onConnect ? () => { void run('connect', data.actions?.onConnect).catch(() => {}) } : onBrowseExchanges
  // Remove the selection as well as hiding stale content. A late prop refresh
  // cannot reopen a dismissed or invalidated trade record.
  if (lifecycle && !lifecycleValid) setLifecycle(null)
  const menuPending = !!menu && pending.has(menu.id)
  const menuCallbacks: ClientStrategyActionCallbacks = {
    onDetail: id => control.current?.select(id, 'dashboard'),
    onRename: data?.actions?.onRename && !menuPending ? (id, name) => run(id, () => data.actions!.onRename!(id, name)) : undefined,
    onClone: data?.actions?.onClone && !menuPending ? (id, exchange) => run(id, () => data.actions!.onClone!(id, exchange)) : undefined,
    onStatus: data?.actions?.onStatus && !menuPending ? (id, status) => run(id, () => data.actions!.onStatus!(id, status)) : undefined,
    onDelete: data?.actions?.onDelete && !menuPending ? id => run(id, () => data.actions!.onDelete!(id)) : undefined,
  }
  // This memo also prevents the terminal's retained-chart reconciliation from
  // repeatedly receiving freshly allocated entry objects on its own renders.
  const entries = useMemo(() => data?.strategies?.map(item => ({
    strategy: item.strategy, chart: item.chart, contextStatus: item.contextStatus,
    contextTools: <div className="cst-context-actions"><button type="button" className="tft-halt" disabled={!data.actions?.onStatus || pending.has(item.strategy.id) || item.strategy.status === 'err'} onClick={() => void run(item.strategy.id, () => data.actions!.onStatus!(item.strategy.id, item.strategy.status === 'live' ? 'off' : 'live')).catch(() => {})}>{strategyActionsText(language, item.strategy.status === 'live' ? 'pause' : item.strategy.status === 'off' ? 'resume' : 'start')}</button>
      <button type="button" className="tbtn" disabled={!canAccount(item.accountId)} onClick={() => openAccount(item.accountId)}>{nativeAccountText(language, 'accounts')}</button></div>,
    agent: <><ClientAgentFeed {...item.agent} strategyId={item.strategy.id} onReconnect={data.actions?.onReconnect ? () => void run(item.strategy.id, () => data.actions!.onReconnect!(item.strategy.id)).catch(() => {}) : undefined} />
      <NativeAccountMessage key={item.strategy.id} pending={pending.has(item.strategy.id)} onSend={data.actions?.onMessage ? message => run(item.strategy.id, () => data.actions!.onMessage!(item.strategy.id, message)) : undefined} /></>,
    dashboard: <><NativeTerminalDashboard scopeId={JSON.stringify([data.scope, data.identity])} strategyId={item.strategy.id} strategyName={item.strategy.name} version={item.strategy.version}
      data={item.dashboardPresentation} onOpenTrade={item.terminalActions?.onOpenTrade || item.tradeLifecycles?.length ? (id, trigger) => openTrade(item.strategy.id, id, trigger) : undefined}
      canOpenTrade={id => !!item.terminalActions?.onOpenTrade || !!tradeLifecycle(item, id, data.ledger.closed)} onOpenPosition={item.terminalActions?.onOpenPosition}
      onOpenVersions={item.terminalActions?.onOpenVersions ?? (item.versionHistory !== undefined ? trigger => setMenu({ id: item.strategy.id, trigger, initialView: 'versions' }) : undefined)} />
      {!!item.dashboard?.length && <NativeAccountFields fields={item.dashboard} dashboard />}<div className="cst-context-actions">
      <button type="button" className="tbtn" disabled={!canNavigate({ kind: 'bot', id: item.strategy.id })} onClick={() => navigate({ kind: 'bot', id: item.strategy.id })}>{strategyActionsText(language, 'detail')}</button></div></>,
    completed: <NativeTerminalCompleted scopeId={JSON.stringify([data.scope, data.identity])} strategyId={item.strategy.id} strategyName={item.strategy.name} data={item.completedPresentation}
      onOpenTrade={item.terminalActions?.onOpenTrade || item.tradeLifecycles?.length ? (id, trigger) => openTrade(item.strategy.id, id, trigger) : undefined}
      canOpenTrade={id => !!item.terminalActions?.onOpenTrade || !!tradeLifecycle(item, id, data.ledger.closed)} />,
  })) ?? null, [data, pending, language, canNavigate, navigate, run, canAccount, openAccount, openTrade])
  const menuItem = data?.strategies?.find(item => item.strategy.id === menu?.id)
  const unread = data?.notifications == null ? null : data.notifications.filter(item => !item.read).length
  const alertLabel = accountActivityText(language, 'alerts') + (unread === null ? `: ${nativeAccountText(language, 'unavailable')}` : unread > 0 ? `, ${accountActivityText(language, 'unread', { count: String(unread) })}` : '')
  return <div ref={root} className="client-restored-research client-source-terminal native-trading-workspace" data-account-identity={data?.identity ?? ''} onClickCapture={event => {
    const tab = (event.target as HTMLElement).closest<HTMLButtonElement>('.ctt-bottom-tabs [data-tab-id]')
    if (tab?.dataset.tabId) previousBottom.current = tab.dataset.tabId
  }}>
    <ClientAccountTerminal marketSource={data?.marketSource} marketScope={data?.scope} entries={entries} initialSelectedId={data?.initialSelectedId} controlRef={control} onNew={onNew}
      onMenu={(id, trigger) => setMenu({ id, trigger })}
      onReconnect={data?.actions?.onReconnect ? id => void run(id, () => data.actions!.onReconnect!(id)).catch(() => {}) : undefined}
      onFillSelect={(strategyId, fillId) => { const row = data?.ledger.fills?.find(row => row.strategyId === strategyId && row.id === fillId); if (row?.target) navigate(row.target) }}
      railFooter={data && <div className="cst-context-actions">{data.accounts?.map(account => <button type="button" className="tbtn" key={account.id} onClick={() => openAccount(account.id)}>{account.title}</button>)}{data.actions?.onConnect && <button type="button" className="tbtn" disabled={pending.has('connect')} onClick={() => void run('connect', data.actions?.onConnect).catch(() => {})}>{clientTerminalText(language, 'connectExchange')}</button>}</div>}
      headerTools={<><button type="button" className="native-trading-return g-btn-t" onClick={onReturn}>{researchCopy(language, 'return')}</button>{data?.creditLabel !== undefined && <span className="g-tag">{data.creditLabel}</span>}<button type="button" className="g-btn-t" disabled={!onNavigate} onClick={() => navigate({ kind: 'plan', tab: 'plan' })}>PLAN</button><ClientAccountBell unread={unread} ariaLabel={alertLabel} onOpen={() => showBottom('alerts')} /></>}
      notice={<>{!data && <p>{clientTerminalText(language, 'accountUnavailable')}</p>}{data && <p>{data.sourceLabel}</p>}{feedback && <p role={feedback === 'failed' ? 'alert' : 'status'}>{nativeAccountText(language, feedback)}</p>}{pending.size > 0 && <p role="status">{nativeAccountText(language, 'pending')}</p>}</>}
      renderBottom={(strategyId, scope) => [...(['pos', 'open', 'orders', 'fills', 'closed', 'assets'] as const).map((id: NativeAccountLedgerTab) => ({
        id, label: clientTerminalText(language, id), content: data ? <NativeAccountLedger tab={id} rows={data.ledger[id]?.filter(row => id === 'assets' || scope === 'all' || row.strategyId === strategyId || row.origin === 'exchange' && strategyId === null) ?? null} sourceLabel={data.sourceLabel} onSelect={id => control.current?.select(id)} onAccount={openAccount} canAccount={canAccount} onNavigate={onNavigate ? navigate : undefined} canNavigate={canNavigate}
          hasConnectedAccount={!!data.accounts?.length} onConnect={connect} canPause={canPause} onPause={row => { if (current.current === data && canPause(row)) void run(row.strategyId!, () => data.actions!.onStatus!(row.strategyId!, 'off')).catch(() => {}) }}
          canOpenTrade={canOpenLedgerTrade} onOpenTrade={(row, trigger) => {
            if (current.current !== data || !canOpenLedgerTrade(row)) return
            control.current?.select(row.strategyId!, 'completed')
            // Keep the originating ledger visible on narrow layouts so dismissal
            // returns to a live keyboard target; the completed tab stays selected.
            showBottom('closed')
            openTrade(row.strategyId!, row.trade!.id, trigger, row)
          }} />
          : <ClientTerminalConnectionEmpty onConnect={connect} />,
      })), { id: 'account', label: nativeAccountText(language, 'accounts'), hiddenFromTabs: true, content: <NativeAccountDocumentPanel document={data?.accounts?.find(account => account.id === accountId) ?? null} onReturn={leaveAccount} returnLabel={accountActivityText(language, 'myTrading')} onNavigate={onNavigate ? navigate : undefined} canNavigate={canNavigate} /> },
      { id: 'alerts', label: accountActivityText(language, 'alerts'), hiddenFromTabs: true, content: <NativeAccountAlerts notifications={data?.notifications ?? null} pending={pending.has('notifications')} filter={alertsFilter} onFilterChange={changeAlertsFilter}
        onRead={data?.actions?.onRead ? id => run('notifications', () => data.actions!.onRead!(id)) : undefined} onReadAll={data?.actions?.onReadAll ? () => run('notifications', data.actions!.onReadAll) : undefined} onNavigate={onNavigate ? navigate : undefined} canNavigate={canNavigate} /> }]} />
    {menu && menuItem && <ClientStrategyActions key={`${data?.identity}:${menu.id}`} strategy={menuItem.strategy} trigger={menu.trigger} onClose={() => setMenu(null)} initialView={menu.initialView}
      exchanges={data?.exchanges ?? []} versionHistory={menuItem.versionHistory} callbacks={menuCallbacks} />}
    {lifecycle && lifecycleValid && lifecycleRecord && <ClientTradeLifecycle title={lifecycleRecord.title} regionLabel={lifecycleRecord.regionLabel}
      steps={lifecycleRecord.steps} trigger={lifecycle.trigger} onClose={() => setLifecycle(null)} />}
  </div>
}
