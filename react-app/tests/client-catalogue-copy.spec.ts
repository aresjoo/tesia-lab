import { expect, test } from '@playwright/test'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { catalogueStrategies, catalogueSourceSha, type CatalogueStrategy } from '../src/client-catalogue'
import { CatalogueMarketData } from '../src/client-catalogue-market-data'
import { runCatalogueSpotPreview } from '../src/client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from '../src/client-catalogue-futures-engine'
import { catalogueCopyBinding, projectCatalogueCopy, readCatalogueCopyRecord, type CatalogueCopyRecord } from '../src/client-catalogue-copy'
import { createCataloguePreviewClient, type CataloguePreviewResult, type CatalogueWorkerReply, type CatalogueWorkerRequest } from '../src/client-catalogue-preview'
import definitions from '../src/client-catalogue-source.json' with { type: 'json' }
import spot from '../src/client-catalogue-spot-data.json' with { type: 'json' }
import futures from '../src/client-catalogue-futures-data.json' with { type: 'json' }
import common from './fixtures/catalogue-source-runtime.json' with { type: 'json' }
import futureRuntime from './fixtures/catalogue-futures-runtime.json' with { type: 'json' }
import reference from './fixtures/catalogue-copy-runtime.json' with { type: 'json' }

const data = new CatalogueMarketData(spot, futures), owner = 'catalogue-owner'
function source(strategy: Readonly<CatalogueStrategy>): CataloguePreviewResult {
  return { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v },
    strategy, period: 'all', calculation: 'full-run', contextPeriod: 'selected', result: strategy.fut ? runCatalogueFuturesPreview(strategy, data) : runCatalogueSpotPreview(strategy, data) }
}
function record(s: CataloguePreviewResult, existing: 'skip' | 'copy' = 'skip'): CatalogueCopyRecord {
  const startI = data.length - 101
  return { model: 'catalogue-units-preview', owner, id: `copy-${s.strategy.id}`, binding: catalogueCopyBinding(s), startI,
    settings: { amount: 1000, loss: -20, existing, cap: 95 }, status: 'active', ledger: [{ at: 1, i: startI, type: 'add', amount: 1000 }], flats: [] }
}
const hash = (code: string) => createHash('sha256').update(code).digest('hex')

test('복사 기준 함수 SHA/bytes와 두 원본 엔진은 동일 관측 세대다', () => {
  for (const fixture of [common, futureRuntime, reference]) {
    expect(fixture.sha).toBe(catalogueSourceSha); expect(hash(fixture.code)).toBe(fixture.codeSha256)
  }
})

for (const strategy of catalogueStrategies) test(`${strategy.id}: 원본 엔진+복사 함수와 8개 복사 원장·시점 대조`, () => {
  const s = source(strategy)
  // Independent baseline executes the archived HTML engines, NOT TS outputs.
  const context = vm.createContext({ TETH_PX: spot, TETH_FUT: futures, PRICE0: spot.px['비트코인'], MK_UNI: definitions.universes,
    mkPx: (k: keyof typeof spot.px) => spot.px[k], cpMeta: () => ({ share: .1 }), config: definitions.catalogue.find(c => c.id === strategy.id) })
  context.window = context
  vm.runInContext(common.code + '\n' + futureRuntime.code + '\n' + reference.code + '\nvar original=mkRunCfg(config); function tfSSFind(){ return {kind:config.kind,r:original}; }', context, { timeout: 3000 })
  for (const existing of ['skip', 'copy'] as const) for (const mode of ['active', 'flats', 'winding', 'closed']) {
    const c = record(s, existing), i = c.startI
    c.ledger.push({ at: 2, i: i + 10, type: 'add', amount: 250 }, { at: 3, i: i + 35, type: 'out', amount: 25 })
    if (mode !== 'active') c.flats = [i + 15, i + 35]
    if (mode === 'winding') c.stopI = i + 50
    if (mode === 'closed') { c.status = 'closed'; c.endI = i + 80 }
    const indices = [i, i + 10, i + 35, i + 60, data.length - 1]
    const actual = projectCatalogueCopy(c, owner, s, data, indices)
    context.copy = { nick: strategy.id, simStartI: i, status: c.status, adv: { existing }, flats: c.flats, stopI: c.stopI, endI: c.endI, ledger: c.ledger.map(e => ({ ...e, amt: e.amount })) }
    context.indices = indices
    const expected = vm.runInContext('var answer=cpCalc(copy); JSON.stringify({calculation:Object.fromEntries(Object.entries(answer).filter(([k])=>k!=="at")),observations:indices.map(i=>({i,value:answer.at(i)}))})', context, { timeout: 3000 })
    expect({ calculation: actual.calculation, observations: actual.observations }, `${existing}/${mode}`).toEqual(JSON.parse(expected))
    expect(actual.limitations).toContain('RISK_SETTINGS_NOT_ENFORCED')
    expect(actual.limitations.includes('FUTURES_WINDING_SPOT_PRICE_PROXY')).toBe(Boolean(strategy.fut && mode === 'winding'))
    expect(Object.isFrozen(actual.observations[0].value)).toBe(true)
  }
})

test('legacy·타계정·변조·미래봉·축약결과·NaN을 현금잔고로 바꾸지 않는다', () => {
  const s = source(catalogueStrategies[0]), c = record(s)
  for (const delta of [{ model: 'copy-v1' }, { owner: 'other' }, { id: '' }, { id: 'a\nb' }, { extra: 1 }, { ledger: [] }, { flats: [c.startI, c.startI] }, { status: 'closed' },
    { ledger: [{ at: 0, i: c.startI, type: 'out', amount: 1000 }] }, { settings: { ...c.settings, cap: 99 } }, { stopI: c.startI - 1 },
    { binding: { ...c.binding, strategyId: s.strategy.name } }, { binding: { ...c.binding, sourceSha: 'old' } }]) expect(() => readCatalogueCopyRecord({ ...c, ...delta }, owner)).toThrow('unavailable')
  for (const delta of [{ startI: data.length }, { stopI: data.length }, { binding: { ...c.binding, asof: '2026-09-29' } }, { binding: { ...c.binding, futuresVersion: 'other' } }]) expect(() => projectCatalogueCopy({ ...c, ...delta }, owner, s, data)).toThrow('unavailable')
  for (const period of ['7d', '30d', '1y', '2y'] as const) expect(() => projectCatalogueCopy(c, owner, { ...s, period }, data)).toThrow('unavailable')
  for (const bad of [NaN, Infinity]) { const badSource = structuredClone(s); badSource.result.eq[0].v = bad; expect(() => projectCatalogueCopy(c, owner, badSource, data)).toThrow('unavailable') }
  for (const indices of [[c.startI - 1], [data.length], [NaN], Array(33).fill(c.startI)]) expect(() => projectCatalogueCopy(c, owner, s, data, indices)).toThrow('unavailable')
  const frozen = readCatalogueCopyRecord(c, owner); c.ledger[0].amount = 2
  expect(frozen.ledger[0].amount).toBe(1000); expect(Object.isFrozen(frozen.ledger[0])).toBe(true)
})

test('원본 위험 설정을 집행으로 꾸미지 않고 설정값과 계산의 한계를 구분한다', () => {
  const s = source(catalogueStrategies[0]), c = record(s, 'copy')
  const a = projectCatalogueCopy(c, owner, s, data)
  c.settings.loss = -10; c.settings.cap = 5
  const b = projectCatalogueCopy(c, owner, s, data)
  expect(b.calculation).toEqual(a.calculation); expect(b.settings).not.toEqual(a.settings)
  expect(b.limitations).toContain('RISK_SETTINGS_NOT_ENFORCED')
})

test('과대 기록은 합성값·부분합 없이 작업 한도로 거절한다', () => {
  const s = source(catalogueStrategies[0]), c = record(s)
  c.ledger.push(...Array.from({ length: 999 }, (_, k) => ({ at: k + 2, i: c.startI, type: 'add' as const, amount: 1 })))
  c.flats = Array.from({ length: 100 }, (_, i) => c.startI + i)
  expect(() => projectCatalogueCopy(c, owner, s, data)).toThrow('unavailable')
  expect(() => readCatalogueCopyRecord({ ...c, ledger: [...c.ledger, c.ledger.at(-1)] }, owner)).toThrow('unavailable')
})

class FakeWorker {
  onmessage: ((event: MessageEvent<CatalogueWorkerReply>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: ((event: MessageEvent) => void) | null = null
  sent: CatalogueWorkerRequest[] = []; terminated = false
  postMessage(value: CatalogueWorkerRequest) { this.sent.push(value) }
  terminate() { this.terminated = true }
  reply(value: CatalogueWorkerReply) { this.onmessage?.({ data: value } as MessageEvent<CatalogueWorkerReply>) }
}

test('목록·복사가 한 worker를 쓰고 취소·입력 변경·타계정 응답을 분리한다', async () => {
  const s = source(catalogueStrategies[0]), c = record(s), worker = new FakeWorker()
  let created = 0
  const client = createCataloguePreviewClient(() => { created++; return worker })
  const control = new AbortController(), pending = client.copy(owner, c, [c.startI], control.signal)
  const cancelled = expect(pending).rejects.toHaveProperty('name', 'AbortError'), kept = client.run(s.strategy.id, 'all')
  control.abort(); await cancelled
  const expected = projectCatalogueCopy(c, owner, s, data, [c.startI])
  worker.reply({ kind: 'copy-result', requestId: 1, value: expected })
  worker.reply({ kind: 'result', requestId: 2, value: s })
  expect(await kept).toEqual(s); expect(created).toBe(1)
  const copy = client.copy(owner, c, [c.startI])
  c.settings.amount = 500; c.binding.asof = 'changed'; c.ledger[0].amount = 500
  worker.reply({ kind: 'copy-result', requestId: 3, value: expected })
  expect(await copy).toEqual(expected)
  expect(worker.sent[2]).toMatchObject({ kind: 'cancel', requestId: 1 })
  client.dispose(); expect(worker.terminated).toBe(true)
  await expect(client.copy(owner, record(s))).rejects.toHaveProperty('name', 'AbortError')
})

for (const mismatch of ['owner', 'copyId', 'binding', 'settings', 'indices', 'protocol'] as const) test(`복사 응답 ${mismatch} 혼선은 조용히 채택하지 않는다`, async () => {
  const s = source(catalogueStrategies[0]), c = record(s), worker = new FakeWorker(), client = createCataloguePreviewClient(() => worker)
  const promise = client.copy(owner, c, [c.startI]), rejected = expect(promise).rejects.toThrow('preview unavailable')
  const value = structuredClone(projectCatalogueCopy(c, owner, s, data, [c.startI]))
  if (mismatch === 'owner') value.owner = 'other'
  if (mismatch === 'copyId') value.copyId = 'other'
  if (mismatch === 'binding') value.binding.sourceSha = 'other'
  if (mismatch === 'settings') value.settings.cap = 5
  if (mismatch === 'indices') value.observations[0].i++
  worker.reply(mismatch === 'protocol' ? { kind: 'result', requestId: 1, value: s } : { kind: 'copy-result', requestId: 1, value })
  await rejected; expect(worker.terminated).toBe(true); client.dispose()
})

test('실제 worker에서 31종×두 계정 복사·중단·종료는 동일 원본 계산이고 캐시를 섞지 않는다', async ({ page }) => {
  const cases = catalogueStrategies.flatMap((strategy, k) => {
    const s = source(strategy)
    return [owner, 'second-owner'].map((who, index) => {
      const c = record(s, index ? 'copy' : 'skip'); c.owner = who
      c.ledger.push({ at: 2, i: c.startI + 1, type: 'add', amount: index ? 200 : 500 })
      if (k % 3 === 1) c.stopI = c.startI + 30
      if (k % 3 === 2) { c.status = 'closed'; c.endI = c.startI + 60; c.flats = [c.startI + 15] }
      const indices = [c.startI, c.startI + 40, data.length - 1]
      return { c, indices, expected: projectCatalogueCopy(c, who, s, data, indices) }
    })
  })
  await page.goto('/')
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (/client-catalogue-(spot|futures)-data/.test(request.url())) requests.push(request.url()) })
  const output = await page.evaluate(async cases => {
    const path = '/src/client-catalogue-preview.ts', { createCataloguePreviewClient } = await import(path)
    const client = createCataloguePreviewClient()
    let frames = 0, active = true
    const frame = () => { frames++; if (active) requestAnimationFrame(frame) }; requestAnimationFrame(frame)
    try {
      const control = new AbortController(), first = cases[0]
      const cancelled = client.copy(first.c.owner, first.c, first.indices, control.signal).catch((error: Error) => error.name)
      control.abort()
      const values = await Promise.all(cases.map(c => client.copy(c.c.owner, c.c, c.indices)))
      const bad = { ...first.c, binding: { ...first.c.binding, spotVersion: 'old' } }
      const rejected = await client.copy(first.c.owner, bad).catch((error: Error) => error.message)
      const normal = await client.run(first.c.binding.strategyId, 'all')
      const retry = await client.copy(first.c.owner, first.c, first.indices)
      return { values, frames, cancelled: await cancelled, rejected, normal: normal.strategy.id, retry }
    } finally { active = false; client.dispose() }
  }, cases.map(({ c, indices }) => ({ c, indices })))
  expect(output.values).toEqual(cases.map(c => c.expected)); expect(output.frames).toBeGreaterThan(0)
  expect(output.cancelled).toBe('AbortError'); expect(output.rejected).toBe('catalogue preview unavailable')
  expect(output.normal).toBe(cases[0].c.binding.strategyId); expect(output.retry).toEqual(cases[0].expected)
  expect(errors).toEqual([])
  for (const kind of ['spot-data', 'futures-data']) expect(requests.filter(url => url.includes(kind))).toHaveLength(1)
})
