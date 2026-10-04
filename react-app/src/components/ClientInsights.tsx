import { createContext, Fragment, useCallback, useContext, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { clientResearchScrollport } from '../client-research-scrollport'
import { copyInsightLink } from '../client-insight-clipboard'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Meh, Share2, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { CLIENT_INSIGHTS, CLIENT_INSIGHT_SOURCE, INSIGHT_ART, INSIGHT_ASSETS, INSIGHT_AUTHORS, INSIGHT_FIGURES, type InsightSection } from '../client-insight-fixtures'
import { getSitePage } from '../site-navigation'
import { ClientInsightQuestionError, clientInsightHash } from '../client-insight-navigation'
import '../client-insights.css'
import { ClientInsightGallery } from './ClientInsightGallery'
import { ClientInsightUnavailable } from './ClientInsightUnavailable'
import { insightMediaUrl, insightShareUrl, type InsightPresentationArticle, type InsightPresentationData } from '../client-insight-presentation'
import { useClientPreferences, type ClientLanguage } from '../client-preferences'
import { researchCopy, researchNavigationLabel } from '../client-research-copy'
import { insightPresentationCopy } from '../client-insight-presentation-copy'
import { insightSourceCopy, insightTagLabel } from '../client-insight-source-copy'

export type InsightLocation = { slug?: string; tag?: string }
type InsightSnapshot = { location: InsightLocation; scroll: number; selector?: string }
const locationKey = (location: InsightLocation) => JSON.stringify([location.slug ?? '', location.tag ?? ''])
export type InsightServices = {
  signedIn?: boolean
  onLogin?: (mode: 'login' | 'signup') => void
  onFeedback?: (slug: string, value: 0 | 1 | 2) => Promise<void>
}
export type ClientInsightsProps = InsightServices & {
  source?: 'source-preview' | 'service'
  data?: InsightPresentationData | null
  shouldFocus?: () => boolean
  onAsk: (text: string) => void | Promise<void>
  onClose?: () => void
  onTitleChange?: (title: string) => void
  initialSlug?: string
  initialTag?: string
  controlledLocation?: InsightLocation
  onNavigate?: (location: InsightLocation) => void
  locationHref?: (location: InsightLocation) => string
}
const sourceTime = Date.parse(CLIENT_INSIGHT_SOURCE.referenceTime)
// Keep the source's three meanings without relying on OS emoji fonts.
const feedbackChoices = [{ key: 'negative', Icon: ThumbsDown }, { key: 'neutral', Icon: Meh }, { key: 'positive', Icon: ThumbsUp }] as const
const previewRows = [...CLIENT_INSIGHTS].filter(p => p.min <= 72 * 60).sort((a, b) => a.min - b.min)
// Source art uses an Arial bitcoin glyph that is unavailable on some systems.
// Keep its position/color and use the already-installed Lucide Bitcoin outline.
const bitcoinPath = 'M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727'
const svgSource = (value: string) => {
  const normalized = value.replace(/<text\b([^>]*)>(?:₿|&#8383;)<\/text>/g, (_, attributes: string) => {
    const attribute = (key: string) => attributes.match(new RegExp(`\\b${key}="([^"]+)"`))?.[1]
    const x = Number(attribute('x')), y = Number(attribute('y')), size = Number(attribute('font-size'))
    return `<g transform="${attribute('transform') ?? ''}"><g transform="translate(${x - size / 2} ${y - size * .83}) scale(${size / 24})" fill="none" stroke="${attribute('fill') ?? '#fff'}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="${bitcoinPath}"/></g></g>`
  })
  // Inline source SVGs do not require xmlns; standalone SVG image documents do.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(/<svg\b[^>]*\bxmlns=/.test(normalized) ? normalized : normalized.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'))}`
}
let previewData: InsightPresentationData | undefined
function sourcePreviewData(): InsightPresentationData {
  if (previewData) return previewData
  // Service entry never converts the source fixture's illustration catalog.
  const artUrls = Object.fromEntries(Object.entries(INSIGHT_ART).map(([key, value]) => [key, { hero: svgSource(value.hero), wide: svgSource(value.wide) }]))
  const figureUrls = Object.fromEntries(Object.entries(INSIGHT_FIGURES).map(([key, value]) => [key, svgSource(value)]))
  const assetUrls = Object.fromEntries(Object.entries(INSIGHT_ASSETS).map(([key, value]) => [key, svgSource(value)]))
  const authorUrls = Object.fromEntries(Object.entries(INSIGHT_AUTHORS).map(([key, value]) => [key, svgSource(value.svg)]))
  previewData = {
  identity: CLIENT_INSIGHT_SOURCE.kind,
  heading: '9월 13일, 시장은 이렇게 움직입니다',
  subheading: '내 전략에 무엇이 달라지는지 함께 봅니다',
  periodLabel: '최근 72시간, 시장에서 꼭 알아야 할 변화',
  curators: ['a1', 'a2'].map(author => ({ name: INSIGHT_AUTHORS[author].name, avatarUrl: authorUrls[author] })),
  figureUrls,
  assetUrls,
  articles: previewRows.map(article => ({
    ...article,
    authorName: INSIGHT_AUTHORS[article.au]?.name ?? null,
    authorAvatarUrl: authorUrls[article.au],
    publishedAt: new Date(sourceTime - article.min * 60000).toISOString(),
    art: { heroUrl: artUrls[article.art]?.hero, wideUrl: artUrls[article.art]?.wide },
    placement: article.lv === 1 ? 'featured' : article.lv === 2 ? 'secondary' : 'standard',
    trendingRank: article.trend,
  })),
  }
  return previewData
}
const InsightDataContext = createContext<{ data: InsightPresentationData; preview: boolean }>({ data: { identity: 'UNAVAILABLE', heading: '', subheading: '', articles: [] }, preview: false })
const date = (article: InsightPresentationArticle) => {
  const value = article.publishedAt && Date.parse(article.publishedAt)
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value).toISOString() : undefined
}
const plain = (text: string) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part)

function Art({ article, hero = false, showCategory = true, aspectRatio }: { article: InsightPresentationArticle; hero?: boolean; showCategory?: boolean; aspectRatio?: string }) {
  const { preview } = useContext(InsightDataContext)
  const raw = article.art?.[hero ? 'heroUrl' : 'wideUrl']
  const url = preview ? raw : insightMediaUrl(raw)
  return <div className={`nfz-art${hero ? ' nfz-hero2' : ''}`} style={aspectRatio ? { aspectRatio } : undefined}>{showCategory && <span className="cat">{article.cat}</span>}{url && <img src={url} alt={article.art?.alt ?? ''} width={800} height={hero ? 440 : 356} loading={hero ? 'eager' : 'lazy'} decoding="async" />}</div>
}
function PersonalAvatar() {
  const id = useId()
  return <svg className="av2" width="16" height="16" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#5B8AF7" /></linearGradient></defs><circle cx="16" cy="16" r="16" fill={`url(#${id})`} /><path d="M8 19.5l4-6 3 4 3.4-8 5.6 9.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function Avatar({ url, size = 16 }: { url?: string; size?: number }) {
  const { preview } = useContext(InsightDataContext)
  const safe = preview ? url : insightMediaUrl(url)
  return safe ? <img className="av2" src={safe} alt="" width={size} height={size} /> : null
}
function Metadata({ article, avatar = false }: { article: InsightPresentationArticle; avatar?: boolean }) {
  const { preview } = useContext(InsightDataContext)
  const published = date(article)
  return <span className="nfz-au">{avatar && <Avatar url={article.authorAvatarUrl} />}<span className="nm3">{article.authorName ?? '—'}, {published ? <time title={preview ? '클라이언트 원본 예시의 고정 기준시각' : undefined} dateTime={published}>{published.slice(0, 10).replaceAll('-', '.')}</time> : '—'}</span></span>
}
function SectionBody({ sections }: { sections: InsightSection[] }) {
  const { data, preview } = useContext(InsightDataContext)
  return <>{sections.map((section, index) => {
    const raw = section.fig ? data.figureUrls?.[section.fig.t] : undefined
    const figure = preview ? raw : insightMediaUrl(raw)
    return <Fragment key={index}>{section.h ? <><h2>{section.h}</h2>{section.ps.map((p, i) => <p key={i}>{plain(p)}</p>)}</> : section.q ? <blockquote className="nfz-q">{section.q}</blockquote> : section.fig ? <figure className="nfz-fig"><div className="nfz-art">{figure && <img src={figure} alt={section.fig.cap} width={800} height={356} loading="lazy" />}</div><figcaption className="cap">{section.fig.cap}</figcaption></figure> : null}</Fragment>
  })}</>
}
function guestSections(article: InsightPresentationArticle) {
  const visible: InsightSection[] = []
  let headings = 0
  for (const section of article.body) {
    if (section.h) { headings++; if (headings > 2) break }
    else if (headings >= 2) break
    visible.push(section)
  }
  return visible
}

function ShareIcon({ network }: { network: 'facebook' | 'x' | 'linkedin' | 'copy' }) {
  const paths = {
    facebook: 'M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.3v3.2h2.8V21h3.4z',
    x: 'M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.7 3H8l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.1 4.7H5.2l11.5 14.4z',
    linkedin: 'M6.9 21H3.3V8.7h3.6V21zM5.1 7.1a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM21 21h-3.6v-6c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9.5V8.7H13v1.7h.1c.5-.9 1.7-1.9 3.4-1.9 3.7 0 4.4 2.4 4.4 5.6V21z',
  }
  return network === 'copy' ? <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg> : <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={paths[network]} /></svg>
}

function AssetQuestion({ asset, article, onAsk, onClose }: { asset: string[]; article: InsightPresentationArticle; onAsk: ClientInsightsProps['onAsk']; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const backdropDown = useRef(false)
  const busyRef = useRef(false)
  const alive = useRef(true)
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const id = useId()
  const openedAt = useRef(window.location.href)
  const closeOnNavigation = useEffectEvent(() => {
    if (window.location.href !== openedAt.current) onClose()
  })
  useEffect(() => {
    alive.current = true
    const dialog = ref.current!
    const trigger = document.activeElement as HTMLElement | null
    const origin = openedAt.current
    dialog.showModal(); input.current?.focus()
    // Public pages keep the conversation mounted but hidden. A native modal must
    // leave the top layer on navigation, or it makes that new page inert.
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('hashchange', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    return () => {
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('hashchange', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
      alive.current = false; dialog.close()
      if (trigger?.isConnected && window.location.href === origin && !getSitePage() && !trigger.closest('[hidden],[inert]')) trigger.focus({ preventScroll: true })
    }
  }, [])
  const submit = async () => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError('')
    const text = `${asset[1]}(${asset[0]})의 현재 시장 상태를 분석해줘. 최근 가격 흐름, 주요 뉴스, 변동성, 핵심 기술적 구간과, 방금 읽은 인사이트 "${article.title}" 내용과의 관련성을 함께 설명해줘.${extra.trim() ? ` 추가로 궁금한 점: ${extra.trim()}` : ''}`
    try { await onAsk(text); if (alive.current) onClose() }
    catch (failure) { if (alive.current) setError(failure instanceof ClientInsightQuestionError ? failure.message : '질문을 전달하지 못했어요. 작성한 내용은 유지됩니다. 다시 시도해주세요.') }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  return <dialog ref={ref} className="nfz-dialog" aria-labelledby={id} onPointerDown={event => {
    const bounds = event.currentTarget.getBoundingClientRect()
    backdropDown.current = event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
  }} onPointerCancel={() => { backdropDown.current = false }} onClick={event => {
    const startedOutside = backdropDown.current
    backdropDown.current = false
    if (!startedOutside || event.target !== event.currentTarget || busyRef.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }} onCancel={event => { event.preventDefault(); if (!busyRef.current) onClose() }} onKeyDown={event => {
    // Prevent native cancel before it loses the IME composition metadata.
    if (event.key === 'Escape' && (event.nativeEvent.isComposing || event.keyCode === 229)) { event.preventDefault(); event.stopPropagation() }
  }}>
    <header><h2 id={id}>{asset[1]} 더 알아보기</h2><button type="button" onClick={onClose} disabled={busy} aria-label="닫기"><X size={20} /></button></header>
    <form className="nfz-astdlg" onSubmit={event => { event.preventDefault(); void submit() }} aria-busy={busy}>
      <p>TETH에게 추가적으로 궁금한 점이 있습니까?<br /><small>비워두고 진행해도 됩니다. 기본 분석 질문과 함께 전달됩니다.</small></p>
      <label className="insight-sr" htmlFor={`${id}-question`}>추가로 궁금한 점</label><textarea id={`${id}-question`} ref={input} maxLength={2000} value={extra} readOnly={busy} onChange={event => setExtra(event.target.value)} placeholder="예: 최근 급등 구간의 지지선도 같이 봐줘 (선택)" />
      {error && <p role="alert">{error}</p>}<div className="insight-actions"><button type="button" disabled={busy} onClick={onClose}>취소</button><button className="primary" type="submit" disabled={busy}>{busy ? '질문 전달 중…' : 'TETH에게 물어보기'}</button></div>
    </form>
  </dialog>
}

function InsightContent({ onAsk, onClose, onTitleChange, initialSlug, initialTag, controlledLocation, onNavigate, signedIn = false, onLogin, onFeedback, shouldFocus, locationHref }: ClientInsightsProps) {
  const { data, preview } = useContext(InsightDataContext)
  const { language } = useClientPreferences()
  const stateLabels = insightPresentationCopy[language]
  const rows = data.articles
  const trends = rows.filter(article => Number.isFinite(article.trendingRank)).sort((a, b) => b.trendingRank! - a.trendingRank!).slice(0, 5)
  const topicCounts = new Map<string, number>()
  rows.forEach(article => article.tags.forEach(tag => topicCounts.set(tag, (topicCounts.get(tag) ?? 0) + 1)))
  const topics = [...topicCounts.keys()].sort((a, b) => topicCounts.get(b)! - topicCounts.get(a)!).slice(0, 12)
  const media = (url: string | undefined) => preview ? url : insightMediaUrl(url)
  const [location, setLocation] = useState<InsightLocation>(controlledLocation ?? { slug: initialSlug, tag: initialTag })
  const [notice, setNotice] = useState('')
  const [asset, setAsset] = useState<string[] | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyResult, setCopyResult] = useState<{ surface: 'popover' | 'social'; outcome: 'success' | 'failure' } | null>(null)
  const [feedback, setFeedback] = useState<Record<string, 0 | 1 | 2>>({})
  const [feedbackBusy, setFeedbackBusy] = useState(false)
  const [personalBusy, setPersonalBusy] = useState(false)
  const personalLock = useRef(false)
  const feedbackLock = useRef(false)
  const generation = useRef(0)
  const copyRequest = useRef(0)
  const shareEpoch = useRef(0)
  const changeShare = useCallback((open: boolean) => {
    shareEpoch.current++
    setShareOpen(open)
    setCopyResult(result => result?.surface === 'popover' ? null : result)
  }, [])
  const share = useRef<HTMLDivElement>(null)
  const shareButton = useRef<HTMLButtonElement>(null)
  const focus = useRef<HTMLHeadingElement>(null)
  const shell = useRef<HTMLElement>(null)
  const previous = useRef<InsightSnapshot | null>(null)
  const snapshots = useRef(new Map<string, InsightSnapshot>())
  const pendingRestore = useRef<InsightSnapshot | null>(null)
  const first = useRef(true)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const article = rows.find(p => p.slug === location.slug)
  const currentPersonal = data.personalized?.find(item => item.token === data.currentPersonalizedToken)
  const emailView = location.slug === 'email'
  const personalRoute = location.slug?.startsWith('p/') || emailView
  const personal = emailView ? currentPersonal : data.personalized?.find(item => `p/${item.token}` === location.slug)
  const personalArticle = personal ? { ...personal.article, slug: `p/${personal.token}` } : undefined
  const shareUrl = article && (preview ? `${window.location.origin}${window.location.pathname}#/insight/${encodeURIComponent(article.slug)}` : insightShareUrl(article.shareUrl))
  useEffect(() => {
    if (!controlledLocation || (controlledLocation.slug === location.slug && controlledLocation.tag === location.tag)) return
    pendingRestore.current = snapshots.current.get(locationKey(controlledLocation)) ?? null
    generation.current++; clearTimeout(copyTimer.current)
    // Parent history navigation must dismiss transient article UI while preserving
    // list focus/scroll and confirmed feedback. Equal routes deliberately do nothing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAsset(null); setShareOpen(false); setCopyResult(null); setNotice('')
    setLocation(controlledLocation)
  }, [controlledLocation, location.slug, location.tag])
  useEffect(() => { onTitleChange?.(article?.title ?? (signedIn ? personal?.article.title : undefined) ?? '인사이트') }, [article, personal, signedIn, onTitleChange])
  useEffect(() => () => { generation.current++; clearTimeout(copyTimer.current) }, [])
  useEffect(() => {
    if (!shareOpen) return
    const off = (event: PointerEvent) => { if (!share.current?.contains(event.target as Node)) changeShare(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
      const surface = share.current
      if (!surface || surface.closest('[inert],[hidden]') || !surface.getClientRects().length) return
      // Capture before the sidebar listener, but defer to a foreground modal.
      if (document.querySelector('dialog:modal')) return
      event.preventDefault(); event.stopPropagation()
      changeShare(false); shareButton.current?.focus()
    }
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', escape, true) }
  }, [shareOpen, changeShare])
  useLayoutEffect(() => {
    if (first.current) { first.current = false; if (shouldFocus?.()) focus.current?.focus({ preventScroll: true }); return }
    if (pendingRestore.current) {
      const saved = pendingRestore.current
      pendingRestore.current = null
      const target = saved.selector ? shell.current?.querySelector<HTMLElement>(saved.selector) : null
      target?.focus({ preventScroll: true })
      const container = clientResearchScrollport(shell.current?.closest<HTMLElement>('#research-main,.client-source-app.has-site-footer') ?? null)
      if (container) container.scrollTop = saved.scroll
      else window.scrollTo({ top: saved.scroll, behavior: 'instant' })
    } else { focus.current?.focus({ preventScroll: true }); shell.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }
  }, [location, shouldFocus])
  const move = (next: InsightLocation, remember = true, trigger?: HTMLElement) => {
    if (remember && next.slug) {
      const origin = trigger ?? document.activeElement as HTMLElement
      const kind = ['nfz-card', 'nfz-nc', 't'].find(name => origin.classList.contains(name))
      const saved: InsightSnapshot = { location, scroll: clientResearchScrollport(shell.current?.closest<HTMLElement>('#research-main,.client-source-app.has-site-footer') ?? null)?.scrollTop ?? window.scrollY, selector: kind && origin.dataset.article ? `.${kind}[data-article="${CSS.escape(origin.dataset.article)}"]` : undefined }
      snapshots.current.set(locationKey(location), saved)
      if (snapshots.current.size > 32) snapshots.current.delete(snapshots.current.keys().next().value!)
      if (!location.slug) previous.current = saved
    }
    generation.current++; clearTimeout(copyTimer.current); setAsset(null); setShareOpen(false); setCopyResult(null); setNotice(''); setLocation(next); onNavigate?.(next)
  }
  const back = () => { pendingRestore.current = previous.current; move(previous.current?.location ?? {}, false) }
  const login = (mode: 'login' | 'signup') => { if (onLogin) onLogin(mode); else setNotice('로그인 연결을 준비 중이에요. 읽고 있던 인사이트는 그대로 유지됩니다.') }
  const askPersonal = async () => {
    if (!personal || personal.state !== 'available' || personalLock.current || !signedIn) return
    personalLock.current = true; setPersonalBusy(true); setNotice('')
    const current = generation.current
    try { await onAsk(personal.question) }
    catch (failure) { if (generation.current === current) setNotice(failure instanceof ClientInsightQuestionError ? failure.message : '질문을 전달하지 못했어요. 다시 시도해주세요.') }
    finally { personalLock.current = false; setPersonalBusy(false) }
  }
  const copy = async (surface: 'popover' | 'social') => {
    if (!shareUrl) return
    const current = generation.current
    const request = ++copyRequest.current
    const epoch = shareEpoch.current
    clearTimeout(copyTimer.current); setCopyResult(null)
    const copied = await copyInsightLink(shareUrl, () => current === generation.current && request === copyRequest.current)
    const outcome = copied ? 'success' : 'failure'
    if (current !== generation.current || request !== copyRequest.current) return
    // Source: successful menu copy replaces only its label; errors always use
    // the social status and never dismiss the menu. Clipboard authority is unchanged.
    const resultSurface = outcome === 'failure' ? 'social' : surface
    if (resultSurface === 'popover' && epoch !== shareEpoch.current) return
    setCopyResult({ surface: resultSurface, outcome })
    copyTimer.current = setTimeout(() => {
      if (current !== generation.current || request !== copyRequest.current) return
      if (resultSurface === 'popover' && epoch !== shareEpoch.current) return
      setCopyResult(null)
      if (resultSurface === 'popover') {
        const ownsFocus = share.current?.querySelector('.nfz-shpop')?.contains(document.activeElement)
        changeShare(false)
        if (ownsFocus) shareButton.current?.focus({ preventScroll: true })
      }
    }, outcome === 'failure' ? 2000 : resultSurface === 'popover' ? 1400 : 1600)
  }
  const vote = async (value: 0 | 1 | 2) => {
    if (!article || feedbackLock.current || feedback[article.slug] !== undefined) return
    if (!onFeedback) { setNotice('의견을 보내는 기능을 준비 중이에요. 아직 전송되지 않았습니다.'); return }
    const current = generation.current, slug = article.slug
    feedbackLock.current = true; setFeedbackBusy(true); setNotice('')
    try { await onFeedback(slug, value); if (current === generation.current) setFeedback(old => ({ ...old, [slug]: value })) }
    catch { if (current === generation.current) setNotice('의견을 보내지 못했어요. 다시 시도해주세요.') }
    finally { feedbackLock.current = false; setFeedbackBusy(false) }
  }
  const articleLink = (p: InsightPresentationArticle, content: ReactNode, className: string) => {
    const href = locationHref?.({ slug: p.slug }) ?? (preview ? clientInsightHash({ slug: p.slug }) : undefined)
    // Without a caller-owned service route this is local UI navigation, not a
    // public preview URL or the publisher's external canonical share address.
    return <a className={className} href={href} role={href ? undefined : 'button'} tabIndex={href ? undefined : 0} data-article={p.slug} onKeyDown={event => {
      if (href || !['Enter', ' '].includes(event.key) || event.repeat || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault(); move({ slug: p.slug }, true, event.currentTarget)
    }} onClick={event => {
      // Preserve browser new-tab/window actions only when an actual route exists.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault(); move({ slug: p.slug }, true, event.currentTarget)
    }}>{content}</a>
  }
  const card = (p: InsightPresentationArticle, big = false) => articleLink(p, <><Art article={p} hero={big} /><div className="mt"><Metadata article={p} avatar /></div><h4>{p.title}</h4><div className="sm">{p.sub}</div></>, `nfz-card${big ? ' nfz-bigc' : ''}`)
  const rail = (withTopics = true) => <aside className="nfz-rail" aria-label="인사이트 탐색">{withTopics && <div className="nfz-topics"><div className="th5">{insightSourceCopy(language, 'topics')}</div><div className="tw">{topics.map(tag => <button key={tag} className={`tp${tag === location.tag ? ' on' : ''}`} aria-pressed={tag === location.tag} type="button" onClick={() => move({ tag })}><span>{insightTagLabel(language, tag)}</span></button>)}</div></div>}<h2 className="rh">{insightSourceCopy(language, 'popular')}</h2>{trends.filter(p => p.slug !== article?.slug).map(p => <div className="nfz-tr" key={p.slug}><div className="by"><Metadata article={p} /></div>{articleLink(p, p.title, 't')}</div>)}</aside>
  const shareLinks = (labels = false) => {
    const url = encodeURIComponent(shareUrl ?? '')
    const copyButton = <button type="button" disabled={!shareUrl} title={!shareUrl ? stateLabels.shareUnavailable : undefined} onClick={() => void copy(labels ? 'popover' : 'social')} aria-label="링크 복사"><ShareIcon network="copy" />{labels && <span style={copyResult?.surface === 'popover' ? { color: 'var(--gg)' } : undefined}>{copyResult?.surface === 'popover' ? '복사했습니다!' : '링크 복사'}</span>}</button>
    return <>{labels && copyButton}{(['facebook', 'x', 'linkedin'] as const).map(net => !shareUrl ? <button key={net} type="button" disabled title={stateLabels.shareUnavailable} aria-label={`${net === 'facebook' ? '페이스북' : net === 'x' ? 'X' : 'LinkedIn'}에 공유`}><ShareIcon network={net} />{labels && <span>{net === 'facebook' ? '페이스북에 공유하기' : net === 'x' ? 'X에 공유하기' : 'LinkedIn에 공유하기'}</span>}</button> : <a key={net} aria-label={`${net === 'facebook' ? '페이스북' : net === 'x' ? 'X' : 'LinkedIn'}에 공유`} target="_blank" rel="noopener noreferrer" href={net === 'facebook' ? `https://www.facebook.com/sharer/sharer.php?u=${url}` : net === 'x' ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(article!.title)}&url=${url}` : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`}><ShareIcon network={net} />{labels && <span>{net === 'facebook' ? '페이스북에 공유하기' : net === 'x' ? 'X에 공유하기' : 'LinkedIn에 공유하기'}</span>}</a>)}{!labels && copyButton}</>
  }
  const filtered = location.tag ? rows.filter(p => p.tags.includes(location.tag!)) : rows
  const head = rows.find(p => p.placement === 'featured')
  const top = rows.filter(p => p.placement === 'secondary').slice(0, 2)
  const rest = rows.filter(p => p !== head && !top.includes(p))
  const personalCard = signedIn && currentPersonal?.state === 'available' ? { ...currentPersonal.article, slug: `p/${currentPersonal.token}` } : null
  return <section ref={shell} className="client-insights" aria-label="인사이트" data-source={preview ? CLIENT_INSIGHT_SOURCE.kind : 'SUPPLIED'}>
    <div className="nfz-page">
      {notice && <p className="insight-notice" role="status">{notice}<button type="button" aria-label="안내 닫기" onClick={() => setNotice('')}><X size={16} /></button></p>}
      {personalRoute ? <>
        <button type="button" className="nfz-back" onClick={back}><ArrowLeft size={16} /> 인사이트</button>
        {!signedIn ? <div className="insight-empty"><h1 ref={focus} tabIndex={-1}>{emailView ? '이메일 미리보기는 로그인 후 볼 수 있습니다' : '개인화 인사이트는 로그인 후 볼 수 있습니다'}</h1><button type="button" onClick={() => login('login')}>로그인</button></div>
          : !personal || !personalArticle ? <div className="insight-empty"><h1 ref={focus} tabIndex={-1}>{emailView ? '생성된 맞춤 인사이트가 없습니다' : '글을 찾을 수 없어요'}</h1><button type="button" onClick={() => move({})}>인사이트 홈으로</button></div>
          : personal.state !== 'available' ? <div className="nfz-det"><article className="nfz-a"><h1 ref={focus} tabIndex={-1}>{personal.state === 'expired' ? '이 인사이트는 만료됐습니다' : '이 인사이트는 새 버전으로 갱신됐습니다'}</h1>{personal.availabilityMessage && <div className="deck">{personal.availabilityMessage}</div>}<button type="button" className="nfz-pcta" onClick={() => move(personal.latestToken && data.personalized?.some(item => item.token === personal.latestToken && item.state === 'available') ? { slug: `p/${personal.latestToken}` } : {})}>{personal.latestToken && data.personalized?.some(item => item.token === personal.latestToken && item.state === 'available') ? (preview ? '최신 인사이트 다시 생성' : stateLabels.latestInsight) : '인사이트 홈으로'}</button></article></div>
          : emailView ? personal.email ? <div className="nfz-mail"><div className="mh">보낸사람 <b>{personal.email.senderLabel}</b><br />제목 <b>{personalArticle.title}</b></div><div className="mb2"><span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '.09em', color: '#c7d2fe' }}>FOR YOU</span><h1 ref={focus} tabIndex={-1} style={{ fontSize: 22, lineHeight: '30px' }}>{personalArticle.title}</h1><div style={{ fontSize: 14, lineHeight: '22px', color: 'var(--gt2)', marginBottom: 16 }}>{personalArticle.sub}</div><Art article={personalArticle} showCategory={false} aspectRatio="2.1" /><div className="nfz-body"><SectionBody sections={personal.email.sections} /></div></div><div className="nfz-mailgate"><div className="fd" /><button type="button" className="nfz-pcta" style={{ width: 280, maxWidth: '100%', height: 44, borderRadius: 22, padding: 0, marginTop: 0, position: 'relative', bottom: 'auto', display: 'inline-block' }} onClick={() => move({ slug: `p/${personal.token}` })}>TETH에서 계속 읽기</button><p style={{ fontSize: '11.5px', color: 'var(--gt3)', marginTop: 12 }}>버튼을 누르면 웹 인사이트로 이동합니다.</p></div></div>
            : <div className="insight-empty"><h1 ref={focus} tabIndex={-1}>{stateLabels.emailUnavailable}</h1><button type="button" onClick={() => move({ slug: `p/${personal.token}` })}>TETH에서 계속 읽기</button></div>
          : <div className="nfz-det"><article className="nfz-a"><div style={{ margin: '2px 0 10px' }}><span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '.09em', color: '#c7d2fe', background: 'rgba(99,102,241,.2)', border: '1px solid rgba(129,140,248,.35)', borderRadius: 6, padding: '5px 9px' }}>FOR YOU</span></div><h1 ref={focus} tabIndex={-1}>{personalArticle.title}</h1><div className="deck">{personalArticle.sub}</div><div className="nfz-meta"><span>{personal.chips.join(', ')}</span><span className="sp" />{personal.expiryLabel && <span>{personal.expiryLabel}</span>}</div><div className="nfz-hero"><Art article={personalArticle} hero showCategory={false} /></div><div className="nfz-body"><SectionBody sections={personalArticle.body} /></div><div className="nfz-pcta-wrap"><button type="button" className="nfz-pcta" disabled={personalBusy} aria-busy={personalBusy} onClick={() => void askPersonal()}>{personalBusy ? '질문 전달 중…' : <span>{personal.ctaLabel} →</span>}</button></div></article>{rail(false)}</div>}
      </> : location.slug && !article ? <div className="insight-empty"><h1 ref={focus} tabIndex={-1}>글을 찾을 수 없습니다</h1><button type="button" onClick={() => move({})}>인사이트 전체 보기</button></div> : article ? <>
        <button type="button" className="nfz-back" onClick={back}><ArrowLeft size={16} /> 인사이트</button>
        <div className="nfz-det"><article className="nfz-a"><h1 ref={focus} tabIndex={-1}>{article.title}</h1><div className="deck">{article.sub}</div>
          <div className="nfz-meta"><Metadata article={article} avatar /><span className="sp" /><div className="nfz-shwrap" ref={share}><button className="ib" type="button" aria-label="공유" ref={shareButton} aria-expanded={shareOpen} onClick={() => changeShare(!shareOpen)}><Share2 size={15} /></button>{shareOpen && <div className="nfz-shpop" aria-label="공유 선택">{shareLinks(true)}<span className="insight-sr" role="status">{copyResult?.surface === 'popover' ? '복사했습니다!' : ''}</span></div>}</div></div>
          <div className="nfz-hero"><Art article={article} hero /></div><div className="nfz-body"><SectionBody sections={signedIn ? article.body : guestSections(article)} /></div>
          {!signedIn && <div className="nfz-gatewrap"><div className="nfz-fade" /><div className="nfz-gate"><span className="hl">TETH에서 계속 읽어보십시오</span><div className="s2">무료 계정을 만들면 모든 인사이트와<br />개인화된 시장 분석을 끝까지 읽을 수 있습니다.</div><button type="button" className="b1" onClick={() => login('signup')}>무료로 시작하기</button><div className="fr">영원히 무료, 카드 등록 필요없음</div><div className="lg">이미 계정이 있으십니까? <button type="button" onClick={() => login('login')}>로그인</button></div></div></div>}
          <div className="nfz-tags">{article.tags.map(tag => <button className="tg" key={tag} type="button" onClick={() => move({ tag })}>{insightTagLabel(language, tag)}</button>)}</div>
          <div className="nfz-social">{shareLinks()}<span className="cplbl" role="status" style={copyResult?.outcome === 'failure' ? { color: 'var(--gr)' } : undefined}>{copyResult?.surface === 'social' ? copyResult.outcome === 'success' ? '복사했습니다!' : '복사에 실패했습니다' : ''}</span></div>
          {article.assets.length > 0 && <div className="nfz-assets"><h2 className="ah">이 인사이트에 나온 자산, 지금은 어떤 상황입니까?</h2><div className="as">누르면 TETH에게 물어볼 내용을 정리해드립니다.</div><div className="nfz-astrow">{article.assets.map(a => <button className="nfz-ast" key={a[0]} type="button" onClick={() => signedIn ? setAsset(a) : login('login')}><span className="ico">{media(data.assetUrls?.[a[0]]) ? <img alt="" src={media(data.assetUrls?.[a[0]])} width={34} height={34} /> : a[0].slice(0, 2)}</span><span><span className="nm">{a[1]}</span><span className="sy">{a[0]}</span></span><ChevronRight className="ar2" size={16} /></button>)}</div></div>}
          {signedIn && <div className="nfz-fb"><div className="q">이 인사이트가 도움이 되었습니까?</div><div className={`bs${feedback[article.slug] !== undefined ? ' locked' : ''}`} aria-busy={feedbackBusy}>{feedbackChoices.map(({ key, Icon }, i) => <button className={`nfz-fbb${feedback[article.slug] === i ? ' on' : ''}`} key={key} type="button" aria-pressed={feedback[article.slug] === i} disabled={feedbackBusy || feedback[article.slug] !== undefined} onClick={() => void vote(i as 0 | 1 | 2)}><Icon size={16} strokeWidth={1.6} aria-hidden="true" />{insightSourceCopy(language, key)}</button>)}</div>{feedback[article.slug] !== undefined && <p className="fbok" role="status"><Check size={14} /> 소중한 의견 감사합니다.</p>}</div>}
          <div className="nfz-next"><h2 className="nh">다음 인사이트도 읽어보십시오</h2><div className="nfz-nextg">{rows.filter(p => p.slug !== article.slug).slice(0, 4).map(p => <Fragment key={p.slug}>{articleLink(p, <><Art article={p} /><div className="mt"><Metadata article={p} /></div><div className="t">{p.title}</div></>, 'nfz-nc')}</Fragment>)}</div></div>
          <p className="insight-disclaimer">투자 판단의 최종 책임은 이용자에게 있습니다.</p>
        </article>{rail(false)}</div>
      </> : <><div className="nfz-open"><h1 ref={focus} tabIndex={-1}>{preview && data === previewData ? `${new Intl.DateTimeFormat(language, { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(sourceTime)}, ${insightSourceCopy(language, 'heading')}` : data.heading}<br /><em>{preview && data === previewData ? insightSourceCopy(language, 'subheading') : data.subheading}</em></h1></div>
        {location.tag ? <div className="nfz-cols"><div><div className="nfz-sh"><h2>태그: {insightTagLabel(language, location.tag)}</h2><div className="s">{filtered.length}개의 인사이트 • <button type="button" onClick={() => move({})}>전체 보기</button></div></div>{filtered.length ? <div className="nfz-t1">{filtered.map(p => <Fragment key={p.slug}>{card(p)}</Fragment>)}</div> : <div className="insight-empty"><h2>이 태그의 인사이트가 아직 없습니다</h2><p>다른 태그를 눌러보거나 전체 목록으로 돌아가십시오.</p></div>}</div>{rail()}</div> : <>
          <ClientInsightGallery secondary={top.map(p => <Fragment key={p.slug}>{card(p)}</Fragment>)} featured={head && card(head, true)} rail={rail()}
            curator={data.curators?.length ? <div className="nfz-cur"><span className="avs">{data.curators.map((curator, index) => <Avatar key={index} url={curator.avatarUrl} size={28} />)}</span><span className="tx">{preview && data === previewData ? <>오늘의 인사이트는 <b>Sarah Bennett</b>과 <b>James Carter</b>가 큐레이션했습니다.</> : <>{data.curatorLabel}{data.curatorLabel && ' '}{data.curators.map((curator, index) => <Fragment key={index}>{index > 0 && ', '}<b>{curator.name}</b></Fragment>)}</>}</span></div> : null}
            heading={<div className="nfz-sh"><h2>새로운 인사이트</h2>{data.periodLabel && <div className="s">{data.periodLabel}</div>}</div>}>
            {personalCard && articleLink(personalCard, <><span className="fyl">FOR YOU</span><Art article={personalCard} showCategory={false} /><div className="mt"><span className="nfz-au"><PersonalAvatar /><span className="nm3">맞춤 분석{currentPersonal?.publicationLabel && ` • ${currentPersonal.publicationLabel}`}</span></span></div><h4>{personalCard.title}</h4><div className="sm">{personalCard.sub}</div></>, 'nfz-card nfz-fycard')}
            {rest.map(p => <Fragment key={p.slug}>{card(p)}</Fragment>)}
            {!rows.length && !personalCard && <div className="insight-empty"><h2>{stateLabels.emptyArticles}</h2></div>}
          </ClientInsightGallery>
        </>}{onClose && <button type="button" className="nfz-back insight-return" onClick={onClose}>대화로 돌아가기 <ArrowUpRight size={15} /></button>}</>}
    </div>{article && asset && <AssetQuestion key={`${article.slug}:${asset[0]}`} article={article} asset={asset} onAsk={onAsk} onClose={() => setAsset(null)} />}
  </section>
}

const nativeInsightCopy = {
  ko: { message: '현재 이 환경에는 시장 기사 피드가 연결되어 있지 않습니다. 대화 화면으로 돌아갈 수 있어요.' },
  en: { message: 'A market news feed is not connected in this environment. You can return to the conversation screen.' },
  ja: { message: 'この環境には市場ニュースのフィードが接続されていません。会話画面に戻ることができます。' },
  'zh-CN': { message: '当前环境尚未连接市场新闻源。你可以返回对话界面。' },
  'zh-TW': { message: '目前環境尚未連接市場新聞來源。你可以返回對話畫面。' },
  es: { message: 'Este entorno no tiene conectada una fuente de noticias del mercado. Puedes volver a la pantalla de conversación.' },
  fr: { message: 'Aucun flux d’actualités de marché n’est connecté dans cet environnement. Vous pouvez revenir à l’écran de conversation.' },
} satisfies Record<ClientLanguage, { message: string }>


export function ClientInsights(props: ClientInsightsProps) {
  const { language } = useClientPreferences()
  const preview = props.source !== 'service'
  const data = preview ? (props.data ?? sourcePreviewData()) : props.data
  if (!data) return <ClientInsightUnavailable view={{ ...nativeInsightCopy[language], heading: insightSourceCopy(language, 'heading'), subheading: insightSourceCopy(language, 'subheading'), label: researchNavigationLabel(language, 'insight'), returnLabel: researchCopy(language, 'return') }} onClose={props.onClose ?? (() => {})} shouldFocus={props.shouldFocus ?? (() => false)} />
  return <InsightDataContext.Provider value={{ data, preview }}><InsightContent key={`${preview ? 'preview' : 'service'}:${data.identity}`} {...props} /></InsightDataContext.Provider>
}
