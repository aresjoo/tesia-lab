import type { NativeChartWindowSelection } from './native-service-api'
import type { NativeReplayChartReader } from './native-replay-chart-reader'

type ReadonlyTree<T> = T extends object ? { readonly [K in keyof T]: ReadonlyTree<T[K]> } : T
export type NativeReplayPriceWindow = ReadonlyTree<Awaited<ReturnType<NativeReplayChartReader['readWindow']>>>
export type NativeReplayPriceIdentity = Readonly<{
  seriesId: NonNullable<NativeChartWindowSelection['seriesId']>
  resolution: NonNullable<NativeChartWindowSelection['resolution']>
  expectedManifestContentHash: string
  /** Use the verified chart.navigation.availableRange verbatim, not a series
   * range or a caller-calculated intersection of manifest ranges. */
  availableRange: Readonly<{ fromInclusive: string; toExclusive: string }>
}>
type Selection = Readonly<Required<NativeChartWindowSelection>>
type Slot = 'current' | 'next'
export type NativeReplayPriceWindowsState = Readonly<{
  status: 'idle' | 'loading' | 'ready' | 'waiting' | 'error' | 'disposed'
  identity: NativeReplayPriceIdentity
  current: NativeReplayPriceWindow | null
  next: NativeReplayPriceWindow | null
  /** Supplied by the future renderer's single clock, in UTC seconds. */
  targetTime: number | null
  pending: Readonly<{ slot: Slot; selection: Selection }> | null
  failure: Readonly<{ code: 'READ_FAILED' | 'IDENTITY_CONFLICT'; slot: Slot; selection: Selection }> | null
  /** Query EOF only. Says nothing about fills, playback, or job completion. */
  priceQueryEof: boolean
  /** A clock target has passed the visible window; do not invent that range. */
  waitingAt: string | null
  /** data: next window not ready (see pending/failure); advance: next is ready
   * and the consumer must issue advanceTo again, possibly with the SAME target.
   * A data arrival never promotes a window or advances the renderer's clock. */
  waitingFor: 'data' | 'advance' | null
}>
export type NativeReplayPriceWindowsInput = {
  /** Exclusively owned replay reader, never the shared manual result API.
   * readWindow transfers ownership of a fresh structuredClone of verified JSON
   * to this controller. Returned snapshots are frozen without another deep copy;
   * shared mutable caches or singleton result objects are not valid adapters. */
  reader: Pick<NativeReplayChartReader, 'readWindow' | 'dispose'>
  identity: NativeReplayPriceIdentity
  ownerSignal: AbortSignal
  isCurrent: () => boolean
}

function freezeTree<T>(value: T): ReadonlyTree<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeTree)
    Object.freeze(value)
  }
  return value as ReadonlyTree<T>
}
const timestamp = (value: string) => Date.parse(value) / 1000
const canonicalTime = (value: string) => Number.isFinite(timestamp(value))
  && new Date(timestamp(value) * 1000).toISOString().replace('.000Z', 'Z') === value

/** Price preparation only, NOT the full-period renderer or a fill merge.
 * No timers/markers/HTTP calls. A command promotes at most one window, even
 * when its clock target jumps years ahead. The caller must observe the new
 * window before issuing another advanceTo. Only current + next are retained.
 * Identity changes require a new instance and disposal of the previous one.
 */
export function createNativeReplayPriceWindows(input: NativeReplayPriceWindowsInput) {
  const identity = freezeTree({ ...input.identity, availableRange: { ...input.identity.availableRange } })
  const { reader, ownerSignal, isCurrent } = input
  const range = identity.availableRange
  if (!identity.seriesId || !identity.expectedManifestContentHash || !canonicalTime(range.fromInclusive)
    || !canonicalTime(range.toExclusive) || timestamp(range.fromInclusive) >= timestamp(range.toExclusive)) {
    throw new Error('NATIVE_REPLAY_PRICE_IDENTITY_INVALID')
  }
  let current: NativeReplayPriceWindow | null = null, next: NativeReplayPriceWindow | null = null
  let targetTime: number | null = null, started = false, disposed = false
  let pending: NativeReplayPriceWindowsState['pending'] = null
  let failure: NativeReplayPriceWindowsState['failure'] = null
  let operation: Promise<void> | null = null
  let cachedSnapshot: NativeReplayPriceWindowsState | undefined
  let publishedSnapshot: NativeReplayPriceWindowsState | undefined
  let retire: (() => void) | null = null
  const listeners = new Set<(state: NativeReplayPriceWindowsState) => void>()
  const snapshot = (): NativeReplayPriceWindowsState => {
    const waitingAt = current && targetTime !== null
      && targetTime >= timestamp(current.window.requestedRange.toExclusive)
      && current.navigation.nextFromInclusive !== null ? current.window.requestedRange.toExclusive : null
    const waitingFor: NativeReplayPriceWindowsState['waitingFor'] = waitingAt ? next ? 'advance' : 'data' : null
    const status = disposed ? 'disposed' : failure ? 'error' : waitingAt ? 'waiting' : pending ? 'loading' : current ? 'ready' : 'idle'
    if (cachedSnapshot && cachedSnapshot.status === status && cachedSnapshot.current === current && cachedSnapshot.next === next
      && cachedSnapshot.targetTime === targetTime && cachedSnapshot.pending === pending && cachedSnapshot.failure === failure) return cachedSnapshot
    cachedSnapshot = Object.freeze({
      status,
      identity, current, next, targetTime, pending, failure,
      priceQueryEof: current !== null && current.navigation.nextFromInclusive === null,
      waitingAt,
      waitingFor,
    })
    return cachedSnapshot
  }
  const publish = () => {
    const state = snapshot()
    if (publishedSnapshot === state) return
    publishedSnapshot = state
    // A subscriber added during publication already gets subscribe's immediate
    // snapshot. Do not visit it again in this publication's listener collection.
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue
      // A consumer's render error must not turn a successful read into a retry.
      try { listener(state) } catch { /* Observer isolation, no network retry. */ }
      // A reentrant command/disposal may have published a newer state already.
      // Stop that OLD publish, but deliver a disposed snapshot to ALL listeners.
      if (snapshot() !== state) break
    }
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    current = null; next = null; pending = null; failure = null; operation = null; targetTime = null
    // Command callers must not wait for a transport that ignores cancellation.
    // The raw read remains guarded and cannot publish a late response.
    retire?.(); retire = null
    ownerSignal.removeEventListener('abort', dispose)
    try { reader.dispose() } finally { publish(); listeners.clear() }
  }
  const live = () => {
    if (!disposed && (ownerSignal.aborted || !isCurrent())) dispose()
    return !disposed
  }
  const selectionAt = (fromInclusive: string): Selection => Object.freeze({
    seriesId: identity.seriesId, resolution: identity.resolution,
    expectedManifestContentHash: identity.expectedManifestContentHash, fromInclusive,
  })
  const validate = (value: NativeReplayPriceWindow, selection: Selection) => {
    const requested = value.window.requestedRange, navigation = value.navigation
    // The reader owns SDK/schema/source binding validation. These are the
    // controller's lifetime identity and forward-navigation invariants only.
    if (value.manifest.manifestContentHash !== identity.expectedManifestContentHash
      || value.window.manifestContentHash !== identity.expectedManifestContentHash
      || value.window.seriesId !== identity.seriesId || value.window.resolution !== identity.resolution
      || navigation.availableRange.fromInclusive !== range.fromInclusive || navigation.availableRange.toExclusive !== range.toExclusive
      || requested.fromInclusive !== selection.fromInclusive || !canonicalTime(requested.toExclusive)
      || timestamp(requested.toExclusive) <= timestamp(requested.fromInclusive)
      || timestamp(requested.toExclusive) > timestamp(range.toExclusive)
      || navigation.nextFromInclusive !== (requested.toExclusive === range.toExclusive ? null : requested.toExclusive)) {
      throw new Error('NATIVE_RESULT_BINDING_CONFLICT')
    }
  }
  const read = (slot: Slot, selection: Selection): Promise<void> => {
    if (!live() || operation) return operation ?? Promise.resolve()
    pending = Object.freeze({ slot, selection })
    failure = null
    // One retirement promise per active read, released after settlement. A
    // replay-wide pending promise would accumulate one race handler per window.
    const retired = new Promise<void>(resolve => { retire = resolve })
    // Install the operation before notifying observers: reentrant commands
    // cannot start a second read, including during the first loading publish.
    const rawRead = Promise.resolve().then(async () => {
      if (!live()) return
      try {
        const value = await reader.readWindow(selection)
        if (!live()) return
        validate(value, selection)
        const owned = freezeTree(value)
        if (slot === 'current') current = owned
        else next = owned
      } catch (error) {
        if (!live()) return
        if (error instanceof Error && error.message === 'NATIVE_REPLAY_DISPOSED') {
          dispose()
          return
        }
        failure = Object.freeze({ slot, selection, code: error instanceof Error && error.message === 'NATIVE_RESULT_BINDING_CONFLICT'
          ? 'IDENTITY_CONFLICT' : 'READ_FAILED' })
      } finally {
        if (!disposed) { pending = null; operation = null; retire = null; publish() }
      }
    })
    const work = Promise.race([rawRead, retired])
    operation = work
    publish()
    return work
  }
  const prefetch = () => {
    if (!live() || failure || next || !current || current.navigation.nextFromInclusive === null) return Promise.resolve()
    return read('next', selectionAt(current.navigation.nextFromInclusive))
  }
  ownerSignal.addEventListener('abort', dispose, { once: true })
  live()
  return {
    getState(): NativeReplayPriceWindowsState { live(); return snapshot() },
    /** Immediate snapshot, then state transitions. Unsubscribe releases only this observer. */
    subscribe(listener: (state: NativeReplayPriceWindowsState) => void) {
      live()
      if (!disposed) listeners.add(listener)
      listener(snapshot())
      return () => { listeners.delete(listener) }
    },
    async start(): Promise<NativeReplayPriceWindowsState> {
      if (!live()) return snapshot()
      if (started) { await operation; return snapshot() }
      started = true
      await read('current', selectionAt(range.fromInclusive))
      await prefetch()
      return snapshot()
    },
    async advanceTo(time: number): Promise<NativeReplayPriceWindowsState> {
      if (!live()) return snapshot()
      if (!started) throw new Error('NATIVE_REPLAY_PRICE_NOT_STARTED')
      if (!Number.isFinite(time) || time < timestamp(range.fromInclusive) || (targetTime !== null && time < targetTime)) {
        throw new Error('NATIVE_REPLAY_PRICE_TIME_INVALID')
      }
      targetTime = time
      if (failure) { publish(); return snapshot() }
      if (operation) {
        publish()
        await operation
        // Arrival never promotes a window automatically or drains a backlog.
        return snapshot()
      }
      if (current && next && time >= timestamp(current.window.requestedRange.toExclusive)) {
        current = next; next = null
      }
      publish()
      await prefetch()
      return snapshot()
    },
    async retry(): Promise<NativeReplayPriceWindowsState> {
      if (!live()) return snapshot()
      if (operation) { await operation; return snapshot() }
      const failed = failure
      if (!failed) return snapshot()
      await read(failed.slot, failed.selection)
      if (failed.slot === 'current') await prefetch()
      return snapshot()
    },
    dispose,
  }
}

export type NativeReplayPriceWindows = ReturnType<typeof createNativeReplayPriceWindows>
