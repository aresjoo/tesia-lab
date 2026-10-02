import { useMemo } from 'react'
import { catalogueChartPrecision, type CatalogueMarketChart } from '../client-catalogue-market-chart'
import { catalogueMarketCopy } from '../client-catalogue-market-copy'
import { useClientPreferences } from '../client-preferences'
import { ClientProfessionalPriceChart } from './ClientProfessionalPriceChart'
import { ClientSourceCloseChart } from './ClientSourceCloseChart'

const noFills = [] as const
/** Same bound data as the market header; never a live quote or personal fill. */
export function ClientCatalogueMarketChart({ data }: { data: CatalogueMarketChart }) {
  const { language } = useClientPreferences(), text = catalogueMarketCopy(language)
  // Provenance identity is locale-independent. UI descriptions below localize
  // without replacing the chart input, resetting zoom, or rebuilding a canvas.
  const sourceLabel = `SNAPSHOT · ${data.symbol} · ${data.calendar.start} → ${data.calendar.asof} · 1D`
  const view = useMemo(() => data.market === 'futures' ? { identity: JSON.stringify([data.sourceSha, data.strategyId, data.asset, data.dataVersion]), market: data.symbol, resolutionSeconds: 86400, pricePrecision: catalogueChartPrecision(data.bars), sourceLabel, bars: data.bars, fills: noFills } : null, [data, sourceLabel])
  return <div className="catalogue-market-chart" data-source={data.source} data-asset={data.asset} data-strategy-id={data.strategyId} data-source-sha={data.sourceSha}>
    {view ? <ClientProfessionalPriceChart view={view} variant="market" /> : <ClientSourceCloseChart points={data.closes} markers={noFills} label={data.symbol}
      presentation={{ ariaLabel: `${data.symbol} ${text.close}`, interval: `1D · ${text.close}`, fit: text.fit, note: `${text.snapshot} · ${data.calendar.start} → ${data.calendar.asof} · ${text.closes}`, locale: language }} />}
    <p className="cp-note" title={data.provenance}>{data.market === 'futures' ? text.volume : text.closes} · {text.history}</p>
  </div>
}
