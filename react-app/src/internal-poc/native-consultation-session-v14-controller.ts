import type { ConsultationV14ClaimCommand } from './consultation-v14-adapter'
import { ConsultationV14Adapter, ConsultationV14HttpError } from './consultation-v14-adapter'

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type ConsultationSessionObservation = Readonly<{ sessionId: string; state: string; revision: string }>
export type ConsultationSessionOffer = Readonly<{
  anonymousSessionId: string
  anonymousIfMatch: string
  targetSessionId: string
  conversationId: string
}>
export type ConsultationSessionSnapshot = Readonly<{
  targetSessionId: string | null
  conversationId: string | null
  available: boolean
  busy: boolean
  issue: 'request-unconfirmed' | 'request-refused' | null
  canDiscard: boolean
}>
type Pending = Readonly<{
  version: 1
  offer: ConsultationSessionOffer
  idempotencyKey: string
  expectedRevision: string | null
  committedRevision: string | null
  disposition: 'uncertain' | 'refused'
}>
export type NativeConsultationSessionV14Options = Readonly<{
  currentSession: (signal?: AbortSignal) => Promise<ConsultationSessionObservation>
  refreshSession: (signal?: AbortSignal) => Promise<ConsultationSessionObservation>
  restoreConversation: (conversationId: string, targetSessionId: string) => Promise<boolean>
  storage?: StoragePort | null
  randomId?: () => string
  requestTimeoutMs?: number
}>
const KEY = 'tesia.native.consultation-v14.claim'
const storageKey = (target: string) => `${KEY}:${encodeURIComponent(target)}`
const ID = /^[A-Za-z0-9_-]{16,128}$/
const REVISION = /^[1-9][0-9]{0,19}$/
const ETAG = /^"[A-Za-z0-9_-]{16,128}"$/
const MAX_BYTES = 4_096
const REFUSED_CODES = new Set(['HANDOFF_INVALID', 'CLAIM_CONFLICT', 'NOT_FOUND', 'IDEMPOTENCY_KEY_REUSED',
  'BAD_REQUEST', 'FORBIDDEN', 'SESSION_REVISION_CONFLICT'])
const sameKeys = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === keys.sort().join(',')
function validOffer(value: ConsultationSessionOffer): boolean {
  return Boolean(value && sameKeys(value, ['anonymousSessionId', 'anonymousIfMatch', 'targetSessionId', 'conversationId'])
    && typeof value.anonymousSessionId === 'string' && ID.test(value.anonymousSessionId)
    && typeof value.targetSessionId === 'string' && ID.test(value.targetSessionId)
    && value.anonymousSessionId !== value.targetSessionId && typeof value.anonymousIfMatch === 'string' && ETAG.test(value.anonymousIfMatch)
    && typeof value.conversationId === 'string' && ID.test(value.conversationId))
}
function parsePending(raw: string): Pending {
  if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('CLAIM_STORAGE_INVALID')
  const value = JSON.parse(raw) as Pending
  if (!value || !(sameKeys(value, ['version', 'offer', 'idempotencyKey', 'expectedRevision', 'committedRevision'])
    || sameKeys(value, ['version', 'offer', 'idempotencyKey', 'expectedRevision', 'committedRevision', 'disposition']))
    || value.version !== 1 || !validOffer(value.offer) || typeof value.idempotencyKey !== 'string' || !ID.test(value.idempotencyKey)
    || !(value.expectedRevision === null || typeof value.expectedRevision === 'string' && REVISION.test(value.expectedRevision))
    || !(value.committedRevision === null || typeof value.committedRevision === 'string' && REVISION.test(value.committedRevision))
    || value.committedRevision !== null && (value.expectedRevision === null
      || BigInt(value.committedRevision) <= BigInt(value.expectedRevision))
    || !(value.disposition === undefined || value.disposition === 'uncertain' || value.disposition === 'refused')) throw new Error('CLAIM_STORAGE_INVALID')
  return { ...value, disposition: value.disposition ?? 'uncertain' }
}
function browserStorage(): StoragePort | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage }
  catch { return null }
}

/** Local records are retry locators only. Every adoption requires a fresh server AUTH observation. */
export class NativeConsultationSessionV14Controller {
  private readonly storage: StoragePort | null
  private readonly randomId: () => string
  private readonly requestTimeoutMs: number
  private target: string | null = null
  private generation = 0
  private pending: Pending | null = null
  private raw: string | null = null
  private inFlight = false
  private listeners = new Set<(value: ConsultationSessionSnapshot) => void>()
  private state: ConsultationSessionSnapshot = { targetSessionId: null, conversationId: null, available: false, busy: false, issue: null, canDiscard: false }
  private ports: Pick<NativeConsultationSessionV14Options, 'currentSession' | 'refreshSession' | 'restoreConversation'>
  constructor(private readonly adapter: ConsultationV14Adapter, options: NativeConsultationSessionV14Options) {
    this.ports = options
    this.storage = options.storage === undefined ? browserStorage() : options.storage
    this.randomId = options.randomId ?? (() => crypto.randomUUID())
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000
    if (!Number.isSafeInteger(this.requestTimeoutMs) || this.requestTimeoutMs < 1 || this.requestTimeoutMs > 330_000) throw new Error('CLAIM_TIMEOUT_INVALID')
  }
  getSnapshot = () => this.state
  setPorts(ports: Pick<NativeConsultationSessionV14Options, 'currentSession' | 'refreshSession' | 'restoreConversation'>) {
    if (this.inFlight) return false
    this.ports = ports
    return true
  }
  subscribe = (listener: (value: ConsultationSessionSnapshot) => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private publish(value: Partial<ConsultationSessionSnapshot>) {
    this.state = { ...this.state, ...value }
    this.listeners.forEach(listener => listener(this.state))
  }
  bindTarget(targetSessionId: string | null) {
    if (this.target === targetSessionId) return
    this.generation++
    this.target = targetSessionId
    this.pending = null
    this.raw = null
    if (targetSessionId === null) {
      this.publish({ targetSessionId, conversationId: null, available: false, busy: false, issue: null, canDiscard: false })
      return
    }
    let issue: ConsultationSessionSnapshot['issue'] = null
    try {
      if (!this.storage) throw new Error('CLAIM_STORAGE_UNAVAILABLE')
      const raw = targetSessionId === null ? null : this.storage.getItem(storageKey(targetSessionId))
      if (raw !== null) {
        this.raw = raw
        const value = parsePending(raw)
        if (value.offer.targetSessionId !== targetSessionId) throw new Error('CLAIM_STORAGE_INVALID')
        this.pending = value
        issue = value.disposition === 'refused' ? 'request-refused' : 'request-unconfirmed'
      }
    } catch { issue = this.raw === null ? 'request-unconfirmed' : 'request-refused' }
    this.publish({ targetSessionId, conversationId: this.pending?.offer.conversationId ?? null,
      available: this.pending !== null, busy: false, issue,
      canDiscard: this.raw !== null && (issue === 'request-refused' || this.pending?.committedRevision != null) })
  }
  offer(offer: ConsultationSessionOffer): void {
    if (!validOffer(offer)) throw new Error('CLAIM_OFFER_INVALID')
    this.adapter.validateClaim({ ...offer, targetExpectedRevision: '1', idempotencyKey: 'claim_offer_validation_01' })
    this.bindTarget(offer.targetSessionId)
    if (this.raw !== null && this.pending === null) throw new Error('CLAIM_STORAGE_INVALID')
    if (this.pending !== null) {
      if (JSON.stringify(this.pending.offer) !== JSON.stringify(offer)) throw new Error('CLAIM_STORAGE_CHANGED')
      this.persist(this.pending)
      return
    }
    const idempotencyKey = `consultation_claim_${this.randomId().replaceAll('-', '_')}`
    if (!ID.test(idempotencyKey)) throw new Error('CLAIM_KEY_INVALID')
    // Keep this exact record in memory even if readback fails; explicit retry
    // must not silently create another key after a partial storage write.
    this.pending = { version: 1, offer, idempotencyKey, expectedRevision: null, committedRevision: null, disposition: 'uncertain' }
    try { this.persist(this.pending) }
    catch { this.publish({ available: true, conversationId: offer.conversationId, issue: 'request-unconfirmed' }); throw new Error('CLAIM_STORAGE_UNAVAILABLE') }
    this.publish({ available: true, conversationId: offer.conversationId, issue: null, canDiscard: false })
  }
  private persist(value: Pending) {
    if (!this.storage) throw new Error('CLAIM_STORAGE_UNAVAILABLE')
    const raw = JSON.stringify(value)
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('CLAIM_STORAGE_INVALID')
    const key = storageKey(value.offer.targetSessionId)
    const existing = this.storage.getItem(key)
    if (existing !== null && existing !== this.raw && existing !== raw) throw new Error('CLAIM_STORAGE_CHANGED')
    this.pending = value
    this.storage.setItem(key, raw)
    if (this.storage.getItem(key) !== raw) throw new Error('CLAIM_STORAGE_UNAVAILABLE')
    this.pending = value
    this.raw = raw
  }
  markUnconfirmed() {
    if (!this.pending || this.pending.offer.targetSessionId !== this.target || this.inFlight) return false
    this.publish({ issue: this.pending.disposition === 'refused' ? 'request-refused' : 'request-unconfirmed' })
    return true
  }
  private requireCurrent(generation: number, target: string) {
    if (generation !== this.generation || this.target !== target) throw new Error('CLAIM_OWNER_CHANGED')
  }
  private requireAuth(value: ConsultationSessionObservation, target: string) {
    if (value.state !== 'AUTHENTICATED' || value.sessionId !== target
      || typeof value.revision !== 'string' || !REVISION.test(value.revision)) throw new Error('CLAIM_AUTH_CHANGED')
  }
  private async bounded<T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const control = new AbortController()
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = globalThis.setTimeout(() => {
        const reason = new DOMException('consultation session deadline', 'AbortError')
        control.abort(reason); reject(reason)
      }, this.requestTimeoutMs)
    })
    try { return await Promise.race([request(control.signal), deadline]) }
    finally { globalThis.clearTimeout(timer) }
  }
  discardPending(): boolean {
    if (this.inFlight || !this.target || !this.state.canDiscard || this.raw === null || !this.storage) return false
    try {
      const key = storageKey(this.target)
      if (this.storage.getItem(key) !== this.raw) throw new Error('CLAIM_STORAGE_CHANGED')
      this.storage.removeItem(key)
      if (this.storage.getItem(key) !== null) throw new Error('CLAIM_STORAGE_UNAVAILABLE')
      this.pending = null; this.raw = null
      this.publish({ available: false, conversationId: null, issue: null, canDiscard: false })
      return true
    } catch { return false }
  }
  async claim(): Promise<boolean> {
    if (this.inFlight || !this.pending || this.pending.disposition === 'refused' || this.pending.offer.targetSessionId !== this.target) return false
    const generation = this.generation, target = this.target!
    this.inFlight = true
    this.publish({ busy: true, issue: null })
    try {
      let pending = this.pending
      this.persist(pending)
      const current = await this.bounded(signal => this.ports.currentSession(signal))
      this.requireCurrent(generation, target); this.requireAuth(current, target)
      if (pending.expectedRevision === null) {
        pending = { ...pending, expectedRevision: current.revision }
        this.persist(pending)
      }
      if (pending.committedRevision === null) {
        const command: ConsultationV14ClaimCommand = {
          anonymousSessionId: pending.offer.anonymousSessionId, anonymousIfMatch: pending.offer.anonymousIfMatch,
          targetSessionId: target, targetExpectedRevision: pending.expectedRevision!, idempotencyKey: pending.idempotencyKey,
        }
        const committed = (await this.bounded(signal => this.adapter.claim(command, signal))).data
        this.requireCurrent(generation, target)
        if (committed.sessionId !== target || committed.anonymousSessionId !== pending.offer.anonymousSessionId
          || !REVISION.test(committed.revision) || BigInt(committed.revision) <= BigInt(pending.expectedRevision!)) throw new Error('CLAIM_BINDING_INVALID')
        // Retain acknowledgement in memory before a fallible durable write.
        this.pending = pending = { ...pending, committedRevision: committed.revision }
        this.persist(pending)
      }
      const confirmed = await this.bounded(signal => this.ports.refreshSession(signal))
      this.requireCurrent(generation, target); this.requireAuth(confirmed, target)
      if (BigInt(confirmed.revision) < BigInt(pending.committedRevision!)) throw new Error('CLAIM_REVISION_CHANGED')
      const restored = await this.ports.restoreConversation(pending.offer.conversationId, target)
      this.requireCurrent(generation, target)
      if (!restored) throw new Error('CLAIM_HISTORY_UNCONFIRMED')
      const key = storageKey(target)
      if (!this.storage || this.storage.getItem(key) !== this.raw) throw new Error('CLAIM_STORAGE_CHANGED')
      this.storage.removeItem(key)
      if (this.storage.getItem(key) !== null) throw new Error('CLAIM_STORAGE_UNAVAILABLE')
      this.pending = null; this.raw = null
      this.publish({ available: false, issue: null, canDiscard: false })
      return true
    } catch (error) {
      if (generation === this.generation) {
        const refused = error instanceof ConsultationV14HttpError && REFUSED_CODES.has(error.code)
        if (refused && this.pending) {
          this.pending = { ...this.pending, disposition: 'refused' }
          try { this.persist(this.pending) } catch { /* Preserve the raw CAS boundary for explicit local discard. */ }
        }
        this.publish({ available: this.pending !== null, issue: refused ? 'request-refused' : 'request-unconfirmed',
          canDiscard: this.raw !== null && (refused || this.pending?.committedRevision != null) })
      }
      return false
    } finally {
      this.inFlight = false
      if (generation === this.generation) this.publish({ busy: false })
    }
  }
  detach() { this.generation++; this.publish({ busy: false }) }
}
