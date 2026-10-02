import type { MarketResponseBinding } from './client-market-response-presentation'

/** View input, not an API schema or permission to execute a strategy. Stable IDs
 * belong to one observed question; changed questions require a new observation. */
export type MarketQuestionStep = {
  id: string
  title: string
  multi?: boolean
  options: readonly { id: string; label: string; description?: string }[]
}
export type MarketQuestionPresentation = {
  binding: MarketResponseBinding
  steps: readonly MarketQuestionStep[]
  /** Durable display state only; an in-flight request is never restored. */
  state?: MarketQuestionViewState
}
export type MarketQuestionAnswer = {
  binding: MarketResponseBinding
  mode: 'selection' | 'delegate'
  rows: readonly { stepId: string; title: string; optionIds: readonly string[]; labels: readonly string[]; directText?: string }[]
  text: string
}
export type MarketQuestionViewState = {
  index: number
  picks: string[][]
  direct: boolean[]
  /** Optional for older saved cards. Draft only, never an execution instruction. */
  free?: string[]
  closed: boolean
  accepted: MarketQuestionAnswer | null
}
export type MarketQuestionActions = {
  busy?: boolean
  /** true only after the host accepts this exact answer. Rejection keeps picks. */
  submit?: (answer: MarketQuestionAnswer, signal: AbortSignal) => boolean | Promise<boolean>
  /** Focus the existing composer without replacing its draft. */
  write?: (binding: MarketResponseBinding, question: string) => boolean
  /** Publish a local interaction only after its durable state is accepted. */
  change?: (binding: MarketResponseBinding, state: MarketQuestionViewState) => boolean
}
export type MarketQuestionBlock = { id: string; kind: 'market-question'; presentation: MarketQuestionPresentation }
