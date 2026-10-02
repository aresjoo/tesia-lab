import { useLayoutEffect, useRef } from 'react'
import type { ClientTurn, createClientExperienceStore } from '../client-experience-store'
import type { MarketChartBlock, MarketChartRequest } from '../client-market-chart-presentation'
import { marketBindingKey } from '../client-market-response-presentation'
import type { MarketQuestionActions } from '../client-market-question-presentation'
import { ClientResponseSequence, type ClientResponseBlock } from './ClientResponseSequence'

/** Explicit host-supplied display data. Not a wire API or a built-in provider. */
export type ClientMarketChartSource = {
  id: string
  owner: string | null
  load: (request: MarketChartRequest, signal: AbortSignal) => Promise<unknown>
}

type Store = ReturnType<typeof createClientExperienceStore>
type Props = {
  sessionId: string
  turn: ClientTurn
  owner: string | null
  store: Store
  questionActions?: MarketQuestionActions
  source?: ClientMarketChartSource
  onFailure?: (error: unknown) => void
}
type Lifetime = { active: boolean }
type Flight = { cancel: () => void }

/** Read the current store, not the turn captured when the control was rendered.
 * A delayed response may replace only its own still-bound chart observation. */
function requestedChart(store: Store, sessionId: string, turnId: string, owner: string | null, request: MarketChartRequest): MarketChartBlock | null {
  const snapshot = store.getSnapshot()
  if (snapshot.currentId !== sessionId || snapshot.storageError || store.commitUncertain()
    || request.binding.scopeId !== JSON.stringify([owner, sessionId]) || request.binding.messageId !== turnId
    || !marketBindingKey(request.binding) || !Number.isSafeInteger(request.resolutionSeconds) || request.resolutionSeconds < 1) return null
  const session = snapshot.sessions.find(item => item.id === sessionId)
  const turn = session?.turns.find(item => item.id === turnId)
  if (!session || session.workspace !== 'conversation' || session.sharedCopy && session.sharedCopy.owner !== owner
    || !turn || turn.status !== 'done' || !turn.marketResponse || turn.marketResponse.owner !== owner) return null
  const matches = turn.marketResponse.blocks.filter((block): block is MarketChartBlock => block.kind === 'market-chart'
    && marketBindingKey(block.presentation.binding) === marketBindingKey(request.binding)
    && block.presentation.seriesId === request.seriesId && block.presentation.asset === request.asset
    && block.presentation.availableResolutions.includes(request.resolutionSeconds))
  return matches.length === 1 ? matches[0] : null
}

export function ClientStoredMarketResponse({ sessionId, turn, owner, store, questionActions, source, onFailure }: Props) {
  const sequence = turn.responseSequence?.owner === owner ? turn.responseSequence : undefined
  const display = turn.responseSequence || turn.responseSequenceInvalid ? Boolean(sequence) : turn.status === 'done'
  const response = display && turn.marketResponse?.owner === owner ? turn.marketResponse : undefined
  const provider = source && typeof source.id === 'string' && source.id.trim() && source.owner === owner && typeof source.load === 'function'
    ? source : undefined
  // Provider function wrappers may change on ordinary draft/locale renders.
  // Only the explicit source ID/owner and owning surface replace its lifetime.
  const lifetimeKey = JSON.stringify([owner, sessionId, turn.id, provider?.id ?? null, Boolean(response)])
  const current = useRef({ sessionId, turnId: turn.id, owner, store, provider, onFailure, visible: Boolean(response) })
  const lifetime = useRef<Lifetime | null>(null)
  const flights = useRef(new Map<string, Flight>())
  useLayoutEffect(() => { current.current = { sessionId, turnId: turn.id, owner, store, provider, onFailure, visible: Boolean(response) } })
  useLayoutEffect(() => {
    const active: Lifetime = { active: true }
    lifetime.current = active
    const pending = flights.current
    return () => {
      active.active = false
      if (lifetime.current === active) lifetime.current = null
      for (const flight of [...pending.values()]) flight.cancel()
    }
  }, [lifetimeKey, store])

  const request = (input: MarketChartRequest, signal: AbortSignal): Promise<boolean> => {
    const bound = current.current, active = lifetime.current, supplier = bound.provider
    if (!active?.active || !supplier || !bound.visible || signal.aborted) return Promise.resolve(false)
    let expected: MarketChartRequest, chart: MarketChartBlock | null
    try {
      // The provider gets a separate copy; mutation cannot retarget the commit.
      expected = { binding: { ...input.binding }, seriesId: input.seriesId, asset: input.asset, resolutionSeconds: input.resolutionSeconds }
      chart = requestedChart(bound.store, bound.sessionId, bound.turnId, bound.owner, expected)
    } catch { return Promise.resolve(false) }
    if (!chart) return Promise.resolve(false)
    const cardKey = JSON.stringify([chart.id, expected.binding.scopeId, expected.binding.messageId, expected.seriesId])
    if (flights.current.has(cardKey)) return Promise.resolve(false)
    return new Promise<boolean>(resolve => {
      const controller = new AbortController()
      let settled = false
      const settle = (accepted: boolean) => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', cancel)
        if (flights.current.get(cardKey) === flight) flights.current.delete(cardKey)
        resolve(accepted)
      }
      const cancel = () => {
        try { controller.abort() } finally { settle(false) }
      }
      const flight: Flight = { cancel }
      const valid = () => !settled && !controller.signal.aborted && !signal.aborted && active.active
        && lifetime.current === active && flights.current.get(cardKey) === flight
      const fail = (error: unknown) => {
        if (!valid()) return
        // Only the host owns safe error copy. Never render/log supplier values.
        try { current.current.onFailure?.(error) } catch { /* Reporting cannot strand the card. */ }
        settle(false)
      }
      flights.current.set(cardKey, flight)
      signal.addEventListener('abort', cancel, { once: true })
      if (signal.aborted) { cancel(); return }
      let loading: Promise<unknown>
      try { loading = supplier.load(structuredClone(expected), controller.signal) }
      catch (error) { fail(error); return }
      // Settle cancellation independently of load: an uncooperative supplier
      // must not leave a card locked or gain permission for a late write.
      void Promise.resolve(loading).then(value => {
        if (!valid()) return
        try {
          const latest = current.current
          const latestSupplier = latest.provider
          if (!latest.visible || latest.store !== bound.store || latest.owner !== bound.owner
            || latest.sessionId !== bound.sessionId || latest.turnId !== bound.turnId
            || !latestSupplier || latestSupplier.id !== supplier.id || latestSupplier.owner !== supplier.owner
            || !requestedChart(latest.store, latest.sessionId, latest.turnId, latest.owner, expected)) { settle(false); return }
          settle(latest.store.applyMarketChartResponse(latest.sessionId, latest.turnId, latest.owner, expected, value) === true)
        } catch (error) { fail(error) }
      }, fail)
    })
  }

  if (!response && !sequence) return null
  // A durable snapshot cannot restore an in-flight transport. Preserve its
  // last view, but expose explicit retry instead of an endless loading lock.
  const marketBlocks = (response?.blocks ?? []).map(block => block.kind === 'market-chart' && block.presentation.state === 'loading'
    ? { ...block, presentation: { ...block.presentation, state: 'error' as const } } : block)
  const blocks: ClientResponseBlock[] = sequence ? sequence.blocks.flatMap(block => {
    if (block.kind !== 'market-ref') return [block as ClientResponseBlock]
    const market = marketBlocks.find(item => item.id === block.blockId)
    return market ? [market] : []
  }) : marketBlocks
  return <ClientResponseSequence source="mock" blocks={blocks} questionActions={questionActions}
    chartActions={provider && turn.status === 'done' ? { request } : undefined}/>
}
