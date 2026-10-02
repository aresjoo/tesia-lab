import { expect, test } from '@playwright/test'
import { priceReplaySlice } from '../../src/chart/price-replay-frame'
import { containingBar } from '../../src/chart/price-chart-view'
import { createNativePeriodReplayController } from '../../src/internal-poc/native-period-replay-controller'
import { base, utc, flush, harness } from './helpers/native-period-replay-harness'
import fixtures from './fixtures/native-service-contracts.json' with { type: 'json' }
import type { NativeChartManifest, NativeChartWindow } from '../../src/internal-poc/native-service-api'

// Display composition only: the verified-reader shape is synthetic, not SDK
// acceptance, original-source custody, or a live NativeResult integration.
function narrowPriceHarness(options: { segmentRange?: { fromInclusive: string; toExclusive: string }; manifestShift?: number } = {}) {
  const source = fixtures.sources[0].fixture as unknown as {
    binding: NativeChartManifest['binding']; sourcePolicy: NativeChartManifest['sourcePolicy']
    manifest: Omit<NativeChartManifest, 'binding' | 'sourcePolicy'>
    window: Omit<NativeChartWindow, 'binding' | 'sourcePolicy'>
  }
  const segmentRange = options.segmentRange ?? { fromInclusive: utc(base), toExclusive: utc(base + 240) }
  const verifiedBounds = { fromInclusive: utc(base + (options.manifestShift ?? 0)), toExclusive: utc(base + 240) }
  const availableRange = { fromInclusive: utc(base + 60), toExclusive: utc(base + 180) }
  const owner = new AbortController(), calls: string[] = []
  let disposed = 0
  const input: Parameters<typeof createNativePeriodReplayController>[0] = {
    attemptId: 'narrow-price', ownerSignal: owner.signal, isCurrent: () => true, segmentRange,
    identity: { seriesId: 'contract-1m', resolution: '1m', expectedManifestContentHash: source.manifest.manifestContentHash, availableRange },
    reader: {
      dispose() { disposed++ },
      async readWindow(selection = {}) {
        const start = selection.fromInclusive!, from = Date.parse(start) / 1000, end = Math.min(from + 60, base + 180)
        calls.push(start)
        if (from < base + 60 || from >= base + 180) throw Error('OUTSIDE_PRICE_RANGE')
        const manifest = { ...structuredClone(source.manifest), binding: structuredClone(source.binding),
          sourcePolicy: structuredClone(source.sourcePolicy), segmentBounds: { ...verifiedBounds } }
        const window = { ...structuredClone(source.window), binding: manifest.binding, sourcePolicy: manifest.sourcePolicy,
          seriesId: 'contract-1m' as const, resolution: '1m' as const, manifestContentHash: manifest.manifestContentHash,
          requestedRange: { fromInclusive: start, toExclusive: utc(end) }, windowContentHash: String(from).padStart(64, '0') }
        return { manifest, window, view: { identity: window.windowContentHash, market: 'BTC / USDT', resolutionSeconds: 60,
          pricePrecision: 2, sourceLabel: 'SYNTHETIC_NARROW_PRICE_TEST', fills: [],
          bars: [{ time: from, open: 100, high: 110, low: 90, close: 105, volume: 1 }] },
        navigation: { availableRange: { ...availableRange }, supportedResolutions: ['1m'],
          previousFromInclusive: from === base + 60 ? null : utc(base + 60), nextFromInclusive: end === base + 180 ? null : utc(end) } }
      },
    },
  }
  return { input, calls, owner, segmentRange, disposed: () => disposed,
    empty: { through: base + 240, eof: true, markers: [] } }
}

test('좁은 가격범위 앞뒤 실제시각 체결과 segmentEnd EXIT는 전체기간 시계와600ms dwell을 보존한다', async () => {
  const h = narrowPriceHarness(), controller = createNativePeriodReplayController(h.input)
  const prefix = { id: 'prefix-entry', tradeId: 'pair', time: base + 30, price: 101, side: 'BUY' as const, sourceOrdinal: 0 }
  const suffix = { id: 'suffix-exit', tradeId: 'pair', time: base + 210, price: 108, side: 'SELL' as const, sourceOrdinal: 1 }
  const terminal = { ...suffix, id: 'terminal-exit', time: base + 240, sourceOrdinal: 2 }
  const markers = [prefix, suffix, terminal]
  const frame = (next?: typeof prefix | typeof suffix) => ({ ...h.empty, markers, ...(next ? { next } : {}) })
  controller.start(); await flush()
  const first = controller.step(0, frame(prefix))
  expect(first.clock).toMatchObject({ time: base, progress: 0, executionCount: 0 })
  expect(priceReplaySlice(first.paint!.view, first.paint!.replay!)?.count).toBe(0)
  const entry = controller.step(60_000, frame(prefix))
  expect(entry.clock).toMatchObject({ time: prefix.time, progress: 30 / 240, executionCount: 1, phase: 'dwell' })
  expect(entry.clock.execution).toEqual({ id: prefix.id, time: prefix.time, sourceOrdinal: prefix.sourceOrdinal })
  expect(priceReplaySlice(entry.paint!.view, entry.paint!.replay!)).toMatchObject({ count: 0,
    fill: { id: prefix.id, time: prefix.time, price: prefix.price, side: prefix.side } })
  expect(containingBar(entry.paint!.view, prefix.time)).toBeNull()
  expect(entry.paint!.view.fills.map(fill => fill.id)).toEqual([prefix.id])
  expect(controller.step(60_599, frame(suffix)).clock.execution?.id).toBe(prefix.id)
  expect(controller.step(60_600, frame(suffix)).clock.time).toBe(prefix.time)
  expect(controller.step(120_600, frame(suffix)).clock.time).toBe(base + 120)
  const second = controller.step(120_601, frame(suffix))
  expect(second.paint!.window.window.requestedRange.fromInclusive).toBe(utc(base + 120))
  const exit = controller.step(180_601, frame(suffix))
  expect(exit.failure).toBeNull()
  expect(exit.clock).toMatchObject({ time: suffix.time, progress: 210 / 240, executionCount: 2, phase: 'dwell' })
  expect(exit.clock.execution).toEqual({ id: suffix.id, time: suffix.time, sourceOrdinal: suffix.sourceOrdinal })
  expect(priceReplaySlice(exit.paint!.view, exit.paint!.replay!)?.fill).toMatchObject({ id: suffix.id, time: suffix.time, price: suffix.price, side: suffix.side })
  expect(containingBar(exit.paint!.view, suffix.time)).toBeNull()
  expect(exit.paint!.view.bars.map(bar => bar.time)).toEqual([base + 120])
  controller.step(181_201, frame(terminal))
  const atEnd = controller.step(241_201, frame(terminal))
  expect(atEnd.clock).toMatchObject({ time: terminal.time, progress: 1, executionCount: 3, phase: 'dwell' })
  expect(atEnd.status).not.toBe('complete')
  expect(atEnd.clock.execution).toEqual({ id: terminal.id, time: terminal.time, sourceOrdinal: terminal.sourceOrdinal })
  expect(priceReplaySlice(atEnd.paint!.view, atEnd.paint!.replay!)?.fill).toMatchObject({ id: terminal.id, time: terminal.time, price: terminal.price, side: terminal.side })
  expect(controller.step(241_800, frame()).status).not.toBe('complete')
  const done = controller.step(241_801, frame())
  expect(done).toMatchObject({ status: 'complete', failure: null, clock: { time: base + 240, executionCount: 3 } })
  expect(priceReplaySlice(done.paint!.view, done.paint!.replay!)).not.toBeNull()
  expect(h.calls).toEqual([utc(base + 60), utc(base + 120)])
  controller.dispose(); expect(h.disposed()).toBe(1)
})

test('명시 segment의 중간 가격창 경계 체결도 다음 실제창이 승격되기 전에는 표시하지 않는다', async () => {
  const h = narrowPriceHarness(), controller = createNativePeriodReplayController(h.input)
  const fill = { id: 'boundary-entry', tradeId: 'pair', time: base + 120, price: 102, side: 'BUY' as const, sourceOrdinal: 0 }
  const frame = { ...h.empty, next: fill, markers: [fill] }
  controller.start(); await flush(); controller.step(0, frame)
  const waiting = controller.step(60_000, frame)
  expect(waiting.clock).toMatchObject({ time: fill.time, executionCount: 0 })
  expect(waiting.paint!.view.fills).toEqual([])
  const accepted = controller.step(60_001, frame)
  expect(accepted.clock).toMatchObject({ time: fill.time, executionCount: 1, phase: 'dwell' })
  expect(accepted.paint!.window.window.requestedRange.fromInclusive).toBe(utc(fill.time))
  expect(containingBar(accepted.paint!.view, fill.time)).toBe(0)
  expect(priceReplaySlice(accepted.paint!.view, accepted.paint!.replay!)?.fill).toMatchObject({ id: fill.id, time: fill.time, price: fill.price, side: fill.side })
  controller.dispose()
})

test('명시 segment는 생성 뒤 호출자의 range 객체 변경과 독립된 스냅샷이다', async () => {
  const h = narrowPriceHarness(), controller = createNativePeriodReplayController(h.input)
  h.segmentRange.fromInclusive = utc(base + 1); h.segmentRange.toExclusive = utc(base + 239)
  controller.start(); await flush()
  const state = controller.step(0, h.empty)
  expect(state.failure).toBeNull()
  expect(state.clock).toMatchObject({ time: base, progress: 0 })
  controller.dispose()
})

test('좁은 가격 query EOF를 전체 segment 체결 EOF로 승격하지 않는다', async () => {
  const h = narrowPriceHarness(), controller = createNativePeriodReplayController(h.input)
  const pendingFills = { ...h.empty, eof: false }
  controller.start(); await flush(); controller.step(0, pendingFills)
  controller.step(60_000, pendingFills); controller.step(60_001, pendingFills)
  const waiting = controller.step(120_001, pendingFills)
  expect(waiting).toMatchObject({ status: 'waiting', failure: null,
    clock: { time: base + 240, progress: 1, waitingFor: 'fills', executionCount: 0 } })
  expect(h.calls).toEqual([utc(base + 60), utc(base + 120)])
  expect(controller.step(120_002, h.empty).status).toBe('complete')
  controller.dispose()
})

test('명시 segment와 공급 manifest 범위가 다르면 최초 시계와 화면을 열지 않는다', async () => {
  const h = narrowPriceHarness({ manifestShift: 1 }), controller = createNativePeriodReplayController(h.input)
  controller.start(); await flush()
  const state = controller.step(0, h.empty)
  expect(state).toMatchObject({ status: 'error', failure: 'DISPLAY_INVALID', paint: null, clock: { phase: 'idle', executionCount: 0 } })
  controller.dispose(); expect(h.disposed()).toBe(1)
})

for (const invalid of ['milliseconds', 'invalid-date', 'inverted', 'excludes-start', 'excludes-end'] as const) {
  test(`명시 segment ${invalid}는 생성에서 거절하고 소유reader를 정리한다`, () => {
    const segmentRange = { fromInclusive: utc(base), toExclusive: utc(base + 240) }
    if (invalid === 'milliseconds') segmentRange.fromInclusive = segmentRange.fromInclusive.replace('Z', '.000Z')
    if (invalid === 'invalid-date') segmentRange.toExclusive = 'not-a-date'
    if (invalid === 'inverted') segmentRange.toExclusive = utc(base - 1)
    if (invalid === 'excludes-start') segmentRange.fromInclusive = utc(base + 61)
    if (invalid === 'excludes-end') segmentRange.toExclusive = utc(base + 179)
    const h = narrowPriceHarness({ segmentRange })
    expect(() => createNativePeriodReplayController(h.input)).toThrow()
    expect(h.calls).toEqual([])
    expect(h.disposed()).toBe(1)
  })
}

test('외부 실패 대기는 시간·진행률·남은 체결 dwell을 보존하고 명시 재개만 허용한다', async () => {
  const h = harness(), fill = { id: 'evt_hold', tradeId: 'entry / exit', time: base, price: 100, side: 'BUY' as const, sourceOrdinal: 0 }
  const frame = { ...h.empty, markers: [fill], next: fill }
  h.controller.start(); await flush()
  const first = h.controller.step(0, frame)
  expect(first.clock.phase).toBe('dwell')
  h.controller.suspend(200, 'FILL_READ_FAILED')
  h.controller.suspend(300, 'RENDER_FAILED')
  const held = h.controller.step(20_000, frame)
  expect(held).toMatchObject({ status: 'error', clock: { phase: 'paused', time: base, executionCount: 1 } })
  expect(held.paint).toBe(first.paint)
  await h.controller.retry()
  expect(h.controller.step(21_000, frame).clock.phase).toBe('paused')
  h.controller.resume('FILL_READ_FAILED')
  expect(h.controller.step(22_000, frame).clock.phase).toBe('paused')
  h.controller.resume('RENDER_FAILED')
  const resumed = h.controller.step(30_000, frame)
  expect(resumed.clock.phase).toBe('dwell')
  expect(h.controller.step(30_399, frame).clock.execution?.id).toBe(fill.id)
  expect(h.controller.step(30_400, frame).clock.execution).toBeNull()
  expect(h.controller.getState().clock.time).toBe(base)
  h.controller.dispose()
})

test('외부 실패 복구는 기존 DISPLAY_INVALID 검증 실패를 지우지 않는다', async () => {
  const h = harness(); h.controller.start(); await flush()
  h.controller.step(0, h.empty)
  const invalid = { ...h.empty, through: NaN }
  expect(h.controller.step(100, invalid).failure).toBe('DISPLAY_INVALID')
  h.controller.suspend(100, 'RENDER_FAILED'); h.controller.resume('RENDER_FAILED')
  expect(h.controller.step(50_000, h.empty).failure).toBe('DISPLAY_INVALID')
  await h.controller.retry()
  expect(h.controller.step(50_000, h.empty).failure).toBeNull()
  h.controller.dispose()
})

test('hold 해제는 step이 아직 보지 못한 가격 실패도 즉시 반영한다', async () => {
  const h = harness(), held = h.hold(base + 60_000)
  h.failAt(base + 60_000)
  h.controller.start(); await flush()
  h.controller.step(0, h.empty)
  const paused = h.controller.suspend(100, 'RENDER_FAILED')
  held.resolve(); await flush()
  const resumed = h.controller.resume('RENDER_FAILED')
  expect(resumed).toMatchObject({ status: 'error', failure: 'READ_FAILED', retryPending: false })
  expect(resumed.paint).toBe(paused.paint); expect(resumed.clock).toBe(paused.clock)
  await h.controller.retry()
  expect(h.controller.step(50_000, h.empty).failure).toBeNull()
  h.controller.dispose()
})

test('hold 해제는 성공한 가격 retry의 오래된 오류를 다시 게시하지 않는다', async () => {
  const h = harness()
  h.failAt(base + 60_000)
  h.controller.start(); await flush()
  expect(h.controller.step(0, h.empty).failure).toBe('READ_FAILED')
  await h.controller.retry()
  const paused = h.controller.suspend(100, 'RENDER_FAILED')
  const resumed = h.controller.resume('RENDER_FAILED')
  expect(resumed).toMatchObject({ status: 'loading', failure: null })
  expect(resumed.paint).toBe(paused.paint); expect(resumed.clock).toBe(paused.clock)
  expect(h.controller.step(50_000, h.empty).failure).toBeNull()
  h.controller.dispose()
})

test('시작 전 renderer hold는 준비 후에도 첫 표시를 차단한다', async () => {
  const h = harness()
  const paused = h.controller.suspend(0, 'RENDER_FAILED')
  expect(paused).toMatchObject({ status: 'error', failure: 'RENDER_FAILED', clock: { phase: 'idle' } })
  h.controller.start(); await flush()
  expect(h.controller.step(100, h.empty)).toBe(paused)
  expect(h.calls).toHaveLength(2)
  expect(h.controller.resume('RENDER_FAILED')).toMatchObject({ status: 'loading', failure: null })
  expect(h.controller.step(50_000, h.empty).clock).toMatchObject({ phase: 'playing', time: base })
  h.controller.dispose()
})

for (const now of [NaN, -1, 99]) test(`무효 suspend 시각 ${now}도 hold와 남은 dwell을 잃지 않는다`, async () => {
  const h = harness(), fill = { id: 'evt_hold', tradeId: 'entry / exit', time: base, price: 100, side: 'BUY' as const, sourceOrdinal: 0 }
  const frame = { ...h.empty, next: fill, markers: [fill] }
  h.controller.start(); await flush()
  const first = h.controller.step(100, frame)
  const paused = h.controller.suspend(now, 'RENDER_FAILED')
  expect(paused).toMatchObject({ status: 'error', failure: 'RENDER_FAILED', clock: { phase: 'paused', executionCount: 1 } })
  expect(paused.paint).toBe(first.paint)
  expect(h.controller.step(50_000, frame)).toBe(paused)
  h.controller.resume('RENDER_FAILED')
  expect(h.controller.step(60_000, frame).clock.phase).toBe('dwell')
  expect(h.controller.step(60_599, frame).clock.execution?.id).toBe(fill.id)
  expect(h.controller.step(60_600, frame).clock.execution).toBeNull()
  h.controller.dispose()
})

test('잘못된 hold 원인은 원자 거절하고 보유하지 않은 원인의 resume는 무동작이다', async () => {
  const h = harness(), initial = h.controller.getState()
  expect(() => h.controller.suspend(0, 'INVALID' as 'RENDER_FAILED')).toThrow('NATIVE_REPLAY_HOLD_INVALID')
  expect(h.controller.getState()).toBe(initial)
  expect(h.controller.resume('RENDER_FAILED')).toBe(initial)
  h.controller.start(); await flush()
  expect(h.controller.step(0, h.empty).status).toBe('playing')
  h.controller.dispose()
})

test('가격창과 전체기간 시계는 원자 view/frame으로 연결되고 창마다 시계를 재시작하지 않는다', async () => {
  const h = harness()
  h.controller.start(); await flush()
  let state = h.controller.step(0, h.empty)
  expect(state.paint!.window.window.requestedRange.fromInclusive).toBe(utc(base))
  state = h.controller.step(15_000, h.empty)
  expect(state).toMatchObject({ status: 'waiting', clock: { time: base + 60_000, progress: .25 } })
  state = h.controller.step(15_001, h.empty)
  expect(state.paint!.window.window.requestedRange.fromInclusive).toBe(utc(base + 60_000))
  expect(state.clock.progress).toBe(.25)
  expect(state.paint!.replay!.frame.viewIdentity).toBe(state.paint!.view.identity)
  expect(priceReplaySlice(state.paint!.view, state.paint!.replay!)).not.toBeNull()
  await flush()
  state = h.controller.step(30_001, h.empty)
  expect(state.clock.progress).toBe(.5)
  expect(h.audit().maxActive).toBe(1)
  h.controller.dispose()
})

test('보류된 가격 읽기가 도착해도 시각·창은 자동으로 바뀌지 않고 같은 목표의 다음 step에서 승격한다', async () => {
  const h = harness(), hold = h.hold(base + 60_000)
  h.controller.start(); await flush()
  h.controller.step(0, h.empty)
  const waiting = h.controller.step(60_000, h.empty)
  for (let i = 0; i < 100; i++) h.controller.step(60_001 + i, h.empty)
  expect(h.calls).toHaveLength(2)
  hold.resolve(); await flush()
  expect(h.controller.getState().paint!.view.identity).toBe(waiting.paint!.view.identity)
  const resumed = h.controller.step(600_000, h.empty)
  expect(resumed.clock.time).toBe(base + 60_000)
  expect(resumed.paint!.view.identity).not.toBe(waiting.paint!.view.identity)
  h.controller.dispose()
})

test('체결페이지 교체 중 활성 사건 설명을 보존하고 경계의 복수 체결을 각각600ms 표시한다', async () => {
  const h = harness()
  const buy = { id: 'entry', tradeId: 'pair', time: base + 60_000, price: 101, side: 'BUY' as const, sourceOrdinal: 9 }
  const sell = { ...buy, id: 'exit', side: 'SELL' as const, sourceOrdinal: 10 }
  h.controller.start(); await flush()
  h.controller.step(0, { ...h.empty, next: buy, markers: [buy] })
  expect(h.controller.step(15_000, { ...h.empty, next: buy, markers: [buy] }).clock.executionCount).toBe(0)
  const first = h.controller.step(15_001, { ...h.empty, next: buy, markers: [buy] })
  expect(containingBar(first.paint!.view, buy.time)).toBe(0)
  const waiting = h.controller.step(15_600, { ...h.empty, next: sell, markers: [sell] })
  expect(waiting.clock.executionCount).toBe(1)
  expect(waiting.paint!.replay!.frame.fillId).toBe('entry')
  expect(waiting.paint!.view.fills.map(fill => fill.id)).toEqual(['entry'])
  expect(waiting.paint!.window).toBe(first.paint!.window)
  expect(priceReplaySlice(waiting.paint!.view, waiting.paint!.replay!)).not.toBeNull()
  const second = h.controller.step(15_601, { ...h.empty, next: sell, markers: [sell] })
  expect(second.clock.executionCount).toBe(2)
  expect(second.paint!.replay!.frame.fillId).toBe('exit')
  expect(h.controller.step(16_200, h.empty).clock.phase).toBe('dwell')
  h.controller.step(16_201, h.empty)
  const moved = h.controller.step(16_202, h.empty)
  expect(moved.paint!.window.window.requestedRange.fromInclusive).toBe(utc(base + 60_000))
  h.controller.dispose()
})

test('전체 진행률1과 가격EOF는 체결EOF 및 종료 EXIT dwell을 대신하지 않는다', async () => {
  const h = harness(1000)
  h.controller.start(); await flush()
  h.controller.step(0, h.empty)
  const waiting = h.controller.step(60_000, { ...h.empty, eof: false })
  expect(waiting).toMatchObject({ status: 'waiting', clock: { progress: 1, waitingFor: 'fills' } })
  const exit = { id: 'terminal', tradeId: 'pair', time: h.end, price: 109, side: 'SELL' as const, sourceOrdinal: 1 }
  const execution = h.controller.step(60_001, { ...h.empty, next: exit, markers: [exit] })
  expect(execution.paint!.replay!.frame.fillId).toBe('terminal')
  expect(priceReplaySlice(execution.paint!.view, execution.paint!.replay!)?.fill?.id).toBe('terminal')
  expect(h.controller.step(60_600, h.empty).status).toBe('playing')
  const done = h.controller.step(60_601, h.empty)
  expect(done.status).toBe('complete')
  expect(priceReplaySlice(done.paint!.view, done.paint!.replay!)).not.toBeNull()
  expect(h.controller.skip()).toBe(done)
  expect(h.audit().disposals).toBe(0)
  h.controller.dispose()
  expect(h.audit().disposals).toBe(1)
})

test('동일dwell의 새페이지객체는 paint를 재할당하지 않고 최초 외부객체 변이에도 표시를 보존한다', async () => {
  const h = harness()
  const buy = { id: 'entry', tradeId: 'pair', time: base, price: 101, side: 'BUY' as const, sourceOrdinal: 0 }
  h.controller.start(); await flush()
  const first = h.controller.step(0, { ...h.empty, next: buy, markers: [buy] })
  const copy = { ...buy }
  buy.price = 999
  expect(first.paint!.view.fills[0].price).toBe(101)
  expect(Object.isFrozen(first.paint!.view.fills[0])).toBe(true)
  expect(h.controller.step(100, { ...h.empty, markers: [copy] })).toBe(first)
  expect(h.controller.step(599, { ...h.empty, markers: [{ ...copy }] })).toBe(first)
  h.controller.dispose()
})

test('명시 retry만 실패한 가격창을 읽으며 오류 대기시간은 복구 시 건너뛰지 않는다', async () => {
  const h = harness()
  h.controller.start(); await flush()
  h.controller.step(0, h.empty)
  h.controller.step(15_000, h.empty)
  h.failAt(base + 120_000)
  h.controller.step(15_001, h.empty); await flush()
  const error = h.controller.step(15_100, h.empty)
  expect(error).toMatchObject({ status: 'error', failure: 'READ_FAILED', clock: { phase: 'paused' } })
  for (let i = 0; i < 20; i++) h.controller.step(16_000 + i, h.empty)
  expect(h.calls).toHaveLength(3)
  await h.controller.retry()
  const resumed = h.controller.step(600_000, h.empty)
  expect(resumed.clock.time).toBe(error.clock.time)
  expect(h.calls[3]).toBe(h.calls[2])
  expect(JSON.stringify(error)).not.toContain('PRIVATE_READ_FAILURE')
  h.controller.dispose()
})

test('재시도 요청을 시작한 것만으로 시계를 재개하지 않고 성공 응답까지 오류 프레임을 보존한다', async () => {
  const h = harness()
  h.controller.start(); await flush()
  h.controller.step(0, h.empty); h.controller.step(15_000, h.empty)
  h.failAt(base + 120_000)
  h.controller.step(15_001, h.empty); await flush()
  const error = h.controller.step(15_100, h.empty)
  const held = h.hold(base + 120_000), work = h.controller.retry()
  await flush()
  const waiting = h.controller.step(600_000, h.empty)
  expect(waiting.status).toBe('error')
  expect(waiting.clock).toBe(error.clock)
  expect(waiting.paint).toBe(error.paint)
  h.controller.step(610_000, h.empty)
  held.resolve(); await work
  const resumed = h.controller.step(700_000, h.empty)
  expect(resumed.clock.time).toBe(error.clock.time)
  h.controller.dispose()
})

test('외부 hold 복구가 미완료 가격 retry의 동결을 해제하지 않는다', async () => {
  const h = harness()
  h.controller.start(); await flush()
  h.controller.step(0, h.empty); h.controller.step(15_000, h.empty)
  h.failAt(base + 120_000)
  h.controller.step(15_001, h.empty); await flush()
  const error = h.controller.step(15_100, h.empty)
  const held = h.hold(base + 120_000), work = h.controller.retry()
  await flush()
  h.controller.suspend(15_200, 'RENDER_FAILED'); h.controller.resume('RENDER_FAILED')
  for (const now of [600_000, 610_000]) {
    const waiting = h.controller.step(now, h.empty)
    expect(waiting).toMatchObject({ status: 'error', failure: 'READ_FAILED' })
    expect(waiting.clock).toBe(error.clock); expect(waiting.paint).toBe(error.paint)
  }
  held.resolve(); await work
  const resumed = h.controller.step(700_000, h.empty)
  expect(resumed.clock.time).toBe(error.clock.time)
  expect(resumed.failure).toBeNull()
  h.controller.dispose()
})

test('표시 오류 중 prefetch도 실패하면 한 번의 명시 retry로 두 복구를 모두 진행한다', async () => {
  const h = harness(), held = h.hold(base + 60_000)
  h.failAt(base + 60_000)
  h.controller.start(); await flush()
  h.controller.step(0, h.empty)
  const error = h.controller.step(100, { ...h.empty, through: NaN })
  expect(error.failure).toBe('DISPLAY_INVALID')
  held.resolve(); await flush()
  const calls = h.calls.length
  await h.controller.retry()
  expect(h.calls.length).toBe(calls + 1)
  const recovered = h.controller.step(500_000, h.empty)
  expect(recovered.failure).toBeNull()
  expect(recovered.clock.time).toBe(error.clock.time)
  h.controller.dispose()
})

test('다음 사건과 표시페이지의 동일ID 다른가격을 수락하지 않는다', async () => {
  const h = harness()
  const buy = { id: 'entry', tradeId: 'pair', time: base, price: 101, side: 'BUY' as const, sourceOrdinal: 0 }
  h.controller.start(); await flush()
  expect(h.controller.step(0, { ...h.empty, next: buy, markers: [{ ...buy, price: 999 }] }).failure).toBe('DISPLAY_INVALID')
  h.controller.dispose()
})

test('무효 최초tick은 내부 시계를 시작하지 않고 무효 경계tick은 가격창이나 요청을 바꾸지 않는다', async () => {
  const h = harness()
  h.controller.start(); await flush()
  expect(h.controller.step(60_000, { ...h.empty, through: NaN }).failure).toBe('DISPLAY_INVALID')
  await h.controller.retry()
  expect(h.controller.step(60_001, h.empty).clock).toMatchObject({ time: base, progress: 0 })
  h.controller.step(75_001, h.empty)
  const before = h.controller.getState(), requests = h.calls.length
  const failed = h.controller.step(75_002, { ...h.empty, through: NaN })
  expect(failed.failure).toBe('DISPLAY_INVALID')
  await flush()
  expect(h.calls).toHaveLength(requests)
  expect(h.controller.getState().paint).toBe(before.paint)
  expect(h.controller.getState().clock.time).toBe(before.clock.time)
  h.controller.dispose()
})

test('같은 시각·원순번에 서로 다른ID를 공급한 표시슬롯을 결합하지 않는다', async () => {
  const h = harness()
  const buy = { id: 'entry', tradeId: 'pair', time: base, price: 101, side: 'BUY' as const, sourceOrdinal: 0 }
  h.controller.start(); await flush()
  expect(h.controller.step(0, { ...h.empty, next: buy, markers: [{ ...buy, id: 'impostor' }] }).failure).toBe('DISPLAY_INVALID')
  await h.controller.retry()
  h.controller.step(0, { ...h.empty, next: buy, markers: [buy] })
  expect(h.controller.step(100, { ...h.empty, markers: [{ ...buy, id: 'impostor' }] }).failure).toBe('DISPLAY_INVALID')
  h.controller.dispose()
})

for (const malformed of ['frontier', 'page-size', 'ordinal'] as const) test(`${malformed} 무효표시 뒤 명시retry는 시간을 몰아서 진행하지 않는다`, async () => {
  const h = harness()
  h.controller.start(); await flush()
  const before = h.controller.step(0, h.empty)
  const marker = { id: 'a', tradeId: 'pair', time: base, price: 100, side: 'BUY' as const, sourceOrdinal: 0 }
  const invalid = malformed === 'frontier' ? { ...h.empty, through: base - 1 }
    : malformed === 'page-size' ? { ...h.empty, markers: Array.from({ length: 101 }, (_, i) => ({ ...marker, id: `f-${i}`, sourceOrdinal: i })) }
      : { ...h.empty, next: { ...marker, sourceOrdinal: 0.5 } }
  const error = h.controller.step(100, invalid)
  expect(error).toMatchObject({ status: 'error', failure: 'DISPLAY_INVALID', clock: { phase: 'paused', time: base } })
  expect(error.paint).toBe(before.paint)
  expect(h.controller.step(100_000, h.empty)).toBe(error)
  const requests = h.calls.length
  expect(await h.controller.retry()).toBe(error)
  expect(h.controller.step(110_000, h.empty).clock.time).toBe(base)
  expect(h.calls).toHaveLength(requests)
  h.controller.dispose()
})

for (const invalid of ['milliseconds', 'inverted', 'attempt'] as const) test(`${invalid} 생성실패는 소유reader를 한번정리하고 signal리스를 남기지 않는다`, () => {
  const owner = new AbortController(), listeners = new Set<unknown>()
  const add = owner.signal.addEventListener.bind(owner.signal), remove = owner.signal.removeEventListener.bind(owner.signal)
  owner.signal.addEventListener = (type, listener, options) => { if (type === 'abort') listeners.add(listener); add(type, listener, options) }
  owner.signal.removeEventListener = (type, listener, options) => { if (type === 'abort') listeners.delete(listener); remove(type, listener, options) }
  let disposed = 0
  expect(() => createNativePeriodReplayController({ attemptId: invalid === 'attempt' ? '' : 'attempt', ownerSignal: owner.signal, isCurrent: () => true,
    reader: { readWindow: async () => { throw new Error('UNEXPECTED_READ') }, dispose: () => { disposed++ } },
    identity: { seriesId: 'contract-1m', resolution: '1m', expectedManifestContentHash: 'a'.repeat(64),
      availableRange: { fromInclusive: utc(base), toExclusive: invalid === 'inverted' ? utc(base - 1)
        : invalid === 'milliseconds' ? utc(base + 60).replace('Z', '.000Z') : utc(base + 60) } },
  })).toThrow()
  expect(disposed).toBe(1)
  expect(listeners.size).toBe(0)
})

for (const boundary of ['skip', 'abort', 'owner', 'dispose'] as const) {
  test(`${boundary}는 보류된 공급의 늦은 결과·재시도·재개를 차단한다`, async () => {
    const h = harness(), held = h.hold(base + 60_000)
    h.controller.start(); await flush()
    h.controller.step(0, h.empty)
    if (boundary === 'skip') h.controller.skip()
    else if (boundary === 'abort') h.owner.abort()
    else if (boundary === 'owner') h.retire()
    else h.controller.dispose()
    const retired = h.controller.getState()
    held.resolve(); await flush()
    h.controller.start(); await h.controller.retry(); h.controller.step(600_000, h.empty)
    expect(h.controller.getState()).toBe(retired)
    expect(h.calls).toHaveLength(2)
    expect(h.audit().disposals).toBe(1)
    expect(retired.paint?.replay ?? null).toBeNull()
    h.controller.dispose()
  })
}

test('730일 합성1052창은 하나의 시계로 모두 관찰하며 체결 없는 구간도 건너뛰지 않는다', async () => {
  const h = harness(730 * 24 * 60)
  h.controller.start(); await flush()
  const ids = new Set<string>()
  let state = h.controller.step(0, h.empty), now = 0
  for (let i = 0; i < 3000 && state.status !== 'complete'; i++) {
    state = h.controller.step(now += 100, h.empty)
    if (state.paint) {
      ids.add(state.paint.view.identity)
      expect(priceReplaySlice(state.paint.view, state.paint.replay!)).not.toBeNull()
    }
    await flush()
  }
  expect(state.status).toBe('complete')
  expect(state.clock.time).toBe(h.end)
  expect(ids.size).toBe(1052)
  expect(h.calls).toHaveLength(1052)
  expect(h.audit().maxActive).toBe(1)
  h.controller.dispose()
})
