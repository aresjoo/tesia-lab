// Browser-only test mount. Not a product entry or a source of market data.
import { createRoot } from 'react-dom/client'
import { ClientProfessionalPriceChart } from '../../src/components/ClientProfessionalPriceChart'
import type { PriceChartView } from '../../src/chart/price-chart-view'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '../../src/client-restored-research.css'

export function mount(view: PriceChartView | null) {
  const app = document.getElementById('root')!
  app.hidden = true
  const host = document.createElement('main')
  host.className = 'client-restored-research'
  host.style.cssText = 'position:absolute;inset:0;height:auto;min-height:100vh;z-index:9999;overflow:auto'
  document.body.append(host)
  const root = createRoot(host)
  const output = document.createElement('output')
  output.id = 'selected-fill'
  host.after(output)
  const render = (next: PriceChartView | null) => root.render(<ClientProfessionalPriceChart view={next} onFillSelect={fill => { output.textContent = fill.id }} />)
  render(view)
  return { render, unmount: () => { root.unmount(); host.remove(); output.remove(); app.hidden = false } }
}
