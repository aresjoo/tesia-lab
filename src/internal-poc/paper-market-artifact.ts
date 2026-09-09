export const LOCAL_MARKET_ARTIFACT_CATALOG_MARKER = 'LOCAL_MARKET_ARTIFACT_CATALOG'

export type PaperMarketArtifactSource = 'PACKAGED_SYNTHETIC' | 'OWNER_RECORDED_LOCAL_ARTIFACT'

export type PaperMarketArtifact = Readonly<{
  artifactId: string
  displayName: string
  source: PaperMarketArtifactSource
  symbol: string
  sourceInterval: string
  interval: string
  eventCount: number
  firstEventTime: string
  lastEventTime: string
  fileSha256: string
  contentHash: string
  provenanceHash: string
  policyHash: string
  manifestSha256: string | null
  provenance: Readonly<{
    dataClass: 'SYNTHETIC_RECORDED_MARKET_FIXTURE' | 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT'
    verification: 'UNVERIFIED'
    verificationStatus: 'SYNTHETIC_ONLY' | 'UNVERIFIED_FOR_TRADING'
    rights: 'PRIVATE_ONLY'
    label: string
  }>
}>

export type PaperMarketArtifactCatalog = Readonly<{
  artifactVersion: 'paper-market-artifact-catalog-view/1'
  items: readonly PaperMarketArtifact[]
}>

/**
 * Internal UI projection port. It is not a backend endpoint or shared schema.
 * The owner-local API adapter must validate and map an independently approved
 * server response before returning this view.
 */
export interface PaperMarketArtifactCatalogAdapter {
  readonly kind: 'owner-local-api' | 'recorded-ui-fixture'
  readCatalog(): Promise<PaperMarketArtifactCatalog>
}

const HASH = /^[0-9a-f]{64}$/
const RESOURCE_ID = /^paper_fixture_[a-z0-9_]{8,80}$/
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index])
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const isArtifact = (value: unknown): value is PaperMarketArtifact => {
  if (!isRecord(value) || !hasExactKeys(value, [
    'artifactId', 'displayName', 'source', 'symbol', 'sourceInterval', 'interval', 'eventCount',
    'firstEventTime', 'lastEventTime', 'fileSha256', 'contentHash', 'provenanceHash',
    'policyHash', 'manifestSha256', 'provenance',
  ])) return false
  if (!isRecord(value.provenance) || !hasExactKeys(value.provenance, [
    'dataClass', 'verification', 'verificationStatus', 'rights', 'label',
  ])) return false
  const sourceBinding = value.source === 'PACKAGED_SYNTHETIC'
    ? value.provenance.dataClass === 'SYNTHETIC_RECORDED_MARKET_FIXTURE'
      && value.provenance.verificationStatus === 'SYNTHETIC_ONLY'
      && value.manifestSha256 === null
    : value.source === 'OWNER_RECORDED_LOCAL_ARTIFACT'
      && value.provenance.dataClass === 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT'
      && value.provenance.verificationStatus === 'UNVERIFIED_FOR_TRADING'
      && typeof value.manifestSha256 === 'string'
      && HASH.test(value.manifestSha256)
  return typeof value.artifactId === 'string'
    && RESOURCE_ID.test(value.artifactId)
    && typeof value.displayName === 'string'
    && value.displayName.length > 0
    && typeof value.symbol === 'string'
    && value.symbol.length > 0
    && typeof value.sourceInterval === 'string'
    && value.sourceInterval.length > 0
    && typeof value.interval === 'string'
    && value.interval.length > 0
    && Number.isSafeInteger(value.eventCount)
    && Number(value.eventCount) > 0
    && typeof value.firstEventTime === 'string'
    && UTC_TIMESTAMP.test(value.firstEventTime)
    && typeof value.lastEventTime === 'string'
    && UTC_TIMESTAMP.test(value.lastEventTime)
    && Date.parse(value.firstEventTime) <= Date.parse(value.lastEventTime)
    && typeof value.fileSha256 === 'string'
    && HASH.test(value.fileSha256)
    && typeof value.contentHash === 'string'
    && HASH.test(value.contentHash)
    && typeof value.provenanceHash === 'string'
    && HASH.test(value.provenanceHash)
    && typeof value.policyHash === 'string'
    && HASH.test(value.policyHash)
    && sourceBinding
    && value.provenance.verification === 'UNVERIFIED'
    && value.provenance.rights === 'PRIVATE_ONLY'
    && typeof value.provenance.label === 'string'
    && value.provenance.label.length > 0
}

export const assertPaperMarketArtifactCatalog = (value: unknown): PaperMarketArtifactCatalog => {
  if (!isRecord(value) || !hasExactKeys(value, ['artifactVersion', 'items'])) {
    throw new Error('PAPER_MARKET_ARTIFACT_CATALOG_INVALID')
  }
  if (
    value.artifactVersion !== 'paper-market-artifact-catalog-view/1'
    || !Array.isArray(value.items)
    || !value.items.every(isArtifact)
  ) throw new Error('PAPER_MARKET_ARTIFACT_CATALOG_INVALID')
  const ids = value.items.map((item) => item.artifactId)
  if (new Set(ids).size !== ids.length) throw new Error('PAPER_MARKET_ARTIFACT_CATALOG_INVALID')
  return value as PaperMarketArtifactCatalog
}
