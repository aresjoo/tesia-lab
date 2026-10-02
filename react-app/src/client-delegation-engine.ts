/**
 * SOURCE PREVIEW ONLY — 42a0d81 tfParams / tfRetryRec / tfRecommend / tfEasyText.
 * All assets share the client's synthetic daily PRICE. Neither this mapping nor
 * its score is a service validation, market-data result or execution approval.
 */
import type { DelegationAnswers } from './client-delegation-fixtures'
import {
  evaluateSourceTerminal, sourceTerminalPrices,
  type NormalizedSourceTerminalParameters, type SourceTerminalParameters,
  type SourceTerminalEvaluation,
} from './client-terminal-source-fixture'
import { scoreSourceTerminal } from './client-terminal-source-proposal'

export type DelegationEvaluation = {
  parameters: NormalizedSourceTerminalParameters
  evaluation: SourceTerminalEvaluation
  result: SourceTerminalEvaluation['r']
  score: number
}
export type DelegationRecommendationRow = { k: string; a: string; b: string }

function indexOf(answers: DelegationAnswers, key: 'style' | 'stop' | 'period', count: number): number {
  const index = answers[key]?.index ?? 1
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError('Invalid source delegation answer')
  return index
}

/** Source defaults are preserved; the caller still owns intake completeness. */
export function delegationParameters(answers: DelegationAnswers): NormalizedSourceTerminalParameters {
  const style = indexOf(answers, 'style', 3), stop = indexOf(answers, 'stop', 4), period = indexOf(answers, 'period', 3)
  const endI = sourceTerminalPrices.length - 1
  return {
    sl: [-3, -5, -8, -12][stop], tp: style === 0 ? null : style === 1 ? 12 : 8,
    rsiTh: style === 0 ? 52 : style === 1 ? 44 : 38, trendFilter: style === 2,
    startI: period === 0 ? Math.max(61, endI - 365) : period === 1 ? Math.max(61, endI - 730) : 61,
    endI,
  }
}

/** Not reconstructible from the displayed “neutral” answer: filter is TRUE. */
export function delegationRecommendedParameters(): NormalizedSourceTerminalParameters {
  return { sl: -5, tp: 12, rsiTh: 44, trendFilter: true, startI: 61, endI: sourceTerminalPrices.length - 1 }
}

/** Every evaluation is fresh; no timers, storage, transport or shared result cache. */
export function evaluateDelegation(parameters: SourceTerminalParameters, capital: number): DelegationEvaluation {
  const evaluation = evaluateSourceTerminal(parameters, capital), result = evaluation.r
  return { parameters: { ...result.params }, evaluation, result, score: scoreSourceTerminal(result) }
}

export function delegationRecommendationRows(p: SourceTerminalParameters): DelegationRecommendationRow[] {
  const rows: DelegationRecommendationRow[] = [], recommended = delegationRecommendedParameters()
  if (p.sl !== recommended.sl) rows.push({ k: '손실 제한', a: p.sl + '%', b: recommended.sl + '%' })
  if (p.startI !== recommended.startI) rows.push({ k: '기간', a: (p.startI ?? 0) > 61 ? '최근 구간' : '전체 기간', b: '전체 기간' })
  if (p.rsiTh !== recommended.rsiTh || p.tp !== recommended.tp || p.trendFilter !== recommended.trendFilter) rows.push({ k: '진입 조건', a: '현재 설정', b: 'TETH 권장' })
  if (!rows.length) rows.push({ k: '설정', a: '현재 설정', b: 'TETH 권장' })
  return rows
}

export function delegationEasyText(c: Pick<SourceTerminalEvaluation['r'], 'sharpe' | 'winRate' | 'mdd' | 'n'>): string {
  const quality = c.sharpe >= 1.5 ? '위험 대비 수익이 좋은 편이에요' : c.sharpe >= .8 ? '위험 대비 수익이 무난한 편이에요' : '수익 대비 흔들림이 좀 있는 편이에요'
  return '100번 중 ' + Math.round(c.winRate) + '번 꼴로 이기는 전략이었고, 가장 안 좋았던 구간에서는 약 ' + Math.abs(c.mdd).toFixed(1) + '%까지 떨어졌어요. ' + quality + '. 검증 구간 동안 총 ' + c.n + '번 사고팔았어요.'
}
