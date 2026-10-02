/* eslint-disable react-refresh/only-export-components -- explicit browser test fixture */
import { useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { NativeStrategies } from '../../src/internal-poc/NativeStrategies'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import { ClientStrategySharing } from '../../src/components/ClientStrategySharing'
import { CLIENT_BROKERS } from '../../src/client-broker-fixtures'
import type { BrokerServicePresentation } from '../../src/client-broker-presentation'
import type { SharingServicePresentation } from '../../src/client-sharing-presentation'
import { sourceSharedStrategies, type SharedLocation, type SharedStrategy } from '../../src/client-shared-strategies'
import { createClientSharingPreferencesStore } from '../../src/client-sharing-preferences'

export type MyExchangeFixture = { ids: string[]; owner?: string; scope?: string; signedIn?: boolean; disconnected?: boolean; preview?: boolean; shell?: boolean }
const source = sourceSharedStrategies()[0]
const rows: SharedStrategy[] = [
  { ...source, nick: 'btc-rule', title: 'Bitcoin rule', venue: { name: 'Binance', logo: 'binance' }, kind: 'rule', market: 'crypto' },
  { ...source, nick: 'okx-ai', title: 'Stock AI', venue: { name: 'OKX', logo: 'okx' }, kind: 'agent', market: 'stock' },
  { ...source, nick: 'bitget-mix', title: 'Mixed markets', venue: { name: 'Bitget', logo: 'bitget' }, kind: 'mix', market: 'multi' },
  { ...source, nick: 'missing-venue', title: 'Unspecified venue', venue: undefined, kind: 'rule', market: 'crypto' },
  { ...source, nick: 'own-row', title: 'Own strategy', me: true, venue: { name: 'Binance', logo: 'binance' }, kind: 'rule', market: 'crypto' },
]
const presentation: SharingServicePresentation = { state: 'ready', strategies: rows, watched: [], periodResult: row => row.result, indexToDate: index => new Date(Date.UTC(2030, 0, index + 1)) }
function Harness({ fixture }: { fixture: MyExchangeFixture }) {
  const owner = fixture.owner ?? 'myex-fixture-owner'
  const [location, setLocation] = useState<SharedLocation>({ period: 'all' })
  const [input, setInput] = useState('작성 중이던 대화')
  const [store] = useState(() => createClientSharingPreferencesStore(owner))
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const brokers: BrokerServicePresentation = { scope: fixture.scope ?? owner, identity: 'myex-fixture', catalog: fixture.ids.map(id => ({
    broker: { ...CLIENT_BROKERS[0], id }, connectionState: fixture.disconnected ? 'NEEDS_LINK' : 'CONNECTED',
  })) }
  const common = { owner, signedIn: fixture.signedIn ?? true, brokerPresentation: brokers, onReturn: () => {}, onLogin: () => {} }
  if (fixture.shell) return <ClientServiceExperience nativeAccounts accountScope={owner} brokerPresentation={brokers} sharingPresentation={{ scope: owner, identity: 'myex-fixture', data: presentation }} state={{
    phase: 'ready', sessionState: fixture.signedIn === false ? 'ANONYMOUS' : 'AUTHENTICATED', messages: [{ id: 'fixture-user', role: 'user', text: '대화에서 전략 목록을 둘러볼게요.' }], input, busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
    onInput: setInput, onSend: async () => {}, onReset: async () => {},
  }} />
  return fixture.preview ? <section className="client-research-hub client-sharing-hub"><ClientStrategySharing {...common} location={location} onNavigate={setLocation} onAsk={() => {}}
    viewPreferences={{ state: snapshot, onChange: store.update, onQuery: store.setQuery }} /></section>
    : <NativeStrategies {...common} presentation={presentation} shouldFocus={() => false} onTabChange={() => {}} />
}
export function mountMyExchanges(fixture: MyExchangeFixture) {
  document.getElementById('root')?.remove()
  const host = document.createElement('main'); host.id = 'myex-test-root'; document.body.append(host)
  const root = createRoot(host)
  const render = (value: MyExchangeFixture) => root.render(<Harness key={value.owner ?? 'myex-fixture-owner'} fixture={value} />)
  render(fixture)
  return { update: render }
}
