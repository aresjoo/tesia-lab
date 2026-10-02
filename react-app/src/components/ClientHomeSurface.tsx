import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { ClientComposer } from './ClientComposer'
import { ClientHomeGallery, ClientHomeTemplateSelection } from './ClientHomeGallery'
import { CLIENT_HOME_HEADLINES, CLIENT_HOME_SUBCOPY, getTemplateText, type HomeTemplateSelection } from '../client-home-gallery'
import { useClientPreferences } from '../client-preferences'
import { InternalLink } from './InternalLink'
import '../client-home-layout.css'

/** Shared source presentation. It cannot authenticate, approve or start a server job. */
export function ClientHomeSurface({ value, inputRef, onChange, onSend, onLogin, onSignup, signedIn, selection, onSelectionChange, disabled = false, maxLength, animate = false, children, composerNotice, onBandHeight }: {
  value: string; inputRef: RefObject<HTMLTextAreaElement | null>; onChange: (value: string) => void; onSend: () => void
  onLogin: () => void; onSignup: () => void; signedIn: boolean; selection: HomeTemplateSelection
  onSelectionChange: (selection: HomeTemplateSelection) => void; disabled?: boolean; maxLength?: number; animate?: boolean
  children?: ReactNode; composerNotice?: ReactNode; onBandHeight?: (height: number) => void
}) {
  const { language, t } = useClientPreferences()
  const [seed] = useState(() => Math.random())
  const [composerHeight, setComposerHeight] = useState(58)
  const [bandHeight, setBandHeight] = useState(200)
  const band = useRef<HTMLDivElement>(null)
  const pool = CLIENT_HOME_HEADLINES[language]
  const greeting = pool[Math.floor(seed * pool.length)]
  const template = getTemplateText(selection, language)
  useEffect(() => {
    if (!band.current) return
    let frame = 0
    const element = band.current
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { const height = Math.ceil(element.getBoundingClientRect().height); setBandHeight(height); onBandHeight?.(height) })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element); measure()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [onBandHeight])
  return <div className={`client-home-content client-gallery-home ${value.trim() ? 'has-input' : ''} ${animate ? 'entr' : ''}`} style={{ '--client-composer-height': `${composerHeight}px`, '--client-band-height': `${bandHeight}px` } as CSSProperties}>
    <h1 className="client-hero-title" id="landing-title">{greeting.split('\n').map((line, i) => <span key={i}>{line}</span>)}</h1>
    <p className="client-hero-subtitle">{CLIENT_HOME_SUBCOPY[language].split('\n').map((line, i) => <Fragment key={i}>{i > 0 && <> <br className="sbr" /></>}{line}</Fragment>)}</p>
    {children}
    <ClientHomeGallery selection={selection} onChange={onSelectionChange} animate={animate} disabled={disabled} />
    <div className="client-home-band" ref={band}>
      {!signedIn && <div className="client-free-row"><button type="button" onClick={onSignup}><span>{t('auth.free')}</span></button></div>}
      {composerNotice}
      <ClientComposer value={value} inputRef={inputRef} signedIn={signedIn} disabled={disabled} maxLength={maxLength} onChange={onChange} onSend={onSend} onLogin={onLogin} onHeightChange={setComposerHeight}
        contextPrompt={template?.q} canSend={Boolean(value.trim() || template)} contextChips={<ClientHomeTemplateSelection selection={selection} onChange={onSelectionChange} disabled={disabled} onEmptyFocus={() => inputRef.current?.focus()} />} />
      <p className="client-home-terms">{t('home.terms').split(/(\{[TP]\}.*?\{\/\}|\{BR\})/g).map((part, i) => {
        if (part === '{BR}') return <Fragment key={i}>{' '}<br className="tbr" /></Fragment>
        const link = part.match(/^\{([TP])\}(.*?)\{\/\}$/)
        return link ? <InternalLink key={i} href={`/policies/#${link[1] === 'T' ? 'terms' : 'privacy'}`}>{link[2]}</InternalLink> : <Fragment key={i}>{part}</Fragment>
      })}</p>
    </div>
  </div>
}
