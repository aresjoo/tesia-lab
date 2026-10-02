import { expect, test } from '@playwright/test'
import { initialSourceTerminalState, applySourceTerminalProposal, applySourceTerminalWithReceipt, canResumeSourceApplied, resumeSourceApplied, setSourceTerminalStatus, type SourceTerminalState } from '../src/client-terminal-source-state'
import { createSourceTerminalProposal, sourceParameterFingerprint, type SourceTerminalProposal } from '../src/client-terminal-source-proposal'

function candidate(state: SourceTerminalState, passes = true): SourceTerminalProposal {
  for (const seed of state.seeds) {
    for (const request of ['손절 -3%로 바꿔줘', '손절 -12%로 바꿔줘', '익절 15%로 바꿔줘', 'RSI 38로 바꿔줘', '추세 필터 꺼줘']) {
      const response = createSourceTerminalProposal(seed, request)
      if (response.kind === 'proposal' && response.proposal.passes === passes) return response.proposal
    }
  }
  throw new Error(`No original fixture proposal with passes=${passes}`)
}
const event = { id: 'update-1', timeLabel: '2026-09-15 12:00' }

test('적용으로 발생한 중지만 명시 재개하며 이중 클릭·이후 수동 중지는 재사용하지 않는다', () => {
  const initial = initialSourceTerminalState(), proposal = candidate(initial)
  const before = { ...initial, seeds: initial.seeds.map(seed => seed.id === proposal.strategyId ? { ...seed, status: 'live' as const } : seed) }
  const applied = applySourceTerminalWithReceipt(before, proposal, event)
  expect(applied.receipt.paused).toBe(true)
  expect(canResumeSourceApplied(applied.state, applied.receipt)).toBe(true)
  const resumed = resumeSourceApplied(applied.state, applied.receipt, { ...event, id: 'resume', label: '실행', text: '명시 재개' })
  expect(resumed.seeds.find(seed => seed.id === proposal.strategyId)!.status).toBe('live')
  expect(() => resumeSourceApplied(resumed, applied.receipt, { ...event, label: '실행', text: '' })).toThrow('상태가 바뀌었어요')
  const paused = setSourceTerminalStatus(resumed, proposal.strategyId, 'off', { ...event, id: 'manual-stop', label: '중지', text: '별도 수동 중지' })
  expect(canResumeSourceApplied(paused, applied.receipt)).toBe(false)
  expect(applied.state.seeds.find(seed => seed.id === proposal.strategyId)!.status).toBe('off')
})

test('적용 후 변경된 버전·설정·기록·삭제와 원래 중지 상태에는 바로 재개 권한을 만들지 않는다', () => {
  const initial = initialSourceTerminalState(), proposal = candidate(initial)
  const applied = applySourceTerminalWithReceipt(initial, proposal, event)
  const variants = [
    { ...applied.state, seeds: [] },
    { ...applied.state, operations: {} },
    { ...applied.state, seeds: applied.state.seeds.map(seed => ({ ...seed, version: 'v99.0' })) },
    { ...applied.state, seeds: applied.state.seeds.map(seed => ({ ...seed, parameters: { ...seed.parameters, rsiTh: 39 } })) },
  ]
  for (const state of variants) {
    expect(canResumeSourceApplied(state, applied.receipt)).toBe(false)
    expect(() => resumeSourceApplied(state, applied.receipt, { ...event, label: '실행', text: '' })).toThrow('상태가 바뀌었어요')
  }
  for (const status of ['off', 'ready', 'err'] as const) {
    const before = { ...initial, seeds: initial.seeds.map(seed => seed.id === proposal.strategyId ? { ...seed, status } : seed) }
    const outcome = applySourceTerminalWithReceipt(before, proposal, event)
    expect(outcome.receipt.paused).toBe(false)
    expect(canResumeSourceApplied(outcome.state, outcome.receipt)).toBe(false)
  }
})

test('바로 재개는 일치하는 로컬 영수증이 있어도 현재 실행 점수를 다시 검사한다', () => {
  const state = initialSourceTerminalState(), seed = state.seeds.find(item => item.id === 'demo:d2')!
  const operation = { ...event, label: '중지', text: '시험 기록' }
  const current = { ...state, seeds: state.seeds.map(item => item.id === seed.id ? { ...item, status: 'off' as const } : item), operations: { [seed.id]: [operation] } }
  const receipt = { strategyId: seed.id, version: seed.version, fingerprint: sourceParameterFingerprint(seed.parameters), paused: true, operationId: operation.id }
  const snapshot = structuredClone(current)
  expect(canResumeSourceApplied(current, receipt)).toBe(true)
  expect(() => resumeSourceApplied(current, receipt, { ...event, id: 'resume', label: '실행', text: '재개' })).toThrow('68점')
  expect(current).toEqual(snapshot)
})

test('기준 미달·연결 오류 전략은 수동 재개로도 실행하거나 성공 기록을 만들지 않는다', () => {
  const state = initialSourceTerminalState(), snapshot = structuredClone(state), operation = { ...event, label: '실행', text: '실행' }
  expect(() => setSourceTerminalStatus(state, 'demo:d2', 'live', operation)).toThrow('68점')
  expect(() => setSourceTerminalStatus(state, 'demo:d6', 'live', operation)).toThrow('연결 오류')
  expect(setSourceTerminalStatus(state, 'demo:d1', 'live', operation)).toBe(state)
  expect(state).toEqual(snapshot)
})

test('명시 적용은 버전·설정·중지·이력·운영 기록을 하나의 새 상태로 갱신한다', () => {
  const state = initialSourceTerminalState(), snapshot = structuredClone(state), proposal = candidate(state)
  const original = state.seeds.find(seed => seed.id === proposal.strategyId)!
  const before = { ...state, seeds: state.seeds.map(seed => seed.id === original.id ? { ...seed, status: 'live' as const } : seed) }
  const after = applySourceTerminalProposal(before, proposal, event)
  const changed = after.seeds.find(seed => seed.id === original.id)!
  expect(changed.version).not.toBe(original.version)
  expect(changed.parameters).toEqual(proposal.parameters)
  expect(changed.status).toBe('off')
  expect(after.history[original.id]).toHaveLength(1)
  expect(after.history[original.id][0]).toMatchObject({ from: original.version, to: changed.version, by: '사용자 (자연어 요청)' })
  expect(after.operations[original.id].map(item => item.label)).toEqual(['중지', '전략 수정'])
  expect(after.operations[original.id][0].text).toContain('자동 재개 없음')
  expect(state).toEqual(snapshot)
  expect(after.seeds.filter(seed => seed.id !== original.id)).toEqual(state.seeds.filter(seed => seed.id !== original.id))
})

test('중지·실행 전·오류 상태에서 적용해도 자동 실행하거나 오류를 지우지 않는다', () => {
  for (const status of ['off', 'ready', 'err'] as const) {
    const state = initialSourceTerminalState(), proposal = candidate(state)
    const before = { ...state, seeds: state.seeds.map(seed => seed.id === proposal.strategyId ? { ...seed, status, error: '보존할 원본 연결 오류' } : seed) }
    const after = applySourceTerminalProposal(before, proposal, event)
    expect(after.seeds.find(seed => seed.id === proposal.strategyId)).toMatchObject({ status, error: '보존할 원본 연결 오류' })
    expect(after.operations[proposal.strategyId]).toHaveLength(1)
  }
})

test('삭제·기준 버전 변경·설정 변경 후의 오래된 후보는 모든 상태를 보존하며 거절한다', () => {
  const state = initialSourceTerminalState(), proposal = candidate(state)
  const variants = [
    { ...state, seeds: state.seeds.filter(seed => seed.id !== proposal.strategyId) },
    { ...state, seeds: state.seeds.map(seed => seed.id === proposal.strategyId ? { ...seed, version: 'v99.0' } : seed) },
    { ...state, seeds: state.seeds.map(seed => seed.id === proposal.strategyId ? { ...seed, parameters: { ...seed.parameters, rsiTh: 39 } } : seed) },
  ]
  for (const before of variants) {
    const snapshot = structuredClone(before)
    expect(() => applySourceTerminalProposal(before, proposal, event)).toThrow('무효화')
    expect(before).toEqual(snapshot)
  }
})

test('동일 후보를 두 번 적용해도 새 버전과 기록이 중복 생성되지 않는다', () => {
  const state = initialSourceTerminalState(), proposal = candidate(state)
  const after = applySourceTerminalProposal(state, proposal, event), snapshot = structuredClone(after)
  expect(() => applySourceTerminalProposal(after, proposal, { ...event, id: 'update-2' })).toThrow('무효화')
  expect(after).toEqual(snapshot)
})

test('표시 점수·passes 조작 또는 제안 설정 바꿔치기는 원문 재계산으로 거절한다', () => {
  const state = initialSourceTerminalState(), passing = candidate(state), failing = candidate(state, false)
  expect(() => applySourceTerminalProposal(state, { ...failing, passes: true, score: 99 }, event)).toThrow('재검증')
  expect(() => applySourceTerminalProposal(state, { ...passing, parameters: { ...passing.parameters, sl: -100 } }, event)).toThrow('재검증')
  expect(() => applySourceTerminalProposal(state, { ...passing, request: '레버리지 100배로 변경' }, event)).toThrow('재검증')
  expect(state.operations).toEqual({})
  expect(state.history).toEqual({})
})
