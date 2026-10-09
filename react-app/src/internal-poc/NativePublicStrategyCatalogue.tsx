import { useId, useLayoutEffect, useRef, useState } from 'react'
import { catalogueAssets, catalogueStrategies, findCatalogueStrategy } from '../client-catalogue'
import { catalogueIdentity } from '../client-catalogue-presentation'
import { paginateSourceStrategies } from '../client-strategy-pagination'
import type { SharedLocation } from '../client-shared-strategies'
import type { StrategyKindFilter, StrategyMarketFilter } from '../client-strategy-classification'
import { ClientStrategyFilters } from '../components/ClientStrategyFilters'
import { ClientStrategyListCard } from '../components/ClientStrategyListCard'
import { ClientStrategyPagination } from '../components/ClientStrategyPagination'
import { ClientSharedDetailShell } from '../components/ClientSharedDetailShell'
import { useClientPreferences } from '../client-preferences'
import { researchCopy } from '../client-research-copy'
import { clientResearchScrollport } from '../client-research-scrollport'
import { sharingCopy } from '../client-sharing-copy'
import { sharingUnavailable } from '../client-sharing-presentation'
import copy from '../client-strategy-list-copy.json'

/** The original public catalogue definitions are editorial content. Reading
 * them never runs the browser preview engine or creates account/order state.
 * Real performance and follower counts remain absent until supplied by a
 * verified producer. The existing source filters/cards/detail shell own UI. */
export function NativePublicStrategyCatalogue({ onReturn, location = { period: 'all' }, onNavigate, shouldFocus, signedIn, onLogin }: {
  onReturn: () => void; location?: SharedLocation; onNavigate?: (value: SharedLocation, replace?: boolean) => void
  shouldFocus: () => boolean; signedIn: boolean; onLogin: (intent: 'login' | 'signup') => void
}) {
  const { language } = useClientPreferences(), id = useId()
  const title = useRef<HTMLHeadingElement>(null), detailTitle = useRef<HTMLHeadingElement>(null)
  const [query, setQuery] = useState(''), [kind, setKind] = useState<StrategyKindFilter>('all')
  const [market, setMarket] = useState<StrategyMarketFilter>('all'), [sort, setSort] = useState('pick')
  const [page, setPage] = useState(1), [dropdown, setDropdown] = useState<'market' | 'exchange' | null>(null)
  const grid = useRef<HTMLDivElement>(null)
  const pageFocusOrigin = useRef<HTMLElement | null>(null)
  const [pageScrollRequest, requestPageScroll] = useState(0)
  const [localLocation, setLocalLocation] = useState(location), [unavailable, setUnavailable] = useState(false)
  const current = onNavigate ? location : localLocation
  const navigate = (value: SharedLocation) => { setUnavailable(false); if (onNavigate) onNavigate(value); else setLocalLocation(value) }
  const selected = current.nick ? findCatalogueStrategy(current.nick) : undefined
  const selectedId = selected?.id
  useLayoutEffect(() => {
    // Source gContent starts each newly selected document at the top, including
    // browser-back to the list. Locale, filters and detail periods are not navigation.
    clientResearchScrollport(title.current?.closest<HTMLElement>('#research-main') ?? null)
      ?.scrollTo({ top: 0, behavior: 'instant' })
  }, [selectedId])
  useLayoutEffect(() => {
    if (shouldFocus()) (selected ? detailTitle : title).current?.focus({ preventScroll: true })
  }, [shouldFocus, selected])
  useLayoutEffect(() => {
    const origin = pageFocusOrigin.current
    pageFocusOrigin.current = null
    if (!pageScrollRequest || !grid.current) return
    const scroll = clientResearchScrollport(grid.current.closest<HTMLElement>('#research-main'))
    if (!scroll) return
    const top = grid.current.getBoundingClientRect().top - scroll.getBoundingClientRect().top
    // Source tfSS3Page exposes a newly selected page only when the old grid
    // was above the viewport. A repeated page click is also a navigation intent.
    if (top < 0) scroll.scrollBy({ top: top - (window.innerWidth <= 860 ? 148 : 90), behavior: 'instant' })
    // Keep keyboard reading order with the new page rather than an offscreen
    // pager. A pointer click or a newer focus intent does not use this handoff.
    // At the first/last page the activated arrow becomes disabled, and the
    // browser drops its focus to body. Recover only that known keyboard origin.
    const disabledOrigin = origin instanceof HTMLButtonElement && origin.disabled && document.activeElement === document.body
    if (origin?.isConnected && (document.activeElement === origin || disabledOrigin)) {
      grid.current.querySelector<HTMLElement>('.strategy-list-link')?.focus({ preventScroll: true })
    }
  }, [pageScrollRequest])
  const rows = catalogueStrategies.filter(strategy => {
    const row = catalogueIdentity(strategy)
    return (kind === 'all' || row.kind === kind) && (market === 'all' || row.market === market)
      && (!query.trim() || `${row.title} ${row.asset} ${row.description}`.toLocaleLowerCase(language).includes(query.trim().toLocaleLowerCase(language)))
  })
  // Without observed performance/popularity, do not invent ranking values.
  const pagination = paginateSourceStrategies(rows.map(strategy => ({ ...strategy, me: false })), !query && kind === 'all' && market === 'all', page)
  const changePage = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 1 || value > pagination.pages) return
    const active = document.activeElement
    pageFocusOrigin.current = active instanceof HTMLElement && active.matches(':focus-visible')
      && grid.current?.parentElement?.querySelector('.mk-pager')?.contains(active) ? active : null
    setPage(value)
    requestPageScroll(request => request + 1)
  }
  const resetFilteredPage = () => {
    setPage(1)
    // Source filter choices rebuild the document; search typing only updates
    // its grid and deliberately does not use this scroll reset.
    clientResearchScrollport(title.current?.closest<HTMLElement>('#research-main') ?? null)
      ?.scrollTo({ top: 0, behavior: 'instant' })
  }
  const unavailableAction = () => setUnavailable(true)
  const authAction = (intent: 'login' | 'signup') => () => {
    if (!signedIn) onLogin(intent)
    else setUnavailable(true)
  }
  const signupAction = authAction('signup'), loginAction = authAction('login')
  return <section id="research-main" className="client-research-hub client-sharing-hub native-strategies" aria-labelledby={id}>
    <header className="hub-header"><h1 ref={title} id={id} tabIndex={-1}>{copy[language].title}</h1><button type="button" onClick={onReturn}>{researchCopy(language, 'return')}</button></header>
    <div className="client-strategy-sharing" data-public-catalogue>
      {selected ? <ClientSharedDetailShell row={catalogueIdentity(selected)} location={current} title={detailTitle} onNavigate={navigate}
        info={[[copy[language].title, catalogueIdentity(selected).title], [catalogueIdentity(selected).asset, catalogueAssets(selected).join(', ')]]}
        onCopy={signupAction} onAnalyze={loginAction} onWatch={signupAction} onCopyLink={unavailableAction} analyzing={false} watched={false} shareAvailable={false}>
        <p className="ss3-empty" role="status">{sharingUnavailable(language)}</p>
        {unavailable && <p role="status">{sharingUnavailable(language)}</p>}
      </ClientSharedDetailShell> : <>
        <ClientStrategyFilters showTabs={false} tab="find" sort={sort} unavailableSorts={['ret', 'fw']} kind={kind} market={market} query={query}
          openDropdown={dropdown} setOpenDropdown={setDropdown} chooseTab={() => undefined}
          chooseSort={value => { setSort(value); resetFilteredPage() }} chooseKind={value => { setKind(value); resetFilteredPage() }}
          chooseMarket={value => { setMarket(value as StrategyMarketFilter); resetFilteredPage() }} setQuery={value => { setQuery(value); setPage(1) }} />
        <div className="strategy-list-container">{rows.length === 0 && <p className="ss3-empty" role="status">{sharingCopy(language, '조건에 맞는 전략이 없어요')}</p>}<div ref={grid} className="strategy-list-grid">
          {pagination.rows.map((strategy, index) => <ClientStrategyListCard key={`${strategy.id}:${index}`} {...catalogueIdentity(strategy)} followers={undefined}
            performance={null} location={{ nick: strategy.id, period: 'all' }} onNavigate={navigate} />)}
        </div><ClientStrategyPagination page={pagination.page} pages={pagination.pages} onChange={changePage} /></div>
      </>}
    </div>
  </section>
}
