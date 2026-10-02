import { ClientFollowups } from './ClientFollowups'
import { useClientPreferences } from '../client-preferences'
import { marketBindingKey, type MarketResponseBinding } from '../client-market-response-presentation'
import { CONTINUE_RESPONSE_PROMPT, type ContinueResponseAction } from '../client-continuation'
import { followupText } from '../client-followup-copy'

/** Same source .g-nextq, independent of whether the host is preview or service. */
export function ClientContinueResponse({ binding, partialText, busy, restored, onContinue }: {
  binding: MarketResponseBinding; partialText: string; busy?: boolean; restored?: boolean; onContinue?: ContinueResponseAction
}) {
  const { language } = useClientPreferences()
  if (!partialText.trim() || !marketBindingKey(binding)) return null
  return <ClientFollowups key={JSON.stringify([marketBindingKey(binding), partialText])}
    presentation={{ binding, actions: [], questions: [{ id: 'continue', label: '이어서 계속', text: CONTINUE_RESPONSE_PROMPT }], showFreeBadge: false, restored }}
    questionLabels={{ continue: followupText(language, 'continue') }}
    actions={{ busy, activate: onContinue ? (selection, signal) => selection.kind === 'question' && selection.item.id === 'continue'
      ? onContinue({ binding: { ...binding }, partialText, prompt: CONTINUE_RESPONSE_PROMPT }, signal) : false : undefined }}/>
}
