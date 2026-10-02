import type { ClientLanguage } from '../client-preferences'
import type { ResearchObservedLogEntry } from '../components/ClientResearchLog'
import { observationResponseBlocks, type NativeResearchObservation } from './native-research-observations'

/** Existing, accepted observations only. Neither server history nor agent inference.
 * No timestamps, roles, Critic findings or final research verdict are manufactured. */
export function observedResearchEntries(observations: readonly NativeResearchObservation[], language: ClientLanguage): ResearchObservedLogEntry[] {
  const entries = new Map<string, ResearchObservedLogEntry>()
  for (const observation of observations) {
    for (const block of observationResponseBlocks(observation, language)) {
      if (block.kind !== 'work') continue
      for (const step of block.activity.steps) entries.set(step.id, {
        id: step.id, agent: 'TETH', summary: [step.title, step.detail, step.publicSummary].filter(Boolean).join('\n'),
        state: step.status === 'failed' ? 'failed' : step.status === 'done' ? 'done' : 'work',
      })
    }
  }
  return [...entries.values()]
}
