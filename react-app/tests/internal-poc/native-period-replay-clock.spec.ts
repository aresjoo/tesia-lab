import { expect, test } from '@playwright/test'
import { createNativePeriodReplayClock, type NativeReplayFrontier } from '../../src/internal-poc/native-period-replay-clock'

// Display-clock tests only. Frontiers are explicit test observations, not a
// producer/source completeness proof or a real two-year backtest.
const begin = 1704067200, end = begin + 730 * 86400
const full = (): NativeReplayFrontier => ({ priceThrough: end, fillsThrough: end, priceEof: true, fillsEof: true })
const setup = () => {
  const owner = new AbortController()
  let current = true
  const clock = createNativePeriodReplayClock({ attemptId: 'replay-attempt', from: begin, to: end,
    ownerSignal: owner.signal, isCurrent: () => current })
  return { clock, owner, retire: () => { current = false } }
}

test('730일은 창별 재시작 없는 한 UTC시계와 단조 전체진행률을 사용한다', () => {
  const { clock } = setup()
  expect(clock.getState()).toMatchObject({ phase: 'idle', time: begin, progress: 0 })
  clock.start(0)
  for (let step = 1; step <= 100; step++) {
    const value = clock.tick(step * 600, full())
    expect(value.time).toBeCloseTo(begin + (end - begin) * step / 100, 4)
    expect(value.progress).toBeCloseTo(step / 100, 8)
  }
  expect(clock.getState().phase).toBe('complete')
  expect(clock.start(90000)).toBe(clock.getState())
  clock.dispose()
})

for (const kind of ['price', 'fills'] as const) test(`${kind} 경계에선 멈추고 기다린 시간은 재개 때 몰아서 따라가지 않는다`, () => {
  const { clock } = setup(), frontier = full(), barrier = begin + (end - begin) / 10
  if (kind === 'price') { frontier.priceThrough = barrier; frontier.priceEof = false }
  else { frontier.fillsThrough = barrier; frontier.fillsEof = false }
  clock.start(0)
  expect(clock.tick(12000, frontier)).toMatchObject({ phase: 'waiting', time: barrier, waitingFor: kind })
  expect(clock.tick(120000, frontier).time).toBe(barrier)
  expect(clock.tick(130000, full()).time).toBe(barrier)
  expect(clock.tick(136000, full()).time).toBeCloseTo(begin + (end - begin) / 5, 4)
  clock.dispose()
})

test('같은 시각의 여러 체결은 원순번 순서로 각각600ms 노출하고 완료 전 마지막 체결도 유지한다', () => {
  const { clock } = setup()
  const frontier = full()
  clock.start(0)
  frontier.execution = { id: 'fill-a', time: begin, sourceOrdinal: 9 }
  expect(clock.tick(0, frontier)).toMatchObject({ phase: 'dwell', execution: frontier.execution, executionCount: 1 })
  frontier.execution = { id: 'fill-b', time: begin, sourceOrdinal: 10 }
  expect(clock.tick(599, frontier)).toMatchObject({ phase: 'dwell', execution: { id: 'fill-a' }, executionCount: 1 })
  expect(clock.tick(600, frontier)).toMatchObject({ phase: 'dwell', execution: { id: 'fill-b' }, executionCount: 2 })
  frontier.execution = { id: 'terminal-exit', time: end, sourceOrdinal: 1 }
  expect(clock.tick(61200, frontier)).toMatchObject({ phase: 'dwell', time: end, progress: 1, executionCount: 3 })
  delete frontier.execution
  expect(clock.tick(61799, frontier).phase).toBe('dwell')
  expect(clock.tick(61800, frontier).phase).toBe('complete')
  clock.dispose()
})

test('큰 tick 지연에도 체결을 한 번에 쓸어버리지 않고 시간순 다음 한 건만 노출한다', () => {
  const { clock } = setup()
  clock.start(0)
  const first = clock.tick(600000, { ...full(), execution: { id: 'a', time: begin + 3600, sourceOrdinal: 30 } })
  expect(first).toMatchObject({ phase: 'dwell', time: begin + 3600, executionCount: 1 })
  const second = clock.tick(600600, { ...full(), execution: { id: 'b', time: begin + 7200, sourceOrdinal: 2 } })
  // Time that elapsed while the old event was displayed is not free market-time.
  expect(second.time).toBe(begin + 3600)
  expect(clock.tick(601600, { ...full(), execution: { id: 'b', time: begin + 7200, sourceOrdinal: 2 } }))
    .toMatchObject({ phase: 'dwell', time: begin + 7200, executionCount: 2 })
  clock.dispose()
})

test('가격 조회끝·진행률1만으로 체결미확인 재생을 완료하지 않는다', () => {
  const { clock } = setup()
  clock.start(0)
  expect(clock.tick(60000, { ...full(), fillsEof: false })).toMatchObject({ phase: 'waiting', progress: 1, waitingFor: 'fills' })
  expect(clock.tick(120000, full()).phase).toBe('complete')
  clock.dispose()
})

test('같은 체결을 다시 공급해도 재노출하지 않으며 역전·변경된 체결은 원상태를 보존하고 거절한다', () => {
  const { clock } = setup(), frontier = { ...full(), execution: { id: 'a', time: begin, sourceOrdinal: 5 } }
  clock.start(0); clock.tick(0, frontier)
  expect(clock.tick(100, frontier).executionCount).toBe(1)
  const before = clock.getState()
  for (const execution of [{ id: 'b', time: begin, sourceOrdinal: 4 }, { id: 'changed', time: begin, sourceOrdinal: 5 }]) {
    expect(() => clock.tick(200, { ...full(), execution })).toThrow('NATIVE_REPLAY_CLOCK_INPUT_INVALID')
    expect(clock.getState()).toBe(before)
  }
  clock.dispose()
})

for (const boundary of ['skip', 'dispose', 'abort', 'owner'] as const) test(`${boundary} 후 늦은 tick/start는 종료상태를 되살리지 않는다`, () => {
  const h = setup(); h.clock.start(0); h.clock.tick(6000, full())
  if (boundary === 'skip') h.clock.skip()
  else if (boundary === 'dispose') h.clock.dispose()
  else if (boundary === 'abort') h.owner.abort()
  else h.retire()
  const stopped = h.clock.getState()
  expect(stopped.phase).toBe(boundary === 'skip' ? 'stopped' : 'disposed')
  expect(stopped.time).not.toBe(end)
  expect(h.clock.tick(90000, full())).toBe(stopped)
  expect(h.clock.start(90000)).toBe(stopped)
  h.clock.dispose()
})

test('불법 시각·frontier·EOF와 이전 tick 시각은 snapshot을 바꾸지 않고 거절한다', () => {
  const { clock } = setup(); clock.start(100)
  const before = clock.getState()
  for (const now of [NaN, Infinity, -1, 99]) {
    expect(() => clock.tick(now, full())).toThrow('NATIVE_REPLAY_CLOCK_INPUT_INVALID')
    expect(clock.getState()).toBe(before)
  }
  for (const bad of [{ priceThrough: begin - 1 }, { fillsThrough: end + 1 }, { priceThrough: begin, priceEof: true },
    { fillsThrough: NaN }, { execution: { id: '', time: begin, sourceOrdinal: 0 } }]) {
    expect(() => clock.tick(200, { ...full(), ...bad })).toThrow('NATIVE_REPLAY_CLOCK_INPUT_INVALID')
    expect(clock.getState()).toBe(before)
  }
  clock.dispose()
})

test('외부 공급 객체를 보관하지 않고 상태는 변조 불가능한 일정 크기의 snapshot이다', () => {
  const { clock } = setup(), frontier = { ...full(), execution: { id: 'a', time: begin, sourceOrdinal: 0 } }
  clock.start(0)
  const observed = clock.tick(0, frontier)
  frontier.execution.id = 'mutated'
  expect(observed.execution?.id).toBe('a')
  expect(Object.isFrozen(observed)).toBe(true)
  expect(Object.isFrozen(observed.execution)).toBe(true)
  expect(clock.getState()).toBe(observed)
  clock.dispose()
})

test('무효tick은 경과시간을 소비하지 않으며 유효tick이 이전 정상시각부터 전개한다', () => {
  const { clock } = setup(); clock.start(0)
  expect(() => clock.tick(6000, { ...full(), priceThrough: NaN })).toThrow('NATIVE_REPLAY_CLOCK_INPUT_INVALID')
  expect(clock.tick(6000, full()).progress).toBeCloseTo(0.1, 8)
  expect(() => clock.tick(12000, { ...full(), fillsEof: true, fillsThrough: begin })).toThrow('NATIVE_REPLAY_CLOCK_INPUT_INVALID')
  expect(clock.tick(12000, full()).progress).toBeCloseTo(0.2, 8)
  clock.dispose()
})

for (const kind of ['price', 'fills'] as const) test(`체결dwell 중 ${kind} 부족은 노출을 끝낸 뒤 대기하며 복귀때 몰아가지 않는다`, () => {
  const { clock } = setup(); clock.start(0)
  const frontier = full()
  clock.tick(0, { ...frontier, execution: { id: 'first', time: begin, sourceOrdinal: 0 } })
  if (kind === 'price') { frontier.priceThrough = begin; frontier.priceEof = false }
  else { frontier.fillsThrough = begin; frontier.fillsEof = false }
  expect(clock.tick(599, frontier).phase).toBe('dwell')
  expect(clock.tick(600, frontier)).toMatchObject({ phase: 'waiting', waitingFor: kind, time: begin })
  expect(clock.tick(60000, frontier).time).toBe(begin)
  expect(clock.tick(90000, full()).time).toBe(begin)
  expect(clock.tick(96000, full()).progress).toBeCloseTo(0.1, 8)
  clock.dispose()
})

test('범위끝 같은시각의 복수체결도 각각600ms 유지하며 마지막까지 완료하지 않는다', () => {
  const { clock } = setup(); clock.start(0)
  expect(clock.tick(60000, { ...full(), execution: { id: 'end-1', time: end, sourceOrdinal: 1 } }).phase).toBe('dwell')
  expect(clock.tick(60599, { ...full(), execution: { id: 'end-2', time: end, sourceOrdinal: 3 } }).execution?.id).toBe('end-1')
  expect(clock.tick(60600, { ...full(), execution: { id: 'end-2', time: end, sourceOrdinal: 3 } }))
    .toMatchObject({ phase: 'dwell', progress: 1, executionCount: 2, execution: { id: 'end-2' } })
  expect(clock.tick(61199, full()).phase).toBe('dwell')
  expect(clock.tick(61200, full()).phase).toBe('complete')
  clock.dispose()
})

test('조회실패의 명시pause/retry는 직전시점과 남은 체결읽기시간을 보존한다', () => {
  const { clock } = setup(); clock.start(0)
  clock.tick(0, { ...full(), execution: { id: 'a', time: begin, sourceOrdinal: 0 } })
  const paused = clock.pause(200)
  expect(paused).toMatchObject({ phase: 'paused', time: begin, execution: { id: 'a' } })
  expect(clock.tick(100000, full())).toBe(paused)
  expect(clock.start(100000)).toBe(paused)
  expect(clock.resume(100000)).toMatchObject({ phase: 'dwell', time: begin, execution: { id: 'a' } })
  expect(clock.tick(100399, full()).phase).toBe('dwell')
  expect(clock.tick(100400, full())).toMatchObject({ phase: 'playing', time: begin })
  expect(clock.tick(106400, full()).progress).toBeCloseTo(.1, 8)
  clock.dispose()
})

for (const boundary of ['abort', 'owner', 'skip'] as const) test(`pause 중 ${boundary} 이후 resume는 이전 시도를 되살리지 않는다`, () => {
  const h = setup(); h.clock.start(0); h.clock.tick(0, { ...full(), execution: { id: 'a', time: begin, sourceOrdinal: 0 } })
  h.clock.pause(100)
  if (boundary === 'abort') h.owner.abort()
  else if (boundary === 'owner') h.retire()
  else h.clock.skip()
  const retired = h.clock.getState()
  expect(h.clock.resume(100000)).toBe(retired)
  expect(h.clock.tick(100001, full())).toBe(retired)
  h.clock.dispose()
})

test('잘못된 재개시각은 pause와 남은dwell을 소비하지 않는다', () => {
  const { clock } = setup(); clock.start(0)
  clock.tick(0, { ...full(), execution: { id: 'a', time: begin, sourceOrdinal: 0 } })
  const paused = clock.pause(200)
  for (const invalid of [NaN, 199, Infinity, -1]) {
    expect(() => clock.resume(invalid)).toThrow('NATIVE_REPLAY_CLOCK_INPUT_INVALID')
    expect(clock.getState()).toBe(paused)
  }
  clock.resume(100000)
  expect(clock.tick(100399, full()).phase).toBe('dwell')
  expect(clock.tick(100400, full()).phase).toBe('playing')
  clock.dispose()
})

test('데이터 대기의 pause와 명시resume 뒤 첫 준비tick은 기다린 시각을 몰아가지 않는다', () => {
  const { clock } = setup(); clock.start(0)
  clock.tick(6000, { ...full(), fillsThrough: begin, fillsEof: false })
  clock.pause(7000)
  clock.resume(100000)
  expect(clock.tick(110000, full())).toMatchObject({ phase: 'playing', time: begin })
  expect(clock.tick(116000, full()).progress).toBeCloseTo(.1, 8)
  clock.dispose()
})
