import { CLIENT_RESEARCH_FIXTURE } from './client-research-fixtures'

// Client-authored, frozen research examples only. This is not an API contract.
// The source chart starts its sealed Holdout region at index 910.
export const RESEARCH_LAST_BAR = 909
export type ResearchVersion = 0 | 1
export type ResearchTrade = typeof CLIENT_RESEARCH_FIXTURE.versions[number]['trades'][number]
export type ResearchAnalysisView = {
  selected: number | null
  range: { from: number; to: number } | null
  replaySeen: boolean
}
export const newAnalysisView = (): ResearchAnalysisView => ({ selected: null, range: null, replaySeen: false })
export const researchPrices = CLIENT_RESEARCH_FIXTURE.prices.filter(([index]) => index <= RESEARCH_LAST_BAR)
export const researchPriceAt = new Map<number, number>(researchPrices)
export const researchExitLabel = (kind: ResearchTrade['kind']) => kind === 'sl' ? '손절' : kind === 'tp' ? '익절' : '보유 기간 종료'
export const researchBarLabel = (index: number) => `${(index + 1).toLocaleString('ko-KR')}번째 봉`
export const researchVersion = (version: ResearchVersion) => CLIENT_RESEARCH_FIXTURE.versions[version]

// Lightweight Charts requires ordered time keys. These are ordinal positions,
// NOT exchange timestamps. Every visible formatter retains the source bar index.
export const researchTime = (index: number) => (index + 1) * 86400
export const researchIndex = (time: number) => Math.round(time / 86400) - 1
