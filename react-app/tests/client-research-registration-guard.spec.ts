import { expect, test } from '@playwright/test'
import type { ClientSession } from '../src/client-experience-store'
import { clientResearchRegistration, registeredResearch } from '../src/client-research-registration'
import { createClientUserStrategyStore } from '../src/client-user-strategy-store'

const base: ClientSession = { id: 'registration-guard', title: '기존 연구', idea: '비트코인 과매도 반등', draft: '', pair: 'BTC/USDT', mode: 'dip', phase: 'plan', timeframe: '일봉', risk: '−3%', takeProfit: '+8%', workspace: 'research', turns: [], updatedAt: 1 }

test('등록 조회는 정확한 base 연구와 origin만 사용하고 계획·복구·타 세션을 격리한다', () => {
  const data = new Map<string, string>()
  const store = createClientUserStrategyStore('guard', { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } })
  const record = store.register(base.id, clientResearchRegistration(), 1000)
  const entries = store.getSnapshot().entries
  expect(registeredResearch(base, entries)).toBe(record)
  expect(registeredResearch({ ...base, researchPlanTurnId: 'new-result' }, entries)).toBeUndefined()
  expect(registeredResearch({ ...base, researchPlanRecovery: true }, entries)).toBeUndefined()
  expect(registeredResearch({ ...base, id: 'other' }, entries)).toBeUndefined()
  expect(registeredResearch(base, [{ ...entries[0], record: { ...record, origin: undefined } }])).toBeUndefined()
  expect(store.getSnapshot().entries).toEqual(entries)
})

const cases = [
  { name: '완료된 base', saved: { seconds: 95, status: 'completed' }, allowed: true },
  { name: '캐시 없는 base', saved: null, allowed: false },
  { name: '진행 중 base', saved: { seconds: 3, status: 'playing', clockStartedAt: 1_790_000_000_000 }, allowed: false },
  { name: '초기 상태를 완료로 표시한 손상', saved: { seconds: 0, status: 'completed' }, allowed: false },
  { name: '완료지만 대화로 이탈', saved: { seconds: 95, status: 'completed' }, patch: { workspace: 'conversation' }, allowed: false },
  { name: '완료지만 연구 scope 불일치', saved: { seconds: 95, status: 'completed' }, expected: 'other-scope', allowed: false },
  { name: '새 계획의 고정 예시 완료', saved: { seconds: 95, status: 'completed' }, patch: { researchPlanTurnId: 'new-result' }, allowed: false },
  { name: '복구가 필요한 연구', saved: { seconds: 95, status: 'completed' }, patch: { researchPlanRecovery: true }, allowed: false },
  { name: '읽기 실패한 완료 캐시', saved: { seconds: 95, status: 'completed' }, readFailure: true, allowed: false },
] as const

for (const row of cases) test(`등록 가드: ${row.name}`, async ({ page }) => {
  await page.route('**/research-registration-guard.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }))
  await page.goto('/research-registration-guard.html')
  await page.clock.install({ time: new Date(1_790_000_003_000) })
  const output = await page.evaluate(async ({ row, base }) => {
    const session = { ...base, ...('patch' in row ? row.patch : {}) }
    const scope = 'researchPlanTurnId' in session ? `inline-plan:${JSON.stringify([session.id, session.researchPlanTurnId])}` : session.id
    const key = `teth-research-preview:restored:${scope}`
    if (row.saved) sessionStorage.setItem(key, JSON.stringify({ ...row.saved, view: 'activity', questions: [], clockVersion: 1 }))
    const original = sessionStorage.getItem(key)
    const originalGet = Storage.prototype.getItem
    if ('readFailure' in row) Storage.prototype.getItem = function (requested) {
      if (requested === key) throw new Error('private storage detail must not escape')
      return originalGet.call(this, requested)
    }
    let allowed = false, message = ''
    try {
      const path = '/src/client-research-registration.ts'
      const { requireCompletedResearchRegistration } = await import(/* @vite-ignore */ path)
      requireCompletedResearchRegistration(session, 'expected' in row ? row.expected : scope)
      allowed = true
    } catch (error) { message = error instanceof Error ? error.message : String(error) }
    finally { Storage.prototype.getItem = originalGet }
    return { allowed, message, original, saved: sessionStorage.getItem(key) }
  }, { row, base })
  expect(output.allowed).toBe(row.allowed)
  if (!row.allowed) expect(output.message).toMatch(/연구 결과|계획의 연구 결과/)
  expect(output.message).not.toContain('private storage')
  expect(output.saved).toBe(output.original)
})
