import {
  TesiaApiClient,
  createSdk,
  type ApiTransport,
  type ClientSecurityOptions,
  type EventStreamTransportResponse,
  type TransportResponse,
  type TrustedVerifierAuthority,
} from './contracts/generated/api-v0.1/index.js'
import type { InternalPocAdapter } from './adapter'
import { createBrowserSessionBootstrap } from './browser-session'

const SHA256 = /^[0-9a-f]{64}$/
const OWNER_LOCAL_LOOPBACK_HOST = '127.0.0.1'

// This is an enablement attestation, not a transport base URL. All API calls
// remain bound to window.location.origin by SameOriginApiTransport.
const isCurrentOwnerLocalLoopbackUrl = (value: string): boolean => {
  try {
    const configured = new URL(value)
    return configured.protocol === 'http:'
      && configured.hostname === OWNER_LOCAL_LOOPBACK_HOST
      && configured.username === ''
      && configured.password === ''
      && configured.pathname === '/'
      && configured.search === ''
      && configured.hash === ''
      && window.location.protocol === 'http:'
      && window.location.hostname === OWNER_LOCAL_LOOPBACK_HOST
      && configured.origin === window.location.origin
  } catch {
    return false
  }
}

const assertApiPath = (url: string): void => {
  const parsed = new URL(url, window.location.origin)
  if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith('/api/v1/')) {
    throw new Error('INTERNAL_POC_SAME_ORIGIN_API_REQUIRED')
  }
}

const responseHeaders = (headers: Headers): Readonly<Record<string, string>> => {
  const result: Record<string, string> = {}
  headers.forEach((value, key) => { result[key] = value })
  return result
}

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204 || response.status === 303) return null
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new Error('INTERNAL_POC_JSON_RESPONSE_REQUIRED')
  return response.json()
}

async function* decodeSseBody(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffered = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffered += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
      let boundary = buffered.indexOf('\n\n')
      while (boundary >= 0) {
        yield buffered.slice(0, boundary + 2)
        buffered = buffered.slice(boundary + 2)
        boundary = buffered.indexOf('\n\n')
      }
    }
    buffered += decoder.decode()
    if (buffered.length > 0) throw new Error('INTERNAL_POC_INCOMPLETE_SSE_FRAME')
  } finally {
    reader.releaseLock()
  }
}

export class SameOriginApiTransport implements ApiTransport {
  async request(
    url: string,
    init: Readonly<{ method: string; headers: Readonly<Record<string, string>>; body?: string }>,
  ): Promise<TransportResponse> {
    assertApiPath(url)
    // A bounded browser wait does not cancel the server operation. Mutations
    // are only retried explicitly with their original idempotency key.
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 120_000)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        method: init.method,
        headers: init.headers,
        ...(init.body === undefined ? {} : { body: init.body }),
        credentials: 'same-origin',
        redirect: 'manual',
        cache: 'no-store',
      })
      return {
        status: response.status,
        headers: responseHeaders(response.headers),
        body: await parseBody(response),
      }
    } finally { window.clearTimeout(timeout) }
  }

  async openEventStream(url: string, headers: Readonly<Record<string, string>>): Promise<EventStreamTransportResponse> {
    assertApiPath(url)
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
    })
    if (response.status !== 200) {
      if (response.status !== 401 && response.status !== 404 && response.status !== 409) {
        throw new Error('INTERNAL_POC_SSE_STATUS_UNSUPPORTED')
      }
      return {
        status: response.status,
        headers: responseHeaders(response.headers),
        body: await parseBody(response),
      }
    }
    if (response.body === null) throw new Error('INTERNAL_POC_SSE_BODY_REQUIRED')
    return {
      status: 200,
      headers: responseHeaders(response.headers),
      stream: decodeSseBody(response.body),
    }
  }
}

export interface ApiAdapterConfig {
  readonly structuralSmokeProfileContentHash: string
  readonly trustedVerifierAuthority?: TrustedVerifierAuthority
  /** Exact current page loopback origin; never used as a fetch destination. */
  readonly ownerLocalServiceUrl?: string
}

export const createApiAdapter = (config: ApiAdapterConfig): InternalPocAdapter => {
  if (!SHA256.test(config.structuralSmokeProfileContentHash)) {
    throw new Error('STRUCTURAL_SMOKE_PROFILE_AUTHORITY_MISSING')
  }
  if (config.ownerLocalServiceUrl !== undefined && !isCurrentOwnerLocalLoopbackUrl(config.ownerLocalServiceUrl)) {
    throw new Error('OWNER_LOCAL_SERVICE_URL_INVALID')
  }
  const security: ClientSecurityOptions = {
    trustedBacktestProfileAuthority: {
      profileId: 'STRUCTURAL_SMOKE',
      profileContentHash: config.structuralSmokeProfileContentHash,
    },
    ...(config.trustedVerifierAuthority === undefined
      ? {}
      : { trustedVerifierAuthority: config.trustedVerifierAuthority }),
  }
  return {
    kind: 'local-api',
    label: '실제 엔진 실행·합성 시장 데이터',
    sdk: createSdk(new TesiaApiClient(new SameOriginApiTransport(), security)),
    canReadResults: config.trustedVerifierAuthority !== undefined,
    ...(config.ownerLocalServiceUrl !== undefined
      ? { ensureBrowserSession: createBrowserSessionBootstrap() }
      : {}),
  }
}

export const readApiAdapterConfig = (documentRoot: Document): ApiAdapterConfig => {
  const profileHash = documentRoot
    .querySelector<HTMLMetaElement>('meta[name="tesia-structural-smoke-profile-hash"]')
    ?.content.trim()
  if (profileHash === undefined || !SHA256.test(profileHash)) {
    throw new Error('STRUCTURAL_SMOKE_PROFILE_AUTHORITY_MISSING')
  }
  const verifierValues = {
    name: documentRoot.querySelector<HTMLMetaElement>('meta[name="tesia-report-verifier-name"]')?.content.trim(),
    version: documentRoot.querySelector<HTMLMetaElement>('meta[name="tesia-report-verifier-version"]')?.content.trim(),
    commitSha: documentRoot.querySelector<HTMLMetaElement>('meta[name="tesia-report-verifier-commit-sha"]')?.content.trim(),
    trustAnchorContentHash: documentRoot.querySelector<HTMLMetaElement>('meta[name="tesia-report-trust-anchor-hash"]')?.content.trim(),
    expectedReceiptContentHash: documentRoot.querySelector<HTMLMetaElement>('meta[name="tesia-report-receipt-content-hash"]')?.content.trim(),
    expectedSubjectContentHash: documentRoot.querySelector<HTMLMetaElement>('meta[name="tesia-report-subject-content-hash"]')?.content.trim(),
  }
  const suppliedCount = Object.values(verifierValues).filter((value) => value !== undefined && value.length > 0).length
  if (suppliedCount !== 0 && suppliedCount !== Object.keys(verifierValues).length) {
    throw new Error('TRUSTED_VERIFIER_AUTHORITY_INCOMPLETE')
  }
  const configuredOwnerLocalServiceUrl = documentRoot
    .querySelector<HTMLMetaElement>('meta[name="tesia-owner-local-service-url"]')
    ?.content.trim()
  if (configuredOwnerLocalServiceUrl !== undefined && configuredOwnerLocalServiceUrl.length > 0
    && !isCurrentOwnerLocalLoopbackUrl(configuredOwnerLocalServiceUrl)) {
    throw new Error('OWNER_LOCAL_SERVICE_URL_INVALID')
  }
  const ownerLocalServiceUrl = configuredOwnerLocalServiceUrl === undefined || configuredOwnerLocalServiceUrl.length === 0
    ? undefined
    : configuredOwnerLocalServiceUrl
  if (suppliedCount === 0) {
    return {
      structuralSmokeProfileContentHash: profileHash,
      ...(ownerLocalServiceUrl === undefined ? {} : { ownerLocalServiceUrl }),
    }
  }
  return {
    structuralSmokeProfileContentHash: profileHash,
    ...(ownerLocalServiceUrl === undefined ? {} : { ownerLocalServiceUrl }),
    trustedVerifierAuthority: {
      verifierPin: {
        name: verifierValues.name!,
        version: verifierValues.version!,
        commitSha: verifierValues.commitSha!,
      },
      trustAnchorContentHash: verifierValues.trustAnchorContentHash!,
      expectedReceiptContentHash: verifierValues.expectedReceiptContentHash!,
      expectedSubjectContentHash: verifierValues.expectedSubjectContentHash!,
    },
  }
}
