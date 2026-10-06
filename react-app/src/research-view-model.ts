import type { ClientLanguage } from './client-preferences'
import { researchStaticFormat, researchStaticText } from './client-research-static-content-copy'

/** Presentation models, not a backend contract. Evidence is supplied by adapters. */
export type ResearchCriticReview = {
  version: number
  bestYear: string
  bestYearReturn: number
  profitFactor: number
  initialLowVolLossShare: number
  topThreeProfitShare: number
  lowVolFilterApplied: boolean
  verdict: string
}

/** Original gDocCritic copy, shared by the document and its fixture summary. */
export function criticParagraphs(review: ResearchCriticReview, language: ClientLanguage = 'ko', source: 'service' | 'mock' = 'service') {
  const number = (value: number, digits: number) => new Intl.NumberFormat(language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value.toFixed(digits)))
  const t = (value: string) => researchStaticText(value, language)
  return {
    builder: researchStaticFormat('criticBuilder', language, { year: review.bestYear, return: `${review.bestYearReturn >= 0 ? '+' : ''}${number(review.bestYearReturn, 1)}`, factor: number(review.profitFactor, 2) }),
    critic: (review.initialLowVolLossShare > 40 ? researchStaticFormat('criticLowVol', language, { share: number(review.initialLowVolLossShare, 0), revision: review.lowVolFilterApplied ? t(', 필터로 수정됨.') : '.' }) : '') + researchStaticFormat('criticConcentration', language, { share: number(review.topThreeProfitShare, 0), dependence: review.topThreeProfitShare > 50 ? t(', 소수 거래 의존.') : '.' }),
    verdict: source === 'mock' ? t(review.verdict) : review.verdict,
  }
}
