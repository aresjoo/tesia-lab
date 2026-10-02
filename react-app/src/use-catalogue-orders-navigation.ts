import { useLayoutEffect, useRef } from 'react'
import type { SharedLocation } from './client-shared-strategies'
import { sharedHash } from './client-shared-navigation'

/** UI-only memory, scoped to the mounted strategy/owner. Never persisted as
 * account state. Keep chart controls and calendar mounted in the parent. */
export function useCatalogueOrdersNavigation(location: SharedLocation, navigate: (location: SharedLocation, replace?: boolean) => void) {
  const openRef = useRef<HTMLButtonElement>(null), headingRef = useRef<HTMLHeadingElement>(null)
  const saved = useRef<{ positions: { element: HTMLElement; top: number }[]; x: number; y: number; direct: boolean } | null>(null)
  const previous = useRef(location.detailTab)
  const full = location.detailTab === 'trades'
  useLayoutEffect(() => {
    const wasFull = previous.current === 'trades'; previous.current = location.detailTab
    if (location.detailTab === 'info' && saved.current) saved.current.direct = false
    if (!full && (!wasFull || location.detailTab === 'info')) return
    const frame = requestAnimationFrame(() => {
      if (full) {
        headingRef.current?.focus({ preventScroll: true })
        headingRef.current?.closest('.catalogue-orders-full')?.scrollIntoView({ block: 'start' })
      } else {
        openRef.current?.focus({ preventScroll: true })
        if (saved.current) {
          for (const { element, top } of saved.current.positions) if (element.isConnected) element.scrollTop = top
          window.scrollTo(saved.current.x, saved.current.y)
        } else openRef.current?.scrollIntoView({ block: 'center' })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [full, location.detailTab])
  const open = () => {
    const positions: { element: HTMLElement; top: number }[] = []
    for (let element: HTMLElement | null = openRef.current?.parentElement ?? null; element; element = element.parentElement) positions.push({ element, top: element.scrollTop })
    saved.current = { positions, x: window.scrollX, y: window.scrollY, direct: true }
    navigate({ ...location, detailTab: 'trades' })
  }
  const back = () => {
    if (saved.current?.direct && window.location.hash === sharedHash({ ...location, detailTab: 'trades' }) && window.history.length > 1) window.history.back()
    else navigate({ ...location, detailTab: undefined }, true)
  }
  return { full, open, back, openRef, headingRef }
}
