import { lazy, Suspense, useLayoutEffect, type ComponentProps } from 'react'
import type { ClientProfessionalPriceChart, ProfessionalRendererState } from './ClientProfessionalPriceChart'
import { ClientLoadBoundary } from './ClientLoadBoundary'
import { useClientPreferences } from '../client-preferences'
import { marketChartText } from '../client-market-chart-copy'

// Keep the result controller eager: its completion intent must be consumed at
// arrival, even while this optional renderer module is still loading.
const ProfessionalChart = lazy(() => import('./ClientProfessionalPriceChart').then(module => ({ default: module.ClientProfessionalPriceChart })))
type Props = ComponentProps<typeof ClientProfessionalPriceChart>

function ResultChartLoadStatus({ loading = false, onRendererStateChange }: {
  loading?: boolean; onRendererStateChange?: (state: ProfessionalRendererState) => void
}) {
  const { language } = useClientPreferences()
  useLayoutEffect(() => {
    onRendererStateChange?.(loading ? 'unavailable' : 'error')
    // No cleanup notification: the replacement renderer owns its ready/error
    // state. A retiring fallback must not overwrite the newly mounted chart.
  }, [loading, onRendererStateChange])
  return <div className="ctt-notice" data-native-chart-load={loading ? 'loading' : 'failed'} aria-busy={loading}>
    <p role={loading ? 'status' : 'alert'}>{marketChartText(language, loading ? 'rendererLoading' : 'rendererFailed')}</p>
    {!loading && <button type="button" onClick={() => window.location.reload()}>{marketChartText(language, 'rendererReload')}</button>}
  </div>
}

export function ClientLazyResultChart(props: Props) {
  return <ClientLoadBoundary fallback={<ResultChartLoadStatus onRendererStateChange={props.onRendererStateChange} />}>
    <Suspense fallback={<ResultChartLoadStatus loading onRendererStateChange={props.onRendererStateChange} />}>
      <ProfessionalChart {...props} />
    </Suspense>
  </ClientLoadBoundary>
}
