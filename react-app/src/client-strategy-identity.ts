import type { StrategyKind } from './client-strategy-classification'

/** Presentation only, never an API schema or source of strategy parameters. */
export type StrategyMarkerShape = 'circle' | 'square' | 'diamond'
type Curve = { rsiThreshold: number; targetPercent: number | null; trendFilter: boolean }
export type StrategyGlyphEvidence = { shape: StrategyMarkerShape } & (
  | ({ kind: 'rule' } & Curve)
  | { kind: 'agent'; universeSize: number; selectedCount: number }
  | ({ kind: 'mix'; universeSize: number } & Curve)
)
export type StrategyVenue = { name: string; logo?: 'binance' | 'bitget' | 'okx' }
export type StrategyIdentity = { glyph?: StrategyGlyphEvidence; venue?: StrategyVenue }
const venueLogos = {
  binance: '/client-broker-assets/app-binance.png', bitget: '/client-broker-assets/app-bitget.png', okx: '/client-broker-assets/app-okx.png',
} as const

export function strategyVenue(venue: StrategyVenue | undefined) {
  if (!venue || typeof venue.name !== 'string' || !venue.name.trim()) return null
  return { name: venue.name, logo: venue.logo && Object.hasOwn(venueLogos, venue.logo) ? venueLogos[venue.logo] : undefined }
}

/** Bound SVG work to the current source's supported 1..8 asset diagrams.
 * Missing, inconsistent or malformed evidence uses the source neutral glyph. */
export function validStrategyGlyph(kind: StrategyKind | undefined, evidence: StrategyGlyphEvidence | undefined): evidence is StrategyGlyphEvidence {
  if (!evidence || evidence.kind !== kind || !['rule', 'agent', 'mix'].includes(evidence.kind)
    || !['circle', 'square', 'diamond'].includes(evidence.shape)) return false
  if (evidence.kind !== 'rule' && (!Number.isInteger(evidence.universeSize) || evidence.universeSize < 1 || evidence.universeSize > 8)) return false
  if (evidence.kind === 'agent') return Number.isInteger(evidence.selectedCount) && evidence.selectedCount >= 1 && evidence.selectedCount <= evidence.universeSize
  return Number.isFinite(evidence.rsiThreshold) && evidence.rsiThreshold >= 0 && evidence.rsiThreshold <= 100
    && (evidence.targetPercent === null || Number.isFinite(evidence.targetPercent) && evidence.targetPercent >= 0)
    && typeof evidence.trendFilter === 'boolean'
}
