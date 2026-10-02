import { useLayoutEffect, useRef, useState } from 'react'
import { ClientLazyMarketChart as ClientProfessionalPriceChart } from './ClientLazyMarketChart'
import { useClientPreferences } from '../client-preferences'
import { professionalChartLocale } from '../client-professional-chart-locale'
import { marketBindingKey } from '../client-market-response-presentation'
import { marketChartLifetime, type MarketChartActions, type MarketChartPresentation } from '../client-market-chart-presentation'
import { marketChartText } from '../client-market-chart-copy'
import '../client-market-chart.css'
import { ClientMarketScenario } from './ClientMarketScenario'
import { ClientAnimatedLogo } from './ClientAnimatedLogo'

/** Source g-chartcard surface; no external widget, direct feed or fake bars. */
export function ClientMarketChartCard({ presentation: p, actions }: {
  presentation: MarketChartPresentation; actions?: MarketChartActions
}) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof marketChartText>[1]) => marketChartText(language, key)
  const format = professionalChartLocale(language)
  const lifetime = marketChartLifetime(p)
  const identity = JSON.stringify([marketBindingKey(p.binding), p.seriesId, p.asset, p.resolutionSeconds])
  const available = typeof actions?.request === 'function'
  const blocked = actions?.blockedReason !== undefined
  const blockedText = actions?.blockedReason === 'storage-error' ? t('storageBlocked')
    : actions?.blockedReason === 'commit-uncertain' ? t('commitUncertain') : t('unavailable')
  // Callback wrappers may change on ordinary composer renders. Only availability
  // and the observation identity define this request lifetime.
  const requestKey = JSON.stringify([identity, available])
  const current = useRef(requestKey)
  const flight = useRef<AbortController | null>(null)
  type Notice = { state: 'pending' | 'failed'; resolutionSeconds: number }
  const [requestState, setRequestState] = useState<{ key: string; notice: Notice | null }>({ key: requestKey, notice: null })
  if (requestState.key !== requestKey) setRequestState({ key: requestKey, notice: null })
  const notice = requestState.key === requestKey ? requestState.notice : null
  useLayoutEffect(() => {
    current.current = requestKey
    return () => { current.current = ''; flight.current?.abort(); flight.current = null }
  }, [requestKey])
  const pending = notice?.state === 'pending'
  const failed = notice?.state === 'failed'
  const resolutions = [...new Set(p.availableResolutions)].filter(value => Number.isSafeInteger(value) && value > 0)
  const retryResolution = failed ? notice.resolutionSeconds : p.resolutionSeconds
  const matches = !p.view || p.view.market === p.asset && p.view.resolutionSeconds === p.resolutionSeconds
  const view = matches ? p.view : null
  const request = async (resolutionSeconds: number) => {
    if (!available || blocked || flight.current || p.state === 'loading' || !lifetime || !resolutions.includes(resolutionSeconds)) return
    const controller = new AbortController()
    flight.current = controller
    const setNotice = (notice: Notice | null) => setRequestState({ key: requestKey, notice })
    setNotice({ state: 'pending', resolutionSeconds })
    const active = () => !controller.signal.aborted && flight.current === controller && current.current === requestKey
    try {
      const accepted = await actions!.request!({ binding: { ...p.binding }, seriesId: p.seriesId, asset: p.asset, resolutionSeconds }, controller.signal)
      if (active()) setNotice(accepted === true ? null : { state: 'failed', resolutionSeconds })
    } catch { if (active()) setNotice({ state: 'failed', resolutionSeconds }) }
    finally { if (flight.current === controller) flight.current = null }
  }
  if (!lifetime || !p.asset.trim() || !p.assetLabel.trim() || !Number.isSafeInteger(p.resolutionSeconds) || p.resolutionSeconds < 1) return null
  const status = pending || p.state === 'loading' ? 'loading' : !matches ? 'mismatch' : failed || p.state === 'error' ? 'failed' : !view || p.state === 'unavailable' ? 'unavailable' : null
  const statusText = `${notice ? `${format.resolution(notice.resolutionSeconds)} · ` : ''}${t(status ?? 'unavailable')}`
  const statusLabel = status === 'loading' ? <span className="market-chart-loading"><ClientAnimatedLogo width={24} /><span>{statusText}</span></span> : <span>{statusText}</span>
  return <section className="g-chartcard client-market-chart" aria-label={`${p.assetLabel} ${t('chart')}`} data-observation={p.binding.observationId}>
    <header className="hd"><span>{p.assetLabel}</span><span className="tvtag">TradingView</span></header>
    <div className="market-chart-intervals" role="group" aria-label={t('interval')}>
      {resolutions.map(resolution => <button key={resolution} type="button" aria-pressed={resolution === p.resolutionSeconds} disabled={!available || blocked || pending || p.state === 'loading'} onClick={() => { if (resolution !== p.resolutionSeconds) void request(resolution) }}>{format.resolution(resolution)}</button>)}
    </div>
    <div className="bd" aria-busy={pending || p.state === 'loading'}>
      {view && p.state !== 'unavailable' ? <ClientProfessionalPriceChart view={view} continuityKey={lifetime} variant="market" showBarFills={false}/>
        : <div className="market-chart-empty" role="status">{statusLabel}</div>}
    </div>
    {status && (view || status !== 'loading' && available) && <div className="market-chart-status" role={view ? 'status' : undefined}>{view && statusLabel}{status !== 'loading' && available && <button type="button" disabled={blocked || !resolutions.includes(retryResolution)} onClick={() => void request(retryResolution)}>{t('retry')}</button>}</div>}
    {blocked && <p className="market-chart-blocked" role="status">{blockedText}</p>}
    <ClientMarketScenario presentation={p}/>
  </section>
}
