import { catalogueSourceSha, findCatalogueStrategy } from './client-catalogue'
import { readSharedLocation, sharedHash } from './client-shared-navigation'

/** Local navigation intent only. Neither entitlement nor copy approval. */
export function readCataloguePlanIntent(value: unknown, owner: string | null) {
  if (!owner || !value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>
  if (input.owner !== owner || input.sourceSha !== catalogueSourceSha || typeof input.id !== 'string' || typeof input.returnHash !== 'string') return null
  const strategy = findCatalogueStrategy(input.id), back = readSharedLocation(input.returnHash)
  if (!strategy || strategy.id !== input.id || !back?.nick || back.view && back.view !== 'catalogue-backtest' || findCatalogueStrategy(back.nick)?.id !== strategy.id) return null
  return { owner, sourceSha: catalogueSourceSha, id: strategy.id, returnHash: sharedHash(back) }
}
