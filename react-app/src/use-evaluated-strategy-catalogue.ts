import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseEvaluatedCatalogue, matchesEvaluatedCataloguePin, type EvaluatedCatalogue } from './client-evaluated-strategy-catalogue'
import { discoveredDisplayNames, discoveredPresentation, type DiscoveredCatalogue } from './client-discovered-strategy-catalogue'
import { useDiscoveredStrategyCatalogue } from './use-discovered-strategy-catalogue'

type State = { state: 'loading' | 'ready' | 'error'; value: EvaluatedCatalogue | null }
export function mergeDiscoveredCatalogue(original: EvaluatedCatalogue, discovery: DiscoveredCatalogue, sourceSha: string): EvaluatedCatalogue | null {
  const localeNames = Object.fromEntries(['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr'].map(language => [language, discoveredDisplayNames(discovery.items, language)]))
  const generated = discovery.items.filter(item => item.evaluation.eligible).map(item => {
    const view = discoveredPresentation(item, sourceSha)
    view.discovery!.displayNames = Object.fromEntries(Object.entries(localeNames).map(([language, names]) => [language, names.get(item.id)!]))
    return view
  })
  const items = [...original.items, ...generated]
  if (new Set(items.map(item => item.id)).size !== items.length) return null
  return { ...original, items, counts: { ...original.counts, rule: original.counts.rule + generated.length }, sourceBindings: { ...original.sourceBindings, ...Object.fromEntries(generated.map(item => [item.id, { sourceSha, sourceId: item.id, schema: 'arena-strategy-discovery-0.1' }])) } }
}

export function useEvaluatedStrategyCatalogue(enabled: boolean) {
  const [state, setState] = useState<State>({ state: 'loading', value: null })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => { setState(previous => ({ state: 'loading', value: previous.value })); setAttempt(value => value + 1) }, [])
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch('/__local/strategy-catalogue.json', { signal: controller.signal, cache: 'no-store', credentials: 'omit' })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('Unavailable')
        const raw = await response.arrayBuffer()
        if (raw.byteLength > 8_388_608) throw Error('Catalogue too large')
        const digest = await crypto.subtle.digest('SHA-256', raw)
        const sourceSha = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
        const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
        const value = await parseEvaluatedCatalogue(body)
        // The actual connection is pinned independently of the flexible test projection parser.
        const expectedRevision = import.meta.env.VITE_LOCAL_STRATEGY_CATALOGUE_REVISION
        if (expectedRevision && !matchesEvaluatedCataloguePin(value, expectedRevision)) throw Error('Unapproved local catalogue')
        value.sourceBindings = Object.fromEntries(value.items.map(item => [item.id, { sourceSha, sourceId: item.id, schema: 'arena-strategy-catalogue-0.1' }]))
        if (!controller.signal.aborted) setState({ state: 'ready', value })
      } catch {
        if (!controller.signal.aborted) setState(previous => ({ state: 'error', value: previous.value }))
      }
    })()
    return () => controller.abort()
  }, [enabled, attempt])
  const discoveryEnabled = enabled && import.meta.env.VITE_LOCAL_STRATEGY_DISCOVERY === 'true'
  const discovery = useDiscoveredStrategyCatalogue(discoveryEnabled)
  const merged = useMemo(() => {
    if (!state.value || !discoveryEnabled || !discovery.value || !discovery.sourceSha) return state.value
    return mergeDiscoveredCatalogue(state.value, discovery.value, discovery.sourceSha)
  }, [state.value, discoveryEnabled, discovery.value, discovery.sourceSha])
  const combined = discoveryEnabled && discovery.state !== 'ready' ? discovery.state : state.state
  return { state: merged === null && state.value ? 'error' as const : combined, value: merged, retry: () => { retry(); discovery.retry() } }
}
