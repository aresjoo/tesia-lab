import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { catalogueAssets, catalogueStrategies, catalogueSourceSha } from '../src/client-catalogue'
import { computeCatalogueBacktest } from '../src/client-catalogue-backtest-result'
import { catalogueBacktestPeriods, catalogueBacktestAmounts, validCatalogueBacktestObservation, catalogueBacktestUseBinding, createCatalogueBacktestClient, type CatalogueBacktestObservation, type CatalogueBacktestReply, type CatalogueBacktestRequest } from '../src/client-catalogue-backtest'
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }

const data = new CatalogueMarketData(spot, futures)
const selection = (strategyId = 'd1', period: typeof catalogueBacktestPeriods[number] = 0, amount: typeof catalogueBacktestAmounts[number] = 1000, owner = 'evidence-test-owner') => ({ strategyId, period, amount, owner })
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const eventKind = { enter: 'buy', exit: 'sell', skip: 'skip', veto: 'skip', hold: 'hold', pick: 'pick' } as const

test('전체 판단은 최근 요약과 분리되어 모든 원 이벤트 identity를 제공한다', () => {
  const value = computeCatalogueBacktest(selection(), data)
  expect(value).toHaveProperty('evidence')
  expect(value.evidence.decisions.length).toBeGreaterThan(value.judgments.length)
  expect(value.evidence.decisions.map(d => d.eventIndex)).toEqual(value.result.events.flatMap((e, i) => e.t === 'unpick' ? [] : [i]))
})

for (const period of catalogueBacktestPeriods) test(`31cfg/${period}: 완전성·원장/EV/가격 결속·원 계산 불변`, () => {
  for (const strategy of catalogueStrategies) {
    const input = selection(strategy.id, period), value = computeCatalogueBacktest(input, data)
    const { evidence } = value
    expect(validCatalogueBacktestObservation(value, input), strategy.id).toBe(true)
    expect(evidence.sourceSha).toBe(catalogueSourceSha)
    expect(evidence.runId).toBe(value.runId)
    const expectedEvents = value.result.events.flatMap((e, i) => e.t === 'unpick' ? [] : [i])
    expect(evidence.decisions.map(d => d.eventIndex)).toEqual(expectedEvents)
    // Compare every row, but avoid thousands of per-field Playwright trace steps.
    expect(evidence.decisions.map(d => [d.ix, d.runId, d.i, d.j, d.k, d.a, d.tid, Object.hasOwn(d, 'e'), Object.isFrozen(d.facts)]))
      .toEqual(expectedEvents.map((eventIndex, ix) => {
        const e = value.result.events[eventIndex]
        return [ix, value.runId, e.i, Math.max(0, Math.min(value.result.eq.length - 1, e.i - value.result.eq[0].i)), eventKind[e.t as keyof typeof eventKind], e.a, e.tid, false, true]
      }))
    const daily = strategy.kind === 'agent' ? evidence.decisions.filter(d => ['buy', 'skip', 'hold'].includes(d.k)) : []
    expect(evidence.dailyGroups.flatMap(g => g.decisionIndices).sort((a,b) => a-b)).toEqual(daily.map(d => d.ix))
    expect(evidence.prices.source).toBe('client-snapshot-close')
    expect(evidence.prices.series.map(s => s.asset)).toEqual([...catalogueAssets(strategy)])
    for (const s of evidence.prices.series) {
      expect(s.values).toBe(data.prices(s.asset)); expect(s.values.length).toBe(data.length)
      expect(Object.isFrozen(s.values)).toBe(true)
    }
    expect(Object.isFrozen(evidence)).toBe(true)
    expect(value.judgments.length).toBeLessThanOrEqual(8)
    expect(catalogueBacktestUseBinding(value)).not.toHaveProperty('evidence')
  }
})

test('동일날·복수종목·숏청산과롱진입 및 예산/newrun은 혼동하지 않는다', () => {
  for (const id of ['d1', 'f1', 'f7']) {
    const base = computeCatalogueBacktest(selection(id), data), before = digest(base.result)
    expect(base.evidence.decisions.some((d, i, all) => all.some((other, j) => j !== i && other.i === d.i))).toBe(true)
    for (const amount of catalogueBacktestAmounts) {
      const value = computeCatalogueBacktest(selection(id, 0, amount), data)
      expect(digest(value.result)).toBe(before)
      expect(value.evidence.decisions.map(d => d.eventIndex)).toEqual(base.evidence.decisions.map(d => d.eventIndex))
      if (amount !== 1000) expect(validCatalogueBacktestObservation({ ...value, evidence: base.evidence }, selection(id, 0, amount))).toBe(false)
    }
    const foreign = computeCatalogueBacktest(selection(id, 0, 1000, 'other-owner'), data)
    expect(validCatalogueBacktestObservation({ ...base, evidence: foreign.evidence }, selection(id))).toBe(false)
  }
})

test('누락·중복·외부원장·잘못된일자/EV/가격·무한수·초과자료는 fail closed', () => {
  const original = computeCatalogueBacktest(selection(), data)
  const mutations: Array<(v: ReturnType<typeof structuredClone<CatalogueBacktestObservation>>) => void> = [
    v => { Reflect.deleteProperty(v, 'evidence') },
    v => { Reflect.set(v.evidence, 'sourceSha', 'foreign') },
    v => { Reflect.set(v.evidence, 'runId', 'foreign') },
    v => { Reflect.set(v.evidence, 'decisions', v.evidence.decisions.slice(1)) },
    v => { Reflect.set(v.evidence, 'decisions', [...v.evidence.decisions, v.evidence.decisions[0]]) },
    v => { Reflect.set(v.evidence.decisions[0], 'eventIndex', 999999) },
    v => { Reflect.set(v.evidence.decisions[0], 'j', -1) },
    v => { Reflect.set(v.evidence.decisions[0], 'i', 0) },
    v => { Reflect.set(v.evidence.decisions[0], 'a', 'foreign-asset') },
    v => { Reflect.set(v.evidence.decisions[0], 'tid', 999999) },
    v => { Reflect.set(v.evidence.decisions[0], 'facts', [['field', 'x'.repeat(8193)]]) },
    v => { Reflect.set(v.evidence.decisions[0], 'pnl', Infinity) },
    v => { Reflect.set(v.evidence.decisions[0], 'side', 2); Reflect.set(v.result.events[v.evidence.decisions[0].eventIndex], 'side', 2) },
    v => { Reflect.set(v.evidence.decisions[0], 'chain', 2) },
    v => { Reflect.set(v.evidence.decisions[0], 'out', { t: 'test', v: 1, mute: 2 }) },
    v => { Reflect.set(v.evidence.decisions[0], 'out', { t: 'test', v: NaN }) },
    v => { Reflect.set(v.evidence, 'dailyGroups', []) },
    v => { Reflect.set(v.evidence.dailyGroups[0], 'decisionIndices', [999999]) },
    v => { Reflect.set(v.evidence.dailyGroups[0], 'title', 'altered') },
    v => { Reflect.set(v.evidence.dailyGroups[0], 'out', 'sell') },
    v => { Reflect.set(v.evidence, 'dailyGroups', [...v.evidence.dailyGroups].reverse()) },
    v => { Reflect.set(v.evidence.prices, 'source', 'live') },
    v => { Reflect.set(v.evidence.prices, 'calendarStartIndex', 1) },
    v => { Reflect.set(v.evidence.prices, 'series', v.evidence.prices.series.slice(1)) },
    v => { Reflect.set(v.evidence.prices.series[0], 'values', [1, 2]) },
    v => { Reflect.set(v.evidence.prices.series[0].values, 0, -1) },
    v => { Reflect.set(v.evidence.prices.series[0].values, 0, Infinity) },
    v => { Reflect.set(v.evidence.prices.series[0].values, 0, 1e16) },
    v => { Reflect.set(v.evidence.prices, 'series', [...v.evidence.prices.series].reverse()) },
  ]
  for (const [index, mutate] of mutations.entries()) {
    const broken = structuredClone(original); mutate(broken)
    expect(validCatalogueBacktestObservation(broken, selection()), `mutation ${index}`).toBe(false)
  }
  expect(validCatalogueBacktestObservation(original, selection())).toBe(true)
})

test('중복 closed trade ID는 거래 수를 맞춰도 동일원장으로 받아들이지 않는다', () => {
  const value = structuredClone(computeCatalogueBacktest(selection(), data))
  value.result.trades.push(structuredClone(value.result.trades[0]))
  value.result.n = value.result.trades.length
  expect(validCatalogueBacktestObservation(value, selection())).toBe(false)
})

test('원본 buy·skip·hold의 필수 단계 문구 삭제를 불완전 관측으로 거절한다', () => {
  const original = computeCatalogueBacktest(selection(), data)
  for (const kind of ['buy', 'skip', 'hold']) for (const field of ['p0', 'p1', 'p2']) {
    const value = structuredClone(original), row = value.evidence.decisions.find(d => d.k === kind)
    expect(row, kind).toBeDefined(); Reflect.deleteProperty(row!, field)
    expect(validCatalogueBacktestObservation(value, selection()), `${kind}/${field}`).toBe(false)
  }
})

test('열린 포지션의 표시 숫자와 추가 pnl 키는 malformed 응답을 거절한다', () => {
  for (const id of ['d1', 'f1', 'f5']) {
    const input = selection(id, 365), original = computeCatalogueBacktest(input, data)
    const open = original.result.state.open, first = Array.isArray(open) ? open[0] : open
    expect(first, id).toBeTruthy()
    const fields = ['ep', 'px', 'cost', 'pnl', ...(!original.strategy.fut ? ['chg'] : [])]
    for (const field of fields) for (const invalid of [null, undefined, NaN, Infinity, '1']) {
      const value = structuredClone(original), open = value.result.state.open, p = Array.isArray(open) ? open[0] : open
      Reflect.set(p!, field, invalid)
      expect.soft(validCatalogueBacktestObservation(value, input), `${id}/${field}/${String(invalid)}`).toBe(false)
    }
    for (const field of ['ep', 'px', 'cost', 'lev']) for (const invalid of [0, -1]) {
      const value = structuredClone(original), open = value.result.state.open, p = Array.isArray(open) ? open[0] : open
      Reflect.set(p!, field, invalid)
      expect.soft(validCatalogueBacktestObservation(value, input), `${id}/${field}/${invalid}`).toBe(false)
    }
    expect(validCatalogueBacktestObservation(original, input)).toBe(true)
  }
})

test('종료 거래와 자세한 지표의 숫자 형식을 검증하고 원래 nullable 지표는 보존한다', () => {
  const input = selection('f1', 365), original = computeCatalogueBacktest(input, data)
  expect(original.result.trades.length).toBeGreaterThan(0)
  for (const field of ['ep', 'xp', 'cost', 'got', 'pnl', 'lev']) for (const invalid of [null, NaN, Infinity, '1']) {
    const value = structuredClone(original); Reflect.set(value.result.trades[0], field, invalid)
    expect.soft(validCatalogueBacktestObservation(value, input), `trade/${field}/${String(invalid)}`).toBe(false)
  }
  for (const field of ['ep', 'xp', 'cost', 'lev']) for (const invalid of [0, -1]) {
    const value = structuredClone(original); Reflect.set(value.result.trades[0], field, invalid)
    expect.soft(validCatalogueBacktestObservation(value, input), `trade/${field}/${invalid}`).toBe(false)
  }
  for (const field of ['pf', 'cagr', 'exposure', 'costImpact', 'underwaterDays', 'avgHold']) {
    for (const invalid of [undefined, NaN, Infinity, '1']) {
      const value = structuredClone(original); Reflect.set(value.result, field, invalid)
      expect.soft(validCatalogueBacktestObservation(value, input), `metric/${field}/${String(invalid)}`).toBe(false)
    }
    const nullable = structuredClone(original); Reflect.set(nullable.result, field, null)
    expect(validCatalogueBacktestObservation(nullable, input), `nullable/${field}`).toBe(true)
  }
  const liquidation = structuredClone(original); liquidation.result.trades[0].got = 0
  expect(validCatalogueBacktestObservation(liquidation, input), 'zero proceeds is a supported display value').toBe(true)
})

class Port {
  onmessage: ((e: MessageEvent<CatalogueBacktestReply>) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  onmessageerror: ((e: MessageEvent) => void) | null = null
  sent: CatalogueBacktestRequest[] = []; terminated = 0
  postMessage(v: CatalogueBacktestRequest) { this.sent.push(v) }
  terminate() { this.terminated++ }
  reply(value: CatalogueBacktestObservation, requestId: number) { this.onmessage?.({ data: { kind: 'result', value, requestId } } as MessageEvent<CatalogueBacktestReply>) }
}
test('Worker 불완전 evidence거절·취소 late무시·owner분리·재귀freeze 보존', async () => {
  const badPort = new Port(), bad = createCatalogueBacktestClient(() => badPort)
  const pending = bad.run(selection()), incomplete = structuredClone(computeCatalogueBacktest(selection(), data))
  Reflect.deleteProperty(incomplete, 'evidence'); badPort.reply(incomplete, 1)
  await expect(pending).rejects.toThrow('자료를 확인'); expect(badPort.terminated).toBe(1); bad.dispose()
  const port = new Port(), client = createCatalogueBacktestClient(() => port), abort = new AbortController()
  const old = client.run(selection(), abort.signal); abort.abort(); await expect(old).rejects.toMatchObject({ name: 'AbortError' })
  const input = selection('f1', 730), next = client.run(input)
  port.reply(computeCatalogueBacktest(selection(), data), 1)
  port.reply(structuredClone(computeCatalogueBacktest(input, data)), 2)
  const value = await next
  expect(value.owner).toBe(input.owner); expect(Object.isFrozen(value.evidence.decisions[0].facts[0])).toBe(true)
  expect(Object.isFrozen(value.evidence.prices.series[0].values)).toBe(true); client.dispose()
})

test('실제Worker 16관측은 같은runtime 결과와 정확히 일치하며 외부/API 요청을 하지 않는다', async ({ page }, info) => {
  const unwanted: string[] = [], origin = new URL(info.project.use.baseURL!).origin
  page.on('request', request => {
    if (request.method() !== 'GET' || new URL(request.url()).origin !== origin || new URL(request.url()).pathname.startsWith('/api/')) unwanted.push(request.method() + ' ' + new URL(request.url()).pathname)
  })
  await page.route('**/evidence-worker-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><title>Source evidence worker fixture</title></head><body></body></html>' }))
  await page.goto('/evidence-worker-fixture.html')
  const observations = await page.evaluate(async () => {
    const portPath = '/src/client-catalogue-backtest.ts', resultPath = '/src/client-catalogue-backtest-result.ts', dataPath = '/src/client-catalogue-market-data.ts'
    const [port, result, source] = await Promise.all([import(/* @vite-ignore */ portPath), import(/* @vite-ignore */ resultPath), import(/* @vite-ignore */ dataPath)])
    const data = await source.loadCatalogueMarketData(), client = port.createCatalogueBacktestClient()
    const rows: Array<{ id: string; period: number; equal: boolean; valid: boolean; frozen: boolean; decisions: number; bytes: number }> = []
    try {
      for (const strategyId of ['r1', 'd1', 'f1', 'f7']) for (const period of [90, 365, 730, 0]) {
        const input = { owner: 'evidence-worker-fixture', strategyId, period, amount: 3000 }
        const observed = await client.run(input), expected = result.computeCatalogueBacktest(input, data)
        rows.push({ id: strategyId, period, equal: JSON.stringify(observed) === JSON.stringify(expected), valid: port.validCatalogueBacktestObservation(observed, input),
          frozen: Object.isFrozen(observed.evidence) && Object.isFrozen(observed.evidence.decisions[0]?.facts) && Object.isFrozen(observed.evidence.prices.series[0].values),
          decisions: observed.evidence.decisions.length, bytes: new TextEncoder().encode(JSON.stringify(observed)).length })
      }
    } finally { client.dispose() }
    return rows
  })
  await info.attach('worker-evidence-observations', { body: JSON.stringify(observations), contentType: 'application/json' })
  expect(observations).toHaveLength(16)
  expect(observations.every(row => row.equal && row.valid && row.frozen)).toBe(true)
  expect(unwanted).toEqual([])
})
