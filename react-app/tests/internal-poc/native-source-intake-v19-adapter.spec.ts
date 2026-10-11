import { expect, test } from '@playwright/test'
import { NativeSourceIntakeV19Adapter, NativeSourceIntakeV19Error } from '../../src/internal-poc/native-source-intake-v19-adapter'

const origin = 'https://service.example.test'
const conversationId = 'conversation_source_intake_01'
const turnId = 'turn_source_intake_000001'
const key = 'source_intake_completion_key_01'
const sha = 'a'.repeat(64)
const answers = [
  { key: 'asset', index: 0, recommended: false },
  { key: 'style', index: 1, recommended: true },
  { key: 'budget', index: 1, recommended: false },
  { key: 'period', index: 1, recommended: true },
  { key: 'stop', index: 1, recommended: true },
] as const
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const completion = {
  apiContractVersion: '0.19.0',
  data: {
    completionCommitId: 'completion_commit_source_01', committedAt: '2026-10-11T00:00:00Z',
    sourceIntakeReceipt: { receiptId: 'source_intake_receipt_01', conversationId, turnId,
      sourceSessionId: 'session_source_intake_01', sourceOwnerBindingSha256: sha, sourceRequestSha256: sha,
      sourceAnswerSha256: sha, sourceBindingSha256: sha, answersSha256: sha },
    researchWorkIntent: { researchWorkId: 'research_work_source_01', sourceIntakeReceiptId: 'source_intake_receipt_01', state: 'QUEUED' },
  },
}

test('API19 adapter sends the closed five answers once and accepts only the bound QUEUED receipt', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const adapter = new NativeSourceIntakeV19Adapter({ origin, csrfToken: () => 'csrf_source_intake_01', fetch: async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify(completion), { status: 202, headers })
  } })
  const result = await adapter.complete(conversationId, turnId, answers, key)
  expect(result).toEqual(completion.data)
  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toBe(`${origin}/api/v19/consultation/conversations/${conversationId}/turns/${turnId}/source-intake-completions`)
  expect(calls[0]?.init).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'manual', cache: 'no-store' })
  expect(new Headers(calls[0]?.init?.headers)).toMatchObject(expect.objectContaining({}))
  expect(new Headers(calls[0]?.init?.headers).get('x-csrf-token')).toBe('csrf_source_intake_01')
  expect(new Headers(calls[0]?.init?.headers).get('idempotency-key')).toBe(key)
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ apiContractVersion: '0.19.0', answers })
  expect(result.researchWorkIntent.state).toBe('QUEUED')
  expect(Object.isFrozen(result)).toBe(true)
})

test('API19 adapter rejects malformed binding and exact contract errors without accepting research completion', async () => {
  const malformed = structuredClone(completion)
  malformed.data.sourceIntakeReceipt.turnId = 'turn_source_intake_foreign_01'
  const invalid = new NativeSourceIntakeV19Adapter({ origin, csrfToken: () => 'csrf_source_intake_01', fetch: async () => new Response(JSON.stringify(malformed), { status: 202, headers }) })
  await expect(invalid.complete(conversationId, turnId, answers, key)).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' })

  const refused = new NativeSourceIntakeV19Adapter({ origin, csrfToken: () => 'csrf_source_intake_01', fetch: async () => new Response(JSON.stringify({
    apiContractVersion: '0.19.0', error: { code: 'SOURCE_INTAKE_INVALID', message: 'Source intake invalid.' },
  }), { status: 409, headers }) })
  await expect(refused.complete(conversationId, turnId, answers, key)).rejects.toEqual(expect.objectContaining<Partial<NativeSourceIntakeV19Error>>({ code: 'SOURCE_INTAKE_INVALID', status: 409 }))
})
