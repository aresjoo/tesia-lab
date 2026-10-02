import { useId, useLayoutEffect, useRef } from 'react'
import { useClientPreferences } from '../client-preferences'
import type { NativeJob, NativeReport } from './native-service-api'
import { nativeResultText, type NativeResultTextKey } from './native-result-copy'
import { formatResultRatePercent } from './native-result-number-format'
import { nativeInlineResultCopy } from './native-inline-result-copy'
import { nativeWorkflowText } from './native-workflow-copy'
import { professionalChartLocale } from '../client-professional-chart-locale'
import './native-report-document.css'

type Props = {
  report: NativeReport | null
  job: NativeJob
  error: boolean
  previous?: boolean
  detailState?: 'loading' | 'ready' | 'error'
  onOpenAnalysis: () => void
  onEditDraft?: () => void
  editDisabled?: boolean
  onOpenTrades?: () => void
  onReplay?: () => void
  replayAvailable?: boolean
  reducedReplayNotice?: boolean
  tradeSegment?: 'IS' | 'OOS'
  onRetry: () => void
  announce?: boolean
}

const rateRows = [
  ['metricNetReturn', 'netReturnRate'],
  ['metricBuyAndHold', 'buyAndHoldReturnRate'],
  ['metricMdd', 'maxDrawdownRate'],
  ['metricWinRate', 'winRate'],
] as const
const valueRows = [
  ['initialCapital', 'metrics', 'initialCapital'],
  ['finalEquity', 'metrics', 'finalEquity'],
  ['tradeCountRow', 'summary', 'tradeCount'],
  ['netPnlRow', 'summary', 'netPnl'],
  ['feeCostRow', 'costs', 'feeCost'],
  ['slippageCostRow', 'costs', 'slippageCost'],
  ['fundingCashflowRow', 'costs', 'fundingCashflow'],
] as const
const bindingRows = [
  ['bindingJob', 'backtestId'], ['bindingReportHash', 'nativeEnvelopeContentHash'],
  ['bindingProjectionHash', 'projectionContentHash'], ['bindingTerminalSealHash', 'terminalSealContentHash'],
] as const

/** Source gDocReport/gDocBacktest document treatment, using only the native
 * reader's verified report. No second reader, cache, aggregate or verdict.
 * Decimal money values and server identifiers remain exact source strings. */
export function NativeReportDocument({ report, job, error, previous = false, detailState, onOpenAnalysis, onOpenTrades, onReplay, replayAvailable = false, reducedReplayNotice = false, tradeSegment, onRetry, announce = false, onEditDraft, editDisabled = false }: Props) {
  const { language } = useClientPreferences()
  const titleId = useId()
  const root = useRef<HTMLElement>(null)
  const retryFocusPending = useRef(false)
  const r = (key: NativeResultTextKey, values: Readonly<Record<string, string | number>> = {}) => nativeResultText(language, key, values)
  const copy = nativeInlineResultCopy[language]
  const bound = !error && report?.binding.backtestId === job.backtestId ? report : null
  const projection = bound?.nativeEnvelope.projection
  const rate = (value: string) => formatResultRatePercent(value, r('tinyNegative')) ?? r('rateOutOfRange')
  const period = (from: string, to: string) => r('periodRange', { from: '{from}', to: '{to}' }).split(/(\{from\}|\{to\})/).map((part, index) => {
    const timestamp = part === '{from}' ? from : part === '{to}' ? to : null
    return timestamp === null ? part : <time className="nrd-date" key={index} dateTime={timestamp}>{timestamp}</time>
  })
  const retry = () => {
    retryFocusPending.current = Boolean(root.current?.contains(document.activeElement))
    onRetry()
  }
  useLayoutEffect(() => {
    if (!retryFocusPending.current) return
    if (document.activeElement === document.body && root.current?.getClientRects().length && !root.current.closest('[hidden],[inert]')) root.current.focus({ preventScroll: true })
    retryFocusPending.current = false
  }, [bound, error, detailState])

  return <article ref={root} tabIndex={-1} className="native-report-document" aria-labelledby={titleId} data-testid="native-report-document"
    data-backtest-id={job.backtestId} data-state={projection ? 'ready' : error ? 'error' : 'loading'}
    data-native-evidence={projection?.evidenceClass} data-previous={previous}>
    <header className="nrd-heading"><h3 id={titleId}>{r('resultTitle')}</h3>
      {previous && <p className="nrd-previous">{nativeWorkflowText(language, 'priorResult')}<br />
        {nativeWorkflowText(language, 'approvedVersion')} <code>{job.strategyVersionId}</code>
      </p>}
    </header>
    {projection && bound ? <>
      <p className="nrd-note nrd-evidence" data-testid="native-report-document-evidence">{r(projection.evidenceClass === 'SYNTHETIC_CONTRACT_FIXTURE' ? 'syntheticNotice' : 'historicalNotice')}</p>
      {detailState && detailState !== 'ready' && <p className="nrd-status" data-testid="native-report-document-detail-status"
        role={announce ? detailState === 'error' ? 'alert' : 'status' : undefined}>{copy[detailState === 'error' ? 'detailError' : 'detailLoading']}</p>}
      {projection.segments.map(segment => <section className="nrd-segment" key={segment.segment} data-native-segment={segment.segment} aria-label={copy[segment.segment]}>
        <h4>{copy[segment.segment]}</h4>
        <p className="nrd-note nrd-period"><span>{r('periodUtc')}</span><br />{period(segment.evaluationStartInclusive, segment.evaluationEndExclusive)}</p>
        <dl className="nrd-vstat">
          {rateRows.map(([label, field]) => <div key={field}><dt>{r(label)}</dt><dd data-native-metric={field}>{rate(segment.metrics[field])}</dd></div>)}
          <div><dt>{r('tradeCountRow')}</dt><dd data-native-metric="tradeCount">{segment.summary.tradeCount}</dd></div>
        </dl>
        <dl className="nrd-rows"><div><dt>{r('netPnlRow')}</dt><dd data-native-metric="netPnl">{segment.summary.netPnl}</dd></div></dl>
      </section>)}
      <div className="nrd-actions">
        <button className="nrd-primary" type="button" onClick={onOpenAnalysis}>{r('viewOnChart')}</button>
        {!previous && onEditDraft && <button type="button" data-native-edit-draft aria-disabled={editDisabled}
          onKeyDown={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault() }}
          onClick={event => { if (editDisabled) return; event.currentTarget.focus({ preventScroll: true }); onEditDraft() }}>{copy.edit}</button>}
        {onOpenTrades && <button type="button" aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); onOpenTrades() }}>{tradeSegment ? r('segmentTradesTitle', { segment: tradeSegment }) : r('tradesTab')}</button>}
        {onReplay && <button className="nrd-replay" type="button" aria-haspopup="dialog" disabled={!replayAvailable} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onReplay() }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z" strokeLinejoin="round" /></svg>
          <span>{professionalChartLocale(language).t('replay')}</span>
        </button>}
        {detailState === 'error' && <button type="button" onClick={retry}>{r('reloadResultDetail')}</button>}
      </div>
      <p className="nrd-note nrd-replay-notice" role={announce ? 'status' : undefined} aria-atomic="true" data-testid="native-report-replay-notice">{reducedReplayNotice ? professionalChartLocale(language).t('reduced') : ''}</p>
      <p className="nrd-note">{r('percentRounding')}</p>
      <p className="nrd-limitation" data-testid="native-report-document-limitations">{r('limitationHeadline')}</p>
      <details className="nrd-details" data-testid="native-report-document-values">
        <summary>{r('comparisonCaption')}</summary>
        <div className="nrd-table-scroll" role="region" aria-label={r('comparisonTableRegion')} tabIndex={0}>
          <table><caption>{r('comparisonCaption')}</caption>
            <thead><tr><th scope="col">{r('metricColumn')}</th>{projection.segments.map(segment => <th scope="col" key={segment.segment}>{segment.segment}</th>)}</tr></thead>
            <tbody>{valueRows.map(([label, group, field]) => <tr key={field} data-native-row={field}><th scope="row">{r(label)}</th>
              {projection.segments.map(segment => <td key={segment.segment} data-native-segment={segment.segment}>{
                group === 'metrics' ? segment.metrics[field] : group === 'summary' ? segment.summary[field] : segment.costs[field]
              }</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <p className="nrd-note">{r('slippageIncluded')}</p>
      </details>
      <details className="nrd-details" data-testid="native-report-document-raw-rates">
        <summary>{r('viewRawRates')}</summary>
        <div className="nrd-table-scroll" role="region" aria-label={r('rawRateTableRegion')} tabIndex={0}>
          <table><caption>{r('rawRateCaption')}</caption>
            <thead><tr><th scope="col">{r('metricColumn')}</th>{projection.segments.map(segment => <th scope="col" key={segment.segment}>{segment.segment}</th>)}</tr></thead>
            <tbody>{rateRows.map(([label, field]) => <tr key={field}><th scope="row">{r(label)}</th>{projection.segments.map(segment =>
              <td key={segment.segment} data-native-segment={segment.segment} data-native-raw={field}>{segment.metrics[field]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
      <details className="nrd-details">
        <summary>{r('limitationsSummary')}</summary>
        <div className="nrd-prose" aria-label={r('assumptionsRegion')}>
          <p>{r('nonCausalFill')}</p><p>{r('symbolRuleSubstitute')}</p>
          <p>{r('mddSampling')}</p><p>{r('independentSegments')}</p>
        </div>
        <details className="nrd-details nrd-policy">
          <summary>{r('serverPolicies')}</summary>
          <p className="nrd-raw-text">{projection.splitPolicy}</p>
          {projection.segments.map(segment => <section key={segment.segment}>
            <h4>{r('segmentPolicy', { segment: segment.segment })}</h4>
            <p className="nrd-raw-text">{segment.initialStatePolicy}</p>
            <p className="nrd-raw-text">{segment.costs.slippagePolicy}</p>
            <div className="nrd-raw-text">{Object.entries(segment.limitations).map(([key, value]) => <p key={key}><code>{key}={String(value)}</code></p>)}</div>
          </section>)}
        </details>
      </details>
      <details className="nrd-details" data-testid="native-report-document-binding">
        <summary>{r('sourceAndIntegrity')}</summary>
        <dl className="nrd-rows nrd-raw-rows">{bindingRows.map(([label, field]) => <div key={field}><dt>{r(label)}</dt><dd data-native-binding={field}>{String(bound.binding[field])}</dd></div>)}</dl>
        <div className="nrd-raw-text">{Object.entries(bound.binding).filter(([key]) => !bindingRows.some(([, field]) => field === key)).map(([key, value]) => <p key={key}><code>{key}=<span data-native-binding={key}>{String(value)}</span></code></p>)}</div>
      </details>
    </> : <>
      <p className="nrd-status" role={announce ? error ? 'alert' : 'status' : undefined}>{r(error ? 'reportFetchFailed' : 'verifyingReport')}</p>
      {error && <div className="nrd-actions"><button type="button" onClick={retry}>{r('retryReport')}</button></div>}
      <p className="nrd-limitation" data-testid="native-report-document-limitations">{r('limitationHeadline')}</p>
    </>}
  </article>
}
