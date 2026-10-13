export type GateBrokerEnvironment = 'demo' | 'production'
export type GateBrokerReadOptions = Readonly<{ signal?: AbortSignal }>
export type GateBrokerMutationOptions = Readonly<{ csrfToken: string; signal?: AbortSignal }>
type Envelope = Readonly<{ apiContractVersion: '0.23.0'; data: unknown }>

/** Structural injection keeps the generated API23 response types and validator
 * authoritative without changing the application's SDK distribution pins. */
export interface GateBrokerApi23Client {
  start(request: Readonly<{ apiContractVersion: '0.23.0'; environment: GateBrokerEnvironment }>, options: GateBrokerMutationOptions): Promise<Envelope>
  get(transactionId: string, options?: GateBrokerReadOptions): Promise<Envelope>
  cancel(transactionId: string, request: Readonly<{ apiContractVersion: '0.23.0' }>, options: GateBrokerMutationOptions): Promise<Envelope>
  list(options?: GateBrokerReadOptions): Promise<Envelope>
  account(connectionId: string, options?: GateBrokerReadOptions): Promise<Envelope>
}

/** Each call is explicit and single-attempt. The host supplies current-session
 * authority and CSRF; pending/HOLD, cancel and account responses stay intact. */
export function createGateBrokerApi<Client extends GateBrokerApi23Client>(client: Client) {
  return Object.freeze({
    start: (environment: GateBrokerEnvironment, options: GateBrokerMutationOptions) =>
      client.start({ apiContractVersion: '0.23.0', environment }, options) as ReturnType<Client['start']>,
    transaction: (transactionId: string, options?: GateBrokerReadOptions) =>
      client.get(transactionId, options) as ReturnType<Client['get']>,
    cancel: (transactionId: string, options: GateBrokerMutationOptions) =>
      client.cancel(transactionId, { apiContractVersion: '0.23.0' }, options) as ReturnType<Client['cancel']>,
    connections: (options?: GateBrokerReadOptions) => client.list(options) as ReturnType<Client['list']>,
    account: (connectionId: string, options?: GateBrokerReadOptions) =>
      client.account(connectionId, options) as ReturnType<Client['account']>,
  })
}

export type GateBrokerTransportInput = Readonly<{
  method: 'GET' | 'POST'
  path: string
  headers: Readonly<Record<string, string>>
  body?: string
  credentials: 'include'
  mode: 'same-origin'
  redirect: 'manual'
  cache: 'no-store'
  signal?: AbortSignal
}>
export interface GateBrokerTransport {
  request(input: GateBrokerTransportInput): Promise<{
    status: number; headers: ReadonlyArray<readonly [string, string]>; body: string
  }>
}
export type GateBrokerBrowserPorts = Readonly<{
  currentOrigin?: () => string
  fetch?: typeof globalThis.fetch
}>

const PREFIX = '/api/v1/gate-broker-connections'
const TRANSACTION = PREFIX + '/transactions/[0-9a-f]{32}'
const READ_ROUTE = new RegExp('^(?:' + PREFIX + '|' + TRANSACTION + '|' + PREFIX + '/[A-Za-z0-9_-]{16,128}/account)$')
const MUTATION_ROUTE = new RegExp('^(?:' + PREFIX + '/transactions|' + TRANSACTION + '/cancel)$')
const MAX_RESPONSE_BYTES = 8_388_608

function requestAllowed(request: GateBrokerTransportInput, origin: string): URL {
  const url = new URL(request.path, origin)
  if (url.origin !== origin || url.search || url.hash || request.path !== url.pathname
    || request.credentials !== 'include' || request.mode !== 'same-origin'
    || request.redirect !== 'manual' || request.cache !== 'no-store') throw new Error('GATE_TRANSPORT_INVALID')
  const mutation = request.method === 'POST'
  if (request.method !== 'GET' && !mutation
    || !(mutation ? MUTATION_ROUTE : READ_ROUTE).test(request.path)) throw new Error('GATE_TRANSPORT_INVALID')
  const expected = mutation ? ['Accept', 'Content-Type', 'X-CSRF-Token'] : ['Accept']
  if (Object.keys(request.headers).length !== expected.length
    || Object.keys(request.headers).some(key => !expected.includes(key)) || request.headers.Accept !== 'application/json') {
    throw new Error('GATE_TRANSPORT_INVALID')
  }
  if (!mutation) {
    if (request.body !== undefined) throw new Error('GATE_TRANSPORT_INVALID')
  } else {
    const csrf = request.headers['X-CSRF-Token']
    if (request.headers['Content-Type'] !== 'application/json' || typeof csrf !== 'string'
      || csrf.length < 1 || csrf.length > 512 || /[\u0000-\u001f\u007f-\u009f]/.test(csrf)
      || typeof request.body !== 'string') throw new Error('GATE_TRANSPORT_INVALID')
    try {
      const body: unknown = JSON.parse(request.body)
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
      const values = body as Record<string, unknown>
      const start = request.path === PREFIX + '/transactions'
      if (values.apiContractVersion !== '0.23.0' || Object.keys(values).length !== (start ? 2 : 1)
        || start && values.environment !== 'demo' && values.environment !== 'production') throw new Error()
    } catch { throw new Error('GATE_TRANSPORT_INVALID') }
  }
  return url
}

/** Browser I/O only: five same-origin routes, no storage, navigation or retry.
 * Strict response envelopes, identity echoes and errors belong to API23 SDK. */
export function createGateBrokerTransport(ports: GateBrokerBrowserPorts = {}): GateBrokerTransport {
  const currentOrigin = ports.currentOrigin ?? (() => globalThis.location.origin)
  const fetch = ports.fetch ?? globalThis.fetch.bind(globalThis)
  const origin = currentOrigin()
  const parsedOrigin = new URL(origin)
  if (parsedOrigin.origin !== origin || !['http:', 'https:'].includes(parsedOrigin.protocol)) throw new Error('GATE_TRANSPORT_INVALID')
  return { async request(request) {
    if (currentOrigin() !== origin) throw new Error('GATE_TRANSPORT_INVALID')
    const url = requestAllowed(request, origin)
    if (request.signal?.aborted) throw new Error('GATE_TRANSPORT_ABORTED')
    const abort = new AbortController()
    const cancel = () => abort.abort()
    request.signal?.addEventListener('abort', cancel, { once: true })
    const timer = globalThis.setTimeout(cancel, 25_000)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const response = await fetch(url.href, {
        method: request.method, headers: request.headers,
        ...(request.body === undefined ? {} : { body: request.body }),
        credentials: 'include', mode: 'same-origin', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', signal: abort.signal,
      })
      if (abort.signal.aborted) throw new Error('GATE_TRANSPORT_ABORTED')
      if (currentOrigin() !== origin || response.redirected || response.url !== url.href
        || response.status >= 300 && response.status < 400 || response.body === null) throw new Error('GATE_TRANSPORT_INVALID')
      reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let bytes = 0, body = ''
      for (;;) {
        const chunk = await reader.read()
        if (abort.signal.aborted) throw new Error('GATE_TRANSPORT_ABORTED')
        if (currentOrigin() !== origin) throw new Error('GATE_TRANSPORT_INVALID')
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > MAX_RESPONSE_BYTES) throw new Error('GATE_RESPONSE_TOO_LARGE')
        body += decoder.decode(chunk.value, { stream: true })
      }
      body += decoder.decode()
      return { status: response.status, headers: [...response.headers.entries()], body }
    } finally {
      globalThis.clearTimeout(timer)
      request.signal?.removeEventListener('abort', cancel)
      if (reader) await reader.cancel().catch(() => undefined)
    }
  } }
}
