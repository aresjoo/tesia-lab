import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { InternalLink } from './InternalLink'
import { ClientIcon } from './ClientIcon'
import type { ResearchPage, ResearchRecord } from '../research-library'
import '../client-research-hub.css'
import { useClientPreferences } from '../client-preferences'
import { shellText, sourceSidebarNavigationLabel, type ShellCopyKey } from '../client-shell-copy'
import { getSitePage } from '../site-navigation'
import { ClientSidebarRecords, type ClientSidebarRecordsProps } from './ClientSidebarRecords'
import '../client-source-shell.css'
import { activeClientSurfaceSelector } from '../use-client-surface-presence'

/** Snapshot before closing the drawer hides/unmounts its entry button. */
export type ClientMenuAnchor = { top: number; trigger: HTMLElement }
type ClientChromeProps = {
  /** Current visible terminal header. The same drawer owns the portaled trigger. */
  mobileMenuHost?: HTMLElement | null
  signedIn: boolean
  showLocaleShortcut?: boolean
  onHome: () => void
  onLogin: () => void
  onSignup: () => void
  onSettings: (anchor?: ClientMenuAnchor) => void
  onLocale: (anchor?: ClientMenuAnchor) => void
  onDashboard: () => void
  researchPage?: ResearchPage | null
  /** Resets scroll affordances when the active conversation changes workspace. */
  contentScope?: string
  records?: readonly ResearchRecord[]
  recordsScope?: string
  recordsPresentation?: Pick<ClientSidebarRecordsProps, 'unavailable' | 'footer' | 'archiveLabel' | 'archiveDetail' | 'errorLabel'>
  /** Only the public, explicitly simulated workspace supplies this flag. */
  previewRecords?: boolean
  activeResearchId?: string
  onResearchPage?: (page: ResearchPage) => void
  onSelectResearch?: (id: string) => void | Promise<void>
  onProfile?: (anchor?: ClientMenuAnchor) => void
  profileName?: string
  onTrading?: () => void
  tradingActive?: boolean
  onPinResearch?: (id: string) => void | Promise<void>
  onRenameResearch?: (id: string, title: string) => void | Promise<void>
  onDeleteResearch?: (id: string) => void | Promise<void>
}

export function ClientLogo({ className = '' }: { className?: string }) {
  return <img className={`client-logo ${className}`.trim()} src="/teth-logo-f260167.png" alt="" aria-hidden="true" />
}

export function ClientChrome({ mobileMenuHost, signedIn, showLocaleShortcut = true, onHome, onLogin, onSignup, onSettings, onLocale, onDashboard, researchPage, contentScope, records = [], recordsScope, recordsPresentation, previewRecords = false, activeResearchId, onResearchPage, onSelectResearch, onProfile, profileName, onTrading, tradingActive = false, onPinResearch, onRenameResearch, onDeleteResearch }: ClientChromeProps) {
  const renderMenu = (button: React.ReactNode) => mobileMenuHost ? createPortal(button, mobileMenuHost) : button
  const { t, language } = useClientPreferences()
  const s = (key: ShellCopyKey, values?: Record<string, string | number>) => shellText(language, key, values)
  const guestNote = t('side.note').split('|')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bannerOpen, setBannerOpen] = useState(() => { try { return sessionStorage.getItem('teth-app-banner-dismissed') !== '1' } catch { return true } })
  const sidebarRef = useRef<HTMLElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const recordOwner = useRef(recordsScope)
  useLayoutEffect(() => { recordOwner.current = recordsScope; return () => { recordOwner.current = undefined } }, [recordsScope])
  const restoreTriggerFocus = useRef(true)
  const drawerIntent = useRef(0)
  const openDrawer = () => { drawerIntent.current++; restoreTriggerFocus.current = true; setDrawerOpen(true) }

  useEffect(() => {
    const button = hamburgerRef.current
    const app = sidebarRef.current?.closest<HTMLElement>('.client-source-app')
    if (!button || !app) return
    const media = window.matchMedia('(max-width: 860px)')
    let positions = new WeakMap<HTMLElement, number>()
    const reset = () => {
      button.classList.remove('client-hamburger-scroll-hidden')
      positions = new WeakMap()
      for (const node of [app, ...app.querySelectorAll<HTMLElement>('.client-source-main, .g-scroll, .rw-scroll, .client-research-hub, #research-main, .client-sharing-hub')]) positions.set(node, node.scrollTop)
    }
    const scroll = (event: Event) => {
      const node = event.target
      if (!(node instanceof HTMLElement) || node !== app && !app.querySelector('.client-source-main')?.contains(node)
        || node.matches('textarea,input,select') || node.closest('.client-sidebar,dialog,[hidden],[inert]')
        || node.scrollHeight <= node.clientHeight + 1 || !node.getClientRects().length) return
      const y = node.scrollTop, previous = positions.get(node) ?? 0
      positions.set(node, y)
      // Source sk-main: 860px / top 60px / direction delta greater than 4px.
      // The terminal owns its portaled menu, and focused controls stay reachable.
      if (!media.matches || mobileMenuHost || drawerOpen || document.activeElement === button) {
        button.classList.remove('client-hamburger-scroll-hidden'); return
      }
      if (y > 60 && y > previous + 4) button.classList.add('client-hamburger-scroll-hidden')
      else if (y <= 60 || y < previous - 4) button.classList.remove('client-hamburger-scroll-hidden')
    }
    const focus = (event: FocusEvent) => { if (event.target === button) button.classList.remove('client-hamburger-scroll-hidden') }
    reset()
    document.addEventListener('scroll', scroll, { capture: true, passive: true })
    document.addEventListener('focusin', focus)
    media.addEventListener('change', reset)
    window.addEventListener('popstate', reset)
    window.addEventListener('hashchange', reset)
    window.addEventListener('teth:navigate', reset)
    return () => {
      button.classList.remove('client-hamburger-scroll-hidden')
      document.removeEventListener('scroll', scroll, true)
      document.removeEventListener('focusin', focus)
      media.removeEventListener('change', reset)
      window.removeEventListener('popstate', reset)
      window.removeEventListener('hashchange', reset)
      window.removeEventListener('teth:navigate', reset)
    }
  }, [drawerOpen, mobileMenuHost, researchPage, activeResearchId, tradingActive, recordsScope, contentScope])

  useEffect(() => {
    const breakpoint = window.matchMedia('(max-width: 860px)')
    const closeOnBreakpoint = () => { setDrawerOpen(false) }
    breakpoint.addEventListener('change', closeOnBreakpoint)
    return () => breakpoint.removeEventListener('change', closeOnBreakpoint)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const sidebar = sidebarRef.current
    const originHref = location.href
    const trigger = document.activeElement as HTMLElement | null
    const mobile = window.matchMedia('(max-width: 860px)').matches
    const bodyStyle = document.body.style
    const previousOverflow = bodyStyle.getPropertyValue('overflow')
    const previousPriority = bodyStyle.getPropertyPriority('overflow')
    // The finite-page body ends before the shared footer. Lock siblings at
    // both levels without making an ancestor of the drawer itself inert.
    const siblings: HTMLElement[] = []
    if (mobile && sidebar) {
      const shell = sidebar.closest('.client-source-app') ?? sidebar.parentElement
      for (let branch: HTMLElement | null = sidebar; branch && branch !== shell; branch = branch.parentElement) {
        for (const el of branch.parentElement?.children ?? []) {
          if (el instanceof HTMLElement && el !== branch && !el.classList.contains('client-drawer-scrim')) siblings.push(el)
        }
      }
    }
    const inertStates = siblings.map((el) => [el, el.inert] as const)
    if (mobile) { bodyStyle.setProperty('overflow', 'hidden'); siblings.forEach((el) => { el.inert = true }) }
    sidebar?.querySelector<HTMLButtonElement>('.client-drawer-brand button:last-child')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Tab') return
      // The foreground modal owns Escape/Tab, including native cancel's default
      // action. Do not close the sidebar or steal its return focus underneath it.
      if (event.defaultPrevented || document.querySelector(`dialog:modal,${activeClientSurfaceSelector}`)) return
      if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); setDrawerOpen(false) }
      if (mobile && event.key === 'Tab') {
        const items = Array.from(sidebar?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? []).filter((el) => el.getClientRects().length > 0)
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const closeOnNavigation = () => {
      if (!getSitePage() && location.href === originHref) return
      restoreTriggerFocus.current = false
      setDrawerOpen(false)
    }
    document.addEventListener('keydown', keydown)
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    window.addEventListener('hashchange', closeOnNavigation)
    return () => {
      document.removeEventListener('keydown', keydown)
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
      window.removeEventListener('hashchange', closeOnNavigation)
      // Only restore a lock this effect acquired, using its captured viewport.
      // A resize can change the current breakpoint before cleanup runs.
      if (mobile) {
        if (previousOverflow) bodyStyle.setProperty('overflow', previousOverflow, previousPriority)
        else bodyStyle.removeProperty('overflow')
      }
      inertStates.forEach(([el, value]) => { el.inert = value })
      if (restoreTriggerFocus.current && !getSitePage() && !document.getElementById('root')?.inert) {
        const visible = (node: HTMLElement | null) => node?.isConnected && node.getClientRects().length && !node.closest('[inert],[hidden]') && getComputedStyle(node).visibility !== 'hidden'
        const fallback = document.querySelector<HTMLElement>(matchMedia('(max-width: 860px)').matches ? '.client-hamburger' : '.client-rail-logo-row button')
        const target = visible(trigger) ? trigger : visible(fallback) ? fallback : null
        target?.focus({ preventScroll: true })
      }
    }
  }, [drawerOpen])

  const closeAnd = (action: () => void) => { drawerIntent.current++; restoreTriggerFocus.current = false; setDrawerOpen(false); action() }
  const openFrom = (trigger: HTMLElement, action: (anchor?: ClientMenuAnchor) => void) => {
    const anchor = { top: trigger.getBoundingClientRect().top, trigger }
    if (matchMedia('(min-width:861px)').matches && (action === onSettings || action === onLocale)) {
      drawerIntent.current++
      action(anchor)
    } else closeAnd(() => action(anchor))
  }
  const settingsAction = <button key="settings" data-sidebar-action="settings" type="button" aria-label={t('menu.settings')} onClick={event => openFrom(event.currentTarget, onSettings)}><ClientIcon name="settings" size={19} /><span>{t('menu.settings')}</span></button>
  const accountAction = <button key="account" data-sidebar-action="account" type="button" aria-label={signedIn ? s(onProfile ? 'account' : 'dashboard') : s('sidebarLogin')} onClick={event => openFrom(event.currentTarget, signedIn ? onProfile || onDashboard : onLogin)}><ClientIcon name="profile" size={21} />{!signedIn && <span>{t('nav.login')}</span>}</button>
  const profileAction = <button data-sidebar-action="profile-settings" className="client-profile-settings" type="button" aria-label={s('accountSettings', { name: profileName || s('account') })} onClick={event => openFrom(event.currentTarget, onSettings)}><i aria-hidden="true">{Array.from(profileName || 'T')[0]}</i><span>{profileName || s('account')}</span><ClientIcon name="settings" size={18} /></button>
  const visibleRecords = drawerOpen ? records : []
  const tradingAction = onTrading && <button key="trading" className="client-util" type="button" aria-label={sourceSidebarNavigationLabel(language, 'trading')} aria-current={tradingActive ? 'page' : undefined} onClick={() => closeAnd(onTrading)}><ClientIcon name="trading" size={16} /><span>{sourceSidebarNavigationLabel(language, 'trading')}</span></button>

  return (
    <>
      {bannerOpen && (
        <div className="client-app-banner">
          <span className="client-app-icon"><ClientLogo /></span>
          <span className="client-app-copy"><strong>TETH AI</strong><small>{t('banner.sub')}</small></span>
          <InternalLink className="client-download" href="/download/"><span className="client-download-pill">{t('banner.dl')}</span></InternalLink>
          <button className="client-banner-close" type="button" aria-label={s('closeBanner')} onClick={() => { setBannerOpen(false); try { sessionStorage.setItem('teth-app-banner-dismissed', '1') } catch { /* Session memory remains usable. */ } }}><X size={14} /></button>
        </div>
      )}

      {renderMenu(<button
        ref={hamburgerRef}
        className={`client-hamburger ${bannerOpen ? 'with-banner' : ''}`}
        type="button"
        aria-label={t('common.menu')}
        aria-expanded={drawerOpen}
        onClick={openDrawer}
      ><ClientIcon name="menu" size={21} /></button>)}

      {!signedIn && (
        <nav className={`client-auth-nav ${bannerOpen ? 'with-banner' : ''}`} aria-label={s('accountMenu')}>
          <InternalLink className="client-auth-link" href="/about/">{t('nav.about')}</InternalLink>
          <InternalLink className="client-auth-link" href="/download/">{t('nav.download')}</InternalLink>
          <button className="client-login" type="button" aria-label={onProfile ? t('nav.login') : language === 'ko' ? 'Mock 계정으로 로그인' : `Mock ${t('nav.login')}`} onClick={onLogin}><span className="client-auth-pill">{t('nav.login')}</span></button>
          <button className="client-signup" type="button" onClick={onSignup}><span className="client-auth-pill">{t('nav.signup')}</span></button>
        </nav>
      )}

      {!signedIn && showLocaleShortcut && <button className="client-globe" type="button" aria-label={t('menu.glc')} aria-haspopup="dialog" onClick={event => openFrom(event.currentTarget, onLocale)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" /></svg>
        <span>{t('menu.glc')}</span>
      </button>}

      <aside ref={sidebarRef} className={`client-sidebar ${drawerOpen ? 'mobile-open' : ''}`} aria-label={s('menu')}
        onScroll={event => {
          // Short desktop rail labels escape overflow via fixed positioning.
          // A CSS offset follows scrolling without layout reads or React renders.
          event.currentTarget.style.setProperty('--client-rail-scroll', `${event.currentTarget.scrollTop}px`)
        }}>
        <div className="client-rail-logo-row">
          <button type="button" aria-label={t('side.open')} aria-expanded={drawerOpen} onClick={openDrawer}>
            <ClientLogo className="client-rail-logo" />
            <ClientIcon name="open" className="client-panel-icon" size={19} />
          </button>
          <span>{t('side.open')}</span>
        </div>
        <div className="client-rail-new-row">
          <button type="button" aria-label={t('side.newTip')} disabled={!signedIn} onClick={onHome}><ClientIcon name="new" size={20} /></button>
          <span>{t('side.newTip')}</span>
        </div>

        <div className="client-drawer-brand">
          <button type="button" onClick={() => closeAnd(onHome)} aria-label={s('home')}><ClientLogo /><strong>TETH</strong></button>
          <button type="button" aria-label={t('side.close')} onClick={() => setDrawerOpen(false)}><ClientIcon name="close" size={19} /></button>
        </div>
        <button className="client-new-strategy" type="button" aria-label={t('side.new')} disabled={!signedIn} onClick={() => closeAnd(onHome)}><ClientIcon name="new" size={18} />{t('side.new').replace(/^[＋+]\s*/, '')}</button>
        {!signedIn && tradingAction}
        {!signedIn && <button type="button" className="client-util" aria-label={sourceSidebarNavigationLabel(language, 'sharing')} aria-current={researchPage === 'sharing' ? 'page' : undefined} onClick={() => closeAnd(() => onResearchPage?.('sharing'))}><ClientIcon name="strategies" size={18} /><span>{sourceSidebarNavigationLabel(language, 'sharing')}</span></button>}
        {!signedIn && <p className="client-guest-note"><ClientIcon name="info" size={15} /><span>{guestNote[0]}<button type="button" onClick={() => closeAnd(onLogin)}>{guestNote[1]}</button>{guestNote[2]}</span></p>}
        {signedIn && <div className="client-research-navigation">
          <nav aria-label={s('researchMenu')}>{(['history', 'trading', 'sharing', 'brokers'] as const).map(page => {
            if (page === 'trading') return tradingAction
            const label = sourceSidebarNavigationLabel(language, page)
            const selected = !tradingActive && (researchPage === page || page === 'sharing' && researchPage === 'ranking')
            return <button key={page} type="button" className="client-util" aria-label={label} aria-current={selected ? 'page' : undefined} onClick={() => closeAnd(() => onResearchPage?.(page))}><ClientIcon name={page === 'sharing' ? 'strategies' : page} size={16} /><span>{label}</span></button>
          })}</nav>
          <ClientSidebarRecords key={recordsScope} {...recordsPresentation} records={visibleRecords} preview={previewRecords} active={!tradingActive && !researchPage} activeResearchId={activeResearchId}
            onSelect={async id => { const intent = drawerIntent.current; await onSelectResearch?.(id); if (recordOwner.current === recordsScope && drawerIntent.current === intent) closeAnd(() => undefined) }} onPin={onPinResearch} onRename={onRenameResearch}
            onDelete={onDeleteResearch ? async id => { await onDeleteResearch(id); requestAnimationFrame(() => {
              if (recordOwner.current !== recordsScope) return
              const target = sidebarRef.current?.querySelector<HTMLButtonElement>('.client-new-strategy')
              if (target?.getClientRects().length && !document.querySelector('dialog:modal')) target.focus({ preventScroll: true })
            }) } : undefined} />
        </div>}
        <nav className="client-drawer-links" aria-label={s('serviceMenu')}>
          <InternalLink href="/about/" onClick={() => setDrawerOpen(false)}><ClientIcon name="info" size={15} />{t('nav.about')}</InternalLink>
          <InternalLink href="/download/" onClick={() => setDrawerOpen(false)}><ClientIcon name="download" size={15} />{t('nav.download')}</InternalLink>
        </nav>

        <div className="client-sidebar-bottom">
          {signedIn ? drawerOpen ? profileAction : accountAction : drawerOpen ? [accountAction, settingsAction] : [settingsAction, accountAction]}
        </div>
      </aside>
      {drawerOpen && <button className="client-drawer-scrim" type="button" aria-label={s('closeMenu')} onClick={() => setDrawerOpen(false)} />}
    </>
  )
}
