import { TEST_ORIGIN } from '../test-origin'
import { randomBytes } from 'node:crypto'
import { createServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test, type Page } from '@playwright/test'

// Synthetic protocol fixtures only. Never capture cookie/response payloads in traces.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

const SESSION_PATH = '/api/v1/auth/session'
const CREATE_PATH = '/api/v1/anonymous-sessions'
const MODULE = `${TEST_ORIGIN}/src/internal-poc/browser-session.ts`
const ETAG = '"synthetic_session_revision_0001"'
const session = () => ({
  sessionId: 'session_synthetic_browser_0001', state: 'ANONYMOUS', revision: '1',
  issuedAt: '2030-01-01T00:00:00.000001Z', expiresAt: '2030-01-02T00:00:00.000001Z',
})
const envelope = (data: Record<string, unknown>, phase: string) => ({
  meta: { apiContractVersion: '0.1.0', requestId: `request_${phase}`, traceId: `trace_${phase}`, resourceRevision: data.revision }, data,
})
const authRequired = () => ({
  meta: { apiContractVersion: '0.1.0', requestId: 'request_no_session', traceId: 'trace_no_session', resourceRevision: null },
  error: { code: 'AUTHENTICATION_REQUIRED', message: 'Synthetic session is unavailable.' },
})

type Mode = 'fresh' | 'existing' | 'existing-auth' | 'revoked' | 'no-cookie' | 'cookie-replaced'
  | 'initial-network' | 'initial-500' | 'initial-malformed-401' | 'initial-bad-schema'
  | 'initial-redirect' | 'post-redirect' | 'post-loss' | 'post-preheader-loss' | 'post-status' | 'post-json'
  | 'post-unknown' | 'get-unknown' | 'bad-state' | 'bad-revision' | 'bad-timestamp'
  | 'post-weak-etag' | 'get-weak-etag' | 'post-no-etag' | 'get-no-etag' | 'etag-mismatch'
  | 'post-meta-revision' | 'get-meta-revision' | 'existing-meta-revision'
  | 'bad-ttl' | 'microsecond-mismatch' | 'initial-overflow' | 'post-overflow' | 'initial-slow-body'
  | 'post-slow-body' | 'get-slow-body' | 'initial-slow-headers'

const stallBody = (response: ServerResponse, status: number) => {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.write('{"padding":"')
  const interval = setInterval(() => response.write('x'), 30)
  response.once('close', () => clearInterval(interval))
}

async function fixture(mode: Mode) {
  let getCount = 0
  let postCount = 0
  let unexpectedPathCount = 0
  let postWireValid = true
  let revoked = false
  let origin = ''
  const token = randomBytes(32).toString('base64url')
  const server = createServer((request, response) => {
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers })
      response.end(JSON.stringify(body))
    }
    if (request.url === '/' && request.method === 'GET') {
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.end('<!doctype html><html><body>Private synthetic browser consumer test</body></html>')
      return
    }
    if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return }
    if (request.url === SESSION_PATH && request.method === 'GET') {
      getCount += 1
      if (mode === 'initial-network') { request.socket.destroy(); return }
      if (mode === 'initial-500' && getCount === 1) { send(500, authRequired()); return }
      if (mode === 'initial-malformed-401' && getCount === 1) { send(401, { error: 'not-an-envelope' }); return }
      if (mode === 'initial-redirect' && getCount === 1) {
        response.writeHead(302, { Location: '/unexpected' }); response.end(); return
      }
      if (mode === 'initial-overflow' && getCount === 1) { send(200, { padding: '가'.repeat(23_000) }); return }
      if (mode === 'initial-slow-body' && getCount === 1) {
        stallBody(response, 200)
        return
      }
      if (mode === 'initial-slow-headers' && getCount === 1) {
        const timer = setTimeout(() => send(401, authRequired()), 6_000)
        response.once('close', () => clearTimeout(timer))
        return
      }
      const existing = ['existing', 'existing-auth', 'revoked', 'existing-meta-revision', 'initial-bad-schema'].includes(mode)
      const cookieBound = request.headers.cookie?.split(/;\s*/).includes(`__Host-tesia_session=${token}`)
      if (revoked || (!existing && !cookieBound)) { send(401, authRequired()); return }
      if (mode === 'get-slow-body') { stallBody(response, 200); return }
      const data = session()
      if (mode === 'existing-auth') { data.state = 'AUTHENTICATED'; data.revision = '7' }
      if (mode === 'revoked') data.state = 'REVOKED'
      if (mode === 'cookie-replaced') data.sessionId = 'session_another_browser_0002'
      mutateData(data, mode)
      const body = envelope(data, `get_${getCount}`)
      if (mode === 'get-unknown' || mode === 'initial-bad-schema') Object.assign(body.data, { unexpected: true })
      if (mode === 'get-meta-revision' || mode === 'existing-meta-revision') body.meta.resourceRevision = '2'
      const headers: Record<string, string> = { ETag: mode === 'etag-mismatch' ? '"another_session_revision_0001"' : ETAG }
      if (mode === 'get-no-etag') delete headers.ETag
      if (mode === 'get-weak-etag') headers.ETag = `W/${ETAG}`
      send(200, body, headers)
      return
    }
    if (request.url === CREATE_PATH && request.method === 'POST') {
      postCount += 1
      postWireValid &&= request.headers.origin === origin && request.headers['sec-fetch-site'] === 'same-origin'
        && /^[A-Za-z0-9_-]{16,128}$/.test(String(request.headers['idempotency-key']))
        && request.headers.accept === 'application/json' && request.headers['content-type'] === undefined
      let receivedBytes = 0
      request.on('data', (chunk: Buffer) => { receivedBytes += chunk.length })
      request.on('end', () => {
        postWireValid &&= receivedBytes === 0
        if (mode === 'post-slow-body') { stallBody(response, 201); return }
        if (mode === 'post-preheader-loss') { request.socket.destroy(); return }
        if (mode === 'post-loss') {
          response.writeHead(201, { 'Content-Type': 'application/json' })
          response.write('{"meta":')
          response.flushHeaders()
          setTimeout(() => response.destroy(), 20)
          return
        }
        if (mode === 'post-redirect') { response.writeHead(303, { Location: '/unexpected' }); response.end(); return }
        const headers: Record<string, string> = { ETag: ETAG }
        if (mode !== 'no-cookie') headers['Set-Cookie'] = `__Host-tesia_session=${token}; Path=/; Secure; HttpOnly; SameSite=Lax`
        if (mode === 'post-no-etag') delete headers.ETag
        if (mode === 'post-weak-etag') headers.ETag = `W/${ETAG}`
        if (mode === 'post-json') { response.writeHead(201, { ...headers, 'Content-Type': 'application/json' }); response.end('{'); return }
        const data = session()
        mutateData(data, mode)
        const body = envelope(data, 'post')
        if (mode === 'post-unknown') Object.assign(body.data, { unexpected: true })
        if (mode === 'post-meta-revision') body.meta.resourceRevision = '2'
        if (mode === 'post-overflow') Object.assign(body.data, { padding: '가'.repeat(23_000) })
        send(mode === 'post-status' ? 200 : 201, body, headers)
      })
      return
    }
    unexpectedPathCount += 1
    send(404, {})
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    origin,
    counts: () => ({ getCount, postCount, unexpectedPathCount, postWireValid }),
    revoke: () => { revoked = true },
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections()
      server.close((error) => error ? reject(error) : resolve())
    }),
  }
}

function mutateData(data: ReturnType<typeof session>, mode: Mode): void {
  if (mode === 'bad-state') data.state = 'OTHER'
  if (mode === 'bad-revision') data.revision = '2'
  if (mode === 'bad-timestamp') data.issuedAt = '2030-02-31T00:00:00Z'
  if (mode === 'bad-ttl') data.expiresAt = '2030-01-02T00:00:01.000001Z'
  if (mode === 'microsecond-mismatch') data.expiresAt = '2030-01-02T00:00:00.000002Z'
}

async function load(page: Page, origin: string) {
  await page.goto(origin)
  await page.evaluate(async (url) => {
    const actualFetch = window.fetch.bind(window)
    const observations = { getCalls: 0, postCalls: 0 }
    window.fetch = (input, init) => {
      if (init?.method === 'POST') observations.postCalls += 1
      if (init?.method === 'GET') observations.getCalls += 1
      return actualFetch(input, init) // Observe calls only; never replace response/headers.
    }
    const module = await import(/* @vite-ignore */ url)
    Object.assign(window, { testEnsure: module.createBrowserSessionBootstrap(), testFetchObservations: observations })
  }, MODULE)
}

const ensure = (page: Page) => page.evaluate(async () => {
  const call = (window as unknown as { testEnsure: () => Promise<{ kind: string }> }).testEnsure
  try { return { kind: (await call()).kind, error: null } }
  catch (error) { return { kind: null, error: error instanceof Error ? error.message : 'unknown' } }
})

test('BRS-01/07/08: 실제 HTTP cookie jar 왕복과 분리된 immutable POST/GET 응답', async ({ page, context }) => {
  const server = await fixture('fresh')
  try {
    await load(page, server.origin)
    const observed = await page.evaluate(async () => {
      type Result = {
        kind: string; verification: string; cookieAttributesVerifiedInBrowser: boolean
        created: { status: number; response: { body: { meta: { requestId: string }; data: unknown }; headers: Record<string, string> } }
        current: { status: number; response: { body: { meta: { requestId: string }; data: unknown } } }
      }
      const result = await (window as unknown as { testEnsure: () => Promise<Result> }).testEnsure()
      return {
        kind: result.kind, verification: result.verification,
        cookieAttributesVerifiedInBrowser: result.cookieAttributesVerifiedInBrowser,
        statuses: [result.created.status, result.current.status],
        distinctResponseMeta: result.created.response.body.meta.requestId !== result.current.response.body.meta.requestId,
        hiddenSetCookie: !Object.keys(result.created.response.headers).some((key) => key.toLowerCase() === 'set-cookie'),
        frozen: Object.isFrozen(result) && Object.isFrozen(result.created.response.body.data) && Object.isFrozen(result.current.response),
        httpOnlyHidden: !document.cookie.includes('__Host-tesia_session'),
      }
    })
    expect(observed).toEqual({ kind: 'BOOTSTRAP_CONFIRMED', verification: 'COOKIE_BOUND_SESSION_ROUND_TRIP', cookieAttributesVerifiedInBrowser: false, statuses: [201, 200], distinctResponseMeta: true, hiddenSetCookie: true, frozen: true, httpOnlyHidden: true })
    const cookie = (await context.cookies()).find((item) => item.name === '__Host-tesia_session')
    expect({ stored: cookie !== undefined, secure: cookie?.secure, httpOnly: cookie?.httpOnly, hostOnly: cookie?.domain === '127.0.0.1', rootPath: cookie?.path === '/', lax: cookie?.sameSite === 'Lax' })
      .toEqual({ stored: true, secure: true, httpOnly: true, hostOnly: true, rootPath: true, lax: true })
    expect(server.counts()).toEqual({ getCount: 2, postCount: 1, unexpectedPathCount: 0, postWireValid: true })
  } finally { await server.close() }
})

for (const mode of ['existing', 'existing-auth'] as const) {
  test(`BRS-05: ${mode}는 POST 없이 기존 SDK GET 사용`, async ({ page }) => {
    const server = await fixture(mode)
    try {
      await load(page, server.origin)
      expect(await ensure(page)).toEqual({ kind: 'EXISTING_SESSION', error: null })
      expect(server.counts().postCount).toBe(0)
    } finally { await server.close() }
  })
}

for (const mode of ['revoked', 'initial-network', 'initial-500', 'initial-malformed-401', 'initial-bad-schema', 'existing-meta-revision', 'initial-redirect', 'initial-overflow'] as const) {
  test(`BRS-04/05/09: ${mode}를 401 bootstrap으로 바꾸지 않음`, async ({ page }) => {
    const server = await fixture(mode)
    try {
      await load(page, server.origin)
      expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
      expect(server.counts().postCount).toBe(0)
      expect(server.counts().unexpectedPathCount).toBe(0)
    } finally { await server.close() }
  })
}

for (const mode of ['no-cookie', 'cookie-replaced', 'post-redirect', 'post-loss', 'post-status', 'post-json', 'post-unknown', 'get-unknown', 'bad-state', 'bad-revision', 'bad-timestamp', 'post-weak-etag', 'get-weak-etag', 'post-no-etag', 'get-no-etag', 'etag-mismatch', 'post-meta-revision', 'get-meta-revision', 'bad-ttl', 'microsecond-mismatch', 'post-overflow'] as const) {
  test(`BRS-02/03/04/09: ${mode}는 usable 세션을 반환하지 않음`, async ({ page }) => {
    const server = await fixture(mode)
    try {
      await load(page, server.origin)
      expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
      expect(server.counts().postCount).toBe(1)
      expect(server.counts().unexpectedPathCount).toBe(0)
    } finally { await server.close() }
  })
}

test('BRS-06: 진행 중만 single-flight, settle 뒤 GET 재확인, revoke 후 POST 재시도0', async ({ page }) => {
  const server = await fixture('fresh')
  try {
    await load(page, server.origin)
    const shared = await page.evaluate(async () => {
      const call = (window as unknown as { testEnsure: () => Promise<{ kind: string }> }).testEnsure
      const first = call(); const second = call()
      const samePromise = first === second
      const result = await Promise.all([first, second])
      return { samePromise, kinds: result.map((item) => item.kind) }
    })
    expect(shared).toEqual({ samePromise: true, kinds: ['BOOTSTRAP_CONFIRMED', 'BOOTSTRAP_CONFIRMED'] })
    expect(await ensure(page)).toEqual({ kind: 'EXISTING_SESSION', error: null })
    expect(server.counts().getCount).toBe(3)
    server.revoke()
    expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
    expect(server.counts()).toEqual({ getCount: 4, postCount: 1, unexpectedPathCount: 0, postWireValid: true })
  } finally { await server.close() }
})

for (const mode of ['post-loss', 'no-cookie'] as const) {
  test(`BRS-06: ${mode} 이후 동일 factory는 GET만 다시 확인`, async ({ page }) => {
    const server = await fixture(mode)
    try {
      await load(page, server.origin)
      expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
      const before = server.counts().getCount
      expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
      expect(server.counts().getCount).toBe(before + 1)
      expect(server.counts().postCount).toBe(1)
    } finally { await server.close() }
  })
}

test('BRS-09: Content-Length 없는 끝나지 않는 실제 body stream도5초 내 취소', async ({ page }) => {
  const server = await fixture('initial-slow-body')
  try {
    await load(page, server.origin)
    const began = performance.now()
    expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
    expect(performance.now() - began).toBeLessThan(8_000)
    expect(server.counts().postCount).toBe(0)
  } finally { await server.close() }
})

for (const mode of ['initial-slow-headers', 'post-slow-body', 'get-slow-body'] as const) {
  test(`BRS-09: ${mode}에도 같은 fetch deadline 적용`, async ({ page }) => {
    const server = await fixture(mode)
    try {
      await load(page, server.origin)
      const began = performance.now()
      expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
      expect(performance.now() - began).toBeLessThan(8_000)
      expect(server.counts().postCount).toBe(mode === 'initial-slow-headers' ? 0 : 1)
      if (mode === 'post-slow-body') {
        expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
        expect(server.counts().postCount).toBe(1)
      }
    } finally { await server.close() }
  })
}

test('BRS-06 한계: 앱 fetch1회와 Chromium의 pre-header loss wire 재전송을 분리', async ({ page }) => {
  const server = await fixture('post-preheader-loss')
  try {
    await load(page, server.origin)
    expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
    const calls = await page.evaluate(() => (window as unknown as { testFetchObservations: { postCalls: number } }).testFetchObservations.postCalls)
    expect(calls).toBe(1)
    const deliveries = server.counts().postCount
    expect(deliveries).toBeGreaterThanOrEqual(1)
    expect(await ensure(page)).toEqual({ kind: null, error: 'BROWSER_SESSION_UNCONFIRMED' })
    expect(server.counts().postCount).toBe(deliveries)
    test.info().annotations.push({ type: 'browser-transport-observation', description: `applicationFetchCalls=${calls}; serverPostDeliveries=${deliveries}; consumerRetry=0` })
    console.log(JSON.stringify({ evidence: 'SYNTHETIC_PREHEADER_LOSS', applicationFetchCalls: calls, serverPostDeliveries: deliveries, consumerRetry: 0 }))
  } finally { await server.close() }
})

test('BRS-07/10: 임의 factory 입력·비loopback adapter 설정 거절, 기존 SDK create cookie 검사·default adapter 불변', async ({ page }) => {
  const server = await fixture('fresh')
  try {
    await load(page, server.origin)
    const observed = await page.evaluate(async (url) => {
      const module = await import(/* @vite-ignore */ url)
      let rejectedArgument = false
      try { module.createBrowserSessionBootstrap({ origin: 'https://not-allowed.invalid' }) }
      catch { rejectedArgument = true }
      const { createApiAdapter } = await import(/* @vite-ignore */ new URL('./api-adapter.ts', url).href)
      const plain = createApiAdapter({ structuralSmokeProfileContentHash: 'a'.repeat(64) })
      const optin = createApiAdapter({ structuralSmokeProfileContentHash: 'a'.repeat(64), ownerLocalServiceUrl: window.location.origin })
      let invalidLoopbackRejected = false
      try { createApiAdapter({ structuralSmokeProfileContentHash: 'a'.repeat(64), ownerLocalServiceUrl: 'http://localhost:4174' }) }
      catch { invalidLoopbackRejected = true }
      let strictCreateRejected = false
      try { await plain.sdk.session.create({ context: { idempotencyKey: crypto.randomUUID() } }) }
      catch (error) { strictCreateRejected = error instanceof Error && error.message === 'INVALID_ANONYMOUS_SESSION_RESPONSE_HEADERS' }
      return { rejectedArgument, defaultAbsent: plain.ensureBrowserSession === undefined, optinPresent: typeof optin.ensureBrowserSession === 'function', invalidLoopbackRejected, strictCreateRejected }
    }, MODULE)
    expect(observed).toEqual({ rejectedArgument: true, defaultAbsent: true, optinPresent: true, invalidLoopbackRejected: true, strictCreateRejected: true })
    // Only the explicit legacy create test above sent POST; factories themselves sent nothing.
    expect(server.counts().postCount).toBe(1)
    expect(server.counts().getCount).toBe(0)
  } finally { await server.close() }
})
