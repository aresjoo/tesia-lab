import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useClientPreferences } from '../client-preferences'
import { upgradeText } from '../client-upgrade-copy'
import '../client-account-activity.css'
import '../client-upgrade-sheet.css'

export type ClientUpgradeSheetProps = {
  context: 'follow' | 'backtest' | 'quota' | 'plan' | 'bk'
  name?: string
  freeUsed?: number
  onClose: () => void
  onLater?: () => void
  onLinkUid?: () => Promise<void> | void
  onSubscribe?: () => void
  trigger?: HTMLElement
}

function visible(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element?.isConnected && element.getClientRects().length && !element.closest('[inert],[hidden]') && !element.matches(':disabled') && getComputedStyle(element).visibility === 'visible')
}

/** Source 42a0d81 tfUpSheet. Offer copy is a source snapshot, not account entitlement. */
export function ClientUpgradeSheet(props: ClientUpgradeSheetProps) {
  // A response for a replaced context must never close the next offer.
  return <UpgradeSheetView key={JSON.stringify([props.context, props.name])} {...props} />
}

function UpgradeSheetView({ context, name, freeUsed, onClose, onLater, onLinkUid, onSubscribe, trigger }: ClientUpgradeSheetProps) {
  const { language } = useClientPreferences()
  const c = (key: Parameters<typeof upgradeText>[1], values?: Parameters<typeof upgradeText>[2]) => upgradeText(language, key, values)
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const alive = useRef(false)
  const locked = useRef(false)
  const dismissed = useRef(false)
  const backdropDown = useRef(false)
  const closeRef = useRef(onClose)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const [origin] = useState(() => trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null))
  const [host] = useState(() => origin?.closest('dialog[open]') ?? document.body)
  useLayoutEffect(() => { closeRef.current = onClose }, [onClose])
  const close = () => {
    if (dismissed.current) return
    dismissed.current = true; closeRef.current()
  }
  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    alive.current = true; dismissed.current = false
    const url = window.location.href
    const bodyStyle = document.body.style
    const overflow = bodyStyle.getPropertyValue('overflow'), overflowPriority = bodyStyle.getPropertyPriority('overflow')
    element.showModal(); bodyStyle.setProperty('overflow', 'hidden')
    element.querySelector<HTMLButtonElement>('.x')?.focus({ preventScroll: true })
    const navigate = () => {
      if (window.location.href !== url && !dismissed.current) { dismissed.current = true; closeRef.current() }
    }
    const parentClosed = (event: Event) => {
      if (event.target === host && !dismissed.current) { dismissed.current = true; closeRef.current() }
    }
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    window.addEventListener('teth:navigate', navigate)
    host.addEventListener('close', parentClosed)
    return () => {
      alive.current = false
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('popstate', navigate)
      window.removeEventListener('teth:navigate', navigate)
      host.removeEventListener('close', parentClosed)
      element.close()
      // Do not release or reinstate a lock already owned/released by an underlying surface.
      if (bodyStyle.getPropertyValue('overflow') === 'hidden' && bodyStyle.getPropertyPriority('overflow') === '') {
        if (overflow) bodyStyle.setProperty('overflow', overflow, overflowPriority)
        else bodyStyle.removeProperty('overflow')
      }
      queueMicrotask(() => {
        if (element.open || window.location.href !== url) return
        const top = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1)
        if (visible(origin) && origin !== document.body && (!top || top.contains(origin))) { origin.focus({ preventScroll: true }); return }
        // Preserve a next surface's own focus, including body-level non-native overlays.
        const current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        if (current !== document.body && visible(current)) return
        const scope = top ?? document.body
        const fallback = [...scope.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]')].find(candidate => visible(candidate) && candidate.tabIndex >= 0)
        fallback?.focus({ preventScroll: true })
      })
    }
  }, [host, origin])

  async function link() {
    if (!onLinkUid || locked.current || dismissed.current) return
    locked.current = true; setPending(true); setError(false)
    try {
      await onLinkUid()
      if (alive.current && !dismissed.current) close()
    } catch {
      if (alive.current && !dismissed.current) setError(true)
    } finally {
      if (alive.current && !dismissed.current) { locked.current = false; setPending(false) }
    }
  }
  const [heading, description] = {
    follow: [c('followTitle'), c('followDescription')],
    backtest: [c('backtestTitle'), c('backtestDescription')],
    quota: [c('quotaTitle'), c('quotaDescription')],
    plan: [c('planTitle'), c('planDescription')],
    bk: [name ? c('bkTitle', { name }) : c('bkTitleFallback'), c('bkDescription')],
  }[context]
  const used = Number.isFinite(freeUsed) && freeUsed! >= 0 ? Math.min(freeUsed!, 10) : null

  return createPortal(<dialog ref={dialog} className="client-account-activity client-upgrade-sheet" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }} onKeyDown={event => {
    event.stopPropagation()
    if (event.key === 'Escape' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
  }} onPointerDown={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    backdropDown.current = event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)
  }} onClick={event => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (backdropDown.current && event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close()
    backdropDown.current = false
  }}>
    <button type="button" className="x" aria-label={c('closeLabel')} onClick={close}>✕</button>
    <div className="nfxu-tags"><span className="nfx-badge sim">{c('simulationBadge')}</span>{context === 'follow' && name && <span className="nfx-badge">{name}</span>}</div>
    <h2 className="nfxu-hd" id={`${id}-title`}>{heading}</h2>
    <div className="nfxu-sub" id={`${id}-description`}>{description}</div>
    {context === 'quota' && <div className="nfxu-quota"><div className="r"><span>{c('quotaRowLabel')}</span><b>{c('quotaRowValue', { used: String(used ?? '—') })}</b></div><div className="nfx-gtrack" aria-hidden="true"><div className="nfx-gfill empty" /></div>{used === null && <span className="quota-unavailable">{c('quotaUnavailable')}</span>}</div>}
    <div className="nfxu-cards" aria-busy={pending}>
      <div className="nfxu-card hot"><div className="bd1"><span className="nfx-badge pro">{c('uidFreeBadge')}</span><span className="nfx-badge">{c('uidTimeBadge')}</span></div>
        <div className="t">{c('uidCardTitle')}</div><div className="big">{c('uidCardAmount')} <span className="grant">{c('uidCardGrant')}</span></div><div className="d">{c('uidCardNote')}</div>
        <ul><li>{c('uidBullet1')}</li><li>{c('uidBullet2')}</li><li>{c('uidBullet3')}</li></ul><span className="sp" />
        <button type="button" className="nfx-btn pri" disabled={!onLinkUid || pending} aria-describedby={`${id}-uid-state`} onClick={() => { void link() }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>{c('uidButton')}</button>
        <div id={`${id}-uid-state`} className="nfxu-state">{!onLinkUid && <p>{c('uidUnavailable')}</p>}{pending && <p role="status">{c('uidPending')}</p>}{error && <p role="alert">{c('linkError')}</p>}</div>
      </div>
      <div className="nfxu-card"><div className="bd1"><span className="nfx-badge blue">{c('subBadge')}</span></div><div className="t">{c('subCardTitle')}</div><div className="big pro">{c('subCardAmount')}</div><div className="d">{c('subCardNote')}</div>
        <ul><li>{c('subBullet1')}</li><li>{c('subBullet2')}</li><li>{c('subBullet3')}</li></ul><span className="sp" />
        <button type="button" className="nfx-btn sec" disabled={!onSubscribe || pending} onClick={() => { if (locked.current || dismissed.current || !onSubscribe) return; close(); onSubscribe() }}>{c('subButton')}</button>
      </div>
    </div>
    <div className="nfxu-foot"><span>{c('footerNote')}</span>{context !== 'quota' && <button type="button" className="nfxu-later" disabled={pending} onClick={() => { if (locked.current || dismissed.current) return; close(); onLater?.() }}>{c('footerLater')}</button>}</div>
  </dialog>, host)
}
