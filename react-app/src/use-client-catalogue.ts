import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { findCatalogueStrategy } from './client-catalogue'
import { createCatalogueDisplayStore } from './client-catalogue-display-store'

/** Owner changes replace the preview workspace; real service surfaces never
 * instantiate a worker. Effect subscription cleanup retires pending requests. */
export function useClientCatalogue(enabled: boolean, owner: string | null, selected?: string) {
  const store = useMemo(() => createCatalogueDisplayStore(enabled, owner), [enabled, owner])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const selectedId = selected ? findCatalogueStrategy(selected)?.id : undefined
  useEffect(() => store.select(selectedId), [store, selectedId])
  return { performance: state.performance, state: state.state, detail: state.detail?.id === selectedId ? state.detail : null, retry: store.retry }
}
