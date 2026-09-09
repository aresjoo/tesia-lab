import type {
  PaperMarketArtifact,
  PaperMarketArtifactCatalogAdapter,
  PaperMarketArtifactSource,
} from './paper-market-artifact'
import { assertPaperMarketArtifactCatalog } from './paper-market-artifact'

const INTERNAL_CONTRACT_VERSION = 'owner-local-paper-api/0.1'
const ENDPOINT = '/internal/poc/market-artifacts'
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const HASH = /^[0-9a-f]{64}$/
const RESOURCE_ID = /^paper_fixture_[a-z0-9_]{8,80}$/
const SYMBOL = /^[A-Z0-9]{2,24}$/
const TIMEFRAME = /^[A-Za-z0-9]{1,16}$/
const UNSIGNED_INTEGER = /^(?:0|[1-9][0-9]*)$/
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

type JsonRecord = Record<string, unknown>

const asRecord = (value: unknown, code: string): JsonRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(code)
  return value as JsonRecord
}

const exactKeys = (value: JsonRecord, expected: readonly string[], code: string): void => {
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(code)
  }
}

const nfcText = (value: unknown, code: string): string => {
  if (typeof value !== 'string' || value.length === 0 || value.normalize('NFC') !== value) throw new Error(code)
  return value
}

const readJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') throw new Error('PAPER_MARKET_ARTIFACT_JSON_REQUIRED')
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && Number(declaredLength) > MAX_RESPONSE_BYTES) {
    throw new Error('PAPER_MARKET_ARTIFACT_RESPONSE_TOO_LARGE')
  }
  const raw = await response.text()
  if (new TextEncoder().encode(raw).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('PAPER_MARKET_ARTIFACT_RESPONSE_TOO_LARGE')
  }
  try {
    return JSON.parse(raw) as unknown
  } catch (error) {
    throw new Error('PAPER_MARKET_ARTIFACT_JSON_INVALID', { cause: error })
  }
}

const parseMeta = (value: unknown): void => {
  const meta = asRecord(value, 'PAPER_MARKET_ARTIFACT_META_INVALID')
  exactKeys(meta, ['internalContractVersion', 'requestId', 'traceId', 'resourceRevision'], 'PAPER_MARKET_ARTIFACT_META_INVALID')
  if (
    meta.internalContractVersion !== INTERNAL_CONTRACT_VERSION
    || typeof meta.requestId !== 'string'
    || meta.requestId.length === 0
    || typeof meta.traceId !== 'string'
    || meta.traceId.length === 0
    || (meta.resourceRevision !== null
      && (typeof meta.resourceRevision !== 'string' || !UNSIGNED_INTEGER.test(meta.resourceRevision)))
  ) throw new Error('PAPER_MARKET_ARTIFACT_META_INVALID')
}

const parseServerArtifact = (value: unknown): PaperMarketArtifact => {
  const artifact = asRecord(value, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  exactKeys(artifact, [
    'fixtureId', 'dataClass', 'symbol', 'sourceTimeframe', 'evaluationTimeframe', 'eventCount',
    'firstOpenTime', 'lastCloseTime', 'fileSha256', 'contentHash', 'provenanceHash',
    'policyHash', 'manifestSha256', 'privateOnly', 'verified', 'verificationStatus',
  ], 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const fixtureId = nfcText(artifact.fixtureId, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const dataClass = nfcText(artifact.dataClass, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const symbol = nfcText(artifact.symbol, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const sourceTimeframe = nfcText(artifact.sourceTimeframe, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const evaluationTimeframe = nfcText(artifact.evaluationTimeframe, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const firstOpenTime = nfcText(artifact.firstOpenTime, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const lastCloseTime = nfcText(artifact.lastCloseTime, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const fileSha256 = nfcText(artifact.fileSha256, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const contentHash = nfcText(artifact.contentHash, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const provenanceHash = nfcText(artifact.provenanceHash, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const policyHash = nfcText(artifact.policyHash, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const verificationStatus = nfcText(artifact.verificationStatus, 'PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const source: PaperMarketArtifactSource = dataClass === 'SYNTHETIC_RECORDED_MARKET_FIXTURE'
    ? 'PACKAGED_SYNTHETIC'
    : dataClass === 'OWNER_LOCAL_RECORDED_MARKET_ARTIFACT'
      ? 'OWNER_RECORDED_LOCAL_ARTIFACT'
      : (() => { throw new Error('PAPER_MARKET_ARTIFACT_DATA_CLASS_INVALID') })()
  if (
    !RESOURCE_ID.test(fixtureId)
    || !SYMBOL.test(symbol)
    || !TIMEFRAME.test(sourceTimeframe)
    || !TIMEFRAME.test(evaluationTimeframe)
    || !Number.isSafeInteger(artifact.eventCount)
    || Number(artifact.eventCount) <= 0
    || !UTC_TIMESTAMP.test(firstOpenTime)
    || !UTC_TIMESTAMP.test(lastCloseTime)
    || Date.parse(firstOpenTime) > Date.parse(lastCloseTime)
    || !HASH.test(fileSha256)
    || !HASH.test(contentHash)
    || !HASH.test(provenanceHash)
    || !HASH.test(policyHash)
    || artifact.privateOnly !== true
    || artifact.verified !== false
  ) throw new Error('PAPER_MARKET_ARTIFACT_ITEM_INVALID')
  const ownerRecorded = source === 'OWNER_RECORDED_LOCAL_ARTIFACT'
  if (
    (ownerRecorded && (verificationStatus !== 'UNVERIFIED_FOR_TRADING'
      || typeof artifact.manifestSha256 !== 'string' || !HASH.test(artifact.manifestSha256)))
    || (!ownerRecorded && (verificationStatus !== 'SYNTHETIC_ONLY' || artifact.manifestSha256 !== null))
  ) throw new Error('PAPER_MARKET_ARTIFACT_AUTHORITY_INVALID')
  return {
    artifactId: fixtureId,
    displayName: ownerRecorded
      ? `${symbol} ${evaluationTimeframe} 소유자 로컬 기록`
      : `${symbol} ${evaluationTimeframe} 패키지 합성 기록`,
    source,
    symbol,
    sourceInterval: sourceTimeframe,
    interval: evaluationTimeframe,
    eventCount: Number(artifact.eventCount),
    firstEventTime: firstOpenTime,
    lastEventTime: lastCloseTime,
    fileSha256,
    contentHash,
    provenanceHash,
    policyHash,
    manifestSha256: artifact.manifestSha256 as string | null,
    provenance: {
      dataClass,
      verification: 'UNVERIFIED',
      verificationStatus: verificationStatus as 'SYNTHETIC_ONLY' | 'UNVERIFIED_FOR_TRADING',
      rights: 'PRIVATE_ONLY',
      label: ownerRecorded
        ? '사용자 소유 로컬 기록 · 출처/실시간/성과/거래 검증 전'
        : '서버 패키지 합성 기록 시장 fixture · 성과/실거래 검증 전',
    },
  }
}

const readCatalog = async () => {
  const response = await fetch(ENDPOINT, {
    method: 'GET',
    credentials: 'same-origin',
    redirect: 'manual',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  const envelope = asRecord(await readJson(response), 'PAPER_MARKET_ARTIFACT_ENVELOPE_INVALID')
  parseMeta(envelope.meta)
  if (!response.ok) {
    exactKeys(envelope, ['meta', 'error'], 'PAPER_MARKET_ARTIFACT_ERROR_ENVELOPE_INVALID')
    const error = asRecord(envelope.error, 'PAPER_MARKET_ARTIFACT_ERROR_ENVELOPE_INVALID')
    exactKeys(error, ['code', 'message'], 'PAPER_MARKET_ARTIFACT_ERROR_ENVELOPE_INVALID')
    throw new Error(nfcText(error.code, 'PAPER_MARKET_ARTIFACT_ERROR_ENVELOPE_INVALID'))
  }
  if (response.status !== 200) throw new Error('PAPER_MARKET_ARTIFACT_HTTP_STATUS_INVALID')
  exactKeys(envelope, ['meta', 'data'], 'PAPER_MARKET_ARTIFACT_ENVELOPE_INVALID')
  const data = asRecord(envelope.data, 'PAPER_MARKET_ARTIFACT_DATA_INVALID')
  exactKeys(data, ['artifacts'], 'PAPER_MARKET_ARTIFACT_DATA_INVALID')
  if (!Array.isArray(data.artifacts)) throw new Error('PAPER_MARKET_ARTIFACT_DATA_INVALID')
  return assertPaperMarketArtifactCatalog({
    artifactVersion: 'paper-market-artifact-catalog-view/1',
    items: data.artifacts.map(parseServerArtifact),
  })
}

export const createLocalMarketArtifactApiAdapter = (): PaperMarketArtifactCatalogAdapter => ({
  kind: 'owner-local-api',
  readCatalog,
})
