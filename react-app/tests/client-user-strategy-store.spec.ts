import { expect, test } from '@playwright/test'
import { runInNewContext } from 'node:vm'
import { createClientUserStrategyStore, clientUserStrategyKey, type ClientStrategyRegistration } from '../src/client-user-strategy-store'
import { decodeSourceUserStrategyRecord } from '../src/client-user-strategy'
import { delegationParameters, delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'

const reference = evaluateDelegation(delegationRecommendedParameters(), 1)
const input: ClientStrategyRegistration = { name: '비트코인 위임 전략', parameters: reference.parameters, score: reference.score, ret: reference.result.ret, mdd: reference.result.mdd, n: reference.result.n, winRate: reference.result.winRate, environment: 'live', exchangeName: 'Binance', status: 'ready' }
const revisedParameters = [8, 10, 15].flatMap(tp => [38, 40, 42, 44, 46].map(rsiTh => ({ ...reference.parameters, tp, rsiTh }))).find(p => evaluateDelegation(p, 1).score >= 80)!

for (const status of ['ready', 'off', 'live'] as const) test(`원본 전략 수정 ${status}: 같은 ID·기간·계정에 재계산 지표를 적용하고 실행 중이면 중지한다`, () => {
  expect(revisedParameters).toBeDefined()
  const m = memory(), store = createClientUserStrategyStore('edit-owner', m.port)
  let original = store.register('s1', { ...input, asset: 'BTC', capital: 5000000, version: 'v1.0', status: status === 'ready' ? 'ready' : 'live' }, 1000)
  if (status === 'off') original = store.control(original.id, 'pause')
  const other = store.register('s2', input, 2000)
  const expected = evaluateDelegation(revisedParameters, 1)
  const revised = store.revise(original, revisedParameters)
  expect(revised).toEqual({ ...original, parameters: revisedParameters, status: status === 'live' ? 'off' : status,
    score: expected.score, ret: expected.result.ret, mdd: expected.result.mdd, n: expected.result.n, winRate: expected.result.winRate })
  expect(store.getSnapshot().entries.find(e => e.record.id === other.id)!.record).toBe(other)
  expect(createClientUserStrategyStore('edit-owner', m.port).getSnapshot().entries.find(e => e.sessionId === 's1')!.record).toEqual(revised)
  expect(createClientUserStrategyStore('another-owner', m.port).getSnapshot().entries).toEqual([])
})

test('전략 수정은 오래된 상태·구간 변경·미달 후보·설정 미공급·게스트를 거절하며 원기록을 보존한다', () => {
  const m = memory(), store = createClientUserStrategyStore('edit-owner', m.port)
  const original = store.register('s', input, 1000)
  const before = JSON.stringify(store.getSnapshot())
  for (const candidate of [{ ...reference.parameters, endI: 500 }, { ...reference.parameters, sl: 0 }, { ...reference.parameters, rsiTh: 0 }]) {
    expect(() => store.revise(original, candidate)).toThrow()
    expect(JSON.stringify(store.getSnapshot())).toBe(before)
  }
  expect(() => store.revise({ ...original, name: '다른 이름' }, revisedParameters)).toThrow()
  expect(() => createClientUserStrategyStore(null, m.port).revise(original, revisedParameters)).toThrow()
  expect(() => createClientUserStrategyStore('other', m.port).revise(original, revisedParameters)).toThrow()
  store.control(original.id, 'start')
  expect(() => store.revise(original, revisedParameters)).toThrow('전략 상태가 바뀌었어요')
  const legacy = store.register('legacy', { ...input, parameters: null }, 2000)
  expect(() => store.revise(legacy, revisedParameters)).toThrow()
})

test('전략 수정 쓰기 실패는 적용 상태와 원 ID를 메모리에 유지하고 저장 재시도로 복구한다', () => {
  const m = memory(), store = createClientUserStrategyStore('edit-owner', m.port)
  const original = store.register('s', { ...input, status: 'live' }, 1000)
  m.failWrite(true)
  const revised = store.revise(original, revisedParameters)
  expect(revised.status).toBe('off'); expect(store.getSnapshot().storageError).toBe(true)
  m.failWrite(false); store.retrySave()
  expect(store.getSnapshot().storageError).toBe(false)
  expect(createClientUserStrategyStore('edit-owner', m.port).getSnapshot().entries[0].record).toEqual(revised)
  expect(() => store.revise(original, revisedParameters)).toThrow()
})
function memory() {
  const values = new Map<string, string>(); let readError = false, writeError = false
  return { values, failRead: (v: boolean) => { readError = v }, failWrite: (v: boolean) => { writeError = v }, port: {
    getItem: (key: string) => { if (readError) throw new Error('blocked'); return values.get(key) ?? null },
    setItem: (key: string, value: string) => { if (writeError) throw new Error('blocked'); values.set(key, value) },
  } }
}
test('위임 결과의 정확한 snapshot을 계정·세션별 저장하고 같은 세션 재등록은 중복하지 않는다', () => {
  const m = memory(), a = createClientUserStrategyStore('a', m.port)
  const first = a.register('session-a', input, 1000)
  expect(first).toEqual({ ...input, id: '1000', createdAt: 1000 })
  const again = a.register('session-a', { ...input, status: 'live' }, 2000)
  expect(again.id).toBe('1000'); expect(a.getSnapshot().entries).toHaveLength(1)
  expect(a.register('session-b', input, 1000).id).toBe('1001')
  expect(createClientUserStrategyStore('a', m.port).getSnapshot().entries).toHaveLength(2)
  expect(createClientUserStrategyStore('b', m.port).getSnapshot().entries).toHaveLength(0)
  expect(JSON.stringify(a.getSnapshot())).not.toContain('demo:')
})
test('ready/start/live/pause/off/resume와 환경 전환은 같은 원본 snapshot을 유지한다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  store.register('s', input, 1000)
  expect(store.control('1000', 'start').status).toBe('live')
  expect(() => store.control('1000', 'start')).toThrow()
  expect(store.control('1000', 'env').environment).toBe('paper')
  expect(store.control('1000', 'pause').status).toBe('off')
  expect(() => store.control('1000', 'env')).toThrow()
  expect(store.control('1000', 'resume')).toMatchObject({ ...input, id: '1000', status: 'live', environment: 'paper' })
  expect(() => store.control('absent', 'start')).toThrow()
})
test('깨진 저장소는 보존하고 읽기 복구 전 등록으로 기존 전략을 덮지 않는다', () => {
  const m = memory(); createClientUserStrategyStore('a', m.port).register('s', input, 1000)
  const raw = m.values.get(clientUserStrategyKey('a'))
  m.failRead(true); const store = createClientUserStrategyStore('a', m.port)
  expect(() => store.register('s2', input, 2000)).toThrow()
  store.retrySave(); expect(m.values.get(clientUserStrategyKey('a'))).toBe(raw)
  m.failRead(false); store.retrySave()
  expect(store.getSnapshot().storageError).toBe(false); expect(store.getSnapshot().entries).toHaveLength(1)
  m.values.set(clientUserStrategyKey('a'), '{')
  const broken = createClientUserStrategyStore('a', m.port); broken.retrySave()
  expect(broken.getSnapshot().storageError).toBe(true); expect(m.values.get(clientUserStrategyKey('a'))).toBe('{')
})
test('쓰기 실패 중 등록은 메모리에 남고 재시도로 동일 ID를 복구한다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  m.failWrite(true); const record = store.register('s', input, 1000)
  expect(store.getSnapshot().storageError).toBe(true)
  m.failWrite(false); store.retrySave()
  expect(store.getSnapshot().storageError).toBe(false)
  expect(createClientUserStrategyStore('a', m.port).getSnapshot().entries[0].record).toEqual(record)
})
test('게스트·미검증·잘못된 설정과 credential 추가필드를 권위로 저장하지 않는다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  expect(() => createClientUserStrategyStore(null, m.port).register('s', input, 1000)).toThrow()
  expect(() => store.register('s', { ...input, score: 79 }, 1000)).toThrow()
  expect(() => store.register('s', { ...input, parameters: { sl: 0, tp: 10, rsiTh: 40, trendFilter: true } }, 1000)).toThrow()
  store.register('s', { ...input, apiKey: 'do-not-retain', payDone: true } as ClientStrategyRegistration, 1000)
  expect(m.values.get(clientUserStrategyKey('a'))).not.toContain('do-not-retain')
  expect(m.values.get(clientUserStrategyKey('a'))).not.toContain('payDone')
})

test('원본 tfStartStrategy 생성 시점 asset/ex/tv/cap snapshot과 일치하며 상태 전이 후에도 보존한다', () => {
  // 42a0d81 index.html:8953 creation-snapshot expression only; no HTML, execution hooks or API code.
  const source = `({asset:asset,ex:(t.api?t.api.ex:null),tv:(t.intake.assetInfo&&t.intake.assetInfo.tv)||null,cap:TF_BUDGET[(t.intake.budget||{}).i!=null?t.intake.budget.i:1]})`
  for (const [asset, exchangeId, chartSymbol, budgetIndex] of [
    ['비트코인', 'binance', 'BINANCE:BTCUSDT', 0],
    ['이더리움', 'okx', 'BINANCE:ETHUSDT', 1],
    ['자산', 'woox', null, 2],
  ] as const) {
    const budgets = [1_000_000, 7_000_000, 14_000_000]
    const expected = runInNewContext(source, { asset, t: { api: { ex: exchangeId }, intake: { assetInfo: { tv: chartSymbol }, budget: { i: budgetIndex } } }, TF_BUDGET: budgets }, { timeout: 100 })
    const m = memory(), store = createClientUserStrategyStore('a', m.port)
    const supplied: ClientStrategyRegistration = { ...input, asset, exchangeId, chartSymbol, capital: budgets[budgetIndex], version: 'v2.3' }
    const record = store.register('session', supplied, 1000)
    expect({ asset: record.asset, ex: record.exchangeId, tv: record.chartSymbol, cap: record.capital }).toEqual(expected)
    expect(record.version).toBe('v2.3')
    store.control(record.id, 'start'); store.control(record.id, 'env'); store.control(record.id, 'pause'); store.control(record.id, 'resume')
    const restored = createClientUserStrategyStore('a', m.port).getSnapshot().entries[0].record
    expect(restored).toEqual({ ...record, status: 'live', environment: 'paper' })
  }
})

test('이전 사용자 기록은 새 필드가 없어도 복원되며 없는 snapshot이나 버전을 보충하지 않는다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  const original = store.register('old-session', input, 1000)
  const restored = createClientUserStrategyStore('a', m.port).getSnapshot().entries[0].record
  expect(restored).toEqual(original)
  for (const key of ['asset', 'exchangeId', 'chartSymbol', 'capital', 'version']) expect(restored).not.toHaveProperty(key)
  const supplied = store.register('new-session', { ...input, chartSymbol: null, capital: 0 }, 1001)
  expect(supplied.chartSymbol).toBeNull()
  expect(supplied.capital).toBe(0)
  expect(supplied).not.toHaveProperty('asset')
  expect(supplied).not.toHaveProperty('version')
  const absent = decodeSourceUserStrategyRecord({ ...original, asset: undefined, exchangeId: undefined, chartSymbol: undefined, capital: undefined, version: undefined })!
  expect(absent).toEqual(original)
})

test('유효하지 않은 원화 기준 금액·snapshot 타입을 거부하고 기존 저장값은 보존한다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  store.register('old', { ...input, capital: 7_000_000 }, 1000)
  const before = m.values.get(clientUserStrategyKey('a'))
  for (const capital of [NaN, Infinity, -Infinity, -1, Number.MAX_SAFE_INTEGER + 1, '7000000', null, {}]) {
    expect(() => store.register('new', { ...input, capital } as ClientStrategyRegistration, 1001)).toThrow()
    expect(m.values.get(clientUserStrategyKey('a'))).toBe(before)
  }
  for (const key of ['asset', 'exchangeId', 'chartSymbol', 'version'] as const) {
    for (const value of ['', '  ', 1, [], {}]) expect(() => store.register('new', { ...input, [key]: value }, 1001)).toThrow()
    if (key !== 'chartSymbol') expect(() => store.register('new', { ...input, [key]: null }, 1001)).toThrow()
  }
  expect(store.getSnapshot().entries).toHaveLength(1)
  expect(m.values.get(clientUserStrategyKey('a'))).toBe(before)
})

test('새 snapshot은 외부 입력 변경·다른 계정·같은 시각의 다른 세션에 의해 바뀌지 않는다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  const supplied = { ...input, asset: '비트코인', exchangeId: 'binance', chartSymbol: 'BINANCE:BTCUSDT', capital: 7_000_000, version: 'v2.3' }
  const first = store.register('first', supplied, 1000)
  supplied.asset = '이더리움'; supplied.exchangeId = 'okx'; supplied.chartSymbol = 'BINANCE:ETHUSDT'; supplied.capital = 14_000_000; supplied.version = 'v3.0'
  const second = store.register('second', supplied, 1000)
  expect(second.id).toBe('1001')
  expect(first).toMatchObject({ asset: '비트코인', exchangeId: 'binance', chartSymbol: 'BINANCE:BTCUSDT', capital: 7_000_000, version: 'v2.3' })
  expect(Object.isFrozen(first)).toBe(true)
  expect(createClientUserStrategyStore('b', m.port).getSnapshot().entries).toEqual([])
  expect(createClientUserStrategyStore('a', m.port).getSnapshot().entries.map(item => item.record)).toEqual([first, second])
})

test('손상된 생성 snapshot 복원은 오류를 알리고 원본 저장 데이터를 고쳐 쓰지 않는다', () => {
  const m = memory()
  const broken = JSON.stringify([{ sessionId: 's', record: { ...input, id: '1000', createdAt: 1000, capital: -7, chartSymbol: null } }])
  m.values.set(clientUserStrategyKey('a'), broken)
  const store = createClientUserStrategyStore('a', m.port)
  expect(store.getSnapshot().storageError).toBe(true)
  expect(store.getSnapshot().entries).toEqual([])
  store.retrySave()
  expect(() => store.register('new', input, 1001)).toThrow()
  expect(m.values.get(clientUserStrategyKey('a'))).toBe(broken)
  expect(store.getSnapshot().storageError).toBe(true)
})

test('알려진 생성 필드만 보존하며 새 snapshot을 이용해 credentials나 실제 권한을 저장하지 않는다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  const extra = { ...input, asset: '비트코인', exchangeId: 'binance', chartSymbol: null, capital: 7_000_000, version: 'v1.1', apiKey: 'discard-this', permission: { withdraw: false }, liveBalance: 999999, fills: [{ id: 'invented' }], cap: 8888, tv: 'WRONG:VALUE' }
  const saved = store.register('s', extra, 1000)
  for (const key of ['apiKey', 'permission', 'liveBalance', 'fills', 'cap', 'tv']) expect(saved).not.toHaveProperty(key)
  expect(saved).toMatchObject({ asset: '비트코인', exchangeId: 'binance', chartSymbol: null, capital: 7_000_000, version: 'v1.1' })
  expect(m.values.get(clientUserStrategyKey('a'))).not.toContain('discard-this')
})

test('저장 점수 86과 실제 기본 설정 52점 불일치 등록은 상태·저장소를 바꾸지 않는다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  store.register('existing', input, 1000)
  const before = store.getSnapshot(), raw = m.values.get(clientUserStrategyKey('a'))
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications++ })
  for (const status of ['ready', 'live'] as const) {
    expect(() => store.register('new', { ...input, parameters: delegationParameters({}), score: 86, ret: 21.4, status }, 2000)).toThrow('현재 설정의 재검증 점수 52점이 실행 기준(80점)에 미달')
    expect(store.getSnapshot()).toBe(before)
    expect(m.values.get(clientUserStrategyKey('a'))).toBe(raw)
  }
  expect(notifications).toBe(0); unsubscribe()
})

test('통과 파라미터라도 저장 score·거래수·성과가 다르면 등록을 거부하며 자동 보정하지 않는다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  for (const key of ['score', 'n', 'ret', 'mdd', 'winRate'] as const) {
    const mismatch = { ...input, [key]: input[key] + (key === 'score' || key === 'n' ? 1 : 1e-5) }
    expect(() => store.register('new', mismatch, 1000)).toThrow('저장된 검증 수치가 현재 계산 설정과 일치하지 않아요')
    expect(store.getSnapshot().entries).toEqual([])
    expect(m.values.size).toBe(0)
  }
  // The declared 1e-6 tolerance is absolute in percentage points. Preserve the
  // supplied value inside that tolerance; never silently replace the snapshot.
  const supplied = { ...input, ret: input.ret + 5e-7 }
  expect(store.register('roundtrip', supplied, 1000).ret).toBe(supplied.ret)
})

test('설정 미공급 ready 등록·복원은 보존하지만 live 등록·시작은 불가능하다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  const legacy = store.register('legacy', { ...input, parameters: null }, 1000)
  expect(legacy.parameters).toBeNull()
  const restored = createClientUserStrategyStore('a', m.port), before = restored.getSnapshot()
  expect(before.entries[0].record).toEqual(legacy)
  expect(() => restored.control(legacy.id, 'start')).toThrow('저장된 계산 설정이 없어요')
  expect(() => restored.register('live', { ...input, parameters: null, status: 'live' }, 1001)).toThrow('저장된 계산 설정이 없어요')
  expect(restored.getSnapshot()).toBe(before)
})

test('legacy 복원은 재평가로 고쳐 쓰지 않고 start/resume/paper→live 승격 시 현재 p를 검사한다', () => {
  for (const [status, environment, action] of [
    ['ready', 'live', 'start'], ['off', 'live', 'resume'], ['off', 'paper', 'resume'], ['live', 'paper', 'env'],
  ] as const) {
    const m = memory(), record = { ...input, id: '1000', createdAt: 1000, parameters: delegationParameters({}), score: 86, ret: 21.4, status, environment }
    const raw = JSON.stringify([{ sessionId: 'old', record }])
    m.values.set(clientUserStrategyKey('a'), raw)
    const store = createClientUserStrategyStore('a', m.port), before = store.getSnapshot()
    expect(before.entries[0].record).toEqual(record)
    expect(before.storageError).toBe(false)
    expect(() => store.control('1000', action)).toThrow('재검증 점수 52점')
    expect(store.getSnapshot()).toBe(before)
    expect(m.values.get(clientUserStrategyKey('a'))).toBe(raw)
  }
})

test('복원된 통과 p와 불일치하는 snapshot도 실행으로 승격하지 않는다', () => {
  const m = memory(), record = { ...input, id: '1000', createdAt: 1000, score: 86 }
  const raw = JSON.stringify([{ sessionId: 'old', record }])
  m.values.set(clientUserStrategyKey('a'), raw)
  const store = createClientUserStrategyStore('a', m.port)
  expect(() => store.control('1000', 'start')).toThrow('저장된 검증 수치가 현재 계산 설정과 일치하지 않아요')
  expect(m.values.get(clientUserStrategyKey('a'))).toBe(raw)
})

test('설정 없음·잘못된 구간·미달 점수여도 live→paper와 pause는 재계산 없이 허용한다', () => {
  for (const parameters of [null, { ...input.parameters!, endI: 999999 }, delegationParameters({})]) {
    const m = memory(), record = { ...input, id: '1000', createdAt: 1000, parameters, status: 'live', score: 5 }
    m.values.set(clientUserStrategyKey('a'), JSON.stringify([{ sessionId: 'old', record }]))
    const store = createClientUserStrategyStore('a', m.port)
    expect(store.control('1000', 'env')).toMatchObject({ ...record, environment: 'paper' })
    expect(() => store.control('1000', 'env')).toThrow()
    expect(store.control('1000', 'pause')).toMatchObject({ ...record, status: 'off', environment: 'paper' })
    expect(() => store.control('1000', 'resume')).toThrow()
    expect(createClientUserStrategyStore('a', m.port).getSnapshot().entries[0].record.status).toBe('off')
  }
})

test('정상 추천 설정은 등록과 live 승격 후에도 정확한 원본 수치·계정·파라미터를 보존한다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  const created = store.register('verified', { ...input, status: 'live', environment: 'paper' }, 1000)
  expect(created.score).toBe(80)
  expect(store.control(created.id, 'env').environment).toBe('live')
  store.control(created.id, 'pause'); store.control(created.id, 'resume')
  const restored = createClientUserStrategyStore('a', m.port).getSnapshot().entries[0].record
  expect(restored).toEqual({ ...created, environment: 'live' })
  expect(createClientUserStrategyStore('b', m.port).getSnapshot().entries).toEqual([])
})

test('잘못된 가격 구간은 고정된 재검증 안내로 거부하고 새 기록을 저장하지 않는다', () => {
  const m = memory(), store = createClientUserStrategyStore('a', m.port)
  expect(() => store.register('invalid', { ...input, parameters: { ...input.parameters!, endI: 999999 } }, 1000)).toThrow('저장된 계산 설정을 확인할 수 없어요. 전략을 다시 검증해주세요.')
  expect(store.getSnapshot().entries).toEqual([])
  expect(m.values.size).toBe(0)
})
