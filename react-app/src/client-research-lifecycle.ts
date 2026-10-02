import type { ClientSession } from './client-experience-store'
import type { InlineBacktestRecord } from './client-inline-backtest'
import { readResearchDocumentCache } from './client-research-cache'
import { RESEARCH_DOCUMENTS } from './client-research-fixtures'
import { getMockResearchPreview } from './mock-research-preview'

/** Restore an existing base document; never invent one for an inline-only journey. */
export function canOpenBaseResearch(session: ClientSession): boolean {
  if (session.phase === 'plan' && !session.turns.some(turn => turn.inlineRequest || turn.sourceIntake || turn.sourceIntakeInvalid) && !session.inlineResults?.length) return true
  try {
    const cached = readResearchDocumentCache(session.id)
    if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return false
    const state = cached as Record<string, unknown>
    // The workspace repairs absent tabs/drafts on restore. Do not hide a real
    // document just because those optional presentation fields need repair.
    return state.active === 'activity' || RESEARCH_DOCUMENTS.some(([id]) => id === state.active)
  } catch { return false }
}

/** Check before mounting: the workspace must not trim saved tabs using a lost clock. */
export function canRestoreBaseResearch(session: ClientSession): boolean {
  try {
    const replay = getMockResearchPreview(`restored:${session.id}`).getSnapshot()
    if (replay.recoveryRequired) return false
    const cached = readResearchDocumentCache(session.id)
    if (!cached || typeof cached !== 'object' || Array.isArray(cached)) return cached === null
    const value = cached as Record<string, unknown>
    // Match tick exactly; only elapsed time is floored. Previously observed
    // fractional seconds (for example after pause) remain valid observations.
    const seconds = replay.status === 'playing' && replay.clockStartedAt !== undefined
      ? Math.min(95, Math.max(replay.seconds, Math.floor((Date.now() - replay.clockStartedAt) / 1000))) : replay.seconds
    return [value.active, ...(Array.isArray(value.tabs) ? value.tabs : [])].every(id => {
      const doc = RESEARCH_DOCUMENTS.find(([key]) => key === id)
      return !doc || seconds >= doc[2]
    })
  } catch { return false }
}

/** Local presentation scope, never a backend job or strategy identity. */
export function researchScope(session: Pick<ClientSession, 'id' | 'researchPlanTurnId'>, turnId = session.researchPlanTurnId): string {
  return turnId === undefined ? session.id : `inline-plan:${JSON.stringify([session.id, turnId])}`
}

export function researchScopes(session: ClientSession): string[] {
  return [session.id, ...new Set([...(session.researchPlanTurnIds ?? []), ...(session.researchPlanTurnId ? [session.researchPlanTurnId] : [])])].map((id, index) => index === 0 ? id : researchScope(session, id))
}

export type ResearchPlanContext = Pick<ClientSession, 'pair' | 'mode' | 'timeframe' | 'risk' | 'takeProfit'> & { parameters?: InlineBacktestRecord['parameters'] }
export function researchPlanContext(session: ClientSession): ResearchPlanContext {
  const record = session.inlineResults?.find(item => item.turnId === session.researchPlanTurnId)
  if (!record) return session
  // Source template intent is encoded in this record's filter, never in the
  // session's later edits. The entry row still uses the actual parameters.
  return { pair: record.pair, mode: record.parameters.trendFilter ? 'trend' : 'dip', timeframe: record.timeframe, risk: `−${Math.abs(record.parameters.sl)}%`,
    takeProfit: record.parameters.tp === null ? '없음' : `+${record.parameters.tp}%`, parameters: { ...record.parameters } }
}
