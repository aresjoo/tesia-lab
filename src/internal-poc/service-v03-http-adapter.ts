import operationManifest from './contracts/generated/api-v0.3/operation-manifest.json' with { type: 'json' }
import type {
  ApiV03Transport,
  OperationId,
  TransportRequest,
  TransportResponse,
} from './contracts/generated/api-v0.3/types.js'

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_EVIDENCE_ITEMS = 32
const CSRF_HEADER = 'X-CSRF-Token'
const IDEMPOTENCY_HEADER = 'Idempotency-Key'
const IF_MATCH_HEADER = 'If-Match'
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
const STRONG_ETAG_PATTERN = /^"[A-Za-z0-9_-]{16,128}"$/

type ManifestOperation = (typeof operationManifest.operations)[number]
export type ServiceV03CsrfTokenProvider = () => string | null | Promise<string | null>
export type ServiceV03FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface ServiceV03HttpEvidence {
  readonly operationId: OperationId
  readonly status: number
  readonly byteLength: number
  readonly bodySha256: string
  readonly etag: string | null
}

export interface ServiceV03HttpTransportAudit {
  readonly requestCount: number
  readonly responses: readonly ServiceV03HttpEvidence[]
}

export interface ServiceV03HttpTransport extends ApiV03Transport {
  abortInFlight(): void
  audit(): ServiceV03HttpTransportAudit
}

export interface ServiceV03HttpTransportOptions {
  readonly csrfTokenProvider: ServiceV03CsrfTokenProvider
  readonly fetchImplementation?: ServiceV03FetchImplementation
  readonly maxResponseBytes?: number
}

const assertCurrentOrigin = (): string => {
  if (typeof window === 'undefined') throw new Error('SERVICE_V03_BROWSER_ORIGIN_REQUIRED')
  const parsed = new URL(window.location.origin)
  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    || parsed.username !== ''
    || parsed.password !== ''
    || parsed.pathname !== '/'
    || parsed.search !== ''
    || parsed.hash !== ''
  ) throw new Error('SERVICE_V03_BROWSER_ORIGIN_INVALID')
  const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]'
  if (parsed.protocol !== 'https:' && !loopback) throw new Error('SERVICE_V03_INSECURE_ORIGIN_REJECTED')
  return parsed.origin
}

const matchesManifestPath = (template: string, path: string): boolean => {
  const expected = template.split('/')
  const actual = path.split('/')
  return expected.length === actual.length && expected.every((segment, index) => {
    if (segment.startsWith('{') && segment.endsWith('}')) {
      return actual[index] !== undefined && /^[A-Za-z0-9_-]+$/.test(actual[index])
    }
    return segment === actual[index]
  })
}

const operationFor = (
  request: TransportRequest,
  origin: string,
): Readonly<{ operation: ManifestOperation; url: string }> => {
  let resolved: URL
  try {
    resolved = new URL(request.path, origin)
  } catch {
    throw new Error('SERVICE_V03_API_PATH_REJECTED')
  }
  if (resolved.origin !== origin || resolved.pathname !== request.path) {
    throw new Error('SERVICE_V03_CROSS_ORIGIN_REJECTED')
  }
  if (!request.path.startsWith('/api/v3/') || request.path.includes('?') || request.path.includes('#')) {
    throw new Error('SERVICE_V03_API_PATH_REJECTED')
  }
  const matches = operationManifest.operations.filter((operation) => (
    operation.method === request.method && matchesManifestPath(operation.path, request.path)
  ))
  if (matches.length !== 1) throw new Error('SERVICE_V03_OPERATION_REJECTED')
  return { operation: matches[0], url: resolved.href }
}

const requestHeader = (headers: Readonly<Record<string, string>>, name: string): string | null => {
  const matches = Object.entries(headers).filter(([key]) => key.toLowerCase() === name.toLowerCase())
  if (matches.length > 1) throw new Error('SERVICE_V03_DUPLICATE_REQUEST_HEADER')
  return matches[0]?.[1] ?? null
}

const responseHeaders = (headers: Headers): Readonly<Record<string, string>> => {
  const etag = headers.get('etag')
  if (etag === null) return Object.freeze({})
  return Object.freeze({ ETag: etag })
}

const bodySha256 = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const boundedResponseBytes = async (
  response: Response,
  maxResponseBytes: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  if (response.body === null) return new Uint8Array(new ArrayBuffer(0))
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let total = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      const detached = new Uint8Array(value)
      total += detached.byteLength
      if (total > maxResponseBytes) {
        await reader.cancel()
        throw new Error('SERVICE_V03_RESPONSE_TOO_LARGE')
      }
      chunks.push(detached)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(new ArrayBuffer(total))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

const cancelResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel()
  } catch {
    // Best-effort resource cleanup must not replace the stable fail-closed error.
  }
}

const responseBody = async (
  response: Response,
  maxResponseBytes: number,
): Promise<Readonly<{ body: unknown; bytes: Uint8Array<ArrayBuffer>; sha256: string }>> => {
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    await cancelResponseBody(response)
    throw new Error('SERVICE_V03_JSON_RESPONSE_REQUIRED')
  }
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null) {
    const parsedLength = /^(0|[1-9][0-9]*)$/.test(declaredLength) ? Number(declaredLength) : Number.NaN
    if (!Number.isSafeInteger(parsedLength) || parsedLength > maxResponseBytes) {
      await cancelResponseBody(response)
      throw new Error('SERVICE_V03_RESPONSE_TOO_LARGE')
    }
  }
  const bytes = await boundedResponseBytes(response, maxResponseBytes)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('SERVICE_V03_RESPONSE_UTF8_INVALID')
  }
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    throw new Error('SERVICE_V03_RESPONSE_JSON_INVALID')
  }
  return { body, bytes, sha256: await bodySha256(bytes) }
}

const csrfToken = async (provider: ServiceV03CsrfTokenProvider): Promise<string> => {
  let value: string | null
  try {
    value = await provider()
  } catch {
    throw new Error('SERVICE_V03_CSRF_UNAVAILABLE')
  }
  if (typeof value !== 'string' || !/^[!-~]{16,256}$/.test(value)) {
    throw new Error('SERVICE_V03_CSRF_UNAVAILABLE')
  }
  return value
}

class SameOriginServiceV03Transport implements ServiceV03HttpTransport {
  private readonly activeControllers = new Set<AbortController>()
  private readonly evidence: ServiceV03HttpEvidence[] = []
  private requestCount = 0

  constructor(private readonly options: ServiceV03HttpTransportOptions) {}

  async request(request: TransportRequest): Promise<TransportResponse> {
    const origin = assertCurrentOrigin()
    const { operation, url } = operationFor(request, origin)
    const headers = new Headers({ Accept: 'application/json' })
    const maxResponseBytes = this.options.maxResponseBytes ?? MAX_RESPONSE_BYTES
    if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > MAX_RESPONSE_BYTES) {
      throw new Error('SERVICE_V03_RESPONSE_LIMIT_INVALID')
    }
    const controller = new AbortController()
    this.activeControllers.add(controller)
    try {
      if (operation.kind === 'MUTATION') {
        const idempotencyKey = requestHeader(request.headers, IDEMPOTENCY_HEADER)
        const ifMatch = requestHeader(request.headers, IF_MATCH_HEADER)
        if (operation.requiresIdempotencyKey && idempotencyKey === null) {
          throw new Error('SERVICE_V03_IDEMPOTENCY_KEY_REQUIRED')
        }
        if (operation.requiresIfMatch && ifMatch === null) {
          throw new Error('SERVICE_V03_IF_MATCH_REQUIRED')
        }
        if (idempotencyKey !== null && !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
          throw new Error('SERVICE_V03_IDEMPOTENCY_KEY_INVALID')
        }
        if (ifMatch !== null && !STRONG_ETAG_PATTERN.test(ifMatch)) {
          throw new Error('SERVICE_V03_IF_MATCH_INVALID')
        }
        const token = await csrfToken(this.options.csrfTokenProvider)
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        headers.set(CSRF_HEADER, token)
        if (idempotencyKey !== null) headers.set(IDEMPOTENCY_HEADER, idempotencyKey)
        if (ifMatch !== null) headers.set(IF_MATCH_HEADER, ifMatch)
      }
      const body = request.body === undefined ? undefined : JSON.stringify(request.body)
      if (body === undefined) headers.delete('Content-Type')
      else headers.set('Content-Type', 'application/json')

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      this.requestCount += 1
      let response: Response
      try {
        const fetcher = this.options.fetchImplementation ?? globalThis.fetch.bind(globalThis)
        response = await fetcher(url, {
          method: operation.method,
          headers,
          ...(body === undefined ? {} : { body }),
          credentials: 'same-origin',
          mode: 'same-origin',
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
        })
      } catch {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        throw new Error('SERVICE_V03_HTTP_TRANSPORT_UNAVAILABLE')
      }

      if (response.url !== '' && new URL(response.url).origin !== origin) {
        await cancelResponseBody(response)
        throw new Error('SERVICE_V03_CROSS_ORIGIN_RESPONSE_REJECTED')
      }
      const parsed = await responseBody(response, maxResponseBytes)
      const headersRecord = responseHeaders(response.headers)
      this.evidence.push(Object.freeze({
        operationId: operation.operationId as OperationId,
        status: response.status,
        byteLength: parsed.bytes.byteLength,
        bodySha256: parsed.sha256,
        etag: response.headers.get('etag'),
      }))
      if (this.evidence.length > MAX_EVIDENCE_ITEMS) this.evidence.shift()
      return { status: response.status, headers: headersRecord, body: parsed.body }
    } finally {
      this.activeControllers.delete(controller)
    }
  }

  abortInFlight(): void {
    for (const controller of this.activeControllers) controller.abort()
  }

  audit(): ServiceV03HttpTransportAudit {
    return Object.freeze({
      requestCount: this.requestCount,
      responses: Object.freeze(this.evidence.map((item) => Object.freeze({ ...item }))),
    })
  }
}

export const createServiceV03HttpTransport = (
  options: ServiceV03HttpTransportOptions,
): ServiceV03HttpTransport => new SameOriginServiceV03Transport(options)
