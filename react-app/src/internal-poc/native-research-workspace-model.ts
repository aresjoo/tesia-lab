import type { ReactNode } from 'react'
import type { ResearchObservedLogEntry } from '../components/ClientResearchLog'
import type { NativeResearchDocumentPresentation } from './native-research-document-presentation'

/** Presentation inputs only. No API schema, model reasoning or task producer. */
export type NativeResearchStatus = 'unavailable' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped'
export type NativeResearchDocument = { id: string; title: string; content: ReactNode; statusLabel?: string }
export type NativeResearchTeamMember = {
  id: string
  name: string
  status: 'unavailable' | 'waiting' | 'working' | 'done' | 'failed'
  statusLabel?: string
}
export type NativeResearchView = { activeDocumentId: string; openDocumentIds: readonly string[] }
/** Local dispatch location, not server-supplied document context or evidence. */
export type NativeResearchThreadOrigin = { scopeId: string; documentId: string }
/** Stable per-document message identity. Array order is supplied observation order;
 * updating content does not create a new event or authoritative timestamp. */
export type NativeResearchThreadEntry = { id: string; content: ReactNode }
/** Observed Activity follow-up only; completed is not evidence of profitability.
 * Revision changes invalidate pending UI actions. Parent owns state transitions.
 */
export type NativeResearchCompletionPresentation = {
  kind: 'completed'
  revision: string
  summary?: {
    completedStages?: number
    strategyRevisions?: number
    backtests?: number
    holdout?: 'passed' | 'warning'
  }
  reportDocumentId?: string
} | {
  kind: 'stopped'
  revision: string
  /** Observed reason verbatim; do not assume refresh/restart semantics. */
  reason?: string
  planDocumentId?: string
  /** Resolution acknowledges the request, not the resumption of research. */
  onResume?: () => Promise<void>
}
export type NativeResearchWorkspaceProps = {
  /** Parent must scope all supplied content and controlled navigation to this identity. */
  scopeId: string
  title: string
  /** Existing conversation metadata editor; no research/strategy mutation. */
  titleEditor?: ReactNode
  onBack: () => void
  strategyDocument?: ReactNode
  documents?: readonly NativeResearchDocument[]
  /** Original document bodies backed by explicit observations, not fixture producers. */
  typedDocuments?: readonly NativeResearchDocumentPresentation[]
  entries?: readonly ResearchObservedLogEntry[]
  status?: NativeResearchStatus
  statusLabel?: string
  team?: readonly NativeResearchTeamMember[]
  hypothesis?: ReactNode
  critic?: ReactNode
  completion?: ReactNode
  completionPresentation?: NativeResearchCompletionPresentation
  /** Visible recovery controls for the same controller, not a second request owner. */
  notice?: ReactNode
  /** Slots retain their DOM/controller when navigating documents or full chart. */
  analysis?: ReactNode
  analysisOpen?: boolean
  /** Shell visibility for bounded chart resources; does not cancel research. */
  visible?: boolean
  onOpenAnalysis?: () => void
  onCloseAnalysis?: () => void
  view?: NativeResearchView
  onViewChange?: (view: NativeResearchView) => void
  composer?: ReactNode
  composerHasContext?: boolean
  /** Existing conversation controller messages grouped by their exact dispatch location. */
  threadForDocument?: (id: string) => ReactNode
  /** Structured alternative for interleaving messages with successful What-if results.
   * Opaque legacy content remains supported, but cannot provide per-event order. */
  threadEntriesForDocument?: (id: string) => readonly NativeResearchThreadEntry[]
  threadActivity?: { documentId: string; messageId: string; userSubmitted: boolean }
}

export const RESEARCH_DOCUMENT_SURFACES = [
  { id: 'plan', title: 'Research Plan' }, { id: 'activity', title: 'Activity' },
  { id: 'hypo', title: 'Hypothesis' },
  { id: 'strat1', title: 'Strategy v1' }, { id: 'bt1', title: 'Backtest v1' },
  { id: 'critic', title: 'Critic Review' },
  { id: 'strat2', title: 'Strategy v2' }, { id: 'bt2', title: 'Backtest v2' },
  { id: 'stress', title: 'Stress Test' }, { id: 'holdout', title: 'Holdout Test' },
  { id: 'report', title: 'Final Report' },
  { id: 'connect', title: '거래소 연결' }, { id: 'run', title: '실행 확인' },
  { id: 'live', title: 'Live' },
] as const

export const RESEARCH_ROLE_SURFACES = [
  'Strategy Architect', 'Quant Validator', 'Sanity Check', 'Strategy Critic',
  'Risk Reviewer', 'Market Context', 'Explanation',
] as const

export const RESEARCH_DOCUMENT_KINDS = {
  hypo: 'hypothesis', strat1: 'strategy', strat2: 'strategy', bt1: 'backtest', bt2: 'backtest',
  critic: 'critic', stress: 'stress', holdout: 'holdout', report: 'report',
  connect: 'connect', run: 'run', live: 'live',
} as const satisfies Record<string, NativeResearchDocumentPresentation['kind']>

export function researchView(view: NativeResearchView | undefined, documentIds: readonly string[]): NativeResearchView {
  const allowed = new Set(documentIds)
  const activeDocumentId = view && allowed.has(view.activeDocumentId) ? view.activeDocumentId : 'plan'
  const openDocumentIds = [...new Set((view?.openDocumentIds ?? ['plan', 'activity']).filter(id => allowed.has(id)))]
  if (!openDocumentIds.includes(activeDocumentId)) openDocumentIds.push(activeDocumentId)
  return { activeDocumentId, openDocumentIds }
}

/** Mirrors original gTabAdd's five visible tabs; never removes document data. */
export function openResearchDocument(view: NativeResearchView, id: string): NativeResearchView {
  const openDocumentIds = [...view.openDocumentIds]
  if (!openDocumentIds.includes(id)) {
    openDocumentIds.push(id)
    if (openDocumentIds.length > 5) openDocumentIds.splice(1, 1)
  }
  return { activeDocumentId: id, openDocumentIds }
}
