import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getSitePage, useSiteLocation } from '../site-navigation'
import { ClientLoadBoundary, ClientLoadFallback } from './ClientLoadBoundary'

const ClientPublicPages = lazy(() => import('./ClientPublicPages'))

export function SiteRouter({ children }: { children: ReactNode }) {
  const location = useSiteLocation()
  const page = getSitePage(location.split('#')[0])
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
  return <>
    {appOpened && <div hidden={Boolean(page)}>{children}</div>}
    {page && <ClientLoadBoundary fallback={<ClientLoadFallback />}><Suspense fallback={<ClientLoadFallback loading />}><ClientPublicPages page={page} location={location} /></Suspense></ClientLoadBoundary>}
  </>
}
