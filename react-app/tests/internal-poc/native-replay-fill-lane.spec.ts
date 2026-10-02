import { expect, test } from '@playwright/test'
import { createNativeReplayFillLane } from '../../src/internal-poc/native-replay-fill-lane'
import type { ChronologicalFillPage } from '../../src/internal-poc/contracts/generated/api-v0.11/types'
import fixture from './fixtures/chronological-fill-v11.json' with { type: 'json' }
import { base, utc, flush, harness } from './helpers/native-period-replay-harness'

const source = fixture.cases.find(item => item.id === 'first-complete')!.value.data
function pageAt(offset: number, total = 201, sameTime = false): ChronologicalFillPage {
  return { ...source, binding: { ...source.binding, segment: 'IS' }, offset, totalCount: total,
    eof: offset + Math.min(100, total - offset) === total,
    markers: Array.from({ length: Math.min(100, total - offset) }, (_, index) => {
      const ordinal = offset + index, ref = `evt_${String(ordinal).padStart(8, '0')}`
      return { ...source.markers[0], fillRef: ref, tradeEntryFillRef: ref, leg: 'ENTRY', side: 'BUY',
        occurredAt: utc(base + (sameTime ? 0 : ordinal)), sourceOrdinal: sameTime ? ordinal : total - ordinal - 1 }
    }),
  } as ChronologicalFillPage // Synthetic validated-reader adapter, not wire/hash evidence.
}
function setup(total = 201, sameTime = false) {
  const owner = new AbortController()
  let offset = 0, reads = 0, disposals = 0, current = true, fail = false
  let release = () => {}, gate: Promise<void> | null = null
  const lane = createNativeReplayFillLane({ attemptId: 'period-test', from: base, to: base + 240_000,
    ownerSignal: owner.signal, isCurrent: () => current,
    reader: { dispose() { disposals++ }, async readChronologicalMarkers() {
      reads++
      if (gate) await gate
      if (fail) { fail = false; throw Error('NETWORK_FAILED') }
      const page = pageAt(offset, total, sameTime)
      offset += page.markers.length
      return page
    } },
  })
  const ack = () => {
    const state = lane.getState(), next = state.frame.next!
    return lane.acknowledge({ attemptId: 'period-test', executionCount: state.consumed + 1,
      execution: { id: next.id, time: next.time, sourceOrdinal: next.sourceOrdinal } })
  }
  return { lane, owner, ack, audit: () => ({ reads, disposals }), stale: () => { current = false }, fail: () => { fail = true },
    hold: () => { gate = new Promise<void>(resolve => { release = resolve }); return () => { gate = null; release() } } }
}

test('lane은 원순번과 entry/exit쌍을 보존하고 관찰된 한 체결씩만 소비한다', async () => {
  const h = setup()
  expect(h.audit().reads).toBe(0)
  expect(h.lane.getState()).toMatchObject({ consumed: 0, frame: { through: base, eof: false, markers: [] } })
  await h.lane.start()
  const first = h.lane.getState()
  expect(first.frame.next).toMatchObject({ id: 'evt_00000000', sourceOrdinal: 200, tradeId: 'evt_00000000 / evt_exit_0001', price: 100 })
  expect(first.frame).toMatchObject({ through: base + 99, eof: false })
  await h.lane.advance()
  expect(h.audit().reads).toBe(1)
  for (let i = 0; i < 100; i++) h.ack()
  expect(h.lane.getState()).toMatchObject({ consumed: 100, needsPage: true, frame: { through: base + 99 } })
  expect(h.lane.getState().frame.next).toBeUndefined()
  expect(first.frame.next!.id).toBe('evt_00000000')
  expect(Object.isFrozen(first.frame.markers)).toBe(true)
  await h.lane.advance()
  expect(h.lane.findMarker('evt_00000099')?.sourceOrdinal).toBe(101)
  expect(h.lane.findMarker('evt_00000000')).toBeNull()
  expect(h.lane.getState().frame.next).toMatchObject({ id: 'evt_00000100', sourceOrdinal: 100 })
  for (let i = 0; i < 100; i++) h.ack()
  await h.lane.advance(); h.ack(); await h.lane.advance()
  expect(h.lane.getState()).toMatchObject({ consumed: 201, needsPage: false, frame: { eof: true, through: base + 240_000 } })
  expect(h.lane.getState().frame.markers).toHaveLength(1)
  expect(h.audit().reads).toBe(3)
  h.lane.dispose()
})

test('틀린 attempt·건너뛴 count·다른 id는 소비하지 않으며 같은 확인은 멱등이다', async () => {
  const h = setup(); await h.lane.start()
  const state = h.lane.getState(), marker = state.frame.next!
  const correct = { attemptId: 'period-test', executionCount: 1, execution: { id: marker.id, time: marker.time, sourceOrdinal: marker.sourceOrdinal } }
  for (const value of [{ ...correct, attemptId: 'other' }, { ...correct, executionCount: 2 }, { ...correct, execution: { ...correct.execution, id: 'other' } },
    { ...correct, execution: { ...correct.execution, time: marker.time + 1 } }, { ...correct, execution: { ...correct.execution, sourceOrdinal: marker.sourceOrdinal + 1 } }]) {
    expect(() => h.lane.acknowledge(value)).toThrow('NATIVE_REPLAY_FILL_ACK_INVALID')
    expect(h.lane.getState()).toBe(state)
  }
  const accepted = h.lane.acknowledge(correct)
  expect(h.lane.acknowledge(correct)).toBe(accepted)
  for (const value of [{ ...correct, executionCount: 0 }, { ...correct, execution: { ...correct.execution, id: 'other' } },
    { ...correct, execution: { ...correct.execution, sourceOrdinal: marker.sourceOrdinal + 1 } }]) {
    expect(() => h.lane.acknowledge(value)).toThrow('NATIVE_REPLAY_FILL_ACK_INVALID')
    expect(h.lane.getState()).toBe(accepted)
  }
  h.lane.dispose()
})

test('페이지 실패는 자동 재시도하지 않고 마지막 표시와 frontier를 보존한다', async () => {
  const h = setup(); await h.lane.start()
  for (let i = 0; i < 100; i++) h.ack()
  const frame = h.lane.getState().frame
  h.fail(); await h.lane.advance()
  expect(h.lane.getState()).toMatchObject({ status: 'error', failure: 'READ_FAILED', consumed: 100 })
  expect(h.lane.getState().frame).toBe(frame)
  await h.lane.advance(); expect(h.audit().reads).toBe(2)
  await h.lane.retry()
  expect(h.lane.getState()).toMatchObject({ status: 'ready', consumed: 100, frame: { next: { id: 'evt_00000100' } } })
  expect(h.audit().reads).toBe(3)
  h.lane.dispose()
})

for (const cause of ['dispose', 'owner', 'stale']) test(`pending ${cause}는 명령을 즉시 정리하고 늦은 페이지는 게시하지 않는다`, async () => {
  const h = setup(), release = h.hold()
  const pending = h.lane.start(); await flush()
  if (cause === 'dispose') h.lane.dispose()
  else if (cause === 'owner') h.owner.abort()
  else { h.stale(); h.lane.getState() }
  expect((await pending).status).toBe('disposed')
  release(); await flush()
  expect(h.lane.getState()).toMatchObject({ status: 'disposed', frame: { markers: [] } })
  expect(h.audit()).toEqual({ reads: 1, disposals: 1 })
})

test('빈 결과는 한번의 검증페이지 뒤 전체 frontier/EOF이며 불필요한 후속조회0', async () => {
  const h = setup(0); await h.lane.start(); await h.lane.advance()
  expect(h.lane.getState()).toMatchObject({ total: 0, consumed: 0, frame: { through: base + 240_000, eof: true, markers: [] } })
  expect(h.audit().reads).toBe(1); h.lane.dispose()
})

test('같은 시각의 201 체결은 페이지를 넘겨도 600ms씩 빠짐없이 controller에 전달된다', async () => {
  const h = setup(201, true), prices = harness()
  prices.controller.start(); await h.lane.start(); await flush()
  const ids = new Set<string>()
  for (let index = 0; index < 201; index++) {
    const before = h.lane.getState(), now = index * 600
    const result = prices.controller.step(now, before.frame)
    expect(result.clock.executionCount).toBe(index + 1)
    ids.add(result.clock.execution!.id)
    h.lane.acknowledge(result.clock)
    const held = prices.controller.step(now + 599, h.lane.getState().frame)
    expect(held.clock.executionCount).toBe(index + 1)
    if (h.lane.getState().needsPage) await h.lane.advance()
  }
  expect(ids.size).toBe(201); expect(h.audit().reads).toBe(3)
  prices.controller.dispose(); h.lane.dispose()
})

test('실제 lane 페이지 실패와 controller hold를 연결해 retry 성공 전까지 체결을 보존한다', async () => {
  const h = setup(201, true), prices = harness()
  prices.controller.start(); await h.lane.start(); await flush()
  for (let index = 0; index < 100; index++) {
    const step = prices.controller.step(index * 600, h.lane.getState().frame)
    h.lane.acknowledge(step.clock)
  }
  h.fail(); await h.lane.advance()
  expect(h.lane.getState().failure).toBe('READ_FAILED')
  const held = prices.controller.suspend(59_600, 'FILL_READ_FAILED')
  expect(held.clock).toMatchObject({ phase: 'paused', executionCount: 100, execution: { id: 'evt_00000099' } })
  const release = h.hold(), retry = h.lane.retry()
  await flush()
  await prices.controller.retry() // Cannot override the still-held fill read.
  expect(prices.controller.step(70_000, h.lane.getState().frame)).toBe(held)
  expect(h.audit().reads).toBe(3)
  release(); await retry
  expect(h.lane.getState()).toMatchObject({ failure: null, consumed: 100 })
  expect(prices.controller.getState()).toBe(held) // Arrival alone cannot resume.
  prices.controller.resume('FILL_READ_FAILED')
  const resumed = prices.controller.step(80_000, h.lane.getState().frame)
  expect(resumed.clock.executionCount).toBe(100)
  h.lane.acknowledge(resumed.clock)
  expect(prices.controller.step(80_399, h.lane.getState().frame).clock.executionCount).toBe(100)
  const next = prices.controller.step(80_400, h.lane.getState().frame)
  expect(next.clock.execution).toMatchObject({ id: 'evt_00000100', sourceOrdinal: 100 })
  h.lane.acknowledge(next.clock)
  expect(h.lane.getState().consumed).toBe(101)
  prices.controller.dispose(); h.lane.dispose()
})

test('주입 reader의 표시 불가 값/구간은 원페이지를 보존하고 retry로 다음 페이지를 건너뛰지 않는다', async () => {
  for (const kind of ['price', 'range']) {
    const page = pageAt(0, 1)
    // The malformed adapter value violates the SDK maxLength80. This is a
    // display-port guard test, not a claim that real wire can pass that value.
    if (kind === 'price') page.markers[0].price = '0.' + '0'.repeat(400) + '1'
    else page.markers[0].occurredAt = utc(base - 1)
    let reads = 0
    const lane = createNativeReplayFillLane({ attemptId: 'invalid-display', from: base, to: base + 1000,
      ownerSignal: new AbortController().signal, isCurrent: () => true,
      reader: { dispose() {}, async readChronologicalMarkers() { reads++; return page } } })
    await lane.start()
    expect(lane.getState()).toMatchObject({ status: 'error', consumed: 0, failure: 'DISPLAY_INVALID', frame: { markers: [] } })
    await lane.advance(); await lane.retry(); await lane.retry()
    expect(reads).toBe(1)
    expect(lane.getState().failure).toBe('DISPLAY_INVALID')
    lane.dispose()
  }
})

test('보류 중 start/advance 중복은 같은 단일 조회이며 폐기 후 추가조회0', async () => {
  const h = setup(), release = h.hold()
  const first = h.lane.start(), second = h.lane.start(), third = h.lane.advance()
  await flush(); expect(h.audit().reads).toBe(1)
  release(); await Promise.all([first, second, third])
  expect(h.lane.getState().frame.markers).toHaveLength(100)
  h.lane.dispose(); await h.lane.start(); await h.lane.advance(); await h.lane.retry()
  expect(h.audit()).toEqual({ reads: 1, disposals: 1 })
})

test('다음 페이지의 표시 구간 불일치가 현재 화면의 원마커 조회를 지우지 않는다', async () => {
  let reads = 0, disposals = 0
  // Valid chronological values for a wider reader segment, but not this
  // narrower display range. No malformed decimal or wire bypass is needed.
  const pages = [pageAt(0), pageAt(100)]
  const lane = createNativeReplayFillLane({ attemptId: 'range-mismatch', from: base, to: base + 150,
    ownerSignal: new AbortController().signal, isCurrent: () => true,
    reader: { dispose() { disposals++ }, async readChronologicalMarkers() { return pages[reads++] } } })
  await lane.start()
  for (let i = 0; i < 100; i++) {
    const next = lane.getState().frame.next!
    lane.acknowledge({ attemptId: 'range-mismatch', executionCount: i + 1, execution: next })
  }
  const before = lane.getState(), selected = lane.findMarker('evt_00000042')
  expect(selected).toBe(pages[0].markers[42])
  await lane.advance()
  expect(lane.getState()).toMatchObject({ failure: 'DISPLAY_INVALID', consumed: 100, total: 201 })
  expect(lane.getState().frame).toBe(before.frame)
  expect(lane.findMarker('evt_00000042')).toBe(selected)
  expect(lane.findMarker('evt_00000099')).toBe(pages[0].markers[99])
  expect(lane.findMarker('evt_00000100')).toBeNull()
  await lane.retry(); await lane.advance(); await lane.retry()
  expect(reads).toBe(2)
  expect(lane.getState()).toMatchObject({ failure: 'DISPLAY_INVALID', consumed: 100 })
  expect(lane.getState().frame).toBe(before.frame)
  expect(lane.findMarker('evt_00000042')).toBe(selected)
  lane.dispose()
  expect(lane.findMarker('evt_00000042')).toBeNull()
  expect(lane.findMarker('evt_00000100')).toBeNull()
  await lane.retry()
  expect(disposals).toBe(1); expect(reads).toBe(2)
})

test('실제 browser GET→원SDK→시간순 reader→lane→controller에 201개 원체결을 전달한다', async ({ page }) => {
  await page.route('**/fill-lane-test.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><body>합성 wire 결합 검사</body></html>' }))
  await page.goto('/fill-lane-test.html')
  const result = await page.evaluate(async ({ source, meta }) => {
    const lanePath = '/src/internal-poc/native-replay-fill-lane.ts', readerPath = '/src/internal-poc/native-chronological-fill-reader.ts'
    const hashPath = '/src/internal-poc/contracts/generated/api-v0.11/validator.ts', harnessPath = '/tests/internal-poc/helpers/native-period-replay-harness.ts'
    const { createNativeReplayFillLane } = await import(/* @vite-ignore */ lanePath)
    const { createNativeChronologicalFillReader } = await import(/* @vite-ignore */ readerPath)
    const { chronologicalFillPageContentHash } = await import(/* @vite-ignore */ hashPath)
    const { base, utc, flush, harness } = await import(/* @vite-ignore */ harnessPath)
    const original = window.fetch, paths: string[] = []
    window.fetch = async input => {
      const url = new URL(String(input)), offset = Number(url.searchParams.get('cursor')?.split('_')[1] ?? 0)
      paths.push(url.pathname)
      const data = { ...source, offset, totalCount: 201, eof: offset === 200,
        markers: Array.from({ length: Math.min(100, 201 - offset) }, (_, index) => {
          const ordinal = offset + index, ref = `evt_${String(ordinal).padStart(8, '0')}`
          return { ...source.markers[0], fillRef: ref, tradeEntryFillRef: ref, occurredAt: utc(base), sourceOrdinal: ordinal }
        }), ...(offset < 200 ? { nextCursor: `cursor_${String(offset + 100).padStart(17, '0')}` } : {}) }
      data.pageContentHash = await chronologicalFillPageContentHash(data)
      const response = new Response(JSON.stringify({ meta, data }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', etag: `"${data.pageContentHash}"` } })
      Object.defineProperty(response, 'url', { value: url.href }); return response
    }
    const owner = new AbortController(), prices = harness()
    const reader = createNativeChronologicalFillReader({ ownerSignal: owner.signal, isCurrent: () => true,
      manifest: { binding: source.binding, manifestContentHash: source.manifestContentHash, sourcePolicy: source.sourcePolicy,
        segmentBounds: { fromInclusive: utc(base), toExclusive: utc(prices.end) } },
      trades: { binding: source.binding, tradeManifestContentHash: source.tradeManifestContentHash,
        strategyAuthorityMapping: { approvalStrategyVersionId: source.binding.strategyVersionId } } })
    const lane = createNativeReplayFillLane({ attemptId: 'period-test', from: base, to: prices.end, ownerSignal: owner.signal,
      isCurrent: () => true, reader: { readChronologicalMarkers: () => reader.readNext(), dispose: () => reader.dispose() } })
    try {
      prices.controller.start(); await lane.start(); await flush()
      const ids = [], ordinals = []
      for (let i = 0; i < 201; i++) {
        const current = prices.controller.step(i * 600, lane.getState().frame)
        if (current.clock.executionCount !== i + 1) throw Error('EXECUTION_SKIPPED')
        ids.push(current.clock.execution.id); ordinals.push(current.clock.execution.sourceOrdinal)
        lane.acknowledge(current.clock)
        if (lane.getState().needsPage) await lane.advance()
      }
      return { ids, ordinals, paths, consumed: lane.getState().consumed, retained: lane.getState().frame.markers.length, eof: lane.getState().frame.eof }
    } finally { lane.dispose(); prices.controller.dispose(); window.fetch = original }
  }, { source, meta: fixture.cases[0].value.meta })
  expect(result.ids).toEqual(Array.from({ length: 201 }, (_, i) => `evt_${String(i).padStart(8, '0')}`))
  expect(result.ordinals).toEqual(Array.from({ length: 201 }, (_, i) => i))
  expect(result).toMatchObject({ consumed: 201, retained: 1, eof: true, paths: Array(3).fill('/api/v11/backtests/backtest_chart_0001/chronological-fill-markers') })
})
