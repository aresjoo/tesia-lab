/** Internal source-snapshot display data, never a service/result authority contract.
 * Original 9fbff821: btCompute/D, btPlain, EV; btMini reads mkPx (spot close),
 * including fuTradeMini. Event references are indices into observation.result.events.
 */
export type CatalogueEvidenceKind = 'buy' | 'sell' | 'skip' | 'hold' | 'pick'
export type CatalogueEvidencePair = readonly [string, string]
export type CatalogueEvidenceDecision = Readonly<{
  runId: string; eventIndex: number; ix: number; i: number; j: number
  k: CatalogueEvidenceKind; tag: string; title: string; cmp: string; why: string
  tk: string; a?: string; tid?: number; side?: number; pnl?: number; chain?: number
  facts: readonly CatalogueEvidencePair[]
  p0?: CatalogueEvidencePair | null; p1?: CatalogueEvidencePair | null; p2?: CatalogueEvidencePair | null
  ups?: readonly string[] | null
  act: string; say: string; out: Readonly<{ t: string; v: number; mute?: number }> | null
}>
export type CatalogueEvidenceDailyGroup = Readonly<{
  runId: string; ix: number; i: number; j: number; decisionIndices: readonly number[]
  k: CatalogueEvidenceKind; out: CatalogueEvidenceKind
  tag: string; title: string; cmp: string; why: string; ups?: readonly string[] | null
}>
export type CatalogueBacktestEvidence = Readonly<{
  source: 'client-snapshot-preview'; sourceSha: string; runId: string
  decisions: readonly CatalogueEvidenceDecision[]
  dailyGroups: readonly CatalogueEvidenceDailyGroup[]
  prices: Readonly<{
    source: 'client-snapshot-close'; calendarStartIndex: 0
    series: readonly Readonly<{ asset: string; values: readonly number[] }>[]
  }>
}>
