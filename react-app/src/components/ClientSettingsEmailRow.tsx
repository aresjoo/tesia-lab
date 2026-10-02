import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import copy from '../client-settings-copy.json'
import { nativeAccountText } from '../internal-poc/native-account-presentation-copy'
import { useSettingsDialogRoute } from '../use-settings-dialog-route'
import type { ClientEmailChangeRequest, ClientEmailVerification } from '../client-settings-email-presentation'

type ErrorKey = 'emailInvalid' | 'emailSame' | 'emailCodeInvalid' | 'emailSendFailed' | 'emailVerifyFailed'

function EmailChangeDialog({ email, onRequest, onClose, onAccepted, trigger }: {
  email?: string
  onRequest?: ClientEmailChangeRequest
  onClose: () => void
  onAccepted: () => void
  trigger: HTMLButtonElement | null
}) {
  useSettingsDialogRoute(onClose)
  const { language } = useClientPreferences(), id = useId()
  const s = (key: keyof typeof copy) => copy[key][language]
  const [address, setAddress] = useState('')
  const [code, setCode] = useState('')
  const [verification, setVerification] = useState<ClientEmailVerification | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ErrorKey | null>(null)
  const dialog = useRef<HTMLDialogElement>(null), input = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null), port = useRef(onRequest)
  const backdropDown = useRef(false)
  const available = !!onRequest
  const [wasAvailable, setWasAvailable] = useState(available)
  if (wasAvailable !== available) {
    setWasAvailable(available)
    if (!available) { setVerification(null); setCode(''); setPending(false); setError(null) }
  }
  useLayoutEffect(() => { port.current = onRequest }, [onRequest])
  useLayoutEffect(() => {
    const element = dialog.current!
    const origin = location.href, overflow = document.body.style.getPropertyValue('overflow'), overflowPriority = document.body.style.getPropertyPriority('overflow')
    element.showModal(); document.body.style.overflow = 'hidden'
    const viewport = window.visualViewport
    const resize = () => {
      const height = viewport?.height ?? innerHeight, top = viewport?.offsetTop ?? 0
      element.style.setProperty('--settings-dialog-height', `${Math.max(1, height)}px`)
      element.style.setProperty('--settings-dialog-center', `${top + height / 2}px`)
    }
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize)
    window.addEventListener('resize', resize)
    return () => {
      request.current?.abort(); request.current = null
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize)
      window.removeEventListener('resize', resize)
      element.close()
      if (document.body.style.overflow === 'hidden') {
        if (overflow) document.body.style.setProperty('overflow', overflow, overflowPriority)
        else document.body.style.removeProperty('overflow')
      }
      queueMicrotask(() => {
        if (element.open || location.href !== origin || document.querySelector('dialog:modal')) return
        if (trigger?.isConnected && trigger.getClientRects().length && !trigger.closest('[inert],[hidden]') && !trigger.disabled) trigger.focus({ preventScroll: true })
      })
    }
  }, [trigger])
  useLayoutEffect(() => { input.current?.focus() }, [verification])
  useLayoutEffect(() => {
    if (!available) {
      request.current?.abort(); request.current = null
    }
  }, [available])
  const back = () => {
    request.current?.abort(); request.current = null
    setVerification(null); setCode(''); setPending(false); setError(null)
  }
  const submit = async () => {
    const send = port.current
    if (!send || request.current) return
    const value = address.trim().toLowerCase()
    const invalid: ErrorKey | null = verification
      ? !/^[0-9]{6}$/.test(code) ? 'emailCodeInvalid' : null
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? 'emailInvalid'
        : value === email?.trim().toLowerCase() ? 'emailSame' : null
    if (invalid) { setError(invalid); input.current?.focus(); return }
    const controller = new AbortController()
    request.current = controller; setPending(true); setError(null)
    try {
      if (verification) {
        await verification.verify(code, controller.signal)
        if (request.current !== controller || controller.signal.aborted || !port.current) return
        setCode(''); onAccepted()
      } else {
        const next = await send(value, controller.signal)
        if (request.current !== controller || controller.signal.aborted || !port.current) return
        if (!next || typeof next.verify !== 'function') throw new Error('Missing verification capability')
        setAddress(value); setCode(''); setVerification(next)
      }
    } catch {
      if (request.current === controller && !controller.signal.aborted && port.current) {
        setError(verification ? 'emailVerifyFailed' : 'emailSendFailed')
        if (verification) setCode('')
      }
    } finally {
      if (request.current === controller) { request.current = null; setPending(false) }
    }
  }
  const codeIntro = s('emailCodeIntro').split('{email}')
  const fieldError = error === 'emailInvalid' || error === 'emailSame' || error === 'emailCodeInvalid'
  return <dialog ref={dialog} className="client-settings-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-intro`} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }} onKeyDown={event => {
    event.stopPropagation()
    if ((event.key === 'Enter' || event.key === 'Escape') && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
    if (event.key === 'Tab') {
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)')].filter(node => node.getClientRects().length)
      const target = event.shiftKey ? controls.at(-1) : controls[0]
      if (document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1)) && target) { event.preventDefault(); target.focus() }
    }
  }} onPointerDown={event => {
    const box = event.currentTarget.getBoundingClientRect()
    backdropDown.current = event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)
  }} onPointerCancel={() => { backdropDown.current = false }} onClick={event => {
    const outside = backdropDown.current; backdropDown.current = false
    if (outside && event.target === event.currentTarget) {
      const box = event.currentTarget.getBoundingClientRect()
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose()
    }
  }}>
    <form noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <h2 id={`${id}-title`}>{s(verification ? 'emailCodeTitle' : 'emailChange')}</h2>
      <p id={`${id}-intro`}>{verification ? <>{codeIntro[0]}<b className="num">{address}</b>{codeIntro[1]}</> : s('emailIntro')}</p>
      <label className="ty" htmlFor={`${id}-input`}><span>{s(verification ? 'emailCode' : 'emailNew')}</span><input ref={input} key={verification ? 'code' : 'email'} id={`${id}-input`} type={verification ? 'text' : 'email'} inputMode={verification ? 'numeric' : 'email'} autoComplete={verification ? 'one-time-code' : 'off'} autoCapitalize="none" spellCheck={false} maxLength={verification ? 6 : undefined} readOnly={pending} placeholder={verification ? undefined : 'name@example.com'} value={verification ? code : address} aria-invalid={fieldError || undefined} aria-describedby={[error ? `${id}-error` : '', !available ? `${id}-unavailable` : ''].filter(Boolean).join(' ') || undefined} onChange={event => { if (verification) setCode(event.target.value.replace(/\D/g, '')); else setAddress(event.target.value); setError(null) }} /></label>
      {!available && <p className="hint" id={`${id}-unavailable`}>{s('actionUnavailable')}</p>}
      {error && <p className="er" role="alert" id={`${id}-error`}>{s(error)}</p>}
      {pending && <p className="hint" role="status">{s(verification ? 'emailVerifying' : 'emailSending')}</p>}
      <div className="bts"><button type="button" onClick={verification ? back : onClose}>{s(verification ? 'emailBack' : 'cancel')}</button><button type="submit" className="ok" disabled={!available || pending}>{s(verification ? 'emailChange' : 'emailSend')}</button></div>
    </form>
  </dialog>
}

/** Key by owner/dataset in the host and current email in ClientSettingsPage. */
export function ClientSettingsEmailRow({ email, onRequest }: { email?: string; onRequest?: ClientEmailChangeRequest }) {
  const { language } = useClientPreferences()
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null), [accepted, setAccepted] = useState(false)
  return <>
    <div className="stg-r" data-email-settings><div className="k"><b>{copy.email[language]}</b></div><div className="v num">{email || '—'}</div><div className="a"><button type="button" className="stg-b" onClick={event => { setAccepted(false); setTrigger(event.currentTarget) }}>{copy.change[language]}</button></div></div>
    {accepted && <p className="stg-storage" role="status">{nativeAccountText(language, 'accepted')}</p>}
    {trigger && <EmailChangeDialog email={email} onRequest={onRequest} trigger={trigger} onClose={() => setTrigger(null)} onAccepted={() => { setTrigger(null); setAccepted(true) }} />}
  </>
}
