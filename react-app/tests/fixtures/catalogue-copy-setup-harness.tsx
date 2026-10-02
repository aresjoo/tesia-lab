import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientStrategySharing } from '../../src/components/ClientStrategySharing'
import { catalogueSourceSha } from '../../src/client-catalogue'
import type { CatalogueCopySettings } from '../../src/client-catalogue-copy-setup'
import type { SharedLocation } from '../../src/client-shared-strategies'
import { createCatalogueCopyAccountController } from '../../src/client-catalogue-copy-account'

export function mountCatalogueCopy(persist = false) {
  document.getElementById('root')?.remove()
  const host = document.createElement('main'); host.id = 'copy-setup-harness'; document.body.append(host)
  const calls: { settings: Readonly<CatalogueCopySettings>; signal: AbortSignal; resolve: () => void; reject: () => void }[] = []
  const actions: string[] = []
  // Explicit test-host supply, not a fabricated public connection/entitlement.
  const account = persist ? createCatalogueCopyAccountController('one') : null
  let patch: (value: Partial<{ owner: string; suppliedOwner: string; id: string; revision: string; available: number; resumeId: string; ready: boolean; signedIn: boolean }>) => void
  function Harness() {
    const [input, setInput] = useState({ owner: 'one', suppliedOwner: 'one', id: 'f1', revision: 'v1', available: persist ? 1000 : 1000.75, resumeId: '', ready: true, signedIn: true })
    const [location, setLocation] = useState<SharedLocation>({ nick: 'f1', period: 'all' })
    patch = value => { setInput(before => ({ ...before, ...value })); if (value.id) setLocation({ nick: value.id, period: 'all' }) }
    return <div className="client-source-app"><ClientStrategySharing owner={input.owner} signedIn={input.signedIn} location={location} onNavigate={setLocation} onAsk={() => {}} onReturn={() => {}} onLogin={() => actions.push('login')} onCatalogueCopy={id => actions.push('plan:' + id)}
      catalogueCopySetup={input.ready ? { owner: input.suppliedOwner, sourceSha: catalogueSourceSha, strategyId: input.id, revision: input.revision, available: input.available, resumeId: input.resumeId || undefined,
        onConfirm: account ? async (settings, signal) => {
          if (input.owner !== 'one' || input.suppliedOwner !== 'one') throw Error('owner changed')
          const result = await account.start({ id: crypto.randomUUID(), strategyId: input.id, settings, at: Date.now() }, signal)
          if (!result.ok) throw Error(result.error)
          const current = account.getSnapshot().state!
          setInput(before => before.owner === current.owner ? { ...before, available: current.spot, revision: String(current.revision) } : before)
        } : (settings, signal) => new Promise<void>((resolve, reject) => calls.push({ settings, signal, resolve, reject: () => reject(Error('PRIVATE_ACCOUNT_PAYLOAD')) })) } : undefined}/></div>
  }
  createRoot(host).render(<Harness/>)
  return { patch: (value: Parameters<typeof patch>[0]) => patch(value), settle: (index: number, ok = true) => ok ? calls[index].resolve() : calls[index].reject(),
    snapshot: () => ({ actions: [...actions], calls: calls.map(call => ({ settings: call.settings, aborted: call.signal.aborted })) }),
    account: () => account?.getSnapshot().state ?? null, dispose: () => account?.dispose() }
}
