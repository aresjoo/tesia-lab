import { useMemo, useState, useSyncExternalStore } from 'react'
import { conditionalOrderTurnId, readConditionalOrderTag, type ConditionalOrderTagDisplay } from './client-conditional-order-intake'
import { createConditionalOrderPreviewStore, type ConditionalOrderPreviewOrder, type ConditionalOrderPreviewSpec } from './client-conditional-order-preview'

type PreviewStore = ReturnType<typeof createConditionalOrderPreviewStore>
export type ConditionalOrderAccountStorage = Pick<Storage, 'getItem' | 'setItem'>
export type ConditionalOrderAccountOptions = {
  owner: string | null
  currentSessionId: string | null
  sessionIds: readonly string[]
  storage?: ConditionalOrderAccountStorage
  now?: () => number
}
export type ConditionalOrderAccountSnapshot = Readonly<{
  currentOrders: readonly ConditionalOrderPreviewOrder[]
  allPendingOrders: readonly ConditionalOrderPreviewOrder[]
  error: 'storage' | 'corrupt' | 'scope' | 'conflict' | null
}>
const empty = Object.freeze([]) as readonly ConditionalOrderPreviewOrder[]
const specOf = (order: ConditionalOrderPreviewOrder): ConditionalOrderPreviewSpec => ({ asset: order.asset, symbol: order.symbol, side: order.side,
  trigger: order.trigger, triggerPct: order.triggerPct, last: order.last, qty: order.qty, qtyNum: order.qtyNum, lev: order.lev, ttl: order.ttl, exchange: order.exchange })
const validIdentity = (value: string) => typeof value === 'string' && value.length > 0 && value.length <= 100
  && [...value].every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)

/** Aggregates only this owner's explicit session list. It never scans storage,
 * deletes another session, auto-places orders, or consumes real model commands. */
export function createConditionalOrdersAccount(options: ConditionalOrderAccountOptions) {
  const namespace = options.owner === null ? 'guest' : `owner:${options.owner}`
  const listeners = new Set<() => void>(), entries = new Map<string, { store: PreviewStore; nextId: string }>()
  let localError: ConditionalOrderAccountSnapshot['error'] = null
  let snapshot: ConditionalOrderAccountSnapshot = Object.freeze({ currentOrders: empty, allPendingOrders: empty, error: null })
  const ids = [...new Set(options.sessionIds)].sort()
  if (!validIdentity(namespace) || ids.some(id => !validIdentity(id)) || options.currentSessionId !== null && !ids.includes(options.currentSessionId)) localError = 'scope'
  if (!localError) for (const id of ids) {
    const entry = { store: null as unknown as PreviewStore, nextId: '' }
    entry.store = createConditionalOrderPreviewStore({ namespace, sessionId: id, storage: options.storage, now: options.now, makeId: () => entry.nextId })
    entries.set(id, entry)
  }
  function refresh() {
    const orders = [...entries.values()].flatMap(entry => entry.store.getSnapshot().orders)
    const error = localError ?? [...entries.values()].map(entry => entry.store.getSnapshot().error).find(Boolean) ?? null
    snapshot = Object.freeze({ currentOrders: options.currentSessionId ? entries.get(options.currentSessionId)?.store.getSnapshot().orders ?? empty : empty,
      allPendingOrders: Object.freeze(orders.filter(order => order.status === 'wait')), error })
    for (const listener of listeners) listener()
  }
  for (const entry of entries.values()) entry.store.subscribe(refresh)
  refresh()
  function locate(id: string) {
    const matching = [...entries.values()].filter(entry => entry.store.getSnapshot().orders.some(order => order.id === id))
    if (matching.length !== 1 || localError === 'scope') throw new Error('현재 계정의 예약 미리보기를 확인해주세요.')
    return matching[0].store
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    observe(sessionId: string, turnId: string, text: string, display?: ConditionalOrderTagDisplay): ConditionalOrderPreviewOrder | null {
      const parsed = readConditionalOrderTag(text, display), id = conditionalOrderTurnId(sessionId, turnId), entry = entries.get(sessionId)
      if (!parsed || !id || !entry || localError === 'scope') return null
      const existing = entry.store.getSnapshot().orders.find(order => order.id === id)
      if (existing) {
        if (JSON.stringify(specOf(existing)) !== JSON.stringify(parsed.spec)) { localError = 'conflict'; refresh(); return null }
        return existing
      }
      entry.nextId = id
      try { entry.store.create(parsed.spec); return entry.store.getSnapshot().orders.find(order => order.id === id) ?? null }
      catch { refresh(); return null }
    },
    orderForTurn(sessionId: string, turnId: string) {
      const id = conditionalOrderTurnId(sessionId, turnId)
      return id ? entries.get(sessionId)?.store.getSnapshot().orders.find(order => order.id === id) ?? null : null
    },
    place(id: string) { return locate(id).place(id) },
    cancel(id: string) { return locate(id).cancel(id) },
  }
}

function defaultStorage(): ConditionalOrderAccountStorage | undefined {
  if (typeof window === 'undefined') return undefined
  try { return window.sessionStorage }
  catch { return { getItem() { throw new Error('Preview storage unavailable') }, setItem() { throw new Error('Preview storage unavailable') } } }
}

/** The caller observes completed Mock turns in an effect, never during render. */
export function useClientConditionalOrders(options: ConditionalOrderAccountOptions) {
  const [retrySequence, setRetrySequence] = useState(0)
  const key = JSON.stringify([...new Set(options.sessionIds)].sort())
  const storage = useMemo(() => options.storage ?? defaultStorage(), [options.storage])
  const account = useMemo(() => {
    // An explicit retry rebuilds the read-only storage observations.
    void retrySequence
    return createConditionalOrdersAccount({ owner: options.owner, currentSessionId: options.currentSessionId,
      sessionIds: JSON.parse(key) as string[], storage, now: options.now })
  }, [options.owner, options.currentSessionId, key, storage, options.now, retrySequence])
  const snapshot = useSyncExternalStore(account.subscribe, account.getSnapshot, account.getSnapshot)
  return useMemo(() => ({ ...snapshot, retry: () => setRetrySequence(sequence => sequence + 1), observe: account.observe, orderForTurn: account.orderForTurn, place: account.place, cancel: account.cancel }), [snapshot, account])
}
