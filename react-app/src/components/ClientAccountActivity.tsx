import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useClientPreferences, type ClientLanguage } from '../client-preferences'
import { shellText } from '../client-shell-copy'
import { accountPlanText } from '../client-account-plan-copy'
import { billingText } from '../client-billing-copy'
import { accountActivityText, type AccountActivityCopyKey } from '../client-account-activity-copy'
import { projectSourceEntitlement, SOURCE_ACCOUNT_CREDIT, type SourceAccountEventState, type SourceNotificationPreferences } from '../client-account-event-state'
import '../client-account-activity.css'
import type { AccountAlertsFilter, AccountAlertsPresentation, AccountPeriodicPresentation, AccountPlanPresentation, AccountPresentationActions, AccountReviewPresentation } from '../client-account-presentation'
import { ClientAccountAlertsPresentation, ClientAccountPeriodicPresentation, ClientAccountPlanPresentation, ClientAccountReviewPresentation } from './ClientAccountPresentation'

// Original NFX_IC paths, rendered as trusted React SVG rather than HTML strings.
const icons = {
link: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>),
trend: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>),
card: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>),
chip: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>),
won: (<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
bell: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>),
warn: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>),
doc: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
star: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
chat: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>),
send: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>),
mail: (<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>),
info: (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>),
zap: (<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
chev: (<svg aria-hidden="true" className="nfx-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>),
empty: (<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>),
lock: (<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
}
type IconName = keyof typeof icons
export type ClientAccountActivityProps = {
  state: SourceAccountEventState | null
  money: (value: number, signed?: boolean) => string
  now: number
  onNavigate: (route: string) => void
  strategyIds?: readonly string[]
}
export type ClientAccountAlertsProps = ClientAccountActivityProps & { onRead?: (id: string) => void | Promise<void>; onReadAll?: () => void | Promise<void>; presentation?: AccountAlertsPresentation; presentationActions?: AccountPresentationActions; filter?: AccountAlertsFilter; onFilterChange?: (filter: AccountAlertsFilter) => void }
export type ClientAccountPlanProps = ClientAccountActivityProps & {
  presentation?: AccountPlanPresentation
  presentationActions?: AccountPresentationActions
  /** Optional source-preview mode; not a service entitlement. */
  previewBillingMode?: 'active' | 'grace' | 'watch'
  headingRef?: RefObject<HTMLHeadingElement | null>
  signedIn: boolean
  tab?: 'plan' | 'rebates' | 'alerts'
  onPreference?: (key: keyof SourceNotificationPreferences, value: boolean) => void
  onUpgrade?: () => void
  onLinkUid?: () => void
}
export type ClientAccountReviewProps = ClientAccountActivityProps & { id: string; strategyNames?: Readonly<Record<string, string>>; presentation?: AccountReviewPresentation; presentationActions?: AccountPresentationActions }
export type ClientAccountPeriodicProps = ClientAccountActivityProps & { id: string; presentation?: AccountPeriodicPresentation; presentationActions?: AccountPresentationActions }
function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={'nfx-badge ' + tone}>{children}</span> }
function Empty({ title, body, icon = 'empty', lang, children }: { title: string; body?: string; icon?: IconName; lang?: string; children?: ReactNode }) { return <div className="nfx-empty" lang={lang}><div className="nfx-eicon">{icons[icon]}</div><div className="nfx-etit">{title}</div>{body && <div className="nfx-edesc">{body}</div>}{children}</div> }
function MissingState() { const { language } = useClientPreferences(); return <Empty lang={language} title={accountPlanText(language, 'unavailable')} /> }
function Row({ icon = 'doc', tone = '', label, description, value, onClick, index = 0 }: { icon?: IconName; tone?: string; label: ReactNode; description?: ReactNode; value?: ReactNode; onClick?: () => void; index?: number }) {
  const content = <><span className="nfx-rl"><span className={'nfx-ric ' + tone}>{icons[icon]}</span><span className="nfx-rtx"><span className="nfx-rlb">{label}</span>{description && <span className="nfx-rds">{description}</span>}</span></span><span className="nfx-rr">{value}{onClick && icons.chev}</span></>
  const className = 'nfx-row nfx-stag s' + Math.min(index + 1, 8) + (onClick ? ' lk' : '')
  return onClick ? <button className={className} onClick={onClick}>{content}</button> : <div className={className}>{content}</div>
}
function Action({ children, onClick, tone = 'out' }: { children: ReactNode; onClick?: () => void; tone?: string }) { return <button className={'nfx-btn ' + tone} onClick={onClick} disabled={!onClick}>{children}</button> }
function Footer({ children }: { children: ReactNode }) { return <div className="nfx-foot">{icons.info}<span>{children}</span></div> }
function createActivityCopy(language: ClientLanguage) {
  const plural = new Intl.PluralRules(language)
  const signedPercent = new Intl.NumberFormat(language, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' })
  const rate = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 })
  const relative = new Intl.RelativeTimeFormat(language, { numeric: 'always' })
  const t = (key: AccountActivityCopyKey, values?: Readonly<Record<string, string>>) => accountActivityText(language, key, values)
  const date = (value: number) => new Date(value).toLocaleDateString(language)
  const number = (value: number) => value.toLocaleString(language)
  return {
    language, t, date, number,
    one: (value: number) => plural.select(value) === 'one',
    // Preserve source toFixed(1) rounding and negative-zero display before localizing.
    percent: (value: number) => signedPercent.format(Number((value * 100).toFixed(1)) / 100),
    rate: (value: number) => rate.format(value / 100),
    periodDate: (p: { from?: number; until: number }) => date(p.from ?? p.until - 1) + ' ~ ' + date(p.until - 1),
    time: (at: number, now: number) => { const d = now - at; return d < 60000 ? t('justNow') : d < 3600000 ? relative.format(-Math.floor(d / 60000), 'minute') : d < 86400000 ? relative.format(-Math.floor(d / 3600000), 'hour') : new Date(at).toLocaleDateString(language, { month: 'numeric', day: 'numeric' }) },
    period: (p: { kind: 'W' | 'M'; label: string }) => p.kind === 'W' && p.label === '주간' ? t('weekly') : p.kind === 'M' && p.label === '월간' ? t('monthly') : p.label,
    kind: (r: { kind: 'sl' | 'tp' | 'time'; kindL: string }) => typeof r.kindL === 'string' && r.kindL === { sl: '손절', tp: '익절', time: '시간 청산' }[r.kind] ? t(({ sl: 'stopLoss', tp: 'takeProfit', time: 'timedExit' } as const)[r.kind]) : r.kindL,
  }
}
// At most seven language entries; no account data or monetary values are cached.
const activityCopyCache = new Map<ClientLanguage, ReturnType<typeof createActivityCopy>>()
function useActivityCopy() {
  const { language } = useClientPreferences()
  let copy = activityCopyCache.get(language)
  if (!copy) { copy = createActivityCopy(language); activityCopyCache.set(language, copy) }
  return copy
}
function Amount({ value, children }: { value: number; children?: ReactNode }) { const { percent } = useActivityCopy(); return <span className={'nfx-rval ' + (value >= 0 ? 'gain' : 'loss')}>{children ?? percent(value)}</span> }
function Frame({ children, page = false }: { children: ReactNode; page?: boolean }) { const { language } = useClientPreferences(); return <div className="client-account-activity" lang={language}>{page ? <div className="nfx-page"><div className="nfx-glow" />{children}</div> : children}</div> }

/** Source tfNFCount: view-only interpolation. The accessibility tree always receives the supplied final value. */
function SourceCount({ value, format }: { value: number; format: (value: number) => string }) {
  const visual = useRef<HTMLSpanElement>(null)
  const formatter = useRef(format)
  const finalText = format(value)
  // A newly allocated callback with the same output must not replay an otherwise unchanged count.
  useEffect(() => { formatter.current = format }, [format])
  // A genuine output change (for example currency selection) does start a fresh view interpolation.
  useEffect(() => {
    const element = visual.current
    if (!element) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, ended = false
    const finish = () => { ended = true; cancelAnimationFrame(frame); element.textContent = finalText }
    const onVisibility = () => { if (document.hidden) finish() }
    const onMotion = () => { if (media.matches) finish() }
    // Source rebates are nonnegative integers. External fractional/negative amounts stay exact,
    // rather than inventing rounded intermediate amounts or briefly losing a negative sign.
    if (media.matches || document.hidden || !Number.isSafeInteger(value) || value < 0) finish()
    else {
      element.textContent = formatter.current(0)
      const start = performance.now()
      const tick = (now: number) => {
        if (ended) return
        const progress = Math.min(Math.max((now - start) / 650, 0), 1)
        // Do not round the supplied final value: non-integral caller amounts remain exact.
        element.textContent = progress === 1 ? finalText : formatter.current(Math.round(value * (1 - Math.pow(1 - progress, 3))))
        if (progress < 1) frame = requestAnimationFrame(tick)
        else ended = true
      }
      frame = requestAnimationFrame(tick)
    }
    document.addEventListener('visibilitychange', onVisibility)
    media.addEventListener('change', onMotion)
    return () => { ended = true; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', onMotion) }
  }, [value, finalText])
  return <span className="account-count"><span className="account-sr">{finalText}</span><span ref={visual} aria-hidden="true">{finalText}</span></span>
}

/** Original 60ms ring reveal, with lifecycle cleanup and no delayed stale report writes. */
function PeriodicRing({ rate, label }: { rate: number; label: string }) {
  const foreground = useRef<SVGCircleElement>(null)
  const offset = 163.4 * (1 - Math.min(100, Math.max(0, rate)) / 100)
  useEffect(() => {
    const element = foreground.current
    if (!element) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let timer = 0
    const finish = () => { clearTimeout(timer); if (document.hidden || media.matches) element.style.transition = 'none'; element.style.strokeDashoffset = String(offset) }
    const onVisibility = () => { if (document.hidden) finish() }
    const onMotion = () => { if (media.matches) finish() }
    if (media.matches || document.hidden) finish()
    else { element.style.transition = ''; element.style.strokeDashoffset = '163.4'; timer = window.setTimeout(finish, 60) }
    document.addEventListener('visibilitychange', onVisibility)
    media.addEventListener('change', onMotion)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); media.removeEventListener('change', onMotion) }
  }, [offset])
  return <div className="nfxr-ring" aria-hidden="true"><svg viewBox="0 0 60 60"><circle className="bg" cx="30" cy="30" r="26" /><circle ref={foreground} className="fg" cx="30" cy="30" r="26" /></svg><span className="val">{label}</span></div>
}

export function ClientAccountAlerts({ state, now, onRead, onReadAll, onNavigate, presentation, presentationActions, filter: suppliedFilter, onFilterChange }: ClientAccountAlertsProps) {
  const { t, number, one, time, language } = useActivityCopy()
  const [localFilter, setLocalFilter] = useState<AccountAlertsFilter>('all')
  const filter = suppliedFilter ?? localFilter
  const setFilter = (next: AccountAlertsFilter) => { setLocalFilter(next); onFilterChange?.(next) }
  if (presentation) return <ClientAccountAlertsPresentation view={presentation} onRead={onRead} onReadAll={onReadAll} onNavigate={presentationActions ? presentationActions.onNavigate : onNavigate} filter={filter} onFilterChange={setFilter} />
  if (!state) return <Frame><MissingState /></Frame>
  const tabs = [['all', 'all'], ['pos', 'position'], ['bot', 'strategy'], ['review', 'review'], ['rebate', 'rebates']] as const
  const inTab = (type: string, key: string) => key === 'all' || type === key || key === 'pos' && type === 'bot'
  const rows = state.notifs.filter(n => inTab(n.type, filter)), unread = state.notifs.filter(n => !n.read).length
  const labels = { credit: 'credits', pos: 'position', bot: 'strategy', review: 'review', rebate: 'rebates', report: 'reports' } as const
  return <Frame>
    <div className="nfx-sechead"><h2 className="nfx-sectit">{t('alerts')} {unread > 0 && <Badge tone="blue">{t(one(unread) ? 'unreadOne' : 'unread', { count: number(unread) })}</Badge>}</h2><div className="account-alert-actions"><button className="nfxu-later" onClick={onReadAll} disabled={!onReadAll}>{t('readAll')}</button><Action onClick={() => onNavigate('#/plan/alerts')}>{t('preferences')}</Action></div></div>
    <div className="nfxh-fchips" role="group" aria-label={t('categories')}>{tabs.map(([key, label]) => { const count = state.notifs.filter(n => inTab(n.type, key)).length; return <button key={key} className={'nfxh-fchip' + (filter === key ? ' on' : '')} aria-label={t(label) + (count > 0 ? ' ' + number(count) : '')} aria-pressed={filter === key} onClick={() => setFilter(key)}>{t(label)}{count > 0 && <span className="c2">{number(count)}</span>}</button> })}</div>
    <div className="nfxh-alerts-list">{rows.length ? rows.map(n => {
      // These are supplied text snippets, not structured financial amounts or an FX source.
      const p = n.title.match(/([+-]\d+(?:\.\d+)?)%/), w = n.title.match(/\+₩([\d,]+)/)
      const move = p ? p[1] + '%' : w ? '+₩' + w[1] : ''
      return <button key={n.id} className={'nf-item' + (n.read ? ' read' : '')} disabled={!onRead} onClick={() => { onRead?.(n.id); if (n.link) onNavigate(n.link) }}><span className="ic" /><span className="account-sr">{t(n.read ? 'read' : 'notRead')} </span><span className="bx"><span className="tt"><span className="account-alert-title"><span className={'tg t-' + n.type}>{n.type === 'bill' ? billingText(language, 'billingTag') : Object.hasOwn(labels, n.type) ? t(labels[n.type]) : n.type}</span>{n.title}</span>{move && <span className={'mv ' + (move.startsWith('+') ? 'up' : 'dn')}>{move}</span>}</span>{n.body && <span className="bd2">{n.body}</span>}<span className="tm num">{time(n.at, now)}</span></span></button>
    }) : <Empty icon="bell" title={t(state.notifs.length ? 'noCategory' : 'noAlerts')} body={state.notifs.length ? t(one(state.notifs.length) ? 'otherAlertOne' : 'otherAlerts', { count: number(state.notifs.length) }) : t('alertsEmptyDescription')} />}</div>
  </Frame>
}
export function ClientAccountReports({ state, onNavigate }: ClientAccountActivityProps) {
  const { t, period, periodDate, one, number, rate } = useActivityCopy()
  return <Frame>{!state ? <MissingState /> : !state.periodics.length ? <Empty icon="doc" title={t('noReports')} body={t('reportsEmptyDescription')} /> : <div className="nfx-rows">{state.periodics.map((p, i) => <Row key={p.id} index={i} tone={p.pnl >= 0 ? 'gg' : 'gr'} label={t('performanceReport', { period: period(p) })} description={t(one(p.n) ? 'reportSummaryOne' : 'reportSummary', { range: periodDate(p), count: number(p.n), winRate: rate(p.n ? Math.round(p.wins / p.n * 100) : 0) })} value={<Amount value={p.pnl} />} onClick={() => onNavigate('#/periodic/' + p.id)} />)}</div>}</Frame>
}
export function ClientAccountRebateSummary({ state, money, onNavigate }: ClientAccountActivityProps) {
  const { t, language, one, number } = useActivityCopy()
  return <Frame>{!state ? <MissingState /> : <><div className="tft-tnote">{t('rebateScope')}</div><div className="tft-assets"><div className="tft-asx num"><div className="ah2"><b>{t('feeRebate')}</b></div><div className="ag2" role="region" aria-label={accountPlanText(language, 'rebateAmount')} tabIndex={0}><span><small>{accountPlanText(language, 'rebateTotal')}</small><b className="up">{money(state.rebates.reduce((a, r) => a + r.amt, 0))}</b></span><span><small>{accountPlanText(language, 'rebateCount')}</small><b>{accountPlanText(language, one(state.rebates.length) ? 'recordCountOne' : 'recordCount', { count: number(state.rebates.length) })}</b></span></div><div className="af2">{accountPlanText(language, 'rebateRateValue')}, <button className="account-link" onClick={() => onNavigate('#/plan/rebates')}>{t('allHistory')}</button></div></div></div></>}</Frame>
}

// Qualitative display: source bf4378e. Entitlement remains the original source projection.
function PlanStatus({ state, signedIn, now, onUpgrade, onLinkUid, previewBillingMode }: ClientAccountPlanProps & { state: SourceAccountEventState }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof accountPlanText>[1], values?: Readonly<Record<string, string>>) => accountPlanText(language, key, values)
  const number = (value: number) => value.toLocaleString(language)
  const planDate = (value: number) => new Date(value).toLocaleDateString(language)
  const e = projectSourceEntitlement(state, signedIn, now), C = SOURCE_ACCOUNT_CREDIT
  if (e.kind !== 'ready') {
    // These are local preview diagnostics, never arbitrary server error translations.
    const key = e.reason === accountPlanText('ko', 'invalidSource') ? 'invalidSource' : e.reason === accountPlanText('ko', 'invalidValues') ? 'invalidValues' : null
    return <Empty lang={key ? language : 'ko'} title={key ? t('planUnavailable') : accountPlanText('ko', 'planUnavailable')} body={key ? t(key) : e.reason} />
  }
  if (e.why === 'guest') return <Empty lang={language} title={t('basic')} body={t('guestDescription')} />
  const freeLeft = e.freeLeft ?? 0
  const freeLow = freeLeft <= 2 // Source display threshold, not a new entitlement rule.
  const status = e.why === 'paid' ? { badge: t('membership'), tone: 'blue', value: 'PRO', unit: t('unlimited'), color: 'cb', gauge: 'inf', left: t('memberActive'), right: t('unlimitedUse'), description: t('paidDescription') }
    : e.why === 'trade' ? { badge: t('tradeBadge'), tone: 'pro', value: t('unlimited'), unit: '', color: 'cg', gauge: 'inf', left: t('tradeActive'), right: t('expires', { date: planDate(state.tradeActiveUntil!) }), description: t('tradeDescription', { days: number(C.activityDays) }) }
      : e.why === 'credit' ? { badge: 'PRO', tone: 'pro', value: 'PRO', unit: t('inUse'), color: 'cg', gauge: 'inf', left: t('normal'), right: t('volumeRecharge'), description: t('creditDescription') }
        : e.why === 'free' ? { badge: t('freeTrial'), tone: 'blue', value: t(freeLow ? 'freeLow' : 'freeValue'), unit: freeLow ? '' : t('trialInUse'), color: freeLow ? 'cw' : 'cb', gauge: freeLow ? 'warn' : 'inf', left: t('freeStatus'), right: t('uidAlwaysFree'), description: t('freeDescription') }
          : { badge: t('upgradeRequired'), tone: 'danger', value: t('spentValue'), unit: '', color: 'cx', gauge: 'empty', left: t('trialExhausted'), right: t('continueLinkOrSubscribe'), description: t('exhaustedDescription') }
  const tradeActive = state.uidLinked && state.tradeActiveUntil !== null && now < state.tradeActiveUntil
  if (previewBillingMode === 'watch') {
    status.badge = billingText(language, 'standby')
    status.tone = 'warn'
    status.value = billingText(language, 'standbyValue')
    status.unit = ''
    status.description = billingText(language, 'standbyDescription')
  }
  return <div className="nfx-grid2" lang={language}>
    <section className="nfx-card nfx-card-hero nfx-glowonce">
      <div className="nfx-chead"><span className="nfx-ctitle">{t('level')}</span><Badge tone={status.tone}><span className={'nfx-dot' + (e.tier === 'high' ? ' pulse' : '')} />{status.badge}</Badge></div>
      <div><div className="nfx-hero-label">{t('usageStatus')}</div>
        <div className={'nfx-hero ' + status.color}><span>{status.value}</span>{status.unit && <span className="nfx-hero-sub">{' '}{status.unit}</span>}</div>
        <div className="nfx-hero-desc">{status.description}</div>
      </div>
      <div className="nfx-gauge"><div className="nfx-gtrack"><div className={'nfx-gfill ' + status.gauge} style={{ width: '100%' }} /></div><div className="nfx-glabels"><span>{status.left}</span><span>{status.right}</span></div></div>
      <div className="nfx-cta">{(e.why === 'free' || e.why === 'free-out') && <Action tone="pri" onClick={onLinkUid}>{icons.zap}{t('linkFree')}</Action>}{e.why !== 'paid' && <Action tone={e.why === 'credit' ? 'pri' : e.why === 'trade' ? 'sec' : 'out'} onClick={onUpgrade}>{t('upgrade')}</Action>}</div>
      <Footer>{t('previewFooter', { version: String(C.version) })}</Footer>
    </section>
    <section className="nfx-card"><div className="nfx-sechead"><h2 className="nfx-sectit">{t('details')}</h2></div><div className="nfx-rows">
      <Row icon="link" tone={state.uidLinked ? 'gg' : ''} label={t('uidLink')} description={t('partnerAccount')} value={<Badge tone={state.uidLinked ? 'pro' : ''}>{t(state.uidLinked ? 'linkedFree' : 'unlinked')}</Badge>} />
      <Row index={1} icon="trend" tone={tradeActive ? 'gg' : ''} label={t('partnerActivity')} description={t('activityDescription', { days: number(C.activityDays) })} value={<Badge tone={tradeActive ? 'pro' : ''}>{tradeActive ? t('activeUntil', { date: planDate(state.tradeActiveUntil!) }) : t('none')}</Badge>} />
      <Row index={2} icon="card" tone={state.payDone ? 'gb' : ''} label={t('subscription')} description={t('monthlyPlan')} value={<Badge tone={state.payDone ? 'blue' : ''}>{t(state.payDone ? 'subscribed' : 'none')}</Badge>} />
      <Row index={3} icon="chip" tone="gb" label={t('responseCost')} description={t('responseUsage')} value={<span className="nfx-rval nfx-text-value">{t(e.tier === 'high' && e.bal === null ? 'noDebit' : 'usageDebit')}</span>} />
    </div></section>
  </div>
}

function Rebates({ state, money, onNavigate, strategyIds }: ClientAccountActivityProps & { state: SourceAccountEventState }) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof accountPlanText>[1], values?: Readonly<Record<string, string>>) => accountPlanText(language, key, values)
  const plural = useMemo(() => new Intl.PluralRules(language), [language])
  const [missing, setMissing] = useState<{ fid: string; botId: string; sequence: number } | null>(null)
  const rows = [...state.rebates].sort((a, b) => b.at - a.at).slice(0, 30)
  const missingVisible = missing && rows.some(r => r.fid === missing.fid && r.botId === missing.botId)
    && !state.reviews.some(r => r.fid === missing.fid) && !strategyIds?.includes(missing.botId)
  return <div className="nfx-grid2" lang={language}>
    <section className="nfx-card nfx-card-hero">
      <div className="nfx-chead"><span className="nfx-ctitle">{t('rebateTotal')}<Badge tone="sim">{t('simulation')}</Badge></span></div>
      <div><div className="nfx-hero-label">{t('rebateLabel')}</div>
        <div className="nfx-hero cg"><span className="account-money" role="region" aria-label={t('rebateAmount')} lang={language} tabIndex={0}><SourceCount value={state.rebates.reduce((sum, r) => sum + r.amt, 0)} format={money} /></span></div>
        <div className="nfx-hero-desc">{t('rebateDescription')}</div>
      </div>
      <div className="nfx-metrics">
        <div className="nfx-mbox"><span className="nfx-mtit">{t('rebateCount')}</span><span className="nfx-mval nfx-text-value">{t(plural.select(state.rebates.length) === 'one' ? 'recordCountOne' : 'recordCount', { count: state.rebates.length.toLocaleString(language) })}</span></div>
        <div className="nfx-mbox"><span className="nfx-mtit">{t('rebateRate')}</span><span className="nfx-mval nfx-text-value">{t('rebateRateValue')}</span></div>
      </div>
      <div className="nfx-cta"><Action tone="pri" onClick={() => onNavigate('#/trade')}>{icons.zap}{t('goTrading')}</Action></div>
    </section>
    <section className="nfx-card">
      <div className="nfx-sechead"><h2 className="nfx-sectit">{t('rebateHistory')}</h2><Badge>{rows.length ? t(plural.select(rows.length) === 'one' ? 'recentRecordOne' : 'recentRecords', { count: rows.length.toLocaleString(language) }) : t('noHistory')}</Badge></div>
      {rows.length ? <div className="nfx-rows">{rows.map((r, i) => <Row key={r.fid} index={i} icon="won" tone="gg" label={t('fill', { id: r.fid.split('-').pop() ?? '' })} description={t('fillConfirmed', { date: new Date(r.at).toLocaleDateString(language) })} value={<Amount value={r.amt}>{money(r.amt, true)}</Amount>} onClick={() => {
        const review = state.reviews.find(v => v.fid === r.fid)
        if (review) { setMissing(null); onNavigate('#/review/' + review.id) }
        else if (strategyIds?.includes(r.botId)) { setMissing(null); onNavigate('#/trade/bot/' + r.botId) }
        else setMissing(previous => ({ fid: r.fid, botId: r.botId, sequence: (previous?.sequence ?? 0) + 1 }))
      }} />)}</div> : <Empty title={t('rebateEmpty')} body={t('rebateEmptyDescription')}><Action onClick={() => onNavigate('#/trade')}>{t('goTradingEmpty')}</Action></Empty>}
      <p role="status" aria-atomic="true" className="nfx-inline-status">{missingVisible && <span key={missing.sequence}>{t('reviewExpired')}</span>}</p>
    </section>
  </div>
}
type PlanCopyKey = Parameters<typeof accountPlanText>[1]
const preferenceRows: readonly [keyof SourceNotificationPreferences, PlanCopyKey, PlanCopyKey, IconName, string][] = [
  ['pos', 'positionPreference', 'positionDescription', 'trend', 'gb'], ['loss', 'lossPreference', 'lossDescription', 'warn', 'ga'], ['review', 'reviewPreference', 'reviewDescription', 'doc', 'gb'], ['rebate', 'rebatePreference', 'rebatePreferenceDescription', 'won', 'gg'], ['watch', 'watchPreference', 'watchDescription', 'star', ''],
  ['chW', 'inboxPreference', 'inboxDescription', 'bell', 'gg'], ['chK', 'kakaoPreference', 'channelDescription', 'chat', ''], ['chT', 'telegramPreference', 'channelDescription', 'send', ''], ['chM', 'emailPreference', 'channelDescription', 'mail', ''],
]
function Preferences({ state, onPreference }: Pick<ClientAccountPlanProps, 'onPreference'> & { state: SourceAccountEventState }) {
  const { language } = useClientPreferences()
  const t = (key: PlanCopyKey) => accountPlanText(language, key)
  return <div className="nfx-grid2 nfx-preferences" lang={language}>{[preferenceRows.slice(0, 5), preferenceRows.slice(5)].map((rows, group) => <section className="nfx-card" key={group}>
    <div className="nfx-sechead"><h2 className="nfx-sectit">{t(group ? 'channels' : 'notificationKinds')}</h2><Badge>{t(group ? 'channelCount' : 'kindCount')}</Badge></div>
    <div className="nfx-rows">{rows.map(([key, label, description, icon, tone], i) => <Row key={key} index={i} icon={icon} tone={tone} label={t(label)} description={t(description)} value={<>{key === 'chW' && <Badge tone="pro">{t('defaultChannel')}</Badge>}<label className="nfx-sw"><input type="checkbox" role="switch" aria-label={t(label)} checked={key === 'chW' || state.notifPrefs[key]} disabled={key === 'chW' || !onPreference} onChange={event => onPreference?.(key, event.target.checked)} /><span className={'nfx-slider' + (key === 'chW' ? ' grn' : '')} /></label></>} />)}</div>
    {group === 1 && <Footer>{t('preferenceFooter')}</Footer>}
  </section>)}</div>
}
export function ClientAccountPlan(props: ClientAccountPlanProps) {
  const { headingRef, ...planProps } = props
  const { state, tab = 'plan', onNavigate } = planProps
  const { language } = useClientPreferences()
  if (props.presentation) return <ClientAccountPlanPresentation view={props.presentation} tab={tab} headingRef={headingRef} {...props.presentationActions} onNavigate={onNavigate} />
  return <Frame page><header className="nfx-head"><h1 ref={headingRef} tabIndex={-1} className="nfx-title">{shellText(language, 'planCredits')}</h1><div className="nfx-sub">{accountPlanText(language, 'description')}</div><nav className="nfx-tabs" lang={language} aria-label={accountPlanText(language, 'navigation')}>{(['plan', 'rebates', 'alerts'] as const).map(key => <button key={key} className={'nfx-tab' + (key === tab ? ' on' : '')} aria-current={key === tab ? 'page' : undefined} onClick={() => onNavigate('#/plan' + (key === 'plan' ? '' : '/' + key))}>{accountPlanText(language, key)}</button>)}</nav></header>{!state ? <MissingState /> : tab === 'plan' ? <PlanStatus {...planProps} state={state} /> : tab === 'rebates' ? <Rebates {...planProps} state={state} /> : <Preferences state={state} onPreference={planProps.onPreference} />}</Frame>
}

function Breadcrumb({ title, onNavigate }: { title: string; onNavigate: (route: string) => void }) {
  const { t } = useActivityCopy()
  return <nav className="nfx-bc" aria-label={t('location')}><button className="account-link lk" onClick={() => onNavigate('#/trade')}>{t('myTrading')}</button><span>/</span><span>{title}</span></nav>
}
const reviewSteps: Readonly<Record<string, readonly [string, string, IconName, AccountActivityCopyKey]>> = {
  '진입 근거': ['ENTRY', 'e', 'doc', 'entryReason'], '청산 근거': ['EXIT', 'x', 'trend', 'exitReason'],
  '손실 원인': ['CAUSE', 'r', 'warn', 'lossCause'], '규칙 평가': ['RULE', 'x', 'doc', 'ruleAssessment'], '다음 제안': ['SUGGESTION', 'g', 'star', 'nextSuggestion'],
}
export function ClientAccountReview({ state, id, money, onNavigate, strategyNames, presentation, presentationActions }: ClientAccountReviewProps) {
  const { t, language, period, kind, percent } = useActivityCopy()
  if (presentation) return <ClientAccountReviewPresentation key={presentation.id} view={presentation} {...presentationActions} onNavigate={onNavigate} />
  if (!state) return <Frame page><MissingState /></Frame>
  const r = state.reviews.find(row => row.id === id)
  if (!r) return <Frame page><Empty title={t('reviewMissing')} /><Action onClick={() => onNavigate('#/trade')}>{t('myTrading')}</Action></Frame>
  const pd = state.periodics.find(p => r.at < p.until && r.at >= p.from), rebates = state.rebates.filter(rebate => rebate.fid === r.fid)
  // Only known source UI labels translate; supplied evidence and custom labels remain untouched.
  const kindLabel = kind(r)
  const strategyName = strategyNames && Object.hasOwn(strategyNames, r.botId) ? strategyNames[r.botId] : undefined
  // Exit kind, not the sign of PnL, determines the exit explanation.
  const description = t(r.kind === 'sl' ? 'stopDescription' : r.kind === 'tp' ? 'profitDescription' : 'timeDescription')
  return <Frame page>
    <Breadcrumb title={t('review')} onNavigate={onNavigate} />
    <section className={'nfx-card nfx-card-hero nfxr-hero ' + (r.pnl >= 0 ? 'win' : 'loss')}>
      <div className="nfx-chead"><span className="nfx-ctitle">{t('reviewTitle', { asset: r.asset, kind: kindLabel })}<Badge tone="sim">{accountPlanText(language, 'simulation')}</Badge></span>{pd && <Action onClick={() => onNavigate('#/periodic/' + pd.id)}>{t('toReport', { period: period(pd) })}</Action>}</div>
      <div><div className="nfx-hero-label">{t(r.kind === 'sl' ? 'realizedLoss' : 'realizedRule')}</div><div className={'nfx-hero ' + (r.pnl >= 0 ? 'cg' : 'cr')}>{percent(r.pnl)}</div><div className="nfx-hero-desc">{description}</div></div>
      <div className="nfxr-chiprow"><span className="nfxr-chip">{t('category')} <b>{kindLabel}</b></span>{rebates.length > 0 && <span className="nfxr-chip">{t('feeRebate')} <b className="gain">{money(rebates.reduce((sum, rebate) => sum + rebate.amt, 0), true)}</b></span>}{strategyName && <span className="nfxr-chip">{t('strategy')} <b>{strategyName}</b></span>}</div>
    </section>
    <section className="nfx-card"><div className="nfx-sechead"><h2 className="nfx-sectit">{t('causality')}</h2><Badge>{t('engineSignals')}</Badge></div>
      <div className="nfxr-steps">{r.causes.map(([title, body], i) => {
        const step = Object.hasOwn(reviewSteps, title) ? reviewSteps[title] : undefined
        const [tag, tone, icon] = step ?? ['STEP', '', 'doc']
        return <div className={'nfxr-step nfx-stag s' + Math.min(i + 1, 8)} key={i}><div className={'nfxr-sic ' + tone}>{icons[icon]}</div><div className="account-step-body"><div><span className="nfxr-stag">{'0' + (i + 1)} {tag}</span><span className="nfxr-stit">{step ? t(step[3]) : title}</span></div><div className="nfxr-sbody">{body}</div></div></div>
      })}</div>
    </section>
    <div className="nfx-cta"><Action tone="pri" onClick={() => onNavigate('#/trade/bot/' + r.botId)}>{icons.zap}{t('strategyDetail')}</Action><Action onClick={() => onNavigate('#/trade')}>{t('myTrading')}</Action></div>
  </Frame>
}
export function ClientAccountPeriodic({ state, id, money, onNavigate, presentation, presentationActions }: ClientAccountPeriodicProps) {
  const { t, language, period, periodDate, kind, date, percent, rate, one, number } = useActivityCopy()
  if (presentation) return <ClientAccountPeriodicPresentation key={presentation.id} view={presentation} {...presentationActions} onNavigate={onNavigate} />
  if (!state) return <Frame page><MissingState /></Frame>
  const p = state.periodics.find(row => row.id === id)
  if (!p) return <Frame page><Empty title={t('reportMissing')} /><Action onClick={() => onNavigate('#/trade')}>{t('myTrading')}</Action></Frame>
  const wr = p.n ? Math.round(p.wins / p.n * 100) : 0, rows = state.reviews.filter(r => r.at < p.until && r.at >= p.from).slice(0, 10)
  return <Frame page>
    <Breadcrumb title={t('report', { period: period(p) })} onNavigate={onNavigate} />
    <section className={'nfx-card nfx-card-hero nfxr-hero ' + (p.pnl >= 0 ? 'win' : 'loss')}>
      <div className="nfx-chead"><span className="nfx-ctitle">{t('performanceReport', { period: period(p) })}<Badge tone="sim">{accountPlanText(language, 'simulation')}</Badge></span><Badge>{periodDate(p)}</Badge></div>
      <div><div className="nfx-hero-label">{t('periodPnl')}</div><div className={'nfx-hero ' + (p.pnl >= 0 ? 'cg' : 'cr')}>{percent(p.pnl)}</div></div>
      <div className="nfxr-stats"><PeriodicRing key={p.id + ':' + wr} rate={wr} label={rate(wr)} />{([
        ['fills', t(one(p.n) ? 'fillOne' : 'fillCount', { count: number(p.n) })],
        ['winRate', rate(wr)], ['feeRebate', money(p.rebate, true)],
      ] as const).map(([key, value]) => <div className="nfx-mbox" key={key}><span className="nfx-mtit">{t(key)}</span><span className={'nfx-mval' + (key === 'feeRebate' ? ' gain' : ' nfx-text-value')}>{value}</span></div>)}</div>
    </section>
    <section className="nfx-card"><div className="nfx-sechead"><h2 className="nfx-sectit">{t('periodReviews')}</h2><Badge>{rows.length ? accountPlanText(language, one(rows.length) ? 'recordCountOne' : 'recordCount', { count: number(rows.length) }) : t('none')}</Badge></div>
      {rows.length ? <div className="nfx-rows">{rows.map((r, i) => <Row key={r.id} index={i} tone={r.pnl >= 0 ? 'gg' : 'gr'} label={r.asset + ' ' + kind(r)} description={date(r.at)} value={<Amount value={r.pnl} />} onClick={() => onNavigate('#/review/' + r.id)} />)}</div> : <Empty title={t('noReviews')} body={t('reviewsExpired')} />}
    </section>
    <div className="nfx-cta"><Action tone="pri" onClick={() => onNavigate('#/trade')}>{icons.zap}{t('myTrading')}</Action><Action onClick={() => onNavigate('#/plan/rebates')}>{t('allRebates')}</Action></div>
  </Frame>
}
