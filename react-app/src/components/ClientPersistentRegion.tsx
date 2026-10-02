import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Relocate one host without replacing its React subtree or controlled inputs. */
export function ClientPersistentRegion({ target, children, className = 'client-persistent-region', contents = false }: {
  target?: HTMLElement | null; children: ReactNode; className?: string; contents?: boolean
}) {
  const fallback = useRef<HTMLDivElement>(null)
  const [host] = useState(() => document.createElement('div'))
  const detachedFocus = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    host.setAttribute('class', className)
    host.setAttribute('style', contents ? 'display: contents' : '')
  }, [host, className, contents])
  useLayoutEffect(() => () => {
    // React may detach/reconnect effects without replacing the subtree (strict
    // effects and hidden boundaries). Remember focus before DOM removal; the
    // next setup can restore it, but never override another focused control.
    detachedFocus.current = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? document.activeElement : null
    host.remove()
  }, [host])
  useLayoutEffect(() => {
    const destination = target ?? fallback.current
    if (!destination || host.parentElement === destination) return
    const active = document.activeElement instanceof HTMLElement && host.contains(document.activeElement) ? document.activeElement : detachedFocus.current
    detachedFocus.current = null
    destination.appendChild(host)
    if (active?.isConnected && active.getClientRects().length && !active.closest('[hidden],[inert]')
      && (document.activeElement === document.body || document.activeElement === active)) active.focus({ preventScroll: true })
  }, [host, target])
  return <><div ref={fallback} className={`${className}-home`} style={contents ? { display: 'contents' } : undefined} />{createPortal(children, host)}</>
}
