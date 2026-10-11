import {
  ApiV16Error,
  snapshotApiV16,
  TesiaDocumentQuestionV16Client,
  type ApiV16TransportInput,
  type DocumentKind,
  type DocumentQuestionAdmission,
  type DocumentQuestionHistory,
  type DocumentQuestionRequest,
  type DocumentQuestionTurnProjection,
  type DocumentQuestionV16Transport,
  type ProducerLocator,
  type ReferenceMintRequest,
  type DocumentSnapshot,
} from './contracts/generated/api-v0.16/index.js'

const MAX_REQUEST_BYTES = 65_536
const MAX_RESPONSE_BYTES = 262_144
const MAX_TARGET_BYTES = 2_048
const ID = '[A-Za-z0-9_-]{16,128}'
const KIND = '(?:plan|hypothesis|strategy|backtest|critic|stress|holdout|report|connect|run|live)'
const TARGETS = new Map<ApiV16TransportInput['method'], readonly RegExp[]>([
  ['GET', [
    new RegExp(`^/api/v16/consultation/documents/${KIND}/${ID}/locator$`),
    new RegExp(`^/api/v16/consultation/turns/${ID}$`),
    new RegExp(`^/api/v16/consultation/conversations/${ID}/history$`),
  ]],
  ['POST', [
    /^\/api\/v16\/consultation\/document-references$/,
    /^\/api\/v16\/consultation\/document-questions$/,
    new RegExp(`^/api/v16/consultation/conversations/${ID}/document-questions$`),
  ]],
])

type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type ReadOptions = Readonly<{ signal?: AbortSignal }>
type MutationOptions = Readonly<{ csrfToken: string; idempotencyKey: string; signal?: AbortSignal }>

function invalidResponse(): never {
  throw new ApiV16Error('INVALID_RESPONSE', 200)
}

function immutableRequest<T>(request: T): T {
  try {
    return snapshotApiV16(request, true) as T
  } catch {
    throw new ApiV16Error('INVALID_REQUEST')
  }
}

function exactLocator(actual: ProducerLocator, expected: ProducerLocator): boolean {
  return actual.producerServiceId === expected.producerServiceId
    && actual.kind === expected.kind
    && actual.documentId === expected.documentId
    && actual.revision === expected.revision
    && actual.contentSha256 === expected.contentSha256
}

async function boundedText(response: Response): Promise<string> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
    await response.body?.cancel().catch(() => undefined)
    throw new TypeError('API_V16_RESPONSE_TOO_LARGE')
  }
  if (response.body === null) throw new TypeError('API_V16_RESPONSE_BODY_REQUIRED')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  let complete = false
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw new TypeError('API_V16_RESPONSE_TOO_LARGE')
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    complete = true
    return text
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function targetFor(input: ApiV16TransportInput, origin: string): URL {
  const target = new URL(input.path, origin)
  const routes = TARGETS.get(input.method)
  if (target.origin !== origin || target.hash || routes === undefined
    || !routes.some(route => route.test(target.pathname))
    || (target.search && !target.pathname.endsWith('/history'))
    || new TextEncoder().encode(`${target.pathname}${target.search}`).length > MAX_TARGET_BYTES) {
    throw new TypeError('API_V16_TARGET_INVALID')
  }
  if (input.method === 'GET' && input.body !== undefined) throw new TypeError('API_V16_GET_BODY_INVALID')
  if (input.body !== undefined && new TextEncoder().encode(input.body).length > MAX_REQUEST_BYTES) {
    throw new TypeError('API_V16_REQUEST_TOO_LARGE')
  }
  return target
}

/** Same-origin transport and exact response-binding checks for generated API16 operations. */
export class ConsultationV16Adapter {
  private readonly client: TesiaDocumentQuestionV16Client

  constructor(options: Readonly<{ fetch?: FetchPort; origin?: string }> = {}) {
    const fetchPort = options.fetch ?? ((input, init) => window.fetch(input, init))
    const origin = new URL(options.origin ?? window.location.origin).origin
    const transport: DocumentQuestionV16Transport = {
      request: async input => {
        const target = targetFor(input, origin)
        const response = await fetchPort(target, {
          method: input.method,
          headers: input.headers,
          credentials: input.credentials,
          mode: input.mode,
          redirect: input.redirect,
          cache: input.cache,
          ...(input.body === undefined ? {} : { body: input.body }),
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        })
        return {
          status: response.status,
          headers: [...response.headers.entries()],
          body: await boundedText(response),
        }
      },
    }
    this.client = new TesiaDocumentQuestionV16Client(transport)
  }

  async locator(kind: DocumentKind, documentId: string, options: ReadOptions = {}): Promise<ProducerLocator> {
    const envelope = await this.client.locator(kind, documentId, options)
    if (envelope.data.kind !== kind || envelope.data.documentId !== documentId) invalidResponse()
    return envelope.data
  }

  async mint(request: ReferenceMintRequest, options: MutationOptions): Promise<DocumentSnapshot> {
    const exactRequest = immutableRequest(request)
    const envelope = await this.client.mint(exactRequest, options)
    if (!exactLocator(envelope.data, exactRequest.locator)) invalidResponse()
    return envelope.data
  }

  async question(conversationId: string, request: DocumentQuestionRequest, options: MutationOptions): Promise<DocumentQuestionAdmission> {
    const exactRequest = immutableRequest(request)
    if (exactRequest.text.normalize('NFC') !== exactRequest.text) throw new ApiV16Error('INVALID_REQUEST')
    const envelope = await this.client.question(conversationId, exactRequest, options)
    if (envelope.data.conversationId !== conversationId
      || envelope.data.clientMessageId !== exactRequest.clientMessageId
      || envelope.data.documentRef !== exactRequest.documentRef) invalidResponse()
    return envelope.data
  }

  async questionFirst(request: DocumentQuestionRequest, options: MutationOptions): Promise<DocumentQuestionAdmission> {
    const exactRequest = immutableRequest(request)
    if (exactRequest.text.normalize('NFC') !== exactRequest.text) throw new ApiV16Error('INVALID_REQUEST')
    const envelope = await this.client.questionFirst(exactRequest, options)
    if (envelope.data.clientMessageId !== exactRequest.clientMessageId
      || envelope.data.documentRef !== exactRequest.documentRef) invalidResponse()
    return envelope.data
  }

  async turn(turnId: string, options: ReadOptions = {}): Promise<DocumentQuestionTurnProjection> {
    const envelope = await this.client.turn(turnId, options)
    if (envelope.data.turnId !== turnId) invalidResponse()
    return envelope.data
  }

  async history(conversationId: string, options: ReadOptions & Readonly<{ cursor?: string; limit?: number }> = {}): Promise<DocumentQuestionHistory> {
    const envelope = await this.client.history(conversationId, options)
    if (envelope.data.items.some(item => item.conversationId !== conversationId)) invalidResponse()
    return envelope.data
  }
}

export { ApiV16Error } from './contracts/generated/api-v0.16/index.js'
export type {
  DocumentKind,
  DocumentQuestionAdmission,
  DocumentQuestionHistory,
  DocumentQuestionRequest,
  DocumentQuestionTurnProjection,
  DocumentSnapshot,
  ProducerLocator,
  ReferenceMintRequest,
} from './contracts/generated/api-v0.16/index.js'
