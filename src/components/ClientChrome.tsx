import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { InternalLink } from './InternalLink'
import { ClientIcon } from './ClientIcon'
import { RESEARCH_PAGES, type ResearchPage, type ResearchRecord } from '../research-library'
import '../client-research-hub.css'
import { useClientPreferences } from '../client-preferences'
import { getSitePage } from '../site-navigation'

type ClientChromeProps = {
  signedIn: boolean
  onHome: () => void
  onLogin: () => void
  onSignup: () => void
  onSettings: () => void
  onLocale: () => void
  onDashboard: () => void
  researchPage?: ResearchPage | null
  records?: ResearchRecord[]
  activeResearchId?: string
  onResearchPage?: (page: ResearchPage) => void
  onSelectResearch?: (id: string) => void
  onProfile?: () => void
  profileName?: string
  onTrading?: () => void
}

export function ClientLogo({ className = '' }: { className?: string }) {
  return <img className={`client-logo ${className}`.trim()} src="/teth-logo.png" alt="" aria-hidden="true" />
}

export function ClientChrome({ signedIn, onHome, onLogin, onSignup, onSettings, onLocale, onDashboard, researchPage, records = [], activeResearchId, onResearchPage, onSelectResearch, onProfile, profileName, onTrading }: ClientChromeProps) {
  const { t, language } = useClientPreferences()
  const guestNote = t('side.note').split('|')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bannerOpen, setBannerOpen] = useState(() => { try { return sessionStorage.getItem('teth-app-banner-dismissed') !== '1' } catch { return true } })
  const sidebarRef = useRef<HTMLElement>(null)
  const restoreTriggerFocus = useRef(true)
  const openDrawer = () => { restoreTriggerFocus.current = true; setDrawerOpen(true) }

  useEffect(() => {
    const breakpoint = window.matchMedia('(max-width: 860px)')
    const closeOnBreakpoint = () => { setDrawerOpen(false) }
    breakpoint.addEventListener('change', closeOnBreakpoint)
    return () => breakpoint.removeEventListener('change', closeOnBreakpoint)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const sidebar = sidebarRef.current
    const trigger = document.activeElement as HTMLElement | null
    const mobile = window.matchMedia('(max-width: 860px)').matches
    const previousOverflow = document.body.style.overflow
    const siblings = mobile ? Array.from(sidebar?.parentElement?.children ?? []).filter((el): el is HTMLElement => el instanceof HTMLElement && el !== sidebar && !el.classList.contains('client-drawer-scrim')) : []
    const inertStates = siblings.map((el) => [el, el.inert] as const)
    if (mobile) { document.body.style.overflow = 'hidden'; siblings.forEach((el) => { el.inert = true }) }
    sidebar?.querySelector<HTMLButtonElement>('.client-drawer-brand button:last-child')?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setDrawerOpen(false) }
      if (mobile && event.key === 'Tab') {
        const items = Array.from(sidebar?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? []).filter((el) => el.getClientRects().length > 0)
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const closeOnNavigation = () => {
      if (!getSitePage()) return
      restoreTriggerFocus.current = false
      setDrawerOpen(false)
    }
    document.addEventListener('keydown', keydown)
    window.addEventListener('popstate', closeOnNavigation)
    window.addEventListener('teth:navigate', closeOnNavigation)
    return () => {
      document.removeEventListener('keydown', keydown)
      window.removeEventListener('popstate', closeOnNavigation)
      window.removeEventListener('teth:navigate', closeOnNavigation)
      document.body.style.overflow = previousOverflow
      inertStates.forEach(([el, value]) => { el.inert = value })
      if (restoreTriggerFocus.current && !getSitePage() && !document.getElementById('root')?.inert) {
        const visible = (node: HTMLElement | null) => node?.isConnected && node.getClientRects().length && !node.closest('[inert],[hidden]') && getComputedStyle(node).visibility !== 'hidden'
        const fallback = document.querySelector<HTMLElement>(matchMedia('(max-width: 860px)').matches ? '.client-hamburger' : '.client-rail-logo-row button')
        const target = visible(trigger) ? trigger : visible(fallback) ? fallback : null
        target?.focus({ preventScroll: true })
      }
    }
  }, [drawerOpen])

  const closeAnd = (action: () => void) => { restoreTriggerFocus.current = false; setDrawerOpen(false); action() }
  const settingsAction = <button key="settings" data-sidebar-action="settings" type="button" aria-label={t('menu.settings')} onClick={() => closeAnd(onSettings)}><ClientIcon name="settings" size={19} /><span>{t('menu.settings')}</span></button>
  const accountAction = <button key="account" data-sidebar-action="account" type="button" aria-label={signedIn ? onProfile ? '내 계정' : '내 전략 대시보드 열기' : '사이드바 로그인'} onClick={() => closeAnd(signedIn ? onProfile || onDashboard : onLogin)}><ClientIcon name="profile" size={21} /><span>{signedIn ? profileName || '내 계정' : '로그인'}</span></button>

  return (
    <>
      {bannerOpen && (
        <div className="client-app-banner">
          <span className="client-app-icon"><ClientLogo /></span>
          <span className="client-app-copy"><strong>TETH AI</strong><small>{t('banner.sub')}</small></span>
          <InternalLink className="client-download" href="/download/">{t('banner.dl')}</InternalLink>
          <button className="client-banner-close" type="button" aria-label="앱 배너 닫기" onClick={() => { setBannerOpen(false); try { sessionStorage.setItem('teth-app-banner-dismissed', '1') } catch { /* Session memory remains usable. */ } }}><X size={14} /></button>
        </div>
      )}

      <button
        className={`client-hamburger ${bannerOpen ? 'with-banner' : ''}`}
        type="button"
        aria-label={t('common.menu')}
        aria-expanded={drawerOpen}
        onClick={openDrawer}
      ><ClientIcon name="menu" size={21} /></button>

      {!signedIn && (
        <nav className={`client-auth-nav ${bannerOpen ? 'with-banner' : ''}`} aria-label="계정 메뉴">
          <InternalLink className="client-auth-link" href="/about/">{t('nav.about')}</InternalLink>
          <InternalLink className="client-auth-link" href="/download/">{t('nav.download')}</InternalLink>
          <button className="client-login" type="button" aria-label={onProfile ? t('nav.login') : language === 'ko' ? 'Mock 계정으로 로그인' : `Mock ${t('nav.login')}`} onClick={onLogin}>{t('nav.login')}</button>
          <button className="client-signup" type="button" onClick={onSignup}>{t('nav.signup')}</button>
        </nav>
      )}

      {!signedIn && <button className="client-globe" type="button" aria-label={t('menu.glc')} aria-haspopup="dialog" onClick={onLocale}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" /></svg>
        <span>{t('menu.glc')}</span>
      </button>}

      <aside ref={sidebarRef} className={`client-sidebar ${drawerOpen ? 'mobile-open' : ''}`} aria-label="TETH 메뉴">
        <div className="client-rail-logo-row">
          <button type="button" aria-label={t('side.open')} aria-expanded={drawerOpen} onClick={openDrawer}>
            <ClientLogo className="client-rail-logo" />
            <ClientIcon name="open" className="client-panel-icon" size={19} />
          </button>
          <span>{t('side.open')}</span>
        </div>
        <div className="client-rail-new-row">
          <button type="button" aria-label={t('side.newTip')} onClick={onHome}><ClientIcon name="new" size={20} /></button>
          <span>{t('side.newTip')}</span>
        </div>

        <div className="client-drawer-brand">
          <button type="button" onClick={() => closeAnd(onHome)} aria-label="TETH AI 홈"><ClientLogo /><strong>TETH</strong></button>
          <button type="button" aria-label={t('side.close')} onClick={() => setDrawerOpen(false)}><ClientIcon name="close" size={19} /></button>
        </div>
        <button className="client-new-strategy" type="button" disabled={!signedIn} onClick={() => closeAnd(onHome)}>{t('side.new')}</button>
        {!signedIn && <p className="client-guest-note"><ClientIcon name="info" size={15} /><span>{guestNote[0]}<button type="button" onClick={() => closeAnd(onLogin)}>{guestNote[1]}</button>{guestNote[2]}</span></p>}
        {signedIn && <div className="client-research-navigation">
          <nav aria-label="리서치 메뉴">{RESEARCH_PAGES.map(item => <button key={item.id} type="button" className="client-util" aria-current={researchPage === item.id ? 'page' : undefined} onClick={() => closeAnd(() => onResearchPage?.(item.id))}><ClientIcon name={item.id} size={15} />{item.label}</button>)}</nav>
          {onTrading && <button className="client-util" type="button" onClick={() => closeAnd(onTrading)}><ClientIcon name="history" size={15} />내 트레이딩</button>}
          <div className="client-research-heading"><span>Research</span><button type="button" aria-label="새 연구 시작" onClick={() => closeAnd(onHome)}>＋</button></div>
          <ul className="client-research-list" aria-label="Research 목록">{records.map(record => <li key={record.id}><button type="button" className="client-session" title={record.title} aria-current={!researchPage && activeResearchId === record.id ? 'true' : undefined} onClick={() => closeAnd(() => onSelectResearch?.(record.id))}><span>{record.title}</span><small>{record.status}</small></button></li>)}</ul>
          {!records.length && <p className="client-research-empty">아직 연구 기록이 없어요.</p>}
        </div>}
        <nav className="client-drawer-links" aria-label="서비스 메뉴">
          <InternalLink href="/about/" onClick={() => setDrawerOpen(false)}><ClientIcon name="info" size={15} />{t('nav.about')}</InternalLink>
          <InternalLink href="/download/" onClick={() => setDrawerOpen(false)}><ClientIcon name="download" size={15} />{t('nav.download')}</InternalLink>
        </nav>

        <div className="client-sidebar-bottom">
          {drawerOpen ? [accountAction, settingsAction] : [settingsAction, accountAction]}
        </div>
      </aside>
      {drawerOpen && <button className="client-drawer-scrim" type="button" aria-label="메뉴 닫기" onClick={() => setDrawerOpen(false)} />}
    </>
  )
}
