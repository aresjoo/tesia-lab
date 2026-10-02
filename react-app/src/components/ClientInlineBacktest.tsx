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
  const id = useId()
  const { evaluation, result, score } = useMemo(() => evaluateDelegation(record.parameters, 5_000_000), [record.parameters])
  const p = record.parameters, pass = score >= SOURCE_USER_STRATEGY_PASS_SCORE
  const ret = result.ret.toFixed(1), mdd = result.mdd.toFixed(1), win = result.winRate.toFixed(1)
  const loss = Math.abs(result.mdd).toFixed(1)
  return <div className="client-inline-backtest" data-source="client-synthetic-daily" data-turn-id={record.turnId}>
    <section className="gbt" aria-labelledby={`${id}-result`} data-bt={record.ordinal}>
      <div className="tt"><h3 id={`${id}-result`}>전략 검증 결과</h3><span>{record.ordinal}차, 수수료 0.2% 반영, 시뮬레이션</span></div>
      <div className={`sc${pass ? ' pass' : ''}`}><b>{score}</b><span className="vd">TETH SCORE, {pass ? '실행 기준 통과' : '기준 80점 미달'}</span></div>
      <dl className="kp">{[['검증 수익', `${result.ret >= 0 ? '+' : ''}${ret}%`, result.ret >= 0 ? 'u' : 'd'], ['최대 낙폭', `${mdd}%`, 'd'], ['승률', `${win}%`, ''], ['거래 수', `${result.n}회`, '']].map(([label, value, cls]) => <div key={label}><dt>{label}</dt><dd className={cls}>{value}</dd></div>)}</dl>
      <details><summary>상세 조건 펼치기</summary><div className="dt2">
        <p>{record.pair} · 요청 간격 {record.timeframe}</p>
        <p>진입: RSI {p.rsiTh} 이하 눌림 후 반등{p.trendFilter ? ' + 추세 필터' : ''}</p>
        <p>청산: 손절 {p.sl}%{p.tp !== null ? `, 익절 +${p.tp}%` : ', 익절 없음'}, 최대 보유 25봉</p>
        <p>구간: 원본 공통 합성 일봉. 요청 간격과 관계없이 같은 일봉으로 계산합니다. 판정·진입·기간 청산은 봉 종가, 손절·익절은 규칙가 가정입니다. 일중 변동·갭·슬리피지는 반영하지 않습니다.</p>
      </div></details>
      <p className="inline-provenance">원본 합성 데이터 미리보기입니다. 실제 시장의 검증·승인이나 수익 보장이 아닙니다.{pass && ' 파라미터 민감도와 시장 국면별 검증을 거치지 않은 조건부 통과입니다.'}</p>
    </section>
    {pass ? <>
      <p className="g-amsg inline-verdict">기준을 통과했어요. 리포트도 여기서 바로 보여드릴게요.</p>
      <section className="gbt" aria-labelledby={`${id}-report`} data-rpt={record.ordinal}>
        <div className="tt"><h3 id={`${id}-report`}>전략 리포트</h3><span>검증 {record.ordinal}차 기준</span></div>
        <ClientLoadBoundary fallback={<p role="alert">차트를 불러오지 못했어요. 검증 지표와 조건은 위에서 확인할 수 있어요.</p>}><Suspense fallback={<div className="inline-chart-loading" role="status">차트 불러오는 중</div>}><ReportChart evaluation={evaluation} asset={record.pair} /></Suspense></ClientLoadBoundary>
        <h4 className="sec">전략 설명</h4><p className="bd">100번 중 {Math.round(result.winRate)}번 꼴로 이기는 전략이었고, 가장 안 좋았던 구간에서는 약 {loss}%까지 내려갔어요. 검증 구간 동안 총 {result.n}번 사고팔았습니다.</p>
        <h4 className="sec">위험 요소</h4><p className="bd">하락 뒤 반등을 노리는 구조라 큰 추세 하락장에서는 신호가 약해질 수 있어요. 최악 구간에서는 약 {loss}%의 평가 손실을 견뎌야 했고, 시장 급변 시 검증 결과와 다르게 움직일 수 있습니다.</p>
        <div className="acts"><button className="primary" type="button" disabled={!canConnect} onClick={onConnect}>이 전략 실행하기</button><button type="button" title="현재 대화의 조건을 정리한 연구 계획" onClick={onPlan}>연구 계획서 크게 보기</button></div>
      </section>
    </> : <>
      <p className="g-amsg inline-verdict">실행 기준(80점)에는 아직 못 미쳐요. 추천 설정으로 조정하면 통과 가능성이 높아집니다.</p>
      {active && <div className="g-chiprow"><button type="button" className="g-qchip" onClick={onRecommend}>추천 설정으로 다시 검증</button><button type="button" className="g-qchip" onClick={onEdit}>조건을 직접 수정할게요</button></div>}
    </>}
  </div>
}
