import { Component, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { InternalLink } from './InternalLink'
import { activeClientSurfaceSelector } from '../use-client-surface-presence'
import { useClientPreferences } from '../client-preferences'
import { clientLoadRecoveryCopy } from '../client-load-recovery-copy'
import '../client-load-recovery.css'

// A failed optional chunk must never unmount the conversation or its store.
export class ClientLoadBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function ClientLoadFallback({ loading = false, onClose, inline = false, returnFocus }: { loading?: boolean; onClose?: () => void; inline?: boolean; returnFocus?: RefObject<HTMLElement | null> }) {
  const { language } = useClientPreferences()
  const text = clientLoadRecoveryCopy[language]
  const ref = useRef<HTMLElement>(null)
  const id = useId()
  const isHelp = Boolean(onClose) && !inline
  const focusLifetime = useRef({ generation: 0 })
  useEffect(() => {
    const lifetime = focusLifetime.current
    const generation = ++lifetime.generation
    const logicalTarget = returnFocus?.current ?? null
    const ownsReturnTarget = () => !returnFocus || returnFocus.current === logicalTarget
    const surface = ref.current
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.focus({ preventScroll: true })
    return () => {
      if (!isHelp) return
      queueMicrotask(() => {
        // A retiring loader owns neither a new account nor the completed help.
        if (document.getElementById('root')?.inert || lifetime.generation !== generation || !ownsReturnTarget()
          || document.querySelector(`${activeClientSurfaceSelector},.client-load-layer,dialog:modal`)) return
        const visible = (el: HTMLElement | null) => el !== document.body && el !== document.documentElement && el?.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden],[inert]')
        const current = document.activeElement
        if (current instanceof HTMLElement && current !== previous && !surface?.contains(current) && visible(current)) return
        const menu = [...document.querySelectorAll<HTMLElement>(matchMedia('(max-width:860px)').matches ? '.client-hamburger' : '.client-sidebar-bottom [data-sidebar-action="profile-settings"], .client-sidebar-bottom [data-sidebar-action="settings"], .client-rail-logo-row button')].find(visible) ?? null
        if (visible(logicalTarget)) logicalTarget?.focus({ preventScroll: true })
        else if (visible(previous)) previous?.focus({ preventScroll: true })
        else if (visible(menu)) menu?.focus({ preventScroll: true })
      })
    }
  }, [isHelp, returnFocus])
  return <div className={isHelp ? 'client-load-layer' : `client-load-page${inline ? ' is-inline' : ''}`} onPointerDown={event => { if (isHelp && onClose && event.target === event.currentTarget) { event.preventDefault(); onClose() } }}>
    <section ref={ref} className={loading ? 'site-page-loading client-load-panel' : 'site-page-recovery client-load-panel'} tabIndex={-1}
      role={isHelp ? 'dialog' : 'region'} aria-modal={isHelp ? true : undefined} aria-labelledby={`${id}-title`}
      onKeyDown={event => {
        if (!onClose || event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); onClose() }
        if (event.key !== 'Tab' || !isHelp) return
        const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus() }
      }}>
      <div role="status"><h2 id={`${id}-title`}>{loading ? text.loading : text.failed}</h2></div>
      {!loading && <p>{text.description}</p>}
      <div className="client-load-actions">
        {onClose ? <button type="button" onClick={onClose}>{text.back}</button> : <InternalLink href="/">{text.back}</InternalLink>}
        {!loading && <button type="button" onClick={() => window.location.reload()}>{text.reload}</button>}
      </div>
    </section>
  </div>
}
