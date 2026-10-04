import { useEffect, useRef, type ReactNode } from 'react'
import { InternalLink } from './InternalLink'
import { useClientPreferences } from '../client-preferences'
import copy from '../client-site-footer-copy.json'
import { footerSocialPaths, footerWordmark } from '../client-site-footer-source'
import '../client-site-footer.css'

export type FooterAction = 'trade' | 'strategies' | 'new' | 'brokers' | 'insights' | 'usage'
type Props = {
  lime?: boolean
  onNavigate?: (action: FooterAction) => void
  onHelp: (trigger: HTMLButtonElement) => void
  notice?: ReactNode
}

/** The source's shared footer, without inline HTML handlers or unapproved service claims. */
export function ClientSiteFooter({ lime = false, onNavigate, onHelp, notice }: Props) {
  const { language } = useClientPreferences()
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const footer = root.current, shell = footer?.closest('.client-source-app')
    if (!footer || !shell) return
    // Only move the floating helper when the home input has yielded to the
    // footer. No scroll loop, geometry polling or React rerenders are needed.
    const observer = new IntersectionObserver(entries => shell.classList.toggle('footer-in-view', entries[0].isIntersecting))
    observer.observe(footer)
    return () => { observer.disconnect(); shell.classList.remove('footer-in-view') }
  }, [])
  const c = copy[language]
  const item = (action: FooterAction, label: string, href: string) => onNavigate
    ? <button type="button" key={action} onClick={() => {
      // The document shell (not window/research-main) owns footer-page scroll.
      // Capture it before navigation can remove this footer. This only responds
      // to an explicit page navigation, never locale/period/data refreshes.
      const shell = root.current?.closest<HTMLElement>('.client-source-app.has-site-footer')
      onNavigate(action)
      shell?.scrollTo({ top: 0, behavior: 'instant' })
    }}>{label}</button>
    : <InternalLink key={action} href={href}>{label}</InternalLink>
  return <footer ref={root} className={`gft client-site-footer${lime ? ' gft-lime' : ''}`} aria-label={c.siteInfo}>
    <div className="gft-in">
      <div className="gft-bar">
        <InternalLink className="gft-crs" href="/policies/">{c.top.customerRelationshipSummary}</InternalLink>
        <div className="gft-follow"><span className="gft-fl">{c.top.followUs}</span>
          {(['x', 'instagram', 'youtube', 'telegram'] as const).map((key, index) => {
            const name = ['X', 'Instagram', 'YouTube', 'Telegram'][index]
            // Source social URLs are TODO placeholders, not verified destinations.
            return <button key={key} type="button" disabled aria-label={`${name} · ${c.comingSoon}`} title={`${name} · ${c.comingSoon}`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={footerSocialPaths[key]} /></svg>
            </button>
          })}
        </div>
      </div>
      <div className="gft-rule" aria-hidden="true" />
      <div className="gft-top">
        <nav className="gft-cols" aria-label={c.footerMenu}>
          <div className="gft-col"><h3>{c.sections.product.title}</h3>
            {item('trade', c.sections.product.items[0], '/#/trade')}
            {item('strategies', c.sections.product.items[1], '/#/share')}
            {item('new', c.sections.product.items[2], '/')}
            {item('brokers', c.sections.product.items[3], '/#/trade')}
          </div>
          <div className="gft-col"><h3>{c.sections.company.title}</h3>
            <InternalLink href="/about/">{c.sections.company.items[0]}</InternalLink>
            <InternalLink href="/download/">{c.sections.company.items[1]}</InternalLink>
          </div>
          <div className="gft-col"><h3>{c.sections.help.title}</h3>
            <button type="button" onClick={event => onHelp(event.currentTarget)}>{c.sections.help.items[0]}</button>
            {item('insights', c.sections.help.items[1], '/#/insight')}
            {item('usage', c.sections.help.items[2], '/#/plan')}
          </div>
          <div className="gft-col"><h3>{c.sections.terms.title}</h3>
            <InternalLink href="/policies/#terms">{c.sections.terms.items[0]}</InternalLink>
            <InternalLink href="/policies/#privacy">{c.sections.terms.items[1]}</InternalLink>
          </div>
        </nav>
        <div className="gft-copy">{notice ? <p>{notice}</p> : language === 'ko' && <>
          <p>TETH는 고객이 말로 정한 투자 아이디어를 AI와 함께 전략으로 정리하고 연구·검증하는 서비스입니다.</p>
          <p><b>말로 정한 투자 아이디어를 나만의 전략으로.</b></p>
          <p className="dim">거래소 연결과 전략 실행은 고객이 직접 선택하고 승인합니다. 로그인만으로 거래소 연결이나 거래가 실행되지 않습니다.</p>
        </>}<p className="dim">© 2026 TETH AI. {c.allRightsReserved}.</p></div>
      </div>
      <div className="gft-pw">거래소 <img src="/assets/logos/bitget-512.png" alt="" width="22" height="22" loading="lazy" /><b>Bitget</b></div>
      <svg className="gft-wm" viewBox="0 0 3970 1000" role="img" aria-label="TETH"><path d={footerWordmark} /></svg>
    </div>
  </footer>
}
