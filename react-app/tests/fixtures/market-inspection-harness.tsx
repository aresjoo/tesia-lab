import { useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientAccountTerminal, type ClientAccountTerminalControl, type ClientAccountTerminalEntry } from '../../src/components/ClientAccountTerminal'
import { NativeTradingWorkspace } from '../../src/internal-poc/NativeTradingWorkspace'
import { createMarketSelectionStore } from '../../src/client-market-selection-store'
import { setClientPreference } from '../../src/client-preferences'
import type { TerminalMarketInstrument, TerminalMarketObservation, TerminalMarketSource } from '../../src/client-terminal-market-source'
import { fixture as chart } from '../../src/dev/chart-workspace-fixture'

export type InspectionFixture = { owner?: string; missing?: boolean; empty?: boolean; wrongScope?: boolean; identity?: string; native?: boolean; translated?: boolean; marketLabel?: string }
const instruments: TerminalMarketInstrument[] = ['BTC', 'ETH', 'SOL'].map((asset, index) => ({ id: asset, symbol: `${asset}/USDT`, market: 'TEST ONLY', exchangeId: 'fixture', categories: ['l1'], price: 100 + index, change: null, volume: null }))
export function mountMarketInspection(initial: InspectionFixture = {}) {
  document.getElementById('root')?.remove()
  const host = document.createElement('main'); host.id = 'inspection-test-root'; document.body.append(host)
  const root = createRoot(host), preferences = new Map<string, ReturnType<typeof createMarketSelectionStore>>()
  const pending: { id: string; signal: AbortSignal; scope: string; identity: string; resolve: (value: TerminalMarketObservation) => void; reject: () => void }[] = []
  const entries: ClientAccountTerminalEntry[] = ['BTC', 'ETH'].map(asset => ({ strategy: { id: `strategy-${asset}`, name: `${asset} strategy`, symbol: `${asset}/USDT`, market: 'TEST ONLY', version: '1', status: 'ready', exchange: { id: 'fixture', name: 'TEST', color: '#444' }, capitalLabel: '—' }, chart,
    agent: <input aria-label={`${asset} draft`} defaultValue={`draft-${asset}`} />, completed: <p>{asset} fills</p>, dashboard: <p>{asset} analysis</p> }))
  let selectStrategy: (id: string) => void = () => {}
  function Harness({ fixture }: { fixture: InspectionFixture }) {
    const owner = fixture.owner ?? 'test-owner', identity = fixture.identity ?? 'test-market', key = JSON.stringify([owner, identity])
    if (!preferences.has(key)) preferences.set(key, createMarketSelectionStore(owner, identity))
    const control = useRef<ClientAccountTerminalControl>(null)
    selectStrategy = id => control.current?.select(`strategy-${id}`)
    const source: TerminalMarketSource = { scope: fixture.wrongScope ? 'other-owner' : owner, identity, preferences: preferences.get(key)!,
      strategyInstruments: { 'strategy-BTC': 'BTC', 'strategy-ETH': 'ETH' },
      catalog: { state: 'ready', value: instruments.map(row => ({ ...row, market: fixture.marketLabel ?? row.market })), source: 'TEST ONLY', observedAt: '2030-01-01' },
      load: (id, signal) => new Promise((resolve, reject) => pending.push({ id, signal, scope: owner, identity, resolve, reject: () => reject(Error('TEST ERROR')) })),
    }
    if (fixture.native) return <NativeTradingWorkspace accountScope={owner} onReturn={() => {}} onNew={() => {}} presentation={{
      scope: owner, identity: 'fixture-account', sourceLabel: 'TEST ONLY ACCOUNT', marketSource: source,
      strategies: entries.map(entry => ({ strategy: { ...entry.strategy, market: fixture.translated ? '언어에 따른 표시 이름' : entry.strategy.market }, chart: entry.chart, accountId: 'fixture-account', agent: { events: [], sourceLabel: 'TEST ONLY AGENT' }, dashboard: [] })),
      ledger: { pos: [], open: [], orders: [], fills: [], closed: [], assets: [] }, accounts: [{ id: 'fixture-account', kind: 'account', title: 'TEST ONLY ACCOUNT', fields: [], sections: [] }],
    }} />
    return <ClientAccountTerminal key={owner} marketScope={owner} marketSource={source} controlRef={control} entries={fixture.missing ? null : fixture.empty ? [] : entries} onNew={() => {}}
      renderBottom={(id, scope) => [{ id: 'fills', label: 'TEST fills', content: <p data-testid="ledger">{id}:{scope}</p> }]} />
  }
  const render = (fixture: InspectionFixture) => root.render(<Harness fixture={fixture} />)
  render(initial)
  return { update: render, selectStrategy: (id: string) => selectStrategy(id), setLanguage: (language: string) => setClientPreference('language', language),
    requests: () => pending.map(item => ({ id: item.id, aborted: item.signal.aborted, scope: item.scope })),
    resolve(index: number, wrong = false) { const p = pending[index]; p.resolve({ scope: p.scope, identity: p.identity, instrumentId: wrong ? 'wrong' : p.id, chart: { ...chart, identity: `TEST-${p.id}-${index}`, market: `${p.id}/USDT`, sourceLabel: `TEST ONLY ${p.id} #${index}`, fills: [] } }) },
    reject: (index: number) => pending[index].reject(),
    unmount: () => root.unmount(),
  }
}
