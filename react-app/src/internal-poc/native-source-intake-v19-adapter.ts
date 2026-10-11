import { strictParseApiV13 } from './contracts/generated/api-v0.13/dist/index.js'
import { readSourceIntake, type SourceIntakeAnswer } from '../client-source-intake'

const API_VERSION = '0.19.0' as const
const JSON_TYPE = 'application/json'
const MAX_REQUEST_BYTES = 65_536
const MAX_RESPONSE_BYTES = 262_144
const MAX_TARGET_BYTES = 2_048
const ID = /^[A-Za-z0-9_-]{16,128}$/
const SESSION_ID = /^session_[A-Za-z0-9_-]{12,80}$/
const SHA256 = /^[0-9a-f]{64}$/
const TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?Z$/
const ERROR_STATUS = {
  BAD_REQUEST: 400,
  AUTHENTICATION_REQUIRED: 401,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  ORIGIN_INVALID: 403,
  IDEMPOTENCY_KEY_REUSED: 409,
  SOURCE_INTAKE_INVALID: 409,
  RESEARCH_WORK_CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const

type ErrorCode = keyof typeof ERROR_STATUS
type FetchPort = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type NativeSourceIntakeV19Completion = Readonly<{
  completionCommitId: string
  committedAt: string
  sourceIntakeReceipt: Readonly<{
    receiptId: string
    conversationId: string
    turnId: string
    sourceSessionId: string
    sourceOwnerBindingSha256: string
    sourceRequestSha256: string
    sourceAnswerSha256: string
    sourceBindingSha256: string
    answersSha256: string
  }>
  researchWorkIntent: Readonly<{
    researchWorkId: string
    sourceIntakeReceiptId: string
    state: 'QUEUED'
  }>
}>

export class NativeSourceIntakeV19Error extends Error {
  constructor(readonly code: ErrorCode | 'PROTOCOL_INVALID' | 'TRANSPORT_INTERRUPTED', readonly status = 0) {
    super(code)
    this.name = 'NativeSourceIntakeV19Error'
  }
}

export type NativeSourceIntakeV19AdapterOptions = Readonly<{
  fetch?: FetchPort
  origin?: string
  csrfToken: () => string | null
}>

const record = (value: unknown): value is Record<string, unknown> => Boolean(value)
  && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => record(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',')
const token = (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= 512
  && !/[\u0000-\u001f\u007f-\u009f]/.test(value)
const mediaType = (response: Response) => response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
const noStore = (response: Response) => response.headers.get('cache-control')?.split(',').some(value => value.trim().toLowerCase() === 'no-store') === true

function assertId(value: string) {
  if (!ID.test(value)) throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
}

function assertTarget(path: string, origin: string) {
  const url = new URL(path, origin)
  if (url.origin !== origin || !url.pathname.startsWith('/api/v19/consultation/') || url.search || url.hash
    || new TextEncoder().encode(url.pathname).length > MAX_TARGET_BYTES) {
    throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  }
  return url
}

async function boundedText(response: Response): Promise<string> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) {
    throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  }
  if (response.body === null) throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, text = '', complete = false
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try { chunk = await reader.read() }
      catch { throw new NativeSourceIntakeV19Error('TRANSPORT_INTERRUPTED') }
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > MAX_RESPONSE_BYTES) throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
      try { text += decoder.decode(chunk.value, { stream: true }) }
      catch { throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID') }
    }
    try { text += decoder.decode() }
    catch { throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID') }
    complete = true
    return text
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function strictJson(text: string): unknown {
  try { return strictParseApiV13(text) }
  catch { throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID') }
}

function validateAnswers(answers: readonly SourceIntakeAnswer[]) {
  const intake = readSourceIntake({ answers })
  if (!intake || intake.answers.length !== 5) throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  return intake.answers.map(answer => Object.freeze({ ...answer })) as [SourceIntakeAnswer, SourceIntakeAnswer, SourceIntakeAnswer, SourceIntakeAnswer, SourceIntakeAnswer]
}

function validReceipt(value: unknown): value is NativeSourceIntakeV19Completion['sourceIntakeReceipt'] {
  if (!exact(value, ['receiptId', 'conversationId', 'turnId', 'sourceSessionId', 'sourceOwnerBindingSha256', 'sourceRequestSha256', 'sourceAnswerSha256', 'sourceBindingSha256', 'answersSha256'])) return false
  return ID.test(String(value.receiptId)) && ID.test(String(value.conversationId)) && ID.test(String(value.turnId))
    && SESSION_ID.test(String(value.sourceSessionId))
    && ['sourceOwnerBindingSha256', 'sourceRequestSha256', 'sourceAnswerSha256', 'sourceBindingSha256', 'answersSha256']
      .every(key => SHA256.test(String(value[key])))
}

function validWork(value: unknown): value is NativeSourceIntakeV19Completion['researchWorkIntent'] {
  return exact(value, ['researchWorkId', 'sourceIntakeReceiptId', 'state'])
    && ID.test(String(value.researchWorkId)) && ID.test(String(value.sourceIntakeReceiptId)) && value.state === 'QUEUED'
}

function completion(value: unknown, conversationId: string, turnId: string): NativeSourceIntakeV19Completion {
  if (!exact(value, ['apiContractVersion', 'data']) || value.apiContractVersion !== API_VERSION
    || !exact(value.data, ['completionCommitId', 'committedAt', 'sourceIntakeReceipt', 'researchWorkIntent'])) {
    throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  }
  const data = value.data
  if (typeof data.completionCommitId !== 'string' || !ID.test(data.completionCommitId) || typeof data.committedAt !== 'string'
    || !TIMESTAMP.test(data.committedAt) || !Number.isFinite(Date.parse(data.committedAt))
    || !validReceipt(data.sourceIntakeReceipt) || !validWork(data.researchWorkIntent)
    || data.sourceIntakeReceipt.conversationId !== conversationId || data.sourceIntakeReceipt.turnId !== turnId
    || data.researchWorkIntent.sourceIntakeReceiptId !== data.sourceIntakeReceipt.receiptId) {
    throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  }
  return Object.freeze({
    completionCommitId: data.completionCommitId,
    committedAt: data.committedAt,
    sourceIntakeReceipt: Object.freeze({ ...data.sourceIntakeReceipt }),
    researchWorkIntent: Object.freeze({ ...data.researchWorkIntent }),
  })
}

function errorEnvelope(value: unknown, status: number): NativeSourceIntakeV19Error {
  if (!exact(value, ['apiContractVersion', 'error']) || value.apiContractVersion !== API_VERSION
    || !exact(value.error, ['code', 'message'])) throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  const code = value.error.code
  if (typeof code !== 'string' || !(code in ERROR_STATUS) || ERROR_STATUS[code as ErrorCode] !== status
    || typeof value.error.message !== 'string' || value.error.message.length < 1 || value.error.message.length > 256
    || /[\u0000-\u001f\u007f-\u009f]/.test(value.error.message)) {
    throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
  }
  return new NativeSourceIntakeV19Error(code as ErrorCode, status)
}

export class NativeSourceIntakeV19Adapter {
  private readonly fetchPort: FetchPort
  private readonly origin: string
  private readonly csrfToken: () => string | null

  constructor(options: NativeSourceIntakeV19AdapterOptions) {
    this.fetchPort = options.fetch ?? ((input, init) => window.fetch(input, init))
    this.origin = options.origin ?? window.location.origin
    this.csrfToken = options.csrfToken
  }

  async complete(conversationId: string, turnId: string, answers: readonly SourceIntakeAnswer[], idempotencyKey: string, signal?: AbortSignal) {
    assertId(conversationId); assertId(turnId); assertId(idempotencyKey)
    const csrf = this.csrfToken()
    if (!token(csrf)) throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
    const body = JSON.stringify({ apiContractVersion: API_VERSION, answers: validateAnswers(answers) })
    if (new TextEncoder().encode(body).length > MAX_REQUEST_BYTES) throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
    if (signal?.aborted) throw new NativeSourceIntakeV19Error('TRANSPORT_INTERRUPTED')
    const path = `/api/v19/consultation/conversations/${conversationId}/turns/${turnId}/source-intake-completions`
    let response: Response
    try {
      response = await this.fetchPort(assertTarget(path, this.origin), {
        method: 'POST', headers: { Accept: JSON_TYPE, 'Content-Type': JSON_TYPE, 'X-CSRF-Token': csrf, 'Idempotency-Key': idempotencyKey },
        body, credentials: 'same-origin', redirect: 'manual', cache: 'no-store', ...(signal === undefined ? {} : { signal }),
      })
    } catch {
      throw new NativeSourceIntakeV19Error('TRANSPORT_INTERRUPTED')
    }
    if (signal?.aborted) throw new NativeSourceIntakeV19Error('TRANSPORT_INTERRUPTED')
    if (!noStore(response) || mediaType(response) !== JSON_TYPE || response.status < 200 || response.status > 599
      || response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined)
      throw new NativeSourceIntakeV19Error('PROTOCOL_INVALID')
    }
    const value = strictJson(await boundedText(response))
    if (response.status !== 202) throw errorEnvelope(value, response.status)
    return completion(value, conversationId, turnId)
  }
}
