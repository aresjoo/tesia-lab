import { brokerPresentationBound, type BrokerServicePresentation } from './client-broker-presentation'
import type { StrategyVenue } from './client-strategy-identity'

/** Source ac/sk-myex display identities. Not an execution eligibility registry. */
export const myExchangeIds = ['bitget', 'binance', 'okx', 'bybit', 'mexc', 'woox', 'gate'] as const
export type MyExchangeId = typeof myExchangeIds[number]
export type MyExchangeFilter = '' | 'all' | MyExchangeId
const names: Record<MyExchangeId, string> = { bitget: 'Bitget', binance: 'Binance', okx: 'OKX', bybit: 'Bybit', mexc: 'MEXC', woox: 'WOO X', gate: 'Gate' }
export type MyExchange = { id: MyExchangeId; name: string; logo: string }
export function isMyExchangeId(value: string): value is MyExchangeId {
  return (myExchangeIds as readonly string[]).includes(value)
}
export function connectedMyExchanges(presentation: BrokerServicePresentation | undefined, owner: string | null, signedIn: boolean): MyExchange[] {
  if (!signedIn || !brokerPresentationBound(presentation, owner)) return []
  const seen = new Set<string>()
  return (presentation.catalog ?? []).flatMap(item => {
    const id = item.broker.id
    if (item.connectionState !== 'CONNECTED' || !isMyExchangeId(id) || seen.has(id)) return []
    seen.add(id)
    return [{ id, name: names[id], logo: `/client-broker-assets/app-${id}.${id === 'gate' ? 'jpg' : 'png'}` }]
  })
}
/** A removed selection falls back to all connected exchanges, without overwriting the saved choice. */
export function effectiveMyExchange(value: MyExchangeFilter, connected: readonly MyExchange[]): MyExchangeFilter {
  if (!connected.length || !value) return ''
  return value === 'all' || connected.some(item => item.id === value) ? value : 'all'
}
export function selectedMyExchanges(value: MyExchangeFilter, connected: readonly MyExchange[]) {
  return !value ? [] : value === 'all' ? connected : connected.filter(item => item.id === value)
}
export function matchesMyExchange(row: { me?: boolean; venue?: StrategyVenue }, selected: readonly MyExchange[]) {
  if (!selected.length) return true
  if (row.me || !row.venue) return false
  // Match supplied venue identity only. Never infer it from a ticker, title, or login.
  const name = row.venue.name.trim().toLowerCase()
  return selected.some(item => row.venue?.logo === item.id || name === names[item.id].toLowerCase())
}
