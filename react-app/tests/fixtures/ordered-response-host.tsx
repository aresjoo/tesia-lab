// Test-only host: supplied observations, never a built-in provider.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { ClientResponseSource, ClientResponseUpdate } from '../../src/components/ClientResponseSourceBridge'
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
  let connected = true, id = 'ordered-source', sourceOwner: string | null = owner
  const subscriptions: { receive: (update: ClientResponseUpdate) => boolean; signal: AbortSignal; disposed: boolean }[] = []
  const charts: { request: MarketChartRequest; resolve: (value: unknown) => void }[] = []
  const render = () => {
    const source: ClientResponseSource = { id, owner: sourceOwner, subscribe(receive, signal) {
      const item = { receive, signal, disposed: false }; subscriptions.push(item)
      return () => { item.disposed = true }
    } }
    flushSync(() => root.render(<StrictMode><ClientMainExperience responseSource={connected ? source : undefined}
      marketChartSource={{ id: 'chart-source', owner, load: request => new Promise(resolve => charts.push({ request, resolve })) }}/></StrictMode>))
  }
  render()
  return { subscriptions, charts, render,
    deliver(update: ClientResponseUpdate, index = subscriptions.length - 1) {
      let accepted = false
      flushSync(() => { accepted = subscriptions[index]?.receive(update) ?? false })
      return accepted
    },
    source(nextId: string, nextOwner: string | null = owner) { id = nextId; sourceOwner = nextOwner; render() },
    connected(value: boolean) { connected = value; render() },
    language(value: ClientLanguage) { flushSync(() => setClientPreference('language', value)) },
    unmount() { root.unmount() },
  }
}
