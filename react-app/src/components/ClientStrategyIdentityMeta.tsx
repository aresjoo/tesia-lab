import { useClientPreferences } from '../client-preferences'
import type { StrategyKind } from '../client-strategy-classification'
import { strategyVenue, type StrategyVenue } from '../client-strategy-identity'
import kindCopy from '../client-strategy-filter-copy.json'
import identityCopy from '../client-strategy-identity-copy.json'
import '../client-strategy-identity.css'

/** Only explicit presentation evidence. No rotating/default exchange or status. */
export function ClientStrategyIdentityMeta({ kind, venue, fallback, id }: { kind?: StrategyKind; venue?: StrategyVenue; fallback: string; id?: string }) {
  const { language } = useClientPreferences()
  const knownKind = kind && ['agent', 'rule', 'mix'].includes(kind) ? kindCopy[language][kind] : null
  const exchange = strategyVenue(venue)
  const label = [knownKind, exchange ? identityCopy[language].runningOn.replace('{venue}', () => exchange.name) : null].filter(Boolean).join(', ') || fallback
  return <span id={id} className="strategy-identity-meta">
    {exchange?.logo && <img src={exchange.logo} alt="" width="14" height="14" loading="lazy"/>}
    <span>{label}</span>
  </span>
}
