import { useEffect, useRef, useState } from 'react'
import type { CopyPreviewActionResult, CopyPreviewState } from './client-copy-preview-state'
import { readCopyPreviewState, saveCopyPreviewState, subscribeCopyPreview, copyPreviewStoreErrorMessage } from './client-copy-preview-store'

/** Explicit public preview only; never a service balance store or order authority. */
export function useCopyPreviewAccount(owner: string | null, route = '', enabled = true) {
  const read = () => enabled ? readCopyPreviewState(owner) : { state: null, error: null }
  const [loaded, setLoaded] = useState(read)
  const [actionError, setActionError] = useState('')
  const [previousOwner, setPreviousOwner] = useState(owner)
  const [previousEnabled, setPreviousEnabled] = useState(enabled)
  if (previousOwner !== owner || previousEnabled !== enabled) { setPreviousOwner(owner); setPreviousEnabled(enabled); setLoaded(read()); setActionError('') }
  const [previousRoute, setPreviousRoute] = useState(route)
  if (previousRoute !== route) { setPreviousRoute(route); setActionError('') }
  const busy = useRef(false)
  const [subscriptionEpoch, setSubscriptionEpoch] = useState(0)
  useEffect(() => {
    if (!enabled || !owner) return
    return subscribeCopyPreview(owner, error => {
      setLoaded(previous => {
        if (previous.state?.owner !== owner) return previous
        if (error) return { ...previous, error }
        // An uncertain write needs the user's explicit fresh read, even if
        // another mounted consumer subsequently saves successfully.
        return previous.error ? previous : readCopyPreviewState(owner)
      })
    })
  }, [enabled, owner, subscriptionEpoch])
  const acceptRead = (next: ReturnType<typeof readCopyPreviewState>) => {
    // Keep the form's identity during a failed read, not its financial values.
    // Consumers must mask the retained snapshot while blocked.
    setLoaded(previous => next.error && previous.state?.owner === owner ? { ...next, state: previous.state } : next)
  }
  const retry = () => { acceptRead(read()); setActionError(''); setSubscriptionEpoch(value => value + 1) }
  const commit = (action: (state: CopyPreviewState) => CopyPreviewActionResult): boolean => {
    if (!enabled || busy.current || !owner || loaded.error) return false
    busy.current = true
    try {
      // Re-read on every explicit click: double-clicks and remounts cannot spend stale balances.
      const current = readCopyPreviewState(owner)
      if (current.error || !current.state) { acceptRead(current); return false }
      const result = action(current.state)
      if (!result.ok) { setActionError(result.message); return false }
      const saved = saveCopyPreviewState(result.state)
      if (!saved.ok) {
        // A throwing setter/readback may still have persisted bytes. Require a fresh read,
        // never roll back or repeat a mutation on the assumption that nothing happened.
        setLoaded({ state: current.state, error: saved.error })
        return false
      }
      setLoaded({ state: result.state, error: null }); setActionError('')
      return true
    } finally { busy.current = false }
  }
  const storageError = loaded.error && owner ? copyPreviewStoreErrorMessage(loaded.error) : ''
  return { state: enabled && loaded.state?.owner === owner ? loaded.state : null, error: storageError || actionError, storageError, actionError,
    clearActionError: () => setActionError(''),
    blocked: !enabled || Boolean(loaded.error || !loaded.state || loaded.state.owner !== owner), retry, commit }
}
export type CopyPreviewAccount = ReturnType<typeof useCopyPreviewAccount>
