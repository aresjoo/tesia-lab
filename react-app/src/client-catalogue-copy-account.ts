/** Source-preview actions only. No login/connection flag, API call or orders.
 * Caller supplies event time/ID; preview starts 30 source bars ago, as cpStart.
 */
import { catalogueSourceSha, findCatalogueStrategy } from './client-catalogue'
import type { CatalogueTrade } from './client-catalogue-ledger'
import { catalogueCopyBinding, sameCatalogueCopyBinding } from './client-catalogue-copy'
import { catalogueCopySettings, type CatalogueCopySettings } from './client-catalogue-copy-setup'
import { createCataloguePreviewClient, type CataloguePreviewResult } from './client-catalogue-preview'
import { readCatalogueCopyAccount, retryCatalogueCopyAccount, saveCatalogueCopyAccount, subscribeCatalogueCopyAccount,
  type CatalogueCopyAccount, type CatalogueCopyEntry, type CatalogueCopyRead, type CatalogueCopyStorage } from './client-catalogue-copy-store'

export type CatalogueCopyActionError = 'busy' | 'cancelled' | 'storage' | 'invalid-input' | 'missing-copy' | 'duplicate-copy' | 'insufficient-funds' | 'confirm-loss' | 'source-unavailable'
export type CatalogueCopyActionResult = { ok: true; id?: string } | { ok: false; error: CatalogueCopyActionError }
type Client = Pick<ReturnType<typeof createCataloguePreviewClient>, 'run' | 'copy' | 'dispose'> & Partial<Pick<ReturnType<typeof createCataloguePreviewClient>, 'market'>>
type Snapshot = CatalogueCopyRead & { busy: boolean; actionError: CatalogueCopyActionError | null }
const actionError = (code: CatalogueCopyActionError): never => { throw new CopyActionError(code) }
class CopyActionError extends Error { constructor(readonly code: CatalogueCopyActionError) { super(code) } }
const amountValid = (amount: number) => Number.isFinite(amount) && amount > 0
// Main and a nested detail can subscribe to the same preview account. Serialize
// only automatic observations on that storage/owner; user actions still use
// the normal compare-before-write boundary. This is not a cross-tab lock.
const waitingObservations = new WeakMap<CatalogueCopyStorage, Map<string, Promise<CatalogueCopyActionResult>>>()

export function createCatalogueCopyAccountController(owner: string, storage?: CatalogueCopyStorage, factory: () => Client = createCataloguePreviewClient) {
  let port = storage, unsubscribe: (() => void) | undefined, client: Client | null = null, retired = false, pending: AbortController | null = null
  let snapshot: Snapshot = { ...readCatalogueCopyAccount(owner, storage), busy: false, actionError: null }
  const listeners = new Set<() => void>()
  const emit = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) try { listener() } catch { /* Presentation must not change action results. */ }
  }
  const connect = () => {
    if (unsubscribe || retired) return
    try {
      port ??= sessionStorage
      unsubscribe = subscribeCatalogueCopyAccount(owner, () => {
        if (!retired) emit(readCatalogueCopyAccount(owner, port))
      }, port)
    } catch { /* Explicit retry may obtain the storage later. */ }
  }
  const engine = () => {
    if (retired || pending?.signal.aborted) return actionError('cancelled')
    return client ??= factory()
  }
  const source = async (id: string, signal: AbortSignal): Promise<CataloguePreviewResult> => {
    const value = await engine().run(id, 'all', signal)
    if (value.source !== 'client-snapshot-preview' || value.sourceSha !== catalogueSourceSha || value.strategy.id !== id || value.period !== 'all'
      || value.calculation !== 'full-run' || value.contextPeriod !== 'selected' || value.result.eq.length < 32) return actionError('source-unavailable')
    return value
  }
  const bound = async (entry: CatalogueCopyEntry, signal: AbortSignal) => {
    const value = await source(entry.record.binding.strategyId, signal)
    if (!sameCatalogueCopyBinding(entry.record.binding, catalogueCopyBinding(value))) return actionError('source-unavailable')
    return value
  }
  const find = (state: CatalogueCopyAccount, id: string) => state.copies.find(c => c.record.id === id) ?? actionError('missing-copy')
  const atValid = (entry: CatalogueCopyEntry, at: number) => {
    if (!Number.isSafeInteger(at) || at < entry.record.ledger.at(-1)!.at || at < 0) actionError('invalid-input')
  }
  const calculate = (entry: CatalogueCopyEntry, signal: AbortSignal) => engine().copy(owner, entry.record, [], signal)
  const close = async (state: CatalogueCopyAccount, entry: CatalogueCopyEntry, at: number, value: CataloguePreviewResult, signal: AbortSignal) => {
    atValid(entry, at)
    entry.record.status = 'closed'; entry.record.endI = value.result.params.endI
    // Snapshot settlement BEFORE appending its one withdrawal, exactly cpClose.
    const result = (await calculate(entry, signal)).calculation, back = Math.max(0, result.est)
    entry.settlement = { at, back, net: result.net, share: result.share }
    entry.record.ledger.push({ at, i: entry.record.endI, type: 'out', amount: back })
    state.spot += back
    await calculate(entry, signal)
  }
  const run = async (operation: (state: CatalogueCopyAccount, signal: AbortSignal) => Promise<{ id?: string; unchanged?: boolean }>, signal?: AbortSignal): Promise<CatalogueCopyActionResult> => {
    if (retired || signal?.aborted) return { ok: false, error: 'cancelled' }
    if (pending) return { ok: false, error: 'busy' }
    if (snapshot.error) return { ok: false, error: 'storage' }
    connect()
    const before = readCatalogueCopyAccount(owner, port)
    if (before.error || !before.state) { emit(before); return { ok: false, error: 'storage' } }
    const request = new AbortController(); pending = request
    const onAbort = () => request.abort(); signal?.addEventListener('abort', onAbort, { once: true })
    emit({ busy: true, actionError: null })
    try {
      if (signal?.aborted) request.abort()
      const next: CatalogueCopyAccount = structuredClone(before.state)
      const result = await operation(next, request.signal)
      if (retired || request.signal.aborted) return { ok: false, error: 'cancelled' }
      if (!result.unchanged) {
        next.revision++
        const saved = saveCatalogueCopyAccount(next, before, port)
        if (!saved.ok) { emit({ ...readCatalogueCopyAccount(owner, port), error: saved.error }); return { ok: false, error: 'storage' } }
      }
      emit(readCatalogueCopyAccount(owner, port))
      return { ok: true, ...(result.id ? { id: result.id } : {}) }
    } catch (error) {
      const code = request.signal.aborted || retired ? 'cancelled' : error instanceof CopyActionError ? error.code : 'source-unavailable'
      if (!retired) emit({ actionError: code })
      return { ok: false, error: code }
    } finally {
      signal?.removeEventListener('abort', onAbort)
      if (pending === request) pending = null
      if (!retired) emit({ busy: false })
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (retired) return () => {}
      listeners.add(listener); connect()
      // Close the constructor-to-subscription gap without clearing an error.
      if (!snapshot.error) emit(readCatalogueCopyAccount(owner, port))
      return () => { listeners.delete(listener) }
    },
    retry() {
      if (retired || pending) return
      connect(); emit({ ...retryCatalogueCopyAccount(owner, port), actionError: null })
    },
    /** Source mkWindCheck. Time alone is never evidence of an exit: only a
     * calculation bound to this exact source can settle a waiting record.
     * Manual management and presentation-only inspect remain non-mutating. */
    async reconcileWaiting(at: number, signal?: AbortSignal): Promise<CatalogueCopyActionResult> {
      if (retired || signal?.aborted) return { ok: false, error: 'cancelled' }
      connect()
      let observations: Map<string, Promise<CatalogueCopyActionResult>> | undefined
      if (port) {
        observations = waitingObservations.get(port)
        if (!observations) { observations = new Map(); waitingObservations.set(port, observations) }
        const previous = observations.get(owner)
        if (previous) { await previous; return this.reconcileWaiting(at, signal) }
      }
      const operation = run(async (state, abort) => {
        if (!Number.isSafeInteger(at) || at < 0) return actionError('invalid-input')
        let changed = false
        for (const entry of state.copies) {
          if (entry.record.status !== 'active' || entry.stopMode !== 'wait' || entry.record.stopI === undefined) continue
          const value = await bound(entry, abort), projection = await calculate(entry, abort)
          if (projection.calculation.posOpen !== false) continue
          await close(state, entry, at, value, abort)
          changed = true
        }
        return { unchanged: !changed }
      }, signal)
      if (!observations) return operation
      const settled = operation.finally(() => { if (observations.get(owner) === settled) observations.delete(owner) })
      observations.set(owner, settled)
      return settled
    },
    /** Read-only presentation. Bound to the captured revision; never writes or
     * settles an account simply because its screen was opened. */
    async market(strategyId: string, asset: string, signal: AbortSignal) {
      if (retired || signal.aborted || snapshot.error || !snapshot.state) return actionError('source-unavailable')
      const before = snapshot.raw, client = engine()
      if (!client.market) return actionError('source-unavailable')
      const value = await client.market(strategyId, asset, signal)
      if (retired || signal.aborted || snapshot.error || snapshot.raw !== before) return actionError('cancelled')
      return value
    },
    async inspect(id: string, signal: AbortSignal, detail = false) {
      if (retired || signal.aborted || snapshot.error || !snapshot.state) return actionError('source-unavailable')
      const before = snapshot, entry = find(structuredClone(before.state!), id)
      const value = await bound(entry, signal)
      if (retired || signal.aborted) return actionError('cancelled')
      const projection = await engine().copy(owner, entry.record, [], signal)
      // sk-cpx: show the latest 40 participated source trades, using the budget
      // observed AT ENTRY (not today's balance). Each worker request stays within
      // its existing 32-observation limit. Summary rows do no extra work.
      const trades: { source: CatalogueTrade; invested: number; pnl: number }[] = []
      if (detail) {
        const end = entry.record.endI ?? value.result.params.endI
        const candidates = value.result.trades.filter(t => t.entry >= entry.record.startI && t.exit >= entry.record.startI && t.exit <= end).slice().reverse()
        const amounts = new Map<number, number>()
        for (let offset = 0; offset < candidates.length && trades.length < 40; offset += 32) {
          if (retired || signal.aborted || snapshot.error || snapshot.raw !== before.raw) return actionError('cancelled')
          const batch = candidates.slice(offset, offset + 32)
          const indices = [...new Set(batch.map(t => t.entry))].filter(i => !amounts.has(i))
          if (indices.length) {
            const observed = await engine().copy(owner, entry.record, indices, signal)
            for (const point of observed.observations) amounts.set(point.i, point.value.invested)
          }
          for (const source of batch) {
            const atEntry = amounts.get(source.entry)
            if (atEntry === undefined) return actionError('source-unavailable')
            const invested = atEntry * (source.w ?? 1), pnl = source.pnl * invested
            if (!Number.isFinite(invested) || !Number.isFinite(pnl)) return actionError('source-unavailable')
            if (invested > 0.005 && trades.length < 40) trades.push({ source, invested, pnl })
          }
        }
      }
      if (retired || signal.aborted || snapshot.error || snapshot.raw !== before.raw) return actionError('cancelled')
      return { entry, value, projection, trades }
    },
    start(input: { id: string; strategyId: string; settings: CatalogueCopySettings; at: number }, signal?: AbortSignal) {
      let request: typeof input
      try { request = structuredClone(input) } catch { return Promise.resolve<CatalogueCopyActionResult>({ ok: false, error: 'invalid-input' }) }
      return run(async (state, abort) => {
        const strategy = findCatalogueStrategy(request.strategyId)
        if (!strategy || strategy.id !== request.strategyId || !Number.isSafeInteger(request.at) || request.at < 0) return actionError('invalid-input')
        if (state.copies.some(c => c.record.id === request.id || c.record.status === 'active' && c.record.binding.strategyId === strategy.id)) return actionError('duplicate-copy')
        const settings = catalogueCopySettings(strategy, state.spot, String(request.settings.amount), request.settings.loss, request.settings.existing, String(request.settings.cap))
        if (!settings) return actionError(request.settings.amount > state.spot ? 'insufficient-funds' : 'invalid-input')
        const value = await source(strategy.id, abort), startI = value.result.eq.at(-31)!.i
        const entry: CatalogueCopyEntry = { record: { model: 'catalogue-units-preview', owner, id: request.id, binding: catalogueCopyBinding(value), startI, settings, status: 'active',
          ledger: [{ at: request.at, i: startI, type: 'add', amount: settings.amount }], flats: [] } }
        await calculate(entry, abort)
        state.spot -= settings.amount; state.copies.push(entry)
        return { id: request.id }
      }, signal)
    },
    topup(signal?: AbortSignal) { return run(async state => { state.topups++; state.spot += 1000; return {} }, signal) },
    adjust(id: string, amount: number, direction: 'add' | 'out', at: number, confirmLoss = false, signal?: AbortSignal) {
      return run(async (state, abort) => {
        const entry = find(state, id); atValid(entry, at)
        if (entry.record.status !== 'active' || !amountValid(amount) || !['add', 'out'].includes(direction)) return actionError('invalid-input')
        const value = await bound(entry, abort), result = (await calculate(entry, abort)).calculation
        if (amount > (direction === 'add' ? state.spot : result.avail)) return actionError('insufficient-funds')
        if (direction === 'add' && result.myPct <= -.2 && !confirmLoss) return actionError('confirm-loss')
        entry.record.ledger.push({ at, i: value.result.params.endI, type: direction, amount })
        state.spot += direction === 'add' ? -amount : amount
        await calculate(entry, abort)
        return { id }
      }, signal)
    },
    flatten(id: string, at: number, signal?: AbortSignal) {
      return run(async (state, abort) => {
        const entry = find(state, id); atValid(entry, at)
        if (entry.record.status !== 'active') return actionError('invalid-input')
        const value = await bound(entry, abort), i = value.result.params.endI
        if (entry.record.stopI !== undefined) await close(state, entry, at, value, abort)
        else {
          if (entry.record.flats.includes(i)) return { id, unchanged: true }
          entry.record.flats.push(i); await calculate(entry, abort)
        }
        return { id }
      }, signal)
    },
    stop(id: string, mode: 'now' | 'wait' | 'manual', at: number, signal?: AbortSignal) {
      return run(async (state, abort) => {
        const entry = find(state, id); atValid(entry, at)
        if (!['now', 'wait', 'manual'].includes(mode)) return actionError('invalid-input')
        if (entry.record.status === 'closed') return { id, unchanged: true }
        const value = await bound(entry, abort), result = (await calculate(entry, abort)).calculation
        if (mode === 'now' || !result.posOpen) await close(state, entry, at, value, abort)
        else {
          if (entry.record.stopI !== undefined && entry.stopMode === mode) return { id, unchanged: true }
          entry.record.stopI = value.result.params.endI; entry.stopMode = mode
          await calculate(entry, abort)
        }
        return { id }
      }, signal)
    },
    dispose() {
      if (retired) return
      retired = true; pending?.abort(); unsubscribe?.(); unsubscribe = undefined
      client?.dispose(); client = null; listeners.clear()
    },
  }
}
