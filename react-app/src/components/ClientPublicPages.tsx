// About/download/policies: tesia-lab 9fbff821.
// Static content is compiled JSX, not injected HTML.
import { useEffect, useRef, useState } from 'react'
import { SiteHelp } from './ClientHelp'
import { ClientSiteFooter } from './ClientSiteFooter'
import { DownloadPreview } from './DownloadPreview'
import { ClientDownloadStore } from './ClientDownloadStore'
import { readDownloadConfig } from '../client-download-config'
import { downloadText } from '../client-download-copy'
import type { SitePage } from '../site-navigation'
import { InternalLink } from './InternalLink'
import { ClientPolicyPage } from './ClientPolicyPage'
import { policyLabels } from '../client-policy-copy'
import { ClientAboutPage } from './ClientAboutPage'
import { aboutText } from '../client-about-copy'
import { useClientPreferences } from '../client-preferences'
import { getConversationCopy } from '../client-conversation-copy'
import { ClientLocalePanel } from './ClientLocalePanel'
import publicCopy from '../client-public-copy.json'
import { publicPreviewText } from '../client-public-preview-copy'
import '../client-public-pages.css'
import '../client-download-page.css'
import '../client-policy-page.css'

const publicLanguages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
function PublicCopy({ page, copyKey }: { page: 'about' | 'download'; copyKey: string }) {
  const { language } = useClientPreferences()
  const dictionary = publicCopy[page] as Record<string, string[]>
  const text = dictionary[copyKey]?.[Math.max(0, publicLanguages.indexOf(language))] ?? ''
  // Remaining chrome labels are plain authored strings. The retired rich
  // About body no longer needs a browser-only HTML parser.
  return <>{text}</>
}

function PrototypeNotice({ policy = false }: { policy?: boolean }) {
  const { language } = useClientPreferences()
  return <p className="prototype-notice">{publicPreviewText(language, policy ? 'policy' : 'preview')}</p>
}
export { SiteHelp } from './ClientHelp'
const tabForHash = (hash: string) => {
  if (hash.startsWith('p-')) return 'privacy'
  if (hash.startsWith('t-')) return 'terms'
  if (hash.startsWith('x-')) return 'technologies'
  return ['privacy', 'terms', 'technologies', 'faq'].includes(hash) ? hash : 'overview'
}
export default function ClientPublicPages({ page, location }: { page: SitePage; location: string }) {
  const download = readDownloadConfig()
  const { language, t } = useClientPreferences()
  // The original policy page is Korean-only. Localize its navigation, not its
  // legal body, using the client's existing public-page dictionary.
  const policyCopy = policyLabels(language)
  const policyTitle = policyCopy.title
  const [localeOpen, setLocaleOpen] = useState(false)
  const [footerHelpOpen, setFooterHelpOpen] = useState(false)
  const footerHelpTrigger = useRef<HTMLElement | null>(null)
  useEffect(() => {
    // Public routes reuse this component; dismiss its portal before the next
    // page takes focus, without resetting the underlying conversation.
    const dismiss = () => { setLocaleOpen(false); setFooterHelpOpen(false) }
    window.addEventListener('popstate', dismiss); window.addEventListener('teth:navigate', dismiss); window.addEventListener('hashchange', dismiss)
    return () => { window.removeEventListener('popstate', dismiss); window.removeEventListener('teth:navigate', dismiss); window.removeEventListener('hashchange', dismiss) }
  }, [])
  const hash = location.split('#')[1] ?? ''
  const policyTab = tabForHash(hash)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.title = page === 'about' || page === 'download' ? publicCopy[page].title[Math.max(0, publicLanguages.indexOf(language))] : `${policyTitle} | TETH`
  }, [page, language, policyTitle])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // A quick interaction with the newly mounted preview owns focus and scroll.
      if (root.current?.contains(document.activeElement) && document.activeElement?.closest('.phone-preview')) return
      const anchor = hash ? document.getElementById(hash) : null
      const offset = Math.max(128, (root.current?.querySelector('.hd')?.getBoundingClientRect().height ?? 0) + 24)
      if (anchor && root.current?.contains(anchor)) window.scrollTo({ top: window.scrollY + anchor.getBoundingClientRect().top - offset, behavior: 'instant' })
      else window.scrollTo({ top: 0, behavior: 'instant' })
      const main = root.current?.querySelector<HTMLElement>('#site-main')
      main?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [page, location, hash])
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      // Preserve the transparent arrival, then protect navigation from text passing underneath.
      setScrolled(window.scrollY > 24)
      if (page === 'policies') {
        const headings = Array.from(root.current?.querySelectorAll<HTMLElement>('.view.on .inner [id]') ?? [])
        setActiveSection(headings.filter(el => el.getBoundingClientRect().top <= 150).at(-1)?.id ?? headings[0]?.id ?? '')
      }
    }
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', scroll, { passive: true }); scroll()
    return () => { window.removeEventListener('scroll', scroll); cancelAnimationFrame(frame) }
  }, [page, policyTab])
  return <div ref={root} className={'client-public-page client-info-' + page}>
    <button className="public-language-trigger" type="button" onClick={() => setLocaleOpen(true)} aria-label={t('glc.lang')} aria-haspopup="dialog"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" /></svg></button>
    {localeOpen && <ClientLocalePanel onClose={() => setLocaleOpen(false)} />}
    <a className="site-skip" href="#site-main" onClick={event => {
      event.preventDefault()
      root.current?.querySelector<HTMLElement>('#site-main')?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }}>{getConversationCopy(language, 'skipContent')}</a>
    {page === 'about' && <>
<header className={scrolled ? "hd lite" : "hd"} id="hd">
<InternalLink className="brand" href="/">
<img src="/teth-logo-f260167.png" alt="" style={{"width":"22px","height":"auto","display":"block"}} />{"\n    TETH\n  "}</InternalLink>
<nav>
<InternalLink href="/about/"><PublicCopy page="about" copyKey="title" /></InternalLink>
<InternalLink href="/download/">{language === 'ko' ? '앱 다운로드' : <PublicCopy page="about" copyKey="navDl" />}</InternalLink>
</nav>
<span className="sp">
</span>
<InternalLink className="cta" href="/"><PublicCopy page="about" copyKey="cta" /></InternalLink>
</header>
<ClientAboutPage copy={text => aboutText(language, text)} onHelp={event => { footerHelpTrigger.current = event.currentTarget; setFooterHelpOpen(true) }} previewNotice={<PrototypeNotice />} pricingNotice={<p className="pricing-preview">{publicPreviewText(language, 'pricing')}</p>} faqNotice={<p className="faq-preview">{publicPreviewText(language, 'faq')}</p>} />



</>}
    {page === 'download' && <>
<header className="hd">
<InternalLink className="brand" href="/">
<img src="/teth-logo-f260167.png" alt="" style={{"width":"21px","height":"auto","display":"block"}} />{"\n    TETH\n  "}</InternalLink>
<nav>
<InternalLink href="/about/"><PublicCopy page="download" copyKey="navAbout" /></InternalLink>
<InternalLink href="/download/" aria-current="page">{language === 'ko' ? '앱 다운로드' : <PublicCopy page="download" copyKey="navDl" />}</InternalLink>
</nav>
<span className="sp" />
<InternalLink className="cta" href="/">{downloadText(language, 'start')}</InternalLink>
</header>

<main className="dl" id="site-main" tabIndex={-1}>
<div className="txt">
<span className="pl-lb">{downloadText(language, 'app')}</span>
<h1 className="dl-h1">{downloadText(language, 'title')}</h1>
<p className="dl-d">{downloadText(language, 'description')}</p>
<div className="dl-stores stores">
<ClientDownloadStore store="android" url={download.androidStoreUrl} icon={
<svg viewBox="0 0 24 24" aria-hidden="true">
<path fill="#34A853" d="M3.6 2.2 13.7 12 3.6 21.8c-.4-.2-.6-.6-.6-1.2V3.4c0-.6.2-1 .6-1.2z">
</path>
<path fill="#FBBC05" d="m13.7 12 3.2 3.1-3.9 2.2-6.5 3.7c-.3.2-.6.2-.9.1z">
</path>
<path fill="#EA4335" d="M13.7 12 5.6 2.9c.3-.1.6-.1.9.1l6.5 3.7 3.9 2.2z">
</path>
<path fill="#4285F4" d="m16.9 8.9 3.4 1.9c.9.5.9 1.9 0 2.4l-3.4 1.9L13.7 12z">
</path>
</svg>} />
<ClientDownloadStore store="ios" url={download.iosStoreUrl} icon={
<svg viewBox="0 0 24 24" fill="#e3e3e3" aria-hidden="true">
<path d="M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.93-2.13-1.67-.17-3.26.98-4.1.98-.85 0-2.16-.96-3.55-.93-1.82.03-3.5 1.06-4.44 2.69-1.9 3.29-.49 8.16 1.36 10.83.9 1.3 1.98 2.77 3.39 2.72 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.29-2.64 1.04-1.52 1.47-2.99 1.49-3.06-.03-.02-2.86-1.1-2.9-4.34zM14.34 4.56c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z">
</path>
</svg>} />
</div>
<div className="dl-acts"><InternalLink className="dl-cta" href="/">{downloadText(language, 'web')}</InternalLink><span className="dl-free">{downloadText(language, 'free')}</span></div>
<PrototypeNotice />
</div>
<DownloadPreview />
</main>
<p className="sub-help">{downloadText(language, 'help')} <button type="button" onClick={event => { footerHelpTrigger.current = event.currentTarget; setFooterHelpOpen(true) }}>{downloadText(language, 'ask')}</button></p>
</>}
    {page === 'policies' && <ClientPolicyPage policyTab={policyTab} activeSection={activeSection} labels={policyCopy} previewNotice={<PrototypeNotice policy />} onHelp={event => { footerHelpTrigger.current = event.currentTarget; setFooterHelpOpen(true) }} />}

    <ClientSiteFooter onHelp={trigger => { footerHelpTrigger.current = trigger; setFooterHelpOpen(true) }} />
    {!footerHelpOpen && <SiteHelp key={page} />}
    <SiteHelp initialOpen open={footerHelpOpen} returnFocus={footerHelpTrigger} onClose={() => setFooterHelpOpen(false)} />
  </div>
}
