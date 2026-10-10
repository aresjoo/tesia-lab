import { ClientQuestionDockProvider } from '../components/ClientQuestionDock'
import { Fragment, lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource-variable/noto-sans-sc'
import '../styles.css'
import '../funnel-v2.css'
import '../conversation-shell.css'
import '../client-reference.css'
import '../client-workspace.css'
import '../client-main-experience.css'
import '../client-integration.css'
import { ClientChrome, type ClientMenuAnchor } from '../components/ClientChrome'
import { ClientAccountBell } from '../components/ClientAccountBell'
import { accountActivityText } from '../client-account-activity-copy'
import { ClientHomeSurface } from '../components/ClientHomeSurface'
import { ClientSiteFooter } from '../components/ClientSiteFooter'
import { ClientLoadBoundary, ClientLoadFallback } from '../components/ClientLoadBoundary'
import { composeTemplatePrompt, type HomeTemplateSelection } from '../client-home-gallery'
import { useClientPreferences } from '../client-preferences'
import type { ResearchPage } from '../research-library'
import { useConversationCopy } from '../client-conversation-copy'
import { researchNavigationLabel } from '../client-research-copy'
import { clientResearchLabel } from '../client-research-label'
import { shellText } from '../client-shell-copy'
import { ClientConversation, ClientUserMessage } from '../components/ClientConversation'
import { NativeConversationTitle } from './NativeConversationTitle'
import { ClientClarificationCard } from '../components/ClientClarificationCard'
import { ClientResearchActivity } from '../components/ClientResearchActivity'
import { ClientResponseSequence, type ClientResponseBlock } from '../components/ClientResponseSequence'
import type { FollowupActions, FollowupSelection } from '../client-followup-presentation'
import { ClientContinueResponse } from '../components/ClientContinueResponse'
import { CONTINUE_RESPONSE_PROMPT, type ContinueResponseAction, type ContinueResponseRequest } from '../client-continuation'
import type { MarketQuestionActions } from '../client-market-question-presentation'
import type { MarketChartActions } from '../client-market-chart-presentation'
import { marketQuestionText } from '../client-market-question-copy'
import { marketBindingKey, type MarketResponseBinding } from '../client-market-response-presentation'
import { ClientAnswerActions } from '../components/ClientAnswerActions'
import { ClientLocalePanel } from '../components/ClientLocalePanel'
import { ClientSettingsMenu, ClientProfileMenu, ClientFeedbackDialog, type ClientFeedbackSubmission } from '../components/ClientAccountUI'
import { ClientSettingsPage, type ClientSettingsConnectionOperation } from '../components/ClientSettingsPage'
import type { ClientSettingsUsageProps } from '../components/ClientSettingsUsage'
import { ClientUsageBanner } from '../components/ClientUsageBanner'
import { ClientConnectionStatus, type ClientConnectionStatusProps } from '../components/ClientConnectionStatus'
import { usageGate, usagePresentationBound, usageText } from '../client-usage-presentation'
import { NativeSettingsPlan } from './NativeSettingsPlan'
import { closeClientSettingsRoute, openClientSettings, useClientSettingsRoute } from '../use-client-settings-route'
import { readClientSettingsLocation } from '../client-settings-navigation'
import { ConversationCosmos } from '../components/ConversationCosmos'
import { pushSiteLocation, useSiteHrefMapper } from '../site-navigation'
import { getServiceSiteLocation } from './service-site-navigation'
import { NativeAnalysisLayout, NativeAnalysisSummarySlot, NativeAnalysisReportSlot } from './NativeAnalysisLayout'
import { nativeResultText } from './native-result-copy'
import { nativeHistoryCopy } from './native-history-copy'
import { nativeHistoryScopeCopy } from './native-history-scope-copy'
import { nativeShellText, type NativeShellCopyKey } from './native-shell-copy'
import { observationResponseBlocks, type NativeResearchObservation } from './native-research-observations'
import type { InternalPocPresentation } from './InternalPocApp'
import type { ConversationLibraryPresentation } from './native-conversation-library-presentation'
import type { InsightPresentationData } from '../client-insight-presentation'
import { ClientInsightQuestionError, readClientInsightLocation, clientInsightHash, type ClientInsightLocation } from '../client-insight-navigation'
import type { SharingServicePresentation } from '../client-sharing-presentation'
import type { NativeStrategyViewState } from './NativeStrategies'
import { readSharedLocation, sharedHash } from '../client-shared-navigation'
import type { SharedLocation } from '../client-shared-strategies'
import { readClientAccountLocation, safeClientAccountHash, isClientAccountEntry, type ClientAccountLocation } from '../client-account-navigation'
import { accountPresentationBound, accountLocationAvailable, type NativeAccountPresentation, type NativeAccountAlertsView } from './native-account-presentation'
import { brokerPresentationBound, type BrokerServicePresentation } from '../client-broker-presentation'
import { brokerViewBound, brokerViewDataset, type BrokerViewState } from '../client-broker-view'
import { connectionPresentationBound, type NativeConnectionPresentation } from './native-connection-presentation'
import type { ConnectionPlanLocation } from '../client-connection-plan'
import { projectSettingsAccountConnections, settingsAccountConnectionOwner } from './client-settings-account-connections'
import { NativeResearchWorkspace } from './NativeResearchWorkspace'
import { nativeResearchText } from './native-research-workspace-copy'
import { NativePersistentRegion } from './NativePersistentRegion'
import { openResearchDocument, researchView as normalizeResearchView, RESEARCH_DOCUMENT_SURFACES, type NativeResearchView, type NativeResearchWorkspaceProps, type NativeResearchThreadOrigin } from './native-research-workspace-model'
import './client-service.css'

const ClientHelp = lazy(() => import('../components/ClientHelp').then(module => ({ default: module.SiteHelp })))
const ClientResearchHistory = lazy(() => import('../components/ClientResearchHistory').then(module => ({ default: module.ClientResearchHistory })))
const ClientTradingIntro = lazy(() => import('../components/ClientTradingIntro'))
const NativeAccountPlan = lazy(() => import('./NativeAccountPlan').then(module => ({ default: module.NativeAccountPlan })))
const NativeTradingWorkspace = lazy(() => import('./NativeTradingWorkspace').then(module => ({ default: module.NativeTradingWorkspace })))
const NativeBrokers = lazy(() => import('./NativeBrokers').then(module => ({ default: module.NativeBrokers })))
const NativeInsights = lazy(() => import('./NativeInsights').then(module => ({ default: module.NativeInsights })))
const NativeStrategies = lazy(() => import('./NativeStrategies').then(module => ({ default: module.NativeStrategies })))
const NativeConnectionOnboarding = lazy(() => import('./NativeConnectionOnboarding').then(module => ({ default: module.NativeConnectionOnboarding })))
const ClientConnectionPlan = lazy(() => import('../components/ClientConnectionPlan'))

type SettingsConnectionOperationInternal = {
  token: number
  ownerBinding: string
  sourceRevision: string
  id: string
  restoreFocus: boolean
}
type SettingsConnectionSettlement = { operation: SettingsConnectionOperationInternal; rejected: boolean; ready: boolean }

/** In-memory presentation only. Observations are supplied after the native SDK
 * has accepted a response; a restored snapshot is not a past turn transcript. */
export type ClientServiceMessage = InternalPocPresentation['messages'][number] & {
  responseBlocks?: readonly ClientResponseBlock[]
  observation?: NativeResearchObservation
  /** Memory-only submitted wording; never parsed from a server response/prefix. */
  displayText?: string
  researchThread?: NativeResearchThreadOrigin
  /** Supplied only when the host can identify the preserved incomplete turn. */
  continuationBinding?: MarketResponseBinding
}

function PendingOperation({ source }: { source: 'service' | 'mock' }) {
  const { c, language } = useConversationCopy()
  const [startedAt] = useState(() => Date.now())
  return <ClientResearchActivity source={source} label={c('waiting')} status="running" startedAt={startedAt}
    steps={[{ id: 'request', title: nativeShellText(language, 'requestTitle'), status: 'running', detail: nativeShellText(language, 'requestDetail') }]} />
}

function SessionLoading() {
  const { language } = useConversationCopy()
  return <p className="client-session-loading" role="status">{nativeShellText(language, 'requestTitle')}</p>
}

function ServiceAssistantAnswer({ blocks, source, contentIdentity, questionActions, chartActions, followupActions, continuation }: { blocks: readonly ClientResponseBlock[]; source: 'service' | 'mock'; contentIdentity?: string; questionActions?: MarketQuestionActions; chartActions?: MarketChartActions; followupActions?: FollowupActions; continuation?: { binding: MarketResponseBinding; busy: boolean; onContinue?: ContinueResponseAction } }) {
  const { c } = useConversationCopy()
  const answers = blocks.filter(block => block.kind === 'text')
  const completed = answers.length > 0 && answers.every(block => block.status === 'done')
  const text = answers.map(block => block.text).join('\n\n')
  const interrupted = answers.at(-1)?.status === 'interrupted' && !answers.some(block => block.status === 'streaming')
  // Source taiActs belongs to the answer, before the independent taiNext list.
  return <><ClientResponseSequence source={source} blocks={blocks.filter(block => block.kind !== 'followups')} questionActions={questionActions} chartActions={chartActions} />{completed && text.trim() && <ClientAnswerActions text={text} contentIdentity={contentIdentity} />}{interrupted && <p className="client-stopped" role="status">{c('responseStopped')}</p>}{interrupted && continuation && <ClientContinueResponse {...continuation} partialText={text}/>}<ClientResponseSequence source={source} blocks={blocks.filter(block => block.kind === 'followups')} followupActions={followupActions}/></>
}

type UnavailableFeature = ResearchPage | 'download' | 'trading'
type ShellNotice = { key: NativeShellCopyKey; feature?: UnavailableFeature }
type ClientAuthIntent = 'login' | 'signup'
export type ClientConnectionPlanAuthRequest = { issuer: 'client-connection-plan'; operation: 'signup'; requestId: string; sourceSessionId: string; plan: ConnectionPlanLocation }
export type ClientConnectionPlanContinuationReceipt = ClientConnectionPlanAuthRequest & { targetSessionId: string }

/** Current-conversation projection only; the native controller retains all
 * SDK/owner checks. A successful selection, not a click, closes the history. */
export type ClientServiceHistory = {
  disabled: boolean
  pending: boolean
  onLoad: () => void
  render: (onSelected?: () => void) => ReactNode
}

/** Same client presentation; all authoritative state/actions belong to InternalPocApp.
 * This module is reachable only from the separately built internal entrypoint.
 */
export function ClientServiceExperience({ state, onLogin, onHistory, onQuickReply, conversationNavigation, navigationFeedback, strategyDocument, conversationNotice, resultActivityKey, analysis, analysisIdentity, analysisPresentationBlocked = false, nativeAccounts = false, sessionRecoveryNeeded = false, loadingHome = false, accountScope, usagePresentation, connectionStatus, executionHistory, historyFeedback, clarification, composerRequest, conversationLibrary, insightPresentation, sharingPresentation, researchPresentation, accountPresentation, feedbackPresentation, brokerPresentation, connectionPresentation, onConnectionClose, connectionPlanContinuation, onConnectionPlanContinuationConsumed, authSurface, marketQuestionActions, marketChartActions, followupActions, continuationActions }: {
  state: Omit<InternalPocPresentation, 'messages' | 'onSend'> & { messages: readonly ClientServiceMessage[]; onSend: (value: string, displayText?: string, researchThread?: NativeResearchThreadOrigin) => Promise<void>; canStop?: boolean; onStop?: () => void }; onLogin?: (intent?: ClientAuthIntent, request?: ClientConnectionPlanAuthRequest) => void; onHistory?: () => void; onQuickReply?: (value: string, researchThread?: NativeResearchThreadOrigin) => Promise<void>; serviceNotice?: string; sessionRecoveryNeeded?: boolean; conversationNavigation?: ReactNode
  strategyDocument?: { identity: string; content: ReactNode; renderResearch?: (actions: ReactNode) => ReactNode }
  conversationNotice?: ReactNode
  /** Observed result identity/status, only for the conversation's unread UI. */
  resultActivityKey?: string
  analysis?: ReactNode
  /** Presentation identity only. Result ownership remains in the controller. */
  analysisIdentity?: string
  /** Active controller-owned auth/approval overlays, not retained hidden DOM. */
  analysisPresentationBlocked?: boolean
  /** Untrusted presence hint for the initial empty surface, never authority. */
  loadingHome?: boolean
  /** One-shot presentation command after a confirmed edit, never authority. */
  composerRequest?: object
  /** Native controller owns authenticated-only logout. The older isolated
   * fixture also supports anonymous session termination; do not conflate them. */
  nativeAccounts?: boolean
  /** Confirmed session identity, memory-only. Not a request or display field. */
  accountScope?: string | null
  /** Explicit service quota producer; unprovided data never inherits local Mock credit. */
  usagePresentation?: Omit<ClientSettingsUsageProps, 'scope'>
  connectionStatus?: Omit<ClientConnectionStatusProps, 'scope' | 'source'>
  /** Owner-bound UI inputs, never preview records or implicit HTTP producers. */
  conversationLibrary?: ConversationLibraryPresentation
  insightPresentation?: { scope: string; data: InsightPresentationData; onFeedback?: (slug: string, value: 0 | 1 | 2) => Promise<void> }
  sharingPresentation?: { scope: string; identity?: string; data: SharingServicePresentation }
  accountPresentation?: NativeAccountPresentation
  brokerPresentation?: BrokerServicePresentation
  /** Explicit owner-bound display data. A non-empty requestId is reserved for
   * a verified callback intent; background data continues to feed settings. */
  connectionPresentation?: NativeConnectionPresentation & { requestId: string }
  onConnectionClose?: () => void
  /** One validated auth-panel result may resume presentation once. It grants
   * neither exchange access nor a connection/provider operation. */
  connectionPlanContinuation?: ClientConnectionPlanContinuationReceipt | null
  onConnectionPlanContinuationConsumed?: (requestId: string) => void
  authSurface?: ReactNode
  feedbackPresentation?: { scope: string; onSubmit: (submission: ClientFeedbackSubmission) => Promise<void> }
  researchPresentation?: { scope: string; data: Omit<NativeResearchWorkspaceProps, 'title' | 'titleEditor' | 'onBack' | 'strategyDocument' | 'analysis' | 'analysisOpen' | 'onOpenAnalysis' | 'onCloseAnalysis' | 'composer' | 'composerHasContext' | 'threadForDocument' | 'threadEntriesForDocument' | 'threadActivity'> }
  executionHistory?: ClientServiceHistory
  /** Redacted lookup notice also survives loss of access to privileged rows. */
  historyFeedback?: ReactNode
  /** Navigation persistence errors must remain visible on a preserved hub. */
  navigationFeedback?: ReactNode
  /** Existing SDK nextQuestion prompt; never parsed from AI prose. */
  clarification?: { prompt: string; identity: string } | null
  /** Explicit acceptance port. Never infer ACK from the existing void onSend.
   * The native adapter still owns validated TURN/owner/conversation binding. */
  marketQuestionActions?: { scope: string; submit: NonNullable<MarketQuestionActions['submit']> }
  /** Display request port only. A contract-owned adapter must supply the new
   * observation; accepting a request never relabels old prices locally. */
  marketChartActions?: { scope: string; request: NonNullable<MarketChartActions['request']> }
  /** Explicit existing-flow acceptance, not permission to save alerts or order. */
  followupActions?: { scope: string; activate: (selection: FollowupSelection, signal: AbortSignal, thread?: NativeResearchThreadOrigin) => boolean | Promise<boolean> }
  continuationActions?: { scope: string; resume: (request: ContinueResponseRequest, signal: AbortSignal, thread?: NativeResearchThreadOrigin) => boolean | Promise<boolean> }
}) {
  const { language, t } = useClientPreferences()
  const { c } = useConversationCopy()
  const n = (key: NativeShellCopyKey, feature?: string) => nativeShellText(language, key, feature)
  const mapSiteHref = useSiteHrefMapper()
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const resetHomeFocus = useRef(false)
  const resetHomeAtTop = useRef(false)
  const questionOwnerRef = useRef(accountScope)
  useLayoutEffect(() => { questionOwnerRef.current = accountScope; return () => { questionOwnerRef.current = undefined } }, [accountScope, state.sessionState])
  const [questionWriteHint, setQuestionWriteHint] = useState<{ scope: typeof accountScope; sessionState: typeof state.sessionState; messageId: string; bindingKey: string; tailId: string | undefined; title: string } | null>(null)
  const questionPlaceholder = questionWriteHint && questionWriteHint.scope === accountScope && questionWriteHint.sessionState === state.sessionState && questionWriteHint.tailId === state.messages.at(-1)?.id
    && state.messages.some(message => message.id === questionWriteHint.messageId && message.responseBlocks?.some(block => block.kind === 'market-question' && marketBindingKey(block.presentation.binding) === questionWriteHint.bindingKey))
    ? marketQuestionText(language, 'writePlaceholder', { title: questionWriteHint.title }) : undefined
  const recoveryNotice = useRef<HTMLParagraphElement>(null)
  const [templates, setTemplates] = useState<HomeTemplateSelection>({ acts: [], assets: [] })
  const [templateOwner, setTemplateOwner] = useState({ scope: accountScope, state: state.sessionState })
  const confirmedOwner = accountScope != null && state.sessionState != null
  if (state.phase === 'logged-out' ? templateOwner.scope != null
    : confirmedOwner && (templateOwner.scope !== accountScope || templateOwner.state !== state.sessionState)) {
    setTemplateOwner({ scope: state.phase === 'logged-out' ? null : accountScope, state: state.sessionState })
    setTemplates({ acts: [], assets: [] })
  }
  const [bandHeight, setBandHeight] = useState(200)
  const [homeEntrance, setHomeEntrance] = useState(true)
  // Presentation-only snapshot of the submitted home composer. Reuse the
  // common source transition; never delay or acknowledge a service request.
  const [arrivalRect, setArrivalRect] = useState<DOMRect | undefined>(undefined)
  const [surface, setSurface] = useState<'settings' | 'locale' | 'profile' | 'help' | 'feedback' | null>(null)
  const helpIdentity = JSON.stringify([accountScope, state.sessionState])
  const [helpOwner, setHelpOwner] = useState<string | null>(null)
  if (surface === 'help' && helpOwner !== helpIdentity) setHelpOwner(helpIdentity)
  const [settingsAnchor, setSettingsAnchor] = useState<number | undefined>(undefined)
  const surfaceReturnFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => () => { surfaceReturnFocus.current = null }, [accountScope, state.sessionState])
  const openAccountSurface = (next: 'settings' | 'locale', anchor?: ClientMenuAnchor) => {
    surfaceReturnFocus.current = anchor?.trigger ?? null
    setSettingsAnchor(anchor?.top)
    setSurface(next)
  }
  const [historyView, setHistoryView] = useState<{ open: boolean; page: 'history' | 'sharing'; visit: number; focusSelection: boolean }>(() => ({ open: Boolean(readSharedLocation()), page: readSharedLocation() ? 'sharing' : 'history', visit: 0, focusSelection: false }))
  const [sharingLocation, setSharingLocation] = useState<SharedLocation>(() => readSharedLocation() ?? { period: 'all' })
  const researchHistory = historyView.open && historyView.page === 'history'
  const strategies = historyView.open && historyView.page === 'sharing'
  const sharingWasOpen = useRef(strategies)
  useLayoutEffect(() => {
    if (sharingWasOpen.current && !strategies && readSharedLocation()) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    sharingWasOpen.current = strategies
  }, [strategies])
  const setResearchHistory = (open: boolean) => setHistoryView(current =>
    current.open === open && !current.focusSelection && (!open || current.page === 'history') ? current
      : { open, page: open ? 'history' : current.page, visit: current.visit + (open && (!current.open || current.page !== 'history') ? 1 : 0), focusSelection: false })
  const historyScopeId = useId()
  const [accountPlan, setAccountPlan] = useState(() => Boolean(readClientAccountLocation()))
  const [accountLocation, setAccountLocation] = useState<ClientAccountLocation>(() => readClientAccountLocation() ?? { kind: 'plan', tab: 'plan' })
  const [trading, setTrading] = useState(() => window.location.hash === '#/trade')
  const accountWasOpen = useRef(accountPlan || trading)
  useLayoutEffect(() => {
    if (accountWasOpen.current && !accountPlan && !trading && isClientAccountEntry()) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    accountWasOpen.current = accountPlan || trading
  }, [accountPlan, trading])
  const [insights, setInsights] = useState(() => Boolean(readClientInsightLocation()))
  const [insightLocation, setInsightLocation] = useState<ClientInsightLocation>(() => readClientInsightLocation() ?? {})
  useLayoutEffect(() => {
    // Any explicit departure (including owner loss) retires this display route.
    // No navigation event is emitted: the already chosen panel owns the screen.
    if (!insights && readClientInsightLocation()) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }, [insights])
  const [brokers, setBrokers] = useState(false)
  const brokerData = brokerPresentationBound(brokerPresentation, accountScope) ? brokerPresentation : undefined
  const brokerDataset = brokerViewDataset(brokerData)
  const brokerOwner = accountScope ?? null
  const [brokerView, setBrokerView] = useState<BrokerViewState | null>(null)
  const [brokerBoundary, setBrokerBoundary] = useState({ owner: brokerOwner, dataset: brokerDataset, session: state.sessionState })
  const brokerBoundaryRef = useRef(brokerBoundary)
  if (brokerBoundary.owner !== brokerOwner || brokerBoundary.dataset !== brokerDataset || brokerBoundary.session !== state.sessionState) {
    setBrokerBoundary({ owner: brokerOwner, dataset: brokerDataset, session: state.sessionState })
    if (brokerView) setBrokerView(null)
  }
  useLayoutEffect(() => {
    brokerBoundaryRef.current = brokerBoundary
    return () => { brokerBoundaryRef.current = { owner: null, dataset: '', session: state.sessionState } }
  }, [brokerBoundary, state.sessionState])
  const updateBrokerView = (next: BrokerViewState) => {
    if (brokerBoundaryRef.current !== brokerBoundary || !brokerViewBound(next, brokerOwner, brokerDataset)) return
    setBrokerView(next)
  }
  const [researchWorkspaceOpen, setResearchWorkspaceOpen] = useState(false)
  const [researchViewState, setResearchViewState] = useState<{ scope: string; view: NativeResearchView } | null>(null)
  const [researchComposerHost, setResearchComposerHost] = useState<HTMLDivElement | null>(null)
  const [brokerListRequest, setBrokerListRequest] = useState(0)
  const brokerFocusIntent = useRef(false)
  const shouldFocusBrokers = useCallback(() => brokerFocusIntent.current, [])
  const insightFocusIntent = useRef(false)
  const shouldFocusInsights = useCallback(() => insightFocusIntent.current, [])
  const strategiesFocusIntent = useRef(false)
  const shouldFocusStrategies = useCallback(() => strategiesFocusIntent.current, [])
  const historyFocusIntent = useRef(false)
  const selectionNavigation = useRef(0)
  useLayoutEffect(() => { selectionNavigation.current++ }, [historyView.visit, accountPlan, trading, insights, brokers, accountScope, state.sessionState])
  const shouldFocusHistory = useCallback(() => historyFocusIntent.current, [])
  const resetPresentationIntent = useRef(0)
  const resetOwnerGeneration = useRef(0)
  useLayoutEffect(() => () => {
    // A later owner (including a replaced authentication state) must never
    // receive this owner's late reset error or have their selections retired.
    resetOwnerGeneration.current++
    resetPresentationIntent.current++
  }, [accountScope, state.sessionState])
  const libraryAction = useRef<{ scope: string | null | undefined } | null>(null)
  const [libraryPending, setLibraryPending] = useState(false)
  const [libraryFailed, setLibraryFailed] = useState(false)
  const serviceUsage = state.sessionState === 'AUTHENTICATED' && usagePresentation?.presentation?.source === 'service' && usagePresentationBound(usagePresentation.presentation, accountScope) ? usagePresentation : undefined
  const usageRef = useRef({ data: serviceUsage, provided: Boolean(usagePresentation), scope: accountScope })
  useLayoutEffect(() => {
    usageRef.current = { data: serviceUsage, provided: Boolean(usagePresentation), scope: accountScope }
    return () => { usageRef.current = { data: undefined, provided: true, scope: undefined } }
  }, [serviceUsage, usagePresentation, accountScope])
  const quotaAllows = (notify = false) => {
    if (usageRef.current.scope !== accountScope) return false
    const gate = usageRef.current.provided ? usageGate(usageRef.current.data?.presentation, accountScope ?? null, 'new') : 'allow'
    const allowed = !usageRef.current.provided || Boolean(usageRef.current.data && gate !== 'block' && gate !== 'unavailable')
    if (notify) setQuotaNotice(allowed ? null : { scope: accountScope, key: gate === 'block' ? 'full' : 'unavailable' })
    return allowed
  }
  const usageActions: ClientSettingsUsageProps = {
    presentation: serviceUsage?.presentation, scope: accountScope,
    onNext: serviceUsage?.onNext && (tier => { if (usageRef.current.scope === accountScope && usageRef.current.data === serviceUsage) serviceUsage.onNext?.(tier) }),
    onTopup: serviceUsage?.onTopup && (async (amount, signal) => {
      if (signal.aborted || usageRef.current.scope !== accountScope || usageRef.current.data !== serviceUsage) throw new Error('USAGE_SERVICE_UNAVAILABLE')
      await serviceUsage.onTopup?.(amount, signal)
    }),
    onAutoTopup: serviceUsage?.onAutoTopup && (async (enabled, signal) => {
      if (signal.aborted || usageRef.current.scope !== accountScope || usageRef.current.data !== serviceUsage) throw new Error('USAGE_SERVICE_UNAVAILABLE')
      await serviceUsage.onAutoTopup?.(enabled, signal)
    }),
  }
  const ownerRef = useRef(accountScope)
  useLayoutEffect(() => { ownerRef.current = state.sessionState === 'AUTHENTICATED' ? accountScope : null; return () => { ownerRef.current = null } }, [accountScope, state.sessionState])
  const library = state.sessionState === 'AUTHENTICATED' && accountScope && conversationLibrary?.scope === accountScope ? conversationLibrary : undefined
  const renameLocks = useRef(new Set<string>())
  const renameConversation = async (id: string, value: string) => {
    const key = JSON.stringify([accountScope, id])
    if (!library?.onRename || library.pending || ownerRef.current !== accountScope || renameLocks.current.has(key)) throw new Error('LIBRARY_RENAME_UNAVAILABLE')
    renameLocks.current.add(key)
    try { await library.onRename(id, value) }
    finally { renameLocks.current.delete(key) }
  }
  const insightData = accountScope && insightPresentation?.scope === accountScope ? insightPresentation : undefined
  // Anonymous sessions may read explicitly supplied editorial data and research.
  // Account history/sharing require authentication; scope is a session identity.
  const sharingData = state.sessionState === 'AUTHENTICATED' && accountScope && sharingPresentation?.scope === accountScope ? sharingPresentation.data : undefined
  const sharingDataset = sharingPresentation?.identity ?? 'default'
  const [sharingRouteBoundary, setSharingRouteBoundary] = useState({ owner: accountScope, dataset: sharingDataset, supplied: Boolean(sharingData) })
  const [sharingRouteReset, setSharingRouteReset] = useState(0)
  const handledSharingRouteReset = useRef(0)
  if (sharingRouteBoundary.owner !== accountScope || sharingRouteBoundary.dataset !== sharingDataset || sharingRouteBoundary.supplied !== Boolean(sharingData)) {
    setSharingRouteBoundary({ owner: accountScope, dataset: sharingDataset, supplied: Boolean(sharingData) })
    // Preserve an initial deep link while the first authenticated dataset loads.
    // Only an already supplied dataset's replacement/loss retires its detail.
    // Account changes separately close the surface and clear its active URL.
    if (sharingRouteBoundary.owner === accountScope && sharingRouteBoundary.supplied
      && (sharingRouteBoundary.dataset !== sharingDataset || !sharingData)) {
      setSharingLocation({ period: 'all' })
      setSharingRouteReset(value => value + 1)
    }
  }
  useLayoutEffect(() => {
    if (handledSharingRouteReset.current === sharingRouteReset) return
    handledSharingRouteReset.current = sharingRouteReset
    if (readSharedLocation()) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${sharedHash({ period: 'all' })}`)
  }, [sharingRouteReset])
  const [sharingView, setSharingView] = useState<NativeStrategyViewState | null>(null)
  if (sharingView && (!sharingData || sharingView.owner !== accountScope || sharingView.datasetIdentity !== sharingDataset)) setSharingView(null)
  const researchData = accountScope && researchPresentation?.scope === accountScope
    && (!strategyDocument || researchPresentation.data?.scopeId === strategyDocument.identity) ? researchPresentation.data : undefined
  const [researchWorkflowHost, setResearchWorkflowHost] = useState<HTMLDivElement | null>(null)
  const [researchOutcomeHost, setResearchOutcomeHost] = useState<HTMLDivElement | null>(null)
  const accountData = state.sessionState === 'AUTHENTICATED' && accountPresentationBound(accountPresentation, accountScope) ? accountPresentation : undefined
  const [alertsView, setAlertsView] = useState<NativeAccountAlertsView | null>(null)
  if (alertsView && (!accountData || alertsView.scope !== accountData.scope || alertsView.identity !== accountData.identity)) setAlertsView(null)
  const [alertsRequest, setAlertsRequest] = useState(0)
  const [dismissedConnection, setDismissedConnection] = useState<string | null>(null)
  const [connectionBrowse, setConnectionBrowse] = useState<{ owner: typeof accountScope; session: typeof state.sessionState; request: number; mode: 'browse' | 'continuation' } | null>(null)
  const connectionBrowseSequence = useRef(0)
  const consumedConnectionPlan = useRef<string | null>(null)
  const [connectionPlan, setConnectionPlan] = useState<ConnectionPlanLocation>({ step: 'plan', exchange: 'bitget' })
  if (connectionBrowse && (connectionBrowse.owner !== accountScope || connectionBrowse.session !== state.sessionState)) setConnectionBrowse(null)
  useLayoutEffect(() => {
    const receipt = connectionPlanContinuation
    if (!receipt || receipt.issuer !== 'client-connection-plan' || receipt.operation !== 'signup'
      || receipt.targetSessionId !== accountScope || state.sessionState !== 'AUTHENTICATED'
      || consumedConnectionPlan.current === receipt.requestId) return
    consumedConnectionPlan.current = receipt.requestId
    setConnectionPlan(receipt.plan)
    setConnectionBrowse({ owner: accountScope, session: state.sessionState, request: ++connectionBrowseSequence.current, mode: 'continuation' })
    onConnectionPlanContinuationConsumed?.(receipt.requestId)
  }, [accountScope, connectionPlanContinuation, onConnectionPlanContinuationConsumed, state.sessionState])
  const connectionData = nativeAccounts && state.sessionState === 'AUTHENTICATED' && connectionPresentationBound(connectionPresentation, accountScope)
    ? connectionPresentation : undefined
  const latestConnectionPlanAuthority = useRef({ owner: accountScope, session: state.sessionState, browse: connectionBrowse, data: connectionData, broker: brokerData, plan: connectionPlan })
  useLayoutEffect(() => {
    latestConnectionPlanAuthority.current = { owner: accountScope, session: state.sessionState, browse: connectionBrowse, data: connectionData, broker: brokerData, plan: connectionPlan }
  }, [accountScope, connectionBrowse, connectionData, brokerData, connectionPlan, state.sessionState])
  const connectionPlanAuthorize = (() => {
    const browse = connectionBrowse, data = connectionData, stage = data?.state, exchange = connectionPlan.exchange
    if (nativeAccounts && connectionPlan.step === 'authorize' && exchange === 'bitget' && browse
      && browse.owner === accountScope && browse.session === 'AUTHENTICATED' && state.sessionState === 'AUTHENTICATED'
      && brokerData?.identity === `bitget-canary:${accountScope}` && brokerData.actions?.onConnect) {
      const broker = brokerData, action = brokerData.actions.onConnect
      const choice = broker.catalog?.find(item => item.broker.id === exchange && item.broker.conn)
      if (choice?.connectionState === 'NEEDS_LINK' || choice?.connectionState === 'CONNECTED') {
        const connectionState = choice.connectionState
        return async () => {
          await Promise.resolve()
          const current = latestConnectionPlanAuthority.current
          if (ownerRef.current !== accountScope || current.owner !== accountScope || current.session !== 'AUTHENTICATED'
            || current.browse !== browse || current.broker !== broker || current.broker?.identity !== `bitget-canary:${accountScope}`
            || current.plan.step !== 'authorize' || current.plan.exchange !== exchange
            || broker.actions?.onConnect !== action || !broker.catalog?.includes(choice)) return
          await action(exchange, connectionState)
          const settled = latestConnectionPlanAuthority.current
          if (ownerRef.current === accountScope && settled.owner === accountScope && settled.session === 'AUTHENTICATED'
            && settled.browse === browse && settled.plan.step === 'authorize' && settled.plan.exchange === exchange) {
            setConnectionBrowse(value => value === browse ? { ...browse, mode: 'browse' } : value)
          }
        }
      }
    }
    // This bridge is deliberately limited to the currently shipped API12 Bitget producer.
    if (connectionPlan.step !== 'authorize' || exchange !== 'bitget' || !browse || browse.mode !== 'continuation' || browse.owner !== accountScope || browse.session !== 'AUTHENTICATED'
      || state.sessionState !== 'AUTHENTICATED' || data?.status !== 'ready' || stage?.kind !== 'exchange'
      || data.identity !== `exchange:${accountScope}` || !stage.exchanges?.some(choice => choice.id === exchange) || !stage.onChoose) return undefined
    const action = stage.onChoose
    return async () => {
      await Promise.resolve()
      const current = latestConnectionPlanAuthority.current
      if (ownerRef.current !== accountScope || current.owner !== accountScope || current.session !== 'AUTHENTICATED'
        || current.browse !== browse || current.data !== data || current.data?.identity !== `exchange:${accountScope}`
        || current.plan.step !== 'authorize' || current.plan.exchange !== exchange || data.state !== stage || stage.onChoose !== action
        || !stage.exchanges?.some(choice => choice.id === exchange)) return
      await action(exchange)
      const settled = latestConnectionPlanAuthority.current
      if (ownerRef.current === accountScope && settled.owner === accountScope && settled.session === 'AUTHENTICATED'
        && settled.browse === browse && settled.plan.step === 'authorize' && settled.plan.exchange === exchange) {
        setConnectionBrowse(value => value === browse ? { ...browse, mode: 'browse' } : value)
      }
    }
  })()
  const settingsAccountConnections = projectSettingsAccountConnections(connectionData, accountScope)
  const settingsConnectionOwner = connectionData ? settingsAccountConnectionOwner(connectionData.scope, connectionData.identity) : null
  const latestSettingsConnections = useRef(settingsAccountConnections)
  const latestSettingsConnectionOwner = useRef(settingsConnectionOwner)
  const settingsConnectionSequence = useRef(0)
  const activeSettingsConnection = useRef<SettingsConnectionOperationInternal | null>(null)
  const latestSettingsFocus = useRef<ClientSettingsConnectionOperation['focusRequest']>(null)
  const settingsPageRendered = useRef(false)
  const [settingsConnectionPending, setSettingsConnectionPending] = useState<SettingsConnectionOperationInternal | null>(null)
  const [settingsConnectionSettlement, setSettingsConnectionSettlement] = useState<SettingsConnectionSettlement | null>(null)
  const [settingsConnectionFailure, setSettingsConnectionFailure] = useState<ClientSettingsConnectionOperation['failure']>(null)
  const [settingsConnectionFocus, setSettingsConnectionFocus] = useState<ClientSettingsConnectionOperation['focusRequest']>(null)
  useLayoutEffect(() => {
    latestSettingsConnections.current = settingsAccountConnections
    latestSettingsConnectionOwner.current = settingsConnectionOwner
    latestSettingsFocus.current = settingsConnectionFocus
  }, [settingsAccountConnections, settingsConnectionOwner, settingsConnectionFocus])
  useLayoutEffect(() => {
    const settlement = settingsConnectionSettlement
    if (!settlement || activeSettingsConnection.current !== settlement.operation) return
    const operation = settlement.operation
    if (settingsConnectionOwner !== operation.ownerBinding) {
      queueMicrotask(() => {
        if (activeSettingsConnection.current !== operation) return
        activeSettingsConnection.current = null
        setSettingsConnectionPending(current => current === operation ? null : current)
        setSettingsConnectionSettlement(current => current === settlement ? null : current)
      })
      return
    }
    const revision = connectionData?.state.id
    if (revision === operation.sourceRevision && !settlement.ready) {
      const frame = requestAnimationFrame(() => setSettingsConnectionSettlement(current => current === settlement ? { ...current, ready: true } : current))
      return () => cancelAnimationFrame(frame)
    }
    const remains = settingsAccountConnections?.accounts.some(account => account.id === operation.id) ?? false
    queueMicrotask(() => {
      if (activeSettingsConnection.current !== operation) return
      activeSettingsConnection.current = null
      setSettingsConnectionPending(current => current === operation ? null : current)
      setSettingsConnectionSettlement(current => current === settlement ? null : current)
      setSettingsConnectionFailure(remains && revision ? { ownerBinding: operation.ownerBinding, revision } : null)
      setSettingsConnectionFocus(operation.restoreFocus && settingsPageRendered.current
        ? { token: operation.token, ownerBinding: operation.ownerBinding, id: operation.id, restoreFocus: true }
        : null)
    })
  }, [connectionData, settingsAccountConnections, settingsConnectionOwner, settingsConnectionSettlement])
  const startSettingsConnectionOperation: ClientSettingsConnectionOperation['start'] = (data, id, action, restoreFocus) => {
    const ownerBinding = settingsAccountConnectionOwner(data.scope, data.identity)
    const latest = latestSettingsConnections.current
    if (!latest || settingsAccountConnectionOwner(latest.scope, latest.identity) !== ownerBinding || latest.revision !== data.revision) return
    if (activeSettingsConnection.current?.ownerBinding === ownerBinding) return
    const operation = { token: ++settingsConnectionSequence.current, ownerBinding, sourceRevision: data.revision, id, restoreFocus }
    activeSettingsConnection.current = operation
    setSettingsConnectionPending(operation)
    setSettingsConnectionSettlement(null)
    setSettingsConnectionFailure(null)
    setSettingsConnectionFocus(null)
    const settle = (rejected: boolean) => {
      if (activeSettingsConnection.current === operation) setSettingsConnectionSettlement({ operation, rejected, ready: false })
    }
    try {
      void Promise.resolve(action()).then(() => settle(false), () => settle(true))
    } catch {
      settle(true)
    }
  }
  const settingsConnectionOperation: ClientSettingsConnectionOperation = {
    pending: settingsConnectionPending,
    failure: settingsConnectionFailure,
    focusRequest: settingsConnectionFocus,
    start: startSettingsConnectionOperation,
    takeFocusRequest: request => {
      if (latestSettingsFocus.current?.token !== request.token) return false
      latestSettingsFocus.current = null
      queueMicrotask(() => setSettingsConnectionFocus(current => current?.token === request.token ? null : current))
      return latestSettingsConnectionOwner.current === request.ownerBinding && activeSettingsConnection.current === null
    },
  }
  const connectionKey = connectionData?.requestId.trim() ? JSON.stringify([accountScope, connectionData.identity, connectionData.requestId]) : null
  const callbackConnectionOpen = connectionKey !== null && connectionKey !== dismissedConnection
  const explicitConnectionOpen = connectionBrowse !== null && connectionBrowse.owner === accountScope && connectionBrowse.session === state.sessionState
  const connectionOpen = callbackConnectionOpen || explicitConnectionOpen
  const closeConnection = () => {
    onConnectionClose?.()
    setConnectionBrowse(null)
    setDismissedConnection(connectionKey)
    requestAnimationFrame(() => document.getElementById('tesia-main')?.focus({ preventScroll: true }))
  }
  useEffect(() => {
    if (!connectionOpen) return
    const closeOnNavigation = () => { setConnectionBrowse(null); setDismissedConnection(connectionKey) }
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('hashchange', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    return () => {
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('hashchange', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
    }
  }, [connectionOpen, connectionKey])
  const unread = accountData?.notifications == null ? null : accountData.notifications.filter(item => !item.read).length
  const alertsLabel = accountActivityText(language, 'alerts') + (unread && unread > 0 ? `, ${accountActivityText(language, 'unread', { count: String(unread) })}` : '')
  const feedbackData = accountScope && feedbackPresentation?.scope === accountScope ? feedbackPresentation : undefined
  const researchView = researchData?.view ?? (researchViewState?.scope === researchData?.scopeId ? researchViewState?.view : undefined)
  const currentResearchId = normalizeResearchView(researchView, [...RESEARCH_DOCUMENT_SURFACES.map(item => item.id),
    ...(researchData?.documents ?? []).map(item => item.id), ...(researchData?.typedDocuments ?? []).map(item => item.id)]).activeDocumentId
  const currentResearchTitle = currentResearchId === 'report' && analysis ? nativeResultText(language, 'resultTitle')
    : researchData?.documents?.find(item => item.id === currentResearchId)?.title ?? researchData?.typedDocuments?.find(item => item.id === currentResearchId)?.title
      ?? RESEARCH_DOCUMENT_SURFACES.find(item => item.id === currentResearchId)?.title ?? currentResearchId
  const changeResearchView = (view: NativeResearchView) => {
    if (!researchData) return
    setResearchViewState({ scope: researchData.scopeId, view }); researchData.onViewChange?.(view)
  }
  const openResearch = (id: string) => {
    if (!researchData) return
    changeResearchView(openResearchDocument(researchView ?? { activeDocumentId: 'plan', openDocumentIds: ['plan', 'activity'] }, id))
    setResearchWorkspaceOpen(true)
  }
  const [lastResearchComposerRequest, setLastResearchComposerRequest] = useState(composerRequest)
  // Close the document before child layout effects consume the focus command.
  // Otherwise they focus the portal textarea that this render then removes.
  if (lastResearchComposerRequest !== composerRequest) {
    setLastResearchComposerRequest(composerRequest)
    if (composerRequest && researchWorkspaceOpen) setResearchWorkspaceOpen(false)
  }
  const historyWasOpen = useRef(false)
  const consumedHistoryFocus = useRef<number | null>(null)
  const content = useRef<HTMLDivElement>(null)
  const [notice, setNotice] = useState<ShellNotice | null>(null)
  const [quotaNotice, setQuotaNotice] = useState<{ scope: typeof accountScope; key: 'full' | 'unavailable' } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [surfaceOwner, setSurfaceOwner] = useState({ scope: accountScope, state: state.sessionState })
  if (surfaceOwner.scope !== accountScope || surfaceOwner.state !== state.sessionState) {
    setSurfaceOwner({ scope: accountScope, state: state.sessionState })
    setArrivalRect(undefined)
    if (alertsRequest) setAlertsRequest(0)
    if (surface) setSurface(null)
    if (helpOwner !== null) setHelpOwner(null)
    if (settingsAnchor !== undefined) setSettingsAnchor(undefined)
    if (historyView.open && !(surfaceOwner.scope == null && readSharedLocation())) setResearchHistory(false)
    if (accountPlan && !(surfaceOwner.scope == null && readClientAccountLocation())) setAccountPlan(false)
    if (trading && !(surfaceOwner.scope == null && window.location.hash === '#/trade')) setTrading(false)
    if (insights && !(surfaceOwner.scope == null && readClientInsightLocation())) setInsights(false)
    if (brokers) setBrokers(false)
    if (libraryFailed) setLibraryFailed(false)
    if (libraryPending) setLibraryPending(false)
    if (researchWorkspaceOpen) setResearchWorkspaceOpen(false)
    if (notice) setNotice(null)
    if (confirmReset) setConfirmReset(false)
  }
  // Store semantic notice identity so an already open notice follows locale
  // changes without touching requests, storage or the underlying conversation.
  const featureLabel = (feature: UnavailableFeature) => {
    if (feature === 'download') return t('banner.dl')
    if (feature === 'trading') return shellText(language, 'trading')
    // The source sidebar uses the shorter Strategies label, not Sharing.
    if (feature === 'sharing') return shellText(language, 'strategies')
    return researchNavigationLabel(language, feature)
  }
  const noticeText = quotaNotice?.scope === accountScope && quotaNotice ? usageText(language, quotaNotice.key) : notice ? n(notice.key, notice.feature ? featureLabel(notice.feature) : undefined) : ''
  // A translated default is presentation, never a user-authored title. Keep
  // explicit titles (even an exact "새 전략") intact across locale changes.
  const [title, setTitle] = useState<{ value: string; scope?: string } | null>(null)
  const [recoveryDismissed, setRecoveryDismissed] = useState(false)
  const hasConversation = state.messages.some(message => message.role === 'user') || Boolean(state.workflow)
  const isHome = !hasConversation && (state.phase === 'ready' || (loadingHome && (state.phase === 'loading' || state.phase === 'error')))
  const neutralLoading = nativeAccounts && state.phase === 'loading' && !isHome
  // Retain only the identity through temporary authority loss, never content.
  // A new owner/conversation/draft resets document tabs and scroll; a revision
  // update (or a transient unavailable document) does not remount live results.
  const [documentIdentity, setDocumentIdentity] = useState(strategyDocument?.identity)
  const [documentMountKey, setDocumentMountKey] = useState(0)
  if (isHome && !strategyDocument && documentIdentity !== undefined) {
    // Only a confirmed home transition retires the old document lifetime.
    // Reset may fail; never clear identity merely because Reset was clicked.
    // The next home question mounts once, before its first server binding.
    setDocumentIdentity(undefined)
  } else if (strategyDocument && strategyDocument.identity !== documentIdentity) {
    // First server binding belongs to the conversation already on screen.
    // Only replacing a known owner/draft resets its document navigation.
    if (documentIdentity !== undefined) {
      setDocumentMountKey(key => key + 1)
      setArrivalRect(undefined)
    }
    setDocumentIdentity(strategyDocument.identity)
    if (title && title.scope !== strategyDocument.identity) {
      // A fresh home question acquires its first server binding. A restored
      // different document must never inherit the previous document's title.
      setTitle(title.scope === undefined ? { ...title, scope: strategyDocument.identity } : null)
    }
  }
  const activeRecord = library?.records.find(record => record.id === library.activeId)
  const visibleTitle = (activeRecord?.title.trim() ? activeRecord.title : undefined) ?? (title && (title.scope === undefined || title.scope === strategyDocument?.identity)
    ? title.value : c('newStrategy'))
  const available = state.phase === 'ready' && !state.inputDisabled && !state.busy
  const assistantBlocks = (message: ClientServiceMessage): readonly ClientResponseBlock[] => {
    const blocks: readonly ClientResponseBlock[] = message.observation ? [
      ...observationResponseBlocks(message.observation, language),
      // An observed work/text transcript must not suppress separately supplied
      // display cards. Do not replay untrusted text as observations or actions.
      ...(message.responseBlocks ?? []).filter(block => block.kind !== 'work' && block.kind !== 'text' && block.presentation.binding.messageId === message.id),
    ]
      : message.responseBlocks ?? [{ id: message.id, kind: 'text', text: message.text, status: 'done' }]
    // Only the active question moves into its card. Preserve all stored text,
    // past questions and observed work blocks for the conversation transcript.
    const asking = Boolean(clarification) || blocks.some(block => block.kind === 'market-question' || block.kind === 'text' && block.status !== 'done')
    const activeBlocks = blocks.filter(block => block.kind !== 'followups' || !asking && message.id === state.messages.at(-1)?.id && block.presentation.binding.messageId === message.id)
    return !state.busy && clarification && message.id === state.messages.at(-1)?.id
      ? activeBlocks.filter(block => !(block.kind === 'text' && block.status === 'done' && block.text === clarification.prompt))
      : activeBlocks
  }
  const continuation = (message: ClientServiceMessage) => {
    const binding = message.continuationBinding
    if (!binding || binding.messageId !== message.id || !marketBindingKey(binding) || message.id !== state.messages.at(-1)?.id || clarification) return undefined
    const onContinue: ContinueResponseAction | undefined = continuationActions && accountScope != null && continuationActions.scope === accountScope ? (request, signal) => {
      if (!available || !quotaAllows(true) || signal.aborted || questionOwnerRef.current !== accountScope || request.prompt !== CONTINUE_RESPONSE_PROMPT
        || marketBindingKey(request.binding) !== marketBindingKey(binding) || message.id !== state.messages.at(-1)?.id) return false
      const text = assistantBlocks(message).filter(block => block.kind === 'text')
      if (text.at(-1)?.status !== 'interrupted' || text.some(block => block.status === 'streaming') || request.partialText !== text.map(block => block.text).join('\n\n')) return false
      return continuationActions.resume(request, signal, message.researchThread ? { ...message.researchThread } : undefined)
    } : undefined
    return { binding, busy: !available, onContinue }
  }
  const followups = (message: ClientServiceMessage): FollowupActions => ({
    busy: !available,
    activate: followupActions && accountScope != null && followupActions.scope === accountScope ? (selection, signal) => {
      if (!available || (selection.kind === 'question' || selection.item.type !== 'alert') && !quotaAllows(true) || signal.aborted || questionOwnerRef.current !== accountScope || selection.binding.messageId !== message.id || message.id !== state.messages.at(-1)?.id) return false
      const block = message.responseBlocks?.find(item => item.kind === 'followups' && marketBindingKey(item.presentation.binding) === marketBindingKey(selection.binding))
      if (block?.kind !== 'followups') return false
      const items = selection.kind === 'action' ? block.presentation.actions : block.presentation.questions
      if (!items.some(item => JSON.stringify(item) === JSON.stringify(selection.item))) return false
      return followupActions.activate(selection, signal, message.researchThread ? { ...message.researchThread } : undefined)
    } : undefined,
  })
  const questionActions = (message: ClientServiceMessage): MarketQuestionActions => ({
    busy: !available,
    submit: marketQuestionActions && accountScope != null && marketQuestionActions.scope === accountScope
      ? (answer, signal) => {
        if (!available || !quotaAllows(true) || signal.aborted || answer.binding.messageId !== message.id || questionOwnerRef.current !== accountScope || answer.text.length > 1000) return false
        return marketQuestionActions.submit(answer, signal)
      } : undefined,
    write: (binding, title) => {
      const bindingKey = marketBindingKey(binding)
      if (!available || binding.messageId !== message.id || !bindingKey) return false
      const target = input.current ?? root.current?.querySelector<HTMLTextAreaElement>('.g-composer textarea')
      if (!target || target.disabled || target.closest('[inert],[hidden]') || !target.getClientRects().length) return false
      target.focus()
      if (document.activeElement !== target) return false
      setQuestionWriteHint({ scope: accountScope, sessionState: state.sessionState, messageId: message.id, bindingKey, tailId: state.messages.at(-1)?.id, title })
      return true
    },
  })
  const chartActions = (message: ClientServiceMessage): MarketChartActions => ({
    request: marketChartActions && accountScope != null && marketChartActions.scope === accountScope
      ? (request, signal) => {
        if (signal.aborted || questionOwnerRef.current !== accountScope || request.binding.messageId !== message.id
          || !message.responseBlocks?.some(block => block.kind === 'market-chart' && block.presentation.seriesId === request.seriesId
            && marketBindingKey(block.presentation.binding) === marketBindingKey(request.binding))) return false
        return marketChartActions.request(request, signal)
      } : undefined,
  })
  const unavailable = () => setNotice({ key: 'unavailable' })
  const unavailableMenu = (feature: UnavailableFeature) => {
    setSurface(null)
    setNotice({ key: 'featureUnavailable', feature })
  }
  const logoutDisabled = state.busy || !state.onLogout || state.sessionState !== 'AUTHENTICATED' || !['ready', 'error'].includes(state.phase)
  const logoutFromProfile = () => {
    if (logoutDisabled) return
    setSurface(null)
    // Leave the settings page at explicit confirmation, not only after success.
    // The host's existing pending/failure recovery must remain visible if the
    // request loses its response. This does not confirm or retry the logout.
    closeClientSettingsRoute()
    // The existing controller owns preconditions, journal retention and the
    // same-tick guard. Closing a menu never constitutes a logout receipt.
    void state.onLogout?.()
  }
  const login = (intent: ClientAuthIntent = 'login', request?: ClientConnectionPlanAuthRequest) => { setHomeEntrance(false); if (onLogin) onLogin(intent, request); else unavailable() }
  const settingsTab = useClientSettingsRoute({
    signedIn: nativeAccounts && state.sessionState === 'AUTHENTICATED',
    ready: nativeAccounts && state.phase !== 'loading',
    onLogin: login,
  })
  const settingsPageIsRendered = Boolean(settingsTab && !connectionOpen && !connectionStatus)
  useLayoutEffect(() => {
    settingsPageRendered.current = settingsPageIsRendered
    if (settingsPageIsRendered) return
    latestSettingsFocus.current = null
    queueMicrotask(() => setSettingsConnectionFocus(null))
  }, [settingsPageIsRendered])
  const history = () => {
    historyFocusIntent.current = !researchHistory
    setHomeEntrance(false)
    setAccountPlan(false)
    setTrading(false)
    setInsights(false); setBrokers(false)
    if (nativeAccounts) {
      setNotice(null); setResearchHistory(true)
    }
    else (onHistory ?? unavailable)()
  }
  useLayoutEffect(() => {
    if (historyWasOpen.current && !historyView.open && !accountPlan && !trading && !insights && !brokers && !settingsTab && !root.current?.closest('[hidden],[inert]')) {
      const selected = historyView.focusSelection && consumedHistoryFocus.current !== historyView.visit
        ? content.current?.querySelector<HTMLElement>('[data-native-history-selection]') : null
      // An answer arriving off-screen can replace the composer with the
      // source question dock. Return to its visible input/choice, not a hidden
      // textarea or a close button. Do not open or submit the question here.
      const dockControls = [...(content.current?.querySelectorAll<HTMLElement>('.client-question-dock input, .client-question-dock textarea, .client-question-dock button.op') ?? [])]
        .filter(element => !element.matches(':disabled') && !element.closest('[hidden],[inert]') && element.getClientRects().length)
      const dockInput = dockControls.find(element => element.matches('input,textarea')) ?? dockControls[0]
      const target = selected ?? dockInput ?? input.current ?? content.current?.querySelector<HTMLElement>('.g-composer textarea')
      if (selected) selected.scrollIntoView({ block: 'nearest' })
      if (target && !target.matches(':disabled') && target.getClientRects().length) target.focus({ preventScroll: true })
      else document.getElementById('tesia-main')?.focus({ preventScroll: true })
    }
    historyWasOpen.current = historyView.open || accountPlan || trading || insights || brokers
    if (historyView.focusSelection) consumedHistoryFocus.current = historyView.visit
  }, [historyView.open, accountPlan, trading, insights, brokers, settingsTab, historyView.focusSelection, historyView.visit])
  const editInput = (value: string) => state.onInput(value)
  const insightHref = (location: ClientInsightLocation) => `${window.location.pathname}${window.location.search}${clientInsightHash(location)}`
  const navigateInsight = (location: ClientInsightLocation) => { setInsightLocation(location); pushSiteLocation(insightHref(location)) }
  const navigateSharing = (location: SharedLocation, replace = false) => {
    // A new route is an explicit navigation intent. Later pointer/keyboard
    // activity still cancels it through the existing capture handlers.
    strategiesFocusIntent.current = true
    setSharingLocation(location)
    const href = `${window.location.pathname}${window.location.search}${sharedHash(location)}`
    if (replace) { window.history.replaceState(window.history.state, '', href); window.dispatchEvent(new Event('teth:navigate')) }
    else pushSiteLocation(href)
  }
  const navigateAccount = (location: ClientAccountLocation) => {
    const hash = safeClientAccountHash(location)
    if (!hash || !accountLocationAvailable(accountData, location)) return
    setAccountLocation(location)
    pushSiteLocation(`${window.location.pathname}${window.location.search}${hash}`)
  }
  const closeAccount = () => {
    setAccountPlan(false); setTrading(false)
    if (isClientAccountEntry()) pushSiteLocation(`${window.location.pathname}${window.location.search}`)
  }
  const closeSharing = () => {
    setResearchHistory(false)
    if (readSharedLocation()) pushSiteLocation(`${window.location.pathname}${window.location.search}`)
  }
  const closeInsights = () => {
    setInsights(false)
    if (readClientInsightLocation()) pushSiteLocation(`${window.location.pathname}${window.location.search}`)
  }
  const prepareQuestion = async (value: string) => {
    if (!available || state.input.trim()) throw new ClientInsightQuestionError(c('busyError'))
    editInput(value)
    closeInsights(); setResearchHistory(false); setTrading(false); setBrokers(false); setAccountPlan(false)
    requestAnimationFrame(() => (input.current ?? root.current?.querySelector<HTMLTextAreaElement>('.g-composer textarea'))?.focus({ preventScroll: true }))
  }
  const selectConversation = async (id: string) => {
    if (!library || libraryAction.current?.scope === accountScope || library.pending || state.busy || state.input.trim()) { setLibraryFailed(true); throw new Error('LIBRARY_UNAVAILABLE') }
    const scope = accountScope
    const intent = selectionNavigation.current
    const operation = { scope }
    libraryAction.current = operation; setLibraryPending(true); setLibraryFailed(false)
    try {
      await library.onSelect(id)
      if (ownerRef.current !== scope) throw new Error('LIBRARY_OWNER_CHANGED')
      if (intent !== selectionNavigation.current) return
      setResearchHistory(false); setAccountPlan(false); setInsights(false); setBrokers(false); setTrading(false)
    } catch {
      if (ownerRef.current === scope) setLibraryFailed(true)
      throw new Error('LIBRARY_SELECTION_FAILED')
    } finally { if (libraryAction.current === operation) { libraryAction.current = null; setLibraryPending(false) } }
  }
  const loadLibrary = async (action: (() => void | Promise<void>) | undefined) => {
    if (!library || !action || libraryAction.current?.scope === accountScope || library.pending) return
    const scope = accountScope
    const operation = { scope }
    libraryAction.current = operation; setLibraryPending(true); setLibraryFailed(false)
    try { await action() } catch { if (ownerRef.current === scope) setLibraryFailed(true) }
    finally { if (libraryAction.current === operation) { libraryAction.current = null; setLibraryPending(false) } }
  }
  const send = (value = isHome ? composeTemplatePrompt(templates, state.input, language) : state.input, source: 'composer' | 'quick-reply' = 'composer') => {
    if (!available) return
    if (!quotaAllows(true)) return
    if (!value.trim()) return
    if (value.length > 1000) {
      setNotice({ key: 'questionLimit' })
      ;(input.current ?? root.current?.querySelector<HTMLTextAreaElement>('.g-composer textarea'))?.focus()
      return
    }
    setNotice(null); setHomeEntrance(false)
    if (isHome) {
      const pill = root.current?.querySelector<HTMLElement>('.client-home-pill:not(.is-fullscreen)')
      setArrivalRect(matchMedia('(min-width:861px)').matches && pill?.getClientRects().length
        ? pill.getBoundingClientRect() : undefined)
    }
    const displayText = isHome && source === 'composer' ? state.input.trim() || value : value
    if (!hasConversation) setTitle({ value: displayText.trim().slice(0, 40) })
    // This Promise<void> is not an acknowledgement: controllers can resolve
    // after recording a recoverable failure. Preserve selections and let their
    // existing journal/recovery logic own the combined request and retries.
    const researchThread = researchData && researchWorkspaceOpen ? {
      scopeId: researchData.scopeId,
      documentId: currentResearchId,
    } : undefined
    void (source === 'quick-reply' && onQuickReply ? onQuickReply(value, researchThread) : state.onSend(value, displayText, researchThread))
  }
  const reset = async () => {
    if (state.busy) return
    setConfirmReset(false)
    const intent = ++resetPresentationIntent.current
    const generation = resetOwnerGeneration.current
    let accepted: void | boolean
    try { accepted = await state.onReset() }
    catch {
      if (intent === resetPresentationIntent.current) setNotice({ key: 'resetFailed' })
      return
    }
    if (generation !== resetOwnerGeneration.current) return
    if (accepted === false) return
    // Retire only the selection this request captured. A new selection made
    // while waiting belongs to the user's next question, not this reset.
    setTemplates(current => current === templates ? { acts: [], assets: [] } : current)
    // A rejected transition preserves the old screen and template choices.
    // A later user action owns presentation, even if this request succeeds.
    if (intent !== resetPresentationIntent.current) return
    resetHomeFocus.current = true
    resetHomeAtTop.current = trading && state.sessionState !== 'AUTHENTICATED'
    setArrivalRect(undefined)
    setResearchHistory(false)
    setAccountPlan(false)
    setTrading(false)
    setInsights(false); setBrokers(false)
    setHomeEntrance(false)
  }
  const newConversation = () => {
    // The home action cannot reset a session whose ownership is still being
    // checked. Keep the first input DOM and all pending recovery hints intact.
    if (state.phase === 'loading' || (isHome && state.phase === 'error')) return
    if (state.busy) { setNotice({ key: 'busyReset' }); return }
    if (hasConversation) setConfirmReset(true)
    else reset()
  }
  // Source acPageView owns the explicit connection entry. The catalogue stays
  // available only on its existing non-native discovery branch.
  const browseExchanges = () => {
    closeClientSettingsRoute()
    if (nativeAccounts) {
      setSurface(null); setNotice(null); setConfirmReset(false); setHomeEntrance(false)
      setResearchHistory(false); setAccountPlan(false); setTrading(false); setInsights(false); setBrokers(false)
      setConnectionPlan({ step: 'plan', exchange: 'bitget' })
      setConnectionBrowse({ owner: accountScope, session: state.sessionState, request: ++connectionBrowseSequence.current, mode: 'browse' })
      return
    }
    brokerFocusIntent.current = true
    setSurface(null); setNotice(null); setConfirmReset(false); setHomeEntrance(false)
    setResearchHistory(false); setAccountPlan(false); setTrading(false); setInsights(false)
    setBrokerListRequest(value => value + 1); setBrokers(true)
  }
  const recover = state.onRecover
  useEffect(() => {
    const closePresentation = () => {
      const nextInsight = readClientInsightLocation()
      const nextSharing = readSharedLocation()
      const nextAccount = readClientAccountLocation()
      const nextTrading = window.location.hash === '#/trade'
      if (!mapSiteHref && !nextInsight && !nextSharing && !nextAccount && !nextTrading && !readClientSettingsLocation()) { setInsights(false); setAccountPlan(false); setTrading(false); setBrokers(false); setHistoryView(current => current.page === 'sharing' ? { ...current, open: false, focusSelection: false } : current); return }
      resetPresentationIntent.current++
      setSurface(null); setConfirmReset(false); setNotice(null); setAccountPlan(Boolean(nextAccount)); setTrading(nextTrading); setInsights(Boolean(nextInsight)); setBrokers(false); setArrivalRect(undefined)
      if (nextAccount) setAccountLocation(nextAccount)
      if (nextAccount || nextTrading) setResearchHistory(false)
      if (nextInsight) { setInsightLocation(nextInsight); setResearchHistory(false) }
      // Preserve the existing research-history route lifecycle. The new sharing
      // presentation is dismissed on route changes, like trading/insights.
      if (nextSharing) { strategiesFocusIntent.current = true; setSharingLocation(nextSharing) }
      setHistoryView(current => nextSharing ? { open: true, page: 'sharing', visit: current.visit + (current.open && current.page === 'sharing' ? 0 : 1), focusSelection: false }
        : current.open && current.page === 'sharing' ? { ...current, open: false, focusSelection: false } : current)
    }
    window.addEventListener('teth:navigate', closePresentation)
    window.addEventListener('popstate', closePresentation)
    window.addEventListener('hashchange', closePresentation)
    return () => {
      window.removeEventListener('teth:navigate', closePresentation)
      window.removeEventListener('popstate', closePresentation)
      window.removeEventListener('hashchange', closePresentation)
    }
  }, [mapSiteHref])
  const accountSurfaceActive = Boolean(surface)
  useEffect(() => {
    if (!accountSurfaceActive) return
    // One active surface owns the lock; retained exiting DOM owns no lock.
    const app = root.current
    const previousInert = app?.inert ?? false
    const bodyStyle = document.body.style
    const previousOverflow = bodyStyle.getPropertyValue('overflow')
    const previousPriority = bodyStyle.getPropertyPriority('overflow')
    if (app) app.inert = true
    bodyStyle.setProperty('overflow', 'hidden')
    return () => {
      if (app) app.inert = previousInert
      if (previousOverflow) bodyStyle.setProperty('overflow', previousOverflow, previousPriority)
      else bodyStyle.removeProperty('overflow')
    }
  }, [accountSurfaceActive])
  useEffect(() => {
    if (!isHome) return
    const timer = window.setTimeout(() => setHomeEntrance(false), 1900)
    return () => window.clearTimeout(timer)
  }, [isHome])
  useLayoutEffect(() => {
    if (state.phase !== 'ready' || state.recovery !== 'RESTORED') return
    // A restored draft is not a newly streamed answer. Start at its recovery
    // context once; subsequent messages retain the original chat auto-follow.
    const scroll = recoveryNotice.current?.closest<HTMLElement>('.g-scroll')
    if (scroll) scroll.scrollTop = 0
  }, [state.phase, state.recovery])
  const recoveryCopy = state.recovery === 'RESTORED'
    ? `${n('recovered')} ${n(state.inputDisabled ? 'recoveredLocked' : 'recoveredDraft')}`
    : n('unrecoverable')
  const historyContent = executionHistory && <section className="native-history-scope" aria-labelledby={historyScopeId}>
    <h2 id={historyScopeId}>{nativeHistoryScopeCopy[language].title}</h2>
    <p>{nativeHistoryScopeCopy[language].body}</p>
    <button type="button" className="g-qchip" aria-disabled={executionHistory.disabled}
      onClick={() => { if (!executionHistory.disabled) executionHistory.onLoad() }}>{nativeHistoryScopeCopy[language].load}</button>
    {executionHistory.pending && <PendingOperation source={state.source} />}
    {historyFeedback}
    {executionHistory.render(() => {
      // A prior selection may finish after another page/tab/visit was opened.
      // Only the originating visit may close; the controller owns acceptance.
      setHistoryView(current => current.open && current.page === historyView.page && current.visit === historyView.visit ? { ...current, open: false, focusSelection: true } : current)
    })}
  </section>
  const libraryUnavailable = (!library || library.status !== 'ready' && !library.records.length) && <div className="hub-empty native-history-unavailable" role="status"><p>{library?.status === 'loading' ? c('waiting') : library?.status === 'error' ? c('retry') : nativeHistoryCopy[language].title}</p><small>{nativeHistoryCopy[language].body}</small></div>
  const libraryFooter = <>
    {libraryPending && <p role="status">{c('waiting')}</p>}
    {(libraryFailed || library?.status === 'error') && <p role="alert">{c('retry')}</p>}
    {library?.onLoad && library.status !== 'ready' && <button type="button" className="g-qchip" disabled={libraryPending || library.pending} onClick={() => void loadLibrary(library.onLoad)}>{c('loadRecords')}</button>}
    {library?.hasMore && library.onLoadMore && <button type="button" className="g-qchip" disabled={libraryPending || library.pending} onClick={() => void loadLibrary(library.onLoadMore)}>{c('moreRecords')}</button>}
  </>
  // Keep confirmation controls outside both document scrolling and the
  // narrow analysis/chat switch. An overlay would cover the artifact drawer;
  // putting them inside research would hide them when the chart is selected.
  const inlineNotice = !isHome && !neutralLoading && !connectionOpen && !historyView.open && !accountPlan && !trading && !insights && !brokers
  const shellNotice = (notice || confirmReset || (isHome && state.recovery && !recoveryDismissed)) ? <div className="client-global-notice" role="status">
    <span>{confirmReset ? n('resetConfirm') : noticeText || recoveryCopy}</span>
    <div className="native-service-notice-actions">
      {confirmReset && <button type="button" disabled={state.busy} onClick={reset}>{n('startStrategy')}</button>}
      <button type="button" aria-label={c('closeNotice')} onClick={() => { setNotice(null); setConfirmReset(false); setRecoveryDismissed(true) }}>{t('common.close')}</button>
    </div>
  </div> : null
  // The guest introduction is a document, not the authenticated trading
  // workspace. Reuse the source document chrome without changing auth gates.
  const guestTradingIntro = trading && state.sessionState !== 'AUTHENTICATED'
  const footerHome = isHome && !historyView.open && !accountPlan && !trading && !insights && !brokers && !strategies
  // History is a bounded workspace even when the underlying conversation is
  // empty. Leave the separate account document layout unchanged by this fix.
  const landingLayout = isHome && !settingsTab && !historyView.open && !trading && !insights && !brokers
  const guestConversationVisible = state.sessionState === 'ANONYMOUS' && !isHome && !neutralLoading && !settingsTab && !connectionOpen && !connectionStatus && !historyView.open && !accountPlan && !trading && !insights && !brokers && !strategies && !researchWorkspaceOpen && !strategyDocument
  const guestInsightVisible = state.sessionState === 'ANONYMOUS' && insights && !settingsTab && !connectionOpen && !connectionStatus
  const guestBrokerDocumentVisible = nativeAccounts && state.sessionState === 'ANONYMOUS' && !settingsTab && !connectionOpen && !connectionStatus && (brokers || accountPlan)
  useLayoutEffect(() => {
    const shell = root.current
    if (!shell || !guestConversationVisible) return
    const nav = shell.querySelector<HTMLElement>('.client-auth-nav')
    const header = shell.querySelector<HTMLElement>('.client-lab-conversation .g-chead')
    if (!nav || !header) return
    let disposed = false, frame = 0
    const clear = () => {
      for (const key of ['space', 'offset', 'tail']) shell.style.removeProperty(`--client-conversation-auth-${key}`)
    }
    const measure = () => {
      if (disposed || !shell.isConnected || !nav.isConnected || !header.isConnected) return
      if (!matchMedia('(min-width:861px)').matches || !nav.getClientRects().length) { clear(); return }
      const authRect = nav.getBoundingClientRect(), headerRect = header.getBoundingClientRect(), css = getComputedStyle(header)
      const scale = header.offsetWidth > 0 ? headerRect.width / header.offsetWidth : 1
      const space = Math.max(18, (headerRect.right - authRect.left) / scale + 8)
      const children = Array.from(header.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.getClientRects().length > 0)
      const minimum = children.reduce((sum, node) => {
        const style = getComputedStyle(node), left = node.matches('.client-session-options,.g-demo') ? 0 : parseFloat(style.marginLeft) || 0
        return sum + (node.matches('h1,.g-title-input') ? 96 : node.offsetWidth) + left + (parseFloat(style.marginRight) || 0)
      }, 0) + Math.max(0, children.length - 1) * (parseFloat(css.columnGap) || 0)
      const stacked = header.clientWidth - (parseFloat(css.paddingLeft) || 0) - space < minimum
      const baseTop = headerRect.top - (parseFloat(css.marginTop) || 0) * scale
      shell.style.setProperty('--client-conversation-auth-space', `${stacked ? 18 : space}px`)
      shell.style.setProperty('--client-conversation-auth-offset', `${stacked ? Math.max(0, (authRect.bottom - baseTop) / scale + 8) : 0}px`)
      shell.style.setProperty('--client-conversation-auth-tail', `${stacked ? 0 : Math.max(0, (authRect.bottom - headerRect.bottom) / scale)}px`)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    measure()
    const observer = new ResizeObserver(schedule); observer.observe(nav); observer.observe(header)
    window.addEventListener('resize', schedule); void document.fonts.ready.then(measure); document.fonts.addEventListener('loadingdone', schedule)
    return () => {
      disposed = true; observer.disconnect(); cancelAnimationFrame(frame); clear()
      window.removeEventListener('resize', schedule); document.fonts.removeEventListener('loadingdone', schedule)
    }
  }, [guestConversationVisible, language])
  useLayoutEffect(() => {
    // Source gContent starts a newly selected document at its heading. Only
    // the document shell moves: retained chat/chart scroll and background
    // responses are untouched, as are locale/data updates on the same page.
    root.current?.scrollTo({ top: 0, behavior: 'instant' })
  }, [accountPlan, insights, brokers, trading, strategies])
  useLayoutEffect(() => {
    if (!resetHomeFocus.current) return
    resetHomeFocus.current = false
    const restoreHomeTop = resetHomeAtTop.current
    resetHomeAtTop.current = false
    const target = input.current
    if (!footerHome || settingsTab || connectionOpen || trading || surface || !target || target.disabled || !target.getClientRects().length) return
    target.focus({ preventScroll: true })
    // Returning from the long introduction is a new home arrival. Centering
    // its composer would scroll the shared document past the home headline.
    if (restoreHomeTop) root.current?.scrollTo({ top: 0, behavior: 'instant' })
    else target.scrollIntoView({ block: 'center', behavior: 'instant' })
  })
  const hasSiteFooter = nativeAccounts && !settingsTab && !connectionOpen && (!trading || guestTradingIntro) && (footerHome || accountPlan || insights || brokers || strategies || guestTradingIntro)
  const lastQuestionMessage = state.messages.at(-1)
  const questionBelongsHere = lastQuestionMessage?.role === 'assistant' && (!lastQuestionMessage.researchThread
    ? !researchWorkspaceOpen : researchWorkspaceOpen && lastQuestionMessage.researchThread.scopeId === researchData?.scopeId && lastQuestionMessage.researchThread.documentId === currentResearchId)
  const activeQuestion = questionBelongsHere ? [...assistantBlocks(lastQuestionMessage)].reverse().find(block => block.kind === 'market-question') : undefined
  const clarificationKey = clarification ? JSON.stringify(['clarification', accountScope, state.sessionState, clarification.identity]) : null
  // GET restoration can supply nextQuestion without an assistant message, and
  // a failed TURN may leave a user message last. The server question remains
  // authoritative in both cases; message role must not suppress its panel.
  const clarificationBelongsHere = lastQuestionMessage?.researchThread && researchData
    ? researchWorkspaceOpen && lastQuestionMessage.researchThread.scopeId === researchData.scopeId && lastQuestionMessage.researchThread.documentId === currentResearchId
    : !researchWorkspaceOpen
  const activeQuestionKey = clarificationKey ? clarificationBelongsHere ? clarificationKey : null : activeQuestion?.kind === 'market-question' && !activeQuestion.presentation.state?.closed && !activeQuestion.presentation.state?.accepted ? marketBindingKey(activeQuestion.presentation.binding) : null
  return <ClientQuestionDockProvider activeKey={activeQuestionKey}><div ref={root} className={`tesia-shell conversation-surface client-source-app client-service-app ${landingLayout ? 'view-landing' : 'view-briefing'}${guestConversationVisible ? ' has-public-conversation' : ''}${guestInsightVisible ? ' has-guest-insight-entry' : ''}${guestBrokerDocumentVisible ? ' has-guest-broker-document' : ''}${guestTradingIntro && !settingsTab && !connectionOpen ? ' has-trading-intro' : ''}${settingsTab ? ' has-settings' : ''}${hasSiteFooter ? ' has-site-footer' : ''}`} style={{ '--client-band-height': `${bandHeight}px` } as CSSProperties} data-service-phase={state.phase}
    onKeyDownCapture={() => { resetPresentationIntent.current++; if (researchHistory) historyFocusIntent.current = false; if (insights) insightFocusIntent.current = false; if (brokers) brokerFocusIntent.current = false; if (strategies) strategiesFocusIntent.current = false }}
    onPointerDownCapture={() => { resetPresentationIntent.current++; if (researchHistory) historyFocusIntent.current = false; if (insights) insightFocusIntent.current = false; if (brokers) brokerFocusIntent.current = false; if (strategies) strategiesFocusIntent.current = false }}
    onClickCapture={event => {
      // Assistive activation may emit click without pointerdown or keydown.
      resetPresentationIntent.current++
      if (researchHistory) historyFocusIntent.current = false
      if (insights) insightFocusIntent.current = false; if (brokers) brokerFocusIntent.current = false
      if (strategies) strategiesFocusIntent.current = false
      const link = (event.target as Element).closest('a[href]')
      const href = link?.getAttribute('href')
      if (href?.startsWith('/')) {
        const target = new URL(href, window.location.origin)
        if (target.origin === window.location.origin && target.pathname === window.location.pathname && target.search === window.location.search && (readClientInsightLocation(target.hash) || readSharedLocation(target.hash) || isClientAccountEntry(target.hash))) return
        if (mapSiteHref && (href === '/' || getServiceSiteLocation(href))) return
        event.preventDefault(); event.stopPropagation(); setSurface(null)
        setNotice({ key: mapSiteHref ? 'unavailableLink' : 'publicLink' })
      }
    }}>
    <a className="skip-link" href="#tesia-main" onClick={event => { event.preventDefault(); document.getElementById('tesia-main')?.focus() }}>{c('skipContent')}</a>
    <div className="client-footer-body">
    <ClientChrome showLocaleShortcut={!settingsTab && !connectionOpen && (guestConversationVisible || guestInsightVisible || guestBrokerDocumentVisible || guestTradingIntro || isHome && !historyView.open && !accountPlan && !trading && !insights && !brokers || hasSiteFooter && !connectionStatus && strategies && !sharingLocation.section && !sharingLocation.view)} researchPage={historyView.open ? historyView.page : insights ? 'insight' : brokers ? 'brokers' : null} tradingActive={trading} signedIn={state.sessionState === 'AUTHENTICATED'} onHome={() => { closeClientSettingsRoute(); if (connectionOpen) closeConnection(); newConversation() }}
      profileName={accountData?.profile?.name}
      recordsScope={accountScope ?? ''} records={library?.records ?? []} activeResearchId={library?.activeId}
      recordsPresentation={{ unavailable: libraryUnavailable ? <p className="client-sidebar-record-empty" role="status">{library?.status === 'loading' ? c('waiting') : library?.status === 'error' ? c('retry') : nativeHistoryCopy[language].title}</p> : undefined, footer: libraryFooter, archiveLabel: c('archive'), archiveDetail: c('archiveDetail'), errorLabel: c('retry') }}
      onSelectResearch={id => { closeClientSettingsRoute(); return selectConversation(id) }} onPinResearch={library?.onPin} onRenameResearch={library?.onRename ? renameConversation : undefined} onDeleteResearch={library?.onArchive}
      onLogin={() => login('login')} onSignup={() => login('signup')} onProfile={nativeAccounts ? anchor => openAccountSurface('settings', anchor) : unavailable}
      onSettings={anchor => openAccountSurface(nativeAccounts ? 'settings' : 'locale', anchor)} onLocale={anchor => openAccountSurface('locale', anchor)}
      onTrading={() => {
        if (!nativeAccounts) { setNotice({ key: 'featureUnavailable', feature: 'trading' }); return }
        setNotice(null); setHomeEntrance(false); setResearchHistory(false); setAccountPlan(false); setInsights(false); setBrokers(false); setTrading(true)
        pushSiteLocation(`${window.location.pathname}${window.location.search}#/trade`)
      }}
      onDashboard={() => { closeClientSettingsRoute(); history() }} onResearchPage={page => {
        closeClientSettingsRoute()
        if (connectionOpen) closeConnection()
        if (page === 'history') { history(); return }
        if (page === 'sharing' && nativeAccounts) {
          strategiesFocusIntent.current = !strategies
          setSurface(null); setNotice(null); setConfirmReset(false); setHomeEntrance(false)
          setAccountPlan(false); setTrading(false); setInsights(false); setBrokers(false)
          setHistoryView(current => current.open && current.page === 'sharing' ? current
            : { open: true, page: 'sharing', visit: current.visit + 1, focusSelection: false })
          navigateSharing({ period: 'all' })
          return
        }
        if (page === 'brokers' && nativeAccounts) {
          browseExchanges()
          return
        }
        if (page === 'insight' && nativeAccounts) {
          // A later keyboard/pointer action abandons this focus intent even
          // when the lazy screen has not loaded yet. Never steal it back.
          insightFocusIntent.current = !insights
          setSurface(null); setNotice(null); setConfirmReset(false); setHomeEntrance(false)
          setResearchHistory(false); setAccountPlan(false); setTrading(false); setBrokers(false); setInsights(true)
          navigateInsight({})
          return
        }
        setNotice({ key: 'featureUnavailable', feature: page })
      }} />
    {nativeAccounts && state.sessionState === 'AUTHENTICATED' && !trading && <div className="client-account-utility"><ClientAccountBell unread={unread} ariaLabel={alertsLabel} onOpen={() => {
      setSurface(null); setNotice(null); setResearchHistory(false); setAccountPlan(false); setInsights(false); setBrokers(false); setHomeEntrance(false)
      setAlertsRequest(value => value + 1); setTrading(true)
      pushSiteLocation(`${window.location.pathname}${window.location.search}#/trade`)
    }} /></div>}
    <main id="tesia-main" className="client-source-main" tabIndex={-1}>
      {connectionStatus && <ClientConnectionStatus {...connectionStatus} scope={state.sessionState === 'AUTHENTICATED' ? accountScope ?? null : null} source="service" />}
      {settingsTab && !connectionOpen && !connectionStatus && <ClientSettingsPage key={JSON.stringify([accountScope, accountData?.identity])} tab={settingsTab} usage={usageActions} accountConnections={settingsAccountConnections} accountConnectionOperation={settingsConnectionOperation} profile={accountData?.profile} onBack={() => closeClientSettingsRoute(true)} onNewStrategy={() => { closeClientSettingsRoute(true); newConversation() }} onCopyStrategy={() => navigateSharing({ period: 'all' })} onBrokers={browseExchanges} onHelp={trigger => { surfaceReturnFocus.current = trigger; setSurface('help') }} onLogout={logoutFromProfile} logoutDisabled={logoutDisabled}
        identityActions={{ name: accountData?.actions?.onProfileName, handle: accountData?.actions?.onProfileHandle }}
        onEmailChange={accountData?.actions?.onEmailChange}
        security={accountData?.security} securityActions={accountData?.actions?.security} securityScopeId={JSON.stringify([accountScope, accountData?.identity])}
        billing={accountData?.billing} billingActions={accountData?.actions?.billing}
        details={accountData?.plan ? {
          billing: <NativeSettingsPlan key={JSON.stringify([accountScope, accountData.identity, 'billing'])} data={accountData} tab="billing" onNavigate={navigateAccount} onTrading={() => pushSiteLocation(`${window.location.pathname}${window.location.search}#/trade`)} />,
          notify: <NativeSettingsPlan key={JSON.stringify([accountScope, accountData.identity, 'notify'])} data={accountData} tab="notify" onNavigate={navigateAccount} />,
        } : undefined} />}
      {connectionOpen && !connectionStatus && <ClientLoadBoundary fallback={<ClientLoadFallback inline onClose={closeConnection} />}><Suspense fallback={<ClientLoadFallback inline loading onClose={closeConnection} />}>
        {connectionData && connectionBrowse?.mode !== 'continuation'
          ? <NativeConnectionOnboarding accountScope={accountScope} presentation={connectionData} onReturn={closeConnection} onHelp={trigger => { surfaceReturnFocus.current = trigger; setSurface('help') }} />
          : <ClientConnectionPlan view={connectionPlan} signedIn={state.sessionState === 'AUTHENTICATED'} onNavigate={setConnectionPlan}
              onSignup={next => { setConnectionPlan(next); login('signup', accountScope && state.sessionState === 'ANONYMOUS'
                ? { issuer: 'client-connection-plan', operation: 'signup', requestId: crypto.randomUUID(), sourceSessionId: accountScope, plan: next } : undefined) }} onAuthorize={connectionPlanAuthorize} onClose={closeConnection}
              onHelp={trigger => { surfaceReturnFocus.current = trigger; setSurface('help') }} />}
      </Suspense></ClientLoadBoundary>}
      <div className="native-service-route-content" hidden={connectionOpen || Boolean(settingsTab || connectionStatus)} inert={Boolean(settingsTab || connectionStatus)} style={{ display: connectionOpen || settingsTab || connectionStatus ? 'none' : 'contents' }}>
      {strategies && <ClientLoadBoundary fallback={<ClientLoadFallback inline onClose={() => setResearchHistory(false)} />}><Suspense fallback={<ClientLoadFallback inline loading onClose={() => setResearchHistory(false)} />}>
        <NativeStrategies onReturn={closeSharing} location={sharingLocation} onNavigate={navigateSharing} shouldFocus={shouldFocusStrategies} executionContent={historyContent}
          owner={accountScope} presentation={sharingData} brokerPresentation={brokerData} signedIn={state.sessionState === 'AUTHENTICATED'} onLogin={intent => login(intent === 'signup' ? 'signup' : 'login')} onAsk={prepareQuestion}
          datasetIdentity={sharingDataset} viewState={sharingView} onViewStateChange={next => {
            if (sharingData && ownerRef.current === accountScope && next.owner === accountScope && next.datasetIdentity === sharingDataset) setSharingView(next)
          }}
          onTabChange={() => setHistoryView(current => ({ ...current, visit: current.visit + 1, focusSelection: false }))}
          notice={<>{state.issue && <div className="client-service-issue">{state.issue}</div>}{navigationFeedback}{!executionHistory && historyFeedback}</>} />
      </Suspense></ClientLoadBoundary>}
      {brokers && <ClientLoadBoundary fallback={<ClientLoadFallback inline onClose={() => setBrokers(false)} />}><Suspense fallback={<ClientLoadFallback inline loading onClose={() => setBrokers(false)} />}>
        <NativeBrokers accountScope={accountScope} presentation={brokerData} signedIn={state.sessionState === 'AUTHENTICATED'} onLogin={intent => login(intent === 'signup' ? 'signup' : 'login')} onReturn={() => setBrokers(false)} shouldFocus={shouldFocusBrokers} listRequest={brokerListRequest} viewState={brokerView} onViewStateChange={updateBrokerView} />
      </Suspense></ClientLoadBoundary>}
      {insights && <ClientLoadBoundary fallback={<ClientLoadFallback inline onClose={() => setInsights(false)} />}><Suspense fallback={<ClientLoadFallback inline loading onClose={() => setInsights(false)} />}>
        <NativeInsights key={accountScope} onReturn={closeInsights} shouldFocus={shouldFocusInsights} data={insightData?.data} onFeedback={insightData?.onFeedback} controlledLocation={insightLocation} onNavigate={navigateInsight} locationHref={insightHref} onAsk={prepareQuestion} signedIn={state.sessionState === 'AUTHENTICATED'} onLogin={intent => login(intent === 'signup' ? 'signup' : 'login')} />
      </Suspense></ClientLoadBoundary>}
      {trading && <ClientLoadBoundary fallback={<ClientLoadFallback inline onClose={() => setTrading(false)} />}><Suspense fallback={<ClientLoadFallback inline loading onClose={() => setTrading(false)} />}>
        {state.sessionState !== 'AUTHENTICATED' ? <ClientTradingIntro onStart={() => login('signup')} /> : <NativeTradingWorkspace accountScope={accountScope} presentation={accountData} alertsRequest={alertsRequest} onBrowseExchanges={browseExchanges}
          alertsView={alertsView ?? undefined} onAlertsViewChange={next => {
            if (accountData && ownerRef.current === accountData.scope && next.scope === accountData.scope && next.identity === accountData.identity) setAlertsView(next)
          }} onNavigate={navigateAccount} onReturn={closeAccount} onNew={() => { closeAccount(); newConversation() }} />}
      </Suspense></ClientLoadBoundary>}
      {accountPlan && <ClientLoadBoundary fallback={<ClientLoadFallback inline onClose={() => setAccountPlan(false)} />}><Suspense fallback={<ClientLoadFallback inline loading onClose={() => setAccountPlan(false)} />}>
        <NativeAccountPlan accountScope={accountScope} presentation={accountData} location={accountLocation} onNavigate={navigateAccount} onTrading={() => pushSiteLocation(`${window.location.pathname}${window.location.search}#/trade`)} onReturn={closeAccount} />
      </Suspense></ClientLoadBoundary>}
      {researchHistory && <ClientLoadBoundary fallback={<ClientLoadFallback inline onClose={() => setResearchHistory(false)} />}><Suspense fallback={<ClientLoadFallback inline loading onClose={() => setResearchHistory(false)} />}>
        <ClientResearchHistory key={accountScope} records={library?.records ?? []} externalBoundary shouldFocus={shouldFocusHistory} onSelect={selectConversation} pending={libraryPending || library?.pending || state.busy} onNew={newConversation} onReturn={() => setResearchHistory(false)}
          footer={<>{libraryFooter}{historyContent && <details className="native-history-details"><summary>{nativeHistoryCopy[language].title}</summary>{historyContent}</details>}</>}
          notice={<>{state.issue && <div className="client-service-issue">{state.issue}</div>}{navigationFeedback}{!executionHistory && historyFeedback}{state.recovery && <p className="client-service-recovery" role="status">{recoveryCopy}</p>}</>}
          unavailable={libraryUnavailable} />
      </Suspense></ClientLoadBoundary>}
      <div ref={content} className="native-service-content" data-has-action-notice={Boolean(inlineNotice && shellNotice)} hidden={historyView.open || accountPlan || trading || insights || brokers}>
      {inlineNotice && shellNotice && <div className="native-service-action-notice">{shellNotice}</div>}
      {neutralLoading ? <div className="client-session-restoring"><SessionLoading /></div> : isHome ? <div className="landing-main"><section className="landing-hero" aria-labelledby="landing-title">
        {!nativeAccounts && state.onLogout && <button className="client-service-logout" type="button" disabled={state.busy} onClick={() => void state.onLogout?.()}>{shellText(language, 'logout')}</button>}
        <ConversationCosmos />
        <ClientHomeSurface value={state.input} inputRef={input} onChange={editInput} onSend={() => send()}
          onLogin={() => login('login')} onSignup={() => login('signup')} signedIn={state.sessionState === 'AUTHENTICATED'}
          selection={templates} onSelectionChange={setTemplates} disabled={!available} maxLength={1000}
          composerNotice={<>{state.phase === 'loading' ? <SessionLoading /> : state.issue && <div className="client-service-issue client-home-input-issue">{state.issue}
            {recover && <button type="button" className="g-qchip" disabled={state.busy} onClick={recover}>{n('checkSession')}</button>}
          </div>}{!state.issue && sessionRecoveryNeeded && recover && <button type="button" className="g-qchip" onClick={recover}>{n('checkSession')}</button>}</>}
          animate={homeEntrance} onBandHeight={setBandHeight}>
          {!historyView.open && conversationNavigation}
        </ClientHomeSurface>
      </section></div> : <NativeAnalysisLayout key={documentMountKey} analysis={analysis} composerRequest={composerRequest}
        presentationActive={state.phase === 'ready' && !connectionOpen && !historyView.open && !accountPlan && !trading && !insights && !brokers && !strategies && !surface && !confirmReset && !analysisPresentationBlocked}><div hidden={Boolean(researchData && researchWorkspaceOpen)} style={{ height: '100%', minHeight: 0 }}><ClientConversation value={state.input} onChange={editInput} onSend={() => send()} composerRequest={composerRequest}
        composerTarget={researchData && researchWorkspaceOpen ? researchComposerHost : undefined}
        composerPlaceholder={questionPlaceholder}
        composerNotice={<ClientUsageBanner presentation={serviceUsage?.presentation} scope={accountScope} onNext={usageActions.onNext} />}
        composerContext={researchData && researchWorkspaceOpen ? nativeResearchText(language, 'composerContext', { label: clientResearchLabel(currentResearchTitle, language) }) : undefined}
        // A failed pre-dispatch journal write must not animate a recovery shell.
        arrivalRect={hasConversation ? arrivalRect : undefined}
        conversationNotice={researchData && researchWorkspaceOpen ? undefined : conversationNotice}
        artifact={researchData && strategyDocument ? <></> : strategyDocument?.content} artifactLabel={strategyDocument ? n('strategyDraft') : undefined}
        onOpenArtifact={researchData ? () => openResearch('plan') : undefined}
        onOpenReport={researchData ? () => openResearch('report') : undefined}
        artifactOpenLabel={strategyDocument ? n('openStrategyDraft') : undefined} showResearchTeam={!strategyDocument}
        reportArtifact={analysis ? { identity: analysisIdentity ?? 'current-result', label: nativeResultText(language, 'resultTitle'), openLabel: nativeResultText(language, 'resultTitle'), content: researchData ? null : <NativeAnalysisReportSlot /> } : undefined}
        notice={!researchHistory && strategyDocument && state.issue ? <div className="client-service-issue">{state.issue}</div> : undefined}
        onStop={state.onStop ?? (() => undefined)} canStop={state.canStop ?? false} busy={state.busy && state.phase !== 'loading'} inputDisabled={!available} maxLength={1000}
        inputLabel={c('askTeth')} sendLabel={c('send')} titleLabel={c('title')} initialTitle={visibleTitle}
        titleEditor={activeRecord && <NativeConversationTitle key={JSON.stringify([accountScope, activeRecord.id])} title={visibleTitle}
          onSave={library?.onRename ? value => renameConversation(activeRecord.id, value) : undefined} />}
        onTitleChange={value => setTitle({ value, scope: strategyDocument?.identity ?? documentIdentity })} onTitleReset={() => setTitle(null)}
        activityKey={`${state.phase}:${state.messages.length}:${state.busy}:${Boolean(state.workflow)}:${resultActivityKey ?? ''}`} previewTools={<></>}
        headerActions={<>{researchData && <button type="button" className="g-qchip" data-native-open-research onClick={() => setResearchWorkspaceOpen(true)}>{c('conversationDocuments')}</button>}{!nativeAccounts && state.onLogout && <button className="client-service-logout" type="button" disabled={state.busy} onClick={() => void state.onLogout?.()}>{shellText(language, 'logout')}</button>}</>}>
        {!historyView.open && conversationNavigation}
        {state.recovery && <p ref={recoveryNotice} className="client-service-recovery" role="status">{recoveryCopy}</p>}
        {state.phase === 'loading' ? <SessionLoading /> : state.phase === 'logged-out' ? <div className="g-amsg"><h2>{n('loggedOut')}</h2><p>{n('loggedOutDetail')}</p></div> : <>
          {state.messages.filter(message => message.id !== 'welcome' && (!message.researchThread || !researchData)).map(message => message.role === 'user'
            ? <Fragment key={message.id}><ClientUserMessage editDisabled={!available} onEdit={text => { if (!available) return; editInput(text); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus()) }}>{message.displayText ?? message.text}</ClientUserMessage>
              {message.delivery === 'uncertain' && <p className="client-service-delivery" data-delivery="uncertain">{n('uncertainDelivery')}</p>}</Fragment>
            // NativeAnalysisLayout's documentMountKey already isolates replaced
            // documents. First binding is not a new conversation lifetime.
          : <ServiceAssistantAnswer key={JSON.stringify([accountScope, state.sessionState, message.id])} source={state.source} blocks={assistantBlocks(message)} contentIdentity={message.observation?.id} questionActions={questionActions(message)} chartActions={chartActions(message)} followupActions={followups(message)} continuation={continuation(message)} />)}
          {state.busy && <PendingOperation source={state.source} />}
          {!state.busy && clarification && clarificationKey && (!lastQuestionMessage?.researchThread || !researchData) ? <ClientClarificationCard key={clarificationKey} dockKey={clarificationKey} question={{ title: clarification.prompt, options: state.quickReplies.map(value => ({ value, label: value })) }} disabled={!available}
            composer={{ value: state.input, onChange: editInput, onSubmit: () => send() }} onAnswer={value => send(value, 'quick-reply')} />
            : clarification === undefined && !state.busy && state.quickReplies.length > 0 && <div className="g-chiprow" aria-label={n('quickReplies')}>
            {state.quickReplies.map(reply => <button className="g-qchip" type="button" key={reply} disabled={!available} onClick={() => send(reply, 'quick-reply')}>{reply}</button>)}
          </div>}
          <NativePersistentRegion target={researchData && researchWorkspaceOpen ? researchWorkflowHost : null}>{state.workflow && <div className="client-service-document" aria-label={n('strategyReview')}>{state.workflow}</div>}</NativePersistentRegion>
          {!historyView.open && historyFeedback}
          {!historyView.open && executionHistory?.render()}
          <NativePersistentRegion target={researchData && researchWorkspaceOpen ? researchOutcomeHost : null}><div className="client-service-outcome">{state.outcome}</div></NativePersistentRegion>
          <NativeAnalysisSummarySlot />
        </>}
        {!researchHistory && !strategyDocument && !(researchData && researchWorkspaceOpen) && <div className="client-service-issue">{state.issue}</div>}
        {recover && (state.issue || state.phase === 'logged-out' || sessionRecoveryNeeded) && <button type="button" className="g-qchip" onClick={recover}>{n(state.phase === 'logged-out' ? 'newSession' : 'checkSession')}</button>}
      </ClientConversation></div>{researchData && <div hidden={!researchWorkspaceOpen} style={{ height: '100%', minHeight: 0 }}><NativeResearchWorkspace {...researchData} visible={researchWorkspaceOpen} view={researchView} onViewChange={changeResearchView} composerHasContext
        threadActivity={state.messages.at(-1)?.researchThread?.scopeId === researchData.scopeId ? {
          documentId: state.messages.at(-1)!.researchThread!.documentId, messageId: state.messages.at(-1)!.id,
          userSubmitted: state.messages.at(-1)!.role === 'user',
        } : undefined}
        threadEntriesForDocument={id => {
          const messages = state.messages.filter(message => message.researchThread?.scopeId === researchData.scopeId && message.researchThread.documentId === id)
          const latest = state.messages.at(-1)
          const ownsLatest = latest?.researchThread?.scopeId === researchData.scopeId && latest.researchThread.documentId === id
          return messages.map(message => ({ id: message.id, content: <>{message.role === 'user'
            ? <Fragment key={message.id}><ClientUserMessage editDisabled={!available} onEdit={value => {
              if (!available) return
              editInput(value); requestAnimationFrame(() => root.current?.querySelector<HTMLTextAreaElement>('.g-composer textarea')?.focus())
            }}>{message.displayText ?? message.text}</ClientUserMessage>{message.delivery === 'uncertain' && <p className="client-service-delivery" data-delivery="uncertain">{n('uncertainDelivery')}</p>}</Fragment>
            : <ServiceAssistantAnswer key={JSON.stringify([accountScope, state.sessionState, message.id])} source={state.source} blocks={assistantBlocks(message)} contentIdentity={message.observation?.id} questionActions={questionActions(message)} chartActions={chartActions(message)} followupActions={followups(message)} continuation={continuation(message)} />}
            {message.id === latest?.id && state.busy && ownsLatest && latest.role === 'user' && latest.delivery === 'pending' && <div data-native-thread-pending><PendingOperation source={state.source} /></div>}
            {message.id === latest?.id && !state.busy && ownsLatest && clarification && clarificationKey && <ClientClarificationCard key={clarificationKey} dockKey={clarificationKey}
              question={{ title: clarification.prompt, options: state.quickReplies.map(value => ({ value, label: value })) }} disabled={!available}
              composer={{ value: state.input, onChange: editInput, onSubmit: () => send() }} onAnswer={value => send(value, 'quick-reply')} />}
          </> }))
        }}
        notice={<>{researchWorkspaceOpen && conversationNotice ? <div className="client-service-result-notice" role="status">{conversationNotice}</div> : null}{researchWorkspaceOpen && state.issue ? <div className="client-service-issue">{state.issue}</div> : null}<div ref={setResearchOutcomeHost} /></>}
        documents={analysis ? [...(researchData.documents ?? []).filter(item => item.id !== 'report'), { id: 'report', title: nativeResultText(language, 'resultTitle'), content: <NativeAnalysisReportSlot /> }] : researchData.documents}
        titleEditor={activeRecord && <NativeConversationTitle key={JSON.stringify([accountScope, activeRecord.id])} title={visibleTitle} onSave={library?.onRename ? value => renameConversation(activeRecord.id, value) : undefined} />} title={visibleTitle} strategyDocument={strategyDocument?.renderResearch ? strategyDocument.renderResearch(<div ref={setResearchWorkflowHost} />) : <>{strategyDocument?.content}<div ref={setResearchWorkflowHost} /></>} composer={<div ref={setResearchComposerHost} className="client-lab-conversation native-research-composer-host" />} onBack={() => {
        setResearchWorkspaceOpen(false)
        requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('[data-native-open-research]')?.focus({ preventScroll: true }))
      }} /></div>}</NativeAnalysisLayout>}
      </div>
      </div>
    </main>
    </div>
    {hasSiteFooter && <ClientSiteFooter lime={footerHome} onHelp={trigger => { surfaceReturnFocus.current = trigger; setSurface('help') }} onNavigate={action => {
      if (action === 'new') { newConversation(); return }
      if (action === 'brokers') { browseExchanges(); return }
      if (action === 'insights') { insightFocusIntent.current = !insights; navigateInsight({}); return }
      if (action === 'strategies') { strategiesFocusIntent.current = !strategies; navigateSharing({ period: 'all' }); return }
      if (action === 'trade') { pushSiteLocation(`${window.location.pathname}${window.location.search}#/trade`); return }
      if (state.sessionState !== 'AUTHENTICATED') { login(); return }
      pushSiteLocation(`${window.location.pathname}${window.location.search}${action === 'usage' ? '#/plan' : '#/trade'}`)
    }} />}
    {nativeAccounts && !settingsTab && !connectionOpen && !surface && (isHome || historyView.open || accountPlan || trading || insights || brokers) && <ClientLoadBoundary fallback={null}><Suspense fallback={null}><ClientHelp /></Suspense></ClientLoadBoundary>}
    {!inlineNotice && shellNotice && <div className="client-notice-stack">{shellNotice}</div>}
    {authSurface}
    <ClientLocalePanel open={surface === 'locale'} returnFocus={surfaceReturnFocus} manageBackground={false} onClose={() => setSurface(null)} />
    {nativeAccounts && createPortal(<div className="client-source-overlays">
      <ClientSettingsMenu key={`${accountScope ?? 'anonymous'}:${state.sessionState}`} open={surface === 'settings'} anchorTop={settingsAnchor} returnFocus={surfaceReturnFocus} signedIn={state.sessionState === 'AUTHENTICATED'}
        onClose={() => setSurface(null)} onSettings={() => { setSurface(null); openClientSettings() }}
        onInsight={() => { setSurface(null); insightFocusIntent.current = !insights; navigateInsight({}) }} onBrokers={browseExchanges}
        onLogout={logoutFromProfile} logoutDisabled={logoutDisabled}
        onPlan={() => {
          setSurface(null)
          if (state.sessionState !== 'AUTHENTICATED') { login(); return }
          setNotice(null); setConfirmReset(false); setResearchHistory(false); setTrading(false); setInsights(false); setBrokers(false); setHomeEntrance(false); setAccountPlan(true)
          navigateAccount({ kind: 'plan', tab: 'plan' })
        }}
        onFeedback={() => { setNotice(null); setSurface('feedback') }} onHelp={() => setSurface('help')}
        onDownload={() => {
          if (!mapSiteHref) { unavailableMenu('download'); return }
          setSurface(null)
          pushSiteLocation(mapSiteHref('/download/'))
        }} />
      {surface === 'profile' && state.sessionState === 'AUTHENTICATED' && <ClientProfileMenu
        profile={accountData?.profile ? { name: accountData.profile.name, email: accountData.profile.email ?? '' } : undefined}
        returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} onLogout={logoutFromProfile} logoutDisabled={logoutDisabled} />}
      <ClientFeedbackDialog key={`feedback:${helpIdentity}`} open={surface === 'feedback'} returnFocus={surfaceReturnFocus} submission="unavailable" submissionScope={feedbackData?.scope} onSubmit={feedbackData?.onSubmit} onClose={() => setSurface(null)} />
      {helpOwner === helpIdentity && <ClientLoadBoundary key={`help:${helpIdentity}`} fallback={surface === 'help' ? <ClientLoadFallback returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} /> : null}><Suspense fallback={surface === 'help' ? <ClientLoadFallback loading returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} /> : null}><ClientHelp initialOpen open={surface === 'help'} returnFocus={surfaceReturnFocus} onClose={() => setSurface(null)} /></Suspense></ClientLoadBoundary>}
    </div>, document.body)}
  </div></ClientQuestionDockProvider>
}
