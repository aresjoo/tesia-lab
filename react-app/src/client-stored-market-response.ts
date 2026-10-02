import { priceChartIssue, type PriceChartView } from './chart/price-chart-view'
import type { MarketChartBlock, MarketChartPresentation, MarketScenarioPresentation } from './client-market-chart-presentation'
import type { MarketQuestionBlock } from './client-market-question-presentation'
import type { MarketResponseBinding, MarketResponseBlock } from './client-market-response-presentation'
import { boundMarketScenario } from './client-market-scenario'
import { decodeMarketQuestionState } from './client-market-question-state'

/** Local display restoration only; not a service schema, producer or authority. */
export type StoredMarketBlock = MarketResponseBlock | MarketQuestionBlock | MarketChartBlock
export type StoredMarketResponse = { version: 1; owner: string | null; blocks: StoredMarketBlock[]; writingObservationId?: string }

type RecordValue = Record<string, unknown>
function invalid(): never { throw new Error('Invalid stored market display') }
function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as RecordValue
}
function text(value: unknown, nonempty = false): string {
  if (typeof value !== 'string' || nonempty && !value.trim()) return invalid()
  return value
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid()
  return value
}
function integer(value: unknown, minimum: number): number {
  const result = number(value)
  if (!Number.isSafeInteger(result) || result < minimum) return invalid()
  return result
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') return invalid()
  return value
}
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return invalid()
  return value as T
}
function array(value: unknown, maximum?: number): unknown[] {
  if (!Array.isArray(value) || maximum !== undefined && value.length > maximum) return invalid()
  // JSON storage is dense, but callers still pass unknown values to this gate.
  for (let index = 0; index < value.length; index++) if (!(index in value)) return invalid()
  return value
}
function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid()
  return items
}
function optionalText<K extends string>(row: RecordValue, key: K): Partial<Record<K, string>> {
  return row[key] === undefined ? {} : { [key]: text(row[key]) } as Record<K, string>
}
function binding(value: unknown, scopeId: string, turnId: string): MarketResponseBinding {
  const row = record(value)
  if (row.scopeId !== scopeId || row.messageId !== turnId) return invalid()
  return { scopeId, messageId: turnId, observationId: text(row.observationId, true) }
}

function chartView(value: unknown): PriceChartView {
  const row = record(value)
  const view: PriceChartView = {
    identity: text(row.identity, true), market: text(row.market, true), sourceLabel: text(row.sourceLabel, true),
    resolutionSeconds: integer(row.resolutionSeconds, 1), pricePrecision: integer(row.pricePrecision, 0),
    bars: array(row.bars, 5_000).map(value => {
      const bar = record(value)
      return { time: number(bar.time), open: number(bar.open), high: number(bar.high), low: number(bar.low),
        close: number(bar.close), volume: number(bar.volume) }
    }),
    fills: array(row.fills, 10_000).map(value => {
      const fill = record(value)
      return { id: text(fill.id, true), tradeId: text(fill.tradeId, true), time: number(fill.time),
        price: number(fill.price), side: choice(fill.side, ['BUY', 'SELL'] as const) }
    }),
  }
  // Shape checks above are required: the renderer validator consumes typed data.
  // Do not sort, round, normalize or otherwise repair financial observations.
  if (priceChartIssue(view, true)) return invalid()
  return view
}

function chart(row: RecordValue, observed: MarketResponseBinding, scopeId: string, turnId: string): MarketChartPresentation {
  const availableResolutions = array(row.availableResolutions).map(value => integer(value, 1))
  if (new Set(availableResolutions).size !== availableResolutions.length) return invalid()
  const view = row.view === null ? null : chartView(row.view)
  const result: MarketChartPresentation = {
    binding: observed, seriesId: text(row.seriesId, true), asset: text(row.asset, true), assetLabel: text(row.assetLabel, true),
    resolutionSeconds: integer(row.resolutionSeconds, 1), availableResolutions,
    state: choice(row.state, ['loading', 'ready', 'error', 'unavailable'] as const), view,
  }
  if (view && (view.market !== result.asset || view.resolutionSeconds !== result.resolutionSeconds)) return invalid()
  if (row.scenario !== undefined) {
    const value = record(row.scenario)
    if (value.restored !== undefined) boolean(value.restored)
    const scenario: MarketScenarioPresentation = {
      binding: binding(value.binding, scopeId, turnId), seriesId: text(value.seriesId, true),
      viewIdentity: text(value.viewIdentity, true), asset: text(value.asset, true),
      resolutionSeconds: integer(value.resolutionSeconds, 1), upperPrice: number(value.upperPrice),
      lowerPrice: number(value.lowerPrice), horizonTime: number(value.horizonTime), basisLabel: text(value.basisLabel, true),
      restored: true,
    }
    result.scenario = scenario
    if (!boundMarketScenario(result)) return invalid()
  }
  return result
}

function block(value: unknown, scopeId: string, turnId: string): StoredMarketBlock {
  const row = record(value), id = text(row.id, true), p = record(row.presentation)
  const observed = binding(p.binding, scopeId, turnId)
  switch (row.kind) {
    case 'market-price':
      return { id, kind: row.kind, presentation: {
        binding: observed, asset: text(p.asset, true), priceLabel: text(p.priceLabel, true), changeLabel: text(p.changeLabel),
        changeBasis: text(p.changeBasis), tone: choice(p.tone, ['up', 'down', 'neutral'] as const),
        sourceLabel: text(p.sourceLabel, true), observedAtLabel: text(p.observedAtLabel, true), intervalLabel: text(p.intervalLabel, true),
      } }
    case 'market-timeline': {
      const events = uniqueIds(array(p.events, 4).map(value => {
        const event = record(value)
        return {
          id: text(event.id, true), dateLabel: text(event.dateLabel, true), title: text(event.title, true),
          ...optionalText(event, 'sourceLabel'), ...optionalText(event, 'sourceUrl'), ...optionalText(event, 'mappedTradingDateLabel'),
          ...optionalText(event, 'priceLabel'), ...optionalText(event, 'changeLabel'),
          ...(event.tone === undefined ? {} : { tone: choice(event.tone, ['up', 'down', 'neutral'] as const) }),
        }
      }))
      if (!events.length) return invalid()
      return { id, kind: row.kind, presentation: { binding: observed, events, observedDaily: boolean(p.observedDaily) } }
    }
    case 'market-evidence':
      return { id, kind: row.kind, presentation: {
        binding: observed, searches: integer(p.searches, 0), results: integer(p.results, 0), pagesRead: integer(p.pagesRead, 0),
        sources: uniqueIds(array(p.sources).map(value => {
          const source = record(value)
          // Unsafe URLs remain inert text under the existing renderer's URL gate.
          return { id: text(source.id, true), title: text(source.title, true), url: text(source.url), ...optionalText(source, 'description') }
        })),
      } }
    case 'market-direction': {
      const up = number(p.up), down = number(p.down)
      if (!boolean(p.hasMarketObservation) || up < 0 || down < 0 || up > 100 || down > 100 || Math.abs(up + down - 100) > 1e-8) return invalid()
      if (p.restored !== undefined) boolean(p.restored)
      return { id, kind: row.kind, presentation: {
        binding: observed, asset: text(p.asset, true), ...optionalText(p, 'symbol'), up, down,
        sourceLabel: text(p.sourceLabel, true), observedAtLabel: text(p.observedAtLabel, true),
        hasMarketObservation: true, restored: true,
      } }
    }
    case 'market-question': {
      const steps = uniqueIds(array(p.steps, 4).map(value => {
        const step = record(value)
        const options = uniqueIds(array(step.options, 7).map(value => {
          const option = record(value)
          return { id: text(option.id, true), label: text(option.label, true), ...optionalText(option, 'description') }
        }))
        if (!options.length) return invalid()
        return { id: text(step.id, true), title: text(step.title), options,
          ...(step.multi === undefined ? {} : { multi: boolean(step.multi) }) }
      }))
      if (!steps.length) return invalid()
      const presentation = { binding: observed, steps }
      const state = p.state === undefined ? undefined : decodeMarketQuestionState(p.state, presentation)
      if (state === null) return invalid()
      return { id, kind: row.kind, presentation: { ...presentation, ...(state ? { state } : {}) } }
    }
    case 'market-chart':
      return { id, kind: row.kind, presentation: chart(p, observed, scopeId, turnId) }
    default: return invalid()
  }
}

/** Reject the entire damaged envelope so its parent can retain the original
 * transcript. All returned objects are explicitly selected display fields;
 * unknown stored keys, callback-shaped data and executable tags do not survive.
 * Observed values/order are unchanged; only restoration motion flags are set. */
export function readStoredMarketResponse(value: unknown, sessionId: string, turnId: string): StoredMarketResponse | null {
  try {
    text(sessionId, true); text(turnId, true)
    const row = record(value)
    if (row.version !== 1) return null
    const owner = row.owner === null ? null : text(row.owner, true)
    const scopeId = JSON.stringify([owner, sessionId])
    const blocks = uniqueIds(array(row.blocks).map(value => block(value, scopeId, turnId)))
    const questions = blocks.filter(item => item.kind === 'market-question')
    if (new Set(questions.map(item => item.presentation.binding.observationId)).size !== questions.length) return null
    const writingObservationId = row.writingObservationId === undefined ? undefined : text(row.writingObservationId, true)
    if (writingObservationId && !questions.some(item => item.presentation.binding.observationId === writingObservationId
      && item.presentation.state && !item.presentation.state.closed && !item.presentation.state.accepted
      && item.presentation.state.direct[item.presentation.state.index])) return null
    return { version: 1, owner, blocks, ...(writingObservationId ? { writingObservationId } : {}) }
  } catch { return null }
}
