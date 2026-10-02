import type { BacktestJob, VerifiedBacktestReport, TradeManifestEnvelope, TradeManifestPageEnvelope, SourceProvenance } from './contracts/generated/api-v0.1/index.js'

const RESULT_BINDING_ERROR = 'CROSS_RESOURCE_BACKTEST_BINDING_MISMATCH'

export const requireResultBinding = (condition: boolean): void => {
  if (!condition) throw new Error(RESULT_BINDING_ERROR)
}

export const assertResultBundleBindings = (
  job: BacktestJob,
  report: VerifiedBacktestReport,
  manifest: TradeManifestEnvelope['data'],
  isPage: TradeManifestPageEnvelope['data'],
  oosPage: TradeManifestPageEnvelope['data'],
): void => {
  requireResultBinding(job.state === 'COMPLETED' && job.resultAvailable)
  requireResultBinding(
    report.backtestId === job.backtestId
    && manifest.backtestId === job.backtestId
    && report.strategyVersionId === job.strategyVersionId
    && report.semanticHash === job.semanticHash
    && report.splitGroupId === job.splitGroupId
    && manifest.splitGroupId === job.splitGroupId
    && report.profileId === job.profileId
    && report.profileContentHash === job.profileContentHash
    && job.resultContentHash === report.reportContentHash,
  )

  const pages = { IS: isPage, OOS: oosPage } as const
  for (const segment of ['IS', 'OOS'] as const) {
    const reportSegment = report.segments.find((candidate) => candidate.segment === segment)
    const manifestSegment = manifest.segments.find((candidate) => candidate.segment === segment)
    const page = pages[segment]
    requireResultBinding(reportSegment !== undefined && manifestSegment !== undefined)
    requireResultBinding(
      reportSegment!.runtimeResult.contentHash === manifestSegment!.resultContentHash
      && reportSegment!.runtimeResult.tradeCount === manifestSegment!.tradeCount
      && reportSegment!.tradeManifestContentHash === manifestSegment!.tradeManifestContentHash
      && page.backtestId === job.backtestId
      && page.segment === segment
      && page.resultContentHash === manifestSegment!.resultContentHash
      && page.tradeManifestContentHash === manifestSegment!.tradeManifestContentHash
      && page.cursorBinding.backtestId === job.backtestId
      && page.cursorBinding.segment === segment
      && page.cursorBinding.resultContentHash === manifestSegment!.resultContentHash
      && page.cursorBinding.tradeManifestContentHash === manifestSegment!.tradeManifestContentHash
      && page.trades.length <= manifestSegment!.tradeCount,
    )
  }
}

export const LOCAL_SYNTHETIC_SOURCE: SourceProvenance = {
  source: 'SYNTHETIC_UI_FIXTURE',
  verification: 'UNVERIFIED',
  rights: 'PRIVATE_ONLY',
}

export const assertLocalSyntheticSource = (source: SourceProvenance): void => {
  if (
    source.source !== LOCAL_SYNTHETIC_SOURCE.source
    || source.verification !== LOCAL_SYNTHETIC_SOURCE.verification
    || source.rights !== LOCAL_SYNTHETIC_SOURCE.rights
  ) throw new Error('LOCAL_SYNTHETIC_SOURCE_PROVENANCE_REQUIRED')
}
