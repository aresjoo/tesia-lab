/** 02cebe3 tfIntakeNext/tfPick presentation. Not a strategy or service contract. */
import { decodeInlineInput, type InlineBacktestInput } from './client-inline-backtest'
import { sourceTerminalPrices } from './client-terminal-source-fixture'

export const sourceIntakeKeys = ['asset', 'style', 'budget', 'period', 'stop'] as const
export type SourceIntakeKey = typeof sourceIntakeKeys[number]
export type SourceIntakeAnswer = { key: SourceIntakeKey; index: number; recommended: boolean }
export type SourceIntake = { answers: SourceIntakeAnswer[] }
export const sourceIntakeCounts = [4, 3, 4, 3, 4] as const
export const sourceIntakeDefaults = [0, 1, 1, 1, 1] as const
export const sourceIntakeAmounts = [1000, 5000, 10000, 30000] as const
export const sourceIntakePeriods = [365, 730, 0] as const

/** Strict contiguous answers. Corruption must not silently advance a question. */
export function readSourceIntake(value: unknown): SourceIntake | undefined {
  if (!value || typeof value !== 'object') return
  const answers = (value as SourceIntake).answers
  if (!Array.isArray(answers) || answers.length > sourceIntakeKeys.length) return
  const next: SourceIntakeAnswer[] = []
  for (let i = 0; i < answers.length; i++) {
    const a = answers[i]
    if (!a || a.key !== sourceIntakeKeys[i] || !Number.isInteger(a.index) || a.index < 0 || a.index >= sourceIntakeCounts[i]
      || typeof a.recommended !== 'boolean' || a.recommended && a.index !== sourceIntakeDefaults[i]) return
    next.push({ key: a.key, index: a.index, recommended: a.recommended })
  }
  return { answers: next }
}

/** Match the question observed by the caller; duplicate/stale picks cannot skip it. */
export function pickSourceIntake(value: SourceIntake, key: SourceIntakeKey, index: number, recommended: boolean): SourceIntake | undefined {
  const current = readSourceIntake(value)
  if (!current || sourceIntakeKeys[current.answers.length] !== key) return
  return readSourceIntake({ answers: [...current.answers, { key, index, recommended }] })
}

export function sourceIntakePreview(value: SourceIntake): { input: InlineBacktestInput; amount: typeof sourceIntakeAmounts[number]; period: typeof sourceIntakePeriods[number] } | undefined {
  const current = readSourceIntake(value)
  if (!current || current.answers.length !== 5) return
  const [asset, style, budget, period, stop] = current.answers.map(a => a.index)
  // Stock selections remain visible; never relabel the crypto-only preview
  // engine as a Tesla/Nasdaq price feed. The real provider is a separate port.
  if (asset > 1) return
  const input = decodeInlineInput({ pair: asset === 0 ? 'BTC/USDT' : 'ETH/USDT', timeframe: '일봉', parameters: {
    sl: [-3, -5, -8, -12][stop], tp: [null, 12, 8][style], rsiTh: [52, 44, 38][style], trendFilter: style === 2,
    startI: 61, endI: sourceTerminalPrices.length - 1,
  } })
  return input ? { input, amount: sourceIntakeAmounts[budget], period: sourceIntakePeriods[period] } : undefined
}
