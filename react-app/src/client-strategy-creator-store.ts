/** 501053b tfSS3Publish/ShareToggle/Unshare: owner-local PUBLIC PREVIEW only.
 * Stored publication != source registration, followers, payment or API authority.
 */
import { decodeSourceUserStrategyParameters, decodeSourceUserStrategyRecord, isSourceUserStrategyId, SOURCE_USER_STRATEGY_PASS_SCORE, type SourceUserStrategyRecord } from './client-user-strategy'
import { evaluateDelegation } from './client-delegation-engine'
import type { SourceTerminalParameters } from './client-terminal-source-fixture'

export type CreatorCandidate = { record: Readonly<SourceUserStrategyRecord>; eligible: boolean; reason?: string }
export type CreatorPublication = Readonly<{
  sourceId: string; name: string; asset: string | null; description: string; publishedAt: string
  parameters: SourceTerminalParameters | null; score: number; ret: number; mdd: number; n: number; winRate: number
}>
export type CreatorPublishRequest = { sourceId: string; description: string; expected: CreatorCandidate }
export type CreatorSnapshot = Readonly<{ publication: CreatorPublication | null; visible: boolean; storageError: boolean }>
/** Identifies our own local-preview failures without translating arbitrary
 * callback/provider messages that merely happen to contain similar words. */
export class CreatorStoreError extends Error {
  constructor(message: string) { super(message); this.name = 'CreatorStoreError' }
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
type Metrics = Pick<CreatorPublication, 'parameters' | 'score' | 'ret' | 'mdd' | 'n' | 'winRate'>
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const numberIn = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString() === `${value}T00:00:00.000Z`
export const clientStrategyCreatorKey = (owner: string) => `teth-client-strategy-creator:${encodeURIComponent(owner)}`

function validationReason(value: Metrics): string | undefined {
  if (!numberIn(value.score, SOURCE_USER_STRATEGY_PASS_SCORE, 100)) return 'TETH 80점 이상 전략만 공개할 수 있어요.'
  if (!numberIn(value.ret, -100, Number.MAX_VALUE) || !numberIn(value.mdd, -100, 0)
    || !Number.isSafeInteger(value.n) || value.n < 0 || !numberIn(value.winRate, 0, 100)) return '저장된 검증 수치를 다시 확인해주세요.'
  // Explicit legacy null is summary-only. Never substitute another session's p.
  if (value.parameters === null) return
  try {
    const { result, score } = evaluateDelegation(value.parameters, 1)
    if (score !== value.score || result.n !== value.n || (['ret', 'mdd', 'winRate'] as const).some(key => Math.abs(value[key] - result[key]) > 1e-6)) {
      return '저장된 검증 수치가 현재 계산 설정과 일치하지 않아요. 전략을 다시 검증해주세요.'
    }
  } catch { return '저장된 계산 설정을 확인할 수 없어요. 전략을 다시 검증해주세요.' }
}

export function getCreatorCandidate(record: Readonly<SourceUserStrategyRecord>): CreatorCandidate {
  const decoded = decodeSourceUserStrategyRecord(record)
  if (!decoded) return { record, eligible: false, reason: '저장된 전략 정보를 다시 확인해주세요.' }
  const reason = validationReason(decoded)
  return Object.freeze({ record: decoded, eligible: !reason, ...(reason ? { reason } : {}) })
}

function decodePublication(value: unknown): CreatorPublication | undefined {
  if (!object(value) || !isSourceUserStrategyId(value.sourceId) || !text(value.name)
    || value.asset !== null && !text(value.asset) || typeof value.description !== 'string' || value.description.length > 100
    || !validDate(value.publishedAt)) return
  const parameters = value.parameters === null ? null : decodeSourceUserStrategyParameters(value.parameters)
  if (value.parameters !== null && !parameters) return
  const publication = { sourceId: value.sourceId, name: value.name, asset: value.asset as string | null,
    description: value.description, publishedAt: value.publishedAt, parameters,
    score: value.score as number, ret: value.ret as number, mdd: value.mdd as number, n: value.n as number, winRate: value.winRate as number }
  if (validationReason(publication)) return
  return Object.freeze(publication)
}

/** Only publication-relevant fields plus source version form the confirmation
 * basis. Pausing a bot or changing its environment does not change that basis. */
function basis(record: SourceUserStrategyRecord): string {
  return JSON.stringify([record.id, record.name, record.asset ?? null, record.parameters,
    record.score, record.ret, record.mdd, record.n, record.winRate, record.version ?? null])
}

export function createClientStrategyCreatorStore(owner: string | null, getRecords: () => readonly SourceUserStrategyRecord[], storage?: StoragePort) {
  let snapshot: CreatorSnapshot = Object.freeze({ publication: null, visible: false, storageError: false })
  let loaded = false
  const listeners = new Set<() => void>(), port = () => storage ?? sessionStorage
  const validOwner = typeof owner === 'string' && owner.length > 0 && owner.length <= 320 && owner.trim() === owner
    && Array.from(owner).every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
  const emit = (next: CreatorSnapshot) => { snapshot = Object.freeze(next); listeners.forEach(listener => listener()) }
  const restore = (): boolean => {
    if (!validOwner) { loaded = true; return true }
    try {
      const raw = port().getItem(clientStrategyCreatorKey(owner!))
      if (raw === null) { loaded = true; emit({ publication: null, visible: false, storageError: false }); return true }
      const value: unknown = JSON.parse(raw)
      if (!object(value) || typeof value.visible !== 'boolean') throw new Error('Invalid creator state')
      const publication = value.publication === null ? null : decodePublication(value.publication)
      if (publication === undefined || value.visible && !publication) throw new Error('Invalid creator publication')
      loaded = true; emit({ publication, visible: value.visible, storageError: false }); return true
    } catch { loaded = false; emit({ ...snapshot, storageError: true }); return false }
  }
  const requireOwner = () => {
    if (!validOwner) throw new CreatorStoreError('로그인 후 다시 시도해주세요.')
    if (!loaded || snapshot.storageError) throw new CreatorStoreError('저장된 공개 설정을 불러오지 못했어요. 다시 불러온 뒤 시도해주세요.')
  }
  const commit = (publication: CreatorPublication, visible: boolean) => {
    // Storage failures do not publish a new snapshot or discard an old one.
    try { port().setItem(clientStrategyCreatorKey(owner!), JSON.stringify({ publication, visible })) }
    catch { throw new CreatorStoreError('공개 설정을 저장하지 못했어요. 입력한 내용을 확인하고 다시 시도해주세요.') }
    emit({ publication, visible, storageError: false })
  }
  restore()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    retryLoad: restore,
    publish: (request: CreatorPublishRequest, now: number): CreatorPublication => {
      requireOwner()
      if (!request || !isSourceUserStrategyId(request.sourceId) || typeof request.description !== 'string' || request.description.length > 100
        || !Number.isSafeInteger(now) || now < 0 || now > 253402300799999) throw new CreatorStoreError('공개할 전략과 소개를 다시 확인해주세요.')
      let records: readonly SourceUserStrategyRecord[]
      try { records = getRecords() } catch { throw new CreatorStoreError('공개할 전략을 다시 불러와주세요.') }
      if (!Array.isArray(records)) throw new CreatorStoreError('공개할 전략을 다시 불러와주세요.')
      const matches = records.filter(record => record?.id === request.sourceId)
      if (matches.length !== 1) throw new CreatorStoreError('공개할 전략이 없거나 식별 정보를 확인할 수 없어요.')
      const current = getCreatorCandidate(matches[0])
      if (!current.eligible) throw new CreatorStoreError(current.reason!)
      const expected = request.expected?.record && getCreatorCandidate(request.expected.record)
      if (request.expected?.eligible !== true || !expected?.eligible || basis(current.record) !== basis(expected.record)) {
        throw new CreatorStoreError('전략 조건이 바뀌었어요. 설정 창을 다시 열어 확인해주세요.')
      }
      const record = current.record
      const publication = decodePublication({ sourceId: record.id, name: record.name, asset: record.asset ?? null,
        description: request.description.trim(), publishedAt: new Date(now).toISOString().slice(0, 10), parameters: record.parameters,
        score: record.score, ret: record.ret, mdd: record.mdd, n: record.n, winRate: record.winRate })
      if (!publication) throw new CreatorStoreError('공개할 전략 정보를 다시 확인해주세요.')
      commit(publication, true)
      return publication
    },
    setVisible: (visible: boolean): true => {
      requireOwner()
      if (typeof visible !== 'boolean' || !snapshot.publication) throw new CreatorStoreError('공개할 전략 스냅샷이 없어요.')
      if (visible !== snapshot.visible) commit(snapshot.publication, visible)
      return true
    },
  }
}
