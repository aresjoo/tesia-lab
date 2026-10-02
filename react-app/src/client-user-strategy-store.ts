/** Account-bound client preview registrations. Never service approval or credentials. */
import { decodeSourceUserStrategyParameters, decodeSourceUserStrategyRecord, SOURCE_USER_STRATEGY_PASS_SCORE, type SourceUserStrategyRecord } from './client-user-strategy'
import { evaluateSourceTerminal, type SourceTerminalParameters } from './client-terminal-source-fixture'
import { scoreSourceTerminal } from './client-terminal-source-proposal'

export type ClientStrategyRegistration = Pick<SourceUserStrategyRecord, 'name' | 'parameters' | 'score' | 'ret' | 'mdd' | 'n' | 'winRate' | 'environment' | 'exchangeName' | 'asset' | 'exchangeId' | 'chartSymbol' | 'capital' | 'version' | 'origin'> & { status: 'ready' | 'live' }
type Entry = Readonly<{ sessionId: string; record: SourceUserStrategyRecord }>
type Snapshot = Readonly<{ entries: readonly Entry[]; storageError: boolean }>
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
export const clientUserStrategyKey = (owner: string) => `teth-client-user-strategies:${encodeURIComponent(owner)}`
export class SourceUserStrategyEditConflict extends Error {
  constructor() { super('전략 상태가 바뀌었어요. 현재 상태를 확인해주세요.') }
}

/** Full-precision preview snapshots tolerate serialization noise, not displayed rounding. */
const metricTolerance = 1e-6
function requireCurrentValidation(record: SourceUserStrategyRecord) {
  if (!record.parameters) throw new Error('저장된 계산 설정이 없어요. 전략을 다시 검증한 뒤 실행해주세요.')
  let result: ReturnType<typeof evaluateSourceTerminal>['r']
  try {
    // The score and percentage metrics do not depend on capital. Unit capital
    // avoids inventing a missing account budget; no amount is stored or shown.
    result = evaluateSourceTerminal(record.parameters, 1).r
  } catch { throw new Error('저장된 계산 설정을 확인할 수 없어요. 전략을 다시 검증해주세요.') }
  const score = scoreSourceTerminal(result)
  if (score < SOURCE_USER_STRATEGY_PASS_SCORE) throw new Error(`현재 설정의 재검증 점수 ${score}점이 실행 기준(${SOURCE_USER_STRATEGY_PASS_SCORE}점)에 미달해요. 전략을 다시 검증해주세요.`)
  if (record.score !== score || record.n !== result.n
    || (['ret', 'mdd', 'winRate'] as const).some(key => Math.abs(record[key] - result[key]) > metricTolerance)) {
    throw new Error('저장된 검증 수치가 현재 계산 설정과 일치하지 않아요. 전략을 다시 검증해주세요.')
  }
}

export function createClientUserStrategyStore(owner: string | null, storage?: StoragePort) {
  let snapshot: Snapshot = { entries: [], storageError: false }
  let loaded = !owner
  const pending = new Map<string, Entry>()
  const listeners = new Set<() => void>()
  const port = () => storage ?? sessionStorage
  const emit = (next: Snapshot) => { snapshot = next; listeners.forEach(fn => fn()) }
  const restore = () => {
    if (!owner) return true
    try {
      const raw = port().getItem(clientUserStrategyKey(owner))
      const data: unknown = raw === null ? [] : JSON.parse(raw)
      if (!Array.isArray(data)) throw new TypeError('Invalid preview registrations')
      const entries: Entry[] = [], ids = new Set<string>(), sessions = new Set<string>()
      for (const value of data) {
        if (!value || typeof value !== 'object' || typeof value.sessionId !== 'string' || !value.sessionId) throw new TypeError('Invalid preview registration')
        const record = decodeSourceUserStrategyRecord(value.record)
        if (!record || ids.has(record.id) || sessions.has(value.sessionId)) throw new TypeError('Invalid preview registration')
        ids.add(record.id); sessions.add(value.sessionId)
        entries.push(Object.freeze({ sessionId: value.sessionId, record }))
      }
      for (const [sessionId, entry] of pending) {
        const index = entries.findIndex(item => item.sessionId === sessionId)
        if (index < 0) entries.push(entry); else entries[index] = entry
      }
      loaded = true; emit({ entries: Object.freeze(entries), storageError: snapshot.storageError })
      return true
    } catch { emit({ ...snapshot, storageError: true }); return false }
  }
  restore()
  const save = () => {
    if (!owner || !loaded && !restore()) return
    try {
      port().setItem(clientUserStrategyKey(owner), JSON.stringify(snapshot.entries))
      pending.clear()
      if (snapshot.storageError) emit({ ...snapshot, storageError: false })
    } catch { if (!snapshot.storageError) emit({ ...snapshot, storageError: true }) }
  }
  const commit = (entry: Entry) => {
    const entries = snapshot.entries.filter(item => item.sessionId !== entry.sessionId)
    pending.set(entry.sessionId, entry)
    emit({ ...snapshot, entries: Object.freeze([...entries, entry]) }); save()
    return entry.record
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    register: (sessionId: string, input: ClientStrategyRegistration, now: number, options?: { preserveExisting: boolean }) => {
      if (!owner || !sessionId || !Number.isSafeInteger(now) || now < 0) throw new Error('등록할 계정과 전략을 확인해주세요.')
      if (!loaded && !restore()) throw new Error('기존 전략을 불러오지 못했어요. 저장 상태를 확인한 뒤 다시 시도해주세요.')
      const previous = snapshot.entries.find(item => item.sessionId === sessionId)
      // A research revisit is navigation, not authorization to resume or replace
      // an existing (possibly edited/paused/delegated) local strategy.
      if (previous && options?.preserveExisting) return previous.record
      let createdAt = previous?.record.createdAt ?? now
      while (!previous && snapshot.entries.some(item => item.record.id === String(createdAt))) createdAt++
      const record = decodeSourceUserStrategyRecord({ ...input, id: String(createdAt), createdAt })
      if (!record || record.score < SOURCE_USER_STRATEGY_PASS_SCORE) throw new Error('검증 기준을 통과한 전략만 등록할 수 있어요.')
      // Legacy ready records remain representable without fabricated parameters.
      // They cannot enter live state until a real source-preview calculation is supplied.
      if (record.parameters || record.status === 'live') requireCurrentValidation(record)
      return commit(Object.freeze({ sessionId, record }))
    },
    control: (id: string, action: 'pause' | 'resume' | 'start' | 'env') => {
      const entry = snapshot.entries.find(item => item.record.id === id)
      if (!owner || !entry) throw new Error('전략을 찾을 수 없어요')
      const r = entry.record
      if (action === 'pause' && r.status !== 'live' || action === 'resume' && r.status !== 'off' || action === 'start' && r.status !== 'ready' || action === 'env' && r.status !== 'live') throw new Error('전략 상태가 바뀌었어요. 현재 상태를 확인해주세요.')
      if (action === 'resume' || action === 'start' || action === 'env' && r.environment === 'paper') requireCurrentValidation(r)
      const record = decodeSourceUserStrategyRecord({ ...r, status: action === 'pause' ? 'off' : 'live', environment: action === 'env' ? r.environment === 'paper' ? 'live' : 'paper' : r.environment })!
      return commit(Object.freeze({ ...entry, record }))
    },
    // Source tfBotEditApply only: same account/record/period, freshly computed
    // metrics, and pause before a future explicit resume. Never order authority.
    revise: (expected: SourceUserStrategyRecord, input: SourceTerminalParameters) => {
      const previous = decodeSourceUserStrategyRecord(expected)
      const entry = snapshot.entries.find(item => item.record.id === previous?.id)
      if (!owner || !entry || !previous?.parameters) throw new Error('저장된 전략 설정을 확인할 수 없어요.')
      if (JSON.stringify(entry.record) !== JSON.stringify(previous)) throw new SourceUserStrategyEditConflict()
      const parameters = decodeSourceUserStrategyParameters(input)
      if (!parameters || parameters.startI !== previous.parameters.startI || parameters.endI !== previous.parameters.endI) throw new Error('같은 검증 구간의 설정만 적용할 수 있어요.')
      const result = evaluateSourceTerminal(parameters, 1).r
      const record = decodeSourceUserStrategyRecord({ ...entry.record, parameters,
        score: scoreSourceTerminal(result), ret: result.ret, mdd: result.mdd, n: result.n, winRate: result.winRate,
        status: entry.record.status === 'live' ? 'off' : entry.record.status })
      if (!record) throw new Error('저장된 계산 설정을 확인할 수 없어요. 전략을 다시 검증해주세요.')
      requireCurrentValidation(record)
      return commit(Object.freeze({ ...entry, record }))
    },
    retrySave: save,
  }
}
