import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileCheck2,
  FlaskConical,
  LockKeyhole,
  MessageSquareText,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, RefObject } from 'react'
import type {
  ApprovalChallenge,
  ConversationSnapshot,
  ConversationTurn,
  DraftValidationFailure,
  DraftValidationReceipt,
  StrategyApproval,
} from './contracts/generated/api-v0.3/types.js'
import type { ServiceV03Adapter } from './service-v03-adapter'
import {
  SERVICE_V03_JOURNEY_FIXTURE,
  SERVICE_V03_JOURNEY_SOURCE,
  type ServiceV03FixtureTransport,
} from './service-v03-fixture-transport'

type JourneyStep =
  | 'EMPTY'
  | 'CREATING'
  | 'SUMMARY'
  | 'PATCHING'
  | 'PATCHED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'CHALLENGING'
  | 'APPROVAL_READY'
  | 'APPROVING'
  | 'APPROVED'
  | 'BACKTESTING'
  | 'RESULT'
  | 'ERROR'

type RetryStage = 'JOURNEY' | 'TURN' | 'PATCH' | 'VALIDATE' | 'CHALLENGE' | 'APPROVE' | null

interface ServiceV03JourneyAppProps {
  readonly adapter: ServiceV03Adapter
  readonly fixtureTransport: ServiceV03FixtureTransport
}

const FIXTURE_SCOPE_NOTICE = '입력과 무관한 고정 계약 fixture 시연이며, 표시된 값은 해당 입력의 해석·보존 또는 실제 전략 결과가 아닙니다.'
const BACKTEST_STAGES = [
  '계약 입력 확인',
  '시연용 데이터 준비',
  'IS/OOS 흐름 구성',
  '제한사항 포함 결과 화면 준비',
] as const

const shortHash = (value: string | null): string => value === null
  ? '없음'
  : `${value.slice(0, 8)}…${value.slice(-6)}`

const failureCode = (result: Readonly<{ status: string }>): string => {
  if ('code' in result && typeof result.code === 'string') return result.code
  if ('reason' in result && typeof result.reason === 'string') return result.reason
  return 'MOCK_WORKFLOW_NOT_APPLIED'
}

const appliedData = <T,>(result: Readonly<{ value: unknown }>): T => (
  result.value as Readonly<{ data: T }>
).data

const mutationContext = (operation: string, ifMatch?: string) => ({
  csrfToken: 'csrf_journey_fixture_only_0001',
  idempotencyKey: `journey_${operation}_idempotency_0001`,
  ...(ifMatch === undefined ? {} : { ifMatch }),
})

const strategyFacts = (snapshot: ConversationSnapshot | null) => {
  const projection = snapshot?.draftState.projection
  const rsi = projection?.features.find((feature) => feature.type === 'rsi')
  const comparison = projection?.entryRules[0]?.condition
  const comparisonLabel = comparison?.kind === 'comparison'
    ? ({ lt: '미만', lte: '이하', gt: '초과', gte: '이상' } as const)[comparison.operator]
    : 'fixture 미연결'
  const positionSide = projection?.entryRules[0]?.side === 'long' ? '롱' : 'fixture 미연결'
  const threshold = comparison?.kind === 'comparison' && comparison.right.kind === 'number'
    ? comparison.right.value
    : 'fixture 미연결'
  return [
    ['시장', projection?.market?.symbol ?? 'fixture 미연결'],
    ['주기', projection?.clock?.timeframe ?? 'fixture 미연결'],
    ['진입', `RSI ${rsi?.type === 'rsi' ? rsi.period : '—'} · ${threshold} ${comparisonLabel}`],
    ['포지션', projection?.positionSizing === undefined
      ? 'fixture 미연결'
      : `${projection.positionSizing.amount} ${projection.positionSizing.currency} ${positionSide}`],
    ['손절 / 익절', projection === undefined
      ? 'fixture 미연결'
      : projection.exitRules.map((rule) => `${rule.kind === 'stop_loss' ? '손절' : '익절'} ${Number(rule.distanceFraction) * 100}%`).join(' · ')],
    ['레버리지', projection?.execution === undefined ? 'fixture 미연결' : `${projection.execution.leverage}배`],
  ] as const
}

const patchDisplay = (turn: ConversationTurn | null) => {
  if (turn?.compilerTurnResult.status !== 'PATCH_PROPOSED') return null
  const operation = turn.compilerTurnResult.draftPatch.patches.find((item) => (
    item.op === 'set'
    && item.target.entity === 'execution'
    && item.target.field === 'leverage'
  ))
  if (
    operation === undefined
    || operation.op !== 'set'
    || operation.target.entity !== 'execution'
    || operation.target.field !== 'leverage'
  ) return null
  return {
    before: 'expectedState' in operation.precondition && operation.precondition.expectedState === 'absent'
      ? '기존 값 없음'
      : '기존 값 변경',
    after: `${operation.value}배`,
    operation: `${operation.target.entity}.${operation.target.field} · ${operation.op}`,
  }
}

const liveMessage = (step: JourneyStep): string => ({
  EMPTY: '전략 아이디어 입력 대기',
  CREATING: '고정 계약 fixture를 준비 중입니다.',
  SUMMARY: '고정 fixture 전략 요약을 표시했습니다.',
  PATCHING: '수정안을 적용 중입니다.',
  PATCHED: '수정안 적용을 완료했습니다.',
  VALIDATING: '계약을 검증 중입니다.',
  VALIDATED: '계약 검증을 통과했습니다.',
  CHALLENGING: '승인 대상을 고정 중입니다.',
  APPROVAL_READY: '명시적 승인을 기다립니다.',
  APPROVING: '전략 승인을 처리 중입니다.',
  APPROVED: 'Mock 전략 버전을 생성했습니다.',
  BACKTESTING: 'Mock 결과 화면을 준비 중입니다.',
  RESULT: '제한사항이 포함된 Mock 결과 화면을 표시했습니다.',
  ERROR: 'Mock 단계에서 안전한 오류가 발생했습니다.',
})[step]

export function ServiceV03JourneyApp({ adapter, fixtureTransport }: ServiceV03JourneyAppProps) {
  const [step, setStep] = useState<JourneyStep>('EMPTY')
  const [idea, setIdea] = useState('')
  const [submittedIdea, setSubmittedIdea] = useState('')
  const [snapshot, setSnapshot] = useState<ConversationSnapshot | null>(null)
  const [turn, setTurn] = useState<ConversationTurn | null>(null)
  const [receipt, setReceipt] = useState<DraftValidationReceipt | null>(null)
  const [challenge, setChallenge] = useState<ApprovalChallenge | null>(null)
  const [approval, setApproval] = useState<StrategyApproval | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [retryStage, setRetryStage] = useState<RetryStage>(null)
  const [progressIndex, setProgressIndex] = useState(0)
  const [transportAudit, setTransportAudit] = useState(() => fixtureTransport.audit())
  const sectionHeadingRef = useRef<HTMLHeadingElement>(null)
  const journeyEpochRef = useRef(0)

  const busy = ['CREATING', 'PATCHING', 'VALIDATING', 'CHALLENGING', 'APPROVING', 'BACKTESTING'].includes(step)
  const facts = useMemo(() => strategyFacts(snapshot), [snapshot])
  const displayedPatch = useMemo(() => patchDisplay(turn), [turn])
  const progress = Math.min(100, Math.round((progressIndex / BACKTEST_STAGES.length) * 100))

  useEffect(() => {
    sectionHeadingRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (step !== 'BACKTESTING') return
    const timer = window.setTimeout(() => {
      if (progressIndex >= BACKTEST_STAGES.length) setStep('RESULT')
      else setProgressIndex(Math.min(progressIndex + 1, BACKTEST_STAGES.length))
    }, progressIndex >= BACKTEST_STAGES.length ? 0 : 220)
    return () => window.clearTimeout(timer)
  }, [progressIndex, step])

  const refreshAudit = () => setTransportAudit(fixtureTransport.audit())

  const showError = (code: string, retry: RetryStage) => {
    setErrorCode(code)
    setRetryStage(retry)
    setStep('ERROR')
  }

  const createTurn = async (
    authority: NonNullable<ReturnType<ServiceV03Adapter['view']>['authority']>,
    requestedIdea: string,
    journeyEpoch: number = journeyEpochRef.current,
  ) => {
    setStep('CREATING')
    const turned = await adapter.createTurn(
      authority.conversationId,
      {
        clientMessageId: 'client_message_journey_fixture_0001',
        message: requestedIdea,
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      mutationContext('turn', authority.etag),
    )
    if (journeyEpoch !== journeyEpochRef.current) return
    refreshAudit()
    if (turned.status !== 'APPLIED' || turned.view.authority === null) {
      showError(failureCode(turned), 'TURN')
      return
    }
    setSnapshot(turned.view.authority.snapshot)
    setTurn(appliedData<ConversationTurn>(turned))
    setStep('SUMMARY')
  }

  const startJourney = async (requestedIdea: string) => {
    const journeyEpoch = journeyEpochRef.current
    const normalizedIdea = requestedIdea.trim()
    if (normalizedIdea.length === 0) return
    setSubmittedIdea(normalizedIdea)
    setErrorCode(null)
    setStep('CREATING')
    const created = await adapter.createConversation(mutationContext('create'))
    if (journeyEpoch !== journeyEpochRef.current) return
    refreshAudit()
    if (created.status !== 'APPLIED' || created.view.authority === null) {
      showError(failureCode(created), 'JOURNEY')
      return
    }
    await createTurn(created.view.authority, normalizedIdea, journeyEpoch)
  }

  const submitIdea = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void startJourney(idea)
  }

  const validateStrategy = async () => {
    const journeyEpoch = journeyEpochRef.current
    const authority = adapter.view().authority
    if (authority === null) {
      showError('MOCK_AUTHORITY_MISSING', 'JOURNEY')
      return
    }
    setErrorCode(null)
    setStep('VALIDATING')
    const validation = await adapter.validateDraft(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
      },
      mutationContext('validate', authority.etag),
    )
    if (journeyEpoch !== journeyEpochRef.current) return
    refreshAudit()
    if (validation.status !== 'APPLIED') {
      showError(failureCode(validation), 'VALIDATE')
      return
    }
    const validationData = appliedData<DraftValidationReceipt | DraftValidationFailure>(validation)
    if (validationData.status !== 'VALID') {
      showError('MOCK_DRAFT_NOT_VALID', 'VALIDATE')
      return
    }
    setReceipt(validationData)
    setStep('VALIDATED')
  }

  const applyPatch = async () => {
    const journeyEpoch = journeyEpochRef.current
    const authority = adapter.view().authority
    if (authority === null || turn?.compilerTurnResult.status !== 'PATCH_PROPOSED') {
      showError('MOCK_PATCH_INPUT_MISSING', 'TURN')
      return
    }
    setErrorCode(null)
    setStep('PATCHING')
    const result = await adapter.patchDraft(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
        source: turn.compilerTurnResult.source,
        draftPatch: turn.compilerTurnResult.draftPatch,
      },
      mutationContext('patch', authority.etag),
    )
    if (journeyEpoch !== journeyEpochRef.current) return
    refreshAudit()
    if (result.status !== 'APPLIED' || result.view.authority === null) {
      showError(failureCode(result), 'PATCH')
      return
    }
    setSnapshot(result.view.authority.snapshot)
    setStep('PATCHED')
  }

  const createChallenge = async () => {
    const journeyEpoch = journeyEpochRef.current
    const authority = adapter.view().authority
    if (authority === null || authority.snapshot.semanticHash === null || receipt === null) {
      showError('MOCK_APPROVAL_INPUT_MISSING', 'VALIDATE')
      return
    }
    setErrorCode(null)
    setStep('CHALLENGING')
    const result = await adapter.createApprovalChallenge(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
        validationReceiptId: receipt.validationReceiptId,
        acknowledgedSemanticHash: authority.snapshot.semanticHash,
      },
      mutationContext('challenge', authority.etag),
    )
    if (journeyEpoch !== journeyEpochRef.current) return
    refreshAudit()
    if (result.status !== 'APPLIED') {
      showError(failureCode(result), 'CHALLENGE')
      return
    }
    setChallenge(appliedData<ApprovalChallenge>(result))
    setStep('APPROVAL_READY')
  }

  const approveStrategy = async () => {
    const journeyEpoch = journeyEpochRef.current
    const authority = adapter.view().authority
    if (
      !acknowledged
      || authority === null
      || authority.snapshot.semanticHash === null
      || receipt === null
      || challenge === null
    ) return
    setErrorCode(null)
    setStep('APPROVING')
    const result = await adapter.approveDraft(
      authority.snapshot.draftId,
      {
        expectedConversationStateRevision: authority.conversationStateRevision,
        expectedConversationStateHash: authority.conversationStateHash,
        validationReceiptId: receipt.validationReceiptId,
        approvalChallengeId: challenge.approvalChallengeId,
        acknowledgedSemanticHash: authority.snapshot.semanticHash,
      },
      mutationContext('approve', authority.etag),
    )
    if (journeyEpoch !== journeyEpochRef.current) return
    refreshAudit()
    if (result.status !== 'APPLIED') {
      showError(failureCode(result), 'APPROVE')
      return
    }
    setApproval(appliedData<StrategyApproval>(result))
    setStep('APPROVED')
  }

  const retry = () => {
    if (retryStage === 'JOURNEY') void startJourney(submittedIdea || idea)
    if (retryStage === 'TURN') {
      const authority = adapter.view().authority
      if (authority !== null) void createTurn(authority, submittedIdea || idea)
    }
    if (retryStage === 'PATCH') void applyPatch()
    if (retryStage === 'VALIDATE') void validateStrategy()
    if (retryStage === 'CHALLENGE') void createChallenge()
    if (retryStage === 'APPROVE') void approveStrategy()
  }

  const startBacktest = () => {
    setProgressIndex(0)
    setStep('BACKTESTING')
  }

  const restart = () => {
    journeyEpochRef.current += 1
    fixtureTransport.reset()
    adapter.startSession()
    setStep('EMPTY')
    setIdea('')
    setSubmittedIdea('')
    setSnapshot(null)
    setTurn(null)
    setReceipt(null)
    setChallenge(null)
    setApproval(null)
    setAcknowledged(false)
    setErrorCode(null)
    setRetryStage(null)
    setProgressIndex(0)
    refreshAudit()
  }

  return (
    <div className="v03j-shell" data-testid="v03-journey" data-source={SERVICE_V03_JOURNEY_SOURCE}>
      <a className="v03j-skip" href="#v03j-main">본문으로 건너뛰기</a>
      <div className="v03j-notice" role="note">
        <FlaskConical aria-hidden="true" size={16} />
        <strong>내부 Mock POC</strong>
        <span>{FIXTURE_SCOPE_NOTICE}</span>
      </div>

      <header className="v03j-header">
        <button type="button" className="v03j-brand" onClick={restart} aria-label="TESIA AI 내부 Mock 처음으로">
          <span className="v03j-brand-mark">T</span>
          <span>TESIA <b>AI</b></span>
        </button>
        <div className="v03j-header-state" aria-label="연결 상태">
          <span aria-hidden="true" /> Memory-only fixture
        </div>
      </header>

      <div className="v03j-sr-only" role="status" aria-atomic="true">{liveMessage(step)}</div>

      <main id="v03j-main" className="v03j-main" aria-busy={busy}>
        <aside className="v03j-rail" aria-label="진행 단계">
          <p className="v03j-eyebrow">Strategy journey</p>
          <h1>아이디어를<br />검증 가능한 전략으로</h1>
          <ol>
            {[
              ['01', '아이디어 대화', step !== 'EMPTY'],
              ['02', '전략 구조화', !['EMPTY', 'CREATING'].includes(step)],
              ['03', '계약 검증', ['VALIDATED', 'CHALLENGING', 'APPROVAL_READY', 'APPROVING', 'APPROVED', 'BACKTESTING', 'RESULT'].includes(step)],
              ['04', '명시적 승인', ['APPROVED', 'BACKTESTING', 'RESULT'].includes(step)],
              ['05', 'Mock 결과', step === 'RESULT'],
            ].map(([number, label, complete]) => (
              <li key={String(number)} className={complete ? 'is-complete' : ''}>
                <span>{complete ? <Check size={14} aria-hidden="true" /> : number}</span>
                {label}
              </li>
            ))}
          </ol>
          <div className="v03j-rail-lock">
            <LockKeyhole size={17} aria-hidden="true" />
            <span>실거래·주문·거래소 연결 잠김</span>
          </div>
        </aside>

        <section className="v03j-workspace">
          {step === 'EMPTY' && (
            <div className="v03j-empty">
              <div className="v03j-empty-icon"><Sparkles aria-hidden="true" /></div>
              <p className="v03j-eyebrow">말하듯 시작하세요</p>
              <h2>어떤 전략을 만들고 싶으세요?</h2>
              <p>어떤 입력을 넣어도 동일한 고정 계약 fixture를 보여주는 내부 화면 흐름 시연입니다.</p>
              <form onSubmit={submitIdea} className="v03j-composer">
                <label htmlFor="v03j-idea">매매 전략 아이디어</label>
                <textarea
                  id="v03j-idea"
                  value={idea}
                  onChange={(event) => setIdea(event.target.value)}
                  placeholder="예: BTC 15분봉에서 RSI가 낮을 때 진입하고 싶어요"
                  maxLength={4000}
                  required
                />
                <div className="v03j-composer-footer">
                  <button type="button" className="v03j-text-button" onClick={() => setIdea(SERVICE_V03_JOURNEY_FIXTURE.idea)}>
                    예시 전략 채우기
                  </button>
                  <button type="submit" className="v03j-primary" disabled={idea.trim().length === 0}>
                    전략 만들기 <Send size={16} aria-hidden="true" />
                  </button>
                </div>
              </form>
              <p className="v03j-footnote">입력 내용은 브라우저 메모리에서만 사용되며 저장되지 않습니다.</p>
            </div>
          )}

          {step === 'CREATING' && (
            <LoadingPanel headingRef={sectionHeadingRef} title="아이디어를 계약 fixture에 맞춰 구조화하고 있어요" detail="대화 생성과 turn 응답을 generated v0.3 client로 검증 중" />
          )}

          {step === 'ERROR' && (
            <div className="v03j-state-card v03j-error" role="alert">
              <AlertCircle aria-hidden="true" />
              <h2 ref={sectionHeadingRef} tabIndex={-1}>Mock 흐름을 완료하지 못했습니다</h2>
              <p>안전한 오류 코드: <code>{errorCode}</code></p>
              <p>실제 요청이나 주문은 전송되지 않았습니다. 동일한 내부 fixture 단계를 다시 시도할 수 있습니다.</p>
              <button type="button" className="v03j-primary" onClick={retry}>
                <RotateCcw size={16} aria-hidden="true" /> 다시 시도
              </button>
            </div>
          )}

          {['SUMMARY', 'PATCHING', 'PATCHED', 'VALIDATING', 'VALIDATED', 'CHALLENGING', 'APPROVAL_READY', 'APPROVING', 'APPROVED', 'BACKTESTING', 'RESULT'].includes(step) && (
            <div className="v03j-journey-content">
              <div className="v03j-conversation">
                <div className="v03j-message is-user">
                  <span>나</span><p>{submittedIdea}</p>
                </div>
                <div className="v03j-message is-ai">
                  <span><MessageSquareText size={15} aria-hidden="true" /> TESIA</span>
                  <p>아래 내용은 입력을 해석한 결과가 아닌 고정 계약 fixture입니다. 변경과 제한을 확인해 주세요.</p>
                </div>
              </div>

              <div className="v03j-section-heading">
                <div>
                  <p className="v03j-eyebrow">Structured strategy</p>
                  <h2 ref={['SUMMARY', 'PATCHING', 'PATCHED'].includes(step) ? sectionHeadingRef : undefined} tabIndex={-1}>전략 요약</h2>
                </div>
                <span className="v03j-contract-pill"><ShieldCheck size={15} aria-hidden="true" /> v0.3 검증 경로</span>
              </div>

              <dl className="v03j-facts">
                {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>

              {displayedPatch !== null && (
                <section className="v03j-diff" aria-labelledby="v03j-diff-title">
                  <div>
                    <p className="v03j-eyebrow">DraftPatch · fixed fixture</p>
                    <h3 id="v03j-diff-title">고정 fixture가 제안한 변경</h3>
                  </div>
                  <div className="v03j-diff-row">
                    <span className="is-before">{displayedPatch.before}</span>
                    <ArrowRight size={17} aria-hidden="true" />
                    <span className="is-after">{displayedPatch.after}</span>
                  </div>
                  <p>operation: <code>{displayedPatch.operation}</code></p>
                </section>
              )}

              {step === 'SUMMARY' && (
                <div className="v03j-action-row">
                  <div><strong>다음: 수정안 적용</strong><span>고정 fixture DraftPatch를 현재 revision에 적용합니다.</span></div>
                  <button type="button" className="v03j-primary" onClick={() => void applyPatch()}>
                    수정안 적용 <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
              )}

              {step === 'PATCHING' && <InlineLoading label="DraftPatch와 revision 결속을 확인 중" />}

              {step === 'PATCHED' && (
                <div className="v03j-action-row">
                  <div><strong>수정안 적용 완료</strong><span>이제 구조와 위험 제한 입력을 계약으로 검증합니다.</span></div>
                  <button type="button" className="v03j-primary" onClick={() => void validateStrategy()}>
                    전략 검증하기 <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
              )}

              {step === 'VALIDATING' && <InlineLoading label="Strategy AST와 위험 제한을 확인 중" />}

              {step === 'VALIDATED' && receipt !== null && (
                <div className="v03j-success-card">
                  <CheckCircle2 aria-hidden="true" />
                  <div><h2 ref={sectionHeadingRef} tabIndex={-1}>계약 검증 통과</h2><p>VALID · receipt {shortHash(receipt.validationReceiptId)}</p></div>
                  <button type="button" className="v03j-primary" onClick={() => void createChallenge()}>
                    승인 절차 시작 <ChevronRight size={17} aria-hidden="true" />
                  </button>
                </div>
              )}

              {step === 'CHALLENGING' && <InlineLoading label="승인 대상 semantic hash를 고정 중" />}

              {step === 'APPROVAL_READY' && challenge !== null && (
                <section className="v03j-approval" aria-labelledby="v03j-approval-title">
                  <div className="v03j-approval-icon"><FileCheck2 aria-hidden="true" /></div>
                  <div>
                    <p className="v03j-eyebrow">Explicit approval</p>
                    <h2 id="v03j-approval-title" ref={sectionHeadingRef} tabIndex={-1}>전략 버전 생성을 명시적으로 승인해 주세요</h2>
                    <p>승인은 이 Mock 전략 후보에만 결속됩니다. 거래 권한이나 주문 권한은 부여하지 않습니다.</p>
                    <dl className="v03j-binding-list">
                      <div><dt>Semantic hash</dt><dd><code>{shortHash(challenge.semanticHash)}</code></dd></div>
                      <div><dt>Challenge</dt><dd><code>{shortHash(challenge.approvalChallengeId)}</code></dd></div>
                    </dl>
                    <label className="v03j-checkbox">
                      <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
                      <span>위 전략 내용과 Mock-only 제한을 확인했습니다.</span>
                    </label>
                    <button type="button" className="v03j-primary" disabled={!acknowledged} onClick={() => void approveStrategy()}>
                      <ShieldCheck size={17} aria-hidden="true" /> 전략 승인
                    </button>
                  </div>
                </section>
              )}

              {step === 'APPROVING' && <InlineLoading label="receipt·challenge·semantic hash 결속을 확인 중" />}

              {step === 'APPROVED' && approval !== null && (
                <div className="v03j-success-card is-wide">
                  <CheckCircle2 aria-hidden="true" />
                  <div>
                    <h2 ref={sectionHeadingRef} tabIndex={-1}>Mock 전략 버전 생성 완료</h2>
                    <p>{approval.strategyVersionId} · 실제 실행 권한 없음</p>
                  </div>
                  <button type="button" className="v03j-primary" onClick={startBacktest}>
                    <Play size={16} aria-hidden="true" /> Mock 백테스트 시작
                  </button>
                </div>
              )}

              {step === 'BACKTESTING' && (
                <section className="v03j-progress" aria-labelledby="v03j-progress-title">
                  <div className="v03j-progress-top">
                    <div><p className="v03j-eyebrow">Mock progress</p><h3 id="v03j-progress-title">백테스트 화면 흐름 준비 중</h3></div>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="v03j-progress-track" role="progressbar" aria-label="Mock 백테스트 준비 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <ol>
                    {BACKTEST_STAGES.map((label, index) => (
                      <li key={label} className={index < progressIndex ? 'is-done' : index === progressIndex ? 'is-current' : ''}>
                        {index < progressIndex ? <Check size={14} aria-hidden="true" /> : <CircleDashed size={14} aria-hidden="true" />} {label}
                      </li>
                    ))}
                  </ol>
                  <p>{FIXTURE_SCOPE_NOTICE}</p>
                </section>
              )}

              {step === 'RESULT' && (
                <section className="v03j-results" aria-labelledby="v03j-results-title">
                  <div className="v03j-results-heading">
                    <div><p className="v03j-eyebrow">BacktestResult placeholder</p><h2 id="v03j-results-title" ref={sectionHeadingRef} tabIndex={-1}>검증 결과 화면</h2></div>
                    <span>실제 replay 미연결</span>
                  </div>
                  <div className="v03j-result-grid">
                    {['순수익률', 'MDD', '승률', '거래 수', 'Fee · Slippage · Funding', 'IS / OOS 차이'].map((label) => (
                      <article key={label}><span>{label}</span><strong>계산 미연결</strong><small>실제 replay 결과 연결 전</small></article>
                    ))}
                  </div>
                  <div className="v03j-limitations">
                    <AlertCircle aria-hidden="true" />
                    <div><h4>청산 지표 제한</h4><p><code>currentMmrVerified=false</code></p><p><code>liquidationCheckStatus=UNAVAILABLE</code></p><p>정확한 청산가·거리·invalid 판정을 제공하지 않습니다.</p></div>
                  </div>
                  <div className="v03j-trades-empty">
                    <CircleDashed aria-hidden="true" />
                    <h4>Trade list 미연결</h4>
                    <p>허구 거래 내역을 만들지 않습니다. 실제 replay artifact가 검증되면 이 영역에 표시됩니다.</p>
                  </div>
                  <div className="v03j-result-actions">
                    <button type="button" className="v03j-secondary" onClick={restart}>
                      <RotateCcw size={16} aria-hidden="true" /> 처음부터 다시 시작
                    </button>
                    <button type="button" className="v03j-locked" disabled>
                      <LockKeyhole size={16} aria-hidden="true" /> 실거래 실행 잠김
                    </button>
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="v03j-footer" data-operations={transportAudit.operations.join(',')}>
        <span>{SERVICE_V03_JOURNEY_SOURCE}</span>
        <span>호출 단계 {transportAudit.transportCount} · 브라우저 메모리 전용</span>
      </footer>
    </div>
  )
}

function LoadingPanel({
  headingRef,
  title,
  detail,
}: Readonly<{
  headingRef: RefObject<HTMLHeadingElement | null>
  title: string
  detail: string
}>) {
  return (
    <div className="v03j-state-card">
      <div className="v03j-spinner" aria-hidden="true" />
      <h2 ref={headingRef} tabIndex={-1}>{title}</h2>
      <p>{detail}</p>
    </div>
  )
}

function InlineLoading({ label }: Readonly<{ label: string }>) {
  return (
    <div className="v03j-inline-loading" role="status">
      <span className="v03j-spinner" aria-hidden="true" /> {label}
    </div>
  )
}
