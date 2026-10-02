import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test } from '@playwright/test'
import ts from 'typescript'
import { copyPreviewStorageKey, copyPreviewStoreErrorMessage, readCopyPreviewState, saveCopyPreviewState } from '../src/client-copy-preview-store'
import {
  adjustCopyPreview, calculateCopyPreview, closeCopyPreview, copyPreviewConfig, copyPreviewPairs,
  createCopyPreviewState, flattenCopyPreview, startCopyPreview, type CopyPreviewActionResult, type CopyPreviewState,
} from '../src/client-copy-preview-state'
import { sourceSharedStrategies } from '../src/client-shared-strategies'

const owner = 'account-a'
function storageFixture() {
  const data = new Map<string, string>(), writes: string[] = [], reads: string[] = []
  const fail = { read: false, write: false, discardWrite: false, corruptWrite: false }
  return { data, writes, reads, fail, port: {
    getItem(key: string) { reads.push(key); if (fail.read) throw new Error('read'); return data.get(key) ?? null },
    setItem(key: string, value: string) {
      if (fail.write) throw new Error('write')
      writes.push(key)
      if (!fail.discardWrite) data.set(key, fail.corruptWrite ? '{}' : value)
    },
  } }
}
const source = sourceSharedStrategies()[0]
const controlled = { ...source, result: { ...source.result,
  eq: Array.from({ length: 32 }, (_, i) => ({ i: 100 + i, v: 1 + i * .01 })),
  trades: [{ entry: 110, exit: 130, pnl: .01, kind: 'time' as const, lowVol: false }],
} }
function success(result: CopyPreviewActionResult): CopyPreviewState {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.error)
  return result.state
}
function active(): CopyPreviewState {
  return success(startCopyPreview(createCopyPreviewState(owner), { owner, id: 'copy-1', at: 1000, mode: 'ratio', amount: 100, pairs: copyPreviewPairs(controlled) }, controlled))
}
function flat(): CopyPreviewState {
  return success(flattenCopyPreview(active(), { owner, id: 'copy-1', at: 2000 }, controlled))
}
function closed(flatFirst = false): CopyPreviewState {
  return success(closeCopyPreview(flatFirst ? flat() : active(), { owner, id: 'copy-1', at: 3000 }, controlled))
}
// Frozen legacy-v1 arithmetic, deliberately independent of the current engine.
function legacyClosed(): CopyPreviewState {
  const state = closed(), copy = state.copies[0], d = copy.settle!
  delete copy.realizedBasis
  const realized = copy.amount * copy.closedTrades!.reduce((sum, trade) => sum + trade.pnl, 0)
  const share = Math.max(0, realized) * .1, net = d.total - share, est = d.inv + net, back = Math.max(0, est)
  state.spot += back - d.back
  copy.settle = { ...d, realized, unreal: d.total - realized, share, net, est, back }
  copy.ledger.at(-1)!.amt = back
  return state
}
function saved(state = active()) {
  const f = storageFixture()
  expect(saveCopyPreviewState(state, f.port)).toEqual({ ok: true, error: null })
  return f
}

test('없는 현재 계정만 새 preview를 반환하며 읽기만으로 저장하거나 다른 키를 조회하지 않는다', () => {
  const f = storageFixture()
  expect(readCopyPreviewState(owner, f.port)).toEqual({ state: createCopyPreviewState(owner), error: null })
  expect(f.reads).toEqual([copyPreviewStorageKey(owner)])
  expect(f.writes).toEqual([])
  for (const value of [null, '', ' leading', 'line\nbreak', 'a'.repeat(321), '\ud800']) {
    const readCount = f.reads.length
    expect(readCopyPreviewState(value, f.port)).toEqual({ state: null, error: value === null ? 'owner-required' : 'invalid-owner' })
    expect(f.reads).toHaveLength(readCount)
  }
})

test('계정 key는 인코딩 충돌 없이 분리되고 다른 owner payload는 배출하지 않는다', () => {
  const f = storageFixture()
  for (const name of ['a/b', 'a%2Fb', '한글', '계정@example.test']) {
    const state = createCopyPreviewState(name)
    expect(saveCopyPreviewState(state, f.port).ok).toBe(true)
    expect(readCopyPreviewState(name, f.port)).toEqual({ state, error: null })
  }
  expect(f.data.size).toBe(4)
  expect(copyPreviewStorageKey('a/b')).toBe('teth-copy-preview:account:a%2Fb')
  f.data.set(copyPreviewStorageKey(owner), JSON.stringify({ ...active(), owner: 'someone-else' }))
  expect(readCopyPreviewState(owner, f.port)).toEqual({ state: createCopyPreviewState(owner), error: 'owner-mismatch' })
  expect(() => copyPreviewStorageKey('')).toThrow(RangeError)
})

test('active·flat·closed와 종료 거래 snapshot은 저장복원 후 계산이 동일하다', () => {
  for (const state of [active(), flat(), closed(), closed(true)]) {
    const before = JSON.stringify(state), f = saved(state)
    const result = readCopyPreviewState(owner, f.port)
    expect(result).toEqual({ state, error: null })
    expect(calculateCopyPreview(result.state!.copies[0], controlled)).toEqual(calculateCopyPreview(state.copies[0], controlled))
    if (state.copies[0].status === 'closed') expect(calculateCopyPreview(result.state!.copies[0], null)).toEqual(state.copies[0].settle)
    result.state!.copies[0].pairs[0] = 'changed'
    expect(JSON.stringify(state)).toBe(before)
    expect(readCopyPreviewState(owner, f.port).state).toEqual(state)
  }
})

test('legacy v1 active는 최신 계산을 사용하되 legacy flat·closed 고정값과 저장 원문은 읽기 불변이다', () => {
  const legacyWithoutTrades = legacyClosed()
  delete legacyWithoutTrades.copies[0].closedTrades
  for (const state of [active(), flat(), legacyClosed(), legacyWithoutTrades, closed(true)]) {
    const copy = state.copies[0]
    expect(copy).not.toHaveProperty('realizedBasis')
    const f = storageFixture(), key = copyPreviewStorageKey(owner), raw = JSON.stringify(state, null, 2) + '\n'
    f.data.set(key, raw)
    const restored = readCopyPreviewState(owner, f.port)
    expect(restored).toEqual({ state, error: null })
    expect(f.data.get(key)).toBe(raw)
    expect(f.writes).toEqual([])
    if (copy.status === 'closed') {
      expect(calculateCopyPreview(restored.state!.copies[0], null)).toEqual(copy.settle)
      expect(calculateCopyPreview(restored.state!.copies[0], controlled)).toEqual(copy.settle)
    } else if (copy.flatSnapshot) expect(calculateCopyPreview(restored.state!.copies[0], null)).toEqual(copy.flatSnapshot)
    else expect(calculateCopyPreview(restored.state!.copies[0], controlled)?.realized).toBeCloseTo(100 * (1.3 / 1.01 - 1))
  }
  const legacy = legacyClosed(), f = saved(legacy)
  legacy.copies[0].closedTrades![0].pnl += .1
  const raw = JSON.stringify(legacy)
  f.data.set(copyPreviewStorageKey(owner), raw)
  expect(readCopyPreviewState(owner, f.port).error).toBe('invalid-state')
  expect(f.data.get(copyPreviewStorageKey(owner))).toBe(raw)
})

test('거래 내역이 없는 legacy flat은 원본 소실·변경에도 과거 이력을 발명하지 않고 고정 정산으로 종료·복원한다', () => {
  const changed = { ...controlled, result: { ...controlled.result,
    trades: [{ ...controlled.result.trades[0], pnl: .7 }],
  } }
  for (const input of [null, { ...controlled, nick: 'other-trader' }, controlled, changed]) {
    const original = flat()
    delete original.copies[0].flatTrades
    const snapshot = structuredClone(original.copies[0].flatSnapshot!)
    const f = saved(original), before = JSON.stringify(original)
    const restored = readCopyPreviewState(owner, f.port).state!
    const ended = success(closeCopyPreview(restored, { owner, id: 'copy-1', at: 3000 }, input))
    expect(ended.copies[0]).not.toHaveProperty('closedTrades')
    expect(ended.copies[0]).not.toHaveProperty('realizedBasis')
    expect(ended.copies[0].settle).toEqual({ ...snapshot, posOpen: false, avail: 0, back: Math.max(0, snapshot.est) })
    expect(ended.spot).toBeCloseTo(original.spot + Math.max(0, snapshot.est))
    expect(saveCopyPreviewState(ended, f.port)).toEqual({ ok: true, error: null })
    expect(readCopyPreviewState(owner, f.port)).toEqual({ state: ended, error: null })
    expect(JSON.stringify(original)).toBe(before)
  }
})

test('청산 시점이 관측 범위 밖인 nonflat은 불완전 거래 snapshot으로 종료하지 않는다', () => {
  const state = active(), before = JSON.stringify(state)
  const future = { ...controlled, result: { ...controlled.result,
    trades: [{ ...controlled.result.trades[0], exit: 132 }],
  } }
  expect(closeCopyPreview(state, { owner, id: 'copy-1', at: 3000 }, future)).toMatchObject({ ok: false, state, error: 'source-unavailable' })
  expect(JSON.stringify(state)).toBe(before)
})

test('모든 실제 공유 seed는 최신 nonflat 종료 basis와 거래 snapshot을 함께 저장복원한다', () => {
  for (const seed of sourceSharedStrategies()) {
    const state = success(startCopyPreview(createCopyPreviewState(owner), { owner, id: 'seed', at: 1000, mode: 'ratio', amount: 200, pairs: [copyPreviewPairs(seed)[0]] }, seed))
    const d = calculateCopyPreview(state.copies[0], seed)!
    const ended = success(closeCopyPreview(state, { owner, id: 'seed', at: 2000 }, seed)), f = saved(ended)
    expect(readCopyPreviewState(owner, f.port)).toEqual({ state: ended, error: null })
    expect(ended.copies[0].settle!.realized, seed.nick).toBe(d.realized)
    expect(ended.copies[0].closedTrades, seed.nick).toHaveLength(d.closedN)
    expect(ended.copies[0].realizedBasis?.model).toBe('equity-last-close-v1')
  }
})

test('새 nonflat 종료 basis는 유한 양수 equity와 거래수·원장·정산 대수식을 모두 검증한다', () => {
  expect(closed().copies[0].realizedBasis).toEqual({ model: 'equity-last-close-v1', startEquity: 1.01, lastClosedEquity: 1.3, lastClosedIndex: 130 })
  const changes: ((state: CopyPreviewState) => void)[] = [
    state => { Reflect.set(state.copies[0], 'realizedBasis', null) },
    state => { Reflect.set(state.copies[0].realizedBasis!, 'model', 'unknown') },
    state => { Reflect.set(state.copies[0].realizedBasis!, 'authority', true) },
    state => { delete state.copies[0].realizedBasis }, // Cannot relabel new arithmetic as old sum.
    state => { state.copies[0].realizedBasis!.startEquity = 0 },
    state => { state.copies[0].realizedBasis!.startEquity = -1 },
    state => { state.copies[0].realizedBasis!.startEquity = NaN },
    state => { state.copies[0].realizedBasis!.startEquity = Infinity },
    state => { state.copies[0].realizedBasis!.startEquity += .1 },
    state => { state.copies[0].realizedBasis!.lastClosedEquity = null },
    state => { state.copies[0].realizedBasis!.lastClosedEquity = 0 },
    state => { state.copies[0].realizedBasis!.lastClosedEquity = Infinity },
    state => { state.copies[0].realizedBasis!.lastClosedEquity = 1.5 },
    state => { Reflect.deleteProperty(state.copies[0].realizedBasis!, 'lastClosedIndex') },
    state => { state.copies[0].realizedBasis!.lastClosedIndex = null },
    state => { state.copies[0].realizedBasis!.lastClosedIndex = 129 },
    state => { state.copies[0].realizedBasis!.lastClosedIndex = Infinity },
    state => { delete state.copies[0].closedTrades },
    state => { state.copies[0].closedTrades = [] },
    state => { state.copies[0].closedTrades![0].pnl = Infinity },
    state => { state.copies[0].closedTrades![0].exit = 1 },
    state => { state.copies[0].settle!.closedN += 1 },
    state => { state.copies[0].settle!.share += 1 },
    state => { state.copies[0].settle!.inv += 1 },
    state => { state.copies[0].ledger.at(-1)!.amt += 1 },
  ]
  for (const change of changes) {
    const state = closed(); change(state)
    const f = storageFixture(), key = copyPreviewStorageKey(owner), raw = JSON.stringify(state)
    f.data.set(key, raw)
    expect(saveCopyPreviewState(state, f.port), String(change)).toEqual({ ok: false, error: 'invalid-state' })
    expect(readCopyPreviewState(owner, f.port).error, String(change)).toBe('invalid-state')
    expect(f.data.get(key)).toBe(raw)
    expect(f.writes).toEqual([])
  }
  for (const state of [active(), flat(), closed(true)]) {
    state.copies[0].realizedBasis = { model: 'equity-last-close-v1', startEquity: 1, lastClosedEquity: 1, lastClosedIndex: 130 }
    expect(saveCopyPreviewState(state, storageFixture().port).ok).toBe(false)
  }
})

test('무거래 종료의 null basis만 허용하고 200 USDT -2 equity 정산을 trade 합0과 구별한다', () => {
  const losing = { ...controlled, result: { ...controlled.result,
    eq: Array.from({ length: 32 }, (_, i) => ({ i, v: i === 20 ? 1.1 : i === 31 ? .99 : 1 })),
    trades: [{ entry: 2, exit: 20, pnl: .1, kind: 'tp' as const, lowVol: false },
      { entry: 21, exit: 31, pnl: -.1, kind: 'sl' as const, lowVol: false }],
  } }
  for (const input of [losing, { ...losing, result: { ...losing.result, trades: [] } }]) {
    const start = success(startCopyPreview(createCopyPreviewState(owner), { owner, id: 'copy-1', at: 1000, mode: 'ratio', amount: 200, pairs: copyPreviewPairs(input) }, input))
    const state = success(closeCopyPreview(start, { owner, id: 'copy-1', at: 2000 }, input)), copy = state.copies[0], f = saved(state)
    expect(copy.settle!.realized).toBeCloseTo(input.result.trades.length ? -2 : 0)
    expect(copy.realizedBasis?.lastClosedEquity).toBe(input.result.trades.length ? .99 : null)
    expect(readCopyPreviewState(owner, f.port)).toEqual({ state, error: null })
    if (!input.result.trades.length) {
      copy.realizedBasis!.lastClosedEquity = 1
      expect(saveCopyPreviewState(state, f.port).ok).toBe(false)
    }
  }
})

test('flat 이후 원장 입출금은 현재 inv만 바꾸고 고정 손익 snapshot은 보존한다', () => {
  const original = flat(), snapshot = structuredClone(original.copies[0].flatSnapshot)
  let state = success(adjustCopyPreview(original, { owner, id: 'copy-1', at: 2200, direction: 'add', amount: 50 }, controlled))
  state = success(adjustCopyPreview(state, { owner, id: 'copy-1', at: 2300, direction: 'out', amount: 10 }, controlled))
  expect(state.copies[0].flatSnapshot).toEqual(snapshot)
  expect(calculateCopyPreview(state.copies[0], null)?.inv).toBe(140)
  const f = saved(state)
  expect(readCopyPreviewState(owner, f.port)).toEqual({ state, error: null })
  const ended = success(closeCopyPreview(state, { owner, id: 'copy-1', at: 2400 }, null))
  expect(ended.copies[0].settle?.inv).toBe(140)
  expect(saveCopyPreviewState(ended, f.port).ok).toBe(true)
  expect(readCopyPreviewState(owner, f.port).state).toEqual(ended)
})

test('JSON 손상·잘못된 version·초과 shape와 수량은 원 bytes를 보존하고 새 상태+오류로 복원한다', () => {
  const f = storageFixture(), key = copyPreviewStorageKey(owner)
  const oversized = ' '.repeat(2_000_001)
  for (const raw of ['{broken', 'null', '[]', oversized, JSON.stringify({ ...active(), v: 2 }),
    JSON.stringify({ ...active(), injectedAuthority: true }), JSON.stringify({ ...active(), copies: Array.from({ length: 101 }, () => active().copies[0]) })]) {
    f.data.set(key, raw)
    const result = readCopyPreviewState(owner, f.port)
    expect(result.state).toEqual(createCopyPreviewState(owner))
    expect(result.error).toBe('invalid-state')
    expect(f.data.get(key)).toBe(raw)
  }
  expect(f.writes).toEqual([])
})

test('복원과 저장은 비유한 수치·ID 중복·활성nick중복·불가능한 원장·고급설정을 거절한다', () => {
  const changes: ((state: CopyPreviewState) => void)[] = [
    state => { state.spot = NaN }, state => { state.spot = Infinity }, state => { state.spot = -1 },
    state => { state.copies[0].amount = Infinity }, state => { state.copies[0].amount = 49 },
    state => { state.copies[0].at = -1 }, state => { state.copies[0].simStartI = .5 },
    state => { state.copies[0].ledger[0].amt = 101 }, state => { state.copies[0].ledger[0].at = 999 },
    state => { state.copies[0].ledger.push({ at: 999, type: 'out', amt: 1 }) },
    state => { state.copies[0].ledger.push({ at: 1001, type: 'add', amt: 0 }) },
    state => { state.copies[0].ledger.push({ at: 1001, type: 'add', amt: Infinity }) },
    state => { state.copies[0].ledger = Array.from({ length: 1001 }, () => state.copies[0].ledger[0]) },
    state => { state.copies[0].id = '' }, state => { state.copies.push(structuredClone(state.copies[0])) },
    state => { state.copies.push({ ...structuredClone(state.copies[0]), id: 'copy-2' }) },
    state => { state.copies[0].pairs = [] }, state => { state.copies[0].pairs = ['BTC', 'BTC'] },
    state => { Reflect.set(state.copies[0].adv, 'lev', 50) },
    state => { Reflect.set(state.copies[0], 'mode', 'service') },
    state => { Reflect.set(state.copies[0], 'accessToken', 'not-a-real-token') },
  ]
  for (const change of changes) {
    const state = active(); change(state)
    const f = storageFixture()
    expect(saveCopyPreviewState(state, f.port), String(change)).toEqual({ ok: false, error: 'invalid-state' })
    expect(f.writes).toEqual([])
    f.data.set(copyPreviewStorageKey(owner), JSON.stringify(state))
    expect(readCopyPreviewState(owner, f.port)).toEqual({ state: createCopyPreviewState(owner), error: 'invalid-state' })
  }
})

test('flat/종료 flags·snapshot 대수식·종료원장·거래snapshot 불일치는 복원하지 않는다', () => {
  const changes: ((state: CopyPreviewState) => void)[] = [
    state => { state.copies[0].status = 'active' }, state => { delete state.copies[0].settle },
    state => { state.copies[0].closedAt = 2000 }, state => { state.copies[0].settle!.back += 1 },
    state => { state.copies[0].settle!.inv += 1 }, state => { state.copies[0].settle!.posOpen = true },
    state => { state.copies[0].settle!.avail = 1 }, state => { state.copies[0].settle!.share += 1 },
    state => { state.copies[0].settle!.closedN = .5 }, state => { state.copies[0].settle!.total = NaN },
    state => { state.copies[0].ledger.at(-1)!.amt += 1 },
    state => { delete state.copies[0].flatSnapshot }, state => { delete state.copies[0].flatI },
    state => { state.copies[0].flatSnapshot!.unreal = 1 },
    state => { state.copies[0].flatSnapshot!.pnlPct += 1 },
    state => { state.copies[0].flatTrades![0].pnl = Infinity },
    state => { state.copies[0].flatTrades![0].exit = 999 },
    state => { state.copies[0].closedTrades = [] },
  ]
  for (const change of changes) {
    const state = closed(true); change(state)
    const f = storageFixture()
    expect(saveCopyPreviewState(state, f.port), String(change)).toEqual({ ok: false, error: 'invalid-state' })
    f.data.set(copyPreviewStorageKey(owner), JSON.stringify(state))
    expect(readCopyPreviewState(owner, f.port).error, String(change)).toBe('invalid-state')
    expect(f.writes).toEqual([])
  }
})

test('0원 종료환급은 허용하지만 활성 0원 ledger는 거절한다', () => {
  const state = active(), copy = state.copies[0]
  copy.status = 'closed'; copy.closedAt = 2000
  copy.settle = { inv: 100, pnlPct: -1, total: -100, realized: 0, unreal: -100, share: 0, net: -100, est: 0, avail: 0, posOpen: false, closedN: 0, back: 0 }
  copy.closedTrades = []; copy.ledger.push({ at: 2000, type: 'out', amt: 0 })
  const f = saved(state)
  expect(readCopyPreviewState(owner, f.port)).toEqual({ state, error: null })
})

test('read/write 예외와 무시된 쓰기·다른bytes·readback 예외를 구분한다', () => {
  const state = active(), f = saved(state), key = copyPreviewStorageKey(owner), bytes = f.data.get(key)
  f.fail.read = true
  expect(readCopyPreviewState(owner, f.port)).toEqual({ state: createCopyPreviewState(owner), error: 'read-failed' })
  expect(saveCopyPreviewState(state, f.port)).toEqual({ ok: false, error: 'readback-failed' })
  f.fail.read = false; f.fail.write = true
  expect(saveCopyPreviewState(state, f.port)).toEqual({ ok: false, error: 'write-failed' })
  expect(f.data.get(key)).toBe(bytes)
  f.fail.write = false; f.fail.discardWrite = true
  expect(saveCopyPreviewState({ ...state, spot: 899 }, f.port)).toEqual({ ok: false, error: 'readback-failed' })
  expect(f.data.get(key)).toBe(bytes)
  f.fail.discardWrite = false; f.fail.corruptWrite = true
  expect(saveCopyPreviewState(state, f.port)).toEqual({ ok: false, error: 'readback-failed' })
  expect(copyPreviewStoreErrorMessage('readback-failed')).toContain('다시 불러와')
})

test('sessionStorage getter 예외는 storage-unavailable이고 명시 port는 전역과 시계·network를 사용하지 않는다', () => {
  const exports: Record<string, typeof readCopyPreviewState & typeof saveCopyPreviewState> = {}, touches: string[] = []
  const forbidden = (name: string) => () => { touches.push(name); throw new Error(name) }
  const context = { exports, require: () => ({ createCopyPreviewState, copyPreviewConfig }),
    fetch: forbidden('fetch'), setTimeout: forbidden('setTimeout'), setInterval: forbidden('setInterval'), Date: forbidden('Date') }
  for (const name of ['window', 'document', 'localStorage', 'sessionStorage']) Object.defineProperty(context, name, { get: forbidden(name) })
  const compiled = ts.transpileModule(readFileSync('src/client-copy-preview-store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(compiled, context, { timeout: 1000 })
  expect(touches).toEqual([])
  const f = storageFixture()
  expect(exports.readCopyPreviewState(null, f.port)).toEqual({ state: null, error: 'owner-required' })
  expect(exports.saveCopyPreviewState(active(), f.port)).toEqual({ ok: true, error: null })
  expect(exports.readCopyPreviewState(owner, f.port).error).toBeNull()
  expect(touches).toEqual([])
  expect(exports.readCopyPreviewState(owner).error).toBe('storage-unavailable')
  expect(exports.saveCopyPreviewState(active()).error).toBe('storage-unavailable')
  expect(touches).toEqual(['sessionStorage', 'sessionStorage'])
})
