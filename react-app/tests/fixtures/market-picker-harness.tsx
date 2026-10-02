/* eslint-disable react-refresh/only-export-components -- explicit browser-only test fixture */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClientTerminalMarketHeader } from '../../src/components/ClientTerminalMarket'
import type { MarketPickerRow } from '../../src/client-market-picker'

export type PickerFixture = { state?: 'loading' | 'error' | 'unavailable'; duplicate?: boolean; identity?: string; many?: boolean; missing?: boolean; selectedIcon?: string; selectedId?: string }
export const pickerRows: MarketPickerRow[] = [
  { id: 'btc', symbol: 'BTCUSDT', name: '비트코인', categories: ['l1'], price: 60000, change: 1.2, volume: 2000000, icon: '/client-template-assets/btc.svg' },
  { id: 'eth', symbol: 'ETHUSDT', name: '이더리움', categories: ['l1', 'defi'], price: 2500, change: -2.3, volume: 1000000 },
  { id: 'nvda', symbol: 'NVDAUSDT', name: '엔비디아', searchAliases: ['NVIDIA'], categories: ['us', 'ai'], price: 120, change: 0, volume: 50000 },
  { id: 'kr', symbol: 'SAMSUNGUSDT', name: '삼성전자', categories: ['kr'], price: null, change: null, volume: null },
]
function Harness({ fixture }: { fixture: PickerFixture }) {
  const [favorites, setFavorites] = useState<string[]>(['btc', 'eth']), [selection, setSelection] = useState('btc')
  const [count, setCount] = useState(0)
  const displayRows = pickerRows.map(row => row.id === selection && fixture.selectedIcon !== undefined ? { ...row, icon: fixture.selectedIcon } : row)
  const rows = fixture.many ? Array.from({ length: 740 }, (_, index) => ({ ...displayRows[index % 4], id: `row-${index}`, symbol: `SYMBOL${String(index).padStart(4, '0')}USDT` })) : fixture.duplicate ? [...displayRows, displayRows[0]] : displayRows
  const symbol = pickerRows.find(row => row.id === selection)?.symbol ?? selection
  return <><ClientTerminalMarketHeader symbol={symbol} market="TEST ONLY" presentation={{ binding: { id: 'fixture', symbol, market: 'TEST ONLY', exchangeId: 'fixture' },
    picker: fixture.missing ? undefined : { identity: fixture.identity ?? 'owner-a', selectedId: fixture.selectedId ?? selection, favorites,
      rows: fixture.state ? { state: fixture.state } : { state: 'ready', value: rows, source: 'TEST ONLY', observedAt: '2030-01-01T00:00:00Z' },
      onFavorite: (id, value) => setFavorites(previous => value ? [...new Set([...previous, id])] : previous.filter(item => item !== id)),
      onSelect: id => { setSelection(id); setCount(previous => previous + 1) },
    },
  }} /><output data-testid="selection">{selection}</output><output data-testid="count">{count}</output><button type="button">Outside action</button></>
}
export function mountMarketPicker(fixture: PickerFixture = {}) {
  document.getElementById('root')?.remove()
  const host = document.createElement('main'); host.id = 'picker-test-root'; document.body.append(host)
  const root = createRoot(host)
  const render = (value: PickerFixture) => root.render(<Harness fixture={value} />)
  render(fixture)
  return { update: render, unmount: () => root.unmount() }
}
