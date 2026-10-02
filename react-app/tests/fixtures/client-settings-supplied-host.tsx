import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientServiceExperience } from '../../src/internal-poc/ClientServiceExperience'
import type { NativeAccountPresentation } from '../../src/internal-poc/native-account-presentation'
import { clientNotificationTopics } from '../../src/client-settings-notifications-presentation'
import '../../src/styles.css'
import '../../src/client-reference.css'

// Explicit UI observations/capabilities only. No provider, HTTP or account authority.
export function mountSettingsSuppliedHost() {
  const calls: { kind: string; id: string; checked?: boolean; signal?: AbortSignal }[] = []
  const pending: { resolve: () => void }[] = []
  const request = (kind: string, id: string, signal?: AbortSignal, checked?: boolean) => {
    calls.push({ kind, id, signal, ...(checked === undefined ? {} : { checked }) })
    return new Promise<void>(resolve => pending.push({ resolve }))
  }
  function Host() {
    const [owner, setOwner] = useState('supplied-owner'), [identity, setIdentity] = useState('supplied-dataset')
    const [generation, setGeneration] = useState(0), [foreign, setForeign] = useState(false)
    const security = useMemo(() => { void generation; return ({
      logoutDevice: (id: string, signal: AbortSignal) => request('logoutDevice', id, signal),
      disconnectExchange: (id: string, signal: AbortSignal) => request('disconnectExchange', id, signal),
    }) }, [generation])
    const onPreference = useMemo(() => { void generation; return (id: string, checked: boolean, signal?: AbortSignal) => request('preference', id, signal, checked) }, [generation])
    const data: NativeAccountPresentation = {
      scope: foreign ? 'foreign-owner' : owner, identity, sourceLabel: 'EXPLICIT SERVICE UI FIXTURE', strategies: null, accounts: null,
      ledger: { pos: null, open: null, orders: null, fills: null, closed: null, assets: null },
      security: { sourceLabel: 'EXPLICIT OBSERVATIONS', devices: [{ id: 'current', label: 'Current fixture', current: true }, { id: 'remote/device', label: 'Remote fixture', current: false }],
        permissions: [{ id: 'permission', label: 'Observed connection', value: 'READ', exchangeConnection: { id: 'exchange/one' } }] },
      plan: { title: 'Explicit preferences', sourceLabel: 'EXPLICIT SOURCE MARKERS', sections: { plan: [], alerts: [], rebates: [] }, preferences: [
        ...clientNotificationTopics.flatMap(topic => (['push', 'email'] as const).map(channel => ({ id: `opaque/${topic}/${channel}`, label: 'Opaque row', checked: channel === 'push', sourceNotification: { topic, channel } }))),
        { id: 'legacy-preserved', label: 'Legacy group remains separate', checked: true },
      ] }, actions: { security, onPreference },
    }
    Object.assign(window, { settingsSuppliedHost: {
      calls: () => calls.map(({ signal, ...call }) => ({ ...call, aborted: signal?.aborted ?? false })),
      resolve: (i = 0) => pending[i].resolve(), setOwner, setIdentity, setForeign,
      replaceCallbacks: () => setGeneration(n => n + 1),
    } })
    return <ClientServiceExperience nativeAccounts accountScope={owner} accountPresentation={data} state={{ phase: 'ready', sessionState: 'AUTHENTICATED', messages: [], input: '', busy: false, inputDisabled: false, source: 'service', recovery: null, quickReplies: [], workflow: null, outcome: null, issue: null, onInput: () => {}, onSend: async () => {}, onReset: () => {}, onRecover: undefined, onLogout: undefined }} />
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><Host /></StrictMode>)
}
