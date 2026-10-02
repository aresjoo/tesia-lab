import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { validMarketPickerRows, type MarketPickerPresentation } from './client-market-picker'
import { boundTerminalMarketSource, validMarketObservation, type TerminalMarketObservation, type TerminalMarketSource } from './client-terminal-market-source'
import type { ClientTerminalStrategy } from './client-terminal-view'

const empty = { v: 1 as const, manualId: null, lastId: null, favorites: [] as string[], storageError: false }
const noSubscribe = () => () => {}, noSnapshot = () => empty
export function useTerminalMarketSource(input: TerminalMarketSource | undefined, scope: string | null | undefined, strategy: ClientTerminalStrategy | undefined, enabled: boolean) {
  const source = boundTerminalMarketSource(input, scope), preferences = source?.preferences
  const choices = useSyncExternalStore(preferences?.subscribe ?? noSubscribe, preferences?.getSnapshot ?? noSnapshot, preferences?.getSnapshot ?? noSnapshot)
  const resource = source?.catalog
  const valid = resource?.state === 'ready' && validMarketPickerRows(resource.value)
    && resource.value.every(row => row.market.trim() && row.exchangeId.trim())
  const instruments = resource?.state === 'ready' && valid ? resource.value : undefined
  const following = strategy ? instruments?.filter(row => row.id === source?.strategyInstruments?.[strategy.id]
    && row.symbol === strategy.symbol && row.exchangeId === strategy.exchange.id) : undefined
  const requested = choices.manualId ?? (following?.length === 1 ? following[0].id : strategy ? null : choices.lastId)
  const instrument = instruments?.find(row => row.id === requested)
  const [attempt, setAttempt] = useState(0)
  const identity = JSON.stringify([source?.scope, source?.identity, instrument?.id, instrument?.symbol, instrument?.exchangeId, enabled, attempt])
  const requestKey = useMemo(() => ({ identity }), [identity])
  const [result, setResult] = useState<{ key: typeof requestKey; data?: TerminalMarketObservation } | null>(null)
  useEffect(() => {
    if (!enabled || !source || !instrument) return
    const controller = new AbortController(), expected = { ...instrument, categories: [...instrument.categories] }
    const binding = { scope: source.scope, identity: source.identity }, load = source.load
    // Wrappers/locale renders do not refetch. Source identity retires a request;
    // even a loader that ignores abort cannot paint a superseded selection.
    void Promise.resolve().then(() => controller.signal.aborted ? undefined : load(expected.id, controller.signal)).then(value => {
      if (!value || !validMarketObservation(value, binding, expected)) throw Error('unbound market observation')
      if (!controller.signal.aborted) setResult({ key: requestKey, data: structuredClone(value) })
    }).catch(() => { if (!controller.signal.aborted) setResult({ key: requestKey }) })
    return () => controller.abort()
    // The explicit key captures every selection/binding field, not tick updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])
  const current = result?.key === requestKey && enabled && instrument ? result : undefined
  const picker: MarketPickerPresentation | undefined = source && enabled ? {
    identity: JSON.stringify([source.scope, source.identity]),
    rows: resource?.state === 'ready' && !valid ? { state: 'error' } : source.catalog,
    selectedId: instrument?.id ?? null, favorites: choices.favorites,
    onFavorite: (id, favorite) => { if (instruments?.some(row => row.id === id)) preferences?.favorite(id, favorite) },
    onSelect: id => { if (instruments?.some(row => row.id === id)) preferences?.select(id) },
  } : undefined
  return { picker, instrument, data: current?.data, active: enabled && !!source && requested !== null,
    state: !instrument ? resource?.state === 'loading' || resource?.state === 'error' ? resource.state : 'unavailable' as const : current ? current.data ? 'ready' as const : 'error' as const : 'loading' as const,
    storageError: choices.storageError, retrySave: preferences?.retry,
    follow: () => preferences?.follow(), retry: () => setAttempt(value => value + 1) }
}
