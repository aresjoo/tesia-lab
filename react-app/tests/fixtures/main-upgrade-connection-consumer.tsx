// Explicit compatibility consumer: preview navigation only, never Main's
// source plan alias, billing success, connection state, or execution authority.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { SiteRouter } from '../../src/components/SiteRouter'
import { ClientAccountPlan } from '../../src/components/ClientAccountActivity'
import { ClientDelegationWorkspace } from '../../src/components/ClientDelegationWorkspace'
import { ClientUpgradeSheet } from '../../src/components/ClientUpgradeSheet'
import { createClientExperienceStore } from '../../src/client-experience-store'
import { createDelegationConnectionLocator, canResumeDelegationConnection } from '../../src/client-delegation-connection'
import { readDelegationUi } from '../../src/client-delegation-fixtures'
import { createSourceAccountEventState } from '../../src/client-account-event-state'
import { sourceMoney } from '../../src/client-preview-money'
import { upgradeText } from '../../src/client-upgrade-copy'
import { useClientPreferences } from '../../src/client-preferences'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
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
const locator = createDelegationConnectionLocator(owner)
const account = createSourceAccountEventState()
const now = Date.now()
type View = 'conversation' | 'delegation' | 'plan'
const currentSession = () => { const state = store.getSnapshot(); return state.sessions.find(item => item.id === state.currentId) }
function ownedConnect(id: string) {
  const target = store.getSnapshot().sessions.find(item => item.id === id)
  return Boolean(owner && target && (!target.sharedCopy || target.sharedCopy.owner === owner) && canResumeDelegationConnection(readDelegationUi(id)))
}
const initialSession = currentSession()
const restoredConnect = Boolean(initialSession && initialSession.workspace === 'delegation' && locator.read() === initialSession.id && readDelegationUi(initialSession.id)?.page === 'connect' && ownedConnect(initialSession.id))
function navigate(hash: string) { history.pushState(null, '', hash || location.pathname); dispatchEvent(new Event('teth:navigate')) }
export function UpgradeConnectionConsumer() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const session = state.sessions.find(item => item.id === state.currentId)
  const { language, currency } = useClientPreferences()
  const [view, setView] = useState<View>(location.hash === '#/plan' ? 'plan' : restoredConnect ? 'delegation' : 'conversation')
  const [upgrade, setUpgrade] = useState<HTMLElement | null>(null)
  const [notice, setNotice] = useState(false)
  const main = useRef<HTMLElement>(null)
  useLayoutEffect(() => { if (view === 'delegation') main.current?.focus({ preventScroll: true }) }, [view])
  useEffect(() => {
    const changed = () => { if (location.hash === '#/plan') setView('plan') }
    window.addEventListener('teth:navigate', changed); window.addEventListener('hashchange', changed)
    return () => { window.removeEventListener('teth:navigate', changed); window.removeEventListener('hashchange', changed) }
  }, [])
  const subscribe = () => {
    const id = locator.read()
    if (!id || !ownedConnect(id)) {
      const current = currentSession()
      if (current) store.workspace(current.id, 'conversation')
      navigate(''); setView('conversation'); setNotice(true); setUpgrade(null); return
    }
    store.select(id); store.workspace(id, 'delegation')
    navigate(''); setView('delegation'); setUpgrade(null)
  }
  return <div className="tesia-shell conversation-surface client-source-app" data-test-scope="archive-upgrade-consumer-not-current-main">
    <main ref={main} id="tesia-main" className="client-source-main" tabIndex={-1}>
      {view === 'plan' ? <ClientAccountPlan state={account} signedIn={Boolean(profile)} now={now}
        money={(value, signed) => sourceMoney(value, currency, language, signed)} onNavigate={() => {}} onUpgrade={() => setUpgrade(document.activeElement as HTMLElement)} />
        : view === 'delegation' && session ? <ClientDelegationWorkspace sessionId={session.id} idea={session.idea} initialUi={readDelegationUi(session.id)} initialPage="connect"
          onBack={() => { store.workspace(session.id, 'conversation'); setView('conversation') }} />
        : session ? <div className="g-main client-conversation-stage"><div className="g-composer"><textarea aria-label="TETH에게 물어보세요" value={session.draft} onChange={event => store.draft(event.target.value)} /></div></div>
        : <div className="client-home-content"><textarea id="strategy-idea" aria-label="전략 질문" value={state.homeDraft} onChange={event => store.draft(event.target.value)} /></div>}
    </main>
    {notice && <div className="client-global-notice" role="status">{upgradeText(language, 'subscribeFromPlanNotice')}<button type="button" aria-label={upgradeText(language, 'closeAccountNotice')} onClick={() => setNotice(false)}>×</button></div>}
    {upgrade && <ClientUpgradeSheet context="plan" trigger={upgrade} onClose={() => setUpgrade(null)} onSubscribe={subscribe} />}
  </div>
}
createRoot(document.getElementById('root')!).render(<SiteRouter><UpgradeConnectionConsumer /></SiteRouter>)
