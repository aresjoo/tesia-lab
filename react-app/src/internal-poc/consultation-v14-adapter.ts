import {
  strictParseApiV14,
  validateApiV14,
  type ClaimEnvelope,
  type ClaimRequest,
  type ConversationListEnvelope,
  type ConversationListRequest,
  type ErrorCode,
  type ErrorEnvelope,
} from './contracts/generated/api-v0.14/dist/index.js'

const MAX_REQUEST_BYTES = 65_536
const MAX_RESPONSE_BYTES = 262_144
const MAX_TARGET_BYTES = 2_048
const JSON_TYPE = 'application/json'
const ID = /^[A-Za-z0-9_-]{16,128}$/
const STRONG_ETAG = /^"[A-Za-z0-9_-]{16,128}"$/
const SCHEMA = 'consultation-session.schema.json#/$defs/'

const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = {
  BAD_REQUEST: 400,
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  ORIGIN_INVALID: 403,
  NOT_FOUND: 404,
  IDEMPOTENCY_KEY_REUSED: 409,
  SESSION_REVISION_CONFLICT: 409,
  HANDOFF_INVALID: 409,
  CLAIM_CONFLICT: 409,
  CURSOR_INVALID: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

const CLAIM_ERRORS = new Set<ErrorCode>([
  'BAD_REQUEST', 'AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'CSRF_INVALID',
  'ORIGIN_INVALID', 'NOT_FOUND', 'IDEMPOTENCY_KEY_REUSED',
  'SESSION_REVISION_CONFLICT', 'HANDOFF_INVALID', 'CLAIM_CONFLICT',
  'RATE_LIMITED', 'INTERNAL_ERROR',
])
const LIST_ERRORS = new Set<ErrorCode>([
  'BAD_REQUEST', 'AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'ORIGIN_INVALID',
  'CURSOR_INVALID', 'RATE_LIMITED', 'INTERNAL_ERROR',
])

type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type ConsultationV14AdapterOptions = Readonly<{
  fetch?: FetchPort
  origin?: string
  csrfToken: () => string | null
}>

export type ConsultationV14ClaimCommand = Readonly<{
  anonymousSessionId: string
  anonymousIfMatch: string
  targetSessionId: string
  targetExpectedRevision: string
  idempotencyKey: string
}>

export class ConsultationV14ProtocolError extends Error {
  constructor(readonly code = 'CONSULTATION_SESSION_PROTOCOL_INVALID') { super(code) }
}

export class ConsultationV14TransportError extends Error {
  constructor() { super('CONSULTATION_SESSION_TRANSPORT_INTERRUPTED') }
}

export class ConsultationV14HttpError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode) {
    super(`CONSULTATION_SESSION_${code}`)
  }
}

const schema = (name: string) => `${SCHEMA}${name}`
const mediaType = (response: Response) => response.headers.get('content-type')
  ?.split(';', 1)[0]?.trim().toLowerCase()
const noStore = (response: Response) => response.headers.get('cache-control')
  ?.split(',').some(value => value.trim().toLowerCase() === 'no-store') === true

function assertOrigin(candidate: string): string {
  let url: URL
  try { url = new URL(candidate) }
  catch { throw new ConsultationV14ProtocolError() }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin === 'null'
    || url.username !== '' || url.password !== '' || url.pathname !== '/'
    || url.search !== '' || url.hash !== '' || candidate !== url.origin) {
    throw new ConsultationV14ProtocolError()
  }
  return url.origin
}

function assertTarget(path: string, origin: string): URL {
  const url = new URL(path, origin)
  if (url.origin !== origin || url.hash !== ''
    || new TextEncoder().encode(`${url.pathname}${url.search}`).length > MAX_TARGET_BYTES
    || (url.pathname !== '/api/v14/consultation/conversations'
      && !/^\/api\/v14\/consultation\/anonymous-sessions\/[A-Za-z0-9_-]{20,88}\/claim$/.test(url.pathname))) {
    throw new ConsultationV14ProtocolError()
  }
  return url
}

async function boundedText(response: Response): Promise<string> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
    throw new ConsultationV14ProtocolError()
  }
  if (response.body === null) throw new ConsultationV14ProtocolError()
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  let complete = false
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try { chunk = await reader.read() }
      catch (error) {
        if (error instanceof TypeError) throw error
        throw new ConsultationV14TransportError()
      }
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw new ConsultationV14ProtocolError()
      try { text += decoder.decode(chunk.value, { stream: true }) }
      catch { throw new ConsultationV14ProtocolError() }
    }
    try { text += decoder.decode() }
    catch { throw new ConsultationV14ProtocolError() }
    complete = true
    return text
  } catch (error) {
    if (error instanceof TypeError || error instanceof ConsultationV14TransportError
      || error instanceof ConsultationV14ProtocolError) throw error
    throw new ConsultationV14ProtocolError()
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function parseWire<T>(text: string, schemaName: string): T {
  let value: unknown
  try { value = strictParseApiV14(text) }
  catch { throw new ConsultationV14ProtocolError() }
  if (!validateApiV14(value, schema(schemaName))) throw new ConsultationV14ProtocolError()
  return value as T
}

function requestBody(value: unknown, schemaName: string): string {
  if (!validateApiV14(value, schema(schemaName))) throw new ConsultationV14ProtocolError()
  const body = JSON.stringify(value)
  try { strictParseApiV14(body, true) }
  catch { throw new ConsultationV14ProtocolError() }
  if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) {
    throw new ConsultationV14ProtocolError()
  }
  return body
}

async function parseError(response: Response, allowed: ReadonlySet<ErrorCode>): Promise<never> {
  const gateway = response.status === 429 || response.status >= 500
  if (!noStore(response) || mediaType(response) !== JSON_TYPE) {
    await response.body?.cancel().catch(() => undefined)
    if (gateway) throw new ConsultationV14TransportError()
    throw new ConsultationV14ProtocolError()
  }
  let envelope: ErrorEnvelope
  try { envelope = parseWire<ErrorEnvelope>(await boundedText(response), 'ErrorEnvelope') }
  catch (error) {
    if (gateway) throw new ConsultationV14TransportError()
    throw error
  }
  if (!allowed.has(envelope.error.code)
    || ERROR_STATUS[envelope.error.code] !== response.status) {
    throw new ConsultationV14ProtocolError()
  }
  throw new ConsultationV14HttpError(response.status, envelope.error.code)
}

function timestampMicros(value: string): bigint {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(value)
  if (match === null) throw new ConsultationV14ProtocolError()
  return BigInt(Date.parse(`${match[1]}Z`)) * 1_000n
    + BigInt((match[2] ?? '').padEnd(6, '0'))
}

function assertClaimBinding(command: ConsultationV14ClaimCommand, envelope: ClaimEnvelope): void {
  const expected = BigInt(command.targetExpectedRevision)
  const committed = BigInt(envelope.data.revision)
  const legacy = Object.values(envelope.data.claimedLegacyResourceCounts)
  if (envelope.data.anonymousSessionId !== command.anonymousSessionId
    || envelope.data.sessionId !== command.targetSessionId
    || committed <= expected
    || envelope.data.claimedConsultationResourceCounts.conversations < 1
    || envelope.data.claimedConsultationResourceCounts.turns < 1
    || (envelope.data.mode === 'CONSULTATION_ONLY' && legacy.some(value => value !== 0))
    || (envelope.data.mode === 'COMBINED'
      && envelope.data.claimedLegacyResourceCounts.drafts < 1)) {
    throw new ConsultationV14ProtocolError('CONSULTATION_SESSION_BINDING_CONFLICT')
  }
}

function assertListBinding(
  request: Required<Pick<ConversationListRequest, 'limit'>> & ConversationListRequest,
  envelope: ConversationListEnvelope,
): void {
  const page = envelope.data
  const end = page.offset + page.conversations.length
  if (page.limit !== request.limit || page.conversations.length > request.limit
    || (request.cursor === undefined && page.offset !== 0)
    || end > page.totalCount
    || (end < page.totalCount) !== (page.nextCursor !== null)) {
    throw new ConsultationV14ProtocolError('CONSULTATION_SESSION_BINDING_CONFLICT')
  }
  const seen = new Set<string>()
  let previous: (typeof page.conversations)[number] | undefined
  for (const row of page.conversations) {
    if (seen.has(row.conversationId)
      || timestampMicros(row.createdAt) > timestampMicros(row.updatedAt)
      || (row.turnCount === 0) !== (row.lastTurnId === null && row.lastTurnState === null)
      || (row.turnCount > 0) !== (row.lastTurnId !== null && row.lastTurnState !== null)) {
      throw new ConsultationV14ProtocolError('CONSULTATION_SESSION_BINDING_CONFLICT')
    }
    if (previous !== undefined) {
      const priorUpdated = timestampMicros(previous.updatedAt)
      const updated = timestampMicros(row.updatedAt)
      if (priorUpdated < updated
        || (priorUpdated === updated && previous.conversationId >= row.conversationId)) {
        throw new ConsultationV14ProtocolError('CONSULTATION_SESSION_BINDING_CONFLICT')
      }
    }
    seen.add(row.conversationId)
    previous = row
  }
}

export class ConsultationV14Adapter {
  private readonly fetchPort: FetchPort
  private readonly origin: string
  private readonly csrfToken: () => string | null

  constructor(options: ConsultationV14AdapterOptions) {
    if (typeof options?.csrfToken !== 'function') throw new ConsultationV14ProtocolError()
    this.origin = assertOrigin(options.origin ?? window.location.origin)
    this.fetchPort = options.fetch ?? ((input, init) => window.fetch(input, init))
    this.csrfToken = options.csrfToken
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const url = assertTarget(path, this.origin)
    const response = await this.fetchPort(url, {
      credentials: 'same-origin', redirect: 'manual', cache: 'no-store', ...init,
    })
    if (response.redirected || response.type === 'opaqueredirect'
      || (response.status >= 300 && response.status < 400)
      || (response.url !== '' && response.url !== url.href)) {
      await response.body?.cancel().catch(() => undefined)
      throw new ConsultationV14ProtocolError()
    }
    return response
  }

  validateClaim(command: ConsultationV14ClaimCommand): void {
    const request: ClaimRequest = {
      anonymousSessionId: command.anonymousSessionId,
      expectedSessionRevision: command.targetExpectedRevision,
    }
    if (!validateApiV14(request, schema('ClaimRequest'))
      || !validateApiV14(command.targetSessionId, schema('SessionId'))
      || !ID.test(command.idempotencyKey)
      || !STRONG_ETAG.test(command.anonymousIfMatch)) {
      throw new ConsultationV14ProtocolError()
    }
  }

  async claim(command: ConsultationV14ClaimCommand, signal?: AbortSignal): Promise<ClaimEnvelope> {
    this.validateClaim(command)
    const csrf = this.csrfToken()
    if (typeof csrf !== 'string' || csrf.length < 1 || csrf.length > 4_096
      || /[\r\n]/.test(csrf)) {
      throw new ConsultationV14ProtocolError('CONSULTATION_SESSION_CSRF_UNAVAILABLE')
    }
    const body = requestBody(
      { expectedSessionRevision: command.targetExpectedRevision }, 'ClaimBody',
    )
    const path = `/api/v14/consultation/anonymous-sessions/${command.anonymousSessionId}/claim`
    const response = await this.fetch(path, {
      method: 'POST',
      headers: {
        Accept: JSON_TYPE,
        'Content-Type': JSON_TYPE,
        'X-CSRF-Token': csrf,
        'Idempotency-Key': command.idempotencyKey,
        'If-Match': command.anonymousIfMatch,
      },
      body,
      signal,
    })
    if (response.status !== 200) return parseError(response, CLAIM_ERRORS)
    if (!noStore(response) || mediaType(response) !== JSON_TYPE) {
      throw new ConsultationV14ProtocolError()
    }
    const envelope = parseWire<ClaimEnvelope>(await boundedText(response), 'ClaimEnvelope')
    assertClaimBinding(command, envelope)
    return envelope
  }

  async list(
    request: ConversationListRequest = {}, signal?: AbortSignal,
  ): Promise<ConversationListEnvelope> {
    const normalized = { ...request, limit: request.limit ?? 50 }
    if (!validateApiV14(normalized, schema('ConversationListRequest'))) {
      throw new ConsultationV14ProtocolError()
    }
    const query = new URLSearchParams({
      ...(normalized.cursor === undefined ? {} : { cursor: normalized.cursor }),
      limit: String(normalized.limit),
    })
    const response = await this.fetch(
      `/api/v14/consultation/conversations?${query}`,
      {
        method: 'GET', headers: { Accept: JSON_TYPE },
        ...(signal === undefined ? {} : { signal }),
      },
    )
    if (response.status !== 200) return parseError(response, LIST_ERRORS)
    if (!noStore(response) || mediaType(response) !== JSON_TYPE) {
      throw new ConsultationV14ProtocolError()
    }
    const envelope = parseWire<ConversationListEnvelope>(
      await boundedText(response), 'ConversationListEnvelope',
    )
    assertListBinding(normalized, envelope)
    return envelope
  }
}
