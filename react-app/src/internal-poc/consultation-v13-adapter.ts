import {
  strictParseApiV13,
  validateApiV13,
  type CancelEnvelope,
  type CapabilitiesEnvelope,
  type CreateRequest,
  type ErrorCode,
  type ErrorEnvelope,
  type Event,
  type EventsEnvelope,
  type HistoryEnvelope,
  type TurnEnvelope,
} from './contracts/generated/api-v0.13/dist/index.js'

const MAX_REQUEST_BYTES = 65_536
const MAX_RESPONSE_BYTES = 262_144
const MAX_TARGET_BYTES = 2_048
const ID = /^[A-Za-z0-9_-]{16,128}$/
const DECIMAL_SEQUENCE = /^(?:0|[1-9][0-9]*)$/
const JSON_TYPE = 'application/json'
const SSE_TYPE = 'text/event-stream'
const SCHEMA = 'consultation.schema.json#/$defs/'

type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class ConsultationV13ProtocolError extends Error {
  constructor(readonly code = 'CONSULTATION_PROTOCOL_INVALID') { super(code) }
}

export class ConsultationV13TransportError extends Error {
  constructor() { super('CONSULTATION_TRANSPORT_INTERRUPTED') }
}

export class ConsultationV13HttpError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode) { super(`CONSULTATION_${code}`) }
}

export type ConsultationV13StreamEvent = Readonly<{ event: Event; canonical: string }>

export type ConsultationV13AdapterOptions = Readonly<{
  fetch?: FetchPort
  origin?: string
  csrfToken: () => string | null
}>

const schema = (name: string) => `${SCHEMA}${name}`
const mediaType = (response: Response) => response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
const noStore = (response: Response) => response.headers.get('cache-control')?.split(',').some(value => value.trim().toLowerCase() === 'no-store') === true

function assertId(value: string) {
  if (!ID.test(value)) throw new ConsultationV13ProtocolError()
}

function assertTarget(path: string, origin: string) {
  const url = new URL(path, origin)
  if (url.origin !== origin || !url.pathname.startsWith('/api/v13/consultation/')
    || new TextEncoder().encode(`${url.pathname}${url.search}`).length > MAX_TARGET_BYTES) {
    throw new ConsultationV13ProtocolError()
  }
  return url
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value !== 'object') throw new ConsultationV13ProtocolError()
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

async function boundedText(response: Response): Promise<string> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) throw new ConsultationV13ProtocolError()
  if (response.body === null) throw new ConsultationV13ProtocolError()
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, text = '', complete = false
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try { chunk = await reader.read() }
      catch (error) {
        if (error instanceof TypeError) throw error
        throw new ConsultationV13TransportError()
      }
      const { done, value } = chunk
      if (done) break
      size += value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw new ConsultationV13ProtocolError()
      try { text += decoder.decode(value, { stream: true }) }
      catch { throw new ConsultationV13ProtocolError() }
    }
    try { text += decoder.decode() }
    catch { throw new ConsultationV13ProtocolError() }
    complete = true
    return text
  } catch (error) {
    if (error instanceof TypeError || error instanceof ConsultationV13TransportError || error instanceof ConsultationV13ProtocolError) throw error
    throw new ConsultationV13ProtocolError()
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function parseWire<T>(text: string, schemaName: string): T {
  let value: unknown
  try { value = strictParseApiV13(text) }
  catch { throw new ConsultationV13ProtocolError() }
  if (!validateApiV13(value, schema(schemaName))) throw new ConsultationV13ProtocolError()
  return value as T
}

async function parseError(response: Response): Promise<never> {
  const gateway = response.status === 429 || response.status >= 500
  if (!noStore(response) || mediaType(response) !== JSON_TYPE) {
    await response.body?.cancel().catch(() => undefined)
    if (gateway) throw new ConsultationV13TransportError()
    throw new ConsultationV13ProtocolError()
  }
  let value: ErrorEnvelope
  try { value = parseWire<ErrorEnvelope>(await boundedText(response), 'ErrorEnvelope') }
  catch (error) {
    if (gateway) throw new ConsultationV13TransportError()
    throw error
  }
  throw new ConsultationV13HttpError(response.status, value.error.code)
}

function requestBody<T>(value: T, schemaName: string): string {
  if (!validateApiV13(value, schema(schemaName))) throw new ConsultationV13ProtocolError()
  const body = JSON.stringify(value)
  try { strictParseApiV13(body, true) } catch { throw new ConsultationV13ProtocolError() }
  if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) throw new ConsultationV13ProtocolError()
  return body
}

function parseFrame(frame: string): ConsultationV13StreamEvent | null {
  const lines = frame.split('\n')
  const fields = new Map<string, string>()
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue
    const separator = line.indexOf(':')
    if (separator <= 0) throw new ConsultationV13ProtocolError()
    const key = line.slice(0, separator)
    const value = line.slice(separator + 1).replace(/^ /, '')
    if (!['event', 'id', 'data'].includes(key) || fields.has(key)) throw new ConsultationV13ProtocolError()
    fields.set(key, value)
  }
  if (fields.size === 0) return null
  if (fields.size !== 3 || fields.get('event') !== 'consultation') throw new ConsultationV13ProtocolError()
  const id = fields.get('id')!
  if (!DECIMAL_SEQUENCE.test(id)) throw new ConsultationV13ProtocolError()
  const event = parseWire<Event>(fields.get('data')!, 'Event')
  if (String(event.sequence) !== id) throw new ConsultationV13ProtocolError()
  return { event, canonical: canonicalJson(event) }
}

export class ConsultationV13Adapter {
  private readonly fetchPort: FetchPort
  private readonly origin: string
  private readonly csrfToken: () => string | null

  constructor(options: ConsultationV13AdapterOptions) {
    this.fetchPort = options.fetch ?? ((input, init) => window.fetch(input, init))
    this.origin = options.origin ?? window.location.origin
    this.csrfToken = options.csrfToken
  }

  private async fetch(path: string, init: RequestInit): Promise<Response> {
    const url = assertTarget(path, this.origin)
    return this.fetchPort(url, { credentials: 'same-origin', redirect: 'manual', cache: 'no-store', ...init })
  }

  private async json<T>(path: string, schemaName: string, expectedStatus = 200, signal?: AbortSignal): Promise<T> {
    const response = await this.fetch(path, { method: 'GET', headers: { Accept: JSON_TYPE }, ...(signal === undefined ? {} : { signal }) })
    if (response.status !== expectedStatus) return parseError(response)
    if (!noStore(response) || mediaType(response) !== JSON_TYPE) throw new ConsultationV13ProtocolError()
    return parseWire<T>(await boundedText(response), schemaName)
  }

  private async mutate<T>(path: string, value: unknown, requestSchema: string | null, responseSchema: string, key: string, expectedStatus: number): Promise<T> {
    assertId(key)
    const csrf = this.csrfToken()
    if (!csrf) throw new ConsultationV13ProtocolError('CONSULTATION_CSRF_UNAVAILABLE')
    const body = requestSchema === null ? '{}' : requestBody(value, requestSchema)
    const response = await this.fetch(path, { method: 'POST', headers: { Accept: JSON_TYPE, 'Content-Type': JSON_TYPE, 'X-CSRF-Token': csrf, 'Idempotency-Key': key }, body })
    if (response.status !== expectedStatus) return parseError(response)
    if (!noStore(response) || mediaType(response) !== JSON_TYPE) throw new ConsultationV13ProtocolError()
    return parseWire<T>(await boundedText(response), responseSchema)
  }

  validateCreate(request: CreateRequest) { requestBody(request, 'CreateRequest') }

  capabilities(signal?: AbortSignal) { return this.json<CapabilitiesEnvelope>('/api/v13/consultation/capabilities', 'CapabilitiesEnvelope', 200, signal) }

  create(request: CreateRequest, key: string) {
    return this.mutate<TurnEnvelope>('/api/v13/consultation/turns', request, 'CreateRequest', 'TurnEnvelope', key, 202)
  }

  turn(turnId: string, signal?: AbortSignal) {
    assertId(turnId)
    return this.json<TurnEnvelope>(`/api/v13/consultation/turns/${turnId}`, 'TurnEnvelope', 200, signal)
  }

  events(turnId: string, after: number, limit = 100, signal?: AbortSignal) {
    assertId(turnId)
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ConsultationV13ProtocolError()
    return this.json<EventsEnvelope>(`/api/v13/consultation/turns/${turnId}/events?after=${after}&limit=${limit}`, 'EventsEnvelope', 200, signal)
  }

  history(conversationId: string, cursor?: string, limit = 100, signal?: AbortSignal) {
    assertId(conversationId)
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ConsultationV13ProtocolError()
    if (cursor !== undefined && !/^[A-Za-z0-9_-]{16,512}$/.test(cursor)) throw new ConsultationV13ProtocolError()
    const query = new URLSearchParams({ limit: String(limit), ...(cursor === undefined ? {} : { cursor }) })
    return this.json<HistoryEnvelope>(`/api/v13/consultation/conversations/${conversationId}/history?${query}`, 'HistoryEnvelope', 200, signal)
  }

  cancel(turnId: string, key: string) {
    assertId(turnId)
    return this.mutate<CancelEnvelope>(`/api/v13/consultation/turns/${turnId}/cancel`, {}, null, 'CancelEnvelope', key, 200)
  }

  async *stream(turnId: string, after: number, signal?: AbortSignal): AsyncGenerator<ConsultationV13StreamEvent> {
    assertId(turnId)
    if (!Number.isSafeInteger(after) || after < 0) throw new ConsultationV13ProtocolError()
    const response = await this.fetch(`/api/v13/consultation/turns/${turnId}/events?after=${after}&limit=100`, {
      method: 'GET', headers: { Accept: SSE_TYPE }, ...(signal === undefined ? {} : { signal }),
    })
    if (response.status !== 200) {
      await parseError(response)
      return
    }
    if (!noStore(response) || mediaType(response) !== SSE_TYPE || response.body === null) throw new ConsultationV13ProtocolError()
    const length = response.headers.get('content-length')
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) throw new ConsultationV13ProtocolError()
    const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
    let buffered = '', size = 0, pendingCr = false, count = 0, complete = false
    const append = (decoded: string) => {
      if (pendingCr) decoded = `\r${decoded}`
      pendingCr = decoded.endsWith('\r')
      if (pendingCr) decoded = decoded.slice(0, -1)
      buffered += decoded.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
    }
    try {
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>
        try { chunk = await reader.read() }
        catch (error) {
          if (signal?.aborted && error instanceof DOMException && error.name === 'AbortError') throw error
          if (error instanceof TypeError) throw error
          throw new ConsultationV13TransportError()
        }
        const { done, value } = chunk
        if (done) { complete = true; break }
        size += value.byteLength
        if (size > MAX_RESPONSE_BYTES) throw new ConsultationV13ProtocolError()
        try { append(decoder.decode(value, { stream: true })) }
        catch { throw new ConsultationV13ProtocolError() }
        let boundary = buffered.indexOf('\n\n')
        while (boundary >= 0) {
          const parsed = parseFrame(buffered.slice(0, boundary))
          buffered = buffered.slice(boundary + 2)
          if (parsed) {
            if (++count > 100) throw new ConsultationV13ProtocolError()
            yield parsed
          }
          boundary = buffered.indexOf('\n\n')
        }
      }
      try { append(decoder.decode()) }
      catch { throw new ConsultationV13ProtocolError() }
      if (pendingCr) { buffered += '\n'; pendingCr = false }
      if (buffered.length > 0) throw new ConsultationV13ProtocolError()
    } catch (error) {
      if (signal?.aborted && error instanceof DOMException && error.name === 'AbortError') throw error
      if (error instanceof TypeError || error instanceof ConsultationV13TransportError
        || error instanceof ConsultationV13ProtocolError || error instanceof ConsultationV13HttpError) throw error
      throw new ConsultationV13ProtocolError()
    } finally {
      if (!complete) await reader.cancel().catch(() => undefined)
      reader.releaseLock()
    }
  }
}

export const consultationV13CanonicalEvent = canonicalJson
