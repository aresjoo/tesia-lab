import type { BitgetAccountTransport } from '../internal-poc/contracts/generated/api-v0.17/client.js'
import type { ConnectionsResponse, DeepReadonly } from '../internal-poc/contracts/generated/api-v0.12/types.js'

/** Local observation identity, not a public schema or authorization decision. */
export function accountConnectionBinding(connections: DeepReadonly<ConnectionsResponse['data']['connections']> | null): string {
  return JSON.stringify((connections ?? []).filter(item => item.exchangeId === 'bitget' && item.status === 'connected')
    .map(item => [item.connectionId, item.connectedAt, item.maskedAccountLabel, item.permissionsVerified,
      item.permissions.read, item.permissions.spotTrade, item.permissions.futuresTrade, item.permissions.withdrawal])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}

/** Same-origin GET-only SDK port. Credentials stay in the existing session
 * cookie; response interpretation belongs exclusively to the generated SDK. */
export function createBitgetAccountTransport(): BitgetAccountTransport {
  const origin = window.location.origin
  return { async request(request) {
    const url = new URL(request.path, origin)
    if (window.location.origin !== origin || url.origin !== origin || url.search || url.hash
      || request.path !== url.pathname || request.method !== 'GET'
      || !/^\/api\/v1\/exchange-connections\/[A-Za-z0-9_-]{16,128}\/account$/.test(url.pathname)) throw new Error('ACCOUNT_TRANSPORT_INVALID')
    const abort = new AbortController(), cancel = () => abort.abort()
    request.signal?.addEventListener('abort', cancel, { once: true })
    if (request.signal?.aborted) abort.abort()
    const timer = window.setTimeout(cancel, 25_000)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const response = await fetch(url.href, { method: 'GET', headers: request.headers,
        credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: abort.signal })
      if (window.location.origin !== origin || response.redirected || response.url !== url.href || response.body === null) throw new Error('ACCOUNT_TRANSPORT_INVALID')
      reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let bytes = 0, body = ''
      for (;;) {
        const result = await reader.read()
        if (abort.signal.aborted) throw new Error('ACCOUNT_TRANSPORT_ABORTED')
        if (result.done) break
        bytes += result.value.byteLength
        if (bytes > 262_144) throw new Error('ACCOUNT_RESPONSE_TOO_LARGE')
        body += decoder.decode(result.value, { stream: true })
      }
      body += decoder.decode()
      return { status: response.status, headers: [...response.headers.entries()], body }
    } finally {
      window.clearTimeout(timer)
      request.signal?.removeEventListener('abort', cancel)
      if (reader) await reader.cancel().catch(() => undefined)
    }
  } }
}
