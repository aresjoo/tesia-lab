import { useClientPreferences } from '../client-preferences'
import { conditionNumber } from '../client-condition-number'
import { researchChartText, researchChartStaticText } from '../client-research-chart-ui-copy'
import { lazy, Suspense, useId, useMemo } from 'react'
import { evaluateDelegation } from '../client-delegation-engine'
import type { InlineBacktestRecord } from '../client-inline-backtest'
import { SOURCE_USER_STRATEGY_PASS_SCORE } from '../client-user-strategy'
import { ClientLoadBoundary } from './ClientLoadBoundary'
import '../client-inline-backtest.css'

const ReportChart = lazy(() => import('./ClientInlineReportChart'))

/** Source-authored T9/T10 presentation. Never accepts native service reports. */
export function ClientInlineBacktest({ record, active, canConnect, onRecommend, onEdit, onPlan, onConnect }: {
  record: InlineBacktestRecord; active: boolean; canConnect: boolean
  onRecommend: () => void; onEdit: () => void; onPlan: () => void; onConnect: () => void
}) {
  const { language } = useClientPreferences()
  const t = (value: string) => researchChartStaticText(value, language)
  const f = (key: Parameters<typeof researchChartText>[1], values: Record<string, string | number> = {}) => researchChartText(language, key, values)
  const number = (value: number, digits = 0) => new Intl.NumberFormat(language, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value.toFixed(digits)))
  const id = useId()
  const { evaluation, result, score } = useMemo(() => evaluateDelegation(record.parameters, 5_000_000), [record.parameters])
  const p = record.parameters, pass = score >= SOURCE_USER_STRATEGY_PASS_SCORE
  const ret = number(result.ret, 1), mdd = number(result.mdd, 1), win = number(result.winRate, 1)
  const loss = number(Math.abs(result.mdd), 1)
  return <div className="client-inline-backtest" data-source="client-synthetic-daily" data-turn-id={record.turnId}>
    <section className="gbt" aria-labelledby={`${id}-result`} data-bt={record.ordinal}>
      <div className="tt"><h3 id={`${id}-result`}>{t("전략 검증 결과")}</h3><span>{f('ordinal', { count: number(record.ordinal) })}</span></div>
      <div className={`sc${pass ? ' pass' : ''}`}><b>{number(score)}</b><span className="vd">TETH SCORE, {t(pass ? '실행 기준 통과' : '기준 80점 미달')}</span></div>
      <dl className="kp">{[['검증 수익', `${result.ret >= 0 ? '+' : ''}${ret}%`, result.ret >= 0 ? 'u' : 'd'], ['최대 낙폭', `${mdd}%`, 'd'], ['승률', `${win}%`, ''], ['거래 수', f('countTrades', { count: number(result.n) }), '']].map(([label, value, cls]) => <div key={label}><dt>{t(label)}</dt><dd className={cls}>{value}</dd></div>)}</dl>
      <details><summary>{t("상세 조건 펼치기")}</summary><div className="dt2">
        <p>{f('interval', { pair: record.pair, interval: t(record.timeframe) })}</p>
        <p>{f('entry', { rsi: conditionNumber(p.rsiTh, language), filter: p.trendFilter ? t(' + 추세 필터') : '' })}</p>
        <p>{f('exit', { stop: conditionNumber(p.sl, language), target: p.tp !== null ? f('takeProfit', { target: conditionNumber(p.tp, language) }) : t(', 익절 없음') })}</p>
        <p>{t("구간: 원본 공통 합성 일봉. 요청 간격과 관계없이 같은 일봉으로 계산합니다. 판정·진입·기간 청산은 봉 종가, 손절·익절은 규칙가 가정입니다. 일중 변동·갭·슬리피지는 반영하지 않습니다.")}</p>
      </div></details>
      <p className="inline-provenance">{t("원본 합성 데이터 미리보기입니다. 실제 시장의 검증·승인이나 수익 보장이 아닙니다.")}{pass && t(' 파라미터 민감도와 시장 국면별 검증을 거치지 않은 조건부 통과입니다.')}</p>
    </section>
    {pass ? <>
      <p className="g-amsg inline-verdict">{t("기준을 통과했어요. 리포트도 여기서 바로 보여드릴게요.")}</p>
      <section className="gbt" aria-labelledby={`${id}-report`} data-rpt={record.ordinal}>
        <div className="tt"><h3 id={`${id}-report`}>{t("전략 리포트")}</h3><span>{f('reportOrdinal', { count: number(record.ordinal) })}</span></div>
        <ClientLoadBoundary fallback={<p role="alert">{t("차트를 불러오지 못했어요. 검증 지표와 조건은 위에서 확인할 수 있어요.")}</p>}><Suspense fallback={<div className="inline-chart-loading" role="status">{t("차트 불러오는 중")}</div>}><ReportChart evaluation={evaluation} asset={record.pair} /></Suspense></ClientLoadBoundary>
        <h4 className="sec">{t("전략 설명")}</h4><p className="bd">{f('explained', { wins: number(Math.round(result.winRate)), loss, count: number(result.n) })}</p>
        <h4 className="sec">{t("위험 요소")}</h4><p className="bd">{f('riskExplanation', { loss })}</p>
        <div className="acts"><button className="primary" type="button" disabled={!canConnect} onClick={onConnect}>{t("이 전략 실행하기")}</button><button type="button" title={t("현재 대화의 조건을 정리한 연구 계획")} onClick={onPlan}>{t("연구 계획서 크게 보기")}</button></div>
      </section>
    </> : <>
      <p className="g-amsg inline-verdict">{t("실행 기준(80점)에는 아직 못 미쳐요. 추천 설정으로 조정하면 통과 가능성이 높아집니다.")}</p>
      {active && <div className="g-chiprow"><button type="button" className="g-qchip" onClick={onRecommend}>{t("추천 설정으로 다시 검증")}</button><button type="button" className="g-qchip" onClick={onEdit}>{t("조건을 직접 수정할게요")}</button></div>}
    </>}
  </div>
}
