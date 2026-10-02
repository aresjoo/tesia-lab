/** Source catalogue display values. No conversion to the legacy RSI contract. */
import { catalogueAssets, catalogueTitle, catalogueUniverses, type CatalogueStrategy } from './client-catalogue'
import type { CataloguePreviewResult } from './client-catalogue-preview'
import type { StrategyIdentity, StrategyMarkerShape } from './client-strategy-identity'
import type { ListPerformance } from './client-strategy-list-performance'

export function catalogueIdentity(strategy: Readonly<CatalogueStrategy>) {
  const universe = 'uni' in strategy ? strategy.uni : undefined
  const shape: StrategyMarkerShape = universe === 'tech8' ? 'square' : universe === 'macro6' || universe === 'idx3' ? 'diamond' : 'circle'
  const universeSize = catalogueAssets(strategy).length
  // Source mkCurve uses these defaults for decorative futures curves. They
  // belong ONLY to the icon geometry, never to strategy rules or analysis.
  const curve = { rsiThreshold: 'rsiTh' in strategy ? strategy.rsiTh : 40, targetPercent: 'tp' in strategy ? strategy.tp ?? null : 8, trendFilter: 'tf' in strategy && Boolean(strategy.tf) }
  const glyph: StrategyIdentity['glyph'] = strategy.kind === 'agent'
    ? { kind: 'agent', shape, universeSize, selectedCount: strategy.top }
    : strategy.kind === 'mix' ? { kind: 'mix', shape, universeSize, ...curve } : { kind: 'rule', shape, ...curve }
  return {
    nick: strategy.id, title: catalogueTitle(strategy.name), author: strategy.by,
    asset: catalogueTitle(universe ? catalogueUniverses[universe].label : catalogueAssets(strategy)[0]),
    description: catalogueTitle(strategy.one.replace(/선물의 (\d+일) 평균이 (\d+일) 평균을 넘으면 롱, 밑돌면 숏으로 (\d+배 )?바꿔 탑니다\./, '선물에서 $1 평균선이 $2 평균선보다 높으면 롱, 낮으면 숏으로 $3운용합니다.')), followers: strategy.fw, kind: strategy.kind, market: strategy.mkt,
    glyph, venue: { name: { binance: 'Binance', bitget: 'Bitget', okx: 'OKX' }[strategy.ex], logo: strategy.ex },
  }
}

/** Convert an index into the source calendar's civil date. Existing common UI
 * readers use local getters; construct a local date without UTC day shifting. */
export function catalogueDateReader(calendar: CataloguePreviewResult['calendar']) {
  const start = Date.parse(`${calendar.start}T00:00:00Z`)
  return (index: number) => {
    if (!Number.isFinite(start) || !Number.isSafeInteger(index)) return new Date(NaN)
    const utc = new Date(start + index * 86_400_000)
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  }
}

/** Final source overview windows (mkOvKpi/mkdCtlHtml), unlike the legacy
 * restart-run route periods. No engine rerun and no fabricated daily prices. */
export function catalogueEquityWindow(full: CataloguePreviewResult['result'], days: number) {
  if (![0, 7, 30, 90, 365, 730].includes(days)) return null
  const points = days ? full.eq.slice(-(days + 1)) : full.eq
  // New strategies can have less than the selected window (source mkSlice).
  // Preserve that real inception; never pad pre-inception days. A truncated
  // full envelope must still be rejected rather than mistaken for a new run.
  if (points.length < 2 || full.eq[0]?.i !== full.params.startI || !(points[0].v > 0)) return null
  const first = points[0], end = full.params.endI
  if (points.at(-1)?.i !== end || points.some((p, index) => p.i !== first.i + index || !Number.isFinite(p.v) || p.v < 0)) return null
  const eq = points.map(p => ({ i: p.i, v: p.v / first.v }))
  let peak = 1, mdd = 0
  for (const p of eq) { peak = Math.max(peak, p.v); mdd = Math.min(mdd, (p.v / peak - 1) * 100) }
  // All-history source return includes the first day's entry fee. Do not
  // silently discard it by normalizing the initial marked balance again.
  return days ? { eq, ret: (eq.at(-1)!.v - 1) * 100, mdd } : { eq: full.eq, ret: full.ret, mdd: full.mdd }
}

export function catalogueListPerformance(full: CataloguePreviewResult['result']): ListPerformance | null {
  const window = catalogueEquityWindow(full, 30)
  return window ? { values: window.eq.map(p => p.v), percent: window.ret, start: window.eq[0].i, end: window.eq.at(-1)!.i } : null
}

export type CatalogueOrderRow = { id: string; positionId: number; asset: string; action: 'entry' | 'exit'; side?: number; date: number; signal: number | null; price: number; units: number; amount: number; open?: true; pnl?: number }
/** Source mkOrders, with actual decision indices instead of fabricated clock
 * seconds. Includes entries of positions that remain open at the snapshot end. */
export function catalogueOrders(value: CataloguePreviewResult): CatalogueOrderRow[] {
  const { result } = value
  const signals = new Map(result.events.filter(e => (e.t === 'enter' || e.t === 'exit') && e.tid != null && e.xi != null)
    .map(e => [`${e.tid}:${e.t}:${e.xi}`, e.i]))
  const rows: CatalogueOrderRow[] = []
  for (const trade of result.trades) {
    rows.push({ id: `${trade.id}:entry`, positionId: trade.id, asset: trade.asset, action: 'entry', side: trade.side, date: trade.entry, signal: signals.get(`${trade.id}:enter:${trade.entry}`) ?? null, price: trade.ep, units: Math.abs(trade.units) * 1000, amount: trade.cost * 1000 })
    rows.push({ id: `${trade.id}:exit`, positionId: trade.id, asset: trade.asset, action: 'exit', side: trade.side, date: trade.exit, signal: signals.get(`${trade.id}:exit:${trade.exit}`) ?? null, price: trade.xp, units: Math.abs(trade.units) * 1000, amount: trade.got * 1000, pnl: trade.pnl * 100 })
  }
  const open = result.state.open
  for (const position of Array.isArray(open) ? open : open ? [open] : []) rows.push({
    id: `${position.tid}:entry`, positionId: position.tid, asset: position.k, action: 'entry', side: 'side' in position ? position.side : undefined, open: true,
    date: position.entry, signal: signals.get(`${position.tid}:enter:${position.entry}`) ?? null,
    price: position.ep, units: Math.abs(position.units) * 1000, amount: position.cost * 1000,
  })
  return rows.sort((a, b) => b.date - a.date || (a.action === b.action ? b.positionId - a.positionId : a.action === 'exit' ? 1 : -1))
}

/** All analysis input stays attached to the exact configuration and data
 * generation. Authors are attribution, never IDs, rule aliases or account IDs. */
export function catalogueAnalysisRequest(value: CataloguePreviewResult) {
  const { strategy, result, calendar, dataVersion } = value
  return `공유 전략 분석 요청: ${catalogueTitle(strategy.name)}. 원본 전략 ID: ${strategy.id}. 등록자: ${strategy.by}. 클라이언트 스냅샷 미리보기이며 승인된 실서비스 백테스트가 아닙니다. 자료: ${calendar.start} ~ ${calendar.asof}, ${dataVersion.spot}, ${dataVersion.futures}. 규칙: ${JSON.stringify(strategy)}. 전체 기간 결과: 수익률 ${result.ret}%, 최대 낙폭 ${result.mdd}%, 승률 ${result.winRate}%, 종료 거래 ${result.n}회. 이 규칙과 결과에 근거해 강점과 위험을 설명해주세요. 제공하지 않은 조건이나 실시간 시장 데이터는 추측하지 마세요.`
}
