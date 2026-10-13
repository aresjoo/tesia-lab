import { useCallback, useEffect, useState } from 'react'
import { catalogueHash, parseDiscoveredCatalogue, type DiscoveredCatalogue } from './client-discovered-strategy-catalogue'
import { canonicalCatalogueJson } from './client-evaluated-strategy-catalogue'

export async function readDiscoveredCatalogue(pin: string, request: typeof fetch, signal: AbortSignal) {
  if (!/^[a-f0-9]{64}$/.test(pin)) throw Error('Unapproved generated catalogue')
  const response = await request('/__teth/discovered-strategies.json', { method: 'GET', signal, cache: 'no-store', credentials: 'omit', redirect: 'error' })
  if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('application/json') || !response.body) throw Error('Generated catalogue unavailable')
  const reader = response.body.getReader(), parts: Uint8Array[] = []; let size = 0
  try { for (;;) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > 8_388_608) throw Error('Generated catalogue too large'); parts.push(next.value) } }
  finally { await reader.cancel().catch(() => undefined) }
  const bytes = new Uint8Array(size); let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.length }
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes), body: unknown = JSON.parse(raw)
  // Canonical wire bytes reject duplicate keys and encoding aliases before source binding.
  if (raw !== canonicalCatalogueJson(body) + '\n') throw Error('Noncanonical generated catalogue')
  const value = await parseDiscoveredCatalogue(body)
  if (value.revision !== pin) throw Error('Unapproved generated catalogue')
  return { value, sourceSha: await catalogueHash(body) }
}
export function useDiscoveredStrategyCatalogue(enabled: boolean) {
  const [state, setState] = useState<{ state: 'loading' | 'ready' | 'error'; value: DiscoveredCatalogue | null; sourceSha: string | null }>({ state: 'loading', value: null, sourceSha: null })
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => { setState(previous => ({ ...previous, state: 'loading' })); setAttempt(value => value + 1) }, [])
  useEffect(() => {
    if (!enabled || !import.meta.env.DEV) return
    const controller = new AbortController()
    void readDiscoveredCatalogue(import.meta.env.VITE_LOCAL_STRATEGY_DISCOVERY_REVISION ?? '', fetch, controller.signal)
      .then(value => { if (!controller.signal.aborted) setState({ state: 'ready', ...value }) })
      .catch(() => { if (!controller.signal.aborted) setState(previous => ({ ...previous, state: 'error' })) })
    return () => controller.abort()
  }, [enabled, attempt])
  return { ...state, retry }
}
