export type BacktestResultMode = 'base' | 'stress' | 'atr' | 'filter' | 'cooldown'

// Presentation-only mock data. This is deliberately not an API or trading-domain contract.
export type ChartTimeframe = '15m' | '1h' | '2h' | '4h' | '1d'

export type MockMarketCandle = {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type MockBacktestMeta = {
  winRate: string
  trades: string
  score: number
  recovery: string
  title: string
}

export const CHART_TIMEFRAMES: Record<ChartTimeframe, {
  label: string
  shortLabel: string
  candleCount: string
  visualCandles: number
}> = {
  '15m': { label: '15분봉', shortLabel: '15m', candleCount: '210,240', visualCandles: 188 },
  '1h': { label: '1시간봉', shortLabel: '1h', candleCount: '52,560', visualCandles: 156 },
  '2h': { label: '2시간봉', shortLabel: '2h', candleCount: '26,280', visualCandles: 138 },
  '4h': { label: '4시간봉', shortLabel: '4h', candleCount: '13,140', visualCandles: 124 },
  '1d': { label: '일봉', shortLabel: '1D', candleCount: '2,190', visualCandles: 92 },
}

export function parseChartTimeframe(value?: string): ChartTimeframe | null {
  const normalized = value?.replace(/\s+/g, '').toLowerCase()
  if (normalized === '15분봉' || normalized === '15m' || normalized === '15분' || normalized === '15분마다') return '15m'
  if (normalized === '1시간봉' || normalized === '1h' || normalized === '1시간마다' || normalized === '한시간마다' || normalized === '매시간') return '1h'
  if (normalized === '2시간봉' || normalized === '2h' || normalized === '2시간마다') return '2h'
  if (normalized === '4시간봉' || normalized === '4h' || normalized === '4시간마다') return '4h'
  if (normalized === '일봉' || normalized === '1d' || normalized === '1일봉' || normalized === '하루에한번' || normalized === '매일') return '1d'
  return null
}

export function normalizeChartTimeframe(value?: string): ChartTimeframe {
  return parseChartTimeframe(value) ?? '4h'
}

export const RESULT_SERIES: Record<BacktestResultMode, number[]> = {
  base: [0, 2.4, 6.1, 3, 9.8, 4.2, 13.8, 6.4, 16.3, 12.1, 19.5, 14.3, 21.7],
  stress: [0, 2.1, -1.3, 3.7, -4.8, 1.1, -7.4, 4.2, -14.4, -4.2, -7.8, -5.6, -3.8],
  atr: [0, 2, 5, 1, 8, 3, 11, 2.9, 10, 8, 14, 11, 16.4],
  filter: [0, 2, 4, 1, 6, 2, 9, 2.1, 8, 7, 11, 9, 13.8],
  cooldown: [0, 3, 7, 2, 10, 4, 14, 4.8, 12, 8, 16, 11, 18.1],
}

export const BENCHMARK_SERIES = [0, 1.4, 3.2, 2.2, 5.1, 4.4, 7.2, 6.1, 9.3, 8.4, 11.2, 10.1, 13.1]

const timeframeResultTuning: Record<ChartTimeframe, { scale: number; texture: number; phase: number }> = {
  '15m': { scale: .72, texture: .19, phase: .7 },
  '1h': { scale: .86, texture: .13, phase: 1.3 },
  '2h': { scale: .94, texture: .08, phase: 2.1 },
  '4h': { scale: 1, texture: 0, phase: 0 },
  '1d': { scale: .79, texture: .06, phase: 2.8 },
}

export function getResultSeries(mode: BacktestResultMode, timeframe: ChartTimeframe = '4h') {
  const source = RESULT_SERIES[mode]
  if (timeframe === '4h') return source
  const tuning = timeframeResultTuning[timeframe]
  return source.map((value, index) => {
    if (index === 0) return 0
    const direction = mode === 'stress' ? -1 : 1
    const texture = Math.sin(index * 1.37 + tuning.phase) * tuning.texture * Math.max(3, Math.abs(value)) * direction
    return Number((value * tuning.scale + texture).toFixed(2))
  })
}

const resultMeta: Record<BacktestResultMode, Omit<MockBacktestMeta, 'winRate' | 'trades' | 'score' | 'recovery'> & {
  winRate: number
  trades: number
  score: number
  recoveryDays: number
}> = {
  base: { winRate: 61.8, trades: 164, score: 82, recoveryDays: 26, title: '기본 조건에서 검증 기준을 통과했습니다.' },
  stress: { winRate: 43.1, trades: 207, score: 38, recoveryDays: 91, title: '고변동성 구간에서 손실이 커졌습니다.' },
  atr: { winRate: 64.2, trades: 148, score: 88, recoveryDays: 19, title: 'ATR 동적 손절로 낙폭을 줄였습니다.' },
  filter: { winRate: 60.4, trades: 121, score: 84, recoveryDays: 16, title: '하락장 필터가 손실 구간을 줄였습니다.' },
  cooldown: { winRate: 63.1, trades: 139, score: 86, recoveryDays: 22, title: '재진입 쿨다운이 연속 손실을 줄였습니다.' },
}

const timeframeMetaTuning: Record<ChartTimeframe, { winRate: number; trades: number; score: number; recovery: number }> = {
  '15m': { winRate: -4.6, trades: 2.38, score: -7, recovery: 1.35 },
  '1h': { winRate: -1.9, trades: 1.48, score: -3, recovery: 1.18 },
  '2h': { winRate: .8, trades: 1.2, score: 2, recovery: .92 },
  '4h': { winRate: 0, trades: 1, score: 0, recovery: 1 },
  '1d': { winRate: 1.4, trades: .34, score: -1, recovery: 1.28 },
}

export function getMockBacktestMeta(mode: BacktestResultMode, timeframe: ChartTimeframe = '4h'): MockBacktestMeta {
  const base = resultMeta[mode]
  const tuning = timeframeMetaTuning[timeframe]
  return {
    winRate: `${Math.max(0, Math.min(100, base.winRate + tuning.winRate)).toFixed(1)}%`,
    trades: Math.max(1, Math.round(base.trades * tuning.trades)).toLocaleString('en-US'),
    score: Math.max(0, Math.min(100, base.score + tuning.score)),
    recovery: `${Math.max(1, Math.round(base.recoveryDays * tuning.recovery))}일`,
    title: base.title,
  }
}

const marketProfiles: Record<string, { basePrice: number; volumeBase: number; decimals: number }> = {
  BTC: { basePrice: 61_200, volumeBase: 820, decimals: 1 },
  ETH: { basePrice: 3_120, volumeBase: 8_600, decimals: 2 },
  SOL: { basePrice: 132, volumeBase: 42_000, decimals: 2 },
  BNB: { basePrice: 548, volumeBase: 18_000, decimals: 2 },
}

const timeframeMarketTuning: Record<ChartTimeframe, { seed: number; wave: number; wick: number; volume: number }> = {
  '15m': { seed: 11, wave: 1.34, wick: .0062, volume: .42 },
  '1h': { seed: 23, wave: 1.03, wick: .0086, volume: .72 },
  '2h': { seed: 37, wave: .83, wick: .011, volume: 1.06 },
  '4h': { seed: 53, wave: .64, wick: .014, volume: 1.54 },
  '1d': { seed: 71, wave: .39, wick: .023, volume: 3.8 },
}

const seededUnit = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

export function getMockMarketCandles(market: string, timeframe: ChartTimeframe): MockMarketCandle[] {
  const symbol = market.split('/')[0]?.toUpperCase() || 'BTC'
  const profile = marketProfiles[symbol] ?? { basePrice: 100, volumeBase: 12_000, decimals: 2 }
  const config = CHART_TIMEFRAMES[timeframe]
  const tuning = timeframeMarketTuning[timeframe]
  const start = Date.UTC(2020, 0, 1)
  // The fixture covers exactly 2,190 elapsed days, matching every timeframe's
  // displayed candle count (for example 13,140 four-hour candles).
  const end = Date.UTC(2025, 11, 30)
  let previousClose = profile.basePrice

  return Array.from({ length: config.visualCandles }, (_, index) => {
    const ratio = index / Math.max(1, config.visualCandles - 1)
    const envelope = Math.sin(Math.PI * ratio)
    const trend = profile.basePrice * (1 + ratio * .131)
    const cycle = envelope * (
      Math.sin(index * tuning.wave) * profile.basePrice * .0084
      + Math.sin(index * tuning.wave * .23 + tuning.seed) * profile.basePrice * .012
    )
    const micro = envelope * (seededUnit(index + tuning.seed) - .5) * profile.basePrice * .0048
    const close = trend + cycle + micro
    const open = index === 0 ? close : previousClose
    const wickScale = profile.basePrice * tuning.wick
    const high = Math.max(open, close) + wickScale * (.32 + seededUnit(index + tuning.seed * 3) * .68)
    const low = Math.min(open, close) - wickScale * (.3 + seededUnit(index + tuning.seed * 5) * .7)
    const volume = profile.volumeBase * tuning.volume * (.58 + seededUnit(index + tuning.seed * 7) * .84)
    previousClose = close
    return {
      timestamp: Math.round(start + (end - start) * ratio),
      open: Number(open.toFixed(profile.decimals)),
      high: Number(high.toFixed(profile.decimals)),
      low: Number(low.toFixed(profile.decimals)),
      close: Number(close.toFixed(profile.decimals)),
      volume: Math.round(volume),
    }
  })
}

export function getMaxDrawdown(series: number[]) {
  let peakEquity = 100 + (series[0] ?? 0)
  let maxDrawdown = 0
  for (const value of series) {
    const equity = 100 + value
    peakEquity = Math.max(peakEquity, equity)
    maxDrawdown = Math.min(maxDrawdown, ((equity - peakEquity) / peakEquity) * 100)
  }
  return maxDrawdown
}

export function getSeriesMetrics(mode: BacktestResultMode, timeframe: ChartTimeframe = '4h') {
  const series = getResultSeries(mode, timeframe)
  return {
    returnRate: series.at(-1) ?? 0,
    drawdown: getMaxDrawdown(series),
    benchmark: BENCHMARK_SERIES.at(-1) ?? 0,
  }
}
