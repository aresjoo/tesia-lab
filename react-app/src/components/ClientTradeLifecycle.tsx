import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useClientPreferences } from '../client-preferences'
import { lifecycleText } from '../client-trade-lifecycle-copy'
import '../client-trade-lifecycle.css'

export type ClientTradeLifecycleProps = {
  title: string
  /** A supplied result summary is not necessarily a trade decision log. */
  regionLabel?: string
  steps: readonly { title: string; value: string; description: string }[]
  trigger: HTMLElement | null
  onClose: () => void
}

function available(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element?.isConnected && element.getClientRects().length && !element.closest('[hidden],[inert]') && !element.matches(':disabled') && getComputedStyle(element).visibility === 'visible')
}

/** Source 42a0d81 tfTmTradeDlg: presentation only. The caller owns every trade value. */
export function ClientTradeLifecycle({ title, regionLabel, steps, trigger, onClose }: ClientTradeLifecycleProps) {
  const { language } = useClientPreferences()
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const closeRef = useRef(onClose)
  const backdropDown = useRef(false)
  const [host] = useState(() => trigger?.closest('dialog[open]') ?? document.body)
  const [fallback] = useState(() => trigger?.closest<HTMLElement>('.client-account-terminal,main') ?? null)
  useLayoutEffect(() => { closeRef.current = onClose }, [onClose])
  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const origin = window.location.href
    const overflow = document.body.style.overflow
    let navigating = false
    element.showModal()
    document.body.style.overflow = 'hidden'
    element.querySelector<HTMLButtonElement>('.dx')?.focus({ preventScroll: true })
    const navigate = () => {
      if (window.location.href !== origin) { navigating = true; closeRef.current() }
    }
    const parentClosed = (event: Event) => { if (event.target === host) closeRef.current() }
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    window.addEventListener('teth:navigate', navigate)
    host.addEventListener('close', parentClosed)
    return () => {
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('popstate', navigate)
      window.removeEventListener('teth:navigate', navigate)
      host.removeEventListener('close', parentClosed)
      element.close()
      // A parent dialog may already have released its own lock during navigation.
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = overflow
      queueMicrotask(() => {
        // StrictMode's immediate remount must keep focus in the reopened dialog.
        if (element.open || navigating || window.location.href !== origin) return
        const top = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)
        if (available(trigger) && (!top || top.contains(trigger))) { trigger.focus({ preventScroll: true }); return }
        const scope = top ?? (available(fallback) ? fallback : document.body)
        const target = [...scope.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]')].find(candidate => available(candidate) && candidate.tabIndex >= 0)
        if (target) { target.focus({ preventScroll: true }); return }
        if (!available(scope)) return
        const tabIndex = scope.getAttribute('tabindex')
        scope.setAttribute('tabindex', '-1'); scope.focus({ preventScroll: true })
        if (tabIndex === null) scope.removeAttribute('tabindex'); else scope.setAttribute('tabindex', tabIndex)
      })
    }
  }, [host, trigger, fallback])

  return createPortal(<dialog ref={dialog} className="client-trade-lifecycle" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
  }} onPointerDown={event => {
    const bounds = event.currentTarget.getBoundingClientRect()
    backdropDown.current = event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)
  }} onClick={event => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (backdropDown.current && event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) onClose()
    backdropDown.current = false
  }}>
    <div className="din" tabIndex={0} role="region" aria-label={regionLabel ?? lifecycleText(language, 'region')}>
      <header className="dh2"><h2 id={`${id}-title`}>{title}</h2><button type="button" className="dx" aria-label={lifecycleText(language, 'close')} onClick={onClose}>✕</button></header>
      <ol className="tft-lc num" role="list">{steps.map((step, index) => <li className="lc1" key={index}>
        <span className="n2" aria-hidden="true">{index + 1}</span><div className="b2"><div className="lc-heading"><b>{step.title}</b><span className="v2">{step.value}</span></div><p>{step.description}</p></div>
      </li>)}</ol>
      {!steps.length && <p className="empty">{lifecycleText(language, 'empty')}</p>}
    </div>
  </dialog>, host)
}
