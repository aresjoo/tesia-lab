import type { MarketResponseBinding } from './client-market-response-presentation'

/** Explicit user retry of a visible question, never automatic provider replay. */
export type RetryResponseRequest = { binding: MarketResponseBinding; question: string }
export type RetryResponseAction = (request: RetryResponseRequest, signal: AbortSignal) => boolean | Promise<boolean>
export function isEmptyInterruptedResponse(turn: { status: string; answer: string; question: string } | undefined): boolean {
  return Boolean(turn && ['stopped', 'failed'].includes(turn.status) && !turn.answer.trim() && turn.question.trim())
}
/** Replaying an already prepared fixture cannot invent a missing response. */
export function canRetryPreview(turn: { status: string; answer: string; question: string; fullAnswer: string; suggestions: readonly string[]; responseSequence?: unknown; responseSequenceInvalid?: unknown } | undefined): boolean {
  return Boolean(turn && !turn.responseSequence && !turn.responseSequenceInvalid && isEmptyInterruptedResponse(turn) && (turn.fullAnswer.trim() || turn.suggestions.length))
}
