/** Public design preview only. These settings never form a service job request.
 * Restore by immutable conversation turn, not mutable latest intake values. */
import type { ClientSession, ClientTurn } from './client-experience-store'
import { decodeInlineInput } from './client-inline-backtest'
import { evaluateSourceTerminal, sourceTerminalPrices, sourceTerminalDate } from './client-terminal-source-fixture'
import { responseStrategyForTurn } from './client-response-strategy'

export function commonDate(index: number) {
  const date = sourceTerminalDate(index)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const commonPeriods = [90, 365, 730, 0] as const
export const commonAmounts = [500, 1000, 3000, 5000, 10000, 30000] as const
export const COMMON_REPLAY_MS = 60_000
export type CommonBacktestPreview = {
  turnId: string
  period: typeof commonPeriods[number]
  amount: typeof commonAmounts[number]
  startedAt?: number
  skipped?: true
}
export function commonTurn(turn: ClientTurn | undefined): boolean {
  return Boolean(turn?.backtestFlow === 'common' && turn.status === 'done' && turn.inlineRequest
    && !turn.inlineStopped && !turn.commonRevisionInvalid && !turn.responseSequenceInvalid
    && (!turn.responseSequence || responseStrategyForTurn(turn)))
}
export function readCommonBacktest(value: unknown, turns: ClientTurn[]): CommonBacktestPreview | undefined {
  if (!value || typeof value !== 'object') return
  const x = value as CommonBacktestPreview
  const turn = turns.find(t => t.id === x.turnId)
  const readyAt = turn?.responseSequence ? turn.strategyObservedAt : turn?.finishedAt
  if (!commonTurn(turn) || !decodeInlineInput(turn?.inlineRequest) || !Number.isSafeInteger(readyAt)
    || !commonPeriods.includes(x.period) || !commonAmounts.includes(x.amount)
    || x.startedAt !== undefined && (!Number.isSafeInteger(x.startedAt) || x.startedAt < readyAt! || x.startedAt > Date.now())
    || x.skipped !== undefined && (x.skipped !== true || x.startedAt === undefined)) return
  return { turnId: x.turnId, period: x.period, amount: x.amount,
    ...(x.startedAt !== undefined ? { startedAt: x.startedAt } : {}), ...(x.skipped ? { skipped: true } : {}) }
}
export function commonBacktestInput(session: ClientSession) {
  const state = readCommonBacktest(session.commonBacktest, session.turns)
  const input = state && decodeInlineInput(session.turns.find(turn => turn.id === state.turnId)?.inlineRequest)
  if (!state || !input) return
  const endI = input.parameters.endI
  const startI = state.period ? Math.max(input.parameters.startI, endI - state.period + 1) : input.parameters.startI
  return { state, input: { ...input, parameters: { ...input.parameters, startI, endI } } }
}
export function commonPreviewProgress(state: CommonBacktestPreview, now: number): number {
  if (state.startedAt === undefined) return 0
  return state.skipped ? 1 : Math.min(1, Math.max(0, (now - state.startedAt) / COMMON_REPLAY_MS))
}
export function commonPreviewResult(input: NonNullable<ReturnType<typeof commonBacktestInput>>) {
  const evaluation = evaluateSourceTerminal(input.input.parameters, input.state.amount)
  const { startI, endI } = evaluation.r.params
  const eq = new Map(evaluation.r.eq.map(point => [point.i, point.v]))
  let value = 1
  const points = Array.from({ length: endI - startI + 1 }, (_, offset) => {
    const i = startI + offset
    value = eq.get(i) ?? value
    // Preserve the existing preview engine's final NAV, including an open position.
    if (i === endI) value = evaluation.nav / evaluation.cap
    return { i, value: value * evaluation.cap, benchmark: sourceTerminalPrices[i] / sourceTerminalPrices[startI] * evaluation.cap }
  })
  return { evaluation, points }
}
export function isCommonBacktestRoute(hash = window.location.hash) { return hash === '#/share/bt/mine' }
