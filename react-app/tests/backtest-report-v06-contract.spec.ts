import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  adaptRecordedBacktestFixture,
  requireGeneratedSemanticVerification,
} from '../src/reporting/backtest-report.adapter'
import { RECORDED_BACKTEST_REPORT_FIXTURE } from '../src/reporting/backtest-report.fixture'
import type {
  GeneratedSemanticVerifier,
  RecordedBacktestFixture,
} from '../src/reporting/backtest-report.types'

const cloneFixture = (): RecordedBacktestFixture => structuredClone(RECORDED_BACKTEST_REPORT_FIXTURE)

test('recorded fixture는 Gate 2 고정 구간과 승인된 비용 가정을 사용한다', () => {
  const fixture = cloneFixture()
  expect(fixture.evaluation.inSample).toEqual({
    startInclusive: '2024-08-27T00:15:00Z',
    endExclusive: '2026-04-03T00:15:00Z',
    candleRows: 56_064,
  })
  expect(fixture.evaluation.outOfSample).toEqual({
    startInclusive: '2026-04-03T00:15:00Z',
    endExclusive: '2026-08-27T00:15:00Z',
    candleRows: 14_016,
  })
  expect(fixture.assumptions.takerRate).toBe('0.0005')
  expect(fixture.assumptions.adverseSlippageRate).toBe('0.0005')
})

test('IS와 OOS는 독립 result, metrics, hash로만 projection 된다', () => {
  const report = adaptRecordedBacktestFixture(cloneFixture())
  expect(Object.keys(report).sort()).toEqual([
    'assumptions',
    'costs',
    'dataset',
    'headline',
    'interpretation',
    'metrics',
    'segments',
    'source',
    'sourceLabel',
    'strategy',
  ])
  expect(report.segments.inSample.segment).toBe('IN_SAMPLE')
  expect(report.segments.outOfSample.segment).toBe('OUT_OF_SAMPLE')
  expect(report.segments.inSample.evidence.resultContentHash).not.toBe(
    report.segments.outOfSample.evidence.resultContentHash,
  )
  expect('resultContentHash' in report).toBe(false)
  expect('evaluation' in report).toBe(false)
})

test('비용은 Decimal 문자열 원본만 유지하고 기간이 다른 구간 간 delta를 만들지 않는다', () => {
  const fixture = cloneFixture()
  fixture.results.inSample.trades[0].feeCost = '999.000000000000000001'
  const report = adaptRecordedBacktestFixture(fixture)
  const fees = report.costs.find((cost) => cost.id === 'totalFeeCost')
  const slippage = report.costs.find((cost) => cost.id === 'totalAdverseSlippageCost')
  expect(fees).toEqual(expect.objectContaining({ inSample: '4.065', outOfSample: '2.102' }))
  expect(slippage).toEqual(expect.objectContaining({ inSample: '3.84', outOfSample: '1.95' }))
  expect(fees).not.toHaveProperty('difference')
  expect(slippage).not.toHaveProperty('difference')
  expect(report.costs.every((cost) => !('difference' in cost))).toBe(true)
  expect(typeof fees?.inSample).toBe('string')
  expect('total' in report).toBe(false)
})

test('rate 지표만 exact Decimal delta를 가지고 거래 수는 비교 불가로 닫힌다', () => {
  const report = adaptRecordedBacktestFixture(cloneFixture())
  expect(report.metrics.find((metric) => metric.id === 'return')).toMatchObject({ difference: '-0.072' })
  expect(report.metrics.find((metric) => metric.id === 'maximumDrawdown')).toMatchObject({
    difference: '0.032',
    differenceMeaning: 'HIGHER',
    differenceImpact: 'ADVERSE',
  })
  expect(report.metrics.find((metric) => metric.id === 'winRate')).toMatchObject({ difference: '-0.25' })
  expect(report.metrics.find((metric) => metric.id === 'tradeCount')).toMatchObject({
    kind: 'COUNT',
    difference: null,
    differenceMeaning: 'UNAVAILABLE',
    differenceImpact: 'UNAVAILABLE',
  })
})

test('비교 가능한 rate의 원본값이 없으면 COUNT로 재분류하지 않고 delta만 unavailable이다', () => {
  const fixture = cloneFixture()
  fixture.results.outOfSample.metrics.winRate = null
  const winRate = adaptRecordedBacktestFixture(fixture).metrics.find((metric) => metric.id === 'winRate')
  expect(winRate).toMatchObject({
    kind: 'PERCENT',
    inSample: '0.75',
    outOfSample: null,
    difference: null,
    differenceMeaning: 'UNAVAILABLE',
    differenceImpact: 'UNAVAILABLE',
  })
})

test('MDD는 nonnegative loss magnitude이고 OOS−IS 음수는 개선으로 판정한다', () => {
  const improved = cloneFixture()
  improved.results.outOfSample.metrics.maximumDrawdown = '0.032'
  const report = adaptRecordedBacktestFixture(improved)
  expect(report.metrics.find((metric) => metric.id === 'maximumDrawdown')).toMatchObject({
    inSample: '0.052',
    outOfSample: '0.032',
    difference: '-0.02',
    differenceMeaning: 'LOWER',
    differenceImpact: 'FAVORABLE',
  })

  const negative = cloneFixture()
  negative.results.inSample.metrics.maximumDrawdown = '-0.052'
  expect(() => adaptRecordedBacktestFixture(negative)).toThrow('REPORT_UNIT_FRACTION_INVALID')
})

test('MMR limitation은 정확한 세 필드만 허용한다', () => {
  const fixture = cloneFixture()
  expect(fixture.results.inSample.liquidation).toEqual({
    currentMmrVerified: false,
    liquidationCheckStatus: 'UNAVAILABLE',
    unavailableReason: 'CURRENT_MMR_NOT_VERIFIED',
  })

  ;(fixture.results.inSample.liquidation as unknown as Record<string, unknown>).liquidationPrice = '0'
  expect(() => adaptRecordedBacktestFixture(fixture)).toThrow('REPORT_SHAPE_INVALID')
})

test('FULL이나 임의 구간, 합산 result shape는 fail-closed 한다', () => {
  const wrongWindow = cloneFixture()
  wrongWindow.evaluation.outOfSample.startInclusive = '2026-04-04T00:15:00Z'
  expect(() => adaptRecordedBacktestFixture(wrongWindow)).toThrow('REPORT_GATE2_WINDOW_MISMATCH')

  const combinedResult = cloneFixture()
  ;(combinedResult.results as unknown as Record<string, unknown>).full = {}
  expect(() => adaptRecordedBacktestFixture(combinedResult)).toThrow('REPORT_SHAPE_INVALID')
})

test('generated v0.6 semantic verifier와 immutable pin이 없으면 actual 연결 준비도 fail-closed 한다', async () => {
  await expect(requireGeneratedSemanticVerification({ source: 'ACTUAL_GENERATED' })).rejects.toThrow(
    'REPORT_GENERATED_SEMANTIC_VERIFIER_REQUIRED',
  )

  let verified = false
  const verifier: GeneratedSemanticVerifier<{ source: string }> = {
    contractPin: 'tesia-contracts@immutable-v0.6',
    async verifyBacktestBundle() {
      verified = true
    },
  }
  await expect(
    requireGeneratedSemanticVerification({ source: 'ACTUAL_GENERATED' }, verifier),
  ).rejects.toThrow('REPORT_GENERATED_CONTRACT_PIN_REQUIRED')
  expect(verified).toBe(false)
})

test('reporting 구현은 Decimal을 Number로 변환하거나 거래 비용을 reduce하지 않는다', async () => {
  const component = await readFile(new URL('../src/reporting/BacktestExecutiveReport.tsx', import.meta.url), 'utf8')
  const adapter = await readFile(new URL('../src/reporting/backtest-report.adapter.ts', import.meta.url), 'utf8')
  expect(component).not.toMatch(/\bNumber\s*\(|parseFloat\s*\(|parseInt\s*\(/)
  expect(adapter).not.toMatch(/\bNumber\s*\(|parseFloat\s*\(|parseInt\s*\(/)
  expect(adapter).not.toMatch(/\.trades\.reduce\s*\(/)
})

test('recorded 모델에는 금지된 청산 세부 필드가 존재하지 않는다', () => {
  const serialized = JSON.stringify(RECORDED_BACKTEST_REPORT_FIXTURE)
  for (const forbidden of [
    'liquidationPrice',
    'liquidationDistance',
    'liquidationOccurred',
    'liquidationInvalid',
  ]) {
    expect(serialized).not.toContain(forbidden)
  }
})
