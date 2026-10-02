import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { catalogueAssets, catalogueStrategies, catalogueSourceSha, findCatalogueStrategy, readCatalogueStrategy, type CatalogueFutureRule } from '../src/client-catalogue'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import source from '../src/client-catalogue-source.json' with { type: 'json' }
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }
import golden from './fixtures/catalogue-futures-golden.json' with { type: 'json' }
import common from './fixtures/catalogue-source-runtime.json' with { type: 'json' }
import reference from './fixtures/catalogue-futures-runtime.json' with { type: 'json' }

function canonical(v: unknown): unknown {
  return v === null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(canonical)
    : Object.fromEntries(Object.entries(v).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, value]) => [k, canonical(value)]))
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
const data = new CatalogueMarketData(spot, futures)

for (const fixture of golden.rows) test(`${fixture.id} ${fixture.period}: 선물 원본 전체 곡선·체결·판단·펀딩·지표 golden`, () => {
  const c = findCatalogueStrategy(fixture.id)!
  if (!c.fut) throw Error('fixture')
  const result = runCatalogueFuturesPreview(c, data, fixture.startI)
  const { eq, trades, events, state, sortino, lowVolLosses, lowVolLossShare, ...metrics } = result
  expect([sortino, lowVolLosses, lowVolLossShare]).toEqual([null, null, null])
  for (const [key, values] of Object.entries({ eq, trades, events, state, metrics })) expect(hash(values), key).toBe(fixture.hashes[key as keyof typeof fixture.hashes])
  expect(result.n).toBe(fixture.n); expect(result.ret).toBeCloseTo(fixture.ret, 10)
  for (const e of events) {
    expect(e).not.toHaveProperty('_pend'); expect(e).not.toHaveProperty('_drop')
    if (e.t === 'enter') {
      expect(e.xi).toBe(e.i + 1)
      const d = data.future.sym[e.a!]
      expect(e.px).toBe(d.o[e.xi!] * (1 + e.side! * 0.0005))
    }
  }
  for (const t of trades) {
    expect(t.exit).toBeGreaterThanOrEqual(t.entry)
    expect(t.pnl).toBe(t.got / t.cost - 1); expect(t.pnl).toBeGreaterThanOrEqual(-1)
    expect(Math.sign(t.units)).toBe(t.side); expect(t.fund).toEqual(expect.any(Number))
    expect(catalogueAssets(c)).toContain(t.asset)
  }
})

test('선물30개 golden을 보관된 원함수에서 재현하고 현물 엔진과 혼용하지 않는다', () => {
  expect(createHash('sha256').update(reference.code).digest('hex')).toBe(reference.codeSha256)
  expect(reference.sha).toBe(catalogueSourceSha)
  const context = vm.createContext({ TETH_PX: spot, TETH_FUT: futures, PRICE0: spot.px['비트코인'], MK_UNI: source.universes, mkPx: (k: keyof typeof spot.px) => spot.px[k] })
  context.window = context
  vm.runInContext(common.code + '\n' + reference.code, context, { timeout: 1000 })
  for (const fixture of golden.rows) {
    context.config = source.catalogue.find(c => c.id === fixture.id); context.start = fixture.startI
    const { eq, trades, events, state, ...metrics } = vm.runInContext('mkRunCfg(config,start)', context, { timeout: 1000 })
    delete metrics.sortino; delete metrics.lowVolLosses; delete metrics.lowVolLossShare
    for (const [key, values] of Object.entries({ eq, trades, events, state, metrics })) expect(hash(values), `${fixture.id}/${fixture.period}/${key}`).toBe(fixture.hashes[key as keyof typeof fixture.hashes])
  }
  expect(() => runCatalogueFuturesPreview(findCatalogueStrategy('r1') as CatalogueFutureRule, data)).toThrow('spot not accepted')
  for (const start of [NaN, Infinity, -1, 1.5, data.length]) expect(() => runCatalogueFuturesPreview(findCatalogueStrategy('f1') as CatalogueFutureRule, data, start)).toThrow()
})

const scenario = () => {
  const f = structuredClone(futures), d = f.sym['비트코인']
  d.o.fill(100); d.h.fill(100); d.l.fill(100); d.c.fill(100); d.f.fill(0)
  d.o[61] = 100; d.h[61] = 103; d.l[61] = 99; d.c[61] = 102
  const c: CatalogueFutureRule = { id: 'test', kind: 'rule', mkt: 'crypto', name: 'fixture', one: 'fixture', ex: 'bitget', fw: 0, by: 'fixture', startI: 61, asset: '비트코인', fut: 1, inst: 'futures', mode: 'brk', n: 2, lev: 2 }
  return { f, d, c }
}

test('진입 다음날 같은 봉에서 손절과 익절을 모두 건드리면 손절을 먼저 반영한다', () => {
  const { f, d, c } = scenario(); d.o[62] = 102; d.h[62] = 120; d.l[62] = 80; d.c[62] = 102
  const result = runCatalogueFuturesPreview({ ...c, sl: 10, tp: 10 }, new CatalogueMarketData(spot, f))
  expect(result.events[0]).toMatchObject({ t: 'enter', i: 61, xi: 62, side: 1, px: 102 * 1.0005 })
  expect(result.trades[0]).toMatchObject({ entry: 62, exit: 62, side: 1, kind: 'sl' })
  expect(result.trades[0].xp).toBe(result.trades[0].ep * 0.9 * 0.9995)
})

test('시가 갭 청산은 시가·격리증거금 손실로 처리하고 미래 봉에 잔고를 복원하지 않는다', () => {
  const { f, d, c } = scenario()
  d.o[62] = 102; d.h[62] = 103; d.l[62] = 101; d.c[62] = 102
  d.o[63] = 30; d.h[63] = 31; d.l[63] = 29; d.c[63] = 30
  const r = runCatalogueFuturesPreview(c, new CatalogueMarketData(spot, f))
  expect(r.trades[0]).toMatchObject({ entry: 62, exit: 63, kind: 'liq', xp: 30, got: 0, pnl: -1 })
  expect(r.liqN).toBe(1); expect(r.eq.filter(e => e.i >= 63).every(e => e.v === 0)).toBe(true)
  expect(r.ret).toBe(-100)
})

test('펀딩은 보유 중 매일 합산하며 양수 펀딩의 롱/숏 부호가 반대다', () => {
  for (const side of [1, -1]) {
    const { f, d, c } = scenario()
    for (let i = 61; i < d.c.length; i++) { const p = side === 1 ? 102 : 98; d.o[i] = p; d.h[i] = p; d.l[i] = p; d.c[i] = p }
    d.f[62] = 1; d.f[63] = 2
    const r = runCatalogueFuturesPreview(c, new CatalogueMarketData(spot, f))
    expect(r.events[0]).toMatchObject({ t: 'enter', i: 61, xi: 62, side })
    const fill = r.events[0]
    expect(r.fundPaid).toBeCloseTo(side * fill.units! * d.c[62] * 3 / 1e4, 14)
    expect(r.trades).toHaveLength(0)
    expect(r.state.open).not.toBeNull()
  }
})

test('선물 재평가 날짜는 기간 시작일이 달라도 달력 phase에 고정되고 미래정보를 읽지 않는다', () => {
  const c = findCatalogueStrategy('f7')!
  if (!c.fut || c.kind !== 'agent') throw Error('fixture')
  const all = runCatalogueFuturesPreview(c, data), year = runCatalogueFuturesPreview(c, data, data.length - 366)
  for (const r of [all, year]) for (const e of r.events) expect((e.i + (c.ph ?? 0)) % c.every).toBe(0)
  const f = structuredClone(futures), cutoff = 1000
  for (const d of Object.values(f.sym)) for (const key of ['o', 'h', 'l', 'c'] as const) for (let i = cutoff + 1; i < d[key].length; i++) d[key][i] *= 2
  const changed = new CatalogueMarketData(spot, f)
  for (const cfg of catalogueStrategies.filter(c => c.fut)) {
    if (!cfg.fut) continue
    const before = runCatalogueFuturesPreview(cfg, data), after = runCatalogueFuturesPreview(cfg, changed)
    expect(after.eq.filter(e => e.i <= cutoff)).toEqual(before.eq.filter(e => e.i <= cutoff))
    expect(after.trades.filter(t => t.exit <= cutoff)).toEqual(before.trades.filter(t => t.exit <= cutoff))
    expect(after.events.filter(e => (e.xi ?? e.i) <= cutoff)).toEqual(before.events.filter(e => (e.xi ?? e.i) <= cutoff))
  }
})

test('카탈로그 외 원본 FG·dip·방향 제한·중립 배분 분기도 원함수와 동등하다', () => {
  const context = vm.createContext({ TETH_PX: spot, TETH_FUT: futures, PRICE0: spot.px['비트코인'], MK_UNI: source.universes })
  context.window = context
  vm.runInContext(common.code + '\n' + reference.code, context, { timeout: 1000 })
  const base = scenario().c
  const configs = [
    { ...base, mode: 'fg', lo: 30, hi: 70, hold: 25, sl: 8, tp: 15 },
    { ...base, mode: 'fg', lo: 20, hi: 80, dir: 'short', reg: 60 },
    { ...base, mode: 'dip', n: 20, dip: 10, hold: 25, trail: 12 },
    { ...base, mode: 'dip', n: 40, dip: 15, dir: 'long', exitN: 10 },
    { ...findCatalogueStrategy('f7')!, neutral: true, top: 2, ph: 1 },
    { ...findCatalogueStrategy('f9')!, dir: 'short', ph: 2 },
    { ...findCatalogueStrategy('f5')!, mode: 'fg', lo: 30, hi: 70 },
    { ...findCatalogueStrategy('f5')!, mode: 'dip', n: 20, dip: 10 },
  ]
  for (const raw of configs) {
    const c = readCatalogueStrategy(raw); if (!c.fut) throw Error('fixture')
    context.config = raw
    const referenceResult = vm.runInContext('mkRunCfg(config)', context, { timeout: 1000 })
    Object.assign(referenceResult, { sortino: null, lowVolLosses: null, lowVolLossShare: null })
    expect(hash(runCatalogueFuturesPreview(c, data))).toBe(hash(referenceResult))
  }
  for (const fields of [{ mode: 'fg', lo: 70, hi: 30 }, { mode: 'fg', lo: NaN, hi: 80 }, { mode: 'dip', dip: 0 }, { mode: 'dip', n: 0, dip: 10 }, { mode: 'unknown' }]) expect(() => readCatalogueStrategy({ ...base, ...fields })).toThrow()
})
