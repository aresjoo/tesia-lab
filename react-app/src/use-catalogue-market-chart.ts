import { useEffect, useMemo, useState } from 'react'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import { catalogueChartAsset, type CatalogueMarketChart } from './client-catalogue-market-chart'

type Reader = (strategyId: string, asset: string, signal: AbortSignal) => Promise<CatalogueMarketChart>
/** Price metadata and series arrive as one bound display input. Reuse the
 * account's worker; cancel only this request, never another copy inspection. */
export function useCatalogueMarketChart(value: CataloguePreviewResult | undefined, market: Reader, enabled: boolean) {
  const [attempt, setAttempt] = useState(0)
  const asset = value ? catalogueChartAsset(value) : null
  const key = useMemo(() => ({ value, market, enabled, attempt }), [value, market, enabled, attempt])
  const [result, setResult] = useState<{ key: typeof key; data?: CatalogueMarketChart } | null>(null)
  useEffect(() => {
    if (!enabled || !value || !asset) return
    const request = new AbortController()
    void market(value.strategy.id, asset, request.signal).then(data => {
      if (data.sourceSha !== value.sourceSha || data.calendar.start !== value.calendar.start || data.calendar.asof !== value.calendar.asof
        || data.dataVersion.spot !== value.dataVersion.spot || data.dataVersion.futures !== value.dataVersion.futures) throw Error('unbound catalogue prices')
      if (!request.signal.aborted) setResult({ key, data })
    }).catch(() => { if (!request.signal.aborted) setResult({ key }) })
    return () => request.abort()
  }, [key, enabled, value, asset, market])
  const current = result?.key === key ? result : null
  return { state: !enabled || !value || !asset ? 'unavailable' as const : current ? current.data ? 'ready' as const : 'error' as const : 'loading' as const,
    data: current?.data, retry: () => setAttempt(n => n + 1) }
}
