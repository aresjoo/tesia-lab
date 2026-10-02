import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ClientReportUpgradeConfig } from '../client-report-upgrade'
import { getSitePage } from '../site-navigation'
import { ClientUpgradeSheet } from './ClientUpgradeSheet'

export type ClientReportUpgradeProps = {
  config: ClientReportUpgradeConfig
  sessionId: string
  fingerprint: string
  onSubscribe: () => void
}

export function ClientReportUpgrade(props: ClientReportUpgradeProps) {
  if (!props.config.enabled) return null
  return <ReportUpgradeView key={JSON.stringify([props.config.owner, props.sessionId, props.fingerprint])} {...props} />
}

function ReportUpgradeView({ config, sessionId, fingerprint, onSubscribe }: ClientReportUpgradeProps) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ config, sessionId, fingerprint, onSubscribe })
  const reservation = useRef<{
    store: ClientReportUpgradeConfig['store']; reserved: boolean; persisted: boolean
    dueAt: number; href: string; canceled: boolean; shown: boolean; subscribed: boolean
  } | null>(null)
  const active = useRef(false)
  const [open, setOpen] = useState(false)
  const [storageError, setStorageError] = useState(false)
  useLayoutEffect(() => { latest.current = { config, sessionId, fingerprint, onSubscribe } }, [config, sessionId, fingerprint, onSubscribe])
  useEffect(() => {
    active.current = true
    if (getSitePage()) return () => { active.current = false }
    if (!reservation.current || reservation.current.store !== config.store) {
      const claim = config.store.claim(fingerprint)
      reservation.current = { store: config.store, ...claim, dueAt: Date.now() + 700, href: window.location.href, canceled: false, shown: false, subscribed: false }
    }
    const pending = reservation.current
    let disposed = false
    const current = () => !disposed && active.current && !pending.canceled && latest.current.config.enabled
      && latest.current.config.owner === config.owner && latest.current.config.store === config.store
      && latest.current.sessionId === sessionId && latest.current.fingerprint === fingerprint
      && window.location.href === pending.href && !getSitePage()
      && Boolean(host.current?.isConnected && host.current.getClientRects().length && !host.current.closest('[hidden],[inert]'))
    queueMicrotask(() => { if (!disposed) setStorageError(!pending.persisted) })
    const timer = pending.reserved && !pending.shown && !pending.canceled
      ? setTimeout(() => { if (current()) { pending.shown = true; setOpen(true) } else pending.canceled = true }, Math.max(0, pending.dueAt - Date.now()))
      : undefined
    const navigate = () => {
      if (window.location.href !== pending.href || getSitePage()) {
        pending.canceled = true; clearTimeout(timer); setOpen(false)
      }
    }
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    window.addEventListener('teth:navigate', navigate)
    return () => {
      disposed = true; active.current = false; clearTimeout(timer)
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('popstate', navigate)
      window.removeEventListener('teth:navigate', navigate)
      // Preserve the same reservation only across StrictMode's effect replay.
      // A real unmount discards this ref; a later mount must claim again.
    }
  }, [config.owner, config.store, sessionId, fingerprint])
  const subscribe = () => {
    const pending = reservation.current, now = latest.current
    if (!active.current || !pending || pending.canceled || pending.subscribed || !now.config.enabled
      || now.config.owner !== config.owner || now.config.store !== config.store
      || now.sessionId !== sessionId || now.fingerprint !== fingerprint
      || pending.href !== window.location.href || getSitePage()) return
    pending.subscribed = true
    now.onSubscribe()
  }
  return <div ref={host} data-report-upgrade={fingerprint}>
    {storageError && <p className="tf-assumptions" role="status">안내 표시 기록을 저장하지 못했어요. 새로고침하면 이 안내가 다시 나올 수 있어요.</p>}
    {open && <ClientUpgradeSheet context="backtest" onClose={() => setOpen(false)} onLater={() => setOpen(false)} onSubscribe={subscribe} />}
  </div>
}
