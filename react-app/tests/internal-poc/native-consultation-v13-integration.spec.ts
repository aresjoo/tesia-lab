import { expect, test } from '@playwright/test'
import { ConsultationV13Adapter } from '../../src/internal-poc/consultation-v13-adapter'
import { NativeConsultationV13Controller, type ConsultationV13Snapshot } from '../../src/internal-poc/native-consultation-v13-controller'

const origin = 'https://service.example.test'
const wireHeaders = (type = 'application/json') => ({ 'Content-Type': type, 'Cache-Control': 'no-store' })
const envelope = (data: unknown) => JSON.stringify({ apiContractVersion: '0.13.0', data })
const usage = { status: 'UNKNOWN', inputTokens: null, outputTokens: null } as const
const turnId = 'turn_synthetic_000001', conversationId = 'conversation_synthetic_01'
const timestamp = '2026-10-07T00:00:00Z'
const capability = { available: true, reason: null, maxTextChars: 16000, maxPageItems: 100, researchEvents: 'OBSERVATIONS_ONLY', executionAuthority: false }
const session = { sessionId: 'session_consultation_browser_01', state: 'ANONYMOUS', revision: '1', issuedAt: timestamp, expiresAt: '2030-10-08T00:00:00Z' }
const meta = (version: string, revision: string | null) => ({ apiContractVersion: version, requestId: 'request_consultation_browser_01', traceId: 'trace_consultation_browser_01', resourceRevision: revision })
const browserHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="internal-poc-root"></div><script type="module">
import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
const React=await import('/@id/react'),DOM=await import('/@id/react-dom/client'),App=await import('/src/internal-poc/NativeServiceApp.tsx'),Router=await import('/src/components/SiteRouter.tsx');
const h=React.createElement??React.default.createElement,StrictMode=React.StrictMode??React.default.StrictMode;
(DOM.createRoot??DOM.default.createRoot)(document.getElementById('internal-poc-root')).render(h(StrictMode,null,h(Router.SiteRouter,{service:true},h(App.NativeServiceApp,{consultationEnabled:true}))));
</script></body></html>`
const memoryStorage = () => {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}

const waitFor = async (controller: NativeConsultationV13Controller, accept: (snapshot: ConsultationV13Snapshot) => boolean) => {
  if (accept(controller.getSnapshot())) return controller.getSnapshot()
  return new Promise<ConsultationV13Snapshot>((resolve, reject) => {
    const timeout = setTimeout(() => { unsubscribe(); reject(Error('fixture timeout')) }, 2_000)
    const unsubscribe = controller.subscribe(snapshot => {
      if (!accept(snapshot)) return
      clearTimeout(timeout); unsubscribe(); resolve(snapshot)
    })
  })
}

test('anonymous owner streams into the existing message renderer shape and EOF reconnect never redispatches', async () => {
  const methods: string[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET'
    methods.push(`${method} ${url.pathname}${url.search}`)
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (method === 'POST') {
      const request = JSON.parse(String(init?.body))
      return new Response(envelope({ turnId, conversationId, clientMessageId: request.clientMessageId, state: 'QUEUED', createdAt: timestamp, updatedAt: timestamp,
        userText: request.text, answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    if (init?.headers && new Headers(init.headers).get('accept') === 'text/event-stream') {
      const first = { turnId, sequence: 1, observedAt: timestamp, payload: { type: 'answer_delta', text: 'e' } }
      const second = { turnId, sequence: 2, observedAt: timestamp, payload: { type: 'answer_delta', text: '\u0301 답변' } }
      return new Response(`event:consultation\nid:1\ndata:${JSON.stringify(first)}\n\nevent:consultation\nid:2\ndata:${JSON.stringify(second)}\n\n`, { status: 200, headers: wireHeaders('text/event-stream') })
    }
    if (url.pathname.endsWith('/events')) {
      const terminal = { turnId, sequence: 3, observedAt: timestamp, payload: { type: 'terminal', state: 'COMPLETED', usage, failureCode: null } }
      return new Response(envelope({ turnId, after: 2, nextSequence: 3, events: [terminal], hasMore: false, terminal: true, limit: 100 }), { status: 200, headers: wireHeaders() })
    }
    throw Error(`unexpected fixture route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf_synthetic' }), { storage: memoryStorage(), wait: async () => {}, randomId: () => '00000000-0000-4000-8000-000000000001' })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS']))
  await controller.activate()
  expect(controller.getSnapshot().availability).toBe('available')
  expect(await controller.send('질문', '화면 질문')).toBe(true)
  const done = await waitFor(controller, state => !state.busy && state.messages.length === 2)
  expect(done.messages[0]).toMatchObject({ role: 'user', text: '질문', displayText: '화면 질문' })
  expect(done.messages[1].responseBlocks).toEqual([{ id: `${turnId}_reply_text`, kind: 'text', text: 'é 답변', status: 'done' }])
  expect(methods.filter(value => value === 'POST /api/v13/consultation/turns')).toHaveLength(1)
  expect(methods).toContain(`GET /api/v13/consultation/turns/${turnId}/events?after=2&limit=100`)
})

test('explicit stop alone sends cancel once; cancel 500 keeps partial text interrupted', async () => {
  let cancelCalls = 0, streamSignal: AbortSignal | undefined
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET'
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (method === 'POST' && url.pathname.endsWith('/turns')) {
      const request = JSON.parse(String(init?.body))
      return new Response(envelope({ turnId, conversationId, clientMessageId: request.clientMessageId, state: 'QUEUED', createdAt: timestamp, updatedAt: timestamp,
        userText: request.text, answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    if (method === 'POST' && url.pathname.endsWith('/cancel')) {
      cancelCalls++
      return new Response(JSON.stringify({ apiContractVersion: '0.13.0', error: { code: 'INTERNAL_ERROR', message: 'Consultation request failed.' } }), { status: 500, headers: wireHeaders() })
    }
    if (url.pathname.endsWith(`/turns/${turnId}`)) {
      const clientMessageId = controller.getSnapshot().messages[0].id
      return new Response(envelope({ turnId, conversationId, clientMessageId, state: 'FAILED', createdAt: timestamp, updatedAt: timestamp,
        userText: '중지 질문', answerText: '부분 답변', lastSequence: 2, terminalSequence: 2, cancelRequested: true, usage, failureCode: 'INTERNAL_ERROR' }), { status: 200, headers: wireHeaders() })
    }
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') {
      if (url.searchParams.get('after') === '1') {
        const terminal = { turnId, sequence: 2, observedAt: timestamp, payload: { type: 'terminal', state: 'FAILED', usage, failureCode: 'INTERNAL_ERROR' } }
        return new Response(`event:consultation\nid:2\ndata:${JSON.stringify(terminal)}\n\n`, { status: 200, headers: wireHeaders('text/event-stream') })
      }
      streamSignal = init?.signal ?? undefined
      const delta = { turnId, sequence: 1, observedAt: timestamp, payload: { type: 'answer_delta', text: '부분 답변' } }
      const encoded = new TextEncoder().encode(`event:consultation\nid:1\ndata:${JSON.stringify(delta)}\n\n`)
      return new Response(new ReadableStream({ start(stream) {
        stream.enqueue(encoded)
        streamSignal?.addEventListener('abort', () => stream.error(new DOMException('aborted', 'AbortError')), { once: true })
      } }), { status: 200, headers: wireHeaders('text/event-stream') })
    }
    throw Error(`unexpected fixture route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf_synthetic' }), { storage: memoryStorage(), wait: async () => {}, randomId: () => '00000000-0000-4000-8000-000000000002' })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS']))
  await controller.activate(); await controller.send('중지 질문')
  await waitFor(controller, state => state.messages[1]?.responseBlocks?.[0]?.kind === 'text' && state.messages[1].responseBlocks[0].text === '부분 답변')
  await controller.stop()
  const stopped = await waitFor(controller, state => !state.busy)
  expect(cancelCalls).toBe(1)
  expect(stopped.busy).toBe(false)
  expect(stopped.messages[1].responseBlocks).toEqual([{ id: `${turnId}_reply_text`, kind: 'text', text: '부분 답변', status: 'interrupted' }])
})

test('detach and unavailable capability never cancel, dispatch or fall back to the legacy compiler', async () => {
  let calls = 0, mutations = 0
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async (_input, init) => {
    calls++; if (init?.method === 'POST') mutations++
    return new Response(envelope({ ...capability, available: false, reason: 'DISABLED' }), { status: 200, headers: wireHeaders() })
  } })
  const controller = new NativeConsultationV13Controller(adapter, { storage: memoryStorage() })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS']))
  await controller.activate()
  expect(controller.getSnapshot()).toMatchObject({ availability: 'unavailable', issue: 'unavailable', messages: [], busy: false })
  expect(await controller.send('보존 입력')).toBe(false)
  controller.detach()
  expect({ calls, mutations }).toEqual({ calls: 1, mutations: 0 })
})

test('late history is rejected after owner epoch changes', async () => {
  let releaseHistory!: () => void
  const held = new Promise<void>(resolve => { releaseHistory = resolve })
  let clientMessageId = ''
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET'
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (method === 'POST') {
      const request = JSON.parse(String(init?.body)); clientMessageId = request.clientMessageId
      return new Response(envelope({ turnId, conversationId, clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
        userText: request.text, answerText: '완료', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/history')) {
      await held
      return new Response(envelope({ conversationId, snapshotId: 'snapshot_synthetic_0001', offset: 0, limit: 100, totalCount: 1,
        turns: [{ turnId, conversationId, clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, userText: '질문', answerText: '완료', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }], nextCursor: null }), { status: 200, headers: wireHeaders() })
    }
    throw Error(`unexpected fixture route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), { storage: memoryStorage(), randomId: () => '00000000-0000-4000-8000-000000000003' })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS']))
  await controller.activate(); await controller.send('질문')
  const history = controller.history()
  controller.bindOwner(JSON.stringify(['authenticated_session_2', 'AUTHENTICATED']))
  releaseHistory()
  await expect(history).resolves.toBeNull()
})

test('create is single-flight and an uncertain response retries only the exact persisted key and body', async () => {
  const storage = memoryStorage(), posts: { key: string | null; body: string }[] = []
  let failFirst = true
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    const body = String(init?.body), key = new Headers(init?.headers).get('idempotency-key')
    posts.push({ key, body })
    if (failFirst) { failFirst = false; throw new TypeError('synthetic response loss') }
    const request = JSON.parse(body)
    return new Response(envelope({ turnId, conversationId, clientMessageId: request.clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
      userText: request.text, answerText: '재생 완료', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
  }
  const adapter = new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' })
  let controller = new NativeConsultationV13Controller(adapter, { storage, randomId: () => '00000000-0000-4000-8000-000000000004' })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate()
  const first = controller.send('동일 입력')
  expect(await controller.send('동일 입력')).toBe(false)
  expect(await first).toBe(false)
  controller.detach()
  controller = new NativeConsultationV13Controller(adapter, { storage, randomId: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff' })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate()
  expect(controller.getSnapshot().canResumePending).toBe(true)
  expect(await controller.send('다른 입력')).toBe(false)
  expect(await controller.resumePending()).toBe(true)
  expect(posts).toHaveLength(2)
  expect(posts[1]).toEqual(posts[0])
  expect(controller.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: '재생 완료', status: 'done' })
})

test('pending storage readback failure prevents every create POST', async () => {
  let posts = 0
  const storage = { getItem: () => null, setItem() {}, removeItem() {} }
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async (input, init) => {
    if (new URL(String(input)).pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') posts++
    throw new Error('unexpected create')
  } })
  const controller = new NativeConsultationV13Controller(adapter, { storage, randomId: () => '00000000-0000-4000-8000-000000000005' })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate()
  expect(await controller.send('저장 실패 입력')).toBe(false)
  expect(posts).toBe(0)
  expect(controller.getSnapshot()).toMatchObject({ busy: false, issue: 'request-unconfirmed' })
})

test('valid queued polling continues beyond six reconnects without provider redispatch', async () => {
  let eventPages = 0, createPosts = 0
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), accept = new Headers(init?.headers).get('accept')
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') {
      createPosts++; const request = JSON.parse(String(init.body))
      return new Response(envelope({ turnId, conversationId, clientMessageId: request.clientMessageId, state: 'QUEUED', createdAt: timestamp, updatedAt: timestamp,
        userText: request.text, answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    if (accept === 'text/event-stream') return new Response('', { status: 200, headers: wireHeaders('text/event-stream') })
    const page = ++eventPages
    const events = page < 8 ? [] : [{ turnId, sequence: 1, observedAt: timestamp, payload: { type: 'terminal', state: 'COMPLETED', usage, failureCode: null } }]
    return new Response(envelope({ turnId, after: 0, nextSequence: events.length, events, hasMore: false, terminal: events.length > 0, limit: 100 }), { status: 200, headers: wireHeaders() })
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
    storage: memoryStorage(), wait: async () => {}, randomId: () => '00000000-0000-4000-8000-000000000006',
  })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate(); await controller.send('긴 연구')
  const done = await waitFor(controller, state => !state.busy && state.messages.length === 2)
  expect(done.messages[1].responseBlocks?.[0]).toMatchObject({ status: 'done' })
  expect({ eventPages, createPosts }).toEqual({ eventPages: 8, createPosts: 1 })
})

test('midstream network loss preserves partial text and reconnects from the same cursor without redispatch', async () => {
  let createPosts = 0, streamCalls = 0
  const streamAfter: string[] = [], waits: number[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') {
      createPosts++; const body = JSON.parse(String(init.body))
      return new Response(envelope({ turnId, conversationId, clientMessageId: body.clientMessageId, state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
        userText: body.text, answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') {
      streamCalls++; streamAfter.push(url.searchParams.get('after') ?? '')
      const event = streamCalls === 1
        ? { turnId, sequence: 1, observedAt: timestamp, payload: { type: 'answer_delta', text: '보존된' } }
        : streamCalls === 2
          ? { turnId, sequence: 2, observedAt: timestamp, payload: { type: 'answer_delta', text: ' 부분' } }
          : { turnId, sequence: 3, observedAt: timestamp, payload: { type: 'terminal', state: 'COMPLETED', usage, failureCode: null } }
      const bytes = new TextEncoder().encode(`event:consultation\nid:${event.sequence}\ndata:${JSON.stringify(event)}\n\n`)
      if (streamCalls > 2) return new Response(bytes, { status: 200, headers: wireHeaders('text/event-stream') })
      return new Response(new ReadableStream({ start(stream) {
        stream.enqueue(bytes)
        setTimeout(() => stream.error(new TypeError('network disconnected')), 0)
      } }), { status: 200, headers: wireHeaders('text/event-stream') })
    }
    throw Error(`unexpected fixture route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
    storage: memoryStorage(), reconnectDelayMs: [3, 99], wait: async value => { waits.push(value) }, randomId: () => '00000000-0000-4000-8000-000000000010',
  })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate(); await controller.send('연결 복구')
  const done = await waitFor(controller, state => !state.busy && state.messages.length === 2)
  expect(done.messages[1].responseBlocks?.[0]).toMatchObject({ text: '보존된 부분', status: 'done' })
  expect({ createPosts, streamCalls, streamAfter, waits }).toEqual({ createPosts: 1, streamCalls: 3, streamAfter: ['0', '1', '2'], waits: [3, 3] })
})

test('pending creates are owner-namespaced and a foreign owner record is neither adopted nor deleted', async () => {
  const values = new Map<string, string>(), storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  let posts = 0
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)); posts++
      if (body.text === '익명 미확정') throw new TypeError('response lost')
      return new Response(envelope({ turnId, conversationId, clientMessageId: body.clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
        userText: body.text, answerText: '인증 소유자 완료', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    throw Error(`unexpected fixture route ${url}`)
  }
  const adapter = new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' })
  const anonymousOwner = JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])
  const anonymous = new NativeConsultationV13Controller(adapter, { storage, randomId: () => '00000000-0000-4000-8000-000000000007' })
  anonymous.bindOwner(anonymousOwner); await anonymous.activate()
  expect(await anonymous.send('익명 미확정')).toBe(false)
  const authenticated = new NativeConsultationV13Controller(adapter, { storage, randomId: () => '00000000-0000-4000-8000-000000000008' })
  authenticated.bindOwner(JSON.stringify(['authenticated_session_01', 'AUTHENTICATED'])); await authenticated.activate()
  expect(await authenticated.send('인증 새 요청')).toBe(true)
  expect([...values.keys()].some(key => key.includes('pending:') && key.endsWith(encodeURIComponent(anonymousOwner)))).toBe(true)
  expect(posts).toBe(2)
})

test('accepted locator reload verifies turn and history then resumes observation without another create', async () => {
  const storage = memoryStorage()
  let createPosts = 0
  const firstFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') {
      createPosts++; const body = JSON.parse(String(init.body))
      return new Response(envelope({ turnId, conversationId, clientMessageId: body.clientMessageId, state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
        userText: body.text, answerText: '복구할 부분', lastSequence: 1, terminalSequence: null, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') return new Response(new ReadableStream({ start(stream) {
      init?.signal?.addEventListener('abort', () => stream.error(new DOMException('aborted', 'AbortError')), { once: true })
    } }), { status: 200, headers: wireHeaders('text/event-stream') })
    throw Error(`unexpected first fixture route ${url}`)
  }
  const owner = JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])
  const first = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch: firstFetch, origin, csrfToken: () => 'csrf' }), {
    storage, randomId: () => '00000000-0000-4000-8000-000000000009',
  })
  first.bindOwner(owner); await first.activate(); expect(await first.send('복구 질문')).toBe(true); first.detach()
  let releaseStream!: () => void
  const heldStream = new Promise<void>(resolve => { releaseStream = resolve })
  const recoveredTurn = { turnId, conversationId, clientMessageId: 'client_message_00000000_0000_4000_8000_000000000009', state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
    userText: '복구 질문', answerText: '복구할 부분', lastSequence: 1, terminalSequence: null, cancelRequested: false, usage, failureCode: null }
  const recoveredFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnId}`)) return new Response(envelope(recoveredTurn), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_synthetic_0002', offset: 0, limit: 100, totalCount: 1, turns: [recoveredTurn], nextCursor: null }), { status: 200, headers: wireHeaders() })
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') {
      await heldStream
      const completed = { turnId, sequence: 2, observedAt: timestamp, payload: { type: 'terminal', state: 'COMPLETED', usage, failureCode: null } }
      return new Response(`event:consultation\nid:2\ndata:${JSON.stringify(completed)}\n\n`, { status: 200, headers: wireHeaders('text/event-stream') })
    }
    if (init?.method === 'POST') { createPosts++; throw Error('reload must not create') }
    throw Error(`unexpected recovered fixture route ${url}`)
  }
  const recovered = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch: recoveredFetch, origin, csrfToken: () => 'csrf' }), { storage })
  recovered.bindOwner(owner); await recovered.activate()
  expect(recovered.getSnapshot()).toMatchObject({ availability: 'available', busy: true, conversationId, activeTurnId: turnId })
  expect(recovered.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: '복구할 부분', status: 'streaming' })
  releaseStream()
  const done = await waitFor(recovered, state => !state.busy)
  expect(done.messages[1].responseBlocks?.[0]).toMatchObject({ text: '복구할 부분', status: 'done' })
  expect(createPosts).toBe(1)
})

test('lost cancel response keeps observation and reload retries only the owner-bound cancel key', async () => {
  const storage = memoryStorage(), owner = JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])
  const cancelKeys: string[] = []
  let createPosts = 0
  const activeTurn = { turnId, conversationId, clientMessageId: 'client_message_00000000_0000_4000_8000_000000000011', state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
    userText: '중지 복구', answerText: '중지 부분', lastSequence: 1, terminalSequence: null, cancelRequested: false, usage, failureCode: null }
  const hangingStream = (init?: RequestInit, withPartial = false) => new Response(new ReadableStream({ start(stream) {
    if (withPartial) {
      const delta = { turnId, sequence: 1, observedAt: timestamp, payload: { type: 'answer_delta', text: '중지 부분' } }
      stream.enqueue(new TextEncoder().encode(`event:consultation\nid:1\ndata:${JSON.stringify(delta)}\n\n`))
    }
    init?.signal?.addEventListener('abort', () => stream.error(new DOMException('aborted', 'AbortError')), { once: true })
  } }), { status: 200, headers: wireHeaders('text/event-stream') })
  const firstFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/cancel') && init?.method === 'POST') {
      cancelKeys.push(new Headers(init.headers).get('idempotency-key') ?? ''); throw new TypeError('cancel response lost')
    }
    if (url.pathname.endsWith('/turns') && init?.method === 'POST') {
      createPosts++; const body = JSON.parse(String(init.body))
      return new Response(envelope({ ...activeTurn, clientMessageId: body.clientMessageId, answerText: '', lastSequence: 0 }), { status: 202, headers: wireHeaders() })
    }
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') return hangingStream(init, true)
    throw Error(`unexpected first cancel fixture route ${url}`)
  }
  const first = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch: firstFetch, origin, csrfToken: () => 'csrf' }), {
    storage, randomId: () => '00000000-0000-4000-8000-000000000011',
  })
  first.bindOwner(owner); await first.activate(); await first.send('중지 복구')
  await waitFor(first, state => state.messages[1]?.responseBlocks?.[0]?.text === '중지 부분')
  await first.stop()
  expect(first.getSnapshot()).toMatchObject({ busy: true, canStop: true, activeTurnId: turnId })
  first.detach()
  const recoveredFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnId}`)) return new Response(envelope(activeTurn), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_synthetic_0003', offset: 0, limit: 100, totalCount: 1, turns: [activeTurn], nextCursor: null }), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/cancel') && init?.method === 'POST') {
      cancelKeys.push(new Headers(init.headers).get('idempotency-key') ?? '')
      return new Response(envelope({ turn: { ...activeTurn, state: 'CANCELLED', terminalSequence: 2, lastSequence: 2, cancelRequested: true, failureCode: 'CANCELLED' }, accepted: false }), { status: 200, headers: wireHeaders() })
    }
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') {
      if (url.searchParams.get('after') === '1') {
        const terminal = { turnId, sequence: 2, observedAt: timestamp, payload: { type: 'terminal', state: 'CANCELLED', usage, failureCode: 'CANCELLED' } }
        return new Response(`event:consultation\nid:2\ndata:${JSON.stringify(terminal)}\n\n`, { status: 200, headers: wireHeaders('text/event-stream') })
      }
      return hangingStream(init)
    }
    if (init?.method === 'POST') { createPosts++; throw Error('reload must not create') }
    throw Error(`unexpected recovered cancel fixture route ${url}`)
  }
  const recovered = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch: recoveredFetch, origin, csrfToken: () => 'fresh-csrf' }), {
    storage, randomId: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  })
  recovered.bindOwner(owner); await recovered.activate(); await recovered.stop()
  await waitFor(recovered, state => !state.busy)
  expect(recovered.getSnapshot()).toMatchObject({ busy: false, canStop: false, activeTurnId: null })
  expect(recovered.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: '중지 부분', status: 'interrupted' })
  expect(cancelKeys).toHaveLength(2); expect(cancelKeys[1]).toBe(cancelKeys[0]); expect(createPosts).toBe(1)
})

test('actual anonymous NativeServiceApp renders partial, done and explicit stop through the existing composer', async ({ page }) => {
  let createCount = 0, cancelCount = 0, v3Posts = 0
  const clientMessageIds = new Map<number, string>()
  const releases: (() => void)[] = []
  const gates = [new Promise<void>(resolve => { releases[0] = resolve }), new Promise<void>(resolve => { releases[1] = resolve })]
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname.startsWith('/api/v3/') && method === 'POST') { v3Posts++; return route.abort('blockedbyclient') }
    if (url.pathname === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"session_consultation_browser_01"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: session }) })
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_consultation_browser_01', expiresAt: session.expiresAt } }) })
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (url.pathname === '/api/v13/consultation/turns' && method === 'POST') {
      const body = request.postDataJSON(), ordinal = ++createCount, currentTurn = `turn_synthetic_00000${ordinal}`
      clientMessageIds.set(ordinal, body.clientMessageId)
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({ turnId: currentTurn, conversationId, clientMessageId: body.clientMessageId,
        state: 'QUEUED', createdAt: timestamp, updatedAt: timestamp, userText: body.text, answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null }) })
    }
    const eventMatch = /^\/api\/v13\/consultation\/turns\/(turn_synthetic_00000[12])\/events$/.exec(url.pathname)
    if (eventMatch && request.headers()['accept'] === 'text/event-stream') {
      const text = eventMatch[1].endsWith('1') ? '첫 부분' : '중지 전 부분'
      const event = { turnId: eventMatch[1], sequence: 1, observedAt: timestamp, payload: { type: 'answer_delta', text } }
      return route.fulfill({ contentType: 'text/event-stream', headers: { 'Cache-Control': 'no-store' }, body: `event:consultation\nid:1\ndata:${JSON.stringify(event)}\n\n` })
    }
    if (eventMatch) {
      const index = eventMatch[1].endsWith('1') ? 0 : 1
      await gates[index]
      const state = index === 0 ? 'COMPLETED' : 'CANCELLED'
      const event = { turnId: eventMatch[1], sequence: 2, observedAt: timestamp, payload: { type: 'terminal', state, usage, failureCode: state === 'CANCELLED' ? 'CANCELLED' : null } }
      return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({ turnId: eventMatch[1], after: 1, nextSequence: 2, events: [event], hasMore: false, terminal: true, limit: 100 }) })
    }
    const cancelMatch = /^\/api\/v13\/consultation\/turns\/(turn_synthetic_000002)\/cancel$/.exec(url.pathname)
    if (cancelMatch && method === 'POST') {
      cancelCount++
      return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({ turn: { turnId: cancelMatch[1], conversationId,
        clientMessageId: clientMessageIds.get(2), state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
        userText: '두 번째 질문', answerText: '중지 전 부분', lastSequence: 1, terminalSequence: null, cancelRequested: true, usage, failureCode: null }, accepted: true }) })
    }
    return route.abort('blockedbyclient')
  })
  await page.goto('/')
  const homeInput = page.locator('#strategy-idea')
  await expect(homeInput).toBeEnabled()
  await homeInput.fill('첫 질문')
  await homeInput.press('Enter')
  await expect(page.locator('.g-amsg[data-response-state="streaming"]')).toContainText('첫 부분')
  releases[0]()
  await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('첫 부분')

  const composer = page.locator('.g-composer textarea')
  await composer.fill('두 번째 질문')
  await composer.press('Enter')
  await expect(page.locator('.g-amsg[data-response-state="streaming"]').last()).toContainText('중지 전 부분')
  await page.getByRole('button', { name: '응답 중지', exact: true }).click()
  await expect.poll(() => cancelCount).toBe(1)
  releases[1]()
  await expect(page.locator('.g-amsg[data-response-state="interrupted"]')).toContainText('중지 전 부분')
  expect({ createCount, cancelCount, v3Posts }).toEqual({ createCount: 2, cancelCount: 1, v3Posts: 0 })
})

test('actual capability-disabled home preserves typed input and sends no v3 fallback', async ({ page }) => {
  let v13Posts = 0, v3Posts = 0
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (request.method() === 'POST') {
      if (url.pathname.startsWith('/api/v13/')) v13Posts++
      if (url.pathname.startsWith('/api/v3/')) v3Posts++
      return route.abort('blockedbyclient')
    }
    if (url.pathname === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"session_consultation_browser_01"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: session }) })
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_consultation_browser_01', expiresAt: session.expiresAt } }) })
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({ ...capability, available: false, reason: 'DISABLED' }) })
    return route.abort('blockedbyclient')
  })
  await page.goto('/')
  const input = page.locator('#strategy-idea')
  await expect(input).toBeEnabled()
  await expect(page.getByRole('alert')).toContainText('현재 대화는 그대로 유지됩니다')
  await input.fill('비가용이어도 보존할 입력')
  await input.press('Enter')
  await expect(input).toHaveValue('비가용이어도 보존할 입력')
  expect({ v13Posts, v3Posts }).toEqual({ v13Posts: 0, v3Posts: 0 })
})

test('PR6 completed display tags reuse original cards and send ASK or NEXT as ordinary API13 user text', async ({ page }) => {
  const sent: string[] = []
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const ask = { steps: [{ title: '위험 기준은? 🤔', multi: false, options: [
    { t: '계좌의 2%', d: '계좌 자기자본 기준 📉' }, { t: '진입가의 2%', d: '진입 가격 기준' },
  ] }] }
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"session_consultation_browser_01"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: session }) })
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_consultation_browser_01', expiresAt: session.expiresAt } }) })
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (url.pathname === '/api/v13/consultation/turns' && method === 'POST') {
      const body = request.postDataJSON(), ordinal = sent.push(body.text), currentTurn = `turn_display_synthetic_0${ordinal}`
      const answerText = ordinal === 1
        ? `완료된 본문 ✅\n[CHART {"tv":"BINANCE:BTCUSDT","data":"binance:BTCUSDT","label":"비트코인"}]\n[ASK ${JSON.stringify(ask)}]\n[TITLE "첫 상담 제목 📌"]`
        : ordinal === 2 ? '두 번째 본문\n[NEXT ["What next? 🚀"]]' : '세 번째 본문'
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({ turnId: currentTurn, conversationId,
        clientMessageId: body.clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
        userText: body.text, answerText, lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }) })
    }
    return route.abort('blockedbyclient')
  })
  await page.goto('/')
  await page.locator('#strategy-idea').fill('첫 질문')
  await page.locator('#strategy-idea').press('Enter')
  await expect.poll(() => errors).toEqual([])
  await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('완료된 본문 ✅')
  await expect(page.locator('.g-amsg')).not.toContainText('[ASK')
  await expect(page.locator('.client-market-chart')).toHaveCount(0)
  await expect(page.locator('.g-title')).toContainText('첫 상담 제목 📌')
  const composer = page.locator('.g-composer textarea')
  await composer.evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(element, value)
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }))
  }, '전송하지 않은 composer 초안 🚧')
  await expect(composer).toHaveValue('전송하지 않은 composer 초안 🚧')
  const askOption = page.locator('.g-askcard .op').filter({ hasText: '계좌의 2%' }).first()
  await expect(askOption).toBeVisible()
  await askOption.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => sent.length).toBe(2)
  expect(sent[1]).toBe('위험 기준은: 계좌의 2% (계좌 자기자본 기준 📉) 기준으로 진행해줘')
  await expect(composer).toHaveValue('전송하지 않은 composer 초안 🚧')
  await expect(page.locator('.g-nextq')).toContainText('What next? 🚀')
  await page.locator('.g-nextq').click()
  await expect.poll(() => sent.length).toBe(3)
  await expect(composer).toHaveValue('전송하지 않은 composer 초안 🚧')
  expect(sent).toEqual(['첫 질문', '위험 기준은: 계좌의 2% (계좌 자기자본 기준 📉) 기준으로 진행해줘', 'What next? 🚀'])
})

test('TITLE remains allowed until the first completed answer rather than the first failed turn', async () => {
  let ordinal = 0
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname === '/api/v13/consultation/turns' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)), current = ++ordinal
      return new Response(envelope({ turnId: `turn_display_title_${current}`, conversationId, clientMessageId: body.clientMessageId,
        state: current === 1 ? 'FAILED' : 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, userText: body.text,
        answerText: current === 1 ? '첫 응답 실패' : '완료 본문\n[TITLE "첫 완료 제목"]', lastSequence: 2, terminalSequence: 2,
        cancelRequested: false, usage, failureCode: current === 1 ? 'INTERNAL_ERROR' : null }), { status: 202, headers: wireHeaders() })
    }
    throw Error(`unexpected route ${url}`)
  } })
  const controller = new NativeConsultationV13Controller(adapter, { storage: memoryStorage(), randomId: () => `00000000-0000-4000-8000-0000000000${ordinal + 10}` })
  controller.bindOwner(JSON.stringify(['owner_first_completed_title', 'ANONYMOUS']))
  await controller.activate()
  expect(await controller.send('실패하는 첫 질문')).toBe(true)
  expect(controller.getSnapshot().messages.at(-1)?.displayTitleSuggestion).toBeUndefined()
  expect(await controller.send('완료하는 둘째 질문')).toBe(true)
  expect(controller.getSnapshot().messages.at(-1)?.displayTitleSuggestion).toEqual({
    messageId: 'turn_display_title_2_reply', value: '첫 완료 제목',
  })
})

test('PR6 late completed TITLE from a retired owner cannot repopulate the new owner snapshot', async () => {
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)); await held
      return new Response(envelope({ turnId, conversationId, clientMessageId: body.clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
        userText: body.text, answerText: '이전 owner 본문\n[TITLE "이전 owner 제목"]', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    throw Error(`unexpected route ${url}`)
  } })
  const controller = new NativeConsultationV13Controller(adapter, { storage: memoryStorage(), randomId: () => '00000000-0000-4000-8000-000000000099' })
  controller.bindOwner(JSON.stringify(['owner_before_display', 'ANONYMOUS'])); await controller.activate()
  const pending = controller.send('이전 질문')
  controller.bindOwner(JSON.stringify(['owner_after_display', 'AUTHENTICATED']))
  release()
  await expect(pending).resolves.toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ messages: [], conversationId: null, activeTurnId: null })
})

test('terminal accepted A and uncertain pending B both survive reload; only explicit B resume reuses its command', async () => {
  const storage = memoryStorage(), owner = JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])
  const posts: { key: string | null; body: string }[] = []
  let loseB = true
  const completedA = { turnId, conversationId, clientMessageId: 'client_message_00000000_0000_4000_8000_000000000021', state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
    userText: 'A 질문', answerText: 'A 답변', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') {
      const body = String(init.body); posts.push({ key: new Headers(init.headers).get('idempotency-key'), body })
      const request = JSON.parse(body)
      if (request.text === 'B 질문' && loseB) { loseB = false; throw new TypeError('response lost') }
      const ordinal = request.text === 'A 질문' ? '000001' : '000002'
      return new Response(envelope({ ...completedA, turnId: `turn_synthetic_${ordinal}`, clientMessageId: request.clientMessageId,
        userText: request.text, answerText: `${request.text.slice(0, 1)} 답변` }), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith(`/turns/${turnId}`)) return new Response(envelope(completedA), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_synthetic_0021', offset: 0, limit: 100, totalCount: 1,
      turns: [completedA], nextCursor: null }), { status: 200, headers: wireHeaders() })
    throw Error(`unexpected A/B fixture route ${url}`)
  }
  const adapter = new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'fresh-csrf' })
  let controller = new NativeConsultationV13Controller(adapter, { storage, randomId: () => '00000000-0000-4000-8000-000000000021' })
  controller.bindOwner(owner); await controller.activate()
  const sentA = await controller.send('A 질문')
  expect(sentA).toBe(true)
  expect(await controller.send('B 질문')).toBe(false); controller.detach()
  controller = new NativeConsultationV13Controller(adapter, { storage, randomId: () => 'ffffffff-ffff-4fff-8fff-ffffffffffff' })
  controller.bindOwner(owner); await controller.activate()
  expect(controller.getSnapshot()).toMatchObject({ conversationId, busy: false, canResumePending: true })
  expect(controller.getSnapshot().messages[0]).toMatchObject({ text: 'A 질문' })
  expect(await controller.send('B 질문')).toBe(false)
  expect(await controller.resumePending()).toBe(true)
  expect(posts).toHaveLength(3)
  expect(posts[2]).toEqual(posts[1])
})

test('local invalid create is POST-zero while definitive 400 alone enables explicit local discard', async () => {
  let posts = 0
  const error = JSON.stringify({ apiContractVersion: '0.13.0', error: { code: 'BAD_REQUEST', message: 'Consultation request failed.' } })
  const fetch = async (input: RequestInfo | URL) => {
    if (new URL(String(input)).pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    posts++; return new Response(error, { status: 400, headers: wireHeaders() })
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
    storage: memoryStorage(), randomId: () => '00000000-0000-4000-8000-000000000022',
  })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate()
  expect(await controller.send('')).toBe(false); expect(posts).toBe(0)
  expect(await controller.send('거절 질문')).toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ canResumePending: false, canDiscardPending: true })
  expect(await controller.send('거절 질문')).toBe(false); expect(await controller.resumePending()).toBe(false); expect(posts).toBe(1)
  expect(controller.discardPending()).toBe(true)
  expect(controller.getSnapshot()).toMatchObject({ canDiscardPending: false, issue: null })
})

test('cancel peek never jumps the cursor and terminal completion is adopted only through after catch-up', async () => {
  let posts = 0
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)), accept = new Headers(init?.headers).get('accept')
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/turns') && init?.method === 'POST') {
      posts++; const body = JSON.parse(String(init.body)); return new Response(envelope({ turnId, conversationId, clientMessageId: body.clientMessageId, state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
        userText: body.text, answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null }), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/cancel')) return new Response(envelope({ turn: { turnId, conversationId, clientMessageId: 'client_message_00000000_0000_4000_8000_000000000023', state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
      userText: '중지 선행', answerText: '부분 다음', lastSequence: 2, terminalSequence: null, cancelRequested: true, usage, failureCode: null }, accepted: true }), { status: 200, headers: wireHeaders() })
    if (accept === 'text/event-stream') {
      const after = Number(url.searchParams.get('after'))
      const events = after === 0
        ? [{ turnId, sequence: 1, observedAt: timestamp, payload: { type: 'answer_delta', text: '부분' } }]
        : [{ turnId, sequence: 2, observedAt: timestamp, payload: { type: 'answer_delta', text: ' 다음' } }, { turnId, sequence: 3, observedAt: timestamp, payload: { type: 'terminal', state: 'CANCELLED', usage, failureCode: 'CANCELLED' } }]
      return new Response(events.map(event => `event:consultation\nid:${event.sequence}\ndata:${JSON.stringify(event)}\n\n`).join(''), { status: 200, headers: wireHeaders('text/event-stream') })
    }
    if (url.pathname.endsWith('/events')) return new Response(envelope({ turnId, after: 1, nextSequence: 1, events: [], hasMore: false, terminal: false, limit: 100 }), { status: 200, headers: wireHeaders() })
    throw Error(`unexpected cancel race fixture route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
    storage: memoryStorage(), wait: async () => new Promise(resolve => setTimeout(resolve, 20)), randomId: () => '00000000-0000-4000-8000-000000000023',
  })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate(); await controller.send('중지 선행')
  await waitFor(controller, state => state.messages[1]?.responseBlocks?.[0]?.text === '부분')
  await controller.stop()
  const done = await waitFor(controller, state => !state.busy)
  expect(done.messages[1].responseBlocks?.[0]).toMatchObject({ text: '부분 다음', status: 'interrupted' })
  expect(posts).toBe(1)
})

test('silent SSE is hard-aborted and same-view observation resume performs GET-only recovery', async () => {
  let posts = 0, recovery = false, aborts = 0
  const activeTurn = { turnId, conversationId, clientMessageId: 'client_message_00000000_0000_4000_8000_000000000024', state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
    userText: '긴 관찰', answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null }
  const doneTurn = { ...activeTurn, state: 'COMPLETED', answerText: '복구 완료', lastSequence: 2, terminalSequence: 2 }
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (init?.method === 'POST') { posts++; return new Response(envelope(activeTurn), { status: 202, headers: wireHeaders() }) }
    if (url.pathname.endsWith(`/turns/${turnId}`)) return new Response(envelope(doneTurn), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_synthetic_0024', offset: 0, limit: 100, totalCount: 1,
      turns: [doneTurn], nextCursor: null }), { status: 200, headers: wireHeaders() })
    if (!recovery && new Headers(init?.headers).get('accept') === 'text/event-stream') return new Response(new ReadableStream({ start(stream) {
      init?.signal?.addEventListener('abort', () => { aborts++; stream.error(new DOMException('deadline', 'AbortError')) }, { once: true })
    } }), { status: 200, headers: wireHeaders('text/event-stream') })
    throw Error(`unexpected deadline fixture route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
    storage: memoryStorage(), observationTimeoutMs: 100, randomId: () => '00000000-0000-4000-8000-000000000024',
  })
  controller.bindOwner(JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])); await controller.activate(); await controller.send('긴 관찰')
  const interrupted = await waitFor(controller, state => state.availability === 'error')
  expect(interrupted).toMatchObject({ busy: false, canResumeObservation: true }); expect(aborts).toBe(1)
  recovery = true
  expect(await controller.resumeObservation()).toBe(true)
  expect(controller.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: '복구 완료', status: 'done' })
  expect(posts).toBe(1)
})

test('accepted restore tolerates mutable GET race and finds its immutable anchor on the second bounded history page', async () => {
  const storage = memoryStorage(), owner = JSON.stringify(['anonymous_session_01', 'ANONYMOUS'])
  storage.setItem(`tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`, JSON.stringify({ version: 1, owner, conversationId, turnId }))
  let historyPages = 0
  const anchor = { turnId, conversationId, clientMessageId: 'client_message_anchor_0001', state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
    userText: '페이지 복구', answerText: '부분', lastSequence: 1, terminalSequence: null, cancelRequested: false, usage, failureCode: null }
  const latest = { ...anchor, state: 'COMPLETED', lastSequence: 2, terminalSequence: 2 }
  const earlier = { ...anchor, turnId: 'turn_synthetic_earlier1', clientMessageId: 'client_message_earlier_0001', state: 'COMPLETED',
    userText: '이전 질문', answerText: '이전 답변', lastSequence: 2, terminalSequence: 2 }
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnId}`)) return new Response(envelope(latest), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) {
      historyPages++
      const second = url.searchParams.has('cursor')
      return new Response(envelope({ conversationId, snapshotId: 'snapshot_synthetic_0025', offset: second ? 1 : 0, limit: 100, totalCount: 2,
        turns: second ? [anchor] : [earlier], nextCursor: second ? null : 'cursor_synthetic_0001' }), { status: 200, headers: wireHeaders() })
    }
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') {
      const event = { turnId, sequence: 2, observedAt: timestamp, payload: { type: 'terminal', state: 'COMPLETED', usage, failureCode: null } }
      return new Response(`event:consultation\nid:2\ndata:${JSON.stringify(event)}\n\n`, { status: 200, headers: wireHeaders('text/event-stream') })
    }
    throw Error(`unexpected paged restore fixture route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), { storage })
  controller.bindOwner(owner); await controller.activate()
  const done = await waitFor(controller, state => !state.busy && state.messages.length === 4)
  expect(done.messages[3].responseBlocks?.[0]).toMatchObject({ text: '부분', status: 'done' })
  expect(historyPages).toBe(2)
})

test('blocked sessionStorage getter cannot crash a controller created while consultation is disabled', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError') } })
  try {
    const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => null, fetch: async () => { throw Error('unused') } })
    expect(() => new NativeConsultationV13Controller(adapter)).not.toThrow()
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor)
    else delete (globalThis as { sessionStorage?: Storage }).sessionStorage
  }
})

test('actual conversation notice exposes explicit pending resume and ordinary Enter never retries it', async ({ page }) => {
  let creates = 0, sessionGets = 0, csrfGets = 0
  const commands: { key: string | undefined; body: string | null }[] = []
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/v1/auth/session') {
      sessionGets++; return route.fulfill({ contentType: 'application/json', headers: { ETag: '"session_consultation_browser_01"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: session }) })
    }
    if (url.pathname === '/api/v1/auth/csrf') {
      csrfGets++; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_consultation_browser_01', expiresAt: session.expiresAt } }) })
    }
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (url.pathname === '/api/v13/consultation/turns' && method === 'POST') {
      creates++; commands.push({ key: request.headers()['idempotency-key'], body: request.postData() })
      const body = request.postDataJSON(), currentTurn = `turn_synthetic_00000${creates === 1 ? 1 : 2}`
      if (creates === 2) return route.abort('connectionfailed')
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({ turnId: currentTurn, conversationId,
        clientMessageId: body.clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, userText: body.text,
        answerText: creates === 1 ? '첫 완료' : '재개 완료', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }) })
    }
    return route.abort('blockedbyclient')
  })
  await page.goto('/')
  const home = page.locator('#strategy-idea'); await home.fill('첫 질문'); await home.press('Enter')
  await expect(page.locator('.g-amsg[data-response-state="done"]')).toContainText('첫 완료')
  const composer = page.locator('.g-composer textarea'); await composer.fill('유실 질문'); await composer.press('Enter')
  await expect(page.getByRole('alert')).toContainText('REQUEST_UNCONFIRMED')
  const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await expect(resume).toBeVisible()
  await composer.press('Enter'); await expect.poll(() => creates).toBe(2)
  const beforeAuthority = { sessionGets, csrfGets }
  await resume.click(); await expect(page.locator('.g-amsg[data-response-state="done"]').last()).toContainText('재개 완료')
  expect(creates).toBe(3); expect(commands[2]).toEqual(commands[1])
  expect(sessionGets).toBeGreaterThanOrEqual(beforeAuthority.sessionGets + 2)
  expect(csrfGets).toBeGreaterThanOrEqual(beforeAuthority.csrfGets + 1)
})

test('recovery-final: history의 pending B를 권위 확인해 A와 함께 복원하고 POST 없이 B 관찰을 잇는다', async () => {
  const owner = JSON.stringify(['anonymous_session_recovery_01', 'ANONYMOUS'])
  const values = new Map<string, string>(), storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  const turnAId = 'turn_recovery_accepted_a_01', turnBId = 'turn_recovery_pending_b_01'
  const clientA = 'client_message_recovery_a_01', clientB = 'client_message_recovery_b_01'
  const completedA = { turnId: turnAId, conversationId, clientMessageId: clientA, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
    userText: 'A 질문', answerText: 'A 답변', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }
  const runningB = { turnId: turnBId, conversationId, clientMessageId: clientB, state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
    userText: 'B 질문', answerText: 'B 부분', lastSequence: 1, terminalSequence: null, cancelRequested: false, usage, failureCode: null }
  values.set(`tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`, JSON.stringify({ version: 1, owner, conversationId, turnId: turnAId }))
  values.set(`tesia.native.consultation-v13.pending:${encodeURIComponent(owner)}`, JSON.stringify({ version: 3, owner, conversationId,
    clientMessageId: clientB, text: 'B 질문', idempotencyKey: 'consultation_request_recovery_b_01', attempted: true, disposition: 'uncertain' }))
  let posts = 0, release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnAId}`)) return new Response(envelope(completedA), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnBId}`)) return new Response(envelope(runningB), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_recovery_ab_01', offset: 0, limit: 100,
      totalCount: 2, turns: [completedA, runningB], nextCursor: null }), { status: 200, headers: wireHeaders() })
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') {
      await held
      const event = { turnId: turnBId, sequence: 2, observedAt: timestamp, payload: { type: 'terminal', state: 'COMPLETED', usage, failureCode: null } }
      return new Response(`event:consultation\nid:2\ndata:${JSON.stringify(event)}\n\n`, { status: 200, headers: wireHeaders('text/event-stream') })
    }
    if (init?.method === 'POST') posts++
    throw Error(`unexpected recovery A/B route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), { storage })
  controller.bindOwner(owner); await controller.activate()
  const restored = controller.getSnapshot()
  expect(restored).toMatchObject({ availability: 'available', busy: true, conversationId, activeTurnId: turnBId, canResumePending: false })
  expect(restored.messages.map(message => message.id)).toEqual([clientA, `${turnAId}_reply`, clientB, `${turnBId}_reply`])
  expect(new Set(restored.messages.map(message => message.id)).size).toBe(4)
  expect(restored.messages[1].responseBlocks?.[0]).toMatchObject({ text: 'A 답변', status: 'done' })
  expect(restored.messages[3].responseBlocks?.[0]).toMatchObject({ text: 'B 부분', status: 'streaming' })
  expect(values.has(`tesia.native.consultation-v13.pending:${encodeURIComponent(owner)}`)).toBe(false)
  expect(JSON.parse(values.get(`tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`)!)).toMatchObject({ turnId: turnBId })
  release()
  const done = await waitFor(controller, state => !state.busy)
  expect(done.messages[3].responseBlocks?.[0]).toMatchObject({ text: 'B 부분', status: 'done' })
  expect(posts).toBe(0)
})

test('recovery-final: accepted A 복원 404여도 pending B는 보존되어 같은 키로 명시 재개된다', async () => {
  const owner = JSON.stringify(['anonymous_session_recovery_02', 'ANONYMOUS'])
  const values = new Map<string, string>(), storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  const turnAId = 'turn_recovery_missing_a_02', clientB = 'client_message_recovery_b_02', keyB = 'consultation_request_recovery_b_02'
  values.set(`tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`, JSON.stringify({ version: 1, owner, conversationId, turnId: turnAId }))
  values.set(`tesia.native.consultation-v13.pending:${encodeURIComponent(owner)}`, JSON.stringify({ version: 3, owner, conversationId,
    clientMessageId: clientB, text: 'B 재개 질문', idempotencyKey: keyB, attempted: true, disposition: 'uncertain' }))
  const commands: { key: string | null; body: string }[] = []
  const missing = JSON.stringify({ apiContractVersion: '0.13.0', error: { code: 'NOT_FOUND', message: 'Consultation request failed.' } })
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnAId}`)) return new Response(missing, { status: 404, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_recovery_missing_02', offset: 0, limit: 100,
      totalCount: 0, turns: [], nextCursor: null }), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/turns') && init?.method === 'POST') {
      commands.push({ key: new Headers(init.headers).get('idempotency-key'), body: String(init.body) })
      return new Response(envelope({ turnId: 'turn_recovery_resumed_b_02', conversationId, clientMessageId: clientB, state: 'COMPLETED', createdAt: timestamp,
        updatedAt: timestamp, userText: 'B 재개 질문', answerText: 'B 완료', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }),
      { status: 202, headers: wireHeaders() })
    }
    throw Error(`unexpected missing A route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'fresh-csrf' }), { storage })
  controller.bindOwner(owner); await controller.activate()
  expect(controller.getSnapshot()).toMatchObject({ availability: 'available', issue: 'request-unconfirmed', canResumePending: true, canResumeObservation: false })
  expect(JSON.parse(values.get(`tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`)!)).toMatchObject({ turnId: turnAId })
  expect(await controller.resumePending()).toBe(true)
  expect(commands).toHaveLength(1)
  expect(commands[0]).toMatchObject({ key: keyB })
  expect(JSON.parse(commands[0].body)).toEqual({ conversationId, clientMessageId: clientB, text: 'B 재개 질문' })
  expect(controller.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: 'B 완료', status: 'done' })
})

test('recovery-final: generation 경계의 동일 키 single-flight와 결과불명 뒤 400 보수 분류를 함께 지킨다', async () => {
  const owner = JSON.stringify(['anonymous_session_recovery_03', 'ANONYMOUS'])
  const storage = memoryStorage(), bad = JSON.stringify({ apiContractVersion: '0.13.0', error: { code: 'BAD_REQUEST', message: 'Consultation request failed.' } })
  let posts = 0, release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  const fetch = async (input: RequestInfo | URL) => {
    if (new URL(String(input)).pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    posts++
    if (posts === 1) { await held; throw new TypeError('response lost') }
    return new Response(bad, { status: 400, headers: wireHeaders() })
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
    storage, randomId: () => '00000000-0000-4000-8000-000000000031',
  })
  controller.bindOwner(owner); await controller.activate()
  const first = controller.send('결과 불명 질문')
  await expect.poll(() => posts).toBe(1)
  controller.unbindOwner(); controller.bindOwner(owner); await controller.activate()
  expect(await controller.resumePending()).toBe(false)
  expect(posts).toBe(1)
  release(); expect(await first).toBe(false)
  expect(await controller.resumePending()).toBe(false)
  expect(posts).toBe(2)
  expect(controller.getSnapshot()).toMatchObject({ canResumePending: true, canDiscardPending: false, issue: 'request-unconfirmed' })

  let knownPosts = 0
  const known = new NativeConsultationV13Controller(new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async (input) => {
    if (new URL(String(input)).pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    knownPosts++; return new Response(bad, { status: 400, headers: wireHeaders() })
  } }), { storage: memoryStorage(), randomId: () => '00000000-0000-4000-8000-000000000032' })
  known.bindOwner(JSON.stringify(['anonymous_session_recovery_04', 'ANONYMOUS'])); await known.activate()
  expect(await known.send('최초 확정 거절')).toBe(false)
  expect(knownPosts).toBe(1)
  expect(known.getSnapshot()).toMatchObject({ canResumePending: false, canDiscardPending: true })
})

test('recovery-final: cancel 500은 streaming을 유지하고 cancel 계약 위반만 중단 처리한다', async () => {
  const activeFor = (clientMessageId: string) => ({ turnId, conversationId, clientMessageId, state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
    userText: '중지 질문', answerText: '', lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null })
  const cancelError = JSON.stringify({ apiContractVersion: '0.13.0', error: { code: 'INTERNAL_ERROR', message: 'Consultation request failed.' } })
  let firstClient = ''
  const firstFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/turns') && init?.method === 'POST') {
      firstClient = JSON.parse(String(init.body)).clientMessageId
      return new Response(envelope(activeFor(firstClient)), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/cancel')) return new Response(cancelError, { status: 500, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnId}`)) throw new TypeError('poll response lost')
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') return new Response(new ReadableStream({ start(stream) {
      const event = { turnId, sequence: 1, observedAt: timestamp, payload: { type: 'answer_delta', text: '보존 부분' } }
      stream.enqueue(new TextEncoder().encode(`event:consultation\nid:1\ndata:${JSON.stringify(event)}\n\n`))
      init?.signal?.addEventListener('abort', () => stream.error(new DOMException('aborted', 'AbortError')), { once: true })
    } }), { status: 200, headers: wireHeaders('text/event-stream') })
    throw Error(`unexpected cancel 500 route ${url}`)
  }
  const first = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch: firstFetch, origin, csrfToken: () => 'csrf' }), {
    storage: memoryStorage(), randomId: () => '00000000-0000-4000-8000-000000000033',
  })
  first.bindOwner(JSON.stringify(['anonymous_session_recovery_05', 'ANONYMOUS'])); await first.activate(); await first.send('중지 질문')
  await waitFor(first, state => state.messages[1]?.responseBlocks?.[0]?.text === '보존 부분')
  await first.stop()
  expect(first.getSnapshot()).toMatchObject({ availability: 'available', busy: true, canStop: true, issue: 'request-unconfirmed' })
  expect(first.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: '보존 부분', status: 'streaming' })
  first.detach()

  let secondClient = ''
  const secondFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/turns') && init?.method === 'POST') {
      secondClient = JSON.parse(String(init.body)).clientMessageId
      return new Response(envelope(activeFor(secondClient)), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/cancel')) return new Response(envelope({ turn: { ...activeFor('client_message_wrong_binding_01'), cancelRequested: true }, accepted: true }),
      { status: 200, headers: wireHeaders() })
    if (new Headers(init?.headers).get('accept') === 'text/event-stream') return new Response(new ReadableStream({ start(stream) {
      init?.signal?.addEventListener('abort', () => stream.error(new DOMException('aborted', 'AbortError')), { once: true })
    } }), { status: 200, headers: wireHeaders('text/event-stream') })
    throw Error(`unexpected cancel binding route ${url}`)
  }
  const second = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch: secondFetch, origin, csrfToken: () => 'csrf' }), {
    storage: memoryStorage(), randomId: () => '00000000-0000-4000-8000-000000000034',
  })
  second.bindOwner(JSON.stringify(['anonymous_session_recovery_06', 'ANONYMOUS'])); await second.activate(); await second.send('중지 질문')
  await second.stop()
  expect(second.getSnapshot()).toMatchObject({ availability: 'error', busy: false, canStop: false, issue: 'request-unconfirmed' })
  expect(second.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ status: 'interrupted' })
})

test('delta-final: null-conversation pending 삭제 실패 후 reload는 locator turn을 채택하고 중복 없이 재송신을 막는다', async () => {
  const owner = JSON.stringify(['anonymous_session_delta_01', 'ANONYMOUS'])
  const values = new Map<string, string>(), storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (_key: string) => { /* synthetic durable removal/readback failure */ },
  }
  const clientMessageId = 'client_message_00000000_0000_4000_8000_000000000041'
  const completed = { turnId, conversationId, clientMessageId, state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp,
    userText: '첫 질문', answerText: '첫 완료', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }
  let posts = 0
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_delta_null_01', offset: 0, limit: 100,
      totalCount: 1, turns: [completed], nextCursor: null }), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith(`/turns/${turnId}`)) return new Response(envelope(completed), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/turns') && init?.method === 'POST') {
      posts++
      const body = JSON.parse(String(init.body))
      expect(body).toEqual({ conversationId: null, clientMessageId, text: '첫 질문' })
      return new Response(envelope(completed), { status: 202, headers: wireHeaders() })
    }
    throw Error(`unexpected null pending route ${url}`)
  }
  const adapter = new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' })
  const first = new NativeConsultationV13Controller(adapter, { storage, randomId: () => '00000000-0000-4000-8000-000000000041' })
  first.bindOwner(owner); await first.activate(); expect(await first.send('첫 질문')).toBe(true)
  expect(first.getSnapshot().messages.map(message => message.id)).toEqual([clientMessageId, `${turnId}_reply`])
  expect(first.getSnapshot()).toMatchObject({ issue: 'request-unconfirmed', canResumePending: false })
  first.detach()

  const recovered = new NativeConsultationV13Controller(adapter, { storage })
  recovered.bindOwner(owner); await recovered.activate()
  expect(recovered.getSnapshot()).toMatchObject({ availability: 'available', busy: false, conversationId, activeTurnId: null,
    issue: 'request-unconfirmed', canResumePending: false, canDiscardPending: false })
  expect(recovered.getSnapshot().messages.map(message => message.id)).toEqual([clientMessageId, `${turnId}_reply`])
  expect(new Set(recovered.getSnapshot().messages.map(message => message.id)).size).toBe(2)
  expect(recovered.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: '첫 완료', status: 'done' })
  expect(await recovered.resumePending()).toBe(false)
  expect(posts).toBe(1)
})

test('delta-final: restore는 history snapshot 뒤 authoritative turn을 읽어 정상 sequence 전진을 채택한다', async () => {
  const owner = JSON.stringify(['anonymous_session_delta_02', 'ANONYMOUS']), storage = memoryStorage()
  storage.setItem(`tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`, JSON.stringify({ version: 1, owner, conversationId, turnId }))
  const observed = { turnId, conversationId, clientMessageId: 'client_message_delta_sequence_01', state: 'DISPATCHING', createdAt: timestamp, updatedAt: timestamp,
    userText: '순서 복구', answerText: '부분', lastSequence: 1, terminalSequence: null, cancelRequested: false, usage, failureCode: null }
  const latest = { ...observed, state: 'COMPLETED', answerText: '부분 완료', lastSequence: 2, terminalSequence: 2 }
  const reads: string[] = []
  const fetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) {
      reads.push('history')
      return new Response(envelope({ conversationId, snapshotId: 'snapshot_delta_sequence_01', offset: 0, limit: 100,
        totalCount: 1, turns: [observed], nextCursor: null }), { status: 200, headers: wireHeaders() })
    }
    if (url.pathname.endsWith(`/turns/${turnId}`)) {
      reads.push('turn')
      return new Response(envelope(latest), { status: 200, headers: wireHeaders() })
    }
    throw Error(`unexpected ordered restore route ${url}`)
  }
  const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), { storage })
  controller.bindOwner(owner); await controller.activate()
  expect(reads).toEqual(['history', 'turn'])
  expect(controller.getSnapshot()).toMatchObject({ availability: 'available', busy: false, activeTurnId: null })
  expect(controller.getSnapshot().messages[1].responseBlocks?.[0]).toMatchObject({ text: '부분 완료', status: 'done' })
})
