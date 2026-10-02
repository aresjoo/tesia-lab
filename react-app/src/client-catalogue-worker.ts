import { projectCatalogueMarketChart } from './client-catalogue-market-chart'
import { catalogueSourceSha, findCatalogueStrategy } from './client-catalogue'
import { loadCatalogueMarketData } from './client-catalogue-market-data'
import { runCatalogueSpotPreview } from './client-catalogue-spot-engine'
import { runCatalogueFuturesPreview } from './client-catalogue-futures-engine'
import { sliceCataloguePreview } from './client-catalogue-window'
import { catalogueJudgments } from './client-catalogue-judgments'
import { projectCatalogueCopy, readCatalogueCopyRecord, type CatalogueCopyRecord } from './client-catalogue-copy'
import type { CataloguePreviewResult, CatalogueWorkerReply, CatalogueWorkerRequest } from './client-catalogue-preview'

const active = new Set<number>()
const cache = new Map<string, CataloguePreviewResult>()
const scope = self as unknown as { onmessage: ((event: MessageEvent<CatalogueWorkerRequest>) => void) | null; postMessage: (reply: CatalogueWorkerReply) => void }
scope.onmessage = event => {
  const request = event.data
  if (!request || !Number.isSafeInteger(request.requestId) || request.requestId < 1) return
  const { requestId } = request
  if (request.kind === 'cancel') { active.delete(requestId); return }
  if ((request.kind !== 'run' && request.kind !== 'copy' && request.kind !== 'market') || active.has(requestId) || active.size >= 128) { scope.postMessage({ kind: 'error', requestId }); return }
  let copy: Readonly<CatalogueCopyRecord> | undefined
  try { if (request.kind === 'copy') copy = readCatalogueCopyRecord(request.record, request.owner) } catch { scope.postMessage({ kind: 'error', requestId }); return }
  const period = request.kind === 'run' ? request.period : 'all'
  const strategyId = copy ? copy.binding.strategyId : request.kind !== 'copy' ? request.strategyId : ''
  if (!['all', '2y', '1y', '30d', '7d'].includes(period)) { scope.postMessage({ kind: 'error', requestId }); return }
  const strategy = typeof strategyId === 'string' ? findCatalogueStrategy(strategyId) : undefined
  if (!strategy) { scope.postMessage({ kind: 'error', requestId }); return }
  active.add(requestId)
  void loadCatalogueMarketData().then(data => {
    if (!active.has(requestId)) return
    if (request.kind === 'market') {
      const value = projectCatalogueMarketChart(strategy.id, request.asset, data)
      active.delete(requestId); scope.postMessage({ kind: 'market-result', requestId, value }); return
    }
    const key = `${strategy.id}:${period}`
    let value = cache.get(key)
    if (!value) {
      const window = period === '7d' || period === '30d'
      const start = period === 'all' || window ? undefined : Math.max(strategy.startI, data.length - 1 - (period === '2y' ? 730 : 365))
      const full = strategy.fut ? runCatalogueFuturesPreview(strategy, data, start) : runCatalogueSpotPreview(strategy, data, start)
      const result = window ? sliceCataloguePreview(full, period === '7d' ? 7 : 30) : full
      value = { source: 'client-snapshot-preview', sourceSha: catalogueSourceSha, calendar: { start: data.spot.start, asof: data.spot.asof }, dataVersion: { spot: data.spot.v, futures: data.future.v }, strategy, period, result, calculation: window ? 'equity-window' : period === 'all' ? 'full-run' : 'restart-run', contextPeriod: window ? 'all' : 'selected' }
      // Short equity windows intentionally retain the full-run context ledger.
      value.judgments = catalogueJudgments({ ...value, result: full }, data)
    }
    // Eight recent detail windows, not an unbounded per-caller result history.
    cache.delete(key); cache.set(key, value)
    if (cache.size > 8) cache.delete(cache.keys().next().value!)
    // Account-specific projections never enter the shared strategy cache.
    const reply: CatalogueWorkerReply = request.kind === 'copy'
      ? { kind: 'copy-result', requestId, value: projectCatalogueCopy(copy, request.owner, value, data, request.indices) }
      : { kind: 'result', requestId, value }
    active.delete(requestId)
    scope.postMessage(reply)
  }).catch(() => {
    if (!active.delete(requestId)) return
    scope.postMessage({ kind: 'error', requestId })
  })
}
