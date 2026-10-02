/** Client 501053b tfRankSeeds/tfSS3PdCalc. Synthetic source preview only.
 * This is not a marketplace, market-data source, service score or approval. */
import { evaluateDelegation } from './client-delegation-engine'
import { sourceTerminalPrices, type SourceTerminalParameters } from './client-terminal-source-fixture'
import type { StrategyClassification, StrategyMarket } from './client-strategy-classification'
import type { StrategyIdentity } from './client-strategy-identity'

export type SharedPeriod = 'all' | '2y' | '1y'
export type SharedStrategy = StrategyClassification & StrategyIdentity & { nick: string; asset: string; followers?: number; parameters: SourceTerminalParameters; score: number; result: ReturnType<typeof evaluateDelegation>['result']; me?: boolean; title?: string; description?: string }
export const sharedPeriods = { all: '전체 기간', '2y': '최근 2년', '1y': '최근 1년' } as const
export function sourceSharedStrategies(): (SharedStrategy & { followers: number })[] {
  const endI = sourceTerminalPrices.length - 1
  const configs = [
    ['세븐틴층', '비트코인', -5, 12, 44, 61, 1284],
    ['단타는안해요', '이더리움', -8, 15, 47, 61, 911],
    ['월급두배', '비트코인', -5, 8, 38, 61, 640],
    ['조용한복리', '나스닥', -3, 10, 41, Math.max(61, endI - 730), 377],
    ['바닥만줍는사람', '비트코인', -8, 12, 41, 61, 512],
    ['느긋한스윙', '이더리움', -5, 10, 44, Math.max(61, endI - 730), 298],
    ['리스크헌터', '나스닥', -5, 15, 44, 61, 203],
    ['천천히꾸준히', '비트코인', -3, 8, 38, Math.max(61, endI - 365), 156],
  ] as const
  return configs.map(([nick, asset, sl, tp, rsiTh, startI, followers]) => {
    const parameters = { sl, tp, rsiTh, startI, endI, trendFilter: true }
    const { score, result } = evaluateDelegation(parameters, 5000000)
    // Only these named preview fixtures use this mapping. Service rows do not.
    const market: StrategyMarket = asset === '나스닥' ? 'index' : 'crypto'
    const glyph: StrategyIdentity['glyph'] = { kind: 'rule', shape: market === 'index' ? 'diamond' : 'circle', rsiThreshold: rsiTh, targetPercent: tp, trendFilter: true }
    return { nick, asset, followers, parameters, score, result, kind: 'rule' as const, market, glyph }
  }).filter(row => row.score >= 72).sort((a, b) => b.score - a.score || b.result.ret - a.result.ret)
}
export function sharedPeriodResult(strategy: SharedStrategy, period: SharedPeriod) {
  if (period === 'all') return strategy.result
  const endI = strategy.parameters.endI ?? sourceTerminalPrices.length - 1
  return evaluateDelegation({ ...strategy.parameters, startI: Math.max(61, endI - (period === '1y' ? 365 : 730)), endI }, 5000000).result
}
export const copyProfileTabs = { ov: '개요', pos: '포지션', cal: '손익 캘린더', bal: '자금 이동', cop: '카피하는 사람들' } as const
export const copyDetailTabs = { pos: '포지션', hist: '청산 이력', share: '수익 분배', bal: '자금 이동', tx: '거래 내역' } as const
export type SharedLocation = { nick?: string; period: SharedPeriod; section?: 'library' | 'publishing'; detailTab?: 'ov' | 'info' | 'trades'; view?: 'trader' | 'copy-setup' | 'copy-detail' | 'catalogue-backtest'; profileTab?: keyof typeof copyProfileTabs; copyId?: string; copyModel?: 'catalogue'; copyTab?: keyof typeof copyDetailTabs }
export const copyTraderLocation = (nick: string): SharedLocation => ({ view: 'trader', nick, period: 'all', profileTab: 'ov' })
export { readSharedLocation, sharedHash } from './client-shared-navigation'

export function sharedAnalysisRequest(row: SharedStrategy, period: SharedPeriod): string {
  const r = sharedPeriodResult(row, period), p = row.parameters
  return `공유 전략 분석 요청: "${row.nick}" (${row.asset}). 규칙: RSI ${p.rsiTh} 이하 눌림 후 반등 진입${p.trendFilter ? ', 추세 필터 사용' : ''}, 손절 ${p.sl}%${p.tp !== null ? `, 익절 +${p.tp}%` : ''}. 검증 결과: 수익 ${r.ret >= 0 ? '+' : ''}${r.ret.toFixed(1)}%, MDD ${r.mdd.toFixed(1)}%, 승률 ${Math.round(r.winRate)}%, 거래 ${r.n}회, TETH ${row.score}점. 이 전략의 강점과 약점, 그리고 따라하기 전에 확인해야 할 점을 분석해줘.`
}
