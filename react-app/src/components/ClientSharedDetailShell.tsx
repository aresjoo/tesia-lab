import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { Share2 } from 'lucide-react'
import { useClientPreferences } from '../client-preferences'
import { copyTraderLocation, type SharedLocation, type SharedStrategy } from '../client-shared-strategies'
import { sharingCopy } from '../client-sharing-copy'
import { researchCopy } from '../client-research-copy'
import detailCopy from '../client-detail-skin-copy.json'
import { ClientStrategyGlyph } from './ClientStrategyGlyph'
import { ClientStrategyIdentityMeta } from './ClientStrategyIdentityMeta'
import '../client-shared-detail.css'

type Identity = Pick<SharedStrategy, 'nick' | 'title' | 'asset' | 'kind' | 'glyph' | 'venue' | 'description' | 'me'> & { author?: string }

/** One visual shell for the legacy/service evidence and the source catalogue.
 * No computation, routing by author, or fabricated financial fields here. */
export function ClientSharedDetailShell({ row, info, children, location, title, onNavigate, onCopy, onAnalyze, onWatch, onCopyLink, analyzing, watched, watchDisabled = false, analyzeDisabled = false, shareAvailable = true, authorRoute, header, breadcrumbLabel }: {
  row: Identity; info: readonly (readonly string[])[]; children: ReactNode
  location: SharedLocation; title: RefObject<HTMLHeadingElement | null>
  onNavigate: (location: SharedLocation, replace?: boolean) => void
  onCopy: () => void; onAnalyze: () => void; onWatch: () => void; onCopyLink: () => void
  analyzing: boolean; watched: boolean; watchDisabled?: boolean; analyzeDisabled?: boolean; shareAvailable?: boolean; authorRoute?: string; header?: ReactNode; breadcrumbLabel?: string
}) {
  const { language } = useClientPreferences(), copy = detailCopy[language]
  const s = (key: Parameters<typeof sharingCopy>[1]) => sharingCopy(language, key)
  const id = useId(), tabs = useRef<(HTMLButtonElement | null)[]>([])
  const active = location.detailTab === 'info' ? 1 : 0
  const choose = (index: number) => {
    onNavigate({ ...location, detailTab: index === 1 ? 'info' : undefined })
    tabs.current[index]?.focus({ preventScroll: true })
  }
  const author = row.author ?? row.nick
  return <div className="client-shared-detail">
    <nav className="tfbk-bc" aria-label={s('현재 위치')}><button type="button" onClick={() => onNavigate({ period: 'all' })}>{breadcrumbLabel ?? researchCopy(language, 'sharing')}</button><span> / {row.title ?? row.nick}</span></nav>
    {header ?? <header className="shared-detail-head">
      <div className="shared-detail-title-row"><div className="shared-detail-identity">
        <ClientStrategyGlyph kind={row.kind} evidence={row.glyph} size={44}/>
        <div className="shared-detail-title"><h2 className="ss3-dtitle" ref={title} tabIndex={-1}>{row.title ?? row.nick}</h2>
          <div className="ss3-dsub">{row.kind || row.venue ? <ClientStrategyIdentityMeta kind={row.kind} venue={row.venue} fallback={row.asset}/> : null}<span>{row.asset}</span><span>{copy.registeredBy} {authorRoute ? <button type="button" className="shared-detail-profile" onClick={() => onNavigate(copyTraderLocation(authorRoute))}>{author}</button> : <>{author}{row.me ? ` ${s('(나)')}` : ''}</>}</span></div>
        </div>
      </div><div className="shared-detail-tools">
        <button type="button" className="shared-detail-share" aria-label={s('전략 링크 복사')} disabled={!shareAvailable} onClick={onCopyLink}><Share2 size={17} aria-hidden="true"/></button>
        {!row.me && <button type="button" className="shared-detail-watch" disabled={watchDisabled} aria-pressed={watched} onClick={onWatch}>{s(watched ? '관심 전략 해제' : '관심 전략')}</button>}
      </div></div>
      {row.description && <p className="ss3-ddescription">{row.description}</p>}
      <div className="ss3-dacts shared-detail-actions">{row.me ? <span className="ss3-own-badge">{s('내가 공유한 전략')}</span> : <button type="button" className="wbtn" onClick={onCopy}>{researchCopy(language, 'follow')}</button>}
        <button type="button" className="shared-detail-analysis" disabled={analyzing || analyzeDisabled} aria-busy={analyzing} onClick={onAnalyze}>{s('TETH에게 분석시키기')}</button>
      </div>
    </header>}
    <nav className="shared-detail-tabs" role="tablist" aria-label={copy.info} onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? 1 - active : null
      if (next !== null) { event.preventDefault(); choose(next) }
    }}>{[copy.overview, copy.info].map((label, index) => <button key={index} ref={element => { tabs.current[index] = element }} id={`${id}-tab-${index}`} type="button" role="tab" aria-selected={active === index} aria-controls={`${id}-panel-${index}`} tabIndex={active === index ? 0 : -1} onClick={() => choose(index)}>{label}</button>)}</nav>
    <div id={`${id}-panel-0`} role="tabpanel" aria-labelledby={`${id}-tab-0`} hidden={active !== 0}>{children}</div>
    <div id={`${id}-panel-1`} role="tabpanel" aria-labelledby={`${id}-tab-1`} hidden={active !== 1} tabIndex={0}><dl className="shared-detail-info">{info.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
  </div>
}
