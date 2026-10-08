import { expect, test } from '@playwright/test'
import { ConsultationV13Adapter, ConsultationV13HttpError, ConsultationV13ProtocolError, ConsultationV13TransportError } from '../../src/internal-poc/consultation-v13-adapter'

const origin = 'https://service.example.test'
const headers = (type = 'application/json') => ({ 'Content-Type': type, 'Cache-Control': 'no-store' })
const envelope = (data: unknown) => JSON.stringify({ apiContractVersion: '0.13.0', data })
const usage = { status: 'UNKNOWN', inputTokens: null, outputTokens: null } as const
const turn = {
  turnId: 'turn_synthetic_000001', conversationId: 'conversation_synthetic_01', clientMessageId: 'client_message_synthetic_01',
  state: 'QUEUED', createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z', userText: '질문', answerText: '',
  lastSequence: 0, terminalSequence: null, cancelRequested: false, usage, failureCode: null,
}

test('fixed same-origin JSON routes, CSRF and idempotency are exact with no retry', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    if (String(input).endsWith('/capabilities')) return new Response(envelope({ available: false, reason: 'DISABLED', maxTextChars: 16000, maxPageItems: 100, researchEvents: 'OBSERVATIONS_ONLY', executionAuthority: false }), { status: 200, headers: headers() })
    return new Response(envelope(turn), { status: 202, headers: headers() })
  }
  const adapter = new ConsultationV13Adapter({ fetch, origin, csrfToken: () => 'csrf_synthetic_token' })
  expect((await adapter.capabilities()).data.available).toBe(false)
  await adapter.create({ conversationId: null, clientMessageId: turn.clientMessageId, text: turn.userText }, 'idempotency_key_000001')
  expect(calls).toHaveLength(2)
  expect(calls[0].url).toBe(`${origin}/api/v13/consultation/capabilities`)
  expect(calls[1].init).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'manual', cache: 'no-store' })
  expect(new Headers(calls[1].init?.headers).get('origin')).toBeNull()
  expect(new Headers(calls[1].init?.headers).get('x-csrf-token')).toBe('csrf_synthetic_token')
  expect(new Headers(calls[1].init?.headers).get('idempotency-key')).toBe('idempotency_key_000001')
})

test('split UTF-8 and CRLF SSE frames are decoded incrementally and strictly', async () => {
  const delta = { turnId: turn.turnId, sequence: 1, observedAt: '2026-10-07T00:00:01Z', payload: { type: 'answer_delta', text: '한글 답변' } }
  const terminal = { turnId: turn.turnId, sequence: 2, observedAt: '2026-10-07T00:00:02Z', payload: { type: 'terminal', state: 'COMPLETED', usage, failureCode: null } }
  const bytes = new TextEncoder().encode(`: ping\r\n\r\nevent:consultation\r\nid:1\r\ndata:${JSON.stringify(delta)}\r\n\r\nevent:consultation\nid:2\ndata:${JSON.stringify(terminal)}\n\n`)
  const chunks = [bytes.slice(0, 7), bytes.slice(7, 101), bytes.slice(101, 137), bytes.slice(137)]
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async () => new Response(new ReadableStream({
    pull(controller) { const next = chunks.shift(); if (next) controller.enqueue(next); else controller.close() },
  }), { status: 200, headers: headers('text/event-stream; charset=utf-8') }) })
  const observed = []
  for await (const event of adapter.stream(turn.turnId, 0)) observed.push(event)
  expect(observed.map(value => value.event)).toEqual([delta, terminal])
  expect(observed[0].canonical).toContain('"sequence":1')
})

test('duplicate JSON keys, incomplete SSE and oversized bodies fail closed', async () => {
  const duplicate = '{"apiContractVersion":"0.13.0","apiContractVersion":"0.13.0","data":{}}'
  let response = new Response(duplicate, { status: 200, headers: headers() })
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async () => response })
  await expect(adapter.capabilities()).rejects.toBeInstanceOf(ConsultationV13ProtocolError)

  response = new Response('event:consultation\nid:1\ndata:{}', { status: 200, headers: headers('text/event-stream') })
  await expect((async () => { for await (const unused of adapter.stream(turn.turnId, 0)) void unused })()).rejects.toBeInstanceOf(ConsultationV13ProtocolError)

  response = new Response('x', { status: 200, headers: { ...headers(), 'Content-Length': '262145' } })
  await expect(adapter.capabilities()).rejects.toBeInstanceOf(ConsultationV13ProtocolError)
})

test('closed API errors are validated and redirects are never followed', async () => {
  let calls = 0
  const error = JSON.stringify({ apiContractVersion: '0.13.0', error: { code: 'RATE_LIMITED', message: 'Consultation request failed.' } })
  const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async () => { calls++; return new Response(error, { status: 429, headers: headers() }) } })
  await expect(adapter.create({ conversationId: null, clientMessageId: turn.clientMessageId, text: turn.userText }, 'idempotency_key_000001')).rejects.toMatchObject<Partial<ConsultationV13HttpError>>({ status: 429, code: 'RATE_LIMITED' })
  await expect((async () => { for await (const unused of adapter.stream(turn.turnId, 0)) void unused })()).rejects.toMatchObject<Partial<ConsultationV13HttpError>>({ status: 429, code: 'RATE_LIMITED' })
  expect(calls).toBe(2)
})

test('gateway HTML 429 and 5xx are transport interruptions and their bodies are never adopted', async () => {
  for (const status of [429, 502, 503]) {
    const adapter = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async () => new Response('<html>gateway</html>', {
      status, headers: { 'Content-Type': 'text/html' },
    }) })
    await expect(adapter.turn(turn.turnId)).rejects.toBeInstanceOf(ConsultationV13TransportError)
  }
  const interrupted = new ConsultationV13Adapter({ origin, csrfToken: () => 'csrf', fetch: async () => new Response(new ReadableStream({
    start(stream) { stream.error(new TypeError('network disconnected')) },
  }), { status: 200, headers: headers() }) })
  await expect(interrupted.turn(turn.turnId)).rejects.toBeInstanceOf(TypeError)
})
