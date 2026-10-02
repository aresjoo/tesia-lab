/** Display ports only, not wire/API schemas or trading authority.
 * Amounts, grades, periods and public decision explanations are supplied verbatim.
 * Lists are supplied newest first; the view preserves their order, showing at most
 * 25 dashboard rows and 12 completed cards without inferring missing history.
 */
export type NativeTerminalValue = { text: string; tone?: 'up' | 'dn' | 'zz' }
export type NativeTerminalNavPoint = {
  /** Observed Unix timestamp in milliseconds. Never a fixture bar index. */
  time: number; value: number; timeLabel?: string; valueLabel?: string
}
export type NativeTerminalEquity = {
  points: readonly NativeTerminalNavPoint[]
  description: string
  baseline?: number
  tone?: 'up' | 'dn' | 'zz'
  rangeLabel?: string; startLabel?: string; endLabel?: string
}
export type NativeTerminalPosition =
  | { state: 'unavailable'; description?: string }
  | { state: 'empty'; description?: string }
  | {
    state: 'available'; id: string; side: string; symbol: string
    pnl?: NativeTerminalValue; pnlPercent?: NativeTerminalValue
    entryPrice?: string; currentPrice?: string; quantity?: string; stopPrice?: string; targetPrice?: string; holding?: string
    description?: string
  }
export type NativeTerminalTrade = {
  id: string; exitDate: string; exitReason: string; entryPrice?: string; exitPrice?: string; holding?: string
  pnl?: NativeTerminalValue
  /** Public supplied explanations only. Do not pass private model reasoning. */
  whyEntered?: string; whyExited?: string
  side?: string; symbol?: string; pnlPercent?: NativeTerminalValue; fee?: string; entryDate?: string
}
export type NativeTerminalDashboardData = {
  sourceLabel?: string
  summary?: {
    capital?: NativeTerminalValue; nav?: NativeTerminalValue; navLabel?: string
    totalPnl?: NativeTerminalValue; totalPnlPercent?: NativeTerminalValue
    realized?: NativeTerminalValue; unrealized?: NativeTerminalValue; fees?: NativeTerminalValue; feeDescription?: string
  }
  equity?: NativeTerminalEquity | null
  performance?: {
    winRate?: NativeTerminalValue; drawdown?: NativeTerminalValue; profitFactor?: NativeTerminalValue; sharpe?: NativeTerminalValue
    averageHolding?: NativeTerminalValue; marketExposure?: NativeTerminalValue; tradeCount?: NativeTerminalValue
    maxGain?: NativeTerminalValue; maxLoss?: NativeTerminalValue
  }
  position?: NativeTerminalPosition
  recentTrades?: readonly NativeTerminalTrade[] | null
}
export type NativeTerminalCompletedData = {
  sourceLabel?: string
  /** e.g. supplied coverage/total; the renderer never treats a page length as total. */
  rangeLabel?: string
  trades: readonly NativeTerminalTrade[] | null
}
export type NativeTerminalTradeOpen = (tradeId: string, trigger: HTMLElement) => void
export type NativeTerminalDashboardProps = {
  scopeId: string; strategyId: string; strategyName: string; version?: string
  data?: NativeTerminalDashboardData | null
  onOpenTrade?: NativeTerminalTradeOpen
  /** Optional row-level availability; a missing record must not enable other rows. */
  canOpenTrade?: (tradeId: string) => boolean
  onOpenPosition?: (positionId: string, trigger: HTMLElement) => void
  onOpenVersions?: (trigger: HTMLElement) => void
}
export type NativeTerminalCompletedProps = {
  scopeId: string; strategyId: string; strategyName: string
  data?: NativeTerminalCompletedData | null
  onOpenTrade?: NativeTerminalTradeOpen
  canOpenTrade?: (tradeId: string) => boolean
}
