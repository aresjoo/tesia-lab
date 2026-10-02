import type {
  BacktestSegment,
  ExecutiveBacktestReport,
  ExecutiveCostComparison,
  ExecutiveMetric,
  ExecutiveSegmentReport,
  GeneratedSemanticVerifier,
  RecordedBacktestFixture,
  RecordedEvaluationWindow,
  RecordedSegmentResult,
  RecordedTrade,
} from './backtest-report.types'

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
const FIXTURE_VERSION = 'tesia.web.recorded-backtest-report.v0.6.0'

const EXPECTED_WINDOWS = {
  IN_SAMPLE: {
    startInclusive: '2024-08-27T00:15:00Z',
    endExclusive: '2026-04-03T00:15:00Z',
    candleRows: 56_064,
  },
  OUT_OF_SAMPLE: {
    startInclusive: '2026-04-03T00:15:00Z',
    endExclusive: '2026-08-27T00:15:00Z',
    candleRows: 14_016,
  },
} as const

type ExactDecimal = { coefficient: bigint; scale: number }

export class BacktestReportAdapterError extends Error {
  constructor(readonly code: string, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'BacktestReportAdapterError'
  }
}

function requireExactKeys(value: object, expected: readonly string[], field: string) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new BacktestReportAdapterError('REPORT_SHAPE_INVALID', field)
  }
}

function parseDecimal(value: string, field: string): ExactDecimal {
  if (value.length > 96 || !DECIMAL_PATTERN.test(value)) {
    throw new BacktestReportAdapterError('REPORT_DECIMAL_INVALID', field)
  }
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [integer, fraction = ''] = unsigned.split('.')
  const coefficient = BigInt(`${integer}${fraction}`)
  return { coefficient: negative ? -coefficient : coefficient, scale: fraction.length }
}

function canonicalDecimal(value: ExactDecimal): string {
  let coefficient = value.coefficient
  let scale = value.scale
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n
    scale -= 1
  }
  if (coefficient === 0n) return '0'
  const negative = coefficient < 0n
  const digits = (negative ? -coefficient : coefficient).toString().padStart(scale + 1, '0')
  const body = scale === 0
    ? digits
    : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  return negative ? `-${body}` : body
}

function align(left: ExactDecimal, right: ExactDecimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale)
  return [
    left.coefficient * 10n ** BigInt(scale - left.scale),
    right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  ]
}

export function subtractExactDecimal(left: string, right: string, field: string): string {
  const [leftValue, rightValue, scale] = align(parseDecimal(left, field), parseDecimal(right, field))
  return canonicalDecimal({ coefficient: leftValue - rightValue, scale })
}

function compareDecimal(value: string): -1 | 0 | 1 {
  const parsed = parseDecimal(value, 'comparison')
  return parsed.coefficient === 0n ? 0 : parsed.coefficient > 0n ? 1 : -1
}

function requireUnitFraction(value: string, field: string) {
  if (compareDecimal(value) < 0 || compareDecimal(subtractExactDecimal(value, '1', field)) > 0) {
    throw new BacktestReportAdapterError('REPORT_UNIT_FRACTION_INVALID', field)
  }
}

function requireHash(value: string, field: string) {
  if (!HASH_PATTERN.test(value)) {
    throw new BacktestReportAdapterError('REPORT_HASH_INVALID', field)
  }
}

function requireTimestamp(value: string, field: string) {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    throw new BacktestReportAdapterError('REPORT_TIMESTAMP_INVALID', field)
  }
}

function requireWindow(
  window: RecordedEvaluationWindow,
  segment: BacktestSegment,
) {
  const expected = EXPECTED_WINDOWS[segment]
  requireExactKeys(window, ['startInclusive', 'endExclusive', 'candleRows'], `evaluation.${segment}`)
  requireTimestamp(window.startInclusive, `evaluation.${segment}.startInclusive`)
  requireTimestamp(window.endExclusive, `evaluation.${segment}.endExclusive`)
  if (
    window.startInclusive !== expected.startInclusive
    || window.endExclusive !== expected.endExclusive
    || window.candleRows !== expected.candleRows
  ) {
    throw new BacktestReportAdapterError('REPORT_GATE2_WINDOW_MISMATCH', segment)
  }
}

function requireTrade(trade: RecordedTrade, field: string) {
  requireExactKeys(trade, [
    'entryAt',
    'exitAt',
    'quantity',
    'entryPrice',
    'exitPrice',
    'grossPnl',
    'feeCost',
    'adverseSlippageCost',
    'fundingCashflow',
    'netPnl',
    'exitReason',
  ], field)
  requireTimestamp(trade.entryAt, `${field}.entryAt`)
  requireTimestamp(trade.exitAt, `${field}.exitAt`)
  if (trade.exitAt < trade.entryAt) {
    throw new BacktestReportAdapterError('REPORT_TRADE_TIME_INVALID', field)
  }
  for (const key of [
    'quantity',
    'entryPrice',
    'exitPrice',
    'grossPnl',
    'feeCost',
    'adverseSlippageCost',
    'fundingCashflow',
    'netPnl',
  ] as const) {
    parseDecimal(trade[key], `${field}.${key}`)
  }
  if (
    compareDecimal(trade.quantity) <= 0
    || compareDecimal(trade.entryPrice) <= 0
    || compareDecimal(trade.exitPrice) <= 0
  ) {
    throw new BacktestReportAdapterError('REPORT_TRADE_VALUE_INVALID', field)
  }
  if (compareDecimal(trade.feeCost) < 0 || compareDecimal(trade.adverseSlippageCost) < 0) {
    throw new BacktestReportAdapterError('REPORT_TRADE_COST_INVALID', field)
  }
}

function requireSegmentResult(result: RecordedSegmentResult, segment: BacktestSegment) {
  if (result.segment !== segment || result.resultStatus !== 'COMPLETED') {
    throw new BacktestReportAdapterError('REPORT_SEGMENT_RESULT_INVALID', segment)
  }
  requireExactKeys(result.liquidation, [
    'currentMmrVerified',
    'liquidationCheckStatus',
    'unavailableReason',
  ], `${segment}.liquidation`)
  if (
    result.liquidation.currentMmrVerified !== false
    || result.liquidation.liquidationCheckStatus !== 'UNAVAILABLE'
    || result.liquidation.unavailableReason !== 'CURRENT_MMR_NOT_VERIFIED'
  ) {
    throw new BacktestReportAdapterError('REPORT_LIQUIDATION_LIMITATION_REQUIRED', segment)
  }
  for (const [field, value] of Object.entries(result.metrics)) {
    if (field === 'tradeCount') {
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw new BacktestReportAdapterError('REPORT_METRIC_INVALID', `${segment}.${field}`)
      }
      continue
    }
    if (value !== null) parseDecimal(String(value), `${segment}.${field}`)
  }
  requireUnitFraction(result.metrics.maximumDrawdown, `${segment}.maximumDrawdown`)
  if (result.metrics.winRate !== null) requireUnitFraction(result.metrics.winRate, `${segment}.winRate`)
  if (result.trades.length !== result.metrics.tradeCount) {
    throw new BacktestReportAdapterError('REPORT_TRADE_COUNT_MISMATCH', segment)
  }
  if (!Number.isSafeInteger(result.contestedFillCount) || result.contestedFillCount < 0) {
    throw new BacktestReportAdapterError('REPORT_CONTESTED_FILL_COUNT_INVALID', segment)
  }
  for (const [field, value] of Object.entries(result.costs)) {
    parseDecimal(value, `${segment}.costs.${field}`)
  }
  if (
    compareDecimal(result.costs.totalFeeCost) < 0
    || compareDecimal(result.costs.totalAdverseSlippageCost) < 0
  ) {
    throw new BacktestReportAdapterError('REPORT_SEGMENT_COST_INVALID', segment)
  }
  requireHash(result.resultContentHash, `${segment}.resultContentHash`)
  requireHash(result.runManifestContentHash, `${segment}.runManifestContentHash`)
  requireHash(result.tradeManifestContentHash, `${segment}.tradeManifestContentHash`)
  requireHash(result.datasetManifestContentHash, `${segment}.datasetManifestContentHash`)
  result.trades.forEach((trade, index) => requireTrade(trade, `${segment}.trades[${index}]`))
}

function differenceMeaning(difference: string | null): ExecutiveMetric['differenceMeaning'] {
  if (difference === null) return 'UNAVAILABLE'
  const compared = compareDecimal(difference)
  return compared === 0 ? 'UNCHANGED' : compared > 0 ? 'HIGHER' : 'LOWER'
}

function differenceImpact(
  metric: Exclude<ExecutiveMetric['id'], 'tradeCount'>,
  meaning: ExecutiveMetric['differenceMeaning'],
): ExecutiveMetric['differenceImpact'] {
  if (meaning === 'UNAVAILABLE') return 'UNAVAILABLE'
  if (meaning === 'UNCHANGED') return 'NEUTRAL'
  if (metric === 'maximumDrawdown') return meaning === 'HIGHER' ? 'ADVERSE' : 'FAVORABLE'
  return meaning === 'HIGHER' ? 'FAVORABLE' : 'ADVERSE'
}

function metricRows(fixture: RecordedBacktestFixture): readonly ExecutiveMetric[] {
  const inMetrics = fixture.results.inSample.metrics
  const outMetrics = fixture.results.outOfSample.metrics
  const nullableDifference = (outValue: string | null, inValue: string | null, field: string) => (
    outValue === null || inValue === null ? null : subtractExactDecimal(outValue, inValue, field)
  )
  const comparableValues = [
    {
      id: 'return' as const,
      label: '순수익률',
      help: '수수료, 슬리피지와 Funding을 반영한 구간별 지갑 가치 변화',
      kind: 'PERCENT' as const,
      inSample: inMetrics.return,
      outOfSample: outMetrics.return,
      difference: subtractExactDecimal(outMetrics.return, inMetrics.return, 'return'),
    },
    {
      id: 'maximumDrawdown' as const,
      label: '최대 낙폭',
      help: '각 구간 안에서 고점 대비 가장 크게 하락한 비율',
      kind: 'PERCENT' as const,
      inSample: inMetrics.maximumDrawdown,
      outOfSample: outMetrics.maximumDrawdown,
      difference: subtractExactDecimal(outMetrics.maximumDrawdown, inMetrics.maximumDrawdown, 'maximumDrawdown'),
    },
    {
      id: 'winRate' as const,
      label: '승률',
      help: '각 구간에서 수익으로 종료된 거래의 비율',
      kind: 'PERCENT' as const,
      inSample: inMetrics.winRate,
      outOfSample: outMetrics.winRate,
      difference: nullableDifference(outMetrics.winRate, inMetrics.winRate, 'winRate'),
    },
  ]
  const comparableRows = comparableValues.map((metric) => {
    const meaning = differenceMeaning(metric.difference)
    return {
      ...metric,
      differenceMeaning: meaning,
      differenceImpact: differenceImpact(metric.id, meaning),
    }
  })
  return [
    ...comparableRows,
    {
      id: 'tradeCount',
      label: '거래 수',
      help: '각 독립 구간에서 종료된 거래 수',
      kind: 'COUNT',
      inSample: inMetrics.tradeCount,
      outOfSample: outMetrics.tradeCount,
      difference: null,
      differenceMeaning: 'UNAVAILABLE',
      differenceImpact: 'UNAVAILABLE',
    },
  ] as const
}

function costRows(fixture: RecordedBacktestFixture): readonly ExecutiveCostComparison[] {
  const inCosts = fixture.results.inSample.costs
  const outCosts = fixture.results.outOfSample.costs
  return [
    {
      id: 'totalFeeCost',
      label: '수수료',
      help: '체결에 적용된 테이커 수수료 비용',
    },
    {
      id: 'totalAdverseSlippageCost',
      label: '불리한 슬리피지',
      help: '체결 가격 가정으로 반영된 비용',
    },
    {
      id: 'totalFundingCashflow',
      label: 'Funding 현금흐름',
      help: '양수는 유입, 음수는 지급을 뜻하는 부호 있는 값',
    },
  ].map(({ id, label, help }) => ({
    id: id as keyof typeof inCosts,
    label,
    help,
    inSample: inCosts[id as keyof typeof inCosts],
    outOfSample: outCosts[id as keyof typeof outCosts],
  }))
}

function reportNarrative(metrics: readonly ExecutiveMetric[]) {
  const returns = metrics.find((metric) => metric.id === 'return')
  const drawdown = metrics.find((metric) => metric.id === 'maximumDrawdown')
  if (returns?.differenceMeaning === 'LOWER' && drawdown?.differenceMeaning === 'HIGHER') {
    return {
      headline: '표본 밖 구간의 순수익률은 낮고 최대 낙폭은 큽니다.',
      interpretation: 'IS와 OOS는 기간과 거래 수가 다른 독립 실행 결과입니다. 차이는 방향 참고용 비교값일 뿐 두 구간을 합친 성과나 인과 효과가 아닙니다.',
    }
  }
  return {
    headline: '표본 내외를 독립 결과로 나란히 확인하세요.',
    interpretation: '수익률, 낙폭, 승률, 거래 수와 비용 가정을 함께 읽어야 합니다. 과거 결과는 미래 성과를 보장하지 않습니다.',
  }
}

function segmentReport(
  result: RecordedSegmentResult,
  evaluation: RecordedEvaluationWindow,
): ExecutiveSegmentReport {
  return {
    segment: result.segment,
    evaluation,
    resultStatus: result.resultStatus,
    contestedFillCount: result.contestedFillCount,
    metrics: result.metrics,
    costs: result.costs,
    liquidation: result.liquidation,
    trades: result.trades,
    evidence: {
      resultContentHash: result.resultContentHash,
      runManifestContentHash: result.runManifestContentHash,
      tradeManifestContentHash: result.tradeManifestContentHash,
      datasetManifestContentHash: result.datasetManifestContentHash,
    },
  }
}

export function adaptRecordedBacktestFixture(fixture: RecordedBacktestFixture): ExecutiveBacktestReport {
  if (fixture.fixtureVersion !== FIXTURE_VERSION) {
    throw new BacktestReportAdapterError('REPORT_FIXTURE_VERSION_INVALID', fixture.fixtureVersion)
  }
  if (
    fixture.provenance.source !== 'RECORDED_FIXTURE'
    || fixture.provenance.sourceLabel !== '시연 전용 · MOCK FIXTURE'
  ) {
    throw new BacktestReportAdapterError('REPORT_FIXTURE_PROVENANCE_INVALID', 'recorded fixture required')
  }
  requireExactKeys(fixture.evaluation, ['inSample', 'outOfSample'], 'evaluation')
  requireExactKeys(fixture.results, ['inSample', 'outOfSample'], 'results')
  requireWindow(fixture.evaluation.inSample, 'IN_SAMPLE')
  requireWindow(fixture.evaluation.outOfSample, 'OUT_OF_SAMPLE')
  if (fixture.assumptions.takerRate !== '0.0005' || fixture.assumptions.adverseSlippageRate !== '0.0005') {
    throw new BacktestReportAdapterError('REPORT_COST_ASSUMPTION_MISMATCH', 'approved 0.0005 / 0.0005 required')
  }
  if (fixture.assumptions.fundingIncluded !== true) {
    throw new BacktestReportAdapterError('REPORT_FUNDING_ASSUMPTION_INVALID', 'funding must be included')
  }
  if (fixture.dataset.qualityStatus !== 'PASSED' || fixture.dataset.unresolvedGapCount !== 0) {
    throw new BacktestReportAdapterError('REPORT_DATASET_NOT_READY', fixture.dataset.qualityStatus)
  }
  requireHash(fixture.strategy.semanticHash, 'strategy.semanticHash')
  requireSegmentResult(fixture.results.inSample, 'IN_SAMPLE')
  requireSegmentResult(fixture.results.outOfSample, 'OUT_OF_SAMPLE')

  const metrics = metricRows(fixture)
  return {
    source: fixture.provenance.source,
    sourceLabel: fixture.provenance.sourceLabel,
    strategy: fixture.strategy,
    assumptions: fixture.assumptions,
    dataset: fixture.dataset,
    ...reportNarrative(metrics),
    metrics,
    costs: costRows(fixture),
    segments: {
      inSample: segmentReport(fixture.results.inSample, fixture.evaluation.inSample),
      outOfSample: segmentReport(fixture.results.outOfSample, fixture.evaluation.outOfSample),
    },
  }
}

/**
 * TODO(contract-pin): once the immutable tesia-contracts v0.6 package lands,
 * import its generated type and semantic verifier here, then map only a
 * successfully verified bundle. Until then an actual artifact cannot reach
 * the report projection.
 */
export async function requireGeneratedSemanticVerification<TBundle>(
  bundle: TBundle,
  verifier?: GeneratedSemanticVerifier<TBundle>,
): Promise<TBundle> {
  if (!verifier) {
    throw new BacktestReportAdapterError(
      'REPORT_GENERATED_SEMANTIC_VERIFIER_REQUIRED',
      'immutable generated v0.6 verifier is not pinned',
    )
  }
  // TODO(contract-pin): replace null only in the same change that imports the
  // immutable generated release and records its exact package/client hash.
  const expectedContractPin: string | null = null
  if (!expectedContractPin || verifier.contractPin !== expectedContractPin) {
    throw new BacktestReportAdapterError(
      'REPORT_GENERATED_CONTRACT_PIN_REQUIRED',
      'immutable generated v0.6 contract pin is not installed',
    )
  }
  await verifier.verifyBacktestBundle(bundle)
  return bundle
}
