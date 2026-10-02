import { useClientPreferences } from '../client-preferences'
import { sharingDetailCopy, type SharingDetailCopyKey } from '../client-sharing-detail-copy'
import { sharingUnavailable, type SharedMetricKey, type SharedMetricPresentation, type SharedScoreAxisKey } from '../client-sharing-presentation'
import { sharedNumber } from '../client-shared-number-format'

const axes: readonly [SharedScoreAxisKey, SharingDetailCopyKey][] = [
  ['winRate', '승률'], ['cagr', '수익 (CAGR)'], ['mdd', '낙폭 방어'], ['tradeVol', '거래 활동'],
]
const percent = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
const points = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 99
const text = (value: string | undefined): value is string => typeof value === 'string' && value.trim().length > 0

/** Source tfSS3ScoreSheet / tfSS3MetricSheet structure. Presentation only;
 * neither score formula, median, penalties, thresholds nor fee assumptions are
 * reconstructed from preview records or other visible marketplace strategies. */
export function ClientSharedMetricDetails({ metric, data }: { metric: SharedMetricKey; data: SharedMetricPresentation | null }) {
  const { language } = useClientPreferences()
  const d = (key: SharingDetailCopyKey, values?: Record<string, string | number>) => sharingDetailCopy(language, key, values)
  const unavailable = sharingUnavailable(language)
  const score = data?.score
  const matches = Array.isArray(data?.definitions) ? data.definitions.filter(definition => definition?.key === metric) : []
  const definition = matches.length === 1 && text(matches[0].description) ? matches[0] : undefined
  if (metric !== 'score') return <div className="ss3-cp" data-shared-metric={metric} style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
    {text(definition?.valueLabel) && <p className="num"><b>{definition.valueLabel}</b></p>}
    <div className="ntc" style={{ fontSize: '13.5px', lineHeight: 1.7 }}>{definition?.description ?? unavailable}</div>
    {data?.sourceLabel && <p className="mt2">{text(definition?.sourceLabel) ? definition.sourceLabel : data.sourceLabel}</p>}
  </div>
  return <div className="ss3-cp" data-shared-metric="score" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
    <div className="ntc">{text(score?.description) ? score.description : definition?.description ?? unavailable}</div>
    {axes.map(([key, label]) => {
      const matches = score?.axes.filter(axis => axis?.key === key) ?? []
      const axis = matches.length === 1 ? matches[0] : undefined
      const hasPoints = points(axis?.contribution) && points(axis?.maximum) && axis.contribution <= axis.maximum
      const hasBar = hasPoints && percent(axis?.barPercent)
      const benchmark = axis?.benchmark && text(axis.benchmark.valueLabel) && text(axis.benchmark.comparisonLabel) && percent(axis.benchmark.barPercent) ? axis.benchmark : undefined
      const contribution = hasPoints ? sharedNumber(axis!.contribution!, language) : '—'
      const maximum = hasPoints ? d('{points}점', { points: sharedNumber(axis!.maximum!, language, 'auto') }) : '—'
      const benchmarkLabel = benchmark ? d('공유 전략 중앙값 {value}', { value: benchmark.valueLabel }) : undefined
      return <div className="ss3-score-axis scax" data-score-axis={key} key={key}>
        <div className="hd3"><span>{d(label)} <small className="num">{text(axis?.valueLabel) ? axis.valueLabel : '—'}</small></span><span className="num">{d('기여')} <b>{contribution}</b> / {maximum}</span></div>
        <div className="ss3-score-bar scbar" role="img" aria-label={`${d(label)}: ${hasBar ? `${d('기여')} ${contribution} / ${maximum}` : unavailable}${benchmarkLabel ? `; ${benchmarkLabel}` : ''}`}>
          {hasBar && <i style={{ width: `${axis!.barPercent}%` }} />}
          {benchmark && <u style={{ left: `${benchmark.barPercent}%`, transform: 'translateX(-50%)' }} title={benchmarkLabel} />}
        </div>
        {benchmark ? <small>{benchmarkLabel} · {benchmark.comparisonLabel}</small> : <small>{unavailable}</small>}
        {!hasBar && benchmark && <p className="mt2">{unavailable}</p>}
      </div>
    })}
    {Array.isArray(score?.notices) && score.notices.filter(text).map((notice, index) => <div className="warn3" key={index}>{notice}</div>)}
    {text(score?.criteria) && <p className="mt2">{score.criteria}</p>}
    {data?.sourceLabel && <p className="mt2">{data.sourceLabel}</p>}
  </div>
}
