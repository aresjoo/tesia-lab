/** Source strategy-card data for the local design preview only.
 * Not an AI wire schema, approved Strategy Version, or permission to place orders. */
import { decodeInlineInput, type InlineBacktestInput } from './client-inline-backtest'
import type { ClientSession, ClientTurn } from './client-experience-store'

export type ResponseStrategyProposal = {
  input: InlineBacktestInput
  name?: string
  excludedConditions: string[]
  period: 90 | 365 | 730 | 0
}

export function readResponseStrategy(value: unknown): ResponseStrategyProposal | undefined {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const x = value as Record<string, unknown>, input = decodeInlineInput(x.input)
    const rawInput = x.input as Record<string, unknown> | undefined
    if (typeof rawInput?.pair !== 'string' || typeof rawInput?.timeframe !== 'string') return
    if (!input || ![90, 365, 730, 0].includes(x.period as number)
      || x.name !== undefined && (typeof x.name !== 'string' || !x.name.trim() || x.name.length > 128)
      || !Array.isArray(x.excludedConditions) || x.excludedConditions.length > 4) return
    const excludedConditions: string[] = []
    for (let i = 0; i < x.excludedConditions.length; i++) {
      const text = x.excludedConditions[i]
      if (typeof text !== 'string' || !text.trim() || text.length > 1000) return
      excludedConditions.push(text)
    }
    return { input, ...(x.name === undefined ? {} : { name: x.name as string }),
      excludedConditions, period: x.period as ResponseStrategyProposal['period'] }
  } catch { return }
}

/** Two stored projections must agree. Do not repair a damaged request by silently
 * substituting different rules, or convert arbitrary answer prose into a strategy. */
export function responseStrategyForTurn(turn: ClientTurn | undefined): ResponseStrategyProposal | undefined {
  if (!turn || turn.responseSequenceInvalid || turn.status !== 'done'
    || turn.responseSequence?.status !== 'done' || turn.responseSequence.turnId !== turn.id) return
  const proposal = readResponseStrategy(turn.responseSequence.strategyProposal)
  const input = decodeInlineInput(turn.inlineRequest)
  if (!proposal || !input || JSON.stringify(proposal.input) !== JSON.stringify(input)
    || !Number.isSafeInteger(turn.strategyObservedAt) || !Number.isSafeInteger(turn.startedAt)
    || turn.startedAt < 0 || turn.strategyObservedAt! < turn.startedAt || turn.strategyObservedAt! > Date.now()) return
  return proposal
}

export function commonSelectionVisible(session: ClientSession | undefined, owner: string | null): boolean {
  const turn = session?.turns.find(item => item.id === session.commonBacktest?.turnId)
  return (!session?.sharedCopy || session.sharedCopy.owner === owner)
    && (!turn?.responseSequence || turn.responseSequence.owner === owner)
    && (!turn?.commonRevisionOf || session?.turns.find(item => item.id === turn.commonRevisionOf)?.commonRevision?.owner === owner)
}
