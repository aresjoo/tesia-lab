import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientAuthDialog, ClientFeedbackDialog, ClientProfileMenu, ClientSettingsMenu, type ClientProfile } from '../../src/components/ClientAccountUI'

// Let Vite resolve React modules; never depend on private optimizer hashes.
export function AccountFixture() {
  const [view, setView] = useState('')
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const close = () => setView('')
  return <main>
    <p>개발 미리보기: 계정·의견은 샘플이며 실제 전송하거나 저장하지 않습니다.</p>
    {['login', 'signup', 'settings', 'feedback', 'profile'].map(item => <button key={item} onClick={() => setView(item)}>{item}</button>)}
    <output>{profile ? profile.name + ' ' + profile.email : ''}</output>
    {(view === 'login' || view === 'signup') && <ClientAuthDialog key={view} mode={view} onClose={close} onComplete={value => { setProfile(value); close() }} />}
    {view === 'settings' && <ClientSettingsMenu onClose={close} onLocale={() => setView('locale')} onFeedback={() => setView('feedback')} onHelp={() => setView('help')} onDownload={() => setView('download')} signedIn={!!profile} />}
    {view === 'feedback' && <ClientFeedbackDialog onClose={close} />}
    {view === 'profile' && <ClientProfileMenu profile={profile ?? { name: 'Sample', email: 'sample@example.test' }} onClose={close} onLogout={() => { setProfile(null); close() }} />}
    {view === 'locale' && <p>locale selected</p>}
  </main>
}
createRoot(document.getElementById('root')!).render(<AccountFixture />)
