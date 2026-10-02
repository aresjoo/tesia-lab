import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { expect, test } from '@playwright/test'
import { createClientReportUpgradeStore, reportUpgradeFingerprint } from '../src/client-report-upgrade'

const owner = 'report@example.test'
const key = (value: string | null) => `teth-client-report-upgrade:${value === null ? 'guest' : `account:${encodeURIComponent(value)}`}`
const a = '12.3456789012345|18|80', b = '12.3456789012346|18|80'
function fixture() {
  const data = new Map<string, string>(), reads: string[] = [], writes: [string, string][] = []
  const failure = { get: false, set: false }
  const storage = {
    getItem(name: string) { reads.push(name); if (failure.get) throw new Error('fixture read blocked'); return data.get(name) ?? null },
    setItem(name: string, value: string) { writes.push([name, value]); if (failure.set) throw new Error('fixture write blocked'); data.set(name, value) },
  }
  return { data, reads, writes, failure, storage }
}

test('표시 이력 모듈 로드는 저장소·타이머·네트워크를 사용하지 않는다', () => {
  const exports: Record<string, unknown> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: forbidden('require'), fetch: forbidden('fetch'), setTimeout: forbidden('timeout'), setInterval: forbidden('interval') }
  Object.defineProperty(context, 'sessionStorage', { get: forbidden('storage') })
  const compiled = ts.transpileModule(readFileSync('src/client-report-upgrade.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 100 })
  expect(touches).toEqual([])
  expect(Object.keys(exports).sort()).toEqual(['createClientReportUpgradeStore', 'reportUpgradeFingerprint'])
})

test('원본 ret|n|score 지문은 반올림 없이 String 숫자 표현을 유지한다', () => {
  for (const ret of [0, -0, -99.25, 12.3456789012345, 1e-7, 1e21, Number.MAX_VALUE, Number.MIN_VALUE]) {
    const input = Object.freeze({ ret, n: 18, score: 80 })
    expect(reportUpgradeFingerprint(input)).toBe(String(ret) + '|18|80')
    expect(input).toEqual({ ret, n: 18, score: 80 })
  }
  expect(reportUpgradeFingerprint({ ret: 0, n: 0, score: 0 })).toBe('0|0|0')
  expect(reportUpgradeFingerprint({ ret: 1, n: Number.MAX_SAFE_INTEGER, score: 100 })).toBe(`1|${Number.MAX_SAFE_INTEGER}|100`)
})

test('ret·거래수·점수 각 변경은 별도 지문이고 부수 메타데이터는 지문에 들어가지 않는다', () => {
  const base = { ret: 12.3456789012345, n: 18, score: 80 }
  expect(reportUpgradeFingerprint(base)).toBe(a)
  expect(new Set([base, { ...base, ret: 12.3456789012346 }, { ...base, n: 19 }, { ...base, score: 81 }].map(reportUpgradeFingerprint)).size).toBe(4)
  expect(reportUpgradeFingerprint({ ...base, ...{ sessionId: 'not-a-token-field', paid: true } })).toBe(a)
})

test('지문 생성은 비유한 수·음수나 부정확한 거래수·범위 밖 점수를 거절한다', () => {
  for (const ret of [NaN, Infinity, -Infinity]) expect(reportUpgradeFingerprint({ ret, n: 18, score: 80 })).toBeNull()
  for (const n of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(reportUpgradeFingerprint({ ret: 1, n, score: 80 })).toBeNull()
  for (const score of [-1, 101, 80.5, NaN, Infinity]) expect(reportUpgradeFingerprint({ ret: 1, n: 18, score })).toBeNull()
  for (const input of [{}, { ret: '1', n: 18, score: 80 }, { ret: 1, n: '18', score: 80 }, { ret: 1, n: 18, score: '80' }]) {
    expect(reportUpgradeFingerprint(input as Parameters<typeof reportUpgradeFingerprint>[0])).toBeNull()
  }
})

test('최초 조회는 빈 상태이며 명시 claim만 정확한 owner 키와 허용 필드를 저장한다', () => {
  const f = fixture(), store = createClientReportUpgradeStore(owner, f.storage)
  expect(store.read()).toBeNull()
  expect(store.read()).toBeNull()
  expect(f.writes).toEqual([])
  expect(store.claim(a)).toEqual({ reserved: true, persisted: true })
  expect(store.read()).toBe(a)
  expect(f.writes).toEqual([[key(owner), JSON.stringify({ fingerprint: a })]])
  expect([...f.data.keys()]).toEqual([key(owner)])
  expect(Object.keys(JSON.parse(f.data.get(key(owner))!))).toEqual(['fingerprint'])
})

test('동일 지문은 연속 호출해도 재예약·재저장하지 않는다', () => {
  const f = fixture(), store = createClientReportUpgradeStore(owner, f.storage)
  expect(store.claim(a)).toEqual({ reserved: true, persisted: true })
  for (let index = 0; index < 10; index++) expect(store.claim(a)).toEqual({ reserved: false, persisted: true })
  expect(f.writes).toHaveLength(1)
})

test('원본 단일 마지막 지문이므로 A→B→A는 세 번 예약하며 과거 집합을 만들지 않는다', () => {
  const f = fixture(), store = createClientReportUpgradeStore(owner, f.storage)
  for (const fp of [a, b, a]) {
    expect(store.claim(fp)).toEqual({ reserved: true, persisted: true })
    expect(store.read()).toBe(fp)
  }
  expect(f.writes.map(([, raw]) => JSON.parse(raw))).toEqual([{ fingerprint: a }, { fingerprint: b }, { fingerprint: a }])
  expect(f.data.size).toBe(1)
})

test('새 store는 저장된 마지막 지문을 복원하고 같은 지문을 다시 표시하지 않는다', () => {
  const f = fixture(), initial = createClientReportUpgradeStore(owner, f.storage)
  initial.claim(a); initial.claim(b)
  const restored = createClientReportUpgradeStore(owner, f.storage)
  expect(restored.read()).toBe(b)
  expect(restored.claim(b)).toEqual({ reserved: false, persisted: true })
  expect(f.writes).toHaveLength(2)
  expect(restored.claim(a)).toEqual({ reserved: true, persisted: true })
})

test('guest·동명이름 account·인코딩 경계·다른 owner는 서로 표시 이력을 상속하지 않는다', () => {
  const f = fixture(), owners = [null, 'guest', 'account:a', 'a/b', 'a%2Fb', '한글@example.test', '검수👩‍💻']
  for (const value of owners) {
    const store = createClientReportUpgradeStore(value, f.storage)
    expect(store.read()).toBeNull()
    expect(store.claim(a)).toEqual({ reserved: true, persisted: true })
  }
  expect(new Set(f.writes.map(([name]) => name)).size).toBe(owners.length)
  expect([...f.data.keys()]).toEqual(owners.map(key))
  for (const value of owners) expect(createClientReportUpgradeStore(value, f.storage).read()).toBe(a)
  expect(createClientReportUpgradeStore('new-owner', f.storage).read()).toBeNull()
})

test('쓰기 실패는 기존 bytes를 유지하면서 현재 메모리에서만 한 번 예약한다', () => {
  const f = fixture()
  f.data.set(key(owner), JSON.stringify({ fingerprint: a }))
  const store = createClientReportUpgradeStore(owner, f.storage)
  f.failure.set = true
  expect(store.claim(b)).toEqual({ reserved: true, persisted: false })
  expect(store.read()).toBe(b)
  expect(f.data.get(key(owner))).toBe(JSON.stringify({ fingerprint: a }))
  expect(store.claim(b)).toEqual({ reserved: false, persisted: false })
  f.failure.set = false
  expect(store.claim(b)).toEqual({ reserved: false, persisted: false })
  expect(f.writes).toHaveLength(1)
  const reloaded = createClientReportUpgradeStore(owner, f.storage)
  expect(reloaded.read()).toBe(a)
  expect(reloaded.claim(b)).toEqual({ reserved: true, persisted: true })
})

test('실패한 지문 뒤 다른 지문은 다시 저장할 수 있고 성공 여부도 최신 값만 유지한다', () => {
  const f = fixture(), store = createClientReportUpgradeStore(owner, f.storage)
  f.failure.set = true
  expect(store.claim(a)).toEqual({ reserved: true, persisted: false })
  f.failure.set = false
  expect(store.claim(b)).toEqual({ reserved: true, persisted: true })
  expect(store.claim(b)).toEqual({ reserved: false, persisted: true })
  expect(store.claim(a)).toEqual({ reserved: true, persisted: true })
  expect(f.data.get(key(owner))).toBe(JSON.stringify({ fingerprint: a }))
})

const invalidFingerprints = ['', ' ', '1|18', '1|18|80|extra', 'NaN|18|80', 'Infinity|18|80', '1|-1|80', '1|1.5|80', '1|9007199254740992|80', '1|18|101', '1|18|80.5', '01|18|80', '+1|18|80', '-0|18|80', '1.0|18|80', '1e0|18|80', '1|018|80', '1|18|080', ' 1|18|80', '1|18|80\n', '1'.repeat(10000)]
test('claim은 canonical 숫자 세 필드만 받아들이고 잘못된 값은 현재 메모리·bytes를 바꾸지 않는다', () => {
  const f = fixture(), store = createClientReportUpgradeStore(owner, f.storage)
  store.claim(a)
  for (const fp of invalidFingerprints) expect(store.claim(fp)).toEqual({ reserved: false, persisted: false })
  expect(store.read()).toBe(a)
  expect(f.writes).toHaveLength(1)
  expect(f.data.get(key(owner))).toBe(JSON.stringify({ fingerprint: a }))
  expect(store.claim(a)).toEqual({ reserved: false, persisted: true })
})

test('손상·다른 구조 저장은 원 bytes 쓰기를 막되 현재 페이지의 안내는 한 번 예약한다', () => {
  const corrupt = ['{', '', 'null', '[]', 'true', '42', JSON.stringify(a), '{}', '{"fingerprint":null}', '{"fingerprint":123}', ...invalidFingerprints.map(fingerprint => JSON.stringify({ fingerprint }))]
  for (const raw of corrupt) {
    const f = fixture(); f.data.set(key(owner), raw)
    const store = createClientReportUpgradeStore(owner, f.storage)
    expect(store.read(), raw).toBeNull()
    expect(store.claim(a), raw).toEqual({ reserved: true, persisted: false })
    expect(store.read(), raw).toBe(a)
    expect(store.claim(a), raw).toEqual({ reserved: false, persisted: false })
    expect(store.claim(b), raw).toEqual({ reserved: true, persisted: false })
    expect(store.claim(b), raw).toEqual({ reserved: false, persisted: false })
    expect(f.data.get(key(owner)), raw).toBe(raw)
    expect(f.writes, raw).toEqual([])
  }
})

test('읽기 예외는 메모리 안내를 허용하지만 새 store 생성까지 원 저장소 쓰기를 차단한다', () => {
  const f = fixture(); f.data.set(key(owner), JSON.stringify({ fingerprint: a })); f.failure.get = true
  const store = createClientReportUpgradeStore(owner, f.storage)
  expect(store.read()).toBeNull()
  expect(store.claim(b)).toEqual({ reserved: true, persisted: false })
  expect(store.read()).toBe(b)
  f.failure.get = false
  expect(store.claim(b)).toEqual({ reserved: false, persisted: false })
  expect(store.claim(a)).toEqual({ reserved: true, persisted: false })
  expect(f.writes).toEqual([])
  expect(f.data.get(key(owner))).toBe(JSON.stringify({ fingerprint: a }))
  expect(createClientReportUpgradeStore(owner, f.storage).read()).toBe(a)
})

test('허용 지문 밖의 저장 필드는 소비·복사하지 않고 다음 쓰기도 지문 하나만 남긴다', () => {
  const f = fixture(), raw = JSON.stringify({ fingerprint: a, paid: true, connected: true, unrelated: 'synthetic-unused-field' })
  f.data.set(key(owner), raw)
  const store = createClientReportUpgradeStore(owner, f.storage)
  expect(store.read()).toBe(a)
  expect(store.claim(a)).toEqual({ reserved: false, persisted: true })
  expect(f.data.get(key(owner))).toBe(raw)
  expect(store.claim(b)).toEqual({ reserved: true, persisted: true })
  expect(f.data.get(key(owner))).toBe(JSON.stringify({ fingerprint: b }))
})

test('브라우저 저장소 getter가 막혀도 안내 예약은 메모리에서 중복 방지되며 타이머·네트워크는 없다', () => {
  const exports: Record<string, unknown> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, fetch: forbidden('fetch'), setTimeout: forbidden('timeout'), setInterval: forbidden('interval') }
  Object.defineProperty(context, 'sessionStorage', { get: forbidden('storage') })
  const compiled = ts.transpileModule(readFileSync('src/client-report-upgrade.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 100 })
  const create = exports.createClientReportUpgradeStore as typeof createClientReportUpgradeStore
  const store = create(owner)
  expect(store.read()).toBeNull()
  expect(store.claim(a)).toEqual({ reserved: true, persisted: false })
  expect(store.claim(a)).toEqual({ reserved: false, persisted: false })
  expect(store.read()).toBe(a)
  expect(touches).toEqual(['storage'])
})

test('잘못된 owner는 guest로 내려가지 않고 저장소 접근 없이 차단한다', () => {
  for (const value of ['', ' ', ' a', 'a ', 'a\n', 'a\u0000b', 'a\u007fb', 'x'.repeat(321), '\uD800', '\uDC00']) {
    const f = fixture(), store = createClientReportUpgradeStore(value, f.storage)
    expect(store.read()).toBeNull()
    expect(store.claim(a)).toEqual({ reserved: false, persisted: false })
    expect(f.reads).toEqual([])
    expect(f.writes).toEqual([])
  }
  const f = fixture()
  expect(createClientReportUpgradeStore('x'.repeat(320), f.storage).claim(a)).toEqual({ reserved: true, persisted: true })
})
