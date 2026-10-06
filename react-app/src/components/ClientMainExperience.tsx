import { ClientQuestionDockProvider } from './ClientQuestionDock'
import { Fragment, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { connectionPlanHash, readConnectionPlanLocation, type ConnectionPlanLocation } from '../client-connection-plan'
import { readConnectionResult } from '../client-connection-result'
import { commonResultContext, completedCommonRevisionSource, type CommonResultContext } from '../client-common-revision'
const ClientConnectionPlan = lazy(() => import('./ClientConnectionPlan'))
import { MoreHorizontal } from 'lucide-react'
import { ClientAnswerActions } from './ClientAnswerActions'
import { ClientChrome, type ClientMenuAnchor } from './ClientChrome'
import { ClientAccountBell } from './ClientAccountBell'
import { createClientAccountEventStore } from '../client-account-event-store'
import { useCopyPreviewAccount } from '../use-copy-preview-account'
import { useCatalogueCopyAccount } from '../use-catalogue-copy-account'
import type { TerminalMarketSource } from '../client-terminal-market-source'
import type { CatalogueCopySetup } from '../client-catalogue-copy-setup'
import { catalogueBacktestRunId, type CatalogueBacktestUseBinding } from '../client-catalogue-backtest'
import { catalogueBacktestLocation, catalogueCopyLocation } from '../client-shared-navigation'
import { ClientTerminalCopies } from './ClientTerminalCopies'
const ClientCatalogueTerminalBinding = lazy(() => import('./ClientCatalogueTerminalBinding').then(module => ({ default: module.ClientCatalogueTerminalBinding })))
import terminalCopyWords from '../client-terminal-copies-copy.json'
import { shellText } from '../client-shell-copy'
import { useBillingPreview } from '../use-billing-preview'
import { useClientUsagePreview, createClientUsagePreviewStore, projectClientUsagePreview } from '../use-client-usage-preview'
import { evaluateMockUsageAdmission } from '../client-usage-admission'
import { usageGate, usageText, type UsageTier } from '../client-usage-presentation'
import { ClientUsageBanner } from './ClientUsageBanner'
import { useClientConditionalOrders } from '../use-client-conditional-orders'
import { readConditionalOrderTag, conditionalOrderTurnId } from '../client-conditional-order-intake'
import { canAdmitMockConditionalOrderTurn, canDisplayLegacyConditionalOrderTurn } from '../client-conditional-order-turn-binding'
import { ClientConditionalOrderCard } from './ClientConditionalOrderCard'
import { ClientConnectionStatus, type ClientConnectionStatusProps } from './ClientConnectionStatus'
import { createBillingPreviewStore } from '../client-billing-preview-store'
import { checkBillingPreview } from '../client-billing-preview-gate'
import { billingText } from '../client-billing-copy'
import { withBillingPreviewNotifications } from '../client-billing-notifications'
import { createClientUserStrategyStore, type ClientStrategyRegistration } from '../client-user-strategy-store'
import { clientResearchRegistration, registeredResearch, requireCompletedResearchRegistration } from '../client-research-registration'
import { canOpenBaseResearch, researchPlanContext, researchScope } from '../client-research-lifecycle'
import { createDelegationConnectionLocator, canResumeDelegationConnection } from '../client-delegation-connection'
import { createClientReportUpgradeStore } from '../client-report-upgrade'
import { createClientSubscriptionIntentStore, type SubscriptionCycle } from '../client-subscription-intent'
import { createClientSharingPreferencesStore, type SharingPreferences } from '../client-sharing-preferences'
import sharingPreferenceCopy from '../client-sharing-preference-copy.json'
import { readDelegationUi, resolveDelegationProgress } from '../client-delegation-fixtures'
import { inlineConnectionMatches, inlinePending, projectInlineConnectionUi, type InlineBacktestRecord } from '../client-inline-backtest'
import { ClientInlineBacktest } from './ClientInlineBacktest'
import { commonTurn, isCommonBacktestRoute, type CommonBacktestPreview } from '../client-common-backtest-preview'
import { commonSelectionVisible, responseStrategyForTurn } from '../client-response-strategy'
import { revisionText } from '../client-common-revision-copy'
import { ClientCommonResultCard, ClientCommonRevisionProposal } from './ClientCommonRevision'
import { ClientCommonRevisionDirection } from './ClientCommonRevisionDirection'
import { commonBacktestText } from '../client-common-backtest-copy'
import ClientCommonStrategySummary from './ClientCommonStrategySummary'
import ClientSourceIntake from './ClientSourceIntake'
import { sourceIntakePreview } from '../client-source-intake'
import { sourceIntakeText } from '../client-source-intake-copy'
import { describeSharedFollow } from '../client-shared-follow'
import { isClientAccountEntry, readClientAccountLocation, type ClientAccountLocation } from '../client-account-navigation'
import { useClientPreferences } from '../client-preferences'
import { useClientPreviewToast } from '../use-client-preview-toast'
import { upgradeText } from '../client-upgrade-copy'
import { sourceMoney } from '../client-preview-money'
import { ClientHomeSurface } from './ClientHomeSurface'
import { ClientSiteFooter } from './ClientSiteFooter'
import { composeTemplatePrompt, type HomeTemplateSelection } from '../client-home-gallery'
import { ClientConversation, ClientUserMessage } from './ClientConversation'
import { ClientClarificationCard } from './ClientClarificationCard'
import { intakeCard } from '../client-intake-card'
import { useConversationCopy, type ConversationCopyKey } from '../client-conversation-copy'
import { clientResearchLabel, previousResearchLabel } from '../client-research-label'
import { ClientResponseSequence } from './ClientResponseSequence'
import { ClientStoredMarketResponse, type ClientMarketChartSource } from './ClientStoredMarketResponse'
import { ClientFollowups } from './ClientFollowups'
import { ClientContinueResponse } from './ClientContinueResponse'
import { ClientRetryResponse } from './ClientRetryResponse'
import { canContinuePreview } from '../client-continuation'
import { canRetryPreview, isEmptyInterruptedResponse } from '../client-response-retry'
import { shareBrowseLabel, shareBrowseTurnId } from '../client-share-browse'
import { ClientResponseSourceBridge, type ClientResponseSource } from './ClientResponseSourceBridge'
import type { MarketQuestionActions } from '../client-market-question-presentation'
import { marketQuestionText } from '../client-market-question-copy'
import { marketBindingKey } from '../client-market-response-presentation'
import { ClientLocalePanel } from './ClientLocalePanel'
import { ClientAuthDialog, ClientFeedbackDialog, ClientProfileMenu, ClientSettingsMenu, type ClientProfile } from './ClientAccountUI'
import { ClientResearchWorkspace } from './ClientResearchWorkspace'
import { NativeConversationTitle } from '../internal-poc/NativeConversationTitle'
import { ClientDelegationWorkspace } from './ClientDelegationWorkspace'
import { ClientResearchHub } from './ClientResearchHub'
import { ClientLoadBoundary, ClientLoadFallback } from './ClientLoadBoundary'
import { ConversationCosmos } from './ConversationCosmos'
import { createClientExperienceStore, InlineConnectionError, type ClientSession, type ClientTurn } from '../client-experience-store'
import { getSitePage, pushSiteLocation } from '../site-navigation'
import { closeClientSettingsRoute, openClientSettings, useClientSettingsRoute } from '../use-client-settings-route'
import { readClientSettingsLocation } from '../client-settings-navigation'
import { ClientSettingsPage } from './ClientSettingsPage'
import type { ResearchPage, ResearchRecord } from '../research-library'
import { createClientStrategyCreatorStore, getCreatorCandidate, type CreatorPublishRequest } from '../client-strategy-creator-store'
import { ClientInsightQuestionError, clientInsightHash, readClientInsightLocation, type ClientInsightLocation } from '../client-insight-navigation'
import type { SharedCopyRequest } from '../client-shared-copy'
import { catalogueSourceSha, findCatalogueStrategy } from '../client-catalogue'
import { readCataloguePlanIntent } from '../client-catalogue-plan'
import { readSharedLocation, sharedHash, type SharedLocation } from '../client-shared-strategies'
import '../client-main-experience.css'
import '../client-home-layout.css'

const accountNoticeCopy = { 'subscription-needs-strategy': 'subscribeFromPlanNotice' } as const satisfies Record<string, Parameters<typeof upgradeText>[1]>
type AccountNotice = string | { kind: keyof typeof accountNoticeCopy | 'billing-blocked' | 'billing-unavailable' | 'billing-clock' | 'sharing-clear-failed' }
const subscriptionNeedsStrategy: AccountNotice = { kind: 'subscription-needs-strategy' }

const ClientHelp = lazy(() => import('./ClientHelp').then(module => ({ default: module.SiteHelp })))
const ClientCommonBacktest = lazy(() => import('./ClientCommonBacktest'))
const ClientSourceTerminalWorkspace = lazy(() => import('./ClientSourceTerminalWorkspace'))
const ClientAccountPlan = lazy(() => import('./ClientAccountActivity').then(module => ({ default: module.ClientAccountPlan })))
const ClientTradingIntro = lazy(() => import('./ClientTradingIntro'))
const ClientAccountReview = lazy(() => import('./ClientAccountActivity').then(module => ({ default: module.ClientAccountReview })))
const ClientAccountPeriodic = lazy(() => import('./ClientAccountActivity').then(module => ({ default: module.ClientAccountPeriodic })))
const ClientUserStrategy = lazy(() => import('./ClientUserStrategy').then(module => ({ default: module.ClientUserStrategy })))
const ClientUpgradeSheet = lazy(() => import('./ClientUpgradeSheet').then(module => ({ default: module.ClientUpgradeSheet })))
type PreviewProfile = ClientProfile & { previewId?: string }
const previewOwner = (profile: PreviewProfile | null) => profile ? profile.email || profile.previewId || 'preview-social' : null
const ownerRecoveryMessage = '현재 계정의 전략 기록을 다시 확인해주세요.'
const uncertainCommitMessage = '저장 여부를 확인할 수 없어요. 새로고침해 저장된 기록을 확인해주세요.'
const uncertainCommitGuidance = '저장 여부를 확인할 수 없어요. 추가 변경 전에 새로고침해 저장된 기록을 확인해주세요.'
function resumableConnectionUi(target: ClientSession) {
  const ui = projectInlineConnectionUi(target, readDelegationUi(target.id))
  if (!canResumeDelegationConnection(ui) || ui?.inlineResult && !inlineConnectionMatches(target, ui)) return undefined
  return ui
}

function resultContextVisible(turn:ClientTurn,owner:string|null){
  return (!turn.commonResultContext||turn.commonResultContext.owner===owner)&&(!turn.commonRevision||turn.commonRevision.owner===owner)
}
function ConversationTurn({ turn, onEdit, owner, marketResponse, summarized = false }: { turn: ClientTurn; onEdit: (text: string) => void; owner: string | null; marketResponse?: ReactNode; summarized?: boolean }) {
  const { c } = useConversationCopy()
  const thinking = turn.status === 'running' && !turn.answer
  const status = thinking ? 'running' : turn.status === 'stopped' ? 'stopped' : turn.status === 'failed' ? 'failed' : 'done'
  const observed = Boolean(turn.responseSequence || turn.responseSequenceInvalid)
  const visible = !observed || turn.responseSequence?.owner === owner
  if(turn.commonRevision&&turn.commonRevision.owner!==owner)return null
  if(turn.commonResultContext&&turn.commonResultContext.owner!==owner)return null
  return <Fragment>
    {!summarized && <ClientUserMessage onEdit={onEdit} resultCard={turn.commonResultContext&&<ClientCommonResultCard context={turn.commonResultContext}/>}>{turn.question}</ClientUserMessage>}
    {!observed && !turn.sourceIntake && !turn.sourceIntakeInvalid && <ClientResponseSequence source="mock" blocks={[
      { id: `${turn.id}:work`, kind: 'work', activity: {
        label: c(thinking ? 'thinkingSummary' : turn.status === 'stopped' ? 'workStopped' : turn.status === 'failed' ? 'failed' : 'workDone'), status,
        startedAt: turn.startedAt, finishedAt: turn.finishedAt ?? (thinking ? undefined : turn.startedAt + 1800),
        // Latest source removed its canned narrator. No summary exists in this
        // local turn record, so retain the source heading without invented prose.
        steps: [{ id: 'thinking', title: c(thinking ? 'thinking' : 'thoughtDone'), status }],
      } },
      { id: `${turn.id}:answer`, kind: 'text', text: turn.answer, status: turn.status === 'running' ? 'streaming' : turn.status === 'stopped' || turn.status === 'failed' ? 'interrupted' : 'done' },
    ]} />}
    {marketResponse}
    {visible && turn.status === 'done' && turn.answer.trim() && <ClientAnswerActions key={JSON.stringify(owner)} text={turn.answer} />}
    {visible && turn.status === 'stopped' && <p className="client-stopped" role="status">{c('responseStopped')}</p>}
  </Fragment>
}

function visibleMarketBlocks(turn: ClientTurn, owner: string | null) {
  if (turn.marketResponse?.owner !== owner || turn.responseSequenceInvalid
    || turn.responseSequence && turn.responseSequence.owner !== owner) return []
  return turn.marketResponse.blocks.filter(block => !turn.responseSequence
    || turn.responseSequence.blocks.some(item => item.kind === 'market-ref' && item.blockId === block.id))
}

function SessionMenu({ title, onRename, onDelete }: { title: string; onRename: (text: string) => void; onDelete: () => void }) {
  const { c } = useConversationCopy()
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [armed, setArmed] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const click = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const navigate = () => setOpen(false)
    const key = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (!ref.current?.contains(e.target as Node)) return
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus() }
      if (!renaming && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('.client-session-pop button') ?? [])
        if (!items.length) return
        e.preventDefault()
        const index = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
        items[next]?.focus()
      }
    }
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', key)
    window.addEventListener('popstate', navigate); window.addEventListener('teth:navigate', navigate); window.addEventListener('hashchange', navigate)
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key); window.removeEventListener('popstate', navigate); window.removeEventListener('teth:navigate', navigate); window.removeEventListener('hashchange', navigate) }
  }, [open, renaming])
  useEffect(() => { if (open && !renaming) ref.current?.querySelector<HTMLButtonElement>('.client-session-pop button')?.focus() }, [open, renaming])
  useEffect(() => { if (renaming) { input.current?.focus(); input.current?.select() } }, [renaming])
  return <div className="client-session-options" ref={ref}>
    <button ref={trigger} type="button" aria-label={c('conversationMenu')} aria-expanded={open} onClick={() => { setOpen(!open); setArmed(false); setRenaming(false) }}><MoreHorizontal size={18} /></button>
    {open && <div className="client-session-pop" aria-label={c('manageConversation')}>{renaming ? <form onSubmit={e => { e.preventDefault(); const value = input.current?.value.trim(); if (value) { onRename(value); setOpen(false); trigger.current?.focus() } }}><input ref={input} defaultValue={title} maxLength={120} aria-label={c('strategyName')} /><button type="submit">{c('save')}</button></form> : <><button type="button" onClick={() => setRenaming(true)}>{c('rename')}</button><button className="danger" type="button" onClick={() => { if (armed) { onDelete(); setOpen(false) } else setArmed(true) }}>{c(armed ? 'confirmDelete' : 'delete')}</button></>}</div>}
  </div>
}

// Event-only adapter: the timestamp is captured at confirmation, never render.
function publishCreatorAtConfirmation(store: ReturnType<typeof createClientStrategyCreatorStore>, request: CreatorPublishRequest) {
  store.publish(request, Date.now())
}

// Capture the account clock at the event boundary, not inside a state updater.
function refreshAccountClockAtEvent(setClock: (timestamp: number) => void) {
  setClock(Date.now())
}

/** Source-first entry point. The older funnel is NOT rendered in this shell.
 * UI preview adapters remain isolated from approved service/execution contracts.
 */
export function ClientMainExperience({ marketChartSource, terminalMarketSource, responseSource, connectionStatus, catalogueCopySetup }: { marketChartSource?: ClientMarketChartSource; terminalMarketSource?: TerminalMarketSource; responseSource?: ClientResponseSource; connectionStatus?: Omit<ClientConnectionStatusProps, 'scope' | 'source'>; catalogueCopySetup?: CatalogueCopySetup } = {}) {
  const [terminalMenuHost, setTerminalMenuHost] = useState<HTMLDivElement | null>(null)
  const { c, language } = useConversationCopy()
  const { currency } = useClientPreferences()
  const { toast: authToast, showToast: showAuthToast } = useClientPreviewToast()
  const unavailableResponseSource = useRef<ClientResponseSource | undefined>(undefined)
  const responseBridgeSource = useMemo(() => responseSource && ({ ...responseSource,
    subscribe: ((receive, signal) => {
      try { return responseSource.subscribe(receive, signal) }
      catch (error) { unavailableResponseSource.current = responseSource; throw error }
    }) as ClientResponseSource['subscribe'],
  }), [responseSource])
  const [store] = useState(createClientExperienceStore)
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const session = state.sessions.find(s => s.id === state.currentId)
  const [profile, setProfile] = useState<PreviewProfile | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('teth-client-profile-preview') || 'null')
      return saved && typeof saved.name === 'string' && typeof saved.email === 'string'
        ? { name: saved.name, email: saved.email, ...(typeof saved.previewId === 'string' && saved.previewId.trim() ? { previewId: saved.previewId } : {}) } : null
    } catch { return null }
  })
  const owner = previewOwner(profile)
  // Navigation intent only, scoped to this mounted account lifetime. History
  // from a previous login or document must not resurrect a terminal context.
  const terminalPlanScope = useRef<{ owner: string; token: string } | null>(null)
  const readTerminalPlanReturn = () => {
    const intent: unknown = history.state?.tethPlanTerminal
    const scope = terminalPlanScope.current
    if (!scope || scope.owner !== owner || !intent || typeof intent !== 'object') return null
    return 'owner' in intent && intent.owner === owner && 'token' in intent && intent.token === scope.token ? scope : null
  }
  useLayoutEffect(() => {
    store.setLocalBacktestFlow(requestOwner => {
      const expectedOwner = requestOwner === undefined ? owner : requestOwner
      const unavailable = unavailableResponseSource.current
      return responseSource && typeof responseSource.id === 'string' && responseSource.id.trim()
        && typeof responseSource.subscribe === 'function' && responseSource.owner === expectedOwner
        && !(unavailable && unavailable.id === responseSource.id && unavailable.owner === responseSource.owner) ? 'common' : 'inline'
    })
  }, [store, responseSource, owner])
  const copies = useCopyPreviewAccount(owner)
  const catalogueCopies = useCatalogueCopyAccount(owner)
  const [connectionLocator, setConnectionLocator] = useState(() => ({ owner, store: createDelegationConnectionLocator(owner) }))
  if (connectionLocator.owner !== owner) setConnectionLocator({ owner, store: createDelegationConnectionLocator(owner) })
  const [accountStore, setAccountStore] = useState(() => ({ owner, store: createClientAccountEventStore(owner) }))
  if (accountStore.owner !== owner) setAccountStore({ owner, store: createClientAccountEventStore(owner) })
  const account = useSyncExternalStore(accountStore.store.subscribe, accountStore.store.getSnapshot)
  const billing = useBillingPreview(owner)
  const [usageNow, setUsageNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setUsageNow(Date.now()), 60_000); return () => clearInterval(timer) }, [])
  const usage = useClientUsagePreview({ owner, state: billing.state, now: usageNow })
  const orders = useClientConditionalOrders({ owner, currentSessionId: state.currentId, sessionIds: state.sessions.map(item => item.id) })
  const orderTurnViews = useMemo(() => {
    const byId = new Map(orders.currentOrders.map(order => [order.id, order]))
    return new Map((session?.turns ?? []).map(turn => {
      const admitted = canAdmitMockConditionalOrderTurn(turn, owner)
      const legacy = canDisplayLegacyConditionalOrderTurn(turn, owner)
      const parsed = admitted || legacy ? readConditionalOrderTag(turn.answer) : null
      const id = session ? conditionalOrderTurnId(session.id, turn.id) : null
      return [turn.id, { answer: parsed?.cleanText ?? turn.answer, legacy: Boolean(legacy && parsed), order: admitted && id ? byId.get(id) : undefined }] as const
    }))
  }, [session, owner, orders.currentOrders])
  const observeOrder = orders.observe
  useEffect(() => {
    if (!session) return
    for (const turn of session.turns) {
      // Only explicit completed local Mock text; service/model commands confer no authority.
      if (canAdmitMockConditionalOrderTurn(turn, owner)) observeOrder(session.id, turn.id, turn.answer)
    }
  }, [session, owner, observeOrder])
  const accountPresentation = useMemo(() => withBillingPreviewNotifications(account.state, billing.notifications, language), [account.state, billing.notifications, language])
  const readAccountNotification = (id: string) => { if (id.startsWith('billing:')) billing.store.read(id); else accountStore.store.read(id) }
  const readAllAccountNotifications = () => { accountStore.store.readAll(); billing.store.readAll() }
  const [reportUpgrade, setReportUpgrade] = useState(() => ({ owner, store: createClientReportUpgradeStore(owner) }))
  if (reportUpgrade.owner !== owner) setReportUpgrade({ owner, store: createClientReportUpgradeStore(owner) })
  const [subscriptionIntent, setSubscriptionIntent] = useState(() => ({ owner, store: createClientSubscriptionIntentStore(owner) }))
  if (subscriptionIntent.owner !== owner) setSubscriptionIntent({ owner, store: createClientSubscriptionIntentStore(owner) })
  const [sharingPreferences, setSharingPreferences] = useState(() => ({ owner, store: createClientSharingPreferencesStore(owner) }))
  if (sharingPreferences.owner !== owner) setSharingPreferences({ owner, store: createClientSharingPreferencesStore(owner) })
  const sharingView = useSyncExternalStore(sharingPreferences.store.subscribe, sharingPreferences.store.getSnapshot)
  const sharingLifetime = useRef({ owner, store: sharingPreferences.store, alive: false })
  useLayoutEffect(() => {
    const scope = { owner, store: sharingPreferences.store, alive: true }
    sharingLifetime.current = scope
    return () => { scope.alive = false }
  }, [owner, sharingPreferences.store])
  const [userStrategies, setUserStrategies] = useState(() => ({ owner, store: createClientUserStrategyStore(owner) }))
  if (userStrategies.owner !== owner) setUserStrategies({ owner, store: createClientUserStrategyStore(owner) })
  const [connectionEntry, setConnectionEntry] = useState<{ owner: string | null; sessionId: string; registeredId: string | null } | null>(() => {
    // Restore only the previously open connection view, not onboarding secrets
    // or account entitlement. Ordinary registered conversations remain unchanged.
    if (!profile || !owner) return null
    const current = store.getSnapshot()
    const target = current.sessions.find(item => item.id === current.currentId)
    if (!target || target.workspace !== 'delegation' || target.id !== connectionLocator.store.read()
      || target.sharedCopy && target.sharedCopy.owner !== owner) return null
    const ui = resumableConnectionUi(target)
    if (ui?.page !== 'connect') return null
    const registered = userStrategies.store.getSnapshot().entries.find(item => item.sessionId === target.id)
    return registered ? { owner, sessionId: target.id, registeredId: registered.record.id } : null
  })
  if (connectionEntry && connectionEntry.owner !== owner) setConnectionEntry(null)
  const registrations = useSyncExternalStore(userStrategies.store.subscribe, userStrategies.store.getSnapshot)
  const registeredStrategies = useMemo(() => registrations.entries.map(item => item.record), [registrations.entries])
  const [creatorStore, setCreatorStore] = useState(() => ({ owner, source: userStrategies.store, store: createClientStrategyCreatorStore(owner, () => userStrategies.store.getSnapshot().entries.map(item => item.record)) }))
  if (creatorStore.owner !== owner || creatorStore.source !== userStrategies.store) setCreatorStore({ owner, source: userStrategies.store, store: createClientStrategyCreatorStore(owner, () => userStrategies.store.getSnapshot().entries.map(item => item.record)) })
  const creatorState = useSyncExternalStore(creatorStore.store.subscribe, creatorStore.store.getSnapshot)
  const creatorCandidates = useMemo(() => registeredStrategies.map(getCreatorCandidate), [registeredStrategies])
  const publishCreator = (request: CreatorPublishRequest) => { publishCreatorAtConfirmation(creatorStore.store, request) }
  const pendingRegistration = useRef<{ sessionId: string; input: ClientStrategyRegistration; research?: boolean; researchScope?: string } | null>(null)
  const [terminalSelection, setTerminalSelection] = useState<{ owner: string | null; id: string; sequence: number; management?: boolean } | null>(null)
  const currentTerminalSelection = useRef<{ owner: string | null; id: string | null } | null>(null)
  const [upgrade, setUpgrade] = useState<{ trigger?: HTMLElement } | null>(null)
  // Source TF_UP_FOLLOW_SEEN lasts for this page session, not persisted account
  // entitlement. A different owner must never inherit the previous dismissal.
  const [followIntro, setFollowIntro] = useState(() => ({ owner, seen: false }))
  if (followIntro.owner !== owner) setFollowIntro({ owner, seen: false })
  const continueFollowIntro = () => {
    if (!owner) throw new Error('로그인 후 다시 시도해주세요.')
    setFollowIntro(current => current.owner === owner ? { owner, seen: true } : current)
  }
  const [accountLocation, setAccountLocation] = useState<ClientAccountLocation | null>(() => readClientAccountLocation())
  const [accountNotice, setAccountNotice] = useState<AccountNotice>('')
  const [accountNow, setAccountNow] = useState(Date.now)
  const [alertsRequest, setAlertsRequest] = useState(0)
  const [surface, setSurface] = useState<'settings' | 'locale' | 'feedback' | 'profile' | 'help' | null>(null)
  const helpIdentity = JSON.stringify([owner])
  const [helpOwner, setHelpOwner] = useState<string | null>(null)
  // Keep the requested lazy surface through its exit, but never load it on
  // first visit or retain its state across account replacement.
  if (surface === 'help' && helpOwner !== helpIdentity) setHelpOwner(helpIdentity)
  const [settingsAnchor, setSettingsAnchor] = useState<number | undefined>(undefined)
  const surfaceReturnFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => () => { surfaceReturnFocus.current = null }, [owner])
  const openAccountSurface = (next: 'settings' | 'locale' | 'profile', anchor?: ClientMenuAnchor) => {
    surfaceReturnFocus.current = anchor?.trigger ?? null
    setSettingsAnchor(anchor?.top)
    setSurface(next)
  }
  const [auth, setAuth] = useState<'login' | 'signup' | null>(() => Boolean(readClientAccountLocation()) && !profile ? 'login' : null)
  const pendingCatalogueCopyAuth = useRef<{ href: string; id: string; sourceSha: string } | null>(null)
  const pendingCatalogueBacktestAuth = useRef<{ href: string; id: string; sourceSha: string } | null>(null)
  const pendingWatchAuth = useRef<{ owner: null; sourceSha: string; href: string; id: string } | null>(null)
  const pendingConnectionPlan = useRef<{href:string;view:ConnectionPlanLocation;result:CommonResultContext|null}|null>(null)
  const [connectionPlanView,setConnectionPlanView]=useState(readConnectionPlanLocation)
  const [connectionResultValue,setConnectionResultValue]=useState<unknown>(()=>history.state?.tethPlanResult)
  const connectionResult=useMemo(()=>readConnectionResult(connectionResultValue,owner,state.sessions),[connectionResultValue,owner,state.sessions])
  const settingsTab = useClientSettingsRoute({ signedIn: Boolean(profile), onLogin: () => setAuth('login') })
  const [authReturnToComposer, setAuthReturnToComposer] = useState(false)
  const [commonRoute, setCommonRoute] = useState(isCommonBacktestRoute)
  const [page, setPage] = useState<ResearchPage | null>(() => isCommonBacktestRoute() ? null : readConnectionPlanLocation() ? 'brokers' : readClientInsightLocation() ? 'insight' : readSharedLocation() ? 'sharing' : null)
  const [copyReturn, setCopyReturn] = useState<{ owner: string; id: string; strategyId?: string; model?: 'catalogue' } | null>(() => history.state?.tethCopyReturn ?? null)
  const [sectionReturn, setSectionReturn] = useState<{ owner: string; section: string; strategyId?: string } | null>(() => history.state?.tethSectionReturn ?? null)
  const [sharedLocation, setSharedLocation] = useState<SharedLocation>(() => readSharedLocation() ?? { period: 'all' })
  const [followNow, setFollowNow] = useState(Date.now)
  const [tradeRequested, setTradeRequested] = useState(() => location.hash === '#/trade')
  const [terminalVisited, setTerminalVisited] = useState(false)
  const [brokerListRequest, setBrokerListRequest] = useState(0)
  const [insightLocation, setInsightLocation] = useState<ClientInsightLocation>(() => readClientInsightLocation() ?? {})
  const [templates, setTemplates] = useState<HomeTemplateSelection>({ acts: [], assets: [] })
  const [homeEntrance, setHomeEntrance] = useState(true)
  const authDraft = useRef<{ sessionId: string | null; text: string; displayQuestion: string } | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const footerHomeFocus = useRef(false)
  const [arrivalRect, setArrivalRect] = useState<DOMRect | undefined>(undefined)
  const [bandHeight, setBandHeight] = useState(200)
  const [notice, setNotice] = useState<ConversationCopyKey | ''>('')
  const [storageNoticeDismissed, setStorageNoticeDismissed] = useState(false)
  // Dismissal belongs to the current failure, not every future storage outage.
  if (!state.storageError && storageNoticeDismissed) setStorageNoticeDismissed(false)
  // Original tfDerive keeps an owned strategy's terminal available. Logging in
  // or having synthetic credits alone must not create a connected workspace.
  const tradingIntro = tradeRequested && (!profile || orders.allPendingOrders.length === 0 && registeredStrategies.length === 0 && !copies.state?.copies.length && !copies.blocked && !catalogueCopies.state?.copies.length && !catalogueCopies.error)
  const trading = tradeRequested && Boolean(profile) && !tradingIntro
  // The exact legacy plan URL is a settings alias. Rendering its old account
  // body even for one frame destroys the conversation behind the settings page.
  // Alerts/rebates are still distinct account pages, not settings aliases.
  const accountPage = profile && !(accountLocation?.kind === 'plan' && accountLocation.tab === 'plan') ? accountLocation : null
  if (trading && !terminalVisited) setTerminalVisited(true)
  const isHome = !commonRoute && !session && !page && !tradeRequested && !accountPage
  useLayoutEffect(() => {
    if (!footerHomeFocus.current) return
    footerHomeFocus.current = false
    // Consume the explicit navigation intent after the home input is mounted.
    // Do not retain a timer that can steal focus on a later page or locale change.
    const target = input.current
    if (!isHome || !target || !target.getClientRects().length) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
  const hasSiteFooter = !connectionPlanView && !commonRoute && !settingsTab && !trading && (tradingIntro || isHome || Boolean(accountPage) || page === 'sharing' || page === 'ranking' || page === 'brokers' || page === 'insight')
  const busy = Boolean(session && (session.turns.some(t => t.status === 'running') || inlinePending(session)))
  const hasTurns = state.sessions.some(s => s.turns.some(t => t.status === 'running' && !t.responseSequence && !t.responseSequenceInvalid))
  const hasJobs = hasTurns || state.sessions.some(s => s.researchStatus === '진행 중' || inlinePending(s))
  const value = session?.draft ?? state.homeDraft
  const latest = session?.turns.at(-1)
  const latestIntake = session?.turns.slice().reverse().find(turn => turn.sourceIntake || turn.sourceIntakeInvalid)
  const shareBrowseTurn = session ? shareBrowseTurnId(session.turns) : undefined
  const questionSummaries = new Set(session?.turns.flatMap(turn => turn.status === 'done'
    ? visibleMarketBlocks(turn, owner).flatMap(block => block.kind === 'market-question' && block.presentation.state?.accepted
      ? [JSON.stringify([turn.id, block.presentation.state.accepted.text])] : []) : []))
  const marketQuestions = latest ? visibleMarketBlocks(latest, owner).filter(block => block.kind === 'market-question' && !block.presentation.state?.closed && !block.presentation.state?.accepted) : []
  const marketQuestion = marketQuestions[0]
  const dockQuestion = latest ? visibleMarketBlocks(latest, owner).filter(block => block.kind === 'market-question').at(-1) : undefined
  const clarificationQuestion = session && latest?.status === 'done' && resultContextVisible(latest, owner) && !latest.commonRevision && !latest.commonRevisionInvalid && !latest.commonRevisionDirection && !latest.commonRevisionDirectionInvalid && !latest.sourceIntake && !latest.sourceIntakeInvalid && !latest.responseSequence && !latest.responseSequenceInvalid && !marketQuestion && !latestIntake && !Object.hasOwn(latest, 'conditionalOrderOwner') ? intakeCard(session) : null
  const clarificationKey = clarificationQuestion && session && latest ? JSON.stringify(['clarification', owner, session.id, latest.id]) : null
  const revisionDirectionKey = latest?.status === 'done' && latest.commonRevisionDirection?.owner === owner && !latest.followupsConsumed
    ? `common-revision-direction:${latest.commonRevisionDirection.base.turnId}:${latest.commonRevisionDirection.base.startedAt}` : null
  const activeQuestionKey = revisionDirectionKey ?? clarificationKey ?? (dockQuestion?.kind === 'market-question' && !dockQuestion.presentation.state?.closed && !dockQuestion.presentation.state?.accepted ? marketBindingKey(dockQuestion.presentation.binding) : null)
  const directCard = marketQuestions.find(block => block.kind === 'market-question' && block.presentation.state?.direct[block.presentation.state.index]
    && (!latest?.marketResponse?.writingObservationId || block.presentation.binding.observationId === latest.marketResponse.writingObservationId))
  const directQuestion = directCard?.kind === 'market-question' && directCard.presentation.state && directCard.presentation.state.free === undefined
    ? directCard.presentation.steps[directCard.presentation.state.index].title || marketQuestionText(language, 'title') : undefined
  const inlineJourney = Boolean(session?.turns.some(t => t.inlineRequest) || session?.inlineResults?.length)
  const baseResearchAvailable = Boolean(session && canOpenBaseResearch(session))
  const connectionUi = session?.workspace === 'delegation' ? projectInlineConnectionUi(session, readDelegationUi(session.id)) : undefined
  const foreignStrategyWorkspace = Boolean(session?.workspace !== 'conversation' && session?.sharedCopy && session.sharedCopy.owner !== owner)
  const invalidResearchPlan = session?.workspace === 'research' && session.researchPlanRecovery
  const researchRecord = session ? registeredResearch(session, registrations.entries) : undefined
  const uncertainStrategyWorkspace = store.commitUncertain() && session?.workspace !== 'conversation'
  const uncertainConversation = store.commitUncertain() && !tradeRequested && !accountPage && !page && session?.workspace === 'conversation'
  const invalidInlineConnection = Boolean(session?.workspace === 'delegation' && (session.inlineConnectionRecovery
    || inlineJourney && (!connectionEntry || session.inlineConnectionTurnId !== undefined) && !inlineConnectionMatches(session, connectionUi)))
  const researchWorkspaceVisible = !settingsTab && !tradeRequested && !accountPage && !page && session?.workspace === 'research'
    && !uncertainStrategyWorkspace && !foreignStrategyWorkspace && !invalidResearchPlan && !invalidInlineConnection
  const publicConversationVisible = !commonRoute && !settingsTab && !tradeRequested && !accountPage && !page && session?.workspace === 'conversation'
  const guestInsightVisible = !profile && !commonRoute && !settingsTab && !connectionStatus && page === 'insight'
  const guestBrokerDocumentVisible = !profile && !commonRoute && !settingsTab && !connectionStatus && !tradeRequested && page === 'brokers'
  const publicShell = useRef<HTMLDivElement>(null)
  useLayoutEffect(()=>{
    const shell=publicShell.current
    if(!shell||!publicConversationVisible)return
    const measure=()=>{
      const scale=shell.offsetWidth?shell.getBoundingClientRect().width/shell.offsetWidth:1
      shell.style.setProperty('--client-chat-height',`${window.innerHeight/Math.max(.1,scale)}px`)
    }
    measure()
    const observer=new ResizeObserver(measure);observer.observe(shell)
    window.addEventListener('resize',measure)
    return ()=>{observer.disconnect();window.removeEventListener('resize',measure);shell.style.removeProperty('--client-chat-height')}
  },[publicConversationVisible])
  useLayoutEffect(() => {
    const shell = publicShell.current
    if (!shell || !publicConversationVisible || profile) return
    const nav = shell.querySelector<HTMLElement>('.client-auth-nav')
    const header = shell.querySelector<HTMLElement>('.client-main-existing .client-conversation-frame .g-chead')
    if (!nav || !header) return
    let disposed = false, frame = 0
    const measure = () => {
      if (disposed || !shell.isConnected || !nav.isConnected || !header.isConnected) return
      if (!matchMedia('(min-width:861px)').matches || !nav.getClientRects().length) {
        shell.style.removeProperty('--client-conversation-auth-space')
        shell.style.removeProperty('--client-conversation-auth-offset')
        shell.style.removeProperty('--client-conversation-auth-tail')
        return
      }
      const authRect = nav.getBoundingClientRect(), headerRect = header.getBoundingClientRect()
      // Reserve the actual four-control navigation, including translated links.
      // No auth request, focus change or conversation/body width change occurs.
      const css = getComputedStyle(header), scale = header.offsetWidth > 0 ? headerRect.width / header.offsetWidth : 1
      const space = Math.max(18, (headerRect.right - authRect.left) / scale + 8)
      const children = Array.from(header.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.getClientRects().length > 0)
      // Keep 96px of readable title, not merely a 44px pointer target. The other
      // translated labels may not be sacrificed to preserve a single row.
      const minimum = children.reduce((sum, node) => {
        const style = getComputedStyle(node)
        // These controls use margin-left:auto. Its resolved free space is not
        // an intrinsic requirement and must not keep a formerly stacked row.
        const leftMargin = node.matches('.client-session-options,.g-demo') ? 0 : parseFloat(style.marginLeft) || 0
        return sum + (node.matches('h1,.g-title-input') ? 96 : node.offsetWidth)
          + leftMargin + (parseFloat(style.marginRight) || 0)
      }, 0) + Math.max(0, children.length - 1) * (parseFloat(css.columnGap) || 0)
      const stacked = header.clientWidth - (parseFloat(css.paddingLeft) || 0) - space < minimum
      // Horizontal capacity alone chooses the row. Remove the previous offset
      // from its measured top so this decision cannot oscillate after stacking.
      const baseTop = headerRect.top - (parseFloat(css.marginTop) || 0) * scale
      const offset = stacked ? Math.max(0, (authRect.bottom - baseTop) / scale + 8) : 0
      shell.style.setProperty('--client-conversation-auth-space', `${stacked ? 18 : space}px`)
      shell.style.setProperty('--client-conversation-auth-offset', `${offset}px`)
      shell.style.setProperty('--client-conversation-auth-tail',`${stacked?0:Math.max(0,(authRect.bottom-headerRect.bottom)/scale)}px`)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(nav); observer.observe(header)
    window.addEventListener('resize', schedule)
    void document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone', schedule)
    return () => {
      disposed = true; observer.disconnect(); cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      document.fonts.removeEventListener('loadingdone', schedule)
      shell.style.removeProperty('--client-conversation-auth-space')
      shell.style.removeProperty('--client-conversation-auth-offset')
      shell.style.removeProperty('--client-conversation-auth-tail')
    }
  }, [publicConversationVisible, profile, language])
  const records: ResearchRecord[] = state.sessions.map(s => {
    const running = registrations.entries.find(item => item.sessionId === s.id && item.record.status === 'live')?.record
    // 홈 템플릿의 해석 전용 idea/requestText 대신 표시된 질문·답변만 검색합니다.
    // 위임 intake는 idea를 사용자 문구로 실제 표시하므로 그대로 유지합니다.
    return { id: s.id, title: s.title, market: s.pair, pinned: s.pinned === true, searchText: [s.workspace === 'delegation' ? s.idea : '', ...s.turns.flatMap(turn => [turn.question, turn.answer])].join(' '), status: running?.environment === 'paper' ? 'Paper 실행 중' : s.researchStatus, live: Boolean(running), updatedAt: s.updatedAt, snapshot: s }
  })
  useEffect(() => {
    if (!profile || !trading && !accountPage) return
    const tick = () => { if (!document.hidden) setAccountNow(Date.now()) }
    const timer = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick); window.addEventListener('pageshow', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('pageshow', tick) }
  }, [profile, trading, accountPage])
  useEffect(() => { const timer = window.setTimeout(() => setHomeEntrance(false), 1900); return () => window.clearTimeout(timer) }, [])
  useEffect(() => {
    let previousHref = location.href
    const navigate = () => {
      const next = readClientInsightLocation()
      const nextShared = readSharedLocation()
      const nextPlan = !getSitePage() ? readConnectionPlanLocation() : null
      setConnectionPlanView(nextPlan)
      setConnectionResultValue(nextPlan?history.state?.tethPlanResult:undefined)
      setCopyReturn(history.state?.tethCopyReturn ?? null)
      setSectionReturn(history.state?.tethSectionReturn ?? null)
      const trade = !getSitePage() && location.hash === '#/trade'
      const nextAccount = !getSitePage() ? readClientAccountLocation() : null
      setAccountNow(Date.now())
      // Public-page and hash navigation must also dismiss body-level portals.
      if (getSitePage() || location.href !== previousHref) { pendingWatchAuth.current = null; pendingCatalogueBacktestAuth.current = null; pendingCatalogueCopyAuth.current = null; pendingConnectionPlan.current=null; authDraft.current = null; pendingRegistration.current = null; setAuth(null); setSurface(null); setUpgrade(null) }
      previousHref = location.href
      setTradeRequested(trade)
      setAccountLocation(nextAccount)
      const common = isCommonBacktestRoute()
      setCommonRoute(common)
      if (common) setPage(null)
      else if(nextPlan)setPage('brokers')
      else if (next) { setInsightLocation(next); setPage('insight') }
      else if (nextShared) { setSharedLocation(nextShared); setPage('sharing') }
      else setPage(current => trade || nextAccount || current === 'insight' || current === 'sharing' || current === 'ranking' || current === 'brokers' ? null : current)
      if (nextAccount && !profile) { authDraft.current = null; setAuthReturnToComposer(false); setAuth('login') }
    }
    window.addEventListener('popstate', navigate); window.addEventListener('hashchange', navigate); window.addEventListener('teth:navigate', navigate)
    return () => { window.removeEventListener('popstate', navigate); window.removeEventListener('hashchange', navigate); window.removeEventListener('teth:navigate', navigate) }
  }, [profile])
  useEffect(() => {
    if (!hasJobs) return
    let timer: number | undefined
    const sync = () => { window.clearInterval(timer); if (!document.hidden) { store.tick(Date.now()); timer = window.setInterval(() => store.tick(Date.now()), hasTurns ? 65 : 1000) } }
    sync(); document.addEventListener('visibilitychange', sync); window.addEventListener('pageshow', sync)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', sync); window.removeEventListener('pageshow', sync) }
  }, [hasJobs, hasTurns, store])
  useEffect(() => { const flush = () => store.flush(); window.addEventListener('pagehide', flush); return () => { window.removeEventListener('pagehide', flush); store.flush() } }, [store])
  useEffect(() => { if (isHome && matchMedia('(min-width: 861px)').matches) input.current?.focus({ preventScroll: true }) }, [isHome])
  // Research screens own their heading/search focus; do not override their mount effect.
  useEffect(() => { if (!commonRoute && !isHome && !page && !researchWorkspaceVisible) document.querySelector<HTMLElement>(!trading && !accountPage && arrivalRect && session?.workspace === 'conversation' ? '.g-composer textarea' : '.client-source-main')?.focus({ preventScroll: true }) }, [commonRoute, isHome, page, trading, accountPage, session?.id, session?.workspace, arrivalRect, researchWorkspaceVisible])
  const accountSurfaceActive = Boolean(auth || surface)
  useEffect(() => {
    if (!accountSurfaceActive) return
    const root = document.getElementById('root')
    const wasInert = root?.inert ?? false
    const bodyStyle = document.body.style
    const overflow = bodyStyle.getPropertyValue('overflow')
    const priority = bodyStyle.getPropertyPriority('overflow')
    if (root) root.inert = true
    bodyStyle.setProperty('overflow', 'hidden')
    return () => {
      if (root) root.inert = wasInert
      if (overflow) bodyStyle.setProperty('overflow', overflow, priority)
      else bodyStyle.removeProperty('overflow')
    }
  }, [accountSurfaceActive])
  const clearInsightRoute = () => { if (isCommonBacktestRoute() || readClientInsightLocation() || readSharedLocation() || isClientAccountEntry() || readClientSettingsLocation() || readConnectionPlanLocation()) { history.pushState(null, '', location.pathname + location.search); window.dispatchEvent(new Event('teth:navigate')) } }
  const openTrading = useCallback(() => {
    setConnectionEntry(null)
    setAccountNow(Date.now())
    authDraft.current = null; setAuthReturnToComposer(false); setArrivalRect(undefined); setPage(null)
    if (location.hash !== '#/trade') { history.pushState(null, '', '#/trade'); window.dispatchEvent(new Event('teth:navigate')) }
    setTradeRequested(true)
  }, [setAccountNow, setAuthReturnToComposer, setArrivalRect, setPage, setTradeRequested])
  const openAccount = useCallback((hash: string) => {
    if (hash === '#/trade') { openTrading(); return }
    if (!readClientAccountLocation(hash)) { setAccountNotice('연결된 화면을 아직 확인할 수 없어요. AI 트레이딩에서 전략을 확인해주세요.'); return }
    authDraft.current = null; setAuthReturnToComposer(false); setArrivalRect(undefined); setPage(null); setSurface(null)
    if (location.hash !== hash) { history.pushState(null, '', hash); window.dispatchEvent(new Event('teth:navigate')) }
  }, [openTrading, setAccountNotice, setAuthReturnToComposer, setArrivalRect, setPage, setSurface])
  const openAlerts = () => { setAlertsRequest(value => value + 1); openTrading() }
  const openUpgrade = () => { setUpgrade({ trigger: document.activeElement instanceof HTMLElement ? document.activeElement : undefined }) }
  const subscribeFromPlan = (intent?: 'subscription') => {
    // Source tfNFUpgrade resumes the last validated strategy. Navigation is not
    // a payment, registration or execution grant; the connection form owns next steps.
    if (resumeLastDelegationConnection(intent)) return
    clearInsightRoute(); setPage(null)
    if (session) store.workspace(session.id, 'conversation')
    setAccountNotice(subscriptionNeedsStrategy)
  }
  const openResearchTrading = () => {
    const current = store.getSnapshot(), target = current.sessions.find(item => item.id === session?.id)
    if (store.commitUncertain() || !target || current.currentId !== target.id || target.sharedCopy && target.sharedCopy.owner !== owner) { setAccountNotice('현재 계정의 연구 기록을 다시 확인해주세요.'); return }
    const record = registeredResearch(target, userStrategies.store.getSnapshot().entries)
    if (!record) { setAccountNotice('연결된 연구 전략을 다시 확인해주세요.'); return }
    setTerminalSelection(previous => ({ owner, id: `user:${record.id}`, sequence: (previous?.sequence ?? 0) + 1 }))
    openTrading()
  }
  const registerStrategy = useCallback((sessionId: string, input: ClientStrategyRegistration, research = false, expectedResearchScope?: string): boolean => {
    if (store.commitUncertain()) { setAccountNotice(uncertainCommitMessage); return false }
    const target = store.getSnapshot().sessions.find(item => item.id === sessionId)
    if (!target || target.sharedCopy && target.sharedCopy.owner !== previewOwner(profile)) {
      setAccountNotice(ownerRecoveryMessage); return false
    }
    if (target.inlineConnectionRecovery) {
      setAccountNotice('검증 결과와 연결 조건을 다시 확인해주세요.'); return false
    }
    if (research) {
      try {
        if (store.getSnapshot().currentId !== sessionId || expectedResearchScope === undefined) throw new Error('현재 대화의 연구 결과를 다시 확인해주세요.')
        requireCompletedResearchRegistration(target, expectedResearchScope)
        const existing = userStrategies.store.getSnapshot().entries.find(entry => entry.sessionId === sessionId)
        if (existing && !registeredResearch(target, [existing])) throw new Error('이 대화에는 다른 전략이 등록되어 있어요. AI 트레이딩에서 확인해주세요.')
      } catch (error) { setAccountNotice(error instanceof Error ? error.message : '연구 결과를 다시 확인해주세요.'); return false }
    }
    if (!profile) {
      pendingRegistration.current = { sessionId, input, research, researchScope: expectedResearchScope }
      authDraft.current = null; setAuthReturnToComposer(false); setAuth('login')
      return false
    }
    try {
      const record = userStrategies.store.register(sessionId, input, Date.now(), { preserveExisting: research })
      // A failed initial read may recover inside register(). Validate its actual
      // return value as well, not only the earlier, possibly empty snapshot.
      if (research && record.origin !== 'research') throw new Error('이 대화에는 다른 전략이 등록되어 있어요. AI 트레이딩에서 확인해주세요.')
      if (research) setTerminalSelection(previous => ({ owner: previewOwner(profile), id: `user:${record.id}`, sequence: (previous?.sequence ?? 0) + 1 }))
      if (!research) connectionLocator.store.remember(sessionId)
      store.tradingReady(sessionId)
      if (!research) store.workspace(sessionId, 'conversation')
      openAccount(research ? '#/trade' : `#/trade/bot/${record.id}`)
      return true
    } catch (error) { setAccountNotice(error instanceof Error ? error.message : '전략을 등록하지 못했어요.'); return false }
  }, [profile, userStrategies.store, store, connectionLocator.store, openAccount, setAuthReturnToComposer, setAuth, setAccountNotice, setTerminalSelection])
  const deleteConversation = (id: string) => {
    if (store.commitUncertain()) { setNotice(''); setAccountNotice(uncertainCommitMessage); return }
    const removed = store.remove(id)
    setNotice(removed ? 'deleted' : 'deletePartial')
  }
  const home = () => { setConnectionEntry(null); clearInsightRoute(); setArrivalRect(undefined); setPage(null); store.home(); setTemplates({ acts: [], assets: [] }); setHomeEntrance(false); setNotice('') }
  const navigateInsight = (next: ClientInsightLocation) => { const hash = clientInsightHash(next); if (location.hash !== hash) { history.pushState(null, '', hash); window.dispatchEvent(new Event('teth:navigate')) } setInsightLocation(next); setPage('insight') }
  const navigateShared = (next: SharedLocation, replace = false, fromTerminal = false) => {
    const hash = sharedHash(next)
    const origin = owner && next.view === 'copy-detail' && next.copyId && (fromTerminal || copyReturn?.owner === owner && copyReturn.id === next.copyId && copyReturn.model === next.copyModel) ? { owner, id: next.copyId, model: next.copyModel, strategyId: fromTerminal ? (currentTerminalSelection.current?.owner === owner ? currentTerminalSelection.current.id ?? undefined : undefined) : copyReturn?.strategyId } : null
    setCopyReturn(origin)
    const sectionOrigin = owner && next.section && fromTerminal ? { owner, section: next.section, strategyId: currentTerminalSelection.current?.owner === owner ? currentTerminalSelection.current.id ?? undefined : undefined } : null
    setSectionReturn(sectionOrigin)
    const navigationState = origin ? { tethCopyReturn: origin } : sectionOrigin ? { tethSectionReturn: sectionOrigin } : null
    if (location.hash !== hash) { if (replace) history.replaceState(navigationState, '', hash); else history.pushState(navigationState, '', hash); window.dispatchEvent(new Event('teth:navigate')) }
    setSharedLocation(next); setPage('sharing')
  }
  const sharingCurrent = () => {
    const scope = sharingLifetime.current
    return scope.alive && scope.owner === owner && scope.store === sharingPreferences.store
  }
  const changeSharingPreferences = (patch: Partial<SharingPreferences>) => { if (sharingCurrent()) sharingPreferences.store.update(patch) }
  const changeSharingQuery = (query: string) => { if (sharingCurrent()) sharingPreferences.store.setQuery(query) }
  const focusSharingTab = () => {
    const target = document.querySelector<HTMLElement>('.ss3-tabs button[aria-pressed="true"]') ?? document.getElementById('research-title')
    target?.focus({ preventScroll: true })
  }
  const retrySharingPreferences = () => {
    if (!sharingCurrent()) return
    const href = window.location.href
    if (sharingPreferences.store.retrySave()) requestAnimationFrame(() => { if (sharingCurrent() && href === window.location.href) focusSharingTab() })
  }
  const openSharing = (ranking = false) => {
    // Source 412fd60 sk-copy makes both entry points list-only. Legacy tab
    // preferences remain stored for older consumers, never choose this route.
    if (ranking) changeSharingPreferences({ tab: 'find' })
    navigateShared({ period: 'all' })
    const href = window.location.href
    requestAnimationFrame(() => {
      if (!sharingCurrent() || href !== window.location.href) return
      focusSharingTab()
      document.getElementById('research-main')?.scrollTo({ top: 0 })
    })
  }
  const navigateConnectionPlan=(view:ConnectionPlanLocation,result:CommonResultContext|null=connectionResult,preserveTerminalReturn=true)=>{
    const hash=connectionPlanHash(view)
    const copyIntent = !result && readConnectionPlanLocation(location.hash) ? readCataloguePlanIntent(history.state?.tethPlanCatalogue, owner) : null
    const terminalIntent = preserveTerminalReturn && !result && !copyIntent && readConnectionPlanLocation(location.hash) ? readTerminalPlanReturn() : null
    const entry=result?{tethPlanResult:result}:copyIntent?{tethPlanCatalogue:copyIntent}:terminalIntent?{tethPlanTerminal:terminalIntent}:null
    if(location.hash!==hash){history.pushState(entry,'',hash);window.dispatchEvent(new Event('teth:navigate'))}
    else history.replaceState(entry,'',hash)
    setSurface(null);setArrivalRect(undefined);setConnectionResultValue(result)
    setConnectionPlanView(view);setPage('brokers')
  }
  const openConnectionPlan=()=>navigateConnectionPlan({step:'plan',exchange:'bitget'},null,false)
  const openCatalogueConnection = (id: string) => {
    const strategy = findCatalogueStrategy(id)
    if (!owner || !profile || !strategy) return
    const intent = { owner, sourceSha: catalogueSourceSha, id: strategy.id, returnHash: sharedHash(sharedLocation ?? { nick: strategy.id, period: 'all' }) }
    navigateConnectionPlan({ step: 'plan', exchange: strategy.ex }, null)
    history.replaceState({ ...history.state, tethPlanCatalogue: intent }, '', location.hash)
  }
  const authenticateCatalogueCopy = (id: string) => {
    const strategy = findCatalogueStrategy(id)
    if (owner || profile || !strategy || findCatalogueStrategy(readSharedLocation()?.nick ?? '')?.id !== strategy.id) return
    openAuth('signup')
    pendingCatalogueCopyAuth.current = { href: location.href, id: strategy.id, sourceSha: catalogueSourceSha }
  }
  const openCatalogueBacktest = (id: string) => {
    const strategy = findCatalogueStrategy(id), current = readSharedLocation()
    if (!strategy || findCatalogueStrategy(current?.nick ?? '')?.id !== strategy.id) return
    if (!owner || !profile) {
      openAuth('signup')
      pendingCatalogueBacktestAuth.current = { href: location.href, id: strategy.id, sourceSha: catalogueSourceSha }
      return
    }
    navigateShared(catalogueBacktestLocation(strategy.id))
  }
  const useCatalogueBacktest = (signal: AbortSignal, binding: Readonly<CatalogueBacktestUseBinding>) => {
    const current = readSharedLocation(), strategy = findCatalogueStrategy(binding.strategyId)
    if (signal.aborted || !owner || !profile || binding.owner !== owner || binding.source !== 'client-snapshot-preview'
      || binding.sourceSha !== catalogueSourceSha || current?.view !== 'catalogue-backtest' || current.nick !== binding.strategyId
      || !strategy || JSON.stringify(binding.configuration) !== JSON.stringify(strategy)
      || binding.runId !== catalogueBacktestRunId(binding, binding.calendar, binding.dataVersion)) return
    // This host has no observed ready exchange. Keep the calculated result as a
    // return destination, and request connection without granting execution.
    openCatalogueConnection(strategy.id)
  }
  const openResearchPage = (next: ResearchPage) => { setArrivalRect(undefined); if (next === 'brokers') {setBrokerListRequest(value => value + 1);openConnectionPlan()} else if (next === 'insight') navigateInsight({}); else if (next === 'sharing' || next === 'ranking') openSharing(next === 'ranking'); else { clearInsightRoute(); setPage(next) } }
  const subscriptionSaveNotice = () => setAccountNotice('구독 선택을 이 브라우저에 저장하지 못했어요. 현재 선택은 유지되지만 새로고침하면 달라질 수 있어요.')
  const changeSubscriptionPreference = (sessionId: string, cycle: SubscriptionCycle | null) => {
    if (store.commitUncertain()) { setAccountNotice(uncertainCommitMessage); return }
    const current = store.getSnapshot(), target = current.sessions.find(item => item.id === sessionId)
    if (!owner || subscriptionIntent.owner !== owner || current.currentId !== sessionId || !target
      || target.sharedCopy && target.sharedCopy.owner !== owner) return
    if (cycle !== null && !resumableConnectionUi(target)) return
    const saved = cycle === null ? subscriptionIntent.store.clear(sessionId) : subscriptionIntent.store.choose(sessionId, cycle)
    if (!saved) subscriptionSaveNotice()
  }
  const resumeLastDelegationConnection = (intent?: 'subscription'): boolean => {
    if (store.commitUncertain()) { setAccountNotice(uncertainCommitMessage); return false }
    if (!profile) return false
    const current = store.getSnapshot()
    // Like source S.tf.cur, retain the last explicitly visited delegation after
    // home/navigation. Never substitute the selected terminal demo's score.
    const sessionId = connectionLocator.store.read()
    const target = current.sessions.find(item => item.id === sessionId)
    if (!target || target.sharedCopy && target.sharedCopy.owner !== owner
      || !resumableConnectionUi(target)) return false
    // Source bk subscription chooses checkout before navigation. Persist only the
    // displayed billing cycle, never payment completion or connection authority.
    if (intent === 'subscription' && !subscriptionIntent.store.choose(target.id, subscriptionIntent.store.read(target.id) ?? 'year')) subscriptionSaveNotice()
    const registered = userStrategies.store.getSnapshot().entries.find(item => item.sessionId === target.id)
    connectionLocator.store.remember(target.id)
    clearInsightRoute(); setArrivalRect(undefined); setPage(null)
    store.select(target.id); store.workspace(target.id, 'delegation')
    setConnectionEntry({ owner, sessionId: target.id, registeredId: registered?.record.id ?? null })
    return true
  }
  const openTerminalConnection = () => {
    // Source terminal and subscription intentionally have different fallbacks.
    if (profile && resumeLastDelegationConnection()) return
    openConnectionPlan()
    if (profile && owner && trading) {
      if (terminalPlanScope.current?.owner !== owner) terminalPlanScope.current = { owner, token: crypto.randomUUID() }
      history.replaceState({ ...history.state, tethPlanTerminal: terminalPlanScope.current }, '', location.hash)
    }
  }
  const finishConnectionEntry = (input: ClientStrategyRegistration): boolean => {
    if (store.commitUncertain()) { setAccountNotice(uncertainCommitMessage); return false }
    const entry = connectionEntry
    if (!entry || entry.owner !== owner || entry.sessionId !== session?.id) return false
    const existing = userStrategies.store.getSnapshot().entries.find(item => item.sessionId === entry.sessionId)
    if (entry.registeredId && existing?.record.id !== entry.registeredId) {
      setAccountNotice('전략 상태가 바뀌었어요. AI 트레이딩에서 다시 확인해주세요.'); return false
    }
    if (existing) {
      // Returning from the preview connection flow does not re-register, resume,
      // change exchange/environment, or grant access to account data.
      setConnectionEntry(null); store.workspace(entry.sessionId, 'conversation')
      openAccount(`#/trade/bot/${existing.record.id}`); return true
    }
    const registered = registerStrategy(entry.sessionId, input)
    if (registered) setConnectionEntry(null)
    return registered
  }
  const openAuth = (mode: 'login' | 'signup', fromComposer = false) => {
    // A separate authentication action retires a previous watch intent.
    pendingWatchAuth.current = null
    pendingCatalogueBacktestAuth.current = null
    pendingCatalogueCopyAuth.current = null
    const text = page || tradeRequested || accountLocation ? '' : isHome ? composeTemplatePrompt(templates, value, language) : value.trim()
    authDraft.current = text ? { sessionId: session?.id ?? null, text, displayQuestion: isHome ? value.trim() || text : text } : null
    setAuthReturnToComposer(fromComposer); setAuth(mode)
  }
  const aiAdmission = (notify = true) => {
    const ledger = billing.check()
    const gate = usageGate(usage.getCurrentPresentation(billing.store.getSnapshot().state, usageNow), owner, 'new')
    const result = evaluateMockUsageAdmission({ owner, ledger, state: billing.store.getSnapshot().state,
      presentation: usage.getCurrentPresentation(billing.store.getSnapshot().state, usageNow),
      supplementalCreditUsd: usage.getSupplementalCredit(), storageError: Boolean(billing.store.getSnapshot().error || usage.storageError) })
    if (notify && result !== 'allowed') {
      if (result === 'watch') setAccountNotice(gate === 'block' ? usageText(language, 'full') : { kind: 'billing-blocked' })
      else setAccountNotice({ kind: result === 'clock-skew' ? 'billing-clock' : 'billing-unavailable' })
    }
    if (result === 'allowed') setAccountNotice(current => current === usageText(language, 'full') || typeof current !== 'string' && current.kind.startsWith('billing-') ? '' : current)
    return result
  }
  const aiGate = () => aiAdmission() === 'allowed'
  const nextUsage = (tier: UsageTier) => {
    if (tier === 'FREE') openUpgrade()
    else if (tier === 'CARD') openResearchPage('brokers')
    else { pushSiteLocation(`${location.pathname}${location.search}#/settings/${tier === 'UID' ? 'billing' : 'usage'}`) }
  }
  const marketQuestionActions = (turn: ClientTurn): MarketQuestionActions => {
    const apply = (operation: () => boolean) => {
      try { return operation() }
      catch (error) {
        if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage)
        else if (error instanceof InlineConnectionError) setAccountNotice(error.message)
        return false
      }
    }
    return {
      busy: busy || store.commitUncertain() || latest?.id !== turn.id,
      change: (binding, state) => Boolean(session && apply(() => store.changeMarketQuestion(session.id, turn.id, owner, binding, state))),
      submit: (answer, signal) => Boolean(!signal.aborted && session && aiGate() && apply(() => store.submitMarketQuestion(session.id, turn.id, owner, answer, language))),
      write: binding => {
        const question = marketQuestions.find(block => marketBindingKey(binding) === marketBindingKey(block.presentation.binding))
        if (!session || busy || store.commitUncertain() || latest?.id !== turn.id || question?.kind !== 'market-question'
          || !question.presentation.state || !apply(() => store.changeMarketQuestion(session.id, turn.id, owner, binding, question.presentation.state!))) return false
        const composer = document.querySelector<HTMLTextAreaElement>('#tesia-main .g-composer textarea')
        composer?.focus({ preventScroll: true })
        return Boolean(composer)
      },
    }
  }
  const send = (text = isHome ? composeTemplatePrompt(templates, value, language) : value, source: 'composer' | 'suggestion' = 'composer', label?: string) => {
    if (store.commitUncertain()) { setAccountNotice(uncertainCommitMessage); return }
    // Source 9fb gSend: preserve the draft and explain a blocked send.
    if (busy) { showAuthToast('이전 답변을 마무리하는 중입니다, 끝나면 바로 보내주십시오'); return }
    if (!text.trim()) return
    if (!aiGate()) return
    if (latest?.commonRevisionDirection || latest?.commonRevisionDirectionInvalid) {
      try {
        if (!session || !store.submitCommonRevisionDirection(session.id, latest.id, owner, text, label ?? text)) setAccountNotice('한 가지 조건이나 수정 방향을 적어주세요. 현재 결과는 유지됩니다.')
      } catch (error) { setAccountNotice(error instanceof InlineConnectionError ? error.message : '수정 방향을 저장하지 못했어요. 다시 시도해주세요.') }
      return
    }
    if (isHome && matchMedia('(min-width:861px)').matches) setArrivalRect(document.querySelector<HTMLElement>('.client-home-pill:not(.is-fullscreen)')?.getBoundingClientRect())
    const displayQuestion = label ?? (isHome && source === 'composer' ? value.trim() || text : text)
    try { store.send(text, source, displayQuestion, responseSource ? undefined : owner, owner) }
    catch (error) { setAccountNotice(error instanceof InlineConnectionError ? error.message : '요청을 저장하지 못했어요. 다시 시도해주세요.'); return }
    clearInsightRoute(); setPage(null); setTemplates({ acts: [], assets: [] }); setHomeEntrance(false)
  }
  const focusIntake = () => {
    const active = store.getSnapshot().sessions.find(item => item.id === store.getSnapshot().currentId)
    const turnId = active?.turns.at(-1)?.id, href = location.href, trigger = document.activeElement
    requestAnimationFrame(() => {
      if (location.href !== href || store.getSnapshot().currentId !== active?.id
        || document.activeElement !== trigger && document.activeElement !== document.body) return
      const section = [...document.querySelectorAll<HTMLElement>('.client-source-intake')].find(el => el.dataset.turnId === turnId)
      if (!section?.closest('[hidden],[inert]')) section?.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true })
    })
  }
  const startIntake = (previousIntakeId: string) => {
    const current = store.getSnapshot().sessions.find(item => item.id === store.getSnapshot().currentId)
    if (!session || !latest || current?.id !== session.id || current.turns.at(-1)?.id !== latest.id
      || current.turns.slice().reverse().find(t => t.sourceIntake || t.sourceIntakeInvalid)?.id !== previousIntakeId) return
    try {
      const accepted = store.restartSourceIntake(session.id, owner, sourceIntakeText(language, 'revise'), latest.id, previousIntakeId)
      if (!accepted) { setAccountNotice(sourceIntakeText(language, 'failed')); return }
      setConnectionEntry(null); setArrivalRect(undefined); focusIntake()
    } catch { setAccountNotice(store.commitUncertain() ? uncertainCommitMessage : sourceIntakeText(language, 'failed')) }
  }
  const workspace = (next: 'research' | 'delegation') => {
    if (store.commitUncertain()) { setAccountNotice(uncertainCommitMessage); return }
    if (next === 'delegation') {
      const current = store.getSnapshot().sessions.find(item => item.id === store.getSnapshot().currentId)
      if (!session || !latest || current?.id !== session.id || current.turns.at(-1)?.id !== latest.id
        || current.turns.some(turn => turn.status === 'running') || !aiGate()) return
      try {
        if (!store.requestStrategyConversation(session.id, owner, c('delegate'), latest.id)) { setAccountNotice(sourceIntakeText(language, 'failed')); return }
        setConnectionEntry(null); setArrivalRect(undefined)
      } catch { setAccountNotice(store.commitUncertain() ? uncertainCommitMessage : sourceIntakeText(language, 'failed')) }
      return
    }
    setConnectionEntry(null)
    setArrivalRect(undefined)
    if (session) store.workspace(session.id, next)
  }
  const openInlineResearch = (record: InlineBacktestRecord) => {
    if (!session) return
    try { store.openResearchPlan(session.id, record.turnId, owner); setConnectionEntry(null); setArrivalRect(undefined) }
    catch (error) { setAccountNotice(error instanceof Error ? error.message : '연구 계획을 열지 못했어요. 현재 대화는 유지됩니다.') }
  }
  const openBaseResearch = () => {
    if (!session) return
    try { store.openBaseResearch(session.id, owner); setConnectionEntry(null); setArrivalRect(undefined) }
    catch (error) { setAccountNotice(error instanceof Error ? error.message : '연구 계획을 열지 못했어요. 현재 대화는 유지됩니다.') }
  }
  const connectInline = (record: InlineBacktestRecord) => {
    const current = store.getSnapshot().sessions.find(s => s.id === store.getSnapshot().currentId)
    if (!current || current.id !== session?.id || current.turns.some(t => t.status === 'running') || inlinePending(current)
      || !current.inlineResults?.includes(record)) return
    const registeredState = userStrategies.store.getSnapshot()
    if (registeredState.storageError) {
      setAccountNotice('기존 전략을 불러오지 못했어요. 저장 상태를 확인한 뒤 다시 시도해주세요.'); return
    }
    if (registeredState.entries.some(item => item.sessionId === current.id)) {
      setAccountNotice('이미 연결된 전략이 있어요. AI 트레이딩에서 관리하거나 새 대화에서 별도 전략을 만들어주세요.'); return
    }
    try { store.connectInlineResult(current.id, record.turnId, owner) }
    catch (error) {
      setAccountNotice(error instanceof InlineConnectionError
        ? error.message : '검증 결과를 연결하지 못했어요. 기록은 대화에 남아 있으니 다시 시도해주세요.')
      return
    }
    // Explicit execution opens Connect even if this result's presentation cache
    // last showed Report. Reload can still restore that cache's current page.
    setConnectionEntry({ owner, sessionId: current.id, registeredId: null }); setArrivalRect(undefined); connectionLocator.store.remember(current.id)
  }
  const askInsight = async (text: string) => {
    if (!profile) { openAuth('login'); throw new ClientInsightQuestionError('로그인 후 다시 시도해주세요.') }
    if (busy) throw new ClientInsightQuestionError(c('busyError'))
    const admission = aiAdmission(false)
    if (admission !== 'allowed') throw new ClientInsightQuestionError(billingText(language, admission === 'watch' ? 'blocked' : admission === 'clock-skew' ? 'clockSkew' : 'unavailable'))
    store.startConversation(text)
    setConnectionEntry(null); setArrivalRect(undefined); setHomeEntrance(false)
    setTemplates({ acts: [], assets: [] })
    clearInsightRoute(); setPage(null)
  }
  const backToChat = () => {
    setConnectionEntry(null)
    if (!session?.inlineConnectionTurnId && !session?.researchPlanTurnId && session?.sharedCopy?.owner === owner) {
      const previous = state.sessions.find(s => s.id === session.sharedCopy?.returnId)
      if (previous) { store.select(previous.id); store.workspace(previous.id, 'conversation') } else store.home()
    } else if (session) store.workspace(session.id, 'conversation')
  }
  const saveCommonBacktest = (next: CommonBacktestPreview) => {
    if (!session) throw new InlineConnectionError(commonBacktestText(language, 'missing'))
    try { store.commonBacktest(session.id, next, owner) }
    catch (error) { if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage); throw error }
  }
  const closeCommonBacktest = () => {
    clearInsightRoute(); setPage(null)
    if (session) store.workspace(session.id, 'conversation')
  }
  const prepareCommonConnection=()=>{
    const current=store.getSnapshot(),source=current.sessions.find(item=>item.id===session?.id)
    if(store.commitUncertain()||!source||current.currentId!==source.id||!session?.commonBacktest
      ||source.sharedCopy&&source.sharedCopy.owner!==owner||!commonSelectionVisible(source,owner)||!completedCommonRevisionSource(source,session.commonBacktest))throw new InlineConnectionError(commonBacktestText(language,'missing'))
    navigateConnectionPlan({step:'plan',exchange:'bitget'},commonResultContext(source,owner))
  }
  const closeConnectionPlan=()=>{
    const catalogueIntent = readCataloguePlanIntent(history.state?.tethPlanCatalogue, owner)
    if (catalogueIntent) { const target = readSharedLocation(catalogueIntent.returnHash); if (target) { navigateShared(target); return } }
    const context=readConnectionResult(connectionResultValue,owner,store.getSnapshot().sessions)
    if(context){
      if(store.commitUncertain()){setAccountNotice(uncertainCommitMessage);return}
      try{store.select(context.sourceSessionId);openRevisionRun()}catch{setAccountNotice(uncertainCommitMessage)}
      return
    }
    if (readTerminalPlanReturn()) { openTrading(); return }
    clearInsightRoute();setPage(null)
  }
  const openRevisionRun=()=>{
    setArrivalRect(undefined)
    history.pushState(null,'','#/share/bt/mine');window.dispatchEvent(new Event('teth:navigate'))
  }
  const reviseCommonBacktest=()=>{
    if(!session?.commonBacktest)throw new InlineConnectionError(commonBacktestText(language,'missing'))
    if (!aiGate()) return
    store.startCommonRevisionDirection(session.id,session.commonBacktest,owner,revisionText(language,'request'),language)
    closeCommonBacktest()
  }
  const revertCommonBacktest=()=>{
    if(!session?.commonBacktest)throw new InlineConnectionError(commonBacktestText(language,'missing'))
    store.revertCommonRevision(session.id,session.commonBacktest,owner,revisionText(language,'revert'),matchMedia('(prefers-reduced-motion: reduce)').matches)
  }
  const copyShared = (request: SharedCopyRequest, followId?: string) => {
    if (!profile || !owner) throw new Error('로그인 후 다시 시도해주세요.')
    const admission = aiAdmission(false)
    if (admission !== 'allowed') throw new Error(billingText(language, admission === 'watch' ? 'blocked' : admission === 'clock-skew' ? 'clockSkew' : 'unavailable'))
    const id = store.copySharedStrategy(owner, request, followId)
    setConnectionEntry(null); setArrivalRect(undefined); setHomeEntrance(false)
    clearInsightRoute(); setPage(null)
    connectionLocator.store.remember(id)
  }
  const resumeSharedFollow = (id: string) => {
    if (store.commitUncertain()) throw new Error(uncertainCommitMessage)
    if (!owner || !profile) throw new Error('로그인 후 다시 시도해주세요.')
    const current = store.getSnapshot(), record = current.sharedFollows.find(item => item.id === id && item.owner === owner)
    const target = current.sessions.find(item => item.id === record?.sessionId)
    if (!record || !record.active || !target || target.sharedCopy?.owner !== owner
      || (target.sharedCopy.followId ?? target.id) !== record.id || !target.sharedCopy.active) throw new Error('전략 기록을 다시 확인해주세요.')
    const registered = userStrategies.store.getSnapshot().entries.find(item => item.sessionId === target.id)
    if (registered) { openAccount(`#/trade/bot/${registered.record.id}`); return }
    const ui = readDelegationUi(target.id)
    if (!ui || ui.recoveryRequired) throw new Error('검증 기록을 불러오지 못했어요. 설정 변경에서 조건을 확인하고 다시 검증해주세요.')
    setConnectionEntry(null); setArrivalRect(undefined); setHomeEntrance(false)
    clearInsightRoute(); setPage(null)
    store.select(target.id); store.workspace(target.id, 'delegation'); connectionLocator.store.remember(target.id)
  }
  const followRows = useMemo(() => state.sharedFollows.filter(record => record.owner === owner).map(record => {
    const target = state.sessions.find(item => item.id === record.sessionId)
    const attached = record.active && target?.sharedCopy?.owner === owner && target.sharedCopy.active && (target.sharedCopy.followId ?? target.id) === record.id
    const ui = attached ? resolveDelegationProgress(readDelegationUi(record.sessionId), followNow) : undefined
    const registration = attached ? registrations.entries.find(item => item.sessionId === record.sessionId)?.record : undefined
    const completedParameters = ui?.pendingParameters ?? ui?.parameters
      const effective = ui && !ui.recoveryRequired && !ui.inlineResult && ui.workStep === 5 && completedParameters
      ? { ...record, parameters: completedParameters, budgetIndex: ui.answers.budget?.index ?? record.budgetIndex } : record
    return { record: effective, status: describeSharedFollow(effective, ui, registration) }
  }).reverse(), [state.sharedFollows, state.sessions, owner, registrations.entries, followNow])
  const followPending = followRows.some(item => item.status.label === '검증 중')
  useEffect(() => {
    if (page !== 'sharing' && page !== 'ranking') return
    let timer: number | undefined
    const refresh = () => {
      window.clearInterval(timer)
      if (!document.hidden) { setFollowNow(Date.now()); if (followPending) timer = window.setInterval(() => setFollowNow(Date.now()), 500) }
    }
    refresh(); document.addEventListener('visibilitychange', refresh); window.addEventListener('pageshow', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('pageshow', refresh) }
  }, [page, followPending])
  const askShared = askInsight
  const changeProfile = (next: PreviewProfile | null) => {
    refreshAccountClockAtEvent(setAccountNow)
    if (previewOwner(next) !== owner) { terminalPlanScope.current = null; setTerminalSelection(null); surfaceReturnFocus.current = null; setSettingsAnchor(undefined); setSurface(null); setHelpOwner(null) }
    // Route changes retain the preview; signing out must discard account-local drafts.
    if (!next) { setTerminalVisited(false); setAlertsRequest(0); setAccountNotice(''); setUpgrade(null); pendingRegistration.current = null }
    if (!next && sharingCurrent() && !sharingPreferences.store.clear()) setAccountNotice({ kind: 'sharing-clear-failed' })
    setProfile(next)
    try { if (next) sessionStorage.setItem('teth-client-profile-preview', JSON.stringify({ name: next.name, email: next.email, ...(next.previewId ? { previewId: next.previewId } : {}) })); else sessionStorage.removeItem('teth-client-profile-preview') }
    catch { setNotice('profileSaveError') }
  }
  const terminalCopies = (judgment: ReactNode) => <ClientTerminalCopies judgment={judgment} account={copies} catalogue={catalogueCopies} onCatalogueManage={id => navigateShared(catalogueCopyLocation(id), false, true)} onNew={home} onFind={() => navigateShared({ period: 'all' })} onHistory={() => navigateShared({ section: 'library', period: 'all' }, false, true)} onLibrary={() => navigateShared({ section: 'library', period: 'all' }, false, true)} onPublishing={() => navigateShared({ section: 'publishing', period: 'all' }, false, true)} onManage={id => navigateShared({ view: 'copy-detail', copyId: id, copyTab: 'pos', period: 'all' }, false, true)} />
  const terminalManagement = { label: terminalCopyWords[language].copies, backLabel: terminalCopyWords[language].back, content: null }
  const returnFromCopy = () => {
    const id = copyReturn?.owner === owner && copyReturn.id === sharedLocation.copyId && copyReturn.model === sharedLocation.copyModel ? copyReturn.strategyId : undefined
    // History stores navigation intent only. The current owner's entries must still contain it.
    if (typeof id === 'string' && registeredStrategies.some(record => `user:${record.id}` === id)) {
      setTerminalSelection(previous => ({ owner, id, sequence: (previous?.sequence ?? 0) + 1, management: true }))
    }
    openTrading()
  }
  const returnFromSection = () => {
    const id = sectionReturn?.owner === owner && sectionReturn.section === sharedLocation.section ? sectionReturn.strategyId : undefined
    if (typeof id === 'string' && registeredStrategies.some(record => `user:${record.id}` === id)) {
      setTerminalSelection(previous => ({ owner, id, sequence: (previous?.sequence ?? 0) + 1, management: true }))
    }
    openTrading()
  }
  return <ClientQuestionDockProvider activeKey={activeQuestionKey}><div ref={publicShell} className={`tesia-shell conversation-surface client-source-app ${isHome && !settingsTab ? 'view-landing' : 'view-briefing'}${publicConversationVisible ? ' has-public-conversation' : ''}${guestInsightVisible ? ' has-guest-insight-entry' : ''}${guestBrokerDocumentVisible ? ' has-guest-broker-document' : ''}${tradingIntro && !settingsTab ? ' has-trading-intro' : ''}${settingsTab ? ' has-settings' : ''}${hasSiteFooter ? ' has-site-footer' : ''}`} style={{ '--client-band-height': `${bandHeight}px` } as CSSProperties}>
    <ClientResponseSourceBridge source={responseBridgeSource} owner={owner} store={store} onFailure={error => {
      if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage)
      else if (error instanceof InlineConnectionError) setAccountNotice(error.message)
    }}/>
    <a className="skip-link" href="#tesia-main" onClick={event => { event.preventDefault(); document.getElementById('tesia-main')?.focus() }}>{c('skipContent')}</a>
    <div className="client-footer-body">
    <ClientChrome contentScope={JSON.stringify([session?.id, session?.workspace, settingsTab, commonRoute])} mobileMenuHost={trading && !settingsTab && !connectionStatus ? terminalMenuHost : null} showLocaleShortcut={(isHome || tradingIntro || publicConversationVisible || guestInsightVisible || guestBrokerDocumentVisible || hasSiteFooter && !connectionStatus && page === 'sharing' && !sharedLocation.section && !sharedLocation.view) && !settingsTab} signedIn={Boolean(profile)} previewRecords profileName={profile?.name} onHome={home} onLogin={() => openAuth('login')} onSignup={() => openAuth('signup')}
      onSettings={anchor => openAccountSurface('settings', anchor)} onLocale={anchor => openAccountSurface('locale', anchor)} onDashboard={() => openResearchPage('history')} onProfile={anchor => openAccountSurface('settings', anchor)}
      researchPage={page} records={records} activeResearchId={session?.id} onResearchPage={openResearchPage} onSelectResearch={id => { const registered = registrations.entries.find(item => item.sessionId === id); store.select(id); if (registered && registered.record.origin !== 'research') { openAccount(`#/trade/bot/${registered.record.id}`); return } clearInsightRoute(); setArrivalRect(undefined); setPage(null) }}
      onPinResearch={store.pin} onRenameResearch={store.rename} onDeleteResearch={deleteConversation}
      onTrading={openTrading} tradingActive={tradeRequested} />
    {profile && !tradeRequested && !page && !settingsTab && !accountPage && !commonRoute && session && (session.workspace === 'research' && !session.researchPlanTurnId && baseResearchAvailable || session.workspace === 'delegation' && !session.inlineConnectionTurnId) && <div className="client-account-utility"><ClientAccountBell unread={accountPresentation.notifs.filter(item => !item.read).length} onOpen={openAlerts} /></div>}
    <main id="tesia-main" className="client-source-main" tabIndex={-1}>
      {connectionStatus && <ClientConnectionStatus {...connectionStatus} scope={owner} source="mock" />}
      {settingsTab && !connectionStatus && <ClientSettingsPage key={owner} tab={settingsTab} usage={{ presentation: usage.presentation, scope: owner, onNext: nextUsage, onTopup: usage.onTopup, onAutoTopup: usage.onAutoTopup }} profile={profile ?? undefined} onBack={() => closeClientSettingsRoute(true)} onNewStrategy={() => { closeClientSettingsRoute(true); home() }} onCopyStrategy={() => { closeClientSettingsRoute(); openSharing() }} onBrokers={() => openResearchPage('brokers')} onHelp={trigger => { surfaceReturnFocus.current = trigger; setSurface('help') }} onLogout={() => { changeProfile(null); home() }} />}
      <div className="client-main-existing" hidden={Boolean(settingsTab || connectionStatus)} inert={Boolean(settingsTab || connectionStatus)}>
      {profile && (trading || terminalVisited) && <div className="client-main-terminal" hidden={!trading} inert={!trading}>
        <ClientLoadBoundary fallback={<ClientLoadFallback />}><Suspense fallback={<ClientLoadFallback loading />}><ClientCatalogueTerminalBinding key={owner} chartEnabled={registeredStrategies.length === 0} account={catalogueCopies} onManage={id => navigateShared(catalogueCopyLocation(id), false, true)} onFind={() => navigateShared({ period: 'all' })}>{({ judgment, emptyMarket }) => <ClientSourceTerminalWorkspace marketSource={terminalMarketSource} marketScope={owner} menuHostRef={setTerminalMenuHost} includeSamples={false} emptyMarket={emptyMarket} emptyDetail={terminalCopies(judgment)} management={{ ...terminalManagement, content: terminalCopies(judgment) }} onSelectionChange={id => { currentTerminalSelection.current = { owner, id } }} selectionRequest={terminalSelection?.owner === owner ? terminalSelection : undefined} onNew={home} onAsk={text => { void askInsight(text).catch(error => setAccountNotice(error instanceof Error ? error.message : c('busyError'))) }} conditionalOrders={{ orders: orders.allPendingOrders, binding: owner ?? 'guest', onCancel: orders.cancel }} accountDataMode="connection-required" onConnectExchange={openTerminalConnection} accountState={accountPresentation} previewBillingMode={billing.state?.mode} onBeforeAi={aiGate} now={accountNow} onRead={readAccountNotification} onReadAll={readAllAccountNotifications} onAccountNavigate={openAccount} alertsRequest={alertsRequest} userStrategies={registeredStrategies} onUserStatus={(id, status) => {
          const entry = userStrategies.store.getSnapshot().entries.find(item => item.record.id === id)
          if (!entry) throw new Error('전략을 찾을 수 없어요')
          userStrategies.store.control(id, status === 'off' ? 'pause' : entry.record.status === 'ready' ? 'start' : 'resume')
        }} />}</ClientCatalogueTerminalBinding></Suspense></ClientLoadBoundary>
      </div>}
      {commonRoute ? <ClientLoadBoundary fallback={<ClientLoadFallback onClose={closeCommonBacktest} />}><Suspense fallback={<ClientLoadFallback loading onClose={closeCommonBacktest} />}><ClientCommonBacktest key={JSON.stringify([owner, session?.id])} session={commonSelectionVisible(session, owner) ? session : undefined} onChange={saveCommonBacktest} onBack={closeCommonBacktest} onRevise={reviseCommonBacktest} onBrowse={()=>openSharing(true)} onRevert={revertCommonBacktest} onPrepare={prepareCommonConnection}/></Suspense></ClientLoadBoundary> : tradingIntro ? <ClientLoadBoundary fallback={<ClientLoadFallback onClose={home}/>}><Suspense fallback={<ClientLoadFallback loading onClose={home}/>}><ClientTradingIntro onStart={openConnectionPlan}/></Suspense></ClientLoadBoundary> : trading ? null : accountPage ? <div className="client-main-account"><ClientLoadBoundary fallback={<ClientLoadFallback onClose={openTrading} />}><Suspense fallback={<ClientLoadFallback loading onClose={home}/>}>
        {accountPage.kind === 'plan' ? <ClientAccountPlan state={accountPresentation} previewBillingMode={billing.state?.mode} signedIn={Boolean(profile)} now={accountNow} money={(value, signed) => sourceMoney(value, currency, language, signed)} tab={accountPage.tab} onNavigate={openAccount} onPreference={accountStore.store.preference} onUpgrade={openUpgrade} />
          : accountPage.kind === 'bot' ? <ClientUserStrategy key={JSON.stringify([owner, accountPage.id])} record={registrations.entries.find(item => item.record.id === accountPage.id)?.record ?? null} events={account.state} money={(value, signed) => sourceMoney(value, currency, language, signed)} onNavigate={openAccount} onControl={action => { userStrategies.store.control(accountPage.id, action) }} onApplyEdit={(expected, parameters) => { userStrategies.store.revise(expected, parameters) }} />
          : accountPage.kind === 'review' ? <ClientAccountReview state={account.state} id={accountPage.id} now={accountNow} money={(value, signed) => sourceMoney(value, currency, language, signed)} onNavigate={openAccount} />
            : <ClientAccountPeriodic state={account.state} id={accountPage.id} now={accountNow} money={(value, signed) => sourceMoney(value, currency, language, signed)} onNavigate={openAccount} />}
        {account.storageError && <p className="client-account-storage-error" role="status">설정을 이 브라우저에 저장하지 못했어요. 현재 선택은 유지됩니다.<button type="button" onClick={accountStore.store.retrySave}>저장 다시 시도</button></p>}
      </Suspense></ClientLoadBoundary></div> : page === 'brokers' && connectionPlanView ? <ClientLoadBoundary fallback={<ClientLoadFallback onClose={home}/>}><Suspense fallback={<ClientLoadFallback loading onClose={home}/>}><ClientConnectionPlan key={owner} view={connectionPlanView} resultContext={connectionResult} signedIn={Boolean(profile)} onNavigate={navigateConnectionPlan} onSignup={view=>{pendingConnectionPlan.current={href:location.href,view,result:connectionResult};openAuth('signup')}} onClose={closeConnectionPlan} onHelp={trigger=>{surfaceReturnFocus.current=trigger;setSurface('help')}}/></Suspense></ClientLoadBoundary> : page ? <ClientResearchHub previewMoney page={page} records={records} onSelect={id => { clearInsightRoute(); store.select(id); setPage(null) }} onNew={home} onReturn={() => { clearInsightRoute(); setPage(null) }} brokerServices={{ authenticated: Boolean(profile), onLogin: () => openAuth('login'), onSubscribe: () => subscribeFromPlan('subscription'), presentationScope: JSON.stringify([owner, session?.id ?? null]) }} brokerListRequest={brokerListRequest}
        insightServices={{ signedIn: Boolean(profile), onLogin: openAuth }} insightLocation={insightLocation} onInsightNavigate={navigateInsight} onInsightAsk={askInsight}
        notice={(page === 'sharing' || page === 'ranking') && sharingView.storageError ? <div className="client-sharing-preference-notice" role="status"><span>{sharingPreferenceCopy[language].loadSave}</span><button type="button" onClick={retrySharingPreferences}>{sharingPreferenceCopy[language].retry}</button></div> : undefined}
        sharingPreview={{ catalogueCopySetup, onCatalogueCopyAuth: authenticateCatalogueCopy, onCatalogueVerify: openCatalogueBacktest, onCatalogueBacktestUse: useCatalogueBacktest, onWatchAuth: id => {
          const strategy = findCatalogueStrategy(id)
          if (owner !== null || profile || !strategy || findCatalogueStrategy(readSharedLocation()?.nick ?? '')?.id !== strategy.id) return
          openAuth('signup')
          pendingWatchAuth.current = { owner: null, sourceSha: catalogueSourceSha, href: location.href, id: strategy.id }
        }, onHelp: trigger => { surfaceReturnFocus.current = trigger; setSurface('help') }, routeSections: true, sectionReturn: { label: shellText(language, 'trading'), onReturn: returnFromSection }, copyManagementReturn: copyReturn?.owner === owner && copyReturn?.id === sharedLocation.copyId && copyReturn.model === sharedLocation.copyModel ? { label: shellText(language, 'trading'), onReturn: returnFromCopy } : undefined, onCatalogueCopy: openCatalogueConnection, onPreviewCopyStart: () => Boolean(profile) && aiGate(), viewPreferences: { state: sharingView, onChange: changeSharingPreferences, onQuery: changeSharingQuery }, followIntro: { required: !followIntro.seen && !account.state.payDone, onContinue: continueFollowIntro, onSubscribe: subscribeFromPlan }, creator: { candidates: creatorCandidates, publication: creatorState.publication, visible: creatorState.visible, nick: profile?.name ?? "나", storageError: creatorState.storageError, onRetryLoad: () => { creatorStore.store.retryLoad() }, onPublish: publishCreator, onVisibility: visible => { creatorStore.store.setVisible(visible) } }, followRows, onResumeFollow: resumeSharedFollow, onArchiveFollow: id => { if (!owner) throw new Error("로그인 후 다시 시도해주세요."); store.archiveSharedFollow(owner, id) }, onRemoveFollow: id => { if (!owner) throw new Error("로그인 후 다시 시도해주세요."); store.removeSharedFollow(owner, id) }, owner, location: sharedLocation, onNavigate: navigateShared, onAsk: askShared, onCopy: copyShared, signedIn: Boolean(profile), onLogin: () => openAuth('login') }}
        onFollow={text => { home(); store.draft(text) }} externalBoundary /> : isHome ? <div className="landing-main"><section className="landing-hero" aria-labelledby="landing-title">
        <ConversationCosmos />
        <ClientHomeSurface value={value} inputRef={input} onChange={store.draft} onSend={() => send()} onLogin={() => openAuth('login', true)} onSignup={() => openAuth('signup')}
          signedIn={Boolean(profile)} selection={templates} onSelectionChange={setTemplates} animate={homeEntrance} onBandHeight={setBandHeight} />
      </section></div> : uncertainStrategyWorkspace ? <section className="client-inline-recovery" role="alert"><h2>저장된 기록을 먼저 확인해주세요</h2><p>{uncertainCommitMessage}</p><button type="button" onClick={backToChat}>대화로 돌아가기</button></section> : foreignStrategyWorkspace ? <section className="client-inline-recovery" role="alert"><h2>{ownerRecoveryMessage}</h2><p>다른 계정의 전략을 연결하거나 등록할 수 없어요. 기존 기록은 보존되어 있어요.</p><button type="button" onClick={backToChat}>대화로 돌아가기</button></section> : (invalidInlineConnection || invalidResearchPlan) && session ? <section className="client-inline-recovery" role="alert"><h2>검증 결과와 연결 조건을 다시 확인해주세요</h2><p>대화에 저장된 결과와 연결 화면의 조건이 일치하지 않아요. 기존 기록은 보존되어 있어요.</p><button type="button" onClick={backToChat}>대화로 돌아가기</button></section> : session?.workspace === 'research' ? <ClientResearchWorkspace focusOnMount key={researchScope(session)} sessionId={researchScope(session)} idea={session.idea} titleEditor={<NativeConversationTitle key={session.id} title={session.title.trim() ? session.title : c('newStrategy')} onSave={title => store.rename(session.id, title)} />} headerActions={<SessionMenu title={session.title} onRename={title => store.rename(session.id, title)} onDelete={() => deleteConversation(session.id)} />} planContext={researchPlanContext(session)} hasBacktestResult={Boolean(session.inlineResults?.length)} onBeforeAi={aiGate} onStartResearch={() => store.startResearch(session.id, researchScope(session), owner)} onStatusChange={() => store.syncResearchStatus(session.id)} registered={Boolean(researchRecord)} onStartPaper={() => {
        try { return registerStrategy(session.id, clientResearchRegistration(), true, researchScope(session)) }
        catch (error) { setAccountNotice(error instanceof Error ? error.message : '전략을 등록하지 못했어요.'); return false }
      }} onOpenTrading={openResearchTrading} onBack={backToChat} onDelegate={inlineJourney ? undefined : () => workspace('delegation')} />
      : session?.workspace === 'delegation' && (connectionEntry?.sessionId === session.id || !registrations.entries.some(item => item.sessionId === session.id)) ? <ClientDelegationWorkspace key={`${session.id}:${session.inlineConnectionTurnId ?? 'legacy'}:${connectionEntry?.sessionId === session.id ? 'connection' : 'delegation'}`} sessionId={session.id} idea={session.idea} initialUi={connectionUi} onBeforeAi={aiGate} reportUpgrade={{ ...reportUpgrade, enabled: !account.state.payDone && (!session.sharedCopy || session.sharedCopy.owner === owner) }} subscriptionPreference={{ cycle: subscriptionIntent.store.read(session.id), onChange: cycle => changeSubscriptionPreference(session.id, cycle) }} sourceCopy={session.sharedCopy?.owner === owner && session.sharedCopy?.active === true} onSourceReset={() => store.detachSharedCopy(session.id)} onBack={backToChat} onStrategyRegistered={connectionEntry?.sessionId === session.id ? finishConnectionEntry : input => registerStrategy(session.id, input)} onShowRanking={() => openSharing(true)} initialPage={connectionEntry?.sessionId === session.id || session.tradingReady ? 'connect' : undefined} />
      : session ? <ClientConversation key={session.id} value={value} onChange={store.draft} onSend={() => send()} onBusySend={() => send()} onStop={() => store.stop(session.id)} busy={busy}
        composerPlaceholder={directQuestion ? marketQuestionText(language, 'writePlaceholder', { title: directQuestion }) : undefined}
        persistentNotice={uncertainConversation ? uncertainCommitGuidance : undefined}
        composerNotice={<ClientUsageBanner presentation={usage.presentation} scope={owner} onNext={nextUsage} dismissed={usage.dismissed} onDismiss={usage.onDismiss} />}
        arrivalRect={arrivalRect}
        initialViewport={store.conversationViewport(session.id)} onViewportChange={view => store.saveConversationViewport(session.id, view)}
        inputLabel={c('askTeth')} sendLabel={c('send')} titleLabel={c('title')} initialTitle={session.title} onTitleChange={title => store.rename(session.id, title)}
        activityKey={`${session.turns.length}:${latest?.answer.length}:${latest?.status}:${session.inlineResults?.length}:${latestIntake?.sourceIntake?.answers.length}`} previewTools={<></>}
        headerActions={<SessionMenu title={session.title} onRename={title => store.rename(session.id, title)} onDelete={() => deleteConversation(session.id)} />}>
        {session.turns.map(turn => !resultContextVisible(turn,owner)?null:<Fragment key={turn.id}><ConversationTurn owner={owner} turn={orderTurnViews.get(turn.id)?.answer !== turn.answer ? { ...turn, answer: orderTurnViews.get(turn.id)?.answer ?? turn.answer } : turn} summarized={Boolean(turn.marketQuestionOf && questionSummaries.has(JSON.stringify([turn.marketQuestionOf, turn.question])))}
          marketResponse={<ClientStoredMarketResponse sessionId={session.id} turn={turn} owner={owner} store={store}
            questionActions={marketQuestionActions(turn)} source={marketChartSource} onFailure={error => {
              if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage)
              else if (error instanceof InlineConnectionError) setAccountNotice(error.message)
            }} />}
          onEdit={text => { store.draft(text); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus()) }} />
          {orderTurnViews.get(turn.id)?.order && <ClientConditionalOrderCard order={orderTurnViews.get(turn.id)!.order!} source="mock" binding={owner ?? 'guest'} onPlace={orders.place} onCancel={orders.cancel} onEdit={() => { store.draft(turn.question); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus()) }} onTerminal={openTrading} />}
          {orderTurnViews.get(turn.id)?.legacy && <p role="status">예약 미리보기의 계정 정보를 확인할 수 없어요.</p>}
          {orders.error && turn === session.turns.at(-1) && <p role="status">{orders.error === 'scope' ? '현재 계정과 대화의 예약 정보를 확인해주세요.' : orders.error === 'corrupt' ? '예약 기록이 손상되어 확인하지 못했어요. 기존 기록은 보존되어 있어요.' : orders.error === 'conflict' ? '예약 조건이 저장된 기록과 달라요. 원래 조건을 먼저 확인해주세요.' : '브라우저에서 예약 기록을 읽거나 저장하지 못했어요. 기존 기록은 보존되어 있어요.'}<button type="button" onClick={orders.retry}>다시 확인</button></p>}
          {turn.id === shareBrowseTurn && <div className="g-nextcol client-followups client-share-browse" data-turn-id={turn.id}>
            <button type="button" className="g-nextq" onClick={() => {
              if (store.getSnapshot().currentId !== session.id || !sharingCurrent()) return
              openSharing(true)
            }}><span>{shareBrowseLabel(language)}</span><span className="ar" aria-hidden="true">→</span></button>
          </div>}
          {turn.sourceIntakeInvalid && <p className="client-global-notice" role="status">{c('recoveryWarning')}</p>}
          {(turn.commonRevisionInvalid||turn.commonResultContextInvalid)&&<p className="client-global-notice" role="status">{c('recoveryWarning')}</p>}
          {turn.commonRevision&&turn.commonRevision.owner===owner&&<ClientCommonRevisionProposal turn={turn}
            active={!busy&&!state.storageError&&!store.commitUncertain()&&latest?.id===turn.id}
            onApply={()=>{store.applyCommonRevision(session.id,turn.id,owner,revisionText(language,'apply'),matchMedia('(prefers-reduced-motion: reduce)').matches);openRevisionRun()}}
            onOther={()=>{if(!session.draft.trim())store.draft(revisionText(language,'fallback'));document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus()}}/>}
          {turn.commonRevisionDirection && !turn.followupsConsumed && <ClientCommonRevisionDirection direction={turn.commonRevisionDirection}
            active={latest?.id === turn.id && turn.commonRevisionDirection.owner === owner && !busy && !store.commitUncertain() && !state.storageError}
            onAnswer={text => {
              if (!aiGate()) return false
              try { return store.submitCommonRevisionDirection(session.id, turn.id, owner, text) }
              catch (error) { setAccountNotice(error instanceof InlineConnectionError ? error.message : '수정 방향을 저장하지 못했어요. 다시 시도해주세요.'); return false }
            }} />}
          {turn.commonRevisionDirectionInvalid && <p role="status">저장된 수정 방향을 확인할 수 없어요. 기존 검증 결과에서 다시 시작해주세요.</p>}
          {turn.sourceIntake && <ClientSourceIntake turnId={turn.id} value={turn.sourceIntake}
            active={latestIntake?.id === turn.id && !busy && !store.commitUncertain() && !state.storageError && (!session.sharedCopy || session.sharedCopy.owner === owner)}
            onPick={(key, index, recommended) => {
              try { return store.pickSourceIntake(session.id, turn.id, owner, key, index, recommended) }
              catch (error) { if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage); throw error }
            }}
            onRestart={() => startIntake(turn.id)} />}
          {commonTurn(turn) && (!turn.responseSequence || turn.responseSequence.owner === owner) && <ClientCommonStrategySummary turn={turn} state={session.commonBacktest} busy={busy || store.commitUncertain()} onEdit={turn.sourceIntake ? latestIntake?.id === turn.id ? () => startIntake(turn.id) : undefined : latest?.id === turn.id ? () => {
            if (store.getSnapshot().currentId !== session.id || store.getSnapshot().sessions.find(s => s.id === session.id)?.turns.at(-1)?.id !== turn.id) return
            try {
              if (turn.responseSequence) {
                if (!store.getSnapshot().sessions.find(s => s.id === session.id)?.draft.trim()) store.draft(commonBacktestText(language, 'revise'))
              }
              else send('조건을 직접 수정할게요', 'suggestion', commonBacktestText(language, 'revise'))
              document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus()
            } catch { setAccountNotice(store.commitUncertain() ? uncertainCommitMessage : commonBacktestText(language, 'savingError')) }
          } : undefined} onOpen={() => {
            try {
              if (store.getSnapshot().currentId !== session.id) return
              const previous = session.commonBacktest
              const choices = turn.sourceIntake && sourceIntakePreview(turn.sourceIntake)
              store.commonBacktest(session.id, previous?.turnId === turn.id ? previous : { turnId: turn.id, period: choices ? choices.period : responseStrategyForTurn(turn)?.period ?? 730, amount: choices ? choices.amount : 1000 }, owner)
              setArrivalRect(undefined)
              history.pushState(null, '', '#/share/bt/mine'); window.dispatchEvent(new Event('teth:navigate'))
            } catch { setAccountNotice(store.commitUncertain() ? uncertainCommitMessage : commonBacktestText(language, 'savingError')) }
          }} />}
          {session.inlineResults?.filter(record => record.turnId === turn.id).map(record => <ClientInlineBacktest key={record.turnId} record={record} active={!busy && latest?.id === turn.id} canConnect={!busy && (!session.sharedCopy || session.sharedCopy.owner === owner)}
            onRecommend={() => { if (store.getSnapshot().currentId === session.id && store.getSnapshot().sessions.find(s => s.id === session.id)?.turns.at(-1)?.id === turn.id) send('추천 설정으로 다시 검증', 'suggestion') }}
            onEdit={() => { if (store.getSnapshot().currentId !== session.id || store.getSnapshot().sessions.find(s => s.id === session.id)?.turns.at(-1)?.id !== turn.id) return; send('조건을 직접 수정할게요', 'suggestion'); document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus() }}
            onPlan={() => openInlineResearch(record)} onConnect={() => connectInline(record)} />)}
        </Fragment>)}
        {latest?.status === 'done' && inlinePending(session) && <div className="g-think" role="status" data-source="mock"><span className="g-tdots" aria-hidden="true"><i /><i /><i /></span><span>과거 데이터로 검증 중</span></div>}
        {latest && resultContextVisible(latest,owner) && isEmptyInterruptedResponse(latest) && <ClientRetryResponse
          binding={{ scopeId: JSON.stringify([owner, session.id]), messageId: latest.id, observationId: `${latest.id}:${latest.status}` }}
          question={latest.question} kind={latest.status === 'failed' ? 'failed' : 'stopped'} busy={busy || store.commitUncertain()}
          onRetry={canRetryPreview(latest) ? (request, signal) => {
            if (signal.aborted || !aiGate()) return false
            try {
              const trigger = document.activeElement
              const accepted = store.retryPreview(session.id, latest.id, owner, request)
              if (accepted && trigger instanceof HTMLElement && trigger.closest('.client-response-retry') && document.activeElement === trigger)
                document.querySelector<HTMLTextAreaElement>('#tesia-main .g-composer textarea')?.focus({ preventScroll: true })
              return accepted
            } catch (error) {
              if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage)
              else if (error instanceof InlineConnectionError) setAccountNotice(error.message)
              return false
            }
          } : undefined}/>}
        {latest && resultContextVisible(latest,owner) && canContinuePreview(latest) && <ClientContinueResponse
          binding={{ scopeId: JSON.stringify([owner, session.id]), messageId: latest.id, observationId: `${latest.id}:interrupted` }}
          partialText={latest.answer} busy={busy || store.commitUncertain()} onContinue={(request, signal) => {
            if (signal.aborted || !aiGate()) return false
            try {
              const trigger = document.activeElement
              const accepted = store.continuePreview(session.id, latest.id, owner, request)
              if (accepted && trigger instanceof HTMLElement && trigger.closest('.client-followups') && document.activeElement === trigger)
                document.querySelector<HTMLTextAreaElement>('#tesia-main .g-composer textarea')?.focus({ preventScroll: true })
              return accepted
            }
            catch (error) {
              if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage)
              else if (error instanceof InlineConnectionError) setAccountNotice(error.message)
              return false
            }
          }}/>}
        {latest?.status === 'done' && resultContextVisible(latest,owner) && !latest.commonRevision && !latest.commonRevisionInvalid && !latest.commonRevisionDirection && !latest.commonRevisionDirectionInvalid && !latest.sourceIntake && !latest.sourceIntakeInvalid && !latest.responseSequence && !latest.responseSequenceInvalid && !marketQuestion && <>{(() => {
          const question = clarificationQuestion
          return question && clarificationKey ? <ClientClarificationCard key={clarificationKey} dockKey={clarificationKey} question={question} disabled={busy || store.commitUncertain()}
            composer={{ value, onChange: store.draft, onSubmit: () => send() }} onAnswer={(value, label) => send(value, 'suggestion', label)}
            onSkip={() => send(question.skip, 'suggestion', `${c('clarificationSkip')}: ${question.options.find(option => option.value === question.skip)?.label ?? question.skip}`)} />
            : !latest.followupsConsumed && <ClientFollowups presentation={{ binding: { scopeId: JSON.stringify([owner, session.id]), messageId: latest.id, observationId: `${latest.id}:next` }, actions: latest.followupActions ?? [], questions: latest.suggestions.map((text, index) => ({ id: `next-${index}`, label: text, text })), showFreeBadge: !account.state.payDone }} actions={{ busy: busy || store.commitUncertain(), activate: (selection, signal) => {
              const before = store.getSnapshot(), active = before.sessions.find(item => item.id === before.currentId)
              if (signal.aborted || active?.id !== session.id || active.turns.at(-1)?.id !== latest.id || before.storageError || store.commitUncertain()) return false
              if ((selection.kind === 'question' || selection.item.type !== 'alert') && !aiGate()) return false
              let accepted: boolean
              try { accepted = store.activateFollowup(session.id, latest.id, owner, selection) }
              catch (error) {
                if (store.commitUncertain()) setAccountNotice(uncertainCommitMessage)
                else if (error instanceof InlineConnectionError) setAccountNotice(error.message)
                return false
              }
              if (accepted) { setConnectionEntry(null); setArrivalRect(undefined) }
              return accepted
            } }} />
        })()}
          {!Object.hasOwn(latest, 'conditionalOrderOwner') && !latestIntake && !latest.followupActions?.length && (!inlineJourney || baseResearchAvailable) && <div className="client-next-actions">{baseResearchAvailable && <button type="button" onClick={openBaseResearch}>{inlineJourney ? previousResearchLabel(language) : clientResearchLabel('Research Plan', language)} <span>{c('checkPlan')}</span></button>}{!inlineJourney && <button type="button" onClick={() => workspace('delegation')}>{c('delegate')} <span>{c('configureAndValidate')}</span></button>}</div>}
        </>}
      </ClientConversation> : null}
      </div>
    </main>
    </div>
    {hasSiteFooter && <ClientSiteFooter lime={isHome} onHelp={trigger => { surfaceReturnFocus.current = trigger; setSurface('help') }} onNavigate={action => {
      if (action === 'trade') openTrading()
      else if (action === 'strategies') openSharing(true)
      else if (action === 'new') { footerHomeFocus.current = true; home() }
      else if (action === 'brokers') openResearchPage('brokers')
      else if (action === 'insights') openResearchPage('insight')
      else openAccount('#/plan')
    }} />}
    <div className="client-notice-stack">
    {store.commitUncertain() && !uncertainConversation && <div className="client-global-notice" role="alert">{uncertainCommitGuidance}</div>}
    {(billing.error || usage.storageError) && <div className="client-global-notice" role="alert">{billingText(language, 'storageError')}<button type="button" onClick={() => { billing.store.retry(); usage.retry() }}>{billingText(language, 'retry')}</button></div>}
    {accountNotice && !(typeof accountNotice !== 'string' && accountNotice.kind === 'billing-unavailable' && (billing.error || usage.storageError)) && !(store.commitUncertain() && accountNotice === uncertainCommitMessage) && <div className="client-global-notice" role="status">{typeof accountNotice === 'string' ? accountNotice : accountNotice.kind === 'sharing-clear-failed' ? sharingPreferenceCopy[language].clear : accountNotice.kind === 'billing-blocked' ? billingText(language, 'blocked') : accountNotice.kind === 'billing-clock' ? billingText(language, 'clockSkew') : accountNotice.kind === 'billing-unavailable' ? billingText(language, 'unavailable') : upgradeText(language, accountNoticeCopy[accountNotice.kind])}{typeof accountNotice !== 'string' && accountNotice.kind === 'billing-unavailable' && <button type="button" onClick={() => { billing.store.retry(); usage.retry(); setAccountNotice('') }}>{billingText(language, 'retry')}</button>}<button type="button" aria-label={upgradeText(language, 'closeAccountNotice')} onClick={() => setAccountNotice('')}>×</button></div>}
    {registrations.storageError && <div className="client-global-notice" role="status">전략 기록을 이 브라우저에 저장하거나 불러오지 못했어요.<button type="button" onClick={userStrategies.store.retrySave}>다시 시도</button></div>}
    {((state.storageError && !storageNoticeDismissed) || state.recoveryWarning || notice) && <div className="client-global-notice" role="status">{state.storageError && !storageNoticeDismissed ? c('storageError') : state.recoveryWarning ? c('recoveryWarning') : notice && c(notice)}<button type="button" aria-label={c('closeNotice')} onClick={() => { setNotice(''); setStorageNoticeDismissed(true); if (state.recoveryWarning) store.dismissRecovery() }}>×</button></div>}
    </div>
    <aside className="client-development-boundary" aria-label="로컬 검수 환경"><details><summary>로컬 UI 검수 · 서비스 미연결</summary><p>클라이언트 원본 9fbff821의 홈·거래소·인사이트·터미널을 이식한 React 검수 화면입니다. 대화·연구·차트·랭킹·거래는 시각 검수용 데이터이며 공유 흐름은 이식 중입니다. 터미널의 체결·손익은 공통 합성 일봉 시뮬레이션이며 실제 다중자산 계정 데이터가 아닙니다. 이 공개 경로에서 인증·메일·피드백·결제·거래소 연결·주문은 실제 처리되지 않습니다. 실제 서비스 계약을 소비하는 내부 진입점은 별도로 유지합니다. 실제 비밀번호·API 키·카드 정보를 입력하지 마세요.</p></details></aside>
    {(isHome || tradingIntro) && !settingsTab && !surface && !auth && <ClientLoadBoundary fallback={null}><Suspense fallback={null}><ClientHelp /></Suspense></ClientLoadBoundary>}
    {upgrade && <ClientLoadBoundary fallback={<ClientLoadFallback onClose={() => setUpgrade(null)} />}><Suspense fallback={null}><ClientUpgradeSheet context="plan" trigger={upgrade.trigger} freeUsed={account.state.freeUsed} onClose={() => setUpgrade(null)} onSubscribe={subscribeFromPlan} /></Suspense></ClientLoadBoundary>}
    <ClientLocalePanel open={surface === 'locale'} returnFocus={surfaceReturnFocus} manageBackground={false} onClose={() => setSurface(null)} />
    {createPortal(<div className="client-source-overlays">
      <div data-preview-auth-notice className={`ca-code-toast${authToast.visible ? ' show' : ''}`} role={authToast.visible ? 'status' : undefined} aria-live="polite" aria-atomic="true">{authToast.text}</div>
      <ClientSettingsMenu key={owner ?? 'anonymous'} open={surface === 'settings'} anchorTop={settingsAnchor} returnFocus={surfaceReturnFocus} signedIn={Boolean(profile)} onLogout={() => { changeProfile(null); setSurface(null); home() }} onPlan={() => openAccount('#/plan')} onClose={() => setSurface(null)} onSettings={() => { setSurface(null); openClientSettings() }} onInsight={() => { setSurface(null); openResearchPage('insight') }} onBrokers={() => { setSurface(null); openResearchPage('brokers') }} onFeedback={() => setSurface('feedback')} onHelp={() => setSurface('help')} onDownload={() => { setSurface(null); history.pushState({}, '', '/download/'); window.dispatchEvent(new Event('teth:navigate')) }} />
      <ClientFeedbackDialog key={`feedback:${helpIdentity}`} open={surface === 'feedback'} returnFocus={surfaceReturnFocus} submission="preview" onClose={() => setSurface(null)} />
      {surface === 'profile' && profile && <ClientProfileMenu profile={profile} returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} onLogout={() => { changeProfile(null); setSurface(null); home() }} />}
      {helpOwner === helpIdentity && <ClientLoadBoundary key={`help:${helpIdentity}`} fallback={surface === 'help' ? <ClientLoadFallback returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} /> : null}><Suspense fallback={surface === 'help' ? <ClientLoadFallback loading returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} /> : null}><ClientHelp initialOpen open={surface === 'help'} returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} /></Suspense></ClientLoadBoundary>}
    </div>, document.body)}
{auth && createPortal(<div className="client-source-overlays"><ClientAuthDialog key={auth} mode={auth} returnFocus={authReturnToComposer ? input : undefined} onProviderNotice={provider => showAuthToast(provider + ' 인증 완료')} onClose={() => { pendingWatchAuth.current = null; pendingCatalogueBacktestAuth.current = null; pendingCatalogueCopyAuth.current = null; pendingConnectionPlan.current=null; authDraft.current = null; pendingRegistration.current = null; setAuth(null); closeClientSettingsRoute(); if (readClientAccountLocation() && !profile) clearInsightRoute() }} onComplete={next => {
      const accepted = { ...next, ...(next.email ? {} : { previewId: crypto.randomUUID() }) }
      const copyIntent = pendingCatalogueCopyAuth.current
      const backtestIntent = pendingCatalogueBacktestAuth.current
      const watchIntent = pendingWatchAuth.current
      pendingWatchAuth.current = null
      pendingCatalogueBacktestAuth.current = null
      pendingCatalogueCopyAuth.current = null
      const nextWatchOwner = previewOwner(accepted)
      // This is a local Mock bookmark, never a service entitlement or order.
      // Write before the owner-keyed Sharing remount reads its own namespace.
      if (watchIntent && watchIntent.owner === owner && owner === null && !profile && nextWatchOwner
        && watchIntent.href === location.href && watchIntent.sourceSha === catalogueSourceSha
        && findCatalogueStrategy(watchIntent.id)?.id === watchIntent.id && findCatalogueStrategy(readSharedLocation()?.nick ?? '')?.id === watchIntent.id) {
        const key = `teth-sharing-watch:account:${encodeURIComponent(nextWatchOwner)}`
        try {
          const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]')
          if (!Array.isArray(saved) || saved.length > 1000 || saved.some(id => typeof id !== 'string' || id.length > 200)) throw new Error('invalid watch snapshot')
          if (!saved.some(id => findCatalogueStrategy(id)?.id === watchIntent.id)) {
            if (saved.length >= 1000) throw new Error('watch capacity')
            sessionStorage.setItem(key, JSON.stringify([...saved, watchIntent.id]))
          }
        } catch { setAccountNotice('관심 전략을 저장하지 못했어요. 로그인한 계정에서 다시 선택해주세요.') }
      }
      changeProfile(accepted); setAuth(null)
      // Source 9fb final signupDone: local preview feedback only.
      showAuthToast(auth === 'login' ? '다시 만나서 반갑습니다' : '계정 준비 완료, 시장은 기다려주지 않습니다')
      if (copyIntent && owner === null && !profile && nextWatchOwner && copyIntent.href === location.href
        && copyIntent.sourceSha === catalogueSourceSha && findCatalogueStrategy(copyIntent.id)?.id === copyIntent.id
        && findCatalogueStrategy(readSharedLocation()?.nick ?? '')?.id === copyIntent.id) {
        authDraft.current = null; pendingRegistration.current = null
        const strategy = findCatalogueStrategy(copyIntent.id)!
        const intent = { owner: nextWatchOwner, sourceSha: catalogueSourceSha, id: strategy.id, returnHash: sharedHash({ nick: strategy.id, period: 'all' }) }
        navigateConnectionPlan({ step: 'plan', exchange: strategy.ex }, null)
        history.replaceState({ ...history.state, tethPlanCatalogue: intent }, '', location.hash)
        return
      }
      if (backtestIntent && owner === null && !profile && nextWatchOwner
        && backtestIntent.href === location.href && backtestIntent.sourceSha === catalogueSourceSha
        && findCatalogueStrategy(backtestIntent.id)?.id === backtestIntent.id
        && findCatalogueStrategy(readSharedLocation()?.nick ?? '')?.id === backtestIntent.id) {
        authDraft.current = null; pendingRegistration.current = null
        navigateShared(catalogueBacktestLocation(backtestIntent.id)); return
      }
      const planIntent=pendingConnectionPlan.current
      pendingConnectionPlan.current=null
      if(planIntent&&planIntent.href===location.href){
        authDraft.current=null;pendingRegistration.current=null
        const context=planIntent.result
        const transferred=context&&context.owner===null&&!profile?{...context,owner:previewOwner(accepted)}:context
        navigateConnectionPlan(planIntent.view,readConnectionResult(transferred,previewOwner(accepted),store.getSnapshot().sessions));return
      }
      const registration = pendingRegistration.current
      pendingRegistration.current = null
      if (registration) {
        authDraft.current = null
        if (store.commitUncertain()) { setAccountNotice(uncertainCommitMessage); return }
        const target = store.getSnapshot().sessions.find(item => item.id === registration.sessionId)
        if (!target || target.sharedCopy && target.sharedCopy.owner !== previewOwner(accepted)) {
          setAccountNotice(ownerRecoveryMessage); return
        }
        if (target.inlineConnectionRecovery) {
          setAccountNotice('검증 결과와 연결 조건을 다시 확인해주세요.'); return
        }
        try {
          if (registration.research) {
            if (store.getSnapshot().currentId !== target.id || registration.researchScope === undefined) throw new Error('현재 대화의 연구 결과를 다시 확인해주세요.')
            requireCompletedResearchRegistration(target, registration.researchScope)
          }
          const nextOwner = previewOwner(accepted)
          const nextStore = createClientUserStrategyStore(nextOwner)
          // Authentication changes the owner scope. Recheck the restored store
          // before a guest's pending registration may write into it.
          const existing = nextStore.getSnapshot().entries.find(item => item.sessionId === registration.sessionId)
          if (registration.research && existing && !registeredResearch(target, [existing])) throw new Error('이 대화에는 다른 전략이 등록되어 있어요. AI 트레이딩에서 확인해주세요.')
          const record = existing && !registration.research ? existing.record
            : nextStore.register(registration.sessionId, registration.input, Date.now(), { preserveExisting: registration.research === true })
          if (registration.research && record.origin !== 'research') throw new Error('이 대화에는 다른 전략이 등록되어 있어요. AI 트레이딩에서 확인해주세요.')
          if (registration.research) setTerminalSelection(previous => ({ owner: nextOwner, id: `user:${record.id}`, sequence: (previous?.sequence ?? 0) + 1 }))
          setUserStrategies({ owner: nextOwner, store: nextStore })
          const nextLocator = createDelegationConnectionLocator(nextOwner)
          if (!registration.research) nextLocator.remember(registration.sessionId)
          setConnectionLocator({ owner: nextOwner, store: nextLocator })
          store.tradingReady(registration.sessionId)
          if (!registration.research) store.workspace(registration.sessionId, 'conversation')
          // Do not dispatch through the pre-login route listener (which still owns guest state).
          history.pushState(null, '', registration.research ? '#/trade' : `#/trade/bot/${record.id}`)
          setAccountLocation(registration.research ? null : { kind: 'bot', id: record.id }); setTradeRequested(Boolean(registration.research)); setPage(null)
        } catch (error) { setAccountNotice(error instanceof Error ? error.message : '전략을 등록하지 못했어요.') }
        return
      }
      const pending = authDraft.current
      authDraft.current = null
      if (isClientAccountEntry() || !pending) return
      if (pending.sessionId && !store.getSnapshot().sessions.some(s => s.id === pending.sessionId)) return
      if (pending.sessionId) store.select(pending.sessionId)
      else store.home()
      const pendingOwner = previewOwner(accepted)
      const nextBilling = createBillingPreviewStore(pendingOwner)
      const nextLedgerAdmission = checkBillingPreview(nextBilling)
      const nextUsageSnapshot = createClientUsagePreviewStore(pendingOwner).getSnapshot()
      const nextUsage = projectClientUsagePreview(pendingOwner, nextBilling.getSnapshot().state, usageNow, nextUsageSnapshot)
      const nextAdmission = evaluateMockUsageAdmission({ owner: pendingOwner, ledger: nextLedgerAdmission, state: nextBilling.getSnapshot().state,
        presentation: nextUsage, supplementalCreditUsd: nextUsageSnapshot.data?.creditUsd ?? 0,
        storageError: Boolean(nextBilling.getSnapshot().error || nextUsageSnapshot.error) })
      if (nextAdmission !== 'allowed') {
        store.draft(pending.displayQuestion)
        setAccountNotice(nextAdmission === 'watch' && usageGate(nextUsage, pendingOwner, 'new') === 'block' ? usageText(language, 'full')
          : { kind: nextAdmission === 'watch' ? 'billing-blocked' : nextAdmission === 'clock-skew' ? 'billing-clock' : 'billing-unavailable' })
        return
      }
      try { store.send(pending.text, 'composer', pending.displayQuestion, responseSource ? undefined : pendingOwner, pendingOwner) }
      catch (error) { setAccountNotice(error instanceof InlineConnectionError ? error.message : '요청을 저장하지 못했어요. 다시 시도해주세요.'); return }
      setPage(null); setTemplates({ acts: [], assets: [] }); setHomeEntrance(false)
    }} /></div>, document.body)}
  </div></ClientQuestionDockProvider>
}
