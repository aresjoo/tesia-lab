import { useId, useLayoutEffect, useRef, useState } from 'react'
import { clientResearchScrollport } from '../client-research-scrollport'
import { ClientBrokers } from '../components/ClientBrokers'
import { useClientPreferences } from '../client-preferences'
import { researchCopy, researchNavigationLabel } from '../client-research-copy'
import '../client-research-hub.css'
import { brokerPresentationBound, type BrokerServicePresentation } from '../client-broker-presentation'
import { brokerViewDataset, type BrokerViewState } from '../client-broker-view'

/** Source catalogue navigation only. No preview account, review or fee producer. */
type Props = {
  onReturn: () => void; shouldFocus: () => boolean; listRequest: number
  accountScope?: string | null; presentation?: BrokerServicePresentation; signedIn?: boolean; onLogin?: () => void
  viewState?: BrokerViewState | null; onViewStateChange?: (view: BrokerViewState) => void
}
export function NativeBrokers(props: Props) {
  const data = brokerPresentationBound(props.presentation, props.accountScope) ? props.presentation : undefined
  return <NativeBrokerSurface key={JSON.stringify([props.accountScope, brokerViewDataset(data)])} {...props} presentation={data} />
}
function NativeBrokerSurface({ onReturn, shouldFocus, listRequest, presentation, signedIn = false, onLogin, accountScope, viewState, onViewStateChange }: Props) {
  const { language } = useClientPreferences()
  const [detailTitle, setDetailTitle] = useState('지원 거래소')
  const heading = useRef<HTMLHeadingElement>(null)
  const id = useId()
  // A list request first retires the child detail, then updates its title.
  // Focus only the committed listing title, not the outgoing broker name.
  useLayoutEffect(() => {
    if (detailTitle !== '지원 거래소' || !shouldFocus()) return
    clientResearchScrollport(heading.current?.closest<HTMLElement>('#research-main') ?? null)?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [detailTitle, shouldFocus, listRequest])
  return <section id="research-main" className="client-research-hub client-broker-hub native-brokers" aria-labelledby={id}>
    <header className="hub-header"><h1 ref={heading} id={id} tabIndex={-1}>{detailTitle === '지원 거래소' ? researchNavigationLabel(language, 'brokers') : detailTitle}</h1><button type="button" onClick={onReturn}>{researchCopy(language, 'return')}</button></header>
    <ClientBrokers serviceBoundary presentation={presentation} presentationScope={accountScope ?? undefined} authenticated={signedIn} onLogin={onLogin} onTitleChange={setDetailTitle} listRequest={listRequest} viewState={viewState} onViewStateChange={onViewStateChange} />
  </section>
}
