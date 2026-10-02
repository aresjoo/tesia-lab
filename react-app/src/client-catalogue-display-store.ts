import { catalogueStrategies } from './client-catalogue'
import { createCataloguePreviewClient, type CataloguePreviewResult } from './client-catalogue-preview'
import { catalogueListPerformance } from './client-catalogue-presentation'
import type { ListPerformance } from './client-strategy-list-performance'

type Status = 'loading' | 'ready' | 'error'
type Snapshot = {
  owner: string | null; performance: ReadonlyMap<string, ListPerformance | null>; state: Status
  detail: { id: string; value: CataloguePreviewResult | null; state: Status } | null
}
type Client = ReturnType<typeof createCataloguePreviewClient>

/** UI-only external store. Lifecycle starts at subscription, not render. One
 * sequential list queue keeps only small sparklines, plus one detail ledger. */
export function createCatalogueDisplayStore(enabled: boolean, owner: string | null, factory: () => Client = createCataloguePreviewClient) {
  let snapshot: Snapshot = { owner, performance: new Map(), state: 'loading', detail: null }
  const listeners = new Set<() => void>()
  let client: Client | null = null, listing: AbortController | null = null, detail: AbortController | null = null, selected: string | undefined
  const emit = (patch: Partial<Snapshot>) => { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()) }
  const select = (id: string | undefined) => {
    selected = id; detail?.abort(); detail = null
    if (!client || !id) { if (snapshot.detail) emit({ detail: null }); return }
    const request = new AbortController(); detail = request
    emit({ detail: { id, state: 'loading', value: null } })
    void client.run(id, 'all', request.signal).then(value => {
      if (!request.signal.aborted) emit({ detail: value.strategy.id === id && value.period === 'all' ? { id, state: 'ready', value } : { id, state: 'error', value: null } })
    }, () => { if (!request.signal.aborted) emit({ detail: { id, state: 'error', value: null } }) })
  }
  const stop = () => {
    listing?.abort(); detail?.abort(); listing = detail = null
    client?.dispose(); client = null
  }
  const start = () => {
    if (!enabled || client || !listeners.size) return
    client = factory()
    const target = client, request = new AbortController(), values = new Map<string, ListPerformance | null>()
    listing = request
    emit({ state: 'loading', performance: new Map(), detail: null })
    select(selected)
    void (async () => {
      try {
        for (const strategy of catalogueStrategies) {
          const value = await target.run(strategy.id, 'all', request.signal)
          if (request.signal.aborted) return
          if (value.strategy.id !== strategy.id || value.period !== 'all') throw Error('catalogue result mismatch')
          values.set(strategy.id, catalogueListPerformance(value.result))
          emit({ performance: new Map(values) })
        }
        emit({ state: 'ready' })
      } catch { if (!request.signal.aborted) emit({ state: 'error' }) }
    })()
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); start(); return () => { listeners.delete(listener); if (!listeners.size) stop() } },
    select,
    retry() { stop(); start() },
  }
}
