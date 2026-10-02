/** Source-language summaries of the same preview ledger, not AI reasoning or
 * execution evidence. Kept in the worker; no extra price data sent to the UI. */
import { catalogueTitle, catalogueUniverses } from './client-catalogue'
import { catalogueDateReader } from './client-catalogue-presentation'
import type { CatalogueMarketData } from './client-catalogue-market-data'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import { createJudgmentRuntime, type SourceJudgment } from './client-catalogue-judgment-source.mjs'

export type CatalogueJudgment = Omit<SourceJudgment, 'tag'> & { fillIndex?: number; pnl?: number }
export function catalogueJudgments(value: Pick<CataloguePreviewResult, 'strategy' | 'calendar' | 'result' | 'calculation'>, data: CatalogueMarketData): CatalogueJudgment[] {
  const { strategy, result } = value
  const runtime = createJudgmentRuntime({ prices: asset => data.prices(asset), date: catalogueDateReader(value.calendar), length: result.params.endI + 1, universes: catalogueUniverses, symbol: catalogueTitle })
  // Original introduction dates precede indicator warmup. Restarted runs use
  // their own start; neither is represented as an executed order date.
  const source = { ...strategy, cfg: { ...strategy, startI: value.calculation === 'restart-run' ? result.params.startI : strategy.startI }, r: result }
  const events = [...result.events].reverse()
  return runtime.messages(source, result).map(message => {
    const event = events.find(e => e.i === message.i && e.a === message.a && (message.k === 'buy' ? e.t === 'enter' : message.k === 'sell' ? e.t === 'exit' : false))
    if (!Number.isSafeInteger(message.i) || message.i < (message.k === 'intro' ? strategy.startI : result.params.startI) || message.i > result.params.endI || /undefined|NaN|Infinity/.test(message.t)) throw Error('catalogue judgment: invalid source summary')
    // The spot ledger schedules fills for the next open session. The inherited
    // rule sentence describes a same-day signal, not a same-day executed sale.
    // Reuse source fuCost's explicit assumption rather than implying that the
    // fixed preview fee is a dynamically supplied account fee.
    const text = strategy.fut
      ? message.t.replaceAll('수수료와 펀딩비는 실제 값으로 반영합니다.', '수수료는 체결 금액의 0.055%, 펀딩비는 실제 기록대로 내거나 받습니다.')
      : message.t.replaceAll('재평가를 기다리지 않고 당일 매도합니다.', '재평가를 기다리지 않고 매도 신호를 냅니다.')
    return { i: message.i, k: message.k, a: message.a, t: text, title: message.title, cnt: message.cnt, from: message.from, fillIndex: event?.xi, pnl: message.k === 'sell' ? event?.pnl : undefined }
  })
}
