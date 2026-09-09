import type {
  LiquidationLimitation,
  RecordedBacktestFixture,
  RecordedTrade,
} from './backtest-report.types'

const hash = (character: string) => character.repeat(64)

const liquidationLimitation = (): LiquidationLimitation => ({
  currentMmrVerified: false,
  liquidationCheckStatus: 'UNAVAILABLE',
  unavailableReason: 'CURRENT_MMR_NOT_VERIFIED',
})

const trade = (
  entryAt: string,
  exitAt: string,
  entryPrice: string,
  exitPrice: string,
  grossPnl: string,
  feeCost: string,
  adverseSlippageCost: string,
  fundingCashflow: string,
  netPnl: string,
  exitReason: string,
): RecordedTrade => ({
  entryAt,
  exitAt,
  quantity: '0.01',
  entryPrice,
  exitPrice,
  grossPnl,
  feeCost,
  adverseSlippageCost,
  fundingCashflow,
  netPnl,
  exitReason,
})

const inSampleTrades = [
  trade('2024-09-03T00:15:00Z', '2024-09-03T08:15:00Z', '58000', '58800', '8', '0.583', '0.58', '-0.05', '6.787', 'TAKE_PROFIT'),
  trade('2025-01-08T04:15:00Z', '2025-01-08T12:15:00Z', '96200', '95400', '-8', '0.958', '0.962', '-0.04', '-9.960', 'STOP_LOSS'),
  trade('2025-07-14T12:15:00Z', '2025-07-15T00:15:00Z', '108800', '110600', '18', '1.097', '1.088', '-0.08', '15.735', 'TAKE_PROFIT'),
  trade('2026-03-21T08:15:00Z', '2026-03-21T16:15:00Z', '97000', '98200', '12', '0.976', '0.97', '-0.05', '10.004', 'TAKE_PROFIT'),
] as const

const outOfSampleTrades = [
  trade('2026-04-26T00:15:00Z', '2026-04-26T12:15:00Z', '98500', '97500', '-10', '0.98', '0.985', '-0.06', '-12.025', 'STOP_LOSS'),
  trade('2026-08-26T08:15:00Z', '2026-08-27T00:15:00Z', '96800', '97600', '8', '0.972', '0.968', '-0.09', '5.970', 'END_OF_DATA'),
] as const

/**
 * Recorded UI fixture only. Values are intentionally synthetic and have not
 * been produced by the FULL_760D replay.
 */
export const RECORDED_BACKTEST_REPORT_FIXTURE: RecordedBacktestFixture = {
  fixtureVersion: 'tesia.web.recorded-backtest-report.v0.6.0',
  provenance: {
    source: 'RECORDED_FIXTURE',
    sourceLabel: '시연 전용 · MOCK FIXTURE',
  },
  strategy: {
    name: 'RSI 과매도 회귀 (시연용)',
    symbol: 'BTCUSDT',
    timeframe: '15m',
    semanticHash: hash('1'),
  },
  assumptions: {
    takerRate: '0.0005',
    adverseSlippageRate: '0.0005',
    fundingIncluded: true,
    terminalFillTiming: 'END_OF_DATA_LAST_CONFIRMED_CONTRACT_CLOSE',
  },
  dataset: {
    qualityStatus: 'PASSED',
    unresolvedGapCount: 0,
  },
  evaluation: {
    inSample: {
      startInclusive: '2024-08-27T00:15:00Z',
      endExclusive: '2026-04-03T00:15:00Z',
      candleRows: 56_064,
    },
    outOfSample: {
      startInclusive: '2026-04-03T00:15:00Z',
      endExclusive: '2026-08-27T00:15:00Z',
      candleRows: 14_016,
    },
  },
  results: {
    inSample: {
      segment: 'IN_SAMPLE',
      resultStatus: 'COMPLETED',
      resultContentHash: hash('3'),
      runManifestContentHash: hash('4'),
      tradeManifestContentHash: hash('7'),
      datasetManifestContentHash: hash('2'),
      contestedFillCount: 1,
      metrics: {
        return: '0.084',
        maximumDrawdown: '0.052',
        winRate: '0.75',
        tradeCount: inSampleTrades.length,
      },
      costs: {
        totalFeeCost: '4.065',
        totalAdverseSlippageCost: '3.84',
        totalFundingCashflow: '-0.22',
      },
      liquidation: liquidationLimitation(),
      trades: inSampleTrades,
    },
    outOfSample: {
      segment: 'OUT_OF_SAMPLE',
      resultStatus: 'COMPLETED',
      resultContentHash: hash('5'),
      runManifestContentHash: hash('6'),
      tradeManifestContentHash: hash('8'),
      datasetManifestContentHash: hash('2'),
      contestedFillCount: 0,
      metrics: {
        return: '0.012',
        maximumDrawdown: '0.084',
        winRate: '0.5',
        tradeCount: outOfSampleTrades.length,
      },
      costs: {
        totalFeeCost: '2.102',
        totalAdverseSlippageCost: '1.95',
        totalFundingCashflow: '-0.15',
      },
      liquidation: liquidationLimitation(),
      trades: outOfSampleTrades,
    },
  },
}
