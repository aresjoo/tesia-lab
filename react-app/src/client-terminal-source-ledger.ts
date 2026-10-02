/**
 * Source-preview ledger only: aresjoo/tesia-lab 42a0d81 tfTmPane /
 * tfTmTradeDlg. These derived orders, balances and lifecycle explanations are
 * synthetic source UI records, never exchange/account/API execution evidence.
 */
import { sourceTerminalDate, sourceTerminalPrices, type SourceTerminalSeed, type SourceTerminalEvaluation, type SourceTerminalParameters, type SourceTerminalTrade } from './client-terminal-source-fixture'
import type { ClientLanguage } from './client-preferences'
import { sharedNumber, sharedPercent } from './client-shared-number-format'
import { lifecycleText } from './client-trade-lifecycle-copy'

export type SourceTerminalModel = {
  seed: SourceTerminalSeed & { capitalShared?: boolean }
  result: SourceTerminalEvaluation
}
type Trade = SourceTerminalEvaluation['trades'][number]
export type SourceTerminalOrderRow = {
  id: string; strategyId: string; entryIndex: number; index: number
  side: 'BUY' | 'SELL'; type: string; price: number; quantity: number; fee: number
}
export type SourceTerminalAsset = {
  exchangeId: string; equity: number; used: number; available: number
  unrealized: number; strategyCount: number; shared: boolean
}
export type SourceTerminalLifecycleStep = { title: string; value: string; description: string }

/** Same YYYY-MM-DD calendar representation as sourceDay, without browser prefs. */
const day = (index: number) => {
  const date = sourceTerminalDate(index)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const exitTypes = { sl: '손절 STOP', tp: '익절 LIMIT', time: '기간 시장가' } as const

/** Shared presentation calculation for a supplied SOURCE simulation result.
 * Uses evaluated parameters, never a draft, quote, order type or API fill. */
export function sourceRuleExitPrice(p: Pick<SourceTerminalParameters, 'sl' | 'tp'>, trade: Pick<SourceTerminalTrade, 'entry' | 'exit' | 'kind'>): number {
  const entry = sourceTerminalPrices[trade.entry], exit = sourceTerminalPrices[trade.exit]
  if (!Number.isInteger(trade.entry) || !Number.isInteger(trade.exit) || !Number.isFinite(entry) || !Number.isFinite(exit)
    || !Number.isFinite(p.sl) || (trade.kind === 'tp' && (p.tp === null || !Number.isFinite(p.tp)))) throw new RangeError('Invalid source preview trade price')
  // Stop/target fills are the original rule price, not that day's close.
  return trade.kind === 'sl' ? entry * (1 + p.sl / 100)
    : trade.kind === 'tp' ? entry * (1 + p.tp! / 100) : exit
}

export function sourceTradeExitPrice(model: SourceTerminalModel, trade: Trade): number {
  return sourceRuleExitPrice(model.result.r.params, trade)
}

/** Keep original source order: strategy order, latest eight, then SELL→BUY. */
export function sourceTerminalOrderRows(models: readonly SourceTerminalModel[]): SourceTerminalOrderRow[] {
  return models.flatMap(model => model.result.trades.slice(-8).reverse().flatMap(trade => {
    const common = { strategyId: model.seed.id, entryIndex: trade.entry, quantity: trade.capB / sourceTerminalPrices[trade.entry], fee: trade.capB * .001 }
    return [
      { ...common, id: `${model.seed.id}:${trade.entry}:SELL`, index: trade.exit, side: 'SELL' as const, type: exitTypes[trade.kind], price: sourceTradeExitPrice(model, trade) },
      { ...common, id: `${model.seed.id}:${trade.entry}:BUY`, index: trade.entry, side: 'BUY' as const, type: '진입 시장가', price: sourceTerminalPrices[trade.entry] },
    ]
  }))
}

/** Caller passes ALL account-preview strategies; this view has no scope filter. */
export function sourceTerminalAssets(models: readonly SourceTerminalModel[]): SourceTerminalAsset[] {
  const groups = new Map<string, SourceTerminalAsset & { sharedCapitalCounted: boolean; sharedUsedCounted: boolean }>()
  for (const { seed, result } of models) {
    const exchangeId = seed.exchangeId || 'unlinked'
    let group = groups.get(exchangeId)
    if (!group) {
      group = { exchangeId, equity: 0, used: 0, available: 0, unrealized: 0, strategyCount: 0, shared: false, sharedCapitalCounted: false, sharedUsedCounted: false }
      groups.set(exchangeId, group)
    }
    if (seed.capitalShared) {
      if (!group.sharedCapitalCounted) { group.equity += seed.capital; group.sharedCapitalCounted = true }
      group.equity += result.pnl
    } else group.equity += result.nav
    if (seed.status === 'live' && result.pos) {
      group.unrealized += result.pos.krw
      if (!seed.capitalShared || !group.sharedUsedCounted) group.used += seed.capital
      if (seed.capitalShared) group.sharedUsedCounted = true
    }
    group.strategyCount++
    if (seed.capitalShared) group.shared = true
  }
  return [...groups.values()].map(group => ({ exchangeId: group.exchangeId, equity: group.equity, used: group.used,
    available: group.equity - group.used, unrealized: group.unrealized, strategyCount: group.strategyCount, shared: group.shared }))
}

export function sourceTerminalLifecycle(model: SourceTerminalModel, entryIndex: number, money: (value: number, signed?: boolean) => string, language: ClientLanguage = 'ko'): readonly SourceTerminalLifecycleStep[] | null {
  const trade = model.result.trades.find(item => item.entry === entryIndex)
  if (!trade) return null
  const p = model.result.r.params
  // Match the event identity, like SourceCompleted. A partial read must never
  // attach a different observation just because its array offset happens to fit.
  const entered = model.result.L.evs.find(event => event.i === trade.entry), exited = model.result.L.evs.find(event => event.i === trade.exit)
  const managedBars = Math.max(0, trade.exit - trade.entry - 1)
  const exitPrice = sourceTradeExitPrice(model, trade)
  const t = (key: Parameters<typeof lifecycleText>[1], values?: Readonly<Record<string, string>>) => lifecycleText(language, key, values)
  const returnPct = sharedPercent(trade.pnl * 100, language)
  return [
    { title: t('entryDecision'), value: day(trade.entry), description: entered?.txt ?? t('conditionsMet') },
    { title: t('orderCreated'), value: t('marketBuy', { quantity: sharedNumber(trade.capB / sourceTerminalPrices[trade.entry], language, 4) }), description: t('validated') },
    { title: t('fill'), value: money(sourceTerminalPrices[trade.entry]), description: t('filled') },
    { title: t('positionManagement'), value: t(managedBars === 1 ? 'heldBar' : 'heldBars', { bars: sharedNumber(managedBars, language, 0) }), description: managedBars ? t('managing', { stop: sharedNumber(p.sl, language, 'auto'), target: p.tp != null ? t('target', { target: sharedNumber(p.tp, language, 'auto') }) : '' }) : t('immediateExit') },
    { title: t('exitDecision'), value: day(trade.exit), description: exited?.txt ?? t('ruleExecuted') },
    { title: t('exitFill'), value: money(exitPrice), description: t(({ sl: 'stopFill', tp: 'targetFill', time: 'closeFill' } as const)[trade.kind]) },
    { title: t('finalResult'), value: `${money(trade.krw, true)} (${returnPct})`, description: t('fees', { fee: sharedNumber(.2, language) }) },
  ]
}
