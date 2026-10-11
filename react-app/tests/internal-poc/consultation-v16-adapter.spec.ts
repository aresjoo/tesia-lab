import { expect, test } from '@playwright/test'
import {
  ApiV16Error,
  ConsultationV16Adapter,
  type DocumentQuestionTurnProjection,
  type ProducerLocator,
} from '../../src/internal-poc/consultation-v16-adapter'

const origin = 'https://service.example.test'
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const conversationId = 'conversation_source_01'
const documentId = 'draft_document_0001'
const turnId = 'turn_document_000001'
const clientMessageId = 'client_message_000001'
const documentRef = 'docref_document_snapshot_000001'
const locator: ProducerLocator = {
  producerServiceId: 'draft_producer_0001', kind: 'plan', documentId, revision: 7,
  contentSha256: 'a'.repeat(64),
}
const projection: DocumentQuestionTurnProjection = {
  conversationId, turnId, clientMessageId, documentRef,
  producerServiceId: locator.producerServiceId, kind: locator.kind,
  documentId, revision: locator.revision, contentSha256: locator.contentSha256, state: 'QUEUED',
}
const envelope = (data: unknown) => JSON.stringify({ apiContractVersion: '0.16.0', data })

test('generated API16 operations preserve caller bodies, mutation keys and effect-free GETs', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const adapter = new ConsultationV16Adapter({ origin, fetch: async (input, init) => {
    calls.push({ url: String(input), init })
    const url = new URL(String(input))
    if (url.pathname.endsWith('/locator')) return new Response(envelope(locator), { status: 200, headers })
    if (url.pathname.endsWith('/document-references')) {
      return new Response(envelope({ documentRef, ...locator }), { status: 201, headers })
    }
    if (url.pathname.endsWith('/document-questions')) {
      return new Response(envelope({ conversationId, turnId, clientMessageId, documentRef, state: 'QUEUED' }), { status: 202, headers })
    }
    if (url.pathname.endsWith(`/turns/${turnId}`)) return new Response(envelope(projection), { status: 200, headers })
    return new Response(envelope({ items: [projection], nextCursor: null }), { status: 200, headers })
  } })

  await expect(adapter.locator('plan', documentId)).resolves.toEqual(locator)
  await expect(adapter.mint({ apiContractVersion: '0.16.0', locator }, {
    csrfToken: 'csrf_token_current_session', idempotencyKey: 'mint_idempotency_0001',
  })).resolves.toEqual({ documentRef, ...locator })
  await expect(adapter.question(conversationId, {
    apiContractVersion: '0.16.0', clientMessageId, text: '이 계획의 위험을 설명해 주세요.', documentRef,
  }, { csrfToken: 'csrf_token_current_session', idempotencyKey: 'question_idempotency_01' }))
    .resolves.toMatchObject({ conversationId, turnId, clientMessageId, documentRef })
  await expect(adapter.turn(turnId)).resolves.toEqual(projection)
  await expect(adapter.history(conversationId, { limit: 50 })).resolves.toEqual({ items: [projection], nextCursor: null })

  expect(calls.map(call => [new URL(call.url).pathname, call.init?.method])).toEqual([
    [`/api/v16/consultation/documents/plan/${documentId}/locator`, 'GET'],
    ['/api/v16/consultation/document-references', 'POST'],
    [`/api/v16/consultation/conversations/${conversationId}/document-questions`, 'POST'],
    [`/api/v16/consultation/turns/${turnId}`, 'GET'],
    [`/api/v16/consultation/conversations/${conversationId}/history`, 'GET'],
  ])
  for (const call of calls) {
    expect(call.init).toMatchObject({ credentials: 'include', mode: 'same-origin', redirect: 'manual', cache: 'no-store' })
    expect(new Headers(call.init?.headers).get('origin')).toBeNull()
  }
  for (const index of [0, 3, 4]) {
    expect(calls[index]?.init?.body).toBeUndefined()
    expect(new Headers(calls[index]?.init?.headers).get('x-csrf-token')).toBeNull()
    expect(new Headers(calls[index]?.init?.headers).get('idempotency-key')).toBeNull()
  }
  expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ apiContractVersion: '0.16.0', locator })
  expect(new Headers(calls[1]?.init?.headers).get('idempotency-key')).toBe('mint_idempotency_0001')
  expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
    apiContractVersion: '0.16.0', clientMessageId, text: '이 계획의 위험을 설명해 주세요.', documentRef,
  })
  expect(new Headers(calls[2]?.init?.headers).get('idempotency-key')).toBe('question_idempotency_01')
})

test('NFC, locator, reference and recovery echoes fail closed before adoption', async () => {
  let calls = 0
  const responses = [
    envelope({ ...locator, documentId: 'different_document_01' }),
    envelope({ documentRef, ...locator, revision: 8 }),
    envelope({ conversationId, turnId, clientMessageId, documentRef: 'docref_different_snapshot_000001', state: 'QUEUED' }),
    envelope({ ...projection, turnId: 'different_turn_00001' }),
    envelope({ items: [{ ...projection, conversationId: 'different_conversation' }], nextCursor: null }),
  ]
  const statuses = [200, 201, 202, 200, 200]
  const adapter = new ConsultationV16Adapter({ origin, fetch: async () => {
    const index = calls++
    return new Response(responses[index], { status: statuses[index], headers })
  } })
  await expect(adapter.locator('plan', documentId)).rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'INVALID_RESPONSE' })
  await expect(adapter.mint({ apiContractVersion: '0.16.0', locator }, {
    csrfToken: 'csrf_token_current_session', idempotencyKey: 'mint_idempotency_0001',
  })).rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'INVALID_RESPONSE' })
  await expect(adapter.question(conversationId, {
    apiContractVersion: '0.16.0', clientMessageId, text: '정상 질문', documentRef,
  }, { csrfToken: 'csrf_token_current_session', idempotencyKey: 'question_idempotency_01' }))
    .rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'INVALID_RESPONSE' })
  await expect(adapter.turn(turnId)).rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'INVALID_RESPONSE' })
  await expect(adapter.history(conversationId)).rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'INVALID_RESPONSE' })

  const invalid = new ConsultationV16Adapter({ origin, fetch: async () => { throw new Error('must not dispatch') } })
  await expect(invalid.question(conversationId, {
    apiContractVersion: '0.16.0', clientMessageId, text: 'e\u0301', documentRef,
  }, { csrfToken: 'csrf_token_current_session', idempotencyKey: 'question_idempotency_01' }))
    .rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'INVALID_REQUEST' })
})

test('closed server errors and oversized responses are never adopted', async () => {
  let oversized = false
  const adapter = new ConsultationV16Adapter({ origin, fetch: async () => {
    if (oversized) return new Response('x', { status: 200, headers: { ...headers, 'Content-Length': '262145' } })
    return new Response(JSON.stringify({ apiContractVersion: '0.16.0', error: {
      code: 'NOT_FOUND', message: 'Consultation document request failed.',
    } }), { status: 404, headers })
  } })
  await expect(adapter.locator('report', documentId)).rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'NOT_FOUND', status: 404 })
  oversized = true
  await expect(adapter.turn(turnId)).rejects.toMatchObject<Partial<ApiV16Error>>({ code: 'TRANSPORT_FAILED' })
})
