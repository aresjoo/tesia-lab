// Display inputs, not an HTTP schema or a claim of backend verification.
// A contract-owned adapter must supply already bound prices and fills.
export type PriceBar = { time: number; open: number; high: number; low: number; close: number; volume: number }
export type PriceFill = { id: string; tradeId: string; time: number; price: number; side: 'BUY' | 'SELL' }
export type PriceChartView = {
  identity: string
  market: string
  resolutionSeconds: number
  pricePrecision: number
  sourceLabel: string
  bars: readonly PriceBar[]
  fills: readonly PriceFill[]
}

// Parent chat renders may reallocate the same payload. Preserve the renderer
// only for equal content; identity alone must never hide a changed result.
export function equalPriceViews(a: PriceChartView | null, b: PriceChartView | null): boolean {
  if (a === b) return true
  if (!a || !b || a.identity !== b.identity || a.market !== b.market || a.sourceLabel !== b.sourceLabel
    || a.resolutionSeconds !== b.resolutionSeconds || a.pricePrecision !== b.pricePrecision
    || a.bars.length !== b.bars.length || a.fills.length !== b.fills.length) return false
  return a.bars.every((bar, i) => (['time', 'open', 'high', 'low', 'close', 'volume'] as const).every(key => bar[key] === b.bars[i][key]))
    && a.fills.every((fill, i) => (['id', 'tradeId', 'time', 'price', 'side'] as const).every(key => fill[key] === b.fills[i][key]))
}

export function priceResolutionLabel(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400}일`
  if (seconds % 3600 === 0) return `${seconds / 3600}시간`
  if (seconds % 60 === 0) return `${seconds / 60}분`
  return `${seconds}초`
}

export function priceChartIssue(view: PriceChartView): string | null {
  if (!view.identity || !view.market || !view.sourceLabel) return '데이터 출처를 확인할 수 없습니다.'
  if (!Number.isSafeInteger(view.resolutionSeconds) || view.resolutionSeconds < 1) return '표시 주기를 확인할 수 없습니다.'
  if (!Number.isInteger(view.pricePrecision) || view.pricePrecision < 0 || view.pricePrecision > 12) return '가격 표시 정밀도를 확인할 수 없습니다.'
  if (!view.bars.length) return '표시할 가격 데이터가 없습니다.'
  if (view.bars.length > 5_000 || view.fills.length > 10_000) return '조회 범위를 좁혀 주세요.'
  let previous = -Infinity
  for (const bar of view.bars) {
    if (!Number.isSafeInteger(bar.time) || bar.time < 0 || bar.time > 253_402_300_799 || bar.time - previous < view.resolutionSeconds
      || ![bar.open, bar.high, bar.low, bar.close].every(value => Number.isFinite(value) && value > 0)
      || !Number.isFinite(bar.volume) || bar.volume < 0
      || bar.low > Math.min(bar.open, bar.close) || bar.high < Math.max(bar.open, bar.close)) return '가격 데이터의 순서와 범위를 확인할 수 없습니다.'
    previous = bar.time
  }
  const ids = new Set<string>()
  for (const fill of view.fills) {
    if (!fill.id || ids.has(fill.id) || !fill.tradeId || !Number.isSafeInteger(fill.time) || fill.time < 0 || fill.time > 253_402_300_799
      || !Number.isFinite(fill.price) || fill.price <= 0 || !['BUY', 'SELL'].includes(fill.side)) return '체결 데이터를 확인할 수 없습니다.'
    ids.add(fill.id)
  }
  return null
}

// A fill belongs to the containing interval, never the nearest future candle.
// Gaps stay gaps: no candle or fill position is invented.
export function containingBar(view: PriceChartView, time: number): number | null {
  let lo = 0, hi = view.bars.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (view.bars[mid].time <= time) lo = mid + 1; else hi = mid }
  const index = lo - 1
  return index >= 0 && time < view.bars[index].time + view.resolutionSeconds ? index : null
}

export function priceMarkerGroups(view: PriceChartView) {
  const groups = new Map<string, { id: string; index: number; time: number; side: PriceFill['side']; fills: PriceFill[] }>()
  for (const fill of view.fills) {
    const index = containingBar(view, fill.time)
    if (index === null) continue
    const id = `bar:${index}:${fill.side}`
    const existing = groups.get(id)
    if (existing) existing.fills.push(fill)
    else groups.set(id, { id, index, time: view.bars[index].time, side: fill.side, fills: [fill] })
  }
  const result = [...groups.values()].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
  result.forEach(group => group.fills.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id)))
  return result
}

export function visiblePriceMarkers<T extends { time: number }>(markers: readonly T[], throughExclusive: number): T[] {
  return markers.filter(marker => marker.time < throughExclusive)
}

// Reused from the preserved BacktestWorkspace's display-only EMA calculation.
// This is a window-initialized visual indicator, not a strategy signal.
export function chartEma(bars: readonly PriceBar[], period: number) {
  const multiplier = 2 / (period + 1)
  let previous = bars[0]?.close ?? 0
  return bars.map((bar, index) => {
    previous = index === 0 ? bar.close : (bar.close - previous) * multiplier + previous
    return { time: bar.time, value: previous }
  })
}
