import { useEffect, useMemo, useState } from 'react'
import { ClientMainExperience as Main } from '../../src/components/ClientMainExperience'
import { createMarketSelectionStore } from '../../src/client-market-selection-store'
import { marketPeriods, metricKinds, type TerminalMarketPresentation } from '../../src/client-terminal-market'
import type { TerminalMarketInstrument, TerminalMarketObservation, TerminalMarketSource } from '../../src/client-terminal-market-source'
import { fixture as chart } from '../../src/dev/chart-workspace-fixture'

const owner = 'main-owned-edit@example.test'
type Supply = { scope: string; identity: string; missing: boolean }
type Pending = { id: string; scope: string; identity: string; signal: AbortSignal; resolve: (value: TerminalMarketObservation) => void }
const pending: Pending[] = []
const rows: TerminalMarketInstrument[] = ['BTC', 'ETH', 'SOL'].map(asset => ({ id: asset, symbol: `${asset}/USDT`, name: `Explicit Mock ${asset}`, market: 'EXPLICIT TEST MOCK', exchangeId: 'binance', categories: ['l1'], price: null, change: null, volume: null }))
function facts(id: string): TerminalMarketObservation['facts'] {
  const data: TerminalMarketPresentation['data'] = {}
  for (const period of marketPeriods) data[period] = { state: 'ready', source: `EXPLICIT TEST MOCK ${id} ${period}`, observedAt: '2030-01-01T00:00:00Z', value: metricKinds.map(kind => ({ kind, points: [{ time: 1, label: 'TEST 1' }, { time: 2, label: 'TEST 2' }], series: [{ label: `TEST ${kind}`, unit: 'TEST', axis: 'left', kind: 'line', values: [1, 2] }] })) }
  return { info: { state: 'ready', source: `EXPLICIT TEST MOCK ${id}`, observedAt: '2030-01-01T00:00:00Z', value: { name: `Explicit Mock ${id}`, values: {}, links: [] } }, data }
}
/** Typed display port only; the real public bootstrap, Main state, handlers and stores remain intact. */
export function ClientMainExperience() {
  const [supply, setSupply] = useState<Supply>({ scope: owner, identity: 'explicit-mock-market-1', missing: Reflect.get(window, 'mainTerminalMarketMissing') === true })
  const source = useMemo<TerminalMarketSource>(() => ({ scope: supply.scope, identity: supply.identity, preferences: createMarketSelectionStore(supply.scope, supply.identity), catalog: { state: 'ready', value: rows, source: 'EXPLICIT TEST MOCK', observedAt: '2030-01-01T00:00:00Z' }, load: (id, signal) => new Promise(resolve => pending.push({ id, signal, scope: supply.scope, identity: supply.identity, resolve })) }), [supply.scope, supply.identity])
  useEffect(() => {
    Reflect.set(window, 'mainTerminalMarketFixture', {
      patch: (patch: Partial<Supply>) => setSupply(before => ({ ...before, ...patch })),
      requests: () => pending.map(p => ({ id: p.id, scope: p.scope, identity: p.identity, aborted: p.signal.aborted })),
      resolve: (index: number, wrong = false) => {
        const p = pending[index]
        p.resolve({ scope: p.scope, identity: p.identity, instrumentId: wrong ? 'wrong-instrument' : p.id, chart: { ...chart, identity: `TEST-MAIN-${p.identity}-${p.id}-${index}`, market: `${p.id}/USDT`, sourceLabel: `EXPLICIT TEST MOCK ${p.identity} ${p.id} #${index}`, fills: [] }, facts: facts(p.id) })
      },
    })
    return () => { Reflect.deleteProperty(window, 'mainTerminalMarketFixture') }
  }, [])
  return <Main terminalMarketSource={supply.missing ? undefined : source} />
}
