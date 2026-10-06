import { useStaticUiCopy } from '../client-static-ui-copy'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { clientResearchScrollport } from '../client-research-scrollport'
import { CLIENT_RANKING, type ResearchPage, type ResearchRecord } from '../research-library'
import { formatReferenceMoney, useClientPreferences } from '../client-preferences'
import { researchCopy, type ResearchCopyKey } from '../client-research-copy'
import { ClientResearchHistory } from './ClientResearchHistory'
import { ClientIcon } from './ClientIcon'
import { ClientBrokers, type BrokerServices } from './ClientBrokers'
import { ClientLoadBoundary } from './ClientLoadBoundary'
import type { InsightServices } from './ClientInsights'
import type { ClientInsightLocation } from '../client-insight-navigation'
import type { SharedCopyRequest } from '../client-shared-copy'
import type { SharedLocation } from '../client-shared-strategies'
import type { SharedFollowSurface } from './ClientStrategySharing'
import { copyTradingLabel } from '../client-copy-trading-copy'
import strategyListCopy from '../client-strategy-list-copy.json'
import { sharingCopy } from '../client-sharing-copy'
import '../client-research-hub.css'
const ClientInsights = lazy(() => import('./ClientInsights').then(module => ({ default: module.ClientInsights })))
const ClientStrategySharing = lazy(() => import('./ClientStrategySharing').then(module => ({ default: module.ClientStrategySharing })))

type Props = {
  page: ResearchPage
  records: ResearchRecord[]
  onSelect: (id: string) => void
  onNew: () => void
  onFollow: (idea: string) => void
  onReturn: () => void
  shareable?: { id: string; title: string; returnRate: number }
  notice?: ReactNode
  externalBoundary?: boolean
  /** Explicit static preview provenance; never use reference rates for service amounts. */
  previewMoney?: boolean
  brokerServices?: BrokerServices
  brokerListRequest?: number
  insightServices?: InsightServices
  insightLocation?: ClientInsightLocation
  onInsightNavigate?: (location: ClientInsightLocation) => void
  onInsightAsk?: (text: string) => void | Promise<void>
  /** Only the explicit public source-preview caller supplies this surface. */
  sharingPreview?: SharedFollowSurface & { onCopy?: (request: SharedCopyRequest, followId?: string) => void; owner: string | null; location: SharedLocation; onNavigate: (value: SharedLocation, replace?: boolean) => void; onAsk: (text: string) => void | Promise<void>; signedIn: boolean; onLogin: () => void }
}

export function ClientResearchHub({ page, records, onSelect, onNew, onFollow, onReturn, shareable, notice, externalBoundary = false, previewMoney = false, brokerServices, brokerListRequest = 0, insightServices, insightLocation, onInsightNavigate, onInsightAsk, sharingPreview }: Props) {
  const localeUi = useStaticUiCopy()
  const { language, currency } = useClientPreferences()
  const copy = (key: ResearchCopyKey, values?: Record<string, string | number>) => researchCopy(language, key, values)
  const number = (value: number) => value.toLocaleString(language)
  const percent = (value: number) => value.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [shared, setShared] = useState<string[]>(() => {
    try { const value: unknown = JSON.parse(sessionStorage.getItem('teth-sharing-preview') ?? '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [] }
    catch { return [] }
  })
  const [shareNotice, setShareNotice] = useState<'previewOn' | 'previewOff' | 'previewError' | ''>('')
  const [brokerTitle, setBrokerTitle] = useState('지원 거래소')
  const title = page === 'brokers' && brokerTitle !== '지원 거래소' ? brokerTitle : copy(page)
  const sharingTitle = sharingPreview?.routeSections && sharingPreview.location.section ? sharingCopy(language, sharingPreview.location.section === 'library' ? '따라가는 중' : '내 전략') : sharingPreview?.location.view === 'trader' ? copyTradingLabel(language, '트레이더 프로필') : sharingPreview?.location.view === 'copy-setup' ? copyTradingLabel(language, '카피 설정') : sharingPreview?.location.view === 'copy-detail' ? copyTradingLabel(language, '카피 상세') : strategyListCopy[language].title
  const Container = externalBoundary ? 'section' : 'main'
  const sectionReturn = sharingPreview?.routeSections && sharingPreview.location.section ? sharingPreview.sectionReturn : undefined
  const scheduled = records.filter(record => record.live)
  useEffect(() => {
    if (page !== 'history') titleRef.current?.focus({ preventScroll: true })
    if (page === 'brokers') clientResearchScrollport()?.scrollTo({ top: 0 })
  }, [page, brokerListRequest])
  if (page === 'history') return <ClientResearchHistory records={records} onSelect={onSelect} onNew={onNew} onReturn={onReturn} notice={notice} externalBoundary={externalBoundary} />
  if ((page === 'sharing' || page === 'ranking') && sharingPreview) return <Container id="research-main" className="client-research-hub client-sharing-hub" aria-label={copy('sharing')}>
    <header className="hub-header"><h1 id="research-title" ref={titleRef} tabIndex={-1}>{sharingTitle}</h1><button type="button" onClick={sectionReturn?.onReturn ?? onReturn}>{sectionReturn?.label ?? copy('return')}</button></header>{notice}
    <ClientLoadBoundary fallback={<div role="alert"><p>{localeUi("전략 공유 화면을 불러오지 못했어요.")}</p><button type="button" onClick={onReturn}>{copy('return')}</button></div>}><Suspense fallback={<p role="status">{localeUi("전략 공유 화면을 불러오는 중이에요.")}</p>}><ClientStrategySharing routeTitleRef={titleRef} {...sharingPreview} key={sharingPreview.owner} owner={sharingPreview.owner} location={sharingPreview.location} onNavigate={sharingPreview.onNavigate} signedIn={sharingPreview.signedIn} onLogin={sharingPreview.onLogin} onAsk={sharingPreview.onAsk} onCopy={sharingPreview.onCopy} onReturn={onReturn} /></Suspense></ClientLoadBoundary>
  </Container>
  if (page === 'insight') return <Container id="research-main" className="client-research-hub client-insight-hub" aria-label={copy('insight')}>
    <ClientLoadBoundary fallback={<div role="alert"><p>{copy('insightError')}</p><button type="button" onClick={onReturn}>{copy('return')}</button></div>}>
      <Suspense fallback={<p role="status">{copy('insightLoading')}</p>}><ClientInsights {...insightServices} controlledLocation={insightLocation} initialSlug={insightLocation?.slug} initialTag={insightLocation?.tag} onNavigate={onInsightNavigate} onAsk={onInsightAsk ?? onFollow} onClose={onReturn} /></Suspense>
    </ClientLoadBoundary>
  </Container>
  if (page === 'brokers') return <Container id="research-main" className="client-research-hub client-broker-hub" aria-labelledby="research-title">
    <header className="hub-header"><h1 id="research-title" ref={titleRef} tabIndex={-1}>{title}</h1><button type="button" onClick={onReturn}>{copy('return')}</button></header>
    {notice}<ClientBrokers onTitleChange={setBrokerTitle} listRequest={brokerListRequest} {...brokerServices} />
  </Container>
  return <Container id="research-main" className="client-research-hub" aria-labelledby="research-title">
    <header className="hub-header"><h1 id="research-title" ref={titleRef} tabIndex={-1}>{title}</h1><button type="button" onClick={onReturn}>{copy('return')}</button></header>
    <div className={`hub-content ${page === 'ranking' || page === 'sharing' ? 'wide' : ''}`}>
      {notice}
      {!externalBoundary && <p className="hub-boundary">{copy('boundary')}</p>}
      {page === 'schedule' && (scheduled.length ? <><ul className="hub-history">{scheduled.map(record => <li key={record.id}><button type="button" onClick={() => onSelect(record.id)}><span className="record-title">{record.title}</span><span className="record-market">{copy('weekly')}</span><span className="record-status">{copy('holdout')}</span></button></li>)}</ul><p className="hub-description">{copy('scheduleDescription')}</p></> : <div className="hub-empty"><ClientIcon name="schedule" size={28} /><p>{copy('noSchedule')}</p>{!externalBoundary && <small>{copy('scheduleDisconnected')}</small>}</div>)}
      {page === 'ranking' && <>
        <h2>{copy('ranking')}</h2><p className="hub-description">{copy('rankingDescription')}</p>
        <ol className="hub-rank-list">{CLIENT_RANKING.map((row, index) => <li className="tf-rank" key={row.id}>
          <span className="no">{number(index + 1)}</span><span className="who"><strong>{row.nick}</strong><small>{copy('assetStrategy', { asset: copy(row.asset === '비트코인' ? 'bitcoin' : 'nasdaq') })}</small></span>
          <span className="sc">TETH <b>{copy('score', { score: number(row.score) })}</b></span><span className="sc">{copy('returnLabel')} <b className="positive">+{percent(row.returnRate)}%</b></span>
          <span className="fw">{copy('followers', { count: number(row.followers) })}</span>
          <button className="go" type="button" aria-label={copy('followLabel', { nick: row.nick })} onClick={() => onFollow(`${row.nick} 님의 ${row.asset} 전략을 검토하고 싶어요. RSI ${row.rsi} 아래에서 진입, 손절 ${row.stop}%, 익절 ${row.take}%, 추세 필터를 포함해 주세요.`)}>{copy('follow')}</button>
        </li>)}{externalBoundary && shareable && shared.includes(shareable.id) && <li className="tf-rank"><span className="no">{number(CLIENT_RANKING.length + 1)}</span><span className="who"><strong>{shareable.title}</strong><small>{copy('myPublic')}</small></span><span className="sc">{copy('returnLabel')} <b className="positive">{shareable.returnRate >= 0 ? '+' : ''}{percent(shareable.returnRate)}%</b></span><span className="fw">{copy('followers', { count: number(0) })}</span><button className="go" type="button" onClick={() => onSelect(shareable.id)}>{copy('open')}</button></li>}</ol>
        {!externalBoundary && <p className="hub-footnote">{copy('rankingFootnote')}</p>}
      </>}
      {page === 'sharing' && <>
        <h2>{copy('sharing')}</h2><p className="hub-description">{copy('sharingDescription')}</p>
        {shareable ? <div className="tf-share">
          <button className="tf-switch" role="switch" aria-checked={shared.includes(shareable.id)} aria-label={copy('previewLabel', { title: shareable.title })} type="button" onClick={() => {
            const next = shared.includes(shareable.id) ? shared.filter(id => id !== shareable.id) : [...shared, shareable.id]
            setShared(next)
            try { sessionStorage.setItem('teth-sharing-preview', JSON.stringify(next)); setShareNotice(next.includes(shareable.id) ? 'previewOn' : 'previewOff') }
            catch { setShareNotice('previewError') }
          }}><i /></button>
          <div className="share-identity"><strong>{shareable.title}</strong><small>{externalBoundary ? '' : 'Mock '}{copy('returnLabel')} {shareable.returnRate >= 0 ? '+' : ''}{percent(shareable.returnRate)}%</small></div>
          <span className="share-reward">{copy('reward', { amount: previewMoney ? formatReferenceMoney(0, currency, language) : '₩0' })}</span>
        </div> : <div className="hub-empty"><ClientIcon name="sharing" size={28} /><p>{copy('noSharing')}</p><button type="button" onClick={onReturn}>{copy('return')}</button></div>}
        {shareNotice && <p className="hub-footnote" role="status">{copy(shareNotice)}</p>}
        {!externalBoundary && <p className="hub-footnote">{copy('sharingFootnote')}</p>}
      </>}
    </div>
  </Container>
}
