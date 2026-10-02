import { Component, lazy, Suspense, type ComponentProps, type ReactNode } from 'react'
import type { ClientProfessionalPriceChart } from './ClientProfessionalPriceChart'
import { useClientPreferences } from '../client-preferences'
import { marketChartText } from '../client-market-chart-copy'
import { ClientAnimatedLogo } from './ClientAnimatedLogo'

// A stable module-level component preserves the renderer and its canvas on
// observation, interval and locale updates. Import only when this slot renders.
const ProfessionalChart = lazy(() => import('./ClientProfessionalPriceChart').then(module => ({ default: module.ClientProfessionalPriceChart })))

class MarketChartLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <MarketChartLoadStatus /> : this.props.children }
}

function MarketChartLoadStatus({ loading = false }: { loading?: boolean }) {
  const { language } = useClientPreferences()
  return <div className="market-chart-empty" data-market-chart-load={loading ? 'loading' : 'failed'} aria-busy={loading}>
    <div>
      <p className={loading ? 'market-chart-loading' : undefined} role={loading ? 'status' : 'alert'}>{loading && <ClientAnimatedLogo width={24} />}<span>{marketChartText(language, loading ? 'rendererLoading' : 'rendererFailed')}</span></p>
      {!loading && <div className="market-chart-status">
        {/* Failed module URLs may be cached by the browser. Do not promise a
            local retry, silently navigate, or claim an unsaved draft is safe. */}
        <button type="button" onClick={() => window.location.reload()}>{marketChartText(language, 'rendererReload')}</button>
      </div>}
    </div>
  </div>
}

export function ClientLazyMarketChart(props: ComponentProps<typeof ClientProfessionalPriceChart>) {
  return <MarketChartLoadBoundary><Suspense fallback={<MarketChartLoadStatus loading />}>
    <ProfessionalChart {...props} />
  </Suspense></MarketChartLoadBoundary>
}
