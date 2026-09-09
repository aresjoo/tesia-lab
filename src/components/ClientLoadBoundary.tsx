import { Component, useEffect, useId, useRef, type ReactNode } from 'react'
import { InternalLink } from './InternalLink'
import '../client-load-recovery.css'

// A failed optional chunk must never unmount the conversation or its store.
export class ClientLoadBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export function ClientLoadFallback({ loading = false, onClose }: { loading?: boolean; onClose?: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const id = useId()
  const isHelp = Boolean(onClose)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.focus({ preventScroll: true })
    return () => {
      if (!isHelp) return
      queueMicrotask(() => {
        if (document.getElementById('root')?.inert) return
        const visible = (el: HTMLElement | null) => el !== document.body && el !== document.documentElement && el?.isConnected && el.getClientRects().length && !el.closest('[hidden],[inert]')
        const menu = document.querySelector<HTMLElement>(matchMedia('(max-width:860px)').matches ? '.client-hamburger' : '.client-sidebar-bottom [data-sidebar-action="settings"]')
        if (visible(previous)) previous?.focus({ preventScroll: true })
        else if (visible(menu)) menu?.focus({ preventScroll: true })
      })
    }
  }, [isHelp])
  return <div className={onClose ? 'client-load-layer' : 'client-load-page'} onPointerDown={event => { if (onClose && event.target === event.currentTarget) { event.preventDefault(); onClose() } }}>
    <section ref={ref} className={loading ? 'site-page-loading client-load-panel' : 'site-page-recovery client-load-panel'} tabIndex={-1}
      role={onClose ? 'dialog' : 'region'} aria-modal={onClose ? true : undefined} aria-labelledby={`${id}-title`}
      onKeyDown={event => {
        if (!onClose || event.nativeEvent.isComposing) return
        if (event.key === 'Escape') { event.preventDefault(); onClose() }
        if (event.key !== 'Tab') return
        const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('a[href], button') ?? [])
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first?.focus() }
      }}>
      <div role="status"><h2 id={`${id}-title`}>{loading ? '페이지를 불러오는 중입니다' : '페이지를 불러오지 못했습니다'}</h2></div>
      {!loading && <p>연결 상태를 확인하거나 대화로 돌아가세요.</p>}
      <div className="client-load-actions">
        {onClose ? <button type="button" onClick={onClose}>대화로 돌아가기</button> : <InternalLink href="/">대화로 돌아가기</InternalLink>}
        {!loading && <button type="button" onClick={() => window.location.reload()}>페이지 새로고침</button>}
      </div>
    </section>
  </div>
}
