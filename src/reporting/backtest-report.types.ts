export type BacktestSegment = 'IN_SAMPLE' | 'OUT_OF_SAMPLE'
export type BacktestReportSource = 'RECORDED_FIXTURE'

export type RecordedMetricSet = {
  return: string
  maximumDrawdown: string
  winRate: string | null
  tradeCount: number
}

export type RecordedCostSet = {
  totalFeeCost: string
  totalAdverseSlippageCost: string
  totalFundingCashflow: string
}

export type RecordedTrade = {
  entryAt: string
  exitAt: string
  quantity: string
  entryPrice: string
  exitPrice: string
  grossPnl: string
  feeCost: string
  adverseSlippageCost: string
  fundingCashflow: string
  netPnl: string
  exitReason: string
}

export type RecordedEvaluationWindow = {
  startInclusive: string
  endExclusive: string
  candleRows: number
}

export type LiquidationLimitation = {
  currentMmrVerified: false
  liquidationCheckStatus: 'UNAVAILABLE'
  unavailableReason: 'CURRENT_MMR_NOT_VERIFIED'
}

export type RecordedSegmentResult = {
  segment: BacktestSegment
  resultStatus: 'COMPLETED'
  resultContentHash: string
  runManifestContentHash: string
  tradeManifestContentHash: string
  datasetManifestContentHash: string
  contestedFillCount: number
  metrics: RecordedMetricSet
  costs: RecordedCostSet
  liquidation: LiquidationLimitation
  trades: readonly RecordedTrade[]
}

/**
 * Web-only recorded fixture contract. It is deliberately not a copy of the
 * shared v0.6 schema. Replace this boundary with the immutable generated
 * package after the contracts release is merged and pinned.
 */
export type RecordedBacktestFixture = {
  fixtureVersion: 'tesia.web.recorded-backtest-report.v0.6.0'
  provenance: {
    source: 'RECORDED_FIXTURE'
    sourceLabel: '시연 전용 · MOCK FIXTURE'
  }
  strategy: {
    name: string
    symbol: string
    timeframe: string
    semanticHash: string
  }
  assumptions: {
    takerRate: '0.0005'
    adverseSlippageRate: '0.0005'
    fundingIncluded: true
    terminalFillTiming: string
  }
  dataset: {
    qualityStatus: 'PASSED' | 'FAILED' | 'UNKNOWN'
    unresolvedGapCount: number
  }
  evaluation: {
    inSample: RecordedEvaluationWindow
    outOfSample: RecordedEvaluationWindow
  }
  results: {
    inSample: RecordedSegmentResult
    outOfSample: RecordedSegmentResult
  }
}

type ExecutiveMetricBase = {
  label: string
  help: string
}

export type ExecutiveMetric = ExecutiveMetricBase & (
  | {
      id: 'return' | 'maximumDrawdown' | 'winRate'
      kind: 'PERCENT'
      inSample: string | null
      outOfSample: string | null
      difference: string | null
      differenceMeaning: 'HIGHER' | 'LOWER' | 'UNCHANGED' | 'UNAVAILABLE'
      differenceImpact: 'FAVORABLE' | 'ADVERSE' | 'NEUTRAL' | 'UNAVAILABLE'
    }
  | {
      id: 'tradeCount'
      kind: 'COUNT'
      inSample: number
      outOfSample: number
      difference: null
      differenceMeaning: 'UNAVAILABLE'
      differenceImpact: 'UNAVAILABLE'
    }
)

export type ExecutiveCostComparison = {
  id: keyof RecordedCostSet
  label: string
  help: string
  inSample: string
  outOfSample: string
}

export type ExecutiveSegmentReport = {
  segment: BacktestSegment
  evaluation: RecordedEvaluationWindow
  resultStatus: RecordedSegmentResult['resultStatus']
  contestedFillCount: number
  metrics: RecordedMetricSet
  costs: RecordedCostSet
  liquidation: LiquidationLimitation
  trades: readonly RecordedTrade[]
  evidence: {
    resultContentHash: string
    runManifestContentHash: string
    tradeManifestContentHash: string
    datasetManifestContentHash: string
  }
}

export type ExecutiveBacktestReport = {
  source: BacktestReportSource
  sourceLabel: string
  strategy: RecordedBacktestFixture['strategy']
  assumptions: RecordedBacktestFixture['assumptions']
  dataset: RecordedBacktestFixture['dataset']
  headline: string
  interpretation: string
  metrics: readonly ExecutiveMetric[]
  costs: readonly ExecutiveCostComparison[]
  segments: {
    inSample: ExecutiveSegmentReport
    outOfSample: ExecutiveSegmentReport
  }
}

export type BacktestReportViewState =
  | { status: 'LOADING' }
  | { status: 'EMPTY' }
  | { status: 'INVALID'; message: string }
  | { status: 'ERROR'; message: string }
  | { status: 'READY'; report: ExecutiveBacktestReport }

/**
 * Temporary integration port only. The implementation must come from the
 * pinned immutable generated v0.6 client. A local shape guard is not a
 * semantic verifier.
 */
export type GeneratedSemanticVerifier<TBundle = unknown> = {
  readonly contractPin: string
  verifyBacktestBundle(bundle: TBundle): Promise<void>
}
