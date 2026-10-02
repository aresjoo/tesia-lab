import { useEffect, useId, useRef, type FormEvent } from 'react'
import { useClientPreferences } from '../client-preferences'
import { nativeAuthUiText, type NativeAuthUiCopyKey } from './native-auth-ui-copy'
import '../client-account-ui.css'

type EmailLoginPhase = 'email' | 'code' | 'recovery' | 'confirmed'

// Private presentation props, not an API schema or authentication receipt.
// The controller owns validation, time, permitted actions and session authority.
export interface NativeEmailLoginFormProps {
  phase: EmailLoginPhase
  email: string
  code: string
  busy: boolean
  statusText?: string
  error?: string
  /** Stable UI error identity; changing only its translation must not refocus. */
  errorIdentity?: string
  expiryText?: string
  resendText?: string
  canRequest: boolean
  canVerify: boolean
  canResend: boolean
  canRecover: boolean
  canEditEmail: boolean
  onEmailChange: (value: string) => void
  onCodeChange: (value: string) => void
  onRequest: () => void
  onVerify: () => void
  onResend: () => void
  onRecover: () => void
  onEditEmail: () => void
}

const titles: Record<EmailLoginPhase, NativeAuthUiCopyKey> = {
  email: 'emailLogin', code: 'codeTitle',
  recovery: 'emailRecoveryTitle', confirmed: 'emailConfirmedTitle',
}

export function NativeEmailLoginForm(props: NativeEmailLoginFormProps) {
  const { language } = useClientPreferences()
  const text = (key: NativeAuthUiCopyKey) => nativeAuthUiText(language, key)
  const { phase, email, code, busy, statusText, error, expiryText, resendText,
    canRequest, canVerify, canResend, canRecover, canEditEmail,
    onEmailChange, onCodeChange, onRequest, onVerify, onResend, onRecover, onEditEmail } = props
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  const errorIdentity = props.errorIdentity ?? error
  const describedBy = [statusText && `${id}-status`, error && `${id}-error`, phase === 'code' && expiryText && `${id}-expiry`].filter(Boolean).join(' ') || undefined

  useEffect(() => {
    if (busy) return
    const target = inputRef.current ?? messageRef.current
    if (target?.getClientRects().length && !target.closest('[hidden],[inert]') && getComputedStyle(target).visibility !== 'hidden') target.focus({ preventScroll: true })
  }, [phase, errorIdentity, busy])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    if (phase === 'email' && canRequest) onRequest()
    else if (phase === 'code' && canVerify) onVerify()
    else if (phase === 'recovery' && canRecover) onRecover()
  }

  // No modal or focus trap: the hosting surface owns close/return-focus/inert.
  // No timer, persistence, network or onComplete. A six-digit input is not proof.
  return <form className="ca-auth" aria-label={text('emailForm')} aria-busy={busy} noValidate onSubmit={submit}
    onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}>
    <h2 className="au-title">{text(titles[phase])}</h2>
    {statusText && <p className="au-sub" id={`${id}-status`} role="status">{statusText}</p>}
    {error && <p className="au-err" id={`${id}-error`} role="alert" ref={messageRef} tabIndex={-1}>{error}</p>}
    {phase === 'email' && <>
      <div className="au-field">
        <label className="au-label" htmlFor={`${id}-email`}>{text('emailAddress')}</label>
        <input ref={inputRef} className={`au-input${error ? ' bad' : ''}`} id={`${id}-email`} type="email" autoComplete="email"
          value={email} disabled={busy} aria-invalid={!!error} aria-describedby={describedBy}
          onChange={event => onEmailChange(event.target.value)} />
      </div>
      <button className="au-btn primary au-gap" type="submit" disabled={busy || !canRequest}>{text('requestCode')}</button>
    </>}
    {phase === 'code' && <>
      <p className="au-sub">{email}</p>
      <div className="au-field">
        <label className="au-label" htmlFor={`${id}-code`}>{text('codeLabel')}</label>
        <input ref={inputRef} className={`au-input${error ? ' bad' : ''}`} id={`${id}-code`} type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
          value={code} disabled={busy} aria-invalid={!!error} aria-describedby={describedBy}
          onChange={event => onCodeChange(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} />
      </div>
      {expiryText && <p className="au-sub" id={`${id}-expiry`}>{expiryText}</p>}
      <button className="au-btn primary au-gap" type="submit" disabled={busy || !canVerify}>{text('verifyCode')}</button>
      <button className="au-textbtn" type="button" disabled={busy || !canResend}
        onClick={() => { if (!busy && canResend) onResend() }}>{resendText || text('resendCode')}</button>
    </>}
    {phase === 'recovery' && <button className="au-btn primary au-gap" type="submit" disabled={busy || !canRecover}>{text('sameRequest')}</button>}
    {(phase === 'code' || phase === 'recovery') && <button className="au-textbtn" type="button" disabled={busy || !canEditEmail}
      onClick={() => { if (!busy && canEditEmail) onEditEmail() }}>{text('editEmail')}</button>}
  </form>
}
