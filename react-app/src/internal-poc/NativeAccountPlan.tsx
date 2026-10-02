import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ClientAccountPeriodic, ClientAccountPlan, ClientAccountReview } from '../components/ClientAccountActivity'
import { ClientUserStrategy } from '../components/ClientUserStrategy'
import { readClientAccountLocation, type ClientAccountLocation } from '../client-account-navigation'
import { useClientPreferences } from '../client-preferences'
import { researchCopy } from '../client-research-copy'
import { accountPlanText } from '../client-account-plan-copy'
import { accountActivityText } from '../client-account-activity-copy'
import { shellText } from '../client-shell-copy'
import { accountLocationAvailable, accountPresentationBound, type NativeAccountPresentation } from './native-account-presentation'
import { nativeAccountText } from './native-account-presentation-copy'
import { NativeAccountFields } from './NativeAccountPanels'

/** Owner-bound display adapter. The reusable source UI gets explicit view facts,
 * never SourceAccountEventState or a fabricated simulation/entitlement. */
type Props = { onReturn: () => void; onTrading?: () => void; accountScope?: string | null; presentation?: NativeAccountPresentation; location?: ClientAccountLocation; onNavigate?: (location: ClientAccountLocation) => void }
export function NativeAccountPlan(props: Props) {
  const data = accountPresentationBound(props.presentation, props.accountScope) ? props.presentation : undefined
  return <AccountPlanScope key={JSON.stringify([props.accountScope, data?.identity])} {...props} presentation={data} />
}
function AccountPlanScope({ onReturn, onTrading, presentation: data, location, onNavigate }: Props) {
  const heading = useRef<HTMLHeadingElement>(null), root = useRef<HTMLDivElement>(null)
  const current = useRef(data), alive = useRef(false)
  useLayoutEffect(() => { current.current = data }, [data])
  useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; current.current = undefined } }, [])
  const [tab, setTab] = useState<'plan' | 'rebates' | 'alerts'>('plan')
  const { language } = useClientPreferences()
  const activeTab = location?.kind === 'plan' ? location.tab : tab
  const document = location && location.kind !== 'plan' ? data?.documents?.find(item => item.kind === location.kind && item.id === location.id) : undefined
  const reachable = (target: ClientAccountLocation) => !!onNavigate && accountLocationAvailable(data, target)
  const navigate = (target: ClientAccountLocation) => {
    if (alive.current && current.current === data && reachable(target)) onNavigate?.(target)
  }
  const canRoute = (hash: string) => {
    if (hash === '#/trade') return !!onTrading
    const next = readClientAccountLocation(hash)
    // Only an independent PLAN owns local tab state. A supplied location is
    // controlled by its caller and must not advertise a missing transition.
    return !!next && accountLocationAvailable(data, next)
      && (!!onNavigate || next.kind === 'plan' && location === undefined)
  }
  const route = (hash: string) => {
    if (!alive.current || current.current !== data || !canRoute(hash)) return
    if (hash === '#/trade') { onTrading?.(); return }
    const next = readClientAccountLocation(hash)
    if (!next || !accountLocationAvailable(data, next)) return
    if (next.kind === 'plan') setTab(next.tab)
    onNavigate?.(next)
  }
  // Entry and explicit document navigation, never locale changes, take focus.
  const routeKey = location?.kind === 'plan' ? 'plan' : location ? location.kind + ':' + location.id : 'plan'
  useEffect(() => {
    let active = true
    queueMicrotask(() => { const title = heading.current ?? root.current?.querySelector<HTMLElement>('h1,.nfx-bc'); if (active && title?.isConnected && title.getClientRects().length && !title.closest('[hidden],[inert]')) { title.tabIndex = -1; title.focus({ preventScroll: true }) } })
    return () => { active = false }
  }, [routeKey])
  const unavailable = nativeAccountText(language, 'unavailable')
  const callbacks = { canNavigate: canRoute, onAction: data?.actions?.onDocumentAction && document ? (actionId: string) => data.actions!.onDocumentAction!(document.id, actionId) : undefined }
  const hero = { title: document?.title ?? unavailable, label: unavailable, value: '—' }
  const additional = <div className="nfx-page">{document?.fields.length ? <section className="nfx-card"><NativeAccountFields fields={document.fields} /></section> : null}{document?.sections.map(section => <section className="nfx-card" key={section.id}><h2 className="nfx-sectit">{section.title}</h2>{section.text && <p>{section.text}</p>}{section.fields && <NativeAccountFields fields={section.fields} />}</section>)}<div className="nfx-cta">{document?.links?.map((link, index) => <button type="button" key={index} className="nfx-btn out" disabled={!reachable(link.target)} onClick={() => navigate(link.target)}>{link.label}</button>)}</div></div>
  const common = { state: null, money: String, now: 0, onNavigate: route }
  return <div ref={root} className="client-main-account client-account-activity native-service-plan" data-native-account-document={document?.id}>
    <div className="native-plan-return"><button type="button" className="nfx-btn out" onClick={onReturn}>{researchCopy(language, 'return')}</button></div>
    {location?.kind === 'bot' ? <><ClientUserStrategy record={null} events={null} money={String} onNavigate={route} presentationActions={callbacks} presentation={document?.presentation?.kind === 'bot' ? document.presentation.view : { id: location.id, title: document?.title ?? unavailable, sourceLabel: document?.sourceLabel ?? unavailable, environment: { label: unavailable }, actions: [], score: null, returnMetric: null, drawdownMetric: null, equity: null, orders: null, position: null, execution: null, log: null }} />{additional}</>
      : location?.kind === 'review' ? <><ClientAccountReview {...common} id={location.id} presentationActions={callbacks} presentation={document?.presentation?.kind === 'review' ? document.presentation.view : { id: location.id, hero, sourceLabel: document?.sourceLabel ?? unavailable, chips: [], causes: null, actions: [] }} />{additional}</>
        : location?.kind === 'periodic' ? <><ClientAccountPeriodic {...common} id={location.id} presentationActions={callbacks} presentation={document?.presentation?.kind === 'periodic' ? document.presentation.view : { id: location.id, hero, sourceLabel: document?.sourceLabel ?? unavailable, dateLabel: unavailable, ring: null, metrics: [], reviews: null, actions: [] }} />{additional}</>
          : <><ClientAccountPlan {...common} signedIn headingRef={heading} tab={activeTab} presentationActions={{ canNavigate: canRoute, onAction: data?.actions?.onPlanAction, onPreference: data?.actions?.onPreference }} presentation={data?.plan?.presentation ?? {
            title: data?.plan?.title ?? shellText(language, 'planCredits'), sourceLabel: data?.plan?.sourceLabel ?? unavailable, status: null, rebates: null,
            preferences: data?.plan?.preferences ? [{ id: 'supplied', title: accountPlanText(language, 'notificationKinds'), rows: data.plan.preferences }, { id: 'channels', title: accountPlanText(language, 'channels'), rows: [{ id: 'unknown-channel', label: accountActivityText(language, 'preferences'), checked: null }] }] : null,
          }} />
            <div className="nfx-page">{data?.plan?.sections[activeTab]?.map(section => <section className="nfx-card" key={section.id}><h2 className="nfx-sectit">{section.title}</h2>{section.text && <p>{section.text}</p>}{section.fields && <NativeAccountFields fields={section.fields} />}</section>)}
            <div className="nfx-cta">{data?.plan?.links?.map((link, index) => <button type="button" className="nfx-btn out" key={index} disabled={!reachable(link.target)} onClick={() => navigate(link.target)}>{link.label}</button>)}</div></div>
          </>}
  </div>
}
