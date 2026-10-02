import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import type { ClientSecurityPresentation } from '../../src/client-settings-security-presentation'
import '../../src/styles.css'
import '../../src/client-reference.css'

const calls: { kind: string; signal: AbortSignal; enabled?: boolean }[] = []
const pending: { resolve: () => void; reject: () => void }[] = []
export function App() {
  const [owner, setOwner] = useState('owner-a'), [identity, setIdentity] = useState('dataset-a')
  const [available, setAvailable] = useState(!location.search.includes('unavailable'))
  const [security, setSecurity] = useState<ClientSecurityPresentation | undefined>(location.search.includes('unknown') ? undefined : {
    sourceLabel: 'SUPPLIED SECURITY TEST', password: { statusLabel: '2026-09-29', hint: 'HOST POLICY' },
    twoFactor: { enabled: true, description: 'HOST TWO FACTOR DESCRIPTION' },
    devices: [{ id: 'a', label: 'Windows, Edge', current: true, activityLabel: 'SUPPLIED CURRENT ACTIVITY' }, { id: 'b', label: 'Mac, Safari', current: false, activityLabel: 'SUPPLIED OTHER ACTIVITY' }],
    permissions: [{ id: 'read', label: 'SUPPLIED EXCHANGE', value: 'READ ONLY', description: 'SUPPLIED PERMISSION DESCRIPTION' }],
  })
  const request = (kind: string, signal: AbortSignal, enabled?: boolean) => {
    calls.push({ kind, signal, enabled })
    return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error('PRIVATE_ERROR_NOT_FOR_UI')) }))
  }
  const data: NativeAccountPresentation = {
    scope: owner, identity, sourceLabel: 'SUPPLIED TEST', strategies: null, accounts: null,
    ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null }, security,
    actions: { security: available ? {
      password: { hint: 'HOST PASSWORD POLICY', accepts: value => value.length >= 12,
        // Passwords are deliberately neither stored nor recorded by this fixture.
        submit: (_current, _next, signal) => request('password', signal) },
      twoFactor: (enabled, signal) => request('twoFactor', signal, enabled),
      logoutOthers: signal => request('logoutOthers', signal),
    } : undefined },
  }
  Object.assign(window, {
    securityCalls: () => calls.map(({ signal, ...call }) => ({ ...call, aborted: signal.aborted })),
    securityResolve: (index = 0) => pending[index].resolve(), securityReject: (index = 0) => pending[index].reject(),
    securitySetOwner: setOwner, securitySetDataset: setIdentity, securitySetAvailable: setAvailable, securitySetData: setSecurity,
  })
  return <ClientServiceExperience nativeAccounts accountScope={owner} accountPresentation={data} state={{
    phase: 'ready', sessionState: 'AUTHENTICATED', messages: [], input: '', busy: false, inputDisabled: false,
    source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
    onInput: () => {}, onSend: async () => {}, onReset: async () => {},
  }} />
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
