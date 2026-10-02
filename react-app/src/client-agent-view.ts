/** UI projection only. Callers supply public evidence, never execution authority. */
export type ClientRuleCheck = {
  /** Historical index is only used to describe the span of a watch group. */
  barIndex: number
  rows: readonly { label: string; value: string; state: 'ok' | 'no' | 'hit' | 'na' | 'unknown' }[]
  outputs: readonly { label: string; text: string; tone?: 'up' | 'dn' | 'zz' }[]
  /** This display type is not an API schema or an order intent. */
  provenance: string
}

export type ClientAgentEvent = {
  id: string
  type: 'entry' | 'exit-tp' | 'exit-sl' | 'exit-time' | 'watch' | 'risk' | 'scan'
  timeLabel: string
  text: string
  /** Caller-provided public summary, not a model's private reasoning or a generated trade instruction. */
  summary?: string
  ruleCheck?: ClientRuleCheck
  detail?: {
    settings: readonly { label: string; value: string }[]
    rawSettings?: string
    analysis: readonly { title: string; text: string }[]
    ticket?: {
      signal: 'BUY' | 'CLOSE' | 'HOLD'
      title: string
      symbol: string
      fields: readonly { label: string; value: string }[]
      justification?: string
      invalidation?: string
    }
  }
}

export type ClientAgentOperation = {
  id: string
  timeLabel: string
  label: string
  text: string
  version?: string
  diff?: string
}
