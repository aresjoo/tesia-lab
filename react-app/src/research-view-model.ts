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
export function criticParagraphs(review: ResearchCriticReview) {
  return {
    builder: `${review.bestYear}년 추세 구간에서 반복적 우위, 수익 ${review.bestYearReturn >= 0 ? '+' : ''}${review.bestYearReturn.toFixed(1)}%, 수익 팩터 ${review.profitFactor.toFixed(2)}.`,
    critic: `${review.initialLowVolLossShare > 40 ? `저변동성 구간에 손실 거래 ${review.initialLowVolLossShare.toFixed(0)}% 집중 (v1 기준)${review.lowVolFilterApplied ? ', 필터로 수정됨.' : '.'} ` : ''}상위 3개 거래가 수익의 ${review.topThreeProfitShare.toFixed(0)}%${review.topThreeProfitShare > 50 ? ', 소수 거래 의존.' : '.'}`,
    verdict: review.verdict,
  }
}
