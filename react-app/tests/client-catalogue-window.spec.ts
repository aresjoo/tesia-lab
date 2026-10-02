import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { catalogueStrategies } from '../src/client-catalogue'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { sliceCataloguePreview } from '../src/client-catalogue-window'
import source from '../src/client-catalogue-source.json' with { type: 'json' }
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }
import common from './fixtures/catalogue-source-runtime.json' with { type: 'json' }
import futureRuntime from './fixtures/catalogue-futures-runtime.json' with { type: 'json' }
import reference from './fixtures/catalogue-window-runtime.json' with { type: 'json' }
import golden from './fixtures/catalogue-window-golden.json' with { type: 'json' }

function canonical(v: unknown): unknown {
  return v === null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(canonical)
    : Object.fromEntries(Object.entries(v).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, value]) => [k, canonical(value)]))
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
const data = new CatalogueMarketData(spot, futures)
const runs = new Map(catalogueStrategies.map(c => [c.id, c.fut ? runCatalogueFuturesPreview(c, data) : runCatalogueSpotPreview(c, data)]))
function values(r: ReturnType<typeof sliceCataloguePreview>) {
  return { eq: r.eq, trades: r.trades, events: r.events, state: r.state, metrics: { ret: r.ret, mdd: r.mdd, n: r.n, winRate: r.winRate, params: r.params, mddStartI: r.mddStartI, byYear: r.byYear } }
}

for (const fixture of golden.rows) test(`${fixture.id} ${fixture.period}: 재실행 대신 원본 운용 곡선을 자르는 기간 표시`, () => {
  const full = runs.get(fixture.id)!, days = fixture.period === '7d' ? 7 : 30, r = sliceCataloguePreview(full, days)
  for (const [key, v] of Object.entries(values(r))) expect(hash(v), key).toBe(fixture.hashes[key as keyof typeof fixture.hashes])
  expect(r.ret).toBe(fixture.ret); expect(r.n).toBe(fixture.n); expect(r.params.startI).toBe(fixture.startI)
  expect(r.eq).toHaveLength(days + 1); expect(r.eq[0].v).toBe(1)
  expect(r.trades).toEqual(full.trades.filter(t => t.exit > fixture.startI))
  expect(r.events).toBe(full.events); expect(r.state).toBe(full.state)
  expect([r.pf, r.sharpe, r.cagr, r.avgHold, r.costImpact, r.lowVolLosses]).toEqual([null, null, null, null, null, null])
  if ('fut' in r) expect([r.feesPaid, r.fundPaid, r.liqN]).toEqual([null, null, null])
})

test('기간 golden은 최종 mkSlice 원함수로 재현되고 원본의 기간 밖 지표를 재명명하지 않는다', () => {
  expect(createHash('sha256').update(reference.code).digest('hex')).toBe(reference.codeSha256)
  const context = vm.createContext({ TETH_PX: spot, TETH_FUT: futures, PRICE0: spot.px['비트코인'], MK_UNI: source.universes, mkPx: (k: keyof typeof spot.px) => spot.px[k] })
  context.window = context
  vm.runInContext(common.code + '\n' + futureRuntime.code + '\n' + reference.code, context, { timeout: 1000 })
  for (const fixture of golden.rows) {
    context.config = source.catalogue.find(c => c.id === fixture.id); context.days = fixture.period === '7d' ? 7 : 30
    const r = vm.runInContext('mkSlice({r:mkRunCfg(config)},days)', context, { timeout: 1000 })
    for (const [key, v] of Object.entries(values(r))) expect(hash(v)).toBe(fixture.hashes[key as keyof typeof fixture.hashes])
  }
})

test('구간 전 진입·구간 안 청산을 보존하고 기간 시작에 새로 매수한 것처럼 바꾸지 않는다', () => {
  let crossing = 0, different = 0
  for (const c of catalogueStrategies) {
    const r = sliceCataloguePreview(runs.get(c.id)!, 30)
    crossing += r.trades.filter(t => t.entry < r.params.startI).length
    const restarted = c.fut ? runCatalogueFuturesPreview(c, data, r.params.startI) : runCatalogueSpotPreview(c, data, r.params.startI)
    if (restarted.ret !== r.ret) different++
  }
  expect(crossing).toBeGreaterThan(0); expect(different).toBeGreaterThan(0)
})

test('짧거나 끊긴 자료·0인 시작 잔고는 다른 기간 성과로 대신하지 않는다', () => {
  const full = runs.get('r1')!, before = hash(full)
  expect(() => sliceCataloguePreview({ ...full, eq: full.eq.slice(-3) }, 7)).toThrow('insufficient equity')
  const bad = structuredClone(full); bad.eq[bad.eq.length - 8].v = 0
  expect(() => sliceCataloguePreview(bad, 7)).toThrow('insufficient equity')
  const gap = structuredClone(full); gap.eq[gap.eq.length - 3].i--
  expect(() => sliceCataloguePreview(gap, 7)).toThrow('invalid equity')
  expect(hash(full)).toBe(before)
})
