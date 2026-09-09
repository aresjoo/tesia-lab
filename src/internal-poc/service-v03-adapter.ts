import { TesiaConversationV03Client } from './contracts/generated/api-v0.3/client.js'
import { createServiceConversationV03Port } from './contracts/generated/api-v0.3/sdk.js'
import type {
  ApiV03Transport,
  ApprovalChallengeRequest,
  ConversationTurnRequest,
  DraftPatchRequest,
  MutationContext,
  OperationId,
  StrategyApprovalRequest,
  ValidateDraftRequest,
} from './contracts/generated/api-v0.3/types.js'
import {
  ServiceV03BoundaryError,
  ServiceV03StateBoundary,
  type ServiceV03InvocationTicket,
  type ServiceV03RequestToken,
  type ServiceV03RequestBinding,
  type ServiceV03Settlement,
  type ServiceV03View,
} from './service-v03-state'

type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }
type ServiceV03Digest = (value: string) => Promise<string>
const GENERATED_PREFLIGHT_COMPLETE = Object.freeze({ kind: 'GENERATED_PREFLIGHT_COMPLETE' })

const immutableSnapshot = <T>(value: T): T => {
  const active = new WeakSet<object>()
  let nodes = 0
  const normalize = (item: unknown, inArray: boolean, depth: number): JsonValue | undefined => {
    nodes += 1
    if (nodes > 50_000 || depth > 64) throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
    if (item === null || typeof item === 'boolean') return item
    if (typeof item === 'string') {
      if (item.length > 1_000_000) throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
      return item
    }
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
      return item
    }
    if (item === undefined) {
      if (inArray) return null
      return undefined
    }
    if (typeof item !== 'object') throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
    if (active.has(item)) throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
    active.add(item)
    try {
      const prototype = Object.getPrototypeOf(item)
      const descriptors = Object.getOwnPropertyDescriptors(item)
      const keys = Reflect.ownKeys(item)
      if (Array.isArray(item)) {
        if (prototype !== Array.prototype || item.length > 4096) {
          throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
        }
        if (keys.some((key) => typeof key !== 'string' || (key !== 'length' && !/^(0|[1-9][0-9]*)$/.test(key)))) {
          throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
        }
        const output: JsonValue[] = []
        for (let index = 0; index < item.length; index += 1) {
          const descriptor = descriptors[String(index)]
          if (descriptor === undefined) {
            output.push(null)
            continue
          }
          if (!('value' in descriptor) || !descriptor.enumerable) {
            throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
          }
          output.push(normalize(descriptor.value, true, depth + 1) ?? null)
        }
        return Object.freeze(output)
      }
      if (prototype !== Object.prototype && prototype !== null) {
        throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
      }
      if (keys.length > 256 || keys.some((key) => typeof key !== 'string')) {
        throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
      }
      const output = Object.create(null) as Record<string, JsonValue>
      for (const key of keys as string[]) {
        const descriptor = descriptors[key]
        if (descriptor === undefined || !('value' in descriptor) || !descriptor.enumerable) {
          throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
        }
        const normalized = normalize(descriptor.value, false, depth + 1)
        if (normalized !== undefined) {
          Object.defineProperty(output, key, {
            value: normalized,
            enumerable: true,
            writable: false,
            configurable: false,
          })
        }
      }
      return Object.freeze(output)
    } finally {
      active.delete(item)
    }
  }
  const normalized = normalize(value, false, 0)
  if (normalized === undefined) throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
  return normalized as T
}

const canonicalJson = (value: JsonValue): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
    return String(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Readonly<Record<string, JsonValue>>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key]!)}`).join(',')}}`
}

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const requestDigest = (digest: ServiceV03Digest, operationId: OperationId, target: string | null, body: unknown, ifMatch: string | null): Promise<string> => digest(
  `tesia.web.service-v03.request.v1\0${canonicalJson({ operationId, target, body, ifMatch } as JsonValue)}`,
)

const idempotencyDigest = (digest: ServiceV03Digest, context?: MutationContext): Promise<string | null> => context === undefined
  ? Promise.resolve(null)
  : digest(`tesia.web.service-v03.idempotency.v1\0${context.idempotencyKey}`)

export class ServiceV03Adapter {
  private readonly port
  private readonly preflightPort
  readonly state: ServiceV03StateBoundary

  constructor(
    transport: ApiV03Transport,
    clock: () => number = Date.now,
    private readonly digest: ServiceV03Digest = sha256,
  ) {
    this.port = createServiceConversationV03Port(new TesiaConversationV03Client(transport))
    this.preflightPort = createServiceConversationV03Port(new TesiaConversationV03Client({
      async request() {
        throw GENERATED_PREFLIGHT_COMPLETE
      },
    }))
    this.state = new ServiceV03StateBoundary(clock)
    this.state.startSession()
  }

  startSession(): ServiceV03View {
    return this.state.startSession()
  }

  view(): ServiceV03View {
    return this.state.view()
  }

  async createConversation(context: MutationContext) {
    let token: ServiceV03RequestToken | null = null
    try {
      this.state.assertPreTransportTarget('createConversationV3', null)
      const input = immutableSnapshot({ body: {}, context })
      token = await this.begin(
        'createConversationV3',
        null,
        input.body,
        input.context,
        () => this.preflightPort.createConversation(input.context),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.createConversation(input.context)
      return this.state.settleSnapshot(token, result, result.body.data)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  async getConversation(conversationId: string) {
    let token: ServiceV03RequestToken | null = null
    try {
      this.state.assertPreTransportTarget('getConversationV3', conversationId)
      token = await this.begin(
        'getConversationV3',
        conversationId,
        null,
        undefined,
        () => this.preflightPort.getConversation(conversationId),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.getConversation(conversationId)
      return this.state.settleSnapshot(token, result, result.body.data)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  async createTurn(conversationId: string, body: ConversationTurnRequest, context: MutationContext) {
    let token: ServiceV03RequestToken | null = null
    try {
      const input = immutableSnapshot({ body, context })
      token = await this.beginBound(
        'createConversationTurnV3',
        conversationId,
        input.body,
        input.context,
        () => this.preflightPort.createTurn(conversationId, input.body, input.context),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.createTurn(conversationId, input.body, input.context)
      return this.state.settleSnapshot(token, result, result.body.data.conversation)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  async getDraft(draftId: string) {
    let token: ServiceV03RequestToken | null = null
    try {
      this.state.assertPreTransportTarget('getStrategyDraftV3', draftId)
      token = await this.begin(
        'getStrategyDraftV3',
        draftId,
        null,
        undefined,
        () => this.preflightPort.getDraft(draftId),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.getDraft(draftId)
      return this.state.settleSnapshot(token, result, result.body.data)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  async patchDraft(draftId: string, body: DraftPatchRequest, context: MutationContext) {
    let token: ServiceV03RequestToken | null = null
    try {
      const input = immutableSnapshot({ body, context })
      token = await this.beginBound(
        'patchStrategyDraftV3',
        draftId,
        input.body,
        input.context,
        () => this.preflightPort.patchDraft(draftId, input.body, input.context),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.patchDraft(draftId, input.body, input.context)
      return this.state.settleSnapshot(token, result, result.body.data)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  async validateDraft(draftId: string, body: ValidateDraftRequest, context: MutationContext) {
    let token: ServiceV03RequestToken | null = null
    try {
      const input = immutableSnapshot({ body, context })
      token = await this.beginBound(
        'validateStrategyDraftV3',
        draftId,
        input.body,
        input.context,
        () => this.preflightPort.validateDraft(draftId, input.body, input.context),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.validateDraft(draftId, input.body, input.context)
      return this.state.settleBoundValue(token, result, result.body.data)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  async createApprovalChallenge(draftId: string, body: ApprovalChallengeRequest, context: MutationContext) {
    let token: ServiceV03RequestToken | null = null
    try {
      const input = immutableSnapshot({ body, context })
      token = await this.beginBound(
        'createApprovalChallengeV3',
        draftId,
        input.body,
        input.context,
        () => this.preflightPort.createApprovalChallenge(draftId, input.body, input.context),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.createApprovalChallenge(draftId, input.body, input.context)
      return this.state.settleBoundValue(token, result, result.body.data)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  async approveDraft(draftId: string, body: StrategyApprovalRequest, context: MutationContext) {
    let token: ServiceV03RequestToken | null = null
    try {
      const input = immutableSnapshot({ body, context })
      token = await this.beginBound(
        'approveStrategyDraftV3',
        draftId,
        input.body,
        input.context,
        () => this.preflightPort.approveDraft(draftId, input.body, input.context),
      )
      const stale = this.state.preflight(token)
      if (stale !== null) return stale
      const result = await this.port.approveDraft(draftId, input.body, input.context)
      return this.state.settleBoundValue(token, result, result.body.data)
    } catch (error) {
      return this.reject(token, error)
    }
  }

  private async begin(
    operationId: OperationId,
    target: string | null,
    body: unknown,
    context: MutationContext | undefined,
    generatedPreflight: () => Promise<unknown>,
    binding: ServiceV03RequestBinding = {},
  ): Promise<ServiceV03RequestToken> {
    const invocationTicket = this.state.captureInvocation()
    return this.prepareInvocation(
      invocationTicket,
      operationId,
      target,
      body,
      context,
      generatedPreflight,
      binding,
    )
  }

  private async prepareInvocation(
    invocationTicket: ServiceV03InvocationTicket,
    operationId: OperationId,
    target: string | null,
    body: unknown,
    context: MutationContext | undefined,
    generatedPreflight: () => Promise<unknown>,
    binding: ServiceV03RequestBinding,
  ): Promise<ServiceV03RequestToken> {
    try {
      await generatedPreflight()
      throw new ServiceV03BoundaryError('CLIENT_INPUT_REJECTED')
    } catch (error) {
      if (error !== GENERATED_PREFLIGHT_COMPLETE) throw error
    }
    const [request, idempotency] = await Promise.all([
      requestDigest(this.digest, operationId, target, body, context?.ifMatch ?? null),
      idempotencyDigest(this.digest, context),
    ])
    return this.state.activateRequest(invocationTicket, operationId, target, request, idempotency, binding)
  }

  private reject<T>(token: ServiceV03RequestToken | null, error: unknown): ServiceV03Settlement<T> {
    return token === null
      ? this.state.rejectPreTransport(error)
      : this.state.settleError(token, error)
  }

  private async beginBound(
    operationId: OperationId,
    target: string,
    body: Readonly<{ expectedConversationStateRevision: string; expectedConversationStateHash: string }>,
    context: MutationContext,
    generatedPreflight: () => Promise<unknown>,
  ): Promise<ServiceV03RequestToken> {
    const invocationTicket = this.state.captureInvocation()
    const expected = this.state.expectedState()
    const expectedTarget = operationId === 'createConversationTurnV3'
      ? expected.conversationId
      : expected.draftId
    if (
      target !== expectedTarget
      || body.expectedConversationStateRevision !== expected.conversationStateRevision
      || body.expectedConversationStateHash !== expected.conversationStateHash
      || context.ifMatch !== expected.etag
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    const authorityBinding: ServiceV03RequestBinding = {
      expectedConversationStateRevision: body.expectedConversationStateRevision,
      expectedConversationStateHash: body.expectedConversationStateHash,
      ifMatch: context.ifMatch,
    }
    const binding: ServiceV03RequestBinding = operationId === 'createApprovalChallengeV3'
      ? {
          ...authorityBinding,
          validationReceiptId: (body as ApprovalChallengeRequest).validationReceiptId,
          acknowledgedSemanticHash: (body as ApprovalChallengeRequest).acknowledgedSemanticHash,
        }
      : operationId === 'approveStrategyDraftV3'
        ? {
            ...authorityBinding,
            validationReceiptId: (body as StrategyApprovalRequest).validationReceiptId,
            approvalChallengeId: (body as StrategyApprovalRequest).approvalChallengeId,
            acknowledgedSemanticHash: (body as StrategyApprovalRequest).acknowledgedSemanticHash,
          }
        : authorityBinding
    if (
      (operationId === 'createApprovalChallengeV3' || operationId === 'approveStrategyDraftV3')
      && (
        expected.semanticHash === null
        || binding.acknowledgedSemanticHash !== expected.semanticHash
      )
    ) throw new ServiceV03BoundaryError('RESOURCE_BINDING_INVALID')
    return this.prepareInvocation(
      invocationTicket,
      operationId,
      target,
      body,
      context,
      generatedPreflight,
      binding,
    )
  }
}

export const createServiceV03Adapter = (
  transport: ApiV03Transport,
  clock?: () => number,
  digest?: ServiceV03Digest,
): ServiceV03Adapter => new ServiceV03Adapter(transport, clock, digest)

export type ServiceV03OperationResult<T> = ServiceV03Settlement<T>
