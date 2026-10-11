import { expect, test } from '@playwright/test'
import { ConsultationV13Adapter } from '../../src/internal-poc/consultation-v13-adapter'
import { ConsultationV16Adapter } from '../../src/internal-poc/consultation-v16-adapter'
import { NativeConsultationV13Controller } from '../../src/internal-poc/native-consultation-v13-controller'

const origin = 'https://service.example.test'
const conversationId = 'conversation_claimed_admission_01'
const turnId = 'turn_claimed_admission_000001'
const clientMessageId = 'client_claimed_admission_000001'
const anonymousOwner = JSON.stringify(['session_claimed_source_01', 'ANONYMOUS'])
const authenticatedOwner = JSON.stringify(['session_claimed_target_01', 'AUTHENTICATED'])
const sourceKey = `tesia.native.consultation-v16.document-question:${encodeURIComponent(anonymousOwner)}`
const targetKey = `tesia.native.consultation-v16.document-question:${encodeURIComponent(authenticatedOwner)}`
const question = '로그인 직전 보고서 질문'
const timestamp = '2026-10-12T00:00:00Z'
const documentRef = 'docref_claimed_admission_000001'
const locator = { producerServiceId: 'research_service_claimed_01', kind: 'report' as const,
  documentId: 'research_work_claimed_admission_01', revision: 7, contentSha256: 'a'.repeat(64) }
const researchThread = { scopeId: locator.documentId, documentId: 'report' }
const usage = { status: 'UNKNOWN', inputTokens: null, outputTokens: null }
const turn = { turnId, conversationId, clientMessageId, userText: question, answerText: '서버에 저장된 답변',
  state: 'COMPLETED', createdAt: timestamp, updatedAt: timestamp, lastSequence: 2, terminalSequence: 2,
  cancelRequested: false, usage, failureCode: null }
const projection = { conversationId, turnId, clientMessageId, documentRef, ...locator, state: 'COMPLETED' }
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const response = (version: string, data: unknown) => new Response(JSON.stringify({ apiContractVersion: version, data }), { headers })

function fixture(documentTurn = projection) {
  const values = new Map<string, string>()
  const sourceJournal = JSON.stringify({ version: 2, stage: 'admitted', attempted: true, disposition: 'uncertain',
    owner: anonymousOwner, conversationId, clientMessageId, text: null, researchThread,
    mintIdempotencyKey: 'mint_claimed_admission_000001', questionIdempotencyKey: 'question_claimed_admission_000001',
    mintRequest: { apiContractVersion: '0.16.0', locator },
    questionRequest: { apiContractVersion: '0.16.0', clientMessageId, text: question, documentRef },
    turnId, joined: false, bindings: [] })
  values.set(sourceKey, sourceJournal)
  const calls: string[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname, method = init?.method ?? 'GET'
    calls.push(`${method} ${path}`)
    if (path === `/api/v13/consultation/conversations/${conversationId}/history`) return response('0.13.0', {
      conversationId, snapshotId: 'snapshot_claimed_admission_01', offset: 0, limit: 100,
      totalCount: 1, turns: [turn], nextCursor: null,
    })
    if (path === `/api/v13/consultation/turns/${turnId}`) return response('0.13.0', turn)
    if (path === `/api/v16/consultation/conversations/${conversationId}/history`) {
      return response('0.16.0', { items: [documentTurn], nextCursor: null })
    }
    if (path === `/api/v16/consultation/turns/${turnId}`) return response('0.16.0', documentTurn)
    throw new Error(`unexpected fixture route ${method} ${path}`)
  }
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
  const controller = new NativeConsultationV13Controller(
    new ConsultationV13Adapter({ origin, fetch, csrfToken: () => 'csrf_claimed_admission_01' }),
    { storage, documentAdapter: new ConsultationV16Adapter({ origin, fetch }) },
  )
  return { calls, controller, sourceJournal, values }
}

test('fresh AUTH GET authority recovers a first admitted unjoined document question without rewriting its source journal', async () => {
  const { calls, controller, sourceJournal, values } = fixture()
  controller.bindOwner(authenticatedOwner)
  expect(await controller.restoreConversation(conversationId)).toBe(true)
  expect(values.get(targetKey)).toBeUndefined()

  expect(await controller.restoreClaimedDocumentAnchors(anonymousOwner, conversationId)).toBe(true)
  expect(values.get(sourceKey)).toBe(sourceJournal)
  const target = JSON.parse(values.get(targetKey)!)
  expect(target).toMatchObject({ version: 2, stage: 'settled', owner: authenticatedOwner, conversationId })
  expect(target.bindings).toEqual([{ conversationId, turnId, clientMessageId,
    textSha256: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(question)).then(value =>
      [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('')),
    createdAt: timestamp, lastSequence: 2, documentRef, locator, researchThread }])
  expect(controller.getSnapshot().messages).toMatchObject([
    { id: clientMessageId, role: 'user', researchThread },
    { id: `${turnId}_reply`, role: 'assistant', researchThread },
  ])
  expect(calls.every(call => call.startsWith('GET '))).toBe(true)
  controller.detach()
})

test('claimed admission keeps the source journal and refuses a mismatched document authority', async () => {
  const { calls, controller, sourceJournal, values } = fixture({ ...projection, documentRef: 'docref_forged_admission_000001' })
  controller.bindOwner(authenticatedOwner)
  expect(await controller.restoreConversation(conversationId)).toBe(true)

  expect(await controller.restoreClaimedDocumentAnchors(anonymousOwner, conversationId)).toBe(false)
  expect(values.get(sourceKey)).toBe(sourceJournal)
  expect(values.get(targetKey)).toBeUndefined()
  expect(calls.every(call => call.startsWith('GET '))).toBe(true)
  controller.detach()
})
