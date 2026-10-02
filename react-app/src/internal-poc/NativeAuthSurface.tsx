import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useClientPreferences } from '../client-preferences'
import './native-auth-surface.css'

/** A single retained auth subtree, independent of the current product page.
 * Native dialog supplies top-layer modality, focus containment and background
 * inertness. Dismissal still goes through the controller's guarded close action.
 */
export function NativeAuthSurface({ open, children }: { open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useClientPreferences()
  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!open) { if (dialog.open) dialog.close(); return }
    const body = document.body.style, overflow = body.getPropertyValue('overflow'), priority = body.getPropertyPriority('overflow')
    if (!dialog.open) dialog.showModal()
    body.setProperty('overflow', 'hidden')
    return () => {
      if (dialog.open) dialog.close()
      if (overflow) body.setProperty('overflow', overflow, priority)
      else body.removeProperty('overflow')
    }
  }, [open])
  const dismiss = () => {
    const close = ref.current?.querySelector<HTMLButtonElement>('[data-native-auth-close]')
    if (close && !close.disabled && close.getAttribute('aria-disabled') !== 'true') close.click()
  }
  return createPortal(<dialog ref={ref} className="native-auth-surface" aria-label={t('nav.login')}
    onCancel={event => { event.preventDefault(); dismiss() }}
    onClick={event => { if (event.target === event.currentTarget) dismiss() }}>{children}</dialog>, document.body)
}
