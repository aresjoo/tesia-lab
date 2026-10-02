import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useSettingsDialogRoute } from '../use-settings-dialog-route'

/** Native modal shell with the source settings geometry. No payment/auth logic. */
export function ClientSettingsModal({ title, description, trigger, onClose, children, closeLabel }: {
  title: string; description?: string; trigger: HTMLButtonElement; onClose: () => void; children: ReactNode; closeLabel?: string
}) {
  useSettingsDialogRoute(onClose)
  const id = useId(), dialog = useRef<HTMLDialogElement>(null), backdropDown = useRef(false)
  useLayoutEffect(() => {
    const element = dialog.current!, origin = location.href
    const fallback = trigger.closest('.client-settings-page')?.querySelector<HTMLElement>('.stg-main h1')
    const overflow = document.body.style.getPropertyValue('overflow'), priority = document.body.style.getPropertyPriority('overflow')
    element.showModal(); document.body.style.overflow = 'hidden'
    const viewport = window.visualViewport
    const resize = () => {
      const height = viewport?.height ?? innerHeight, top = viewport?.offsetTop ?? 0
      element.style.setProperty('--settings-dialog-height', `${Math.max(1, height)}px`)
      element.style.setProperty('--settings-dialog-center', `${top + height / 2}px`)
    }
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize)
    window.addEventListener('resize', resize)
    element.querySelector<HTMLElement>('[data-settings-autofocus]:not(:disabled),button:not(:disabled)')?.focus()
    return () => {
      viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize)
      window.removeEventListener('resize', resize); element.close()
      if (document.body.style.overflow === 'hidden') {
        if (overflow) document.body.style.setProperty('overflow', overflow, priority)
        else document.body.style.removeProperty('overflow')
      }
      queueMicrotask(() => {
        if (element.open || location.href !== origin || document.querySelector('dialog:modal')) return
        if (trigger.isConnected && trigger.getClientRects().length && !trigger.closest('[inert],[hidden]') && !trigger.disabled) trigger.focus({ preventScroll: true })
        // A new supplied snapshot can replace the opener without replacing the
        // page. Recover its stable heading only if focus is otherwise lost;
        // never reclaim a newer external focus or a different owner/page.
        else if (document.activeElement === document.body && fallback?.isConnected && fallback.getClientRects().length && !fallback.closest('[inert],[hidden]')) fallback.focus({ preventScroll: true })
      })
    }
  }, [trigger])
  return <dialog ref={dialog} className="client-settings-dialog" aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose() }}
    onKeyDown={event => {
      event.stopPropagation()
      // The primary request may focus Cancel once it becomes disabled. Holding
      // its activation key must not activate that new target on key repeat.
      if (event.repeat && event.target instanceof HTMLButtonElement && (event.key === 'Enter' || event.key === ' ')) event.preventDefault()
      if ((event.key === 'Enter' || event.key === 'Escape') && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
      if (event.key === 'Tab') {
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')].filter(node => node.getClientRects().length)
        const target = event.shiftKey ? controls.at(-1) : controls[0]
        if (target && document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1))) { event.preventDefault(); target.focus() }
      }
    }}
    onPointerDown={event => { const box = event.currentTarget.getBoundingClientRect(); backdropDown.current = event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) }}
    onPointerCancel={() => { backdropDown.current = false }}
    onClick={event => {
      const outside = backdropDown.current; backdropDown.current = false
      const box = event.currentTarget.getBoundingClientRect()
      if (outside && event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) onClose()
    }}>
    {closeLabel && <button type="button" className="stg-dialog-close" aria-label={closeLabel} onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>}
    <h2 className={closeLabel ? 'has-close' : undefined} id={`${id}-title`}>{title}</h2>
    {description && <p id={`${id}-description`}>{description}</p>}
    {children}
  </dialog>
}
