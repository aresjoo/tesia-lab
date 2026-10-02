import { CLIENT_RESEARCH_FIXTURE } from './client-research-fixtures'
import { evaluateSourceTerminal } from './client-terminal-source-fixture'
import { scoreSourceTerminal } from './client-terminal-source-proposal'
import type { ClientStrategyRegistration } from './client-user-strategy-store'
import type { ClientSession } from './client-experience-store'
import type { SourceUserStrategyRecord } from './client-user-strategy'
import { researchScope } from './client-research-lifecycle'
import { getMockResearchPreview } from './mock-research-preview'

/** The frozen research producer owns only the legacy/base research scope.
 * An inline plan is not evidence that this BTC example ran its conditions. */
export function registeredResearch(session: ClientSession, entries: readonly { sessionId: string; record: SourceUserStrategyRecord }[]) {
  if (session.researchPlanTurnId !== undefined || session.researchPlanRecovery) return undefined
  return entries.find(entry => entry.sessionId === session.id && entry.record.origin === 'research')?.record
}

export function requireCompletedResearchRegistration(session: ClientSession, expectedScope: string) {
  if (session.workspace !== 'research' || session.researchPlanRecovery || researchScope(session) !== expectedScope) throw new Error('현재 대화의 연구 결과를 다시 확인해주세요.')
  if (session.researchPlanTurnId !== undefined) throw new Error('선택한 계획의 연구 결과가 아직 연결되지 않았어요. 기존 전략은 내 트레이딩에서 확인할 수 있어요.')
  const replay = getMockResearchPreview(`restored:${expectedScope}`)
  replay.tick()
  const state = replay.getSnapshot()
  if (state.recoveryRequired || state.status !== 'completed' || state.seconds !== 95) throw new Error('완료된 연구 결과를 먼저 확인해주세요.')
}

export const CLIENT_RESEARCH_CAPITAL_KRW = 7000000
/** Public client example only. Never use this as a native StrategyVersion or
 * approval. The frozen report's BTC/daily window is not the visitor's draft. */
export function clientResearchRegistration(): ClientStrategyRegistration {
  const parameters = { sl: -3, tp: 8, rsiTh: 40, trendFilter: true, startI: 61, endI: 909 }
  const report = CLIENT_RESEARCH_FIXTURE.versions[1]
  const current = evaluateSourceTerminal(parameters, 1).r
  // Refuse stale source captures rather than silently relabeling their metrics.
  if (report.n !== current.n || (['ret', 'mdd', 'winRate'] as const).some(key => Math.abs(report[key] - current[key]) > 1e-6)) {
    throw new Error('연구 보고서와 현재 검증 결과가 일치하지 않아요. 결과를 다시 확인해주세요.')
  }
  return {
    name: '과매도 반등 전략', parameters, score: scoreSourceTerminal(current),
    ret: report.ret, mdd: report.mdd, n: report.n, winRate: report.winRate,
    status: 'live', environment: 'paper', origin: 'research',
    exchangeName: 'Binance', exchangeId: 'binance', asset: '비트코인',
    chartSymbol: 'BINANCE:BTCUSDT', capital: CLIENT_RESEARCH_CAPITAL_KRW, version: 'v2.0',
  }
}
