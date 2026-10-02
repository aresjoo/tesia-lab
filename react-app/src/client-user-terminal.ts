/** Source-preview projection only; neither an account API nor execution authority. */
import { decodeSourceUserStrategyRecord, type SourceUserStrategyRecord } from './client-user-strategy'
import { evaluateSourceTerminal, type SourceTerminalEvaluation, type SourceTerminalSeed } from './client-terminal-source-fixture'

export type UserTerminalProjection = {
  record: SourceUserStrategyRecord
  id: string
  model: { seed: SourceTerminalSeed; result: SourceTerminalEvaluation } | null
}

/** Do not substitute the latest intake, a demo strategy, budget or BTC chart. */
export function projectUserTerminal(input: unknown): UserTerminalProjection | null {
  const record = decodeSourceUserStrategyRecord(input)
  if (!record) return null
  const id = `user:${record.id}`
  if (!record.parameters || record.capital === undefined || !record.asset) return { record, id, model: null }
  const seed: SourceTerminalSeed = {
    id, name: record.name, asset: record.asset,
    // The captured research has an explicit BTC/USDT identity. A display
    // currency preference must not rename its market or make it delegation.
    symbol: record.origin === 'research' && record.chartSymbol === 'BINANCE:BTCUSDT' ? 'BTC/USDT' : `${record.asset}/KRW`,
    market: `${record.origin === 'research' ? '연구 전략' : '위임 실행'} · ${record.environment === 'paper' ? '가상' : '시뮬레이션'}`,
    exchangeId: record.exchangeId ?? 'unlinked', version: record.version ?? '—', status: record.status,
    capital: record.capital, parameters: record.parameters,
  }
  try { return { record, id, model: { seed, result: evaluateSourceTerminal(seed.parameters, seed.capital) } } }
  catch { return { record, id, model: null } }
}
