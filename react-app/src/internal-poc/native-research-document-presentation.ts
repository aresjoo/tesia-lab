/** Frontend presentation inputs only; these are NOT HTTP, execution or approval contracts.
 * All financial text, dates, findings and grades must come from the owning adapter.
 * The renderer neither calculates results nor grants execution authority.
 */
import type { ResearchPriceWindow, ResearchEquityWindow } from './native-research-chart-presentation'

export type ResearchDocumentTone = 'neutral' | 'positive' | 'warning' | 'negative'
export type ResearchDocumentValue = { text: string; tone?: ResearchDocumentTone }
export type ResearchDocumentAction = () => Promise<void>
export type ResearchDocumentRow = { id: string; label: string; value: string; onComment?: (comment: string) => Promise<void> }
export type ResearchDocumentFinding = { title: string; plain: string; meaning: string; nextAction: string; tone?: ResearchDocumentTone }
export type ResearchDocumentMetrics = {
  return?: ResearchDocumentValue; drawdown?: ResearchDocumentValue; winRate?: ResearchDocumentValue
  trades?: ResearchDocumentValue; profitFactor?: ResearchDocumentValue
}
type Envelope<K extends string, D> = {
  id: string; kind: K; title?: string; state: 'unavailable' | 'loading' | 'ready' | 'error'; statusLabel?: string; data?: D
  /** Supplied content revision, not a strategy approval/hash. Replacing it
   * retires local drafts and ignores async actions from the previous document. */
  revision?: string
}
export type HypothesisDocumentData = { professional: string; plain: string; criteria: string }
export type StrategyDocumentData = {
  versionLabel?: string; description?: string
  entry?: ResearchDocumentRow; stopLoss?: ResearchDocumentRow; takeProfit?: ResearchDocumentRow
  maxHolding?: ResearchDocumentRow; costs?: ResearchDocumentRow
}
export type BacktestDocumentData = {
  versionLabel?: string; description?: string; metrics: ResearchDocumentMetrics
  years: readonly { id: string; year: string; pnl: ResearchDocumentValue; trades: string; winRate: string }[]
  drawdownExplanation?: string; priceDescription?: string; equityDescription?: string
  chart?: { versionIdentity: string; prices?: ResearchPriceWindow | null; equity?: ResearchEquityWindow | null }
}
export type CriticDocumentData = {
  builder: string; critic: string; verdict: string; verdictTone?: ResearchDocumentTone; finding?: ResearchDocumentFinding
}
export type StressDocumentData = {
  description?: string; scenarios: readonly { id: string; name: string; result: string; verdict: ResearchDocumentValue }[]
}
export type HoldoutDocumentData = {
  description?: string
  annualizedReturn?: { research: string; holdout: string }
  drawdown?: { research: string; holdout: string }
  trades?: { research: string; holdout: string }
  assessment?: { kind: 'finding'; finding: ResearchDocumentFinding } | { kind: 'note'; text: string }
}
export type ResearchWhatIfResult = { title: string; summary: string; metrics?: ResearchDocumentMetrics }
export type ResearchWhatIfChoice = { id: string; label: string; onRun?: () => Promise<ResearchWhatIfResult> }
export type ReportDocumentData = {
  strategyName: string; description?: string; verdict?: { summary: string; grade: ResearchDocumentValue }
  metrics: { researchReturn?: ResearchDocumentValue; holdoutReturn?: ResearchDocumentValue; drawdown?: ResearchDocumentValue; profitFactor?: ResearchDocumentValue }
  evidence: readonly { id: string; text: string; status: 'confirmed' | 'warning' | 'unknown'; documentId?: string }[]
  disagreement?: { opinions: readonly { id: string; author: string; verdict: string }[]; explanation: string }
  integrity?: { summary: string; conclusion?: string }
  unknowns?: string
  whatIf?: readonly ResearchWhatIfChoice[]
  connectDocumentId?: string; activityDocumentId?: string
}
export type ConnectDocumentData = {
  primaryLabel?: string; partnerLabel?: string; onConnect?: ResearchDocumentAction; onPartner?: ResearchDocumentAction
  permissions?: { balancesAndQuotes: boolean | null; orders: boolean | null; withdrawals: boolean | null }
  disclosure?: string
}
export type RunDocumentData = {
  description?: string; strategy?: ResearchDocumentRow; conditions?: ResearchDocumentRow
  stopAndTarget?: ResearchDocumentRow; capital?: ResearchDocumentRow; verification?: ResearchDocumentRow
  disclosure?: string; paperLabel?: string; liveLabel?: string
  onPaper?: ResearchDocumentAction; onLive?: ResearchDocumentAction
}
export type LiveDocumentData = {
  strategyName: string; modeLabel: string; status: 'active' | 'paused' | 'stopped' | 'unavailable'; statusLabel: string
  broker?: string; summary?: string
  activity: readonly { id: string; time: string; type: string; quantity: string; pnl: ResearchDocumentValue }[]
  realityCheck?: readonly { id: string; label: string; assumed: string; observed: string; verdict: ResearchDocumentValue }[]
  onOpenTrading?: () => void; onPause?: ResearchDocumentAction; onResume?: ResearchDocumentAction; onStop?: ResearchDocumentAction
}
export type NativeResearchDocumentPresentation =
  | Envelope<'hypothesis', HypothesisDocumentData>
  | Envelope<'strategy', StrategyDocumentData>
  | Envelope<'backtest', BacktestDocumentData>
  | Envelope<'critic', CriticDocumentData>
  | Envelope<'stress', StressDocumentData>
  | Envelope<'holdout', HoldoutDocumentData>
  | Envelope<'report', ReportDocumentData>
  | Envelope<'connect', ConnectDocumentData>
  | Envelope<'run', RunDocumentData>
  | Envelope<'live', LiveDocumentData>
