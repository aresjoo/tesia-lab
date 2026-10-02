import { useId } from 'react'
import { useClientPreferences } from '../client-preferences'
import { sharedPercent } from '../client-shared-number-format'
import { sharedHash, type SharedLocation } from '../client-shared-strategies'
import type { ListPerformance } from '../client-strategy-list-performance'
import { strategyListSpark } from '../client-strategy-list-spark'
import type { StrategyClassification } from '../client-strategy-classification'
import type { StrategyIdentity } from '../client-strategy-identity'
import { ClientStrategyGlyph } from './ClientStrategyGlyph'
import { ClientStrategyIdentityMeta } from './ClientStrategyIdentityMeta'
import copy from '../client-strategy-list-copy.json'
import '../client-strategy-list.css'

/** Source skfCard: one navigation target and four information groups. No
 * exchange, kind, return, or follower count is inferred from a nickname. */
export function ClientStrategyListCard({ title, asset, kind, glyph, venue, followers, performance, location, onNavigate, own = false }: StrategyClassification & StrategyIdentity & {
  title: string; asset: string; followers?: number; performance: ListPerformance | null
  location: SharedLocation; onNavigate: (location: SharedLocation) => void; own?: boolean
}) {
  const { language } = useClientPreferences(), text = copy[language], id = useId()
  const spark = strategyListSpark(performance?.values ?? [])
  const curve = (color: string) => spark && <path d={spark.path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  const count = typeof followers === 'number' && Number.isSafeInteger(followers) && followers >= 0 ? followers.toLocaleString(language) : '—'
  const unavailable = <><span aria-hidden="true">—</span><span className="sr-only">{text.unavailable}</span></>
  return <article className="tfbk-card strategy-list-card" data-creator-card={own || undefined}>
    <a className="strategy-list-link" href={sharedHash(location)} aria-label={title} aria-describedby={`${id}-asset ${id}-performance ${id}-followers`} onKeyDown={event => {
      if (event.key !== ' ' || event.repeat || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      event.preventDefault(); onNavigate(location)
    }} onClick={event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault(); onNavigate(location)
    }}>
      <div className="skf-top"><ClientStrategyGlyph kind={kind} evidence={glyph}/><div className="skf-nm"><h3>{title}</h3><ClientStrategyIdentityMeta id={`${id}-asset`} kind={kind} venue={venue} fallback={asset}/></div></div>
      <div className="skf-perf"><div className="skf-ret" id={`${id}-performance`}><small>{text.recent}</small><b className={!performance || performance.percent === 0 ? undefined : performance.percent < 0 ? 'negative' : 'positive'}>{performance ? sharedPercent(performance.percent, language) : unavailable}</b></div>
        {spark && <svg viewBox="0 0 170 78" preserveAspectRatio="none" aria-hidden="true">{spark.flat ? <line x1="0" x2="170" y1="39" y2="39" stroke="rgba(255,255,255,.34)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/> : !spark.negative ? curve('#2ebd85') : <>
          <defs><clipPath id={`${id}-up`}><rect x="-2" y="-2" width="174" height={spark.baseline + 2}/></clipPath><clipPath id={`${id}-down`}><rect x="-2" y={spark.baseline} width="174" height={80 - spark.baseline}/></clipPath></defs>
          <line x1="0" x2="170" y1={spark.baseline} y2={spark.baseline} stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke"/>
          <g clipPath={`url(#${id}-up)`}>{curve('#2ebd85')}</g><g clipPath={`url(#${id}-down)`}>{curve('#f0566a')}</g>
          {spark.flatAtBase && <path d={spark.flatAtBase} fill="none" stroke="#2ebd85" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
        </>}</svg>}
      </div>
      <div className="skf-fw" id={`${id}-followers`}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/></svg><span>{text.followers} <b>{count === '—' ? unavailable : count}</b></span></div>
    </a>
  </article>
}
