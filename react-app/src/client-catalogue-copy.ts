/** Current catalogue preview ledger. Separate from the legacy copy-v1 store.
 * Not an API schema, account balance, entitlement, risk engine or order intent.
 */
import { catalogueSourceSha, findCatalogueStrategy, freezeCatalogueValue } from './client-catalogue'
import { catalogueCopySettings, type CatalogueCopySettings } from './client-catalogue-copy-setup'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import type { CatalogueMarketData } from './client-catalogue-market-data'
import { copyCalculationSourceSha, runSourceCatalogueCopy } from './client-catalogue-copy-source.mjs'

export type CatalogueCopyBinding = {
  sourceSha: string; strategyId: string; spotVersion: string; futuresVersion: string; start: string; asof: string
}
export type CatalogueCopyRecord = {
  model: 'catalogue-units-preview'; owner: string; id: string; binding: CatalogueCopyBinding
  startI: number; settings: CatalogueCopySettings; status: 'active' | 'closed'
  ledger: { at: number; i: number; type: 'add' | 'out'; amount: number }[]
  /** Recorded preview events. Never scheduled commands or automatic orders. */
  flats: number[]; stopI?: number; endI?: number
}
export type CatalogueCopyPoint = {
  units: number; cb: number; waiting: number; cbw: number; invested: number; value: number
  dep: number; wd: number; pnl: number; cost: number
}
export type CatalogueCopyCalculation = {
  inv: number; grossIn: number; pnlPct: number; myPct: number; total: number; realized: number; unreal: number
  share: number; net: number; est: number; avail: number; value: number; invested: number; waiting: number; units: number
  posOpen: boolean; closedN: number; immediate: boolean; entriesYear: number
  lots: { i: number; inv: number | null }[]; stopI: number | null; windEnd: number | null; endBar: number | null
}
export type CatalogueCopyProjection = {
  source: 'client-catalogue-copy-preview'; owner: string; copyId: string; binding: CatalogueCopyBinding
  settings: CatalogueCopySettings; calculation: CatalogueCopyCalculation
  observations: { i: number; value: CatalogueCopyPoint }[]
  limitations: ('SNAPSHOT_PREVIEW_ONLY' | 'SOURCE_NAV_UNIT_MODEL' | 'RISK_SETTINGS_NOT_ENFORCED' | 'FUTURES_WINDING_SPOT_PRICE_PROXY')[]
}
const fail = (): never => { throw Error('catalogue copy preview unavailable') }
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 320 && v.trim() === v && Array.from(v).every(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
const fields = (v: Record<string, unknown>, required: string[], optional: string[] = []) => required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k))
const bindingKeys = ['sourceSha', 'strategyId', 'spotVersion', 'futuresVersion', 'start', 'asof'] as const

/** Strictly reads this new preview model. No legacy adoption, migration or write. */
export function readCatalogueCopyRecord(input: unknown, owner: string): Readonly<CatalogueCopyRecord> {
  if (!object(input) || !text(owner) || input.owner !== owner || input.model !== 'catalogue-units-preview' || !text(input.id)
    || !fields(input, ['model', 'owner', 'id', 'binding', 'startI', 'settings', 'status', 'ledger', 'flats'], ['stopI', 'endI'])
    || !object(input.binding) || !fields(input.binding, [...bindingKeys]) || bindingKeys.some(k => !text(input.binding && (input.binding as Record<string, unknown>)[k]))) return fail()
  const binding = input.binding as CatalogueCopyBinding, strategy = findCatalogueStrategy(binding.strategyId)
  if (!strategy || strategy.id !== binding.strategyId || binding.sourceSha !== catalogueSourceSha || copyCalculationSourceSha !== catalogueSourceSha
    || !integer(input.startI) || !['active', 'closed'].includes(String(input.status)) || !object(input.settings)
    || !fields(input.settings, ['amount', 'loss', 'existing', 'cap'])) return fail()
  const settings = input.settings
  if (!finite(settings.amount) || !finite(settings.loss) || !integer(settings.cap) || typeof settings.existing !== 'string'
    || !catalogueCopySettings(strategy, Number.MAX_VALUE, String(settings.amount), settings.loss, settings.existing, String(settings.cap))) return fail()
  if (!Array.isArray(input.ledger) || !input.ledger.length || input.ledger.length > 1000 || !Array.isArray(input.flats) || input.flats.length > 1000) return fail()
  let lastIndex = input.startI, lastTime = 0
  for (const [offset, entry] of input.ledger.entries()) {
    if (!object(entry) || !fields(entry, ['at', 'i', 'type', 'amount']) || !integer(entry.at) || entry.at < lastTime
      || !integer(entry.i) || entry.i < lastIndex || !['add', 'out'].includes(String(entry.type)) || !finite(entry.amount) || entry.amount < 0
      || entry.amount === 0 && !(input.status === 'closed' && offset === input.ledger.length - 1 && offset > 0 && entry.type === 'out' && entry.i === input.endI)
      || offset === 0 && (entry.type !== 'add' || entry.i !== input.startI || entry.amount !== settings.amount)) return fail()
    lastIndex = entry.i; lastTime = entry.at
  }
  for (const [offset, i] of input.flats.entries()) if (!integer(i) || i < input.startI || offset > 0 && i <= input.flats[offset - 1]) return fail()
  for (const key of ['stopI', 'endI'] as const) if (Object.hasOwn(input, key) && (!integer(input[key]) || input[key] < input.startI)) return fail()
  if ((input.status === 'closed') !== Object.hasOwn(input, 'endI')) return fail()
  const endI = input.endI
  if (integer(endI) && (input.flats.some(i => i > endI) || input.ledger.some(e => e.i > endI && e.type === 'add')
    || integer(input.stopI) && input.stopI > endI)) return fail()
  return freezeCatalogueValue(structuredClone(input) as CatalogueCopyRecord)
}

export function catalogueCopyBinding(source: CataloguePreviewResult): CatalogueCopyBinding {
  return { sourceSha: source.sourceSha, strategyId: source.strategy.id, spotVersion: source.dataVersion.spot, futuresVersion: source.dataVersion.futures, ...source.calendar }
}
export function sameCatalogueCopyBinding(a: CatalogueCopyBinding, b: CatalogueCopyBinding) { return bindingKeys.every(key => a[key] === b[key]) }

/** Call in a bounded worker, against the exact full-run snapshot. The source
 * uses spot close prices for winding futures; retain and disclose, don't call
 * it an exchange liquidation or funding-aware position accounting model.
 */
export function projectCatalogueCopy(input: unknown, owner: string, source: CataloguePreviewResult, data: CatalogueMarketData, indices: readonly number[] = []): CatalogueCopyProjection {
  const copy = readCatalogueCopyRecord(input, owner)
  if (!source || source.source !== 'client-snapshot-preview' || source.period !== 'all' || source.calculation !== 'full-run' || source.contextPeriod !== 'selected'
    || !sameCatalogueCopyBinding(copy.binding, catalogueCopyBinding(source)) || source.calendar.start !== data.spot.start || source.calendar.asof !== data.spot.asof
    || source.dataVersion.spot !== data.spot.v || source.dataVersion.futures !== data.future.v) return fail()
  const result = source.result, eq = result.eq, start = result.params.startI, end = result.params.endI
  if (end !== data.length - 1 || result.state.asOf !== end || eq.length < 32 || eq[0].i !== start || eq.at(-1)?.i !== end
    || eq.some((p, offset) => p.i !== start + offset || !finite(p.v) || p.v < 0) || copy.startI < start || copy.startI > end
    || copy.ledger.some(e => e.i > end) || copy.flats.some(i => i > end) || copy.stopI !== undefined && copy.stopI > end || copy.endI !== undefined && copy.endI > end
    || !Array.isArray(indices) || indices.length > 32 || indices.some(i => !integer(i) || i < copy.startI || i > end)) return fail()
  // The preserved source replays once per realized exit and observation. Cap
  // its work estimate before entering synchronous code; never truncate history.
  const events = copy.ledger.length + copy.flats.length + 2
  if (events * (events + eq.length) * (result.trades.length + copy.flats.length + indices.length + 2) > 50_000_000) return fail()
  const raw = runSourceCatalogueCopy({ nick: copy.binding.strategyId, simStartI: copy.startI, status: copy.status, flats: copy.flats, stopI: copy.stopI, endI: copy.endI,
    adv: { existing: copy.settings.existing }, ledger: copy.ledger.map(e => ({ ...e, amt: e.amount })) }, { kind: source.strategy.kind, r: result }, asset => data.prices(asset), 0.1)
  const { at, ...calculation } = raw
  const observations = indices.map(i => ({ i, value: at(i) }))
  // NaN/Infinity are missing computations, never zero balances. The source's
  // short/no-data fallback is rejected above rather than rendered as cash.
  const validNumbers = (v: unknown): boolean => typeof v === 'number' ? Number.isFinite(v)
    : Array.isArray(v) ? v.every(validNumbers) : object(v) ? Object.values(v).every(validNumbers) : v === null || typeof v === 'boolean'
  if (!validNumbers(calculation) || !validNumbers(observations) || typeof calculation.posOpen !== 'boolean' || !Array.isArray(calculation.lots)) return fail()
  return freezeCatalogueValue({ source: 'client-catalogue-copy-preview', owner, copyId: copy.id, binding: { ...copy.binding }, settings: { ...copy.settings }, calculation, observations,
    limitations: ['SNAPSHOT_PREVIEW_ONLY', 'SOURCE_NAV_UNIT_MODEL', 'RISK_SETTINGS_NOT_ENFORCED', ...(source.strategy.fut && copy.stopI !== undefined ? ['FUTURES_WINDING_SPOT_PRICE_PROXY'] as const : [])] })
}
