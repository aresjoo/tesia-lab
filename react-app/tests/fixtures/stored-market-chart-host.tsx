// Synthetic host for the actual public shell. Never a built-in market provider.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { ClientMarketChartSource } from '../../src/components/ClientStoredMarketResponse'
import type { MarketChartRequest } from '../../src/client-market-chart-presentation'
import { setClientPreference, type ClientLanguage } from '../../src/client-preferences'
import '@fontsource-variable/geist'
import '@fontsource-variable/noto-sans-kr'
import '@fontsource-variable/noto-sans-sc'
import '../../src/styles.css'
import '../../src/funnel-v2.css'
import '../../src/conversation-shell.css'
import '../../src/client-reference.css'
import '../../src/client-workspace.css'
import '../../src/client-integration.css'
import { ClientMainExperience } from '../../src/components/ClientMainExperience'

export function mount(owner: string) {
  const root = createRoot(document.getElementById('fixture')!)
  let id = 'test-source', sourceOwner: string | null = owner, connected = true
  const requests: { request: MarketChartRequest; signal: AbortSignal; resolve: (value: unknown) => void; reject: () => void }[] = []
  const render = () => {
    const source: ClientMarketChartSource = { id, owner: sourceOwner,
      load: (request, signal) => new Promise((resolve, reject) => requests.push({ request, signal, resolve, reject: () => reject(new Error('TEST_ONLY_FAILURE')) })) }
    flushSync(() => root.render(<StrictMode><ClientMainExperience marketChartSource={connected ? source : undefined}/></StrictMode>))
  }
  render()
  return { requests, render,
    source(nextId: string, nextOwner: string | null = owner) { id = nextId; sourceOwner = nextOwner; render() },
    connected(value: boolean) { connected = value; render() },
    language(value: ClientLanguage) { flushSync(() => setClientPreference('language', value)) },
    unmount() { root.unmount() },
  }
}
