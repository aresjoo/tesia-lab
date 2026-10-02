import { loadCatalogueMarketData } from './client-catalogue-market-data'
import { computeCatalogueBacktest } from './client-catalogue-backtest-result'
import { validCatalogueBacktestSelection, type CatalogueBacktestRequest, type CatalogueBacktestReply } from './client-catalogue-backtest'

const active = new Set<number>()
const scope = self as unknown as { onmessage: ((event: MessageEvent<CatalogueBacktestRequest>) => void) | null; postMessage: (reply: CatalogueBacktestReply) => void }
scope.onmessage = event => {
  const request = event.data
  if (!request || !Number.isSafeInteger(request.requestId) || request.requestId < 1) return
  if (request.kind === 'cancel') { active.delete(request.requestId); return }
  if (request.kind !== 'run' || !validCatalogueBacktestSelection(request.selection) || active.has(request.requestId) || active.size >= 16) {
    scope.postMessage({ kind: 'error', requestId: request.requestId }); return
  }
  const { requestId } = request, selection = { ...request.selection }
  active.add(requestId)
  void loadCatalogueMarketData().then(data => {
    if (!active.has(requestId)) return
    const value = computeCatalogueBacktest(selection, data)
    if (!active.delete(requestId)) return
    scope.postMessage({ kind: 'result', requestId, value })
  }).catch(() => { if (active.delete(requestId)) scope.postMessage({ kind: 'error', requestId }) })
}
