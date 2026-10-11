import { expect, test } from '@playwright/test'
import { ApiV20Error, NativeResearchWorkV20Adapter } from '../../src/internal-poc/native-research-work-v20-adapter'

const origin = 'https://service.example.test'
const researchWorkId = 'research_work_source_01'
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }

test('API20 adapter observes the exact work with a credentialed effect-free GET', async () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const adapter = new NativeResearchWorkV20Adapter({ origin, fetch: async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify({ apiContractVersion: '0.20.0', data: {
      researchWorkId, state: 'COMPLETED', reportText: '검증된 연구 보고서',
    } }), { status: 200, headers })
  } })

  await expect(adapter.read(researchWorkId)).resolves.toEqual({ researchWorkId, state: 'COMPLETED', reportText: '검증된 연구 보고서' })
  expect(calls).toHaveLength(1)
  expect(calls[0]).toMatchObject({ url: `${origin}/api/v20/consultation/research-works/${researchWorkId}`,
    init: { method: 'GET', credentials: 'include', redirect: 'manual', cache: 'no-store' } })
  expect(new Headers(calls[0]?.init?.headers).get('accept')).toBe('application/json')
})

test('API20 adapter rejects a foreign id before dispatch and never accepts an unauthorized projection', async () => {
  let calls = 0
  const adapter = new NativeResearchWorkV20Adapter({ origin, fetch: async () => {
    calls++
    return new Response(JSON.stringify({ apiContractVersion: '0.20.0', error: { code: 'FORBIDDEN', message: 'Forbidden.' } }),
      { status: 403, headers })
  } })

  await expect(adapter.read('../foreign')).rejects.toEqual(expect.objectContaining<Partial<ApiV20Error>>({ code: 'INVALID_REQUEST' }))
  expect(calls).toBe(0)
  await expect(adapter.read(researchWorkId)).rejects.toEqual(expect.objectContaining<Partial<ApiV20Error>>({ code: 'FORBIDDEN', status: 403 }))
  expect(calls).toBe(1)
})
