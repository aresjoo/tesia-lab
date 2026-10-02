import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ClientTerminalStrategy } from '../client-terminal-view'
import { useClientPreferences } from '../client-preferences'
import { terminalReadText } from '../client-terminal-read-copy'
import { strategyActionsText } from '../client-strategy-actions-copy'
import '../client-strategy-actions.css'

export type ClientStrategyActionCallbacks = {
  onDetail?: (id: string) => void
  onRename?: (id: string, name: string) => Promise<void>
  onClone?: (id: string, exchangeId?: string) => Promise<void>
  onStatus?: (id: string, status: 'live' | 'off') => Promise<void>
  onDelete?: (id: string) => Promise<void>
}
export type ClientStrategyActionsProps = {
  strategy: ClientTerminalStrategy
  trigger: HTMLElement
  onClose: () => void
  /** Read-only deep entry; other mutation dialogs always require explicit menu actions. */
  initialView?: 'menu' | 'versions'
  exchanges: readonly { id: string; name: string }[]
  /** Source order: oldest first. These are supplied records, never generated history. */
  versionHistory?: readonly { from: string; to: string; timeLabel: string; by: string; diff: string }[]
  callbacks?: ClientStrategyActionCallbacks
  /** Simulation and verification claims belong to the caller's presentation boundary. */
  cloneDescription?: string
  cloneExchangeNote?: string
}
type View = 'menu' | 'rename' | 'clone-exchange' | 'versions' | 'stop-before-delete' | 'delete'

/** Source 9bf4427 tfTmMenu / tfTmRename / tfTmCloneEx / tfTmDelete / tfTmVerDlg.
 * Callback completion is authoritative; this component never changes strategy state.
 */
export function ClientStrategyActions({ strategy, trigger, onClose, exchanges, versionHistory, callbacks, cloneDescription, cloneExchangeNote, initialView = 'menu' }: ClientStrategyActionsProps) {
  const id = useId()
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof terminalReadText>[1], values?: Readonly<Record<string, string>>) => terminalReadText(language, key, values)
  const a = (key: Parameters<typeof strategyActionsText>[1], values?: Readonly<Record<string, string>>) => strategyActionsText(language, key, values)
  const [ownerId] = useState(strategy.id)
  const [host] = useState(() => trigger.closest('dialog[open]') ?? document.body)
  const [railOwner] = useState(() => trigger.closest('.ctt-rail')?.id)
  const [view, setView] = useState<View>(initialView)
  const [name, setName] = useState(strategy.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<'required' | 'tooLong' | 'failed' | null>(null)
  const menu = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const lock = useRef(false)
  const alive = useRef(false)
  const restoreFocus = useRef(true)
  const backdropDown = useRef(false)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    alive.current = true
    const origin = window.location.href
    const navigate = () => { if (window.location.href !== origin) { restoreFocus.current = false; closeRef.current() } }
    const parentClosed = (event: Event) => { if (event.target === host) closeRef.current() }
    window.addEventListener('popstate', navigate)
    window.addEventListener('hashchange', navigate)
    window.addEventListener('teth:navigate', navigate)
    host.addEventListener('close', parentClosed)
    return () => {
      alive.current = false
      window.removeEventListener('popstate', navigate)
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('teth:navigate', navigate)
      host.removeEventListener('close', parentClosed)
      if (restoreFocus.current && window.location.href === origin && trigger.isConnected && trigger.getClientRects().length && !trigger.closest('[inert],[hidden]')) trigger.focus({ preventScroll: true })
    }
  }, [host, trigger])
  useEffect(() => { if (strategy.id !== ownerId) closeRef.current() }, [strategy.id, ownerId])

  function close(restore = true) {
    if (lock.current) return
    restoreFocus.current = restore
    onClose()
  }
  function begin(next: View) { if (!lock.current) { setError(null); setView(next) } }
  async function run(action: (() => void | Promise<void>) | undefined) {
    if (!action || lock.current || strategy.id !== ownerId) return
    lock.current = true; setPending(true); setError(null)
    try {
      await action()
      if (alive.current) closeRef.current()
    } catch {
      // Raw service errors can contain private diagnostics. Preserve the form instead.
      if (alive.current) setError('failed')
    } finally {
      lock.current = false
      if (alive.current) setPending(false)
    }
  }

  useLayoutEffect(() => {
    if (view !== 'menu' || !menu.current) return
    const element = menu.current
    const triggerAttributes = ['aria-haspopup', 'aria-expanded', 'aria-controls'].map(key => [key, trigger.getAttribute(key)] as const)
    trigger.setAttribute('aria-haspopup', 'menu')
    trigger.setAttribute('aria-expanded', 'true')
    trigger.setAttribute('aria-controls', id)
    element.showPopover()
    const place = () => {
      if (!trigger.isConnected) { closeRef.current(); return }
      const bounds = trigger.getBoundingClientRect()
      const viewport = window.visualViewport
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
      const width = viewport?.width ?? innerWidth, height = viewport?.height ?? innerHeight
      element.style.maxWidth = `${Math.max(0, width - 20)}px`
      element.style.maxHeight = `${Math.max(0, height - 20)}px`
      element.style.left = `${Math.max(left + 10, Math.min(left + width - element.offsetWidth - 10, bounds.left - 140))}px`
      element.style.top = `${Math.max(top + 10, Math.min(top + height - element.offsetHeight - 10, bounds.bottom + 4))}px`
    }
    place()
    element.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (!lock.current && event.target instanceof Node && !element.contains(event.target) && !trigger.contains(event.target)) { restoreFocus.current = false; closeRef.current() }
    }
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !element.contains(event.target)) place() }
    const resize = new ResizeObserver(place)
    resize.observe(element)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', scroll, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    document.addEventListener('pointerdown', outside)
    return () => {
      resize.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', scroll, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
      document.removeEventListener('pointerdown', outside)
      element.hidePopover()
      for (const [key, value] of triggerAttributes) { if (value === null) trigger.removeAttribute(key); else trigger.setAttribute(key, value) }
    }
  }, [view, trigger, id])

  useLayoutEffect(() => {
    if (view === 'menu' || !dialog.current) return
    const element = dialog.current
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    const input = element.querySelector<HTMLInputElement>('input')
    if (view === 'rename') { input?.focus(); input?.select() }
    else element.querySelector<HTMLButtonElement>('[data-cancel]')?.focus({ preventScroll: true })
    return () => {
      element.close()
      // The parent modal may already have released its lock during navigation.
      if (document.body.style.overflow === 'hidden') document.body.style.overflow = overflow
    }
  }, [view])

  function menuKeys(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (event.nativeEvent.isComposing || event.keyCode === 229) { if (event.key === 'Escape') event.preventDefault(); return }
    if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); close(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }
  const otherExchanges = [...new Map(exchanges.filter(exchange => exchange.id && exchange.id !== strategy.exchange.id).map(exchange => [exchange.id, exchange])).values()]
  const statusLabel = strategy.status === 'live' ? a('pause') : strategy.status === 'off' ? a('resume') : strategy.status === 'ready' ? a('start') : null
  const title = view === 'rename' ? a('rename') : view === 'clone-exchange' ? a('cloneExchange') : view === 'versions' ? t('versionsTitle', { name: strategy.name }) : view === 'stop-before-delete' ? a('cantDelete') : a('deleteTitle')
  if (view === 'menu') return createPortal(<div ref={menu} id={id} popover="manual" role="menu" className="csa-menu" data-terminal-rail-owner={railOwner} aria-label={a('menuLabel', { name: strategy.name })} aria-busy={pending} onKeyDown={menuKeys}>
    <button type="button" role="menuitem" disabled={pending || !callbacks?.onDetail} onClick={() => void run(callbacks?.onDetail ? () => callbacks.onDetail!(ownerId) : undefined)}>{a('detail')}</button>
    <button type="button" role="menuitem" disabled={pending || !callbacks?.onRename} onClick={() => begin('rename')}>{a('rename')}</button>
    <button type="button" role="menuitem" disabled={pending || !callbacks?.onClone} onClick={() => void run(callbacks?.onClone ? () => callbacks.onClone!(ownerId) : undefined)}>{a('clone')}</button>
    <button type="button" role="menuitem" disabled={pending || !callbacks?.onClone || !otherExchanges.length} onClick={() => begin('clone-exchange')}>{a('cloneExchange')}</button>
    {statusLabel && <button type="button" role="menuitem" disabled={pending || !callbacks?.onStatus} onClick={() => void run(callbacks?.onStatus ? () => callbacks.onStatus!(ownerId, strategy.status === 'live' ? 'off' : 'live') : undefined)}>{statusLabel}</button>}
    <button type="button" role="menuitem" disabled={pending} onClick={() => begin('versions')}>{a('versions')}</button>
    <div className="sep" role="separator" /><button type="button" role="menuitem" className="del" disabled={pending || !callbacks?.onDelete} onClick={() => begin(strategy.status === 'live' ? 'stop-before-delete' : 'delete')}>{a('delete')}</button>
    {error && <p role="alert">{a(error)}</p>}
  </div>, host)
  const outsideDialog = (x: number, y: number) => { const bounds = dialog.current!.getBoundingClientRect(); return x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom }
  return createPortal(<dialog ref={dialog} className="csa-dialog" data-terminal-rail-owner={railOwner} aria-labelledby={`${id}-title`} aria-busy={pending}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}
    onKeyDown={event => {
      event.stopPropagation()
      if (['Enter', 'Escape'].includes(event.key) && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
    }}
    onPointerDown={event => { backdropDown.current = event.target === event.currentTarget && outsideDialog(event.clientX, event.clientY) }}
    onClick={event => { const dismiss = backdropDown.current && event.target === event.currentTarget && outsideDialog(event.clientX, event.clientY); backdropDown.current = false; if (dismiss) close() }}>
    <div className="din"><header><h2 id={`${id}-title`}>{title}</h2><button type="button" className="dx" aria-label={t('close')} disabled={pending} onClick={() => close()}>×</button></header>
      {view === 'rename' ? <form onSubmit={event => {
        event.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) { setError('required'); return }
        if (trimmed.length > 30) { setError('tooLong'); return }
        void run(callbacks?.onRename ? () => callbacks.onRename!(ownerId, trimmed) : undefined)
      }}><div className="fld3"><label htmlFor={`${id}-name`}>{a('name')}</label><input type="text" id={`${id}-name`} value={name} maxLength={30} disabled={pending} onChange={event => { setName(event.target.value); setError(null) }} /></div>
        {error && <p role="alert">{a(error)}</p>}<div className="acts3"><button data-cancel type="button" className="obtn" disabled={pending} onClick={() => close()}>{a('cancel')}</button><button type="submit" className="wbtn" disabled={pending || !callbacks?.onRename}>{a('save')}</button></div>
      </form> : view === 'clone-exchange' ? <><p className="ntc">"{strategy.name}" {cloneDescription ?? a('cloneHint')}</p>{otherExchanges.map(exchange => <button key={exchange.id} type="button" className="ss3-radio" disabled={pending || !callbacks?.onClone} onClick={() => void run(callbacks?.onClone ? () => callbacks.onClone!(ownerId, exchange.id) : undefined)}><span className="rn">{exchange.name}</span>{cloneExchangeNote && <span className="rs">{cloneExchangeNote}</span>}</button>)}
        {error && <p role="alert">{a(error)}</p>}<div className="acts3"><button data-cancel type="button" className="obtn" disabled={pending} onClick={() => close()}>{a('cancel')}</button></div></>
        : view === 'versions' ? <><div className="sumr"><span>{t('currentVersion')}</span><b>{strategy.version}</b></div>{versionHistory?.length ? [...versionHistory].reverse().map((version, index) => <div className="sumr" key={index}><span>{version.from} → {version.to}<br /><small>{version.timeLabel}, {version.by || t('user')}</small></span><b className="diff">{version.diff}</b></div>) : <p className="ntc">{t(versionHistory ? 'noVersions' : 'versionsUnavailable')}</p>}<div className="acts3"><button data-cancel type="button" className="obtn" onClick={() => close()}>{t('close')}</button></div></>
          : <><p className="ntc">{view === 'stop-before-delete' ? <>{a('runningMessage').split('{status}')[0]}<b>{a('running')}</b>{a('runningMessage').split('{status}')[1]}<br />{a('stopFirst')}</> : <>{a('deleteQuestion', { name: strategy.name })}<br />{a('deleteWarning')}</>}</p>{error && <p role="alert">{a(error)}</p>}
            <div className="acts3"><button data-cancel type="button" className="obtn" disabled={pending} onClick={() => close()}>{a('cancel')}</button>{view === 'stop-before-delete' ? <button type="button" className="wbtn" disabled={pending || !callbacks?.onStatus} onClick={() => void run(callbacks?.onStatus ? () => callbacks.onStatus!(ownerId, 'off') : undefined)}>{a('stop')}</button>
              : <button type="button" className="ss3-dbtn" disabled={pending || !callbacks?.onDelete} onClick={() => { if (strategy.status === 'live') { begin('stop-before-delete'); return } void run(callbacks?.onDelete ? () => callbacks.onDelete!(ownerId) : undefined) }}>{a('delete')}</button>}</div></>}
    </div>
  </dialog>, host)
}
