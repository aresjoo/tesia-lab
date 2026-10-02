import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { ArrowLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { ClientStrategyRail } from './ClientStrategyRail'
import { ClientTradingTerminal, type ClientTradingTerminalControl, type ClientTradingTerminalProps } from './ClientTradingTerminal'
import { ClientProfessionalPriceChart } from './ClientProfessionalPriceChart'
import type { ClientTerminalStrategy } from '../client-terminal-view'
import type { PriceChartView } from '../chart/price-chart-view'
import '../client-account-terminal.css'
import { useClientPreferences } from '../client-preferences'
import { shellText } from '../client-shell-copy'
import { accountTerminalText } from '../client-account-terminal-copy'
import { boundTerminalMarket, type TerminalMarketPresentation } from '../client-terminal-market'
import { ClientTerminalMarketHeader, ClientTerminalMarketPanels } from './ClientTerminalMarket'
import { boundTerminalMarketSource, type TerminalMarketSource } from '../client-terminal-market-source'
import { useTerminalMarketSource } from '../use-terminal-market-source'
import { terminalMarketText } from '../client-terminal-market-copy'

/** Presentation bundle, not a service schema. The adapter must bind all slots to this strategy. */
export type ClientAccountTerminalEntry = {
  strategy: ClientTerminalStrategy
  chart: PriceChartView | null
  /** Current market facts supplied independently of historical chart bars. */
  marketPresentation?: TerminalMarketPresentation
  /** Explicit alternate presentation, e.g. source close-only preview. Not OHLC data. */
  chartContent?: ReactNode
  context?: ReactNode
  /** Caller-owned display only; never infer evaluation times or execution rights. */
  contextStatus?: string
  contextTools?: ReactNode
  /** Adapter-bound status presentation. Missing facts must stay unavailable. */
  statusHeader?: ReactNode
  agent: ReactNode
  dashboard: ReactNode
  completed: ReactNode
}
export type ClientEmptyTerminalMarket = { symbol?: string; market?: string; context?: ReactNode; chart: ReactNode }
type Props = {
  marketSource?: TerminalMarketSource
  marketScope?: string | null
  menuHostRef?: Ref<HTMLDivElement>
  /** The adapter supplies newest-first order; initialSelectedId takes precedence. */
  entries: readonly ClientAccountTerminalEntry[] | null
  initialSelectedId?: string
  controlRef?: Ref<ClientAccountTerminalControl>
  onSelectionChange?: (id: string | null) => void
  onNew: () => void
  onMenu?: (id: string, trigger: HTMLElement) => void
  onReconnect?: (id: string) => void
  onFillSelect?: (strategyId: string, fillId: string) => void
  notice?: ReactNode
  railFooter?: ReactNode
  headerTools?: ReactNode
  /** Only used for a known empty strategy list, never for unavailable data. */
  emptyDetail?: ReactNode
  emptyMarket?: ClientEmptyTerminalMarket
  /** Account-level management, separate from the selected chart's strategy. */
  management?: { label: string; backLabel: string; content: ReactNode }
  renderBottom: (strategyId: string | null, scope: 'current' | 'all') => ClientTradingTerminalProps['bottomTabs']
}
const tabs = [{ id: 'agent' }, { id: 'dashboard' }, { id: 'completed' }] as const
type Tab = typeof tabs[number]['id']
export type ClientAccountTerminalControl = { select: (id: string, tab?: Tab, management?: boolean) => void; showBottom: (id: string) => void }

/** Source tfDashView / tfTmSelect. No requests, timers, balances or execution state are invented here. */
export function ClientAccountTerminal({ marketSource, marketScope, menuHostRef, entries, initialSelectedId, controlRef, onSelectionChange, onNew, onMenu, onReconnect, onFillSelect, notice, railFooter, headerTools, emptyDetail, emptyMarket, management, renderBottom }: Props) {
  const id = useId()
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof accountTerminalText>[1]) => accountTerminalText(language, key)
  const title = shellText(language, 'trading')
  const [selection, setSelection] = useState<string | null>(initialSelectedId ?? null)
  const [expanded, setExpanded] = useState(false)
  const expandTrigger = useRef<HTMLButtonElement>(null)
  const [tab, setTab] = useState<Tab>('agent')
  const [managing, setManaging] = useState(false)
  // Re-entering an already selected panel is still a new focus request.
  const [, setManagementFocusRequest] = useState(0)
  const managementPanel = useRef<HTMLDivElement>(null), brain = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<'management' | 'analysis' | null>(null)
  const terminalControl = useRef<ClientTradingTerminalControl>(null)
  useImperativeHandle(controlRef, () => ({ select: (nextId, nextTab, manage = false) => {
    if (!entries?.some(entry => entry.strategy.id === nextId)) return
    boundTerminalMarketSource(marketSource, marketScope)?.preferences.follow()
    setSelection(nextId); setManaging(manage && Boolean(management))
    if (manage && management) { pendingFocus.current = 'management'; setManagementFocusRequest(value => value + 1); terminalControl.current?.showPanel('detail') }
    if (nextTab) { setTab(nextTab); terminalControl.current?.showPanel('detail') }
  }, showBottom: next => terminalControl.current?.showBottom(next) }), [entries, management, marketSource, marketScope])
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [retained, setRetained] = useState<ClientAccountTerminalEntry | null>(null)
  const callback = useRef(onSelectionChange)
  const previousSelection = useRef<string | null | undefined>(undefined)
  const ids = new Set<string>()
  const invalidIds = entries?.some(entry => {
    const key = entry.strategy.id
    if (!key.trim() || ids.has(key)) return true
    ids.add(key); return false
  }) ?? false
  const available = invalidIds ? null : entries
  // Null means temporarily unavailable, not deleted. Keep the requested ID for recovery.
  const selected = available?.find(entry => entry.strategy.id === selection)
    ?? available?.find(entry => entry.strategy.status === 'live') ?? available?.[0] ?? null
  const selectedId = selected?.strategy.id ?? null
  // Reconcile a removed selection during render, without a second effect-driven paint.
  // Null is an unavailable response and must not discard the recovery selection.
  if (available !== null && selection !== selectedId) setSelection(selectedId)
  if (available !== null && retained !== selected) setRetained(selected)
  // Keep mounted drafts/canvas during a transient outage, but conceal stale data.
  const presentation = available === null ? retained : selected
  const canManage = Boolean(management && available !== null && presentation)
  const showManagement = canManage && managing
  const chooseStrategy = (next: string) => { boundTerminalMarketSource(marketSource, marketScope)?.preferences.follow(); setManaging(false); setSelection(next); terminalControl.current?.showPanel('detail') }
  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const destination = pendingFocus.current
    // A parent can request restoration during its mount layout effect. Strict
    // Effects replays the child's old (closed) tree before the state commit.
    // Consume the request only once the requested panel has actually rendered.
    if (destination === 'management' && !showManagement && canManage
      || destination === 'analysis' && showManagement) return
    pendingFocus.current = null
    const target = destination === 'management'
      ? managementPanel.current?.querySelector<HTMLElement>('h2, [tabindex="-1"]')
      : brain.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    if (target?.getClientRects().length && !target.closest('[hidden],[inert]')) {
      target.focus({ preventScroll: true })
    }
  })
  useEffect(() => { callback.current = onSelectionChange }, [onSelectionChange])
  useEffect(() => {
    if (available === null) return
    if (previousSelection.current !== selectedId) {
      previousSelection.current = selectedId
      callback.current?.(selectedId)
    }
  }, [available, selectedId])
  const switchTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1
    if (next < 0) return
    event.preventDefault(); setTab(tabs[next].id)
    document.getElementById(`${id}-${tabs[next].id}-tab`)?.focus()
  }
  const strategy = selected?.strategy
  const marketLookup = useTerminalMarketSource(marketSource, marketScope, strategy, available !== null)
  const fallback = available?.length === 0 ? emptyMarket : undefined
  const strategyMarket = boundTerminalMarket(strategy, selected?.marketPresentation)
  const displaySymbol = marketLookup.active ? marketLookup.instrument?.symbol : strategy?.symbol ?? fallback?.symbol
  const displayMarket = marketLookup.active ? marketLookup.instrument?.market : strategy?.market ?? fallback?.market
  const marketPresentation: TerminalMarketPresentation | undefined = marketLookup.active || marketLookup.picker ? {
    ...(marketLookup.active ? marketLookup.data?.facts : strategyMarket),
    ...(marketLookup.active && marketLookup.state !== 'ready' ? { quote: { state: marketLookup.state }, info: { state: marketLookup.state } } : {}),
    binding: { id: marketLookup.active ? `market:${marketSource?.identity}` : strategy?.id ?? '', symbol: displaySymbol ?? '', market: displayMarket ?? '', exchangeId: marketLookup.active ? marketLookup.instrument?.exchangeId ?? '' : strategy?.exchange.id ?? '' },
    picker: marketLookup.picker,
  } : strategyMarket
  const headingTools = <div className="cat-heading-tools" hidden={expanded} inert={expanded}>{!expanded && headerTools}<button ref={expandTrigger} className="cat-expand" type="button" aria-label={t('expandTerminal')} onClick={() => setExpanded(true)}><Maximize2 size={16} /><span>{t('fullscreen')}</span></button></div>
  return <div data-integrated-menu={Boolean(menuHostRef)} className="client-account-terminal" data-selected-strategy={selectedId ?? ''} data-management={showManagement}>
    <div className="cat-heading" hidden={expanded} inert={expanded}><h1>{title}</h1>{!menuHostRef && headingTools}</div>
    <ClientTradingTerminal embedded active={expanded} controlRef={terminalControl} returnFocusRef={expandTrigger} onClose={() => setExpanded(false)} title={title} headerTools={expanded ? headerTools : undefined}
      strategySelector={{ countLabel: accountTerminalText(language, 'strategyCount', { count: available === null ? '—' : new Intl.NumberFormat(language).format(available.length) }), name: strategy?.name ?? t('selectStrategy') }}
      initialMobilePanel={available === null ? null : !available.length && emptyDetail != null ? 'detail' : 'chart'}
      labels={{ strategies: t('strategies'), chart: t('chart'), detail: t('judgment') }}
      slots={{
        marketHeader: <ClientTerminalMarketHeader menuHostRef={menuHostRef} tools={menuHostRef ? headingTools : undefined} symbol={displaySymbol} market={displayMarket} presentation={marketPresentation} />,
        notice: notice != null || invalidIds ? <>{notice}{invalidIds && <p role="alert">{t('invalidIds')}</p>}</> : undefined,
        strategies: <ClientStrategyRail strategies={available?.map(entry => entry.strategy) ?? null} selectedId={selectedId}
          onSelect={chooseStrategy} onNew={onNew} onMenu={onMenu} onReconnect={onReconnect} footer={canManage ? <><button type="button" className="cat-management-trigger" aria-pressed={showManagement} aria-controls={`${id}-management`} onClick={() => {
            setManaging(true); pendingFocus.current = 'management'; setManagementFocusRequest(value => value + 1); terminalControl.current?.showPanel('detail')
          }}><span>{management!.label}</span><ChevronRight size={16} aria-hidden="true" /></button>{railFooter}</> : railFooter} />,
        context: strategy ? <div className="cat-context"><div className="cat-context-row"><span className="cat-exchange" style={{ background: strategy.exchange.color, color: strategy.exchange.foreground }}>{strategy.exchange.name.slice(0, 2).toUpperCase()}</span><b>{strategy.symbol}</b><span className="cat-market-name" title={`${strategy.exchange.name} ${strategy.market}`}>{strategy.exchange.name} {strategy.market}</span><span className="cat-strategy-name" title={`${strategy.name} ${strategy.version}`}>{strategy.name} <small>{strategy.version}</small></span><span className={`cat-status is-${strategy.status}`}>{t(strategy.status)}</span>{selected?.contextStatus && <span className="cat-evaluation" title={selected.contextStatus}>{selected.contextStatus}</span>}{selected?.contextTools && <div className="cat-context-tools">{selected.contextTools}</div>}</div>{selected?.context}</div>
          : <div className="cat-context cat-muted">{available === null ? t('unavailable') : fallback?.context ?? t('selectContext')}</div>,
        chart: <ClientTerminalMarketPanels presentation={marketPresentation}>
          {marketLookup.storageError && <p className="ctm-state" role="alert">{terminalMarketText(language, 'selectionUnsaved')} <button type="button" className="tbtn" onClick={marketLookup.retrySave}>{terminalMarketText(language, 'retry')}</button></p>}
          <div hidden={available === null || marketLookup.active} inert={available === null || marketLookup.active} data-strategy-price-chart>{presentation?.chartContent ?? fallback?.chart ?? <ClientProfessionalPriceChart view={presentation?.chart ?? null} onFillSelect={fill => { if (selectedId) onFillSelect?.(selectedId, fill.id) }} />}</div>
          {marketLookup.active && <section data-market-inspection={marketLookup.instrument?.id ?? ''} aria-label={terminalMarketText(language, 'market')}>
            <p className="ctm-source">{terminalMarketText(language, 'inspection')} {marketLookup.data?.chart.sourceLabel}</p>
            {marketLookup.data ? <ClientProfessionalPriceChart view={marketLookup.data.chart} variant="market" /> : <p className="ctm-state" role="status">{terminalMarketText(language, marketLookup.state === 'ready' ? 'unavailable' : marketLookup.state)} {marketLookup.state === 'error' && <button type="button" className="tbtn" onClick={marketLookup.retry}>{terminalMarketText(language, 'retry')}</button>}</p>}
          </section>}
          {available === null && <p className="cat-empty" role="status">{t('unavailable')}</p>}
        </ClientTerminalMarketPanels>,
        detail: available !== null && !presentation && emptyDetail != null ? emptyDetail : <>
          {management && <div id={`${id}-management`} className="cat-management" ref={managementPanel} hidden={!showManagement} inert={!showManagement}>
            <button type="button" className="cat-management-back" onClick={() => { setManaging(false); pendingFocus.current = 'analysis' }}><ArrowLeft size={16} aria-hidden="true" /><span>{management.backLabel}</span></button>
            {management.content}
          </div>}
          <div className="cat-brain" data-status-header={selected?.statusHeader != null} ref={brain} hidden={showManagement} inert={showManagement}>
          {selected?.statusHeader == null && <><header><b title={strategy?.name}>{strategy?.name ?? t('agent')}</b>{strategy && <><small title={strategy.version}>{strategy.version}</small><span className={`cat-status is-${strategy.status}`}>{t(strategy.status)}</span></>}</header>
          {strategy && <div className="cat-brain-meta"><span>{strategy.exchange.name} · {strategy.symbol}</span><span>{strategy.capitalLabel}</span></div>}</>}
          <div className="cat-tabs" role="tablist" aria-label={t('analysis')}>{tabs.map((item, index) => <button key={item.id} id={`${id}-${item.id}-tab`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`${id}-${item.id}-panel`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => switchTab(event, index)}>{t(item.id === 'agent' && selected?.statusHeader != null ? 'judgment' : item.id)}</button>)}</div>
          {available === null && <p className="cat-empty" role="status">{t('unavailable')}</p>}
          {tabs.map(item => <section key={`${presentation?.strategy.id ?? 'none'}-${item.id}`} id={`${id}-${item.id}-panel`} data-analysis-tab={item.id} role="tabpanel" aria-labelledby={`${id}-${item.id}-tab`} tabIndex={0} hidden={available === null || tab !== item.id} inert={available === null}>
            {item.id === 'agent' && selected?.statusHeader}
            {presentation ? presentation[item.id] : <p className="cat-empty">{t('selectAnalysis')}</p>}
          </section>)}
        </div></>,
      }}
      bottomTools={<div className="cat-scope"><select aria-label={t('scope')} value={scope} onChange={event => setScope(event.target.value === 'all' ? 'all' : 'current')}><option value="current">{t('current')}</option><option value="all">{t('all')}</option></select></div>}
      bottomTabs={renderBottom(selectedId, scope)} />
  </div>
}
