import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import '../client-sharing-controls.css'

export type ClientSharingDropdownProps = {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string; icon?: ReactNode }>
  triggerContent?: ReactNode
  active?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (value: string) => void
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
    if (event.target instanceof Node && !wrap.current?.contains(event.target)) onClose()
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
export function ClientSharingDropdown({ label, value, options, open, onOpenChange, onSelect, triggerContent, active }: ClientSharingDropdownProps) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), wrap = useRef<HTMLSpanElement>(null)
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const selected = options[selectedIndex]
  const [entryIndex, setEntryIndex] = useState<number | null>(null)
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
    {open && options.length > 0 && <DropdownOptions id={id} label={label} value={value} options={options} initialIndex={entryIndex ?? selectedIndex}
      trigger={trigger} wrap={wrap} onClose={() => onOpenChange(false)} onSelect={onSelect} />}
  </span>
}
