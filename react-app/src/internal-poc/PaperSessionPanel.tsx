import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  FileClock,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PaperMarketArtifactPicker } from './PaperMarketArtifactPicker'
import type { PaperMarketArtifact, PaperMarketArtifactCatalogAdapter } from './paper-market-artifact'
import type {
  PaperSessionAdapter,
  PaperSessionSnapshot,
  PaperSessionStage,
  PaperStrategyBinding,
} from './paper-session'
import {
  assertPaperSessionSnapshot,
  OWNER_RECORDED_PAPER_PROVENANCE,
  RECORDED_PAPER_PROVENANCE,
  RECORDED_PAPER_UNEVALUATED_EXIT_RULE_IDS,
  samePaperStrategyBinding,
} from './paper-session'
import {
  describePaperExecutionFailure,
  describePaperSessionIssue,
  type PaperUiIssue,
} from './paper-service-status'

const stages: readonly PaperSessionStage[] = [
  'CHECKPOINT_RECORDED',
  'RESTART_RESTORED',
]

const actualStages: readonly PaperSessionStage[] = ['QUEUED', 'RUNNING', 'COMPLETED_LOCAL_FIXTURE_ONLY']

const stageLabel: Record<PaperSessionStage, string> = {
  QUEUED: '서버 실행 대기',
  RUNNING: '서버 Paper 실행 중',
  CHECKPOINT_RECORDED: 'Checkpoint revision 1',
  RESTART_RESTORED: '재시작 복원 · revision 2',
  COMPLETED_LOCAL_FIXTURE_ONLY: '기록 결과 확인',
  COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY: '소유자 로컬 기록 결과 확인',
  FAILED: '서버 실행 실패',
}

const shortHash = (value: string): string => `${value.slice(0, 8)}…${value.slice(-6)}`

const paperMoney = (value: string): string => {
  return `${value} USDT`
}

const artifactMatchesSnapshot = (artifact: PaperMarketArtifact, snapshot: PaperSessionSnapshot): boolean => {
  const binding = snapshot.marketArtifact
  return binding !== undefined
    && artifact.artifactId === binding.artifactId
    && artifact.source === binding.source
    && artifact.fileSha256 === binding.fileSha256
    && artifact.contentHash === binding.contentHash
    && artifact.provenanceHash === binding.provenanceHash
    && artifact.policyHash === binding.policyHash
    && artifact.manifestSha256 === binding.manifestSha256
    && artifact.provenance.verificationStatus === binding.verificationStatus
}

function PaperBoundary({ fallback, owner }: { fallback: boolean; owner: boolean }) {
  return (
    <div className="paper-boundary" aria-label="Paper 데이터 출처와 사용 제한">
      <ShieldAlert size={18} aria-hidden="true" />
      <div>
        <strong>{owner ? OWNER_RECORDED_PAPER_PROVENANCE.label : RECORDED_PAPER_PROVENANCE.label}</strong>
        <span>
          {owner ? 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT · UNVERIFIED_FOR_TRADING · PRIVATE_ONLY' : `${RECORDED_PAPER_PROVENANCE.dataClass} · ${RECORDED_PAPER_PROVENANCE.verification} · ${RECORDED_PAPER_PROVENANCE.rights}`}
        </span>
      </div>
      <p>{fallback
        ? '원본 artifact와 결속되지 않은 UI 상태 시연입니다. 현재 시장, Demo, 주문 또는 실행 증거가 아닙니다.'
        : owner
          ? '사용자 소유 로컬 기록이며 출처·실시간·성과·거래 검증 전입니다. 현재 시장, Demo, 주문 또는 수익성 증거가 아닙니다.'
          : '합성 기록 입력의 owner-local 실행 경계입니다. 현재 시장, Demo, 주문 또는 수익성 증거가 아닙니다.'}</p>
    </div>
  )
}

function PaperLoading() {
  return (
    <div className="paper-loading" aria-busy="true" aria-live="polite">
      <LoaderCircle className="spin" size={20} aria-hidden="true" />
      <div><strong>기록 상태를 확인하고 있습니다.</strong><span>브라우저에서 결과를 계산하지 않습니다.</span></div>
    </div>
  )
}

function PaperResult({ snapshot }: { snapshot: PaperSessionSnapshot }) {
  if (
    snapshot.execution === undefined
    || snapshot.restart === undefined
    || snapshot.strategyCoverage === undefined
  ) return null
  const { execution, restart } = snapshot
  const ledger = execution.ledger
  return (
    <div className="paper-result">
      <div className="paper-metric-grid" aria-label="Paper ledger 요약">
        <div><span>Wallet</span><strong>{paperMoney(ledger.wallet)}</strong><small>초기 {paperMoney(ledger.initialWallet)}</small></div>
        <div><span>Equity</span><strong>{paperMoney(ledger.equity)}</strong><small>미실현 {paperMoney(ledger.unrealizedPnl)}</small></div>
        <div><span>Position</span><strong>{ledger.quantity} BTC</strong><small>평균 진입 {ledger.averageEntry}</small></div>
        <div><span>Cost</span><strong>{paperMoney(ledger.fees)}</strong><small>funding {paperMoney(ledger.funding)}</small></div>
      </div>

      <div className="paper-evidence-grid">
        <section aria-labelledby="paper-count-title">
          <div className="paper-subheading"><Database size={17} /><h3 id="paper-count-title">처리 건수</h3></div>
          <dl>
            <div><dt>평가 candle</dt><dd>{execution.evaluationCandleCount}</dd></div>
            <div><dt>기록 MarketEvent</dt><dd>{execution.recordedMarketEventCount}</dd></div>
            <div><dt>Signal / Intent / Fill</dt><dd>{execution.signalCount} / {execution.intentCount} / {execution.fillCount}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="paper-restart-title">
          <div className="paper-subheading"><FileClock size={17} /><h3 id="paper-restart-title">복구·중복 방어</h3></div>
          <dl>
            <div><dt>Checkpoint</dt><dd>{restart.firstCheckpointRevision} → {restart.terminalCheckpointRevision}</dd></div>
            <div><dt>Fencing token</dt><dd>{restart.fencingToken}</dd></div>
            <div><dt>중복 Intent / Event</dt><dd>{restart.duplicateIntentCount} / {restart.duplicateEventCount}</dd></div>
            <div><dt>중복 후 새 fill</dt><dd>{restart.newFillCountAfterDuplicateReplay}</dd></div>
          </dl>
        </section>
      </div>

      <details className="paper-hashes">
        <summary>결정·replay 무결성 값</summary>
        <dl>
          <div><dt>Signal</dt><dd><code>{execution.signalHash}</code></dd></div>
          <div><dt>OrderIntent</dt><dd><code>{execution.orderIntentHash}</code></dd></div>
          <div><dt>Fill</dt><dd><code>{execution.fillHashes.join(', ')}</code></dd></div>
          <div><dt>Fixture file</dt><dd><code>{snapshot.fixtureFileSha256}</code></dd></div>
          {snapshot.marketArtifact !== undefined && <>
            <div><dt>Artifact content</dt><dd><code>{snapshot.marketArtifact.contentHash}</code></dd></div>
            <div><dt>Provenance</dt><dd><code>{snapshot.marketArtifact.provenanceHash}</code></dd></div>
            <div><dt>Policy</dt><dd><code>{snapshot.marketArtifact.policyHash}</code></dd></div>
            <div><dt>Manifest</dt><dd><code>{snapshot.marketArtifact.manifestSha256 ?? '해당 없음'}</code></dd></div>
          </>}
          <div><dt>Ledger</dt><dd><code>{snapshot.ledgerHash}</code></dd></div>
          <div><dt>Replay</dt><dd><code>{snapshot.replayHash}</code></dd></div>
          <div><dt>Report</dt><dd><code>{snapshot.reportHash}</code></dd></div>
        </dl>
      </details>
    </div>
  )
}

export function PaperSessionPanel({
  adapterPromise,
  marketArtifactAdapterPromise,
  requestedStrategy,
  csrfToken,
}: {
  adapterPromise?: Promise<PaperSessionAdapter>
  marketArtifactAdapterPromise?: Promise<PaperMarketArtifactCatalogAdapter>
  requestedStrategy: PaperStrategyBinding
  csrfToken: string
}) {
  const [adapter, setAdapter] = useState<PaperSessionAdapter | null>(null)
  const [snapshot, setSnapshot] = useState<PaperSessionSnapshot | null>(null)
  const [loading, setLoading] = useState(adapterPromise !== undefined)
  const [error, setError] = useState<PaperUiIssue | null>(null)
  const [recoverySource, setRecoverySource] = useState<'UI_FALLBACK' | 'ACTIVE_PAPER' | null>(null)
  const [selectedMarketArtifact, setSelectedMarketArtifact] = useState<PaperMarketArtifact | null>(null)
  const [pendingRetryAvailable, setPendingRetryAvailable] = useState(false)
  const snapshotRef = useRef<PaperSessionSnapshot | null>(null)
  const requestedStrategyBinding = useMemo<PaperStrategyBinding>(() => ({
    strategyVersionId: requestedStrategy.strategyVersionId,
    semanticHash: requestedStrategy.semanticHash,
  }), [requestedStrategy.semanticHash, requestedStrategy.strategyVersionId])

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    let active = true
    if (adapterPromise === undefined) return () => { active = false }
    adapterPromise.then(async (nextAdapter) => {
      if (!active) return
      setAdapter(nextAdapter)
      const read = await nextAdapter.readActive(requestedStrategyBinding)
      if (!active) return
      setSnapshot(read.snapshot === null ? null : assertPaperSessionSnapshot(read.snapshot))
      setRecoverySource(read.recoverySource === 'NONE' ? null : read.recoverySource)
    }).catch((reason: unknown) => {
      if (active) setError(describePaperSessionIssue(reason))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [adapterPromise, requestedStrategyBinding])

  const bindingMatches = useMemo(
    () => snapshot === null ? false : samePaperStrategyBinding(snapshot.requestedStrategy, snapshot.recordedStrategy),
    [snapshot],
  )

  const start = async () => {
    if (adapter === null || loading) return
    setLoading(true)
    setError(null)
    setPendingRetryAvailable(false)
    try {
      const read = marketArtifactAdapterPromise === undefined
        ? await adapter.startSession(requestedStrategyBinding, { csrfToken })
        : selectedMarketArtifact === null
          ? (() => { throw new Error('PAPER_MARKET_ARTIFACT_SELECTION_REQUIRED') })()
          : adapter.startSessionForArtifact === undefined
            ? (() => { throw new Error('PAPER_MARKET_ARTIFACT_START_BINDING_UNAVAILABLE') })()
            : await adapter.startSessionForArtifact(requestedStrategyBinding, { csrfToken }, {
                artifactId: selectedMarketArtifact.artifactId,
                source: selectedMarketArtifact.source,
                fileSha256: selectedMarketArtifact.fileSha256,
                contentHash: selectedMarketArtifact.contentHash,
                provenanceHash: selectedMarketArtifact.provenanceHash,
                policyHash: selectedMarketArtifact.policyHash,
                manifestSha256: selectedMarketArtifact.manifestSha256,
                verificationStatus: selectedMarketArtifact.provenance.verificationStatus,
              })
      setSnapshot(read.snapshot === null ? null : assertPaperSessionSnapshot(read.snapshot))
      setRecoverySource(null)
    } catch (reason) {
      setError(describePaperSessionIssue(reason))
      setPendingRetryAvailable(adapter.hasPendingRequest?.() === true)
    } finally {
      setLoading(false)
    }
  }

  const selectMarketArtifact = useCallback((artifact: PaperMarketArtifact | null) => {
    const activeSnapshot = snapshotRef.current
    if (artifact !== null && activeSnapshot?.viewSource === 'OWNER_LOCAL_API') {
      if (artifactMatchesSnapshot(artifact, activeSnapshot)) setSelectedMarketArtifact(artifact)
      return
    }
    setSelectedMarketArtifact(artifact)
    setSnapshot(null)
    setRecoverySource(null)
    setError(null)
    setPendingRetryAvailable(false)
  }, [])

  const invalidateMarketArtifact = useCallback((artifactId: string) => {
    adapter?.invalidateArtifactBinding?.(artifactId)
    setSnapshot(null)
    setRecoverySource(null)
    setPendingRetryAvailable(false)
  }, [adapter])

  const readNext = async () => {
    if (adapter === null || snapshot === null || loading) return
    setLoading(true)
    setError(null)
    try {
      const read = await adapter.refreshSession(snapshot.sessionId, requestedStrategyBinding)
      setSnapshot(read.snapshot === null ? null : assertPaperSessionSnapshot(read.snapshot))
      setRecoverySource(read.recoverySource === 'NONE' ? null : read.recoverySource)
    } catch (reason) {
      setError(describePaperSessionIssue(reason))
    } finally {
      setLoading(false)
    }
  }

  const discardLocalRequest = () => {
    if (adapter === null || adapter.resetLocalView === undefined) {
      window.location.reload()
      return
    }
    adapter.resetLocalView()
    setSnapshot(null)
    setError(null)
    setRecoverySource(null)
    setPendingRetryAvailable(false)
  }

  const ownerArtifact = snapshot?.marketArtifact?.source === 'OWNER_RECORDED_LOCAL_ARTIFACT'
    || selectedMarketArtifact?.source === 'OWNER_RECORDED_LOCAL_ARTIFACT'
  const visibleStages = adapter?.kind === 'owner-local-api'
    ? (snapshot?.stage === 'FAILED' ? ['QUEUED', 'RUNNING', 'FAILED'] as const
      : ownerArtifact ? ['QUEUED', 'RUNNING', 'COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY'] as const : actualStages)
    : stages
  const currentStageIndex = snapshot === null ? -1 : visibleStages.indexOf(snapshot.stage)
  const fallback = adapter?.kind === 'recorded-ui-fallback'
  const eyebrow = fallback
    ? 'LOCAL_RECORDED_PAPER_SESSION · SOURCE_UNBOUND_UI_FALLBACK'
    : 'OWNER_LOCAL_PAPER_SESSION · PRIVATE_LOOPBACK_ONLY'
  const unevaluatedExitRuleIds = snapshot?.strategyCoverage?.unevaluatedExitRuleIds
    ?? RECORDED_PAPER_UNEVALUATED_EXIT_RULE_IDS
  const executionFailure = describePaperExecutionFailure()

  return (
    <section className="paper-session" aria-labelledby="paper-session-title">
      <div className="section-heading paper-title-row">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="paper-session-title">재시작 뒤에도 같은 기록 상태를 읽습니다.</h2>
        </div>
        <span className="status-pill warning"><AlertTriangle size={15} /> 내부 기록 전용</span>
      </div>

      <PaperBoundary fallback={fallback} owner={ownerArtifact} />

      {marketArtifactAdapterPromise !== undefined && (
        <PaperMarketArtifactPicker
          adapterPromise={marketArtifactAdapterPromise}
          onSelectionChange={selectMarketArtifact}
          onAuthorityInvalidated={invalidateMarketArtifact}
          authoritativeBinding={snapshot?.marketArtifact}
          lockedArtifactId={snapshot?.viewSource === 'OWNER_LOCAL_API' ? snapshot.fixtureId : null}
        />
      )}

      <div className="paper-coverage warning-surface paper-coverage-always" role="note">
        <AlertTriangle size={19} aria-hidden="true" />
        <div>
          <strong>이 fixture는 exit rule을 평가하지 않습니다.</strong>
          <p>exitRulesEvaluated=false · 미평가: {unevaluatedExitRuleIds.join(', ')}. Stop loss와 take profit 결과로 해석할 수 없습니다.</p>
        </div>
      </div>

      {loading && <PaperLoading />}

      {!loading && error !== null && (
        <div className="paper-error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>{error.title}</strong>
            <span>{error.description}</span>
            <code>{error.diagnosticCode}</code>
          </div>
          {pendingRetryAvailable && selectedMarketArtifact !== null && (
            <button type="button" className="secondary-button" onClick={() => void start()}><RotateCcw size={16} /> 동일 요청 재전송</button>
          )}
          <button type="button" className="secondary-button" onClick={discardLocalRequest}><RotateCcw size={16} /> {fallback ? '초기화 후 재시도' : '요청 명시적 폐기'}</button>
        </div>
      )}

      {!loading && error === null && adapter === null && (
        <div className="paper-empty">
          <ShieldAlert size={22} aria-hidden="true" />
          <div>
            <strong>Owner-local Paper adapter가 아직 연결되지 않았습니다.</strong>
            <p>Backend endpoint와 active-paper 복구 결속이 확정되기 전에는 브라우저가 API shape를 추측하거나 실행하지 않습니다.</p>
          </div>
        </div>
      )}

      {!loading && error === null && adapter !== null && snapshot === null && (
        <div className="paper-empty paper-ready">
          <Play size={22} aria-hidden="true" />
          <div>
            <strong>{fallback ? '출처 미결속 UI 기록을 확인할 수 있습니다.' : '승인된 현재 전략으로 owner-local Paper를 시작합니다.'}</strong>
            <p>{fallback
              ? '이 경로는 레이아웃과 상태 UI만 확인하며 terminal 결과 권위가 없습니다.'
              : '고정 fixture와 전략 semantic hash가 다르면 서버가 409로 거절하며 대체 전략을 만들지 않습니다.'}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => void start()}
              disabled={marketArtifactAdapterPromise !== undefined
                && (selectedMarketArtifact === null || adapter.startSessionForArtifact === undefined)}
            >
              <Play size={16} /> {fallback ? '기록 보기' : 'Paper 실행'}
            </button>
            {marketArtifactAdapterPromise !== undefined && selectedMarketArtifact === null && (
              <span className="paper-start-hint">서버 catalog에서 입력 artifact를 먼저 선택하세요.</span>
            )}
            {marketArtifactAdapterPromise !== undefined
              && selectedMarketArtifact !== null
              && adapter.startSessionForArtifact === undefined && (
                <span className="paper-start-hint">선택 UI만 준비됐습니다. 서버 start 결속이 연결되기 전에는 실행할 수 없습니다.</span>
              )}
          </div>
        </div>
      )}

      {!loading && error === null && snapshot !== null && (
        <>
          {recoverySource !== null && (
            <div className="paper-restored" role="status">
              <FileClock size={18} aria-hidden="true" />
              {recoverySource === 'ACTIVE_PAPER' ? (
                <div><strong>서버 active Paper session을 복원했습니다.</strong><span>브라우저 pointer와 서버의 session·StrategyVersion·semantic·fixture 결속을 다시 확인했습니다.</span></div>
              ) : (
                <div><strong>UI fallback 진행 위치를 복원했습니다.</strong><span>sessionStorage는 권위 증거가 아니며, 실제 연결 시 서버 active-paper 결속으로 대체됩니다.</span></div>
              )}
            </div>
          )}

          {!bindingMatches && (
            <div className="paper-binding-warning" role="note">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>현재 UI 전략을 실행한 결과가 아닙니다.</strong>
                <span>
                  화면 요청 {shortHash(snapshot.requestedStrategy.semanticHash)} · 기록 전략 {shortHash(snapshot.recordedStrategy.semanticHash)}.
                  결속 불일치 상태에서 성과 비교나 실행 주장을 하지 않습니다.
                </span>
              </div>
            </div>
          )}

          <ol className="paper-stage-track" aria-label="Paper 상태" aria-live="polite">
            {visibleStages.map((stage, index) => (
              <li key={stage} className={index < currentStageIndex ? 'done' : index === currentStageIndex ? 'current' : ''}>
                <span>{index < currentStageIndex ? <Check size={13} /> : index + 1}</span>
                <small>{stageLabel[stage]}</small>
              </li>
            ))}
          </ol>

          {snapshot.stage !== 'COMPLETED_LOCAL_FIXTURE_ONLY' && snapshot.stage !== 'COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY' && snapshot.stage !== 'FAILED' && (
            <div className="paper-next">
              <div>
                <strong>{stageLabel[snapshot.stage]}</strong>
                <span>{fallback
                  ? '가짜 timer 없이 다음 UI 기록을 명시적으로 엽니다.'
                  : `서버 상태 revision ${snapshot.revision ?? '미제공'} · attempt ${snapshot.attempt ?? '미제공'}를 그대로 표시합니다.`}</span>
              </div>
              <button type="button" className="secondary-button" onClick={() => void readNext()}>
                <RotateCcw size={16} /> {fallback ? '다음 기록 보기' : '새로고침'}
              </button>
            </div>
          )}

          {snapshot.stage === 'FAILED' && (
            <div className="paper-error" role="alert">
              <AlertTriangle size={20} aria-hidden="true" />
              <div>
                <strong>{executionFailure.title}</strong>
                <span>{executionFailure.description}</span>
                <code>{executionFailure.diagnosticCode}</code>
              </div>
            </div>
          )}

          {snapshot.stage === 'COMPLETED_LOCAL_FIXTURE_ONLY' && (
            <div className="paper-complete-heading" role="status">
              <CheckCircle2 size={21} aria-hidden="true" />
              <div><strong>COMPLETED_LOCAL_FIXTURE_ONLY</strong><span>서버 result와 status의 독립 hash 결속 및 ledger/report digest 재검증을 통과했습니다.</span></div>
            </div>
          )}

          {snapshot.stage === 'COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY' && (
            <div className="paper-complete-heading" role="status">
              <CheckCircle2 size={21} aria-hidden="true" />
              <div><strong>COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY</strong><span>PRIVATE_ONLY · UNVERIFIED_FOR_TRADING · 사용자 소유 로컬 기록·출처/실시간/성과/거래 검증 전</span></div>
            </div>
          )}

          <PaperResult snapshot={snapshot} />

          {adapter?.kind === 'owner-local-api' && (
            <div className="paper-next paper-discard-active">
              <div><strong>새 Paper session은 현재 로컬 재개 연결을 해제한 후 시작할 수 있습니다.</strong><span>서버의 기존 run은 취소·삭제되지 않으며, 선택만으로 active pointer를 덮어쓰지 않습니다.</span></div>
              <button type="button" className="secondary-button" onClick={discardLocalRequest}>로컬 재개 연결 해제</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
