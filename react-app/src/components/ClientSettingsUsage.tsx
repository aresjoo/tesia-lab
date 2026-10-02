import { useLayoutEffect, useRef, useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { ClientSettingsModal } from './ClientSettingsModal'
import { usagePresentationBound, usageResetLabel, usageText, usageTopupAmounts, type UsagePresentation, type UsageTier, type UsageTopupAmount } from '../client-usage-presentation'
import '../client-usage.css'

export type ClientSettingsUsageProps = {
  showHeading?: boolean
  presentation?: UsagePresentation | null; scope?: string | null
  onNext?: (tier: UsageTier) => void
  /** Request only. A fulfilled callback does not change credit or payment state. */
  onTopup?: (amount: UsageTopupAmount, signal: AbortSignal) => Promise<void>
  onAutoTopup?: (enabled: boolean, signal: AbortSignal) => Promise<void>
}

export function ClientSettingsUsage(props: ClientSettingsUsageProps) {
  // Owner/month/source replacements retire drafts and in-flight observations.
  return <UsagePage key={JSON.stringify([props.scope, props.presentation?.scope, props.presentation?.source, props.presentation?.month])} {...props} />
}
function UsagePage({ presentation, scope, onNext, onTopup, onAutoTopup, showHeading = true }: ClientSettingsUsageProps) {
  const { language } = useClientPreferences()
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)
  const supplied = usagePresentationBound(presentation, scope), value = supplied ? presentation : null
  const pct = value?.pct, tier = value?.tier
  const reset = usageResetLabel(value?.resetAt ?? null, language)
  const credit = value?.creditUsd
  const next = tier ? usageText(language, `next${tier}`) : ''
  return <div className="client-settings-usage" data-usage-source={value?.source ?? 'unavailable'}>
    {showHeading && <h1 tabIndex={-1}>{usageText(language, 'title')}</h1>}
    <section className="stg-sec"><div className="stg-card use-card">
      <div className="use-h"><b>{usageText(language, 'month')}</b><span className="num">{supplied ? `${pct}%` : '—'}</span></div>
      <div className="use-track" role="progressbar" aria-label={usageText(language, 'month')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={supplied ? pct! : undefined} aria-valuetext={supplied ? undefined : usageText(language, 'unavailable')}><i style={{ width: supplied ? `${pct}%` : '0%' }} /></div>
      <p className="use-sub">{reset ? usageText(language, 'reset', { date: reset }) : usageText(language, 'unavailable')}{supplied && pct! >= 100 ? ` ${usageText(language, 'paused')}` : ''}</p>
    </div></section>
    <section className="stg-sec"><div className="stg-card"><div className="stg-r"><div className="k"><b>{usageText(language, 'mode')}</b>{tier && <span>{usageText(language, `${tier}How`)}</span>}</div><div className="v">{tier ? usageText(language, tier) : '—'}</div>
      {tier && pct! >= 80 && <div className="a"><button type="button" className="stg-b p" disabled={tier === 'CARD_UID' ? !onTopup : !onNext} onClick={event => {
        if (tier === 'CARD_UID' && onTopup) setTrigger(event.currentTarget)
        else onNext?.(tier)
      }}>{next}</button></div>}
    </div></div></section>
    {(tier === 'CARD_UID' || tier === 'UID') && <section className="stg-sec"><div className="stg-card"><div className="stg-r"><div className="k"><b>{usageText(language, 'credit')}</b></div><div className="v num">{typeof credit === 'number' && Number.isFinite(credit) && credit >= 0 ? '$' + credit.toLocaleString(language, { maximumFractionDigits: 2 }) : '—'}</div></div></div></section>}
    {trigger && tier === 'CARD_UID' && supplied && <ClientSettingsModal title={next} trigger={trigger} onClose={() => setTrigger(null)} closeLabel={usageText(language, 'close')}>
      <UsageTopup presentation={presentation} onTopup={onTopup} onAutoTopup={onAutoTopup} />
    </ClientSettingsModal>}
  </div>
}
function UsageTopup({ presentation, onTopup, onAutoTopup }: Pick<ClientSettingsUsageProps, 'onTopup' | 'onAutoTopup'> & { presentation: UsagePresentation }) {
  const { language } = useClientPreferences()
  const request = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false)
  useLayoutEffect(() => () => { request.current?.abort(); request.current = null }, [])
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    if (request.current) return
    const controller = new AbortController(); request.current = controller; setPending(true); setFailed(false)
    try { await action(controller.signal) }
    catch { if (!controller.signal.aborted && request.current === controller) setFailed(true) }
    finally { if (request.current === controller) { request.current = null; setPending(false) } }
  }
  return <div className="client-usage-topup" aria-busy={pending}>
    <p className="stg-note">{usageText(language, 'topupHint')}</p>
    <div className="use-amts">{usageTopupAmounts.map(amount => <button type="button" className="use-amt" key={amount} disabled={pending || !onTopup} onClick={() => { if (onTopup) void run(signal => onTopup(amount, signal)) }}>${amount}</button>)}</div>
    <label className="use-auto">{typeof presentation.autoTopup === 'boolean' ? <input type="checkbox" checked={presentation.autoTopup} disabled={pending || !onAutoTopup} onChange={event => { const enabled = event.currentTarget.checked; if (onAutoTopup) void run(signal => onAutoTopup(enabled, signal)) }} /> : <span aria-label={usageText(language, 'unavailable')}>—</span>}{usageText(language, 'auto')}</label>
    {failed && <p role="alert" className="er">{usageText(language, 'failed')}</p>}
  </div>
}
