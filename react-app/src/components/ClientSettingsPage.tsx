import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { clientLanguages, setClientPreference, useClientPreferences } from '../client-preferences'
import { clientSettingsHash, clientSettingsTabs, type ClientSettingsTab } from '../client-settings-navigation'
import { setSettingsNavigationCollapsed, useSettingsLayout } from '../client-settings-layout'
import copy from '../client-settings-copy.json'
import { navigateInternal, useSiteLocation } from '../site-navigation'
import { nativeAccountText } from '../internal-poc/native-account-presentation-copy'
import { ClientSettingsIdentityRows, type ClientSettingsIdentityActions } from './ClientSettingsIdentityRows'
import { ClientSettingsEmailRow } from './ClientSettingsEmailRow'
import type { ClientEmailChangeRequest } from '../client-settings-email-presentation'
import type { ClientSecurityActions, ClientSecurityPresentation } from '../client-settings-security-presentation'
import { ClientSettingsSecurity } from './ClientSettingsSecurity'
import { ClientSettingsNotifications } from './ClientSettingsNotifications'
import type { ClientBillingActions, ClientBillingPresentation } from '../client-settings-billing-presentation'
import { ClientSettingsBilling } from './ClientSettingsBilling'
import { ClientLogo } from './ClientChrome'
import { getConversationCopy } from '../client-conversation-copy'
import { ClientSettingsUsage, type ClientSettingsUsageProps } from './ClientSettingsUsage'
import { usageText } from '../client-usage-presentation'
import '../client-settings.css'

type CopyKey = keyof typeof copy
type Props = {
  tab: ClientSettingsTab
  profile?: { name: string; email?: string; handle?: string }
  identityActions?: ClientSettingsIdentityActions
  onEmailChange?: ClientEmailChangeRequest
  security?: ClientSecurityPresentation
  securityActions?: ClientSecurityActions
  securityScopeId?: string | null
  billing?: ClientBillingPresentation
  billingActions?: ClientBillingActions
  usage?: ClientSettingsUsageProps
  onBack: () => void
  onNewStrategy: () => void
  onCopyStrategy: () => void
  onBrokers: () => void
  onHelp: (trigger: HTMLButtonElement) => void
  onLogout?: () => void
  logoutDisabled?: boolean
  /** Owner-bound existing content while detailed data adapters migrate. */
  details?: Partial<Record<ClientSettingsTab, ReactNode>>
}

// Exact ST_TABS geometry from client 02cebe3. Not an icon-library approximation.
const icons: Record<ClientSettingsTab | 'back' | 'brokers' | 'help', ReactNode> = {
  general: <><circle cx="12" cy="12" r="3" /><path d="M19.400 15a1.700 1.700 0 0 0 .340 1.870l.060.060a2 2 0 1 1-2.830 2.830l-.060-.060a1.700 1.700 0 0 0-1.870-.340 1.700 1.700 0 0 0-1.040 1.560V21a2 2 0 1 1-4 0v-.090a1.700 1.700 0 0 0-1.110-1.560 1.700 1.700 0 0 0-1.870.340l-.060.060a2 2 0 1 1-2.830-2.830l.060-.060a1.700 1.700 0 0 0 .340-1.870 1.700 1.700 0 0 0-1.560-1.040H3a2 2 0 1 1 0-4h.090a1.700 1.700 0 0 0 1.560-1.110 1.700 1.700 0 0 0-.340-1.870l-.060-.060a2 2 0 1 1 2.830-2.830l.060.060a1.700 1.700 0 0 0 1.870.340h.080a1.700 1.700 0 0 0 1.040-1.560V3a2 2 0 1 1 4 0v.090a1.700 1.700 0 0 0 1.040 1.560 1.700 1.700 0 0 0 1.870-.340l.060-.060a2 2 0 1 1 2.830 2.830l-.060.060a1.700 1.700 0 0 0-.340 1.870v.080a1.700 1.700 0 0 0 1.560 1.040H21a2 2 0 1 1 0 4h-.090a1.700 1.700 0 0 0-1.560 1.040z" /></>,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7" /></>,
  notify: <><path d="M6 9a6 6 0 1 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15 6 9z" /><path d="M10 20.500a2.200 2.200 0 0 0 4 0" /></>,
  billing: <><rect x="3" y="5.500" width="18" height="13" rx="2.500" /><path d="M3 10h18M7 15h3" /></>,
  usage: <><path d="M4 19h16M7 16V9M12 16V5M17 16v-4" /></>,
  security: <><path d="M12 3l7.500 3v5.500c0 4.700-3.200 8.300-7.500 9.500-4.300-1.200-7.500-4.800-7.500-9.500V6z" /><path d="M9 12l2.200 2.200L15.200 10" /></>,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  brokers: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" /><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17h.010" /></>,
}
function Icon({ name }: { name: keyof typeof icons }) {
  const sourceBack = name === 'back'
  return <svg width={sourceBack ? 16 : 17} height={sourceBack ? 16 : 17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sourceBack ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>
}
function Row({ label, value, action, hint }: { label: string; value?: ReactNode; action?: ReactNode; hint?: string }) {
  return <div className="stg-r"><div className="k"><b>{label}</b>{hint && <span>{hint}</span>}</div><div className="v">{value}</div>{action && <div className="a">{action}</div>}</div>
}
function Section({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="stg-sec">{title && <header><h2>{title}</h2></header>}<div className="stg-card">{children}</div></section>
}

/** Client layout with honest unavailable states. No local account, card, session
 * or security flags: service operations must come from the authenticated host.
 * Notification/billing/security details remain separate migration items.
 * Identity/email editors consume explicit owner-bound UI callbacks only. */
export function ClientSettingsPage({ tab, profile, identityActions, onEmailChange, security, securityActions, securityScopeId, billing, billingActions, usage, onBack, onNewStrategy, onCopyStrategy, onBrokers, onHelp, onLogout, logoutDisabled, details }: Props) {
  const { language, storageError } = useClientPreferences()
  const layout = useSettingsLayout()
  const href = useSiteLocation(true)
  const listRoute = new URL(href, location.origin).hash === '#/settings'
  const mobileList = !layout.wide && listRoute
  const navHidden = layout.hidden || (!layout.wide && !listRoute)
  const navId = useId()
  const navToggle = useRef<HTMLButtonElement>(null)
  const rail = useRef<HTMLElement>(null)
  const [tipDismissed, setTipDismissed] = useState(false)
  const lastLayoutFocus = useRef<EventTarget | null>(null)
  const s = (key: CopyKey | 'usage') => key === 'usage' ? usageText(language, 'title') : copy[key][language]
  const title = useRef<HTMLHeadingElement>(null)
  const nav = useRef<HTMLDivElement>(null)
  const mobileBack = useRef<HTMLAnchorElement>(null)
  const logoutTrigger = useRef<HTMLButtonElement>(null)
  const confirm = useRef<HTMLDivElement>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const lastTab = useRef(tab)
  useLayoutEffect(() => {
    // CSS may hide a focused control before the media-query store commits.
    // Recover that exact control's logical successor, but never steal a newer
    // outside focus or move focus merely because another tab changed layout.
    const active = document.activeElement === document.body ? lastLayoutFocus.current : document.activeElement
    if (navHidden && active instanceof Node && nav.current?.parentElement?.contains(active)) {
      if (layout.wide) navToggle.current?.focus({ preventScroll: true })
      else title.current?.focus({ preventScroll: true })
    }
    else if (active instanceof Node && rail.current?.contains(active)) {
      if (!layout.wide) (mobileList ? nav.current?.querySelector<HTMLElement>(`[data-settings-tab="${tab}"]`) : title.current)?.focus({ preventScroll: true })
      else if (!layout.hidden && active !== navToggle.current) navToggle.current?.focus({ preventScroll: true })
    }
    else if (layout.wide && active === mobileBack.current) title.current?.focus({ preventScroll: true })
  }, [layout.hidden, layout.wide, navHidden, mobileList, tab])
  useLayoutEffect(() => {
    if (lastTab.current !== tab) { lastTab.current = tab; setConfirmLogout(false) }
    const previous = document.activeElement
    const frame = requestAnimationFrame(() => {
      const current = document.activeElement
      // A queued title focus is subordinate to later user/host focus. In
      // particular, remounting for a new owner must not reclaim external focus.
      if (current !== document.body && current !== previous) return
      const scope = title.current?.closest('.client-source-app, .client-settings-page')
      const app = title.current?.closest('.client-source-app') ?? scope
      const exitingMenu = current instanceof HTMLElement && current.closest('.ca-menu-layer[data-surface-active="false"]')
      if (current !== document.body && current instanceof HTMLElement && !app?.contains(current) && !exitingMenu) return
      // A deliberate tab change starts at its heading, not at the previous
      // tab's scroll offset. This is inside the same later-focus guard.
      const page = title.current?.closest('.client-settings-page')
      if (page) page.scrollTop = 0
      if (!window.matchMedia('(min-width:901px)').matches && listRoute) nav.current?.querySelector<HTMLElement>(`[data-settings-tab="${tab}"]`)?.focus({ preventScroll: true })
      else title.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [tab, listRoute])
  useEffect(() => { if (confirmLogout) confirm.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [confirmLogout])
  const missing = <p className="stg-empty">{s('unavailable')}</p>
  const disabled = (label: CopyKey) => <button type="button" className="stg-b" disabled title={s('actionUnavailable')}>{s(label)}</button>
  const cancelLogout = () => { setConfirmLogout(false); logoutTrigger.current?.focus() }
  return <div className="client-settings-page" onFocusCapture={event => { lastLayoutFocus.current = event.target }} onBlurCapture={event => {
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) lastLayoutFocus.current = null
  }}><div className={`stg${layout.hidden ? ' nav-hid' : ''}${listRoute ? ' m-list' : ' m-detail'}`}>
    <aside ref={rail} className="stg-rail" aria-label={s('shortcuts')} data-tip-dismissed={tipDismissed} onPointerOver={() => setTipDismissed(false)} onFocusCapture={() => setTipDismissed(false)} onKeyDown={event => { if (event.key === 'Escape') setTipDismissed(true) }}>
    <button ref={navToggle} type="button" className="stg-tg" aria-label={s('sidebarToggle')} aria-controls={navId} aria-expanded={!layout.hidden} onClick={() => setSettingsNavigationCollapsed(!layout.collapsed)}>
      <ClientLogo />
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg>
      <span className="stg-tip" aria-hidden="true">{s('sidebarToggle')}</span>
    </button>
    <button type="button" className="stg-ri" aria-label={getConversationCopy(language, 'newStrategy')} onClick={onNewStrategy}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M17.800 2.800l3.400 3.400L13 14.400l-4 .600.600-4z" /></svg>
      <span className="stg-tip" aria-hidden="true">{getConversationCopy(language, 'newStrategy')}</span>
    </button>
    <button type="button" className="stg-ri" aria-label={s('copyStrategy')} onClick={onCopyStrategy}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 19c2-4 4-6 8-8" /><path d="M14 4a6 6 0 0 1 6 6c-3 0-5 1-6 2-1-1-2-3-2-6a6 6 0 0 1 2-2z" /><circle cx="15" cy="9" r="1" /></svg>
      <span className="stg-tip" aria-hidden="true">{s('copyStrategy')}</span>
    </button>
    </aside>
    <nav id={navId} className="stg-navigation" aria-label={s('settings')} inert={navHidden} aria-hidden={navHidden || undefined}>
      <button type="button" className="stg-back" onClick={onBack}><Icon name="back" />{s('back')}</button>
      <div className="stg-nav" ref={nav}>
      <small>{s('settings')}</small>
      {clientSettingsTabs.map(item => <a key={item} data-settings-tab={item} className={`stg-ni${!listRoute && tab === item ? ' on' : ''}`} href={clientSettingsHash(item)} aria-current={!listRoute && tab === item ? 'page' : undefined} onClick={navigateInternal}><Icon name={item} />{s(item)}</a>)}
      <small>{s('shortcuts')}</small>
      <button type="button" className="stg-ni" onClick={onBrokers}><Icon name="brokers" />{s('brokers')}</button>
      <button type="button" className="stg-ni" onClick={event => onHelp(event.currentTarget)}><Icon name="help" />{s('help')}</button>
      </div>
    </nav>
    <div className="stg-main" inert={mobileList} aria-hidden={mobileList || undefined}>
      <a ref={mobileBack} className="stg-mback" href="#/settings" onClick={navigateInternal}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>{s('settings')}</a>
      <h1 ref={title} tabIndex={-1}>{s(tab)}</h1>
      {layout.storageError && <div className="stg-storage" role="status">{s('layoutNotSaved')}<button type="button" className="stg-b" onClick={() => setSettingsNavigationCollapsed(layout.collapsed)}>{s('retry')}</button></div>}
      {tab === 'general' ? <Section>
        <Row label={s('language')} hint={s('languageHint')} action={<select className="stg-sel" aria-label={s('language')} value={language} onChange={event => setClientPreference('language', event.target.value)}>{clientLanguages.map(item => <option key={item.c} value={item.c}>{item.n}</option>)}</select>} />
        {storageError && <div className="stg-storage" role="status">{nativeAccountText(language, 'failed')}<button type="button" className="stg-b" onClick={() => setClientPreference('language', language)}>{s('retry')}</button></div>}
        <Row label={s('amounts')} value={<span className="num">USD</span>} hint={s('amountHint')} />
      </Section> : tab === 'usage' ? <ClientSettingsUsage {...usage} showHeading={false} /> : tab === 'billing' ? <>
        {!billing?.subscription && details?.billing}
        <ClientSettingsBilling data={billing} actions={billingActions} onConnect={onBrokers} />
      </> : details?.[tab] ?? (tab === 'account' ? <>
        <Section title={s('account')}>
          <Row label={s('status')} value="—" />
          <ClientSettingsIdentityRows profile={profile} actions={identityActions} />
          <ClientSettingsEmailRow key={profile?.email ?? ''} email={profile?.email} onRequest={onEmailChange} />
        </Section>
        <Section title={s('connections')}>{missing}<Row label={s('brokers')} action={<button type="button" className="stg-b" onClick={onBrokers}>{s('brokers')}</button>} /></Section>
        <Section><Row label={s('logout')} hint={s('logoutHint')} action={<button ref={logoutTrigger} type="button" className="stg-b" disabled={logoutDisabled || !onLogout} onClick={() => setConfirmLogout(true)}>{s('logout')}</button>} />
          {confirmLogout && <div ref={confirm} className="stg-confirm" role="group" aria-label={s('confirmLogout')} onKeyDown={event => { if (event.key === 'Escape' && !event.nativeEvent.isComposing) { event.stopPropagation(); cancelLogout() } }}>
            <p>{s('confirmLogout')}</p><button type="button" className="stg-b" onClick={cancelLogout}>{s('cancel')}</button><button type="button" className="stg-b p" disabled={logoutDisabled || !onLogout} onClick={() => { if (!logoutDisabled && onLogout) { setConfirmLogout(false); onLogout() } }}>{s('logout')}</button>
          </div>}
        </Section>
        <Section><Row label={s('deleteAccount')} hint={s('deleteHint')} action={disabled('deleteAccount')} /></Section>
      </> : tab === 'notify' ? <ClientSettingsNotifications /> : <ClientSettingsSecurity data={security} actions={securityActions} scopeId={securityScopeId} />)}
    </div>
  </div></div>
}
