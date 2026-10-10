import type { ExchangeConnectionsTransport } from '../internal-poc/contracts/generated/api-v0.12/client.js'

const PREFIX = '/api/v1/exchange-connections'
const MAX_BYTES = 65_536

/** Same-origin port for the generated client. No URL configuration or storage. */
export function createExchangeConnectionsTransport(): ExchangeConnectionsTransport {
  const origin = window.location.origin
  return {
    async request(request) {
      const url = new URL(request.path, origin)
      if (window.location.origin !== origin || url.origin !== origin || url.search || url.hash
        || !/^\/api\/v1\/exchange-connections(?:\/[A-Za-z0-9_-]+){0,3}\/?$/.test(url.pathname)
        || !request.path.startsWith(PREFIX) || !['GET', 'POST', 'DELETE'].includes(request.method)) {
        throw new Error('EXCHANGE_TRANSPORT_INVALID')
      }
      const abort = new AbortController()
      const timer = window.setTimeout(() => abort.abort(), 10_000)
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      try {
        const response = await fetch(url.href, { method: request.method, headers: request.headers,
          ...(request.body === undefined ? {} : { body: request.body }),
          credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: abort.signal })
        if (window.location.origin !== origin || response.redirected || response.url !== url.href
          || response.body === null) throw new Error('EXCHANGE_TRANSPORT_INVALID')
        if (request.method === 'GET' && [502, 503, 504].includes(response.status)
          && response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() === 'text/html') {
          // Gateway HTML is not a contract response. Only read observations
          // may recover; mutation responses keep the original strict boundary.
          throw new TypeError('EXCHANGE_GATEWAY_UNAVAILABLE')
        }
        reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8', { fatal: true })
        let bytes = 0, body = ''
        for (;;) {
          const result = await reader.read()
          if (abort.signal.aborted) throw new Error('EXCHANGE_TRANSPORT_TIMEOUT')
          if (result.done) break
          bytes += result.value.byteLength
          if (bytes > MAX_BYTES) throw new Error('EXCHANGE_RESPONSE_TOO_LARGE')
          body += decoder.decode(result.value, { stream: true })
        }
        body += decoder.decode()
        return { status: response.status, headers: [...response.headers.entries()], body }
      } finally {
        window.clearTimeout(timer)
        if (reader) await reader.cancel().catch(() => undefined)
      }
    },
  }
}
