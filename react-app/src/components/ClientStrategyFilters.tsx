import { useId, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { useClientPreferences } from '../client-preferences'
import { sharingCopy, type SharingCopyKey } from '../client-sharing-copy'
import { sharedFollowCopy } from '../client-shared-follow-copy'
import { ClientSharingDropdown } from './ClientSharingDropdown'
import type { SharingPreferences } from '../client-sharing-preferences'
import type { StrategyKindFilter, StrategyMarketFilter } from '../client-strategy-classification'
import { sharingSortOptions, sharingKindOptions, sharingMarketOptions } from '../client-strategy-filter-options'
import listCopy from '../client-strategy-list-copy.json'
import filterCopy from '../client-strategy-filter-copy.json'
import '../client-strategy-filters.css'

/** Source 412fd60 final mk3Controls/sk-main, shared by preview and service. */
export function ClientStrategyFilters({ tab, showTabs = true, activeFollowCount = 0, sort, unavailableSorts = [], kind, market, query, openDropdown, setOpenDropdown, chooseTab, chooseSort, chooseKind, chooseMarket, setQuery, exchangeFilter }: {
  showTabs?: boolean
  unavailableSorts?: readonly string[]
  exchangeFilter?: ReactNode
  tab: SharingPreferences['tab']; activeFollowCount?: number; sort: string
  kind: StrategyKindFilter; market: StrategyMarketFilter; query: string
  openDropdown: 'market' | 'exchange' | null; setOpenDropdown: (value: 'market' | 'exchange' | null) => void
  chooseTab: (value: SharingPreferences['tab']) => void; chooseSort: (value: string) => void
  chooseKind: (value: StrategyKindFilter) => void; chooseMarket: (value: string) => void; setQuery: (value: string) => void
}) {
  const { language } = useClientPreferences(), helpId = useId()
  const s = (key: SharingCopyKey) => sharingCopy(language, key)
  const copy = filterCopy[language]
  return <div className="tfbk-filters strategy-filters" data-catalogue-list={!showTabs && tab === 'find' || undefined}>
    {/* Internal service consumers retain their management tabs until relocated. */}
    {showTabs && <div className="ss3-tabs" role="group" aria-label={sharedFollowCopy(language, '전략 공유 영역')}>
      {([['find', '전략 찾기'], ['follow', '따라가는 중'], ['mine', '내 전략']] as const).map(([id, label]) =>
        <button type="button" className={`fp ${tab === id ? 'on' : ''}`} aria-pressed={tab === id} key={id} onClick={() => chooseTab(id)}>
          {s(label)}{id === 'follow' && activeFollowCount > 0 ? ` ${activeFollowCount}` : ''}
        </button>)}
    </div>}
    {!showTabs && tab !== 'find' && <button type="button" className="ss3-back" onClick={() => chooseTab('find')}>{s('전략 찾기')}</button>}
    {tab === 'find' && <>
      <div className="strategy-kind-row">
        <div className="strategy-kind-group" role="group" aria-label={copy.kindLabel}>
          {sharingKindOptions.map(value => <button key={value} type="button" aria-pressed={kind === value}
            title={copy[`${value}Help`]} aria-describedby={kind === value && kind !== 'all' ? helpId : undefined}
            onClick={() => chooseKind(value)}>{copy[value]}</button>)}
        </div>
        {kind !== 'all' && <p id={helpId} className="strategy-kind-help">{copy[`${kind}Help`]}</p>}
      </div>
      <div className={`strategy-filter-row${exchangeFilter ? ' has-my-exchanges' : ''}`}>
        <label className="strategy-list-sort"><select aria-label={s('정렬 기준')} value={sort} onChange={event => chooseSort(event.target.value)}>
          {sharingSortOptions.map(option => <option key={option.value} value={option.value} disabled={unavailableSorts.includes(option.value)}>{listCopy[language][option.label]}</option>)}
        </select></label>
        <ClientSharingDropdown mobileSheet label={copy.marketLabel} value={market}
          options={sharingMarketOptions.map(value => ({ value, label: copy[value === 'all' ? 'allMarkets' : value] }))}
          open={openDropdown === 'market'} onOpenChange={open => setOpenDropdown(open ? 'market' : null)} onSelect={chooseMarket} />
        {exchangeFilter}
        <label className="ss3-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label={s('전략 검색')}
          placeholder={s('전략 검색')} value={query} onChange={event => setQuery(event.target.value)} /></label>
      </div>
    </>}
  </div>
}
