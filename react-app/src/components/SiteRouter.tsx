import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getSitePage, SiteHrefContext, useSiteLocation } from '../site-navigation'
import { getServiceSiteLocation, toServiceSiteHref } from '../internal-poc/service-site-navigation'
import { ClientLoadBoundary, ClientLoadFallback } from './ClientLoadBoundary'

const ClientPublicPages = lazy(() => import('./ClientPublicPages'))

export function SiteRouter({ children, service = false }: { children: ReactNode; service?: boolean }) {
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
    {page && <ClientLoadBoundary fallback={<ClientLoadFallback />}><Suspense fallback={<ClientLoadFallback loading />}><ClientPublicPages page={page} location={location} /></Suspense></ClientLoadBoundary>}
  </SiteHrefContext.Provider>
}
