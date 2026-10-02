/** Client 42a0d81 tfBotView display adapter, not a service strategy/execution contract.
 * Missing user records/parameters remain missing: demo strategies are never substitutes.
 */
import type { SourceTerminalParameters } from './client-terminal-source-fixture'

/** Display threshold only. The eager decoder never loads prices or evaluates. */
export const SOURCE_USER_STRATEGY_PASS_SCORE = 80

export type SourceUserStrategyRecord = Readonly<{
  id: string; name: string; createdAt: number; status: 'ready' | 'off' | 'live'
  environment: 'paper' | 'live'; parameters: SourceTerminalParameters | null
  /** Stored validation snapshot: percentage points, not return ratios. */
  score: number; ret: number; mdd: number; n: number; winRate: number
  origin?: string; exchangeName?: string
  /** Creation-time source asset/ex/tv/cap/ver snapshots. Missing legacy values
   * must never be filled from another session's current intake or connection.
   * capital is the source's KRW reference basis, not a live account balance.
   */
  asset?: string; exchangeId?: string; chartSymbol?: string | null; capital?: number; version?: string
}>

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function timestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15
}
export function isSourceUserStrategyId(id: unknown): id is string {
  return typeof id === 'string' && /^(0|[1-9]\d*)$/.test(id) && timestamp(Number(id)) && String(Number(id)) === id
}
function numberIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}
function optionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string'
}
function optionalSnapshotText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string' && value.trim().length > 0
}
export function decodeSourceUserStrategyParameters(value: unknown): SourceTerminalParameters | null {
  if (!object(value) || !numberIn(value.sl, -100, 0) || value.sl === -100 || value.sl === 0
    || value.tp !== null && !numberIn(value.tp, Number.MIN_VALUE, Number.MAX_VALUE)
    || !numberIn(value.rsiTh, 0, 100) || typeof value.trendFilter !== 'boolean') return null
  for (const key of ['startI', 'endI'] as const) if (value[key] != null && (typeof value[key] !== 'number' || !Number.isSafeInteger(value[key]))) return null
  return Object.freeze({ sl: value.sl, tp: value.tp as number | null, rsiTh: value.rsiTh, trendFilter: value.trendFilter,
    ...(value.startI !== undefined ? { startI: value.startI as number | null } : {}),
    ...(value.endI !== undefined ? { endI: value.endI as number | null } : {}),
  })
}
/** Typed preview decoder, not a backend schema. Window bounds are checked by the lazy engine. */
export function decodeSourceUserStrategyRecord(input: unknown): SourceUserStrategyRecord | null {
  if (!object(input) || !isSourceUserStrategyId(input.id) || !timestamp(input.createdAt) || input.id !== String(input.createdAt)
    || typeof input.name !== 'string' || !input.name.trim()
    || typeof input.status !== 'string' || !['ready', 'off', 'live'].includes(input.status)
    || typeof input.environment !== 'string' || !['paper', 'live'].includes(input.environment)
    || !numberIn(input.score, 0, 100) || !numberIn(input.ret, -100, Number.MAX_VALUE)
    || !numberIn(input.mdd, -100, 0) || !numberIn(input.winRate, 0, 100)
    || typeof input.n !== 'number' || !Number.isSafeInteger(input.n) || input.n < 0
    || !optionalText(input.origin) || !optionalText(input.exchangeName)
    || !optionalSnapshotText(input.asset) || !optionalSnapshotText(input.exchangeId) || !optionalSnapshotText(input.version)
    || input.chartSymbol !== null && !optionalSnapshotText(input.chartSymbol)
    || input.capital !== undefined && !numberIn(input.capital, 0, Number.MAX_SAFE_INTEGER)) return null
  const p = input.parameters === null ? null : decodeSourceUserStrategyParameters(input.parameters)
  if (input.parameters !== null && !p) return null
  return Object.freeze({ id: input.id, name: input.name, createdAt: input.createdAt,
    status: input.status as SourceUserStrategyRecord['status'], environment: input.environment as SourceUserStrategyRecord['environment'],
    parameters: p, score: input.score, ret: input.ret, mdd: input.mdd, n: input.n, winRate: input.winRate,
    ...(input.origin !== undefined ? { origin: input.origin } : {}), ...(input.exchangeName !== undefined ? { exchangeName: input.exchangeName } : {}),
    ...(input.asset !== undefined ? { asset: input.asset } : {}),
    ...(input.exchangeId !== undefined ? { exchangeId: input.exchangeId } : {}),
    ...(input.chartSymbol !== undefined ? { chartSymbol: input.chartSymbol } : {}),
    ...(input.capital !== undefined ? { capital: input.capital } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  })
}
