import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import type { ResearchRecord } from '../research-library'
import { useConversationCopy } from '../client-conversation-copy'

/** Source row actions; tab-local owner callbacks, no service mutations. */
export function ClientResearchRow({ record, active, statusBadge, onSelect, onPin, onRename, onDelete, archiveLabel, archiveDetail, errorLabel }: {
  record: ResearchRecord; active: boolean; onSelect: () => void | Promise<void>
  statusBadge?: string
  onPin?: () => void | Promise<void>; onRename?: (title: string) => void | Promise<void>; onDelete?: () => void | Promise<void>
  archiveLabel?: string; archiveDetail?: string; errorLabel?: string
}) {
  const { c, statusLabel } = useConversationCopy()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null)
  const [title, setTitle] = useState(record.title)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const running = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const perform = async (action: () => void | Promise<void>, done?: () => void) => {
    if (running.current) return
    running.current = true; setPending(true); setFailed(false)
    try { await action(); if (mounted.current) done?.() }
    catch { if (mounted.current) setFailed(true) }
    finally { running.current = false; if (mounted.current) setPending(false) }
  }
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const modal = useRef<HTMLDialogElement>(null)
  const backdropDown = useRef(false)
  const id = useId()
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return
    const bounds = trigger.current.getBoundingClientRect()
    const el = menu.current
    el.style.left = `${Math.max(8, Math.min(bounds.right, innerWidth - el.offsetWidth - 8))}px`
    el.style.top = `${Math.max(8, Math.min(bounds.top, innerHeight - el.offsetHeight - 8))}px`
    el.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !el.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false)
    }
    const cancel = (event: Event) => {
      if (event.target instanceof Node && el.contains(event.target)) return
      // Focus/click can dispatch a previously queued scroll after menu mount.
      // Dismiss only when its anchor actually moved, not for unrelated scrolling.
      if (event.type === 'scroll') {
        const current = trigger.current?.getBoundingClientRect()
        if (current && Math.abs(current.top - bounds.top) < 1 && Math.abs(current.left - bounds.left) < 1) return
      }
      if (el.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true })
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', cancel)
    // The trigger may move when the sidebar scrolls. Never leave a detached menu.
    window.addEventListener('scroll', cancel, true)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', cancel); window.removeEventListener('scroll', cancel, true) }
  }, [open])

  useEffect(() => {
    if (!dialog || !modal.current) return
    const element = modal.current
    element.showModal()
    if (dialog === 'rename') element.querySelector('input')?.select()
    return () => element.close()
  }, [dialog])

  const begin = (next: 'rename' | 'delete') => { setFailed(false); setTitle(record.title); setOpen(false); setDialog(next) }
  const finish = () => { modal.current?.close(); setDialog(null); trigger.current?.focus({ preventScroll: true }) }
  return <li className="client-session-row" aria-busy={pending}>
    <button type="button" className="client-session" disabled={pending} title={record.title} aria-current={active ? 'true' : undefined} onClick={() => void perform(onSelect)}><span>{record.title}</span><small className={statusBadge === undefined ? 'client-session-state' : 'client-session-badge'}>{statusBadge ?? statusLabel(record.status)}</small>{record.pinned === true && <Pin size={13} aria-label={c('pinned')} />}</button>
    {failed && !dialog && <span role="alert" className="client-sidebar-record-empty">{errorLabel ?? c('retry')}</span>}
    {(onPin || onRename || onDelete) && <button disabled={pending} className={`client-session-dots ${open ? 'open' : ''}`} ref={trigger} type="button" aria-label={`${record.title} ${c('manage')}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}><MoreVertical size={16} aria-hidden="true" /></button>}
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={c('manageResearch')} className="client-rowmenu" onKeyDown={event => {
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation()
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
      } else if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close() }
    }}>
      {onPin && <button role="menuitem" type="button" disabled={pending} onClick={() => void perform(onPin, close)}>{record.pinned ? <PinOff size={16} /> : <Pin size={16} />}{c(record.pinned ? 'unpin' : 'pin')}</button>}
      {onRename && <button role="menuitem" type="button" disabled={pending} onClick={() => begin('rename')}><Pencil size={16} />{c('rename')}</button>}
      {onDelete && <button role="menuitem" type="button" disabled={pending} onClick={() => begin('delete')}><Trash2 size={16} />{archiveLabel ?? c('delete')}</button>}
    </div>, document.body)}
    {dialog && createPortal(<dialog ref={modal} className="client-rowdialog" aria-labelledby={`${id}-title`} onPointerDown={event => {
      const r = event.currentTarget.getBoundingClientRect()
      backdropDown.current = event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)
    }} onClick={event => {
      const r = event.currentTarget.getBoundingClientRect()
      if (!pending && backdropDown.current && event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) finish()
      backdropDown.current = false
    }} onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!pending) finish() }} onKeyDown={event => {
      event.stopPropagation()
      if (['Enter', 'Escape'].includes(event.key) && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
    }}>
      <form aria-busy={pending} onSubmit={event => { event.preventDefault(); if (onRename && dialog === 'rename' && title.trim() && title.trim() !== record.title) void perform(() => onRename(title.trim()), finish) }}>
        <h2 id={`${id}-title`}>{dialog === 'delete' && archiveLabel ? archiveLabel : c(dialog === 'rename' ? 'renameResearch' : 'deleteResearch')}</h2>
        {dialog === 'rename' ? <input disabled={pending} aria-label={c('researchName')} value={title} onChange={event => setTitle(event.target.value)} maxLength={120} /> : <p>{archiveDetail ?? c('researchDeleteDetail')}</p>}
        {failed && <p role="alert">{errorLabel ?? c('retry')}</p>}
        <div className="acts"><button type="button" disabled={pending} autoFocus={dialog === 'delete'} onClick={finish}>{c('cancel')}</button>{dialog === 'rename' ? <button type="submit" disabled={pending || !title.trim() || title.trim() === record.title}>{c('rename')}</button> : <button type="button" disabled={pending} onClick={() => { if (onDelete) void perform(onDelete, finish) }}>{archiveLabel ?? c('delete')}</button>}</div>
      </form>
    </dialog>, document.body)}
  </li>
}
