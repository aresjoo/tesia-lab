import type { SharedLocation, SharedPeriod, copyProfileTabs, copyDetailTabs } from './client-shared-strategies'

/** Explicit model namespace prevents a catalogue ID from opening a legacy or service record. */
export const catalogueCopyLocation = (id: string, copyTab: NonNullable<SharedLocation['copyTab']> = 'pos'): SharedLocation => ({ view: 'copy-detail', copyModel: 'catalogue', copyId: id, copyTab, period: 'all' })
export const catalogueBacktestLocation = (id: string): SharedLocation => ({ view: 'catalogue-backtest', nick: id, period: 'all' })

/** Source route parsing without importing the synthetic strategy/price producer. */
export function readSharedLocation(hash = window.location.hash): SharedLocation | null {
  if (!/^#\/share(?:\/|$)/.test(hash)) return null
  try {
    const section = /^#\/share\/(library|publishing)$/.exec(hash)
    if (section) return { section: section[1] as 'library' | 'publishing', period: 'all' }
    const backtest = /^#\/share\/bt\/([^/]+)$/.exec(hash)
    if (backtest) { const id = decodeURIComponent(backtest[1]); return id === 'mine' ? null : catalogueBacktestLocation(id) }
    const trader = /^#\/share\/t\/([^/]+)(?:\/(ov|pos|cal|bal|cop))?$/.exec(hash)
    if (trader) return { view: 'trader', nick: decodeURIComponent(trader[1]), profileTab: (trader[2] ?? 'ov') as keyof typeof copyProfileTabs, period: 'all' }
    const setup = /^#\/share\/copy\/([^/]+)$/.exec(hash)
    if (setup) return { view: 'copy-setup', nick: decodeURIComponent(setup[1]), period: 'all' }
    const catalogue = /^#\/share\/catalogue-copy\/([^/]+)(?:\/(pos|hist|share|bal|tx))?$/.exec(hash)
    if (catalogue) return { view: 'copy-detail', copyModel: 'catalogue', copyId: decodeURIComponent(catalogue[1]), copyTab: (catalogue[2] ?? 'pos') as keyof typeof copyDetailTabs, period: 'all' }
    const detail = /^#\/share\/c\/([^/]+)(?:\/(pos|hist|share|bal|tx))?$/.exec(hash)
    if (detail) return { view: 'copy-detail', copyId: decodeURIComponent(detail[1]), copyTab: (detail[2] ?? 'pos') as keyof typeof copyDetailTabs, period: 'all' }
    const strategy = /^#\/share\/s\/([^/]+)(?:\/(all|1y|2y)(?:\/(ov|info|trades))?)?$/.exec(hash)
    return strategy ? { nick: decodeURIComponent(strategy[1]), period: (strategy[2] ?? 'all') as SharedPeriod, ...(strategy[3] === 'info' || strategy[3] === 'trades' ? { detailTab: strategy[3] } : {}) } : { period: 'all' }
  } catch { return { period: 'all' } }
}

export function sharedHash(value: SharedLocation): string {
  const encode = (text: string) => encodeURIComponent(text).replace(/'/g, '%27')
  if (!value.nick && !value.view && value.section) return `#/share/${value.section}`
  if (value.view === 'catalogue-backtest' && value.nick) return `#/share/bt/${encode(value.nick)}`
  if (value.view === 'trader' && value.nick) return `#/share/t/${encode(value.nick)}${!value.profileTab || value.profileTab === 'ov' ? '' : `/${value.profileTab}`}`
  if (value.view === 'copy-setup' && value.nick) return `#/share/copy/${encode(value.nick)}`
  if (value.view === 'copy-detail' && value.copyId) return `#/share/${value.copyModel === 'catalogue' ? 'catalogue-copy' : 'c'}/${encode(value.copyId)}${!value.copyTab || value.copyTab === 'pos' ? '' : `/${value.copyTab}`}`
  return value.nick ? `#/share/s/${encode(value.nick)}${value.detailTab === 'info' || value.detailTab === 'trades' ? `/${value.period}/${value.detailTab}` : value.period === 'all' ? '' : `/${value.period}`}` : '#/share'
}
