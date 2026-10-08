import type { ClientServiceMessage } from './ClientServiceExperience'
import type { Event, History, TerminalState, Turn } from './contracts/generated/api-v0.13/dist/index.js'
import { ConsultationV13Adapter, ConsultationV13HttpError, ConsultationV13ProtocolError, ConsultationV13TransportError, consultationV13CanonicalEvent } from './consultation-v13-adapter'

export type ConsultationV13Availability = 'idle' | 'checking' | 'available' | 'unavailable' | 'error'
export type ConsultationV13Issue = 'unavailable' | 'request-unconfirmed' | null

export type ConsultationV13Snapshot = Readonly<{
  availability: ConsultationV13Availability
  issue: ConsultationV13Issue
  messages: readonly ClientServiceMessage[]
  busy: boolean
  canStop: boolean
  canResumePending: boolean
  canDiscardPending: boolean
  canResumeObservation: boolean
  conversationId: string | null
  activeTurnId: string | null
}>

type ActiveTurn = {
  generation: number
  turnId: string
  clientMessageId: string
  assistantMessageId: string
  cursor: number
  answer: string
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
}>

const terminal = new Set<TerminalState>(['COMPLETED', 'FAILED', 'CANCELLED', 'AMBIGUOUS'])
const waitDefault = (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds))
const unavailableIssue = 'unavailable' as const
const unconfirmedIssue = 'request-unconfirmed' as const
const MAX_PENDING_BYTES = 65_536
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

const pendingKey = (owner: string) => `tesia.native.consultation-v13.pending:${encodeURIComponent(owner)}`
const locatorKey = (owner: string) => `tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`
const cancelKey = (owner: string) => `tesia.native.consultation-v13.cancel:${encodeURIComponent(owner)}`

function id(prefix: string, randomId: () => string) {
  return `${prefix}_${randomId().replaceAll('-', '_')}`
}

function browserStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage }
  catch { return null }
}

export class NativeConsultationV13Controller {
  private readonly adapter: ConsultationV13Adapter
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
  private readonly createFlights = new Set<string>()
  private storageFailed = false
  private state: ConsultationV13Snapshot = {
    availability: 'idle', issue: null, messages: [], busy: false, canStop: false, canResumePending: false,
    canDiscardPending: false, canResumeObservation: false, conversationId: null, activeTurnId: null,
  }

  constructor(adapter: ConsultationV13Adapter, options: NativeConsultationV13ControllerOptions = {}) {
    this.adapter = adapter
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
    this.storageFailed = false
    this.readPending(owner)
    this.readAccepted(owner)
    this.readPendingCancel(owner)
    this.publish({ availability: 'idle', issue: this.pending || this.pendingCancel || this.storageFailed ? unconfirmedIssue : null, messages: [], busy: false, canStop: false,
      canResumePending: false, canDiscardPending: false, canResumeObservation: false, conversationId: null, activeTurnId: null })
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
    this.storageFailed = false
    this.publish({ availability: 'idle', issue: null, messages: [], busy: false, canStop: false, canResumePending: false,
      canDiscardPending: false, canResumeObservation: false, conversationId: null, activeTurnId: null })
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
    return {
      canResumePending: Boolean(this.pending?.disposition === 'uncertain' && !this.storageFailed),
      canDiscardPending: Boolean(this.pending?.disposition === 'refused' && !this.storageFailed),
    }
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

  async activate() {
    const generation = this.generation
    if (!this.owner || !['idle', 'error', 'unavailable'].includes(this.state.availability)) return
    this.publish({ availability: 'checking', issue: null, canResumePending: false, canDiscardPending: false, canResumeObservation: false })
    const deadline = this.deadline()
    try {
      const response = await this.adapter.capabilities(deadline.signal)
      if (generation !== this.generation || !this.owner) return
      if (!response.data.available) {
        this.publish({ availability: 'unavailable', issue: this.pending || this.pendingCancel || this.storageFailed ? unconfirmedIssue : unavailableIssue,
          canResumePending: false, canDiscardPending: false, canResumeObservation: true })
        return
      }
      if (this.accepted) {
        try { await this.restoreAccepted(generation, this.owner, this.accepted, deadline.signal) }
        catch (error) {
          if (generation === this.generation && this.pending?.disposition === 'uncertain' && !this.storageFailed) {
            this.publish({ availability: 'available', issue: unconfirmedIssue, ...this.pendingFlags(), canResumeObservation: false })
            return
          }
          throw error
        }
        return
      }
      this.publish({ availability: 'available', issue: this.pending || this.pendingCancel || this.storageFailed ? unconfirmedIssue : null,
        ...this.pendingFlags(), canResumeObservation: false })
    } catch {
      if (generation === this.generation) this.publish({ availability: 'error', issue: this.accepted || this.pending || this.pendingCancel || this.storageFailed ? unconfirmedIssue : unavailableIssue,
        canResumePending: false, canDiscardPending: false, canResumeObservation: true })
    } finally { deadline.dispose() }
  }

  async restoreConversation(conversationId: string): Promise<boolean> {
    if (!this.owner || !ID.test(conversationId)) return false
    this.retireReader()
    const generation = ++this.generation, owner = this.owner
    this.active = null
    const deadline = this.deadline()
    this.publish({ availability: 'checking', busy: false, canStop: false })
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
    const messages = history.turns.flatMap(item => this.turnMessages(item.turnId === turn.turnId ? turn : item, item.turnId === turn.turnId))
    if (terminal.has(turn.state as TerminalState)) {
      if (this.pendingCancel) this.clearPendingCancel()
      this.active = null
      this.publish({ availability: 'available', messages, conversationId: turn.conversationId, activeTurnId: null,
        busy: false, canStop: false, ...this.pendingFlags(), canResumeObservation: false,
        issue: turn.state === 'COMPLETED' && !this.pending && !this.storageFailed ? null : unconfirmedIssue })
      return
    }
    const active: ActiveTurn = {
      generation, turnId: turn.turnId, clientMessageId: turn.clientMessageId, assistantMessageId: `${turn.turnId}_reply`,
      cursor: turn.lastSequence, answer: turn.answerText, seen: new Map(), terminal: false, cancelling: false,
      reader: new AbortController(),
    }
    this.active = active
    this.publish({ availability: 'available', messages, conversationId: turn.conversationId, activeTurnId: turn.turnId,
      busy: true, canStop: true, canResumePending: false, canDiscardPending: false, canResumeObservation: false,
      issue: this.pendingCancel || this.pending || this.storageFailed ? unconfirmedIssue : null })
    void this.follow(active)
  }

  private turnMessages(turn: Turn, current: boolean): ClientServiceMessage[] {
    const assistantMessageId = `${turn.turnId}_reply`
    const status = current && !terminal.has(turn.state as TerminalState)
      ? 'streaming' : turn.state === 'COMPLETED' ? 'done' : 'interrupted'
    return [
      { id: turn.clientMessageId, role: 'user', text: turn.userText, delivery: 'answered' },
      { id: assistantMessageId, role: 'assistant', text: turn.answerText,
        responseBlocks: [{ id: `${assistantMessageId}_text`, kind: 'text', text: turn.answerText, status }] },
    ]
  }

  async send(text: string, displayText?: string): Promise<boolean> {
    if (this.state.availability !== 'available' || !this.owner || this.active || this.state.busy || this.creating || this.pendingCancel || this.storageFailed) return false
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
    this.publish({ busy: true, canStop: false, canResumePending: false, canDiscardPending: false, canResumeObservation: false, issue: null })
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
      answer: turn.answerText, seen: new Map(), terminal: terminal.has(turn.state as TerminalState), cancelling: false, reader: new AbortController(),
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
      busy: !active.terminal, canStop: !active.terminal, canResumePending: false, canDiscardPending: false, canResumeObservation: false,
    })
    if (this.storageFailed) this.publish({ issue: unconfirmedIssue })
    if (active.terminal) this.finish(active, turn.state === 'COMPLETED')
    else void this.follow(active)
    return true
  }

  private assistantMessage(active: ActiveTurn, status: 'streaming' | 'done' | 'interrupted'): ClientServiceMessage {
    return { id: active.assistantMessageId, role: 'assistant', text: active.answer,
      responseBlocks: [{ id: `${active.assistantMessageId}_text`, kind: 'text', text: active.answer, status }] }
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
    if (!this.pending || this.pending.disposition !== 'refused' || this.storageFailed || this.state.busy || this.creating) return false
    try { this.clearPending() }
    catch { this.storageFailed = true; this.publish({ issue: unconfirmedIssue, ...this.pendingFlags() }); return false }
    this.publish({ issue: null, ...this.pendingFlags() })
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
    if (this.state.busy || this.creating || this.pending || this.pendingCancel || this.storageFailed) return false
    try { this.clearAccepted() }
    catch {
      this.storageFailed = true
      this.publish({ issue: unconfirmedIssue })
      return false
    }
    this.retireReader()
    this.active = null
    this.publish({ issue: null, messages: [], busy: false, canStop: false, canResumePending: false, canDiscardPending: false,
      canResumeObservation: false, conversationId: null, activeTurnId: null })
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
    this.active = null
    this.publish({ busy: false, canStop: false, ...this.pendingFlags(), canResumeObservation: false, activeTurnId: null,
      issue: completed && !this.pending && !this.storageFailed ? null : unconfirmedIssue })
  }

  private interrupt(active: ActiveTurn) {
    if (!this.current(active)) return
    active.terminal = true
    active.reader.abort()
    this.updateTerminalAssistant(active, 'interrupted')
    this.active = null
    this.publish({ availability: 'error', busy: false, canStop: false, ...this.pendingFlags(), canResumeObservation: true,
      activeTurnId: null, issue: unconfirmedIssue })
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
