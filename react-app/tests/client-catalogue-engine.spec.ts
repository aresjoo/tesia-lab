import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { catalogueAssets, catalogueSourceSha, catalogueStrategies, catalogueTitle, catalogueUniverses, findCatalogueStrategy, readCatalogueStrategy, type CatalogueSpotStrategy } from '../src/client-catalogue'
import { CatalogueMarketData, loadCatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { catalogueSpotLedger } from '../src/client-catalogue-ledger'
import source from '../src/client-catalogue-source.json' with { type: 'json' }
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }
import golden from './fixtures/catalogue-spot-golden.json' with { type: 'json' }
import reference from './fixtures/catalogue-source-runtime.json' with { type: 'json' }

function canonical(v: unknown): unknown {
  return v === null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(canonical)
    : Object.fromEntries(Object.entries(v).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, value]) => [k, canonical(value)]))
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
const data = new CatalogueMarketData(spot, futures)
const spots = catalogueStrategies.filter((c): c is Readonly<CatalogueSpotStrategy> => !c.fut)
const rule = () => { const c = findCatalogueStrategy('r1')!; if (c.kind !== 'rule' || c.fut) throw Error('fixture'); return c }

test('31개 원본의 행동값·순서·심볼명·별칭을 보존하고 legacy RSI로 치환하지 않는다', () => {
  expect(catalogueSourceSha).toBe('412fd6042e0b3935773831f43163a7da68191162')
  expect(catalogueStrategies).toHaveLength(31); expect(spots).toHaveLength(21)
  for (const [kind, n] of [['rule', 16], ['agent', 8], ['mix', 7]] as const) expect(catalogueStrategies.filter(c => c.kind === kind)).toHaveLength(n)
  for (const [index, c] of catalogueStrategies.entries()) {
    const raw = source.catalogue[index]
    expect(c).toEqual({ ...raw, name: catalogueTitle(raw.name) })
    expect(findCatalogueStrategy(raw.name)).toBe(c); expect(findCatalogueStrategy(c.id)).toBe(c)
    expect(findCatalogueStrategy(c.name)).toBe(c); expect(Object.isFrozen(c)).toBe(true)
    expect(catalogueAssets(c).length).toBeGreaterThan(0)
    if (c.kind === 'agent' || c.fut) expect(c).not.toHaveProperty('rsiTh')
  }
  for (const [alias, id] of Object.entries(source.aliases)) expect(findCatalogueStrategy(alias)?.id).toBe(id)
  for (const name of ['세븐틴층', '__proto__', 'constructor', 'f11', 'BTC', '']) expect(findCatalogueStrategy(name)).toBeUndefined()
  expect(Object.isFrozen(catalogueUniverses.coin8.list)).toBe(true)
})

test('정의의 잘못된 분류·범위·시장·수량을 조용히 다른 전략으로 보정하지 않는다', () => {
  const base = rule()
  for (const delta of [{ kind: 'AI' }, { mkt: 'unknown' }, { ex: 'other' }, { startI: 3.5 }, { asset: '' }, { asset: '__proto__' }, { asset: 'unknown' }, { uni: 'coin8' }, { rsiTh: NaN }, { rsiTh: 101 }, { tp: undefined }, { sl: 1 }, { tf: true }, { fut: 0 }, { fw: -1 }]) expect(() => readCatalogueStrategy({ ...base, ...delta })).toThrow()
  const agent = findCatalogueStrategy('d1')!
  for (const delta of [{ uni: '__proto__' }, { top: 9 }, { every: 0 }, { look: 1 }, { gate: 1.1 }, { volT: 0 }, { trail: Infinity }]) expect(() => readCatalogueStrategy({ ...agent, ...delta })).toThrow()
  expect(() => runCatalogueSpotPreview(findCatalogueStrategy('f1') as CatalogueSpotStrategy, data)).toThrow('futures not accepted')
  for (const start of [NaN, Infinity, -1, 0.5, data.length]) expect(() => runCatalogueSpotPreview(base, data, start)).toThrow()
})

test('원본 데이터 bytes 의미·기준일·휴장일을 고정하고 lazy 요청은 한 번만 준비한다', async () => {
  expect(hash(spot)).toBe(golden.spotSha256); expect(hash(futures)).toBe(golden.futuresSha256)
  expect(data.length).toBe(1367)
  expect(data.date(0).toISOString().slice(0, 10)).toBe('2023-01-01')
  expect(data.date(data.length - 1).toISOString().slice(0, 10)).toBe('2026-09-28')
  expect(data.date(data.length).toISOString().slice(0, 10)).toBe('2026-09-29')
  expect(data.isOpen('비트코인', 0)).toBe(true); expect(data.isOpen('나스닥', 0)).toBe(false)
  expect(data.isOpen('나스닥', 2)).toBe(true)
  const first = loadCatalogueMarketData(), second = loadCatalogueMarketData()
  expect(second).toBe(first); expect(await second).toBe(await first)
  expect(Object.isFrozen(data.spot.px['비트코인'])).toBe(true)
})

test('데이터 누락·날짜 불일치·OHLC 불량은 BTC/합성값으로 대신하지 않는다', () => {
  const px = structuredClone(spot), fut = structuredClone(futures)
  const missing = structuredClone(px); delete (missing.px as Record<string, number[]>)['이더리움']
  expect(() => new CatalogueMarketData(missing, fut)).toThrow('missing asset')
  for (const value of [0, -1, NaN, Infinity]) { const bad = structuredClone(px); bad.px['비트코인'][0] = value; expect(() => new CatalogueMarketData(bad, fut)).toThrow('invalid series') }
  const short = structuredClone(px); short.px['비트코인'].pop(); expect(() => new CatalogueMarketData(short, fut)).toThrow('invalid series')
  const mask = structuredClone(px); mask.open['테슬라'] = '1'; expect(() => new CatalogueMarketData(mask, fut)).toThrow('calendar')
  const noMask = structuredClone(px); delete (noMask.open as Record<string, string>)['테슬라']; expect(() => new CatalogueMarketData(noMask, fut)).toThrow('calendar')
  expect(() => new CatalogueMarketData({ ...px, asof: '2026-02-30' }, fut)).toThrow('invalid date')
  expect(() => new CatalogueMarketData(px, { ...fut, asof: '2026-09-27' })).toThrow('mismatched range')
  const ohlc = structuredClone(fut); ohlc.sym['비트코인'].h[0] = 1; expect(() => new CatalogueMarketData(px, ohlc)).toThrow('OHLC')
  for (const name of ['없는 종목', '__proto__']) expect(() => data.prices(name)).toThrow('missing asset')
  for (const i of [-1, 0.5, data.length]) expect(() => data.isOpen('비트코인', i)).toThrow('day index')
  px.px['비트코인'][0] = 1; expect(data.prices('비트코인')[0]).toBe(spot.px['비트코인'][0])
})

for (const fixture of golden.rows) test(`${fixture.id} ${fixture.period}: 원본 전체 잔고·체결·판단·현재상태·지표 golden`, () => {
  const c = spots.find(c => c.id === fixture.id)!
  const result = runCatalogueSpotPreview(c, data, fixture.startI)
  const { eq, trades, events, state, sortino, lowVolLosses, lowVolLossShare, ...metrics } = result
  expect([sortino, lowVolLosses, lowVolLossShare]).toEqual([null, null, null])
  for (const [key, values] of Object.entries({ eq, trades, events, state, metrics })) expect(hash(values), key).toBe(fixture.hashes[key as keyof typeof fixture.hashes])
  expect(result.n).toBe(fixture.n); expect(result.ret).toBeCloseTo(fixture.ret, 10)
  expect(eq).toHaveLength(data.length - fixture.startI)
  for (const e of events) if (e.t === 'enter' || e.t === 'exit') {
    expect(e.xi).toBeGreaterThan(e.i); expect(data.isOpen(e.a!, e.xi!)).toBe(true)
    expect(e.px).toBe(data.prices(e.a!)[e.xi!]); expect(e).not.toHaveProperty('_pend'); expect(e).not.toHaveProperty('_drop')
  }
  expect(trades.every(t => t.entry < t.exit && t.pnl === t.got / t.cost - 1 && t.fee > 0)).toBe(true)
})

test('고정 golden은 보관된 원본 함수로 재현된다; 원본 0 placeholder는 계산 지표가 아니다', () => {
  expect(createHash('sha256').update(reference.code).digest('hex')).toBe(reference.codeSha256)
  expect(reference.sha).toBe(catalogueSourceSha)
  const context = vm.createContext({ TETH_PX: spot, PRICE0: spot.px['비트코인'], MK_UNI: source.universes, mkPx: (k: keyof typeof spot.px) => spot.px[k] })
  context.window = context
  vm.runInContext(reference.code, context, { timeout: 1000 })
  for (const fixture of golden.rows) {
    context.config = source.catalogue.find(c => c.id === fixture.id); context.start = fixture.startI
    const result = vm.runInContext('mkRunCfg(config,start)', context, { timeout: 1000 })
    expect([result.sortino, result.lowVolLosses, result.lowVolLossShare]).toEqual([0, 0, 0])
    const { eq, trades, events, state, ...metrics } = result
    delete metrics.sortino; delete metrics.lowVolLosses; delete metrics.lowVolLossShare
    for (const [key, values] of Object.entries({ eq, trades, events, state, metrics })) expect(hash(values), `${fixture.id}/${fixture.period}/${key}`).toBe(fixture.hashes[key as keyof typeof fixture.hashes])
  }
})

test('판단 다음 거래일에 체결하고 매수·매도 수수료를 같은 원장에 기록한다', () => {
  const px = structuredClone(spot), prices = px.px['비트코인']; prices.fill(100)
  prices[61] = 90; prices[62] = 91; prices[63] = 95; prices[64] = 100; prices[65] = 99
  const input = new CatalogueMarketData(px, futures), result = runCatalogueSpotPreview({ ...rule(), startI: 61, rsiTh: 50, tp: 1, sl: -20, tf: 0 }, input)
  expect(result.events[0]).toMatchObject({ t: 'enter', i: 62, xi: 63, px: 95 })
  expect(result.events[1]).toMatchObject({ t: 'exit', i: 64, xi: 65, px: 99 })
  const trade = result.trades[0]
  expect(trade.units).toBeCloseTo(1 / (95 * 1.001), 14)
  expect(trade.got).toBeCloseTo(trade.units * 99 * 0.999, 14)
  expect(trade.pnl).toBeCloseTo(trade.got - 1, 14)
})

test('휴장일에는 대기하고 마지막 미체결 신호를 거래나 확정 사건으로 만들지 않는다', () => {
  const px = structuredClone(spot), p = px.px['비트코인']; p.fill(100)
  p[61] = 90; p[62] = 91; p[63] = 91; p[64] = 91; p[65] = 95
  const mask = Array(data.length).fill('1'); mask[63] = '0'; mask[64] = '0'
  Object.assign(px.open, { 비트코인: mask.join('') }); px.meta['비트코인'].real -= 2; px.meta['비트코인'].filled = 2
  const r = runCatalogueSpotPreview({ ...rule(), startI: 61, rsiTh: 50, tp: 1, sl: -20, tf: 0 }, new CatalogueMarketData(px, futures))
  expect(r.events[0]).toMatchObject({ i: 62, xi: 65, px: 95 })
  const tail = structuredClone(spot); tail.px['비트코인'].fill(100); tail.px['비트코인'][data.length - 2] = 90; tail.px['비트코인'][data.length - 1] = 91
  const last = runCatalogueSpotPreview({ ...rule(), startI: data.length - 1 }, new CatalogueMarketData(tail, futures))
  expect(last.events).toEqual([]); expect(last.trades).toEqual([]); expect(last.ret).toBe(0)
})

test('원장을 중복 매도할 수 없고 입력과 다른 실행의 결과를 변경하지 않는다', () => {
  const ledger = catalogueSpotLedger(), p = ledger.buy('비트코인', 100, 1, 1)!
  ledger.sell(p, 101, 2, 'tp'); expect(() => ledger.sell(p, 101, 2, 'tp')).toThrow('not held')
  for (const price of [NaN, Infinity, 0]) expect(() => ledger.buy('비트코인', price, 1, 3)).toThrow('bad fill')
  const first = runCatalogueSpotPreview(rule(), data), original = hash(first)
  for (const c of spots) runCatalogueSpotPreview(c, data)
  expect(hash(first)).toBe(original); expect(hash(runCatalogueSpotPreview(rule(), data))).toBe(original)
  expect(hash(spot)).toBe(golden.spotSha256)
})

test('미래 가격 변경은 그 이전 체결·판단·잔고를 바꾸지 않는다', () => {
  const px = structuredClone(spot), cutoff = 1000
  for (const p of Object.values(px.px)) for (let i = cutoff + 1; i < p.length; i++) p[i] *= 2
  const changed = new CatalogueMarketData(px, futures)
  for (const id of ['r1', 'd1', 'h2']) {
    const c = spots.find(c => c.id === id)!, before = runCatalogueSpotPreview(c, data), after = runCatalogueSpotPreview(c, changed)
    expect(after.eq.filter(e => e.i <= cutoff)).toEqual(before.eq.filter(e => e.i <= cutoff))
    expect(after.trades.filter(t => t.exit <= cutoff)).toEqual(before.trades.filter(t => t.exit <= cutoff))
    expect(after.events.filter(e => (e.xi ?? e.i) <= cutoff)).toEqual(before.events.filter(e => (e.xi ?? e.i) <= cutoff))
  }
})
