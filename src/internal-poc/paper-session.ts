export const LOCAL_RECORDED_PAPER_SESSION_MARKER = 'LOCAL_RECORDED_PAPER_SESSION'

export const RECORDED_PAPER_PROVENANCE = {
  dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE',
  verification: 'UNVERIFIED',
  rights: 'PRIVATE_ONLY',
  label: '실제 Paper 엔진 실행·합성 기록 시장 데이터',
} as const

export const OWNER_RECORDED_PAPER_PROVENANCE = {
  dataClass: 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT',
  verification: 'UNVERIFIED',
  rights: 'PRIVATE_ONLY',
  label: '실제 Paper 엔진 실행·소유자 로컬 공개시장 기록 데이터',
} as const

export type PaperSessionProvenance = typeof RECORDED_PAPER_PROVENANCE | typeof OWNER_RECORDED_PAPER_PROVENANCE

export const RECORDED_PAPER_UNEVALUATED_EXIT_RULE_IDS = [
  'exit_stop',
  'exit_take',
] as const

export type PaperStrategyBinding = Readonly<{
  strategyVersionId: string
  semanticHash: string
}>

export type PaperSessionStage =
  | 'QUEUED'
  | 'RUNNING'
  | 'CHECKPOINT_RECORDED'
  | 'RESTART_RESTORED'
  | 'COMPLETED_LOCAL_FIXTURE_ONLY'
  | 'COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY'
  | 'FAILED'

export type PaperLedger = Readonly<{
  initialWallet: string
  markPrice: string
  wallet: string
  equity: string
  quantity: string
  averageEntry: string
  realizedPnl: string
  unrealizedPnl: string
  fees: string
  funding: string
}>

export type PaperExecutionSummary = Readonly<{
  evaluationCandleCount: number
  recordedMarketEventCount: number
  signalCount: number
  intentCount: number
  fillCount: number
  signalHash: string
  orderIntentHash: string
  fillHashes: readonly string[]
  ledger: PaperLedger
}>

export type PaperRestartSummary = Readonly<{
  firstCheckpointRevision: number
  terminalCheckpointRevision: number
  fencingToken: number
  duplicateIntentCount: number
  duplicateEventCount: number
  newFillCountAfterDuplicateReplay: number
}>

export type PaperSessionSnapshot = Readonly<{
  artifactVersion: 'paper-session-view/1'
  sessionId: string
  stage: PaperSessionStage
  viewSource: 'RECORDED_UI_FALLBACK' | 'OWNER_LOCAL_API'
  requestedStrategy: PaperStrategyBinding
  recordedStrategy: PaperStrategyBinding
  fixtureId: string
  provenance: PaperSessionProvenance
  revision?: string
  attempt?: string
  failureCode?: string
  strategyCoverage?: Readonly<{
    entryRuleEvaluated: true
    riskLimitsApplied: true
    exitRulesEvaluated: false
    unevaluatedExitRuleIds: readonly string[]
  }>
  externalEffects?: Readonly<{
    evidenceKind: 'STATIC_OFFLINE_CAPABILITY_BOUNDARY'
    networkCalls: 0
    exchangeCalls: 0
    credentialReads: 0
    orders: 0
  }>
  restart?: PaperRestartSummary
  execution?: PaperExecutionSummary
  fixtureFileSha256?: string
  ledgerHash?: string
  replayEqual?: true
  replayHash?: string
  reportHash?: string
  marketArtifact?: PaperSessionMarketArtifactBinding
}>

export type PaperSessionRead = Readonly<{
  snapshot: PaperSessionSnapshot | null
  recoverySource: 'NONE' | 'UI_FALLBACK' | 'ACTIVE_PAPER'
}>

export type PaperSessionMutationContext = Readonly<{
  csrfToken: string
}>

export type PaperSessionMarketArtifactBinding = Readonly<{
  artifactId: string
  source: 'PACKAGED_SYNTHETIC' | 'OWNER_RECORDED_LOCAL_ARTIFACT'
  fileSha256: string
  contentHash: string
  provenanceHash: string
  policyHash: string
  manifestSha256: string | null
  verificationStatus: 'SYNTHETIC_ONLY' | 'UNVERIFIED_FOR_TRADING'
}>

/**
 * UI-only port. It is deliberately not a backend API contract.
 * A future loopback adapter must translate its independently approved endpoint
 * and validate the active-paper recovery binding before returning a snapshot.
 */
export interface PaperSessionAdapter {
  readonly kind: 'recorded-ui-fallback' | 'owner-local-api'
  readonly label: string
  readActive(requestedStrategy: PaperStrategyBinding): Promise<PaperSessionRead>
  startSession(requestedStrategy: PaperStrategyBinding, context: PaperSessionMutationContext): Promise<PaperSessionRead>
  startSessionForArtifact?(
    requestedStrategy: PaperStrategyBinding,
    context: PaperSessionMutationContext,
    artifact: PaperSessionMarketArtifactBinding,
  ): Promise<PaperSessionRead>
  refreshSession(sessionId: string, requestedStrategy: PaperStrategyBinding): Promise<PaperSessionRead>
  hasPendingRequest?(): boolean
  invalidateArtifactBinding?(artifactId: string): void
  resetLocalView?(): void
}

const HASH_PATTERN = /^[0-9a-f]{64}$/

const isBinding = (value: unknown): value is PaperStrategyBinding => {
  if (typeof value !== 'object' || value === null) return false
  const binding = value as Record<string, unknown>
  return typeof binding.strategyVersionId === 'string'
    && binding.strategyVersionId.length > 0
    && typeof binding.semanticHash === 'string'
    && HASH_PATTERN.test(binding.semanticHash)
}

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

const isNonNegativeInteger = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0

const isHash = (value: unknown): value is string => typeof value === 'string' && HASH_PATTERN.test(value)

const isProvenance = (value: unknown): value is PaperSessionProvenance => {
  if (typeof value !== 'object' || value === null) return false
  const provenance = value as Record<string, unknown>
  return hasExactKeys(provenance, ['dataClass', 'verification', 'rights', 'label'])
    && provenance.verification === RECORDED_PAPER_PROVENANCE.verification
    && provenance.rights === RECORDED_PAPER_PROVENANCE.rights
    && ((provenance.dataClass === RECORDED_PAPER_PROVENANCE.dataClass
      && provenance.label === RECORDED_PAPER_PROVENANCE.label)
      || (provenance.dataClass === OWNER_RECORDED_PAPER_PROVENANCE.dataClass
        && provenance.label === OWNER_RECORDED_PAPER_PROVENANCE.label))
}

const isRestart = (value: unknown): value is PaperRestartSummary => {
  if (typeof value !== 'object' || value === null) return false
  const restart = value as Record<string, unknown>
  const keys = [
    'firstCheckpointRevision',
    'terminalCheckpointRevision',
    'fencingToken',
    'duplicateIntentCount',
    'duplicateEventCount',
    'newFillCountAfterDuplicateReplay',
  ] as const
  return hasExactKeys(restart, keys) && keys.every((key) => isNonNegativeInteger(restart[key]))
}

const isLedger = (value: unknown): value is PaperLedger => {
  if (typeof value !== 'object' || value === null) return false
  const ledger = value as Record<string, unknown>
  const keys = [
    'initialWallet',
    'markPrice',
    'wallet',
    'equity',
    'quantity',
    'averageEntry',
    'realizedPnl',
    'unrealizedPnl',
    'fees',
    'funding',
  ] as const
  return hasExactKeys(ledger, keys) && keys.every((key) => typeof ledger[key] === 'string')
}

const isExecution = (value: unknown): value is PaperExecutionSummary => {
  if (typeof value !== 'object' || value === null) return false
  const execution = value as Record<string, unknown>
  const countKeys = ['evaluationCandleCount', 'recordedMarketEventCount', 'signalCount', 'intentCount', 'fillCount'] as const
  return hasExactKeys(execution, [...countKeys, 'signalHash', 'orderIntentHash', 'fillHashes', 'ledger'])
    && countKeys.every((key) => isNonNegativeInteger(execution[key]))
    && isHash(execution.signalHash)
    && isHash(execution.orderIntentHash)
    && Array.isArray(execution.fillHashes)
    && execution.fillHashes.every(isHash)
    && isLedger(execution.ledger)
}

export const isPaperSessionSnapshot = (value: unknown): value is PaperSessionSnapshot => {
  if (typeof value !== 'object' || value === null) return false
  const snapshot = value as Record<string, unknown>
  const requiredKeys = [
    'artifactVersion',
    'sessionId',
    'stage',
    'viewSource',
    'requestedStrategy',
    'recordedStrategy',
    'fixtureId',
    'provenance',
  ]
  const optionalKeys = [
    'revision',
    'attempt',
    'failureCode',
    'strategyCoverage',
    'externalEffects',
    'restart',
    'execution',
    'fixtureFileSha256',
    'ledgerHash',
    'replayEqual',
    'replayHash',
    'reportHash',
    'marketArtifact',
  ]
  if (!Object.keys(snapshot).every((key) => requiredKeys.includes(key) || optionalKeys.includes(key))) return false
  if (!requiredKeys.every((key) => key in snapshot)) return false
  if (
    snapshot.artifactVersion !== 'paper-session-view/1'
    || typeof snapshot.sessionId !== 'string'
    || snapshot.sessionId.length === 0
    || !['QUEUED', 'RUNNING', 'CHECKPOINT_RECORDED', 'RESTART_RESTORED', 'COMPLETED_LOCAL_FIXTURE_ONLY', 'COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY', 'FAILED'].includes(String(snapshot.stage))
    || !['RECORDED_UI_FALLBACK', 'OWNER_LOCAL_API'].includes(String(snapshot.viewSource))
    || !isBinding(snapshot.requestedStrategy)
    || !isBinding(snapshot.recordedStrategy)
    || typeof snapshot.fixtureId !== 'string'
    || snapshot.fixtureId.length === 0
    || !isProvenance(snapshot.provenance)
    || (snapshot.revision !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(String(snapshot.revision)))
    || (snapshot.attempt !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(String(snapshot.attempt)))
    || (snapshot.failureCode !== undefined && (typeof snapshot.failureCode !== 'string' || snapshot.failureCode.length === 0))
  ) return false

  const coverage = snapshot.strategyCoverage
  if (coverage !== undefined) {
    if (typeof coverage !== 'object' || coverage === null) return false
    const coverageRecord = coverage as Record<string, unknown>
    if (
      !hasExactKeys(coverageRecord, ['entryRuleEvaluated', 'riskLimitsApplied', 'exitRulesEvaluated', 'unevaluatedExitRuleIds'])
      || coverageRecord.entryRuleEvaluated !== true
      || coverageRecord.riskLimitsApplied !== true
      || coverageRecord.exitRulesEvaluated !== false
      || !Array.isArray(coverageRecord.unevaluatedExitRuleIds)
      || coverageRecord.unevaluatedExitRuleIds.length === 0
      || !coverageRecord.unevaluatedExitRuleIds.every((item) => typeof item === 'string' && item.length > 0)
    ) return false
  }

  const effects = snapshot.externalEffects
  if (effects !== undefined) {
    if (typeof effects !== 'object' || effects === null) return false
    const effectsRecord = effects as Record<string, unknown>
    if (
      !hasExactKeys(effectsRecord, ['evidenceKind', 'networkCalls', 'exchangeCalls', 'credentialReads', 'orders'])
      || effectsRecord.evidenceKind !== 'STATIC_OFFLINE_CAPABILITY_BOUNDARY'
      || effectsRecord.networkCalls !== 0
      || effectsRecord.exchangeCalls !== 0
      || effectsRecord.credentialReads !== 0
      || effectsRecord.orders !== 0
    ) return false
  }

  if (snapshot.marketArtifact !== undefined) {
    const artifact = snapshot.marketArtifact as Record<string, unknown>
    if (!hasExactKeys(artifact, [
      'artifactId', 'source', 'fileSha256', 'contentHash', 'provenanceHash',
      'policyHash', 'manifestSha256', 'verificationStatus',
    ])) return false
    const owner = artifact.source === 'OWNER_RECORDED_LOCAL_ARTIFACT'
    if (
      typeof artifact.artifactId !== 'string'
      || artifact.artifactId.length === 0
      || !isHash(artifact.fileSha256)
      || !isHash(artifact.contentHash)
      || !isHash(artifact.provenanceHash)
      || !isHash(artifact.policyHash)
      || (owner
        ? artifact.verificationStatus !== 'UNVERIFIED_FOR_TRADING' || !isHash(artifact.manifestSha256)
        : artifact.source !== 'PACKAGED_SYNTHETIC'
          || artifact.verificationStatus !== 'SYNTHETIC_ONLY'
          || artifact.manifestSha256 !== null)
    ) return false
  }

  const completed = snapshot.stage === 'COMPLETED_LOCAL_FIXTURE_ONLY'
    || snapshot.stage === 'COMPLETED_OWNER_LOCAL_MARKET_ARTIFACT_ONLY'
  if (completed) {
    return snapshot.failureCode === undefined
      && coverage !== undefined
      && effects !== undefined
      && isRestart(snapshot.restart)
      && isExecution(snapshot.execution)
      && isHash(snapshot.fixtureFileSha256)
      && isHash(snapshot.ledgerHash)
      && snapshot.replayEqual === true
      && isHash(snapshot.replayHash)
      && isHash(snapshot.reportHash)
  }
  return (snapshot.stage === 'FAILED' ? snapshot.failureCode !== undefined : snapshot.failureCode === undefined)
    && snapshot.strategyCoverage === undefined
    && snapshot.externalEffects === undefined
    && snapshot.restart === undefined
    && snapshot.execution === undefined
    && snapshot.fixtureFileSha256 === undefined
    && snapshot.ledgerHash === undefined
    && snapshot.replayEqual === undefined
    && snapshot.replayHash === undefined
    && snapshot.reportHash === undefined
}

export const samePaperStrategyBinding = (left: PaperStrategyBinding, right: PaperStrategyBinding): boolean => (
  left.strategyVersionId === right.strategyVersionId && left.semanticHash === right.semanticHash
)

export const assertPaperSessionSnapshot = (snapshot: unknown): PaperSessionSnapshot => {
  if (!isPaperSessionSnapshot(snapshot)) throw new Error('PAPER_UI_SNAPSHOT_INVALID')
  return snapshot
}
