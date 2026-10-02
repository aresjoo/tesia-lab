/** UI form values only, never a Strategy AST, approval receipt or execution grant.
 * Percent fields use percentage points (-5 means -5%, NOT -0.05).
 */
export type BotStrategyEditParameters = {
  stopLossPercent: number
  takeProfitPercent: number | null
  rsiThreshold: number
  trendFilter: boolean
}
export type BotStrategyEditInput = {
  strategyId: string
  revision: string
  /** Local correlation only; never an approval/version identifier. */
  inputIdentity: string
  parameters: BotStrategyEditParameters
}
export type BotStrategyEditValidation = BotStrategyEditInput & {
  /** Display observation from the parent; not order/approval authority. */
  confirmed: boolean
  verdict: 'pending' | 'passed' | 'failed'
  scoreLabel?: string
  returnLabel?: string
  drawdownLabel?: string
  tradesLabel?: string
  sourceLabel?: string
}
export type BotStrategyEditApplication = BotStrategyEditInput & {
  status: 'pending' | 'applied' | 'failed'
  message?: string
}
export type BotStrategyEditPresentation = {
  /** Existing source CTA identifier in AccountBotPresentation.actions. */
  actionId: string
  strategyId: string
  /** Retire the editor when its underlying strategy observation changes. */
  revision: string
  initial: BotStrategyEditParameters
  /** Only supply same-period/automatic-pause promises if actually guaranteed. */
  notice?: string
  validation?: BotStrategyEditValidation | null
  application?: BotStrategyEditApplication | null
  onValidate?: (input: BotStrategyEditInput) => Promise<void>
  onApply?: (input: BotStrategyEditInput) => Promise<void>
}

export function sameBotEditParameters(a: BotStrategyEditParameters, b: BotStrategyEditParameters): boolean {
  return !!a && !!b && a.stopLossPercent === b.stopLossPercent && a.takeProfitPercent === b.takeProfitPercent
    && a.rsiThreshold === b.rsiThreshold && a.trendFilter === b.trendFilter
}

export function sameBotEditInput(a: BotStrategyEditInput | null | undefined, b: BotStrategyEditInput | null | undefined): boolean {
  return !!a && !!b && a.strategyId === b.strategyId && a.revision === b.revision
    && a.inputIdentity === b.inputIdentity && sameBotEditParameters(a.parameters, b.parameters)
}
