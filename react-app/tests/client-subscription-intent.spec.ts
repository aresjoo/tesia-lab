import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, test } from '@playwright/test'
import { createClientSubscriptionIntentStore, type SubscriptionCycle } from '../src/client-subscription-intent'

const owner = 'intent@example.test'
const key = (value = owner) => `teth-client-subscription-intent:account:${encodeURIComponent(value)}`
function fixture() {
  const data = new Map<string, string>(), reads: string[] = [], writes: [string, string][] = [], removes: string[] = []
  const failure = { get: false, set: false, remove: false }
  const storage = {
    getItem(name: string) { reads.push(name); if (failure.get) throw new Error('read blocked'); return data.get(name) ?? null },
    setItem(name: string, value: string) { writes.push([name, value]); if (failure.set) throw new Error('write blocked'); data.set(name, value) },
    removeItem(name: string) { removes.push(name); if (failure.remove) throw new Error('remove blocked'); data.delete(name) },
  }
  return { data, reads, writes, removes, failure, storage }
}

test('모듈 import는 저장소·타이머·네트워크에 접근하지 않는다', () => {
  const exports: Record<string, unknown> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: forbidden('require'), fetch: forbidden('fetch'), setTimeout: forbidden('timer') }
  Object.defineProperty(context, 'sessionStorage', { get: forbidden('storage') })
  const compiled = ts.transpileModule(readFileSync('src/client-subscription-intent.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 100 })
  expect(touches).toEqual([])
  expect(Object.keys(exports)).toEqual(['createClientSubscriptionIntentStore'])
})

test('최초 빈 선호는 명시 선택 때만 계정 namespace에 허용 두 필드를 저장한다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  expect(store.read('A')).toBeNull()
  expect(f.writes).toEqual([])
  expect(store.choose('A', 'month')).toBe(true)
  expect(store.read('A')).toBe('month')
  expect(store.read('B')).toBeNull()
  expect(f.writes).toEqual([[key(), '{"sessionId":"A","cycle":"month"}']])
  expect(f.reads).toEqual([key()])
})

test('월·연 변경과 A→B는 단일 최신 선호만 유지하며 새 store에서 복원된다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  for (const cycle of ['month', 'year'] as const) {
    expect(store.choose('A', cycle)).toBe(true)
    expect(createClientSubscriptionIntentStore(owner, f.storage).read('A')).toBe(cycle)
  }
  expect(store.choose('B', 'month')).toBe(true)
  expect(store.read('A')).toBeNull()
  const restored = createClientSubscriptionIntentStore(owner, f.storage)
  expect(restored.read('A')).toBeNull()
  expect(restored.read('B')).toBe('month')
  expect(f.data.size).toBe(1)
})

test('owner별 인코딩 namespace는 충돌하거나 다른 계정으로 전이되지 않는다', () => {
  const f = fixture(), owners = ['guest', 'a/b', 'a%2Fb', '한글👩‍💻', 'x'.repeat(320)]
  for (const value of owners) {
    const store = createClientSubscriptionIntentStore(value, f.storage)
    expect(store.read('A')).toBeNull()
    expect(store.choose('A', 'year')).toBe(true)
  }
  expect(f.data.size).toBe(owners.length)
  expect([...f.data.keys()]).toEqual(owners.map(value => key(value)))
  expect(createClientSubscriptionIntentStore('another', f.storage).read('A')).toBeNull()
})

test('guest·손상 owner는 모든 저장소 접근과 메모리 선택을 거절한다', () => {
  for (const value of [null, '', ' ', ' a', 'a ', 'a\n', 'a\u0000b', 'a\u007fb', 'x'.repeat(321), '\ud800', '\udc00', 1, {}]) {
    const f = fixture(), store = createClientSubscriptionIntentStore(value as string | null, f.storage)
    expect(store.choose('A', 'month')).toBe(false)
    expect(store.read('A')).toBeNull()
    expect(store.clear('A')).toBe(false)
    expect([f.reads, f.writes, f.removes]).toEqual([[], [], []])
  }
})

test('session ID는 무음 trim·Unicode 정규화 없이 정확히 결속하고 최대 200자를 허용한다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  const composed = 'é', decomposed = 'e\u0301'
  expect(store.choose(composed, 'year')).toBe(true)
  expect(store.read(decomposed)).toBeNull()
  expect(store.clear(decomposed)).toBe(true)
  expect(store.read(composed)).toBe('year')
  expect(store.choose('s'.repeat(200), 'month')).toBe(true)
  expect(store.read('s'.repeat(200))).toBe('month')
  const before = [...f.data]
  for (const session of ['', ' A', 'A ', '\tA', 'a\u0000', 'a\u007f', 'x'.repeat(201), '\ud800', '\udc00', null, 2]) {
    expect(store.choose(session as string, 'year')).toBe(false)
    expect(store.read(session as string)).toBeNull()
    expect(store.clear(session as string)).toBe(false)
  }
  expect([...f.data]).toEqual(before)
  expect(f.removes).toEqual([])
})

test('month와 year 이외 값은 현재 선택과 저장값을 변경하지 않는다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  store.choose('A', 'month')
  for (const cycle of ['MONTH', 'year ', 'paid', '', null, true, 12, {}, ['year']]) {
    expect(store.choose('B', cycle as SubscriptionCycle)).toBe(false)
  }
  expect(store.read('A')).toBe('month')
  expect(f.writes).toHaveLength(1)
})

test('extra 보안 상태는 역소비하지 않고 다음 저장에서 제거한다', () => {
  const f = fixture()
  f.data.set(key(), JSON.stringify({ sessionId: 'A', cycle: 'year', paid: true, uidLinked: true, card: 'synthetic-unused', owner: 'other', nested: { cycle: 'month' } }))
  const store = createClientSubscriptionIntentStore(owner, f.storage)
  expect(store.read('A')).toBe('year')
  expect(store.choose('B', 'month')).toBe(true)
  expect(JSON.parse(f.data.get(key())!)).toEqual({ sessionId: 'B', cycle: 'month' })
  expect(Object.keys(store).sort()).toEqual(['choose', 'clear', 'read'])
})

test('손상 raw는 보존하고 해당 store의 선택·해제는 메모리만 변경한다', () => {
  const raws = ['{', 'null', '[]', '"month"', '{}', '{"sessionId":"A"}', '{"cycle":"month"}', '{"sessionId":" A","cycle":"month"}', '{"sessionId":"A","cycle":"paid"}', '{"sessionId":"\\ud800","cycle":"year"}']
  for (const raw of raws) {
    const f = fixture(); f.data.set(key(), raw)
    const store = createClientSubscriptionIntentStore(owner, f.storage)
    expect(store.read('A')).toBeNull()
    expect(store.choose('A', 'month')).toBe(false)
    expect(store.read('A')).toBe('month')
    expect(store.choose('A', 'year')).toBe(false)
    expect(store.read('A')).toBe('year')
    expect(store.clear('A')).toBe(false)
    expect(store.read('A')).toBeNull()
    expect(f.data.get(key())).toBe(raw)
    expect([f.writes, f.removes]).toEqual([[], []])
  }
})

test('get 실패는 이후에도 디스크 쓰기·삭제 없이 메모리 선호만 유지한다', () => {
  const f = fixture(); f.data.set(key(), '{"sessionId":"B","cycle":"year"}'); f.failure.get = true
  const store = createClientSubscriptionIntentStore(owner, f.storage)
  f.failure.get = false
  expect(store.choose('A', 'month')).toBe(false)
  expect(store.read('A')).toBe('month')
  expect(store.clear('A')).toBe(false)
  expect(store.read('A')).toBeNull()
  expect(f.data.get(key())).toBe('{"sessionId":"B","cycle":"year"}')
  expect([f.writes, f.removes]).toEqual([[], []])
})

test('set 실패는 이전 bytes와 새 메모리 선택을 보존하며 명시 재선택으로 재시도한다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  store.choose('A', 'month'); f.failure.set = true
  expect(store.choose('A', 'year')).toBe(false)
  expect(store.read('A')).toBe('year')
  expect(createClientSubscriptionIntentStore(owner, f.storage).read('A')).toBe('month')
  f.failure.set = false
  expect(store.choose('A', 'year')).toBe(true)
  expect(createClientSubscriptionIntentStore(owner, f.storage).read('A')).toBe('year')
})

test('clear는 현재 세션만 지우고 다른 세션·빈 선호는 저장소 호출 없이 성공한다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  expect(store.clear('A')).toBe(true)
  store.choose('B', 'year')
  expect(store.clear('A')).toBe(true)
  expect(store.read('B')).toBe('year')
  expect(f.removes).toEqual([])
  expect(store.clear('B')).toBe(true)
  expect(store.read('B')).toBeNull()
  expect(f.data.has(key())).toBe(false)
  expect(store.clear('B')).toBe(true)
  expect(f.removes).toEqual([key()])
})

test('remove 실패에도 현재 메모리는 해제하고 실패를 반환하며 디스크는 보존한다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  store.choose('A', 'year'); f.failure.remove = true
  expect(store.clear('A')).toBe(false)
  expect(store.read('A')).toBeNull()
  expect(createClientSubscriptionIntentStore(owner, f.storage).read('A')).toBe('year')
  expect(f.removes).toEqual([key()])
  expect(store.clear('A')).toBe(false)
  f.failure.remove = false
  expect(store.clear('A')).toBe(true)
  expect(f.data.has(key())).toBe(false)
  expect(createClientSubscriptionIntentStore(owner, f.storage).read('A')).toBeNull()
  expect(f.removes).toEqual([key(), key(), key()])
  expect(store.clear('A')).toBe(true)
  expect(f.removes).toHaveLength(3)
})

test('A 삭제 실패 후 새 B가 있으면 A 삭제 재시도가 B 메모리·디스크를 건드리지 않는다', () => {
  for (const failChoose of [false, true]) {
    const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
    store.choose('A', 'year'); f.failure.remove = true
    expect(store.clear('A')).toBe(false)
    f.failure.remove = false; f.failure.set = failChoose
    expect(store.choose('B', 'month')).toBe(!failChoose)
    const before = [...f.data]
    expect(store.clear('A')).toBe(true)
    expect(store.read('B')).toBe('month')
    expect([...f.data]).toEqual(before)
    expect(f.removes).toHaveLength(1)
  }
})

test('B 저장 후 A 선택 실패·A 해제는 디스크의 B 선호를 삭제하지 않는다', () => {
  const f = fixture(), store = createClientSubscriptionIntentStore(owner, f.storage)
  store.choose('B', 'year'); f.failure.set = true
  expect(store.choose('A', 'month')).toBe(false)
  expect(store.read('A')).toBe('month')
  expect(store.clear('A')).toBe(true)
  expect(store.read('A')).toBeNull()
  expect(f.removes).toEqual([])
  expect(createClientSubscriptionIntentStore(owner, f.storage).read('B')).toBe('year')
})

test('브라우저 저장소가 없는 환경에서도 선택은 메모리에만 남고 예외를 던지지 않는다', () => {
  const store = createClientSubscriptionIntentStore(owner)
  expect(store.choose('A', 'month')).toBe(false)
  expect(store.read('A')).toBe('month')
  expect(store.clear('A')).toBe(false)
  expect(store.read('A')).toBeNull()
})
