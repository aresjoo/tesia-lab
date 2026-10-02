/** Display-only facts supplied by an owner-bound caller. Not an API, entitlement,
 * financial calculator, simulation producer, or order permission. Unknown is null. */
import type { BotStrategyEditPresentation } from './client-bot-strategy-edit-presentation'
export type AccountViewTone = '' | 'gain' | 'loss'
export type AccountAlertsFilter = 'all' | 'pos' | 'bot' | 'review' | 'rebate'
export type AccountViewIcon = 'link' | 'trend' | 'card' | 'chip' | 'won' | 'bell' | 'warn' | 'doc' | 'star' | 'chat' | 'send' | 'mail'
export type AccountViewAction = { id: string; label: string; tone?: 'pri' | 'sec' | 'out' | 'dng'; route?: string }
export type AccountViewRow = { id: string; label: string; description?: string; value: string; tone?: AccountViewTone; icon?: AccountViewIcon; route?: string }
export type AccountViewMetric = { label: string; value: string; description?: string; badge?: string; tone?: AccountViewTone; barPercent?: number }
export type AccountViewHero = { title: string; badge?: string; label: string; value: string; unit?: string; description?: string; tone?: AccountViewTone }
export type AccountPlanPresentation = {
  title: string
  sourceLabel: string
  status: null | {
    hero: AccountViewHero
    badgeTone?: 'blue' | 'pro' | 'danger' | 'warn'
    gauge: null | { percent: number; style?: 'inf' | 'warn' | 'empty'; left: string; right: string }
    details: readonly AccountViewRow[] | null
    actions: readonly AccountViewAction[]
    footer?: string
  }
  rebates: null | { hero: AccountViewHero; metrics: readonly AccountViewMetric[]; history: readonly AccountViewRow[] | null; historyLabel?: string; actions: readonly AccountViewAction[] }
  /** Switch color is an explicit presentation fact, never inferred from a channel ID or name. */
  preferences: readonly { id: string; title: string; badge?: string; footer?: string; rows: readonly { id: string; label: string; description?: string; icon?: AccountViewIcon; checked: boolean | null; disabled?: boolean; badge?: string; switchTone?: 'default' | 'green'; /** Explicit UI observation; never inferred from ID or label. */ sourceNotification?: { topic: 'fill' | 'state' | 'risk' | 'copy' | 'bill' | 'news'; channel: 'push' | 'email' } }[] }[] | null
}
export type AccountReviewPresentation = {
  id: string
  hero: AccountViewHero
  sourceLabel: string
  reportAction?: AccountViewAction
  chips: readonly { label: string; value: string; tone?: AccountViewTone }[]
  causes: readonly { id: string; title: string; text: string; tag: string; tone?: 'e' | 'x' | 'r' | 'g'; icon?: AccountViewIcon }[] | null
  evidenceLabel?: string
  actions: readonly AccountViewAction[]
}
export type AccountPeriodicPresentation = {
  id: string
  hero: AccountViewHero
  sourceLabel: string
  dateLabel: string
  ring: { percent: number; label: string } | null
  metrics: readonly AccountViewMetric[]
  reviews: readonly AccountViewRow[] | null
  reviewsLabel?: string
  actions: readonly AccountViewAction[]
}
export type AccountAlertsPresentation = {
  rows: readonly { id: string; type: 'credit' | 'pos' | 'bot' | 'review' | 'rebate' | 'report' | 'bill'; title: string; body?: string; timeLabel: string; read: boolean; route?: string; move?: { label: string; tone: AccountViewTone } }[] | null
}
export type AccountBotPresentation = {
  edit?: BotStrategyEditPresentation
  id: string
  title: string
  sourceLabel: string
  environment: { label: string; key?: 'paper' | 'live' | 'off' | 'ready' }
  origin?: string
  notice?: string
  actions: readonly AccountViewAction[]
  score: null | { value: string; percent: number; badge?: string; rank: string; description?: string }
  returnMetric: AccountViewMetric | null
  drawdownMetric: AccountViewMetric | null
  equity: null | { title: string; sourceLabel: string; description: string; tone: AccountViewTone; points: readonly { label: string; value: number }[] }
  orders: readonly AccountViewRow[] | null
  ordersLabel?: string
  position: null | { title: string; description?: string; badge?: string; checks: readonly string[] }
  execution: readonly AccountViewRow[] | null
  log: null | { sourceLabel: string; summary: readonly AccountViewMetric[]; rows: readonly { id: string; timeLabel: string; type: 'watch' | 'entry' | 'exit' | 'exit_sl' | 'exit_tp' | 'exit_time'; tag: string; text: string }[] }
}
export type AccountPresentationActions = {
  isActionAvailable?: (id: string) => boolean
  /** UI destination availability only, not authorization. Omission preserves
   * existing preview navigation; callers still enforce owner/lifetime guards. */
  canNavigate?: (route: string) => boolean
  onNavigate?: (route: string) => void
  onAction?: (id: string) => void | Promise<void>
  onPreference?: (id: string, checked: boolean) => void | Promise<void>
}
