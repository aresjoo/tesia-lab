import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useClientPreferences } from '../client-preferences'
import copy from '../client-settings-copy.json'
import { securityText } from '../client-settings-security-copy'
import type { ClientSecurityActions, ClientSecurityPresentation } from '../client-settings-security-presentation'
import { nativeAccountText } from '../internal-poc/native-account-presentation-copy'
import { useSettingsDialogRoute } from '../use-settings-dialog-route'

type Action = 'password' | 'twoFactor' | 'logoutOthers'
type Props = { data?: ClientSecurityPresentation; actions?: ClientSecurityActions; scopeId?: string | null }
type SourceAction = { kind: 'logoutDevice' | 'disconnectExchange'; id: string; label: string; trigger: HTMLButtonElement }
const sourceId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 320
  && id.trim() === id && ![...id].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)

function SourceActionDialog({ target, callback, onClose, onAccepted }: {
  target: SourceAction; callback?: (id: string, signal: AbortSignal) => Promise<void>
  onClose: () => void; onAccepted: () => void
}) {
  useSettingsDialogRoute(onClose)
  const { language } = useClientPreferences(), id = useId()
  const s = (key: keyof typeof copy) => copy[key][language]
  const t = (key: Parameters<typeof securityText>[1]) => securityText(language, key)
  const dialog = useRef<HTMLDialogElement>(null), request = useRef<AbortController | null>(null)
  const initialCallback = useRef(callback), currentCallback = useRef(callback), backdrop = useRef(false)
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false)
  useLayoutEffect(() => {
    currentCallback.current = callback
    if (initialCallback.current !== callback) { request.current?.abort(); request.current = null; onClose() }
  }, [callback, onClose])
  useLayoutEffect(() => {
    const element = dialog.current!, origin = location.href
    const overflow = document.body.style.getPropertyValue('overflow'), priority = document.body.style.getPropertyPriority('overflow')
    element.showModal(); document.body.style.overflow = 'hidden'
    element.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      request.current?.abort(); request.current = null; element.close()
      if (document.body.style.overflow === 'hidden') {
        if (overflow) document.body.style.setProperty('overflow', overflow, priority)
        else document.body.style.removeProperty('overflow')
      }
      queueMicrotask(() => {
        if (location.href === origin && !document.querySelector('dialog:modal') && target.trigger.isConnected
          && !target.trigger.disabled && !target.trigger.closest('[inert],[hidden]')) target.trigger.focus({ preventScroll: true })
      })
    }
  }, [target])
  const submit = async () => {
    const action = currentCallback.current
    if (!action || request.current || !sourceId(target.id)) return
    const controller = new AbortController(); request.current = controller; setPending(true); setFailed(false)
    try {
      await action(target.id, controller.signal)
      if (request.current === controller && !controller.signal.aborted && currentCallback.current === action) onAccepted()
    } catch {
      if (request.current === controller && !controller.signal.aborted && currentCallback.current === action) setFailed(true)
    } finally {
      if (request.current === controller) { request.current = null; setPending(false) }
    }
  }
  const disconnect = target.kind === 'disconnectExchange'
  return <dialog ref={dialog} className="client-settings-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onKeyDown={event => { event.stopPropagation(); if ((event.key === 'Enter' || event.key === 'Escape') && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }}
    onPointerDown={event => { const r = event.currentTarget.getBoundingClientRect(); backdrop.current = event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) }}
    onPointerCancel={() => { backdrop.current = false }}
    onClick={event => { const outside = backdrop.current; backdrop.current = false; if (outside && event.target === event.currentTarget) onClose() }}>
    <form onSubmit={event => { event.preventDefault(); void submit() }}>
      <h2 id={`${id}-title`}>{t(disconnect ? 'disconnectTitle' : 'logoutDeviceTitle').replace('{label}', target.label)}</h2>
      <p id={`${id}-hint`}>{t(disconnect ? 'disconnectHint' : 'logoutDeviceHint')}</p>
      <p>{t('requestHint')}</p>
      {failed && <p role="alert" className="er">{t('failed')}</p>}
      {pending && <p role="status" className="hint">{t('working')}</p>}
      <div className="bts"><button type="button" onClick={onClose}>{s('cancel')}</button><button type="submit" className="ok dg" disabled={!callback || pending} aria-busy={pending}>{disconnect ? t('disconnectExchange') : s('logout')}</button></div>
    </form>
  </dialog>
}

function SecurityDialog({ kind, enabled, actions, trigger, onClose, onAccepted }: {
  kind: Action; enabled?: boolean; actions?: ClientSecurityActions; trigger: HTMLButtonElement
  onClose: () => void; onAccepted: () => void
}) {
  useSettingsDialogRoute(onClose)
  const { language } = useClientPreferences(), id = useId()
  const s = (key: keyof typeof copy) => copy[key][language]
  const t = (key: Parameters<typeof securityText>[1]) => securityText(language, key)
  const dialog = useRef<HTMLDialogElement>(null), first = useRef<HTMLInputElement>(null)
  const request = useRef<AbortController | null>(null), ports = useRef(actions), backdropDown = useRef(false)
  const [values, setValues] = useState(['', '', ''])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ field?: number; key: Parameters<typeof securityText>[1] | 'policy' } | null>(null)
  const available = !!actions?.[kind] && (kind !== 'twoFactor' || typeof enabled === 'boolean')
  const [wasAvailable, setWasAvailable] = useState(available)
  if (wasAvailable !== available) {
    setWasAvailable(available)
    if (!available) { setValues(['', '', '']); setPending(false); setError(null) }
  }
  useLayoutEffect(() => { ports.current = actions }, [actions])
  useLayoutEffect(() => {
    if (!available) {
      request.current?.abort(); request.current = null
      dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    }
  }, [available])
  useLayoutEffect(() => {
    const element = dialog.current!
    const origin = location.href, overflow = document.body.style.getPropertyValue('overflow'), priority = document.body.style.getPropertyPriority('overflow')
    element.showModal(); document.body.style.overflow = 'hidden'
    const viewport = window.visualViewport
    const resize = () => {
      const height = viewport?.height ?? innerHeight, top = viewport?.offsetTop ?? 0
      element.style.setProperty('--settings-dialog-height', `${Math.max(1, height)}px`)
      element.style.setProperty('--settings-dialog-center', `${top + height / 2}px`)
    }
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize)
    window.addEventListener('resize', resize)
    // Destructive confirmations start on Cancel, not the confirming action.
    if (kind === 'password' && first.current && !first.current.disabled) first.current.focus()
    else element.querySelector<HTMLButtonElement>('button')?.focus()
    return () => {
      request.current?.abort(); request.current = null
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize)
      window.removeEventListener('resize', resize); element.close()
      if (document.body.style.overflow === 'hidden') {
        if (overflow) document.body.style.setProperty('overflow', overflow, priority)
        else document.body.style.removeProperty('overflow')
      }
      queueMicrotask(() => {
        if (element.open || location.href !== origin || document.querySelector('dialog:modal')) return
        if (trigger.isConnected && trigger.getClientRects().length && !trigger.closest('[inert],[hidden]') && !trigger.disabled) trigger.focus({ preventScroll: true })
      })
    }
  }, [kind, trigger])
  const submit = async () => {
    const action = ports.current?.[kind]
    if (!action || !available || request.current) return
    if (kind === 'password') {
      let invalid: { field: number; key: Parameters<typeof securityText>[1] | 'policy' } | null = null
      if (!values[0]) invalid = { field: 0, key: 'currentRequired' }
      else if (!values[1]) invalid = { field: 1, key: 'passwordRequired' }
      else if (values[1] !== values[2]) invalid = { field: 2, key: 'mismatch' }
      else if (values[0] === values[1]) invalid = { field: 1, key: 'same' }
      else {
        try {
          if (!ports.current!.password!.accepts(values[1])) invalid = { field: 1, key: 'policy' }
        } catch { invalid = { field: 1, key: 'failed' } }
      }
      if (invalid) { setError(invalid); dialog.current?.querySelectorAll('input')[invalid.field]?.focus(); return }
    }
    const controller = new AbortController()
    request.current = controller; setPending(true); setError(null)
    const current = values[0], next = values[1]
    setValues(['', '', ''])
    try {
      if (kind === 'password') await ports.current!.password!.submit(current, next, controller.signal)
      else if (kind === 'twoFactor') await ports.current!.twoFactor!(!enabled, controller.signal)
      else await ports.current!.logoutOthers!(controller.signal)
      if (request.current !== controller || controller.signal.aborted || !ports.current?.[kind]) return
      onAccepted()
    } catch {
      if (request.current === controller && !controller.signal.aborted && ports.current?.[kind]) setError({ key: 'failed' })
    } finally {
      if (request.current === controller) { request.current = null; setPending(false) }
    }
  }
  const title = kind === 'password' ? t('passwordTitle') : kind === 'twoFactor' ? t(enabled ? 'disable' : 'enable') : t('logoutTitle')
  return <dialog ref={dialog} className="client-settings-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-intro`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onKeyDown={event => {
      event.stopPropagation()
      if ((event.key === 'Enter' || event.key === 'Escape') && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
      if (event.key === 'Tab') {
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)')].filter(node => node.getClientRects().length)
        const target = event.shiftKey ? controls.at(-1) : controls[0]
        if (target && document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1))) { event.preventDefault(); target.focus() }
      }
    }}
    onPointerDown={event => { const r = event.currentTarget.getBoundingClientRect(); backdropDown.current = event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) }}
    onPointerCancel={() => { backdropDown.current = false }}
    onClick={event => {
      const outside = backdropDown.current; backdropDown.current = false
      const r = event.currentTarget.getBoundingClientRect()
      if (outside && event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) onClose()
    }}>
    <form noValidate onSubmit={event => { event.preventDefault(); void submit() }}>
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-intro`}>{t('requestHint')}</p>
      {kind === 'password' && <>
        {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((label, index) => <label className="ty" key={label} htmlFor={`${id}-${index}`}><span>{t(label)}</span><input ref={index === 0 ? first : undefined} id={`${id}-${index}`} type="password" autoComplete={index === 0 ? 'current-password' : 'new-password'} disabled={!available} readOnly={pending} value={values[index]} aria-invalid={error?.field === index || undefined} aria-describedby={[`${id}-policy`, error?.field === index ? `${id}-error` : '', !available ? `${id}-unavailable` : ''].filter(Boolean).join(' ')} onChange={event => { setValues(values.map((value, i) => i === index ? event.target.value : value)); setError(null) }} /></label>)}
        <p className="hint" id={`${id}-policy`}>{actions?.password?.hint}</p>
      </>}
      {!available && <p className="hint" id={`${id}-unavailable`}>{s('actionUnavailable')}</p>}
      {error && <p className="er" id={`${id}-error`} role="alert">{error.key === 'policy' ? actions?.password?.hint : t(error.key)}</p>}
      {pending && <p className="hint" role="status">{t('working')}</p>}
      <div className="bts"><button type="button" onClick={onClose}>{s('cancel')}</button><button type="submit" className={`ok${kind === 'twoFactor' && enabled ? ' dg' : ''}`} disabled={!available || pending}>{kind === 'password' ? s('change') : kind === 'logoutOthers' ? s('logout') : t('confirm')}</button></div>
    </form>
  </dialog>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="stg-sec"><header><h2>{title}</h2></header><div className="stg-card">{children}</div></section>
}
function Row({ label, value, hint, action, marker }: { label: string; value?: ReactNode; hint?: ReactNode; action?: ReactNode; marker?: string }) {
  return <div className="stg-r stg-security-row" data-security-row={marker}><div className="k"><b>{label}</b>{hint && <span>{hint}</span>}</div>{value !== undefined && <div className="v">{value}</div>}{action && <div className="a">{action}</div>}</div>
}

/** Parent is keyed by owner/dataset; snapshot changes invalidate active dialogs. */
export function ClientSettingsSecurity({ data, actions, scopeId }: Props) {
  return <SecurityContent key={JSON.stringify([scopeId ?? null, data ?? null])} data={data} actions={actions} />
}
function SecurityContent({ data, actions }: Props) {
  const { language } = useClientPreferences(), id = useId()
  const s = (key: keyof typeof copy) => copy[key][language]
  const t = (key: Parameters<typeof securityText>[1]) => securityText(language, key)
  const [active, setActive] = useState<{ kind: Action; trigger: HTMLButtonElement } | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [sourceAction, setSourceAction] = useState<SourceAction | null>(null)
  const [connecting, setConnecting] = useState(false), [connectFailed, setConnectFailed] = useState(false)
  const connectRequest = useRef<AbortController | null>(null), connectPort = useRef(actions?.connectExchange)
  useLayoutEffect(() => {
    if (connectPort.current !== actions?.connectExchange) { connectRequest.current?.abort(); connectRequest.current = null; setConnecting(false); setConnectFailed(false) }
    connectPort.current = actions?.connectExchange
    return () => { connectRequest.current?.abort(); connectRequest.current = null }
  }, [actions?.connectExchange])
  const connect = async () => {
    const action = connectPort.current
    if (!action || connectRequest.current) return
    const request = new AbortController(); connectRequest.current = request
    setConnecting(true); setConnectFailed(false); setAccepted(false)
    try {
      await action(request.signal)
      if (connectRequest.current === request && !request.signal.aborted && connectPort.current === action) setAccepted(true)
    } catch {
      if (connectRequest.current === request && !request.signal.aborted && connectPort.current === action) setConnectFailed(true)
    } finally {
      if (connectRequest.current === request) { connectRequest.current = null; setConnecting(false) }
    }
  }
  const sourceButton = (kind: SourceAction['kind'], targetId: string, label: string, buttonLabel: string, reasonId: string) => <button type="button" className="stg-b"
    disabled={!sourceId(targetId) || !actions?.[kind]} aria-describedby={!sourceId(targetId) || !actions?.[kind] ? reasonId : undefined}
    onClick={event => { if (sourceId(targetId) && actions?.[kind]) { setAccepted(false); setSourceAction({ kind, id: targetId, label, trigger: event.currentTarget }) } }}>{buttonLabel}</button>
  const open = (kind: Action, trigger: HTMLButtonElement) => { setAccepted(false); setActive({ kind, trigger }) }
  const unavailable = <p className="stg-empty">{s('unavailable')}</p>
  const twoFactor = data?.twoFactor
  return <div className="stg-security">
    {data?.sourceLabel && <p className="stg-source">{data.sourceLabel}</p>}
    {accepted && <p className="stg-storage" role="status">{nativeAccountText(language, 'accepted')}</p>}
    <Section title={s('login')}>
      <Row marker="password" label={s('password')} value={data?.password?.statusLabel ?? '—'} hint={data?.password?.hint} action={<button type="button" className="stg-b" onClick={event => open('password', event.currentTarget)}>{s('change')}</button>} />
      <Row marker="twoFactor" label={s('twofa')} hint={<>{twoFactor?.description}{!actions?.twoFactor && <span id={`${id}-twofa-unavailable`}>{s('actionUnavailable')}</span>}</>} value={twoFactor ? t(twoFactor.enabled ? 'on' : 'off') : s('unavailable')} action={twoFactor && <button type="button" className="stg-supplied-switch" role="switch" aria-label={s('twofa')} aria-checked={twoFactor.enabled} aria-describedby={!actions?.twoFactor ? `${id}-twofa-unavailable` : undefined} disabled={!actions?.twoFactor} onClick={event => open('twoFactor', event.currentTarget)}><i /></button>} />
    </Section>
    <Section title={t('devicesTitle')}>
      {!data?.devices ? unavailable : data.devices.length === 0 ? <p className="stg-empty">{t('noDevices')}</p> : data.devices.map((device, index) => {
        const reasonId = `${id}-device-${index}`
        return <Row key={device.id} marker={`device:${device.id}`} label={device.label}
          hint={<>{device.activityLabel}{device.current === false && (!sourceId(device.id) || !actions?.logoutDevice) && <span id={reasonId}>{s('actionUnavailable')}</span>}</>}
          value={device.current ? <span className="stg-badge">{t('currentDevice')}</span> : undefined}
          action={device.current === false && sourceButton('logoutDevice', device.id, device.label, s('logout'), reasonId)} />
      })}
      <Row marker="logoutOthers" label={t('otherDevicesTitle')} hint={<>{t('otherDevicesHint')}{!actions?.logoutOthers && <span id={`${id}-logout-unavailable`}>{s('actionUnavailable')}</span>}</>} action={<button type="button" className="stg-b" disabled={!actions?.logoutOthers} aria-describedby={!actions?.logoutOthers ? `${id}-logout-unavailable` : undefined} onClick={event => open('logoutOthers', event.currentTarget)}>{t('logoutAll')}</button>} />
    </Section>
    <Section title={t('exchangesTitle')}>
      {!data?.permissions ? unavailable : data.permissions.length === 0 ? <Row marker="connectExchange" label={t('noPermissions')}
        hint={<>{t('emptyExchangeHint')}{!actions?.connectExchange && <span id={`${id}-connect-unavailable`}>{s('actionUnavailable')}</span>}</>}
        action={<button type="button" className="stg-b" disabled={!actions?.connectExchange || connecting} aria-busy={connecting} aria-describedby={!actions?.connectExchange ? `${id}-connect-unavailable` : undefined} onClick={() => { void connect() }}>{t('connectExchange')}</button>} /> : data.permissions.map((permission, index) => {
          const connection = permission.exchangeConnection, reasonId = `${id}-exchange-${index}`
          return <Row key={permission.id} marker={`permission:${permission.id}`} label={permission.label} value={permission.value}
            hint={<>{permission.description}{connection && (!sourceId(connection.id) || !actions?.disconnectExchange) && <span id={reasonId}>{s('actionUnavailable')}</span>}</>}
            action={connection && sourceButton('disconnectExchange', connection.id, permission.label, t('disconnectExchange'), reasonId)} />
        })}
      {connectFailed && <p className="er" role="alert">{t('failed')}</p>}
    </Section>
    {active && <SecurityDialog kind={active.kind} enabled={twoFactor?.enabled} actions={actions} trigger={active.trigger} onClose={() => setActive(null)} onAccepted={() => { setActive(null); setAccepted(true) }} />}
    {sourceAction && <SourceActionDialog target={sourceAction} callback={actions?.[sourceAction.kind]} onClose={() => setSourceAction(null)} onAccepted={() => { setSourceAction(null); setAccepted(true) }} />}
  </div>
}
