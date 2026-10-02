import { expect, test } from '@playwright/test'
import { createNativePeriodReplayController } from '../../src/internal-poc/native-period-replay-controller'
import { base, utc, flush, harness } from './helpers/native-period-replay-harness'

// Pure display-controller identity checks over a synthetic validated-reader
// adapter. No claim about a real producer, renderer paint cost, or source custody.
test('동일 가격창·동일 체결에서 시간만 전진하면 view는 재사용하고 replay frame만 교체한다', async () => {
  const h = harness()
  try {
    h.controller.start(); await flush()
    const first = h.controller.step(0, h.empty)
    const advanced = h.controller.step(80, { ...h.empty, markers: [] })
    expect(advanced.failure).toBeNull()
    expect(advanced.clock.time).toBeGreaterThan(first.clock.time)
    expect(advanced.paint!.window).toBe(first.paint!.window)
    expect(advanced.paint!.view).toBe(first.paint!.view)
    expect(advanced.paint).not.toBe(first.paint)
    expect(advanced.paint!.replay).not.toBe(first.paint!.replay)
    expect(advanced.paint!.replay!.frame.time).toBe(advanced.clock.time)
    expect(advanced.paint!.replay!.frame.progress).toBe(advanced.clock.progress)
    expect(Object.isFrozen(advanced.paint!.view)).toBe(true)
    expect(h.calls).toHaveLength(2)
  } finally { h.controller.dispose() }
})

test('새 체결·가격창은 새 view를 만들고 같은 체결 dwell은 paint 전체를 재사용한다', async () => {
  const h = harness()
  const fill = { id: 'stable-entry', tradeId: 'entry / exit', time: base + 400, price: 101, side: 'BUY' as const, sourceOrdinal: 7 }
  const frame = { ...h.empty, next: fill, markers: [fill] }
  try {
    h.controller.start(); await flush()
    const first = h.controller.step(0, frame)
    const executed = h.controller.step(100, frame)
    expect(executed.clock).toMatchObject({ time: fill.time, executionCount: 1, phase: 'dwell' })
    expect(executed.paint!.window).toBe(first.paint!.window)
    expect(executed.paint!.view).not.toBe(first.paint!.view)
    expect(executed.paint!.view.fills).toEqual([{ id: fill.id, tradeId: fill.tradeId, time: fill.time, price: fill.price, side: fill.side }])
    const dwelling = h.controller.step(699, { ...h.empty, markers: [{ ...fill }] })
    expect(dwelling.paint).toBe(executed.paint)
    expect(dwelling.paint!.view).toBe(executed.paint!.view)
    h.controller.step(700, { ...h.empty, markers: [fill] })
    const edge = h.controller.step(60_700, { ...h.empty, markers: [fill] })
    expect(edge.clock.time).toBe(base + 60_000)
    const nextWindow = h.controller.step(60_701, { ...h.empty, markers: [fill] })
    expect(nextWindow.failure).toBeNull()
    expect(nextWindow.paint!.window).not.toBe(edge.paint!.window)
    expect(nextWindow.paint!.view).not.toBe(edge.paint!.view)
    expect(nextWindow.paint!.view.identity).not.toBe(edge.paint!.view.identity)
    expect(nextWindow.paint!.view.bars[0].time).toBe(base + 60_000)
    expect(nextWindow.paint!.view.fills).toEqual(edge.paint!.view.fills)
  } finally { h.controller.dispose() }
})

for (const field of ['fromInclusive', 'toExclusive'] as const) {
  test(`명시 segment ${field}의 .500Z 비정수초는 생성에서 거절하고 read0·dispose1을 보존한다`, () => {
    const segmentRange = { fromInclusive: utc(base), toExclusive: utc(base + 180) }
    segmentRange[field] = segmentRange[field].replace('Z', '.500Z')
    const owner = new AbortController()
    let reads = 0, disposed = 0
    let accepted: ReturnType<typeof createNativePeriodReplayController> | undefined
    try {
      expect(() => {
        accepted = createNativePeriodReplayController({ attemptId: 'fractional-segment', segmentRange,
          ownerSignal: owner.signal, isCurrent: () => true,
          identity: { seriesId: 'contract-1m', resolution: '1m', expectedManifestContentHash: 'a'.repeat(64),
            availableRange: { fromInclusive: utc(base + 60), toExclusive: utc(base + 120) } },
          reader: { async readWindow() { reads++; throw Error('UNEXPECTED_READ') }, dispose() { disposed++ } },
        })
      }).toThrow('NATIVE_REPLAY_PRICE_IDENTITY_INVALID')
      expect(reads).toBe(0)
      expect(disposed).toBe(1)
      owner.abort()
      expect(disposed).toBe(1)
    } finally { accepted?.dispose() }
  })
}
