/** aresjoo/tesia-lab 412fd60, MK_CAT/MK_UNI + final skSym.
 * Source preview definitions, NOT Strategy Version/SDK/order instructions.
 * No score filter, invented RSI parameters, exchange rotation or duplicate rows.
 */
import source from './client-catalogue-source.json' with { type: 'json' }
import type { StrategyMarket } from './client-strategy-classification'

export type CatalogueUniverse = 'coin8' | 'tech8' | 'macro6' | 'big3' | 'idx3'
type Base = {
  id: string; kind: 'rule' | 'agent' | 'mix'; mkt: StrategyMarket
  name: string; one: string; ex: 'binance' | 'okx' | 'bitget'; fw: number; by: string; startI: number
}
type Spot = { fut?: never; inst?: never }
export type CatalogueSpotRule = Base & Spot & { kind: 'rule'; asset: string; rsiTh: number; tp: number | null; sl: number; tf: 0 | 1; fng?: number }
export type CatalogueSpotAgent = Base & Spot & { kind: 'agent'; uni: CatalogueUniverse; look: number; top: number; gate: number; every: number; trail: number; volT: number; minS: number }
export type CatalogueSpotMix = Base & Spot & { kind: 'mix'; uni: CatalogueUniverse; every: number; look: number; rsiTh: number; tp: number | null; sl: number; gate: number }
export type CatalogueSpotStrategy = CatalogueSpotRule | CatalogueSpotAgent | CatalogueSpotMix
type Future = { fut: 1; inst: 'futures'; lev: number; sl?: number; trail?: number; tp?: number; hold?: number; ph?: number; dir?: 'long' | 'short' }
type FutureSignal = { exitN?: number; reg?: number } & (
  | { mode: 'ma'; fast: number; slow: number }
  | { mode: 'brk'; n: number }
  | { mode: 'fg'; lo: number; hi: number }
  | { mode: 'dip'; n: number; dip: number }
)
export type CatalogueFutureRule = Base & Future & FutureSignal & { kind: 'rule'; asset: string }
export type CatalogueFutureAgent = Base & Future & { kind: 'agent'; uni: CatalogueUniverse; every: number; look: number; top: number; gate: number; neutral?: boolean }
export type CatalogueFutureMix = Base & Future & FutureSignal & { kind: 'mix'; uni: CatalogueUniverse; every: number; look: number; gate: number }
export type CatalogueStrategy = CatalogueSpotStrategy | CatalogueFutureRule | CatalogueFutureAgent | CatalogueFutureMix

export function freezeCatalogueValue<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeCatalogueValue(child)
    Object.freeze(value)
  }
  return value
}
export const catalogueSourceSha = source.sha
export const catalogueUniverses = freezeCatalogueValue(source.universes)
const supportedAssets = new Set(Object.values(catalogueUniverses).flatMap(u => u.list))

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const own = (value: object, key: string) => Object.hasOwn(value, key)
const integer = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max
const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

/** Validate the bundled source definition, not an API response. Fail closed. */
export function readCatalogueStrategy(value: unknown): Readonly<CatalogueStrategy> {
  if (!isRecord(value)) throw Error('catalogue: invalid definition')
  const c = value
  let valid = ['rule', 'agent', 'mix'].includes(String(c.kind)) && ['crypto', 'stock', 'index', 'multi'].includes(String(c.mkt))
    && ['binance', 'okx', 'bitget'].includes(String(c.ex)) && integer(c.fw, 0) && integer(c.startI, 61)
    && ['id', 'name', 'one', 'by'].every(k => typeof c[k] === 'string' && (c[k] as string).trim().length > 0)
  if (c.kind === 'rule') valid &&= typeof c.asset === 'string' && supportedAssets.has(c.asset) && !own(c, 'uni')
  else valid &&= typeof c.uni === 'string' && own(catalogueUniverses, c.uni) && !own(c, 'asset')
  if (c.kind !== 'rule') valid &&= integer(c.every, 1) && integer(c.look, 2) && finite(c.gate, 0, 1)
  if (c.kind === 'agent') valid &&= integer(c.top, 1, 4)
  if (c.fut === 1) {
    valid &&= c.inst === 'futures' && finite(c.lev, 1, 10)
    for (const k of ['sl', 'trail', 'tp']) if (own(c, k)) valid &&= finite(c[k], Number.MIN_VALUE, 100)
    for (const k of ['hold', 'ph']) if (own(c, k)) valid &&= integer(c[k], k === 'ph' ? 0 : 1)
    if (own(c, 'dir')) valid &&= c.dir === 'long' || c.dir === 'short'
    if (own(c, 'neutral')) valid &&= c.kind === 'agent' && typeof c.neutral === 'boolean'
    if (c.kind !== 'agent') {
      if (c.mode === 'ma') valid &&= integer(c.fast, 1) && integer(c.slow, 2) && Number(c.fast) < Number(c.slow)
      else if (c.mode === 'brk') valid &&= integer(c.n, 1)
      else if (c.mode === 'fg') valid &&= finite(c.lo, 0, 100) && finite(c.hi, 0, 100) && Number(c.lo) < Number(c.hi)
      else if (c.mode === 'dip') valid &&= integer(c.n, 1) && finite(c.dip, Number.MIN_VALUE, 100)
      else valid = false
      for (const k of ['reg', 'exitN']) if (own(c, k)) valid &&= integer(c[k], 1)
    }
  } else {
    valid &&= !own(c, 'fut') && !own(c, 'inst')
    if (c.kind === 'agent') valid &&= finite(c.trail, Number.MIN_VALUE, 100) && finite(c.volT, Number.MIN_VALUE, 1) && finite(c.minS, 0, 100)
    else {
      valid &&= finite(c.rsiTh, 0, 100) && (c.tp === null || finite(c.tp, 0, 1e6)) && finite(c.sl, -100, 0)
      if (c.kind === 'rule') valid &&= c.tf === 0 || c.tf === 1
      if (own(c, 'fng')) valid &&= finite(c.fng, 0, 100)
    }
  }
  if (!valid) throw Error('catalogue: invalid definition')
  return freezeCatalogueValue({ ...c } as CatalogueStrategy)
}

const symbols: Readonly<Record<string, string>> = source.symbols
export const catalogueTitle = (title: string) => title.replace(/비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/g, k => symbols[k])
export const catalogueStrategies = Object.freeze(source.catalogue.map(c => readCatalogueStrategy({ ...c, name: catalogueTitle(c.name) })))
if (new Set(catalogueStrategies.map(c => c.id)).size !== catalogueStrategies.length) throw Error('catalogue: duplicate ID')
export function catalogueAssets(c: Readonly<CatalogueStrategy>): readonly string[] {
  return c.kind === 'rule' ? [c.asset] : catalogueUniverses[c.uni].list
}
/** Only explicitly recorded old names resolve; never infer a replacement from position/score. */
export function findCatalogueStrategy(key: string): Readonly<CatalogueStrategy> | undefined {
  const alias = own(source.aliases, key) ? (source.aliases as Record<string, string>)[key] : undefined
  return catalogueStrategies.find(c => c.id === key || c.name === key || c.id === alias)
    ?? catalogueStrategies.find(c => c.name === catalogueTitle(key))
}
