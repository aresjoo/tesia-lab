import {
  assertPaperSessionSnapshot,
  type PaperSessionAdapter,
  type PaperSessionRead,
  type PaperSessionSnapshot,
  type PaperStrategyBinding,
  RECORDED_PAPER_PROVENANCE,
  samePaperStrategyBinding,
} from './paper-session'

export const RECORDED_PAPER_UI_STORAGE_KEY = 'tesia-internal-poc-paper-ui-fallback-v1'

const RECORDED_STRATEGY: PaperStrategyBinding = {
  strategyVersionId: 'sv_fixture_00000001',
  semanticHash: '39cbfd0090218a159ae03ef11e9d686482a644772dab291b03b864658caf2e46',
}

const SESSION_ID = 'local-paper-compiler-rsi14-001'
const FIXTURE_ID = 'paper_fixture_compiler_rsi14_btcusdt_15m_01'

const BASE = {
  artifactVersion: 'paper-session-view/1',
  sessionId: SESSION_ID,
  viewSource: 'RECORDED_UI_FALLBACK',
  recordedStrategy: RECORDED_STRATEGY,
  fixtureId: FIXTURE_ID,
  provenance: RECORDED_PAPER_PROVENANCE,
} as const

type RecordedStage = 'CHECKPOINT_RECORDED' | 'RESTART_RESTORED'

type StoredCursor = Readonly<{
  version: 'paper-ui-cursor/1'
  requestedStrategy: PaperStrategyBinding
  stage: RecordedStage
}>

const isStoredCursor = (value: unknown): value is StoredCursor => {
  if (typeof value !== 'object' || value === null) return false
  const cursor = value as Record<string, unknown>
  const binding = cursor.requestedStrategy as Record<string, unknown> | undefined
  return Object.keys(cursor).length === 3
    && cursor.version === 'paper-ui-cursor/1'
    && ['CHECKPOINT_RECORDED', 'RESTART_RESTORED'].includes(String(cursor.stage))
    && typeof binding === 'object'
    && binding !== null
    && Object.keys(binding).length === 2
    && typeof binding.strategyVersionId === 'string'
    && typeof binding.semanticHash === 'string'
    && /^[0-9a-f]{64}$/.test(binding.semanticHash)
}

const readCursor = (): StoredCursor | null => {
  const raw = sessionStorage.getItem(RECORDED_PAPER_UI_STORAGE_KEY)
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredCursor(parsed)) throw new Error('PAPER_UI_CURSOR_INVALID')
    return parsed
  } catch (error) {
    if (error instanceof Error && error.message === 'PAPER_UI_CURSOR_INVALID') throw error
    throw new Error('PAPER_UI_CURSOR_INVALID', { cause: error })
  }
}

const writeCursor = (cursor: StoredCursor): void => {
  sessionStorage.setItem(RECORDED_PAPER_UI_STORAGE_KEY, JSON.stringify(cursor))
}

const requireRecordedStrategy = (requestedStrategy: PaperStrategyBinding): void => {
  if (!samePaperStrategyBinding(requestedStrategy, RECORDED_STRATEGY)) {
    throw new Error('PAPER_RECORDED_FIXTURE_STRATEGY_MISMATCH')
  }
}

const snapshotFor = (stage: RecordedStage, requestedStrategy: PaperStrategyBinding): PaperSessionSnapshot => {
  const snapshot = {
    ...BASE,
    stage,
    requestedStrategy,
  }
  return assertPaperSessionSnapshot(snapshot)
}

const nextStage = (stage: RecordedStage): RecordedStage => {
  if (stage === 'CHECKPOINT_RECORDED') return 'RESTART_RESTORED'
  throw new Error('PAPER_RECORDED_ARTIFACT_AUTHORITY_MISSING')
}

export const resetRecordedPaperSessionState = (): void => {
  sessionStorage.removeItem(RECORDED_PAPER_UI_STORAGE_KEY)
}

export const createRecordedPaperSessionAdapter = async (): Promise<PaperSessionAdapter> => ({
  kind: 'recorded-ui-fallback',
  label: 'UI_STATE_FALLBACK_ONLY',
  async readActive(requestedStrategy): Promise<PaperSessionRead> {
    const cursor = readCursor()
    if (cursor === null) return { snapshot: null, recoverySource: 'NONE' }
    requireRecordedStrategy(requestedStrategy)
    if (!samePaperStrategyBinding(cursor.requestedStrategy, requestedStrategy)) {
      throw new Error('PAPER_UI_REQUESTED_STRATEGY_BINDING_MISMATCH')
    }
    return { snapshot: snapshotFor(cursor.stage, requestedStrategy), recoverySource: 'UI_FALLBACK' }
  },
  async startSession(requestedStrategy): Promise<PaperSessionRead> {
    requireRecordedStrategy(requestedStrategy)
    const cursor: StoredCursor = {
      version: 'paper-ui-cursor/1',
      requestedStrategy,
      stage: 'CHECKPOINT_RECORDED',
    }
    writeCursor(cursor)
    return { snapshot: snapshotFor(cursor.stage, requestedStrategy), recoverySource: 'NONE' }
  },
  async refreshSession(sessionId, requestedStrategy): Promise<PaperSessionRead> {
    requireRecordedStrategy(requestedStrategy)
    if (sessionId !== SESSION_ID) throw new Error('PAPER_UI_SESSION_ID_MISMATCH')
    const cursor = readCursor()
    if (cursor === null) throw new Error('PAPER_UI_CURSOR_MISSING')
    if (!samePaperStrategyBinding(cursor.requestedStrategy, requestedStrategy)) {
      throw new Error('PAPER_UI_REQUESTED_STRATEGY_BINDING_MISMATCH')
    }
    const advanced = { ...cursor, stage: nextStage(cursor.stage) }
    writeCursor(advanced)
    return { snapshot: snapshotFor(advanced.stage, requestedStrategy), recoverySource: 'NONE' }
  },
  resetLocalView: resetRecordedPaperSessionState,
})
