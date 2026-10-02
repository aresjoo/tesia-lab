import { useEffect, useRef } from 'react'
import { useClientPreferences } from '../client-preferences'
import { professionalChartLocale } from '../client-professional-chart-locale'
import { marketChartText } from '../client-market-chart-copy'
import { boundMarketScenario } from '../client-market-scenario'
import type { MarketChartPresentation } from '../client-market-chart-presentation'
import type { PriceBar } from '../chart/price-chart-view'
import { ClientScenarioScrollAnchor } from './ClientScenarioScrollAnchor'
import { marketBindingKey } from '../client-market-response-presentation'

type Drawing = { bars: readonly PriceBar[]; upper: number; lower: number; restored: boolean }
function ScenarioCanvas({ signature, label }: { signature: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const data: Drawing = JSON.parse(signature)
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, disposed = false, progress = data.restored || media.matches || document.hidden ? 1 : 0
    let width = 0, height = 0
    const start = performance.now()
    const draw = () => {
      if (disposed || !width || !height) return
      const dpr = Math.min(devicePixelRatio || 1, 2)
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const light = document.body.classList.contains('light') || document.documentElement.classList.contains('light')
      const up = light ? '#1e8e3e' : '#60c88c', down = light ? '#c53929' : '#eb786e'
      const accent = light ? '#3462d6' : '#8fb2ff', split = width * .55
      const values = [data.upper, data.lower, ...data.bars.flatMap(b => [b.low, b.high])]
      const magnitude = Math.max(...values), lo = Math.min(...values) / magnitude, hi = 1
      const pad = (hi - lo) * .14 || .01
      const y = (value: number) => height - ((value / magnitude - lo + pad) / (hi - lo + pad * 2)) * height
      ctx.fillStyle = light ? 'rgba(52,98,214,.05)' : 'rgba(143,178,255,.05)'
      ctx.fillRect(split, 0, width - split, height)
      ctx.strokeStyle = light ? 'rgba(52,98,214,.25)' : 'rgba(143,178,255,.22)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, height); ctx.stroke(); ctx.setLineDash([])
      const first = data.bars[0], last = data.bars[data.bars.length - 1]
      const range = last.time - first.time + 86400, bw = Math.max(.5, split * 86400 / range)
      for (const bar of data.bars) {
        const x = split * (bar.time - first.time + 43200) / range
        ctx.strokeStyle = ctx.fillStyle = bar.close >= bar.open ? up : down
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y(bar.high)); ctx.lineTo(x, y(bar.low)); ctx.stroke()
        ctx.fillRect(x - bw * .3, Math.min(y(bar.open), y(bar.close)), bw * .6, Math.max(1.5, Math.abs(y(bar.open) - y(bar.close))))
      }
      const q = progress * progress * (3 - 2 * progress), x = split + (width - split - 12) * q
      const origin = y(last.close), upper = origin + (y(data.upper) - origin) * q, lower = origin + (y(data.lower) - origin) * q
      const cone = ctx.createLinearGradient(split, 0, width, 0)
      cone.addColorStop(0, light ? 'rgba(52,98,214,.14)' : 'rgba(143,178,255,.13)'); cone.addColorStop(1, 'rgba(143,178,255,0)')
      ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(split, origin); ctx.lineTo(x, upper); ctx.lineTo(x, lower); ctx.closePath(); ctx.fill()
      ctx.setLineDash([6, 5]); ctx.lineWidth = 1.6
      for (const [end, color] of [[upper, up], [lower, down]] as const) { ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(split, origin); ctx.lineTo(x, end); ctx.stroke() }
      ctx.setLineDash([]); ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(split, origin, 3, 0, Math.PI * 2); ctx.fill()
      canvas.dataset.progress = String(progress)
    }
    const tick = (now: number) => { if (disposed) return; progress = Math.min(1, (now - start) / 1700); draw(); if (progress < 1) frame = requestAnimationFrame(tick) }
    const finish = () => { progress = 1; cancelAnimationFrame(frame); draw() }
    const accessibilityChanged = () => { if (media.matches || document.hidden) finish() }
    const resize = new ResizeObserver(([entry]) => { width = entry.contentRect.width; height = entry.contentRect.height; draw() })
    resize.observe(canvas)
    const theme = new MutationObserver(draw)
    theme.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    media.addEventListener('change', accessibilityChanged); document.addEventListener('visibilitychange', accessibilityChanged)
    if (progress < 1) frame = requestAnimationFrame(tick)
    return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); theme.disconnect(); media.removeEventListener('change', accessibilityChanged); document.removeEventListener('visibilitychange', accessibilityChanged) }
  }, [signature])
  return <canvas ref={ref} role="img" aria-label={label}/>
}

function ScenarioBody({ presentation }: { presentation: MarketChartPresentation }) {
  const { language } = useClientPreferences(), format = professionalChartLocale(language)
  const bound = boundMarketScenario(presentation)
  if (!bound) return null
  const { scenario: s, view } = bound
  const t = (key: Parameters<typeof marketChartText>[1]) => marketChartText(language, key)
  // Positive sub-cent assets must not be formatted as zero by a fraction cap.
  const price = new Intl.NumberFormat(format.locale, { maximumSignificantDigits: 15 }).format
  const signature = JSON.stringify({ bars: view.bars.slice(-40), upper: s.upperPrice, lower: s.lowerPrice, restored: s.restored === true })
  const label = `${t('observed')} · ${t('scenario')} · ${t('upper')} ${price(s.upperPrice)} · ${t('lower')} ${price(s.lowerPrice)}`
  return <section className="fc client-market-scenario" aria-label={t('scenario')}>
    <p className="lb">{s.basisLabel} · {t('scenarioCaveat')}</p>
    <div className="scenario-zones" aria-hidden="true"><span>{t('observed')}</span><span>{t('scenario')}</span></div>
    <ScenarioCanvas key={JSON.stringify([marketBindingKey(presentation.binding), view.identity])} signature={signature} label={label}/>
    <dl className="scenario-values"><div><dt>{t('upper')}</dt><dd>{price(s.upperPrice)}</dd></div><div><dt>{t('lower')}</dt><dd>{price(s.lowerPrice)}</dd></div></dl>
    <p className="scenario-horizon">{t('horizon')} · {format.utc(s.horizonTime)} UTC</p>
  </section>
}

export function ClientMarketScenario({ presentation }: { presentation: MarketChartPresentation }) {
  return <ClientScenarioScrollAnchor><ScenarioBody presentation={presentation}/></ClientScenarioScrollAnchor>
}
