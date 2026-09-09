import { useSyncExternalStore } from 'react'
import type { MouseEvent } from 'react'

export type SitePage = 'about' | 'download' | 'policies'
export function getSitePage(path = window.location.pathname): SitePage | null {
  const name = path.replace(/^\/+|\/+$/g, '')
  return name === 'about' || name === 'download' || name === 'policies' ? name : null
}
const subscribe = (listener: () => void) => {
  const events = ['popstate', 'hashchange', 'teth:navigate']
  events.forEach((event) => window.addEventListener(event, listener))
  return () => events.forEach((event) => window.removeEventListener(event, listener))
}
export function useSiteLocation() {
  return useSyncExternalStore(subscribe, () => window.location.pathname + window.location.hash)
}
export function navigateInternal(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.currentTarget.target === '_blank') return
  const url = new URL(event.currentTarget.href)
  if (url.origin !== window.location.origin) return
  event.preventDefault()
  if (url.href === window.location.href) return
  window.history.pushState({ tethSite: true }, '', url.pathname + url.search + url.hash)
  window.dispatchEvent(new Event('teth:navigate'))
}
