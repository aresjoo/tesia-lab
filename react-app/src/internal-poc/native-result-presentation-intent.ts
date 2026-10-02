import type { NativeJob } from './native-service-api'
import { createContext, useContext } from 'react'

export const NativeAutomaticPresentationContext = createContext<{
  active: boolean
  isForeground: () => boolean
  begin: () => () => void
} | null>(null)
export const useNativeAutomaticPresentation = () => useContext(NativeAutomaticPresentationContext)

/** Ephemeral UI coordinates only; never SDK input, job authority or a journal. */
export type NativeResultPresentationScope = {
  sessionId: string
  sessionState: 'ANONYMOUS' | 'AUTHENTICATED'
  conversationId: string
  draftId: string
  epoch: number
}
export type NativeResultPresentationRequest = {
  backtestId: string
  consume: () => boolean
  isCurrent: () => boolean
}
const sameScope = (left: NativeResultPresentationScope, right: NativeResultPresentationScope | null) => Boolean(right
  && left.sessionId === right.sessionId && left.sessionState === right.sessionState
  && left.conversationId === right.conversationId && left.draftId === right.draftId && left.epoch === right.epoch)
const sameJob = (left: NativeJob, right: NativeJob) => (['backtestId', 'strategyVersionId', 'semanticHash', 'profileId', 'profileContentHash', 'splitGroupId', 'createdAt'] as const)
  .every(key => left[key] === right[key])
const terminal = (job: NativeJob) => ['COMPLETED', 'FAILED', 'INVALID'].includes(job.state)

/** The caller must still validate every response with its existing SDK and
 * assertSameJob. This small state machine authorizes only a visual request. */
export function createNativeResultPresentationIntent(currentScope: () => NativeResultPresentationScope | null) {
  let generation = 0
  let fresh: { key: string; scope: NativeResultPresentationScope } | null = null
  let observed: NativeJob | null = null
  const invalidate = () => { generation++; fresh = null; observed = null }
  return {
    invalidate,
    setScopeReader(reader: () => NativeResultPresentationScope | null) { currentScope = reader },
    beginSubmission(key: string) {
      invalidate()
      const scope = currentScope()
      if (scope) fresh = { key, scope: { ...scope } }
    },
    acceptSubmission(key: string, job: NativeJob) {
      if (!fresh || fresh.key !== key || !sameScope(fresh.scope, currentScope())) { invalidate(); return }
      // An immediately COMPLETED acknowledgement never proves this view saw
      // progress. Uncertain same-key retries retain the in-memory fresh stamp.
      if (terminal(job)) { invalidate(); return }
      observed = job
    },
    observe(job: NativeJob): NativeResultPresentationRequest | undefined {
      if (!fresh || !observed) return
      if (!sameScope(fresh.scope, currentScope()) || !sameJob(observed, job)) { invalidate(); return }
      if (!terminal(job)) { observed = job; return }
      const scope = fresh.scope, acceptedGeneration = generation
      fresh = null; observed = null
      if (job.state !== 'COMPLETED' || !job.resultAvailable) { generation++; return }
      let consumed = false
      const isCurrent = () => acceptedGeneration === generation && sameScope(scope, currentScope())
      return {
        backtestId: job.backtestId,
        isCurrent,
        consume: () => {
          if (consumed) return false
          consumed = true
          return isCurrent()
        },
      }
    },
  }
}
