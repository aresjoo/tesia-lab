import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

interface RecordedTrace {
  readonly snapshots: { readonly ready: unknown }
  readonly approvalAuthority: { readonly receipt: unknown }
}

const trace = JSON.parse(
  await readFile('tests/fixtures/service-v03/recorded-conversation.json', 'utf8'),
) as RecordedTrace

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
})

test('generated client가 transport를 직접 소비하며 same-origin·CSRF·ETag·idempotency를 보존한다', async ({ page }) => {
  // Isolate this storage-leak assertion from the home's async UI persistence.
  // Other origin-policy tests still use their original navigation responses.
  await page.route(page.url(), (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><html><body></body></html>',
  }))
  await page.reload()
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  const result = await page.evaluate(async ({ ready, receipt }) => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: string | null; credentials?: string; mode?: string }> = []
    let csrfCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => { csrfCalls += 1; return 'csrf_http_provider_private_0001' },
      fetchImplementation: async (input, init) => {
        calls.push({
          url: String(input), method: String(init?.method),
          headers: Object.fromEntries(new Headers(init?.headers).entries()),
          body: typeof init?.body === 'string' ? init.body : null,
          credentials: init?.credentials, mode: init?.mode,
        })
        const data = calls.length === 1 ? ready : receipt
        return new Response(JSON.stringify(envelope(data, calls.length)), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ETag: '"conversation-state-fixture-0004"' },
        })
      },
    })
    const client = new TesiaConversationV03Client(transport)
    const loaded = await client.callWithResponse('getConversationV3', { conversationId: 'conversation_fixture_0001' })
    const snapshot = loaded.body.data
    const validation = await client.callWithResponse('validateStrategyDraftV3', {
      draftId: snapshot.draftId,
      body: {
        expectedConversationStateRevision: snapshot.conversationStateRevision,
        expectedConversationStateHash: snapshot.conversationStateHash,
      },
      context: {
        csrfToken: 'generated_client_placeholder_0001',
        idempotencyKey: 'http_validate_idempotency_01',
        ifMatch: loaded.etag,
      },
    })
    return {
      loadedStatus: loaded.status, validationStatus: validation.status, calls, csrfCalls,
      origin: location.origin,
      audit: transport.audit(),
      state: { local: localStorage.length, session: sessionStorage.length, cookie: document.cookie },
      exposed: document.body.textContent,
    }

    function envelope(data: unknown, sequence: number) {
      return {
        meta: {
          apiContractVersion: '0.3.0', requestId: `req_http_fixture_000${sequence}`,
          traceId: `trace_http_fixture_00${sequence}`, resourceRevision: '4',
        },
        data,
      }
    }
  }, { ready: trace.snapshots.ready, receipt: trace.approvalAuthority.receipt })

  expect(result.loadedStatus).toBe(200)
  expect(result.validationStatus).toBe(200)
  expect(result.csrfCalls).toBe(1)
  expect(result.calls).toHaveLength(2)
  expect(result.calls[0]).toMatchObject({
    url: `${result.origin}/api/v3/conversations/conversation_fixture_0001`, method: 'GET',
    credentials: 'same-origin', mode: 'same-origin', body: null,
  })
  expect(result.calls[0]?.headers['x-csrf-token']).toBeUndefined()
  expect(result.calls[0]?.headers['content-type']).toBeUndefined()
  expect(result.calls[1]?.headers).toMatchObject({
    'content-type': 'application/json', 'x-csrf-token': 'csrf_http_provider_private_0001',
    'idempotency-key': 'http_validate_idempotency_01', 'if-match': '"conversation-state-fixture-0004"',
  })
  expect(result.audit.requestCount).toBe(2)
  expect(result.audit.responses).toHaveLength(2)
  expect(result.audit.responses.every((item) => /^[0-9a-f]{64}$/.test(item.bodySha256))).toBe(true)
  expect(JSON.stringify(result.audit)).not.toContain('csrf_http_provider_private_0001')
  expect(result.state).toEqual({ local: 0, session: 0, cookie: '' })
  expect(result.exposed).not.toContain('csrf_http_provider_private_0001')
})

test('응답 유실 뒤 generated client 재시도도 같은 idempotency key를 유지한다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    const keys: Array<string | null> = []
    let calls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0002',
      fetchImplementation: async (_input, init) => {
        calls += 1
        keys.push(new Headers(init?.headers).get('idempotency-key'))
        if (calls === 1) throw new TypeError('synthetic connection loss')
        return new Response(JSON.stringify(envelope(ready, calls)), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ETag: '"conversation-state-fixture-0004"' },
        })
      },
    })
    const client = new TesiaConversationV03Client(transport)
    const input = {
      body: {},
      context: { csrfToken: 'generated_client_placeholder_0002', idempotencyKey: 'http_create_retry_exact_01' },
    } as const
    const first = await capture(client.callWithResponse('createConversationV3', input))
    const second = await capture(client.callWithResponse('createConversationV3', input))
    return { first, second, keys, audit: transport.audit() }

    async function capture(promise: Promise<unknown>) {
      try { return { ok: true, value: await promise } } catch (error) {
        return { ok: false, name: error instanceof Error ? error.name : 'Unknown', message: error instanceof Error ? error.message : 'UNKNOWN' }
      }
    }
    function envelope(data: unknown, sequence: number) {
      return { meta: { apiContractVersion: '0.3.0', requestId: `req_http_retry_0000${sequence}`, traceId: `trace_http_retry_000${sequence}`, resourceRevision: '4' }, data }
    }
  }, trace.snapshots.ready)

  expect(result.first).toMatchObject({ ok: false, message: 'SERVICE_V03_HTTP_TRANSPORT_UNAVAILABLE' })
  expect(result.second).toMatchObject({ ok: true, value: { status: 201 } })
  expect(result.keys).toEqual(['http_create_retry_exact_01', 'http_create_retry_exact_01'])
  expect(result.audit).toMatchObject({ requestCount: 2, responses: [expect.objectContaining({ status: 201 })] })
})

test('교차 origin과 계약 밖 endpoint는 fetch 전에 거부한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let fetchCalls = 0
    let csrfCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => { csrfCalls += 1; return 'csrf_http_provider_private_0003' },
      fetchImplementation: async () => { fetchCalls += 1; throw new Error('MUST_NOT_FETCH') },
    })
    const rejected: string[] = []
    for (const path of ['https://attacker.invalid/api/v3/conversations', '/api/v3/orders']) {
      try { await transport.request({ method: 'POST', path, headers: {}, body: {}, credentials: 'include' }) }
      catch (error) { rejected.push(error instanceof Error ? error.message : 'UNKNOWN') }
    }
    return { fetchCalls, csrfCalls, rejected, audit: transport.audit() }
  })
  expect(result).toMatchObject({
    fetchCalls: 0, csrfCalls: 0,
    rejected: ['SERVICE_V03_CROSS_ORIGIN_REJECTED', 'SERVICE_V03_OPERATION_REJECTED'],
    audit: { requestCount: 0, responses: [] },
  })
})

test('계약 밖 Authorization·caller CSRF 헤더를 전달하지 않는다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let observed: Record<string, string> = {}
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0008',
      fetchImplementation: async (_input, init) => {
        observed = Object.fromEntries(new Headers(init?.headers).entries())
        return new Response('{}', { status: 400, headers: { 'Content-Type': 'application/json' } })
      },
    })
    await transport.request({
      method: 'GET', path: '/api/v3/conversations/conversation_fixture_0001',
      headers: { Authorization: 'Bearer must_not_forward', 'X-CSRF-Token': 'csrf_must_not_forward_0001' },
      credentials: 'include',
    })
    return { observed, audit: transport.audit() }
  })
  expect(result.observed).toEqual({ accept: 'application/json' })
  expect(JSON.stringify(result.audit)).not.toContain('must_not_forward')
})

test('CSRF provider 누락은 generated mutation을 fetch 전에 fail-close 한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    let fetchCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => null,
      fetchImplementation: async () => { fetchCalls += 1; throw new Error('MUST_NOT_FETCH') },
    })
    let message = ''
    try {
      await new TesiaConversationV03Client(transport).callWithResponse('createConversationV3', {
        body: {}, context: { csrfToken: 'generated_client_placeholder_0003', idempotencyKey: 'http_missing_csrf_0001' },
      })
    } catch (error) { message = error instanceof Error ? error.message : 'UNKNOWN' }
    return { message, fetchCalls, audit: transport.audit() }
  })
  expect(result).toEqual({ message: 'SERVICE_V03_CSRF_UNAVAILABLE', fetchCalls: 0, audit: { requestCount: 0, responses: [] } })
})

test('성공 응답의 strong ETag 누락을 generated client가 fail-close 한다', async ({ page }) => {
  const result = await page.evaluate(async (ready) => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0004',
      fetchImplementation: async () => new Response(JSON.stringify({
        meta: { apiContractVersion: '0.3.0', requestId: 'req_http_no_etag_0001', traceId: 'trace_http_no_etag_001', resourceRevision: '4' }, data: ready,
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
    })
    try {
      await new TesiaConversationV03Client(transport).callWithResponse('createConversationV3', {
        body: {}, context: { csrfToken: 'generated_client_placeholder_0004', idempotencyKey: 'http_missing_etag_0001' },
      })
      return null
    } catch (error) {
      return { message: error instanceof Error ? error.message : 'UNKNOWN', status: Reflect.get(Object(error), 'status'), code: Reflect.get(Object(error), 'code') }
    }
  }, trace.snapshots.ready)
  expect(result).toEqual({ message: 'INVALID_API_V03_RESPONSE', status: 201, code: 'INVALID_API_V03_RESPONSE' })
})

test('계약의 HTTP error code/status를 변형 없이 generated mapping에 전달한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0005',
      fetchImplementation: async () => new Response(JSON.stringify({
        meta: { apiContractVersion: '0.3.0', requestId: 'req_http_error_000001', traceId: 'trace_http_error_00001', resourceRevision: null },
        error: { code: 'CSRF_INVALID', message: 'CSRF validation failed.' },
      }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
    })
    try {
      await new TesiaConversationV03Client(transport).callWithResponse('createConversationV3', {
        body: {}, context: { csrfToken: 'generated_client_placeholder_0005', idempotencyKey: 'http_error_mapping_0001' },
      })
      return { error: null, audit: transport.audit() }
    } catch (error) {
      return { error: { status: Reflect.get(Object(error), 'status'), code: Reflect.get(Object(error), 'code') }, audit: transport.audit() }
    }
  })
  expect(result.error).toEqual({ status: 403, code: 'CSRF_INVALID' })
  expect(result.audit.responses[0]).toMatchObject({ operationId: 'createConversationV3', status: 403, etag: null })
})

test('abortInFlight가 진행 중 fetch를 중단한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    let observedSignal: AbortSignal | null = null
    let startedResolve: (() => void) | undefined
    const started = new Promise<void>((resolve) => { startedResolve = resolve })
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0006',
      fetchImplementation: async (_input, init) => {
        observedSignal = init?.signal as AbortSignal
        startedResolve?.()
        return new Promise<Response>((_resolve, reject) => observedSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))
      },
    })
    const pending = new TesiaConversationV03Client(transport).callWithResponse('createConversationV3', {
      body: {}, context: { csrfToken: 'generated_client_placeholder_0006', idempotencyKey: 'http_abort_request_00001' },
    })
    await started
    transport.abortInFlight()
    let error = { name: '', message: '' }
    try { await pending } catch (caught) { error = { name: caught instanceof Error ? caught.name : '', message: caught instanceof Error ? caught.message : '' } }
    return { error, aborted: observedSignal?.aborted ?? false, audit: transport.audit() }
  })
  expect(result.error).toEqual({ name: 'AbortError', message: 'Aborted' })
  expect(result.aborted).toBe(true)
  expect(result.audit).toEqual({ requestCount: 1, responses: [] })
})

test('CSRF provider 대기 중 abort는 provider 해제 뒤에도 fetch를 시작하지 않는다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const { TesiaConversationV03Client } = await import('/src/internal-poc/contracts/generated/api-v0.3/client.ts')
    let providerResolve: ((value: string) => void) | undefined
    let providerStartedResolve: (() => void) | undefined
    const providerStarted = new Promise<void>((resolve) => { providerStartedResolve = resolve })
    let fetchCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => {
        providerStartedResolve?.()
        return new Promise<string>((resolve) => { providerResolve = resolve })
      },
      fetchImplementation: async () => { fetchCalls += 1; throw new Error('MUST_NOT_FETCH') },
    })
    const pending = new TesiaConversationV03Client(transport).callWithResponse('createConversationV3', {
      body: {}, context: { csrfToken: 'generated_client_placeholder_0007', idempotencyKey: 'http_pending_csrf_abort_01' },
    })
    await providerStarted
    transport.abortInFlight()
    providerResolve?.('csrf_http_provider_private_0007')
    let error = { name: '', message: '' }
    try { await pending } catch (caught) { error = { name: caught instanceof Error ? caught.name : '', message: caught instanceof Error ? caught.message : '' } }
    return { error, fetchCalls, audit: transport.audit() }
  })
  expect(result.error).toEqual({ name: 'AbortError', message: 'Aborted' })
  expect(result.fetchCalls).toBe(0)
  expect(result.audit).toEqual({ requestCount: 0, responses: [] })
})

test('잘못된 JSON과 streamed byte 상한 초과를 응답으로 승격하지 않는다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    const messages: string[] = []
    for (const [index, body] of ['{broken', JSON.stringify({ value: 'x'.repeat(256) })].entries()) {
      const transport = createServiceV03HttpTransport({
        csrfTokenProvider: () => 'csrf_http_provider_private_0009',
        maxResponseBytes: index === 0 ? 1024 : 64,
        fetchImplementation: async () => new Response(body, { status: 201, headers: { 'Content-Type': 'application/json' } }),
      })
      try {
        await transport.request({ method: 'POST', path: '/api/v3/conversations', headers: { 'Idempotency-Key': `http_invalid_body_0000${index}` }, body: {}, credentials: 'include' })
      } catch (error) { messages.push(error instanceof Error ? error.message : 'UNKNOWN') }
    }
    return messages
  })
  expect(result).toEqual(['SERVICE_V03_RESPONSE_JSON_INVALID', 'SERVICE_V03_RESPONSE_TOO_LARGE'])
})

test('비정상 Content-Length는 body를 best-effort cancel하고 fail-close 한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let cancelCalls = 0
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{}')) },
      cancel() { cancelCalls += 1 },
    })
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0010',
      fetchImplementation: async () => new Response(stream, {
        status: 201,
        headers: { 'Content-Type': 'application/json', 'Content-Length': '999999999999999999999' },
      }),
    })
    let message = ''
    try {
      await transport.request({ method: 'POST', path: '/api/v3/conversations', headers: { 'Idempotency-Key': 'http_bad_length_cancel_01' }, body: {}, credentials: 'include' })
    } catch (error) { message = error instanceof Error ? error.message : 'UNKNOWN' }
    return { message, cancelCalls, audit: transport.audit() }
  })
  expect(result).toEqual({ message: 'SERVICE_V03_RESPONSE_TOO_LARGE', cancelCalls: 1, audit: { requestCount: 1, responses: [] } })
})

test('non-JSON Content-Type은 body를 cancel한 뒤 fail-close 한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let cancelCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0011',
      fetchImplementation: async () => new Response(new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new TextEncoder().encode('not-json')) },
        cancel() { cancelCalls += 1 },
      }), { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    })
    let message = ''
    try {
      await transport.request({ method: 'GET', path: '/api/v3/conversations/conversation_fixture_0001', headers: {}, credentials: 'include' })
    } catch (error) { message = error instanceof Error ? error.message : 'UNKNOWN' }
    return { message, cancelCalls, audit: transport.audit() }
  })
  expect(result).toEqual({ message: 'SERVICE_V03_JSON_RESPONSE_REQUIRED', cancelCalls: 1, audit: { requestCount: 1, responses: [] } })
})

test('cross-origin response는 body를 cancel한 뒤 fail-close 한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let cancelCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0012',
      fetchImplementation: async () => {
        const response = new Response(new ReadableStream<Uint8Array>({
          start(controller) { controller.enqueue(new TextEncoder().encode('{}')) },
          cancel() { cancelCalls += 1 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        Object.defineProperty(response, 'url', { value: 'https://attacker.invalid/api/v3/conversations/conversation_fixture_0001' })
        return response
      },
    })
    let message = ''
    try {
      await transport.request({ method: 'GET', path: '/api/v3/conversations/conversation_fixture_0001', headers: {}, credentials: 'include' })
    } catch (error) { message = error instanceof Error ? error.message : 'UNKNOWN' }
    return { message, cancelCalls, audit: transport.audit() }
  })
  expect(result).toEqual({ message: 'SERVICE_V03_CROSS_ORIGIN_RESPONSE_REJECTED', cancelCalls: 1, audit: { requestCount: 1, responses: [] } })
})

test('idempotency key와 If-Match의 malformed 값은 CSRF·fetch 전에 거부한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let csrfCalls = 0
    let fetchCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => { csrfCalls += 1; return 'csrf_http_provider_private_0013' },
      fetchImplementation: async () => { fetchCalls += 1; throw new Error('MUST_NOT_FETCH') },
    })
    const attempts = [
      { 'Idempotency-Key': '', 'If-Match': '"conversation-state-fixture-0004"' },
      { 'Idempotency-Key': 'short', 'If-Match': '"conversation-state-fixture-0004"' },
      { 'Idempotency-Key': 'http_header_check_0000\n', 'If-Match': '"conversation-state-fixture-0004"' },
      { 'Idempotency-Key': 'http_header_check_0001', 'If-Match': '' },
      { 'Idempotency-Key': 'http_header_check_0001', 'If-Match': 'weak-or-empty' },
      { 'Idempotency-Key': 'http_header_check_0002', 'If-Match': '"conversation-state-fixture-0004\n"' },
    ]
    const messages: string[] = []
    for (const headers of attempts) {
      try {
        await transport.request({ method: 'POST', path: '/api/v3/strategy-drafts/draft_fixture_00000001/validate', headers, body: {}, credentials: 'include' })
      } catch (error) { messages.push(error instanceof Error ? error.message : 'UNKNOWN') }
    }
    return { messages, csrfCalls, fetchCalls, audit: transport.audit() }
  })
  expect(result).toEqual({
    messages: [
      'SERVICE_V03_IDEMPOTENCY_KEY_INVALID',
      'SERVICE_V03_IDEMPOTENCY_KEY_INVALID',
      'SERVICE_V03_IDEMPOTENCY_KEY_INVALID',
      'SERVICE_V03_IF_MATCH_INVALID',
      'SERVICE_V03_IF_MATCH_INVALID',
      'SERVICE_V03_IF_MATCH_INVALID',
    ],
    csrfCalls: 0, fetchCalls: 0, audit: { requestCount: 0, responses: [] },
  })
})

test('invalid response limit은 CSRF provider보다 먼저 fail-close 한다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let csrfCalls = 0
    let fetchCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => { csrfCalls += 1; return 'csrf_http_provider_private_0014' },
      maxResponseBytes: 0,
      fetchImplementation: async () => { fetchCalls += 1; throw new Error('MUST_NOT_FETCH') },
    })
    let message = ''
    try {
      await transport.request({ method: 'POST', path: '/api/v3/conversations', headers: { 'Idempotency-Key': 'http_invalid_limit_0001' }, body: {}, credentials: 'include' })
    } catch (error) { message = error instanceof Error ? error.message : 'UNKNOWN' }
    return { message, csrfCalls, fetchCalls, audit: transport.audit() }
  })
  expect(result).toEqual({ message: 'SERVICE_V03_RESPONSE_LIMIT_INVALID', csrfCalls: 0, fetchCalls: 0, audit: { requestCount: 0, responses: [] } })
})

test('insecure non-loopback HTTP origin은 fetch 전에 stable error로 거부한다', async ({ page }) => {
  const unsafeUrl = new URL(page.url())
  unsafeUrl.hostname = '0.0.0.0'
  await page.goto(unsafeUrl.href)
  const result = await page.evaluate(async () => {
    const { createServiceV03HttpTransport } = await import('/src/internal-poc/service-v03-http-adapter.ts')
    let fetchCalls = 0
    const transport = createServiceV03HttpTransport({
      csrfTokenProvider: () => 'csrf_http_provider_private_0015',
      fetchImplementation: async () => { fetchCalls += 1; throw new Error('MUST_NOT_FETCH') },
    })
    let message = ''
    try {
      await transport.request({ method: 'GET', path: '/api/v3/conversations/conversation_fixture_0001', headers: {}, credentials: 'include' })
    } catch (error) { message = error instanceof Error ? error.message : 'UNKNOWN' }
    return { message, fetchCalls, audit: transport.audit() }
  })
  expect(result).toEqual({ message: 'SERVICE_V03_INSECURE_ORIGIN_REJECTED', fetchCalls: 0, audit: { requestCount: 0, responses: [] } })
})

test('module은 transport-only이며 recorded Mock state provenance에 결선하지 않는다', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const module = await import('/src/internal-poc/service-v03-http-adapter.ts')
    return {
      exports: Object.keys(module).sort(),
      hasHighLevelFactory: 'createServiceV03HttpAdapter' in module,
      hasHighLevelClass: 'ServiceV03HttpAdapter' in module,
    }
  })
  expect(result).toEqual({ exports: ['createServiceV03HttpTransport'], hasHighLevelFactory: false, hasHighLevelClass: false })
  const source = await readFile('src/internal-poc/service-v03-http-adapter.ts', 'utf8')
  expect(source).not.toContain('createServiceV03Adapter')
  expect(source).not.toContain("from './service-v03-adapter'")
  expect(source).not.toContain('CONTRACT_V03_RECORDED_MOCK')
  expect(source).not.toContain('mockOnly')
})
