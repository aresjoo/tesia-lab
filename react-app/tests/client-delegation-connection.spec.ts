import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, test } from '@playwright/test'
import { canResumeDelegationConnection, createDelegationConnectionLocator } from '../src/client-delegation-connection'
import { delegationBudgets, type DelegationUiSnapshot } from '../src/client-delegation-fixtures'
import { delegationParameters, delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

const key = (owner: string | null) => `teth-client-delegation-location:${owner === null ? 'guest' : `account:${encodeURIComponent(owner)}`}`
function snapshot(): DelegationUiSnapshot {
  return { page: 'report', questionIndex: 5, workStep: 5, attempt: 1, expert: false, chartInterval: '1D',
    answers: {
      asset: { index: 0, label: '비트코인', recommended: true },
      style: { index: 1, label: '중립적으로', recommended: true },
      budget: { index: 1, label: '500만원', recommended: true },
      period: { index: 1, label: '최근 2년', recommended: true },
      stop: { index: 1, label: '-5%까지', recommended: true },
    }, parameters: delegationRecommendedParameters(),
  }
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen)
    Object.freeze(value)
  }
  return value
}
function storageFixture() {
  const data = new Map<string, string>(), reads: string[] = [], writes: [string, string][] = []
  const failure = { get: false, set: false }
  const storage = {
    getItem(name: string) { reads.push(name); if (failure.get) throw new Error('fixture get denied'); return data.get(name) ?? null },
    setItem(name: string, value: string) { writes.push([name, value]); if (failure.set) throw new Error('fixture set denied'); data.set(name, value) },
  }
  return { data, reads, writes, failure, storage }
}

test('모듈 선언만으로 브라우저 저장소·타이머·네트워크를 사용하지 않는다', () => {
  const exports: Record<string, unknown> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: () => ({}), fetch: forbidden('fetch'), setTimeout: forbidden('timeout'), setInterval: forbidden('interval') }
  Object.defineProperty(context, 'sessionStorage', { get: forbidden('storage') })
  const compiled = ts.transpileModule(readFileSync('src/client-delegation-connection.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 100 })
  expect(touches).toEqual([])
  expect(Object.keys(exports).sort()).toEqual(['canResumeDelegationConnection', 'createDelegationConnectionLocator'])
})

test('현재 실제 source 점수 80은 재개 가능하고 기본 52점은 저장 메타데이터로 승격하지 않는다', () => {
  const input = snapshot(), low = delegationParameters(input.answers)
  expect(evaluateDelegation(input.parameters!, delegationBudgets[1]).score).toBe(80)
  expect(evaluateDelegation(low, delegationBudgets[1]).score).toBe(52)
  expect(canResumeDelegationConnection(input)).toBe(true)
  expect(canResumeDelegationConnection({ ...input, parameters: low, ...{ score: 100, passed: true, connected: true } })).toBe(false)
})

test('질문 5개와 완료 workStep 5가 모두 있어야 하며 복구 차단을 우회하지 않는다', () => {
  expect(canResumeDelegationConnection(undefined)).toBe(false)
  for (const value of [-1, 0, 1, 4, 6, 5.5, NaN, Infinity]) {
    expect(canResumeDelegationConnection({ ...snapshot(), questionIndex: value })).toBe(false)
    expect(canResumeDelegationConnection({ ...snapshot(), workStep: value })).toBe(false)
  }
  expect(canResumeDelegationConnection({ ...snapshot(), recoveryRequired: true })).toBe(false)
})

test('완료된 pending 파라미터를 우선 평가하고 미완료·잘못된 추천을 이전 성공으로 대체하지 않는다', () => {
  const input = snapshot(), low = delegationParameters(input.answers)
  expect(canResumeDelegationConnection({ ...input, parameters: low, pendingParameters: delegationRecommendedParameters() })).toBe(true)
  expect(canResumeDelegationConnection({ ...input, pendingParameters: low })).toBe(false)
  expect(canResumeDelegationConnection({ ...input, parameters: undefined, pendingParameters: delegationRecommendedParameters() })).toBe(true)
  expect(canResumeDelegationConnection({ ...input, parameters: undefined })).toBe(false)
  expect(canResumeDelegationConnection({ ...input, workStep: 4, parameters: low, pendingParameters: delegationRecommendedParameters() })).toBe(false)
  expect(canResumeDelegationConnection({ ...input, pendingParameters: { ...input.parameters!, endI: 999999 } })).toBe(false)
})

test('유효 예산 선택만 소비하고 누락·범위 밖·비정수 예산은 거부한다', () => {
  const input = snapshot()
  for (let index = 0; index < delegationBudgets.length; index++) {
    expect(canResumeDelegationConnection({ ...input, answers: { ...input.answers, budget: { index, label: '표시문구는 권위 아님', recommended: false } } })).toBe(true)
  }
  expect(canResumeDelegationConnection({ ...input, answers: { ...input.answers, budget: undefined } })).toBe(false)
  for (const index of [-1, 4, 999, .5, NaN, Infinity]) {
    expect(canResumeDelegationConnection({ ...input, answers: { ...input.answers, budget: { index, label: '500만원', recommended: true } } })).toBe(false)
  }
})

test('엔진 평가 예외는 재개 불가이며 깊게 동결한 snapshot을 변경하지 않는다', () => {
  const input = frozen(snapshot()), before = JSON.stringify(input)
  expect(canResumeDelegationConnection(input)).toBe(true)
  expect(JSON.stringify(input)).toBe(before)
  for (const parameters of [{ ...input.parameters!, endI: 999999 }, { ...input.parameters!, startI: 100, endI: 61 }]) {
    expect(canResumeDelegationConnection(frozen({ ...input, parameters }))).toBe(false)
  }
})

test('locator 생성·read는 저장을 만들지 않으며 최초 명시 remember만 직렬화한다', () => {
  const fixture = storageFixture(), locator = createDelegationConnectionLocator('owner-a', fixture.storage)
  expect(locator.read()).toBeNull()
  expect(locator.read()).toBeNull()
  expect(fixture.reads).toEqual([key('owner-a')])
  expect(fixture.writes).toEqual([])
  expect(locator.remember('conversation-1')).toBe(true)
  expect(fixture.writes).toEqual([[key('owner-a'), '{"sessionId":"conversation-1"}']])
  expect(locator.read()).toBe('conversation-1')
})

test('계정별·guest별 locator와 인코딩된 owner 키가 서로 섞이지 않는다', () => {
  const fixture = storageFixture(), owners = [null, 'guest', 'owner/a', 'owner%2Fa', '한글@example.test']
  owners.forEach((owner, index) => expect(createDelegationConnectionLocator(owner, fixture.storage).remember(`session-${index}`)).toBe(true))
  expect(new Set(fixture.data.keys()).size).toBe(owners.length)
  owners.forEach((owner, index) => expect(createDelegationConnectionLocator(owner, fixture.storage).read()).toBe(`session-${index}`))
  expect(createDelegationConnectionLocator('unknown-owner', fixture.storage).read()).toBeNull()
})

test('손상 JSON·틀린 모양·부적합 ID는 복원하지 않고 원 저장 bytes는 보존한다', () => {
  for (const raw of ['{', '', 'null', 'true', '1', '"session-1"', '[]', '{}', '{"sessionId":null}', '{"sessionId":123}', '{"sessionId":""}', '{"sessionId":"  "}', '{"sessionId":" padded"}', JSON.stringify({ sessionId: 'x'.repeat(201) })]) {
    const fixture = storageFixture(); fixture.data.set(key(null), raw)
    expect(createDelegationConnectionLocator(null, fixture.storage).read(), raw).toBeNull()
    expect(fixture.data.get(key(null))).toBe(raw)
    expect(fixture.writes).toEqual([])
  }
})

test('부적합 remember는 최신 메모리와 저장값을 변경하지 않고 길이 200 경계는 보존한다', () => {
  const fixture = storageFixture(), locator = createDelegationConnectionLocator(null, fixture.storage)
  expect(locator.remember('latest-valid')).toBe(true)
  for (const id of ['', ' ', ' leading', 'trailing ', '\ninvalid', 'x'.repeat(201)]) {
    expect(locator.remember(id)).toBe(false)
    expect(locator.read()).toBe('latest-valid')
    expect(fixture.data.get(key(null))).toBe('{"sessionId":"latest-valid"}')
  }
  expect(fixture.writes).toHaveLength(1)
  expect(locator.remember('x'.repeat(200))).toBe(true)
  expect(createDelegationConnectionLocator(null, fixture.storage).read()).toBe('x'.repeat(200))
})

test('GET 예외는 권위를 만들지 않고 이후 명시 remember는 정상 복구할 수 있다', () => {
  const fixture = storageFixture(); fixture.failure.get = true
  const locator = createDelegationConnectionLocator('a', fixture.storage)
  expect(locator.read()).toBeNull()
  expect(fixture.writes).toEqual([])
  expect(locator.remember('new-location')).toBe(true)
  expect(locator.read()).toBe('new-location')
  fixture.failure.get = false
  expect(createDelegationConnectionLocator('a', fixture.storage).read()).toBe('new-location')
})

test('SET 실패시 같은 instance의 메모리는 유지하지만 새 instance에 저장 안 된 값을 복원하지 않는다', () => {
  const fixture = storageFixture(); fixture.failure.set = true
  const locator = createDelegationConnectionLocator('a', fixture.storage)
  expect(locator.remember('memory-only')).toBe(false)
  expect(locator.read()).toBe('memory-only')
  expect(createDelegationConnectionLocator('a', fixture.storage).read()).toBeNull()
  expect(fixture.data.size).toBe(0)
  fixture.failure.set = false
  expect(locator.remember('persisted')).toBe(true)
  fixture.failure.set = true
  expect(locator.remember('later-memory-only')).toBe(false)
  expect(locator.read()).toBe('later-memory-only')
  expect(createDelegationConnectionLocator('a', fixture.storage).read()).toBe('persisted')
})

test('저장소가 없는 실행 환경에서도 remember 실패와 메모리 조회는 안전하다', () => {
  expect(typeof globalThis.sessionStorage).toBe('undefined')
  const locator = createDelegationConnectionLocator(null)
  expect(locator.read()).toBeNull()
  expect(locator.remember('no-browser-storage')).toBe(false)
  expect(locator.read()).toBe('no-browser-storage')
  expect(createDelegationConnectionLocator(null).read()).toBeNull()
})

test('저장 허용 필드는 sessionId 하나이며 읽은 추가 필드는 재저장하지 않는다', () => {
  const fixture = storageFixture()
  fixture.data.set(key('a'), JSON.stringify({ sessionId: 'old', score: 100, connected: true, parameters: { sl: -5 } }))
  const locator = createDelegationConnectionLocator('a', fixture.storage)
  expect(locator.read()).toBe('old')
  expect(locator.remember('new')).toBe(true)
  const saved = JSON.parse(fixture.data.get(key('a'))!)
  expect(saved).toEqual({ sessionId: 'new' })
  expect(Object.keys(saved)).toEqual(['sessionId'])
})

test('동일 remember는 같은 bytes를 유지하고 최신 명시 값만 read·다음 instance에 보인다', () => {
  const fixture = storageFixture(), locator = createDelegationConnectionLocator('a', fixture.storage)
  expect(locator.remember('first')).toBe(true)
  const original = fixture.data.get(key('a'))
  expect(locator.remember('first')).toBe(true)
  expect(fixture.data.get(key('a'))).toBe(original)
  expect(locator.remember('second')).toBe(true)
  expect(locator.read()).toBe('second')
  expect(createDelegationConnectionLocator('a', fixture.storage).read()).toBe('second')
  const writes = fixture.writes.length
  expect(locator.read()).toBe('second')
  expect(fixture.writes).toHaveLength(writes)
})
