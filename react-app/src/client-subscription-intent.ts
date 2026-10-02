/** Public preview display preference only. This is not payment, UID linkage,
 * an entitlement, or permission to execute a strategy. */
export type SubscriptionCycle = 'month' | 'year'
type Intent = { sessionId: string; cycle: SubscriptionCycle }
type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function validId(value: unknown, limit: number): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > limit || value.trim() !== value
    || Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return false
  try { encodeURIComponent(value); return true }
  catch { return false }
}

function validCycle(value: unknown): value is SubscriptionCycle {
  return value === 'month' || value === 'year'
}

function decode(value: unknown): Intent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !('sessionId' in value) || !validId(value.sessionId, 200)
    || !('cycle' in value) || !validCycle(value.cycle)) return null
  // Copy only presentation fields; never retain or consume extra account state.
  return { sessionId: value.sessionId, cycle: value.cycle }
}

export function createClientSubscriptionIntentStore(owner: string | null, storage?: IntentStorage) {
  const key = validId(owner, 320) ? `teth-client-subscription-intent:account:${encodeURIComponent(owner)}` : null
  let current: Intent | null = null
  let storedSessionId: string | null = null
  let target: IntentStorage | undefined
  let writable = false
  if (key) {
    try {
      target = storage ?? sessionStorage
      const raw = target.getItem(key)
      if (raw === null) writable = true
      else {
        current = decode(JSON.parse(raw))
        if (current) { storedSessionId = current.sessionId; writable = true }
      }
    } catch { /* Unreadable or corrupt bytes remain untouched for this store lifetime. */ }
  }
  return {
    read(sessionId: string): SubscriptionCycle | null {
      return validId(sessionId, 200) && current?.sessionId === sessionId ? current.cycle : null
    },
    choose(sessionId: string, cycle: SubscriptionCycle): boolean {
      if (!key || !validId(sessionId, 200) || !validCycle(cycle)) return false
      current = { sessionId, cycle }
      if (!writable || !target) return false
      try {
        target.setItem(key, JSON.stringify(current))
        storedSessionId = sessionId
        return true
      } catch { return false }
    },
    clear(sessionId: string): boolean {
      if (!key || !validId(sessionId, 200)) return false
      if (current ? current.sessionId !== sessionId : storedSessionId !== sessionId) return true
      current = null
      if (!writable || !target) return false
      // A failed choose may leave another session's preference on disk.
      if (storedSessionId !== sessionId) return true
      try {
        target.removeItem(key)
        storedSessionId = null
        return true
      } catch { return false }
    },
  }
}
