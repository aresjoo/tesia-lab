import type { PriceChartView } from '../chart/price-chart-view'

// UI verification ONLY. Never a backend result or a user's strategy.
export const base = 1_700_000_000
export const fixture: PriceChartView = {
  identity: 'TEST_ONLY_PRICE_VIEW', market: 'BTC / USDT', resolutionSeconds: 60, pricePrecision: 2, sourceLabel: '렌더러 검증용 합성 입력',
  bars: Array.from({ length: 120 }, (_, index) => ({ time: base + index * 60, open: 100 + index, high: 104 + index, low: 97 + index, close: 102 + index, volume: 10 + index })),
  fills: [
    { id: 'buy-1', tradeId: 'trade-a', time: base + 125, price: 103, side: 'BUY' },
    { id: 'buy-2', tradeId: 'trade-b', time: base + 150, price: 104, side: 'BUY' },
    { id: 'sell-1', tradeId: 'trade-a', time: base + 4500, price: 178, side: 'SELL' },
  ],
}
