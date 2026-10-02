import { expect, test } from '@playwright/test'
import { startNativeJobPolling } from '../../src/internal-poc/native-job-polling'
import { ApiV07Error } from '../../src/internal-poc/contracts/generated/api-v0.7/client'
import type { NativeJob } from '../../src/internal-poc/native-service-api'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }

const job = (state = 'REPLAYING') => structuredClone(fixtures.sources[3].fixture.cases!.find(item => item.name === state)!.response.data) as NativeJob
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
function harness(read: () => Promise<NativeJob>, random = () => 0, initiallyHidden = false) {
  let next = 0
  const timers = new Map<number, { callback: () => void; delay: number }>()
  const values: NativeJob[] = [], failures: boolean[] = []
  const state = { current: true, hidden: initiallyHidden }
  const listeners = new Set<() => void>()
  const control = startNativeJobPolling({ read, isCurrent: () => state.current, accept: value => { values.push(value) },
    onFailure: retrying => { failures.push(retrying) }, random,
    visibility: { hidden: () => state.hidden, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } } },
    clock: { set: (callback, delay) => { const id = ++next; timers.set(id, { callback, delay }); return id }, clear: id => { timers.delete(id) } } })
  return { ...control, state, timers, values, failures, listeners,
    visibility: async (hidden: boolean) => { state.hidden = hidden; listeners.forEach(listener => listener()); await flush() },
    delay: () => { expect(timers.size).toBe(1); return [...timers.values()][0].delay },
    tick: async () => { expect(timers.size).toBe(1); const [id, timer] = [...timers][0]; timers.delete(id); timer.callback(); await flush() },
  }
}

test('일시 오류만 지수 간격으로 단일 타이머를 예약하고 성공 뒤 기본 간격으로 돌아간다', async () => {
  let reads = 0
  const h = harness(async () => { if (++reads <= 2) throw new ApiV07Error(reads === 1 ? 'TRANSPORT_FAILED' : 'INTERNAL_ERROR'); return job() })
  expect(h.delay()).toBe(1500)
  await h.tick(); expect(h.delay()).toBe(3000)
  await h.tick(); expect(h.delay()).toBe(6000)
  await h.tick(); expect(h.delay()).toBe(1500)
  expect(h.failures).toEqual([true, true]); expect(h.values).toEqual([job()]); expect(reads).toBe(3)
  h.stop(); expect(h.timers.size).toBe(0)
})

test('재시도 지연에 지터를 더하되 반복 실패에도 30초 상한과 단일 예약을 유지한다', async () => {
  const h = harness(async () => { throw new ApiV07Error('TRANSPORT_FAILED') }, () => 1)
  for (const delay of [3500, 6500, 12500, 24500, 29500, 29500, 29500]) { await h.tick(); expect(h.delay()).toBe(delay) }
  expect(h.values).toEqual([]); h.stop()
})

for (const code of ['AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_RESPONSE', 'BINDING_CONFLICT', 'SOURCE_VERIFICATION_FAILED', 'NOT_READY']) {
  test(`${code}는 자동 재조회하지 않고 서버 상태를 합성하지 않는다`, async () => {
    const h = harness(async () => { throw new ApiV07Error(code) })
    await h.tick(); expect(h.timers.size).toBe(0); expect(h.failures).toEqual([false]); expect(h.values).toEqual([])
  })
}

test('일반 결속 오류도 네트워크 오류로 추측하지 않는다', async () => {
  const h = harness(async () => { throw new Error('BINDING_CONFLICT') })
  await h.tick(); expect(h.failures).toEqual([false]); expect(h.timers.size).toBe(0)
})

test('자동 조회 대기 중 수동 조회는 같은 진행 중 Promise만 공유한다', async () => {
  let resolve!: (value: NativeJob) => void, reads = 0
  const h = harness(() => { reads++; return new Promise(accept => { resolve = accept }) })
  await h.tick(); expect(h.timers.size).toBe(0)
  const a = h.refresh(), b = h.refresh(); expect(a).toBe(b)
  await flush(); expect(reads).toBe(1)
  resolve(job()); await a
  expect(h.delay()).toBe(1500); expect(h.values).toHaveLength(1); h.stop()
})

test('수동 조회는 예약된 긴 재시도를 소비하고 실패 시 기본 재시도 간격부터 다시 시작한다', async () => {
  let reads = 0
  const h = harness(async () => { reads++; throw new ApiV07Error('TRANSPORT_FAILED') })
  await h.tick(); await h.tick(); expect(h.delay()).toBe(6000)
  await h.refresh(); expect(reads).toBe(3); expect(h.delay()).toBe(3000); h.stop()
})

for (const outcome of ['success', 'failure'] as const) test(`종료 후 늦은 ${outcome}는 상태·오류·타이머를 되살리지 않는다`, async () => {
  let resolve!: (value: NativeJob) => void, reject!: (reason: unknown) => void
  const h = harness(() => new Promise((accept, fail) => { resolve = accept; reject = fail }))
  await h.tick(); h.stop()
  if (outcome === 'success') resolve(job()); else reject(new ApiV07Error('TRANSPORT_FAILED'))
  await flush(); expect(h.timers.size).toBe(0); expect(h.values).toEqual([]); expect(h.failures).toEqual([])
})

test('현재 소유자가 바뀌면 예약·늦은 응답 모두 화면을 갱신하지 않는다', async () => {
  let reads = 0
  const h = harness(async () => { reads++; return job() })
  h.state.current = false; await h.tick()
  expect(reads).toBe(0); expect(h.timers.size).toBe(0); expect(h.values).toEqual([])
})

for (const state of ['COMPLETED', 'INVALID', 'FAILED']) test(`${state} 종단 관측 후 자동 조회는 끝난다`, async () => {
  const h = harness(async () => job(state)); await h.tick()
  expect(h.values).toEqual([job(state)]); expect(h.timers.size).toBe(0)
})

test('숨겨진 탭은 30초 조회를 유지하고 복귀 시 한 번만 최신 상태를 조회한다', async () => {
  let reads = 0
  const h = harness(async () => { reads++; return job() }, () => 0, true)
  expect(h.delay()).toBe(30_000)
  await h.tick(); expect(reads).toBe(1); expect(h.delay()).toBe(30_000)
  await h.visibility(false); expect(reads).toBe(2); expect(h.delay()).toBe(1500)
  await h.visibility(false); expect(reads).toBe(2)
  await h.visibility(true); expect(h.delay()).toBe(30_000)
  h.stop(); expect(h.listeners.size).toBe(0); expect(h.timers.size).toBe(0)
  await h.visibility(false); expect(reads).toBe(2)
})

test('조회 중 탭 변경은 중복 요청 없이 완료 시점의 가시성을 적용한다', async () => {
  let resolve!: (value: NativeJob) => void, reads = 0
  const h = harness(() => { reads++; return new Promise(accept => { resolve = accept }) })
  await h.tick()
  await h.visibility(true); await h.visibility(false); await h.visibility(true)
  expect(reads).toBe(1); expect(h.timers.size).toBe(0)
  resolve(job()); await flush(); expect(h.delay()).toBe(30_000)
  await h.visibility(false); expect(reads).toBe(2)
  h.stop(); resolve(job()); await flush(); expect(h.values).toHaveLength(1)
})

test('오류 backoff는 탭 왕복으로 초기화되거나 즉시 재시도되지 않는다', async () => {
  let reads = 0
  const h = harness(async () => { reads++; throw new ApiV07Error('TRANSPORT_FAILED') })
  await h.tick(); expect(h.delay()).toBe(3000)
  await h.visibility(true); expect(h.delay()).toBe(30_000)
  await h.visibility(false); expect(reads).toBe(1); expect(h.delay()).toBe(30_000)
  await h.tick(); expect(h.delay()).toBe(6000)
  h.stop()
})

for (const code of ['AUTHENTICATION_REQUIRED', 'FORBIDDEN', 'INVALID_RESPONSE', 'BINDING_CONFLICT']) test(`${code} 뒤 탭 왕복은 명시 복구 경계를 넘지 않는다`, async () => {
  let reads = 0
  const h = harness(async () => { reads++; throw new ApiV07Error(code) })
  await h.tick()
  await h.visibility(true); await h.visibility(false)
  expect(reads).toBe(1); expect(h.timers.size).toBe(0)
  await h.refresh(); expect(reads).toBe(2); expect(h.failures).toEqual([false, false])
  h.stop()
})

for (const state of ['COMPLETED', 'FAILED', 'INVALID']) test(`${state} 이후 탭 복귀로 자동 조회를 되살리지 않는다`, async () => {
  let reads = 0
  const h = harness(async () => { reads++; return job(state) }, () => 0, true)
  await h.tick(); await h.visibility(false); await h.visibility(true)
  expect(reads).toBe(1); expect(h.timers.size).toBe(0); h.stop()
})

test('소유자 변경 뒤 visibility 이벤트는 조회를 보내지 않는다', async () => {
  let reads = 0
  const h = harness(async () => { reads++; return job() }, () => 0, true)
  h.state.current = false
  await h.visibility(false); await h.tick()
  expect(reads).toBe(0); expect(h.values).toEqual([]); h.stop()
})
