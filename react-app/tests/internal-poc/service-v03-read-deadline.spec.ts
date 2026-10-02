import { expect, test } from '@playwright/test'

test.use({ trace: 'off', video: 'off' })
test.beforeEach(async ({ page }) => {
  await page.route('**/deadline-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body></body></html>' }))
  await page.goto('/deadline-fixture')
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 20))
})

for (const mode of ['headers', 'body', 'digest'] as const) test(`QUERY의 ${mode} 정지는 30초에 종료하며 늦은 응답을 기록하지 않는다`, async ({ page }) => {
  await page.evaluate(async mode => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const state = { started: false, result: 'pending', signal: null as AbortSignal | null, cancels: 0, finish: () => {}, audit: () => ({ requestCount: 0, responses: [] as readonly unknown[] }) }
    const digest = crypto.subtle.digest.bind(crypto.subtle)
    if (mode === 'digest') crypto.subtle.digest = (...args: Parameters<typeof digest>) => new Promise<ArrayBuffer>(resolve => {
      state.started = true
      state.finish = () => { crypto.subtle.digest = digest; void digest(...args).then(resolve) }
    })
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => { throw new Error('QUERY_CSRF_FORBIDDEN') },
      fetchImplementation: async (_url, init) => {
        state.signal = init?.signal as AbortSignal
        const response = () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })
        if (mode === 'headers') return new Promise<Response>(resolve => { state.started = true; state.finish = () => resolve(response()) })
        if (mode === 'body') return new Response(new ReadableStream({
          start() { state.started = true },
          cancel() { state.cancels++; return new Promise<void>(() => {}) },
        }), { headers: { 'Content-Type': 'application/json' } })
        return response()
      },
    })
    state.audit = () => transport.audit()
    Reflect.set(window, 'deadlineTest', state)
    void transport.request({ method: 'GET', path: '/api/v3/conversations/deadline_fixture_0001', headers: {}, credentials: 'include' })
      .then(() => { state.result = 'success' }, error => { state.result = error.message })
  }, mode)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'deadlineTest').started)).toBe(true)
  await page.clock.runFor(29_999)
  expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').result)).toBe('pending')
  await page.clock.runFor(1)
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'deadlineTest').result)).toBe('SERVICE_V03_READ_TIMEOUT')
  expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').signal.aborted)).toBe(true)
  await page.evaluate(() => Reflect.get(window, 'deadlineTest').finish())
  await page.clock.runFor(100)
  expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').audit())).toEqual({ requestCount: 1, responses: [] })
  if (mode === 'body') expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').cancels)).toBe(1)
})

test('QUERY만 만료하며 병행 MUTATION과 후속 QUERY는 정상 완료한다', async ({ page }) => {
  await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const state = { outcomes: ['pending', 'pending'], signals: [] as AbortSignal[], finish: () => {}, follow: async () => {}, audit: () => ({ requestCount: 0, responses: [] as readonly unknown[] }) }
    let reads = 0
    const response = () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    const transport = createServiceV03HttpTransport({ csrfTokenProvider: () => 'csrf_deadline_fixture_0001', fetchImplementation: async (_url, init) => {
      state.signals.push(init?.signal as AbortSignal)
      if (init?.method === 'GET') return ++reads > 1 ? response() : new Promise<Response>(() => {})
      return new Promise<Response>(resolve => { state.finish = () => resolve(response()) })
    } })
    const query = () => transport.request({ method: 'GET' as const, path: '/api/v3/strategy-drafts/deadline_fixture_0001', headers: {}, credentials: 'include' as const })
    void query().then(() => { state.outcomes[0] = 'success' }, error => { state.outcomes[0] = error.message })
    void transport.request({ method: 'POST', path: '/api/v3/conversations', headers: { 'Idempotency-Key': 'deadline_mutation_fixture_0001' }, body: {}, credentials: 'include' })
      .then(() => { state.outcomes[1] = 'success' }, error => { state.outcomes[1] = error.message })
    state.follow = async () => { await query() }
    state.audit = () => transport.audit()
    Reflect.set(window, 'deadlineTest', state)
  })
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'deadlineTest').signals.length)).toBe(2)
  await page.clock.runFor(30_000)
  expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').outcomes)).toEqual(['SERVICE_V03_READ_TIMEOUT', 'pending'])
  expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').signals.map((signal: AbortSignal) => signal.aborted))).toEqual([true, false])
  await page.evaluate(() => Reflect.get(window, 'deadlineTest').finish())
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'deadlineTest').outcomes[1])).toBe('success')
  await page.evaluate(() => Reflect.get(window, 'deadlineTest').follow())
  await page.clock.runFor(30_000)
  expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').signals.map((signal: AbortSignal) => signal.aborted))).toEqual([true, false, false])
  expect(await page.evaluate(() => Reflect.get(window, 'deadlineTest').audit().responses.length)).toBe(2)
})

for (const method of ['GET', 'POST'] as const) test(`명시 취소 후 늦은 ${method} 응답은 성공이나 관측 기록이 되지 않는다`, async ({ page }) => {
  const result = await page.evaluate(async method => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let release: (value: Response) => void = () => {}
    let started: () => void = () => {}
    const gate = new Promise<void>(resolve => { started = resolve })
    const transport = createServiceV03HttpTransport({ csrfTokenProvider: () => 'csrf_explicit_abort_fixture_0001', fetchImplementation: async () => {
      started()
      return new Promise<Response>(resolve => { release = resolve })
    } })
    const pending = transport.request(method === 'GET'
      ? { method, path: '/api/v3/conversations/deadline_fixture_0001', headers: {}, credentials: 'include' }
      : { method, path: '/api/v3/conversations', headers: { 'Idempotency-Key': 'explicit_abort_fixture_0001' }, body: {}, credentials: 'include' })
      .then(() => 'success', error => error.name)
    await gate
    transport.abortInFlight()
    release(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    Reflect.set(window, 'explicitAbortAudit', () => transport.audit())
    return { result: await pending, audit: transport.audit() }
  }, method)
  expect(result).toEqual({ result: 'AbortError', audit: { requestCount: 1, responses: [] } })
  await page.clock.runFor(30_000)
  expect(await page.evaluate(() => Reflect.get(window, 'explicitAbortAudit')())).toEqual({ requestCount: 1, responses: [] })
})

for (const method of ['GET', 'POST'] as const) for (const failure of ['type', 'bytes'] as const) test(`비정상 ${method} ${failure} 응답의 정리 hook이 멈춰도 오류 반환을 지연하지 않는다`, async ({ page }) => {
  await page.evaluate(async ({ method, failure }) => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const state = { result: 'pending', cancels: 0, audit: () => ({ requestCount: 0, responses: [] as readonly unknown[] }) }
    const transport = createServiceV03HttpTransport({ maxResponseBytes: 64, csrfTokenProvider: () => 'csrf_cleanup_fixture_0001', fetchImplementation: async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array(200)) },
      cancel() { state.cancels++; return new Promise<void>(() => {}) },
    }), { headers: { 'Content-Type': failure === 'type' ? 'text/plain' : 'application/json' } }) })
    state.audit = () => transport.audit()
    Reflect.set(window, 'cleanupTest', state)
    void transport.request(method === 'GET'
      ? { method, path: '/api/v3/conversations/deadline_fixture_0001', headers: {}, credentials: 'include' }
      : { method, path: '/api/v3/conversations', headers: { 'Idempotency-Key': 'cleanup_fixture_mutation_0001' }, body: {}, credentials: 'include' })
      .then(() => { state.result = 'success' }, error => { state.result = error.message })
  }, { method, failure })
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'cleanupTest').result)).toBe(failure === 'type' ? 'SERVICE_V03_JSON_RESPONSE_REQUIRED' : 'SERVICE_V03_RESPONSE_TOO_LARGE')
  expect(await page.evaluate(() => Reflect.get(window, 'cleanupTest').cancels)).toBe(1)
  await page.clock.runFor(30_000)
  expect(await page.evaluate(() => Reflect.get(window, 'cleanupTest').audit())).toEqual({ requestCount: 1, responses: [] })
})
