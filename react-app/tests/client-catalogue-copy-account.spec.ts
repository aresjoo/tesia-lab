import { expect, test } from '@playwright/test'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { catalogueSourceSha, catalogueStrategies, findCatalogueStrategy } from '../src/client-catalogue'
import { catalogueCopyBinding, projectCatalogueCopy } from '../src/client-catalogue-copy'
import { createCatalogueCopyAccountController } from '../src/client-catalogue-copy-account'
import { createCatalogueCopyViewStore } from '../src/use-catalogue-copy-account'
import { catalogueCopyStorageKey, createCatalogueCopyAccount, readCatalogueCopyAccount, retryCatalogueCopyAccount, saveCatalogueCopyAccount, subscribeCatalogueCopyAccount, validateCatalogueCopyAccount, type CatalogueCopyAccount } from '../src/client-catalogue-copy-store'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import type { CataloguePreviewResult, createCataloguePreviewClient } from '../src/client-catalogue-preview'
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }
import actions from './fixtures/catalogue-copy-actions-runtime.json' with { type: 'json' }
import calculation from './fixtures/catalogue-copy-runtime.json' with { type: 'json' }

const owner = 'catalogue-account-a', data = new CatalogueMarketData(spot, futures)
const settings = { amount: 500, loss: -20 as const, existing: 'copy' as const, cap: 95 }
function fixture() {
  const values = new Map<string, string>(), writes: string[] = []
  const fault = { read: false, write: false, afterWrite: false, discard: false, corrupt: false }
  const port = {
    getItem(key: string) { if (fault.read) throw Error('private read'); return values.get(key) ?? null },
    setItem(key: string, value: string) {
      if (fault.write) throw Error('private write')
      writes.push(key)
      if (!fault.discard) values.set(key, fault.corrupt ? '{}' : value)
      if (fault.afterWrite) throw Error('private after write')
    },
  }
  return { values, writes, fault, port }
}
const sources = new Map<string, CataloguePreviewResult>()
function source(id: string) {
  if (sources.has(id)) return sources.get(id)!
  const strategy = findCatalogueStrategy(id)!
  const s: CataloguePreviewResult = { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, strategy, period: 'all', calculation: 'full-run', contextPeriod: 'selected',
    calendar: { start: spot.start, asof: spot.asof }, dataVersion: { spot: spot.v, futures: futures.v }, result: strategy.fut ? runCatalogueFuturesPreview(strategy, data) : runCatalogueSpotPreview(strategy, data) }
  sources.set(id, s); return s
}
type Client = Pick<ReturnType<typeof createCataloguePreviewClient>, 'run' | 'copy' | 'dispose'>
const engine = (): Client => ({
  run: async id => source(id), copy: async (owner, record, indices = []) => projectCatalogueCopy(record, owner, source(record.binding.strategyId), data, indices), dispose() {},
})
const started = async (id = 'd1') => {
  const f = fixture(), controller = createCatalogueCopyAccountController(owner, f.port, engine)
  expect(await controller.start({ id: 'copy-1', strategyId: id, settings, at: 1000 })).toEqual({ ok: true, id: 'copy-1' })
  return { ...f, controller }
}

async function exitedWaiting(mode: 'wait' | 'manual' = 'wait') {
  const f = await started(), state = structuredClone(f.controller.getSnapshot().state!)
  f.controller.dispose()
  const record = state.copies[0].record, value = source('d1')
  const trade = value.result.trades.find(t => t.exit !== undefined && t.exit !== null && t.exit < value.result.params.endI)!
  expect(trade).toBeDefined()
  record.startI = trade.entry; record.ledger[0].i = trade.entry; record.stopI = trade.entry
  state.copies[0].stopMode = mode
  expect(projectCatalogueCopy(record, owner, value, data).calculation.posOpen).toBe(false)
  validateCatalogueCopyAccount(state, owner)
  f.values.set(catalogueCopyStorageKey(owner), JSON.stringify(state))
  return { ...f, controller: createCatalogueCopyAccountController(owner, f.port, engine) }
}

test('청산 대기는 실제 원본 청산 관측 뒤 한 번만 정산하고 기록 재열기는 쓰지 않는다', async () => {
  const f = await exitedWaiting(), before = f.controller.getSnapshot().state!, writes = f.writes.length
  await f.controller.inspect('copy-1', new AbortController().signal)
  expect(f.writes).toHaveLength(writes)
  expect(await f.controller.reconcileWaiting(3000)).toEqual({ ok: true })
  const after = f.controller.getSnapshot().state!, entry = after.copies[0]
  expect(entry.record.status).toBe('closed'); expect(entry.record.ledger).toHaveLength(2)
  expect(entry.settlement?.at).toBe(3000)
  expect(after.spot).toBe(before.spot + entry.settlement!.back)
  expect(after.revision).toBe(before.revision + 1)
  expect(await f.controller.reconcileWaiting(4000)).toEqual({ ok: true })
  expect(f.writes).toHaveLength(writes + 1)
  expect(f.controller.getSnapshot().state).toEqual(after)
  f.controller.dispose()
})

test('직접 관리와 아직 열린 포지션은 시간이 지나도 자동 종료하거나 원장을 쓰지 않는다', async () => {
  const manual = await exitedWaiting('manual'), open = await started()
  expect(await open.controller.stop('copy-1', 'wait', 2000)).toMatchObject({ ok: true })
  for (const f of [manual, open]) {
    const before = f.controller.getSnapshot().raw, writes = f.writes.length
    expect(await f.controller.reconcileWaiting(9999999999999)).toEqual({ ok: true })
    expect(f.controller.getSnapshot().raw).toBe(before); expect(f.writes).toHaveLength(writes)
    expect(f.controller.getSnapshot().state!.copies[0].record.status).toBe('active')
    f.controller.dispose()
  }
})

test('정산 저장 실패는 잔액을 발행하지 않으며 명시 재확인 후 재관측해도 이중 회수하지 않는다', async () => {
  const f = await exitedWaiting(), before = f.controller.getSnapshot().state!
  f.fault.write = true
  expect(await f.controller.reconcileWaiting(3000)).toEqual({ ok: false, error: 'storage' })
  expect(readCatalogueCopyAccount(owner, f.port).state).toBeNull()
  f.fault.write = false; f.controller.retry()
  expect(f.controller.getSnapshot().state).toEqual(before)
  expect(await f.controller.reconcileWaiting(4000)).toEqual({ ok: true })
  const final = f.controller.getSnapshot().raw
  expect(await f.controller.reconcileWaiting(5000)).toEqual({ ok: true })
  expect(f.controller.getSnapshot().raw).toBe(final)
  f.controller.dispose()
})

test('구독 관측은 화면 재열기에 연결되고 Strict 재구독·반복 알림에도 정산은 한 번이다', async () => {
  const f = await exitedWaiting(); f.controller.dispose()
  let observations = 0
  const view = createCatalogueCopyViewStore(owner, f.port, (owner, storage) => {
    const c = createCatalogueCopyAccountController(owner, storage, engine)
    return { ...c, reconcileWaiting(...args) { observations++; return c.reconcileWaiting(...args) } }
  })
  const writes = f.writes.length
  const off = view.subscribe(() => {}); off()
  const offA = view.subscribe(() => {}), offB = view.subscribe(() => {})
  await expect.poll(() => view.getSnapshot().state?.copies[0].record.status).toBe('closed')
  expect(observations).toBe(1); expect(f.writes).toHaveLength(writes + 1)
  view.retry()
  await Promise.resolve()
  expect(observations).toBe(1); expect(f.writes).toHaveLength(writes + 1)
  offA(); offB()
})

test('Strict 재구독에서 청산되지 않은 같은 원장은 한 번만 계산하고 polling하지 않는다', async () => {
  const f = await started(); await f.controller.stop('copy-1', 'wait', 2000); f.controller.dispose()
  let observations = 0
  const view = createCatalogueCopyViewStore(owner, f.port, (owner, storage) => {
    const c = createCatalogueCopyAccountController(owner, storage, engine)
    return { ...c, reconcileWaiting(...args) { observations++; return c.reconcileWaiting(...args) } }
  })
  const before = readCatalogueCopyAccount(owner, f.port).raw, writes = f.writes.length
  const off = view.subscribe(() => {}); off()
  const offA = view.subscribe(() => {})
  await expect.poll(() => observations === 1 && !view.getSnapshot().busy).toBe(true)
  for (let i = 0; i < 20; i++) await Promise.resolve()
  expect(observations).toBe(1); expect(f.writes).toHaveLength(writes)
  expect(view.getSnapshot().raw).toBe(before)
  offA()
})

test('관측 계산 도중 계정이 폐기되거나 원장이 바뀌면 후발 정산을 저장하지 않는다', async () => {
  for (const kind of ['dispose', 'conflict', 'source'] as const) {
    const f = await exitedWaiting(); f.controller.dispose()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve }), base = engine()
    const c = createCatalogueCopyAccountController(owner, f.port, () => ({ ...base, run: async (...args) => {
      await gate
      const value = await base.run(...args)
      return kind === 'source' ? { ...value, dataVersion: { ...value.dataVersion, spot: 'other-data-generation' } } : value
    } }))
    const work = c.reconcileWaiting(3000), before = readCatalogueCopyAccount(owner, f.port).raw
    if (kind === 'dispose') c.dispose()
    if (kind === 'conflict') {
      const other = createCatalogueCopyAccountController(owner, f.port, engine)
      expect(await other.topup()).toEqual({ ok: true }); other.dispose()
    }
    const expected = readCatalogueCopyAccount(owner, f.port).raw
    release()
    expect(await work).toEqual({ ok: false, error: kind === 'dispose' ? 'cancelled' : kind === 'conflict' ? 'storage' : 'source-unavailable' })
    expect(f.values.get(catalogueCopyStorageKey(owner))).toBe(expected)
    if (kind !== 'conflict') expect(expected).toBe(before)
    c.dispose()
  }
})

test('메인·상세의 두 구독자는 같은 계정을 한 번만 정산하고 패자에게 저장 오류를 남기지 않는다', async () => {
  const f = await exitedWaiting(); f.controller.dispose()
  const factory = (name: string, storage?: typeof f.port) => createCatalogueCopyAccountController(name, storage, engine)
  const main = createCatalogueCopyViewStore(owner, f.port, factory), detail = createCatalogueCopyViewStore(owner, f.port, factory)
  const writes = f.writes.length
  const offA = main.subscribe(() => {}), offB = detail.subscribe(() => {})
  await expect.poll(() => [main, detail].every(view => view.getSnapshot().state?.copies[0].record.status === 'closed' && !view.getSnapshot().busy)).toBe(true)
  expect(f.writes).toHaveLength(writes + 1)
  expect(main.getSnapshot().error).toBeNull(); expect(detail.getSnapshot().error).toBeNull()
  expect(main.getSnapshot().raw).toBe(detail.getSnapshot().raw)
  expect(main.getSnapshot().state!.copies[0].record.ledger).toHaveLength(2)
  offA(); offB()
})

test('새 화면용 inspection은 원본 결과와 결속하고 원장을 쓰지 않는다', async () => {
  const f = await started(), raw = f.controller.getSnapshot().raw, writes = f.writes.length
  const inspected = await f.controller.inspect('copy-1', new AbortController().signal)
  expect(inspected.entry.record.owner).toBe(owner)
  expect(inspected.projection.calculation).toEqual(projectCatalogueCopy(inspected.entry.record, owner, source('d1'), data).calculation)
  expect(inspected.value.strategy.id).toBe('d1')
  expect(f.controller.getSnapshot().raw).toBe(raw)
  expect(f.writes).toHaveLength(writes)
  f.controller.dispose()
  await expect(f.controller.inspect('copy-1', new AbortController().signal)).rejects.toThrow()
})

test('31종 상세의 최근40거래는 진입시점 예산·가중치이며 요약은 추가 관측하지 않는다', async () => {
  let reachedForty = false
  for (const strategy of catalogueStrategies) {
    const f = await started(strategy.id), s = source(strategy.id), state = structuredClone(f.controller.getSnapshot().state!)
    f.controller.dispose()
    const record = state.copies[0].record, first = s.result.eq[0].i
    record.startI = first; record.ledger[0].i = first
    record.ledger.push({ at: 2000, i: first + 100, type: 'add', amount: 250 }); state.spot -= 250
    validateCatalogueCopyAccount(state, owner)
    f.values.set(catalogueCopyStorageKey(owner), JSON.stringify(state))
    const base = engine(), requests: number[][] = []
    const c = createCatalogueCopyAccountController(owner, f.port, () => ({ ...base, copy: async (...args) => { requests.push(args[2] ?? []); return base.copy(...args) } }))
    const raw = c.getSnapshot().raw, writes = f.writes.length
    expect((await c.inspect('copy-1', new AbortController().signal)).trades).toEqual([])
    expect(requests).toEqual([[]]); requests.length = 0
    const inspected = await c.inspect('copy-1', new AbortController().signal, true)
    const expected = s.result.trades.filter(t => t.entry >= first && t.exit <= s.result.params.endI).map(t => {
      const observed = projectCatalogueCopy(record, owner, s, data, [t.entry]).observations[0].value
      const invested = observed.invested * (t.w ?? 1)
      return { source: t, invested, pnl: invested * t.pnl }
    }).filter(t => t.invested > 0.005).reverse().slice(0, 40)
    expect(inspected.trades, strategy.id).toEqual(expected)
    reachedForty ||= expected.length === 40
    expect(requests.every(indices => indices.length <= 32)).toBe(true)
    expect(requests.slice(1).flat().length).toBe(new Set(requests.slice(1).flat()).size)
    expect(c.getSnapshot().raw).toBe(raw); expect(f.writes).toHaveLength(writes)
    c.dispose()
  }
  expect(reachedForty).toBe(true)
})

for (const action of ['abort', 'dispose', 'revision'] as const) test('상세 진입예산 관측 도중 ' + action + '이면 늦은 거래를 발행하지 않는다', async () => {
  const f = await started(), base = engine(), request = new AbortController()
  const state = structuredClone(f.controller.getSnapshot().state!), record = state.copies[0].record
  record.startI = source('d1').result.eq[0].i; record.ledger[0].i = record.startI
  validateCatalogueCopyAccount(state, owner)
  f.values.set(catalogueCopyStorageKey(owner), JSON.stringify(state)); f.controller.retry()
  let release!: () => void, entered!: () => void
  const gate = new Promise<void>(r => { release = r }), seen = new Promise<void>(r => { entered = r })
  const reader = createCatalogueCopyAccountController(owner, f.port, () => ({ ...base, copy: async (...args) => {
    if (args[2]?.length) { entered(); await gate }
    return base.copy(...args)
  } }))
  const off = reader.subscribe(() => {}), before = f.writes.length
  const pending = reader.inspect('copy-1', request.signal, true), rejected = expect(pending).rejects.toThrow('cancelled')
  await seen
  if (action === 'abort') request.abort()
  else if (action === 'dispose') reader.dispose()
  else expect(await f.controller.topup()).toEqual({ ok: true })
  release(); await rejected
  expect(f.writes).toHaveLength(before + (action === 'revision' ? 1 : 0))
  off(); reader.dispose(); f.controller.dispose()
})

test('화면 구독의 Strict 재연결은 controller를 재생성하고 마지막 해제에서만 폐기한다', async () => {
  const f = await started(); f.controller.dispose()
  let created = 0, disposed = 0
  const view = createCatalogueCopyViewStore(owner, f.port, (owner, storage) => {
    created++
    const controller = createCatalogueCopyAccountController(owner, storage, engine)
    return { ...controller, dispose() { disposed++; controller.dispose() } }
  })
  expect(created).toBe(0)
  const offA = view.subscribe(() => {}), offB = view.subscribe(() => {})
  expect(created).toBe(1); expect(view.getSnapshot().epoch).toBe(1)
  expect((await view.inspect('copy-1', new AbortController().signal)).entry.record.id).toBe('copy-1')
  offA(); expect(disposed).toBe(0)
  offB(); expect(disposed).toBe(1)
  await expect(view.inspect('copy-1', new AbortController().signal)).rejects.toThrow()
  const offC = view.subscribe(() => {})
  expect(created).toBe(2); expect(view.getSnapshot().epoch).toBe(2)
  expect((await view.inspect('copy-1', new AbortController().signal)).entry.record.id).toBe('copy-1')
  offC(); expect(disposed).toBe(2)
})

test('늦은 inspection은 중간에 원장이 변경되면 이전 숫자를 반환하지 않는다', async () => {
  const f = await started(), base = engine()
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const reader = createCatalogueCopyAccountController(owner, f.port, () => ({ ...base, copy: async (...args) => { await gate; return base.copy(...args) } }))
  const off = reader.subscribe(() => {})
  const pending = reader.inspect('copy-1', new AbortController().signal)
  const rejected = expect(pending).rejects.toThrow('cancelled')
  expect(await f.controller.topup()).toEqual({ ok: true })
  release(); await rejected
  off(); reader.dispose(); f.controller.dispose()
})

test('실패한 명시 재조회는 같은 owner의 모든 reader를 불확실 상태로 알린다', async () => {
  const f = await started(), other = createCatalogueCopyAccountController(owner, f.port, engine)
  const off = other.subscribe(() => {}), raw = f.controller.getSnapshot().raw!, writes = f.writes.length
  f.values.set(catalogueCopyStorageKey(owner), '{}')
  expect(retryCatalogueCopyAccount(owner, f.port).error).toBe('invalid-state')
  expect(other.getSnapshot().error).toBe('uncertain')
  expect(other.getSnapshot().state).toBeNull()
  f.values.set(catalogueCopyStorageKey(owner), raw)
  expect(readCatalogueCopyAccount(owner, f.port).error).toBe('uncertain')
  other.retry()
  expect(other.getSnapshot().error).toBeNull()
  expect(f.writes).toHaveLength(writes)
  off(); other.dispose(); f.controller.dispose()
})

test('읽기/구독은 쓰지 않고 원본 $1000은 별도 preview 키에서만 시작한다', () => {
  const f = fixture(); f.values.set('teth-copy-preview:account:' + owner, 'legacy bytes')
  expect(readCatalogueCopyAccount(owner, f.port)).toEqual({ state: createCatalogueCopyAccount(owner), error: null, raw: null })
  const unsubscribe = subscribeCatalogueCopyAccount(owner, () => {}, f.port); unsubscribe()
  expect(f.writes).toEqual([]); expect(f.values.size).toBe(1)
  for (const invalid of ['', ' x', 'a\nb', '\ud800', 'x'.repeat(321)]) expect(readCatalogueCopyAccount(invalid, f.port)).toMatchObject({ state: null, error: 'invalid-owner' })
  expect(catalogueCopyStorageKey('a/b')).not.toBe(catalogueCopyStorageKey('a%2Fb'))
})

for (const strategy of catalogueStrategies) test(`${strategy.id}: 시작·추가입금·정리·회수·한번 종료·복원`, async () => {
  const f = await started(strategy.id), c = f.controller, value = c.getSnapshot().state!, r = value.copies[0].record
  expect(value.spot).toBe(500); expect(value.revision).toBe(1); expect(r.startI).toBe(data.length - 31)
  expect(r.binding).toEqual(catalogueCopyBinding(source(strategy.id)))
  expect(await c.adjust(r.id, 100, 'add', 2000, true)).toMatchObject({ ok: true })
  expect(await c.flatten(r.id, 3000)).toMatchObject({ ok: true })
  const flatRevision = c.getSnapshot().state!.revision
  expect(await c.flatten(r.id, 3001)).toMatchObject({ ok: true }); expect(c.getSnapshot().state!.revision).toBe(flatRevision)
  const afterFlat = c.getSnapshot().state!.copies[0]
  const avail = projectCatalogueCopy(afterFlat.record, owner, source(strategy.id), data).calculation.avail
  if (avail >= 25) expect(await c.adjust(r.id, 25, 'out', 4000)).toMatchObject({ ok: true })
  expect(await c.stop(r.id, 'now', 5000)).toMatchObject({ ok: true })
  const closed = c.getSnapshot().state!, saved = f.values.get(catalogueCopyStorageKey(owner))!
  expect(closed.copies[0].record.status).toBe('closed')
  expect(closed.copies[0].record.ledger.at(-1)).toMatchObject({ type: 'out', amount: closed.copies[0].settlement!.back, i: data.length - 1 })
  expect(await c.stop(r.id, 'now', 6000)).toMatchObject({ ok: true })
  expect(f.values.get(catalogueCopyStorageKey(owner))).toBe(saved)
  expect(readCatalogueCopyAccount(owner, f.port).state).toEqual(closed)
  expect(Object.isFrozen(closed.copies[0].record.ledger[0])).toBe(true)
  c.dispose()
})

test('중복 전략·부족 예산·과대 회수·시간 역행은 원장을 변경하지 않는다', async () => {
  const f = await started(), c = f.controller, before = f.values.get(catalogueCopyStorageKey(owner))
  expect(await c.start({ id: 'second', strategyId: 'd1', settings, at: 2000 })).toEqual({ ok: false, error: 'duplicate-copy' })
  expect(await c.adjust('copy-1', 501, 'add', 2000)).toEqual({ ok: false, error: 'insufficient-funds' })
  expect(await c.adjust('copy-1', 1e12, 'out', 2000)).toEqual({ ok: false, error: 'insufficient-funds' })
  expect(await c.adjust('copy-1', 10, 'add', 999)).toEqual({ ok: false, error: 'invalid-input' })
  expect(await c.adjust('copy-1', NaN, 'out', 2000)).toEqual({ ok: false, error: 'invalid-input' })
  expect(f.values.get(catalogueCopyStorageKey(owner))).toBe(before)
  expect(await c.topup()).toEqual({ ok: true }); expect(c.getSnapshot().state!.spot).toBe(1500)
  expect(c.getSnapshot().state!.topups).toBe(1); c.dispose()
})

test('중단 wait/manual은 같은 원장에 남고 정리하면 정산을 한 번만 한다', async () => {
  for (const mode of ['wait', 'manual'] as const) {
    const f = await started(), c = f.controller
    const initial = c.getSnapshot().state!.copies[0].record
    expect(projectCatalogueCopy(initial, owner, source('d1'), data).calculation.posOpen).toBe(true)
    expect(await c.stop('copy-1', mode, 2000)).toMatchObject({ ok: true })
    expect(c.getSnapshot().state!.copies[0]).toMatchObject({ stopMode: mode, record: { status: 'active', stopI: data.length - 1 } })
    const rev = c.getSnapshot().state!.revision
    await c.stop('copy-1', mode, 2001); expect(c.getSnapshot().state!.revision).toBe(rev)
    expect(await c.flatten('copy-1', 3000)).toMatchObject({ ok: true })
    expect(c.getSnapshot().state!.copies[0].record.status).toBe('closed')
    expect(c.getSnapshot().state!.copies[0].record.ledger.filter(e => e.type === 'out')).toHaveLength(1)
    c.dispose()
  }
})

for (const mode of ['write', 'afterWrite', 'discard', 'corrupt'] as const) test(`저장 ${mode} 실패는 같은 계정 독자 모두 격리하고 재시도는 읽기만 한다`, async () => {
  const f = await started(), c = f.controller
  const second = createCatalogueCopyAccountController(owner, f.port, engine), other = createCatalogueCopyAccountController('other', f.port, engine)
  const off = second.subscribe(() => {}), otherOff = other.subscribe(() => {})
  f.fault[mode] = true
  expect(await c.topup()).toEqual({ ok: false, error: 'storage' })
  expect(c.getSnapshot().error).toBeTruthy(); expect(second.getSnapshot().error).toBe('uncertain')
  expect(other.getSnapshot().error).toBe(null)
  f.fault[mode] = false
  const count = f.writes.length
  expect(await second.topup()).toEqual({ ok: false, error: 'storage' }); expect(f.writes).toHaveLength(count)
  c.retry(); expect(f.writes).toHaveLength(count)
  if (mode === 'corrupt') expect(c.getSnapshot().error).toBe('invalid-state')
  else { expect(c.getSnapshot().error).toBe(null); expect(c.getSnapshot().state!.topups).toBe(mode === 'afterWrite' ? 1 : 0) }
  off(); otherOff(); c.dispose(); second.dispose(); other.dispose()
})

test('깨진 기록·다른 세대·중복·현금 불일치는 보존하며 빈 계좌로 숨기지 않는다', async () => {
  const f = await started(), original = structuredClone(f.controller.getSnapshot().state!), key = catalogueCopyStorageKey(owner)
  const bad: unknown[] = ['broken', { ...original, owner: 'other' }, { ...original, spot: 999 }, { ...original, copies: [...original.copies, original.copies[0]] }, { ...original, model: 'legacy' }]
  const stale = structuredClone(original); stale.copies[0].record.binding.sourceSha = 'older'; bad.push(stale)
  for (const value of bad) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value); f.values.set(key, raw)
    const result = retryCatalogueCopyAccount(owner, f.port)
    expect(result.state).toBeNull(); expect(result.error).toBe('invalid-state'); expect(f.values.get(key)).toBe(raw)
  }
  f.controller.dispose()
})

test('비동기 계산 사이 다른 변경을 덮어쓰지 않고 입력은 호출 시 고정한다', async () => {
  const f = fixture(), base = engine(); let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const a = createCatalogueCopyAccountController(owner, f.port, () => ({ ...base, run: async (...args) => { await gate; return base.run(...args) } }))
  const b = createCatalogueCopyAccountController(owner, f.port, engine)
  const input = { id: 'copy-1', strategyId: 'd1', settings: { ...settings }, at: 1000 }
  const pending = a.start(input); input.settings.amount = 999
  expect(await a.topup()).toEqual({ ok: false, error: 'busy' })
  expect(await b.topup()).toMatchObject({ ok: true }); release()
  expect(await pending).toEqual({ ok: false, error: 'storage' })
  expect(readCatalogueCopyAccount(owner, f.port).state).toMatchObject({ topups: 1, spot: 2000, copies: [] })
  a.retry(); expect(await a.start({ ...input, settings }, undefined)).toMatchObject({ ok: true })
  expect(readCatalogueCopyAccount(owner, f.port).state!.copies[0].record.settings.amount).toBe(500)
  a.dispose(); b.dispose()
})

test('취소·계정 controller 폐기는 후발 계산을 저장하지 않는다', async () => {
  for (const mode of ['abort', 'dispose'] as const) {
    const f = fixture(), base = engine(); let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let workers = 0
    const c = createCatalogueCopyAccountController(owner, f.port, () => { workers++; return { ...base, run: async (...args) => { await gate; return base.run(...args) } } })
    const abort = new AbortController(), result = c.start({ id: 'a', strategyId: 'd1', settings, at: 1 }, abort.signal)
    if (mode === 'abort') abort.abort(); else c.dispose()
    release(); expect(await result).toEqual({ ok: false, error: 'cancelled' }); expect(f.writes).toEqual([]); expect(workers).toBe(1)
    c.dispose()
  }
})

test('0원 종료 회수도 원본의 마지막 out으로 한 번만 저장한다', async () => {
  const f = fixture(), s = structuredClone(source('r1')), last = data.length - 1
  s.result.eq.forEach(p => { if (p.i >= last - 30) p.v = (last - p.i) / 30 })
  s.result.state.open = null
  const client: Client = { run: async () => s, copy: async (owner, r, indices = []) => projectCatalogueCopy(r, owner, s, data, indices), dispose() {} }
  const c = createCatalogueCopyAccountController(owner, f.port, () => client)
  expect(await c.start({ id: 'zero', strategyId: 'r1', settings, at: 1000 })).toMatchObject({ ok: true })
  expect(await c.stop('zero', 'now', 2000)).toMatchObject({ ok: true })
  expect(c.getSnapshot().state!.copies[0].settlement!.back).toBe(0)
  expect(c.getSnapshot().state!.copies[0].record.ledger.at(-1)?.amount).toBe(0)
  expect(readCatalogueCopyAccount(owner, f.port).error).toBeNull()
  const rev = c.getSnapshot().state!.revision
  await c.stop('zero', 'now', 3000); expect(c.getSnapshot().state!.revision).toBe(rev); c.dispose()
})

test('구독 전 발생한 저장도 첫 구독 시 반영하되 읽기가 저장을 만들지 않는다', async () => {
  const f = fixture(), a = createCatalogueCopyAccountController(owner, f.port, engine), b = createCatalogueCopyAccountController(owner, f.port, engine)
  await b.topup(); expect(a.getSnapshot().state!.topups).toBe(0)
  const count = f.writes.length, off = a.subscribe(() => {})
  expect(a.getSnapshot().state!.topups).toBe(1); expect(f.writes.length).toBe(count)
  off(); a.dispose(); b.dispose()
})

test('원본 cpStart→입금→수동정리→회수→cpClose의 실제 저장변경과 31종 대조', async () => {
  expect(actions.sha).toBe(catalogueSourceSha)
  expect(createHash('sha256').update(actions.code).digest('hex')).toBe(actions.codeSha256)
  for (const strategy of catalogueStrategies) {
    const s = source(strategy.id), f = fixture(), c = createCatalogueCopyAccountController(owner, f.port, engine)
    const noop = () => {}, context = vm.createContext({ now: 1000, state: {}, S: { user: true }, CPP_PAIR: {}, TF_CPS: {}, TF_CPA: {}, TF_MKF: { loss: -20, cap: 95, existing: 'copy' },
      MK_ASOF: [2026, 9, 28], PRICE0: spot.px['비트코인'], MK_STOP_L: { now: '지금 정리', wait: '원본 청산 대기', manual: '직접 관리' }, G: { mode: 'tfcpx' },
      location: { pathname: '/', search: '', hash: '#/share/c/cp1000' }, history: { replaceState: noop }, $: () => ({ value: '500' }), cpFormSync: () => true,
      tfAiGate: () => true, tfDerive: () => ({ entitlement: { follow: true } }),
      tfSSFind: () => ({ nick: strategy.id, kind: strategy.kind, asset: '비트코인', r: s.result }), cpMeta: () => ({ share: .1 }), mkPx: (k: keyof typeof spot.px) => spot.px[k],
      tfSaveNow: noop, tfTrack: noop, mkFollowClose: noop, tfShareHub: noop, tfSS3DlgClose: noop, cpDetailView: noop, toast: noop, cpUsd: String,
    })
    vm.runInContext('var Date={now:()=>now}; function tfS(){return state};\n' + calculation.code + '\n' + actions.code, context)
    context.nick = strategy.id
    vm.runInContext('cpStart(nick)', context)
    expect(await c.start({ id: 'cp1000', strategyId: strategy.id, settings, at: 1000 })).toMatchObject({ ok: true })
    vm.runInContext('now=2000;cpAdjCommit("cp1000",100,"add");now=3000;cpFlat("cp1000");', context)
    await c.adjust('cp1000', 100, 'add', 2000, true); await c.flatten('cp1000', 3000)
    const avail = vm.runInContext('cpCalc(cpFind("cp1000")).avail', context)
    if (avail >= 25) { vm.runInContext('now=4000;cpAdjCommit("cp1000",25,"out")', context); await c.adjust('cp1000', 25, 'out', 4000) }
    vm.runInContext('now=5000;cpClose("cp1000")', context); await c.stop('cp1000', 'now', 5000)
    const original = JSON.parse(vm.runInContext('JSON.stringify(cpState())', context)), account = c.getSnapshot().state!, record = account.copies[0].record
    expect(account.spot, strategy.id).toBe(original.spot)
    expect(record.ledger.map(e => ({ at: e.at, i: e.i, type: e.type, amt: e.amount }))).toEqual(original.copies[0].ledger)
    expect(record.flats).toEqual(original.copies[0].flats)
    expect(record.endI).toBe(original.copies[0].endI); expect(record.status).toBe(original.copies[0].status)
    expect(account.copies[0].settlement).toEqual({ at: 5000, ...original.copies[0].settle }); c.dispose()
  }
})

test('브라우저 sessionStorage·실제 Worker로 시작하고 새로고침 후 정산을 한 번만 복원한다', async ({ page }) => {
  await page.goto('/')
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  const first = await page.evaluate(async () => {
    const path = '/src/client-catalogue-copy-account.ts', { createCatalogueCopyAccountController } = await import(path)
    const c = createCatalogueCopyAccountController('browser-preview')
    try {
      const result = await c.start({ id: 'browser-copy', strategyId: 'd1', settings: { amount: 500, loss: -20, existing: 'copy', cap: 95 }, at: 1000 })
      return { result, state: c.getSnapshot().state }
    } finally { c.dispose() }
  })
  expect(first.result).toMatchObject({ ok: true }); expect(first.state?.spot).toBe(500)
  await page.reload()
  const second = await page.evaluate(async () => {
    const path = '/src/client-catalogue-copy-account.ts', { createCatalogueCopyAccountController } = await import(path)
    const c = createCatalogueCopyAccountController('browser-preview')
    try {
      const restored = c.getSnapshot().state, closed = await c.stop('browser-copy', 'now', 2000), before = c.getSnapshot().state
      const twice = await c.stop('browser-copy', 'now', 3000)
      return { restored, closed, twice, before, after: c.getSnapshot().state }
    } finally { c.dispose() }
  })
  expect(second.restored).toEqual(first.state); expect(second.closed).toMatchObject({ ok: true }); expect(second.twice).toMatchObject({ ok: true })
  expect(second.after).toEqual(second.before); expect(second.after?.copies[0].record.status).toBe('closed'); expect(errors).toEqual([])
})

test('수신자 예외는 저장 성공을 실패로 바꾸지 않고 낡은 read 토큰은 거절한다', () => {
  const f = fixture(), before = readCatalogueCopyAccount(owner, f.port), next = structuredClone(before.state!) as CatalogueCopyAccount
  next.topups = 1; next.spot = 2000; next.revision = 1
  const off = subscribeCatalogueCopyAccount(owner, () => { throw Error('view failure') }, f.port)
  expect(saveCatalogueCopyAccount(next, before, f.port)).toEqual({ ok: true })
  expect(saveCatalogueCopyAccount(next, before, f.port)).toEqual({ ok: false, error: 'conflict' })
  expect(validateCatalogueCopyAccount(next, owner)).toEqual(next); off()
})

test('저장 경계는 기존 복사 삭제·과거 입금 재작성·revision 위조를 거절한다', async () => {
  for (const mode of ['remove', 'rewrite', 'revision'] as const) {
    const f = await started(), before = readCatalogueCopyAccount(owner, f.port)
    const next: CatalogueCopyAccount = structuredClone(before.state!)
    next.revision++
    if (mode === 'remove') { next.copies = []; next.spot = 1000 }
    if (mode === 'rewrite') { next.copies[0].record.ledger[0].amount = 600; next.copies[0].record.settings.amount = 600; next.spot = 400 }
    const expected = mode === 'revision' ? { ...before, state: { ...before.state!, revision: 99 } } : before
    if (mode === 'revision') next.revision = 100
    const bytes = f.values.get(catalogueCopyStorageKey(owner))
    expect(saveCatalogueCopyAccount(next, expected, f.port).ok).toBe(false)
    expect(f.values.get(catalogueCopyStorageKey(owner))).toBe(bytes)
    f.controller.dispose()
  }
})
