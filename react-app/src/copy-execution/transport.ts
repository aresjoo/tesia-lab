import type { BitgetCopyTransport } from './fixtures/api-v0.18/client.js'

const MAX_BYTES = 262_144
const ID = '[A-Za-z0-9_-]{16,128}'
const versions = new RegExp(`^/api/v1/copy-strategy-versions(?:/${ID})?$`)
const copies = new RegExp(`^/api/v1/strategy-copies(?:/${ID}(?:/(?:start|pause|stop|close))?)?$`)
export class CopyTransportError extends Error {
  constructor(readonly code: 'INVALID_TRANSPORT' | 'RESPONSE_TOO_LARGE' | 'ABORTED') { super(code) }
}

/** Same-origin raw bytes port for the exact candidate SDK. No storage or credentials API. */
export function createCopyTransport(ports: { origin: () => string; fetch: typeof fetch; timeoutMs?: number }): BitgetCopyTransport {
  const origin = new URL(ports.origin()).origin
  const originUrl = new URL(origin)
  if (originUrl.protocol !== 'https:' && !(originUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(originUrl.hostname))) throw new CopyTransportError('INVALID_TRANSPORT')
  const timeoutMs = ports.timeoutMs ?? 10_000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new CopyTransportError('INVALID_TRANSPORT')
  return { async request(input) {
    const invalid = () => { throw new CopyTransportError('INVALID_TRANSPORT') }
    if (!['GET', 'POST', 'PATCH'].includes(input.method) || ports.origin() !== origin || !input.path.startsWith('/api/v1/') || input.credentials !== 'include' || input.redirect !== 'manual' || input.cache !== 'no-store') invalid()
    const url = new URL(input.path, origin)
    const isList = ['/api/v1/copy-strategy-versions', '/api/v1/strategy-copies'].includes(url.pathname)
    if (url.origin !== origin || url.hash || !(versions.test(url.pathname) || copies.test(url.pathname))) invalid()
    if (input.method === 'GET') {
      if (/\/(?:start|pause|stop|close)$/.test(url.pathname) || input.body !== undefined || url.search && !isList) invalid()
      const names = [...url.searchParams.keys()]
      if (new Set(names).size !== names.length || names.some(name => !['limit', 'cursor'].includes(name))) invalid()
      const limit = url.searchParams.get('limit'), cursor = url.searchParams.get('cursor')
      if (limit !== null && (!/^[1-9]\d?$|^100$/.test(limit)) || cursor !== null && !/^[A-Za-z0-9_-]{16,512}$/.test(cursor)) invalid()
    } else {
      if (url.search || input.body === undefined || versions.test(url.pathname)
        || input.method === 'PATCH' && !new RegExp(`^/api/v1/strategy-copies/${ID}$`).test(url.pathname)
        || input.method === 'POST' && !(url.pathname === '/api/v1/strategy-copies' || /\/(?:start|pause|stop|close)$/.test(url.pathname))) invalid()
    }
    const headers = Object.keys(input.headers).map(key => key.toLowerCase())
    if (headers.some(key => !['accept', 'content-type', 'x-csrf-token', 'idempotency-key'].includes(key))) invalid()
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), timeoutMs)
    const cancel = () => abort.abort()
    input.signal?.addEventListener('abort', cancel, { once: true })
    if (input.signal?.aborted) abort.abort()
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    const check = () => { if (abort.signal.aborted) throw new CopyTransportError('ABORTED'); if (ports.origin() !== origin) invalid() }
    try {
      check()
      const response = await ports.fetch(url.href, { method: input.method, headers: input.headers,
        ...(input.body === undefined ? {} : { body: input.body }), credentials: input.credentials,
        redirect: input.redirect, cache: input.cache, signal: abort.signal })
      check()
      if (response.redirected || response.url !== url.href || response.type === 'opaqueredirect' || !response.body
        || !/^application\/json(?:\s*;.*)?$/i.test(response.headers.get('Content-Type') ?? '')) invalid()
      reader = response.body!.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let bytes = 0, body = ''
      for (;;) {
        const item = await reader.read(); check()
        if (item.done) break
        bytes += item.value.byteLength
        if (bytes > MAX_BYTES) throw new CopyTransportError('RESPONSE_TOO_LARGE')
        body += decoder.decode(item.value, { stream: true })
      }
      body += decoder.decode(); check()
      return { status: response.status, headers: [...response.headers], body }
    } finally {
      clearTimeout(timer); input.signal?.removeEventListener('abort', cancel)
      await reader?.cancel().catch(() => undefined)
    }
  } }
}
