import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useClientPreferences } from '../client-preferences'
import { useClientSurfacePresence } from '../use-client-surface-presence'
import '../client-sharing-controls.css'
import '../client-sharing-dropdown.css'

export type ClientSharingDropdownProps = {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string; icon?: ReactNode }>
  triggerContent?: ReactNode
  active?: boolean
  mobileSheet?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (value: string) => void
}

const sheetQuery = '(max-width: 760px)'
const subscribeSheetViewport = (notify: () => void) => {
  const media = window.matchMedia(sheetQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const sheetViewport = () => window.matchMedia(sheetQuery).matches

/** Source 9fb tfBkDropSheet, with native modality and cleanup instead of global DOM ownership. */
function DropdownSheet({ open, id, label, title, value, options, initialIndex, trigger, onClose, onSelect }: {
  open: boolean
  id: string; label: string; title: ReactNode; value: string; options: ClientSharingDropdownProps['options']; initialIndex: number
  trigger: RefObject<HTMLButtonElement | null>; onClose: () => void; onSelect: (value: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null), menu = useRef<HTMLDivElement>(null)
  const pressedScrim = useRef(false)
  const { t } = useClientPreferences()
  // Keep the source's .18s exit; allow style/frame scheduling before the
  // fallback so animationend, rather than an early timer, removes its last frame.
  const presence = useClientSurfacePresence(open, { exitAnimationName: 'client-sharing-sheet-out', fallbackMs: 240 })
  const [active, setActive] = useState(() => Math.max(0, Math.min(initialIndex, options.length - 1)))
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) setActive(Math.max(0, Math.min(initialIndex, options.length - 1)))
  }
  const search = useRef({ text: '', at: 0 })
  useLayoutEffect(() => {
    const element = dialog.current, anchor = trigger.current
    if (!open || !element) return
    // Lock only this trigger's scroll ancestors and the document; restore exact
    // inline values/priorities on close, breakpoint changes and owner unmount.
    const targets = new Set<HTMLElement>([document.body])
    for (let node = anchor?.parentElement; node; node = node.parentElement) {
      if (/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)) targets.add(node)
    }
    const locks = [...targets].map(node => ({ style: node.style, value: node.style.getPropertyValue('overflow-y'), priority: node.style.getPropertyPriority('overflow-y') }))
    locks.forEach(({ style }) => style.setProperty('overflow-y', 'hidden'))
    element.showModal()
    menu.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true })
    return () => {
      element.close()
      locks.forEach(({ style, value, priority }) => {
        if (style.getPropertyValue('overflow-y') !== 'hidden' || style.getPropertyPriority('overflow-y')) return
        if (value) style.setProperty('overflow-y', value, priority)
        else style.removeProperty('overflow-y')
      })
      if (anchor?.isConnected && !anchor.closest('[hidden],[inert]')) anchor.focus({ preventScroll: true })
    }
  }, [open, trigger])
  const focus = (index: number) => {
    const next = (index + options.length) % options.length
    setActive(next)
    const option = menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next]
    option?.focus({ preventScroll: true }); option?.scrollIntoView({ block: 'nearest' })
  }
  const select = (next: string) => { if (open) { onClose(); onSelect(next) } }
  if (!presence.present) return null
  return createPortal(<dialog ref={dialog} className="client-sharing-sheet" aria-labelledby={`${id}-title`}
    data-surface-active={open} data-surface-closing={presence.closing} inert={!open} aria-hidden={!open || undefined}
    onCancel={event => { event.preventDefault(); if (open) onClose() }}
    onClose={event => {
      if (!open || event.currentTarget.open) return
      // Native close restores the pre-dialog element before dispatching close.
      // Select our trigger before React snapshots focus for the next commit;
      // cleanup-only focus is otherwise overwritten by React's restoration.
      const anchor = trigger.current
      if (anchor?.isConnected && !anchor.closest('[hidden],[inert]')) anchor.focus({ preventScroll: true })
      onClose()
    }}
    onKeyDown={event => {
      if (!open || !plainKey(event) || event.key !== 'Tab') return
      const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled]):not([tabindex="-1"])')]
      const index = controls.indexOf(document.activeElement as HTMLButtonElement)
      event.preventDefault()
      const next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
      controls[next]?.focus()
    }}
    onPointerDown={event => { pressedScrim.current = event.target === event.currentTarget }}
    onPointerCancel={() => { pressedScrim.current = false }}
    onClick={event => {
      // Source scrim is a sibling of the sheet: dragging from an option onto
      // it must not become a click on the full-viewport dialog's common root.
      const dismiss = pressedScrim.current && event.target === event.currentTarget
      pressedScrim.current = false
      if (open && dismiss) onClose()
    }}>
    <div className="sh" onAnimationEnd={presence.onAnimationEnd}>
      <div className="hd"><b id={`${id}-title`}>{title}</b><button type="button" className="x" aria-label={t('common.close')} onClick={() => { if (open) onClose() }}>✕</button></div>
      <div ref={menu} id={id} role="listbox" aria-label={label} onKeyDown={event => {
        if (!open || !plainKey(event)) return
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation()
          focus(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1))
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); event.stopPropagation()
          if (!event.repeat && options[active]) select(options[active].value)
        } else if (event.key.length === 1) {
          const now = performance.now(), character = event.key.normalize('NFC').toLocaleLowerCase()
          const text = now - search.current.at > 700 ? character : search.current.text + character
          search.current = { text, at: now }
          const query = [...text].every(item => item === character) ? character : text
          const index = options.findIndex((_, offset) => options[(active + 1 + offset) % options.length].label.normalize('NFC').toLocaleLowerCase().startsWith(query))
          if (index >= 0) { event.preventDefault(); focus(active + 1 + index) }
        }
      }}>
        {options.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={option.value === value}
          className={`it${option.value === value ? ' on' : ''}`} tabIndex={index === active ? 0 : -1}
          onFocus={() => setActive(index)} onClick={() => select(option.value)}>{option.icon}<span>{option.label}</span>{option.value === value && <span className="ck" aria-hidden="true">✓</span>}</button>)}
      </div>
    </div>
  </dialog>, document.body)
}

function plainKey(event: KeyboardEvent) {
  return !event.defaultPrevented && !event.nativeEvent.isComposing && event.keyCode !== 229
    && !event.altKey && !event.ctrlKey && !event.metaKey
}

function DropdownOptions({ id, label, value, options, initialIndex, trigger, wrap, onClose, onSelect }: {
  id: string; label: string; value: string; options: ClientSharingDropdownProps['options']; initialIndex: number
  trigger: RefObject<HTMLButtonElement | null>; wrap: RefObject<HTMLSpanElement | null>
  onClose: () => void; onSelect: (value: string) => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(() => Math.max(0, Math.min(initialIndex, options.length - 1)))
  const search = useRef({ text: '', at: 0 })
  // Translated non-selected options can resize the menu without resizing its
  // anchor. Compare content, not the caller's fresh array identity.
  const layoutKey = JSON.stringify([label, options.map(option => [option.value, option.label])])
  const closeOutside = useEffectEvent((event: PointerEvent | FocusEvent) => {
    // On a breakpoint handoff the old passive listener can outlive its menu
    // until the new sheet's layout effect focuses an option. A removed inline
    // menu no longer owns dismissal of that newly mounted modal surface.
    if (menu.current?.isConnected && event.target instanceof Node && !wrap.current?.contains(event.target)) onClose()
  })
  useEffect(() => {
    document.addEventListener('pointerdown', closeOutside, true)
    document.addEventListener('focusin', closeOutside)
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true)
      document.removeEventListener('focusin', closeOutside)
    }
  }, [])
  useLayoutEffect(() => {
    const element = menu.current, anchor = trigger.current
    if (!element || !anchor) return
    // Keep the source absolute menu, shifting only when its natural bounds
    // would leave the viewport. No portal, body lock, or layout animation.
    const place = (event?: Event) => {
      // Internal option scrolling must not expand/re-collapse the scrollbox,
      // which would reset scrollTop before the last options can be reached.
      if (event?.target instanceof Node && element.contains(event.target)) return
      element.style.left = '0px'
      element.style.top = 'calc(100% + 4px)'
      element.style.maxHeight = 'none'
      const rect = element.getBoundingClientRect(), a = anchor.getBoundingClientRect()
      const view = window.visualViewport
      const left = view?.offsetLeft ?? 0
      let top = view?.offsetTop ?? 0
      const width = view?.width ?? document.documentElement.clientWidth
      let bottom = top + (view?.height ?? window.innerHeight)
      // The app scrollport can end above the browser edge (e.g. its footer).
      // An absolute menu must also fit every ancestor that clips its contents.
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (!/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowY)) continue
        const bounds = parent.getBoundingClientRect()
        top = Math.max(top, bounds.top + parent.clientTop)
        bottom = Math.min(bottom, bounds.top + parent.clientTop + parent.clientHeight)
      }
      const height = Math.max(0, bottom - top)
      const shift = Math.max(left + 8 - rect.left, Math.min(0, left + width - 8 - rect.right))
      element.style.left = `${shift}px`
      const available = Math.max(0, height - 16)
      const below = Math.min(available, Math.max(0, top + height - 8 - a.bottom - 4))
      const above = Math.min(available, Math.max(0, a.top - top - 8 - 4))
      const up = below < rect.height && above > below
      const limit = up ? above : below
      const menuHeight = Math.min(rect.height, limit)
      const preferredTop = up ? a.top - menuHeight - 4 : a.bottom + 4
      // A translated hero can move an unchanged anchor outside the viewport.
      // Bound the menu itself, not just the space measured from that anchor.
      const menuTop = Math.max(top + 8, Math.min(preferredTop, top + height - 8 - menuHeight))
      element.style.maxHeight = `${limit}px`
      element.style.top = `calc(100% + 4px + ${menuTop - rect.top}px)`
    }
    place()
    search.current = { text: '', at: 0 }
    const initial = element.querySelector<HTMLButtonElement>('[tabindex="0"]')
    initial?.focus({ preventScroll: true })
    initial?.scrollIntoView({ block: 'nearest' })
    const resize = new ResizeObserver(() => place())
    resize.observe(anchor)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      resize.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
  }, [trigger, layoutKey])
  const focus = (index: number) => {
    const next = (index + options.length) % options.length
    setActive(next)
    menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next]?.focus({ preventScroll: true })
    menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next]?.scrollIntoView({ block: 'nearest' })
  }
  const select = (next: string) => {
    trigger.current?.focus({ preventScroll: true })
    onClose()
    // Selecting the current sort again intentionally toggles the caller's order.
    onSelect(next)
  }
  return <div ref={menu} id={id} className="tfbk-menu" role="listbox" aria-label={label} onKeyDown={event => {
    if (!plainKey(event)) return
    if (event.key === 'Tab') {
      // Let the browser perform normal forward/backward navigation from the
      // trigger after closing; do not strand focus on a removed option node.
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]').forEach(item => { item.tabIndex = -1 })
      trigger.current?.focus({ preventScroll: true }); onClose(); return
    }
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation()
      const anchor = trigger.current
      anchor?.focus({ preventScroll: true })
      if (anchor) {
        const rect = anchor.getBoundingClientRect(), view = window.visualViewport
        const top = view?.offsetTop ?? 0, left = view?.offsetLeft ?? 0
        if (rect.top < top || rect.bottom > top + (view?.height ?? innerHeight)
          || rect.left < left || rect.right > left + (view?.width ?? innerWidth)) {
          anchor.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
        }
      }
      onClose(); return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation()
      focus(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : active + (event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation()
      if (!event.repeat && options[active]) select(options[active].value)
    } else if (event.key.length === 1) {
      const now = performance.now(), character = event.key.normalize('NFC').toLocaleLowerCase()
      const text = now - search.current.at > 700 ? character : search.current.text + character
      search.current = { text, at: now }
      const query = [...text].every(item => item === character) ? character : text
      const index = options.findIndex((_, offset) => options[(active + 1 + offset) % options.length].label.normalize('NFC').toLocaleLowerCase().startsWith(query))
      if (index >= 0) { event.preventDefault(); focus(active + 1 + index) }
    }
  }}>
    {options.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={option.value === value}
      className={`mi${option.value === value ? ' on' : ''}`} tabIndex={index === active ? 0 : -1}
      onFocus={() => setActive(index)} onClick={() => select(option.value)}>{option.icon}<span>{option.label}</span></button>)}
  </div>
}

/** Source 501053b tfBkDrop. Open state and all sorting/filtering belong to caller. */
export function ClientSharingDropdown({ label, value, options, open, onOpenChange, onSelect, triggerContent, active, mobileSheet = false }: ClientSharingDropdownProps) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), wrap = useRef<HTMLSpanElement>(null)
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const selected = options[selectedIndex]
  const [entryIndex, setEntryIndex] = useState<number | null>(null)
  const narrow = useSyncExternalStore(subscribeSheetViewport, sheetViewport, () => false)
  const show = (index: number) => { setEntryIndex(index); onOpenChange(true) }
  return <span className="tfbk-dropwrap" ref={wrap}>
    <button ref={trigger} type="button" className="tfbk-drop" aria-pressed={active} aria-label={`${label}: ${selected?.label ?? ''}`}
      aria-haspopup="listbox" aria-expanded={open && options.length > 0} aria-controls={open && options.length > 0 ? id : undefined} disabled={!options.length}
      onClick={() => open ? onOpenChange(false) : show(selectedIndex)} onKeyDown={event => {
        if (!plainKey(event)) return
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); show(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : selectedIndex)
        } else if ((event.key === 'Enter' || event.key === ' ') && event.repeat) event.preventDefault()
      }}><span>{triggerContent ?? selected?.label ?? label}</span><span className="car" aria-hidden="true">▾</span></button>
    {options.length > 0 && (mobileSheet && narrow
      ? <DropdownSheet open={open} id={id} label={label} title={triggerContent ?? selected?.label ?? label} value={value} options={options}
        initialIndex={entryIndex ?? selectedIndex} trigger={trigger} onClose={() => onOpenChange(false)} onSelect={onSelect} />
      : open && <DropdownOptions id={id} label={label} value={value} options={options} initialIndex={entryIndex ?? selectedIndex}
        trigger={trigger} wrap={wrap} onClose={() => onOpenChange(false)} onSelect={onSelect} />)}
  </span>
}
