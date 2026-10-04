import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useClientPreferences } from '../client-preferences'
import { clientTerminalText } from '../client-terminal-copy'
import '../client-trading-terminal.css'

type Panel = 'chart' | 'strategies' | 'detail'
export type ClientTradingTerminalControl = { showPanel: (panel: Panel | 'bottom') => void; getPanel: () => Panel | 'bottom'; showBottom: (id: string) => void }
export type ClientTradingTerminalProps = {
  active?: boolean
  embedded?: boolean
  controlRef?: Ref<ClientTradingTerminalControl>
  onClose: () => void
  title: string
  labels: Record<Panel, string>
  slots: { notice?: ReactNode; marketHeader?: ReactNode; strategies: ReactNode; context: ReactNode; chart: ReactNode; detail: ReactNode }
  bottomTabs: readonly { id: string; label: string; content: ReactNode; count?: number; hiddenFromTabs?: boolean }[]
  bottomTools?: ReactNode
  headerTools?: ReactNode
  /** Source sk-mkt layout: the same rail is disclosed from the analysis header. */
  strategySelector?: { countLabel: string; name: string }
  /** Parent may conceal its fullscreen trigger before this portal effect runs. */
  returnFocusRef?: RefObject<HTMLElement | null>
  /** One-shot mobile entry preference. Null waits for a known initial state.
   * Manual navigation always wins; later empty lists must not switch panels. */
  initialMobilePanel?: Panel | null
}

/** Client 9bf4427 tft shell. Owns presentation only, never requests or invents trading data. */
export function ClientTradingTerminal({ active = false, embedded = false, controlRef, onClose, title, labels, slots, bottomTabs, bottomTools, headerTools, strategySelector, returnFocusRef, initialMobilePanel = 'chart' }: ClientTradingTerminalProps) {
  const { language } = useClientPreferences()
  const id = useId()
  const root = useRef<HTMLDialogElement>(null)
  const pickerTrigger = useRef<HTMLButtonElement>(null)
  const pickerRegion = useRef<HTMLElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const useSelector = Boolean(strategySelector)
  const pickerDestination = useRef<Panel | 'bottom' | null>(null)
  const [panelRequest, setPanelRequest] = useState(0)
  const fullscreenReturn = useRef<HTMLElement | null>(null)
  const inlineHost = useRef<HTMLDivElement>(null)
  // A stable portal target allows DOM reparenting without remounting charts or API consumers.
  const [container] = useState(() => document.createElement('div'))
  const attachInline = useCallback((node: HTMLDivElement | null) => {
    inlineHost.current = node
    // Attach before portal child layout effects measure the chart on its first mount.
    if (node && !container.isConnected) node.append(container)
  }, [container])
  const closeButton = useRef<HTMLButtonElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)
  const restoreAfterResize = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 960px)').matches)
  const mobileRef = useRef(mobile)
  const [availableWidth, setAvailableWidth] = useState(() => window.innerWidth)
  const [panel, setPanel] = useState<Panel | 'bottom'>(() => window.innerWidth <= 768 ? initialMobilePanel ?? 'chart' : 'chart')
  const [entrySettled, setEntrySettled] = useState(initialMobilePanel !== null)
  if (!entrySettled && initialMobilePanel !== null) {
    setEntrySettled(true)
    if (window.innerWidth <= 768) setPanel(initialMobilePanel)
  }
  const [bottom, setBottom] = useState(bottomTabs.find(tab => !tab.hiddenFromTabs)?.id ?? '')
  const [bottomRequest, setBottomRequest] = useState(0)
  const [explicitBottom, setExplicitBottom] = useState<string | null>(null)
  const explicitBottomRef = useRef<string | null>(null)
  const pendingBottomFocus = useRef<string | null>(null)
  const choosePanel = (next: Panel | 'bottom') => {
    setEntrySettled(true)
    if (useSelector && mobile) {
      pickerDestination.current = next
      setPanelRequest(current => current + 1)
    }
    if (pickerRegion.current?.contains(document.activeElement) && next !== 'strategies') {
      if (next === 'detail') { pickerDestination.current = null; pickerTrigger.current?.focus({ preventScroll: true }) }
      else pickerDestination.current = next
    }
    setPickerOpen(Boolean(strategySelector && next === 'strategies'))
    setPanel(strategySelector && next === 'strategies' ? 'detail' : next)
  }
  useImperativeHandle(controlRef, () => ({ showPanel: choosePanel, getPanel: () => panel, showBottom: next => {
    if (!bottomTabs.some(tab => tab.id === next)) return
    setEntrySettled(true)
    explicitBottomRef.current = next; setExplicitBottom(next)
    pendingBottomFocus.current = next; setBottom(next); setPanel('bottom')
    setPickerOpen(false); setBottomRequest(current => current + 1)
  } }))
  const [initialWidth] = useState(() => window.innerWidth <= 1120 ? 320 : window.innerWidth <= 1240 ? 340 : 392)
  const [width, setWidth] = useState<number>()
  const drag = useRef<{ id: number; x: number; width: number } | null>(null)
  const visibleTabs = bottomTabs.filter(tab => !tab.hiddenFromTabs)
  const availableTabs = mobile && !useSelector ? visibleTabs.slice(0, 6) : visibleTabs
  const selectableTabs = explicitBottom === bottom ? bottomTabs : availableTabs
  const selectedBottom = selectableTabs.some(tab => tab.id === bottom) ? bottom : availableTabs[0]?.id
  const layout = active || embedded
  const constrained = layout && mobile && !useSelector
  const utility = constrained && panel === 'bottom'
  const bottomVisible = !constrained || panel === 'chart' || utility
  const size = availableWidth <= 1120 ? 'compact' : availableWidth <= 1240 ? 'medium' : 'wide'
  const railWidth = strategySelector ? 0 : size === 'compact' ? 200 : size === 'medium' ? 232 : 264
  const maxWidth = embedded && !active ? Math.max(320, Math.min(560, availableWidth - railWidth - 320)) : 560
  const preferredWidth = embedded && !active ? size === 'compact' ? 320 : size === 'medium' ? 340 : 392 : initialWidth
  const detailWidth = Math.min(width ?? preferredWidth, maxWidth)

  useLayoutEffect(() => {
    if (!pickerOpen || !useSelector) return
    const region = pickerRegion.current, trigger = pickerTrigger.current
    if (!region || !trigger) return
    const first = region.querySelector<HTMLElement>('input[type="search"]:not(:disabled)') ?? region.querySelector<HTMLElement>('button:not(:disabled)') ?? region
    const revealSearch = () => {
      const viewport = window.visualViewport
      const top = viewport?.offsetTop ?? 0
      const bottom = viewport ? top + viewport.height : window.innerHeight
      const bounds = first.getBoundingClientRect()
      if (bounds.top < top || bounds.bottom > bottom - 12) trigger.scrollIntoView({ block: 'start', inline: 'nearest' })
    }
    if (mobile) trigger.scrollIntoView({ block: 'start', inline: 'nearest' })
    else revealSearch()
    first.focus({ preventScroll: true })
    const measure = () => {
      // Follow the actual trigger height, including enlarged/translatable text.
      const top = region.getBoundingClientRect().top
      const viewport = window.visualViewport
      const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
      region.style.setProperty('--ctt-picker-height', `${Math.max(96, bottom - top - 12)}px`)
    }
    const resize = () => {
      // Reposition only for a changed viewport/trigger while this rail owns
      // focus. Ordinary scrolling and an owned child dialog keep their place.
      if (region.contains(document.activeElement)) revealSearch()
      measure()
    }
    const outside = (event: Event) => {
      if (!(event.target instanceof Node) || region.contains(event.target) || trigger.contains(event.target)) return
      // A menu/dialog launched by this rail is an owned continuation. Keep its
      // return target mounted AND visible until that child interaction ends.
      const ownedLayer = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-terminal-rail-owner]') : null
      if (ownedLayer?.dataset.terminalRailOwner === region.id) return
      // Do not steal focus from the destination of an outside interaction.
      if (event.type === 'pointerdown' && region.contains(document.activeElement)) trigger.focus({ preventScroll: true })
      setPickerOpen(false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(trigger)
    window.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('scroll', measure)
    document.addEventListener('scroll', measure, true)
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('focusin', outside)
    measure()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('scroll', measure)
      document.removeEventListener('scroll', measure, true)
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('focusin', outside)
    }
  }, [pickerOpen, useSelector, mobile])

  useLayoutEffect(() => {
    const next = pickerDestination.current
    pickerDestination.current = null
    if (!next) return
    if (useSelector && mobile) {
      // All three work areas remain visible. Navigation moves to a real region,
      // never to the hidden tabs from the former mobile layout.
      if (next === 'strategies') return // The disclosure effect focuses its search.
      const target = next === 'bottom'
        ? container.querySelector<HTMLElement>('.ctt-bottom-pane[data-selected=true]')
        : container.querySelector<HTMLElement>(`[data-terminal-panel="${next}"]`)
      if (target && !target.closest('[hidden],[inert]')) {
        target.tabIndex = -1; target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start', inline: 'nearest' })
      }
      return
    }
    const target = mobile ? container.querySelector<HTMLElement>(`.ctt-main-tabs [aria-controls="${id}-panel-${next === 'bottom' ? 'chart' : next}"]`)
      : container.querySelector<HTMLElement>(`[data-terminal-panel="${next === 'bottom' ? 'chart' : next}"]`)
    if (target && !target.closest('[hidden],[inert]')) { target.tabIndex = mobile ? 0 : -1; target.focus({ preventScroll: true }) }
  }, [panel, panelRequest, pickerOpen, mobile, container, id, useSelector])

  useEffect(() => {
    const change = () => {
      const measured = embedded && !active ? inlineHost.current?.getBoundingClientRect().width ?? window.innerWidth : window.innerWidth
      const nextMobile = measured <= 960
      setAvailableWidth(measured)
      if (nextMobile === mobileRef.current) return
      mobileRef.current = nextMobile
      // The portal stays stable in both the app main area and the modal.
      const current = layout
        ? document.activeElement instanceof HTMLElement && container.contains(document.activeElement) ? document.activeElement : document.activeElement === document.body || document.activeElement === root.current ? lastFocused.current : null
        : null
      if (nextMobile) {
        // CSS may hide and blur a panel before matchMedia's change event is dispatched.
        const focused = current?.closest<HTMLElement>('[data-terminal-panel]')
        if (focused && container.contains(focused)) {
          setPanel(useSelector && focused.dataset.terminalPanel === 'strategies' ? 'detail' : focused.dataset.terminalPanel as Panel)
          restoreAfterResize.current = current?.closest('.ctt-resize')
            ? useSelector ? focused : container.querySelector<HTMLButtonElement>(`.ctt-main-tabs [aria-controls="${focused.id}"]`)
            : current ?? null
        }
        const tab = current?.closest<HTMLElement>('.ctt-bottom-tabs [role="tab"]')
        const pane = current?.closest<HTMLElement>('.ctt-bottom-pane')
        // All bottom controls belong to the mobile chart area, not only the
        // desktop-only seventh tab. An earlier mobile detail choice can persist.
        if (current?.closest('.ctt-bottom') && container.contains(current)) {
          setPanel('chart')
          restoreAfterResize.current = current
        }
        // Keep a keyboard user's focus on the visible first item when desktop-only items disappear.
        const target = tab ?? pane
        if (target && container.contains(target) && target.dataset.tabId === explicitBottomRef.current) {
          setPanel('bottom'); restoreAfterResize.current = current
        } else if (!useSelector && target && container.contains(target) && Number(target.dataset.index) >= 6) {
          setPanel('chart')
          const first = container.querySelector<HTMLButtonElement>('.ctt-bottom-tabs [role="tab"]')
          if (first) { setBottom(first.dataset.tabId ?? ''); restoreAfterResize.current = first }
        }
      } else {
        const tab = current?.closest<HTMLElement>('.ctt-main-tabs [role="tab"]')
        const panelId = tab?.getAttribute('aria-controls')
        const target = panelId ? document.getElementById(panelId) : null
        if (target && container.contains(target)) restoreAfterResize.current = target
      }
      setMobile(nextMobile)
    }
    // A deliberate pointer interaction may blur a control without focusing a
    // replacement. Do not resurrect that stale keyboard target on resize.
    const clearPointerFocus = (event: PointerEvent) => {
      if (embedded || event.target instanceof Node && container.contains(event.target)) lastFocused.current = null
    }
    const resize = new ResizeObserver(change)
    if (inlineHost.current) resize.observe(inlineHost.current)
    window.addEventListener('resize', change)
    document.addEventListener('pointerdown', clearPointerFocus, true)
    change()
    return () => { resize.disconnect(); window.removeEventListener('resize', change); document.removeEventListener('pointerdown', clearPointerFocus, true) }
  }, [active, embedded, layout, container, useSelector])

  useLayoutEffect(() => {
    const element = restoreAfterResize.current
    restoreAfterResize.current = null
    if (element?.isConnected && element.getClientRects().length && !element.closest('[inert],[hidden]')) {
      // Desktop regions are not in the Tab order, but remain a meaningful
      // programmatic destination for the disappearing mobile tab.
      if (element.hasAttribute('data-terminal-panel')) element.tabIndex = mobile ? 0 : -1
      element.focus({ preventScroll: true })
    }
  }, [mobile, panel])

  useLayoutEffect(() => {
    const requested = pendingBottomFocus.current
    if (!requested || requested !== selectedBottom) return
    const pane = document.getElementById(`${id}-bottom-${requested}`)
    if (!pane?.isConnected || !pane.getClientRects().length || pane.closest('[hidden],[inert]')) return
    pendingBottomFocus.current = null
    pane.focus({ preventScroll: true })
    pane.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [bottomRequest, selectedBottom, mobile, panel, id])

  useLayoutEffect(() => {
    const element = root.current
    const inline = inlineHost.current
    if (!element || !inline) return
    if (!active) { if (container.parentNode !== inline) inline.append(container); return }
    const trigger = returnFocusRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const origin = window.location.href
    const bodyStyle = document.body.style
    const overflow = bodyStyle.getPropertyValue('overflow')
    const overflowPriority = bodyStyle.getPropertyPriority('overflow')
    element.append(container)
    element.showModal()
    bodyStyle.setProperty('overflow', 'hidden')
    closeButton.current?.focus({ preventScroll: true })
    const navigate = () => { if (window.location.href !== origin) onCloseRef.current() }
    window.addEventListener('popstate', navigate)
    window.addEventListener('hashchange', navigate)
    window.addEventListener('teth:navigate', navigate)
    return () => {
      window.removeEventListener('popstate', navigate)
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('teth:navigate', navigate)
      element.close()
      if (inline.isConnected && container.parentNode !== inline) inline.append(container)
      if (bodyStyle.getPropertyValue('overflow') === 'hidden' && !bodyStyle.getPropertyPriority('overflow')) {
        if (overflow) bodyStyle.setProperty('overflow', overflow, overflowPriority)
        else bodyStyle.removeProperty('overflow')
      }
      fullscreenReturn.current = window.location.href === origin ? trigger : null
    }
  }, [active, container, returnFocusRef])

  // Parent hidden/inert mutations must finish before restoring its trigger.
  useLayoutEffect(() => {
    if (active) return
    const trigger = fullscreenReturn.current
    fullscreenReturn.current = null
    if (!trigger) return
    if (trigger.isConnected && trigger !== document.body && trigger.getClientRects().length && !trigger.closest('[inert],[hidden]')) trigger.focus({ preventScroll: true })
    else {
      const heading = container.querySelector<HTMLElement>('h2')
      if (heading?.getClientRects().length && !heading.closest('[inert],[hidden]')) heading.focus({ preventScroll: true })
    }
  }, [active, container])

  function moveTab(event: KeyboardEvent<HTMLDivElement>, current: string, ids: readonly string[], choose: (next: string) => void) {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const index = Math.max(0, ids.indexOf(current))
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length
    if (!ids[next]) return
    event.preventDefault()
    choose(ids[next])
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  function chooseBottom(next: string) {
    explicitBottomRef.current = null; setExplicitBottom(null); setBottom(next)
  }

  function revealChartControl(target: EventTarget) {
    if (!useSelector || !mobile || !(target instanceof HTMLElement)) return
    const toolbar = target.closest('.cp-controls')
    if (!toolbar) return
    const button = target.getBoundingClientRect(), bounds = toolbar.getBoundingClientRect()
    // Native focus can leave a partly visible button clipped at the scroll edge.
    if (button.left < bounds.left || button.right > bounds.right) target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  const mainPanels: readonly Panel[] = strategySelector ? ['chart', 'detail'] : ['chart', 'strategies', 'detail']
  const rail = <section ref={pickerRegion} className="ctt-rail" id={`${id}-panel-strategies`} data-terminal-panel="strategies" hidden={useSelector && !pickerOpen} role={constrained && !useSelector ? 'tabpanel' : 'region'} tabIndex={useSelector ? -1 : constrained ? 0 : undefined} aria-label={labels.strategies} aria-labelledby={constrained && !useSelector ? `${id}-tab-strategies` : undefined} inert={useSelector ? !pickerOpen : constrained && panel !== 'strategies'}>{slots.strategies}</section>
  const bottomSection = <section className="ctt-bottom" aria-label={clientTerminalText(language, 'bottomRegion')} inert={!bottomVisible}>
    <div className="ctt-bottom-bar"><div className="ctt-bottom-tabs" role="tablist" aria-label={clientTerminalText(language, 'bottomTablist')} hidden={utility} onKeyDown={event => moveTab(event, selectedBottom ?? '', availableTabs.map(tab => tab.id), chooseBottom)}>{availableTabs.map((tab, index) => <button key={tab.id} data-index={index} data-tab-id={tab.id} type="button" role="tab" id={`${id}-bottom-tab-${tab.id}`} aria-controls={`${id}-bottom-${tab.id}`} aria-selected={selectedBottom === tab.id} tabIndex={selectedBottom === tab.id || !availableTabs.some(item => item.id === selectedBottom) && index === 0 ? 0 : -1} onClick={() => chooseBottom(tab.id)}>{tab.label}{Number.isFinite(tab.count) && tab.count! > 0 && <span className="ct">{tab.count}</span>}</button>)}</div><div className="ctt-bottom-tools">{bottomTools}</div></div>
    {bottomTabs.map(tab => <div key={tab.id} data-index={visibleTabs.findIndex(item => item.id === tab.id)} data-tab-id={tab.id} id={`${id}-bottom-${tab.id}`} className="ctt-bottom-pane" data-selected={selectedBottom === tab.id} hidden={(layout || !!tab.hiddenFromTabs) && selectedBottom !== tab.id} role={layout && !utility && availableTabs.some(item => item.id === tab.id) ? 'tabpanel' : 'region'} tabIndex={layout ? 0 : -1} aria-label={tab.label} aria-labelledby={layout && !utility && availableTabs.some(item => item.id === tab.id) ? `${id}-bottom-tab-${tab.id}` : undefined}>{tab.content}</div>)}
  </section>

  return <><div ref={attachInline} className="ctt-inline-host" /><dialog ref={root} className="ctt-modal" aria-modal="true" aria-labelledby={`${id}-title`} onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose() } }} />{createPortal(<section className="ctt-terminal" data-active={active} data-embedded={embedded && !active} data-layout={layout} data-strategy-selector={useSelector} data-mobile={mobile} data-size={size} data-panel={panel} role={active ? undefined : 'region'} aria-labelledby={active ? undefined : `${id}-title`} style={{ '--ctt-right': `${detailWidth}px` } as CSSProperties} onPointerDownCapture={() => { if (!entrySettled) setEntrySettled(true) }} onKeyDownCapture={() => { if (!entrySettled) setEntrySettled(true) }} onFocusCapture={event => { if (event.target instanceof HTMLElement) lastFocused.current = event.target }}>
    <header className="ctt-header"><h2 id={`${id}-title`} tabIndex={-1}>{title}</h2>{headerTools != null && <div className="ctt-header-tools">{headerTools}</div>}{active && <button ref={closeButton} data-terminal-close type="button" onClick={onClose} aria-label={clientTerminalText(language, 'closeTerminal')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>}</header>
    {slots.notice != null && <div className="ctt-notice" role="region" aria-label={clientTerminalText(language, 'noticeRegion')} tabIndex={layout ? 0 : undefined}>{slots.notice}</div>}
    {slots.marketHeader}
    <div className="ctt-main-tabs" hidden={useSelector} role="tablist" aria-label={clientTerminalText(language, 'panelTablist')} onKeyDown={event => moveTab(event, panel, mainPanels, next => choosePanel(next as Panel))}>
      {mainPanels.map(key => <button key={key} type="button" role="tab" id={`${id}-tab-${key}`} aria-controls={`${id}-panel-${key}`} aria-selected={panel === key} tabIndex={panel === key || panel === 'bottom' && key === 'chart' ? 0 : -1} onClick={() => choosePanel(key)}>{labels[key]}</button>)}
    </div>
    <div className="ctt-grid">
      <div className="ctt-market" id={`${id}-panel-chart`} data-terminal-panel="chart" role={constrained ? 'tabpanel' : 'region'} tabIndex={constrained ? 0 : undefined} aria-label={labels.chart} aria-labelledby={constrained ? `${id}-tab-chart` : undefined} inert={constrained && panel !== 'chart'}><div className="ctt-context">{slots.context}</div><div className="ctt-chart" onFocusCapture={event => revealChartControl(event.target)}>{slots.chart}</div></div>
      {!useSelector && rail}
      {useSelector && bottomSection}
      <section className="ctt-detail" id={`${id}-panel-detail`} data-terminal-panel="detail" role={constrained ? 'tabpanel' : 'region'} tabIndex={constrained ? 0 : undefined} aria-label={labels.detail} aria-labelledby={constrained ? `${id}-tab-detail` : undefined} inert={constrained && panel !== 'detail'}>
        {strategySelector && <div className="ctt-selector" onKeyDown={event => {
          if (!pickerOpen || event.defaultPrevented || event.key !== 'Escape' || event.nativeEvent.isComposing || event.keyCode === 229) return
          event.preventDefault(); event.stopPropagation(); setPickerOpen(false); pickerTrigger.current?.focus({ preventScroll: true })
        }}>
          <button ref={pickerTrigger} className="ctt-selector-button" type="button" aria-expanded={pickerOpen} aria-controls={`${id}-panel-strategies`} onClick={() => setPickerOpen(value => !value)}>
            <span>{strategySelector.countLabel}</span><b title={strategySelector.name}>{strategySelector.name}</b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>{rail}
        </div>}
        <div className="ctt-resize" role="separator" aria-label={clientTerminalText(language, 'widthSeparator', { label: labels.detail })} aria-orientation="vertical" aria-controls={`${id}-panel-detail`} aria-valuemin={320} aria-valuemax={maxWidth} aria-valuenow={detailWidth} tabIndex={layout && !mobile ? 0 : -1}
          onKeyDown={event => { if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); setWidth(() => event.key === 'Home' ? 320 : event.key === 'End' ? maxWidth : Math.max(320, Math.min(maxWidth, detailWidth + (event.key === 'ArrowLeft' ? 16 : -16)))) }}
          onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); drag.current = { id: event.pointerId, x: event.clientX, width: detailWidth }; event.currentTarget.setPointerCapture(event.pointerId) }}
          onPointerMove={event => { if (drag.current?.id === event.pointerId) setWidth(Math.max(320, Math.min(maxWidth, drag.current.width + drag.current.x - event.clientX))) }}
          onPointerUp={event => { if (drag.current?.id === event.pointerId) { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } }}
          onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }} />
        <div className="ctt-detail-content">{slots.detail}</div>
      </section>
    </div>
    {!useSelector && bottomSection}
  </section>, container)}</>
}
