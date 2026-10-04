import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getSitePage, SiteHrefContext, useSiteLocation } from '../site-navigation'
import { getServiceSiteLocation, toServiceSiteHref } from '../internal-poc/service-site-navigation'
import { ClientLoadBoundary, ClientLoadFallback } from './ClientLoadBoundary'

const ClientPublicPages = lazy(() => import('./ClientPublicPages'))
const documentEntryKey = 'tethPublicDocumentEntry'
const documentPositionKey = 'tethPublicDocumentPosition'
const documentReloadKey = 'tethPublicDocumentReload'
type ReadingPosition = { x: number; y: number }

function documentPosition(value: unknown): ReadingPosition | null {
  const state: unknown = window.history.state
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const record = state as Record<string, unknown>
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const position = value as Record<string, unknown>
  if (typeof record[documentEntryKey] !== 'string' || position.entry !== record[documentEntryKey]) return null
  if (typeof position.x !== 'number' || !Number.isFinite(position.x) || position.x < 0 || typeof position.y !== 'number' || !Number.isFinite(position.y) || position.y < 0) return null
  return { x: position.x, y: position.y }
}

function reloadPosition(): ReadingPosition | null {
  try {
    const raw = window.sessionStorage.getItem(documentReloadKey)
    if (!raw || raw.length > 512) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const savedAt = (value as Record<string, unknown>).savedAt
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt) || Date.now() - savedAt < 0 || Date.now() - savedAt > 60_000) return null
    return documentPosition(value)
  } catch { return null }
}

function useDocumentHistory(service: boolean) {
  const [navigation, setNavigation] = useState<{ revision: number; href: string; history: boolean; position: ReadingPosition | null }>(() => {
    // A full-document load loses the memory map and may restore before React's
    // lazy body has height. Fresh links never consume a previous reading position.
    const type = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type
    const history = type === 'reload' || type === 'back_forward'
    const href = window.location.pathname + window.location.search + window.location.hash
    const page = getSitePage((service ? getServiceSiteLocation(href) ?? '/' : href).split(/[?#]/)[0])
    return { revision: 0, href, history, position: history && page ? (type === 'reload' ? reloadPosition() : null) ?? documentPosition(window.history.state?.[documentPositionKey]) : null }
  })
  useLayoutEffect(() => {
    // Lives with the router, not a document which is removed on app entry.
    // History owns entry identity; positions stay in bounded, page-local memory.
    // Full-document exits retain only this public entry's reading coordinates.
    // No draft, account data or content is persisted in history.state/storage.
    const positions = new Map<string, ReadingPosition>()
    const href = () => window.location.pathname + window.location.search + window.location.hash
    const isDocument = (location: string) => Boolean(getSitePage((service ? getServiceSiteLocation(location) ?? '/' : location).split(/[?#]/)[0]))
    const key = (fresh = false): string | null => {
      const state: unknown = window.history.state
      if (state !== null && (typeof state !== 'object' || Array.isArray(state) || Object.getPrototypeOf(state) !== Object.prototype)) return null
      const record = state as Record<string, unknown> | null
      if (!fresh && typeof record?.[documentEntryKey] === 'string') return record[documentEntryKey]
      try {
        const value = crypto.randomUUID()
        window.history.replaceState({ ...record, [documentEntryKey]: value }, '')
        return value
      }
      catch { return null } // Restricted history must not make navigation fail.
    }
    const initialHref = href()
    let current = { key: isDocument(initialHref) ? key() : null, href: initialHref }
    const consumePosition = (entry: string | null, consumeReload: boolean) => {
      if (!entry) return
      const state: unknown = window.history.state
      if (state && typeof state === 'object' && !Array.isArray(state) && Object.getPrototypeOf(state) === Object.prototype) {
        const record = state as Record<string, unknown>
        if (record[documentEntryKey] === entry && documentPosition(record[documentPositionKey])) {
          const remaining = { ...record }
          delete remaining[documentPositionKey]
          try { window.history.replaceState(remaining, '') }
          catch { /* Restricted history cannot prevent showing the document. */ }
        }
      }
      if (!consumeReload) return
      try {
        const raw = window.sessionStorage.getItem(documentReloadKey)
        if (raw && raw.length <= 512 && JSON.parse(raw)?.entry === entry) window.sessionStorage.removeItem(documentReloadKey)
      } catch { /* Unavailable/malformed optional storage cannot block a page. */ }
    }
    // Initialization reads without side effects in StrictMode. Once the value
    // is in React state it is a one-use receipt, not a persistent fallback for
    // subsequent visits. Preserve every foreign field and other entry's receipt.
    const initialType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type
    consumePosition(current.key, initialType === 'reload' || initialType === 'back_forward')
    const capture = () => {
      if (!current.key || !isDocument(current.href)) return
      positions.delete(current.key)
      positions.set(current.key, { x: window.scrollX, y: window.scrollY })
      if (positions.size > 100) positions.delete(positions.keys().next().value!)
    }
    const leaveDocument = () => {
      if (!current.key || current.href !== href() || !isDocument(current.href)) return
      const state: unknown = window.history.state
      if (!state || typeof state !== 'object' || Array.isArray(state) || Object.getPrototypeOf(state) !== Object.prototype) return
      const record = state as Record<string, unknown>
      if (record[documentEntryKey] !== current.key) return
      const x = window.scrollX, y = window.scrollY
      if (!Number.isFinite(x) || x < 0 || !Number.isFinite(y) || y < 0) return
      // One write on document exit, never on scroll. Entry identity prevents a
      // cloned/stale coordinate record from attaching to a different visit.
      try { window.history.replaceState({ ...record, [documentPositionKey]: { entry: current.key, x, y } }, '') }
      catch { /* Native restoration remains available if history is restricted. */ }
      // Reload snapshots history before pagehide. Bridge that one boundary
      // with one 60-second, same-entry receipt (no URL/content/account data).
      // No beforeunload handler, scroll-time writes or unbounded storage map.
      try { window.sessionStorage.setItem(documentReloadKey, JSON.stringify({ entry: current.key, x, y, savedAt: Date.now() })) }
      catch { /* History/native restoration still work when storage is denied. */ }
    }
    const navigate = (event: Event) => {
      const nextHref = href()
      // A native fragment navigation emits popstate then hashchange. Do not
      // consume that pair twice or replace the newly selected entry identity.
      if (event.type === 'hashchange' && nextHref === current.href) return
      capture()
      const history = event.type === 'popstate'
      let nextKey = isDocument(nextHref) ? key() : null
      // push-based callers may clone history.state. A new entry must not share
      // its parent's reading position, even when both URLs are identical.
      if (nextKey && !history && nextKey === current.key) nextKey = key(true)
      const position = history && nextKey && isDocument(nextHref) ? positions.get(nextKey) ?? documentPosition(window.history.state?.[documentPositionKey]) : null
      consumePosition(nextKey, history)
      current = { key: nextKey, href: nextHref }
      setNavigation(previous => ({ revision: previous.revision + 1, href: nextHref, history, position }))
    }
    const resumeDocument = (event: PageTransitionEvent) => {
      // A bfcache return resumes the old hook, without a React mount. Native
      // restoration owns its position; only retire the departure receipts.
      if (event.persisted && current.href === href()) consumePosition(current.key, true)
    }
    window.addEventListener('popstate', navigate, true)
    window.addEventListener('teth:navigate', navigate, true)
    window.addEventListener('hashchange', navigate, true)
    window.addEventListener('pagehide', leaveDocument)
    window.addEventListener('pageshow', resumeDocument)
    return () => {
      window.removeEventListener('popstate', navigate, true)
      window.removeEventListener('teth:navigate', navigate, true)
      window.removeEventListener('hashchange', navigate, true)
      window.removeEventListener('pagehide', leaveDocument)
      window.removeEventListener('pageshow', resumeDocument)
    }
  }, [service])
  return navigation
}

export function SiteRouter({ children, service = false }: { children: ReactNode; service?: boolean }) {
  const documentNavigation = useDocumentHistory(service)
  const browserLocation = useSiteLocation(service)
  const location = service ? getServiceSiteLocation(browserLocation) ?? '/' : browserLocation
  const page = getSitePage(location.split(/[?#]/)[0])
  const [appOpened, setAppOpened] = useState(!page)
  const previousPage = useRef(page)
  // Keep an opened app alive: information pages must not discard a chat draft.
  // On a direct information URL the funnel must not mount and rewrite its hash.
  if (!page && !appOpened) setAppOpened(true)
  useEffect(() => {
    if (!page) {
      document.title = 'TETH AI — 거래를 위한 AI'
      if (previousPage.current) document.querySelector<HTMLElement>('.client-source-main')?.focus({ preventScroll: true })
    }
    previousPage.current = page
  }, [page])
  return <SiteHrefContext.Provider value={service ? toServiceSiteHref : null}>
    {appOpened && <div hidden={Boolean(page)} inert={Boolean(page)}>{children}</div>}
    {page && <ClientLoadBoundary fallback={<ClientLoadFallback />}><Suspense fallback={<ClientLoadFallback loading />}><ClientPublicPages page={page} location={location} historyNavigation={documentNavigation} /></Suspense></ClientLoadBoundary>}
  </SiteHrefContext.Provider>
}
