import { expect, test } from '@playwright/test'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import { createNativeReplayPriceWindows, type NativeReplayPriceIdentity, type NativeReplayPriceWindowsState } from '../../src/internal-poc/native-replay-price-windows'
import type { NativeReplayChartReader } from '../../src/internal-poc/native-replay-chart-reader'
import type { NativeChartManifest, NativeChartWindow, NativeChartWindowSelection } from '../../src/internal-poc/native-service-api'

// Pure controller tests, not SDK validation, a real 730-day dataset, or renderer
// completion evidence. All synthetic windows below are supplied by this reader.
type WindowResult = Awaited<ReturnType<NativeReplayChartReader['readWindow']>>
const source = fixtures.sources[0].fixture as unknown as {
  binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']
  manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>
  window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'>
}
const base = Date.parse('2024-01-01T00:00:00Z') / 1000
const utc = (seconds: number) => new Date(seconds * 1000).toISOString().replace('.000Z', 'Z')
const deferred = () => {
  let resolve = () => {}
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

function harness(minutes = 4_000, transform?: (result: WindowResult, index: number) => void) {
  const availableRange = { fromInclusive: utc(base), toExclusive: utc(base + minutes * 60) }
  const identity: NativeReplayPriceIdentity = { seriesId: 'contract-1m', resolution: '1m', expectedManifestContentHash: source.manifest.manifestContentHash, availableRange: { ...availableRange } }
  const suppliedIdentity = structuredClone(identity)
  const calls: NativeChartWindowSelection[] = []
  const owner = new AbortController()
  let currentOwner = true, active = 0, maximumActive = 0, disposals = 0, markerCalls = 0
  let held: { from: string; entered: ReturnType<typeof deferred>; release: ReturnType<typeof deferred> } | undefined
  let failureAt: string | undefined
  let failureCode = 'PRIVATE_UPSTREAM_FAILURE_NOT_FOR_DISPLAY'
  const make = (selection: NativeChartWindowSelection): WindowResult => {
    const from = Date.parse(selection.fromInclusive!) / 1000
    const to = Math.min(base + minutes * 60, from + 60_000)
    const requestedRange = { fromInclusive: utc(from), toExclusive: utc(to) }
    const manifest: NativeChartManifest = { ...structuredClone(source.manifest), binding: structuredClone(source.binding), sourcePolicy: structuredClone(source.sourcePolicy),
      segmentBounds: { ...availableRange }, series: [{ ...structuredClone(source.manifest.series[0]), availableRange: { ...availableRange } }] }
    const window: NativeChartWindow = { ...structuredClone(source.window), binding: structuredClone(source.binding), sourcePolicy: structuredClone(source.sourcePolicy),
      manifestContentHash: suppliedIdentity.expectedManifestContentHash, seriesId: suppliedIdentity.seriesId, resolution: suppliedIdentity.resolution,
      requestedRange, bars: [], coverage: { status: 'UNAVAILABLE', coveredRanges: [], missingRanges: [{ ...requestedRange }] },
      windowContentHash: String((from - base) / 60 + 1).padStart(64, '0') }
    const value: WindowResult = { manifest, window, view: { identity: window.windowContentHash, market: manifest.symbol, resolutionSeconds: 60,
      pricePrecision: 8, sourceLabel: 'SYNTHETIC_UI_FIXTURE · UNAVAILABLE', bars: [], fills: [] }, navigation: {
      availableRange: { ...availableRange }, supportedResolutions: ['1m'],
      previousFromInclusive: from === base ? null : utc(Math.max(base, from - 60_000)), nextFromInclusive: to < base + minutes * 60 ? utc(to) : null,
    } }
    transform?.(value, (from - base) / 60_000)
    return value
  }
  const reader = {
    async readWindow(selection: NativeChartWindowSelection = {}) {
      calls.push({ ...selection }); active++; maximumActive = Math.max(maximumActive, active)
      try {
        if (held?.from === selection.fromInclusive) { const hold = held; hold.entered.resolve(); await hold.release.promise }
        if (failureAt === selection.fromInclusive) { failureAt = undefined; throw new Error(failureCode) }
        return make(selection)
      } finally { active-- }
    },
    async readMarkers() { markerCalls++; throw new Error('MARKERS_MUST_NOT_BE_READ') },
    dispose() { disposals++ },
  }
  const controller = createNativeReplayPriceWindows({ reader, identity, ownerSignal: owner.signal, isCurrent: () => currentOwner })
  return { controller, reader, identity, calls, owner,
    audit: () => ({ active, maximumActive, disposals, markerCalls }),
    changeOwner: () => { currentOwner = false },
    failNext(from: string, code = 'PRIVATE_UPSTREAM_FAILURE_NOT_FOR_DISPLAY') { failureAt = from; failureCode = code },
    hold(from: string) { const value = { from, entered: deferred(), release: deferred() }; held = value; return value },
  }
}

test('730일 1052창은 명령마다 한 창만 순차 승격하며 두 슬롯·요청 하나를 유지한다', async () => {
  const h = harness(730 * 24 * 60)
  let maxSlots = 0, observations = 0, lastStart: string | null = null
  const unsubscribe = h.controller.subscribe(state => {
    maxSlots = Math.max(maxSlots, Number(Boolean(state.current)) + Number(Boolean(state.next)))
    const from = state.current?.window.requestedRange.fromInclusive ?? null
    if (from && from !== lastStart) { observations++; lastStart = from }
  })
  try {
    await h.controller.start()
    expect(h.calls).toHaveLength(2)
    const target = base + 730 * 24 * 60 * 60
    for (let index = 1; index < 1052; index++) {
      const state = await h.controller.advanceTo(target)
      expect(state.current?.window.requestedRange.fromInclusive).toBe(utc(base + index * 60_000))
      expect(h.calls.length).toBe(Math.min(index + 2, 1052))
      expect(state.priceQueryEof).toBe(index === 1051)
    }
    expect(h.controller.getState().current?.window.requestedRange.toExclusive).toBe(utc(target))
    expect(h.controller.getState().current?.view.bars).toEqual([])
    expect(observations).toBe(1052)
    expect(maxSlots).toBe(2)
    expect(h.audit()).toMatchObject({ maximumActive: 1, markerCalls: 0 })
    await h.controller.advanceTo(target + 100_000)
    expect(h.calls).toHaveLength(1052)
  } finally { unsubscribe(); h.controller.dispose() }
})

test('미리읽기 대기 중 현재창을 보존하고 큰 시간 이동의 늦은 응답은 자동 승격·추가 조회하지 않는다', async () => {
  const h = harness(), held = h.hold(utc(base + 60_000))
  const starting = h.controller.start()
  await held.entered.promise
  const first = h.controller.getState().current
  const advancing = h.controller.advanceTo(base + 240_000)
  expect(h.controller.getState()).toMatchObject({ status: 'waiting', current: first, next: null, waitingAt: utc(base + 60_000) })
  expect(h.calls).toHaveLength(2)
  held.release.resolve()
  await Promise.all([starting, advancing])
  expect(h.controller.getState().current).toBe(first)
  expect(h.calls).toHaveLength(2)
  const moved = await h.controller.advanceTo(base + 240_000)
  expect(moved.current?.window.requestedRange.fromInclusive).toBe(utc(base + 60_000))
  expect(moved.next?.window.requestedRange.fromInclusive).toBe(utc(base + 120_000))
  expect(h.calls).toHaveLength(3)
  h.controller.dispose()
})

test('실패 시 현재창을 보존하고 advance/start 대신 명시 retry만 동일 실패 범위를 재조회한다', async () => {
  const h = harness()
  h.failNext(utc(base + 60_000))
  await h.controller.start()
  const failed = h.controller.getState(), first = failed.current
  expect(failed.failure).toMatchObject({ slot: 'next', code: 'READ_FAILED', selection: { fromInclusive: utc(base + 60_000) } })
  expect(JSON.stringify(failed)).not.toContain('PRIVATE_UPSTREAM_FAILURE')
  await h.controller.advanceTo(base + 240_000)
  await h.controller.start()
  expect(h.calls).toHaveLength(2)
  await h.controller.retry()
  expect(h.calls[2]).toEqual(h.calls[1])
  expect(h.controller.getState()).toMatchObject({ current: first, failure: null })
  expect(h.controller.getState().current).toBe(first)
  await h.controller.advanceTo(base + 240_000)
  expect(h.controller.getState().current?.window.requestedRange.fromInclusive).toBe(utc(base + 60_000))
  expect(h.audit().maximumActive).toBe(1)
  h.controller.dispose()
})

test('첫 창 실패도 명시적으로만 재시도하고 성공한 뒤에만 다음창을 준비한다', async () => {
  const h = harness()
  h.failNext(utc(base))
  await h.controller.start()
  expect(h.controller.getState()).toMatchObject({ current: null, next: null, status: 'error', failure: { slot: 'current' } })
  await h.controller.start()
  expect(h.calls).toHaveLength(1)
  await h.controller.retry()
  expect(h.calls.map(value => value.fromInclusive)).toEqual([utc(base), utc(base), utc(base + 60_000)])
  h.controller.dispose()
})

for (const stage of ['first', 'prefetch', 'retry'] as const) {
  for (const boundary of ['dispose', 'owner-abort', 'owner-guard'] as const) {
    test(`${stage} 대기의 ${boundary}는 늦은 응답·갱신을 버리고 marker나 추가 창을 읽지 않는다`, async () => {
      const h = harness()
      if (stage === 'retry') { h.failNext(utc(base + 60_000)); await h.controller.start() }
      const hold = h.hold(utc(stage === 'first' ? base : base + 60_000))
      const work = stage === 'retry' ? h.controller.retry() : h.controller.start()
      await hold.entered.promise
      let events = 0
      h.controller.subscribe(() => { events++ })
      if (boundary === 'dispose') h.controller.dispose()
      else if (boundary === 'owner-abort') h.owner.abort()
      else { h.changeOwner(); h.controller.getState() }
      const disposedEvents = events, requests = h.calls.length
      expect(h.controller.getState()).toMatchObject({ status: 'disposed', current: null, next: null, pending: null })
      hold.release.resolve(); await work
      await h.controller.start(); await h.controller.retry(); await h.controller.advanceTo(base + 240_000)
      h.controller.dispose()
      expect(events).toBe(disposedEvents)
      expect(h.calls).toHaveLength(requests)
      expect(h.audit()).toMatchObject({ disposals: 1, markerCalls: 0, active: 0 })
    })
  }
}

test('반복·재진입 명령은 동시 조회나 시간 목표 대기열을 만들지 않는다', async () => {
  const h = harness(), hold = h.hold(utc(base))
  const reentrant: Promise<NativeReplayPriceWindowsState>[] = []
  let issued = false
  h.controller.subscribe(state => {
    if (state.pending && !issued) { issued = true; reentrant.push(h.controller.start(), h.controller.advanceTo(base + 240_000)) }
  })
  const first = h.controller.start()
  await hold.entered.promise
  const repeated = [h.controller.start(), h.controller.retry(), h.controller.advanceTo(base + 240_000)]
  expect(h.calls).toHaveLength(1)
  hold.release.resolve()
  await Promise.all([first, ...repeated, ...reentrant])
  expect(h.calls).toHaveLength(2)
  expect(h.controller.getState().current?.window.requestedRange.fromInclusive).toBe(utc(base))
  expect(h.audit().maximumActive).toBe(1)
  h.controller.dispose()
})

const conflicts: [string, (result: WindowResult) => void][] = [
  ['manifest', value => { value.manifest.manifestContentHash = 'a'.repeat(64) }],
  ['window hash binding', value => { value.window.manifestContentHash = 'a'.repeat(64) }],
  ['series', value => { value.window.seriesId = 'mark-1m' }],
  ['resolution', value => { value.window.resolution = '1h' }],
  ['available range', value => { value.navigation.availableRange.toExclusive = utc(base + 60_000) }],
  ['request start', value => { value.window.requestedRange.fromInclusive = utc(base) }],
  ['backward cursor', value => { value.navigation.nextFromInclusive = utc(base) }],
  ['skipped cursor', value => { value.navigation.nextFromInclusive = utc(base + 180_000) }],
  ['premature EOF', value => { value.navigation.nextFromInclusive = null }],
  ['empty range', value => { value.window.requestedRange.toExclusive = value.window.requestedRange.fromInclusive }],
  ['invalid date', value => { value.window.requestedRange.toExclusive = 'invalid' }],
]
for (const [name, transform] of conflicts) {
  test(`다음창 ${name} 불일치는 승격을 거부하고 현재창·실패 조회 범위를 보존한다`, async () => {
    const h = harness(4_000, (value, index) => { if (index === 1) transform(value) })
    await h.controller.start()
    const first = h.controller.getState().current
    expect(h.controller.getState()).toMatchObject({ status: 'error', next: null, failure: { code: 'IDENTITY_CONFLICT', selection: { fromInclusive: utc(base + 60_000) } } })
    await h.controller.advanceTo(base + 240_000)
    expect(h.controller.getState().current).toBe(first)
    expect(h.calls).toHaveLength(2)
    await h.controller.retry()
    expect(h.calls[2]).toEqual(h.calls[1])
    expect(h.controller.getState().next).toBeNull()
    h.controller.dispose()
  })
}

test('희소 PARTIAL과 빈 UNAVAILABLE 창을 보존하고 가격·체결·전체 완료를 만들지 않는다', async () => {
  const h = harness(2_000, (value, index) => {
    if (index !== 0) return
    const supplied = [base, base + 120]
    value.window.bars = supplied.map(time => ({ openTime: utc(time), closeTime: utc(time + 60), availableAt: utc(time + 60),
      open: '101', high: '103', low: '100', close: '102', volume: '5', sourceEventCount: 1 }))
    value.view.bars = supplied.map(time => ({ time, open: 101, high: 103, low: 100, close: 102, volume: 5 }))
    value.window.coverage = { status: 'PARTIAL', coveredRanges: supplied.map(time => ({ fromInclusive: utc(time), toExclusive: utc(time + 60) })),
      missingRanges: [{ fromInclusive: utc(base + 60), toExclusive: utc(base + 120) }, { fromInclusive: utc(base + 180), toExclusive: utc(base + 60_000) }] }
  })
  await h.controller.start()
  const original = h.controller.getState().current!
  expect(original.window.coverage.status).toBe('PARTIAL')
  expect(original.view.bars.map(bar => bar.time)).toEqual([base, base + 120])
  expect(original.view.fills).toEqual([])
  await h.controller.advanceTo(base + 90)
  expect(h.controller.getState().current).toBe(original)
  const empty = await h.controller.advanceTo(base + 120_000)
  expect(empty.current?.view.bars).toEqual([])
  expect(empty.current?.window.coverage.status).toBe('UNAVAILABLE')
  expect(empty.current?.window.coverage.missingRanges).toEqual([{ fromInclusive: utc(base + 60_000), toExclusive: utc(base + 120_000) }])
  expect(empty).toMatchObject({ status: 'ready', priceQueryEof: true, next: null })
  expect('replayComplete' in empty).toBe(false)
  expect(h.audit().markerCalls).toBe(0)
  h.controller.dispose()
})

test('입력 identity와 반환 스냅샷은 고정되며 폐기한 controller 대신 새 수명을 사용한다', async () => {
  const h = harness()
  const originalRange = h.identity.availableRange.fromInclusive
  // Mutation after creation cannot change the captured request identity.
  Object.assign(h.identity.availableRange, { fromInclusive: utc(base + 120) })
  Object.assign(h.identity, { resolution: '1h', seriesId: 'mark-1m', expectedManifestContentHash: 'a'.repeat(64) })
  await h.controller.start()
  const state = h.controller.getState()
  expect(Object.isFrozen(state)).toBe(true)
  expect(Object.isFrozen(state.identity.availableRange)).toBe(true)
  expect(Object.isFrozen(state.current?.window.coverage.missingRanges)).toBe(true)
  expect(Reflect.set(state.identity.availableRange, 'fromInclusive', utc(base + 120))).toBe(false)
  expect(Reflect.set(state.current!.window, 'resolution', '1h')).toBe(false)
  expect(h.calls[0].fromInclusive).toBe(originalRange)
  expect(h.calls[0]).toMatchObject({ resolution: '1m', seriesId: 'contract-1m', expectedManifestContentHash: source.manifest.manifestContentHash })
  h.controller.dispose()
  const replacement = harness()
  await replacement.controller.start()
  expect(replacement.controller.getState().status).toBe('ready')
  expect(h.controller.getState().status).toBe('disposed')
  expect(h.audit().disposals).toBe(1)
  replacement.controller.dispose()
})

test('시계 NaN·역행을 거부하고 구독 해제·미리 폐기된 owner는 조회를 만들지 않는다', async () => {
  const h = harness()
  await expect(h.controller.advanceTo(base)).rejects.toThrow('NATIVE_REPLAY_PRICE_NOT_STARTED')
  let count = 0
  const unsubscribe = h.controller.subscribe(() => { count++ })
  unsubscribe()
  await h.controller.start()
  await h.controller.advanceTo(base + 60)
  await expect(h.controller.advanceTo(Number.NaN)).rejects.toThrow('NATIVE_REPLAY_PRICE_TIME_INVALID')
  await expect(h.controller.advanceTo(base)).rejects.toThrow('NATIVE_REPLAY_PRICE_TIME_INVALID')
  expect(count).toBe(1)
  h.controller.dispose()
  const cancelled = harness()
  cancelled.owner.abort()
  await cancelled.controller.start()
  expect(cancelled.calls).toEqual([])
  expect(cancelled.controller.getState().status).toBe('disposed')
})

test('변화 없는 스냅샷은 같은 객체이고 폐기 안내는 모든 구독자에게 정확히 전달된다', async () => {
  const h = harness()
  expect(h.controller.getState()).toBe(h.controller.getState())
  const first: string[] = [], second: string[] = []
  h.controller.subscribe(state => { first.push(state.status) })
  h.controller.subscribe(state => { second.push(state.status) })
  await h.controller.start()
  const stable = h.controller.getState()
  expect(h.controller.getState()).toBe(stable)
  await h.controller.retry()
  expect(h.controller.getState()).toBe(stable)
  h.controller.dispose()
  expect(first.at(-1)).toBe('disposed')
  expect(second.at(-1)).toBe('disposed')
  expect(first.filter(value => value === 'disposed')).toHaveLength(1)
  expect(second.filter(value => value === 'disposed')).toHaveLength(1)
  expect(h.controller.getState()).toBe(h.controller.getState())
})

test('첫 구독자가 loading에서 폐기해도 다른 구독자에게 disposed 후 옛 loading이 전달되지 않는다', async () => {
  const h = harness(), first: string[] = [], second: string[] = []
  h.controller.subscribe(state => {
    first.push(state.status)
    if (state.status === 'loading') h.controller.dispose()
  })
  h.controller.subscribe(state => { second.push(state.status) })
  await h.controller.start()
  expect(first).toEqual(['idle', 'loading', 'disposed'])
  expect(second).toEqual(['idle', 'disposed'])
  expect(h.calls).toEqual([])
  expect(h.audit().disposals).toBe(1)
})

test('첫 구독자의 advanceTo 재진입 후 나머지 구독자에게 과거 스냅샷이 뒤늦게 전달되지 않는다', async () => {
  const h = harness()
  await h.controller.start()
  let nested: Promise<NativeReplayPriceWindowsState> | undefined
  const observed: (number | null)[] = []
  h.controller.subscribe(state => {
    if (state.targetTime === base + 60) nested = h.controller.advanceTo(base + 120)
  })
  h.controller.subscribe(state => { observed.push(state.targetTime) })
  await h.controller.advanceTo(base + 60)
  await nested
  expect(observed).toEqual([null, base + 120])
  expect(h.controller.getState().targetTime).toBe(base + 120)
  expect(h.calls).toHaveLength(2)
  h.controller.dispose()
})

test('owner 가드가 바뀐 뒤 다른 명령 없이 도착한 첫 응답도 버리고 다음창을 읽지 않는다', async () => {
  const h = harness(), hold = h.hold(utc(base))
  const starting = h.controller.start()
  await hold.entered.promise
  h.changeOwner()
  hold.release.resolve()
  await starting
  expect(h.controller.getState()).toMatchObject({ status: 'disposed', current: null, next: null })
  expect(h.calls).toHaveLength(1)
  expect(h.audit()).toMatchObject({ disposals: 1, active: 0, markerCalls: 0 })
})

test('같은 advanceTo 목표의 구독자 재진입은 상태 변경 없는 재통지 루프를 만들지 않는다', async () => {
  const h = harness()
  await h.controller.start()
  let notifications = 0
  const nested: Promise<NativeReplayPriceWindowsState>[] = []
  h.controller.subscribe(state => {
    if (state.targetTime === base + 60) {
      notifications++
      // A finite test guard lets the old implementation fail without a stack overflow.
      if (notifications < 3) nested.push(h.controller.advanceTo(base + 60))
    }
  })
  await h.controller.advanceTo(base + 60)
  await Promise.all(nested)
  expect(notifications).toBe(1)
  const unchanged = h.controller.getState()
  await h.controller.advanceTo(base + 60)
  expect(h.controller.getState()).toBe(unchanged)
  expect(notifications).toBe(1)
  expect(h.calls).toHaveLength(2)
  h.controller.dispose()
})

test('한 개의 COMPLETE 창도 가격 EOF만 표시하며 자동 체결·타이머·다음 조회가 없다', async () => {
  const h = harness(1, value => {
    value.window.bars = [{ openTime: utc(base), closeTime: utc(base + 60), availableAt: utc(base + 60), open: '101', high: '103', low: '100', close: '102', volume: '5', sourceEventCount: 1 }]
    value.view.bars = [{ time: base, open: 101, high: 103, low: 100, close: 102, volume: 5 }]
    value.window.coverage = { status: 'COMPLETE', coveredRanges: [{ ...value.window.requestedRange }], missingRanges: [] }
  })
  const state = await h.controller.start()
  expect(state).toMatchObject({ status: 'ready', priceQueryEof: true, targetTime: null, next: null })
  expect(state.current?.window.coverage.status).toBe('COMPLETE')
  expect(state.current?.view.bars).toHaveLength(1)
  expect(state.current?.view.fills).toEqual([])
  expect(h.calls).toHaveLength(1)
  expect(h.audit().markerCalls).toBe(0)
  h.controller.dispose()
})

test('controller owner가 살아 있어도 reader의 DISPOSED는 영구 폐기하고 재시도하지 않는다', async () => {
  const h = harness()
  h.failNext(utc(base), 'NATIVE_REPLAY_DISPOSED')
  await h.controller.start()
  try {
    expect(h.owner.signal.aborted).toBe(false)
    expect(h.controller.getState()).toMatchObject({ status: 'disposed', current: null, next: null, pending: null, failure: null, targetTime: null })
    await h.controller.retry(); await h.controller.start(); await h.controller.advanceTo(base)
    expect(h.calls).toHaveLength(1)
    expect(h.audit()).toMatchObject({ disposals: 1, markerCalls: 0 })
  } finally { h.controller.dispose() }
})

test('독점 reader의 READ_BUSY는 일반 실패로 남고 명시적 재시도 외 자동 요청을 만들지 않는다', async () => {
  const h = harness()
  h.failNext(utc(base), 'NATIVE_REPLAY_READ_BUSY')
  await h.controller.start()
  try {
    expect(h.controller.getState()).toMatchObject({ status: 'error', failure: { code: 'READ_FAILED' } })
    await h.controller.start()
    expect(h.calls).toHaveLength(1)
    await h.controller.retry()
    expect(h.calls.map(value => value.fromInclusive)).toEqual([utc(base), utc(base), utc(base + 60_000)])
    expect(h.controller.getState().status).toBe('ready')
  } finally { h.controller.dispose() }
})

test('통지 중 추가한 구독자는 즉시 스냅샷을 한 번만 받고 같은 Set 순회에서 중복 통지되지 않는다', async () => {
  const h = harness()
  let added = false, firstLoading: NativeReplayPriceWindowsState | undefined
  const received: NativeReplayPriceWindowsState[] = []
  h.controller.subscribe(state => {
    if (state.status === 'loading' && !added) {
      added = true
      firstLoading = state
      h.controller.subscribe(value => { received.push(value) })
    }
  })
  try {
    await h.controller.start()
    expect(firstLoading).toBeDefined()
    expect(received.filter(value => value === firstLoading)).toHaveLength(1)
    expect(new Set(received).size).toBe(received.length)
    h.controller.dispose()
    expect(received.filter(value => value.status === 'disposed')).toHaveLength(1)
  } finally { h.controller.dispose() }
})

test('통지 도중 제거한 다음 구독자는 복사된 통지 목록에도 남아 호출되지 않는다', async () => {
  const h = harness(), received: string[] = []
  let unsubscribe = () => {}
  h.controller.subscribe(state => { if (state.status === 'loading') unsubscribe() })
  unsubscribe = h.controller.subscribe(state => { received.push(state.status) })
  try {
    await h.controller.start()
    h.controller.dispose()
    expect(received).toEqual(['idle'])
  } finally { h.controller.dispose() }
})

for (const command of ['start', 'advanceTo', 'retry'] as const) {
  test(`${command}의 미해결 readWindow는 dispose 직후 반환하고 늦은 원응답은 무시한다`, async () => {
    const h = harness()
    if (command === 'advanceTo') await h.controller.start()
    if (command === 'retry') { h.failNext(utc(base + 60_000)); await h.controller.start() }
    const hold = h.hold(utc(command === 'start' ? base : command === 'advanceTo' ? base + 120_000 : base + 60_000))
    const work = command === 'start' ? h.controller.start() : command === 'advanceTo' ? h.controller.advanceTo(base + 60_000) : h.controller.retry()
    await hold.entered.promise
    let settled = false
    const observed = work.then(state => { settled = true; return state })
    h.controller.dispose()
    const requests = h.calls.length
    try {
      // The mock dispose intentionally does NOT reject its unresolved read.
      // Retirement must settle commands independently of transport cooperation.
      await expect.poll(() => settled, { timeout: 1_000 }).toBe(true)
      expect(await observed).toMatchObject({ status: 'disposed', targetTime: null, current: null, next: null, pending: null })
      expect(h.audit().active).toBe(1)
    } finally {
      hold.release.resolve()
      await observed
    }
    expect(h.controller.getState()).toMatchObject({ status: 'disposed', targetTime: null, current: null, next: null })
    expect(h.calls).toHaveLength(requests)
    expect(h.audit()).toMatchObject({ active: 0, disposals: 1, markerCalls: 0 })
  })
}

test('범위 밖 목표에서 데이터 대기와 같은 목표 advance 명령 대기를 명시적으로 구분한다', async () => {
  const h = harness(), hold = h.hold(utc(base + 60_000))
  const starting = h.controller.start()
  await hold.entered.promise
  const advancing = h.controller.advanceTo(base + 240_000)
  try {
    expect(h.controller.getState()).toMatchObject({ status: 'waiting', waitingFor: 'data', current: { window: { requestedRange: { fromInclusive: utc(base) } } }, next: null })
  } finally { hold.release.resolve(); await Promise.all([starting, advancing]) }
  try {
    expect(h.controller.getState()).toMatchObject({ status: 'waiting', waitingFor: 'advance', pending: null })
    expect(h.controller.getState().current?.window.requestedRange.fromInclusive).toBe(utc(base))
    expect(h.calls).toHaveLength(2)
    const next = await h.controller.advanceTo(base + 240_000)
    expect(next.current?.window.requestedRange.fromInclusive).toBe(utc(base + 60_000))
    expect(next).toMatchObject({ waitingFor: 'advance' })
    expect(h.calls).toHaveLength(3)
  } finally { h.controller.dispose() }
  expect(h.controller.getState()).toMatchObject({ waitingFor: null, targetTime: null })
})

test('창 끝 직전의 소수초는 유지하고 끝과 정확히 같은 시각에만 다음창을 승격한다', async () => {
  const h = harness()
  await h.controller.start()
  try {
    const before = await h.controller.advanceTo(base + 60_000 - 0.25)
    expect(before.current?.window.requestedRange.fromInclusive).toBe(utc(base))
    expect(before.targetTime).toBe(base + 60_000 - 0.25)
    const boundary = await h.controller.advanceTo(base + 60_000)
    expect(boundary.current?.window.requestedRange.fromInclusive).toBe(utc(base + 60_000))
    expect(h.calls).toHaveLength(3)
    await h.controller.advanceTo(base + 60_000 + 0.25)
    expect(h.controller.getState().current).toBe(boundary.current)
    expect(h.calls).toHaveLength(3)
  } finally { h.controller.dispose() }
})

test('첫 창 identity 충돌은 current를 비워 두고 같은 범위의 명시적 재시도 성공을 허용한다', async () => {
  let conflicting = true
  const h = harness(4_000, (value, index) => {
    if (index === 0 && conflicting) value.manifest.manifestContentHash = 'a'.repeat(64)
  })
  try {
    await h.controller.start()
    expect(h.controller.getState()).toMatchObject({ status: 'error', current: null, next: null, failure: { code: 'IDENTITY_CONFLICT', slot: 'current' } })
    await h.controller.start(); await h.controller.advanceTo(base)
    expect(h.calls).toHaveLength(1)
    conflicting = false
    await h.controller.retry()
    expect(h.calls[1]).toEqual(h.calls[0])
    expect(h.calls.map(value => value.fromInclusive)).toEqual([utc(base), utc(base), utc(base + 60_000)])
    expect(h.controller.getState()).toMatchObject({ status: 'ready', failure: null })
  } finally { h.controller.dispose() }
})
