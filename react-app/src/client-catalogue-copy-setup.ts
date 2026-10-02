import { catalogueSourceSha, findCatalogueStrategy, type CatalogueStrategy } from './client-catalogue'

/** UI settings only. Not an API request, entitlement or order instruction. */
export type CatalogueCopySettings = { amount: number; loss: -10 | -20 | -30 | -50; existing: 'skip' | 'copy'; cap: number }
export type CatalogueCopySetup = {
  owner: string; sourceSha: string; strategyId: string; available: number
  /** Changes whenever supplied connection/account evidence is replaced. */
  revision: string
  /** One-shot presentation request after returning from the connection flow. */
  resumeId?: string
  onConfirm: (settings: Readonly<CatalogueCopySettings>, signal: AbortSignal) => Promise<void>
}
export const catalogueCopyLosses = [-10, -20, -30, -50] as const

/** Exact source mkMin, including its agent-specific minimum. */
export function catalogueCopyMinimum(strategy: Readonly<CatalogueStrategy>) {
  if (strategy.kind === 'agent') return strategy.top >= 3 ? 500 : strategy.top === 2 ? 300 : 200
  const loss = strategy.sl === undefined ? 5 : Math.abs(strategy.sl)
  return loss >= 8 ? 500 : loss >= 5 ? 200 : 100
}
export function catalogueCopyScope(value: CatalogueCopySetup | undefined, owner: string | null, id: string | undefined) {
  if (!value || !owner || value.owner !== owner || value.sourceSha !== catalogueSourceSha || value.strategyId !== id
    || !id || findCatalogueStrategy(id)?.id !== id || !value.revision.trim() || typeof value.onConfirm !== 'function'
    || !Number.isFinite(value.available) || value.available < 0) return null
  return JSON.stringify([owner, catalogueSourceSha, id, value.revision, value.available, value.resumeId ?? null])
}
export function catalogueCopyDecimal(raw: string) {
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()) ? Number(raw.trim()) : NaN
}
export function catalogueCopySettings(strategy: Readonly<CatalogueStrategy>, available: number, amount: string, loss: number, existing: string, cap: string): CatalogueCopySettings | null {
  const budget = catalogueCopyDecimal(amount), limit = catalogueCopyDecimal(cap)
  if (!Number.isFinite(available) || available < 0 || !Number.isFinite(budget) || budget < catalogueCopyMinimum(strategy) || budget > available
    || !catalogueCopyLosses.includes(loss as CatalogueCopySettings['loss']) || !['skip', 'copy'].includes(existing)
    || !Number.isInteger(limit) || limit < 5 || limit > 95) return null
  return { amount: budget, loss: loss as CatalogueCopySettings['loss'], existing: existing as CatalogueCopySettings['existing'], cap: limit }
}
