import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import { closeClientSettingsRoute } from '../use-client-settings-route'
import { nativeJobText, type NativeJobTextKey } from './native-job-copy'
import { nativeWorkflowText, nativeWorkflowLeverage, type NativeWorkflowTextKey } from './native-workflow-copy'
import { ClientServiceExperience, type ClientServiceMessage } from './ClientServiceExperience'
import { captureTurnObservation, captureValidationObservation } from './native-research-observations'
import { observedResearchEntries } from './native-research-projection'
import { nativeObservationCopy, nativeObservationNavigationErrors, type ObservationNavigationError } from './native-observation-copy'
import type { InternalPocPresentation } from './InternalPocApp'
import { NativeServiceResult, type NativeServiceResultStatus } from './NativeServiceResult'
import { NativeStrategyDocument } from './NativeStrategyDocument'
import { rowEditScope, useNativeRowEdits } from './native-row-edits'
import { NativeJobActivity } from './NativeJobActivity'
import { startNativeJobPolling } from './native-job-polling'
import { NativeHistoryList } from './NativeHistoryList'
import { describeNativeJob } from './native-job-presentation'
import { NativeServiceTransport, createNativeServiceApi, type NativeJob } from './native-service-api'
import { SameOriginApiTransport, readApiAdapterConfig } from './api-adapter'
import { createBrowserSessionBootstrap } from './browser-session'
import { ApiResponseError, TesiaApiClient, createSdk } from './contracts/generated/api-v0.1/index'
import { TesiaConversationV03Client } from './contracts/generated/api-v0.3/client'
import { createServiceConversationV03Port } from './contracts/generated/api-v0.3/sdk'
import { createServiceV03HttpTransport } from './service-v03-http-adapter'
import type { ConversationSnapshot, DraftValidationReceipt, ApprovalChallenge, StrategyApproval } from './contracts/generated/api-v0.3/types'
import type { Operations as HistoryOperations } from './contracts/generated/api-v0.8/types'
import { ApiV07Error } from './contracts/generated/api-v0.7/client'
import { NATIVE_JOURNAL_KEY, NATIVE_LOGOUT_KEY, clearNativeJournal, readNativeJournal, writeNativeJournal, readNativeLogout, writeNativeLogout, detachNativeJournalAfterLogout, type NativeLogoutCommand, type NativeMutationCommand } from './native-mutation-journal'
import { forgetNativeEmailLocator, hasStoredNativeEmailIntent, type NativeEmailAuthenticated } from './native-email-auth'
import { NativeLoginPanel } from './NativeLoginPanel'
import { NativePaperPanel } from './NativePaperPanel'
import { NativeStructuralSmokePanel } from './NativeStructuralSmokePanel'
import type { StructuralSmokeBinding } from './native-structural-smoke'
import type { NativePaperStorageScope } from './local-paper-api-adapter'
import type { NativeAuthenticated, NativeSessionRecovery } from './native-browser-auth'
import { changeConversationLocators, readPreviousConversation, type PreviousConversation } from './native-previous-conversation'
import './native-strategy-workflow.css'
import { NativeAuthSurface } from './NativeAuthSurface'
import { RESEARCH_DOCUMENT_SURFACES, type NativeResearchThreadOrigin } from './native-research-workspace-model'
import { createNativeResultPresentationIntent, type NativeResultPresentationRequest } from './native-result-presentation-intent'
import { createNativeReplayReaderScope, type NativeReplayReaderFactory } from './native-replay-reader-scope'

type History = HistoryOperations['listNativeConversationHistoryV8']['response']['data']
type HistoryOwner = { sessionId: string; revision: string; etag: string; conversationId: string }
type DocumentOwner = { sessionId: string; sessionState: 'ANONYMOUS' | 'AUTHENTICATED'; conversationId: string; draftId: string }
type HistoryNavigation = { cursors: (string | undefined)[]; index: number; offset: number }
const MAX_HISTORY_CURSORS = 100
type SessionOffer = { sessionId: string; csrfToken: string; claimIntent?: NativeAuthenticated['claimIntent'] }
const STORAGE_KEY = 'tesia.native.conversation'
const CONVERSATION_OWNER_KEY = 'tesia.native.conversation-session'
const SESSION_KEY = 'tesia.native.session-binding'
const expected = (value: ConversationSnapshot) => ({ expectedConversationStateRevision: value.conversationStateRevision, expectedConversationStateHash: value.conversationStateHash })
const approvalMatchesDraft = (value: StrategyApproval, snapshot: ConversationSnapshot) => (
  value.sourceConversationId === snapshot.conversationId && value.sourceConversationStateRevision === snapshot.conversationStateRevision
  && value.sourceConversationStateHash === snapshot.conversationStateHash && value.sourceDraftId === snapshot.draftId
  && value.sourceDraftRevision === snapshot.draftRevision && value.sourceProjectionHash === snapshot.projectionHash
  && value.semanticHash === snapshot.semanticHash
)
const assertSameJob = (next: NativeJob, observed: NativeJob) => {
  // The SDK binds a GET to backtestId. These immutable fields additionally
  // bind later observations to the job accepted for this strategy/profile.
  for (const field of ['backtestId', 'strategyVersionId', 'semanticHash', 'profileId', 'profileContentHash', 'splitGroupId', 'createdAt'] as const) {
    if (next[field] !== observed[field]) throw new Error('BINDING_CONFLICT')
  }
}
const safeCode = (error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  return ['AUTHENTICATION_REQUIRED', 'NOT_READY', 'SNAPSHOT_CHANGED', 'BINDING_CONFLICT', 'SOURCE_VERIFICATION_FAILED'].includes(code) ? code : 'REQUEST_UNCONFIRMED'
}
const authenticationRequired = (failure: unknown) => safeCode(failure) === 'AUTHENTICATION_REQUIRED'
  || Boolean(failure && typeof failure === 'object' && 'status' in failure && failure.status === 401)

// Only a validated v0.7 SUBMIT rejection may carry this presentation context.
// Transport loss, invalid envelopes and unrelated GETs remain unconfirmed.
class NativeSubmitNotReady extends Error { readonly code = 'NOT_READY' }
const nativeSubmitNotReadyCopy = '서버가 아직 실행 준비를 마치지 못해 백테스트를 시작하지 못했습니다. 요청은 그대로 보관되어 있으며 자동으로 다시 시도하지 않으니, 준비가 끝난 뒤 같은 요청으로 재개해 주세요.'

// Keep the initiating control focusable while its request is pending. The same
// disabled predicate still blocks every click, including synthetic clicks.
function WorkflowButton({ disabled, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type="button" data-workflow-action aria-disabled={disabled}
    onClick={event => { if (!disabled) onClick?.(event) }}
    onKeyDown={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault() }} />
}

/** Native service-only entry. No fixture adapter fallback and no order authority. */
export type NativeServicePresentations = Pick<ComponentProps<typeof ClientServiceExperience>,
  'conversationLibrary' | 'insightPresentation' | 'sharingPresentation' | 'researchPresentation' | 'accountPresentation' | 'feedbackPresentation' | 'brokerPresentation' | 'connectionPresentation'>
export function NativeServiceApp({ presentations = {} }: { presentations?: NativeServicePresentations } = {}) {
  const { language } = useClientPreferences()
  const jobText = (key: NativeJobTextKey, values?: Readonly<Record<string, string | number>>) => nativeJobText(language, key, values)
  const workflowText = (key: NativeWorkflowTextKey, values?: Readonly<Record<string, string | number>>) => nativeWorkflowText(language, key, values)
  const [clients] = useState(() => {
    let csrfToken: string | null = null
    const transport = new NativeServiceTransport()
    const replayReaders = createNativeReplayReaderScope()
    const conversationTransport = createServiceV03HttpTransport({ csrfTokenProvider: () => csrfToken })
    return { getCsrf: () => csrfToken, setCsrf: (value: string | null) => { csrfToken = value; if (value === null) replayReaders.invalidate() }, transport, replayReaders, conversationTransport, native: createNativeServiceApi(transport),
      conversation: createServiceConversationV03Port(new TesiaConversationV03Client(conversationTransport)),
      session: createSdk(new TesiaApiClient(new SameOriginApiTransport())).session,
      bootstrap: createBrowserSessionBootstrap() }
  })
  const [phase, setPhase] = useState<InternalPocPresentation['phase']>('loading')
  const [initializing, setInitializing] = useState(true)
  const [initialConnectionFailed, setInitialConnectionFailed] = useState(false)
  const [initialHome] = useState(() => {
    // Presence selects an empty loading surface only, never authentication,
    // restored content, or permission to send. Storage errors stay neutral.
    try {
      return [STORAGE_KEY, CONVERSATION_OWNER_KEY, NATIVE_JOURNAL_KEY, NATIVE_LOGOUT_KEY]
        .every(key => sessionStorage.getItem(key) === null) && !hasStoredNativeEmailIntent()
    } catch { return false }
  })
  const [sessionState, setSessionState] = useState<'ANONYMOUS' | 'AUTHENTICATED' | null>(null)
  const [conversation, setConversation] = useState<ConversationSnapshot | null>(null)
  const [documentOwner, setDocumentOwner] = useState<DocumentOwner | null>(null)
  const etag = useRef('')
  const [messages, setMessages] = useState<readonly ClientServiceMessage[]>([])
  // UI location is memory-only and keyed to the actual idempotent TURN. Never
  // add it to the SDK body/journal or claim the model consumed a report context.
  const researchDispatches = useRef(new Map<string, NativeResearchThreadOrigin>())
  const researchOrigin = (command: NativeMutationCommand) => {
    if (command.kind !== 'TURN') return undefined
    const origin = researchDispatches.current.get(command.body.clientMessageId)
    return origin?.scopeId === JSON.stringify([command.sessionId, command.sessionState, command.conversationId, command.draftId]) ? origin : undefined
  }
  // Only the currently submitted home wording is retained. This is not part of
  // the durable mutation journal, SDK body, approval or reconstructed history.
  const submittedQuestion = useRef<{ sessionId: string; clientMessageId: string; message: string; displayText: string } | null>(null)
  const displayedQuestion = (sessionId: string, clientMessageId: string, message: string) => {
    const saved = submittedQuestion.current
    return saved?.sessionId === sessionId && saved.clientMessageId === clientMessageId && saved.message === message ? saved.displayText : undefined
  }
  const [input, setInput] = useState('')
  const rowEdits = useNativeRowEdits()
  const composerRecovery = useRef<{ sessionId: string; sessionState: 'ANONYMOUS' | 'AUTHENTICATED'; conversationId: string | null; text: string } | null>(null)
  const [hasComposerRecovery, setHasComposerRecovery] = useState(false)
  const [busy, setBusy] = useState(false)
  const workflowElement = useRef<HTMLElement>(null)
  const workflowFocus = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const respectUserFocus = (event: Event) => {
      if (event.target !== workflowFocus.current) workflowFocus.current = null
    }
    document.addEventListener('focusin', respectUserFocus)
    document.addEventListener('pointerdown', respectUserFocus, true)
    return () => {
      document.removeEventListener('focusin', respectUserFocus)
      document.removeEventListener('pointerdown', respectUserFocus, true)
    }
  }, [])
  useLayoutEffect(() => {
    const origin = workflowFocus.current
    if (!origin || origin.isConnected) return
    workflowFocus.current = null
    // Never move focus away from a field/dialog the user has chosen, and never
    // focus the next execution button: a held Enter must not authorize a step.
    if (document.activeElement === document.body) {
      workflowElement.current?.querySelector<HTMLElement>('[data-workflow-focus]')?.focus({ preventScroll: true })
    }
  })
  const working = useRef(false)
  const emailDispatch = useRef<object | null>(null)
  const [emailBusy, setEmailBusy] = useState(false)
  const [error, setError] = useState('')
  const [homeInputFailure, setHomeInputFailure] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<DraftValidationReceipt | null>(null)
  const [challenge, setChallenge] = useState<ApprovalChallenge | null>(null)
  const [approval, setApproval] = useState<StrategyApproval | null>(null)
  const [job, setJob] = useState<NativeJob | null>(null)
  const [pollIssue, setPollIssue] = useState<{ job: NativeJob; retrying: boolean } | null>(null)
  const [refreshingJob, setRefreshingJob] = useState<NativeJob | null>(null)
  const jobPolling = useRef<{ job: NativeJob; control: ReturnType<typeof startNativeJobPolling> } | null>(null)
  // One confirmed result may remain visible while its own conversation draft
  // is edited. It is never approval, submission or current-draft authority.
  const [retainedResult, setRetainedResult] = useState<{ job: NativeJob; owner: HistoryOwner; draftId: string } | null>(null)
  const [resultStatus, setResultStatus] = useState<NativeServiceResultStatus | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [historyPending, setHistoryPending] = useState(false)
  const historyOwner = useRef<HistoryOwner | null>(null)
  const [historyNavigation, setHistoryNavigation] = useState<HistoryNavigation>({ cursors: [], index: 0, offset: 0 })
  const [historyNotice, setHistoryNotice] = useState<Extract<NativeJobTextKey,
    'historyAccessLostNotice' | 'historyPositionChangedNotice' | 'historyPageFailedNotice' | 'historySnapshotChangedNotice'> | ''>('')
  const [historyNeedsRefresh, setHistoryNeedsRefresh] = useState(false)
  const [selectedHistoryOwner, setSelectedHistoryOwner] = useState<HistoryOwner | null>(null)
  const [editingNotice, setEditingNotice] = useState(false)
  const [composerRequest, setComposerRequest] = useState<object>()
  const [previousConversation, setPreviousConversation] = useState<PreviousConversation | null>(null)
  const [navigationError, setNavigationError] = useState<ObservationNavigationError | ''>('')
  const [diff, setDiff] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const pending = useRef<NativeMutationCommand | null>(null)
  const session = useRef<{ sessionId: string; sessionState: 'ANONYMOUS' | 'AUTHENTICATED' } | null>(null)
  const [accountScope, setAccountScope] = useState<string | null>(null)
  const bindSession = (value: typeof session.current) => {
    // Keep request authority in the existing ref. React state only scopes the
    // lifetime of unsent local UI; it cannot authorize a request.
    if (value?.sessionId !== session.current?.sessionId || value?.sessionState !== session.current?.sessionState) clients.replayReaders.invalidate()
    session.current = value
    setAccountScope(value?.sessionId ?? null)
  }
  const epoch = useRef(0)
  const [automaticPresentation, setAutomaticPresentation] = useState<NativeResultPresentationRequest>()
  const [presentationIntent] = useState(() => createNativeResultPresentationIntent(() => null))
  useEffect(() => {
    // The existing poller keeps observing hidden jobs and catches up on
    // return. Retire only the foreground visual invitation so that catch-up
    // cannot launch a delayed replay; never stop or mutate the server job.
    const retireHiddenPresentation = () => {
      if (document.visibilityState === 'hidden') presentationIntent.invalidate()
    }
    document.addEventListener('visibilitychange', retireHiddenPresentation)
    return () => document.removeEventListener('visibilitychange', retireHiddenPresentation)
  }, [presentationIntent])
  const presentationSessionId = documentOwner?.sessionId, presentationSessionState = documentOwner?.sessionState
  const presentationConversationId = documentOwner?.conversationId, presentationDraftId = documentOwner?.draftId
  useLayoutEffect(() => () => clients.replayReaders.invalidate(),
    [clients, sessionState, presentationSessionId, presentationSessionState, presentationConversationId, presentationDraftId])
  const createReplayReader = useCallback<NativeReplayReaderFactory>(request => {
    const owner = session.current, generation = epoch.current
    if (!owner || !clients.getCsrf()) throw new Error('NATIVE_REPLAY_DISPOSED')
    return clients.replayReaders.create(request, () => generation === epoch.current
      && owner.sessionId === session.current?.sessionId && owner.sessionState === session.current?.sessionState
      && Boolean(clients.getCsrf()))
    // These display scope values also invalidate the Result's ready/playing
    // state; reader disposal alone cannot stop an already-running renderer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, sessionState, presentationSessionId, presentationSessionState, presentationConversationId, presentationDraftId])
  useLayoutEffect(() => {
    presentationIntent.setScopeReader(() => {
      const bound = session.current
      return bound && presentationSessionId === bound.sessionId && presentationSessionState === bound.sessionState && presentationConversationId && presentationDraftId
        ? { sessionId: presentationSessionId, sessionState: presentationSessionState, conversationId: presentationConversationId, draftId: presentationDraftId, epoch: epoch.current } : null
    })
    return () => presentationIntent.invalidate()
  }, [presentationSessionId, presentationSessionState, presentationConversationId, presentationDraftId, presentationIntent])
  const [hasPending, setHasPending] = useState(false)
  // Display lifetime only. Once an unresolved journal has exposed recovery,
  // preserve its controls through retry/other reads until that journal clears.
  // This flag never admits, acknowledges, retries or persists a command.
  const [pendingRecoveryVisible, setPendingRecoveryVisible] = useState(false)
  if (!hasPending && pendingRecoveryVisible) setPendingRecoveryVisible(false)
  else if (hasPending && !busy && !pendingRecoveryVisible) setPendingRecoveryVisible(true)
  const [rejectedClaimKey, setRejectedClaimKey] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(() => window.location.pathname === '/auth/complete')
  const [loginRetained, setLoginRetained] = useState(false)
  const [loginResume, setLoginResume] = useState(0)
  const loginGeneration = useRef(0)
  const [loginBinding, setLoginBinding] = useState<{ sessionId: string; epoch: number; generation: number } | null>(null)
  const authReceipt = useRef<{ result: SessionOffer; conversationId?: string } | null>(null)
  const acceptedAuth = useRef('')
  const [claimAvailable, setClaimAvailable] = useState(false)
  const logoutIntent = useRef<NativeLogoutCommand | null>(null)
  const [hasLogout, setHasLogout] = useState(false)
  const [logoutBoundary, setLogoutBoundary] = useState<'absent' | 'changed' | null>(null)
  const paperGeneration = useRef(0)
  const [paperBinding, setPaperBinding] = useState<{ owner: HistoryOwner; scope: NativePaperStorageScope; epoch: number; generation: number } | null>(null)
  const closePaper = () => { paperGeneration.current++; setPaperBinding(null) }
  const smokeGeneration = useRef(0)
  const [smokeBinding, setSmokeBinding] = useState<{ owner: HistoryOwner; binding: StructuralSmokeBinding; contentHash: string; epoch: number; generation: number } | null>(null)
  const closeSmoke = () => { smokeGeneration.current++; setSmokeBinding(null) }
  const remember = (snapshot: ConversationSnapshot, nextEtag: string, persist = true) => {
    etag.current = nextEtag; setConversation(snapshot)
    // Capture the owner only alongside an observed server snapshot. Render
    // never promotes a stored locator or an auth offer into document authority.
    setDocumentOwner(session.current ? { ...session.current, conversationId: snapshot.conversationId, draftId: snapshot.draftId } : null)
    if (!persist) return
    try {
      if (session.current) sessionStorage.setItem(CONVERSATION_OWNER_KEY, session.current.sessionId)
      sessionStorage.setItem(STORAGE_KEY, snapshot.conversationId)
    } catch { /* memory-only remains usable */ }
  }
  const clearViews = (preserveComposer = false, preserveRows = false) => {
    clients.replayReaders.invalidate()
    presentationIntent.invalidate(); setAutomaticPresentation(undefined)
    if (!preserveComposer && !preserveRows) rowEdits.clear()
    submittedQuestion.current = null
    // A same-session recheck may hide all views before revalidating the owner.
    // Retain only the exact pending TURN's local location for same-key replay.
    const pendingThreadId = preserveComposer && pending.current?.kind === 'TURN' ? pending.current.body.clientMessageId : undefined
    const pendingThread = pendingThreadId ? researchDispatches.current.get(pendingThreadId) : undefined
    researchDispatches.current.clear()
    if (pendingThreadId && pendingThread) researchDispatches.current.set(pendingThreadId, pendingThread)
    setHomeInputFailure(null)
    setPollIssue(null)
    setRefreshingJob(null)
    setRetainedResult(null)
    setDocumentOwner(null)
    setResultStatus(null)
    closePaper(); closeSmoke()
    if (!preserveComposer) { composerRecovery.current = null; setHasComposerRecovery(false) }
    setRejectedClaimKey(null)
    setPreviousConversation(null); setNavigationError('')
    historyOwner.current = null; setSelectedHistoryOwner(null); setEditingNotice(false)
    setHistoryNavigation({ cursors: [], index: 0, offset: 0 }); setHistoryNotice(''); setHistoryNeedsRefresh(false)
    setConversation(null); etag.current = ''; setMessages([]); setInput(''); setReceipt(null); setChallenge(null); setApproval(null); setJob(null); setHistory(null); setDiff([]); setAcknowledged(false)
  }
  const observeLogoutSession = async (command: NativeLogoutCommand, confirmed = false) => {
    const generation = epoch.current
    clients.setCsrf(null); setLogoutBoundary(null)
    const observed = await clients.session.current().catch(failure => {
      if (failure instanceof ApiResponseError && failure.status === 401 && failure.envelope.error.code === 'AUTHENTICATION_REQUIRED') return null
      throw failure
    })
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    if (!observed) {
      bindSession(null); setSessionState(null); clearViews(); setLogoutBoundary('absent')
      setPhase(confirmed ? 'logged-out' : 'error')
      setError(confirmed ? '로그아웃 응답과 현재 브라우저 세션 부재를 확인했습니다. 서버 전략을 삭제하거나 백테스트를 취소하지 않습니다.'
        : '현재 브라우저 세션이 없습니다. 로그아웃 응답과 서버의 세션 종료 여부는 확인하지 못했습니다. 기존 요청 기록은 보존했습니다.')
      return false
    }
    const value = observed.body.data
    if (value.sessionId !== command.sessionId || value.state !== command.sessionState || observed.etag !== command.ifMatch || value.revision !== command.expectedSessionRevision) {
      bindSession(null); setSessionState(null); clearViews(); setLogoutBoundary('changed'); setPhase('error')
      setError('현재 세션이 로그아웃 요청의 세션과 달라 재전송하지 않았습니다. 다른 세션의 로그아웃이나 전체 계정 종료를 확인한 것이 아닙니다. 기존 요청 기록은 보존했습니다.')
      return false
    }
    const token = await clients.session.csrf()
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    bindSession({ sessionId: value.sessionId, sessionState: command.sessionState })
    clients.setCsrf(token.body.data.csrfToken); setSessionState(command.sessionState); setPhase('ready')
    return true
  }
  const recoverSession = async () => {
    // Keep unsent text in memory only, never in the mutation journal/storage.
    // A failed read retains this buffer without exposing it under a new owner.
    if (input && session.current && !pending.current && !logoutIntent.current) {
      composerRecovery.current = { ...session.current, conversationId: conversation?.conversationId ?? null, text: input }
      setHasComposerRecovery(true)
    }
    const generation = ++epoch.current
    // Recovery unmounts the old auth flow. Its presentation-only retention
    // marker must not strand the next owner in a shell with no memory context.
    setLoginRetained(false)
    clients.setCsrf(null); setPhase('loading')
    bindSession(null); setSessionState(null); clearViews(true)
    clients.transport.abort(); clients.conversationTransport.abortInFlight()
    const savedLogout = readNativeLogout()
    if (savedLogout) {
      logoutIntent.current = savedLogout; setHasLogout(true)
      pending.current = readNativeJournal(); setHasPending(Boolean(pending.current))
      await observeLogoutSession(savedLogout)
      return // Never bootstrap or clear an uncertain logout on reload/recovery.
    }
    const emailRecovery = hasStoredNativeEmailIntent()
    const existing = emailRecovery ? await clients.session.current().catch(failure => {
      if (!(failure instanceof ApiResponseError) || failure.status !== 401 || failure.envelope.error.code !== 'AUTHENTICATION_REQUIRED') throw failure
      if (generation !== epoch.current) return null
      setPhase('error'); setError('이전 이메일 요청의 세션을 확인할 수 없습니다. 새 익명 세션을 자동 발급하지 않았습니다. 새로고침으로 사라진 인증번호·CSRF는 복구할 수 없으며 기존 전략과 요청 기록은 보존했습니다.')
      return null
    }) : null
    if (generation !== epoch.current) return
    if (emailRecovery && !existing) return
    if (existing && !['ANONYMOUS', 'AUTHENTICATED'].includes(existing.body.data.state)) throw new Error('SESSION_CHANGED')
    // An untrusted email locator suppresses creation only. The existing session
    // still comes from the real SDK GET, not a stored authentication receipt.
    const result = existing ? { kind: 'EXISTING_SESSION' as const, current: { response: existing } } : await clients.bootstrap()
    const token = await clients.session.csrf()
    if (generation !== epoch.current) return
    const observed = result.current.response.body.data
    const current = { sessionId: observed.sessionId, sessionState: observed.state as 'ANONYMOUS' | 'AUTHENTICATED' }
    const binding = JSON.stringify(current)
    let savedCommand = readNativeJournal()
    const previousBinding = sessionStorage.getItem(SESSION_KEY)
    const changed = result.kind === 'BOOTSTRAP_CONFIRMED' || (previousBinding !== null && previousBinding !== binding)
      || (savedCommand !== null && (savedCommand.sessionId !== current.sessionId || savedCommand.sessionState !== current.sessionState))
    // A newly issued anonymous session still invalidates all prior authority.
    // Only report a replacement when this tab actually held prior context;
    // a clean first visit must retain the original home composer.
    const replacedContext = changed && (previousBinding !== null || savedCommand !== null
      || sessionStorage.getItem(STORAGE_KEY) !== null || sessionStorage.getItem(CONVERSATION_OWNER_KEY) !== null)
    if (emailRecovery && changed && savedCommand) {
      // Keep the observed AUTH owner available for explicit, freshly checked
      // logout, but never attach the old journal or draft to that owner.
      bindSession(current); setSessionState(current.sessionState)
      pending.current = savedCommand; setHasPending(true)
      setPhase('error'); setError('이메일 복구 중 세션이 달라 이전 미확정 전략 요청을 보존했습니다. 이 요청을 새 세션에 자동 연결하거나 폐기하지 않았습니다.')
      return
    }
    if (changed) {
      clearNativeJournal(); savedCommand = null
      authReceipt.current = null; setClaimAvailable(false)
    }
    sessionStorage.setItem(SESSION_KEY, binding)
    if (sessionStorage.getItem(SESSION_KEY) !== binding) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
    bindSession(current)
    setLoginBinding({ sessionId: current.sessionId, epoch: generation, generation: loginGeneration.current })
    try { setPreviousConversation(readPreviousConversation(current.sessionId)); setNavigationError('') }
    catch { setPreviousConversation(null); setNavigationError('read') }
    clients.setCsrf(token.body.data.csrfToken)
    setSessionState(current.sessionState)
    pending.current = savedCommand; setHasPending(Boolean(savedCommand))
    const saved = savedCommand?.kind === 'CLAIM' ? null : savedCommand && 'conversationId' in savedCommand ? savedCommand.conversationId : sessionStorage.getItem(STORAGE_KEY)
    const savedOwner = sessionStorage.getItem(CONVERSATION_OWNER_KEY)
    if (current.sessionState === 'AUTHENTICATED' && savedOwner && savedOwner !== current.sessionId) setLoginOpen(true)
    // An old-session locator can support an explicit claim offer, but cannot
    // become the current conversation until the server transfers ownership.
    if (saved && !changed && (!savedOwner || savedOwner === current.sessionId) && /^[A-Za-z0-9_-]{1,160}$/.test(saved)) {
      const restored = await clients.conversation.getConversation(saved).catch(failure => { setPhase('error'); throw failure })
      if (generation !== epoch.current) return
      if (restored.body.data.conversationId !== saved) throw new Error('BINDING_CONFLICT')
      remember(restored.body.data, restored.etag)
    }
    const composer = composerRecovery.current
    if (composer) {
      if (changed || composer.sessionId !== current.sessionId || composer.sessionState !== current.sessionState || composer.conversationId !== (saved ?? null)
        || (savedOwner && savedOwner !== current.sessionId) || savedCommand) {
        composerRecovery.current = null; setHasComposerRecovery(false)
      } else {
        // A second authoritative session observation follows the draft GET.
        const confirmed = await clients.session.current().catch(failure => { setPhase('error'); throw failure })
        if (generation !== epoch.current) return
        if (confirmed.body.data.sessionId !== current.sessionId || confirmed.body.data.state !== current.sessionState
          || confirmed.body.data.revision !== observed.revision || confirmed.etag !== result.current.response.etag) {
          clients.setCsrf(null); bindSession(null); setSessionState(null); clearViews(); setPhase('error')
          throw new Error('SESSION_CHANGED')
        }
        // A newer onInput event clears/replaces the candidate; never overwrite it.
        if (composerRecovery.current === composer) {
          setInput(value => value || composer.text)
          composerRecovery.current = null; setHasComposerRecovery(false)
        }
      }
    }
    setError(savedCommand ? '확인하지 못한 요청이 있습니다. 저장 기록은 승인 증거가 아닙니다. 같은 요청으로 명시적으로 재개해주세요.'
      : replacedContext ? '세션이 변경되어 이전 요청과 승인 표시를 무효화했습니다. 서버 이력에서 상태를 확인해주세요.' : '')
    setInitialConnectionFailed(false)
    setPhase('ready')
  }
  useEffect(() => {
    let active = true
    const boundary = epoch
    void Promise.resolve().then(() => { if (active) return recoverSession() }).catch(() => { if (active) { setInitialConnectionFailed(initialHome); setPhase('error'); setError('세션 또는 복구 저장소를 확인하지 못했습니다. 서버 상태를 삭제하지 않았습니다.') } })
      .finally(() => { if (active) setInitializing(false) })
    return () => { active = false; boundary.current++; clients.setCsrf(null); clients.transport.abort(); clients.conversationTransport.abortInFlight() }
    // Session recovery is an explicit boundary, never an effect of view state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients])
  // Poll only observed jobs. An HTTP failure never becomes a fabricated FAILED job.
  useEffect(() => {
    if (!job || ['COMPLETED', 'FAILED', 'INVALID'].includes(job.state)) return
    const generation = epoch.current
    const control = startNativeJobPolling({
      read: async () => (await clients.native.jobs.call('getNativeBacktestV7', { backtestId: job.backtestId })).data,
      isCurrent: () => generation === epoch.current,
      accept: value => {
        assertSameJob(value, job)
        const display = presentationIntent.observe(value)
        if (display) setAutomaticPresentation(display)
        setPollIssue(null); setJob(value)
      },
      onFailure: retrying => setPollIssue({ job, retrying }),
      visibility: {
        hidden: () => document.visibilityState === 'hidden',
        subscribe: listener => {
          document.addEventListener('visibilitychange', listener)
          return () => document.removeEventListener('visibilitychange', listener)
        },
      },
    })
    jobPolling.current = { job, control }
    return () => { control.stop(); if (jobPolling.current?.control === control) jobPolling.current = null }
  }, [clients, job, presentationIntent])
  const run = async (operation: () => Promise<void>) => {
    if (working.current) return
    working.current = true; setBusy(true); setError('')
    try { await operation() }
    catch (failure) {
      if (!clients.getCsrf()) setPhase('error')
      if (authenticationRequired(failure)) {
        clients.setCsrf(null); setPhase('error'); setSessionState(null)
      }
      setError(failure instanceof NativeSubmitNotReady ? `NOT_READY · ${nativeSubmitNotReadyCopy}`
        : `${safeCode(failure)} · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.`)
    }
    finally { working.current = false; setBusy(false) }
  }
  const runHistory = (operation: () => Promise<void>) => run(async () => {
    setHistoryPending(true)
    try { await operation() }
    finally { setHistoryPending(false) }
  })
  const openLogin = () => run(async () => {
    if (logoutIntent.current || !session.current || phase !== 'ready') return
    const owner = session.current, generation = epoch.current
    if (loginRetained) {
      // This opens only a redacted recovery shell. No previous link, provider
      // confirmation or ACK affordance is restored by this local transition.
      setLoginBinding({ sessionId: owner.sessionId, epoch: generation, generation: loginGeneration.current })
      setLoginResume(value => value + 1); setLoginOpen(true); return
    }
    try {
      // Closing preserves memory only. Reopening does not replay START/ACK:
      // first verify the present cookie owner with the existing validated SDK.
      const current = await clients.session.current(), value = current.body.data
      if (generation !== epoch.current || logoutIntent.current) return
      const allowed = value.state === owner.sessionState
      if (value.sessionId !== owner.sessionId || !allowed || !current.etag) throw new Error('SESSION_CHANGED')
      setLoginBinding({ sessionId: owner.sessionId, epoch: generation, generation: loginGeneration.current })
      setLoginOpen(true)
    } catch (failure) {
      if (generation === epoch.current) {
        loginGeneration.current++; setLoginBinding(null); setLoginRetained(false); setLoginOpen(false)
      }
      throw failure
    }
  })
  const contextFor = (command: NativeMutationCommand) => {
    const csrfToken = clients.getCsrf()
    if (!csrfToken || !session.current || command.sessionId !== session.current.sessionId || command.sessionState !== session.current.sessionState) throw new Error('SESSION_REQUIRED')
    return { csrfToken, idempotencyKey: command.idempotencyKey, ...('ifMatch' in command ? { ifMatch: command.ifMatch } : {}) }
  }
  const executeCommand = async (original: NativeMutationCommand) => {
    const generation = epoch.current
    const assertCurrent = () => { if (generation !== epoch.current) throw new Error('SESSION_CHANGED') }
    let command = original
    if (command.kind === 'CREATE_TURN') {
      const created = await clients.conversation.createConversation(contextFor(command))
      assertCurrent()
      const next: NativeMutationCommand = { version: 1, kind: 'TURN', sessionId: command.sessionId, sessionState: command.sessionState,
        idempotencyKey: command.turnIdempotencyKey, conversationId: created.body.data.conversationId, draftId: created.body.data.draftId,
        ifMatch: created.etag, body: { ...expected(created.body.data), clientMessageId: command.clientMessageId, message: command.message } }
      // The second command is durable before any turn is sent. If this write
      // fails, replay the original create key, never allocate a replacement.
      writeNativeJournal(next); pending.current = next; command = next
      remember(created.body.data, created.etag)
    }
    const context = contextFor(command)
    const complete = () => { assertCurrent(); clearNativeJournal(); pending.current = null; setHasPending(false) }
    const assertBinding = (value: { conversationId: string; draftId: string; conversationStateRevision: string; conversationStateHash: string; draftRevision: string; projectionHash: string; semanticHash?: string }, request: Extract<NativeMutationCommand, { kind: 'VALIDATE' | 'CHALLENGE' | 'APPROVE' }>) => {
      if (value.conversationId !== request.conversationId || value.draftId !== request.draftId
        || value.conversationStateRevision !== request.body.expectedConversationStateRevision
        || value.conversationStateHash !== request.body.expectedConversationStateHash) throw new Error('BINDING_CONFLICT')
      if (!conversation || conversation.conversationId !== value.conversationId || conversation.draftId !== value.draftId
        || conversation.conversationStateRevision !== value.conversationStateRevision || conversation.conversationStateHash !== value.conversationStateHash
        || conversation.draftRevision !== value.draftRevision || conversation.projectionHash !== value.projectionHash
        || (value.semanticHash !== undefined && value.semanticHash !== conversation.semanticHash)) throw new Error('BINDING_CONFLICT')
    }
    switch (command.kind) {
      case 'CLAIM': {
        const value = await clients.session.claim({ id: command.initiatingSessionId, body: { expectedSessionRevision: command.expectedSessionRevision },
          context: { ...context, ifMatch: command.ifMatch } }).catch(failure => {
          assertCurrent()
          // Only an SDK-validated, definitive rejection can offer abandonment.
          // A transport failure, malformed response or lost ACK stays pending.
          if (failure instanceof ApiResponseError && failure.status === 400 && failure.envelope.error.code === 'BAD_REQUEST') setRejectedClaimKey(command.idempotencyKey)
          throw failure
        })
        assertCurrent()
        if (value.body.data.sessionId !== command.sessionId || value.body.data.sessionId === command.initiatingSessionId) throw new Error('BINDING_CONFLICT')
        const observed = await clients.session.current()
        assertCurrent()
        if (observed.body.data.state !== 'AUTHENTICATED' || observed.body.data.sessionId !== command.sessionId
          || observed.body.data.revision !== value.body.data.revision) throw new Error('BINDING_CONFLICT')
        const token = await clients.session.csrf()
        const restored = command.conversationId ? await clients.conversation.getConversation(command.conversationId) : null
        assertCurrent()
        if (restored && restored.body.data.conversationId !== command.conversationId) throw new Error('BINDING_CONFLICT')
        complete(); epoch.current++; clearViews()
        clients.setCsrf(token.body.data.csrfToken)
        if (restored) remember(restored.body.data, restored.etag)
        forgetNativeEmailLocator(command.initiatingSessionId)
        authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false)
        setError(restored ? '로그인 전 전략의 서버 연결을 확인했습니다. 검증과 승인은 다시 확인해주세요.'
          : '서버 인계 응답과 현재 인증 세션을 확인했습니다. 이 브라우저에는 복구할 대화 식별자가 없어 전략 내용은 확인하지 못했습니다.')
        return
      }
      case 'TURN': {
        const response = await clients.conversation.createTurn(command.conversationId, command.body, context)
        assertCurrent()
        const next = response.body.data.conversation
        if (next.conversationId !== command.conversationId || next.draftId !== command.draftId) throw new Error('BINDING_CONFLICT')
        await rowEdits.verify(command, response.body.data)
        assertCurrent()
        const previous = conversation?.draftState.projection
        const changed = Object.keys(next.draftState.projection).filter(key => !previous || JSON.stringify(previous[key as keyof typeof previous]) !== JSON.stringify(next.draftState.projection[key as keyof typeof previous]))
        complete(); remember(next, response.etag); setDiff(changed)
        rowEdits.observe(command, response.body.data)
        const { clientMessageId, message } = command.body
        const researchThread = researchOrigin(command)
        researchDispatches.current.delete(clientMessageId)
        const displayText = displayedQuestion(command.sessionId, clientMessageId, message)
        // The accepted message owns its display wording now. Manual same-key
        // recovery does not pass through send's finally, so release it here too.
        if (displayText !== undefined) submittedQuestion.current = null
        const reply = next.nextQuestion?.prompt ?? (next.candidateState === 'READY_FOR_VALIDATION' ? '전략 조건을 정리했습니다. 초안과 변경 항목을 확인한 뒤 검증할 수 있습니다.' : '서버가 반환한 초안을 확인해주세요.')
        setMessages(value => [...value.filter(item => item.id !== clientMessageId && item.id !== `${clientMessageId}_reply`),
          { id: clientMessageId, role: 'user', text: message, displayText, researchThread }, { id: `${clientMessageId}_reply`, role: 'assistant', researchThread,
            text: reply, observation: captureTurnObservation(response.body.data, next.nextQuestion
              ? { text: next.nextQuestion.prompt } : { key: next.candidateState === 'READY_FOR_VALIDATION' ? 'readyReply' : 'draftReply' }) }])
        return
      }
      case 'VALIDATE': {
        const value = (await clients.conversation.validateDraft(command.draftId, command.body, context)).body.data
        assertCurrent(); assertBinding(value, command); complete()
        setChallenge(null); setAcknowledged(false)
        if (value.status === 'INVALID') { setReceipt(null); setError(`전략 검증 실패: ${value.issues.map(item => item.code).join(', ')}`) }
        else setReceipt(value)
        // One observed result per explicit request. Same-key replay replaces
        // this entry; a fresh verification remains a separate observation.
        // The private React key is never displayed or saved as a transcript.
        const observationId = `validation_${command.idempotencyKey}`
        setMessages(messages => [...messages.filter(message => message.id !== observationId), {
          id: observationId, role: 'assistant', text: '전략 검증 결과를 확인했습니다.', observation: captureValidationObservation(value),
        }])
        return
      }
      case 'CHALLENGE': {
        const value = (await clients.conversation.createApprovalChallenge(command.draftId, command.body, context)).body.data
        assertCurrent(); assertBinding(value, command)
        if (value.validationReceiptId !== command.body.validationReceiptId || value.semanticHash !== command.body.acknowledgedSemanticHash || value.consumptionState !== 'AVAILABLE') throw new Error('BINDING_CONFLICT')
        complete(); setChallenge(value); setAcknowledged(false)
        return
      }
      case 'APPROVE': {
        const value = (await clients.conversation.approveDraft(command.draftId, command.body, context)).body.data
        assertCurrent()
        assertBinding({ conversationId: value.sourceConversationId, draftId: value.sourceDraftId, conversationStateRevision: value.sourceConversationStateRevision, conversationStateHash: value.sourceConversationStateHash,
          draftRevision: value.sourceDraftRevision, projectionHash: value.sourceProjectionHash, semanticHash: value.semanticHash }, command)
        if (value.validationReceiptId !== command.body.validationReceiptId || value.approvalChallengeId !== command.body.approvalChallengeId || value.semanticHash !== command.body.acknowledgedSemanticHash) throw new Error('BINDING_CONFLICT')
        complete(); setApproval(value); setSelectedHistoryOwner(null); setEditingNotice(false)
        return
      }
      case 'SUBMIT': {
        // Generated v0.7 client binds strategyVersionId, semanticHash and
        // profileId to this exact request before returning the accepted job.
        const value = await clients.native.jobs.call('submitNativeBacktestV7', command.body, context).catch(failure => {
          if (failure instanceof ApiV07Error && failure.code === 'NOT_READY') throw new NativeSubmitNotReady()
          throw failure
        })
        complete(); presentationIntent.acceptSubmission(command.idempotencyKey, value.data)
        setResultStatus(null); setJob(value.data)
        return
      }
    }
  }
  // Initial dispatch and same-key recovery share this presentation boundary.
  // It never treats a pending/local journal as a server acknowledgement.
  const execute = async (command: NativeMutationCommand) => {
    const generation = epoch.current
    const request = command.kind === 'CREATE_TURN' ? command : command.kind === 'TURN' ? command.body : null
    try {
      if (request) {
        contextFor(command)
        const displayText = displayedQuestion(command.sessionId, request.clientMessageId, request.message)
        const researchThread = researchOrigin(command)
        setMessages(messages => messages.some(message => message.id === request.clientMessageId)
          ? messages.map(message => message.id === request.clientMessageId ? { ...message, delivery: 'pending' } : message) : [...messages, {
          id: request.clientMessageId, role: 'user', text: request.message, displayText, delivery: 'pending', researchThread,
        }])
      }
      await executeCommand(command)
    } catch (failure) {
      if (request && generation === epoch.current) {
        rowEdits.observe(command)
        setMessages(messages => messages.map(message => message.id === request.clientMessageId && message.delivery === 'pending'
          ? { ...message, delivery: 'uncertain' } : message))
      }
      throw failure
    }
  }
  const start = async (command: NativeMutationCommand, prepare?: () => Promise<void>, clearComposer = true) => {
    if (working.current || emailDispatch.current || pending.current || logoutIntent.current || phase !== 'ready') return
    await run(async () => {
      if (prepare) await prepare()
      // A failed durable write is fail-closed: no mutation has been sent.
      try { writeNativeJournal(command) }
      catch {
        // This catch covers the initial local journal write only, never execute
        // or a journal update after a server mutation. Readback may have failed
        // after storage accepted bytes, so do not remove or overwrite them here.
        // No dispatch has happened and the composer has not been cleared.
        // Keep its exact text and the shell's selected template chips. Writing
        // command.message here replaces the user's draft with generated text
        // and makes the shell discard those chips. The journal still owns the
        // combined request if a failed readback actually left durable bytes.
        const message = command.kind === 'CREATE_TURN' || command.kind === 'TURN'
          ? `요청 기록을 저장·확인하지 못해 이번 질문을 서버로 전송하지 않았습니다. ${command.kind === 'CREATE_TURN' ? '선택한 템플릿과 작성 내용은' : '작성한 내용은'} 유지했습니다. 저장소에 이번 요청이 남아 있을 수 있으니 세션을 다시 확인해주세요.`
          : '요청 기록을 저장·확인하지 못해 이번 요청을 서버로 전송하지 않았습니다. 저장소를 확인한 뒤 다시 시도해주세요.'
        setHomeInputFailure(command.kind === 'CREATE_TURN' ? message : null)
        setError(message)
        return
      }
      pending.current = command; setHasPending(true)
      // Only a fresh request in this component lifetime earns a visual stamp.
      // A same-key uncertain retry may retain it; a restored journal has none.
      if (command.kind === 'SUBMIT') {
        presentationIntent.beginSubmission(command.idempotencyKey)
        setAutomaticPresentation(undefined)
      }
      if (command.kind === 'CREATE_TURN' || command.kind === 'TURN') {
        // Quick replies send their own text, not the separate unsent composer.
        if (clearComposer) setInput('')
        setReceipt(null); setChallenge(null); setAcknowledged(false)
      }
      await execute(command)
    })
  }
  const base = () => {
    if (!session.current) throw new Error('SESSION_REQUIRED')
    return { version: 1 as const, ...session.current, idempotencyKey: crypto.randomUUID() }
  }
  const draftBase = (snapshot: ConversationSnapshot) => ({ ...base(), conversationId: snapshot.conversationId, draftId: snapshot.draftId, ifMatch: etag.current })
  const executeLogout = async (command: NativeLogoutCommand) => {
    if (!await observeLogoutSession(command)) return
    const generation = epoch.current
    const token = clients.getCsrf()
    if (!token) throw new Error('SESSION_REQUIRED')
    const response = await clients.session.logout({ context: { csrfToken: token, idempotencyKey: command.idempotencyKey, ifMatch: command.ifMatch } })
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    const value = response.body.data
    if (value.sessionId !== command.sessionId || value.state !== 'REVOKED' || BigInt(value.revision) !== BigInt(command.expectedSessionRevision) + 1n) throw new Error('BINDING_CONFLICT')
    // Cookie headers are browser-owned. A new tab may have replaced the cookie;
    // never call the current session logged out without a separate observation.
    await observeLogoutSession(command, true)
  }
  const logout = () => run(async () => {
    if (logoutIntent.current) { await executeLogout(logoutIntent.current); return }
    if (sessionState !== 'AUTHENTICATED' || !['ready', 'error'].includes(phase)) return
    const generation = epoch.current, bound = session.current
    const current = await clients.session.current()
    if (generation !== epoch.current) return
    if (!bound || current.body.data.sessionId !== bound.sessionId || current.body.data.state !== 'AUTHENTICATED') {
      clients.setCsrf(null); setSessionState(null); setPhase('error'); throw new Error('SESSION_CHANGED')
    }
    const command: NativeLogoutCommand = { version: 1, kind: 'LOGOUT', sessionId: bound.sessionId, sessionState: 'AUTHENTICATED',
      idempotencyKey: crypto.randomUUID(), ifMatch: current.etag!, expectedSessionRevision: current.body.data.revision }
    // Separate from business mutations: logging out never deletes their journal.
    writeNativeLogout(command); logoutIntent.current = command; setHasLogout(true)
    forgetNativeEmailLocator()
    epoch.current++; clients.transport.abort(); clients.conversationTransport.abortInFlight()
    clearViews(); authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false)
    await executeLogout(command)
  })
  const newSessionAfterLogout = () => run(async () => {
    const command = logoutIntent.current
    if (!command || !logoutBoundary) return
    // Recheck on the explicit boundary; no absent-session inference revokes any
    // server session. Original business request bytes remain in detached storage.
    if (await observeLogoutSession(command)) return
    detachNativeJournalAfterLogout()
    sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(CONVERSATION_OWNER_KEY)
    logoutIntent.current = null; setHasLogout(false); setLogoutBoundary(null)
    pending.current = null; setHasPending(false); acceptedAuth.current = ''
    // A new, explicitly selected session gets its own one-shot bootstrap.
    // Recovery of an ambiguous bootstrap never resets that factory.
    clients.bootstrap = createBrowserSessionBootstrap()
    await recoverSession()
    setError('')
  })
  const recordSessionOffer = (result: SessionOffer, confirmation: 'ACK_CONFIRMED' | 'EMAIL_CONFIRMED' | 'HANDOFF_UNVERIFIED'): void => {
    if (logoutIntent.current) { setError('로그아웃 요청을 확인하는 동안 로그인 인계와 전략 연결을 진행하지 않습니다. 현재 세션을 다시 확인해주세요.'); return }
    if (pending.current) { setError('미확정 전략 요청 기록을 보존했습니다. 이 기록을 지우거나 새 로그인 세션에 자동 연결하지 않습니다.'); return }
    const identity = `${confirmation}:${result.sessionId}:${result.claimIntent?.initiatingSessionId}:${result.claimIntent?.expectedSessionRevision}`
    if (acceptedAuth.current === identity) return
    // The login panel has verified the cookie round trip. This callback only
    // records an offer; ownership transfer still needs a separate explicit click.
    try {
      const sameAuthenticatedOwner = confirmation === 'HANDOFF_UNVERIFIED' && session.current?.sessionId === result.sessionId && session.current.sessionState === 'AUTHENTICATED'
      const savedOwner = sessionStorage.getItem(CONVERSATION_OWNER_KEY)
      const saved = result.claimIntent && (savedOwner === result.claimIntent.initiatingSessionId || session.current?.sessionId === result.claimIntent.initiatingSessionId)
        ? conversation?.conversationId ?? sessionStorage.getItem(STORAGE_KEY) ?? undefined : undefined
      epoch.current++; clients.transport.abort(); clients.conversationTransport.abortInFlight()
      clients.setCsrf(null); bindSession(null); clearViews()
      clearNativeJournal(); pending.current = null; setHasPending(false)
      const current = { sessionId: result.sessionId, sessionState: 'AUTHENTICATED' as const }
      const binding = JSON.stringify(current)
      sessionStorage.setItem(SESSION_KEY, binding)
      if (sessionStorage.getItem(SESSION_KEY) !== binding) throw new Error('NATIVE_JOURNAL_UNAVAILABLE')
      bindSession(current); clients.setCsrf(result.csrfToken); setSessionState('AUTHENTICATED'); setPhase('ready')
      if (sameAuthenticatedOwner) setLoginBinding({ sessionId: current.sessionId, epoch: epoch.current, generation: loginGeneration.current })
      else { setLoginBinding(null); setLoginOpen(false); setLoginRetained(false) }
      authReceipt.current = { result, ...(saved ? { conversationId: saved } : {}) }; acceptedAuth.current = identity; setClaimAvailable(Boolean(result.claimIntent?.initiatingSessionEtag))
      setError(result.claimIntent?.initiatingSessionEtag ? confirmation !== 'HANDOFF_UNVERIFIED' ? '로그인을 확인했습니다. 로그인 전 전략은 아직 연결하거나 승인하지 않았습니다.'
        : '현재 인증 세션만 확인했습니다. 공급자 인증·로그인 확정 응답·전략 인계는 미확인입니다. 별도 연결 요청은 서버가 최종 확인합니다.'
        : '현재 인증 세션은 확인했지만 로그인 전 세션의 사전조건을 복구하지 못해 전략 연결을 차단했습니다. 인증 세션 ETag로 대체하지 않습니다.')
    } catch {
      clients.setCsrf(null); setPhase('error'); setSessionState(null)
      setError('로그인 후 복구 저장소를 확인하지 못했습니다. 전략 연결과 승인은 실행하지 않았습니다.')
    }
  }
  const authenticated = (result: NativeAuthenticated): void => {
    if (result.verification !== 'COOKIE_BOUND_SESSION_ROUND_TRIP') { setError('로그인 확인 근거가 일치하지 않아 전략 연결을 차단했습니다.'); return }
    recordSessionOffer(result, 'ACK_CONFIRMED')
  }
  const sessionRecovered = (result: NativeSessionRecovery): void => {
    if (result.verification !== 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED') { setError('세션 복구 근거가 일치하지 않아 전략 연결을 차단했습니다.'); return }
    recordSessionOffer(result, 'HANDOFF_UNVERIFIED')
  }
  const emailAuthenticated = (result: NativeEmailAuthenticated): void => {
    if (result.verification !== 'EMAIL_CODE_COOKIE_BOUND_SESSION_ROUND_TRIP') { setError('이메일 로그인 확인 근거가 일치하지 않아 전략 연결을 차단했습니다.'); return }
    recordSessionOffer(result, 'EMAIL_CONFIRMED')
  }
  const claim = async () => {
    const offered = authReceipt.current
    if (!offered?.result.claimIntent?.initiatingSessionEtag || session.current?.sessionId !== offered.result.sessionId || phase !== 'ready') return
    const generation = epoch.current
    await start({ ...base(), kind: 'CLAIM', initiatingSessionId: offered.result.claimIntent.initiatingSessionId,
      // Claim's If-Match belongs to the pre-login ANONYMOUS resource, not the
      // current authenticated session. Consume only its observed server ETag.
      expectedSessionRevision: offered.result.claimIntent.expectedSessionRevision, ifMatch: offered.result.claimIntent.initiatingSessionEtag,
      ...(offered.conversationId ? { conversationId: offered.conversationId } : {}) }, async () => {
      // Only a new explicit claim gets this preflight. Pending same-key replay
      // continues through execute with its existing in-memory CSRF context.
      const assertOffer = () => { if (generation !== epoch.current || authReceipt.current !== offered || logoutIntent.current) throw new Error('SESSION_CHANGED') }
      const rejectBinding = (): never => {
        clients.setCsrf(null); bindSession(null); setSessionState(null); setPhase('error')
        authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false); setLoginRetained(false)
        clearViews(); epoch.current++; throw new Error('SESSION_CHANGED')
      }
      const current = await clients.session.current(); assertOffer()
      if (current.body.data.state !== 'AUTHENTICATED' || current.body.data.sessionId !== offered.result.sessionId || !current.etag) rejectBinding()
      const token = await clients.session.csrf(), confirmed = await clients.session.current(); assertOffer()
      if (confirmed.body.data.state !== 'AUTHENTICATED' || confirmed.body.data.sessionId !== current.body.data.sessionId
        || confirmed.body.data.revision !== current.body.data.revision || confirmed.etag !== current.etag) rejectBinding()
      clients.setCsrf(token.body.data.csrfToken)
    })
  }
  const discardRejectedClaim = () => run(async () => {
    const command = pending.current, generation = epoch.current
    if (command?.kind !== 'CLAIM' || command.idempotencyKey !== rejectedClaimKey) return
    const current = await clients.session.current()
    if (generation !== epoch.current) return
    if (current.body.data.state !== 'AUTHENTICATED' || current.body.data.sessionId !== command.sessionId) {
      clients.setCsrf(null); setSessionState(null); setPhase('error')
      throw new Error('SESSION_CHANGED')
    }
    const token = await clients.session.csrf()
    if (generation !== epoch.current) return
    // This explicit action discards a rejected local request only. No server
    // resource is deleted, claimed, approved or recreated by this handler.
    sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(CONVERSATION_OWNER_KEY)
    clearNativeJournal(); pending.current = null; setHasPending(false)
    epoch.current++; clearViews(); clients.setCsrf(token.body.data.csrfToken)
    authReceipt.current = null; setClaimAvailable(false); setLoginOpen(false); setError(''); setPhase('ready')
  })
  const send = async (text: string, source: 'composer' | 'quick-reply' = 'composer', displayText?: string, researchThread?: NativeResearchThreadOrigin) => {
    if (!text.trim() || working.current || pending.current || busy || hasPending || hasLogout || approval || job || phase !== 'ready') return
    const clientMessageId = `client_message_${crypto.randomUUID()}`
    if (researchThread) {
      if (!conversation || !documentOwner || !session.current
        || documentOwner.sessionId !== session.current.sessionId || documentOwner.sessionState !== sessionState
        || researchThread.scopeId !== JSON.stringify([documentOwner.sessionId, documentOwner.sessionState, conversation.conversationId, conversation.draftId])) return
      const supplied = presentations.researchPresentation?.scope === accountScope && presentations.researchPresentation.data.scopeId === researchThread.scopeId
        ? presentations.researchPresentation.data : undefined
      const ids: readonly string[] = [...RESEARCH_DOCUMENT_SURFACES.map(item => item.id), ...(supplied?.documents ?? []).map(item => item.id), ...(supplied?.typedDocuments ?? []).map(item => item.id)]
      if (!ids.includes(researchThread.documentId)) return
      researchDispatches.current.set(clientMessageId, { ...researchThread })
    }
    if (!conversation && session.current && displayText?.trim() && displayText !== text) {
      submittedQuestion.current = { sessionId: session.current.sessionId, clientMessageId, message: text, displayText }
    }
    try {
      await start(conversation ? { ...draftBase(conversation), kind: 'TURN', body: { ...expected(conversation), clientMessageId, message: text } }
        : { ...base(), kind: 'CREATE_TURN', turnIdempotencyKey: crypto.randomUUID(), clientMessageId, message: text }, undefined, source === 'composer')
    } finally {
      // start may install a pending command after the synchronous null guard.
      const command = pending.current as NativeMutationCommand | null
      const pendingId = command?.kind === 'CREATE_TURN' ? command.clientMessageId : command?.kind === 'TURN' ? command.body.clientMessageId : null
      if (pendingId !== clientMessageId && submittedQuestion.current?.clientMessageId === clientMessageId) submittedQuestion.current = null
      if (pendingId !== clientMessageId) researchDispatches.current.delete(clientMessageId)
    }
  }
  const sendRow = async (scope: string, key: string, label: string) => {
    const row = rowEdits.read(scope, key)
    if (!row?.text.trim()) return
    if (!conversation || !session.current || rowEditScope({ ...session.current, conversationId: conversation.conversationId, draftId: conversation.draftId }) !== scope
      || working.current || emailDispatch.current || pending.current || logoutIntent.current || busy || hasPending || hasLogout || approval || job || phase !== 'ready') {
      rowEdits.mark(scope, key, 'notSent'); return
    }
    if (row.revision !== conversation.conversationStateRevision) { rowEdits.mark(scope, key, 'stale'); return }
    const clientMessageId = `client_message_row_${crypto.randomUUID()}`
    // A visible row label supplies context, not a generated DraftPatch/evidence.
    const message = `${label}: ${row.text}`
    if (message.length > 4000) { rowEdits.mark(scope, key, 'tooLong'); return }
    rowEdits.begin(scope, key, label, clientMessageId, message, conversation.projectionHash, conversation.draftRevision)
    try {
      await start({ ...draftBase(conversation), kind: 'TURN', body: { ...expected(conversation), clientMessageId, message } }, undefined, false)
    } finally {
      // Guards and a failed durable write can resolve start without dispatch.
      // Successful/uncertain responses are observed only in execute above.
      const latest = rowEdits.read(scope, key)
      if (latest?.request?.id === clientMessageId && latest.status === 'sending') rowEdits.mark(scope, key, 'notSent')
    }
  }
  const validate = async () => {
    if (!conversation) return
    setReceipt(null); setChallenge(null); setAcknowledged(false)
    await start({ ...draftBase(conversation), kind: 'VALIDATE', body: expected(conversation) })
  }
  const prepareApproval = async () => {
    if (sessionState !== 'AUTHENTICATED') { await openLogin(); return }
    if (!conversation || !receipt) return
    await start({ ...draftBase(conversation), kind: 'CHALLENGE', body: { ...expected(conversation), validationReceiptId: receipt.validationReceiptId, acknowledgedSemanticHash: receipt.semanticHash } })
  }
  const approve = async () => {
    if (!acknowledged || !conversation || !receipt || !challenge || sessionState !== 'AUTHENTICATED') return
    if (receipt.validationReceiptId !== challenge.validationReceiptId || receipt.semanticHash !== challenge.semanticHash) return
    await start({ ...draftBase(conversation), kind: 'APPROVE', body: { ...expected(conversation), validationReceiptId: receipt.validationReceiptId,
      approvalChallengeId: challenge.approvalChallengeId, acknowledgedSemanticHash: receipt.semanticHash } })
  }
  const submit = async () => {
    if (!approval || !conversation) return
    await start({ ...base(), kind: 'SUBMIT', conversationId: conversation.conversationId, body: { strategyVersionId: approval.strategyVersionId,
      expectedSemanticHash: approval.semanticHash, profileId: 'INTERNAL_POC_FULL' } }, selectedHistoryOwner ? async () => {
      await confirmHistoryDraft(selectedHistoryOwner, approval)
    } : undefined)
  }
  const observeHistoryOwner = async (conversationId: string, expectedOwner?: HistoryOwner): Promise<HistoryOwner> => {
    const generation = epoch.current, bound = session.current
    if (!bound || bound.sessionState !== 'AUTHENTICATED') throw new Error('HISTORY_REQUIRES_AUTHENTICATION')
    const invalidate = () => { epoch.current++; clients.setCsrf(null); bindSession(null); setSessionState(null); clearViews(); setPhase('error') }
    const response = await clients.session.current().catch(failure => {
      if (generation === epoch.current && failure instanceof ApiResponseError && failure.status === 401) invalidate()
      throw failure
    }), current = response.body.data
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    if (current.state !== 'AUTHENTICATED' || current.sessionId !== bound.sessionId || typeof response.etag !== 'string'
      || (expectedOwner && (current.sessionId !== expectedOwner.sessionId || current.revision !== expectedOwner.revision || response.etag !== expectedOwner.etag || conversationId !== expectedOwner.conversationId))) {
      invalidate()
      throw new Error('SESSION_CHANGED')
    }
    return { sessionId: current.sessionId, revision: current.revision, etag: response.etag, conversationId }
  }
  const confirmHistoryDraft = async (owner: HistoryOwner, value: StrategyApproval) => {
    const generation = epoch.current
    await observeHistoryOwner(owner.conversationId, owner)
    const current = await clients.conversation.getConversation(owner.conversationId)
    await observeHistoryOwner(owner.conversationId, owner)
    if (generation !== epoch.current || current.body.data.conversationId !== owner.conversationId) throw new Error('BINDING_CONFLICT')
    if (!approvalMatchesDraft(value, current.body.data)) {
      remember(current.body.data, current.etag); setApproval(null); setSelectedHistoryOwner(null); setReceipt(null); setChallenge(null); setAcknowledged(false)
      throw Object.assign(new Error('SNAPSHOT_CHANGED'), { code: 'SNAPSHOT_CHANGED' })
    }
    remember(current.body.data, current.etag)
  }
  const loadHistory = (direction: 'first' | 'next' | 'previous' = 'first') => runHistory(async () => {
    if (!conversation || logoutIntent.current || phase !== 'ready') return
    if (session.current?.sessionState !== 'AUTHENTICATED') {
      setError('로그인 후 실행 이력을 확인할 수 있습니다. 현재 전략 초안과 검증 상태는 유지합니다.')
      return
    }
    if (direction !== 'first' && (!history || !historyOwner.current || historyNeedsRefresh)) return
    if (direction === 'next' && !history?.nextCursor) return
    if (direction === 'previous' && historyNavigation.index <= 0) return
    const cursor = direction === 'first' ? undefined : direction === 'next' ? history!.nextCursor
      : historyNavigation.cursors[historyNavigation.index - 1]
    const generation = epoch.current
    const owner = await observeHistoryOwner(conversation.conversationId, direction === 'first' ? undefined : historyOwner.current ?? undefined)
    let value: History
    try {
      value = (await clients.native.history.call('listNativeConversationHistoryV8', { conversationId: conversation.conversationId, limit: 50, ...(cursor ? { cursor } : {}) })).data
    } catch (failure) {
      if (generation !== epoch.current) return
      const code = failure && typeof failure === 'object' && 'code' in failure ? String(failure.code) : ''
      if (code === 'AUTHENTICATION_REQUIRED' || code === 'FORBIDDEN') {
        historyOwner.current = null; setHistory(null); setHistoryNavigation({ cursors: [], index: 0, offset: 0 })
        setHistoryNotice('historyAccessLostNotice')
        throw failure
      }
      const refresh = ['SNAPSHOT_CHANGED', 'CURSOR_INVALID', 'SOURCE_VERIFICATION_FAILED'].includes(code)
      setHistoryNeedsRefresh(required => required || refresh)
      setHistoryNotice(refresh ? 'historyPositionChangedNotice' : 'historyPageFailedNotice')
      return
    }
    await observeHistoryOwner(conversation.conversationId, owner)
    if (generation !== epoch.current) return
    if (direction !== 'first' && history?.snapshotRevision !== value.snapshotRevision) {
      setHistoryNeedsRefresh(true); setHistoryNotice('historySnapshotChangedNotice')
      return
    }
    let navigation: HistoryNavigation = { cursors: [undefined], index: 0, offset: 0 }
    if (direction === 'previous') navigation = { ...historyNavigation, index: historyNavigation.index - 1 }
    if (direction === 'next') {
      // Only opaque request positions, never cached rows or durable authority.
      const cursors = [...historyNavigation.cursors.slice(0, historyNavigation.index + 1), cursor]
      const dropped = Math.max(0, cursors.length - MAX_HISTORY_CURSORS)
      navigation = { cursors: cursors.slice(dropped), index: cursors.length - dropped - 1, offset: historyNavigation.offset + dropped }
    }
    historyOwner.current = owner
    setHistory(value); setHistoryNavigation(navigation); setHistoryNotice(''); setHistoryNeedsRefresh(false)
  })
  const selectHistoryRow = (row: History['rows'][number], onSelected?: () => void) => runHistory(async () => {
    const owner = historyOwner.current, generation = epoch.current
    if (!owner || !conversation || !history?.rows.includes(row) || historyNeedsRefresh || pending.current || logoutIntent.current || phase !== 'ready'
      || history.conversationId !== conversation.conversationId || row.approval.sourceConversationId !== conversation.conversationId) return
    if (row.job) await observeHistoryOwner(conversation.conversationId, owner)
    else await confirmHistoryDraft(owner, row.approval)
    if (generation !== epoch.current) return
    closePaper(); closeSmoke()
    presentationIntent.invalidate(); setAutomaticPresentation(undefined)
    setReceipt(null); setChallenge(null); setAcknowledged(false)
    setRetainedResult(null)
    setApproval(row.approval)
    setResultStatus(previous => previous?.backtestId === row.job?.backtestId ? previous : null)
    setJob(row.job); setSelectedHistoryOwner(owner); setEditingNotice(false)
    onSelected?.()
  })
  const editCurrentDraft = async () => {
    let confirmed = false
    await run(async () => {
      if (!conversation || (!approval && !job) || pending.current || logoutIntent.current || phase !== 'ready') return
      const generation = epoch.current
      const owner = await observeHistoryOwner(conversation.conversationId, selectedHistoryOwner ?? undefined)
      const current = await clients.conversation.getConversation(conversation.conversationId)
      await observeHistoryOwner(conversation.conversationId, owner)
      if (generation !== epoch.current) return
      if (current.body.data.conversationId !== conversation.conversationId || current.body.data.draftId !== conversation.draftId) throw new Error('BINDING_CONFLICT')
      if (job?.state === 'COMPLETED' && resultStatus?.backtestId === job.backtestId && resultStatus.reportReady) {
        setRetainedResult({ job, owner, draftId: conversation.draftId })
      }
      // Leave the active job, not its server lifetime. A confirmed completed
      // result can remain read-only, separate from the editable draft. Epoch fences
      // a poll already in flight before React cleans up the previous job effect.
      epoch.current++
      remember(current.body.data, current.etag)
      setApproval(null); setResultStatus(null); setJob(null); setSelectedHistoryOwner(null); setReceipt(null); setChallenge(null); setAcknowledged(false); setDiff([])
      setEditingNotice(true)
      confirmed = true
    })
    return confirmed
  }
  const editFromResult = async () => {
    if (working.current || emailDispatch.current) return
    const origin = window.location.href
    const trigger = document.activeElement
    const frame = trigger?.closest('.native-analysis-layout')
    const navigation = new AbortController()
    let moved = false
    const cancelNavigation = () => { moved = true }
    const choseControl = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest('button,a[href],[role="tab"],input,textarea,select,[contenteditable="true"]') : null
      if (target && target !== trigger) moved = true
    }
    // A slow server read must not pull the user back from a later navigation.
    // Cancel presentation only; the SDK operation retains its original lifetime.
    // AT/voice activation can emit a click without pointer or keyboard events.
    // Registration happens after this action's document capture phase.
    // Scrolling/reading is not a request to abandon the edit destination.
    document.addEventListener('click', choseControl, { capture: true, signal: navigation.signal })
    document.addEventListener('focusin', choseControl, { capture: true, signal: navigation.signal })
    window.addEventListener('popstate', cancelNavigation, { signal: navigation.signal })
    window.addEventListener('hashchange', cancelNavigation, { signal: navigation.signal })
    try {
      const confirmed = await editCurrentDraft()
      if (confirmed && !moved && frame?.isConnected && window.location.href === origin) setComposerRequest({})
    } finally { navigation.abort() }
  }
  const refreshJob = async () => {
    if (!job || working.current) return
    const generation = epoch.current
    if (jobPolling.current?.job === job) {
      // A status GET does not own the conversation's mutation lock. Only this
      // refresh control waits; navigation can retire the observation normally.
      setRefreshingJob(job)
      try {
        const outcome = await jobPolling.current.control.refresh()
        if (generation === epoch.current && outcome?.ok === false) {
          if (!clients.getCsrf()) setPhase('error')
          if (authenticationRequired(outcome.failure)) {
            // Preserve the pre-existing manual GET authentication boundary without
            // placing an unrelated background read under the mutation busy lock.
            clients.setCsrf(null); setPhase('error'); setSessionState(null)
            setError('AUTHENTICATION_REQUIRED · 응답을 확인하지 못했습니다. 같은 요청으로 재개하거나 세션과 서버 이력을 확인해주세요.')
          }
        }
      }
      finally { if (generation === epoch.current) setRefreshingJob(current => current === job ? null : current) }
      return
    }
    await run(async () => {
      const value = await clients.native.jobs.call('getNativeBacktestV7', { backtestId: job.backtestId })
      if (generation === epoch.current) {
        assertSameJob(value.data, job)
        const display = presentationIntent.observe(value.data)
        if (display) setAutomaticPresentation(display)
        setJob(value.data)
      }
    })
  }
  const openPaper = () => run(async () => {
    if (!approval || !conversation || pending.current || logoutIntent.current || phase !== 'ready' || sessionState !== 'AUTHENTICATED') return
    closePaper(); closeSmoke()
    const generation = epoch.current
    const owner = await observeHistoryOwner(conversation.conversationId, selectedHistoryOwner ?? undefined)
    await confirmHistoryDraft(owner, approval)
    if (generation !== epoch.current) return
    setPaperBinding({ owner, epoch: generation, generation: ++paperGeneration.current,
      scope: { sessionId: owner.sessionId, strategyVersionId: approval.strategyVersionId,
        semanticHash: approval.semanticHash, strategyVersionContentHash: approval.strategyVersionContentHash } })
  })
  const paperCurrent = (binding: NonNullable<typeof paperBinding>) => binding.epoch === epoch.current
    && binding.generation === paperGeneration.current && binding.owner.sessionId === session.current?.sessionId
    && session.current.sessionState === 'AUTHENTICATED' && !pending.current && !logoutIntent.current && !working.current
  const verifyPaperOwner = async (binding: NonNullable<typeof paperBinding>, mutation: boolean) => {
    if (!paperCurrent(binding)) throw new Error('PAPER_NATIVE_OWNER_CHANGED')
    try {
      await observeHistoryOwner(binding.owner.conversationId, binding.owner)
      const token = mutation ? (await clients.session.csrf()).body.data.csrfToken : ''
      await observeHistoryOwner(binding.owner.conversationId, binding.owner)
      if (!paperCurrent(binding)) throw new Error('PAPER_NATIVE_OWNER_CHANGED')
      return token
    } catch (failure) {
      // This child read is outside run(). If its fresh owner check invalidated
      // the app, retain an explanation after the child has been unmounted.
      if (!session.current && epoch.current === binding.epoch + 1) setError('현재 로그인이 변경되어 Paper 내용을 숨겼습니다. 이전 요청 기록과 서버 실행을 삭제하거나 취소하지 않았습니다.')
      throw failure
    }
  }
  const openSmoke = () => run(async () => {
    if (!approval || !conversation || pending.current || logoutIntent.current || phase !== 'ready' || sessionState !== 'AUTHENTICATED') return
    closeSmoke(); closePaper()
    const generation = epoch.current
    const owner = await observeHistoryOwner(conversation.conversationId, selectedHistoryOwner ?? undefined)
    await confirmHistoryDraft(owner, approval)
    const profileContentHash = readApiAdapterConfig(document).structuralSmokeProfileContentHash
    if (generation !== epoch.current) return
    // Fixed field order is also the module journal namespace. Never spread
    // caller input or a stored response into this four-field binding.
    const binding = { sessionId: owner.sessionId, strategyVersionId: approval.strategyVersionId, semanticHash: approval.semanticHash, profileContentHash }
    setSmokeBinding({ owner, binding, contentHash: approval.strategyVersionContentHash, epoch: generation, generation: ++smokeGeneration.current })
  })
  const smokeCurrent = (binding: NonNullable<typeof smokeBinding>) => binding.epoch === epoch.current
    && binding.generation === smokeGeneration.current && binding.owner.sessionId === session.current?.sessionId
    && session.current.sessionState === 'AUTHENTICATED' && !pending.current && !logoutIntent.current
  // Parent activity is temporary dispatch unavailability, not ownership loss.
  // The Panel still includes it in the existing module's per-read/write fence.
  const smokeDispatchAvailable = () => !working.current
  const verifySmokeOwner = async (binding: NonNullable<typeof smokeBinding>) => {
    if (!smokeCurrent(binding)) throw new Error('SMOKE_CONTEXT_CHANGED')
    try {
      await observeHistoryOwner(binding.owner.conversationId, binding.owner)
      if (!smokeCurrent(binding)) throw new Error('SMOKE_CONTEXT_CHANGED')
    } catch (failure) {
      if (!session.current && epoch.current === binding.epoch + 1) setError('현재 로그인이 변경되어 구조 시험 내용을 숨겼습니다. 이전 요청 기록과 서버 작업을 삭제하거나 취소하지 않았습니다.')
      throw failure
    }
  }
  const observeNavigationOwner = async (expectedOwner?: { sessionId: string; state: string; revision: string; etag: string }) => {
    const generation = epoch.current, bound = session.current
    if (!bound) throw new Error('SESSION_CHANGED')
    const invalidate = () => { epoch.current++; clients.setCsrf(null); bindSession(null); setSessionState(null); setPreviousConversation(null); clearViews(); setPhase('error') }
    const response = await clients.session.current().catch(failure => {
      if (generation === epoch.current && failure instanceof ApiResponseError && failure.status === 401) invalidate()
      throw failure
    }), value = response.body.data
    if (generation !== epoch.current) throw new Error('SESSION_CHANGED')
    if (value.sessionId !== bound.sessionId || value.state !== bound.sessionState || typeof response.etag !== 'string'
      || (expectedOwner && (value.sessionId !== expectedOwner.sessionId || value.state !== expectedOwner.state || value.revision !== expectedOwner.revision || response.etag !== expectedOwner.etag))) {
      invalidate(); throw new Error('SESSION_CHANGED')
    }
    return { sessionId: value.sessionId, state: value.state, revision: value.revision, etag: response.etag }
  }
  const navigateConversation = async (restore: boolean): Promise<boolean> => {
    let accepted = false
    await run(async () => {
      if (pending.current || logoutIntent.current || phase !== 'ready') return
      const bound = session.current, generation = epoch.current
      if (!bound) return
      const target = restore ? previousConversation : null
      if (restore && (!target || target.sessionId !== bound.sessionId || target.conversationId === conversation?.conversationId)) return
      if (!restore && !conversation) return
      setNavigationError('')
      const owner = await observeNavigationOwner()
      let restored: Awaited<ReturnType<typeof clients.conversation.getConversation>> | null = null
      try { if (target) restored = await clients.conversation.getConversation(target.conversationId) }
      finally { await observeNavigationOwner(owner) }
      if (generation !== epoch.current) return
      if (restored && restored.body.data.conversationId !== target!.conversationId) throw new Error('BINDING_CONFLICT')
      const prior = conversation ? { sessionId: bound.sessionId, conversationId: conversation.conversationId } : null
      try { changeConversationLocators(target, prior) }
      catch (failure) {
        setNavigationError(failure instanceof Error && failure.message === 'PREVIOUS_CONVERSATION_ROLLBACK_UNCONFIRMED'
          ? 'rollback' : 'write')
        return
      }
      epoch.current++; clearViews(false, true); setError(''); setPreviousConversation(prior)
      if (restored) remember(restored.body.data, restored.etag, false)
      accepted = true
    })
    return accepted
  }
  const snapshot = conversation?.draftState.projection
  const rejectedClaim = hasPending && rejectedClaimKey !== null
  const historyPreviousDisabled = busy || hasLogout || historyNavigation.index === 0 || historyNeedsRefresh
  const historyFirstDisabled = busy || hasLogout
  const historyNextDisabled = busy || hasLogout || historyNeedsRefresh
  // One controller, one visible list. The source history hub may display this
  // subset, but it cannot create account-wide records or bypass row guards.
  const renderHistory = (onSelected?: () => void) => conversation && <>
    {history && <section className="native-history-panel" aria-label={jobText('historyTitle')}>
      {!onSelected && <h3>{jobText('historyTitle')}</h3>}
      <p className="native-history-page">{jobText('historyPage', { page: historyNavigation.offset + historyNavigation.index + 1 })}</p>
      <p className="native-history-help">{jobText('historyPageSizeNotice')}</p>
      <p className="native-history-help">{jobText('historySnapshotNotice')}</p>
      {historyNavigation.offset > 0 && <p>{jobText('historyCursorLimitNotice')}</p>}
      {historyNeedsRefresh && <p>{jobText('historyRefreshRequiredNotice')}</p>}
      <NativeHistoryList rows={history.rows}
        selectedRow={selectedHistoryOwner && approval
          ? { strategyVersionId: approval.strategyVersionId, backtestId: job?.backtestId ?? null } : undefined}
        getSelectionDisabled={row => busy || hasPending || hasLogout || historyNeedsRefresh || (!row.job && !approvalMatchesDraft(row.approval, conversation))}
        getSelectionNotice={row => !row.job && !approvalMatchesDraft(row.approval, conversation)
          ? jobText('historyApprovalMismatchNotice') : undefined}
        onSelect={row => void selectHistoryRow(row, onSelected)} />
      <nav className="native-history-navigation" aria-label={jobText('historyNavigationLabel')}>
        <button className="g-qchip" aria-disabled={historyPreviousDisabled} onClick={() => { if (!historyPreviousDisabled) void loadHistory('previous') }}>{jobText('historyPrevious')}</button>
        <button className="g-qchip" aria-disabled={historyFirstDisabled} onClick={() => { if (!historyFirstDisabled) void loadHistory() }}>{jobText('historyFirst')}</button>
        {history.nextCursor && <button className="g-qchip" aria-disabled={historyNextDisabled} onClick={() => { if (!historyNextDisabled) void loadHistory('next') }}>{jobText('historyNext')}</button>}
      </nav>
    </section>}
  </>
  // Only this exact pre-dispatch CREATE error belongs beside the unchanged
  // home composer. A later session warning must keep its existing workflow.
  const inlineHomeFailure = Boolean(error && error === homeInputFailure && phase === 'ready' && !hasPending)
  // Initial connection failure is not a conversation. Only the mount catch
  // creates this hint; confirmed recovery retires it. Later authority failures
  // and pending commands retain their existing recovery workflow.
  const initialHomeFailure = initialConnectionFailed && initialHome && !conversation && !hasPending && !hasLogout
    && !loginOpen && !loginRetained && !claimAvailable
  const showRecoveryWorkflow = Boolean((error && !inlineHomeFailure && !initialHomeFailure) || claimAvailable)
  const workflow = conversation ? <section className="native-strategy-workflow" aria-label={workflowText('summary')} ref={workflowElement}
    onClickCapture={event => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-workflow-action]')
      if (target && target.getAttribute('aria-disabled') !== 'true') workflowFocus.current = document.activeElement === target ? target : null
    }}
    onFocusCapture={event => { if (event.target !== workflowFocus.current) workflowFocus.current = null }}>
    <h2>{workflowText('draft')}</h2>
    <dl className="native-workflow-rows">
      <div className="native-workflow-row"><dt>{workflowText('target')}</dt><dd>{snapshot?.market?.symbol ?? workflowText('pairUnset')} · {snapshot?.clock?.timeframe ?? workflowText('timeframeUnset')} · {nativeWorkflowLeverage(language, snapshot?.execution?.leverage)}</dd></div>
      <div className="native-workflow-row"><dt>{workflowText('orderAmount')}</dt><dd>{snapshot?.positionSizing?.amount ?? workflowText('unset')} USDT</dd></div>
    </dl>
    <p className="native-workflow-note">{workflowText('changes', { changes: diff.length ? diff.join(', ') : workflowText('noChanges') })}</p>
    <details className="native-workflow-source"><summary>{workflowText('source')}</summary><pre tabIndex={0}>{JSON.stringify(snapshot, null, 2)}</pre></details>
    {conversation.unresolvedCapabilityBlockers.length > 0 && <p className="native-workflow-notice" role="alert">{workflowText('blockers', { reasons: conversation.unresolvedCapabilityBlockers.map(item => item.reasonCode).join(', ') })}</p>}
    <div className="native-workflow-actions">
      {!approval && <WorkflowButton className={`native-workflow-button ${receipt ? 'is-secondary' : 'is-primary'}`} disabled={busy || hasPending || conversation.candidateState !== 'READY_FOR_VALIDATION'} onClick={() => void validate()}>{workflowText('validate')}</WorkflowButton>}
    </div>
    {receipt && !approval && <div className="native-workflow-stage"><p className="native-workflow-note" tabIndex={-1} data-workflow-focus>{workflowText('validated', { expiresAt: receipt.expiresAt })}</p>
      {!challenge ? <div className="native-workflow-actions"><WorkflowButton className="native-workflow-button is-primary" disabled={busy || hasPending} onClick={() => void prepareApproval()}>{workflowText(sessionState === 'AUTHENTICATED' ? 'reviewApproval' : 'loginContinue')}</WorkflowButton></div> : <>
        <label className="native-workflow-consent"><input type="checkbox" checked={acknowledged} disabled={busy || hasPending} onChange={event => setAcknowledged(event.target.checked)} /><span>{workflowText('consent')}</span></label>
        <p className="native-workflow-note">{workflowText('costs')}</p>
        <p className="native-workflow-binding">{workflowText('approvalTarget')} <code>{challenge.semanticHash}</code></p>
        <div className="native-workflow-actions"><WorkflowButton className="native-workflow-button is-primary" disabled={!acknowledged || busy || hasPending} onClick={() => void approve()}>{workflowText('approve')}</WorkflowButton></div>
      </>}
    </div>}
    {approval && <div className="native-workflow-stage"><p className="native-workflow-binding" tabIndex={-1} data-workflow-focus>{workflowText('approvedVersion')} <code>{approval.strategyVersionId}</code></p>
      {!job && <div className="native-workflow-actions"><WorkflowButton className="native-workflow-button is-primary" disabled={busy || hasPending} onClick={() => void submit()}>{workflowText('submit')}</WorkflowButton></div>}
    </div>}
    <div className="native-workflow-utilities">
      <div className="native-workflow-actions">
        {approval && sessionState === 'AUTHENTICATED' && <button className="native-workflow-button is-secondary" disabled={busy || hasPending || hasLogout || phase !== 'ready'} onClick={() => void openPaper()}>{workflowText('paper')}</button>}
        {approval && sessionState === 'AUTHENTICATED' && <button className="native-workflow-button is-secondary" disabled={busy || hasPending || hasLogout || phase !== 'ready'} onClick={() => void openSmoke()}>{workflowText('smoke')}</button>}
        {(approval || job) && <button className="native-workflow-button is-text" disabled={busy || hasPending || hasLogout || phase !== 'ready'} onClick={() => void editCurrentDraft()}>{workflowText('edit')}</button>}
      </div>
      {(approval || job) && <p className="native-workflow-note">{workflowText('editNotice')}</p>}
      {editingNotice && <p className="native-workflow-notice" role="status">{workflowText('editingReady')}</p>}
      {selectedHistoryOwner && approval && <p className="native-workflow-note" data-native-history-selection tabIndex={-1} role="status">{jobText('historySelectedApprovalNotice', { approved: approval.sourceDraftRevision, current: conversation.draftRevision })}</p>}
      <div className="native-workflow-actions"><button className="native-workflow-button is-text" disabled={busy || hasLogout} onClick={() => void loadHistory()}>{jobText('historyOpen')}</button></div>
    </div>
  </section> : showRecoveryWorkflow ? <section aria-label={workflowText('recoveryLabel')}><h2>{workflowText('recoveryTitle')}</h2><p>{workflowText('recoveryNotice')}</p></section> : null
  const panelCurrent = () => loginBinding !== null && loginBinding.epoch === epoch.current && loginBinding.generation === loginGeneration.current
    && loginBinding.sessionId === session.current?.sessionId && !logoutIntent.current
  const researchEntries = useMemo(() => observedResearchEntries(messages.flatMap(message => message.observation ? [message.observation] : []), language), [messages, language])
  const strategyEditor = documentOwner && conversation ? {
        rows: rowEdits.store[rowEditScope(documentOwner)] ?? {},
        disabled: busy || emailBusy || hasPending || hasLogout || Boolean(approval || job),
        onOpen: (key: string, open: boolean) => rowEdits.open(rowEditScope(documentOwner), key, conversation.conversationStateRevision, open),
        onChange: (key: string, text: string) => rowEdits.change(rowEditScope(documentOwner), key, text, conversation.conversationStateRevision),
        onSubmit: (key: string, label: string) => { void sendRow(rowEditScope(documentOwner), key, label) },
      } : undefined
  const renderResearch = (actions: ReactNode) => conversation ? <NativeStrategyDocument snapshot={conversation} researchPlan editor={strategyEditor} planActions={actions} /> : null
  const strategyDocument = phase === 'ready' && !hasLogout && conversation && documentOwner
    && documentOwner.sessionState === sessionState
    && documentOwner.conversationId === conversation.conversationId && documentOwner.draftId === conversation.draftId
    ? { identity: JSON.stringify([documentOwner.sessionId, documentOwner.sessionState, documentOwner.conversationId, documentOwner.draftId]),
      content: renderResearch(null), renderResearch } : undefined
  const currentResultStatus = resultStatus?.backtestId === job?.backtestId ? resultStatus : null
  const resultStateKeys = { loading: 'resultChecking', ready: 'resultReady', error: 'resultNeedsCheck' } as const satisfies Record<NativeServiceResultStatus['state'], NativeJobTextKey>
  const jobPresentation = job ? describeNativeJob(job, language) : null
  const conversationNotice = strategyDocument && job ? <span data-native-result-status={currentResultStatus?.state}>
    {jobPresentation?.label}{jobPresentation?.invalidReason && <> · {jobPresentation.invalidReason.label}</>}
    {job.state === 'COMPLETED' && <> · {jobText(resultStateKeys[currentResultStatus?.state ?? 'loading'])}</>}
  </span> : undefined
  const observeResultStatus = useCallback((status: NativeServiceResultStatus) => {
    if (phase !== 'ready' || hasLogout || status.backtestId !== job?.backtestId) return
    setResultStatus(previous => previous?.backtestId === status.backtestId && previous.state === status.state && previous.label === status.label && previous.reportReady === status.reportReady ? previous : status)
  }, [phase, hasLogout, job?.backtestId])
  const retainedMatches = retainedResult && documentOwner && conversation
    && documentOwner.sessionState === 'AUTHENTICATED' && sessionState === 'AUTHENTICATED'
    && retainedResult.owner.sessionId === documentOwner.sessionId
    && retainedResult.owner.conversationId === conversation.conversationId
    && retainedResult.draftId === conversation.draftId
  const analysisJob = phase === 'ready' && !hasLogout && conversation && documentOwner
    ? job?.state === 'COMPLETED' ? job : retainedMatches ? retainedResult.job : null : null
  const authSurface = (loginOpen || loginRetained) && loginBinding !== null && sessionState !== null && phase !== 'error' && !hasLogout && <NativeAuthSurface open={loginOpen}><NativeLoginPanel
    key={`${loginBinding.sessionId}:${sessionState}:${loginBinding.generation}`} hidden={!loginOpen} resumeToken={loginResume}
    onAuthenticated={value => { if (panelCurrent()) authenticated(value) }} onSessionRecovered={value => { if (panelCurrent()) sessionRecovered(value) }}
    expectedSessionId={loginBinding.sessionId} isCurrent={panelCurrent} onEmailAuthenticated={value => { if (panelCurrent()) emailAuthenticated(value) }}
    canEmailDispatch={!busy && !hasPending && !hasLogout && phase === 'ready'} acquireEmailDispatch={() => {
      if (working.current || emailDispatch.current || pending.current || logoutIntent.current || phase !== 'ready' || !panelCurrent()) return null
      const owner = {}; emailDispatch.current = owner; setEmailBusy(true)
      return () => { if (emailDispatch.current === owner) { emailDispatch.current = null; setEmailBusy(false) } }
    }}
    onClose={retain => { setLoginRetained(Boolean(retain)); setLoginOpen(false); closeClientSettingsRoute() }} /></NativeAuthSurface>
  return <ClientServiceExperience loadingHome={(initializing && initialHome) || initialHomeFailure} accountScope={accountScope} composerRequest={composerRequest} state={{ phase, sessionState, messages, input, busy, source: 'service', recovery: null,
    inputDisabled: busy || emailBusy || hasPending || hasLogout || phase !== 'ready' || Boolean(approval || job), quickReplies: conversation?.nextQuestion?.options ?? [],
    workflow: hasLogout ? <section aria-label="로그아웃 요청"><h2>로그아웃 요청 확인</h2><p>이전 세션의 요청 기록은 로그인 권한이나 서버 처리 결과가 아닙니다.</p></section> : workflow,
    outcome: <>{smokeBinding && approval && smokeBinding.binding.strategyVersionId === approval.strategyVersionId
      && smokeBinding.binding.semanticHash === approval.semanticHash && smokeBinding.contentHash === approval.strategyVersionContentHash
      && sessionState === 'AUTHENTICATED' && phase === 'ready' && !hasLogout && !hasPending && <NativeStructuralSmokePanel
        key={`${smokeBinding.generation}:${smokeBinding.binding.sessionId}:${smokeBinding.binding.strategyVersionId}`}
        binding={smokeBinding.binding} isCurrent={() => smokeCurrent(smokeBinding)} canDispatch={smokeDispatchAvailable} verifyOwner={() => verifySmokeOwner(smokeBinding)} onClose={closeSmoke} />}
      {paperBinding && approval && paperBinding.scope.strategyVersionId === approval.strategyVersionId
      && paperBinding.scope.semanticHash === approval.semanticHash && paperBinding.scope.strategyVersionContentHash === approval.strategyVersionContentHash
      && sessionState === 'AUTHENTICATED' && phase === 'ready' && !hasLogout && !hasPending && <NativePaperPanel
        key={`${paperBinding.generation}:${paperBinding.scope.sessionId}:${paperBinding.scope.strategyVersionId}`}
        scope={paperBinding.scope} isCurrent={() => paperCurrent(paperBinding)} verifyOwner={mutation => verifyPaperOwner(paperBinding, mutation)} onClose={closePaper} />}
      {job && <section className="native-job-section" aria-label={jobText('jobProgressRegion')} data-native-job-state={job.state}>
      <NativeJobActivity job={job} />
      {pollIssue?.job === job && <p className="native-job-problem" role={pollIssue.retrying ? 'status' : 'alert'} data-native-polling={pollIssue.retrying ? 'retrying' : 'stopped'}>{jobText(pollIssue.retrying ? 'pollingRetryNotice' : 'pollingStoppedNotice')}</p>}
      <button className="g-qchip native-job-refresh" disabled={busy || refreshingJob === job} onClick={() => void refreshJob()}>{jobText('jobRefresh')}</button>
    </section>}
      {claimAvailable && <section aria-label="로그인 전 전략 연결"><p>로그인은 전략 연결·승인·실행에 대한 동의가 아닙니다.</p>
        <button disabled={busy || hasPending || phase !== 'ready'} onClick={() => void claim()}>로그인 전 전략 연결</button></section>}</>,
    // The journal exists during every normal request. Its presence alone is
    // not an error: show recovery after dispatch settles, or immediately when
    // an explicit error/logout boundary requires attention.
    issue: (error || (hasPending && (!busy || pendingRecoveryVisible)) || hasLogout) && <div role="alert"><p>{rejectedClaim && phase === 'ready' ? '서버가 전략 연결 요청을 거절했습니다(BAD_REQUEST). 이 요청 기록만 폐기하고 현재 로그인으로 새 대화를 시작할 수 있습니다. 기존 서버 전략은 삭제하지 않습니다.' : error || '서버 응답을 확인하고 있습니다. 새 요청을 만들지 않습니다.'}</p>
      {hasComposerRecovery && <p>전송하지 않은 입력은 이 화면의 메모리에 임시 보관했습니다. 같은 세션·대화를 다시 확인하면 작성란에 복원하며 자동 전송하지 않습니다. 페이지 새로고침이나 닫기 후에는 보존되지 않습니다.</p>}
      {hasLogout && <><p>로그아웃은 서버 전략 삭제나 진행 중인 백테스트 취소가 아닙니다. 확인하지 못한 기존 요청은 서버에서 계속될 수 있으며 기록은 보존합니다.</p>
        <button disabled={busy || phase !== 'ready' || logoutBoundary !== null} onClick={() => void logout()}>같은 로그아웃 요청으로 재개</button>
        {logoutBoundary && <button disabled={busy} onClick={() => void newSessionAfterLogout()}>이전 요청 기록을 보존하고 현재 브라우저에서 새 대화 시작</button>}</>}
      {hasPending && !hasLogout && <button disabled={busy || phase !== 'ready' || rejectedClaim} onClick={() => { if (pending.current) void run(() => execute(pending.current!)) }}>같은 요청으로 재개</button>}
      {rejectedClaim && <button disabled={busy || phase !== 'ready'} onClick={() => void discardRejectedClaim()}>연결 요청 기록을 폐기하고 현재 로그인으로 새 대화 시작</button>}</div>,
    onInput: value => { composerRecovery.current = null; setHasComposerRecovery(false); setInput(value) }, onSend: (value, displayText, researchThread) => send(value, 'composer', displayText, researchThread), onReset: () => {
      if (working.current || pending.current || logoutIntent.current || busy || hasPending || hasLogout || phase !== 'ready') {
        setError('확인하지 못한 요청을 먼저 재개하거나 이력에서 확인해주세요.'); return false
      }
      // No server conversation exists yet: this is only a return to the home
      // composer, not a locator transition or implicit conversation creation.
      if (!conversation) return true
      return navigateConversation(false)
    }, onRecover: () => { if (phase === 'logged-out' && logoutBoundary) void newSessionAfterLogout(); else void run(recoverSession) },
    onLogout: sessionState === 'AUTHENTICATED' && !hasLogout ? logout : undefined,
  }} nativeAccounts strategyDocument={strategyDocument} conversationNotice={conversationNotice} authSurface={authSurface}
    analysisPresentationBlocked={loginOpen || claimAvailable || Boolean(paperBinding || smokeBinding) || hasLogout || phase !== 'ready'}
    conversationLibrary={presentations.conversationLibrary} insightPresentation={presentations.insightPresentation}
    sharingPresentation={presentations.sharingPresentation} accountPresentation={presentations.accountPresentation} feedbackPresentation={presentations.feedbackPresentation} brokerPresentation={presentations.brokerPresentation} connectionPresentation={presentations.connectionPresentation}
    researchPresentation={strategyDocument && presentations.researchPresentation?.scope === accountScope && presentations.researchPresentation.data.scopeId === strategyDocument.identity ? presentations.researchPresentation : strategyDocument && accountScope ? { scope: accountScope, data: {
      scopeId: strategyDocument.identity,
      entries: researchEntries,
      // Accepted TURN/VALIDATE records do not prove completion of a multi-agent
      // research run. Keep that state unasserted until its producer exists.
      status: 'unavailable',
    } } : undefined}
    resultActivityKey={`${analysisJob?.backtestId ?? ''}:${currentResultStatus?.state ?? ''}`}
    analysisIdentity={analysisJob?.backtestId}
    clarification={!hasLogout && phase === 'ready' && !approval && !job && conversation?.nextQuestion
      ? { prompt: conversation.nextQuestion.prompt, identity: `${conversation.conversationId}:${conversation.conversationStateRevision}:${conversation.nextQuestion.questionId}` } : null}
    historyFeedback={historyNotice && <p className="native-workflow-notice native-history-feedback" role="alert">{jobText(historyNotice)}</p>}
    navigationFeedback={navigationError && <p className="client-service-recovery" role="alert">{nativeObservationNavigationErrors[language][navigationError]}</p>}
    executionHistory={!hasLogout && conversation && phase === 'ready' && sessionState === 'AUTHENTICATED'
      ? { disabled: busy || hasPending, pending: historyPending, onLoad: () => { void loadHistory() }, render: renderHistory } : undefined}
    analysis={analysisJob && <>
      {analysisJob !== job && <div className="native-retained-result-notice" role="status">{workflowText('priorResult')} <span>{analysisJob.strategyVersionId}</span></div>}
      <NativeServiceResult key={analysisJob.backtestId} api={clients.native} job={analysisJob} embedded previous={analysisJob !== job} onStatusChange={observeResultStatus}
        createReplayReader={createReplayReader}
        automaticPresentation={analysisJob === job ? automaticPresentation : undefined}
        onEditDraft={analysisJob === job ? () => { void editFromResult() } : undefined}
        editDisabled={busy || emailBusy || hasPending || hasLogout || phase !== 'ready' || resultStatus?.backtestId !== analysisJob.backtestId || !resultStatus.reportReady} />
    </>}
    onLogin={() => { void openLogin() }} onHistory={() => { if (!hasLogout) void loadHistory() }} onQuickReply={(value, researchThread) => send(value, 'quick-reply', undefined, researchThread)}
    conversationNavigation={!hasLogout && phase === 'ready' && sessionState !== null && (navigationError || (previousConversation && previousConversation.conversationId !== conversation?.conversationId)) && <section className="client-service-recovery" aria-label={nativeObservationCopy[language].previousLabel}>
      {previousConversation && previousConversation.conversationId !== conversation?.conversationId && <>
        <button className="g-qchip" type="button" disabled={busy || hasPending} onClick={() => void navigateConversation(true)}>{nativeObservationCopy[language].previousAction}</button>
        <p>{nativeObservationCopy[language].previousNote}</p>
      </>}
      {navigationError && <p role="alert">{nativeObservationNavigationErrors[language][navigationError]}</p>}
    </section>}
    serviceNotice="내부 native API 연결입니다. 대화 v0.3·작업 v0.7·이력 v0.8·결과 v0.6·차트 v0.5를 사용합니다. 준비되지 않은 데이터는 오류로 표시하며 Mock으로 대체하지 않습니다. 외부 AI 모델·실제 로그인·거래·공개 배포 완료가 아닙니다." />
}
