import { ApiV04ResponseError, BrowserAuthError, createAppleBrowserAuthPort, createGoogleBrowserAuthPort, type BrowserAuthTransport, type GoogleAuthResultEnvelope, type VersionedMutationContext } from './contracts/generated/browser-auth-v0.1/index'
import { createSdk, TesiaApiClient, type ApiTransport } from './contracts/generated/api-v0.1/index'

export type NativeAuthProvider = 'GOOGLE' | 'APPLE'
export const BROWSER_AUTH_PACKAGE_SHA256 = '4186ec2abf02a9e480d61fb4aa6d29868754f1491e02d4faaf34aa664dcd05dd'
export type NativeAuthenticated = {
  readonly provider: NativeAuthProvider
  readonly sessionId: string
  readonly sessionEtag: string
  readonly csrfToken: string
  readonly claimIntent: { readonly initiatingSessionId: string; readonly expectedSessionRevision: string; readonly initiatingSessionEtag?: string }
  readonly verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP'
}
export type NativeSessionRecovery = {
  readonly verification: 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED'
  readonly sessionId: string
  readonly csrfToken: string
  readonly claimIntent?: NativeAuthenticated['claimIntent']
}
export class NativeAuthError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'NativeAuthError' }
}
function fail(code = 'AUTH_RESPONSE_UNCONFIRMED'): never { throw new NativeAuthError(code) }
const CLAIM_PRECONDITION_KEY = 'tesia.native.auth-claim-precondition'
type ClaimPrecondition = { provider: NativeAuthProvider; sessionId: string; revision: string; etag: string }
function readClaimPrecondition(): ClaimPrecondition | null {
  try {
    const raw = sessionStorage.getItem(CLAIM_PRECONDITION_KEY)
    if (!raw || raw.length > 4096) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (Object.keys(record).sort().join(',') !== 'etag,provider,revision,sessionId'
      || !['GOOGLE', 'APPLE'].includes(String(record.provider)) || typeof record.sessionId !== 'string' || typeof record.revision !== 'string'
      || typeof record.etag !== 'string' || !/^"[A-Za-z0-9_-]{16,128}"$/.test(record.etag)) return null
    return record as ClaimPrecondition
  } catch { return null }
}
function rememberClaimPrecondition(value: ClaimPrecondition): void {
  // Non-secret observed precondition only, never CSRF, cookies or OAuth data.
  // Storage is optional for login, but unavailable storage means a fresh page
  // cannot offer claim unless it can recover this exact observed precondition.
  try { sessionStorage.setItem(CLAIM_PRECONDITION_KEY, JSON.stringify(value)) } catch { /* login remains available */ }
}
const safeFailure = (error: unknown) => {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
  return new NativeAuthError(typeof code === 'string' && [
    'AUTH_RESULT_NOT_READY', 'AUTH_RESULT_EXPIRED', 'AUTH_TRANSACTION_CONFLICT', 'AUTH_TRANSACTION_EXPIRED',
    'AUTH_BINDING_CONFLICT', 'AUTHENTICATION_REQUIRED', 'NOT_FOUND', 'AUTH_FLOW_BUSY', 'AUTH_PROVIDER_MISMATCH',
    'AUTH_RESTART_NOT_CONFIRMED', 'AUTH_SESSION_ALREADY_AUTHENTICATED',
  ].includes(code) ? code : 'AUTH_RESPONSE_UNCONFIRMED')
}

/** Real same-origin cookie transport. Only these named browser-visible operations
 * exist here; callbacks, claim, cookies, provider credentials and URLs are not inputs. */
async function request(path: string, method: 'GET' | 'POST', headers: Readonly<Record<string, string>>) {
  const origin = window.location.origin, url = new URL(path, origin)
  const allowed = method === 'GET'
    ? /^\/api\/(?:v1\/auth\/(?:session|csrf)|v2\/auth\/google\/results\/current|v4\/auth\/apple\/results\/current)$/
    : /^\/api\/(?:v2\/auth\/google|v4\/auth\/apple)\/(?:transactions|results\/[A-Za-z0-9_-]+\/acknowledgements)$/
  if (url.origin !== origin || url.pathname !== path || url.search || url.hash || url.username || url.password
    || !allowed.test(path) || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) fail()
  for (const name of Object.keys(headers)) if (!['accept', 'x-csrf-token', 'idempotency-key', 'if-match'].includes(name.toLowerCase())) fail()
  const controller = new AbortController(), timer = window.setTimeout(() => controller.abort(), 15_000)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(url.href, { method, headers, credentials: 'include', redirect: 'manual', cache: 'no-store', signal: controller.signal })
    if (response.redirected || response.type === 'opaqueredirect' || response.url !== url.href || response.body === null
      || response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') fail()
    reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let text = '', size = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (controller.signal.aborted) fail()
      if (done) break
      size += value.byteLength
      if (size > 65_536) fail()
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
    const visible: Record<string, string> = {}
    for (const name of ['cache-control', 'etag']) { const value = response.headers.get(name); if (value !== null) visible[name] = value }
    return { status: response.status, headers: visible, body: JSON.parse(text) as unknown }
  } finally {
    window.clearTimeout(timer); controller.abort()
    if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock() }
  }
}

export function createNativeBrowserAuth() {
  const transport: BrowserAuthTransport = { async request(input) {
    if (input.credentials !== 'include' || input.redirect !== 'manual' || 'body' in input || 'query' in input) fail()
    return request(input.path, input.method, input.headers)
  } }
  const sessionTransport: ApiTransport = {
    async request(path, input) {
      if (input.method !== 'GET' || input.body !== undefined || !['/api/v1/auth/session', '/api/v1/auth/csrf'].includes(path)) fail()
      return request(path, 'GET', input.headers)
    },
    openEventStream: async () => fail(),
  }
  const session = createSdk(new TesiaApiClient(sessionTransport)).session
  const ports = { GOOGLE: createGoogleBrowserAuthPort(transport), APPLE: createAppleBrowserAuthPort(transport) }
  let busy = false
  let selected: NativeAuthProvider | null = null
  let startContext: VersionedMutationContext | null = null
  let initiatingSessionId: string | null = null
  let initiatingPrecondition: ClaimPrecondition | null = null
  let transactionId: string | null = null
  let ready: { data: Extract<GoogleAuthResultEnvelope['data'], { status: 'READY_FOR_ACK' }>; context: VersionedMutationContext } | null = null
  let acknowledged: Awaited<ReturnType<typeof ports.GOOGLE.acknowledgeResult>>['body']['data'] | null = null
  let terminal = false
  let acknowledgementUnconfirmed = false
  const serverExpired = (error: unknown) => (error instanceof BrowserAuthError || error instanceof ApiV04ResponseError)
    && error.status === 410 && ['AUTH_TRANSACTION_EXPIRED', 'AUTH_RESULT_EXPIRED'].includes(error.code)
  const serverCall = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation() } catch (error) {
      // Only a validated server response establishes expiry. Local time, lost
      // responses, 404s and ambiguous ACKs never permit a replacement mutation.
      if (serverExpired(error) && !acknowledgementUnconfirmed && !acknowledged) terminal = true
      throw error
    }
  }
  const sendStart = async (provider: NativeAuthProvider) => {
    if (!startContext) fail('AUTH_RESTART_NOT_CONFIRMED')
    const response = await serverCall<Awaited<ReturnType<(typeof ports)[NativeAuthProvider]['createTransaction']>>>(() => ports[provider].createTransaction(startContext!))
    if (Date.parse(response.body.data.expiresAt) <= Date.now()) fail('AUTH_TRANSACTION_EXPIRED')
    if (transactionId !== null && transactionId !== response.body.data.transactionId) fail('AUTH_BINDING_CONFLICT')
    transactionId = response.body.data.transactionId
    return { provider, authorizationRedirect: response.body.data.authorizationRedirect }
  }
  const run = async <T>(provider: NativeAuthProvider, operation: () => Promise<T>): Promise<T> => {
    if (provider !== 'GOOGLE' && provider !== 'APPLE') fail('AUTH_PROVIDER_MISMATCH')
    if (selected !== null && selected !== provider) fail('AUTH_PROVIDER_MISMATCH')
    if (busy) fail('AUTH_FLOW_BUSY')
    selected = provider; busy = true
    try { return await operation() } catch (error) { throw safeFailure(error) } finally { busy = false }
  }
  return {
    hasMemoryIntent: () => startContext !== null || ready !== null || acknowledged !== null,
    canResumeStart: () => startContext !== null && !terminal && !acknowledgementUnconfirmed && !acknowledged,
    canResumeAcknowledgement: () => acknowledgementUnconfirmed || acknowledged !== null,
    canResumeResult: () => transactionId !== null || ready !== null,
    resumeStart(provider: NativeAuthProvider) { return run(provider, async () => {
      // A retained panel may replay only a context already created in memory.
      // The hosted START endpoint validates the cookie/CSRF/owner binding even
      // while the public session GET intentionally rejects HANDOFF_BOUND.
      if (!startContext || acknowledgementUnconfirmed || acknowledged) fail('AUTH_RESTART_NOT_CONFIRMED')
      return sendStart(provider)
    }) },
    canRestart: () => terminal && !acknowledgementUnconfirmed && !acknowledged,
    restart(provider: NativeAuthProvider) { return run(provider, async () => {
      if (!terminal || acknowledgementUnconfirmed || acknowledged) fail('AUTH_RESTART_NOT_CONFIRMED')
      // A persisted precondition is an untrusted locator for a returned page,
      // never authority. Current server observations and the POST decide.
      const previous = initiatingPrecondition ?? readClaimPrecondition()
      const current = await session.current()
      if (current.body.data.state === 'AUTHENTICATED') fail('AUTH_SESSION_ALREADY_AUTHENTICATED')
      if (!previous || previous.provider !== provider || current.body.data.state !== 'ANONYMOUS'
        || current.body.data.sessionId !== previous.sessionId || typeof current.etag !== 'string') fail('AUTH_BINDING_CONFLICT')
      const csrf = await session.csrf(), confirmed = await session.current()
      if (confirmed.body.data.state !== 'ANONYMOUS' || confirmed.body.data.sessionId !== current.body.data.sessionId
        || confirmed.body.data.revision !== current.body.data.revision || confirmed.etag !== current.etag) fail('AUTH_BINDING_CONFLICT')
      initiatingSessionId = current.body.data.sessionId
      initiatingPrecondition = { provider, sessionId: current.body.data.sessionId, revision: current.body.data.revision, etag: current.etag }
      rememberClaimPrecondition(initiatingPrecondition)
      // This explicit action is the sole replacement-key boundary. A lost new
      // START response must retry this new context, not mint another one.
      startContext = { csrfToken: csrf.body.data.csrfToken, idempotencyKey: crypto.randomUUID(), ifMatch: current.etag }
      terminal = false; transactionId = null; ready = null
      return sendStart(provider)
    }) },
    recoverSession(provider: NativeAuthProvider): Promise<NativeSessionRecovery> { return run(provider, async () => {
      // Headers may have installed an authenticated cookie even when an ACK
      // body was lost. This proves only the present session, never provider or
      // handoff success. The existing claim endpoint remains the authority.
      const current = await session.current()
      if (current.body.data.state !== 'AUTHENTICATED') fail('AUTHENTICATION_REQUIRED')
      const csrf = await session.csrf()
      const saved = initiatingPrecondition ?? readClaimPrecondition()
      const usable = saved?.provider === provider && saved.sessionId !== current.body.data.sessionId
      return { verification: 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED', sessionId: current.body.data.sessionId, csrfToken: csrf.body.data.csrfToken,
        ...(usable ? { claimIntent: { initiatingSessionId: saved.sessionId, expectedSessionRevision: saved.revision, initiatingSessionEtag: saved.etag } } : {}) }
    }) },
    start(provider: NativeAuthProvider) { return run(provider, async () => {
      if (!startContext) {
        const current = await session.current(), csrf = await session.csrf()
        if (current.body.data.state !== 'ANONYMOUS' || typeof current.etag !== 'string') fail('AUTH_BINDING_CONFLICT')
        initiatingSessionId = current.body.data.sessionId
        initiatingPrecondition = { provider, sessionId: current.body.data.sessionId, revision: current.body.data.revision, etag: current.etag }
        rememberClaimPrecondition(initiatingPrecondition)
        startContext = { csrfToken: csrf.body.data.csrfToken, idempotencyKey: crypto.randomUUID(), ifMatch: current.etag }
      }
      return sendStart(provider)
    }) },
    readResult(provider: NativeAuthProvider) { return run(provider, async () => {
      const response = await serverCall<Awaited<ReturnType<(typeof ports)[NativeAuthProvider]['getCurrentResult']>>>(() => ports[provider].getCurrentResult()), data = response.body.data
      if (transactionId !== null && data.transactionId !== transactionId) fail('AUTH_BINDING_CONFLICT')
      if (Date.parse(data.expiresAt) <= Date.now()) fail('AUTH_RESULT_EXPIRED')
      if (data.status !== 'READY_FOR_ACK') {
        if (!acknowledgementUnconfirmed && !acknowledged) terminal = true
        ready = null; return { status: data.status }
      }
      if (ready && ready.data.resultId !== data.resultId) fail('AUTH_BINDING_CONFLICT')
      const etag = response.headers.ETag
      if (typeof etag !== 'string') fail()
      ready ??= { data, context: { csrfToken: data.acknowledgementCsrfToken, idempotencyKey: crypto.randomUUID(), ifMatch: etag } }
      return { status: data.status }
    }) },
    acknowledge(provider: NativeAuthProvider): Promise<NativeAuthenticated> { return run(provider, async () => {
      if (!ready) fail('AUTH_RESULT_NOT_READY')
      if (!acknowledged) {
        if (Date.parse(ready.data.expiresAt) <= Date.now()) fail('AUTH_RESULT_EXPIRED')
        acknowledgementUnconfirmed = true
        try {
          acknowledged = (await ports[provider].acknowledgeResult(ready.data.resultId, ready.context)).body.data
          acknowledgementUnconfirmed = false
        } catch (error) {
          if (serverExpired(error)) { acknowledgementUnconfirmed = false; terminal = true }
          throw error
        }
      }
      const data = acknowledged
      if (data.resultId !== ready.data.resultId || data.transactionId !== ready.data.transactionId
        || initiatingSessionId !== null && data.handoffReservation.initiatingSessionId !== initiatingSessionId) fail('AUTH_BINDING_CONFLICT')
      // Ack is not session proof. Never bootstrap/create another anonymous session here.
      const current = await session.current()
      if (current.body.data.state !== 'AUTHENTICATED' || current.body.data.sessionId !== data.session.sessionId || typeof current.etag !== 'string') fail('AUTH_BINDING_CONFLICT')
      const csrf = await session.csrf()
      const saved = initiatingPrecondition ?? readClaimPrecondition()
      const initiatingSessionEtag = saved?.provider === provider && saved.sessionId === data.handoffReservation.initiatingSessionId
        && saved.revision === data.handoffReservation.initiatingSessionRevision ? saved.etag : undefined
      return { provider, sessionId: current.body.data.sessionId, sessionEtag: current.etag, csrfToken: csrf.body.data.csrfToken,
        claimIntent: { initiatingSessionId: data.handoffReservation.initiatingSessionId, expectedSessionRevision: data.handoffReservation.initiatingSessionRevision,
          ...(initiatingSessionEtag ? { initiatingSessionEtag } : {}) },
        verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP' }
    }) },
  }
}
