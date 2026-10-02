import { useId } from 'react'
import { useClientPreferences } from '../client-preferences'
import { NativeAnalysisInlineSummary } from './NativeAnalysisLayout'
import type { NativeJob, NativeReport } from './native-service-api'
import { nativeResultText, type NativeResultTextKey } from './native-result-copy'
import { formatResultRatePercent } from './native-result-number-format'
import { nativeWorkflowText } from './native-workflow-copy'
import { nativeInlineResultCopy } from './native-inline-result-copy'
import './native-inline-result.css'

type Props = { report: NativeReport | null; job: NativeJob; error: boolean; previous?: boolean; detailState?: 'loading' | 'ready' | 'error'; onEditDraft?: () => void; editDisabled?: boolean }
const rates = [
  ['metricNetReturn', 'netReturnRate'],
  ['metricMdd', 'maxDrawdownRate'],
  ['metricWinRate', 'winRate'],
] as const

/** Compact, read-only view of the SAME already-verified report owned by the
 * existing native result reader. No independent reader, score, chart or action
 * authority. A stale binding never contributes metrics or evidence labels. */
export function NativeInlineResult({ report, job, error, previous = false, detailState, onEditDraft, editDisabled = false }: Props) {
  const { language } = useClientPreferences()
  const titleId = useId()
  const r = (key: NativeResultTextKey, values: Readonly<Record<string, string | number>> = {}) => nativeResultText(language, key, values)
  const copy = nativeInlineResultCopy[language]
  const bound = !error && report?.binding.backtestId === job.backtestId ? report : null
  const projection = bound?.nativeEnvelope.projection
  const failed = error
  const rate = (value: string) => formatResultRatePercent(value, r('tinyNegative')) ?? r('rateOutOfRange')

  return <NativeAnalysisInlineSummary>{(openAnalysis, announce) => <section className="native-inline-result" aria-labelledby={titleId}
    data-testid="native-inline-result" data-backtest-id={job.backtestId} data-native-evidence={projection?.evidenceClass}
    data-state={projection ? 'ready' : failed ? 'error' : 'loading'} data-previous={previous}>
    <header className="nir-heading"><h3 id={titleId}>{copy.title}</h3></header>
    {previous && <p className="nir-previous">{nativeWorkflowText(language, 'priorResult')}<br />
      <span>{nativeWorkflowText(language, 'approvedVersion')} <code>{job.strategyVersionId}</code></span>
    </p>}
    {projection ? <>
      <p className="nir-evidence" data-testid="native-inline-evidence">{r(projection.evidenceClass === 'SYNTHETIC_CONTRACT_FIXTURE' ? 'syntheticNotice' : 'historicalNotice')}</p>
      {detailState && detailState !== 'ready' && <p className="nir-status" role={announce ? detailState === 'error' ? 'alert' : 'status' : undefined} data-testid="native-inline-detail-status">{copy[detailState === 'error' ? 'detailError' : 'detailLoading']}</p>}
      {projection.segments.map(segment => <section key={segment.segment} className="nir-segment" aria-label={copy[segment.segment]} data-native-segment={segment.segment}>
        <h4>{copy[segment.segment]}</h4>
        <p className="nir-period"><span>{r('periodUtc')}</span><br />{r('periodRange', { from: segment.evaluationStartInclusive, to: segment.evaluationEndExclusive })}</p>
        <dl className="nir-kpis">
          {rates.map(([label, field]) => <div key={field}><dt>{r(label)}</dt><dd data-native-metric={field}>{rate(segment.metrics[field])}</dd></div>)}
          <div><dt>{r('tradeCountRow')}</dt><dd data-native-metric="tradeCount">{segment.summary.tradeCount}</dd></div>
        </dl>
      </section>)}
      <details className="nir-details" data-testid="native-inline-raw-rates">
        <summary>{r('viewRawRates')}</summary>
        <p>{r('percentRounding')}</p>
        <p>{r('rawRateCaption')}</p>
        {projection.segments.map(segment => <section key={segment.segment}>
          <h4>{copy[segment.segment]}</h4>
          <dl className="nir-raw">{rates.map(([label, field]) => <div key={field}><dt>{r(label)}</dt><dd data-native-raw={field}>{segment.metrics[field]}</dd></div>)}</dl>
        </section>)}
      </details>
    </> : <p className="nir-status" role={announce ? failed ? 'alert' : 'status' : undefined}>{r(failed ? 'reportFetchFailed' : 'verifyingReport')}</p>}
    <p className="nir-limitation" data-testid="native-inline-limitations">{r('limitationHeadline')}</p>
    {projection && <details className="nir-details">
      <summary>{r('limitationsSummary')}</summary>
      <p>{r('nonCausalFill')}</p>
      <p>{r('symbolRuleSubstitute')}</p>
      <p>{r('mddSampling')}</p>
      <p>{r('independentSegments')}</p>
    </details>}
    <div className="nir-actions"><button className="nir-open" type="button" onClick={openAnalysis}>{copy.open}</button>
      {projection && !previous && onEditDraft && <button className="nir-open nir-edit" type="button" data-native-edit-draft aria-disabled={editDisabled}
        onKeyDown={event => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault() }}
        onClick={event => { if (editDisabled) return; event.currentTarget.focus({ preventScroll: true }); onEditDraft() }}>{copy.edit}</button>}
    </div>
  </section>}</NativeAnalysisInlineSummary>
}
