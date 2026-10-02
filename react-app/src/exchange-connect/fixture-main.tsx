/** Explicit development fixture. Excluded from every product entry/build. */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NativeConnectionOnboarding } from '../internal-poc/NativeConnectionOnboarding'
import { NativeServiceApp } from '../internal-poc/NativeServiceApp'
import { SiteRouter } from '../components/SiteRouter'
import { useExchangeConnectionPresentation } from './use-exchange-connection'
export function Fixture() {
  const presentation = useExchangeConnectionPresentation('session_exchange_fixture_0001', true, true)
  return <NativeConnectionOnboarding accountScope="session_exchange_fixture_0001" presentation={presentation} onReturn={() => undefined} />
}
const root = document.getElementById('exchange-connect-fixture')
if (!root) throw new Error('FIXTURE_ROOT_MISSING')
const fullServiceFixture = new URLSearchParams(window.location.search).get('service') === 'true'
createRoot(root).render(<StrictMode>{fullServiceFixture
  ? <SiteRouter service><NativeServiceApp exchangeConnectionsEnabled /></SiteRouter>
  : <Fixture />}</StrictMode>)
