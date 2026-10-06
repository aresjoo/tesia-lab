import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useClientPreferences } from '../client-preferences'
import { shellText } from '../client-shell-copy'
import { feedbackText } from '../client-feedback-copy'
import { researchNavigationLabel } from '../client-research-copy'
import settingsCopy from '../client-settings-copy.json'
import { InternalLink } from './InternalLink'
import { ClientProviderMark as ProviderMark } from './ClientProviderMark'
import { activeClientSurfaceSelector, useClientSurfacePresence } from '../use-client-surface-presence'
import { useClientPreviewToast } from '../use-client-preview-toast'
import '../client-account-ui.css'

export type ClientProfile = { name: string; email: string }

function visibleControl(element: HTMLElement) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible' && !element.closest('[inert],[hidden]')
}

// These are presentation-only components. They never authenticate, upload, persist
// credentials, or send email. The host supplies the visible development boundary.
function useAccountSurface(onClose: () => void, step?: string, returnFocus?: RefObject<HTMLElement | null>, active = true) {
  const ref = useRef<HTMLDivElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  const close = useRef(onClose)
  const focusLifetime = useRef({ generation: 0 })
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    if (!active) { origin.current = null; return }
    const lifetime = focusLifetime.current
    const generation = ++lifetime.generation
    // StrictMode replays effects after focusFirst has already focused this
    // surface. Keep the original entry point instead of capturing its input.
    if (!origin.current && document.activeElement instanceof HTMLElement) origin.current = document.activeElement
    const previous = origin.current
    const originHref = location.href
    const originDocument = location.origin + location.pathname + location.search
    const logicalTarget = returnFocus?.current ?? null
    // Unlike a DOM cleanup ref, this host-owned slot is intentionally live:
    // owner replacement or a new entry invalidates the old restoration intent.
    const ownsReturnTarget = () => !returnFocus || returnFocus.current === logicalTarget
    const surface = ref.current
    const focusFirst = () => Array.from(surface?.querySelectorAll<HTMLElement>('[data-autofocus], input:not(:disabled), textarea, button:not(:disabled), a[href]') ?? []).find(visibleControl)?.focus()
    focusFirst()
    const key = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab' || !surface) return
      const elements = [...surface.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea, [tabindex="0"]')].filter(visibleControl)
      const first = elements[0], last = elements.at(-1)
      if (!first) { event.preventDefault(); surface.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !surface.contains(document.activeElement))) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && (document.activeElement === last || !surface.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      // Wait for the host's inert cleanup. A replaced settings submenu is no
      // longer a valid focus target; never steal focus from its next surface.
      queueMicrotask(() => {
        // A host-owned entry can outlive a background history selection that
        // removes its hash. Owner/new-entry invalidation still wins, and a
        // document navigation or newly focused surface must never be stolen.
        const clearedBackgroundRoute = returnFocus && !location.hash && location.origin + location.pathname + location.search === originDocument
        if ((location.href !== originHref && !clearedBackgroundRoute) || lifetime.generation !== generation || !ownsReturnTarget() || document.getElementById('root')?.inert || document.querySelector(activeClientSurfaceSelector)) return
        const current = document.activeElement
        if (current instanceof HTMLElement && current !== document.body && !surface?.contains(current) && current !== previous && visibleControl(current)) return
        const visible = (element: HTMLElement | null) => element !== document.body && element !== document.documentElement && element?.isConnected && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert],[hidden]')
        const fallback = document.querySelector<HTMLElement>(matchMedia('(max-width:860px)').matches ? '.client-hamburger' : '.client-sidebar-bottom button')
        const target = visible(logicalTarget) ? logicalTarget : visible(previous) ? previous : visible(fallback) ? fallback : null
        target?.focus({ preventScroll: true })
      })
    }
  }, [returnFocus, active])
  useEffect(() => {
    if (!active) return
    // An explicit field wins over earlier inputs (9fb authAgeShow selects age).
    const target = Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-autofocus]') ?? []).find(visibleControl)
      ?? Array.from(ref.current?.querySelectorAll<HTMLElement>('input:not(:disabled), textarea') ?? []).find(visibleControl)
    target?.focus()
  }, [step, active])
  return ref
}

function AccountIcon({ name }: { name: 'settings' | 'feedback' | 'help' | 'support' | 'download' | 'globe' | 'arrow' | 'image' | 'insight' | 'brokers' }) {
  const content: Record<typeof name, ReactNode> = {
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8L9.4 5.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></>,
    insight: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
    brokers: <><path d="M3 21h18M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6M9 11h.01M15 11h.01" /></>,
    feedback: <><path d="M4 5h16v12H8l-4 4z" /><path d="M12 8.2v.4M12 11v3" /></>,
    help: <><rect x="5" y="3" width="16" height="16" rx="3" /><path d="M5 7H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1" opacity=".6" /><path d="M10.5 8.6a2.6 2.6 0 1 1 3.6 2.4c-.8.35-1.1.8-1.1 1.6M13 15.4v.2" /></>,
    support: <><path d="M4.5 13a7.5 7.5 0 0 1 15 0" /><rect x="3" y="12.5" width="4" height="6.5" rx="2" /><rect x="17" y="12.5" width="4" height="6.5" rx="2" /><path d="M19 19v.4a3 3 0 0 1-3 3h-3" /></>,
    download: <><rect x="6" y="2.5" width="12" height="19" rx="2.6" /><path d="M12 6.2v6.6M9.4 10.4l2.6 2.4 2.6-2.4M10.4 18.6h3.2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9S14.6 18.5 12 21c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" /></>,
    arrow: <path d="M9 6l6 6-6 6" />,
    image: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 15l5-5 4 4 3-3 6 6" /><circle cx="9" cy="9" r="1.3" /></>,
  }
  return <svg width={name === 'arrow' ? 14 : 18} height={name === 'arrow' ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'arrow' ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content[name]}</svg>
}

export function ClientSettingsMenu({ open = true, anchorTop, returnFocus, onClose, onSettings, onInsight, onBrokers, onFeedback, onHelp, onDownload, signedIn, onPlan, onLogout, logoutDisabled = false }: {
  open?: boolean; anchorTop?: number; returnFocus?: RefObject<HTMLElement | null>; onClose: () => void; onSettings: () => void; onInsight: () => void; onBrokers: () => void; onFeedback: () => void; onHelp: () => void; onDownload: () => void; signedIn: boolean; onPlan?: () => void; onLogout?: () => void; logoutDisabled?: boolean
}) {
  const { t, language } = useClientPreferences()
  const [submenu, setSubmenu] = useState<'help' | null>(null)
  const pendingFocus = useRef<'child' | 'help' | null>(null)
  const presence = useClientSurfacePresence(open)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setSubmenu(null)
  }
  const closeSubmenu = () => { pendingFocus.current = submenu; setSubmenu(null) }
  const ref = useAccountSurface(() => submenu ? closeSubmenu() : onClose(), undefined, returnFocus, open)
  useLayoutEffect(() => {
    const target = pendingFocus.current
    pendingFocus.current = null
    if (!open) return
    if (target === 'child' && submenu) Array.from(ref.current?.querySelectorAll<HTMLElement>(`#ca-sub-${submenu} button, #ca-sub-${submenu} a[href]`) ?? []).find(visibleControl)?.focus()
    else if (target && target !== 'child' && !submenu) {
      // The mobile sheet unhides its main rows in this commit. Let the browser
      // finish removing the hidden child before focusing its parent; otherwise
      // that removal can blur the newly focused control back to body.
      const previous = document.activeElement
      let frame = 0
      const deadline = performance.now() + 260
      const restore = () => {
        if (document.activeElement !== document.body && document.activeElement !== previous) return
        const parent = ref.current?.querySelector<HTMLButtonElement>(`[aria-controls="ca-sub-${target}"]`)
        if (!parent) return
        if (visibleControl(parent)) parent.focus()
        else if (performance.now() < deadline) frame = requestAnimationFrame(restore)
      }
      frame = requestAnimationFrame(restore)
      return () => cancelAnimationFrame(frame)
    }
  }, [submenu, ref, open])
  useEffect(() => {
    if (!open) return
    const breakpoint = matchMedia('(max-width:640px)')
    const restoreVisibleFocus = () => {
      const current = document.activeElement as HTMLElement | null
      if (current && ref.current?.contains(current) && visibleControl(current)) return
      const sub = ref.current?.querySelector<HTMLElement>('.gm-sub')
      Array.from((sub ?? ref.current)?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? []).find(visibleControl)?.focus({ preventScroll: true })
    }
    breakpoint.addEventListener('change', restoreVisibleFocus)
    return () => breakpoint.removeEventListener('change', restoreVisibleFocus)
  }, [ref, open])
  const [bottom, setBottom] = useState(108)
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const menu = ref.current
    // offsetHeight is unaffected by the original scale/slide entrance.
    const measure = () => {
      const trigger = returnFocus?.current
      const rect = trigger?.isConnected ? trigger.getBoundingClientRect() : null
      // The portal makes the application inert, not the anchor's geometry.
      const liveAnchor = matchMedia('(min-width:861px)').matches && rect && rect.width > 0 && rect.height > 0 ? rect : null
      const left = liveAnchor ? Math.max(10, Math.min(liveAnchor.left, innerWidth - menu.offsetWidth - 12)) : 12
      if (liveAnchor) menu.style.left = `${left}px`
      else menu.style.removeProperty('left')
      menu.style.setProperty('--client-settings-right', `${left + menu.offsetWidth + 8}px`)
      const top = liveAnchor?.top ?? anchorTop
      const desired = top !== undefined && Number.isFinite(top) ? Math.max(64, innerHeight - top + 10) : 108
      setBottom(Math.max(12, Math.min(desired, innerHeight - menu.offsetHeight - 12)))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(menu)
    if (returnFocus?.current) {
      observer.observe(returnFocus.current)
      const sidebar = returnFocus.current.closest('.client-sidebar')
      if (sidebar) observer.observe(sidebar)
    }
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [open, anchorTop, ref, returnFocus])
  const item = (name: 'help', label: string, children: ReactNode) => <div className="ca-menu-group" onMouseEnter={() => { if (matchMedia('(min-width:641px)').matches) setSubmenu(name) }} onMouseLeave={event => { if (matchMedia('(min-width:641px)').matches && !event.currentTarget.contains(document.activeElement)) setSubmenu(null) }}>
    <button className="gm-item" aria-expanded={submenu === name} aria-controls={`ca-sub-${name}`} onClick={() => { pendingFocus.current = 'child'; if (submenu === name) { pendingFocus.current = null; Array.from(ref.current?.querySelectorAll<HTMLElement>(`#ca-sub-${name} button, #ca-sub-${name} a[href]`) ?? []).find(visibleControl)?.focus() } else setSubmenu(name) }}><AccountIcon name={name} /><span>{label}</span><span className="sp" /><AccountIcon name="arrow" /></button>
    {submenu === name && <div className="gm-sub" id={`ca-sub-${name}`}><button className="ca-sub-back" onClick={closeSubmenu} aria-label={shellText(language, 'menuBack')}>‹ {label}</button>{children}</div>}
  </div>
  if (!presence.present) return null
  return <div className="ca-menu-layer" data-surface-active={open} data-surface-closing={presence.closing} inert={!open} aria-hidden={!open || undefined} onClickCapture={event => { if (!open) { event.preventDefault(); event.stopPropagation() } }} onMouseDown={event => { if (open && event.target === event.currentTarget) { event.preventDefault(); onClose() } }}>
    <div ref={ref} className={`ca-settings${submenu ? ' subopen' : ''}`} onAnimationEnd={presence.onAnimationEnd} role="dialog" aria-label={t('menu.settings')} style={{ bottom }}>
      <button className="gm-grab" onClick={onClose} aria-label={t('common.close')} />
      <button className="gm-item" data-menu-action="settings" onClick={onSettings}><AccountIcon name="settings" />{t('menu.settings')}</button>
      <button className="gm-item" data-menu-action="insight" onClick={onInsight}><AccountIcon name="insight" />{researchNavigationLabel(language, 'insight')}</button>
      <button className="gm-item" data-menu-action="brokers" onClick={onBrokers}><AccountIcon name="brokers" />{settingsCopy.brokers[language]}</button>
      <button className="gm-item" onClick={onFeedback}><AccountIcon name="feedback" />{t('menu.feedback')}</button>
      {signedIn && <><button className="gm-item" onClick={onHelp}><AccountIcon name="support" />{language === 'ko' ? '고객센터' : t('help.title').replace('24/7 ', '')}</button><button className="gm-item" onClick={onDownload}><AccountIcon name="download" />{language === 'ko' ? '앱 다운로드' : t('banner.dl')}</button></>}
      {item('help', t('menu.help'), <><InternalLink href="/policies/#terms" onClick={onClose}>{t('menu.terms')}</InternalLink><InternalLink href="/policies/#privacy" onClick={onClose}>{t('menu.privacy')}</InternalLink><InternalLink href="/about/" onClick={onClose}>{t('nav.about')}</InternalLink></>)}
      {signedIn && onPlan && <button type="button" className="gm-item" onClick={onPlan}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></svg>{shellText(language, 'usage')}</button>}
      {signedIn && <button type="button" className="gm-item" data-account-action="logout" aria-disabled={logoutDisabled || !onLogout} onClick={() => { if (!logoutDisabled && onLogout) onLogout() }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>{shellText(language, 'logout')}</button>}
    </div>
  </div>
}

export function ClientProfileMenu({ profile, onClose, onLogout, logoutDisabled = false, returnFocus }: { profile?: ClientProfile; onClose: () => void; onLogout: () => void; logoutDisabled?: boolean; returnFocus?: RefObject<HTMLElement | null> }) {
  const { language } = useClientPreferences()
  const ref = useAccountSurface(onClose, undefined, returnFocus)
  // The fallback is a neutral account label, not a supplied identity name.
  const name = profile?.name ?? shellText(language, 'account')
  return <div className="ca-menu-layer" onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }}><div className="ca-profile" ref={ref} role="dialog" aria-label={shellText(language, 'profile')}><div className="hd"><b>{name}</b>{profile?.email && <span>{profile.email}</span>}</div><button className="gsm-it" aria-disabled={logoutDisabled} onClick={() => { if (!logoutDisabled) onLogout() }}>{shellText(language, 'logout')}</button></div></div>
}

function CopyLines({ text, email }: { text: string; email?: string }) {
  return <>{text.split(/(<br\s*\/?\s*>|\{e\})/).map((part, index) => part.startsWith('<br') ? <br key={index} /> : part === '{e}' ? <b key={index}>{email}</b> : <Fragment key={index}>{part}</Fragment>)}</>
}

function PolicyCopy({ text }: { text: string }) {
  return <>{text.split(/(\{[PT]\}.*?\{\/\})/g).map((part, index) => /^\{[PT]\}/.test(part) ? <InternalLink key={index} href={`/policies/#${part.startsWith('{P}') ? 'privacy' : 'terms'}`} target="_blank" rel="noopener noreferrer">{part.slice(3, -3)}</InternalLink> : <Fragment key={index}>{part}</Fragment>)}</>
}

// Called by the send event, never used to derive a deadline during render.
const codeResendDeadline = () => Date.now() + 30_000

export function ClientAuthDialog({ mode, onClose, onComplete, onProviderNotice, returnFocus }: { mode: 'login' | 'signup'; onClose: () => void; onComplete: (profile: ClientProfile) => void; onProviderNotice?: (provider: 'Google' | 'Apple') => void; returnFocus?: RefObject<HTMLElement | null> }) {
  const { t } = useClientPreferences()
  const { toast, showToast } = useClientPreviewToast()
  const [step, setStep] = useState<'start' | 'code' | 'password-new' | 'password' | 'age'>('start')
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('')
  const [name, setName] = useState(''), [age, setAge] = useState(''), [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false), [cooldown, setCooldown] = useState(0), [loading, setLoading] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const ref = useAccountSurface(onClose, step, returnFocus)
  const id = useId()
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (completionTimer.current) clearTimeout(completionTimer.current) }, [])
  useEffect(() => {
    if (step !== 'code' || !resendAt) return
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000))
      setCooldown(remaining)
      if (!remaining) clearInterval(timer)
      return remaining
    }
    const sync = () => {
      clearInterval(timer)
      if (!document.hidden && tick() > 0) timer = setInterval(tick, 1000)
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('pageshow', sync)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', sync); window.removeEventListener('pageshow', sync) }
  }, [step, resendAt])
  function go(next: typeof step) { setError(''); setShowPassword(false); setStep(next) }
  function sendCode() {
    if (step === 'code' && cooldown > 0) return
    showToast(t(step === 'code' ? 'code.resent' : 'code.sent'))
    setPassword(''); setCode(''); setCooldown(30); setResendAt(codeResendDeadline()); go('code')
  }
  function finish() {
    setPassword(''); setCode('')
    const displayName = email.split('@')[0]
    if (mode === 'signup') { setName(displayName); go('age') }
    else onComplete({ name: displayName, email })
  }
  // Source 9fb authOauth: this is preview feedback, never a provider ACK.
  function chooseProvider(provider: 'Google' | 'Apple') {
    if (onProviderNotice) onProviderNotice(provider)
    else showToast(provider + ' 인증 완료')
    if (mode === 'signup') { setName('김도현'); go('age') }
    else onComplete({ name: '김도현', email: '' })
  }
  function fail(message: string) { setError(message); ref.current?.querySelector<HTMLInputElement>('input[data-autofocus]')?.focus() }
  function submit() {
    if (step === 'start') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { fail(t('email.err')); return }
      setEmail(email.trim()); if (mode === 'signup') go('password-new'); else sendCode()
    } else if (step === 'password-new') {
      if (!passwordRules.every(rule => rule.ok)) { fail(t('req.head')); return }
      sendCode()
    } else if (step === 'code') {
      if (!/^\d{6}$/.test(code)) { fail(t('code.err')); return }
      finish()
    } else if (step === 'password') {
      if (!password.length) { fail(t('pw.err')); return }
      finish()
    } else {
      if (!/^\d+$/.test(age) || Number(age) < 1 || Number(age) > 120) { fail('연령을 숫자로 입력해 주세요.'); return }
      if (loading) return
      setLoading(true)
      completionTimer.current = setTimeout(() => onComplete({ name: name.trim() || email.split('@')[0] || '김도현', email }), 1000)
    }
  }
  const passwordRules = [{ label: t('req.len'), ok: password.length >= 12 }, { label: t('req.num'), ok: /\d/.test(password) }, { label: t('req.spec'), ok: /[^A-Za-z0-9\s]/.test(password) }]
  const foot = <div className="au-foot"><InternalLink href="/policies/#terms" target="_blank" rel="noopener noreferrer">{t('menu.terms')}</InternalLink><span>|</span><InternalLink href="/policies/#privacy" target="_blank" rel="noopener noreferrer">{t('menu.privacy')}</InternalLink></div>
  const errorNode = error && <p className="au-err" id={`${id}-error`} role="alert">{error}</p>
  const continueButton = <button className="au-btn primary au-gap" type="submit" disabled={loading} aria-busy={loading}>{loading ? <span className="au-spin" aria-label="처리 중" /> : step === 'age' ? '시장에 입장하기' : t('auth.continue')}</button>
  const passwordField = <div className="au-field"><label className="au-label" htmlFor={`${id}-password`}>{t('pw.label')}</label><input id={`${id}-password`} data-autofocus className={`au-input has-side${error ? ' bad' : ''}`} type={showPassword ? 'text' : 'password'} value={password} onChange={event => { setPassword(event.target.value); setError('') }} autoComplete={step === 'password-new' ? 'new-password' : 'current-password'} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /><button className="au-side" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'} aria-pressed={showPassword}>{showPassword ? '🙈' : '👁'}</button></div>
  return <div className="ca-auth-veil" onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }}><div className="ca-auth" ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}><button className="au-x" onClick={onClose} aria-label={t('common.close')}>✕</button><form noValidate onSubmit={event => { event.preventDefault(); submit() }}>
    {step === 'start' && <><h2 className="au-title" id={`${id}-title`}>{t('auth.title')}</h2><p className="au-sub"><CopyLines text={t('auth.sub')} /></p><div className="au-btns">{(['Google', 'Apple'] as const).map(provider => <button className="au-btn" type="button" key={provider} onClick={() => chooseProvider(provider)}><ProviderMark provider={provider} />{t(provider === 'Google' ? 'auth.google' : 'auth.apple')}</button>)}</div><div className="au-div">{t('auth.or')}</div><div className="au-input-wrap"><input data-autofocus className={`au-input${error ? ' bad' : ''}`} type="email" aria-label={t('auth.email')} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} placeholder={t('auth.email')} autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setError('') }} /></div>{errorNode}{continueButton}<div className="au-free">{t('auth.free')}</div></>}
    {step === 'code' && <><h2 className="au-title" id={`${id}-title`}>{t('code.title')}</h2><p className="au-sub"><CopyLines text={t(mode === 'signup' ? 'code.sub.signup' : 'code.sub.login')} email={email} /></p><div className="au-input-wrap"><input data-autofocus className={`au-input${error ? ' bad' : ''}`} inputMode="numeric" maxLength={6} aria-label={t('code.ph')} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} placeholder={t('code.ph')} autoComplete="one-time-code" value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} /></div>{errorNode}{continueButton}<button className="au-textbtn" type="button" disabled={cooldown > 0} onClick={sendCode}>{cooldown > 0 ? t('code.wait').replace('{s}', String(cooldown)) : t('code.resend')}</button>{mode === 'login' && <><div className="au-div">{t('auth.or')}</div><button className="au-btn ghost au-gap" type="button" onClick={() => go('password')}>{t('code.pwbtn')}</button></>}{foot}</>}
    {(step === 'password-new' || step === 'password') && <><h2 className="au-title" id={`${id}-title`}>{t(step === 'password-new' ? 'pwnew.title' : 'pw.title')}</h2><p className="au-sub"><CopyLines text={t(step === 'password-new' ? 'pwnew.sub' : 'pw.sub')} email={email} /></p>{step === 'password-new' && <div className="au-field"><label className="au-label" htmlFor={`${id}-email-fixed`}>{t('auth.email')}</label><input className="au-input has-side" id={`${id}-email-fixed`} type="email" disabled value={email} /><button className="au-side" type="button" onClick={() => { setPassword(''); go('start') }}>{t('pwnew.edit')}</button></div>}{passwordField}{step === 'password-new' && <div className="au-req"><div>{t('req.head')}</div>{passwordRules.map(rule => <div className={`rq${rule.ok ? ' ok' : ''}`} key={rule.label}><span className="m" aria-hidden="true">{rule.ok ? '✓' : '•'}</span><span>{rule.label}</span><span className="ca-sr-only">{rule.ok ? ' 충족' : ' 미충족'}</span></div>)}</div>}{errorNode}{continueButton}<div className="au-div">{t('auth.or')}</div><button className="au-btn ghost au-gap" type="button" onClick={sendCode}>{t(step === 'password-new' ? 'pwnew.codebtn' : 'pw.codebtn')}</button>{foot}</>}
    {step === 'age' && <><h2 className="au-title" id={`${id}-title`}>연령을 알려주세요</h2><p className="au-sub">연령을 제공하면 당사 <InternalLink href="/policies/#privacy" target="_blank" rel="noopener noreferrer">개인정보 보호 정책</InternalLink>을 준수하면서 사용자님의 경험을 개인 맞춤화하고 올바른 설정을 제공하는 데 도움이 됩니다</p><div className="au-field"><label className="au-label" htmlFor={`${id}-name`}>성명</label><input className="au-input" id={`${id}-name`} value={name} autoComplete="name" maxLength={80} onChange={event => setName(event.target.value)} /></div><div className="au-field"><label className="au-label" htmlFor={`${id}-age`}>연령</label><input data-autofocus className={`au-input${error ? ' bad' : ''}`} id={`${id}-age`} type="text" inputMode="numeric" maxLength={3} value={age} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setAge(event.target.value); setError('') }} /></div>{errorNode}<p className="au-agree">“시장에 입장하기”를 클릭하면 당사 <InternalLink href="/policies/#terms" target="_blank" rel="noopener noreferrer">이용약관</InternalLink>에 동의하고<br /><InternalLink href="/policies/#privacy" target="_blank" rel="noopener noreferrer">개인정보 보호 정책</InternalLink>을 읽은 것으로 간주합니다.</p>{continueButton}</>}
  </form><div className={`ca-code-toast${toast.visible ? ' show' : ''}`} role="status" aria-live="polite" aria-atomic="true">{toast.text}</div></div></div>
}

/** Display input only, not an upload/API contract. The host must resolve only
 * after the owning service has accepted the feedback and optional image. */
export type ClientFeedbackSubmission = { message: string; attachment: File | null }
type ClientFeedbackDialogProps = {
  open?: boolean
  returnFocus?: RefObject<HTMLElement | null>
  onClose: () => void
  submission?: 'preview' | 'unavailable'
  submissionScope?: string
  onSubmit?: (submission: ClientFeedbackSubmission) => Promise<void>
}
const feedbackDeliveryCopy = {
  ko: { pending: '의견을 보내고 있어요.', failed: '의견을 보내지 못했어요. 작성한 내용과 첨부는 그대로 유지됩니다. 다시 시도해 주세요.' },
  en: { pending: 'Sending your feedback.', failed: 'Your feedback could not be sent. Your message and attachment are still here. Please try again.' },
  ja: { pending: 'ご意見を送信しています。', failed: '送信できませんでした。入力内容と添付画像は保持されています。もう一度お試しください。' },
  'zh-CN': { pending: '正在发送你的意见。', failed: '发送失败。输入内容和附件已保留，请重试。' },
  'zh-TW': { pending: '正在傳送你的意見。', failed: '傳送失敗。輸入內容與附件已保留，請重試。' },
  es: { pending: 'Enviando tus comentarios.', failed: 'No se pudieron enviar tus comentarios. El mensaje y el adjunto siguen aquí. Inténtalo de nuevo.' },
  fr: { pending: 'Envoi de votre avis.', failed: 'Votre avis n’a pas pu être envoyé. Le message et la pièce jointe sont conservés. Veuillez réessayer.' },
} as const
export function ClientFeedbackDialog(props: ClientFeedbackDialogProps) {
  // Owner or delivery-boundary changes discard the previous form, object URL
  // and pending presentation. They never cancel or acknowledge a server task.
  return <ClientFeedbackPresence key={JSON.stringify([props.submissionScope ?? null, Boolean(props.onSubmit), props.submission ?? 'unavailable'])} {...props} />
}
function ClientFeedbackPresence({ open = true, ...props }: ClientFeedbackDialogProps) {
  const presence = useClientSurfacePresence(open, { exitAnimationName: 'client-feedback-out', fallbackMs: 380 })
  const [visit, setVisit] = useState({ open, number: 0 })
  // A new explicit visit gets a fresh form; the retiring form remains visual
  // only and cannot deliver its pending response into the next visit.
  if (visit.open !== open) setVisit({ open, number: visit.number + (open ? 1 : 0) })
  if (!presence.present) return null
  return <ClientFeedbackForm key={visit.number} {...props} open={open} presence={presence} />
}
function ClientFeedbackForm({ open = true, returnFocus, onClose, submission = 'unavailable', submissionScope, onSubmit, presence }: ClientFeedbackDialogProps & { presence: ReturnType<typeof useClientSurfacePresence> }) {
  const { t, language } = useClientPreferences()
  const [feedback, setFeedback] = useState(''), [error, setError] = useState<'required' | 'imageOnly' | 'tooLarge' | 'failed' | null>(null), [done, setDone] = useState(false)
  const [attachment, setAttachment] = useState<{ url: string; file: File; name: string; size: number } | null>(null)
  const [pending, setPending] = useState(false)
  const active = useRef(true), sending = useRef(false), closed = useRef(false)
  useLayoutEffect(() => { active.current = open; return () => { active.current = false } }, [open])
  const close = () => { if (!active.current || closed.current) return; closed.current = true; onClose() }
  const connected = Boolean(onSubmit && submissionScope?.trim())
  const unavailable = !connected && (submission !== 'preview' || Boolean(onSubmit))
  const showForm = !done || unavailable
  const ref = useAccountSurface(close, showForm ? 'form' : 'done', returnFocus, open)
  const input = useRef<HTMLInputElement>(null), text = useRef<HTMLTextAreaElement>(null), attach = useRef<HTMLButtonElement>(null)
  const id = useId()
  const errorText = error === 'required' ? t('fb.req') : error === 'failed' ? feedbackDeliveryCopy[language].failed : error ? feedbackText(language, error) : ''
  const errorId = errorText ? `${id}-error` : undefined
  const unavailableCopy = unavailable ? feedbackText(language, 'unavailable') : ''
  useEffect(() => () => { if (attachment) URL.revokeObjectURL(attachment.url) }, [attachment])
  function remove() { setAttachment(null); if (input.current) input.current.value = '' }
  async function submit() {
    if (!active.current || unavailable || sending.current || closed.current || done) return
    if (!feedback.trim()) { setError('required'); text.current?.focus(); return }
    // File validation is also performed at dispatch, not only by the picker.
    if (attachment && !/^image\//.test(attachment.file.type)) { setError('imageOnly'); return }
    if (attachment && attachment.file.size > 10 * 1024 * 1024) { setError('tooLarge'); return }
    sending.current = true; setPending(true); setError(null)
    try {
      if (connected && onSubmit) await onSubmit({ message: feedback.trim(), attachment: attachment?.file ?? null })
      if (!active.current || closed.current) return
      setDone(true); setFeedback(''); remove()
    } catch {
      if (active.current && !closed.current) setError('failed')
    } finally {
      sending.current = false
      if (active.current && !closed.current) setPending(false)
    }
  }
  return <div className="ca-feedback-layer" data-surface-active={open} data-surface-closing={presence.closing} inert={!open} aria-hidden={!open || undefined} onClickCapture={event => { if (!open) { event.preventDefault(); event.stopPropagation() } }} onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); close() } }}>
    <div className={`ca-feedback${unavailable ? ' is-unavailable' : ''}`} ref={ref} onAnimationEnd={presence.onAnimationEnd} role="dialog" aria-modal={open || undefined} aria-labelledby={`${id}-title`} aria-busy={pending}>
      {showForm ? <form className="fb-main" onSubmit={event => {
        event.preventDefault()
        void submit()
      }}>
        <header className="fb-hd"><h2 id={`${id}-title`}>{t('fb.title')}</h2><button className="fb-x" type="button" onClick={close} aria-label={t('common.close')}>✕</button></header>
        <div className="fb-body">
          <label htmlFor={`${id}-text`}>{t('fb.label')}</label>
          <textarea ref={text} id={`${id}-text`} placeholder={t('fb.ph')} value={feedback} maxLength={10000} disabled={pending} aria-invalid={error === 'required'} aria-describedby={error === 'required' ? errorId : undefined} onChange={event => { if (!active.current || sending.current) return; setFeedback(event.target.value); if (error === 'required' || error === 'failed') setError(null) }} />
          {errorText && <p className="ca-error" role="alert" id={errorId}>{errorText}</p>}
          <div className="fb-sens"><span>{t('fb.sens')}</span><button className="fb-q" type="button" aria-label={t('fb.sens')} aria-describedby={`${id}-tip`}>?</button><span className="fb-tip" id={`${id}-tip`} role="tooltip">{t('fb.tip')}</span></div>
          <p className="fb-shot-desc">{t('fb.shot')}</p>
          <button ref={attach} className="fb-attach" type="button" disabled={pending} aria-describedby={error && error !== 'required' ? errorId : undefined} onClick={() => { if (active.current && !sending.current) input.current?.click() }}><AccountIcon name="image" />{t('fb.attach')}</button>
          <input ref={input} type="file" accept="image/*" hidden disabled={pending} aria-label={t('fb.attach')} onChange={event => {
            if (!active.current || sending.current) return
            const file = event.target.files?.[0]
            if (!file) return
            if (!/^image\//.test(file.type)) { setError('imageOnly'); event.target.value = ''; return }
            if (file.size > 10 * 1024 * 1024) { setError('tooLarge'); event.target.value = ''; return }
            setError(null); setAttachment({ url: URL.createObjectURL(file), file, name: file.name, size: file.size })
          }} />
          {attachment && <div className="fb-prev"><img src={attachment.url} alt={feedbackText(language, 'attachmentAlt')} /><button className="rm" type="button" disabled={pending} onClick={() => { if (!active.current || sending.current) return; remove(); setError(null); attach.current?.focus() }} aria-label={feedbackText(language, 'removeAttachment')}>✕</button><div className="nm">{attachment.name} ({Math.round(attachment.size / 1024)}KB)</div></div>}
          <div className="fb-fine"><PolicyCopy text={t('fb.fine')} /></div>
        </div>
        <footer className={`fb-ft${unavailable || pending ? ' is-unavailable' : ''}`}>
          {unavailableCopy && <p className="fb-unavailable" id={`${id}-unavailable`} role="status">{unavailableCopy}</p>}
          {pending && <p className="fb-unavailable" role="status">{feedbackDeliveryCopy[language].pending}</p>}
          <button className="fb-send" type="submit" disabled={unavailable || pending} aria-describedby={unavailableCopy ? `${id}-unavailable` : undefined}>{t('fb.send')}</button>
        </footer>
      </form> : <div className="fb-done"><svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="44" stroke="#3d6ef0" strokeWidth="3" /><path d="M42 61l12 12 24-26" stroke="#3d6ef0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M95 25c1.2 5 3.8 7.6 8.8 8.8.6.14.6.9 0 1.04-5 1.2-7.6 3.8-8.8 8.8-.14.6-.9.6-1.04 0-1.2-5-3.8-7.6-8.8-8.8-.6-.14-.6-.9 0-1.04 5-1.2 7.6-3.8 8.8-8.8.14-.6.9-.6 1.04 0z" fill="#FFB60A" /></svg><h2 id={`${id}-title`}>{t('fb.doneT')}</h2><p>{t('fb.doneP')}</p><button data-autofocus className="cls" onClick={close}>{t('common.close')}</button></div>}
    </div>
  </div>
}
