import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import '../../src/styles.css'
import '../../src/client-reference.css'

const calls: { field: string; value: string; signal: AbortSignal }[] = []
const pending: { resolve: () => void; reject: (reason?: unknown) => void }[] = []
const emailCalls: { kind: string; email: string; signal: AbortSignal; codeLength?: number }[] = []
const emailPending: { resolve: () => void; reject: (reason?: unknown) => void }[] = []
export function App() {
  const [owner, setOwner] = useState('owner-a')
  const [identity, setIdentity] = useState('dataset-a')
  const [enabled, setEnabled] = useState(!location.search.includes('unavailable'))
  const [profile, setProfile] = useState({ name: '김투자', handle: 'investor', email: 'user@example.invalid' })
  const request = (field: string, value: string, signal: AbortSignal) => {
    calls.push({ field, value, signal })
    return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
  }
  const data: NativeAccountPresentation = {
    scope: owner, identity, profile, sourceLabel: 'SUPPLIED TEST', strategies: null, accounts: null,
    ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null },
    actions: enabled ? {
      onProfileName: (value, signal) => request('name', value, signal),
      onProfileHandle: (value, signal) => request('handle', value, signal),
      onEmailChange: (email, signal) => {
        emailCalls.push({ kind: 'send', email, signal })
        return new Promise((resolve, reject) => emailPending.push({
          resolve: () => resolve({ verify: (code: string, signal: AbortSignal) => {
            // Fixture deliberately records only length, never verification codes.
            emailCalls.push({ kind: 'verify', email, signal, codeLength: code.length })
            return new Promise<void>((resolve, reject) => emailPending.push({ resolve, reject }))
          } }), reject,
        }))
      },
    } : undefined,
  }
  Object.assign(window, {
    identityCalls: () => calls.map(({ field, value, signal }) => ({ field, value, aborted: signal.aborted })),
    identitySetOwner: setOwner, identitySetDataset: setIdentity, identitySetEnabled: setEnabled, identitySetProfile: setProfile,
    identityResolve: (index = 0) => pending[index].resolve(), identityReject: (index = 0) => pending[index].reject(new Error('DO_NOT_EXPOSE_RAW_ERROR')),
    emailCalls: () => emailCalls.map(({ signal, ...call }) => ({ ...call, aborted: signal.aborted })),
    emailResolve: (index = 0) => emailPending[index].resolve(), emailReject: (index = 0) => emailPending[index].reject(new Error('DO_NOT_EXPOSE_RAW_ERROR')),
  })
  return <ClientServiceExperience nativeAccounts accountScope={owner} accountPresentation={data} state={{
    phase: 'ready', sessionState: 'AUTHENTICATED', messages: [], input: '', busy: false, inputDisabled: false,
    source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null,
    onInput: () => {}, onSend: async () => {}, onReset: async () => {},
  }} />
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
