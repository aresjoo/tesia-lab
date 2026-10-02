export const PREVIOUS_CONVERSATION_KEY = 'tesia.native.previous-conversation'
const CURRENT_KEY = 'tesia.native.conversation'
const OWNER_KEY = 'tesia.native.conversation-session'
export type PreviousConversation = { sessionId: string; conversationId: string }

// A bounded, untrusted navigation hint, never a snapshot or ownership receipt.
function checked(value: unknown): PreviousConversation {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'conversationId,sessionId') throw new Error('PREVIOUS_CONVERSATION_INVALID')
  const record = value as Record<string, unknown>
  if (typeof record.sessionId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(record.sessionId)
    || typeof record.conversationId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(record.conversationId)) throw new Error('PREVIOUS_CONVERSATION_INVALID')
  return { sessionId: record.sessionId, conversationId: record.conversationId }
}
export function readPreviousConversation(sessionId: string): PreviousConversation | null {
  try {
    const raw = sessionStorage.getItem(PREVIOUS_CONVERSATION_KEY)
    if (raw === null) return null
    if (raw.length > 512) throw new Error('PREVIOUS_CONVERSATION_INVALID')
    const record = checked(JSON.parse(raw))
    return record.sessionId === sessionId ? record : null
  } catch { throw new Error('PREVIOUS_CONVERSATION_UNAVAILABLE') }
}

// All reads precede writes. On a partial write failure restore each original
// locator independently; a wholly inaccessible store cannot promise rollback.
// The caller must keep its current view on any failure, including rollback loss.
export function changeConversationLocators(current: PreviousConversation | null, previous: PreviousConversation | null): void {
  const target = current ? checked(current) : null, prior = previous ? checked(previous) : null
  if (target && prior && target.sessionId !== prior.sessionId) throw new Error('PREVIOUS_CONVERSATION_INVALID')
  const keys = [PREVIOUS_CONVERSATION_KEY, CURRENT_KEY, OWNER_KEY]
  let original: (string | null)[]
  try { original = keys.map(key => sessionStorage.getItem(key)) } catch { throw new Error('PREVIOUS_CONVERSATION_UNAVAILABLE') }
  const values = [prior ? JSON.stringify(prior) : null, target?.conversationId ?? null, target?.sessionId ?? null]
  const put = (key: string, raw: string | null) => {
    if (raw === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, raw)
    if (sessionStorage.getItem(key) !== raw) throw new Error('PREVIOUS_CONVERSATION_UNAVAILABLE')
  }
  try { keys.forEach((key, index) => put(key, values[index])) }
  catch {
    let recovered = true
    keys.forEach((key, index) => { try { put(key, original[index]) } catch { recovered = false } })
    throw new Error(recovered ? 'PREVIOUS_CONVERSATION_UNAVAILABLE' : 'PREVIOUS_CONVERSATION_ROLLBACK_UNCONFIRMED')
  }
}
