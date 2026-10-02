/** Browser preview state only. Never an approval, order or service contract. */
import { evaluateSourceTerminal, sourceTerminalSeeds, type SourceTerminalSeed } from './client-terminal-source-fixture'
import { createSourceTerminalProposal, scoreSourceTerminal, sourceParameterFingerprint, sourceVersionIncrement, type SourceTerminalProposal } from './client-terminal-source-proposal'
import type { ClientAgentOperation } from './client-agent-view'

export type SourceVersionRecord = { from: string; to: string; timeLabel: string; by: string; diff: string }
export type SourceTerminalState = {
  seeds: readonly SourceTerminalSeed[]
  operations: Readonly<Record<string, readonly ClientAgentOperation[]>>
  history: Readonly<Record<string, readonly SourceVersionRecord[]>>
}
/** In-memory UI receipt only, never a service approval or execution token. */
export type SourceAppliedReceipt = { strategyId: string; version: string; fingerprint: string; paused: boolean; operationId: string }
export function canResumeSourceApplied(state: SourceTerminalState, receipt: SourceAppliedReceipt): boolean {
  const seed = state.seeds.find(item => item.id === receipt.strategyId)
  return receipt.paused && seed?.status === 'off' && seed.version === receipt.version
    && sourceParameterFingerprint(seed.parameters) === receipt.fingerprint
    && state.operations[seed.id]?.[0]?.id === receipt.operationId
}
export function resumeSourceApplied(state: SourceTerminalState, receipt: SourceAppliedReceipt, operation: ClientAgentOperation): SourceTerminalState {
  if (!canResumeSourceApplied(state, receipt)) throw new Error('전략 상태가 바뀌었어요. 현재 상태를 확인해주세요.')
  return setSourceTerminalStatus(state, receipt.strategyId, 'live', operation)
}
export function applySourceTerminalWithReceipt(state: SourceTerminalState, proposal: SourceTerminalProposal, operation: Pick<ClientAgentOperation, 'id' | 'timeLabel'>) {
  const next = applySourceTerminalProposal(state, proposal, operation)
  const seed = next.seeds.find(item => item.id === proposal.strategyId)!
  const receipt: SourceAppliedReceipt = { strategyId: seed.id, version: seed.version,
    fingerprint: sourceParameterFingerprint(seed.parameters), paused: state.seeds.find(item => item.id === seed.id)?.status === 'live',
    operationId: next.operations[seed.id][0].id }
  return { state: next, receipt }
}
export type SourceStatusFailure = { kind: 'notFound' } | { kind: 'connectionRequired' } | { kind: 'belowThreshold'; score: number }
/** Typed preview failure for display only. Original Korean Error.message is preserved. */
export class SourceTerminalStatusError extends Error {
  readonly detail: SourceStatusFailure
  constructor(detail: SourceStatusFailure) {
    super(detail.kind === 'notFound' ? '전략을 찾을 수 없습니다.' : detail.kind === 'connectionRequired' ? '연결 오류 상태예요. 먼저 다시 연결해주세요' : `재검증 점수 ${detail.score}점, 실행 기준(80점) 미달이에요. 전략을 수정해 기준을 넘겨주세요`)
    this.detail = detail
  }
}
export function initialSourceTerminalState(): SourceTerminalState {
  return { seeds: sourceTerminalSeeds.map(seed => ({ ...seed, id: `demo:${seed.id}`, parameters: { ...seed.parameters } })), operations: {}, history: {} }
}
export function addSourceOperation(state: SourceTerminalState, id: string, operation: ClientAgentOperation): SourceTerminalState {
  return { ...state, operations: { ...state.operations, [id]: [operation, ...(state.operations[id] ?? [])].slice(0, 30) } }
}
/** Same source-preview start/resume gate as tfTmSetStatus, including demo seeds. */
export function setSourceTerminalStatus(state: SourceTerminalState, id: string, status: 'live' | 'off', operation: ClientAgentOperation): SourceTerminalState {
  const seed = state.seeds.find(item => item.id === id)
  if (!seed) throw new SourceTerminalStatusError({ kind: 'notFound' })
  if (seed.status === status) return state
  if (status === 'live') {
    if (seed.status === 'err') throw new SourceTerminalStatusError({ kind: 'connectionRequired' })
    const score = scoreSourceTerminal(evaluateSourceTerminal(seed.parameters, seed.capital).r)
    if (score < 80) throw new SourceTerminalStatusError({ kind: 'belowThreshold', score })
  }
  return addSourceOperation({ ...state, seeds: state.seeds.map(item => item.id === id ? { ...item, status } : item) }, id, operation)
}
/** Compare-and-apply against the latest in-memory state, not a rendered closure. */
export function applySourceTerminalProposal(state: SourceTerminalState, proposal: SourceTerminalProposal, operation: Pick<ClientAgentOperation, 'id' | 'timeLabel'>): SourceTerminalState {
  const seed = state.seeds.find(item => item.id === proposal.strategyId)
  if (!seed || seed.version !== proposal.baseVersion || sourceParameterFingerprint(seed.parameters) !== proposal.baseFingerprint) {
    throw new Error('전략 상태가 바뀌어 변경안이 무효화됐어요. 다시 요청해주세요')
  }
  // A display score or stale candidate cannot grant even preview execution state.
  const checked = createSourceTerminalProposal(seed, proposal.request)
  if (checked.kind !== 'proposal' || !checked.proposal.passes || sourceParameterFingerprint(checked.proposal.parameters) !== sourceParameterFingerprint(proposal.parameters)) {
    throw new Error('재검증 기준을 충족하는 변경안을 다시 확인해주세요')
  }
  const parameters = { ...checked.proposal.parameters }
  const version = sourceVersionIncrement(seed.version)
  const diff = `손절 ${parameters.sl}%, ${parameters.tp != null ? `익절 +${parameters.tp}%` : '익절 없음'}, RSI ${parameters.rsiTh}, 추세필터 ${parameters.trendFilter ? 'ON' : 'OFF'}`
  const record: SourceVersionRecord = { from: seed.version, to: version, timeLabel: operation.timeLabel, by: '사용자 (자연어 요청)', diff }
  let next: SourceTerminalState = {
    ...state,
    seeds: state.seeds.map(item => item.id === seed.id ? { ...item, parameters, version, status: item.status === 'live' ? 'off' : item.status } : item),
    history: { ...state.history, [seed.id]: [...(state.history[seed.id] ?? []), record] },
  }
  next = addSourceOperation(next, seed.id, { ...operation, label: '전략 수정', text: `전략이 업데이트되었습니다. ${seed.version} → ${version}`, version, diff: `변경: ${diff}, 변경 주체: 사용자` })
  if (seed.status === 'live') next = addSourceOperation(next, seed.id, { ...operation, id: `${operation.id}:pause`, label: '중지', text: '전략 실행을 중지했어요. 설정 적용을 위한 중지예요 (자동 재개 없음)' })
  return next
}
