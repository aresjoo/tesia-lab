import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientSettingsSecurity } from '../../src/components/ClientSettingsSecurity'
import type { ClientSecurityActions, ClientSecurityPresentation } from '../../src/client-settings-security-presentation'
import '../../src/styles.css'
import '../../src/client-reference.css'
import '../../src/client-settings.css'

const calls: { kind: string; id?: string; signal: AbortSignal }[] = []
const pending: { resolve: () => void; reject: () => void }[] = []
function request(kind: string, signal: AbortSignal, id?: string) {
  calls.push({ kind, id, signal })
  return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(Error('PRIVATE_SOURCE_ACTION_ERROR')) }))
}
export function Fixture() {
  const [owner, setOwner] = useState('owner-a'), [dataset, setDataset] = useState('dataset-a')
  const [mounted, setMounted] = useState(true), [generation, setGeneration] = useState(0)
  const [available, setAvailable] = useState(!location.search.includes('unavailable'))
  const [data, setData] = useState<ClientSecurityPresentation | undefined>(location.search.includes('unknown') ? undefined : {
    sourceLabel: 'EXPLICIT SECURITY DISPLAY FIXTURE', devices: [
      { id: 'current', label: 'Current device', current: true },
      { id: 'remote/device', label: 'Remote device', current: false, activityLabel: 'Observed activity' },
    ], permissions: [
      { id: 'permission-read', label: 'Observed exchange', value: 'SUPPLIED READ', exchangeConnection: { id: 'exchange/one' } },
      { id: 'generic-permission', label: 'Not a connection', value: 'SUPPLIED OTHER' },
    ],
  })
  const actions = useMemo<ClientSecurityActions>(() => available ? {
    logoutDevice: (id, signal) => request(`logoutDevice:${generation}`, signal, id),
    disconnectExchange: (id, signal) => request(`disconnectExchange:${generation}`, signal, id),
    connectExchange: signal => request(`connectExchange:${generation}`, signal),
  } : {}, [available, generation])
  Object.assign(window, { securitySourceFixture: {
    calls: () => calls.map(({ signal, ...value }) => ({ ...value, aborted: signal.aborted })),
    resolve: (index = 0) => pending[index].resolve(), reject: (index = 0) => pending[index].reject(),
    setData, setOwner, setDataset, setAvailable, setMounted,
    replaceCallback: () => setGeneration(n => n + 1),
  } })
  return <main className="client-source-app"><div className="stg-main"><h1>Security fixture</h1>{mounted && <ClientSettingsSecurity scopeId={`${owner}:${dataset}`} data={data} actions={actions}/>}</div></main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture/></StrictMode>)
