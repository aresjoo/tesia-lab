import { useLayoutEffect, useRef } from 'react'
import type { createClientExperienceStore } from '../client-experience-store'

/** Host-supplied display observations. Not an API, provider or job controller. */
export type ClientResponseUpdate = {
  sessionId: string
  turnId: string
  expectedRevision: number
  sequence: unknown
  marketResponse?: unknown
}
export type ClientResponseSource = {
  id: string
  owner: string | null
  subscribe: (receive: (update: ClientResponseUpdate) => boolean, signal: AbortSignal) => void | (() => void)
}
type Props = {
  source?: ClientResponseSource
  owner: string | null
  store: ReturnType<typeof createClientExperienceStore>
  onFailure?: (error: unknown) => void
}

/** Lives at the shell, not inside the selected page/session. Merely leaving the
 * chat must not unsubscribe its work. Source/owner replacement does unsubscribe. */
export function ClientResponseSourceBridge({ source, owner, store, onFailure }: Props) {
  const provider = source && source.owner === owner && typeof source.id === 'string' && source.id.trim()
    && typeof source.subscribe === 'function' ? source : undefined
  const current = useRef({ provider, owner, store, onFailure })
  useLayoutEffect(() => { current.current = { provider, owner, store, onFailure } })
  const identity = provider ? JSON.stringify([provider.id, owner]) : null
  useLayoutEffect(() => {
    const bound = current.current, supplier = bound.provider
    if (!identity || !supplier) return
    const controller = new AbortController()
    const fail = (error: unknown) => {
      try { current.current.onFailure?.(error) } catch { /* A notice cannot accept a failed observation. */ }
    }
    let unsubscribe: void | (() => void)
    try {
      unsubscribe = supplier.subscribe(update => {
        const latest = current.current
        if (controller.signal.aborted || latest.owner !== bound.owner || latest.store !== bound.store
          || latest.provider?.id !== supplier.id || latest.provider?.owner !== supplier.owner) return false
        try {
          if (!update || typeof update !== 'object') return false
          return bound.store.applyResponseSequence(update.sessionId, update.turnId, bound.owner,
            update.expectedRevision, update.sequence, update.marketResponse)
        } catch (error) { fail(error); return false }
      }, controller.signal)
    } catch (error) { controller.abort(); fail(error) }
    return () => {
      controller.abort()
      try { unsubscribe?.() } catch { /* Disposal cannot revive the closed receive callback. */ }
    }
  }, [identity, store])
  return null
}
