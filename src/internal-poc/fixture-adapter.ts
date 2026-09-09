import {
  TesiaApiClient,
  createSdk,
  type ApiTransport,
  type BacktestJob,
  type DraftProjection,
  type DraftState,
  type EventStreamTransportResponse,
  type SourceProvenance,
  type TransportResponse,
  type VerifiedBacktestReport,
} from './contracts/generated/api-v0.1/index.js'
import type { InternalPocAdapter } from './adapter'

const FIXTURE_STATE_KEY = 'tesia-internal-poc-fixture-server-v1'
export const FIXTURE_RESPONSE_LOSS_KEY = 'tesia-internal-poc-fixture-response-loss-once'
export const FIXTURE_REPLAY_AUDIT_KEY = 'tesia-internal-poc-fixture-replay-audit'
const SHORTHAND_IDEA_PATTERN = /^BTC 15분 RSI (\d+) (아래면|이하면) 100 USDT 롱, 손절 2%, 익절 5%, 레버리지 2배$/
const HASH = {
  zero: '0000000000000000000000000000000000000000000000000000000000000000',
  projectionStage1: 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  projectionStage2: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  projectionStage3: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  projection: '1111111111111111111111111111111111111111111111111111111111111111',
  semantic: '39cbfd0090218a159ae03ef11e9d686482a644772dab291b03b864658caf2e46',
  strategy: '3333333333333333333333333333333333333333333333333333333333333333',
  profile: '4444444444444444444444444444444444444444444444444444444444444444',
  data: '5555555555555555555555555555555555555555555555555555555555555555',
  assumption: '6666666666666666666666666666666666666666666666666666666666666666',
  run: '7777777777777777777777777777777777777777777777777777777777777777',
  trust: '8888888888888888888888888888888888888888888888888888888888888888',
  isResult: '9999999999999999999999999999999999999999999999999999999999999999',
  oosResult: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  isTrade: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  oosTrade: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
} as const

const IDS = {
  conversation: 'conversation_fixture_0001',
  draft: 'draft_fixture_00000001',
  turn: 'turn_fixture_000000001',
  validation: 'validation_receipt_fixture_0001',
  challenge: 'approval_challenge_fixture_0001',
  strategy: 'sv_fixture_00000001',
  issuance: 'issuance_receipt_fixture_0001',
  backtest: 'backtest_fixture_00000001',
  split: 'split_fixture_00000001',
  verifier: 'verifier_receipt_fixture_0001',
} as const

const SOURCE: SourceProvenance = {
  source: 'SYNTHETIC_UI_FIXTURE',
  verification: 'UNVERIFIED',
  rights: 'PRIVATE_ONLY',
}

const PIN = {
  contracts: { name: 'tesia-contracts', version: '0.12.0rc2', commitSha: 'badad94a34908de7b608fd6c644cb8a0891d5d36' },
  evaluator: { name: 'tesia-evaluator', version: '0.1.0', commitSha: '1111111111111111111111111111111111111111' },
  risk: { name: 'tesia-risk-policy', version: '0.1.0', commitSha: '2222222222222222222222222222222222222222' },
  verifier: { name: 'tesia-local-verifier', version: '0.1.0', commitSha: '3333333333333333333333333333333333333333' },
  engine: { name: 'tesia-backtest-engine', version: '0.1.0', commitSha: '4444444444444444444444444444444444444444' },
} as const

interface FixtureServerState {
  readonly draftRevision: number
  readonly rsiPeriod: number
  readonly rsiThreshold: string
  readonly entryOperator: 'lt' | 'lte'
  readonly entryKind: 'rsi' | 'sma_cross'
  readonly conversationStage: 0 | 1 | 2 | 3 | 4
  readonly conversationCreated: boolean
  readonly approved: boolean
  readonly backtestPoll: number
}

const initialServerState = (): FixtureServerState => ({
  draftRevision: 1,
  rsiPeriod: 14,
  rsiThreshold: '30',
  entryOperator: 'lt',
  entryKind: 'rsi',
  conversationStage: 0,
  conversationCreated: false,
  approved: false,
  backtestPoll: 0,
})

const readServerState = (): FixtureServerState => {
  try {
    const stored = sessionStorage.getItem(FIXTURE_STATE_KEY)
    if (stored === null) return initialServerState()
    const parsed = JSON.parse(stored) as Partial<FixtureServerState>
    if (
      !Number.isInteger(parsed.draftRevision)
      || !Number.isInteger(parsed.rsiPeriod)
      || typeof parsed.rsiThreshold !== 'string'
      || !['lt', 'lte'].includes(parsed.entryOperator ?? '')
      || !['rsi', 'sma_cross'].includes(parsed.entryKind ?? '')
      || ![0, 1, 2, 3, 4].includes(parsed.conversationStage ?? -1)
      || typeof parsed.conversationCreated !== 'boolean'
      || typeof parsed.approved !== 'boolean'
      || !Number.isInteger(parsed.backtestPoll)
    ) return initialServerState()
    return parsed as FixtureServerState
  } catch {
    return initialServerState()
  }
}

const writeServerState = (state: FixtureServerState): void => {
  sessionStorage.setItem(FIXTURE_STATE_KEY, JSON.stringify(state))
}

const rsiEntryReply = (state: FixtureServerState): string => (
  state.entryOperator === 'lt'
    ? `RSI(${state.rsiPeriod})가 ${state.rsiThreshold} 미만이면 롱`
    : `RSI(${state.rsiPeriod})가 ${state.rsiThreshold} 이하면 롱`
)

const simulateCommittedResponseLoss = (
  operation: string,
  request: Readonly<{ headers: Readonly<Record<string, string>>; body?: string }>,
): void => {
  const idempotencyKey = request.headers['Idempotency-Key']
  const ifMatch = request.headers['If-Match']
  const body = request.body
  const auditRaw = sessionStorage.getItem(FIXTURE_REPLAY_AUDIT_KEY)
  if (auditRaw !== null) {
    const audit = JSON.parse(auditRaw) as {
      operation?: string
      idempotencyKey?: string
      ifMatch?: string
      body?: string
      replayed?: boolean
    }
    if (audit.operation === operation && audit.replayed === false) {
      if (audit.idempotencyKey !== idempotencyKey || audit.ifMatch !== ifMatch || audit.body !== body) {
        throw new Error('FIXTURE_IDEMPOTENT_REQUEST_CHANGED_ON_RESUME')
      }
      sessionStorage.setItem(FIXTURE_REPLAY_AUDIT_KEY, JSON.stringify({ ...audit, replayed: true }))
    }
  }
  if (sessionStorage.getItem(FIXTURE_RESPONSE_LOSS_KEY) !== operation) return
  sessionStorage.removeItem(FIXTURE_RESPONSE_LOSS_KEY)
  sessionStorage.setItem(FIXTURE_REPLAY_AUDIT_KEY, JSON.stringify({ operation, idempotencyKey, ifMatch, body, replayed: false }))
  throw new Error('FIXTURE_RESPONSE_LOST_AFTER_COMMIT')
}

const projection = (state: FixtureServerState): DraftProjection => {
  const market = {
    exchange: 'binance',
    marketType: 'usd_m_perpetual',
    symbol: 'BTCUSDT',
    priceCurrency: 'USDT',
  } as const
  const clock = {
    timeframe: '15m',
    timezone: 'UTC',
    session: '24x7',
    evaluateOn: 'candle_close',
    oncePerCandle: true,
  } as const
  const rsiFeatureId = `rsi${state.rsiPeriod}`
  const rsiFeature = { id: rsiFeatureId, type: 'rsi', source: 'close', period: state.rsiPeriod, timeframe: '15m' } as const
  const smaFeatures = [
    { id: 'sma20', type: 'sma', source: 'close', period: 20, timeframe: '15m' },
    { id: 'sma60', type: 'sma', source: 'close', period: 60, timeframe: '15m' },
  ] as const
  const features = state.entryKind === 'sma_cross' && state.conversationStage >= 4
    ? [rsiFeature, ...smaFeatures]
    : [rsiFeature]
  const entryRules = state.entryKind === 'sma_cross'
    ? [{
        id: 'entry_sma_cross',
        side: 'long' as const,
        condition: {
          id: 'condition_sma_cross',
          kind: 'cross' as const,
          operator: 'cross_above' as const,
          left: { kind: 'feature_ref' as const, featureId: 'sma20' },
          right: { kind: 'feature_ref' as const, featureId: 'sma60' },
        },
        rearm: 'on_false' as const,
        positionExistsPolicy: 'skip' as const,
      }]
    : [{
        id: 'entry_rsi_low',
        side: 'long' as const,
        condition: {
          id: 'condition_rsi_low',
          kind: 'comparison' as const,
          operator: state.entryOperator,
          left: { kind: 'feature_ref' as const, featureId: rsiFeatureId },
          right: { kind: 'number' as const, value: state.rsiThreshold, unit: 'index' as const },
        },
        rearm: 'on_false' as const,
        positionExistsPolicy: 'skip' as const,
      }]
  const exitRules = [
    { id: 'exit_stop', kind: 'stop_loss', distanceFraction: '0.02', triggerPrice: 'mark_price', orderType: 'market', reduceOnly: true, priority: 1 },
    { id: 'exit_take', kind: 'take_profit', distanceFraction: '0.05', triggerPrice: 'mark_price', orderType: 'market', reduceOnly: true, priority: 2 },
  ] as const
  const provenance = [
    { path: '/clock/timeframe', source: 'explicit_user', sourceTurnId: IDS.turn },
    { path: '/positionSizing', source: 'explicit_user', sourceTurnId: IDS.turn },
    { path: '/exitRules', source: 'explicit_user', sourceTurnId: IDS.turn },
    { path: '/execution/leverage', source: 'explicit_user', sourceTurnId: IDS.turn },
    ...(state.conversationStage >= 2 ? [{ path: '/market/symbol', source: 'explicit_user' as const, sourceTurnId: IDS.turn }] : []),
    ...(state.conversationStage >= 3 ? [{ path: '/features/0', source: 'explicit_user' as const, sourceTurnId: IDS.turn }] : []),
    ...(state.conversationStage >= 4 && state.entryKind === 'sma_cross' ? [
      { path: '/features/1', source: 'explicit_user' as const, sourceTurnId: IDS.turn },
      { path: '/features/2', source: 'explicit_user' as const, sourceTurnId: IDS.turn },
    ] : []),
    ...(state.conversationStage >= 4 ? [{ path: '/entryRules/0', source: 'explicit_user' as const, sourceTurnId: IDS.turn }] : []),
  ] as const
  return {
    contractVersion: '0.1.0',
    versions: {
      dsl: '0.1.0',
      indicatorRegistry: 'registry-0.1.0',
      evaluator: 'evaluator-0.1.0',
      riskPolicy: 'risk-policy-0.1.0',
    },
    metadata: { title: state.entryKind === 'sma_cross' && state.conversationStage >= 4 ? 'BTC SMA 교차' : 'BTC RSI 되돌림' },
    ...(state.conversationStage >= 2 ? { market } : {}),
    ...(state.conversationStage >= 1 ? { clock } : {}),
    features: state.conversationStage >= 3 ? features : [],
    entryRules: state.conversationStage >= 4 ? entryRules : [],
    ...(state.conversationStage >= 1 ? { positionSizing: { type: 'fixed_notional' as const, amount: '100', currency: 'USDT' as const } } : {}),
    exitRules: state.conversationStage >= 1 ? exitRules : [],
    stateRules: { allowPyramiding: false, maxConcurrentPositions: 1 },
    riskLimits: { maxAllowedLeverage: 3, maxOrderNotional: '300', maxTotalExposureNotional: '300', maxDailyLoss: '50', currency: 'USDT' },
    ...(state.conversationStage >= 1 ? { execution: { leverage: 2, marginMode: 'isolated' as const, positionMode: 'one_way' as const, entryOrderType: 'market' as const } } : {}),
    provenance,
  }
}

const draftState = (state: FixtureServerState): DraftState => ({
  contractVersion: '0.2.0',
  draftId: IDS.draft,
  revision: state.draftRevision,
  serverDefaultsVersion: 'draft-defaults-0.2.0',
  projection: projection(state),
  projectionHash: state.conversationStage === 1
    ? HASH.projectionStage1
    : state.conversationStage === 2
      ? HASH.projectionStage2
      : state.conversationStage === 3
        ? HASH.projectionStage3
        : state.conversationStage === 4
          ? HASH.projection
          : HASH.zero,
})

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  throw new Error('NON_CANONICAL_FIXTURE_VALUE')
}

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const meta = (revision: string | null = null) => ({
  apiContractVersion: '0.1.0' as const,
  requestId: 'request_fixture_00000001',
  traceId: 'trace_fixture_00000001',
  resourceRevision: revision,
})

const ok = (status: number, body: unknown, etag?: string): TransportResponse => ({
  status,
  headers: etag === undefined ? {} : { ETag: `"${etag}"` },
  body,
})

const etag = (revision: number): string => `etag_draft_fixture_${String(revision).padStart(8, '0')}`

const assertDraftBinding = (
  state: FixtureServerState,
  request: Readonly<{ headers: Readonly<Record<string, string>> }>,
  expectedRevision?: unknown,
): void => {
  if (request.headers['If-Match'] !== `"${etag(state.draftRevision)}"`) throw new Error('FIXTURE_DRAFT_ETAG_MISMATCH')
  if (expectedRevision !== undefined && String(expectedRevision) !== String(state.draftRevision)) {
    throw new Error('FIXTURE_DRAFT_REVISION_MISMATCH')
  }
}

const assertReadyDraftBinding = (
  state: FixtureServerState,
  request: Readonly<{ headers: Readonly<Record<string, string>> }>,
  expectedRevision?: unknown,
): void => {
  if (state.conversationStage !== 4) throw new Error('FIXTURE_DRAFT_NOT_READY')
  assertDraftBinding(state, request, expectedRevision)
}

const evidenceSpan = (message: string, text: string) => {
  const start = Array.from(message.slice(0, message.indexOf(text))).length
  return { text, start, end: start + Array.from(text).length, offsetUnit: 'unicode_code_point' as const }
}

const fixtureTurnResponse = (
  previous: FixtureServerState,
  updated: FixtureServerState,
  sourceHash: string,
  patches: readonly unknown[],
  nextQuestion: unknown,
  ready: boolean,
): TransportResponse => {
  const nextDraft = draftState(updated)
  const compilerTurnResult = {
    contractVersion: '0.1.0' as const,
    status: 'PATCH_PROPOSED' as const,
    source: { turnId: IDS.turn, textSha256: sourceHash, normalization: 'unicode_nfc_codepoint_v1' as const },
    draftPatch: { contractVersion: '0.1.0' as const, baseDraftVersion: previous.draftRevision, atomic: true as const, patches },
  }
  const data = {
    conversationId: IDS.conversation,
    turnId: IDS.turn,
    draftId: IDS.draft,
    draftRevision: String(updated.draftRevision),
    compilerTurnResult,
    mergeResult: {
      contractVersion: '0.2.0' as const,
      status: 'APPLIED' as const,
      sourceTurnId: IDS.turn,
      baseDraftRevision: previous.draftRevision,
      resultDraftRevision: updated.draftRevision,
      beforeProjectionHash: draftState(previous).projectionHash,
      afterProjectionHash: nextDraft.projectionHash,
      appliedPatchCount: patches.length,
      draftState: nextDraft,
      issues: [],
    },
    draftState: nextDraft,
    candidateState: ready ? 'READY_FOR_VALIDATION' as const : 'INCOMPLETE' as const,
    projectionHash: nextDraft.projectionHash,
    semanticHash: ready ? HASH.semantic : null,
    nextQuestion,
  }
  return ok(200, { meta: meta(String(updated.draftRevision)), data }, etag(updated.draftRevision))
}

const createJob = (
  state: BacktestJob['state'],
  revision: number,
  profileContentHash: string = HASH.profile,
  reportContentHash: string = HASH.isResult,
): BacktestJob => ({
  backtestId: IDS.backtest,
  splitGroupId: IDS.split,
  strategyVersionId: IDS.strategy,
  semanticHash: HASH.semantic,
  profileId: 'STRUCTURAL_SMOKE',
  profileContentHash,
  state,
  revision: String(revision),
  createdAt: '2026-09-04T12:00:00Z',
  updatedAt: `2026-09-04T12:00:0${Math.min(revision, 9)}Z`,
  sourceProvenance: SOURCE,
  resultAvailable: state === 'COMPLETED',
  ...(state === 'COMPLETED' ? { resultContentHash: reportContentHash, runContentHash: HASH.run } : {}),
})

const buildVerifiedReport = async (profileContentHash: string = HASH.profile): Promise<{
  readonly report: VerifiedBacktestReport
  readonly expectedReceiptContentHash: string
}> => {
  const receiptProjection = {
    receiptId: IDS.verifier,
    subjectContentHash: HASH.zero,
    contractsPin: PIN.contracts,
    verifierPin: PIN.verifier,
    trustAnchorContentHash: HASH.trust,
  }
  const draft = {
    backtestId: IDS.backtest,
    splitGroupId: IDS.split,
    strategyVersionId: IDS.strategy,
    semanticHash: HASH.semantic,
    profileId: 'STRUCTURAL_SMOKE' as const,
    profileContentHash,
    dataManifestContentHash: HASH.data,
    assumptionManifestContentHash: HASH.assumption,
    enginePin: PIN.engine,
    segments: [
      {
        segment: 'IS' as const,
        runtimeResult: { tradeCount: 3, fillCount: 6, rejectionCount: 1, grossPnl: '5.4', fees: '0.6', funding: '-0.1', netPnl: '4.7', currency: 'USDT' as const, contentHash: HASH.isResult, runHash: HASH.run },
        tradeManifestContentHash: HASH.isTrade,
      },
      {
        segment: 'OOS' as const,
        runtimeResult: { tradeCount: 2, fillCount: 4, rejectionCount: 0, grossPnl: '-1.2', fees: '0.4', funding: '0.1', netPnl: '-1.5', currency: 'USDT' as const, contentHash: HASH.oosResult, runHash: HASH.run },
        tradeManifestContentHash: HASH.oosTrade,
      },
    ] as const,
    metricsPolicy: 'backtest-metrics-0.1.0' as const,
    initialCapitalSourceHash: HASH.trust,
    derivedMetrics: [
      { name: 'RETURN_RATE' as const, value: '0.0047', formula: 'NET_PNL_DIV_INITIAL_CAPITAL' as const, derivedBy: 'ENGINE' as const },
      { name: 'MAX_DRAWDOWN_RATE' as const, value: '0.021', formula: 'PEAK_TO_TROUGH_DIV_PEAK_EQUITY' as const, derivedBy: 'ENGINE' as const },
      { name: 'WIN_RATE' as const, value: '0.6', formula: 'WINNING_TRADES_DIV_TRADE_COUNT' as const, derivedBy: 'ENGINE' as const },
    ],
    sourceProvenance: SOURCE,
  }
  const temporaryReceipt = { ...receiptProjection, contentHash: HASH.zero }
  const reportProjection = { ...draft }
  const reportContentHash = await sha256Hex(`tesia.api.verified-report.v0.1.0\0${canonicalJson(reportProjection)}`)
  const receiptWithSubject = { ...receiptProjection, subjectContentHash: reportContentHash }
  const receiptContentHash = await sha256Hex(`tesia.api.verifier-receipt.v0.1.0\0${canonicalJson(receiptWithSubject)}`)
  return {
    report: {
      ...draft,
      verifierReceipt: { ...temporaryReceipt, subjectContentHash: reportContentHash, contentHash: receiptContentHash },
      reportContentHash,
    },
    expectedReceiptContentHash: receiptContentHash,
  }
}

const tradeManifest = () => ({
  backtestId: IDS.backtest,
  splitGroupId: IDS.split,
  segments: [
    { segment: 'IS' as const, resultContentHash: HASH.isResult, tradeCount: 3, tradeManifestContentHash: HASH.isTrade },
    { segment: 'OOS' as const, resultContentHash: HASH.oosResult, tradeCount: 2, tradeManifestContentHash: HASH.oosTrade },
  ] as const,
  sourceProvenance: SOURCE,
})

const tradePage = (segment: 'IS' | 'OOS') => {
  const isOos = segment === 'OOS'
  const trades = isOos
    ? [{ entryFillRef: 'fill_oos_entry_0001', exitFillRef: 'fill_oos_exit_0001', quantity: '0.001', entryPrice: '64000', exitPrice: '63300', grossPnl: '-0.7', fees: '0.1', funding: '0', netPnl: '-0.8', exitReason: 'STOP_LOSS' as const }]
    : [{ entryFillRef: 'fill_is_entry_00001', exitFillRef: 'fill_is_exit_00001', quantity: '0.001', entryPrice: '62000', exitPrice: '63500', grossPnl: '1.5', fees: '0.1', funding: '0', netPnl: '1.4', exitReason: 'TAKE_PROFIT' as const }]
  const resultContentHash = isOos ? HASH.oosResult : HASH.isResult
  const tradeManifestContentHash = isOos ? HASH.oosTrade : HASH.isTrade
  return {
    backtestId: IDS.backtest,
    segment,
    resultContentHash,
    tradeManifestContentHash,
    limit: 50,
    trades,
    cursorBinding: { backtestId: IDS.backtest, segment, resultContentHash, tradeManifestContentHash },
    sourceProvenance: SOURCE,
  }
}

class FixtureTransport implements ApiTransport {
  constructor(private readonly report: VerifiedBacktestReport) {}

  async request(url: string, init: Readonly<{ method: string; headers: Readonly<Record<string, string>>; body?: string }>): Promise<TransportResponse> {
    const parsed = new URL(url, window.location.origin)
    const path = parsed.pathname
    const body = init.body === undefined ? {} : JSON.parse(init.body) as Record<string, unknown>
    let state = readServerState()

    if (init.method === 'GET' && path === '/api/v1/me') {
      return ok(200, { meta: meta(), data: { authenticated: true, principalDisplay: '로컬 POC 사용자' } })
    }
    if (init.method === 'GET' && path === '/api/v1/auth/csrf') {
      return ok(200, { meta: meta(), data: { csrfToken: 'csrf_fixture_token_00000001', expiresAt: '2026-09-05T12:00:00Z' } })
    }
    if (init.method === 'POST' && path === '/api/v1/conversations') {
      state = { ...initialServerState(), conversationCreated: true }
      writeServerState(state)
      return ok(201, { meta: meta('1'), data: { conversationId: IDS.conversation, draftId: IDS.draft, draftRevision: '1' } }, etag(1))
    }
    if (init.method === 'POST' && path === `/api/v1/conversations/${IDS.conversation}/messages`) {
      assertDraftBinding(state, init, body.expectedDraftRevision)
      const message = String(body.message ?? '').normalize('NFC')
      const sourceHash = await sha256Hex(message)
      const revision = state.draftRevision + 1
      const shorthandIdeaMatch = SHORTHAND_IDEA_PATTERN.exec(message)
      if (state.conversationStage === 0 && shorthandIdeaMatch !== null) {
        if (!/^[1-9][0-9]?$/.test(shorthandIdeaMatch[1])) throw new Error('FIXTURE_UNSUPPORTED_RSI_THRESHOLD')
        const updated = {
          ...state,
          draftRevision: revision,
          rsiThreshold: shorthandIdeaMatch[1],
          entryOperator: shorthandIdeaMatch[2] === '이하면' ? 'lte' as const : 'lt' as const,
          conversationStage: 1 as const,
          conversationCreated: true,
        }
        writeServerState(updated)
        const patches = [
          {
            op: 'set', target: { entity: 'clock', field: 'timeframe' }, precondition: { expectedState: 'absent' }, value: '15m',
            evidenceSpan: evidenceSpan(message, '15분'), reasonCode: 'user_addition',
          },
          {
            op: 'set', target: { entity: 'position_sizing' }, precondition: { expectedState: 'absent' },
            value: { type: 'fixed_notional', amount: '100', currency: 'USDT' },
            evidenceSpan: evidenceSpan(message, '100 USDT'), reasonCode: 'user_addition',
          },
          {
            op: 'set', target: { entity: 'exit_rule', id: 'exit_stop' }, precondition: { expectedState: 'absent' },
            value: { kind: 'stop_loss', distanceFraction: '0.02' },
            evidenceSpan: evidenceSpan(message, '손절 2%'), reasonCode: 'user_addition',
          },
          {
            op: 'set', target: { entity: 'exit_rule', id: 'exit_take' }, precondition: { expectedState: 'absent' },
            value: { kind: 'take_profit', distanceFraction: '0.05' },
            evidenceSpan: evidenceSpan(message, '익절 5%'), reasonCode: 'user_addition',
          },
          {
            op: 'set', target: { entity: 'execution', field: 'leverage' }, precondition: { expectedState: 'absent' }, value: 2,
            evidenceSpan: evidenceSpan(message, '레버리지 2배'), reasonCode: 'user_addition',
          },
        ] as const
        return fixtureTurnResponse(state, updated, sourceHash, patches, {
          kind: 'CANDIDATE_MISSING_PATH',
          questionId: 'q_market_symbol',
          targetPath: '/market/symbol',
          reasonCode: 'MISSING_REQUIRED_FIELD',
          prompt: '거래할 심볼을 알려 주세요.',
          options: ['BTCUSDT', '다시 설명'],
        }, false)
      }
      if (state.conversationStage === 1 && message === 'BTCUSDT') {
        const updated = { ...state, draftRevision: revision, conversationStage: 2 as const, conversationCreated: true }
        writeServerState(updated)
        const patches = [{
          op: 'set', target: { entity: 'market', field: 'symbol' }, precondition: { expectedState: 'absent' }, value: 'BTCUSDT',
          evidenceSpan: evidenceSpan(message, 'BTCUSDT'), reasonCode: 'user_addition',
        }] as const
        return fixtureTurnResponse(state, updated, sourceHash, patches, {
          kind: 'CANDIDATE_MISSING_PATH',
          questionId: 'q_features',
          targetPath: '/features',
          reasonCode: 'MISSING_REQUIRED_FIELD',
          prompt: '사용할 지표와 기간을 알려 주세요.',
          options: ['RSI 14', '다시 설명'],
        }, false)
      }
      const rsiPeriodMatch = /^RSI\s+(\d+)$/i.exec(message)
      if (state.conversationStage === 2 && rsiPeriodMatch !== null) {
        const rsiPeriod = Number(rsiPeriodMatch[1])
        if (rsiPeriod < 2 || rsiPeriod > 5_000) throw new Error('FIXTURE_UNSUPPORTED_RSI_PERIOD')
        const updated = { ...state, draftRevision: revision, rsiPeriod, conversationStage: 3 as const, conversationCreated: true }
        writeServerState(updated)
        const patches = [{
          op: 'add', target: { entity: 'feature', id: `rsi${rsiPeriod}` }, precondition: { expectedState: 'absent' },
          value: { type: 'rsi', period: rsiPeriod }, evidenceSpan: evidenceSpan(message, message), reasonCode: 'user_addition',
        }] as const
        return fixtureTurnResponse(state, updated, sourceHash, patches, {
          kind: 'CANDIDATE_MISSING_PATH',
          questionId: 'q_entry_rules',
          targetPath: '/entryRules',
          reasonCode: 'MISSING_REQUIRED_FIELD',
          prompt: 'RSI 또는 SMA 교차 중 어떤 진입 조건을 사용할까요?',
          options: [rsiEntryReply(updated), 'SMA20이 SMA60을 상향 돌파하면 롱'],
        }, false)
      }
      if (state.conversationStage === 3 && message === rsiEntryReply(state)) {
        const updated = { ...state, draftRevision: revision, conversationStage: 4 as const, conversationCreated: true }
        writeServerState(updated)
        const patches = [{
          op: 'add', target: { entity: 'entry_rule', id: 'entry_rsi_low' }, precondition: { expectedState: 'absent' },
          value: {
            side: 'long',
            condition: {
              id: 'condition_rsi_low', kind: 'comparison', operator: state.entryOperator,
              left: { kind: 'feature_ref', featureId: `rsi${state.rsiPeriod}` },
              right: { kind: 'number', value: state.rsiThreshold, unit: 'index' },
            },
          },
          evidenceSpan: evidenceSpan(message, message), reasonCode: 'user_addition',
        }] as const
        return fixtureTurnResponse(state, updated, sourceHash, patches, null, true)
      }
      if (state.conversationStage === 3 && message === 'SMA20이 SMA60을 상향 돌파하면 롱') {
        const updated = { ...state, draftRevision: revision, entryKind: 'sma_cross' as const, conversationStage: 4 as const, conversationCreated: true }
        writeServerState(updated)
        const patches = [
          {
            op: 'add', target: { entity: 'feature', id: 'sma20' }, precondition: { expectedState: 'absent' },
            value: { type: 'sma', period: 20 }, evidenceSpan: evidenceSpan(message, message), reasonCode: 'user_addition',
          },
          {
            op: 'add', target: { entity: 'feature', id: 'sma60' }, precondition: { expectedState: 'absent' },
            value: { type: 'sma', period: 60 }, evidenceSpan: evidenceSpan(message, message), reasonCode: 'user_addition',
          },
          {
            op: 'add', target: { entity: 'entry_rule', id: 'entry_sma_cross' }, precondition: { expectedState: 'absent' },
            value: {
              side: 'long',
              condition: {
                id: 'condition_sma_cross', kind: 'cross', operator: 'cross_above',
                left: { kind: 'feature_ref', featureId: 'sma20' },
                right: { kind: 'feature_ref', featureId: 'sma60' },
              },
            },
            evidenceSpan: evidenceSpan(message, message), reasonCode: 'user_addition',
          },
        ] as const
        return fixtureTurnResponse(state, updated, sourceHash, patches, null, true)
      }
      const thresholdMatch = state.conversationStage === 4 && state.entryKind === 'rsi'
        ? /^RSI (28)로 (?:바꿔|다시 확정해)줘$/u.exec(message)
        : null
      if (thresholdMatch === null) throw new Error('FIXTURE_UNRECOGNIZED_STRATEGY_REPLY')
      const threshold = thresholdMatch[1]
      const updated = { ...state, draftRevision: revision, rsiThreshold: threshold }
      writeServerState(updated)
      const evidenceText = threshold
      const start = Array.from(message.slice(0, message.indexOf(evidenceText))).length
      const end = start + Array.from(evidenceText).length
      const patch = {
        op: 'replace' as const,
        target: { entity: 'condition' as const, entryRuleId: 'entry_rsi_low', conditionId: 'condition_rsi_low', field: 'right' as const },
        precondition: { expectedValueHash: HASH.zero },
        value: { kind: 'number' as const, value: threshold, unit: 'index' as const },
        evidenceSpan: { text: evidenceText, start, end, offsetUnit: 'unicode_code_point' as const },
        reasonCode: 'user_correction' as const,
      }
      const nextDraft = draftState(updated)
      const compilerTurnResult = {
        contractVersion: '0.1.0' as const,
        status: 'PATCH_PROPOSED' as const,
        source: { turnId: IDS.turn, textSha256: sourceHash, normalization: 'unicode_nfc_codepoint_v1' as const },
        draftPatch: { contractVersion: '0.1.0' as const, baseDraftVersion: state.draftRevision, atomic: true as const, patches: [patch] },
      }
      const data = {
        conversationId: IDS.conversation,
        turnId: IDS.turn,
        draftId: IDS.draft,
        draftRevision: String(revision),
        compilerTurnResult,
        mergeResult: {
          contractVersion: '0.2.0' as const,
          status: 'APPLIED' as const,
          sourceTurnId: IDS.turn,
          baseDraftRevision: state.draftRevision,
          resultDraftRevision: revision,
          beforeProjectionHash: HASH.zero,
          afterProjectionHash: HASH.projection,
          appliedPatchCount: 1,
          draftState: nextDraft,
          issues: [],
        },
        draftState: nextDraft,
        candidateState: 'READY_FOR_VALIDATION' as const,
        projectionHash: HASH.projection,
        semanticHash: HASH.semantic,
        nextQuestion: null,
      }
      return ok(200, { meta: meta(String(revision)), data }, etag(revision))
    }
    if (init.method === 'GET' && path === `/api/v1/strategy-drafts/${IDS.draft}`) {
      return ok(200, { meta: meta(String(state.draftRevision)), data: draftState(state) }, etag(state.draftRevision))
    }
    if (init.method === 'POST' && path === `/api/v1/strategy-drafts/${IDS.draft}/validate`) {
      assertReadyDraftBinding(state, init, body.expectedDraftRevision)
      const data = {
        validationReceiptId: IDS.validation,
        draftId: IDS.draft,
        draftRevision: String(state.draftRevision),
        projectionHash: HASH.projection,
        semanticHash: HASH.semantic,
        status: 'VALID',
        issues: [],
        defaultsVersion: 'draft-defaults-0.2.0',
        registryPin: PIN.contracts,
        evaluatorPin: PIN.evaluator,
        riskPolicyPin: PIN.risk,
        contractsPin: PIN.contracts,
        issuedAt: '2026-09-04T12:00:00Z',
        expiresAt: '2026-09-04T12:10:00Z',
        consumptionState: 'AVAILABLE',
      }
      return ok(200, { meta: meta(String(state.draftRevision)), data }, etag(state.draftRevision))
    }
    if (init.method === 'POST' && path === `/api/v1/strategy-drafts/${IDS.draft}/approval-challenges`) {
      assertReadyDraftBinding(state, init)
      const data = {
        approvalChallengeId: IDS.challenge,
        draftId: IDS.draft,
        draftRevision: String(state.draftRevision),
        validationReceiptId: IDS.validation,
        semanticHash: HASH.semantic,
        issuedAt: '2026-09-04T12:00:01Z',
        expiresAt: '2026-09-04T12:05:01Z',
        consumptionState: 'AVAILABLE',
      }
      simulateCommittedResponseLoss('createApprovalChallenge', init)
      return ok(201, { meta: meta(String(state.draftRevision)), data }, etag(state.draftRevision))
    }
    if (init.method === 'POST' && path === `/api/v1/strategy-drafts/${IDS.draft}/approve`) {
      assertReadyDraftBinding(state, init)
      state = { ...state, approved: true }
      writeServerState(state)
      const data = {
        strategyVersionId: IDS.strategy,
        strategyVersionContentHash: HASH.strategy,
        sourceDraftId: IDS.draft,
        sourceDraftRevision: String(state.draftRevision),
        sourceProjectionHash: HASH.projection,
        semanticHash: HASH.semantic,
        validationReceiptId: IDS.validation,
        approvalChallengeId: IDS.challenge,
        issuanceReceiptId: IDS.issuance,
        issuedAt: '2026-09-04T12:00:02Z',
      }
      simulateCommittedResponseLoss('approveStrategyDraft', init)
      return ok(201, { meta: meta(String(state.draftRevision)), data }, etag(state.draftRevision))
    }
    if (init.method === 'POST' && path === '/api/v1/backtests') {
      state = { ...state, backtestPoll: 0 }
      writeServerState(state)
      simulateCommittedResponseLoss('submitBacktest', init)
      return ok(202, { meta: meta('1'), data: createJob('QUEUED', 1) }, 'etag_backtest_fixture_0001')
    }
    if (init.method === 'GET' && path === `/api/v1/backtests/${IDS.backtest}`) {
      const states: readonly BacktestJob['state'][] = ['PREPARING_DATA', 'VALIDATING', 'RUNNING_IS', 'RUNNING_OOS', 'FINALIZING', 'COMPLETED']
      const poll = Math.min(state.backtestPoll, states.length - 1)
      const job = createJob(states[poll], poll + 2, HASH.profile, this.report.reportContentHash)
      state = { ...state, backtestPoll: Math.min(poll + 1, states.length - 1) }
      writeServerState(state)
      return ok(200, { meta: meta(job.revision), data: job }, `etag_backtest_fixture_${String(job.revision).padStart(4, '0')}`)
    }
    if (init.method === 'GET' && path === `/api/v1/backtests/${IDS.backtest}/report`) {
      return ok(200, { meta: meta(), data: this.report })
    }
    if (init.method === 'GET' && path === `/api/v1/backtests/${IDS.backtest}/manifest`) {
      return ok(200, { meta: meta(), data: tradeManifest() })
    }
    if (init.method === 'GET' && path === `/api/v1/backtests/${IDS.backtest}/trades`) {
      const segment = parsed.searchParams.get('segment') === 'OOS' ? 'OOS' : 'IS'
      return ok(200, { meta: meta(), data: tradePage(segment) })
    }
    throw new Error(`FIXTURE_OPERATION_NOT_IMPLEMENTED:${init.method}:${path}`)
  }

  async openEventStream(): Promise<EventStreamTransportResponse> {
    async function* empty(): AsyncIterable<string> { yield* [] as string[] }
    return { status: 200, headers: { 'Content-Type': 'text/event-stream' }, stream: empty() }
  }
}

export const createFixtureAdapter = async (): Promise<InternalPocAdapter> => {
  const { report, expectedReceiptContentHash } = await buildVerifiedReport()
  const client = new TesiaApiClient(new FixtureTransport(report), {
    trustedBacktestProfileAuthority: { profileId: 'STRUCTURAL_SMOKE', profileContentHash: HASH.profile },
    trustedVerifierAuthority: {
      verifierPin: PIN.verifier,
      trustAnchorContentHash: HASH.trust,
      expectedReceiptContentHash,
      expectedSubjectContentHash: report.reportContentHash,
    },
  })
  return { kind: 'fixture', label: 'Mock fixture', sdk: createSdk(client), canReadResults: true }
}

export const createFixtureRecoveryPayloads = async (profileContentHash: string) => {
  const { report, expectedReceiptContentHash } = await buildVerifiedReport(profileContentHash)
  const state = { ...initialServerState(), draftRevision: 2, conversationStage: 4 as const, conversationCreated: true, approved: true, backtestPoll: 5 }
  return {
    ids: { draftId: IDS.draft, backtestId: IDS.backtest },
    profileContentHash,
    trustedVerifierAuthority: {
      verifierPin: PIN.verifier,
      trustAnchorContentHash: HASH.trust,
      expectedReceiptContentHash,
      expectedSubjectContentHash: report.reportContentHash,
    },
    draft: draftState(state),
    job: createJob('COMPLETED', 7, profileContentHash, report.reportContentHash),
    report,
    manifest: tradeManifest(),
    trades: { IS: tradePage('IS'), OOS: tradePage('OOS') },
  } as const
}

export const resetFixtureAdapterState = (): void => {
  sessionStorage.removeItem(FIXTURE_STATE_KEY)
  sessionStorage.removeItem(FIXTURE_RESPONSE_LOSS_KEY)
  sessionStorage.removeItem(FIXTURE_REPLAY_AUDIT_KEY)
}
