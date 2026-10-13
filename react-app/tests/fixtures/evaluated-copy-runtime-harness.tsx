import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NativeStrategies } from '../../src/internal-poc/NativeStrategies'
import { SameOriginApiTransport } from '../../src/internal-poc/api-adapter'
import { createSdk, TesiaApiClient } from '../../src/internal-poc/contracts/generated/api-v0.1/index'
import { loadCopyExecutionDeployment, useCandidateCopyExecution, type CandidateCopyInput } from '../../src/copy-execution/use-copy-execution'
import type { SharedLocation } from '../../src/client-shared-strategies'

/** Synthetic HTTP only. Uses the real session SDK, production hook, copy SDK and UI. */
export function mountEvaluatedCopyRuntime(pin: string, sourceId: string) {
  const node = document.createElement('main'); document.body.replaceChildren(node)
  const session = createSdk(new TesiaApiClient(new SameOriginApiTransport())).session
  let initialization = 'waiting'
  let inspect: () => unknown = () => null
  let changeOwner: (owner: string | null) => void = () => undefined
  function Harness() {
    const [input, setInput] = useState<CandidateCopyInput>(), [owner, setOwner] = useState<string | null>(null)
    const [location, setLocation] = useState<SharedLocation>({ nick: sourceId, period: 'all' })
    const current = useRef<{ sessionId: string; sessionState: string } | null>(null)
    changeOwner = next => { current.current = next ? { sessionId: next, sessionState: 'AUTHENTICATED' } : null; setOwner(next) }
    useEffect(() => {
      const abort = new AbortController()
      void (async () => {
        const observed = (await session.current()).body.data; initialization = 'session-confirmed'
        const deployment = await loadCopyExecutionDeployment(pin, { origin: () => window.location.origin, fetch: window.fetch.bind(window), signal: abort.signal })
        initialization = deployment ? 'deployment-loaded' : 'deployment-unavailable'
        if (!abort.signal.aborted && observed.state === 'AUTHENTICATED') { current.current = { sessionId: observed.sessionId, sessionState: observed.state }; setOwner(observed.sessionId); setInput(deployment) }
      })().catch(error => { initialization = String(error.message) })
      return () => abort.abort()
    }, [])
    const live = useCandidateCopyExecution(input, true, session, () => current.current, owner)
    inspect = () => ({ phase: live?.controller.getSnapshot().phase, reason: live?.controller.getSnapshot().reason })
    return <div className="client-source-app"><NativeStrategies owner={owner} catalogueCopyExecution={live} location={location} onNavigate={setLocation} signedIn={Boolean(owner)} onLogin={() => undefined} onReturn={() => setLocation({ period: 'all' })} shouldFocus={() => true} onTabChange={() => undefined}/></div>
  }
  const root = createRoot(node); root.render(<Harness/>)
  return { inspect: () => inspect(), initialization: () => initialization, changeOwner: (value: string | null) => changeOwner(value), dispose: () => root.unmount() }
}
