import { nativeAuthUiText, type NativeAuthUiCopyKey } from './native-auth-ui-copy'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { ClientProviderMark } from '../components/ClientProviderMark'
import '../client-account-ui.css'
import './native-login-panel.css'
import { createNativeBrowserAuth, type NativeAuthProvider, type NativeAuthenticated, type NativeSessionRecovery } from './native-browser-auth'
import { NativeEmailLoginPanel } from './NativeEmailLoginPanel'
import type { NativeEmailAuthenticated } from './native-email-auth'

const labels = { GOOGLE: 'Google', APPLE: 'Apple' } as const
const defaultProviders: readonly NativeAuthProvider[] = ['GOOGLE', 'APPLE']
export function NativeLoginPanel({ onAuthenticated, onEmailAuthenticated, onSessionRecovered, onClose, hidden = false, resumeToken = 0, isCurrent = () => true, expectedSessionId, canEmailDispatch = true, acquireEmailDispatch, providers = defaultProviders, enabledProviders = providers, emailAvailable = true, sourceLayout = false, returning = false }: {
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
}) {
  const { t, language } = useClientPreferences()
  const text = (key: NativeAuthUiCopyKey, params?: Readonly<Record<string, string>>) => nativeAuthUiText(language, key, params)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
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
  const working = useRef(false)
  const [message, setMessage] = useState<NativeAuthUiCopyKey>('providerInitial')
  const [error, setError] = useState(false)
  const run = async (operation: () => Promise<void>, nextProvider = provider) => {
    if (!enabledProviders.includes(nextProvider) || working.current || hidden || !active.current || (providerLock.current !== null && providerLock.current !== nextProvider)) return
    // The SDK binds its provider before the first session/CSRF read. Retain that
    // choice even if no transaction context was received. Do not change choice
    // for a second same-tick click rejected by the working guard above.
    providerLock.current = nextProvider; setProvider(nextProvider); setProviderLocked(true)
    working.current = true; setBusy(true); setError(false); setMessage('providerBusy')
    try { await operation() } catch (failure) {
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
      const restart = auth.canRestart(); setRestartable(restart)
      if (restart) { setReady(false); setRedirect(null) }
      working.current = false; setBusy(false)
    }
  }
  const readResult = (nextProvider: NativeAuthProvider) => void run(async () => {
    const result = await auth.readResult(nextProvider); if (!active.current) return; setReady(result.status === 'READY_FOR_ACK')
    setMessage(result.status === 'READY_FOR_ACK' ? 'providerReady'
      : 'providerRejected')
  }, nextProvider)
  const recoverSession = (nextProvider: NativeAuthProvider) => void run(async () => {
    const result = await auth.recoverSession(nextProvider)
    if (!active.current || !onSessionRecovered) return
    await onSessionRecovered(result)
    setMessage('providerSessionOnly')
  }, nextProvider)
  if (emailOpen && onEmailAuthenticated && emailAvailable) return <NativeEmailLoginPanel hidden={hidden} resumeToken={resumeToken}
    expectedSessionId={expectedSessionId} isCurrent={isCurrent} onAuthenticated={onEmailAuthenticated} onSessionRecovered={onSessionRecovered} onClose={onClose}
    canDispatch={canEmailDispatch} acquireDispatch={acquireEmailDispatch} />
  if (needsResume) return <section hidden={hidden} inert={hidden} aria-label={text('authSection')} aria-busy={busy} className="cs-native-login ca-auth native-provider-login">
    {sourceLayout && onClose && <button type="button" data-native-auth-close className="au-x" aria-label={t('common.close')} disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>✕</button>}
    <h2 className="au-title">{text('resumeTitle')}</h2>
    <p className="au-sub">{text('resumeDescription')}</p>
    <p className={`native-auth-status${error ? ' au-err' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{text(busy ? 'providerBusy' : error ? 'resumeFailure' : 'resumePrompt')}</p>
    <div className="native-auth-actions">
    {auth.canResumeStart() && <button disabled={busy} onClick={() => void run(async () => {
      const result = await auth.resumeStart(provider)
      if (!active.current) return
      setRedirect(result.authorizationRedirect); setReady(false); setConfirmed(false); setObservedResume(resumeToken)
      setMessage('resumedStart')
    })}>{text('resumeStart')}</button>}
    {auth.canRestart() && <button disabled={busy} onClick={() => void run(async () => {
      const result = await auth.restart(provider)
      if (!active.current) return
      setRedirect(result.authorizationRedirect); setReady(false); setConfirmed(false); setObservedResume(resumeToken)
      setMessage('restartedSameSession')
    })}>{text('restartConfirmed')}</button>}
    {auth.canResumeAcknowledgement() && <button disabled={busy} onClick={() => void run(async () => {
      const result = await auth.acknowledge(provider)
      if (!active.current) return
      await onAuthenticated(result); setConfirmed(true); setRedirect(null); setReady(false); setObservedResume(resumeToken)
      setMessage('acknowledgedSame')
    })}>{text('resumeAcknowledgement')}</button>}
    {auth.canResumeResult() && !auth.canResumeAcknowledgement() && <button disabled={busy} onClick={() => void run(async () => {
      const result = await auth.readResult(provider)
      if (!active.current) return
      setRedirect(null); setReady(result.status === 'READY_FOR_ACK'); setConfirmed(false); setObservedResume(resumeToken)
      setMessage(result.status === 'READY_FOR_ACK' ? 'existingReady' : 'existingTerminated')
    })}>{text('recheckExisting')}</button>}
    {onSessionRecovered && <button disabled={busy} onClick={() => void run(async () => {
      const result = await auth.recoverSession(provider)
      if (!active.current) return
      await onSessionRecovered(result)
    })}>{text('sessionOnly')}</button>}
    </div>
    {!sourceLayout && onClose && <button data-native-auth-close className="au-textbtn" disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>{text('close')}</button>}
  </section>
  return <section hidden={hidden} inert={hidden} aria-label={text('authSection')} aria-busy={busy} className="cs-native-login ca-auth native-provider-login">
    {sourceLayout && onClose && <button type="button" data-native-auth-close className="au-x" aria-label={t('common.close')} disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>✕</button>}
    <h2 className="au-title">{t('auth.title')}</h2>
    <p className="au-sub">{t('auth.sub').split(/<br\s*\/?\s*>/i).map((line, index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>)}</p>
    <div className="au-btns" aria-label={text('providers')}>
      {providers.map(nextProvider => {
        const available = enabledProviders.includes(nextProvider)
        const disabled = !available || busy || redirect !== null || ready || confirmed || restartable || (providerLocked && provider !== nextProvider)
        return <button className="au-btn" type="button" key={nextProvider} aria-disabled={disabled}
          onClick={() => { if (!disabled) void run(async () => {
            const result = await auth.start(nextProvider)
            if (!active.current) return
            setRedirect(result.authorizationRedirect)
            setMessage('startLink')
          }, nextProvider) }}>
          <ClientProviderMark provider={labels[nextProvider]} />
          {t(nextProvider === 'GOOGLE' ? 'auth.google' : 'auth.apple')}
          {!available && <small className="native-provider-availability">{text('providerComingSoon')}</small>}
        </button>
      })}
    </div>
    {onEmailAuthenticated && <><div className="au-div">{t('auth.or')}</div><button className="au-btn ghost au-gap" disabled={!emailAvailable || busy || auth.hasMemoryIntent()} onClick={() => { if (emailAvailable && !working.current && !hidden && active.current && !auth.hasMemoryIntent()) setEmailOpen(true) }}>{text('emailLogin')}{!emailAvailable && <small className="native-provider-availability">{text('providerComingSoon')}</small>}</button></>}
    {(!sourceLayout || busy || providerLocked || error) && <p className={`native-auth-status${error ? ' au-err' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">{text(message)}</p>}
    <div className="native-auth-actions">
    {!confirmed && <>
      {restartable && <button disabled={busy} onClick={() => void run(async () => {
        const result = await auth.restart(provider); if (!active.current) return; setRedirect(result.authorizationRedirect); setReady(false)
        setMessage('newStart')
      })}>{text('restartProvider', { provider: labels[provider] })}</button>}
      {redirect && <p><a className="au-btn primary" href={redirect} rel="noreferrer">{text('openProvider', { provider: labels[provider] })}</a></p>}
      {providerLocked && <button disabled={busy} onClick={() => readResult(provider)}>{text('resultAfterReturn')}</button>}
      {ready && <button className="au-btn primary" disabled={busy} onClick={() => void run(async () => {
        const result = await auth.acknowledge(provider)
        if (!active.current) return
        await onAuthenticated(result); setConfirmed(true); setRedirect(null)
        setMessage('providerConfirmed')
      })}>{text('confirmLogin')}</button>}
    </>}
    {providerLocked && onSessionRecovered && <button disabled={busy} onClick={() => recoverSession(provider)}>{text('sessionOnly')}</button>}
    </div>
    {!providerLocked && (!sourceLayout || returning || window.location.pathname === '/auth/complete') && <details className="native-auth-recovery" open={typeof window !== 'undefined' && window.location.pathname === '/auth/complete'}>
      <summary>{text('recoveryTitle')}</summary>
      <p className="au-sub">{text('recoveryDescription')}</p>
      <div className="native-auth-actions">
        {providers.map(nextProvider => <Fragment key={nextProvider}>
          <button type="button" disabled={busy || !enabledProviders.includes(nextProvider)} onClick={() => readResult(nextProvider)}>{text('providerResult', { provider: labels[nextProvider] })}</button>
          {onSessionRecovered && <button type="button" disabled={busy || !enabledProviders.includes(nextProvider)} onClick={() => recoverSession(nextProvider)}>{text('providerSession', { provider: labels[nextProvider] })}</button>}
        </Fragment>)}
      </div>
    </details>}
    {sourceLayout && <div className="au-free">{t('auth.free')}</div>}
    {!sourceLayout && onClose && <button data-native-auth-close className="au-textbtn" disabled={busy} onClick={() => onClose(auth.hasMemoryIntent())}>{text('close')}</button>}
  </section>
}
