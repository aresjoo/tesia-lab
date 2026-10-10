import { nativeAuthUiText, type NativeAuthUiCopyKey } from './native-auth-ui-copy'
import { nativeShellText } from './native-shell-copy'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { ClientProviderMark } from '../components/ClientProviderMark'
import '../client-account-ui.css'
import './native-login-panel.css'
import { createNativeBrowserAuth, readNativeAuthReturnIntent, rememberNativeAuthReturnIntent, clearNativeAuthReturnIntent, type NativeAuthReturnIntent, type NativeAuthProvider, type NativeAuthenticated, type NativeSessionRecovery } from './native-browser-auth'
import { NativeEmailLoginPanel } from './NativeEmailLoginPanel'
import type { NativeEmailAuthenticated } from './native-email-auth'

const labels = { GOOGLE: 'Google', APPLE: 'Apple' } as const
const defaultProviders: readonly NativeAuthProvider[] = ['GOOGLE', 'APPLE']
export function NativeLoginPanel({ onAuthenticated, onEmailAuthenticated, onSessionRecovered, onClose, hidden = false, resumeToken = 0, isCurrent = () => true, expectedSessionId, canEmailDispatch = true, acquireEmailDispatch, providers = defaultProviders, enabledProviders = providers, emailAvailable = true, sourceLayout = false, returning = false, returnOnly = false, recoveryBlocked, onRecheckSession, recheckDisabled = false, naturalFlow = false, intent = 'login' }: {
  naturalFlow?: boolean
  onAuthenticated: (result: NativeAuthenticated) => void | Promise<void>
  onSessionRecovered?: (result: NativeSessionRecovery) => void | Promise<void>
  onClose?: (retain?: boolean) => void
  hidden?: boolean
  resumeToken?: number
  onEmailAuthenticated?: (result: NativeEmailAuthenticated) => void | Promise<void>
  isCurrent?: () => boolean
  expectedSessionId?: string
  canEmailDispatch?: boolean
  acquireEmailDispatch?: () => (() => void) | null
  providers?: readonly NativeAuthProvider[]
  enabledProviders?: readonly NativeAuthProvider[]
  emailAvailable?: boolean
  sourceLayout?: boolean
  returning?: boolean
  returnOnly?: boolean
  recoveryBlocked?: string
  onRecheckSession?: () => void
  recheckDisabled?: boolean
  intent?: 'login' | 'signup'
}) {
  const { t, language } = useClientPreferences()
  const text = (key: NativeAuthUiCopyKey, params?: Readonly<Record<string, string>>) => nativeAuthUiText(language, key, params)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const returnPolicy = useRef({ returnOnly, isCurrent, hidden, onAuthenticated, recoveryBlocked, recheckDisabled })
  useLayoutEffect(() => { returnPolicy.current = { returnOnly, isCurrent, hidden, onAuthenticated, recoveryBlocked, recheckDisabled } }, [returnOnly, isCurrent, hidden, onAuthenticated, recoveryBlocked, recheckDisabled])
  const [auth] = useState(createNativeBrowserAuth)
  const [emailOpen, setEmailOpen] = useState(false)
  const [observedResume, setObservedResume] = useState(resumeToken)
  const needsResume = observedResume !== resumeToken
  const [provider, setProvider] = useState<NativeAuthProvider>('GOOGLE')
  const providerLock = useRef<NativeAuthProvider | null>(null)
  const [providerLocked, setProviderLocked] = useState(false)
  const [redirect, setRedirect] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [restartable, setRestartable] = useState(false)
  const [busy, setBusy] = useState(false)
  const recoveryDisabled = busy || recheckDisabled || Boolean(recoveryBlocked)
  const panelElement = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const panel = panelElement.current
    // Returning from the off-route recovery removes its focused button while
    // keeping the dialog open. Restore only a lost focus, never an auth action.
    if (returnOnly && !hidden && !busy && !recheckDisabled && panel && !panel.contains(document.activeElement)) {
      panel.querySelector<HTMLButtonElement>('button:not(:disabled):not([aria-disabled="true"])')?.focus({ preventScroll: true })
    }
  }, [hidden, returnOnly, busy, recheckDisabled])
  const working = useRef(false)
  const [message, setMessage] = useState<NativeAuthUiCopyKey>('providerInitial')
  const [error, setError] = useState(false)
  const [naturalRecovery, setNaturalRecovery] = useState(false)
  const run = async (operation: (current: () => boolean) => Promise<void>, nextProvider = provider, initiation = false) => {
    // Availability still governs every provider operation. Return-only mode
    // independently blocks initiation, without disabling result/ACK recovery.
    const returnOperation = returnOnly || returnPolicy.current.returnOnly
    const boundIsCurrent = returnPolicy.current.isCurrent
    const current = () => (!naturalFlow || document.visibilityState === 'visible') && (returnOperation
      ? active.current && returnPolicy.current.returnOnly && boundIsCurrent() && returnPolicy.current.isCurrent()
      : active.current && !returnPolicy.current.returnOnly && !returnPolicy.current.hidden && boundIsCurrent() && returnPolicy.current.isCurrent())
    if (returnOperation && (initiation || returnPolicy.current.hidden || !current())) return
    if (naturalFlow && (!current() || returnPolicy.current.recoveryBlocked || returnPolicy.current.recheckDisabled)) return
    if (!enabledProviders.includes(nextProvider) || working.current || hidden || !active.current || (providerLock.current !== null && providerLock.current !== nextProvider)) return
    // The SDK binds its provider before the first session/CSRF read. Retain that
    // choice even if no transaction context was received. Do not change choice
    // for a second same-tick click rejected by the working guard above.
    providerLock.current = nextProvider; setProvider(nextProvider); setProviderLocked(true)
    working.current = true; setBusy(true); setError(false); setMessage('providerBusy')
    try { await operation(current) } catch (failure) {
      if (!current()) return
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : ''
      setError(true)
      setMessage(code === 'AUTH_RESULT_NOT_READY' ? 'providerNotReady'
        : code === 'NOT_FOUND' ? 'providerNotFound'
          : code === 'AUTH_PROVIDER_MISMATCH' ? 'providerMismatch'
            : code === 'AUTH_SESSION_ALREADY_AUTHENTICATED' ? 'providerAlreadyAuthenticated'
              : auth.canRestart() ? 'providerRestartable'
                : code === 'AUTH_RESULT_EXPIRED' || code === 'AUTH_TRANSACTION_EXPIRED' ? 'providerExpired'
            : 'providerFailure')
    } finally {
      if (current()) {
        const restart = auth.canRestart(); setRestartable(restart)
        if (restart) { setReady(false); setRedirect(null) }
        working.current = false; setBusy(false)
      } else {
        working.current = false
        // Stale responses cannot update result state or adopt a session. A
        // still-mounted retained panel must nevertheless release bookkeeping
        // so a later current scope can explicitly recover on the same controller.
        if (active.current) {
          // Do not repeat a previously READY status after the SDK may have
          // observed a retired result. Explicit recheck remains necessary.
          setBusy(false); setMessage('resumePrompt'); setError(false)
        }
      }
    }
  }
  const enabledProviderKey = enabledProviders.join(',')
  const automaticAttempt = useRef(false)
  useEffect(() => {
    if (!naturalFlow || hidden || recoveryBlocked || recheckDisabled || automaticAttempt.current
      || window.location.pathname !== '/auth/complete' || window.location.search || window.location.hash
      || document.visibilityState !== 'visible' || !returnPolicy.current.isCurrent()) return
    const intent = readNativeAuthReturnIntent()
    if (!intent || !enabledProviderKey.split(',').includes(intent.provider)) return
    let retired = false
    const retire = () => {
      retired = true
      if (active.current && automaticAttempt.current) { setNaturalRecovery(true); setBusy(false) }
    }
    const visibility = () => { if (document.visibilityState !== 'visible') retire() }
    window.addEventListener('pagehide', retire)
    window.addEventListener('popstate', retire)
    window.addEventListener('hashchange', retire)
    window.addEventListener('teth:navigate', retire)
    document.addEventListener('visibilitychange', visibility)
    const current = () => !retired && active.current && !returnPolicy.current.hidden && returnPolicy.current.isCurrent()
      && !returnPolicy.current.recoveryBlocked && !returnPolicy.current.recheckDisabled && document.visibilityState === 'visible'
      && window.location.pathname === '/auth/complete' && !window.location.search && !window.location.hash
    void (async () => {
      // StrictMode may clean up a probe mount before this microtask. A retired
      // mount dispatches nothing; the surviving mount owns the one attempt.
      await Promise.resolve()
      if (!current() || automaticAttempt.current || working.current) return
      automaticAttempt.current = true
      providerLock.current = intent.provider
      working.current = true
      setProvider(intent.provider); setProviderLocked(true); setBusy(true); setError(false); setNaturalRecovery(false)
      try {
        const result = await auth.readResult(intent.provider, intent.transactionId)
        if (!current()) return
        if (result.status !== 'READY_FOR_ACK') throw new Error('LOGIN_NOT_COMPLETED')
        setReady(true)
        const authenticated = await auth.acknowledge(intent.provider)
        if (!current()) return
        await returnPolicy.current.onAuthenticated(authenticated)
        // The host may retire the panel while accepting the authenticated owner.
        clearNativeAuthReturnIntent(intent)
        if (window.location.pathname === '/auth/complete' && !window.location.search && !window.location.hash) window.history.replaceState(null, '', '/')
      } catch {
        if (current()) setError(true)
      } finally {
        working.current = false
        if (active.current) setBusy(false)
      }
    })()
    return () => {
      retire()
      window.removeEventListener('pagehide', retire)
      window.removeEventListener('popstate', retire)
      window.removeEventListener('hashchange', retire)
      window.removeEventListener('teth:navigate', retire)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [auth, naturalFlow, hidden, recoveryBlocked, recheckDisabled, enabledProviderKey])
  const navigateProvider = (result: NativeAuthReturnIntent & { authorizationRedirect: string }) => {
    const url = new URL(result.authorizationRedirect)
    const google = result.provider === 'GOOGLE' && url.hostname === 'accounts.google.com' && url.pathname === '/o/oauth2/v2/auth'
    const apple = result.provider === 'APPLE' && url.hostname === 'appleid.apple.com' && url.pathname === '/auth/authorize'
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !(google || apple)) throw new Error('LOGIN_NOT_COMPLETED')
    // Saving the exact transaction before navigation is required for automatic
    // return adoption. Optional strategy-claim storage is a separate concern.
    rememberNativeAuthReturnIntent({ provider: result.provider, transactionId: result.transactionId, expiresAt: result.expiresAt })
    window.location.assign(url.href)
  }
  const retryNatural = () => void run(async current => {
    if (auth.hasBindingConflict()) throw new Error('LOGIN_NOT_COMPLETED')
    setNaturalRecovery(false)
    if (auth.canResumeAcknowledgement()) {
      // An ambiguous ACK may already have installed the HttpOnly cookie. A
      // fresh authenticated read is session-only proof, never a provider claim.
      if (onSessionRecovered) {
        try {
          const recovered = await auth.recoverSession(provider)
          if (!current()) return
          await onSessionRecovered(recovered)
          const intent = readNativeAuthReturnIntent()
          if (intent) clearNativeAuthReturnIntent(intent)
          if (window.location.pathname === '/auth/complete' && !window.location.search && !window.location.hash) window.history.replaceState(null, '', '/')
          return
        } catch { if (!current()) return }
      }
      const resumeIntent = readNativeAuthReturnIntent()
      const result = await auth.acknowledge(provider)
      if (!current()) return
      await onAuthenticated(result)
      if (resumeIntent?.provider === provider) clearNativeAuthReturnIntent(resumeIntent)
    } else if (!returnOnly && window.location.pathname !== '/auth/complete') {
      const result = auth.canRestart() ? await auth.restart(provider)
        : auth.canResumeStart() ? await auth.resumeStart(provider) : await auth.start(provider)
      if (current()) navigateProvider(result)
    } else {
      const intent = readNativeAuthReturnIntent()
      if (!intent || intent.provider !== provider) throw new Error('LOGIN_NOT_COMPLETED')
      const result = await auth.readResult(provider, intent.transactionId)
      if (!current()) return
      if (result.status !== 'READY_FOR_ACK') throw new Error('LOGIN_NOT_COMPLETED')
      const authenticated = await auth.acknowledge(provider)
      if (!current()) return
      await onAuthenticated(authenticated)
      if (intent) clearNativeAuthReturnIntent(intent)
    }
    setObservedResume(resumeToken)
    if (window.location.pathname === '/auth/complete' && !window.location.search && !window.location.hash) window.history.replaceState(null, '', '/')
  })
  const readResult = (nextProvider: NativeAuthProvider) => void run(async current => {
    const result = await auth.readResult(nextProvider); if (!active.current || !current()) return; setReady(result.status === 'READY_FOR_ACK')
    setMessage(result.status === 'READY_FOR_ACK' ? 'providerReady'
      : 'providerRejected')
  }, nextProvider)
  const recoverSession = (nextProvider: NativeAuthProvider) => void run(async current => {
    const result = await auth.recoverSession(nextProvider)
    if (!active.current || !current() || !onSessionRecovered) return
    await onSessionRecovered(result)
    if (!current()) return
    setMessage('providerSessionOnly')
  }, nextProvider)
  // Lost locators, blocked recovery and pre-ACK errors cannot authorize an
  // unbound ACK. Offer the existing host session-only observation instead;
  // ambiguous ACK replay and known binding conflicts retain their own paths.
  const naturalReturnSessionCheck = naturalFlow && returnOnly && !auth.hasBindingConflict()
    && (Boolean(recoveryBlocked) || !auth.canResumeAcknowledgement() && (!readNativeAuthReturnIntent() || error))
  const naturalBoundRetry = Boolean(readNativeAuthReturnIntent()) && !recoveryBlocked && !auth.hasBindingConflict()
  if (!returnOnly && emailOpen && onEmailAuthenticated && emailAvailable) return <NativeEmailLoginPanel hidden={hidden} resumeToken={resumeToken}
    expectedSessionId={expectedSessionId} isCurrent={isCurrent} onAuthenticated={onEmailAuthenticated} onSessionRecovered={onSessionRecovered} onClose={onClose}
    canDispatch={canEmailDispatch} acquireDispatch={acquireEmailDispatch} />
  if (needsResume && !naturalFlow) return <section ref={panelElement} hidden={hidden} inert={hidden} data-native-auth-intent={intent} aria-label={text('authSection')} aria-busy={busy || recheckDisabled} className="cs-native-login ca-auth native-provider-login">
    {sourceLayout && onClose && <button type="button" data-native-auth-close className="au-x" aria-label={t('common.close')} disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>✕</button>}
    <h2 className="au-title">{text('resumeTitle')}</h2>
    <p className="au-sub">{text('resumeDescription')}</p>
    <p className={`native-auth-status${error ? ' au-err' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{text(busy ? 'providerBusy' : error ? 'resumeFailure' : 'resumePrompt')}</p>
    <div className="native-auth-actions">
    {auth.canResumeStart() && <button disabled={returnOnly || busy} onClick={() => void run(async current => {
      const result = await auth.resumeStart(provider)
      if (!active.current || !current()) return
      setRedirect(result.authorizationRedirect); setReady(false); setConfirmed(false); setObservedResume(resumeToken)
      setMessage('resumedStart')
    }, provider, true)}>{text('resumeStart')}</button>}
    {auth.canRestart() && <button disabled={returnOnly || busy} onClick={() => void run(async current => {
      const result = await auth.restart(provider)
      if (!active.current || !current()) return
      setRedirect(result.authorizationRedirect); setReady(false); setConfirmed(false); setObservedResume(resumeToken)
      setMessage('restartedSameSession')
    }, provider, true)}>{text('restartConfirmed')}</button>}
      {auth.canResumeAcknowledgement() && <button disabled={recoveryDisabled} onClick={() => void run(async current => {
      const result = await auth.acknowledge(provider)
      if (!active.current || !current()) return
      await onAuthenticated(result)
      if (!current()) return
      setConfirmed(true); setRedirect(null); setReady(false); setObservedResume(resumeToken)
      setMessage('acknowledgedSame')
    })}>{text('resumeAcknowledgement')}</button>}
    {auth.canResumeResult() && !auth.canResumeAcknowledgement() && <button disabled={recoveryDisabled} onClick={() => void run(async current => {
      const result = await auth.readResult(provider)
      if (!active.current || !current()) return
      setRedirect(null); setReady(result.status === 'READY_FOR_ACK'); setConfirmed(false); setObservedResume(resumeToken)
      setMessage(result.status === 'READY_FOR_ACK' ? 'existingReady' : 'existingTerminated')
    })}>{text('recheckExisting')}</button>}
    {onSessionRecovered && <button disabled={recoveryDisabled} onClick={() => void run(async current => {
      const result = await auth.recoverSession(provider)
      if (!active.current || !current()) return
      await onSessionRecovered(result)
      if (!current()) return
    })}>{text('sessionOnly')}</button>}
    </div>
    {recoveryBlocked && <p className="native-auth-status au-err" role="alert">{recoveryBlocked}</p>}
    {!naturalFlow && returnOnly && onRecheckSession && <button className="au-textbtn" disabled={busy || recheckDisabled} onClick={onRecheckSession}>{nativeShellText(language, 'checkSession')}</button>}
    {!sourceLayout && onClose && <button data-native-auth-close className="au-textbtn" disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>{text('close')}</button>}
  </section>
  return <section ref={panelElement} hidden={hidden} inert={hidden} data-native-auth-intent={intent} aria-label={text('authSection')} aria-busy={busy || recheckDisabled} className="cs-native-login ca-auth native-provider-login">
    {sourceLayout && onClose && <button type="button" data-native-auth-close className="au-x" aria-label={t('common.close')} disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>✕</button>}
    <h2 className="au-title">{t('auth.title')}</h2>
    <p className="au-sub">{t('auth.sub').split(/<br\s*\/?\s*>/i).map((line, index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>)}</p>
    <div className="au-btns" aria-label={text('providers')}>
      {providers.map(nextProvider => {
        const available = enabledProviders.includes(nextProvider)
        const disabled = returnOnly || !available || busy || redirect !== null || ready || confirmed || restartable || (providerLocked && provider !== nextProvider)
        return <button className="au-btn" type="button" key={nextProvider} aria-disabled={disabled}
          onClick={() => { if (!disabled) void run(async current => {
            const result = await auth.start(nextProvider)
            if (!active.current || !current()) return
            if (naturalFlow) navigateProvider(result)
            else { setRedirect(result.authorizationRedirect); setMessage('startLink') }
          }, nextProvider, true) }}>
          <ClientProviderMark provider={labels[nextProvider]} />
          {t(nextProvider === 'GOOGLE' ? 'auth.google' : 'auth.apple')}
          {!available && <small className="native-provider-availability">{text('providerComingSoon')}</small>}
        </button>
      })}
    </div>
    {onEmailAuthenticated && <><div className="au-div">{t('auth.or')}</div><button className="au-btn ghost au-gap" disabled={returnOnly || !emailAvailable || busy || auth.hasMemoryIntent()} onClick={() => { if (!returnOnly && !returnPolicy.current.returnOnly && emailAvailable && !working.current && !hidden && active.current && !auth.hasMemoryIntent()) setEmailOpen(true) }}>{text('emailLogin')}{!emailAvailable && <small className="native-provider-availability">{text('providerComingSoon')}</small>}</button></>}
    {(!sourceLayout || busy || error || providerLocked && !naturalRecovery) && <p className={`native-auth-status${error ? ' au-err' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{text(naturalFlow ? (error ? 'naturalFailure' : 'naturalBusy') : message)}</p>}
    {!naturalFlow && <div className="native-auth-actions">
    {!confirmed && <>
      {restartable && <button disabled={returnOnly || busy} onClick={() => void run(async current => {
        const result = await auth.restart(provider); if (!active.current || !current()) return; setRedirect(result.authorizationRedirect); setReady(false)
        setMessage('newStart')
      }, provider, true)}>{text('restartProvider', { provider: labels[provider] })}</button>}
      {!returnOnly && redirect && <p><a className="au-btn primary" href={redirect} rel="noreferrer">{text('openProvider', { provider: labels[provider] })}</a></p>}
      {providerLocked && <button disabled={recoveryDisabled} onClick={() => readResult(provider)}>{text('resultAfterReturn')}</button>}
      {ready && <button className="au-btn primary" disabled={recoveryDisabled} onClick={() => void run(async current => {
        const result = await auth.acknowledge(provider)
        if (!active.current || !current()) return
        await onAuthenticated(result)
        if (!current()) return
        setConfirmed(true); setRedirect(null)
        setMessage('providerConfirmed')
      })}>{text('confirmLogin')}</button>}
    </>}
    {providerLocked && onSessionRecovered && <button disabled={recoveryDisabled} onClick={() => recoverSession(provider)}>{text('sessionOnly')}</button>}
    </div>}
    {naturalFlow && (!naturalReturnSessionCheck || naturalBoundRetry) && (error || naturalRecovery || needsResume || (returnOnly && !busy && !providerLocked)) && <button className="au-btn primary" disabled={recoveryDisabled} onClick={retryNatural}>{text(error ? 'naturalRetry' : 'naturalContinue')}</button>}
    {naturalFlow && (auth.hasBindingConflict() || auth.canRestart()) && <button className="au-textbtn" onClick={() => window.location.assign('/')}>{text('naturalHome')}</button>}
    {!naturalFlow && !providerLocked && (!sourceLayout || returning || window.location.pathname === '/auth/complete') && <details className="native-auth-recovery" open={typeof window !== 'undefined' && window.location.pathname === '/auth/complete'}>
      <summary>{text('recoveryTitle')}</summary>
      <p className="au-sub">{text('recoveryDescription')}</p>
      <div className="native-auth-actions">
        {providers.map(nextProvider => <Fragment key={nextProvider}>
          <button type="button" disabled={recoveryDisabled || !enabledProviders.includes(nextProvider)} onClick={() => readResult(nextProvider)}>{text('providerResult', { provider: labels[nextProvider] })}</button>
          {onSessionRecovered && <button type="button" disabled={recoveryDisabled || !enabledProviders.includes(nextProvider)} onClick={() => recoverSession(nextProvider)}>{text('providerSession', { provider: labels[nextProvider] })}</button>}
        </Fragment>)}
      </div>
    </details>}
    {recoveryBlocked && <p className="native-auth-status au-err" role="alert">{recoveryBlocked}</p>}
    {(!naturalFlow || naturalReturnSessionCheck) && returnOnly && onRecheckSession && <button className="au-textbtn" disabled={busy || recheckDisabled} onClick={onRecheckSession}>{nativeShellText(language, 'checkSession')}</button>}
    {sourceLayout && <div className="au-free">{t('auth.free')}</div>}
    {!sourceLayout && onClose && <button data-native-auth-close className="au-textbtn" disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>{text('close')}</button>}
  </section>
}
