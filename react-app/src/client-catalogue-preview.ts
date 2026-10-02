/** Internal browser-preview port. Not a service API or order-capable adapter. */
import { validCatalogueMarketChart, type CatalogueMarketChart } from './client-catalogue-market-chart'
import type { CatalogueStrategy } from './client-catalogue'
import type { CatalogueSpotResult } from './client-catalogue-spot-engine'
import type { runCatalogueFuturesPreview } from './client-catalogue-futures-engine'
import type { sliceCataloguePreview } from './client-catalogue-window'
import type { CatalogueJudgment } from './client-catalogue-judgments'
import type { CatalogueCopyRecord, CatalogueCopyProjection } from './client-catalogue-copy'

export type CataloguePeriod = 'all' | '2y' | '1y' | '30d' | '7d'
export type CataloguePreviewResult = {
  source: 'client-snapshot-preview'
  sourceSha: string
  calendar: { start: string; asof: string }
  dataVersion: { spot: string; futures: string }
  strategy: Readonly<CatalogueStrategy>
  period: CataloguePeriod
  calculation: 'full-run' | 'restart-run' | 'equity-window'
  contextPeriod: 'selected' | 'all'
  judgments?: readonly CatalogueJudgment[]
  result: CatalogueSpotResult | ReturnType<typeof runCatalogueFuturesPreview> | ReturnType<typeof sliceCataloguePreview>
}
type MarketRequest = { kind: 'market'; strategyId: string; asset: string }
type RunRequest = { kind: 'run'; strategyId: string; period: CataloguePeriod }
type CopyRequest = { kind: 'copy'; owner: string; record: CatalogueCopyRecord; indices: number[] }
export type CatalogueWorkerRequest = (RunRequest | CopyRequest | MarketRequest | { kind: 'cancel' }) & { requestId: number }
export type CatalogueWorkerReply = { kind: 'market-result'; requestId: number; value: CatalogueMarketChart } | { kind: 'result'; requestId: number; value: CataloguePreviewResult } | { kind: 'copy-result'; requestId: number; value: CatalogueCopyProjection } | { kind: 'error'; requestId: number }
type Value = CataloguePreviewResult | CatalogueCopyProjection | CatalogueMarketChart
type WorkerPort = Pick<Worker, 'postMessage' | 'terminate'> & {
  onmessage: ((event: MessageEvent<CatalogueWorkerReply>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
}
const failure = () => Error('catalogue preview unavailable')
const abort = () => new DOMException('catalogue preview cancelled', 'AbortError')

/** One worker per owning preview workspace; dispose on owner retirement.
 * Static imports above are type-only: chat's initial bundle does not parse data.
 * Caller abort cancels only its request; other results remain independent.
 */
export function createCataloguePreviewClient(factory: () => WorkerPort = () => new Worker(new URL('./client-catalogue-worker.ts', import.meta.url), { type: 'module' })) {
  let worker: WorkerPort | null = null, retired = false, sequence = 0
  const waiting = new Map<number, { resolve: (v: Value) => void; reject: (error: Error) => void; cleanup: () => void; timer: ReturnType<typeof setTimeout>; request: RunRequest | CopyRequest | MarketRequest }>()
  const settle = (id: number, value?: Value, error?: Error) => {
    const pending = waiting.get(id); if (!pending) return
    waiting.delete(id); pending.cleanup(); clearTimeout(pending.timer)
    if (error) pending.reject(error); else pending.resolve(value!)
  }
  const stop = (error: Error) => {
    const current = worker; worker = null
    if (current) { current.onmessage = null; current.onerror = null; current.onmessageerror = null; current.terminate() }
    for (const id of [...waiting.keys()]) settle(id, undefined, error)
  }
  const ensureWorker = () => {
    if (worker) return worker
    const created = factory(); worker = created
    created.onmessage = event => {
      if (worker !== created) return
      const reply = event.data
      if (!reply || !Number.isSafeInteger(reply.requestId)) { stop(failure()); return }
      const pending = waiting.get(reply.requestId)
      if (!pending) return // Cancelled requests, including late copy results.
      if (reply.kind === 'error') settle(reply.requestId, undefined, failure())
      else if (reply.kind === 'result' && pending.request.kind === 'run') {
        const { period } = pending.request
        const window = period === '7d' || period === '30d'
        const calculation = window ? 'equity-window' : period === 'all' ? 'full-run' : 'restart-run'
        if (!reply.value || reply.value.source !== 'client-snapshot-preview' || reply.value.period !== period || !reply.value.strategy?.id || !reply.value.result
          || reply.value.calculation !== calculation || reply.value.contextPeriod !== (window ? 'all' : 'selected')) { stop(failure()); return }
        settle(reply.requestId, reply.value)
      }
      else if (reply.kind === 'copy-result' && pending.request.kind === 'copy') {
        const { record, owner, indices } = pending.request, value = reply.value
        if (!value || value.source !== 'client-catalogue-copy-preview' || value.owner !== owner || value.copyId !== record.id
          || !value.binding || Object.entries(record.binding).some(([key, v]) => value.binding[key as keyof typeof value.binding] !== v)
          || !value.settings || Object.entries(record.settings).some(([key, v]) => value.settings[key as keyof typeof value.settings] !== v)
          || !value.calculation || !Array.isArray(value.observations) || value.observations.length !== indices.length
          || value.observations.some((v, i) => v.i !== indices[i]) || !value.limitations?.includes('SNAPSHOT_PREVIEW_ONLY')) { stop(failure()); return }
        settle(reply.requestId, value)
      }
      else if (reply.kind === 'market-result' && pending.request.kind === 'market' && validCatalogueMarketChart(reply.value, pending.request.strategyId, pending.request.asset)) settle(reply.requestId, reply.value)
      else stop(failure())
    }
    created.onerror = event => { event.preventDefault(); if (worker === created) stop(failure()) }
    created.onmessageerror = () => { if (worker === created) stop(failure()) }
    return created
  }
  const request = (input: RunRequest | CopyRequest | MarketRequest, signal?: AbortSignal): Promise<Value> => {
      if (retired || signal?.aborted) return Promise.reject(abort())
      if (waiting.size >= 128) return Promise.reject(failure())
      let target: WorkerPort
      try { target = ensureWorker() } catch { return Promise.reject(failure()) }
      const requestId = ++sequence
      return new Promise((resolve, reject) => {
        const onAbort = () => { settle(requestId, undefined, abort()); try { target.postMessage({ kind: 'cancel', requestId } satisfies CatalogueWorkerRequest) } catch { /* Retired worker has no remaining owner. */ } }
        const timer = setTimeout(() => { if (worker === target) stop(failure()) }, 30000)
        waiting.set(requestId, { resolve, reject, cleanup: () => signal?.removeEventListener('abort', onAbort), timer, request: input })
        signal?.addEventListener('abort', onAbort, { once: true })
        if (signal?.aborted) { onAbort(); return }
        try { target.postMessage({ ...input, requestId } satisfies CatalogueWorkerRequest) }
        catch { if (worker === target) stop(failure()); else settle(requestId, undefined, failure()) }
      })
  }
  return {
    run(strategyId: string, period: CataloguePeriod, signal?: AbortSignal): Promise<CataloguePreviewResult> {
      if (!strategyId || !['all', '2y', '1y', '30d', '7d'].includes(period)) return Promise.reject(failure())
      return request({ kind: 'run', strategyId, period }, signal) as Promise<CataloguePreviewResult>
    },
    copy(owner: string, record: CatalogueCopyRecord, indices: readonly number[] = [], signal?: AbortSignal): Promise<CatalogueCopyProjection> {
      if (!record || record.owner !== owner || !record.binding || !record.settings || !Array.isArray(record.ledger) || record.ledger.length > 1000
        || !Array.isArray(record.flats) || record.flats.length > 1000 || !Array.isArray(indices) || indices.length > 32) return Promise.reject(failure())
      // Snapshot before posting: later caller edits cannot change reply identity.
      try { return request(structuredClone({ kind: 'copy', owner, record, indices: [...indices] } satisfies CopyRequest), signal) as Promise<CatalogueCopyProjection> }
      catch { return Promise.reject(failure()) }
    },
    market(strategyId: string, asset: string, signal?: AbortSignal): Promise<CatalogueMarketChart> {
      if (!strategyId || !asset) return Promise.reject(failure())
      return request({ kind: 'market', strategyId, asset }, signal) as Promise<CatalogueMarketChart>
    },
    dispose() { if (retired) return; retired = true; stop(abort()) },
  }
}
