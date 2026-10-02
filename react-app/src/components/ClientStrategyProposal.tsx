import { useEffect, useId, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { proposalRequestExcerpt, strategyProposalText } from '../client-strategy-proposal-copy'
import { strategyActionsText } from '../client-strategy-actions-copy'
import { sharedNumber, sharedPercent } from '../client-shared-number-format'
import '../client-strategy-proposal.css'

/** Presentation data only. The caller owns calculation, version checks and apply authority. */
export type ClientStrategyProposalMetrics = { ret: number; mdd: number; n: number; winRate: number }
export type ClientStrategyProposalData = {
  strategyId: string
  baseVersion: string
  request: string
  rows: readonly { label: string; current: string; proposed: string; delta: string }[]
  notes: readonly string[]
  unsupported: readonly string[]
  before: ClientStrategyProposalMetrics
  after: ClientStrategyProposalMetrics
  score: number
  passes: boolean
}
export type ClientStrategyProposalProps = {
  proposal: ClientStrategyProposalData
  /** Display only, excluded from candidate identity. Arrays must correspond to the original
   * lengths/order/meaning; the caller owns semantic correspondence, not apply authority. */
  presentation?: Pick<ClientStrategyProposalData, 'rows' | 'notes' | 'unsupported'>
  running: boolean
  stale?: boolean
  onCancel: () => void
  onApply?: () => Promise<void>
}

const tone = (value: number) => value > 0 ? 'up' : value < 0 ? 'dn' : 'zz'

export function ClientStrategyProposal(props: ClientStrategyProposalProps) {
  // An old request may settle after a replacement proposal. Keep its UI lifetime separate.
  return <ProposalView key={JSON.stringify(props.proposal)} {...props} />
}

function ProposalView({ proposal, presentation, running, stale = false, onCancel, onApply }: ClientStrategyProposalProps) {
  const { language } = useClientPreferences()
  const t = (key: Parameters<typeof strategyProposalText>[1], values?: Readonly<Record<string, string>>) => strategyProposalText(language, key, values)
  const percentage = (value: number) => sharedPercent(value, language)
  const drawdown = (value: number) => sharedPercent(value, language, 1, false)
  const titleId = useId()
  const stateId = useId()
  const mounted = useRef(false)
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const displayMatches = !presentation || (['rows', 'notes', 'unsupported'] as const).every(field => presentation[field].length === proposal[field].length)
  const valid = displayMatches && proposal.strategyId.trim().length > 0 && proposal.baseVersion.trim().length > 0 && proposal.rows.length > 0
    && [proposal.score, ...Object.values(proposal.before), ...Object.values(proposal.after)].every(Number.isFinite)
  const disabled = pending || submitted || stale || !proposal.passes || !onApply || !valid
  async function apply() {
    if (disabled || locked.current || !onApply) return
    locked.current = true
    setPending(true)
    setError(false)
    try {
      await onApply()
      if (mounted.current) setSubmitted(true)
      // The caller supplies the resulting state/removes the proposal; never auto-cancel.
    } catch {
      if (mounted.current) {
        locked.current = false
        setError(true)
      }
    } finally {
      if (mounted.current) setPending(false)
    }
  }
  const { before, after } = proposal
  const display = displayMatches && presentation ? presentation : proposal
  return <section className="client-strategy-proposal tft-diff num" aria-labelledby={titleId} aria-busy={pending}>
    <h3 className="dh4" id={titleId}>{t('title')} <small>{t('subtitle', { version: proposal.baseVersion })}</small></h3>
    <div className="comparison-scroll" role="region" aria-label={t('comparison')} tabIndex={0}>
      <table className="dt3">
        <colgroup><col className="field-column" /><col /><col /><col className="delta-column" /></colgroup>
        <thead><tr><th scope="col">{t('field')}</th><th scope="col">CURRENT</th><th scope="col">PROPOSED</th><th scope="col">Δ</th></tr></thead>
        <tbody>{display.rows.map((row, index) => <tr key={index}><th scope="row">{row.label}</th><td className="cu">{row.current}</td><td className="pp2">{row.proposed}</td><td className="dl">{row.delta}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="imp">
      <span><small>{t('return')}</small><b>{percentage(before.ret)} → <em className={tone(after.ret - before.ret)}>{percentage(after.ret)}</em></b></span>
      <span><small>{t('drawdown')}</small><b>{drawdown(before.mdd)} → <em className={tone(after.mdd - before.mdd)}>{drawdown(after.mdd)}</em></b></span>
      <span><small>{t('trades')}</small><b>{t('tradesValue', { before: sharedNumber(before.n, language, 'auto'), after: sharedNumber(after.n, language, 'auto') })}</b></span>
      <span><small>{t('score')}</small><b className={proposal.passes ? 'up' : 'dn'}>{t('scoreValue', { score: sharedNumber(proposal.score, language, 'auto'), status: t(proposal.passes ? 'passed' : 'below') })}</b></span>
    </div>
    {display.notes.length > 0 && <p className="nt2">{display.notes.join(', ')}</p>}
    {display.unsupported.length > 0 && <p className="nt2 warn">{t('unsupported', { items: display.unsupported.join(', ') })}</p>}
    <p className="nt2">{t('original', { request: proposalRequestExcerpt(proposal.request) })}</p>
    {running && <p className="nt2">{t('stopNotice').split('{status}')[0]}<b>{t('stopped')}</b>{t('stopNotice').split('{status}')[1]}</p>}
    <div id={stateId}>
      {stale && <p className="nt2 warn" role="alert">{t('stale')}</p>}
      {!valid && <p className="nt2 warn" role="alert">{t('invalid')}</p>}
      {!onApply && <p className="nt2">{t('unavailable')}</p>}
      {error && !stale && <p className="nt2 warn" role="alert">{strategyActionsText(language, 'failed')}</p>}
      {pending && <p className="nt2" role="status">{t('pending')}</p>}
    </div>
    <div className="acts2">
      <button type="button" className="rej" disabled={pending} onClick={onCancel}>{t('cancel')}</button>
      <button type="button" className="ap" disabled={disabled} aria-describedby={stateId} title={!proposal.passes ? t('belowTitle') : undefined} onClick={() => { void apply() }}>
        {t(proposal.passes ? running ? 'stopApply' : 'apply' : 'cannotApply')}
      </button>
    </div>
  </section>
}
