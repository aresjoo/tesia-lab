// Client source: aresjoo/tesia-lab @ acccc7f. Static content is compiled JSX, not injected HTML.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Headset, X } from 'lucide-react'
import { DownloadPreview } from './DownloadPreview'
import type { SitePage } from '../site-navigation'
import { InternalLink } from './InternalLink'
import { ConversationCosmos } from './ConversationCosmos'
import { useClientPreferences } from '../client-preferences'
import { ClientLocalePanel } from './ClientLocalePanel'
import publicCopy from '../client-public-copy.json'
import '../client-public-pages.css'

const publicLanguages = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'fr']
function PublicCopy({ page, copyKey }: { page: 'about' | 'download'; copyKey: string }) {
  const { language } = useClientPreferences()
  const dictionary = publicCopy[page] as Record<string, string[]>
  const text = dictionary[copyKey]?.[Math.max(0, publicLanguages.indexOf(language))] ?? ''
  // Source-authored rich copy becomes React nodes, never innerHTML. Only the
  // source's inline emphasis and local policy/download links are permitted.
  return useMemo(() => {
    const html = text.replaceAll('{T}', '<a href="/policies/#terms">').replaceAll('{P}', '<a href="/policies/#privacy">').replaceAll('{/}', '</a>')
    const document = new DOMParser().parseFromString(html, 'text/html')
    const render = (node: Node, key: number): ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent
      if (!(node instanceof Element)) return null
      const children = [...node.childNodes].map(render)
      if (node.tagName === 'BR') return <br key={key} />
      if (node.tagName === 'B' || node.tagName === 'STRONG') return <strong key={key}>{children}</strong>
      if (node.tagName === 'EM' || node.tagName === 'I') return <em key={key}>{children}</em>
      if (node.tagName === 'A') {
        const href = (node.getAttribute('href') ?? '').replace(/^\.\.\//, '/')
        if (/^\/(?:policies|download|about)\//.test(href)) return <InternalLink key={key} href={href}>{children}</InternalLink>
      }
      return <Fragment key={key}>{children}</Fragment>
    }
    return <>{[...document.body.childNodes].map(render)}</>
  }, [text])
}

function PrototypeNotice({ policy = false }: { policy?: boolean }) {
  return <p className="prototype-notice">{policy
    ? '정책 디자인 검토용 초안입니다. 아래 요금·보안·데이터 처리 설명은 출시 제품의 확정 정책이 아니며, 현재 화면은 Mock UI입니다.'
    : '제품 디자인 미리보기 · 현재는 Mock UI이며 실제 주문·결제·거래소 연결은 진행되지 않습니다.'}</p>
}
function PricingPlans() {
  const { language } = useClientPreferences()
  const index = Math.max(0, publicLanguages.indexOf(language))
  const plans = [
    { id: 'direct', name: 'TETH Direct', price: '월 599,000원', tagline: '쓰던 거래소 그대로, 바로 시작', features: ['무제한 전략 연구, 백테스트', '실전 실행, 모니터링', '모든 검증 엔진(리스크, 비판, 홀드아웃)', '우선 지원'], cta: 'Direct로 시작하기' },
    { id: 'partner', name: 'TETH Partner', price: '0원', tagline: '파트너 거래소로 시작하면 이용료 무료', features: ['Direct의 모든 기능 동일', '파트너 거래소 가입 즉시 자동 연결', '이용료 파트너 혜택으로 전액 무료', '언제든 Direct로 전환 가능'], cta: 'Partner로 무료 시작' },
  ]
  const translated = plans.map(plan => {
    const entry = publicCopy.pricing[plan.id as keyof typeof publicCopy.pricing]
    return { ...plan, price: entry.price[index], tagline: entry.tag[index], features: entry.f.map(feature => feature[index]), cta: entry.cta[index] }
  })
  return <>
<p className="pricing-preview">요금제 디자인 예시 · 결제·파트너 가입은 진행되지 않습니다.</p>
<div className="plans">{translated.map(plan =>
    <article className={plan.id === 'partner' ? 'plan hl' : 'plan'} key={plan.id}>
      <h3>{plan.name}</h3>
<div className={`price${language !== 'ko' ? ' translated' : ''}`}>{plan.price.startsWith('월 ') && <span className="price-period">월</span>}<strong>{plan.price.replace(/^월 /, '')}</strong></div>
<p className="tag">{plan.tagline}</p>
      <ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
      <InternalLink className="go" href="/">{plan.cta}</InternalLink>
    </article>)}</div>
</>
}
export function SiteHelp({ initialOpen = false, onClose }: { initialOpen?: boolean; onClose?: () => void } = {}) {
  const { t, language } = useClientPreferences()
  const [open, setOpen] = useState(initialOpen)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!initialOpen) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.querySelector<HTMLButtonElement>('.help-close')?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = [...(ref.current?.querySelectorAll<HTMLElement>('.site-help-pop button, .site-help-pop a[href]') ?? [])]
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      requestAnimationFrame(() => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus() })
    }
  }, [initialOpen])
  useEffect(() => {
    if (!open) return
    const pointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) { setOpen(false); onClose?.() } }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); onClose?.(); trigger.current?.focus() } }
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key) }
  }, [open, onClose])
  return <div className={`site-help${initialOpen ? ' client-modal-help' : ''}`} ref={ref}>
    {open && <section className="site-help-pop" id="site-help-pop" role={initialOpen ? 'dialog' : undefined} aria-modal={initialOpen || undefined} aria-label={t('help.title')}>
      <button type="button" className="help-close" aria-label={language === 'ko' ? '도움말 닫기' : t('common.close')} onClick={() => { setOpen(false); onClose?.(); trigger.current?.focus() }}>
<X size={18} />
</button>
      <h2>{t('help.title')}</h2>
<p>{t('help.body')}</p><p>{t('help.sub')}</p>
      <InternalLink href="/about/#faq" onClick={() => { setOpen(false); onClose?.() }}><PublicCopy page="about" copyKey="fh2" /> →</InternalLink>
      <InternalLink href="/policies/#overview" onClick={() => { setOpen(false); onClose?.() }}><PublicCopy page="download" copyKey="pol" /> →</InternalLink>
    </section>}
    <button ref={trigger} className="site-help-trigger" type="button" aria-label={language === 'ko' ? 'TETH 도움말' : t('help.title')} aria-expanded={open} aria-controls={open ? 'site-help-pop' : undefined} onClick={() => { if (open) onClose?.(); setOpen(value => !value) }}>
<Headset size={24} />
</button>
  </div>
}
const tabForHash = (hash: string) => {
  if (hash.startsWith('p-')) return 'privacy'
  if (hash.startsWith('t-')) return 'terms'
  if (hash.startsWith('x-')) return 'technologies'
  return ['privacy', 'terms', 'technologies', 'faq'].includes(hash) ? hash : 'overview'
}
export default function ClientPublicPages({ page, location }: { page: SitePage; location: string }) {
  const { language, t } = useClientPreferences()
  const [localeOpen, setLocaleOpen] = useState(false)
  useEffect(() => {
    // Public routes reuse this component; dismiss its portal before the next
    // page takes focus, without resetting the underlying conversation.
    const dismiss = () => setLocaleOpen(false)
    window.addEventListener('popstate', dismiss); window.addEventListener('teth:navigate', dismiss); window.addEventListener('hashchange', dismiss)
    return () => { window.removeEventListener('popstate', dismiss); window.removeEventListener('teth:navigate', dismiss); window.removeEventListener('hashchange', dismiss) }
  }, [])
  const hash = location.split('#')[1] ?? ''
  const policyTab = tabForHash(hash)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.title = page === 'about' || page === 'download' ? publicCopy[page].title[Math.max(0, publicLanguages.indexOf(language))] : '개인정보 보호 및 약관 – TETH'
  }, [page, language])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // A quick interaction with the newly mounted preview owns focus and scroll.
      if (root.current?.contains(document.activeElement) && document.activeElement?.closest('.phone-preview')) return
      const anchor = hash ? document.getElementById(hash) : null
      if (anchor && root.current?.contains(anchor)) window.scrollTo({ top: window.scrollY + anchor.getBoundingClientRect().top - 128, behavior: 'instant' })
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
    <button className="public-language-trigger" type="button" onClick={() => setLocaleOpen(true)} aria-label={t('menu.glc')} aria-haspopup="dialog"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" /></svg></button>
    {localeOpen && <ClientLocalePanel onClose={() => setLocaleOpen(false)} />}
    <a className="site-skip" href="#site-main" onClick={event => {
      event.preventDefault()
      root.current?.querySelector<HTMLElement>('#site-main')?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }}>본문으로 건너뛰기</a>
    {page === 'about' && <>
<header className={scrolled ? "hd lite" : "hd"} id="hd">
<InternalLink className="brand" href="/">
<img src="/teth-logo.png" alt="" style={{"width":"22px","height":"auto","display":"block"}} />{"\n    TETH\n  "}</InternalLink>
<nav>
<InternalLink href="/about/"><PublicCopy page="about" copyKey="title" /></InternalLink>
<InternalLink href="/download/"><PublicCopy page="about" copyKey="navDl" /></InternalLink>
</nav>
<span className="sp">
</span>
<InternalLink className="cta" href="/"><PublicCopy page="about" copyKey="cta" /></InternalLink>
</header>
<main id="site-main" tabIndex={-1}>



<section className="hero">
<ConversationCosmos />
<h1><PublicCopy page="about" copyKey="h1" /></h1>
<InternalLink className="cta" href="/"><PublicCopy page="about" copyKey="cta" /></InternalLink>
<div className="hero-notes">
<PrototypeNotice />
<div className="cap"><PublicCopy page="about" copyKey="cap" /></div>
</div>
</section>



<div className="feats">
<section className="feat">
<div className="tx">
<h2><PublicCopy page="about" copyKey="f1h" /></h2>
<p><PublicCopy page="about" copyKey="f1p" /></p>
<InternalLink className="lnk" href="/">
<span><PublicCopy page="about" copyKey="f1l" /></span>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M5 12h14M13 6l6 6-6 6">
</path>
</svg>
</InternalLink>
</div>
<div className="vis v1">
<div className="stack">
<img className="shot" src="/client-shots/about-talk.webp" width="1200" height="382" alt="TETH 데모 대화 화면, 한 문장 요청에 필수 설정 확인으로 이어지는 전략 대화" />
<img className="shot" src="/client-shots/about-plan.webp" width="1200" height="728" alt="TETH Research Plan 데모 화면, 대상 BTC/USDT 1시간봉, 진입 RSI 30 이하 과매도 후 20일 이동평균 회복, 손절 -3%, 익절 +8%" />
</div>
</div>
</section>
<section className="feat">
<div className="tx">
<h2><PublicCopy page="about" copyKey="f2h" /></h2>
<p><PublicCopy page="about" copyKey="f2p" /></p>
<InternalLink className="lnk" href="/">
<span><PublicCopy page="about" copyKey="f2l" /></span>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M5 12h14M13 6l6 6-6 6">
</path>
</svg>
</InternalLink>
</div>
<div className="vis v2">
<img className="shot" src="/client-shots/about-backtest.webp" width="1200" height="1160" loading="lazy" alt="TETH 백테스트 데모 화면, 수익률 +8.3%와 최대 낙폭 -12.4%, 거래 시점 마커와 Holdout 봉인 구간이 표시된 가격 차트" />
</div>
</section>
<section className="feat">
<div className="tx">
<h2><PublicCopy page="about" copyKey="f3h" /></h2>
<p><PublicCopy page="about" copyKey="f3p" /></p>
<InternalLink className="lnk" href="/">
<span><PublicCopy page="about" copyKey="f3l" /></span>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M5 12h14M13 6l6 6-6 6">
</path>
</svg>
</InternalLink>
</div>
<div className="vis v3">
<img className="shot sm" src="/client-shots/about-connect.webp" width="900" height="774" loading="lazy" alt="TETH 거래소 연결 데모 화면, 잔고와 시세 조회, 주문 실행은 요청하지만 출금 권한은 요청하지 않음" />
</div>
</section>
<section className="feat">
<div className="tx">
<h2><PublicCopy page="about" copyKey="f4h" /></h2>
<p><PublicCopy page="about" copyKey="f4p" /></p>
<InternalLink className="lnk" href="/">
<span><PublicCopy page="about" copyKey="f4l" /></span>
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M5 12h14M13 6l6 6-6 6">
</path>
</svg>
</InternalLink>
</div>
<div className="vis v4">
<img className="shot" src="/client-shots/about-live.webp" width="1200" height="820" loading="lazy" alt="TETH Paper 실행 모니터링 데모 화면, 시작 후 수익 +3.2%, 최근 매수와 익절 손절 활동 내역, 슬리피지와 신호 빈도 Reality Check" />
</div>
</section>
</div>



<section className="pricing" id="pricing">
<div className="in">
<h2><PublicCopy page="about" copyKey="ph2" /></h2>
<p className="sub"><PublicCopy page="about" copyKey="psub" /></p>
<PricingPlans />
<p className="note"><PublicCopy page="about" copyKey="pnote" /></p>
</div>
</section>



<section className="csec">
<h2><PublicCopy page="about" copyKey="th2" /></h2>
<div className="trust">
<div className="row">
<b><PublicCopy page="about" copyKey="t1b" /></b>
<span><PublicCopy page="about" copyKey="t1s" /></span>
</div>
<div className="row">
<b><PublicCopy page="about" copyKey="t2b" /></b>
<span><PublicCopy page="about" copyKey="t2s" /></span>
</div>
<div className="row">
<b><PublicCopy page="about" copyKey="t3b" /></b>
<span><PublicCopy page="about" copyKey="t3s" /></span>
</div>
<div className="row">
<b><PublicCopy page="about" copyKey="t4b" /></b>
<span><PublicCopy page="about" copyKey="t4s" /></span>
</div>
</div>
</section>



<section className="csec">
<h2><PublicCopy page="about" copyKey="fh2" /></h2>
<p className="faq-preview">출시 제품을 설명하는 원본 카피입니다. 현재 Mock 화면에서는 실제 자동매매·거래소 연결이 실행되지 않습니다.</p>
<div className="faq" id="faq">
<details>
<summary>
<span><PublicCopy page="about" copyKey="q1" /></span>
<span className="x">{"＋"}</span>
</summary>
<div className="a"><PublicCopy page="about" copyKey="a1" /></div>
</details>
<details>
<summary>
<span><PublicCopy page="about" copyKey="q2" /></span>
<span className="x">{"＋"}</span>
</summary>
<div className="a"><PublicCopy page="about" copyKey="a2" /></div>
</details>
<details>
<summary>
<span><PublicCopy page="about" copyKey="q3" /></span>
<span className="x">{"＋"}</span>
</summary>
<div className="a"><PublicCopy page="about" copyKey="a3" /></div>
</details>
<details>
<summary>
<span><PublicCopy page="about" copyKey="q4" /></span>
<span className="x">{"＋"}</span>
</summary>
<div className="a"><PublicCopy page="about" copyKey="a4" /></div>
</details>
<details>
<summary>
<span><PublicCopy page="about" copyKey="q5" /></span>
<span className="x">{"＋"}</span>
</summary>
<div className="a"><PublicCopy page="about" copyKey="a5" /></div>
</details>
<details>
<summary>
<span><PublicCopy page="about" copyKey="q6" /></span>
<span className="x">{"＋"}</span>
</summary>
<div className="a"><PublicCopy page="about" copyKey="a6" /></div>
</details>
<details>
<summary>
<span><PublicCopy page="about" copyKey="q7" /></span>
<span className="x">{"＋"}</span>
</summary>
<div className="a"><PublicCopy page="about" copyKey="a7" /></div>
</details>
</div>
</section>



<section className="final">
<h2><PublicCopy page="about" copyKey="Fh2" /></h2>
<p className="sub"><PublicCopy page="about" copyKey="Fsub" /></p>
<InternalLink className="cta" href="/"><PublicCopy page="about" copyKey="cta" /></InternalLink>
</section>

</main>
<footer className="ft">
<div className="top">
<span className="brand">
<img src="/teth-logo.png" alt="" style={{"width":"18px","height":"auto","display":"block"}} />{"TETH"}</span>
<InternalLink href="/"><PublicCopy page="about" copyKey="cta" /></InternalLink>
<InternalLink href="/about/"><PublicCopy page="about" copyKey="title" /></InternalLink>
<InternalLink href="/download/"><PublicCopy page="about" copyKey="navDl" /></InternalLink>
<InternalLink href="/policies/#privacy"><PublicCopy page="about" copyKey="polPriv" /></InternalLink>
<InternalLink href="/policies/#terms"><PublicCopy page="about" copyKey="polTerms" /></InternalLink>
</div>
<span><PublicCopy page="about" copyKey="copy" /></span>
</footer>



</>}
    {page === 'download' && <>
<header className="hd">
<InternalLink className="brand" href="/">
<img src="/teth-logo.png" alt="" style={{"width":"21px","height":"auto","display":"block"}} />{"\n    TETH\n  "}</InternalLink>
<span className="sp">
</span>
<nav>
<InternalLink href="/about/"><PublicCopy page="download" copyKey="navAbout" /></InternalLink>
<InternalLink href="/download/"><PublicCopy page="download" copyKey="navDl" /></InternalLink>
</nav>
<InternalLink className="login" href="/"><PublicCopy page="download" copyKey="login" /></InternalLink>
</header>

<main className="wrap" id="site-main" tabIndex={-1}>
<div className="cols">
<div className="txt">
<h1>{language === 'ko' ? <><span>TETH를 </span><span>다운로드하세요</span></> : <PublicCopy page="download" copyKey="h1" />}</h1>
<h2><PublicCopy page="download" copyKey="h2" /></h2>
<p className="body"><PublicCopy page="download" copyKey="body" /></p>
<div className="stores">
<div className="store" id="store-android">
<div className="head">
<svg viewBox="0 0 24 24" aria-hidden="true">
<path fill="#34A853" d="M3.6 2.2 13.7 12 3.6 21.8c-.4-.2-.6-.6-.6-1.2V3.4c0-.6.2-1 .6-1.2z">
</path>
<path fill="#FBBC05" d="m13.7 12 3.2 3.1-3.9 2.2-6.5 3.7c-.3.2-.6.2-.9.1z">
</path>
<path fill="#EA4335" d="M13.7 12 5.6 2.9c.3-.1.6-.1.9.1l6.5 3.7 3.9 2.2z">
</path>
<path fill="#4285F4" d="m16.9 8.9 3.4 1.9c.9.5.9 1.9 0 2.4l-3.4 1.9L13.7 12z">
</path>
</svg>
<span>Android 앱을 준비하고 있습니다.</span>
</div>
<div className="qr todo">출시 준비 중<br />곧 만나요</div>
</div>
<div className="store" id="store-ios">
<div className="head">
<svg viewBox="0 0 24 24" fill="#e3e3e3" aria-hidden="true">
<path d="M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.93-2.13-1.67-.17-3.26.98-4.1.98-.85 0-2.16-.96-3.55-.93-1.82.03-3.5 1.06-4.44 2.69-1.9 3.29-.49 8.16 1.36 10.83.9 1.3 1.98 2.77 3.39 2.72 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.29-2.64 1.04-1.52 1.47-2.99 1.49-3.06-.03-.02-2.86-1.1-2.9-4.34zM14.34 4.56c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z">
</path>
</svg>
<span>iOS 앱을 준비하고 있습니다.</span>
</div>
<div className="qr todo">출시 준비 중<br />곧 만나요</div>
</div>
<InternalLink className="web-start" href="/">웹에서 TETH 시작하기 →</InternalLink>
</div>
</div>
<DownloadPreview />
</div>
</main>

<footer className="bar">
<span className="logo">
<img src="/teth-logo.png" alt="" style={{"width":"16px","height":"auto","display":"block"}} />{"TETH"}</span>
<InternalLink href="/"><PublicCopy page="about" copyKey="cta" /></InternalLink>
<InternalLink href="/about/"><PublicCopy page="download" copyKey="navAbout" /></InternalLink>
<InternalLink href="/policies/"><PublicCopy page="download" copyKey="pol" /></InternalLink>
<span className="fine">
<PublicCopy page="download" copyKey="fine" /></span>
</footer>




</>}
    {page === 'policies' && <>
<header className="hd">
<div className="row1">
<InternalLink className="brand" href="/">
<img src="/teth-logo.png" alt="" style={{"width":"24px","height":"auto","display":"block"}} />{"\n      TETH\n    "}</InternalLink>
<span className="ptitle">{"개인정보 보호 및 약관"}</span>
<span className="sp">
</span>
<InternalLink className="login" href="/">{"로그인"}</InternalLink>
</div>
<nav className="tabs" id="tabs">
<InternalLink href="/policies/#overview" aria-current={policyTab === "overview" ? 'page' : undefined} className={policyTab === "overview" ? 'on' : ''} data-v="overview">{"개요"}</InternalLink>
<InternalLink href="/policies/#privacy" aria-current={policyTab === "privacy" ? 'page' : undefined} className={policyTab === "privacy" ? 'on' : ''} data-v="privacy">{"개인정보처리방침"}</InternalLink>
<InternalLink href="/policies/#terms" aria-current={policyTab === "terms" ? 'page' : undefined} className={policyTab === "terms" ? 'on' : ''} data-v="terms">{"서비스 약관"}</InternalLink>
<InternalLink href="/policies/#technologies" aria-current={policyTab === "technologies" ? 'page' : undefined} className={policyTab === "technologies" ? 'on' : ''} data-v="technologies">{"기술"}</InternalLink>
<InternalLink href="/policies/#faq" aria-current={policyTab === "faq" ? 'page' : undefined} className={policyTab === "faq" ? 'on' : ''} data-v="faq">{"FAQ"}</InternalLink>
</nav>
</header>

<main id="site-main" tabIndex={-1}>
<PrototypeNotice policy />
<section className={policyTab === "overview" ? 'view on' : 'view'} id="v-overview">
<div className="ov">
<div className="cell">
<h2>{"개인정보처리방침"}</h2>
<p>{"TETH가 수집하는 정보, 수집 이유, 정보 사용 방법, 정보 검토 및 업데이트 방법에 대해 설명합니다."}</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#privacy">{"TETH 개인정보처리방침 읽기"}</InternalLink>
</div>
</div>
<div className="cell">
<h2>{"서비스 약관"}</h2>
<p>{"TETH 서비스를 이용할 때 사용자가 동의하는 규정을 설명합니다."}</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#terms">{"TETH 서비스 약관 읽기"}</InternalLink>
</div>
</div>
<div className="cell">
<h2>{"TETH 안전 센터"}</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7z">
</path>
<path d="M8.5 12l2.5 2.5 4.5-4.5">
</path>
</svg>
<div>
<p style={{"marginTop":"0px"}}>{"모두를 위한 제품을 만든다는 것은 제품을 사용하는 모든 사람을 보호한다는 의미입니다. 거래소 API 키 암호화, 출금 권한 미요청, 1회 손실 한도 등 TETH에 내장된 보안 기능과 개인정보 보호 설정, 도구에 관해 자세히 알아보세요."}</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#technologies">{"보안을 위한 TETH의 노력 알아보기"}</InternalLink>
</div>
</div>
</div>
</div>
<div className="cell">
<h2>{"TETH 계정"}</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<circle cx="12" cy="12" r="9.2">
</circle>
<circle cx="12" cy="9.6" r="3">
</circle>
<path d="M6.4 18.4c1.2-2.6 3.2-3.9 5.6-3.9s4.4 1.3 5.6 3.9">
</path>
</svg>
<div>
<p style={{"marginTop":"0px"}}>{"계정을 한 곳에서 관리하고 안전하게 보호하세요. TETH 계정에서 데이터와 개인정보, 거래소 연결을 보호하는 데 필요한 설정 및 도구에 쉽게 액세스할 수 있습니다."}</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/">{"TETH 계정 확인하기"}</InternalLink>
</div>
</div>
</div>
</div>
<div className="cell">
<h2>{"TETH의 개인정보 보호 및 보안 원칙"}</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<rect x="4" y="10" width="16" height="10" rx="2">
</rect>
<path d="M8 10V7a4 4 0 0 1 8 0v3">
</path>
</svg>
<div>
<p style={{"marginTop":"0px"}}>{"TETH는 모두를 지켜 주는 투자 연구 환경을 구축합니다. TETH의 제품, 프로세스, 직원은 다음 원칙을 바탕으로 사용자의 데이터와 자산 접근 권한을 비공개로 안전하게 유지합니다."}</p>
<div className="lnk-row">
<InternalLink className="lnk" href="/policies/#privacy">{"TETH의 개인정보 보호 및 보안 원칙 살펴보기"}</InternalLink>
</div>
</div>
</div>
</div>
<div className="cell">
<h2>{"TETH 제품 개인정보 보호 가이드"}</h2>
<div className="ico-row">
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14">
</path>
<path d="M4 19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2">
</path>
<path d="M8 8h8M8 12h5">
</path>
</svg>
<div>
<p style={{"marginTop":"0px"}}>{"전략 연구, 백테스트, 실행 및 모니터링을 사용할 때 개인정보와 사용 기록을 제어하고 보호할 권한은 사용자 자신에게 있습니다. "}<InternalLink className="lnk" href="/policies/#privacy">{"TETH 제품 개인정보 보호 가이드"}</InternalLink>{"를 이용하면 TETH 제품에서 제공하는 개인정보 보호 기능을 관리하는 방법을 알아볼 수 있습니다."}</p>
</div>
</div>
</div>
</div>
</section>
<section className={policyTab === "privacy" ? 'view on' : 'view'} id="v-privacy">
<div className="doc">
<nav className="toc" data-toc="">
<InternalLink href="/policies/#p-intro" data-t="p-intro"  className={activeSection === "p-intro" ? 'on' : ''}>{"소개"}</InternalLink>
<InternalLink href="/policies/#p-collect" data-t="p-collect" className={activeSection === "p-collect" ? 'on' : ''}>{"TETH에서 수집하는 정보"}</InternalLink>
<InternalLink href="/policies/#p-why" data-t="p-why" className={activeSection === "p-why" ? 'on' : ''}>{"TETH에서 데이터를 수집하는 이유"}</InternalLink>
<InternalLink href="/policies/#p-settings" data-t="p-settings" className={activeSection === "p-settings" ? 'on' : ''}>{"개인정보 보호 설정"}</InternalLink>
<InternalLink href="/policies/#p-share" data-t="p-share" className={activeSection === "p-share" ? 'on' : ''}>{"정보 공유"}</InternalLink>
<InternalLink href="/policies/#p-secure" data-t="p-secure" className={activeSection === "p-secure" ? 'on' : ''}>{"정보 보안 유지"}</InternalLink>
<InternalLink href="/policies/#p-export" data-t="p-export" className={activeSection === "p-export" ? 'on' : ''}>{"정보 내보내기 및 삭제"}</InternalLink>
<InternalLink href="/policies/#p-retain" data-t="p-retain" className={activeSection === "p-retain" ? 'on' : ''}>{"정보 유지"}</InternalLink>
<InternalLink href="/policies/#p-comply" data-t="p-comply" className={activeSection === "p-comply" ? 'on' : ''}>{"규정 준수"}</InternalLink>
</nav>
<div className="docmain">
<div className="inner">
<div className="hero-ill">
<svg width="440" height="240" viewBox="0 0 440 240" fill="none" aria-hidden="true">
<circle cx="150" cy="120" r="52" stroke="#5f6368" strokeWidth="3">
</circle>
<path d="M188 158l34 34" stroke="#5f6368" strokeWidth="3" strokeLinecap="round">
</path>
<path d="M220 60l34 18v26c0 20-15 32-34 38-19-6-34-18-34-38V78z" fill="#0b57d0">
</path>
<path d="M210 104l8 8 14-14" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
</path>
<circle cx="318" cy="118" r="40" stroke="#5f6368" strokeWidth="3">
</circle>
<path d="M318 96c4 12 10 18 22 22-12 4-18 10-22 22-4-12-10-18-22-22 12-4 18-10 22-22z" fill="#FFB60A">
</path>
<rect x="120" y="196" width="200" height="3" rx="1.5" fill="#3c4043">
</rect>
</svg>
</div>
<div className="label" id="p-intro">{"TETH 개인정보처리방침"}</div>
<p className="intro">{"TETH는 사용자들이 신뢰를 바탕으로 정보를 제공한다는 것을 잘 알고 있습니다. TETH는 사용자의 신뢰에 대한 막중한 책임을 인지하며 최선을 다해 개인정보를 보호하고 사용자가 직접 제어할 수 있도록 노력하고 있습니다."}</p>
<p>{"이 개인정보처리방침은 TETH에서 수집하는 정보의 유형, 정보를 수집하는 이유, 정보를 업데이트, 관리, 내보내기, 삭제하는 방식에 대한 이해를 돕기 위한 것입니다."}</p>
<div className="callout">
<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#a8c7fa" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
<path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7z">
</path>
<circle cx="12" cy="10" r="2.4">
</circle>
<path d="M8.4 15.6c.9-1.8 2.1-2.6 3.6-2.6s2.7.8 3.6 2.6">
</path>
</svg>
<div>
<b>{"연결 권한 진단"}</b>{"\n          거래소 연결 권한을 확인하려고 하나요?\n          "}<div>
<InternalLink className="lnk" href="/">{"연결 권한 확인하기"}</InternalLink>
</div>
</div>
</div>
<p className="meta">{"원본 초안 작성일: 2026년 9월 4일"}</p>
<div className="hr">
</div>
<h2 id="p-collect">{"TETH에서 수집하는 정보"}</h2>
<p>{"TETH는 서비스를 제공하기 위해 필요한 최소한의 정보를 수집합니다."}</p>
<ul>
<li>
<b>{"계정 정보"}</b>{", 이메일 주소, 로그인 방식(Google, Apple, 이메일), 프로필 이름."}</li>
<li>
<b>{"거래소 연결 정보"}</b>{", 사용자가 직접 등록한 API 키. 키는 암호화되어 저장되며, 조회, 주문 권한만 사용합니다. "}<b>{"출금 권한은 어떤 경우에도 요청하거나 저장하지 않습니다."}</b>
</li>
<li>
<b>{"이용 기록"}</b>{", 생성한 전략, 백테스트 결과, 실행, 모니터링 기록. 서비스 제공과 복기 기능을 위해 보관됩니다."}</li>
<li>
<b>{"기기 및 로그 정보"}</b>{", 접속 기기 유형, 브라우저, IP 주소, 오류 로그. 보안과 품질 개선에 사용됩니다."}</li>
</ul>
<h2 id="p-why">{"TETH에서 데이터를 수집하는 이유"}</h2>
<p>{"수집한 정보는 다음 목적에만 사용됩니다: 전략 연구, 검증, 실행 서비스 제공, 계정 보호와 이상 접근 탐지, 서비스 품질 개선, 법적 의무 이행. TETH는 사용자의 데이터를 광고 목적으로 제3자에게 판매하지 않습니다."}</p>
<h2 id="p-settings">{"개인정보 보호 설정"}</h2>
<p>{"계정 설정에서 프로필 정보 수정, 거래소 연결 해제, 알림 수신 여부를 언제든 변경할 수 있습니다. 거래소 연결을 해제하면 저장된 API 키는 즉시 파기됩니다."}</p>
<h2 id="p-share">{"정보 공유"}</h2>
<p>{"TETH는 다음 경우를 제외하고 개인정보를 외부에 공유하지 않습니다: 사용자가 직접 동의한 경우, 주문 실행을 위해 연결된 거래소에 요청을 전달하는 경우, 법령에 따라 요구되는 경우."}</p>
<h2 id="p-secure">{"정보 보안 유지"}</h2>
<p>{"모든 데이터는 전송 구간과 저장 시 암호화됩니다. API 키는 별도의 암호화 저장소에 보관되며 내부 직원도 원문에 접근할 수 없습니다. 비정상적인 접근이 감지되면 자동으로 실행이 일시 정지되고 사용자에게 알립니다."}</p>
<h2 id="p-export">{"정보 내보내기 및 삭제"}</h2>
<p>{"사용자는 언제든 자신의 전략, 백테스트, 거래 기록을 내보낼 수 있으며, 계정 삭제를 요청하면 법적 보관 의무가 있는 정보를 제외한 모든 데이터가 30일 이내에 파기됩니다."}</p>
<h2 id="p-retain">{"정보 유지"}</h2>
<p>{"계정이 활성 상태인 동안 서비스 제공에 필요한 정보를 보관합니다. 거래 관련 기록은 관련 법령이 정한 기간 동안 보관될 수 있습니다."}</p>
<h2 id="p-comply">{"규정 준수"}</h2>
<p>{"TETH는 개인정보 보호 관련 법령을 준수하며, 규제 당국의 적법한 요청에 협력합니다. 방침이 변경되는 경우 시행 전에 공지합니다."}</p>
</div>
</div>
</div>
</section>
<section className={policyTab === "terms" ? 'view on' : 'view'} id="v-terms">
<div className="doc">
<nav className="toc" data-toc="">
<InternalLink href="/policies/#t-intro" data-t="t-intro"  className={activeSection === "t-intro" ? 'on' : ''}>{"소개"}</InternalLink>
<InternalLink href="/policies/#t-scope" data-t="t-scope" className={activeSection === "t-scope" ? 'on' : ''}>{"본 약관에서 다루는 내용"}</InternalLink>
<InternalLink href="/policies/#t-risk" data-t="t-risk" className={activeSection === "t-risk" ? 'on' : ''}>{"투자 위험 고지"}</InternalLink>
<InternalLink href="/policies/#t-auto" data-t="t-auto" className={activeSection === "t-auto" ? 'on' : ''}>{"자동매매와 승인"}</InternalLink>
<InternalLink href="/policies/#t-use" data-t="t-use" className={activeSection === "t-use" ? 'on' : ''}>{"TETH 서비스 사용"}</InternalLink>
<InternalLink href="/policies/#t-about" data-t="t-about" className={activeSection === "t-about" ? 'on' : ''}>{"본 약관에 대하여"}</InternalLink>
</nav>
<div className="docmain">
<div className="inner">
<div className="hero-ill">
<svg width="440" height="240" viewBox="0 0 440 240" fill="none" aria-hidden="true">
<circle cx="150" cy="110" r="46" stroke="#5f6368" strokeWidth="3">
</circle>
<rect x="196" y="52" width="96" height="136" rx="14" stroke="#5f6368" strokeWidth="3">
</rect>
<path d="M224 66l20 10v14c0 11-8 17-20 21-12-4-20-10-20-21V76z" fill="#0b57d0" transform="translate(20,0)">
</path>
<path d="M214 110h60M214 126h60M214 142h38" stroke="#5f6368" strokeWidth="3" strokeLinecap="round">
</path>
<path d="M330 90v76M300 166h60M330 90l-26 40h52zM306 130a26 26 0 0 0 48 0" stroke="#FFB60A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
</path>
<rect x="120" y="196" width="200" height="3" rx="1.5" fill="#3c4043">
</rect>
</svg>
</div>
<div className="label" id="t-intro">{"TETH 서비스 약관"}</div>
<p className="meta" style={{"marginTop":"16px"}}>{"원본 초안 작성일: 2026년 9월 4일"}</p>
<p>{"국가 버전: 대한민국"}</p>
<h2 id="t-scope">{"본 약관에서 다루는 내용"}</h2>
<p className="intro">{"본 서비스 약관을 확인하는 것이 번거로울 수 있다는 점은 이해하지만, 귀하가 TETH 서비스를 사용하면서 TETH에 기대할 수 있는 부분과 TETH가 귀하에게 기대하는 부분을 명확히 해 두는 것은 중요합니다."}</p>
<p>{"본 서비스 약관에는 TETH의 사업 운영 방식, TETH에 적용되는 법률이 반영되어 있습니다. 귀하가 TETH 서비스와 상호작용하면 본 서비스 약관을 근거로 TETH와의 관계가 정의됩니다. 약관에는 다음과 같은 제목의 주제들이 포함됩니다."}</p>
<ul>
<li>
<b>{"TETH에 기대할 수 있는 사항"}</b>{". TETH가 서비스를 제공 및 개발하는 방법을 설명합니다."}</li>
<li>
<b>{"TETH가 귀하에게 기대하는 사항"}</b>{". TETH 서비스 사용과 관련된 일정한 규칙들을 정합니다."}</li>
<li>
<InternalLink className="lnk" href="/policies/#t-risk" data-t="t-risk">{"투자 위험 고지"}</InternalLink>{". 투자 손실 가능성과 백테스트의 한계, AI 판단의 한계를 설명합니다."}</li>
<li>
<InternalLink className="lnk" href="/policies/#t-about" data-t="t-about">{"본 약관에 대하여"}</InternalLink>{". 약관의 수정과 공지, 동의하지 않는 경우의 선택지를 설명합니다."}</li>
</ul>
<p>{"TETH 서비스에 액세스하거나 서비스를 이용함으로써 귀하는 본 약관에 동의하게 되므로 본 약관을 숙지하는 것이 중요합니다."}</p>
<h2 id="t-risk">{"투자 위험 고지"}</h2>
<p>{"모든 투자에는 원금 손실 위험이 있습니다. TETH가 제공하는 전략, 백테스트 결과, 시장 해설은 정보 제공을 위한 것이며 투자 조언이 아닙니다. 과거 성과는 미래 수익을 보장하지 않습니다. TETH는 AI이며 실수를 할 수 있습니다. 투자 결정과 그 결과에 대한 최종 책임은 사용자 본인에게 있습니다."}</p>
<h2 id="t-auto">{"자동매매와 승인"}</h2>
<p>{"검증을 통과한 전략은 사용자가 직접 승인한 경우에만 실행됩니다. 실행 중에도 1회 손실 한도가 적용되며, 사용자는 언제든 일시 정지하거나 종료할 수 있습니다. TETH는 조회, 주문 권한만 사용하며 출금 권한을 요청하지 않습니다."}</p>
<h2 id="t-use">{"TETH 서비스 사용"}</h2>
<p>{"귀하는 관련 법령과 본 약관을 준수하는 범위에서 서비스를 이용할 수 있습니다. 서비스의 오남용, 시스템에 대한 무단 접근, 타인의 계정 사용은 금지됩니다."}</p>
<h2 id="t-about">{"본 약관에 대하여"}</h2>
<p>{"TETH는 서비스 개선이나 법령 변경에 따라 본 약관을 수정할 수 있으며, 중대한 변경은 시행 전에 공지합니다. 변경에 동의하지 않는 경우 서비스 이용을 중단하고 계정을 삭제할 수 있습니다."}</p>
</div>
</div>
</div>
</section>
<section className={policyTab === "technologies" ? 'view on' : 'view'} id="v-technologies">
<div className="doc">
<nav className="toc" data-toc="">
<InternalLink href="/policies/#x-backtest" data-t="x-backtest"  className={activeSection === "x-backtest" ? 'on' : ''}>{"백테스트 엔진"}</InternalLink>
<InternalLink href="/policies/#x-holdout" data-t="x-holdout" className={activeSection === "x-holdout" ? 'on' : ''}>{"홀드아웃 검증"}</InternalLink>
<InternalLink href="/policies/#x-engine" data-t="x-engine" className={activeSection === "x-engine" ? 'on' : ''}>{"AI 리서치 엔진"}</InternalLink>
<InternalLink href="/policies/#x-keys" data-t="x-keys" className={activeSection === "x-keys" ? 'on' : ''}>{"TETH의 API 키 처리 방식"}</InternalLink>
<InternalLink href="/policies/#x-retain" data-t="x-retain" className={activeSection === "x-retain" ? 'on' : ''}>{"TETH에서 수집한 데이터를 보관하는 방법"}</InternalLink>
</nav>
<div className="docmain">
<div className="inner" style={{"paddingTop":"64px"}}>
<div className="label">{"기술"}</div>
<p>{"TETH는 종종 기존 기술의 한계를 뛰어넘는 아이디어와 제품을 추구합니다. TETH는 사회적 책임을 중요시하는 기업으로서 혁신과 사용자에 대한 적절한 수준의 개인정보 보호 및 보안이 균형을 이룰 수 있도록 노력합니다. TETH의 "}<InternalLink className="lnk" href="/policies/#privacy">{"개인정보 보호원칙"}</InternalLink>{"은 회사의 각 단계에서 결정을 내릴 때 올바른 기준을 제시합니다."}</p>
<h2 id="x-backtest">{"백테스트 엔진"}</h2>
<p>{"전략은 수년치 실제 시장 데이터 위에서 검증됩니다. 수수료와 슬리피지를 포함해 계산하며, 모든 수치는 재현 가능한 방식으로 기록됩니다."}</p>
<h2 id="x-holdout">{"홀드아웃 검증"}</h2>
<p>{"과최적화를 막기 위해 일부 기간의 데이터는 연구 단계에서 봉인됩니다. 봉인은 최종 검증 단계에서만 해제되며, 해제 이후에는 전략 수정에 사용되지 않습니다."}</p>
<h2 id="x-engine">{"AI 리서치 엔진"}</h2>
<p>{"전략 구조화, 수치 검증, 리스크 검토, 설명 생성에 서로 다른 특화 엔진이 사용됩니다. 서로의 결론을 반박하도록 설계되어 있으며, 의견이 불일치하는 경우 그대로 사용자에게 공개합니다."}</p>
<h2 id="x-keys">{"TETH의 API 키 처리 방식"}</h2>
<p>{"거래소 API 키는 등록 즉시 암호화되어 별도 저장소에 보관됩니다. 조회, 주문 권한만 사용하며 출금 권한은 요청하지 않습니다. 연결 해제 시 키는 즉시 파기됩니다."}</p>
<h2 id="x-retain">{"TETH에서 수집한 데이터를 보관하는 방법"}</h2>
<p>{"전략, 백테스트, 거래 기록은 서비스 제공과 복기 기능을 위해 계정이 활성인 동안 보관되며, 자세한 내용은 "}<InternalLink className="lnk" href="/policies/#privacy">{"개인정보처리방침"}</InternalLink>{"을 참고하세요."}</p>
</div>
</div>
</div>
</section>
<section className={policyTab === "faq" ? 'view on' : 'view'} id="v-faq">
<div className="faqv">
<div className="inner">
<h2>{"TETH는 내 개인정보를 어떻게 안전하게 보호하나요?"}</h2>
<p>{"보안과 개인정보는 본인에게도 중요하지만 TETH에게도 중요한 문제입니다. TETH는 전송, 저장 구간 암호화, API 키 분리 보관, 이상 접근 자동 차단 등 강력한 보안을 제공하여 개인정보가 안전하게 보호되고 있으며 원할 때 언제든지 액세스할 수 있다는 믿음을 주는 것을 최우선으로 생각합니다."}</p>
<p>
<InternalLink href="/policies/#technologies">{"TETH 안전 기술"}</InternalLink>{"을 확인하여 TETH가 사용자의 정보를 보호하는 방식에 대해 자세히 알아볼 수 있습니다."}</p>
<h2>{"TETH는 내 자산에 접근할 수 있나요?"}</h2>
<p>{"아니요. TETH는 거래소 API의 조회, 주문 권한만 사용하며, 출금 권한은 어떤 경우에도 요청하거나 저장하지 않습니다. 따라서 TETH가 사용자의 자산을 다른 곳으로 옮기는 것은 기술적으로 불가능합니다."}</p>
<h2>{"백테스트 결과를 믿어도 되나요?"}</h2>
<p>{"백테스트는 과거 데이터에 대한 검증이며 미래 수익을 보장하지 않습니다. TETH는 홀드아웃 봉인과 Paper 검증 단계를 통해 과최적화를 줄이지만, 모든 투자에는 손실 위험이 있습니다."}</p>
<h2>{"내 데이터를 삭제하려면 어떻게 하나요?"}</h2>
<p>{"계정 설정에서 계정 삭제를 요청하면 법적 보관 의무가 있는 정보를 제외한 모든 데이터가 30일 이내에 파기됩니다. 거래소 연결만 해제하는 것도 가능하며, 이 경우 API 키는 즉시 파기됩니다."}</p>
<h2>{"자동매매를 중단하려면 어떻게 하나요?"}</h2>
<p>{"실행 중 화면에서 언제든 일시 정지 또는 전략 종료를 누를 수 있습니다. 종료 시 보유 포지션은 현재가로 정리되고 이후 새 주문은 발생하지 않습니다."}</p>
<h2>{"약관이나 방침이 바뀌면 어떻게 알 수 있나요?"}</h2>
<p>{"중대한 변경은 시행 전에 서비스 내 공지와 이메일로 알려드립니다. 이전 버전은 보관처리된 버전에서 확인할 수 있습니다."}</p>
</div>
</div>
</section>
</main>

<footer className="ft">
<InternalLink href="/">{"TETH"}</InternalLink>
<InternalLink href="/about/">{"TETH 정보"}</InternalLink>
<InternalLink href="/download/">TETH 앱 다운로드</InternalLink>
<InternalLink href="/policies/#privacy">{"개인정보처리방침"}</InternalLink>
<InternalLink href="/policies/#terms">{"약관"}</InternalLink>
<span style={{"marginLeft":"auto","color":"var(--t2,#9aa0a6)","fontSize":"13px"}}>{"한국어"}</span>
</footer>




</>}
    <SiteHelp key={page} />
  </div>
}
