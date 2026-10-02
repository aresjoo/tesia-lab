import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import ts from 'typescript'
import { createClientStrategyCreatorStore, clientStrategyCreatorKey, getCreatorCandidate, type CreatorPublishRequest } from '../src/client-strategy-creator-store'
import { delegationRecommendedParameters, evaluateDelegation } from '../src/client-delegation-engine'
import type { SourceUserStrategyRecord } from '../src/client-user-strategy'

const now = Date.UTC(2026, 8, 15, 23, 59)
function record(id = '1000'): SourceUserStrategyRecord {
  const parameters = delegationRecommendedParameters(), { result, score } = evaluateDelegation(parameters, 1)
  return { id, createdAt: Number(id), name: '같은 이름', asset: '이더리움', parameters, status: 'ready', environment: 'paper', version: 'v1.0',
    score, ret: result.ret, mdd: result.mdd, n: result.n, winRate: result.winRate }
}
function storageFixture() {
  const data = new Map<string, string>(), writes: [string, string][] = [], reads: string[] = []
  const fail = { get: false, set: false }
  return { data, writes, reads, fail, port: {
    getItem(key: string) { reads.push(key); if (fail.get) throw new Error('read fixture'); return data.get(key) ?? null },
    setItem(key: string, value: string) { if (fail.set) throw new Error('write fixture'); writes.push([key, value]); data.set(key, value) },
  } }
}
function fixture(initial = [record()]) {
  const storage = storageFixture(), supplied = { records: initial }
  const store = createClientStrategyCreatorStore('owner-a', () => supplied.records, storage.port)
  const request = (value = supplied.records[0], description = ''): CreatorPublishRequest => ({ sourceId: value.id, description, expected: getCreatorCandidate(value) })
  return { ...storage, supplied, store, request }
}

test('현재 p 평가와 정확히 일치한 80점 후보, null p legacy 요약은 자격을 갖는다', () => {
  expect(getCreatorCandidate(record())).toMatchObject({ eligible: true })
  const legacy = { ...record(), parameters: null, score: 81, ret: 7, mdd: -4, n: 8, winRate: 60 }
  expect(getCreatorCandidate(legacy)).toMatchObject({ eligible: true, record: legacy })
  expect(getCreatorCandidate({ ...legacy, score: 80.5 }).eligible).toBe(true)
  expect(getCreatorCandidate({ ...legacy, score: 79 }).eligible).toBe(false)
})

test('범위 밖 p와 과거 score/metrics가 현재 p와 불일치하면 미자격이다', () => {
  const original = record()
  for (const change of [{ score: 86 }, { ret: original.ret + .01 }, { mdd: original.mdd - .01 }, { n: original.n + 1 }, { winRate: original.winRate + .01 },
    { parameters: { ...original.parameters!, endI: 99999 } }, { parameters: { ...original.parameters!, startI: 900, endI: 800 } },
    { parameters: { ...original.parameters!, sl: 0 } }, { ret: Infinity }, { mdd: NaN }, { n: -1 }, { winRate: 101 }]) {
    expect(getCreatorCandidate({ ...original, ...change })).toMatchObject({ eligible: false, reason: expect.any(String) })
  }
  expect(getCreatorCandidate({ ...original, ret: original.ret + 1e-7 }).eligible).toBe(true)
})

test('동명 후보는 이름이 아니라 정확 source ID로 공개하며 날짜와 소개만 보관한다', () => {
  const a = record('1000'), b = { ...record('1001'), asset: '비트코인' }, f = fixture([a, b])
  const before = JSON.stringify(f.supplied.records)
  const publication = f.store.publish(f.request(b, '  설명  '), now)
  expect(publication).toEqual({ sourceId: '1001', name: b.name, asset: b.asset, description: '설명', publishedAt: '2026-09-15', parameters: b.parameters,
    score: b.score, ret: b.ret, mdd: b.mdd, n: b.n, winRate: b.winRate })
  expect(JSON.stringify(f.supplied.records)).toBe(before)
  expect(f.store.getSnapshot()).toEqual({ publication, visible: true, storageError: false })
  expect(JSON.parse(f.writes[0][1])).toEqual({ publication, visible: true })
})

test('공개 스냅샷은 deep copy·frozen이며 원등록을 나중에 바꿔도 덮이지 않는다', () => {
  const f = fixture(), original = f.supplied.records[0], publication = f.store.publish(f.request(), now)
  expect(publication.parameters).not.toBe(original.parameters)
  expect(Object.isFrozen(publication)).toBe(true)
  expect(Object.isFrozen(publication.parameters)).toBe(true)
  expect(Object.isFrozen(f.store.getSnapshot())).toBe(true)
  original.parameters!.sl = -12
  f.supplied.records = [{ ...original, name: '수정된 이름' }]
  expect(publication.parameters?.sl).toBe(-5)
  expect(publication.name).toBe('같은 이름')
})

test('공개/비공개는 원등록 삭제 후에도 보존한 스냅샷으로 작동한다', () => {
  const f = fixture(), publication = f.store.publish(f.request(), now)
  f.supplied.records = []
  expect(f.store.setVisible(false)).toBe(true)
  expect(f.store.getSnapshot()).toEqual({ publication, visible: false, storageError: false })
  expect(f.store.setVisible(true)).toBe(true)
  expect(f.store.getSnapshot().publication).toBe(publication)
  const writes = f.writes.length
  f.store.setVisible(true)
  expect(f.writes).toHaveLength(writes)
})

test('소개 재공개 시 원본처럼 UTC 등록일이 갱신되고 toggle만으로는 바뀌지 않는다', () => {
  const f = fixture()
  f.store.publish(f.request(undefined, '처음'), now)
  f.store.setVisible(false)
  const publication = f.store.publish(f.request(undefined, '수정'), now + 86400000)
  expect(publication).toMatchObject({ publishedAt: '2026-09-16', description: '수정' })
  f.store.setVisible(false); f.store.setVisible(true)
  expect(f.store.getSnapshot().publication?.publishedAt).toBe('2026-09-16')
})

test('legacy null p와 미공급 asset은 곡선/자산을 만들어내지 않고 null로 저장한다', () => {
  const legacy = { ...record(), parameters: null, asset: undefined, score: 86, ret: 21, mdd: -10, n: 11, winRate: 63 }
  const f = fixture([legacy]), publication = f.store.publish(f.request(), now)
  expect(publication).toMatchObject({ parameters: null, asset: null, score: 86 })
  expect(Object.keys(publication).sort()).toEqual(['asset', 'description', 'mdd', 'n', 'name', 'parameters', 'publishedAt', 'ret', 'score', 'sourceId', 'winRate'])
})

test('공개 최종 클릭은 최신 공급 목록의 삭제·중복 ID·자격 변경을 다시 검사한다', () => {
  for (const replace of [() => [], (r: SourceUserStrategyRecord) => [r, r],
    (r: SourceUserStrategyRecord) => [{ ...r, score: 79 }], (r: SourceUserStrategyRecord) => [{ ...r, parameters: { ...r.parameters!, rsiTh: 52 } }]]) {
    const f = fixture(), request = f.request(), before = f.store.getSnapshot()
    f.supplied.records = replace(f.supplied.records[0])
    expect(() => f.store.publish(request, now)).toThrow()
    expect(f.store.getSnapshot()).toBe(before)
    expect(f.writes).toHaveLength(0)
  }
})

test('동일 ID의 이름·자산·version·null 전환 변경은 이전 미리보기로 공개하지 못한다', () => {
  for (const change of [{ name: '새 이름' }, { asset: '비트코인' }, { version: 'v2.0' }, { parameters: null }]) {
    const f = fixture(), request = f.request()
    f.supplied.records = [{ ...f.supplied.records[0], ...change }]
    expect(() => f.store.publish(request, now)).toThrow('전략 조건이 바뀌었어요')
    expect(f.writes).toHaveLength(0)
  }
})

test('공개 기준과 무관한 봇 status/environment 변화는 실행 변경 없이 허용한다', () => {
  const f = fixture(), request = f.request()
  f.supplied.records = [{ ...f.supplied.records[0], status: 'off', environment: 'live' }]
  const before = JSON.stringify(f.supplied.records)
  f.store.publish(request, now)
  expect(JSON.stringify(f.supplied.records)).toBe(before)
})

test('다른 source 기대값·eligible 위조·기대값 누락은 저장 전에 거절한다', () => {
  const f = fixture()
  for (const expected of [undefined, { record: record('1001'), eligible: true }, { record: { ...record(), score: 86 }, eligible: true }, { record: record(), eligible: false }, { record: record(), eligible: 'true' }]) {
    expect(() => f.store.publish({ ...f.request(), expected } as CreatorPublishRequest, now)).toThrow()
  }
  expect(f.writes).toHaveLength(0)
})

test('소개는 UTF-16 100단위까지이며 잘못된 타입과 날짜를 거절한다', () => {
  const f = fixture()
  expect(f.store.publish(f.request(undefined, '🙂'.repeat(50)), now).description.length).toBe(100)
  for (const description of ['가'.repeat(101), '🙂'.repeat(51), null, 12]) {
    expect(() => f.store.publish({ ...f.request(), description } as CreatorPublishRequest, now)).toThrow()
  }
  for (const bad of [-1, .5, NaN, Infinity, 253402300800000, '1', null]) expect(() => f.store.publish(f.request(), bad as number)).toThrow()
})

test('쓰기 실패는 최초/수정/비공개 모두 snapshot·bytes·알림을 보존한다', () => {
  const f = fixture(); let notifications = 0
  f.store.subscribe(() => notifications++)
  f.fail.set = true
  const empty = f.store.getSnapshot()
  expect(() => f.store.publish(f.request(), now)).toThrow('저장하지 못했어요')
  expect(f.store.getSnapshot()).toBe(empty); expect(notifications).toBe(0); expect(f.data.size).toBe(0)
  f.fail.set = false; f.store.publish(f.request(), now)
  const saved = f.store.getSnapshot(), bytes = f.data.get(clientStrategyCreatorKey('owner-a'))
  f.fail.set = true
  expect(() => f.store.publish(f.request(undefined, '수정'), now + 86400000)).toThrow()
  expect(() => f.store.setVisible(false)).toThrow()
  expect(f.store.getSnapshot()).toBe(saved); expect(notifications).toBe(1)
  expect(f.data.get(clientStrategyCreatorKey('owner-a'))).toBe(bytes)
  f.fail.set = false; f.store.setVisible(false)
  expect(notifications).toBe(2)
})

test('owner 키는 분리되고 guest/잘못된 owner는 저장과 목록 조회를 하지 않는다', () => {
  const storage = storageFixture(), calls: string[] = []
  for (const owner of ['a/b', 'a%2Fb', '한글']) {
    const store = createClientStrategyCreatorStore(owner, () => [record()], storage.port)
    store.publish({ sourceId: '1000', description: '', expected: getCreatorCandidate(record()) }, now)
  }
  expect(storage.data.size).toBe(3)
  const writes = storage.writes.length, reads = storage.reads.length
  for (const owner of [null, '', ' a', 'a\nb', 'a'.repeat(321)]) {
    const store = createClientStrategyCreatorStore(owner, () => { calls.push('records'); return [record()] }, storage.port)
    expect(() => store.publish({ sourceId: '1000', description: '', expected: getCreatorCandidate(record()) }, now)).toThrow()
    expect(() => store.setVisible(true)).toThrow()
  }
  expect(calls).toEqual([]); expect(storage.writes).toHaveLength(writes); expect(storage.reads).toHaveLength(reads)
})

test('손상된 초기 bytes는 보존하며 공개 차단 후 retryLoad로만 회복한다', () => {
  const f = storageFixture(), key = clientStrategyCreatorKey('owner-a')
  for (const raw of ['{broken', 'null', '[]', '{"visible":true,"publication":null}', '{"visible":false,"publication":{}}']) {
    f.data.set(key, raw)
    const store = createClientStrategyCreatorStore('owner-a', () => [record()], f.port)
    expect(store.getSnapshot()).toEqual({ publication: null, visible: false, storageError: true })
    expect(() => store.publish({ sourceId: '1000', description: '', expected: getCreatorCandidate(record()) }, now)).toThrow('불러오지 못했어요')
    expect(f.data.get(key)).toBe(raw)
    f.data.set(key, JSON.stringify({ publication: null, visible: false }))
    expect(store.retryLoad()).toBe(true)
    expect(store.getSnapshot().storageError).toBe(false)
  }
  expect(f.writes).toHaveLength(0)
})

test('정상 publication 복원은 추가 필드를 버리고 잘못된 날짜/성과/설정은 거절한다', () => {
  const f = fixture(), publication = f.store.publish(f.request(), now), key = clientStrategyCreatorKey('owner-a')
  f.data.set(key, JSON.stringify({ visible: false, ignoredPrivateFixture: 'discard', publication: { ...publication, ignoredPrivateFixture: 'discard', parameters: { ...publication.parameters, ignoredPrivateFixture: 'discard' } } }))
  const restored = createClientStrategyCreatorStore('owner-a', () => [], f.port)
  expect(restored.getSnapshot()).toEqual({ publication, visible: false, storageError: false })
  for (const change of [{ publishedAt: '2026-02-30' }, { publishedAt: 'invalid' }, { description: '가'.repeat(101) }, { score: 86 }, { parameters: { ...publication.parameters, endI: 9999 } }]) {
    const raw = JSON.stringify({ visible: false, publication: { ...publication, ...change } })
    f.data.set(key, raw)
    const store = createClientStrategyCreatorStore('owner-a', () => [], f.port)
    expect(store.getSnapshot().storageError).toBe(true)
    expect(f.data.get(key)).toBe(raw)
  }
})

test('읽기 장애는 기존 공개 스냅샷을 버리지 않고 retry 성공 전 변경을 차단한다', () => {
  const f = fixture(), publication = f.store.publish(f.request(), now)
  f.fail.get = true
  expect(f.store.retryLoad()).toBe(false)
  expect(f.store.getSnapshot()).toEqual({ publication, visible: true, storageError: true })
  expect(() => f.store.setVisible(false)).toThrow()
  f.fail.get = false
  expect(f.store.retryLoad()).toBe(true)
  expect(f.store.getSnapshot()).toEqual({ publication, visible: true, storageError: false })
})

test('현재 publication 없이 toggle은 거절하며 등록 공급자의 예외도 저장하지 않는다', () => {
  const f = fixture()
  expect(() => f.store.setVisible(true)).toThrow('스냅샷이 없어요')
  const store = createClientStrategyCreatorStore('owner-a', () => { throw new Error('records unavailable') }, f.port)
  expect(() => store.publish(f.request(), now)).toThrow('다시 불러와주세요')
  expect(f.writes).toHaveLength(0)
})

test('모듈 선언 자체는 저장소/타이머/네트워크/브라우저를 접근하지 않는다', () => {
  const exports: Record<string, unknown> = {}, touches: string[] = [], forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: () => ({}), fetch: forbidden('fetch'), setTimeout: forbidden('timeout'), setInterval: forbidden('interval') }
  for (const name of ['window', 'document', 'sessionStorage', 'localStorage']) Object.defineProperty(context, name, { get: forbidden(name) })
  const compiled = ts.transpileModule(readFileSync('src/client-strategy-creator-store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 1000 })
  expect(Object.keys(exports).sort()).toEqual(['CreatorStoreError', 'clientStrategyCreatorKey', 'createClientStrategyCreatorStore', 'getCreatorCandidate'])
  expect(touches).toEqual([])
})
