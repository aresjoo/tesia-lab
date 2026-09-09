import { ApiV03ResponseError } from './contracts/generated/api-v0.3/client.js'
import type {
  ApiCallResult,
  ConversationSnapshot,
  ErrorCode,
  OperationId,
} from './contracts/generated/api-v0.3/types.js'

export const SERVICE_V03_SOURCE = 'CONTRACT_V03_RECORDED_MOCK' as const

export type ServiceV03LocalErrorCode =
  | 'CLIENT_INPUT_REJECTED'
  | 'TRANSPORT_UNAVAILABLE'
  | 'RESOURCE_BINDING_INVALID'
  | 'RESOURCE_EXPIRED'
  | 'RESOURCE_REVISION_REGRESSION'
  | 'IDEMPOTENT_RESPONSE_MISMATCH'
  | 'IDEMPOTENCY_KEY_REUSED_LOCALLY'

export type ServiceV03SafeErrorCode =
  | ErrorCode
  | 'INVALID_API_V03_RESPONSE'
  | ServiceV03LocalErrorCode

export interface ServiceV03Authority {
  readonly conversationId: string
  readonly conversationStateRevision: string
  readonly conversationStateHash: string
  readonly etag: string
  readonly snapshot: ConversationSnapshot
}

export interface ServiceV03View {
  readonly source: typeof SERVICE_V03_SOURCE
  readonly mockOnly: true
  readonly sessionEpoch: number
  readonly requestEpoch: number
  readonly authority: ServiceV03Authority | null
  readonly lastError: ServiceV03SafeErrorCode | null
}

export interface ServiceV03RequestReservation {
  readonly sessionEpoch: number
  readonly requestEpoch: number
  readonly operationId: OperationId
  readonly targetResourceId: string | null
  readonly expectedConversationId: string | null
  readonly expectedRevision: string | null
  readonly expectedStateHash: string | null
  readonly expectedEtag: string | null
  readonly expectedDraftId: string | null
  readonly expectedDraftRevision: string | null
  readonly expectedProjectionHash: string | null
  readonly expectedSemanticHash: string | null
  readonly requestedValidationReceiptId: string | null
  readonly requestedApprovalChallengeId: string | null
  readonly requestedAcknowledgedSemanticHash: string | null
}

export interface ServiceV03RequestToken extends ServiceV03RequestReservation {
  readonly invocationSequence: number
  readonly requestDigest: string
  readonly idempotencyKeyDigest: string | null
  readonly exactRequestReplay: boolean
}

export interface ServiceV03RequestBinding {
  readonly expectedConversationStateRevision?: string
  readonly expectedConversationStateHash?: string
  readonly ifMatch?: string
  readonly validationReceiptId?: string
  readonly approvalChallengeId?: string
  readonly acknowledgedSemanticHash?: string
}

export type ServiceV03Settlement<T> =
  | { readonly status: 'APPLIED'; readonly value: T; readonly view: ServiceV03View }
  | { readonly status: 'DISCARDED'; readonly reason: 'STALE_SESSION_EPOCH' | 'STALE_REQUEST_EPOCH'; readonly view: ServiceV03View }
  | { readonly status: 'FAILED'; readonly code: ServiceV03SafeErrorCode; readonly view: ServiceV03View }

export type ServiceV03PreflightSettlement = Exclude<ServiceV03Settlement<never>, { readonly status: 'APPLIED' }>

interface ReplayRecord {
  readonly requestDigest: string
  readonly responseFingerprint: string
}

interface ValidationAuthority {
  readonly validationReceiptId: string
  readonly semanticHash: string
  readonly issuedAt: string
  readonly expiresAt: string
  readonly consumptionState: 'AVAILABLE' | 'RESERVED' | 'CONSUMED'
  readonly reservedRequestKey?: string
  readonly reservedRequestDigest?: string
}

interface ChallengeAuthority {
  readonly approvalChallengeId: string
  readonly validationReceiptId: string
  readonly semanticHash: string
  readonly issuedAt: string
  readonly expiresAt: string
  readonly consumptionState: 'AVAILABLE' | 'RESERVED' | 'CONSUMED'
  readonly reservedRequestKey?: string
  readonly reservedRequestDigest?: string
}

interface ApprovalReservation {
  readonly receipt: ValidationAuthority
  readonly challenge: ChallengeAuthority
  readonly requestKey: string
  readonly requestDigest: string
}

export interface ServiceV03InvocationTicket {
  readonly sessionEpoch: number
  readonly invocationSequence: number
}

const REVISION = /^(0|[1-9][0-9]{0,19})$/

interface EnvelopeLike {
  readonly meta: { readonly resourceRevision: string | null }
}

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value !== 'object') throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
  const record = value as Readonly<Record<string, unknown>>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

// This proves canonical equivalence after the generated client has detached and
// validated JSON. It deliberately does not claim equality of raw HTTP bytes.
const parsedResponseFingerprint = <T>(result: ApiCallResult<T>): string => canonicalJson([
  result.status,
  result.etag,
  result.body,
])

const referencedAuthority = (value: unknown): Readonly<{
  conversationId: string
  conversationStateRevision: string
  conversationStateHash: string
  draftId: string
  draftRevision: string
  projectionHash: string
}> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Readonly<Record<string, unknown>>
  const conversationId = record.conversationId ?? record.sourceConversationId
  const revision = record.conversationStateRevision ?? record.sourceConversationStateRevision
  const hash = record.conversationStateHash ?? record.sourceConversationStateHash
  const draftId = record.draftId ?? record.sourceDraftId
  const draftRevision = record.draftRevision ?? record.sourceDraftRevision
  const projectionHash = record.projectionHash ?? record.sourceProjectionHash
  if (
    typeof conversationId !== 'string'
    || typeof revision !== 'string'
    || typeof hash !== 'string'
    || typeof draftId !== 'string'
    || typeof draftRevision !== 'string'
    || typeof projectionHash !== 'string'
  ) return null
  return {
    conversationId,
    conversationStateRevision: revision,
    conversationStateHash: hash,
    draftId,
    draftRevision,
    projectionHash,
  }
}

const valueRecord = (value: unknown): Readonly<Record<string, unknown>> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
  }
  return value as Readonly<Record<string, unknown>>
}

export class ServiceV03StateBoundary {
  private sessionEpoch = 0
  private invocationSequence = 0
  private latestActivatedInvocationSequence = 0
  private requestEpoch = 0
  private authority: ServiceV03Authority | null = null
  private lastError: ServiceV03SafeErrorCode | null = null
  private readonly replayRecords = new Map<string, ReplayRecord>()
  private readonly requestRecords = new Map<string, string>()
  private readonly validationAuthorities = new Map<string, ValidationAuthority>()
  private readonly challengeAuthorities = new Map<string, ChallengeAuthority>()

  constructor(private readonly clock: () => number = Date.now) {}

  startSession(): ServiceV03View {
    this.sessionEpoch += 1
    this.latestActivatedInvocationSequence = 0
    this.requestEpoch = 0
    this.authority = null
    this.lastError = null
    this.replayRecords.clear()
    this.requestRecords.clear()
    this.validationAuthorities.clear()
    this.challengeAuthorities.clear()
    return this.view()
  }

  view(): ServiceV03View {
    return Object.freeze({
      source: SERVICE_V03_SOURCE,
      mockOnly: true,
      sessionEpoch: this.sessionEpoch,
      requestEpoch: this.requestEpoch,
      authority: this.authority,
      lastError: this.lastError,
    })
  }

  captureInvocation(): ServiceV03InvocationTicket {
    this.invocationSequence += 1
    return Object.freeze({
      sessionEpoch: this.sessionEpoch,
      invocationSequence: this.invocationSequence,
    })
  }

  activateRequest(
    invocationTicket: ServiceV03InvocationTicket,
    operationId: OperationId,
    targetResourceId: string | null,
    requestDigest: string,
    idempotencyKeyDigest: string | null,
    binding: ServiceV03RequestBinding = {},
  ): ServiceV03RequestToken {
    if (invocationTicket.sessionEpoch !== this.sessionEpoch) {
      return Object.freeze({
        ...this.reservation(invocationTicket.sessionEpoch, this.requestEpoch, operationId, targetResourceId, binding),
        invocationSequence: invocationTicket.invocationSequence,
        requestDigest,
        idempotencyKeyDigest,
        exactRequestReplay: false,
      })
    }
    if (invocationTicket.invocationSequence < this.latestActivatedInvocationSequence) {
      return Object.freeze({
        ...this.reservation(this.sessionEpoch, this.requestEpoch, operationId, targetResourceId, binding),
        invocationSequence: invocationTicket.invocationSequence,
        requestDigest,
        idempotencyKeyDigest,
        exactRequestReplay: false,
      })
    }
    this.assertPreTransportTarget(operationId, targetResourceId)
    this.assertRequestAuthority(operationId, targetResourceId, binding)
    const requestKey = idempotencyKeyDigest === null ? null : `${operationId}:${idempotencyKeyDigest}`
    const previous = requestKey === null ? undefined : this.requestRecords.get(requestKey)
    if (previous !== undefined && previous !== requestDigest) {
      throw new ServiceV03BoundaryError('IDEMPOTENCY_KEY_REUSED_LOCALLY')
    }
    const exactRequestReplay = previous === requestDigest
    const approvalReservation = this.assertApprovalPreconditions(
      operationId,
      binding,
      requestKey,
      requestDigest,
      exactRequestReplay,
    )
    this.requestEpoch += 1
    this.latestActivatedInvocationSequence = invocationTicket.invocationSequence
    if (requestKey !== null && previous === undefined) this.requestRecords.set(requestKey, requestDigest)
    if (approvalReservation !== null) this.reserveApproval(approvalReservation)
    return Object.freeze({
      ...this.reservation(this.sessionEpoch, this.requestEpoch, operationId, targetResourceId, binding),
      invocationSequence: invocationTicket.invocationSequence,
      requestDigest,
      idempotencyKeyDigest,
      exactRequestReplay,
    })
  }

  preflight(token: ServiceV03RequestToken): ServiceV03PreflightSettlement | null {
    return this.stale(token)
  }

  private reservation(
    sessionEpoch: number,
    requestEpoch: number,
    operationId: OperationId,
    targetResourceId: string | null,
    binding: ServiceV03RequestBinding,
  ): ServiceV03RequestReservation {
    return Object.freeze({
      sessionEpoch,
      requestEpoch,
      operationId,
      targetResourceId,
      expectedConversationId: this.authority?.conversationId ?? null,
      expectedRevision: this.authority?.conversationStateRevision ?? null,
      expectedStateHash: this.authority?.conversationStateHash ?? null,
      expectedEtag: this.authority?.etag ?? null,
      expectedDraftId: this.authority?.snapshot.draftId ?? null,
      expectedDraftRevision: this.authority?.snapshot.draftRevision ?? null,
      expectedProjectionHash: this.authority?.snapshot.projectionHash ?? null,
      expectedSemanticHash: this.authority?.snapshot.semanticHash ?? null,
      requestedValidationReceiptId: binding.validationReceiptId ?? null,
      requestedApprovalChallengeId: binding.approvalChallengeId ?? null,
      requestedAcknowledgedSemanticHash: binding.acknowledgedSemanticHash ?? null,
    })
  }

  assertPreTransportTarget(operationId: OperationId, targetResourceId: string | null): void {
    if (operationId === 'createConversationV3') {
      if (this.authority !== null) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      return
    }
    if (this.authority === null) return
    if (
      (operationId === 'getConversationV3' && targetResourceId !== this.authority.conversationId)
      || (operationId === 'getStrategyDraftV3' && targetResourceId !== this.authority.snapshot.draftId)
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
  }

  private assertRequestAuthority(
    operationId: OperationId,
    targetResourceId: string | null,
    binding: ServiceV03RequestBinding,
  ): void {
    if (binding.expectedConversationStateRevision === undefined) return
    const expectedTarget = operationId === 'createConversationTurnV3'
      ? this.authority?.conversationId
      : this.authority?.snapshot.draftId
    if (
      this.authority === null
      || targetResourceId !== expectedTarget
      || binding.expectedConversationStateRevision !== this.authority.conversationStateRevision
      || binding.expectedConversationStateHash !== this.authority.conversationStateHash
      || binding.ifMatch !== this.authority.etag
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
  }

  private assertApprovalPreconditions(
    operationId: OperationId,
    binding: ServiceV03RequestBinding,
    requestKey: string | null,
    requestDigest: string,
    exactRequestReplay: boolean,
  ): ApprovalReservation | null {
    if (operationId !== 'createApprovalChallengeV3' && operationId !== 'approveStrategyDraftV3') return null
    if (
      this.authority === null
      || this.authority.snapshot.semanticHash === null
      || binding.acknowledgedSemanticHash !== this.authority.snapshot.semanticHash
      || binding.validationReceiptId === undefined
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    const receipt = this.validationAuthorities.get(binding.validationReceiptId)
    if (receipt === undefined || receipt.semanticHash !== binding.acknowledgedSemanticHash) {
      throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    }
    if (operationId === 'createApprovalChallengeV3') {
      this.assertUnexpired(receipt.expiresAt)
      if (receipt.consumptionState !== 'AVAILABLE') throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      return null
    }
    if (binding.approvalChallengeId === undefined) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    const challenge = this.challengeAuthorities.get(binding.approvalChallengeId)
    if (
      challenge === undefined
      || challenge.validationReceiptId !== receipt.validationReceiptId
      || challenge.semanticHash !== receipt.semanticHash
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    const successfulReplay = exactRequestReplay
      && requestKey !== null
      && this.replayRecords.get(requestKey)?.requestDigest === requestDigest
    if (
      successfulReplay
      && receipt.consumptionState === 'CONSUMED'
      && challenge.consumptionState === 'CONSUMED'
    ) return null
    const matchingReservation = exactRequestReplay
      && requestKey !== null
      && receipt.consumptionState === 'RESERVED'
      && challenge.consumptionState === 'RESERVED'
      && receipt.reservedRequestKey === requestKey
      && challenge.reservedRequestKey === requestKey
      && receipt.reservedRequestDigest === requestDigest
      && challenge.reservedRequestDigest === requestDigest
    if (matchingReservation) return null
    if (
      receipt.consumptionState !== 'AVAILABLE'
      || challenge.consumptionState !== 'AVAILABLE'
      || requestKey === null
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    this.assertUnexpired(receipt.expiresAt)
    this.assertUnexpired(challenge.expiresAt)
    return { receipt, challenge, requestKey, requestDigest }
  }

  private reserveApproval(reservation: ApprovalReservation): void {
    this.validationAuthorities.set(reservation.receipt.validationReceiptId, Object.freeze({
      ...reservation.receipt,
      consumptionState: 'RESERVED',
      reservedRequestKey: reservation.requestKey,
      reservedRequestDigest: reservation.requestDigest,
    }))
    this.challengeAuthorities.set(reservation.challenge.approvalChallengeId, Object.freeze({
      ...reservation.challenge,
      consumptionState: 'RESERVED',
      reservedRequestKey: reservation.requestKey,
      reservedRequestDigest: reservation.requestDigest,
    }))
  }

  rejectPreTransport<T>(error: unknown): ServiceV03Settlement<T> {
    return this.failCurrent(error)
  }

  expectedState(): Readonly<{
    conversationId: string
    draftId: string
    draftRevision: string
    projectionHash: string
    semanticHash: string | null
    conversationStateRevision: string
    conversationStateHash: string
    etag: string
  }> {
    if (this.authority === null) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    return {
      conversationId: this.authority.conversationId,
      draftId: this.authority.snapshot.draftId,
      draftRevision: this.authority.snapshot.draftRevision,
      projectionHash: this.authority.snapshot.projectionHash,
      semanticHash: this.authority.snapshot.semanticHash,
      conversationStateRevision: this.authority.conversationStateRevision,
      conversationStateHash: this.authority.conversationStateHash,
      etag: this.authority.etag,
    }
  }

  settleSnapshot<T extends EnvelopeLike>(
    token: ServiceV03RequestToken,
    result: ApiCallResult<T>,
    snapshot: ConversationSnapshot,
  ): ServiceV03Settlement<T> {
    const stale = this.stale(token)
    if (stale !== null) return stale
    try {
      if (result.body.meta.resourceRevision !== snapshot.conversationStateRevision) {
        throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      }
      if (token.expectedConversationId !== null && token.expectedConversationId !== snapshot.conversationId) {
        throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      }
      if (
        token.targetResourceId !== null
        && (
          (token.operationId === 'getConversationV3' || token.operationId === 'createConversationTurnV3')
            ? snapshot.conversationId !== token.targetResourceId
            : snapshot.draftId !== token.targetResourceId
        )
      ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      this.assertCurrentTokenAuthority(token)
      this.assertMonotonicSnapshot(snapshot, result.etag)
      this.assertReplay(token, parsedResponseFingerprint(result))
      if (
        this.authority !== null
        && (
          snapshot.conversationStateRevision !== this.authority.conversationStateRevision
          || snapshot.conversationStateHash !== this.authority.conversationStateHash
        )
      ) this.clearApprovalAuthorities()
      this.authority = Object.freeze({
        conversationId: snapshot.conversationId,
        conversationStateRevision: snapshot.conversationStateRevision,
        conversationStateHash: snapshot.conversationStateHash,
        etag: result.etag,
        snapshot,
      })
      this.lastError = null
      return { status: 'APPLIED', value: result.body, view: this.view() }
    } catch (error) {
      return this.failCurrent(error)
    }
  }

  settleBoundValue<T extends EnvelopeLike>(
    token: ServiceV03RequestToken,
    result: ApiCallResult<T>,
    value: unknown,
  ): ServiceV03Settlement<T> {
    const stale = this.stale(token)
    if (stale !== null) return stale
    try {
      this.assertCurrentTokenAuthority(token)
      const reference = referencedAuthority(value)
      if (
        reference === null
        || result.body.meta.resourceRevision !== reference.conversationStateRevision
        || reference.conversationId !== token.expectedConversationId
        || reference.conversationStateRevision !== token.expectedRevision
        || reference.conversationStateHash !== token.expectedStateHash
        || reference.draftId !== token.expectedDraftId
        || reference.draftRevision !== token.expectedDraftRevision
        || reference.projectionHash !== token.expectedProjectionHash
        || result.etag !== token.expectedEtag
      ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      this.assertOperationBinding(token, value)
      this.assertReplay(token, parsedResponseFingerprint(result))
      this.recordOperationAuthority(token, value)
      this.lastError = null
      return { status: 'APPLIED', value: result.body, view: this.view() }
    } catch (error) {
      return this.failCurrent(error)
    }
  }

  settleError<T>(token: ServiceV03RequestToken, error: unknown): ServiceV03Settlement<T> {
    const stale = this.stale(token)
    if (stale !== null) return stale
    return this.failCurrent(error)
  }

  private stale(token: ServiceV03RequestToken): Extract<ServiceV03PreflightSettlement, { readonly status: 'DISCARDED' }> | null {
    if (token.sessionEpoch !== this.sessionEpoch) {
      return { status: 'DISCARDED', reason: 'STALE_SESSION_EPOCH', view: this.view() }
    }
    if (token.invocationSequence < this.latestActivatedInvocationSequence) {
      return { status: 'DISCARDED', reason: 'STALE_REQUEST_EPOCH', view: this.view() }
    }
    if (token.requestEpoch !== this.requestEpoch) {
      return { status: 'DISCARDED', reason: 'STALE_REQUEST_EPOCH', view: this.view() }
    }
    return null
  }

  private assertCurrentTokenAuthority(token: ServiceV03RequestToken): void {
    if (token.expectedConversationId === null) return
    if (
      this.authority === null
      || this.authority.conversationId !== token.expectedConversationId
      || this.authority.conversationStateRevision !== token.expectedRevision
      || this.authority.conversationStateHash !== token.expectedStateHash
      || this.authority.etag !== token.expectedEtag
      || this.authority.snapshot.draftId !== token.expectedDraftId
      || this.authority.snapshot.draftRevision !== token.expectedDraftRevision
      || this.authority.snapshot.projectionHash !== token.expectedProjectionHash
      || this.authority.snapshot.semanticHash !== token.expectedSemanticHash
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
  }

  private assertMonotonicSnapshot(snapshot: ConversationSnapshot, etag: string): void {
    if (!REVISION.test(snapshot.conversationStateRevision)) {
      throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    }
    if (this.authority === null) return
    const current = BigInt(this.authority.conversationStateRevision)
    const next = BigInt(snapshot.conversationStateRevision)
    if (next < current) throw new ServiceV03BoundaryError('RESOURCE_REVISION_REGRESSION')
    if (next === current && snapshot.conversationStateHash !== this.authority.conversationStateHash) {
      throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    }
    if (
      next === current
      && (
        etag !== this.authority.etag
        || snapshot.draftId !== this.authority.snapshot.draftId
        || snapshot.draftRevision !== this.authority.snapshot.draftRevision
        || snapshot.projectionHash !== this.authority.snapshot.projectionHash
        || snapshot.semanticHash !== this.authority.snapshot.semanticHash
        || canonicalJson(snapshot) !== canonicalJson(this.authority.snapshot)
      )
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
  }

  private assertOperationBinding(token: ServiceV03RequestToken, value: unknown): void {
    const record = valueRecord(value)
    if (token.operationId === 'validateStrategyDraftV3') {
      if (
        record.status === 'VALID'
        && (
          token.expectedSemanticHash === null
          || record.semanticHash !== token.expectedSemanticHash
        )
      ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      if (record.status === 'VALID') this.assertUnexpired(record.expiresAt)
      return
    }
    if (token.operationId === 'createApprovalChallengeV3') {
      if (
        token.expectedSemanticHash === null
        || record.semanticHash !== token.expectedSemanticHash
        || record.semanticHash !== token.requestedAcknowledgedSemanticHash
        || record.validationReceiptId !== token.requestedValidationReceiptId
        || record.consumptionState !== 'AVAILABLE'
      ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      this.assertUnexpired(record.expiresAt)
      return
    }
    if (token.operationId === 'approveStrategyDraftV3') {
      if (
        token.expectedSemanticHash === null
        || record.semanticHash !== token.expectedSemanticHash
        || record.semanticHash !== token.requestedAcknowledgedSemanticHash
        || record.validationReceiptId !== token.requestedValidationReceiptId
        || record.approvalChallengeId !== token.requestedApprovalChallengeId
      ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      return
    }
    throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
  }

  private assertReplay(token: ServiceV03RequestToken, fingerprint: string): void {
    if (token.idempotencyKeyDigest === null) return
    const replayKey = `${token.operationId}:${token.idempotencyKeyDigest}`
    const previous = this.replayRecords.get(replayKey)
    if (previous !== undefined) {
      if (previous.requestDigest !== token.requestDigest) {
        throw new ServiceV03BoundaryError('IDEMPOTENCY_KEY_REUSED_LOCALLY')
      }
      if (previous.responseFingerprint !== fingerprint) {
        throw new ServiceV03BoundaryError('IDEMPOTENT_RESPONSE_MISMATCH')
      }
      return
    }
    this.replayRecords.set(replayKey, {
      requestDigest: token.requestDigest,
      responseFingerprint: fingerprint,
    })
  }

  private recordOperationAuthority(token: ServiceV03RequestToken, value: unknown): void {
    const record = valueRecord(value)
    if (token.operationId === 'validateStrategyDraftV3') {
      if (record.status !== 'VALID') {
        this.clearApprovalAuthorities()
        return
      }
      const authority: ValidationAuthority = Object.freeze({
        validationReceiptId: String(record.validationReceiptId),
        semanticHash: String(record.semanticHash),
        issuedAt: String(record.issuedAt),
        expiresAt: String(record.expiresAt),
        consumptionState: 'AVAILABLE',
      })
      this.validationAuthorities.set(authority.validationReceiptId, authority)
      return
    }
    if (token.operationId === 'createApprovalChallengeV3') {
      const authority: ChallengeAuthority = Object.freeze({
        approvalChallengeId: String(record.approvalChallengeId),
        validationReceiptId: String(record.validationReceiptId),
        semanticHash: String(record.semanticHash),
        issuedAt: String(record.issuedAt),
        expiresAt: String(record.expiresAt),
        consumptionState: 'AVAILABLE',
      })
      this.challengeAuthorities.set(authority.approvalChallengeId, authority)
      return
    }
    if (token.operationId === 'approveStrategyDraftV3') {
      const receiptId = String(record.validationReceiptId)
      const challengeId = String(record.approvalChallengeId)
      const receipt = this.validationAuthorities.get(receiptId)
      const challenge = this.challengeAuthorities.get(challengeId)
      if (receipt === undefined || challenge === undefined) {
        throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
      }
      this.validationAuthorities.set(receiptId, Object.freeze({ ...receipt, consumptionState: 'CONSUMED' }))
      this.challengeAuthorities.set(challengeId, Object.freeze({ ...challenge, consumptionState: 'CONSUMED' }))
    }
  }

  private clearApprovalAuthorities(): void {
    this.validationAuthorities.clear()
    this.challengeAuthorities.clear()
  }

  private assertUnexpired(expiresAt: unknown): void {
    if (typeof expiresAt !== 'string') throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    const expiry = Date.parse(expiresAt)
    const now = this.clock()
    if (!Number.isFinite(expiry) || !Number.isFinite(now)) {
      throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    }
    if (now >= expiry) throw new ServiceV03BoundaryError('RESOURCE_EXPIRED')
  }

  private failCurrent(error: unknown): Extract<ServiceV03PreflightSettlement, { readonly status: 'FAILED' }> {
    const code = safeErrorCode(error)
    this.lastError = code
    return { status: 'FAILED', code, view: this.view() }
  }
}

export class ServiceV03BoundaryError extends Error {
  constructor(readonly code: ServiceV03LocalErrorCode) {
    super(code)
  }
}

const safeErrorCode = (error: unknown): ServiceV03SafeErrorCode => {
  if (error instanceof ServiceV03BoundaryError) return error.code
  if (error instanceof ApiV03ResponseError) return error.code
  if (error instanceof Error && error.message.startsWith('INVALID_')) return 'CLIENT_INPUT_REJECTED'
  return 'TRANSPORT_UNAVAILABLE'
}
