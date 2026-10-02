// ARCHIVE / COMPATIBILITY CONSUMER HOST ONLY.
// Current Main has no broker-to-legacy-subscription callback entry. This host
// tests real reusable consumers and exported preview stores, not current Main.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { SiteRouter } from '../../src/components/SiteRouter'
import { ClientChrome } from '../../src/components/ClientChrome'
import { ClientResearchHub } from '../../src/components/ClientResearchHub'
import { ClientDelegationWorkspace } from '../../src/components/ClientDelegationWorkspace'
import { ClientAccountPlan } from '../../src/components/ClientAccountActivity'
import { ClientUpgradeSheet } from '../../src/components/ClientUpgradeSheet'
import { createClientExperienceStore } from '../../src/client-experience-store'
import { createDelegationConnectionLocator, canResumeDelegationConnection } from '../../src/client-delegation-connection'
import { createClientSubscriptionIntentStore, type SubscriptionCycle } from '../../src/client-subscription-intent'
import { readDelegationUi } from '../../src/client-delegation-fixtures'
import { createClientReportUpgradeStore } from '../../src/client-report-upgrade'
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
import '../../src/client-site-footer.css'

type View = 'brokers' | 'delegation' | 'conversation' | 'plan'
const profile = JSON.parse(sessionStorage.getItem('teth-client-profile-preview') ?? 'null') as { name: string; email?: string } | null
const owner = profile?.email ?? null
const store = createClientExperienceStore()
const locator = createDelegationConnectionLocator(owner)
const intent = createClientSubscriptionIntentStore(owner)
const reportUpgrade = { owner, store: createClientReportUpgradeStore(owner), enabled: true }
const account = createSourceAccountEventState()
const hostNow = Date.now()
const storageNotice = '구독 선택을 이 브라우저에 저장하지 못했어요. 현재 선택은 유지되지만 새로고침하면 달라질 수 있어요.'

export function CompatibilityConsumer() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const session = state.sessions.find(item => item.id === state.currentId)
  const { language, currency } = useClientPreferences()
  const [view, setView] = useState<View>(() => location.hash === '#/plan' ? 'plan'
    : session?.workspace === 'delegation' ? 'delegation'
      : Reflect.get(window, 'legacyConsumerKind') === 'delegation' ? 'conversation' : 'brokers')
  const [connectionEntry, setConnectionEntry] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [upgrade, setUpgrade] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const navigate = () => { if (location.hash === '#/plan') { setView('plan'); setUpgrade(null) } }
    window.addEventListener('hashchange', navigate)
    return () => window.removeEventListener('hashchange', navigate)
  }, [])

  // Explicit caller wiring of exported archive stores. No billing calculation,
  // payment success, registration, account state or execution grant is produced.
  const subscribe = (chooseCycle: boolean) => {
    const current = store.getSnapshot(), id = locator.read()
    const target = current.sessions.find(item => item.id === id)
    if (!owner || !target || target.sharedCopy && target.sharedCopy.owner !== owner
      || !canResumeDelegationConnection(readDelegationUi(target.id))) {
      setView('conversation')
      setNotice('전략 검증을 통과하면 구독 단계로 이어져요. 채팅에서 전략을 맡겨보세요.')
      setUpgrade(null)
      return
    }
    if (chooseCycle && !intent.choose(target.id, intent.read(target.id) ?? 'year')) setNotice(storageNotice)
    store.select(target.id); store.workspace(target.id, 'delegation')
    setConnectionEntry(target.id); setView('delegation'); setUpgrade(null)
  }
  const changeCycle = (cycle: SubscriptionCycle | null) => {
    if (!session || !owner) return
    if (cycle !== null && !canResumeDelegationConnection(readDelegationUi(session.id))) return
    if (!(cycle === null ? intent.clear(session.id) : intent.choose(session.id, cycle))) setNotice(storageNotice)
  }
  const reopen = () => { if (session) { store.workspace(session.id, 'delegation'); setView('delegation') } }
  const home = () => setView('conversation')
  return <div className="tesia-shell conversation-surface client-source-app view-briefing" data-test-scope="archive-compatibility-consumer-not-current-main">
    <div className="client-footer-body">
    <ClientChrome signedIn={Boolean(profile)} profileName={profile?.name} showLocaleShortcut={false}
      onHome={home} onLogin={() => {}} onSignup={() => {}} onSettings={() => {}} onLocale={() => {}}
      onDashboard={home} onResearchPage={page => { if (page === 'brokers') setView('brokers') }} />
    <main id="tesia-main" className="client-source-main" tabIndex={-1}>
      {notice && <p role="status">{notice}</p>}
      {view === 'brokers' && <ClientResearchHub page="brokers" records={[]} onSelect={() => {}} onNew={home}
        onFollow={() => {}} onReturn={home} brokerServices={{ authenticated: Boolean(profile),
          presentationScope: JSON.stringify([owner, session?.id ?? null]), onSubscribe: () => subscribe(true) }} />}
      {view === 'delegation' && session && <ClientDelegationWorkspace key={session.id}
        sessionId={session.id} idea={session.idea} initialUi={readDelegationUi(session.id)}
        initialPage={connectionEntry === session.id || session.tradingReady ? 'connect' : undefined}
        reportUpgrade={reportUpgrade} subscriptionPreference={{ cycle: intent.read(session.id), onChange: changeCycle }}
        onBack={() => { store.workspace(session.id, 'conversation'); setView('conversation') }} />}
      {view === 'conversation' && <section className="client-conversation-stage g-main" style={{ padding: '80px 24px' }}>
        <textarea aria-label="TETH에게 물어보세요" value={session?.draft ?? ''} onChange={event => store.draft(event.target.value)} />
        <button type="button" onClick={reopen}>전략 맡기기</button>
      </section>}
      {view === 'plan' && <ClientAccountPlan state={account} signedIn={Boolean(profile)} now={hostNow}
        money={(value, signed) => sourceMoney(value, currency, language, signed)}
        onNavigate={() => {}} onPreference={() => {}} onUpgrade={() => setUpgrade(document.activeElement as HTMLElement)} />}
      {upgrade && <ClientUpgradeSheet context="plan" trigger={upgrade} onClose={() => setUpgrade(null)} onSubscribe={() => subscribe(false)} />}
    </main>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<SiteRouter><CompatibilityConsumer /></SiteRouter>)
