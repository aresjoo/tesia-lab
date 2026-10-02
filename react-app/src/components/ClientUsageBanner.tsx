import { useState } from 'react'
import { useClientPreferences } from '../client-preferences'
import { usageBannerVisible, usageText, type UsageDismissal, type UsagePresentation, type UsageTier } from '../client-usage-presentation'
import '../client-usage.css'

/** Put this slot above the composer/dock. Dismissal has no admission authority. */
export function ClientUsageBanner({ presentation, scope, onNext, dismissed, onDismiss }: {
  presentation?: UsagePresentation | null; scope?: string | null
  onNext?: (tier: UsageTier) => void
  dismissed?: UsageDismissal | null; onDismiss?: (dismissal: UsageDismissal) => void
}) {
  const { language } = useClientPreferences()
  const [localDismissal, setLocalDismissal] = useState<UsageDismissal | null>(null)
  if (!usageBannerVisible(presentation, scope, dismissed ?? localDismissal) || !presentation?.tier || !scope) return null
  const full = presentation.pct! >= 100
  return <div id="g-usebar" data-usage-source={presentation.source}><div className={`use-bar${full ? ' full' : ''}`} role="status">
    <span>{usageText(language, full ? 'full' : 'warning', { pct: presentation.pct! })}</span>
    <button type="button" className="use-go" disabled={!onNext} onClick={() => onNext?.(presentation.tier!)}>{usageText(language, `next${presentation.tier}`)}</button>
    {!full && <button type="button" className="use-x" aria-label={usageText(language, 'close')} onClick={() => {
      const dismissal = { scope, month: presentation.month }
      setLocalDismissal(dismissal); onDismiss?.(dismissal)
    }}>✕</button>}
  </div></div>
}
