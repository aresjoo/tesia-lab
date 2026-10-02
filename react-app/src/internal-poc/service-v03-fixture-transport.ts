import recordedTrace from '../../tests/fixtures/service-v03/recorded-conversation.json'
import type {
  ApiV03Transport,
  ConversationSnapshot,
  DraftPatch,
  DraftState,
  OperationId,
  StrategyApproval,
  TransportRequest,
  TransportResponse,
} from './contracts/generated/api-v0.3/types.js'

export const SERVICE_V03_JOURNEY_SOURCE = 'SERVICE_V03_MOCK_JOURNEY_MEMORY_ONLY' as const
export const SERVICE_V03_JOURNEY_CLOCK = Date.parse('2026-09-07T00:03:00Z')

const CONVERSATION_ID = 'conversation_journey_fixture_01'
const DRAFT_ID = 'draft_journey_fixture_0001'
const TURN_ID = 'turn_journey_fixture_000001'
const VALIDATION_RECEIPT_ID = 'validation_receipt_journey_0001'
const APPROVAL_CHALLENGE_ID = 'approval_challenge_journey_0001'
const STRATEGY_VERSION_ID = 'sv_v03_journey_fixture_000001'
const INITIAL_STATE_HASH = '1'.repeat(64)
const TURN_STATE_HASH = '2'.repeat(64)
const FINAL_STATE_HASH = '7'.repeat(64)
const TURN_PROJECTION_HASH = '8'.repeat(64)
const FINAL_PROJECTION_HASH = '3'.repeat(64)
const TURN_SEMANTIC_HASH = '9'.repeat(64)
const FINAL_SEMANTIC_HASH = '4'.repeat(64)
const STRATEGY_VERSION_HASH = '5'.repeat(64)
const INITIAL_ETAG = '"journey-state-revision-0001"'
const TURN_ETAG = '"journey-state-revision-0002"'
const FINAL_ETAG = '"journey-state-revision-0003"'
const FIXTURE_IDEA = 'BTCUSDT 15분 RSI가 28 아래면 100 USDT 롱, 손절 2%, 익절 5%, 레버리지 2배'

type FixtureDocument = Readonly<{ readonly name: string; readonly value: unknown }>
type FixturePhase = 'EMPTY' | 'CREATED' | 'TURNED' | 'PATCHED' | 'VALIDATED' | 'CHALLENGED' | 'APPROVED'

export interface ServiceV03FixtureTransportOptions {
  readonly delayMs?: number
  readonly failOnceOperation?: OperationId
}

export interface ServiceV03FixtureAudit {
  readonly source: typeof SERVICE_V03_JOURNEY_SOURCE
  readonly operations: readonly OperationId[]
  readonly transportCount: number
  readonly phase: FixturePhase
}

export interface ServiceV03FixtureTransport extends ApiV03Transport {
  audit(): ServiceV03FixtureAudit
  reset(): void
}

const documents = recordedTrace.documents as readonly FixtureDocument[]

const documentValue = <T>(name: string): T => {
  const value = documents.find((document) => document.name === name)?.value
  if (value === undefined) throw new Error('SERVICE_V03_RECORDED_DOCUMENT_MISSING')
  return structuredClone(value) as T
}

const baseSnapshot = documentValue<ConversationSnapshot>('ready-snapshot')
const baseReceipt = documentValue<Readonly<Record<string, unknown>>>('validation-receipt')
const baseChallenge = documentValue<Readonly<Record<string, unknown>>>('approval-challenge')
const baseApproval = documentValue<StrategyApproval>('approval')

const projectionWithoutExecution = structuredClone(baseSnapshot.draftState.projection)
Reflect.deleteProperty(projectionWithoutExecution, 'execution')

const turnDraftState: DraftState = {
  ...baseSnapshot.draftState,
  draftId: DRAFT_ID,
  revision: 2,
  projection: projectionWithoutExecution,
  projectionHash: TURN_PROJECTION_HASH,
}

const finalDraftState: DraftState = {
  ...baseSnapshot.draftState,
  draftId: DRAFT_ID,
  revision: 3,
  projection: {
    ...baseSnapshot.draftState.projection,
    execution: {
      leverage: 2,
      marginMode: 'isolated',
      positionMode: 'one_way',
      entryOrderType: 'market',
    },
  },
  projectionHash: FINAL_PROJECTION_HASH,
}

const initialSnapshot: ConversationSnapshot = {
  ...baseSnapshot,
  conversationId: CONVERSATION_ID,
  migrationState: 'NATIVE_V03',
  conversationStateRevision: '1',
  conversationStateHash: INITIAL_STATE_HASH,
  draftId: DRAFT_ID,
  draftRevision: '2',
  projectionHash: TURN_PROJECTION_HASH,
  draftState: turnDraftState,
  candidateState: 'INCOMPLETE',
  semanticHash: null,
  nextQuestion: {
    questionId: 'q_entry_condition',
    targetField: 'entry_condition',
    reasonCode: 'MISSING_REQUIRED_VALUE',
    prompt: '자연어 아이디어를 fixture 전략으로 정형화할 준비가 되었습니다.',
    options: ['아이디어 입력', '다시 설명'],
  },
}

const turnSnapshot: ConversationSnapshot = {
  ...baseSnapshot,
  conversationId: CONVERSATION_ID,
  migrationState: 'NATIVE_V03',
  conversationStateRevision: '2',
  conversationStateHash: TURN_STATE_HASH,
  draftId: DRAFT_ID,
  draftRevision: '2',
  draftState: turnDraftState,
  projectionHash: TURN_PROJECTION_HASH,
  candidateState: 'READY_FOR_VALIDATION',
  semanticHash: TURN_SEMANTIC_HASH,
  nextQuestion: null,
}

const finalSnapshot: ConversationSnapshot = {
  ...turnSnapshot,
  conversationStateRevision: '3',
  conversationStateHash: FINAL_STATE_HASH,
  draftRevision: '3',
  draftState: finalDraftState,
  projectionHash: FINAL_PROJECTION_HASH,
  semanticHash: FINAL_SEMANTIC_HASH,
}

const draftPatch: DraftPatch = {
  contractVersion: '0.1.0',
  baseDraftVersion: 2,
  atomic: true,
  patches: [{
    op: 'set',
    target: { entity: 'execution', field: 'leverage' },
    precondition: { expectedState: 'absent' },
    value: 2,
    evidenceSpan: {
      text: '레버리지 2배',
      start: 0,
      end: 7,
      offsetUnit: 'unicode_code_point',
    },
    reasonCode: 'user_addition',
  }],
}

const turnResult = {
  turnId: TURN_ID,
  conversation: turnSnapshot,
  compilerTurnResult: {
    contractVersion: '0.1.0',
    status: 'PATCH_PROPOSED',
    source: {
      turnId: TURN_ID,
      textSha256: '6'.repeat(64),
      normalization: 'unicode_nfc_codepoint_v1',
    },
    draftPatch,
  },
  mergeResult: {
    contractVersion: '0.2.0',
    status: 'REJECTED',
    sourceTurnId: TURN_ID,
    baseDraftRevision: 2,
    resultDraftRevision: 2,
    beforeProjectionHash: TURN_PROJECTION_HASH,
    afterProjectionHash: TURN_PROJECTION_HASH,
    appliedPatchCount: 0,
    draftState: turnDraftState,
    issues: [{ code: 'EXPLICIT_PATCH_CONFIRMATION_REQUIRED', instancePath: '/execution' }],
  },
} as const

const validationReceipt = {
  ...baseReceipt,
  validationReceiptId: VALIDATION_RECEIPT_ID,
  conversationId: CONVERSATION_ID,
  conversationStateRevision: '3',
  conversationStateHash: FINAL_STATE_HASH,
  draftId: DRAFT_ID,
  draftRevision: '3',
  projectionHash: FINAL_PROJECTION_HASH,
  semanticHash: FINAL_SEMANTIC_HASH,
}

const approvalChallenge = {
  ...baseChallenge,
  approvalChallengeId: APPROVAL_CHALLENGE_ID,
  validationReceiptId: VALIDATION_RECEIPT_ID,
  conversationId: CONVERSATION_ID,
  conversationStateRevision: '3',
  conversationStateHash: FINAL_STATE_HASH,
  draftId: DRAFT_ID,
  draftRevision: '3',
  projectionHash: FINAL_PROJECTION_HASH,
  semanticHash: FINAL_SEMANTIC_HASH,
}

const strategyApproval: StrategyApproval = {
  ...baseApproval,
  strategyVersionId: STRATEGY_VERSION_ID,
  strategyVersionContentHash: STRATEGY_VERSION_HASH,
  sourceConversationId: CONVERSATION_ID,
  sourceConversationStateRevision: '3',
  sourceConversationStateHash: FINAL_STATE_HASH,
  sourceDraftId: DRAFT_ID,
  sourceDraftRevision: '3',
  sourceProjectionHash: FINAL_PROJECTION_HASH,
  semanticHash: FINAL_SEMANTIC_HASH,
  validationReceiptId: VALIDATION_RECEIPT_ID,
  approvalChallengeId: APPROVAL_CHALLENGE_ID,
}

const clone = <T>(value: T): T => structuredClone(value)

const envelope = (data: unknown, revision: string, sequence: number) => ({
  meta: {
    apiContractVersion: '0.3.0',
    requestId: `req_journey_fixture_${String(sequence).padStart(4, '0')}`,
    traceId: `trace_journey_fixture_${String(sequence).padStart(4, '0')}`,
    resourceRevision: revision,
  },
  data,
})

const response = (status: number, etag: string, data: unknown, revision: string, sequence: number): TransportResponse => ({
  status,
  headers: { ETag: etag },
  body: envelope(data, revision, sequence),
})

const wait = (delayMs: number): Promise<void> => delayMs <= 0
  ? Promise.resolve()
  : new Promise((resolve) => window.setTimeout(resolve, delayMs))

const operationFor = (request: TransportRequest): OperationId => {
  if (request.method === 'POST' && request.path === '/api/v3/conversations') return 'createConversationV3'
  if (request.method === 'GET' && request.path === `/api/v3/conversations/${CONVERSATION_ID}`) return 'getConversationV3'
  if (request.method === 'POST' && request.path === `/api/v3/conversations/${CONVERSATION_ID}/messages`) return 'createConversationTurnV3'
  if (request.method === 'GET' && request.path === `/api/v3/strategy-drafts/${DRAFT_ID}`) return 'getStrategyDraftV3'
  if (request.method === 'PATCH' && request.path === `/api/v3/strategy-drafts/${DRAFT_ID}`) return 'patchStrategyDraftV3'
  if (request.method === 'POST' && request.path === `/api/v3/strategy-drafts/${DRAFT_ID}/validate`) return 'validateStrategyDraftV3'
  if (request.method === 'POST' && request.path === `/api/v3/strategy-drafts/${DRAFT_ID}/approval-challenges`) return 'createApprovalChallengeV3'
  if (request.method === 'POST' && request.path === `/api/v3/strategy-drafts/${DRAFT_ID}/approve`) return 'approveStrategyDraftV3'
  throw new Error('SERVICE_V03_FIXTURE_OPERATION_REJECTED')
}

const recordBody = (request: TransportRequest): Readonly<Record<string, unknown>> => {
  if (typeof request.body !== 'object' || request.body === null || Array.isArray(request.body)) {
    throw new Error('SERVICE_V03_FIXTURE_BODY_REQUIRED')
  }
  return request.body as Readonly<Record<string, unknown>>
}

const requestFingerprint = (request: TransportRequest): string => JSON.stringify({
  method: request.method,
  path: request.path,
  body: request.body ?? null,
  ifMatch: request.headers['If-Match'] ?? null,
})

export const createServiceV03FixtureTransport = (
  options: ServiceV03FixtureTransportOptions = {},
): ServiceV03FixtureTransport => {
  const delayMs = options.delayMs ?? 90
  let phase: FixturePhase = 'EMPTY'
  let sequence = 0
  let transportEpoch = 0
  let failOnceOperation = options.failOnceOperation ?? null
  const operations: OperationId[] = []
  const replays = new Map<string, Readonly<{ fingerprint: string; response: TransportResponse }>>()

  const ensureBinding = (
    request: TransportRequest,
    snapshot: ConversationSnapshot,
    etag: string,
  ): void => {
    const body = recordBody(request)
    if (
      body.expectedConversationStateRevision !== snapshot.conversationStateRevision
      || body.expectedConversationStateHash !== snapshot.conversationStateHash
      || request.headers['If-Match'] !== etag
    ) throw new Error('SERVICE_V03_FIXTURE_BINDING_REJECTED')
  }

  const currentResource = (): Readonly<{ snapshot: ConversationSnapshot; etag: string }> => {
    if (phase === 'CREATED') return { snapshot: initialSnapshot, etag: INITIAL_ETAG }
    if (phase === 'TURNED') return { snapshot: turnSnapshot, etag: TURN_ETAG }
    return { snapshot: finalSnapshot, etag: FINAL_ETAG }
  }

  const dispatch = (operationId: OperationId, request: TransportRequest): TransportResponse => {
    sequence += 1
    if (operationId === 'createConversationV3') {
      if (phase !== 'EMPTY') throw new Error('SERVICE_V03_FIXTURE_ORDER_REJECTED')
      phase = 'CREATED'
      return response(201, INITIAL_ETAG, initialSnapshot, '1', sequence)
    }
    if (operationId === 'getConversationV3' || operationId === 'getStrategyDraftV3') {
      if (phase === 'EMPTY') throw new Error('SERVICE_V03_FIXTURE_ORDER_REJECTED')
      const current = currentResource()
      return response(200, current.etag, current.snapshot, current.snapshot.conversationStateRevision, sequence)
    }
    if (operationId === 'createConversationTurnV3') {
      if (phase !== 'CREATED') throw new Error('SERVICE_V03_FIXTURE_ORDER_REJECTED')
      const body = recordBody(request)
      if (
        body.expectedConversationStateRevision !== initialSnapshot.conversationStateRevision
        || body.expectedConversationStateHash !== initialSnapshot.conversationStateHash
        || request.headers['If-Match'] !== INITIAL_ETAG
      ) throw new Error('SERVICE_V03_FIXTURE_BINDING_REJECTED')
      phase = 'TURNED'
      return response(200, TURN_ETAG, turnResult, '2', sequence)
    }
    if (operationId === 'patchStrategyDraftV3') {
      if (phase !== 'TURNED') throw new Error('SERVICE_V03_FIXTURE_ORDER_REJECTED')
      ensureBinding(request, turnSnapshot, TURN_ETAG)
      const body = recordBody(request)
      if (
        JSON.stringify(body.source) !== JSON.stringify(turnResult.compilerTurnResult.source)
        || JSON.stringify(body.draftPatch) !== JSON.stringify(draftPatch)
      ) throw new Error('SERVICE_V03_FIXTURE_PATCH_REJECTED')
      phase = 'PATCHED'
      return response(200, FINAL_ETAG, finalSnapshot, '3', sequence)
    }
    ensureBinding(request, finalSnapshot, FINAL_ETAG)
    if (operationId === 'validateStrategyDraftV3') {
      if (phase !== 'PATCHED') throw new Error('SERVICE_V03_FIXTURE_ORDER_REJECTED')
      phase = 'VALIDATED'
      return response(200, FINAL_ETAG, validationReceipt, '3', sequence)
    }
    if (operationId === 'createApprovalChallengeV3') {
      if (phase !== 'VALIDATED') throw new Error('SERVICE_V03_FIXTURE_ORDER_REJECTED')
      const body = recordBody(request)
      if (
        body.validationReceiptId !== VALIDATION_RECEIPT_ID
        || body.acknowledgedSemanticHash !== FINAL_SEMANTIC_HASH
      ) throw new Error('SERVICE_V03_FIXTURE_APPROVAL_BINDING_REJECTED')
      phase = 'CHALLENGED'
      return response(201, FINAL_ETAG, approvalChallenge, '3', sequence)
    }
    if (phase !== 'CHALLENGED') throw new Error('SERVICE_V03_FIXTURE_ORDER_REJECTED')
    const body = recordBody(request)
    if (
      body.validationReceiptId !== VALIDATION_RECEIPT_ID
      || body.approvalChallengeId !== APPROVAL_CHALLENGE_ID
      || body.acknowledgedSemanticHash !== FINAL_SEMANTIC_HASH
    ) throw new Error('SERVICE_V03_FIXTURE_APPROVAL_BINDING_REJECTED')
    phase = 'APPROVED'
    return response(201, FINAL_ETAG, strategyApproval, '3', sequence)
  }

  return {
    async request(request) {
      const requestTransportEpoch = transportEpoch
      const operationId = operationFor(request)
      operations.push(operationId)
      await wait(delayMs)
      if (requestTransportEpoch !== transportEpoch) {
        throw new Error('SERVICE_V03_FIXTURE_SESSION_RESET')
      }
      if (failOnceOperation === operationId) {
        failOnceOperation = null
        throw new Error('SERVICE_V03_FIXTURE_FAILURE')
      }
      const idempotencyKey = request.headers['Idempotency-Key'] ?? null
      const fingerprint = requestFingerprint(request)
      if (idempotencyKey !== null) {
        const replay = replays.get(`${operationId}:${idempotencyKey}`)
        if (replay !== undefined) {
          if (replay.fingerprint !== fingerprint) throw new Error('SERVICE_V03_FIXTURE_IDEMPOTENCY_REJECTED')
          return clone(replay.response)
        }
      }
      const result = dispatch(operationId, request)
      if (idempotencyKey !== null) {
        replays.set(`${operationId}:${idempotencyKey}`, { fingerprint, response: clone(result) })
      }
      return clone(result)
    },
    audit() {
      return Object.freeze({
        source: SERVICE_V03_JOURNEY_SOURCE,
        operations: Object.freeze([...operations]),
        transportCount: operations.length,
        phase,
      })
    },
    reset() {
      transportEpoch += 1
      phase = 'EMPTY'
      sequence = 0
      operations.length = 0
      replays.clear()
    },
  }
}

export const SERVICE_V03_JOURNEY_FIXTURE = Object.freeze({
  conversationId: CONVERSATION_ID,
  draftId: DRAFT_ID,
  idea: FIXTURE_IDEA,
})
