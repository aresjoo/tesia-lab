import { TesiaResultChartsV05Client } from './contracts/generated/api-v0.5/client'
import { strictParseApiV06 } from './contracts/generated/api-v0.6/validator'
import type { Transport } from './contracts/generated/api-v0.7/client'
import type { PriceChartView } from '../chart/price-chart-view'
import type { NativeJob, NativeReport, NativeTrades, NativeChartManifest, NativeChartWindowSelection, NativeFillMarkers } from './native-service-api'

export type NativeMarkerBinding = Pick<NativeTrades, 'binding' | 'strategyAuthorityMapping' | 'tradeManifestContentHash'>
export type NativeChartJobBinding = Pick<NativeJob, 'backtestId' | 'strategyVersionId' | 'semanticHash' | 'splitGroupId'>
export type NativeChartReportBinding = Pick<NativeReport, 'binding' | 'nativeEnvelope'>
export type NativeFillManifestBinding = Pick<NativeChartManifest, 'binding' | 'manifestContentHash' | 'sourcePolicy'>

const requireBinding = (condition: boolean): void => {
  if (!condition) throw new Error('NATIVE_RESULT_BINDING_CONFLICT')
}

// Both operands have already passed the unchanged SDK schema. JSON object key
// order is not source identity; values, key sets and array order still are.
function sameValidatedJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((value, index) => sameValidatedJson(value, b[index]))
  }
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(right, key) && sameValidatedJson(left[key], right[key]))
}

/** Cross-resource comparisons after SDK validation; not a wire validator. */
export function assertNativeMarkerBinding(manifest: NativeFillManifestBinding, trades: NativeMarkerBinding) {
  requireBinding(manifest.binding.backtestId === trades.binding.backtestId
    && manifest.binding.segment === trades.binding.segment
    && manifest.binding.resultContentHash === trades.binding.resultContentHash
    && manifest.binding.splitGroupId === trades.binding.splitGroupId
    && manifest.binding.strategyVersionId === trades.strategyAuthorityMapping.approvalStrategyVersionId)
}

export function assertNativeFillPageBinding(manifest: NativeFillManifestBinding, trades: NativeMarkerBinding,
  data: Pick<NativeFillMarkers, 'binding' | 'manifestContentHash' | 'tradeManifestContentHash' | 'sourcePolicy'>) {
  requireBinding(sameValidatedJson(data.binding, manifest.binding)
    && data.manifestContentHash === manifest.manifestContentHash
    && data.tradeManifestContentHash === trades.tradeManifestContentHash
    && sameValidatedJson(data.sourcePolicy, manifest.sourcePolicy))
}

function validateManifest(job: NativeChartJobBinding, report: NativeChartReportBinding, segment: 'IS' | 'OOS', manifest: NativeChartManifest) {
  const evaluation = report.nativeEnvelope.projection.segments.find(item => item.segment === segment)
  requireBinding(manifest.binding.strategyVersionId === job.strategyVersionId
    && manifest.binding.semanticHash === job.semanticHash && manifest.binding.splitGroupId === job.splitGroupId
    && manifest.binding.resultContentHash === evaluation?.resultContentHash
    && manifest.segmentBounds.fromInclusive === evaluation?.evaluationStartInclusive
    && manifest.segmentBounds.toExclusive === evaluation?.evaluationEndExclusive)
  if (report.binding.evidenceClass === 'SOURCE_BOUND_PROJECTION') {
    requireBinding(manifest.sourcePolicy.sourceProvenance.source === 'PRIVATE_ACTUAL_REPLAY')
  }
}

/** Shared validated reads only. No cache, session, replay clock, or execution authority. */
export function createNativeChartReadAccess(transport: Transport) {
  // Every v0.5 response still crosses the strict parser and unchanged SDK.
  const charts = new TesiaResultChartsV05Client({ request: async request => {
    const response = await transport.request(request)
    return { ...response, body: strictParseApiV06(response.body) }
  } })
  return {
    async manifest(job: NativeChartJobBinding, report: NativeChartReportBinding, segment: 'IS' | 'OOS') {
      const manifest = (await charts.call('getChartManifestV5', { backtestId: job.backtestId, segment })).data
      validateManifest(job, report, segment, manifest)
      return manifest
    },
    async markers(manifest: NativeChartManifest, trades: NativeMarkerBinding, cursor?: string): Promise<NativeFillMarkers> {
      assertNativeMarkerBinding(manifest, trades)
      const { data } = await charts.call('getFillMarkersV5', { backtestId: manifest.binding.backtestId,
        segment: manifest.binding.segment, manifestContentHash: manifest.manifestContentHash, limit: 100, ...(cursor ? { cursor } : {}) })
      assertNativeFillPageBinding(manifest, trades, data)
      return data
    },
    async window(job: NativeChartJobBinding, report: NativeChartReportBinding, segment: 'IS' | 'OOS', manifest: NativeChartManifest, selection: NativeChartWindowSelection = {}) {
      validateManifest(job, report, segment, manifest)
      const series = selection.seriesId === undefined
        ? manifest.series.find(item => item.seriesId === 'contract-15m') ?? manifest.series.find(item => item.priceKind === 'contract') ?? manifest.series[0]
        : manifest.series.find(item => item.seriesId === selection.seriesId)
      if (!series) throw new Error('NATIVE_CHART_UNAVAILABLE')
      requireBinding(selection.expectedManifestContentHash === undefined || selection.expectedManifestContentHash === manifest.manifestContentHash)
      const resolution = selection.resolution ?? (series.supportedResolutions.includes('1d') ? '1d'
        : series.supportedResolutions.includes('1h') ? '1h' : series.nativeResolution)
      requireBinding(series.supportedResolutions.includes(resolution))
      const seconds = { '1m': 60, '15m': 900, '1h': 3600, '1d': 86400 }[resolution]
      const rangeStart = Math.max(Date.parse(series.availableRange.fromInclusive), Date.parse(manifest.segmentBounds.fromInclusive))
      const rangeEnd = Math.min(Date.parse(series.availableRange.toExclusive), Date.parse(manifest.segmentBounds.toExclusive))
      const start = selection.fromInclusive === undefined ? rangeStart : Date.parse(selection.fromInclusive)
      requireBinding(Number.isFinite(start) && rangeStart < rangeEnd && start >= rangeStart && start < rangeEnd)
      const utc = (value: number) => new Date(value).toISOString().replace('.000Z', 'Z')
      requireBinding(selection.fromInclusive === undefined || selection.fromInclusive === utc(start))
      const fromInclusive = utc(start)
      const bucketMilliseconds = seconds * 1000
      // Include the first partial bucket in the SDK's maximum of 1,000 buckets.
      const end = Math.min(rangeEnd, (Math.floor(start / bucketMilliseconds) + 1000) * bucketMilliseconds)
      const toExclusive = utc(end)
      const windowData = (await charts.call('getChartWindowV5', {
        backtestId: job.backtestId, segment, manifestContentHash: manifest.manifestContentHash,
        seriesId: series.seriesId, resolution, fromInclusive, toExclusive, maxPoints: 1000,
      })).data
      requireBinding(windowData.manifestContentHash === manifest.manifestContentHash
        && windowData.priceKind === series.priceKind && windowData.nativeResolution === series.nativeResolution
        && (Object.keys(manifest.binding) as (keyof typeof manifest.binding)[])
          .every(key => manifest.binding[key] === windowData.binding[key]))
      requireBinding(sameValidatedJson(windowData.sourcePolicy, manifest.sourcePolicy))
      const view: PriceChartView = {
        identity: windowData.windowContentHash, market: manifest.symbol, resolutionSeconds: seconds, pricePrecision: 8,
        sourceLabel: `${windowData.sourcePolicy.sourceProvenance.source} · ${segment} · ${windowData.seriesId} · ${windowData.priceKind} · ${windowData.coverage.status} · liquidation=UNAVAILABLE`,
        bars: windowData.bars.map(bar => ({ time: Date.parse(bar.openTime) / 1000,
          open: Number(bar.open), high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), volume: Number(bar.volume) })),
        fills: [], // Trade fills are never inferred from OHLC bars or list order.
      }
      return { manifest, window: windowData, view, navigation: {
        supportedResolutions: series.supportedResolutions,
        availableRange: { fromInclusive: utc(rangeStart), toExclusive: utc(rangeEnd) },
        previousFromInclusive: start > rangeStart ? utc(Math.max(rangeStart, (Math.floor(start / bucketMilliseconds) - 1000) * bucketMilliseconds)) : null,
        nextFromInclusive: end < rangeEnd ? toExclusive : null,
      } }
    },
  }
}
