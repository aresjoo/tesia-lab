import { expect, test } from '@playwright/test'
import { ConsultationV13Adapter } from '../../src/internal-poc/consultation-v13-adapter'
import { ConsultationV16Adapter } from '../../src/internal-poc/consultation-v16-adapter'
import { NativeConsultationV13Controller, type ConsultationV13Snapshot } from '../../src/internal-poc/native-consultation-v13-controller'
import conversationFixture from '../fixtures/service-v03/recorded-conversation.json' with { type: 'json' }

const origin = 'https://service.example.test'
const wireHeaders = (type = 'application/json') => ({ 'Content-Type': type, 'Cache-Control': 'no-store' })
const envelope = (data: unknown) => JSON.stringify({ apiContractVersion: '0.13.0', data })
const envelope16 = (data: unknown) => JSON.stringify({ apiContractVersion: '0.16.0', data })
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

test('document question persists both mutations then joins API16 metadata to the exact API13 turn and local anchor', async () => {
  const storage = memoryStorage(), owner = JSON.stringify(['document_owner_0001', 'AUTHENTICATED'])
  const generalTurnId = 'turn_general_document_0001', documentTurnId = 'turn_document_question_0001'
  const serverDocumentId = 'research_work_server_000001'
  const researchThread = { scopeId: 'local-scope:not-server-authority', documentId: 'report' }
  const locator = { producerServiceId: 'research_service_000001', kind: 'report' as const, documentId: serverDocumentId,
    revision: 17, contentSha256: 'a'.repeat(64) }
  const documentRef = 'docref_document_snapshot_000001'
  let clientMessageId = ''
  const general = { turnId: generalTurnId, conversationId, clientMessageId: 'client_message_general_0001', state: 'COMPLETED',
    createdAt: timestamp, updatedAt: timestamp, userText: '기존 질문', answerText: '기존 답변', lastSequence: 2, terminalSequence: 2,
    cancelRequested: false, usage, failureCode: null }
  const documentTurn = () => ({ turnId: documentTurnId, conversationId, clientMessageId, state: 'COMPLETED', createdAt: '2026-10-07T00:00:01Z',
    updatedAt: '2026-10-07T00:00:01Z', userText: '이 보고서의 근거는?', answerText: '문서 근거 답변', lastSequence: 2, terminalSequence: 2,
    cancelRequested: false, usage, failureCode: null })
  const v13 = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf-v13', fetch: async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname === '/api/v13/consultation/turns' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      return new Response(envelope({ ...general, clientMessageId: body.clientMessageId, userText: body.text }), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith(`/turns/${documentTurnId}`)) return new Response(envelope(documentTurn()), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_document_join_0001', offset: 0,
      limit: 100, totalCount: 2, turns: [general, documentTurn()], nextCursor: null }), { status: 200, headers: wireHeaders() })
    throw Error(`unexpected API13 document route ${url}`)
  } })
  const calls: { method: string; path: string; key: string | null; csrf: string | null; body: string | null }[] = []
  const v16 = new ConsultationV16Adapter({ origin, fetch: async (input, init) => {
    const url = new URL(String(input)), headers = new Headers(init?.headers), method = init?.method ?? 'GET'
    calls.push({ method, path: `${url.pathname}${url.search}`, key: headers.get('idempotency-key'), csrf: headers.get('x-csrf-token'), body: init?.body ? String(init.body) : null })
    if (url.pathname.endsWith('/locator')) return new Response(envelope16(locator), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/document-references')) return new Response(envelope16({ documentRef, ...locator }), { status: 201, headers: wireHeaders() })
    if (url.pathname.endsWith('/document-questions')) {
      const body = JSON.parse(String(init?.body)); clientMessageId = body.clientMessageId
      return new Response(envelope16({ conversationId, turnId: documentTurnId, clientMessageId, documentRef, state: 'QUEUED' }), { status: 202, headers: wireHeaders() })
    }
    const projection = { conversationId, turnId: documentTurnId, clientMessageId, documentRef, ...locator, state: 'COMPLETED' }
    if (url.pathname.endsWith(`/turns/${documentTurnId}`)) return new Response(envelope16(projection), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope16({ items: [projection], nextCursor: null }), { status: 200, headers: wireHeaders() })
    throw Error(`unexpected API16 document route ${url}`)
  } })
  let ordinal = 0
  const controller = new NativeConsultationV13Controller(v13, { storage, documentAdapter: v16, documentCsrfToken: () => 'csrf-v16',
    randomId: () => `00000000-0000-4000-8000-${String(++ordinal).padStart(12, '0')}` })
  controller.bindOwner(owner); await controller.activate(); expect(await controller.send('기존 질문')).toBe(true)
  const documentResult = await controller.sendDocumentQuestion({ kind: 'report', documentId: serverDocumentId, text: '이 보고서의 근거는?', researchThread })
  expect({ documentResult, calls: calls.map(call => `${call.method} ${call.path}`), snapshot: controller.getSnapshot() }).toMatchObject({ documentResult: true })
  const documentMessages = controller.getSnapshot().messages.filter(message => message.id === clientMessageId || message.id === `${documentTurnId}_reply`)
  expect(documentMessages).toHaveLength(2)
  expect(documentMessages[0]).toMatchObject({ role: 'user', text: '이 보고서의 근거는?', researchThread })
  expect(documentMessages[1]).toMatchObject({ role: 'assistant', researchThread })
  const mutations = calls.filter(call => call.method === 'POST')
  expect(mutations).toHaveLength(2)
  expect(JSON.parse(mutations[0].body!)).toEqual({ apiContractVersion: '0.16.0', locator })
  expect(JSON.parse(mutations[1].body!)).toEqual({ apiContractVersion: '0.16.0', clientMessageId,
    text: '이 보고서의 근거는?', documentRef })
  expect(mutations.every(call => Boolean(call.key) && call.csrf === 'csrf-v16')).toBe(true)
  expect(calls.filter(call => call.method === 'GET').every(call => call.key === null && call.csrf === null && call.body === null)).toBe(true)
})

test('document question reload explicitly resumes admitted GET-only and restores all verified local anchors', async () => {
  const storage = memoryStorage(), owner = JSON.stringify(['document_owner_0002', 'AUTHENTICATED'])
  const generalTurnId = 'turn_general_document_0002'
  const documents = [
    { turnId: 'turn_document_question_0002', documentId: 'draft_server_document_0002', kind: 'plan' as const,
      text: '이 계획을 설명해줘', answer: '계획 문서 답변', documentRef: 'docref_document_snapshot_000002',
      locator: { producerServiceId: 'draft_service_000002', kind: 'plan' as const, documentId: 'draft_server_document_0002', revision: 3, contentSha256: 'b'.repeat(64) },
      researchThread: { scopeId: 'local-plan-scope', documentId: 'plan' } },
    { turnId: 'turn_document_question_0003', documentId: 'report_server_document_0003', kind: 'report' as const,
      text: '이 보고서도 설명해줘', answer: '보고서 문서 답변', documentRef: 'docref_document_snapshot_000003',
      locator: { producerServiceId: 'report_service_000003', kind: 'report' as const, documentId: 'report_server_document_0003', revision: 4, contentSha256: 'c'.repeat(64) },
      researchThread: { scopeId: 'local-report-scope', documentId: 'report' } },
    { turnId: 'turn_document_question_0004', documentId: 'stress_server_document_0004', kind: 'stress' as const,
      text: '이 스트레스 결과도 설명해줘', answer: '스트레스 문서 답변', documentRef: 'docref_document_snapshot_000004',
      locator: { producerServiceId: 'stress_service_000004', kind: 'stress' as const, documentId: 'stress_server_document_0004', revision: 5, contentSha256: 'e'.repeat(64) },
      researchThread: { scopeId: 'local-stress-scope', documentId: 'stress' } },
  ]
  let loseQuestion = true, loseReconcile = true, historySettled = false, v16Posts = 0
  const clientIds = new Map<string, string>()
  const questionPosts: { body: string; key: string | null }[] = []
  const general = { turnId: generalTurnId, conversationId, clientMessageId: 'client_message_general_0002', state: 'COMPLETED',
    createdAt: timestamp, updatedAt: timestamp, userText: '초기 계획', answerText: '계획 준비', lastSequence: 2, terminalSequence: 2,
    cancelRequested: false, usage, failureCode: null }
  const documentTurn = (index: number, history = false) => {
    const document = documents[index], progressing = history && !historySettled
    return { turnId: document.turnId, conversationId, clientMessageId: clientIds.get(document.turnId) ?? '',
      state: progressing ? 'DISPATCHING' : 'COMPLETED', createdAt: `2026-10-07T00:00:0${index + 1}Z`, updatedAt: `2026-10-07T00:00:0${index + 1}Z`,
      userText: document.text, answerText: progressing ? '' : document.answer, lastSequence: progressing ? 1 : 2,
      terminalSequence: progressing ? null : 2, cancelRequested: false, usage, failureCode: null }
  }
  const v13 = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf-v13', fetch: async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname === '/api/v13/consultation/turns' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)); return new Response(envelope({ ...general, clientMessageId: body.clientMessageId, userText: body.text }), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith(`/turns/${generalTurnId}`)) return new Response(envelope(general), { status: 200, headers: wireHeaders() })
    const turnIndex = documents.findIndex(document => url.pathname.endsWith(`/turns/${document.turnId}`))
    if (turnIndex >= 0) return new Response(envelope(documentTurn(turnIndex)), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_document_join_0002', offset: 0,
      limit: 100, totalCount: 1 + clientIds.size, turns: [general, ...documents.filter(document => clientIds.has(document.turnId)).map((_, index) => documentTurn(index, true))], nextCursor: null }), { status: 200, headers: wireHeaders() })
    throw Error(`unexpected API13 recovery route ${url}`)
  } })
  const v16 = new ConsultationV16Adapter({ origin, fetch: async (input, init) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET'
    if (method === 'POST') v16Posts++
    if (url.pathname.endsWith('/locator')) {
      const document = documents.find(candidate => url.pathname.includes(`/${candidate.documentId}/`))!
      return new Response(envelope16(document.locator), { status: 200, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/document-references')) {
      const body = JSON.parse(String(init?.body)), document = documents.find(candidate => candidate.documentId === body.locator.documentId)!
      return new Response(envelope16({ documentRef: document.documentRef, ...document.locator }), { status: 201, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/document-questions')) {
      const body = String(init?.body); questionPosts.push({ body, key: new Headers(init?.headers).get('idempotency-key') })
      const request = JSON.parse(body), document = documents.find(candidate => candidate.documentRef === request.documentRef)!
      clientIds.set(document.turnId, request.clientMessageId)
      if (loseQuestion) { loseQuestion = false; throw new TypeError('question response lost') }
      return new Response(envelope16({ conversationId, turnId: document.turnId, clientMessageId: request.clientMessageId, documentRef: document.documentRef, state: 'QUEUED' }), { status: 202, headers: wireHeaders() })
    }
    const turnIndex = documents.findIndex(document => url.pathname.endsWith(`/turns/${document.turnId}`))
    if (turnIndex >= 0) {
      if (loseReconcile) { loseReconcile = false; throw new TypeError('first admitted reconcile lost') }
      const document = documents[turnIndex]
      return new Response(envelope16({ conversationId, turnId: document.turnId, clientMessageId: clientIds.get(document.turnId),
        documentRef: document.documentRef, ...document.locator, state: 'COMPLETED' }), { status: 200, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/history')) return new Response(envelope16({ items: documents.filter(document => clientIds.has(document.turnId)).map(document => ({
      conversationId, turnId: document.turnId, clientMessageId: clientIds.get(document.turnId), documentRef: document.documentRef,
      ...document.locator, state: 'QUEUED',
    })), nextCursor: null }), { status: 200, headers: wireHeaders() })
    throw Error(`unexpected API16 recovery route ${url}`)
  } })
  let ordinal = 20
  const options = { storage, documentAdapter: v16, documentCsrfToken: () => 'csrf-v16',
    randomId: () => `00000000-0000-4000-8000-${String(++ordinal).padStart(12, '0')}` }
  let controller = new NativeConsultationV13Controller(v13, options)
  controller.bindOwner(owner); await controller.activate(); expect(await controller.send('초기 계획')).toBe(true)
  expect(await controller.sendDocumentQuestion({ kind: documents[0].kind, documentId: documents[0].documentId,
    text: documents[0].text, researchThread: documents[0].researchThread })).toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ canResumeDocumentPending: true, busy: false })
  controller.detach()

  let resumedOrdinal = 100
  controller = new NativeConsultationV13Controller(v13, { ...options,
    randomId: () => `ffffffff-ffff-4fff-8fff-${String(++resumedOrdinal).padStart(12, '0')}` })
  controller.bindOwner(owner); await controller.activate()
  expect(controller.getSnapshot()).toMatchObject({ availability: 'available', canResumeDocumentPending: true })
  expect(questionPosts).toHaveLength(1)
  const resumed = await controller.resumeDocumentPending()
  expect({ resumed, questionPosts, snapshot: controller.getSnapshot() }).toMatchObject({ resumed: false,
    snapshot: { availability: 'error', canResumeDocumentPending: false, canResumeObservation: true } })
  expect(questionPosts).toHaveLength(2)
  expect(questionPosts[1]).toEqual(questionPosts[0])
  const postsBeforeObservation = v16Posts
  expect(await controller.resumeObservation()).toBe(true)
  expect(v16Posts).toBe(postsBeforeObservation)
  historySettled = true
  expect(await controller.sendDocumentQuestion({ kind: documents[1].kind, documentId: documents[1].documentId,
    text: documents[1].text, researchThread: documents[1].researchThread })).toBe(true)
  const thirdResult = await controller.sendDocumentQuestion({ kind: documents[2].kind, documentId: documents[2].documentId,
    text: documents[2].text, researchThread: documents[2].researchThread })
  expect({ thirdResult, snapshot: controller.getSnapshot(), questionPosts }).toMatchObject({ thirdResult: true })
  const postsAfterJoin = v16Posts
  controller.detach()

  const restored = new NativeConsultationV13Controller(v13, { ...options, randomId: () => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })
  restored.bindOwner(owner); await restored.activate()
  expect(v16Posts).toBe(postsAfterJoin)
  for (const document of documents) {
    expect(restored.getSnapshot().messages.find(message => message.id === clientIds.get(document.turnId))).toMatchObject({ researchThread: document.researchThread })
    expect(restored.getSnapshot().messages.find(message => message.id === `${document.turnId}_reply`)).toMatchObject({ researchThread: document.researchThread })
  }
})

test('first definitive document 4xx is discardable but a 4xx after unknown remains exact-resumable', async () => {
  const storage = memoryStorage(), owner = JSON.stringify(['document_owner_0004', 'AUTHENTICATED'])
  const documentId = 'report_server_document_0004', documentRef = 'docref_document_snapshot_000004'
  const locator = { producerServiceId: 'report_service_000004', kind: 'report' as const, documentId,
    revision: 1, contentSha256: 'd'.repeat(64) }
  const researchThread = { scopeId: 'local-report-scope-4', documentId: 'report' }
  let generalClientMessageId = 'client_message_general_0004'
  const general = () => ({ turnId: 'turn_general_document_0004', conversationId, clientMessageId: generalClientMessageId, state: 'COMPLETED',
    createdAt: timestamp, updatedAt: timestamp, userText: '기존 상담', answerText: '기존 답변', lastSequence: 2, terminalSequence: 2,
    cancelRequested: false, usage, failureCode: null })
  const v13 = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf-v13', fetch: async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
    if (url.pathname === '/api/v13/consultation/turns' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)); generalClientMessageId = body.clientMessageId
      return new Response(envelope({ ...general(), userText: body.text }), { status: 202, headers: wireHeaders() })
    }
    if (url.pathname.endsWith('/turns/turn_general_document_0004')) return new Response(envelope(general()), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/history')) return new Response(envelope({ conversationId, snapshotId: 'snapshot_document_refusal_0004', offset: 0,
      limit: 100, totalCount: 1, turns: [general()], nextCursor: null }), { status: 200, headers: wireHeaders() })
    throw Error(`unexpected API13 refusal route ${url}`)
  } })
  let questionAttempts = 0
  const questionCalls: { body: string; key: string | null }[] = []
  const error16 = (code: string, message: string) => JSON.stringify({ apiContractVersion: '0.16.0', error: { code, message } })
  const v16 = new ConsultationV16Adapter({ origin, fetch: async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('/locator')) return new Response(envelope16(locator), { status: 200, headers: wireHeaders() })
    if (url.pathname.endsWith('/document-references')) return new Response(envelope16({ documentRef, ...locator }), { status: 201, headers: wireHeaders() })
    if (url.pathname.endsWith('/document-questions')) {
      questionAttempts++
      questionCalls.push({ body: String(init?.body), key: new Headers(init?.headers).get('idempotency-key') })
      if (questionAttempts === 1) return new Response(error16('BAD_REQUEST', 'Document question request is invalid.'), { status: 400, headers: wireHeaders() })
      if (questionAttempts === 2) throw new TypeError('question result unknown')
      return new Response(error16('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used.'), { status: 409, headers: wireHeaders() })
    }
    throw Error(`unexpected API16 refusal route ${url}`)
  } })
  let ordinal = 40
  const options = { storage, documentAdapter: v16, documentCsrfToken: () => 'csrf-v16',
    randomId: () => `00000000-0000-4000-8000-${String(++ordinal).padStart(12, '0')}` }
  let controller = new NativeConsultationV13Controller(v13, options)
  controller.bindOwner(owner); await controller.activate(); expect(await controller.send('기존 상담')).toBe(true)

  expect(await controller.sendDocumentQuestion({ kind: 'report', documentId, text: '첫 거절 질문', researchThread })).toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ canDiscardPending: true, canResumeDocumentPending: false })
  controller.detach()

  controller = new NativeConsultationV13Controller(v13, { ...options, randomId: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })
  controller.bindOwner(owner); await controller.activate()
  expect(controller.getSnapshot()).toMatchObject({ availability: 'available', conversationId, canDiscardPending: true })
  expect(controller.discardPending()).toBe(true)
  expect(controller.getSnapshot()).toMatchObject({ availability: 'error', canResumeObservation: true })
  expect(await controller.resumeObservation()).toBe(true)
  expect(controller.getSnapshot()).toMatchObject({ availability: 'available', conversationId })

  expect(await controller.sendDocumentQuestion({ kind: 'report', documentId, text: '응답 미확인 질문', researchThread })).toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ canDiscardPending: false, canResumeDocumentPending: true })
  expect(await controller.resumeDocumentPending()).toBe(false)
  expect(controller.getSnapshot()).toMatchObject({ canDiscardPending: false, canResumeDocumentPending: true })
  expect(questionCalls.slice(1)).toHaveLength(2)
  expect(questionCalls[2]).toEqual(questionCalls[1])
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

test('actual app sends an owner-bound plan question through API16 and renders the answer in that document thread', async ({ page }) => {
  const ready = conversationFixture.snapshots.ready
  const authenticated = { ...session, sessionId: 'session_plan_fixture_000001', state: 'AUTHENTICATED' as const,
    issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
  const owner = JSON.stringify([authenticated.sessionId, authenticated.state])
  const generalTurnId = 'turn_document_app_general_0001', documentTurnId = 'turn_document_app_answer_0001'
  const generalClientMessageId = 'client_message_document_app_general_0001'
  const general = { turnId: generalTurnId, conversationId, clientMessageId: generalClientMessageId, state: 'COMPLETED',
    createdAt: timestamp, updatedAt: timestamp, userText: '기존 상담', answerText: '기존 상담 답변', lastSequence: 2, terminalSequence: 2,
    cancelRequested: false, usage, failureCode: null }
  const locator = { producerServiceId: 'draft_service_document_app_0001', kind: 'plan', documentId: ready.draftId,
    revision: ready.draftState.revision, contentSha256: 'd'.repeat(64) }
  const documentRef = 'docref_document_app_snapshot_0001'
  let documentClientMessageId = ''
  const documentTurn = () => ({ turnId: documentTurnId, conversationId, clientMessageId: documentClientMessageId, state: 'COMPLETED',
    createdAt: '2026-10-07T00:00:01Z', updatedAt: '2026-10-07T00:00:01Z', userText: '이 계획의 근거를 설명해줘',
    answerText: '계획 문서 근거 답변', lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null })
  const calls: { method: string; path: string; body: string | null }[] = []
  await page.addInitScript(({ conversationId: storedConversationId, owner: storedOwner, consultationOwner, consultationConversationId, consultationTurnId }) => {
    sessionStorage.setItem('tesia.native.conversation', storedConversationId)
    sessionStorage.setItem('tesia.native.conversation-session', storedOwner)
    sessionStorage.setItem(`tesia.native.consultation-v13.accepted:${encodeURIComponent(consultationOwner)}`, JSON.stringify({
      version: 1, owner: consultationOwner, conversationId: consultationConversationId, turnId: consultationTurnId,
    }))
  }, { conversationId: ready.conversationId, owner: authenticated.sessionId, consultationOwner: owner,
    consultationConversationId: conversationId, consultationTurnId: generalTurnId })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"plan_session_etag_fixture_0001"' },
      body: JSON.stringify({ meta: meta('0.1.0', '1'), data: authenticated }) })
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      meta: meta('0.1.0', null), data: { csrfToken: 'csrf_plan_fixture_000001', expiresAt: authenticated.expiresAt },
    }) })
    if (url.pathname.startsWith(`/api/v3/conversations/${ready.conversationId}`) && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { ETag: '"plan_conversation_etag_fixture_0004"' }, body: JSON.stringify({
        meta: { requestId: 'req_document_app_000001', traceId: 'trace_document_app_000001', apiContractVersion: '0.3.0',
          resourceRevision: ready.conversationStateRevision }, data: ready,
      }) })
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (url.pathname === `/api/v13/consultation/turns/${generalTurnId}`) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(general) })
    if (url.pathname === `/api/v13/consultation/turns/${documentTurnId}`) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(documentTurn()) })
    if (url.pathname === `/api/v13/consultation/conversations/${conversationId}/history`) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({
      conversationId, snapshotId: 'snapshot_document_app_0001', offset: 0, limit: 100, totalCount: documentClientMessageId ? 2 : 1,
      turns: documentClientMessageId ? [general, documentTurn()] : [general], nextCursor: null,
    }) })
    if (url.pathname.startsWith('/api/v16/')) {
      calls.push({ method, path: url.pathname, body: request.postData() })
      if (url.pathname.endsWith(`/documents/plan/${ready.draftId}/locator`) && method === 'GET') return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16(locator) })
      if (url.pathname.endsWith('/document-references') && method === 'POST') return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16({ documentRef, ...locator }) })
      if (url.pathname.endsWith('/document-questions') && method === 'POST') {
        const body = request.postDataJSON(); documentClientMessageId = body.clientMessageId
        return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16({
          conversationId, turnId: documentTurnId, clientMessageId: documentClientMessageId, documentRef, state: 'QUEUED',
        }) })
      }
      const projection = { conversationId, turnId: documentTurnId, clientMessageId: documentClientMessageId, documentRef, ...locator, state: 'COMPLETED' }
      if (url.pathname.endsWith(`/turns/${documentTurnId}`) && method === 'GET') return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16(projection) })
      if (url.pathname.endsWith('/history') && method === 'GET') return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16({ items: [projection], nextCursor: null }) })
    }
    return route.abort('blockedbyclient')
  })
  await page.goto('/')
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  const workspace = page.locator('.native-research-workspace')
  await expect(workspace).toBeVisible()
  const composer = page.locator('.g-composer textarea')
  await composer.fill('이 계획의 근거를 설명해줘'); await composer.press('Enter')
  const thread = workspace.locator('.native-research-thread[data-document-id="plan"]')
  await expect(thread).toContainText('계획 문서 근거 답변')
  expect(calls.map(call => `${call.method} ${call.path}`)).toEqual([
    `GET /api/v16/consultation/documents/plan/${ready.draftId}/locator`,
    'POST /api/v16/consultation/document-references',
    `POST /api/v16/consultation/conversations/${conversationId}/document-questions`,
    `GET /api/v16/consultation/turns/${documentTurnId}`,
    `GET /api/v16/consultation/conversations/${conversationId}/history`,
  ])
  expect(JSON.parse(calls[1].body!)).toEqual({ apiContractVersion: '0.16.0', locator })
  expect(JSON.parse(calls[2].body!)).toEqual({ apiContractVersion: '0.16.0', clientMessageId: documentClientMessageId,
    text: '이 계획의 근거를 설명해줘', documentRef })
})

test('cold plan question retries one immutable first admission then observes the server conversation without another POST', async ({ page }) => {
  const ready = conversationFixture.snapshots.ready
  const owner = JSON.stringify([session.sessionId, session.state])
  const coldConversationId = 'conversation_cold_document_0001'
  const coldTurnId = 'turn_cold_document_answer_0001'
  const locator = { producerServiceId: 'draft_service_cold_document_01', kind: 'plan' as const, documentId: ready.draftId,
    revision: ready.draftState.revision, contentSha256: 'e'.repeat(64) }
  const documentRef = 'docref_cold_document_snapshot_0001'
  const question = '처음 여는 계획의 근거를 설명해줘'
  const answer = '서버가 만든 첫 문서 대화의 답변'
  let documentClientMessageId = ''
  let firstAdmissionReads = 0
  const firstAdmissions: { key?: string; body: string | null }[] = []
  const scopedPosts: string[] = []
  const coldTurn = () => ({ turnId: coldTurnId, conversationId: coldConversationId, clientMessageId: documentClientMessageId,
    state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, userText: question, answerText: answer,
    lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null })
  const projection = () => ({ conversationId: coldConversationId, turnId: coldTurnId,
    clientMessageId: documentClientMessageId, documentRef, ...locator, state: 'COMPLETED' })

  await page.addInitScript(({ conversationId: storedConversationId, sessionId }) => {
    sessionStorage.setItem('tesia.native.conversation', storedConversationId)
    sessionStorage.setItem('tesia.native.conversation-session', sessionId)
  }, { conversationId: ready.conversationId, sessionId: session.sessionId })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"cold_document_session_etag_01"' },
      body: JSON.stringify({ meta: meta('0.1.0', '1'), data: session }) })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      meta: meta('0.1.0', null), data: { csrfToken: 'csrf_cold_document_fixture_01', expiresAt: session.expiresAt },
    }) })
    if (path.startsWith(`/api/v3/conversations/${ready.conversationId}`) && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { ETag: '"cold_document_conversation_etag_04"' }, body: JSON.stringify({
        meta: { requestId: 'req_cold_document_0001', traceId: 'trace_cold_document_0001', apiContractVersion: '0.3.0',
          resourceRevision: ready.conversationStateRevision }, data: ready,
      }) })
    if (path.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (path === `/api/v16/consultation/documents/plan/${ready.draftId}/locator` && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16(locator) })
    if (path === '/api/v16/consultation/document-references' && method === 'POST') return route.fulfill({ status: 201, contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16({ documentRef, ...locator }) })
    if (path === '/api/v16/consultation/document-questions' && method === 'POST') {
      firstAdmissions.push({ key: request.headers()['idempotency-key'], body: request.postData() })
      if (firstAdmissions.length === 1) return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' },
        body: JSON.stringify({ apiContractVersion: '0.16.0', error: { code: 'PROVIDER_UNAVAILABLE', message: 'Provider unavailable.' } }) })
      documentClientMessageId = request.postDataJSON().clientMessageId
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16({
        conversationId: coldConversationId, turnId: coldTurnId, clientMessageId: documentClientMessageId, documentRef, state: 'QUEUED',
      }) })
    }
    if (path === `/api/v16/consultation/conversations/${coldConversationId}/document-questions` && method === 'POST') {
      scopedPosts.push(path); return route.abort('blockedbyclient')
    }
    if (path === `/api/v16/consultation/turns/${coldTurnId}` && method === 'GET') {
      firstAdmissionReads++
      if (firstAdmissionReads === 1) return route.abort('connectionfailed')
      return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16(projection()) })
    }
    if (path === `/api/v16/consultation/conversations/${coldConversationId}/history` && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16({ items: [projection()], nextCursor: null }) })
    if (path === `/api/v13/consultation/conversations/${coldConversationId}/history` && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope({ conversationId: coldConversationId,
        snapshotId: 'snapshot_cold_document_0001', offset: 0, limit: 100, totalCount: 1, turns: [coldTurn()], nextCursor: null }) })
    if (path === `/api/v13/consultation/turns/${coldTurnId}` && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope(coldTurn()) })
    return route.abort('blockedbyclient')
  })

  await page.goto('/')
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  const workspace = page.locator('.native-research-workspace')
  await expect(workspace).toBeVisible()
  const composer = page.locator('.g-composer textarea')
  await composer.fill(question); await composer.press('Enter')
  const retry = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await expect(retry).toBeVisible()
  await retry.click()
  await expect.poll(() => firstAdmissions.length).toBe(2)
  expect(firstAdmissions[1]).toEqual(firstAdmissions[0])
  const observe = page.getByRole('button', { name: '진행 자동 확인 재개', exact: true })
  await expect(observe).toBeVisible()
  await observe.click()
  await expect(workspace.locator('.native-research-thread[data-document-id="plan"]')).toContainText(answer)
  expect({ firstAdmissionPosts: firstAdmissions.length, scopedPosts: scopedPosts.length, firstAdmissionReads }).toEqual({
    firstAdmissionPosts: 2, scopedPosts: 0, firstAdmissionReads: 2,
  })
  expect(JSON.parse(firstAdmissions[0].body!)).toEqual({ apiContractVersion: '0.16.0',
    clientMessageId: documentClientMessageId, text: question, documentRef })
})

test('actual app presents claimed anonymous plan anchors only in the current AUTH document thread', async ({ page }) => {
  const ready = conversationFixture.snapshots.ready
  const authenticated = { ...session, sessionId: 'session_claimed_plan_target_01', state: 'AUTHENTICATED' as const,
    issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' }
  const anonymousSessionId = 'session_claimed_plan_source_01'
  const owner = JSON.stringify([authenticated.sessionId, authenticated.state])
  const sourceScope = JSON.stringify([anonymousSessionId, 'ANONYMOUS', ready.conversationId, ready.draftId])
  const claimedTurnId = 'turn_claimed_plan_answer_0001'
  const claimedClientMessageId = 'client_message_claimed_plan_0001'
  const question = '로그인 전 계획 질문'
  const answer = '로그인 뒤에도 같은 계획 문서에 표시되는 답변'
  const textSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(question)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
  const locator = { producerServiceId: 'draft_service_claimed_plan_01', kind: 'plan' as const, documentId: ready.draftId,
    revision: ready.draftState.revision, contentSha256: 'c'.repeat(64) }
  const researchThread = { scopeId: sourceScope, documentId: 'plan' }
  const documentRef = 'docref_claimed_plan_snapshot_0001'
  const claimedTurn = { turnId: claimedTurnId, conversationId: ready.conversationId, clientMessageId: claimedClientMessageId,
    state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, userText: question, answerText: answer,
    lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }
  const projection = { conversationId: ready.conversationId, turnId: claimedTurnId, clientMessageId: claimedClientMessageId,
    documentRef, ...locator, state: 'COMPLETED' }
  const journal = JSON.stringify({ version: 2, stage: 'settled', owner, conversationId: ready.conversationId, bindings: [{
    conversationId: ready.conversationId, turnId: claimedTurnId, clientMessageId: claimedClientMessageId, textSha256,
    createdAt: timestamp, lastSequence: 2, documentRef, locator, researchThread,
  }] })
  await page.addInitScript(({ conversationId: storedConversationId, sessionId, owner: storedOwner, acceptedTurnId, journal: storedJournal }) => {
    sessionStorage.setItem('tesia.native.conversation', storedConversationId)
    sessionStorage.setItem('tesia.native.conversation-session', sessionId)
    sessionStorage.setItem(`tesia.native.consultation-v13.accepted:${encodeURIComponent(storedOwner)}`, JSON.stringify({
      version: 1, owner: storedOwner, conversationId: storedConversationId, turnId: acceptedTurnId,
    }))
    sessionStorage.setItem(`tesia.native.consultation-v16.document-question:${encodeURIComponent(storedOwner)}`, storedJournal)
  }, { conversationId: ready.conversationId, sessionId: authenticated.sessionId, owner, acceptedTurnId: claimedTurnId, journal })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"claim_plan_session_etag_01"' },
      body: JSON.stringify({ meta: meta('0.1.0', '1'), data: authenticated }) })
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      meta: meta('0.1.0', null), data: { csrfToken: 'csrf_claimed_plan_fixture_01', expiresAt: authenticated.expiresAt },
    }) })
    if (url.pathname.startsWith(`/api/v3/conversations/${ready.conversationId}`) && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { ETag: '"claim_plan_conversation_etag_04"' }, body: JSON.stringify({
        meta: { requestId: 'req_claimed_plan_0001', traceId: 'trace_claimed_plan_0001', apiContractVersion: '0.3.0',
          resourceRevision: ready.conversationStateRevision }, data: ready,
      }) })
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (url.pathname === `/api/v13/consultation/conversations/${ready.conversationId}/history`) return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope({ conversationId: ready.conversationId,
        snapshotId: 'snapshot_claimed_plan_0001', offset: 0, limit: 100, totalCount: 1, turns: [claimedTurn], nextCursor: null }) })
    if (url.pathname === `/api/v13/consultation/turns/${claimedTurnId}`) return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope(claimedTurn) })
    if (url.pathname === `/api/v16/consultation/conversations/${ready.conversationId}/history`) return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16({ items: [projection], nextCursor: null }) })
    if (url.pathname === `/api/v16/consultation/turns/${claimedTurnId}`) return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16(projection) })
    return route.abort('blockedbyclient')
  })
  await page.goto('/')
  await page.locator('.g-tabs').getByRole('button', { name: '전략 초안', exact: true }).click()
  const thread = page.locator('.native-research-thread[data-document-id="plan"]')
  await expect(thread).toContainText(question)
  await expect(thread).toContainText(answer)
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

test('SETUP admission waits 800ms and accepts only the latest exact durable COMPLETED turn without POST', async () => {
  const setup = '[SETUP {"entryMode":null,"pair":"ETH/USDT"}]'
  const answerText = `설정 조건을 이어서 확인합니다.\n${setup}`
  const owner = JSON.stringify(['authenticated_setup_session_01', 'AUTHENTICATED'])
  const acceptedKey = `tesia.native.consultation-v13.accepted:${encodeURIComponent(owner)}`
  type Drift = 'none' | 'history' | 'answer' | 'sequence' | 'binding' | 'owner' | 'failed'

  {
    const storage = memoryStorage(), waits: number[] = []
    let posts = 0, historyReads = 0, turnReads = 0, release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const completed = { turnId, conversationId, clientMessageId: 'client_message_live_setup_01', state: 'COMPLETED',
      createdAt: timestamp, updatedAt: timestamp, userText: 'ETH 전략 만들어줘', answerText, lastSequence: 2, terminalSequence: 2,
      cancelRequested: false, usage, failureCode: null }
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
      if (url.pathname.endsWith('/turns') && init?.method === 'POST') {
        posts++
        const body = JSON.parse(String(init.body))
        return new Response(envelope({ ...completed, clientMessageId: body.clientMessageId, userText: body.text }), { status: 202, headers: wireHeaders() })
      }
      if (url.pathname.endsWith('/history')) {
        historyReads++
        const locator = JSON.parse(storage.getItem(acceptedKey)!)
        const durable = { ...completed, clientMessageId: locator.turnId === turnId ? 'client_message_live_setup_01' : completed.clientMessageId }
        return new Response(envelope({ conversationId, snapshotId: 'snapshot_live_setup_01', offset: 0, limit: 100,
          totalCount: 1, turns: [durable], nextCursor: null }), { status: 200, headers: wireHeaders() })
      }
      if (url.pathname.endsWith(`/turns/${turnId}`)) {
        turnReads++
        return new Response(envelope(completed), { status: 200, headers: wireHeaders() })
      }
      throw Error(`unexpected live SETUP route ${url}`)
    }
    const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
      storage, wait: async milliseconds => { waits.push(milliseconds); await held },
      randomId: () => 'live_setup_01',
    })
    controller.bindOwner(owner); await controller.activate(); expect(await controller.send('ETH 전략 만들어줘')).toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ busy: false, setupCandidate: null })
    expect(controller.getSnapshot().messages[1].text).toBe('설정 조건을 이어서 확인합니다.')
    expect(waits).toEqual([800])
    release()
    await expect.poll(() => controller.getSnapshot().setupCandidate).toEqual({
      owner, conversationId, turnId, setup: { entryMode: null, pair: 'ETH/USDT' },
    })
    expect({ posts, historyReads, turnReads }).toEqual({ posts: 1, historyReads: 1, turnReads: 1 })
    controller.detach()
  }

  for (const drift of ['none', 'history', 'answer', 'sequence', 'binding', 'owner', 'failed'] as const satisfies readonly Drift[]) {
    const storage = memoryStorage()
    storage.setItem(acceptedKey, JSON.stringify({ version: 1, owner, conversationId, turnId }))
    const initial = { turnId, conversationId, clientMessageId: 'client_message_setup_0001', state: drift === 'failed' ? 'FAILED' : 'COMPLETED',
      createdAt: timestamp, updatedAt: timestamp, userText: 'ETH 전략 만들어줘', answerText, lastSequence: 2, terminalSequence: 2,
      cancelRequested: false, usage, failureCode: drift === 'failed' ? 'INTERNAL_ERROR' : null }
    let historyReads = 0, turnReads = 0, posts = 0, release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const waits: number[] = []
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/capabilities')) return new Response(envelope(capability), { status: 200, headers: wireHeaders() })
      if (init?.method === 'POST') { posts++; throw Error('SETUP observation must not POST') }
      if (url.pathname.endsWith('/history')) {
        historyReads++
        const latest = historyReads === 1 ? initial : drift === 'history'
          ? { ...initial, turnId: 'turn_setup_newer_0001', clientMessageId: 'client_message_setup_newer_0001' }
          : drift === 'sequence' ? { ...initial, lastSequence: 3, terminalSequence: 3 } : initial
        return new Response(envelope({ conversationId, snapshotId: `snapshot_setup_${historyReads}`, offset: 0, limit: 100,
          totalCount: 1, turns: [latest], nextCursor: null }), { status: 200, headers: wireHeaders() })
      }
      if (url.pathname.endsWith(`/turns/${turnId}`)) {
        turnReads++
        const observed = turnReads === 1 ? initial : drift === 'answer' ? { ...initial, answerText: `${answerText} 변조` }
          : drift === 'sequence' ? { ...initial, lastSequence: 3, terminalSequence: 3 }
          : drift === 'binding' ? { ...initial, conversationId: 'conversation_setup_foreign_01' } : initial
        return new Response(envelope(observed), { status: 200, headers: wireHeaders() })
      }
      throw Error(`unexpected SETUP route ${url}`)
    }
    const controller = new NativeConsultationV13Controller(new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf' }), {
      storage, wait: async milliseconds => { waits.push(milliseconds); await held },
    })
    controller.bindOwner(owner)
    await controller.activate()
    expect(controller.getSnapshot().setupCandidate).toBeNull()
    expect(controller.getSnapshot().messages[1].text).toBe('설정 조건을 이어서 확인합니다.')
    if (drift === 'failed') {
      expect(waits).toEqual([])
      expect({ historyReads, turnReads, posts }).toEqual({ historyReads: 1, turnReads: 1, posts: 0 })
      controller.detach()
      continue
    }
    expect(waits).toEqual([800])
    if (drift === 'owner') controller.bindOwner(JSON.stringify(['authenticated_setup_session_02', 'AUTHENTICATED']))
    release()
    await expect.poll(() => ({ historyReads, turnReads })).toEqual(drift === 'owner'
      ? { historyReads: 1, turnReads: 1 } : { historyReads: 2, turnReads: 2 })
    if (drift === 'none') {
      await expect.poll(() => controller.getSnapshot().setupCandidate).toEqual({
        owner, conversationId, turnId, setup: { entryMode: null, pair: 'ETH/USDT' },
      })
    } else expect(controller.getSnapshot().setupCandidate).toBeNull()
    expect(posts).toBe(0)
    controller.detach()
  }
})

test('durable SETUP reuses the original five-answer intake and explicitly retries one API19 body and key', async ({ page }) => {
  const setup = '[SETUP {"entryMode":null,"pair":"BTC/USDT"}]'
  const answerText = `설정 조건을 이어서 확인합니다.\n${setup}`
  const completed = { turnId, conversationId, clientMessageId: 'client_message_source_intake_01', state: 'COMPLETED',
    createdAt: timestamp, updatedAt: timestamp, userText: 'BTC 전략 만들어줘', answerText, lastSequence: 2, terminalSequence: 2,
    cancelRequested: false, usage, failureCode: null }
  let accepted = completed
  let consultationPosts = 0
  const v19: { key: string | undefined; body: string | null; origin: string | undefined }[] = []
  let v20Reads = 0, v3Posts = 0
  const v16Requests: string[] = []
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!url.pathname.startsWith('/api/')) return route.continue()
    if (url.pathname.startsWith('/api/v16/')) { v16Requests.push(`${method} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/api/v3/') && method === 'POST') { v3Posts++; return route.abort('blockedbyclient') }
    if (url.pathname === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: '"session_consultation_browser_01"' }, body: JSON.stringify({ meta: meta('0.1.0', '1'), data: session }) })
    if (url.pathname === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meta: meta('0.1.0', null), data: { csrfToken: 'csrf_consultation_browser_01', expiresAt: session.expiresAt } }) })
    if (url.pathname.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (url.pathname === '/api/v13/consultation/turns' && method === 'POST') {
      const body = request.postDataJSON()
      consultationPosts++
      accepted = { ...completed, turnId: consultationPosts === 1 ? turnId : 'turn_source_intake_000002',
        clientMessageId: body.clientMessageId, userText: body.text }
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(accepted) })
    }
    if (url.pathname.endsWith('/history')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope({
      conversationId, snapshotId: 'snapshot_source_intake_01', offset: 0, limit: 100, totalCount: 1, turns: [accepted], nextCursor: null,
    }) })
    if (url.pathname === `/api/v13/consultation/turns/${accepted.turnId}`) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(accepted) })
    if (url.pathname === `/api/v19/consultation/conversations/${conversationId}/turns/${turnId}/source-intake-completions` && method === 'POST') {
      v19.push({ key: request.headers()['idempotency-key'], body: request.postData(), origin: request.headers()['origin'] })
      if (v19.length === 1) return route.fulfill({ status: 409, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({
        apiContractVersion: '0.19.0', error: { code: 'SOURCE_INTAKE_INVALID', message: 'Source intake invalid.' },
      }) })
      if (v19.length === 2) return route.abort('connectionfailed')
      const sha = 'a'.repeat(64)
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({
        apiContractVersion: '0.19.0', data: { completionCommitId: 'completion_commit_source_01', committedAt: timestamp,
          sourceIntakeReceipt: { receiptId: 'source_intake_receipt_01', conversationId, turnId, sourceSessionId: session.sessionId,
            sourceOwnerBindingSha256: sha, sourceRequestSha256: sha, sourceAnswerSha256: sha, sourceBindingSha256: sha, answersSha256: sha },
          researchWorkIntent: { researchWorkId: 'research_work_source_01', sourceIntakeReceiptId: 'source_intake_receipt_01', state: 'QUEUED' } },
      }) })
    }
    if (url.pathname === '/api/v20/consultation/research-works/research_work_source_01' && method === 'GET') {
      v20Reads++
      return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({
        apiContractVersion: '0.20.0', data: v20Reads === 1
          ? { researchWorkId: 'research_work_source_01', state: 'QUEUED' }
          : { researchWorkId: 'research_work_source_01', state: 'COMPLETED', reportText: '실제 연구 보고서' },
      }) })
    }
    return route.abort('blockedbyclient')
  })

  await page.goto('/')
  const home = page.locator('#strategy-idea'); await home.fill('BTC 전략 만들어줘'); await home.press('Enter')
  const intake = page.getByTestId('source-intake')
  await expect(intake).toBeVisible()
  await intake.locator('.intake-options button').nth(2).click()
  await expect(intake).toHaveAttribute('data-answer-count', '1')
  for (let answer = 1; answer < 5; answer++) await intake.locator('.intake-options button').first().click()
  await expect.poll(() => v19.length).toBe(1)
  await expect(intake).toHaveAttribute('data-answer-count', '0')

  for (let answer = 0; answer < 5; answer++) await intake.locator('.intake-options button').first().click()
  await expect(intake).toHaveAttribute('data-answer-count', '5')
  await expect.poll(() => v19.length).toBe(2)
  const resume = page.getByRole('button', { name: '같은 요청으로 재개', exact: true })
  await expect(resume).toBeVisible()
  await resume.click()
  await expect.poll(() => v19.length).toBe(3)
  expect(v19[2]).toEqual(v19[1])
  expect(v19[0]?.key).not.toBe(v19[1]?.key)
  expect(JSON.parse(v19[1]!.body!)).toEqual({ apiContractVersion: '0.19.0', answers: [
    { key: 'asset', index: 0, recommended: false }, { key: 'style', index: 0, recommended: false },
    { key: 'budget', index: 0, recommended: false }, { key: 'period', index: 0, recommended: false },
    { key: 'stop', index: 0, recommended: false },
  ] })
  await expect(resume).toHaveCount(0)
  await expect(intake).toHaveAttribute('data-answer-count', '5')
  await expect(page.getByText('실제 연구 보고서', { exact: true })).toBeVisible({ timeout: 10_000 })
  expect(v20Reads).toBeGreaterThanOrEqual(2)
  await page.reload()
  await expect(page.getByTestId('source-intake')).toHaveAttribute('data-answer-count', '5')
  await expect(page.getByRole('button', { name: '같은 요청으로 재개', exact: true })).toHaveCount(0)
  expect(v19).toHaveLength(3)
  await expect(page.getByText('실제 연구 보고서', { exact: true })).toBeVisible()

  const workspace = page.locator('.native-research-workspace')
  await expect(workspace.getByRole('tab', { name: '검증 결과', exact: true })).toHaveAttribute('aria-selected', 'true')
  const unsupported = page.locator('.g-composer textarea')
  await unsupported.fill('접근할 수 없는 보고서 질문은 보존')
  const postsBeforeUnsupported = consultationPosts
  const v16BeforeUnsupported = [...v16Requests]
  await unsupported.press('Enter')
  await expect(unsupported).toHaveValue('접근할 수 없는 보고서 질문은 보존')
  await expect(page.getByText('실제 연구 보고서', { exact: true })).toBeVisible()
  await unsupported.fill('같은 보고서의 다음 질문도 보존')
  await unsupported.press('Enter')
  await expect(unsupported).toHaveValue('같은 보고서의 다음 질문도 보존')
  expect({ consultationPosts, v16Requests, v3Posts }).toEqual({ consultationPosts: postsBeforeUnsupported,
    v16Requests: [...v16BeforeUnsupported,
      'GET /api/v16/consultation/documents/report/research_work_source_01/locator',
      'GET /api/v16/consultation/documents/report/research_work_source_01/locator'], v3Posts: 0 })
  expect(v19).toHaveLength(3)
})

test('claimed report replays its accepted API19 tuple before reload and a following API16 question', async ({ page }) => {
  const ready = conversationFixture.snapshots.ready
  const anon = 'session_report_claim_source_01', target = 'session_report_claim_target_01'
  const anonOwner = JSON.stringify([anon, 'ANONYMOUS']), authOwner = JSON.stringify([target, 'AUTHENTICATED'])
  const setupTurnId = 'turn_report_setup_source_01', reportTurnId = 'turn_report_question_source_01'
  const reportClientId = 'client_message_report_source_01', workId = 'research_work_report_claim_01'
  const reportQuestion = '로그인 전 보고서 질문', reportAnswer = '로그인 전 보고서 답변'
  const reportCreatedAt = '2026-10-07T00:00:01Z'
  const textSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reportQuestion)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
  const locator = { producerServiceId: 'report_service_claimed_01', kind: 'report' as const, documentId: workId,
    revision: 7, contentSha256: 'b'.repeat(64) }
  const documentRef = 'docref_report_claimed_snapshot_01', researchThread = { scopeId: workId, documentId: 'report' }
  const reportTurn = { turnId: reportTurnId, conversationId: ready.conversationId, clientMessageId: reportClientId,
    state: 'COMPLETED', createdAt: reportCreatedAt, updatedAt: reportCreatedAt, userText: reportQuestion, answerText: reportAnswer,
    lastSequence: 2, terminalSequence: 2, cancelRequested: false, usage, failureCode: null }
  const setupTurn = { ...reportTurn, turnId: setupTurnId, clientMessageId: 'client_message_report_setup_01',
    createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z', userText: 'BTC 전략 만들어줘',
    answerText: '[SETUP {"entryMode":null,"pair":"BTC/USDT"}]' }
  const projection = { conversationId: ready.conversationId, turnId: reportTurnId, clientMessageId: reportClientId,
    documentRef, ...locator, state: 'COMPLETED' }
  const sourceJournal = JSON.stringify({ version: 2, stage: 'settled', owner: anonOwner, conversationId: ready.conversationId, bindings: [{
    conversationId: ready.conversationId, turnId: reportTurnId, clientMessageId: reportClientId, textSha256,
    createdAt: reportCreatedAt, lastSequence: 2, documentRef, locator, researchThread,
  }] })
  const completion = { completionCommitId: 'completion_commit_report_claim_01', receiptId: 'source_intake_receipt_report_01',
    researchWorkId: workId, sourceSessionId: anon }
  const intake = { version: 2, owner: anonOwner, locatorOwner: anonOwner, conversationId: ready.conversationId,
    turnId: setupTurnId, pair: 'BTC/USDT', value: { answers: [
      { key: 'asset', index: 0, recommended: false }, { key: 'style', index: 0, recommended: false },
      { key: 'budget', index: 0, recommended: false }, { key: 'period', index: 0, recommended: false },
      { key: 'stop', index: 0, recommended: false },
    ] }, status: 'accepted', idempotencyKey: 'source_intake_report_claim_key_01', completion }
  const offer = { anonymousSessionId: anon, anonymousIfMatch: '"anonymous_report_claim_etag_01"', targetSessionId: target,
    conversationId: ready.conversationId }
  const pendingClaim = { version: 1, offer, idempotencyKey: 'consultation_report_claim_key_01', expectedRevision: '1',
    committedRevision: null, disposition: 'uncertain' }
  await page.addInitScript(({ ready, target, authOwner, anonOwner, setupTurnId, pendingClaim, sourceJournal, intake }) => {
    if (sessionStorage.getItem('tesia.fixture.report-claim.seeded') === '1') return
    sessionStorage.setItem('tesia.native.conversation', ready.conversationId)
    sessionStorage.setItem('tesia.native.conversation-session', target)
    sessionStorage.setItem('tesia.native.session-binding', JSON.stringify({ sessionId: target, sessionState: 'AUTHENTICATED' }))
    sessionStorage.setItem(`tesia.native.consultation-v14.claim:${encodeURIComponent(target)}`, JSON.stringify(pendingClaim))
    sessionStorage.setItem(`tesia.native.consultation-v16.document-question:${encodeURIComponent(anonOwner)}`, sourceJournal)
    sessionStorage.setItem(`tesia.native.consultation-v19.source-intake:${encodeURIComponent(JSON.stringify([anonOwner, ready.conversationId, setupTurnId, 'BTC/USDT']))}`,
      JSON.stringify(intake))
    sessionStorage.removeItem(`tesia.native.consultation-v13.accepted:${encodeURIComponent(authOwner)}`)
    sessionStorage.setItem('tesia.fixture.report-claim.seeded', '1')
  }, { ready, target, authOwner, anonOwner, setupTurnId, pendingClaim, sourceJournal, intake })
  let claimed = false, failFirstCompletionReplay = true, followupClientId = ''
  const api19Calls: { key?: string; body: string | null }[] = []
  let api3Posts = 0
  const followupTurnId = 'turn_report_followup_answer_01'
  const followupTurn = () => ({ ...reportTurn, turnId: followupTurnId, clientMessageId: followupClientId,
    createdAt: '2026-10-07T00:00:02Z', updatedAt: '2026-10-07T00:00:02Z', userText: '이 보고서의 다음 근거는?', answerText: '후속 보고서 답변' })
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: browserHtml })
    if (!path.startsWith('/api/')) return route.continue()
    if (path.startsWith('/api/v3/') && method === 'POST') { api3Posts++; return route.abort('blockedbyclient') }
    if (path === '/api/v1/auth/session') return route.fulfill({ contentType: 'application/json', headers: { ETag: claimed ? '"authenticated_report_claim_etag_02"' : '"authenticated_report_claim_etag_01"' },
      body: JSON.stringify({ meta: meta('0.1.0', claimed ? '2' : '1'), data: { ...session, sessionId: target,
        state: 'AUTHENTICATED', revision: claimed ? '2' : '1', issuedAt: '2030-01-01T00:00:00Z', expiresAt: '2030-01-02T00:00:00Z' } }) })
    if (path === '/api/v1/auth/csrf') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({
      meta: meta('0.1.0', null), data: { csrfToken: 'csrf_report_claim_fixture_01', expiresAt: '2030-01-02T00:00:00Z' },
    }) })
    if (path.startsWith(`/api/v3/conversations/${ready.conversationId}`) && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { ETag: '"report_claim_conversation_etag_04"' }, body: JSON.stringify({ meta: {
        requestId: 'req_report_claim_0001', traceId: 'trace_report_claim_0001', apiContractVersion: '0.3.0',
        resourceRevision: ready.conversationStateRevision }, data: ready }) })
    if (path.endsWith('/capabilities')) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(capability) })
    if (path === `/api/v14/consultation/anonymous-sessions/${anon}/claim` && method === 'POST') {
      claimed = true
      return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ apiContractVersion: '0.14.0', data: {
        anonymousSessionId: anon, sessionId: target, state: 'AUTHENTICATED', revision: '2', mode: 'CONSULTATION_ONLY',
        grantScope: 'CONSULTATION_V13', oldSessionRevoked: true,
        claimedLegacyResourceCounts: { conversations: 0, messages: 0, drafts: 0, patches: 0, validations: 0, idempotencyRecords: 0 },
        claimedConsultationResourceCounts: { conversations: 1, turns: 2, events: 4, idempotencyRecords: 2 },
      } }) })
    }
    const turns = followupClientId ? [setupTurn, reportTurn, followupTurn()] : [setupTurn, reportTurn]
    if (path === `/api/v13/consultation/conversations/${ready.conversationId}/history`) return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope({ conversationId: ready.conversationId,
        snapshotId: 'snapshot_report_claim_01', offset: 0, limit: 100, totalCount: turns.length, turns, nextCursor: null }) })
    const observedTurn = turns.find(value => path === `/api/v13/consultation/turns/${value.turnId}`)
    if (observedTurn) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope(observedTurn) })
    const projections = followupClientId ? [projection, { ...projection, turnId: followupTurnId, clientMessageId: followupClientId }] : [projection]
    if (path === `/api/v16/consultation/conversations/${ready.conversationId}/history`) return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16({ items: projections, nextCursor: null }) })
    const observedProjection = projections.find(value => path === `/api/v16/consultation/turns/${value.turnId}`)
    if (observedProjection) return route.fulfill({ contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16(observedProjection) })
    if (path === `/api/v19/consultation/conversations/${ready.conversationId}/turns/${setupTurnId}/source-intake-completions` && method === 'POST') {
      api19Calls.push({ key: request.headers()['idempotency-key'], body: request.postData() })
      if (failFirstCompletionReplay) { failFirstCompletionReplay = false; return route.abort('connectionfailed') }
      const sha = 'a'.repeat(64)
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({
        apiContractVersion: '0.19.0', data: { completionCommitId: completion.completionCommitId, committedAt: timestamp,
          sourceIntakeReceipt: { receiptId: completion.receiptId, conversationId: ready.conversationId, turnId: setupTurnId,
            sourceSessionId: anon, sourceOwnerBindingSha256: sha, sourceRequestSha256: sha, sourceAnswerSha256: sha,
            sourceBindingSha256: sha, answersSha256: sha },
          researchWorkIntent: { researchWorkId: workId, sourceIntakeReceiptId: completion.receiptId, state: 'QUEUED' } },
      }) })
    }
    if (path === `/api/v20/consultation/research-works/${workId}`) return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ apiContractVersion: '0.20.0', data: {
        researchWorkId: workId, state: 'COMPLETED', reportText: 'claim 뒤 복구된 실제 연구 보고서',
      } }) })
    if (path === `/api/v16/consultation/documents/report/${workId}/locator` && method === 'GET') return route.fulfill({ contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16(locator) })
    if (path === '/api/v16/consultation/document-references' && method === 'POST') return route.fulfill({ status: 201, contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' }, body: envelope16({ documentRef, ...locator }) })
    if (path === `/api/v16/consultation/conversations/${ready.conversationId}/document-questions` && method === 'POST') {
      followupClientId = request.postDataJSON().clientMessageId
      return route.fulfill({ status: 202, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: envelope16({
        conversationId: ready.conversationId, turnId: followupTurnId, clientMessageId: followupClientId, documentRef, state: 'QUEUED',
      }) })
    }
    return route.abort('blockedbyclient')
  })
  await page.goto('/')
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect.poll(() => api19Calls.length).toBe(1)
  await page.getByRole('button', { name: '같은 요청으로 재개', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: '검증 결과 문서' })).toContainText('claim 뒤 복구된 실제 연구 보고서', { timeout: 10_000 })
  expect(api19Calls).toHaveLength(2)
  expect(api19Calls[1]).toEqual(api19Calls[0])
  await page.reload()
  await expect(page.getByRole('tabpanel', { name: '검증 결과 문서' })).toContainText('claim 뒤 복구된 실제 연구 보고서', { timeout: 10_000 })
  await expect.poll(() => api19Calls.length).toBe(3)
  expect(api19Calls[2]).toEqual(api19Calls[1])
  const composer = page.locator('.g-composer textarea')
  await composer.fill('이 보고서의 다음 근거는?'); await composer.press('Enter')
  await expect(page.locator('.native-research-thread[data-document-id="report"]')).toContainText('후속 보고서 답변')
  const completionReplaysBeforeFollowupReload = api19Calls.length
  await page.reload()
  await expect.poll(() => api19Calls.length).toBe(completionReplaysBeforeFollowupReload + 1)
  expect(api19Calls.at(-1)).toEqual(api19Calls.at(-2))
  await expect(page.getByRole('tabpanel', { name: '검증 결과 문서' })).toContainText('claim 뒤 복구된 실제 연구 보고서', { timeout: 10_000 })
  await expect(page.locator('.native-research-thread[data-document-id="report"]')).toContainText('후속 보고서 답변')
  expect({ api3Posts, followupClientId: Boolean(followupClientId) }).toEqual({ api3Posts: 0, followupClientId: true })
})
