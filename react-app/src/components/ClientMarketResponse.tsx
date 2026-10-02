import { useEffect, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { marketResponseText } from '../client-market-response-copy'
import { marketBindingKey, marketSourceHref, type MarketSource, type MarketResponseBlock, type MarketDirectionPresentation } from '../client-market-response-presentation'
import '../client-market-response.css'

const unique = (rows: readonly { id: string }[]) => rows.every(row => !!row.id) && new Set(rows.map(row => row.id)).size === rows.length
export function ClientMarketSources({ sources }: { sources: readonly MarketSource[] }) {
  if (!unique(sources)) return null
  return <div className="srclist client-market-sources">{sources.map(source => {
    const href = marketSourceHref(source.url)
    const content = <><svg className="fv" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg><span className="tt">{source.title}{source.description && <small>{source.description}</small>}</span>{href && <span className="dm">{new URL(href).hostname}</span>}</>
    return href ? <a key={source.id} className="srow" href={href} target="_blank" rel="noopener noreferrer">{content}</a> : <div key={source.id} className="srow">{content}</div>
  })}</div>
}
function Direction({ data }: { data: MarketDirectionPresentation }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof marketResponseText>[1]) => marketResponseText(language, key)
  const [visualUp, setVisualUp] = useState(() => data.restored || typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches || document.hidden ? data.up : 50)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, stopped = false
    const finish = () => { stopped = true; cancelAnimationFrame(frame); setVisualUp(data.up) }
    const changed = () => { if (media.matches || document.hidden) finish() }
    if (data.restored || media.matches || document.hidden) return
    const start = performance.now()
    const tick = (now: number) => { if (stopped) return; const progress = Math.min(1, (now - start) / 600); setVisualUp(50 + (data.up - 50) * progress * (2 - progress)); if (progress < 1) frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    media.addEventListener('change', changed); document.addEventListener('visibilitychange', changed)
    return () => { stopped = true; cancelAnimationFrame(frame); media.removeEventListener('change', changed); document.removeEventListener('visibilitychange', changed) }
  }, [data.up, data.restored])
  return <section className="g-gauge client-market-response" aria-label={`${data.asset} · ${t('direction')}`}>
    <div className="t"><b>{data.asset}</b><span>{t('direction')}{data.symbol ? `, ${data.symbol}` : ''}, {t('estimate')}</span></div>
    <div className="bar" aria-hidden="true"><span className="d"/><span className="u" style={{ transform: `scaleX(${visualUp / 100})` }}/></div>
    <div className="lg"><span className="u" aria-label={`${t('up')} ${data.up}%`}>{t('up')} <em aria-hidden="true">{visualUp === data.up ? data.up : Math.round(visualUp)}%</em></span><span className="d" aria-label={`${t('down')} ${data.down}%`}>{t('down')} <em aria-hidden="true">{visualUp === data.up ? data.down : Math.round(100 - visualUp)}%</em></span></div>
    <div className="market-provenance">{data.sourceLabel} · {data.observedAtLabel}</div>
  </section>
}
/** No fetching, price joins, tag execution or synthesized market observations. */
export function ClientMarketResponse({ block }: { block: MarketResponseBlock }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof marketResponseText>[1], values?: Record<string,string | number>) => marketResponseText(language, key, values)
  const key = marketBindingKey(block.presentation.binding)
  if (!key) return null
  if (block.kind === 'market-direction') {
    const p = block.presentation
    if (!p.hasMarketObservation || !p.sourceLabel.trim() || !p.observedAtLabel.trim() || !Number.isFinite(p.up) || !Number.isFinite(p.down) || p.up < 0 || p.down < 0 || p.up > 100 || p.down > 100 || Math.abs(p.up + p.down - 100) > 1e-8) return null
    return <Direction key={JSON.stringify([key,p.up,p.down,p.restored])} data={p}/>
  }
  if (block.kind === 'market-price') {
    const p = block.presentation
    return <section className="g-pxcard client-market-response" aria-label={p.asset}><span className="as">{p.asset}</span><b className="pv">{p.priceLabel}</b><span className={`chg ${p.tone}`}>{p.changeLabel} {p.changeBasis}</span><span className="meta">{p.sourceLabel}, {p.observedAtLabel}, {t('analysis',{ interval:p.intervalLabel })}</span></section>
  }
  if (block.kind === 'market-timeline') {
    const p = block.presentation
    // The source conversation shows at most four supplied events per answer.
    const events = p.events.slice(0, 4)
    if (!events.length || !unique(events)) return null
    return <section className="g-evtl client-market-response" aria-label={t('timeline')}><div className="tl-hd"><span>{t('timeline')}</span>{p.observedDaily && <span className="tl-note">{t('daily')}</span>}</div>
      {events.map(event => { const href = event.sourceUrl && marketSourceHref(event.sourceUrl); return <div className={`tl-node ${event.tone ?? ''}`} key={event.id}><span className="tl-spine" aria-hidden="true"><i className="tl-dot"/><i className="tl-line"/></span><div className="tl-body"><div className="tl-meta"><span className="tl-date">{event.dateLabel}{event.mappedTradingDateLabel && <em className="tl-map">{t('mapped',{date:event.mappedTradingDateLabel})}</em>}</span>{p.observedDaily && (event.priceLabel || event.changeLabel) && <span className={`tl-px ${event.tone ?? ''}`}>{event.priceLabel} <em>{event.changeLabel}</em></span>}</div><div className="tl-title">{event.title}</div>{event.sourceLabel && <div className="tl-src">{href ? <a href={href} target="_blank" rel="noopener noreferrer">{event.sourceLabel}</a> : event.sourceLabel}</div>}</div></div> })}
      {p.observedDaily && <div className="tl-dis">{t('caveat')}</div>}</section>
  }
  const p = block.presentation
  if (![p.searches,p.results,p.pagesRead].every(value => Number.isSafeInteger(value) && value >= 0)) return null
  return <section key={key} className="g-srcstrip client-market-response"><p>{t('evidence',{ searches:p.searches,results:p.results,pages:p.pagesRead })}</p>{p.sources.length > 0 && <details><summary>{t('sources')}</summary><ClientMarketSources sources={p.sources}/></details>}</section>
}
