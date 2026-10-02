import { ClientInsights, type ClientInsightsProps } from '../components/ClientInsights'
import { ClientInsightQuestionError } from '../client-insight-navigation'
import { useClientPreferences } from '../client-preferences'
import { insightPresentationCopy } from '../client-insight-presentation-copy'

export type NativeInsightsProps = Omit<Pick<ClientInsightsProps, 'data' | 'controlledLocation' | 'onNavigate' | 'locationHref' | 'onAsk' | 'signedIn' | 'onLogin' | 'onFeedback'>, 'onAsk'> & {
  onAsk?: ClientInsightsProps['onAsk']
  onReturn: () => void
  shouldFocus: () => boolean
}

/** Same original renderer, with an explicit no-fixture service boundary. */
export function NativeInsights({ onReturn, shouldFocus, onAsk, ...props }: NativeInsightsProps) {
  const { language } = useClientPreferences()
  const unavailableQuestion = async () => { throw new ClientInsightQuestionError(insightPresentationCopy[language].questionUnavailable) }
  return <ClientInsights {...props} source="service" onClose={onReturn} shouldFocus={shouldFocus} onAsk={onAsk ?? unavailableQuestion} />
}
