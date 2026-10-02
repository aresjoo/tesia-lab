import type { CopyServiceDashboard, CopyServiceFollows, CopyServiceProfileData } from './client-copy-service-data'
import type { SharedStrategy, SharedPeriod, SharedLocation } from './client-shared-strategies'
import type { CopyTraderProfile, CopyTraderPeriod } from './client-copy-trader-profile'
import type { ClientStrategyCreatorProps } from './components/ClientStrategyCreator'
import type { ClientLanguage } from './client-preferences'
import type { SharedCopyRequest } from './client-shared-copy'

export type SharedMetricKey = 'ret' | 'score' | 'mdd' | 'pf' | 'hold' | 'n'
export type SharedScoreAxisKey = 'winRate' | 'cagr' | 'mdd' | 'tradeVol'
/** Display evidence only. Percent positions and contributions are supplied,
 * never normalized or inferred from the visible ranking by the frontend. */
export type SharedScoreAxis = {
  key: SharedScoreAxisKey
  valueLabel?: string
  contribution: number | null
  maximum: number | null
  barPercent: number | null
  benchmark?: { valueLabel: string; barPercent: number; comparisonLabel: string }
}
export type SharedMetricPresentation = {
  /** nick is the existing sharing route's strategy identifier, not a user ID. */
  strategyNick: string
  period: SharedPeriod
  revision: string
  sourceLabel: string
  score?: {
    value: number
    description?: string
    axes: readonly SharedScoreAxis[]
    notices?: readonly string[]
    criteria?: string
  }
  definitions?: readonly { key: SharedMetricKey; description: string; valueLabel?: string; sourceLabel?: string }[]
}

/** Bind only supplied evidence. A conflicting score cannot explain the score
 * badge currently shown to the reader. Definitions remain independently usable. */
export function bindSharingMetricDetails(data: SharedMetricPresentation | null | undefined, strategy: Pick<SharedStrategy, 'nick' | 'score'>, period: SharedPeriod): SharedMetricPresentation | null {
  if (!data || data.strategyNick !== strategy.nick || data.period !== period || typeof data.revision !== 'string' || !data.revision.trim()
    || typeof data.sourceLabel !== 'string' || !data.sourceLabel.trim()) return null
  const validScore = data.score && Number.isFinite(data.score.value) && data.score.value >= 0 && data.score.value <= 99
    && data.score.value === strategy.score && Array.isArray(data.score.axes)
  return { ...data, score: validScore ? data.score : undefined }
}

/** Frontend presentation inputs, not a wire/API contract or execution authority.
 * Every numeric result comes from the caller. Absence never invokes the preview
 * engine, nickname-derived metrics, a browser balance, or a synthetic fallback. */
export type SharingServicePresentation = {
  state: 'unavailable' | 'loading' | 'ready' | 'error'
  message?: string
  strategies: SharedStrategy[]
  periodResult: (strategy: SharedStrategy, period: SharedPeriod) => SharedStrategy['result'] | null
  /** Pure synchronous display read, called during render. No network/action side effects. */
  metricDetails?: (strategy: SharedStrategy, period: SharedPeriod) => SharedMetricPresentation | null
  indexToDate: (index: number) => Date
  entryPrice?: (entry: number) => number | null
  exitPrice?: (trade: SharedStrategy['result']['trades'][number]) => number | null
  watched: string[]
  onWatch?: (nick: string, watched: boolean) => Promise<void>
  onAnalyze?: (strategy: SharedStrategy, period: SharedPeriod) => Promise<void>
  shareUrl?: (location: SharedLocation) => string | null
  onValidateCopy?: (request: SharedCopyRequest) => Promise<{ score: number; result: SharedStrategy['result'] }>
  onCopy?: (request: SharedCopyRequest, followId?: string) => Promise<void>
  profile?: (strategy: SharedStrategy, period: CopyTraderPeriod) => CopyTraderProfile | null
  profileData?: (nick: string) => CopyServiceProfileData | null
  setup?: {
    asset?: string
    disclosure?: string
    availableBalance: number | null
    minimumAmount: number
    pairs: string[]
    advanced?: Partial<Record<'margin' | 'leverage' | 'slippage' | 'orderLimit' | 'positionLimit', string>>
    sharePercent: number | null
    onStart?: (input: { nick: string; amount: number; pairs: string[]; mode: 'ratio' }) => Promise<void>
  }
  creator?: Omit<ClientStrategyCreatorProps, 'renderPreview' | 'Dialog' | 'onNew' | 'loggedIn'>
  copyAccounts?: CopyServiceDashboard
  follows?: CopyServiceFollows
}

export function sharingUnavailable(language: ClientLanguage) {
  return ({ ko: '아직 제공되지 않은 정보입니다.', en: 'This information is not available yet.', ja: 'この情報はまだ提供されていません。', 'zh-CN': '此信息尚未提供。', 'zh-TW': '此資訊尚未提供。', es: 'Esta información todavía no está disponible.', fr: 'Ces informations ne sont pas encore disponibles.' })[language]
}

/** Never echo an adapter exception: it may contain a URL, credential or private payload. */
export function sharingActionFailed(language: ClientLanguage) {
  return ({ ko: '요청을 완료하지 못했어요. 내용을 확인하고 다시 시도해주세요.', en: 'The request could not be completed. Check your input and try again.', ja: 'リクエストを完了できませんでした。内容を確認して再試行してください。', 'zh-CN': '未能完成请求。请检查输入后重试。', 'zh-TW': '未能完成請求。請檢查輸入後重試。', es: 'No se pudo completar la solicitud. Revisa los datos e inténtalo de nuevo.', fr: 'La demande n’a pas pu être effectuée. Vérifiez votre saisie et réessayez.' })[language]
}

export const unavailableSharingPresentation: SharingServicePresentation = {
  state: 'unavailable', strategies: [], watched: [], periodResult: () => null,
  // Never reached without supplied rows. No synthetic calendar fallback.
  indexToDate: () => new Date(NaN),
}

/** Missing display values, never a calculated or persisted balance. */
export function unavailableTraderProfile(nick: string, period: CopyTraderPeriod, message: string): CopyTraderProfile {
  return { period, meta: { nick, days: NaN, share: NaN, copiers: NaN, cap: NaN, aum: NaN, total: NaN, lastTradeMin: NaN, bio: '' },
    performance: { roi: NaN, pnl: NaN, copiersPnl: NaN, winRate: NaN, mdd: NaN, wins: NaN, losses: NaN, n: NaN, eq: [] },
    trustNote: { w: 0, t: message }, mddNote: { w: 0, t: message }, weeklyBars: { available: false, bars: [] }, allocation: [] }
}
