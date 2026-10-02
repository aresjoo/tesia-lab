import { nativeAuthUiText, type NativeAuthUiCopyKey } from './native-auth-ui-copy'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { NativeEmailLoginForm } from './NativeEmailLoginForm'
import { createNativeEmailAuth, type NativeEmailAuthenticated } from './native-email-auth'
import type { EmailChallengeData } from './contracts/generated/api-v0.9/types'
import type { NativeSessionRecovery } from './native-browser-auth'

export function NativeEmailLoginPanel({ hidden, resumeToken, expectedSessionId, isCurrent, onAuthenticated, onSessionRecovered, onClose, canDispatch, acquireDispatch }: {
  hidden: boolean; resumeToken: number; expectedSessionId?: string; isCurrent: () => boolean
  canDispatch: boolean; acquireDispatch?: () => (() => void) | null
  onAuthenticated: (result: NativeEmailAuthenticated) => void | Promise<void>
  onSessionRecovered?: (result: NativeSessionRecovery) => void | Promise<void>
  onClose?: (retain?: boolean) => void
}) {
  const { language } = useClientPreferences()
  const text = (key: NativeAuthUiCopyKey, params?: Readonly<Record<string, string>>) => nativeAuthUiText(language, key, params)
  const active = useRef(true), live = useRef({ hidden, isCurrent, canDispatch })
  const releaseDispatch = useRef<(() => void) | null>(null)
  useLayoutEffect(() => { live.current = { hidden, isCurrent, canDispatch } }, [hidden, isCurrent, canDispatch])
  // The constructor stores this callback; it never reads its refs during render.
  // eslint-disable-next-line react-hooks/refs
  const [auth] = useState(() => createNativeEmailAuth({ expectedSessionId, isCurrent: () => active.current && live.current.isCurrent() }))
  useLayoutEffect(() => {
    active.current = true
    return () => { active.current = false; releaseDispatch.current?.(); queueMicrotask(() => { if (!active.current) auth.dispose() }) }
  }, [auth])
  const [email, setEmail] = useState(''), [code, setCode] = useState('')
  const [phase, setPhase] = useState<'email' | 'code' | 'recovery' | 'confirmed'>(() => auth.hasLocator() ? 'recovery' : 'email')
  const [observedResume, setObservedResume] = useState(resumeToken)
  const [challenge, setChallenge] = useState<EmailChallengeData | null>(null)
  const [busy, setBusy] = useState(false), working = useRef(false)
  const [message, setMessage] = useState<NativeAuthUiCopyKey>('emailInitial')
  const [error, setError] = useState<NativeAuthUiCopyKey | ''>(''), [now, setNow] = useState(Date.now)
  const needsResume = observedResume !== resumeToken
  const visiblePhase = needsResume ? 'recovery' : phase
  useEffect(() => {
    if (hidden || !challenge || phase !== 'code') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hidden, challenge, phase])
  const currentView = () => active.current && live.current.isCurrent() && !live.current.hidden
  const accept = async (result: Awaited<ReturnType<typeof auth.retryPending>>) => {
    if (!currentView()) return
    setObservedResume(resumeToken)
    if ('verification' in result) {
      setCode(''); setEmail(''); setPhase('confirmed')
      await onAuthenticated(result)
    } else {
      setChallenge(result); setPhase('code'); setCode('')
      setMessage(result.deliveryStatus === 'ACCEPTED' ? 'emailAccepted'
        : result.deliveryStatus === 'UNKNOWN' ? 'emailUnknown' : 'emailDeliveryFailed')
    }
  }
  const run = async (operation: () => Promise<void>) => {
    if (working.current || !currentView() || !live.current.canDispatch) return
    const release = acquireDispatch ? acquireDispatch() : () => undefined
    if (!release) return
    releaseDispatch.current = release
    working.current = true; setBusy(true); setError('')
    try { await operation() } catch (failure) {
      if (!currentView()) return
      const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : ''
      setError(code === 'CODE_INVALID' ? 'emailCodeInvalid'
        : code === 'CHALLENGE_EXPIRED' ? 'emailExpired'
          : code === 'MAIL_DISABLED' ? 'emailDisabled'
            : code === 'RATE_LIMITED' ? 'emailRateLimited'
              : 'emailFailure')
      if (auth.hasPending()) setPhase('recovery')
      else if (['MAIL_DISABLED', 'RATE_LIMITED', 'BAD_REQUEST', 'INVALID_OPERATION_INPUT'].includes(String(code))) { setPhase('email'); setChallenge(null) }
    } finally { release(); releaseDispatch.current = null; working.current = false; if (active.current) setBusy(false) }
  }
  const request = () => run(async () => { await accept(await auth.requestCode(email)) })
  const editEmail = () => run(async () => {
    await auth.prepareNewRequest()
    if (!currentView()) return
    setObservedResume(resumeToken); setEmail(''); setCode(''); setChallenge(null); setPhase('email')
    setMessage('emailNewRequest')
  })
  const recover = () => run(async () => {
    // First GET never rotates anonymous CSRF. AUTH cookie/body-loss recovery and
    // old-ANON exact memory replay stay distinct under this one explicit click.
    let result: NativeSessionRecovery
    try { result = await auth.recoverSession() } catch (failure) {
      if (auth.hasPending() && failure && typeof failure === 'object' && 'code' in failure
        && (failure.code === 'AUTH_MEMORY_INTENT_REQUIRED' || failure.code === 'AUTH_SESSION_UNAVAILABLE')) {
        await accept(await auth.retryPending()); return
      }
      throw failure
    }
    if (!currentView()) return
    setObservedResume(resumeToken); setEmail(''); setCode(''); setPhase('confirmed')
    await onSessionRecovered?.(result)
    setMessage('emailSessionOnly')
  })
  return <section hidden={hidden} inert={hidden} aria-label={text('authSection')} aria-busy={busy} className="cs-native-login">
    <NativeEmailLoginForm phase={visiblePhase} email={needsResume ? '' : email} code={needsResume ? '' : code} busy={busy || !canDispatch}
      statusText={text(needsResume ? 'emailHidden' : message)}
      error={error ? text(error) : ''} errorIdentity={error} expiryText={challenge ? text('emailExpiresAt', { timestamp: challenge.expiresAt }) : undefined}
      resendText={challenge && now < Date.parse(challenge.resendAllowedAt) ? text('emailResendAt', { timestamp: challenge.resendAllowedAt }) : text('resendCode')}
      canRequest={Boolean(email) && !auth.hasPending()} canVerify={code.length === 6 && !!challenge && now < Date.parse(challenge.expiresAt) && !auth.hasPending()}
      canResend={!!challenge && now >= Date.parse(challenge.resendAllowedAt) && !auth.hasPending()}
      canRecover={true} canEditEmail={!auth.hasPending() && (visiblePhase === 'recovery' || !!challenge)}
      onEmailChange={setEmail} onCodeChange={setCode} onRequest={() => void request()} onVerify={() => void run(async () => { await accept(await auth.verifyCode(code)) })}
      onResend={() => void request()} onRecover={() => void recover()} onEditEmail={() => void editEmail()} />
    {!auth.storageAvailable() && <p role="status">{text('emailStorageUnavailable')}</p>}
    {!canDispatch && <p role="status">{text('emailDispatchBlocked')}</p>}
    <p>{text('emailPrivacy')}</p>
    {onClose && <button data-native-auth-close disabled={busy} onClick={() => onClose(auth.hasMemoryIntent() || auth.hasLocator())}>{text('close')}</button>}
  </section>
}
