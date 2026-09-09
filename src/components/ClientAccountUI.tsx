import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { clientLanguages, useClientPreferences } from '../client-preferences'
import { InternalLink } from './InternalLink'
import '../client-account-ui.css'

export type ClientProfile = { name: string; email: string }

function visibleControl(element: HTMLElement) {
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible' && !element.closest('[inert],[hidden]')
}

// These are presentation-only components. They never authenticate, upload, persist
// credentials, or send email. The host supplies the visible development boundary.
function useAccountSurface(onClose: () => void, step?: string, returnFocus?: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDivElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    // StrictMode replays effects after focusFirst has already focused this
    // surface. Keep the original entry point instead of capturing its input.
    if (!origin.current && document.activeElement instanceof HTMLElement) origin.current = document.activeElement
    const previous = origin.current
    const logicalTarget = returnFocus?.current ?? null
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
        if (document.getElementById('root')?.inert || document.querySelector('.ca-menu-layer,.ca-auth-veil,.ca-feedback-layer,.client-preferences-layer')) return
        const visible = (element: HTMLElement | null) => element !== document.body && element !== document.documentElement && element?.isConnected && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert],[hidden]')
        const fallback = document.querySelector<HTMLElement>(matchMedia('(max-width:860px)').matches ? '.client-hamburger' : '.client-sidebar-bottom button')
        const target = visible(logicalTarget) ? logicalTarget : visible(previous) ? previous : visible(fallback) ? fallback : null
        target?.focus({ preventScroll: true })
      })
    }
  }, [returnFocus])
  useEffect(() => {
    Array.from(ref.current?.querySelectorAll<HTMLElement>('[data-autofocus], input:not(:disabled), textarea') ?? []).find(visibleControl)?.focus()
  }, [step])
  return ref
}

function AccountIcon({ name }: { name: 'settings' | 'feedback' | 'help' | 'support' | 'download' | 'globe' | 'arrow' | 'image' }) {
  const content: Record<typeof name, ReactNode> = {
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8L9.4 5.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></>,
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

export function ClientSettingsMenu({ onClose, onLocale, onFeedback, onHelp, onDownload, signedIn }: {
  onClose: () => void; onLocale: () => void; onFeedback: () => void; onHelp: () => void; onDownload: () => void; signedIn: boolean
}) {
  const { t, language, currency } = useClientPreferences()
  const [submenu, setSubmenu] = useState<'settings' | 'help' | null>(null)
  const pendingFocus = useRef<'child' | 'settings' | 'help' | null>(null)
  const closeSubmenu = () => { pendingFocus.current = submenu; setSubmenu(null) }
  const ref = useAccountSurface(() => submenu ? closeSubmenu() : onClose())
  useLayoutEffect(() => {
    const target = pendingFocus.current
    pendingFocus.current = null
    if (target === 'child' && submenu) Array.from(ref.current?.querySelectorAll<HTMLElement>(`#ca-sub-${submenu} button, #ca-sub-${submenu} a[href]`) ?? []).find(visibleControl)?.focus()
    else if (target && target !== 'child' && !submenu) ref.current?.querySelector<HTMLButtonElement>(`[aria-controls="ca-sub-${target}"]`)?.focus()
  }, [submenu, ref])
  useEffect(() => {
    const breakpoint = matchMedia('(max-width:640px)')
    const restoreVisibleFocus = () => {
      const current = document.activeElement as HTMLElement | null
      if (current && ref.current?.contains(current) && visibleControl(current)) return
      const sub = ref.current?.querySelector<HTMLElement>('.gm-sub')
      Array.from((sub ?? ref.current)?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? []).find(visibleControl)?.focus({ preventScroll: true })
    }
    breakpoint.addEventListener('change', restoreVisibleFocus)
    return () => breakpoint.removeEventListener('change', restoreVisibleFocus)
  }, [ref])
  const [bottom] = useState(() => {
    const rect = document.activeElement instanceof HTMLElement ? document.activeElement.getBoundingClientRect() : null
    return rect ? Math.max(64, window.innerHeight - rect.top + 10) : 108
  })
  const item = (name: 'settings' | 'help', label: string, children: ReactNode) => <div className="ca-menu-group" onMouseEnter={() => { if (matchMedia('(min-width:641px)').matches) setSubmenu(name) }} onMouseLeave={event => { if (matchMedia('(min-width:641px)').matches && !event.currentTarget.contains(document.activeElement)) setSubmenu(null) }}>
    <button className="gm-item" aria-expanded={submenu === name} aria-controls={`ca-sub-${name}`} onClick={() => { pendingFocus.current = 'child'; if (submenu === name) { pendingFocus.current = null; Array.from(ref.current?.querySelectorAll<HTMLElement>(`#ca-sub-${name} button, #ca-sub-${name} a[href]`) ?? []).find(visibleControl)?.focus() } else setSubmenu(name) }}><AccountIcon name={name} /><span>{label}</span><span className="sp" /><AccountIcon name="arrow" /></button>
    {submenu === name && <div className="gm-sub" id={`ca-sub-${name}`}><button className="ca-sub-back" onClick={closeSubmenu} aria-label={t('common.close')}>‹ {label}</button>{children}</div>}
  </div>
  return <div className="ca-menu-layer" onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }}>
    <div ref={ref} className={`ca-settings${submenu ? ' subopen' : ''}`} role="dialog" aria-label={t('menu.settings')} style={{ bottom: Math.min(bottom, window.innerHeight - 300) }}>
      <button className="gm-grab" onClick={onClose} aria-label={t('common.close')} />
      {item('settings', t('menu.settings'), <button onClick={onLocale}><AccountIcon name="globe" /><span>{t('menu.glc')}</span><span className="gm-val">{clientLanguages.find(item => item.c === language)?.n} / {currency}</span></button>)}
      <button className="gm-item" onClick={onFeedback}><AccountIcon name="feedback" />{t('menu.feedback')}</button>
      {signedIn && <><button className="gm-item" onClick={onHelp}><AccountIcon name="support" />{t('help.title').replace('24/7 ', '')}</button><button className="gm-item" onClick={onDownload}><AccountIcon name="download" />{t('banner.dl')}</button></>}
      {item('help', t('menu.help'), <><InternalLink href="/policies/#terms" onClick={onClose}>{t('menu.terms')}</InternalLink><InternalLink href="/policies/#privacy" onClick={onClose}>{t('menu.privacy')}</InternalLink><InternalLink href="/about/" onClick={onClose}>{t('nav.about')}</InternalLink></>)}
    </div>
  </div>
}

export function ClientProfileMenu({ profile, onClose, onLogout }: { profile: ClientProfile; onClose: () => void; onLogout: () => void }) {
  const ref = useAccountSurface(onClose)
  return <div className="ca-menu-layer" onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }}><div className="ca-profile" ref={ref} role="dialog" aria-label="프로필"><div className="hd"><b>{profile.name}</b>{profile.email && <span>{profile.email}</span>}</div><button className="gsm-it" onClick={onLogout}>로그아웃</button></div></div>
}

function CopyLines({ text, email }: { text: string; email?: string }) {
  return <>{text.split(/(<br\s*\/?\s*>|\{e\})/).map((part, index) => part.startsWith('<br') ? <br key={index} /> : part === '{e}' ? <b key={index}>{email}</b> : <Fragment key={index}>{part}</Fragment>)}</>
}

function PolicyCopy({ text, onClose }: { text: string; onClose: () => void }) {
  return <>{text.split(/(\{[PT]\}.*?\{\/\})/g).map((part, index) => /^\{[PT]\}/.test(part) ? <InternalLink key={index} href={`/policies/#${part.startsWith('{P}') ? 'privacy' : 'terms'}`} onClick={onClose}>{part.slice(3, -3)}</InternalLink> : <Fragment key={index}>{part}</Fragment>)}</>
}

function ProviderMark({ provider }: { provider: 'Google' | 'Apple' }) {
  return provider === 'Google' ? <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg> : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.05 12.54c-.03-2.72 2.22-4.02 2.32-4.09-1.27-1.85-3.24-2.1-3.93-2.13-1.67-.17-3.26.98-4.1.98-.85 0-2.16-.96-3.55-.93-1.82.03-3.5 1.06-4.44 2.69-1.9 3.29-.49 8.16 1.36 10.83.9 1.3 1.98 2.77 3.39 2.72 1.36-.05 1.87-.88 3.52-.88 1.64 0 2.11.88 3.55.85 1.47-.02 2.4-1.33 3.29-2.64 1.04-1.52 1.47-2.99 1.49-3.06-.03-.02-2.86-1.1-2.9-4.34zM14.34 4.56c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.63-.69.8-1.3 2.09-1.14 3.32 1.2.09 2.43-.61 3.18-1.52z" /></svg>
}

// Called by the send event, never used to derive a deadline during render.
const codeResendDeadline = () => Date.now() + 30_000

export function ClientAuthDialog({ mode, onClose, onComplete, returnFocus }: { mode: 'login' | 'signup'; onClose: () => void; onComplete: (profile: ClientProfile) => void; returnFocus?: RefObject<HTMLElement | null> }) {
  const { t } = useClientPreferences()
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
  function sendCode() { setPassword(''); setCode(''); setCooldown(30); setResendAt(codeResendDeadline()); go('code') }
  function finish() {
    setPassword(''); setCode('')
    const displayName = email.split('@')[0]
    if (mode === 'signup') { setName(displayName); go('age') }
    else onComplete({ name: displayName, email })
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
  const foot = <div className="au-foot"><InternalLink href="/policies/#terms" onClick={onClose}>{t('menu.terms')}</InternalLink><span>|</span><InternalLink href="/policies/#privacy" onClick={onClose}>{t('menu.privacy')}</InternalLink></div>
  const errorNode = error && <p className="au-err" id={`${id}-error`} role="alert">{error}</p>
  const continueButton = <button className="au-btn primary au-gap" type="submit" disabled={loading} aria-busy={loading}>{loading ? <span className="au-spin" aria-label="처리 중" /> : step === 'age' ? '시장에 입장하기' : t('auth.continue')}</button>
  const passwordField = <div className="au-field"><label className="au-label" htmlFor={`${id}-password`}>{t('pw.label')}</label><input id={`${id}-password`} data-autofocus className={`au-input has-side${error ? ' bad' : ''}`} type={showPassword ? 'text' : 'password'} value={password} onChange={event => { setPassword(event.target.value); setError('') }} autoComplete={step === 'password-new' ? 'new-password' : 'current-password'} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} /><button className="au-side" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'} aria-pressed={showPassword}>{showPassword ? '🙈' : '👁'}</button></div>
  return <div className="ca-auth-veil" onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }}><div className="ca-auth" ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}><button className="au-x" onClick={onClose} aria-label={t('common.close')}>✕</button><form noValidate onSubmit={event => { event.preventDefault(); submit() }}>
    {step === 'start' && <><h2 className="au-title" id={`${id}-title`}>{t('auth.title')}</h2><p className="au-sub"><CopyLines text={t('auth.sub')} /></p><div className="au-btns">{(['Google', 'Apple'] as const).map(provider => <button className="au-btn" type="button" key={provider} onClick={() => { if (mode === 'signup') { setName('김도현'); go('age') } else onComplete({ name: '김도현', email: '' }) }}><ProviderMark provider={provider} />{t(provider === 'Google' ? 'auth.google' : 'auth.apple')}</button>)}</div><div className="au-div">{t('auth.or')}</div><div className="au-input-wrap"><input data-autofocus className={`au-input${error ? ' bad' : ''}`} type="email" aria-label={t('auth.email')} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} placeholder={t('auth.email')} autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setError('') }} /></div>{errorNode}{continueButton}<div className="au-free">{t('auth.free')}</div></>}
    {step === 'code' && <><h2 className="au-title" id={`${id}-title`}>{t('code.title')}</h2><p className="au-sub"><CopyLines text={t(mode === 'signup' ? 'code.sub.signup' : 'code.sub.login')} email={email} /></p><div className="au-input-wrap"><input data-autofocus className={`au-input${error ? ' bad' : ''}`} inputMode="numeric" maxLength={6} aria-label={t('code.ph')} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} placeholder={t('code.ph')} autoComplete="one-time-code" value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setError('') }} /></div>{errorNode}{continueButton}<button className="au-textbtn" type="button" disabled={cooldown > 0} onClick={sendCode}>{cooldown > 0 ? t('code.wait').replace('{s}', String(cooldown)) : t('code.resend')}</button>{mode === 'login' && <><div className="au-div">{t('auth.or')}</div><button className="au-btn ghost au-gap" type="button" onClick={() => go('password')}>{t('code.pwbtn')}</button></>}{foot}</>}
    {(step === 'password-new' || step === 'password') && <><h2 className="au-title" id={`${id}-title`}>{t(step === 'password-new' ? 'pwnew.title' : 'pw.title')}</h2><p className="au-sub"><CopyLines text={t(step === 'password-new' ? 'pwnew.sub' : 'pw.sub')} email={email} /></p>{step === 'password-new' && <div className="au-field"><label className="au-label" htmlFor={`${id}-email-fixed`}>{t('auth.email')}</label><input className="au-input has-side" id={`${id}-email-fixed`} type="email" disabled value={email} /><button className="au-side" type="button" onClick={() => { setPassword(''); go('start') }}>{t('pwnew.edit')}</button></div>}{passwordField}{step === 'password-new' && <div className="au-req"><div>{t('req.head')}</div>{passwordRules.map(rule => <div className={`rq${rule.ok ? ' ok' : ''}`} key={rule.label}><span className="m" aria-hidden="true">{rule.ok ? '✓' : '•'}</span><span>{rule.label}</span><span className="ca-sr-only">{rule.ok ? ' 충족' : ' 미충족'}</span></div>)}</div>}{errorNode}{continueButton}<div className="au-div">{t('auth.or')}</div><button className="au-btn ghost au-gap" type="button" onClick={sendCode}>{t(step === 'password-new' ? 'pwnew.codebtn' : 'pw.codebtn')}</button>{foot}</>}
    {step === 'age' && <><h2 className="au-title" id={`${id}-title`}>연령을 알려주세요</h2><p className="au-sub">연령을 제공하면 당사 <InternalLink href="/policies/#privacy" onClick={onClose}>개인정보 보호 정책</InternalLink>을 준수하면서 사용자님의 경험을 개인 맞춤화하고 올바른 설정을 제공하는 데 도움이 됩니다</p><div className="au-field"><label className="au-label" htmlFor={`${id}-name`}>성명</label><input className="au-input" id={`${id}-name`} value={name} autoComplete="name" maxLength={80} onChange={event => setName(event.target.value)} /></div><div className="au-field"><label className="au-label" htmlFor={`${id}-age`}>연령</label><input data-autofocus className={`au-input${error ? ' bad' : ''}`} id={`${id}-age`} type="text" inputMode="numeric" maxLength={3} value={age} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setAge(event.target.value); setError('') }} /></div>{errorNode}<p className="au-agree">“시장에 입장하기”를 클릭하면 당사 <InternalLink href="/policies/#terms" onClick={onClose}>이용약관</InternalLink>에 동의하고<br /><InternalLink href="/policies/#privacy" onClick={onClose}>개인정보 보호 정책</InternalLink>을 읽은 것으로 간주합니다.</p>{continueButton}</>}
  </form></div></div>
}

export function ClientFeedbackDialog({ onClose }: { onClose: () => void }) {
  const { t } = useClientPreferences()
  const [feedback, setFeedback] = useState(''), [error, setError] = useState(''), [done, setDone] = useState(false)
  const [attachment, setAttachment] = useState<{ url: string; name: string; size: number } | null>(null)
  const ref = useAccountSurface(onClose, done ? 'done' : 'form')
  const input = useRef<HTMLInputElement>(null), text = useRef<HTMLTextAreaElement>(null)
  const id = useId()
  useEffect(() => () => { if (attachment) URL.revokeObjectURL(attachment.url) }, [attachment])
  function remove() { setAttachment(null); if (input.current) input.current.value = '' }
  return <div className="ca-feedback-layer" onMouseDown={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }}><div className="ca-feedback" ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
    {!done ? <form className="fb-main" onSubmit={event => { event.preventDefault(); if (!feedback.trim()) { setError(t('fb.req')); text.current?.focus(); return } setDone(true); setFeedback(''); remove() }}><header className="fb-hd"><h2 id={`${id}-title`}>{t('fb.title')}</h2><button className="fb-x" type="button" onClick={onClose} aria-label={t('common.close')}>✕</button></header><div className="fb-body"><label htmlFor={`${id}-text`}>{t('fb.label')}</label><textarea ref={text} id={`${id}-text`} placeholder={t('fb.ph')} value={feedback} maxLength={10000} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={event => { setFeedback(event.target.value); setError('') }} />{error && <p className="ca-error" role="alert" id={`${id}-error`}>{error}</p>}<div className="fb-sens"><span>{t('fb.sens')}</span><button className="fb-q" type="button" aria-label={t('fb.sens')} aria-describedby={`${id}-tip`}>?</button><span className="fb-tip" id={`${id}-tip`} role="tooltip">{t('fb.tip')}</span></div><p className="fb-shot-desc">{t('fb.shot')}</p><button className="fb-attach" type="button" onClick={() => input.current?.click()}><AccountIcon name="image" />{t('fb.attach')}</button><input ref={input} type="file" accept="image/*" hidden aria-label={t('fb.attach')} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (!/^image\//.test(file.type)) { setError('이미지 파일만 첨부할 수 있어요'); event.target.value = ''; return } if (file.size > 10 * 1024 * 1024) { setError('10MB 이하 이미지만 첨부할 수 있어요'); event.target.value = ''; return } setError(''); setAttachment({ url: URL.createObjectURL(file), name: file.name, size: file.size }) }} />{attachment && <div className="fb-prev"><img src={attachment.url} alt="첨부된 스크린샷" /><button className="rm" type="button" onClick={remove} aria-label="첨부 제거">✕</button><div className="nm">{attachment.name} ({Math.round(attachment.size / 1024)}KB)</div></div>}<div className="fb-fine"><PolicyCopy text={t('fb.fine')} onClose={onClose} /></div></div><footer className="fb-ft"><button className="fb-send" type="submit">{t('fb.send')}</button></footer></form> : <div className="fb-done"><svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="44" stroke="#3d6ef0" strokeWidth="3" /><path d="M42 61l12 12 24-26" stroke="#3d6ef0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M95 25c1.2 5 3.8 7.6 8.8 8.8.6.14.6.9 0 1.04-5 1.2-7.6 3.8-8.8 8.8-.14.6-.9.6-1.04 0-1.2-5-3.8-7.6-8.8-8.8-.6-.14-.6-.9 0-1.04 5-1.2 7.6-3.8 8.8-8.8.14-.6.9-.6 1.04 0z" fill="#FFB60A" /></svg><h2 id={`${id}-title`}>{t('fb.doneT')}</h2><p>{t('fb.doneP')}</p><button data-autofocus className="cls" onClick={onClose}>{t('common.close')}</button></div>}
  </div></div>
}
