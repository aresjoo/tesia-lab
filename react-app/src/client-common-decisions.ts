/** Presentation over the existing public fixture. No strategy execution or AI
 * decision authority is created here. Closed outcomes are separate from facts
 * that were observable on the event date. */
import { sourceTerminalPrices, sourceTerminalRsi, sourceTerminalSma, sourceTerminalDate, type SourceTerminalEvaluation } from './client-terminal-source-fixture'

export type CommonDecisionKind = 'buy' | 'sell' | 'watch' | 'holdingDecision'
export type CommonDecisionFilter = CommonDecisionKind | 'allRecords'
export type CommonDecisionSort = 'new' | 'old' | 'big'
export const commonDecisionFilters: readonly CommonDecisionFilter[] = ['buy', 'sell', 'watch', 'holdingDecision', 'allRecords']

export function commonDecisionRows(evaluation: SourceTerminalEvaluation) {
  const outcomes = new Map(evaluation.trades.flatMap(trade => [[trade.entry, trade], [trade.exit, trade]] as const))
  return evaluation.L.evs.map(event => ({
    event,
    kind: (event.k === 'entry' ? 'buy' : event.k.startsWith('exit') ? 'sell' : event.k === 'watch' ? 'watch' : 'holdingDecision') as CommonDecisionKind,
    // Facts end on this day; never use a later value for a decision's reasoning.
    price: sourceTerminalPrices[event.i],
    rsi: sourceTerminalRsi(event.i - 1),
    change: (sourceTerminalPrices[event.i] / sourceTerminalPrices[event.i - 1] - 1) * 100,
    trendGap: Math.abs((sourceTerminalSma(event.i, 20) ?? 0) - (sourceTerminalSma(event.i, 60) ?? 0)) / sourceTerminalPrices[event.i] * 100,
    outcome: outcomes.get(event.i),
  }))
}
export type CommonDecisionRow = ReturnType<typeof commonDecisionRows>[number]
/** Only adjacent holding days within one month may share a summary. */
export function commonHoldingGroups(rows: readonly CommonDecisionRow[]) {
  const groups: CommonDecisionRow[][] = []
  for (const row of rows) {
    const previous = groups.at(-1), last = previous?.at(-1)
    const date = sourceTerminalDate(row.event.i), lastDate = last && sourceTerminalDate(last.event.i)
    if (row.kind === 'holdingDecision' && last?.kind === 'holdingDecision' && Math.abs(row.event.i - last.event.i) === 1
      && date.getFullYear() === lastDate!.getFullYear() && date.getMonth() === lastDate!.getMonth()) previous!.push(row)
    else groups.push([row])
  }
  return groups.filter(group => group.length > 1)
}
export function selectCommonDecisions(rows: readonly CommonDecisionRow[], filter: CommonDecisionFilter, sort: CommonDecisionSort) {
  const selected = rows.filter(row => filter === 'allRecords' || row.kind === filter)
  const impact = (row: CommonDecisionRow) => row.outcome ? Math.abs(row.outcome.pnl) : -1
  return selected.sort((a, b) => sort === 'old' ? a.event.i - b.event.i : sort === 'big' ? impact(b) - impact(a) || b.event.i - a.event.i : b.event.i - a.event.i)
}
