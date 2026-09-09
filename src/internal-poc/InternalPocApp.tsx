import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Database,
  FileClock,
  FlaskConical,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type ComponentType } from 'react'
import type {
  BacktestJob,
  ConversationTurnEnvelope,
  DraftState,
  DraftValidationReceipt,
  NextQuestion,
  StrategyApproval,
  Trade,
  TradeManifestEnvelope,
  TradeManifestPageEnvelope,
  VerifiedBacktestReport,
  SourceProvenance,
  StrategyCondition,
  StrategyOperand,
} from './contracts/generated/api-v0.1/index.js'
import { API_V01_UPSTREAM } from './contracts/generated/api-v0.1/upstream'
import { ApiResponseError } from './contracts/generated/api-v0.1/client'
import type { InternalPocAdapter } from './adapter'
import { describeServiceIssue, type ServiceIssue } from './service-status'
import { PaperSessionPanel } from './PaperSessionPanel'
import type { PaperSessionAdapter } from './paper-session'
import type { PaperMarketArtifactCatalogAdapter } from './paper-market-artifact'

const CLIENT_SNAPSHOT_KEY = 'tesia-internal-poc-client-snapshot-v1'
const QUICK_IDEA = 'BTC 15분 RSI 30 아래면 100 USDT 롱, 손절 2%, 익절 5%, 레버리지 2배'

type Message = Readonly<{
  id: string
  role: 'assistant' | 'user'
  text: string
  delivery?: 'pending' | 'answered' | 'uncertain'
}>

/** Internal presentation seam. No credential, SDK or mutable request context. */
export type InternalPocPresentation = Readonly<{
  phase: 'loading' | 'ready' | 'error' | 'logged-out'
  messages: readonly Message[]
  input: string
  busy: boolean
  inputDisabled: boolean
  source: 'service' | 'mock'
  sessionState: 'ANONYMOUS' | 'AUTHENTICATED' | null
  recovery: 'RESTORED' | 'RESET' | null
  quickReplies: readonly string[]
  workflow: ReactNode
  outcome: ReactNode
  issue: ReactNode
  onInput: (value: string) => void
  onSend: (value: string) => Promise<void>
  onReset: () => void
  onRecover: (() => void) | undefined
  onLogout: (() => Promise<void>) | undefined
}>

type ClientSnapshot = Readonly<{
  conversationId: string
  draftId: string
  draftEtag: string
  draftRevision: string
  candidateState?: 'INCOMPLETE' | 'READY_FOR_VALIDATION'
  nextQuestion?: NextQuestion | null
  draftState?: DraftState
  backtestId?: string
  pendingWorkflow?: PendingApprovalWorkflow
}>

type PendingApprovalWorkflow = Readonly<{
  step: 'CHALLENGE' | 'APPROVE' | 'SUBMIT'
  validationReceiptId: string
  semanticHash: string
  challengeId?: string
  strategyVersionId?: string
  challengeIfMatch: string
  approveIfMatch?: string
  challengeIdempotencyKey: string
  approveIdempotencyKey: string
  submitIdempotencyKey: string
}>

type PendingConversation = {
  message: string
  createKey: string
  turnKey: string
  messageId: string
  snapshot: ClientSnapshot | null
}

type ResultBundle = Readonly<{
  report: VerifiedBacktestReport
  manifest: TradeManifestEnvelope['data']
  trades: readonly Trade[]
}>

const RESULT_BINDING_ERROR = 'CROSS_RESOURCE_BACKTEST_BINDING_MISMATCH'
const UINT64_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/
const STRONG_ETAG = /^"[A-Za-z0-9_-]{16,128}"$/
const UINT64_MAX = 18_446_744_073_709_551_615n

const parseUint64Revision = (value: string): bigint | null => {
  if (!UINT64_DECIMAL.test(value)) return null
  try {
    const parsed = BigInt(value)
    return parsed <= UINT64_MAX ? parsed : null
  } catch {
    return null
  }
}

const requireResultBinding = (condition: boolean): void => {
  if (!condition) throw new Error(RESULT_BINDING_ERROR)
}

const assertResultBundleBindings = (
  job: BacktestJob,
  report: VerifiedBacktestReport,
  manifest: TradeManifestEnvelope['data'],
  isPage: TradeManifestPageEnvelope['data'],
  oosPage: TradeManifestPageEnvelope['data'],
): void => {
  requireResultBinding(job.state === 'COMPLETED' && job.resultAvailable)
  requireResultBinding(
    report.backtestId === job.backtestId
    && manifest.backtestId === job.backtestId
    && report.strategyVersionId === job.strategyVersionId
    && report.semanticHash === job.semanticHash
    && report.splitGroupId === job.splitGroupId
    && manifest.splitGroupId === job.splitGroupId
    && report.profileId === job.profileId
    && report.profileContentHash === job.profileContentHash
    && job.resultContentHash === report.reportContentHash,
  )

  const pages = { IS: isPage, OOS: oosPage } as const
  for (const segment of ['IS', 'OOS'] as const) {
    const reportSegment = report.segments.find((candidate) => candidate.segment === segment)
    const manifestSegment = manifest.segments.find((candidate) => candidate.segment === segment)
    const page = pages[segment]
    requireResultBinding(reportSegment !== undefined && manifestSegment !== undefined)
    requireResultBinding(
      reportSegment!.runtimeResult.contentHash === manifestSegment!.resultContentHash
      && reportSegment!.runtimeResult.tradeCount === manifestSegment!.tradeCount
      && reportSegment!.tradeManifestContentHash === manifestSegment!.tradeManifestContentHash
      && page.backtestId === job.backtestId
      && page.segment === segment
      && page.resultContentHash === manifestSegment!.resultContentHash
      && page.tradeManifestContentHash === manifestSegment!.tradeManifestContentHash
      && page.cursorBinding.backtestId === job.backtestId
      && page.cursorBinding.segment === segment
      && page.cursorBinding.resultContentHash === manifestSegment!.resultContentHash
      && page.cursorBinding.tradeManifestContentHash === manifestSegment!.tradeManifestContentHash
      && page.trades.length <= manifestSegment!.tradeCount,
    )
  }
}

const idempotencyKey = (): string => `idem_${crypto.randomUUID().replaceAll('-', '_')}`
const clientMessageId = (): string => `client_message_${crypto.randomUUID().replaceAll('-', '_')}`

const isStoredNextQuestion = (value: unknown): value is NextQuestion | null => {
  if (value === null) return true
  if (typeof value !== 'object' || value === undefined) return false
  const question = value as Record<string, unknown>
  return typeof question.questionId === 'string'
    && typeof question.prompt === 'string'
    && Array.isArray(question.options)
    && question.options.every((option) => typeof option === 'string')
    && (typeof question.targetPath === 'string' || typeof question.targetField === 'string')
}

const isStoredDraftState = (value: unknown): value is DraftState => {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  const projection = draft.projection as Record<string, unknown> | undefined
  return draft.contractVersion === '0.2.0'
    && typeof draft.draftId === 'string'
    && Number.isInteger(draft.revision)
    && typeof draft.projectionHash === 'string'
    && typeof projection === 'object'
    && projection !== null
    && Array.isArray(projection.features)
    && Array.isArray(projection.entryRules)
    && Array.isArray(projection.exitRules)
    && typeof projection.stateRules === 'object'
    && projection.stateRules !== null
    && typeof projection.riskLimits === 'object'
    && projection.riskLimits !== null
}

const isDraftReadyForValidation = (draft: DraftState): boolean => {
  const strategy = draft.projection
  const exitKinds = new Set(strategy.exitRules.map((rule) => rule.kind))
  return strategy.market !== undefined
    && strategy.clock !== undefined
    && strategy.features.length > 0
    && strategy.entryRules.length > 0
    && strategy.positionSizing !== undefined
    && strategy.execution !== undefined
    && exitKinds.has('stop_loss')
    && exitKinds.has('take_profit')
}

const readSnapshot = (): ClientSnapshot | null => {
  try {
    const raw = sessionStorage.getItem(CLIENT_SNAPSHOT_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<ClientSnapshot>
    if (
      typeof parsed.conversationId !== 'string'
      || typeof parsed.draftId !== 'string'
      || typeof parsed.draftEtag !== 'string'
      || typeof parsed.draftRevision !== 'string'
      || (parsed.candidateState !== undefined && !['INCOMPLETE', 'READY_FOR_VALIDATION'].includes(parsed.candidateState))
      || (parsed.nextQuestion !== undefined && !isStoredNextQuestion(parsed.nextQuestion))
      || (parsed.draftState !== undefined && !isStoredDraftState(parsed.draftState))
      || (parsed.backtestId !== undefined && typeof parsed.backtestId !== 'string')
    ) return null
    if (parsed.pendingWorkflow !== undefined) {
      const pending = parsed.pendingWorkflow as Partial<PendingApprovalWorkflow>
      if (
        pending === null
        || typeof pending !== 'object'
        || !['CHALLENGE', 'APPROVE', 'SUBMIT'].includes(pending.step ?? '')
        || typeof pending.validationReceiptId !== 'string'
        || typeof pending.semanticHash !== 'string'
        || typeof pending.challengeIfMatch !== 'string'
        || (pending.approveIfMatch !== undefined && typeof pending.approveIfMatch !== 'string')
        || typeof pending.challengeIdempotencyKey !== 'string'
        || typeof pending.approveIdempotencyKey !== 'string'
        || typeof pending.submitIdempotencyKey !== 'string'
        || (pending.challengeId !== undefined && typeof pending.challengeId !== 'string')
        || (pending.strategyVersionId !== undefined && typeof pending.strategyVersionId !== 'string')
        || (pending.step !== 'CHALLENGE' && pending.challengeId === undefined)
        || (pending.step !== 'CHALLENGE' && pending.approveIfMatch === undefined)
        || (pending.step === 'SUBMIT' && pending.strategyVersionId === undefined)
      ) return null
    }
    return parsed as ClientSnapshot
  } catch {
    return null
  }
}

const persistSnapshot = (snapshot: ClientSnapshot): boolean => {
  try { sessionStorage.setItem(CLIENT_SNAPSHOT_KEY, JSON.stringify(snapshot)); return true }
  catch { return false }
}

const clearPersistedSnapshot = (): boolean => {
  try { sessionStorage.removeItem(CLIENT_SNAPSHOT_KEY); return true }
  catch { return false }
}

const LOCAL_SYNTHETIC_SOURCE: SourceProvenance = {
  source: 'SYNTHETIC_UI_FIXTURE',
  verification: 'UNVERIFIED',
  rights: 'PRIVATE_ONLY',
}

const assertLocalSyntheticSource = (source: SourceProvenance): void => {
  if (
    source.source !== LOCAL_SYNTHETIC_SOURCE.source
    || source.verification !== LOCAL_SYNTHETIC_SOURCE.verification
    || source.rights !== LOCAL_SYNTHETIC_SOURCE.rights
  ) throw new Error('LOCAL_SYNTHETIC_SOURCE_PROVENANCE_REQUIRED')
}

const formatPercent = (value: string): string => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return value
  return `${(parsed * 100).toFixed(2)}%`
}

const formatMoney = (value: string): string => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return `${value} USDT`
  return `${parsed.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} USDT`
}

const shortHash = (value: string): string => `${value.slice(0, 8)}…${value.slice(-6)}`

const questionTarget = (question: NextQuestion): string => (
  'targetPath' in question ? question.targetPath : question.targetField
)

const questionTargetLabel = (question: NextQuestion): string => {
  switch (questionTarget(question)) {
    case '/market/symbol': return '거래쌍 확인'
    case '/features':
    case 'indicator_period': return '지표와 기간 확인'
    case '/entryRules':
    case 'entry_condition': return '진입 조건 확인'
    default: return '빠른 답변'
  }
}

const questionReplies = (question: NextQuestion): readonly string[] => question.options.filter((option) => option !== '다시 설명')

const questionPlaceholder = (question: NextQuestion | null | undefined): string => {
  if (question === null || question === undefined) return '예: BTC 15분 RSI 30 아래면 100 USDT 롱…'
  switch (questionTarget(question)) {
    case '/market/symbol': return '예: BTCUSDT'
    default: return question.options.find((option) => option !== '다시 설명') ?? question.prompt
  }
}

const statusLabel: Record<BacktestJob['state'], string> = {
  QUEUED: '실행 대기',
  PREPARING_DATA: '합성 데이터 준비',
  VALIDATING: '전략 계약 확인',
  RUNNING_IS: 'IS 구간 실행',
  RUNNING_OOS: 'OOS 구간 실행',
  FINALIZING: '결과 봉인',
  CANCEL_REQUESTED: '취소 요청',
  COMPLETED: '실행 완료',
  INVALID: '전략 무효',
  FAILED: '실행 실패',
  CANCELLED: '취소 완료',
}

const orderedStates: readonly BacktestJob['state'][] = [
  'QUEUED',
  'PREPARING_DATA',
  'VALIDATING',
  'RUNNING_IS',
  'RUNNING_OOS',
  'FINALIZING',
  'COMPLETED',
]

const patchLabel = (turn: ConversationTurnEnvelope['data']): string[] => {
  if (turn.compilerTurnResult.status !== 'PATCH_PROPOSED') return []
  return turn.compilerTurnResult.draftPatch.patches.map((patch) => {
    const target = patch.target.entity === 'condition'
      ? `${patch.target.entryRuleId}.${patch.target.conditionId}.${patch.target.field}`
      : 'id' in patch.target
        ? `${patch.target.entity}.${patch.target.id}${'field' in patch.target ? `.${patch.target.field}` : ''}`
        : `${patch.target.entity}${'field' in patch.target ? `.${patch.target.field}` : ''}`
    const value = 'value' in patch ? JSON.stringify(patch.value) : '삭제'
    return `${target} → ${value}`
  })
}

function BrandMark() {
  return <span className="poc-brand-mark" aria-hidden="true">T</span>
}

function Skeleton() {
  return (
    <main className="poc-loading" aria-busy="true" aria-label="내부 POC 불러오는 중">
      <div className="skeleton skeleton-kicker" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-panel" />
    </main>
  )
}

function ErrorPanel({ issue, onRetry }: { issue: ServiceIssue; onRetry?: () => void }) {
  return (
    <main className="poc-error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <p className="eyebrow">실제 API 모드가 닫혔습니다</p>
      <h1>{issue.title}</h1>
      <p>{issue.description}</p>
      <code>{issue.diagnosticCode}</code>
      {onRetry !== undefined && <button type="button" className="secondary-button" onClick={onRetry}>세션 다시 확인</button>}
    </main>
  )
}

function LogoutConfirmedPanel({ onStartNewSession }: { onStartNewSession: () => void }) {
  return (
    <main className="poc-error" role="status">
      <CheckCircle2 aria-hidden="true" />
      <p className="eyebrow">OWNER-LOCAL SESSION</p>
      <h1>로그아웃 응답을 확인했습니다.</h1>
      <p>서버가 REVOKED 상태를 반환했습니다. HttpOnly cookie 삭제 지시는 화면에서 읽거나 저장하지 않으며, 브라우저가 응답을 처리합니다.</p>
      <button type="button" className="secondary-button" onClick={onStartNewSession}>새 세션을 명시적으로 시작</button>
    </main>
  )
}

function StrategySummary({ draft, ready }: { draft: DraftState; ready: boolean }) {
  const strategy = draft.projection
  const condition = strategy.entryRules[0]?.condition
  const featuresById = new Map(strategy.features.map((feature) => [feature.id, feature]))
  const operandLabel = (operand: StrategyOperand): string => {
    if (operand.kind === 'number') return operand.value
    const referencedFeature = featuresById.get(operand.featureId)
    if (referencedFeature === undefined) return `지표(${operand.featureId})`
    return `${referencedFeature.type.toUpperCase()}${'period' in referencedFeature ? `(${referencedFeature.period})` : ''}`
  }
  const conditionLabel = (entryCondition: StrategyCondition | undefined): string => {
    if (entryCondition === undefined) return '진입 조건 미정'
    if (entryCondition.kind === 'comparison') {
      const operator = ({ lt: '<', lte: '≤', gt: '>', gte: '≥' } as const)[entryCondition.operator]
      return `${operandLabel(entryCondition.left)} ${operator} ${operandLabel(entryCondition.right)}`
    }
    if (entryCondition.kind === 'cross') {
      const operator = entryCondition.operator === 'cross_above' ? '↑교차' : '↓교차'
      return `${operandLabel(entryCondition.left)} ${operator} ${operandLabel(entryCondition.right)}`
    }
    return `복합 진입 조건 (${entryCondition.operator.toUpperCase()})`
  }
  const stop = strategy.exitRules.find((rule) => rule.kind === 'stop_loss')
  const take = strategy.exitRules.find((rule) => rule.kind === 'take_profit')
  return (
    <section className="strategy-summary" aria-labelledby="strategy-summary-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Authoritative draft · revision {draft.revision}</p>
          <h2 id="strategy-summary-title">{strategy.metadata?.title ?? '전략 초안'}</h2>
        </div>
        <span className="status-pill"><FileClock size={15} /> {ready ? '계약 검증 후보' : '조건 확인 중'}</span>
      </div>
      <dl className="strategy-grid">
        <div><dt>시장</dt><dd>{strategy.market?.symbol ?? '미정'} · {strategy.clock?.timeframe ?? '미정'}</dd></div>
        <div><dt>진입</dt><dd>{conditionLabel(condition)}</dd></div>
        <div><dt>규모</dt><dd>{strategy.positionSizing?.amount ?? '미정'} {strategy.positionSizing?.currency ?? ''} · {strategy.positionSizing?.type ?? '유형 미정'}</dd></div>
        <div><dt>보호</dt><dd>SL {stop ? formatPercent(stop.distanceFraction) : '미정'} · TP {take ? formatPercent(take.distanceFraction) : '미정'}</dd></div>
        <div><dt>실행</dt><dd>{strategy.execution?.leverage ?? '미정'}× · {strategy.execution?.marginMode ?? '마진 미정'} · {strategy.execution?.positionMode ?? '포지션 모드 미정'}</dd></div>
        <div><dt>평가</dt><dd>{strategy.clock?.evaluateOn ?? '평가 시점 미정'} · 포지션 {strategy.stateRules.maxConcurrentPositions}개</dd></div>
      </dl>
      <details className="hash-details">
        <summary>초안 무결성 정보</summary>
        <code>{draft.projectionHash}</code>
      </details>
    </section>
  )
}

function Progress({ job }: { job: BacktestJob }) {
  const currentIndex = orderedStates.indexOf(job.state)
  const terminal = ['FAILED', 'INVALID', 'CANCELLED'].includes(job.state)
  return (
    <section className="run-progress" aria-labelledby="run-progress-title" aria-live="polite">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Backtest job · revision {job.revision}</p>
          <h2 id="run-progress-title">{statusLabel[job.state]}</h2>
        </div>
        {job.state === 'COMPLETED'
          ? <CheckCircle2 className="complete-icon" aria-hidden="true" />
          : terminal ? <AlertTriangle aria-hidden="true" /> : <LoaderCircle className="spin" aria-hidden="true" />}
      </div>
      {currentIndex >= 0 && <ol className="progress-track">
        {orderedStates.map((state, index) => (
          <li key={state} className={index < currentIndex ? 'done' : index === currentIndex ? 'current' : ''}>
            <span>{index < currentIndex ? <Check size={13} /> : index + 1}</span>
            <small>{statusLabel[state]}</small>
          </li>
        ))}
      </ol>}
      <p className="boundary-copy">브라우저는 상태와 결과를 계산하지 않습니다. 서버가 발급한 job snapshot만 표시합니다.</p>
    </section>
  )
}

function Results({ bundle }: { bundle: ResultBundle }) {
  const derived = new Map(bundle.report.derivedMetrics?.map((metric) => [metric.name, metric.value]))
  const isSegment = bundle.report.segments.find(segment => segment.segment === 'IS')!
  const oosSegment = bundle.report.segments.find(segment => segment.segment === 'OOS')!
  const isManifest = bundle.manifest.segments.find(segment => segment.segment === 'IS')!
  return (
    <section className="results" aria-labelledby="results-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Engine output · pass-through</p>
          <h2 id="results-title">IS와 OOS를 분리해 봅니다.</h2>
        </div>
        <span className="status-pill warning"><AlertTriangle size={15} /> 투자 성과 아님</span>
      </div>
      <div className="metric-strip" aria-label="백테스트 파생 지표">
        <div><span>수익률</span><strong>{derived.has('RETURN_RATE') ? formatPercent(derived.get('RETURN_RATE')!) : '미제공'}</strong></div>
        <div><span>MDD</span><strong>{derived.has('MAX_DRAWDOWN_RATE') ? formatPercent(derived.get('MAX_DRAWDOWN_RATE')!) : '미제공'}</strong></div>
        <div><span>승률</span><strong>{derived.has('WIN_RATE') ? formatPercent(derived.get('WIN_RATE')!) : '미제공'}</strong></div>
        <div><span>거래</span><strong>IS {isSegment.runtimeResult.tradeCount} · OOS {oosSegment.runtimeResult.tradeCount}</strong></div>
      </div>
      <div className="segment-table-wrap">
        <table>
          <caption>엔진이 반환한 구간별 결과 · 금액은 소수점 4자리까지 표시</caption>
          <thead><tr><th>구간</th><th>순손익</th><th>수수료</th><th>펀딩</th><th>거래</th><th>거절</th></tr></thead>
          <tbody>
            {bundle.report.segments.map(({ segment, runtimeResult }) => (
              <tr key={segment}>
                <th>{segment}</th>
                <td>{formatMoney(runtimeResult.netPnl)}</td>
                <td>{formatMoney(runtimeResult.fees)}</td>
                <td>{formatMoney(runtimeResult.funding)}</td>
                <td>{runtimeResult.tradeCount}</td>
                <td>{runtimeResult.rejectionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="trade-list">
        <div className="trade-list-heading">
          <h3>체결 목록</h3>
          <span>{bundle.trades.length}개 표본 · IS manifest {shortHash(isManifest.tradeManifestContentHash)}</span>
        </div>
        {bundle.trades.length === 0 ? (
          <div className="empty-state"><Database size={20} /><p>엔진이 반환한 거래가 없습니다.</p></div>
        ) : (
          <ul>
            {bundle.trades.map((trade) => (
              <li key={`${trade.entryFillRef}:${trade.exitFillRef}`}>
                <span className={`exit-reason ${trade.exitReason === 'TAKE_PROFIT' ? 'positive' : ''}`}>{trade.exitReason}</span>
                <span>{trade.entryPrice} → {trade.exitPrice}</span>
                <strong>{formatMoney(trade.netPnl)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export function InternalPocApp({
  adapterPromise,
  createAdapter,
  paperAdapterPromise,
  paperMarketArtifactAdapterPromise,
  onReset,
  presentation: Presentation,
}: {
  adapterPromise: Promise<InternalPocAdapter>
  /** Only the configured owner-local entrypoint supplies this retry factory. */
  createAdapter?: () => Promise<InternalPocAdapter>
  paperAdapterPromise?: Promise<PaperSessionAdapter>
  paperMarketArtifactAdapterPromise?: Promise<PaperMarketArtifactCatalogAdapter>
  onReset?: () => void
  presentation?: ComponentType<{ state: InternalPocPresentation }>
}) {
  const [adapter, setAdapter] = useState<InternalPocAdapter | null>(null)
  const [bootError, setBootError] = useState<ServiceIssue | null>(null)
  const [bootAttempt, setBootAttempt] = useState(0)
  const [sessionRecoveryRequired, setSessionRecoveryRequired] = useState(false)
  const [logoutConfirmed, setLogoutConfirmed] = useState(false)
  const [serviceSessionState, setServiceSessionState] = useState<'ANONYMOUS' | 'AUTHENTICATED' | null>(null)
  const [busy, setBusy] = useState(false)
  const [conversationRetry, setConversationRetry] = useState(false)
  const pendingConversation = useRef<PendingConversation | null>(null)
  const conversationInFlight = useRef(false)
  const [error, setError] = useState<ServiceIssue | string | null>(null)
  const [storageWarning, setStorageWarning] = useState(false)
  const writeSnapshot = useCallback((value: ClientSnapshot): boolean => {
    const saved = persistSnapshot(value)
    setStorageWarning(!saved)
    return saved
  }, [])
  const removeSnapshot = useCallback((): boolean => {
    const removed = clearPersistedSnapshot()
    setStorageWarning(!removed)
    return removed
  }, [])
  const [csrf, setCsrf] = useState<string | null>(null)
  const [bootReady, setBootReady] = useState(false)
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [turn, setTurn] = useState<ConversationTurnEnvelope['data'] | null>(null)
  const [validation, setValidation] = useState<DraftValidationReceipt | null>(null)
  const [approval, setApproval] = useState<StrategyApproval | null>(null)
  const [job, setJob] = useState<BacktestJob | null>(null)
  const [results, setResults] = useState<ResultBundle | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsIssue, setResultsIssue] = useState<ServiceIssue | null>(null)
  const resultRequest = useRef<{ epoch: number; backtestId: string } | null>(null)
  const [input, setInput] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [recoveryState, setRecoveryState] = useState<'RESTORED' | 'RESET' | null>(null)
  const [messages, setMessages] = useState<readonly Message[]>([
    { id: 'welcome', role: 'assistant', text: '만들고 싶은 전략을 말해 주세요. 지원 범위 안에서 조건을 보존해 실행 가능한 초안으로 정리합니다.' },
  ])
  const pollTimer = useRef<number | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const bootGeneration = useRef(0)
  const sessionEpoch = useRef(0)

  const retryOwnerLocalSession = useCallback(() => {
    if (createAdapter === undefined) return
    // Invalidate stale bootstrap/draft continuations synchronously, before a
    // new user-initiated factory is constructed by the effect.
    bootGeneration.current += 1
    sessionEpoch.current += 1
    setAdapter(null)
    setBootReady(false)
    setCsrf(null)
    setBootError(null)
    setError(null)
    setSessionRecoveryRequired(false)
    setLogoutConfirmed(false)
    setServiceSessionState(null)
    pendingConversation.current = null
    conversationInFlight.current = false
    setConversationRetry(false)
    setBusy(false)
    setInput('')
    removeSnapshot()
    setSnapshot(null)
    setDraft(null)
    setTurn(null)
    setValidation(null)
    setApproval(null)
    setJob(null)
    setResults(null)
    setResultsIssue(null)
    setResultsLoading(false)
    resultRequest.current = null
    setMessages([{ id: 'welcome', role: 'assistant', text: '만들고 싶은 전략을 말해 주세요. 지원 범위 안에서 조건을 보존해 실행 가능한 초안으로 정리합니다.' }])
    setRecoveryState(null)
    setBootAttempt((current) => current + 1)
  }, [createAdapter, removeSnapshot])

  const reportOperationError = useCallback((reason: unknown, fallback: string) => {
    const serviceIssue = describeServiceIssue(reason, fallback)
    if (serviceIssue.requiresSessionRecovery && adapter?.ensureBrowserSession !== undefined) setSessionRecoveryRequired(true)
    setError(serviceIssue)
  }, [adapter])

  const loadResults = useCallback(async (currentAdapter: InternalPocAdapter, expectedJob: BacktestJob) => {
    const expectedSessionEpoch = sessionEpoch.current
    if (!currentAdapter.canReadResults) return
    if (resultRequest.current?.epoch === expectedSessionEpoch && resultRequest.current.backtestId === expectedJob.backtestId) return
    requireResultBinding(expectedJob.state === 'COMPLETED')
    const request = { epoch: expectedSessionEpoch, backtestId: expectedJob.backtestId }
    resultRequest.current = request
    const isCurrent = () => sessionEpoch.current === expectedSessionEpoch && resultRequest.current === request
    setResultsLoading(true)
    setResultsIssue(null)
    setResults(null)
    try {
      const backtestId = expectedJob.backtestId
      // Keep a single read group in flight until all four responses settle.
      // A quick failure must not let retry overlap the remaining requests.
      const responses = await Promise.allSettled([
        currentAdapter.sdk.report.report({ id: backtestId }),
        currentAdapter.sdk.report.manifest({ id: backtestId }),
        currentAdapter.sdk.report.trades({ id: backtestId, request: { segment: 'IS', limit: 50 } }),
        currentAdapter.sdk.report.trades({ id: backtestId, request: { segment: 'OOS', limit: 50 } }),
      ])
      if (!isCurrent()) return
      const failed = responses.find(response => response.status === 'rejected' && response.reason instanceof ApiResponseError && response.reason.status === 401)
        ?? responses.find(response => response.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
      const unwrap = <T,>(response: PromiseSettledResult<T>): T => {
        if (response.status === 'rejected') throw response.reason
        return response.value
      }
      const reportResponse = unwrap(responses[0])
      const manifestResponse = unwrap(responses[1])
      const isTrades = unwrap(responses[2])
      const oosTrades = unwrap(responses[3])
      assertLocalSyntheticSource(reportResponse.body.data.sourceProvenance)
      assertLocalSyntheticSource(manifestResponse.body.data.sourceProvenance)
      assertLocalSyntheticSource(isTrades.body.data.sourceProvenance)
      assertLocalSyntheticSource(oosTrades.body.data.sourceProvenance)
      assertResultBundleBindings(
        expectedJob,
        reportResponse.body.data,
        manifestResponse.body.data,
        isTrades.body.data,
        oosTrades.body.data,
      )
      if (!isCurrent()) return
      setResults({
        report: reportResponse.body.data,
        manifest: manifestResponse.body.data,
        trades: [...isTrades.body.data.trades, ...oosTrades.body.data.trades],
      })
    } catch (reason) {
      if (!isCurrent()) return
      const projected = describeServiceIssue(reason, 'BACKTEST_RESULT_READ_FAILED')
      const reauthenticate = reason instanceof ApiResponseError && reason.status === 401
      setResultsIssue({
        ...projected,
        title: reauthenticate ? projected.title : '결과를 불러오지 못했습니다.',
        description: reauthenticate ? projected.description : '백테스트는 완료되었습니다. 초안과 실행 기록은 유지되며 결과만 다시 조회할 수 있습니다. 확인되지 않은 수치는 표시하지 않습니다.',
        requiresSessionRecovery: reauthenticate,
      })
      if (reauthenticate && currentAdapter.ensureBrowserSession !== undefined) setSessionRecoveryRequired(true)
    } finally {
      if (isCurrent()) {
        resultRequest.current = null
        setResultsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    const generation = ++bootGeneration.current
    const isCurrent = () => active && bootGeneration.current === generation
    const selectedAdapter = bootAttempt === 0
      ? adapterPromise
      : createAdapter === undefined
        ? Promise.reject(new Error('OWNER_LOCAL_SESSION_RETRY_UNAVAILABLE'))
        : createAdapter()
    selectedAdapter.then(async (nextAdapter) => {
      try {
        // The bounded BRS factory owns the only POST.  It is invoked only when
        // the document explicitly enabled the exact current loopback origin.
        const browserSession = nextAdapter.ensureBrowserSession === undefined
          ? undefined
          : await nextAdapter.ensureBrowserSession()
        if (!isCurrent()) return
        const [meResponse, csrfResponse] = await Promise.all([
          nextAdapter.sdk.session.me(),
          nextAdapter.sdk.session.csrf(),
        ])
        const browserSessionState = browserSession?.current.response.body.data.state
        const confirmedOwnerLocalState = browserSessionState === 'ANONYMOUS' || browserSessionState === 'AUTHENTICATED'
          ? browserSessionState
          : null
        if (browserSessionState !== undefined) {
          if (confirmedOwnerLocalState === null
            || meResponse.body.data.authenticated !== (confirmedOwnerLocalState === 'AUTHENTICATED')) {
            throw new Error('OWNER_LOCAL_SESSION_PRINCIPAL_MISMATCH')
          }
        } else if (!meResponse.body.data.authenticated) {
          // Legacy local-api remains an authenticated-only development seam.
          throw new Error('LOCAL_AUTHENTICATED_PRINCIPAL_REQUIRED')
        }
        if (!isCurrent()) return
        setAdapter(nextAdapter)
        setCsrf(csrfResponse.body.data.csrfToken)
        setSessionRecoveryRequired(false)
        setLogoutConfirmed(false)
        setServiceSessionState(confirmedOwnerLocalState)
        const saved = readSnapshot()
        if (saved === null) return
        if (browserSession?.kind === 'BOOTSTRAP_CONFIRMED') {
          // Snapshot IDs are not session/owner authority. Do not carry an old
          // tab's draft, approval or result into a bootstraped service session.
          removeSnapshot()
          setSnapshot(null)
          setDraft(null)
          setTurn(null)
          setValidation(null)
          setApproval(null)
          setJob(null)
          setResults(null)
          setMessages([{ id: 'welcome', role: 'assistant', text: '만들고 싶은 전략을 말해 주세요. 지원 범위 안에서 조건을 보존해 실행 가능한 초안으로 정리합니다.' }])
          setRecoveryState('RESET')
          return
        }
        // SDK rc2 accepts partial drafts: no cached-draft bypass is needed.
        // Every restored draft passes the same SDK-validated server GET.
        let draftResponse
        try {
          draftResponse = await nextAdapter.sdk.conversation.draft({ id: saved.draftId })
        } catch (reason) {
          if (!isCurrent()) return
          if (!(reason instanceof ApiResponseError && reason.status === 404)
            && (!(reason instanceof Error) || reason.message !== 'INVALID_OPERATION_RESPONSE_SCHEMA')) throw reason
          setSnapshot(null)
          setDraft(null)
          setRecoveryState('RESET')
          removeSnapshot()
          return
        }
        if (!isCurrent()) return
        const authoritative = draftResponse.body.data
        if (authoritative.draftId !== saved.draftId || !draftResponse.etag || !STRONG_ETAG.test(draftResponse.etag)) {
          throw new Error('DRAFT_RECONCILIATION_UNCONFIRMED')
        }
        const authoritativeRevision = String(authoritative.revision)
        const sameRevision = saved.draftRevision === authoritativeRevision
        // GET has no candidateState: never promote an unknown or changed
        // revision to READY merely because its projection looks complete.
        const ready = sameRevision && saved.candidateState === 'READY_FOR_VALIDATION' && isDraftReadyForValidation(authoritative)
        const refreshed: ClientSnapshot = {
          conversationId: saved.conversationId,
          draftId: saved.draftId,
          draftEtag: draftResponse.etag,
          draftRevision: authoritativeRevision,
          candidateState: ready ? 'READY_FOR_VALIDATION' : 'INCOMPLETE',
          nextQuestion: ready ? null : (sameRevision ? saved.nextQuestion : undefined),
          draftState: authoritative,
          // Reading an existing server-authorized job grants no new execution.
          ...(sameRevision && isDraftReadyForValidation(authoritative) && saved.backtestId !== undefined ? { backtestId: saved.backtestId } : {}),
          ...(ready && sameRevision && saved.pendingWorkflow !== undefined ? { pendingWorkflow: saved.pendingWorkflow } : {}),
        }
        setSnapshot(refreshed)
        setDraft(authoritative)
        setRecoveryState('RESTORED')
        writeSnapshot(refreshed)
        if (refreshed.backtestId !== undefined) {
          const status = await nextAdapter.sdk.backtest.status({ id: refreshed.backtestId })
          if (!isCurrent()) return
          assertLocalSyntheticSource(status.body.data.sourceProvenance)
          setJob(status.body.data)
          if (status.body.data.state === 'COMPLETED') await loadResults(nextAdapter, status.body.data)
        }
      } catch (reason) {
        if (isCurrent()) {
          const serviceIssue = describeServiceIssue(reason, 'INTERNAL_POC_BOOT_FAILED')
          setSessionRecoveryRequired(serviceIssue.requiresSessionRecovery && nextAdapter.ensureBrowserSession !== undefined)
          setBootError(serviceIssue)
        }
      } finally {
        if (isCurrent()) setBootReady(true)
      }
    }).catch((reason: unknown) => {
      if (isCurrent()) setBootError(describeServiceIssue(reason, 'INTERNAL_POC_ADAPTER_FAILED'))
    })
    return () => { active = false }
  }, [adapterPromise, bootAttempt, createAdapter, loadResults, removeSnapshot, writeSnapshot])

  useEffect(() => {
    if (adapter === null || job === null || job.state === 'COMPLETED' || ['FAILED', 'INVALID', 'CANCELLED'].includes(job.state)) return
    pollTimer.current = window.setTimeout(async () => {
      const expectedSessionEpoch = sessionEpoch.current
      try {
        const response = await adapter.sdk.backtest.status({ id: job.backtestId })
        if (sessionEpoch.current !== expectedSessionEpoch) return
        const next = response.body.data
        assertLocalSyntheticSource(next.sourceProvenance)
        setJob(next)
        if (next.state === 'COMPLETED') await loadResults(adapter, next)
      } catch (reason) {
        if (sessionEpoch.current !== expectedSessionEpoch) return
        reportOperationError(reason, 'BACKTEST_STATUS_FAILED')
      }
    }, adapter.kind === 'fixture' ? 420 : 1_200)
    return () => {
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current)
    }
  }, [adapter, job, loadResults, reportOperationError])

  const sendMessage = async (rawMessage: string, retry = false) => {
    const message = rawMessage.trim()
    if (!bootReady || adapter === null || csrf === null || message.length === 0 || message.length > 1000 || busy || job !== null || snapshot?.pendingWorkflow !== undefined || sessionRecoveryRequired || conversationInFlight.current) return
    if (pendingConversation.current !== null && !retry) return
    const pending = pendingConversation.current ?? {
      message, createKey: idempotencyKey(), turnKey: idempotencyKey(), messageId: clientMessageId(), snapshot,
    }
    if (!retry) {
      pendingConversation.current = pending
      setMessages((current) => [...current, { id: pending.messageId, role: 'user', text: pending.message, delivery: 'pending' }])
    }
    conversationInFlight.current = true
    setBusy(true)
    setConversationRetry(false)
    setError(null)
    setInput('')
    const expectedSessionEpoch = sessionEpoch.current
    try {
      let currentSnapshot = pending.snapshot
      if (currentSnapshot === null) {
        const created = await adapter.sdk.conversation.create({ body: {}, context: { csrfToken: csrf, idempotencyKey: pending.createKey } })
        if (sessionEpoch.current !== expectedSessionEpoch) return
        if (created.etag === undefined) throw new Error('DRAFT_ETAG_MISSING')
        currentSnapshot = {
          conversationId: created.body.data.conversationId,
          draftId: created.body.data.draftId,
          draftEtag: created.etag,
          draftRevision: created.body.data.draftRevision,
          candidateState: 'INCOMPLETE',
        }
        pending.snapshot = currentSnapshot
        setSnapshot(currentSnapshot)
      }
      const response = await adapter.sdk.conversation.turn({
        id: currentSnapshot.conversationId,
        body: { clientMessageId: pending.messageId, message: pending.message, expectedDraftRevision: currentSnapshot.draftRevision },
        context: { csrfToken: csrf, idempotencyKey: pending.turnKey, ifMatch: currentSnapshot.draftEtag },
      })
      if (sessionEpoch.current !== expectedSessionEpoch) return
      if (response.etag === undefined) throw new Error('DRAFT_ETAG_MISSING')
      const nextSnapshot: ClientSnapshot = {
        conversationId: currentSnapshot.conversationId,
        draftId: currentSnapshot.draftId,
        draftEtag: response.etag,
        draftRevision: response.body.data.draftRevision,
        candidateState: response.body.data.candidateState,
        nextQuestion: response.body.data.nextQuestion,
        draftState: response.body.data.draftState,
      }
      setSnapshot(nextSnapshot)
      writeSnapshot(nextSnapshot)
      setTurn(response.body.data)
      setDraft(response.body.data.draftState)
      setValidation(null)
      setApproval(null)
      setAcknowledged(false)
      pendingConversation.current = null
      const assistant = response.body.data.nextQuestion?.prompt
        ?? '조건을 전략 초안에 반영했습니다. 변경 내역과 서버 초안을 확인해 주세요.'
      setMessages((current) => [...current.map(item => item.id === pending.messageId ? { ...item, delivery: 'answered' as const } : item), { id: `${response.body.data.turnId}_${response.body.data.draftRevision}`, role: 'assistant', text: assistant }])
    } catch (reason) {
      if (sessionEpoch.current !== expectedSessionEpoch) return
      setConversationRetry(true)
      setMessages(current => current.map(item => item.id === pending.messageId ? { ...item, delivery: 'uncertain' as const } : item))
      if (reason instanceof ApiResponseError && reason.status === 412 && pending.snapshot !== null) {
        // #99 HTTP checks If-Match before application idempotency replay. Never
        // mint a new turn key or refresh If-Match and resubmit the old message.
        // A GET can reconcile the authoritative draft, not recover the lost
        // assistant reply or prove which concurrent request changed the draft.
        try {
          const response = await adapter.sdk.conversation.draft({ id: pending.snapshot.draftId })
          if (sessionEpoch.current !== expectedSessionEpoch) return
          const authoritative = response.body.data
          if (authoritative.draftId !== pending.snapshot.draftId || !response.etag || !STRONG_ETAG.test(response.etag)
            || BigInt(authoritative.revision) <= BigInt(pending.snapshot.draftRevision)) throw new Error('DRAFT_RECONCILIATION_UNCONFIRMED', { cause: reason })
          const refreshed: ClientSnapshot = {
            conversationId: pending.snapshot.conversationId, draftId: authoritative.draftId,
            draftRevision: String(authoritative.revision), draftEtag: response.etag,
            // GET does not carry the server's candidateState. A subsequent
            // explicit user turn must establish eligibility again.
            candidateState: 'INCOMPLETE',
            draftState: authoritative,
          }
          setSnapshot(refreshed)
          writeSnapshot(refreshed)
          setDraft(authoritative)
          setTurn(null)
          setValidation(null)
          setApproval(null)
          setAcknowledged(false)
          pendingConversation.current = null
          setConversationRetry(false)
          setError({ title: '서버의 최신 초안을 다시 확인했습니다.', description: '이전 응답은 복원하지 못했습니다. 다른 요청이 반영됐을 수도 있으니 초안을 확인하고 원하는 조건을 다시 말씀해주세요. 검증 가능 여부는 다음 서버 응답으로 확인합니다.', diagnosticCode: 'DRAFT_REFRESHED_REPLY_UNCONFIRMED', requiresSessionRecovery: false })
        } catch (recoveryError) {
          if (sessionEpoch.current !== expectedSessionEpoch) return
          if (recoveryError instanceof ApiResponseError && recoveryError.status === 401) reportOperationError(recoveryError, 'DRAFT_RECONCILIATION_UNCONFIRMED')
          else setError({ title: '이전 응답을 복원할 수 없습니다.', description: '서버의 최신 초안을 현재 계약으로 확인하지 못했습니다. 기존 요청을 새 요청으로 재전송하지 않았습니다. 새 전략에서 다시 시작할 수 있으며 서버 초안은 삭제하지 않습니다.', diagnosticCode: 'DRAFT_RECONCILIATION_UNCONFIRMED', requiresSessionRecovery: false })
        }
        return
      }
      if (adapter.kind === 'fixture' && reason instanceof Error
        && /^FIXTURE_(UNSUPPORTED_RSI_THRESHOLD|UNRECOGNIZED_STRATEGY_REPLY)$/.test(reason.message)) {
        // Explicit no-mutation fixture rejections remain editable; this is not
        // used as an inference about real transport/application errors.
        pendingConversation.current = null
        setConversationRetry(false)
      }
      // A lost response says nothing about session revocation. Preserve this
      // turn's identity and allow an explicit same-session replay; a confirmed
      // 401 still takes the recovery path and invalidates old continuations.
      if (reason instanceof TypeError || (reason instanceof DOMException && reason.name === 'AbortError')) {
        setError({ ...describeServiceIssue(reason, 'CONVERSATION_TURN_FAILED'), requiresSessionRecovery: false })
      } else reportOperationError(reason, 'CONVERSATION_TURN_FAILED')
    } finally {
      if (sessionEpoch.current === expectedSessionEpoch) {
        conversationInFlight.current = false
        setBusy(false)
        window.setTimeout(() => composerRef.current?.focus(), 0)
      }
    }
  }

  const submitMessage = async (event: FormEvent) => {
    event.preventDefault()
    await sendMessage(input)
  }

  const validate = async () => {
    if (!bootReady || adapter === null || csrf === null || snapshot === null || draft === null || busy || snapshot.pendingWorkflow !== undefined || pendingConversation.current !== null || sessionRecoveryRequired) return
    setBusy(true)
    setError(null)
    const expectedSessionEpoch = sessionEpoch.current
    try {
      const response = await adapter.sdk.approval.validate({
        id: snapshot.draftId,
        body: { expectedDraftRevision: String(draft.revision) },
        context: { csrfToken: csrf, idempotencyKey: idempotencyKey(), ifMatch: snapshot.draftEtag },
      })
      if (sessionEpoch.current !== expectedSessionEpoch) return
      if (response.body.data.status !== 'VALID') {
        setError(`전략 검증 실패: ${response.body.data.issues.map((issue) => issue.code).join(', ')}`)
        return
      }
      setValidation(response.body.data)
      if (response.etag !== undefined) {
        const nextSnapshot = { ...snapshot, draftEtag: response.etag }
        setSnapshot(nextSnapshot)
        writeSnapshot(nextSnapshot)
      }
    } catch (reason) {
      if (sessionEpoch.current !== expectedSessionEpoch) return
      reportOperationError(reason, 'STRATEGY_VALIDATION_FAILED')
    } finally {
      if (sessionEpoch.current === expectedSessionEpoch) setBusy(false)
    }
  }

  const executeApprovalWorkflow = async (initialSnapshot: ClientSnapshot) => {
    if (!bootReady || job !== null || adapter === null || csrf === null || initialSnapshot.pendingWorkflow === undefined || busy || pendingConversation.current !== null || sessionRecoveryRequired) return
    if (serviceSessionState === 'ANONYMOUS') {
      setError('백테스트를 시작하려면 계정 확인이 필요합니다. 현재 익명 세션에서는 전략 대화와 계약 검증까지만 가능합니다.')
      return
    }
    setBusy(true)
    setError(null)
    const expectedSessionEpoch = sessionEpoch.current
    let currentSnapshot = initialSnapshot
    let pending = initialSnapshot.pendingWorkflow
    try {
      // Do not start or resume an approval mutation without durable retry keys.
      if (!writeSnapshot(currentSnapshot)) throw new Error('LOCAL_RECOVERY_STORAGE_UNAVAILABLE')
      if (pending.step === 'CHALLENGE') {
        const challengeResponse = await adapter.sdk.approval.challenge({
          id: currentSnapshot.draftId,
          body: {
            validationReceiptId: pending.validationReceiptId,
            acknowledgedSemanticHash: pending.semanticHash,
          },
          context: {
            csrfToken: csrf,
            idempotencyKey: pending.challengeIdempotencyKey,
            ifMatch: pending.challengeIfMatch,
          },
        })
        if (sessionEpoch.current !== expectedSessionEpoch) return
        if (challengeResponse.etag === undefined) throw new Error('DRAFT_ETAG_MISSING')
        pending = {
          ...pending,
          step: 'APPROVE',
          challengeId: challengeResponse.body.data.approvalChallengeId,
          approveIfMatch: challengeResponse.etag,
        }
        currentSnapshot = { ...currentSnapshot, draftEtag: challengeResponse.etag, pendingWorkflow: pending }
        setSnapshot(currentSnapshot)
        if (!writeSnapshot(currentSnapshot)) throw new Error('LOCAL_RECOVERY_STORAGE_UNAVAILABLE')
      }
      if (pending.step === 'APPROVE') {
        if (pending.challengeId === undefined || pending.approveIfMatch === undefined) throw new Error('PENDING_APPROVAL_CHALLENGE_MISSING')
        const approvalResponse = await adapter.sdk.approval.approve({
          id: currentSnapshot.draftId,
          body: {
            validationReceiptId: pending.validationReceiptId,
            approvalChallengeId: pending.challengeId,
            acknowledgedSemanticHash: pending.semanticHash,
          },
          context: {
            csrfToken: csrf,
            idempotencyKey: pending.approveIdempotencyKey,
            ifMatch: pending.approveIfMatch,
          },
        })
        if (sessionEpoch.current !== expectedSessionEpoch) return
        setApproval(approvalResponse.body.data)
        pending = {
          ...pending,
          step: 'SUBMIT',
          strategyVersionId: approvalResponse.body.data.strategyVersionId,
        }
        currentSnapshot = { ...currentSnapshot, pendingWorkflow: pending }
        setSnapshot(currentSnapshot)
        if (!writeSnapshot(currentSnapshot)) throw new Error('LOCAL_RECOVERY_STORAGE_UNAVAILABLE')
      }
      if (pending.strategyVersionId === undefined) throw new Error('PENDING_STRATEGY_VERSION_MISSING')
      const backtestResponse = await adapter.sdk.backtest.submit({
        body: {
          strategyVersionId: pending.strategyVersionId,
          expectedSemanticHash: pending.semanticHash,
          profileId: 'STRUCTURAL_SMOKE',
        },
        context: { csrfToken: csrf, idempotencyKey: pending.submitIdempotencyKey },
      })
      if (sessionEpoch.current !== expectedSessionEpoch) return
      const nextJob = backtestResponse.body.data
      assertLocalSyntheticSource(nextJob.sourceProvenance)
      setJob(nextJob)
      const nextSnapshot: ClientSnapshot = {
        conversationId: currentSnapshot.conversationId,
        draftId: currentSnapshot.draftId,
        draftEtag: currentSnapshot.draftEtag,
        draftRevision: currentSnapshot.draftRevision,
        candidateState: currentSnapshot.candidateState,
        nextQuestion: currentSnapshot.nextQuestion,
        draftState: currentSnapshot.draftState,
        backtestId: nextJob.backtestId,
      }
      setSnapshot(nextSnapshot)
      writeSnapshot(nextSnapshot)
    } catch (reason) {
      if (sessionEpoch.current !== expectedSessionEpoch) return
      reportOperationError(reason, 'APPROVAL_OR_BACKTEST_FAILED')
    } finally {
      if (sessionEpoch.current === expectedSessionEpoch) setBusy(false)
    }
  }

  const approveAndRun = () => {
    if (!bootReady || job !== null || snapshot === null || snapshot.pendingWorkflow !== undefined || validation === null || !acknowledged || busy || pendingConversation.current !== null || sessionRecoveryRequired) return
    if (serviceSessionState === 'ANONYMOUS') {
      setError('백테스트를 시작하려면 계정 확인이 필요합니다. 현재 익명 세션에서는 전략 대화와 계약 검증까지만 가능합니다.')
      return
    }
    const pendingWorkflow: PendingApprovalWorkflow = {
      step: 'CHALLENGE',
      validationReceiptId: validation.validationReceiptId,
      semanticHash: validation.semanticHash,
      challengeIfMatch: snapshot.draftEtag,
      challengeIdempotencyKey: idempotencyKey(),
      approveIdempotencyKey: idempotencyKey(),
      submitIdempotencyKey: idempotencyKey(),
    }
    const nextSnapshot = { ...snapshot, pendingWorkflow }
    if (!writeSnapshot(nextSnapshot)) {
      setError('승인 정보를 저장하지 못했습니다. 저장 권한을 확인한 뒤 다시 승인해주세요. 아직 승인 요청을 보내지 않았습니다.')
      return
    }
    setSnapshot(nextSnapshot)
    void executeApprovalWorkflow(nextSnapshot)
  }

  const resumeApprovalAndRun = () => {
    if (!bootReady || job !== null || snapshot?.pendingWorkflow === undefined || busy || pendingConversation.current !== null || sessionRecoveryRequired) return
    if (serviceSessionState === 'ANONYMOUS') {
      setError('백테스트를 시작하려면 계정 확인이 필요합니다. 현재 익명 세션에서는 전략 대화와 계약 검증까지만 가능합니다.')
      return
    }
    void executeApprovalWorkflow(snapshot)
  }

  const reset = () => {
    if (!bootReady) return
    if (busy || snapshot?.pendingWorkflow !== undefined
      || (job !== null && !['COMPLETED', 'FAILED', 'INVALID', 'CANCELLED'].includes(job.state))) {
      setError('아직 결과를 확인하지 못한 요청이 있습니다. 현재 작업을 확인하거나 같은 요청으로 재개한 뒤 새 흐름을 시작해주세요.')
      return
    }
    if (!removeSnapshot()) {
      setError('이전 화면의 복구 정보를 지우지 못했습니다. 저장 권한을 확인한 뒤 다시 시작해주세요. 현재 대화는 유지됩니다.')
      return
    }
    onReset?.()
    window.location.reload()
  }

  const logout = async () => {
    if (!bootReady || adapter === null || csrf === null || adapter.ensureBrowserSession === undefined || busy) return
    setBusy(true)
    setError(null)
    const logoutEpoch = ++sessionEpoch.current
    resultRequest.current = null
    setResultsLoading(false)
    try {
      const current = await adapter.sdk.session.current()
      if (sessionEpoch.current !== logoutEpoch) return
      const currentRevision = parseUint64Revision(current.body.data.revision)
      if (current.etag === undefined
        || !STRONG_ETAG.test(current.etag)
        || currentRevision === null
        || current.body.meta.resourceRevision !== current.body.data.revision
        || !['ANONYMOUS', 'AUTHENTICATED'].includes(current.body.data.state)) {
        throw new Error('LOGOUT_SESSION_STATE_UNCONFIRMED')
      }
      const response = await adapter.sdk.session.logout({
        context: { csrfToken: csrf, idempotencyKey: idempotencyKey(), ifMatch: current.etag },
      })
      if (sessionEpoch.current !== logoutEpoch) return
      const responseRevision = parseUint64Revision(response.body.data.revision)
      if (response.etag === undefined
        || !STRONG_ETAG.test(response.etag)
        || response.etag === current.etag
        || responseRevision === null
        || responseRevision !== currentRevision + 1n
        || response.body.data.state !== 'REVOKED'
        || response.body.data.sessionId !== current.body.data.sessionId
        || response.body.data.issuedAt !== current.body.data.issuedAt
        || response.body.data.expiresAt !== current.body.data.expiresAt
        || response.body.meta.resourceRevision !== response.body.data.revision) {
        throw new Error('LOGOUT_RESPONSE_UNCONFIRMED')
      }
      // Only this confirmed server response clears client state. Cookie values
      // and CSRF values are neither rendered nor persisted.
      removeSnapshot()
      setSnapshot(null)
      setDraft(null)
      setTurn(null)
      setValidation(null)
      setApproval(null)
      setJob(null)
      setResults(null)
      setResultsIssue(null)
      setMessages([{ id: 'welcome', role: 'assistant', text: '만들고 싶은 전략을 말해 주세요. 지원 범위 안에서 조건을 보존해 실행 가능한 초안으로 정리합니다.' }])
      setCsrf(null)
      setAdapter(null)
      setServiceSessionState(null)
      pendingConversation.current = null
      conversationInFlight.current = false
      setConversationRetry(false)
      setLogoutConfirmed(true)
    } catch (reason) {
      if (sessionEpoch.current !== logoutEpoch) return
      reportOperationError(reason, 'LOGOUT_UNCONFIRMED')
    } finally {
      if (sessionEpoch.current === logoutEpoch) setBusy(false)
    }
  }

  const changes = useMemo(() => turn === null ? [] : patchLabel(turn), [turn])
  const nextQuestion = turn === null ? snapshot?.nextQuestion : turn.nextQuestion
  const quickReplies = nextQuestion === null || nextQuestion === undefined ? [] : questionReplies(nextQuestion)
  const visibleProvenance = results?.report.sourceProvenance ?? job?.sourceProvenance ?? LOCAL_SYNTHETIC_SOURCE

  const workflow = (
          <aside className="decision-rail" aria-label="전략 검토와 승인">
            {draft === null ? (
              <section className="empty-draft">
                <Sparkles size={22} />
                <h2>아직 서버 초안이 없습니다.</h2>
                <p>왼쪽에서 전략을 말하면 변경 diff와 authoritative Draft가 이곳에 나타납니다.</p>
              </section>
            ) : (
              <>
                <StrategySummary draft={draft} ready={snapshot?.candidateState === 'READY_FOR_VALIDATION'} />
                {changes.length > 0 && (
                  <section className="change-set" aria-labelledby="change-set-title">
                    <div className="section-heading"><div><p className="eyebrow">DraftPatch</p><h2 id="change-set-title">이번 변경</h2></div><span>{changes.length}</span></div>
                    <ul>{changes.map((change) => <li key={change}><Check size={15} /><code>{change}</code></li>)}</ul>
                  </section>
                )}
                {validation === null && job === null && snapshot?.pendingWorkflow === undefined && (
                  <>
                    {snapshot?.candidateState === 'INCOMPLETE' && nextQuestion !== null && nextQuestion !== undefined && (
                      <p className="candidate-hint">전략 완성을 위해 추가 확인이 필요합니다: {questionTargetLabel(nextQuestion)}</p>
                    )}
                    <button type="button" className="primary-button full" onClick={validate} disabled={busy || conversationRetry || sessionRecoveryRequired || snapshot?.candidateState !== 'READY_FOR_VALIDATION'}>
                      {busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />} 계약 검증
                    </button>
                  </>
                )}
                {validation !== null && approval === null && job === null && snapshot?.pendingWorkflow === undefined && (
                  <section className="approval-box">
                    <div className="approval-heading"><CheckCircle2 size={21} /><div><strong>Validator 통과</strong><span>receipt {shortHash(validation.validationReceiptId)}</span></div></div>
                    <code className="semantic-hash">semantic {shortHash(validation.semanticHash)}</code>
                    <label className="acknowledgement">
                      <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                      <span>표시된 전략 의미와 합성 데이터 한계를 확인했습니다.</span>
                    </label>
                    <button type="button" className="primary-button full" onClick={approveAndRun} disabled={busy || conversationRetry || sessionRecoveryRequired || !acknowledged}>
                      {busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />} 승인하고 백테스트
                    </button>
                  </section>
                )}
                {snapshot?.pendingWorkflow !== undefined && job === null && (
                  <section className="approval-box pending-workflow" aria-labelledby="pending-workflow-title">
                    <div className="approval-heading">
                      <FileClock size={21} />
                      <div>
                        <strong id="pending-workflow-title">중단된 승인 흐름이 있습니다.</strong>
                        <span>{snapshot.pendingWorkflow.step.toLowerCase()} 단계부터 같은 요청으로 재개합니다.</span>
                      </div>
                    </div>
                    <p>새 전략을 만들지 않고 저장된 idempotency key와 동일한 요청 본문을 다시 사용합니다.</p>
                    <button type="button" className="primary-button full" onClick={resumeApprovalAndRun} disabled={busy || conversationRetry || sessionRecoveryRequired}>
                      {busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />} 승인·백테스트 이어서
                    </button>
                  </section>
                )}
              </>
            )}
          </aside>
  )
  const issue = <>
        {storageWarning && <p className="inline-error" role="status" data-testid="local-recovery-storage-warning">이 브라우저에 복구 정보를 저장하지 못했습니다. 서버 응답은 현재 화면에서 계속 확인할 수 있지만 새로고침 후 복원은 보장되지 않습니다. 승인 요청은 복구 정보를 저장한 뒤에만 진행합니다.</p>}
        {error !== null && (
          <div className="inline-error" role="alert">
            <AlertTriangle size={18} /><span>{typeof error === 'string'
              ? error
              : <><strong>{error.title}</strong> {error.description} <code>{error.diagnosticCode}</code></>}</span>
            {sessionRecoveryRequired && <button type="button" onClick={retryOwnerLocalSession}>세션 다시 확인</button>}
            {conversationRetry && !sessionRecoveryRequired && !(typeof error === 'object' && error.diagnosticCode === 'DRAFT_RECONCILIATION_UNCONFIRMED') && <button type="button" disabled={busy} onClick={() => {
              const pending = pendingConversation.current
              if (pending) void sendMessage(pending.message, true)
            }}>같은 요청 다시 확인</button>}
            {typeof error === 'object' && error.diagnosticCode === 'DRAFT_RECONCILIATION_UNCONFIRMED'
              && <button type="button" disabled={busy} onClick={reset}>새 전략에서 다시 시작</button>}
            {!conversationRetry && <button type="button" onClick={() => setError(null)}>닫기</button>}
          </div>
        )}

  </>
  const outcome = <>

        {job !== null && <Progress job={job} />}

        {job?.state === 'COMPLETED' && adapter?.canReadResults && results === null && (
          <section className="result-recovery" aria-label="백테스트 결과 조회" aria-busy={resultsLoading}>
            {resultsIssue ? <div role="alert"><h2>{resultsIssue.title}</h2><p>{resultsIssue.description}</p><code>{resultsIssue.diagnosticCode}</code></div>
              : <p role="status">{resultsLoading ? '검증된 결과를 불러오는 중입니다.' : '백테스트가 완료되었습니다. 결과를 다시 불러와 확인해 주세요.'}</p>}
            {resultsIssue?.requiresSessionRecovery
              ? <button type="button" className="primary-button" disabled={busy} onClick={() => createAdapter ? retryOwnerLocalSession() : window.location.reload()}>세션 다시 확인</button>
              : <button type="button" className="primary-button" disabled={!bootReady || busy || resultsLoading || sessionRecoveryRequired} onClick={() => { if (bootReady && !busy && !sessionRecoveryRequired) void loadResults(adapter, job) }}>
                <RotateCcw size={16} /> {resultsLoading ? '결과 확인 중' : '결과 다시 불러오기'}
              </button>}
          </section>
        )}

        {job?.state === 'COMPLETED' && !adapter?.canReadResults && (
          <section className="result-locked" role="status">
            <ShieldCheck size={22} />
            <div>
              <h2>결과 신뢰 바인딩이 없어 표시를 중단했습니다.</h2>
              <p>실행은 완료됐지만 TrustedVerifierAuthority가 아직 없습니다. 서버가 job별 신뢰값을 준비한 뒤 수동으로 다시 불러오세요. 그전에는 report, manifest, trades를 읽지 않습니다.</p>
              <button type="button" className="primary-button reload-trust" onClick={() => window.location.reload()}>
                <RotateCcw size={16} /> 신뢰값 다시 불러오기
              </button>
            </div>
          </section>
        )}

        {results !== null && <Results bundle={results} />}

        {job?.state === 'COMPLETED' && csrf !== null && (
          <PaperSessionPanel
            adapterPromise={paperAdapterPromise}
            marketArtifactAdapterPromise={paperMarketArtifactAdapterPromise}
            requestedStrategy={{
              strategyVersionId: job.strategyVersionId,
              semanticHash: job.semanticHash,
            }}
            csrfToken={csrf}
          />
        )}

  </>

  if (Presentation) return <Presentation state={{
    phase: logoutConfirmed ? 'logged-out' : bootError ? 'error' : !bootReady || !adapter || !csrf ? 'loading' : 'ready',
    messages, input, busy, inputDisabled: !bootReady || busy || job !== null || snapshot?.pendingWorkflow !== undefined || sessionRecoveryRequired || conversationRetry,
    source: adapter?.kind === 'fixture' ? 'mock' : 'service', sessionState: serviceSessionState,
    recovery: recoveryState,
    quickReplies, workflow: bootReady && draft ? workflow : null, outcome,
    issue: bootError ? <div role="alert"><strong>{bootError.title}</strong><p>{bootError.description}</p><code>{bootError.diagnosticCode}</code></div> : issue,
    onInput: setInput, onSend: value => sendMessage(value), onReset: reset,
    onRecover: createAdapter && (sessionRecoveryRequired || logoutConfirmed) ? retryOwnerLocalSession : undefined,
    onLogout: bootReady && adapter?.ensureBrowserSession ? logout : undefined,
  }} />

  if (logoutConfirmed) return <LogoutConfirmedPanel onStartNewSession={retryOwnerLocalSession} />
  if (bootError !== null) return <ErrorPanel issue={bootError} onRetry={sessionRecoveryRequired ? retryOwnerLocalSession : undefined} />
  if (!bootReady || adapter === null || csrf === null) return <Skeleton />

  return (
    <div className="internal-poc-shell">
      <a className="skip-link" href="#poc-main">본문으로 건너뛰기</a>
      <header className="poc-topbar">
        <a className="poc-brand" href="/internal-poc.html" aria-label="TETH AI 내부 POC 처음으로">
          <BrandMark /><span>TETH AI</span><small>INTERNAL POC</small>
        </a>
        <div className="topbar-status">
          <span className={`source-badge ${adapter.kind}`}><CircleDot size={14} /> {adapter.label}</span>
          {adapter.ensureBrowserSession !== undefined && <span className="source-badge local-api">owner-local session</span>}
          {adapter.ensureBrowserSession !== undefined && <button type="button" className="quiet-button" onClick={() => void logout()} disabled={busy}>로그아웃</button>}
          <button type="button" className="quiet-button" onClick={reset}><RotateCcw size={16} /> 새 흐름</button>
        </div>
      </header>

      <main id="poc-main" className="poc-main">
        <section className="poc-intro">
          <div>
            <p className="eyebrow">LOCAL_STRATEGY_BACKTEST_VERTICAL</p>
            <h1>아이디어를 말하면,<br />검증 가능한 전략이 됩니다.</h1>
            <p>대화에서 나온 조건을 서버 초안으로 보존하고, 승인된 버전만 결정론적 합성 백테스트에 전달합니다.</p>
          </div>
          <div className="capability-list" aria-label="현재 지원 범위">
            <span>BTCUSDT</span><span>15m</span><span>RSI</span><span>SMA</span><span>fixed_notional</span><span>SL</span><span>TP</span><span>leverage ≤ 3×</span>
          </div>
        </section>

        <section className="trust-ribbon" aria-label="데이터 출처와 한계">
          <FlaskConical size={18} />
          <div><strong>{adapter.label}</strong><span>{visibleProvenance.source} · {visibleProvenance.verification} · {visibleProvenance.rights}</span></div>
          <p>실거래, 투자 조언, Binance 주문이 아닙니다.</p>
        </section>

        {recoveryState !== null && (
          <div className="recovery-banner" role="status">
            <FileClock size={18} />
            {recoveryState === 'RESTORED' ? (
              <div><strong>진행 상태를 안전하게 복구했습니다.</strong><span>검증 전 질문은 직전 Draft에서 이어가고, 실행 가능한 상태는 서버 Draft로 다시 확인합니다.</span></div>
            ) : (
              <div><strong>저장 초안을 확인할 수 없어 초기화했습니다.</strong><span>검증이나 실행은 진행하지 않았습니다. 전략 입력부터 다시 시작해 주세요.</span></div>
            )}
          </div>
        )}

        <div className="workspace-grid">
          <section className="conversation-panel" aria-labelledby="conversation-title">
            <div className="panel-heading">
              <div><MessageSquareText size={18} /><h2 id="conversation-title">전략 대화</h2></div>
              <span>{messages.length - 1} turn</span>
            </div>
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <div key={message.id} className={`message ${message.role}`}>
                  <span>{message.role === 'assistant' ? <BrandMark /> : '나'}</span>
                  <p>{message.text}</p>
                </div>
              ))}
              {busy && draft === null && (
                <div className="message assistant loading-message"><span><BrandMark /></span><p>조건을 구조화하고 있습니다…</p></div>
              )}
            </div>
            {nextQuestion !== null && nextQuestion !== undefined && quickReplies.length > 0 && (
              <div className="question-replies" aria-label={questionTargetLabel(nextQuestion)}>
                <span>{questionTargetLabel(nextQuestion)}</span>
                <div>
                  {quickReplies.map((reply) => (
                    <button type="button" key={reply} onClick={() => void sendMessage(reply)} disabled={busy || job !== null || snapshot?.pendingWorkflow !== undefined || conversationRetry || sessionRecoveryRequired}>
                      {reply}<ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {snapshot === null && (
              <button className="idea-chip" type="button" onClick={() => setInput(QUICK_IDEA)}>
                <Sparkles size={16} /> 지원 전략 예시 넣기 <ChevronRight size={16} />
              </button>
            )}
            <form className="composer" onSubmit={submitMessage}>
              <label htmlFor="strategy-message">전략 아이디어 또는 수정 요청</label>
              <textarea
                ref={composerRef}
                id="strategy-message"
                rows={3}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={questionPlaceholder(nextQuestion)}
                disabled={busy || job !== null || snapshot?.pendingWorkflow !== undefined || conversationRetry || sessionRecoveryRequired}
                maxLength={1_000}
              />
              <div><span>{input.length}/1,000</span><button type="submit" disabled={busy || input.trim().length === 0 || job !== null || snapshot?.pendingWorkflow !== undefined || conversationRetry || sessionRecoveryRequired}><Send size={17} /> 보내기</button></div>
            </form>
          </section>

          {workflow}
        </div>

        {issue}
        {outcome}

        <footer className="poc-footer">
          <span>API {API_V01_UPSTREAM.packageVersion}</span>
          <span>contracts {shortHash(API_V01_UPSTREAM.commitSha)}</span>
          <span>공개 배포·OAuth·Secret·거래 endpoint 0</span>
        </footer>
      </main>
    </div>
  )
}
