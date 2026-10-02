import { type RefObject } from 'react'
import { ClientSharedDetailShell } from './ClientSharedDetailShell'
import { useClientPreferences } from '../client-preferences'
import { sharedPeriods, type SharedStrategy, type SharedLocation, type SharedPeriod } from '../client-shared-strategies'
import { sharingDetailCopy, type SharingDetailCopyKey } from '../client-sharing-detail-copy'
import { sharedNumber, sharedPercent as pct } from '../client-shared-number-format'
import { sourceTerminalDate } from '../client-terminal-source-fixture'
import type { SharingServicePresentation, SharedMetricKey } from '../client-sharing-presentation'
import detailCopy from '../client-detail-skin-copy.json'
import { ClientSharedEquityChart } from './ClientSharedEquityChart'
import { ClientSharedPerformance } from './ClientSharedPerformance'
import { strategyVenue } from '../client-strategy-identity'
import identityCopy from '../client-strategy-identity-copy.json'
import kindCopy from '../client-strategy-filter-copy.json'
import '../client-shared-detail.css'

type Props = {
  row: SharedStrategy
  result: SharedStrategy['result']
  location: SharedLocation
  title: RefObject<HTMLHeadingElement | null>
  onNavigate: (location: SharedLocation, replace?: boolean) => void
  onCopy: () => void
  onAnalyze: () => void
  onWatch: () => void
  onCopyLink: () => void
  openMetric: (key: SharedMetricKey) => void
  analyzing: boolean
  watched: boolean
  watchBusy: boolean
  service?: SharingServicePresentation
  serviceResults: Partial<Record<SharedPeriod, SharedStrategy['result'] | null>>
  routeKey: string
  performanceKey: string
}
const definitions = {
  ret: ['검증 수익'], score: ['TETH 점수'], mdd: ['최대 낙폭 (MDD)'],
  pf: ['손익비 (Profit Factor)'], hold: ['평균 보유일'], n: ['거래 수'],
} as const

/** 412fd60 detail shell. Only supplied strategy/result values and existing
 * action ports are consumed. This does not infer an exchange or signal time. */
export function ClientSharedStrategyDetail({ row, result, location, title, onNavigate, onCopy, onAnalyze, onWatch, onCopyLink, openMetric, analyzing, watched, watchBusy, service, serviceResults, routeKey, performanceKey }: Props) {
  const { language } = useClientPreferences()
  const copy = detailCopy[language]
  const d = (key: SharingDetailCopyKey, values?: Record<string, string | number>) => sharingDetailCopy(language, key, values)
  const shareAvailable = (() => {
    if (!service) return true
    try { return Boolean(service.shareUrl?.(location)) }
    catch { return false /* A display provider failure must not crash the detail. */ }
  })()
  const numeric = (value: number | null | undefined, suffix = '') => typeof value === 'number' && Number.isFinite(value) ? sharedNumber(value, language, 'auto') + suffix : '—'
  const info = [
    [copy.registeredBy, row.nick], [copy.asset, row.asset],
    ...(row.kind && ['agent', 'rule', 'mix'].includes(row.kind) ? [[kindCopy[language].kindLabel, kindCopy[language][row.kind]]] : []),
    ...(strategyVenue(row.venue) ? [[identityCopy[language].venueLabel, strategyVenue(row.venue)!.name]] : []),
    [copy.rsi, numeric(row.parameters.rsiTh)], [copy.stopLoss, numeric(row.parameters.sl, '%')],
    [copy.takeProfit, numeric(row.parameters.tp, '%')],
    [copy.trendFilter, typeof row.parameters.trendFilter === 'boolean' ? row.parameters.trendFilter ? copy.enabled : copy.disabled : '—'],
  ]
  return <ClientSharedDetailShell row={row} info={info} location={location} title={title} onNavigate={onNavigate} onCopy={onCopy} onAnalyze={onAnalyze} onWatch={onWatch} onCopyLink={onCopyLink} analyzing={analyzing} watched={watched} watchDisabled={Boolean(service) && (!service?.onWatch || watchBusy)} analyzeDisabled={Boolean(service) && !service?.onAnalyze} shareAvailable={shareAvailable} authorRoute={row.me ? undefined : row.nick}>
      <section className="tfbk-card"><div className="cin ss3-blk"><div className="ss3-ch"><h3>{d('검증 성과 지표')}</h3><span className="mt2">{d('{period}, 지표를 누르면 뜻을 볼 수 있어요', { period: d(sharedPeriods[location.period]) })}</span></div><div className="ss3-matrix">{([['ret', pct(result.ret, language)], ['score', d('{points}점', { points: sharedNumber(row.score, language, 'auto') })], ['mdd', `${sharedNumber(result.mdd, language)}%`], ['pf', `${sharedNumber(result.pf, language, 2)}:1`], ['hold', d('{days}일', { days: sharedNumber(result.avgHold, language) })], ['n', d('{count}회 (이익 {wins}, 손실 {losses})', { count: result.n, wins: Math.round(result.n * result.winRate / 100), losses: result.lossCount })]] as const).map(([k, v]) => <button type="button" className="mx" data-metric={k} key={k} onClick={() => openMetric(k)}><small>{d(definitions[k][0])} ⓘ</small><b>{k === 'n' && v.includes('(') ? <>{v.slice(0, v.indexOf('('))}<span className="shared-detail-metric-note">{v.slice(v.indexOf('('))}</span></> : v}</b></button>)}</div></div></section><section className="tfbk-card"><div className="cin ss3-blk"><div className="ss3-ch"><h3>{d('누적 수익 곡선')}</h3><div className="ss3-periods"><div className="ss3-pp" role="group" aria-label={d('검증 기간')}>{(Object.keys(sharedPeriods) as SharedPeriod[]).map(p => <button className={`p ${location.period === p ? 'on' : ''}`} type="button" key={p} aria-pressed={location.period === p} disabled={Boolean(service) && !serviceResults[p]} onClick={() => onNavigate({ nick: row.me ? 'me' : row.nick, period: p }, true)}>{d(p === 'all' ? '전체' : sharedPeriods[p])}</button>)}</div>{!service && <span className="mt2">{d('수수료 0.2% 반영')}</span>}</div></div><ClientSharedEquityChart equity={result.eq} indexToDate={service?.indexToDate ?? sourceTerminalDate} replayKey={routeKey} /></div></section><ClientSharedPerformance key={performanceKey} result={result} asset={row.asset} servicePresentation={service} /><p className="mt2">{d('검증 수치는 과거 데이터 기반 백테스트 결과이며 미래 수익을 보장하지 않아요.')}</p>
  </ClientSharedDetailShell>
}
