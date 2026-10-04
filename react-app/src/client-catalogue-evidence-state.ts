import { catalogueAssets, type CatalogueStrategy } from './client-catalogue'
import type { CatalogueBacktestObservation } from './client-catalogue-backtest'
import type { CatalogueBacktestEvidence, CatalogueEvidenceDecision, CatalogueEvidenceDailyGroup } from './client-catalogue-backtest-evidence-types'

export const catalogueEvidencePageSize = 12
export type EvidenceFilter = 'all' | 'opp' | 'buy' | 'sell' | 'skip'
export type EvidenceSort = 'new' | 'old' | 'big'
export type EvidenceRow = { type: 'decision'; value: CatalogueEvidenceDecision } | { type: 'daily'; value: CatalogueEvidenceDailyGroup }
export type EvidenceSelection = { runId: string; type: 'decision' | 'daily' | 'trade'; index: number; j: number } | null
export type EvidenceState = { filter: EvidenceFilter; sort: EvidenceSort; count: number; selection: EvidenceSelection; group: { first: number; last: number } | null; tradeFilter: 'all' | 'win' | 'loss'; tradeCount: number }
export function evidenceDefaultFilter(strategy: CatalogueStrategy): EvidenceFilter {
  return strategy.kind === 'agent' || strategy.kind === 'mix' && strategy.gate > 0 ? 'opp' : 'all'
}
export function initialEvidenceState(strategy: CatalogueStrategy): EvidenceState {
  return { filter: evidenceDefaultFilter(strategy), sort: 'new', count: catalogueEvidencePageSize, selection: null, group: null, tradeFilter: 'all', tradeCount: 8 }
}
export type EvidenceJump = EvidenceFilter | 'win' | 'loss'
export type EvidenceSummaryCell = readonly [string, readonly (readonly [string, EvidenceJump])[], string]
/** Final btSumCells/fuSumCells plus label-only SKB_EXACT and text SKB_RE. */
export function catalogueEvidenceSummary(value: CatalogueBacktestObservation): EvidenceSummaryCell[] {
  const s = value.strategy, decisions = value.evidence.decisions, count = (kind: CatalogueEvidenceDecision['k']) => decisions.filter(d => d.k === kind).length
  const buys = count('buy'), skipped = count('skip'), holds = count('hold'), opportunities = s.kind === 'agent' ? value.evidence.dailyGroups.length : buys + skipped
  const wins = value.result.trades.filter(t => t.pnl > 0).length, losses = value.result.trades.length - wins
  const duration = `${value.result.eq.length.toLocaleString()}일 동안`, longs = decisions.filter(d => d.k === 'buy' && (d.side ?? 0) > 0).length
  const direction = `롱 ${longs}번, 숏 ${buys - longs}번`, buy = s.fut ? '진입' : '매수'
  if (s.kind === 'agent') return [['AI 재평가', [[`${opportunities}번`, 'opp']], duration], ['시장 확인', [[`쉬어 감 ${skipped}번`, 'skip']], `유지 ${holds}번`], ['거래 결과', [[`${s.fut ? '진입' : '종목 매수'} ${buys}번`, 'buy']], s.fut ? direction : `끝난 거래 ${wins + losses}번`]]
  if (s.kind === 'mix' && s.gate > 0) return [['기회 발견', [[`${opportunities}번`, 'opp']], duration], ['AI 확인', [[`${opportunities}번 모두`, 'opp']], s.fut ? 'AI가 본 방향과 같은 신호만' : `기준: 오름세 ${Math.ceil(s.gate * catalogueAssets(s).length)}개 이상`], ['거래 결과', [[`${buy} ${buys}번`, 'buy'], [`보류 ${skipped}번`, 'skip']], s.fut ? direction : `끝난 거래 ${wins + losses}번`]]
  return [['조건 충족', [[`${buys}번`, 'buy']], s.fut ? direction : duration], ['거래 결과', [[`수익 거래 ${wins}건`, 'win'], [`손실 거래 ${losses}건`, 'loss']], `${buy} ${buys}번`]]
}
/** Source 9fb btDecList: stable day sort, full D, daily EV only in agent opportunities. */
export function evidenceRows(evidence: CatalogueBacktestEvidence, strategy: CatalogueStrategy, filter: EvidenceFilter, sort: EvidenceSort): EvidenceRow[] {
  const rows: EvidenceRow[] = filter === 'opp' && strategy.kind === 'agent'
    ? evidence.dailyGroups.map(value => ({ type: 'daily', value }))
    : evidence.decisions.filter(d => filter === 'opp' ? d.k === 'buy' || d.k === 'skip' : filter === 'all' ? d.k !== 'pick' || strategy.kind === 'mix' : d.k === filter).map(value => ({ type: 'decision', value }))
  const impact = (row: EvidenceRow) => row.type === 'decision' ? row.value.out && !row.value.out.mute ? Math.abs(row.value.out.v) : row.value.pnl != null ? Math.abs(row.value.pnl) : -1 : -1
  return rows.sort((a, b) => sort === 'old' ? a.value.i - b.value.i : sort === 'big' ? impact(b) - impact(a) || b.value.i - a.value.i : b.value.i - a.value.i)
}
/** Original btRowAt compares decision identity (not date); daily EV owns all its members. */
export function evidenceRowAt(rows: readonly EvidenceRow[], ix: number) {
  return rows.findIndex(row => row.type === 'decision' ? row.value.ix === ix : row.value.decisionIndices.includes(ix))
}
export function revealEvidenceMarker(state: EvidenceState, evidence: CatalogueBacktestEvidence, strategy: CatalogueStrategy, ix: number, ix2 = ix, individual = false): EvidenceState {
  const decision = evidence.decisions.find(d => d.ix === ix)
  if (!decision) return state
  const group = ix2 > ix ? { first: ix, last: ix2 } : null
  let filter: EvidenceFilter = individual ? 'all' : group ? 'skip' : state.filter
  if (!group && evidenceRowAt(evidenceRows(evidence, strategy, filter, state.sort), ix) < 0) filter = decision.k === 'sell' ? 'all' : evidenceDefaultFilter(strategy)
  if (evidenceRowAt(evidenceRows(evidence, strategy, filter, state.sort), ix) < 0) filter = 'all'
  const rows = evidenceRows(evidence, strategy, filter, state.sort), at = evidenceRowAt(rows, ix)
  const end = group ? Math.max(at, evidenceRowAt(rows, ix2)) : at, row = rows[at]
  return { ...state, filter, group, count: end >= state.count ? end + 3 : state.count,
    selection: { runId: evidence.runId, type: row?.type ?? 'decision', index: row?.value.ix ?? ix, j: decision.j } }
}

/** Final source fuW and skbText display-only substitutions; no ledger/data mutation. */
export function evidenceText(text: string, futures = false) {
  let result = text
  if (futures) for (const [from, to] of [['종목 매수','진입'],['매수 전후','진입 전후'],['매수','진입'],['매도','청산'],['처음 산 날','처음 진입한 날'],['산 날','진입한 날'],['판 날','청산한 날'],['사는 조건','진입 조건'],['AI가 사지 않았고','AI가 진입을 보류했고'],['새로 사지 않고 쉬었습니다','새로 진입하지 않고 쉬었습니다'],['새로 사지 않음','새로 진입하지 않음'],['종목을 들고 있었습니다','포지션을 들고 있었습니다'],['종목을 들고 있던','포지션을 들고 있던'],['판 이유','청산한 이유'],['판 내용','청산 내용'],['그날 산 종목','그날 진입한 종목']]) result = result.split(from).join(to)
  const symbols: Record<string, string> = { 비트코인: 'BTC', 이더리움: 'ETH', 솔라나: 'SOL', 리플: 'XRP', 도지코인: 'DOGE', 에이다: 'ADA', 아발란체: 'AVAX', 비앤비: 'BNB' }
  return result.replace(/비트코인|이더리움|솔라나|리플|도지코인|에이다|아발란체|비앤비/g, name => symbols[name]).replace(/^반대 방향 신호가 나왔습니다$/, '반대 방향 신호로 청산했습니다.')
    .replace(/^([A-Z]{2,6}) 평균선 위로 교차\. (\d+일) 평균이 (\d+일) 평균을 넘었습니다$/, '$2 평균이 $3 평균을 넘어 롱에 진입했습니다.')
    .replace(/^([A-Z]{2,6}) 평균선 아래로 교차\. (\d+일) 평균이 (\d+일) 평균을 밑돌았습니다$/, '$2 평균이 $3 평균을 밑돌아 숏에 진입했습니다.')
    .replace(/^진입가에서 손절 기준만큼 불리하게 움직였습니다$/, '진입가에서 손절 기준만큼 불리하게 움직여 청산했습니다.')
    .replace(/^가장 유리했던 가격에서 기준만큼 되돌렸습니다$/, '가격이 가장 유리했던 지점에서 청산 기준만큼 되돌아와 청산했습니다.')
    .replace(/^이 거래$/, '거래 손익').replace(/^(\d+)일 뒤 청산$/, '$1일 보유 후 청산')
}
