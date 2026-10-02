import { createHash } from 'node:crypto'
import vm from 'node:vm'
import reference from './fixtures/terminal-source-runtime.json' with { type: 'json' }
import { test, expect } from '@playwright/test'
import {
  evaluateSourceTerminal, normalizeSourceTerminalParameters, sourceTerminalDate,
  sourceTerminalPrices, sourceTerminalSeeds, sourceTerminalSma, sourceTerminalRsi,
} from '../src/client-terminal-source-fixture'

/**
 * Golden provenance: aresjoo/tesia-lab index.html at
 * 9bf4427a03c8f33f0d14988d2f38b18441227eeb.
 * Generated from the original pure function slices in an isolated Node VM:
 * mulberry32→backtest-flow marker; TF_TERM_DEMO→TF_TM; tfTmP→VM-list marker;
 * tfTmCalc→tfTmWon; tfBotLogEvents→TF_LOG_MODE. No document/script execution,
 * network or app storage. The counter-only S object and unused tfScore were
 * stubbed; only score is omitted from tfTmCalc output. Full nested output is
 * hashed, including every equity point, every trade and every event text.
 * Canonical snippets SHA: 06c711e15944b0b6a636068b56e4015fbaf60b765d5b14a3e7ae072eed683fab
 * This proves SOURCE PREVIEW parity, not real exchange/backtest correctness.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonical(record[key])]))
  }
  return value
}
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
const original = [
  ['d1', '8f520e0b7453f8c6ded37f8cfeaccd829682a93ac985eaed8a79ff752b6a1b89', 12, 1274],
  ['d2', 'acbb412d1d400cc3887fedaf831980278d17ced5ba181ac4578b40ba2870a68d', 9, 731],
  ['d3', '6841965563f5c4bf7ba034a2a89f64e92ef7d58ded4510e35528fe384c27001f', 8, 366],
  ['d4', '41d4a1632d8bbd64fbbae2e65cb5f9510fb9c301fc3a15650041b3c9a286b2e3', 12, 1274],
  ['d5', '0fe291cf2e4ddc26e0692483e624cb9ad5b85d38e2e7f833fa7f9920e122527f', 8, 366],
  ['d6', 'f4f06e6ad5b1d5230d4be83feb50898cce6834be403b2ae9040cc65521b602a4', 13, 549],
] as const

// The historical receipt used Node24. The unmodified original itself produces
// a different final Math.pow bit on Node22; preserve both exact receipts and
// compare ALL fields with a fresh original VM in the runtime under test.
const node22D1Sha = 'd94a8c1095fe6ea6a20900fda1e9114d7ad44cfbcf1561a148e395ca9cd1b9ff'
function runtimeDigest(id: string, recorded: string) {
  return process.versions.node.split('.')[0] === '22' && id === 'd1' ? node22D1Sha : recorded
}
function originalEvaluation(id: string) {
  const context = vm.createContext({ S: { btCount: 0 }, tfScore: () => null, TF_TM_C: {}, id })
  vm.runInContext(reference.slices.map(slice => slice.code).join('\n'), context, { timeout: 1000 })
  return vm.runInContext('var s=TF_TERM_DEMO.find(function(s){return s.id===id});var result=tfTmCalc({p:tfTmP(s.p),cap:s.cap});delete result.score;result', context, { timeout: 1000 })
}
test('원본9bf pure5조각은 고정Git blob과 코드해시를 보존하며 평가를 합성하지 않는다', () => {
  expect(reference.sourceSha).toBe('9bf4427a03c8f33f0d14988d2f38b18441227eeb')
  expect(reference.sourceBlobSha).toBe('305e40496507de47c436245aef6b9f12a7cc79e4')
  expect(createHash('sha256').update(reference.slices.map(slice => slice.code).join('\n')).digest('hex')).toBe('f9f5c5ea7f21163ad38ec7c0c73716585151206b4dcbed5b97d281f7d30cd326')
  for (const slice of reference.slices) expect(createHash('sha256').update(slice.code).digest('hex')).toBe(slice.sha256)
  expect(reference.slices).toHaveLength(5)
})

test('all 1,335 close-only source prices retain original deterministic bytes', () => {
  expect(sourceTerminalPrices).toHaveLength(1335)
  expect(digest(sourceTerminalPrices)).toBe('07d747c3dec078f635cb948caf1f7b646f7e1aa3fc9846740dcc4d6ec141913f')
  expect(Object.isFrozen(sourceTerminalPrices)).toBe(true)
  expect(sourceTerminalPrices.every(value => typeof value === 'number' && Number.isFinite(value))).toBe(true)
})

for (const [id, sha, tradeCount, bars] of original) {
  test(`${id} reproduces the entire original result, events and accounting`, () => {
    const seed = sourceTerminalSeeds.find(item => item.id === id)!
    const result = evaluateSourceTerminal(seed.parameters, seed.capital)
    expect(digest(result)).toBe(runtimeDigest(id, sha))
    expect(digest(result)).toBe(digest(originalEvaluation(id)))
    expect(result.r.n).toBe(tradeCount)
    expect(result.L.bars).toBe(bars)
    expect(result.L.evs).toHaveLength(bars)
    expect(result.L.cnt.entry).toBe(result.L.cnt.exit + (result.L.last.inPos ? 1 : 0))
    expect(result.trades.reduce((amount, trade) => amount * (1 + trade.pnl), seed.capital) - seed.capital).toBe(result.realized)
    expect(result.realized + result.unreal).toBeCloseTo(result.pnl, 7)
    expect(result.L.evs.filter(event => event.k.startsWith('exit')).map(event => event.i)).toEqual(result.trades.map(trade => trade.exit))
  })
}

test('source metadata, status, names and parameters remain immutable and distinct', () => {
  expect(sourceTerminalSeeds.map(seed => [seed.id, seed.name, seed.exchangeId, seed.symbol, seed.version, seed.status, seed.capital])).toEqual([
    ['d1', 'BTC 돌파 추종', 'binance', 'BTC/USDT', 'v3.4', 'live', 14000000],
    ['d2', 'ETH 추세 추종', 'okx', 'ETH/USDT', 'v2.1', 'off', 7000000],
    ['d3', 'SOL 되돌림', 'woox', 'SOL/USDT', 'v1.3', 'live', 4000000],
    ['d4', 'BTC 평균회귀', 'okx', 'BTC/USDT', 'v5.0', 'live', 28000000],
    ['d5', 'ARB 모멘텀', 'binance', 'ARB/USDT', 'v1.0', 'ready', 7000000],
    ['d6', 'LINK 분할 매집', 'woox', 'LINK/USDT', 'v2.2', 'err', 7000000],
  ])
  expect(sourceTerminalSeeds.every(seed => Object.isFrozen(seed) && Object.isFrozen(seed.parameters))).toBe(true)
  expect(sourceTerminalSeeds[5].error).toBe('거래소 API 응답 없음. 마지막 동기화 이후 주문이 전송되지 않았어요')
})

test('negative window offset has the source inclusive end convention', () => {
  const p = sourceTerminalSeeds[1].parameters
  expect(normalizeSourceTerminalParameters(p)).toEqual({ ...p, startI: 604, endI: 1334 })
  expect(p.startI).toBe(-730)
  expect(normalizeSourceTerminalParameters({ ...p, startI: -5000 }).startI).toBe(61)
  expect(sourceTerminalDate(0).getFullYear()).toBe(2023)
  expect(sourceTerminalDate(0).getMonth()).toBe(0)
  expect(sourceTerminalDate(0).getDate()).toBe(2)
  expect(sourceTerminalSma(2, 20)).toBeNull()
  expect(sourceTerminalRsi(2)).toBe(50)
})

test('open position NAV is marked to the source final close without inventing a closed trade', () => {
  const seed = sourceTerminalSeeds[0]
  const full = evaluateSourceTerminal(seed.parameters, seed.capital)
  const first = full.trades[0]
  const partial = evaluateSourceTerminal({ ...seed.parameters, endI: first.entry + 1 }, seed.capital)
  expect(partial.trades).toHaveLength(0)
  expect(partial.pos?.entryI).toBe(first.entry)
  expect(partial.L.last.inPos).toBe(true)
  expect(partial.realized).toBe(0)
  expect(partial.feeEst).toBe(0)
  expect(partial.unreal).toBe(partial.pnl)
  expect(partial.pos?.entryP).toBe(sourceTerminalPrices[first.entry])
  expect(partial.pos?.curP).toBe(sourceTerminalPrices[first.entry + 1])
  expect(partial.nav).toBeCloseTo(seed.capital * (sourceTerminalPrices[first.entry + 1] / sourceTerminalPrices[first.entry]), 7)
})

test('evaluations do not leak mutations between consumers or source seeds', () => {
  const seed = sourceTerminalSeeds[0]
  const before = evaluateSourceTerminal(seed.parameters, seed.capital)
  before.r.eq[0].v = -999
  before.L.evs[0].txt = 'consumer edit'
  before.r.params.sl = -99
  expect(digest(evaluateSourceTerminal(seed.parameters, seed.capital))).toBe(runtimeDigest(seed.id, original[0][1]))
  expect(digest(evaluateSourceTerminal(seed.parameters, seed.capital))).toBe(digest(originalEvaluation(seed.id)))
  expect(seed.parameters.sl).toBe(-5)
})

test('invalid and out-of-bounds requests fail before accessing the finite fixture', () => {
  const p = sourceTerminalSeeds[0].parameters
  for (const parameters of [{ ...p, endI: 1335 }, { ...p, startI: 62, endI: 61 }, { ...p, startI: .5 }, { ...p, startI: 60 }, { ...p, sl: NaN }, { ...p, tp: Infinity }, { ...p, rsiTh: NaN }]) {
    expect(() => evaluateSourceTerminal(parameters, 100)).toThrow(RangeError)
  }
  for (const capital of [-1, Infinity, NaN]) expect(() => evaluateSourceTerminal(p, capital)).toThrow(RangeError)
  expect(evaluateSourceTerminal(p, 0).nav).toBe(0)
})
