import { expect, test } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeJob } from '../../src/internal-poc/native-service-api'
import { describeJobObservations, MAX_JOB_OBSERVATIONS, observeNativeJob } from '../../src/internal-poc/native-job-observations'

const cases = fixtures.sources[3].fixture.cases!
const job = (state: NativeJob['state']) => structuredClone(cases.find(item => item.name === state)!.response.data) as NativeJob

test('수신한 상태만 기록하며 생략된 단계·소요 시간·완료 판정을 만들지 않는다', () => {
  const first = observeNativeJob(null, job('QUEUED'))
  const next = observeNativeJob(first, job('REPLAYING'))
  expect(next.entries.map(entry => entry.state)).toEqual(['QUEUED', 'REPLAYING'])
  expect(next.entries[1].updatedAt).toBe(job('REPLAYING').updatedAt)
  expect(describeJobObservations(next)).toContain('전략 재생 중')
  expect(describeJobObservations(next)).not.toMatch(/준비 중|입력 검증|소요|초 만에|완료/)
  expect(first.entries).toHaveLength(1)
})

test('동일 snapshot은 객체까지 재사용하고 같은 상태의 새 revision은 행을 늘리지 않는다', () => {
  const value = job('REPLAYING'), first = observeNativeJob(null, value)
  expect(observeNativeJob(first, structuredClone(value))).toBe(first)
  const repeated = observeNativeJob(first, { ...value, revision: '100', updatedAt: '2026-09-10T00:03:00Z' })
  expect(repeated).toBe(first)
  expect(repeated.entries).toBe(first.entries)
  expect(repeated.entries[0].updatedAt).toBe(value.updatedAt)
  expect(describeJobObservations(repeated)).toBeUndefined()
})

for (const field of ['backtestId', 'strategyVersionId', 'semanticHash', 'profileId', 'profileContentHash', 'splitGroupId', 'createdAt'] as const) test(`${field} 교체는 다른 작업의 기록을 섞지 않는다`, () => {
  const first = observeNativeJob(observeNativeJob(null, job('QUEUED')), job('REPLAYING'))
  const value = job('REPLAYING')
  const replacement = { ...value, [field]: field === 'createdAt' ? '2026-09-09T00:00:00Z' : `${value[field]}-different` } as NativeJob
  const next = observeNativeJob(first, replacement)
  expect(next.entries).toHaveLength(1)
  expect(next.truncated).toBe(false)
  expect(describeJobObservations(next)).toBeUndefined()
})

test('메모리는 최근32개로 제한하고 상태 재등장과 실제 수신 순서를 유지한다', () => {
  let observed = observeNativeJob(null, job('QUEUED'))
  for (let index = 1; index <= 200; index++) {
    observed = observeNativeJob(observed, { ...job(index % 2 ? 'REPLAYING' : 'VALIDATING'), revision: String(index + 1) })
  }
  expect(observed.entries).toHaveLength(MAX_JOB_OBSERVATIONS)
  expect(observed.entries[0].revision).toBe('170')
  expect(observed.entries.at(-1)?.revision).toBe('201')
  expect(observed.truncated).toBe(true)
  expect(describeJobObservations(observed)).toContain('최근 32개 진행 상태')
})

test('최초 완료 응답에는 과거 성공 단계가 없으며 무효 사유는 실제 반환값만 남긴다', () => {
  expect(describeJobObservations(observeNativeJob(null, job('COMPLETED')))).toBeUndefined()
  const invalid = job('INVALID') as Extract<NativeJob, { state: 'INVALID' }>
  const first = observeNativeJob(null, invalid)
  const next = observeNativeJob(first, { ...invalid, invalidReason: invalid.invalidReason === 'DATA_CONTRACT_INVALID' ? 'STRATEGY_CONTRACT_INVALID' : 'DATA_CONTRACT_INVALID', revision: '9' })
  expect(next.entries).toHaveLength(2)
  expect(next.entries.every(entry => entry.state === 'INVALID')).toBe(true)
  expect(next.entries[0].state === 'INVALID' && next.entries[0].invalidReason).not.toBe(next.entries[1].state === 'INVALID' && next.entries[1].invalidReason)
})

test('관측에는 문구 대신 원상태와 무효 코드를 보존하며 언어 변경은 수신 이력을 바꾸지 않는다', () => {
  const value = job('INVALID')
  const observed = observeNativeJob(observeNativeJob(null, job('QUEUED')), value)
  const before = JSON.stringify(observed)
  for (const language of ['en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'ko'] as const) {
    const summary = describeJobObservations(observed, language)!
    expect(summary.split('\n')).toHaveLength(4)
    expect(summary).toContain(value.updatedAt.replace('T', ' ').replace('Z', ''))
    expect(summary).toContain('UTC')
    if (language !== 'ko') expect(summary).not.toMatch(/백테스트|확인된|무효/)
    expect(JSON.stringify(observed)).toBe(before)
    expect(observeNativeJob(observed, { ...value, revision: '99' })).toBe(observed)
  }
  expect(before).not.toMatch(/label|백테스트|reason"/)
  expect(observed.entries[1]).toMatchObject({ state: 'INVALID', invalidReason: value.state === 'INVALID' ? value.invalidReason : null })
})

test('정확히32개에는 생략 안내가 없고33번째부터 가장 오래된 한 행만 비운다', () => {
  let observed = observeNativeJob(null, job('QUEUED'))
  for (let index = 1; index < MAX_JOB_OBSERVATIONS; index++) observed = observeNativeJob(observed,
    { ...job(index % 2 ? 'REPLAYING' : 'VALIDATING'), revision: String(index + 1) })
  expect(observed.entries).toHaveLength(32)
  expect(observed.truncated).toBe(false)
  expect(observed.entries[0].state).toBe('QUEUED')
  const next = observeNativeJob(observed, { ...job('VERIFYING'), revision: '33' })
  expect(next.entries).toHaveLength(32)
  expect(next.truncated).toBe(true)
  expect(next.entries[0]).toBe(observed.entries[1])
})
