import { ApiResponseError, createSdk, TesiaApiClient, type ApiTransport } from './contracts/generated/api-v0.1/index'
import { ApiV09Error, TesiaEmailAuthV09Client, type VersionedMutationContext } from './contracts/generated/api-v0.9/client'
import type { EmailChallengeData, EmailVerificationData } from './contracts/generated/api-v0.9/types'
import type { NativeSessionRecovery } from './native-browser-auth'

export const EMAIL_AUTH_PACKAGE_SHA256 = '98b7c8d74fa25e4ba33afd663287b2d7423860eff4b77805c4025bb138f2d699'
type ClaimIntent = { initiatingSessionId: string; expectedSessionRevision: string; initiatingSessionEtag: string }
export type NativeEmailAuthenticated = { verification: 'EMAIL_CODE_COOKIE_BOUND_SESSION_ROUND_TRIP'; sessionId: string; sessionEtag: string; csrfToken: string; claimIntent: ClaimIntent }
type Locator = ClaimIntent & { version: 1; kind: 'CREATE' | 'VERIFY'; idempotencyKey: string; challengeId?: string }
type Intent = { kind: 'CREATE'; body: { email: string }; context: VersionedMutationContext } | { kind: 'VERIFY'; body: { code: string }; context: VersionedMutationContext; challengeId: string }
const LOCATOR_KEY = 'tesia.native.email-intent'
function fail(code = 'AUTH_RESPONSE_UNCONFIRMED'): never { throw new ApiV09Error(0, code) }
function readLocator(): Locator | null {
  try {
    const raw = sessionStorage.getItem(LOCATOR_KEY)
    if (!raw || raw.length > 2048) return null
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some(key => !['version', 'kind', 'idempotencyKey', 'challengeId', 'initiatingSessionId', 'expectedSessionRevision', 'initiatingSessionEtag'].includes(key))
      || value.version !== 1 || !['CREATE', 'VERIFY'].includes(value.kind)
      || typeof value.initiatingSessionId !== 'string' || !/^session_[A-Za-z0-9_-]{12,80}$/.test(value.initiatingSessionId)
      || typeof value.expectedSessionRevision !== 'string' || !/^[0-9]{1,20}$/.test(value.expectedSessionRevision)
      || typeof value.initiatingSessionEtag !== 'string' || !/^"[A-Za-z0-9_-]{16,128}"$/.test(value.initiatingSessionEtag)
      || typeof value.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value.idempotencyKey)
      || value.challengeId !== undefined && (typeof value.challengeId !== 'string' || !/^email_challenge_[A-Za-z0-9_-]{12,80}$/.test(value.challengeId))) return null
    return value as Locator // A private locator, never a server authentication receipt.
  } catch { return null }
}
export function hasStoredNativeEmailIntent(): boolean {
  // Presence can prohibit bootstrap; it cannot prove a session or a handoff.
  // Storage read failures also must not silently create a replacement session.
  return sessionStorage.getItem(LOCATOR_KEY) !== null
}
export function forgetNativeEmailLocator(initiatingSessionId?: string): void {
  // Explicit logout invalidates local recovery only; no server request is cancelled.
  try { if (!initiatingSessionId || readLocator()?.initiatingSessionId === initiatingSessionId) sessionStorage.removeItem(LOCATOR_KEY) } catch { /* No storage authority. */ }
}
function rememberLocator(value: Locator): boolean {
  try {
    const raw = JSON.stringify(value)
    sessionStorage.setItem(LOCATOR_KEY, raw)
    return sessionStorage.getItem(LOCATOR_KEY) === raw
  } catch { return false }
}
async function request(path: string, method: 'GET' | 'POST', headers: Readonly<Record<string, string>>, body?: string) {
  const url = new URL(path, window.location.origin)
  const allowed = method === 'GET' ? /^\/api\/v1\/auth\/(session|csrf)$/
    : /^\/api\/v9\/auth\/email\/challenges(?:\/email_challenge_[A-Za-z0-9_-]{12,80}\/verifications)?$/
  if (url.origin !== window.location.origin || url.pathname !== path || url.search || url.hash || url.username || url.password || !allowed.test(path)
    || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) fail()
  if (Object.keys(headers).some(name => !['accept', 'content-type', 'x-csrf-token', 'if-match', 'idempotency-key'].includes(name.toLowerCase()))) fail()
  const controller = new AbortController(), timeout = window.setTimeout(() => controller.abort(), 15_000)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch(url.href, { method, headers, body, credentials: 'include', redirect: 'manual', cache: 'no-store', signal: controller.signal })
    if (response.redirected || response.type === 'opaqueredirect' || response.url !== url.href || response.body === null
      || response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') fail()
    reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8', { fatal: true })
    let text = '', bytes = 0
    for (;;) {
      const next = await reader.read()
      if (controller.signal.aborted) fail()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > 65_536) fail()
      text += decoder.decode(next.value, { stream: true })
    }
    text += decoder.decode()
    const visible: Record<string, string> = {}
    for (const name of ['cache-control', 'etag']) { const value = response.headers.get(name); if (value !== null) visible[name] = value }
    return { status: response.status, headers: visible, body: text }
  } finally {
    window.clearTimeout(timeout); controller.abort()
    if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock() }
  }
}

export function createNativeEmailAuth(options: { isCurrent: () => boolean; expectedSessionId?: string }) {
  let disposed = false, busy = false, storageAvailable = true
  let initiating: ClaimIntent | null = null, pending: Intent | null = null, challenge: EmailChallengeData | null = null
  let originalContext: VersionedMutationContext | null = null, verified: EmailVerificationData | null = null, verifiedEtag: string | null = null
  const assertCurrent = () => { if (disposed || !options.isCurrent()) fail('AUTH_BINDING_CONFLICT') }
  const transport: ApiTransport = { async request(path, input) {
    assertCurrent()
    if (input.method !== 'GET' || input.body !== undefined) fail()
    const response = await request(path, 'GET', input.headers); assertCurrent()
    return { ...response, body: JSON.parse(response.body) as unknown }
  }, openEventStream: async () => fail() }
  const session = createSdk(new TesiaApiClient(transport)).session
  const email = new TesiaEmailAuthV09Client({ async request(input) {
    assertCurrent()
    if (input.method !== 'POST' || input.credentials !== 'include' || input.redirect !== 'manual' || input.cache !== 'no-store') fail()
    const result = await request(input.path, 'POST', input.headers, input.body); assertCurrent(); return result
  } })
  const run = async <T>(operation: () => Promise<T>) => {
    assertCurrent(); if (busy) fail('AUTH_FLOW_BUSY'); busy = true
    try { const value = await operation(); assertCurrent(); return value } finally { busy = false }
  }
  const remember = () => {
    if (!initiating || !pending) return
    storageAvailable = rememberLocator({ version: 1, ...initiating, kind: pending.kind, idempotencyKey: pending.context.idempotencyKey,
      ...(pending.kind === 'VERIFY' ? { challengeId: pending.challengeId } : challenge ? { challengeId: challenge.challengeId } : {}) })
  }
  const sameSession = (a: Awaited<ReturnType<typeof session.current>>, b: Awaited<ReturnType<typeof session.current>>) => a.etag === b.etag
    && a.body.data.sessionId === b.body.data.sessionId && a.body.data.state === b.body.data.state && a.body.data.revision === b.body.data.revision
  const currentAnonymous = async () => {
    const current = await session.current(), original = initiating ?? readLocator()
    if (current.body.data.state !== 'ANONYMOUS' || !current.etag || Date.parse(current.body.data.expiresAt) <= Date.now()
      || options.expectedSessionId && current.body.data.sessionId !== options.expectedSessionId
      || original && current.body.data.sessionId !== original.initiatingSessionId) fail('AUTH_BINDING_CONFLICT')
    return current
  }
  const confirmAuthenticated = async (): Promise<NativeEmailAuthenticated> => {
    if (!verified || !initiating) fail()
    const receipt = verified!, intent = initiating!, current = await session.current()
    if (current.body.data.state !== 'AUTHENTICATED' || current.body.data.sessionId !== receipt.session.sessionId
      || current.body.data.revision !== receipt.session.revision || current.body.data.issuedAt !== receipt.session.issuedAt
      || current.body.data.expiresAt !== receipt.session.expiresAt || current.etag !== verifiedEtag) fail('AUTH_BINDING_CONFLICT')
    const csrf = await session.csrf(), final = await session.current()
    if (!sameSession(current, final) || Date.parse(final.body.data.expiresAt) <= Date.now()) fail('AUTH_BINDING_CONFLICT')
    return { verification: 'EMAIL_CODE_COOKIE_BOUND_SESSION_ROUND_TRIP', sessionId: current.body.data.sessionId, sessionEtag: current.etag!, csrfToken: csrf.body.data.csrfToken, claimIntent: intent }
  }
  const sendPending = async () => {
    if (!pending || !initiating) fail('AUTH_MEMORY_INTENT_REQUIRED')
    const requestIntent = pending!, original = initiating!
    try {
      if (requestIntent.kind === 'CREATE') {
        const result = (await email.createChallenge(requestIntent.context, requestIntent.body)).body.data
        if (result.initiatingSessionId !== original.initiatingSessionId || result.initiatingSessionRevision !== original.expectedSessionRevision
          || result.initiatingSessionEtag !== original.initiatingSessionEtag || challenge && result.challengeId !== challenge.challengeId) fail('AUTH_BINDING_CONFLICT')
        challenge = result; remember(); pending = null
        return result
      }
      const response = await email.verifyChallenge(requestIntent.challengeId, requestIntent.context, requestIntent.body)
      const result = response.body.data
      const handoff = result.handoffReservation
      if (handoff.initiatingSessionId !== original.initiatingSessionId || handoff.initiatingSessionRevision !== original.expectedSessionRevision
        || handoff.initiatingSessionEtag !== original.initiatingSessionEtag || result.challengeId !== challenge?.challengeId
        || result.challengeExpiresAt !== challenge.expiresAt) fail('AUTH_BINDING_CONFLICT')
      verified = result; verifiedEtag = response.headers.ETag; pending = null
      return await confirmAuthenticated()
    } catch (error) {
      // Definite rejection permits a later explicit corrected/new request, never
      // automatic retry. Unknown response/owner/key conflicts retain the intent.
      if (error instanceof ApiV09Error && (
        error.status === 0 && error.code === 'INVALID_OPERATION_INPUT'
        || requestIntent.kind === 'VERIFY' && (error.status === 400 && error.code === 'CODE_INVALID' || error.status === 410 && error.code === 'CHALLENGE_EXPIRED')
        || requestIntent.kind === 'CREATE' && (error.status === 400 && error.code === 'BAD_REQUEST' || error.status === 503 && error.code === 'MAIL_DISABLED' || error.status === 429 && error.code === 'RATE_LIMITED')
      )) pending = null
      throw error
    }
  }
  return {
    dispose() { disposed = true; pending = null; originalContext = null; verified = null; verifiedEtag = null; challenge = null; initiating = null },
    hasMemoryIntent: () => pending !== null || originalContext !== null || verified !== null,
    hasPending: () => pending !== null,
    hasLocator: () => readLocator() !== null,
    storageAvailable: () => storageAvailable,
    prepareNewRequest() { return run(async () => {
      if (pending || verified) fail('AUTH_MEMORY_INTENT_REQUIRED')
      // A fresh ANON observation only: no CSRF rotation, locator rewrite or POST.
      await currentAnonymous()
    }) },
    requestCode(address: string) { return run(async () => {
      if (pending || verified) fail('AUTH_MEMORY_INTENT_REQUIRED')
      const current = await currentAnonymous()
      const csrf = await session.csrf(), final = await session.current()
      if (!sameSession(current, final)) fail('AUTH_BINDING_CONFLICT')
      initiating = { initiatingSessionId: current.body.data.sessionId, expectedSessionRevision: current.body.data.revision, initiatingSessionEtag: current.etag! }
      originalContext = { csrfToken: csrf.body.data.csrfToken, ifMatch: current.etag!, idempotencyKey: `email_create_${crypto.randomUUID()}` }
      challenge = null
      pending = { kind: 'CREATE', context: originalContext, body: { email: address } }; remember()
      return sendPending()
    }) },
    verifyCode(code: string) { return run(async () => {
      if (pending) fail('AUTH_MEMORY_INTENT_REQUIRED')
      if (verified) return confirmAuthenticated()
      if (!challenge || !originalContext) fail('AUTH_MEMORY_INTENT_REQUIRED')
      pending = { kind: 'VERIFY', challengeId: challenge!.challengeId, context: { ...originalContext!, idempotencyKey: `email_verify_${crypto.randomUUID()}` }, body: { code } }; remember()
      return await sendPending() as NativeEmailAuthenticated
    }) },
    retryPending() { return run(async () => verified ? confirmAuthenticated() : sendPending()) },
    recoverSession() { return run(async (): Promise<NativeSessionRecovery> => {
      const current = await session.current().catch(error => {
        if (error instanceof ApiResponseError && error.status === 401 && error.envelope.error.code === 'AUTHENTICATION_REQUIRED') fail('AUTH_SESSION_UNAVAILABLE')
        throw error
      })
      if (!initiating && options.expectedSessionId && current.body.data.sessionId !== options.expectedSessionId
        || initiating && current.body.data.state === 'ANONYMOUS' && current.body.data.sessionId !== initiating.initiatingSessionId) fail('AUTH_BINDING_CONFLICT')
      if (current.body.data.state !== 'AUTHENTICATED' || !current.etag) fail('AUTH_MEMORY_INTENT_REQUIRED')
      if (verified && current.body.data.sessionId !== verified.session.sessionId) fail('AUTH_BINDING_CONFLICT')
      const csrf = await session.csrf(), final = await session.current()
      if (!sameSession(current, final) || Date.parse(final.body.data.expiresAt) <= Date.now()) fail('AUTH_BINDING_CONFLICT')
      const locator = initiating ?? readLocator()
      const claimIntent = locator && locator.initiatingSessionId !== current.body.data.sessionId ? {
        initiatingSessionId: locator.initiatingSessionId, expectedSessionRevision: locator.expectedSessionRevision, initiatingSessionEtag: locator.initiatingSessionEtag,
      } : undefined
      return { verification: 'SESSION_CONFIRMED_HANDOFF_UNVERIFIED', sessionId: current.body.data.sessionId, csrfToken: csrf.body.data.csrfToken, ...(claimIntent ? { claimIntent } : {}) }
    }) },
  }
}
