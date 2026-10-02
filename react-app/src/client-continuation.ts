import type { MarketResponseBinding } from './client-market-response-presentation'

/** Source taiCancelChips. Explicit new request, never permission to execute. */
export const CONTINUE_RESPONSE_PROMPT = '방금 끊긴 답변을 이어서 계속 작성해줘'
export type ContinueResponseRequest = {
  binding: MarketResponseBinding
  /** The already visible incomplete answer, not hidden reasoning/full response. */
  partialText: string
  prompt: string
}
export type ContinueResponseAction = (request: ContinueResponseRequest, signal: AbortSignal) => boolean | Promise<boolean>

/** Capability of the existing local fixture, never a real provider capability. */
export function canContinuePreview(turn: { status: string; answer: string; fullAnswer: string; responseSequence?: unknown; responseSequenceInvalid?: unknown } | undefined): boolean {
  return Boolean(turn && !turn.responseSequence && !turn.responseSequenceInvalid && ['stopped', 'failed'].includes(turn.status) && turn.answer.trim() && turn.fullAnswer.startsWith(turn.answer)
    && turn.fullAnswer.slice(turn.answer.length).trim())
}
