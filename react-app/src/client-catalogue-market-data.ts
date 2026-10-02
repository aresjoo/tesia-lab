/** Client source snapshot only. Does not fetch live prices or authorize trading.
 * Missing/misaligned prices must not fall back to BTC or synthetic data.
 */
import { catalogueAssets, catalogueStrategies, freezeCatalogueValue } from './client-catalogue'

export type CatalogueSpotData = {
  v: string; start: string; asof: string; made: string; src: { px: string; fng: string }
  meta: Record<string, { sym: string; real: number; filled: number }>
  open: Record<string, string>; px: Record<string, readonly number[]>; fng: readonly (number | null)[]
}
export type CatalogueFutureSeries = { o: readonly number[]; h: readonly number[]; l: readonly number[]; c: readonly number[]; f: readonly number[] }
export type CatalogueFuturesData = { v: string; start: string; asof: string; made: string; src: string; sym: Record<string, CatalogueFutureSeries> }
const dayMs = 86400000
function day(s: string) {
  const v = Date.parse(`${s}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(v) || new Date(v).toISOString().slice(0, 10) !== s) throw Error('catalogue data: invalid date')
  return v
}
function prices(values: readonly number[] | undefined, n: number, signed = false) {
  if (!Array.isArray(values) || values.length !== n || values.some(v => typeof v !== 'number' || !Number.isFinite(v) || (!signed && v <= 0))) throw Error('catalogue data: invalid series')
}

export class CatalogueMarketData {
  readonly length: number
  readonly startMs: number
  readonly spot: CatalogueSpotData
  readonly future: CatalogueFuturesData
  constructor(spot: CatalogueSpotData, future: CatalogueFuturesData) {
    // A snapshot copy prevents concurrent callers mutating the data during a run.
    this.spot = freezeCatalogueValue(structuredClone(spot))
    this.future = freezeCatalogueValue(structuredClone(future))
    this.startMs = day(spot.start)
    this.length = (day(spot.asof) - this.startMs) / dayMs + 1
    if (this.length < 63 || this.length > 10000 || future.start !== spot.start || future.asof !== spot.asof || !spot.v || !future.v) throw Error('catalogue data: mismatched range')
    const assets = new Set(catalogueStrategies.filter(c => !c.fut).flatMap(c => [...catalogueAssets(c)]))
    for (const asset of assets) {
      if (!Object.hasOwn(spot.px, asset) || !Object.hasOwn(spot.meta, asset)) throw Error('catalogue data: missing asset')
      prices(spot.px[asset], this.length)
      const meta = spot.meta[asset], mask = spot.open[asset]
      if (!meta || !meta.sym || !Number.isSafeInteger(meta.real) || !Number.isSafeInteger(meta.filled) || meta.real < 0 || meta.filled < 0 || meta.real + meta.filled !== this.length) throw Error('catalogue data: invalid provenance')
      if ((meta.filled > 0 && !mask) || (mask !== undefined && (mask.length !== this.length || /[^01]/.test(mask) || [...mask].filter(v => v === '1').length !== meta.real))) throw Error('catalogue data: invalid calendar')
    }
    if (!Array.isArray(spot.fng) || spot.fng.length !== this.length || spot.fng.some(v => v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100))) throw Error('catalogue data: invalid sentiment')
    for (const asset of new Set(catalogueStrategies.filter(c => c.fut).flatMap(c => [...catalogueAssets(c)]))) {
      if (!Object.hasOwn(future.sym, asset)) throw Error('catalogue data: missing future')
      const s = future.sym[asset]
      for (const key of ['o', 'h', 'l', 'c', 'f'] as const) prices(s[key], this.length, key === 'f')
      for (let i = 0; i < this.length; i++) if (s.l[i] > Math.min(s.o[i], s.c[i]) || s.h[i] < Math.max(s.o[i], s.c[i]) || s.h[i] < s.l[i]) throw Error('catalogue data: invalid OHLC')
    }
    Object.freeze(this)
  }
  date(index: number): Date {
    if (!Number.isSafeInteger(index)) throw Error('catalogue data: invalid day index')
    return new Date(this.startMs + index * dayMs)
  }
  prices(asset: string): readonly number[] {
    if (!Object.hasOwn(this.spot.px, asset)) throw Error('catalogue data: missing asset')
    return this.spot.px[asset]
  }
  isOpen(asset: string, index: number): boolean {
    this.prices(asset)
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.length) throw Error('catalogue data: invalid day index')
    const mask = this.spot.open[asset]
    return mask === undefined || mask[index] === '1'
  }
  fear(index: number): number | null { return this.spot.fng[index] ?? null }
}

let pending: Promise<CatalogueMarketData> | undefined
/** Lazy/coalesced: no data parse or engine run during unrelated chat renders. */
export function loadCatalogueMarketData(): Promise<CatalogueMarketData> {
  pending ??= import('./client-catalogue-snapshot')
    .then(({ spot, futures }) => new CatalogueMarketData(spot, futures))
    .catch(error => { pending = undefined; throw error })
  return pending
}
