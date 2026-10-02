/** Lazy client 42a0d81 tfBotView projection, isolated from actual account events. */
import { evaluateSourceTerminal, type SourceTerminalEvaluation } from './client-terminal-source-fixture'
import { decodeSourceUserStrategyRecord, isSourceUserStrategyId, type SourceUserStrategyRecord } from './client-user-strategy'
import type { SourceAccountFill, SourceAccountRebate, SourceAccountReview } from './client-account-event-state'

export type SourceUserStrategyModel = Readonly<{
  record: SourceUserStrategyRecord
  environmentKey: 'ready' | 'stop' | 'paper' | 'live'
  environmentLabel: string
  ruleText: string | null
  /** Dimensionless validation equity/signals only, never account capital or fills. */
  evaluation: Readonly<Pick<SourceTerminalEvaluation, 'r' | 'L'>> | null
}>
export type SourceUserStrategyActivity = Readonly<{
  fillLog: readonly SourceAccountFill[]
  reviews: readonly SourceAccountReview[]
  rebates: readonly SourceAccountRebate[]
}>
function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freezeTree)
    Object.freeze(value)
  }
  return value
}

export function projectSourceUserStrategy(input: unknown): SourceUserStrategyModel | null {
  const record = decodeSourceUserStrategyRecord(input)
  if (!record) return null
  const p = record.parameters
  let evaluation: SourceUserStrategyModel['evaluation'] = null
  if (p) {
    try {
      // Capital 1 is only an internal evaluator argument. Money/positions never escape.
      const { r, L } = evaluateSourceTerminal(p, 1)
      evaluation = freezeTree({ r, L })
    } catch { return null }
  }
  const environmentKey = record.status === 'ready' ? 'ready' : record.status === 'off' ? 'stop' : record.environment === 'paper' ? 'paper' : 'live'
  return Object.freeze({ record, evaluation, environmentKey,
    environmentLabel: { ready: '시작 대기', stop: '중지됨', paper: '가상 실행', live: '라이브 (시뮬레이션)' }[environmentKey],
    ruleText: p ? `RSI ${p.rsiTh} 눌림 진입, 손절 ${p.sl}%, ${p.tp !== null ? `익절 +${p.tp}%` : '기간 청산'}${p.trendFilter ? ', 추세 필터' : ''}` : null,
  })
}

/** Supplied ledgers only. Omit the original unowned t.fills fallback, which can show
 * a different bot's fills. No execution/fees/reviews/notifications are generated.
 */
export function selectSourceUserStrategyActivity(id: string, input: SourceUserStrategyActivity): SourceUserStrategyActivity {
  const matches = (row: { botId: string }) => isSourceUserStrategyId(id) && row.botId === id
  return Object.freeze({
    fillLog: Object.freeze(input.fillLog.filter(matches).map(row => Object.freeze({ ...row }))),
    reviews: Object.freeze(input.reviews.filter(matches).map(row => Object.freeze({ ...row, causes: Object.freeze(row.causes.map(cause => Object.freeze([cause[0], cause[1]] as const))) }))),
    rebates: Object.freeze(input.rebates.filter(matches).map(row => Object.freeze({ ...row }))),
  })
}
