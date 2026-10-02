import type { SharedStrategy } from './client-shared-strategies'

export type ListPerformance = { values: number[]; percent: number; start: number; end: number }
/** A window of existing evidence, not a new backtest. Only the explicitly
 * synthetic daily engine may carry its unchanged flat balance across gaps. */
export function strategyListPerformance(strategy: SharedStrategy, preview: boolean, indexToDate: (index: number) => Date): ListPerformance | null {
  const end = strategy.parameters.endI, initial = strategy.parameters.startI
  if (typeof end !== 'number' || typeof initial !== 'number' || !Number.isSafeInteger(end) || !Number.isSafeInteger(initial)) return null
  const start = end - 30
  const eq = strategy.result.eq
  if (!Number.isSafeInteger(start) || !eq.length || start < initial) return null
  let previous = -Infinity
  for (const point of eq) {
    if (!Number.isSafeInteger(point.i) || point.i < previous || !Number.isFinite(point.v) || point.v <= 0 || point.i > end!) return null
    previous = point.i
  }
  const values: number[] = []
  let cursor = 0, balance: number | undefined, lastTime: number | undefined
  for (let i = start; i <= end!; i++) {
    let exact = false
    while (cursor < eq.length && eq[cursor].i <= i) {
      balance = eq[cursor].v; exact = eq[cursor].i === i; cursor++
    }
    if (balance === undefined || (!preview && !exact)) return null
    let time: number
    try { time = indexToDate(i).getTime() } catch { return null }
    if (!Number.isFinite(time) || (lastTime !== undefined && time - lastTime !== 86_400_000)) return null
    lastTime = time; values.push(balance)
  }
  const base = values[0], percent = (values.at(-1)! / base - 1) * 100
  if (!Number.isFinite(percent)) return null
  const normalized = values.map(value => value / base)
  if (!normalized.every(Number.isFinite)) return null
  return { values: normalized, percent, start, end }
}
