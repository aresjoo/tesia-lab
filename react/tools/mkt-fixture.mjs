// 견줌에서 쓰는 시세 고정 응답. 터미널이 부르는 Binance 선물, CoinGecko 주소에 두 쪽 모두 같은 값을 돌려준다.
// 값은 화면 견줌만을 위한 고정 숫자다.
const SYMS = [
  ['BTC', 104250.5, 1.84, 18250000000, 'COIN', []],
  ['ETH', 3312.42, -0.92, 9120000000, 'COIN', ['Layer-1']],
  ['SOL', 182.337, 3.11, 3410000000, 'COIN', ['Layer-1']],
  ['XRP', 2.4158, -2.37, 1890000000, 'COIN', ['Payment']],
  ['DOGE', 0.21456, 0.42, 1220000000, 'COIN', ['Meme']],
  ['BNB', 712.18, 0.07, 640000000, 'COIN', ['Layer-1']],
  ['ADA', 0.7312, -1.15, 410000000, 'COIN', ['Layer-1']],
  ['1000PEPE', 0.0123456, 6.2, 980000000, 'COIN', ['Meme']],
  ['LINK', 17.482, 1.02, 350000000, 'COIN', ['Infrastructure']],
  ['AVAX', 34.91, -0.33, 290000000, 'COIN', ['Layer-1']],
  ['SUI', 3.2811, 4.75, 760000000, 'COIN', ['Layer-1']],
  ['WLD', 1.9042, -3.9, 210000000, 'COIN', ['AI']],
];
const row = (s, T0) => ({ symbol: s[0] + 'USDT', priceChange: String((s[1] * s[2]) / 100), priceChangePercent: String(s[2]), weightedAvgPrice: String(s[1]), lastPrice: String(s[1]), lastQty: '0.01', openPrice: String(s[1] / (1 + s[2] / 100)), highPrice: String(s[1] * 1.021), lowPrice: String(s[1] * 0.973), volume: String(Math.round(s[3] / s[1])), quoteVolume: String(s[3]), openTime: T0 - 864e5, closeTime: T0 - 1000, firstId: 1, lastId: 2, count: 1000 });
const info = (s) => ({ symbol: s[0] + 'USDT', pair: s[0] + 'USDT', contractType: 'PERPETUAL', status: 'TRADING', baseAsset: s[0], quoteAsset: 'USDT', underlyingType: s[4], underlyingSubType: s[5], onboardDate: Date.parse('2019-09-25T08:00:00Z') + SYMS.indexOf(s) * 864e5 * 97, filters: [{ filterType: 'PRICE_FILTER', tickSize: s[1] > 1000 ? '0.10' : s[1] > 1 ? '0.0100' : '0.0000100', minPrice: '0.1', maxPrice: '1000000' }, { filterType: 'LOT_SIZE', minQty: s[1] > 1000 ? '0.001' : '1', maxQty: '1000', stepSize: '0.001' }, { filterType: 'MIN_NOTIONAL', notional: s[1] > 1000 ? '100' : '5' }] });
const hist = (n, step, T0, f) => Array.from({ length: n }, (_, i) => f(i, T0 - (n - 1 - i) * step));
const wave = (i, a, b, k) => a + b * Math.sin(i * k) + (b / 3) * Math.cos(i * k * 2.7);

/** 주소에 맞는 고정 응답. 모르는 주소는 null (막는다) */
export function mktFixture(url, T0) {
  const u = new URL(url);
  const p = u.pathname;
  const q = u.searchParams;
  const sym = q.get('symbol') || q.get('pair') || 'BTCUSDT';
  const s = SYMS.find((x) => x[0] + 'USDT' === sym) || SYMS[0];
  const per = { '5m': 3e5, '15m': 9e5, '30m': 18e5, '1h': 36e5, '2h': 72e5, '4h': 144e5, '6h': 216e5, '12h': 432e5, '1d': 864e5 }[q.get('period') || '5m'] || 3e5;
  if (/binance\.com$/.test(u.hostname)) {
    if (p === '/fapi/v1/exchangeInfo') return { timezone: 'UTC', serverTime: T0, symbols: SYMS.map(info) };
    if (p === '/fapi/v1/ticker/24hr') return q.get('symbol') ? row(s, T0) : SYMS.map((x) => row(x, T0));
    if (p === '/fapi/v1/premiumIndex') return { symbol: sym, markPrice: String(s[1] * 1.0002), indexPrice: String(s[1] * 0.9997), estimatedSettlePrice: String(s[1]), lastFundingRate: '0.00008123', interestRate: '0.0001', nextFundingTime: T0 + 2 * 36e5 + 13 * 6e4 + 7000, time: T0 };
    if (p === '/futures/data/openInterestHist') return hist(30, per, T0, (i, t) => ({ symbol: sym, sumOpenInterest: String(wave(i, 82000, 3100, 0.41)), sumOpenInterestValue: String(wave(i, 82000, 3100, 0.41) * s[1] * (1 + i * 0.001)), CMCCirculatingSupply: '19950000', timestamp: t }));
    if (/LongShort(Account|Position)Ratio$/.test(p)) return hist(30, per, T0, (i, t) => ({ symbol: sym, longShortRatio: String(wave(i, p.indexOf('global') > 0 ? 1.42 : p.indexOf('Position') > 0 ? 1.91 : 1.63, 0.18, 0.37)), longAccount: '0.6', shortAccount: '0.4', timestamp: t }));
    if (p === '/futures/data/takerlongshortRatio') return hist(30, per, T0, (i, t) => ({ buySellRatio: '1.02', buyVol: String(wave(i, 1450, 420, 0.53)), sellVol: String(wave(i + 4, 1390, 380, 0.47)), timestamp: t }));
    if (p === '/futures/data/basis') return hist(30, per, T0, (i, t) => ({ pair: sym, contractType: 'PERPETUAL', futuresPrice: String(wave(i, s[1], s[1] * 0.006, 0.33)), indexPrice: String(wave(i, s[1] * 0.9995, s[1] * 0.006, 0.33)), basis: String(wave(i, s[1] * 0.0005, s[1] * 0.0003, 0.6)), basisRate: '0.0005', timestamp: t }));
    if (p === '/fapi/v1/fundingRate') return hist(40, 288e5, T0, (i, t) => ({ symbol: sym, fundingRate: String(wave(i, 0.00007, 0.00004, 0.45)), fundingTime: t, markPrice: String(s[1]) }));
    return null;
  }
  if (/coingecko\.com$/.test(u.hostname)) {
    if (p.endsWith('/global')) return { data: { total_market_cap: { usd: 3.52e12 }, market_cap_percentage: { btc: 58.4 } } };
    if (p.endsWith('/search')) { const b = (q.get('query') || '').toUpperCase(); return { coins: [{ id: 'fx-' + b.toLowerCase(), symbol: b, name: b + ' Coin' }] }; }
    const m = p.match(/\/coins\/([a-z0-9-]+)$/);
    if (m) {
      const names = { bitcoin: ['Bitcoin', 1, 2.06e12, 2.19e12, 4.1e10, 19950000, 21000000, 19950000], ethereum: ['Ethereum', 2, 3.98e11, 3.98e11, 2.2e10, 120400000, null, 120400000] };
      const n = names[m[1]] || [m[1].replace(/^fx-/, '').toUpperCase() + ' Coin', 37, 6.4e9, 9.1e9, 3.3e8, 512000000, 1000000000, 811000000];
      return { id: m[1], name: n[0], market_cap_rank: n[1], links: { homepage: ['https://example.org/'], whitepaper: 'https://example.org/paper.pdf', blockchain_site: ['https://example.org/explorer'] }, market_data: { market_cap: { usd: n[2] }, fully_diluted_valuation: { usd: n[3] }, total_volume: { usd: n[4] }, circulating_supply: n[5], max_supply: n[6], total_supply: n[7] } };
    }
    return null;
  }
  return null;
}
