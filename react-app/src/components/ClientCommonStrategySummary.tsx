import { useId } from 'react'
import type { ClientTurn } from '../client-experience-store'
import { decodeInlineInput } from '../client-inline-backtest'
import { commonBacktestText } from '../client-common-backtest-copy'
import { commonDate, type CommonBacktestPreview } from '../client-common-backtest-preview'
import { useClientPreferences } from '../client-preferences'
import '../client-common-strategy-summary.css'
import { sourceIntakeRows, sourceIntakeText } from '../client-source-intake-copy'
import { responseStrategyForTurn } from '../client-response-strategy'

/** Source tf-sum / tfVerifyGo presentation over the immutable preview request.
 * Provider-authored strategy sheets and live price claims are not synthesized. */
export default function ClientCommonStrategySummary({ turn, state, busy, onOpen, onEdit }: {
  turn: ClientTurn; state?: CommonBacktestPreview; busy: boolean; onOpen: () => void; onEdit?: () => void
}) {
  const { language } = useClientPreferences()
  const id = useId()
  const input = decodeInlineInput(turn.inlineRequest)
  const proposal = responseStrategyForTurn(turn)
  const t = (key: Parameters<typeof commonBacktestText>[1]) => commonBacktestText(language, key)
  if (!input) return null
  const selected = state?.turnId === turn.id ? state : undefined
  if (turn.commonBacktestOpened || selected) return <section className="client-strategy-summary is-visited" data-testid="common-strategy-summary" aria-label={`${input.pair} ${t('verifying')}`}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.2l2.4 2.4 4.6-5" /></svg>
    <span>{input.pair} {t('verifying')}</span><button type="button" disabled={busy} onClick={onOpen}>{t('resume')}</button>
  </section>
  const p = input.parameters
  const fmt = new Intl.NumberFormat(language, { maximumFractionDigits: 10 })
  const period = proposal?.period ?? 730
  const start = period ? Math.max(p.startI, p.endI - period + 1) : p.startI
  const rows = turn.sourceIntake ? sourceIntakeRows(turn.sourceIntake, language) : [
    [t('asset'), input.pair],
    [t('buyWhen'), `${proposal || input.requestedRsi !== undefined ? t('rsiRebound').replace('{rsi}', fmt.format(p.rsiTh)) : p.rsiTh === 44 ? t('rebound') : `RSI(n−1) < ${fmt.format(p.rsiTh)} · ΔP > 0.5%`}${p.trendFilter ? `, ${t('clearTrend')}` : ''}${input.requestedRsi !== undefined && input.requestedRsi !== p.rsiTh ? ` (RSI ${fmt.format(input.requestedRsi)} → ${fmt.format(p.rsiTh)} · 5–70)` : ''}`],
    [t('sellWhen'), `${p.tp !== null ? t('takeRule').replace('{take}', fmt.format(p.tp)) + ' ' : ''}${t('exitRule').replace('{stop}', fmt.format(p.sl))}`],
    [t('testPeriod'), `${commonDate(start)} → ${commonDate(p.endI)}`],
  ]
  if (proposal?.excludedConditions.length) rows.push([t('excludedConditions'), proposal.excludedConditions.join(', ')])
  return <section className="client-strategy-summary" data-testid="common-strategy-summary" aria-labelledby={id}>
    <h3 id={id} tabIndex={-1}>{proposal?.name ?? (turn.sourceIntake ? sourceIntakeText(language, 'summary') : t('summaryTitle'))}</h3>
    <dl>{rows.map(([label, value], index) => <div key={label}>
      <dt>{label}</dt><dd>{value}</dd>
      {turn.sourceIntake && index === rows.length - 1 && onEdit && <button className="summary-edit" type="button" disabled={busy} onClick={onEdit}>{t('revise')}</button>}
    </div>)}</dl>
    <div className="summary-note">
      {!turn.sourceIntake && <p className="summary-timeframe">{t('requestedFrame')}: {input.timeframe === '일봉' ? t('daily') : t('frameHour')} · {t('timeframe')}: {t('daily')}</p>}
      <p>{t('summaryPreview')}</p>
    </div>
    <button className="summary-open" type="button" disabled={busy} onClick={onOpen}>{t('open')}</button>
  </section>
}
