import { marketPeriods, metricKinds, type TerminalMarketPresentation } from '../client-terminal-market'

/** TEST ONLY. Synthetic renderer inputs, never part of public/provider data. */
export const terminalMarketFixture: TerminalMarketPresentation = {
  binding: { id: 'fixture:btc', symbol: 'BTC/USDT', market: '무기한', exchangeId: 'binance' },
  quote: { state: 'ready', source: 'TEST ONLY · synthetic quote', observedAt: '2026-09-30 12:00 UTC', value: { price: '99,000.00 USDT', change: '+1,000.00 (+1.02%)', tone: 'up', values: { mark: '99,001.00 USDT', index: '98,999.00 USDT', funding: '0.0100% / 02:10:30', high: '100,000.00 USDT', low: '98,000.00 USDT', volume: '12,345 BTC', notional: '1.22B USDT' } } },
  info: { state: 'ready', source: 'TEST ONLY · synthetic metadata', observedAt: '2026-09-30', value: { name: 'Bitcoin', values: { rank: '1', cap: '1.95T USD', circulating: '19,700,000 BTC', tick: '0.01 USDT', minQuantity: '0.00001 BTC', minNotional: '5 USDT', listed: '2017-08-17' }, links: [{ label: '공식 웹사이트', url: 'https://bitcoin.org' }, { label: 'unsafe', url: 'javascript:alert(1)' }] } },
  data: Object.fromEntries(marketPeriods.map((period, p) => [period, { state: 'ready', source: `TEST ONLY · ${period}`, observedAt: '2026-09-30', value: metricKinds.map((kind, k) => ({ kind,
    points: [0, 1, 2, 3].map(i => ({ time: 1000 + i * (p + 1) * 60, label: `09/30 12:${String(i * 5).padStart(2, '0')}` })),
    series: [{ label: kind, unit: 'TEST', axis: 'left', kind: k % 2 ? 'bar' : 'line', values: [10 + p, 13 + p, kind === 'oi' ? null : 11 + p, 16 + p] }],
  })) }])) as TerminalMarketPresentation['data'],
}
