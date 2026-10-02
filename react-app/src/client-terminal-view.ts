/** Presentation input only. No API contract, execution authority or calculations. */
export type ClientTerminalStrategy = {
  id: string
  name: string
  symbol: string
  market: string
  version: string
  status: 'live' | 'off' | 'ready' | 'err'
  exchange: { id: string; name: string; color: string; foreground?: string }
  capitalLabel: string
  pnlLabel?: string
  pnlPercentLabel?: string
  pnlTone?: 'up' | 'dn' | 'zz'
  /** Explicit financial provenance from the owner, never inferred from status. */
  pnlKind?: 'validation'
  sharedCapital?: boolean
  error?: string
}
