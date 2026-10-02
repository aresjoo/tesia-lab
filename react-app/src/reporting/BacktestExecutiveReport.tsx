import {
  CircleAlert,
  FileClock,
  FlaskConical,
  Info,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import type {
  BacktestReportViewState,
  ExecutiveBacktestReport,
  ExecutiveMetric,
  ExecutiveSegmentReport,
  RecordedTrade,
} from './backtest-report.types'

type BacktestExecutiveReportProps = {
  state: BacktestReportViewState
}

function decimalParts(value: string) {
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [integer, fraction = ''] = unsigned.split('.')
  return { negative, integer, fraction }
}

function groupInteger(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatDecimal(value: string, minimumFractionDigits = 0) {
  const { negative, integer, fraction } = decimalParts(value)
  const paddedFraction = fraction.padEnd(minimumFractionDigits, '0')
  return (negative ? '-' : '') + groupInteger(integer) + (paddedFraction ? '.' + paddedFraction : '')
}

function multiplyByHundred(value: string) {
  const { negative, integer, fraction } = decimalParts(value)
  const shifted = integer + fraction.padEnd(2, '0').slice(0, 2)
  const remainder = fraction.length > 2 ? fraction.slice(2) : ''
  const normalizedInteger = shifted.replace(/^0+(?=\d)/, '') || '0'
  return (negative ? '-' : '') + normalizedInteger + (remainder ? '.' + remainder : '')
}

function isZeroDecimal(value: string) {
  return /^-?0(?:\.0+)?$/.test(value)
}

function formatFraction(value: string | null, showPositiveSign = true) {
  if (value === null) return '자료 없음'
  const percentage = multiplyByHundred(value)
  const prefix = showPositiveSign && !percentage.startsWith('-') && !isZeroDecimal(percentage) ? '+' : ''
  return prefix + formatDecimal(percentage, 2) + '%'
}

function formatDifference(metric: ExecutiveMetric) {
  if (metric.kind === 'COUNT') return '비교 불가'
  if (metric.difference === null) return '비교 불가'
  const value = multiplyByHundred(metric.difference)
  return (!value.startsWith('-') && !isZeroDecimal(value) ? '+' : '') + formatDecimal(value, 2) + '%p'
}

function impactLabel(metric: ExecutiveMetric) {
  if (metric.differenceImpact === 'ADVERSE') return '악화'
  if (metric.differenceImpact === 'FAVORABLE') return '개선'
  if (metric.differenceImpact === 'NEUTRAL') return '변화 없음'
  return null
}

function formatMetric(metric: ExecutiveMetric, segment: 'inSample' | 'outOfSample') {
  if (metric.kind === 'COUNT') return metric[segment].toLocaleString('ko-KR') + '건'
  const value = metric[segment]
  if (value === null) return '자료 없음'
  return formatFraction(value, metric.id !== 'maximumDrawdown')
}

function formatDate(value: string) {
  const [date] = value.split('T')
  const [year, month, day] = date.split('-')
  return year + '.' + month + '.' + day
}

function shortHash(value: string) {
  return value.slice(0, 12) + '…' + value.slice(-6)
}

function MockDataLabel() {
  return <span className="mock-data-label"><FlaskConical aria-hidden="true" /> 시연 전용 · MOCK FIXTURE</span>
}

function SourceDisclosure() {
  return (
    <div className="report-source-disclosure" data-testid="source-disclosure">
      <FlaskConical aria-hidden="true" />
      <div>
        <strong>시연 전용 · MOCK FIXTURE</strong>
        <p>화면과 검증 경계를 점검하기 위한 합성 표본입니다. 실제 730일 백테스트 결과나 투자 성과가 아닙니다.</p>
      </div>
    </div>
  )
}

function EvaluationWindows({ report }: { report: ExecutiveBacktestReport }) {
  const windows = [
    ['IS · 표본 내', report.segments.inSample],
    ['OOS · 표본 외', report.segments.outOfSample],
  ] as const
  return (
    <section className="evaluation-windows" aria-labelledby="evaluation-heading">
      <div className="section-heading compact-heading">
        <div>
          <span className="section-kicker">FIXED WINDOWS</span>
          <h2 id="evaluation-heading">독립 평가 구간</h2>
        </div>
        <MockDataLabel />
      </div>
      <div className="window-pair">
        {windows.map(([label, segment]) => (
          <dl key={label} className="window-block">
            <div><dt>구간</dt><dd>{label}</dd></div>
            <div><dt>시작 포함</dt><dd>{segment.evaluation.startInclusive}</dd></div>
            <div><dt>종료 제외</dt><dd>{segment.evaluation.endExclusive}</dd></div>
            <div><dt>15분 캔들</dt><dd>{segment.evaluation.candleRows.toLocaleString('ko-KR')}개</dd></div>
          </dl>
        ))}
      </div>
      <p className="comparison-boundary">두 구간은 각각 실행된 결과입니다. 화면의 차이 값은 OOS에서 IS를 뺀 비교값이며 합산 성과가 아닙니다.</p>
    </section>
  )
}

function MetricComparison({ report }: { report: ExecutiveBacktestReport }) {
  const comparableMetrics = report.metrics.filter((metric) => metric.kind === 'PERCENT')
  const absoluteMetrics = report.metrics.filter((metric) => metric.kind === 'COUNT')
  return (
    <section className="report-section metrics-section" aria-labelledby="metrics-heading">
      <div className="section-heading">
        <div>
          <span className="section-kicker">IS / OOS COMPARISON</span>
          <h2 id="metrics-heading">핵심 성과를 같은 눈높이로 비교</h2>
        </div>
        <MockDataLabel />
      </div>
      <div className="metric-table-wrap">
        <table className="metric-table" aria-label="표본 내외 비교 가능 비율 지표">
          <thead>
            <tr>
              <th scope="col">핵심 지표</th>
              <th scope="col">IS · 표본 내</th>
              <th scope="col">OOS · 표본 외</th>
              <th scope="col">OOS − IS, 비교만</th>
            </tr>
          </thead>
          <tbody>
            {comparableMetrics.map((metric) => {
              const visibleImpact = impactLabel(metric)
              return <tr key={metric.id} data-testid={'metric-' + metric.id}>
                <th scope="row">
                  <span>{metric.label}</span>
                  <small>{metric.help}</small>
                </th>
                <td data-label="IS · 표본 내">{formatMetric(metric, 'inSample')}</td>
                <td data-label="OOS · 표본 외">{formatMetric(metric, 'outOfSample')}</td>
                <td
                  data-label="OOS − IS, 비교만"
                  data-direction={metric.differenceMeaning}
                  data-impact={metric.differenceImpact}
                >
                  {formatDifference(metric)}
                  {visibleImpact && <small className="impact-label">{visibleImpact}</small>}
                </td>
              </tr>
            })}
          </tbody>
        </table>
        <table className="metric-table absolute-metric-table" aria-label="표본 내외 절대 총합 지표">
          <thead>
            <tr>
              <th scope="col">절대 총합</th>
              <th scope="col">IS · 표본 내</th>
              <th scope="col">OOS · 표본 외</th>
            </tr>
          </thead>
          <tbody>
            {absoluteMetrics.map((metric) => (
              <tr key={metric.id} data-testid={'metric-' + metric.id}>
                <th scope="row">
                  <span>{metric.label}</span>
                  <small>{metric.help}</small>
                </th>
                <td data-label="IS · 표본 내">{formatMetric(metric, 'inSample')}</td>
                <td data-label="OOS · 표본 외">{formatMetric(metric, 'outOfSample')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="comparison-boundary">IS 584일과 OOS 146일은 기간과 거래 표본 수가 다릅니다. 순수익률과 최대 낙폭은 관측 기간, 승률은 적은 거래 수의 영향을 받으므로 방향 참고용 비교이며, 거래 수는 차이를 계산하지 않습니다.</p>
    </section>
  )
}

function CostComparison({ report }: { report: ExecutiveBacktestReport }) {
  return (
    <section className="report-section cost-section" aria-labelledby="cost-heading">
      <div className="section-heading">
        <div>
          <span className="section-kicker">COST TRACE</span>
          <h2 id="cost-heading">비용은 항목별로 분리</h2>
        </div>
        <MockDataLabel />
      </div>
      <div className="cost-ledger" role="table" aria-label="표본 내외 비용 비교">
        <div className="cost-ledger-row is-heading" role="row">
          <span role="columnheader">항목</span>
          <span role="columnheader">IS</span>
          <span role="columnheader">OOS</span>
        </div>
        {report.costs.map((cost) => (
          <div className="cost-ledger-row" role="row" key={cost.id}>
            <strong role="rowheader">{cost.label}<small>{cost.help}</small></strong>
            <span role="cell" data-label="IS">{formatDecimal(cost.inSample)}</span>
            <span role="cell" data-label="OOS">{formatDecimal(cost.outOfSample)}</span>
          </div>
        ))}
      </div>
      <dl className="assumption-strip">
        <div><dt>테이커 수수료 가정</dt><dd>{formatFraction(report.assumptions.takerRate)}</dd></div>
        <div><dt>불리한 슬리피지 가정</dt><dd>{formatFraction(report.assumptions.adverseSlippageRate)}</dd></div>
        <div><dt>Funding</dt><dd>포함, 부호 있는 현금흐름</dd></div>
      </dl>
      <p className="comparison-boundary">IS 584일과 OOS 146일은 길이가 다르므로 비용 절대 총합의 차이를 계산하지 않습니다. 비용 항목끼리나 두 구간도 합산하지 않습니다.</p>
    </section>
  )
}

function LiquidationBoundary({ report }: { report: ExecutiveBacktestReport }) {
  const limitation = report.segments.inSample.liquidation
  return (
    <section className="liquidation-boundary" aria-labelledby="liquidation-heading" data-testid="liquidation-limitation">
      <ShieldAlert aria-hidden="true" />
      <div>
        <span className="section-kicker">RISK LIMITATION</span>
        <h2 id="liquidation-heading">청산 검증은 현재 제공하지 않습니다</h2>
        <p>현재 Binance MMR과 과거 leverage bracket을 사용하거나 검증했다고 주장하지 않습니다.</p>
        <dl>
          <div><dt>currentMmrVerified</dt><dd>{String(limitation.currentMmrVerified)}</dd></div>
          <div><dt>liquidationCheckStatus</dt><dd>{limitation.liquidationCheckStatus}</dd></div>
          <div><dt>unavailableReason</dt><dd>{limitation.unavailableReason}</dd></div>
        </dl>
      </div>
    </section>
  )
}

function EvidenceSegment({ label, segment }: { label: string; segment: ExecutiveSegmentReport }) {
  const hashes = [
    ['result', segment.evidence.resultContentHash],
    ['run manifest', segment.evidence.runManifestContentHash],
    ['trade manifest', segment.evidence.tradeManifestContentHash],
    ['dataset manifest', segment.evidence.datasetManifestContentHash],
  ] as const
  return (
    <section className="evidence-segment" aria-label={label + ' 검증 근거'}>
      <h3>{label}</h3>
      <dl>
        <div><dt>결과 상태</dt><dd>{segment.resultStatus}</dd></div>
        <div><dt>경합 체결</dt><dd>{segment.contestedFillCount.toLocaleString('ko-KR')}건</dd></div>
      </dl>
      <ul className="hash-list" aria-label={label + ' artifact content hash'}>
        {hashes.map(([name, value]) => (
          <li key={name}><span>{name}</span><code title={value}>{shortHash(value)}</code></li>
        ))}
      </ul>
    </section>
  )
}

function Evidence({ report }: { report: ExecutiveBacktestReport }) {
  return (
    <section className="evidence-panel" aria-labelledby="evidence-heading">
      <div className="evidence-title">
        <ShieldCheck aria-hidden="true" />
        <div>
          <span className="section-kicker">EVIDENCE BY SEGMENT</span>
          <h2 id="evidence-heading">구간별 검증 근거</h2>
        </div>
        <MockDataLabel />
      </div>
      <div className="evidence-pair">
        <EvidenceSegment label="IS · 표본 내" segment={report.segments.inSample} />
        <EvidenceSegment label="OOS · 표본 외" segment={report.segments.outOfSample} />
      </div>
    </section>
  )
}

function TradeRows({ trades }: { trades: readonly RecordedTrade[] }) {
  return trades.map((trade, index) => (
    <tr key={trade.entryAt + '-' + index}>
      <td>{formatDate(trade.entryAt)}</td>
      <td>{formatDate(trade.exitAt)}</td>
      <td>{trade.exitReason.replaceAll('_', ' ')}</td>
      <td className={trade.netPnl.startsWith('-') ? 'number-negative' : 'number-positive'}>
        {!trade.netPnl.startsWith('-') && !isZeroDecimal(trade.netPnl) ? '+' : ''}{formatDecimal(trade.netPnl)}
      </td>
      <td>{formatDecimal(trade.feeCost)}</td>
      <td>{formatDecimal(trade.adverseSlippageCost)}</td>
      <td>{formatDecimal(trade.fundingCashflow)}</td>
    </tr>
  ))
}

function TradeTable({ label, segment }: { label: string; segment: ExecutiveSegmentReport }) {
  return (
    <section className="trade-segment" aria-labelledby={'trade-' + segment.segment}>
      <div className="trade-segment-heading">
        <h3 id={'trade-' + segment.segment}>{label}</h3>
        <span>{segment.metrics.tradeCount.toLocaleString('ko-KR')}건</span>
      </div>
      <div className="trade-table-wrap" tabIndex={0} aria-label={label + ' 거래 내역, 가로 스크롤 가능'}>
        <table className="trade-table" aria-label={label + ' 거래 내역'}>
          <thead>
            <tr>
              <th>진입</th><th>종료</th><th>종료 사유</th><th>순손익</th><th>수수료</th><th>슬리피지</th><th>Funding</th>
            </tr>
          </thead>
          <tbody><TradeRows trades={segment.trades} /></tbody>
        </table>
      </div>
    </section>
  )
}

function TradeManifest({ report }: { report: ExecutiveBacktestReport }) {
  return (
    <section className="report-section trade-section" aria-labelledby="trade-heading">
      <div className="section-heading">
        <div>
          <span className="section-kicker">TRADE LIST BY SEGMENT</span>
          <h2 id="trade-heading">거래 목록도 구간별로 분리</h2>
        </div>
        <MockDataLabel />
      </div>
      <div className="trade-pair">
        <TradeTable label="IS · 표본 내" segment={report.segments.inSample} />
        <TradeTable label="OOS · 표본 외" segment={report.segments.outOfSample} />
      </div>
    </section>
  )
}

function ReadyReport({ report }: { report: ExecutiveBacktestReport }) {
  return (
    <>
      <header className="report-topbar">
        <a href="#report-main" className="skip-link">본문으로 건너뛰기</a>
        <div className="report-brand">
          <span aria-hidden="true">T</span><strong>TETH AI</strong><small>BACKTEST REVIEW</small>
        </div>
        <span className="source-chip"><FlaskConical aria-hidden="true" /> MOCK FIXTURE</span>
      </header>

      <main id="report-main" className="report-main">
        <SourceDisclosure />
        <section className="report-intro" aria-labelledby="report-title">
          <div className="report-title-block">
            <span className="section-kicker">EXECUTIVE READOUT</span>
            <h1 id="report-title">{report.strategy.name}</h1>
            <p>{report.headline}</p>
          </div>
          <dl className="run-context">
            <div><dt>시장</dt><dd>{report.strategy.symbol}</dd></div>
            <div><dt>기준 시간봉</dt><dd>{report.strategy.timeframe}</dd></div>
            <div><dt>데이터 품질</dt><dd>{report.dataset.qualityStatus} · 미해결 gap {report.dataset.unresolvedGapCount}건</dd></div>
          </dl>
        </section>

        <div className="interpretation-line">
          <Info aria-hidden="true" />
          <p>{report.interpretation}</p>
        </div>

        <EvaluationWindows report={report} />
        <MetricComparison report={report} />
        <CostComparison report={report} />
        <LiquidationBoundary report={report} />
        <Evidence report={report} />
        <TradeManifest report={report} />

        <footer className="report-footer">
          <p><strong>판단 경계:</strong> 이 화면은 recorded fixture를 설명할 뿐 전략 승인, 주문 생성, 수익 보장을 수행하지 않습니다.</p>
          <span>{report.sourceLabel}</span>
        </footer>
      </main>
    </>
  )
}

function ReportSkeleton() {
  return (
    <main className="report-state-page" aria-live="polite" aria-busy="true">
      <MockDataLabel />
      <div className="skeleton-line is-short" />
      <div className="skeleton-line is-title" />
      <div className="skeleton-grid"><div /><div /><div /><div /></div>
      <p>백테스트 artifact를 검증하고 있습니다.</p>
    </main>
  )
}

function ReportState({ state }: { state: Exclude<BacktestReportViewState, { status: 'READY' }> }) {
  if (state.status === 'LOADING') return <ReportSkeleton />
  const isError = state.status === 'ERROR'
  const isInvalid = state.status === 'INVALID'
  const title = isError
    ? '결과 화면을 불러오지 못했습니다.'
    : isInvalid
      ? '결과가 표시 계약을 통과하지 못했습니다.'
      : '표시할 백테스트 결과가 없습니다.'
  const description = isError || isInvalid
    ? state.message
    : 'BacktestResult와 trade manifest가 준비되면 같은 경계를 거쳐 표시됩니다.'
  return (
    <main className="report-state-page" role={isError || isInvalid ? 'alert' : 'status'}>
      <MockDataLabel />
      {isError || isInvalid ? <CircleAlert aria-hidden="true" /> : <FileClock aria-hidden="true" />}
      <h1>{title}</h1>
      <p>{description}</p>
      <small>{isInvalid ? '원본 artifact와 semantic verifier를 확인하세요.' : '임의의 수치를 채우지 않습니다.'}</small>
    </main>
  )
}

export function BacktestExecutiveReport({ state }: BacktestExecutiveReportProps) {
  if (state.status !== 'READY') return <ReportState state={state} />
  return <ReadyReport report={state.report} />
}
