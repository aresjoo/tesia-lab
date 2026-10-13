import {
  ApiV22Error,
  TesiaResearchStrategyProposalV22Client,
  snapshotApiV22,
  validateApiV22,
  type ApiV22TransportInput,
  type ApplyOptions,
  type ApplyRequest,
  type CreateRequest,
  type ListQuery,
  type MutationOptions,
  type ReadOptions,
  type ResearchStrategyProposalV22Transport,
} from './contracts/generated/api-v0.22/index.js'

const MAX_REQUEST_BYTES = 65_536
const MAX_RESPONSE_BYTES = 262_144
const MAX_REPORT_BYTES = 65_536
const MAX_TARGET_BYTES = 2_048
const BASE_PATH = '/api/v22/consultation/research-strategy-proposals'
const ID_PATH = '[A-Za-z0-9_-]{16,128}'
const READ_PATH = new RegExp(`^${BASE_PATH}/${ID_PATH}$(?![\\s\\S])`)
const APPLIED_READ_PATH = new RegExp(`^${BASE_PATH}/${ID_PATH}/applied-draft$(?![\\s\\S])`)
const COMPANION_READ_PATH = new RegExp(`^${BASE_PATH}/${ID_PATH}/approval-companions/approval_challenge_[A-Za-z0-9_-]{8,80}$(?![\\s\\S])`)
const APPLY_PATH = new RegExp(`^${BASE_PATH}/${ID_PATH}/apply$(?![\\s\\S])`)
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/

type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function targetFor(input: ApiV22TransportInput, origin: string): URL {
  const target = new URL(input.path, origin)
  if (CONTROLS.test(input.path) || input.path.includes('\\') || !input.path.startsWith('/')
    || target.origin !== origin || target.hash
    || `${target.pathname}${target.search}` !== input.path
    || new TextEncoder().encode(input.path).length > MAX_TARGET_BYTES) {
    throw new TypeError('API_V22_TARGET_INVALID')
  }
  if (input.method === 'GET') {
    if (target.pathname !== BASE_PATH && !READ_PATH.test(target.pathname) && !APPLIED_READ_PATH.test(target.pathname) && !COMPANION_READ_PATH.test(target.pathname)
      || target.pathname !== BASE_PATH && target.search || input.body !== undefined) {
      throw new TypeError('API_V22_GET_TARGET_INVALID')
    }
    const seen = new Set<string>()
    for (const [key, value] of target.searchParams) {
      if (!['cursor', 'limit', 'sourceConversationId'].includes(key) || seen.has(key)
        || CONTROLS.test(value)) throw new TypeError('API_V22_QUERY_INVALID')
      seen.add(key)
    }
  } else if (target.search || target.pathname !== BASE_PATH && !APPLY_PATH.test(target.pathname)
    || input.body === undefined || new TextEncoder().encode(input.body).length > MAX_REQUEST_BYTES) {
    throw new TypeError('API_V22_POST_TARGET_INVALID')
  }
  return target
}

async function boundedText(response: Response, signal?: AbortSignal): Promise<string> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
    await response.body?.cancel().catch(() => undefined)
    throw new TypeError('API_V22_RESPONSE_TOO_LARGE')
  }
  if (response.body === null) throw new TypeError('API_V22_RESPONSE_BODY_REQUIRED')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal?.addEventListener('abort', abort, { once: true })
  let size = 0, text = '', complete = false
  try {
    for (;;) {
      if (signal?.aborted) throw new TypeError('API_V22_ABORTED')
      const chunk = await reader.read()
      if (signal?.aborted) throw new TypeError('API_V22_ABORTED')
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw new TypeError('API_V22_RESPONSE_TOO_LARGE')
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    complete = true
    return text
  } finally {
    signal?.removeEventListener('abort', abort)
    if (!complete) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function captureMutation(options: MutationOptions): MutationOptions {
  try {
    if (!options || typeof options !== 'object' || Object.getPrototypeOf(options) !== Object.prototype) {
      throw new TypeError()
    }
    const captured: Record<string, unknown> = {}
    const descriptors = Object.getOwnPropertyDescriptors(options)
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string' || !['csrfToken', 'idempotencyKey', 'signal'].includes(key)) throw new TypeError()
      const descriptor = descriptors[key]!
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError()
      captured[key] = descriptor.value
    }
    return Object.freeze(captured) as MutationOptions
  } catch {
    throw new ApiV22Error('INVALID_REQUEST')
  }
}

/** Nonvisual API22 transport. API13 source and v3 draft namespaces stay distinct. */
export class NativeResearchStrategyProposalV22Adapter {
  private readonly client: TesiaResearchStrategyProposalV22Client

  constructor(options: Readonly<{ fetch?: FetchPort; origin?: string }> = {}) {
    const fetchPort = options.fetch ?? ((input, init) => window.fetch(input, init))
    const supplied = new URL(options.origin ?? window.location.origin)
    if (!['https:', 'http:'].includes(supplied.protocol) || supplied.username || supplied.password
      || supplied.pathname !== '/' || supplied.search || supplied.hash) throw new ApiV22Error('INVALID_REQUEST')
    const origin = supplied.origin
    const transport: ResearchStrategyProposalV22Transport = {
      request: async input => {
        const target = targetFor(input, origin)
        const response = await fetchPort(target, {
          method: input.method, headers: input.headers,
          credentials: input.credentials, mode: input.mode,
          redirect: input.redirect, cache: input.cache,
          ...(input.body === undefined ? {} : { body: input.body }),
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        })
        return { status: response.status, headers: [...response.headers.entries()],
          body: await boundedText(response, input.signal) }
      },
    }
    this.client = new TesiaResearchStrategyProposalV22Client(transport)
  }

  async create(request: CreateRequest, options: MutationOptions, reportText: string) {
    let captured: CreateRequest
    try {
      captured = snapshotApiV22(request, true) as CreateRequest
      if (!validateApiV22(captured, 'CreateRequest') || typeof reportText !== 'string'
        || reportText.length === 0 || reportText.length > MAX_REPORT_BYTES) throw new TypeError()
    } catch {
      throw new ApiV22Error('INVALID_REQUEST')
    }
    const mutation = captureMutation(options)
    const bytes = new TextEncoder().encode(reportText)
    if (bytes.byteLength > MAX_REPORT_BYTES || new TextDecoder('utf-8', { fatal: true }).decode(bytes) !== reportText) {
      throw new ApiV22Error('INVALID_REQUEST')
    }
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
    if (sha256 !== captured.reportLocator.contentSha256) throw new ApiV22Error('INVALID_REQUEST')
    const envelope = await this.client.create(captured, mutation)
    return envelope.data
  }

  async read(proposalId: string, options: ReadOptions = {}) {
    return (await this.client.get(proposalId, options)).data
  }

  async list(query: ListQuery = {}, options: ReadOptions = {}) {
    return (await this.client.list(query, options)).data
  }

  async getAppliedDraft(proposalId: string, options: ReadOptions = {}) {
    return (await this.client.getAppliedDraft(proposalId, options)).data
  }

  async getApprovalCompanion(proposalId: string, challengeId: string, options: ReadOptions = {}) {
    return (await this.client.getApprovalCompanion(proposalId, challengeId, options)).data
  }

  async apply(proposalId: string, request: ApplyRequest, options: ApplyOptions) {
    return (await this.client.apply(proposalId, request, options)).data
  }
}

export { ApiV22Error } from './contracts/generated/api-v0.22/index.js'
export type {
  ApplyOptions, ApplyRequest, CreateRequest, DraftBase, ListQuery, MutationOptions,
  ProposalBoundDraft, ProposalProjection, ReadOptions, ReportLocator, SourceAPI13Locator,
  ApprovalCompanion, CompanionEnvelope,
} from './contracts/generated/api-v0.22/index.js'
