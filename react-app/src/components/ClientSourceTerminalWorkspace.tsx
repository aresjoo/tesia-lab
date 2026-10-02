import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { ClientAccountTerminal, type ClientAccountTerminalControl, type ClientAccountTerminalEntry, type ClientEmptyTerminalMarket } from './ClientAccountTerminal'
import { ClientAgentFeed } from './ClientAgentFeed'
import { ClientSourceJudgmentStatus } from './ClientSourceJudgmentStatus'
import { ClientStrategyActions } from './ClientStrategyActions'
import { ClientSourceCloseChart } from './ClientSourceCloseChart'
import { ClientSourceNavChart } from './ClientSourceNavChart'
import { ClientStrategyProposal } from './ClientStrategyProposal'
import { ClientTradeLifecycle } from './ClientTradeLifecycle'
import { sourceTerminalBottomTabs } from './ClientTerminalLedger'
import { ClientAccountAlerts } from './ClientAccountActivity'
import { ClientAccountBell } from './ClientAccountBell'
import { ClientTerminalConnectionEmpty } from './ClientTerminalConnectionEmpty'
import type { SourceAccountEventState } from '../client-account-event-state'
import { CLIENT_BROKERS } from '../client-broker-fixtures'
import { useClientPreferences } from '../client-preferences'
import { billingText } from '../client-billing-copy'
import { terminalBarsText, terminalReadText } from '../client-terminal-read-copy'
import { lifecycleText } from '../client-trade-lifecycle-copy'
import { clientTerminalText } from '../client-terminal-copy'
import { strategyActionsText } from '../client-strategy-actions-copy'
import { sharedNumber, sharedPercent } from '../client-shared-number-format'
import { evaluateSourceTerminal, sourceTerminalPrices, type SourceTerminalSeed, type SourceTerminalEvaluation } from '../client-terminal-source-fixture'
import { createSourceTerminalDiscussion, sourceParameterFingerprint, type SourceTerminalDiscussion, type SourceTerminalProposal } from '../client-terminal-source-proposal'
import { projectSourceDiscussion } from '../client-source-proposal-presentation'
import { sourceAgentPresets, sourceProposalText } from '../client-source-proposal-copy'
import { sourceQuestionText } from '../client-source-question-view'
import { initialSourceTerminalState, addSourceOperation, applySourceTerminalWithReceipt, canResumeSourceApplied, resumeSourceApplied, setSourceTerminalStatus, SourceTerminalStatusError, type SourceAppliedReceipt, type SourceStatusFailure, type SourceTerminalState } from '../client-terminal-source-state'
import { sourceContextText } from '../client-source-context-copy'
import { sourceJudgmentText } from '../client-source-judgment-copy'
import { sourceTerminalLifecycle, sourceTradeExitPrice } from '../client-terminal-source-ledger'
import { sourceAgentEvents, sourceChartPoints, sourceChartTime, sourceDay, sourceMoney, sourcePercent, sourceTone } from '../client-terminal-source-view'
import type { ClientAgentOperation } from '../client-agent-view'
import type { SourceUserStrategyRecord } from '../client-user-strategy'
import { projectUserTerminal } from '../client-user-terminal'
import { ClientConditionalOrderPendingRows } from './ClientConditionalOrderCard'
import type { ConditionalOrderPreviewOrder } from '../client-conditional-order-preview'
import '../client-restored-research.css'
import '../client-source-terminal.css'

type Model = { seed: SourceTerminalSeed; result: SourceTerminalEvaluation }
type Money = (value: number, signed?: boolean) => string
type OpenTrade = (id: string, entryIndex: number, trigger: HTMLElement) => void
const noUserStrategies: readonly SourceUserStrategyRecord[] = []
// Keep each monetary amount and its sign together when a narrow metric wraps.
function SourceValuePair({ first, second, separator = ' ', firstTone = '', secondTone = '' }: { first: string; second: string; separator?: string; firstTone?: string; secondTone?: string }) {
  return <><span className={`cst-value-part ${firstTone}`}>{first}</span>{separator}<span className={`cst-value-part ${secondTone}`}>{second}</span></>
}
function SourceContextActions({ seed, disabled, onStatus, onReconnect }: {
  seed: SourceTerminalSeed; disabled: boolean
  onStatus: (id: string, status: 'live' | 'off') => void | Promise<void>; onReconnect: (id: string) => void
}) {
  const { language } = useClientPreferences()
  const [pending, setPending] = useState(false)
  const alive = useRef(false), locked = useRef(false)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  return <div className="cst-context-actions"><button type="button" disabled={disabled || pending} onClick={async () => {
    if (locked.current) return
    locked.current = true; setPending(true)
    try { if (seed.status === 'err') onReconnect(seed.id); else await onStatus(seed.id, seed.status === 'live' ? 'off' : 'live') }
    finally { locked.current = false; if (alive.current) setPending(false) }
  }}>{strategyActionsText(language, seed.status === 'live' ? 'headerStop' : seed.status === 'off' ? 'headerResume' : seed.status === 'err' ? 'headerReconnect' : 'start')}</button></div>
}

function SourceDashboard({ model: { seed, result: c }, money, onTrade, onVersions }: { model: Model; money: Money; onTrade: OpenTrade; onVersions: (id: string, trigger: HTMLElement) => void }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof terminalReadText>[1], values?: Readonly<Record<string, string>>) => terminalReadText(language, key, values)
  const percent = (value: number) => sharedPercent(value, language)
  const bars = (value: number, digits: 0 | 1 = 0) => terminalBarsText(language, value, digits)
  const r = c.r
  const maxGain = Math.max(0, ...c.trades.map(tr => tr.krw)), maxLoss = Math.min(0, ...c.trades.map(tr => tr.krw))
  const values = [
    ['capital', money(seed.capital), ''], ['navSimulation', money(c.nav), ''], ['totalPnl', <SourceValuePair first={money(c.pnl, true)} second={percent(c.pnlPct)} />, sourceTone(c.pnl)], ['realized', <SourceValuePair first={money(c.realized, true)} second={money(c.unreal, true)} separator=" / " firstTone={sourceTone(Math.abs(c.realized) < 1 ? 0 : c.realized)} secondTone={sourceTone(Math.abs(c.unreal) < 1 ? 0 : c.unreal)} />, ''],
    ['feeCaption', t('estimated', { value: `−${money(c.feeEst)}` }), 'zz'],
  ] as const
  return <div className="cst-dashboard">
    <dl className="cst-matrix">{values.map(([key, value, tone]) => <div key={key} data-metric={key}><dt>{t(key)}</dt><dd className={tone}>{value}</dd></div>)}</dl>
    <section className="cst-nav"><h3>{t('navCurve')} <small>{t('simulationRange')}</small></h3><ClientSourceNavChart equity={r.eq} label={t('navDescription', { value: percent(r.ret) })} /></section>
    <dl className="cst-matrix compact">{([
      ['winRate', `${Math.round(r.winRate)}% (${Math.round(r.n * r.winRate / 100)}W/${r.lossCount}L)`], ['drawdown', sharedPercent(r.mdd, language, 1, false)], ['profitFactor', r.lossCount === 0 && r.n > 0 ? `>${sharedNumber(9.9, language)}` : sharedNumber(r.pf, language, 2)], ['sharpe', sharedNumber(r.sharpe, language, 2)], ['averageHolding', bars(r.avgHold, 1)], ['marketExposure', `${Math.round(r.exposure)}%`], ['tradeCount', t('trades', { value: String(r.n) })], ['maxGainLoss', <SourceValuePair first={maxGain ? money(maxGain, true) : '-'} second={maxLoss ? money(maxLoss) : '-'} separator=" / " />],
    ] as const).map(([key, value]) => <div key={key} data-metric={key}><dt>{t(key)}</dt><dd className={key === 'drawdown' ? 'dn' : undefined}>{value}</dd></div>)}</dl>
    <h3>{t('currentPosition')} <small>{t('simulationEnd')}</small></h3>{c.pos && seed.status === 'live' ? <div className="cst-position"><div className="cst-position-head"><span className="cst-long">LONG</span><b>{seed.symbol}</b><span className={sourceTone(c.pos.chg)}><SourceValuePair first={money(c.pos.krw, true)} second={`(${percent(c.pos.chg * 100)})`} /></span></div><dl>{([
      ['entryPrice', money(c.pos.entryP)], ['currentPrice', money(c.pos.curP)], ['quantity', sharedNumber(c.pos.qty, language, 4)], ['stopPrice', money(c.pos.stopP)],
      ...(c.pos.tpP !== null ? [['targetPrice', money(c.pos.tpP)] as const] : []), ['holding', bars(c.pos.bars)],
    ] as const).map(([key, value]) => <div key={key} data-metric={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}</dl></div> : <div className="cst-empty"><b>{t('noPosition')}</b><p>{t(seed.status === 'live' ? 'seekingEntry' : 'notRunning')}</p></div>}
    <h3>{t('recentTrades')} <small>{t('count', { count: String(Math.min(25, c.trades.length)) })}</small></h3><SourceTrades model={{ seed, result: c }} money={money} onTrade={onTrade} />
    <button type="button" className="cst-versions" aria-haspopup="dialog" onClick={event => onVersions(seed.id, event.currentTarget)}>{t('versionHistory', { version: seed.version })}</button>
  </div>
}
function SourceTrades({ model: { seed, result }, money, onTrade }: { model: Model; money: Money; onTrade: OpenTrade }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof terminalReadText>[1], values?: Readonly<Record<string, string>>) => terminalReadText(language, key, values)
  return result.trades.length ? <div className="cst-table" tabIndex={0} role="region" aria-label={t('recentTradesLabel', { name: seed.name })}><table><thead><tr>{(['exitDate', 'type', 'entryPrice', 'exitPrice', 'holding', 'pnl'] as const).map((key, index) => <th key={key} scope="col" className={index >= 2 ? 'num' : undefined}>{t(key)}</th>)}</tr></thead><tbody>{result.trades.slice(-25).reverse().map(tr => <tr key={`${seed.id}:${tr.entry}`} onClick={event => {
    if (!(event.target instanceof Element) || event.target.closest('button')) return
    const selection = window.getSelection()
    if (selection?.toString() && (event.currentTarget.contains(selection.anchorNode) || event.currentTarget.contains(selection.focusNode))) return
    const trigger = event.currentTarget.querySelector<HTMLButtonElement>('button')
    if (trigger) onTrade(seed.id, tr.entry, trigger)
  }}><td><button type="button" className="cst-trade-link" aria-haspopup="dialog" aria-label={t('tradeDetails', { date: sourceDay(tr.exit) })} onClick={event => onTrade(seed.id, tr.entry, event.currentTarget)}>{sourceDay(tr.exit)}</button></td><td>{t(tr.kind === 'tp' ? 'takeProfit' : tr.kind === 'sl' ? 'stopLoss' : 'period')}</td><td className="num">{money(sourceTerminalPrices[tr.entry])}</td><td className="num">{money(sourceTradeExitPrice({ seed, result }, tr))}</td><td className="num">{terminalBarsText(language, tr.exit - tr.entry)}</td><td className={`num ${sourceTone(tr.krw)}`}>{money(tr.krw, true)}</td></tr>)}</tbody></table></div> : <p className="cst-empty">{t('noFills')}</p>
}
function SourceCompleted({ model: { seed, result }, money, onTrade }: { model: Model; money: Money; onTrade: (id: string, entryIndex: number, trigger: HTMLElement) => void }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof terminalReadText>[1], values?: Readonly<Record<string, string>>) => terminalReadText(language, key, values)
  return <div className="cst-completed"><h3>{t('completed')} <small>{t('completedRange', { total: String(result.trades.length), recent: String(Math.min(12, result.trades.length)) })}</small></h3>{result.trades.slice(-12).reverse().map(tr => {
    const entered = result.L.evs.find(ev => ev.i === tr.entry), exited = result.L.evs.find(ev => ev.i === tr.exit)
    const exit = sourceTradeExitPrice({ seed, result }, tr)
    return <article className="cst-completed-trade" key={tr.entry}><header><b>LONG · {seed.asset}</b><span className={sourceTone(tr.krw)}><SourceValuePair first={money(tr.krw, true)} second={`(${sharedPercent(tr.pnl * 100, language)})`} /></span></header><dl className="cst-matrix compact">{([['entry', money(sourceTerminalPrices[tr.entry])], ['exit', money(exit)], ['holding', terminalBarsText(language, tr.exit - tr.entry)], ['fee', money(tr.capB * .002)]] as const).map(([key, value]) => <div key={key} data-metric={key}><dt>{t(key)}</dt><dd>{value}</dd></div>)}</dl><p><small>{t('whyEntered')}</small>{entered?.txt}</p><p><small>{t('whyExited')}</small>{exited?.txt}</p><span className="cst-date">{sourceDay(tr.entry)} → {sourceDay(tr.exit)}</span><button type="button" className="cst-trade-details" onClick={event => onTrade(seed.id, tr.entry, event.currentTarget)}>{t('fullDecision')}</button></article>
  })}{!result.trades.length && <div className="cst-empty"><b>{t('noCompleted')}</b><p>{t('noCompletedHint')}</p></div>}</div>
}
function SourceAgentComposer({ model: { seed }, onAsk, onApply, canResume, onResume, onBeforeAi }: { model: Model; onAsk: (text: string) => void; onApply?: (proposal: SourceTerminalProposal) => Promise<SourceAppliedReceipt>; canResume?: (receipt: SourceAppliedReceipt) => boolean; onResume?: (receipt: SourceAppliedReceipt) => Promise<void>; onBeforeAi?: () => boolean }) {
  const { language, currency } = useClientPreferences()
  const t = (key: Parameters<typeof sourceProposalText>[1], values?: Readonly<Record<string, string>>) => sourceProposalText(language, key, values)
  const [draft, setDraft] = useState('')
  const [discussion, setDiscussion] = useState<SourceTerminalDiscussion | null>(null)
  const response = discussion?.response
  const presentation = useMemo(() => discussion ? projectSourceDiscussion(discussion.display, language) : null, [discussion, language])
  const [notice, setNotice] = useState<SourceAppliedReceipt | null>(null)
  const [resuming, setResuming] = useState(false), [resumeFailed, setResumeFailed] = useState(false)
  const resumeLock = useRef(false), mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const resumable = notice !== null && !!onResume && canResume?.(notice)
  const appliedStopped = notice?.paused === true && seed.status === 'off' && seed.version === notice.version && sourceParameterFingerprint(seed.parameters) === notice.fingerprint
  const input = useRef<HTMLInputElement>(null)
  const quick = (kind: 'sl' | 'tp' | 'budget') => {
    const text = kind === 'sl' ? `손절 ${seed.parameters.sl}%로 바꿔줘` : kind === 'tp' ? `익절 +${seed.parameters.tp ?? 10}%로 바꿔줘` : `예산 ${sourceMoney(seed.capital, 'USD', 'en')}로 바꿔줘`
    setDraft(text)
    // Wait for the controlled value commit before selecting it; no request here.
    requestAnimationFrame(() => { if (mounted.current) { input.current?.focus(); input.current?.select() } })
  }
  const revealControl = (target: EventTarget) => {
    if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  }
  const proposalScroll = useRef<HTMLDivElement>(null)
  const ask = (text: string) => {
    if (!text.trim()) return
    if (onBeforeAi && !onBeforeAi()) return
    setDiscussion(createSourceTerminalDiscussion(seed, text.trim())); setDraft(''); setNotice(null); setResumeFailed(false)
  }
  const dismiss = () => { setDiscussion(null); setResumeFailed(false); input.current?.focus({ preventScroll: true }) }
  const proposal = response?.kind === 'proposal' ? response.proposal : null
  const stale = proposal !== null && (proposal.strategyId !== seed.id || proposal.baseVersion !== seed.version || proposal.baseFingerprint !== sourceParameterFingerprint(seed.parameters))
  const responseKind = response?.kind
  useLayoutEffect(() => {
    const scroll = proposalScroll.current
    const composer = scroll?.parentElement
    const pane = scroll?.closest<HTMLElement>('.ctt-detail-content')
    const section = scroll?.closest<HTMLElement>('.cat-brain > section')
    if (!scroll || !composer || !pane || !section) return
    // Reserve the actual header and composer controls, including wrapped labels.
    // Mobile has page scrolling; only the bounded desktop pane needs this limit.
    const measure = () => {
      if (getComputedStyle(pane).maxHeight === 'none') {
        scroll.style.removeProperty('--cst-proposal-max-height')
        return
      }
      if (!pane.clientHeight) return
      const header = section.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop
      const controls = composer.getBoundingClientRect().height - scroll.getBoundingClientRect().height
      const height = Math.floor(Math.max(64, Math.min(420, pane.clientHeight - header - controls - 2)))
      const value = `${height}px`
      if (scroll.style.getPropertyValue('--cst-proposal-max-height') !== value) scroll.style.setProperty('--cst-proposal-max-height', value)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(pane)
    observer.observe(composer)
    for (const child of section.parentElement?.children ?? []) if (child.tagName !== 'SECTION') observer.observe(child)
    measure()
    return () => observer.disconnect()
  }, [responseKind])
  useLayoutEffect(() => {
    if (!response) return
    const pane = proposalScroll.current?.closest<HTMLElement>('.ctt-detail-content')
    if (pane && getComputedStyle(pane).maxHeight === 'none') {
      // On short phones, reveal the existing input after inserting a reply.
      // Do this once per new reply, never in a scroll/resize listener.
      input.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    }
  }, [response])
  return <div className="cst-composer">
    {proposal && <div ref={proposalScroll} className="cst-proposal-scroll" role="region" aria-label={t('comparisonRegion')} tabIndex={0}>
      <ClientStrategyProposal proposal={proposal} presentation={presentation?.kind === 'proposal' ? presentation : undefined} running={seed.status === 'live'} stale={stale} onCancel={dismiss} onApply={onApply ? async () => {
        const receipt = await onApply(proposal)
        if (!mounted.current) return
        setDiscussion(null); setNotice(receipt); setResumeFailed(false); input.current?.focus({ preventScroll: true })
      } : undefined} />
    </div>}
    {response && response.kind !== 'proposal' && presentation?.kind === 'answer' && <div ref={proposalScroll} className="cst-answer cst-proposal-scroll" role="region" aria-label={presentation.title} tabIndex={0}><b>{presentation.title}</b><p>{presentation.text}</p><div>
      {response.followup && <button type="button" onClick={() => onAsk(response.followup)}>{t(response.kind === 'explanation' ? 'deepAnalysis' : 'discuss')}</button>}
      <button type="button" onClick={dismiss}>{terminalReadText(language, 'close')}</button>
    </div></div>}
    {notice && <div className={`cst-apply-notice${appliedStopped ? ' cst-applied' : ''}`}>
      <span role="status">{appliedStopped ? t('appliedPaused', { version: notice.version }) : t('updated')}</span>
      {resumable && <button type="button" disabled={resuming} onClick={async () => {
        if (resumeLock.current || !onResume) return
        resumeLock.current = true; setResuming(true); setResumeFailed(false)
        try {
          await onResume(notice)
          if (mounted.current) { setNotice(null); input.current?.focus({ preventScroll: true }) }
        } catch { if (mounted.current) { setResumeFailed(true); input.current?.focus({ preventScroll: true }) } }
        finally { resumeLock.current = false; if (mounted.current) setResuming(false) }
      }}>{t('resumeApplied')}</button>}
    </div>}
    {resumeFailed && appliedStopped && <p className="cst-resume-error" role="alert">{t('resumeFailed')}</p>}
    <div className="cst-manage" role="group" aria-label={sourceQuestionText(language, 'manage')} onFocusCapture={event => revealControl(event.target)}>
      <small>{sourceQuestionText(language, 'manage')}</small>
      <button type="button" onClick={() => quick('sl')}>{sourceQuestionText(language, 'stop', { value: `${sharedNumber(seed.parameters.sl, language, 'auto')}%` })}</button>
      <button type="button" onClick={() => quick('tp')}>{sourceQuestionText(language, 'target', { value: seed.parameters.tp == null ? t('none') : `+${sharedNumber(seed.parameters.tp, language, 'auto')}%` })}</button>
      <button type="button" onClick={() => quick('budget')}>{sourceQuestionText(language, 'budget', { value: sourceMoney(seed.capital, currency, language) })}</button>
    </div>
    <div className="chips" onFocusCapture={event => revealControl(event.target)}>{sourceAgentPresets.map(preset => <button type="button" key={preset.key} onClick={() => ask(preset.request)}>{t(preset.key)}</button>)}</div>
    <form onFocusCapture={event => revealControl(event.target)} onSubmit={event => { event.preventDefault(); ask(draft) }}><input ref={input} value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} aria-label={t('inputLabel')} placeholder={t('inputPlaceholder')} onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }} /><button type="submit" aria-label={t('send')} disabled={!draft.trim()}>↵</button></form>
  </div>
}

/** Client reference preview controller. Native service adapters never import this module. */
export default function ClientSourceTerminalWorkspace({ menuHostRef, onNew, onAsk, accountState, onRead, onReadAll, onAccountNavigate, alertsRequest = 0, now, userStrategies = noUserStrategies, onUserStatus, accountDataMode = 'connection-required', onConnectExchange, previewBillingMode, onBeforeAi, selectionRequest, includeSamples = true, emptyDetail, emptyMarket, management, onSelectionChange, conditionalOrders }: {
  conditionalOrders?: { orders: readonly ConditionalOrderPreviewOrder[]; binding: string; onCancel?: (id: string) => unknown }
  menuHostRef?: Ref<HTMLDivElement>
  onNew: () => void; onAsk: (text: string) => void
  accountState?: SourceAccountEventState; onRead?: (id: string) => void; onReadAll?: () => void
  onAccountNavigate?: (hash: string) => void; alertsRequest?: number; now?: number
  userStrategies?: readonly SourceUserStrategyRecord[]
  onUserStatus?: (id: string, status: 'live' | 'off') => void | Promise<void>
  /** Explicit isolated reference preview only; never an exchange connection flag. */
  accountDataMode?: 'connection-required' | 'source-preview'
  onConnectExchange?: () => void
  /** Local source-preview state only; never a real billing or trading authority. */
  previewBillingMode?: 'active' | 'grace' | 'watch'
  onBeforeAi?: () => boolean
  /** One explicit parent navigation request, not a continuously controlled selection. */
  selectionRequest?: { id: string; sequence: number; management?: boolean }
  onSelectionChange?: (id: string | null) => void
  /** Isolated reference hosts may show samples; the account shell supplies false. */
  includeSamples?: boolean
  emptyDetail?: ReactNode
  emptyMarket?: ClientEmptyTerminalMarket
  management?: { label: string; backLabel: string; content: ReactNode }
}) {
  const [mountedAt] = useState(Date.now)
  const accountNow = now ?? mountedAt
  const [state, setState] = useState(initialSourceTerminalState)
  const latestState = useRef(state)
  const { seeds, operations, history } = state
  // Event handlers share one synchronous snapshot; effects never replay writes.
  const change = useCallback((update: (current: SourceTerminalState) => SourceTerminalState) => {
    const next = update(latestState.current)
    latestState.current = next; setState(next)
  }, [setState])
  const [menu, setMenu] = useState<{ id: string; trigger: HTMLElement; view?: 'versions' } | null>(null)
  const [trade, setTrade] = useState<{ id: string; entryIndex: number; version: string; fingerprint: string; trigger: HTMLElement } | null>(null)
  const [statusNotice, setStatusNotice] = useState<SourceStatusFailure | { kind: 'unavailable' | 'check' } | null>(null)
  // The latest deliberate status request owns the shared notice, not the last response.
  const noticeEpoch = useRef(0)
  const noticeTrigger = useRef<HTMLElement | null>(null)
  // The selected button may unmount while its callback is pending. Keep the
  // request lock at workspace scope, keyed by strategy, across rail navigation.
  const statusLocks = useRef(new Set<string>())
  const [pendingStatuses, setPendingStatuses] = useState<ReadonlySet<string>>(() => new Set())
  const control = useRef<ClientAccountTerminalControl>(null)
  useEffect(() => { if (alertsRequest > 0) control.current?.showBottom('alerts') }, [alertsRequest])
  const pendingSelection = useRef<string | null>(null)
  // Select a clone only after the updated entry exists in the child controller.
  useLayoutEffect(() => {
    if (!pendingSelection.current) return
    control.current?.select(pendingSelection.current, 'agent')
    pendingSelection.current = null
  }, [seeds])
  const { language, currency } = useClientPreferences()
  const t = (key: Parameters<typeof sourceContextText>[1], values?: Readonly<Record<string, string>>) => sourceContextText(language, key, values)
  const money: Money = (value, signed) => sourceMoney(value, currency, language, signed)
  const users = useMemo(() => userStrategies.map(projectUserTerminal).filter(item => item !== null).sort((a, b) => b.record.createdAt - a.record.createdAt), [userStrategies])
  const userIds = users.map(item => item.id).join(',')
  const previousUserIds = useRef(userIds)
  useLayoutEffect(() => {
    const previous = new Set(previousUserIds.current.split(','))
    const added = userIds.split(',').find(id => id && !previous.has(id))
    previousUserIds.current = userIds
    if (added) control.current?.select(added, 'agent')
  }, [userIds])
  const models = useMemo(() => [...users.flatMap(item => item.model ? [item.model] : []), ...(includeSamples ? seeds.map(seed => ({ seed, result: evaluateSourceTerminal(seed.parameters, seed.capital) })) : [])], [seeds, users, includeSamples])
  const researchChartPoints = useMemo(() => new Map(users.flatMap(user => user.record.origin === 'research' && user.model
    ? [[user.id, sourceChartPoints.slice(user.model.result.r.params.startI, user.model.result.r.params.endI + 1)] as const] : [])), [users])
  const tradeModel = trade ? models.find(model => model.seed.id === trade.id && model.seed.version === trade.version && sourceParameterFingerprint(model.seed.parameters) === trade.fingerprint) : undefined
  // A changed/deleted strategy must not reinterpret an already-open trade.
  if (trade && !tradeModel) setTrade(null)
  const tradeSteps = trade && tradeModel ? sourceTerminalLifecycle(tradeModel, trade.entryIndex, money, language) : null
  const openTrade = (id: string, entryIndex: number, trigger: HTMLElement, preservePanel = false) => {
    const model = models.find(item => item.seed.id === id)
    if (!model || !model.result.trades.some(item => item.entry === entryIndex)) return
    if (!preservePanel) control.current?.select(id, 'completed')
    setTrade({ id, entryIndex, version: model.seed.version, fingerprint: sourceParameterFingerprint(model.seed.parameters), trigger })
  }
  const events = useMemo(() => models.map(model => sourceAgentEvents(model.seed, model.result, (value, signed) => sourceMoney(value, currency, language, signed), language)), [models, currency, language])
  const operation = useCallback((label: string, text: string): ClientAgentOperation => ({ id: crypto.randomUUID(), timeLabel: new Date().toLocaleTimeString(language), label, text }), [language])
  const status = useCallback((id: string, next: 'live' | 'off') => change(current => setSourceTerminalStatus(current, id, next, operation(next === 'live' ? '실행 시작' : '중지', next === 'live' ? '전략 실행을 시작했어요 (시뮬레이션)' : '전략 실행을 중지했어요 (시뮬레이션)'))), [change, operation])
  const requestStatus = useCallback(async (id: string, next: 'live' | 'off', propagateFailure = false) => {
    const user = users.find(item => item.id === id)
    if (user) {
      if (!onUserStatus) { noticeEpoch.current++; noticeTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setStatusNotice({ kind: 'unavailable' }); return }
      if (statusLocks.current.has(id)) return
      const epoch = ++noticeEpoch.current
      noticeTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      statusLocks.current.add(id); setPendingStatuses(new Set(statusLocks.current))
      setStatusNotice(null)
      try { await onUserStatus(user.record.id, next); if (epoch === noticeEpoch.current) setStatusNotice(null) }
      catch (error) {
        // Menus own their sanitized inline error. Header/ledger use the existing
        // generic notice, never arbitrary callback/provider response text.
        if (propagateFailure) throw error
        if (epoch === noticeEpoch.current) setStatusNotice({ kind: 'check' })
      }
      finally { statusLocks.current.delete(id); setPendingStatuses(new Set(statusLocks.current)) }
      return
    }
    noticeEpoch.current++
    noticeTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    try { status(id, next); setStatusNotice(null) }
    // This is a local, fixed-source error, never an upstream service response.
    catch (error) { setStatusNotice(error instanceof SourceTerminalStatusError ? error.detail : { kind: 'check' }) }
  }, [users, onUserStatus, status, setStatusNotice])
  const reconnect = useCallback((id: string) => change(current => addSourceOperation({ ...current, seeds: current.seeds.map(seed => seed.id === id ? { ...seed, status: 'off', error: undefined } : seed) }, id, operation('연결 복구', '거래소 연결을 복구했어요. 전략은 중지 상태로 대기해요. 확인 후 재개하세요. (시뮬레이션)'))), [change, operation])
  const apply = async (proposal: SourceTerminalProposal) => {
    const applied = applySourceTerminalWithReceipt(latestState.current, proposal, operation('전략 수정', ''))
    change(() => applied.state)
    return applied.receipt
  }
  const resumeApplied = async (receipt: SourceAppliedReceipt) => change(current => resumeSourceApplied(current, receipt, operation('실행 시작', '전략 실행을 시작했어요 (시뮬레이션)')))
  const modelEntries: ClientAccountTerminalEntry[] = models.map((model, index) => {
    const { seed, result } = model, exchange = CLIENT_BROKERS.find(broker => broker.id === seed.exchangeId) ?? { id: seed.exchangeId, name: users.find(item => item.id === seed.id)?.record.exchangeName ?? t('unknownExchange'), col: 'var(--gp)', fg: 'var(--gt)' }
    const user = users.find(item => item.id === seed.id)
    const markers = result.L.evs.filter(ev => ev.k === 'entry' || ev.k.startsWith('exit')).map(ev => ({ id: `${seed.id}:${ev.i}`, time: sourceChartTime(ev.i), side: ev.k === 'entry' ? 'BUY' as const : 'SELL' as const }))
    return { strategy: { id: seed.id, name: seed.name, symbol: seed.symbol, market: seed.market, version: seed.version, status: seed.status, exchange: { id: exchange.id, name: exchange.name, color: exchange.col, foreground: exchange.fg }, capitalLabel: money(seed.capital), pnlLabel: money(result.pnl, true), pnlPercentLabel: sourcePercent(result.pnlPct), pnlTone: sourceTone(result.pnl), pnlKind: 'validation', error: seed.error }, chart: null,
      chartContent: <ClientSourceCloseChart points={researchChartPoints.get(seed.id) ?? sourceChartPoints} markers={markers} />,
      context: <div className="cst-context-note">{t('context')}{user && ` · ${t(user.record.environment === 'paper' ? 'paper' : 'liveSimulation')}`}</div>,
      // Source tfTmCtx labels belong exclusively to this simulated producer.
      contextStatus: accountDataMode === 'source-preview' && !user
        ? seed.status === 'live' ? sourceJudgmentText(language, 'scope', { date: sourceDay(result.r.params.endI) }) : t(seed.status === 'err' ? 'evaluationStopped' : 'evaluationWaiting')
        : undefined,
      contextTools: <SourceContextActions key={seed.id} seed={seed} disabled={pendingStatuses.has(seed.id) || user !== undefined && onUserStatus === undefined} onStatus={requestStatus} onReconnect={reconnect} />,
      statusHeader: <ClientSourceJudgmentStatus seed={seed} result={result} exchangeName={exchange.name} preview={accountDataMode === 'source-preview' && !user} watch={previewBillingMode === 'watch'} />,
      agent: <><ClientAgentFeed ruleJournal strategyId={seed.id} events={events[index]} operations={operations[seed.id]} error={seed.error} onReconnect={() => reconnect(seed.id)} sourceLabel={t('sourceLabel')}
        statusSummary={previewBillingMode === 'watch' ? billingText(language, 'standbyDescription') : undefined}
        />{user && <div className="cst-context-actions"><button type="button" disabled={!onAccountNavigate} onClick={() => onAccountNavigate?.(`#/trade/bot/${user.record.id}`)}>{strategyActionsText(language, 'detail')}</button></div>}<SourceAgentComposer key={seed.id} model={model} onAsk={onAsk} onApply={user ? undefined : apply} canResume={user ? undefined : receipt => canResumeSourceApplied(state, receipt)} onResume={user ? undefined : resumeApplied} onBeforeAi={onBeforeAi ?? (() => previewBillingMode !== 'watch')} /></>,
      dashboard: <SourceDashboard model={model} money={money} onTrade={(id, index, trigger) => openTrade(id, index, trigger, true)} onVersions={(id, trigger) => setMenu({ id, trigger, view: 'versions' })} />, completed: <SourceCompleted model={model} money={money} onTrade={openTrade} />,
    }
  })
  const missingEntries: ClientAccountTerminalEntry[] = users.filter(user => !user.model).map(user => {
    const r = user.record, broker = CLIENT_BROKERS.find(item => item.id === r.exchangeId)
    return { strategy: { id: user.id, name: r.name, symbol: r.asset ? `${r.asset}/KRW` : '자산 미확인', market: r.environment === 'paper' ? '위임 실행 · 가상' : '위임 실행 · 시뮬레이션', version: r.version ?? '—', status: r.status,
      exchange: { id: r.exchangeId ?? 'unlinked', name: r.exchangeName ?? broker?.name ?? t('unknownExchange'), color: broker?.col ?? 'var(--gp)', foreground: broker?.fg ?? 'var(--gt)' }, capitalLabel: r.capital === undefined ? '투자금 미확인' : money(r.capital) }, chart: null,
      context: <div className="cst-context-actions"><span>저장된 검증 결과 · 계산 설정 미공급</span><button type="button" disabled={!onAccountNavigate} onClick={() => onAccountNavigate?.(`#/trade/bot/${r.id}`)}>{strategyActionsText(language, 'detail')}</button></div>,
      agent: <ClientAgentFeed strategyId={user.id} events={null} sourceLabel="저장된 전략 설정 확인 필요" />,
      dashboard: <div className="cst-dashboard"><h3>저장된 검증 결과</h3><dl className="cst-matrix">{[['TETH Score', `${r.score}`], ['검증 수익률', sourcePercent(r.ret)], ['최대 낙폭', `${r.mdd}%`], ['거래 수', `${r.n}회`], ['승률', `${r.winRate}%`]].map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>,
      completed: <p className="cst-empty">체결 기록을 확인하지 못했습니다.</p>,
    }
  })
  const entries = [...users.flatMap(user => {
    const entry = modelEntries.find(item => item.strategy.id === user.id) ?? missingEntries.find(item => item.strategy.id === user.id)
    return entry ? [entry] : []
  }), ...modelEntries.filter(entry => !entry.strategy.id.startsWith('user:'))]
  const appliedSelectionRequest = useRef<{ id: string; sequence: number } | null>(null)
  const requestedSelectionId = entries.find(entry => entry.strategy.id === selectionRequest?.id)?.strategy.id
  const requestedSelectionSequence = selectionRequest?.sequence
  const requestedManagement = selectionRequest?.management
  useLayoutEffect(() => {
    if (requestedSelectionId === undefined || requestedSelectionSequence === undefined || !control.current
      || appliedSelectionRequest.current?.id === requestedSelectionId && Object.is(appliedSelectionRequest.current.sequence, requestedSelectionSequence)) return
    // A late entry may satisfy a still-pending request. Once applied, rebuilt
    // entries or preferences must not override the user's subsequent selection.
    control.current.select(requestedSelectionId, undefined, requestedManagement)
    appliedSelectionRequest.current = { id: requestedSelectionId, sequence: requestedSelectionSequence }
  }, [requestedSelectionId, requestedSelectionSequence, requestedManagement])
  const menuEntry = entries.find(entry => entry.strategy.id === menu?.id)
  return <div className="client-restored-research client-source-terminal">
    <ClientAccountTerminal menuHostRef={menuHostRef} entries={entries} emptyDetail={emptyDetail} emptyMarket={emptyMarket} management={management} onSelectionChange={onSelectionChange} initialSelectedId={users[0]?.id} controlRef={control} onNew={onNew} onMenu={(id, trigger) => setMenu({ id, trigger })} onReconnect={reconnect}
      headerTools={accountState && onAccountNavigate && <ClientAccountBell unread={accountState.notifs.filter(item => !item.read).length} onOpen={() => control.current?.showBottom('alerts')} />}
      notice={statusNotice ? <p className="cst-status-notice" role="alert"><span>{t(statusNotice.kind, statusNotice.kind === 'belowThreshold' ? { score: sharedNumber(statusNotice.score, language, 'auto') } : undefined)}</span><button type="button" aria-label={t('closeStatus')} onClick={event => {
        const root = event.currentTarget.closest('.ctt-terminal')
        // Separate queries preserve fallback priority instead of DOM order.
        const candidates = [noticeTrigger.current, ...root?.querySelectorAll<HTMLElement>('.cat-context-tools button') ?? [], ...root?.querySelectorAll<HTMLElement>('.ctt-selector-button') ?? [], ...root?.querySelectorAll<HTMLElement>('.ctt-main-tabs [aria-selected="true"]') ?? [], ...root?.querySelectorAll<HTMLElement>('.cat-tabs [aria-selected="true"]') ?? [], ...root?.querySelectorAll<HTMLElement>('.ctt-header button') ?? [], root?.querySelector<HTMLElement>('.ctt-header h2')]
        const target = candidates.find(element => element?.isConnected && root?.contains(element) && element.matches('button,a[href],input,textarea,select,summary,[tabindex]') && element.getClientRects().length && !element.matches(':disabled') && !element.closest('[hidden],[inert]') && getComputedStyle(element).visibility === 'visible')
        noticeEpoch.current++; setStatusNotice(null)
        target?.focus({ preventScroll: true })
      }}>{t('close')}</button></p> : undefined}
      railFooter={t('railFooter')}
      renderBottom={(selectedId, scope) => [
        ...(accountDataMode === 'source-preview'
          ? sourceTerminalBottomTabs({ models, selectedId, scope, money, onSelect: id => control.current?.select(id), onPause: id => requestStatus(id, 'off'), pauseDisabled: id => pendingStatuses.has(id) || id.startsWith('user:') && !onUserStatus, onTrade: (id, index, trigger) => openTrade(id, index, trigger, true) })
          : (['pos', 'open', 'orders', 'fills', 'closed', 'assets'] as const).map(id => ({ id, label: clientTerminalText(language, id), content: <>{id === 'open' && conditionalOrders?.orders.length ? <div className="co-pending-preview client-terminal-ledger" data-order-source="mock"><div className="tft-tblw"><table className="tft-tbl"><thead><tr>{['거래소', '전략', '심볼', '방향', '유형', '가격', '수량', '상태', ''].map((label, index) => <th scope="col" key={index}>{label}</th>)}</tr></thead><tbody><ClientConditionalOrderPendingRows source="mock" {...conditionalOrders} /></tbody></table></div></div> : null}<ClientTerminalConnectionEmpty onConnect={onConnectExchange} /></> }))),
        ...(accountState && onAccountNavigate ? [
          // Source 2436a1f: six trading tabs; notifications remain accessible through the bell.
          { id: 'alerts', label: '알림', hiddenFromTabs: true, count: accountState.notifs.filter(item => !item.read).length, content: <ClientAccountAlerts state={accountState} now={accountNow} money={money} onRead={onRead} onReadAll={onReadAll} onNavigate={onAccountNavigate} /> },
        ] : []),
      ]} />
    {trade && tradeModel && tradeSteps && <ClientTradeLifecycle title={lifecycleText(language, 'title', { asset: tradeModel.seed.asset })} steps={tradeSteps} trigger={trade.trigger} onClose={() => setTrade(null)} />}
    {menu && menuEntry && <ClientStrategyActions key={menu.id} strategy={menuEntry.strategy} trigger={menu.trigger} initialView={menu.view} onClose={() => setMenu(null)} exchanges={CLIENT_BROKERS.map(broker => ({ id: broker.id, name: broker.name }))} versionHistory={users.some(item => item.id === menu.id) ? undefined : history[menu.id] ?? []}
      cloneDescription={strategyActionsText(language, 'cloneDescription')} cloneExchangeNote={strategyActionsText(language, 'cloneExchangeNote')}
      callbacks={users.some(item => item.id === menu.id) ? { onDetail: onAccountNavigate ? id => onAccountNavigate(`#/trade/bot/${id.slice(5)}`) : undefined, onStatus: onUserStatus && !pendingStatuses.has(menu.id) ? async (id, next) => { await requestStatus(id, next, true) } : undefined } : { onDetail: id => control.current?.select(id, 'dashboard'), onRename: async (id, name) => change(current => addSourceOperation({ ...current, seeds: current.seeds.map(seed => seed.id === id ? { ...seed, name } : seed) }, id, operation('이름 변경', `전략 이름을 "${name}"(으)로 변경했어요`))),
        onClone: async (id, exchangeId) => change(current => {
          const seed = current.seeds.find(item => item.id === id)
          if (!seed) throw new Error('전략을 찾을 수 없습니다.')
          const exchange = CLIENT_BROKERS.find(broker => broker.id === (exchangeId ?? seed.exchangeId))
          if (!exchange) throw new Error('거래소를 확인해주세요.')
          const copyId = `clone:${crypto.randomUUID()}`
          pendingSelection.current = copyId
          const copy: SourceTerminalSeed = { ...seed, id: copyId, name: `${seed.name}${exchangeId ? ` (${exchange.name})` : ' 사본'}`, parameters: { ...seed.parameters }, exchangeId: exchange.id, version: 'v1.0', status: 'ready', error: undefined }
          return addSourceOperation({ ...current, seeds: [copy, ...current.seeds] }, copyId, operation('복제됨', `"${seed.name}" ${seed.version}에서 복제됨, 실행 전 상태로 대기`))
        }),
        onStatus: async (id, next) => status(id, next), onDelete: async id => change(current => {
          if (current.seeds.find(seed => seed.id === id)?.status === 'live') throw new Error('먼저 전략 실행을 중지해주세요.')
          return { seeds: current.seeds.filter(seed => seed.id !== id), operations: Object.fromEntries(Object.entries(current.operations).filter(([key]) => key !== id)), history: Object.fromEntries(Object.entries(current.history).filter(([key]) => key !== id)) }
        }),
      }} />}
  </div>
}
