import type { ClientServiceMessage } from './ClientServiceExperience'
import type { Event, History, TerminalState, Turn } from './contracts/generated/api-v0.13/dist/index.js'
import { validateApiV16 } from './contracts/generated/api-v0.16/index.js'
import { ConsultationV13Adapter, ConsultationV13HttpError, ConsultationV13ProtocolError, ConsultationV13TransportError, consultationV13CanonicalEvent } from './consultation-v13-adapter'
import { ApiV16Error, ConsultationV16Adapter, type DocumentKind, type DocumentQuestionRequest, type DocumentQuestionTurnProjection, type ProducerLocator, type ReferenceMintRequest } from './consultation-v16-adapter'
import { projectNativeInvestmentDisplay, type NativeInvestmentDisplayState, type NativeInvestmentSetup } from './native-investment-display'
import type { NativeResearchThreadOrigin } from './native-research-workspace-model'

export type ConsultationV13Availability = 'idle' | 'checking' | 'available' | 'unavailable' | 'error'
export type ConsultationV13Issue = 'unavailable' | 'request-unconfirmed' | null
export type NativeConsultationSetupCandidate = Readonly<{
  owner: string
  conversationId: string
  turnId: string
  setup: NativeInvestmentSetup
}>

export type ConsultationV13Snapshot = Readonly<{
  availability: ConsultationV13Availability
  issue: ConsultationV13Issue
  messages: readonly ClientServiceMessage[]
  busy: boolean
  canStop: boolean
  canResumePending: boolean
  canDiscardPending: boolean
  canResumeDocumentPending: boolean
  canResumeObservation: boolean
  conversationId: string | null
  activeTurnId: string | null
  /** Fresh server observation only. This is not strategy or execution authority. */
  setupCandidate: NativeConsultationSetupCandidate | null
}>

type ActiveTurn = {
  generation: number
  turnId: string
  clientMessageId: string
  userText: string
  createdAt: string
  assistantMessageId: string
  cursor: number
  answer: string
  allowTitle: boolean
  researchThread?: NativeResearchThreadOrigin
  seen: Map<number, string>
  terminal: boolean
  cancelling: boolean
  reader: AbortController
}

export type NativeConsultationV13ControllerOptions = Readonly<{
  reconnectDelayMs?: readonly number[]
  wait?: (milliseconds: number) => Promise<void>
  now?: () => number
  observationTimeoutMs?: number
  randomId?: () => string
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  documentAdapter?: ConsultationV16Adapter
  documentCsrfToken?: () => string
}>

export type NativeDocumentQuestionRequest = Readonly<{
  kind: DocumentKind
  /** Producer document id from the server; this is not the local research tab id. */
  documentId: string
  text: string
  /** Already validated local presentation anchor. It carries no server authority. */
  researchThread: NativeResearchThreadOrigin
}>

const terminal = new Set<TerminalState>(['COMPLETED', 'FAILED', 'CANCELLED', 'AMBIGUOUS'])
const waitDefault = (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds))
const unavailableIssue = 'unavailable' as const
const unconfirmedIssue = 'request-unconfirmed' as const
const MAX_PENDING_BYTES = 65_536
const MAX_DOCUMENT_JOURNAL_BYTES = 4_194_304
const MAX_DOCUMENT_BINDINGS = 256
const MAX_LOCATOR_BYTES = 4_096
const ID = /^[A-Za-z0-9_-]{16,128}$/

type PendingCreate = Readonly<{
  version: 3
  owner: string
  conversationId: string | null
  clientMessageId: string
  text: string
  idempotencyKey: string
  attempted: boolean
  disposition: 'uncertain' | 'refused'
}>

type AcceptedLocator = Readonly<{
  version: 1
  owner: string
  conversationId: string
  turnId: string
}>

type PendingCancel = Readonly<{
  version: 1
  owner: string
  turnId: string
  idempotencyKey: string
}>

type DocumentQuestionBinding = Readonly<{
  conversationId: string
  turnId: string
  clientMessageId: string
  textSha256: string
  createdAt: string
  lastSequence: number
  documentRef: string
  locator: ProducerLocator
  researchThread: NativeResearchThreadOrigin
}>

type ActiveDocumentQuestionJournal = Readonly<{
  version: 2
  stage: 'mint-ready' | 'question-ready' | 'admitted'
  attempted: boolean
  disposition: 'uncertain' | 'refused'
  owner: string
  conversationId: string | null
  clientMessageId: string
  text: string | null
  researchThread: NativeResearchThreadOrigin
  mintIdempotencyKey: string
  questionIdempotencyKey: string
  mintRequest: ReferenceMintRequest
  questionRequest: DocumentQuestionRequest | null
  turnId: string | null
  joined: boolean
  bindings: readonly DocumentQuestionBinding[]
}>

type SettledDocumentQuestionJournal = Readonly<{
  version: 2
  stage: 'settled'
  owner: string
  conversationId: string
  bindings: readonly DocumentQuestionBinding[]
}>

type DocumentQuestionJournal = ActiveDocumentQuestionJournal | SettledDocumentQuestionJournal

type SetupObservationAnchor = Readonly<{
  generation: number
  owner: string
  locator: AcceptedLocator
  clientMessageId: string
  userText: string
  createdAt: string
  answerText: string
  lastSequence: number
  allowTitle: boolean
  setup: NativeInvestmentSetup
}>

const pendingKey = (owner: string) => `tesia.native.consultation-v13.pending:${encodeURIComponent(owner)}`
const locatorKey = (owner: string) => `tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`
const cancelKey = (owner: string) => `tesia.native.consultation-v13.cancel:${encodeURIComponent(owner)}`
const documentQuestionKey = (owner: string) => `tesia.native.consultation-v16.document-question:${encodeURIComponent(owner)}`

const activeDocumentJournalKeys = ['attempted', 'bindings', 'clientMessageId', 'conversationId', 'disposition', 'joined',
  'mintIdempotencyKey', 'mintRequest', 'owner', 'questionIdempotencyKey', 'questionRequest', 'researchThread', 'stage', 'text', 'turnId', 'version']
const settledDocumentJournalKeys = ['bindings', 'conversationId', 'owner', 'stage', 'version']
const documentBindingKeys = ['clientMessageId', 'conversationId', 'createdAt', 'documentRef', 'lastSequence', 'locator',
  'researchThread', 'textSha256', 'turnId']

function exactKeys(value: unknown, expected: readonly string[]) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort()))
}

function validResearchThread(value: unknown): value is NativeResearchThreadOrigin {
  if (!exactKeys(value, ['documentId', 'scopeId'])) return false
  const found = value as Record<string, unknown>
  return typeof found.scopeId === 'string' && found.scopeId.length >= 1 && found.scopeId.length <= 4_096
    && found.scopeId === found.scopeId.normalize('NFC') && !/[\u0000-\u001f\u007f-\u009f]/.test(found.scopeId)
    && typeof found.documentId === 'string' && found.documentId.length >= 1 && found.documentId.length <= 512
    && found.documentId === found.documentId.normalize('NFC') && !/[\u0000-\u001f\u007f-\u009f]/.test(found.documentId)
}

function projectionMatchesJournal(value: DocumentQuestionTurnProjection, journal: ActiveDocumentQuestionJournal) {
  const locator = journal.mintRequest.locator, question = journal.questionRequest
  return question !== null && journal.turnId !== null && journal.conversationId !== null
    && value.conversationId === journal.conversationId && value.turnId === journal.turnId
    && value.clientMessageId === journal.clientMessageId && value.documentRef === question.documentRef
    && value.producerServiceId === locator.producerServiceId && value.kind === locator.kind
    && value.documentId === locator.documentId && value.revision === locator.revision
    && value.contentSha256 === locator.contentSha256
}

function documentJournalText(journal: ActiveDocumentQuestionJournal) {
  return journal.text ?? journal.questionRequest?.text ?? ''
}

function projectionMatchesBinding(value: DocumentQuestionTurnProjection, binding: DocumentQuestionBinding) {
  const locator = binding.locator
  return value.conversationId === binding.conversationId && value.turnId === binding.turnId
    && value.clientMessageId === binding.clientMessageId && value.documentRef === binding.documentRef
    && value.producerServiceId === locator.producerServiceId && value.kind === locator.kind
    && value.documentId === locator.documentId && value.revision === locator.revision
    && value.contentSha256 === locator.contentSha256
}

function validDocumentBinding(value: unknown): value is DocumentQuestionBinding {
  if (!exactKeys(value, documentBindingKeys)) return false
  const found = value as Record<string, unknown>
  return typeof found.conversationId === 'string' && ID.test(found.conversationId)
    && typeof found.turnId === 'string' && ID.test(found.turnId)
    && typeof found.clientMessageId === 'string' && ID.test(found.clientMessageId)
    && typeof found.textSha256 === 'string' && /^[0-9a-f]{64}$/.test(found.textSha256)
    && typeof found.createdAt === 'string' && found.createdAt.length >= 1 && found.createdAt.length <= 64
    && !/[\u0000-\u001f\u007f-\u009f]/.test(found.createdAt)
    && Number.isSafeInteger(found.lastSequence) && Number(found.lastSequence) >= 0
    && typeof found.documentRef === 'string' && ID.test(found.documentRef)
    && validateApiV16({ apiContractVersion: '0.16.0', locator: found.locator }, 'ReferenceMintRequest')
    && validResearchThread(found.researchThread)
}

function validClaimOwnerTransition(sourceOwner: string, targetOwner: string) {
  try {
    const source = JSON.parse(sourceOwner) as unknown
    const target = JSON.parse(targetOwner) as unknown
    return Array.isArray(source) && source.length === 2 && typeof source[0] === 'string' && ID.test(source[0])
      && source[1] === 'ANONYMOUS'
      && Array.isArray(target) && target.length === 2 && typeof target[0] === 'string' && ID.test(target[0])
      && target[1] === 'AUTHENTICATED' && source[0] !== target[0]
  } catch { return false }
}

function parseDocumentJournal(raw: string, owner: string): DocumentQuestionJournal {
  if (new TextEncoder().encode(raw).length > MAX_DOCUMENT_JOURNAL_BYTES) throw new Error('DOCUMENT_JOURNAL_INVALID')
  const value = JSON.parse(raw) as Record<string, unknown>
  if (value.version !== 2 || value.owner !== owner || typeof value.owner !== 'string' || value.owner.length > 512
    || !(value.conversationId === null || typeof value.conversationId === 'string' && ID.test(value.conversationId))
    || !Array.isArray(value.bindings) || value.bindings.length > MAX_DOCUMENT_BINDINGS
    || !value.bindings.every(validDocumentBinding)
    || value.conversationId === null && value.bindings.length !== 0
    || value.bindings.some(binding => (binding as DocumentQuestionBinding).conversationId !== value.conversationId)
    || new Set(value.bindings.map(binding => (binding as DocumentQuestionBinding).turnId)).size !== value.bindings.length) {
    throw new Error('DOCUMENT_JOURNAL_INVALID')
  }
  if (value.stage === 'settled') {
    if (!exactKeys(value, settledDocumentJournalKeys) || typeof value.conversationId !== 'string' || value.bindings.length < 1) throw new Error('DOCUMENT_JOURNAL_INVALID')
    return value as unknown as SettledDocumentQuestionJournal
  }
  if (!exactKeys(value, activeDocumentJournalKeys)
    || typeof value.clientMessageId !== 'string' || !ID.test(value.clientMessageId)
    || !(value.text === null || typeof value.text === 'string' && value.text.length >= 1 && value.text.length <= 16_000
      && value.text === value.text.normalize('NFC'))
    || !validResearchThread(value.researchThread)
    || typeof value.mintIdempotencyKey !== 'string' || !ID.test(value.mintIdempotencyKey)
    || typeof value.questionIdempotencyKey !== 'string' || !ID.test(value.questionIdempotencyKey)
    || !validateApiV16(value.mintRequest, 'ReferenceMintRequest')
    || !(value.questionRequest === null || validateApiV16(value.questionRequest, 'DocumentQuestionRequest'))
    || !(value.turnId === null || typeof value.turnId === 'string' && ID.test(value.turnId))
    || typeof value.attempted !== 'boolean' || typeof value.disposition !== 'string'
    || !['uncertain', 'refused'].includes(value.disposition)
    || typeof value.joined !== 'boolean' || typeof value.stage !== 'string'
    || !['mint-ready', 'question-ready', 'admitted'].includes(value.stage)
  ) throw new Error('DOCUMENT_JOURNAL_INVALID')
  const question = value.questionRequest as DocumentQuestionRequest | null
  const mint = value.mintRequest as ReferenceMintRequest
  const stage = value.stage as ActiveDocumentQuestionJournal['stage']
  if (stage === 'mint-ready' && (typeof value.text !== 'string' || question !== null || value.turnId !== null || value.joined)
    || stage === 'question-ready' && (value.text !== null || question === null || value.turnId !== null || value.joined)
    || stage === 'admitted' && (typeof value.conversationId !== 'string' || value.text !== null || question === null || value.turnId === null)
    || value.disposition === 'refused' && !value.attempted
    || value.joined && (stage !== 'admitted' || value.disposition !== 'uncertain')
    || value.joined && value.bindings.filter(binding => (binding as DocumentQuestionBinding).turnId === value.turnId).length !== 1
    || (question !== null && (question.clientMessageId !== value.clientMessageId
      || question.documentRef.length < 24)) || mint.locator.kind.length < 1) throw new Error('DOCUMENT_JOURNAL_INVALID')
  return value as unknown as ActiveDocumentQuestionJournal
}

async function textSha256(value: string) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function id(prefix: string, randomId: () => string) {
  return `${prefix}_${randomId().replaceAll('-', '_')}`
}

function browserStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage }
  catch { return null }
}

export class NativeConsultationV13Controller {
  private readonly adapter: ConsultationV13Adapter
  private readonly documentAdapter: ConsultationV16Adapter | null
  private readonly documentCsrfToken: (() => string) | null
  private readonly reconnectDelayMs: readonly number[]
  private readonly wait: (milliseconds: number) => Promise<void>
  private readonly now: () => number
  private readonly observationTimeoutMs: number
  private readonly randomId: () => string
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  private listeners = new Set<(snapshot: ConsultationV13Snapshot) => void>()
  private owner: string | null = null
  private generation = 0
  private active: ActiveTurn | null = null
  private creating = false
  private pending: PendingCreate | null = null
  private pendingRaw: string | null = null
  private accepted: AcceptedLocator | null = null
  private acceptedRaw: string | null = null
  private pendingCancel: PendingCancel | null = null
  private pendingCancelRaw: string | null = null
  private documentJournal: DocumentQuestionJournal | null = null
  private documentJournalRaw: string | null = null
  private documentVerifiedThreads = new Map<string, NativeResearchThreadOrigin>()
  private readonly createFlights = new Set<string>()
  private readonly documentFlights = new Set<string>()
  private readonly setupObservationFlights = new Set<string>()
  private storageFailed = false
  private completedTurnSeen = false
  private state: ConsultationV13Snapshot = {
    availability: 'idle', issue: null, messages: [], busy: false, canStop: false, canResumePending: false,
    canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: false, conversationId: null, activeTurnId: null, setupCandidate: null,
  }

  constructor(adapter: ConsultationV13Adapter, options: NativeConsultationV13ControllerOptions = {}) {
    this.adapter = adapter
    this.documentAdapter = options.documentAdapter ?? null
    this.documentCsrfToken = options.documentCsrfToken ?? null
    this.reconnectDelayMs = options.reconnectDelayMs ?? [250, 500, 1_000, 2_000, 4_000, 8_000]
    this.wait = options.wait ?? waitDefault
    this.now = options.now ?? (() => Date.now())
    this.observationTimeoutMs = options.observationTimeoutMs ?? 330_000
    this.randomId = options.randomId ?? (() => crypto.randomUUID())
    this.storage = options.storage === undefined ? browserStorage() : options.storage
    if (!Number.isSafeInteger(this.observationTimeoutMs) || this.observationTimeoutMs < 1 || this.observationTimeoutMs > 330_000) throw new Error('CONSULTATION_OBSERVATION_TIMEOUT_INVALID')
  }

  getSnapshot = () => this.state

  subscribe = (listener: (snapshot: ConsultationV13Snapshot) => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(next: Partial<ConsultationV13Snapshot>) {
    this.state = { ...this.state, ...next }
    this.listeners.forEach(listener => listener(this.state))
  }

  bindOwner(owner: string) {
    if (this.owner === owner) return
    this.retireReader()
    this.owner = owner
    this.generation++
    this.active = null
    this.creating = false
    this.pending = null
    this.pendingRaw = null
    this.accepted = null
    this.acceptedRaw = null
    this.pendingCancel = null
    this.pendingCancelRaw = null
    this.documentJournal = null
    this.documentJournalRaw = null
    this.documentVerifiedThreads.clear()
    this.storageFailed = false
    this.completedTurnSeen = false
    this.readPending(owner)
    this.readAccepted(owner)
    this.readPendingCancel(owner)
    this.readDocumentJournal(owner)
    this.publish({ availability: 'idle', issue: this.pending || this.pendingCancel || this.documentPending() || this.storageFailed ? unconfirmedIssue : null, messages: [], busy: false, canStop: false,
      canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: false, conversationId: null, activeTurnId: null, setupCandidate: null })
  }

  unbindOwner() {
    if (this.owner === null) return
    this.retireReader()
    this.owner = null
    this.generation++
    this.active = null
    this.creating = false
    this.pending = null
    this.pendingRaw = null
    this.accepted = null
    this.acceptedRaw = null
    this.pendingCancel = null
    this.pendingCancelRaw = null
    this.documentJournal = null
    this.documentJournalRaw = null
    this.documentVerifiedThreads.clear()
    this.storageFailed = false
    this.completedTurnSeen = false
    this.publish({ availability: 'idle', issue: null, messages: [], busy: false, canStop: false, canResumePending: false,
      canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: false, conversationId: null, activeTurnId: null, setupCandidate: null })
  }

  private readPending(owner: string) {
    if (!this.storage) { this.storageFailed = true; return }
    try {
      const raw = this.storage.getItem(pendingKey(owner))
      if (raw === null) return
      if (new TextEncoder().encode(raw).length > MAX_PENDING_BYTES) throw new Error('PENDING_INVALID')
      const value = JSON.parse(raw) as Record<string, unknown>
      const keys = value && typeof value === 'object' ? Object.keys(value).sort() : []
      const legacy = value.version === 2 && JSON.stringify(keys) === JSON.stringify(['clientMessageId', 'conversationId', 'disposition', 'idempotencyKey', 'owner', 'text', 'version'])
      const current = value.version === 3 && JSON.stringify(keys) === JSON.stringify(['attempted', 'clientMessageId', 'conversationId', 'disposition', 'idempotencyKey', 'owner', 'text', 'version'])
      if ((!legacy && !current) || typeof value.owner !== 'string' || value.owner.length > 512
        || value.owner !== owner || typeof value.clientMessageId !== 'string' || !ID.test(value.clientMessageId)
        || typeof value.idempotencyKey !== 'string' || !ID.test(value.idempotencyKey)
        || !(value.conversationId === null || typeof value.conversationId === 'string' && ID.test(value.conversationId))
        || typeof value.disposition !== 'string' || !['uncertain', 'refused'].includes(value.disposition)
        || current && typeof value.attempted !== 'boolean'
        || typeof value.text !== 'string' || value.text.length < 1 || value.text.length > 16_000 || value.text !== value.text.normalize('NFC')) throw new Error('PENDING_INVALID')
      this.pending = {
        version: 3, owner: value.owner as string, conversationId: value.conversationId as string | null, clientMessageId: value.clientMessageId as string,
        text: value.text as string, idempotencyKey: value.idempotencyKey as string, attempted: legacy ? true : value.attempted as boolean,
        disposition: value.disposition as PendingCreate['disposition'],
      }
      this.pendingRaw = raw
    } catch { this.storageFailed = true }
  }

  private readAccepted(owner: string) {
    if (!this.storage) { this.storageFailed = true; return }
    try {
      const raw = this.storage.getItem(locatorKey(owner))
      if (raw === null) return
      if (new TextEncoder().encode(raw).length > MAX_LOCATOR_BYTES) throw new Error('LOCATOR_INVALID')
      const value = JSON.parse(raw) as Partial<AcceptedLocator>
      const keys = value && typeof value === 'object' ? Object.keys(value).sort() : []
      if (JSON.stringify(keys) !== JSON.stringify(['conversationId', 'owner', 'turnId', 'version'])
        || value.version !== 1 || value.owner !== owner || typeof value.owner !== 'string' || value.owner.length > 512
        || typeof value.conversationId !== 'string' || !ID.test(value.conversationId)
        || typeof value.turnId !== 'string' || !ID.test(value.turnId)) throw new Error('LOCATOR_INVALID')
      this.accepted = value as AcceptedLocator
      this.acceptedRaw = raw
    } catch { this.storageFailed = true }
  }

  private persistPending(value: PendingCreate) {
    if (!this.storage || this.storageFailed) throw new Error('CONSULTATION_PENDING_STORAGE_UNAVAILABLE')
    const raw = JSON.stringify(value)
    if (new TextEncoder().encode(raw).length > MAX_PENDING_BYTES) throw new Error('CONSULTATION_PENDING_STORAGE_UNAVAILABLE')
    const key = pendingKey(value.owner)
    this.storage.setItem(key, raw)
    if (this.storage.getItem(key) !== raw) throw new Error('CONSULTATION_PENDING_STORAGE_UNAVAILABLE')
    this.pending = value
    this.pendingRaw = raw
  }

  private clearPending() {
    if (!this.storage || !this.pendingRaw) return
    if (!this.owner) throw new Error('CONSULTATION_PENDING_OWNER_UNAVAILABLE')
    const key = pendingKey(this.owner)
    const current = this.storage.getItem(key)
    if (current !== this.pendingRaw) throw new Error('CONSULTATION_PENDING_STORAGE_CHANGED')
    this.storage.removeItem(key)
    if (this.storage.getItem(key) !== null) throw new Error('CONSULTATION_PENDING_STORAGE_UNAVAILABLE')
    this.pending = null
    this.pendingRaw = null
  }

  private readDocumentJournal(owner: string) {
    if (!this.storage) { this.storageFailed = true; return }
    try {
      const raw = this.storage.getItem(documentQuestionKey(owner))
      if (raw === null) return
      this.documentJournal = parseDocumentJournal(raw, owner)
      this.documentJournalRaw = raw
    } catch { this.storageFailed = true }
  }

  private persistDocumentJournal(value: DocumentQuestionJournal) {
    if (!this.storage || this.storageFailed) throw new Error('CONSULTATION_DOCUMENT_STORAGE_UNAVAILABLE')
    const key = documentQuestionKey(value.owner)
    if (this.documentJournalRaw !== null && this.storage.getItem(key) !== this.documentJournalRaw) {
      throw new Error('CONSULTATION_DOCUMENT_STORAGE_CHANGED')
    }
    const raw = JSON.stringify(value)
    if (new TextEncoder().encode(raw).length > MAX_DOCUMENT_JOURNAL_BYTES) throw new Error('CONSULTATION_DOCUMENT_STORAGE_UNAVAILABLE')
    this.storage.setItem(key, raw)
    if (this.storage.getItem(key) !== raw) throw new Error('CONSULTATION_DOCUMENT_STORAGE_UNAVAILABLE')
    this.documentJournal = value
    this.documentJournalRaw = raw
  }

  private clearDocumentJournal() {
    if (!this.storage || !this.documentJournalRaw || !this.owner) return
    const key = documentQuestionKey(this.owner)
    if (this.storage.getItem(key) !== this.documentJournalRaw) throw new Error('CONSULTATION_DOCUMENT_STORAGE_CHANGED')
    this.storage.removeItem(key)
    if (this.storage.getItem(key) !== null) throw new Error('CONSULTATION_DOCUMENT_STORAGE_UNAVAILABLE')
    this.documentJournal = null
    this.documentJournalRaw = null
    this.documentVerifiedThreads.clear()
  }

  private discardRefusedDocumentJournal() {
    const refused = this.documentJournal
    if (!refused || refused.stage === 'settled' || refused.disposition !== 'refused') throw new Error('CONSULTATION_DOCUMENT_BINDING')
    if (refused.bindings.length === 0) this.clearDocumentJournal()
    else {
      if (refused.conversationId === null) throw new Error('CONSULTATION_DOCUMENT_BINDING')
      this.persistDocumentJournal({ version: 2, stage: 'settled', owner: refused.owner,
        conversationId: refused.conversationId, bindings: refused.bindings })
    }
    this.documentVerifiedThreads.clear()
    return Boolean(this.accepted)
  }

  private persistAccepted(value: AcceptedLocator) {
    if (!this.storage || this.storageFailed) throw new Error('CONSULTATION_LOCATOR_STORAGE_UNAVAILABLE')
    const raw = JSON.stringify(value), key = locatorKey(value.owner)
    if (new TextEncoder().encode(raw).length > MAX_LOCATOR_BYTES) throw new Error('CONSULTATION_LOCATOR_STORAGE_UNAVAILABLE')
    this.storage.setItem(key, raw)
    if (this.storage.getItem(key) !== raw) throw new Error('CONSULTATION_LOCATOR_STORAGE_UNAVAILABLE')
    this.accepted = value
    this.acceptedRaw = raw
  }

  private readPendingCancel(owner: string) {
    if (!this.storage) { this.storageFailed = true; return }
    try {
      const raw = this.storage.getItem(cancelKey(owner))
      if (raw === null) return
      if (new TextEncoder().encode(raw).length > MAX_LOCATOR_BYTES) throw new Error('CANCEL_INVALID')
      const value = JSON.parse(raw) as Partial<PendingCancel>
      const keys = value && typeof value === 'object' ? Object.keys(value).sort() : []
      if (JSON.stringify(keys) !== JSON.stringify(['idempotencyKey', 'owner', 'turnId', 'version'])
        || value.version !== 1 || value.owner !== owner || typeof value.owner !== 'string' || value.owner.length > 512
        || typeof value.turnId !== 'string' || !ID.test(value.turnId)
        || typeof value.idempotencyKey !== 'string' || !ID.test(value.idempotencyKey)) throw new Error('CANCEL_INVALID')
      this.pendingCancel = value as PendingCancel
      this.pendingCancelRaw = raw
    } catch { this.storageFailed = true }
  }

  private persistPendingCancel(value: PendingCancel) {
    if (!this.storage || this.storageFailed) throw new Error('CONSULTATION_CANCEL_STORAGE_UNAVAILABLE')
    const raw = JSON.stringify(value), key = cancelKey(value.owner)
    if (new TextEncoder().encode(raw).length > MAX_LOCATOR_BYTES) throw new Error('CONSULTATION_CANCEL_STORAGE_UNAVAILABLE')
    this.storage.setItem(key, raw)
    if (this.storage.getItem(key) !== raw) throw new Error('CONSULTATION_CANCEL_STORAGE_UNAVAILABLE')
    this.pendingCancel = value
    this.pendingCancelRaw = raw
  }

  private clearPendingCancel() {
    if (!this.storage || !this.pendingCancelRaw || !this.owner) return
    const key = cancelKey(this.owner)
    if (this.storage.getItem(key) !== this.pendingCancelRaw) throw new Error('CONSULTATION_CANCEL_STORAGE_CHANGED')
    this.storage.removeItem(key)
    if (this.storage.getItem(key) !== null) throw new Error('CONSULTATION_CANCEL_STORAGE_UNAVAILABLE')
    this.pendingCancel = null
    this.pendingCancelRaw = null
  }

  private clearAccepted() {
    if (!this.storage || !this.acceptedRaw || !this.owner) return
    const key = locatorKey(this.owner)
    if (this.storage.getItem(key) !== this.acceptedRaw) throw new Error('CONSULTATION_LOCATOR_STORAGE_CHANGED')
    this.storage.removeItem(key)
    if (this.storage.getItem(key) !== null) throw new Error('CONSULTATION_LOCATOR_STORAGE_UNAVAILABLE')
    this.accepted = null
    this.acceptedRaw = null
  }

  private deadline(parent?: AbortSignal) {
    const control = new AbortController()
    let timedOut = false
    const relay = () => control.abort(parent?.reason)
    if (parent?.aborted) relay()
    else parent?.addEventListener('abort', relay, { once: true })
    const timer = globalThis.setTimeout(() => {
      timedOut = true
      control.abort(new DOMException('consultation observation deadline', 'AbortError'))
    }, this.observationTimeoutMs)
    return {
      signal: control.signal,
      timedOut: () => timedOut,
      dispose: () => { globalThis.clearTimeout(timer); parent?.removeEventListener('abort', relay) },
    }
  }

  private pendingFlags() {
    const documentRefused = Boolean(this.documentJournal && this.documentJournal.stage !== 'settled'
      && this.documentJournal.disposition === 'refused')
    return {
      canResumePending: Boolean(this.pending?.disposition === 'uncertain' && !this.storageFailed),
      canDiscardPending: Boolean((this.pending?.disposition === 'refused' || documentRefused)
        && !this.storageFailed),
    }
  }

  private documentPending() {
    return Boolean(this.documentJournal && !['admitted', 'settled'].includes(this.documentJournal.stage))
  }

  private documentAdmissionPending() {
    return Boolean(this.documentJournal?.stage === 'admitted' && !this.documentJournal.joined)
  }

  private documentPendingFlags() {
    return { canResumeDocumentPending: Boolean(this.documentPending() && this.documentJournal
      && this.documentJournal.stage !== 'settled' && this.documentJournal.disposition === 'uncertain'
      && !this.storageFailed
      && this.documentAdapter && this.documentCsrfToken) }
  }

  private async loadHistory(conversationId: string, signal: AbortSignal) {
    let cursor: string | undefined, snapshotId: string | null = null
    const turns: Turn[] = []
    for (let page = 0; page < 3 && turns.length < 256; page++) {
      const response = (await this.adapter.history(conversationId, cursor, Math.min(100, 256 - turns.length), signal)).data
      if (response.conversationId !== conversationId || snapshotId !== null && response.snapshotId !== snapshotId) throw new Error('CONSULTATION_HISTORY_BINDING')
      snapshotId ??= response.snapshotId
      turns.push(...response.turns)
      if (response.nextCursor === null) return { ...response, turns, nextCursor: null }
      if (response.nextCursor === cursor) throw new Error('CONSULTATION_HISTORY_BINDING')
      cursor = response.nextCursor
    }
    throw new Error('CONSULTATION_HISTORY_BINDING')
  }

  private async loadDocumentHistory(conversationId: string, signal: AbortSignal) {
    if (!this.documentAdapter) throw new Error('CONSULTATION_DOCUMENT_ADAPTER_UNAVAILABLE')
    let cursor: string | undefined
    const items: DocumentQuestionTurnProjection[] = []
    for (let page = 0; page < 3 && items.length < 256; page++) {
      const response = await this.documentAdapter.history(conversationId, { cursor, limit: Math.min(100, 256 - items.length), signal })
      items.push(...response.items)
      if (response.nextCursor === null) return items
      if (response.nextCursor === cursor) throw new Error('CONSULTATION_DOCUMENT_HISTORY_BINDING')
      cursor = response.nextCursor
    }
    throw new Error('CONSULTATION_DOCUMENT_HISTORY_BINDING')
  }

  private setupFrom(text: string, owner: string, turnId: string, allowTitle: boolean) {
    return projectNativeInvestmentDisplay({ text, state: 'COMPLETED', scopeId: owner,
      messageId: `${turnId}_reply`, allowTitle }).setup
  }

  private scheduleSetupObservation(anchor: SetupObservationAnchor) {
    const flight = JSON.stringify([anchor.generation, anchor.owner, anchor.locator.conversationId, anchor.locator.turnId])
    if (this.setupObservationFlights.has(flight)) return
    this.setupObservationFlights.add(flight)
    void (async () => {
      try {
        await this.wait(800)
        if (anchor.generation !== this.generation || anchor.owner !== this.owner || anchor.locator !== this.accepted
          || this.state.conversationId !== anchor.locator.conversationId || this.active || this.state.busy) return
        const deadline = this.deadline()
        try {
          const history = await this.loadHistory(anchor.locator.conversationId, deadline.signal)
          if (anchor.generation !== this.generation || anchor.owner !== this.owner || anchor.locator !== this.accepted
            || this.state.conversationId !== anchor.locator.conversationId || this.active || this.state.busy) return
          const observed = (await this.adapter.turn(anchor.locator.turnId, deadline.signal)).data
          if (anchor.generation !== this.generation || anchor.owner !== this.owner || anchor.locator !== this.accepted
            || this.state.conversationId !== anchor.locator.conversationId || this.active || this.state.busy) return
          const latest = history.turns.at(-1)
          const matchesAnchor = (turn: Turn | undefined) => Boolean(turn
            && turn.turnId === anchor.locator.turnId && turn.conversationId === anchor.locator.conversationId
            && turn.clientMessageId === anchor.clientMessageId && turn.userText === anchor.userText
            && turn.createdAt === anchor.createdAt && turn.answerText === anchor.answerText
            && turn.state === 'COMPLETED' && turn.lastSequence === anchor.lastSequence
            && turn.terminalSequence === anchor.lastSequence && turn.failureCode === null)
          if (!matchesAnchor(latest) || !matchesAnchor(observed)
            || latest!.updatedAt !== observed.updatedAt || latest!.cancelRequested !== observed.cancelRequested) return
          const setup = this.setupFrom(observed.answerText, anchor.owner, observed.turnId, anchor.allowTitle)
          if (!setup || setup.entryMode !== anchor.setup.entryMode || setup.pair !== anchor.setup.pair) return
          this.publish({ setupCandidate: Object.freeze({ owner: anchor.owner, conversationId: observed.conversationId,
            turnId: observed.turnId, setup: Object.freeze({ ...setup }) }) })
        } finally { deadline.dispose() }
      } catch {
        // Display admission is optional. Preserve the durable answer and fail closed.
      } finally { this.setupObservationFlights.delete(flight) }
    })()
  }

  async activate() {
    const generation = this.generation
    if (!this.owner || !['idle', 'error', 'unavailable'].includes(this.state.availability)) return
    this.publish({ availability: 'checking', issue: null, canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false,
      canResumeObservation: false, setupCandidate: null })
    const deadline = this.deadline()
    try {
      const response = await this.adapter.capabilities(deadline.signal)
      if (generation !== this.generation || !this.owner) return
      if (!response.data.available) {
        this.publish({ availability: 'unavailable', issue: this.pending || this.pendingCancel || this.documentPending() || this.storageFailed ? unconfirmedIssue : unavailableIssue,
          canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: true })
        return
      }
      if (this.documentJournal?.stage === 'admitted') {
        try { await this.reconcileDocumentAdmission(generation, this.owner, this.documentJournal, deadline.signal) }
        catch {
          if (generation === this.generation) this.publish({ availability: 'error', issue: unconfirmedIssue,
            canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: true })
        }
        return
      }
      if (this.documentJournal?.stage === 'settled') {
        try { await this.reconcileSettledDocument(generation, this.owner, this.documentJournal, deadline.signal) }
        catch {
          if (generation === this.generation) this.publish({ availability: 'error', issue: unconfirmedIssue,
            canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: true })
        }
        return
      }
      if (this.documentPending()) {
        if (this.accepted) {
          try { await this.restoreAccepted(generation, this.owner, this.accepted, deadline.signal) }
          catch {
            if (generation === this.generation) this.publish({ availability: 'error', issue: unconfirmedIssue,
              canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: true })
          }
          return
        }
        this.publish({ availability: 'available', issue: unconfirmedIssue, ...this.pendingFlags(), ...this.documentPendingFlags(),
          canResumeObservation: false })
        return
      }
      if (this.accepted) {
        try { await this.restoreAccepted(generation, this.owner, this.accepted, deadline.signal) }
        catch (error) {
          if (generation === this.generation && this.pending?.disposition === 'uncertain' && !this.storageFailed) {
            this.publish({ availability: 'available', issue: unconfirmedIssue, ...this.pendingFlags(), ...this.documentPendingFlags(), canResumeObservation: false })
            return
          }
          throw error
        }
        return
      }
      this.publish({ availability: 'available', issue: this.pending || this.pendingCancel || this.documentPending() || this.storageFailed ? unconfirmedIssue : null,
        ...this.pendingFlags(), ...this.documentPendingFlags(), canResumeObservation: false })
    } catch {
      if (generation === this.generation) this.publish({ availability: 'error', issue: this.accepted || this.pending || this.pendingCancel || this.documentJournal || this.storageFailed ? unconfirmedIssue : unavailableIssue,
        canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: true })
    } finally { deadline.dispose() }
  }

  async restoreConversation(conversationId: string): Promise<boolean> {
    if (!this.owner || !ID.test(conversationId)) return false
    this.retireReader()
    const generation = ++this.generation, owner = this.owner
    this.active = null
    const deadline = this.deadline()
    this.publish({ availability: 'checking', busy: false, canStop: false, setupCandidate: null })
    try {
      const history = await this.loadHistory(conversationId, deadline.signal)
      if (generation !== this.generation || owner !== this.owner) return false
      const last = history.turns.at(-1)
      if (!last || last.conversationId !== conversationId) throw new Error('CONSULTATION_HISTORY_BINDING')
      // Neither a stored locator nor a successful claim invents turn authority.
      // Persist only an actual turn from the newly authorized server history.
      this.persistAccepted({ version: 1, owner, conversationId, turnId: last.turnId })
      await this.restoreAccepted(generation, owner, this.accepted!, deadline.signal, history)
      return generation === this.generation && owner === this.owner && this.state.conversationId === conversationId
    } catch {
      if (generation === this.generation) this.publish({ availability: 'error', issue: unconfirmedIssue, canResumeObservation: true })
      return false
    } finally { deadline.dispose() }
  }

  async restoreClaimedDocumentAnchors(sourceOwner: string, conversationId: string): Promise<boolean> {
    const owner = this.owner, generation = this.generation, accepted = this.accepted
    if (!owner || !this.storage || !this.documentAdapter || this.storageFailed
      || !validClaimOwnerTransition(sourceOwner, owner) || !ID.test(conversationId)
      || this.state.conversationId !== conversationId || accepted?.conversationId !== conversationId) return false
    const sourceKey = documentQuestionKey(sourceOwner), targetKey = documentQuestionKey(owner)
    const sourceRaw = this.storage.getItem(sourceKey)
    if (sourceRaw === null) return true
    let source: DocumentQuestionJournal
    try { source = parseDocumentJournal(sourceRaw, sourceOwner) }
    catch { return false }
    if (source.conversationId !== conversationId
      || source.stage !== 'settled' && !(source.stage === 'admitted' && source.joined)
      || source.bindings.length < 1) return false
    const target: SettledDocumentQuestionJournal = {
      version: 2, stage: 'settled', owner, conversationId, bindings: source.bindings,
    }
    const targetRaw = JSON.stringify(target), existingTargetRaw = this.storage.getItem(targetKey)
    if (new TextEncoder().encode(targetRaw).length > MAX_DOCUMENT_JOURNAL_BYTES
      || existingTargetRaw !== null && existingTargetRaw !== targetRaw
      || existingTargetRaw !== null && this.documentJournalRaw !== existingTargetRaw) return false
    const deadline = this.deadline()
    try {
      const documentHistory = await this.loadDocumentHistory(conversationId, deadline.signal)
      if (generation !== this.generation || owner !== this.owner || accepted !== this.accepted) return false
      const consultationHistory = await this.loadHistory(conversationId, deadline.signal)
      if (generation !== this.generation || owner !== this.owner || accepted !== this.accepted) return false
      const verified = await this.verifyDocumentBindings(source.bindings, documentHistory, consultationHistory, deadline.signal)
      if (generation !== this.generation || owner !== this.owner || accepted !== this.accepted
        || this.storage.getItem(sourceKey) !== sourceRaw || this.storage.getItem(targetKey) !== existingTargetRaw) return false
      if (existingTargetRaw === null) this.persistDocumentJournal(target)
      else {
        this.documentJournal = target
        this.documentJournalRaw = targetRaw
      }
      this.documentVerifiedThreads = verified
      const anchors = new Map<string, NativeResearchThreadOrigin>()
      source.bindings.forEach(binding => {
        anchors.set(binding.clientMessageId, binding.researchThread)
        anchors.set(`${binding.turnId}_reply`, binding.researchThread)
      })
      this.publish({ messages: this.state.messages.map(message => {
        const researchThread = anchors.get(message.id)
        return researchThread ? { ...message, researchThread } : message
      }) })
      return true
    } catch { return false }
    finally { deadline.dispose() }
  }

  verifiedReportResearchWorkId(): string | null {
    const journal = this.documentJournal
    if (!journal || journal.stage !== 'settled' && !(journal.stage === 'admitted' && journal.joined)) return null
    const workIds = new Set<string>()
    for (const binding of journal.bindings) {
      if (binding.locator.kind !== 'report') continue
      const verified = this.documentVerifiedThreads.get(binding.turnId)
      if (!verified || verified.documentId !== 'report' || binding.researchThread.documentId !== 'report'
        || verified.scopeId !== binding.researchThread.scopeId || verified.scopeId !== binding.locator.documentId) return null
      workIds.add(binding.locator.documentId)
    }
    return workIds.size === 1 ? [...workIds][0] : null
  }

  private async verifyDocumentBindings(bindings: readonly DocumentQuestionBinding[], documentHistory: readonly DocumentQuestionTurnProjection[],
    consultationHistory: Awaited<ReturnType<NativeConsultationV13Controller['loadHistory']>>, signal: AbortSignal) {
    const verified = new Map<string, NativeResearchThreadOrigin>()
    for (const binding of bindings) {
      const documentMatches = documentHistory.filter(candidate => candidate.turnId === binding.turnId)
      const consultationMatches = consultationHistory.turns.filter(candidate => candidate.turnId === binding.turnId)
      if (documentMatches.length !== 1 || consultationMatches.length !== 1
        || !projectionMatchesBinding(documentMatches[0], binding)) throw new Error('CONSULTATION_DOCUMENT_BINDING')
      const projection = await this.documentAdapter!.turn(binding.turnId, { signal })
      const latest = (await this.adapter.turn(binding.turnId, signal)).data
      const observed = consultationMatches[0]
      const latestTextSha256 = await textSha256(latest.userText)
      if (!projectionMatchesBinding(projection, binding)
        || latest.turnId !== binding.turnId || latest.conversationId !== binding.conversationId
        || latest.clientMessageId !== binding.clientMessageId || latestTextSha256 !== binding.textSha256
        || latest.createdAt !== binding.createdAt || latest.lastSequence < binding.lastSequence
        || observed.conversationId !== binding.conversationId || observed.clientMessageId !== binding.clientMessageId
        || observed.userText !== latest.userText || observed.createdAt !== binding.createdAt
        || latest.lastSequence < observed.lastSequence) throw new Error('CONSULTATION_DOCUMENT_BINDING')
      verified.set(binding.turnId, binding.researchThread)
    }
    return verified
  }

  private async reconcileSettledDocument(generation: number, owner: string, initial: SettledDocumentQuestionJournal, signal: AbortSignal) {
    if (!this.documentAdapter || initial !== this.documentJournal || !this.accepted
      || this.accepted.conversationId !== initial.conversationId) throw new Error('CONSULTATION_DOCUMENT_BINDING')
    const documentHistory = await this.loadDocumentHistory(initial.conversationId, signal)
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    const consultationHistory = await this.loadHistory(initial.conversationId, signal)
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    const verified = await this.verifyDocumentBindings(initial.bindings, documentHistory, consultationHistory, signal)
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    this.documentVerifiedThreads = verified
    await this.restoreAccepted(generation, owner, this.accepted, signal, consultationHistory)
    return generation === this.generation && owner === this.owner && initial === this.documentJournal
  }

  private async reconcileDocumentAdmission(generation: number, owner: string, initial: ActiveDocumentQuestionJournal, signal: AbortSignal) {
    if (!this.documentAdapter || initial.stage !== 'admitted' || initial.turnId === null || initial.questionRequest === null
      || initial.conversationId === null || initial !== this.documentJournal) throw new Error('CONSULTATION_DOCUMENT_BINDING')
    const conversationId = initial.conversationId, turnId = initial.turnId, questionRequest = initial.questionRequest
    const projection = await this.documentAdapter.turn(turnId, { signal })
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    const documentHistory = await this.loadDocumentHistory(conversationId, signal)
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    const documentMatches = documentHistory.filter(candidate => candidate.turnId === turnId)
    if (documentMatches.length !== 1 || !projectionMatchesJournal(projection, initial)
      || !projectionMatchesJournal(documentMatches[0], initial)) throw new Error('CONSULTATION_DOCUMENT_BINDING')

    const consultationHistory = await this.loadHistory(conversationId, signal)
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    const consultationMatches = consultationHistory.turns.filter(candidate => candidate.turnId === turnId)
    if (consultationMatches.length !== 1) throw new Error('CONSULTATION_DOCUMENT_BINDING')
    const consultationTurn = (await this.adapter.turn(turnId, signal)).data
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    const observed = consultationMatches[0]
    if (consultationTurn.turnId !== turnId || consultationTurn.conversationId !== conversationId
      || consultationTurn.clientMessageId !== initial.clientMessageId || consultationTurn.userText !== questionRequest.text
      || observed.conversationId !== consultationTurn.conversationId || observed.clientMessageId !== consultationTurn.clientMessageId
      || observed.userText !== consultationTurn.userText || observed.createdAt !== consultationTurn.createdAt
      || consultationTurn.lastSequence < observed.lastSequence) throw new Error('CONSULTATION_DOCUMENT_BINDING')

    const currentTextSha256 = await textSha256(questionRequest.text)
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    const verified = await this.verifyDocumentBindings(initial.bindings, documentHistory, consultationHistory, signal)
    if (generation !== this.generation || owner !== this.owner || initial !== this.documentJournal) return false
    let journal = initial
    if (!journal.joined) {
      const binding: DocumentQuestionBinding = {
        conversationId, turnId, clientMessageId: journal.clientMessageId,
        textSha256: currentTextSha256, createdAt: consultationTurn.createdAt, lastSequence: consultationTurn.lastSequence,
        documentRef: questionRequest.documentRef, locator: journal.mintRequest.locator,
        researchThread: journal.researchThread,
      }
      const bindings = [...journal.bindings.filter(candidate => candidate.turnId !== binding.turnId), binding]
      if (bindings.length > MAX_DOCUMENT_BINDINGS) throw new Error('CONSULTATION_DOCUMENT_STORAGE_UNAVAILABLE')
      this.persistAccepted({ version: 1, owner, conversationId, turnId })
      this.persistDocumentJournal({ ...journal, joined: true, bindings })
      journal = this.documentJournal as ActiveDocumentQuestionJournal
      verified.set(binding.turnId, binding.researchThread)
    } else if (!this.accepted || this.accepted.conversationId !== journal.conversationId) {
      throw new Error('CONSULTATION_DOCUMENT_BINDING')
    }
    const current = journal.bindings.filter(candidate => candidate.turnId === journal.turnId)
    if (current.length !== 1 || !projectionMatchesBinding(projection, current[0])
      || current[0].textSha256 !== currentTextSha256 || current[0].createdAt !== consultationTurn.createdAt
      || current[0].lastSequence > consultationTurn.lastSequence
      || current[0].researchThread.scopeId !== journal.researchThread.scopeId
      || current[0].researchThread.documentId !== journal.researchThread.documentId) throw new Error('CONSULTATION_DOCUMENT_BINDING')
    this.documentVerifiedThreads = verified
    const locator = this.accepted
    if (!locator) throw new Error('CONSULTATION_DOCUMENT_BINDING')
    await this.restoreAccepted(generation, owner, locator, signal, consultationHistory)
    return generation === this.generation && owner === this.owner && journal === this.documentJournal
  }

  private async restoreAccepted(generation: number, owner: string, locator: AcceptedLocator, signal: AbortSignal,
    observedHistory?: Awaited<ReturnType<NativeConsultationV13Controller['loadHistory']>>) {
    const historyResponse = observedHistory ?? await this.loadHistory(locator.conversationId, signal)
    if (generation !== this.generation || owner !== this.owner || locator !== this.accepted) return
    const turnResponse = await this.adapter.turn(locator.turnId, signal)
    if (generation !== this.generation || owner !== this.owner || locator !== this.accepted) return
    const locatorTurn = turnResponse.data, history = historyResponse
    const locatorObserved = history.turns.find(candidate => candidate.turnId === locator.turnId)
    if (!locatorObserved || locatorTurn.turnId !== locator.turnId || locatorTurn.conversationId !== locator.conversationId
      || history.conversationId !== locator.conversationId || locatorObserved.conversationId !== locator.conversationId
      || locatorObserved.clientMessageId !== locatorTurn.clientMessageId || locatorObserved.userText !== locatorTurn.userText
      || locatorObserved.createdAt !== locatorTurn.createdAt || locatorTurn.lastSequence < locatorObserved.lastSequence) {
      throw new Error('CONSULTATION_LOCATOR_BINDING')
    }
    let turn = locatorTurn
    const pending = this.pending
    if (pending && (pending.conversationId === history.conversationId || pending.conversationId === null)) {
      const matches = history.turns.filter(candidate => candidate.clientMessageId === pending.clientMessageId && candidate.userText === pending.text
        && candidate.conversationId === history.conversationId
        && (pending.conversationId !== null || candidate.turnId === locator.turnId))
      if (matches.length > 1) throw new Error('CONSULTATION_PENDING_BINDING')
      if (matches.length === 1) {
        const candidate = matches[0]
        const latest = candidate.turnId === locatorTurn.turnId ? locatorTurn : (await this.adapter.turn(candidate.turnId, signal)).data
        if (generation !== this.generation || owner !== this.owner || locator !== this.accepted || pending !== this.pending) return
        if (latest.turnId !== candidate.turnId || latest.conversationId !== candidate.conversationId
          || latest.clientMessageId !== candidate.clientMessageId || latest.userText !== candidate.userText
          || latest.createdAt !== candidate.createdAt || latest.lastSequence < candidate.lastSequence) throw new Error('CONSULTATION_PENDING_BINDING')
        this.persistAccepted({ version: 1, owner, conversationId: latest.conversationId, turnId: latest.turnId })
        turn = latest
      }
    }
    if (this.pendingCancel && this.pendingCancel.turnId !== turn.turnId) throw new Error('CONSULTATION_CANCEL_BINDING')
    if (this.pending && this.pending.clientMessageId === turn.clientMessageId && this.pending.text === turn.userText
      && (this.pending.conversationId === turn.conversationId || this.pending.conversationId === null && turn.turnId === locator.turnId)) {
      try { this.clearPending() }
      catch { this.storageFailed = true }
    }
    let completedTurnSeen = false, activeAllowTitle = false
    const messages = history.turns.flatMap(item => {
      const observed = item.turnId === turn.turnId ? turn : item
      const allowTitle = !completedTurnSeen
      if (observed.turnId === turn.turnId) activeAllowTitle = allowTitle
      if (observed.state === 'COMPLETED') completedTurnSeen = true
      return this.turnMessages(observed, item.turnId === turn.turnId, allowTitle)
    })
    this.completedTurnSeen = completedTurnSeen
    if (terminal.has(turn.state as TerminalState)) {
      if (this.pendingCancel) this.clearPendingCancel()
      this.active = null
      this.publish({ availability: 'available', messages, conversationId: turn.conversationId, activeTurnId: null,
        busy: false, canStop: false, ...this.pendingFlags(), ...this.documentPendingFlags(), canResumeObservation: false,
        setupCandidate: null,
        issue: turn.state === 'COMPLETED' && !this.pending && !this.storageFailed ? null : unconfirmedIssue })
      const setup = turn.state === 'COMPLETED' ? this.setupFrom(turn.answerText, owner, turn.turnId, activeAllowTitle) : null
      if (setup && this.accepted === locator) this.scheduleSetupObservation({ generation, owner, locator,
        clientMessageId: turn.clientMessageId, userText: turn.userText, createdAt: turn.createdAt,
        answerText: turn.answerText, lastSequence: turn.lastSequence, allowTitle: activeAllowTitle, setup })
      return
    }
    const active: ActiveTurn = {
      generation, turnId: turn.turnId, clientMessageId: turn.clientMessageId, assistantMessageId: `${turn.turnId}_reply`,
      userText: turn.userText, createdAt: turn.createdAt, cursor: turn.lastSequence, answer: turn.answerText, allowTitle: activeAllowTitle,
      ...(this.documentVerifiedThreads.has(turn.turnId) ? { researchThread: this.documentVerifiedThreads.get(turn.turnId)! } : {}),
      seen: new Map(), terminal: false, cancelling: false,
      reader: new AbortController(),
    }
    this.active = active
    this.publish({ availability: 'available', messages, conversationId: turn.conversationId, activeTurnId: turn.turnId,
      busy: true, canStop: true, canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: false,
      setupCandidate: null, issue: this.pendingCancel || this.pending || this.documentPending() || this.storageFailed ? unconfirmedIssue : null })
    void this.follow(active)
  }

  private turnMessages(turn: Turn, current: boolean, allowTitle: boolean): ClientServiceMessage[] {
    const assistantMessageId = `${turn.turnId}_reply`
    const status = current && !terminal.has(turn.state as TerminalState)
      ? 'streaming' : turn.state === 'COMPLETED' ? 'done' : 'interrupted'
    const displayState: NativeInvestmentDisplayState = status === 'streaming' ? 'STREAMING'
      : status === 'done' ? 'COMPLETED' : terminal.has(turn.state as TerminalState) ? turn.state as NativeInvestmentDisplayState : 'FAILED'
    const display = projectNativeInvestmentDisplay({ text: turn.answerText, state: displayState,
      scopeId: this.owner ?? '', messageId: assistantMessageId, allowTitle })
    const researchThread = this.documentVerifiedThreads.get(turn.turnId)
    return [
      { id: turn.clientMessageId, role: 'user', text: turn.userText, delivery: 'answered', ...(researchThread ? { researchThread } : {}) },
      { id: assistantMessageId, role: 'assistant', text: display.text, responseBlocks: display.blocks,
        ...(researchThread ? { researchThread } : {}),
        ...(display.titleSuggestion ? { displayTitleSuggestion: display.titleSuggestion } : {}) },
    ]
  }

  async sendDocumentQuestion(input: NativeDocumentQuestionRequest): Promise<boolean> {
    if (this.state.availability !== 'available' || !this.owner || !this.documentAdapter
      || !this.documentCsrfToken || this.active || this.state.busy || this.creating || this.pending || this.pendingCancel
      || this.documentPending() || this.documentAdmissionPending() || (this.documentJournal?.bindings.length ?? 0) >= MAX_DOCUMENT_BINDINGS
      || this.storageFailed || !validResearchThread(input.researchThread)) return false
    const owner = this.owner, conversationId = this.state.conversationId, generation = this.generation
    const clientMessageId = id('client_message', this.randomId), text = input.text.normalize('NFC')
    const probe: DocumentQuestionRequest = { apiContractVersion: '0.16.0', clientMessageId, text,
      documentRef: 'docref_document_question_probe_000001' }
    if (!validateApiV16(probe, 'DocumentQuestionRequest')) return false
    this.creating = true
    this.publish({ busy: true, canStop: false, canResumePending: false, canDiscardPending: false,
      canResumeDocumentPending: false, canResumeObservation: false, issue: null, setupCandidate: null })
    const deadline = this.deadline()
    let locator: ProducerLocator
    try {
      locator = await this.documentAdapter.locator(input.kind, input.documentId, { signal: deadline.signal })
      if (generation !== this.generation || owner !== this.owner || conversationId !== this.state.conversationId) return false
      const bindings = conversationId !== null && this.documentJournal && this.documentJournal.conversationId === conversationId
        && (this.documentJournal.stage === 'settled' || this.documentJournal.joined) ? this.documentJournal.bindings : []
      const journal: ActiveDocumentQuestionJournal = {
        version: 2, stage: 'mint-ready', attempted: false, disposition: 'uncertain', owner, conversationId, clientMessageId, text,
        researchThread: { scopeId: input.researchThread.scopeId, documentId: input.researchThread.documentId },
        mintIdempotencyKey: id('document_reference', this.randomId),
        questionIdempotencyKey: id('document_question', this.randomId),
        mintRequest: { apiContractVersion: '0.16.0', locator }, questionRequest: null, turnId: null, joined: false, bindings,
      }
      this.persistDocumentJournal(journal)
      this.documentVerifiedThreads.clear()
    } catch {
      if (generation === this.generation) {
        if (this.documentPending()) this.publish({ issue: unconfirmedIssue, busy: false, ...this.documentPendingFlags() })
        else this.publish({ issue: null, busy: false, canResumeDocumentPending: false })
      }
      return false
    } finally {
      deadline.dispose()
      if (generation === this.generation) this.creating = false
    }
    if (generation !== this.generation || owner !== this.owner) return false
    this.publish({ busy: false })
    return this.dispatchDocumentPending(this.documentJournal as ActiveDocumentQuestionJournal)
  }

  private async dispatchDocumentPending(initial: ActiveDocumentQuestionJournal): Promise<boolean> {
    if (!this.owner || !this.documentAdapter || !this.documentCsrfToken || initial !== this.documentJournal
      || initial.owner !== this.owner || initial.stage === 'admitted' || initial.disposition !== 'uncertain'
      || this.active || this.state.busy || this.creating
      || this.pending || this.pendingCancel || this.storageFailed) return false
    const flight = `${initial.owner}\u0000${initial.mintIdempotencyKey}\u0000${initial.questionIdempotencyKey}`
    if (this.documentFlights.has(flight)) return false
    const generation = this.generation, owner = this.owner
    this.documentFlights.add(flight)
    this.creating = true
    this.publish({ busy: true, canStop: false, canResumePending: false, canDiscardPending: false,
      canResumeDocumentPending: false, canResumeObservation: false, issue: null, setupCandidate: null })
    const deadline = this.deadline()
    let firstMutationAttempt = false
    try {
      let journal = initial
      if (journal.stage === 'mint-ready') {
        firstMutationAttempt = !journal.attempted
        if (firstMutationAttempt) {
          this.persistDocumentJournal({ ...journal, attempted: true })
          journal = this.documentJournal as ActiveDocumentQuestionJournal
        }
        const snapshot = await this.documentAdapter.mint(journal.mintRequest, {
          csrfToken: this.documentCsrfToken(), idempotencyKey: journal.mintIdempotencyKey, signal: deadline.signal,
        })
        if (generation !== this.generation || owner !== this.owner || journal !== this.documentJournal) return false
        const questionRequest: DocumentQuestionRequest = { apiContractVersion: '0.16.0', clientMessageId: journal.clientMessageId,
          text: documentJournalText(journal), documentRef: snapshot.documentRef }
        this.persistDocumentJournal({ ...journal, stage: 'question-ready', attempted: false, disposition: 'uncertain', text: null, questionRequest })
        journal = this.documentJournal as ActiveDocumentQuestionJournal
      }
      if (journal.stage === 'question-ready' && journal.questionRequest) {
        firstMutationAttempt = !journal.attempted
        if (firstMutationAttempt) {
          this.persistDocumentJournal({ ...journal, attempted: true })
          journal = this.documentJournal as ActiveDocumentQuestionJournal
        }
        const questionRequest = journal.questionRequest
        if (questionRequest === null) throw new Error('CONSULTATION_DOCUMENT_BINDING')
        const admission = journal.conversationId === null
          ? await this.documentAdapter.questionFirst(questionRequest, {
            csrfToken: this.documentCsrfToken(), idempotencyKey: journal.questionIdempotencyKey, signal: deadline.signal,
          })
          : await this.documentAdapter.question(journal.conversationId, questionRequest, {
            csrfToken: this.documentCsrfToken(), idempotencyKey: journal.questionIdempotencyKey, signal: deadline.signal,
          })
        if (generation !== this.generation || owner !== this.owner || journal !== this.documentJournal) return false
        if (journal.conversationId !== null && admission.conversationId !== journal.conversationId) throw new Error('CONSULTATION_DOCUMENT_BINDING')
        this.persistDocumentJournal({ ...journal, stage: 'admitted', disposition: 'uncertain', conversationId: admission.conversationId,
          turnId: admission.turnId, joined: false })
        journal = this.documentJournal as ActiveDocumentQuestionJournal
      }
      if (journal.stage !== 'admitted') throw new Error('CONSULTATION_DOCUMENT_BINDING')
      return await this.reconcileDocumentAdmission(generation, owner, journal, deadline.signal)
    } catch (error) {
      if (generation === this.generation && firstMutationAttempt && error instanceof ApiV16Error
        && error.status >= 400 && error.status < 500
        && (this.documentJournal?.stage === 'mint-ready' || this.documentJournal?.stage === 'question-ready')) {
        try { this.persistDocumentJournal({ ...this.documentJournal, disposition: 'refused' }) }
        catch { this.storageFailed = true }
      }
      if (generation === this.generation) {
        const admissionPending = this.documentAdmissionPending()
        this.publish({ availability: admissionPending ? 'error' : 'available', issue: unconfirmedIssue, busy: false, canStop: false,
          ...this.pendingFlags(), ...this.documentPendingFlags(), canResumeObservation: admissionPending })
      }
      return false
    } finally {
      deadline.dispose()
      this.documentFlights.delete(flight)
      if (generation === this.generation) this.creating = false
    }
  }

  resumeDocumentPending() {
    if (!this.documentJournal || this.documentJournal.stage === 'admitted' || this.documentJournal.stage === 'settled'
      || this.documentJournal.disposition !== 'uncertain' || this.storageFailed
      || this.state.availability !== 'available' || !this.owner) return Promise.resolve(false)
    return this.dispatchDocumentPending(this.documentJournal)
  }

  async send(text: string, displayText?: string): Promise<boolean> {
    if (this.state.availability !== 'available' || !this.owner || this.active || this.state.busy || this.creating || this.pendingCancel
      || this.documentPending() || this.documentAdmissionPending() || this.storageFailed) return false
    const value = text.normalize('NFC')
    if (this.pending) {
      this.publish({ issue: unconfirmedIssue, ...this.pendingFlags() })
      return false
    }
    const request: PendingCreate = {
      version: 3, owner: this.owner, conversationId: this.state.conversationId,
      clientMessageId: id('client_message', this.randomId), text: value,
      idempotencyKey: id('consultation_request', this.randomId), attempted: false, disposition: 'uncertain',
    }
    try {
      this.adapter.validateCreate({ conversationId: request.conversationId, clientMessageId: request.clientMessageId, text: request.text })
      this.persistPending(request)
    } catch (error) {
      if (error instanceof ConsultationV13ProtocolError && this.pending === null) return false
      this.storageFailed = true
      this.publish({ issue: unconfirmedIssue, busy: false, canStop: false, canResumePending: false, canDiscardPending: false })
      return false
    }
    return this.dispatchPending(request, displayText)
  }

  private async dispatchPending(initial: PendingCreate, displayText?: string): Promise<boolean> {
    let request = initial
    if (!this.owner || request.owner !== this.owner || request !== this.pending || request.disposition !== 'uncertain'
      || this.active || this.state.busy || this.creating || this.pendingCancel || this.storageFailed) return false
    const flight = `${request.owner}\u0000${request.idempotencyKey}`
    if (this.createFlights.has(flight)) return false
    const generation = this.generation
    const firstAttempt = !request.attempted
    this.createFlights.add(flight)
    if (firstAttempt) {
      try {
        this.persistPending({ ...request, attempted: true })
        request = this.pending!
      } catch {
        this.createFlights.delete(flight)
        this.storageFailed = true
        this.publish({ issue: unconfirmedIssue, busy: false, canStop: false, canResumePending: false, canDiscardPending: false })
        return false
      }
    }
    this.creating = true
    this.publish({ busy: true, canStop: false, canResumePending: false, canDiscardPending: false,
      canResumeObservation: false, issue: null, setupCandidate: null })
    let response
    try {
      response = await this.adapter.create({ conversationId: request.conversationId, clientMessageId: request.clientMessageId, text: request.text }, request.idempotencyKey)
    } catch (error) {
      if (generation === this.generation && firstAttempt && error instanceof ConsultationV13HttpError
        && (error.code === 'BAD_REQUEST' || error.code === 'NOT_FOUND')) {
        try { this.persistPending({ ...request, disposition: 'refused' }) }
        catch { this.storageFailed = true }
      }
      if (generation === this.generation) this.publish({ issue: unconfirmedIssue, busy: false, canStop: false, ...this.pendingFlags() })
      return false
    } finally {
      this.createFlights.delete(flight)
      if (generation === this.generation) this.creating = false
    }
    if (generation !== this.generation || !this.owner) return false
    const turn = response.data
    if (turn.clientMessageId !== request.clientMessageId || turn.userText !== request.text
      || (request.conversationId !== null && turn.conversationId !== request.conversationId)) {
      this.publish({ issue: unconfirmedIssue, busy: false, canStop: false, ...this.pendingFlags() })
      return false
    }
    try {
      this.persistAccepted({ version: 1, owner: this.owner, conversationId: turn.conversationId, turnId: turn.turnId })
      this.clearPending()
    }
    catch { this.storageFailed = true }
    const assistantMessageId = `${turn.turnId}_reply`
    const matching = this.state.messages.filter(message => message.id === request.clientMessageId || message.id === assistantMessageId)
    const existingUser = matching.filter(message => message.id === request.clientMessageId)
    const existingAssistant = matching.filter(message => message.id === assistantMessageId)
    if (matching.length !== 0 && (matching.length !== 2 || existingUser.length !== 1 || existingAssistant.length !== 1
      || existingUser[0].role !== 'user' || existingUser[0].text !== request.text || existingAssistant[0].role !== 'assistant')) {
      this.publish({ issue: unconfirmedIssue, busy: false, canStop: false, ...this.pendingFlags() })
      return false
    }
    const active: ActiveTurn = {
      generation, turnId: turn.turnId, clientMessageId: request.clientMessageId, assistantMessageId, cursor: turn.lastSequence,
      userText: turn.userText, createdAt: turn.createdAt, answer: turn.answerText, allowTitle: !this.completedTurnSeen, seen: new Map(),
      terminal: terminal.has(turn.state as TerminalState), cancelling: false, reader: new AbortController(),
    }
    this.active = active
    const userMessage: ClientServiceMessage = { id: request.clientMessageId, role: 'user', text: request.text,
      displayText: existingUser[0]?.displayText ?? displayText, delivery: 'answered' }
    const assistantMessage = this.assistantMessage(active, active.terminal ? (turn.state === 'COMPLETED' ? 'done' : 'interrupted') : 'streaming')
    const messages = matching.length === 0
      ? [...this.state.messages, userMessage, assistantMessage]
      : this.state.messages.map(message => message.id === request.clientMessageId ? userMessage
        : message.id === assistantMessageId ? assistantMessage : message)
    this.publish({
      issue: null, conversationId: turn.conversationId, activeTurnId: turn.turnId,
      messages,
      busy: !active.terminal, canStop: !active.terminal, canResumePending: false, canDiscardPending: false, canResumeDocumentPending: false, canResumeObservation: false,
    })
    if (this.storageFailed) this.publish({ issue: unconfirmedIssue })
    if (active.terminal) this.finish(active, turn.state === 'COMPLETED')
    else void this.follow(active)
    return true
  }

  private assistantMessage(active: ActiveTurn, status: 'streaming' | 'done' | 'interrupted'): ClientServiceMessage {
    const display = projectNativeInvestmentDisplay({ text: active.answer,
      state: status === 'streaming' ? 'STREAMING' : status === 'done' ? 'COMPLETED' : 'FAILED',
      scopeId: this.owner ?? '', messageId: active.assistantMessageId, allowTitle: active.allowTitle })
    return { id: active.assistantMessageId, role: 'assistant', text: display.text, responseBlocks: display.blocks,
      ...(active.researchThread ? { researchThread: active.researchThread } : {}),
      ...(display.titleSuggestion ? { displayTitleSuggestion: display.titleSuggestion } : {}) }
  }

  private updateAssistant(active: ActiveTurn, status: 'streaming' | 'done' | 'interrupted') {
    if (!this.current(active)) return
    this.publish({ messages: this.state.messages.map(message => message.id === active.assistantMessageId ? this.assistantMessage(active, status) : message) })
  }

  private current(active: ActiveTurn) {
    return this.active === active && active.generation === this.generation && !active.terminal
  }

  private acceptEvent(active: ActiveTurn, event: Event, canonical = consultationV13CanonicalEvent(event)) {
    if (!this.current(active) || event.turnId !== active.turnId) return false
    const previous = active.seen.get(event.sequence)
    if (previous !== undefined) {
      if (previous !== canonical) throw new Error('CONSULTATION_EVENT_CONFLICT')
      return true
    }
    if (event.sequence !== active.cursor + 1) throw new Error('CONSULTATION_EVENT_GAP')
    active.seen.set(event.sequence, canonical)
    active.cursor = event.sequence
    if (event.payload.type === 'answer_delta') {
      active.answer = `${active.answer}${event.payload.text}`.normalize('NFC')
      this.updateAssistant(active, 'streaming')
    } else if (event.payload.type === 'terminal') {
      this.finish(active, event.payload.state === 'COMPLETED')
    }
    return true
  }

  private acceptPage(active: ActiveTurn, response: Awaited<ReturnType<ConsultationV13Adapter['events']>>) {
    const page = response.data
    if (page.turnId !== active.turnId || page.after !== active.cursor) throw new Error('CONSULTATION_EVENT_BINDING')
    for (const event of page.events) this.acceptEvent(active, event)
    if (this.current(active) && page.nextSequence !== active.cursor) throw new Error('CONSULTATION_EVENT_BINDING')
    return page.terminal
  }

  private acceptTurn(active: ActiveTurn, turn: Turn) {
    if (!this.current(active) || turn.turnId !== active.turnId || turn.clientMessageId !== active.clientMessageId
      || turn.conversationId !== this.state.conversationId || turn.lastSequence < active.cursor) throw new Error('CONSULTATION_TURN_BINDING')
    if (turn.lastSequence > active.cursor) return false
    if (turn.answerText !== active.answer) throw new Error('CONSULTATION_ANSWER_CONFLICT')
    if (terminal.has(turn.state as TerminalState)) this.finish(active, turn.state === 'COMPLETED')
    return true
  }

  private restartFollow(active: ActiveTurn) {
    if (!this.current(active)) return
    active.reader.abort()
    active.reader = new AbortController()
    void this.follow(active)
  }

  private async follow(active: ActiveTurn) {
    const reader = active.reader, deadline = this.deadline(reader.signal)
    const startedAt = this.now()
    let attempt = 0, scheduledElapsed = 0
    try {
      while (this.current(active) && reader === active.reader && !deadline.signal.aborted
        && Math.max(this.now() - startedAt, scheduledElapsed) < this.observationTimeoutMs) {
        const cursorBefore = active.cursor
        try {
          for await (const observed of this.adapter.stream(active.turnId, active.cursor, deadline.signal)) {
            this.acceptEvent(active, observed.event, observed.canonical)
            if (!this.current(active) || reader !== active.reader) return
          }
          if (!this.current(active) || reader !== active.reader) return
          const terminalPage = this.acceptPage(active, await this.adapter.events(active.turnId, active.cursor, 100, deadline.signal))
          if (!this.current(active) || reader !== active.reader) return
          if (terminalPage) {
            this.acceptTurn(active, (await this.adapter.turn(active.turnId, deadline.signal)).data)
            if (!this.current(active) || reader !== active.reader) return
          }
        } catch (error) {
          if (!this.current(active) || reader !== active.reader) return
          if (deadline.timedOut()) { this.interrupt(active); return }
          if (reader.signal.aborted && error instanceof DOMException && error.name === 'AbortError') return
          const retryable = error instanceof TypeError || error instanceof ConsultationV13TransportError
            || error instanceof ConsultationV13HttpError && (error.status === 429 || error.status >= 500)
          if (!retryable || error instanceof ConsultationV13ProtocolError
            || error instanceof Error && error.message.startsWith('CONSULTATION_EVENT_')
            || error instanceof Error && error.message.startsWith('CONSULTATION_TURN_')
            || error instanceof Error && error.message.startsWith('CONSULTATION_ANSWER_')) {
            this.interrupt(active)
            return
          }
        }
        if (active.cursor > cursorBefore) attempt = 0
        const delay = this.reconnectDelayMs[Math.min(attempt++, this.reconnectDelayMs.length - 1)] ?? 1_000
        scheduledElapsed += Math.max(1, delay)
        if (!deadline.signal.aborted && Math.max(this.now() - startedAt, scheduledElapsed) < this.observationTimeoutMs) await this.wait(delay)
      }
      if (!this.current(active) || reader !== active.reader) return
      this.interrupt(active)
    } finally { deadline.dispose() }
  }

  async stop() {
    const active = this.active
    if (!active || !this.current(active) || active.cancelling) return
    let request = this.pendingCancel
    if (request && request.turnId !== active.turnId) {
      this.publish({ issue: unconfirmedIssue, canStop: false })
      return
    }
    if (!request) {
      if (!this.owner) return
      request = { version: 1, owner: this.owner, turnId: active.turnId, idempotencyKey: id('consultation_cancel', this.randomId) }
      try { this.persistPendingCancel(request) }
      catch {
        this.storageFailed = true
        this.publish({ issue: unconfirmedIssue, canStop: false })
        return
      }
    }
    active.cancelling = true
    this.publish({ canStop: false })
    try {
      const response = await this.adapter.cancel(active.turnId, request.idempotencyKey)
      if (!this.current(active)) return
      if (!this.acceptTurn(active, response.data.turn)) this.restartFollow(active)
    } catch (error) {
      if (!this.current(active)) return
      if (error instanceof ConsultationV13HttpError && error.status === 500) {
        const deadline = this.deadline(active.reader.signal)
        try {
          if (!this.acceptTurn(active, (await this.adapter.turn(active.turnId, deadline.signal)).data)) this.restartFollow(active)
        } catch (observedError) {
          if (this.protocolViolation(observedError)) { this.interrupt(active); return }
          /* Preserve the observed partial and continue explicit observation. */
        }
        finally { deadline.dispose() }
      } else if (this.protocolViolation(error)) {
        this.interrupt(active)
        return
      }
      if (this.current(active)) this.publish({ busy: true, canStop: true, issue: unconfirmedIssue })
    } finally {
      if (this.current(active)) active.cancelling = false
    }
  }

  resumePending() {
    if (!this.pending || this.pending.disposition !== 'uncertain' || this.storageFailed || this.state.availability !== 'available' || !this.owner) return Promise.resolve(false)
    return this.dispatchPending(this.pending)
  }

  discardPending() {
    const discardCreate = this.pending?.disposition === 'refused'
    const discardDocument = Boolean(this.documentJournal && this.documentJournal.stage !== 'settled'
      && this.documentJournal.disposition === 'refused')
    if ((!discardCreate && !discardDocument) || this.storageFailed || this.state.busy || this.creating) return false
    let observeDocument = false
    try {
      if (discardCreate) this.clearPending()
      else observeDocument = this.discardRefusedDocumentJournal()
    }
    catch { this.storageFailed = true; this.publish({ issue: unconfirmedIssue, ...this.pendingFlags() }); return false }
    this.publish({ availability: observeDocument ? 'error' : this.state.availability,
      issue: observeDocument ? unconfirmedIssue : null, ...this.pendingFlags(), ...this.documentPendingFlags(),
      canResumeObservation: observeDocument })
    return true
  }

  async resumeObservation() {
    if (!this.owner || this.state.busy || !['error', 'unavailable'].includes(this.state.availability)) return false
    await this.activate()
    return this.state.availability === 'available'
  }

  async history(): Promise<History | null> {
    const owner = this.owner, generation = this.generation, conversationId = this.state.conversationId
    if (!owner || !conversationId) return null
    const deadline = this.deadline()
    let history: History
    try { history = await this.loadHistory(conversationId, deadline.signal) }
    finally { deadline.dispose() }
    if (owner !== this.owner || generation !== this.generation || history.conversationId !== conversationId) return null
    return history
  }

  reset() {
    if (this.state.busy || this.creating || this.pending || this.pendingCancel || this.documentPending()
      || this.documentAdmissionPending() || this.storageFailed) return false
    try {
      if (this.documentJournal && ['admitted', 'settled'].includes(this.documentJournal.stage)) this.clearDocumentJournal()
      this.clearAccepted()
    }
    catch {
      this.storageFailed = true
      this.publish({ issue: unconfirmedIssue })
      return false
    }
    this.retireReader()
    this.active = null
    this.completedTurnSeen = false
    this.publish({ issue: null, messages: [], busy: false, canStop: false, canResumePending: false, canDiscardPending: false,
      canResumeDocumentPending: false, canResumeObservation: false, conversationId: null, activeTurnId: null, setupCandidate: null })
    return true
  }

  detach() {
    this.retireReader()
    this.generation++
    this.active = null
    this.listeners.clear()
  }

  private finish(active: ActiveTurn, completed: boolean) {
    if (this.active !== active || active.generation !== this.generation) return
    active.terminal = true
    active.reader.abort()
    try { this.clearPendingCancel() } catch { this.storageFailed = true }
    this.updateTerminalAssistant(active, completed ? 'done' : 'interrupted')
    if (completed) this.completedTurnSeen = true
    this.active = null
    this.publish({ busy: false, canStop: false, ...this.pendingFlags(), ...this.documentPendingFlags(), canResumeObservation: false, activeTurnId: null,
      setupCandidate: null, issue: completed && !this.pending && !this.documentPending() && !this.storageFailed ? null : unconfirmedIssue })
    const owner = this.owner, locator = this.accepted
    const setup = completed && owner ? this.setupFrom(active.answer, owner, active.turnId, active.allowTitle) : null
    if (setup && owner && locator && locator.turnId === active.turnId && locator.conversationId === this.state.conversationId) {
      this.scheduleSetupObservation({ generation: active.generation, owner, locator, clientMessageId: active.clientMessageId,
        userText: active.userText, createdAt: active.createdAt, answerText: active.answer, lastSequence: active.cursor,
        allowTitle: active.allowTitle, setup })
    }
  }

  private interrupt(active: ActiveTurn) {
    if (!this.current(active)) return
    active.terminal = true
    active.reader.abort()
    this.updateTerminalAssistant(active, 'interrupted')
    this.active = null
    this.publish({ availability: 'error', busy: false, canStop: false, ...this.pendingFlags(), canResumeDocumentPending: false, canResumeObservation: true,
      activeTurnId: null, setupCandidate: null, issue: unconfirmedIssue })
  }

  private updateTerminalAssistant(active: ActiveTurn, status: 'done' | 'interrupted') {
    this.state = { ...this.state, messages: this.state.messages.map(message => message.id === active.assistantMessageId ? this.assistantMessage(active, status) : message) }
  }

  private protocolViolation(error: unknown) {
    return error instanceof ConsultationV13ProtocolError || error instanceof Error && [
      'CONSULTATION_EVENT_', 'CONSULTATION_TURN_', 'CONSULTATION_ANSWER_',
    ].some(prefix => error.message.startsWith(prefix))
  }

  private retireReader() { this.active?.reader.abort() }
}
