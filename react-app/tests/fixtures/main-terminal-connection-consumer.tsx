// Explicit archive compatibility host. It consumes real preview components and
// account-bound stores; it is not the fresh Main funnel or exchange authority.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { SiteRouter } from '../../src/components/SiteRouter'
import ClientSourceTerminalWorkspace from '../../src/components/ClientSourceTerminalWorkspace'
import { ClientDelegationWorkspace } from '../../src/components/ClientDelegationWorkspace'
import { ClientResearchHub } from '../../src/components/ClientResearchHub'
import { ClientAccountPlan, ClientAccountPeriodic } from '../../src/components/ClientAccountActivity'
import { ClientUserStrategy } from '../../src/components/ClientUserStrategy'
import { createClientExperienceStore } from '../../src/client-experience-store'
import { createClientUserStrategyStore, type ClientStrategyRegistration } from '../../src/client-user-strategy-store'
import { createDelegationConnectionLocator, canResumeDelegationConnection } from '../../src/client-delegation-connection'
import { readDelegationUi } from '../../src/client-delegation-fixtures'
import { createSourceAccountEventState } from '../../src/client-account-event-state'
import { sourceMoney } from '../../src/client-preview-money'
import { useClientPreferences } from '../../src/client-preferences'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource-variable/noto-sans-sc'
import '../../src/styles.css'
import '../../src/funnel-v2.css'
import '../../src/conversation-shell.css'
import '../../src/client-reference.css'
import '../../src/client-workspace.css'
import '../../src/client-integration.css'
import '../../src/client-main-experience.css'
import '../../src/client-conversation.css'

const profile = JSON.parse(sessionStorage.getItem('teth-client-profile-preview') ?? 'null') as { name: string; email?: string } | null
const owner = profile?.email ?? null
const store = createClientExperienceStore()
const registrations = createClientUserStrategyStore(owner)
const locator = createDelegationConnectionLocator(owner)
const account = createSourceAccountEventState()
const now = Date.now()
function navigate(hash: string) {
  history.pushState(null, '', hash || location.pathname)
  dispatchEvent(new Event('teth:navigate'))
}
export function TerminalConnectionConsumer() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const registered = useSyncExternalStore(registrations.subscribe, registrations.getSnapshot)
  const session = state.sessions.find(item => item.id === state.currentId)
  const [hash, setHash] = useState(location.hash)
  const [visited, setVisited] = useState(location.hash === '#/trade')
  const [entry, setEntry] = useState<{ sessionId: string; registeredId: string | null } | null>(null)
  const { currency, language } = useClientPreferences()
  useEffect(() => {
    const changed = () => { setHash(location.hash); if (location.hash === '#/trade') setVisited(true) }
    window.addEventListener('teth:navigate', changed); window.addEventListener('hashchange', changed)
    return () => { window.removeEventListener('teth:navigate', changed); window.removeEventListener('hashchange', changed) }
  }, [])
  const money = (value: number, signed = false) => sourceMoney(value, currency, language, signed)
  const home = () => { setEntry(null); store.home(); navigate('') }
  const delegate = () => {
    if (!session || !owner || session.sharedCopy && session.sharedCopy.owner !== owner) return
    const existing = registered.entries.find(item => item.sessionId === session.id)
    if (existing) { navigate(`#/trade/bot/${existing.record.id}`); return }
    locator.remember(session.id); store.workspace(session.id, 'delegation'); navigate('')
  }
  const connect = () => {
    const id = locator.read(), target = store.getSnapshot().sessions.find(item => item.id === id)
    if (!owner || !target || target.sharedCopy && target.sharedCopy.owner !== owner || !canResumeDelegationConnection(readDelegationUi(target.id))) {
      setEntry(null); navigate('#/compatibility/brokers'); return
    }
    const existing = registrations.getSnapshot().entries.find(item => item.sessionId === target.id)
    store.select(target.id); store.workspace(target.id, 'delegation'); locator.remember(target.id)
    setEntry({ sessionId: target.id, registeredId: existing?.record.id ?? null }); navigate('')
  }
  const finish = useCallback((input: ClientStrategyRegistration) => {
    if (!owner || !session || entry?.sessionId !== session.id) return false
    const existing = registrations.getSnapshot().entries.find(item => item.sessionId === session.id)
    if (entry.registeredId && existing?.record.id !== entry.registeredId) return false
    // Reconnect is navigation only: preserve every existing record byte.
    const record = existing?.record ?? registrations.register(session.id, input, Date.now())
    if (!existing) store.tradingReady(session.id)
    store.workspace(session.id, 'conversation'); setEntry(null); navigate(`#/trade/bot/${record.id}`)
    return true
  }, [session, entry])
  const terminal = hash === '#/trade'
  const bot = /^#\/trade\/bot\/(.+)$/.exec(hash)?.[1]
  const plan = /^#\/plan(?:\/(alerts|rebates))?$/.exec(hash)
  const periodic = hash.startsWith('#/periodic/') ? hash.slice('#/periodic/'.length) : null
  return <div className="tesia-shell conversation-surface client-source-app" data-test-scope="archive-terminal-consumer-not-current-main">
    <main id="tesia-main" className="client-source-main" tabIndex={-1}>
      {visited && <div className="client-main-terminal" hidden={!terminal} inert={!terminal}>
        <ClientSourceTerminalWorkspace includeSamples accountDataMode="connection-required" userStrategies={registered.entries.map(item => item.record)}
          accountState={account} now={now} onAccountNavigate={navigate} onConnectExchange={connect} onNew={home} onAsk={() => {}} />
      </div>}
      {bot ? <ClientUserStrategy record={registered.entries.find(item => item.record.id === bot)?.record ?? null} events={account} money={money} onNavigate={navigate} />
        : plan ? <div className="client-main-account"><ClientAccountPlan state={account} signedIn={Boolean(profile)} now={now} money={money} tab={plan[1] as 'alerts' | 'rebates' | undefined} onNavigate={navigate} /></div>
        : periodic ? <div className="client-main-account"><ClientAccountPeriodic state={account} id={periodic} now={now} money={money} onNavigate={navigate} /></div>
        : hash === '#/compatibility/brokers' ? <ClientResearchHub page="brokers" records={[]} onSelect={() => {}} onNew={home} onFollow={() => {}} onReturn={() => navigate('#/trade')} />
        : !terminal && !hash && session?.workspace === 'delegation' ? <ClientDelegationWorkspace key={`${session.id}:${entry?.sessionId ?? 'report'}`} sessionId={session.id} idea={session.idea} initialUi={readDelegationUi(session.id)}
          initialPage={entry?.sessionId === session.id ? 'connect' : undefined} onStrategyRegistered={entry ? finish : undefined}
          onBack={() => { store.workspace(session.id, 'conversation'); navigate('') }} />
        : !terminal && !hash && session ? <div className="g-main client-conversation-stage"><div className="g-composer"><textarea aria-label="TETH에게 물어보세요" value={session.draft} onChange={event => store.draft(event.target.value)} /></div><button onClick={delegate}>전략 맡기기</button></div>
        : !terminal && !hash ? <section className="client-home-content"><textarea id="strategy-idea" aria-label="전략 질문" value={state.homeDraft} onChange={event => store.draft(event.target.value)} /></section> : null}
    </main>
  </div>
}
createRoot(document.getElementById('root')!).render(<SiteRouter><TerminalConnectionConsumer /></SiteRouter>)
