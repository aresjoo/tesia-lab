import { TesiaNativeResultsV06Client } from './contracts/generated/api-v0.6/client'
import { ApiV07Error, TesiaNativeJobsV07Client, type Transport } from './contracts/generated/api-v0.7/client'
import { TesiaNativeConversationHistoryV08Client } from './contracts/generated/api-v0.8/client'
import type { Operations as JobOperations } from './contracts/generated/api-v0.7/types'
import type { Operations as ResultOperations } from './contracts/generated/api-v0.6/types'
import type { Operations as ChartOperations } from './contracts/generated/api-v0.5/types'
import { createNativeChartReadAccess } from './native-chart-read-access'

export const NATIVE_CONTRACTS_COMMIT = '954f36744a7d2d496b25aeca5a85dc3d4b5e0f22'
export type NativeJob = JobOperations['getNativeBacktestV7']['response']['data']
export type NativeReport = ResultOperations['getNativeReportV6']['response']['data']
export type NativeTrades = ResultOperations['getNativeTradesV6']['response']['data']
export type NativeChartManifest = ChartOperations['getChartManifestV5']['response']['data']
export type NativeChartWindow = ChartOperations['getChartWindowV5']['response']['data']
export type NativeFillMarkers = ChartOperations['getFillMarkersV5']['response']['data']
export type NativeChartWindowSelection = {
  seriesId?: NativeChartWindow['seriesId']
  resolution?: NativeChartWindow['resolution']
  fromInclusive?: string
  expectedManifestContentHash?: string
}

const MAX_BODY = 4 * 1024 * 1024
const READ_PATH = /^\/api\/v(?:5\/backtests\/[A-Za-z0-9_-]+\/(?:chart-manifest|chart-window|fill-markers)|6\/backtests\/[A-Za-z0-9_-]+\/native-(?:report|trades)|7\/backtests\/[A-Za-z0-9_-]+|8\/conversations\/[A-Za-z0-9_-]+\/native-history)$/

// A rejected protocol response must not become a retryable network outage just
// because the immutable SDK maps all transport exceptions to TRANSPORT_FAILED.
class NativeProtocolRejection extends Error {}

/** Browser transport only. All JSON semantics and response hashes are owned by
 * the immutable generated clients; no cookies or response bodies are logged.
 */
export class NativeServiceTransport implements Transport {
  private readonly requests = new Set<AbortController>()

  abort(): void {
    for (const request of this.requests) request.abort()
    this.requests.clear()
  }

  async request(request: Parameters<Transport['request']>[0]): Promise<Awaited<ReturnType<Transport['request']>>> {
    const origin = window.location.origin
    const url = new URL(request.path, origin)
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
      || url.origin !== origin || url.username || url.password || url.hash
      || !request.path.startsWith('/api/') || request.path.startsWith('//')
      || `${url.pathname}${url.search}` !== request.path
      || (request.method === 'GET' ? !READ_PATH.test(url.pathname)
        : request.method !== 'POST' || url.pathname !== '/api/v7/backtests' || url.search !== '')
      || request.credentials !== 'include' || request.redirect !== 'manual' || request.cache !== 'no-store') {
      throw new NativeProtocolRejection('NATIVE_SAME_ORIGIN_OPERATION_REQUIRED')
    }
    for (const name of Object.keys(request.headers)) {
      if (!['accept', 'content-type', 'x-csrf-token', 'idempotency-key'].includes(name.toLowerCase())) {
        throw new NativeProtocolRejection('NATIVE_REQUEST_HEADER_REJECTED')
      }
    }
    const controller = new AbortController()
    this.requests.add(controller)
    const timer = window.setTimeout(() => controller.abort(), 30_000)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      const response = await fetch(url.href, { ...request, signal: controller.signal })
      if (response.type === 'opaqueredirect' || response.redirected || response.url !== url.href
        || response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json'
        || response.headers.get('cache-control')?.toLowerCase() !== 'no-store' || response.body === null) {
        throw new NativeProtocolRejection('NATIVE_RESPONSE_REJECTED')
      }
      const declared = response.headers.get('content-length')
      if (declared !== null && (!/^(0|[1-9][0-9]*)$/.test(declared) || Number(declared) > MAX_BODY)) {
        throw new NativeProtocolRejection('NATIVE_RESPONSE_TOO_LARGE')
      }
      reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let body = '', size = 0
      for (;;) {
        const { value, done } = await reader.read()
        if (controller.signal.aborted) throw new Error('NATIVE_REQUEST_ABORTED')
        if (done) break
        size += value.byteLength
        if (size > MAX_BODY) throw new NativeProtocolRejection('NATIVE_RESPONSE_TOO_LARGE')
        try { body += decoder.decode(value, { stream: true }) }
        catch { throw new NativeProtocolRejection('NATIVE_RESPONSE_REJECTED') }
      }
      try { body += decoder.decode() }
      catch { throw new NativeProtocolRejection('NATIVE_RESPONSE_REJECTED') }
      const headers: Record<string, string> = {}
      for (const name of ['cache-control', 'etag']) {
        const value = response.headers.get(name)
        if (value !== null) headers[name] = value
      }
      return { status: response.status, headers, body }
    } finally {
      window.clearTimeout(timer)
      controller.abort()
      if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock() }
      this.requests.delete(controller)
    }
  }
}

const requireBinding = (condition: boolean): void => {
  if (!condition) throw new Error('NATIVE_RESULT_BINDING_CONFLICT')
}

const sameReportBinding = (a: NativeReport['binding'], b: NativeReport['binding']): boolean => (
  (Object.keys(a) as (keyof typeof a)[]).every(key => a[key] === b[key])
  && (Object.keys(b) as (keyof typeof b)[]).every(key => a[key] === b[key])
)

export function createNativeServiceApi(transport: Transport = new NativeServiceTransport()) {
  const generatedJobs = new TesiaNativeJobsV07Client(transport)
  const jobs: Pick<TesiaNativeJobsV07Client, 'call'> = {
    async call(operation, request, mutation) {
      // POST and all wire schemas stay on the original generated path. This
      // per-GET flag cannot leak between simultaneous requests or owners.
      if (operation !== 'getNativeBacktestV7') return generatedJobs.call(operation, request, mutation)
      let protocolRejected = false
      const observed = new TesiaNativeJobsV07Client({ request: async input => {
        try { return await transport.request(input) }
        catch (failure) { protocolRejected = failure instanceof NativeProtocolRejection; throw failure }
      } })
      try { return await observed.call(operation, request, mutation) }
      catch (failure) {
        if (protocolRejected && failure instanceof ApiV07Error && failure.code === 'TRANSPORT_FAILED') throw new ApiV07Error('INVALID_RESPONSE')
        throw failure
      }
    },
  }
  const results = new TesiaNativeResultsV06Client(transport)
  const chartAccess = createNativeChartReadAccess(transport)
  const history = new TesiaNativeConversationHistoryV08Client(transport)
  return {
    jobs, history,
    async report(job: NativeJob): Promise<NativeReport> {
      requireBinding(job.state === 'COMPLETED' && job.resultAvailable)
      if (job.state !== 'COMPLETED') throw new Error('NOT_READY')
      const { data } = await results.call('getNativeReportV6', { backtestId: job.backtestId })
      requireBinding(sameReportBinding(job.nativeReportBinding, data.binding)
        && data.binding.splitGroupId === job.splitGroupId
        && data.strategyAuthorityMapping.approvalStrategyVersionId === job.strategyVersionId)
      return data
    },
    async trades(report: NativeReport, segment: 'IS' | 'OOS', cursor?: string): Promise<NativeTrades> {
      const { data } = await results.call('getNativeTradesV6', {
        backtestId: report.binding.backtestId, segment, limit: 100, ...(cursor ? { cursor } : {}),
      })
      const expected = report.nativeEnvelope.projection.segments.find(item => item.segment === segment)
      requireBinding(expected !== undefined)
      const { segment: actualSegment, resultContentHash, tradeListId, tradeListContentHash, ...binding } = data.binding
      requireBinding(sameReportBinding(report.binding, binding) && actualSegment === segment
        && resultContentHash === expected?.resultContentHash
        && tradeListId === expected?.tradeManifest.tradeListId
        && tradeListContentHash === expected?.tradeManifest.tradeListContentHash
        && data.strategyAuthorityMapping.approvalStrategyVersionId === report.strategyAuthorityMapping.approvalStrategyVersionId)
      return data
    },
    markers: chartAccess.markers,
    async chart(job: NativeJob, report: NativeReport, segment: 'IS' | 'OOS', selection: NativeChartWindowSelection = {}) {
      // Manual reads always revalidate a fresh manifest. Only a separate,
      // explicitly disposed replay reader may reuse its private snapshot.
      const manifest = await chartAccess.manifest(job, report, segment)
      return chartAccess.window(job, report, segment, manifest, selection)
    },
  }
}
