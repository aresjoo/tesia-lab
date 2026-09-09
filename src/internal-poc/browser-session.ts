import {
  ApiResponseError,
  TesiaApiClient,
  assertApiSuccessEnvelope,
  createSdk,
  type ApiCallResult,
  type ApiTransport,
  type SessionEnvelope,
  type TransportResponse,
} from './contracts/generated/api-v0.1/index.js'

export const BROWSER_SESSION_POLICY_COMMIT = 'ba11ef0a3b7d01a6c01706f9b80e8b748d0fb829'
const SESSION_PATH = '/api/v1/auth/session'
const CREATE_PATH = '/api/v1/anonymous-sessions'
const BODY_LIMIT = 65_536
const FETCH_LIMIT_MS = 5_000
const ENSURE_LIMIT_MS = 15_000
const STRONG_ETAG = /^"[A-Za-z0-9_-]{16,128}"$/

export type BrowserSessionResult =
  | {
      readonly kind: 'EXISTING_SESSION'
      readonly current: { readonly status: 200; readonly response: ApiCallResult<SessionEnvelope> }
      readonly cookieAttributesVerifiedInBrowser: false
    }
  | {
      readonly kind: 'BOOTSTRAP_CONFIRMED'
      readonly created: { readonly status: 201; readonly response: ApiCallResult<SessionEnvelope> }
      readonly current: { readonly status: 200; readonly response: ApiCallResult<SessionEnvelope> }
      readonly verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP'
      readonly cookieAttributesVerifiedInBrowser: false
    }

export type EnsureBrowserSession = () => Promise<BrowserSessionResult>

const unconfirmed = (): Error => new Error('BROWSER_SESSION_UNCONFIRMED')

// Parsed JSON and response snapshots only; no live Response, cookie or storage is retained.
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

const exactData = (candidate: unknown, validated: SessionEnvelope['data']): boolean => {
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) return false
  const entries = Object.entries(validated)
  const record = candidate as Readonly<Record<string, unknown>>
  return Object.keys(record).length === entries.length
    && entries.every(([key, value]) => Object.hasOwn(record, key) && record[key] === value)
}

// The generated GET validator already checked timestamp syntax/calendar validity.
const exactMicroseconds = (timestamp: string): bigint => {
  const fraction = /\.(\d{1,6})Z$/.exec(timestamp)?.[1] ?? ''
  return BigInt(Date.parse(`${timestamp.slice(0, 19)}Z`)) * 1_000n
    + BigInt(fraction.padEnd(6, '0'))
}

const assertUsable = (response: ApiCallResult<SessionEnvelope>): void => {
  const { data, meta } = response.body
  if (!['ANONYMOUS', 'AUTHENTICATED'].includes(data.state)
    || meta.resourceRevision !== data.revision) throw unconfirmed()
}

/** Closed factory: no caller URL/client/session/fetch/owner authority inputs. */
export function createBrowserSessionBootstrap(...unexpected: never[]): EnsureBrowserSession {
  if (unexpected.length !== 0) throw unconfirmed()
  const origin = window.location.origin
  if (!['http:', 'https:'].includes(window.location.protocol) || origin === 'null') throw unconfirmed()
  let postAttempted = false
  let inFlight: Promise<BrowserSessionResult> | undefined

  const run = async (): Promise<BrowserSessionResult> => {
    const deadline = performance.now() + ENSURE_LIMIT_MS
    const assertDeadline = () => {
      if (performance.now() >= deadline || window.location.origin !== origin) throw unconfirmed()
    }

    const request = async (path: string, method: 'GET' | 'POST'): Promise<TransportResponse> => {
      assertDeadline()
      if ((method === 'GET' && path !== SESSION_PATH) || (method === 'POST' && path !== CREATE_PATH)) {
        throw unconfirmed()
      }
      const url = new URL(path, origin)
      if (url.origin !== origin || url.search !== '' || url.hash !== '') throw unconfirmed()
      const controller = new AbortController()
      const timeoutMs = Math.min(FETCH_LIMIT_MS, deadline - performance.now())
      const requestDeadline = performance.now() + timeoutMs
      const timer = window.setTimeout(() => controller.abort(), timeoutMs)
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      try {
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (method === 'POST') {
          if (postAttempted) throw unconfirmed()
          headers['Idempotency-Key'] = crypto.randomUUID()
          postAttempted = true // Never reset, including response loss or timeout.
        }
        const response = await fetch(url.href, {
          method, headers, credentials: 'same-origin', cache: 'no-store',
          redirect: 'error', signal: controller.signal,
        })
        if (response.redirected || response.url !== url.href
          || response.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json'
          || response.body === null) throw unconfirmed()
        reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8', { fatal: true })
        let bytes = 0
        let text = ''
        for (;;) {
          const chunk = await reader.read()
          if (controller.signal.aborted || performance.now() >= requestDeadline) throw unconfirmed()
          assertDeadline()
          if (chunk.done) break
          bytes += chunk.value.byteLength
          if (bytes > BODY_LIMIT) throw unconfirmed()
          text += decoder.decode(chunk.value, { stream: true })
        }
        text += decoder.decode()
        const body: unknown = JSON.parse(text)
        const visibleHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => { visibleHeaders[key] = value })
        assertDeadline()
        if (performance.now() >= requestDeadline) throw unconfirmed()
        return freeze({ status: response.status, headers: visibleHeaders, body })
      } catch {
        throw unconfirmed() // Do not expose response/error payloads or transport details.
      } finally {
        window.clearTimeout(timer)
        controller.abort()
        if (reader !== undefined) {
          // Cancellation is requested, not awaited beyond the response deadline.
          void reader.cancel().catch(() => undefined)
          reader.releaseLock()
        }
      }
    }

    // Only this factory's real, bounded GET is passed through the unchanged SDK.
    const transport: ApiTransport = {
      request: async (path, init) => {
        if (path !== SESSION_PATH || init.method !== 'GET' || init.body !== undefined) throw unconfirmed()
        return request(SESSION_PATH, 'GET')
      },
      openEventStream: async () => { throw unconfirmed() },
    }
    const sdk = createSdk(new TesiaApiClient(transport))
    try {
      const current = await sdk.session.current()
      assertUsable(current)
      assertDeadline()
      return freeze({ kind: 'EXISTING_SESSION', current: { status: 200, response: current }, cookieAttributesVerifiedInBrowser: false })
    } catch (error) {
      if (!(error instanceof ApiResponseError) || error.status !== 401
        || error.envelope.error.code !== 'AUTHENTICATION_REQUIRED') throw unconfirmed()
    }
    if (postAttempted) throw unconfirmed()
    const created = await request(CREATE_PATH, 'POST')
    if (created.status !== 201) throw unconfirmed()
    assertApiSuccessEnvelope(created.body)
    const createdEtag = created.headers.etag
    if (createdEtag === undefined || !STRONG_ETAG.test(createdEtag)) throw unconfirmed()
    const current = await sdk.session.current()
    assertUsable(current)
    const posted = created.body as SessionEnvelope
    const { data } = current.body
    if (!exactData(posted.data, data) || data.state !== 'ANONYMOUS' || data.revision !== '1'
      || posted.meta.resourceRevision !== data.revision || createdEtag !== current.etag
      || exactMicroseconds(data.expiresAt) - exactMicroseconds(data.issuedAt) !== 86_400_000_000n) {
      throw unconfirmed()
    }
    assertDeadline()
    return freeze({
      kind: 'BOOTSTRAP_CONFIRMED',
      created: { status: 201, response: { body: posted, headers: created.headers, etag: createdEtag } },
      current: { status: 200, response: current },
      verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP', cookieAttributesVerifiedInBrowser: false,
    })
  }

  return (...args: never[]) => {
    if (args.length !== 0) return Promise.reject(unconfirmed())
    if (inFlight === undefined) {
      inFlight = run().catch(() => { throw unconfirmed() }).finally(() => { inFlight = undefined })
    }
    return inFlight
  }
}
