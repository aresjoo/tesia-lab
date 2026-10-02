import type { StrategyCondition, StrategyFeature, StrategyOperand } from './contracts/generated/api-v0.3/types'
import type { ClientLanguage } from '../client-preferences'
import { nativeStrategyText } from './native-strategy-copy'

// Presentation only: no current values, signal evaluation, validation or order
// authority. The complete server projection remains the source of truth.
export function describeFeature(feature: StrategyFeature, language: ClientLanguage = 'ko'): string {
  const timeframe = feature.timeframe === '15m' ? nativeStrategyText(language, 'timeframe15m') : feature.timeframe
  if (feature.type === 'ohlcv') return `${nativeStrategyText(language, feature.field)} (${timeframe})`
  const source = nativeStrategyText(language, feature.source)
  return nativeStrategyText(language, feature.type, { period: feature.period, source, timeframe })
}

/** Exact decimal-point shift, never binary floating-point conversion/rounding.
 * Noncanonical input is retained as unconfirmed text, not coerced into a rate.
 * This formatter does not imply a position return or account loss percentage.
 */
export function formatFractionPercent(value: string, language: ClientLanguage = 'ko'): string {
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(value)
  if (!match) return `${value} (${nativeStrategyText(language, 'rateUnconfirmed')})`
  const fraction = match[2] ?? ''
  const whole = `${match[1]}${fraction.padEnd(2, '0').slice(0, 2)}`.replace(/^0+(?=[0-9])/, '')
  const tail = fraction.slice(2).replace(/0+$/, '')
  return `${whole}${tail ? `.${tail}` : ''}%`
}

export function describeCondition(condition: StrategyCondition, features: readonly StrategyFeature[], language: ClientLanguage = 'ko'): { text: string; warnings: readonly string[] } {
  const warnings = new Set<string>()
  const byId = new Map<string, StrategyFeature | null>()
  for (const feature of features) byId.set(feature.id, byId.has(feature.id) ? null : feature)
  const operand = (value: StrategyOperand): string => {
    if (value.kind === 'number') return `${value.value}\u00a0(${nativeStrategyText(language, value.unit)})`
    const feature = byId.get(value.featureId)
    if (!feature) {
      warnings.add(nativeStrategyText(language, feature === null ? 'duplicateFeature' : 'missingFeature', { id: value.featureId }))
      return nativeStrategyText(language, 'featureUnconfirmed', { id: value.featureId })
    }
    return `${describeFeature(feature, language)} [${value.featureId}]`
  }
  // SDK conditions are depth <= 8. Wider graphs and malformed in-memory cycles
  // are defensive cases, not newly accepted API shapes. Never summarize a
  // partial AND/OR tree as though all its conditions had been described.
  const limit = Symbol('readable condition limit')
  let fallbackWarning: 'complexityWarning' | 'logicalWarning' = 'complexityWarning'
  const active = new Set<StrategyCondition>()
  let nodes = 0
  const visit = (node: StrategyCondition, depth: number): string => {
    if (depth > 8 || ++nodes > 256 || active.has(node)) throw limit
    active.add(node)
    let text: string
    if (node.kind === 'logical') {
      if (node.conditions.length < 2) {
        fallbackWarning = 'logicalWarning'
        throw limit
      }
      if (node.conditions.length > 256) throw limit
      const connector = ` ${nativeStrategyText(language, node.operator)} `
      text = `(${node.conditions.map(child => visit(child, depth + 1)).join(connector)})`
    } else if (node.kind === 'cross') {
      text = nativeStrategyText(language, node.operator === 'cross_above' ? 'crossAbove' : 'crossBelow', { left: operand(node.left), right: operand(node.right) })
    } else {
      const labels = { lt: '미만', lte: '이하', gt: '초과', gte: '이상' } as const
      const symbols = { lt: '<', lte: '≤', gt: '>', gte: '≥' } as const
      text = language === 'ko'
        ? `${operand(node.left)} 값이 ${operand(node.right)}${node.right.kind === 'number' ? '\u00a0' : ' '}${labels[node.operator]}`
        : `${operand(node.left)} ${symbols[node.operator]} ${operand(node.right)}`
    }
    active.delete(node)
    if (text.length > 16_000) throw limit
    return text
  }
  try {
    return { text: visit(condition, 0), warnings: [...warnings] }
  } catch (error) {
    if (error !== limit) throw error
    return { text: nativeStrategyText(language, 'conditionFallback'),
      warnings: [...warnings, nativeStrategyText(language, fallbackWarning)] }
  }
}
